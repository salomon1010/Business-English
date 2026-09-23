/* BE Mastery V2 — the SPEAKING REPORT and the SPEAKING HISTORY.

   Run:  cd tests && node mission-speaking-report.mjs
         SHOTS=/some/dir node mission-speaking-report.mjs

   What this suite exists to prove, in one sentence: the AI writes prose and
   language, the deterministic evidence writes the record, and neither can
   impersonate the other.

   1. ENGINE, in Node, against the real pack: the report prompt is grounded
      in the scorer's verdict; shapeReport drops every AI claim whose anchor
      disagrees with the evidence; attachReport is idempotent on the attempt
      key; history() is a flat, bounded, report-carrying list.
   2. WORKER, in Node: shapeMvReport is a transport shape check, nothing more.
   3. BROWSER, real Chromium: the Week 3 "Raise a problem" walk the brief
      names — speak, read the report, hear the better version, retry, find
      both attempts in the history, reload, recover a failed AI pass onto the
      SAME row — plus the Welding boundary and both required viewports. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { shapeMvReport } from "../backend/polish-worker.js";

const require = createRequire(import.meta.url);
const ME = require("../mission-engine.js");
const PACK = JSON.parse(readFileSync(new URL("../tracks/general/missions.json", import.meta.url), "utf8"));

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const SHOTS = process.env.SHOTS || "";

const comp = ME.competencyOf(PACK, "raise-problem");
const G = ME.missionOf(comp, "raise-problem-guided");
const SAY = {
  noAsk: "We have got a problem with the delivery. It started when the supplier changed the order number. This means we would finish three days late. I have already spoken to their office.",
  strong: G.hear.model,
};

/* ══════════════════════ 1 · ENGINE (no browser) ══════════════════════════ */
console.log("\n1 · ENGINE — the report is anchored to the evidence");
const ev = ME.grade(comp, G, SAY.noAsk, { seconds: 22 });
const made = ME.moveIds(comp).filter(id => ev.moves[id]);
const missed = ME.moveIds(comp).filter(id => !ev.moves[id]);
ok("the fixture behaves: four moves credited, the ask missed", made.join() === "issue,cause,impact,mitigate" && missed.join() === "ask", made.join() + "|" + missed.join());

const ctx = ME.aiContext(ME.blank("raise-problem"), comp, G, { weakness: "ask" });
const prompt = ME.reportPrompt(ctx, ev, comp);
ok("the prompt carries the scorer's verdict: every credited move, every missed move, the weakness",
  made.every(id => prompt.includes(id)) && prompt.includes("Not heard: ask") && prompt.includes("Recurring weak move: ask"));
ok("the prompt forbids inventing performance: verdict final, no scores, no accent, additions only",
  /verdict is final/i.test(prompt) && /Never praise a move from/i.test(prompt) && /No scores/i.test(prompt) && /accent/i.test(prompt) && /Only additions/i.test(prompt));
ok("the prompt pins the better version to the learner's meaning and level",
  /Keep their meaning/.test(prompt) && /at most 70 words/.test(prompt) && /Never add facts/.test(prompt));

/* the AI tries every forbidden thing at once; shapeReport keeps only the true */
const raw = {
  well: [
    { move: "issue", note: "You opened with the problem itself, no throat-clearing." },
    { move: "ask", note: "INVENTED — the scorer says the ask never happened." },
    { move: "cause", note: "The order-number detail makes the cause concrete." },
    { move: "impact", note: "Three days late is a real consequence." },
    { move: "mitigate", note: "Already speaking to their office shows ownership." },
  ],
  improve: [
    { move: "issue", note: "FORBIDDEN — issue was credited and cannot be marked absent." },
    { move: "ask", note: "You never asked for anything — close with the decision you need." },
  ],
  better: "We have a problem with the delivery. It started when the supplier changed the order number, so we would finish three days late. I have already spoken to their office. Could you approve a two-day extension so we protect the hand-over?",
  expressions: [{ e: "the main issue is", why: "opens a problem cleanly" }, { e: "this means", why: "ties cause to impact" }, { e: "could you approve", why: "turns a report into an ask" }, { e: "a fourth", why: "over the cap" }],
  one: "Finish with a clear ask before you stop speaking.",
};
const rep = ME.shapeReport(raw, comp, ev);
ok("praise for the uncredited move is dropped; the rest is capped at three",
  rep.well.length === 3 && !rep.well.some(x => x.move === "ask") && rep.well[0].move === "issue");
