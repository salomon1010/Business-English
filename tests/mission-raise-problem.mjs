/* BE Mastery V2.3 — General English Week 3 "Raise a problem", end to end,
   and the data-only proof.

   Week 3 is the THIRD competency and it arrived as one entry in
   tracks/general/missions.json. This suite is the claim that nothing else had
   to change: the engine, the evidence contract, the state machine, the
   recommendation, the coach boundary, the Home card, the Progress panel and
   the Welding wall all behave for a competency they had never seen.

   Canonical numbering (V2.3): the `week` of a competency is the General
   English programme week it teaches — "Explain what you do" is Week 1, "Give
   a clear update" is Week 2, "Raise a problem" is Week 3. See the _note in
   missions.json.

   Run:  cd tests && node mission-raise-problem.mjs
         SHOTS=/some/dir node mission-raise-problem.mjs   (also saves screenshots) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const ME = require("../mission-engine.js");
const ROOT = new URL("..", import.meta.url).pathname;
const PACK = JSON.parse(readFileSync(ROOT + "tracks/general/missions.json", "utf8"));
const SHOTS = process.env.SHOTS || null;

const res = [];
const ok = (n, c, d = "") => { res.push({ name: n, pass: !!c }); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };

const W1 = ME.competencyOf(PACK, "explain-work");
const W2 = ME.competencyOf(PACK, "clear-update");
const W3 = ME.competencyOf(PACK, "raise-problem");
const G1 = ME.missionOf(W1, "explain-work-guided"), T1 = ME.missionOf(W1, "explain-work-transfer");
const G2 = ME.missionOf(W2, "clear-update-guided"), T2 = ME.missionOf(W2, "clear-update-transfer");
const G3 = ME.missionOf(W3, "raise-problem-guided"), T3 = ME.missionOf(W3, "raise-problem-transfer");
const IV = [1, 3, 7, 21, 60];
const GE = "general-english";
const meta = c => ({ competency: c.id, week: c.week, moveIds: ME.moveIds(c) });
const mk = (c, m, text, kind, key, at) => Object.assign(ME.grade(c, m, text, { seconds: 27 }),
  { key, kind, at: at || Date.now(), missionId: m.id });

/* ── what the learners will say ──────────────────────────────────────────── */
const SAY = {
  strong: G3.hear.model,
  /* the move almost everyone leaves out is the ask — and this leaves it out */
  noAsk: "We have got a problem with the delivery. It started when the supplier changed the order number. This means we would finish three days late. I have already spoken to their office.",
  transfer: "There is a problem with the monthly figures. It started when the old report was switched off in August, so two months of numbers may be wrong. This means the Thursday board pack is at risk. I have spoken to finance and asked them to rerun the numbers. Could you sign off on a one-day delay so we can check them?",
  short: "It's broken.",
  w1strong: G1.hear.model,
  w1noWhy: "I work as an operations analyst in the logistics team. I'm responsible for the weekly delivery reports. At the moment I'm rebuilding how we track late shipments. I work closely with the warehouse managers.",
  w1transfer: "I am a project coordinator on the delivery team. I look after the schedule and the supplier paperwork for your account. Right now I am preparing the plan for your first shipment. I work closely with our warehouse and your logistics contact, so that nothing on your side has to be chased by hand.",
  w2strong: "The project is on track and we have completed two stages. We have run into an issue with the design agency. This means Friday delivery is at risk by about two days. I will chase it up today and come back to you tomorrow.",
  w2weak: "The project is on track. We have run into a supplier issue. I will chase it up and let you know tomorrow.",
  w2transfer: "Installation is due to start on Monday and everything else is ready. The materials from the supplier arrived three days late. That means we will push back the handover and the end of month promise is at risk. I will confirm a new date with the customer and come back to you this afternoon.",
};

/* ═══════════ THE CONTENT ITSELF ═════════════════════════════════════════ */
console.log("\nWEEK 3 · THE COMPETENCY");
ok("Week 3 exists, is numbered 3, and is 'Raise a problem' with five moves and two missions",
  W3 && W3.week === 3 && /raise a problem/i.test(W3.title) && ME.moveIds(W3).join() === "issue,cause,impact,mitigate,ask" && W3.missions.length === 2,
  W3 && ME.moveIds(W3).join());
/* V2.4 added Week 4 ("Clarifying, asking questions & confirming") as one more
   entry. The numbering claim is unchanged: consecutive from 1, no gaps, no
   duplicates — whatever the count. */
ok("The canonical numbering holds: explain-work=1, clear-update=2, raise-problem=3, then consecutive — no gaps, no duplicates",
  PACK.competencies.map(c => c.week).join() === PACK.competencies.map((_, i) => i + 1).join() && W1.week === 1 && W2.week === 2 && W3.week === 3);
ok("Every Week 3 move has an id, a label, a hint, phrase cues, a retry and patterns",
  W3.moves.every(m => m.id && m.label && m.hint && Array.isArray(m.cues) && m.cues.length && m.retry && Array.isArray(m.patterns) && m.patterns.length));
ok("Every Week 3 expression is tagged to a move that exists",
  W3.expressions.length >= 6 && W3.expressions.every(e => ME.moveIds(W3).includes(e.move) && e.w && e.def && e.l));
ok("The guided and transfer missions are different situations with different askers",
  G3.kind === "guided" && T3.kind === "transfer" && G3.prompt !== T3.prompt && G3.see.who !== T3.see.who && !T3.hear);
const gm = ME.grade(W3, G3, SAY.strong, { seconds: 30 });
ok("The model answer makes all five moves on its own rubric — the content agrees with the engine",
  gm.coverage === 1 && ME.passes(gm), "missed=" + gm.missed.join());
ok("An answer with everything but the ask is 0.8, does not pass, and the ask is the weakest move",
  (() => { const e = ME.grade(W3, G3, SAY.noAsk, { seconds: 20 }); return e.coverage === 0.8 && !ME.passes(e) && ME.weakestMove(W3, e, []) === "ask"; })());
ok("The transfer fixture makes all five moves cold", ME.grade(W3, T3, SAY.transfer, { seconds: 30 }).coverage === 1,
  "missed=" + ME.grade(W3, T3, SAY.transfer, { seconds: 30 }).missed.join());
ok("'We've already lost two days' is NOT credited as handling the problem — the cue trap named in the pack",
  ME.grade(W3, G3, "We have got a problem with the parts. It started when the supplier changed our order. We have already lost two days on this. Could you approve the courier?", { seconds: 20 }).moves.mitigate === false);
ok("'because it affects Friday' is NOT credited as a cause",
  ME.grade(W3, G3, "There is a problem with the parts. I am raising it because it affects Friday. Would you mind chasing them?", { seconds: 15 }).moves.cause === false);
ok("Two words is not an answer", !ME.grade(W3, G3, SAY.short, { seconds: 2 }).answered);

/* ═══════════ G · THREE MOVE COUNTS, ONE ENGINE — and any count at all ═══ */
console.log("\nG · MOVE COUNTS ARE DATA");
ok("Three competencies, three declared shapes: 5 / 4 / 5 — read from data",
  ME.moveIds(W1).length === 5 && ME.moveIds(W2).length === 4 && ME.moveIds(W3).length === 5);
