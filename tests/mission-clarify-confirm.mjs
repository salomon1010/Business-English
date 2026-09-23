/* BE Mastery V2.4 — General English Week 4 "Clarifying, asking questions &
   confirming", end to end, and the data-only proof.

   Week 4 is the FOURTH competency and it arrived as one entry in
   tracks/general/missions.json. This suite is the claim that nothing else had
   to change: the engine, the evidence contract, the state machine, the
   retrieval, the recommendation, the coach boundary, the Home card, the
   Progress panel, the cloud merge and the Welding wall all behave for a
   competency they had never seen — and for a shape (four moves) that no
   other competency had at the time except Week 2.

   The four moves are FLAG → ASK → RESTATE → CONFIRM. The situation supplies
   the ambiguity; the learner never has to invent a fact.

   Canonical numbering: the `week` of a competency is the General English
   programme week it teaches — Week 4 is "Clarifying, asking questions &
   confirming" in weeks.json. See the _note in missions.json.

   Run:  cd tests && node mission-clarify-confirm.mjs
         SHOTS=/some/dir node mission-clarify-confirm.mjs   (also saves screenshots) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const ME = require("../mission-engine.js");
const AE = require("../answer-evaluator.js");
const ROOT = new URL("..", import.meta.url).pathname;
const PACK = JSON.parse(readFileSync(ROOT + "tracks/general/missions.json", "utf8"));
const WEEKS_RAW = JSON.parse(readFileSync(ROOT + "tracks/general/weeks.json", "utf8"));
const WEEKS = Array.isArray(WEEKS_RAW) ? WEEKS_RAW : (WEEKS_RAW.weeks || Object.values(WEEKS_RAW).find(Array.isArray) || []);
const PHRASES = JSON.parse(readFileSync(ROOT + "tracks/general/phrases.json", "utf8"));
const SHOTS = process.env.SHOTS || null;

const res = [];
const ok = (n, c, d = "") => { res.push({ name: n, pass: !!c }); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };

const W1 = ME.competencyOf(PACK, "explain-work");
const W2 = ME.competencyOf(PACK, "clear-update");
const W3 = ME.competencyOf(PACK, "raise-problem");
const W4 = ME.competencyOf(PACK, "clarify-confirm");
const G1 = ME.missionOf(W1, "explain-work-guided"), T1 = ME.missionOf(W1, "explain-work-transfer");
const G2 = ME.missionOf(W2, "clear-update-guided"), T2 = ME.missionOf(W2, "clear-update-transfer");
const G3 = ME.missionOf(W3, "raise-problem-guided"), T3 = ME.missionOf(W3, "raise-problem-transfer");
const G4 = W4 && ME.missionOf(W4, "clarify-confirm-guided"), T4 = W4 && ME.missionOf(W4, "clarify-confirm-transfer");
const IV = [1, 3, 7, 21, 60];
const GE = "general-english";
const MOVES = "flag,ask,restate,confirm";
const meta = c => ({ competency: c.id, week: c.week, moveIds: ME.moveIds(c) });
const mk = (c, m, text, kind, key, at) => Object.assign(ME.grade(c, m, text, { seconds: 27 }),
  { key, kind, at: at || Date.now(), missionId: m.id });

/* ── what the learners will say ──────────────────────────────────────────── */
const SAY = {
  strong: G4 && G4.hear.model,
  noFlag: "When you say soon, do you mean before Friday's review or by the end of the month? So you're saying the same six metrics as March, on the new dashboard. Then I'll have a first version to you by Thursday — does that work?",
  noAsk: "Sorry, one thing isn't clear to me yet. So you're saying the same six metrics as March on the new dashboard. Then I'll build it and have a first version to you by Thursday — does that work?",
  noRestate: "Sorry, one thing isn't clear to me yet. When you say soon, do you mean before Friday's review or by the end of the month? Then I'll build it with the six March metrics and have a first version to you by Thursday — does that work?",
  /* the move most people leave out when they are nervous: they clarify and then just say "okay" */
  noConfirm: "Sorry, one thing isn't clear to me yet. When you say soon, do you mean before Friday's review or by the end of the month? So you're saying the same six metrics as March, on the new dashboard.",
  transfer: "Sorry, I'm not sure I follow — the client thing could be two things. Are you asking about the revised quote or the delivery date they wanted? So you're saying it's the quote they're expecting before Wednesday's review. Then I'll send the quote today and come back to you tomorrow on the delivery date — does that work?",
  transferWeak: "I'm not sure I follow. Are you asking about the quote or the delivery date? So you're saying the quote is the one they're expecting before Wednesday.",
  /* browser speech recognition usually returns one unpunctuated run */
  unpunctuated: "sorry one thing isn't clear to me yet when you say soon do you mean before friday's review or by the end of the month so you're saying the same six metrics as march on the new dashboard then I'll build it with those six and have a first version to you by thursday does that work",
  short: "Sure, will do.",
  seven: "Not sure I follow, which date exactly?",
  eight: "Not sure I follow, which date do you mean?",
  yes: "Yes of course, no problem at all, I will take that on and get it done.",
  /* Weeks 1–3, to put them to rest when the question is whether Week 4 waits its turn */
  w1strong: G1.hear.model,
  w1transfer: "I am a project coordinator on the delivery team. I look after the schedule and the supplier paperwork for your account. Right now I am preparing the plan for your first shipment. I work closely with our warehouse and your logistics contact, so that nothing on your side has to be chased by hand.",
  w1noWhy: "I work as an operations analyst in the logistics team. I'm responsible for the weekly delivery reports. At the moment I'm rebuilding how we track late shipments. I work closely with the warehouse managers.",
  w2strong: "The project is on track and we have completed two stages. We have run into an issue with the design agency. This means Friday delivery is at risk by about two days. I will chase it up today and come back to you tomorrow.",
  w2transfer: "Installation is due to start on Monday and everything else is ready. The materials from the supplier arrived three days late. That means we will push back the handover and the end of month promise is at risk. I will confirm a new date with the customer and come back to you this afternoon.",
  w3strong: G3.hear.model,
  w3transfer: "There is a problem with the monthly figures. It started when the old report was switched off in August, so two months of numbers may be wrong. This means the Thursday board pack is at risk. I have spoken to finance and asked them to rerun the numbers. Could you sign off on a one-day delay so we can check them?",
  /* V2.5/V2.6: cold transfers for every competency after Week 4, keyed by id, so
     the "Home falls silent only when EVERY competency rests" cases can walk the
     pack in week order instead of naming a count. A new week adds one entry. */
  transfers: {
    "explain-tech": "In plain terms, the integration is a link between their shop and our warehouse. The way it works is that every time a customer places an order, it goes straight to the warehouse system automatically, instead of someone typing it in each morning. What this means for the client is that orders ship the same day and the typing mistakes stop. The one thing to remember is that returns aren't included yet — those are still done by hand. Does that make sense?",
    "recommend-decide": "There are two options here. One option is to send it tomorrow with the numbers corrected by hand, and the other option is to hold it for two days and rerun everything from the fixed source. My recommendation is to hold it. The reason is that last quarter they complained about a wrong figure, and two of the twelve charts can't be checked in time if we send tomorrow. The downside is that it's the first late report we've ever sent them. So the next step is that you tell the client today that it's coming on Thursday, and I'll rerun it as soon as the source is fixed.",
    "disagree-pushback": "I understand why the director wants one go \u2014 a phased move takes longer, and nobody wants this dragging into next year. I'd push back on doing the whole warehouse in one weekend, though. The reason is the pilot: at the small depot the switch took two weeks to settle, forty stock counts were wrong in the first week, and the main warehouse holds twenty times the stock. What I'd suggest is that we switch the night team first, since they're already trained, and bring the day shifts across two weeks later. We both want this done before December, and that way we still finish by the end of November without a weekend where nothing can be counted. What would the director need to see to agree to that?",
    "sprint-coordinate": "The landing page is built and both banner variants are ready to test. The sign-up form is blocked: the dependency is legal's review of the prize-draw terms \u2014 they've had them since Monday and said end of week. Without approved terms the form can't go live, so the first is at risk for sign-ups. To keep the launch on track, I'd go out on the first with the newsletter and no prize draw, and add the draw the week after when legal comes back. Could you ping the head of legal today and let me know by Thursday? If the terms land by Thursday, the form is live for the first; either way the newsletter goes out on the first.",
  },
};

/* ═══════════ A–D · THE CONTENT ITSELF ═══════════════════════════════════ */
console.log("\nWEEK 4 · THE COMPETENCY");
ok("A · Week 4 exists, is numbered 4, is 'Clarifying, asking questions & confirming' with four moves and two missions",
  W4 && W4.week === 4 && /clarifying, asking questions & confirming/i.test(W4.title) && ME.moveIds(W4).join() === MOVES && W4.missions.length === 2,
  W4 && ME.moveIds(W4).join());
/* V2.5: the numbering claim is consecutive from 1, whatever the count — the
   raise-problem suite already states it that way. */
ok("A · The canonical numbering holds: 1, 2, 3, 4, then consecutive — no gaps, no duplicates; the pack's week matches weeks.json's Week 4 theme",
  PACK.competencies.map(c => c.week).join() === PACK.competencies.map((_, i) => i + 1).join() && PACK.competencies[3].id === "clarify-confirm" && WEEKS.find(w => w.n === 4).theme === W4.title, WEEKS.find(w => w.n === 4).theme);
