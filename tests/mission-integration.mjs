/* BE Mastery V2.1 — Week 3 integration hardening.

   The Week 3 loop itself is covered by mission-week3.mjs. This suite covers
   the seams V2.1 added: the evidence contract, Shadow → V2 evidence, progress
   integration, the recommendation actually differing on evidence, the AI
   boundary, V1/V2 coexistence and track isolation of all of it.

   Run:  cd tests && node mission-integration.mjs                             */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const ME = require("../mission-engine.js");
const ROOT = new URL("..", import.meta.url).pathname;
const PACK = JSON.parse(readFileSync(ROOT + "tracks/general/missions.json", "utf8"));
const GEN = JSON.parse(readFileSync(ROOT + "tracks/general/progress.json", "utf8"));
const WELD = JSON.parse(readFileSync(ROOT + "tracks/welding/progress.json", "utf8"));

const res = [];
const ok = (n, c, d = "") => { res.push({ name: n, pass: !!c }); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };

const comp = ME.competencyOf(PACK, "clear-update");
const G = ME.missionOf(comp, "clear-update-guided");
const T = ME.missionOf(comp, "clear-update-transfer");
const MOVES = ME.moveIds(comp);
const IV = [1, 3, 7, 21, 60];
const META = { competency: comp.id, week: comp.week, moveIds: MOVES };

const STRONG = "The project is on track and we have completed two stages. We have run into an issue with the design agency. This means Friday delivery is at risk by about two days. I will chase it up today and come back to you tomorrow.";
const NO_IMPACT = "The project is on track and two stages are finished. We have run into a supplier issue with the logo files. I will chase it up and let you know tomorrow.";
const T_STRONG = "Installation is due to start on Monday and everything else is ready. The materials from the supplier arrived three days late. That means we will push back the handover and the end of month promise is at risk. I will confirm a new date with the customer and come back to you this afternoon.";

const mk = (text, kind, key, at) => Object.assign(ME.grade(comp, kind === "transfer" ? T : G, text, { seconds: 26 }),
  { key, kind, at: at || Date.now(), missionId: kind === "transfer" ? T.id : G.id });

/* ═══════════════════ 1. THE EVIDENCE CONTRACT ═══════════════════════════ */
console.log("\n1 · EVIDENCE CONTRACT");
const c1 = ME.contract(mk(STRONG, "guided", "k1"), META);
const WANT = ["v", "tk", "week", "competency", "missionId", "kind", "key", "at", "said", "words", "seconds",
  "wpm", "answered", "task", "moves", "clarity", "clarityBasis", "fluency", "vocab", "vocabUsed",
  "pron", "pronSource", "coverage", "verdict", "passed", "transfer", "assisted", "coachPending", "coachMove", "coachAi"];
ok("The contract carries every documented field and nothing else",
  WANT.every(k => k in c1) && Object.keys(c1).length === WANT.length, Object.keys(c1).join(","));
ok("It is versioned and track-stamped", c1.v === ME.EVIDENCE_VERSION && c1.tk === "general-english" && c1.week === 3);
ok("An unmeasurable dimension is null, NOT zero — the whole point of the contract",
  c1.pron === null && c1.pronSource === null, `pron=${c1.pron}`);
const c2 = ME.contract(Object.assign(mk(STRONG, "guided", "k2"), { seconds: null, wpm: null }), META);
ok("A missing duration gives null seconds and null wpm, not 0", c2.seconds === null && c2.wpm === null);
ok("A guided attempt reports transfer:null; a transfer attempt reports true/false",
  c1.transfer === null && ME.contract(mk(T_STRONG, "transfer", "k3"), META).transfer === true);
const cN = ME.contract(Object.assign(mk(NO_IMPACT, "guided", "k4"), {}), META);
ok("Every target move is present as a boolean, including the missing one",
  MOVES.every(m => typeof cN.moves[m] === "boolean") && cN.moves.impact === false && cN.passed === false);
const smuggle = ME.contract(Object.assign(mk(STRONG, "guided", "k5"), { secretScore: 99, state: "STRONG" }), META);
ok("An undocumented field cannot be smuggled into the learner record",
  !("secretScore" in smuggle) && !("state" in smuggle));

