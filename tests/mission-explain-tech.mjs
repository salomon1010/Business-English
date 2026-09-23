/* BE Mastery V2.5 — General English Week 5 "Explaining technical work to
   non-technical stakeholders", end to end, and the data-only proof.

   Week 5 is the FIFTH competency and it arrived as one entry in
   tracks/general/missions.json. This suite is the claim that nothing else had
   to change: the engine, the evidence contract, the state machine, the
   retrieval, the recommendation, the coach boundary, the Home card, the
   Progress panel, the cloud merge and the Welding wall all behave for a
   competency they had never seen.

   The four moves are FRAME → PLAIN → IMPACT → CHECK. The situation supplies
   the technical facts; the learner is never asked to know anything they were
   not given, and the rubric rewards how they say it, never what they know.
   Technical vocabulary on its own proves nothing here — that is the point.

   Canonical numbering: the `week` of a competency is the General English
   programme week it teaches — Week 5 is "Explaining technical work to
   non-technical stakeholders" in weeks.json. See the _note in missions.json.

   Run:  cd tests && node mission-explain-tech.mjs
         SHOTS=/some/dir node mission-explain-tech.mjs   (also saves screenshots) */
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

const W1 = ME.competencyOf(PACK, "explain-work");
const W2 = ME.competencyOf(PACK, "clear-update");
const W3 = ME.competencyOf(PACK, "raise-problem");
const W4 = ME.competencyOf(PACK, "clarify-confirm");
const W5 = ME.competencyOf(PACK, "explain-tech");
const G1 = ME.missionOf(W1, "explain-work-guided"), T1 = ME.missionOf(W1, "explain-work-transfer");
const G2 = ME.missionOf(W2, "clear-update-guided"), T2 = ME.missionOf(W2, "clear-update-transfer");
const G3 = ME.missionOf(W3, "raise-problem-guided"), T3 = ME.missionOf(W3, "raise-problem-transfer");
const G4 = ME.missionOf(W4, "clarify-confirm-guided"), T4 = ME.missionOf(W4, "clarify-confirm-transfer");
const G5 = W5 && ME.missionOf(W5, "explain-tech-guided"), T5 = W5 && ME.missionOf(W5, "explain-tech-transfer");
const IV = [1, 3, 7, 21, 60];
const GE = "general-english";
const MOVES = "frame,plain,impact,check";
const meta = c => ({ competency: c.id, week: c.week, moveIds: ME.moveIds(c) });
const mk = (c, m, text, kind, key, at) => Object.assign(ME.grade(c, m, text, { seconds: 27 }),
  { key, kind, at: at || Date.now(), missionId: m.id });

/* ── what the learners will say ──────────────────────────────────────────── */
const SAY = {
  strong: G5 && G5.hear.model,
  noFrame: "Behind the scenes, every night the system compares the new figures with last month's and flags anything that looks wrong. What this means for you is that the month-end report can't go out with a broken number in it. The one thing to remember is that a late report means a check caught something. Does that make sense?",
  noPlain: "In simple terms, the checks are a set of tests that run before any report goes out. What this means for you is that the month-end report can't go out with a broken number in it. The one thing to remember: a late report means a check caught something. Does that make sense?",
  noImpact: "In simple terms, the checks are a set of tests that run before any report goes out. Behind the scenes, every night the system compares the new figures with last month's and flags anything that looks wrong. The one thing to remember: if a report is a day late, it's because a check caught something. Does that make sense?",
  /* the move most technical people leave out: they explain and stop, and never land the one sentence */
  noCheck: "In simple terms, the checks are a set of tests that run before any report goes out. Behind the scenes, every night the system compares the new figures with last month's and flags anything that looks wrong. What this means for you is that the month-end report can't go out with a broken number in it, so you stop finding mistakes in the board pack.",
  transfer: "In plain terms, the integration is a link between their shop and our warehouse. The way it works is that every time a customer places an order, it goes straight to the warehouse system automatically, instead of someone typing it in each morning. What this means for the client is that orders ship the same day and the typing mistakes stop. The one thing to remember is that returns aren't included yet — those are still done by hand. Does that make sense?",
  transferWeak: "In plain terms, the integration is a link between their shop and our warehouse. The way it works is that every time a customer places an order, it goes straight to the warehouse system automatically. What this means for the client is that orders ship the same day.",
  /* a correct, expert answer that a finance director cannot use — and the rubric must not reward it */
  jargon: "The integration is a REST API integration between their Shopify instance and our WMS. Orders are posted as JSON payloads to the endpoint and the WMS ingests them via a webhook; returns are out of scope for phase one.",
  jargon2: "The ETL pipeline ingests the CSV extracts into the data warehouse via a nightly cron job, validates the schema and the referential integrity, and raises an exception on any constraint violation.",
  /* browser speech recognition usually returns one unpunctuated run */
  unpunctuated: "in simple terms the checks are a set of tests that run before any report goes out behind the scenes every night the system compares the new figures with last month's and flags anything that looks wrong what this means for you is that the month-end report can't go out with a broken number in it so you stop finding mistakes in the board pack the one thing to remember if a report is a day late it's because a check caught something does that make sense",
  short: "It just works.",
  seven: "In simple terms, it checks the numbers.",
  eight: "In simple terms, it checks the numbers nightly.",
  /* Weeks 1–4, to put them to rest when the question is whether Week 5 waits its turn */
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
  /* V2.6: cold transfers for every competency after Week 5, keyed by id, so the
     all-resting cases can walk the pack in week order. A new week adds one entry. */
  transfers: {
    "recommend-decide": "There are two options here. One option is to send it tomorrow with the numbers corrected by hand, and the other option is to hold it for two days and rerun everything from the fixed source. My recommendation is to hold it. The reason is that last quarter they complained about a wrong figure, and two of the twelve charts can't be checked in time if we send tomorrow. The downside is that it's the first late report we've ever sent them. So the next step is that you tell the client today that it's coming on Thursday, and I'll rerun it as soon as the source is fixed.",
    "disagree-pushback": "I understand why the director wants one go \u2014 a phased move takes longer, and nobody wants this dragging into next year. I'd push back on doing the whole warehouse in one weekend, though. The reason is the pilot: at the small depot the switch took two weeks to settle, forty stock counts were wrong in the first week, and the main warehouse holds twenty times the stock. What I'd suggest is that we switch the night team first, since they're already trained, and bring the day shifts across two weeks later. We both want this done before December, and that way we still finish by the end of November without a weekend where nothing can be counted. What would the director need to see to agree to that?",
    "sprint-coordinate": "The landing page is built and both banner variants are ready to test. The sign-up form is blocked: the dependency is legal's review of the prize-draw terms \u2014 they've had them since Monday and said end of week. Without approved terms the form can't go live, so the first is at risk for sign-ups. To keep the launch on track, I'd go out on the first with the newsletter and no prize draw, and add the draw the week after when legal comes back. Could you ping the head of legal today and let me know by Thursday? If the terms land by Thursday, the form is live for the first; either way the newsletter goes out on the first.",
    "exec-summary": "The short version: the savings programme reaches its 400 thousand target this year only if we close the third supplier, and that needs a decision from you before Friday. At a high level, two of the four contracts are signed, worth 260 thousand, and the fourth signs next month for another 60. The biggest risk is the third supplier \u2014 110 thousand of the target \u2014 where the negotiation has stalled for three weeks on payment terms: they want 60 days, our standard is 45. Finance can live with 60 days if you agree, and their offer lapses on Friday. The decision I need from you is whether we accept 60-day terms to close it this week. The key takeaway: without the third contract we land at 320, short of target; with it, we're over.",
    "sell-experience": "The challenge was that our forty field engineers were driving two hours forty a day between jobs. Overtime was thirty per cent over budget, and two engineers had resigned because of the driving. Nobody had looked at routing since the company doubled in size, so I led the effort to fix it. I pulled the last three months of job data with an analyst from the planning team, and we found jobs were assigned by who was free, not by where they were. The dispatchers were worried customers would wait longer, so I influenced the decision by asking the director for one region and six weeks, with waiting times measured too. The result was that driving fell to an hour fifty and overtime came back within budget, and waiting times didn't move. It's now live in all four regions. That experience taught me that I do my best work where data and persuasion meet, and that's the role I'm looking for next.",
  },
};

/* ═══════════ A · PACK ═══════════════════════════════════════════════════ */
console.log("\nA · THE PACK");
ok("A · Week 5 exists, is numbered 5, carries the canonical title, four moves and two missions",
  W5 && W5.week === 5 && W5.title === "Explaining technical work to non-technical stakeholders" && ME.moveIds(W5).join() === MOVES && W5.missions.length === 2,
  W5 && ME.moveIds(W5).join());
ok("A · The title is weeks.json's own Week 5 theme, word for word; the numbering is consecutive from 1 with Week 5 fifth — no gaps, no duplicates, whatever the count",
  WEEKS.find(w => w.n === 5).theme === W5.title && PACK.competencies.map(c => c.week).join() === PACK.competencies.map((_, i) => i + 1).join() && PACK.competencies[4].id === "explain-tech", WEEKS.find(w => w.n === 5).theme);
