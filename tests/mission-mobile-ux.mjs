/* BE Mastery — MOBILE MISSION UX (General English V2).

   Run:  cd tests && node mission-mobile-ux.mjs
         BASE=http://127.0.0.1:PORT node mission-mobile-ux.mjs   (a server of THIS tree)

   The mission is six stages — Mission · Hear · Notice · Speak · Coach ·
   Complete — with ONE primary action per stage in a sticky dock, and a
   General English speaking DAY hands over to it: no script, no scoring
   against a script, no self-score, no notes. This suite proves the
   presentation contract and that nothing under it moved:

   1. FLOW at 390×844, one learner, the whole loop: mission → hear → notice →
      speak (recording) → coach → retry → coach → transfer → coach → complete.
      At every stage the primary action is on screen above the bottom nav
      without scrolling, and after coaching it is the ENGINE's next step
      (MissionEngine.recommend) — retry while practising, transfer once
      demonstrated, complete once transfer is shown.
   2. EVIDENCE: the stored state always equals MissionEngine.stateFrom(record);
      attempts stay distinct; the grounded better version still shows.
   3. OFFLINE → RECONNECT: the coach's primary action is "finish the
      coaching", and it writes the report onto the SAME row.
   4. VIEWPORTS 375×812, 430×932, desktop 1280×800: primary visible, no
      horizontal overflow, at coach and complete.
   5. WELDING: the mission page never renders — no dock, no stages — and the
      Welding Session page still has its script, self-score and notes.
   6. DAY → MISSION: a General English speaking day has no V1 script,
      recorder-vs-script, self-score, notes or manual tick; "Start speaking"
      opens the mission; reaching Complete ticks the day through the same
      path the manual button used (one session_complete). A non-speaking day
      keeps its activity and manual tick but loses script, notes, self-score.
   7. SPEAKING HISTORY lists the attempts made in the loop. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const ME = require("../mission-engine.js");
const PACK = JSON.parse(readFileSync(new URL("../tracks/general/missions.json", import.meta.url), "utf8"));
const comp = ME.competencyOf(PACK, "raise-problem");
const G = ME.missionOf(comp, "raise-problem-guided");

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const SAY = {
  noAsk: "We have got a problem with the delivery. It started when the supplier changed the order number. This means we would finish three days late. I have already spoken to their office.",
  strong: G.hear.model,
};
const BETTER = "We have a problem with the delivery. It started when the supplier changed the order number, so we would finish three days late. I have already spoken to their office.";

let BASE = process.env.BASE, server = null;
const root = new URL("..", import.meta.url).pathname;
const mine = readFileSync(new URL("../index.html", import.meta.url), "utf8");
if (!BASE) {
  for (const port of [8971, 8972, 8973, 8974]) {
    const s = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
    await sleep(700);
    let served = null; try { served = await (await fetch(`http://127.0.0.1:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://127.0.0.1:${port}`; break; }
    s.kill();
  }
  if (!BASE) { console.error("no free port serving this tree"); process.exit(1); }
}
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];

async function learner(id, track, vp) {
  const [w, h] = vp;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 800, permissions: ["microphone"], serviceWorkers: "block" });
  await ctx.addInitScript(({ track }) => { try{localStorage.setItem("be_missions","1")}catch(e){} /* V2 missions are hidden in production — on for this suite */
    class F {
      _fire() { const txt = window.__say || ""; if (txt && this.onresult) { const r = [{ 0: { transcript: txt, confidence: 0.9 }, isFinal: true, length: 1 }]; r.length = 1; try { this.onresult({ results: r, resultIndex: 0 }); } catch (e) {} } }
      _end() { this._on = false; clearTimeout(this._t); if (this.onend) setTimeout(() => { try { this.onend(); } catch (e) {} }, 0); }
      start() { this._on = true; this._t = setTimeout(() => { if (this._on) { this._fire(); this._end(); } }, 120); }
      stop() { if (this._on) this._fire(); this._end(); }
      abort() { this._on = false; this._end(); }
    }
    window.SpeechRecognition = F; window.webkitSpeechRecognition = F;
    if (!localStorage.getItem("be12_v1")) localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Awa", role: "", goal: "Speak with confidence", slot: "", lang: "en", ts: 1 },
      professionalTracks: { activeId: track },
      fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
      days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() }));
  }, { track });
  await ctx.route(u => u.href.startsWith("https://be-events"), r => r.fulfill({ status: 204, body: "" }));
  await ctx.route(u => u.href.startsWith("https://be-polish"), async r => {
    let b = {}; try { b = JSON.parse(r.request().postData() || "{}"); } catch (e) {}
    if (b.mvreport) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      covered: [], well: [{ move: "issue", note: "You opened with the problem itself." }, { move: "impact", note: "Three days late is a real consequence." }],
      improve: [{ move: "ask", note: "Close with the decision you need from them." }], better: BETTER,
      expressions: [{ e: "this means", why: "ties the cause to its impact" }], one: "Finish with a clear ask.",
      polish: [{ said: "We have got a problem with the delivery", better: "We have a problem with the delivery", why: "More direct." }] }) });
    return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?mux=" + Date.now(), { waitUntil: "load" });
  await sleep(1000);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, page };
}
/* what the learner sees: the current stage, the dock's primary action and
   whether it is on screen above the bottom nav without scrolling */
