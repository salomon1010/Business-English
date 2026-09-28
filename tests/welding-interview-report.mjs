/* The interviewers' report everywhere it applies (owner, 28 Sep 2026):
   the workshop end, a past attempt, a Welding Road map session day and a
   Welding interview coach all draw the SAME report, in the owner's order —
   1 score, 2 question by question, 3 progress, 4 answer analysis, 5 summary —
   each a fold that opens and closes. General English session days keep
   their speaking report. The Worker is faked in the page: speech-to-text
   returns a fixed answer, the chat route returns a rebuilt answer.
   Run: cd tests && node welding-interview-report.mjs  (or BASE=… ) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
const ROOT = new URL("..", import.meta.url).pathname;
let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", "8799"], { cwd: ROOT, stdio: "ignore" }); await sleep(800); BASE = "http://localhost:8799"; }
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e.message)));
const SAID = "My name is Salomon. I have been working as a welder for three years, mostly MIG on structural steel, and some offshore work on a vessel.";
await ctx.addInitScript((SAID) => {
  localStorage.setItem("be_events_api", "");
  if (!localStorage.getItem("be12_v1")) localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Salomon", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "welding" },
    fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() }));
  window.__calls = [];
  const real = window.fetch.bind(window);
  window.fetch = async (url, opt) => {
    const u = String(url);
    if (/fillers=1/.test(u)) { window.__calls.push("stt"); return new Response(JSON.stringify({ text: SAID }), { status: 200 }); }
    let body = null; try { body = JSON.parse(opt && opt.body || "null") } catch (e) {}
    if (body && body.chat) { window.__calls.push("chat");
      return new Response(JSON.stringify({ reply: "I'm Salomon, a welder with three years' experience. I run MIG and stick on structural steel — beams and brackets — and I have offshore time on a vessel. I'm looking for a team where I can move onto pipe.", covered: [] }), { status: 200 }); }
    if (body && (body.analyze || body.tts)) { window.__calls.push(body.tts ? "tts" : "analyze"); return new Response("{}", { status: 500 }); }
    return real(url, opt);
  };
}, SAID);
await page.goto(BASE + "/index.html?wir=" + Date.now()); await sleep(1200);
const clean = () => page.evaluate(() => document.querySelectorAll(".cf-ov,.wc-ov,.lang-modal-ov,#rmNotice").forEach(e => e.remove()));
await clean();
const folds = sel => page.evaluate(sel => [...document.querySelectorAll(sel + " .wr-fold")].map(f => ({ t: f.querySelector(".wr-t").textContent, n: f.querySelector(".wr-n").textContent, open: f.open })), sel);
const ORDER = ["Your interview score", "Question by question", "Your progress", "Answer analysis", "Today's summary"];

/* 1. the workshop end */
const w = await page.evaluate(async () => {
  const sc = trackSimulations().find(s => !isFirstDayMission(s));
  go("simulation"); await new Promise(r => setTimeout(r, 300));
  simRun = ProfessionalSimulationEngine.start(sc.id); simRun.voiceMeta = { startedAt: Date.now(), mode: "voice-first", turns: 1 };
  simSave(); go("simulation", sc.id); await new Promise(r => setTimeout(r, 300));
  simRecordAnswer(sc, "I'm a welder with six years on structural steel, mostly MIG, and I'm looking to move onto pipe.");
  simComplete(false); await new Promise(r => setTimeout(r, 600));
  return { id: sc.id, started: simRun.startedAt };
});
let f = await folds("#v-simulation");
ok("Workshop end: the five sections in the owner's order, numbered 1–5", JSON.stringify(f.map(x => x.t)) === JSON.stringify(ORDER) && f.map(x => x.n).join("") === "12345", JSON.stringify(f));
ok("Score and Question by question open; Progress, Analysis, Summary closed", f.map(x => x.open).join() === "true,true,false,false,false", JSON.stringify(f.map(x => x.open)));
await page.evaluate(() => { document.querySelector('#v-simulation .wr-fold[data-f="analysis"]').open = true; document.querySelector('#v-simulation .wr-fold[data-f="score"]').open = false; }); await sleep(150);
await page.evaluate(([id, s]) => { simOpenAttempt(id, s); }, [w.id, w.started]); await sleep(400);
f = await folds("#v-simulation");
ok("A past attempt: sections 1–4 in the same order, and what the learner opened or closed is kept", JSON.stringify(f.map(x => x.t)) === JSON.stringify(ORDER.slice(0, 4)) && f.find(x => x.t === "Answer analysis").open && !f.find(x => x.t === "Your interview score").open, JSON.stringify(f));
await page.evaluate(() => { simCloseAttempt(); for (const k in _wrOpen) delete _wrOpen[k]; }); await sleep(200);

