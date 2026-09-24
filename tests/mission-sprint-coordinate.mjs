/* BE Mastery V2.8 — General English Week 8 "Sprint meetings, blockers &
   stakeholder coordination", end to end, and the data-only proof.

   Week 8 is the EIGHTH competency and it arrived as one entry in
   tracks/general/missions.json. This suite is the claim that nothing else had
   to change: the engine, the evidence contract, the state machine, the
   retrieval, the recommendation, the coach boundary, the Home card, the
   Progress panel, the cloud merge, the Shadow link and the Welding wall all
   behave for a competency they had never seen.

   The five moves are STATUS → BLOCKER → IMPACT → RE-SEQUENCE → COORDINATE.
   The situation supplies the work, the dependency and the people; the learner
   has to run the coordination turn. Agile vocabulary is not the bar: "we're
   waiting on…", "the dependency is…", "we may need to…", "to keep the sprint
   on track…" each prove at most the one move they belong to.

   Canonical numbering: the `week` of a competency is the General English
   programme week it teaches — Week 8 is "Sprint meetings, blockers &
   stakeholder coordination" in weeks.json. See the _note in missions.json.

   Run:  cd tests && node mission-sprint-coordinate.mjs
         SHOTS=/some/dir node mission-sprint-coordinate.mjs   (also saves screenshots) */
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

const ID = "sprint-coordinate";
const WEEK = 8;
const by = id => ME.competencyOf(PACK, id);
const W1 = by("explain-work"), W2 = by("clear-update"), W3 = by("raise-problem"), W4 = by("clarify-confirm"), W5 = by("explain-tech"), W6 = by("recommend-decide"), W7 = by("disagree-pushback");
const W8 = by(ID);
const guidedOf = c => (c.missions || []).find(m => m.kind === "guided"), transferOf = c => (c.missions || []).find(m => m.kind === "transfer");
const G1 = guidedOf(W1), G6 = guidedOf(W6), G7 = guidedOf(W7);
const G8 = W8 && ME.missionOf(W8, ID + "-guided"), T8 = W8 && ME.missionOf(W8, ID + "-transfer");
const CLIP = W8 && W8.shadow && W8.shadow.vid;
const IV = [1, 3, 7, 21, 60];
const GE = "general-english";
const MOVES = "status,blocker,impact,resequence,coordinate";
const LABELS = "Say where it stands,Name the blocker,Say what it means for the sprint,Re-sequence the work,Coordinate the ask and the ETA";
const meta = c => ({ competency: c.id, week: c.week, moveIds: ME.moveIds(c) });
const mk = (c, m, text, kind, key, at) => Object.assign(ME.grade(c, m, text, { seconds: 27 }),
  { key, kind, at: at || Date.now(), missionId: m.id });

/* ── what the learners will say ──────────────────────────────────────────── */
const SAY = {
  strong: G8 && G8.hear.model,
  /* straight into the blocker with no headline */
  noStatus: "The payment step is blocked: we're waiting on sandbox credentials from the payment vendor, requested last Thursday, nothing back yet. That puts the Friday demo at risk — without credentials by Wednesday, checkout won't be in the demo. So I'd re-sequence: I'll pick up the order-confirmation email story today, and pull payments back in as soon as the credentials land. Sam, could you chase the vendor contact today? If they arrive by Wednesday, the ETA for checkout is still Friday.",
  /* the vague-update habit: 'isn't started', no dependency named */
  noBlocker: "Checkout is two of three steps done — cart and address are finished and tested. The payment step isn't started. That puts the Friday demo at risk — without it by Wednesday, checkout won't be in the demo. So I'd re-sequence: I'll pick up the order-confirmation email story today, and come back to payments after. Sam, could you chase the vendor contact today? If we're clear by Wednesday, the ETA for checkout is still Friday.",
  noImpact: "Checkout is two of three steps done — cart and address are finished and tested. The payment step is blocked: we're waiting on sandbox credentials from the payment vendor, requested last Thursday, nothing back yet. So I'd re-sequence: I'll pick up the order-confirmation email story today, and pull payments back in as soon as the credentials land. Sam, could you chase the vendor contact today? If they arrive by Wednesday, the ETA for checkout is still Friday.",
  /* the report-and-wait habit: blocked, and nothing done about the sprint */
  noResequence: "Checkout is two of three steps done — cart and address are finished and tested. The payment step is blocked: we're waiting on sandbox credentials from the payment vendor, requested last Thursday, nothing back yet. That puts the Friday demo at risk — without credentials by Wednesday, checkout won't be in the demo. Sam, could you chase the vendor contact today? If they arrive by Wednesday, the ETA for checkout is still Friday.",
  /* everything except a name and a date */
  noCoordinate: "Checkout is two of three steps done — cart and address are finished and tested. The payment step is blocked: we're waiting on sandbox credentials from the payment vendor, requested last Thursday, nothing back yet. That puts the Friday demo at risk — without credentials by Wednesday, checkout won't be in the demo. So I'd re-sequence: I'll pick up the order-confirmation email story today, and pull payments back in as soon as the credentials land.",
  transfer: "The landing page is built and both banner variants are ready to test. The sign-up form is blocked: the dependency is legal's review of the prize-draw terms — they've had them since Monday and said end of week. Without approved terms the form can't go live, so the first is at risk for sign-ups. To keep the launch on track, I'd go out on the first with the newsletter and no prize draw, and add the draw the week after when legal comes back. Could you ping the head of legal today and let me know by Thursday? If the terms land by Thursday, the form is live for the first; either way the newsletter goes out on the first.",
  transferWeak: "The landing page is built and both banner variants are ready to test. The sign-up form is blocked: the dependency is legal's review of the prize-draw terms — they've had them since Monday. Without approved terms the form can't go live, so the first is at risk for sign-ups. To keep the launch on track, I'd go out on the first with the newsletter and no prize draw, and add the draw the week after when legal comes back.",
  /* browser speech recognition usually returns one unpunctuated run */
  unpunctuated: G8 && G8.hear.model.toLowerCase().replace(/[—:,.?;]/g, "").replace(/\s+/g, " "),
  /* Agile words with no move inside them */
  jargon: "Sprint, backlog, velocity, story points, retro, stand-up, scrum, kanban, agile — that is where we are.",
  short: "Blocked.",
  seven: "Checkout is blocked on the vendor still.",
  eight: "Checkout is still blocked on the payment vendor.",
};
/* Weeks 1–7, to put them to rest when the question is whether Week 8 waits
   its turn. Keyed by competency id so both the engine cases and the browser
   cases walk the pack rather than a numbered list. */
const REST = {
  "explain-work": { guided: G1.hear.model, transfer: "I am a project coordinator on the delivery team. I look after the schedule and the supplier paperwork for your account. Right now I am preparing the plan for your first shipment. I work closely with our warehouse and your logistics contact, so that nothing on your side has to be chased by hand." },
  "clear-update": { guided: "The project is on track and we have completed two stages. We have run into an issue with the design agency. This means Friday delivery is at risk by about two days. I will chase it up today and come back to you tomorrow.", transfer: "Installation is due to start on Monday and everything else is ready. The materials from the supplier arrived three days late. That means we will push back the handover and the end of month promise is at risk. I will confirm a new date with the customer and come back to you this afternoon." },
  "raise-problem": { guided: guidedOf(W3).hear.model, transfer: "There is a problem with the monthly figures. It started when the old report was switched off in August, so two months of numbers may be wrong. This means the Thursday board pack is at risk. I have spoken to finance and asked them to rerun the numbers. Could you sign off on a one-day delay so we can check them?" },
  "clarify-confirm": { guided: guidedOf(W4).hear.model, transfer: "Sorry, I'm not sure I follow — the client thing could be two things. Are you asking about the revised quote or the delivery date they wanted? So you're saying it's the quote they're expecting before Wednesday's review. Then I'll send the quote today and come back to you tomorrow on the delivery date — does that work?" },
  "explain-tech": { guided: guidedOf(W5).hear.model, transfer: "In plain terms, the integration is a link between their shop and our warehouse. The way it works is that every time a customer places an order, it goes straight to the warehouse system automatically, instead of someone typing it in each morning. What this means for the client is that orders ship the same day and the typing mistakes stop. The one thing to remember is that returns aren't included yet — those are still done by hand. Does that make sense?" },
  "recommend-decide": { guided: G6.hear.model, transfer: "There are two options here. One option is to send it tomorrow with the numbers corrected by hand, and the other option is to hold it for two days and rerun everything from the fixed source. My recommendation is to hold it. The reason is that last quarter they complained about a wrong figure, and two of the twelve charts can't be checked in time if we send tomorrow. The downside is that it's the first late report we've ever sent them. So the next step is that you tell the client today that it's coming on Thursday, and I'll rerun it as soon as the source is fixed." },
  "disagree-pushback": { guided: G7.hear.model, transfer: "I understand why the director wants one go — a phased move takes longer, and nobody wants this dragging into next year. I'd push back on doing the whole warehouse in one weekend, though. The reason is the pilot: at the small depot the switch took two weeks to settle, forty stock counts were wrong in the first week, and the main warehouse holds twenty times the stock. What I'd suggest is that we switch the night team first, since they're already trained, and bring the day shifts across two weeks later. We both want this done before December, and that way we still finish by the end of November without a weekend where nothing can be counted. What would the director need to see to agree to that?" },
};
const W1_NO_WHY = "I work as an operations analyst in the logistics team. I'm responsible for the weekly delivery reports. At the moment I'm rebuilding how we track late shipments. I work closely with the warehouse managers.";
const W3_NO_ASK = "We have got a problem with the delivery. It started when the supplier changed the order number. This means we would finish three days late. I have already spoken to their office.";
/* cold transfers for any competency after Week 8, keyed by id — a new week adds one entry */
SAY.transfers = {
  "exec-summary": "The short version: the savings programme reaches its 400 thousand target this year only if we close the third supplier, and that needs a decision from you before Friday. At a high level, two of the four contracts are signed, worth 260 thousand, and the fourth signs next month for another 60. The biggest risk is the third supplier \u2014 110 thousand of the target \u2014 where the negotiation has stalled for three weeks on payment terms: they want 60 days, our standard is 45. Finance can live with 60 days if you agree, and their offer lapses on Friday. The decision I need from you is whether we accept 60-day terms to close it this week. The key takeaway: without the third contract we land at 320, short of target; with it, we're over.",
  "sell-experience": "The challenge was that our forty field engineers were driving two hours forty a day between jobs. Overtime was thirty per cent over budget, and two engineers had resigned because of the driving. Nobody had looked at routing since the company doubled in size, so I led the effort to fix it. I pulled the last three months of job data with an analyst from the planning team, and we found jobs were assigned by who was free, not by where they were. The dispatchers were worried customers would wait longer, so I influenced the decision by asking the director for one region and six weeks, with waiting times measured too. The result was that driving fell to an hour fifty and overtime came back within budget, and waiting times didn't move. It's now live in all four regions. That experience taught me that I do my best work where data and persuasion meet, and that's the role I'm looking for next.",
  "win-support": "What's at stake here is your output per shift, because the line is going to stop either way — the only question is whether we choose when. The cost of doing nothing is five unplanned breakdowns in six months at about nine hours each, so forty-five hours of lost packing against sixteen for a planned stop. I'm confident because we have six months of readings on that gearbox and it is the same rising pattern that ran before the last two failures; the bearing supplier's own data gives it about three months before it seizes. Two planned days buys us back the twenty-nine hours we are losing to breakdowns, and it pays for itself the first time it stops one. Here's what I need from you: two days in the quiet fortnight in November. The window to act is before December, because we cannot stop the line in peak and the gearbox warranty is gone at the end of the month.",
  "final-integration": "Quick status: the routing has been running correctly in four of the five queues on the bench for three weeks. Just to make sure I understand — when you say all queues, does that include the vulnerable-customer queue? Because the lab test never covered it. I have one concern about switching that queue without a parallel run. Last year a routing change dropped about one in twelve vulnerable call-backs for a day, and we had to tell the regulator. What I'd recommend is switching the four proven queues on Friday and holding the fifth for a two-day parallel run the week after. Bottom line: you get Friday on four queues, and the one with the legal duty gets checked first.",
};
const EARLIER = PACK.competencies.filter(c => c.week < WEEK).sort((a, b) => a.week - b.week);
const LATER = PACK.competencies.filter(c => c.week > WEEK).sort((a, b) => a.week - b.week);