/* The curriculum's own shape for Week 3 is five moves, the same count as
   Week 1. Rather than pad the content to manufacture a third number, the
   arity claim is tested directly: a competency with three moves and one with
   seven, built in memory, must grade, pass, fail and be coached by the same
   rules. If either breaks, the engine knows a number it should not. */
const synth = (id, n) => ({ id, week: 90 + n, title: id, objective: "o", pattern: Array.from({ length: n }, (_, i) => "M" + i).join(" → "),
  moves: Array.from({ length: n }, (_, i) => ({ id: "m" + i, label: "Move " + i, hint: "h" + i, retry: "again " + i, patterns: [], cues: ["signal " + ["zero", "one", "two", "three", "four", "five", "six"][i] + " here"] })),
  expressions: [], missions: [{ id: id + "-guided", kind: "guided", prompt: "q", hear: { model: "" }, see: {} }, { id: id + "-transfer", kind: "transfer", prompt: "q2", see: {} }] });
const S3 = synth("three", 3), S7 = synth("seven", 7);
const say = (n, skip) => Array.from({ length: n }, (_, i) => i === skip ? "" : "Signal " + ["zero", "one", "two", "three", "four", "five", "six"][i] + " here, and more words.").filter(Boolean).join(" ");
const s3ev = ME.grade(S3, S3.missions[0], say(3), { seconds: 10 }), s7ev = ME.grade(S7, S7.missions[0], say(7), { seconds: 20 });
ok("A 3-move and a 7-move competency both grade to full coverage and pass",
  s3ev.coverage === 1 && ME.passes(s3ev) && Object.keys(s3ev.moves).length === 3 && s7ev.coverage === 1 && ME.passes(s7ev) && Object.keys(s7ev.moves).length === 7,
  `3:${s3ev.coverage} 7:${s7ev.coverage}`);
const s7w = ME.grade(S7, S7.missions[0], say(7, 4), { seconds: 20 });
ok("Six of seven does not pass, and the missing move is named — the bar is every move, whatever the count",
  Math.abs(s7w.coverage - 6 / 7) < 1e-9 && !ME.passes(s7w) && ME.weakestMove(S7, s7w, []) === "m4");
ok("The coach prompt states 3 and 7 from the rubric, never a number typed into the engine",
  /makes 3 communication/.test(ME.coachPrompt(ME.aiContext(ME.blank("three"), S3, S3.missions[0], {}), "")) && /makes 7 communication/.test(ME.coachPrompt(ME.aiContext(ME.blank("seven"), S7, S7.missions[0], {}), "")));
ok("Deterministic coaching for a 7-move competency names the 7th move's own retry line",
  (() => { const f = ME.shapeCoach(null, S7, ME.grade(S7, S7.missions[0], say(7, 6), { seconds: 20 })); return f.move === "m6" && f.retry === "again 6" && f.ai === false; })());
ok("The state machine reaches STRONG for a 3-move competency on the same rule",
  (() => { const s = {}; ME.introduce(s, "three", GE);
    ME.addAttempt(s, "three", Object.assign(s3ev, { key: "a", kind: "guided", missionId: "three-guided", at: 1e12 }), GE, IV, meta(S3));
    ME.addAttempt(s, "three", Object.assign(ME.grade(S3, S3.missions[1], say(3), { seconds: 10 }), { key: "b", kind: "transfer", missionId: "three-transfer", at: 1e12 + 1 }), GE, IV, meta(S3));
    ME.addAttempt(s, "three", Object.assign(ME.grade(S3, S3.missions[1], say(3), { seconds: 10 }), { key: "c", kind: "transfer", missionId: "three-transfer", at: 1e12 + 2 * 86400000 }), GE, IV, meta(S3));
    return s.three.state === "STRONG"; })());

/* ═══════════ 8 · THE EVIDENCE CONTRACT, UNCHANGED ═══════════════════════ */
console.log("\n8 · EVIDENCE");
const row = ME.contract(mk(W3, G3, SAY.noAsk, "guided", "k1"), meta(W3));
ok("A Week 3 row is the same v1 contract: versioned, track-stamped, week 3, competency, mission, kind, key",
  row.v === ME.EVIDENCE_VERSION && row.tk === GE && row.week === 3 && row.competency === "raise-problem" && row.missionId === "raise-problem-guided" && row.kind === "guided" && row.key === "k1");
ok("Its moves map holds exactly the five Week 3 ids, as booleans",
  Object.keys(row.moves).join() === "issue,cause,impact,mitigate,ask" && Object.values(row.moves).every(v => typeof v === "boolean") && row.moves.ask === false);
ok("Task, clarity, fluency and vocabulary are measured numbers in [0,1] with a stated clarity basis",
  [row.task, row.clarity, row.fluency, row.vocab].every(x => typeof x === "number" && x >= 0 && x <= 1) && ["order", "order+length"].includes(row.clarityBasis));
ok("Pronunciation was not measured and is null — never zero", row.pron === null && row.pronSource === null);
ok("Transfer is null on a guided attempt and a boolean on a transfer attempt",
  row.transfer === null && typeof ME.contract(mk(W3, T3, SAY.transfer, "transfer", "k2"), meta(W3)).transfer === "boolean");
ok("With no duration, seconds and wpm are null, not 0",
  (() => { const r = ME.contract(Object.assign(ME.grade(W3, G3, SAY.strong, {}), { key: "k3", kind: "guided" }), meta(W3)); return r.seconds === null && r.wpm === null; })());
ok("Verdict, passed and weakness derive from coverage", row.verdict === "strong" && row.passed === false && row.coverage === 0.8);
ok("Vocabulary used lists only the competency's own expressions",
  (() => { const r = ME.grade(W3, G3, "There is a problem. I want to flag an issue: in the meantime we have a workaround. Would you mind signing off on it?", { seconds: 12 }); return r.vocabUsed.every(w => W3.expressions.some(e => e.w === w)) && r.vocabUsed.length >= 2; })());

/* ═══════════ 9 · PROGRESSION: THE SAME LADDER ═══════════════════════════ */
console.log("\n9 · PROGRESSION");
const L3 = {};
const D = 86400000, T0 = Date.parse("2026-09-01T10:00:00Z");
ok("NOT_STARTED before anything", ME.record(L3, W3.id).state === "NOT_STARTED");
ME.introduce(L3, W3.id, GE, T0);
ok("SEE/HEAR/NOTICE → INTRODUCED and no further", L3[W3.id].state === "INTRODUCED");
ME.addAttempt(L3, W3.id, mk(W3, G3, SAY.noAsk, "guided", "p1", T0 + 60000), GE, IV, meta(W3));
ok("A weak spoken attempt → PRACTICING, with retrieval due now for reason 'practice'",
  L3[W3.id].state === "PRACTICING" && L3[W3.id].retrieval.reason === "practice");
