/* BE Mastery — CONTRAST SWEEP (docs/DESIGN_SYSTEM.md § Contrast, and the theme
   contract in docs/DESIGN_SYSTEM_BEMASTERY.md: every theme passes in dark and
   light before it ships).

   Run:  cd tests && node contrast-sweep.mjs
         BASE=http://127.0.0.1:PORT node contrast-sweep.mjs     (any served tree)
         JSON=/path/out.json node contrast-sweep.mjs            (full failure list)

   Method, as the design doc requires — walk the DOM, never sample:
   · every rendered text node (visible, non-empty) on each screen, for both
     tracks (Signal = General English, Forge = Welding) × dark and light;
   · the backdrop is composited from the element up through every translucent
     layer, stopping at the first opaque one; a gradient contributes each of
     its colour stops and the WORST resulting ratio is kept;
   · AA: 4.5:1 body, 3:1 for ≥24px or ≥18.66px bold;
   · gradient-clipped text (color: transparent) is reported separately — the
     doc names it a DOM-walk blind spot — by checking each gradient stop;
   · states that are not on a screen at rest (listening, AI working,
     recording, success, warning, error, inputs) are rendered with the app's
     own classes inside the page and swept the same way.
   Every finite animation is finished before measuring (a mid-fade frame is a
   timing artefact, not a failure). Non-text (UI component) contrast of the listening ring and AI edge is
   measured against the page background at 3:1. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, writeFileSync } from "node:fs";

let BASE = process.env.BASE, server = null;
const root = new URL("..", import.meta.url).pathname;
if (!BASE) {
  const mine = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const port of [8961, 8962, 8963, 8964]) {
    const s = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
    await sleep(700);
    let served = null; try { served = await (await fetch(`http://127.0.0.1:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://127.0.0.1:${port}`; break; }
    s.kill();
  }
  if (!BASE) { console.error("no free port serving this tree"); process.exit(1); }
}

const SCREENS = {
  "general-english": [["home", "go('home')"], ["roadmap", "go('journey')"], ["session", "go('session',1,'Mon')"], ["practice", "go('practice')"], ["shadow", "go('shadow')"], ["phraselab", "go('phrases')"], ["progress", "go('review')"], ["profile", "go('profile')"], ["mission", "mvGo('explain-work-guided','see')"], ["mission-speak", "mvGo('explain-work-guided','speak')"]],
  "welding": [["home", "go('home')"], ["journey", "go('journey')"], ["session", "go('session',1,'Mon')"], ["practice", "go('practice')"], ["shadow", "go('shadow')"], ["phraselab", "go('phrases')"], ["progress", "go('review')"], ["profile", "go('profile')"], ["simulation", "go('simulation')"]],
};
/* the states, rendered with the app's own classes (no new markup patterns) */
const STATES_HTML = `<div id="__cs" style="padding:12px">
  <section class="card mv-speak"><div class="mv-rec"><button class="rec-btn recording">●</button><div><div class="rec-time">00:03</div><div class="rec-state">Recording… tap to stop</div></div></div></section>
  <section class="card"><div class="ai-think" role="status"><span class="ai-orb"></span><div><b>Reading your answer…</b><small>Checking the moves</small></div></div></section>
  <section class="card"><p class="mv-note">The coach is offline — your answer is saved.</p><p class="mv-err">Could not reach the microphone.</p>
    <p class="mv-daydone">Week 1 · Tue is complete</p><div class="mv-state"><span>Where you are</span><b>Demonstrated</b></div>
    <span class="mv-move on">Role</span> <span class="mv-move off">Why it matters</span></section>
  <section class="card"><input type="text" value="Typed answer" style="width:100%"><textarea style="width:100%">Notes text</textarea>
    <button class="btn-primary">Primary action</button> <button class="btn btn-g">Secondary</button> <button class="btn btn-outline">Outline</button></section>
</div>`;

