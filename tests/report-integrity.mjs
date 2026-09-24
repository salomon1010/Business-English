/* BE Mastery — SPEAKING REPORT DATA INTEGRITY.

   Run:  cd tests && node report-integrity.mjs
         BASE=http://127.0.0.1:PORT node report-integrity.mjs   (a server of THIS tree)

   Two contracts, each proved in Node against the engine and in real Chromium
   against the app:

   G · BETTER VERSION FACTUAL GROUNDING. The better version (and language
       polish) may reword the learner; it may not add a number, a date, a
       name, a request or a clause they never said. The unsafe strings below
       are VERBATIM outputs of the production model (be-polish mvreport,
       23 Sep 2026) for Week 3 "Raise a problem" with the pre-fix prompt —
       9 of 9 samples invented an ask. A rejected version is omitted, never
       replaced.

   M · SPEAKING REPORT MERGE PRESERVES RICHER DATA. The sync payload strips
       the learner's words (said / better / pol, conversation line text) by
       design; the cloud copy of an attempt is therefore always the poorer
       copy. Merging must keep the device's richer copy, on the pull that
       runs every time the app comes back to the foreground AND on sign-in.
       Test matrix A–E from the brief, plus the Welding boundary. */
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

const comp = ME.competencyOf(PACK, "raise-problem");
const G = ME.missionOf(comp, "raise-problem-guided");
const SAID = {
  delay: "there is a delay with the new order because the supplier is late we are waiting for the parts and the production is stopped",
  noAsk: "We have got a problem with the delivery. It started when the supplier changed the order number. This means we would finish three days late. I have already spoken to their office.",
  machine: "the machine in line two is broken since yesterday so we cannot finish the order for the client we called the technician",
};
/* verbatim production outputs, pre-fix prompt */
const LIVE_UNSAFE = [
  [SAID.delay, "There's a delay with the new order because the supplier is late. This has stopped production, and we're waiting for the parts. I've contacted the supplier for updates, but I need your help to expedite the process."],
  [SAID.delay, "There's a delay with the new order because the supplier is late. This has stopped production, and we need the parts urgently to avoid missing our deadlines. I've contacted the supplier to expedite the shipment. Could you please help me by following up with them?"],
  [SAID.noAsk, "We have a problem with the delivery; it started when the supplier changed the order number. This means we will finish three days late. I've already spoken to their office, but I need your help to resolve this issue quickly."],
  [SAID.noAsk, "We have a problem with the delivery; it started when the supplier changed the order number. This means we will finish three days late. I have already spoken to their office, but I need their confirmation to proceed. Can you help me follow up?"],
  [SAID.machine, "The machine in line two has been broken since yesterday, which means we can't finish the order for the client. This delay could impact our delivery schedule. I've already called the technician for repairs. Could you please approve overtime for the team to catch up once it's fixed?"],
  [SAID.machine, "The machine in line two is broken since yesterday, which means we can't finish the order for the client. This will delay our delivery. I've called the technician for repairs. Could you please help expedite their visit?"],
];
/* verbatim production outputs WITH the tightened prompt — rarer, but they
   still occur; the first one passed a per-sentence check and is why the
   clause rule scores each clause */
const LIVE_UNSAFE_NEW_PROMPT = [
  [SAID.noAsk.toLowerCase().replace(/\./g, ""), "We have a problem with the delivery. It started when the supplier changed the order number, which means we will finish three days late. I've already spoken to their office, but I need their confirmation on the new order number to proceed."],
  [SAID.delay, "There's a delay with the new order because the supplier is late. We're waiting for the parts, which has stopped production. I've contacted the supplier to expedite the delivery, but I need your support to find a workaround in the meantime."],
  ["we have a problem with the delivery the supplier changed the order number so we will finish three days late can you approve two more days for the project", "We have a problem with the delivery. The supplier changed the order number, which caused a three-day delay. I've contacted them to resolve this issue. Can you approve two more days for the project?"],
];
const SAFE = [
  [SAID.noAsk, "We have a problem with the delivery. It started when the supplier changed the order number, which means we would finish three days late. I've already spoken to their office."],
  [SAID.delay, "There's a delay with the new order because the supplier is late. We're still waiting for the parts, so production has stopped."],
  [SAID.machine, "The machine on line two has been broken since yesterday, so we can't finish the client's order. We've called the technician."],
  ["we finish three days late because supplier change the order number", "We will finish three days late because the supplier changed the order number."],
  ["i already spoke to maria in their office about the delivery", "I've already spoken to Maria at their office about the delivery."],
];

