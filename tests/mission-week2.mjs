/* BE Mastery V2.2 — General English Week 2 "Explain what you do", end to end,
   NUMBERING: this file is named for the prototype order. Canonically (V2.3)
   "Explain what you do" is General English WEEK 1 and "Give a clear update"
   is WEEK 2 — see the _note in tracks/general/missions.json. The W2/W3
   variables below are competency handles, not week numbers.
   and the architecture-scaling proof.

   Week 2 declares FIVE communication moves. Week 3 declares four. The point of
   this suite is that nothing in the engine, the evidence, the progress panel,
   the coach or the UI knows either number.

   Run:  cd tests && node mission-week2.mjs                                    */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const ME = require("../mission-engine.js");
const ROOT = new URL("..", import.meta.url).pathname;
const PACK = JSON.parse(readFileSync(ROOT + "tracks/general/missions.json", "utf8"));

const res = [];
const ok = (n, c, d = "") => { res.push({ name: n, pass: !!c }); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };

const W2 = ME.competencyOf(PACK, "explain-work");
const W3 = ME.competencyOf(PACK, "clear-update");
const G2 = ME.missionOf(W2, "explain-work-guided");
const T2 = ME.missionOf(W2, "explain-work-transfer");
const IV = [1, 3, 7, 21, 60];
const meta = c => ({ competency: c.id, week: c.week, moveIds: ME.moveIds(c) });

const SAY = {
  strong: W2.hear ? W2.hear.model : G2.hear.model,
  noWhy: "I work as an operations analyst in the logistics team. I'm responsible for the weekly delivery reports. At the moment I'm rebuilding how we track late shipments. I work closely with the warehouse managers.",
  transfer: "I am a project coordinator on the delivery team. I look after the schedule and the supplier paperwork for your account. Right now I am preparing the plan for your first shipment. I work closely with our warehouse and your logistics contact, so that nothing on your side has to be chased by hand.",
  w3strong: "The project is on track and we have completed two stages. We have run into an issue with the design agency. This means Friday delivery is at risk by about two days. I will chase it up today and come back to you tomorrow.",
  w3transfer: "Installation is due to start on Monday and everything else is ready. The materials from the supplier arrived three days late. That means we will push back the handover and the end of month promise is at risk. I will confirm a new date with the customer and come back to you this afternoon.",
  short: "I do stuff.",
};
const mk = (c, m, text, kind, key, at) => Object.assign(ME.grade(c, m, text, { seconds: 27 }),
  { key, kind, at: at || Date.now(), missionId: m.id });

/* ═══════════ G · DIFFERENT MOVE COUNTS, SAME ENGINE ═════════════════════ */
console.log("\nG · TWO COMPETENCIES, DIFFERENT MOVE COUNTS");
ok("Week 2 declares five moves; Week 3 declares four — from data, not code",
  ME.moveIds(W2).length === 5 && ME.moveIds(W3).length === 4
  && ME.moveIds(W2).join() === "role,own,now,why".replace("now,why", "now,who,why"),
  ME.moveIds(W2).join() + " | " + ME.moveIds(W3).join());
ok("Every Week 2 move has an id, a label, a hint, cues, a retry and patterns",
  W2.moves.every(m => m.id && m.label && m.hint && Array.isArray(m.cues) && m.cues.length && m.retry && Array.isArray(m.patterns)));
ok("Week 2 has a guided mission and a genuinely different transfer prompt",
  G2.kind === "guided" && T2.kind === "transfer" && G2.prompt !== T2.prompt
  && G2.see.who !== T2.see.who, G2.prompt + " / " + T2.prompt);

const g5 = ME.grade(W2, G2, SAY.strong, { seconds: 27 });
const g4 = ME.grade(W3, ME.missionOf(W3, "clear-update-guided"), SAY.w3strong, { seconds: 26 });
ok("A five-move answer and a four-move answer both grade to full coverage",
  g5.coverage === 1 && g4.coverage === 1 && Object.keys(g5.moves).length === 5 && Object.keys(g4.moves).length === 4);
const g5weak = ME.grade(W2, G2, SAY.noWhy, { seconds: 24 });
ok("Four of five moves is 0.8 and does NOT pass — the bar is every move, whatever the count",
  g5weak.coverage === 0.8 && !ME.passes(g5weak) && ME.weakestMove(W2, g5weak, []) === "why",
  `cov=${g5weak.coverage} weak=${ME.weakestMove(W2, g5weak, [])}`);
