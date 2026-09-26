/* BE Mastery — PHASE 2 SHARED COMPONENTS gate (docs/DESIGN_SYSTEM_BEMASTERY.md §12).

   Run:  cd tests && node ds-phase2.mjs

   One implementation per component, themed by tokens (Signal = General
   English, Forge = Welding). In real Chromium, for BOTH tracks:
   1. every shared component renders from the one DS helper / shared class and
      takes the theme's colours (never a track selector): AI working, the five
      states (empty · loading · error · warning · success), skeleton,
      progress, coaching entry, voice meter, buttons (primary · secondary ·
      outline · disabled), fold, recording control, active navigation, toast;
   2. roles for assistive tech (alert / status / progressbar with value);
   3. the confirm dialog is a bottom sheet on a phone and centred on desktop,
      inside the viewport, and still closes through its own buttons;
   4. keyboard: Tab shows the shared focus ring in the theme's focus colour;
   5. recording: the Session recorder's shared meter appears and moves with a
      real tone, on both tracks; it is hidden when idle;
   6. 375 / 390 / 430 / 1280 × dark + light: no horizontal overflow on the
      real screens (Home, road map, session, practice, shadow, + simulation
      on Welding) with the gallery on the page;
   7. reduced motion stops skeleton, AI and progress motion;
   8. switching track with the app's own selectProfessionalTrack() swaps the
      theme and nothing else: V2 pack, Practice Partner and the professional
      journey follow the existing gates exactly as before. */
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
  for (const port of [8941, 8942, 8943, 8944]) {
    const s = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
    await sleep(700);
    let served = null; try { served = await (await fetch(`http://127.0.0.1:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://127.0.0.1:${port}`; break; }
    s.kill();
  }
  if (!BASE) { console.error("no free port serving this tree"); process.exit(1); }
}
const tone = join(mkdtempSync(join(tmpdir(), "ds2-")), "tone.wav");
{ const sr = 48000, n = sr * 6, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / sr) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.5 * i / sr))), 44 + i * 2);
  writeFileSync(tone, b); }
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-audio-capture=" + tone] });
const errors = [];
async function open(track, [w, h], o = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 800, permissions: ["microphone"], serviceWorkers: "block", reducedMotion: o.reduced ? "reduce" : "no-preference" });
  await ctx.addInitScript(({ track, theme }) => {
    localStorage.setItem("be_theme", theme);
    localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Awa", lang: "en", ts: 1 }, professionalTracks: { activeId: track },
      fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
      days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }));
  }, { track, theme: o.theme || "dark" });
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const p = await ctx.newPage(); p.on("pageerror", e => errors.push(`${track} ${w} ${o.theme || "dark"}: ${e.message}`));
  await p.goto(BASE + "/index.html?ds2=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p };
}
/* the gallery: every shared component, rendered by the same helpers the app uses */
const gallery = p => p.evaluate(() => {
  const v = document.querySelector(".view.on"); const d = document.createElement("section"); d.id = "__ds2"; d.className = "card";
  d.innerHTML = DS.ai("Reading your answer…", "Checking the moves") + DS.state("empty", { title: "Nothing yet", body: "Your first answer appears here." })
    + DS.state("loading", { body: "Loading your report" }) + DS.state("error", { title: "The coach is unreachable", body: "Your answer is saved.", action: { label: "Try again", onclick: "void 0" } })
    + DS.state("warning", { body: "Offline — coaching will follow." }) + DS.state("success", { title: "Saved", body: "Week 1 · Mon is complete" })
    + DS.skel(3) + DS.progress(.62, "Stage progress") + DS.entry({ title: "Your speaking report", sub: "Previous attempts", icon: "chart", onclick: "void 0" })
    + `<div id="__rec" style="display:flex;align-items:center;gap:12px"><button class="rec-btn" aria-label="Record">${ic("mic")}</button><div>00:00</div>${DS.meter()}</div>`
    + `<p><button class="btn-primary" id="__p">Primary</button> <button class="btn btn-g" id="__s">Secondary</button> <button class="btn btn-outline" id="__o">Outline</button> <button class="btn btn-g" id="__d" disabled>Disabled</button></p>`
    + `<details class="mv-fold" id="__f"><summary>Detailed analysis</summary><div class="mv-fold-b">Body</div></details>`;
  v.prepend(d);
  const g = (sel, prop, pseudo) => { const e = document.querySelector(sel); return e ? getComputedStyle(e, pseudo || null)[prop] : null; };
  const cs = getComputedStyle(document.documentElement), tk = k => cs.getPropertyValue(k).trim();
  return {
    tokens: { accent: tk("--accent"), focus: tk("--focus"), live: tk("--live"), green: tk("--green"), red: tk("--red"), gold: tk("--gold") },
    roles: { error: !!d.querySelector(".ds-state.is-error[role=alert]"), status: d.querySelectorAll("[role=status]").length, bar: (d.querySelector("[role=progressbar]") || {}).getAttribute?.("aria-valuenow") },
    colors: { okIc: g(".ds-state.is-success .ds-state-ic", "color"), errIc: g(".ds-state.is-error .ds-state-ic", "color"), warnIc: g(".ds-state.is-warning .ds-state-ic", "color"),
      prog: g(".ds-progress>i", "backgroundImage"), rec: g("#__rec .rec-btn", "backgroundImage"), primary: g("#__p", "backgroundImage"), primaryLabel: g("#__p", "color"),
      outline: g("#__o", "borderTopColor"), orb: g(".ai-orb", "backgroundImage"), disabledOpacity: g("#__d", "opacity"), meterHidden: g("#__rec .ds-meter", "display") },
  };
});
const rgb = hex => { const h = hex.replace("#", ""); const f = h.length === 3 ? h.split("").map(c => c + c).join("") : h; return `rgb(${parseInt(f.slice(0, 2), 16)}, ${parseInt(f.slice(2, 4), 16)}, ${parseInt(f.slice(4, 6), 16)})`; };

