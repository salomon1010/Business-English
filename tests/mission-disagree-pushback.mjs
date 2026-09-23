/* BE Mastery V2.7 — General English Week 7 "Disagreeing professionally &
   pushing back", end to end, and the data-only proof.

   Week 7 is the SEVENTH competency and it arrived as one entry in
   tracks/general/missions.json. This suite is the claim that nothing else had
   to change: the engine, the evidence contract, the state machine, the
   retrieval, the recommendation, the coach boundary, the Home card, the
   Progress panel, the cloud merge, the Shadow link and the Welding wall all
   behave for a competency they had never seen.

   The five moves are ACKNOWLEDGE → DISAGREE → REASON → ALTERNATIVE → ALIGN.
   The situation supplies the proposal and every fact; the learner has to
   differ with it out loud without sounding aggressive or weak. Vocabulary is
   not the bar, and neither is a connector: "I think…", "maybe…", "however…",
   "but…", "I'm not sure…" and "I see your point…" prove no disagreement.

   Canonical numbering: the `week` of a competency is the General English
   programme week it teaches — Week 7 is "Disagreeing professionally & pushing
   back" in weeks.json. See the _note in missions.json.

   Run:  cd tests && node mission-disagree-pushback.mjs
         SHOTS=/some/dir node mission-disagree-pushback.mjs   (also saves screenshots) */
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

const ID = "disagree-pushback";
const WEEK = 7;
const W1 = ME.competencyOf(PACK, "explain-work");
const W2 = ME.competencyOf(PACK, "clear-update");
const W3 = ME.competencyOf(PACK, "raise-problem");
const W4 = ME.competencyOf(PACK, "clarify-confirm");
const W5 = ME.competencyOf(PACK, "explain-tech");
const W6 = ME.competencyOf(PACK, "recommend-decide");
const W7 = ME.competencyOf(PACK, ID);
const guidedOf = c => (c.missions || []).find(m => m.kind === "guided"), transferOf = c => (c.missions || []).find(m => m.kind === "transfer");
const G1 = guidedOf(W1), T1 = transferOf(W1), G2 = guidedOf(W2), T2 = transferOf(W2), G3 = guidedOf(W3), T3 = transferOf(W3), G4 = guidedOf(W4), T4 = transferOf(W4), G5 = guidedOf(W5), T5 = transferOf(W5), G6 = guidedOf(W6), T6 = transferOf(W6);
const G7 = W7 && ME.missionOf(W7, ID + "-guided"), T7 = W7 && ME.missionOf(W7, ID + "-transfer");
const CLIP = W7 && W7.shadow && W7.shadow.vid;
const IV = [1, 3, 7, 21, 60];
const GE = "general-english";
const MOVES = "acknowledge,disagree,reason,alternative,align";
const LABELS = "Acknowledge their point,Say where you differ,Give the reason,Offer a way forward,Close on the shared goal";
const meta = c => ({ competency: c.id, week: c.week, moveIds: ME.moveIds(c) });
const mk = (c, m, text, kind, key, at) => Object.assign(ME.grade(c, m, text, { seconds: 27 }),
  { key, kind, at: at || Date.now(), missionId: m.id });

/* ── what the learners will say ──────────────────────────────────────────── */
const SAY = {
  strong: G7 && G7.hear.model,
  /* the AGGRESSIVE failure: straight to the no */
  noAcknowledge: "I have one concern: I don't think we should launch the full portal on Friday. The risk of moving too quickly is the payment flow — two of the five payment tests are still failing. What I'd suggest is that we go live on Friday with everything except payments and switch payments on next Wednesday once the tests pass. That way we still have a live portal for Monday. Does that work for you?",
  /* the WEAK failure this week exists to break: hints at a risk, never says where they stand */
  noDisagree: "I see the reasoning — the demo is Monday and a live portal makes a stronger pitch. The risk of moving too quickly is the payment flow: two of the five payment tests are still failing, and last release a launch without a full test run cost us a week of fixes. What I'd suggest is that we go live on Friday with everything except payments and switch payments on next Wednesday once the tests pass. That way we still have a live portal for Monday. Does that work for you?",
  noReason: "I see the reasoning — the demo is Monday and a live portal makes a stronger pitch. I have one concern, though: I don't think we should launch the full portal on Friday. What I'd suggest is that we go live on Friday with everything except payments and switch payments on next Wednesday. That way we still have a live portal for Monday. Does that work for you?",
  /* the COMPLAINT: a no with nowhere to go */
  noAlternative: "I see the reasoning — the demo is Monday and a live portal makes a stronger pitch. I have one concern, though: I don't think we should launch the full portal on Friday. The risk of moving too quickly is the payment flow: two of the five payment tests are still failing, and last release a launch without a full test run cost us a week of fixes. We both want a good demo on Monday, so can we agree to look at the date again tomorrow?",
  noAlign: "I see the reasoning — the demo is Monday and a live portal makes a stronger pitch. I have one concern, though: I don't think we should launch the full portal on Friday. The risk of moving too quickly is the payment flow: two of the five payment tests are still failing. What I'd suggest is that we go live on Friday with everything except payments and switch payments on next Wednesday once the tests pass.",
  transfer: "I understand why the director wants one go — a phased move takes longer, and nobody wants this dragging into next year. I'd push back on doing the whole warehouse in one weekend, though. The reason is the pilot: at the small depot the switch took two weeks to settle, forty stock counts were wrong in the first week, and the main warehouse holds twenty times the stock. What I'd suggest is that we switch the night team first, since they're already trained, and bring the day shifts across two weeks later. We both want this done before December, and that way we still finish by the end of November without a weekend where nothing can be counted. What would the director need to see to agree to that?",
  transferWeak: "I understand why the director wants one go — a phased move takes longer. I'd push back on doing the whole warehouse in one weekend, though. The reason is the pilot: at the small depot the switch took two weeks to settle, and forty stock counts were wrong in the first week. What I'd suggest is that we switch the night team first, since they're already trained, and bring the day shifts across two weeks later.",
  /* browser speech recognition usually returns one unpunctuated run */
  unpunctuated: G7 && G7.hear.model.toLowerCase().replace(/[—:,.?]/g, "").replace(/\s+/g, " "),
  /* frames with nothing inside them */
  frames: "I think maybe Friday is fine, however I'm not sure about it, to be honest.",
  short: "No, not Friday.",
  seven: "I have one concern about the date.",
  eight: "I have one concern about the launch date.",
};
/* Weeks 1–6, to put them to rest when the question is whether Week 7 waits its
   turn. Keyed by competency id so both the engine cases and the browser cases
   walk the pack rather than a numbered list. */
const REST = {
  "explain-work": { guided: G1.hear.model, transfer: "I am a project coordinator on the delivery team. I look after the schedule and the supplier paperwork for your account. Right now I am preparing the plan for your first shipment. I work closely with our warehouse and your logistics contact, so that nothing on your side has to be chased by hand." },
  "clear-update": { guided: "The project is on track and we have completed two stages. We have run into an issue with the design agency. This means Friday delivery is at risk by about two days. I will chase it up today and come back to you tomorrow.", transfer: "Installation is due to start on Monday and everything else is ready. The materials from the supplier arrived three days late. That means we will push back the handover and the end of month promise is at risk. I will confirm a new date with the customer and come back to you this afternoon." },
  "raise-problem": { guided: G3.hear.model, transfer: "There is a problem with the monthly figures. It started when the old report was switched off in August, so two months of numbers may be wrong. This means the Thursday board pack is at risk. I have spoken to finance and asked them to rerun the numbers. Could you sign off on a one-day delay so we can check them?" },
  "clarify-confirm": { guided: G4.hear.model, transfer: "Sorry, I'm not sure I follow — the client thing could be two things. Are you asking about the revised quote or the delivery date they wanted? So you're saying it's the quote they're expecting before Wednesday's review. Then I'll send the quote today and come back to you tomorrow on the delivery date — does that work?" },
  "explain-tech": { guided: G5.hear.model, transfer: "In plain terms, the integration is a link between their shop and our warehouse. The way it works is that every time a customer places an order, it goes straight to the warehouse system automatically, instead of someone typing it in each morning. What this means for the client is that orders ship the same day and the typing mistakes stop. The one thing to remember is that returns aren't included yet — those are still done by hand. Does that make sense?" },
  "recommend-decide": { guided: G6.hear.model, transfer: "There are two options here. One option is to send it tomorrow with the numbers corrected by hand, and the other option is to hold it for two days and rerun everything from the fixed source. My recommendation is to hold it. The reason is that last quarter they complained about a wrong figure, and two of the twelve charts can't be checked in time if we send tomorrow. The downside is that it's the first late report we've ever sent them. So the next step is that you tell the client today that it's coming on Thursday, and I'll rerun it as soon as the source is fixed." },
};
/* weak Week 1 / Week 3 answers, for the priority cases */
const W1_NO_WHY = "I work as an operations analyst in the logistics team. I'm responsible for the weekly delivery reports. At the moment I'm rebuilding how we track late shipments. I work closely with the warehouse managers.";
const W3_NO_ASK = "We have got a problem with the delivery. It started when the supplier changed the order number. This means we would finish three days late. I have already spoken to their office.";
/* cold transfers for any competency after Week 7, keyed by id — a new week adds one entry */
SAY.transfers = {
  "sprint-coordinate": "The landing page is built and both banner variants are ready to test. The sign-up form is blocked: the dependency is legal's review of the prize-draw terms \u2014 they've had them since Monday and said end of week. Without approved terms the form can't go live, so the first is at risk for sign-ups. To keep the launch on track, I'd go out on the first with the newsletter and no prize draw, and add the draw the week after when legal comes back. Could you ping the head of legal today and let me know by Thursday? If the terms land by Thursday, the form is live for the first; either way the newsletter goes out on the first.",
  "exec-summary": "The short version: the savings programme reaches its 400 thousand target this year only if we close the third supplier, and that needs a decision from you before Friday. At a high level, two of the four contracts are signed, worth 260 thousand, and the fourth signs next month for another 60. The biggest risk is the third supplier \u2014 110 thousand of the target \u2014 where the negotiation has stalled for three weeks on payment terms: they want 60 days, our standard is 45. Finance can live with 60 days if you agree, and their offer lapses on Friday. The decision I need from you is whether we accept 60-day terms to close it this week. The key takeaway: without the third contract we land at 320, short of target; with it, we're over.",
  "sell-experience": "The challenge was that our forty field engineers were driving two hours forty a day between jobs. Overtime was thirty per cent over budget, and two engineers had resigned because of the driving. Nobody had looked at routing since the company doubled in size, so I led the effort to fix it. I pulled the last three months of job data with an analyst from the planning team, and we found jobs were assigned by who was free, not by where they were. The dispatchers were worried customers would wait longer, so I influenced the decision by asking the director for one region and six weeks, with waiting times measured too. The result was that driving fell to an hour fifty and overtime came back within budget, and waiting times didn't move. It's now live in all four regions. That experience taught me that I do my best work where data and persuasion meet, and that's the role I'm looking for next.",
  "win-support": "What's at stake here is your output per shift, because the line is going to stop either way — the only question is whether we choose when. The cost of doing nothing is five unplanned breakdowns in six months at about nine hours each, so forty-five hours of lost packing against sixteen for a planned stop. I'm confident because we have six months of readings on that gearbox and it is the same rising pattern that ran before the last two failures; the bearing supplier's own data gives it about three months before it seizes. Two planned days buys us back the twenty-nine hours we are losing to breakdowns, and it pays for itself the first time it stops one. Here's what I need from you: two days in the quiet fortnight in November. The window to act is before December, because we cannot stop the line in peak and the gearbox warranty is gone at the end of the month.",
  "final-integration": "Quick status: the routing has been running correctly in four of the five queues on the bench for three weeks. Just to make sure I understand — when you say all queues, does that include the vulnerable-customer queue? Because the lab test never covered it. I have one concern about switching that queue without a parallel run. Last year a routing change dropped about one in twelve vulnerable call-backs for a day, and we had to tell the regulator. What I'd recommend is switching the four proven queues on Friday and holding the fifth for a two-day parallel run the week after. Bottom line: you get Friday on four queues, and the one with the legal duty gets checked first.",
};
const EARLIER = PACK.competencies.filter(c => c.week < WEEK).sort((a, b) => a.week - b.week);
const LATER = PACK.competencies.filter(c => c.week > WEEK).sort((a, b) => a.week - b.week);