ok("a 'to improve' for a CREDITED move is dropped; the missed move stays, with the AI's sentence",
  rep.improve.length === 1 && rep.improve[0].move === "ask" && /close with the decision/i.test(rep.improve[0].note));
ok("the better version and the one-thing survive, capped; expressions cap at three",
  /two-day extension/.test(rep.better) && rep.expr.length === 3 && /clear ask/i.test(rep.one) && rep.ai === true);

const covered = ME.applyCoachMoves(ME.grade(comp, G, SAY.noAsk, { seconds: 22 }), comp, ["ask"]);
const rep2 = ME.shapeReport({ well: [{ move: "ask", note: "You asked in your own words." }] }, comp, covered);
ok("a move the model covered AND praised is kept — shapeReport judges against the post-coach evidence",
  rep2.well.length === 1 && rep2.well[0].move === "ask");

const off = ME.shapeReport(null, comp, ev);
ok("offline the report is the honest floor: no better version, missed move named from the rubric, expressions from the bank, ai=false",
  off.better === null && off.ai === false && off.improve[0].move === "ask" && off.expr.length > 0 && off.one.length > 0);

/* attach + history */
const store = {};
const A1 = ME.addAttempt(store, "raise-problem", Object.assign({}, ev, { key: "k1", missionId: G.id, kind: "guided", at: 1000, said: SAY.noAsk }), "general-english", [1, 3, 7, 21, 60], { week: 3, moveIds: ME.moveIds(comp) });
ok("attachReport writes onto the row its key names, and nowhere else",
  ME.attachReport(store, "raise-problem", "k1", rep, "general-english") && store["raise-problem"].attempts[0].report.better === rep.better
  && ME.attachReport(store, "raise-problem", "zz", rep, "general-english") === null);
ok("attachReport refuses Welding and a second attach UPDATES rather than duplicates",
  ME.attachReport(store, "raise-problem", "k1", rep, "welding") === null
  && (ME.attachReport(store, "raise-problem", "k1", off, "general-english"), store["raise-problem"].attempts[0].report.better === null && store["raise-problem"].attempts.length === 1));
ok("the stored report is compact: anchors and short strings, never the transcript",
  (() => { const r = store["raise-problem"].attempts[0].report; return !("said" in r) && r.well.every(x => x.m && x.n.length <= 160) && JSON.stringify(r).length < 2200; })());

ME.addAttempt(store, "raise-problem", { key: "k2", missionId: "raise-problem-transfer", kind: "transfer", at: 2000, said: "x", answered: true, coverage: 1, moves: Object.fromEntries(ME.moveIds(comp).map(i => [i, true])), covered: ME.moveIds(comp), missed: [], verdict: "strong" }, "general-english", [1], { week: 3, moveIds: ME.moveIds(comp) });
const hist = ME.history(id => store[id], PACK.competencies);
ok("history() lists both attempts, newest first inside the week, reports riding along",
  hist.length === 2 && hist[0].key === "k2" && hist[1].key === "k1" && hist[1].report && hist[1].report.improve === undefined && hist[1].report.fix.length === 1);
ok("history() only ever reports spoken answers, and an empty store is an empty list",
  ME.history(() => null, PACK.competencies).length === 0);
const fi = ME.competencyOf(PACK, "final-integration");
const s12 = {};
ME.addAttempt(s12, "final-integration", { key: "w12", missionId: "final-integration-guided", kind: "guided", at: 1, answered: true, coverage: 1, moves: Object.fromEntries(ME.moveIds(fi).map(i => [i, true])), covered: ME.moveIds(fi), missed: [], verdict: "strong" }, "general-english", [1], { week: 12, moveIds: ME.moveIds(fi) });
ME.attachReport(s12, "final-integration", "w12", ME.shapeReport(null, fi, { moves: Object.fromEntries(ME.moveIds(fi).map(i => [i, true])), vocabUsed: [] }), "general-english");
ok("Week 12 compatibility: a report attaches to the integration record and touches no other competency",
  s12["final-integration"].attempts[0].report && Object.keys(s12).join() === "final-integration");
