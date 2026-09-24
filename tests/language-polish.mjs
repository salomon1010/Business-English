/* BE Mastery — LANGUAGE POLISH in the Universal Speaking Report.

   Run:  cd tests && node language-polish.mjs

   The capability is one more field on the report the mission and the
   conversations already share (mvreport → shapeMvReport → shapeReport), not a
   second engine. What this suite proves, structurally — it does NOT prove the
   polish is good English; the live check (language-polish-live.mjs) and a
   human reading its output do that:

   1. mission + a meaningful improvement → a "Natural English" fold appears (the Practice Partner name; roleplay keeps "Language polish")
   2. mission + already-natural language (model returns nothing) → no fold
   3-5. interview / salary negotiation / simulation → the prompt carries THAT
      scenario, the fold appears, anchored to the learner's own turns
   6. Practice Partner review → its own polish (fixes, natural) is untouched,
      and it grows no second polish fold
   7. a failed or garbage polish pass leaves the evidence byte-identical
   8. the model cannot put words in the learner's mouth: a "said" that is not
      in the transcript is dropped, and so is a rewrite that changes nothing
   9. Welding: no report, no polish, no history, no state
   plus: the polish never leaves the device (sync payload strips it). */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { shapeMvReport } from "../backend/polish-worker.js";

const require = createRequire(import.meta.url);
const ME = require("../mission-engine.js");
const PACK = JSON.parse(readFileSync(new URL("../tracks/general/missions.json", import.meta.url), "utf8"));

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

const comp = ME.competencyOf(PACK, "raise-problem");
const G = ME.missionOf(comp, "raise-problem-guided");
const SAID = "We have got a problem with the delivery. The supplier he changed the number of the order. This means we would finish three days late. I already make a call to their office.";
const POL_REAL = [
  { said: "The supplier he changed the number of the order", better: "The supplier changed the order number", why: "Drops the doubled subject and uses the usual term." },
  { said: "I already make a call to their office", better: "I've already called their office", why: "The present perfect says the call is done." },
];

/* ═════════════ 1 · ENGINE + WORKER SHAPE (no browser) ═════════════ */
console.log("\n1 · ENGINE — polish is validated against the transcript");
const evFor = s => Object.assign(ME.grade(comp, G, s, { seconds: 22 }), { said: s });
const ev = evFor(SAID);
const prompt = ME.reportPrompt(ME.aiContext(ME.blank("raise-problem"), comp, G, { weakness: null }), ev, comp);
ok("the mission prompt asks for polish anchored to the learner's EXACT words, only when material, empty when natural",
  /"polish"/.test(prompt) && /EXACT/.test(prompt) && /MATERIALLY/.test(prompt) && /empty list/.test(prompt) && /never correct a minor/i.test(prompt));
ok("the mission prompt is the task's own context — the polish is judged against THIS mission, not a textbook",
  prompt.includes(G.prompt || "") && /communication moves/.test(prompt));

const shaped = ME.shapeReport({ well: [], improve: [], polish: POL_REAL }, comp, ev);
ok("real phrases the learner said pass through, with you-said / better / why", shaped.polish.length === 2 && /order number/.test(shaped.polish[0].better) && shaped.polish[1].why.length > 0, JSON.stringify(shaped.polish));
ok("polish alone marks the report as AI-written", shaped.ai === true);

const inv = ME.shapeReport({ polish: [
  { said: "We will absolutely renegotiate the whole contract", better: "Let's renegotiate", why: "INVENTED — never said" },
  { said: "The supplier changed the order number", better: "The supplier changed the order number.", why: "no change" },
  { said: "  ", better: "x", why: "" },
  POL_REAL[0], POL_REAL[1], { said: "This means we would finish three days late", better: "So we'd finish three days late", why: "over the cap" },
] }, comp, ev);
ok("8 · an invented 'you said' is dropped; a no-change rewrite is dropped; blanks dropped; capped at two",
  inv.polish.length === 2 && !inv.polish.some(x => /renegotiate/.test(x.said)) && inv.polish.every(x => x.said !== "The supplier changed the order number"), JSON.stringify(inv.polish));
