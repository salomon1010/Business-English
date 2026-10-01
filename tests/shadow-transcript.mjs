/* A pasted video's words: the first minute first, the rest in windows (owner, 27 Sep 2026:
   "the transcript loading is not working properly … make it appear directly when the link is loaded").
   Run: cd tests && node shadow-transcript.mjs        (BASE=… for another tree)
   WebKit, iPhone 13. be-polish is answered here with a delay per request, like the real Worker;
   YouTube is a stand-in player that reports a 705-second video. */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8138);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await webkit.launch();
const VID = "pAsTeD00001", DUR = 705;
const cuesFor = (from, to) => { const out = []; for (let t = from; t < to; t += 10) out.push({ t, txt: "Line spoken at " + t + " seconds." }); return out; };
/* mode "win": the new Worker (answers the stretch asked, echoes `win`); "whole": the Worker before
   this change (ignores the window and returns the whole video, no `win`) */
async function learner(mode, seedCaps) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
  const asks = [];
  await ctx.route(u => /be-events|cloudflareinsights|youtube|ytimg|entitlements/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.route(u => /be-polish/.test(u.href), async r => {
    const H = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" };
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
    let body = {}; try { body = JSON.parse(r.request().postData() || "{}"); } catch (e) {}
    if (body.captions) return r.fulfill({ status: 404, contentType: "application/json", headers: H, body: '{"error":"track_parse"}' });
    if (!body.ytai) return r.fulfill({ status: 404, headers: H, body: "{}" });
    asks.push({ from: body.from, to: body.to, at: Date.now() });
    await sleep(mode === "whole" ? 2500 : body.from ? 4000 : 1500);
    const j = mode === "whole" || body.to == null ? { vid: body.ytai, source: "gemini", lang: "en", cues: cuesFor(0, DUR), maxSec: 1800 }
      : { vid: body.ytai, source: "gemini", lang: "en", cues: cuesFor(body.from, Math.min(body.to, DUR)), maxSec: 1800, win: [body.from, body.to] };
    return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify(j) });
  });
  await ctx.addInitScript(([caps]) => {
    if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1);
      localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Probe", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now() }));
      if (caps) localStorage.setItem("be_caps", caps); }
    /* the stand-in player: a 705-second video whose clock the test moves */
    window.__t = 0;
    const P = function (id, o) { const me = { destroy() {}, playVideo() {}, pauseVideo() {}, seekTo(t) { window.__t = t; }, setPlaybackRate() {}, getPlaybackRate: () => 1, getPlayerState: () => 2, getCurrentTime: () => window.__t, getDuration: () => 705, getVideoData: () => ({ title: "A pasted talk" }), getIframe: () => null };
      setTimeout(() => { try { o && o.events && o.events.onReady && o.events.onReady({ target: me }); } catch (e) {} }, 300); return me; };
    window.YT = { Player: P, PlayerState: { PLAYING: 1, PAUSED: 2, BUFFERING: 3, ENDED: 0 } };
  }, [seedCaps || null]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html?st=" + Date.now() + "#shadow"); await sleep(2500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  /* `ytai` — writing the words for a video that ships none — is the one free
     route that spends real money per call, so be-polish now requires a verified
     account for it. The client asks the same question first (ytaiNoAccount) so a
     signed-out learner is told to sign in instead of reading "no transcript for
     this video" about a video that is fine. This suite is about WINDOWING and
     CACHING, so its learner is signed in; the signed-out contract is check 14. */
  if (mode !== "anon") await p.evaluate(() => { FBUser = { uid: "u-transcript", getIdToken: async () => "tok-u-transcript" }; _fbAuthSeen = true; });
  return { ctx, p, errs, asks };
}
const panel = p => p.evaluate(() => { const box = document.getElementById("shV2"), sk = box ? box.querySelectorAll(".sv-sk i").length : 0;
  const segs = (typeof svAsset !== "undefined" && svAsset && svAsset.segments) || [];
  return { wait: !!(box && box.querySelector(".sv-wait")), sk, lines: segs.length, last: segs.length ? Math.round(segs[segs.length - 1].startMs / 1000) : null, cap: (document.getElementById("shWork") || {}).dataset ? document.getElementById("shWork").dataset.cap || null : null }; });

