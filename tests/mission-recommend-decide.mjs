/* BE Mastery V2.6 — General English Week 6 "Recommendations & decision
   language", end to end, and the data-only proof.

   Week 6 is the SIXTH competency and it arrived as one entry in
   tracks/general/missions.json. This suite is the claim that nothing else had
   to change: the engine, the evidence contract, the state machine, the
   retrieval, the recommendation, the coach boundary, the Home card, the
   Progress panel, the cloud merge and the Welding wall all behave for a
   competency they had never seen.

   The five moves are OPTIONS → RECOMMENDATION → REASON → TRADE-OFF → NEXT
   STEP. The situation supplies the options and every fact; the learner has
   to make a judgement about them, and say it so a decision can be made.
   Vocabulary is not the bar: "I think B is better" makes no move at all.

   Canonical numbering: the `week` of a competency is the General English
   programme week it teaches — Week 6 is "Recommendations & decision language"
   in weeks.json. See the _note in missions.json.

   Run:  cd tests && node mission-recommend-decide.mjs
         SHOTS=/some/dir node mission-recommend-decide.mjs   (also saves screenshots) */
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
const WEEKS = Array.isArray(WEEKS_RAW) ? WEEKS_RAW : (WEEKS_RAW.weeks || []);
const PHRASES = JSON.parse(readFileSync(ROOT + "tracks/general/phrases.json", "utf8"));
const SHOTS = process.env.SHOTS || null;

const res = [];
const ok = (n, c, d = "") => { res.push({ name: n, pass: !!c }); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };

const ID = "recommend-decide";
const W1 = ME.competencyOf(PACK, "explain-work");
const W2 = ME.competencyOf(PACK, "clear-update");
const W3 = ME.competencyOf(PACK, "raise-problem");
const W4 = ME.competencyOf(PACK, "clarify-confirm");
const W5 = ME.competencyOf(PACK, "explain-tech");
const W6 = ME.competencyOf(PACK, ID);
const guidedOf = c => (c.missions || []).find(m => m.kind === "guided"), transferOf = c => (c.missions || []).find(m => m.kind === "transfer");
const G1 = guidedOf(W1), T1 = transferOf(W1), G2 = guidedOf(W2), T2 = transferOf(W2), G3 = guidedOf(W3), T3 = transferOf(W3), G4 = guidedOf(W4), T4 = transferOf(W4), G5 = guidedOf(W5), T5 = transferOf(W5);
const G6 = W6 && ME.missionOf(W6, ID + "-guided"), T6 = W6 && ME.missionOf(W6, ID + "-transfer");
const IV = [1, 3, 7, 21, 60];
const GE = "general-english";
const MOVES = "options,recommend,reason,tradeoff,next";
const meta = c => ({ competency: c.id, week: c.week, moveIds: ME.moveIds(c) });
const mk = (c, m, text, kind, key, at) => Object.assign(ME.grade(c, m, text, { seconds: 27 }),
  { key, kind, at: at || Date.now(), missionId: m.id });

/* ── what the learners will say ──────────────────────────────────────────── */
const SAY = {
  strong: G6 && G6.hear.model,
  noOptions: "I'd recommend option B. The main reason is that the customer has already been told the fifteenth, and keeping that date is worth more than the extra cost. The trade-off is the twenty percent — about two thousand pounds on this order. If you agree, the next step is that I'll place the order this afternoon.",
  /* the report-not-recommend habit this week exists to break: everything laid out, nothing chosen */
  noRecommend: "We have two options. Option A is to wait: no extra cost, but three weeks late. Option B is to order from the second supplier at twenty percent more and keep the date. The main reason to consider B is that the customer has been told the fifteenth. The trade-off is the twenty percent. If you agree, the next step is that I'll place the order this afternoon.",
  noReason: "We have two options: wait three weeks for the original supplier, or order from the second supplier in one week at twenty percent more. I'd recommend option B. The trade-off is the twenty percent — about two thousand pounds. If you agree, the next step is that I'll place the order this afternoon.",
  noTradeoff: "We have two options: wait three weeks for the original supplier, or order from the second supplier in one week. I'd recommend option B. The main reason is that the customer has already been told the fifteenth. If you agree, the next step is that I'll place the order this afternoon.",
  noNext: "We have two options: wait three weeks, or order from the second supplier in one week at twenty percent more. I'd recommend option B. The main reason is that the customer has already been told the fifteenth. The trade-off is the twenty percent — about two thousand pounds on this order.",
  transfer: "There are two options here. One option is to send it tomorrow with the numbers corrected by hand, and the other option is to hold it for two days and rerun everything from the fixed source. My recommendation is to hold it. The reason is that last quarter they complained about a wrong figure, and two of the twelve charts can't be checked in time if we send tomorrow. The downside is that it's the first late report we've ever sent them. So the next step is that you tell the client today that it's coming on Thursday, and I'll rerun it as soon as the source is fixed.",
  transferWeak: "There are two options here. One option is to send it tomorrow with the numbers corrected by hand, and the other option is to hold it for two days. My recommendation is to hold it. The reason is that last quarter they complained about a wrong figure. The downside is that it's the first late report we've ever sent them.",
  /* browser speech recognition usually returns one unpunctuated run */
  unpunctuated: "we have two options here option a is to wait for the original supplier no extra cost but the part comes in three weeks and the go-live slips to the end of the month option b is to order from the second supplier one week twenty percent more and the go-live date holds what I'd recommend is option b the main reason is that the customer has already been told the fifteenth and keeping that date is worth more than the extra cost the trade-off is the twenty percent about two thousand pounds on this order if you agree the next step is that I'll place the order this afternoon",
  short: "Option B.",
  seven: "I'd recommend option B, definitely, for sure.",
  eight: "I'd recommend option B, definitely, for sure, today.",
  /* Weeks 1–5, to put them to rest when the question is whether Week 6 waits its turn */
  w1strong: G1.hear.model,
  w1transfer: "I am a project coordinator on the delivery team. I look after the schedule and the supplier paperwork for your account. Right now I am preparing the plan for your first shipment. I work closely with our warehouse and your logistics contact, so that nothing on your side has to be chased by hand.",
  w1noWhy: "I work as an operations analyst in the logistics team. I'm responsible for the weekly delivery reports. At the moment I'm rebuilding how we track late shipments. I work closely with the warehouse managers.",
  w2strong: "The project is on track and we have completed two stages. We have run into an issue with the design agency. This means Friday delivery is at risk by about two days. I will chase it up today and come back to you tomorrow.",
  w2transfer: "Installation is due to start on Monday and everything else is ready. The materials from the supplier arrived three days late. That means we will push back the handover and the end of month promise is at risk. I will confirm a new date with the customer and come back to you this afternoon.",
  w3strong: G3.hear.model,
  w3noAsk: "We have got a problem with the delivery. It started when the supplier changed the order number. This means we would finish three days late. I have already spoken to their office.",
  w3transfer: "There is a problem with the monthly figures. It started when the old report was switched off in August, so two months of numbers may be wrong. This means the Thursday board pack is at risk. I have spoken to finance and asked them to rerun the numbers. Could you sign off on a one-day delay so we can check them?",
  w4strong: G4.hear.model,
  w4transfer: "Sorry, I'm not sure I follow — the client thing could be two things. Are you asking about the revised quote or the delivery date they wanted? So you're saying it's the quote they're expecting before Wednesday's review. Then I'll send the quote today and come back to you tomorrow on the delivery date — does that work?",
  w5strong: G5.hear.model,
  w5transfer: "In plain terms, the integration is a link between their shop and our warehouse. The way it works is that every time a customer places an order, it goes straight to the warehouse system automatically, instead of someone typing it in each morning. What this means for the client is that orders ship the same day and the typing mistakes stop. The one thing to remember is that returns aren't included yet — those are still done by hand. Does that make sense?",
  /* cold transfers for any competency after Week 6, keyed by id — a new week adds one entry */
  transfers: {},
};

/* ═══════════ A · PACK ═══════════════════════════════════════════════════ */
console.log("\nA · THE PACK");
ok("A · Week 6 exists, is numbered 6, carries the canonical title, five moves and two missions",
  W6 && W6.week === 6 && W6.title === "Recommendations & decision language" && ME.moveIds(W6).join() === MOVES && W6.missions.length === 2, W6 && ME.moveIds(W6).join());
ok("A · The title is weeks.json's own Week 6 theme, word for word; the numbering is consecutive from 1 with Week 6 sixth — whatever the count",
  WEEKS.find(w => w.n === 6).theme === W6.title && PACK.competencies.map(c => c.week).join() === PACK.competencies.map((_, i) => i + 1).join() && PACK.competencies[5].id === ID, WEEKS.find(w => w.n === 6).theme);
ok("A · The competency id is semantic, like the five before it — not derived from the week number",
  /^[a-z]+-[a-z]+$/.test(W6.id) && !/6|six|week/.test(W6.id) && PACK.competencies.every(c => /^[a-z]+-[a-z]+$/.test(c.id)));
ok("A · The pack note records Week 6, its move count and the Shadow decision", /Week 6/.test(PACK._note) && /options → recommend → reason → tradeoff → next/.test(PACK._note));
ok("A · The guided mission loads with the situation, the model, the prompt and the context",
  G6 && G6.kind === "guided" && G6.see && G6.see.where && G6.see.who && G6.see.asks && G6.see.goal && G6.hear && G6.hear.model && G6.hear.note && G6.prompt === G6.see.asks && G6.context);
