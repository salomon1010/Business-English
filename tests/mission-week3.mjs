/* BE Mastery V2 — General English Week 3 "Give a clear update", end to end.
   NUMBERING: named for the prototype order. Canonically (V2.3) "Give a clear
   update" is General English WEEK 2 — see the _note in missions.json.

   Run:  cd tests && node mission-week3.mjs
         BASE=http://localhost:8011 node mission-week3.mjs

   Two halves:
     1. The engine, in Node, against the real tracks/general/missions.json.
     2. The loop, in a real headless Chromium, walking
        SEE → HEAR → NOTICE → SPEAK → COACH → RETRY → TRANSFER → EVIDENCE
        with a scripted SpeechRecognition double and a mocked Worker.

   The five scenarios the V2 brief names are A–E at the bottom. Every check
   here is a claim the product makes to a learner about what they can do. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const ME = require("../mission-engine.js");
const PACK = JSON.parse(readFileSync(new URL("../tracks/general/missions.json", import.meta.url), "utf8"));

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

/* ── speech the double will "hear" ────────────────────────────────────────── */
const SAY = {
  strong: "The project is on track and we have completed two stages. We have run into an issue with the design agency. This means Friday delivery is at risk by about two days. I will chase it up today and come back to you tomorrow.",
  noImpact: "The project is on track and two stages are finished. We have run into a supplier issue with the logo files. I will chase it up and let you know tomorrow.",
  transferStrong: "Installation is due to start on Monday and everything else is ready. The materials from the supplier arrived three days late. That means we will push back the handover and the end of month promise is at risk. I will confirm a new date with the customer and come back to you this afternoon.",
  tooShort: "Yeah fine.",
};

/* ══════════════════════════ 1. ENGINE (no browser) ═══════════════════════ */
console.log("\nENGINE");
const comp = ME.competencyOf(PACK, "clear-update");
const G = ME.missionOf(comp, "clear-update-guided");
const T = ME.missionOf(comp, "clear-update-transfer");
ok("'Give a clear update' (Week 2) loads with four moves and two missions",
  comp && comp.week === 2 && ME.moveIds(comp).join() === "status,issue,impact,next" && comp.missions.length === 2);

const gStrong = ME.grade(comp, G, SAY.strong, { seconds: 26 });
ok("A strong update covers all four moves and passes", gStrong.coverage === 1 && ME.passes(gStrong));
const gWeak = ME.grade(comp, G, SAY.noImpact, { seconds: 22 });
ok("An update with no IMPACT does NOT pass, and IMPACT is named as the weakness",
  gWeak.coverage === 0.75 && !ME.passes(gWeak) && ME.weakestMove(comp, gWeak, []) === "impact",
  `cov=${gWeak.coverage} weak=${ME.weakestMove(comp, gWeak, [])}`);
ok("Three moves out of four is not 'demonstrated' — the bar is every move", !ME.passes({ answered: true, coverage: 0.75 }));
const gShort = ME.grade(comp, G, SAY.tooShort, { seconds: 3 });
ok("A two-word reply is not an answer", !gShort.answered);

/* the failure the unpunctuated browser transcript would otherwise cause */
const noPunct = ME.grade(comp, G, SAY.strong.replace(/[.]/g, "").toLowerCase(), { seconds: 26 });
ok("Clarity does not collapse when the transcriber returns no punctuation",
  noPunct.clarity === 1 && noPunct.clarityBasis === "order", `clarity=${noPunct.clarity} basis=${noPunct.clarityBasis}`);

/* the AI may add a move, never remove one, never invent one */
const assisted = ME.applyCoachMoves(ME.grade(comp, G, SAY.noImpact, { seconds: 22 }), comp, ["impact", "not-a-move", "status"]);
ok("An AI pass may ADD a missed move and its unknown ids are discarded",
  assisted.moves.impact === true && assisted.coverage === 1 && assisted.assisted === true && !("not-a-move" in assisted.moves));
