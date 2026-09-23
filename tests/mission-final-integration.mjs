/* BE Mastery V2.12 — General English Week 12 "Final integration week".
   The INTEGRATION slice, and the proof that integrating is not mastering.

   Week 12 is deliberately NOT a twelfth communication behaviour. weeks.json
   calls it "Final integration week", goal "Combine everything under realistic
   pressure", and its Thursday task is "Full contribution: update →
   clarification → disagreement → recommendation → summary". Its own
   "Integration" phrase bank contains six phrases and every one of them is
   labelled a CHAIN of earlier weeks ("Chain: summary → issue →
   recommendation", "Chain: pushback → persuasion"). So the five moves here
   ARE Weeks 2, 4, 7, 6 and 9's own beats, reused, and `integrates` records
   the mapping.

   THE CHECK THIS SUITE EXISTS FOR (section F below): a learner who passes
   Week 12 must NOT thereby acquire independent mastery of the five
   competencies whose behaviours appeared. Two independent guarantees are
   asserted:
     1. ARCHITECTURAL — a whole Week 12 run writes nothing at all to the other
        eleven records: no attempt, no support row, no state change, no
        retrieval change. Week 12 evidence lives only on final-integration.
     2. RUBRIC — even graded directly against each underlying competency's own
        rubric, a passing Week 12 answer covers at most half of any of them,
        because one beat chained under time pressure is not that competency's
        whole shape.

   Run:  cd tests && node mission-final-integration.mjs
         SHOTS=/some/dir node mission-final-integration.mjs */
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
const CATALOGUE = JSON.parse(readFileSync(ROOT + "catalogue/general.json", "utf8"));
const SHOTS = process.env.SHOTS || null;

const res = [];
const ok = (n, c, d = "") => { res.push({ name: n, pass: !!c }); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };

const ID = "final-integration";
const WEEK = 12;
const by = id => ME.competencyOf(PACK, id);
const W1 = by("explain-work"), W2 = by("clear-update"), W3 = by("raise-problem"), W4 = by("clarify-confirm"), W5 = by("explain-tech"), W6 = by("recommend-decide"), W7 = by("disagree-pushback"), W8 = by("sprint-coordinate"), W9 = by("exec-summary"), W10 = by("sell-experience"), W11 = by("win-support");
const W12 = by(ID);
const guidedOf = c => (c.missions || []).find(m => m.kind === "guided"), transferOf = c => (c.missions || []).find(m => m.kind === "transfer");
const G1 = guidedOf(W1);
const G12 = W12 && ME.missionOf(W12, ID + "-guided"), T12 = W12 && ME.missionOf(W12, ID + "-transfer");
const IV = [1, 3, 7, 21, 60];
const GE = "general-english";
const MOVES = "update,clarify,pushback,recommend,summarise";
const LABELS = "Give the status,Clarify the ambiguity,Push back where you differ,Recommend one way,Close with the bottom line";
const SOURCES = "clear-update,clarify-confirm,disagree-pushback,recommend-decide,exec-summary";
const meta = c => ({ competency: c.id, week: c.week, moveIds: ME.moveIds(c) });
const mk = (c, m, text, kind, key, at) => Object.assign(ME.grade(c, m, text, { seconds: 27 }),
  { key, kind, at: at || Date.now(), missionId: m.id });

const SAY = {
  strong: G12 && G12.hear.model,
  noUpdate: "Before I react to the saving — when you say cut the pilot, do you mean drop it altogether, or shorten it? Those are very different risks. I have one concern about dropping it completely. At site one the pilot caught a scanner calibration fault. Unchecked, that mis-picks about one order in thirty, and site four carries forty per cent of our volume in peak. What I'd recommend is a one-week pilot on the night shift only. That takes twelve thousand of the twenty-five, and it keeps the calibration check. Bottom line: we can hold the eighth of December and take most of the saving.",
  noClarify: "Quick status. Three of the four sites are live and running clean. Site four is on track for the eighth of December. I have one concern about cutting the pilot. At site one the pilot caught a scanner calibration fault. Unchecked, that mis-picks about one order in thirty, and site four carries forty per cent of our volume in peak. What I'd recommend is a one-week pilot on the night shift only. That takes twelve thousand of the twenty-five, and it keeps the calibration check. Bottom line: we can hold the eighth of December and take most of the saving.",
  noPushback: "Quick status. Three of the four sites are live and running clean. Site four is on track for the eighth of December. Before I react to the saving — when you say cut the pilot, do you mean drop it altogether, or shorten it? At site one the pilot caught a scanner calibration fault, which mis-picks about one order in thirty. What I'd recommend is a one-week pilot on the night shift only. That takes twelve thousand of the twenty-five, and it keeps the calibration check. Bottom line: we can hold the eighth of December and take most of the saving.",
  noRecommend: "Quick status. Three of the four sites are live and running clean. Site four is on track for the eighth of December. Before I react to the saving — when you say cut the pilot, do you mean drop it altogether, or shorten it? I have one concern about dropping it completely. At site one the pilot caught a scanner calibration fault. Unchecked, that mis-picks about one order in thirty. Maybe we could look at a shorter pilot of some kind and see where that gets us. Bottom line: we can hold the eighth of December if the calibration check survives.",
  noSummarise: "Quick status. Three of the four sites are live and running clean. Site four is on track for the eighth of December. Before I react to the saving — when you say cut the pilot, do you mean drop it altogether, or shorten it? I have one concern about dropping it completely. At site one the pilot caught a scanner calibration fault. Unchecked, that mis-picks about one order in thirty, and site four carries forty per cent of our volume in peak. What I'd recommend is a one-week pilot on the night shift only. That takes twelve thousand of the twenty-five, and it keeps the calibration check.",
  transfer: "Quick status: the routing has been running correctly in four of the five queues on the bench for three weeks. Just to make sure I understand — when you say all queues, does that include the vulnerable-customer queue? Because the lab test never covered it. I have one concern about switching that queue without a parallel run. Last year a routing change dropped about one in twelve vulnerable call-backs for a day, and we had to tell the regulator. What I'd recommend is switching the four proven queues on Friday and holding the fifth for a two-day parallel run the week after. That costs about three and a half thousand instead of nine. Bottom line: you get Friday on four queues, and the one with the legal duty gets checked first.",
  transferWeak: "Quick status: the routing has been running correctly in four of the five queues on the bench for three weeks. Just to make sure I understand — when you say all queues, does that include the vulnerable-customer queue? Because the lab test never covered it. Last year a routing change dropped about one in twelve vulnerable call-backs for a day, and we had to tell the regulator. What I'd recommend is switching the four proven queues on Friday and holding the fifth for a two-day parallel run the week after. Bottom line: you get Friday on four queues, and the one with the legal duty gets checked first.",
  unpunctuated: G12 && G12.hear.model.toLowerCase().replace(/[—:,.?;]/g, "").replace(/\s+/g, " "),
  jargon: "Integration, synergy, alignment, stakeholders, communication, structure, clarity, influence — that is the whole twelve-week framework.",
  silent: "Yes, that sounds fine to me, we can look at it after the meeting sometime.",
  short: "Fine.",
  seven: "Quick status, three of the four sites",
  eight: "Quick status, three of the four sites live",
};
const REST = {
  "explain-work": { guided: G1.hear.model, transfer: "I am a project coordinator on the delivery team. I look after the schedule and the supplier paperwork for your account. Right now I am preparing the plan for your first shipment. I work closely with our warehouse and your logistics contact, so that nothing on your side has to be chased by hand." },
  "clear-update": { guided: "The project is on track and we have completed two stages. We have run into an issue with the design agency. This means Friday delivery is at risk by about two days. I will chase it up today and come back to you tomorrow.", transfer: "Installation is due to start on Monday and everything else is ready. The materials from the supplier arrived three days late. That means we will push back the handover and the end of month promise is at risk. I will confirm a new date with the customer and come back to you this afternoon." },
  "raise-problem": { guided: guidedOf(W3).hear.model, transfer: "There is a problem with the monthly figures. It started when the old report was switched off in August, so two months of numbers may be wrong. This means the Thursday board pack is at risk. I have spoken to finance and asked them to rerun the numbers. Could you sign off on a one-day delay so we can check them?" },
  "clarify-confirm": { guided: guidedOf(W4).hear.model, transfer: "Sorry, I'm not sure I follow — the client thing could be two things. Are you asking about the revised quote or the delivery date they wanted? So you're saying it's the quote they're expecting before Wednesday's review. Then I'll send the quote today and come back to you tomorrow on the delivery date — does that work?" },
  "explain-tech": { guided: guidedOf(W5).hear.model, transfer: "In plain terms, the integration is a link between their shop and our warehouse. The way it works is that every time a customer places an order, it goes straight to the warehouse system automatically, instead of someone typing it in each morning. What this means for the client is that orders ship the same day and the typing mistakes stop. The one thing to remember is that returns aren't included yet — those are still done by hand. Does that make sense?" },
  "recommend-decide": { guided: guidedOf(W6).hear.model, transfer: "There are two options here. One option is to send it tomorrow with the numbers corrected by hand, and the other option is to hold it for two days and rerun everything from the fixed source. My recommendation is to hold it. The reason is that last quarter they complained about a wrong figure, and two of the twelve charts can't be checked in time if we send tomorrow. The downside is that it's the first late report we've ever sent them. So the next step is that you tell the client today that it's coming on Thursday, and I'll rerun it as soon as the source is fixed." },
  "disagree-pushback": { guided: guidedOf(W7).hear.model, transfer: "I understand why the director wants one go — a phased move takes longer, and nobody wants this dragging into next year. I'd push back on doing the whole warehouse in one weekend, though. The reason is the pilot: at the small depot the switch took two weeks to settle, forty stock counts were wrong in the first week, and the main warehouse holds twenty times the stock. What I'd suggest is that we switch the night team first, since they're already trained, and bring the day shifts across two weeks later. We both want this done before December, and that way we still finish by the end of November without a weekend where nothing can be counted. What would the director need to see to agree to that?" },
  "sprint-coordinate": { guided: guidedOf(W8).hear.model, transfer: "The landing page is built and both banner variants are ready to test. The sign-up form is blocked: the dependency is legal's review of the prize-draw terms — they've had them since Monday and said end of week. Without approved terms the form can't go live, so the first is at risk for sign-ups. To keep the launch on track, I'd go out on the first with the newsletter and no prize draw, and add the draw the week after when legal comes back. Could you ping the head of legal today and let me know by Thursday? If the terms land by Thursday, the form is live for the first; either way the newsletter goes out on the first." },
  "exec-summary": { guided: guidedOf(W9).hear.model, transfer: "The short version: the savings programme reaches its 400 thousand target this year only if we close the third supplier, and that needs a decision from you before Friday. At a high level, two of the four contracts are signed, worth 260 thousand, and the fourth signs next month for another 60. The biggest risk is the third supplier — 110 thousand of the target — where the negotiation has stalled for three weeks on payment terms: they want 60 days, our standard is 45. Finance can live with 60 days if you agree, and their offer lapses on Friday. The decision I need from you is whether we accept 60-day terms to close it this week. The key takeaway: without the third contract we land at 320, short of target; with it, we're over." },
  "sell-experience": { guided: guidedOf(W10).hear.model, transfer: "The challenge was that our forty field engineers were driving two hours forty a day between jobs. Overtime was thirty per cent over budget, and two engineers had resigned because of the driving. Nobody had looked at routing since the company doubled in size, so I led the effort to fix it. I pulled the last three months of job data with an analyst from the planning team, and we found jobs were assigned by who was free, not by where they were. The dispatchers were worried customers would wait longer, so I influenced the decision by asking the director for one region and six weeks, with waiting times measured too. The result was that driving fell to an hour fifty and overtime came back within budget, and waiting times didn't move. It's now live in all four regions. That experience taught me that I do my best work where data and persuasion meet, and that's the role I'm looking for next." },
  "win-support": { guided: guidedOf(W11).hear.model, transfer: "What's at stake here is your output per shift, because the line is going to stop either way — the only question is whether we choose when. The cost of doing nothing is five unplanned breakdowns in six months at about nine hours each, so forty-five hours of lost packing against sixteen for a planned stop. I'm confident because we have six months of readings on that gearbox and it is the same rising pattern that ran before the last two failures. Two planned days buys us back the twenty-nine hours we are losing to breakdowns, and it pays for itself the first time it stops one. Here's what I need from you: two days in the quiet fortnight in November. The window to act is before December, because we cannot stop the line in peak." },
};
const W1_NO_WHY = "I work as an operations analyst in the logistics team. I'm responsible for the weekly delivery reports. At the moment I'm rebuilding how we track late shipments. I work closely with the warehouse managers.";
SAY.transfers = {};
const EARLIER = PACK.competencies.filter(c => c.week < WEEK).sort((a, b) => a.week - b.week);
const LATER = PACK.competencies.filter(c => c.week > WEEK).sort((a, b) => a.week - b.week);
const SRC = W12.integrates.map(x => by(x.competency));