ok("A · The transfer mission loads: a different situation, a different listener, a different decision, no model to copy",
  T6 && T6.kind === "transfer" && !T6.hear && T6.prompt !== G6.prompt && T6.see.who !== G6.see.who && /send it or hold it/i.test(T6.prompt) && !/supplier/i.test(T6.context));
ok("A · Both situations supply the options and the facts to weigh them — the learner invents nothing",
  /Option A/.test(G6.context) && /Option B/.test(G6.context) && /three weeks/.test(G6.context) && /20%/.test(G6.context) && /told the 15th/.test(G6.context)
  && /Two choices/.test(T6.context) && /two days/.test(T6.context) && /twelve charts/.test(T6.context) && /complained about a wrong figure/.test(T6.context));
ok("A · Exactly five moves, each with an id, a label, a hint, at least 40 phrase cues, a retry line and three patterns",
  W6.moves.length === 5 && W6.moves.every(m => m.id && m.label && m.hint && Array.isArray(m.cues) && m.cues.length >= 40 && m.retry && Array.isArray(m.patterns) && m.patterns.length === 3));
ok("A · Every cue is lowercase and unique within its move, and no cue of one move is contained in a cue of another",
  W6.moves.every(m => new Set(m.cues).size === m.cues.length && m.cues.every(q => q === q.toLowerCase()))
  && W6.moves.every((a, i) => W6.moves.every((b, j) => i === j || a.cues.every(x => b.cues.every(y => !x.includes(y))))));
ok("A · Every Week 6 expression is tagged to a move that exists, and most come from the curriculum's own Week 6 'Recommendations' phrases",
  W6.expressions.length === 8 && W6.expressions.every(e => ME.moveIds(W6).includes(e.move) && e.w && e.def && e.l)
  && W6.expressions.filter(e => PHRASES.phrases.some(p => p.w === 6 && AE.hits(p.p, e.w))).length >= 6, JSON.stringify(W6.expressions.map(e => e.w)));
ok("A · The Shadow decision is explicit: unlinked after a content check, with a _shadow_note naming the closest candidates and the library gap",
  !W6.shadow && typeof W6._shadow_note === "string" && /content check/i.test(W6._shadow_note) && /2gIaaPT_-Ag/.test(W6._shadow_note) && /gap/i.test(W6._shadow_note));
ok("A · The cue decisions are written down: 'I think' / 'I suggest' / 'maybe', bare 'because', bare 'but', deadlines and bare option names are all named as non-evidence",
  /I think/.test(ME.moveOf(W6, "recommend")._cue_note) && /I suggest/.test(ME.moveOf(W6, "recommend")._cue_note) && /because/.test(ME.moveOf(W6, "reason")._cue_note)
  && /although/.test(ME.moveOf(W6, "tradeoff")._cue_note) && /deadline/i.test(ME.moveOf(W6, "next")._cue_note) && /option B/.test(ME.moveOf(W6, "options")._cue_note));

/* ═══════════ B · MOVE GRADING ═══════════════════════════════════════════ */
console.log("\nB · MOVE GRADING");
const padded = t => t + " and a few more words to reach the minimum";
const only = (text, m) => { const e = ME.grade(W6, G6, text, { seconds: 8 }); return Object.keys(e.moves).filter(k => e.moves[k]).join() === m; };
const none = text => ME.grade(W6, G6, text, { seconds: 8 }).coverage === 0;
ok("B · Each move's own patterns credit that move and only that move", W6.moves.every(m => m.patterns.every(pt => only(padded(pt), m.id))));
ok("B · Each expression, when spoken, credits the move it is tagged to and counts as vocabulary used",
  W6.expressions.every(x => { const e = ME.grade(W6, G6, padded(x.w), { seconds: 5 }); return e.moves[x.move] === true && e.vocabUsed.includes(x.w); }));
ok("B · 'We have two options' lays out; 'I'd recommend B' recommends; 'the main reason is' reasons; 'the downside is' names the trade-off; 'if you agree, I'll order it' proposes — one each",
  only(padded("We have two options on this one"), "options") && only(padded("I'd recommend B on this one"), "recommend") && only(padded("The main reason is that it holds the date"), "reason")
  && only(padded("The downside is that it costs more"), "tradeoff") && only(padded("If you agree, I'll place the order"), "next"));
const gm = ME.grade(W6, G6, SAY.strong, { seconds: 45 });
ok("B · The model answer makes all five moves on its own rubric, in the taught order, and uses two of the curriculum's own expressions",
  gm.coverage === 1 && ME.passes(gm) && gm.clarity === 1 && gm.clarityBasis === "order+length" && gm.vocabUsed.length >= 2, "missed=" + gm.missed.join() + " vocab=" + gm.vocabUsed.join("|"));
ok("B · An unpunctuated transcript — what browser speech recognition actually returns — still makes all five moves; clarity rests on order alone",
  (() => { const e = ME.grade(W6, G6, SAY.unpunctuated, { seconds: 45 }); return e.coverage === 1 && ME.passes(e) && e.clarityBasis === "order"; })());
console.log("   the cue traps named in the pack");
ok("B · 'I think option B is better for us' makes NO move — a preference is not a recommendation, and naming an option is not laying out the options",
  none("I think option B is better for us and I like it more."));
ok("B · 'Maybe we could try the second supplier' makes no move", none("Maybe we could try the second supplier and see what happens."));
ok("B · 'I suggest the second supplier' does not prove a recommendation", ME.grade(W6, G6, "I suggest the second supplier, they seem fine to me.", { seconds: 5 }).moves.recommend === false);
ok("B · 'Because the deadline is Friday' proves neither a reason nor a next step",
  (() => { const e = ME.grade(W6, G6, "Because the deadline is Friday we need to hurry up with this.", { seconds: 5 }); return e.moves.reason === false && e.moves.next === false; })());
ok("B · 'The second supplier is a good option and the deadline is the fifteenth' makes no move", none("The second supplier is a good option and the deadline is the fifteenth."));
ok("B · A deadline alone proves nothing about the next step", none("We need it by Friday and the customer expects delivery on the fifteenth."));
ok("B · A Week 3 problem report makes no Week 6 move", none(SAY.w3noAsk));
ok("B · A recommendation with no reason is one move of five — not passed", (() => { const e = ME.grade(W6, G6, padded("I'd recommend option B for the delivery"), { seconds: 5 }); return e.moves.recommend === true && e.moves.reason === false && !ME.passes(e); })());
ok("B · A reason with no recommendation is one move of five — not passed", (() => { const e = ME.grade(W6, G6, "The reason is that it is cheaper and it keeps the date for the customer.", { seconds: 5 }); return e.moves.reason === true && e.moves.recommend === false && !ME.passes(e); })());
ok("B · A trade-off with no decision behaviour is one move of five — not passed", (() => { const e = ME.grade(W6, G6, "The trade-off is that it costs more than the original supplier did.", { seconds: 5 }); return e.moves.tradeoff === true && e.moves.next === false && e.moves.recommend === false && !ME.passes(e); })());
ok("B · The phrase bank's own lines each make exactly the move they teach: 'What I'd recommend is…' / 'The tradeoff is…' / 'We have two options here…' / 'Here's what I suggest we do next…'",
  only(padded("What I'd recommend is the second supplier"), "recommend") && only(padded("The tradeoff is the extra cost"), "tradeoff") && only(padded("We have two options here today"), "options") && only(padded("Here's what I suggest we do next"), "next"));

/* ═══════════ C · GUIDED ═════════════════════════════════════════════════ */
console.log("\nC · GUIDED");
const miss = (text, id) => { const e = ME.grade(W6, G6, text, { seconds: 30 }); return e.coverage === 0.8 && !ME.passes(e) && e.moves[id] === false && ME.weakestMove(W6, e, []) === id; };
ok("C · A complete answer passes", ME.passes(gm));
ok("C · Without the options laid out: 0.8, not passed, 'options' weakest", miss(SAY.noOptions, "options"));
ok("C · Everything laid out but nothing chosen — the report-not-recommend habit: 0.8, not passed, 'recommend' weakest", miss(SAY.noRecommend, "recommend"));
ok("C · Without the reason: 0.8, not passed, 'reason' weakest", miss(SAY.noReason, "reason"));
ok("C · Without the trade-off: 0.8, not passed, 'tradeoff' weakest", miss(SAY.noTradeoff, "tradeoff"));
ok("C · Without the next step: 0.8, not passed, 'next' weakest", miss(SAY.noNext, "next"));
ok("C · Four of five is 'strong' coverage by band and still not demonstrated — the bar is every move", (() => { const e = ME.grade(W6, G6, SAY.noNext, { seconds: 30 }); return e.verdict === "strong" && !ME.passes(e); })());
ok("C · Deterministic coaching names the missing move and hands back its own retry line from the pack",
  (() => { const f = ME.shapeCoach(null, W6, mk(W6, G6, SAY.noRecommend, "guided", "c0")); return f.move === "recommend" && f.retry === ME.moveOf(W6, "recommend").retry && /commit to ONE option/i.test(f.retry) && f.ai === false; })());
ok("C · …and for each other missing move the retry is that move's own line",
  [["noOptions", "options"], ["noReason", "reason"], ["noTradeoff", "tradeoff"], ["noNext", "next"]].every(([k, id]) => ME.shapeCoach(null, W6, mk(W6, G6, SAY[k], "guided", "c" + id)).retry === ME.moveOf(W6, id).retry));