/* ═══════════ A · PACK ═══════════════════════════════════════════════════ */
console.log("\nA · THE PACK");
ok("A · Week 7 exists, is numbered 7, carries the canonical title, five moves and two missions",
  W7 && W7.week === WEEK && W7.title === "Disagreeing professionally & pushing back" && ME.moveIds(W7).join() === MOVES && W7.missions.length === 2, W7 && ME.moveIds(W7).join());
ok("A · The title is weeks.json's own Week 7 theme, word for word; the numbering is consecutive from 1 with Week 7 seventh — whatever the count",
  WEEKS.find(w => w.n === WEEK).theme === W7.title && PACK.competencies.map(c => c.week).join() === PACK.competencies.map((_, i) => i + 1).join() && PACK.competencies[WEEK - 1].id === ID, WEEKS.find(w => w.n === WEEK).theme);
ok("A · The competency id is semantic, like the six before it — not derived from the week number",
  /^[a-z]+-[a-z]+$/.test(W7.id) && !/7|seven|week/.test(W7.id) && PACK.competencies.every(c => /^[a-z]+-[a-z]+$/.test(c.id)));
ok("A · Every earlier competency the suite rests on has a fixture here, keyed by id", EARLIER.length === WEEK - 1 && EARLIER.every(c => REST[c.id] && REST[c.id].guided && REST[c.id].transfer), EARLIER.map(c => c.id).join());
ok("A · The pack note records Week 7, its move order and the Shadow decision", /Week 7/.test(PACK._note) && /acknowledge → disagree → reason → alternative → align/.test(PACK._note) && /mmfo9spNaWA/.test(PACK._note)
  && /Week 6/.test(PACK._note) && /options → recommend → reason → tradeoff → next/.test(PACK._note));
ok("A · The guided mission loads with the situation, the model, the prompt and the context",
  G7 && G7.kind === "guided" && G7.see && G7.see.where && G7.see.who && G7.see.asks && G7.see.goal && G7.hear && G7.hear.model && G7.hear.note && G7.prompt === G7.see.asks && G7.context);
ok("A · The transfer mission loads: a different situation, a different listener, a different proposal, no model to copy",
  T7 && T7.kind === "transfer" && !T7.hear && T7.prompt !== G7.prompt && T7.see.who !== G7.see.who && /whole warehouse/i.test(T7.prompt) && !/portal|payment|demo/i.test(T7.context) && !/warehouse|depot|stock/i.test(G7.context));
ok("A · Both situations supply a clear position from someone else, the facts to differ with it, and the constraints — the learner invents nothing",
  /next Wednesday/.test(G7.context) && /two of the five payment tests/.test(G7.context) && /finish on Tuesday/.test(G7.context) && /week of fixes/.test(G7.context) && /demo account/.test(G7.context) && /Everything except payments is ready/.test(G7.context)
  && /two weeks to settle/.test(T7.context) && /40 stock counts/.test(T7.context) && /20 times the stock/.test(T7.context) && /side by side/.test(T7.context) && /night team has already been trained/.test(T7.context) && /phased move drags it out/.test(T7.context));
ok("A · The goal names the week's own bar — push back without sounding aggressive or weak — and the transfer says nobody is prompting",
  /aggressive or weak/i.test(G7.see.goal) && /Nobody is prompting you/i.test(T7.see.goal));
ok("A · Exactly five moves, each with an id, a label, a hint, at least 40 phrase cues, a retry line and three patterns",
  W7.moves.length === 5 && W7.moves.every(m => m.id && m.label && m.hint && Array.isArray(m.cues) && m.cues.length >= 40 && m.retry && Array.isArray(m.patterns) && m.patterns.length === 3));
ok("A · The move labels are observable behaviours, not outcomes", W7.moves.map(m => m.label).join() === LABELS && !W7.moves.some(m => /professional|confident|effective/i.test(m.label)));
ok("A · Every cue is lowercase and unique within its move, and no cue of one move is contained in a cue of another",
  W7.moves.every(m => new Set(m.cues).size === m.cues.length && m.cues.every(q => q === q.toLowerCase()))
  && W7.moves.every((a, i) => W7.moves.every((b, j) => i === j || a.cues.every(x => b.cues.every(y => !x.includes(y))))));
ok("A · No cue is a bare frame: 'i think', 'maybe', 'however', 'but', 'i'm not sure', 'with respect', 'actually', 'another option', 'we could', 'i suggest', 'i recommend' never appear as cues on their own",
  W7.moves.every(m => m.cues.every(c => !["i think", "maybe", "however", "but", "i'm not sure", "with respect", "actually", "another option", "we could", "i suggest", "i recommend", "i see your point,"].includes(c))));
ok("A · Every Week 7 expression is tagged to a move that exists, and most come from the curriculum's own Week 7 'Disagreement & Pushback' phrases",
  W7.expressions.length === 8 && W7.expressions.every(e => ME.moveIds(W7).includes(e.move) && e.w && e.def && e.l)
  && W7.expressions.filter(e => PHRASES.phrases.some(p => p.w === WEEK && AE.hits(p.p, e.w))).length >= 6, JSON.stringify(W7.expressions.map(e => e.w)));
ok("A · The Shadow decision is explicit: a real catalogue clip with captions, and a `why` that says honestly which three of the five moves it models",
  !!W7.shadow && CLIP === "mmfo9spNaWA" && !!CATALOGUE.videos[CLIP] && /How to Disagree/i.test(W7.shadow.title) && /three of the five/.test(W7.shadow.why) && /acknowledge, disagree and reason/.test(W7.shadow.why) && /not the alternative or the close/.test(W7.shadow.why)
  && (() => { try { return JSON.parse(readFileSync(ROOT + "captions/" + CLIP + ".json", "utf8")).cues.length > 50; } catch (e) { return false; } })());
ok("A · …and the _shadow_note records the content check, the runners-up and the library gap for the half the clip does not cover",
  typeof W7._shadow_note === "string" && /content check/i.test(W7._shadow_note) && /jCYLhRKMk8A/.test(W7._shadow_note) && /nT5dB9SDJPA/.test(W7._shadow_note) && /whKyHP5vc3I/.test(W7._shadow_note) && /gap/i.test(W7._shadow_note) && /Monday task/.test(W7._shadow_note));
ok("A · The cue decisions are written down: the frames, 'I'm not sure' alone, 'I see your point', bare 'because', 'another option' / 'we could', and dates are all named as non-evidence",
  (() => { const d = ME.moveOf(W7, "disagree")._cue_note, r = ME.moveOf(W7, "reason")._cue_note, a = ME.moveOf(W7, "alternative")._cue_note, l = ME.moveOf(W7, "align")._cue_note, k = ME.moveOf(W7, "acknowledge")._cue_note;
    return /I think/.test(d) && /maybe/.test(d) && /however/.test(d) && /with respect/.test(d) && /actually/.test(d) && /I'm not sure/.test(d) && /I see your point/.test(d) && /I recommend/.test(d) && /we could/.test(d)
      && /because/.test(r) && /another option/i.test(a) && /we could/.test(a) && /date/i.test(l) && /with respect/.test(k); })());

/* ═══════════ B · MOVE GRADING ═══════════════════════════════════════════ */
console.log("\nB · MOVE GRADING");
const padded = t => t + " and a few more words to reach the minimum";
const made = e => Object.keys(e.moves).filter(k => e.moves[k]).join();
const only = (text, m) => made(ME.grade(W7, G7, text, { seconds: 8 })) === m;
const none = text => ME.grade(W7, G7, text, { seconds: 8 }).coverage === 0;
const noDis = text => ME.grade(W7, G7, text, { seconds: 8 }).moves.disagree === false;
ok("B · Each move's own patterns credit that move and only that move", W7.moves.every(m => m.patterns.every(pt => only(padded(pt), m.id))), W7.moves.map(m => m.id + ":" + m.patterns.map(pt => made(ME.grade(W7, G7, padded(pt), { seconds: 8 }))).join("/")).join(" "));
ok("B · Each expression, when spoken, credits the move it is tagged to and counts as vocabulary used",
  W7.expressions.every(x => { const e = ME.grade(W7, G7, padded(x.w), { seconds: 5 }); return e.moves[x.move] === true && e.vocabUsed.includes(x.w); }));
ok("B · 'I see the reasoning' acknowledges; 'I have one concern' differs; 'the risk is' reasons; 'what if we' offers; 'we both want' aligns — one each",
  only(padded("I see the reasoning on this one"), "acknowledge") && only(padded("I have one concern on this one"), "disagree") && only(padded("The risk is that the tests fail"), "reason")
  && only(padded("What if we pushed it to Tuesday"), "alternative") && only(padded("We both want this to land well"), "align"));
const gm = ME.grade(W7, G7, SAY.strong, { seconds: 45 });
ok("B · The model answer makes all five moves on its own rubric, in the taught order, and uses at least two of the curriculum's own expressions",
  gm.coverage === 1 && ME.passes(gm) && gm.clarity === 1 && gm.clarityBasis === "order+length" && gm.vocabUsed.length >= 2, "missed=" + gm.missed.join() + " vocab=" + gm.vocabUsed.join("|"));
ok("B · An unpunctuated transcript — what browser speech recognition actually returns — still makes all five moves; clarity rests on order alone",
  (() => { const e = ME.grade(W7, G7, SAY.unpunctuated, { seconds: 45 }); return e.coverage === 1 && ME.passes(e) && e.clarityBasis === "order"; })());