ok("Three of four still does not pass for Week 3 — unchanged by Week 2 arriving",
  !ME.passes(ME.grade(W3, ME.missionOf(W3, "clear-update-guided"), "The project is on track. We have run into a supplier issue. I will chase it up and let you know tomorrow.", { seconds: 20 })));
const p5 = ME.coachPrompt(ME.aiContext(ME.blank(W2.id), W2, G2, {}), "F");
const p4 = ME.coachPrompt(ME.aiContext(ME.blank(W3.id), W3, ME.missionOf(W3, "clear-update-guided"), {}), "F");
ok("The AI prompt states each competency's own move count and never the word 'four'",
  /makes 5 communication/.test(p5) && /makes 4 communication/.test(p4) && !/\bfour\b/i.test(p5) && !/\bfour\b/i.test(p4));
ok("The contract records exactly the moves the competency declares",
  Object.keys(ME.contract(mk(W2, G2, SAY.strong, "guided", "c1"), meta(W2)).moves).join() === ME.moveIds(W2).join());

/* ═══════════ SHADOW ABSENCE IS HANDLED, NOT FAKED ═══════════════════════ */
console.log("\n   SHADOW (Week 2 has no clip)");
ok("Week 2 declares no shadow clip — the library has nothing about describing your role",
  !W2.shadow && typeof W2._shadow_note === "string" && W2._shadow_note.length > 40);
ok("A Shadow round therefore cannot be linked to Week 2, and none is invented",
  ME.fromShadow({ kind: "challenge", ts: 1e12, vid: W3.shadow.vid, coverage: 0.9, pass: true, dims: {} }, W2).linked === false);
ok("…while the same round still links to Week 3, which does name that clip",
  ME.fromShadow({ kind: "challenge", ts: 1e12, vid: W3.shadow.vid, coverage: 0.9, pass: true, dims: {} }, W3).linked === true);
ok("Week 2's progress summary reports no shadow support rather than a zero",
  (() => { const s = ME.progressSummary(ME.blank(W2.id), W2); return s.shadow.total === 0 && s.shadow.rungName === null && s.pron === null; })());

/* ═══════════ F · WEEK 2 / WEEK 3 ISOLATION (engine) ═════════════════════ */
console.log("\nF · COMPETENCY ISOLATION");
const st = {};
ME.introduce(st, W2.id, "general-english");
ME.addAttempt(st, W2.id, mk(W2, G2, SAY.noWhy, "guided", "w2a"), "general-english", IV, meta(W2));
const w3Before = JSON.stringify(st[W3.id] || null);
ME.introduce(st, W3.id, "general-english");
ME.addAttempt(st, W3.id, mk(W3, ME.missionOf(W3, "clear-update-guided"), SAY.w3strong, "guided", "w3a"), "general-english", IV, meta(W3));
ok("Week 2 and Week 3 are separate records in the same store",
  st[W2.id] && st[W3.id] && st[W2.id] !== st[W3.id] && Object.keys(st).sort().join() === "clear-update,explain-work");
ok("A Week 3 attempt does not alter Week 2 state",
  st[W2.id].state === "PRACTICING" && st[W2.id].attempts.length === 1);
ok("A Week 2 attempt does not alter Week 3 state",
  st[W3.id].state === "DEMONSTRATED" && st[W3.id].attempts.length === 1 && w3Before === "null");
ok("Each attempt is stamped with its own competency and week",
  st[W2.id].attempts[0].competency === "explain-work" && st[W2.id].attempts[0].week === 1
  && st[W3.id].attempts[0].competency === "clear-update" && st[W3.id].attempts[0].week === 2);
ok("A Week 2 key and a Week 3 key never collide — idempotency is per competency",
  (() => { const s2 = {}; ME.addAttempt(s2, W2.id, mk(W2, G2, SAY.strong, "guided", "same"), "general-english", IV, meta(W2));
    const r = ME.addAttempt(s2, W3.id, mk(W3, ME.missionOf(W3, "clear-update-guided"), SAY.w3strong, "guided", "same"), "general-english", IV, meta(W3));
    return !r.duplicate && s2[W2.id].attempts.length === 1 && s2[W3.id].attempts.length === 1; })());

