/* Animated scenes: the sound loads on Safari's engine and survives a dropped media
   element (owner, 6 Oct 2026 — an iPhone showed "The scene's sound could not load").
   Runs in WebKit, the engine of the iOS app. Run: cd tests && node scene-audio.mjs */
import { webkit } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8787);
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 400)}`); };
const b = await webkit.launch();
async function page(block) {
  const p = await b.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  if (block) await p.route(u => /blob:/.test(u.href), r => r.abort());
  await p.goto(`http://127.0.0.1:${PORT}/robots.txt`);   /* a page at the site root, so scenes/ resolves as in the app */
  await p.addScriptTag({ url: `http://127.0.0.1:${PORT}/shadow-scenes.js?v=t${Date.now()}` });
  return { p, errs };
}
const play = (p, opts = {}) => p.evaluate(async (opts) => {
  document.body.innerHTML = '<div id="st"></div>';
  const out = { errors: 0, ready: false };
  if (opts.breakBlob) { const o = URL.createObjectURL; URL.createObjectURL = () => "blob:" + location.origin + "/nope"; }
  const pl = new ShadowScenes.ScenePlayer("st", { videoId: "scene.coworker-intro", events: { onReady: () => { out.ready = true; }, onError: () => { out.errors++; } } });
  for (let i = 0; i < 60 && !out.ready && !out.errors; i++) await new Promise(r => setTimeout(r, 100));
  out.dur = pl.getDuration();
  if (opts.drop && out.ready) {               /* iOS drops the element: one error on the scene's own file */
    pl._a.dispatchEvent(new Event("error")); await new Promise(r => setTimeout(r, 1500));
    out.afterDrop = { errors: out.errors, dur: pl.getDuration() };
    pl._a.dispatchEvent(new Event("error")); await new Promise(r => setTimeout(r, 1500));
    out.secondDrop = { errors: out.errors, dur: pl.getDuration() };
    /* now the reload itself cannot work: the in-memory copy is gone and there is no file fallback */
    URL.revokeObjectURL(pl._url); pl._direct = null;
    pl._a.dispatchEvent(new Event("error")); await new Promise(r => setTimeout(r, 2000));
    out.deadReload = { errors: out.errors };
  }
  pl.destroy(); return out;
}, opts);
{ const { p, errs } = await page(); const r = await play(p);
  ok("1 · WebKit: the scene's sound loads (duration known), no error raised", r.ready && r.errors === 0 && r.dur > 50, JSON.stringify(r));
  ok("2 · no JavaScript errors", errs.length === 0, errs.join(" | ")); await p.close(); }
{ const { p } = await page(); const r = await play(p, { breakBlob: true });
  ok("3 · if the in-memory copy cannot be played, the file is read directly — still no error", r.ready && r.errors === 0 && r.dur > 50, JSON.stringify(r)); await p.close(); }
{ const { p } = await page(); const r = await play(p, { drop: true });
  ok("4 · a dropped media element is reloaded once, silently — no message", r.afterDrop && r.afterDrop.errors === 0 && r.afterDrop.dur > 50, JSON.stringify(r));
  ok("5 · …a later drop recovers the same way", r.secondDrop && r.secondDrop.errors === 0 && r.secondDrop.dur > 50, JSON.stringify(r));
  ok("5b · …and when the reload itself fails, the learner is told (once)", r.deadReload && r.deadReload.errors === 1, JSON.stringify(r)); await p.close(); }
{ const ok6 = await (async () => { const s = await (await fetch(`http://127.0.0.1:${PORT}/shadow-scenes.js`)).text(); const m = s.match(/const SILENT = "data:audio\/wav;base64,([^"]+)"/); if (!m) return false; const buf = Buffer.from(m[1], "base64"); return buf.readUInt32LE(40) > 0; })();
  ok("6 · the iOS audio primer is a real silent clip (its data chunk is not empty)", ok6); }
await b.close(); srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