ok("A · The competency id is semantic, like the four before it — not derived from the week number",
  /^[a-z]+-[a-z]+$/.test(W5.id) && !/5|five|week/.test(W5.id) && PACK.competencies.every(c => /^[a-z]+-[a-z]+$/.test(c.id)));
ok("A · The pack note records Week 5, its move count and the Shadow decision", /Week 5/.test(PACK._note) && /frame → plain → impact → check/.test(PACK._note));
ok("A · The guided mission loads with the situation, the model, the prompt and the context",
  G5 && G5.kind === "guided" && G5.see && G5.see.where && G5.see.who && G5.see.asks && G5.see.goal && G5.hear && G5.hear.model && G5.hear.note && G5.prompt === G5.see.asks && G5.context);
ok("A · The transfer mission loads: a different situation, a different listener, no model to copy, and the technical facts supplied in the context",
  T5 && T5.kind === "transfer" && !T5.hear && T5.prompt !== G5.prompt && T5.see.who !== G5.see.who && /warehouse/i.test(T5.context) && /returns/i.test(T5.context) && /integration/i.test(T5.prompt));
ok("A · Neither situation asks for specialist knowledge the learner was never given: the guided context says what the checks do, the transfer context says what the integration does and does not do",
  /compare/i.test(G5.context) && /flag/i.test(G5.context) && /waits a day/i.test(G5.context) && /automatically/i.test(T5.context) && /does not yet handle returns/i.test(T5.context));
ok("A · Exactly four moves, each with an id, a label, a hint, at least 40 phrase cues, a retry line and three patterns",
  W5.moves.length === 4 && W5.moves.every(m => m.id && m.label && m.hint && Array.isArray(m.cues) && m.cues.length >= 40 && m.retry && Array.isArray(m.patterns) && m.patterns.length === 3));
ok("A · Every cue is lowercase and unique within its move, and no cue of one move is contained in a cue of another",
  W5.moves.every(m => new Set(m.cues).size === m.cues.length && m.cues.every(q => q === q.toLowerCase()))
  && W5.moves.every((a, i) => W5.moves.every((b, j) => i === j || a.cues.every(x => b.cues.every(y => !x.includes(y))))));
ok("A · Every Week 5 expression is tagged to a move that exists, and most come from the curriculum's own Week 5 'Tech to Business' phrases",
  W5.expressions.length === 8 && W5.expressions.every(e => ME.moveIds(W5).includes(e.move) && e.w && e.def && e.l)
  && W5.expressions.filter(e => PHRASES.phrases.some(p => p.w === 5 && AE.hits(p.p, e.w))).length >= 5, JSON.stringify(W5.expressions.map(e => e.w)));
ok("A · No accidental Shadow linkage: unlinked after a content check, with the established _shadow_note naming the closest candidates",
  !W5.shadow && typeof W5._shadow_note === "string" && /content check/i.test(W5._shadow_note) && /KDtidCsDGng/.test(W5._shadow_note) && /explainer clip/i.test(W5._shadow_note));
ok("A · The pack's cue decisions are written down: hedges, bare 'this means', nouns and prepositional phrases are named as non-evidence",
  /basically/.test(ME.moveOf(W5, "frame")._cue_note) && /this means/.test(ME.moveOf(W5, "plain")._cue_note) && /prepositional/.test(ME.moveOf(W5, "impact")._cue_note) && /bottom line/.test(ME.moveOf(W5, "check")._cue_note));

/* ═══════════ B · MOVE GRADING ═══════════════════════════════════════════ */
console.log("\nB · MOVE GRADING");
const padded = t => t + " and a few more words to reach the minimum";
const only = (text, m) => { const e = ME.grade(W5, G5, text, { seconds: 8 }); return Object.keys(e.moves).filter(k => e.moves[k]).join() === m; };
ok("B · Each move's own patterns credit that move and only that move",
  W5.moves.every(m => m.patterns.every(pt => only(padded(pt), m.id))));
ok("B · Each expression, when spoken, credits the move it is tagged to and counts as vocabulary used",
  W5.expressions.every(x => { const e = ME.grade(W5, G5, padded(x.w), { seconds: 5 }); return e.moves[x.move] === true && e.vocabUsed.includes(x.w); }));
ok("B · 'In plain terms, the checks are a set of tests' frames; 'think of it like a spell-checker' explains; 'the benefit is fewer late reports' gives impact; 'does that make sense' checks — one each",
  only(padded("In plain terms, the checks are a set of tests"), "frame") && only(padded("Think of it like a spell-checker for numbers"), "plain")
  && only(padded("The benefit is that you get fewer late reports"), "impact") && only(padded("Does that make sense so far"), "check"));
const gm = ME.grade(W5, G5, SAY.strong, { seconds: 45 });
ok("B · The model answer makes all four moves on its own rubric, in the taught order — the content agrees with the engine",
  gm.coverage === 1 && ME.passes(gm) && gm.clarity === 1 && gm.clarityBasis === "order+length", "missed=" + gm.missed.join());
ok("B · The model contains no technical noun the finance director would have to know: no schema, pipeline, job, SQL, table or API",
  !/schema|pipeline|\bjob\b|sql|\btable\b|\bapi\b|cron|etl|warehouse table/i.test(G5.hear.model));
ok("B · An unpunctuated transcript — what browser speech recognition actually returns — still makes all four moves; clarity rests on order alone",
  (() => { const e = ME.grade(W5, G5, SAY.unpunctuated, { seconds: 45 }); return e.coverage === 1 && ME.passes(e) && e.clarityBasis === "order"; })());
console.log("   unrelated text, generic phrases and jargon");
ok("B · A correct expert answer in jargon (REST, JSON, WMS, webhook) makes NO move — technical vocabulary is not evidence of explanation",
  (() => { const e = ME.grade(W5, T5, SAY.jargon, { seconds: 20 }); return e.coverage === 0 && e.answered; })());
ok("B · …nor does a second one (ETL, cron, schema, referential integrity)", ME.grade(W5, G5, SAY.jargon2, { seconds: 20 }).coverage === 0);
ok("B · A Week 3 problem report makes no Week 5 move", ME.grade(W5, G5, SAY.w3noAsk, { seconds: 20 }).coverage === 0);
ok("B · 'This means the job runs at two and writes to the warehouse table' credits nothing — a bare 'this means' is neither plain explanation nor impact",
  ME.grade(W5, G5, "This means the job runs at two and writes to the warehouse table.", { seconds: 5 }).coverage === 0);
ok("B · 'The reporting deadline is Thursday and the cost is high' credits nothing — a noun is not an impact",
  ME.grade(W5, G5, "The reporting deadline is Thursday and the cost of the project is high.", { seconds: 5 }).coverage === 0);
ok("B · 'The impact of the pipeline on the schema was small' credits nothing — the word 'impact' in a sentence about the system is not an impact for the listener",
  ME.grade(W5, G5, "The impact of the pipeline on the schema was small in the end.", { seconds: 5 }).coverage === 0);
ok("B · 'Basically it's a pipeline that we built last month for finance' credits nothing — a filler word is not a frame, and 'for finance' is not a consequence",
  ME.grade(W5, G5, "Basically it's a pipeline that we built last month for finance.", { seconds: 5 }).coverage === 0);
ok("B · 'We built the integration for the client and for the board' credits nothing", ME.grade(W5, G5, "We built the integration for the client and for the board last quarter.", { seconds: 5 }).coverage === 0);
ok("B · The phrase bank's 'The impact on reporting is…' IS credited, because it names the stakeholder outcome",
  (() => { const e = ME.grade(W5, G5, "The impact on reporting is that the numbers arrive a day sooner.", { seconds: 5 }); return e.moves.impact === true && e.coverage === 0.25; })());
ok("B · 'Does that make sense to everyone?' alone is a check and nothing else", only("Does that make sense to everyone in the room this morning?", "check"));

/* ═══════════ C · GUIDED ═════════════════════════════════════════════════ */
console.log("\nC · GUIDED");
const miss = (text, id) => { const e = ME.grade(W5, G5, text, { seconds: 30 }); return e.coverage === 0.75 && !ME.passes(e) && e.moves[id] === false && ME.weakestMove(W5, e, []) === id; };
ok("C · A complete answer passes", ME.passes(gm));
ok("C · Without the frame: 0.75, not passed, and 'frame' is the weakest move", miss(SAY.noFrame, "frame"));
ok("C · Without the plain explanation: 0.75, not passed, 'plain' weakest", miss(SAY.noPlain, "plain"));
ok("C · Without the impact: 0.75, not passed, 'impact' weakest — 'a day late' inside the takeaway is not an impact", miss(SAY.noImpact, "impact"));
ok("C · Without the check: 0.75, not passed, 'check' weakest", miss(SAY.noCheck, "check"));
ok("C · Three of four is 'strong' coverage by band and still not demonstrated — the bar is every move",
  (() => { const e = ME.grade(W5, G5, SAY.noCheck, { seconds: 30 }); return e.verdict === "strong" && !ME.passes(e); })());
ok("C · Deterministic coaching names the missing move and hands back its own retry line from the pack",
  (() => { const f = ME.shapeCoach(null, W5, mk(W5, G5, SAY.noCheck, "guided", "c0")); return f.move === "check" && f.retry === ME.moveOf(W5, "check").retry && /one thing they need to remember/i.test(f.retry) && f.ai === false; })());
