/* BE Mastery — PHASE 1 DESIGN SYSTEM gate (docs/DESIGN_SYSTEM_BEMASTERY.md §11).

   Run:  cd tests && node ds-phase1.mjs

   One shared shell, two token themes (Signal = General English, Forge =
   Welding), two untouched learning systems. This proves, in real Chromium:
   1. THEMES follow the existing data-track attribute: Signal and Forge tokens
      resolve on the right track; the shell adds no track logic.
   2. ISOLATION: Welding has no V2 mission pack, no V2 state and no Practice
      Partner; V2 missions stay hidden unless localStorage.be_missions="1".
   3. LAYOUT at 375×812, 390×844, 430×932, 1280×800 on both tracks: no
      horizontal overflow on Home / road map / session / practice / shadow
      (+ simulation on Welding); the V2 mission's primary action is on screen
      and uncovered.
   4. VOICE: a real tone through the fake microphone drives --lvl and the
      mic ring in the theme's listening colour, on both tracks; the take is
      saved and playable (a non-empty blob in the recordings store).
   5. REDUCED MOTION: AI orb / edge / scan animations and button transitions
      are off on both tracks.
   6. KEYBOARD (emulated: 336px taken from the viewport): the focused field
      stays visible and uncovered; the mic is reachable after it closes.
   A real device is still the authority for iOS audio and keyboard; this is
   the automated floor. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

let BASE = process.env.BASE, server = null;
const root = new URL("..", import.meta.url).pathname;
if (!BASE) {
  const mine = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const port of [8951, 8952, 8953, 8954]) {
    const s = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
    await sleep(700);
    let served = null; try { served = await (await fetch(`http://127.0.0.1:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://127.0.0.1:${port}`; break; }
    s.kill();
  }
  if (!BASE) { console.error("no free port serving this tree"); process.exit(1); }
}
/* a 6-second 440 Hz tone that swells, so the fake microphone carries a real level */
const tone = join(mkdtempSync(join(tmpdir(), "ds1-")), "tone.wav");
{ const sr = 48000, n = sr * 6, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / sr) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.5 * i / sr))), 44 + i * 2);
  writeFileSync(tone, b); }
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-audio-capture=" + tone] });
const errors = [];
async function open(track, [w, h], opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 800, permissions: ["microphone"], serviceWorkers: "block", reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  await ctx.addInitScript(({ track, missions }) => {
    if (missions) localStorage.setItem("be_missions", "1");
    localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Awa", lang: "en", ts: 1 }, professionalTracks: { activeId: track },
      fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
      days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }));
  }, { track, missions: !!opts.missions });
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const p = await ctx.newPage(); p.on("pageerror", e => errors.push(track + " " + w + ": " + e.message));
  await p.goto(BASE + "/index.html?ds1=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p };
}
const tok = p => p.evaluate(() => { const c = getComputedStyle(document.documentElement); const g = k => c.getPropertyValue(k).trim(); return { track: document.documentElement.getAttribute("data-track"), bg: g("--bg"), live: g("--live"), ai: g("--ai"), onAccent: g("--on-accent") }; });

/* ── 1 · THEMES + 2 · ISOLATION ── */
console.log("\n1–2 · THEMES FOLLOW data-track · TRACK ISOLATION");
{
  let { ctx, p } = await open("general-english", [390, 844]);
  const ge = await tok(p);
  const geHidden = await p.evaluate(() => ({ on: missionsOn(), pack: mvPack() === null }));
  ok("Signal on General English: indigo depth, cyan listening, violet AI, white CTA label", ge.track !== "welding" && ge.bg === "#080b16" && ge.live === "#22d3ee" && ge.ai === "#a855f7" && ge.onAccent === "#fff", JSON.stringify(ge));
  ok("V2 missions stay hidden by default (missionsOn() false, no pack) — production state unchanged", geHidden.on === false && geHidden.pack === true, JSON.stringify(geHidden));
  await ctx.close();
  ({ ctx, p } = await open("welding", [390, 844], { missions: true }));
  const wd = await tok(p);
  const iso = await p.evaluate(() => ({ pack: mvPack() === null, v2: Object.keys((S.v2A || {}).welding || {}).length, pp: typeof ppAvailable === "function" ? ppAvailable() : false, prof: isProfessionalJourney() }));
  ok("Forge on Welding: steel depth, arc-blue listening, amber-white AI, Welding's own dark CTA label", wd.track === "welding" && wd.bg === "#090c14" && wd.live === "#7dd3fc" && wd.ai === "#f6c453" && wd.onAccent === "#1b1202", JSON.stringify(wd));
  ok("Welding gets no V2 pack (even with the missions switch on), no V2 state, no Practice Partner; still a professional journey", iso.pack && iso.v2 === 0 && iso.pp === false && iso.prof === true, JSON.stringify(iso));
  await ctx.close();
}

