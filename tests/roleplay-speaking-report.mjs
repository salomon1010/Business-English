/* BE Mastery — the ROLEPLAY SPEAKING REPORT (interview, negotiation,
   tell-me-about-yourself, life simulations) and the unified history.

   Run:  cd tests && node roleplay-speaking-report.mjs

   What this suite proves: a conversation's report rides the SAME engine as
   the mission's — the mvreport transport, MissionEngine.shapeReport's
   grounding, the same renderer language and voice — with the scenario's
   talking points as the moves and the app's covered set as the scorer's
   verdict. The conversation walk itself (mic → turns → summary) belongs to
   the existing roleplay suites; this one starts at the summary and covers
   everything the new code owns.

   1. ENGINE, in Node: shapeReport grounds a synthetic scenario rubric
      exactly as it grounds a mission's.
   2. BROWSER, real Chromium: the button, the report screen — since 24 Sep
      2026 the Executive Polish report, judged against the conversation and
      read by the character who ran it (rpReport / rpHost) — idempotency,
      offline floor + recovery, sync privacy, the history sections, the
      Welding boundary, no horizontal overflow at 390×844. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const ME = require("../mission-engine.js");

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

/* ══════════════════════ 1 · ENGINE (no browser) ══════════════════════════ */
console.log("\n1 · ENGINE — a scenario rubric grounds exactly like a mission's");
const rt = p => `Next time, work "${p}" into the conversation.`;
const comp = { moves: [{ id: "p1", label: "Greet the interviewer", retry: rt("Greet the interviewer") }, { id: "p2", label: "Describe your current role", retry: rt("Describe your current role") }, { id: "p3", label: "Ask a question of your own", retry: rt("Ask a question of your own") }], expressions: [] };
const ev = { moves: { p1: true, p2: true, p3: false }, covered: ["p1", "p2"], missed: ["p3"], said: "Thank you for meeting me today. I work as logistics analyst since five years." };   /* rpReport puts the turns on ev.said */
const raw = {
  well: [{ move: "p1", note: "A warm, direct opening." }, { move: "p3", note: "INVENTED — the scorer says this never happened." }],
  improve: [{ move: "p2", note: "FORBIDDEN — p2 was covered." }, { move: "p3", note: "End by asking about the team you would join." }],
  better: "Thank you for meeting me today. I have worked as a logistics analyst for five years.",
  expressions: [{ e: "could I ask", why: "turns a statement into a question" }],
  one: "Always leave with one question of your own.",
};
const rep = ME.shapeReport(raw, comp, ev);
ok("praise for an uncovered point is dropped, praise for a covered one stays", rep.well.length === 1 && rep.well[0].move === "p1");
ok("a correction for a covered point is dropped; the missed point keeps the AI's sentence", rep.improve.length === 1 && rep.improve[0].move === "p3" && /asking about the team/.test(rep.improve[0].note));
ok("better version, expressions and the one-thing survive", /logistics analyst/.test(rep.better) && rep.expr.length === 1 && /question of your own/i.test(rep.one) && rep.ai === true);
const floor = ME.shapeReport(null, comp, { moves: { p1: true, p2: false, p3: false }, covered: ["p1"], missed: ["p2", "p3"] });
ok("the offline floor names the missed points and still sets one focus", floor.improve.length === 2 && floor.improve[0].move && floor.one.length > 0 && floor.ai === false);
const ev2 = { moves: { p1: true, p2: true, p3: false }, covered: ["p1", "p2"], missed: ["p3"] };
ME.applyCoachMoves(ev2, comp, ["p3"]);
ok("a point the model covered AND praised is kept", ME.shapeReport({ well: [{ move: "p3", note: "You asked in your own words." }] }, comp, ev2).well.length === 1);