/* ══════════════════════ G · GROUNDING — ENGINE ═══════════════════════════ */
console.log("\nG · BETTER VERSION FACTUAL GROUNDING — engine");
const bank = (comp.expressions || []).map(e => e.w);
ok(`G1 every verbatim unsafe production output is rejected (${LIVE_UNSAFE.length})`,
  LIVE_UNSAFE.every(([s, b]) => ME.groundCheck(b, s, { bank }).length > 0),
  JSON.stringify(LIVE_UNSAFE.map(([s, b]) => ME.groundCheck(b, s, { bank }))));
ok("G1b each is rejected as a REQUEST the learner never made",
  LIVE_UNSAFE.every(([s, b]) => ME.groundCheck(b, s, { bank }).includes("request")));
ok(`G1c the inventions that survived the tightened prompt are rejected too (${LIVE_UNSAFE_NEW_PROMPT.length})`,
  LIVE_UNSAFE_NEW_PROMPT.every(([s, b]) => ME.groundCheck(b, s, { bank }).length > 0),
  JSON.stringify(LIVE_UNSAFE_NEW_PROMPT.map(([s, b]) => ME.groundCheck(b, s, { bank }))));
ok("G1d a learner's OWN ask survives into a grounded better version", ME.groundCheck("We have a problem with the delivery. The supplier changed the order number, so we'll finish three days late. Could you approve two more days for the project?",
  "we have a problem with the delivery the supplier changed the order number so we will finish three days late can you approve two more days for the project", { bank }).length === 0);
ok(`G2 grounded rewrites pass — grammar, tense, structure, register, an ASR-lowercase name (${SAFE.length})`,
  SAFE.every(([s, b]) => ME.groundCheck(b, s, { bank }).length === 0),
  JSON.stringify(SAFE.map(([s, b]) => ME.groundCheck(b, s, { bank }))));
const g = (b, s = SAID.noAsk) => ME.groundCheck(b, s, { bank });
ok("G3 a new number is rejected (digits and words)", g("We would finish five days late because the supplier changed the order number.").some(r => r.startsWith("number")) && g("We would finish 5 days late.").some(r => r.startsWith("number")));
ok("G4 a new date or deadline is rejected", g("The supplier changed the order number, so we would finish on Friday.").some(r => r.startsWith("time")) && g("We need to fix the delivery before the deadline.").some(r => r.startsWith("time")));
ok("G5 a new person, organisation or acronym is rejected", g("I have already spoken to Maria at their office.").some(r => r.startsWith("name")) && g("I have already spoken to the PMO about the delivery.").some(r => r.startsWith("name")));
ok("G6 a materially new clause is rejected even without a request marker", g("We have a problem with the delivery. Our warehouse team is rebuilding the entire stock system this quarter.").some(r => r.startsWith("clause")));
ok("G7 no transcript = no pass (nothing to check against)", ME.groundCheck("A perfectly fine sentence here.", "").length > 0);