ok("C · The missing move's expressions are queued to learn; the ones used are queued to keep",
  (() => { const q = ME.expressionsToLearn(W6, ME.grade(W6, G6, SAY.noRecommend, { seconds: 30 }), "recommend");
    return q.some(e => e.move === "recommend" && e.why === "missing") && q.every(e => W6.expressions.some(x => x.w === e.w)); })());
ok("C · A retry that adds the missing move recovers: PRACTICING → DEMONSTRATED, both attempts kept",
  (() => { const s = {}; ME.introduce(s, W6.id, GE); ME.addAttempt(s, W6.id, mk(W6, G6, SAY.noRecommend, "guided", "r1"), GE, IV, meta(W6)); const before = s[W6.id].state;
    ME.addAttempt(s, W6.id, mk(W6, G6, SAY.strong, "retry", "r2"), GE, IV, meta(W6));
    return before === "PRACTICING" && s[W6.id].state === "DEMONSTRATED" && s[W6.id].attempts.length === 2 && s[W6.id].attempts[1].kind === "retry"; })());
ok("C · Two words is not an answer; seven is not; eight is, scored on its merits — the bar is the engine's MIN_WORDS",
  !ME.grade(W6, G6, SAY.short, { seconds: 2 }).answered && !ME.grade(W6, G6, SAY.seven, { seconds: 4 }).answered && (() => { const e = ME.grade(W6, G6, SAY.eight, { seconds: 4 }); return e.answered && !ME.passes(e) && e.coverage === 0.2; })() && ME.MIN_WORDS === 8);

/* ═══════════ D · TRANSFER ═══════════════════════════════════════════════ */
console.log("\nD · TRANSFER");
ok("D · The transfer fixture makes all five moves cold from the supplied facts", ME.grade(W6, T6, SAY.transfer, { seconds: 40 }).coverage === 1, "missed=" + ME.grade(W6, T6, SAY.transfer, { seconds: 40 }).missed.join());
ok("D · Without the next step the transfer does not pass", (() => { const e = ME.grade(W6, T6, SAY.transferWeak, { seconds: 30 }); return e.coverage === 0.8 && !ME.passes(e) && ME.weakestMove(W6, e, []) === "next"; })());
ok("D · The transfer is not the guided answer re-used: the two answers share no sentence of more than five words, and neither mentions the other's facts",
  (() => { const sents = t => t.split(/[.!?]/).map(x => x.trim().toLowerCase()).filter(x => x.split(/\s+/).length > 5); const a = sents(SAY.transfer), b = sents(G6.hear.model);
    return a.length >= 4 && a.every(x => !b.includes(x)) && !/supplier|go-live|order/i.test(SAY.transfer) && !/report|chart|client/i.test(G6.hear.model); })());
ok("D · The guided model answer, graded against the transfer's own rubric, is about the wrong decision — it recommends 'option B' where no option B exists in the transfer",
  !/option b|option a/i.test(T6.context) && /option B/.test(G6.hear.model));
ok("D · Every fact the transfer fixture uses is in the transfer context — nothing invented",
  /corrected by hand/i.test(T6.context) && /two days/i.test(T6.context) && /rerun/i.test(T6.context) && /twelve charts/i.test(T6.context) && /complained about a wrong figure/i.test(T6.context) && /never had a late report/i.test(T6.context));

/* ═══════════ E · PROGRESSION ════════════════════════════════════════════ */
console.log("\nE · PROGRESSION");
const L6 = {};
const D = 86400000, T0 = Date.parse("2026-10-19T10:00:00Z");
ok("E · NOT_STARTED before anything", ME.record(L6, W6.id).state === "NOT_STARTED" && ME.stateFrom(ME.blank(W6.id)) === "NOT_STARTED");
ME.introduce(L6, W6.id, GE, T0);
ok("E · SEE/HEAR/NOTICE → INTRODUCED and no further", L6[W6.id].state === "INTRODUCED");
ME.addAttempt(L6, W6.id, mk(W6, G6, SAY.noRecommend, "guided", "p1", T0 + 60000), GE, IV, meta(W6));
ok("E · A partial attempt → PRACTICING, retrieval due now for 'practice'", L6[W6.id].state === "PRACTICING" && L6[W6.id].retrieval.reason === "practice" && L6[W6.id].retrieval.due === T0 + 60000);
ME.addAttempt(L6, W6.id, mk(W6, G6, "I think option B is better for us and I like it more, honestly.", "retry", "p1b", T0 + 90000), GE, IV, meta(W6));
ok("E · A failed guided attempt (a preference, no moves) stays PRACTICING and is kept as evidence", L6[W6.id].state === "PRACTICING" && L6[W6.id].attempts.length === 2 && L6[W6.id].attempts[1].coverage === 0);
ME.addAttempt(L6, W6.id, mk(W6, G6, SAY.strong, "retry", "p2", T0 + 120000), GE, IV, meta(W6));
ok("E · A full guided answer → DEMONSTRATED, due now for the transfer", L6[W6.id].state === "DEMONSTRATED" && L6[W6.id].retrieval.reason === "transfer");
ME.addAttempt(L6, W6.id, mk(W6, T6, SAY.transferWeak, "transfer", "p2b", T0 + 150000), GE, IV, meta(W6));
ok("E · A failed transfer stays DEMONSTRATED, counts against the tally, and sends the learner back to guided reps",
  L6[W6.id].state === "DEMONSTRATED" && L6[W6.id].transfer.failed === 1 && L6[W6.id].transfer.passed === 0 && ME.recommend(L6[W6.id], W6, T0 + 150000).reason === "transfer_failed");
ME.addAttempt(L6, W6.id, mk(W6, T6, SAY.transfer, "transfer", "p3", T0 + 180000), GE, IV, meta(W6));
ok("E · One cold success → TRANSFER_READY with a retrieval on the first interval (1 day)", L6[W6.id].state === "TRANSFER_READY" && L6[W6.id].transfer.passed === 1 && L6[W6.id].retrieval.reason === "retrieval" && L6[W6.id].retrieval.due === T0 + 180000 + D);
ME.addAttempt(L6, W6.id, mk(W6, T6, SAY.transfer, "transfer", "p4", T0 + 200000), GE, IV, meta(W6));
ok("E · A second cold success the SAME day is still TRANSFER_READY, spaced on the next interval (3 days)", L6[W6.id].state === "TRANSFER_READY" && L6[W6.id].transfer.passed === 2 && L6[W6.id].retrieval.due === T0 + 200000 + 3 * D);
ME.addAttempt(L6, W6.id, mk(W6, T6, SAY.transfer, "transfer", "p5", T0 + 2 * D), GE, IV, meta(W6));
ok("E · A cold success on another day → STRONG, spaced further (21 days)", L6[W6.id].state === "STRONG" && L6[W6.id].retrieval.reps === 4 && L6[W6.id].retrieval.due === T0 + 2 * D + 21 * D);
ok("E · The schedule is the track's — a different ladder is honoured", (() => { const s = {}; ME.introduce(s, W6.id, GE, T0); ME.addAttempt(s, W6.id, mk(W6, G6, SAY.strong, "guided", "q1", T0), GE, [2, 5], meta(W6));
  ME.addAttempt(s, W6.id, mk(W6, T6, SAY.transfer, "transfer", "q2", T0 + 1000), GE, [2, 5], meta(W6)); return s[W6.id].retrieval.due === T0 + 1000 + 2 * D; })());
console.log("   deterministic next recommendation");
const R = {};
ok("E · Unspoken → speak the guided mission", (() => { const r = ME.recommend(ME.blank(W6.id), W6, T0); return r.action === "speak" && r.missionId === ID + "-guided" && r.reason === "not_spoken_yet"; })());
ME.introduce(R, W6.id, GE, T0); ME.addAttempt(R, W6.id, mk(W6, G6, SAY.noTradeoff, "guided", "s1", T0), GE, IV, meta(W6));
ok("E · Weak → retry the same mission on the missing move", (() => { const r = ME.recommend(R[W6.id], W6, T0); return r.action === "retry" && r.move === "tradeoff" && r.reason === "weak_move"; })());
ME.addAttempt(R, W6.id, mk(W6, G6, SAY.strong, "retry", "s2", T0 + 1), GE, IV, meta(W6));
ok("E · Demonstrated → take the transfer", (() => { const r = ME.recommend(R[W6.id], W6, T0 + 1); return r.action === "transfer" && r.missionId === ID + "-transfer"; })());
ME.addAttempt(R, W6.id, mk(W6, T6, SAY.transfer, "transfer", "s3", T0 + 2), GE, IV, meta(W6));
ok("E · Transfer-ready and not yet due → rest with the date; once due → a retrieval on the transfer mission",
  ME.recommend(R[W6.id], W6, T0 + 3).action === "rest" && ME.recommend(R[W6.id], W6, R[W6.id].retrieval.due + 1).action === "retrieval" && ME.recommend(R[W6.id], W6, R[W6.id].retrieval.due + 1).missionId === ID + "-transfer");
ok("E · Pending coaching outranks everything", (() => { const s = JSON.parse(JSON.stringify(R)); s[W6.id].attempts[0].coachPending = true; return ME.recommend(s[W6.id], W6, T0).action === "coach"; })());