ok("A · The pack note records Week 4 and its move count", /Week 4/.test(PACK._note) && /4 moves/.test(PACK._note));
ok("B · The guided mission loads with the situation, the model, the prompt and the context",
  G4 && G4.kind === "guided" && G4.see && G4.see.where && G4.see.who && G4.see.asks && G4.see.goal && G4.hear && G4.hear.model && G4.hear.note && G4.prompt === G4.see.asks && G4.context);
ok("C · The transfer mission loads: a different situation, a different asker, no model to copy — and the ambiguity is supplied, not invented",
  T4 && T4.kind === "transfer" && !T4.hear && T4.prompt !== G4.prompt && T4.see.who !== G4.see.who && /two open items/i.test(T4.context) && /sort out the client thing/i.test(T4.prompt));
ok("C · Neither situation asks the learner to invent a fact: the guided context defines 'soon' and 'the usual metrics', the transfer context names both candidates for 'the client thing'",
  /Friday/.test(G4.context) && /end of the month/.test(G4.context) && /six/.test(G4.context) && /quote/.test(T4.context) && /delivery date/.test(T4.context) && /Wednesday/.test(T4.context));
ok("D · Exactly four moves, in the taught order, each with an id, a label, a hint, phrase cues, a retry line and patterns",
  W4.moves.length === 4 && W4.moves.every(m => m.id && m.label && m.hint && Array.isArray(m.cues) && m.cues.length >= 20 && m.retry && Array.isArray(m.patterns) && m.patterns.length === 3));
ok("D · The pattern reads FLAG → ASK → RESTATE → CONFIRM and every cue is lowercase and unique within its move",
  /FLAG → ASK → RESTATE → CONFIRM/.test(W4.pattern) && W4.moves.every(m => new Set(m.cues).size === m.cues.length && m.cues.every(q => q === q.toLowerCase())));
ok("D · No cue of one move is contained in a cue of another — one phrase can never credit two moves",
  W4.moves.every((a, i) => W4.moves.every((b, j) => i === j || a.cues.every(x => b.cues.every(y => !x.includes(y))))));
ok("D · Every Week 4 expression is tagged to a move that exists, and at least six come from the curriculum's own Week 4 phrase bank wording",
  W4.expressions.length === 8 && W4.expressions.every(e => ME.moveIds(W4).includes(e.move) && e.w && e.def && e.l)
  && W4.expressions.filter(e => PHRASES.phrases.some(p => p.w === 4 && AE.hits(p.p, e.w))).length >= 4,
  JSON.stringify(W4.expressions.map(e => e.w)));
ok("D · Shadow is deliberately unlinked after a content check, using the established _shadow_note pattern — no invented clip",
  !W4.shadow && typeof W4._shadow_note === "string" && /content check/i.test(W4._shadow_note) && /54ebEjg4EM8/.test(W4._shadow_note));

/* ═══════════ E · EACH MOVE CAN BE DEMONSTRATED ══════════════════════════ */
console.log("\nE · EACH MOVE");
const padded = t => t + " and a few more words to reach the minimum";
ok("E · Each move's own patterns credit that move and only that move",
  W4.moves.every(m => m.patterns.every(pt => { const e = ME.grade(W4, G4, padded(pt), { seconds: 5 }); return Object.keys(e.moves).filter(k => e.moves[k]).join() === m.id; })));
ok("E · Each expression, when spoken, credits the move it is tagged to",
  W4.expressions.every(x => { const e = ME.grade(W4, G4, padded(x.w), { seconds: 5 }); return e.moves[x.move] === true && e.vocabUsed.includes(x.w); }));
const gm = ME.grade(W4, G4, SAY.strong, { seconds: 30 });
ok("E · The model answer makes all four moves on its own rubric — the content agrees with the engine",
  gm.coverage === 1 && ME.passes(gm) && gm.clarity === 1, "missed=" + gm.missed.join());
ok("E · The moves arrive in the taught order in the model, so clarity is 1 with an order+length basis", gm.clarityBasis === "order+length" && gm.clarity === 1);
ok("E · An unpunctuated transcript — what browser speech recognition actually returns — still makes all four moves; clarity rests on order alone",
  (() => { const e = ME.grade(W4, G4, SAY.unpunctuated, { seconds: 30 }); return e.coverage === 1 && ME.passes(e) && e.clarityBasis === "order"; })());
ok("E · The transfer fixture makes all four moves cold", ME.grade(W4, T4, SAY.transfer, { seconds: 30 }).coverage === 1,
  "missed=" + ME.grade(W4, T4, SAY.transfer, { seconds: 30 }).missed.join());

/* ═══════════ F–I · ONE MISSING MOVE, EACH IN TURN ═══════════════════════ */
console.log("\nF–I · MISSING MOVES");
const miss = (text, id) => { const e = ME.grade(W4, G4, text, { seconds: 20 }); return e.coverage === 0.75 && !ME.passes(e) && e.moves[id] === false && ME.weakestMove(W4, e, []) === id; };
ok("F · Without the flag: 0.75, not passed, and 'flag' is the weakest move", miss(SAY.noFlag, "flag"));
ok("G · Without the question: 0.75, not passed, and 'ask' is the weakest move", miss(SAY.noAsk, "ask"));
ok("H · Without the paraphrase: 0.75, not passed, and 'restate' is the weakest move", miss(SAY.noRestate, "restate"));
ok("I · Without the confirmation: 0.75, not passed, and 'confirm' is the weakest move", miss(SAY.noConfirm, "confirm"));
ok("Three of four is 'strong' coverage by band and still not demonstrated — the bar is every move",
  (() => { const e = ME.grade(W4, G4, SAY.noConfirm, { seconds: 20 }); return e.verdict === "strong" && !ME.passes(e); })());
console.log("   the cue traps named in the pack");
ok("'Just to confirm, you want the summary by Friday' credits NOTHING — it is a paraphrase wearing a confirmation's clothes",
  (() => { const e = ME.grade(W4, G4, "Just to confirm, you want the summary by Friday.", { seconds: 5 }); return e.coverage === 0 && e.answered; })());
ok("'Do you want me to start today?' is not credited as the precise question", ME.grade(W4, G4, "Do you want me to start today, or is next week fine?", { seconds: 5 }).moves.ask === false);
ok("'I'm not sure what you mean by soon' flags the gap but is NOT credited as asking the question — the precise question is still missing",
  (() => { const e = ME.grade(W4, G4, "I'm not sure what you mean by soon, to be honest with you.", { seconds: 5 }); return e.moves.flag === true && e.moves.ask === false; })());
ok("'So you're saying you need it by Friday' is a paraphrase, not a confirmation — a deadline alone confirms nothing",
  (() => { const e = ME.grade(W4, G4, "So you're saying you need it by Friday, with the usual numbers.", { seconds: 5 }); return e.moves.restate === true && e.moves.confirm === false; })());
ok("'Yes of course, I will take that on' — the silent yes this competency exists to replace — makes no move at all",
  ME.grade(W4, G4, SAY.yes, { seconds: 5 }).coverage === 0);

/* ═══════════ J · RETRY REWARDS THE MISSING MOVE ═════════════════════════ */
console.log("\nJ · RETRY");
ok("J · Deterministic coaching names the missing move and hands back its own retry line from the pack",
  (() => { const f = ME.shapeCoach(null, W4, mk(W4, G4, SAY.noConfirm, "guided", "j0")); return f.move === "confirm" && f.retry === ME.moveOf(W4, "confirm").retry && /who does what, by when/i.test(f.retry) && f.ai === false; })());
ok("J · …and for each other missing move the retry is that move's own line",
  [["noFlag", "flag"], ["noAsk", "ask"], ["noRestate", "restate"]].every(([k, id]) => ME.shapeCoach(null, W4, mk(W4, G4, SAY[k], "guided", "j" + id)).retry === ME.moveOf(W4, id).retry));
ok("J · The missing move's expressions are queued to learn; the ones used are queued to keep",
  (() => { const q = ME.expressionsToLearn(W4, ME.grade(W4, G4, SAY.noConfirm, { seconds: 20 }), "confirm");
    return q.some(e => e.move === "confirm" && e.why === "missing") && q.some(e => e.w === "so you're saying" && e.why === "used") && q.every(e => W4.expressions.some(x => x.w === e.w)); })());
ok("J · A retry that adds the missing move recovers: PRACTICING → DEMONSTRATED, both attempts kept",
  (() => { const s = {}; ME.introduce(s, W4.id, GE);
    ME.addAttempt(s, W4.id, mk(W4, G4, SAY.noConfirm, "guided", "r1"), GE, IV, meta(W4));
    const before = s[W4.id].state;
    ME.addAttempt(s, W4.id, mk(W4, G4, SAY.strong, "retry", "r2"), GE, IV, meta(W4));
    return before === "PRACTICING" && s[W4.id].state === "DEMONSTRATED" && s[W4.id].attempts.length === 2 && s[W4.id].attempts[1].kind === "retry"; })());