ok("8 · matching tolerates case and punctuation but not new words",
  ME.shapeReport({ polish: [{ said: "the SUPPLIER he changed, the number of the order!", better: "The supplier changed the order number", why: "" }] }, comp, ev).polish.length === 1
  && ME.shapeReport({ polish: [{ said: "the supplier he quickly changed the number", better: "x y", why: "" }] }, comp, ev).polish.length === 0);
ok("8 · no transcript on the evidence → no polish at all (unverifiable is refused, not trusted)",
  ME.shapeReport({ polish: POL_REAL }, comp, Object.assign({}, ev, { said: "" })).polish.length === 0);
ok("2 · the model returning nothing means no polish — and there is no invented deterministic floor for it",
  ME.shapeReport({ polish: [] }, comp, ev).polish.length === 0 && ME.shapeReport(null, comp, ev).polish.length === 0);

/* 7 · evidence is never touched */
const evA = evFor(SAID), evB = evFor(SAID);
const snap = e => JSON.stringify({ moves: e.moves, covered: e.covered, missed: e.missed, coverage: e.coverage, passed: e.passed, verdict: e.verdict, clarity: e.clarity, fluency: e.fluency, vocab: e.vocab });
ME.shapeReport({ polish: POL_REAL, well: [{ move: "issue", note: "x" }] }, comp, evA);
ME.shapeReport({ polish: "garbage", covered: "nope" }, comp, evB);
ok("7 · shapeReport with polish, or with garbage polish, leaves the evidence byte-identical", snap(evA) === snap(evFor(SAID)) && snap(evB) === snap(evFor(SAID)));
const st1 = {}, st2 = {};
const add = (st, rep) => { const r = ME.addAttempt(st, "raise-problem", Object.assign(evFor(SAID), { key: "k", missionId: G.id, kind: "guided", at: 5 }), "general-english", [1, 3, 7], { week: 3, moveIds: ME.moveIds(comp) }); ME.attachReport(st, "raise-problem", "k", rep, "general-english"); return r; };
add(st1, ME.shapeReport({ polish: POL_REAL }, comp, evFor(SAID)));
add(st2, ME.shapeReport(null, comp, evFor(SAID)));
const strip = r => JSON.stringify(Object.assign({}, r, { attempts: r.attempts.map(a => { const y = Object.assign({}, a); delete y.report; return y; }) }));
ok("7 · the competency record (state, attempts, evidence) is identical with and without polish; only report.pol differs",
  strip(st1["raise-problem"]) === strip(st2["raise-problem"]) && st1["raise-problem"].attempts[0].report.pol.length === 2 && !("pol" in st2["raise-problem"].attempts[0].report));
ok("the stored polish is compact ({s,b,w}) and bounded", st1["raise-problem"].attempts[0].report.pol.every(x => x.s && x.b && x.s.length <= 160 && x.b.length <= 220));

console.log("\n  WORKER — shapeMvReport carries polish as a transport shape");
const w = shapeMvReport(JSON.stringify({ polish: [POL_REAL[0], POL_REAL[1], { said: "a", better: "b" }, { said: "", better: "x" }, "junk"] }));
ok("the Worker passes polish through, drops entries without said/better, caps at two", w.polish.length === 2 && w.polish[0].said === POL_REAL[0].said);
ok("the Worker's existing fields are unchanged by the addition", (() => { const g = shapeMvReport("not json"); return Array.isArray(g.polish) && g.polish.length === 0 && g.well.length === 0 && g.better === "" && g.covered.length === 0; })());

