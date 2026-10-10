/* Two fixes from the first Android device test (10 Oct 2026).
   Run: cd tests && node shadow-android.mjs   (PORT=nnnn)
   1. Shadow recording in the Android shell: the WebView has no live speech
      recognition, so the saved take is transcribed by Whisper (as every other recorder does).
   2. Challenge holds the player to its paragraph, whatever starts playback. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8805), BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const own = !process.env.BASE;
const srv = own ? spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }) : null;
if (own) await sleep(800);
{ /* another session's server on this port would certify someone else's tree */
  const disk = readFileSync(root + "index.html", "utf8");
  let served = ""; try { served = await (await fetch(BASE + "index.html")).text(); } catch (e) {}
  if (!served) { console.error(`\nNothing is answering at ${BASE}.\n`); if (srv) srv.kill(); process.exit(1); }
  if (served.length !== disk.length) { console.error(`\n${BASE} is serving a DIFFERENT index.html. Run with PORT=<a free port>.\n`); if (srv) srv.kill(); process.exit(1); }
}
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await chromium.launch();
const seed = JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: Date.now() });
async function open(android) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(s => localStorage.setItem("be12_v1", s), seed);
  if (android) await ctx.addInitScript(() => { const a = (window.Capacitor = window.Capacitor || {}); a.getPlatform = () => "android"; a.isNativePlatform = () => true; a.Plugins = a.Plugins || {}; });
  await ctx.route(u => /be-push|be-partner|be-polish|be-events|be-entitlements|gstatic\.com\/firebasejs|ytimg|youtube|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1400);
  return { ctx, p, errs };
}

console.log("\n# Shadow on Android: the saved take is transcribed (no live engine in the WebView)");
{
  const { p, ctx, errs } = await open(true);
  const r = await p.evaluate(async () => {
    window.SpeechRecognition = function () { throw new Error("a live engine must not be started in the Android shell"); };
    let sent = null; fbTranscribe = async blob => { sent = blob.size; return "When there is no clear way"; };
    fbRecStart({ vid: "vidA", targetId: "noSuchEl", heardId: "noSuchEl", recCtx: "shadow-test-ctx" });
    const noEngine = shFB.rec === null && shFB.recCtx === "shadow-test-ctx";
    await addRec("shadow-test-ctx", "t", new Blob([new Uint8Array(6000)], { type: "audio/webm" }));
    try { await shFBDone(); } catch (e) {}
    return { noEngine, sent, heard: S.notes["shheard:vidA"] };
  });
  ok("1 · no live recognition is started in the Android shell, but the take's context is kept", r.noEngine, JSON.stringify(r));
  ok("2 · the SAVED take goes to Whisper and its words become the shadowing transcript", r.sent >= 6000 && r.heard === "When there is no clear way", JSON.stringify(r));
  const m = await p.evaluate(async () => {
    let got = null; fbTranscribe = async () => "mission words";
    fbRecStart({ vid: "vidB", recCtx: "mission-ctx", onDone: h => { got = h; } });
    await addRec("mission-ctx", "t", new Blob([new Uint8Array(6000)], { type: "audio/webm" }));
    await shFBDone(); return got;
  });
  ok("3 · a mission using the same recorder gets the Whisper words too", m === "mission words", String(m));
  const e = await p.evaluate(async () => {
    fbTranscribe = async () => ""; let msg = ""; const t0 = window.toast; window.toast = x => { msg = String(x); };
    fbRecStart({ vid: "vidC", recCtx: "empty-ctx" });
    await addRec("empty-ctx", "t", new Blob([new Uint8Array(6000)], { type: "audio/webm" }));
    await shFBDone(); window.toast = t0; return { msg, heard: S.notes["shheard:vidC"] || null };
  });
  ok("4 · a take with nothing in it still says so, and stores no transcript", !e.heard && e.msg.length > 0, JSON.stringify(e));
  ok("5 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# Challenge holds the player to its paragraph");
{
  const { p, ctx, errs } = await open(false);
  const r = await p.evaluate(() => {
    const seg = (i, a, z) => ({ id: "s" + i, text: "Line " + i + " has words in it.", startMs: a, endMs: z });
    svAsset = { segments: [seg(0, 0, 4000), seg(1, 4000, 8000), seg(2, 8000, 12000), seg(3, 12000, 16000), seg(4, 16000, 20000), seg(5, 20000, 24000)] };
    const ps = svParas(svAsset), target = ps[1];
    svMode = "challenge"; svRepeat = null; svChPara = target.from;
    const g = svChSegObj();
    let now = 0; const log = [];
    ytPlayer = { getCurrentTime: () => now, seekTo: t => { log.push(["seek", t]); now = t; }, pauseVideo: () => log.push(["pause"]), playVideo() {}, getPlayerState: () => 1 };
    const at = ms => { now = ms / 1000; shSeek = { t: now, at: 0 }; log.length = 0; svTick(); return log.slice(); };   // as if the last seek were long ago
    const before = at(Math.max(0, g.startMs - 5000));
    const inside = at(g.startMs + 500);
    const after = at(g.endMs + 1000);
    svMode = "watch"; const watch = at(g.endMs + 1000);
    return { g: [g.startMs, g.endMs], before, inside, after, watch };
  });
  ok("6 · playing from before the paragraph jumps to its start", r.before.some(x => x[0] === "seek" && Math.abs(x[1] - r.g[0] / 1000) < 0.01), JSON.stringify(r));
  ok("7 · inside the paragraph the video plays untouched", r.inside.length === 0, JSON.stringify(r.inside));
  ok("8 · past its end the video pauses and rewinds to the paragraph's start", r.after.some(x => x[0] === "pause") && r.after.some(x => x[0] === "seek" && Math.abs(x[1] - r.g[0] / 1000) < 0.01), JSON.stringify(r.after));
  ok("9 · outside Challenge (Watch) the video is never held", !r.watch.some(x => x[0] === "pause"), JSON.stringify(r.watch));
  ok("10 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