const browser = await chromium.launch();
const all = [];
for (const track of ["general-english", "welding"]) for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.addInitScript(({ track, theme }) => {
    localStorage.setItem("be_theme", theme); localStorage.setItem("be_missions", "1");
    localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Awa", lang: "en", ts: 1 }, professionalTracks: { activeId: track },
      fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
      days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }));
  }, { track, theme });
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights|googleapis\.com\/identity|firebase/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const page = await ctx.newPage();
  await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded", timeout: 20000 }); await sleep(1500);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  const actual = await page.evaluate(() => ({ track: document.documentElement.getAttribute("data-track") || "general", theme: document.documentElement.getAttribute("data-theme") || "dark" }));
  for (const [name, js] of SCREENS[track].concat([["states", "go('home')"]])) {
    await page.evaluate(js); await sleep(600);
    if (name === "states") await page.evaluate(h => { const v = document.querySelector(".view.on"); v.insertAdjacentHTML("afterbegin", h); }, STATES_HTML);
    /* measure the page at rest: every running entrance / fade finished first
       (a mid-fade frame is not a contrast failure, it is a timing artefact) */
    await page.evaluate(() => { try { document.getAnimations().forEach(a => { try { if (a.effect && a.effect.getComputedTiming().iterations !== Infinity) a.finish(); } catch (e) {} }); } catch (e) {} });
    await sleep(80);
    const r = await page.evaluate(sweep);
    r.fails.forEach(f => all.push(Object.assign({ track, theme, screen: name }, f)));
    r.grads.forEach(f => all.push(Object.assign({ track, theme, screen: name, kind: "gradient-text" }, f)));
    all.push({ track, theme, screen: name, kind: "count", checked: r.checked, failed: r.fails.length, actual });
    if (name === "states") {
      const ui = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return { live: cs.getPropertyValue("--live").trim(), ai: cs.getPropertyValue("--ai").trim(), bg: cs.getPropertyValue("--bg").trim() }; });
      all.push({ track, theme, screen: "ui-states", kind: "ui", ...ui });
    }
  }
  await ctx.close();
}
await browser.close();
if (server) server.kill();

/* ---------------- report ---------------- */
const hex = h => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
let failTotal = 0;
for (const track of ["general-english", "welding"]) for (const theme of ["dark", "light"]) {
  const counts = all.filter(x => x.kind === "count" && x.track === track && x.theme === theme);
  const checked = counts.reduce((a, b) => a + b.checked, 0), failed = counts.reduce((a, b) => a + b.failed, 0);
  failTotal += failed;
  const th = (track === "welding" ? "FORGE" : "SIGNAL") + " " + theme;
  console.log(`\n${th}: ${checked} text nodes checked, ${failed} below AA  [data-track=${counts[0].actual.track}, data-theme=${counts[0].actual.theme}]`);
  counts.filter(c => c.failed).forEach(c => console.log(`   ${c.screen}: ${c.failed}`));
  const fails = all.filter(x => !x.kind && x.track === track && x.theme === theme);
  const uniq = {}; fails.forEach(f => { const k = f.sel + "|" + f.fg + "|" + f.bg; (uniq[k] = uniq[k] || Object.assign({ n: 0, screens: new Set() }, f)).n++; uniq[k].screens.add(f.screen); });
  Object.values(uniq).sort((a, b) => a.ratio - b.ratio).slice(0, 40).forEach(f => console.log(`   FAIL ${f.ratio.toFixed(2)}:1 (need ${f.need})  ${f.sel}  "${f.text}"  fg ${f.fg} on ${f.bg}  ×${f.n}  [${[...f.screens].join(",")}]`));
  all.filter(x => x.kind === "gradient-text" && x.track === track && x.theme === theme).forEach(g => console.log(`   gradient-text ${g.worst.toFixed(2)}:1 worst stop  ${g.sel} "${g.text}"`));
  const ui = all.find(x => x.kind === "ui" && x.track === track && x.theme === theme);
  if (ui && ui.bg && ui.live) { const bg = hex(ui.bg); console.log(`   listening ${ui.live} on ${ui.bg}: ${ratio(hex(ui.live), bg).toFixed(2)}:1 (UI ≥3)   AI ${ui.ai}: ${ratio(hex(ui.ai), bg).toFixed(2)}:1 (UI ≥3)`); }
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(all, null, 1));
console.log(`\n${failTotal === 0 ? "PASS" : "FAIL"} — ${failTotal} text nodes below AA across both themes × dark/light`);
process.exit(failTotal ? 1 : 0);