/* shapeReport — the unsafe version is OMITTED, never replaced */
const ev = Object.assign(ME.grade(comp, G, SAID.delay, { seconds: 25 }), { said: SAID.delay });
const raw = {
  well: [], improve: [{ move: "ask", note: "Close with the decision you need." }],
  better: LIVE_UNSAFE[1][1],
  expressions: [{ e: "this means", why: "ties cause to impact" }], one: "End with a clear ask.",
  polish: [
    { said: "we are waiting for the parts", better: "we're still waiting for the parts", why: "More natural." },
    { said: "the supplier is late", better: "the supplier is late and will deliver on Monday", why: "INVENTED date" },
  ],
};
const rep = ME.shapeReport(raw, comp, ev);
ok("G8 shapeReport omits the unsafe better version (null), no fabricated fallback, says why", rep.better === null && Array.isArray(rep.betterBlocked) && rep.betterBlocked.includes("request"), JSON.stringify({ b: rep.better, why: rep.betterBlocked }));
ok("G9 the rest of the report is untouched: improve, expressions, one-thing, ai", rep.improve.length === 1 && rep.expr.length === 1 && /clear ask/.test(rep.one) && rep.ai === true);
ok("G10 polish: the grounded rewrite stays, the one with an invented date is dropped", rep.polish.length === 1 && /still waiting/.test(rep.polish[0].better), JSON.stringify(rep.polish));
const safeRep = ME.shapeReport(Object.assign({}, raw, { better: SAFE[1][1] }), comp, ev);
ok("G11 a grounded better version is shown unchanged", safeRep.better === SAFE[1][1] && !safeRep.betterBlocked);
const store = {}; ME.addAttempt(store, "raise-problem", Object.assign({}, ev, { key: "k1", missionId: G.id, kind: "guided", answered: true, at: 1 }), "general-english");
ME.attachReport(store, "raise-problem", "k1", rep, "general-english");
ok("G12 attachReport never stores the rejection reasons", store["raise-problem"] && !JSON.stringify(store).includes("betterBlocked"), JSON.stringify(store).slice(0, 200));
const prompt = ME.reportPrompt(ME.aiContext(ME.blank("raise-problem"), comp, G, {}), ev, comp);
ok("G13 the prompt forbids new requests/actions/numbers/dates/people and keeps a missed move OUT of the better version",
  /Do NOT add any request, question, action, commitment, number, date,\s+deadline, person, organisation or claim/.test(prompt) && /never\s+write it into the better version/.test(prompt) && /asks for nothing/.test(prompt));

/* legacy rows: a report stored before this check, read back through history() */
const legacy = { "raise-problem": { id: "raise-problem", attempts: [{ key: "old", missionId: G.id, kind: "guided", answered: true, at: 5, said: SAID.delay,
  report: { well: [], fix: [], better: LIVE_UNSAFE[0][1], expr: [], one: "x", ai: true, at: 6, pol: [{ s: "the supplier is late", b: "the supplier is late until Monday", w: "" }] } }] } };
const hist = ME.history(id => legacy[id], [comp]);
ok("G14 history(): a legacy invented better version / polish is not shown where the transcript is on the device",
  hist.length === 1 && hist[0].report.better === null && !hist[0].report.pol && legacy["raise-problem"].attempts[0].report.better === LIVE_UNSAFE[0][1], JSON.stringify(hist[0] && hist[0].report));

/* ══════════════════════ M · MERGE — ENGINE ═══════════════════════════════ */
console.log("\nM · MERGE PRESERVES RICHER DATA — engine");
const rich = { key: "k1", at: 10, answered: true, moves: { issue: true }, said: "my words", pron: 81,
  report: { well: [{ m: "issue", n: "ok" }], fix: [], better: "My words, better.", expr: [], one: "x", ai: true, at: 11, pol: [{ s: "a", b: "b", w: "c" }] } };
const stripped = JSON.parse(JSON.stringify(rich)); delete stripped.said; stripped.report.better = null; delete stripped.report.pol;
const m1 = ME.mergeAttempt(stripped, rich), m2 = ME.mergeAttempt(rich, stripped);
ok("M1 cloud-stripped × device-rich → transcript, better version and polish kept, in either order",
  [m1, m2].every(m => m.said === "my words" && m.report.better === "My words, better." && m.report.pol.length === 1 && m.pron === 81), JSON.stringify([m1, m2]));