/* ═══════════ F · CROSS-COMPETENCY ═══════════════════════════════════════ */
console.log("\nF · CROSS-COMPETENCY");
const comps = PACK.competencies;
const pick = s => ME.pickNext(comps, id => s[id], Date.now());
const put = (s, c, m, txt, kind, key, at) => { ME.introduce(s, c.id, GE); return ME.addAttempt(s, c.id, mk(c, m, txt, kind, key, at), GE, IV, meta(c)); };
const show = p => p ? `${p.comp.id}:${p.rec.action}:${p.rec.move || "-"}` : "null";
const rest = (s, c, g, t, gs, ts, k) => { put(s, c, g, gs, "guided", k + "g"); put(s, c, t, ts, "transfer", k + "t"); };
const rest1to5 = (s, k) => { rest(s, W1, G1, T1, SAY.w1strong, SAY.w1transfer, k + "1"); rest(s, W2, G2, T2, SAY.w2strong, SAY.w2transfer, k + "2"); rest(s, W3, G3, T3, SAY.w3strong, SAY.w3transfer, k + "3"); rest(s, W4, G4, T4, SAY.w4strong, SAY.w4transfer, k + "4"); rest(s, W5, G5, T5, SAY.w5strong, SAY.w5transfer, k + "5"); };
ok("F · A fresh learner is offered Week 1 — Week 6 is not pushed forward by being newest", show(pick({})) === "explain-work:speak:-", show(pick({})));
let B = {}; rest1to5(B, "b");
ok("F · With Weeks 1–5 resting, Week 6 is offered to speak — a competency nobody has spoken for is never skipped", show(pick(B)) === ID + ":speak:-", show(pick(B)));
rest(B, W6, G6, T6, SAY.strong, SAY.transfer, "b6");
/* every competency after Week 6, in week order — offered when everything before it rests */
const LATER = PACK.competencies.filter(c => c.week > 6).sort((a, b) => a.week - b.week);
ok("F · Every competency after Week 6 has a cold-transfer fixture in this suite", LATER.every(c => typeof SAY.transfers[c.id] === "string"), LATER.map(c => c.id).join());
LATER.forEach(c => { ok(`F · With everything before it resting, ${c.id} (Week ${c.week}) is offered to speak`, show(pick(B)) === `${c.id}:speak:-`, show(pick(B))); rest(B, c, guidedOf(c), transferOf(c), guidedOf(c).hear.model, SAY.transfers[c.id], "b" + c.week); });
ok("F · With every competency resting, nothing is pushed and the old advice stands", pick(B) === null, show(pick(B)));
let C = {}; put(C, W1, G1, SAY.w1strong, "guided", "c1"); put(C, W6, G6, SAY.noRecommend, "guided", "c2");
ok("F · A Week 6 weak move outranks a Week 1 pending transfer — evidence priority, not week order", show(pick(C)) === ID + ":retry:recommend", show(pick(C)));
let Dd = {}; put(Dd, W1, G1, SAY.w1noWhy, "guided", "d1"); put(Dd, W6, G6, SAY.noRecommend, "guided", "d2");
ok("F · Two equally urgent retries → the earlier week, deterministically, and only as a tie-break", show(pick(Dd)) === "explain-work:retry:why" && show(pick(Dd)) === show(pick(Dd)), show(pick(Dd)));
let E = {}; put(E, W5, G5, SAY.w5strong, "guided", "e1"); put(E, W6, G6, SAY.noTradeoff, "guided", "e2");
ok("F · Week 6 weak vs Week 5 ready for transfer → Week 6's retry", show(pick(E)) === ID + ":retry:tradeoff", show(pick(E)));
let Fx = {}; rest1to5(Fx, "f"); put(Fx, W6, G6, SAY.noNext, "guided", "f6");
ok("F · A learner with different evidence gets a different next mission: Weeks 1–5 resting and Week 6 weak → Week 6 retry on 'next'", show(pick(Fx)) === ID + ":retry:next", show(pick(Fx)));
ok("F · Pending coaching on Week 6 outranks a Week 1 retry",
  (() => { const s = {}; put(s, W1, G1, SAY.w1noWhy, "guided", "i1"); const r = put(s, W6, G6, SAY.noOptions, "guided", "i2"); r.attempt.coachPending = true; return show(pick(s)) === ID + ":coach:options"; })());
ok("F · One record per competency, keyed by competency id — never by week", (() => { const s = {}; PACK.competencies.forEach((c, i) => put(s, c, guidedOf(c), "x", "guided", "k" + i)); return Object.keys(s).sort().join() === PACK.competencies.map(c => c.id).sort().join() && Object.keys(s).length === PACK.competencies.length; })());

/* ═══════════ G · MEMORY ═════════════════════════════════════════════════ */
console.log("\nG · MEMORY");
const row = ME.contract(mk(W6, G6, SAY.noRecommend, "guided", "k1"), meta(W6));
ok("G · Evidence is written as the same v1 contract: versioned, track-stamped, week 6, competency, mission, kind, key",
  row.v === ME.EVIDENCE_VERSION && row.tk === GE && row.week === 6 && row.competency === ID && row.missionId === ID + "-guided" && row.kind === "guided" && row.key === "k1");
ok("G · Its moves map holds exactly the five Week 6 ids, as booleans", Object.keys(row.moves).join() === MOVES && Object.values(row.moves).every(v => typeof v === "boolean") && row.moves.recommend === false);
ok("G · Task, clarity, fluency and vocabulary are measured numbers in [0,1]; pronunciation is null — never zero — with no audio grader",
  [row.task, row.clarity, row.fluency, row.vocab].every(x => typeof x === "number" && x >= 0 && x <= 1) && row.pron === null && row.pronSource === null);
ok("G · With no duration, seconds and wpm are null, not 0", (() => { const r = ME.contract(Object.assign(ME.grade(W6, G6, SAY.strong, {}), { key: "k3", kind: "guided" }), meta(W6)); return r.seconds === null && r.wpm === null; })());
ok("G · Transfer is null on a guided attempt and a boolean on a transfer attempt", row.transfer === null && typeof ME.contract(mk(W6, T6, SAY.transfer, "transfer", "k2"), meta(W6)).transfer === "boolean");
ok("G · Vocabulary used lists only the competency's own expressions", (() => { const r = ME.grade(W6, G6, "We have two options here. What I'd recommend is the first. My recommendation is based on cost. The tradeoff is time. Here's what I suggest we do next.", { seconds: 12 }); return r.vocabUsed.every(w => W6.expressions.some(e => e.w === w)) && r.vocabUsed.length >= 4; })());
ok("G · The same key twice in Week 6 is one row, reported as a duplicate", (() => { const s = {}; put(s, W6, G6, SAY.strong, "guided", "dup"); return put(s, W6, G6, SAY.strong, "guided", "dup").duplicate && s[W6.id].attempts.length === 1; })());
ok("G · The same key in Week 6 and Week 5 is two rows, one each — idempotency is per competency",
  (() => { const s = {}; put(s, W5, G5, SAY.w5strong, "guided", "same"); const r = put(s, W6, G6, SAY.strong, "guided", "same"); return !r.duplicate && s[W5.id].attempts.length === 1 && s[W6.id].attempts.length === 1; })());
ok("G · Weak evidence stays due: a weak Week 6 record is due now, for practice, with its weakness kept and driving the next recommendation",
  (() => { const s = {}; const r = put(s, W6, G6, SAY.noTradeoff, "guided", "w1"); s[W6.id].weakness = ME.weakestMove(W6, r.attempt, s[W6.id].attempts);
    return s[W6.id].retrieval.reason === "practice" && s[W6.id].retrieval.due <= Date.now() && s[W6.id].weakness === "tradeoff" && ME.recommend(s[W6.id], W6).move === "tradeoff"; })());
ok("G · Week 6 attempts are bounded at 60", (() => { const s = {}; for (let i = 0; i < 70; i++) put(s, W6, G6, SAY.strong, "guided", "b" + i, T0 + i); return s[W6.id].attempts.length === 60; })());
ok("G · A Week 6 attempt changes none of the other five records",
  (() => { const s = {}; [[W1, G1, SAY.w1noWhy], [W2, G2, SAY.w2strong], [W3, G3, SAY.w3strong], [W4, G4, SAY.w4strong], [W5, G5, SAY.w5strong]].forEach(([c, g, t], i) => put(s, c, g, t, "guided", "m" + i));
    const before = JSON.stringify([W1, W2, W3, W4, W5].map(c => s[c.id])); put(s, W6, G6, SAY.noRecommend, "guided", "m6"); return JSON.stringify([W1, W2, W3, W4, W5].map(c => s[c.id])) === before && s[W6.id].state === "PRACTICING"; })());
ok("G · The progress summary carries Week 6, its state, five per-move counts, null pronunciation and no Shadow support",
  (() => { const ps = ME.progressSummary(L6[W6.id], W6); return ps.competency === ID && ps.week === 6 && ps.state === "STRONG" && ps.byMove.map(m => m.id).join() === MOVES && ps.pron === null && ps.shadow.total === 0 && ps.transferPassed === 3 && ps.transferFailed === 1; })());

/* ═══════════ H · AI CONTEXT ═════════════════════════════════════════════ */
console.log("\nH · AI COACH");
const st6 = {}; put(st6, W5, G5, SAY.w5strong, "guided", "h0"); put(st6, W6, G6, SAY.noRecommend, "guided", "h1");
const ctx = ME.aiContext(st6[W6.id], W6, G6, { weakness: "recommend" });
const ctxJson = JSON.stringify(ctx);
ok("H · The context carries competency recommend-decide, the guided mission, the pattern, five moves with hints, the weakness, evidence counts and one attempt summary",
  ctx.track === GE && ctx.competency === ID && ctx.mission === ID + "-guided" && ctx.prompt === G6.prompt && ctx.pattern === W6.pattern
  && ctx.targetMoves.length === 5 && ctx.targetMoves.every(m => m.id && m.label && m.hint) && ctx.currentWeakness === "recommend"
  && ctx.recentEvidence.attempts === 1 && ctx.previousAttemptSummary && ctx.previousAttemptSummary.moves.recommend === false);
