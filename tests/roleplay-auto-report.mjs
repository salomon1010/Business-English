/* Every roleplay / interview attempt keeps its report (owner, 24 Sep 2026).

   Run:  cd tests && node roleplay-auto-report.mjs

   The owner finished an interview, came back to the scenario and found no
   report in "Your history". Two causes: the report was only built when the
   learner tapped Speaking report, and conversation reports shared a cap of 16
   with the session-day reports, so a busy week deleted them. This suite
   proves the fix, in real Chromium with the Polish Worker stubbed:

   - ending a conversation builds and links its report with no tap;
   - the Speaking report button shimmers while that runs and carries a ready
     beacon after, and a later tap reuses the stored report (no second call);
   - the three summary buttons sit in one row, the report button has its own
     colour, and the scenario's history card is under them;
   - session-day reports can no longer push a conversation report out;
   - an older session with no report offers Get the report, built from the
     sentences kept on the entry. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";

const res = [];
const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

let BASE = process.env.BASE, server = null;
const root = new URL("..", import.meta.url).pathname;
const mine = readFileSync(new URL("../index.html", import.meta.url), "utf8");
if (!BASE) {
  for (const port of [8941, 8942, 8943, 8944]) {
    const s = spawn("python3", ["-m", "http.server", String(port)], { cwd: root, stdio: "ignore" });
    await sleep(700);
    let served = null;
    try { served = await (await fetch(`http://localhost:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://localhost:${port}`; break; }
    s.kill();
  }
  if (!BASE) { console.error("Could not start a server on a free port. Pass BASE=… instead."); process.exit(1); }
}
console.log("  serving: " + BASE);

const POLISH = "https://be-polish.nore-ngou.workers.dev";
const AI = { key_message: "I handled a disagreement with a colleague about a deadline.", clarity: "clear",
  sharper: "When a colleague and I disagreed on a deadline, I proposed a split delivery and we shipped on time.",
  level: "B1+", level_note: "Clear story; the outcome needs a number.", structure: ["Situation", "Action", "Result"], structure_note: "Good order.",
  answer_directly: "Say the outcome first.", example: "We shipped on time.", evidence: "Name the result.", credibility: "Give the date.",
  hedges: [], corrections: [], sentences: [], words: [], collocations: [], remember_title: "Outcome first", remember_body: "Lead with the result.",
  next_recording: "Tell the same story, result first.", quick_win_title: "Result first", quick_win_goal: "Open with the result.",
  concept_title: "STAR", concept_body: "Situation, task, action, result.", coach_script: "You told me what happened. Next time, start with how it ended.",
  versions: [{ style: "Clear", text: "We disagreed on a deadline; I proposed a split delivery.", learn: [] }], idioms: [] };
let analyseHits = 0, delayMs = 0;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  if (!localStorage.getItem("be12_v1")) localStorage.setItem("be12_v1", JSON.stringify({
    profile: { name: "Test", role: "", goal: "", slot: "", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "general-english" },
    fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
    days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: true }));
});
await ctx.route(u => u.href.startsWith(POLISH), async route => {
  let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
  if (b.analyse) { analyseHits++; if (delayMs) await sleep(delayMs); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(AI) }); }
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});
await ctx.route(/\/presence(\?|$)/, r => r.fulfill({ status: 200, contentType: "application/json", body: '{"online":0,"waiting":0}' }));
const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(BASE + "/index.html?rpauto=" + Date.now(), { waitUntil: "load" }); await sleep(1200);
await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));

console.log("\n1 · the report is built when the conversation ends, with no tap");
delayMs = 900;
const end = await page.evaluate(() => {
  const sc = SCENARIOS.find(s => s.id === "iv-conflict");
  go("roleplay");
  rpConv = { sc, covered: new Set([1]), history: [{ role: "assistant", content: sc.greet || "Hello" }, { role: "user", content: "A colleague and I disagreed about a deadline." }],
    turns: [{ text: "A colleague and I disagreed about a deadline." }, { text: "I proposed we split the delivery and we shipped on time." }] };
  rpSummary();
  const b = document.getElementById("rpRepBtn");
  return { ts: _rpLastTs, st: b && b.dataset.st };
});
ok("right after the conversation the Speaking report button is live, shimmering while the report is built", end.st === "busy", JSON.stringify(end));
await sleep(1600);
const after = await page.evaluate(ts => { const c = S.convos.find(x => x.ts === ts), b = document.getElementById("rpRepBtn");
  return { exrep: c && c.exrep, stored: !!(c && c.exrep && sessRepGet(c.exrep)), kind: c && c.exrep && (sessRepGet(c.exrep) || {}).kind, st: b && b.dataset.st,
    dot: b && getComputedStyle(b.querySelector(".rp-rep-dot")).display, hist: !!document.querySelector("#rpSumHist .rp-hist-teaser"),
    histLevel: (document.querySelector("#rpSumHist .rp-ht-sc") || {}).textContent || "" }; }, end.ts);
ok("with no tap, the report is stored and linked to this attempt's history entry", after.stored && after.kind === "conversation" && analyseHits === 1, JSON.stringify({ after, analyseHits }));
ok("when it is ready the button carries a beacon dot", after.st === "ready" && after.dot === "block", JSON.stringify(after));
ok("the summary shows the scenario's history card, updated with the new report's level", after.hist && /B1\+/.test(after.histLevel), JSON.stringify(after));

console.log("\n2 · the summary layout");
const lay = await page.evaluate(() => { const row = document.querySelector(".rp-sum-acts"), bs = [...row.querySelectorAll("button")], r = bs.map(b => b.getBoundingClientRect()), rb = document.getElementById("rpRepBtn");
  return { n: bs.length, tops: r.map(x => Math.round(x.top)), ws: r.map(x => Math.round(x.width)), bg: getComputedStyle(rb).backgroundImage, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("Practise again, More scenarios and Speaking report sit in one row, equal widths", lay.n === 3 && new Set(lay.tops).size === 1 && Math.max(...lay.ws) - Math.min(...lay.ws) <= 1, JSON.stringify(lay));
ok("the Speaking report button has its own colour (a gradient, not the grey button)", /gradient/.test(lay.bg), lay.bg);
ok("no horizontal scroll at 390 px", lay.sw <= lay.cw, JSON.stringify(lay));
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT }).catch(() => {});

console.log("\n3 · a later tap opens the stored report — no second call");
await page.evaluate(() => rpReport()); await sleep(500);
const tap = await page.evaluate(() => ({ card: !!document.querySelector("#rpRepWrap .ex-rep-card") }));
ok("tapping Speaking report opens the stored report with no second model call", tap.card && analyseHits === 1, JSON.stringify({ tap, analyseHits }));

console.log("\n4 · session-day reports cannot push a conversation report out");
const keep = await page.evaluate(ts => { const key = S.convos.find(x => x.ts === ts).exrep;
  for (let i = 0; i < 24; i++) sessRepPut("test:day" + i, { at: Date.now() + 1000 + i, m: { words: 1 }, kind: undefined });
  const all = Object.keys(S.notes).filter(k => k.startsWith("exrep:"));
  return { kept: !!sessRepGet(key), days: all.filter(k => (S.notes[k] || {}).kind !== "conversation").length }; }, end.ts);
ok("24 new session-day reports leave the interview report in place (session days still capped at 16)", keep.kept && keep.days === 16, JSON.stringify(keep));

console.log("\n5 · an older attempt with no report can get one");
delayMs = 0;
const T0 = end.ts - 86400000;
const old = await page.evaluate(T0 => { const sc = SCENARIOS.find(s => s.id === "iv-conflict");
  S.convos.push({ ts: T0, id: sc.id, title: sc.title, cat: sc.cat, tk: areaId(), covered: 1, total: sc.points.length, turns: 2, lines: [{ text: "We had a conflict about the budget." }, { text: "I listened and we agreed a plan." }] });
  save(); rpHistory(sc.id);
  const row = document.getElementById("rphmk_" + T0);
  return { row: !!row, btn: !!(row && row.querySelector("button")), txt: row && row.textContent }; }, T0);
ok("the history row of an older attempt says there is no report yet and offers Get the report", old.row && old.btn && /Get the report/.test(old.txt || ""), JSON.stringify(old));
await page.evaluate(T0 => rpHistMake(T0), T0); await sleep(900);
const made = await page.evaluate(T0 => { const c = S.convos.find(x => x.ts === T0); return { exrep: !!(c && c.exrep), wrap: !!document.getElementById("rphrep_" + T0), card: !!document.querySelector("#rphrep_" + T0 + " .ex-rep-card"), tx: c && c.exrep && (sessRepGet(c.exrep) || {}).tx }; }, T0);
ok("Get the report builds it from the kept sentences and the row now shows the report card", made.exrep && made.wrap && made.card && /budget/.test(made.tx || "") && analyseHits === 2, JSON.stringify({ made, analyseHits }));

ok("no uncaught page errors", errs.length === 0, errs.join(" | "));
await browser.close(); if (server) server.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} checks, ${res.length - pass} failing`);
process.exit(pass === res.length ? 0 : 1);