console.log("   the cue traps named in the pack — none of these proves a difference of position");
ok("B · 'I think we should launch Friday, maybe, I'm not sure, however it could work' makes NO move", none("I think we should launch Friday, maybe, I'm not sure, however it could work."));
ok("B · 'I think…' alone proves nothing", none("I think it might be better to wait a little bit longer on this one."));
ok("B · 'However…' alone proves nothing", none("However, there are a few things that we should probably look at first."));
ok("B · 'But…' alone proves nothing", none("But there are a few things that we should probably look at first here."));
ok("B · 'I'm not sure…' with no object proves nothing", none("I'm not sure about that, to be honest, but let's see how it all goes."));
ok("B · 'Maybe…' proves nothing", none("Maybe it is fine and maybe it is not, we will see how it goes on Friday."));
ok("B · 'With respect', 'actually', 'but', 'however' — frames with nothing inside — make no move", none("With respect, actually, but, however, that is what I think about it."));
ok("B · 'I see your point, however…' is acknowledgement and nothing else — it proves the learner heard, not that they differ", only("I see your point, however, there are things to consider here.", "acknowledge") && only("I see your point, but there are some things to consider first.", "acknowledge"));
ok("B · 'I see your point, but I don't think we should launch Friday because the tests failed' is acknowledge + disagree + reason — a real difference, still not passed",
  (() => { const e = ME.grade(W7, G7, "I see your point, but I don't think we should launch Friday because the tests failed.", { seconds: 8 }); return made(e) === "acknowledge,disagree,reason" && !ME.passes(e); })());
ok("B · A recommendation alone (Week 6's whole model answer) proves no disagreement — it earns at most a reason, and cannot pass",
  (() => { const e = ME.grade(W7, G7, G6.hear.model, { seconds: 40 }); return e.moves.disagree === false && e.moves.acknowledge === false && !ME.passes(e); })(), made(ME.grade(W7, G7, G6.hear.model, { seconds: 40 })));
ok("B · 'I'd recommend we validate the payment flow before we announce a date' is a way forward, not a disagreement — one move, not passed",
  (() => { const e = ME.grade(W7, G7, "I'd recommend we validate the payment flow before we announce a date.", { seconds: 6 }); return made(e) === "alternative" && !ME.passes(e); })());
ok("B · 'I suggest the second date' — no action attached — proves nothing", none("I suggest the second date, it seems fine to me and to the team."));
ok("B · 'Another option would be to launch Tuesday, we could also wait' is at most an alternative — never a disagreement, never passed",
  (() => { const e = ME.grade(W7, G7, "Another option would be to launch Tuesday, we could also wait a week.", { seconds: 6 }); return e.moves.disagree === false && !ME.passes(e) && e.coverage <= 0.2; })());
ok("B · 'Maybe we could try Tuesday instead of Friday' is at most an alternative — never a disagreement, never passed",
  (() => { const e = ME.grade(W7, G7, "Maybe we could try Tuesday instead of Friday for the launch.", { seconds: 6 }); return e.moves.disagree === false && !ME.passes(e) && e.coverage <= 0.2; })());
ok("B · 'We could launch on Friday and see what happens' makes no move", none("We could launch on Friday and see what happens with the payments."));
ok("B · A reason alone proves neither a position nor a pushback — one move, not passed",
  (() => { const e = ME.grade(W7, G7, "The reason is that two of the five tests are still failing today.", { seconds: 6 }); return made(e) === "reason" && !ME.passes(e); })());
ok("B · An alternative alone is insufficient — one move, not passed",
  (() => { const e = ME.grade(W7, G7, "What if we pushed the launch to Tuesday and used Monday for the tests?", { seconds: 6 }); return made(e) === "alternative" && !ME.passes(e); })());
ok("B · An acknowledgement followed by agreement is one move of five — acknowledging is not pushing back",
  (() => { const e = ME.grade(W7, G7, "That's a fair point, let's do it on Friday as you say, I'm fine with that.", { seconds: 6 }); return made(e) === "acknowledge" && !ME.passes(e); })());
ok("B · 'Yes, okay, sure, right, fine' is not acknowledgement", none("Yes, okay, sure, right, fine, we can do it on Friday as you say."));
ok("B · 'Can I offer a different perspective?' asks permission and proves nothing until the perspective follows", none("Can I offer a different perspective on the launch date for the portal?"));
ok("B · The phrase bank's own lines make exactly the move they teach: 'I hear you — my concern is timing' = acknowledge + disagree; 'I'm not sure that approach addresses…' = disagree; 'Let's pressure-test that assumption' = alternative; 'That's a fair point, and at the same time…' = acknowledge",
  made(ME.grade(W7, G7, "I hear you — my concern is timing.", { seconds: 4 })) === "acknowledge,disagree" && only("I'm not sure that approach addresses the payment problem we have.", "disagree")
  && only("Let's pressure-test that assumption before we commit to the date.", "alternative") && only("That's a fair point, and at the same time we need to look at the data.", "acknowledge"));
ok("B · Weeks 3 and 5 answers make no Week 7 move; Week 4's transfer makes at most 'align' — its closing 'does that work?' is the one line the two competencies share — and never a disagreement",
  none(W3_NO_ASK) && none(REST["explain-tech"].transfer) && (() => { const e = ME.grade(W7, G7, REST["clarify-confirm"].transfer, { seconds: 8 }); return made(e) === "align" && e.moves.disagree === false && !ME.passes(e); })(),
  [W3_NO_ASK, REST["clarify-confirm"].transfer, REST["explain-tech"].transfer].map(t => made(ME.grade(W7, G7, t, { seconds: 8 }))).join("|"));
ok("B · A stated difference with no reason is one move of five — not passed", (() => { const e = ME.grade(W7, G7, padded("I don't think we should launch the full portal on Friday"), { seconds: 5 }); return e.moves.disagree === true && e.moves.reason === false && !ME.passes(e); })());

/* ═══════════ C · GUIDED ═════════════════════════════════════════════════ */
console.log("\nC · GUIDED");
const miss = (text, id) => { const e = ME.grade(W7, G7, text, { seconds: 30 }); return e.coverage === 0.8 && !ME.passes(e) && e.moves[id] === false && ME.weakestMove(W7, e, []) === id; };
ok("C · A complete answer passes", ME.passes(gm));
ok("C · Straight to the no — the aggressive habit: 0.8, not passed, 'acknowledge' weakest", miss(SAY.noAcknowledge, "acknowledge"));
ok("C · Everything but a position — the weak habit: 0.8, not passed, 'disagree' weakest", miss(SAY.noDisagree, "disagree"));
ok("C · Without the reason: 0.8, not passed, 'reason' weakest", miss(SAY.noReason, "reason"));
ok("C · A no with nowhere to go — the complaint: 0.8, not passed, 'alternative' weakest", miss(SAY.noAlternative, "alternative"));
ok("C · Without the close: 0.8, not passed, 'align' weakest", miss(SAY.noAlign, "align"));
ok("C · Four of five is 'strong' coverage by band and still not demonstrated — the bar is every move", (() => { const e = ME.grade(W7, G7, SAY.noAlign, { seconds: 30 }); return e.verdict === "strong" && !ME.passes(e); })());
ok("C · Deterministic coaching names the missing position and hands back its own retry line from the pack",
  (() => { const f = ME.shapeCoach(null, W7, mk(W7, G7, SAY.noDisagree, "guided", "c0")); return f.move === "disagree" && f.retry === ME.moveOf(W7, "disagree").retry && /state your actual position/i.test(f.retry) && f.ai === false; })());
ok("C · …and for each other missing move the retry is that move's own line",
  [["noAcknowledge", "acknowledge"], ["noReason", "reason"], ["noAlternative", "alternative"], ["noAlign", "align"]].every(([k, id]) => ME.shapeCoach(null, W7, mk(W7, G7, SAY[k], "guided", "c" + id)).retry === ME.moveOf(W7, id).retry));
ok("C · The missing move's expressions are queued to learn; the ones used are queued to keep",
  (() => { const q = ME.expressionsToLearn(W7, ME.grade(W7, G7, SAY.noDisagree, { seconds: 30 }), "disagree");
    return q.some(e => e.move === "disagree" && e.why === "missing") && q.some(e => e.why === "used") && q.every(e => W7.expressions.some(x => x.w === e.w)); })());
ok("C · A retry that adds the missing move recovers: PRACTICING → DEMONSTRATED, both attempts kept",
  (() => { const s = {}; ME.introduce(s, W7.id, GE); ME.addAttempt(s, W7.id, mk(W7, G7, SAY.noDisagree, "guided", "r1"), GE, IV, meta(W7)); const before = s[W7.id].state;
    ME.addAttempt(s, W7.id, mk(W7, G7, SAY.strong, "retry", "r2"), GE, IV, meta(W7));
    return before === "PRACTICING" && s[W7.id].state === "DEMONSTRATED" && s[W7.id].attempts.length === 2 && s[W7.id].attempts[1].kind === "retry"; })());
ok("C · Three words is not an answer; seven is not; eight is, scored on its merits — the bar is the engine's MIN_WORDS",
  !ME.grade(W7, G7, SAY.short, { seconds: 2 }).answered && !ME.grade(W7, G7, SAY.seven, { seconds: 4 }).answered && (() => { const e = ME.grade(W7, G7, SAY.eight, { seconds: 4 }); return e.answered && !ME.passes(e) && e.coverage === 0.2; })() && ME.MIN_WORDS === 8);

/* ═══════════ D · TRANSFER ═══════════════════════════════════════════════ */
console.log("\nD · TRANSFER");
ok("D · The transfer fixture makes all five moves cold from the supplied facts", ME.grade(W7, T7, SAY.transfer, { seconds: 40 }).coverage === 1, "missed=" + ME.grade(W7, T7, SAY.transfer, { seconds: 40 }).missed.join());
ok("D · Without the close the transfer does not pass", (() => { const e = ME.grade(W7, T7, SAY.transferWeak, { seconds: 30 }); return e.coverage === 0.8 && !ME.passes(e) && ME.weakestMove(W7, e, []) === "align"; })());
ok("D · The transfer is not the guided answer re-used: the two answers share no sentence of more than five words, and neither mentions the other's facts",
  (() => { const sents = t => t.split(/[.!?]/).map(x => x.trim().toLowerCase()).filter(x => x.split(/\s+/).length > 5); const a = sents(SAY.transfer), b = sents(G7.hear.model);
    return a.length >= 4 && a.every(x => !b.includes(x)) && !/portal|payment|demo|checkout/i.test(SAY.transfer) && !/warehouse|depot|stock|director/i.test(G7.hear.model); })());
ok("D · The guided model answer is about the wrong proposal for the transfer — it pushes back on a portal launch where the transfer has a warehouse switch",
  !/portal|payment/i.test(T7.context) && /portal/.test(G7.hear.model) && /payments/.test(G7.hear.model));