ok("H · Relevant memory is in: the last attempt's moves and length; the transcript is not", ctx.previousAttemptSummary.words > 8 && !("said" in ctx.previousAttemptSummary) && !ctxJson.includes(SAY.noRecommend.slice(0, 30)));
ok("H · Unrelated history is not dumped in: no attempt list, no profile, no state machine, nothing from Week 5 or any other competency",
  !ctxJson.includes("\"attempts\":[") && !/profile|streak|\"name\"/i.test(ctxJson) && !("state" in ctx) && !/explain-tech|clarify-confirm|explain-work|clear-update|raise-problem|restate|mitigate|takeaway/.test(ctxJson));
const prompt = ME.coachPrompt(ctx, "SPOKEN RULE");
ok("H · The prompt names five moves with Week 6's labels, its shape, and the existing {reply, covered} route — and tells the model it is a coach",
  /makes 5 communication/.test(prompt) && /recommend \(Recommend one\)/.test(prompt) && /tradeoff \(Name the trade-off\)/.test(prompt) && prompt.includes(W6.pattern) && /"covered"/.test(prompt) && /"reply"/.test(prompt) && /speaking coach/i.test(prompt) && prompt.includes("SPOKEN RULE"));
const evAI = mk(W6, G6, SAY.noRecommend, "guided", "ai1"); ME.applyCoachMoves(evAI, W6, ["recommend"]);
ok("H · The model MAY add the recommendation it heard in the learner's own words", evAI.moves.recommend === true && evAI.coverage === 1 && evAI.assisted === true);
const evKeep = mk(W6, G6, SAY.strong, "guided", "ai2"); ME.applyCoachMoves(evKeep, W6, []);
ok("H · The model CANNOT remove a move the learner made", evKeep.coverage === 1);
const evJunk = mk(W6, G6, SAY.noRecommend, "guided", "ai3"); ME.applyCoachMoves(evJunk, W6, ["check", "impact", "__proto__", "state", "passed", 42, null]);
ok("H · Other competencies' move ids and non-moves are dropped on the floor", evJunk.moves.recommend === false && Object.keys(evJunk.moves).join() === MOVES && !("state" in evJunk.moves));
const shaped = ME.shapeCoach({ reply: "y".repeat(500), covered: ["recommend"], state: "STRONG", score: 100, passed: true }, W6, evAI);
ok("H · Model output is capped, tagged as AI, and carries no state or score into the app", shaped.improve.length <= 240 && shaped.ai === true && !("state" in shaped) && !("score" in shaped) && !("passed" in shaped));

/* ═══════════ J (engine half) · WELDING WALL ═════════════════════════════ */
console.log("\nJ · WELDING WALL (engine)");
ok("J · The engine refuses a Week 6 write for any area but General English — and does not create a record",
  (() => { const s = {}; return ME.addAttempt(s, W6.id, mk(W6, G6, SAY.strong, "guided", "w"), "welding", IV, meta(W6)) === null && ME.introduce(s, W6.id, "welding") === null
    && ME.addSupport(s, W6.id, { key: "x", at: 1 }, "welding") === null && Object.keys(s).length === 0; })());
ok("J · guard() accepts only the pack's own track constant", ME.guard(GE) === true && ME.guard("welding") === false && ME.TRACK === GE);

/* ═══════════ BROWSER ════════════════════════════════════════════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8101, 8102, 8103, 8104, 8105]) {
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
    if (b.assess) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ overall: 83, mode: "ai", words: [{ word: "a", score: 83 }] }) });
    if (b.chat) lastSystem = String(b.chat.system || "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Commit to one option in your own name before you give the reason.", covered: coachCovered }) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?w6=" + Date.now(), { waitUntil: "load" });
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
const rec6 = (page, id) => page.evaluate(i => JSON.parse(JSON.stringify(mvStore()[i] || {})), id);
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: innerWidth }));
const shot = async (page, name) => { if (SHOTS) { try { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); } catch (e) {} } };
/* Put every competency before Week 6 to rest inside the page, through the engine. */
const restBefore6 = page => page.evaluate(({ SAY }) => {
  const P = mvPack(), st = mvStore(), IV = trackVocabularyIntervals();
  const meta = c => ({ competency: c.id, week: c.week, moveIds: MissionEngine.moveIds(c) });
  const one = (cid, mid, text, kind, key) => { const c = MissionEngine.competencyOf(P, cid), m = MissionEngine.missionOf(c, mid);
    MissionEngine.introduce(st, cid, areaId()); const ev = Object.assign(MissionEngine.grade(c, m, text, { seconds: 27 }), { key, kind, missionId: mid, at: Date.now() - 60000 });
    MissionEngine.addAttempt(st, cid, ev, areaId(), IV, meta(c)); };
  one("explain-work", "explain-work-guided", SAY.w1strong, "guided", "z1"); one("explain-work", "explain-work-transfer", SAY.w1transfer, "transfer", "z2");
  one("clear-update", "clear-update-guided", SAY.w2strong, "guided", "z3"); one("clear-update", "clear-update-transfer", SAY.w2transfer, "transfer", "z4");
  one("raise-problem", "raise-problem-guided", SAY.w3strong, "guided", "z5"); one("raise-problem", "raise-problem-transfer", SAY.w3transfer, "transfer", "z6");
  one("clarify-confirm", "clarify-confirm-guided", SAY.w4strong, "guided", "z7"); one("clarify-confirm", "clarify-confirm-transfer", SAY.w4transfer, "transfer", "z8");
  one("explain-tech", "explain-tech-guided", SAY.w5strong, "guided", "z9"); one("explain-tech", "explain-tech-transfer", SAY.w5transfer, "transfer", "z10");
  save();
  return P.competencies.filter(c => c.week < 6).map(c => st[c.id].state).join();
}, { SAY });

console.log("\nK · HOME / TODAY");
const L = await learner("ge", GE);
const home0 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, today: document.querySelectorAll(".today-card").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText }; });
ok("K1 · A fresh learner's Home offers ONE V2 card and it is Week 1 — Week 6 does not appear prematurely",
  home0.n === 1 && home0.today <= 1 && /Week 1/i.test(home0.eyebrow || "") && /Explain what you do/i.test(home0.title || ""), JSON.stringify(home0));
const rested = await restBefore6(L.page);
ok("K2 · Weeks 1–5 are transfer-ready in this learner's store (seeded through the engine, not by hand)", rested === "TRANSFER_READY,TRANSFER_READY,TRANSFER_READY,TRANSFER_READY,TRANSFER_READY", rested);
const home1 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText, chip: c && c.querySelector(".chip").innerText, btn: c && c.querySelector("button").innerText, line: c && c.querySelector("p").innerText }; });
ok("K3 · Now Home's one card is Week 6, 'Not started', with 'Start the mission' — chosen by the engine's own priority, nothing hardcoded",
  home1.n === 1 && /Week 6/i.test(home1.eyebrow || "") && /Recommendations & decision language/i.test(home1.title || "") && /not started/i.test(home1.chip || "") && /start the mission/i.test(home1.btn || "") && /say it out loud once/i.test(home1.line || ""), JSON.stringify(home1));
const ovh = await overflow(L.page); ok("K3 · Home has no horizontal overflow at 390px with the Week 6 card", ovh.sw <= ovh.cw, JSON.stringify(ovh));
await shot(L.page, "390-home-week6");
const coachRec = await L.page.evaluate(() => ({ a: AdaptiveLearningEngine.recommendation(S, ProfessionalTrackContext.active()), m: LearningCoach.mission(S, ProfessionalTrackContext.active()) }));
ok("K4 · The Adaptive engine and the LearningCoach both surface Week 6 through the existing hooks", coachRec.a.v2 === true && /Recommendations/i.test(coachRec.a.title) && coachRec.m.v2 === true && coachRec.m.arg1 === ID + "-guided" && coachRec.m.go === "mission", JSON.stringify({ t: coachRec.a.title, arg: coachRec.m.arg1 }));
const opened = await L.page.evaluate(async () => { LearningCoach.openMission(); await new Promise(r => setTimeout(r, 400)); return { v: cur.v, comp: _mv && _mv.compId, mission: _mv && _mv.missionId }; });
ok("K5 · LearningCoach.openMission() lands on the Week 6 mission", opened.v === "mission" && opened.comp === ID && opened.mission === ID + "-guided", JSON.stringify(opened));

/* SEE → HEAR → NOTICE for Week 6 */
console.log("\nTHE LOOP · SEE → HEAR → NOTICE");
await L.page.evaluate(id => mvGo(id + "-guided", "see"), ID); await sleep(350);
const see = await L.page.evaluate(id => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), state: (mvStore()[id] || {}).state, cta: document.querySelectorAll("#v-mission .mv-cta").length, back: !!document.querySelector("#v-mission > .mv-back") }), ID);
ok("SEE renders Week 6's title, the project lead's question and the goal, with one action and a way back — and is worth INTRODUCED only",
  /Recommendations & decision language/i.test(see.txt) && /three weeks late/i.test(see.txt) && /What do you recommend/i.test(see.txt) && /Step 1 of 7/i.test(see.txt) && see.cta === 1 && see.back && see.state === "INTRODUCED", see.txt.slice(0, 160));
