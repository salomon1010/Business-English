/* Where the app lands with Home V2 on (owner, 27 Sep 2026): finishing onboarding lands on Home, and
   coming back after two hours (or on a new day) lands on Home — from a cold launch and from the app
   picked up again in the background. A notification's own link is kept. Without Home V2 (Welding,
   production today) the road map rules are unchanged.
   Run: cd tests && node home-landing.mjs        (BASE=… for another tree, BROWSER=chromium for Chromium)
   WebKit (iPhone Safari's engine), iPhone 13; the Workers are stood in. */
import { webkit, chromium, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8158);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const ENGINE = process.env.BROWSER === "chromium" ? chromium : webkit; console.log(`  engine: ${process.env.BROWSER || "webkit"} · ${BASE}`);
const b = await ENGINE.launch();
const H = 3600e3, DAY = 864e5, yday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
const placed = { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } };
const seed = (o = {}) => ({ profile: { name: "Tester", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english", tradeId: "welder" }, fnd: placed, days: {}, dates: [yday], dayLog: { [yday]: 1 }, dayLogA: { "general-english": { [yday]: 1 } }, steps: {}, scores: {}, notes: {}, vocab: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now(), ...o });
/* state: null = a first-run device (no profile); view: the page sessionStorage remembers from last time */
async function open(state, opts = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|be-mail|youtube\.com|gstatic/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(([s, flags, view]) => { if (sessionStorage.getItem("s")) return; sessionStorage.setItem("s", 1);
    if (s) localStorage.setItem("be12_v1", s); if (flags) localStorage.setItem("be_flags", flags); if (view) sessionStorage.setItem("be_view", view); },
    [state ? JSON.stringify(seed(state)) : null, JSON.stringify({ home_v2_enabled: !opts.flagOff })   /* explicit both ways: the staging host turns Home V2 on by default */, opts.view || null]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => { if (!/network error/i.test(e.message)) errs.push(e.message); });
  await p.goto(BASE + "/index.html" + (opts.url || "")); await sleep(2500);
  return { ctx, p, errs };
}
const where = p => p.evaluate(() => ({ v: cur.v, home: document.getElementById("v-home").classList.contains("on"), hx: !!document.querySelector("#v-home .hx"), hash: location.hash }));
/* finish onboarding the way the wizard does after the track step */
const onboard = (p, track) => p.evaluate(async tr => {
  OB.name = "Awa"; OB.track = tr;
  if (tr === "welding") { S.professionalTracks = { activeId: "welding" }; ProfessionalTrackContext.setActive("welding"); OB.trade = "welder"; }
  else { S.professionalTracks = { activeId: "general-english" }; ProfessionalTrackContext.setActive("general-english"); }
  obFinish(); await new Promise(r => setTimeout(r, 600));
  return { v: cur.v, home: document.getElementById("v-home").classList.contains("on"), hx: !!document.querySelector("#v-home .hx"), welcome: !!document.getElementById("wcOv"), check: !!document.getElementById("fndCheckOv") };
}, track);

console.log("\n# onboarding");
{ const { ctx, p, errs } = await open(null);
  ok("1 · a first run shows the onboarding wizard", await p.evaluate(() => !!document.getElementById("obWrap")));
  const r = await onboard(p, "general-english");
  ok("2 · finishing onboarding (General English) lands on Home V2, with the welcome card over it and no second dialog", r.v === "home" && r.home && r.hx && r.welcome && !r.check, JSON.stringify(r));
  await p.evaluate(() => wcClose()); await sleep(600);
  const after = await where(p);
  ok("3 · closing the welcome leaves the learner on Home, on its first card", after.v === "home" && after.hx && await p.evaluate(() => !document.querySelector(".wc-ov,#fndCheckOv")), JSON.stringify(after));
  ok("4 · … and a refresh straight after stays on Home", await (async () => { await p.reload(); await sleep(2500); return (await where(p)).v === "home"; })());
  ok("5 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p } = await open(null);
  const r = await onboard(p, "welding");
  ok("6 · Welding (no Home V2) still lands on the road map, unchanged", r.v === "journey" && r.welcome, JSON.stringify(r)); await ctx.close(); }
{ const { ctx, p } = await open(null, { flagOff: true });
  const r = await onboard(p, "general-english");
  ok("7 · home_v2_enabled off (production today): onboarding still lands on the road map", r.v === "journey", JSON.stringify(r)); await ctx.close(); }

console.log("\n# coming back after two hours — cold launch");
{ const { ctx, p, errs } = await open({ lastSeen: Date.now() - 3 * H }, { view: "shadow" });
  const w = await where(p);
  ok("8 · last on Shadow, back three hours later: lands on Home V2, not Shadow and not the road map", w.v === "home" && w.hx, JSON.stringify(w));
  ok("9 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p } = await open({ lastSeen: Date.now() - 3 * H }, { url: "#phrases" });
  const w = await where(p);
  ok("10 · a stale page in the address bar (#phrases) three hours later: Home", w.v === "home" && w.hx, JSON.stringify(w)); await ctx.close(); }
{ const { ctx, p } = await open({ lastSeen: Date.now() - 20 * 60e3 }, { view: "shadow" });
  ok("11 · back after twenty minutes: the same page as before (the refresh rule is kept)", (await where(p)).v === "shadow", JSON.stringify(await where(p))); await ctx.close(); }
{ const { ctx, p } = await open({ lastSeen: Date.now() - 3 * H }, { url: "#partner" });
  ok("12 · a partner notification's link (#partner) is kept after a gap", (await where(p)).v === "partner", JSON.stringify(await where(p))); await ctx.close(); }
{ const { ctx, p } = await open({ lastSeen: Date.now() - 3 * H }, { url: "#journey" });
  ok("13 · the daily reminder's link (#journey) is kept after a gap", (await where(p)).v === "journey", JSON.stringify(await where(p))); await ctx.close(); }
{ const { ctx, p } = await open({ lastSeen: Date.now() - 3 * H }, { flagOff: true });
  ok("14 · home_v2_enabled off: a plain launch after a gap still lands on the road map, unchanged", (await where(p)).v === "journey", JSON.stringify(await where(p))); await ctx.close(); }

console.log("\n# coming back after two hours — the app picked up again from the background");
{ const { ctx, p, errs } = await open({});
  await p.evaluate(() => go("shadow")); await sleep(800);
  const back = async ms => p.evaluate(async ms => { _hiddenAt = Date.now() - ms;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange"));
    await new Promise(r => setTimeout(r, 800)); return cur.v; }, ms);
  ok("15 · resumed after twenty minutes: stays on Shadow", (await back(20 * 60e3)) === "shadow");
  const v = await back(3 * H);
  ok("16 · resumed after three hours: Home V2", v === "home" && (await where(p)).hx, v);
  await p.evaluate(() => go("phrases")); await sleep(500);
  ok("17 · resumed after three hours in the middle of a 25-minute timer: left where it is", await p.evaluate(async () => { timer.run = true; _hiddenAt = Date.now() - 3 * 3600e3; document.dispatchEvent(new Event("visibilitychange")); await new Promise(r => setTimeout(r, 500)); const v = cur.v; timer.run = false; return v === "phrases"; }));
  ok("18 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

await b.close(); if (srv) srv.kill();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean) ? 0 : 1);