console.log("\n# the Worker with windows");
{
  const { ctx, p, errs, asks } = await learner("win");
  const t0 = Date.now();
  await p.evaluate(v => { shLoad({ vid: v, start: 0, end: 0, title: "" }); }, VID); await sleep(500);
  const w = await panel(p);
  ok("1 · while the words are on their way: the message and faint lines fill the reading area (no empty screen)", w.wait && w.sk >= 6 && w.cap === "wait", JSON.stringify(w));
  let first = null; for (let i = 0; i < 40; i++) { const s = await panel(p); if (s.lines) { first = { ...s, ms: Date.now() - t0 }; break; } await sleep(100); }
  ok("2 · the first 30 seconds are on screen as soon as its answer lands (~1.5 s here), before the rest is in", first && first.lines >= 3 && first.last < 30 && first.ms < 3500 && !first.wait, JSON.stringify({ first, asks }));
  ok("3 · the first request asked for the opening 30 seconds only", asks[0] && asks[0].from === 0 && asks[0].to === 30, JSON.stringify(asks));
  await sleep(4200);
  const mid = await panel(p);
  ok("4 · the rest comes in five-minute windows, two at a time, and each shows as it lands (the talk grows to ~10½ minutes while the last window is still out)", asks.length === 4 && JSON.stringify(asks.slice(1, 3).map(a => [a.from, a.to])) === "[[30,330],[330,630]]" && Math.abs(asks[1].at - asks[2].at) < 400 && mid.last >= 610 && mid.last < 630, JSON.stringify({ asks: asks.map(a => [a.from, a.to]), mid }));
  await sleep(4500);
  const more = await panel(p);
  const all = asks.map(a => [a.from, a.to]);
  ok("5 · every window asked once, up to the video's end, and never the whole video in one go", JSON.stringify(all) === "[[0,30],[30,330],[330,630],[630,710]]", JSON.stringify(all));
  ok("6 · once everything is in, the whole talk is on screen (last line ~700 s)", more.lines >= 65 && more.last >= 690, JSON.stringify(more));
  const kept = await p.evaluate(v => { const r = JSON.parse(localStorage.getItem("be_caps") || "{}")[v]; return r && { full: r.full, n: r.cues.length, win: r.win }; }, VID);
  ok("7 · the whole transcript is kept on the phone, marked complete", kept && kept.full === true && kept.n >= 70 && kept.win === true, JSON.stringify(kept));
  const n = asks.length;
  await p.evaluate(() => { delete _capCache["pAsTeD00001"]; }); await p.evaluate(v => shLoad({ vid: v, start: 0, end: 0, title: "" }, true), VID); await sleep(1500);
  const again = await panel(p);
  ok("8 · opened again: every line at once, no request", asks.length === n && again.lines >= 65 && !again.wait, JSON.stringify({ asks: asks.length - n, again }));
  ok("9 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
console.log("\n# the Worker as deployed today (no windows): no double transcription");
{
  const { ctx, p, errs, asks } = await learner("whole");
  await p.evaluate(v => { shLoad({ vid: v, start: 0, end: 0, title: "" }); }, VID); await sleep(9000);
  const s = await panel(p);
  const kept = await p.evaluate(v => { const r = JSON.parse(localStorage.getItem("be_caps") || "{}")[v]; return r && { full: r.full, n: r.cues.length }; }, VID);
  ok("10 · a Worker that ignores the window returns the whole video once — kept as complete, never asked again", asks.length === 1 && s.lines >= 65 && kept && kept.full === true, JSON.stringify({ asks, s, kept }));
  ok("11 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
console.log("\n# a copy kept before this change");
{
  const old = JSON.stringify({ [VID]: { ts: Date.now(), full: false, source: "gemini", lang: "en", cues: cuesFor(0, DUR) } });
  const { ctx, p, errs, asks } = await learner("win", old);
  await p.evaluate(v => { shLoad({ vid: v, start: 0, end: 0, title: "" }); }, VID); await sleep(6000);
  const s = await panel(p);
  const kept = await p.evaluate(v => JSON.parse(localStorage.getItem("be_caps"))[v].full, VID);
  ok("12 · a whole transcript kept by the older app (flagged incomplete) opens at once and is not transcribed again", asks.length === 0 && s.lines >= 65 && kept === true, JSON.stringify({ asks, s, kept }));
  ok("13 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
/* ---- 14: the account contract on this surface ----
   Signed out, the words for a video that ships none are not fetched at all:
   the route costs real money per call and be-polish answers 401 without an
   account, so firing the request would mean reporting a refusal as a video
   with no transcript. */
{
  const { ctx, p, errs, asks } = await learner("anon");
  await p.evaluate(async v => { go("shadow"); await shLoad({ vid: v, start: 0, end: 0, title: "probe" }, true); }, VID);
  await sleep(2500);
  const st = await p.evaluate(() => ({ noAcct: ytaiNoAccount(), why: svNoCapWhy(), title: svNoCapTitle(), body: svNoCapBody() }));
  ok("14 · signed out: NOT ONE ytai request is fired", asks.length === 0, JSON.stringify(asks));
  ok("14b · …the reason recorded is the account, not a missing transcript", st.noAcct === true && st.why === "auth_required", JSON.stringify(st));
  ok("14c · …and the card asks for a free account and says the video itself is fine",
    /sign in/i.test(st.title || "") && /free account/i.test(st.body || "") && /video itself is fine/i.test(st.body || ""), JSON.stringify(st));
  ok("14d · …and nothing mentions Premium — this is not a paywall", !/premium/i.test((st.title || "") + " " + (st.body || "")), JSON.stringify(st));
  ok("14e · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
