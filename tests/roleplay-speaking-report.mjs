/* BE Mastery — the ROLEPLAY SPEAKING REPORT (interview, negotiation,
   tell-me-about-yourself, life simulations) and the unified history.

   Run:  cd tests && node roleplay-speaking-report.mjs

   What this suite proves: a conversation's report rides the SAME engine as
   the mission's — the mvreport transport, MissionEngine.shapeReport's
   grounding, the same renderer language and voice — with the scenario's
   talking points as the moves and the app's covered set as the scorer's
   verdict. The conversation walk itself (mic → turns → summary) belongs to
   the existing roleplay suites; this one starts at the summary and covers
   everything the new code owns.

   1. ENGINE, in Node: shapeReport grounds a synthetic scenario rubric
      exactly as it grounds a mission's.
   2. BROWSER, real Chromium: the button, the report screen, idempotency,
      offline floor + recovery, sync privacy, the history sections, the
      Welding boundary, no horizontal overflow at 390×844. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const ME = require("../mission-engine.js");

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

/* ══════════════════════ 1 · ENGINE (no browser) ══════════════════════════ */
console.log("\n1 · ENGINE — a scenario rubric grounds exactly like a mission's");
const rt = p => `Next time, work "${p}" into the conversation.`;
const comp = { moves: [{ id: "p1", label: "Greet the interviewer", retry: rt("Greet the interviewer") }, { id: "p2", label: "Describe your current role", retry: rt("Describe your current role") }, { id: "p3", label: "Ask a question of your own", retry: rt("Ask a question of your own") }], expressions: [] };
const ev = { moves: { p1: true, p2: true, p3: false }, covered: ["p1", "p2"], missed: ["p3"] };
const raw = {
  well: [{ move: "p1", note: "A warm, direct opening." }, { move: "p3", note: "INVENTED — the scorer says this never happened." }],
  improve: [{ move: "p2", note: "FORBIDDEN — p2 was covered." }, { move: "p3", note: "End by asking about the team you would join." }],
  better: "Thank you for meeting me. I currently work as a logistics analyst, where I look after our supplier data. Could I ask how this role fits into the wider team?",
  expressions: [{ e: "could I ask", why: "turns a statement into a question" }],
  one: "Always leave with one question of your own.",
};
const rep = ME.shapeReport(raw, comp, ev);
ok("praise for an uncovered point is dropped, praise for a covered one stays", rep.well.length === 1 && rep.well[0].move === "p1");
ok("a correction for a covered point is dropped; the missed point keeps the AI's sentence", rep.improve.length === 1 && rep.improve[0].move === "p3" && /asking about the team/.test(rep.improve[0].note));
ok("better version, expressions and the one-thing survive", /logistics analyst/.test(rep.better) && rep.expr.length === 1 && /question of your own/i.test(rep.one) && rep.ai === true);
const floor = ME.shapeReport(null, comp, { moves: { p1: true, p2: false, p3: false }, covered: ["p1"], missed: ["p2", "p3"] });
ok("the offline floor names the missed points and still sets one focus", floor.improve.length === 2 && floor.improve[0].move && floor.one.length > 0 && floor.ai === false);
const ev2 = { moves: { p1: true, p2: true, p3: false }, covered: ["p1", "p2"], missed: ["p3"] };
ME.applyCoachMoves(ev2, comp, ["p3"]);
ok("a point the model covered AND praised is kept", ME.shapeReport({ well: [{ move: "p3", note: "You asked in your own words." }] }, comp, ev2).well.length === 1);