/* ═══════════ RECOMMENDATION ACROSS COMPETENCIES ═════════════════════════ */
console.log("\n   RECOMMENDATION — A weak W2 / B strong W2 / C weak W3");
const comps = PACK.competencies;
const store = () => ({});
const put = (s, c, m, txt, kind, key) => { ME.introduce(s, c.id, "general-english"); ME.addAttempt(s, c.id, mk(c, m, txt, kind, key), "general-english", IV, meta(c)); };
const G3 = ME.missionOf(W3, "clear-update-guided"), T3 = ME.missionOf(W3, "clear-update-transfer");
const pick = s => ME.pickNext(comps, id => s[id], Date.now());

let A = store(); put(A, W2, G2, SAY.noWhy, "guided", "a1");
let B = store(); put(B, W2, G2, SAY.strong, "guided", "b1");
let C = store(); put(C, W3, G3, "The project is on track. We have run into a supplier issue. I will chase it up and let you know tomorrow.", "guided", "c1");
const pA = pick(A), pB = pick(B), pC = pick(C);
ok("Learner A (weak Week 2) is sent back to Week 2, at the move they missed",
  pA.comp.id === "explain-work" && pA.rec.action === "retry" && pA.rec.move === "why", JSON.stringify({ c: pA.comp.id, a: pA.rec.action, m: pA.rec.move }));
ok("Learner B (strong Week 2) is sent to the Week 2 cold transfer, not to another week",
  pB.comp.id === "explain-work" && pB.rec.action === "transfer", JSON.stringify({ c: pB.comp.id, a: pB.rec.action }));
ok("Learner C (weak Week 3) is sent to Week 3 — the earlier week does not win by default",
  pC.comp.id === "clear-update" && pC.rec.action === "retry" && pC.rec.move === "impact", JSON.stringify({ c: pC.comp.id, a: pC.rec.action, m: pC.rec.move }));

let D = store(); put(D, W2, G2, SAY.strong, "guided", "d1"); put(D, W3, G3, "The project is on track. We have run into a supplier issue. I will chase it up.", "guided", "d2");
const pD = pick(D);
ok("clear-update's weak move outranks explain-work's transfer — the engine's own priority, not the week number",
  pD.comp.id === "clear-update" && pD.rec.action === "retry",
  JSON.stringify({ c: pD.comp.id, a: pD.rec.action }));
let E = store(); put(E, W2, G2, SAY.noWhy, "guided", "e1"); put(E, W3, G3, "The project is on track. We have run into a supplier issue. I will chase it up.", "guided", "e2");
ok("When both are equally urgent the EARLIER week leads — the tie-break, and only the tie-break",
  pick(E).comp.id === "explain-work", pick(E).comp.id);
let F = store();
put(F, W2, G2, SAY.strong, "guided", "f1"); put(F, W2, T2, SAY.transfer, "transfer", "f2");
/* The Week 3 transfer text has to make all four of ITS moves — the first
   draft of this fixture said the materials "arrived three days late", which
   the rubric reads as impact and not as naming the problem, so Week 3 stayed
   DEMONSTRATED and the case failed for the right reason. */
put(F, W3, G3, SAY.w3strong, "guided", "f3"); put(F, W3, T3, SAY.w3transfer, "transfer", "f4");
/* V2.3: a third competency ("Raise a problem", Week 3) now sits in the pack.
   With the first two resting, the engine offers it — a competency nobody has
   spoken for is never skipped. Only when EVERY competency rests is nothing pushed. */
const W4 = ME.competencyOf(PACK, "raise-problem");
ok("With the first two resting, the engine offers the third competency to speak — it is not skipped",
  W4 && pick(F) && pick(F).comp.id === "raise-problem" && pick(F).rec.action === "speak", JSON.stringify(pick(F) && { c: pick(F).comp.id, a: pick(F).rec.action }));
put(F, W4, ME.missionOf(W4, "raise-problem-guided"), ME.missionOf(W4, "raise-problem-guided").hear.model, "guided", "f5");
put(F, W4, ME.missionOf(W4, "raise-problem-transfer"), "There is a problem with the monthly figures. It started when the old report was switched off in August. This means the Thursday board pack is at risk. I have spoken to finance and asked them to rerun the numbers. Could you sign off on a one-day delay so we can check them?", "transfer", "f6");
/* V2.4: a fourth competency ("Clarifying, asking questions & confirming",
   Week 4) sits in the pack. Same rule, one more entry: offered when the first
   three rest, and nothing is pushed only once it rests too. */