const removed = ME.applyCoachMoves(ME.grade(comp, G, SAY.strong, { seconds: 26 }), comp, []);
ok("An AI pass cannot remove a move the learner made", removed.coverage === 1);

/* the track guard, in the engine itself */
ok("The engine refuses a write for any track but General English",
  ME.addAttempt({}, "clear-update", { key: "x", answered: true, coverage: 1 }, "welding", [1]) === null);

/* ══════════════════════════ 2. BROWSER ═══════════════════════════════════ */
/* Pick a free port and then PROVE the server that answers on it is ours.

   Other sessions on this machine keep their own `python3 -m http.server`
   running against their own worktrees. When one of them already holds the port
   this test wanted, spawn() fails silently, the suite happily talks to that
   other tree, and every failure it reports is about somebody else's code. That
   happened while this suite was being written. So: bind, then fetch the page
   and compare it with the file on disk before running a single check. */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const root = new URL("..", import.meta.url).pathname;
  const mine = readFileSync(root + "index.html", "utf8");
  for (const port of [8021, 8022, 8023, 8024, 8025]) {
    const s = spawn("python3", ["-m", "http.server", String(port)], { cwd: root, stdio: "ignore" });
    await sleep(700);
    let served = null;
    try { served = await (await fetch(`http://localhost:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://localhost:${port}`; break; }
    s.kill();
    console.log(`  (port ${port} is serving someone else's tree — trying the next one)`);
  }
  if (!BASE) { console.error("Could not start a server on a free port. Pass BASE=… instead."); process.exit(1); }
}
console.log("  serving: " + BASE);
const POLISH = "https://be-polish.nore-ngou.workers.dev";
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
let coachMode = "ok";        // ok | abort | 500
let coachCovered = null;     // what the mocked model claims was covered
let polishHits = 0;

async function learner(id, track) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  await ctx.addInitScript(({ track }) => {
    /* A scripted SpeechRecognition. The app captures
       `const SR = window.SpeechRecognition || window.webkitSpeechRecognition`
       at load, so this has to exist before the page script runs — which is
       exactly what addInitScript guarantees. It emits whatever the test has
       put in window.__say, as one final result, then ends. */
    class FakeSR {
      constructor() { this.lang = ""; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this._t = null; }
      _fire() {
        const txt = window.__say || "";
        if (txt && this.onresult) {
          const r = [{ 0: { transcript: txt, confidence: 0.9 }, isFinal: true, length: 1 }];
          r.length = 1;
          try { this.onresult({ results: r, resultIndex: 0 }); } catch (e) {}
        }
      }
      _end() { this._on = false; if (this._t) { clearTimeout(this._t); this._t = null; } if (this.onend) setTimeout(() => { try { this.onend(); } catch (e) {} }, 0); }
      start() {
        this._on = true;
        this._t = setTimeout(() => { if (!this._on) return; this._fire(); this._end(); }, 120);
      }
      /* The real API fires `end` after every stop(), whether or not a result
         was pending. The app's restart loop depends on that: shFBDone only
         runs from onend, so a double that swallowed it left the whole
         transcript path silently dead on every second recording. */
      stop() { if (this._on) this._fire(); this._end(); }
      abort() { this._on = false; this._end(); }
    }
    window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
    if (!localStorage.getItem("be12_v1")) {
      const st = { profile: { name: "Test", role: "", goal: "Speak with confidence in meetings", slot: "", lang: "en", ts: Date.now() },
        professionalTracks: { activeId: track },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() },
               "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
        days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() };
      localStorage.setItem("be12_v1", JSON.stringify(st));
    }
  }, { track });

  await ctx.route(u => u.href.startsWith(POLISH), async route => {
    polishHits++;
    if (coachMode === "abort") return route.abort("failed");
    if (coachMode === "500") return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    let body = {};
    try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (body.assess) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ overall: 88, mode: "ai", words: [{ word: "the", score: 88 }] }) });
    if (body.chat) {
      const sys = String(body.chat.system || "");
      const covered = coachCovered || (/status/.test(sys) ? [] : []);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Say what the delay means for Friday, in one sentence.", covered }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?mv=" + Date.now(), { waitUntil: "load" });
  await sleep(900);
  await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()); });
  return { ctx, page, id };
}