/* ═══════════ K · MINIMUM WORDS ══════════════════════════════════════════ */
console.log("\nK · MINIMUM WORDS");
ok("K · Three words is not an answer", !ME.grade(W4, G4, SAY.short, { seconds: 2 }).answered);
ok("K · Seven words is not an answer, even with two moves in it", (() => { const e = ME.grade(W4, G4, SAY.seven, { seconds: 4 }); return e.words === 7 && !e.answered; })());
ok("K · Eight words is an answer — scored on its merits, not passed", (() => { const e = ME.grade(W4, G4, SAY.eight, { seconds: 4 }); return e.words >= 8 && e.answered && !ME.passes(e) && e.coverage === 0.5; })());
ok("K · The bar is the engine's MIN_WORDS, not a number typed into this suite", ME.MIN_WORDS === 8);

/* ═══════════ L · THE EVIDENCE CONTRACT, UNCHANGED ═══════════════════════ */
console.log("\nL · EVIDENCE");
const row = ME.contract(mk(W4, G4, SAY.noConfirm, "guided", "k1"), meta(W4));
ok("L · A Week 4 row is the same v1 contract: versioned, track-stamped, week 4, competency, mission, kind, key",
  row.v === ME.EVIDENCE_VERSION && row.tk === GE && row.week === 4 && row.competency === "clarify-confirm" && row.missionId === "clarify-confirm-guided" && row.kind === "guided" && row.key === "k1");
ok("L · Its moves map holds exactly the four Week 4 ids, as booleans",
  Object.keys(row.moves).join() === MOVES && Object.values(row.moves).every(v => typeof v === "boolean") && row.moves.confirm === false);
ok("L · Task, clarity, fluency and vocabulary are measured numbers in [0,1] with a stated clarity basis",
  [row.task, row.clarity, row.fluency, row.vocab].every(x => typeof x === "number" && x >= 0 && x <= 1) && ["order", "order+length"].includes(row.clarityBasis));
ok("L · Pronunciation was not measured and is null — never zero", row.pron === null && row.pronSource === null);
ok("L · Transfer is null on a guided attempt and a boolean on a transfer attempt",
  row.transfer === null && typeof ME.contract(mk(W4, T4, SAY.transfer, "transfer", "k2"), meta(W4)).transfer === "boolean");
ok("L · With no duration, seconds and wpm are null, not 0",
  (() => { const r = ME.contract(Object.assign(ME.grade(W4, G4, SAY.strong, {}), { key: "k3", kind: "guided" }), meta(W4)); return r.seconds === null && r.wpm === null; })());
ok("L · Verdict, passed and weakness derive from coverage", row.verdict === "strong" && row.passed === false && row.coverage === 0.75);
ok("L · Vocabulary used lists only the competency's own expressions",
  (() => { const r = ME.grade(W4, G4, "Just to make sure I understand — could you walk me through it? So you're saying the quote first. Before we move on, what we agreed is that I'll send it today.", { seconds: 12 }); return r.vocabUsed.every(w => W4.expressions.some(e => e.w === w)) && r.vocabUsed.length >= 4; })());

/* ═══════════ M–P · PROGRESSION: THE SAME LADDER ═════════════════════════ */
console.log("\nM–P · PROGRESSION");
const L4 = {};
const D = 86400000, T0 = Date.parse("2026-10-05T10:00:00Z");
ok("M · NOT_STARTED before anything", ME.record(L4, W4.id).state === "NOT_STARTED");
ME.introduce(L4, W4.id, GE, T0);
ok("M · SEE/HEAR/NOTICE → INTRODUCED and no further", L4[W4.id].state === "INTRODUCED" && ME.stateFrom(L4[W4.id]) === "INTRODUCED");
ME.addAttempt(L4, W4.id, mk(W4, G4, SAY.noConfirm, "guided", "p1", T0 + 60000), GE, IV, meta(W4));
ok("M · A weak spoken attempt → PRACTICING, with retrieval due now for reason 'practice'",
  L4[W4.id].state === "PRACTICING" && L4[W4.id].retrieval.reason === "practice");
ME.addAttempt(L4, W4.id, mk(W4, G4, SAY.strong, "retry", "p2", T0 + 120000), GE, IV, meta(W4));
ok("M · A full guided answer → DEMONSTRATED, and stops there", L4[W4.id].state === "DEMONSTRATED" && L4[W4.id].retrieval.reason === "transfer");
ME.addAttempt(L4, W4.id, mk(W4, T4, SAY.transfer, "transfer", "p3", T0 + 180000), GE, IV, meta(W4));
ok("N · One cold success → TRANSFER_READY with a spaced retrieval", L4[W4.id].state === "TRANSFER_READY" && L4[W4.id].transfer.passed === 1 && L4[W4.id].retrieval.due > T0 + 180000);
ME.addAttempt(L4, W4.id, mk(W4, T4, SAY.transfer, "transfer", "p4", T0 + 200000), GE, IV, meta(W4));
ok("P · A second cold success the SAME day is still TRANSFER_READY", L4[W4.id].state === "TRANSFER_READY" && L4[W4.id].transfer.passed === 2);
ME.addAttempt(L4, W4.id, mk(W4, T4, SAY.transfer, "transfer", "p5", T0 + 2 * D), GE, IV, meta(W4));
ok("P · A cold success on another day → STRONG", L4[W4.id].state === "STRONG");
ok("O · A failed transfer counts against the tally, never fabricates a pass, and sends the learner back to guided reps",
  (() => { const s = {}; ME.introduce(s, W4.id, GE); ME.addAttempt(s, W4.id, mk(W4, G4, SAY.strong, "guided", "f1"), GE, IV, meta(W4));
    ME.addAttempt(s, W4.id, mk(W4, T4, SAY.transferWeak, "transfer", "f2"), GE, IV, meta(W4));
    const r = ME.recommend(s[W4.id], W4);
    return s[W4.id].state === "DEMONSTRATED" && s[W4.id].transfer.failed === 1 && s[W4.id].transfer.passed === 0 && r.reason === "transfer_failed" && r.action === "retry" && r.missionId === "clarify-confirm-guided"; })());
ok("O · A transfer attempt before any guided success is PRACTICING at most — a cold pass with nothing guided is not DEMONSTRATED",
  (() => { const s = {}; ME.introduce(s, W4.id, GE); ME.addAttempt(s, W4.id, mk(W4, T4, SAY.transferWeak, "transfer", "o1"), GE, IV, meta(W4)); return s[W4.id].state === "PRACTICING"; })());

/* ═══════════ Q · RETRIEVAL ══════════════════════════════════════════════ */
console.log("\nQ · RETRIEVAL");
ok("Q · Below DEMONSTRATED the competency is due now for practice — nothing is spaced that has not been shown",
  (() => { const s = {}; ME.introduce(s, W4.id, GE, T0); ME.addAttempt(s, W4.id, mk(W4, G4, SAY.noAsk, "guided", "q1", T0), GE, IV, meta(W4)); const r = s[W4.id].retrieval; return r.due === T0 && r.reps === 0 && r.reason === "practice"; })());
ok("Q · DEMONSTRATED is due now, for the transfer", (() => { const s = {}; ME.introduce(s, W4.id, GE, T0); ME.addAttempt(s, W4.id, mk(W4, G4, SAY.strong, "guided", "q2", T0), GE, IV, meta(W4)); return s[W4.id].retrieval.reason === "transfer" && s[W4.id].retrieval.due === T0; })());
ok("Q · The first cold success is spaced on the track's own first interval (1 day), the second on the next (3)",
  (() => { const s = {}; ME.introduce(s, W4.id, GE, T0); ME.addAttempt(s, W4.id, mk(W4, G4, SAY.strong, "guided", "q3", T0), GE, IV, meta(W4));
    ME.addAttempt(s, W4.id, mk(W4, T4, SAY.transfer, "transfer", "q4", T0 + 1000), GE, IV, meta(W4)); const a = s[W4.id].retrieval;
    ME.addAttempt(s, W4.id, mk(W4, T4, SAY.transfer, "transfer", "q5", T0 + 2000), GE, IV, meta(W4)); const b = s[W4.id].retrieval;
    return a.reason === "retrieval" && a.due === T0 + 1000 + 1 * D && a.reps === 1 && b.due === T0 + 2000 + 3 * D && b.reps === 2; })());
ok("Q · STRONG counts one more rep and spaces further (7 days)",
  L4[W4.id].state === "STRONG" && L4[W4.id].retrieval.reason === "retrieval" && L4[W4.id].retrieval.reps === 4 && L4[W4.id].retrieval.due === T0 + 2 * D + 21 * D);
ok("Q · A different interval ladder is honoured — the scheduler is the track's, not the engine's",
  (() => { const s = {}; ME.introduce(s, W4.id, GE, T0); ME.addAttempt(s, W4.id, mk(W4, G4, SAY.strong, "guided", "q6", T0), GE, [2, 5], meta(W4));
    ME.addAttempt(s, W4.id, mk(W4, T4, SAY.transfer, "transfer", "q7", T0 + 1000), GE, [2, 5], meta(W4)); return s[W4.id].retrieval.due === T0 + 1000 + 2 * D; })());

