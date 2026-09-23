/* BE Mastery V2.11 — General English Week 11 "Persuasion & stakeholder
   influence", end to end, and the data-only proof.

   Week 11 is the ELEVENTH competency and it arrived as one entry in
   tracks/general/missions.json. This suite is the claim that nothing else had
   to change: the engine, the evidence contract, the state machine, the
   retrieval, the recommendation, the coach boundary, the Home card, the
   Progress panel, the cloud merge, the Shadow decision and the Welding wall
   all behave for a competency they had never seen.

   The five moves are STAKE → COST OF INACTION → EVIDENCE → RETURN → ASK.
   They come from the curriculum's own Week 11 phrase bank: "What's at stake
   here is…", "The cost of delay is…", "The data supports…", "The return on
   doing this now is…", "Here's what I need from you…".

   THE WEEK 6 LINE, which this suite spends a whole section on. Week 6 is
   "Recommendations & decision language": OPTIONS → RECOMMENDATION → REASON →
   TRADE-OFF → NEXT STEP — a structured choice handed to a decision-maker.
   Week 11 is influence: one case, built on what the LISTENER already owns,
   with a price on doing nothing, evidence behind it, a return, and an ask
   inside a window. No options are laid out here, nothing is "recommended"
   and no trade-off is named — and Week 6's own model answer earns exactly
   nothing on this rubric, which section F proves cue by cue.

   Canonical numbering: the `week` of a competency is the General English
   programme week it teaches — Week 11 is "Persuasion & stakeholder influence"
   in weeks.json. See the _note in missions.json.

   Run:  cd tests && node mission-win-support.mjs
         SHOTS=/some/dir node mission-win-support.mjs   (also saves screenshots) */
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

const ID = "win-support";
const WEEK = 11;
const by = id => ME.competencyOf(PACK, id);
const W1 = by("explain-work"), W2 = by("clear-update"), W3 = by("raise-problem"), W4 = by("clarify-confirm"), W5 = by("explain-tech"), W6 = by("recommend-decide"), W7 = by("disagree-pushback"), W8 = by("sprint-coordinate"), W9 = by("exec-summary"), W10 = by("sell-experience");
const W11 = by(ID);
const guidedOf = c => (c.missions || []).find(m => m.kind === "guided"), transferOf = c => (c.missions || []).find(m => m.kind === "transfer");
const G1 = guidedOf(W1), G6 = guidedOf(W6), G9 = guidedOf(W9), G10 = guidedOf(W10);
const G11 = W11 && ME.missionOf(W11, ID + "-guided"), T11 = W11 && ME.missionOf(W11, ID + "-transfer");
const IV = [1, 3, 7, 21, 60];
const GE = "general-english";
const MOVES = "stake,cost,evidence,return,ask";
const LABELS = "Name what's at stake for them,Give the cost of doing nothing,Back it with evidence,Show the return,Ask, and say why now";
const meta = c => ({ competency: c.id, week: c.week, moveIds: ME.moveIds(c) });
const mk = (c, m, text, kind, key, at) => Object.assign(ME.grade(c, m, text, { seconds: 27 }),
  { key, kind, at: at || Date.now(), missionId: m.id });

/* ── what the learners will say ──────────────────────────────────────────── */
const SAY = {
  strong: G11 && G11.hear.model,
  /* the classic engineer's pitch: all about the problem, nothing about the director's launch */
  noStake: "The cost of delay is roughly forty-seven thousand a quarter: that is what finance raised in credit notes last quarter on three hundred and forty orders that went out at the wrong price. This isn't a guess — we audited five hundred items by hand and eleven per cent of the prices were wrong, and the credit-note log says the same thing from the other side. Two engineers for one quarter costs about sixty thousand, so it pays for itself within about four months. Here's what I need from you: those two engineers for this quarter, not the next one. The window to act is before the pricing build starts in January.",
  /* the case with no price on doing nothing */
  noCost: "What's at stake here is the pricing launch itself. It lands on a catalogue that is wrong about one time in nine, so the feature you want most is the one that breaks first. This isn't a guess — we audited five hundred items by hand and eleven per cent of the prices were wrong, and the credit-note log says the same thing from the other side. Two engineers for one quarter costs about sixty thousand, so it pays for itself within about four months, and we keep that every quarter after. Here's what I need from you: those two engineers for this quarter, not the next one. The window to act is before the pricing build starts in January.",
  /* 'everyone knows' — assertion where the evidence should be */
  noEvidence: "What's at stake here is the pricing launch itself. It lands on a catalogue that is wrong about one time in nine, so the feature you want most is the one that breaks first. The cost of delay is roughly forty-seven thousand a quarter in credit notes on orders that went out at the wrong price. Everyone knows the catalogue is a mess, and I think it is getting worse. Two engineers for one quarter costs about sixty thousand, so it pays for itself within about four months. Here's what I need from you: those two engineers for this quarter, not the next one. The window to act is before the pricing build starts in January.",
  /* a bill with no payback — the ask sounds like pure cost */
  noReturn: "What's at stake here is the pricing launch itself. It lands on a catalogue that is wrong about one time in nine, so the feature you want most is the one that breaks first. The cost of delay is roughly forty-seven thousand a quarter in credit notes. This isn't a guess — we audited five hundred items by hand and eleven per cent of the prices were wrong, and the credit-note log says the same thing. Two engineers for one quarter would cost about sixty thousand pounds in total. Here's what I need from you: those two engineers for this quarter, not the next one. The window to act is before the pricing build starts in January.",
  /* the whole case, then trails off without asking for anything */
  noAsk: "What's at stake here is the pricing launch itself. It lands on a catalogue that is wrong about one time in nine, so the feature you want most is the one that breaks first. The cost of delay is roughly forty-seven thousand a quarter in credit notes on three hundred and forty orders. This isn't a guess — we audited five hundred items by hand and eleven per cent of the prices were wrong, and the credit-note log says the same thing from the other side. Two engineers for one quarter costs about sixty thousand, so it pays for itself within about four months, and we keep forty-seven thousand every quarter after that. It would be good to sort the catalogue out sometime soon, really.",
  transfer: "What's at stake here is your output per shift, because the line is going to stop either way — the only question is whether we choose when. The cost of doing nothing is five unplanned breakdowns in six months at about nine hours each, so forty-five hours of lost packing against sixteen for a planned stop. I'm confident because we have six months of readings on that gearbox and it is the same rising pattern that ran before the last two failures; the bearing supplier's own data gives it about three months before it seizes. Two planned days buys us back the twenty-nine hours we are losing to breakdowns, and it pays for itself the first time it stops one. Here's what I need from you: two days in the quiet fortnight in November. The window to act is before December, because we cannot stop the line in peak and the gearbox warranty is gone at the end of the month.",
  transferWeak: "The cost of doing nothing is five unplanned breakdowns in six months at about nine hours each, so forty-five hours of lost packing against sixteen for a planned stop. I'm confident because we have six months of readings on that gearbox and it is the same rising pattern that ran before the last two failures; the bearing supplier's own data gives it about three months before it seizes. Two planned days buys us back the twenty-nine hours we are losing to breakdowns, and it pays for itself the first time it stops one. Here's what I need from you: two days in the quiet fortnight in November. The window to act is before December, because we cannot stop the line in peak and the gearbox warranty is gone at the end of the month.",
  /* browser speech recognition usually returns one unpunctuated run */
  unpunctuated: G11 && G11.hear.model.toLowerCase().replace(/[—:,.?;]/g, "").replace(/\s+/g, " "),
  /* influence vocabulary with no case inside it */
  jargon: "Persuasion, influence, stakeholders, buy-in, business case, value, alignment, urgency — that is the framework for influencing.",
  short: "Fine.",
  seven: "The cost of delay is about ten",
  eight: "The cost of delay is about ten thousand",
};
/* Weeks 1–10, to put them to rest when the question is whether Week 11 waits
   its turn. Keyed by competency id so both the engine cases and the browser
   cases walk the pack rather than a numbered list. */
const REST = {
  "explain-work": { guided: G1.hear.model, transfer: "I am a project coordinator on the delivery team. I look after the schedule and the supplier paperwork for your account. Right now I am preparing the plan for your first shipment. I work closely with our warehouse and your logistics contact, so that nothing on your side has to be chased by hand." },
  "clear-update": { guided: "The project is on track and we have completed two stages. We have run into an issue with the design agency. This means Friday delivery is at risk by about two days. I will chase it up today and come back to you tomorrow.", transfer: "Installation is due to start on Monday and everything else is ready. The materials from the supplier arrived three days late. That means we will push back the handover and the end of month promise is at risk. I will confirm a new date with the customer and come back to you this afternoon." },
  "raise-problem": { guided: guidedOf(W3).hear.model, transfer: "There is a problem with the monthly figures. It started when the old report was switched off in August, so two months of numbers may be wrong. This means the Thursday board pack is at risk. I have spoken to finance and asked them to rerun the numbers. Could you sign off on a one-day delay so we can check them?" },
  "clarify-confirm": { guided: guidedOf(W4).hear.model, transfer: "Sorry, I'm not sure I follow — the client thing could be two things. Are you asking about the revised quote or the delivery date they wanted? So you're saying it's the quote they're expecting before Wednesday's review. Then I'll send the quote today and come back to you tomorrow on the delivery date — does that work?" },
  "explain-tech": { guided: guidedOf(W5).hear.model, transfer: "In plain terms, the integration is a link between their shop and our warehouse. The way it works is that every time a customer places an order, it goes straight to the warehouse system automatically, instead of someone typing it in each morning. What this means for the client is that orders ship the same day and the typing mistakes stop. The one thing to remember is that returns aren't included yet — those are still done by hand. Does that make sense?" },
  "recommend-decide": { guided: G6.hear.model, transfer: "There are two options here. One option is to send it tomorrow with the numbers corrected by hand, and the other option is to hold it for two days and rerun everything from the fixed source. My recommendation is to hold it. The reason is that last quarter they complained about a wrong figure, and two of the twelve charts can't be checked in time if we send tomorrow. The downside is that it's the first late report we've ever sent them. So the next step is that you tell the client today that it's coming on Thursday, and I'll rerun it as soon as the source is fixed." },
  "disagree-pushback": { guided: guidedOf(W7).hear.model, transfer: "I understand why the director wants one go — a phased move takes longer, and nobody wants this dragging into next year. I'd push back on doing the whole warehouse in one weekend, though. The reason is the pilot: at the small depot the switch took two weeks to settle, forty stock counts were wrong in the first week, and the main warehouse holds twenty times the stock. What I'd suggest is that we switch the night team first, since they're already trained, and bring the day shifts across two weeks later. We both want this done before December, and that way we still finish by the end of November without a weekend where nothing can be counted. What would the director need to see to agree to that?" },
  "sprint-coordinate": { guided: guidedOf(W8).hear.model, transfer: "The landing page is built and both banner variants are ready to test. The sign-up form is blocked: the dependency is legal's review of the prize-draw terms — they've had them since Monday and said end of week. Without approved terms the form can't go live, so the first is at risk for sign-ups. To keep the launch on track, I'd go out on the first with the newsletter and no prize draw, and add the draw the week after when legal comes back. Could you ping the head of legal today and let me know by Thursday? If the terms land by Thursday, the form is live for the first; either way the newsletter goes out on the first." },
  "exec-summary": { guided: G9.hear.model, transfer: "The short version: the savings programme reaches its 400 thousand target this year only if we close the third supplier, and that needs a decision from you before Friday. At a high level, two of the four contracts are signed, worth 260 thousand, and the fourth signs next month for another 60. The biggest risk is the third supplier — 110 thousand of the target — where the negotiation has stalled for three weeks on payment terms: they want 60 days, our standard is 45. Finance can live with 60 days if you agree, and their offer lapses on Friday. The decision I need from you is whether we accept 60-day terms to close it this week. The key takeaway: without the third contract we land at 320, short of target; with it, we're over." },
  "sell-experience": { guided: G10.hear.model, transfer: "The challenge was that our forty field engineers were driving two hours forty a day between jobs. Overtime was thirty per cent over budget, and two engineers had resigned because of the driving. Nobody had looked at routing since the company doubled in size, so I led the effort to fix it. I pulled the last three months of job data with an analyst from the planning team, and we found jobs were assigned by who was free, not by where they were. The dispatchers were worried customers would wait longer, so I influenced the decision by asking the director for one region and six weeks, with waiting times measured too. The result was that driving fell to an hour fifty and overtime came back within budget, and waiting times didn't move. It's now live in all four regions. That experience taught me that I do my best work where data and persuasion meet, and that's the role I'm looking for next." },
};
const W1_NO_WHY = "I work as an operations analyst in the logistics team. I'm responsible for the weekly delivery reports. At the moment I'm rebuilding how we track late shipments. I work closely with the warehouse managers.";
/* cold transfers for any competency after Week 11, keyed by id — a new week adds one entry */
SAY.transfers = {};
const EARLIER = PACK.competencies.filter(c => c.week < WEEK).sort((a, b) => a.week - b.week);
const LATER = PACK.competencies.filter(c => c.week > WEEK).sort((a, b) => a.week - b.week);