/* ══════════════════════ 2 · BROWSER ══════════════════════════════════════ */
console.log("\n2 · BROWSER — the summary's report, the history, the boundary");
let BASE = process.env.BASE, server = null;
const root = new URL("..", import.meta.url).pathname;
const mine = readFileSync(new URL("../index.html", import.meta.url), "utf8");
if (!BASE) {
  for (const port of [8931, 8932, 8933, 8934]) {
    const s = spawn("python3", ["-m", "http.server", String(port)], { cwd: root, stdio: "ignore" });
    await sleep(700);
    let served = null;
    try { served = await (await fetch(`http://localhost:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://localhost:${port}`; break; }
    s.kill();
    console.log(`  (port ${port} is serving someone else's tree — trying the next one)`);
  }
  if (!BASE) { console.error("Could not start a server on a free port. Pass BASE=… instead."); process.exit(1); }
}
console.log("  serving: " + BASE);
const POLISH = "https://be-polish.nore-ngou.workers.dev";
const browser = await chromium.launch();
const errors = [];
let repMode = "ok", repHits = 0, lastReportBody = null;

async function learner(id, track) {
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx2.addInitScript(({ track }) => {
    if (!localStorage.getItem("be12_v1")) {
      const st = { profile: { name: "Test", role: "", goal: "Speak with confidence in meetings", slot: "", lang: "en", ts: Date.now() },
        professionalTracks: { activeId: track },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() },
               "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
        days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() };
      localStorage.setItem("be12_v1", JSON.stringify(st));
    }
  }, { track });
  await ctx2.route(u => u.href.startsWith(POLISH), async route => {
    if (repMode === "abort") return route.abort("failed");
    let b = {};
    try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (b.mvreport) {
      repHits++; lastReportBody = b.mvreport;
      /* the model tries a violation on purpose: praise for the uncovered p3 */
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        covered: [],
        well: [{ move: "p1", note: "A warm, direct opening." }, { move: "p3", note: "INVENTED PRAISE — must be dropped." }],
        improve: [{ move: "p3", note: "End by asking about the team you would join." }],
        better: "Thank you for meeting me. I currently work as a logistics analyst, where I look after our supplier data. Could I ask how this role fits into the wider team?",
        expressions: [{ e: "could I ask", why: "turns a statement into a question" }],
        one: "Always leave with one question of your own.",
      }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  const page = await ctx2.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?rprep=" + Date.now(), { waitUntil: "load" });
  await sleep(900);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx: ctx2, page, id };
}

/* a finished conversation, exactly as rpSummary leaves it */
const seedConvo = (page, ts, coveredIdx) => page.evaluate(({ ts, coveredIdx }) => {
  const sc = SCENARIOS.find(s => s.id === "interview");
  _rpLastTs = ts;
  _rpLast = { sc, turns: [{ text: "Thank you for meeting me today." }, { text: "I work as logistics analyst since five years." }], covered: new Set(coveredIdx) };
  S.convos = S.convos || [];
  S.convos.push({ ts, id: sc.id, title: sc.title, cat: sc.cat, tk: areaId(), covered: coveredIdx.length, total: sc.points.length, turns: 2, lines: _rpLast.turns.map(x => ({ text: x.text })) });
  save();
  return { points: sc.points.length, btn: rpRepBtnHTML() };
}, { ts, coveredIdx });

const A = await learner("A", "general-english");
const T1 = Date.now();
const seeded = await seedConvo(A.page, T1, [1, 2]);
ok("the summary offers the Speaking report button on General English", /rpReport\(\)/.test(seeded.btn) && /Speaking report/.test(seeded.btn));

const promptTxt = await A.page.evaluate(() => { const sc = SCENARIOS.find(s => s.id === "interview"); const c = rpRepComp(sc); return rpRepPrompt(sc, c, rpRepEv(sc, new Set([1, 2]))); });
ok("the prompt carries the scorer's verdict for the conversation", /Covered: p1/.test(promptTxt) && /Not heard: p3/.test(promptTxt) && promptTxt.includes("p" + seeded.points) === /Not heard:.*p3/.test(promptTxt));
ok("the prompt keeps the house rules: verdict final, no scores, no accent, additions only, learner's facts", /verdict is final/i.test(promptTxt) && /No scores/.test(promptTxt) && /accent/.test(promptTxt) && /Only additions/.test(promptTxt) && /Never add facts/.test(promptTxt));

await A.page.evaluate(() => rpReport());
await sleep(600);
let st = await A.page.evaluate(ts => { const c = S.convos.find(x => x.ts === ts); return { rep: c && c.rep, html: document.getElementById("v-roleplay").textContent }; }, T1);
ok("one call writes the report onto the conversation's own entry, AI-flagged", st.rep && st.rep.ai === true && repHits === 1);
ok("the invented praise for the uncovered point was dropped; the true praise stays", st.rep.well.length === 1 && st.rep.well[0].m === "p1");
ok("the screen speaks the mission report's language: well, improve, better, one thing", /What you did well/.test(st.html) && /What to improve/.test(st.html) && /logistics analyst/.test(st.html) && /one question of your own/i.test(st.html));
ok("the missed point is shown by its own words, not its id", /Ask/.test(st.html) && !/\bp3\b/.test(st.html));
ok("the learner's turns were sent, nothing else was", lastReportBody && /logistics analyst/.test(lastReportBody.said) && !/localStorage|profile/.test(lastReportBody.said));

await A.page.evaluate(() => rpReport());
await sleep(300);
ok("a second tap re-opens the stored report, no second model call", repHits === 1);

const overflow = await A.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok("the report screen fits a 390 px phone with no horizontal scroll", !overflow);

const payload = await A.page.evaluate(ts => { const p = fbSyncPayload(S); return { synced: p.convos.find(x => x.ts === ts), local: S.convos.find(x => x.ts === ts) }; }, T1);
ok("sync privacy: the better version stays on the device, the rest of the report travels", payload.synced.rep.better === null && payload.local.rep.better && payload.synced.rep.one === payload.local.rep.one);

/* offline: the floor is stored, said so, and can be finished later */
repMode = "abort";
const T2 = T1 + 1111;
await seedConvo(A.page, T2, [1]);
await A.page.evaluate(() => rpReport());
await sleep(500);
st = await A.page.evaluate(ts => { const c = S.convos.find(x => x.ts === ts); return { rep: c && c.rep, html: document.getElementById("v-roleplay").textContent }; }, T2);
ok("a failed AI pass still leaves the honest deterministic floor on the entry", st.rep && st.rep.ai === false && st.rep.fix.length >= 1);
ok("the screen says the coaching is waiting and offers to finish it", /connection/i.test(st.html) && /Finish coaching/.test(st.html));
repMode = "ok";
await A.page.evaluate(() => rpReport());
await sleep(600);
st = await A.page.evaluate(ts => (S.convos.find(x => x.ts === ts) || {}).rep, T2);
ok("finishing the coaching upgrades the SAME entry to the AI report", st && st.ai === true && repHits === 2);

/* the unified history */
await A.page.evaluate(() => { S.ppRev = [{ id: "rv1", pairId: "p1", at: Date.now(), tk: "general-english", topic: "Raise a problem", review: { topic: "Raise a problem" } }]; save(); go("mvhist"); });
await sleep(400);
const hist = await A.page.evaluate(() => document.getElementById("v-mvhist").textContent);
ok("the history lists the conversations with their reports", /Conversations/.test(hist) && /Job interview/.test(hist) && /question of your own/i.test(hist));
ok("the history lists the Practice Partner reviews, read-only", /Practice Partner reviews/.test(hist) && /Raise a problem/.test(hist));
await A.ctx.close();

/* the Welding boundary */
const W = await learner("W", "welding");
const w = await W.page.evaluate(() => {
  const before = JSON.stringify(S.convos || []);
  const sc = SCENARIOS.find(s => s.id === "interview");
  _rpLastTs = Date.now(); _rpLast = { sc, turns: [{ text: "hello there my friend" }], covered: new Set([1]) };
  const btn = rpRepBtnHTML();
  const p = rpReport();
  return { btn, wrote: JSON.stringify(S.convos || []) !== before, area: areaId() };
});
ok("Welding: no button, no report, nothing written", w.area === "welding" && w.btn === "" && !w.wrote);
const wh = await W.page.evaluate(async () => { go("mvhist"); await new Promise(r => setTimeout(r, 300)); return cur.v; });
ok("Welding: the history door itself stays shut (sent home)", wh !== "mvhist");
await W.ctx.close();

ok("no uncaught page errors in any context", errors.length === 0, errors.join(" | "));

await browser.close();
if (server) server.kill();
const fail = res.filter(x => !x.pass).length;
console.log(`\n${res.length}/${res.length - fail === res.length ? res.length : res.length} checks, ${fail} failing`);
process.exit(fail ? 1 : 0);