/* ── 1–2 · components + roles, per track × theme ── */
console.log("\n1–2 · SHARED COMPONENTS TAKE THE THEME · ROLES");
const seen = {};
for (const track of ["general-english", "welding"]) for (const theme of ["dark", "light"]) {
  const { ctx, p } = await open(track, [390, 844], { theme });
  await p.evaluate(() => go("home")); await sleep(500);
  const r = await gallery(p);
  const T = r.tokens, C = r.colors, tag = `${track === "welding" ? "Forge" : "Signal"} ${theme}`;
  seen[tag] = C.primary;
  ok(`${tag}: states use the semantic tokens (success ${T.green}, error ${T.red}, warning ${T.gold})`, C.okIc === rgb(T.green) && C.errIc === rgb(T.red) && C.warnIc === rgb(T.gold), JSON.stringify(C));
  ok(`${tag}: primary button, progress fill and record button all use the theme CTA gradient; outline uses the accent`, C.primary && C.primary === C.prog && C.primary === C.rec && C.outline === rgb(T.accent), JSON.stringify({ p: C.primary.slice(0, 60), prog: C.prog.slice(0, 60), rec: C.rec.slice(0, 60), outline: C.outline, accent: T.accent }));
  ok(`${tag}: AI orb themed, disabled button dimmed, meter hidden while idle`, /radial-gradient/.test(C.orb) && +C.disabledOpacity <= .55 && C.meterHidden === "none", JSON.stringify({ orb: C.orb.slice(0, 50), d: C.disabledOpacity, m: C.meterHidden }));
  ok(`${tag}: roles — error is an alert, loading/success/AI are status, progress reports its value`, r.roles.error && r.roles.status >= 3 && r.roles.bar === "62", JSON.stringify(r.roles));
  await ctx.close();
}
ok("ONE implementation, TWO themes: the same primary-button component renders four different theme fills", new Set(Object.values(seen)).size === 4 || (seen["Signal dark"] !== seen["Forge dark"] && seen["Signal light"] !== seen["Forge light"]), JSON.stringify(seen).slice(0, 300));