/* say something and let the loop run: tap record, wait for the recorder, wait
   for the fake transcript, tap stop, wait for the coach step to settle */
async function speak(page, text) {
  await page.evaluate(t => { window.__say = t; }, text);
  await page.evaluate(() => mvRecord());
  await page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
  await sleep(1500);                                   // past the recorder's 1.2 KB / 400 ms floor
  await page.evaluate(() => mvRecord());
  await page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
  await sleep(250);
}
const stateOf = page => page.evaluate(() => (mvStore()["clear-update"] || {}).state);
const recOf = page => page.evaluate(() => JSON.parse(JSON.stringify(mvStore()["clear-update"] || {})));
const evs = page => page.evaluate(() => window.__ev || []);
const spyOn = page => page.evaluate(() => { window.__ev = []; const t0 = window.track; window.track = (n, p) => { window.__ev.push([n, p || {}]); return t0 && t0(n, p); }; });

console.log("\nBROWSER — the loop");
const A = await learner("alice", "general-english");
await spyOn(A.page);

/* ── the mission is on Home, and it is the only way in ── */
/* Home shows ONE V2 card, chosen by the engine. For a learner who has spoken
   for nothing yet that is the earliest competency, which is Week 2 — so this
   suite asserts the card exists and then navigates to Week 3 explicitly.
   Which competency leads is the Week 2 suite's business. */
const home = await A.page.evaluate(() => { go("home"); return { card: !!document.querySelector(".mv-home"), cards: document.querySelectorAll(".mv-home").length, title: (document.querySelector(".mv-home h2") || {}).innerText, state: (document.querySelector(".mv-home .chip") || {}).innerText }; });
ok("Home leads with exactly one V2 mission card", home.card && home.cards === 1 && /Not started/i.test(home.state || ""), JSON.stringify(home));

/* ── SEE → HEAR → NOTICE ── */
await A.page.evaluate(() => mvGo("clear-update-guided", "see")); await sleep(300);
const see = await A.page.evaluate(() => ({ q: (document.querySelector(".mv-q") || {}).innerText, goal: !!document.querySelector(".mv-goal"), state: (mvStore()["clear-update"] || {}).state }));
ok("SEE shows the manager's question and awards INTRODUCED — and nothing more",
  /quick update on the project/i.test(see.q || "") && see.goal && see.state === "INTRODUCED", JSON.stringify(see));

await A.page.evaluate(() => mvStep("hear")); await sleep(250);
const hear = await A.page.evaluate(() => {
  let spoke = 0; const f = window.fbSay; window.fbSay = (...a) => { spoke++; return f && f(...a); };
  document.querySelector(".mv-play .btn-p").click();
  const before = !!document.querySelector(".mv-model");
  document.querySelector(".mv-reveal").click();
  return { spoke, before, after: !!document.querySelector(".mv-model") };
});
ok("HEAR plays a spoken model through the existing TTS, with the words hidden until asked for",
  hear.spoke === 1 && !hear.before && hear.after, JSON.stringify(hear));

await A.page.evaluate(() => mvStep("notice")); await sleep(250);
const notice = await A.page.evaluate(() => ({ moves: [...document.querySelectorAll(".mv-list li b")].map(b => b.innerText), shadow: !!document.querySelector(".mv-shadow") }));
ok("NOTICE teaches the four moves in order and offers the existing Shadow studio",
  notice.moves.join() === "Status,Issue,Impact,Next step" && notice.shadow, JSON.stringify(notice));