const look = page => page.evaluate(() => {
  scrollTo(0, 0);
  /* a signed-out learner's floating sign-in nudge sits exactly where the dock
     is; put one on screen so "not covered" is tested, not assumed */
  if (!document.querySelector(".sync-nudge")) { const n = document.createElement("div"); n.className = "sync-nudge"; n.id = "syncNudge"; n.style.minHeight = "120px"; n.textContent = "Save your progress"; document.body.appendChild(n); }
  const v = document.getElementById("v-mission"), vh = innerHeight;
  const nav = document.querySelector(".bottom-nav");
  const navTop = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().top : vh;
  const dockP = v.querySelector(".mv-dock .btn-primary"), mic = v.querySelector(".rec-btn");
  const prim = dockP || mic, r = prim && prim.getBoundingClientRect();
  return { stage: (v.querySelector(".mv-stages li.now") || {}).innerText || "", stages: v.querySelectorAll(".mv-stages li").length,
    primary: prim ? (dockP ? dockP.innerText.trim() : "mic") : "", onclick: dockP ? dockP.getAttribute("onclick") : "",
    /* on screen AND not covered: whatever is on top at the button's centre must be the button */
    visible: !!r && r.top >= 0 && r.bottom <= navTop + 0.5 && prim.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)), dockPrimaries: v.querySelectorAll(".mv-dock .btn-primary").length,
    inCardPrimaries: v.querySelectorAll("section .btn-primary").length, overflow: document.documentElement.scrollWidth > innerWidth + 1,
    better: (v.querySelector(".mv-better-t") || {}).innerText || "", wrap: !!v.querySelector("#mvRepWrap"), old: !!v.querySelector(".mv-rep-well, .mv-better-t, .mv-folds") };
});
const rec = page => page.evaluate(() => { const r = mvStore()["raise-problem"]; return { state: r.state, derived: MissionEngine.stateFrom(r), n: r.attempts.filter(a => a.answered).length, keys: new Set(r.attempts.map(a => a.key)).size, pending: r.attempts.filter(a => a.coachPending).length, next: MissionEngine.recommend(r, mvComp("raise-problem"), Date.now()).action }; });
async function speak(page, text, during) {
  await page.evaluate(t => { window.__say = t; }, text);
  await page.evaluate(() => mvRecord());
  await page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
  await sleep(1200);
  if (during) await during();
  await page.evaluate(() => mvRecord());
  await page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 15000 }).catch(() => {});
  await sleep(400);
}
const tap = (page, sel) => page.evaluate(sel => document.querySelector(sel).click(), sel);