ME.addAttempt(L3, W3.id, mk(W3, G3, SAY.strong, "retry", "p2", T0 + 120000), GE, IV, meta(W3));
ok("A full guided answer → DEMONSTRATED, and stops there", L3[W3.id].state === "DEMONSTRATED" && L3[W3.id].retrieval.reason === "transfer");
ME.addAttempt(L3, W3.id, mk(W3, T3, SAY.transfer, "transfer", "p3", T0 + 180000), GE, IV, meta(W3));
ok("One cold success → TRANSFER_READY with a spaced retrieval", L3[W3.id].state === "TRANSFER_READY" && L3[W3.id].transfer.passed === 1 && L3[W3.id].retrieval.due > T0 + 180000);
ME.addAttempt(L3, W3.id, mk(W3, T3, SAY.transfer, "transfer", "p4", T0 + 200000), GE, IV, meta(W3));
ok("A second cold success the SAME day is still TRANSFER_READY", L3[W3.id].state === "TRANSFER_READY" && L3[W3.id].transfer.passed === 2);
ME.addAttempt(L3, W3.id, mk(W3, T3, SAY.transfer, "transfer", "p5", T0 + 2 * D), GE, IV, meta(W3));
ok("A cold success on another day → STRONG", L3[W3.id].state === "STRONG");
ok("A failed transfer counts against the tally and never fabricates a pass",
  (() => { const s = {}; ME.introduce(s, W3.id, GE); ME.addAttempt(s, W3.id, mk(W3, G3, SAY.strong, "guided", "f1"), GE, IV, meta(W3));
    ME.addAttempt(s, W3.id, mk(W3, T3, SAY.noAsk, "transfer", "f2"), GE, IV, meta(W3));
    return s[W3.id].state === "DEMONSTRATED" && s[W3.id].transfer.failed === 1 && s[W3.id].transfer.passed === 0 && ME.recommend(s[W3.id], W3).reason === "transfer_failed"; })());

/* ═══════════ 10 · MEMORY: THREE COMPETENCIES, ONE STORE ═════════════════ */
console.log("\n10 · LEARNER MEMORY — competency isolation");
const st = {};
const put = (s, c, m, txt, kind, key, at) => { ME.introduce(s, c.id, GE); return ME.addAttempt(s, c.id, mk(c, m, txt, kind, key, at), GE, IV, meta(c)); };
put(st, W1, G1, SAY.w1noWhy, "guided", "x1");
put(st, W2, G2, SAY.w2strong, "guided", "x2");
const snap = () => JSON.stringify({ a: st[W1.id], b: st[W2.id] });
const before3 = snap();
put(st, W3, G3, SAY.noAsk, "guided", "x3");
ok("A Week 3 attempt changes neither Week 1 nor Week 2", snap() === before3 && st[W3.id].state === "PRACTICING");
const before1 = JSON.stringify({ b: st[W2.id], c: st[W3.id] });
put(st, W1, G1, SAY.w1strong, "retry", "x4");
ok("A Week 1 attempt changes neither Week 2 nor Week 3", JSON.stringify({ b: st[W2.id], c: st[W3.id] }) === before1 && st[W1.id].state === "DEMONSTRATED");
const before2 = JSON.stringify({ a: st[W1.id], c: st[W3.id] });
put(st, W2, G2, SAY.w2weak, "guided", "x5");
ok("A Week 2 attempt changes neither Week 1 nor Week 3", JSON.stringify({ a: st[W1.id], c: st[W3.id] }) === before2);
ok("Three records, keyed by competency id — never by week", Object.keys(st).sort().join() === "clear-update,explain-work,raise-problem");
ok("The same idempotency key in three competencies is three rows, one each",
  (() => { const s = {}; put(s, W1, G1, SAY.w1strong, "guided", "same"); put(s, W2, G2, SAY.w2strong, "guided", "same"); const r = put(s, W3, G3, SAY.strong, "guided", "same");
    return !r.duplicate && [W1, W2, W3].every(c => s[c.id].attempts.length === 1); })());
ok("…and the same key twice in Week 3 is one row", (() => { const s = {}; put(s, W3, G3, SAY.strong, "guided", "dup"); return put(s, W3, G3, SAY.strong, "guided", "dup").duplicate && s[W3.id].attempts.length === 1; })());
ok("Week 3 attempts are bounded at 60", (() => { const s = {}; for (let i = 0; i < 70; i++) put(s, W3, G3, SAY.strong, "guided", "b" + i, T0 + i); return s[W3.id].attempts.length === 60; })());
ok("The engine refuses a Week 3 write for any area but General English — and does not create a record",
  (() => { const s = {}; return ME.addAttempt(s, W3.id, mk(W3, G3, SAY.strong, "guided", "w"), "welding", IV, meta(W3)) === null && ME.introduce(s, W3.id, "welding") === null && Object.keys(s).length === 0; })());

/* ═══════════ 11 · RETRIEVAL ACROSS THREE COMPETENCIES ═══════════════════ */
console.log("\n11 · CROSS-COMPETENCY RECOMMENDATION");
const comps = PACK.competencies;
const pick = s => ME.pickNext(comps, id => s[id], Date.now());
const show = p => p ? `${p.comp.id}:${p.rec.action}:${p.rec.move || "-"}` : "null";
let A = {}; put(A, W1, G1, SAY.w1noWhy, "guided", "a1");
ok("Week 1 weak → Week 1 retry on 'why'", show(pick(A)) === "explain-work:retry:why", show(pick(A)));
let B = {}; put(B, W2, G2, SAY.w2weak, "guided", "b1");
ok("Week 2 weak → Week 2 retry on 'impact' — the earlier, untouched week does not win by default", show(pick(B)) === "clear-update:retry:impact", show(pick(B)));
let C = {}; put(C, W3, G3, SAY.noAsk, "guided", "c1");
ok("Week 3 weak → Week 3 retry on 'ask' — nor does the latest week win by default", show(pick(C)) === "raise-problem:retry:ask", show(pick(C)));
let Dd = {}; put(Dd, W3, G3, SAY.strong, "guided", "d1"); put(Dd, W3, T3, SAY.transfer, "transfer", "d2");
ok("Week 3 transfer-ready and resting → the learner is offered Week 1 to speak, the lowest unspoken week", show(pick(Dd)) === "explain-work:speak:-", show(pick(Dd)));
let E = {}; put(E, W1, G1, SAY.w1strong, "guided", "e1"); put(E, W3, G3, SAY.noAsk, "guided", "e2");
ok("A Week 3 weak move outranks a Week 1 pending transfer — evidence priority, not week order", show(pick(E)) === "raise-problem:retry:ask", show(pick(E)));
let F = {}; put(F, W1, G1, SAY.w1noWhy, "guided", "f1"); put(F, W3, G3, SAY.noAsk, "guided", "f2");
ok("Two equally urgent retries → the earlier week, and only as a tie-break", show(pick(F)) === "explain-work:retry:why", show(pick(F)));
let Fb = {}; put(Fb, W2, G2, SAY.w2weak, "guided", "g1"); put(Fb, W3, G3, SAY.noAsk, "guided", "g2");
ok("…Week 2 vs Week 3 equally urgent → Week 2", show(pick(Fb)) === "clear-update:retry:impact", show(pick(Fb)));
let H = {};
put(H, W1, G1, SAY.w1strong, "guided", "h1"); put(H, W1, T1, SAY.w1transfer, "transfer", "h2");
put(H, W2, G2, SAY.w2strong, "guided", "h3"); put(H, W2, T2, SAY.w2transfer, "transfer", "h4");
put(H, W3, G3, SAY.strong, "guided", "h5"); put(H, W3, T3, SAY.transfer, "transfer", "h6");
/* V2.4: a fourth competency ("Clarifying, asking questions & confirming",
   Week 4) now sits in the pack. With the first three resting the engine offers
   it — a competency nobody has spoken for is never skipped — and only when
   EVERY competency rests is nothing pushed. Same shape as the Week 2 suite. */