const pend = { key: "k2", at: 20, answered: true, coachPending: true, moves: { issue: true }, said: "offline words", report: { well: [], fix: [], better: null, expr: [], one: "floor", ai: false, at: 21 } };
const coached = { key: "k2", at: 20, answered: true, coachPending: false, moves: { issue: true, ask: true }, report: { well: [{ m: "issue", n: "y" }], fix: [], better: null, expr: [], one: "ai", ai: true, at: 30 } };
const m3 = ME.mergeAttempt(coached, pend);
ok("M2 a device still pending × a cloud copy whose coaching finished → coached evidence and report, device transcript kept",
  m3.coachPending === false && m3.moves.ask === true && m3.report.ai === true && m3.said === "offline words", JSON.stringify(m3));
ok("M3 two different reports on one attempt → the later one wins", ME.mergeReport({ at: 5, one: "old" }, { at: 9, one: "new" }).one === "new" && ME.mergeReport({ at: 9, one: "new" }, { at: 5, one: "old" }).one === "new");
ok("M4 one side has no report → the report survives", ME.mergeAttempt({ key: "k", at: 1 }, rich).report.better === "My words, better." && ME.mergeAttempt(rich, { key: "k", at: 1 }).report.better === "My words, better.");

/* M5 — the device holds the COMPLETE report; the cloud copy of the same
   attempt carries a LATER timestamp but is poorer. Three ways that happens:
   the sync payload stripped it; a stale device wrote the offline floor while
   still pending; the attempt row itself is newer but has no report yet. */
const full = { key: "k5", at: 100, answered: true, coachPending: false, moves: { issue: true, ask: true }, said: "my own words", pron: 84,
  report: { well: [{ m: "issue", n: "ok" }], fix: [], better: "My own words, better.", expr: [{ e: "this means", why: "" }], one: "x", ai: true, at: 200, pol: [{ s: "my own words", b: "my words", w: "shorter" }] } };
const LATER_POORER = {
  "stripped, later report": { key: "k5", at: 100, answered: true, coachPending: false, moves: { issue: true, ask: true }, report: { well: [{ m: "issue", n: "ok" }], fix: [], better: null, expr: [], one: "x", ai: true, at: 900 } },
  "offline floor, pending, later": { key: "k5", at: 100, answered: true, coachPending: true, moves: { issue: true }, report: { well: [], fix: [], better: null, expr: [], one: "floor", ai: false, at: 900 } },
  "later row, no report": { key: "k5", at: 150, answered: true, coachPending: true, moves: { issue: true } },
};
const keep = m => ({ coached: m.coachPending === false, said: m.said === "my own words", pron: m.pron === 84, better: !!(m.report && m.report.better === "My own words, better."), pol: !!(m.report && m.report.pol && m.report.pol.length === 1), ai: !!(m.report && m.report.ai), ask: !!(m.moves && m.moves.ask) });
const m5 = Object.entries(LATER_POORER).flatMap(([n, c]) => [[n + " · cloud,local", keep(ME.mergeAttempt(c, full))], [n + " · local,cloud", keep(ME.mergeAttempt(full, c))]]);
ok("M5 a LATER but poorer cloud copy cannot erase the device's complete report — coaching state, transcript, pronunciation, better version, polish, AI report and credited moves all kept (3 variants × both orders)",
  m5.every(([, k]) => Object.values(k).every(Boolean)), JSON.stringify(m5.filter(([, k]) => !Object.values(k).every(Boolean))));
ok("M5b the later copy still leads where it is richer: a later AI report with its own better version replaces an older one",
  ME.mergeReport({ ai: true, at: 900, better: "Newer better.", one: "new" }, full.report).better === "Newer better." && ME.mergeReport(full.report, { ai: true, at: 900, better: "Newer better.", one: "new" }).one === "new");