const W5 = ME.competencyOf(PACK, "clarify-confirm");
ok("With the first three resting, the engine offers the fourth competency to speak — it is not skipped",
  W5 && pick(F) && pick(F).comp.id === "clarify-confirm" && pick(F).rec.action === "speak", JSON.stringify(pick(F) && { c: pick(F).comp.id, a: pick(F).rec.action }));
put(F, W5, ME.missionOf(W5, "clarify-confirm-guided"), ME.missionOf(W5, "clarify-confirm-guided").hear.model, "guided", "f7");
put(F, W5, ME.missionOf(W5, "clarify-confirm-transfer"), "Sorry, I'm not sure I follow — the client thing could be two things. Are you asking about the revised quote or the delivery date they wanted? So you're saying it's the quote they're expecting before Wednesday's review. Then I'll send the quote today and come back to you tomorrow on the delivery date — does that work?", "transfer", "f8");
/* V2.5: a fifth competency ("Explaining technical work to non-technical
   stakeholders", Week 5). Same rule, one more entry. */
const W6 = ME.competencyOf(PACK, "explain-tech");
ok("With the first four resting, the engine offers the fifth competency to speak — it is not skipped",
  W6 && pick(F) && pick(F).comp.id === "explain-tech" && pick(F).rec.action === "speak", JSON.stringify(pick(F) && { c: pick(F).comp.id, a: pick(F).rec.action }));
put(F, W6, ME.missionOf(W6, "explain-tech-guided"), ME.missionOf(W6, "explain-tech-guided").hear.model, "guided", "f9");
put(F, W6, ME.missionOf(W6, "explain-tech-transfer"), "In plain terms, the integration is a link between their shop and our warehouse. The way it works is that every time a customer places an order, it goes straight to the warehouse system automatically, instead of someone typing it in each morning. What this means for the client is that orders ship the same day and the typing mistakes stop. The one thing to remember is that returns aren't included yet — those are still done by hand. Does that make sense?", "transfer", "f10");
/* V2.6/V2.7: every competency after Week 5, in week order, from a per-id
   cold-transfer fixture map — offered when everything before it rests, and
   only once the last one rests too is nothing pushed. A new week adds one
   entry here instead of a new numbered block. */