const W4c = ME.competencyOf(PACK, "clarify-confirm");
ok("All three transfer-ready → the fourth competency is offered to speak, not skipped",
  W4c && pick(H) && pick(H).comp.id === "clarify-confirm" && pick(H).rec.action === "speak", show(pick(H)));
put(H, W4c, ME.missionOf(W4c, "clarify-confirm-guided"), ME.missionOf(W4c, "clarify-confirm-guided").hear.model, "guided", "h7");
put(H, W4c, ME.missionOf(W4c, "clarify-confirm-transfer"), "Sorry, I'm not sure I follow — the client thing could be two things. Are you asking about the revised quote or the delivery date they wanted? So you're saying it's the quote they're expecting before Wednesday's review. Then I'll send the quote today and come back to you tomorrow on the delivery date — does that work?", "transfer", "h8");
/* V2.5: a fifth competency ("Explaining technical work to non-technical
   stakeholders", Week 5). Same rule, one more entry. */
const W5c = ME.competencyOf(PACK, "explain-tech");
ok("All four transfer-ready → the fifth competency is offered to speak, not skipped",
  W5c && pick(H) && pick(H).comp.id === "explain-tech" && pick(H).rec.action === "speak", show(pick(H)));
put(H, W5c, ME.missionOf(W5c, "explain-tech-guided"), ME.missionOf(W5c, "explain-tech-guided").hear.model, "guided", "h9");
put(H, W5c, ME.missionOf(W5c, "explain-tech-transfer"), "In plain terms, the integration is a link between their shop and our warehouse. The way it works is that every time a customer places an order, it goes straight to the warehouse system automatically, instead of someone typing it in each morning. What this means for the client is that orders ship the same day and the typing mistakes stop. The one thing to remember is that returns aren't included yet — those are still done by hand. Does that make sense?", "transfer", "h10");
/* V2.6/V2.7: every competency after Week 5, in week order, from a per-id
   cold-transfer fixture map. A new week adds one entry, not a new block. */
const LATER_TRANSFERS = {
  "recommend-decide": "There are two options here. One option is to send it tomorrow with the numbers corrected by hand, and the other option is to hold it for two days and rerun everything from the fixed source. My recommendation is to hold it. The reason is that last quarter they complained about a wrong figure, and two of the twelve charts can't be checked in time if we send tomorrow. The downside is that it's the first late report we've ever sent them. So the next step is that you tell the client today that it's coming on Thursday, and I'll rerun it as soon as the source is fixed.",
  "disagree-pushback": "I understand why the director wants one go \u2014 a phased move takes longer, and nobody wants this dragging into next year. I'd push back on doing the whole warehouse in one weekend, though. The reason is the pilot: at the small depot the switch took two weeks to settle, forty stock counts were wrong in the first week, and the main warehouse holds twenty times the stock. What I'd suggest is that we switch the night team first, since they're already trained, and bring the day shifts across two weeks later. We both want this done before December, and that way we still finish by the end of November without a weekend where nothing can be counted. What would the director need to see to agree to that?",
};
const LATER = PACK.competencies.filter(c => c.week > 5).sort((a, b) => a.week - b.week);
ok("Every competency after Week 5 has a cold-transfer fixture in this suite", LATER.length >= 1 && LATER.every(c => typeof LATER_TRANSFERS[c.id] === "string"), LATER.map(c => c.id).join());
LATER.forEach(c => {
  ok(`Everything before it transfer-ready → ${c.id} (Week ${c.week}) is offered to speak, not skipped`, pick(H) && pick(H).comp.id === c.id && pick(H).rec.action === "speak", show(pick(H)));
  const g = c.missions.find(m => m.kind === "guided"), t = c.missions.find(m => m.kind === "transfer");
  put(H, c, g, g.hear.model, "guided", "hg" + c.week); put(H, c, t, LATER_TRANSFERS[c.id], "transfer", "ht" + c.week);
});
ok("Every competency transfer-ready → nothing is pushed; the old advice stands", pick(H) === null, show(pick(H)));
ok("Pending coaching on Week 3 outranks everything, including a Week 1 retry",
  (() => { const s = {}; put(s, W1, G1, SAY.w1noWhy, "guided", "i1"); const r = put(s, W3, G3, SAY.noAsk, "guided", "i2"); r.attempt.coachPending = true; return show(pick(s)) === "raise-problem:coach:ask"; })());

/* ═══════════ 12 · AI COACH: CONTEXT AND BOUNDARY FOR WEEK 3 ═════════════ */
console.log("\n12 · AI COACH");
const ctx = ME.aiContext(st[W3.id], W3, G3, { weakness: "ask" });
const ctxJson = JSON.stringify(ctx);
ok("The context carries the Week 3 task, pattern, five moves with hints, the weakness, evidence counts and one attempt summary",
  ctx.track === GE && ctx.competency === "raise-problem" && ctx.prompt === G3.prompt && ctx.pattern === W3.pattern
  && ctx.targetMoves.length === 5 && ctx.targetMoves.every(m => m.id && m.label && m.hint) && ctx.currentWeakness === "ask"
  && ctx.recentEvidence.attempts === 1 && ctx.previousAttemptSummary && ctx.previousAttemptSummary.moves.ask === false);
ok("The transfer context says so", ME.aiContext(st[W3.id], W3, T3, {}).missionKind === "transfer");
ok("It carries NO transcript — not Week 3's, not Week 1's, not Week 2's",
  !ctxJson.includes(SAY.noAsk.slice(0, 30)) && !ctxJson.includes(SAY.w1noWhy.slice(0, 30)) && !ctxJson.includes(SAY.w2strong.slice(0, 30)) && !("said" in ctx.previousAttemptSummary));