/* ═══════════ A · PACK ═══════════════════════════════════════════════════ */
console.log("\nA · THE PACK");
ok("A · Week 8 exists, is numbered 8, carries the canonical title, five moves and two missions",
  W8 && W8.week === WEEK && W8.title === "Sprint meetings, blockers & stakeholder coordination" && ME.moveIds(W8).join() === MOVES && W8.missions.length === 2, W8 && ME.moveIds(W8).join());
ok("A · The title is weeks.json's own Week 8 theme, word for word; the numbering is consecutive from 1 with Week 8 eighth — whatever the count",
  WEEKS.find(w => w.n === WEEK).theme === W8.title && PACK.competencies.map(c => c.week).join() === PACK.competencies.map((_, i) => i + 1).join() && PACK.competencies[WEEK - 1].id === ID, WEEKS.find(w => w.n === WEEK).theme);
ok("A · The competency id is semantic, like the seven before it — not derived from the week number",
  /^[a-z]+-[a-z]+$/.test(W8.id) && !/8|eight|week/.test(W8.id) && PACK.competencies.every(c => /^[a-z]+-[a-z]+$/.test(c.id)));
ok("A · Every earlier competency the suite rests on has a fixture here, keyed by id", EARLIER.length === WEEK - 1 && EARLIER.every(c => REST[c.id] && REST[c.id].guided && REST[c.id].transfer), EARLIER.map(c => c.id).join());
ok("A · The pack note records Week 8, its move order and the Shadow decision — and still records Weeks 6 and 7", /Week 8/.test(PACK._note) && /status → blocker → impact → resequence → coordinate/.test(PACK._note) && /-5q6tNovay8/.test(PACK._note)
  && /Week 7/.test(PACK._note) && /acknowledge → disagree → reason → alternative → align/.test(PACK._note) && /options → recommend → reason → tradeoff → next/.test(PACK._note));
ok("A · The guided mission loads with the situation, the model, the prompt and the context",
  G8 && G8.kind === "guided" && G8.see && G8.see.where && G8.see.who && G8.see.asks && G8.see.goal && G8.hear && G8.hear.model && G8.hear.note && G8.prompt === G8.see.asks && G8.context);
ok("A · The transfer mission loads: a different listener, dependency, work, impact and coordination decision, no model to copy",
  T8 && T8.kind === "transfer" && !T8.hear && T8.prompt !== G8.prompt && T8.see.who !== G8.see.who && /still good for the first/i.test(T8.prompt) && !/checkout|payment|vendor|sprint|demo/i.test(T8.context) && !/legal|newsletter|prize|banner|marketing/i.test(G8.context));
ok("A · Both situations supply the status, the dependency, the impact, the re-sequencing option and the people — the learner invents nothing",
  /Cart and address are finished and tested/.test(G8.context) && /sandbox credentials from the payment vendor/.test(G8.context) && /Sam, the product owner, has the vendor contact/.test(G8.context) && /if not, checkout misses it/.test(G8.context) && /order-confirmation email story/.test(G8.context) && /arrive by Wednesday/.test(G8.context)
  && /landing page is built/.test(T8.context) && /legal has had them since Monday/.test(T8.context) && /knows the head of legal/.test(T8.context) && /without the prize draw/.test(T8.context) && /Thursday the 27th/.test(T8.context) && /added the week after/.test(T8.context));