/* ═══════════ R · RECOMMENDATION ═════════════════════════════════════════ */
console.log("\nR · RECOMMENDATION");
const R = {};
ok("R · Unspoken → speak the guided mission", (() => { const r = ME.recommend(ME.blank(W4.id), W4, T0); return r.action === "speak" && r.missionId === "clarify-confirm-guided" && r.reason === "not_spoken_yet"; })());
ME.introduce(R, W4.id, GE, T0); ME.addAttempt(R, W4.id, mk(W4, G4, SAY.noRestate, "guided", "s1", T0), GE, IV, meta(W4));
ok("R · Weak → retry the same mission on the missing move", (() => { const r = ME.recommend(R[W4.id], W4, T0); return r.action === "retry" && r.move === "restate" && r.reason === "weak_move" && r.missionId === "clarify-confirm-guided"; })());
ME.addAttempt(R, W4.id, mk(W4, G4, SAY.strong, "retry", "s2", T0 + 1), GE, IV, meta(W4));
ok("R · Demonstrated → take the transfer", (() => { const r = ME.recommend(R[W4.id], W4, T0 + 1); return r.action === "transfer" && r.missionId === "clarify-confirm-transfer" && r.reason === "ready_for_transfer"; })());
ME.addAttempt(R, W4.id, mk(W4, T4, SAY.transfer, "transfer", "s3", T0 + 2), GE, IV, meta(W4));
ok("R · Transfer-ready and not yet due → rest, with the date", (() => { const r = ME.recommend(R[W4.id], W4, T0 + 3); return r.action === "rest" && r.reason === "scheduled" && r.due === R[W4.id].retrieval.due; })());
ok("R · …and once the retrieval is due → a retrieval on the transfer mission", (() => { const r = ME.recommend(R[W4.id], W4, R[W4.id].retrieval.due + 1); return r.action === "retrieval" && r.missionId === "clarify-confirm-transfer" && r.reason === "retrieval_due"; })());
ok("R · Pending coaching outranks everything", (() => { const s = JSON.parse(JSON.stringify(R)); s[W4.id].attempts[0].coachPending = true; const r = ME.recommend(s[W4.id], W4, T0); return r.action === "coach" && r.reason === "coach_pending" && r.n === 1; })());

/* ═══════════ S · CROSS-COMPETENCY: WEEK 4 WAITS ITS TURN ════════════════ */
console.log("\nS · CROSS-COMPETENCY RECOMMENDATION");
const comps = PACK.competencies;
const pick = s => ME.pickNext(comps, id => s[id], Date.now());
const put = (s, c, m, txt, kind, key, at) => { ME.introduce(s, c.id, GE); return ME.addAttempt(s, c.id, mk(c, m, txt, kind, key, at), GE, IV, meta(c)); };
const show = p => p ? `${p.comp.id}:${p.rec.action}:${p.rec.move || "-"}` : "null";
const rest = (s, c, g, t, gs, ts, k) => { put(s, c, g, gs, "guided", k + "g"); put(s, c, t, ts, "transfer", k + "t"); };
ok("S · A fresh learner is offered Week 1 — Week 4 is not pushed forward by being newest", show(pick({})) === "explain-work:speak:-", show(pick({})));
let A = {}; put(A, W1, G1, SAY.w1noWhy, "guided", "a1");
ok("S · A Week 1 weakness is fixed before Week 4 is even mentioned", show(pick(A)) === "explain-work:retry:why", show(pick(A)));
let B = {}; rest(B, W1, G1, T1, SAY.w1strong, SAY.w1transfer, "b1"); rest(B, W2, G2, T2, SAY.w2strong, SAY.w2transfer, "b2"); rest(B, W3, G3, T3, SAY.w3strong, SAY.w3transfer, "b3");
ok("S · With Weeks 1–3 resting, Week 4 is offered to speak — a competency nobody has spoken for is never skipped", show(pick(B)) === "clarify-confirm:speak:-", show(pick(B)));
rest(B, W4, G4, T4, SAY.strong, SAY.transfer, "b4");
/* V2.5/V2.6: every competency after Week 4, in week order. With everything
   before it resting, each is offered to speak — a competency nobody has spoken
   for is never skipped — and only when the last one rests too is nothing
   pushed. Walks the pack, so a new week never changes this block. */
const LATER = PACK.competencies.filter(c => c.week > 4).sort((a, b) => a.week - b.week);
ok("S · Every competency after Week 4 has a cold-transfer fixture in this suite", LATER.length >= 1 && LATER.every(c => typeof SAY.transfers[c.id] === "string"), LATER.map(c => c.id).join());
LATER.forEach(c => {
  ok(`S · With everything before it resting, ${c.id} (Week ${c.week}) is offered to speak — it is not skipped`, show(pick(B)) === `${c.id}:speak:-`, show(pick(B)));
  const g = (c.missions || []).find(m => m.kind === "guided"), t = (c.missions || []).find(m => m.kind === "transfer");
  rest(B, c, g, t, g.hear.model, SAY.transfers[c.id], "b" + c.week);
});
ok("S · With every competency resting, nothing is pushed and the old advice stands", pick(B) === null, show(pick(B)));
let C = {}; put(C, W1, G1, SAY.w1strong, "guided", "c1"); put(C, W4, G4, SAY.noConfirm, "guided", "c2");
ok("S · A Week 4 weak move outranks a Week 1 pending transfer — evidence priority, not week order", show(pick(C)) === "clarify-confirm:retry:confirm", show(pick(C)));
let Dd = {}; put(Dd, W1, G1, SAY.w1noWhy, "guided", "d1"); put(Dd, W4, G4, SAY.noConfirm, "guided", "d2");
ok("S · Two equally urgent retries → the earlier week, and only as a tie-break", show(pick(Dd)) === "explain-work:retry:why", show(pick(Dd)));
let E = {}; put(E, W3, G3, SAY.w3strong, "guided", "e1"); put(E, W4, G4, SAY.noAsk, "guided", "e2");
ok("S · Week 4 weak vs Week 3 ready for transfer → Week 4's retry", show(pick(E)) === "clarify-confirm:retry:ask", show(pick(E)));
ok("S · Pending coaching on Week 4 outranks a Week 1 retry",
  (() => { const s = {}; put(s, W1, G1, SAY.w1noWhy, "guided", "i1"); const r = put(s, W4, G4, SAY.noFlag, "guided", "i2"); r.attempt.coachPending = true; return show(pick(s)) === "clarify-confirm:coach:flag"; })());
ok("S · Four records, keyed by competency id — never by week", (() => { const s = {}; [W1, W2, W3].forEach((c, i) => put(s, c, c.missions[0], "x", "guided", "k" + i)); put(s, W4, G4, "x", "guided", "k4"); return Object.keys(s).sort().join() === "clarify-confirm,clear-update,explain-work,raise-problem"; })());
ok("S · A Week 4 attempt changes none of the other three records",
  (() => { const s = {}; put(s, W1, G1, SAY.w1noWhy, "guided", "m1"); put(s, W2, G2, SAY.w2strong, "guided", "m2"); put(s, W3, G3, SAY.w3strong, "guided", "m3");
    const before = JSON.stringify([s[W1.id], s[W2.id], s[W3.id]]); put(s, W4, G4, SAY.noConfirm, "guided", "m4"); return JSON.stringify([s[W1.id], s[W2.id], s[W3.id]]) === before && s[W4.id].state === "PRACTICING"; })());

/* ═══════════ V (Node half) · IDEMPOTENCY AND THE WALL ═══════════════════ */
console.log("\nV · IDEMPOTENCY (engine)");
ok("V · The same key twice in Week 4 is one row, reported as a duplicate",
  (() => { const s = {}; put(s, W4, G4, SAY.strong, "guided", "dup"); return put(s, W4, G4, SAY.strong, "guided", "dup").duplicate && s[W4.id].attempts.length === 1; })());
ok("V · The same key in Week 4 and Week 3 is two rows, one each — idempotency is per competency",
  (() => { const s = {}; put(s, W3, G3, SAY.w3strong, "guided", "same"); const r = put(s, W4, G4, SAY.strong, "guided", "same"); return !r.duplicate && s[W3.id].attempts.length === 1 && s[W4.id].attempts.length === 1; })());
ok("V · Week 4 attempts are bounded at 60", (() => { const s = {}; for (let i = 0; i < 70; i++) put(s, W4, G4, SAY.strong, "guided", "b" + i, T0 + i); return s[W4.id].attempts.length === 60; })());
console.log("\nU · WELDING WALL (engine)");
ok("U · The engine refuses a Week 4 write for any area but General English — and does not create a record",
  (() => { const s = {}; return ME.addAttempt(s, W4.id, mk(W4, G4, SAY.strong, "guided", "w"), "welding", IV, meta(W4)) === null && ME.introduce(s, W4.id, "welding") === null
    && ME.addSupport(s, W4.id, { key: "x", at: 1 }, "welding") === null && Object.keys(s).length === 0; })());
ok("U · guard() accepts only the pack's own track constant", ME.guard(GE) === true && ME.guard("welding") === false && ME.guard("") === true && ME.TRACK === GE);

