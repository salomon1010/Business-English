/* Scroll indicators, app-wide (owner, 26–27 Sep 2026: "build a smaller scroll indicator (4×36 px) in all
   the application"). Run: cd tests && node scroll-indicator.mjs        (BASE=… for another tree)
   WebKit (iPhone Safari's engine), iPhone 13. No native bar anywhere; one small thumb follows whatever
   scrolls — the page, a sideways rail — and fades; the Shadow workspace keeps its own. */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8136);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await webkit.launch();
async function learner(track) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-polish|entitlements/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(t => { if (!localStorage.getItem("be12_v1")) localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Probe", lang: "en", ts: 1 }, professionalTracks: { activeId: t, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now() })); }, track);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html?sc=" + Date.now() + "#journey"); await sleep(2500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p, errs };
}
const R = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), on: e.classList.contains("on") }; }, sel);
/* the first long page: the road map, the review, the profile, the Phrase Lab */
const longPage = p => p.evaluate(async () => { for (const v of ["journey", "review", "profile", "phrases", "practice"]) { go(v); await new Promise(r => setTimeout(r, 700)); const s = document.scrollingElement; if (s.scrollHeight > innerHeight * 1.4) return v; } return null; });
const pageThumb = async (p, label) => {
  const v = await longPage(p);
  const g = await p.evaluate(() => { const s = document.scrollingElement; return { gutter: innerWidth - document.documentElement.clientWidth, max: s.scrollHeight - innerHeight }; });
  await p.evaluate(() => { const s = document.scrollingElement; s.scrollTop = 0; }); await sleep(150);
  await p.evaluate(() => { document.scrollingElement.scrollTop = 300; }); await sleep(250);
  const a = await R(p, "#appScrollV");
  await p.evaluate(() => { document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight; }); await sleep(250);
  const z = await R(p, "#appScrollV"), nav = await R(p, ".bottom-nav");
  await sleep(1400); const faded = await R(p, "#appScrollV");
  ok(`${label} · the page (${v}): no native bar takes width; scrolling shows a 4×36 px thumb on the right edge that moves with the page, stays above the bottom nav, and fades`,
    v && g.gutter === 0 && a && a.on && a.w === 4 && a.h === 36 && a.r >= 384 && z.t > a.t && (!nav || nav.h === 0 || z.b <= nav.t) && faded && !faded.on, JSON.stringify({ v, g, a, z, nav, faded }));
};

console.log("\n# General English");
{
  const { ctx, p, errs } = await learner("general-english");
  await pageThumb(p, "1");
  /* a sideways rail: the library's chips */
  await p.evaluate(async () => { go("shadow"); await new Promise(r => setTimeout(r, 1500)); });
  const rail = await p.evaluate(() => { const c = document.querySelector("#shLib .shl-chips"); if (!c) return null; c.scrollLeft = 0; return { max: c.scrollWidth - c.clientWidth, gutter: c.offsetHeight - c.clientHeight }; });
  await p.evaluate(() => { const c = document.querySelector("#shLib .shl-chips"); if (c) c.scrollLeft = 120; }); await sleep(250);
  const h = await R(p, "#appScrollH"), rr = await R(p, "#shLib .shl-chips");
  ok("2 · a sideways rail (the library's chips): no native bar; scrolling it shows a 36×4 px thumb along its bottom edge", rail && rail.max > 20 && rail.gutter === 0 && h && h.on && h.w === 36 && h.h === 4 && Math.abs(h.b - rr.b) <= 4 && h.l >= rr.l, JSON.stringify({ rail, h, rr }));
  /* the Shadow workspace keeps its own thumb, never the page's */
  await p.evaluate(async () => { await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); }); await sleep(3000);
  await p.evaluate(() => { const v = document.getElementById("appScrollV"); if (v) v.classList.remove("on"); shOpenWork(); }); await sleep(600);
  await p.evaluate(() => { const b = document.querySelector("#shWork .sh-work-body"); b.scrollTop = 300; }); await sleep(250);
  const own = await R(p, "#shv3Scroll"), app = await R(p, "#appScrollV");
  ok("3 · the Shadow workspace: its own small thumb shows (kept off the video), the page thumb does not double it", own && own.on && own.w === 4 && own.h === 36 && (!app || !app.on), JSON.stringify({ own, app }));
  ok("4 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
console.log("\n# Welding: the same small indicator (app-wide chrome)");
{
  const { ctx, p, errs } = await learner("welding");
  await pageThumb(p, "5");
  ok("6 · Welding: no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