/* ---------------- the in-page walker ---------------- */
function sweep() {
  /* color-mix() computes to color(srgb r g b / a) with 0–1 channels; reading
     it as "no colour" made every color-mix fill look transparent. */
  const parse = s => { const c = String(s).match(/color\(srgb ([^)]+)\)/); if (c) { const p = c[1].split(/[ /]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const stops = img => (String(img).match(/color\(srgb [^)]+\)|rgba?\([^)]+\)|#[0-9a-f]{3,8}\b/gi) || []).map(c => c[0] === "#" ? (() => { let h = c.slice(1); if (h.length === 3) h = h.split("").map(x => x + x).join(""); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 }; })() : parse(c)).filter(Boolean);
  const over = (top, bot) => { const a = top.a + bot.a * (1 - top.a); if (!a) return { r: 0, g: 0, b: 0, a: 0 }; return { r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a, g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a, b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a, a }; };
  const L = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const R = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const hx = c => "#" + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  /* every candidate backdrop under el: a list of opaque colours (one per gradient stop combination, bounded) */
  const backdrops = el => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const img = cs.backgroundImage && cs.backgroundImage !== "none" && !/url\(/.test(cs.backgroundImage) && cs.webkitBackgroundClip !== "text" && cs.backgroundClip !== "text" ? stops(cs.backgroundImage) : [];
      const col = parse(cs.backgroundColor);
      const opts = []; if (img.length) img.forEach(s => opts.push(col && col.a ? over(s, col) : s)); else if (col && col.a) opts.push(col);
      if (opts.length) { layers.push(opts); if (opts.every(o => o.a >= .999) && !img.some(s => s.a < .999)) break; }
      if (n === document.documentElement) break;
    }
    let cands = [{ r: 255, g: 255, b: 255, a: 1 }];
    const base = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    if (base && base[0] === "#") cands = [stops(base)[0]];
    for (let i = layers.length - 1; i >= 0; i--) { const nx = []; cands.forEach(c => layers[i].forEach(o => nx.push(over(o, c)))); cands = nx.slice(0, 64); }
    return cands;
  };
  const visible = el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false; if (cs.clip === "rect(0px, 0px, 0px, 0px)" || (cs.position === "absolute" && r.width <= 1)) return false; } return true; };
  const opacityOf = el => { let o = 1; for (let n = el; n; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; };
  const sel = el => { const c = (el.className && typeof el.className === "string") ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""; const p = el.parentElement && el.parentElement.className && typeof el.parentElement.className === "string" ? "." + el.parentElement.className.trim().split(/\s+/)[0] + " > " : ""; return p + el.tagName.toLowerCase() + c; };
  const seen = new Set(), fails = [], grads = []; let checked = 0;
  const walker = document.createTreeWalker(document.querySelector(".view.on") ? document.body : document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.nodeValue.trim()) continue;
    const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TITLE", "OPTION"].includes(el.tagName) || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    let fg = parse(cs.color); if (!fg) continue;
    const clip = cs.webkitBackgroundClip === "text" || cs.backgroundClip === "text";
    const bds = backdrops(el.parentElement || el);
    if (clip || fg.a === 0) { const st = stops(cs.backgroundImage); if (st.length) { let w = 99; st.forEach(s => bds.forEach(b => { w = Math.min(w, R(over(s, b), b)); })); grads.push({ sel: sel(el), text: t.nodeValue.trim().slice(0, 40), worst: w }); } continue; }
    const op = opacityOf(el); fg = Object.assign({}, fg, { a: fg.a * op });
    let worst = 99, wb = null; const own = backdrops(el);
    own.forEach(b => { const f = over(fg, b); const r = R(f, b); if (r < worst) { worst = r; wb = b; } });
    checked++;
    if (worst < need - 0.005) fails.push({ sel: sel(el), text: t.nodeValue.trim().slice(0, 40), ratio: worst, need, fg: hx(over(fg, wb)), bg: hx(wb), size });
  }
  /* input placeholders */
  document.querySelectorAll("input[placeholder],textarea[placeholder]").forEach(i => { if (!visible(i)) return; });
  return { checked, fails, grads };
}
