/* BE Mastery — PHASE 3 VOICE + AI STATES gate (docs/DESIGN_SYSTEM_BEMASTERY.md §13).

   Run:  cd tests && node ds-phase3.mjs

   One shared voice interface for every recorder, one AI state for every
   analysis wait, both tracks. In real Chromium with a real tone through the
   fake microphone:
   1. VOICE — ANY getUserMedia audio stream drives --lvl (the wrapper hands it
      to DS.voice); the level varies with the sound and clears when the
      stream's tracks end; two streams share ONE AudioContext, closed when the
      last one ends; video-only streams are ignored.
   2. RECORDERS — the Session recorder (shared recToggle) and the Phrase Lab
      recorder (its own getUserMedia) both light the ring in the theme's
      listening colour, on both tracks; the Session take is still saved and
      playable (the stream is returned untouched).
   3. AI STATES — the waits render the shared component: Say it grading →
      DS.aiInline; the simulation / professional-conversation mic in
      "sim-active" (colleague preparing / speaking) breathes in the theme's
      AI colour (Signal violet, Forge amber-white).
   4. REDUCED MOTION — AI dot, sim-active breathing and the ring transition off.
   5. No page errors. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
let BASE = process.env.BASE, server = null;
const root = new URL("..", import.meta.url).pathname;
if (!BASE) {
  const mine = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const port of [8931, 8932, 8933, 8934]) {
    const s = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
    await sleep(700);
    let served = null; try { served = await (await fetch(`http://127.0.0.1:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://127.0.0.1:${port}`; break; }
    s.kill();
  }
  if (!BASE) { console.error("no free port serving this tree"); process.exit(1); }
}
const tone = join(mkdtempSync(join(tmpdir(), "ds3-")), "tone.wav");
{ const sr = 48000, n = sr * 8, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / sr) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.5 * i / sr))), 44 + i * 2);
  writeFileSync(tone, b); }
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-audio-capture=" + tone] });
const errors = [];
async function open(track, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone", "camera"], serviceWorkers: "block", reducedMotion: o.reduced ? "reduce" : "no-preference" });
  await ctx.addInitScript(tr => localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Awa", lang: "en", ts: 1 }, professionalTracks: { activeId: tr },
    fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
    days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 })), track);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const p = await ctx.newPage(); p.on("pageerror", e => errors.push(`${track}: ${e.message}`));
  await p.goto(BASE + "/index.html?ds3=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p };
}
const lvlSamples = async (p, n = 8) => { const a = []; for (let i = 0; i < n; i++) { a.push(+(await p.evaluate(() => document.documentElement.style.getPropertyValue("--lvl") || "0"))); await sleep(120); } return a; };
const rgb = hex => { const h = hex.replace("#", ""); return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`; };

for (const track of ["general-english", "welding"]) {
  const tag = track === "welding" ? "Forge / Welding" : "Signal / General English";
  console.log(`\n${tag}`);
  /* 1 · the interface itself, on any stream */
  const { ctx, p } = await open(track);
  const iface = await p.evaluate(async () => {
    const wrapped = !!navigator.mediaDevices.__dsVoice;
    const a = await navigator.mediaDevices.getUserMedia({ audio: true });
    const b = await navigator.mediaDevices.getUserMedia({ audio: true });
    await new Promise(r => setTimeout(r, 900));
    const shared = DS.voice._n.size === 2 && !!DS.voice._ctx;
    const during = +(document.documentElement.style.getPropertyValue("--lvl") || 0);
    a.getTracks().forEach(t => t.stop());
    await new Promise(r => setTimeout(r, 300));
    const oneLeft = DS.voice._n.size === 1 && !!DS.voice._ctx;
    b.getTracks().forEach(t => t.stop());
    await new Promise(r => setTimeout(r, 400));
    const cleared = DS.voice._n.size === 0 && DS.voice._ctx === null && !document.documentElement.style.getPropertyValue("--lvl");
    let video = "skipped"; try { const v = await navigator.mediaDevices.getUserMedia({ video: true }); video = DS.voice._n.size === 0 ? "ignored" : "WATCHED"; v.getTracks().forEach(t => t.stop()); } catch (e) {}
    return { wrapped, shared, during, oneLeft, cleared, video };
  });
  ok(`${tag}: any getUserMedia audio stream drives the level; two streams share one AudioContext; it clears and closes when the tracks end; video is ignored`,
    iface.wrapped && iface.shared && iface.during > .1 && iface.oneLeft && iface.cleared && iface.video !== "WATCHED", JSON.stringify(iface));

  /* 2 · real recorders: Session (recToggle) and Phrase Lab (its own getUserMedia) */
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(600);
  const rb = await p.$("#recBtn"); await rb.scrollIntoViewIfNeeded(); await rb.click(); await sleep(1300);
  const sl = await lvlSamples(p);
  const sring = await p.evaluate(() => getComputedStyle(document.querySelector(".rec-btn.recording")).outlineColor);
  await rb.click(); await sleep(1200);
  const saved = await p.evaluate(async () => { const r = (await getRecs(dayKey(1, "Mon")))[0]; if (!r || !r.blob) return { size: 0 }; const a = new Audio(URL.createObjectURL(r.blob)); const plays = await new Promise(res => { a.onloadedmetadata = () => res(true); a.onerror = () => res(false); setTimeout(() => res(false), 4000); }); return { size: r.blob.size, plays, lvl: document.documentElement.style.getPropertyValue("--lvl") || "unset" }; });
  const live = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--live-rgb").trim());
  ok(`${tag}: Session recorder — ring in the listening colour follows the voice (${Math.min(...sl).toFixed(2)}–${Math.max(...sl).toFixed(2)}); the take is saved and plays; level clears on stop`,
    Math.max(...sl) > .2 && Math.max(...sl) - Math.min(...sl) > .05 && sring.replace(/\s/g, "").includes(live.replace(/\s/g, "")) && saved.size > 1000 && saved.plays && saved.lvl === "unset", JSON.stringify({ sl, sring, live, saved }));
  await p.evaluate(() => go("phrases")); await sleep(700);
  const hasEx = await p.evaluate(() => !!document.getElementById("exRecBtn"));
  if (hasEx) {
    await p.evaluate(() => exRecord()); await sleep(1500);
    const el = await lvlSamples(p);
    const ex = await p.evaluate(() => { const b = document.getElementById("exRecBtn"); return { live: b.classList.contains("is-live"), ring: getComputedStyle(b).outlineColor, w: getComputedStyle(b).outlineWidth }; });
    await p.evaluate(() => exRecord()); await sleep(1500);
    const after = await p.evaluate(() => ({ live: document.getElementById("exRecBtn") && document.getElementById("exRecBtn").classList.contains("is-live"), lvl: document.documentElement.style.getPropertyValue("--lvl") || "unset" }));
    ok(`${tag}: Phrase Lab recorder (its own getUserMedia) — the same ring follows the voice (${Math.min(...el).toFixed(2)}–${Math.max(...el).toFixed(2)}) and clears when it stops`,
      ex.live && Math.max(...el) > .2 && ex.ring.replace(/\s/g, "").includes(live.replace(/\s/g, "")) && !after.live && after.lvl === "unset", JSON.stringify({ el, ex, after }));
  } else ok(`${tag}: Phrase Lab recorder present`, false, "no #exRecBtn");

  /* 3 · AI states */
  const ai = await p.evaluate(() => {
    const grading = ppRevResultHTML("x", "k", { state: "grading" }, null);
    const wrap = document.createElement("div"); wrap.className = "rp-work sim-work"; wrap.innerHTML = '<button id="simMic" class="rp-mic sim-active">m</button>'; document.body.appendChild(wrap);
    const cs = getComputedStyle(document.getElementById("simMic"));
    const r = { gradingIsShared: /class="ai-inline"/.test(grading) && /role="status"/.test(grading), anim: cs.animationName, shadow: cs.boxShadow, ai: getComputedStyle(document.documentElement).getPropertyValue("--ai").trim() };
    wrap.remove(); return r;
  });
  ok(`${tag}: waits use the shared AI state — Say it grading renders DS.aiInline (role=status); the colleague-preparing mic breathes in the theme's AI colour (${ai.ai})`,
    ai.gradingIsShared && ai.anim === "ds-ai-breathe" && /rgba?\(/.test(ai.shadow), JSON.stringify(ai));
  await ctx.close();

  /* 4 · reduced motion */
  const R = await open(track, { reduced: true });
  const rm = await R.p.evaluate(() => { const d = document.createElement("div"); d.className = "sim-work"; d.innerHTML = DS.aiInline("Listening…") + '<button id="simMic" class="rp-mic sim-active">m</button><button class="rec-btn recording">r</button>'; document.body.appendChild(d);
    return { dot: getComputedStyle(d.querySelector(".ai-dot")).animationName, sim: getComputedStyle(d.querySelector("#simMic")).animationName, ring: getComputedStyle(d.querySelector(".rec-btn")).transitionDuration }; });
  ok(`${tag}: reduced motion — AI dot, colleague-preparing breathing and the ring transition are off`, rm.dot === "none" && rm.sim === "none" && /^0s/.test(rm.ring), JSON.stringify(rm));
  await R.ctx.close();
}
ok("no page errors in any context", errors.length === 0, errors.slice(0, 4).join(" | "));
await browser.close();
if (server) server.kill();
const failed = res.filter(x => !x.pass);
console.log(`\n${res.length - failed.length}/${res.length} passed`);
process.exit(failed.length ? 1 : 0);