/* ═══════════ AI COACH: CONTEXT AND BOUNDARY FOR WEEK 4 ══════════════════ */
console.log("\nAI COACH");
const st4 = {}; put(st4, W4, G4, SAY.noConfirm, "guided", "ai0");
const ctx = ME.aiContext(st4[W4.id], W4, G4, { weakness: "confirm" });
const ctxJson = JSON.stringify(ctx);
ok("The context carries competency clarify-confirm, the task, the pattern, four moves with hints, the weakness, evidence counts and one attempt summary",
  ctx.track === GE && ctx.competency === "clarify-confirm" && ctx.prompt === G4.prompt && ctx.pattern === W4.pattern
  && ctx.targetMoves.length === 4 && ctx.targetMoves.every(m => m.id && m.label && m.hint) && ctx.currentWeakness === "confirm"
  && ctx.recentEvidence.attempts === 1 && ctx.previousAttemptSummary && ctx.previousAttemptSummary.moves.confirm === false);
ok("It carries NO transcript, no attempt history, no profile and no state machine",
  !ctxJson.includes(SAY.noConfirm.slice(0, 30)) && !("said" in ctx.previousAttemptSummary) && !ctxJson.includes("\"attempts\":[") && !/profile|streak|\"name\"/i.test(ctxJson) && !("state" in ctx));
ok("It carries nothing from the other competencies", !/explain-work|clear-update|raise-problem|mitigate|\"role\"/.test(ctxJson));
const prompt = ME.coachPrompt(ctx, "SPOKEN RULE");
ok("The prompt names four moves, Week 4's shape and labels, and the existing {reply, covered} route",
  /makes 4 communication/.test(prompt) && /confirm \(Confirm the next step\)/.test(prompt) && /flag \(Flag the gap\)/.test(prompt) && prompt.includes(W4.pattern) && /"covered"/.test(prompt) && /"reply"/.test(prompt) && prompt.includes("SPOKEN RULE"));
const evAI = mk(W4, G4, SAY.noConfirm, "guided", "ai1");
ME.applyCoachMoves(evAI, W4, ["confirm"]);
ok("The model MAY add the confirmation it heard in the learner's own words", evAI.moves.confirm === true && evAI.coverage === 1 && evAI.assisted === true);
const evKeep = mk(W4, G4, SAY.strong, "guided", "ai2"); ME.applyCoachMoves(evKeep, W4, []);
ok("The model CANNOT remove a move the learner made", evKeep.coverage === 1);
const evJunk = mk(W4, G4, SAY.noConfirm, "guided", "ai3"); ME.applyCoachMoves(evJunk, W4, ["ask", "issue", "status", "__proto__", "state", "passed", 42, null]);
ok("Other competencies' move ids and non-moves are dropped on the floor", evJunk.moves.confirm === false && Object.keys(evJunk.moves).join() === MOVES && !("state" in evJunk.moves));
const shaped = ME.shapeCoach({ reply: "y".repeat(500), covered: ["confirm"], state: "STRONG", score: 100, passed: true }, W4, evAI);
ok("Model output is capped and carries no state or score into the app", shaped.improve.length <= 240 && !("state" in shaped) && !("score" in shaped) && !("passed" in shaped) && shaped.ai === true);

/* ═══════════ PROGRESS SUMMARY (Node) ════════════════════════════════════ */
console.log("\nY · PROGRESS SUMMARY (engine)");
const ps = ME.progressSummary(L4[W4.id], W4);
ok("Y · The summary carries Week 4, its state, four per-move counts and measured dimensions, with pronunciation null and no Shadow support",
  ps.competency === "clarify-confirm" && ps.week === 4 && ps.state === "STRONG" && ps.byMove.length === 4 && ps.byMove.map(m => m.id).join() === MOVES
  && ps.byMove.every(m => m.of === 5) && ps.byMove.find(m => m.id === "confirm").made === 4 && ps.pron === null && ps.pronSource === null && ps.shadow.total === 0 && ps.transferPassed === 3);

/* ═══════════ BROWSER ════════════════════════════════════════════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8071, 8072, 8073, 8074, 8075]) {
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
    if (b.assess) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ overall: 84, mode: "ai", words: [{ word: "a", score: 84 }] }) });
    if (b.chat) lastSystem = String(b.chat.system || "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Finish by saying what you will do and by when, then ask if that works.", covered: coachCovered }) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?w4=" + Date.now(), { waitUntil: "load" });
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
const rec4 = (page, id) => page.evaluate(i => JSON.parse(JSON.stringify(mvStore()[i] || {})), id);
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: innerWidth }));
const shot = async (page, name) => { if (SHOTS) { try { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); } catch (e) {} } };
/* Put Weeks 1–3 to rest inside the page, through the engine, so the only
   question left for Home is whether Week 4 is offered when — and only when —
   it is the next best mission. */
const restWeeks123 = page => page.evaluate(({ SAY }) => {
  const P = mvPack(), st = mvStore(), IV = trackVocabularyIntervals();
  const meta = c => ({ competency: c.id, week: c.week, moveIds: MissionEngine.moveIds(c) });
  const one = (cid, mid, text, kind, key) => { const c = MissionEngine.competencyOf(P, cid), m = MissionEngine.missionOf(c, mid);
    MissionEngine.introduce(st, cid, areaId()); const ev = Object.assign(MissionEngine.grade(c, m, text, { seconds: 27 }), { key, kind, missionId: mid, at: Date.now() - 60000 });
    MissionEngine.addAttempt(st, cid, ev, areaId(), IV, meta(c)); };
  one("explain-work", "explain-work-guided", SAY.w1strong, "guided", "z1"); one("explain-work", "explain-work-transfer", SAY.w1transfer, "transfer", "z2");
  one("clear-update", "clear-update-guided", SAY.w2strong, "guided", "z3"); one("clear-update", "clear-update-transfer", SAY.w2transfer, "transfer", "z4");
  one("raise-problem", "raise-problem-guided", SAY.w3strong, "guided", "z5"); one("raise-problem", "raise-problem-transfer", SAY.w3transfer, "transfer", "z6");
  save();
  return ["explain-work", "clear-update", "raise-problem"].map(id => st[id].state).join();
}, { SAY });

console.log("\nX · HOME / TODAY");
const L = await learner("ge", GE);
const home0 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, today: document.querySelectorAll(".today-card").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText }; });
ok("X1 · A fresh learner's Home offers ONE V2 card and it is Week 1 — Week 4 does not appear prematurely",
  home0.n === 1 && home0.today <= 1 && /Week 1/i.test(home0.eyebrow || "") && /Explain what you do/i.test(home0.title || ""), JSON.stringify(home0));
const rested = await restWeeks123(L.page);
ok("X2 · Weeks 1–3 are transfer-ready in this learner's store (seeded through the engine, not by hand)", rested === "TRANSFER_READY,TRANSFER_READY,TRANSFER_READY", rested);
const home1 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText, chip: c && c.querySelector(".chip").innerText, btn: c && c.querySelector("button").innerText, line: c && c.querySelector("p").innerText }; });
ok("X3 · Now Home's one card is Week 4, 'Not started', with 'Start the mission' and the not-spoken-yet line — chosen by the engine's own priority, nothing hardcoded",
  home1.n === 1 && /Week 4/i.test(home1.eyebrow || "") && /Clarifying, asking questions/i.test(home1.title || "") && /not started/i.test(home1.chip || "") && /start the mission/i.test(home1.btn || "") && /say it out loud once/i.test(home1.line || ""), JSON.stringify(home1));
const ovh = await overflow(L.page); ok("X3 · Home has no horizontal overflow at 390px with the Week 4 card", ovh.sw <= ovh.cw, JSON.stringify(ovh));
await shot(L.page, "390-home-week4");
const coachRec = await L.page.evaluate(() => ({ a: AdaptiveLearningEngine.recommendation(S, ProfessionalTrackContext.active()), m: LearningCoach.mission(S, ProfessionalTrackContext.active()) }));
ok("X4 · The Adaptive engine and the LearningCoach both surface Week 4 through the existing hooks, opening the guided mission at SEE",
  coachRec.a.v2 === true && /Clarifying, asking questions/i.test(coachRec.a.title) && coachRec.m.v2 === true && coachRec.m.arg1 === "clarify-confirm-guided" && coachRec.m.arg2 === "speak" && coachRec.m.go === "mission", JSON.stringify({ t: coachRec.a.title, arg: coachRec.m.arg1, a2: coachRec.m.arg2 }));
const opened = await L.page.evaluate(async () => { LearningCoach.openMission(); await new Promise(r => setTimeout(r, 400)); return { v: cur.v, comp: _mv && _mv.compId, mission: _mv && _mv.missionId }; });
ok("X5 · LearningCoach.openMission() lands on the Week 4 mission", opened.v === "mission" && opened.comp === "clarify-confirm" && opened.mission === "clarify-confirm-guided", JSON.stringify(opened));