ok("D · Every fact the transfer fixture uses is in the transfer context — nothing invented",
  /two weeks to settle/i.test(T7.context) && /40 stock counts were wrong in the first week/i.test(T7.context) && /20 times the stock/i.test(T7.context) && /night team has already been trained/i.test(T7.context) && /phased move/i.test(T7.context) && /December/.test(T7.context) && /last weekend of November/.test(T7.prompt));
ok("D · The transfer changes the listener, the proposal, the workplace, the constraint and the reason for differing — not just the names",
  T7.see.who !== G7.see.who && !/product manager/i.test(T7.see.who) && /team lead/i.test(T7.see.who) && /warehouse/i.test(T7.see.where) && /stand-up/i.test(G7.see.where) && /side by side/.test(T7.context) && /payment tests/.test(G7.context));

/* ═══════════ E · PROGRESSION ════════════════════════════════════════════ */
console.log("\nE · PROGRESSION");
const L7 = {};
const D = 86400000, T0 = Date.parse("2026-10-26T10:00:00Z");
ok("E · NOT_STARTED before anything", ME.record(L7, W7.id).state === "NOT_STARTED" && ME.stateFrom(ME.blank(W7.id)) === "NOT_STARTED");
ME.introduce(L7, W7.id, GE, T0);
ok("E · SEE/HEAR/NOTICE → INTRODUCED and no further", L7[W7.id].state === "INTRODUCED");
ME.addAttempt(L7, W7.id, mk(W7, G7, SAY.noDisagree, "guided", "p1", T0 + 60000), GE, IV, meta(W7));
ok("E · A partial attempt → PRACTICING, retrieval due now for 'practice'", L7[W7.id].state === "PRACTICING" && L7[W7.id].retrieval.reason === "practice" && L7[W7.id].retrieval.due === T0 + 60000);
ME.addAttempt(L7, W7.id, mk(W7, G7, SAY.frames, "retry", "p1b", T0 + 90000), GE, IV, meta(W7));
ok("E · A failed guided attempt (frames only, no moves) stays PRACTICING and is kept as evidence", L7[W7.id].state === "PRACTICING" && L7[W7.id].attempts.length === 2 && L7[W7.id].attempts[1].coverage === 0, String(L7[W7.id].attempts[1].coverage));
ME.addAttempt(L7, W7.id, mk(W7, G7, SAY.strong, "retry", "p2", T0 + 120000), GE, IV, meta(W7));
ok("E · A full guided answer → DEMONSTRATED, due now for the transfer", L7[W7.id].state === "DEMONSTRATED" && L7[W7.id].retrieval.reason === "transfer");
ME.addAttempt(L7, W7.id, mk(W7, T7, SAY.transferWeak, "transfer", "p2b", T0 + 150000), GE, IV, meta(W7));
ok("E · A failed transfer stays DEMONSTRATED, counts against the tally, and sends the learner back to guided reps",
  L7[W7.id].state === "DEMONSTRATED" && L7[W7.id].transfer.failed === 1 && L7[W7.id].transfer.passed === 0 && ME.recommend(L7[W7.id], W7, T0 + 150000).reason === "transfer_failed");
ME.addAttempt(L7, W7.id, mk(W7, T7, SAY.transfer, "transfer", "p3", T0 + 180000), GE, IV, meta(W7));
ok("E · One cold success → TRANSFER_READY with a retrieval on the first interval (1 day)", L7[W7.id].state === "TRANSFER_READY" && L7[W7.id].transfer.passed === 1 && L7[W7.id].retrieval.reason === "retrieval" && L7[W7.id].retrieval.due === T0 + 180000 + D);
ME.addAttempt(L7, W7.id, mk(W7, T7, SAY.transfer, "transfer", "p4", T0 + 200000), GE, IV, meta(W7));
ok("E · A second cold success the SAME day is still TRANSFER_READY, spaced on the next interval (3 days)", L7[W7.id].state === "TRANSFER_READY" && L7[W7.id].transfer.passed === 2 && L7[W7.id].retrieval.due === T0 + 200000 + 3 * D);
ME.addAttempt(L7, W7.id, mk(W7, T7, SAY.transfer, "transfer", "p5", T0 + 2 * D), GE, IV, meta(W7));
ok("E · A cold success on another day → STRONG, spaced further (21 days)", L7[W7.id].state === "STRONG" && L7[W7.id].retrieval.reps === 4 && L7[W7.id].retrieval.due === T0 + 2 * D + 21 * D);
ok("E · The schedule is the track's — a different ladder is honoured", (() => { const s = {}; ME.introduce(s, W7.id, GE, T0); ME.addAttempt(s, W7.id, mk(W7, G7, SAY.strong, "guided", "q1", T0), GE, [2, 5], meta(W7));
  ME.addAttempt(s, W7.id, mk(W7, T7, SAY.transfer, "transfer", "q2", T0 + 1000), GE, [2, 5], meta(W7)); return s[W7.id].retrieval.due === T0 + 1000 + 2 * D; })());
console.log("   deterministic next recommendation");
const R = {};
ok("E · Unspoken → speak the guided mission", (() => { const r = ME.recommend(ME.blank(W7.id), W7, T0); return r.action === "speak" && r.missionId === ID + "-guided" && r.reason === "not_spoken_yet"; })());
ME.introduce(R, W7.id, GE, T0); ME.addAttempt(R, W7.id, mk(W7, G7, SAY.noAlternative, "guided", "s1", T0), GE, IV, meta(W7));
ok("E · Weak → retry the same mission on the missing move", (() => { const r = ME.recommend(R[W7.id], W7, T0); return r.action === "retry" && r.move === "alternative" && r.reason === "weak_move"; })());
ME.addAttempt(R, W7.id, mk(W7, G7, SAY.strong, "retry", "s2", T0 + 1), GE, IV, meta(W7));
ok("E · Demonstrated → take the transfer", (() => { const r = ME.recommend(R[W7.id], W7, T0 + 1); return r.action === "transfer" && r.missionId === ID + "-transfer"; })());
ME.addAttempt(R, W7.id, mk(W7, T7, SAY.transfer, "transfer", "s3", T0 + 2), GE, IV, meta(W7));
ok("E · Transfer-ready and not yet due → rest with the date; once due → a retrieval on the transfer mission",
  ME.recommend(R[W7.id], W7, T0 + 3).action === "rest" && ME.recommend(R[W7.id], W7, R[W7.id].retrieval.due + 1).action === "retrieval" && ME.recommend(R[W7.id], W7, R[W7.id].retrieval.due + 1).missionId === ID + "-transfer");
ok("E · Pending coaching outranks everything", (() => { const s = JSON.parse(JSON.stringify(R)); s[W7.id].attempts[0].coachPending = true; return ME.recommend(s[W7.id], W7, T0).action === "coach"; })());

/* ═══════════ F · CROSS-COMPETENCY ═══════════════════════════════════════ */
console.log("\nF · CROSS-COMPETENCY");
const comps = PACK.competencies;
const pick = s => ME.pickNext(comps, id => s[id], Date.now());
const put = (s, c, m, txt, kind, key, at) => { ME.introduce(s, c.id, GE); return ME.addAttempt(s, c.id, mk(c, m, txt, kind, key, at), GE, IV, meta(c)); };
const show = p => p ? `${p.comp.id}:${p.rec.action}:${p.rec.move || "-"}` : "null";
const rest = (s, c, g, t, gs, ts, k) => { put(s, c, g, gs, "guided", k + "g"); put(s, c, t, ts, "transfer", k + "t"); };
/* every competency before Week 7, in week order, from the per-id map */
const restEarlier = (s, k) => EARLIER.forEach(c => rest(s, c, guidedOf(c), transferOf(c), REST[c.id].guided, REST[c.id].transfer, k + c.week));
ok("F · A fresh learner is offered Week 1 — Week 7 is not pushed forward by being newest", show(pick({})) === "explain-work:speak:-", show(pick({})));
let B = {}; restEarlier(B, "b");
ok("F · Weeks 1–6 rest through the engine, not by hand", EARLIER.every(c => B[c.id].state === "TRANSFER_READY"), EARLIER.map(c => c.id + ":" + B[c.id].state).join());
ok("F · With Weeks 1–6 resting, Week 7 is offered to speak — a competency nobody has spoken for is never skipped", show(pick(B)) === ID + ":speak:-", show(pick(B)));
rest(B, W7, G7, T7, SAY.strong, SAY.transfer, "b7");
ok("F · Every competency after Week 7 has a cold-transfer fixture in this suite", LATER.every(c => typeof SAY.transfers[c.id] === "string"), LATER.map(c => c.id).join());
LATER.forEach(c => { ok(`F · With everything before it resting, ${c.id} (Week ${c.week}) is offered to speak`, show(pick(B)) === `${c.id}:speak:-`, show(pick(B))); rest(B, c, guidedOf(c), transferOf(c), guidedOf(c).hear.model, SAY.transfers[c.id], "b" + c.week); });
ok("F · With every competency resting, nothing is pushed and the old advice stands", pick(B) === null, show(pick(B)));
let C = {}; put(C, W1, G1, REST["explain-work"].guided, "guided", "c1"); put(C, W7, G7, SAY.noDisagree, "guided", "c2");
ok("F · A Week 7 weak move outranks a Week 1 pending transfer — evidence priority, not week order", show(pick(C)) === ID + ":retry:disagree", show(pick(C)));
let Dd = {}; put(Dd, W1, G1, W1_NO_WHY, "guided", "d1"); put(Dd, W7, G7, SAY.noDisagree, "guided", "d2");
ok("F · Two equally urgent retries → the earlier week, deterministically, and only as a tie-break", show(pick(Dd)) === "explain-work:retry:why" && show(pick(Dd)) === show(pick(Dd)), show(pick(Dd)));
let E = {}; put(E, W6, G6, REST["recommend-decide"].guided, "guided", "e1"); put(E, W7, G7, SAY.noAlign, "guided", "e2");
ok("F · Week 7 weak vs Week 6 ready for transfer → Week 7's retry", show(pick(E)) === ID + ":retry:align", show(pick(E)));
let Fx = {}; restEarlier(Fx, "f"); put(Fx, W7, G7, SAY.noAlternative, "guided", "f7");
ok("F · A learner with different evidence gets a different next mission: Weeks 1–6 resting and Week 7 weak → Week 7 retry on 'alternative'", show(pick(Fx)) === ID + ":retry:alternative", show(pick(Fx)));
ok("F · Pending coaching on Week 7 outranks a Week 1 retry",
  (() => { const s = {}; put(s, W1, G1, W1_NO_WHY, "guided", "i1"); const r = put(s, W7, G7, SAY.noAcknowledge, "guided", "i2"); r.attempt.coachPending = true; return show(pick(s)) === ID + ":coach:acknowledge"; })());
ok("F · One record per competency, keyed by competency id — never by week", (() => { const s = {}; PACK.competencies.forEach((c, i) => put(s, c, guidedOf(c), "x", "guided", "k" + i)); return Object.keys(s).sort().join() === PACK.competencies.map(c => c.id).sort().join() && Object.keys(s).length === PACK.competencies.length; })());