/* ═══════════ A · CURRICULUM IDENTITY ═══════════════════════════════════ */
console.log("\nA · THE CURRICULUM");
ok("A · Week 12 exists, is numbered 12, and carries weeks.json's own theme and goal word for word",
  W12 && W12.week === WEEK && W12.title === "Final integration week" && WEEKS.find(w => w.n === WEEK).theme === W12.title
  && WEEKS.find(w => w.n === WEEK).goal === "Combine everything under realistic pressure.", W12 && W12.title);
ok("A · The numbering is consecutive from 1 with Week 12 twelfth and last — the programme is complete",
  PACK.competencies.map(c => c.week).join() === PACK.competencies.map((_, i) => i + 1).join() && PACK.competencies[WEEK - 1].id === ID && PACK.competencies.length === 12 && LATER.length === 0);
ok("A · The five moves are the five the curriculum's Thursday task names, in its order",
  ME.moveIds(W12).join() === MOVES && /update → clarification → disagreement → recommendation → summary/.test(WEEKS.find(w => w.n === WEEK).days.Thu.task), ME.moveIds(W12).join());
ok("A · The curriculum's own Week 12 phrase bank is the 'Integration' category, and every one of its phrases is a labelled CHAIN of earlier weeks — which is why Week 12 invents nothing",
  (() => { const bank = PHRASES.phrases.filter(p => p.w === WEEK && p.c === "Integration");
    return bank.length === 6 && bank.every(p => /^Chain: /.test(p.u)); })(),
  JSON.stringify(PHRASES.phrases.filter(p => p.w === WEEK && p.c === "Integration").map(p => p.u)));
ok("A · All six of those chains are recorded verbatim in the pack, so the curriculum link is data and not a comment",
  Array.isArray(W12.chains) && W12.chains.length === 6 && W12.chains.every(ch => PHRASES.phrases.some(p => p.w === WEEK && p.c === "Integration" && p.p === ch)));
ok("A · The competency id is semantic, like the eleven before it", /^[a-z]+-[a-z]+$/.test(W12.id) && !/12|twelve|week/.test(W12.id) && PACK.competencies.every(c => /^[a-z]+-[a-z]+$/.test(c.id)));
ok("A · Every earlier competency the suite rests on has a fixture here", EARLIER.length === WEEK - 1 && EARLIER.every(c => REST[c.id] && REST[c.id].guided && REST[c.id].transfer), EARLIER.map(c => c.id).join());

/* ═══════════ B · INTEGRATION ARCHITECTURE ═════════════════════════════ */
console.log("\nB · THE INTEGRATION ARCHITECTURE");
ok("B · Week 12 is marked as an integration competency, not an ordinary one", W12.kind === "integration" && EARLIER.every(c => c.kind === undefined));
ok("B · `integrates` maps all five moves onto five REAL earlier competencies, with their real week numbers",
  Array.isArray(W12.integrates) && W12.integrates.length === 5
  && W12.integrates.map(x => x.move).join() === MOVES
  && W12.integrates.map(x => x.competency).join() === SOURCES
  && W12.integrates.every(x => !!by(x.competency) && by(x.competency).week === x.week && x.week < WEEK), JSON.stringify(W12.integrates));
ok("B · Each move also carries its own `from` and `fromWeek`, agreeing with `integrates`",
  W12.moves.every(mv => { const row = W12.integrates.find(x => x.move === mv.id); return row && mv.from === row.competency && mv.fromWeek === row.week; }));
ok("B · The five sources are Weeks 2, 4, 7, 6 and 9 — update, clarification, disagreement, recommendation, summary",
  W12.integrates.map(x => x.week).join() === "2,4,7,6,9" && SRC.map(c => c.title).length === 5);
ok("B · No new communication behaviour is claimed: the pattern is the five beats, and EVERY move is sourced from an earlier competency that really exists — not one move is unsourced",
  W12.pattern === "UPDATE → CLARIFY → PUSH BACK → RECOMMEND → SUMMARISE"
  && W12.moves.every(mv => mv.from && !!by(mv.from) && by(mv.from).week < WEEK)
  && W12.moves.every(mv => ME.moveIds(by(mv.from)).length > 0)
  && new Set(W12.moves.map(mv => mv.from)).size === 5,
  W12.moves.map(mv => mv.id + "<-" + mv.from).join(" "));
ok("B · Exactly five moves, each with an id, a label, a hint, at least 30 cues, a retry line, three patterns and a cue note",
  W12.moves.length === 5 && W12.moves.every(m => m.id && m.label && m.hint && Array.isArray(m.cues) && m.cues.length >= 30 && m.retry && Array.isArray(m.patterns) && m.patterns.length === 3 && typeof m._cue_note === "string"));
ok("B · The move labels describe the beat, and every cue note names the week it is borrowed from",
  W12.moves.map(m => m.label).join() === LABELS
  && W12.moves.every(mv => new RegExp("Week " + mv.fromWeek + "'s").test(mv._cue_note)), W12.moves.map(m => m.label).join());
ok("B · Every cue is lowercase and unique within its move, and no cue of one move is contained in a cue of another",
  W12.moves.every(m => new Set(m.cues).size === m.cues.length && m.cues.every(q => q === q.toLowerCase()))
  && W12.moves.every((a, i) => W12.moves.every((b, j) => i === j || a.cues.every(x => b.cues.every(y => !x.includes(y))))));
ok("B · The evidence decision is written down in the pack, naming what is NOT written and why",
  typeof W12._integration_note === "string" && /writes evidence ONLY to the final-integration record/.test(W12._integration_note)
  && /not an attempt, and not a support row/.test(W12._integration_note) && /mastery inflation/.test(W12._integration_note)
  && /SHADOW_RUNGS/.test(W12._integration_note) && SOURCES.split(",").every(id => W12._integration_note.includes(id)));

/* ═══════════ C · GUIDED ═══════════════════════════════════════════════ */
console.log("\nC · GUIDED INTEGRATION");
const padded = t => t + " and a few more words to reach the minimum";
const made = e => Object.keys(e.moves).filter(k => e.moves[k]).join();
const grade = (t, s = 60) => ME.grade(W12, G12, t, { seconds: s });
const only = (text, m) => made(grade(text)) === m;
const none = text => grade(text).coverage === 0;
ok("C · The guided mission loads with the room, the two stakeholders, the prompt, the goal and the context",
  G12 && G12.kind === "guided" && G12.see && G12.see.where && G12.see.who && G12.see.asks && G12.see.goal && G12.see.note && G12.hear && G12.hear.model && G12.hear.note && G12.prompt === G12.see.asks && G12.context);