/* ── 3 · sheets ── */
console.log("\n3 · SHEET / MODAL SURFACE");
for (const [vp, track] of [[[375, 812], "general-english"], [[390, 844], "welding"], [[1280, 800], "general-english"], [[1280, 800], "welding"]]) {
  const { ctx, p } = await open(track, vp);
  await p.evaluate(() => { window.__res = null; askConfirm({ icon: "info", title: "Leave this session?", body: "Your recording stays saved.", confirmLabel: "Leave", cancelLabel: "Stay" }).then(r => { window.__res = r; }); });
  await sleep(500);
  const g = await p.evaluate(() => { const c = document.querySelector(".cf-ov.show .cf-card"); if (!c) return null; const r = c.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth, vh: innerHeight }; });
  const sheet = vp[0] < 800;
  const fits = g && g.top >= 0 && g.bottom <= g.vh + 1 && g.left >= 0 && g.right <= g.vw + 1;
  const shape = g && (sheet ? Math.abs(g.bottom - g.vh) <= 2 && g.left <= 1 && g.right >= g.vw - 1 : Math.abs((g.top + g.bottom) / 2 - g.vh / 2) < 40);
  await p.evaluate(() => { const b = [...document.querySelectorAll(".cf-ov.show button")].find(x => /stay/i.test(x.innerText)); b && b.click(); }); await sleep(400);
  const closed = await p.evaluate(() => ({ res: window.__res, open: !!document.querySelector(".cf-ov.show") }));
  ok(`${vp[0]}×${vp[1]} ${track}: the confirm dialog is a ${sheet ? "bottom sheet (full width, on the bottom edge)" : "centred card"}, inside the viewport, and its own Cancel still closes it`, fits && shape && closed.open === false && (closed.res === false || (closed.res && closed.res.ok === false)), JSON.stringify({ g, closed }));
  await ctx.close();
}

/* ── 4 · keyboard focus ── */
console.log("\n4 · KEYBOARD FOCUS RING");
for (const track of ["general-english", "welding"]) {
  const { ctx, p } = await open(track, [1280, 800]);
  await p.evaluate(() => go("home")); await sleep(500); await gallery(p);
  await p.evaluate(() => document.getElementById("__s").blur()); await p.focus("#__s");
  await p.keyboard.press("Tab"); await sleep(150);
  const f = await p.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { tag: a.tagName, id: a.id, outline: cs.outlineStyle, color: cs.outlineColor, focus: getComputedStyle(document.documentElement).getPropertyValue("--focus").trim(), fv: a.matches(":focus-visible") }; });
  ok(`${track}: Tab moves focus and the shared ring shows in the theme's focus colour (${f.focus})`, f.fv && f.outline === "solid" && f.color === rgb(f.focus), JSON.stringify(f));
  await ctx.close();
}

/* ── 5 · recording + meter ── */
console.log("\n5 · RECORDING CONTROL + VOICE METER (Session, both tracks)");
for (const track of ["general-english", "welding"]) {
  const { ctx, p } = await open(track, [390, 844]);
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(600);
  const idle = await p.evaluate(() => { const m = document.querySelector("#v-journey .ds-meter,.view.on .ds-meter"); return m ? getComputedStyle(m).display : "absent"; });
  const b = await p.$("#recBtn"); await b.scrollIntoViewIfNeeded(); await b.click(); await sleep(1300);
  const hs = []; for (let i = 0; i < 6; i++) { hs.push(await p.evaluate(() => { const m = document.querySelector(".view.on .ds-meter"); return { d: getComputedStyle(m).display, h: Math.max(...[...m.querySelectorAll("i")].map(i => i.getBoundingClientRect().height)) }; })); await sleep(130); }
  await b.click(); await sleep(700);
  const after = await p.evaluate(() => getComputedStyle(document.querySelector(".view.on .ds-meter")).display);
  const hmax = Math.max(...hs.map(x => x.h)), hmin = Math.min(...hs.map(x => x.h));
  ok(`${track}: the Session meter is hidden idle, shows while recording and moves with the voice (bar height ${hmin.toFixed(0)}–${hmax.toFixed(0)}px), hides again on stop`, idle === "none" && hs.every(x => x.d === "flex") && hmax > 12 && hmax - hmin > 2 && after === "none", JSON.stringify({ idle, hs, after }));
  await ctx.close();
}