ok("It carries no attempt history, no profile, no name, no state machine",
  !ctxJson.includes("\"attempts\":[") && !/profile|streak|\"name\"/i.test(ctxJson) && !("state" in ctx));
ok("It carries nothing from the other competencies at all", !/explain-work|clear-update|status|role/.test(ctxJson));
const prompt = ME.coachPrompt(ctx, "SPOKEN RULE");
ok("The prompt names five moves, Week 3's shape, and the existing {reply, covered} route",
  /makes 5 communication/.test(prompt) && /ask \(What I need\)/.test(prompt) && prompt.includes(W3.pattern) && /"covered"/.test(prompt) && /"reply"/.test(prompt) && prompt.includes("SPOKEN RULE"));
ok("The relevant vocabulary reaches the learner through the engine's own path: the missing move's expressions are queued to learn",
  (() => { const q = ME.expressionsToLearn(W3, ME.grade(W3, G3, SAY.noAsk, { seconds: 20 }), "ask"); return q.some(e => e.move === "ask" && e.why === "missing") && q.every(e => W3.expressions.some(x => x.w === e.w)); })());
const evAI = mk(W3, G3, SAY.noAsk, "guided", "ai1");
ME.applyCoachMoves(evAI, W3, ["ask"]);
ok("The model MAY add the ask it heard in the learner's own words", evAI.moves.ask === true && evAI.coverage === 1 && evAI.assisted === true);
const evKeep = mk(W3, G3, SAY.strong, "guided", "ai2");
ME.applyCoachMoves(evKeep, W3, []);
ok("The model CANNOT remove a move the learner made", evKeep.coverage === 1);
const evJunk = mk(W3, G3, SAY.noAsk, "guided", "ai3");
ME.applyCoachMoves(evJunk, W3, ["status", "role", "__proto__", "state", "passed", 42, null]);
ok("Other competencies' move ids and non-moves are dropped on the floor",
  evJunk.moves.ask === false && Object.keys(evJunk.moves).join() === "issue,cause,impact,mitigate,ask" && !("state" in evJunk.moves));
const shaped = ME.shapeCoach({ reply: "y".repeat(500), covered: ["ask"], state: "STRONG", score: 100, passed: true }, W3, evAI);
ok("Model output is capped and carries no state or score into the app", shaped.improve.length <= 240 && !("state" in shaped) && !("score" in shaped) && !("passed" in shaped));
ok("With no model at all, deterministic coaching names the ask and its own retry line",
  (() => { const f = ME.shapeCoach(null, W3, mk(W3, G3, SAY.noAsk, "guided", "d")); return f.move === "ask" && /decide, approve or do/i.test(f.retry) && f.ai === false; })());

/* ═══════════ 13 · SHADOW: A REAL CLIP, SUPPORTING ONLY ══════════════════ */
console.log("\n13 · SHADOW");
ok("Week 3 names a real clip from the catalogue, and says honestly which moves it models",
  W3.shadow && W3.shadow.vid === "9FvQ9125Hjs" && /three of the five/.test(W3.shadow.why)
  && JSON.parse(readFileSync(ROOT + "catalogue/general.json", "utf8")).videos["9FvQ9125Hjs"]
  && (() => { try { readFileSync(ROOT + "captions/9FvQ9125Hjs.json"); return true; } catch (e) { return false; } })());
const round = vid => ({ kind: "challenge", ts: 1.7e12, vid, title: "t", rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" } });
ok("A round on Week 3's clip links to Week 3 — and to neither of the others",
  ME.fromShadow(round("9FvQ9125Hjs"), W3).linked === true && ME.fromShadow(round("9FvQ9125Hjs"), W1).linked === false && ME.fromShadow(round("9FvQ9125Hjs"), W2).linked === false);
ok("A round on Week 2's clip does not link to Week 3", ME.fromShadow(round(W2.shadow.vid), W3).linked === false);
ok("Shadow support never moves Week 3's state",
  (() => { const s = {}; ME.record(s, W3.id); ME.addSupport(s, W3.id, ME.fromShadow(round("9FvQ9125Hjs"), W3), GE); ME.addSupport(s, W3.id, ME.fromShadow(round("9FvQ9125Hjs"), W3), GE);
    const p = ME.progressSummary(s[W3.id], W3); return s[W3.id].state === "NOT_STARTED" && s[W3.id].support.length === 1 && p.shadow.linked === 1 && p.shadow.rungName === "blind" && p.attempts === 0; })());
ok("Shadow can supply comprehensibility the mission could not measure, and says so",
  (() => { const s = {}; put(s, W3, G3, SAY.strong, "guided", "sh1"); ME.addSupport(s, W3.id, ME.fromShadow(round("9FvQ9125Hjs"), W3), GE);
    const p = ME.progressSummary(s[W3.id], W3); return p.pron === 90 && p.pronSource === "shadow"; })());
ok("The architecture holds a competency with a clip (2, 3) and one without (1) at the same time",
  !!W2.shadow && !!W3.shadow && !W1.shadow && ME.progressSummary(ME.blank(W1.id), W1).shadow.total === 0);

/* ═══════════ BROWSER ════════════════════════════════════════════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8061, 8062, 8063, 8064, 8065]) {
    const s = spawn("python3", ["-m", "http.server", String(port)], { cwd: ROOT, stdio: "ignore" });
    await sleep(700);
    let served = null;
    try { served = await (await fetch(`http://localhost:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://localhost:${port}`; break; }
    s.kill(); console.log(`  (port ${port} is serving another tree — next)`);
  }
  if (!BASE) { console.error("no free port; pass BASE="); process.exit(1); }
}
console.log("  serving: " + BASE);

const POLISH = "https://be-polish.nore-ngou.workers.dev";
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
let coachMode = "ok", coachCovered = [], polishHits = 0, lastSystem = "";

async function learner(id, track, viewport) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] }, viewport || {}));
  await ctx.addInitScript(({ track }) => {
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
  await ctx.route(u => u.href.startsWith(POLISH), async route => {
    polishHits++;
    if (coachMode === "abort") return route.abort("failed");
    let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (b.assess) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ overall: 86, mode: "ai", words: [{ word: "a", score: 86 }] }) });
    if (b.chat) lastSystem = String(b.chat.system || "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Finish with the one thing you need them to decide.", covered: coachCovered }) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?w3=" + Date.now(), { waitUntil: "load" });
  await sleep(1000);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov").forEach(e => e.remove()));
  await page.evaluate(() => { window.__ev = []; const t0 = window.track; window.track = (n, p) => { window.__ev.push([n, p || {}]); return t0 && t0(n, p); }; });
  return { ctx, page };
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
const rec3 = (page, id) => page.evaluate(i => JSON.parse(JSON.stringify(mvStore()[i] || {})), id);
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: innerWidth }));
const shot = async (page, name) => { if (SHOTS) { try { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); } catch (e) {} } };

console.log("\nIN THE APP");
const L = await learner("ge", GE);

/* Home: one V2 card, and it is Week 1 for a fresh learner — not the newest */
const home = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, today: document.querySelectorAll(".today-card").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText }; });
ok("Home offers ONE V2 card and one V1 Today card; for a fresh learner the V2 card is Week 1, not the newest week",
  home.n === 1 && home.today <= 1 && /Week 1/i.test(home.eyebrow || "") && /Explain what you do/i.test(home.title || ""), JSON.stringify(home));
const ovh = await overflow(L.page); ok("Home has no horizontal overflow at 390px", ovh.sw <= ovh.cw, JSON.stringify(ovh));
await shot(L.page, "390-home");