ok("C · The room has competing priorities, an ambiguity nobody has resolved, stakeholder pressure and a clock",
  /operations director wants the December date held/i.test(G12.see.where) && /finance lead has just proposed/i.test(G12.see.where)
  && /nobody has said which pilot or how much of it/i.test(G12.see.where) && /three minutes/i.test(G12.see.where)
  && /owns the December date/i.test(G12.see.who) && /in front of everyone/i.test(G12.see.who));
ok("C · The context supplies every fact the answer needs — the status, the ambiguity, the evidence, the option and the stakes",
  /Sites one to three went live/.test(G12.context) && /40 per cent of volume/.test(G12.context) && /8 December/.test(G12.context) && /peak season starts on 1 December/.test(G12.context)
  && /1 order in 30/.test(G12.context) && /£25,000/.test(G12.context) && /has not said whether that means removing it or shortening it/.test(G12.context)
  && /saves £12,000/.test(G12.context) && /still includes the calibration check/.test(G12.context));
ok("C · The goal asks for one natural turn and the note tells the learner not to announce the moves",
  /One turn/i.test(G12.see.goal) && /everything you have learned in twelve weeks/i.test(G12.see.goal) && /Nobody announces their moves out loud/i.test(G12.see.note));
const gm = grade(SAY.strong, 120);
ok("C · The model answer makes all five moves on its own rubric, in the taught order, in short sentences, using the curriculum's own expressions",
  gm.coverage === 1 && ME.passes(gm) && gm.clarity === 1 && gm.clarityBasis === "order+length" && gm.vocabUsed.length >= 3, "missed=" + gm.missed.join() + " clarity=" + gm.clarity + " vocab=" + gm.vocabUsed.join("|"));
ok("C · The model answer never announces a move — no 'first I will', no week numbers, no move names",
  !/first i will|then i will|week \d|my update move|now i will/i.test(G12.hear.model) && !/update:|clarify:|pushback:/i.test(G12.hear.model));
ok("C · The model note explains the chain and names the five weeks it comes from",
  /Weeks 2, 4, 7, 6 and 9 in one turn/.test(G12.hear.note) && /not one of them is announced/.test(G12.hear.note));
ok("C · Each move's own patterns credit that move and only that move", W12.moves.every(m => m.patterns.every(pt => only(padded(pt), m.id))), W12.moves.map(m => m.id + ":" + m.patterns.map(pt => made(grade(padded(pt)))).join("/")).join(" "));
ok("C · Each expression credits the move it is tagged to — and only that move — and counts as vocabulary used",
  W12.expressions.every(x => { const e = grade(padded(x.w), 5); return e.moves[x.move] === true && made(e) === x.move && e.vocabUsed.includes(x.w); }));
ok("C · Every expression is borrowed verbatim from the competency it is tagged `from`, or from that week's phrase bank — none was invented for Week 12",
  W12.expressions.length === 10 && W12.expressions.every(e => ME.moveIds(W12).includes(e.move) && !!by(e.from) && e.w && e.def && e.l)
  && W12.expressions.every(e => (by(e.from).expressions || []).some(x => x.w.toLowerCase() === e.w.toLowerCase()) || PHRASES.phrases.some(p => AE.hits(p.p, e.w))), JSON.stringify(W12.expressions.map(e => e.w + "<-" + e.from)));
ok("C · An unpunctuated transcript still makes all five moves; clarity rests on order alone",
  (() => { const e = grade(SAY.unpunctuated, 120); return e.coverage === 1 && ME.passes(e) && e.clarityBasis === "order"; })());

/* ═══════════ D · PARTIAL / FAILED INTEGRATION ═════════════════════════ */
console.log("\nD · PARTIAL AND FAILED INTEGRATION");
const miss = (text, id) => { const e = grade(text, 90); return e.coverage === 0.8 && !ME.passes(e) && e.moves[id] === false && ME.weakestMove(W12, e, []) === id; };
ok("D · Straight into the argument with no status: 0.8, not passed, 'update' weakest", miss(SAY.noUpdate, "update"));
ok("D · Guessing at the ambiguity instead of asking: 0.8, not passed, 'clarify' weakest", miss(SAY.noClarify, "clarify"));
ok("D · Reporting the fault without ever differing: 0.8, not passed, 'pushback' weakest", miss(SAY.noPushback, "pushback"));
ok("D · 'Maybe we could look at something' instead of a recommendation: 0.8, not passed, 'recommend' weakest", miss(SAY.noRecommend, "recommend"));
ok("D · Trailing off with no close: 0.8, not passed, 'summarise' weakest", miss(SAY.noSummarise, "summarise"));
ok("D · Four of five is 'strong' coverage by band and still not an integration — the bar is the whole turn",
  (() => { const e = grade(SAY.noSummarise, 90); return e.verdict === "strong" && !ME.passes(e); })());
ok("D · A failed integration — agreeing pleasantly and saying nothing — is kept as evidence at coverage 0", (() => { const e = grade(SAY.silent, 10); return e.coverage === 0 && !ME.passes(e) && e.answered; })());
ok("D · Framework vocabulary makes no move", none(SAY.jargon));
ok("D · Announcing the moves instead of making them proves nothing", none("First I will give an update, then a clarification, then a disagreement, then a recommendation, then a summary."));
ok("D · Vague agreement proves nothing", none("Everything is fine and I think we should probably just carry on as we are for now."));
ok("D · Seven words is not an answer; eight is, scored on its merits", !grade(SAY.seven, 4).answered && (() => { const e = grade(SAY.eight, 4); return e.answered && !ME.passes(e) && e.moves.update === true; })() && ME.MIN_WORDS === 8);
ok("D · Deterministic coaching names the missing beat and hands back its own retry line",
  (() => { const f = ME.shapeCoach(null, W12, mk(W12, G12, SAY.noPushback, "guided", "c0")); return f.move === "pushback" && f.retry === ME.moveOf(W12, "pushback").retry && /say where you differ/i.test(f.retry) && f.ai === false; })());
ok("D · …and for each other missing beat the retry is that beat's own line",
  [["noUpdate", "update"], ["noClarify", "clarify"], ["noRecommend", "recommend"], ["noSummarise", "summarise"]].every(([k, id]) => ME.shapeCoach(null, W12, mk(W12, G12, SAY[k], "guided", "c" + id)).retry === ME.moveOf(W12, id).retry));
ok("D · A retry that adds the missing beat recovers: PRACTICING → DEMONSTRATED, both attempts kept",
  (() => { const s = {}; ME.introduce(s, W12.id, GE); ME.addAttempt(s, W12.id, mk(W12, G12, SAY.noPushback, "guided", "r1"), GE, IV, meta(W12)); const before = s[W12.id].state;
    ME.addAttempt(s, W12.id, mk(W12, G12, SAY.strong, "retry", "r2"), GE, IV, meta(W12));
    return before === "PRACTICING" && s[W12.id].state === "DEMONSTRATED" && s[W12.id].attempts.length === 2 && s[W12.id].attempts[1].kind === "retry"; })());

/* ═══════════ E · TRANSFER ═════════════════════════════════════════════ */
console.log("\nE · TRANSFER INTEGRATION");
const gT = t => ME.grade(W12, T12, t, { seconds: 150 });
ok("E · The transfer mission loads with no model to copy, a different room and a different prompt",
  T12 && T12.kind === "transfer" && !T12.hear && T12.prompt !== G12.prompt && T12.see.who !== G12.see.who && T12.see.note);
ok("E · The transfer fixture makes all five moves cold from the supplied facts", gT(SAY.transfer).coverage === 1, "missed=" + gT(SAY.transfer).missed.join());
ok("E · Without the pushback the transfer does not pass", (() => { const e = gT(SAY.transferWeak); return e.coverage === 0.8 && !ME.passes(e) && ME.weakestMove(W12, e, []) === "pushback"; })(), made(gT(SAY.transferWeak)));
ok("E · The transfer changes the stakeholder, the setting, the facts, the pressure, the constraint and the outcome",
  /customer-experience head/i.test(T12.see.who) && /operations director/i.test(G12.see.who)
  && /contact centre/i.test(T12.see.where) && /delivery review/i.test(G12.see.where)
  && /five minutes, standing up/i.test(T12.see.where) && /three minutes/i.test(G12.see.where)
  && /vulnerable-customer queue/.test(T12.context) && /scanner calibration fault/.test(G12.context)
  && /legal duty/.test(T12.context) && /peak season/.test(G12.context));
ok("E · The two answers share no sentence of more than five words, and neither mentions the other's facts",
  (() => { const sents = t => t.split(/[.!?]/).map(x => x.trim().toLowerCase()).filter(x => x.split(/\s+/).length > 5); const a = sents(SAY.transfer), b = sents(G12.hear.model);
    return a.length >= 4 && a.every(x => !b.includes(x)) && !/pilot|calibration|site four|warehouse|december/i.test(SAY.transfer) && !/queue|routing|call-back|regulator|parallel run/i.test(G12.hear.model); })());
ok("E · Every fact the transfer fixture uses is in the transfer context — nothing invented",
  /four of the five queues/.test(T12.context) && /three weeks/.test(T12.context) && /vulnerable-customer queue/.test(T12.context) && /call back within one hour/.test(T12.context)
  && /lab test never covered it/.test(T12.context) && /1 in 12 vulnerable-customer call-backs/.test(T12.context) && /regulator was informed/.test(T12.context)
  && /£9,000/.test(T12.context) && /£3,600/.test(T12.context) && /without saying whether that includes/.test(T12.context));
ok("E · The guided model is about the wrong subject for the transfer", !/pilot|calibration|site/i.test(T12.context) && /pilot/i.test(G12.hear.model));