/* ══════════════════════ BROWSER ══════════════════════════════════════════ */
console.log("\nBROWSER — real Chromium, the app's own fbMerge / fbSyncPull / fbFirstSync");
let BASE = process.env.BASE, server = null;
const root = new URL("..", import.meta.url).pathname;
const mine = readFileSync(new URL("../index.html", import.meta.url), "utf8");
if (!BASE) {
  for (const port of [8941, 8942, 8943, 8944]) {
    const s = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
    await sleep(700);
    let served = null; try { served = await (await fetch(`http://127.0.0.1:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://127.0.0.1:${port}`; break; }
    s.kill();
  }
  if (!BASE) { console.error("no free port serving this tree"); process.exit(1); }
}
const POLISH = "https://be-polish.nore-ngou.workers.dev";
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
let repMode = "safe";
const SAFE_BETTER = "We have a problem with the delivery. It started when the supplier changed the order number, which means we would finish three days late. I've already spoken to their office.";
const POL = [{ said: "We have got a problem with the delivery", better: "We have a problem with the delivery", why: "'Have got' is more informal in a workplace update." }];

async function learner(id, track) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  await ctx.addInitScript(({ track }) => {
    class F {
      _fire() { const txt = window.__say || ""; if (txt && this.onresult) { const r = [{ 0: { transcript: txt, confidence: 0.9 }, isFinal: true, length: 1 }]; r.length = 1; try { this.onresult({ results: r, resultIndex: 0 }); } catch (e) {} } }
      _end() { this._on = false; clearTimeout(this._t); if (this.onend) setTimeout(() => { try { this.onend(); } catch (e) {} }, 0); }
      start() { this._on = true; this._t = setTimeout(() => { if (this._on) { this._fire(); this._end(); } }, 120); }
      stop() { if (this._on) this._fire(); this._end(); }
      abort() { this._on = false; this._end(); }
    }
    window.SpeechRecognition = F; window.webkitSpeechRecognition = F;
    if (!localStorage.getItem("be12_v1")) localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Test", role: "", goal: "Speak with confidence", slot: "", lang: "en", ts: 1 },
      professionalTracks: { activeId: track },
      fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
      days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() }));
  }, { track });
  await ctx.route(u => u.href.startsWith(POLISH), async route => {
    let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (b.mvreport) {
      if (repMode === "abort") return route.abort("failed");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        covered: [], well: [{ move: "issue", note: "You opened with the problem itself." }], improve: [{ move: "ask", note: "Close with the decision you need." }],
        better: repMode === "unsafe" ? LIVE_UNSAFE[2][1] : SAFE_BETTER,
        expressions: [{ e: "this means", why: "ties the cause to its impact" }], one: "Finish with a clear ask.", polish: POL }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?ri=" + Date.now(), { waitUntil: "load" });
  await sleep(1000);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, page };
}
async function speak(page, text) {
  await page.evaluate(t => { window.__say = t; }, text);
  await page.evaluate(() => mvRecord());
  await page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
  await sleep(1500);
  await page.evaluate(() => mvRecord());
  await page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
  await sleep(300);
}
/* the device's view of every attempt, compactly */
const snap = page => page.evaluate(() => (S.v2A["general-english"]["raise-problem"].attempts || []).map(a => ({
  key: a.key, said: !!a.said, pending: !!a.coachPending, rep: !!a.report, better: !!(a.report && a.report.better), pol: !!(a.report && a.report.pol && a.report.pol.length),
  well: !!(a.report && a.report.well && a.report.well.length), expr: !!(a.report && a.report.expr && a.report.expr.length), one: !!(a.report && a.report.one) })));
/* a fake Firestore holding one document, so the app's real fbSyncPull / fbFirstSync run unmodified */
const fakeCloud = (page, doc) => page.evaluate(doc => {
  window.__cloud = doc;
  window.firebase = window.firebase || {}; window.firebase.firestore = window.firebase.firestore || {};
  window.firebase.firestore.FieldValue = window.firebase.firestore.FieldValue || { serverTimestamp: () => 0 };
  const ref = { get: async () => ({ exists: !!window.__cloud, data: () => window.__cloud }), set: async d => { window.__cloud = Object.assign({}, window.__cloud, d); } };
  FBdb = { collection: () => ({ doc: () => ref }) };
  FBUser = { uid: "u-test", email: "t@example.com" };
  localStorage.setItem("be12_owner", "u-test");
}, doc);