/* SEE → HEAR → NOTICE for Week 4 */
console.log("\nTHE LOOP · SEE → HEAR → NOTICE");
await L.page.evaluate(() => mvGo("clarify-confirm-guided", "see")); await sleep(350);
const see = await L.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), state: (mvStore()["clarify-confirm"] || {}).state, cta: document.querySelectorAll("#v-mission .mv-cta").length, back: !!document.querySelector("#v-mission > .mv-back") }));
ok("SEE renders Week 4's title, the manager's vague instruction and the goal, with one action and a way back — and is worth INTRODUCED only",
  /Clarifying, asking questions/i.test(see.txt) && /usual metrics/i.test(see.txt) && /Don't just say yes/i.test(see.txt) && /Step 1 of 7/i.test(see.txt) && see.cta === 1 && see.back && see.state === "INTRODUCED", see.txt.slice(0, 160));
const ovs = await overflow(L.page); ok("SEE has no horizontal overflow at 390px", ovs.sw <= ovs.cw, JSON.stringify(ovs));
await shot(L.page, "390-see");
await L.page.evaluate(() => mvStep("hear")); await sleep(300);
const hear = await L.page.evaluate(() => { const vis = () => /same six metrics as March/i.test(document.getElementById("v-mission").innerText);
  const hidden = !vis(), play = document.querySelectorAll(".mv-play button").length, reveal = !!document.querySelector(".mv-reveal");
  document.querySelector(".mv-reveal").click();
  return { hidden, play, reveal, shownAfter: vis(), heard: (window.__ev || []).some(e => e[0] === "v2_mission_heard") }; });
ok("HEAR is voice-first: two play buttons, Week 4's model hidden until 'Show the words', and the heard event logged",
  hear.hidden && hear.play === 2 && hear.reveal && hear.shownAfter && hear.heard, JSON.stringify(hear));
await shot(L.page, "390-hear");
await L.page.evaluate(() => mvStep("notice")); await sleep(350);
const notice = await L.page.evaluate(() => ({
  moves: [...document.querySelectorAll(".mv-list li b")].map(b => b.innerText),
  eyebrow: (document.querySelector(".mv-notice .eyebrow") || {}).innerText, sub: (document.querySelector(".mv-notice .sub") || {}).innerText,
  shadow: !!document.querySelector(".mv-shadow"), cta: document.querySelectorAll("#v-mission .mv-cta").length }));
ok("NOTICE renders the four Week 4 moves by label, says '4 moves', and — with no clip linked — shows NO Shadow row",
  notice.moves.join() === "Flag the gap,Ask one question,Say it back,Confirm the next step" && /4 moves/i.test(notice.eyebrow + " " + notice.sub) && notice.shadow === false && notice.cta === 1, JSON.stringify(notice));
const ovn = await overflow(L.page); ok("NOTICE has no horizontal overflow at 390px", ovn.sw <= ovn.cw, JSON.stringify(ovn));
await shot(L.page, "390-notice");
const noType = await L.page.evaluate(() => ({ ta: document.querySelectorAll("#v-mission textarea").length, inp: document.querySelectorAll("#v-mission input[type=text]").length, sc: document.querySelectorAll("#v-mission .score-b").length }));
ok("Week 4 is voice-first — no script box, no text input, no self-score", noType.ta === 0 && noType.inp === 0 && noType.sc === 0, JSON.stringify(noType));

/* ── SPEAK → COACH (weak) ── */
console.log("\nSPEAK → COACH");
await L.page.evaluate(() => mvStep("speak")); await sleep(250);
const spk = await L.page.evaluate(() => ({ btn: document.querySelectorAll("#v-mission .rec-btn").length, prompt: (document.querySelector(".mv-q") || {}).innerText, ctx: !!document.querySelector(".mv-ctx"), state: (document.getElementById("recState") || {}).innerText }));
ok("SPEAK shows the manager's line, the context and one recorder in its idle state", spk.btn === 1 && /usual metrics/i.test(spk.prompt || "") && spk.ctx && /record your answer/i.test(spk.state || ""), JSON.stringify(spk));
await shot(L.page, "390-speak");
coachCovered = ["flag", "ask", "restate"];
await L.page.evaluate(t => { window.__say = t; }, SAY.noConfirm);
await L.page.evaluate(() => mvRecord());
await L.page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
const recording = await L.page.evaluate(() => ({ cls: document.querySelector("#v-mission .rec-btn").className, state: (document.getElementById("recState") || {}).innerText, rec: !!_mv.recording }));
ok("While recording, the button is in its recording state and the label says so", /recording/.test(recording.cls) && /listening/i.test(recording.state || "") && recording.rec, JSON.stringify(recording));
await shot(L.page, "390-recording");
await sleep(1200);
await L.page.evaluate(() => mvRecord());
await L.page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
await sleep(250);
const b1 = await L.page.evaluate(() => ({ moves: _mv.ev.moves, cov: _mv.ev.coverage, move: _mv.coach.move, ai: _mv.coach.ai, chips: document.querySelectorAll(".mv-move").length, off: document.querySelectorAll(".mv-move.off").length, improve: (document.querySelector(".mv-improve") || {}).innerText, step: _mv.step }));
ok("B1 · the missing confirmation is identified from what was said; four chips render, one off",
  b1.moves.confirm === false && b1.cov === 0.75 && b1.move === "confirm" && b1.chips === 4 && b1.off === 1 && b1.step === "coach", JSON.stringify({ c: b1.cov, m: b1.move, chips: b1.chips, off: b1.off }));
ok("B2 · three of four does not advance the learner", (await rec4(L.page, "clarify-confirm")).state === "PRACTICING");
ok("B3 · the coach's system prompt carried Week 4's four moves — not Week 3's ask or Week 2's status",
  /makes 4 communication/.test(lastSystem) && /confirm \(Confirm the next step\)/.test(lastSystem) && !/ask \(What I need\)/.test(lastSystem) && !/status \(/.test(lastSystem) && !/role \(/.test(lastSystem), lastSystem.slice(0, 90));
ok("B4 · the coaching shown is the model's and is tagged as such", b1.ai === true && /by when/i.test(b1.improve || ""));
const ovc = await overflow(L.page); ok("COACH has no horizontal overflow at 390px", ovc.sw <= ovc.cw, JSON.stringify(ovc));
await shot(L.page, "390-coach");

/* ── RETRY ── */
console.log("\nRETRY");
const retry = await L.page.evaluate(() => { mvRetry(); return { text: _mv.retryText, step: _mv.step, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText }; });
ok("C1 · the retry names the Week 4 move that was missed, in the pack's own words, on the retry step", /who does what, by when/i.test(retry.text || "") && retry.step === "speak" && /one more time/i.test(retry.eyebrow || ""), JSON.stringify(retry));
await shot(L.page, "390-retry");
coachCovered = ["flag", "ask", "restate", "confirm"];
await speak(L.page, SAY.strong);
const c2 = await rec4(L.page, "clarify-confirm");
ok("C2 · the retry is stored as a retry; both attempts are preserved", c2.attempts.length === 2 && c2.attempts[0].coverage === 0.75 && c2.attempts[1].kind === "retry" && c2.attempts[1].coverage === 1);
ok("C3 · progression recalculates to DEMONSTRATED", c2.state === "DEMONSTRATED", c2.state);
const transferBtn = await L.page.evaluate(() => [...document.querySelectorAll(".mv-acts button")].map(b => b.innerText).join("|"));
ok("C4 · once demonstrated, the coach screen offers the new situation", /take the new situation/i.test(transferBtn), transferBtn);

/* ── TRANSFER ── */
console.log("\nTRANSFER");
await L.page.evaluate(() => mvGo("clarify-confirm-transfer", "speak")); await sleep(300);
const tp = await L.page.evaluate(() => ({ q: (document.querySelector(".mv-q") || {}).innerText, comp: _mv.compId, kind: _mv.kind, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText, instr: (document.querySelector(".mv-instruction") || {}).innerText }));
ok("D1 · the transfer is a different situation, still Week 4, framed as the new situation with the cold goal",
  /sort out the client thing/i.test(tp.q || "") && tp.comp === "clarify-confirm" && tp.kind === "transfer" && /new situation/i.test(tp.eyebrow || "") && /nobody is prompting you/i.test(tp.instr || ""), JSON.stringify(tp));
await shot(L.page, "390-transfer");
await speak(L.page, SAY.transfer);
const d2 = await rec4(L.page, "clarify-confirm");
ok("D2 · transfer evidence is stored as its own kind, separate from practice", d2.attempts.length === 3 && d2.attempts[2].kind === "transfer" && d2.attempts[2].transfer === true);
ok("D3 · one cold success is TRANSFER_READY, not STRONG", d2.state === "TRANSFER_READY" && d2.transfer.passed === 1, d2.state);
ok("D4 · a retrieval is scheduled from the track's own intervals", d2.retrieval && d2.retrieval.reason === "retrieval" && d2.retrieval.due > Date.now());
await L.page.evaluate(() => mvStep("done")); await sleep(300);
const done = await L.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), bars: document.querySelectorAll(".mv-bars > *").length, chips: document.querySelectorAll(".mv-move").length, shadowNote: !!document.querySelector(".mv-shadow-note") }));
ok("D5 · the evidence screen shows the state, four chips and the dimension bars — pronunciation as a number here because the (mocked) audio grader measured it — and no Shadow line",
  /transfer ready/i.test(done.txt) && done.bars >= 5 && done.chips === 4 && /84%/.test(done.txt) && done.shadowNote === false, done.txt.slice(0, 160));
const ovd = await overflow(L.page); ok("Evidence screen has no horizontal overflow at 390px", ovd.sw <= ovd.cw, JSON.stringify(ovd));
await shot(L.page, "390-evidence");