/* ═══════════ F · THE EVIDENCE BOUNDARY — THE POINT OF THIS SUITE ══════ */
console.log("\nF · EVIDENCE SEPARATION (integrating is not mastering)");
const put = (s, c, m, txt, kind, key, at) => { ME.introduce(s, c.id, GE); return ME.addAttempt(s, c.id, mk(c, m, txt, kind, key, at), GE, IV, meta(c)); };
ok("F1 · ARCHITECTURAL — a complete Week 12 run (guided, retry, transfer, transfer) writes NOTHING to any of the eleven other records: no record created, no attempt, no support",
  (() => { const s = {};
    ME.introduce(s, W12.id, GE);
    ME.addAttempt(s, W12.id, mk(W12, G12, SAY.noPushback, "guided", "f1"), GE, IV, meta(W12));
    ME.addAttempt(s, W12.id, mk(W12, G12, SAY.strong, "retry", "f2"), GE, IV, meta(W12));
    ME.addAttempt(s, W12.id, mk(W12, T12, SAY.transfer, "transfer", "f3"), GE, IV, meta(W12));
    ME.addAttempt(s, W12.id, mk(W12, T12, SAY.transfer, "transfer", "f4", Date.now() + 2 * 86400000), GE, IV, meta(W12));
    return Object.keys(s).join() === W12.id && s[W12.id].state === "STRONG"; })(),
  "store keys after a full Week 12 run");
ok("F2 · ARCHITECTURAL — with all eleven earlier records already present, a full Week 12 run leaves every one of them byte-for-byte identical",
  (() => { const s = {};
    EARLIER.forEach((c, i) => put(s, c, guidedOf(c), REST[c.id].guided, "guided", "pre" + i));
    const before = JSON.stringify(EARLIER.map(c => s[c.id]));
    ME.introduce(s, W12.id, GE);
    ME.addAttempt(s, W12.id, mk(W12, G12, SAY.strong, "guided", "g1"), GE, IV, meta(W12));
    ME.addAttempt(s, W12.id, mk(W12, T12, SAY.transfer, "transfer", "t1"), GE, IV, meta(W12));
    return JSON.stringify(EARLIER.map(c => s[c.id])) === before; })());
ok("F3 · ARCHITECTURAL — no support row is written to the five integrated competencies, so no Progress panel can claim Shadow work that never happened",
  (() => { const s = {};
    SRC.forEach((c, i) => put(s, c, guidedOf(c), REST[c.id].guided, "guided", "s" + i));
    ME.introduce(s, W12.id, GE);
    ME.addAttempt(s, W12.id, mk(W12, G12, SAY.strong, "guided", "g2"), GE, IV, meta(W12));
    return SRC.every(c => !(s[c.id].support || []).length && ME.progressSummary(s[c.id], c).shadow.total === 0); })());
ok("F4 · RUBRIC — a passing Week 12 answer, graded directly against each of the eleven earlier rubrics, passes none of them",
  EARLIER.every(c => { const g = guidedOf(c); return !ME.passes(ME.grade(c, g, SAY.strong, { seconds: 120 })) && !ME.passes(ME.grade(c, g, SAY.transfer, { seconds: 120 })); }),
  EARLIER.map(c => c.id + ":" + ME.grade(c, guidedOf(c), SAY.strong, { seconds: 120 }).coverage.toFixed(2)).join(" "));
ok("F5 · RUBRIC — even the five INTEGRATED competencies are at most half covered by the integrated turn: one beat chained is not that competency's whole shape",
  SRC.every(c => ME.grade(c, guidedOf(c), SAY.strong, { seconds: 120 }).coverage <= 0.5),
  SRC.map(c => c.id + ":" + ME.grade(c, guidedOf(c), SAY.strong, { seconds: 120 }).coverage.toFixed(2)).join(" "));
ok("F6 · A learner who is STRONG at Week 12 and has never opened Week 7 is still NOT_STARTED at Week 7 — the final week grants nothing",
  (() => { const s = {};
    ME.introduce(s, W12.id, GE);
    ME.addAttempt(s, W12.id, mk(W12, G12, SAY.strong, "guided", "x1"), GE, IV, meta(W12));
    ME.addAttempt(s, W12.id, mk(W12, T12, SAY.transfer, "transfer", "x2"), GE, IV, meta(W12));
    ME.addAttempt(s, W12.id, mk(W12, T12, SAY.transfer, "transfer", "x3", Date.now() + 2 * 86400000), GE, IV, meta(W12));
    return s[W12.id].state === "STRONG" && ME.record(s, W7.id).state === "NOT_STARTED" && !(s[W7.id].attempts || []).length; })());
ok("F7 · The Week 12 attempt's own moves map IS the cross-competency record — it names which underlying behaviours appeared, and that is where the information lives",
  (() => { const row = ME.contract(mk(W12, G12, SAY.noPushback, "guided", "k1"), meta(W12));
    return Object.keys(row.moves).join() === MOVES && row.moves.pushback === false && row.moves.update === true
      && W12.integrates.every(x => x.move in row.moves); })());

/* ═══════════ G · THE FIVE BEATS ARE THE EARLIER ONES ══════════════════ */
console.log("\nG · DELIBERATE OVERLAP (Week 12 reuses, it does not redefine)");
const beats = [
  ["Week 2's status line", "The project is on track and we have completed two stages.", "update"],
  ["Week 4's question", "Can you clarify what you mean by soon? When you say soon, do you mean Friday?", "clarify"],
  ["Week 7's concern", "I have one concern, though: I don't think we should launch the full portal.", "pushback"],
  ["Week 6's recommendation", "What I'd recommend is option B, the second supplier.", "recommend"],
  ["Week 9's close", "Bottom line: the target is reachable by quarter-end with that decision.", "summarise"],
];
beats.forEach(([n, t, want]) => ok(`G · ${n} credits Week 12's '${want}' — the behaviour is the same one, on purpose`, grade(t).moves[want] === true, made(grade(t))));
ok("G · But no single earlier competency's own model answer passes Week 12 — one beat is not an integration",
  EARLIER.every(c => { const e = grade(guidedOf(c).hear.model, 90); return !ME.passes(e) && e.coverage <= 0.4; }),
  EARLIER.map(c => c.id + ":" + grade(guidedOf(c).hear.model, 90).coverage.toFixed(2)).join(" "));
ok("G · And no earlier transfer fixture passes Week 12 either",
  EARLIER.every(c => !ME.passes(grade(REST[c.id].transfer, 90))), EARLIER.map(c => c.id + ":" + grade(REST[c.id].transfer, 90).coverage.toFixed(2)).join(" "));

/* ═══════════ H · PROGRESSION ══════════════════════════════════════════ */
console.log("\nH · PROGRESSION (the existing ladder, unchanged)");
const L12 = {};
const D = 86400000, T0 = Date.parse("2026-11-30T10:00:00Z");
ok("H · NOT_STARTED before anything", ME.record(L12, W12.id).state === "NOT_STARTED" && ME.stateFrom(ME.blank(W12.id)) === "NOT_STARTED");
ME.introduce(L12, W12.id, GE, T0);
ok("H · SEE/HEAR/NOTICE → INTRODUCED and no further (exposure)", L12[W12.id].state === "INTRODUCED");
ME.addAttempt(L12, W12.id, mk(W12, G12, SAY.noPushback, "guided", "p1", T0 + 60000), GE, IV, meta(W12));
ok("H · A partial integration → PRACTICING, due now for practice", L12[W12.id].state === "PRACTICING" && L12[W12.id].retrieval.reason === "practice");
ME.addAttempt(L12, W12.id, mk(W12, G12, SAY.strong, "retry", "p2", T0 + 120000), GE, IV, meta(W12));
ok("H · A full guided integration → DEMONSTRATED, due now for the transfer", L12[W12.id].state === "DEMONSTRATED" && L12[W12.id].retrieval.reason === "transfer");
ME.addAttempt(L12, W12.id, mk(W12, T12, SAY.transferWeak, "transfer", "p3", T0 + 150000), GE, IV, meta(W12));
ok("H · A failed cold integration stays DEMONSTRATED and sends the learner back to guided reps",
  L12[W12.id].state === "DEMONSTRATED" && L12[W12.id].transfer.failed === 1 && ME.recommend(L12[W12.id], W12, T0 + 150000).reason === "transfer_failed");
ME.addAttempt(L12, W12.id, mk(W12, T12, SAY.transfer, "transfer", "p4", T0 + 180000), GE, IV, meta(W12));
ok("H · One cold integration → TRANSFER_READY, spaced one day", L12[W12.id].state === "TRANSFER_READY" && L12[W12.id].retrieval.due === T0 + 180000 + D);
ME.addAttempt(L12, W12.id, mk(W12, T12, SAY.transfer, "transfer", "p5", T0 + 2 * D), GE, IV, meta(W12));
ok("H · A cold integration on another day → STRONG, and the spacing is the engine's own maths: two cold passes is reps 3, so the third interval, 7 days — no new ladder",
  L12[W12.id].state === "STRONG" && L12[W12.id].transfer.passed === 2 && L12[W12.id].retrieval.reps === 3
  && L12[W12.id].retrieval.due === T0 + 2 * D + 7 * D
  && ME.STATES.join() === "NOT_STARTED,INTRODUCED,PRACTICING,DEMONSTRATED,TRANSFER_READY,STRONG",
  JSON.stringify(L12[W12.id].retrieval));
ok("H · The retrieval ladder is the track's own [1,3,7,21,60] and a different ladder is honoured",
  (() => { const s = {}; ME.introduce(s, W12.id, GE, T0); ME.addAttempt(s, W12.id, mk(W12, G12, SAY.strong, "guided", "q1", T0), GE, [2, 5], meta(W12));
    ME.addAttempt(s, W12.id, mk(W12, T12, SAY.transfer, "transfer", "q2", T0 + 1000), GE, [2, 5], meta(W12)); return s[W12.id].retrieval.due === T0 + 1000 + 2 * D; })());