ok("Shadow compatibility: attaching a report leaves support rows and their summary untouched",
  (() => { ME.addSupport(store, "raise-problem", { key: "sh:1", at: 5, linked: true, rung: "sync", passed: true }, "general-english");
    const before = JSON.stringify(ME.supportSummary(store["raise-problem"]));
    ME.attachReport(store, "raise-problem", "k1", rep, "general-english");
    return JSON.stringify(ME.supportSummary(store["raise-problem"])) === before; })());

/* ══════════════════════ 2 · WORKER SHAPE (no network) ════════════════════ */
console.log("\n2 · WORKER — shapeMvReport is a transport check, not a truth check");
const w1 = shapeMvReport(JSON.stringify(raw));
ok("a full report passes through with its caps applied", w1.well.length === 3 && w1.improve.length === 2 && w1.expressions.length === 3 && /two-day/.test(w1.better) && w1.one.length > 0);
ok("garbage in, empty shape out — never a throw", (() => { const g = shapeMvReport("not json at all"); return g.well.length === 0 && g.better === "" && g.covered.length === 0; })());
ok("entries without an anchor or a note are dropped; covered is strings only",
  (() => { const g = shapeMvReport(JSON.stringify({ well: [{ note: "no move" }, { move: "x" }], covered: ["ok", 7, ""] })); return g.well.length === 0 && g.covered.join() === "ok"; })());

/* ══════════════════════ 3 · BROWSER ══════════════════════════════════════ */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const root = new URL("..", import.meta.url).pathname;
  const mine = readFileSync(root + "index.html", "utf8");
  for (const port of [8031, 8032, 8033, 8034, 8035]) {
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
let repMode = "ok";                 // ok | abort
let lastReportBody = null;

async function learner(id, track, viewport) {
  const ctx2 = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] }, viewport || {}));
  await ctx2.addInitScript(({ track }) => {
    class F {
      constructor() { this._t = null; }
      _fire() { const txt = window.__say || ""; if (txt && this.onresult) { const r = [{ 0: { transcript: txt, confidence: 0.9 }, isFinal: true, length: 1 }]; r.length = 1; try { this.onresult({ results: r, resultIndex: 0 }); } catch (e) {} } }
      _end() { this._on = false; if (this._t) { clearTimeout(this._t); this._t = null; } if (this.onend) setTimeout(() => { try { this.onend(); } catch (e) {} }, 0); }
      start() { this._on = true; this._t = setTimeout(() => { if (!this._on) return; this._fire(); this._end(); }, 120); }
      stop() { if (this._on) this._fire(); this._end(); }
      abort() { this._on = false; this._end(); }
    }
    window.SpeechRecognition = F; window.webkitSpeechRecognition = F;
    if (!localStorage.getItem("be12_v1")) {
      const st = { profile: { name: "Test", role: "", goal: "Speak with confidence in meetings", slot: "", lang: "en", ts: Date.now() },
        professionalTracks: { activeId: track },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() },
               "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
        days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() };
      localStorage.setItem("be12_v1", JSON.stringify(st));
    }
  }, { track });
  await ctx2.route(u => u.href.startsWith(POLISH), async route => {
    if (repMode === "abort") return route.abort("failed");
    let b = {};
    try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (b.assess) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ overall: 86, mode: "ai", words: [{ word: "a", score: 86 }] }) });
    if (b.mvreport) {
      lastReportBody = b.mvreport;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        covered: [],
        well: [{ move: "issue", note: "You opened with the problem itself." }, { move: "ask", note: "INVENTED PRAISE — must be dropped." }, { move: "impact", note: "Three days late is a real consequence." }],
        improve: [{ move: "ask", note: "Close with the decision you need from them." }],
        better: "We have a problem with the delivery. The supplier changed the order number, so we would finish three days late. I have already spoken to their office. Could you approve a two-day extension so we protect the hand-over?",
        expressions: [{ e: "this means", why: "ties the cause to its impact" }, { e: "could you approve", why: "turns a report into an ask" }],
        one: "Finish with a clear ask before you stop speaking.",
      }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  const page = await ctx2.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?rep=" + Date.now(), { waitUntil: "load" });
  await sleep(1000);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx: ctx2, page, id };
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
const shot = async (page, name) => { if (SHOTS) { try { await page.screenshot({ path: SHOTS + "/rep-" + name + ".png", fullPage: true }); } catch (e) {} } };
const spyOn = page => page.evaluate(() => { window.__ev = []; const t0 = window.track; window.track = (n, p) => { window.__ev.push([n, p || {}]); return t0 && t0(n, p); }; });