/* ══════════════════════ 2 · BROWSER ══════════════════════════════════════ */
console.log("\n2 · BROWSER — the summary's report, the history, the boundary");
let BASE = process.env.BASE, server = null;
const root = new URL("..", import.meta.url).pathname;
const mine = readFileSync(new URL("../index.html", import.meta.url), "utf8");
if (!BASE) {
  for (const port of [8931, 8932, 8933, 8934]) {
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
const browser = await chromium.launch();
const errors = [];
let repMode = "ok", repHits = 0, lastReportBody = null, analyseHits = 0, analyseCtx = null;
/* the Executive Polish half: what the analyse route answers */
const AI = { key_message: "I am a logistics analyst with five years of supplier data behind me.", clarity: "clear",
  sharper: "I am the logistics analyst who keeps the weekly delivery reports honest.",
  level: "B1+", level_note: "Clear sentences; the link to why the role matters is missing.",
  structure: ["Role", "Responsibility", "Right now"], structure_note: "The order works.",
  answer_directly: "Open with the role, then say who it is for.", example: "I am a logistics analyst in retail.",
  evidence: "You named the role but not who reads your reports.", credibility: "Five years is a fact — lead with it.",
  hedges: [], corrections: [{ said: "since five years", fix: "for five years", why: "A length of time takes 'for'.", kind: "preposition" }],
  sentences: [], words: [], collocations: [], remember_title: "Say who it is for", remember_body: "Name the reader of your work.",
  next_recording: "Answer the same opening question again and say who your reports are for.",
  quick_win_title: "Lead with the role", quick_win_goal: "Role first, then the years.",
  concept_title: "Role before detail", concept_body: "Listeners need the role first.",
  coach_script: "Thanks for that. You named your role clearly. Next time, tell me who reads your reports and why they matter.",
  versions: [{ style: "Clear and direct", text: "I am a logistics analyst. For five years I have looked after our supplier data.", learn: ["looked after"] }],
  idioms: [] };

async function learner(id, track) {
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx2.addInitScript(({ track }) => {
    try { localStorage.setItem("be_missions", "1"); } catch (e) {} /* V2 missions are hidden in production — on for this suite (the unified history door) */
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
    if (b.analyse) { analyseHits++; analyseCtx = b.analyse.context || null; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(AI) }); }
    if (b.mvreport) {
      repHits++; lastReportBody = b.mvreport;
      /* the model tries a violation on purpose: praise for the uncovered p3 */
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        covered: [],
        well: [{ move: "p1", note: "A warm, direct opening." }, { move: "p3", note: "INVENTED PRAISE — must be dropped." }],
        improve: [{ move: "p3", note: "End by asking about the team you would join." }],
        better: "Thank you for meeting me today. I have worked as a logistics analyst for five years.",
        expressions: [{ e: "could I ask", why: "turns a statement into a question" }],
        one: "Always leave with one question of your own.",
      }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  const page = await ctx2.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?rprep=" + Date.now(), { waitUntil: "load" });
  await sleep(900);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx: ctx2, page, id };
}

/* a finished conversation, exactly as rpSummary leaves it */
const seedConvo = (page, ts, coveredIdx) => page.evaluate(({ ts, coveredIdx }) => {
  const sc = SCENARIOS.find(s => s.id === "interview");
  _rpLastTs = ts;
  _rpLast = { sc, turns: [{ text: "Thank you for meeting me today." }, { text: "I work as logistics analyst since five years." }], covered: new Set(coveredIdx) };
  S.convos = S.convos || [];
  S.convos.push({ ts, id: sc.id, title: sc.title, cat: sc.cat, tk: areaId(), covered: coveredIdx.length, total: sc.points.length, turns: 2, lines: _rpLast.turns.map(x => ({ text: x.text })) });
  save();
  return { points: sc.points.length, btn: rpRepBtnHTML() };
}, { ts, coveredIdx });

const A = await learner("A", "general-english");
const T1 = Date.now();
const seeded = await seedConvo(A.page, T1, [1, 2]);
ok("the summary offers the Speaking report button on General English", /rpReport\(\)/.test(seeded.btn) && /Speaking report/.test(seeded.btn));
const summ = await A.page.evaluate(() => { rpReplaySummary(); const el = document.getElementById("v-roleplay"); return { gold: !!el.querySelector(".btn-gold"), evalBtn: /rpEvaluate/.test(el.innerHTML), report: /rpReport\(\)/.test(el.innerHTML) }; });
ok("the summary no longer offers Evaluate your conversation — only the Speaking report", !summ.gold && !summ.evalBtn && summ.report, JSON.stringify(summ));

const promptTxt = await A.page.evaluate(() => { const sc = SCENARIOS.find(s => s.id === "interview"); const c = rpRepComp(sc); return rpRepPrompt(sc, c, rpRepEv(sc, new Set([1, 2]))); });
ok("the prompt carries the scorer's verdict for the conversation", /Covered: p1/.test(promptTxt) && /Not heard: p3/.test(promptTxt) && promptTxt.includes("p" + seeded.points) === /Not heard:.*p3/.test(promptTxt));
ok("the prompt keeps the house rules: verdict final, no scores, no accent, additions only, learner's facts", /verdict is final/i.test(promptTxt) && /No scores/.test(promptTxt) && /accent/.test(promptTxt) && /Only additions/.test(promptTxt) && /Never add facts/.test(promptTxt));

await A.page.evaluate(() => rpReport());
await sleep(600);
let st = await A.page.evaluate(ts => { const c = S.convos.find(x => x.ts === ts); return { rep: c && c.rep, html: document.getElementById("v-roleplay").textContent }; }, T1);
ok("one call writes the report onto the conversation's own entry, AI-flagged", st.rep && st.rep.ai === true && repHits === 1);
ok("the invented praise for the uncovered point was dropped; the true praise stays", st.rep.well.length === 1 && st.rep.well[0].m === "p1");
const scr = await A.page.evaluate(() => { const sc = _rpLast.sc, el = document.getElementById("v-roleplay"), key = rpRepKey(sc), rep = sessRepGet(key);
  const btns = [...el.querySelectorAll("button")].map(b => b.getAttribute("onclick") || "");
  return { wrap: !!el.querySelector("#rpRepWrap .ex-rep-card"), coach: (el.querySelector("#rpRepWrap #exCoachScript") || {}).textContent || "",
    sharper: /keeps the weekly delivery reports honest/.test(el.textContent), again: btns.some(s => /exAgainGo/.test(s)), hear: btns.some(s => /exSay\(/.test(s)), fbSay: btns.some(s => /fbSay\(/.test(s)),
    oldSheet: /What you did well|Biggest improvement|Say it better/.test(el.textContent), p3: /\bp3\b/.test(el.textContent),
    host: exHost && { wrap: exHost.wrapId, voice: exHost.voice, gender: exHost.gender, style: exHost.style },
    want: { voice: ttsVoice(rpVoiceFor(sc), sc.g), gender: sc.g, persona: sc.persona },
    stored: !!rep, kind: rep && rep.kind, tx: rep && rep.tx }; });
ok("the screen hosts the Executive Polish report — card, coach briefing, sharper version, Hear it, Say it again — not the old sheet",
  scr.wrap && /tell me who reads your reports/.test(scr.coach) && scr.sharper && scr.again && scr.hear && !scr.fbSay && !scr.oldSheet && !scr.p3, JSON.stringify(scr));
ok("the report is read by the character who ran the conversation: the host carries their voice, gender and name",
  scr.host && scr.host.wrap === "rpRepWrap" && scr.host.voice === scr.want.voice && scr.host.gender === scr.want.gender && scr.host.style.includes(scr.want.persona), JSON.stringify({ host: scr.host, want: scr.want }));
ok("the coach was asked to judge THIS conversation: the scenario, the character and its talking points as the task",
  analyseHits === 1 && analyseCtx && analyseCtx.track === "general" && /Job interview/.test(analyseCtx.focus) && /Mr Bello/.test(analyseCtx.focus) && /Introduce yourself/.test(analyseCtx.out) && /tell me a little about yourself/.test(analyseCtx.task), JSON.stringify(analyseCtx));
ok("one report per conversation, kept with the session reports, tagged as a conversation, built from the learner's turns", scr.stored && scr.kind === "conversation" && /logistics analyst/.test(scr.tx), JSON.stringify({ stored: scr.stored, kind: scr.kind }));
ok("the learner's turns were sent, nothing else was", lastReportBody && /logistics analyst/.test(lastReportBody.said) && !/localStorage|profile/.test(lastReportBody.said));

await A.page.evaluate(() => rpReport());
await sleep(300);
ok("a second tap re-opens the stored report, no second model call on either route", repHits === 1 && analyseHits === 1 && await A.page.evaluate(() => !!document.querySelector("#rpRepWrap .ex-rep-card")));

const overflow = await A.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok("the report screen fits a 390 px phone with no horizontal scroll", !overflow);

const payload = await A.page.evaluate(ts => { const p = fbSyncPayload(S); return { synced: p.convos.find(x => x.ts === ts), local: S.convos.find(x => x.ts === ts) }; }, T1);
ok("sync privacy: the better version stays on the device, the rest of the report travels", payload.synced.rep.better === null && payload.local.rep.better && payload.synced.rep.one === payload.local.rep.one);

/* offline: the floor is stored, said so, and can be finished later */
repMode = "abort";
const T2 = T1 + 1111;
await seedConvo(A.page, T2, [1]);
await A.page.evaluate(() => rpReport());
await sleep(500);
st = await A.page.evaluate(ts => { const c = S.convos.find(x => x.ts === ts); return { rep: c && c.rep, html: document.getElementById("v-roleplay").textContent }; }, T2);
ok("a failed AI pass still leaves the honest deterministic floor on the entry", st.rep && st.rep.ai === false && st.rep.fix.length >= 1);
const off = await A.page.evaluate(() => ({ card: !!document.querySelector("#rpRepWrap .ex-rep-card"), retry: /rpReport\(\)/.test((document.querySelector("#rpRepWrap .sess-rep-newer") || {}).innerHTML || ""), stored: !!sessRepGet(rpRepKey(_rpLast.sc)) }));
ok("with the coach unreachable the screen shows the numbers, offers to send again and keeps no numbers-only report", off.card && off.retry && !off.stored, JSON.stringify(off));
repMode = "ok";
await A.page.evaluate(() => rpReport());
await sleep(600);
st = await A.page.evaluate(ts => ({ rep: (S.convos.find(x => x.ts === ts) || {}).rep, stored: !!sessRepGet(rpRepKey(_rpLast.sc)) }), T2);
ok("sending again upgrades the SAME entry to the AI report and stores the spoken report", st.rep && st.rep.ai === true && repHits === 2 && st.stored && analyseHits === 2);

/* the scenario's own history carries the report (owner, 24 Sep 2026) */
const hs = await A.page.evaluate(ts => {
  const c = S.convos.find(x => x.ts === ts), key = c && c.exrep;
  rpHistory("interview");
  const el = document.getElementById("v-roleplay");
  const row = el.querySelector("#rph_" + ts);
  const btns = [...(row ? row.querySelectorAll("button") : [])].map(b => b.getAttribute("onclick") || "");
  return { linked: !!key && !!sessRepGet(key), rows: el.querySelectorAll(".rp-hist-row").length,
    level: /B1\+/.test((el.querySelector(".rp-hist-sc") || {}).textContent || ""),
    coach: /tell me who reads your reports/.test(row ? row.textContent : ""), sharper: /keeps the weekly delivery reports honest/.test(row ? row.textContent : ""),
    open: btns.some(s => /rpHistReport\(/.test(s)), hear: btns.some(s => /rpHistSay\(/.test(s)), unscored: /Not evaluated/.test(el.textContent) };
}, T1);
ok("the scenario's history links every session to its report and shows it inside the row: level, the coach's words, the sharper version, Open, Hear it",
  hs.linked && hs.rows >= 2 && hs.level && hs.coach && hs.sharper && hs.open && hs.hear && !hs.unscored, JSON.stringify(hs));
const hr = await A.page.evaluate(ts => { rpHistReport(ts); const sc = _rpLast.sc; return { card: !!document.querySelector("#rpRepWrap .ex-rep-card"), back: /rpHistory\('interview'\)/.test(document.querySelector("#v-roleplay .back").getAttribute("onclick") || ""), voice: !!(exHost && exHost.voice === ttsVoice(rpVoiceFor(sc), sc.g) && exHost.gender === sc.g) }; }, T1);
ok("Open the full report from the history draws the whole report, read in the character's voice, with a way back to the history", hr.card && hr.back && hr.voice, JSON.stringify(hr));
const hd = await A.page.evaluate(ts => { const key = S.convos.find(x => x.ts === ts).exrep; rpHistory("interview"); rpHistDelete(ts, "interview"); return { gone: !S.convos.some(x => x.ts === ts), note: !!S.notes["exrep:" + key] }; }, T2);
ok("deleting a session from the history deletes its report with it", hd.gone && !hd.note, JSON.stringify(hd));

/* the unified history */
await A.page.evaluate(() => { S.ppRev = [{ id: "rv1", pairId: "p1", at: Date.now(), tk: "general-english", topic: "Raise a problem", review: { topic: "Raise a problem" } }]; save(); go("mvhist"); });
await sleep(400);
const hist = await A.page.evaluate(() => document.getElementById("v-mvhist").textContent);
ok("the history lists the conversations with their reports", /Conversations/.test(hist) && /Job interview/.test(hist) && /question of your own/i.test(hist));
ok("the history lists the Practice Partner reviews, read-only", /Practice Partner reviews/.test(hist) && /Raise a problem/.test(hist));
await A.ctx.close();

/* the Welding boundary */
const W = await learner("W", "welding");
const w = await W.page.evaluate(() => {
  const before = JSON.stringify(S.convos || []);
  const sc = SCENARIOS.find(s => s.id === "interview");
  _rpLastTs = Date.now(); _rpLast = { sc, turns: [{ text: "hello there my friend" }], covered: new Set([1]) };
  const btn = rpRepBtnHTML();
  const p = rpReport();
  return { btn, wrote: JSON.stringify(S.convos || []) !== before, area: areaId() };
});
ok("Welding: no button, no report, nothing written", w.area === "welding" && w.btn === "" && !w.wrote);
const wh = await W.page.evaluate(async () => { go("mvhist"); await new Promise(r => setTimeout(r, 300)); return cur.v; });
ok("Welding: the history door itself stays shut (sent home)", wh !== "mvhist");
await W.ctx.close();

ok("no uncaught page errors in any context", errors.length === 0, errors.join(" | "));

await browser.close();
if (server) server.kill();
const fail = res.filter(x => !x.pass).length;
console.log(`\n${res.length}/${res.length - fail === res.length ? res.length : res.length} checks, ${fail} failing`);
process.exit(fail ? 1 : 0);