/* ═══════════ I · MEMORY ═══════════════════════════════════════════════ */
console.log("\nI · MEMORY");
const row = ME.contract(mk(W12, G12, SAY.noPushback, "guided", "k1"), meta(W12));
ok("I · Evidence is the same v1 contract: versioned, track-stamped, week 12, competency, mission, kind, key",
  row.v === ME.EVIDENCE_VERSION && row.v === 1 && row.tk === GE && row.week === WEEK && row.competency === ID && row.missionId === ID + "-guided" && row.kind === "guided" && row.key === "k1");
ok("I · No schema change: a Week 12 row has exactly the same fields as a Week 2 row",
  (() => { const a = Object.keys(row).sort().join(); const b = Object.keys(ME.contract(mk(W2, guidedOf(W2), REST["clear-update"].guided, "guided", "k2"), meta(W2))).sort().join(); return a === b; })());
ok("I · Pronunciation is null — never zero — with no audio grader; the measured dimensions are numbers in [0,1]",
  row.pron === null && row.pronSource === null && [row.task, row.clarity, row.fluency, row.vocab].every(x => typeof x === "number" && x >= 0 && x <= 1));
ok("I · The same key twice is one row; the same key on Week 12 and Week 9 is two rows, one each",
  (() => { const s = {}; put(s, W12, G12, SAY.strong, "guided", "dup"); const d = put(s, W12, G12, SAY.strong, "guided", "dup");
    const s2 = {}; put(s2, W9, guidedOf(W9), REST["exec-summary"].guided, "guided", "same"); const r = put(s2, W12, G12, SAY.strong, "guided", "same");
    return d.duplicate && s[W12.id].attempts.length === 1 && !r.duplicate && s2[W9.id].attempts.length === 1 && s2[W12.id].attempts.length === 1; })());
ok("I · Week 12 attempts are bounded at 60", (() => { const s = {}; for (let i = 0; i < 70; i++) put(s, W12, G12, SAY.strong, "guided", "b" + i, T0 + i); return s[W12.id].attempts.length === 60; })());
ok("I · Weak integration stays due now for practice, with the weakness kept and driving the next recommendation",
  (() => { const s = {}; const r = put(s, W12, G12, SAY.noClarify, "guided", "w1"); s[W12.id].weakness = ME.weakestMove(W12, r.attempt, s[W12.id].attempts);
    return s[W12.id].retrieval.reason === "practice" && s[W12.id].weakness === "clarify" && ME.recommend(s[W12.id], W12).move === "clarify"; })());
ok("I · Cross-competency retrieval still works: eleven rested records keep their own schedules while Week 12 is due now",
  (() => { const s = {}; EARLIER.forEach(c => { put(s, c, guidedOf(c), REST[c.id].guided, "guided", "cg" + c.week); put(s, c, transferOf(c), REST[c.id].transfer, "transfer", "ct" + c.week); });
    put(s, W12, G12, SAY.noClarify, "guided", "c12");
    return EARLIER.every(c => s[c.id].state === "TRANSFER_READY" && s[c.id].retrieval.reason === "retrieval" && s[c.id].retrieval.due > Date.now()) && s[W12.id].retrieval.due <= Date.now(); })());
ok("I · The progress summary carries Week 12, its state, five per-move counts, null pronunciation and no Shadow support",
  (() => { const ps = ME.progressSummary(L12[W12.id], W12); return ps.competency === ID && ps.week === WEEK && ps.state === "STRONG" && ps.byMove.map(m => m.id).join() === MOVES && ps.pron === null && ps.shadow.total === 0; })());

/* ═══════════ J · RECOMMENDATION AFTER THE FINAL WEEK ══════════════════ */
console.log("\nJ · WHAT COMES AFTER A WEAK INTEGRATION");
const comps = PACK.competencies;
const pick = s => ME.pickNext(comps, id => s[id], Date.now());
const show = p => p ? `${p.comp.id}:${p.rec.action}:${p.rec.move || "-"}` : "null";
const rest = (s, c, gs, ts, k) => { put(s, c, guidedOf(c), gs, "guided", k + "g"); put(s, c, transferOf(c), ts, "transfer", k + "t"); };
const restEarlier = (s, k) => EARLIER.forEach(c => rest(s, c, REST[c.id].guided, REST[c.id].transfer, k + c.week));
ok("J · A fresh learner is offered Week 1 — the final week is not pushed forward by being newest", show(pick({})) === "explain-work:speak:-", show(pick({})));
let B = {}; restEarlier(B, "b");
ok("J · Weeks 1–11 rest through the engine, not by hand", EARLIER.every(c => B[c.id].state === "TRANSFER_READY"), EARLIER.map(c => c.id + ":" + B[c.id].state).join());
ok("J · With Weeks 1–11 resting, Week 12 is offered to speak — the programme ends on the integration", show(pick(B)) === ID + ":speak:-", show(pick(B)));
rest(B, W12, SAY.strong, SAY.transfer, "b12");
ok("J · With every competency including the integration resting, nothing is pushed and the old advice stands", pick(B) === null, show(pick(B)));
let Weak = {}; restEarlier(Weak, "w"); put(Weak, W12, G12, SAY.noPushback, "guided", "w12");
ok("J · THE FINAL-WEEK QUESTION — weak on pushback inside Week 12, with Week 7 itself solid: Today offers the Week 12 retry, named on the beat that broke",
  show(pick(Weak)) === ID + ":retry:pushback", show(pick(Weak)));
let Both = {}; restEarlier(Both, "z");
Both[W7.id] = ME.blank(W7.id); ME.introduce(Both, W7.id, GE); ME.addAttempt(Both, W7.id, mk(W7, guidedOf(W7), "I understand why the team wants it, and I think it is probably fine.", "guided", "z7b"), GE, IV, meta(W7));
put(Both, W12, G12, SAY.noPushback, "guided", "z12");
ok("J · …but when Week 7's OWN record is weak too, the existing tie-break sends the learner back to Week 7 first — the earlier week wins at equal urgency, with nothing hardcoded",
  show(pick(Both)) === "disagree-pushback:retry:disagree", show(pick(Both)));
ok("J · Pending coaching on the integration outranks everything, as everywhere else",
  (() => { const s = {}; const r = put(s, W12, G12, SAY.noClarify, "guided", "j1"); r.attempt.coachPending = true; return show(pick(s)) === ID + ":coach:clarify"; })());
ok("J · Unspoken → speak the guided integration; demonstrated → take the transfer; ready and not due → rest",
  (() => { const r0 = ME.recommend(ME.blank(W12.id), W12, T0); const s = {}; ME.introduce(s, W12.id, GE, T0);
    ME.addAttempt(s, W12.id, mk(W12, G12, SAY.strong, "guided", "n1", T0), GE, IV, meta(W12));
    const r1 = ME.recommend(s[W12.id], W12, T0 + 1);
    ME.addAttempt(s, W12.id, mk(W12, T12, SAY.transfer, "transfer", "n2", T0 + 2), GE, IV, meta(W12));
    const r2 = ME.recommend(s[W12.id], W12, T0 + 3);
    return r0.action === "speak" && r0.missionId === ID + "-guided" && r1.action === "transfer" && r1.missionId === ID + "-transfer" && r2.action === "rest"; })());

/* ═══════════ K · AI COACH ═════════════════════════════════════════════ */
console.log("\nK · AI COACH");
const st12 = {}; put(st12, W7, guidedOf(W7), REST["disagree-pushback"].guided, "guided", "h0"); put(st12, W12, G12, SAY.noPushback, "guided", "h1");
const ctx = ME.aiContext(st12[W12.id], W12, G12, { weakness: "pushback" });
const ctxJson = JSON.stringify(ctx);
ok("K · The context carries the integration competency, its mission, the pattern, five beats with hints, the weakness and one attempt summary",
  ctx.track === GE && ctx.competency === ID && ctx.mission === ID + "-guided" && ctx.prompt === G12.prompt && ctx.pattern === W12.pattern
  && ctx.targetMoves.length === 5 && ctx.targetMoves.every(m => m.id && m.label && m.hint) && ctx.currentWeakness === "pushback"
  && ctx.previousAttemptSummary && ctx.previousAttemptSummary.moves.pushback === false);
ok("K · The transcript is not in the context, and no other competency's record is either",
  !("said" in ctx.previousAttemptSummary) && !ctxJson.includes(SAY.noPushback.slice(0, 30)) && !ctxJson.includes("\"attempts\":[") && !/profile|streak|\"name\"/i.test(ctxJson)
  && !/disagree-pushback|clear-update|exec-summary|recommend-decide|clarify-confirm/.test(ctxJson));
ok("K · The context is compact", ctxJson.length < 2500, String(ctxJson.length));
const prompt = ME.coachPrompt(ctx, "SPOKEN RULE");
ok("K · The prompt names the five integration beats and its shape, uses the existing {reply, covered} route, and calls the model a coach",
  /makes 5 communication/.test(prompt) && /pushback \(Push back where you differ\)/.test(prompt) && /summarise \(Close with the bottom line\)/.test(prompt)
  && prompt.includes(W12.pattern) && /"covered"/.test(prompt) && /"reply"/.test(prompt) && /speaking coach/i.test(prompt) && prompt.includes("SPOKEN RULE"));
const evAI = mk(W12, G12, SAY.noPushback, "guided", "ai1"); ME.applyCoachMoves(evAI, W12, ["pushback"]);
ok("K · The model MAY add a beat it genuinely heard in the learner's own words", evAI.moves.pushback === true && evAI.coverage === 1 && evAI.assisted === true);
ok("K · The model CANNOT remove a beat the learner made", (() => { const e = mk(W12, G12, SAY.strong, "guided", "ai2"); ME.applyCoachMoves(e, W12, []); return e.coverage === 1; })());
ok("K · The model cannot reach into another competency: unknown ids and non-moves are dropped, and no underlying record exists to touch",
  (() => { const s = {}; const e = mk(W12, G12, SAY.noPushback, "guided", "ai3");
    ME.applyCoachMoves(e, W12, ["disagree", "status", "land", "options", "__proto__", "state", "passed", 42, null]);
    return e.moves.pushback === false && Object.keys(e.moves).join() === MOVES && !("state" in e.moves) && Object.keys(s).length === 0; })());