console.log("\n3 · BROWSER — Week 3 'Raise a problem', the walk the brief names");
const L = await learner("ge", "general-english");
await spyOn(L.page);
await L.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
await speak(L.page, SAY.noAsk);
const coach = await L.page.evaluate(() => ({
  step: _mv.step,
  well: [...document.querySelectorAll(".mv-rep-list.ok li")].map(x => x.innerText),
  fix: [...document.querySelectorAll(".mv-rep-list.fix li")].map(x => x.innerText),
  better: (document.querySelector(".mv-better-t") || {}).innerText || "",
  hearBtn: !!document.querySelector(".mv-better button"),
  expr: [...document.querySelectorAll(".mv-rep-list.expr li")].map(x => x.innerText),
  one: (document.querySelector(".mv-one .mv-improve") || {}).innerText || "",
  reportOnRow: (() => { const r = mvStore()["raise-problem"]; const a = r.attempts[r.attempts.length - 1]; return { has: !!a.report, better: !!(a.report && a.report.better), well: a.report ? a.report.well.map(x => x.m) : [] }; })(),
}));
ok("the report renders: did-well, to-improve, better version with a Hear button, expressions, one thing",
  coach.step === "coach" && coach.well.length >= 1 && coach.fix.length === 1 && /two-day extension/.test(coach.better) && coach.hearBtn && coach.expr.length === 2 && /clear ask/i.test(coach.one), JSON.stringify(coach).slice(0, 400));
ok("the invented praise for the missed ask was dropped; the real credits stayed",
  !coach.well.some(x => /INVENTED/.test(x)) && coach.well.some(x => /problem itself/.test(x)) && /decision you need/.test(coach.fix[0]));
ok("the report was persisted on the attempt row, anchored to move ids",
  coach.reportOnRow.has && coach.reportOnRow.better && coach.reportOnRow.well.every(m => ["issue", "cause", "impact", "mitigate"].includes(m)));
ok("the AI saw compact context only: mission prompt and transcript, no history, no profile name",
  lastReportBody && /raise/i.test(lastReportBody.system) && !/Test/.test(lastReportBody.system) && !lastReportBody.history, JSON.stringify(Object.keys(lastReportBody || {})));
await shot(L.page, "390-report");

const hear = await L.page.evaluate(() => { let n = 0; const f = window.fbSay; window.fbSay = () => { n++; }; mvHearBetter(); window.fbSay = f; return { n, ev: window.__ev.filter(e => e[0] === "v2_better_version_played").length }; });
ok("Hear-the-better-version speaks through the existing TTS door and logs its one event", hear.n === 1 && hear.ev === 1, JSON.stringify(hear));

/* privacy: what would sync */
const sync = await L.page.evaluate(() => { const p = fbSyncPayload(S); const r = p.v2A["general-english"]["raise-problem"].attempts.slice(-1)[0]; const l = S.v2A["general-english"]["raise-problem"].attempts.slice(-1)[0]; return { saidGone: !("said" in r) || r.said === undefined, betterGone: !r.report || r.report.better === null, localSaid: typeof l.said === "string" && l.said.length > 0, localBetter: !!(l.report && l.report.better) }; });
ok("the cloud payload strips the transcript AND the better version; both stay on the device",
  sync.saidGone && sync.betterGone && sync.localSaid && sync.localBetter, JSON.stringify(sync));