/* ══════════════════════ 1–2 · THE WHOLE LOOP AT 390×844 ═════════════════ */
console.log("\n1 · FLOW at 390×844 — one primary action per stage, always on screen");
const L = await learner("ge", "general-english", [390, 844]);
await L.page.evaluate(() => mvGo("raise-problem-guided", "see")); await sleep(300);
let s = await look(L.page);
const evid = await L.page.evaluate(() => document.querySelectorAll("#v-mission .mv-evid .mv-move").length);
ok("MISSION: six stages, 'Mission' current, the evidence to produce listed (one chip per move), one primary (Go) in the dock, on screen",
  s.stages === 6 && s.stage === "Mission" && evid === 5 && /^Go/.test(s.primary) && s.visible && s.dockPrimaries === 1 && s.inCardPrimaries === 0, JSON.stringify({ s, evid }));
await tap(L.page, ".mv-dock .btn-primary"); await sleep(300); s = await look(L.page);
ok("HEAR: 'Hear' current, Go on screen", s.stage === "Hear" && /^Go/.test(s.primary) && s.visible, JSON.stringify(s));
await tap(L.page, ".mv-dock .btn-primary"); await sleep(300); s = await look(L.page);
const noticeTall = await L.page.evaluate(() => document.documentElement.scrollHeight > innerHeight);
const useful = await L.page.evaluate(() => document.querySelectorAll("#v-mission .mv-useful li").length);
ok("NOTICE: its own stage; the pattern and useful expressions are shown; the page is taller than the screen yet 'Start speaking' is on screen",
  s.stage === "Notice" && useful > 0 && /Start speaking/.test(s.primary) && noticeTall && s.visible, JSON.stringify({ s, useful, noticeTall }));
await tap(L.page, ".mv-dock .btn-primary"); await sleep(300); s = await look(L.page);
const once = await L.page.evaluate(() => { const txt = document.getElementById("v-mission").innerText; const p = t("mv.speak_sub"); return txt.split(p).length - 1; });
ok("SPEAK: 'Speak' current, the microphone is the primary action and on screen; the instruction is shown once", s.stage === "Speak" && s.primary === "mic" && s.visible && once === 1, JSON.stringify({ s, once }));
let recLook = null;
await speak(L.page, SAY.noAsk, async () => { recLook = await look(L.page); });
ok("RECORDING: the stop control stays on screen while recording", recLook && recLook.primary === "mic" && recLook.visible, JSON.stringify(recLook));
s = await look(L.page); let r = await rec(L.page);
ok("COACH (practising): primary = the engine's next step, 'Try it again', on screen without scrolling the report",
  s.stage === "Coach" && r.next === "retry" && /Try it again/.test(s.primary) && s.visible && s.dockPrimaries === 1 && s.inCardPrimaries === 0, JSON.stringify({ s, r }));
ok("COACH: the step hosts the Executive Polish speaking report (its wrap), the mission's own report is not drawn there", s.wrap && !s.old, JSON.stringify({ wrap: s.wrap, old: s.old }));
/* F · the report's frame: the move chips head it once, the history link
   follows it, the dock stays the one primary (the report itself is proven in
   tests/mission-coach-report.mjs) */
const F = await L.page.evaluate(() => { const v = document.getElementById("v-mission"); return { chipsOnce: v.querySelectorAll(".mv-move").length === 5, prev: !!v.querySelector(".mv-prevlink"), wrapBeforePrev: (() => { const w = v.querySelector("#mvRepWrap"), p = v.querySelector(".mv-prevlink"); return !!(w && p) && !!(w.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING); })() }; });
ok("F · the move chips appear once above the report, previous attempts link below it", F.chipsOnce && F.prev && F.wrapBeforePrev, JSON.stringify(F));
ok("EVIDENCE after attempt 1: stored state = stateFrom(record) = PRACTICING", r.state === r.derived && r.state === "PRACTICING" && r.n === 1, JSON.stringify(r));