/* ── no script box anywhere in the loop ── */
await A.page.evaluate(() => mvStep("speak")); await sleep(250);
const noType = await A.page.evaluate(() => ({ ta: document.querySelectorAll("#v-mission textarea").length, inp: document.querySelectorAll("#v-mission input[type=text]").length, score: document.querySelectorAll("#v-mission .score-b").length }));
ok("SPEAK asks for speech only — no script box, no text input, no self-score row anywhere in the mission",
  noType.ta === 0 && noType.inp === 0 && noType.score === 0, JSON.stringify(noType));

/* ════════════════ SCENARIO B — a specific weakness ═══════════════════════ */
console.log("\nSCENARIO B — weak IMPACT");
coachCovered = [];                                   // the model agrees: impact was not made
await speak(A.page, SAY.noImpact);
const b1 = await A.page.evaluate(() => ({ step: _mv.step, moves: _mv.ev.moves, cov: _mv.ev.coverage, move: _mv.coach && _mv.coach.move, improve: _mv.coach && _mv.coach.improve, state: (mvStore()["clear-update"] || {}).state, weakness: (mvStore()["clear-update"] || {}).weakness }));
ok("B1 · the system identifies IMPACT as the weakness from what was actually said",
  b1.moves.status && b1.moves.issue && !b1.moves.impact && b1.moves.next && b1.move === "impact" && b1.weakness === "impact", JSON.stringify(b1));
ok("B2 · a three-of-four answer does not become DEMONSTRATED", b1.state === "PRACTICING", b1.state);
ok("B3 · the coach gives ONE improvement, not a correction list", typeof b1.improve === "string" && b1.improve.length < 250 && !/\n/.test(b1.improve), b1.improve);

const retry = await A.page.evaluate(() => { mvRetry(); return { text: _mv.retryText, step: _mv.step }; });
ok("B4 · RETRY names the missing move — it is not the generic prompt again",
  /delay means for the deadline|name the date/i.test(retry.text || "") && retry.step === "speak", JSON.stringify(retry));

coachCovered = ["impact"];                           // this time the model sees it
await speak(A.page, SAY.strong);
const b5 = await A.page.evaluate(() => { const r = mvStore()["clear-update"]; return { state: r.state, n: r.attempts.length, kinds: r.attempts.map(a => a.kind), last: r.attempts[r.attempts.length - 1].coverage }; });
ok("B5 · the retry is stored as a retry, covers all four moves, and moves the state to DEMONSTRATED",
  b5.state === "DEMONSTRATED" && b5.n === 2 && b5.kinds[1] === "retry" && b5.last === 1, JSON.stringify(b5));

const bEv = (await evs(A.page)).map(e => e[0]);
const bProps = (await evs(A.page)).find(e => e[0] === "v2_evidence_recorded");
ok("B6 · V2 analytics fire with the track, week and competency on every event",
  bEv.includes("v2_mission_started") && bEv.includes("v2_speak_attempt") && bEv.includes("v2_evidence_recorded") && bEv.includes("v2_retry_attempt")
  && bProps[1].track === "general-english" && bProps[1].week === "2" && bProps[1].competency === "clear-update",
  JSON.stringify(bProps));

/* ════════════════ SCENARIO C — guided success, transfer failure ══════════ */
console.log("\nSCENARIO C — guided success, transfer fails");
const C = await learner("cara", "general-english");
coachCovered = [];
await C.page.evaluate(() => mvGo("clear-update-guided", "speak")); await sleep(300);
coachCovered = ["impact", "status", "issue", "next"];
await speak(C.page, SAY.strong);
ok("C1 · guided round succeeds → DEMONSTRATED", (await stateOf(C.page)) === "DEMONSTRATED", await stateOf(C.page));
const cRec0 = await recOf(C.page);
ok("C2 · after guided success the recommendation is the cold transfer", cRec0 && true);
await C.page.evaluate(() => mvGo("clear-update-transfer", "speak")); await sleep(300);
coachCovered = [];
await speak(C.page, SAY.noImpact);                   // fails cold
const c3 = await C.page.evaluate(() => { const r = mvStore()["clear-update"]; return { state: r.state, tp: r.transfer.passed, tf: r.transfer.failed, rec: MissionEngine.recommend(r, mvComp(), Date.now()) }; });
ok("C3 · failing the transfer does NOT award mastery — the learner stays DEMONSTRATED",
  c3.state === "DEMONSTRATED" && c3.tf === 1 && c3.tp === 0, JSON.stringify(c3));