/* ── Y · PROGRESS / PASSPORT ── */
console.log("\nY · PROGRESS");
const prog = await L.page.evaluate(() => { go("review"); const ps = [...document.querySelectorAll(".pg-v2")]; const d = window.v2Evidence();
  return { panels: ps.length, txt: ps.map(p => p.innerText.replace(/\s+/g, " ")).join(" || "), comps: d.map(x => x.competency + ":" + x.state), weeks: d.map(x => x.week).join(), moves: d.map(x => (x.byMove || []).length).join(), last: d[d.length - 1] }; });
ok("Y1 · Progress renders four competencies oldest week first, 1 → 2 → 3 → 4, with move counts 5 / 4 / 5 / 4",
  prog.panels === 4 && prog.weeks === "1,2,3,4" && prog.moves === "5,4,5,4" && prog.comps[3] === "clarify-confirm:TRANSFER_READY", JSON.stringify({ p: prog.panels, w: prog.weeks, m: prog.moves, c: prog.comps }));
ok("Y2 · The Week 4 panel names its week, its state and its own moves through the same evidence contract",
  /Week 4/.test(prog.txt) && /Confirm the next step/.test(prog.txt) && /Flag the gap/.test(prog.txt) && prog.last.week === 4 && prog.last.attempts === 3 && prog.last.passed === 2 && prog.last.transferPassed === 1 && prog.last.pron === 84 && prog.last.pronSource === "audio", JSON.stringify({ w: prog.last.week, a: prog.last.attempts, p: prog.last.passed }));
const ovp = await overflow(L.page); ok("Progress has no horizontal overflow at 390px with four panels", ovp.sw <= ovp.cw, JSON.stringify(ovp));
await shot(L.page, "390-progress");
/* V2.5: with Weeks 1–4 resting the engine offers Week 5 — a competency nobody
   has spoken for is never skipped — and only once that rests too is Home silent. */
const afterAll = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home"); return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText }; });
ok("Y3 · With all four competencies resting, Home's one card is the next competency (Week 5), not nothing", afterAll.n === 1 && /Week 5/i.test(afterAll.eyebrow || ""), JSON.stringify(afterAll));
/* …then each later competency in turn: offered on Home, rested through the
   engine, until the last one rests and Home is silent. Walks the pack. */
for (const c of LATER) {
  const step = await L.page.evaluate(({ id, transfer }) => {
    go("home"); const before = document.querySelector(".mv-home");
    const offered = before ? before.querySelector(".eyebrow").innerText : "";
    const comp = mvComp(id), st = mvStore(), IV = trackVocabularyIntervals();
    const meta = { competency: comp.id, week: comp.week, moveIds: MissionEngine.moveIds(comp) };
    const one = (m, text, kind, key) => { MissionEngine.introduce(st, comp.id, areaId()); const ev = Object.assign(MissionEngine.grade(comp, m, text, { seconds: 27 }), { key, kind, missionId: m.id, at: Date.now() - 60000 }); MissionEngine.addAttempt(st, comp.id, ev, areaId(), IV, meta); };
    const g = comp.missions.find(m => m.kind === "guided"), t = comp.missions.find(m => m.kind === "transfer");
    one(g, g.hear.model, "guided", "zg" + comp.week); one(t, transfer, "transfer", "zt" + comp.week);
    save(); go("home"); return { offered, state: st[comp.id].state, n: document.querySelectorAll(".mv-home").length };
  }, { id: c.id, transfer: SAY.transfers[c.id] });
  ok(`Y3b · With everything before it resting, Home's one card is ${c.id} (Week ${c.week}); resting it makes it transfer-ready`, new RegExp("Week " + c.week, "i").test(step.offered) && step.state === "TRANSFER_READY", JSON.stringify(step));
}
const afterLast = await L.page.evaluate(() => { go("home"); return { n: document.querySelectorAll(".mv-home").length, card: !!document.querySelector(".mv-home") }; });
ok("Y3c · With every competency resting, Home shows no V2 card and looks as it did before V2 — the old advice stands", afterLast.n === 0 && afterLast.card === false, JSON.stringify(afterLast));
const voc = await L.page.evaluate(() => Object.entries(areaVocab()).filter(([, v]) => v.src && v.src.v2 === "clarify-confirm").map(([w]) => w));
ok("Y4 · Week 4 expressions were acquired automatically, tagged to Week 4", voc.length > 0 && voc.every(w => W4.expressions.some(e => e.w === w)), JSON.stringify(voc));

/* ── T · ANALYTICS ── */
console.log("\nT · ANALYTICS");
const ev = await L.page.evaluate(() => (window.__ev || []).filter(e => e[0].startsWith("v2_") && e[1].competency === "clarify-confirm").map(e => [e[0], e[1].track, e[1].week, e[1].competency, e[1].mission]));
ok("T1 · every Week 4 analytics event carries track general-english, week '4' and competency clarify-confirm",
  ev.length >= 10 && ev.every(e => e[1] === GE && e[2] === "4" && e[3] === "clarify-confirm"), JSON.stringify(ev.slice(0, 4)));
const evNames = [...new Set(ev.map(e => e[0]))];
const ALL11 = ["v2_mission_started", "v2_mission_heard", "v2_speak_attempt", "v2_coach_generated", "v2_evidence_recorded", "v2_retry_attempt", "v2_transfer_started", "v2_transfer_completed", "v2_competency_progressed", "v2_retrieval_scheduled", "v2_recommendation_generated"];
ok("T2 · the loop emitted all eleven existing v2_* names for Week 4 and nothing else",
  ALL11.every(n => evNames.includes(n)) && evNames.every(n => ALL11.includes(n)), evNames.join());
const evProps = await L.page.evaluate(() => (window.__ev || []).filter(e => e[0].startsWith("v2_")).map(e => e[1]));
ok("T3 · every prop key on those events is one the Worker already knows (track, week, competency, mission, kind, move, result, band, state, from, attempt, ai)",
  evProps.every(p => Object.keys(p).every(k => ["track", "week", "competency", "mission", "kind", "move", "result", "band", "state", "from", "attempt", "ai"].includes(k))));
ok("T4 · the move and state values are Week 4's own enums", evProps.every(p => !p.move || ["flag", "ask", "restate", "confirm", "none"].includes(p.move) || p.mission === "shadow") && evProps.some(p => p.state === "TRANSFER_READY" && p.from === "DEMONSTRATED"));
const pii = JSON.stringify(evProps);
ok("T5 · no event carries a transcript, the profile name or the goal", !/dashboard|metrics|client thing|\"T\"|confidence in meetings/i.test(pii));
const nonV2 = await L.page.evaluate(() => (window.__ev || []).map(e => e[0]).filter(n => !n.startsWith("v2_")));
ok("T6 · the mission emitted no V1 session_complete — V1 and V2 keep their own completion events", !nonV2.includes("session_complete"), nonV2.join());

/* ── W · CLOUD MERGE ── */
console.log("\nW · CLOUD MERGE");
const merged = await L.page.evaluate(({ SAY }) => {
  const c = mvComp("clarify-confirm"), g = MissionEngine.missionOf(c, "clarify-confirm-guided");
  const meta = { competency: c.id, week: c.week, moveIds: MissionEngine.moveIds(c) };
  const att = (key, text, at) => Object.assign(MissionEngine.grade(c, g, text, { seconds: 20 }), { key, kind: "guided", missionId: g.id, at });
  const local = JSON.parse(JSON.stringify(S)), cloud = JSON.parse(JSON.stringify(S));
  local.v2A = { "general-english": {} }; cloud.v2A = { "general-english": {} };
  const IV = trackVocabularyIntervals();
  MissionEngine.introduce(local.v2A["general-english"], c.id, areaId(), 1e12);
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("a", SAY.noConfirm, 1e12 + 1), areaId(), IV, meta);
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.introduce(cloud.v2A["general-english"], c.id, areaId(), 1e12 + 5);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("c", SAY.noFlag, 1e12 + 3), areaId(), IV, meta);
  const m = fbMerge(local, cloud);
  const r = m.v2A["general-english"]["clarify-confirm"];
  const payload = fbSyncPayload(m);
  const pr = payload.v2A["general-english"]["clarify-confirm"];
  return { keys: r.attempts.map(a => a.key).join(), state: r.state, introducedAt: r.introducedAt, saidLocal: r.attempts.every(a => typeof a.said === "string" && a.said.length > 0), saidCloud: pr.attempts.every(a => !("said" in a)), weeks: r.attempts.every(a => a.week === 4 && a.competency === "clarify-confirm"), welding: Object.keys(m.v2A).join() };
}, { SAY });
ok("W1 · Two devices' Week 4 attempts union on the idempotency key: a, b, c — b once", merged.keys === "a,b,c", merged.keys);
ok("W2 · The merged state is recomputed from the merged evidence (a full guided pass is in it → DEMONSTRATED), and introducedAt is the earliest", merged.state === "DEMONSTRATED" && merged.introducedAt === 1e12, JSON.stringify(merged));
ok("W3 · The learner's words stay on the device: `said` survives locally and is stripped from the sync payload; every row is still week 4 / clarify-confirm", merged.saidLocal && merged.saidCloud && merged.weeks);
ok("W4 · The merge created no Welding bucket", merged.welding === "general-english", merged.welding);