/* ── A · same device ── */
const A = await learner("A", "general-english");
await A.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
await speak(A.page, SAID.noAsk);
const a1 = await snap(A.page);
const onScreen = await A.page.evaluate(() => ({ wrap: !!document.querySelector("#mvRepWrap"), old: !!document.querySelector(".mv-better-t, .mv-said") }));   /* the Coach step hosts the Executive Polish report since 24 Sep 2026; the mission report lives on the row and in the history */
ok("A1 complete report on the device: evidence, transcript, better version, polish, expressions, focus",
  a1.length === 1 && a1[0].said && a1[0].better && a1[0].pol && a1[0].well && a1[0].expr && a1[0].one && !a1[0].pending && onScreen.wrap && !onScreen.old, JSON.stringify({ a1, onScreen }));
await A.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
await speak(A.page, SAID.noAsk.replace("three days", "three days and more"));
await A.page.reload({ waitUntil: "load" }); await sleep(1000);
const a2 = await snap(A.page);
ok("A2 after reload: both attempts, all durable learner-facing fields intact", a2.length === 2 && a2.every(x => x.said && x.better && x.pol && x.well && x.one), JSON.stringify(a2));
const histA = await A.page.evaluate(() => { go("mvhist"); return new Promise(r => setTimeout(() => r({ rows: document.querySelectorAll(".mv-hist-row").length, better: document.querySelectorAll(".mv-hist-row .mv-better-t").length }), 300)); });
ok("A3 Speaking History lists both with their better versions", histA.rows === 2 && histA.better === 2, JSON.stringify(histA));

/* ── C · conflict: the pull that runs on every return to the app ── */
const cloudDoc = await A.page.evaluate(() => ({ json: JSON.stringify(fbSyncPayload(S)), savedAt: Date.now() }));
const cloudShape = JSON.parse(JSON.parse(JSON.stringify(cloudDoc)).json).v2A["general-english"]["raise-problem"].attempts;
ok("C0 privacy unchanged: the cloud copy carries no transcript, better version or polish", cloudShape.every(a => !a.said && !(a.report && a.report.better) && !(a.report && a.report.pol)), JSON.stringify(cloudShape).slice(0, 300));
await fakeCloud(A.page, cloudDoc);
await A.page.evaluate(async () => { fbLastPull = 0; fbSyncing = false; await fbSyncPull(); });
const c1 = await snap(A.page);
ok("C1 fbSyncPull against the stripped cloud copy keeps the device's transcript, better version and polish",
  c1.length === 2 && c1.every(x => x.said && x.better && x.pol && x.well && x.one), JSON.stringify(c1));
const c2dialog = await A.page.evaluate(async () => { fbSyncing = false; return await Promise.race([fbFirstSync(FBUser).then(() => false), new Promise(r => setTimeout(() => r(true), 4000))]); });
const c2 = await snap(A.page);
ok("C2 sign-in on the same device (silent adopt, no dialog) keeps them too", !c2dialog && c2.length === 2 && c2.every(x => x.said && x.better && x.pol), JSON.stringify({ c2dialog, c2 }));
const d1 = await A.page.evaluate(() => { const at = S.v2A["general-english"]["raise-problem"].attempts; return { n: at.length, keys: new Set(at.map(a => a.key)).size }; });
ok("D1 retry: attempt 1 and attempt 2 stay distinct through both merges", d1.n === 2 && d1.keys === 2, JSON.stringify(d1));