ok("C · …and for each other missing move the retry is that move's own line",
  [["noFrame", "frame"], ["noPlain", "plain"], ["noImpact", "impact"]].every(([k, id]) => ME.shapeCoach(null, W5, mk(W5, G5, SAY[k], "guided", "c" + id)).retry === ME.moveOf(W5, id).retry));
ok("C · The missing move's expressions are queued to learn; the ones used are queued to keep",
  (() => { const q = ME.expressionsToLearn(W5, ME.grade(W5, G5, SAY.noCheck, { seconds: 30 }), "check");
    return q.some(e => e.move === "check" && e.why === "missing") && q.some(e => e.w === "in simple terms" && e.why === "used") && q.every(e => W5.expressions.some(x => x.w === e.w)); })());
ok("C · A retry that adds the missing move recovers: PRACTICING → DEMONSTRATED, both attempts kept",
  (() => { const s = {}; ME.introduce(s, W5.id, GE);
    ME.addAttempt(s, W5.id, mk(W5, G5, SAY.noCheck, "guided", "r1"), GE, IV, meta(W5));
    const before = s[W5.id].state;
    ME.addAttempt(s, W5.id, mk(W5, G5, SAY.strong, "retry", "r2"), GE, IV, meta(W5));
    return before === "PRACTICING" && s[W5.id].state === "DEMONSTRATED" && s[W5.id].attempts.length === 2 && s[W5.id].attempts[1].kind === "retry"; })());
ok("C · Three words is not an answer; seven words is not; eight is, scored on its merits", !ME.grade(W5, G5, SAY.short, { seconds: 2 }).answered && !ME.grade(W5, G5, SAY.seven, { seconds: 4 }).answered
  && (() => { const e = ME.grade(W5, G5, SAY.eight, { seconds: 4 }); return e.answered && !ME.passes(e) && e.coverage === 0.25; })());

/* ═══════════ D · TRANSFER ═══════════════════════════════════════════════ */
console.log("\nD · TRANSFER");
ok("D · The transfer fixture makes all four moves cold", ME.grade(W5, T5, SAY.transfer, { seconds: 40 }).coverage === 1, "missed=" + ME.grade(W5, T5, SAY.transfer, { seconds: 40 }).missed.join());
ok("D · Without the takeaway the transfer does not pass", (() => { const e = ME.grade(W5, T5, SAY.transferWeak, { seconds: 30 }); return e.coverage === 0.75 && !ME.passes(e) && ME.weakestMove(W5, e, []) === "check"; })());
ok("D · The transfer is not the guided answer re-used: beyond the four-word comprehension check, the two answers share no sentence, and neither mentions the other's facts",
  (() => { const sents = t => t.split(/[.!?]/).map(x => x.trim().toLowerCase()).filter(x => x.split(/\s+/).length > 5); const a = sents(SAY.transfer), b = sents(G5.hear.model);
    return a.length >= 4 && a.every(x => !b.includes(x)) && !/checks|report/i.test(SAY.transfer) && !/integration|warehouse|orders/i.test(G5.hear.model); })());