await tap(L.page, ".mv-dock .btn-primary"); await sleep(300); s = await look(L.page);
ok("RETRY: the Speak stage is labelled 'Retry', mic on screen", s.stage === "Retry" && s.primary === "mic" && s.visible, JSON.stringify(s));
await speak(L.page, SAY.strong);
s = await look(L.page); r = await rec(L.page);
ok("COACH (demonstrated): primary = 'Take the new situation' (the engine says transfer), on screen",
  r.state === "DEMONSTRATED" && r.next === "transfer" && /new situation/i.test(s.primary) && /raise-problem-transfer/.test(s.onclick) && s.visible, JSON.stringify({ s, r }));

await tap(L.page, ".mv-dock .btn-primary"); await sleep(300); s = await look(L.page);
ok("TRANSFER: the Speak stage is labelled 'Transfer', mic on screen", s.stage === "Transfer" && s.primary === "mic" && s.visible, JSON.stringify(s));
await speak(L.page, SAY.strong);
s = await look(L.page); r = await rec(L.page);
ok("COACH (transfer shown): primary = 'What you showed' (complete), with 'Try it again' as the one secondary",
  r.state === "TRANSFER_READY" && /What you showed/.test(s.primary) && s.visible && await L.page.evaluate(() => /Try it again/.test(document.querySelector(".mv-dock .mv-dock-2").innerText)), JSON.stringify({ s, r }));
await tap(L.page, ".mv-dock .btn-primary"); await sleep(300); s = await look(L.page);
const doneFold = await L.page.evaluate(() => { const f = [...document.querySelectorAll("#v-mission details.mv-fold")].find(d => /measures/i.test(d.innerText)); return { fold: !!f, closed: f && !f.open, bars: f ? f.querySelectorAll(".mv-bar").length : 0, chips: document.querySelectorAll("#v-mission .mv-move").length, next: !!document.querySelector("#v-mission .mv-next") }; });
ok("COMPLETE: 'Complete' current, one primary on screen, move chips and next step visible, the five measures in a closed fold",
  s.stage === "Complete" && s.visible && s.dockPrimaries === 1 && doneFold.fold && doneFold.closed && doneFold.bars === 5 && doneFold.chips > 0 && doneFold.next, JSON.stringify({ s, doneFold }));
ok("EVIDENCE: 3 distinct attempts, state = stateFrom(record), nothing pending", r.n === 3 && r.keys === 3 && r.state === r.derived && r.pending === 0, JSON.stringify(r));
const toastTop = await L.page.evaluate(() => { toast("probe"); const el = document.querySelector(".toast"); return new Promise(res => setTimeout(() => { const b = el.getBoundingClientRect(), d = document.querySelector(".mv-dock").getBoundingClientRect(); res({ top: b.top, overlap: !(b.bottom <= d.top || b.top >= d.bottom) }); }, 400)); });
ok("a toast on the mission drops from the top and never covers the dock", toastTop.top < 120 && !toastTop.overlap, JSON.stringify(toastTop));

/* ══════════════════════ 3 · OFFLINE → RECONNECT ═════════════════════════ */
console.log("\n3 · OFFLINE → RECONNECT");
const O = await learner("off", "general-english", [390, 844]);
await O.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
await O.ctx.setOffline(true);
await speak(O.page, SAY.noAsk);
s = await look(O.page); r = await rec(O.page);
ok("offline: attempt saved and scored, coaching pending; the primary action is 'finish the coaching', on screen",
  r.n === 1 && r.pending === 1 && /mvFinishCoaching/.test(s.onclick) && s.visible && s.dockPrimaries === 1, JSON.stringify({ s, r }));