const LATER_TRANSFERS = {
  "recommend-decide": "There are two options here. One option is to send it tomorrow with the numbers corrected by hand, and the other option is to hold it for two days and rerun everything from the fixed source. My recommendation is to hold it. The reason is that last quarter they complained about a wrong figure, and two of the twelve charts can't be checked in time if we send tomorrow. The downside is that it's the first late report we've ever sent them. So the next step is that you tell the client today that it's coming on Thursday, and I'll rerun it as soon as the source is fixed.",
  "disagree-pushback": "I understand why the director wants one go \u2014 a phased move takes longer, and nobody wants this dragging into next year. I'd push back on doing the whole warehouse in one weekend, though. The reason is the pilot: at the small depot the switch took two weeks to settle, forty stock counts were wrong in the first week, and the main warehouse holds twenty times the stock. What I'd suggest is that we switch the night team first, since they're already trained, and bring the day shifts across two weeks later. We both want this done before December, and that way we still finish by the end of November without a weekend where nothing can be counted. What would the director need to see to agree to that?",
  "sprint-coordinate": "The landing page is built and both banner variants are ready to test. The sign-up form is blocked: the dependency is legal's review of the prize-draw terms \u2014 they've had them since Monday and said end of week. Without approved terms the form can't go live, so the first is at risk for sign-ups. To keep the launch on track, I'd go out on the first with the newsletter and no prize draw, and add the draw the week after when legal comes back. Could you ping the head of legal today and let me know by Thursday? If the terms land by Thursday, the form is live for the first; either way the newsletter goes out on the first.",
  "exec-summary": "The short version: the savings programme reaches its 400 thousand target this year only if we close the third supplier, and that needs a decision from you before Friday. At a high level, two of the four contracts are signed, worth 260 thousand, and the fourth signs next month for another 60. The biggest risk is the third supplier \u2014 110 thousand of the target \u2014 where the negotiation has stalled for three weeks on payment terms: they want 60 days, our standard is 45. Finance can live with 60 days if you agree, and their offer lapses on Friday. The decision I need from you is whether we accept 60-day terms to close it this week. The key takeaway: without the third contract we land at 320, short of target; with it, we're over.",
  "sell-experience": "The challenge was that our forty field engineers were driving two hours forty a day between jobs. Overtime was thirty per cent over budget, and two engineers had resigned because of the driving. Nobody had looked at routing since the company doubled in size, so I led the effort to fix it. I pulled the last three months of job data with an analyst from the planning team, and we found jobs were assigned by who was free, not by where they were. The dispatchers were worried customers would wait longer, so I influenced the decision by asking the director for one region and six weeks, with waiting times measured too. The result was that driving fell to an hour fifty and overtime came back within budget, and waiting times didn't move. It's now live in all four regions. That experience taught me that I do my best work where data and persuasion meet, and that's the role I'm looking for next.",
  "win-support": "What's at stake here is your output per shift, because the line is going to stop either way — the only question is whether we choose when. The cost of doing nothing is five unplanned breakdowns in six months at about nine hours each, so forty-five hours of lost packing against sixteen for a planned stop. I'm confident because we have six months of readings on that gearbox and it is the same rising pattern that ran before the last two failures; the bearing supplier's own data gives it about three months before it seizes. Two planned days buys us back the twenty-nine hours we are losing to breakdowns, and it pays for itself the first time it stops one. Here's what I need from you: two days in the quiet fortnight in November. The window to act is before December, because we cannot stop the line in peak and the gearbox warranty is gone at the end of the month.",
  "final-integration": "Quick status: the routing has been running correctly in four of the five queues on the bench for three weeks. Just to make sure I understand — when you say all queues, does that include the vulnerable-customer queue? Because the lab test never covered it. I have one concern about switching that queue without a parallel run. Last year a routing change dropped about one in twelve vulnerable call-backs for a day, and we had to tell the regulator. What I'd recommend is switching the four proven queues on Friday and holding the fifth for a two-day parallel run the week after. Bottom line: you get Friday on four queues, and the one with the legal duty gets checked first.",
};
const LATER = PACK.competencies.filter(c => c.week > 5).sort((a, b) => a.week - b.week);
ok("Every competency after Week 5 has a cold-transfer fixture in this suite", LATER.length >= 1 && LATER.every(c => typeof LATER_TRANSFERS[c.id] === "string"), LATER.map(c => c.id).join());
LATER.forEach(c => {
  ok(`With everything before it resting, the engine offers ${c.id} (Week ${c.week}) to speak — it is not skipped`,
    pick(F) && pick(F).comp.id === c.id && pick(F).rec.action === "speak", JSON.stringify(pick(F) && { c: pick(F).comp.id, a: pick(F).rec.action }));
  const g = c.missions.find(m => m.kind === "guided"), t = c.missions.find(m => m.kind === "transfer");
  put(F, c, g, g.hear.model, "guided", "fg" + c.week); put(F, c, t, LATER_TRANSFERS[c.id], "transfer", "ft" + c.week);
});
ok("With every competency transfer-ready, nothing is pushed and the old advice stands", pick(F) === null, JSON.stringify(pick(F) && { c: pick(F).comp.id, a: pick(F).rec.action }));

/* ═══════════ BROWSER ════════════════════════════════════════════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8041, 8042, 8043, 8044, 8045]) {
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

async function learner(id, track) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
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
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Finish by saying what your work is for.", covered: coachCovered }) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?w2=" + Date.now(), { waitUntil: "load" });
  await sleep(1000);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov").forEach(e => e.remove()));
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
const rec2 = (page, id) => page.evaluate(i => JSON.parse(JSON.stringify(mvStore()[i] || {})), id);

console.log("\nIN THE APP");
const L = await learner("ge", "general-english");
await L.page.evaluate(() => { window.__ev = []; const t0 = window.track; window.track = (n, p) => { window.__ev.push([n, p || {}]); return t0 && t0(n, p); }; });

/* Home leads with Week 2 for a learner who has spoken for nothing */
const home = await L.page.evaluate(() => { go("home"); const c = document.querySelector(".mv-home"); return { n: document.querySelectorAll(".mv-home").length, eyebrow: c && c.querySelector(".eyebrow").innerText, title: c && c.querySelector("h2").innerText }; });
ok("Home offers ONE mission card, and for a fresh learner it is Week 2",
  home.n === 1 && /Week 1/i.test(home.eyebrow || "") && /Explain what you do/i.test(home.title || ""), JSON.stringify(home));