/* ═══════════════════ 2. EVIDENCE → PROGRESSION ══════════════════════════ */
console.log("\n2 · EVIDENCE → PROGRESSION");
function run(steps) {
  const st = {}; ME.introduce(st, comp.id, "general-english", Date.parse("2026-09-22T09:00:00Z"));
  steps.forEach(([txt, kind, day], i) => {
    const at = Date.parse(`2026-09-${String(22 + (day || 0)).padStart(2, "0")}T10:0${i}:00Z`);
    ME.addAttempt(st, comp.id, mk(txt, kind, "s" + i, at), "general-english", IV, META);
  });
  const r = st[comp.id]; r.weakness = ME.weakestMove(comp, r.attempts[r.attempts.length - 1] || null, r.attempts);
  return { store: st, r };
}
const A = run([[STRONG, "guided"], [T_STRONG, "transfer"]]);
const B = run([[NO_IMPACT, "guided"], [NO_IMPACT, "retry"]]);
const C = run([[STRONG, "guided"], [NO_IMPACT, "transfer"]]);
ok("Evidence drives the state: strong+cold → TRANSFER_READY", A.r.state === "TRANSFER_READY", A.r.state);
ok("Evidence drives the state: repeated misses → PRACTICING", B.r.state === "PRACTICING", B.r.state);
ok("Guided success + failed transfer stays DEMONSTRATED — never mastered on guided work alone",
  C.r.state === "DEMONSTRATED" && C.r.transfer.failed === 1, C.r.state);
const pA = ME.progressSummary(A.r, comp), pB = ME.progressSummary(B.r, comp);
ok("progressSummary reports state, counts and per-move evidence",
  pA.state === "TRANSFER_READY" && pA.attempts === 2 && pA.passed === 2 && pA.transferPassed === 1
  && pA.byMove.length === 4 && pA.byMove.every(m => m.made === 2), JSON.stringify(pA.byMove));
ok("…and reports a move the learner keeps missing as 0 of n",
  pB.byMove.find(m => m.id === "impact").made === 0 && pB.byMove.find(m => m.id === "impact").of === 2);
ok("A dimension nobody could measure stays null in the summary too", pA.pron === null && pA.pronSource === null);

/* ═══════════════════ 3. EVIDENCE → RECOMMENDATION ═══════════════════════ */
console.log("\n3 · EVIDENCE → RECOMMENDATION");
const rA = ME.recommend(A.r, comp, Date.parse("2026-09-22T12:00:00Z"));
const rB = ME.recommend(B.r, comp, Date.parse("2026-09-22T12:00:00Z"));
const rC = ME.recommend(C.r, comp, Date.parse("2026-09-22T12:00:00Z"));
ok("Two learners with DIFFERENT evidence get DIFFERENT next steps",
  new Set([rA.action + rA.reason, rB.action + rB.reason, rC.action + rC.reason]).size === 3,
  JSON.stringify([rA, rB, rC].map(x => x.action + "/" + x.reason)));
ok("The learner who keeps missing IMPACT is sent to retry IMPACT specifically",
  rB.action === "retry" && rB.move === "impact", JSON.stringify(rB));
ok("The learner who failed the cold transfer gets guided reps, not the transfer again",
  rC.action === "retry" && rC.reason === "transfer_failed", JSON.stringify(rC));
ok("The successful learner is resting on a schedule, not handed busywork",
  rA.action === "rest" && rA.reason === "scheduled" && A.r.retrieval.due > Date.parse("2026-09-22T12:00:00Z"), JSON.stringify(rA));
/* and the recommendation is NOT a function of how much they did */
const busy = run([[NO_IMPACT, "guided"], [NO_IMPACT, "retry"], [NO_IMPACT, "retry"], [NO_IMPACT, "retry"], [NO_IMPACT, "retry"]]);
ok("Five attempts that never made the move do NOT progress the learner — effort is not evidence",
  busy.r.state === "PRACTICING" && ME.recommend(busy.r, comp, Date.now()).move === "impact",
  busy.r.state + " attempts=" + busy.r.attempts.length);