/* retry = a distinct attempt under the same rules */
await L.page.evaluate(() => mvRetry()); await sleep(250);
await speak(L.page, SAY.strong);
const after = await L.page.evaluate(() => { const r = mvStore()["raise-problem"]; return { n: r.attempts.length, keys: new Set(r.attempts.map(a => a.key)).size, kinds: r.attempts.map(a => a.kind).join(), reports: r.attempts.filter(a => a.report).length, state: r.state }; });
ok("the retry is attempt 2 — its own key, its own report, kind 'retry', nothing overwritten",
  after.n === 2 && after.keys === 2 && after.kinds === "guided,retry" && after.reports === 2, JSON.stringify(after));

/* ── history ── */
await L.page.evaluate(() => go("mvhist")); await sleep(350);
const h1 = await L.page.evaluate(() => ({
  rows: document.querySelectorAll(".mv-hist-row").length,
  week: (document.querySelector(".mv-hist-week") || {}).innerText || "",
  opened: window.__ev.filter(e => e[0] === "v2_speaking_history_opened").length,
  results: [...document.querySelectorAll(".mv-hist-res")].map(x => x.innerText),
  overflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
}));
ok("the history lists both attempts under their week, result labels honest, one opened-event",
  h1.rows === 2 && /Week 3/.test(h1.week) && h1.opened === 1 && h1.results.length === 2 && h1.overflow, JSON.stringify(h1));
const h2 = await L.page.evaluate(() => { const d = document.querySelectorAll(".mv-hist-row")[1]; d.setAttribute("open", ""); return { better: (d.querySelector(".mv-better-t") || {}).innerText || "", well: d.querySelectorAll(".mv-rep-list.ok li").length, practice: !!d.querySelector(".btn-primary"), mytake: [...d.querySelectorAll("button")].some(b => /My take/i.test(b.innerText)) }; });
ok("an old report opens in place — better version, did-well list, My take, Practise again — with nothing re-done",
  /two-day extension/.test(h2.better) && h2.well >= 1 && h2.practice && h2.mytake, JSON.stringify(h2));
const heard2 = await L.page.evaluate(() => { let n = 0; const f = window.fbSay; window.fbSay = () => { n++; }; mvHistHear(1); window.fbSay = f; return { n, ev: window.__ev.filter(e => e[0] === "v2_speaking_history_replayed").length }; });
ok("hearing an old better version works from the history and logs its event", heard2.n === 1 && heard2.ev === 1, JSON.stringify(heard2));
await shot(L.page, "390-history");

/* reload: the history is durable state, not view state */
await L.page.reload({ waitUntil: "load" }); await sleep(1200);
await L.page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
await spyOn(L.page);                       /* the reload wiped the event spy */
const h3 = await L.page.evaluate(() => { go("mvhist"); return new Promise(r => setTimeout(() => { const d = document.querySelectorAll(".mv-hist-row")[1]; if (d) d.setAttribute("open", ""); r({ rows: document.querySelectorAll(".mv-hist-row").length, better: (d && d.querySelector(".mv-better-t") || {}).innerText || "" }); }, 300)); });
ok("after a reload both attempts and the stored report are still there", h3.rows === 2 && /two-day extension/.test(h3.better), JSON.stringify(h3));

/* history → practice again lands in the same mission loop */
const nav = await L.page.evaluate(() => new Promise(r => { document.querySelector(".mv-hist-row .btn-primary").click(); setTimeout(() => r({ v: cur.v, step: _mv && _mv.step }), 400); }));
ok("Practise again returns to the speaking step of that mission", nav.v === "mission" && nav.step === "speak", JSON.stringify(nav));

/* ── AI failure, then recovery onto the SAME row ── */
repMode = "abort";
await speak(L.page, SAY.noAsk);
const failed = await L.page.evaluate(() => { const r = mvStore()["raise-problem"]; const a = r.attempts[r.attempts.length - 1]; return { n: r.attempts.length, pending: !!a.coachPending, better: !!(a.report && a.report.better), offNote: !!document.querySelector(".mv-coach .mv-note"), fix: document.querySelectorAll(".mv-rep-list.fix li").length, saved: !!a.passed || a.coverage != null }; });
ok("with the AI unreachable the attempt is still saved and scored; the report is the honest floor (no better version) and says so",
  failed.n === 3 && failed.pending && !failed.better && failed.offNote && failed.fix >= 1 && failed.saved, JSON.stringify(failed));