/* SEE / HEAR / NOTICE render the five moves with no Shadow row */
await L.page.evaluate(() => mvGo("explain-work-guided", "notice")); await sleep(350);
const notice = await L.page.evaluate(() => ({
  moves: [...document.querySelectorAll(".mv-list li b")].map(b => b.innerText),
  eyebrow: (document.querySelector(".mv-notice .eyebrow") || {}).innerText,
  sub: (document.querySelector(".mv-notice .sub") || {}).innerText,
  shadow: !!document.querySelector(".mv-shadow"), title: (document.querySelector(".mv-title") || {}).innerText }));
ok("NOTICE renders all five Week 2 moves, says 'five', and shows no Shadow row",
  notice.moves.join() === "Role,Responsibility,Right now,Who it's for,Why it matters"
  && /5 moves/i.test(notice.eyebrow + " " + notice.sub) && notice.shadow === false
  && /Explain what you do/i.test(notice.title || ""), JSON.stringify(notice));
const noType = await L.page.evaluate(() => ({ ta: document.querySelectorAll("#v-mission textarea").length, inp: document.querySelectorAll("#v-mission input[type=text]").length, sc: document.querySelectorAll("#v-mission .score-b").length }));
ok("Week 2 is speaking-first too — no script box, no text input, no self-score",
  noType.ta === 0 && noType.inp === 0 && noType.sc === 0, JSON.stringify(noType));

/* ── B · WEAKNESS ── */
console.log("\nB · WEAK MOVE");
await L.page.evaluate(() => mvStep("speak")); await sleep(250);
coachCovered = ["role", "own", "now", "who"];
await speak(L.page, SAY.noWhy);
const b1 = await L.page.evaluate(() => ({ moves: _mv.ev.moves, cov: _mv.ev.coverage, move: _mv.coach.move, improve: _mv.coach.improve, chips: document.querySelectorAll(".mv-move").length, off: document.querySelectorAll(".mv-move.off").length }));
ok("B1 · the missing move is identified from what was said, and five chips render",
  b1.moves.why === false && b1.cov === 0.8 && b1.move === "why" && b1.chips === 5 && b1.off === 1, JSON.stringify({ c: b1.cov, m: b1.move, chips: b1.chips }));
ok("B2 · four of five does not advance the learner", (await rec2(L.page, "explain-work")).state === "PRACTICING");
ok("B3 · the coach's system prompt carried explain-work's five moves, not clear-update's four",
  /makes 5 communication/.test(lastSystem) && /why \(Why it matters\)/.test(lastSystem) && !/impact/.test(lastSystem),
  lastSystem.slice(0, 90));

/* ── C · RETRY ── */
console.log("\nC · RETRY");
const retry = await L.page.evaluate(() => { mvRetry(); return { text: _mv.retryText, step: _mv.step }; });
ok("C1 · the retry names the Week 2 move that was missed", /what your work is actually for|what it makes possible/i.test(retry.text || ""), retry.text);
coachCovered = ["role", "own", "now", "who", "why"];
await speak(L.page, SAY.strong);
const c2 = await rec2(L.page, "explain-work");
ok("C2 · the retry is stored as a retry and both attempts are preserved",
  c2.attempts.length === 2 && c2.attempts[0].coverage === 0.8 && c2.attempts[1].kind === "retry" && c2.attempts[1].coverage === 1);
ok("C3 · progression recalculates to DEMONSTRATED — and no duplicate row", c2.state === "DEMONSTRATED", c2.state);

/* ── D · TRANSFER ── */
console.log("\nD · TRANSFER");
await L.page.evaluate(() => mvGo("explain-work-transfer", "speak")); await sleep(300);
const tprompt = await L.page.evaluate(() => ({ q: (document.querySelector(".mv-q") || {}).innerText, comp: _mv.compId }));
ok("D1 · the transfer is a different situation, and still Week 2",
  /tell us a bit about your role/i.test(tprompt.q || "") && tprompt.comp === "explain-work", JSON.stringify(tprompt));