/* ── 3 · LAYOUT ── */
console.log("\n3 · LAYOUT at 375 / 390 / 430 / 1280");
for (const vp of [[375, 812], [390, 844], [430, 932], [1280, 800]]) {
  for (const track of ["general-english", "welding"]) {
    const { ctx, p } = await open(track, vp, { missions: true });
    const screens = ["go('home')", "go('journey')", "go('session',1,'Mon')", "go('practice')", "go('shadow')"].concat(track === "welding" ? ["go('simulation')"] : []);
    const over = [];
    for (const js of screens) { await p.evaluate(js); await sleep(450); if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) over.push(js); }
    let dock = "n/a";
    if (track === "general-english") {
      await p.evaluate(() => mvGo("explain-work-guided", "see")); await sleep(500);
      dock = await p.evaluate(() => { const b = document.querySelector("#v-mission .mv-dock .btn-primary"); if (!b) return false; const r = b.getBoundingClientRect(); const nav = document.querySelector(".bottom-nav"); const nt = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().top : innerHeight; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.top >= 0 && r.bottom <= nt + .5 && (b === t || b.contains(t)); });
    }
    ok(`${vp[0]}×${vp[1]} ${track}: no horizontal overflow on ${screens.length} screens${track === "general-english" ? "; mission primary action on screen and uncovered" : ""}`, !over.length && (dock === "n/a" || dock === true), JSON.stringify({ over, dock }));
    await ctx.close();
  }
}

/* ── 4 · VOICE: live level, ring colour, recording saved and playable ── */
console.log("\n4 · VOICE STATE + RECORDING / PLAYBACK (both tracks)");
for (const track of ["general-english", "welding"]) {
  const { ctx, p } = await open(track, [390, 844]);
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(600);
  const btn = await p.$("#recBtn"); await btn.scrollIntoViewIfNeeded(); await btn.click(); await sleep(1400);
  const live = []; for (let i = 0; i < 8; i++) { live.push(+(await p.evaluate(() => document.documentElement.style.getPropertyValue("--lvl") || "0"))); await sleep(120); }
  const ring = await p.evaluate(() => { const b = document.querySelector(".rec-btn.recording"); const cs = b && getComputedStyle(b); return cs ? { color: cs.outlineColor, width: cs.outlineWidth } : null; });
  await btn.click(); await sleep(1200);
  const saved = await p.evaluate(async () => { const recs = await getRecs(dayKey(1, "Mon")); const r = recs && recs[0]; if (!r || !r.blob) return { n: (recs || []).length, size: 0, plays: false };
    const url = URL.createObjectURL(r.blob); const a = new Audio(url); const plays = await new Promise(res => { a.onloadedmetadata = () => res(true); a.onerror = () => res(false); setTimeout(() => res(false), 4000); });
    return { n: recs.length, size: r.blob.size, type: r.blob.type, plays, after: document.documentElement.style.getPropertyValue("--lvl") || "unset" }; });
  const want = track === "welding" ? "125, 211, 252" : "34, 211, 238";
  ok(`${track}: the ring follows the live voice (level varies ${Math.min(...live).toFixed(2)}–${Math.max(...live).toFixed(2)}) in the theme's listening colour`, Math.max(...live) > 0.2 && Math.max(...live) - Math.min(...live) > 0.05 && ring && ring.color.includes(want), JSON.stringify({ live, ring }));
  ok(`${track}: the take is saved (non-empty blob) and loads for playback; the level stops when recording stops`, saved.n >= 1 && saved.size > 1000 && saved.plays && saved.after === "unset", JSON.stringify(saved));
  await ctx.close();
}