ok("D · The transfer context says what the integration does NOT do, so honesty about the limitation is available without invention", /does not yet handle returns/i.test(T5.context) && /returns aren't included yet/i.test(SAY.transfer));

/* ═══════════ E · PROGRESSION ════════════════════════════════════════════ */
console.log("\nE · PROGRESSION");
const L5 = {};
const D = 86400000, T0 = Date.parse("2026-10-12T10:00:00Z");
ok("E · NOT_STARTED before anything", ME.record(L5, W5.id).state === "NOT_STARTED" && ME.stateFrom(ME.blank(W5.id)) === "NOT_STARTED");
ME.introduce(L5, W5.id, GE, T0);
ok("E · SEE/HEAR/NOTICE → INTRODUCED and no further", L5[W5.id].state === "INTRODUCED");
ME.addAttempt(L5, W5.id, mk(W5, G5, SAY.noCheck, "guided", "p1", T0 + 60000), GE, IV, meta(W5));
ok("E · A partial attempt → PRACTICING, retrieval due now for 'practice'", L5[W5.id].state === "PRACTICING" && L5[W5.id].retrieval.reason === "practice" && L5[W5.id].retrieval.due === T0 + 60000);
ME.addAttempt(L5, W5.id, mk(W5, G5, SAY.jargon2, "retry", "p1b", T0 + 90000), GE, IV, meta(W5));
ok("E · A failed attempt (all jargon) stays PRACTICING and is kept as evidence", L5[W5.id].state === "PRACTICING" && L5[W5.id].attempts.length === 2 && L5[W5.id].attempts[1].coverage === 0);
ME.addAttempt(L5, W5.id, mk(W5, G5, SAY.strong, "retry", "p2", T0 + 120000), GE, IV, meta(W5));
ok("E · A full guided answer → DEMONSTRATED, due now for the transfer", L5[W5.id].state === "DEMONSTRATED" && L5[W5.id].retrieval.reason === "transfer");
ME.addAttempt(L5, W5.id, mk(W5, T5, SAY.transfer, "transfer", "p3", T0 + 180000), GE, IV, meta(W5));
ok("E · One cold success → TRANSFER_READY with a retrieval on the first interval (1 day)", L5[W5.id].state === "TRANSFER_READY" && L5[W5.id].transfer.passed === 1 && L5[W5.id].retrieval.reason === "retrieval" && L5[W5.id].retrieval.due === T0 + 180000 + D);
ME.addAttempt(L5, W5.id, mk(W5, T5, SAY.transfer, "transfer", "p4", T0 + 200000), GE, IV, meta(W5));
ok("E · A second cold success the SAME day is still TRANSFER_READY, spaced on the next interval (3 days)", L5[W5.id].state === "TRANSFER_READY" && L5[W5.id].transfer.passed === 2 && L5[W5.id].retrieval.due === T0 + 200000 + 3 * D);
ME.addAttempt(L5, W5.id, mk(W5, T5, SAY.transfer, "transfer", "p5", T0 + 2 * D), GE, IV, meta(W5));
ok("E · A cold success on another day → STRONG, spaced further (21 days)", L5[W5.id].state === "STRONG" && L5[W5.id].retrieval.reps === 4 && L5[W5.id].retrieval.due === T0 + 2 * D + 21 * D);
ok("E · A failed transfer counts against the tally, never fabricates a pass, and sends the learner back to guided reps",
  (() => { const s = {}; ME.introduce(s, W5.id, GE); ME.addAttempt(s, W5.id, mk(W5, G5, SAY.strong, "guided", "f1"), GE, IV, meta(W5));
    ME.addAttempt(s, W5.id, mk(W5, T5, SAY.transferWeak, "transfer", "f2"), GE, IV, meta(W5)); const r = ME.recommend(s[W5.id], W5);
    return s[W5.id].state === "DEMONSTRATED" && s[W5.id].transfer.failed === 1 && s[W5.id].transfer.passed === 0 && r.reason === "transfer_failed" && r.action === "retry" && r.missionId === "explain-tech-guided"; })());
ok("E · The schedule is the track's — a different ladder is honoured", (() => { const s = {}; ME.introduce(s, W5.id, GE, T0); ME.addAttempt(s, W5.id, mk(W5, G5, SAY.strong, "guided", "q1", T0), GE, [2, 5], meta(W5));
  ME.addAttempt(s, W5.id, mk(W5, T5, SAY.transfer, "transfer", "q2", T0 + 1000), GE, [2, 5], meta(W5)); return s[W5.id].retrieval.due === T0 + 1000 + 2 * D; })());
console.log("   deterministic next recommendation");
const R = {};
ok("E · Unspoken → speak the guided mission", (() => { const r = ME.recommend(ME.blank(W5.id), W5, T0); return r.action === "speak" && r.missionId === "explain-tech-guided" && r.reason === "not_spoken_yet"; })());
ME.introduce(R, W5.id, GE, T0); ME.addAttempt(R, W5.id, mk(W5, G5, SAY.noImpact, "guided", "s1", T0), GE, IV, meta(W5));
ok("E · Weak → retry the same mission on the missing move", (() => { const r = ME.recommend(R[W5.id], W5, T0); return r.action === "retry" && r.move === "impact" && r.reason === "weak_move"; })());
ME.addAttempt(R, W5.id, mk(W5, G5, SAY.strong, "retry", "s2", T0 + 1), GE, IV, meta(W5));
ok("E · Demonstrated → take the transfer", (() => { const r = ME.recommend(R[W5.id], W5, T0 + 1); return r.action === "transfer" && r.missionId === "explain-tech-transfer"; })());
ME.addAttempt(R, W5.id, mk(W5, T5, SAY.transfer, "transfer", "s3", T0 + 2), GE, IV, meta(W5));
ok("E · Transfer-ready and not yet due → rest with the date; once due → a retrieval on the transfer mission",
  ME.recommend(R[W5.id], W5, T0 + 3).action === "rest" && ME.recommend(R[W5.id], W5, R[W5.id].retrieval.due + 1).action === "retrieval" && ME.recommend(R[W5.id], W5, R[W5.id].retrieval.due + 1).missionId === "explain-tech-transfer");
ok("E · Pending coaching outranks everything", (() => { const s = JSON.parse(JSON.stringify(R)); s[W5.id].attempts[0].coachPending = true; return ME.recommend(s[W5.id], W5, T0).action === "coach"; })());

/* ═══════════ F · CROSS-COMPETENCY ═══════════════════════════════════════ */
console.log("\nF · CROSS-COMPETENCY");
const comps = PACK.competencies;
const pick = s => ME.pickNext(comps, id => s[id], Date.now());
const put = (s, c, m, txt, kind, key, at) => { ME.introduce(s, c.id, GE); return ME.addAttempt(s, c.id, mk(c, m, txt, kind, key, at), GE, IV, meta(c)); };
const show = p => p ? `${p.comp.id}:${p.rec.action}:${p.rec.move || "-"}` : "null";
const rest = (s, c, g, t, gs, ts, k) => { put(s, c, g, gs, "guided", k + "g"); put(s, c, t, ts, "transfer", k + "t"); };
const rest1to4 = (s, k) => { rest(s, W1, G1, T1, SAY.w1strong, SAY.w1transfer, k + "1"); rest(s, W2, G2, T2, SAY.w2strong, SAY.w2transfer, k + "2"); rest(s, W3, G3, T3, SAY.w3strong, SAY.w3transfer, k + "3"); rest(s, W4, G4, T4, SAY.w4strong, SAY.w4transfer, k + "4"); };
ok("F · A fresh learner is offered Week 1 — Week 5 is not pushed forward by being newest", show(pick({})) === "explain-work:speak:-", show(pick({})));
let B = {}; rest1to4(B, "b");
ok("F · With Weeks 1–4 resting, Week 5 is offered to speak — a competency nobody has spoken for is never skipped", show(pick(B)) === "explain-tech:speak:-", show(pick(B)));
rest(B, W5, G5, T5, SAY.strong, SAY.transfer, "b5");
/* V2.6: every competency after Week 5, in week order — offered when everything
   before it rests, and only when the last one rests too is nothing pushed. */
const LATER = PACK.competencies.filter(c => c.week > 5).sort((a, b) => a.week - b.week);
ok("F · Every competency after Week 5 has a cold-transfer fixture in this suite", LATER.every(c => typeof SAY.transfers[c.id] === "string"), LATER.map(c => c.id).join());
LATER.forEach(c => {
  ok(`F · With everything before it resting, ${c.id} (Week ${c.week}) is offered to speak — it is not skipped`, show(pick(B)) === `${c.id}:speak:-`, show(pick(B)));
  const g = c.missions.find(m => m.kind === "guided"), t = c.missions.find(m => m.kind === "transfer");
  rest(B, c, g, t, g.hear.model, SAY.transfers[c.id], "b" + c.week);
});
ok("F · With every competency resting, nothing is pushed and the old advice stands", pick(B) === null, show(pick(B)));
let C = {}; put(C, W1, G1, SAY.w1strong, "guided", "c1"); put(C, W5, G5, SAY.noCheck, "guided", "c2");
ok("F · A Week 5 weak move outranks a Week 1 pending transfer — evidence priority, not week order", show(pick(C)) === "explain-tech:retry:check", show(pick(C)));
let Dd = {}; put(Dd, W1, G1, SAY.w1noWhy, "guided", "d1"); put(Dd, W5, G5, SAY.noCheck, "guided", "d2");
ok("F · Two equally urgent retries → the earlier week, deterministically, and only as a tie-break", show(pick(Dd)) === "explain-work:retry:why" && show(pick(Dd)) === show(pick(Dd)), show(pick(Dd)));
let E = {}; put(E, W4, G4, SAY.w4strong, "guided", "e1"); put(E, W5, G5, SAY.noPlain, "guided", "e2");
ok("F · Week 5 weak vs Week 4 ready for transfer → Week 5's retry", show(pick(E)) === "explain-tech:retry:plain", show(pick(E)));
let Fx = {}; rest1to4(Fx, "f"); put(Fx, W5, G5, SAY.noFrame, "guided", "f5");
ok("F · A learner with different evidence gets a different next mission: Weeks 1–4 resting and Week 5 weak → Week 5 retry on 'frame'", show(pick(Fx)) === "explain-tech:retry:frame", show(pick(Fx)));
ok("F · Pending coaching on Week 5 outranks a Week 1 retry",
  (() => { const s = {}; put(s, W1, G1, SAY.w1noWhy, "guided", "i1"); const r = put(s, W5, G5, SAY.noFrame, "guided", "i2"); r.attempt.coachPending = true; return show(pick(s)) === "explain-tech:coach:frame"; })());
ok("F · One record per competency, keyed by competency id — never by week", (() => { const s = {}; PACK.competencies.forEach((c, i) => put(s, c, c.missions[0], "x", "guided", "k" + i)); return Object.keys(s).sort().join() === PACK.competencies.map(c => c.id).sort().join() && Object.keys(s).length === PACK.competencies.length; })());

/* ═══════════ G · MEMORY ═════════════════════════════════════════════════ */
console.log("\nG · MEMORY");
const row = ME.contract(mk(W5, G5, SAY.noCheck, "guided", "k1"), meta(W5));
ok("G · Successful and unsuccessful evidence alike is written as the same v1 contract: versioned, track-stamped, week 5, competency, mission, kind, key",
  row.v === ME.EVIDENCE_VERSION && row.tk === GE && row.week === 5 && row.competency === "explain-tech" && row.missionId === "explain-tech-guided" && row.kind === "guided" && row.key === "k1");
ok("G · Its moves map holds exactly the four Week 5 ids, as booleans", Object.keys(row.moves).join() === MOVES && Object.values(row.moves).every(v => typeof v === "boolean") && row.moves.check === false);
ok("G · Task, clarity, fluency and vocabulary are measured numbers in [0,1]; pronunciation is null — never zero — with no audio grader",
  [row.task, row.clarity, row.fluency, row.vocab].every(x => typeof x === "number" && x >= 0 && x <= 1) && row.pron === null && row.pronSource === null);
ok("G · With no duration, seconds and wpm are null, not 0", (() => { const r = ME.contract(Object.assign(ME.grade(W5, G5, SAY.strong, {}), { key: "k3", kind: "guided" }), meta(W5)); return r.seconds === null && r.wpm === null; })());
ok("G · Vocabulary used lists only the competency's own expressions, and the model uses four of them", gm.vocabUsed.every(w => W5.expressions.some(e => e.w === w)) && gm.vocabUsed.length === 4);
ok("G · The same key twice in Week 5 is one row, reported as a duplicate", (() => { const s = {}; put(s, W5, G5, SAY.strong, "guided", "dup"); return put(s, W5, G5, SAY.strong, "guided", "dup").duplicate && s[W5.id].attempts.length === 1; })());
ok("G · The same key in Week 5 and Week 4 is two rows, one each — idempotency is per competency",
  (() => { const s = {}; put(s, W4, G4, SAY.w4strong, "guided", "same"); const r = put(s, W5, G5, SAY.strong, "guided", "same"); return !r.duplicate && s[W4.id].attempts.length === 1 && s[W5.id].attempts.length === 1; })());
ok("G · Weak evidence stays retrievable: a weak Week 5 record is due now, for practice, with its weakness kept",
  (() => { const s = {}; const r = put(s, W5, G5, SAY.noImpact, "guided", "w1"); s[W5.id].weakness = ME.weakestMove(W5, r.attempt, s[W5.id].attempts);
    return s[W5.id].retrieval.reason === "practice" && s[W5.id].retrieval.due <= Date.now() && s[W5.id].weakness === "impact" && ME.recommend(s[W5.id], W5).move === "impact"; })());
ok("G · Week 5 attempts are bounded at 60", (() => { const s = {}; for (let i = 0; i < 70; i++) put(s, W5, G5, SAY.strong, "guided", "b" + i, T0 + i); return s[W5.id].attempts.length === 60; })());
ok("G · A Week 5 attempt changes none of the other four records",
  (() => { const s = {}; put(s, W1, G1, SAY.w1noWhy, "guided", "m1"); put(s, W2, G2, SAY.w2strong, "guided", "m2"); put(s, W3, G3, SAY.w3strong, "guided", "m3"); put(s, W4, G4, SAY.w4strong, "guided", "m4");
    const before = JSON.stringify([s[W1.id], s[W2.id], s[W3.id], s[W4.id]]); put(s, W5, G5, SAY.noCheck, "guided", "m5"); return JSON.stringify([s[W1.id], s[W2.id], s[W3.id], s[W4.id]]) === before && s[W5.id].state === "PRACTICING"; })());
ok("G · The progress summary carries Week 5, its state, four per-move counts, null pronunciation and no Shadow support",
  (() => { const ps = ME.progressSummary(L5[W5.id], W5); return ps.competency === "explain-tech" && ps.week === 5 && ps.state === "STRONG" && ps.byMove.map(m => m.id).join() === MOVES && ps.byMove.every(m => m.of === 6) && ps.pron === null && ps.shadow.total === 0 && ps.transferPassed === 3; })());

/* ═══════════ H · AI CONTEXT ═════════════════════════════════════════════ */
console.log("\nH · AI COACH");
const st5 = {}; put(st5, W4, G4, SAY.w4strong, "guided", "h0"); put(st5, W5, G5, SAY.noCheck, "guided", "h1");
const ctx = ME.aiContext(st5[W5.id], W5, G5, { weakness: "check" });
const ctxJson = JSON.stringify(ctx);
ok("H · The context carries competency explain-tech, the task, the pattern, four moves with hints, the weakness, evidence counts and one attempt summary",
  ctx.track === GE && ctx.competency === "explain-tech" && ctx.mission === "explain-tech-guided" && ctx.prompt === G5.prompt && ctx.pattern === W5.pattern
  && ctx.targetMoves.length === 4 && ctx.targetMoves.every(m => m.id && m.label && m.hint) && ctx.currentWeakness === "check"
  && ctx.recentEvidence.attempts === 1 && ctx.previousAttemptSummary && ctx.previousAttemptSummary.moves.check === false);
ok("H · Relevant memory is in: the last attempt's moves and length; the transcript is not", ctx.previousAttemptSummary.words > 8 && !("said" in ctx.previousAttemptSummary) && !ctxJson.includes(SAY.noCheck.slice(0, 30)));
ok("H · Unrelated history is not dumped in: no attempt list, no profile, no state machine, nothing from Week 4 or any other competency",
  !ctxJson.includes("\"attempts\":[") && !/profile|streak|\"name\"/i.test(ctxJson) && !("state" in ctx) && !/clarify-confirm|explain-work|clear-update|raise-problem|restate|mitigate/.test(ctxJson));
const prompt = ME.coachPrompt(ctx, "SPOKEN RULE");
ok("H · The prompt names four moves with Week 5's labels, its shape, and the existing {reply, covered} route — and tells the model it is a coach, never a colleague",
  /makes 4 communication/.test(prompt) && /check \(Land the takeaway\)/.test(prompt) && /frame \(Frame it simply\)/.test(prompt) && prompt.includes(W5.pattern) && /"covered"/.test(prompt) && /"reply"/.test(prompt) && /speaking coach/i.test(prompt) && prompt.includes("SPOKEN RULE"));
const evAI = mk(W5, G5, SAY.noCheck, "guided", "ai1"); ME.applyCoachMoves(evAI, W5, ["check"]);
ok("H · The model MAY add the takeaway it heard in the learner's own words", evAI.moves.check === true && evAI.coverage === 1 && evAI.assisted === true);
const evKeep = mk(W5, G5, SAY.strong, "guided", "ai2"); ME.applyCoachMoves(evKeep, W5, []);
ok("H · The model CANNOT remove a move the learner made", evKeep.coverage === 1);
const evJunk = mk(W5, G5, SAY.noCheck, "guided", "ai3"); ME.applyCoachMoves(evJunk, W5, ["confirm", "issue", "__proto__", "state", "passed", 42, null]);
ok("H · Other competencies' move ids and non-moves are dropped on the floor", evJunk.moves.check === false && Object.keys(evJunk.moves).join() === MOVES && !("state" in evJunk.moves));
const shaped = ME.shapeCoach({ reply: "y".repeat(500), covered: ["check"], state: "STRONG", score: 100, passed: true }, W5, evAI);
ok("H · Model output is capped, tagged as AI, and carries no state or score into the app", shaped.improve.length <= 240 && shaped.ai === true && !("state" in shaped) && !("score" in shaped) && !("passed" in shaped));

/* ═══════════ J (engine half) · WELDING WALL ═════════════════════════════ */
console.log("\nJ · WELDING WALL (engine)");
ok("J · The engine refuses a Week 5 write for any area but General English — and does not create a record",
  (() => { const s = {}; return ME.addAttempt(s, W5.id, mk(W5, G5, SAY.strong, "guided", "w"), "welding", IV, meta(W5)) === null && ME.introduce(s, W5.id, "welding") === null
    && ME.addSupport(s, W5.id, { key: "x", at: 1 }, "welding") === null && Object.keys(s).length === 0; })());
ok("J · guard() accepts only the pack's own track constant", ME.guard(GE) === true && ME.guard("welding") === false && ME.TRACK === GE);

/* ═══════════ BROWSER ════════════════════════════════════════════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8091, 8092, 8093, 8094, 8095]) {
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
    if (b.assess) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ overall: 81, mode: "ai", words: [{ word: "a", score: 81 }] }) });
    if (b.chat) lastSystem = String(b.chat.system || "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "End with the one sentence she should remember, then ask if it makes sense.", covered: coachCovered }) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?w5=" + Date.now(), { waitUntil: "load" });
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
const rec5 = (page, id) => page.evaluate(i => JSON.parse(JSON.stringify(mvStore()[i] || {})), id);
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: innerWidth }));
const shot = async (page, name) => { if (SHOTS) { try { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); } catch (e) {} } };
/* Put Weeks 1–4 to rest inside the page, through the engine, so the only
   question left for Home is whether Week 5 is offered when — and only when —
   it is the next best mission. */
const restWeeks1to4 = page => page.evaluate(({ SAY }) => {
  const P = mvPack(), st = mvStore(), IV = trackVocabularyIntervals();
  const meta = c => ({ competency: c.id, week: c.week, moveIds: MissionEngine.moveIds(c) });
  const one = (cid, mid, text, kind, key) => { const c = MissionEngine.competencyOf(P, cid), m = MissionEngine.missionOf(c, mid);
    MissionEngine.introduce(st, cid, areaId()); const ev = Object.assign(MissionEngine.grade(c, m, text, { seconds: 27 }), { key, kind, missionId: mid, at: Date.now() - 60000 });
    MissionEngine.addAttempt(st, cid, ev, areaId(), IV, meta(c)); };
  one("explain-work", "explain-work-guided", SAY.w1strong, "guided", "z1"); one("explain-work", "explain-work-transfer", SAY.w1transfer, "transfer", "z2");
  one("clear-update", "clear-update-guided", SAY.w2strong, "guided", "z3"); one("clear-update", "clear-update-transfer", SAY.w2transfer, "transfer", "z4");
  one("raise-problem", "raise-problem-guided", SAY.w3strong, "guided", "z5"); one("raise-problem", "raise-problem-transfer", SAY.w3transfer, "transfer", "z6");
  one("clarify-confirm", "clarify-confirm-guided", SAY.w4strong, "guided", "z7"); one("clarify-confirm", "clarify-confirm-transfer", SAY.w4transfer, "transfer", "z8");
  save();
  return ["explain-work", "clear-update", "raise-problem", "clarify-confirm"].map(id => st[id].state).join();
}, { SAY });

console.log("\nK · HOME / TODAY");
const L = await learner("ge", GE);
const home0 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, today: document.querySelectorAll(".today-card").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText }; });
ok("K1 · A fresh learner's Home offers ONE V2 card and it is Week 1 — Week 5 does not appear prematurely",
  home0.n === 1 && home0.today <= 1 && /Week 1/i.test(home0.eyebrow || "") && /Explain what you do/i.test(home0.title || ""), JSON.stringify(home0));