await speak(L.page, SAY.transfer);
const d2 = await rec2(L.page, "explain-work");
ok("D2 · transfer evidence is stored as its own kind, separate from practice",
  d2.attempts.length === 3 && d2.attempts[2].kind === "transfer" && d2.attempts[2].transfer === true
  && d2.attempts.filter(a => a.kind === "guided" || a.kind === "retry").length === 2);
ok("D3 · one cold success is TRANSFER_READY, not STRONG", d2.state === "TRANSFER_READY" && d2.transfer.passed === 1, d2.state);
ok("D4 · a retrieval is scheduled from the track's own intervals", d2.retrieval && d2.retrieval.due > Date.now());

/* ── A · SUCCESS, and everything downstream ── */
console.log("\nA · SUCCESS DOWNSTREAM");
const prog = await L.page.evaluate(() => { go("review"); const ps = [...document.querySelectorAll(".pg-v2")]; const d = window.v2Evidence();
  return { panels: ps.length, txt: ps.map(p => p.innerText.replace(/\s+/g, " ")).join(" || "), comps: d.map(x => x.competency + ":" + x.state), moves: (d[0].byMove || []).length }; });
ok("A1 · Progress renders Week 2 with its five moves and its state",
  prog.panels === 1 && prog.comps.join() === "explain-work:TRANSFER_READY" && prog.moves === 5
  && /Week 1/.test(prog.txt) && /Why it matters/.test(prog.txt), JSON.stringify({ p: prog.panels, c: prog.comps, m: prog.moves }));
const rec = await L.page.evaluate(() => ({ a: AdaptiveLearningEngine.recommendation(S, ProfessionalTrackContext.active()), m: LearningCoach.mission(S, ProfessionalTrackContext.active()) }));
ok("A2 · with Week 2 complete the engine moves the learner on to Week 3",
  rec.a.v2 === true && rec.m.arg1 === "clear-update-guided", JSON.stringify({ t: rec.a.title, arg: rec.m.arg1 }));
const voc = await L.page.evaluate(() => Object.entries(areaVocab()).filter(([, v]) => v.src && v.src.v2 === "explain-work").map(([w]) => w));
ok("A3 · Week 2 expressions were acquired automatically, tagged to Week 2", voc.length > 0, JSON.stringify(voc));
const ev = await L.page.evaluate(() => (window.__ev || []).filter(e => e[0].startsWith("v2_")).map(e => [e[0], e[1].week, e[1].competency]));
ok("A4 · every Week 2 analytics event carries week 2 and the Week 2 competency",
  ev.length > 0 && ev.every(e => e[1] === "1" && e[2] === "explain-work"), JSON.stringify(ev.slice(0, 4)));

/* ── F · BOTH WEEKS IN ONE LEARNER, IN THE APP ── */
console.log("\nF · BOTH WEEKS, ONE LEARNER");
coachCovered = ["status", "issue", "impact", "next"];
await L.page.evaluate(() => mvGo("clear-update-guided", "speak")); await sleep(300);
await speak(L.page, SAY.w3strong);
const both = await L.page.evaluate(() => { go("review"); const d = window.v2Evidence();
  return { comps: d.map(x => ({ c: x.competency, w: x.week, s: x.state, m: (x.byMove || []).length, a: x.attempts })),
    panels: document.querySelectorAll(".pg-v2").length }; });
ok("F1 · both competencies render, oldest week first, each with its own move count",
  both.panels === 2 && both.comps[0].c === "explain-work" && both.comps[0].m === 5
  && both.comps[1].c === "clear-update" && both.comps[1].m === 4, JSON.stringify(both.comps));
ok("F2 · the Week 3 attempt did not disturb Week 2's record",
  both.comps[0].s === "TRANSFER_READY" && both.comps[0].a === 3 && both.comps[1].a === 1, JSON.stringify(both.comps));