/* ── 5 · REDUCED MOTION ── */
console.log("\n5 · REDUCED MOTION");
for (const track of ["general-english", "welding"]) {
  const { ctx, p } = await open(track, [390, 844], { reduced: true });
  const rm = await p.evaluate(() => { const d = document.createElement("div"); d.innerHTML = mvThinkHTML(); document.body.appendChild(d);
    const a = s => getComputedStyle(d.querySelector(s)).animationName, e = getComputedStyle(d.querySelector(".ai-think"), "::before").animationName;
    const b = document.createElement("button"); b.className = "btn-primary"; document.body.appendChild(b);
    return { orb: a(".ai-orb"), scan: a(".ai-scan"), edge: e, btn: getComputedStyle(b).transitionDuration }; });
  ok(`${track}: reduced motion stops the AI orb, edge and scan, and button transitions`, rm.orb === "none" && rm.scan === "none" && rm.edge === "none" && /^0s/.test(rm.btn), JSON.stringify(rm));
  await ctx.close();
}

/* ── 6 · KEYBOARD (emulated) ── */
console.log("\n6 · KEYBOARD (emulated, 336px)");
for (const vp of [[390, 844], [375, 812]]) {
  for (const [track, js, sel] of [["welding", "go('session',1,'Mon')", "#sessScript"], ["welding", "go('session',1,'Mon')", "#noteBox"], ["general-english", "go('phrases')", "#exIn"], ["welding", "go('phrases')", "#exIn"]]) {
    const { ctx, p } = await open(track, vp);
    await p.evaluate(js); await sleep(600);
    const el = await p.$(sel);
    if (!el) { ok(`${vp[0]} ${track} ${sel}: field present`, false, "not on screen"); await ctx.close(); continue; }
    await el.evaluate(e => { const d = e.closest("details"); if (d) d.open = true; e.scrollIntoView({ block: "center", behavior: "instant" }); }); await el.focus();
    await p.setViewportSize({ width: vp[0], height: vp[1] - 336 }); await sleep(400); await el.evaluate(e => e.scrollIntoView({ block: "center", behavior: "instant" })); await sleep(300);
    const r = await p.evaluate(s => { const e = document.querySelector(s), rc = e.getBoundingClientRect(), vh = innerHeight, cy = Math.max(rc.top + 8, Math.min(rc.bottom - 8, vh / 2)), t = document.elementFromPoint(rc.left + rc.width / 2, cy); return { visible: rc.top < vh && rc.bottom > 0, focused: document.activeElement === e, uncovered: e === t || e.contains(t), overflow: document.documentElement.scrollWidth > innerWidth + 1 }; }, sel);
    await p.setViewportSize({ width: vp[0], height: vp[1] }); await sleep(300);
    const mic = await p.evaluate(() => { const b = document.getElementById("recBtn"); if (!b) return "no mic here"; b.scrollIntoView({ block: "center", behavior: "instant" }); return new Promise(res => setTimeout(() => { const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); res(b === t || b.contains(t) ? "reachable" : "covered"); }, 500)); });
    ok(`${vp[0]}×${vp[1]} ${track} ${sel}: visible, focused and uncovered with the keyboard open; mic ${mic} after it closes`, r.visible && r.focused && r.uncovered && !r.overflow && mic !== "covered", JSON.stringify({ r, mic }));
    await ctx.close();
  }
}

ok("no page errors in any context", errors.length === 0, errors.join(" | "));
await browser.close();
if (server) server.kill();
const failed = res.filter(x => !x.pass);
console.log(`\n${res.length - failed.length}/${res.length} passed`);
process.exit(failed.length ? 1 : 0);