/* ═══════════════════ 4. SHADOW → V2 EVIDENCE ════════════════════════════ */
console.log("\n4 · SHADOW → V2 EVIDENCE");
const CLIP = comp.shadow.vid;
const shChal = { kind: "challenge", ts: 1e12 + 1, vid: CLIP, title: "Stop Rambling", seg: 3, rung: "recall", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" }, heard: "a b c" };
const shOther = { kind: "challenge", ts: 1e12 + 2, vid: "SOMEOTHERVID", coverage: 0.9, pass: true, dims: {} };
const shWhisper = { kind: "challenge", ts: 1e12 + 3, vid: CLIP, coverage: 0.8, pass: true, pronMode: "whisper", dims: { pron: "good" } };
const shRetell = { kind: "chretell", ts: 1e12 + 4, vid: CLIP, rung: "retell", pass: true, heard: "in my own words" };
ok("A Challenge round on this competency's clip becomes linked supporting evidence",
  (() => { const x = ME.fromShadow(shChal, comp); return x && x.linked && x.rung === "recall" && x.score === 90 && x.passed; })());
ok("A round on a DIFFERENT clip is real work but is not evidence about this competency",
  ME.fromShadow(shOther, comp).linked === false);
ok("A whisper-mode round reports no comprehensibility rather than a fake one",
  ME.fromShadow(shWhisper, comp).pron === null);
ok("A retell round is recognised as the top rung even though its entry has no coverage",
  (() => { const x = ME.fromShadow(shRetell, comp); return x.rung === "retell" && x.score === null && x.passed; })());
ok("Junk is rejected rather than half-ingested", ME.fromShadow({}, comp) === null && ME.fromShadow({ ts: 1, kind: "nope" }, comp) === null);
/* the rung field this work added to the history writer */
const legacy = ME.fromShadow({ kind: "challenge", ts: 1e12 + 5, vid: CLIP, coverage: 0.7, pass: true, dims: {} }, comp);
ok("A history row written before the rung was recorded reports rung:null — not a guess", legacy.rung === null);

const S1 = run([[NO_IMPACT, "guided"]]);
[shChal, shRetell, shWhisper].forEach(e => ME.addSupport(S1.store, comp.id, ME.fromShadow(e, comp), "general-english"));
const dup = ME.addSupport(S1.store, comp.id, ME.fromShadow(shChal, comp), "general-english");
ok("Support is idempotent — the same history row cannot be ingested twice",
  dup.duplicate === true && S1.r.support.length === 3, String(S1.r.support.length));
const before = S1.r.state;
S1.r.state = ME.stateFrom(S1.r);
ok("Shadow support NEVER moves the competency state — shadowing is not giving an update",
  S1.r.state === before && S1.r.state === "PRACTICING", S1.r.state);
const sum1 = ME.progressSummary(S1.r, comp);
ok("It does fill comprehensibility the mission itself could not measure, and says where from",
  sum1.pron === 90 && sum1.pronSource === "shadow", JSON.stringify({ p: sum1.pron, s: sum1.pronSource }));
ok("…and reports the furthest rung reached on the clip",
  sum1.shadow.linked === 3 && sum1.shadow.rungName === "retell", JSON.stringify(sum1.shadow));
ok("Support is bounded", ME.MAX_SUPPORT === 20);
ok("Support is refused for any track but General English",
  ME.addSupport({}, comp.id, ME.fromShadow(shChal, comp), "welding") === null);

/* ═══════════════════ 5. AI COACH CONTEXT & BOUNDARY ═════════════════════ */
console.log("\n5 · AI COACH CONTEXT & BOUNDARY");
const ctx = ME.aiContext(B.r, comp, G, { weakness: "impact" });
const ctxJson = JSON.stringify(ctx);
ok("The AI context carries the task, the moves, the weakness and ONE previous summary",
  ctx.competency === "clear-update" && ctx.targetMoves.length === 4 && ctx.currentWeakness === "impact"
  && ctx.previousAttemptSummary && ctx.recentEvidence.attempts === 2);
ok("It does NOT carry the attempt history", !Array.isArray(ctx.attempts) && !ctxJson.includes("\"attempts\":["));
ok("It does NOT carry any previous transcript — only which moves landed",
  !ctxJson.includes(NO_IMPACT.slice(0, 40)) && !("said" in ctx.previousAttemptSummary));
ok("It does not carry the profile, the name or the state machine",
  !/profile|name|streak/i.test(ctxJson) && !("state" in ctx));
const prompt = ME.coachPrompt(ctx, "FENCE RULE");
ok("The prompt demands the exact shape the existing Worker route already returns",
  /"covered"/.test(prompt) && /"reply"/.test(prompt) && prompt.includes("FENCE RULE"));
ok("The prompt forbids accent judgement and multi-point correction reports",
  /never compare them to a native speaker/i.test(prompt) && /One improvement only/i.test(prompt));

/* the boundary itself */
const evAI = mk(NO_IMPACT, "guided", "ai1");
const evBefore = JSON.parse(JSON.stringify(evAI));
ME.applyCoachMoves(evAI, comp, ["impact"]);
ok("The model MAY add a move the cues missed", evAI.moves.impact === true && evAI.assisted === true);
const evRemove = mk(STRONG, "guided", "ai2");
ME.applyCoachMoves(evRemove, comp, []);
ok("The model CANNOT remove a move the learner made", evRemove.coverage === 1 && evRemove.moves.impact === true);
const evJunk = mk(NO_IMPACT, "guided", "ai3");
ME.applyCoachMoves(evJunk, comp, ["impact", "__proto__", "state", "passed", "not-a-move", 42, null]);
ok("Ids that are not rubric moves are discarded, including prototype and field names",
  Object.keys(evJunk.moves).sort().join() === MOVES.slice().sort().join() && evJunk.passed !== true || evJunk.coverage === 1,
  Object.keys(evJunk.moves).join());
ok("…and no non-move key reached the moves object",
  !("state" in evJunk.moves) && !("passed" in evJunk.moves) && !("not-a-move" in evJunk.moves));
const shaped = ME.shapeCoach({ reply: "x".repeat(900), covered: ["impact"], state: "STRONG", score: 100, passed: true }, comp, evAI);
ok("Model output is capped and cannot carry a state or a score into the app",
  shaped.improve.length <= 240 && !("state" in shaped) && !("score" in shaped) && !("passed" in shaped));
const stBefore = B.r.state;
ME.shapeCoach({ reply: "anything", covered: [] }, comp, evAI);
ok("Shaping coaching never touches the competency record", B.r.state === stBefore);
ok("With no model reply at all, deterministic coaching still names a real move and a real retry",
  (() => { const f = ME.shapeCoach(null, comp, mk(NO_IMPACT, "guided", "f1")); return f.move === "impact" && /deadline|date/i.test(f.retry) && f.ai === false; })());

/* ═══════════════════ 6. MEMORY: BOUNDS, IDEMPOTENCY ═════════════════════ */
console.log("\n6 · LEARNER MEMORY");
const many = {}; ME.introduce(many, comp.id, "general-english");
for (let i = 0; i < 80; i++) ME.addAttempt(many, comp.id, mk(STRONG, "guided", "m" + i, Date.now() + i), "general-english", IV, META);
ok("Attempt history is bounded", many[comp.id].attempts.length === 60, String(many[comp.id].attempts.length));
const idem = {}; ME.introduce(idem, comp.id, "general-english");
const r1 = ME.addAttempt(idem, comp.id, mk(STRONG, "guided", "same"), "general-english", IV, META);
const r2 = ME.addAttempt(idem, comp.id, mk(STRONG, "guided", "same"), "general-english", IV, META);
ok("One spoken turn can only ever become one row", !r1.duplicate && r2.duplicate && idem[comp.id].attempts.length === 1);
ok("A row with no key is still stored (never silently dropped)",
  (() => { const s = {}; ME.introduce(s, comp.id, "general-english"); ME.addAttempt(s, comp.id, Object.assign(mk(STRONG, "guided", null), { key: null }), "general-english", IV, META); return s[comp.id].attempts.length === 1; })());

/* ═══════════════════ 7. TRACK ISOLATION OF THE NEW SURFACES ═════════════ */
console.log("\n7 · TRACK ISOLATION (data level)");
ok("General English ships the v2_mission competency mapping",
  !!GEN.competencyConfig.activityMappings.v2_mission);
ok("Welding does NOT — it cannot log a V2 mission activity at all",
  !WELD.competencyConfig.activityMappings.v2_mission);
ok("The engine's track is a constant, not read from state", ME.TRACK === "general-english");

/* NEVER_INHERIT is deliberately ONE key. The audit found three legacy leaks in
   the curriculum merge — Welding inherits General English's shadow starters,
   its review checkpoints and its month dashboards because its own files are
   empty. V2.1 was told not to "fix" those, because doing so would silently
   change shipped Welding behaviour. These assertions pin the legacy state, so
   that closing any of them later is a visible, deliberate change rather than a
   side effect of some other work. */
const PT = readFileSync(ROOT + "professional-tracks.js", "utf8");
const niKeys = (PT.match(/NEVER_INHERIT\s*=\s*new Set\(\[([^\]]*)\]\)/) || [, ""])[1]
  .split(",").map(x => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
ok("NEVER_INHERIT covers exactly the one section V2 added, and was not quietly widened",
  niKeys.join() === "missions", niKeys.join());
const WSH = JSON.parse(readFileSync(ROOT + "tracks/welding/shadow.json", "utf8"));
ok("LEGACY, unchanged: Welding still inherits General English shadow starters (audit risk 1)",
  WSH.starters.length === 0 && WSH.resources.length === 0);
ok("LEGACY, unchanged: Welding still inherits General English review checkpoints and month dashboards (audit risk 2)",
  WELD.reviewCheckpoints.length === 0 && Object.keys(WELD.monthMetrics).length === 0);
ok("V2 added no new inheritable content section — Welding ships no missions.json",
  !(() => { try { readFileSync(ROOT + "tracks/welding/missions.json"); return true; } catch (e) { return false; } })());
ok("Every write entry point refuses a non-General-English area",
  ME.addAttempt({}, comp.id, mk(STRONG, "guided", "x"), "welding", IV, META) === null
  && ME.introduce({}, comp.id, "welding") === null
  && ME.addSupport({}, comp.id, ME.fromShadow(shChal, comp), "welding") === null);

/* ═══════════════════ 8. BROWSER: INTEGRATION IN THE APP ═════════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8031, 8032, 8033, 8034, 8035]) {
    const s = spawn("python3", ["-m", "http.server", String(port)], { cwd: ROOT, stdio: "ignore" });
    await sleep(700);
    let served = null;
    try { served = await (await fetch(`http://localhost:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://localhost:${port}`; break; }
    s.kill(); console.log(`  (port ${port} is serving another tree — next)`);
  }
  if (!BASE) { console.error("no free port; pass BASE="); process.exit(1); }
}
console.log("  serving: " + BASE + "\n8 · IN THE APP");

const POLISH = "https://be-polish.nore-ngou.workers.dev";
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
let coachCovered = [];

async function learner(id, track) {
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  await ctx2.addInitScript(({ track }) => {
    class F {
      constructor() { this._t = null; }
      _fire() { const t = window.__say || ""; if (t && this.onresult) { const r = [{ 0: { transcript: t }, isFinal: true, length: 1 }]; r.length = 1; this.onresult({ results: r, resultIndex: 0 }); } }
      _end() { this._on = false; if (this._t) clearTimeout(this._t); if (this.onend) setTimeout(() => { try { this.onend(); } catch (e) {} }, 0); }
      start() { this._on = true; this._t = setTimeout(() => { if (!this._on) return; this._fire(); this._end(); }, 120); }
      stop() { if (this._on) this._fire(); this._end(); } abort() { this._on = false; this._end(); }
    }
    window.SpeechRecognition = F; window.webkitSpeechRecognition = F;
    localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "T", lang: "en", goal: "Speak with confidence in meetings", ts: Date.now() },
      professionalTracks: { activeId: track },
      fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} }, "welding": { placed: "full", finished: true, day: 15, done: {} } },
      days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() }));
  }, { track });
  await ctx2.route(u => u.href.startsWith(POLISH), async route => {
    let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (b.assess) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ overall: 84, mode: "ai", words: [{ word: "a", score: 84 }] }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Say what the delay means for Friday.", covered: coachCovered }) });
  });
  const page = await ctx2.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?i=" + Date.now(), { waitUntil: "load" });
  await sleep(1000);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov").forEach(e => e.remove()));
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

const L = await learner("ge", "general-english");
coachCovered = ["status", "issue", "next"];
await L.page.evaluate(() => { window.__ev = []; const t0 = window.track; window.track = (n, p) => { window.__ev.push([n, p || {}]); return t0 && t0(n, p); }; });
await L.page.evaluate(() => mvGo("clear-update-guided", "speak")); await sleep(300);
await speak(L.page, NO_IMPACT);

/* --- the Home coach card now speaks for the competency --- */
const coach = await L.page.evaluate(() => {
  const a = AdaptiveLearningEngine.recommendation(S, ProfessionalTrackContext.active());
  const m = LearningCoach.mission(S, ProfessionalTrackContext.active());
  return { a, m, card: (() => { go("home"); const c = document.querySelector(".coach-card"); return c ? c.innerText.replace(/\s+/g, " ") : null; })() };
});
ok("AdaptiveLearningEngine now answers with the competency's own evidence",
  coach.a.v2 === true && /Impact/i.test(coach.a.body || ""), JSON.stringify(coach.a));
ok("LearningCoach passes the mission and step through so the card opens the right place",
  coach.m.v2 === true && coach.m.go === "mission" && coach.m.arg1 === "clear-update-guided", JSON.stringify(coach.m));

/* --- the Progress page shows real evidence, not an empty workshop list --- */
const prog = await L.page.evaluate(() => {
  go("review"); const p = document.querySelector(".pg-v2");
  return { panel: !!p, txt: p ? p.innerText.replace(/\s+/g, " ") : "", hook: !!window.v2Evidence(), state: window.v2Evidence().state };
});
ok("The Progress page renders the V2 evidence panel for a General English learner",
  prog.panel && /Practising/i.test(prog.txt) && prog.state === "PRACTICING", prog.txt.slice(0, 120));
ok("…and it reports the move that is missing rather than a participation score",
  /Impact 0\/1/.test(prog.txt), prog.txt.slice(0, 200));

/* --- the competency log is no longer a flat counter --- */
const logs = await L.page.evaluate(() => CompetencyEngine.state(S).logs.map(l => ({ t: l.activityType, s: l.score })));
ok("A failed attempt writes V2 evidence but NO competency-log points",
  logs.filter(l => l.t === "v2_mission").length === 0 && logs.filter(l => l.t === "professional_coach").length === 0,
  JSON.stringify(logs));
coachCovered = ["status", "issue", "impact", "next"];
await L.page.evaluate(() => { mvRetry(); }); await sleep(200);
await speak(L.page, STRONG);
const logs2 = await L.page.evaluate(() => CompetencyEngine.state(S).logs.map(l => ({ t: l.activityType, s: l.score })));
ok("A passing attempt logs under its own activity type, carrying the real coverage",
  logs2.filter(l => l.t === "v2_mission").length === 1 && logs2.find(l => l.t === "v2_mission").s === 100, JSON.stringify(logs2));

/* --- Shadow → V2, in the app --- */
const sh = await L.page.evaluate((vid) => {
  aList("chHist").unshift({ kind: "challenge", ts: Date.now(), vid, title: "clip", seg: 2, rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" }, heard: "x y z", issues: [], drills: [] });
  aList("chHist").unshift({ kind: "challenge", ts: Date.now() + 1, vid: "OTHERCLIP", coverage: 0.9, pass: true, dims: {}, issues: [], drills: [] });
  save();
  const n = mvHarvestShadow();
  const again = mvHarvestShadow();
  const d = window.v2Evidence();
  return { n, again, linked: d.shadow.linked, rung: d.shadow.rungName, pron: d.pron, src: d.pronSource, state: d.state };
}, comp.shadow.vid);
ok("Shadow work on the competency's clip is harvested into V2 evidence",
  sh.n === 1 && sh.linked === 1 && sh.rung === "blind", JSON.stringify(sh));
ok("Harvesting twice adds nothing — it is idempotent on the history row", sh.again === 0);
ok("Work on another clip is not counted as this competency's evidence", sh.linked === 1);
ok("Shadow evidence did not move the competency state", sh.state === "DEMONSTRATED", sh.state);

/* --- V1 / V2 coexistence --- */
const co = await L.page.evaluate(() => {
  go("home");
  const cards = [...document.querySelectorAll("#v-home .card")];
  const mvIdx = cards.findIndex(c => c.classList.contains("mv-home"));
  const v1Idx = cards.findIndex(c => c.classList.contains("today-card"));
  const before = { days: JSON.stringify(S.days), v2: JSON.stringify(S.v2A) };
  /* complete a V1 session day and prove it cannot touch V2 evidence */
  toggleDay(dayKey(1, "Mon"), 1, "Mon");
  const after = { days: JSON.stringify(S.days), v2: JSON.stringify(S.v2A) };
  return { mvIdx, v1Idx, v2Unchanged: before.v2 === after.v2, daysChanged: before.days !== after.days,
    v1State: !!S.days[dayKey(1, "Mon")], v2State: (mvStore()["clear-update"] || {}).state };
});
ok("When the mission has an open question it leads; the 12-week card follows",
  co.mvIdx >= 0 && co.v1Idx >= 0 && co.mvIdx < co.v1Idx, JSON.stringify({ mv: co.mvIdx, v1: co.v1Idx }));
ok("Completing a V1 session cannot alter V2 evidence — they are separate stores",
  co.v2Unchanged && co.daysChanged && co.v1State === true, JSON.stringify(co));
const evNames = await L.page.evaluate(() => (window.__ev || []).map(e => e[0]));
ok("V1 and V2 do not emit each other's completion events",
  evNames.includes("v2_evidence_recorded") && evNames.filter(n => n === "session_complete").length === 1,
  JSON.stringify(evNames.filter(n => /complete|evidence/.test(n))));

/* --- Foundations comes before Week 3 --- */
const gate = await L.page.evaluate(async () => {
  const f = fndState(); const keep = JSON.parse(JSON.stringify(f));
  delete f.placed; delete f.checkedAt; delete f.finished; save();
  go("home"); await new Promise(r => setTimeout(r, 400));
  const cards = [...document.getElementById("v-home").querySelectorAll(":scope > .card, :scope > section.card, :scope > button.card")].map(c => c.className);
  const card = !!document.querySelector(".mv-home");
  go("mission", "clear-update-guided", "speak"); await new Promise(r => setTimeout(r, 400));
  const gated = !!document.querySelector("#v-mission .fnd-gate, #v-mission .card") && !document.querySelector("#v-mission .mv-speak");
  Object.assign(fndState(), keep); save();
  return { first: cards[0] || "", card, gated };
});
ok("An unplaced learner is not offered the Week 3 mission — the placement check stays the first card",
  /fnd-home/.test(gate.first) && gate.card === false, JSON.stringify(gate));
ok("…and cannot reach it by route either: the mission renders the Foundations gate, like the daily session",
  gate.gated === true, JSON.stringify(gate));

/* --- Welding sees none of it --- */
const W = await learner("weld", "welding");
const w = await W.page.evaluate((vid) => {
  aList("chHist").unshift({ kind: "challenge", ts: Date.now(), vid, title: "clip", rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" }, issues: [], drills: [] });
  save();
  const harvested = (typeof mvHarvestShadow === "function") ? mvHarvestShadow() : "nofn";
  const before = JSON.stringify(S.v2A || {});
  const ev = window.v2Evidence();
  const rec = window.v2Recommendation();
  go("review");
  const panel = !!document.querySelector(".pg-v2");
  const adaptive = AdaptiveLearningEngine.recommendation(S, ProfessionalTrackContext.active());
  return { harvested, ev, rec, panel, v2Unchanged: JSON.stringify(S.v2A || {}) === before, adaptiveV2: !!adaptive.v2, area: areaId() };
}, comp.shadow.vid);
ok("A Welding learner shadowing the SAME clip generates no General English evidence",
  w.area === "welding" && w.harvested === 0 && w.v2Unchanged, JSON.stringify(w));
ok("Both hooks return null on Welding", w.ev === null && w.rec === null);
ok("The Welding Progress page shows no V2 panel", w.panel === false);
ok("The Welding adaptive recommendation is untouched by V2", w.adaptiveV2 === false);

ok("No uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