/* ═════════════ 2 · BROWSER ═════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const root = new URL("..", import.meta.url).pathname;
  const mine = readFileSync(root + "index.html", "utf8");
  for (const port of [8051, 8052, 8053, 8054, 8055]) {
    const s = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
    await sleep(700);
    let served = null;
    try { served = await (await fetch(`http://127.0.0.1:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://127.0.0.1:${port}`; break; }
    s.kill();
    console.log(`  (port ${port} is serving someone else's tree — trying the next one)`);
  }
  if (!BASE) { console.error("Could not start a server on a free port. Pass BASE=… instead."); process.exit(1); }
}
console.log("\n  serving: " + BASE);
const POLISH = "https://be-polish.nore-ngou.workers.dev";
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
let reply = null, mode = "ok", lastSys = "";

async function learner(id, track) {
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  await ctx2.addInitScript(({ track }) => {
    class F {
      constructor() { this._t = null; }
      _fire() { const txt = window.__say || ""; if (txt && this.onresult) { const r = [{ 0: { transcript: txt, confidence: 0.9 }, isFinal: true, length: 1 }]; r.length = 1; try { this.onresult({ results: r, resultIndex: 0 }); } catch (e) {} } }
      _end() { this._on = false; if (this._t) { clearTimeout(this._t); this._t = null; } if (this.onend) setTimeout(() => { try { this.onend(); } catch (e) {} }, 0); }
      start() { this._on = true; this._t = setTimeout(() => { if (!this._on) return; this._fire(); this._end(); }, 120); }
      stop() { if (this._on) this._fire(); this._end(); }
      abort() { this._on = false; this._end(); }
    }
    window.SpeechRecognition = F; window.webkitSpeechRecognition = F;
    if (!localStorage.getItem("be12_v1")) {
      localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Test", role: "", goal: "Speak with confidence", slot: "", lang: "en", ts: Date.now() },
        professionalTracks: { activeId: track },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
        days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() }));
    }
  }, { track });
  await ctx2.route(u => u.href.startsWith(POLISH), async route => {
    if (mode === "abort") return route.abort("failed");
    let b = {};
    try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (b.mvreport) { lastSys = b.mvreport.system; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) }); }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  const page = await ctx2.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?pol=" + Date.now(), { waitUntil: "load" });
  await sleep(1000);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx: ctx2, page };
}
async function speak(page, text) {
  await page.evaluate(t => { window.__say = t; }, text);
  await page.evaluate(() => mvRecord());
  await page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
  await sleep(1500);
  await page.evaluate(() => mvRecord());
  await page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
  await sleep(250);
}
const MISSION_BASE = { covered: [], well: [{ move: "issue", note: "You named the problem first." }], improve: [{ move: "ask", note: "Close with what you need." }],
  better: "We have a problem with the delivery. The supplier changed the order number, so we would finish three days late. Could you approve two extra days?", expressions: [{ e: "this means", why: "cause to impact" }], one: "End with a clear ask." };
const foldOf = page => page.evaluate(() => {
  const d = [...document.querySelectorAll(".mv-fold")].find(x => /Natural English|Language polish/.test(x.querySelector("summary").textContent));   /* mission: "Natural English" (the Practice Partner name); roleplay keeps "Language polish" */
  return d ? { open: d.open, first: [...document.querySelectorAll(".mv-fold > summary")].map(s => s.textContent.trim())[0], rows: [...d.querySelectorAll(".mv-pol, .pp-rv-nat")].map(p => p.textContent.replace(/\s+/g, " ")) } : null;   /* textContent: a closed fold has no innerText */
});

console.log("\n2 · MISSION — Week 3 'Raise a problem'");
const L = await learner("ge", "general-english");
reply = Object.assign({}, MISSION_BASE, { polish: POL_REAL });
await L.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
await speak(L.page, SAID);
const f1 = await foldOf(L.page);
const prim = await L.page.evaluate(() => !!document.querySelector(".mv-rep .mv-pol"));
ok("1 · meaningful improvement → a closed 'Natural English' fold (the Practice Partner review's name for it), first of the folds, You said / Better / Why for each entry",
  f1 && !f1.open && /Natural English/.test(f1.first) && f1.rows.length === 2 && /YOU SAID.*supplier he changed/i.test(f1.rows[0]) && /BETTER.*order number/i.test(f1.rows[0]) && /WHY/i.test(f1.rows[0]), JSON.stringify(f1));
ok("the primary hierarchy is unchanged — polish is not in the top report", !prim);
const row = await L.page.evaluate(() => { const r = mvStore()["raise-problem"]; return r.attempts[r.attempts.length - 1]; });
ok("the polish is stored on the attempt row, nothing about the evidence mentions it", row.report.pol.length === 2 && !("polish" in row) && !("pol" in row), JSON.stringify(Object.keys(row)));