/* ── 6 · layouts ── */
console.log("\n6 · LAYOUT 375 / 390 / 430 / 1280 × dark + light");
for (const vp of [[375, 812], [390, 844], [430, 932], [1280, 800]]) for (const theme of ["dark", "light"]) for (const track of ["general-english", "welding"]) {
  const { ctx, p } = await open(track, vp, { theme });
  const screens = ["go('home')", "go('journey')", "go('session',1,'Mon')", "go('practice')", "go('shadow')"].concat(track === "welding" ? ["go('simulation')"] : []);
  const over = [];
  for (const js of screens) { await p.evaluate(js); await sleep(350); await gallery(p); if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) over.push(js); }
  ok(`${vp[0]}×${vp[1]} ${theme} ${track}: ${screens.length} screens with every component on them, no horizontal overflow`, !over.length, over.join(","));
  await ctx.close();
}

/* ── 7 · reduced motion ── */
console.log("\n7 · REDUCED MOTION");
for (const track of ["general-english", "welding"]) {
  const { ctx, p } = await open(track, [390, 844], { reduced: true });
  await p.evaluate(() => go("home")); await sleep(400); await gallery(p);
  const rm = await p.evaluate(() => ({ skel: getComputedStyle(document.querySelector(".ds-skel i")).animationName, state: getComputedStyle(document.querySelector(".ds-state")).animationName, orb: getComputedStyle(document.querySelector(".ai-orb")).animationName, prog: getComputedStyle(document.querySelector(".ds-progress>i")).transitionDuration, sheet: getComputedStyle(document.querySelector(".btn")).transitionDuration }));
  ok(`${track}: reduced motion — skeleton, state entrance, AI orb, progress and button motion all off`, rm.skel === "none" && rm.state === "none" && rm.orb === "none" && /^0s/.test(rm.prog) && /^0s/.test(rm.sheet), JSON.stringify(rm));
  await ctx.close();
}

/* ── 8 · track switch: theme only ── */
console.log("\n8 · TRACK SWITCH CHANGES THE THEME, NOT THE LEARNING");
{
  const { ctx, p } = await open("general-english", [390, 844]);
  const probe = () => p.evaluate(() => ({ track: document.documentElement.getAttribute("data-track"), bg: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(), pack: mvPack() === null, pp: typeof ppAvailable === "function" ? ppAvailable() : null, prof: isProfessionalJourney(), ge: isGeneralEnglish() }));
  const a = await probe();
  await p.evaluate(() => selectProfessionalTrack("welding")); await sleep(700); const b = await probe();
  await p.evaluate(() => selectProfessionalTrack("general-english")); await sleep(700); const c = await probe();
  ok("General English → Welding → General English with the app's own switch: theme follows (Signal ↔ Forge); the gates answer exactly as the track requires", a.bg === "#080b16" && b.bg === "#090c14" && c.bg === "#080b16" && b.track === "welding" && a.ge && !a.prof && b.prof && !b.ge && b.pp === false && b.pack && c.ge && JSON.stringify(a) === JSON.stringify(c), JSON.stringify({ a, b, c }));
  await ctx.close();
}

ok("no page errors in any context", errors.length === 0, errors.slice(0, 5).join(" | "));
await browser.close();
if (server) server.kill();
const failed = res.filter(x => !x.pass);
console.log(`\n${res.length - failed.length}/${res.length} passed`);
process.exit(failed.length ? 1 : 0);