/* ── DESKTOP ── */
console.log("\nUI · DESKTOP");
const Dk = await learner("desk", GE, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
await restWeeks123(Dk.page);
const dkHome = await Dk.page.evaluate(async () => { go("home"); await new Promise(r => setTimeout(r, 300)); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, o: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth } }; });
ok("Desktop: Home offers the Week 4 card with no horizontal overflow", dkHome.n === 1 && /Week 4/i.test(dkHome.eyebrow || "") && dkHome.o.sw <= dkHome.o.cw, JSON.stringify(dkHome));
await shot(Dk.page, "1280-home");
const dk = await Dk.page.evaluate(async () => {
  const o = () => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth });
  mvGo("clarify-confirm-guided", "notice"); await new Promise(r => setTimeout(r, 400));
  const o1 = o(), moves = document.querySelectorAll(".mv-list li").length;
  mvStep("speak"); await new Promise(r => setTimeout(r, 300));
  const o2 = o(), cta = document.querySelectorAll("#v-mission .rec-btn").length;
  return { o1, o2, moves, cta }; });
ok("Desktop: NOTICE lists four moves and SPEAK has one recorder, with no horizontal overflow on either",
  dk.moves === 4 && dk.cta === 1 && dk.o1.sw <= dk.o1.cw && dk.o2.sw <= dk.o2.cw, JSON.stringify(dk));
await shot(Dk.page, "1280-speak");
coachCovered = ["flag", "ask", "restate"];
await speak(Dk.page, SAY.noConfirm);
const dkCoach = await Dk.page.evaluate(() => ({ step: _mv.step, chips: document.querySelectorAll(".mv-move").length, off: document.querySelectorAll(".mv-move.off").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, acts: document.querySelectorAll(".mv-acts button").length }));
ok("Desktop: COACH renders four chips (one off) and its actions with no overflow", dkCoach.step === "coach" && dkCoach.chips === 4 && dkCoach.off === 1 && dkCoach.acts >= 2 && dkCoach.sw <= dkCoach.cw, JSON.stringify(dkCoach));
await shot(Dk.page, "1280-coach");
const dkRetry = await Dk.page.evaluate(() => { mvRetry(); return { step: _mv.step, text: _mv.retryText }; });
ok("Desktop: RETRY names the missing move", dkRetry.step === "speak" && /who does what, by when/i.test(dkRetry.text || ""));
coachCovered = ["flag", "ask", "restate", "confirm"];
await speak(Dk.page, SAY.strong);
await Dk.page.evaluate(() => mvGo("clarify-confirm-transfer", "speak")); await sleep(300);
const dkT = await Dk.page.evaluate(() => ({ kind: _mv.kind, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
ok("Desktop: TRANSFER opens with no overflow", dkT.kind === "transfer" && dkT.sw <= dkT.cw, JSON.stringify(dkT));
await speak(Dk.page, SAY.transfer);
await Dk.page.evaluate(() => mvStep("done")); await sleep(300);
const dkDone = await Dk.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), chips: document.querySelectorAll(".mv-move").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
ok("Desktop: EVIDENCE shows transfer ready with four chips and no overflow", /transfer ready/i.test(dkDone.txt) && dkDone.chips === 4 && dkDone.sw <= dkDone.cw, dkDone.txt.slice(0, 120));
await shot(Dk.page, "1280-evidence");
const dkProg = await Dk.page.evaluate(async () => { go("review"); await new Promise(r => setTimeout(r, 300)); return { panels: document.querySelectorAll(".pg-v2").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("Desktop: PROGRESS renders the four panels with no overflow", dkProg.panels === 4 && dkProg.sw <= dkProg.cw, JSON.stringify(dkProg));
await shot(Dk.page, "1280-progress");

/* ── V (browser half) · OFFLINE / IDEMPOTENCY ── */
console.log("\nV · NETWORK FAILURE");
const O = await learner("off", GE);
await O.page.evaluate(() => mvGo("clarify-confirm-guided", "speak")); await sleep(300);
coachMode = "abort";
const hits0 = polishHits;
await speak(O.page, SAY.strong);
const e1 = await O.page.evaluate(async () => { const r = mvStore()["clarify-confirm"]; const recs = await getRecs(_mv.recCtx);
  return { n: r.attempts.length, said: !!r.attempts[0].said, cov: r.attempts[0].coverage, pending: r.attempts[0].coachPending, state: r.state, audio: recs.length, offline: _mv.coach && _mv.coach.offline, move: _mv.coach && _mv.coach.move, pron: r.attempts[0].pron, key: r.attempts[0].key }; });
ok("V1 · attempt, transcript and audio survive; evidence is correct and was computed on the device", e1.n === 1 && e1.said && e1.audio === 1 && e1.cov === 1 && e1.state === "DEMONSTRATED", JSON.stringify(e1));
ok("V2 · coaching is pending; the deterministic fallback is shown; pronunciation is null, not 0", e1.pending === true && e1.offline === true && e1.pron === null, JSON.stringify(e1));
const dupe = await O.page.evaluate(() => { const c = mvComp("clarify-confirm"); const before = mvStore()["clarify-confirm"].attempts.length;
  mvCommit(c, _mv.ev, _mv.coach); mvCommit(c, _mv.ev, _mv.coach); return { before, after: mvStore()["clarify-confirm"].attempts.length, key: _mv.ev.key }; });
ok("V3 · replaying the same spoken turn (same recording key) twice writes nothing more — one turn, one row", dupe.before === 1 && dupe.after === 1 && dupe.key === e1.key, JSON.stringify(dupe));
coachMode = "ok"; coachCovered = ["flag", "ask", "restate", "confirm"];
await O.page.evaluate(() => mvFinishCoaching());
await O.page.waitForFunction(() => _mv && !_mv.busy, null, { timeout: 12000 }).catch(() => {});
await sleep(300);
const e3 = await O.page.evaluate(() => { const r = mvStore()["clarify-confirm"]; return { n: r.attempts.length, pending: r.attempts[0].coachPending, ai: _mv.coach && _mv.coach.ai, state: r.state }; });
ok("V4 · recovery completes the coaching and creates no second piece of evidence", e3.n === 1 && e3.pending === false && e3.ai === true && e3.state === "DEMONSTRATED", JSON.stringify(e3));
ok("V5 · the Worker was called again on recovery", polishHits > hits0 + 1);

/* ── U · WELDING ── */
console.log("\nU · WELDING ISOLATION (app)");
const Wd = await learner("weld", "welding");
const w = await Wd.page.evaluate(async () => {
  const before = JSON.stringify(S.v2A || {});
  go("home"); await new Promise(r => setTimeout(r, 300));
  const card = !!document.querySelector(".mv-home");
  go("mission", "clarify-confirm-guided", "speak"); await new Promise(r => setTimeout(r, 400));
  const view = cur.v, html = (document.getElementById("v-mission") || {}).innerHTML;
  const refused = MissionEngine.addAttempt(S.v2A || (S.v2A = {}), "clarify-confirm", { key: "x", answered: true, coverage: 1, kind: "guided" }, areaId(), [1]) === null;
  mvTrack("v2_speak_attempt", { mission: "clarify-confirm-guided" });
  mvTrack("v2_mission_started", { mission: "clarify-confirm-guided" }, { id: "clarify-confirm", week: 4 });
  const unchanged = JSON.stringify(S.v2A || {}) === before;
  const cur4 = activeCurriculum();
  go("review"); await new Promise(r => setTimeout(r, 300));
  return { area: areaId(), comps: mvComps().length, comp: mvComp("clarify-confirm"), missions: cur4.missions, card, view, html: (html || "").length,
    refused, unchanged, weldRows: Object.keys(((S.v2A || {}).welding) || {}).length, ev: window.v2Evidence(), rec: window.v2Recommendation(),
    panel: !!document.querySelector(".pg-v2"), events: (window.__ev || []).filter(e => e[0].startsWith("v2_")).length,
    weeks: (cur4.weeks || []).length, sims: (cur4.simulations || []).length, stage: (cur4.weeks[0] || {}).stage };
});
ok("U1 · Welding's curriculum has no missions — Week 4 does not reach it through inheritance", w.area === "welding" && w.missions === null && w.comps === 0 && w.comp === null, JSON.stringify({ a: w.area, m: w.missions, c: w.comps }));
ok("U2 · no V2 card on the Welding home", w.card === false);
ok("U3 · routing straight to the Week 4 mission turns a Welding learner around", w.view === "home" && w.html === 0, JSON.stringify({ v: w.view, len: w.html }));
ok("U4 · the engine refuses to write Week 4 evidence for a Welding learner", w.refused && w.unchanged && w.weldRows === 0);
ok("U5 · no Week 4 analytics can be emitted from Welding, even with the competency passed in by hand", w.events === 0, String(w.events));
ok("U6 · both hooks return null and the Welding Progress page shows no V2 panel", w.ev === null && w.rec === null && w.panel === false);
ok("U7 · existing Welding curriculum is unchanged (12 stages, 12 simulations)", w.weeks === 12 && w.sims === 12 && /Stage 1/.test(w.stage || ""), JSON.stringify({ w: w.weeks, s: w.sims }));

ok("No uncaught page errors in any context", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
