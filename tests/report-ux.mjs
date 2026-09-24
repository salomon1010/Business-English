/* BE Mastery — the CONSOLIDATED SPEAKING REPORT (owner spec 23 Sep 2026).

   Run:  cd tests && node report-ux.mjs

   What this suite exists to prove, in one sentence: the learner reads the
   answer — what worked, ONE improvement, the better version, one focus, Try
   again — inside the first stretch of the page, and every deeper section is
   a closed fold that still holds ALL the analysis the long report showed.

   Surfaces, per the spec's own test list: Week 3 "Raise a problem" (mission),
   Interview, Salary negotiation, a work simulation (all three ride the same
   conversation sheet), and the Practice Partner review. Viewports: 390×844
   and 1280×800. The engine, the evidence and the analysis are asserted
   UNCHANGED — this was a presentation pass. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const SHOTS = process.env.SHOTS || "";

let BASE = process.env.BASE, server = null;
if (!BASE) {
  const root = new URL("..", import.meta.url).pathname;
  const mine = readFileSync(root + "index.html", "utf8");
  for (const port of [8041, 8042, 8043, 8044, 8045]) {
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

/* the model hands back MORE than the primary report shows — a third strength
   and a second improvement — so the folds can be proven to keep the rest */
const MISSION_REPLY = {
  covered: [],
  well: [
    { move: "issue", note: "You opened with the problem itself." },
    { move: "cause", note: "The order-number detail makes the cause concrete." },
    { move: "impact", note: "Three days late is a real consequence." },
  ],
  improve: [
    { move: "mitigate", note: "Say what you have already done about it." },
    { move: "ask", note: "Close with the decision you need from them." },
  ],
  better: "We have a problem with the delivery. It started when the supplier changed the order number, so we would finish three days late. I have already spoken to their office.",
  expressions: [{ e: "this means", why: "ties the cause to its impact" }, { e: "could you approve", why: "turns a report into an ask" }],
  one: "Finish with a clear ask before you stop speaking.",
};
const CONVO_REPLY = {
  covered: [],
  well: [{ move: "p1", note: "A clear, direct opening." }],
  improve: [{ move: "p2", note: "Bring in the second point in your own words." }, { move: "p3", note: "And close on the third." }],
  better: "Thank you for meeting me today. I have worked as a logistics analyst for five years.",
  expressions: [{ e: "could I ask", why: "turns a statement into a question" }],
  one: "Cover every talking point before the conversation ends.",
};

async function learner(id, track, viewport) {
  const ctx2 = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] }, viewport || {}));
  await ctx2.addInitScript(({ track }) => { try{localStorage.setItem("be_missions","1")}catch(e){} /* V2 missions are hidden in production — on for this suite */
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
    let b = {};
    try { b = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (b.assess) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ overall: 86, mode: "ai", words: [{ word: "a", score: 86 }] }) });
    if (b.mvreport) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(/p1/.test(b.mvreport.system) ? CONVO_REPLY : MISSION_REPLY) });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  const page = await ctx2.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?repux=" + Date.now(), { waitUntil: "load" });
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
const shot = async (page, name) => { if (SHOTS) { try { await page.screenshot({ path: SHOTS + "/ux-" + name + ".png", fullPage: true }); } catch (e) {} } };
/* the report geometry, read the way a learner meets it: top offsets in page
   pixels, so "reachable without excessive scrolling" is a number, not a vibe */