/* ═══════════ A · PACK / CURRICULUM IDENTITY ════════════════════════════ */
console.log("\nA · THE PACK");
ok("A · Week 11 exists, is numbered 11, carries the canonical title, five moves and two missions",
  W11 && W11.week === WEEK && W11.title === "Persuasion & stakeholder influence" && ME.moveIds(W11).join() === MOVES && W11.missions.length === 2, W11 && ME.moveIds(W11).join());
ok("A · The title is weeks.json's own Week 11 theme, word for word, and the goal is its goal; the numbering is consecutive from 1 with Week 11 eleventh — whatever the count",
  WEEKS.find(w => w.n === WEEK).theme === W11.title && WEEKS.find(w => w.n === WEEK).goal === "Move from reporting to influencing." && PACK.competencies.map(c => c.week).join() === PACK.competencies.map((_, i) => i + 1).join() && PACK.competencies[WEEK - 1].id === ID, WEEKS.find(w => w.n === WEEK).theme);
ok("A · The competency id is semantic, like the ten before it — not derived from the week number",
  /^[a-z]+-[a-z]+$/.test(W11.id) && !/11|eleven|week/.test(W11.id) && PACK.competencies.every(c => /^[a-z]+-[a-z]+$/.test(c.id)));
ok("A · Every earlier competency the suite rests on has a fixture here, keyed by id", EARLIER.length === WEEK - 1 && EARLIER.every(c => REST[c.id] && REST[c.id].guided && REST[c.id].transfer), EARLIER.map(c => c.id).join());
ok("A · The pack note records Week 11, its move order, the Shadow decision and the Week 6 line — and still records Weeks 9 and 10",
  /Week 11/.test(PACK._note) && /stake → cost → evidence → return → ask/.test(PACK._note) && /no shadow block/.test(PACK._note) && /NOT Week 6/.test(PACK._note)
  && /Week 10/.test(PACK._note) && /situation → own → action → result → lesson/.test(PACK._note) && /Week 9/.test(PACK._note) && /headline → signpost → risk → decision → land/.test(PACK._note));
ok("A · The objective is written as influence, not as reporting or recommending",
  /influencing/.test(W11.objective) && /at stake/.test(W11.objective) && /cost of doing nothing/.test(W11.objective) && /return/.test(W11.objective) && !/options/.test(W11.objective) && !/trade-off/i.test(W11.objective));
ok("A · The guided mission loads with the situation, the model, the prompt and the context",
  G11 && G11.kind === "guided" && G11.see && G11.see.where && G11.see.who && G11.see.asks && G11.see.goal && G11.hear && G11.hear.model && G11.hear.note && G11.prompt === G11.see.asks && G11.context);
ok("A · The transfer mission loads: a different stakeholder, context, facts, constraint and objective, no model to copy",
  T11 && T11.kind === "transfer" && !T11.hear && T11.prompt !== G11.prompt && T11.see.who !== G11.see.who && /stop the line/i.test(T11.prompt) && !/catalogue|pricing|credit note|engineers for/i.test(T11.context) && !/gearbox|packing line|shutdown|plant/i.test(G11.context));
ok("A · Both situations carry a stakeholder with a COMPETING interest, not a neutral requester",
  /wants the new pricing feature/i.test(G11.see.where) && /revenue target/i.test(G11.see.who) && /will not appear in any demo/i.test(G11.see.where)
  && /has never approved a planned stop/i.test(T11.see.where) && /a stopped line is a lost line/i.test(T11.see.who));
ok("A · Both situations supply the stake, the cost of inaction, the evidence, the return and the window — the learner invents nothing",
  /12,000 items/.test(G11.context) && /340 orders/.test(G11.context) && /£47,000 in credit notes/.test(G11.context) && /quarterly figure/.test(G11.context) && /audited 500 catalogue items/.test(G11.context) && /11 per cent/.test(G11.context) && /£60,000/.test(G11.context) && /built in January/.test(G11.context) && /measured on revenue/.test(G11.context)
  && /5 times in the last six months/.test(T11.context) && /9 hours each/.test(T11.context) && /45 hours/.test(T11.context) && /16 hours/.test(T11.context) && /six months of vibration readings/i.test(T11.context) && /three months before it seizes/.test(T11.context) && /measured on output per shift/.test(T11.context) && /warranty/.test(T11.context) && /November has two quiet weeks/.test(T11.context));
ok("A · The goal names the week's own bar — influence, not a recommendation — and the transfer says nobody is prompting",
  /Don't list options and don't just recommend/.test(G11.see.goal) && /what's at stake for them/i.test(G11.see.goal) && /while the window is open/i.test(G11.see.goal)
  && /Nobody is prompting you/i.test(T11.see.goal) && /in his own units/i.test(T11.see.goal));
ok("A · Exactly five moves, each with an id, a label, a hint, at least 30 phrase cues, a retry line, three patterns and a cue note",
  W11.moves.length === 5 && W11.moves.every(m => m.id && m.label && m.hint && Array.isArray(m.cues) && m.cues.length >= 30 && m.retry && Array.isArray(m.patterns) && m.patterns.length === 3 && typeof m._cue_note === "string"));
ok("A · The move labels are observable behaviours, not outcomes", W11.moves.map(m => m.label).join() === LABELS && !W11.moves.some(m => /persuasive|convincing|influential|compelling|confiden|effective/i.test(m.label)));

/* ═══════════ B · CUE STRUCTURE ═════════════════════════════════════════ */
console.log("\nB · CUE STRUCTURE");
ok("B · Every cue is lowercase and unique within its move, and no cue of one move is contained in a cue of another",
  W11.moves.every(m => new Set(m.cues).size === m.cues.length && m.cues.every(q => q === q.toLowerCase()))
  && W11.moves.every((a, i) => W11.moves.every((b, j) => i === j || a.cues.every(x => b.cues.every(y => !x.includes(y))))));
ok("B · No Week 11 cue is shared, exactly, with any cue of the ten earlier competencies — the collision surface is zero",
  (() => { const old = new Set(); EARLIER.forEach(c => c.moves.forEach(m => m.cues.forEach(q => old.add(q))));
    const clash = []; W11.moves.forEach(m => m.cues.forEach(q => { if (old.has(q)) clash.push(m.id + ":" + q); }));
    return clash.length === 0; })(),
  (() => { const old = new Set(); EARLIER.forEach(c => c.moves.forEach(m => m.cues.forEach(q => old.add(q)))); return W11.moves.flatMap(m => m.cues.filter(q => old.has(q))).join(" | "); })());
ok("B · No cue is a bare word or a bare frame: 'at risk', 'the trade-off is', 'the cost of that', 'cost us', 'the data shows', 'the evidence is', 'based on', 'i recommend', 'what i need from you', 'your approval', 'the next step', 'it saves', 'the upside is', 'soon', 'important', 'urgent' never appear as cues",
  W11.moves.every(m => m.cues.every(c => !["at risk", "the trade-off is", "the tradeoff", "the cost of that", "cost us", "the data shows", "the data show", "the evidence is", "the evidence shows", "based on", "based on the", "i recommend", "i'd recommend", "my recommendation is", "what i need from you", "i need you to", "your approval", "sign off", "the next step", "next step", "if you agree", "it saves", "saves us", "the upside is", "the benefit is", "the value is", "what this means for", "soon", "important", "urgent", "the main risk", "value", "stake", "cost", "return", "evidence", "ask"].includes(c))));
ok("B · Every Week 11 expression is tagged to a move that exists, and all eight come from the curriculum's own Week 11 'Persuasion & Influence' phrases",
  W11.expressions.length === 8 && W11.expressions.every(e => ME.moveIds(W11).includes(e.move) && e.w && e.def && e.l)
  && W11.expressions.filter(e => PHRASES.phrases.some(p => p.w === WEEK && p.c === "Persuasion & Influence" && AE.hits(p.p, e.w))).length === 8, JSON.stringify(W11.expressions.map(e => e.w)));