/* SEE → HEAR → NOTICE for Week 3 */
await L.page.evaluate(() => mvGo("raise-problem-guided", "see")); await sleep(350);
const see = await L.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), state: (mvStore()["raise-problem"] || {}).state, cta: document.querySelectorAll("#v-mission .mv-cta").length }));
ok("SEE renders Week 3's title and situation with one action, and is worth INTRODUCED only",
  /Raise a problem/.test(see.txt) && /what's going on/i.test(see.txt) && /Step 1 of 7/i.test(see.txt) && see.cta === 1 && see.state === "INTRODUCED", see.txt.slice(0, 120));
await shot(L.page, "390-see");
await L.page.evaluate(() => mvStep("hear")); await sleep(300);
const hear = await L.page.evaluate(() => { const vis = () => /supplier changed our order number/i.test(document.getElementById("v-mission").innerText);
  const hidden = !vis(), play = document.querySelectorAll(".mv-play button").length, reveal = !!document.querySelector(".mv-reveal");
  document.querySelector(".mv-reveal").click();
  return { hidden, play, reveal, shownAfter: vis(), heard: (window.__ev || []).some(e => e[0] === "v2_mission_heard") }; });
ok("HEAR is voice-first: two play buttons, Week 3's model hidden until 'Show text' reveals it, and the heard event logged",
  hear.hidden && hear.play === 2 && hear.reveal && hear.shownAfter && hear.heard, JSON.stringify(hear));
await L.page.evaluate(() => mvStep("notice")); await sleep(350);
const notice = await L.page.evaluate(() => ({
  moves: [...document.querySelectorAll(".mv-list li b")].map(b => b.innerText),
  eyebrow: (document.querySelector(".mv-notice .eyebrow") || {}).innerText, sub: (document.querySelector(".mv-notice .sub") || {}).innerText,
  shadow: !!document.querySelector(".mv-shadow"), cta: document.querySelectorAll("#v-mission .mv-cta").length }));
ok("NOTICE renders all five Week 3 moves by label, says '5 moves', and — unlike Week 1 — shows the Shadow row",
  notice.moves.join() === "The problem,Cause,Impact,What I've done,What I need" && /5 moves/i.test(notice.eyebrow + " " + notice.sub) && notice.shadow === true && notice.cta === 1, JSON.stringify(notice));
const ovn = await overflow(L.page); ok("NOTICE has no horizontal overflow at 390px with five moves and a Shadow row", ovn.sw <= ovn.cw, JSON.stringify(ovn));
await shot(L.page, "390-notice");
const noType = await L.page.evaluate(() => ({ ta: document.querySelectorAll("#v-mission textarea").length, inp: document.querySelectorAll("#v-mission input[type=text]").length, sc: document.querySelectorAll("#v-mission .score-b").length }));
ok("Week 3 is voice-first — no script box, no text input, no self-score", noType.ta === 0 && noType.inp === 0 && noType.sc === 0, JSON.stringify(noType));

/* ── B · WEAK MOVE ── */
console.log("\nB · WEAK MOVE");
await L.page.evaluate(() => mvStep("speak")); await sleep(250);
await shot(L.page, "390-speak");
coachCovered = ["issue", "cause", "impact", "mitigate"];
await speak(L.page, SAY.noAsk);
const b1 = await L.page.evaluate(() => ({ moves: _mv.ev.moves, cov: _mv.ev.coverage, move: _mv.coach.move, ai: _mv.coach.ai, chips: document.querySelectorAll(".mv-move").length, off: document.querySelectorAll(".mv-move.off").length }));
ok("B1 · the missing ask is identified from what was said; five chips render, one off",
  b1.moves.ask === false && b1.cov === 0.8 && b1.move === "ask" && b1.chips === 5 && b1.off === 1, JSON.stringify({ c: b1.cov, m: b1.move, chips: b1.chips, off: b1.off }));
ok("B2 · four of five does not advance the learner", (await rec3(L.page, "raise-problem")).state === "PRACTICING");
ok("B3 · the coach's system prompt carried Week 3's five moves — not Week 1's role or Week 2's status",
  /makes 5 communication/.test(lastSystem) && /ask \(What I need\)/.test(lastSystem) && !/role \(/.test(lastSystem) && !/status \(/.test(lastSystem), lastSystem.slice(0, 90));
ok("B4 · the coaching shown is tagged as the model's", b1.ai === true);
await shot(L.page, "390-coach");

/* ── C · RETRY ── */
console.log("\nC · RETRY");
const retry = await L.page.evaluate(() => { mvRetry(); return { text: _mv.retryText, step: _mv.step }; });
ok("C1 · the retry names the Week 3 move that was missed, in the pack's own words", /decide, approve or do/i.test(retry.text || "") && retry.step === "speak", retry.text);
coachCovered = ["issue", "cause", "impact", "mitigate", "ask"];
await speak(L.page, SAY.strong);
const c2 = await rec3(L.page, "raise-problem");
ok("C2 · the retry is stored as a retry; both attempts are preserved", c2.attempts.length === 2 && c2.attempts[0].coverage === 0.8 && c2.attempts[1].kind === "retry" && c2.attempts[1].coverage === 1);
ok("C3 · progression recalculates to DEMONSTRATED", c2.state === "DEMONSTRATED", c2.state);

/* ── D · TRANSFER ── */
console.log("\nD · TRANSFER");
await L.page.evaluate(() => mvGo("raise-problem-transfer", "speak")); await sleep(300);
const tp = await L.page.evaluate(() => ({ q: (document.querySelector(".mv-q") || {}).innerText, comp: _mv.compId, kind: _mv.kind }));
ok("D1 · the transfer is a different situation, and still Week 3", /raise before we finish/i.test(tp.q || "") && tp.comp === "raise-problem" && tp.kind === "transfer", JSON.stringify(tp));
await speak(L.page, SAY.transfer);
const d2 = await rec3(L.page, "raise-problem");
ok("D2 · transfer evidence is stored as its own kind, separate from practice", d2.attempts.length === 3 && d2.attempts[2].kind === "transfer" && d2.attempts[2].transfer === true);
ok("D3 · one cold success is TRANSFER_READY, not STRONG", d2.state === "TRANSFER_READY" && d2.transfer.passed === 1, d2.state);
ok("D4 · a retrieval is scheduled from the track's own intervals", d2.retrieval && d2.retrieval.due > Date.now());
await L.page.evaluate(() => mvStep("done")); await sleep(300);
const done = await L.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), bars: document.querySelectorAll(".mv-bars > *").length, chips: document.querySelectorAll(".mv-move").length }));
ok("D5 · the evidence screen shows the state, five chips and the dimension bars — pronunciation as a number here, because the (mocked) audio grader measured it",
  /transfer ready/i.test(done.txt) && done.bars >= 5 && done.chips === 5 && /86%/.test(done.txt), done.txt.slice(0, 160));
const ovd = await overflow(L.page); ok("Evidence screen has no horizontal overflow at 390px", ovd.sw <= ovd.cw, JSON.stringify(ovd));
await shot(L.page, "390-evidence");

/* ── A · SUCCESS DOWNSTREAM ── */
console.log("\nA · SUCCESS DOWNSTREAM");
const prog = await L.page.evaluate(() => { go("review"); const ps = [...document.querySelectorAll(".pg-v2")]; const d = window.v2Evidence();
  return { panels: ps.length, txt: ps.map(p => p.innerText.replace(/\s+/g, " ")).join(" || "), comps: d.map(x => x.competency + ":" + x.state), moves: (d[0].byMove || []).length, week: d[0].week }; });
ok("A1 · Progress renders Week 3 with its five moves, its week and its state — and nothing for the unspoken weeks",
  prog.panels === 1 && prog.comps.join() === "raise-problem:TRANSFER_READY" && prog.moves === 5 && prog.week === 3 && /Week 3/.test(prog.txt) && /What I need/.test(prog.txt), JSON.stringify({ p: prog.panels, c: prog.comps, m: prog.moves, w: prog.week }));