const rested = await restWeeks1to4(L.page);
ok("K2 · Weeks 1–4 are transfer-ready in this learner's store (seeded through the engine, not by hand)", rested === "TRANSFER_READY,TRANSFER_READY,TRANSFER_READY,TRANSFER_READY", rested);
const home1 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText, chip: c && c.querySelector(".chip").innerText, btn: c && c.querySelector("button").innerText, line: c && c.querySelector("p").innerText }; });
ok("K3 · Now Home's one card is Week 5, 'Not started', with 'Start the mission' — chosen by the engine's own priority, nothing hardcoded",
  home1.n === 1 && /Week 5/i.test(home1.eyebrow || "") && /Explaining technical work/i.test(home1.title || "") && /not started/i.test(home1.chip || "") && /start the mission/i.test(home1.btn || "") && /say it out loud once/i.test(home1.line || ""), JSON.stringify(home1));
const ovh = await overflow(L.page); ok("K3 · Home has no horizontal overflow at 390px with the Week 5 card and its long title", ovh.sw <= ovh.cw, JSON.stringify(ovh));
await shot(L.page, "390-home-week5");
const coachRec = await L.page.evaluate(() => ({ a: AdaptiveLearningEngine.recommendation(S, ProfessionalTrackContext.active()), m: LearningCoach.mission(S, ProfessionalTrackContext.active()) }));
ok("K4 · The Adaptive engine and the LearningCoach both surface Week 5 through the existing hooks", coachRec.a.v2 === true && /Explaining technical work/i.test(coachRec.a.title) && coachRec.m.v2 === true && coachRec.m.arg1 === "explain-tech-guided" && coachRec.m.go === "mission", JSON.stringify({ t: coachRec.a.title, arg: coachRec.m.arg1 }));
const opened = await L.page.evaluate(async () => { LearningCoach.openMission(); await new Promise(r => setTimeout(r, 400)); return { v: cur.v, comp: _mv && _mv.compId, mission: _mv && _mv.missionId }; });
ok("K5 · LearningCoach.openMission() lands on the Week 5 mission", opened.v === "mission" && opened.comp === "explain-tech" && opened.mission === "explain-tech-guided", JSON.stringify(opened));