/* conversations (roleplay) — same rule */
await A.page.evaluate(() => {
  S.convos = S.convos || [];
  S.convos.push({ ts: 777, id: "interview", title: "Job interview", tk: "general-english", covered: 1, total: 3, turns: 1,
    lines: [{ text: "i work like logistics analyst", score: 80 }],
    rep: { well: [], fix: [], better: "I work as a logistics analyst.", expr: [], one: "x", ai: true, at: 5, pol: [{ s: "i work like logistics analyst", b: "I work as a logistics analyst", w: "" }] } });
  save();
});
const convDoc = await A.page.evaluate(() => ({ json: JSON.stringify(fbSyncPayload(S)), savedAt: Date.now() }));
await fakeCloud(A.page, convDoc);
await A.page.evaluate(async () => { fbLastPull = 0; fbSyncing = false; await fbSyncPull(); });
const cv = await A.page.evaluate(() => { const c = S.convos.find(x => x.ts === 777); return { text: c.lines[0].text, score: c.lines[0].score, better: c.rep.better, pol: (c.rep.pol || []).length }; });
ok("C3 a roleplay report survives the pull: line text, score, better version, polish", cv.text && cv.score === 80 && /logistics analyst/.test(cv.better) && cv.pol === 1, JSON.stringify(cv));

/* ── B · a second device on the same account ── */
const B = await learner("B", "general-english");
await fakeCloud(B.page, cloudDoc);
await B.page.evaluate(async () => { localStorage.removeItem("be12_owner"); localStorage.setItem("be12_trust_account", "1"); fbSyncing = false; await fbFirstSync(FBUser); });
const b1 = await snap(B.page);
const histB = await B.page.evaluate(() => { go("mvhist"); return new Promise(r => setTimeout(() => r({ rows: document.querySelectorAll(".mv-hist-row").length }), 300)); });
ok("B1 second device: both attempts arrive with evidence, did-well, expressions and focus; history renders them",
  b1.length === 2 && b1.every(x => x.rep && x.well && x.expr && x.one) && histB.rows === 2, JSON.stringify({ b1, histB }));
ok("B2 second device, by the privacy rule: no transcript, better version or polish (documented, not a loss)",
  b1.every(x => !x.said && !x.better && !x.pol), JSON.stringify(b1));
/* B pushes its (poorer) copy back; A pulls it — A must not be impoverished */
const backDoc = await B.page.evaluate(() => ({ json: JSON.stringify(fbSyncPayload(S)), savedAt: Date.now() }));
await fakeCloud(A.page, backDoc);
await A.page.evaluate(async () => { fbLastPull = 0; fbSyncing = false; await fbSyncPull(); });
const b3 = await snap(A.page);
ok("B3 device A pulling device B's copy keeps its own transcript, better versions and polish", b3.length === 2 && b3.every(x => x.said && x.better && x.pol), JSON.stringify(b3));

/* M5 in the app: the pull meets a cloud copy of attempt 1 that is LATER
   (report re-stamped, marked pending, offline floor) and stripped */
const laterDoc = await A.page.evaluate(() => {
  const p = JSON.parse(JSON.stringify(fbSyncPayload(S)));
  const a = p.v2A["general-english"]["raise-problem"].attempts[0];
  a.coachPending = true; delete a.pron;
  a.report = { well: [], fix: [], better: null, expr: [], one: "floor", ai: false, at: Date.now() + 864e5 };
  return { json: JSON.stringify(p), savedAt: Date.now() + 864e5 };
});
await A.page.evaluate(() => { S.v2A["general-english"]["raise-problem"].attempts[0].pron = 84; save(); });
await fakeCloud(A.page, laterDoc);
await A.page.evaluate(async () => { fbLastPull = 0; fbSyncing = false; await fbSyncPull(); });
const c4 = await A.page.evaluate(() => { const a = S.v2A["general-english"]["raise-problem"].attempts[0];
  return { coached: a.coachPending === false, said: !!a.said, pron: a.pron === 84, better: !!(a.report && a.report.better), pol: !!(a.report && a.report.pol && a.report.pol.length), ai: !!(a.report && a.report.ai) }; });