const ovs = await overflow(L.page); ok("SEE has no horizontal overflow at 390px", ovs.sw <= ovs.cw, JSON.stringify(ovs));
await shot(L.page, "390-see");
await L.page.evaluate(() => mvStep("hear")); await sleep(300);
const hear = await L.page.evaluate(() => { const vis = () => /keeping that date is worth more/i.test(document.getElementById("v-mission").innerText);
  const hidden = !vis(), play = document.querySelectorAll(".mv-play button").length, reveal = !!document.querySelector(".mv-reveal");
  document.querySelector(".mv-reveal").click();
  return { hidden, play, reveal, shownAfter: vis(), heard: (window.__ev || []).some(e => e[0] === "v2_mission_heard"), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("HEAR is voice-first: two play buttons, Week 6's model hidden until 'Show the words', the heard event logged, no overflow",
  hear.hidden && hear.play === 2 && hear.reveal && hear.shownAfter && hear.heard && hear.sw <= hear.cw, JSON.stringify(hear));
await shot(L.page, "390-hear");
await L.page.evaluate(() => mvStep("notice")); await sleep(350);
const notice = await L.page.evaluate(() => ({
  moves: [...document.querySelectorAll(".mv-list li b")].map(b => b.innerText),
  eyebrow: (document.querySelector(".mv-notice .eyebrow") || {}).innerText, sub: (document.querySelector(".mv-notice .sub") || {}).innerText,
  shadow: !!document.querySelector(".mv-shadow"), cta: document.querySelectorAll("#v-mission .mv-cta").length }));
ok("NOTICE renders the five Week 6 moves by label, says '5 moves', and — with no clip linked — shows NO Shadow row",
  notice.moves.join() === "Lay out the options,Recommend one,Give the reason,Name the trade-off,Propose the next step" && /5 moves/i.test(notice.eyebrow + " " + notice.sub) && notice.shadow === false && notice.cta === 1, JSON.stringify(notice));
const ovn = await overflow(L.page); ok("NOTICE has no horizontal overflow at 390px with five moves", ovn.sw <= ovn.cw, JSON.stringify(ovn));
await shot(L.page, "390-notice");
const noType = await L.page.evaluate(() => ({ ta: document.querySelectorAll("#v-mission textarea").length, inp: document.querySelectorAll("#v-mission input[type=text]").length, sc: document.querySelectorAll("#v-mission .score-b").length }));
ok("Week 6 is voice-first — no script box, no text input, no self-score", noType.ta === 0 && noType.inp === 0 && noType.sc === 0, JSON.stringify(noType));

/* ── SPEAK → COACH (weak: everything laid out, nothing chosen) ── */
console.log("\nSPEAK → COACH");
await L.page.evaluate(() => mvStep("speak")); await sleep(250);
const spk = await L.page.evaluate(() => ({ btn: document.querySelectorAll("#v-mission .rec-btn").length, prompt: (document.querySelector(".mv-q") || {}).innerText, ctx: (document.querySelector(".mv-ctx") || {}).innerText, state: (document.getElementById("recState") || {}).innerText }));
ok("SPEAK shows the question, both options with their facts as context, and one recorder in its idle state",
  spk.btn === 1 && /What do you recommend/i.test(spk.prompt || "") && /Option A/.test(spk.ctx || "") && /Option B/.test(spk.ctx || "") && /20%/.test(spk.ctx || "") && /record your answer/i.test(spk.state || ""), JSON.stringify(spk).slice(0, 220));
await shot(L.page, "390-speak");
coachCovered = ["options", "reason", "tradeoff", "next"];
await L.page.evaluate(t => { window.__say = t; }, SAY.noRecommend);
await L.page.evaluate(() => mvRecord());
await L.page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
const recording = await L.page.evaluate(() => ({ cls: document.querySelector("#v-mission .rec-btn").className, state: (document.getElementById("recState") || {}).innerText, rec: !!_mv.recording, ev: (window.__ev || []).filter(e => e[0] === "v2_speak_attempt").length }));
ok("While recording, the button is in its recording state, the label says so, and the speak event was logged", /recording/.test(recording.cls) && /listening/i.test(recording.state || "") && recording.rec && recording.ev === 1, JSON.stringify(recording));
await shot(L.page, "390-recording");
await sleep(1200);
await L.page.evaluate(() => mvRecord());
await L.page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
await sleep(250);
const b1 = await L.page.evaluate(() => ({ moves: _mv.ev.moves, cov: _mv.ev.coverage, move: _mv.coach.move, ai: _mv.coach.ai, chips: document.querySelectorAll(".mv-move").length, off: document.querySelectorAll(".mv-move.off").length, improve: (document.querySelector(".mv-improve") || {}).innerText, step: _mv.step }));
ok("B1 · the missing recommendation is identified from what was said; five chips render, one off",
  b1.moves.recommend === false && b1.cov === 0.8 && b1.move === "recommend" && b1.chips === 5 && b1.off === 1 && b1.step === "coach", JSON.stringify({ c: b1.cov, m: b1.move, chips: b1.chips, off: b1.off }));
ok("B2 · four of five does not advance the learner", (await rec6(L.page, ID)).state === "PRACTICING");
ok("B3 · the coach's system prompt carried Week 6's five moves — not Week 5's check, Week 4's confirm or Week 3's ask",
  /makes 5 communication/.test(lastSystem) && /recommend \(Recommend one\)/.test(lastSystem) && !/check \(/.test(lastSystem) && !/confirm \(/.test(lastSystem) && !/ask \(What I need\)/.test(lastSystem), lastSystem.slice(0, 90));
ok("B4 · the coaching shown is the model's and is tagged as such", b1.ai === true && /own name/i.test(b1.improve || ""));
const ovc = await overflow(L.page); ok("COACH has no horizontal overflow at 390px with five chips", ovc.sw <= ovc.cw, JSON.stringify(ovc));
await shot(L.page, "390-coach");

/* ── RETRY ── */
console.log("\nRETRY");
const retry = await L.page.evaluate(() => { mvRetry(); return { text: _mv.retryText, step: _mv.step, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText }; });
ok("C1 · the retry names the Week 6 move that was missed, in the pack's own words, on the retry step", /commit to ONE option/i.test(retry.text || "") && retry.step === "speak" && /one more time/i.test(retry.eyebrow || ""), JSON.stringify(retry));
await shot(L.page, "390-retry");
coachCovered = ["options", "recommend", "reason", "tradeoff", "next"];
await speak(L.page, SAY.strong);
const c2 = await rec6(L.page, ID);
ok("C2 · the retry is stored as a retry; both attempts are preserved", c2.attempts.length === 2 && c2.attempts[0].coverage === 0.8 && c2.attempts[1].kind === "retry" && c2.attempts[1].coverage === 1);
ok("C3 · progression recalculates to DEMONSTRATED", c2.state === "DEMONSTRATED", c2.state);
const transferBtn = await L.page.evaluate(() => [...document.querySelectorAll(".mv-acts button")].map(b => b.innerText).join("|"));
ok("C4 · once demonstrated, the coach screen offers the new situation", /take the new situation/i.test(transferBtn), transferBtn);

/* ── TRANSFER ── */
console.log("\nTRANSFER");
await L.page.evaluate(id => mvGo(id + "-transfer", "speak"), ID); await sleep(300);
const tp = await L.page.evaluate(() => ({ q: (document.querySelector(".mv-q") || {}).innerText, comp: _mv.compId, kind: _mv.kind, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText, instr: (document.querySelector(".mv-instruction") || {}).innerText, ctx: (document.querySelector(".mv-ctx") || {}).innerText }));
ok("D1 · the transfer is a different decision, still Week 6, framed as the new situation with the cold goal and its own two choices",
  /send it or hold it/i.test(tp.q || "") && tp.comp === ID && tp.kind === "transfer" && /new situation/i.test(tp.eyebrow || "") && /nobody is prompting you/i.test(tp.instr || "") && /twelve charts/i.test(tp.ctx || ""), JSON.stringify(tp).slice(0, 220));
await shot(L.page, "390-transfer");
await speak(L.page, SAY.transfer);
const d2 = await rec6(L.page, ID);
ok("D2 · transfer evidence is stored as its own kind, separate from practice", d2.attempts.length === 3 && d2.attempts[2].kind === "transfer" && d2.attempts[2].transfer === true);
ok("D3 · one cold success is TRANSFER_READY, not STRONG", d2.state === "TRANSFER_READY" && d2.transfer.passed === 1, d2.state);
ok("D4 · a retrieval is scheduled from the track's own intervals", d2.retrieval && d2.retrieval.reason === "retrieval" && d2.retrieval.due > Date.now());
await L.page.evaluate(() => mvStep("done")); await sleep(300);
const done = await L.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), bars: document.querySelectorAll(".mv-bars > *").length, chips: document.querySelectorAll(".mv-move").length, shadowNote: !!document.querySelector(".mv-shadow-note") }));
ok("D5 · the evidence screen shows the state, five chips and the dimension bars — pronunciation as a number here because the (mocked) audio grader measured it — and no Shadow line",
  /transfer ready/i.test(done.txt) && done.bars >= 5 && done.chips === 5 && /83%/.test(done.txt) && done.shadowNote === false, done.txt.slice(0, 160));
const ovd = await overflow(L.page); ok("Evidence screen has no horizontal overflow at 390px", ovd.sw <= ovd.cw, JSON.stringify(ovd));
await shot(L.page, "390-evidence");

/* ── K · PROGRESS ── */
console.log("\nK · PROGRESS");
const prog = await L.page.evaluate(() => { go("review"); const ps = [...document.querySelectorAll(".pg-v2")]; const d = window.v2Evidence();
  return { panels: ps.length, txt: ps.map(p => p.innerText.replace(/\s+/g, " ")).join(" || "), comps: d.map(x => x.competency + ":" + x.state), weeks: d.map(x => x.week).join(), moves: d.map(x => (x.byMove || []).length).join(), last: d[d.length - 1] }; });
const spokenComps = PACK.competencies.filter(c => c.week <= 6);
ok("K6 · Progress renders every spoken competency oldest week first, in canonical order with each one's own move count — ordering and counts come from the data",
  prog.panels === spokenComps.length && prog.weeks === spokenComps.map(c => c.week).join() && prog.moves === spokenComps.map(c => c.moves.length).join() && prog.comps[spokenComps.length - 1] === ID + ":TRANSFER_READY", JSON.stringify({ p: prog.panels, w: prog.weeks, m: prog.moves, c: prog.comps }));
ok("K7 · The Week 6 panel names its week, its state and its own moves through the same evidence contract",
  /Week 6/.test(prog.txt) && /Name the trade-off/.test(prog.txt) && /Recommend one/.test(prog.txt) && prog.last.week === 6 && prog.last.attempts === 3 && prog.last.passed === 2 && prog.last.transferPassed === 1 && prog.last.pron === 83 && prog.last.pronSource === "audio", JSON.stringify({ w: prog.last.week, a: prog.last.attempts, p: prog.last.passed }));
const ovp = await overflow(L.page); ok("Progress has no horizontal overflow at 390px with six panels", ovp.sw <= ovp.cw, JSON.stringify(ovp));
await shot(L.page, "390-progress");
for (const c of LATER) {
  const step = await L.page.evaluate(({ id, transfer }) => {
    go("home"); const before = document.querySelector(".mv-home"); const offered = before ? before.querySelector(".eyebrow").innerText : "";
    const comp = mvComp(id), st = mvStore(), IV = trackVocabularyIntervals();
    const meta = { competency: comp.id, week: comp.week, moveIds: MissionEngine.moveIds(comp) };
    const one = (m, text, kind, key) => { MissionEngine.introduce(st, comp.id, areaId()); const ev = Object.assign(MissionEngine.grade(comp, m, text, { seconds: 27 }), { key, kind, missionId: m.id, at: Date.now() - 60000 }); MissionEngine.addAttempt(st, comp.id, ev, areaId(), IV, meta); };
    const g = comp.missions.find(m => m.kind === "guided"), t = comp.missions.find(m => m.kind === "transfer");
    one(g, g.hear.model, "guided", "zg" + comp.week); one(t, transfer, "transfer", "zt" + comp.week);
    save(); go("home"); return { offered, state: st[comp.id].state };
  }, { id: c.id, transfer: SAY.transfers[c.id] });
  ok(`K8 · With everything before it resting, Home's one card is ${c.id} (Week ${c.week}); resting it makes it transfer-ready`, new RegExp("Week " + c.week).test(step.offered) && step.state === "TRANSFER_READY", JSON.stringify(step));
}
const afterAll = await L.page.evaluate(() => { go("home"); return { n: document.querySelectorAll(".mv-home").length, card: !!document.querySelector(".mv-home") }; });
ok("K8 · With every competency resting, Home shows no V2 card and looks as it did before V2 — the old advice stands", afterAll.n === 0 && afterAll.card === false, JSON.stringify(afterAll));
const voc = await L.page.evaluate(id => Object.entries(areaVocab()).filter(([, v]) => v.src && v.src.v2 === id).map(([w]) => w), ID);
ok("K9 · Week 6 expressions were acquired automatically, tagged to Week 6", voc.length > 0 && voc.every(w => W6.expressions.some(e => e.w === w)), JSON.stringify(voc));

/* ── I · ANALYTICS ── */
console.log("\nI · ANALYTICS");
const ev = await L.page.evaluate(id => (window.__ev || []).filter(e => e[0].startsWith("v2_") && e[1].competency === id).map(e => [e[0], e[1].track, e[1].week, e[1].competency, e[1].mission]), ID);
ok("I1 · every Week 6 analytics event carries track general-english, week '6' and competency recommend-decide",
  ev.length >= 10 && ev.every(e => e[1] === GE && e[2] === "6" && e[3] === ID), JSON.stringify(ev.slice(0, 4)));
const evNames = [...new Set(ev.map(e => e[0]))];
const ALL11 = ["v2_mission_started", "v2_mission_heard", "v2_speak_attempt", "v2_coach_generated", "v2_evidence_recorded", "v2_retry_attempt", "v2_transfer_started", "v2_transfer_completed", "v2_competency_progressed", "v2_retrieval_scheduled", "v2_recommendation_generated"];
ok("I2 · the loop emitted all eleven existing v2_* names for Week 6 and nothing else", ALL11.every(n => evNames.includes(n)) && evNames.every(n => ALL11.includes(n)), evNames.join());
const evProps = await L.page.evaluate(() => (window.__ev || []).filter(e => e[0].startsWith("v2_")).map(e => e[1]));
ok("I3 · every prop key is one the Worker's v2 column map already carries", evProps.every(p => Object.keys(p).every(k => ["track", "week", "competency", "mission", "kind", "move", "result", "band", "state", "from", "attempt", "ai"].includes(k))));
ok("I4 · the move and mission values are Week 6's own enums, and a progression carries from/state",
  evProps.filter(p => p.competency === ID).every(p => (!p.move || ["options", "recommend", "reason", "tradeoff", "next", "none"].includes(p.move)) && (!p.mission || new RegExp("^" + ID + "-(guided|transfer)$").test(p.mission) || p.mission === "shadow")) && evProps.some(p => p.state === "TRANSFER_READY" && p.from === "DEMONSTRATED"));
const pii = JSON.stringify(evProps);
ok("I5 · no event carries a transcript, the profile name or the goal", !/supplier|go-live|two thousand|\"T\"|confidence in meetings/i.test(pii));
const nonV2 = await L.page.evaluate(() => (window.__ev || []).map(e => e[0]).filter(n => !n.startsWith("v2_")));
ok("I6 · the mission emitted no V1 session_complete and no Welding event", !nonV2.includes("session_complete") && !nonV2.some(n => /workshop|weld/.test(n)), nonV2.join());

/* ── CLOUD MERGE ── */
console.log("\nG · CLOUD MERGE (app)");
const merged = await L.page.evaluate(({ SAY, id }) => {
  const c = mvComp(id), g = MissionEngine.missionOf(c, id + "-guided");
  const meta = { competency: c.id, week: c.week, moveIds: MissionEngine.moveIds(c) };
  const att = (key, text, at) => Object.assign(MissionEngine.grade(c, g, text, { seconds: 20 }), { key, kind: "guided", missionId: g.id, at });
  const local = JSON.parse(JSON.stringify(S)), cloud = JSON.parse(JSON.stringify(S));
  local.v2A = { "general-english": {} }; cloud.v2A = { "general-english": {} };
  const IV = trackVocabularyIntervals();
  MissionEngine.introduce(local.v2A["general-english"], c.id, areaId(), 1e12);
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("a", SAY.noRecommend, 1e12 + 1), areaId(), IV, meta);
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.introduce(cloud.v2A["general-english"], c.id, areaId(), 1e12 + 5);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("c", SAY.noOptions, 1e12 + 3), areaId(), IV, meta);
  const m = fbMerge(local, cloud); const r = m.v2A["general-english"][id];
  const pr = fbSyncPayload(m).v2A["general-english"][id];
  return { keys: r.attempts.map(a => a.key).join(), state: r.state, introducedAt: r.introducedAt, saidLocal: r.attempts.every(a => typeof a.said === "string" && a.said.length > 0), saidCloud: pr.attempts.every(a => !("said" in a)), weeks: r.attempts.every(a => a.week === 6 && a.competency === id), buckets: Object.keys(m.v2A).join() };
}, { SAY, id: ID });
ok("G · Two devices' Week 6 attempts union on the idempotency key (a, b, c — b once); state is recomputed; introducedAt is the earliest",
  merged.keys === "a,b,c" && merged.state === "DEMONSTRATED" && merged.introducedAt === 1e12, JSON.stringify(merged));