await L.page.evaluate(() => go("mvhist")); await sleep(300);
const hp = await L.page.evaluate(() => { const d = document.querySelectorAll(".mv-hist-row")[0]; d.open = true; return d.querySelectorAll(".mv-pol").length; });
ok("the Speaking history shows the same polish for that attempt", hp === 2);

const sync = await L.page.evaluate(() => { const p = fbSyncPayload(S); const a = p.v2A["general-english"]["raise-problem"].attempts.slice(-1)[0]; const l = S.v2A["general-english"]["raise-problem"].attempts.slice(-1)[0]; return { cloud: !!(a.report && a.report.pol), local: !!(l.report && l.report.pol) }; });
ok("the polish never leaves the device: stripped from the cloud payload, kept locally", !sync.cloud && sync.local, JSON.stringify(sync));

/* 2 · already natural */
reply = Object.assign({}, MISSION_BASE, { polish: [] });
await L.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(200);
await L.page.evaluate(() => mvRetry()); await sleep(200);
await speak(L.page, G.hear.model);
ok("2 · already-natural language (model returns no polish) → no Natural English fold, no stored polish",
  !(await foldOf(L.page)) && await L.page.evaluate(() => { const r = mvStore()["raise-problem"]; return !r.attempts[r.attempts.length - 1].report.pol; }));

/* 8 in the browser: the model quotes words that were never said */
reply = Object.assign({}, MISSION_BASE, { polish: [{ said: "I refuse to work with this supplier ever again", better: "I'd prefer another supplier", why: "INVENTED" }] });
await L.page.evaluate(() => mvRetry()); await sleep(200);
await speak(L.page, SAID);
ok("8 · the model inventing learner text → nothing shown, nothing stored", !(await foldOf(L.page)) && await L.page.evaluate(() => { const r = mvStore()["raise-problem"]; return !r.attempts[r.attempts.length - 1].report.pol; }));

/* 7 in the browser: the pass fails outright */
const before = await L.page.evaluate(() => { const r = mvStore()["raise-problem"]; return { n: r.attempts.length, state: r.state }; });
mode = "abort";
await L.page.evaluate(() => mvRetry()); await sleep(200);
await speak(L.page, SAID);
const failed = await L.page.evaluate(() => { const r = mvStore()["raise-problem"]; const a = r.attempts[r.attempts.length - 1]; return { n: r.attempts.length, pending: !!a.coachPending, pol: !!(a.report && a.report.pol), moves: a.moves, coverage: a.coverage }; });
const fresh = ME.grade(comp, ME.missionOf(comp, "raise-problem-guided"), SAID, { seconds: 1 });
ok("7 · polish unreachable → attempt saved and scored exactly as the scorer says, pending recovery, no polish",
  failed.n === before.n + 1 && failed.pending && !failed.pol && JSON.stringify(failed.moves) === JSON.stringify(fresh.moves) && failed.coverage === fresh.coverage, JSON.stringify({ failed, fresh: { moves: fresh.moves, coverage: fresh.coverage } }));
mode = "ok";