await O.ctx.setOffline(false);
await tap(O.page, ".mv-dock .btn-primary");
await O.page.waitForFunction(() => _mv && !_mv.busy, null, { timeout: 15000 }).catch(() => {}); await sleep(400);
s = await look(O.page); r = await rec(O.page);
const rowBetter = await O.page.evaluate(() => { const a = mvStore()["raise-problem"].attempts.slice(-1)[0]; return !!(a.report && /three days late/.test(a.report.better || "")); });
ok("reconnect: the report lands on the SAME row, pending cleared, the better version stored on it, the speaking report hosted, next step = Try it again",
  r.n === 1 && r.pending === 0 && rowBetter && s.wrap && /Try it again/.test(s.primary) && s.visible, JSON.stringify({ s, r, rowBetter }));

/* ══════════════════════ 4 · OTHER VIEWPORTS ═════════════════════════════ */
console.log("\n4 · VIEWPORTS");
for (const vp of [[375, 812], [430, 932], [1280, 800]]) {
  const V = await learner("vp" + vp[0], "general-english", vp);
  await V.page.evaluate(() => mvGo("raise-problem-guided", "notice")); await sleep(300);
  const n = await look(V.page);
  await V.page.evaluate(() => mvStep("speak")); await sleep(200);
  await speak(V.page, SAY.noAsk);
  const c = await look(V.page);
  await V.page.evaluate(() => mvStep("done")); await sleep(300);
  const d = await look(V.page);
  ok(`${vp[0]}×${vp[1]}: notice, coach and complete each show their one primary action on screen, no horizontal overflow`,
    [n, c, d].every(x => x.visible && x.dockPrimaries === 1 && !x.overflow), JSON.stringify({ n, c, d }));
  await V.ctx.close();
}

/* ══════════════════════ 7 · SPEAKING HISTORY ════════════════════════════ */
const hist = await L.page.evaluate(() => { go("mvhist"); return new Promise(r => setTimeout(() => r(document.querySelectorAll(".mv-hist-row").length), 300)); });
ok("SPEAKING HISTORY: the three attempts of the loop are listed", hist === 3, String(hist));

/* ══════════════════════ 6 · DAY → MISSION ═══════════════════════════════ */
console.log("\n6 · GENERAL ENGLISH DAY → V2 MISSION");
const D = await learner("day", "general-english", [390, 844]);
await D.page.evaluate(() => { window.__ev = []; const t0 = window.track; window.track = (n, p) => { window.__ev.push(n); return t0 && t0(n, p); }; S.days[dayKey(1, "Mon")] = true; save(); go("session", 1, "Tue"); });
await sleep(400);
const v1gone = page => page.evaluate(() => { const v = document.querySelector(".view.on");
  return { script: !!v.querySelector("#sessScript,.sess-ex"), selfscore: !!v.querySelector(".score-row"), notes: !!v.querySelector("#noteBox"),
    recVsScript: !!v.querySelector('[onclick^="sessRec"]'), manualTick: !!v.querySelector('[onclick^="toggleDay"]'), analyze: !!v.querySelector('[onclick^="sessAnalyze"]'),
    dock: (v.querySelector(".mv-dock .btn-primary") || {}).innerText || "" }; });
let dv = await v1gone(D.page);
const dvis = await D.page.evaluate(() => { const el = document.querySelector(".view.on .mv-dock .btn-primary"), b = el.getBoundingClientRect(); const n = document.querySelector(".bottom-nav").getBoundingClientRect(); return b.top >= 0 && b.bottom <= n.top && el.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)); });
ok("speaking day (W1 Tue): no script box, no recorder-vs-script, no Analyze, no self-score, no notes, no manual tick; 'Start speaking' on screen",
  !dv.script && !dv.recVsScript && !dv.analyze && !dv.selfscore && !dv.notes && !dv.manualTick && /Start speaking/.test(dv.dock) && dvis, JSON.stringify({ dv, dvis }));