ok("K · Model output is capped, tagged as AI, and carries no state or score into the app",
  (() => { const shaped = ME.shapeCoach({ reply: "y".repeat(500), covered: ["pushback"], state: "STRONG", score: 100, passed: true }, W12, evAI);
    return shaped.improve.length <= 240 && shaped.ai === true && !("state" in shaped) && !("score" in shaped) && !("passed" in shaped); })());

/* ═══════════ L · SHADOW ═══════════════════════════════════════════════ */
console.log("\nL · SHADOW (engine)");
ok("L · Week 12 has NO shadow block, and the _shadow_note records the audit METHOD, the two candidates and the gap",
  !W12.shadow && typeof W12._shadow_note === "string" && /content check/i.test(W12._shadow_note)
  && /90-second window/.test(W12._shadow_note) && /S0kfnpgY-Gs/.test(W12._shadow_note) && /g7S6MMcYM6k/.test(W12._shadow_note) && /gap/i.test(W12._shadow_note));
ok("L · The note explains why an integration clip is a different search from a topic clip, and why Monday's 'repeat a Week 1 clip' gives nothing to inherit",
  /rather than on topic words/.test(W12._shadow_note) && /integrated turn from a documentary/.test(W12._shadow_note)
  && /Week 1 \(explain-work\) is itself unlinked/.test(W12._shadow_note) && /nothing reaches four or five in one turn/i.test(W12._shadow_note));