ok("A · The goal names the week's own bar — a coordination turn, not 'blocked' — and the transfer says nobody is prompting",
  /Don't just say 'blocked'/.test(G8.see.goal) && /coordinate the ask and the ETA/i.test(G8.see.goal) && /Nobody is prompting you/i.test(T8.see.goal));
ok("A · Exactly five moves, each with an id, a label, a hint, at least 40 phrase cues, a retry line, three patterns and a cue note",
  W8.moves.length === 5 && W8.moves.every(m => m.id && m.label && m.hint && Array.isArray(m.cues) && m.cues.length >= 40 && m.retry && Array.isArray(m.patterns) && m.patterns.length === 3 && typeof m._cue_note === "string"));
ok("A · The move labels are observable behaviours, not outcomes", W8.moves.map(m => m.label).join() === LABELS && !W8.moves.some(m => /clearly|collaborat|stakeholders|effective/i.test(m.label)));
ok("A · Every cue is lowercase and unique within its move, and no cue of one move is contained in a cue of another",
  W8.moves.every(m => new Set(m.cues).size === m.cues.length && m.cues.every(q => q === q.toLowerCase()))
  && W8.moves.every((a, i) => W8.moves.every((b, j) => i === j || a.cues.every(x => b.cues.every(y => !x.includes(y))))));
ok("A · No cue is a bare frame: 'we may need to', 'let's move it', 'because', 'on track', 'we need to', 'we're behind schedule'-style dates, 'the checkout story', 'sprint', 'retro', 'stand-up' never appear as cues on their own",
  W8.moves.every(m => m.cues.every(c => !["we may need to", "let's move it", "because", "on track", "we need to", "the checkout story", "sprint", "retro", "stand-up", "standup", "the ticket", "friday", "the demo is friday", "so", "that means"].includes(c))));
ok("A · Every Week 8 expression is tagged to a move that exists, and most come from the curriculum's own Week 8 'Agile & Delivery' phrases",
  W8.expressions.length === 8 && W8.expressions.every(e => ME.moveIds(W8).includes(e.move) && e.w && e.def && e.l)
  && W8.expressions.filter(e => PHRASES.phrases.some(p => p.w === WEEK && AE.hits(p.p, e.w))).length >= 6, JSON.stringify(W8.expressions.map(e => e.w)));
ok("A · The Shadow decision is explicit: a real catalogue clip with captions, and a `why` that says which four of the five moves it models and that the impact is only loose",
  !!W8.shadow && CLIP === "-5q6tNovay8" && !!CATALOGUE.videos[CLIP] && /Project Update/i.test(W8.shadow.title) && /four of the five/.test(W8.shadow.why) && /status, blocker, re-sequence and coordinate/.test(W8.shadow.why) && /impact only loosely/.test(W8.shadow.why) && /without standing in for it/.test(W8.shadow.why)
  && (() => { try { return JSON.parse(readFileSync(ROOT + "captions/" + CLIP + ".json", "utf8")).cues.length > 50; } catch (e) { return false; } })());
ok("A · …and the _shadow_note records the content check, why the false hits were false, the runners-up and the library gap",
  typeof W8._shadow_note === "string" && /content check/i.test(W8._shadow_note) && /stand-up comedy/.test(W8._shadow_note) && /eh4M5Rviw04/.test(W8._shadow_note) && /sepg2j0NTXc/.test(W8._shadow_note) && /gap/i.test(W8._shadow_note) && /Monday task/.test(W8._shadow_note));
ok("A · The cue decisions are written down: a ticket name, a date, 'because', 'we may need to', 'let's move it', 'to keep the sprint on track' and 'the dependency is' are each named as non-evidence for the moves they do not prove",
  (() => { const s = ME.moveOf(W8, "status")._cue_note, b = ME.moveOf(W8, "blocker")._cue_note, i = ME.moveOf(W8, "impact")._cue_note, r = ME.moveOf(W8, "resequence")._cue_note, k = ME.moveOf(W8, "coordinate")._cue_note;
    return /ticket/.test(s) && /We're behind/.test(s) && /We're waiting on/.test(b) && /ticket/.test(b) && /because/.test(b) && /deadline/i.test(i) && /The dependency is/.test(i) && /We're behind/.test(i)
      && /We may need to/.test(r) && /let's move it/.test(r) && /To keep the sprint on track/.test(r) && /coordination/.test(r) && /To keep the sprint on track/.test(k) && /date on its own/.test(k); })());

/* ═══════════ B · MOVE GRADING ═══════════════════════════════════════════ */
console.log("\nB · MOVE GRADING");
const padded = t => t + " and a few more words to reach the minimum";
const made = e => Object.keys(e.moves).filter(k => e.moves[k]).join();
const grade = (t, s = 8) => ME.grade(W8, G8, t, { seconds: s });
const only = (text, m) => made(grade(text)) === m;
const none = text => grade(text).coverage === 0;
ok("B · Each move's own patterns credit that move and only that move", W8.moves.every(m => m.patterns.every(pt => only(padded(pt), m.id))), W8.moves.map(m => m.id + ":" + m.patterns.map(pt => made(grade(padded(pt)))).join("/")).join(" "));
ok("B · Each expression, when spoken, credits the move it is tagged to and counts as vocabulary used",
  W8.expressions.every(x => { const e = grade(padded(x.w), 5); return e.moves[x.move] === true && e.vocabUsed.includes(x.w); }));
ok("B · 'two of three steps done' is a status; 'we're waiting on' a blocker; 'that puts the demo at risk' an impact; 'I'll pick up the email story' a re-plan; 'could you chase the vendor' coordination — one each",
  only(padded("Checkout is two of three steps done"), "status") && only(padded("We're waiting on the payment vendor"), "blocker") && only(padded("That puts the Friday demo at risk"), "impact")
  && only(padded("I'll pick up the email story today"), "resequence") && only(padded("Sam, could you chase the vendor today"), "coordinate"));
const gm = grade(SAY.strong, 45);
ok("B · The model answer makes all five moves on its own rubric, in the taught order, and uses at least two of the curriculum's own expressions",
  gm.coverage === 1 && ME.passes(gm) && gm.clarity === 1 && gm.clarityBasis === "order+length" && gm.vocabUsed.length >= 2, "missed=" + gm.missed.join() + " vocab=" + gm.vocabUsed.join("|"));
ok("B · An unpunctuated transcript — what browser speech recognition actually returns — still makes all five moves; clarity rests on order alone",
  (() => { const e = grade(SAY.unpunctuated, 45); return e.coverage === 1 && ME.passes(e) && e.clarityBasis === "order"; })());
console.log("   status ≠ blocker ≠ impact ≠ re-sequence ≠ coordination");
ok("B · status ≠ blocker: 'two of three done, the rest is in progress' names no dependency", only("Checkout is two of three steps done and the rest is in progress this week.", "status"));
ok("B · blocker ≠ impact: 'We're waiting on the vendor' proves a blocker and no impact", (() => { const e = grade(padded("We're waiting on the payment vendor")); return e.moves.blocker === true && e.moves.impact === false && e.coverage === 0.2; })());
ok("B · blocker ≠ impact: 'The dependency is the legal review' proves a blocker and no impact", (() => { const e = grade("The dependency is the legal review of the terms, that is the situation."); return e.moves.blocker === true && e.moves.impact === false && e.coverage === 0.2; })());
ok("B · impact ≠ re-sequence: 'that puts the demo at risk, we'll miss the sprint' proposes nothing", only("That puts the demo at risk and we'll miss the sprint goal on this one.", "impact"));
ok("B · re-sequence ≠ coordination: 'To keep the sprint on track, we could pull the email story forward' names no person and no date", (() => { const e = grade("To keep the sprint on track, we could pull the email story forward this week."); return e.moves.resequence === true && e.moves.coordinate === false && e.coverage === 0.2; })());
ok("B · coordination ≠ re-sequence: 'Sam, could you chase the vendor? The ETA is still Friday' re-plans nothing", only("Sam, could you chase the vendor contact today? The ETA is still Friday for checkout.", "coordinate"));
console.log("   the cue traps named in the pack");
ok("B · 'We may need to look at it again' proves nothing; 'We may need to re-sequence' is a re-plan and nothing else", none("We may need to look at it again next week, we will see how it goes.") && only(padded("We may need to re-sequence"), "resequence"));
ok("B · 'To keep the sprint on track, we should all try harder' is a corrective-action opener — re-sequence only, never coordination", (() => { const e = grade("To keep the sprint on track, we should really all try a bit harder."); return made(e) === "resequence" && e.moves.coordinate === false; })());
ok("B · A ticket name or a story name alone is no move", none("CHK-1234 is the ticket and the checkout story is the one we're talking about."));
ok("B · A deadline alone is no impact — and no move at all", none("The deadline is Friday and the demo is on Friday afternoon at three."));
ok("B · 'Because…' alone is no blocker and no move", none("Because the vendor is slow and because legal is slow, that is why."));
ok("B · 'We're behind' is a status, not an impact", (() => { const e = grade(padded("We're behind")); return made(e) === "status" && e.moves.impact === false; })());
ok("B · 'Let's move it' proves nothing; 'Let's move it to next sprint' is a re-plan", none(padded("Let's move it")) && only(padded("Let's move it to next sprint"), "resequence"));
ok("B · Agile vocabulary on its own makes no move", none(SAY.jargon));
ok("B · A keyword salad — 'we're waiting on the dependency, the sprint goal, we may need to re-sequence, the ETA' — earns at most a blocker and a re-plan, never a pass",
  (() => { const e = grade("We're waiting on the dependency, the sprint goal, we may need to re-sequence, the ETA."); return made(e) === "blocker,resequence" && !ME.passes(e); })());
ok("B · Week 3's opener 'we've run into an issue with…' is not a Week 8 blocker", none("We have run into an issue with the design agency and it is causing problems."));
ok("B · Week 2's clear update on the Week 8 rubric: status, impact and a chase — never a named dependency, never a re-plan — not passed",
  (() => { const e = grade(REST["clear-update"].guided, 30); return e.moves.status === true && e.moves.blocker === false && e.moves.resequence === false && !ME.passes(e); })(), made(grade(REST["clear-update"].guided, 30)));
ok("B · Week 2's own model answer and Week 3's model answer do not pass Week 8", !ME.passes(grade(guidedOf(W2).hear.model, 30)) && !ME.passes(grade(guidedOf(W3).hear.model, 30)), made(grade(guidedOf(W2).hear.model, 30)) + " | " + made(grade(guidedOf(W3).hear.model, 30)));
ok("B · Week 7's model answer makes no Week 8 blocker and does not pass", (() => { const e = grade(G7.hear.model, 40); return e.moves.blocker === false && !ME.passes(e); })(), made(grade(G7.hear.model, 40)));
ok("B · The phrase bank's own lines each make the move they teach and no other: 'That's outside the current scope' and 'Let's park that and come back to it' protect the sprint (re-sequence); 'The ETA is end of sprint' and 'I'll raise that in the retro' coordinate; 'The acceptance criteria aren't fully clear yet' flags ambiguity and is no move",
  only(padded("That's outside the current scope"), "resequence") && only("Let's park that and come back to it, and a few more words to reach the minimum.", "resequence") && only(padded("The ETA is end of sprint"), "coordinate") && only(padded("I'll raise that in the retro"), "coordinate") && none("The acceptance criteria aren't fully clear yet, and a few more words here."));
ok("B · A status opener 'Quick update on checkout' is not coordination", none("Quick update on checkout: nothing to report today, thanks everyone."));

/* ═══════════ C · GUIDED ═════════════════════════════════════════════════ */
console.log("\nC · GUIDED");
const miss = (text, id) => { const e = grade(text, 30); return e.coverage === 0.8 && !ME.passes(e) && e.moves[id] === false && ME.weakestMove(W8, e, []) === id; };
ok("C · A complete answer passes", ME.passes(gm));
ok("C · Straight into the blocker with no headline: 0.8, not passed, 'status' weakest", miss(SAY.noStatus, "status"));
ok("C · The vague-update habit ('isn't started', no dependency named): 0.8, not passed, 'blocker' weakest", miss(SAY.noBlocker, "blocker"));
ok("C · Without the impact: 0.8, not passed, 'impact' weakest", miss(SAY.noImpact, "impact"));
ok("C · The report-and-wait habit (blocked, and nothing done about the sprint): 0.8, not passed, 'resequence' weakest", miss(SAY.noResequence, "resequence"));
ok("C · Everything except a name and a date: 0.8, not passed, 'coordinate' weakest", miss(SAY.noCoordinate, "coordinate"));
ok("C · Four of five is 'strong' coverage by band and still not demonstrated — the bar is every move", (() => { const e = grade(SAY.noCoordinate, 30); return e.verdict === "strong" && !ME.passes(e); })());
ok("C · Deterministic coaching names the missing blocker and hands back its own retry line from the pack",
  (() => { const f = ME.shapeCoach(null, W8, mk(W8, G8, SAY.noBlocker, "guided", "c0")); return f.move === "blocker" && f.retry === ME.moveOf(W8, "blocker").retry && /name the blocker/i.test(f.retry) && f.ai === false; })());
ok("C · …and for each other missing move the retry is that move's own line",
  [["noStatus", "status"], ["noImpact", "impact"], ["noResequence", "resequence"], ["noCoordinate", "coordinate"]].every(([k, id]) => ME.shapeCoach(null, W8, mk(W8, G8, SAY[k], "guided", "c" + id)).retry === ME.moveOf(W8, id).retry));
ok("C · The missing move's expressions are queued to learn; the ones used are queued to keep",
  (() => { const q = ME.expressionsToLearn(W8, grade(SAY.noBlocker, 30), "blocker");
    return q.some(e => e.move === "blocker" && e.why === "missing") && q.every(e => W8.expressions.some(x => x.w === e.w)); })());
ok("C · A retry that adds the missing move recovers: PRACTICING → DEMONSTRATED, both attempts kept",
  (() => { const s = {}; ME.introduce(s, W8.id, GE); ME.addAttempt(s, W8.id, mk(W8, G8, SAY.noBlocker, "guided", "r1"), GE, IV, meta(W8)); const before = s[W8.id].state;
    ME.addAttempt(s, W8.id, mk(W8, G8, SAY.strong, "retry", "r2"), GE, IV, meta(W8));
    return before === "PRACTICING" && s[W8.id].state === "DEMONSTRATED" && s[W8.id].attempts.length === 2 && s[W8.id].attempts[1].kind === "retry"; })());
ok("C · One word is not an answer; seven is not; eight is, scored on its merits — the bar is the engine's MIN_WORDS",
  !grade(SAY.short, 2).answered && !grade(SAY.seven, 4).answered && (() => { const e = grade(SAY.eight, 4); return e.answered && !ME.passes(e) && e.coverage === 0.2 && e.moves.blocker === true; })() && ME.MIN_WORDS === 8);

/* ═══════════ D · TRANSFER ═══════════════════════════════════════════════ */
console.log("\nD · TRANSFER");
const gT = t => ME.grade(W8, T8, t, { seconds: 40 });
ok("D · The transfer fixture makes all five moves cold from the supplied facts", gT(SAY.transfer).coverage === 1, "missed=" + gT(SAY.transfer).missed.join());
ok("D · Without the ask and the ETA the transfer does not pass", (() => { const e = gT(SAY.transferWeak); return e.coverage === 0.8 && !ME.passes(e) && ME.weakestMove(W8, e, []) === "coordinate"; })());
ok("D · The transfer is not the guided answer re-used: the two answers share no sentence of more than five words, and neither mentions the other's facts",
  (() => { const sents = t => t.split(/[.!?]/).map(x => x.trim().toLowerCase()).filter(x => x.split(/\s+/).length > 5); const a = sents(SAY.transfer), b = sents(G8.hear.model);
    return a.length >= 4 && a.every(x => !b.includes(x)) && !/checkout|payment|vendor|sam\b|demo|sprint/i.test(SAY.transfer) && !/legal|newsletter|prize|banner|marketing/i.test(G8.hear.model); })());
ok("D · The guided model answer is about the wrong work for the transfer — a checkout story and a vendor where the transfer has a sign-up form and legal",
  !/checkout|vendor|payment/i.test(T8.context) && /checkout/i.test(G8.hear.model) && /vendor/i.test(G8.hear.model));
ok("D · Every fact the transfer fixture uses is in the transfer context — nothing invented",
  /landing page is built/.test(T8.context) && /banner variants/.test(T8.context) && /legal's review/.test(T8.context) && /since Monday/.test(T8.context) && /end of week/.test(T8.context) && /Thursday the 27th/.test(T8.context) && /without the prize draw/.test(T8.context) && /the week after/.test(T8.context) && /head of legal/.test(T8.context));
ok("D · The transfer changes the listener, the dependency, the work, the impact and the coordination decision — not just the names",
  /marketing lead/i.test(T8.see.who) && /scrum master/i.test(G8.see.who) && /legal/.test(T8.context) && /vendor/.test(G8.context) && /sign-up form/.test(T8.context) && /checkout story/.test(G8.context) && /launch is the first/i.test(T8.see.where) && /demo is Friday/i.test(G8.context));

/* ═══════════ E · PROGRESSION ════════════════════════════════════════════ */
console.log("\nE · PROGRESSION");
const L8 = {};
const D = 86400000, T0 = Date.parse("2026-11-02T10:00:00Z");
ok("E · NOT_STARTED before anything", ME.record(L8, W8.id).state === "NOT_STARTED" && ME.stateFrom(ME.blank(W8.id)) === "NOT_STARTED");
ME.introduce(L8, W8.id, GE, T0);
ok("E · SEE/HEAR/NOTICE → INTRODUCED and no further", L8[W8.id].state === "INTRODUCED");
ME.addAttempt(L8, W8.id, mk(W8, G8, SAY.noBlocker, "guided", "p1", T0 + 60000), GE, IV, meta(W8));
ok("E · A partial attempt → PRACTICING, retrieval due now for 'practice'", L8[W8.id].state === "PRACTICING" && L8[W8.id].retrieval.reason === "practice" && L8[W8.id].retrieval.due === T0 + 60000);
ME.addAttempt(L8, W8.id, mk(W8, G8, SAY.jargon, "retry", "p1b", T0 + 90000), GE, IV, meta(W8));
ok("E · A failed guided attempt (jargon only, no moves) stays PRACTICING and is kept as evidence", L8[W8.id].state === "PRACTICING" && L8[W8.id].attempts.length === 2 && L8[W8.id].attempts[1].coverage === 0, String(L8[W8.id].attempts[1].coverage));
ME.addAttempt(L8, W8.id, mk(W8, G8, SAY.strong, "retry", "p2", T0 + 120000), GE, IV, meta(W8));
ok("E · A full guided answer → DEMONSTRATED, due now for the transfer", L8[W8.id].state === "DEMONSTRATED" && L8[W8.id].retrieval.reason === "transfer");
ME.addAttempt(L8, W8.id, mk(W8, T8, SAY.transferWeak, "transfer", "p2b", T0 + 150000), GE, IV, meta(W8));
ok("E · A failed transfer stays DEMONSTRATED, counts against the tally, and sends the learner back to guided reps",
  L8[W8.id].state === "DEMONSTRATED" && L8[W8.id].transfer.failed === 1 && L8[W8.id].transfer.passed === 0 && ME.recommend(L8[W8.id], W8, T0 + 150000).reason === "transfer_failed");
ME.addAttempt(L8, W8.id, mk(W8, T8, SAY.transfer, "transfer", "p3", T0 + 180000), GE, IV, meta(W8));
ok("E · One cold success → TRANSFER_READY with a retrieval on the first interval (1 day)", L8[W8.id].state === "TRANSFER_READY" && L8[W8.id].transfer.passed === 1 && L8[W8.id].retrieval.reason === "retrieval" && L8[W8.id].retrieval.due === T0 + 180000 + D);
ME.addAttempt(L8, W8.id, mk(W8, T8, SAY.transfer, "transfer", "p4", T0 + 200000), GE, IV, meta(W8));
ok("E · A second cold success the SAME day is still TRANSFER_READY, spaced on the next interval (3 days)", L8[W8.id].state === "TRANSFER_READY" && L8[W8.id].transfer.passed === 2 && L8[W8.id].retrieval.due === T0 + 200000 + 3 * D);
ME.addAttempt(L8, W8.id, mk(W8, T8, SAY.transfer, "transfer", "p5", T0 + 2 * D), GE, IV, meta(W8));
ok("E · A cold success on another day → STRONG, spaced further (21 days)", L8[W8.id].state === "STRONG" && L8[W8.id].retrieval.reps === 4 && L8[W8.id].retrieval.due === T0 + 2 * D + 21 * D);
ok("E · The schedule is the track's — a different ladder is honoured", (() => { const s = {}; ME.introduce(s, W8.id, GE, T0); ME.addAttempt(s, W8.id, mk(W8, G8, SAY.strong, "guided", "q1", T0), GE, [2, 5], meta(W8));
  ME.addAttempt(s, W8.id, mk(W8, T8, SAY.transfer, "transfer", "q2", T0 + 1000), GE, [2, 5], meta(W8)); return s[W8.id].retrieval.due === T0 + 1000 + 2 * D; })());
console.log("   deterministic next recommendation");
const R = {};
ok("E · Unspoken → speak the guided mission", (() => { const r = ME.recommend(ME.blank(W8.id), W8, T0); return r.action === "speak" && r.missionId === ID + "-guided" && r.reason === "not_spoken_yet"; })());
ME.introduce(R, W8.id, GE, T0); ME.addAttempt(R, W8.id, mk(W8, G8, SAY.noResequence, "guided", "s1", T0), GE, IV, meta(W8));
ok("E · Weak → retry the same mission on the missing move", (() => { const r = ME.recommend(R[W8.id], W8, T0); return r.action === "retry" && r.move === "resequence" && r.reason === "weak_move"; })());
ME.addAttempt(R, W8.id, mk(W8, G8, SAY.strong, "retry", "s2", T0 + 1), GE, IV, meta(W8));
ok("E · Demonstrated → take the transfer", (() => { const r = ME.recommend(R[W8.id], W8, T0 + 1); return r.action === "transfer" && r.missionId === ID + "-transfer"; })());
ME.addAttempt(R, W8.id, mk(W8, T8, SAY.transfer, "transfer", "s3", T0 + 2), GE, IV, meta(W8));
ok("E · Transfer-ready and not yet due → rest with the date; once due → a retrieval on the transfer mission",
  ME.recommend(R[W8.id], W8, T0 + 3).action === "rest" && ME.recommend(R[W8.id], W8, R[W8.id].retrieval.due + 1).action === "retrieval" && ME.recommend(R[W8.id], W8, R[W8.id].retrieval.due + 1).missionId === ID + "-transfer");
ok("E · Pending coaching outranks everything", (() => { const s = JSON.parse(JSON.stringify(R)); s[W8.id].attempts[0].coachPending = true; return ME.recommend(s[W8.id], W8, T0).action === "coach"; })());

/* ═══════════ F · CROSS-COMPETENCY ═══════════════════════════════════════ */
console.log("\nF · CROSS-COMPETENCY");
const comps = PACK.competencies;
const pick = s => ME.pickNext(comps, id => s[id], Date.now());
const put = (s, c, m, txt, kind, key, at) => { ME.introduce(s, c.id, GE); return ME.addAttempt(s, c.id, mk(c, m, txt, kind, key, at), GE, IV, meta(c)); };
const show = p => p ? `${p.comp.id}:${p.rec.action}:${p.rec.move || "-"}` : "null";
const rest = (s, c, g, t, gs, ts, k) => { put(s, c, g, gs, "guided", k + "g"); put(s, c, t, ts, "transfer", k + "t"); };
const restEarlier = (s, k) => EARLIER.forEach(c => rest(s, c, guidedOf(c), transferOf(c), REST[c.id].guided, REST[c.id].transfer, k + c.week));
ok("F · A fresh learner is offered Week 1 — Week 8 is not pushed forward by being newest", show(pick({})) === "explain-work:speak:-", show(pick({})));
let B = {}; restEarlier(B, "b");
ok("F · Weeks 1–7 rest through the engine, not by hand", EARLIER.every(c => B[c.id].state === "TRANSFER_READY"), EARLIER.map(c => c.id + ":" + B[c.id].state).join());
ok("F · With Weeks 1–7 resting, Week 8 is offered to speak — a competency nobody has spoken for is never skipped", show(pick(B)) === ID + ":speak:-", show(pick(B)));
rest(B, W8, G8, T8, SAY.strong, SAY.transfer, "b8");
ok("F · Every competency after Week 8 has a cold-transfer fixture in this suite", LATER.every(c => typeof SAY.transfers[c.id] === "string"), LATER.map(c => c.id).join());
LATER.forEach(c => { ok(`F · With everything before it resting, ${c.id} (Week ${c.week}) is offered to speak`, show(pick(B)) === `${c.id}:speak:-`, show(pick(B))); rest(B, c, guidedOf(c), transferOf(c), guidedOf(c).hear.model, SAY.transfers[c.id], "b" + c.week); });
ok("F · With every competency resting, nothing is pushed and the old advice stands", pick(B) === null, show(pick(B)));
let C = {}; put(C, W1, G1, REST["explain-work"].guided, "guided", "c1"); put(C, W8, G8, SAY.noBlocker, "guided", "c2");
ok("F · A Week 8 weak move outranks a Week 1 pending transfer — evidence priority, not week order", show(pick(C)) === ID + ":retry:blocker", show(pick(C)));
let Dd = {}; put(Dd, W1, G1, W1_NO_WHY, "guided", "d1"); put(Dd, W8, G8, SAY.noBlocker, "guided", "d2");
ok("F · Two equally urgent retries → the earlier week, deterministically, and only as a tie-break", show(pick(Dd)) === "explain-work:retry:why" && show(pick(Dd)) === show(pick(Dd)), show(pick(Dd)));
let E = {}; put(E, W7, G7, REST["disagree-pushback"].guided, "guided", "e1"); put(E, W8, G8, SAY.noCoordinate, "guided", "e2");
ok("F · Week 8 weak vs Week 7 ready for transfer → Week 8's retry", show(pick(E)) === ID + ":retry:coordinate", show(pick(E)));
let Fx = {}; restEarlier(Fx, "f"); put(Fx, W8, G8, SAY.noResequence, "guided", "f8");
ok("F · A learner with different evidence gets a different next mission: Weeks 1–7 resting and Week 8 weak → Week 8 retry on 'resequence'", show(pick(Fx)) === ID + ":retry:resequence", show(pick(Fx)));
ok("F · Pending coaching on Week 8 outranks a Week 1 retry",
  (() => { const s = {}; put(s, W1, G1, W1_NO_WHY, "guided", "i1"); const r = put(s, W8, G8, SAY.noStatus, "guided", "i2"); r.attempt.coachPending = true; return show(pick(s)) === ID + ":coach:status"; })());
ok("F · One record per competency, keyed by competency id — never by week", (() => { const s = {}; PACK.competencies.forEach((c, i) => put(s, c, guidedOf(c), "x", "guided", "k" + i)); return Object.keys(s).sort().join() === PACK.competencies.map(c => c.id).sort().join() && Object.keys(s).length === PACK.competencies.length; })());

/* ═══════════ G · MEMORY ═════════════════════════════════════════════════ */
console.log("\nG · MEMORY");
const row = ME.contract(mk(W8, G8, SAY.noBlocker, "guided", "k1"), meta(W8));
ok("G · Evidence is written as the same v1 contract: versioned, track-stamped, week 8, competency, mission, kind, key",
  row.v === ME.EVIDENCE_VERSION && row.v === 1 && row.tk === GE && row.week === WEEK && row.competency === ID && row.missionId === ID + "-guided" && row.kind === "guided" && row.key === "k1");
ok("G · Its moves map holds exactly the five Week 8 ids, as booleans", Object.keys(row.moves).join() === MOVES && Object.values(row.moves).every(v => typeof v === "boolean") && row.moves.blocker === false);
ok("G · Task, clarity, fluency and vocabulary are measured numbers in [0,1]; pronunciation is null — never zero — with no audio grader",
  [row.task, row.clarity, row.fluency, row.vocab].every(x => typeof x === "number" && x >= 0 && x <= 1) && row.pron === null && row.pronSource === null);
ok("G · With no duration, seconds and wpm are null, not 0", (() => { const r = ME.contract(Object.assign(ME.grade(W8, G8, SAY.strong, {}), { key: "k3", kind: "guided" }), meta(W8)); return r.seconds === null && r.wpm === null; })());
ok("G · Transfer is null on a guided attempt and a boolean on a transfer attempt", row.transfer === null && typeof ME.contract(mk(W8, T8, SAY.transfer, "transfer", "k2"), meta(W8)).transfer === "boolean");
ok("G · Vocabulary used lists only the competency's own expressions", (() => { const r = grade("We're carrying that story over. We're waiting on legal. The dependency is the review. That puts the sprint goal at risk. We may need to re-sequence. To keep the sprint on track, I'll swap in the email story. The ETA is end of sprint. I'll raise that in the retro.", 20); return r.vocabUsed.every(w => W8.expressions.some(e => e.w === w)) && r.vocabUsed.length >= 6; })());
ok("G · The same key twice in Week 8 is one row, reported as a duplicate", (() => { const s = {}; put(s, W8, G8, SAY.strong, "guided", "dup"); return put(s, W8, G8, SAY.strong, "guided", "dup").duplicate && s[W8.id].attempts.length === 1; })());
ok("G · The same key in Week 8 and Week 7 is two rows, one each — idempotency is per competency",
  (() => { const s = {}; put(s, W7, G7, REST["disagree-pushback"].guided, "guided", "same"); const r = put(s, W8, G8, SAY.strong, "guided", "same"); return !r.duplicate && s[W7.id].attempts.length === 1 && s[W8.id].attempts.length === 1; })());
ok("G · Weak evidence stays due: a weak Week 8 record is due now, for practice, with its weakness kept and driving the next recommendation",
  (() => { const s = {}; const r = put(s, W8, G8, SAY.noCoordinate, "guided", "w1"); s[W8.id].weakness = ME.weakestMove(W8, r.attempt, s[W8.id].attempts);
    return s[W8.id].retrieval.reason === "practice" && s[W8.id].retrieval.due <= Date.now() && s[W8.id].weakness === "coordinate" && ME.recommend(s[W8.id], W8).move === "coordinate"; })());
ok("G · Week 8 attempts are bounded at 60", (() => { const s = {}; for (let i = 0; i < 70; i++) put(s, W8, G8, SAY.strong, "guided", "b" + i, T0 + i); return s[W8.id].attempts.length === 60; })());
ok("G · A Week 8 attempt changes none of the other seven records",
  (() => { const s = {}; EARLIER.forEach((c, i) => put(s, c, guidedOf(c), i === 0 ? W1_NO_WHY : REST[c.id].guided, "guided", "m" + i));
    const before = JSON.stringify(EARLIER.map(c => s[c.id])); put(s, W8, G8, SAY.noBlocker, "guided", "m8"); return JSON.stringify(EARLIER.map(c => s[c.id])) === before && s[W8.id].state === "PRACTICING"; })());
ok("G · The progress summary carries Week 8, its state, five per-move counts, null pronunciation and no Shadow support yet",
  (() => { const ps = ME.progressSummary(L8[W8.id], W8); return ps.competency === ID && ps.week === WEEK && ps.state === "STRONG" && ps.byMove.map(m => m.id).join() === MOVES && ps.pron === null && ps.shadow.total === 0 && ps.transferPassed === 3 && ps.transferFailed === 1; })());

/* ═══════════ H · AI CONTEXT ═════════════════════════════════════════════ */
console.log("\nH · AI COACH");
const st8 = {}; put(st8, W7, G7, REST["disagree-pushback"].guided, "guided", "h0"); put(st8, W8, G8, SAY.noBlocker, "guided", "h1");
const ctx = ME.aiContext(st8[W8.id], W8, G8, { weakness: "blocker" });
const ctxJson = JSON.stringify(ctx);
ok("H · The context carries competency sprint-coordinate, the guided mission, the pattern, five moves with hints, the weakness, evidence counts and one attempt summary",
  ctx.track === GE && ctx.competency === ID && ctx.mission === ID + "-guided" && ctx.prompt === G8.prompt && ctx.pattern === W8.pattern
  && ctx.targetMoves.length === 5 && ctx.targetMoves.every(m => m.id && m.label && m.hint) && ctx.currentWeakness === "blocker"
  && ctx.recentEvidence.attempts === 1 && ctx.previousAttemptSummary && ctx.previousAttemptSummary.moves.blocker === false);
ok("H · Relevant memory is in: the last attempt's moves and length; the transcript is not", ctx.previousAttemptSummary.words > 8 && !("said" in ctx.previousAttemptSummary) && !ctxJson.includes(SAY.noBlocker.slice(0, 30)));
ok("H · Unrelated history is not dumped in: no attempt list, no profile, no state machine, nothing from Week 7 or any other competency",
  !ctxJson.includes("\"attempts\":[") && !/profile|streak|\"name\"/i.test(ctxJson) && !("state" in ctx) && !/disagree-pushback|recommend-decide|explain-tech|clarify-confirm|explain-work|clear-update|raise-problem|Say where you differ|tradeoff|Lay out the options|restate|mitigate|takeaway/.test(ctxJson));
ok("H · The context is compact", ctxJson.length < 2500, String(ctxJson.length));
const prompt = ME.coachPrompt(ctx, "SPOKEN RULE");
ok("H · The prompt names five moves with Week 8's labels, its shape, and the existing {reply, covered} route — and tells the model it is a coach, not a colleague",
  /makes 5 communication/.test(prompt) && /blocker \(Name the blocker\)/.test(prompt) && /coordinate \(Coordinate the ask and the ETA\)/.test(prompt) && prompt.includes(W8.pattern) && /"covered"/.test(prompt) && /"reply"/.test(prompt) && /speaking coach/i.test(prompt) && prompt.includes("SPOKEN RULE") && !/disagree \(|recommend \(|check \(|confirm \(/.test(prompt));
const evAI = mk(W8, G8, SAY.noBlocker, "guided", "ai1"); ME.applyCoachMoves(evAI, W8, ["blocker"]);
ok("H · The model MAY add the blocker it heard in the learner's own words", evAI.moves.blocker === true && evAI.coverage === 1 && evAI.assisted === true);
const evKeep = mk(W8, G8, SAY.strong, "guided", "ai2"); ME.applyCoachMoves(evKeep, W8, []);
ok("H · The model CANNOT remove a move the learner made", evKeep.coverage === 1);
const evJunk = mk(W8, G8, SAY.noBlocker, "guided", "ai3"); ME.applyCoachMoves(evJunk, W8, ["disagree", "align", "issue", "__proto__", "state", "passed", 42, null]);
ok("H · Other competencies' move ids and non-moves are dropped on the floor", evJunk.moves.blocker === false && Object.keys(evJunk.moves).join() === MOVES && !("state" in evJunk.moves));
const shaped = ME.shapeCoach({ reply: "y".repeat(500), covered: ["blocker"], state: "STRONG", score: 100, passed: true }, W8, evAI);
ok("H · Model output is capped, tagged as AI, and carries no state or score into the app", shaped.improve.length <= 240 && shaped.ai === true && !("state" in shaped) && !("score" in shaped) && !("passed" in shaped));

/* ═══════════ L · SHADOW (engine) — A REAL CLIP, SUPPORTING ONLY ════════ */
console.log("\nL · SHADOW (engine)");
const round = vid => ({ kind: "challenge", ts: 1.7e12, vid, title: "t", rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" } });
ok("L · A round on Week 8's clip links to Week 8 — and to none of the others", ME.fromShadow(round(CLIP), W8).linked === true && EARLIER.every(c => ME.fromShadow(round(CLIP), c).linked === false));
ok("L · A round on Week 7's or Week 3's clip does not link to Week 8", ME.fromShadow(round(W7.shadow.vid), W8).linked === false && ME.fromShadow(round(W3.shadow.vid), W8).linked === false);
ok("L · Shadow support never moves Week 8's state, credits no move, and is idempotent on the history row",
  (() => { const s = {}; ME.record(s, W8.id); ME.addSupport(s, W8.id, ME.fromShadow(round(CLIP), W8), GE); ME.addSupport(s, W8.id, ME.fromShadow(round(CLIP), W8), GE);
    const p = ME.progressSummary(s[W8.id], W8); return s[W8.id].state === "NOT_STARTED" && s[W8.id].support.length === 1 && p.shadow.linked === 1 && p.shadow.rungName === "blind" && p.attempts === 0 && p.byMove.every(m => m.made === 0) && !("moves" in s[W8.id].support[0]); })());
ok("L · The unsupported move stays unsupported: a linked round adds nothing to 'impact' (or any move) on a weak record",
  (() => { const s = {}; put(s, W8, G8, SAY.noImpact, "guided", "sh0"); ME.addSupport(s, W8.id, ME.fromShadow(round(CLIP), W8), GE); const p = ME.progressSummary(s[W8.id], W8); return p.byMove.find(m => m.id === "impact").made === 0 && s[W8.id].state === "PRACTICING" && p.shadow.linked === 1; })());
ok("L · Shadow can supply comprehensibility the mission could not measure, and says so",
  (() => { const s = {}; put(s, W8, G8, SAY.strong, "guided", "sh1"); ME.addSupport(s, W8.id, ME.fromShadow(round(CLIP), W8), GE); const p = ME.progressSummary(s[W8.id], W8); return p.pron === 90 && p.pronSource === "shadow"; })());
ok("L · The architecture holds competencies with a clip (2, 3, 7, 8) and without (1, 4, 5, 6) at the same time",
  !!W2.shadow && !!W3.shadow && !!W7.shadow && !!W8.shadow && !W1.shadow && !W4.shadow && !W5.shadow && !W6.shadow && ME.progressSummary(ME.blank(W6.id), W6).shadow.total === 0);
ok("L · Support is refused for any track but General English", ME.addSupport({}, W8.id, ME.fromShadow(round(CLIP), W8), "welding") === null);

/* ═══════════ J (engine half) · WELDING WALL ═════════════════════════════ */
console.log("\nJ · WELDING WALL (engine)");
ok("J · The engine refuses a Week 8 write for any area but General English — and does not create a record",
  (() => { const s = {}; return ME.addAttempt(s, W8.id, mk(W8, G8, SAY.strong, "guided", "w"), "welding", IV, meta(W8)) === null && ME.introduce(s, W8.id, "welding") === null
    && ME.addSupport(s, W8.id, { key: "x", at: 1 }, "welding") === null && Object.keys(s).length === 0; })());
ok("J · guard() accepts only the pack's own track constant", ME.guard(GE) === true && ME.guard("welding") === false && ME.TRACK === GE);

/* ═══════════ BROWSER ════════════════════════════════════════════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8161, 8162, 8163, 8164, 8165]) {
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
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Name what you are waiting on and who has it before the plan.", one: "Name what you are waiting on and who has it before the plan.", covered: coachCovered }) });
  });
  /* The Shadow row hands the studio a YouTube clip; the player API is kept off
     the network here, so the check is about the hand-over, not about YouTube. */
  await ctx.route(u => /youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com/.test(u.href), route => route.abort());
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?w8=" + Date.now(), { waitUntil: "load" });
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
const rec8 = (page, id) => page.evaluate(i => JSON.parse(JSON.stringify(mvStore()[i] || {})), id);
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: innerWidth }));
const shot = async (page, name) => { if (SHOTS) { try { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); } catch (e) {} } };
/* Put every competency before Week 8 to rest inside the page, through the
   engine, walking the pack from the per-id fixture map. */
const restBefore8 = page => page.evaluate(({ REST, WEEK }) => {
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
ok("K1 · A fresh learner's Home shows no V2 card on Home (removed 2026-09-24 — the mission opens from the session page) — Week 8 does not appear prematurely",
  home0.n === 0 && home0.today <= 1, JSON.stringify(home0));
const rested = await restBefore8(L.page);
ok("K2 · Weeks 1–7 are transfer-ready in this learner's store (seeded through the engine, not by hand)", rested === EARLIER.map(() => "TRANSFER_READY").join(), rested);
const home1 = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText, chip: c && c.querySelector(".chip").innerText, btn: c && c.querySelector("button").innerText, line: c && c.querySelector("p").innerText }; });
ok("K3 · With the earlier weeks resting, Home still shows no V2 card on Home (removed 2026-09-24 — the mission opens from the session page)",
  home1.n === 0, JSON.stringify(home1));
const ovh = await overflow(L.page); ok("K3 · Home has no horizontal overflow at 390px with the Week 8 card and its long title", ovh.sw <= ovh.cw, JSON.stringify(ovh));
await shot(L.page, "390-home-week8");
const coachRec = await L.page.evaluate(() => ({ a: AdaptiveLearningEngine.recommendation(S, ProfessionalTrackContext.active()), m: LearningCoach.mission(S, ProfessionalTrackContext.active()) }));
ok("K4 · The Adaptive engine and the LearningCoach both surface Week 8 through the existing hooks", coachRec.a.v2 === true && /Sprint meetings/i.test(coachRec.a.title) && coachRec.m.v2 === true && coachRec.m.arg1 === ID + "-guided" && coachRec.m.go === "mission", JSON.stringify({ t: coachRec.a.title, arg: coachRec.m.arg1 }));
const opened = await L.page.evaluate(async () => { LearningCoach.openMission(); await new Promise(r => setTimeout(r, 400)); return { v: cur.v, comp: _mv && _mv.compId, mission: _mv && _mv.missionId }; });
ok("K5 · LearningCoach.openMission() lands on the Week 8 mission", opened.v === "mission" && opened.comp === ID && opened.mission === ID + "-guided", JSON.stringify(opened));

/* SEE → HEAR → NOTICE for Week 8 */
console.log("\nTHE LOOP · SEE → HEAR → NOTICE");
await L.page.evaluate(id => mvGo(id + "-guided", "see"), ID); await sleep(350);
const see = await L.page.evaluate(id => ({ txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), state: (mvStore()[id] || {}).state, cta: document.querySelectorAll("#v-mission .mv-cta").length, back: !!document.querySelector("#v-mission > .mv-back") }), ID);
ok("SEE renders Week 8's long title, the scrum master's question and the goal, with one action and a way back — and is worth INTRODUCED only",
  /Sprint meetings, blockers & stakeholder coordination/i.test(see.txt) && /where are we/i.test(see.txt) && /Don't just say 'blocked'/i.test(see.txt) && /Mission Hear Notice Speak Coach Complete/.test(see.txt) && see.cta === 1 && see.back && see.state === "INTRODUCED", see.txt.slice(0, 160));
const ovs = await overflow(L.page); ok("SEE has no horizontal overflow at 390px with the long title", ovs.sw <= ovs.cw, JSON.stringify(ovs));
await shot(L.page, "390-see");
await L.page.evaluate(() => mvStep("hear")); await sleep(300);
const hear = await L.page.evaluate(() => { const vis = () => /pull payments back in/i.test(document.getElementById("v-mission").innerText);
  const hidden = !vis(), play = document.querySelectorAll(".mv-play button").length, reveal = !!document.querySelector(".mv-reveal");
  document.querySelector(".mv-reveal").click();
  return { hidden, play, reveal, shownAfter: vis(), heard: (window.__ev || []).some(e => e[0] === "v2_mission_heard"), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("HEAR is voice-first: two play buttons, Week 8's model hidden until 'Show the words', the heard event logged, no overflow",
  hear.hidden && hear.play === 2 && hear.reveal && hear.shownAfter && hear.heard && hear.sw <= hear.cw, JSON.stringify(hear));
await shot(L.page, "390-hear");
await L.page.evaluate(() => mvStep("notice")); await sleep(350);
const notice = await L.page.evaluate(() => ({
  moves: [...document.querySelectorAll(".mv-list li b")].map(b => b.innerText),
  eyebrow: (document.querySelector(".mv-notice .eyebrow") || {}).innerText, sub: (document.querySelector(".mv-notice .sub") || {}).innerText,
  shadow: !!document.querySelector(".mv-shadow"), shadowTxt: (document.querySelector(".mv-shadow") || {}).innerText, cta: document.querySelectorAll("#v-mission .mv-cta").length }));
ok("NOTICE renders the five Week 8 moves by label, says '5 moves', and — with a clip linked — shows the Shadow row",
  notice.moves.join() === LABELS && /5 moves/i.test(notice.eyebrow + " " + notice.sub) && notice.shadow === true && /Hear a professional do it/i.test(notice.shadowTxt || "") && notice.cta === 1, JSON.stringify(notice));
const ovn = await overflow(L.page); ok("NOTICE has no horizontal overflow at 390px with five moves and the Shadow row", ovn.sw <= ovn.cw, JSON.stringify(ovn));
await shot(L.page, "390-notice");
/* the Shadow row, on a FIRST tap in a session that has never opened Shadow — a real click */
const errsBeforeShadow = errors.length;
const shRowEl = await L.page.$("#v-mission .mv-shadow"); await shRowEl.scrollIntoViewIfNeeded(); await shRowEl.click(); await sleep(700);
const shRow = await L.page.evaluate(async id => {
  const r = { v: cur.v, vid: typeof shClip === "object" && shClip && shClip.vid, title: shClip && shClip.title, last: S.lastClip && S.lastClip.vid, wrap: !!document.getElementById("shPlayerWrap"), url: (document.getElementById("shUrl") || {}).value || "", ytBox: !!document.getElementById("ytBox"), state: (mvStore()[id] || {}).state };
  mvGo(id + "-guided", "notice"); await new Promise(r => setTimeout(r, 300)); return r; }, ID);
ok("The Shadow row hands the existing studio Week 8's clip on a first tap — no page error, the studio DOM exists, it holds the clip — and opening it is worth no evidence (V2.8 fix)",
  errors.length === errsBeforeShadow && shRow.v === "shadow" && shRow.vid === CLIP && /Project Update/i.test(shRow.title || "") && shRow.last === CLIP && shRow.wrap && shRow.url.includes(CLIP) && shRow.ytBox && shRow.state === "INTRODUCED", JSON.stringify(shRow) + " " + errors.slice(errsBeforeShadow).join(" | "));
const noType = await L.page.evaluate(() => ({ ta: document.querySelectorAll("#v-mission textarea").length, inp: document.querySelectorAll("#v-mission input[type=text]").length, sc: document.querySelectorAll("#v-mission .score-b").length }));
ok("Week 8 is voice-first — no script box, no text input, no self-score", noType.ta === 0 && noType.inp === 0 && noType.sc === 0, JSON.stringify(noType));

/* ── SPEAK → COACH (weak: no dependency named) ── */
console.log("\nSPEAK → COACH");
await L.page.evaluate(() => mvStep("speak")); await sleep(250);
const spk = await L.page.evaluate(() => ({ btn: document.querySelectorAll("#v-mission .rec-btn").length, prompt: (document.querySelector(".mv-q") || {}).innerText, ctx: (document.querySelector(".mv-ctx") || {}).innerText, state: (document.getElementById("recState") || {}).innerText }));
ok("SPEAK shows the question, the status, the dependency, the people and the re-sequencing option as context, and one recorder in its idle state",
  spk.btn === 1 && /where are we/i.test(spk.prompt || "") && /Cart and address are finished/.test(spk.ctx || "") && /Sam, the product owner/.test(spk.ctx || "") && /order-confirmation email/.test(spk.ctx || "") && /record your answer/i.test(spk.state || ""), JSON.stringify(spk).slice(0, 220));
await shot(L.page, "390-speak");
coachCovered = ["status", "impact", "resequence", "coordinate"];
await L.page.evaluate(t => { window.__say = t; }, SAY.noBlocker);
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
ok("B1 · the missing blocker is identified from what was said; five chips render, one off — the blocker chip",
  b1.moves.blocker === false && b1.cov === 0.8 && b1.move === "blocker" && b1.chips === 5 && b1.off === 1 && /Name the blocker/i.test(b1.offTxt || "") && b1.step === "coach", JSON.stringify({ c: b1.cov, m: b1.move, chips: b1.chips, off: b1.off, offTxt: b1.offTxt }));
ok("B2 · four of five does not advance the learner", (await rec8(L.page, ID)).state === "PRACTICING");
ok("B3 · the coach's system prompt carried Week 8's five moves — not Week 7's disagree, Week 6's recommend or Week 5's check",
  /makes 5 communication/.test(lastSystem) && /blocker \(Name the blocker\)/.test(lastSystem) && /resequence \(Re-sequence the work\)/.test(lastSystem) && !/disagree \(/.test(lastSystem) && !/recommend \(/.test(lastSystem) && !/check \(/.test(lastSystem), lastSystem.slice(0, 90));
ok("B4 · the coaching shown is the model's and is tagged as such", b1.ai === true && /waiting on/i.test(b1.improve || ""));
const ovc = await overflow(L.page); ok("COACH has no horizontal overflow at 390px with five chips", ovc.sw <= ovc.cw, JSON.stringify(ovc));
await shot(L.page, "390-coach");

/* ── RETRY ── */
console.log("\nRETRY");
const retry = await L.page.evaluate(() => { mvRetry(); return { text: _mv.retryText, step: _mv.step, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText }; });
ok("C1 · the retry names the Week 8 move that was missed, in the pack's own words, on the retry step", /name the blocker/i.test(retry.text || "") && retry.step === "speak" && /one more time/i.test(retry.eyebrow || ""), JSON.stringify(retry));
await shot(L.page, "390-retry");
coachCovered = ["status", "blocker", "impact", "resequence", "coordinate"];
await speak(L.page, SAY.strong);
const c2 = await rec8(L.page, ID);
ok("C2 · the retry is stored as a retry; both attempts are preserved", c2.attempts.length === 2 && c2.attempts[0].coverage === 0.8 && c2.attempts[1].kind === "retry" && c2.attempts[1].coverage === 1);
ok("C3 · progression recalculates to DEMONSTRATED", c2.state === "DEMONSTRATED", c2.state);
const transferBtn = await L.page.evaluate(() => [...document.querySelectorAll(".mv-acts button, .mv-dock button")].map(b => b.innerText).join("|"));
ok("C4 · once demonstrated, the coach screen offers the new situation", /take the new situation/i.test(transferBtn), transferBtn);

/* ── TRANSFER ── */
console.log("\nTRANSFER");
await L.page.evaluate(id => mvGo(id + "-transfer", "speak"), ID); await sleep(300);
const tp = await L.page.evaluate(() => ({ q: (document.querySelector(".mv-q") || {}).innerText, comp: _mv.compId, kind: _mv.kind, eyebrow: (document.querySelector(".mv-speak .eyebrow") || {}).innerText, instr: (document.querySelector(".mv-instruction") || {}).innerText, ctx: (document.querySelector(".mv-ctx") || {}).innerText }));
ok("D1 · the transfer is a different piece of work, still Week 8, framed as the new situation with the cold goal and its own facts",
  /still good for the first/i.test(tp.q || "") && tp.comp === ID && tp.kind === "transfer" && /new situation/i.test(tp.eyebrow || "") && /nobody is prompting you/i.test(tp.instr || "") && /legal/i.test(tp.ctx || "") && /prize-draw/i.test(tp.ctx || ""), JSON.stringify(tp).slice(0, 220));
await shot(L.page, "390-transfer");
await speak(L.page, SAY.transfer);
const d2 = await rec8(L.page, ID);
ok("D2 · transfer evidence is stored as its own kind, separate from practice", d2.attempts.length === 3 && d2.attempts[2].kind === "transfer" && d2.attempts[2].transfer === true);
ok("D3 · one cold success is TRANSFER_READY, not STRONG", d2.state === "TRANSFER_READY" && d2.transfer.passed === 1, d2.state);
ok("D4 · a retrieval is scheduled from the track's own intervals", d2.retrieval && d2.retrieval.reason === "retrieval" && d2.retrieval.due > Date.now());
/* Shadow work on Week 8's clip, done in the studio, is harvested as supporting evidence — never as an attempt */
const harvested = await L.page.evaluate(({ vid, id }) => {
  const before = mvStore()[id].state, n0 = mvStore()[id].attempts.length;
  aList("chHist").unshift({ kind: "challenge", ts: Date.now(), vid, title: "Project Update", seg: 2, rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" }, heard: "x y z", issues: [], drills: [] });
  aList("chHist").unshift({ kind: "challenge", ts: Date.now() + 1, vid: "OTHERCLIP", coverage: 0.9, pass: true, dims: {}, issues: [], drills: [] });
  save();
  const n = mvHarvestShadow(), again = mvHarvestShadow();
  const d = (window.v2Evidence() || []).find(x => x.competency === id);
  return { n, again, linked: d.shadow.linked, rung: d.shadow.rungName, state: d.state, sameState: before === d.state, attempts: mvStore()[id].attempts.length === n0 };
}, { vid: CLIP, id: ID });
ok("Shadowing Week 8's clip in the studio becomes linked supporting evidence for Week 8 — idempotent, other clips ignored, state and attempts untouched",
  harvested.n === 1 && harvested.again === 0 && harvested.linked === 1 && harvested.rung === "blind" && harvested.sameState && harvested.attempts, JSON.stringify(harvested));
await L.page.evaluate(() => mvStep("done")); await sleep(300);
const done = await L.page.evaluate(() => (document.querySelectorAll("#v-mission details.mv-fold").forEach(d => { d.open = true; }), { txt: document.getElementById("v-mission").innerText.replace(/\s+/g, " "), bars: document.querySelectorAll(".mv-bars > *").length, chips: document.querySelectorAll(".mv-move").length, shadowNote: !!document.querySelector(".mv-shadow-note"), shadowTxt: (document.querySelector(".mv-shadow-note") || {}).innerText }));
ok("D5 · the evidence screen shows the state, five chips and the dimension bars — pronunciation as a number here because the (mocked) audio grader measured it — and the Shadow line for the linked clip",
  /transfer ready/i.test(done.txt) && done.bars >= 5 && done.chips === 5 && /83%/.test(done.txt) && done.shadowNote === true && /1×/.test(done.shadowTxt || ""), done.txt.slice(0, 160) + " | " + done.shadowTxt);
const ovd = await overflow(L.page); ok("Evidence screen has no horizontal overflow at 390px", ovd.sw <= ovd.cw, JSON.stringify(ovd));
await shot(L.page, "390-evidence");

/* ── K · PROGRESS ── */
console.log("\nK · PROGRESS");
const prog = await L.page.evaluate(() => { go("review"); const ps = [...document.querySelectorAll(".pg-v2")]; const d = window.v2Evidence();
  return { panels: ps.length, txt: ps.map(p => p.innerText.replace(/\s+/g, " ")).join(" || "), comps: d.map(x => x.competency + ":" + x.state), weeks: d.map(x => x.week).join(), moves: d.map(x => (x.byMove || []).length).join(), last: d[d.length - 1] }; });
const spokenComps = PACK.competencies.filter(c => c.week <= WEEK);
ok("K6 · Progress renders every spoken competency oldest week first — eight panels in canonical order, each with its own move count — ordering and counts come from the data",
  prog.panels === spokenComps.length && prog.panels === 8 && prog.weeks === spokenComps.map(c => c.week).join() && prog.moves === spokenComps.map(c => c.moves.length).join() && prog.comps[spokenComps.length - 1] === ID + ":TRANSFER_READY", JSON.stringify({ p: prog.panels, w: prog.weeks, m: prog.moves, c: prog.comps }));
ok("K7 · The Week 8 panel names its week, its state and its own moves through the same evidence contract",
  /Week 8/.test(prog.txt) && /Name the blocker/.test(prog.txt) && /Re-sequence the work/.test(prog.txt) && prog.last.week === WEEK && prog.last.attempts === 3 && prog.last.passed === 2 && prog.last.transferPassed === 1 && prog.last.pron === 83 && prog.last.pronSource === "audio" && prog.last.shadow.linked === 1, JSON.stringify({ w: prog.last.week, a: prog.last.attempts, p: prog.last.passed, sh: prog.last.shadow }));
const ovp = await overflow(L.page); ok("Progress has no horizontal overflow at 390px with eight panels", ovp.sw <= ovp.cw, JSON.stringify(ovp));
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
  ok(`K8 · With everything before it resting, ${c.id} (Week ${c.week}) rests through the engine to transfer-ready, and Home still shows no V2 card on Home (removed 2026-09-24 — the mission opens from the session page)`, step.offered === "" && step.state === "TRANSFER_READY", JSON.stringify(step));
}
const afterAll = await L.page.evaluate(() => { go("home"); return { n: document.querySelectorAll(".mv-home").length, card: !!document.querySelector(".mv-home") }; });
ok("K8 · With every competency resting, Home shows no V2 card and looks as it did before V2 — the old advice stands", afterAll.n === 0 && afterAll.card === false, JSON.stringify(afterAll));
const voc = await L.page.evaluate(id => Object.entries(areaVocab()).filter(([, v]) => v.src && v.src.v2 === id).map(([w]) => w), ID);
ok("K9 · Week 8 expressions were acquired automatically, tagged to Week 8", voc.length > 0 && voc.every(w => W8.expressions.some(e => e.w === w)), JSON.stringify(voc));

/* ── I · ANALYTICS ── */
console.log("\nI · ANALYTICS");
const ev = await L.page.evaluate(id => (window.__ev || []).filter(e => e[0].startsWith("v2_") && e[1].competency === id).map(e => [e[0], e[1].track, e[1].week, e[1].competency, e[1].mission]), ID);
ok("I1 · every Week 8 analytics event carries track general-english, week '8' and competency sprint-coordinate",
  ev.length >= 10 && ev.every(e => e[1] === GE && e[2] === String(WEEK) && e[3] === ID), JSON.stringify(ev.slice(0, 4)));
const evNames = [...new Set(ev.map(e => e[0]))];
const ALL11 = ["v2_mission_started", "v2_mission_heard", "v2_speak_attempt", "v2_coach_generated", "v2_evidence_recorded", "v2_retry_attempt", "v2_transfer_started", "v2_transfer_completed", "v2_competency_progressed", "v2_retrieval_scheduled", "v2_recommendation_generated"];
ok("I2 · the loop emitted only the existing v2_* names for Week 8 — all eleven, and no new name", ALL11.every(n => evNames.includes(n)) && evNames.every(n => ALL11.includes(n)), evNames.join());
const evProps = await L.page.evaluate(() => (window.__ev || []).filter(e => e[0].startsWith("v2_")).map(e => e[1]));
ok("I3 · every prop key is one the Worker's v2 column map already carries", evProps.every(p => Object.keys(p).every(k => ["track", "week", "competency", "mission", "kind", "move", "result", "band", "state", "from", "attempt", "ai"].includes(k))));
ok("I4 · the move and mission values are Week 8's own enums — a mission event carries a Week 8 move, the Shadow-support event carries a rung — and a progression carries from/state",
  evProps.filter(p => p.competency === ID).every(p => p.mission === "shadow"
    ? (p.kind === "shadow" && (!p.move || p.move === "none" || ME.SHADOW_RUNGS.includes(p.move)))
    : ((!p.move || ["status", "blocker", "impact", "resequence", "coordinate", "none"].includes(p.move)) && (!p.mission || new RegExp("^" + ID + "-(guided|transfer)$").test(p.mission))))
  && evProps.some(p => p.competency === ID && p.mission === "shadow" && p.kind === "shadow" && p.move === "blind")
  && evProps.some(p => p.state === "TRANSFER_READY" && p.from === "DEMONSTRATED"), JSON.stringify(evProps.filter(p => p.competency === ID && p.mission === "shadow")));
const pii = JSON.stringify(evProps);
ok("I5 · no event carries a transcript, the profile name or the goal", !/checkout|vendor|legal|prize|newsletter|credentials|\"T\"|confidence in meetings/i.test(pii));
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
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("a", SAY.noBlocker, 1e12 + 1), areaId(), IV, meta);
  MissionEngine.addAttempt(local.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.introduce(cloud.v2A["general-english"], c.id, areaId(), 1e12 + 5);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("b", SAY.strong, 1e12 + 2), areaId(), IV, meta);
  MissionEngine.addAttempt(cloud.v2A["general-english"], c.id, att("c", SAY.noStatus, 1e12 + 3), areaId(), IV, meta);
  const m = fbMerge(local, cloud); const r = m.v2A["general-english"][id];
  const pr = fbSyncPayload(m).v2A["general-english"][id];
  return { keys: r.attempts.map(a => a.key).join(), state: r.state, introducedAt: r.introducedAt, saidLocal: r.attempts.every(a => typeof a.said === "string" && a.said.length > 0), saidCloud: pr.attempts.every(a => !("said" in a)), weeks: r.attempts.every(a => a.week === week && a.competency === id), buckets: Object.keys(m.v2A).join() };
}, { SAY, id: ID, week: WEEK });
ok("G · Two devices' Week 8 attempts union on the idempotency key (a, b, c — b once); state is recomputed; introducedAt is the earliest",
  merged.keys === "a,b,c" && merged.state === "DEMONSTRATED" && merged.introducedAt === 1e12, JSON.stringify(merged));
ok("G · The learner's words stay on the device and are stripped from the sync payload; every row is week 8 / sprint-coordinate; no Welding bucket", merged.saidLocal && merged.saidCloud && merged.weeks && merged.buckets === "general-english");

/* ── DESKTOP ── */
console.log("\nUI · DESKTOP");
const Dk = await learner("desk", GE, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
await restBefore8(Dk.page);
const dkHome = await Dk.page.evaluate(async () => { go("home"); await new Promise(r => setTimeout(r, 300)); const c = document.querySelector(".mv-home");
  return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, o: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth } }; });
ok("Desktop: Home shows no V2 card on Home (removed 2026-09-24 — the mission opens from the session page), with no horizontal overflow", dkHome.n === 0 && dkHome.o.sw <= dkHome.o.cw, JSON.stringify(dkHome));
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
const dkErrs0 = errors.length;
const dkShadow = await Dk.page.evaluate(async id => { mvGo(id + "-guided", "notice"); await new Promise(r => setTimeout(r, 300)); document.querySelector("#v-mission .mv-shadow").click(); await new Promise(r => setTimeout(r, 600));
  const r = { v: cur.v, vid: shClip && shClip.vid, wrap: !!document.getElementById("shPlayerWrap"), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; mvGo(id + "-guided", "speak"); await new Promise(r => setTimeout(r, 300)); return r; }, ID);
ok("Desktop: the Shadow row's first tap opens the studio on Week 8's clip with no error and no overflow", errors.length === dkErrs0 && dkShadow.v === "shadow" && dkShadow.vid === CLIP && dkShadow.wrap && dkShadow.sw <= dkShadow.cw, JSON.stringify(dkShadow) + " " + errors.slice(dkErrs0).join(" | "));
coachCovered = ["status", "impact", "resequence", "coordinate"];
await Dk.page.evaluate(t => { window.__say = t; }, SAY.noBlocker);
await Dk.page.evaluate(() => mvRecord());
await Dk.page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
const dkRec = await Dk.page.evaluate(() => ({ cls: document.querySelector("#v-mission .rec-btn").className, state: (document.getElementById("recState") || {}).innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
ok("Desktop: the recording state is visible and usable", /recording/.test(dkRec.cls) && /listening/i.test(dkRec.state || "") && dkRec.sw <= dkRec.cw, JSON.stringify(dkRec));
await shot(Dk.page, "1280-recording");
await sleep(1200);
await Dk.page.evaluate(() => mvRecord());
await Dk.page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
await sleep(250);
const dkCoach = await Dk.page.evaluate(() => ({ step: _mv.step, chips: document.querySelectorAll(".mv-move").length, off: document.querySelectorAll(".mv-move.off").length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, acts: document.querySelectorAll(".mv-acts button, .mv-dock button").length }));
ok("Desktop: COACH renders five chips (one off) and its actions with no overflow", dkCoach.step === "coach" && dkCoach.chips === 5 && dkCoach.off === 1 && dkCoach.acts >= 2 && dkCoach.sw <= dkCoach.cw, JSON.stringify(dkCoach));
await shot(Dk.page, "1280-coach");
const dkRetry = await Dk.page.evaluate(() => { mvRetry(); return { step: _mv.step, text: _mv.retryText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
ok("Desktop: RETRY names the missing move with no overflow", dkRetry.step === "speak" && /name the blocker/i.test(dkRetry.text || "") && dkRetry.sw <= dkRetry.cw);
coachCovered = ["status", "blocker", "impact", "resequence", "coordinate"];
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
ok("Desktop: PROGRESS renders one panel per spoken competency (eight) with no overflow", dkProg.panels === spokenComps.length && dkProg.sw <= dkProg.cw, JSON.stringify(dkProg));
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
coachMode = "ok"; coachCovered = ["status", "blocker", "impact", "resequence", "coordinate"];
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
  /* a Welding learner shadowing the SAME clip generates no General English evidence (same shape as the integration suite) */
  aList("chHist").unshift({ kind: "challenge", ts: Date.now(), vid, title: "clip", rung: "blind", coverage: 0.9, pass: true, pronMode: "ai", dims: { pron: "good" }, issues: [], drills: [] }); save();
  const harvested = mvHarvestShadow();
  const cur8 = activeCurriculum();
  go("review"); await new Promise(r => setTimeout(r, 300));
  return { area: areaId(), comps: mvComps().length, comp: mvComp(id), missions: cur8.missions, card, homeMentions: /Sprint meetings|Name the blocker|Re-sequence the work|Coordinate the ask|Say where it stands/i.test(homeTxt), view, html: (html || "").length,
    refused, harvested, unchanged, weldRows: weldRowsBefore, buckets: bucketsBefore, weldRowsAfter: Object.keys(((S.v2A || {}).welding) || {}).length, ev: window.v2Evidence(), rec: window.v2Recommendation(),
    panel: !!document.querySelector(".pg-v2"), events: (window.__ev || []).filter(e => e[0].startsWith("v2_")).length,
    weeks: (cur8.weeks || []).length, sims: (cur8.simulations || []).length, stage: (cur8.weeks[0] || {}).stage };
}, { id: ID, vid: CLIP, week: WEEK });
ok("J1 · Welding's curriculum resolves missions to null — Week 8 does not reach it through inheritance", w.area === "welding" && w.missions === null && w.comps === 0 && w.comp === null, JSON.stringify({ a: w.area, m: w.missions, c: w.comps }));
ok("J2 · no V2 card and no Week 8 title or move wording on the Welding home", w.card === false && w.homeMentions === false);
ok("J3 · routing straight to the Week 8 mission turns a Welding learner around safely", w.view === "home" && w.html === 0, JSON.stringify({ v: w.view, len: w.html }));
ok("J4 · the engine refuses to write Week 8 evidence for a Welding learner; no Welding bucket is created", w.refused && w.unchanged && w.weldRows === 0 && !/welding/.test(w.buckets));
ok("J5 · no Week 8 analytics can be emitted from Welding, even with the competency passed in by hand", w.events === 0, String(w.events));
ok("J6 · both hooks return null and the Welding Progress page shows no V2 panel", w.ev === null && w.rec === null && w.panel === false);
ok("J7 · a Welding learner shadowing Week 8's clip harvests nothing — no support row, no record", w.harvested === 0 && w.weldRowsAfter === 0, JSON.stringify({ h: w.harvested, rows: w.weldRowsAfter }));
ok("J8 · existing Welding curriculum is unchanged: 12 stages, 12 simulations", w.weeks === 12 && w.sims === 12 && /Stage 1/.test(w.stage || ""), JSON.stringify({ w: w.weeks, s: w.sims }));

ok("No uncaught page errors in any context", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