const geometry = page => page.evaluate(() => {
  const top = q => { const e = document.querySelector(q); return e ? Math.round(e.getBoundingClientRect().top + window.scrollY) : null; };
  return {
    wrap: top("#mvRepWrap"),
    tryAgain: top(".mv-dock .btn-primary"),
    prevlink: top(".mv-prevlink"),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
});

/* ══════════════ 1 · WEEK 3 MISSION, 390 × 844 ══════════════ */
console.log("\n1 · MISSION — Week 3 'Raise a problem' at 390×844");
const SAY_WEAK = "We have got a problem with the delivery. It started when the supplier changed the order number. This means we would finish three days late.";
const L = await learner("ge", "general-english");
await L.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
await speak(L.page, SAY_WEAK);
/* Since 24 Sep 2026 the mission's Coach step hosts the Executive Polish
   speaking report (tests/mission-coach-report.mjs proves that screen); the
   consolidated mission report below is what the CONVERSATION sheet and the
   Practice Partner review still draw. This fixture's STT answers {}, so the
   mission wrap shows the plain note. */
const m1 = await L.page.evaluate(() => ({
  step: _mv.step,
  title: (document.querySelector(".mv-coach .eyebrow") || {}).innerText || "",
  wrap: !!document.querySelector("#mvRepWrap"), note: !!document.querySelector("#mvRepWrap .ex-note"),
  old: !!document.querySelector(".mv-rep-well, .mv-rep-big, .mv-better-t, .mv-folds, .mv-one"),
  chipsPrim: document.querySelectorAll(".mv-rep-head .mv-move").length,
  prevlink: !!document.querySelector(".mv-prevlink"),
  rowReport: (() => { const r = mvStore()["raise-problem"]; const a = r.attempts[r.attempts.length - 1]; return { well: a.report.well.length, fix: a.report.fix.length, better: !!a.report.better }; })(),
}));
ok("the Coach step is the speaking report's host — titled as such, the move chips once above it, the old consolidated report gone, the history link below",
  m1.step === "coach" && /speaking report/i.test(m1.title) && m1.wrap && m1.note && !m1.old && m1.chipsPrim === 5 && m1.prevlink, JSON.stringify(m1).slice(0, 500));
ok("the full mission report is still on the attempt row — 3 strengths, 2 improvements, the better version (the screen changed, the evidence did not)",
  m1.rowReport.well === 3 && m1.rowReport.fix === 2 && m1.rowReport.better, JSON.stringify(m1.rowReport));

const g1 = await geometry(L.page);
ok("390×844 geometry: the report wrap inside the first viewport, Try again on screen, history below the report; no sideways scroll",
  g1.wrap < 844 && g1.tryAgain < 844 && g1.prevlink > g1.wrap && !g1.overflow, JSON.stringify(g1));
await shot(L.page, "390-mission");

const nav = await L.page.evaluate(() => new Promise(r => { document.querySelector(".mv-prevlink").click(); setTimeout(() => r(cur.v), 300); }));
ok("'Previous attempts' goes to the Speaking history — the history is a link, not a section of the report", nav === "mvhist");

/* ══════════════ 2 · MISSION, 1280 × 800 ══════════════ */
console.log("\n2 · MISSION at 1280×800");
const W = await learner("wide", "general-english", { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
await W.page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
await speak(W.page, SAY_WEAK);
const g2 = await geometry(W.page);
ok("1280×800: the report wrap in the first viewport, Try again on screen, no horizontal overflow",
  g2.wrap != null && g2.wrap < 800 && g2.tryAgain < 800 && !g2.overflow, JSON.stringify(g2));
await shot(W.page, "1280-mission");
await W.ctx.close();

/* ══════════════ 3 · CONVERSATIONS — interview, salary, simulation ══════════════ */
console.log("\n3 · CONVERSATIONS — the Executive Polish report on the roleplay sheet (24 Sep 2026)");
const convoCheck = async (scId) => {
  const ts = Date.now() + Math.floor(Math.random() * 1000);
  await L.page.evaluate(({ scId, ts }) => {
    const sc = SCENARIOS.find(s => s.id === scId);
    _rpLastTs = ts;
    _rpLast = { sc, turns: [{ text: "Thank you for meeting me today." }, { text: "I work as logistics analyst since five years." }], covered: new Set([1]) };
    S.convos = S.convos || [];
    S.convos.push({ ts, id: sc.id, title: sc.title, cat: sc.cat, tk: areaId(), covered: 1, total: sc.points.length, turns: 2, lines: _rpLast.turns.map(x => ({ text: x.text })) });
    save(); go("roleplay");
  }, { scId, ts });
  await L.page.evaluate(() => rpReport()); await sleep(600);
  return L.page.evaluate(() => {
    const el = document.getElementById("v-roleplay"), sc = _rpLast.sc;
    const wrap = el.querySelector("#rpRepWrap"), r = wrap && wrap.getBoundingClientRect();
    return {
      card: !!el.querySelector("#rpRepWrap .ex-rep-card[open]"),
      stations: el.querySelectorAll("#rpRepWrap .ex-station").length,
      coach: !!el.querySelector("#rpRepWrap #exCoachBtn"),
      again: [...el.querySelectorAll("button")].some(b => /exAgainGo/.test(b.getAttribute("onclick") || "")),
      oldSheet: /What you did well|Biggest improvement|Say it better/.test(el.textContent),
      voice: !!(exHost && exHost.wrapId === "rpRepWrap" && exHost.voice === ttsVoice(rpVoiceFor(sc), sc.g) && exHost.gender === sc.g),
      wrapTop: r ? r.top : null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
};
for (const [scId, label] of [["interview", "Interview"], ["iv-salary", "Salary negotiation"], ["standup", "Work simulation (stand-up)"]]) {
  const c = await convoCheck(scId);
  ok(`${label}: the Executive Polish report is the sheet — open card, five stations, the coach button, Say it again, the character's voice, no old sheet, no overflow`,
    c.card && c.stations === 5 && c.coach && c.again && !c.oldSheet && c.voice && c.wrapTop != null && c.wrapTop < 844 && !c.overflow, JSON.stringify(c));
}
await shot(L.page, "390-conversation");

/* ══════════════ 4 · PRACTICE PARTNER REVIEW — hierarchy of the rendered card ══════════════ */
console.log("\n4 · PARTNER REVIEW — same hierarchy, analysis intact (rendered without the Worker)");
const pp = await L.page.evaluate(() => {
  const REV = { id: "rvux1", pairId: "pX", at: Date.now(), tk: "general-english", round: 1, partner: "Dana", review: {
    topic: "Tell me about yourself", summary: "A confident session with two things to tighten.",
    seqs: [1, 3], rounds: [{ seq: 1, pron: 60, grammar: 60, vocab: 60, fluency: 60, task: 60 }, { seq: 3, pron: 70, grammar: 70, vocab: 70, fluency: 70, task: 70 }],
    indicators: { pron: 70, grammar: 68, vocab: 71, fluency: 66, task: 75 },
    well: [{ text: "You opened with your current role.", evidence: "R1" }, { text: "You gave real numbers.", evidence: "R1" }, { text: "Third strength, folded.", evidence: "R3" }],
    improve: [{ text: "Close with your current focus.", evidence: "R3" }, { text: "Second improvement, folded.", evidence: "R1" }],
    task: { objective: "Introduce yourself professionally", components: [{ name: "current role", status: "strong", note: "" }, { name: "core responsibilities", status: "developing", note: "" }], verdict: "Nearly there." },
    fixes: [{ kind: "error", pattern: "since five years", count: 2, said: "I work here since five years", better: "I have worked here for five years", why: "Duration takes for + the present perfect.", practice: "I have worked here for five years." }],
    natural: [{ said: "I am doing the job of analyst", natural: "I work as an analyst", professional: "I am a data analyst" }],
    vocab: { used_well: ["responsible for"], misused: [], must: [{ term: "stakeholder", meaning: "", example: "" }], upgrade: [], next: [], patterns: ["I am responsible for …"] },
    pron: [{ word: "colleague", confidence: "heard", rounds: [1], heard: "col-LEG", target: "KOL-eeg", why: "" }],
    coach: { script: ["Line one.", "Line two.", "Line three."], practice: [{ expected: "Say your role", said: "", say: "I am a logistics analyst.", teach: "" }], model: { answer: "I am a logistics analyst with five years of experience looking after our supplier numbers.", structure: "Present → Past → Future", moves: ["role"] } },
    reused: [], prev: [],
    next: { pron: ["colleague"], vocab: ["stakeholder"], pattern: "I am responsible for …", answer: "", skill: "Close with your current focus" },
    answer: { original: "I work here since five years and I am doing analyst job.", polished: "I have worked here for five years as a logistics analyst.", changed: ["for + the present perfect"] },
  } };
  _ppRevSecs = {};
  const html = ppRevHTML(REV);
  const d = document.createElement("div"); d.innerHTML = html;
  const idx = s => html.indexOf(s);
  return {
    order: [idx("What you did well"), idx("Biggest improvement"), idx("Say it better"), idx("Your next practice"), idx("Voice coach")],
    wellPrim: [...d.querySelectorAll(".pp-rv-sec .pp-rv-line.ok")].length,
    foldTitles: [...d.querySelectorAll(".mv-fold > summary")].map(e => e.textContent.trim()),
    foldsClosed: [...d.querySelectorAll(".mv-fold")].every(x => !x.hasAttribute("open")),
    thirdWellFolded: idx("Third strength, folded.") > idx("Detailed analysis"),
    secondImpFolded: idx("Second improvement, folded.") > idx("Detailed analysis"),
    inds: d.querySelectorAll(".pp-rv-ind").length,
    comps: d.querySelectorAll(".pp-rv-comp").length,
    fixes: d.querySelectorAll(".pp-rv-fix").length,
    coachModel: !!d.querySelector(".pp-rv-coach .pp-rv-model"),
    polished: idx("I have worked here for five years as a logistics analyst.") >= 0,
    original: idx("I work here since five years and I am doing analyst job.") >= 0,
    prevlink: !!d.querySelector(".mv-prevlink"),
    aiTag: !!d.querySelector(".pp-ai-tag"),
  };
});
ok("partner review order: well → biggest improvement → say it better (original + polished) → next practice; voice coach is the FIRST fold",
  pp.order.every(i => i >= 0) && pp.order[0] < pp.order[1] && pp.order[1] < pp.order[2] && pp.order[2] < pp.order[3] && pp.order[3] < pp.order[4] && pp.original && pp.polished, JSON.stringify(pp.order));
ok("partner review keeps ALL the analysis: 2 strengths primary + the 3rd folded, 2nd improvement folded, indicators, components, fixes, coach model, AI tag — folds closed, history link present",
  pp.wellPrim === 2 && pp.thirdWellFolded && pp.secondImpFolded && pp.inds === 5 && pp.comps === 2 && pp.fixes === 1 && pp.coachModel && pp.foldsClosed && pp.prevlink && pp.aiTag, JSON.stringify(pp).slice(0, 500));
ok("partner folds carry the named sections: voice coach, sentence structure & grammar, natural, vocabulary, pronunciation, topic mastery, detailed analysis",
  pp.foldTitles.length === 7 && /Voice coach/i.test(pp.foldTitles[0]) && /Detailed analysis/i.test(pp.foldTitles[6]), JSON.stringify(pp.foldTitles));

await L.ctx.close();
ok("No uncaught page errors", errors.length === 0, errors.join(" | "));

await browser.close();
if (server) server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