/* 3-5 · conversations */
console.log("\n3 · CONVERSATIONS — interview, salary negotiation, simulation");
const TURNS = {
  "interview": ["Thank you for invite me today.", "I am working like logistics analyst since five years, I look after the data of suppliers."],
  "iv-salary": ["Thank you, I am happy for the offer.", "But for me eighty-two is too few, I was thinking more in ninety because I have five years of experience."],
  "standup": ["Yesterday I have finished the report for the client.", "Today I will do the testing, but I am blocked because the server is not working since the morning."],
};
const POL_FOR = {
  "interview": [{ said: "I am working like logistics analyst since five years", better: "I've worked as a logistics analyst for five years", why: "In an interview, 'for five years' with the present perfect sounds precise and confident." }],
  "iv-salary": [{ said: "for me eighty-two is too few", better: "Eighty-two is a little below what I was expecting", why: "Negotiation language stays polite while holding your position." }],
  "standup": [{ said: "Yesterday I have finished the report for the client", better: "Yesterday I finished the client report", why: "A finished time like 'yesterday' takes the simple past — the usual stand-up form." }],
};
for (const [id, label] of [["interview", "Interview"], ["iv-salary", "Salary negotiation"], ["standup", "Simulation (stand-up)"]]) {
  reply = { covered: [], well: [{ move: "p1", note: "A polite opening." }], improve: [{ move: "p2", note: "Bring in the second point." }], better: "Thank you for the offer. Based on my five years of experience, I was hoping for something closer to ninety.", expressions: [], one: "Cover every point.", polish: POL_FOR[id] };
  const ts = Date.now();
  const title = await L.page.evaluate(({ id, ts, turns }) => {
    const sc = SCENARIOS.find(s => s.id === id);
    _rpLastTs = ts; _rpLast = { sc, turns: turns.map(text => ({ text })), covered: new Set([1]) };
    S.convos = S.convos || []; S.convos.push({ ts, id: sc.id, title: sc.title, cat: sc.cat, tk: areaId(), covered: 1, total: sc.points.length, turns: turns.length, lines: turns.map(text => ({ text })) });
    save(); go("roleplay"); return sc.title;
  }, { id, ts, turns: TURNS[id] });
  await L.page.evaluate(() => rpReport()); await sleep(500);
  /* since 24 Sep 2026 the conversation's screen is the Executive Polish
     report (rpReport → rpHost); the polish lives on the entry and in the
     Speaking history, not on that screen */
  const stored = await L.page.evaluate(ts => { const c = S.convos.find(x => x.ts === ts); return { pol: c.rep.pol, covered: c.covered, screen: !!document.querySelector("#rpRepWrap .ex-rep-card"), oldFold: !!document.querySelector("#v-roleplay .mv-fold") }; }, ts);
  ok(`${id === "interview" ? 3 : id === "iv-salary" ? 4 : 5} · ${label}: the prompt names "${title}" and asks for polish in THIS conversation; the entry keeps the learner's own turn; the covered count is untouched; the screen is the Executive Polish report`,
    lastSys.includes(`"${title}"`) && /in THIS conversation/.test(lastSys) && stored.pol.length === 1 && stored.pol[0].s.includes(POL_FOR[id][0].said) && stored.covered === 1 && stored.screen && !stored.oldFold, JSON.stringify({ stored, hasTitle: lastSys.includes(title) }));
}
reply = { covered: [], well: [], improve: [], better: "", expressions: [], one: "x", polish: [{ said: "I will sue the company", better: "x y z", why: "INVENTED" }] };
{ const ts = Date.now() + 7;
  await L.page.evaluate(({ ts }) => { const sc = SCENARIOS.find(s => s.id === "iv-salary"); _rpLastTs = ts; _rpLast = { sc, turns: [{ text: "Thank you for the offer." }], covered: new Set([]) }; S.convos.push({ ts, id: sc.id, title: sc.title, cat: sc.cat, tk: areaId(), covered: 0, total: 3, turns: 1, lines: [] }); save(); }, { ts });
  await L.page.evaluate(() => rpReport()); await sleep(500);
  ok("8 · conversation: an invented quote is dropped there too", await L.page.evaluate(ts => !S.convos.find(x => x.ts === ts).rep.pol && !document.querySelector("#v-roleplay .mv-pol"), ts)); }
const cs = await L.page.evaluate(() => { const p = fbSyncPayload(S); return { cloud: p.convos.filter(c => c.rep && c.rep.pol).length, local: S.convos.filter(c => c.rep && c.rep.pol).length }; });
ok("conversation polish is stripped from the cloud payload too", cs.cloud === 0 && cs.local === 3, JSON.stringify(cs));
await L.page.evaluate(() => go("mvhist")); await sleep(300);
ok("conversation polish appears in the Speaking history", await L.page.evaluate(() => { document.querySelectorAll(".mv-hist-row").forEach(d => d.open = true); return document.querySelectorAll("#v-mvhist .mv-pol").length >= 3; }));