/* SEE → HEAR → NOTICE for Week 5 */
console.log("\nTHE LOOP · SEE → HEAR → NOTICE");
await L.page.evaluate(() => mvGo("explain-tech-guided", "see")); await sleep(350);
const see = await L.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), state: (mvStore()["explain-tech"] || {}).state, cta: document.querySelectorAll("#v-mission .mv-cta").length, back: !!document.querySelector("#v-mission > .mv-back") }));
ok("SEE renders Week 5's title, the finance director's question and the goal, with one action and a way back — and is worth INTRODUCED only",
  /Explaining technical work/i.test(see.txt) && /data quality checks/i.test(see.txt) && /Keep it simple/i.test(see.txt) && /Step 1 of 7/i.test(see.txt) && see.cta === 1 && see.back && see.state === "INTRODUCED", see.txt.slice(0, 160));
const ovs = await overflow(L.page); ok("SEE has no horizontal overflow at 390px", ovs.sw <= ovs.cw, JSON.stringify(ovs));
await shot(L.page, "390-see");
await L.page.evaluate(() => mvStep("hear")); await sleep(300);
const hear = await L.page.evaluate(() => { const vis = () => /compares the new figures/i.test(document.getElementById("v-mission").innerText);
  const hidden = !vis(), play = document.querySelectorAll(".mv-play button").length, reveal = !!document.querySelector(".mv-reveal");
  document.querySelector(".mv-reveal").click();
  return { hidden, play, reveal, shownAfter: vis(), heard: (window.__ev || []).some(e => e[0] === "v2_mission_heard"), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("HEAR is voice-first: two play buttons, Week 5's model hidden until 'Show the words', the heard event logged, no overflow",
  hear.hidden && hear.play === 2 && hear.reveal && hear.shownAfter && hear.heard && hear.sw <= hear.cw, JSON.stringify(hear));
await shot(L.page, "390-hear");
await L.page.evaluate(() => mvStep("notice")); await sleep(350);
const notice = await L.page.evaluate(() => ({
  moves: [...document.querySelectorAll(".mv-list li b")].map(b => b.innerText),
  eyebrow: (document.querySelector(".mv-notice .eyebrow") || {}).innerText, sub: (document.querySelector(".mv-notice .sub") || {}).innerText,
  shadow: !!document.querySelector(".mv-shadow"), cta: document.querySelectorAll("#v-mission .mv-cta").length }));
ok("NOTICE renders the four Week 5 moves by label, says '4 moves', and — with no clip linked — shows NO Shadow row",
  notice.moves.join() === "Frame it simply,Explain it plainly,Say what it means for them,Land the takeaway" && /4 moves/i.test(notice.eyebrow + " " + notice.sub) && notice.shadow === false && notice.cta === 1, JSON.stringify(notice));
const ovn = await overflow(L.page); ok("NOTICE has no horizontal overflow at 390px", ovn.sw <= ovn.cw, JSON.stringify(ovn));
await shot(L.page, "390-notice");
const noType = await L.page.evaluate(() => ({ ta: document.querySelectorAll("#v-mission textarea").length, inp: document.querySelectorAll("#v-mission input[type=text]").length, sc: document.querySelectorAll("#v-mission .score-b").length }));
ok("Week 5 is voice-first — no script box, no text input, no self-score", noType.ta === 0 && noType.inp === 0 && noType.sc === 0, JSON.stringify(noType));

/* ── SPEAK → COACH (weak) ── */
console.log("\nSPEAK → COACH");
await L.page.evaluate(() => mvStep("speak")); await sleep(250);
const spk = await L.page.evaluate(() => ({ btn: document.querySelectorAll("#v-mission .rec-btn").length, prompt: (document.querySelector(".mv-q") || {}).innerText, ctx: (document.querySelector(".mv-ctx") || {}).innerText, state: (document.getElementById("recState") || {}).innerText }));
ok("SPEAK shows the question, the technical facts as context (compare, flag, waits a day) and one recorder in its idle state",
  spk.btn === 1 && /Keep it simple/i.test(spk.prompt || "") && /compare/i.test(spk.ctx || "") && /waits a day/i.test(spk.ctx || "") && /record your answer/i.test(spk.state || ""), JSON.stringify(spk).slice(0, 200));
await shot(L.page, "390-speak");
coachCovered = ["frame", "plain", "impact"];
await L.page.evaluate(t => { window.__say = t; }, SAY.noCheck);
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
ok("B1 · the missing takeaway is identified from what was said; four chips render, one off",
  b1.moves.check === false && b1.cov === 0.75 && b1.move === "check" && b1.chips === 4 && b1.off === 1 && b1.step === "coach", JSON.stringify({ c: b1.cov, m: b1.move, chips: b1.chips, off: b1.off }));
ok("B2 · three of four does not advance the learner", (await rec5(L.page, "explain-tech")).state === "PRACTICING");
ok("B3 · the coach's system prompt carried Week 5's four moves — not Week 4's confirm, Week 3's ask or Week 2's status",
  /makes 4 communication/.test(lastSystem) && /check \(Land the takeaway\)/.test(lastSystem) && !/confirm \(/.test(lastSystem) && !/ask \(What I need\)/.test(lastSystem) && !/status \(/.test(lastSystem), lastSystem.slice(0, 90));
ok("B4 · the coaching shown is the model's and is tagged as such", b1.ai === true && /one sentence/i.test(b1.improve || ""));
const ovc = await overflow(L.page); ok("COACH has no horizontal overflow at 390px", ovc.sw <= ovc.cw, JSON.stringify(ovc));
await shot(L.page, "390-coach");

/* ── RETRY ── */
console.log("\nRETRY");
const retry = await L.page.evaluate(() => { mvRetry(); return { text: _mv.retryText, step: _mv.step, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText }; });
ok("C1 · the retry names the Week 5 move that was missed, in the pack's own words, on the retry step", /one thing they need to remember/i.test(retry.text || "") && retry.step === "speak" && /one more time/i.test(retry.eyebrow || ""), JSON.stringify(retry));
await shot(L.page, "390-retry");
coachCovered = ["frame", "plain", "impact", "check"];
await speak(L.page, SAY.strong);
const c2 = await rec5(L.page, "explain-tech");
ok("C2 · the retry is stored as a retry; both attempts are preserved", c2.attempts.length === 2 && c2.attempts[0].coverage === 0.75 && c2.attempts[1].kind === "retry" && c2.attempts[1].coverage === 1);
ok("C3 · progression recalculates to DEMONSTRATED", c2.state === "DEMONSTRATED", c2.state);
const transferBtn = await L.page.evaluate(() => [...document.querySelectorAll(".mv-acts button")].map(b => b.innerText).join("|"));
ok("C4 · once demonstrated, the coach screen offers the new situation", /take the new situation/i.test(transferBtn), transferBtn);

/* ── TRANSFER ── */
console.log("\nTRANSFER");
await L.page.evaluate(() => mvGo("explain-tech-transfer", "speak")); await sleep(300);
const tp = await L.page.evaluate(() => ({ q: (document.querySelector(".mv-q") || {}).innerText, comp: _mv.compId, kind: _mv.kind, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText, instr: (document.querySelector(".mv-instruction") || {}).innerText, ctx: (document.querySelector(".mv-ctx") || {}).innerText }));
ok("D1 · the transfer is a different situation, still Week 5, framed as the new situation with the cold goal and its own facts",
  /the integration actually does/i.test(tp.q || "") && tp.comp === "explain-tech" && tp.kind === "transfer" && /new situation/i.test(tp.eyebrow || "") && /nobody is prompting you/i.test(tp.instr || "") && /returns/i.test(tp.ctx || ""), JSON.stringify(tp).slice(0, 200));
await shot(L.page, "390-transfer");
await speak(L.page, SAY.transfer);
const d2 = await rec5(L.page, "explain-tech");
ok("D2 · transfer evidence is stored as its own kind, separate from practice", d2.attempts.length === 3 && d2.attempts[2].kind === "transfer" && d2.attempts[2].transfer === true);
ok("D3 · one cold success is TRANSFER_READY, not STRONG", d2.state === "TRANSFER_READY" && d2.transfer.passed === 1, d2.state);
ok("D4 · a retrieval is scheduled from the track's own intervals", d2.retrieval && d2.retrieval.reason === "retrieval" && d2.retrieval.due > Date.now());
await L.page.evaluate(() => mvStep("done")); await sleep(300);
const done = await L.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), bars: document.querySelectorAll(".mv-bars > *").length, chips: document.querySelectorAll(".mv-move").length, shadowNote: !!document.querySelector(".mv-shadow-note") }));
ok("D5 · the evidence screen shows the state, four chips and the dimension bars — pronunciation as a number here because the (mocked) audio grader measured it — and no Shadow line",
  /transfer ready/i.test(done.txt) && done.bars >= 5 && done.chips === 4 && /81%/.test(done.txt) && done.shadowNote === false, done.txt.slice(0, 160));
const ovd = await overflow(L.page); ok("Evidence screen has no horizontal overflow at 390px", ovd.sw <= ovd.cw, JSON.stringify(ovd));
await shot(L.page, "390-evidence");

/* ── K · PROGRESS ── */
console.log("\nK · PROGRESS");
const prog = await L.page.evaluate(() => { go("review"); const ps = [...document.querySelectorAll(".pg-v2")]; const d = window.v2Evidence();
  return { panels: ps.length, txt: ps.map(p => p.innerText.replace(/\s+/g, " ")).join(" || "), comps: d.map(x => x.competency + ":" + x.state), weeks: d.map(x => x.week).join(), moves: d.map(x => (x.byMove || []).length).join(), last: d[d.length - 1] }; });
ok("K6 · Progress renders five competencies oldest week first, 1 → 5, with move counts 5 / 4 / 5 / 4 / 4 — ordering comes from the data",
  prog.panels === 5 && prog.weeks === "1,2,3,4,5" && prog.moves === "5,4,5,4,4" && prog.comps[4] === "explain-tech:TRANSFER_READY", JSON.stringify({ p: prog.panels, w: prog.weeks, m: prog.moves, c: prog.comps }));
ok("K7 · The Week 5 panel names its week, its state and its own moves through the same evidence contract",
  /Week 5/.test(prog.txt) && /Land the takeaway/.test(prog.txt) && /Frame it simply/.test(prog.txt) && prog.last.week === 5 && prog.last.attempts === 3 && prog.last.passed === 2 && prog.last.transferPassed === 1 && prog.last.pron === 81 && prog.last.pronSource === "audio", JSON.stringify({ w: prog.last.week, a: prog.last.attempts, p: prog.last.passed }));
const ovp = await overflow(L.page); ok("Progress has no horizontal overflow at 390px with five panels", ovp.sw <= ovp.cw, JSON.stringify(ovp));
await shot(L.page, "390-progress");
/* V2.6: each later competency in turn — offered on Home, rested through the
   engine — until the last one rests and Home is silent. Walks the pack. */
for (const c of LATER) {
  const step = await L.page.evaluate(({ id, transfer }) => {
    go("home"); const before = document.querySelector(".mv-home");
    const offered = before ? before.querySelector(".eyebrow").innerText : "";
    const comp = mvComp(id), st = mvStore(), IV = trackVocabularyIntervals();
    const meta = { competency: comp.id, week: comp.week, moveIds: MissionEngine.moveIds(comp) };
    const one = (m, text, kind, key) => { MissionEngine.introduce(st, comp.id, areaId()); const ev = Object.assign(MissionEngine.grade(comp, m, text, { seconds: 27 }), { key, kind, missionId: m.id, at: Date.now() - 60000 }); MissionEngine.addAttempt(st, comp.id, ev, areaId(), IV, meta); };
    const g = comp.missions.find(m => m.kind === "guided"), t = comp.missions.find(m => m.kind === "transfer");
    one(g, g.hear.model, "guided", "zg" + comp.week); one(t, transfer, "transfer", "zt" + comp.week);
    save(); go("home"); return { offered, state: st[comp.id].state };
  }, { id: c.id, transfer: SAY.transfers[c.id] });
  ok(`K8 · With everything before it resting, Home's one card is ${c.id} (Week ${c.week}); resting it makes it transfer-ready`, new RegExp("Week " + c.week, "i").test(step.offered) && step.state === "TRANSFER_READY", JSON.stringify(step));
}
const afterAll = await L.page.evaluate(() => { go("home"); return { n: document.querySelectorAll(".mv-home").length, card: !!document.querySelector(".mv-home") }; });
ok("K8 · With every competency resting, Home shows no V2 card and looks as it did before V2 — the old advice stands", afterAll.n === 0 && afterAll.card === false, JSON.stringify(afterAll));
const voc = await L.page.evaluate(() => Object.entries(areaVocab()).filter(([, v]) => v.src && v.src.v2 === "explain-tech").map(([w]) => w));
ok("K9 · Week 5 expressions were acquired automatically, tagged to Week 5", voc.length > 0 && voc.every(w => W5.expressions.some(e => e.w === w)), JSON.stringify(voc));

/* ── I · ANALYTICS ── */
console.log("\nI · ANALYTICS");
const ev = await L.page.evaluate(() => (window.__ev || []).filter(e => e[0].startsWith("v2_") && e[1].competency === "explain-tech").map(e => [e[0], e[1].track, e[1].week, e[1].competency, e[1].mission]));
ok("I1 · every Week 5 analytics event carries track general-english, week '5' and competency explain-tech",
  ev.length >= 10 && ev.every(e => e[1] === GE && e[2] === "5" && e[3] === "explain-tech"), JSON.stringify(ev.slice(0, 4)));
const evNames = [...new Set(ev.map(e => e[0]))];
const ALL11 = ["v2_mission_started", "v2_mission_heard", "v2_speak_attempt", "v2_coach_generated", "v2_evidence_recorded", "v2_retry_attempt", "v2_transfer_started", "v2_transfer_completed", "v2_competency_progressed", "v2_retrieval_scheduled", "v2_recommendation_generated"];
ok("I2 · the loop emitted all eleven existing v2_* names for Week 5 and nothing else", ALL11.every(n => evNames.includes(n)) && evNames.every(n => ALL11.includes(n)), evNames.join());
const evProps = await L.page.evaluate(() => (window.__ev || []).filter(e => e[0].startsWith("v2_")).map(e => e[1]));
ok("I3 · every prop key is one the Worker's v2 column map already carries (track, week, competency, mission, kind, move, result, band, state, from, attempt, ai)",
  evProps.every(p => Object.keys(p).every(k => ["track", "week", "competency", "mission", "kind", "move", "result", "band", "state", "from", "attempt", "ai"].includes(k))));
ok("I4 · the move and mission values are Week 5's own enums, and a progression carries from/state", evProps.filter(p => p.competency === "explain-tech").every(p => (!p.move || ["frame", "plain", "impact", "check", "none"].includes(p.move)) && (!p.mission || /^explain-tech-(guided|transfer)$/.test(p.mission) || p.mission === "shadow")) && evProps.some(p => p.state === "TRANSFER_READY" && p.from === "DEMONSTRATED"));
const pii = JSON.stringify(evProps);
ok("I5 · no event carries a transcript, the profile name or the goal", !/finance director|warehouse|data quality|\"T\"|confidence in meetings/i.test(pii));
const nonV2 = await L.page.evaluate(() => (window.__ev || []).map(e => e[0]).filter(n => !n.startsWith("v2_")));
ok("I6 · the mission emitted no V1 session_complete and no Welding event", !nonV2.includes("session_complete") && !nonV2.some(n => /workshop|weld/.test(n)), nonV2.join());

/* ── CLOUD MERGE ── */
console.log("\nG · CLOUD MERGE (app)");
const merged = await L.page.evaluate(({ SAY }) => {
  const c = mvComp("explain-tech"), g = MissionEngine.missionOf(c, "explain-tech-guided");
  const meta = { competency: c.id, week: c.week, moveIds: MissionEngine.moveIds(c) };
  const att = (key, text, at) => Object.assign(MissionEngine.grade(c, g, text, { seconds: 20 }), { key, kind: "guided", missionId: g.id, at });
  const local = JSON.parse(JSON.stringify(S)), cloud = JSON.parse(JSON.stringify(S));
  local.v2A = { "general-english": {} }; cloud.v2A = { "general-english": {} };
  const IV = trackVocabularyIntervals();
  MissionEngine.introduce(local.v2A["general-english"], c.id, areaId(), 1e12);
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("a", SAY.noCheck, 1e12 + 1), areaId(), IV, meta);
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.introduce(cloud.v2A["general-english"], c.id, areaId(), 1e12 + 5);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("c", SAY.noFrame, 1e12 + 3), areaId(), IV, meta);
  const m = fbMerge(local, cloud); const r = m.v2A["general-english"]["explain-tech"];
  const pr = fbSyncPayload(m).v2A["general-english"]["explain-tech"];
  return { keys: r.attempts.map(a => a.key).join(), state: r.state, introducedAt: r.introducedAt, saidLocal: r.attempts.every(a => typeof a.said === "string" && a.said.length > 0), saidCloud: pr.attempts.every(a => !("said" in a)), weeks: r.attempts.every(a => a.week === 5 && a.competency === "explain-tech"), buckets: Object.keys(m.v2A).join() };
}, { SAY });
ok("G · Two devices' Week 5 attempts union on the idempotency key (a, b, c — b once); state is recomputed; introducedAt is the earliest",
  merged.keys === "a,b,c" && merged.state === "DEMONSTRATED" && merged.introducedAt === 1e12, JSON.stringify(merged));