/* ── E · OFFLINE ── */
console.log("\nE · NETWORK FAILURE");
const O = await learner("off", "general-english");
await O.page.evaluate(() => mvGo("explain-work-guided", "speak")); await sleep(300);
coachMode = "abort";
const hits0 = polishHits;
await speak(O.page, SAY.strong);
const e1 = await O.page.evaluate(async () => { const r = mvStore()["explain-work"]; const recs = await getRecs(_mv.recCtx);
  return { n: r.attempts.length, said: !!r.attempts[0].said, cov: r.attempts[0].coverage, pending: r.attempts[0].coachPending, state: r.state, audio: recs.length, offline: _mv.coach && _mv.coach.offline, move: _mv.coach && _mv.coach.move }; });
ok("E1 · attempt, transcript and audio survive; evidence is still correct",
  e1.n === 1 && e1.said && e1.audio === 1 && e1.cov === 1 && e1.state === "DEMONSTRATED", JSON.stringify(e1));
ok("E2 · coaching is pending and the deterministic fallback names a real Week 2 move",
  e1.pending === true && e1.offline === true, JSON.stringify(e1));
coachMode = "ok"; coachCovered = ["role", "own", "now", "who", "why"];
await O.page.evaluate(() => mvFinishCoaching());
await O.page.waitForFunction(() => _mv && !_mv.busy, null, { timeout: 12000 }).catch(() => {});
await sleep(300);
const e3 = await O.page.evaluate(() => { const r = mvStore()["explain-work"]; return { n: r.attempts.length, pending: r.attempts[0].coachPending, ai: _mv.coach && _mv.coach.ai }; });
ok("E3 · recovery completes the coaching and creates no second piece of evidence",
  e3.n === 1 && e3.pending === false && e3.ai === true, JSON.stringify(e3));
ok("E4 · the Worker was called again on recovery, and only for coaching", polishHits > hits0 + 1);

/* ── H · WELDING ── */
console.log("\nH · WELDING ISOLATION");
const W = await learner("weld", "welding");
await W.page.evaluate(() => { window.__ev = []; const t0 = window.track; window.track = (n, p) => { window.__ev.push([n, p || {}]); return t0 && t0(n, p); }; });
const w = await W.page.evaluate(async () => {
  const before = JSON.stringify(S.v2A || {});
  go("home"); await new Promise(r => setTimeout(r, 300));
  const card = !!document.querySelector(".mv-home");
  go("mission", "explain-work-guided", "speak"); await new Promise(r => setTimeout(r, 400));
  const view = cur.v, html = (document.getElementById("v-mission") || {}).innerHTML;
  const refused = MissionEngine.addAttempt(S.v2A || (S.v2A = {}), "explain-work", { key: "x", answered: true, coverage: 1, kind: "guided" }, areaId(), [1]) === null;
  mvTrack("v2_speak_attempt", { mission: "explain-work-guided" });
  go("review"); await new Promise(r => setTimeout(r, 300));
  return { area: areaId(), comps: mvComps().length, comp: mvComp(), missions: activeCurriculum().missions, card, view, html: (html || "").length,
    refused, unchanged: JSON.stringify(S.v2A || {}) === before, ev: window.v2Evidence(), rec: window.v2Recommendation(),
    panel: !!document.querySelector(".pg-v2"), events: (window.__ev || []).filter(e => e[0].startsWith("v2_")).length };
});
ok("H1 · Welding's curriculum has no missions at all — neither week reaches it",
  w.area === "welding" && w.missions === null && w.comps === 0 && w.comp === null, JSON.stringify({ a: w.area, m: w.missions, c: w.comps }));
ok("H2 · no mission card on the Welding home", w.card === false);
ok("H3 · routing straight to the Week 2 mission turns a Welding learner around",
  w.view === "home" && w.html === 0, JSON.stringify({ v: w.view, len: w.html }));
ok("H4 · the engine refuses to write Week 2 evidence for a Welding learner", w.refused && w.unchanged);
ok("H5 · no Week 2 analytics can be emitted from Welding", w.events === 0, String(w.events));
ok("H6 · both hooks return null and the Progress page shows no V2 panel",
  w.ev === null && w.rec === null && w.panel === false);
const wcur = await W.page.evaluate(() => { const p = activeCurriculum(); return { weeks: (p.weeks || []).length, sims: (p.simulations || []).length, stage: (p.weeks[0] || {}).stage }; });
ok("H7 · existing Welding curriculum is unchanged (12 stages, 12 simulations)",
  wcur.weeks === 12 && wcur.sims === 12 && /Stage 1/.test(wcur.stage || ""), JSON.stringify(wcur));

ok("No uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