/* 6 · Practice Partner */
console.log("\n4 · PRACTICE PARTNER — its own polish, untouched");
const pp = await L.page.evaluate(() => {
  const REV = { id: "rvpol", pairId: "pX", at: Date.now(), tk: "general-english", round: 1, partner: "Dana", review: {
    topic: "Tell me about yourself", summary: "s", seqs: [1], rounds: [{ seq: 1, pron: 60, grammar: 60, vocab: 60, fluency: 60, task: 60 }],
    indicators: { pron: 60, grammar: 60, vocab: 60, fluency: 60, task: 60 },
    well: [{ text: "w", evidence: "R1" }], improve: [{ text: "i", evidence: "R1" }],
    task: { objective: "", components: [], verdict: "" },
    fixes: [{ kind: "error", pattern: "since", count: 1, said: "I work here since five years", better: "I have worked here for five years", why: "for + present perfect", practice: "I have worked here for five years." }],
    natural: [{ said: "I am doing the job of analyst", natural: "I work as an analyst", professional: "I'm a data analyst" }],
    vocab: { used_well: [], misused: [], must: [], upgrade: [], next: [], patterns: [] }, pron: [],
    coach: { script: ["a"], practice: [] }, reused: [], prev: [],
    next: { pron: [], vocab: [], pattern: "", answer: "", skill: "" },
    answer: { original: "", polished: "", changed: [] } } };
  const d = document.createElement("div"); d.innerHTML = ppRevHTML(REV);
  return { fixes: d.querySelectorAll(".pp-rv-fix").length, nat: d.querySelectorAll(".pp-rv-nat").length, mvPol: d.querySelectorAll(".mv-pol").length,
    folds: [...d.querySelectorAll(".mv-fold > summary")].map(s => s.textContent.trim()) };
});
ok("6 · the partner review still renders its own polish (sentence structure fixes + natural English) and grows no second 'Language polish' fold",
  pp.fixes === 1 && pp.nat === 1 && pp.mvPol === 0 && !pp.folds.some(f => /Language polish/.test(f)) && pp.folds.some(f => /Sentence structure/i.test(f)), JSON.stringify(pp));
const pwSrc = readFileSync(new URL("../backend/partner/partner-worker.js", import.meta.url), "utf8");
ok("6 · the partner Worker's review contract still asks for its fixes / natural rewrites (not rerouted through the mission polish)",
  /"fixes":\[\{"said":"exact quote"/.test(pwSrc) && /"natural":\[\{"said":""/.test(pwSrc));

/* 9 · Welding */
console.log("\n5 · WELDING — the boundary");
const B = await learner("weld", "welding");
const weld = await B.page.evaluate(async () => {
  const btn = rpRepBtnHTML();
  go("mvhist"); await new Promise(r => setTimeout(r, 300));
  return { v: cur.v, btn, v2: !!(S.v2A && Object.keys(S.v2A).some(a => Object.keys(S.v2A[a] || {}).length)), pol: document.querySelectorAll(".mv-pol").length,
    reps: (S.convos || []).filter(c => c && c.rep).length };
});
await B.page.evaluate(() => { const sc = SCENARIOS[0]; _rpLastTs = 1; _rpLast = { sc, turns: [{ text: "I has a problem." }], covered: new Set() }; try { rpReport(); } catch (e) {} });
await sleep(300);
const weld2 = await B.page.evaluate(() => ({ reps: (S.convos || []).filter(c => c && c.rep).length, v2: !!(S.v2A && Object.keys(S.v2A).some(a => Object.keys(S.v2A[a] || {}).length)) }));
ok("9 · Welding: no report button, the history door sends home, no V2 state, rpReport refuses — no polish anywhere",
  weld.v === "home" && weld.btn === "" && !weld.v2 && weld.pol === 0 && weld.reps === 0 && weld2.reps === 0 && !weld2.v2, JSON.stringify({ weld, weld2 }));
await B.ctx.close();

await L.ctx.close();
ok("No uncaught page errors", errors.length === 0, errors.join(" | "));
await browser.close();
if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