ok("G · The learner's words stay on the device and are stripped from the sync payload; every row is week 6 / recommend-decide; no Welding bucket", merged.saidLocal && merged.saidCloud && merged.weeks && merged.buckets === "general-english");

/* ── DESKTOP ── */
console.log("\nUI · DESKTOP");
const Dk = await learner("desk", GE, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
await restBefore6(Dk.page);
const dkHome = await Dk.page.evaluate(async () => { go("home"); await new Promise(r => setTimeout(r, 300)); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, o: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth } }; });
ok("Desktop: Home offers the Week 6 card with no horizontal overflow", dkHome.n === 1 && /Week 6/i.test(dkHome.eyebrow || "") && dkHome.o.sw <= dkHome.o.cw, JSON.stringify(dkHome));
await shot(Dk.page, "1280-home");
const dk = await Dk.page.evaluate(async id => {
  const o = () => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth });
  mvGo(id + "-guided", "see"); await new Promise(r => setTimeout(r, 300)); const o0 = o();
  mvStep("hear"); await new Promise(r => setTimeout(r, 300)); const oh = o(), play = document.querySelectorAll(".mv-play button").length;
  mvStep("notice"); await new Promise(r => setTimeout(r, 400)); const o1 = o(), moves = document.querySelectorAll(".mv-list li").length;
  mvStep("speak"); await new Promise(r => setTimeout(r, 300)); const o2 = o(), cta = document.querySelectorAll("#v-mission .rec-btn").length;
  return { o0, oh, play, o1, o2, moves, cta }; }, ID);