repMode = "ok";
await L.page.evaluate(() => mvFinishCoaching());
await L.page.waitForFunction(() => _mv && !_mv.busy, null, { timeout: 10000 });
const recovered = await L.page.evaluate(() => { const r = mvStore()["raise-problem"]; const a = r.attempts[r.attempts.length - 1]; return { n: r.attempts.length, pending: !!a.coachPending, better: !!(a.report && a.report.better), ai: !!(a.report && a.report.ai) }; });
ok("recovering the coaching UPDATES the same row — no new attempt, pending cleared, better version now present",
  recovered.n === 3 && !recovered.pending && recovered.better && recovered.ai, JSON.stringify(recovered));

/* analytics: only allow-listed v2 names, enum-sized props, no text */
const evCheck = await L.page.evaluate(() => {
  const NAMES = ["v2_mission_started", "v2_mission_heard", "v2_speak_attempt", "v2_coach_generated", "v2_retry_attempt", "v2_transfer_started", "v2_transfer_completed", "v2_evidence_recorded", "v2_competency_progressed", "v2_retrieval_scheduled", "v2_recommendation_generated", "v2_better_version_played", "v2_speaking_history_opened", "v2_speaking_history_replayed"];
  const v2 = window.__ev.filter(e => e[0].startsWith("v2_"));
  return { all: v2.every(e => NAMES.includes(e[0])), tracked: v2.every(e => e[1].track === "general-english" && e[1].week && e[1].competency), clean: v2.every(e => Object.values(e[1]).every(v => String(v).length <= 64 && !/ .* .* /.test(String(v)))), n: v2.length };
});
ok("every event this session fired is allow-listed, stamped track+week+competency, and enum-sized",
  evCheck.all && evCheck.tracked && evCheck.clean && evCheck.n > 5, JSON.stringify(evCheck));

/* ── 1280 × 800 ── */
const W = await learner("wide", "general-english", { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
await W.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
await speak(W.page, SAY.noAsk);
const wide = await W.page.evaluate(() => ({ better: !!document.querySelector(".mv-better"), overflow: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
await W.page.evaluate(() => go("mvhist")); await sleep(300);
const wideH = await W.page.evaluate(() => ({ rows: document.querySelectorAll(".mv-hist-row").length, overflow: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
ok("at 1280×800 the report and the history render without horizontal overflow", wide.better && wide.overflow && wideH.rows === 1 && wideH.overflow, JSON.stringify({ wide, wideH }));
await shot(W.page, "1280-history");
await W.ctx.close();

/* ── Welding boundary ── */
console.log("\n4 · WELDING — the boundary");
const B = await learner("welder", "welding");
await spyOn(B.page);
const weld = await B.page.evaluate(() => new Promise(r => { go("mvhist"); setTimeout(() => r({
  v: cur.v,
  geBucket: !!(S.v2A && S.v2A["general-english"] && Object.keys(S.v2A["general-english"]).length),
  weldBucket: !!(S.v2A && S.v2A["welding"] && Object.keys(S.v2A["welding"]).length),
  histBtn: (() => { go("review"); return null; })(),
}), 500); }));
await sleep(400);
const weld2 = await B.page.evaluate(() => ({ v: cur.v, histBtn: !!document.querySelector(".pg-hist"), ev: (window.__ev || []).filter(e => e[0].startsWith("v2_")).length }));
ok("a Welding learner is turned away from the history, writes nothing, sees no history button, emits no V2 event",
  weld.v === "home" && !weld.geBucket && !weld.weldBucket && !weld2.histBtn && weld2.ev === 0, JSON.stringify({ weld, weld2 }));
await B.ctx.close();
await L.ctx.close();

ok("No uncaught page errors", errors.length === 0, errors.join(" | "));

await browser.close();
if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