/* ═══════════ G · MEMORY ═════════════════════════════════════════════════ */
console.log("\nG · MEMORY");
const row = ME.contract(mk(W7, G7, SAY.noDisagree, "guided", "k1"), meta(W7));
ok("G · Evidence is written as the same v1 contract: versioned, track-stamped, week 7, competency, mission, kind, key",
  row.v === ME.EVIDENCE_VERSION && row.v === 1 && row.tk === GE && row.week === WEEK && row.competency === ID && row.missionId === ID + "-guided" && row.kind === "guided" && row.key === "k1");
ok("G · Its moves map holds exactly the five Week 7 ids, as booleans", Object.keys(row.moves).join() === MOVES && Object.values(row.moves).every(v => typeof v === "boolean") && row.moves.disagree === false);
ok("G · Task, clarity, fluency and vocabulary are measured numbers in [0,1]; pronunciation is null — never zero — with no audio grader",
  [row.task, row.clarity, row.fluency, row.vocab].every(x => typeof x === "number" && x >= 0 && x <= 1) && row.pron === null && row.pronSource === null);
ok("G · With no duration, seconds and wpm are null, not 0", (() => { const r = ME.contract(Object.assign(ME.grade(W7, G7, SAY.strong, {}), { key: "k3", kind: "guided" }), meta(W7)); return r.seconds === null && r.wpm === null; })());
ok("G · Transfer is null on a guided attempt and a boolean on a transfer attempt", row.transfer === null && typeof ME.contract(mk(W7, T7, SAY.transfer, "transfer", "k2"), meta(W7)).transfer === "boolean");
ok("G · Vocabulary used lists only the competency's own expressions", (() => { const r = ME.grade(W7, G7, "I see the reasoning. I have one concern. My hesitation is the date. The risk of moving too quickly is the checkout. I'd suggest we validate first. That way we still land it.", { seconds: 12 }); return r.vocabUsed.every(w => W7.expressions.some(e => e.w === w)) && r.vocabUsed.length >= 5; })());
ok("G · The same key twice in Week 7 is one row, reported as a duplicate", (() => { const s = {}; put(s, W7, G7, SAY.strong, "guided", "dup"); return put(s, W7, G7, SAY.strong, "guided", "dup").duplicate && s[W7.id].attempts.length === 1; })());
ok("G · The same key in Week 7 and Week 6 is two rows, one each — idempotency is per competency",
  (() => { const s = {}; put(s, W6, G6, REST["recommend-decide"].guided, "guided", "same"); const r = put(s, W7, G7, SAY.strong, "guided", "same"); return !r.duplicate && s[W6.id].attempts.length === 1 && s[W7.id].attempts.length === 1; })());
ok("G · Weak evidence stays due: a weak Week 7 record is due now, for practice, with its weakness kept and driving the next recommendation",
  (() => { const s = {}; const r = put(s, W7, G7, SAY.noAlign, "guided", "w1"); s[W7.id].weakness = ME.weakestMove(W7, r.attempt, s[W7.id].attempts);
    return s[W7.id].retrieval.reason === "practice" && s[W7.id].retrieval.due <= Date.now() && s[W7.id].weakness === "align" && ME.recommend(s[W7.id], W7).move === "align"; })());
ok("G · Week 7 attempts are bounded at 60", (() => { const s = {}; for (let i = 0; i < 70; i++) put(s, W7, G7, SAY.strong, "guided", "b" + i, T0 + i); return s[W7.id].attempts.length === 60; })());
ok("G · A Week 7 attempt changes none of the other six records",
  (() => { const s = {}; EARLIER.forEach((c, i) => put(s, c, guidedOf(c), i === 0 ? W1_NO_WHY : REST[c.id].guided, "guided", "m" + i));
    const before = JSON.stringify(EARLIER.map(c => s[c.id])); put(s, W7, G7, SAY.noDisagree, "guided", "m7"); return JSON.stringify(EARLIER.map(c => s[c.id])) === before && s[W7.id].state === "PRACTICING"; })());
ok("G · The progress summary carries Week 7, its state, five per-move counts, null pronunciation and no Shadow support yet",
  (() => { const ps = ME.progressSummary(L7[W7.id], W7); return ps.competency === ID && ps.week === WEEK && ps.state === "STRONG" && ps.byMove.map(m => m.id).join() === MOVES && ps.pron === null && ps.shadow.total === 0 && ps.transferPassed === 3 && ps.transferFailed === 1; })());

/* ═══════════ H · AI CONTEXT ═════════════════════════════════════════════ */
console.log("\nH · AI COACH");
const st7 = {}; put(st7, W6, G6, REST["recommend-decide"].guided, "guided", "h0"); put(st7, W7, G7, SAY.noDisagree, "guided", "h1");
const ctx = ME.aiContext(st7[W7.id], W7, G7, { weakness: "disagree" });
const ctxJson = JSON.stringify(ctx);
ok("H · The context carries competency disagree-pushback, the guided mission, the pattern, five moves with hints, the weakness, evidence counts and one attempt summary",
  ctx.track === GE && ctx.competency === ID && ctx.mission === ID + "-guided" && ctx.prompt === G7.prompt && ctx.pattern === W7.pattern
  && ctx.targetMoves.length === 5 && ctx.targetMoves.every(m => m.id && m.label && m.hint) && ctx.currentWeakness === "disagree"
  && ctx.recentEvidence.attempts === 1 && ctx.previousAttemptSummary && ctx.previousAttemptSummary.moves.disagree === false);
ok("H · Relevant memory is in: the last attempt's moves and length; the transcript is not", ctx.previousAttemptSummary.words > 8 && !("said" in ctx.previousAttemptSummary) && !ctxJson.includes(SAY.noDisagree.slice(0, 30)));
ok("H · Unrelated history is not dumped in: no attempt list, no profile, no state machine, nothing from Week 6 or any other competency",
  !ctxJson.includes("\"attempts\":[") && !/profile|streak|\"name\"/i.test(ctxJson) && !("state" in ctx) && !/recommend-decide|explain-tech|clarify-confirm|explain-work|clear-update|raise-problem|tradeoff|Lay out the options|restate|mitigate|takeaway/.test(ctxJson));
ok("H · The context is compact", ctxJson.length < 2500, String(ctxJson.length));
const prompt = ME.coachPrompt(ctx, "SPOKEN RULE");
ok("H · The prompt names five moves with Week 7's labels, its shape, and the existing {reply, covered} route — and tells the model it is a coach, not a colleague",
  /makes 5 communication/.test(prompt) && /disagree \(Say where you differ\)/.test(prompt) && /align \(Close on the shared goal\)/.test(prompt) && prompt.includes(W7.pattern) && /"covered"/.test(prompt) && /"reply"/.test(prompt) && /speaking coach/i.test(prompt) && prompt.includes("SPOKEN RULE") && !/recommend \(|check \(|confirm \(/.test(prompt));
const evAI = mk(W7, G7, SAY.noDisagree, "guided", "ai1"); ME.applyCoachMoves(evAI, W7, ["disagree"]);
ok("H · The model MAY add the difference it heard in the learner's own words", evAI.moves.disagree === true && evAI.coverage === 1 && evAI.assisted === true);
const evKeep = mk(W7, G7, SAY.strong, "guided", "ai2"); ME.applyCoachMoves(evKeep, W7, []);
ok("H · The model CANNOT remove a move the learner made", evKeep.coverage === 1);
const evJunk = mk(W7, G7, SAY.noDisagree, "guided", "ai3"); ME.applyCoachMoves(evJunk, W7, ["recommend", "tradeoff", "check", "__proto__", "state", "passed", 42, null]);
ok("H · Other competencies' move ids and non-moves are dropped on the floor", evJunk.moves.disagree === false && Object.keys(evJunk.moves).join() === MOVES && !("state" in evJunk.moves));
const shaped = ME.shapeCoach({ reply: "y".repeat(500), covered: ["disagree"], state: "STRONG", score: 100, passed: true }, W7, evAI);
ok("H · Model output is capped, tagged as AI, and carries no state or score into the app", shaped.improve.length <= 240 && shaped.ai === true && !("state" in shaped) && !("score" in shaped) && !("passed" in shaped));

/* ═══════════ S · SHADOW (engine) — A REAL CLIP, SUPPORTING ONLY ════════ */
console.log("\nS · SHADOW (engine)");
const round = vid => ({ kind: "challenge", ts: 1.7e12, vid, title: "t", rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" } });
ok("S · A round on Week 7's clip links to Week 7 — and to none of the others", ME.fromShadow(round(CLIP), W7).linked === true && [W1, W2, W3, W4, W5, W6].every(c => ME.fromShadow(round(CLIP), c).linked === false));
ok("S · A round on Week 3's clip does not link to Week 7", ME.fromShadow(round(W3.shadow.vid), W7).linked === false);
ok("S · Shadow support never moves Week 7's state, and is idempotent on the history row",
  (() => { const s = {}; ME.record(s, W7.id); ME.addSupport(s, W7.id, ME.fromShadow(round(CLIP), W7), GE); ME.addSupport(s, W7.id, ME.fromShadow(round(CLIP), W7), GE);
    const p = ME.progressSummary(s[W7.id], W7); return s[W7.id].state === "NOT_STARTED" && s[W7.id].support.length === 1 && p.shadow.linked === 1 && p.shadow.rungName === "blind" && p.attempts === 0; })());
ok("S · Shadow can supply comprehensibility the mission could not measure, and says so",
  (() => { const s = {}; put(s, W7, G7, SAY.strong, "guided", "sh1"); ME.addSupport(s, W7.id, ME.fromShadow(round(CLIP), W7), GE); const p = ME.progressSummary(s[W7.id], W7); return p.pron === 90 && p.pronSource === "shadow"; })());
ok("S · The architecture holds competencies with a clip (2, 3, 7) and without (1, 4, 5, 6) at the same time",
  !!W2.shadow && !!W3.shadow && !!W7.shadow && !W1.shadow && !W4.shadow && !W5.shadow && !W6.shadow && ME.progressSummary(ME.blank(W6.id), W6).shadow.total === 0);
ok("S · Support is refused for any track but General English", ME.addSupport({}, W7.id, ME.fromShadow(round(CLIP), W7), "welding") === null);

/* ═══════════ J (engine half) · WELDING WALL ═════════════════════════════ */
console.log("\nJ · WELDING WALL (engine)");
ok("J · The engine refuses a Week 7 write for any area but General English — and does not create a record",
  (() => { const s = {}; return ME.addAttempt(s, W7.id, mk(W7, G7, SAY.strong, "guided", "w"), "welding", IV, meta(W7)) === null && ME.introduce(s, W7.id, "welding") === null
    && ME.addSupport(s, W7.id, { key: "x", at: 1 }, "welding") === null && Object.keys(s).length === 0; })());
ok("J · guard() accepts only the pack's own track constant", ME.guard(GE) === true && ME.guard("welding") === false && ME.TRACK === GE);

/* ═══════════ BROWSER ════════════════════════════════════════════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8111, 8112, 8113, 8114, 8115]) {
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
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "State your position in one plain sentence before you give the reason.", one: "State your position in one plain sentence before you give the reason.", covered: coachCovered }) });
  });
  /* The Shadow row hands the studio a YouTube clip; the player API is kept off
     the network here, so the check is about the hand-over, not about YouTube. */
  await ctx.route(u => /youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com/.test(u.href), route => route.abort());
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?w7=" + Date.now(), { waitUntil: "load" });
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
const rec7 = (page, id) => page.evaluate(i => JSON.parse(JSON.stringify(mvStore()[i] || {})), id);
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: innerWidth }));
const shot = async (page, name) => { if (SHOTS) { try { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); } catch (e) {} } };
/* Put every competency before Week 7 to rest inside the page, through the
   engine, walking the pack from the per-id fixture map. */
const restBefore7 = page => page.evaluate(({ REST, WEEK }) => {
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

console.log("\nK · HOME / TODAY");
const L = await learner("ge", GE);
const home0 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, today: document.querySelectorAll(".today-card").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText }; });
ok("K1 · A fresh learner's Home offers ONE V2 card and it is Week 1 — Week 7 does not appear prematurely",
  home0.n === 1 && home0.today <= 1 && /Week 1/i.test(home0.eyebrow || "") && /Explain what you do/i.test(home0.title || ""), JSON.stringify(home0));
const rested = await restBefore7(L.page);
ok("K2 · Weeks 1–6 are transfer-ready in this learner's store (seeded through the engine, not by hand)", rested === EARLIER.map(() => "TRANSFER_READY").join(), rested);
const home1 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText, chip: c && c.querySelector(".chip").innerText, btn: c && c.querySelector("button").innerText, line: c && c.querySelector("p").innerText }; });
ok("K3 · Now Home's one card is Week 7, 'Not started', with 'Start the mission' — chosen by the engine's own priority, nothing hardcoded",
  home1.n === 1 && /Week 7/i.test(home1.eyebrow || "") && /Disagreeing professionally/i.test(home1.title || "") && /not started/i.test(home1.chip || "") && /start the mission/i.test(home1.btn || "") && /say it out loud once/i.test(home1.line || ""), JSON.stringify(home1));