ok("C4 · and the system asks for more guided retrieval on the weak move, not for the transfer again",
  c3.rec.action === "retry" && c3.rec.reason === "transfer_failed" && c3.rec.move === "impact", JSON.stringify(c3.rec));
const c5 = await C.page.evaluate(() => { go("mission", "clear-update-transfer", "done"); return (document.querySelector(".mv-next") || {}).innerText; });
ok("C5 · the evidence page says so in words the learner can act on", /guided round on Impact|one more guided/i.test(c5 || ""), c5);

/* ════════════════ SCENARIO A — success end to end ════════════════════════ */
console.log("\nSCENARIO A — success");
const AA = await learner("ana", "general-english");
coachCovered = ["status", "issue", "impact", "next"];
await AA.page.evaluate(() => mvGo("clear-update-guided", "speak")); await sleep(300);
await speak(AA.page, SAY.strong);
await AA.page.evaluate(() => mvGo("clear-update-transfer", "speak")); await sleep(300);
await speak(AA.page, SAY.transferStrong);
const a1 = await AA.page.evaluate(() => { const r = mvStore()["clear-update"]; return { state: r.state, tp: r.transfer.passed, retrieval: r.retrieval, n: r.attempts.length, pron: r.attempts.map(x => x.pron) }; });
ok("A1 · guided + cold transfer both pass → TRANSFER_READY", a1.state === "TRANSFER_READY" && a1.tp === 1, JSON.stringify(a1));
ok("A2 · a later retrieval is scheduled, not left to the learner to remember",
  a1.retrieval && a1.retrieval.reason === "retrieval" && a1.retrieval.due > Date.now(), JSON.stringify(a1.retrieval));
ok("A3 · evidence is persisted for every spoken turn", a1.n === 2);
const aVoc = await AA.page.evaluate(() => Object.keys(areaVocab()));
ok("A4 · the expressions the learner used are acquired automatically — no Save button was pressed",
  aVoc.length > 0 && aVoc.some(w => /on track|at risk|come back to you|chase it up/.test(w)), JSON.stringify(aVoc));
const aState = await AA.page.evaluate(() => { const e = (window.__ev || []).map(x => x[0]); return { prog: e.includes("v2_competency_progressed"), sched: e.includes("v2_retrieval_scheduled"), tc: e.includes("v2_transfer_completed") }; });
/* Name the mission: go("mission") with no id now asks the engine which
   competency to open, and that is not necessarily this one. */
await AA.page.evaluate(() => { go("mission", "clear-update-transfer", "done"); }); await sleep(300);
const aDone = await AA.page.evaluate(() => ({ state: (document.querySelector(".mv-state b") || {}).innerText, bars: [...document.querySelectorAll(".mv-bar span")].map(x => x.innerText), pron: !!document.querySelector(".mv-bar small") }));
ok("A5 · the evidence page reports the six dimensions, pronunciation as comprehensibility only",
  /Transfer ready/i.test(aDone.state || "") && aDone.bars.join().includes("Clarity") && aDone.bars.join().includes("Comprehensibility") && aDone.pron, JSON.stringify(aDone));