const ovp = await overflow(L.page); ok("Progress has no horizontal overflow at 390px", ovp.sw <= ovp.cw, JSON.stringify(ovp));
await shot(L.page, "390-progress");
const rec = await L.page.evaluate(() => ({ a: AdaptiveLearningEngine.recommendation(S, ProfessionalTrackContext.active()), m: LearningCoach.mission(S, ProfessionalTrackContext.active()) }));
ok("A2 · with Week 3 transfer-ready the engine offers Week 1 next — the lowest unspoken week, by its own priority",
  rec.a.v2 === true && rec.m.arg1 === "explain-work-guided", JSON.stringify({ t: rec.a.title, arg: rec.m.arg1 }));
const voc = await L.page.evaluate(() => Object.entries(areaVocab()).filter(([, v]) => v.src && v.src.v2 === "raise-problem").map(([w]) => w));
ok("A3 · Week 3 expressions were acquired automatically, tagged to Week 3", voc.length > 0 && voc.every(w => W3.expressions.some(e => e.w === w)), JSON.stringify(voc));
const ev = await L.page.evaluate(() => (window.__ev || []).filter(e => e[0].startsWith("v2_")).map(e => [e[0], e[1].track, e[1].week, e[1].competency, e[1].mission]));
ok("A4 · every Week 3 analytics event carries track, week '3' and the Week 3 competency",
  ev.length >= 6 && ev.every(e => e[1] === GE && e[2] === "3" && e[3] === "raise-problem"), JSON.stringify(ev.slice(0, 4)));
const evNames = [...new Set(ev.map(e => e[0]))];
ok("A5 · the loop emitted only existing v2_* names: started, heard, speak, coach, evidence, retry, transfer, progressed, recommendation",
  ["v2_mission_started", "v2_mission_heard", "v2_speak_attempt", "v2_coach_generated", "v2_evidence_recorded", "v2_retry_attempt", "v2_transfer_started", "v2_transfer_completed", "v2_competency_progressed"].every(n => evNames.includes(n)), evNames.join());