ok("Desktop: SEE, HEAR (two play buttons), NOTICE (five moves) and SPEAK (one recorder) render with no horizontal overflow",
  dk.play === 2 && dk.moves === 5 && dk.cta === 1 && [dk.o0, dk.oh, dk.o1, dk.o2].every(x => x.sw <= x.cw), JSON.stringify(dk));
await shot(Dk.page, "1280-speak");
coachCovered = ["options", "reason", "tradeoff", "next"];
await Dk.page.evaluate(t => { window.__say = t; }, SAY.noRecommend);
await Dk.page.evaluate(() => mvRecord());
await Dk.page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
const dkRec = await Dk.page.evaluate(() => ({ cls: document.querySelector("#v-mission .rec-btn").className, state: (document.getElementById("recState") || {}).innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
ok("Desktop: the recording state is visible and usable", /recording/.test(dkRec.cls) && /listening/i.test(dkRec.state || "") && dkRec.sw <= dkRec.cw, JSON.stringify(dkRec));
await shot(Dk.page, "1280-recording");
await sleep(1200);
await Dk.page.evaluate(() => mvRecord());
await Dk.page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
await sleep(250);
const dkCoach = await Dk.page.evaluate(() => ({ step: _mv.step, chips: document.querySelectorAll(".mv-move").length, off: document.querySelectorAll(".mv-move.off").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, acts: document.querySelectorAll(".mv-acts button").length }));
ok("Desktop: COACH renders five chips (one off) and its actions with no overflow", dkCoach.step === "coach" && dkCoach.chips === 5 && dkCoach.off === 1 && dkCoach.acts >= 2 && dkCoach.sw <= dkCoach.cw, JSON.stringify(dkCoach));
await shot(Dk.page, "1280-coach");
const dkRetry = await Dk.page.evaluate(() => { mvRetry(); return { step: _mv.step, text: _mv.retryText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("Desktop: RETRY names the missing move with no overflow", dkRetry.step === "speak" && /commit to ONE option/i.test(dkRetry.text || "") && dkRetry.sw <= dkRetry.cw);
coachCovered = ["options", "recommend", "reason", "tradeoff", "next"];
await speak(Dk.page, SAY.strong);
await Dk.page.evaluate(id => mvGo(id + "-transfer", "speak"), ID); await sleep(300);
const dkT = await Dk.page.evaluate(() => ({ kind: _mv.kind, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
ok("Desktop: TRANSFER opens with no overflow", dkT.kind === "transfer" && dkT.sw <= dkT.cw, JSON.stringify(dkT));
await shot(Dk.page, "1280-transfer");
await speak(Dk.page, SAY.transfer);
await Dk.page.evaluate(() => mvStep("done")); await sleep(300);
const dkDone = await Dk.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), chips: document.querySelectorAll(".mv-move").length, bars: document.querySelectorAll(".mv-bars > *").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
ok("Desktop: EVIDENCE shows transfer ready with five chips and the bars, no overflow", /transfer ready/i.test(dkDone.txt) && dkDone.chips === 5 && dkDone.bars >= 5 && dkDone.sw <= dkDone.cw, dkDone.txt.slice(0, 120));
await shot(Dk.page, "1280-evidence");
const dkProg = await Dk.page.evaluate(async () => { go("review"); await new Promise(r => setTimeout(r, 300)); return { panels: document.querySelectorAll(".pg-v2").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("Desktop: PROGRESS renders one panel per spoken competency with no overflow", dkProg.panels === spokenComps.length && dkProg.sw <= dkProg.cw, JSON.stringify(dkProg));
await shot(Dk.page, "1280-progress");

/* ── OFFLINE / IDEMPOTENCY ── */
console.log("\nG · NETWORK FAILURE (app)");
const O = await learner("off", GE);
await O.page.evaluate(id => mvGo(id + "-guided", "speak"), ID); await sleep(300);
coachMode = "abort";
const hits0 = polishHits;
await speak(O.page, SAY.strong);
const e1 = await O.page.evaluate(async id => { const r = mvStore()[id]; const recs = await getRecs(_mv.recCtx);
  return { n: r.attempts.length, said: !!r.attempts[0].said, cov: r.attempts[0].coverage, pending: r.attempts[0].coachPending, state: r.state, audio: recs.length, offline: _mv.coach && _mv.coach.offline, pron: r.attempts[0].pron, key: r.attempts[0].key }; }, ID);
ok("Offline: attempt, transcript and audio survive; evidence is correct and was computed on the device", e1.n === 1 && e1.said && e1.audio === 1 && e1.cov === 1 && e1.state === "DEMONSTRATED", JSON.stringify(e1));
ok("Offline: coaching is pending; the deterministic fallback is shown; pronunciation is null, not 0", e1.pending === true && e1.offline === true && e1.pron === null, JSON.stringify(e1));
const dupe = await O.page.evaluate(id => { const c = mvComp(id); const before = mvStore()[id].attempts.length; mvCommit(c, _mv.ev, _mv.coach); mvCommit(c, _mv.ev, _mv.coach); return { before, after: mvStore()[id].attempts.length, key: _mv.ev.key }; }, ID);
ok("Offline: replaying the same spoken turn twice writes nothing more — one turn, one row", dupe.before === 1 && dupe.after === 1 && dupe.key === e1.key, JSON.stringify(dupe));
coachMode = "ok"; coachCovered = ["options", "recommend", "reason", "tradeoff", "next"];
await O.page.evaluate(() => mvFinishCoaching());
await O.page.waitForFunction(() => _mv && !_mv.busy, null, { timeout: 12000 }).catch(() => {});
await sleep(300);
const e3 = await O.page.evaluate(id => { const r = mvStore()[id]; return { n: r.attempts.length, pending: r.attempts[0].coachPending, ai: _mv.coach && _mv.coach.ai, state: r.state }; }, ID);
ok("Offline: recovery completes the coaching and creates no second piece of evidence; the Worker was called again", e3.n === 1 && e3.pending === false && e3.ai === true && e3.state === "DEMONSTRATED" && polishHits > hits0 + 1, JSON.stringify(e3));

/* ── J · WELDING ── */
console.log("\nJ · WELDING ISOLATION (app)");
const Wd = await learner("weld", "welding");
const w = await Wd.page.evaluate(async id => {
  const before = JSON.stringify(S.v2A || {});
  go("home"); await new Promise(r => setTimeout(r, 300));
  const card = !!document.querySelector(".mv-home"), homeTxt = document.getElementById("v-home").innerText;
  go("mission", id + "-guided", "speak"); await new Promise(r => setTimeout(r, 400));
  const view = cur.v, html = (document.getElementById("v-mission") || {}).innerHTML;
  const refused = MissionEngine.addAttempt(S.v2A || (S.v2A = {}), id, { key: "x", answered: true, coverage: 1, kind: "guided" }, areaId(), [1]) === null;
  mvTrack("v2_speak_attempt", { mission: id + "-guided" });
  mvTrack("v2_mission_started", { mission: id + "-guided" }, { id, week: 6 });
  const unchanged = JSON.stringify(S.v2A || {}) === before;
  const cur6 = activeCurriculum();
  go("review"); await new Promise(r => setTimeout(r, 300));
  return { area: areaId(), comps: mvComps().length, comp: mvComp(id), missions: cur6.missions, card, homeMentions: /Recommendations & decision language|Lay out the options/i.test(homeTxt), view, html: (html || "").length,
    refused, unchanged, weldRows: Object.keys(((S.v2A || {}).welding) || {}).length, buckets: Object.keys(S.v2A || {}).join(), ev: window.v2Evidence(), rec: window.v2Recommendation(),
    panel: !!document.querySelector(".pg-v2"), events: (window.__ev || []).filter(e => e[0].startsWith("v2_")).length,
    weeks: (cur6.weeks || []).length, sims: (cur6.simulations || []).length, stage: (cur6.weeks[0] || {}).stage };
}, ID);
ok("J1 · Welding's curriculum resolves missions to null — Week 6 does not reach it through inheritance", w.area === "welding" && w.missions === null && w.comps === 0 && w.comp === null, JSON.stringify({ a: w.area, m: w.missions, c: w.comps }));
ok("J2 · no V2 card and no Week 6 title or move wording on the Welding home", w.card === false && w.homeMentions === false);
ok("J3 · routing straight to the Week 6 mission turns a Welding learner around safely", w.view === "home" && w.html === 0, JSON.stringify({ v: w.view, len: w.html }));
ok("J4 · the engine refuses to write Week 6 evidence for a Welding learner; no Welding bucket is created", w.refused && w.unchanged && w.weldRows === 0 && !/welding/.test(w.buckets));
ok("J5 · no Week 6 analytics can be emitted from Welding, even with the competency passed in by hand", w.events === 0, String(w.events));
ok("J6 · both hooks return null and the Welding Progress page shows no V2 panel", w.ev === null && w.rec === null && w.panel === false);
ok("J7 · existing Welding curriculum is unchanged: 12 stages, 12 simulations", w.weeks === 12 && w.sims === 12 && /Stage 1/.test(w.stage || ""), JSON.stringify({ w: w.weeks, s: w.sims }));

ok("No uncaught page errors in any context", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