/* 2. a Welding Road map session day */
const s = await page.evaluate(async () => {
  S.days[dayKey(1, "Mon")] = true; save();
  go("session", 1, "Tue"); await new Promise(r => setTimeout(r, 500));
  document.querySelectorAll(".cf-ov,.wc-ov,.lang-modal-ov").forEach(e => e.remove());
  const intro = document.querySelector("#sessRep .sess-rep-sub")?.textContent || "";
  const ws = _sessCur.ws;
  await sessReport(_sessCur.key, new Blob([new Uint8Array(9000)], { type: "audio/webm" }), 20);
  for (let i = 0; i < 40 && !(S.notes["wr:" + _sessCur.key] || {}).answers?.[0]?.modelAi; i++) await new Promise(r => setTimeout(r, 100));
  const box = document.getElementById("sessRepWrap");
  return { intro, q: ws && ws.q, sc: ws && ws.sc.id, key: _sessCur.key, rec: S.notes["wr:" + _sessCur.key],
    txt: box.textContent, hear: box.querySelectorAll(".sim-fb-play").length, again: !!box.querySelector('[onclick="sessAgain()"]'), ai: !!box.querySelector(".ex-rep-card"), calls: window.__calls.slice() };
});
f = await folds("#sessRepWrap");
ok("Welding session: the report names who asks and what — the week's workshop question", /Maya/.test(s.intro) && /Tell me about yourself/.test(s.intro) && s.sc === "welding-sim-1" && s.q === "open", JSON.stringify({ intro: s.intro, q: s.q, sc: s.sc }));
ok("Welding session: sections 1–4 in order (no summary on a session day)", JSON.stringify(f.map(x => x.t)) === JSON.stringify(ORDER.slice(0, 4)), JSON.stringify(f));
ok("It is the interviewers' report: score, standards, Hear the feedback, technical words — not the general AI report", /Assessed against/i.test(s.txt) && /ISO|OSHA/.test(s.txt) && s.hear === 1 && /Words to use next time/.test(s.txt) && !s.ai && !s.calls.includes("analyze"), JSON.stringify({ calls: s.calls, hear: s.hear }));
ok("'How you could have said it' is rebuilt from the learner's own answer", s.rec && s.rec.answers[0].modelAi && /How you could have said it/.test(s.txt), JSON.stringify(s.rec && s.rec.answers[0].modelAi));
ok("Stored per session day, Welding-stamped, with the take in the progress line; the button records again", s.rec && s.rec.kind === "session" && s.rec.tk === "welding" && s.rec.hist.length === 1 && s.again, JSON.stringify(s.rec && { kind: s.rec.kind, tk: s.rec.tk, hist: s.rec.hist }));
const s2 = await page.evaluate(async () => { go("journey"); await new Promise(r => setTimeout(r, 200)); go("session", 1, "Tue"); await new Promise(r => setTimeout(r, 600));
  return { folds: document.querySelectorAll("#sessRepWrap .wr-fold").length }; });
ok("Coming back to the day shows the kept report without a new request", s2.folds === 4);

/* 3. a Welding interview coach */
const c = await page.evaluate(async () => {
  const m = trackAiMentors()[0]; go("roleplay", m.id); await new Promise(r => setTimeout(r, 400));
  rpConv = { sc: m, history: [{ role: "assistant", content: m.greet }, { role: "user", content: "x" }], covered: new Set([1, 2]), busy: false, idle: null,
    turns: [{ text: "My name is Salomon, I am a welder." }, { text: "I have three years of experience with MIG on structural steel and I am looking to move onto pipe." }] };
  window.__calls.length = 0; rpSummary();
  for (let i = 0; i < 40 && !document.querySelector("#v-roleplay .sim-ans-model-src"); i++) await new Promise(r => setTimeout(r, 100));
  const el = document.getElementById("v-roleplay");
  return { txt: el.textContent, hear: el.querySelectorAll(".sim-fb-play").length, face: el.querySelector(".sim-fb-who b")?.textContent || "", calls: window.__calls.slice(), again: !!el.querySelector(`[onclick="rpStart('${m.id}')"]`) };
});
f = await folds("#v-roleplay");
ok("Welding coach: the five sections in the owner's order", JSON.stringify(f.map(x => x.t)) === JSON.stringify(ORDER), JSON.stringify(f));
ok("The coach herself gives the feedback, judged against the standards, with technical words", c.face === "Maya" && c.hear === 1 && /Assessed against/i.test(c.txt) && /Words to use next time|You already used/.test(c.txt), JSON.stringify({ face: c.face, hear: c.hear }));
ok("No general AI speaking report is built for the coach; the answer is rebuilt from the learner's words; Try again restarts it", !c.calls.includes("analyze") && c.calls.includes("chat") && c.again, JSON.stringify(c.calls));

/* 4. General English is unchanged */
const g = await page.evaluate(async () => { areaSwitch("general-english", "journey"); await new Promise(r => setTimeout(r, 400));
  go("session", 1, "Mon"); await new Promise(r => setTimeout(r, 500));
  return { ws: !!(_sessCur && _sessCur.ws), sub: document.querySelector("#sessRep .sess-rep-sub")?.textContent || "", report: !!document.getElementById("sessRepWrap") }; });
ok("General English session days keep their speaking report (no line above it since 28 Sep 2026)", !g.ws && !g.sub && g.report, JSON.stringify(g));

ok("No page errors", errors.length === 0, errors.join(" | "));
await browser.close(); if (server) server.kill();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