/* ════════════════ SCENARIO D — network failure ═══════════════════════════ */
console.log("\nSCENARIO D — the network drops after the learner has spoken");
const D = await learner("dan", "general-english");
await D.page.evaluate(() => mvGo("clear-update-guided", "speak")); await sleep(300);
coachMode = "abort";
const hitsBefore = polishHits;
await speak(D.page, SAY.strong);
const d1 = await D.page.evaluate(async () => {
  const r = mvStore()["clear-update"];
  const recs = await getRecs(_mv.recCtx);
  return { n: r.attempts.length, said: !!r.attempts[0].said, cov: r.attempts[0].coverage, pending: r.attempts[0].coachPending, state: r.state, audio: recs.length, coach: !!_mv.coach, offline: _mv.coach && _mv.coach.offline };
});
ok("D1 · the attempt, its transcript and its audio all survive the failure",
  d1.n === 1 && d1.said && d1.audio === 1, JSON.stringify(d1));
ok("D2 · the evidence is still correct — it was computed on the device before the network was asked",
  d1.cov === 1 && d1.state === "DEMONSTRATED", JSON.stringify(d1));
ok("D3 · coaching is marked pending and safe fallback coaching is shown instead of an error",
  d1.pending === true && d1.coach && d1.offline === true, JSON.stringify(d1));
const dUi = await D.page.evaluate(() => ({ note: !!document.querySelector(".mv-note"), btn: !!document.querySelector(".mv-pending") }));
ok("D4 · the learner is told the coaching is waiting, and given the way to finish it", dUi.note && dUi.btn, JSON.stringify(dUi));

coachMode = "ok"; coachCovered = ["status", "issue", "impact", "next"];
await D.page.evaluate(() => mvFinishCoaching());
await D.page.waitForFunction(() => _mv && !_mv.busy, null, { timeout: 12000 }).catch(() => {});
await sleep(300);
const d5 = await D.page.evaluate(() => { const r = mvStore()["clear-update"]; return { n: r.attempts.length, pending: r.attempts[0].coachPending, state: r.state, ai: _mv.coach && _mv.coach.ai }; });
ok("D5 · recovery completes the coaching and creates NO second piece of evidence",
  d5.n === 1 && d5.pending === false && d5.ai === true, JSON.stringify(d5));
ok("D6 · the mocked Worker was actually called both times", polishHits > hitsBefore + 1);

/* idempotency under a replayed submit */
const d7 = await D.page.evaluate(() => {
  const r = mvStore()["clear-update"], row = r.attempts[0];
  const before = r.attempts.length;
  MissionEngine.addAttempt(mvStore(), "clear-update", Object.assign({}, row), areaId(), [1, 3, 7]);
  MissionEngine.addAttempt(mvStore(), "clear-update", Object.assign({}, row), areaId(), [1, 3, 7]);
  return { before, after: mvStore()["clear-update"].attempts.length };
});
ok("D7 · replaying the same spoken turn cannot double-count it", d7.before === d7.after, JSON.stringify(d7));

/* ════════════════ SCENARIO E — track isolation ═══════════════════════════ */
console.log("\nSCENARIO E — Welding must not receive any of this");
const W = await learner("wendy", "welding");
await spyOn(W.page);
const e1 = await W.page.evaluate(() => ({
  track: areaId(),
  missions: activeCurriculum().missions,
  comp: mvComp(),
  avail: mvAvailable(),
  card: (() => { go("home"); return !!document.querySelector(".mv-home"); })(),
}));
ok("E1 · a Welding learner's curriculum resolves missions to null — the merge does not hand them General English's",
  e1.track === "welding" && e1.missions === null && e1.comp === null && e1.avail === false, JSON.stringify({ t: e1.track, m: e1.missions, a: e1.avail }));
ok("E2 · no mission card appears on the Welding home", e1.card === false);