ok("G · The learner's words stay on the device and are stripped from the sync payload; every row is week 5 / explain-tech; no Welding bucket", merged.saidLocal && merged.saidCloud && merged.weeks && merged.buckets === "general-english");

/* ── DESKTOP ── */
console.log("\nUI · DESKTOP");
const Dk = await learner("desk", GE, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
await restWeeks1to4(Dk.page);
const dkHome = await Dk.page.evaluate(async () => { go("home"); await new Promise(r => setTimeout(r, 300)); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, o: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth } }; });
ok("Desktop: Home offers the Week 5 card with no horizontal overflow", dkHome.n === 1 && /Week 5/i.test(dkHome.eyebrow || "") && dkHome.o.sw <= dkHome.o.cw, JSON.stringify(dkHome));
await shot(Dk.page, "1280-home");
const dk = await Dk.page.evaluate(async () => {
  const o = () => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth });
  mvGo("explain-tech-guided", "see"); await new Promise(r => setTimeout(r, 300)); const o0 = o();
  mvStep("hear"); await new Promise(r => setTimeout(r, 300)); const oh = o(), play = document.querySelectorAll(".mv-play button").length;
  mvStep("notice"); await new Promise(r => setTimeout(r, 400)); const o1 = o(), moves = document.querySelectorAll(".mv-list li").length;
  mvStep("speak"); await new Promise(r => setTimeout(r, 300)); const o2 = o(), cta = document.querySelectorAll("#v-mission .rec-btn").length;
  return { o0, oh, play, o1, o2, moves, cta }; });