await tap(D.page, ".view.on .mv-dock .btn-primary"); await sleep(400);
const opened = await D.page.evaluate(() => ({ view: cur.v, step: _mv && _mv.step, comp: _mv && _mv.compId }));
ok("'Start speaking' opens this week's mission at its first stage", opened.view === "mission" && opened.step === "see" && opened.comp === "explain-work", JSON.stringify(opened));
await D.page.evaluate(() => mvStep("speak")); await sleep(200);
const W1 = ME.missionOf(ME.competencyOf(PACK, "explain-work"), "explain-work-guided") || (ME.competencyOf(PACK, "explain-work").missions || [])[0];
await speak(D.page, W1.hear.model);
const before = await D.page.evaluate(() => !!S.days[dayKey(1, "Tue")]);
await D.page.evaluate(() => mvStep("done")); await sleep(400);
const after = await D.page.evaluate(() => ({ ticked: !!S.days[dayKey(1, "Tue")], line: !!document.querySelector("#v-mission .mv-daydone"), events: window.__ev.filter(n => n === "session_complete").length }));
await D.page.evaluate(() => mvStep("done")); await sleep(300);
const again = await D.page.evaluate(() => window.__ev.filter(n => n === "session_complete").length);
ok("reaching Complete ticks the day automatically (not before), says so, and fires session_complete exactly once",
  !before && after.ticked && after.line && after.events === 1 && again === 1, JSON.stringify({ before, after, again }));
await D.page.evaluate(() => go("session", 1, "Tue")); await sleep(300);
dv = await v1gone(D.page);
ok("back on the day: marked completed, the one primary is the next step, still no V1 controls", /Next step/.test(dv.dock) && !dv.manualTick && !dv.selfscore && await D.page.evaluate(() => !!document.querySelector(".view.on .chip.done")), JSON.stringify(dv));
await D.page.evaluate(() => { S.days[dayKey(1, "Tue")] = true; go("session", 1, "Wed"); }); await sleep(300);
dv = await v1gone(D.page);
ok("non-speaking day (W1 Wed): activity and manual tick kept; no script, no self-score, no notes",
  dv.manualTick && !dv.script && !dv.selfscore && !dv.notes, JSON.stringify(dv));

/* ══════════════════════ 5 · WELDING ═════════════════════════════════════ */
console.log("\n5 · WELDING");
const W = await learner("w", "welding", [390, 844]);
await W.page.evaluate(() => { try { mvGo("raise-problem-guided", "see"); } catch (e) {} go("mission", "raise-problem-guided", "see"); }); await sleep(500);
const w = await W.page.evaluate(() => ({ view: cur.v, dock: !!document.querySelector("#v-mission .mv-dock"), stages: !!document.querySelector("#v-mission .mv-stages"), v2: Object.keys((S.v2A || {}).welding || {}).length }));
ok("Welding: the mission never renders — no dock, no stages, no V2 state written", w.view !== "mission" && !w.dock && !w.stages && w.v2 === 0, JSON.stringify(w));
await W.page.evaluate(() => { S.days[dayKey(1, "Mon")] = true; save(); go("session", 1, "Tue"); }); await sleep(400);
const ws = await W.page.evaluate(() => { const v = document.querySelector(".view.on"); return { script: !!v.querySelector("#sessScript"), selfscore: !!v.querySelector(".score-row"), notes: !!v.querySelector("#noteBox"), tick: !!v.querySelector('[onclick^="toggleDay"]'), dock: !!v.querySelector(".mv-dock") }; });
ok("Welding Session page unchanged: script, self-score, notes and manual tick all still there; no V2 dock", ws.script && ws.selfscore && ws.notes && ws.tick && !ws.dock, JSON.stringify(ws));

ok("no page errors in any context", errors.length === 0, errors.join(" | "));
await browser.close();
if (server) server.kill();
const failed = res.filter(x => !x.pass);
console.log(`\n${res.length - failed.length}/${res.length} passed`);
process.exit(failed.length ? 1 : 0);