const ovh = await overflow(L.page); ok("K3 · Home has no horizontal overflow at 390px with the Week 7 card", ovh.sw <= ovh.cw, JSON.stringify(ovh));
await shot(L.page, "390-home-week7");
const coachRec = await L.page.evaluate(() => ({ a: AdaptiveLearningEngine.recommendation(S, ProfessionalTrackContext.active()), m: LearningCoach.mission(S, ProfessionalTrackContext.active()) }));
ok("K4 · The Adaptive engine and the LearningCoach both surface Week 7 through the existing hooks", coachRec.a.v2 === true && /Disagreeing/i.test(coachRec.a.title) && coachRec.m.v2 === true && coachRec.m.arg1 === ID + "-guided" && coachRec.m.go === "mission", JSON.stringify({ t: coachRec.a.title, arg: coachRec.m.arg1 }));
const opened = await L.page.evaluate(async () => { LearningCoach.openMission(); await new Promise(r => setTimeout(r, 400)); return { v: cur.v, comp: _mv && _mv.compId, mission: _mv && _mv.missionId }; });
ok("K5 · LearningCoach.openMission() lands on the Week 7 mission", opened.v === "mission" && opened.comp === ID && opened.mission === ID + "-guided", JSON.stringify(opened));

/* SEE → HEAR → NOTICE for Week 7 */
console.log("\nTHE LOOP · SEE → HEAR → NOTICE");
await L.page.evaluate(id => mvGo(id + "-guided", "see"), ID); await sleep(350);
const see = await L.page.evaluate(id => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), state: (mvStore()[id] || {}).state, cta: document.querySelectorAll("#v-mission .mv-cta").length, back: !!document.querySelector("#v-mission > .mv-back") }), ID);
ok("SEE renders Week 7's title, the product manager's push and the goal, with one action and a way back — and is worth INTRODUCED only",
  /Disagreeing professionally/i.test(see.txt) && /this Friday/i.test(see.txt) && /Any reason we can't/i.test(see.txt) && /aggressive or weak/i.test(see.txt) && /Step 1 of 7/i.test(see.txt) && see.cta === 1 && see.back && see.state === "INTRODUCED", see.txt.slice(0, 160));
const ovs = await overflow(L.page); ok("SEE has no horizontal overflow at 390px", ovs.sw <= ovs.cw, JSON.stringify(ovs));
await shot(L.page, "390-see");
await L.page.evaluate(() => mvStep("hear")); await sleep(300);
const hear = await L.page.evaluate(() => { const vis = () => /nobody sees a broken checkout/i.test(document.getElementById("v-mission").innerText);
  const hidden = !vis(), play = document.querySelectorAll(".mv-play button").length, reveal = !!document.querySelector(".mv-reveal");
  document.querySelector(".mv-reveal").click();
  return { hidden, play, reveal, shownAfter: vis(), heard: (window.__ev || []).some(e => e[0] === "v2_mission_heard"), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("HEAR is voice-first: two play buttons, Week 7's model hidden until 'Show the words', the heard event logged, no overflow",
  hear.hidden && hear.play === 2 && hear.reveal && hear.shownAfter && hear.heard && hear.sw <= hear.cw, JSON.stringify(hear));
await shot(L.page, "390-hear");
await L.page.evaluate(() => mvStep("notice")); await sleep(350);
const notice = await L.page.evaluate(() => ({
  moves: [...document.querySelectorAll(".mv-list li b")].map(b => b.innerText),
  eyebrow: (document.querySelector(".mv-notice .eyebrow") || {}).innerText, sub: (document.querySelector(".mv-notice .sub") || {}).innerText,
  shadow: !!document.querySelector(".mv-shadow"), shadowTxt: (document.querySelector(".mv-shadow") || {}).innerText, cta: document.querySelectorAll("#v-mission .mv-cta").length }));
ok("NOTICE renders the five Week 7 moves by label, says '5 moves', and — with a clip linked — shows the Shadow row",
  notice.moves.join() === LABELS && /5 moves/i.test(notice.eyebrow + " " + notice.sub) && notice.shadow === true && /Hear a professional do it/i.test(notice.shadowTxt || "") && notice.cta === 1, JSON.stringify(notice));
const ovn = await overflow(L.page); ok("NOTICE has no horizontal overflow at 390px with five moves and the Shadow row", ovn.sw <= ovn.cw, JSON.stringify(ovn));
await shot(L.page, "390-notice");
const errsBeforeShadow = errors.length;
const shRow = await L.page.evaluate(async id => { mvShadow(); await new Promise(r => setTimeout(r, 400));
  const r = { v: cur.v, vid: typeof shClip === "object" && shClip && shClip.vid, title: shClip && shClip.title, last: S.lastClip && S.lastClip.vid, state: (mvStore()[id] || {}).state };
  mvGo(id + "-guided", "notice"); await new Promise(r => setTimeout(r, 300)); return r; }, ID);
ok("The Shadow row hands the existing studio Week 7's clip — the same shLoad, no new Shadow code — and opening it is worth no evidence",
  shRow.v === "shadow" && shRow.vid === CLIP && /How to Disagree/i.test(shRow.title || "") && shRow.last === CLIP && shRow.state === "INTRODUCED", JSON.stringify(shRow));
/* Fixed in V2.8: mvShadow() used to call shLoad() BEFORE go("shadow"), and the
   studio's DOM is built by rShadow(), so the first tap in a session that had
   never opened Shadow rejected on a null element. It now parks the clip as
   S.lastClip and lets the view load it once its DOM exists — so this tap must
   be silent. tests/shadow-first-tap.mjs walks every linked competency. */
const KNOWN_SHADOW_ERRS = errors.slice(errsBeforeShadow);
ok("Tapping the Shadow row before the Shadow tab has ever rendered raises NO page error (V2.8 fix: the clip is parked as the last clip and the view loads it once its DOM exists)",
  KNOWN_SHADOW_ERRS.length === 0, KNOWN_SHADOW_ERRS.join(" | "));
const noType = await L.page.evaluate(() => ({ ta: document.querySelectorAll("#v-mission textarea").length, inp: document.querySelectorAll("#v-mission input[type=text]").length, sc: document.querySelectorAll("#v-mission .score-b").length }));
ok("Week 7 is voice-first — no script box, no text input, no self-score", noType.ta === 0 && noType.inp === 0 && noType.sc === 0, JSON.stringify(noType));

/* ── SPEAK → COACH (weak: everything but a position) ── */
console.log("\nSPEAK → COACH");
await L.page.evaluate(() => mvStep("speak")); await sleep(250);
const spk = await L.page.evaluate(() => ({ btn: document.querySelectorAll("#v-mission .rec-btn").length, prompt: (document.querySelector(".mv-q") || {}).innerText, ctx: (document.querySelector(".mv-ctx") || {}).innerText, state: (document.getElementById("recState") || {}).innerText }));
ok("SPEAK shows the push, the facts to differ with as context, and one recorder in its idle state",
  spk.btn === 1 && /Any reason we can't/i.test(spk.prompt || "") && /two of the five/.test(spk.ctx || "") && /demo account/.test(spk.ctx || "") && /Everything except payments/.test(spk.ctx || "") && /record your answer/i.test(spk.state || ""), JSON.stringify(spk).slice(0, 220));
await shot(L.page, "390-speak");
coachCovered = ["acknowledge", "reason", "alternative", "align"];
await L.page.evaluate(t => { window.__say = t; }, SAY.noDisagree);
await L.page.evaluate(() => mvRecord());
await L.page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
const recording = await L.page.evaluate(() => ({ cls: document.querySelector("#v-mission .rec-btn").className, state: (document.getElementById("recState") || {}).innerText, rec: !!_mv.recording, ev: (window.__ev || []).filter(e => e[0] === "v2_speak_attempt").length }));
ok("While recording, the button is in its recording state, the label says so, and the speak event was logged", /recording/.test(recording.cls) && /listening/i.test(recording.state || "") && recording.rec && recording.ev === 1, JSON.stringify(recording));
await shot(L.page, "390-recording");
await sleep(1200);
await L.page.evaluate(() => mvRecord());
await L.page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
await sleep(250);
const b1 = await L.page.evaluate(() => ({ moves: _mv.ev.moves, cov: _mv.ev.coverage, move: _mv.coach.move, ai: _mv.coach.ai, chips: document.querySelectorAll(".mv-move").length, off: document.querySelectorAll(".mv-move.off").length, offTxt: (document.querySelector(".mv-move.off") || {}).textContent, improve: (document.querySelector(".mv-improve") || {}).innerText, step: _mv.step }));
ok("B1 · the missing position is identified from what was said; five chips render, one off — the disagree chip",
  b1.moves.disagree === false && b1.cov === 0.8 && b1.move === "disagree" && b1.chips === 5 && b1.off === 1 && /Say where you differ/i.test(b1.offTxt || "") && b1.step === "coach", JSON.stringify({ c: b1.cov, m: b1.move, chips: b1.chips, off: b1.off, offTxt: b1.offTxt }));
ok("B2 · four of five does not advance the learner", (await rec7(L.page, ID)).state === "PRACTICING");
ok("B3 · the coach's system prompt carried Week 7's five moves — not Week 6's recommend, Week 5's check or Week 4's confirm",
  /makes 5 communication/.test(lastSystem) && /disagree \(Say where you differ\)/.test(lastSystem) && !/recommend \(/.test(lastSystem) && !/check \(/.test(lastSystem) && !/confirm \(/.test(lastSystem) && !/ask \(What I need\)/.test(lastSystem), lastSystem.slice(0, 90));
ok("B4 · the coaching shown is the model's and is tagged as such", b1.ai === true && /plain sentence/i.test(b1.improve || ""));
const ovc = await overflow(L.page); ok("COACH has no horizontal overflow at 390px with five chips", ovc.sw <= ovc.cw, JSON.stringify(ovc));
await shot(L.page, "390-coach");

/* ── RETRY ── */
console.log("\nRETRY");
const retry = await L.page.evaluate(() => { mvRetry(); return { text: _mv.retryText, step: _mv.step, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText }; });
ok("C1 · the retry names the Week 7 move that was missed, in the pack's own words, on the retry step", /state your actual position/i.test(retry.text || "") && retry.step === "speak" && /one more time/i.test(retry.eyebrow || ""), JSON.stringify(retry));
await shot(L.page, "390-retry");
coachCovered = ["acknowledge", "disagree", "reason", "alternative", "align"];
await speak(L.page, SAY.strong);
const c2 = await rec7(L.page, ID);
ok("C2 · the retry is stored as a retry; both attempts are preserved", c2.attempts.length === 2 && c2.attempts[0].coverage === 0.8 && c2.attempts[1].kind === "retry" && c2.attempts[1].coverage === 1);
ok("C3 · progression recalculates to DEMONSTRATED", c2.state === "DEMONSTRATED", c2.state);
const transferBtn = await L.page.evaluate(() => [...document.querySelectorAll(".mv-acts button")].map(b => b.innerText).join("|"));
ok("C4 · once demonstrated, the coach screen offers the new situation", /take the new situation/i.test(transferBtn), transferBtn);

/* ── TRANSFER ── */
console.log("\nTRANSFER");
await L.page.evaluate(id => mvGo(id + "-transfer", "speak"), ID); await sleep(300);
const tp = await L.page.evaluate(() => ({ q: (document.querySelector(".mv-q") || {}).innerText, comp: _mv.compId, kind: _mv.kind, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText, instr: (document.querySelector(".mv-instruction") || {}).innerText, ctx: (document.querySelector(".mv-ctx") || {}).innerText }));
ok("D1 · the transfer is a different proposal, still Week 7, framed as the new situation with the cold goal and its own facts",
  /whole warehouse/i.test(tp.q || "") && tp.comp === ID && tp.kind === "transfer" && /new situation/i.test(tp.eyebrow || "") && /nobody is prompting you/i.test(tp.instr || "") && /night team/i.test(tp.ctx || "") && /side by side/i.test(tp.ctx || ""), JSON.stringify(tp).slice(0, 220));
await shot(L.page, "390-transfer");
await speak(L.page, SAY.transfer);
const d2 = await rec7(L.page, ID);
ok("D2 · transfer evidence is stored as its own kind, separate from practice", d2.attempts.length === 3 && d2.attempts[2].kind === "transfer" && d2.attempts[2].transfer === true);
ok("D3 · one cold success is TRANSFER_READY, not STRONG", d2.state === "TRANSFER_READY" && d2.transfer.passed === 1, d2.state);
ok("D4 · a retrieval is scheduled from the track's own intervals", d2.retrieval && d2.retrieval.reason === "retrieval" && d2.retrieval.due > Date.now());
/* Shadow work on Week 7's clip, done in the studio, is harvested as supporting evidence — never as an attempt */
const harvested = await L.page.evaluate(({ vid, id }) => {
  const before = mvStore()[id].state, n0 = mvStore()[id].attempts.length;
  aList("chHist").unshift({ kind: "challenge", ts: Date.now(), vid, title: "How to Disagree", seg: 2, rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" }, heard: "x y z", issues: [], drills: [] });
  aList("chHist").unshift({ kind: "challenge", ts: Date.now() + 1, vid: "OTHERCLIP", coverage: 0.9, pass: true, dims: {}, issues: [], drills: [] });
  save();
  const n = mvHarvestShadow(), again = mvHarvestShadow();
  const d = (window.v2Evidence() || []).find(x => x.competency === id);
  return { n, again, linked: d.shadow.linked, rung: d.shadow.rungName, state: d.state, sameState: before === d.state, attempts: mvStore()[id].attempts.length === n0 };
}, { vid: CLIP, id: ID });
ok("Shadowing Week 7's clip in the studio becomes linked supporting evidence for Week 7 — idempotent, other clips ignored, state and attempts untouched",
  harvested.n === 1 && harvested.again === 0 && harvested.linked === 1 && harvested.rung === "blind" && harvested.sameState && harvested.attempts, JSON.stringify(harvested));
await L.page.evaluate(() => mvStep("done")); await sleep(300);
const done = await L.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), bars: document.querySelectorAll(".mv-bars > *").length, chips: document.querySelectorAll(".mv-move").length, shadowNote: !!document.querySelector(".mv-shadow-note"), shadowTxt: (document.querySelector(".mv-shadow-note") || {}).innerText }));
ok("D5 · the evidence screen shows the state, five chips and the dimension bars — pronunciation as a number here because the (mocked) audio grader measured it — and the Shadow line for the linked clip",
  /transfer ready/i.test(done.txt) && done.bars >= 5 && done.chips === 5 && /83%/.test(done.txt) && done.shadowNote === true && /1×/.test(done.shadowTxt || ""), done.txt.slice(0, 160) + " | " + done.shadowTxt);
const ovd = await overflow(L.page); ok("Evidence screen has no horizontal overflow at 390px", ovd.sw <= ovd.cw, JSON.stringify(ovd));
await shot(L.page, "390-evidence");

/* ── K · PROGRESS ── */
console.log("\nK · PROGRESS");
const prog = await L.page.evaluate(() => { go("review"); const ps = [...document.querySelectorAll(".pg-v2")]; const d = window.v2Evidence();
  return { panels: ps.length, txt: ps.map(p => p.innerText.replace(/\s+/g, " ")).join(" || "), comps: d.map(x => x.competency + ":" + x.state), weeks: d.map(x => x.week).join(), moves: d.map(x => (x.byMove || []).length).join(), last: d[d.length - 1] }; });
const spokenComps = PACK.competencies.filter(c => c.week <= WEEK);
ok("K6 · Progress renders every spoken competency oldest week first — seven panels in canonical order, each with its own move count — ordering and counts come from the data",
  prog.panels === spokenComps.length && prog.panels === 7 && prog.weeks === spokenComps.map(c => c.week).join() && prog.moves === spokenComps.map(c => c.moves.length).join() && prog.comps[spokenComps.length - 1] === ID + ":TRANSFER_READY", JSON.stringify({ p: prog.panels, w: prog.weeks, m: prog.moves, c: prog.comps }));
ok("K7 · The Week 7 panel names its week, its state and its own moves through the same evidence contract",
  /Week 7/.test(prog.txt) && /Say where you differ/.test(prog.txt) && /Close on the shared goal/.test(prog.txt) && prog.last.week === WEEK && prog.last.attempts === 3 && prog.last.passed === 2 && prog.last.transferPassed === 1 && prog.last.pron === 83 && prog.last.pronSource === "audio" && prog.last.shadow.linked === 1, JSON.stringify({ w: prog.last.week, a: prog.last.attempts, p: prog.last.passed, sh: prog.last.shadow }));
const ovp = await overflow(L.page); ok("Progress has no horizontal overflow at 390px with seven panels", ovp.sw <= ovp.cw, JSON.stringify(ovp));
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
  ok(`K8 · With everything before it resting, Home's one card is ${c.id} (Week ${c.week}); resting it makes it transfer-ready`, new RegExp("Week " + c.week, "i").test(step.offered) && step.state === "TRANSFER_READY", JSON.stringify(step));
}
const afterAll = await L.page.evaluate(() => { go("home"); return { n: document.querySelectorAll(".mv-home").length, card: !!document.querySelector(".mv-home") }; });
ok("K8 · With every competency resting, Home shows no V2 card and looks as it did before V2 — the old advice stands", afterAll.n === 0 && afterAll.card === false, JSON.stringify(afterAll));
const voc = await L.page.evaluate(id => Object.entries(areaVocab()).filter(([, v]) => v.src && v.src.v2 === id).map(([w]) => w), ID);
ok("K9 · Week 7 expressions were acquired automatically, tagged to Week 7", voc.length > 0 && voc.every(w => W7.expressions.some(e => e.w === w)), JSON.stringify(voc));

/* ── I · ANALYTICS ── */
console.log("\nI · ANALYTICS");
const ev = await L.page.evaluate(id => (window.__ev || []).filter(e => e[0].startsWith("v2_") && e[1].competency === id).map(e => [e[0], e[1].track, e[1].week, e[1].competency, e[1].mission]), ID);
ok("I1 · every Week 7 analytics event carries track general-english, week '7' and competency disagree-pushback",
  ev.length >= 10 && ev.every(e => e[1] === GE && e[2] === String(WEEK) && e[3] === ID), JSON.stringify(ev.slice(0, 4)));
const evNames = [...new Set(ev.map(e => e[0]))];
const ALL11 = ["v2_mission_started", "v2_mission_heard", "v2_speak_attempt", "v2_coach_generated", "v2_evidence_recorded", "v2_retry_attempt", "v2_transfer_started", "v2_transfer_completed", "v2_competency_progressed", "v2_retrieval_scheduled", "v2_recommendation_generated"];
ok("I2 · the loop emitted only the existing v2_* names for Week 7 — all eleven, and no new name", ALL11.every(n => evNames.includes(n)) && evNames.every(n => ALL11.includes(n)), evNames.join());
const evProps = await L.page.evaluate(() => (window.__ev || []).filter(e => e[0].startsWith("v2_")).map(e => e[1]));
ok("I3 · every prop key is one the Worker's v2 column map already carries", evProps.every(p => Object.keys(p).every(k => ["track", "week", "competency", "mission", "kind", "move", "result", "band", "state", "from", "attempt", "ai"].includes(k))));
ok("I4 · the move and mission values are Week 7's own enums — a mission event carries a Week 7 move, the Shadow-support event carries a rung — and a progression carries from/state",
  evProps.filter(p => p.competency === ID).every(p => p.mission === "shadow"
    ? (p.kind === "shadow" && (!p.move || p.move === "none" || ME.SHADOW_RUNGS.includes(p.move)))
    : ((!p.move || ["acknowledge", "disagree", "reason", "alternative", "align", "none"].includes(p.move)) && (!p.mission || new RegExp("^" + ID + "-(guided|transfer)$").test(p.mission))))
  && evProps.some(p => p.competency === ID && p.mission === "shadow" && p.kind === "shadow" && p.move === "blind")
  && evProps.some(p => p.state === "TRANSFER_READY" && p.from === "DEMONSTRATED"), JSON.stringify(evProps.filter(p => p.competency === ID && p.mission === "shadow")));
const pii = JSON.stringify(evProps);
ok("I5 · no event carries a transcript, the profile name or the goal", !/portal|payment|warehouse|checkout|\"T\"|confidence in meetings/i.test(pii));
const nonV2 = await L.page.evaluate(() => (window.__ev || []).map(e => e[0]).filter(n => !n.startsWith("v2_")));
ok("I6 · the mission emitted no V1 session_complete and no Welding event", !nonV2.includes("session_complete") && !nonV2.some(n => /workshop|weld/.test(n)), nonV2.join());

/* ── CLOUD MERGE ── */
console.log("\nG · CLOUD MERGE (app)");
const merged = await L.page.evaluate(({ SAY, id, week }) => {
  const c = mvComp(id), g = MissionEngine.missionOf(c, id + "-guided");
  const meta = { competency: c.id, week: c.week, moveIds: MissionEngine.moveIds(c) };
  const att = (key, text, at) => Object.assign(MissionEngine.grade(c, g, text, { seconds: 20 }), { key, kind: "guided", missionId: g.id, at });
  const local = JSON.parse(JSON.stringify(S)), cloud = JSON.parse(JSON.stringify(S));
  local.v2A = { "general-english": {} }; cloud.v2A = { "general-english": {} };
  const IV = trackVocabularyIntervals();
  MissionEngine.introduce(local.v2A["general-english"], c.id, areaId(), 1e12);
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("a", SAY.noDisagree, 1e12 + 1), areaId(), IV, meta);
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.introduce(cloud.v2A["general-english"], c.id, areaId(), 1e12 + 5);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("c", SAY.noAcknowledge, 1e12 + 3), areaId(), IV, meta);
  const m = fbMerge(local, cloud); const r = m.v2A["general-english"][id];
  const pr = fbSyncPayload(m).v2A["general-english"][id];
  return { keys: r.attempts.map(a => a.key).join(), state: r.state, introducedAt: r.introducedAt, saidLocal: r.attempts.every(a => typeof a.said === "string" && a.said.length > 0), saidCloud: pr.attempts.every(a => !("said" in a)), weeks: r.attempts.every(a => a.week === week && a.competency === id), buckets: Object.keys(m.v2A).join() };
}, { SAY, id: ID, week: WEEK });
ok("G · Two devices' Week 7 attempts union on the idempotency key (a, b, c — b once); state is recomputed; introducedAt is the earliest",
  merged.keys === "a,b,c" && merged.state === "DEMONSTRATED" && merged.introducedAt === 1e12, JSON.stringify(merged));
ok("G · The learner's words stay on the device and are stripped from the sync payload; every row is week 7 / disagree-pushback; no Welding bucket", merged.saidLocal && merged.saidCloud && merged.weeks && merged.buckets === "general-english");

/* ── DESKTOP ── */
console.log("\nUI · DESKTOP");
const Dk = await learner("desk", GE, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
await restBefore7(Dk.page);
const dkHome = await Dk.page.evaluate(async () => { go("home"); await new Promise(r => setTimeout(r, 300)); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, o: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth } }; });
ok("Desktop: Home offers the Week 7 card with no horizontal overflow", dkHome.n === 1 && /Week 7/i.test(dkHome.eyebrow || "") && dkHome.o.sw <= dkHome.o.cw, JSON.stringify(dkHome));
await shot(Dk.page, "1280-home");
const dk = await Dk.page.evaluate(async id => {
  const o = () => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth });
  mvGo(id + "-guided", "see"); await new Promise(r => setTimeout(r, 300)); const o0 = o();
  mvStep("hear"); await new Promise(r => setTimeout(r, 300)); const oh = o(), play = document.querySelectorAll(".mv-play button").length;
  mvStep("notice"); await new Promise(r => setTimeout(r, 400)); const o1 = o(), moves = document.querySelectorAll(".mv-list li").length, shadow = !!document.querySelector(".mv-shadow");
  mvStep("speak"); await new Promise(r => setTimeout(r, 300)); const o2 = o(), cta = document.querySelectorAll("#v-mission .rec-btn").length;
  return { o0, oh, play, o1, o2, moves, shadow, cta }; }, ID);
ok("Desktop: SEE, HEAR (two play buttons), NOTICE (five moves + Shadow row) and SPEAK (one recorder) render with no horizontal overflow",
  dk.play === 2 && dk.moves === 5 && dk.shadow === true && dk.cta === 1 && [dk.o0, dk.oh, dk.o1, dk.o2].every(x => x.sw <= x.cw), JSON.stringify(dk));
await shot(Dk.page, "1280-speak");
coachCovered = ["acknowledge", "reason", "alternative", "align"];
await Dk.page.evaluate(t => { window.__say = t; }, SAY.noDisagree);
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
ok("Desktop: RETRY names the missing move with no overflow", dkRetry.step === "speak" && /state your actual position/i.test(dkRetry.text || "") && dkRetry.sw <= dkRetry.cw);
coachCovered = ["acknowledge", "disagree", "reason", "alternative", "align"];
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
ok("Desktop: PROGRESS renders one panel per spoken competency (seven) with no overflow", dkProg.panels === spokenComps.length && dkProg.sw <= dkProg.cw, JSON.stringify(dkProg));
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
ok("Offline: attempt, transcript and audio survive; evidence is correct and was computed on the device before any network call", e1.n === 1 && e1.said && e1.audio === 1 && e1.cov === 1 && e1.state === "DEMONSTRATED", JSON.stringify(e1));
ok("Offline: coaching is pending; the deterministic fallback is shown; pronunciation is null, not 0", e1.pending === true && e1.offline === true && e1.pron === null, JSON.stringify(e1));
const dupe = await O.page.evaluate(id => { const c = mvComp(id); const before = mvStore()[id].attempts.length; mvCommit(c, _mv.ev, _mv.coach); mvCommit(c, _mv.ev, _mv.coach); return { before, after: mvStore()[id].attempts.length, key: _mv.ev.key }; }, ID);
ok("Offline: replaying the same spoken turn twice writes nothing more — one turn, one row", dupe.before === 1 && dupe.after === 1 && dupe.key === e1.key, JSON.stringify(dupe));
coachMode = "ok"; coachCovered = ["acknowledge", "disagree", "reason", "alternative", "align"];
await O.page.evaluate(() => mvFinishCoaching());
await O.page.waitForFunction(() => _mv && !_mv.busy, null, { timeout: 12000 }).catch(() => {});
await sleep(300);
const e3 = await O.page.evaluate(id => { const r = mvStore()[id]; return { n: r.attempts.length, pending: r.attempts[0].coachPending, ai: _mv.coach && _mv.coach.ai, state: r.state }; }, ID);
ok("Offline: recovery completes the coaching and creates no second piece of evidence; the Worker was called again", e3.n === 1 && e3.pending === false && e3.ai === true && e3.state === "DEMONSTRATED" && polishHits > hits0 + 1, JSON.stringify(e3));

/* ── J · WELDING ── */
console.log("\nJ · WELDING ISOLATION (app)");
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
  const bucketsBefore = Object.keys(S.v2A || {}).join(), weldRowsBefore = Object.keys(((S.v2A || {}).welding) || {}).length;
  /* a Welding learner shadowing the SAME clip generates no General English
     evidence. Same shape as the integration suite: harvested === 0 and no
     record appears. (Calling the harvester by hand off General English does
     create an EMPTY per-area container through areaBucket — no rows, and no
     UI path reaches the harvester on Welding — so the container is not
     counted as evidence here; see the suite notes.) */
  aList("chHist").unshift({ kind: "challenge", ts: Date.now(), vid, title: "clip", rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" }, issues: [], drills: [] }); save();
  const harvested = mvHarvestShadow();
  const cur7 = activeCurriculum();
  go("review"); await new Promise(r => setTimeout(r, 300));
  return { area: areaId(), comps: mvComps().length, comp: mvComp(id), missions: cur7.missions, card, homeMentions: /Disagreeing professionally|Say where you differ|Acknowledge their point|Close on the shared goal/i.test(homeTxt), view, html: (html || "").length,
    refused, harvested, unchanged, weldRows: weldRowsBefore, buckets: bucketsBefore, weldRowsAfter: Object.keys(((S.v2A || {}).welding) || {}).length, ev: window.v2Evidence(), rec: window.v2Recommendation(),
    panel: !!document.querySelector(".pg-v2"), events: (window.__ev || []).filter(e => e[0].startsWith("v2_")).length,
    weeks: (cur7.weeks || []).length, sims: (cur7.simulations || []).length, stage: (cur7.weeks[0] || {}).stage };
}, { id: ID, vid: CLIP, week: WEEK });
ok("J1 · Welding's curriculum resolves missions to null — Week 7 does not reach it through inheritance", w.area === "welding" && w.missions === null && w.comps === 0 && w.comp === null, JSON.stringify({ a: w.area, m: w.missions, c: w.comps }));
ok("J2 · no V2 card and no Week 7 title or move wording on the Welding home", w.card === false && w.homeMentions === false);
ok("J3 · routing straight to the Week 7 mission turns a Welding learner around safely", w.view === "home" && w.html === 0, JSON.stringify({ v: w.view, len: w.html }));
ok("J4 · the engine refuses to write Week 7 evidence for a Welding learner; no Welding bucket is created", w.refused && w.unchanged && w.weldRows === 0 && !/welding/.test(w.buckets));
ok("J5 · no Week 7 analytics can be emitted from Welding, even with the competency passed in by hand", w.events === 0, String(w.events));
ok("J6 · both hooks return null and the Welding Progress page shows no V2 panel", w.ev === null && w.rec === null && w.panel === false);
ok("J7 · a Welding learner shadowing Week 7's clip harvests nothing — no support row, no record", w.harvested === 0 && w.weldRowsAfter === 0, JSON.stringify({ h: w.harvested, rows: w.weldRowsAfter }));
ok("J8 · existing Welding curriculum is unchanged: 12 stages, 12 simulations", w.weeks === 12 && w.sims === 12 && /Stage 1/.test(w.stage || ""), JSON.stringify({ w: w.weeks, s: w.sims }));

ok("No uncaught page errors in any context", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