ok("Desktop: SEE, HEAR (two play buttons), NOTICE (four moves) and SPEAK (one recorder) render with no horizontal overflow",
  dk.play === 2 && dk.moves === 4 && dk.cta === 1 && [dk.o0, dk.oh, dk.o1, dk.o2].every(x => x.sw <= x.cw), JSON.stringify(dk));
await shot(Dk.page, "1280-speak");
coachCovered = ["frame", "plain", "impact"];
await L.page.evaluate(() => {}); /* keep the mobile context alive; the desktop learner speaks next */
await Dk.page.evaluate(t => { window.__say = t; }, SAY.noCheck);
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
ok("Desktop: COACH renders four chips (one off) and its actions with no overflow", dkCoach.step === "coach" && dkCoach.chips === 4 && dkCoach.off === 1 && dkCoach.acts >= 2 && dkCoach.sw <= dkCoach.cw, JSON.stringify(dkCoach));
await shot(Dk.page, "1280-coach");
const dkRetry = await Dk.page.evaluate(() => { mvRetry(); return { step: _mv.step, text: _mv.retryText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("Desktop: RETRY names the missing move with no overflow", dkRetry.step === "speak" && /one thing they need to remember/i.test(dkRetry.text || "") && dkRetry.sw <= dkRetry.cw);
coachCovered = ["frame", "plain", "impact", "check"];
await speak(Dk.page, SAY.strong);
await Dk.page.evaluate(() => mvGo("explain-tech-transfer", "speak")); await sleep(300);
const dkT = await Dk.page.evaluate(() => ({ kind: _mv.kind, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
ok("Desktop: TRANSFER opens with no overflow", dkT.kind === "transfer" && dkT.sw <= dkT.cw, JSON.stringify(dkT));
await shot(Dk.page, "1280-transfer");
await speak(Dk.page, SAY.transfer);
await Dk.page.evaluate(() => mvStep("done")); await sleep(300);
const dkDone = await Dk.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), chips: document.querySelectorAll(".mv-move").length, bars: document.querySelectorAll(".mv-bars > *").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
ok("Desktop: EVIDENCE shows transfer ready with four chips and the bars, no overflow", /transfer ready/i.test(dkDone.txt) && dkDone.chips === 4 && dkDone.bars >= 5 && dkDone.sw <= dkDone.cw, dkDone.txt.slice(0, 120));
await shot(Dk.page, "1280-evidence");
const dkProg = await Dk.page.evaluate(async () => { go("review"); await new Promise(r => setTimeout(r, 300)); return { panels: document.querySelectorAll(".pg-v2").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("Desktop: PROGRESS renders the five panels with no overflow", dkProg.panels === 5 && dkProg.sw <= dkProg.cw, JSON.stringify(dkProg));
await shot(Dk.page, "1280-progress");

/* ── OFFLINE / IDEMPOTENCY ── */
console.log("\nG · NETWORK FAILURE (app)");
const O = await learner("off", GE);
await O.page.evaluate(() => mvGo("explain-tech-guided", "speak")); await sleep(300);
coachMode = "abort";
const hits0 = polishHits;
await speak(O.page, SAY.strong);
const e1 = await O.page.evaluate(async () => { const r = mvStore()["explain-tech"]; const recs = await getRecs(_mv.recCtx);
  return { n: r.attempts.length, said: !!r.attempts[0].said, cov: r.attempts[0].coverage, pending: r.attempts[0].coachPending, state: r.state, audio: recs.length, offline: _mv.coach && _mv.coach.offline, pron: r.attempts[0].pron, key: r.attempts[0].key }; });
ok("Offline: attempt, transcript and audio survive; evidence is correct and was computed on the device", e1.n === 1 && e1.said && e1.audio === 1 && e1.cov === 1 && e1.state === "DEMONSTRATED", JSON.stringify(e1));
ok("Offline: coaching is pending; the deterministic fallback is shown; pronunciation is null, not 0", e1.pending === true && e1.offline === true && e1.pron === null, JSON.stringify(e1));
const dupe = await O.page.evaluate(() => { const c = mvComp("explain-tech"); const before = mvStore()["explain-tech"].attempts.length;
  mvCommit(c, _mv.ev, _mv.coach); mvCommit(c, _mv.ev, _mv.coach); return { before, after: mvStore()["explain-tech"].attempts.length, key: _mv.ev.key }; });
ok("Offline: replaying the same spoken turn twice writes nothing more — one turn, one row", dupe.before === 1 && dupe.after === 1 && dupe.key === e1.key, JSON.stringify(dupe));
coachMode = "ok"; coachCovered = ["frame", "plain", "impact", "check"];
await O.page.evaluate(() => mvFinishCoaching());
await O.page.waitForFunction(() => _mv && !_mv.busy, null, { timeout: 12000 }).catch(() => {});
await sleep(300);
const e3 = await O.page.evaluate(() => { const r = mvStore()["explain-tech"]; return { n: r.attempts.length, pending: r.attempts[0].coachPending, ai: _mv.coach && _mv.coach.ai }; });
ok("Offline: recovery completes the coaching and creates no second piece of evidence; the Worker was called again", e3.n === 1 && e3.pending === false && e3.ai === true && polishHits > hits0 + 1, JSON.stringify(e3));

/* ── J · WELDING ── */
console.log("\nJ · WELDING ISOLATION (app)");
const Wd = await learner("weld", "welding");
const w = await Wd.page.evaluate(async () => {
  const before = JSON.stringify(S.v2A || {});
  go("home"); await new Promise(r => setTimeout(r, 300));
  const card = !!document.querySelector(".mv-home"), homeTxt = document.getElementById("v-home").innerText;
  go("mission", "explain-tech-guided", "speak"); await new Promise(r => setTimeout(r, 400));
  const view = cur.v, html = (document.getElementById("v-mission") || {}).innerHTML;
  const refused = MissionEngine.addAttempt(S.v2A || (S.v2A = {}), "explain-tech", { key: "x", answered: true, coverage: 1, kind: "guided" }, areaId(), [1]) === null;
  mvTrack("v2_speak_attempt", { mission: "explain-tech-guided" });
  mvTrack("v2_mission_started", { mission: "explain-tech-guided" }, { id: "explain-tech", week: 5 });
  const unchanged = JSON.stringify(S.v2A || {}) === before;
  const cur5 = activeCurriculum();
  go("review"); await new Promise(r => setTimeout(r, 300));
  return { area: areaId(), comps: mvComps().length, comp: mvComp("explain-tech"), missions: cur5.missions, card, homeMentions: /technical work|non-technical/i.test(homeTxt), view, html: (html || "").length,
    refused, unchanged, weldRows: Object.keys(((S.v2A || {}).welding) || {}).length, buckets: Object.keys(S.v2A || {}).join(), ev: window.v2Evidence(), rec: window.v2Recommendation(),
    panel: !!document.querySelector(".pg-v2"), events: (window.__ev || []).filter(e => e[0].startsWith("v2_")).length,
    weeks: (cur5.weeks || []).length, sims: (cur5.simulations || []).length, stage: (cur5.weeks[0] || {}).stage };
});
ok("J1 · Welding's curriculum resolves missions to null — Week 5 does not reach it through inheritance", w.area === "welding" && w.missions === null && w.comps === 0 && w.comp === null, JSON.stringify({ a: w.area, m: w.missions, c: w.comps }));
ok("J2 · no V2 card and no Week 5 wording on the Welding home", w.card === false && w.homeMentions === false);
ok("J3 · routing straight to the Week 5 mission turns a Welding learner around safely", w.view === "home" && w.html === 0, JSON.stringify({ v: w.view, len: w.html }));
ok("J4 · the engine refuses to write Week 5 evidence for a Welding learner; no Welding bucket is created", w.refused && w.unchanged && w.weldRows === 0 && !/welding/.test(w.buckets));
ok("J5 · no Week 5 analytics can be emitted from Welding, even with the competency passed in by hand", w.events === 0, String(w.events));
ok("J6 · both hooks return null and the Welding Progress page shows no V2 panel", w.ev === null && w.rec === null && w.panel === false);
ok("J7 · existing Welding curriculum is unchanged: 12 stages, 12 simulations", w.weeks === 12 && w.sims === 12 && /Stage 1/.test(w.stage || ""), JSON.stringify({ w: w.weeks, s: w.sims }));

ok("No uncaught page errors in any context", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