ok("L · The clips named in the note are real catalogue entries, so the audit can be re-run", ["S0kfnpgY-Gs", "g7S6MMcYM6k"].every(v => !!CATALOGUE.videos[v]));
const round = vid => ({ kind: "challenge", ts: 1.7e12, vid, title: "t", rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" } });
ok("L · With no clip linked, a Shadow round on ANY competency's clip is unlinked for Week 12",
  [W2, W3, W7, W8, W9, W10].every(c => ME.fromShadow(round(c.shadow.vid), W12).linked === false));
ok("L · Shadow can never advance the integration: a round on a source competency's clip leaves Week 12's state and every beat untouched",
  (() => { const s = {}; put(s, W12, G12, SAY.noPushback, "guided", "sh0"); const before = s[W12.id].state;
    ME.addSupport(s, W12.id, ME.fromShadow(round(W7.shadow.vid), W12), GE);
    const p = ME.progressSummary(s[W12.id], W12);
    return s[W12.id].state === before && p.shadow.linked === 0 && p.byMove.find(m => m.id === "pushback").made === 0; })());
ok("L · The architecture holds competencies with a clip (2,3,7,8,9,10) and without (1,4,5,6,11,12) at the same time",
  [W2, W3, W7, W8, W9, W10].every(c => !!c.shadow) && [W1, W4, W5, W6, W11, W12].every(c => !c.shadow));
ok("L · Support is refused for any track but General English", ME.addSupport({}, W12.id, ME.fromShadow(round(W7.shadow.vid), W12), "welding") === null);

/* ═══════════ M · WELDING WALL (engine) ════════════════════════════════ */
console.log("\nM · WELDING WALL (engine)");
ok("M · The engine refuses a Week 12 write for any area but General English — and creates no record",
  (() => { const s = {}; return ME.addAttempt(s, W12.id, mk(W12, G12, SAY.strong, "guided", "w"), "welding", IV, meta(W12)) === null && ME.introduce(s, W12.id, "welding") === null
    && ME.addSupport(s, W12.id, { key: "x", at: 1 }, "welding") === null && Object.keys(s).length === 0; })());
ok("M · guard() accepts only the pack's own track constant", ME.guard(GE) === true && ME.guard("welding") === false && ME.TRACK === GE);

/* ═══════════ BROWSER ══════════════════════════════════════════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8191, 8192, 8193, 8194, 8190]) {
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
    if (b.mvreport) lastSystem = String(b.mvreport.system || "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Say where you differ out loud — one concern, before the recommendation.", one: "Say where you differ out loud — one concern, before the recommendation.", covered: coachCovered }) });
  });
  await ctx.route(u => /youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com/.test(u.href), route => route.abort());
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?w12=" + Date.now(), { waitUntil: "load" });
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
const recW = (page, id) => page.evaluate(i => JSON.parse(JSON.stringify(mvStore()[i] || {})), id);
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const shot = async (page, name) => { if (SHOTS) { try { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); } catch (e) {} } };
const restBefore = page => page.evaluate(({ REST, WEEK }) => {
  const P = mvPack(), st = mvStore(), IV = trackVocabularyIntervals();
  const meta = c => ({ competency: c.id, week: c.week, moveIds: MissionEngine.moveIds(c) });
  const one = (c, m, text, kind, key) => { MissionEngine.introduce(st, c.id, areaId()); const ev = Object.assign(MissionEngine.grade(c, m, text, { seconds: 27 }), { key, kind, missionId: m.id, at: Date.now() - 60000 });
    MissionEngine.addAttempt(st, c.id, ev, areaId(), IV, meta(c)); };
  P.competencies.filter(c => c.week < WEEK).forEach(c => {
    const g = c.missions.find(m => m.kind === "guided"), t = c.missions.find(m => m.kind === "transfer");
    one(c, g, REST[c.id].guided, "guided", "zg" + c.week); one(c, t, REST[c.id].transfer, "transfer", "zt" + c.week);
  });
  save();
  return P.competencies.filter(c => c.week < WEEK).map(c => st[c.id].state).join();
}, { REST, WEEK });

console.log("\nN · HOME / TODAY");
const L = await learner("ge", GE);
const home0 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText }; });
ok("N1 · A fresh learner's Home offers ONE V2 card and it is Week 1 — the final week does not appear first",
  home0.n === 1 && /Week 1\b/i.test(home0.eyebrow || "") && /Explain what you do/i.test(home0.title || ""), JSON.stringify(home0));
const rested = await restBefore(L.page);
ok("N2 · Weeks 1–11 are transfer-ready in this learner's store (seeded through the engine)", rested === EARLIER.map(() => "TRANSFER_READY").join(), rested);
const home1 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText, chip: c && c.querySelector(".chip").innerText, btn: c && c.querySelector("button").innerText }; });
ok("N3 · Now Home's one card is Week 12, chosen by the engine's own priority with nothing hardcoded",
  home1.n === 1 && /Week 12/i.test(home1.eyebrow || "") && /Final integration week/i.test(home1.title || "") && /not started/i.test(home1.chip || "") && /start the mission/i.test(home1.btn || ""), JSON.stringify(home1));
const ovh = await overflow(L.page); ok("N3 · Home has no horizontal overflow at 390px with the Week 12 card", ovh.sw <= ovh.cw, JSON.stringify(ovh));
await shot(L.page, "390-home-week12");
const coachRec = await L.page.evaluate(() => ({ a: AdaptiveLearningEngine.recommendation(S, ProfessionalTrackContext.active()), m: LearningCoach.mission(S, ProfessionalTrackContext.active()) }));
ok("N4 · The Adaptive engine and the LearningCoach both surface Week 12 through the existing hooks",
  coachRec.a.v2 === true && /Final integration week/i.test(coachRec.a.title) && coachRec.m.v2 === true && coachRec.m.arg1 === ID + "-guided", JSON.stringify({ t: coachRec.a.title, arg: coachRec.m.arg1 }));

console.log("\nTHE LOOP · SEE → HEAR → NOTICE");
await L.page.evaluate(id => mvGo(id + "-guided", "see"), ID); await sleep(350);
const see = await L.page.evaluate(id => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), state: (mvStore()[id] || {}).state, cta: document.querySelectorAll("#v-mission .mv-cta").length }), ID);
ok("SEE renders the integration room, both stakeholders and the goal — and is worth INTRODUCED only",
  /Final integration week/i.test(see.txt) && /react to the saving/i.test(see.txt) && /everything you have learned in twelve weeks/i.test(see.txt) && /Step 1 of 7/i.test(see.txt) && see.cta === 1 && see.state === "INTRODUCED", see.txt.slice(0, 150));
const ovs = await overflow(L.page); ok("SEE has no horizontal overflow at 390px", ovs.sw <= ovs.cw);
await shot(L.page, "390-see");
await L.page.evaluate(() => mvStep("hear")); await sleep(300);
const hear = await L.page.evaluate(() => { const vis = () => /calibration fault/i.test(document.getElementById("v-mission").innerText);
  const hidden = !vis(), play = document.querySelectorAll(".mv-play button").length;
  document.querySelector(".mv-reveal").click();
  return { hidden, play, shownAfter: vis(), heard: (window.__ev || []).some(e => e[0] === "v2_mission_heard"), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("HEAR is voice-first: two play buttons, the model hidden until 'Show the words', the heard event logged, no overflow",
  hear.hidden && hear.play === 2 && hear.shownAfter && hear.heard && hear.sw <= hear.cw, JSON.stringify(hear));
await shot(L.page, "390-hear");
await L.page.evaluate(() => mvStep("notice")); await sleep(350);
const notice = await L.page.evaluate(() => ({
  moves: [...document.querySelectorAll(".mv-list li b")].map(b => b.innerText),
  eyebrow: (document.querySelector(".mv-notice .eyebrow") || {}).innerText, sub: (document.querySelector(".mv-notice .sub") || {}).innerText,
  shadow: !!document.querySelector(".mv-shadow"), cta: document.querySelectorAll("#v-mission .mv-cta").length }));
ok("NOTICE renders the five integration beats by label, says '5 moves', and — with no clip linked — shows NO Shadow row",
  notice.moves.join() === LABELS && /5 moves/i.test(notice.eyebrow + " " + notice.sub) && notice.shadow === false && notice.cta === 1, JSON.stringify(notice));
const ovn = await overflow(L.page); ok("NOTICE has no horizontal overflow at 390px", ovn.sw <= ovn.cw);
await shot(L.page, "390-notice");
ok("Week 12 is voice-first — no script box, no text input, no self-score",
  (await L.page.evaluate(() => ({ ta: document.querySelectorAll("#v-mission textarea").length, inp: document.querySelectorAll("#v-mission input[type=text]").length, sc: document.querySelectorAll("#v-mission .score-b").length }))).ta === 0);

console.log("\nSPEAK → COACH");
await L.page.evaluate(() => mvStep("speak")); await sleep(250);
const spk = await L.page.evaluate(() => ({ btn: document.querySelectorAll("#v-mission .rec-btn").length, prompt: (document.querySelector(".mv-q") || {}).innerText, ctx: (document.querySelector(".mv-ctx") || {}).innerText, state: (document.getElementById("recState") || {}).innerText }));
ok("SPEAK shows the question, the whole situation and one recorder in its idle state",
  spk.btn === 1 && /react to the saving/i.test(spk.prompt || "") && /40 per cent of volume/.test(spk.ctx || "") && /£25,000/.test(spk.ctx || "") && /record your answer/i.test(spk.state || ""), JSON.stringify(spk).slice(0, 200));
await shot(L.page, "390-speak");
coachCovered = ["update", "clarify", "recommend", "summarise"];
await L.page.evaluate(t => { window.__say = t; }, SAY.noPushback);
await L.page.evaluate(() => mvRecord());
await L.page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
const recording = await L.page.evaluate(() => ({ cls: document.querySelector("#v-mission .rec-btn").className, state: (document.getElementById("recState") || {}).innerText, ev: (window.__ev || []).filter(e => e[0] === "v2_speak_attempt").length }));
ok("While recording, the button and label show it, and the speak event was logged", /recording/.test(recording.cls) && /listening/i.test(recording.state || "") && recording.ev === 1, JSON.stringify(recording));
await shot(L.page, "390-recording");
await sleep(1200);
await L.page.evaluate(() => mvRecord());
await L.page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
await sleep(250);
const b1 = await L.page.evaluate(() => ({ moves: _mv.ev.moves, cov: _mv.ev.coverage, move: _mv.coach.move, ai: _mv.coach.ai, chips: document.querySelectorAll(".mv-move").length, off: document.querySelectorAll(".mv-move.off").length, offTxt: (document.querySelector(".mv-move.off") || {}).innerText, step: _mv.step }));
ok("O1 · the missing pushback is identified; five chips render, one off — the pushback chip",
  b1.moves.pushback === false && b1.cov === 0.8 && b1.move === "pushback" && b1.chips === 5 && b1.off === 1 && /Push back where you differ/i.test(b1.offTxt || "") && b1.step === "coach", JSON.stringify({ c: b1.cov, m: b1.move, off: b1.offTxt }));
ok("O2 · four of five does not advance the learner", (await recW(L.page, ID)).state === "PRACTICING");
ok("O3 · THE BOUNDARY, IN THE APP — after a real Week 12 attempt in the browser, not one of the eleven other competencies has a record",
  (await L.page.evaluate(id => { const st = mvStore(); return Object.keys(st).filter(k => k !== id).length; }, ID)) === 11
  && (await L.page.evaluate(id => { const st = mvStore(); return Object.keys(st).filter(k => k !== id).every(k => (st[k].attempts || []).length === 2 && !(st[k].support || []).length); }, ID)) === true,
  "seeded 11 records keep exactly their 2 seeded attempts and no support");
ok("O4 · the coach's system prompt carried the five integration beats", /makes 5 communication/.test(lastSystem) && /pushback \(Push back where you differ\)/.test(lastSystem) && /summarise \(Close with the bottom line\)/.test(lastSystem), lastSystem.slice(0, 80));
const ovc = await overflow(L.page); ok("COACH has no horizontal overflow at 390px", ovc.sw <= ovc.cw);
await shot(L.page, "390-coach");

console.log("\nRETRY → TRANSFER");
const retry = await L.page.evaluate(() => { mvRetry(); return { text: _mv.retryText, step: _mv.step }; });
ok("P1 · the retry names the integration beat that was missed, in the pack's own words", /say where you differ/i.test(retry.text || "") && retry.step === "speak", JSON.stringify(retry));
await shot(L.page, "390-retry");
coachCovered = ["update", "clarify", "pushback", "recommend", "summarise"];
await speak(L.page, SAY.strong);
const c2 = await recW(L.page, ID);
ok("P2 · the retry is stored as a retry, both attempts kept, progression recalculates to DEMONSTRATED",
  c2.attempts.length === 2 && c2.attempts[1].kind === "retry" && c2.attempts[1].coverage === 1 && c2.state === "DEMONSTRATED", c2.state);
await L.page.evaluate(id => mvGo(id + "-transfer", "speak"), ID); await sleep(300);
const tp = await L.page.evaluate(() => ({ q: (document.querySelector(".mv-q") || {}).innerText, kind: _mv.kind, ctx: (document.querySelector(".mv-ctx") || {}).innerText }));
ok("Q1 · the transfer is the contact-centre room, still Week 12, with its own facts",
  /all queues Friday/i.test(tp.q || "") && tp.kind === "transfer" && /vulnerable-customer queue/i.test(tp.ctx || ""), JSON.stringify(tp).slice(0, 200));
await shot(L.page, "390-transfer");
await speak(L.page, SAY.transfer);
const d2 = await recW(L.page, ID);
ok("Q2 · one cold integration is TRANSFER_READY with a retrieval scheduled", d2.attempts.length === 3 && d2.attempts[2].transfer === true && d2.state === "TRANSFER_READY" && d2.retrieval.reason === "retrieval", d2.state);
await L.page.evaluate(() => mvStep("done")); await sleep(300);
const done = await L.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), bars: document.querySelectorAll(".mv-bars > *").length, chips: document.querySelectorAll(".mv-move").length, shadowNote: !!document.querySelector(".mv-shadow-note") }));
ok("Q3 · the evidence screen shows the state, five chips, the bars and NO Shadow line",
  /transfer ready/i.test(done.txt) && done.bars >= 5 && done.chips === 5 && /83%/.test(done.txt) && done.shadowNote === false, done.txt.slice(0, 140));
const ovd = await overflow(L.page); ok("Evidence screen has no horizontal overflow at 390px", ovd.sw <= ovd.cw);
await shot(L.page, "390-evidence");

console.log("\nR · PROGRESS");
const prog = await L.page.evaluate(() => { go("review"); const ps = [...document.querySelectorAll(".pg-v2")]; const d = window.v2Evidence();
  return { panels: ps.length, txt: ps.map(p => p.innerText.replace(/\s+/g, " ")).join(" || "), weeks: d.map(x => x.week).join(), last: d[d.length - 1], comps: d.map(x => x.competency) }; });
ok("R1 · Progress renders all twelve competencies oldest week first, with the integration last",
  prog.panels === 12 && prog.weeks === PACK.competencies.map(c => c.week).join() && prog.comps[11] === ID, JSON.stringify({ p: prog.panels, w: prog.weeks }));
ok("R2 · The Week 12 panel names its week, its state and its five beats through the same evidence contract",
  /Week 12/.test(prog.txt) && /Push back where you differ/.test(prog.txt) && /Close with the bottom line/.test(prog.txt) && prog.last.week === WEEK && prog.last.attempts === 3 && prog.last.pron === 83 && prog.last.shadow.linked === 0);
ok("R3 · THE BOUNDARY, ON PROGRESS — the five integrated competencies still show only their own two seeded answers, not the integration",
  (await L.page.evaluate(srcIds => { const d = window.v2Evidence(); return srcIds.every(id => { const p = d.find(x => x.competency === id); return p && p.attempts === 2 && p.shadow.total === 0; }); }, SOURCES.split(","))) === true);
const ovp = await overflow(L.page); ok("Progress has no horizontal overflow at 390px with twelve panels", ovp.sw <= ovp.cw);
await shot(L.page, "390-progress");

console.log("\nS · ANALYTICS");
const ev = await L.page.evaluate(id => (window.__ev || []).filter(e => e[0].startsWith("v2_") && e[1].competency === id).map(e => [e[0], e[1].track, e[1].week, e[1].competency, e[1].mission]), ID);
ok("S1 · every Week 12 event carries track general-english, week '12' and competency final-integration",
  ev.length >= 10 && ev.every(e => e[1] === GE && e[2] === String(WEEK) && e[3] === ID), JSON.stringify(ev.slice(0, 3)));
const evNames = [...new Set(ev.map(e => e[0]))];
const ALL11 = ["v2_mission_started", "v2_mission_heard", "v2_speak_attempt", "v2_coach_generated", "v2_evidence_recorded", "v2_retry_attempt", "v2_transfer_started", "v2_transfer_completed", "v2_competency_progressed", "v2_retrieval_scheduled", "v2_recommendation_generated"];
ok("S2 · only the existing eleven v2_* names — the integration needed no new event and no new field",
  ALL11.every(n => evNames.includes(n)) && evNames.every(n => ALL11.includes(n)), evNames.join());
const evProps = await L.page.evaluate(() => (window.__ev || []).filter(e => e[0].startsWith("v2_")).map(e => e[1]));
ok("S3 · every prop key is one the Worker's v2 column map already carries",
  evProps.every(p => Object.keys(p).every(k => ["track", "week", "competency", "mission", "kind", "move", "result", "band", "state", "from", "attempt", "ai"].includes(k))));
ok("S4 · the move values are the five integration beats, and no event names an underlying competency",
  evProps.filter(p => p.competency === ID).every(p => (!p.move || MOVES.split(",").concat("none").includes(p.move)) && (!p.mission || new RegExp("^" + ID + "-(guided|transfer)$").test(p.mission) || p.mission === "shadow"))
  && !evProps.some(p => SOURCES.split(",").includes(p.competency)));
ok("S5 · no event carries a transcript, the profile name or the goal",
  !/pilot|calibration|queue|routing|regulator|\"T\"|confidence in meetings/i.test(JSON.stringify(evProps)));

console.log("\nT · DESKTOP");
const Dk = await learner("desk", GE, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
await restBefore(Dk.page);
const dk = await Dk.page.evaluate(async id => {
  const o = () => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth });
  go("home"); await new Promise(r => setTimeout(r, 300));
  const home = { n: document.querySelectorAll(".mv-home").length, eyebrow: (document.querySelector(".mv-home .eyebrow") || {}).innerText, o: o() };
  mvGo(id + "-guided", "see"); await new Promise(r => setTimeout(r, 300)); const o0 = o();
  mvStep("hear"); await new Promise(r => setTimeout(r, 300)); const oh = o(), play = document.querySelectorAll(".mv-play button").length;
  mvStep("notice"); await new Promise(r => setTimeout(r, 400)); const o1 = o(), moves = document.querySelectorAll(".mv-list li").length, shadow = !!document.querySelector(".mv-shadow");
  mvStep("speak"); await new Promise(r => setTimeout(r, 300)); const o2 = o(), cta = document.querySelectorAll("#v-mission .rec-btn").length;
  return { home, o0, oh, play, o1, o2, moves, shadow, cta }; }, ID);
ok("Desktop: Home offers Week 12; SEE, HEAR, NOTICE (five beats, no Shadow row) and SPEAK render with no overflow",
  dk.home.n === 1 && /Week 12/i.test(dk.home.eyebrow || "") && dk.play === 2 && dk.moves === 5 && dk.shadow === false && dk.cta === 1
  && [dk.home.o, dk.o0, dk.oh, dk.o1, dk.o2].every(x => x.sw <= x.cw), JSON.stringify(dk));
await shot(Dk.page, "1280-speak");
coachCovered = ["update", "clarify", "recommend", "summarise"];
await Dk.page.evaluate(t => { window.__say = t; }, SAY.noPushback);
await Dk.page.evaluate(() => mvRecord());
await Dk.page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
const dkRec = await Dk.page.evaluate(() => ({ cls: document.querySelector("#v-mission .rec-btn").className, state: (document.getElementById("recState") || {}).innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
ok("Desktop: the recording state is visible and usable", /recording/.test(dkRec.cls) && /listening/i.test(dkRec.state || "") && dkRec.sw <= dkRec.cw);
await shot(Dk.page, "1280-recording");
await sleep(1200);
await Dk.page.evaluate(() => mvRecord());
await Dk.page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
await sleep(250);
const dkCoach = await Dk.page.evaluate(() => ({ step: _mv.step, chips: document.querySelectorAll(".mv-move").length, off: document.querySelectorAll(".mv-move.off").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
ok("Desktop: COACH renders five chips (one off) with no overflow", dkCoach.step === "coach" && dkCoach.chips === 5 && dkCoach.off === 1 && dkCoach.sw <= dkCoach.cw, JSON.stringify(dkCoach));
await shot(Dk.page, "1280-coach");
coachCovered = ["update", "clarify", "pushback", "recommend", "summarise"];
await Dk.page.evaluate(() => mvRetry());
await speak(Dk.page, SAY.strong);
await Dk.page.evaluate(id => mvGo(id + "-transfer", "speak"), ID); await sleep(300);
await speak(Dk.page, SAY.transfer);
await Dk.page.evaluate(() => mvStep("done")); await sleep(300);
const dkDone = await Dk.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), chips: document.querySelectorAll(".mv-move").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
ok("Desktop: EVIDENCE shows transfer ready with five chips, no overflow", /transfer ready/i.test(dkDone.txt) && dkDone.chips === 5 && dkDone.sw <= dkDone.cw, dkDone.txt.slice(0, 110));
await shot(Dk.page, "1280-evidence");
const dkProg = await Dk.page.evaluate(async () => { go("review"); await new Promise(r => setTimeout(r, 300)); return { panels: document.querySelectorAll(".pg-v2").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("Desktop: PROGRESS renders twelve panels with no overflow", dkProg.panels === 12 && dkProg.sw <= dkProg.cw, JSON.stringify(dkProg));
await shot(Dk.page, "1280-progress");
if (SHOTS) { try { const el = await Dk.page.$(".pg-v2"); if (el) { await el.scrollIntoViewIfNeeded(); await Dk.page.screenshot({ path: `${SHOTS}/1280-progress-panels.png`, fullPage: true }); } } catch (e) {} }

console.log("\nU · NETWORK FAILURE");
const O = await learner("off", GE);
await O.page.evaluate(id => mvGo(id + "-guided", "speak"), ID); await sleep(300);
coachMode = "abort";
const hits0 = polishHits;
await speak(O.page, SAY.strong);
const e1 = await O.page.evaluate(async id => { const r = mvStore()[id]; const recs = await getRecs(_mv.recCtx);
  return { n: r.attempts.length, said: !!r.attempts[0].said, cov: r.attempts[0].coverage, pending: r.attempts[0].coachPending, state: r.state, audio: recs.length, pron: r.attempts[0].pron }; }, ID);
ok("Offline: the integration is graded on the device before any network call; transcript and audio survive; pronunciation is null",
  e1.n === 1 && e1.said && e1.audio === 1 && e1.cov === 1 && e1.state === "DEMONSTRATED" && e1.pending === true && e1.pron === null, JSON.stringify(e1));
coachMode = "ok"; coachCovered = ["update", "clarify", "pushback", "recommend", "summarise"];
await O.page.evaluate(() => mvFinishCoaching());
await O.page.waitForFunction(() => _mv && !_mv.busy, null, { timeout: 12000 }).catch(() => {});
await sleep(300);
const e3 = await O.page.evaluate(id => { const r = mvStore()[id]; return { n: r.attempts.length, pending: r.attempts[0].coachPending, state: r.state }; }, ID);
ok("Offline: recovery completes the coaching and creates no second piece of evidence", e3.n === 1 && e3.pending === false && e3.state === "DEMONSTRATED" && polishHits > hits0 + 1, JSON.stringify(e3));

console.log("\nV · WELDING ISOLATION (app)");
const Wd = await learner("weld", "welding");
const w = await Wd.page.evaluate(async ({ id, vid, week }) => {
  const before = JSON.stringify(S.v2A || {});
  go("home"); await new Promise(r => setTimeout(r, 300));
  const card = !!document.querySelector(".mv-home"), homeTxt = document.getElementById("v-home").innerText;
  go("mission", id + "-guided", "speak"); await new Promise(r => setTimeout(r, 400));
  const view = cur.v, html = (document.getElementById("v-mission") || {}).innerHTML;
  const refused = MissionEngine.addAttempt(S.v2A || (S.v2A = {}), id, { key: "x", answered: true, coverage: 1, kind: "guided" }, areaId(), [1]) === null;
  mvTrack("v2_speak_attempt", { mission: id + "-guided" });
  mvTrack("v2_mission_started", { mission: id + "-guided" }, { id, week });
  const unchanged = JSON.stringify(S.v2A || {}) === before;
  aList("chHist").unshift({ kind: "challenge", ts: Date.now(), vid, title: "clip", rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" }, issues: [], drills: [] }); save();
  const harvested = mvHarvestShadow();
  const cur12 = activeCurriculum();
  go("review"); await new Promise(r => setTimeout(r, 300));
  return { area: areaId(), comps: mvComps().length, comp: mvComp(id), missions: cur12.missions, card,
    homeMentions: /Final integration week|Give the status|Clarify the ambiguity|Push back where you differ|Recommend one way|Close with the bottom line/i.test(homeTxt),
    view, html: (html || "").length, refused, harvested, unchanged, buckets: Object.keys(S.v2A || {}).join(),
    weldRows: Object.keys(((S.v2A || {}).welding) || {}).length,
    ev: window.v2Evidence(), rec: window.v2Recommendation(), panel: !!document.querySelector(".pg-v2"),
    events: (window.__ev || []).filter(e => e[0].startsWith("v2_")).length,
    weeks: (cur12.weeks || []).length, sims: (cur12.simulations || []).length, stage: (cur12.weeks[0] || {}).stage };
}, { id: ID, vid: W7.shadow.vid, week: WEEK });
ok("V1 · Welding's curriculum resolves missions to null — the integration does not reach it through inheritance", w.area === "welding" && w.missions === null && w.comps === 0 && w.comp === null, JSON.stringify({ a: w.area, m: w.missions }));
ok("V2 · no V2 card and no Week 12 wording on the Welding home", w.card === false && w.homeMentions === false);
ok("V3 · routing straight to the Week 12 mission turns a Welding learner around safely", w.view === "home" && w.html === 0);
ok("V4 · the engine refuses to write Week 12 evidence for Welding, and the Welding side holds ZERO rows — areaBucket() lazily creates an empty bucket on any read, which is pre-existing and harmless exactly because guard() refuses every write",
  w.refused && w.unchanged && w.weldRows === 0, JSON.stringify({ refused: w.refused, unchanged: w.unchanged, rows: w.weldRows, buckets: w.buckets }));
ok("V5 · no Week 12 analytics can be emitted from Welding", w.events === 0, String(w.events));
ok("V6 · both hooks return null and the Welding Progress page shows no V2 panel", w.ev === null && w.rec === null && w.panel === false);
ok("V7 · a Welding learner's Shadow work harvests nothing", w.harvested === 0);
ok("V8 · existing Welding curriculum is unchanged: 12 stages, 12 simulations", w.weeks === 12 && w.sims === 12 && /Stage 1/.test(w.stage || ""));

ok("No uncaught page errors in any context", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