ok("B · The bank's 'The reason I'm recommending this now is…' is deliberately NOT an expression — its recommending half is Week 6's move and only its timing half is Week 11's — but it is an 'ask' cue, so a learner who says it still earns the move",
  !W11.expressions.some(e => /recommending/i.test(e.w)) && PHRASES.phrases.some(p => p.w === WEEK && /The reason I'm recommending this now/.test(p.p))
  && ME.moveOf(W11, "ask").cues.includes("the reason i'm recommending this now")
  && !W6.expressions.some(e => W11.expressions.some(x => x.w.toLowerCase() === e.w.toLowerCase())));
ok("B · 'The window to act is…' is likewise a cue rather than an expression, and both live on the ask move",
  ME.moveOf(W11, "ask").cues.includes("the window to act") && PHRASES.phrases.some(p => p.w === WEEK && /The window to act/.test(p.p)) && !W11.expressions.some(e => /window/i.test(e.w)));
ok("B · The cue decisions are written down: Week 5's 'what this means for you', Week 2/3/8's 'at risk', Week 6's 'the trade-off is' and 'the data shows', Week 10's 'I measured', Week 3's 'could you' and Week 9's 'I need a decision' are each named as non-evidence for the moves they do not prove",
  (() => { const s = ME.moveOf(W11, "stake")._cue_note, c = ME.moveOf(W11, "cost")._cue_note, e = ME.moveOf(W11, "evidence")._cue_note, r = ME.moveOf(W11, "return")._cue_note, a = ME.moveOf(W11, "ask")._cue_note;
    return /what this means for you/.test(s) && /at risk/.test(s) && /the main risk is/.test(s) && /never passes/.test(s)
      && /the trade-off is/.test(c) && /the cost of that/.test(c) && /cost us/.test(c)
      && /the data shows/.test(e) && /based on/.test(e) && /I measured/.test(e)
      && /it saves us/.test(r) && /the upside is/.test(r) && /we saved/.test(r)
      && /could you/.test(a) && /if you agree, the next step is/.test(a) && /I need a decision by/.test(a); })());

/* ═══════════ C · MOVE GRADING ══════════════════════════════════════════ */
console.log("\nC · MOVE GRADING");
const padded = t => t + " and a few more words to reach the minimum";
const made = e => Object.keys(e.moves).filter(k => e.moves[k]).join();
const grade = (t, s = 8) => ME.grade(W11, G11, t, { seconds: s });
const only = (text, m) => made(grade(text)) === m;
const none = text => grade(text).coverage === 0;
ok("C · Each move's own patterns credit that move and only that move", W11.moves.every(m => m.patterns.every(pt => only(padded(pt), m.id))), W11.moves.map(m => m.id + ":" + m.patterns.map(pt => made(grade(padded(pt)))).join("/")).join(" "));
ok("C · Each expression, when spoken, credits the move it is tagged to — and only that move — and counts as vocabulary used",
  W11.expressions.every(x => { const e = grade(padded(x.w), 5); return e.moves[x.move] === true && made(e) === x.move && e.vocabUsed.includes(x.w); }));
ok("C · One line each: a stake, a cost of inaction, an evidence line, a return, an ask",
  only(padded("What's at stake here is your renewal in March"), "stake") && only(padded("The cost of delay is about ten thousand a month"), "cost")
  && only(padded("We audited five hundred items and eleven per cent were wrong"), "evidence") && only(padded("It pays for itself within about four months"), "return")
  && only(padded("Here's what I need from you: two engineers"), "ask"));
const gm = grade(SAY.strong, 90);
ok("C · The model answer makes all five moves on its own rubric, in the taught order, with sentences a listener can follow, and uses at least three of the curriculum's own expressions",
  gm.coverage === 1 && ME.passes(gm) && gm.clarity === 1 && gm.clarityBasis === "order+length" && gm.vocabUsed.length >= 3, "missed=" + gm.missed.join() + " clarity=" + gm.clarity + " vocab=" + gm.vocabUsed.join("|"));
ok("C · An unpunctuated transcript — what browser speech recognition actually returns — still makes all five moves; clarity rests on order alone",
  (() => { const e = grade(SAY.unpunctuated, 90); return e.coverage === 1 && ME.passes(e) && e.clarityBasis === "order"; })());
console.log("   stake ≠ cost ≠ evidence ≠ return ≠ ask");
ok("C · stake ≠ cost: 'what's at stake is your renewal' names the interest and prices nothing", only(padded("What's at stake here is your renewal"), "stake"));
ok("C · cost ≠ return: 'the cost of delay is ten thousand a month' is the price of waiting, not a payback", only(padded("The cost of delay is ten thousand a month"), "cost"));
ok("C · return ≠ cost: 'it pays for itself within a quarter' is what it buys back, not what waiting costs", only(padded("It pays for itself within a quarter"), "return"));
ok("C · evidence ≠ cost: 'we audited five hundred items' says where a number came from and names no consequence", only(padded("We audited five hundred items by hand"), "evidence"));
ok("C · ask ≠ stake: 'here's what I need from you' asks and frames nothing", only(padded("Here's what I need from you"), "ask"));

/* ═══════════ D · FALSE POSITIVES ═══════════════════════════════════════ */
console.log("\nD · FALSE POSITIVES");
ok("D · Influence vocabulary on its own makes no move", none(SAY.jargon));
ok("D · 'We really should prioritise this, it's important' is enthusiasm, not a case", none("We really should prioritise this, it's important and I think it would be good for everyone."));
ok("D · 'We should do this soon, it's quite urgent' hints and proves nothing", none("We should do this soon, it would be a good idea and it is quite urgent really."));
ok("D · 'It would be bad if we didn't' names no cost", none("It would be bad if we didn't do it, and I think everyone would agree with that."));
ok("D · 'Everyone knows the catalogue is a mess' is assertion, not evidence", none("Everyone knows the catalogue is a mess and I think it is obviously getting worse."));
ok("D · 'It'll cost sixty thousand' is a bill with no return", none("It will cost about sixty thousand pounds in total for the two of them."));
ok("D · A bare deadline is not a window, and a bare number is not a stake", none("It needs to be done by the end of January, that is the date in the plan.") && none("Eleven per cent, forty-seven thousand, three hundred and forty orders, twelve thousand items."));
ok("D · A frame salad — 'what's at stake, the cost of delay, here's what I need' with nothing in it — earns its frames and never a pass",
  (() => { const e = grade("What's at stake here is a lot. The cost of delay is high. Here's what I need from you."); return made(e) === "stake,cost,ask" && !ME.passes(e); })());

/* ═══════════ E · THE WEEK 6 LINE ═══════════════════════════════════════ */
console.log("\nE · THE WEEK 6 LINE (persuasion is not recommendation)");
ok("E · Week 6 and Week 11 are different competencies with different patterns, ids and move sets, and share no move id",
  W6.id !== W11.id && W6.pattern !== W11.pattern && W6.pattern === "OPTIONS → RECOMMENDATION → REASON → TRADE-OFF → NEXT STEP" && W11.pattern === "STAKE → COST OF INACTION → EVIDENCE → RETURN → ASK"
  && ME.moveIds(W6).every(id => !ME.moveIds(W11).includes(id)));
ok("E · Week 6's own model answer — options, a recommendation, a reason, a trade-off and a next step — earns NOTHING on the Week 11 rubric", none(G6.hear.model), made(grade(G6.hear.model, 60)));
ok("E · Week 6's transfer fixture earns nothing either", none(REST["recommend-decide"].transfer), made(grade(REST["recommend-decide"].transfer, 60)));
ok("E · Each Week 6 move, said on its own, earns no Week 11 move",
  none("We have two options here. Option A is to wait for the supplier and option B is to order from the second one.")
  && none("What I'd recommend is option B, and my recommendation is based on the delivery date.")
  && none("The main reason is that the customer has already been told the fifteenth. The data shows it clearly.")
  && none("The trade-off is the twenty per cent, and the downside is the cost of that decision.")
  && none("If you agree, the next step is that I'll place the order this afternoon. I need a decision by Friday."));
ok("E · Every one of Week 6's eight expressions earns no Week 11 move", W6.expressions.every(e => none(padded(e.w))), W6.expressions.map(e => e.w + ":" + made(grade(padded(e.w)))).filter(x => !x.endsWith(":")).join(" "));
ok("E · And the other way: Week 11's model answer does not PASS Week 6 — it lays out no options and recommends nothing",
  (() => { const e = ME.grade(W6, G6, SAY.strong, { seconds: 90 }); return !ME.passes(e) && e.moves.options === false && e.moves.recommend === false && e.moves.tradeoff === false; })(),
  (() => { const e = ME.grade(W6, G6, SAY.strong, { seconds: 90 }); return "cov=" + e.coverage + " made=" + Object.keys(e.moves).filter(k => e.moves[k]).join(); })());
ok("E · Week 11's transfer answer does not pass Week 6 either", !ME.passes(ME.grade(W6, G6, SAY.transfer, { seconds: 90 })));
ok("E · The model answers of ALL ten earlier competencies earn no Week 11 move at all",
  EARLIER.every(c => grade(guidedOf(c).hear.model, 60).coverage === 0), EARLIER.map(c => c.id + ":" + (made(grade(guidedOf(c).hear.model, 60)) || "-")).join(" "));
ok("D · The transfer fixtures of all ten earlier competencies earn no Week 11 move either",
  EARLIER.every(c => grade(REST[c.id].transfer, 60).coverage === 0), EARLIER.map(c => c.id + ":" + (made(grade(REST[c.id].transfer, 60)) || "-")).join(" "));
ok("E · Week 11's own answers pass none of the ten earlier competencies — partial credit is honest (a case does contain a reason), a pass is not",
  EARLIER.every(c => !ME.passes(ME.grade(c, guidedOf(c), SAY.strong, { seconds: 90 })) && !ME.passes(ME.grade(c, guidedOf(c), SAY.transfer, { seconds: 90 }))),
  EARLIER.map(c => c.id + ":" + ME.grade(c, guidedOf(c), SAY.strong, { seconds: 90 }).coverage.toFixed(2)).join(" "));

/* ═══════════ F · GUIDED ════════════════════════════════════════════════ */
console.log("\nF · GUIDED");
const miss = (text, id) => { const e = grade(text, 60); return e.coverage === 0.8 && !ME.passes(e) && e.moves[id] === false && ME.weakestMove(W11, e, []) === id; };
ok("F · A complete answer passes", ME.passes(gm));
ok("F · The engineer's pitch with no listener in it: 0.8, not passed, 'stake' weakest", miss(SAY.noStake, "stake"));
ok("F · The case with no price on doing nothing: 0.8, not passed, 'cost' weakest", miss(SAY.noCost, "cost"));
ok("F · 'Everyone knows' instead of evidence: 0.8, not passed, 'evidence' weakest", miss(SAY.noEvidence, "evidence"));
ok("F · A bill with no payback: 0.8, not passed, 'return' weakest", miss(SAY.noReturn, "return"));
ok("F · The whole case and no ask: 0.8, not passed, 'ask' weakest", miss(SAY.noAsk, "ask"));
ok("F · Four of five is 'strong' coverage by band and still not demonstrated — the bar is every move", (() => { const e = grade(SAY.noAsk, 60); return e.verdict === "strong" && !ME.passes(e); })());
ok("F · A failed guided answer — influence words only — is kept as evidence at coverage 0", (() => { const e = grade(SAY.jargon, 10); return e.coverage === 0 && !ME.passes(e) && e.answered; })());
ok("F · Deterministic coaching names the missing ask and hands back its own retry line from the pack",
  (() => { const f = ME.shapeCoach(null, W11, mk(W11, G11, SAY.noAsk, "guided", "c0")); return f.move === "ask" && f.retry === ME.moveOf(W11, "ask").retry && /make the ask/i.test(f.retry) && f.ai === false; })());
ok("F · …and for each other missing move the retry is that move's own line",
  [["noStake", "stake"], ["noCost", "cost"], ["noEvidence", "evidence"], ["noReturn", "return"]].every(([k, id]) => ME.shapeCoach(null, W11, mk(W11, G11, SAY[k], "guided", "c" + id)).retry === ME.moveOf(W11, id).retry));
ok("F · The missing move's expressions are queued to learn; the ones used are queued to keep",
  (() => { const q = ME.expressionsToLearn(W11, grade(SAY.noCost, 60), "cost");
    return q.some(e => e.move === "cost" && e.why === "missing") && q.some(e => e.why === "used") && q.every(e => W11.expressions.some(x => x.w === e.w)); })());
ok("F · A retry that adds the missing move recovers: PRACTICING → DEMONSTRATED, both attempts kept",
  (() => { const s = {}; ME.introduce(s, W11.id, GE); ME.addAttempt(s, W11.id, mk(W11, G11, SAY.noAsk, "guided", "r1"), GE, IV, meta(W11)); const before = s[W11.id].state;
    ME.addAttempt(s, W11.id, mk(W11, G11, SAY.strong, "retry", "r2"), GE, IV, meta(W11));
    return before === "PRACTICING" && s[W11.id].state === "DEMONSTRATED" && s[W11.id].attempts.length === 2 && s[W11.id].attempts[1].kind === "retry"; })());
ok("F · One word is not an answer; seven is not; eight is, scored on its merits — the bar is the engine's MIN_WORDS",
  !grade(SAY.short, 2).answered && !grade(SAY.seven, 4).answered && (() => { const e = grade(SAY.eight, 4); return e.answered && !ME.passes(e) && e.coverage === 0.2 && e.moves.cost === true; })() && ME.MIN_WORDS === 8, JSON.stringify({ seven: grade(SAY.seven, 4).words, eight: grade(SAY.eight, 4).words }));

/* ═══════════ G · TRANSFER ══════════════════════════════════════════════ */
console.log("\nG · TRANSFER");
const gT = t => ME.grade(W11, T11, t, { seconds: 120 });
ok("G · The transfer fixture makes all five moves cold from the supplied facts", gT(SAY.transfer).coverage === 1, "missed=" + gT(SAY.transfer).missed.join());
ok("G · Without the stake the transfer does not pass", (() => { const e = gT(SAY.transferWeak); return e.coverage === 0.8 && !ME.passes(e) && ME.weakestMove(W11, e, []) === "stake"; })(), made(gT(SAY.transferWeak)));
ok("G · The transfer is not the guided answer re-used: the two answers share no sentence of more than five words, and neither mentions the other's facts",
  (() => { const sents = t => t.split(/[.!?]/).map(x => x.trim().toLowerCase()).filter(x => x.split(/\s+/).length > 5); const a = sents(SAY.transfer), b = sents(G11.hear.model);
    return a.length >= 4 && a.every(x => !b.includes(x)) && !/catalogue|pricing|credit note|engineer|audited/i.test(SAY.transfer) && !/gearbox|breakdown|shift|packing|warranty/i.test(G11.hear.model); })());
ok("G · The guided model answer is about the wrong subject for the transfer — a price catalogue and engineers where the transfer has a packing line and a shutdown",
  !/catalogue|pricing|credit note/i.test(T11.context) && /catalogue/i.test(G11.hear.model) && /pricing/i.test(G11.hear.model));
ok("G · Every fact the transfer fixture uses is in the transfer context — nothing invented",
  /5 times in the last six months/.test(T11.context) && /averaging 9 hours each/.test(T11.context) && /45 hours of lost output/.test(T11.context) && /16 hours of running time/.test(T11.context) && /vibration readings/.test(T11.context) && /rising pattern/.test(T11.context) && /last two failures/.test(T11.context) && /three months before it seizes/.test(T11.context) && /December is peak/.test(T11.context) && /expires at the end of December/.test(T11.context) && /November has two quiet weeks/.test(T11.context));
ok("G · The transfer changes the stakeholder, the context, the facts, the constraint and the objective — a commercial director in a planning meeting becomes a plant manager on a factory floor",
  /plant manager/i.test(T11.see.who) && /commercial director/i.test(G11.see.who) && /factory floor/i.test(T11.see.where) && /Quarterly planning/i.test(G11.see.where)
  && /output per shift/i.test(T11.see.who) && /revenue target/i.test(G11.see.who) && /five minutes/i.test(T11.see.where) && /twenty minutes/i.test(G11.see.where)
  && /stop the line/i.test(T11.prompt) && /spend the engineers on data/i.test(G11.prompt));
ok("G · A failed transfer is still a transfer attempt: it is counted, and it is not a pass",
  (() => { const e = Object.assign(gT(SAY.transferWeak), { kind: "transfer" }); return !ME.passes(e) && e.answered; })());

/* ═══════════ H · PROGRESSION ═══════════════════════════════════════════ */
console.log("\nH · PROGRESSION");
const L11 = {};
const D = 86400000, T0 = Date.parse("2026-11-23T10:00:00Z");
ok("H · NOT_STARTED before anything", ME.record(L11, W11.id).state === "NOT_STARTED" && ME.stateFrom(ME.blank(W11.id)) === "NOT_STARTED");
ME.introduce(L11, W11.id, GE, T0);
ok("H · SEE/HEAR/NOTICE → INTRODUCED and no further", L11[W11.id].state === "INTRODUCED");
ME.addAttempt(L11, W11.id, mk(W11, G11, SAY.noAsk, "guided", "p1", T0 + 60000), GE, IV, meta(W11));
ok("H · A partial attempt → PRACTICING, retrieval due now for 'practice'", L11[W11.id].state === "PRACTICING" && L11[W11.id].retrieval.reason === "practice" && L11[W11.id].retrieval.due === T0 + 60000);
ME.addAttempt(L11, W11.id, mk(W11, G11, SAY.jargon, "retry", "p1b", T0 + 90000), GE, IV, meta(W11));
ok("H · A failed guided attempt (jargon only, no moves) stays PRACTICING and is kept as evidence", L11[W11.id].state === "PRACTICING" && L11[W11.id].attempts.length === 2 && L11[W11.id].attempts[1].coverage === 0, String(L11[W11.id].attempts[1].coverage));
ME.addAttempt(L11, W11.id, mk(W11, G11, SAY.strong, "retry", "p2", T0 + 120000), GE, IV, meta(W11));
ok("H · A full guided answer → DEMONSTRATED, due now for the transfer", L11[W11.id].state === "DEMONSTRATED" && L11[W11.id].retrieval.reason === "transfer");
ME.addAttempt(L11, W11.id, mk(W11, T11, SAY.transferWeak, "transfer", "p2b", T0 + 150000), GE, IV, meta(W11));
ok("H · A failed transfer stays DEMONSTRATED, counts against the tally, and sends the learner back to guided reps",
  L11[W11.id].state === "DEMONSTRATED" && L11[W11.id].transfer.failed === 1 && L11[W11.id].transfer.passed === 0 && ME.recommend(L11[W11.id], W11, T0 + 150000).reason === "transfer_failed");
ME.addAttempt(L11, W11.id, mk(W11, T11, SAY.transfer, "transfer", "p3", T0 + 180000), GE, IV, meta(W11));
ok("H · One cold success → TRANSFER_READY with a retrieval on the first interval (1 day)", L11[W11.id].state === "TRANSFER_READY" && L11[W11.id].transfer.passed === 1 && L11[W11.id].retrieval.reason === "retrieval" && L11[W11.id].retrieval.due === T0 + 180000 + D);
ME.addAttempt(L11, W11.id, mk(W11, T11, SAY.transfer, "transfer", "p4", T0 + 200000), GE, IV, meta(W11));
ok("H · A second cold success the SAME day is still TRANSFER_READY, spaced on the next interval (3 days)", L11[W11.id].state === "TRANSFER_READY" && L11[W11.id].transfer.passed === 2 && L11[W11.id].retrieval.due === T0 + 200000 + 3 * D);
ME.addAttempt(L11, W11.id, mk(W11, T11, SAY.transfer, "transfer", "p5", T0 + 2 * D), GE, IV, meta(W11));
ok("H · A cold success on another day → STRONG, spaced further (21 days)", L11[W11.id].state === "STRONG" && L11[W11.id].retrieval.reps === 4 && L11[W11.id].retrieval.due === T0 + 2 * D + 21 * D);
ok("H · The retrieval ladder is the track's own [1,3,7,21,60], and a different ladder is honoured",
  (() => { const s = {}; ME.introduce(s, W11.id, GE, T0); ME.addAttempt(s, W11.id, mk(W11, G11, SAY.strong, "guided", "q1", T0), GE, [2, 5], meta(W11));
    ME.addAttempt(s, W11.id, mk(W11, T11, SAY.transfer, "transfer", "q2", T0 + 1000), GE, [2, 5], meta(W11)); return s[W11.id].retrieval.due === T0 + 1000 + 2 * D; })());
console.log("   deterministic next recommendation");
const R = {};
ok("H · Unspoken → speak the guided mission", (() => { const r = ME.recommend(ME.blank(W11.id), W11, T0); return r.action === "speak" && r.missionId === ID + "-guided" && r.reason === "not_spoken_yet"; })());
ME.introduce(R, W11.id, GE, T0); ME.addAttempt(R, W11.id, mk(W11, G11, SAY.noEvidence, "guided", "s1", T0), GE, IV, meta(W11));
ok("H · Weak → retry the same mission on the missing move", (() => { const r = ME.recommend(R[W11.id], W11, T0); return r.action === "retry" && r.move === "evidence" && r.reason === "weak_move"; })());
ME.addAttempt(R, W11.id, mk(W11, G11, SAY.strong, "retry", "s2", T0 + 1), GE, IV, meta(W11));
ok("H · Demonstrated → take the transfer", (() => { const r = ME.recommend(R[W11.id], W11, T0 + 1); return r.action === "transfer" && r.missionId === ID + "-transfer"; })());
ME.addAttempt(R, W11.id, mk(W11, T11, SAY.transfer, "transfer", "s3", T0 + 2), GE, IV, meta(W11));
ok("H · Transfer-ready and not yet due → rest with the date; once due → a retrieval on the transfer mission",
  ME.recommend(R[W11.id], W11, T0 + 3).action === "rest" && ME.recommend(R[W11.id], W11, R[W11.id].retrieval.due + 1).action === "retrieval" && ME.recommend(R[W11.id], W11, R[W11.id].retrieval.due + 1).missionId === ID + "-transfer");
ok("H · Pending coaching outranks everything", (() => { const s = JSON.parse(JSON.stringify(R)); s[W11.id].attempts[0].coachPending = true; return ME.recommend(s[W11.id], W11, T0).action === "coach"; })());

/* ═══════════ I · CROSS-COMPETENCY ══════════════════════════════════════ */
console.log("\nI · CROSS-COMPETENCY");
const comps = PACK.competencies;
const pick = s => ME.pickNext(comps, id => s[id], Date.now());
const put = (s, c, m, txt, kind, key, at) => { ME.introduce(s, c.id, GE); return ME.addAttempt(s, c.id, mk(c, m, txt, kind, key, at), GE, IV, meta(c)); };
const show = p => p ? `${p.comp.id}:${p.rec.action}:${p.rec.move || "-"}` : "null";
const rest = (s, c, g, t, gs, ts, k) => { put(s, c, g, gs, "guided", k + "g"); put(s, c, t, ts, "transfer", k + "t"); };
const restEarlier = (s, k) => EARLIER.forEach(c => rest(s, c, guidedOf(c), transferOf(c), REST[c.id].guided, REST[c.id].transfer, k + c.week));
ok("I · A fresh learner is offered Week 1 — Week 11 is not pushed forward by being newest", show(pick({})) === "explain-work:speak:-", show(pick({})));
let B = {}; restEarlier(B, "b");
ok("I · Weeks 1–10 rest through the engine, not by hand", EARLIER.every(c => B[c.id].state === "TRANSFER_READY"), EARLIER.map(c => c.id + ":" + B[c.id].state).join());
ok("I · With Weeks 1–10 resting, Week 11 is offered to speak — a competency nobody has spoken for is never skipped", show(pick(B)) === ID + ":speak:-", show(pick(B)));
rest(B, W11, G11, T11, SAY.strong, SAY.transfer, "b11");
ok("I · Every competency after Week 11 has a cold-transfer fixture in this suite", LATER.every(c => typeof SAY.transfers[c.id] === "string"), LATER.map(c => c.id).join());
LATER.forEach(c => { ok(`I · With everything before it resting, ${c.id} (Week ${c.week}) is offered to speak`, show(pick(B)) === `${c.id}:speak:-`, show(pick(B))); rest(B, c, guidedOf(c), transferOf(c), guidedOf(c).hear.model, SAY.transfers[c.id], "b" + c.week); });
ok("I · With every competency resting, nothing is pushed and the old advice stands", pick(B) === null, show(pick(B)));
let C = {}; put(C, W1, G1, REST["explain-work"].guided, "guided", "c1"); put(C, W11, G11, SAY.noCost, "guided", "c2");
ok("I · A Week 11 weak move outranks a Week 1 pending transfer — evidence priority, not week order", show(pick(C)) === ID + ":retry:cost", show(pick(C)));
let Dd = {}; put(Dd, W1, G1, W1_NO_WHY, "guided", "d1"); put(Dd, W11, G11, SAY.noCost, "guided", "d2");
ok("I · Two equally urgent retries → the earlier week, deterministically, and only as a tie-break", show(pick(Dd)) === "explain-work:retry:why" && show(pick(Dd)) === show(pick(Dd)), show(pick(Dd)));
let E = {}; put(E, W10, G10, REST["sell-experience"].guided, "guided", "e1"); put(E, W11, G11, SAY.noReturn, "guided", "e2");
ok("I · Week 11 weak vs Week 10 ready for transfer → Week 11's retry", show(pick(E)) === ID + ":retry:return", show(pick(E)));
let Fx = {}; restEarlier(Fx, "f"); put(Fx, W11, G11, SAY.noEvidence, "guided", "f11");
ok("I · A learner with different evidence gets a different next mission: Weeks 1–10 resting and Week 11 weak → Week 11 retry on 'evidence'", show(pick(Fx)) === ID + ":retry:evidence", show(pick(Fx)));
ok("I · Pending coaching on Week 11 outranks a Week 1 retry",
  (() => { const s = {}; put(s, W1, G1, W1_NO_WHY, "guided", "i1"); const r = put(s, W11, G11, SAY.noStake, "guided", "i2"); r.attempt.coachPending = true; return show(pick(s)) === ID + ":coach:stake"; })());
ok("I · One record per competency, keyed by competency id — never by week", (() => { const s = {}; PACK.competencies.forEach((c, i) => put(s, c, guidedOf(c), "x", "guided", "k" + i)); return Object.keys(s).sort().join() === PACK.competencies.map(c => c.id).sort().join() && Object.keys(s).length === PACK.competencies.length; })());

/* ═══════════ J · MEMORY ════════════════════════════════════════════════ */
console.log("\nJ · MEMORY");
const row = ME.contract(mk(W11, G11, SAY.noAsk, "guided", "k1"), meta(W11));
ok("J · Evidence is written as the same v1 contract: versioned, track-stamped, week 11, competency, mission, kind, key",
  row.v === ME.EVIDENCE_VERSION && row.v === 1 && row.tk === GE && row.week === WEEK && row.competency === ID && row.missionId === ID + "-guided" && row.kind === "guided" && row.key === "k1");
ok("J · Its moves map holds exactly the five Week 11 ids, as booleans", Object.keys(row.moves).join() === MOVES && Object.values(row.moves).every(v => typeof v === "boolean") && row.moves.ask === false);
ok("J · Task, clarity, fluency and vocabulary are measured numbers in [0,1]; pronunciation is null — never zero — with no audio grader",
  [row.task, row.clarity, row.fluency, row.vocab].every(x => typeof x === "number" && x >= 0 && x <= 1) && row.pron === null && row.pronSource === null);
ok("J · With no duration, seconds and wpm are null, not 0", (() => { const r = ME.contract(Object.assign(ME.grade(W11, G11, SAY.strong, {}), { key: "k3", kind: "guided" }), meta(W11)); return r.seconds === null && r.wpm === null; })());
ok("J · Transfer is null on a guided attempt and a boolean on a transfer attempt", row.transfer === null && typeof ME.contract(mk(W11, T11, SAY.transfer, "transfer", "k2"), meta(W11)).transfer === "boolean");
ok("J · Vocabulary used lists only the competency's own expressions",
  (() => { const r = grade("What's at stake here is this. The cost of delay is high. If we ignore this, the likely outcome is worse. The data supports it and I'm confident because of that. The return on doing this now is real and this pays for itself within a year. Here's what I need from you.", 40); return r.vocabUsed.every(w => W11.expressions.some(e => e.w === w)) && r.vocabUsed.length >= 6; })());
ok("J · The same key twice in Week 11 is one row, reported as a duplicate", (() => { const s = {}; put(s, W11, G11, SAY.strong, "guided", "dup"); return put(s, W11, G11, SAY.strong, "guided", "dup").duplicate && s[W11.id].attempts.length === 1; })());
ok("J · The same key in Week 11 and Week 10 is two rows, one each — idempotency is per competency",
  (() => { const s = {}; put(s, W10, G10, REST["sell-experience"].guided, "guided", "same"); const r = put(s, W11, G11, SAY.strong, "guided", "same"); return !r.duplicate && s[W10.id].attempts.length === 1 && s[W11.id].attempts.length === 1; })());
ok("J · Weak evidence stays due: a weak Week 11 record is due now, for practice, with its weakness kept and driving the next recommendation",
  (() => { const s = {}; const r = put(s, W11, G11, SAY.noReturn, "guided", "w1"); s[W11.id].weakness = ME.weakestMove(W11, r.attempt, s[W11.id].attempts);
    return s[W11.id].retrieval.reason === "practice" && s[W11.id].retrieval.due <= Date.now() && s[W11.id].weakness === "return" && ME.recommend(s[W11.id], W11).move === "return"; })());
ok("J · Week 11 attempts are bounded at 60", (() => { const s = {}; for (let i = 0; i < 70; i++) put(s, W11, G11, SAY.strong, "guided", "b" + i, T0 + i); return s[W11.id].attempts.length === 60; })());
ok("J · A Week 11 attempt changes none of the other ten records",
  (() => { const s = {}; EARLIER.forEach((c, i) => put(s, c, guidedOf(c), i === 0 ? W1_NO_WHY : REST[c.id].guided, "guided", "m" + i));
    const before = JSON.stringify(EARLIER.map(c => s[c.id])); put(s, W11, G11, SAY.noAsk, "guided", "m11"); return JSON.stringify(EARLIER.map(c => s[c.id])) === before && s[W11.id].state === "PRACTICING"; })());
ok("J · Cross-competency retrieval still works: ten rested records keep their own schedules while Week 11 is due now",
  (() => { const s = {}; restEarlier(s, "x"); put(s, W11, G11, SAY.noAsk, "guided", "x11");
    return EARLIER.every(c => s[c.id].retrieval.reason === "retrieval" && s[c.id].retrieval.due > Date.now()) && s[W11.id].retrieval.reason === "practice" && s[W11.id].retrieval.due <= Date.now(); })());
ok("J · The progress summary carries Week 11, its state, five per-move counts, null pronunciation and no Shadow support",
  (() => { const ps = ME.progressSummary(L11[W11.id], W11); return ps.competency === ID && ps.week === WEEK && ps.state === "STRONG" && ps.byMove.map(m => m.id).join() === MOVES && ps.pron === null && ps.shadow.total === 0 && ps.transferPassed === 3 && ps.transferFailed === 1; })());

/* ═══════════ K · AI CONTEXT ════════════════════════════════════════════ */
console.log("\nK · AI COACH");
const st11 = {}; put(st11, W6, G6, REST["recommend-decide"].guided, "guided", "h0"); put(st11, W11, G11, SAY.noAsk, "guided", "h1");
const ctx = ME.aiContext(st11[W11.id], W11, G11, { weakness: "ask" });
const ctxJson = JSON.stringify(ctx);
ok("K · The context carries competency win-support, the guided mission, the pattern, five moves with hints, the weakness, evidence counts and one attempt summary",
  ctx.track === GE && ctx.competency === ID && ctx.mission === ID + "-guided" && ctx.prompt === G11.prompt && ctx.pattern === W11.pattern
  && ctx.targetMoves.length === 5 && ctx.targetMoves.every(m => m.id && m.label && m.hint) && ctx.currentWeakness === "ask"
  && ctx.recentEvidence.attempts === 1 && ctx.previousAttemptSummary && ctx.previousAttemptSummary.moves.ask === false);
ok("K · Relevant memory is in: the last attempt's moves and length; the transcript is not", ctx.previousAttemptSummary.words > 8 && !("said" in ctx.previousAttemptSummary) && !ctxJson.includes(SAY.noAsk.slice(0, 30)));
ok("K · Unrelated history is not dumped in: no attempt list, no profile, no state machine, nothing from Week 6 or any other competency",
  !ctxJson.includes("\"attempts\":[") && !/profile|streak|\"name\"/i.test(ctxJson) && !("state" in ctx) && !/recommend-decide|sell-experience|exec-summary|sprint-coordinate|disagree-pushback|explain-tech|clarify-confirm|explain-work|clear-update|raise-problem|Lay out the options|Recommend one|Name the trade-off|Propose the next step|Lead with the headline|Set the scene/.test(ctxJson));
ok("K · The context is compact", ctxJson.length < 2500, String(ctxJson.length));
const prompt = ME.coachPrompt(ctx, "SPOKEN RULE");
ok("K · The prompt names five moves with Week 11's labels, its shape, and the existing {reply, covered} route — and tells the model it is a coach, not a colleague",
  /makes 5 communication/.test(prompt) && /stake \(Name what's at stake for them\)/.test(prompt) && /cost \(Give the cost of doing nothing\)/.test(prompt) && prompt.includes(W11.pattern) && /"covered"/.test(prompt) && /"reply"/.test(prompt) && /speaking coach/i.test(prompt) && prompt.includes("SPOKEN RULE") && !/options \(|recommend \(|tradeoff \(|headline \(|situation \(/.test(prompt));
const evAI = mk(W11, G11, SAY.noAsk, "guided", "ai1"); ME.applyCoachMoves(evAI, W11, ["ask"]);
ok("K · The model MAY add the ask it heard in the learner's own words", evAI.moves.ask === true && evAI.coverage === 1 && evAI.assisted === true);
const evKeep = mk(W11, G11, SAY.strong, "guided", "ai2"); ME.applyCoachMoves(evKeep, W11, []);
ok("K · The model CANNOT remove a move the learner made", evKeep.coverage === 1);
const evJunk = mk(W11, G11, SAY.noAsk, "guided", "ai3"); ME.applyCoachMoves(evJunk, W11, ["options", "recommend", "tradeoff", "next", "headline", "situation", "__proto__", "state", "passed", 42, null]);
ok("K · Other competencies' move ids and non-moves are dropped on the floor", evJunk.moves.ask === false && Object.keys(evJunk.moves).join() === MOVES && !("state" in evJunk.moves));
const shaped = ME.shapeCoach({ reply: "y".repeat(500), covered: ["ask"], state: "STRONG", score: 100, passed: true }, W11, evAI);
ok("K · Model output is capped, tagged as AI, and carries no state or score into the app", shaped.improve.length <= 240 && shaped.ai === true && !("state" in shaped) && !("score" in shaped) && !("passed" in shaped));

/* ═══════════ L · SHADOW DECISION — DELIBERATELY UNLINKED ═══════════════ */
console.log("\nL · SHADOW (engine)");
ok("L · Week 11 has NO shadow block, after a content check, and the _shadow_note records the audit, the runners-up and the library gap",
  !W11.shadow && typeof W11._shadow_note === "string" && /content check/i.test(W11._shadow_note) && /9vG1ib2gF-k/.test(W11._shadow_note) && /9G-QCNy57Hg/.test(W11._shadow_note) && /HvW2cnqCVZk/.test(W11._shadow_note) && /gap/i.test(W11._shadow_note));
ok("L · The note says exactly what the closest clip would and would not model, and names the Week 6 confusion it avoided",
  /at most one of the five moves/.test(W11._shadow_note) && /never costs inaction/.test(W11._shadow_note) && /never asks for anything/.test(W11._shadow_note) && /Week 6's move, not this one/.test(W11._shadow_note) && /Monday task/.test(W11._shadow_note));
ok("L · The runners-up named in the note are real catalogue clips, so the audit can be re-run against the same library",
  ["9vG1ib2gF-k", "9G-QCNy57Hg", "HvW2cnqCVZk", "63Sv85jlYWg", "2bCW7b9kTpE"].every(v => !!CATALOGUE.videos[v]));
const round = vid => ({ kind: "challenge", ts: 1.7e12, vid, title: "t", rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" } });
ok("L · With no clip linked, a Shadow round on ANY competency's clip is unlinked for Week 11 — including Week 10's, Week 9's and Week 2's",
  [W10, W9, W8, W7, W2, W3].every(c => ME.fromShadow(round(c.shadow.vid), W11).linked === false) && ME.fromShadow(round("9vG1ib2gF-k"), W11).linked === false);
ok("L · Unlinked Shadow work is still recorded as support, still never moves Week 11's state, and credits no move",
  (() => { const s = {}; put(s, W11, G11, SAY.noStake, "guided", "sh0"); const before = s[W11.id].state;
    ME.addSupport(s, W11.id, ME.fromShadow(round(W10.shadow.vid), W11), GE);
    const p = ME.progressSummary(s[W11.id], W11); return s[W11.id].state === before && p.shadow.total === 1 && p.shadow.linked === 0 && p.byMove.every(m => m.made <= 1) && p.byMove.find(m => m.id === "stake").made === 0; })());
ok("L · With nothing linked, Week 11 reports no Shadow comprehensibility — it does not borrow another competency's number",
  (() => { const s = {}; put(s, W11, G11, SAY.strong, "guided", "sh1"); ME.addSupport(s, W11.id, ME.fromShadow(round(W10.shadow.vid), W11), GE);
    const p = ME.progressSummary(s[W11.id], W11); return p.shadow.linked === 0 && p.shadow.rungName === null; })());
ok("L · The architecture holds competencies with a clip (2, 3, 7, 8, 9, 10) and without (1, 4, 5, 6, 11) at the same time",
  !!W2.shadow && !!W3.shadow && !!W7.shadow && !!W8.shadow && !!W9.shadow && !!W10.shadow && !W1.shadow && !W4.shadow && !W5.shadow && !W6.shadow && !W11.shadow && ME.progressSummary(ME.blank(W11.id), W11).shadow.total === 0);
ok("L · Support is refused for any track but General English", ME.addSupport({}, W11.id, ME.fromShadow(round(W10.shadow.vid), W11), "welding") === null);

/* ═══════════ M (engine half) · WELDING WALL ════════════════════════════ */
console.log("\nM · WELDING WALL (engine)");
ok("M · The engine refuses a Week 11 write for any area but General English — and does not create a record",
  (() => { const s = {}; return ME.addAttempt(s, W11.id, mk(W11, G11, SAY.strong, "guided", "w"), "welding", IV, meta(W11)) === null && ME.introduce(s, W11.id, "welding") === null
    && ME.addSupport(s, W11.id, { key: "x", at: 1 }, "welding") === null && Object.keys(s).length === 0; })());
ok("M · guard() accepts only the pack's own track constant", ME.guard(GE) === true && ME.guard("welding") === false && ME.TRACK === GE);

/* ═══════════ BROWSER ═══════════════════════════════════════════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8181, 8182, 8183, 8184, 8185]) {
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
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Ask them for the thing you need, and say why it cannot wait a quarter.", covered: coachCovered }) });
  });
  await ctx.route(u => /youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com/.test(u.href), route => route.abort());
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?w11=" + Date.now(), { waitUntil: "load" });
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
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: innerWidth }));
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
  return { n: document.querySelectorAll(".mv-home").length, today: document.querySelectorAll(".today-card").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText }; });
ok("N1 · A fresh learner's Home offers ONE V2 card and it is Week 1 — Week 11 does not appear prematurely",
  home0.n === 1 && home0.today <= 1 && /Week 1\b/i.test(home0.eyebrow || "") && /Explain what you do/i.test(home0.title || ""), JSON.stringify(home0));
const rested = await restBefore(L.page);
ok("N2 · Weeks 1–10 are transfer-ready in this learner's store (seeded through the engine, not by hand)", rested === EARLIER.map(() => "TRANSFER_READY").join(), rested);
const home1 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText, chip: c && c.querySelector(".chip").innerText, btn: c && c.querySelector("button").innerText, line: c && c.querySelector("p").innerText }; });
ok("N3 · Now Home's one card is Week 11, 'Not started', with 'Start the mission' — chosen by the engine's own priority, nothing hardcoded",
  home1.n === 1 && /Week 11/i.test(home1.eyebrow || "") && /Persuasion & stakeholder influence/i.test(home1.title || "") && /not started/i.test(home1.chip || "") && /start the mission/i.test(home1.btn || "") && /say it out loud once/i.test(home1.line || ""), JSON.stringify(home1));
const ovh = await overflow(L.page); ok("N3 · Home has no horizontal overflow at 390px with the Week 11 card", ovh.sw <= ovh.cw, JSON.stringify(ovh));
await shot(L.page, "390-home-week11");
const coachRec = await L.page.evaluate(() => ({ a: AdaptiveLearningEngine.recommendation(S, ProfessionalTrackContext.active()), m: LearningCoach.mission(S, ProfessionalTrackContext.active()) }));
ok("N4 · The Adaptive engine and the LearningCoach both surface Week 11 through the existing hooks", coachRec.a.v2 === true && /Persuasion & stakeholder influence/i.test(coachRec.a.title) && coachRec.m.v2 === true && coachRec.m.arg1 === ID + "-guided" && coachRec.m.go === "mission", JSON.stringify({ t: coachRec.a.title, arg: coachRec.m.arg1 }));
const opened = await L.page.evaluate(async () => { LearningCoach.openMission(); await new Promise(r => setTimeout(r, 400)); return { v: cur.v, comp: _mv && _mv.compId, mission: _mv && _mv.missionId }; });
ok("N5 · LearningCoach.openMission() lands on the Week 11 mission", opened.v === "mission" && opened.comp === ID && opened.mission === ID + "-guided", JSON.stringify(opened));

console.log("\nTHE LOOP · SEE → HEAR → NOTICE");
await L.page.evaluate(id => mvGo(id + "-guided", "see"), ID); await sleep(350);
const see = await L.page.evaluate(id => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), state: (mvStore()[id] || {}).state, cta: document.querySelectorAll("#v-mission .mv-cta").length, back: !!document.querySelector("#v-mission > .mv-back") }), ID);
ok("SEE renders Week 11's title, the director's challenge and the goal, with one action and a way back — and is worth INTRODUCED only",
  /Persuasion & stakeholder influence/i.test(see.txt) && /Why should I spend the engineers on data/i.test(see.txt) && /Don't list options/i.test(see.txt) && /Step 1 of 7/i.test(see.txt) && see.cta === 1 && see.back && see.state === "INTRODUCED", see.txt.slice(0, 160));
const ovs = await overflow(L.page); ok("SEE has no horizontal overflow at 390px", ovs.sw <= ovs.cw, JSON.stringify(ovs));
await shot(L.page, "390-see");
await L.page.evaluate(() => mvStep("hear")); await sleep(300);
const hear = await L.page.evaluate(() => { const vis = () => /credit-note log/i.test(document.getElementById("v-mission").innerText);
  const hidden = !vis(), play = document.querySelectorAll(".mv-play button").length, reveal = !!document.querySelector(".mv-reveal");
  document.querySelector(".mv-reveal").click();
  return { hidden, play, reveal, shownAfter: vis(), heard: (window.__ev || []).some(e => e[0] === "v2_mission_heard"), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("HEAR is voice-first: two play buttons, Week 11's model hidden until 'Show the words', the heard event logged, no overflow",
  hear.hidden && hear.play === 2 && hear.reveal && hear.shownAfter && hear.heard && hear.sw <= hear.cw, JSON.stringify(hear));
await shot(L.page, "390-hear");
await L.page.evaluate(() => mvStep("notice")); await sleep(350);
const notice = await L.page.evaluate(() => ({
  moves: [...document.querySelectorAll(".mv-list li b")].map(b => b.innerText),
  eyebrow: (document.querySelector(".mv-notice .eyebrow") || {}).innerText, sub: (document.querySelector(".mv-notice .sub") || {}).innerText,
  shadow: !!document.querySelector(".mv-shadow"), cta: document.querySelectorAll("#v-mission .mv-cta").length }));
ok("NOTICE renders the five Week 11 moves by label, says '5 moves', and — with no clip linked — shows NO Shadow row",
  notice.moves.join() === LABELS && /5 moves/i.test(notice.eyebrow + " " + notice.sub) && notice.shadow === false && notice.cta === 1, JSON.stringify(notice));
const ovn = await overflow(L.page); ok("NOTICE has no horizontal overflow at 390px with five moves", ovn.sw <= ovn.cw, JSON.stringify(ovn));
await shot(L.page, "390-notice");
const noType = await L.page.evaluate(() => ({ ta: document.querySelectorAll("#v-mission textarea").length, inp: document.querySelectorAll("#v-mission input[type=text]").length, sc: document.querySelectorAll("#v-mission .score-b").length }));
ok("Week 11 is voice-first — no script box, no text input, no self-score", noType.ta === 0 && noType.inp === 0 && noType.sc === 0, JSON.stringify(noType));

console.log("\nSPEAK → COACH");
await L.page.evaluate(() => mvStep("speak")); await sleep(250);
const spk = await L.page.evaluate(() => ({ btn: document.querySelectorAll("#v-mission .rec-btn").length, prompt: (document.querySelector(".mv-q") || {}).innerText, ctx: (document.querySelector(".mv-ctx") || {}).innerText, state: (document.getElementById("recState") || {}).innerText }));
ok("SPEAK shows the question, the stakeholder's own position, the numbers and the window as context, and one recorder in its idle state",
  spk.btn === 1 && /engineers on data/i.test(spk.prompt || "") && /12,000 items/.test(spk.ctx || "") && /£47,000 in credit notes/.test(spk.ctx || "") && /measured on revenue/.test(spk.ctx || "") && /record your answer/i.test(spk.state || ""), JSON.stringify(spk).slice(0, 220));
await shot(L.page, "390-speak");
coachCovered = ["stake", "cost", "evidence", "return"];
await L.page.evaluate(t => { window.__say = t; }, SAY.noAsk);
await L.page.evaluate(() => mvRecord());
await L.page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
const recording = await L.page.evaluate(() => ({ cls: document.querySelector("#v-mission .rec-btn").className, state: (document.getElementById("recState") || {}).innerText, rec: !!_mv.recording, ev: (window.__ev || []).filter(e => e[0] === "v2_speak_attempt").length }));
ok("While recording, the button is in its recording state, the label says so, and the speak event was logged", /recording/.test(recording.cls) && /listening/i.test(recording.state || "") && recording.rec && recording.ev === 1, JSON.stringify(recording));
await shot(L.page, "390-recording");
await sleep(1200);
await L.page.evaluate(() => mvRecord());
await L.page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
await sleep(250);
const b1 = await L.page.evaluate(() => ({ moves: _mv.ev.moves, cov: _mv.ev.coverage, move: _mv.coach.move, ai: _mv.coach.ai, chips: document.querySelectorAll(".mv-move").length, off: document.querySelectorAll(".mv-move.off").length, offTxt: (document.querySelector(".mv-move.off") || {}).innerText, improve: (document.querySelector(".mv-improve") || {}).innerText, step: _mv.step }));
ok("O1 · the missing ask is identified from what was said; five chips render, one off — the ask chip",
  b1.moves.ask === false && b1.cov === 0.8 && b1.move === "ask" && b1.chips === 5 && b1.off === 1 && /Ask, and say why now/i.test(b1.offTxt || "") && b1.step === "coach", JSON.stringify({ c: b1.cov, m: b1.move, chips: b1.chips, off: b1.off, offTxt: b1.offTxt }));
ok("O2 · four of five does not advance the learner", (await recW(L.page, ID)).state === "PRACTICING");
ok("O3 · the coach's system prompt carried Week 11's five moves — not Week 6's options, Week 9's headline or Week 10's situation",
  /makes 5 communication/.test(lastSystem) && /stake \(Name what's at stake for them\)/.test(lastSystem) && /ask \(Ask, and say why now\)/.test(lastSystem) && !/options \(/.test(lastSystem) && !/headline \(/.test(lastSystem) && !/situation \(/.test(lastSystem), lastSystem.slice(0, 90));
ok("O4 · the coaching shown is the model's and is tagged as such", b1.ai === true && /ask/i.test(b1.improve || ""));
const ovc = await overflow(L.page); ok("COACH has no horizontal overflow at 390px with five chips", ovc.sw <= ovc.cw, JSON.stringify(ovc));
await shot(L.page, "390-coach");

console.log("\nRETRY");
const retry = await L.page.evaluate(() => { mvRetry(); return { text: _mv.retryText, step: _mv.step, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText }; });
ok("P1 · the retry names the Week 11 move that was missed, in the pack's own words, on the retry step", /make the ask/i.test(retry.text || "") && retry.step === "speak" && /one more time/i.test(retry.eyebrow || ""), JSON.stringify(retry));
await shot(L.page, "390-retry");
coachCovered = ["stake", "cost", "evidence", "return", "ask"];
await speak(L.page, SAY.strong);
const c2 = await recW(L.page, ID);
ok("P2 · the retry is stored as a retry; both attempts are preserved", c2.attempts.length === 2 && c2.attempts[0].coverage === 0.8 && c2.attempts[1].kind === "retry" && c2.attempts[1].coverage === 1);
ok("P3 · progression recalculates to DEMONSTRATED", c2.state === "DEMONSTRATED", c2.state);
const transferBtn = await L.page.evaluate(() => [...document.querySelectorAll(".mv-acts button")].map(b => b.innerText).join("|"));
ok("P4 · once demonstrated, the coach screen offers the new situation", /take the new situation/i.test(transferBtn), transferBtn);

console.log("\nTRANSFER");
await L.page.evaluate(id => mvGo(id + "-transfer", "speak"), ID); await sleep(300);
const tp = await L.page.evaluate(() => ({ q: (document.querySelector(".mv-q") || {}).innerText, comp: _mv.compId, kind: _mv.kind, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText, instr: (document.querySelector(".mv-instruction") || {}).innerText, ctx: (document.querySelector(".mv-ctx") || {}).innerText }));
ok("Q1 · the transfer is a different stakeholder and subject, still Week 11, framed as the new situation with the cold goal and its own facts",
  /stop the line/i.test(tp.q || "") && tp.comp === ID && tp.kind === "transfer" && /new situation/i.test(tp.eyebrow || "") && /nobody is prompting you/i.test(tp.instr || "") && /packing line/i.test(tp.ctx || "") && /gearbox/i.test(tp.ctx || ""), JSON.stringify(tp).slice(0, 220));
await shot(L.page, "390-transfer");
await speak(L.page, SAY.transfer);
const d2 = await recW(L.page, ID);
ok("Q2 · transfer evidence is stored as its own kind, separate from practice", d2.attempts.length === 3 && d2.attempts[2].kind === "transfer" && d2.attempts[2].transfer === true);
ok("Q3 · one cold success is TRANSFER_READY, not STRONG", d2.state === "TRANSFER_READY" && d2.transfer.passed === 1, d2.state);
ok("Q4 · a retrieval is scheduled from the track's own intervals", d2.retrieval && d2.retrieval.reason === "retrieval" && d2.retrieval.due > Date.now());
const harvested = await L.page.evaluate(({ vid, id }) => {
  const before = mvStore()[id].state, n0 = mvStore()[id].attempts.length;
  aList("chHist").unshift({ kind: "challenge", ts: Date.now(), vid, title: "some other clip", seg: 2, rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" }, heard: "x y z", issues: [], drills: [] });
  save();
  const n = mvHarvestShadow();
  const d = (window.v2Evidence() || []).find(x => x.competency === id);
  return { n, linked: d.shadow.linked, state: d.state, sameState: before === d.state, attempts: mvStore()[id].attempts.length === n0 };
}, { vid: W10.shadow.vid, id: ID });
ok("Q5 · Shadow work on another competency's clip is never linked to Week 11, and never touches its state or attempts",
  harvested.linked === 0 && harvested.sameState && harvested.attempts, JSON.stringify(harvested));
await L.page.evaluate(() => mvStep("done")); await sleep(300);
const done = await L.page.evaluate(() => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), bars: document.querySelectorAll(".mv-bars > *").length, chips: document.querySelectorAll(".mv-move").length, shadowNote: !!document.querySelector(".mv-shadow-note") }));
ok("Q6 · the evidence screen shows the state, five chips and the dimension bars — pronunciation as a number because the (mocked) audio grader measured it — and NO Shadow line, because nothing is linked",
  /transfer ready/i.test(done.txt) && done.bars >= 5 && done.chips === 5 && /83%/.test(done.txt) && done.shadowNote === false, done.txt.slice(0, 160));
const ovd = await overflow(L.page); ok("Evidence screen has no horizontal overflow at 390px", ovd.sw <= ovd.cw, JSON.stringify(ovd));
await shot(L.page, "390-evidence");

console.log("\nR · PROGRESS");
const prog = await L.page.evaluate(() => { go("review"); const ps = [...document.querySelectorAll(".pg-v2")]; const d = window.v2Evidence();
  return { panels: ps.length, txt: ps.map(p => p.innerText.replace(/\s+/g, " ")).join(" || "), comps: d.map(x => x.competency + ":" + x.state), weeks: d.map(x => x.week).join(), moves: d.map(x => (x.byMove || []).length).join(), last: d[d.length - 1] }; });
const spokenComps = PACK.competencies.filter(c => c.week <= WEEK);
ok("R1 · Progress renders every spoken competency oldest week first — eleven panels in canonical order, each with its own move count — ordering and counts come from the data",
  prog.panels === spokenComps.length && prog.panels === 11 && prog.weeks === spokenComps.map(c => c.week).join() && prog.moves === spokenComps.map(c => c.moves.length).join() && prog.comps[spokenComps.length - 1] === ID + ":TRANSFER_READY", JSON.stringify({ p: prog.panels, w: prog.weeks, m: prog.moves, c: prog.comps }));
ok("R2 · The Week 11 panel names its week, its state and its own moves through the same evidence contract, and sits after Week 10",
  /Week 11/.test(prog.txt) && /Give the cost of doing nothing/.test(prog.txt) && /Show the return/.test(prog.txt) && prog.last.week === WEEK && prog.last.attempts === 3 && prog.last.passed === 2 && prog.last.transferPassed === 1 && prog.last.pron === 83 && prog.last.pronSource === "audio" && prog.last.shadow.linked === 0
  && prog.comps[spokenComps.length - 2].startsWith("sell-experience"), JSON.stringify({ w: prog.last.week, a: prog.last.attempts, p: prog.last.passed, sh: prog.last.shadow }));
const ovp = await overflow(L.page); ok("Progress has no horizontal overflow at 390px with eleven panels", ovp.sw <= ovp.cw, JSON.stringify(ovp));
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
  ok(`R3 · With everything before it resting, Home's one card is ${c.id} (Week ${c.week}); resting it makes it transfer-ready`, new RegExp("Week " + c.week, "i").test(step.offered) && step.state === "TRANSFER_READY", JSON.stringify(step));
}
const afterAll = await L.page.evaluate(() => { go("home"); return { n: document.querySelectorAll(".mv-home").length, card: !!document.querySelector(".mv-home") }; });
ok("R3 · With every competency resting, Home shows no V2 card and looks as it did before V2 — the old advice stands", afterAll.n === 0 && afterAll.card === false, JSON.stringify(afterAll));
const voc = await L.page.evaluate(id => Object.entries(areaVocab()).filter(([, v]) => v.src && v.src.v2 === id).map(([w]) => w), ID);
ok("R4 · Week 11 expressions were acquired automatically, tagged to Week 11", voc.length > 0 && voc.every(w => W11.expressions.some(e => e.w === w)), JSON.stringify(voc));

console.log("\nS · ANALYTICS");
const ev = await L.page.evaluate(id => (window.__ev || []).filter(e => e[0].startsWith("v2_") && e[1].competency === id).map(e => [e[0], e[1].track, e[1].week, e[1].competency, e[1].mission]), ID);
ok("S1 · every Week 11 analytics event carries track general-english, week '11' and competency win-support",
  ev.length >= 10 && ev.every(e => e[1] === GE && e[2] === String(WEEK) && e[3] === ID), JSON.stringify(ev.slice(0, 4)));
const evNames = [...new Set(ev.map(e => e[0]))];
const ALL11 = ["v2_mission_started", "v2_mission_heard", "v2_speak_attempt", "v2_coach_generated", "v2_evidence_recorded", "v2_retry_attempt", "v2_transfer_started", "v2_transfer_completed", "v2_competency_progressed", "v2_retrieval_scheduled", "v2_recommendation_generated"];
ok("S2 · the loop emitted only the existing v2_* names for Week 11 — all eleven, and no new name", ALL11.every(n => evNames.includes(n)) && evNames.every(n => ALL11.includes(n)), evNames.join());
const evProps = await L.page.evaluate(() => (window.__ev || []).filter(e => e[0].startsWith("v2_")).map(e => e[1]));
ok("S3 · every prop key is one the Worker's v2 column map already carries", evProps.every(p => Object.keys(p).every(k => ["track", "week", "competency", "mission", "kind", "move", "result", "band", "state", "from", "attempt", "ai"].includes(k))));
ok("S4 · the move and mission values are Week 11's own enums, and a progression carries from/state",
  evProps.filter(p => p.competency === ID).every(p => (!p.move || ["stake", "cost", "evidence", "return", "ask", "none"].includes(p.move)) && (!p.mission || new RegExp("^" + ID + "-(guided|transfer)$").test(p.mission) || p.mission === "shadow"))
  && evProps.some(p => p.state === "TRANSFER_READY" && p.from === "DEMONSTRATED"));
const pii = JSON.stringify(evProps);
ok("S5 · no event carries a transcript, the profile name or the goal", !/catalogue|credit note|gearbox|packing|engineers|pricing|breakdown|\"T\"|confidence in meetings/i.test(pii));
const nonV2 = await L.page.evaluate(() => (window.__ev || []).map(e => e[0]).filter(n => !n.startsWith("v2_")));
ok("S6 · the mission emitted no V1 session_complete and no Welding event", !nonV2.includes("session_complete") && !nonV2.some(n => /workshop|weld/.test(n)), nonV2.join());

console.log("\nT · CLOUD MERGE (app)");
const merged = await L.page.evaluate(({ SAY, id, week }) => {
  const c = mvComp(id), g = MissionEngine.missionOf(c, id + "-guided");
  const meta = { competency: c.id, week: c.week, moveIds: MissionEngine.moveIds(c) };
  const att = (key, text, at) => Object.assign(MissionEngine.grade(c, g, text, { seconds: 20 }), { key, kind: "guided", missionId: g.id, at });
  const local = JSON.parse(JSON.stringify(S)), cloud = JSON.parse(JSON.stringify(S));
  local.v2A = { "general-english": {} }; cloud.v2A = { "general-english": {} };
  const IV = trackVocabularyIntervals();
  MissionEngine.introduce(local.v2A["general-english"], c.id, areaId(), 1e12);
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("a", SAY.noAsk, 1e12 + 1), areaId(), IV, meta);
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.introduce(cloud.v2A["general-english"], c.id, areaId(), 1e12 + 5);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("c", SAY.noStake, 1e12 + 3), areaId(), IV, meta);
  const m = fbMerge(local, cloud); const r = m.v2A["general-english"][id];
  const pr = fbSyncPayload(m).v2A["general-english"][id];
  return { keys: r.attempts.map(a => a.key).join(), state: r.state, introducedAt: r.introducedAt, saidLocal: r.attempts.every(a => typeof a.said === "string" && a.said.length > 0), saidCloud: pr.attempts.every(a => !("said" in a)), weeks: r.attempts.every(a => a.week === week && a.competency === id), buckets: Object.keys(m.v2A).join() };
}, { SAY, id: ID, week: WEEK });
ok("T · Two devices' Week 11 attempts union on the idempotency key (a, b, c — b once); state is recomputed; introducedAt is the earliest",
  merged.keys === "a,b,c" && merged.state === "DEMONSTRATED" && merged.introducedAt === 1e12, JSON.stringify(merged));
ok("T · The learner's words stay on the device and are stripped from the sync payload; every row is week 11 / win-support; no Welding bucket", merged.saidLocal && merged.saidCloud && merged.weeks && merged.buckets === "general-english");

console.log("\nU · DESKTOP");
const Dk = await learner("desk", GE, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
await restBefore(Dk.page);
const dkHome = await Dk.page.evaluate(async () => { go("home"); await new Promise(r => setTimeout(r, 300)); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, o: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth } }; });
ok("Desktop: Home offers the Week 11 card with no horizontal overflow", dkHome.n === 1 && /Week 11/i.test(dkHome.eyebrow || "") && dkHome.o.sw <= dkHome.o.cw, JSON.stringify(dkHome));
await shot(Dk.page, "1280-home");
const dk = await Dk.page.evaluate(async id => {
  const o = () => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth });
  mvGo(id + "-guided", "see"); await new Promise(r => setTimeout(r, 300)); const o0 = o();
  mvStep("hear"); await new Promise(r => setTimeout(r, 300)); const oh = o(), play = document.querySelectorAll(".mv-play button").length;
  mvStep("notice"); await new Promise(r => setTimeout(r, 400)); const o1 = o(), moves = document.querySelectorAll(".mv-list li").length, shadow = !!document.querySelector(".mv-shadow");
  mvStep("speak"); await new Promise(r => setTimeout(r, 300)); const o2 = o(), cta = document.querySelectorAll("#v-mission .rec-btn").length;
  return { o0, oh, play, o1, o2, moves, shadow, cta }; }, ID);
ok("Desktop: SEE, HEAR (two play buttons), NOTICE (five moves, no Shadow row) and SPEAK (one recorder) render with no horizontal overflow",
  dk.play === 2 && dk.moves === 5 && dk.shadow === false && dk.cta === 1 && [dk.o0, dk.oh, dk.o1, dk.o2].every(x => x.sw <= x.cw), JSON.stringify(dk));
await shot(Dk.page, "1280-speak");
coachCovered = ["stake", "cost", "evidence", "return"];
await Dk.page.evaluate(t => { window.__say = t; }, SAY.noAsk);
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
ok("Desktop: RETRY names the missing move with no overflow", dkRetry.step === "speak" && /make the ask/i.test(dkRetry.text || "") && dkRetry.sw <= dkRetry.cw);
await shot(Dk.page, "1280-retry");
coachCovered = ["stake", "cost", "evidence", "return", "ask"];
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
ok("Desktop: PROGRESS renders one panel per spoken competency (eleven) with no overflow", dkProg.panels === spokenComps.length && dkProg.sw <= dkProg.cw, JSON.stringify(dkProg));
await shot(Dk.page, "1280-progress");
if (SHOTS) { try { const el = await Dk.page.$(".pg-v2"); if (el) { await el.scrollIntoViewIfNeeded(); await Dk.page.screenshot({ path: `${SHOTS}/1280-progress-panels.png`, fullPage: true }); } } catch (e) {} }

console.log("\nV · NETWORK FAILURE (app)");
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
coachMode = "ok"; coachCovered = ["stake", "cost", "evidence", "return", "ask"];
await O.page.evaluate(() => mvFinishCoaching());
await O.page.waitForFunction(() => _mv && !_mv.busy, null, { timeout: 12000 }).catch(() => {});
await sleep(300);
const e3 = await O.page.evaluate(id => { const r = mvStore()[id]; return { n: r.attempts.length, pending: r.attempts[0].coachPending, ai: _mv.coach && _mv.coach.ai, state: r.state }; }, ID);
ok("Offline: recovery completes the coaching and creates no second piece of evidence; the Worker was called again", e3.n === 1 && e3.pending === false && e3.ai === true && e3.state === "DEMONSTRATED" && polishHits > hits0 + 1, JSON.stringify(e3));

console.log("\nW · WELDING ISOLATION (app)");
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
  aList("chHist").unshift({ kind: "challenge", ts: Date.now(), vid, title: "clip", rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" }, issues: [], drills: [] }); save();
  const harvested = mvHarvestShadow();
  const cur11 = activeCurriculum();
  go("review"); await new Promise(r => setTimeout(r, 300));
  return { area: areaId(), comps: mvComps().length, comp: mvComp(id), missions: cur11.missions, card, homeMentions: /Persuasion & stakeholder influence|what's at stake for them|cost of doing nothing|Back it with evidence|Show the return/i.test(homeTxt), view, html: (html || "").length,
    refused, harvested, unchanged, weldRows: weldRowsBefore, buckets: bucketsBefore, weldRowsAfter: Object.keys(((S.v2A || {}).welding) || {}).length, ev: window.v2Evidence(), rec: window.v2Recommendation(),
    panel: !!document.querySelector(".pg-v2"), events: (window.__ev || []).filter(e => e[0].startsWith("v2_")).length,
    weeks: (cur11.weeks || []).length, sims: (cur11.simulations || []).length, stage: (cur11.weeks[0] || {}).stage };
}, { id: ID, vid: W10.shadow.vid, week: WEEK });
ok("W1 · Welding's curriculum resolves missions to null — Week 11 does not reach it through inheritance", w.area === "welding" && w.missions === null && w.comps === 0 && w.comp === null, JSON.stringify({ a: w.area, m: w.missions, c: w.comps }));
ok("W2 · no V2 card and no Week 11 title or move wording on the Welding home", w.card === false && w.homeMentions === false);
ok("W3 · routing straight to the Week 11 mission turns a Welding learner around safely", w.view === "home" && w.html === 0, JSON.stringify({ v: w.view, len: w.html }));
ok("W4 · the engine refuses to write Week 11 evidence for a Welding learner; no Welding bucket is created", w.refused && w.unchanged && w.weldRows === 0 && !/welding/.test(w.buckets));
ok("W5 · no Week 11 analytics can be emitted from Welding, even with the competency passed in by hand", w.events === 0, String(w.events));
ok("W6 · both hooks return null and the Welding Progress page shows no V2 panel", w.ev === null && w.rec === null && w.panel === false);
ok("W7 · a Welding learner's Shadow work harvests nothing — no support row, no record", w.harvested === 0 && w.weldRowsAfter === 0, JSON.stringify({ h: w.harvested, rows: w.weldRowsAfter }));
ok("W8 · existing Welding curriculum is unchanged: 12 stages, 12 simulations", w.weeks === 12 && w.sims === 12 && /Stage 1/.test(w.stage || ""), JSON.stringify({ w: w.weeks, s: w.sims }));

ok("No uncaught page errors in any context", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
