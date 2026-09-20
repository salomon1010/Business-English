/* The YouTube relay the iOS shell uses (index.html RemoteYT ↔ yt-embed.html).
   Two origins, as on the phone: the app on http://localhost:8781 (standing in
   for capacitor://localhost, with window.Capacitor stubbed so IS_IOS_APP is
   true) and the relay on http://127.0.0.1:8782 (standing in for
   app.lomonec.com). Three parts:

   1. protocol — the relay URL is answered by a stub page that speaks the
      documented postMessage protocol with a fake clock: deterministic, no
      network, proves RemoteYT end to end (ready → play → clock → seek → pause
      → destroy, origin checks, timeout → onError).
   2. real relay — the same flow against yt-embed.html with the real YouTube
      IFrame API. Needs youtube.com; when it cannot load within 25 s the part
      is reported as NOT VERIFIED, never as a pass.
   3. web unchanged — without the Capacitor stub the studio still creates the
      real YT.Player, not RemoteYT.

   node ios-yt-relay.mjs            (from tests/, after npm install) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const serve = (port) => spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
const s1 = serve(8781), s2 = serve(8782);
process.on("exit", () => { s1.kill(); s2.kill(); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
await sleep(900);

const APP = "http://localhost:8781", RELAY_ORIGIN = "http://127.0.0.1:8782", RELAY = RELAY_ORIGIN + "/yt-embed.html";
const VID = "MZAjfsyJa1U";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : " — " + d}`); };
const note = (n) => console.log(`  NOTE  ${n}`);

const seed = () => {
  localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "T", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now() }));
  localStorage.setItem("be_theme", "dark");
};
const stubCapacitor = () => { window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true }; };

/* the stub relay: same protocol as yt-embed.html, fake 1× clock, 10 Hz snapshots */
const STUB = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#123"><script>
(function(){var q=new URLSearchParams(location.search),o=q.get("o"),v=q.get("v"),start=Number(q.get("start"))||0;
if(window.parent===window||!o||!v){document.body.textContent="stub: not framed";return}
var t=start,st=5,rate=1,at=Date.now(),dur=222.5,ready=false,timer=null,log=[];
function post(m){m.be="yt";parent.postMessage(m,o)}
function cur(){return st===1?Math.min(dur,t+(Date.now()-at)/1000*rate):t}
function snap(){post({ev:"time",t:cur(),state:st,rate:rate,duration:dur,at:Date.now()})}
function setState(s){t=cur();at=Date.now();st=s;post({ev:"state",state:s});clearInterval(timer);timer=null;if(s===1)timer=setInterval(snap,100);snap()}
addEventListener("message",function(e){if(e.origin!==o)return;var m=e.data||{};if(m.be!=="yt")return;log.push(m.cmd);
  if(m.cmd==="play")setState(1);else if(m.cmd==="pause")setState(2);else if(m.cmd==="seek"){t=Number(m.t)||0;at=Date.now();snap()}else if(m.cmd==="rate"){t=cur();at=Date.now();rate=Number(m.rate)||1;snap()}});
setTimeout(function(){ready=true;post({ev:"ready",title:"Stub video "+v,duration:dur,rate:1});snap()},300);
window.__stub={log:log};})();
</script>`;

const browser = await chromium.launch();

/* ---------- 1. protocol, deterministic ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(seed); await ctx.addInitScript(stubCapacitor);
  await ctx.addInitScript((relay) => { localStorage.setItem("be_yt_relay", relay); }, RELAY);
  await ctx.route(RELAY + "*", r => r.fulfill({ status: 200, contentType: "text/html", body: STUB }));
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(APP + "/index.html?r=" + Date.now() + "#shadow", { waitUntil: "load" });
  await page.waitForFunction(() => typeof shLoad === "function" && typeof go === "function", null, { timeout: 20000 });
  const boot = await page.evaluate(() => ({ ios: IS_IOS_APP, cls: typeof RemoteYT }));
  ok("IS_IOS_APP true with the Capacitor stub; RemoteYT defined", boot.ios === true && boot.cls === "function", JSON.stringify(boot));
  /* ytPlayer is a top-level `let`, so it is not a window property: read it by name */
  await page.evaluate(async (vid) => { go("shadow"); await shLoad({ vid, start: 12, end: 0, title: "clip" }, true); try { shOpenWork(); } catch (e) {} }, VID);
  await sleep(400);
  const fr = await page.evaluate(() => { const f = document.querySelector("#ytBox iframe"); return f ? { src: f.src, allow: f.getAttribute("allow"), w: f.getBoundingClientRect().width } : null; });
  ok("studio frames the relay, not youtube.com, with video id, start and the app origin", !!fr && fr.src.startsWith(RELAY) && fr.src.includes("v=" + VID) && fr.src.includes("start=12") && fr.src.includes("o=" + encodeURIComponent(APP)), JSON.stringify(fr));
  ok("iframe allows autoplay/encrypted-media and fills the player box once the workspace is open", !!fr && /autoplay/.test(fr.allow) && fr.w > 100, JSON.stringify(fr));
  const ready = await page.waitForFunction(() => typeof ytPlayer !== "undefined" && ytPlayer && ytPlayer._ready === true, null, { timeout: 8000 }).then(() => true, () => false);
  ok("onReady arrives through the relay (title, duration)", ready && await page.evaluate(() => ytPlayer.getVideoData().title.startsWith("Stub video") && ytPlayer.getDuration() === 222.5));
  const s0 = await page.evaluate(() => ({ t: ytPlayer.getCurrentTime(), st: ytPlayer.getPlayerState() }));
  await page.evaluate(() => ytPlayer.playVideo()); await sleep(1300);
  const s1v = await page.evaluate(() => ({ t: ytPlayer.getCurrentTime(), st: ytPlayer.getPlayerState(), now: document.getElementById("shNow") && document.getElementById("shNow").textContent }));
  ok("playVideo → state 1 and the interpolated clock advances (~1.3 s)", s1v.st === 1 && s1v.t > s0.t + 0.9 && s1v.t < s0.t + 2.5, JSON.stringify({ s0, s1v }));
  ok("the studio's time read-out follows the relay clock", !!s1v.now && s1v.now !== "0:00", JSON.stringify(s1v));
  await page.evaluate(() => ytPlayer.seekTo(60, true)); await sleep(400);
  const s2v = await page.evaluate(() => ytPlayer.getCurrentTime());
  ok("seekTo(60) lands within a second", s2v >= 60 && s2v < 61.5, String(s2v));
  await page.evaluate(() => ytPlayer.setPlaybackRate(2)); await sleep(1000);
  const s3v = await page.evaluate(() => ({ t: ytPlayer.getCurrentTime(), r: ytPlayer.getPlaybackRate() }));
  ok("setPlaybackRate(2) doubles the clock", s3v.r === 2 && s3v.t > 61.6 && s3v.t < 64.5, JSON.stringify(s3v));
  await page.evaluate(() => ytPlayer.pauseVideo()); await sleep(400);
  const paused = await page.evaluate(() => ({ st: ytPlayer.getPlayerState(), t: ytPlayer.getCurrentTime() })); await sleep(500);
  const paused2 = await page.evaluate(() => ytPlayer.getCurrentTime());
  ok("pauseVideo → state 2 and the clock stops", paused.st === 2 && Math.abs(paused2 - paused.t) < 0.05, JSON.stringify({ paused, paused2 }));
  /* a message from a foreign origin must be ignored */
  await page.evaluate(() => { window.postMessage({ be: "yt", ev: "time", t: 9999, state: 1, rate: 1 }, "*"); }); await sleep(200);
  ok("a message from another window/origin is ignored", await page.evaluate(() => ytPlayer.getCurrentTime()) < 100);
  await page.evaluate(() => { ytPlayer.destroy(); });
  ok("destroy removes the iframe", await page.evaluate(() => !document.querySelector("#ytBox iframe")));
  ok("no page errors", errs.length === 0, errs.join(" | "));
  /* timeout path: a relay that never answers → onError, not a dead player */
  const errCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await errCtx.addInitScript(seed); await errCtx.addInitScript(stubCapacitor);
  await errCtx.addInitScript((relay) => { localStorage.setItem("be_yt_relay", relay); }, RELAY);
  await errCtx.route(RELAY + "*", r => r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>silent</title>" }));
  const ep = await errCtx.newPage();
  await ep.goto(APP + "/index.html?r=" + Date.now() + "#shadow", { waitUntil: "load" });
  await ep.waitForFunction(() => typeof shLoad === "function", null, { timeout: 20000 });
  await ep.evaluate(() => { window.__errs = []; });
  await ep.evaluate(async (vid) => { go("shadow"); await shLoad({ vid, start: 0, end: 0, title: "clip" }, true); const p = ytPlayer; clearTimeout(p._to); p._to = setTimeout(() => { if (!p._ready) p._ev.onError({ data: -2, target: p }); }, 800); }, VID);
  await sleep(1500);
  const errUI = await ep.evaluate(() => { const e = document.getElementById("shVidErr"); return { exists: !!e, shown: !!e && e.style.display !== "none" }; });
  ok("a relay that never answers → the studio's video-error state (#shVidErr), not a dead player", errUI.exists && errUI.shown, JSON.stringify(errUI));
  await errCtx.close(); await ctx.close();
}

/* ---------- 2. the real relay page against YouTube (best effort) ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(seed); await ctx.addInitScript(stubCapacitor);
  await ctx.addInitScript((relay) => { localStorage.setItem("be_yt_relay", relay); }, RELAY);
  const page = await ctx.newPage();
  await page.goto(APP + "/index.html?r=" + Date.now() + "#shadow", { waitUntil: "load" });
  await page.waitForFunction(() => typeof shLoad === "function", null, { timeout: 20000 });
  await page.evaluate(async (vid) => { go("shadow"); await shLoad({ vid, start: 0, end: 0, title: "clip" }, true); }, VID);
  const ready = await page.waitForFunction(() => typeof ytPlayer !== "undefined" && ytPlayer && ytPlayer._ready === true, null, { timeout: 25000 }).then(() => true, () => false);
  if (!ready) {
    const err = await page.evaluate(() => (typeof ytPlayer !== "undefined" && ytPlayer ? "state " + ytPlayer._state : "no player") + ", iframe " + !!document.querySelector("#ytBox iframe"));
    note(`real relay NOT VERIFIED here: YouTube did not report ready within 25 s from this machine (${err}) — check on the device and at https://app.lomonec.com/yt-embed.html?v=${VID}&o=capacitor%3A%2F%2Flocalhost once deployed`);
  } else {
    const d = await page.evaluate(() => ({ title: ytPlayer.getVideoData().title, dur: ytPlayer.getDuration() }));
    ok("real yt-embed.html: YouTube player ready through the relay (title + duration)", d.title.length > 0 && d.dur > 0, JSON.stringify(d));
    await page.evaluate(() => ytPlayer.seekTo(20, true)); await sleep(2500);
    const t = await page.evaluate(() => ytPlayer.getCurrentTime());
    ok("real relay: seekTo(20) reflected within ~2.5 s (autoplay may be blocked headless, so ±3 s)", t >= 17 && t < 26, String(t));
  }
  await ctx.close();
}

/* ---------- 3. the web app is untouched ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(seed);
  const page = await ctx.newPage();
  await page.goto(APP + "/index.html?r=" + Date.now() + "#shadow", { waitUntil: "load" });
  await page.waitForFunction(() => typeof shLoad === "function", null, { timeout: 20000 });
  const web = await page.evaluate(async () => { const r = { ios: IS_IOS_APP }; try { await Promise.race([loadYT(), new Promise((_, rej) => setTimeout(() => rej(new Error("api timeout")), 15000))]); r.player = (window.YT && YT.Player === RemoteYT) ? "RemoteYT" : (window.YT && YT.Player ? "YT.Player" : "none"); } catch (e) { r.player = "api not loaded: " + e.message; } return r; });
  ok("without Capacitor: IS_IOS_APP false and loadYT never substitutes RemoteYT", web.ios === false && web.player !== "RemoteYT", JSON.stringify(web));
  await ctx.close();
}

await browser.close();
const pass = res.filter(Boolean).length;
console.log(`\n  ${pass}/${res.length} pass  (${APP} + ${RELAY_ORIGIN})`);
process.exit(pass === res.length ? 0 : 1);