const c4h = await A.page.evaluate(() => { go("mvhist"); return new Promise(r => setTimeout(() => r(document.querySelectorAll('.mv-hist-row button[onclick^="mvHistHear"]').length), 300)); });   /* mission rows only — the C3 conversation has its own */
ok("C4 app fbSyncPull: a later, pending, floor-only, stripped cloud copy leaves attempt 1 complete — coached, transcript, pronunciation, better version, polish — and History still shows every better version",
  Object.values(c4).every(Boolean) && c4h === 2, JSON.stringify({ c4, c4h }));

/* ── E · offline, then reconnect ── */
await A.ctx.setOffline(true);
await A.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
await speak(A.page, SAID.noAsk);
const e1 = (await snap(A.page)).slice(-1)[0];
ok("E1 offline: the attempt is saved with its transcript, coaching left pending", e1 && e1.said && e1.pending, JSON.stringify(e1));
const offDoc = await A.page.evaluate(() => ({ json: JSON.stringify(fbSyncPayload(S)), savedAt: Date.now() }));   /* the cloud learns of it while pending */
await A.ctx.setOffline(false);
await A.page.evaluate(async () => { await mvFinishCoaching(); });
await sleep(400);
await fakeCloud(A.page, offDoc);
await A.page.evaluate(async () => { fbLastPull = 0; fbSyncing = false; await fbSyncPull(); });
const e2 = await snap(A.page);
ok("E2 reconnect: coaching recovered onto the same row and a pull of the pending cloud copy does not undo it",
  e2.length === 3 && !e2[2].pending && e2[2].better && e2[2].pol && e2[2].said, JSON.stringify(e2));

/* ── G in the browser: the unsafe version is not shown and not stored ── */
repMode = "unsafe";
await A.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
await speak(A.page, SAID.noAsk);
const gb = await A.page.evaluate(() => { const at = S.v2A["general-english"]["raise-problem"].attempts; const a = at[at.length - 1];
  return { shown: (document.querySelector(".mv-better-t") || {}).innerText || "", stored: a.report && a.report.better, ai: a.report && a.report.ai, well: !!document.querySelector("#mvRepWrap"), page: document.body.innerText.includes("need your help") }; });
ok("G15 app: an invented better version is neither shown, stored, nor replaced; the rest of the report renders",
  !gb.shown && gb.stored === null && gb.ai === true && gb.well && !gb.page, JSON.stringify(gb));
repMode = "safe";

/* ── Welding boundary ── */
const Wd = await learner("W", "welding");
await fakeCloud(Wd.page, cloudDoc);
await Wd.page.evaluate(async () => { localStorage.removeItem("be12_owner"); localStorage.setItem("be12_trust_account", "1"); fbSyncing = false; await fbFirstSync(FBUser); });
/* the account copy carries the account's open track (General English); the
   learner then opens Welding on this device, as areaSwitch would */
const w = await Wd.page.evaluate(() => {
  S.professionalTracks.activeId = "welding"; save();
  go("mvhist");
  return new Promise(r => setTimeout(() => r({ area: areaId(), v2Welding: Object.keys((S.v2A || {}).welding || {}).length, view: cur.v, rows: document.querySelectorAll(".mv-hist-row").length,
    payloadWelding: Object.keys((fbSyncPayload(S).v2A || {}).welding || {}).length, convosWelding: (S.convos || []).filter(c => c.tk === "welding" && c.rep).length }), 400));
});
ok("W1 Welding (after syncing an account full of GE reports): no GE report state, no history, no sync state in its area",
  w.area === "welding" && w.v2Welding === 0 && w.view !== "mvhist" && w.rows === 0 && w.payloadWelding === 0 && w.convosWelding === 0, JSON.stringify(w));

ok("no page errors in any context", errors.length === 0, errors.join(" | "));

await browser.close();
if (server) server.kill();
const failed = res.filter(r => !r.pass);
console.log(`\n${res.length - failed.length}/${res.length} passed`);
process.exit(failed.length ? 1 : 0);
