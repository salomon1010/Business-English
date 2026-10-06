/* Welding: a shadow recommendation lands on Practice text shadowing (owner, 6 Oct 2026).
   The workplace lines train a welder to read and answer; the video Shadow Studio stays
   on the Shadow tab to explore. Run: cd tests && node welding-shadow-rec.mjs */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8137);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await chromium.launch();
const seed = (tr, o = {}) => Object.assign({ profile: { name: "Alex", lang: o.lang || "en", ts: 1 }, professionalTracks: { activeId: tr, tradeId: o.trade || "welder" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }, o.extra || {});
async function open(track, { width = 390, height = 844, hash = "", lang = "en", flags = { welding_studio_enabled: true, home_v2_enabled: true }, trade, extra } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, lang, f]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_lang", lang); localStorage.setItem("be_flags", f); }, [JSON.stringify(seed(track, { lang, trade, extra })), lang, JSON.stringify(flags)]);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights|gstatic\.com\/firebasejs|entitlements/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html" + hash); await sleep(1800);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#coachSummary").forEach(e => e.remove()));
  return { ctx, p, errs };
}
/* every YouTube id the page shows — thumbnails, slides, rows, data attributes */

console.log("\n# Welding, studio on: the shadow recommendation is the workplace lines");
{ const { ctx, p, errs } = await open("welding");
  await p.evaluate(() => go("practice")); await sleep(900);
  const a = await p.evaluate(() => ({ pick: pathToolPick().id, rec: (document.querySelector(".path-tool.rec .pt-t b") || {}).textContent, why: (document.querySelector(".path-tools .sub") || {}).textContent }));
  ok("1 · Practice tab, Monday: the Recommended tool is Practice text shadowing, with its own reason", a.pick === "lines" && a.rec === "Practice text shadowing" && /workshop lines/.test(a.why || ""), JSON.stringify(a));
  await p.evaluate(() => pathToolGo("lines")); await sleep(900);
  ok("2 · …and it opens the lines page", await p.evaluate(() => cur.v === "lines" && !!document.querySelector("#v-shadow .sh-lines")));
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(900);
  const s = await p.evaluate(() => ({ lbl: (document.querySelector(".sess-jump") || {}).innerText }));
  ok("3 · session Mon: the button reads Practise text shadowing", /Practise text shadowing/.test(s.lbl || ""), JSON.stringify(s));
  await p.evaluate(() => document.querySelector(".sess-jump").click()); await sleep(900);
  const l = await p.evaluate(() => ({ v: cur.v, lines: !!document.querySelector("#v-shadow .sh-lines"), back: !!document.querySelector(".sess-return") }));
  ok("4 · …it lands on the workplace lines, with the way back to the session", l.v === "lines" && l.lines && l.back, JSON.stringify(l));
  const h = await p.evaluate(() => { const L = trackSessionLinks().Mon; return L ? homeRecDest({ kind: "lesson", w: 1, d: "Mon", title: "x" }) : null; });
  ok("5 · Home lesson card: its destination is the lines", h && h.dest === "lines" && /sessGo\('shadow'/.test(h.go), JSON.stringify(h));
  ok("6 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close(); }

console.log("\n# General English is unchanged");
{ const { ctx, p, errs } = await open("general-english");
  await p.evaluate(() => go("practice")); await sleep(900);
  const g = await p.evaluate(() => ({ pick: pathToolPick().id, dest: sessDest("shadow") }));
  ok("7 · General English Monday still recommends the Shadow Studio", g.pick === "shadow" && g.dest === "shadow", JSON.stringify(g));
  ok("8 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close(); }

await b.close(); if (srv) srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