const pii = await L.page.evaluate(() => JSON.stringify((window.__ev || []).filter(e => e[0].startsWith("v2_")).map(e => e[1])));
ok("A6 · no event carries a transcript, the profile name or the goal", !/supplier|worried|\"T\"|confidence in meetings/i.test(pii));

/* ── F · THREE WEEKS IN ONE LEARNER ── */
console.log("\nF · THREE WEEKS, ONE LEARNER");
coachCovered = ["role", "own", "now", "who", "why"];
await L.page.evaluate(() => mvGo("explain-work-guided", "speak")); await sleep(300);
await speak(L.page, SAY.w1strong);
coachCovered = ["status", "issue", "impact", "next"];
await L.page.evaluate(() => mvGo("clear-update-guided", "speak")); await sleep(300);
await speak(L.page, SAY.w2strong);
const all = await L.page.evaluate(() => { go("review"); const d = window.v2Evidence();
  return { comps: d.map(x => ({ c: x.competency, w: x.week, s: x.state, m: (x.byMove || []).length, a: x.attempts })), panels: document.querySelectorAll(".pg-v2").length }; });
ok("F1 · three competencies render, week 1 → 2 → 3, each with its own move count 5 / 4 / 5",
  all.panels === 3 && all.comps.map(x => x.c).join() === "explain-work,clear-update,raise-problem" && all.comps.map(x => x.w).join() === "1,2,3" && all.comps.map(x => x.m).join() === "5,4,5", JSON.stringify(all.comps));
ok("F2 · the Week 1 and Week 2 attempts did not disturb Week 3's record", all.comps[2].s === "TRANSFER_READY" && all.comps[2].a === 3 && all.comps[0].a === 1 && all.comps[1].a === 1, JSON.stringify(all.comps));
const afterAll = await L.page.evaluate(() => { go("home"); return { n: document.querySelectorAll(".mv-home").length, eyebrow: (document.querySelector(".mv-home .eyebrow") || {}).innerText }; });
ok("F3 · Home still shows exactly one V2 card, now for the lowest week with an open question (Week 1's transfer)",
  afterAll.n === 1 && /Week 1/i.test(afterAll.eyebrow || ""), JSON.stringify(afterAll));

/* ── J · V1 / V2 COEXISTENCE ── */
console.log("\nJ · V1 / V2 COEXISTENCE");
const co = await L.page.evaluate(() => {
  go("home");
  const cards = [...document.querySelectorAll("#v-home .card")];
  const mvIdx = cards.findIndex(c => c.classList.contains("mv-home"));
  const v1Idx = cards.findIndex(c => c.classList.contains("today-card"));
  const before = { days: JSON.stringify(S.days), v2: JSON.stringify(S.v2A) };
  toggleDay(dayKey(3, "Mon"), 3, "Mon");
  const after = { days: JSON.stringify(S.days), v2: JSON.stringify(S.v2A) };
  return { mvIdx, v1Idx, v2Unchanged: before.v2 === after.v2, daysChanged: before.days !== after.days, v1State: !!S.days[dayKey(3, "Mon")],
    v1Week3Done: typeof weekDone === "function" ? weekDone(3) : null, v2State: (mvStore()["raise-problem"] || {}).state };
});
ok("J1 · the V2 card leads and the 12-week card follows — one of each", co.mvIdx >= 0 && co.v1Idx >= 0 && co.mvIdx < co.v1Idx, JSON.stringify({ mv: co.mvIdx, v1: co.v1Idx }));
ok("J2 · completing a V1 Week 3 session day cannot alter V2 Week 3 evidence — separate stores", co.v2Unchanged && co.daysChanged && co.v1State === true && co.v2State === "TRANSFER_READY", JSON.stringify(co));
ok("J3 · V2 Week 3 being transfer-ready did not mark V1 Week 3 complete", co.v1Week3Done !== true, String(co.v1Week3Done));
const evN = await L.page.evaluate(() => (window.__ev || []).map(e => e[0]));
ok("J4 · V1 and V2 do not emit each other's completion events", evN.includes("v2_evidence_recorded") && evN.filter(n => n === "session_complete").length === 1, JSON.stringify(evN.filter(n => /complete|evidence/.test(n))));

/* ── K · FOUNDATIONS GATE ── */
console.log("\nK · FOUNDATIONS GATE");
const gate = await L.page.evaluate(async () => {
  const f = fndState(); const keep = JSON.parse(JSON.stringify(f));
  delete f.placed; delete f.checkedAt; delete f.finished; save();
  go("home"); await new Promise(r => setTimeout(r, 400));
  const cards = [...document.getElementById("v-home").querySelectorAll(":scope > .card, :scope > section.card, :scope > button.card")].map(c => c.className);
  const card = !!document.querySelector(".mv-home");
  go("mission", "raise-problem-guided", "speak"); await new Promise(r => setTimeout(r, 400));
  const gated = !!document.querySelector("#v-mission .fnd-gate, #v-mission .card") && !document.querySelector("#v-mission .mv-speak");
  const n = (mvStore()["raise-problem"] || {}).attempts.length;
  Object.assign(fndState(), keep); save();
  return { first: cards[0] || "", card, gated, n };
});
ok("K1 · an unplaced learner is not offered Week 3 — the placement check stays the first card", /fnd-home/.test(gate.first) && gate.card === false, JSON.stringify(gate));
ok("K2 · …and cannot reach Week 3 by route: the mission renders the Foundations gate, and no evidence is written", gate.gated === true && gate.n === 3, JSON.stringify(gate));

/* ── DESKTOP ── */
console.log("\nUI · DESKTOP");
const Dk = await learner("desk", GE, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
const dk = await Dk.page.evaluate(async () => { mvGo("raise-problem-guided", "notice"); await new Promise(r => setTimeout(r, 400));
  const o1 = { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  const moves = document.querySelectorAll(".mv-list li").length;
  mvStep("speak"); await new Promise(r => setTimeout(r, 300));
  const o2 = { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  const cta = document.querySelectorAll("#v-mission .rec-btn").length;
  return { o1, o2, moves, cta }; });
ok("Desktop: NOTICE lists five moves and SPEAK has one recorder, with no horizontal overflow on either",
  dk.moves === 5 && dk.cta === 1 && dk.o1.sw <= dk.o1.cw && dk.o2.sw <= dk.o2.cw, JSON.stringify(dk));
await shot(Dk.page, "1280-speak");
await Dk.page.evaluate(() => mvStep("notice")); await sleep(300); await shot(Dk.page, "1280-notice");

/* ── E · OFFLINE ── */
console.log("\nE · NETWORK FAILURE");
const O = await learner("off", GE);
await O.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
coachMode = "abort";
const hits0 = polishHits;
await speak(O.page, SAY.strong);
const e1 = await O.page.evaluate(async () => { const r = mvStore()["raise-problem"]; const recs = await getRecs(_mv.recCtx);
  return { n: r.attempts.length, said: !!r.attempts[0].said, cov: r.attempts[0].coverage, pending: r.attempts[0].coachPending, state: r.state, audio: recs.length, offline: _mv.coach && _mv.coach.offline, move: _mv.coach && _mv.coach.move, pron: r.attempts[0].pron }; });
ok("E1 · attempt, transcript and audio survive; evidence is correct and was computed on the device", e1.n === 1 && e1.said && e1.audio === 1 && e1.cov === 1 && e1.state === "DEMONSTRATED", JSON.stringify(e1));
ok("E2 · coaching is pending; the deterministic fallback is shown; pronunciation is null, not 0", e1.pending === true && e1.offline === true && e1.pron === null, JSON.stringify(e1));
const e2b = await O.page.evaluate(() => { const sum = MissionEngine.progressSummary(mvStore()["raise-problem"], mvComp("raise-problem"));
  return { pron: sum.pron, src: sum.pronSource, bar: mvBar("Comprehensibility", sum.pron == null ? null : sum.pron / 100), zero: mvBar("x", 0) }; });
ok("E2b · with no audio grader reachable, the summary carries null and the evidence bar renders '—' — a measured 0 would render '0%'",
  e2b.pron === null && e2b.src === null && /<b>—<\/b>/.test(e2b.bar) && !/<b>\d+%<\/b>/.test(e2b.bar) && /<b>0%<\/b>/.test(e2b.zero), JSON.stringify(e2b));
coachMode = "ok"; coachCovered = ["issue", "cause", "impact", "mitigate", "ask"];
await O.page.evaluate(() => mvFinishCoaching());
await O.page.waitForFunction(() => _mv && !_mv.busy, null, { timeout: 12000 }).catch(() => {});
await sleep(300);
const e3 = await O.page.evaluate(() => { const r = mvStore()["raise-problem"]; return { n: r.attempts.length, pending: r.attempts[0].coachPending, ai: _mv.coach && _mv.coach.ai }; });
ok("E3 · recovery completes the coaching and creates no second piece of evidence", e3.n === 1 && e3.pending === false && e3.ai === true, JSON.stringify(e3));
ok("E4 · the Worker was called again on recovery", polishHits > hits0 + 1);


/* ── H · WELDING ── */
console.log("\nH · WELDING ISOLATION");
const Wd = await learner("weld", "welding");
const w = await Wd.page.evaluate(async (vid) => {
  const before = JSON.stringify(S.v2A || {});
  go("home"); await new Promise(r => setTimeout(r, 300));
  const card = !!document.querySelector(".mv-home");
  go("mission", "raise-problem-guided", "speak"); await new Promise(r => setTimeout(r, 400));
  const view = cur.v, html = (document.getElementById("v-mission") || {}).innerHTML;
  const refused = MissionEngine.addAttempt(S.v2A || (S.v2A = {}), "raise-problem", { key: "x", answered: true, coverage: 1, kind: "guided" }, areaId(), [1]) === null;
  mvTrack("v2_speak_attempt", { mission: "raise-problem-guided" });
  const unchanged = JSON.stringify(S.v2A || {}) === before;
  aList("chHist").unshift({ kind: "challenge", ts: Date.now(), vid, title: "clip", rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" } }); save();
  const harvested = mvHarvestShadow();
  go("review"); await new Promise(r => setTimeout(r, 300));
  return { area: areaId(), comps: mvComps().length, comp: mvComp("raise-problem"), missions: activeCurriculum().missions, card, view, html: (html || "").length,
    refused, unchanged, harvested, weldRows: Object.keys(((S.v2A || {}).welding) || {}).length, ev: window.v2Evidence(), rec: window.v2Recommendation(),
    panel: !!document.querySelector(".pg-v2"), events: (window.__ev || []).filter(e => e[0].startsWith("v2_")).length };
}, "9FvQ9125Hjs");
ok("H1 · Welding's curriculum has no missions — Week 3 does not reach it", w.area === "welding" && w.missions === null && w.comps === 0 && w.comp === null, JSON.stringify({ a: w.area, m: w.missions, c: w.comps }));
ok("H2 · no V2 card on the Welding home", w.card === false);
ok("H3 · routing straight to the Week 3 mission turns a Welding learner around", w.view === "home" && w.html === 0, JSON.stringify({ v: w.view, len: w.html }));
ok("H4 · the engine refuses to write Week 3 evidence for a Welding learner", w.refused && w.unchanged);
ok("H5 · no Week 3 analytics can be emitted from Welding", w.events === 0, String(w.events));
ok("H6 · a Welding Shadow round on Week 3's clip harvests nothing and files no Welding evidence", w.harvested === 0 && w.weldRows === 0, JSON.stringify({ h: w.harvested, rows: w.weldRows }));
ok("H7 · both hooks return null and the Welding Progress page shows no V2 panel", w.ev === null && w.rec === null && w.panel === false);
const wcur = await Wd.page.evaluate(() => { const p = activeCurriculum(); return { weeks: (p.weeks || []).length, sims: (p.simulations || []).length, stage: (p.weeks[0] || {}).stage }; });
ok("H8 · existing Welding curriculum is unchanged (12 stages, 12 simulations)", wcur.weeks === 12 && wcur.sims === 12 && /Stage 1/.test(wcur.stage || ""), JSON.stringify(wcur));

ok("No uncaught page errors in any context", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