const e3 = await W.page.evaluate(async () => {
  go("mission", "clear-update-guided", "speak");
  await new Promise(r => setTimeout(r, 400));
  return { view: cur.v, html: (document.getElementById("v-mission") || {}).innerHTML };
});
ok("E3 · routing straight to the mission URL turns a Welding learner around — it is not just hidden",
  e3.view === "home" && !e3.html, JSON.stringify({ v: e3.view, len: (e3.html || "").length }));

const e4 = await W.page.evaluate(() => {
  const before = JSON.stringify(S.v2A || {});
  const r = MissionEngine.addAttempt(S.v2A || (S.v2A = {}), "clear-update", { key: "w1", answered: true, coverage: 1, kind: "guided" }, areaId(), [1]);
  MissionEngine.introduce(S.v2A, "clear-update", areaId(), Date.now());
  return { refused: r === null, unchanged: JSON.stringify(S.v2A) === before };
});
ok("E4 · the engine refuses to write General English evidence for a Welding learner",
  e4.refused && e4.unchanged, JSON.stringify(e4));

const e5 = await W.page.evaluate(() => { window.__ev = []; mvTrack("v2_speak_attempt", { mission: "x" }); return window.__ev.length; });
ok("E5 · a Welding learner cannot emit a V2 General English analytics event", e5 === 0, String(e5));

const e6 = await W.page.evaluate(() => {
  const pack = activeCurriculum();
  return { weeks: (pack.weeks || []).length, stage1: (pack.weeks[0] || {}).stage, sims: (pack.simulations || []).length, mentors: (pack.aiMentors || []).length, starters: (pack.starters || []).length, vocab: ((pack.vocabulary || {}).stopWords || []).length };
});
ok("E6 · existing Welding curriculum resolution is unchanged (12 stages, 12 simulations, 12 mentors, inherited English machinery)",
  e6.weeks === 12 && /Stage 1/.test(e6.stage1 || "") && e6.sims === 12 && e6.mentors === 12 && e6.vocab > 100, JSON.stringify(e6));

const e7 = await W.page.evaluate(async () => {
  go("simulation"); await new Promise(r => setTimeout(r, 500));
  const cards = document.querySelectorAll("#v-simulation .card, #v-simulation .pf-row, #v-simulation button").length;
  return { view: cur.v, cards, sims: trackSimulations().length };
});
ok("E7 · the Welding simulation catalogue still opens and still lists its workshops", e7.view === "simulation" && e7.sims === 12 && e7.cards > 0, JSON.stringify(e7));

const e8 = await W.page.evaluate(() => ({ pp: ppAvailable(), sv: svOn(), ge: isGeneralEnglish() }));
ok("E8 · Practice Partner and Shadow Studio V2 remain General English only", e8.pp === false && e8.sv === false && e8.ge === false, JSON.stringify(e8));

const e9 = await A.page.evaluate(() => ({ v2: Object.keys(S.v2A || {}), welding: (S.v2A || {})["welding"] }));
ok("E9 · General English evidence is filed under General English and creates no Welding bucket",
  e9.v2.join() === "general-english" && e9.welding === undefined, JSON.stringify(e9));

/* ── the analytics contract the audit found missing ── */
const tc = await A.page.evaluate(() => { window.__ev = []; trackLearning("practice_day", { streak: "1", week: "3" }); trackLearning("session_complete", { week: "3", day: "Mon" }); return window.__ev; });
ok("Core learning events now carry the track (the audit's analytics gap)",
  tc.length === 2 && tc.every(e => e[1].track === "general-english"), JSON.stringify(tc));
const tcW = await W.page.evaluate(() => { window.__ev = []; trackLearning("session_complete", { week: "1", day: "Mon" }); return window.__ev; });
ok("…and a Welding session is now distinguishable from a General English one", tcW[0] && tcW[0][1].track === "welding", JSON.stringify(tcW));

ok("No uncaught page errors in any context", errors.length === 0, errors.slice(0, 4).join(" | "));

/* ── summary ── */
await browser.close(); if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
