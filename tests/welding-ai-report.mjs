/* Welding: the AI speaking report on the Shadow workplace lines (owner, 28 Sep
   2026). The lines used to draw word chips with a percentage; they now host
   the Road map session's report ("How you came across", the level, Play coach
   feedback, the five steps), judged against the line's question, the person
   asking and the model answer. The end of a workshop conversation keeps the
   interviewers' report (score, answer analysis, question by question) —
   sections 9–10 hold it there.
   Run: cd tests && node welding-ai-report.mjs
        (or BASE=http://localhost:8011 node welding-ai-report.mjs)

   The Worker is a fixture: STT returns a fixed transcript, analyse returns a
   fixed report and records the context it was sent. Chromium's fake
   microphone drives the real MediaRecorder path on the lines. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
const ROOT = new URL("..", import.meta.url).pathname;
let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", "8797"], { cwd: ROOT, stdio: "ignore" }); await sleep(800); BASE = "http://localhost:8797"; }
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"],
  serviceWorkers: /^https:/.test(BASE) ? "block" : "allow" });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e.message)));
await ctx.addInitScript(() => {
  try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {}
  localStorage.setItem("be_events_api", "");
  if (!localStorage.getItem("be12_v1")) {
    const st = { profile: { name: "Wendy", role: "", goal: "", slot: "", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "welding" },
      fnd: { "general-english": { placed: "full", finished: true }, "welding": { placed: "full", finished: true } },
      days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() };
    localStorage.setItem("be12_v1", JSON.stringify(st));
  }
});

const AI = { key_message: "I am a welder with six years on structural steel.", clarity: "clear",
  sharper: "I'm a welder with six years on structural steel, and I want to move onto pipe.",
  level: "B1", level_note: "Short sentences, some repeated words.",
  structure: ["Who I am", "What I weld", "What I want next"], structure_note: "The order works.",
  answer_directly: "Say your trade and years first.", example: "I'm a welder with six years' experience.",
  evidence: "You answered Maya's question and named MIG and stick.", credibility: "Clear and steady.",
  hedges: [], corrections: [{ said: "i am welder", fix: "I am a welder", why: "A job takes 'a'.", kind: "article" }],
  sentences: [{ said: "i am welder six years", rebuilt: "I'm a welder with six years' experience.", pattern: "I'm a [job] with [n] years' experience.", pattern_use: "Introducing yourself." }],
  words: [{ said: "do", better: "carry out", meaning: "Perform.", example: "I carry out fit-up." }],
  collocations: [], remember_title: "Trade first", remember_body: "Name the trade before the detail.",
  next_recording: "Answer Maya again, naming your processes.", quick_win_title: "Add 'a'", quick_win_goal: "No missing articles.",
  concept_title: "Articles with jobs", concept_body: "A job takes 'a' or 'an'.",
  coach_script: "You told Maya who you are. Say 'I am a welder', with 'a'. Next time name your processes first.",
  versions: [{ style: "Clear", text: "I'm a welder with six years' experience on structural steel.", learn: ["structural steel"] },
    { style: "Site-ready", text: "Six years on the tools, mostly MIG and stick on structural steel.", learn: ["on the tools"] }],
  idioms: [] };
const calls = [];
const API = "https://be-polish.nore-ngou.workers.dev";
const CORS = { "access-control-allow-origin": "*" };
await ctx.route(u => u.href.startsWith(API), async route => {
  const rq = route.request(), url = rq.url();
  if (rq.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...CORS, "access-control-allow-headers": "*" } });
  if (url.includes("fillers=1")) { calls.push({ kind: "stt" }); return route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify({ text: "i am welder six years i do mig and stick on structural steel and i want to move on pipe", words: null }) }); }
  let body = {}; try { body = JSON.parse(rq.postData() || "{}"); } catch (e) {}
  if (body.analyse) { calls.push({ kind: "analyse", ctx: body.analyse.context || null, tx: body.analyse.transcript }); return route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(AI) }); }
  if (body.chat) { calls.push({ kind: "chat" }); return route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify({ reply: "{}" }) }); }
  if (body.tts || body.speak) return route.fulfill({ status: 404, headers: CORS, body: "" });
  /* any other audio post (the workshop's turn transcription) */
  calls.push({ kind: "audio" });
  return route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify({ text: "i am welder six years", words: null }) });
});
const analyses = () => calls.filter(c => c.kind === "analyse");

await page.goto(BASE + "/index.html?wr=" + Date.now() + "#shadow", { waitUntil: "load" });
await sleep(900);
await page.evaluate(() => { try { wcClose(); } catch (e) {} document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });

/* ---------- 1. the Welding Shadow page ---------- */
await page.evaluate(() => go("shadow")); await sleep(700);
const a = await page.evaluate(() => {
  const btn = document.querySelector(".sh-line-rec"), id = btn && btn.id.slice(4);
  return { area: areaId(), id, lines: document.querySelectorAll(".sh-line").length, wrap: !!(id && document.getElementById("shrep-" + id)),
    desc: document.querySelector(".sh-lines-fb")?.textContent || "", sub: document.querySelector("#v-shadow .sub, #v-shadow .sub-info")?.textContent || "",
    old: document.querySelectorAll(".sh-line-report,.fb-pw,.sh-line-score").length };
});
ok("Welding Shadow: workplace lines render, each with its own report wrap and no word-chip report", a.area === "welding" && a.lines >= 2 && a.id && a.wrap && a.old === 0, JSON.stringify(a));
ok("The lines' header says the AI coach judges the answer, not that every word is scored", /AI coach/.test(a.desc) && !/Every word is scored/.test(a.desc), a.desc);
const ID = a.id;

/* ---------- 2. record a line for real ---------- */
await page.evaluate(id => document.getElementById("shr-" + id).click(), ID);
const recOn = await page.waitForFunction(id => document.getElementById("shr-" + id).classList.contains("rec"), ID, { timeout: 8000 }).then(() => true, () => false);
await sleep(3800);
await page.evaluate(id => document.getElementById("shr-" + id).click(), ID);
const drawn = await page.waitForFunction(id => !!document.querySelector("#" + CSS.escape("shrep-" + id) + " .ex-rep-card"), ID, { timeout: 15000 }).then(() => true, () => false);
const b = await page.evaluate(id => {
  const w = document.getElementById("shrep-" + id), q = s => w.querySelector(s), rep = S.notes["exrep:shl:" + id];
  return { card: !!q(".ex-rep-card"), open: q(".ex-rep-card")?.open, head: q(".ex-rep-sum b")?.textContent || "", stations: w.querySelectorAll(".ex-station").length,
    coach: !!q("#exCoachBtn"), level: q(".ex-level-b")?.textContent || "", again: !!q(".ex-againbtn"), audio: !!q("audio.ex-audio"),
    chips: document.getElementById("shfb-" + id).querySelectorAll(".fb-pw,.sh-line-score,.sh-line-report").length,
    stored: !!(rep && rep.ai && rep.m && rep.tx), kind: rep && rep.kind, tk: rep && rep.tk, ctx: rep && rep.ctx,
    line: shWorkplaceLines().find(x => x.id === id), takes: 0, practiced: (S.dates || []).length };
}, ID);
ok("Say it yourself → Stop and check records a real take and the AI report is drawn under that line", recOn && drawn && b.card && b.open && b.stations === 5 && b.coach && b.level === "B1" && b.again, JSON.stringify({ recOn, drawn, ...b, line: undefined, ctx: undefined }));
ok("The report is the session's: 'How you came across', the take to hear back, and no word chips or percentage", /came across/i.test(b.head) && b.audio && b.chips === 0, JSON.stringify({ head: b.head, audio: b.audio, chips: b.chips }));
ok("It is stored once for this line, Welding-stamped, kind 'shadowline', with the context it was judged against", b.stored && b.kind === "shadowline" && b.tk === "welding" && b.ctx && b.ctx.track === "welding", JSON.stringify({ kind: b.kind, tk: b.tk, ctx: b.ctx }));
const an1 = analyses()[0], L = b.line;
ok("The Worker is told where the learner is: shadowing, who asked (name and role), the question, the model answer and the words to carry",
  an1 && an1.ctx && an1.ctx.track === "welding" && /Shadowing a workplace line/.test(an1.ctx.focus) && an1.ctx.focus.includes(L.scenario.slice(0, 20))
  && an1.ctx.task.includes(L.who) && (!L.role || an1.ctx.task.includes(L.role)) && an1.ctx.task.includes(L.ask.slice(0, 30)) && an1.ctx.task.includes(L.text.slice(0, 30))
  && an1.ctx.task.length <= 300 && an1.ctx.focus.length <= 160 && an1.ctx.out.length <= 200
  && JSON.stringify(an1.ctx.phrases) === JSON.stringify((L.vocab || []).slice(0, 6)), JSON.stringify({ ctx: an1 && an1.ctx, line: L }));
ok("The practice counts: the day is marked practised", b.practiced >= 1, String(b.practiced));

/* ---------- 3. the coach speaks from THIS line's report ---------- */
const c = await page.evaluate(async id => { const w = document.getElementById("shrep-" + id); w.querySelector("#exCoachBtn").click(); await new Promise(r => setTimeout(r, 250));
  const on = w.querySelector("#exCoachBtn").classList.contains("on"); exCoachStop(); await new Promise(r => setTimeout(r, 100));
  return { on, off: !w.querySelector("#exCoachBtn").classList.contains("on"), lines: w.querySelectorAll("#exCoachScript p").length }; }, ID);
ok("Play coach feedback starts and stops on the line's own report", c.on && c.off && c.lines >= 2, JSON.stringify(c));
const g = await page.evaluate(async id => { document.querySelector("#" + CSS.escape("shrep-" + id) + " .ex-againbtn").click(); await new Promise(r => setTimeout(r, 200)); return document.getElementById("shr-" + id).classList.contains("exd-ring"); }, ID);
ok("Say it again brings the learner back to that line's Say it yourself button", g);

/* ---------- 4. leave and come back ---------- */
await page.evaluate(() => go("home")); await sleep(300);
const hostAway = await page.evaluate(() => exHost);
await page.evaluate(() => go("shadow")); await sleep(900);
const d = await page.evaluate(id => { const card = document.querySelector("#" + CSS.escape("shrep-" + id) + " .ex-rep-card"); return { card: !!card, open: card && card.open, host: exHost }; }, ID);
ok("Leaving clears the host; coming back restores the report, closed, with no new request", hostAway === null && d.card && d.open === false && d.host === null && analyses().length === 1, JSON.stringify({ hostAway, d, n: analyses().length }));

/* ---------- 5. a second line: its own report; touching a report makes it the host ---------- */
const ID2 = await page.evaluate(id => shWorkplaceLines().map(x => x.id).find(x => x !== id && document.getElementById("shrep-" + x)), ID);
await page.evaluate(async id => { await shLineReport(id, new Blob([new Uint8Array(9000)], { type: "audio/webm" }), 12); }, ID2);
await sleep(300);
const e = await page.evaluate(([a, b]) => {
  const one = document.getElementById("shrep-" + a), two = document.getElementById("shrep-" + b);
  const before = exHost && exHost.wrapId;
  one.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  const after = exHost && exHost.wrapId, rep = exHost && exHost.report === S.notes["exrep:shl:" + a];
  return { two: !!two.querySelector(".ex-rep-card"), one: !!one.querySelector(".ex-rep-card"), before, after, rep,
    keys: Object.keys(S.notes).filter(k => k.startsWith("exrep:shl:")).length };
}, [ID, ID2]);
ok("A second line gets its own report; touching the first report makes it the host for its buttons", e.two && e.one && e.before === "shrep-" + ID2 && e.after === "shrep-" + ID && e.rep && e.keys === 2, JSON.stringify(e));
const an2 = analyses()[1], L2 = await page.evaluate(id => shWorkplaceLines().find(x => x.id === id), ID2);
ok("The second line is judged against ITS question and person, not the first one's", an2 && an2.ctx.task.includes(L2.ask.slice(0, 30)) && an2.ctx.task.includes(L2.who), JSON.stringify({ ctx: an2 && an2.ctx, who: L2.who }));

/* ---------- 6. a line practised before the AI report: its takes are offered the report ---------- */
const ID3 = await page.evaluate(ids => shWorkplaceLines().map(x => x.id).find(x => ids.indexOf(x) < 0 && document.getElementById("shrep-" + x)), [ID, ID2]);
await page.evaluate(async id => { await addRec(shLineCtx(id), "old take", new Blob([new Uint8Array(9000)], { type: "audio/webm" }), Date.now() - 86400e3); go("home"); }, ID3);
await sleep(200); await page.evaluate(() => go("shadow")); await sleep(1000);
const f = await page.evaluate(id => ({ btn: !!document.querySelector("#" + CSS.escape("shrep-" + id) + " .sess-rep-btn"), card: !!document.querySelector("#" + CSS.escape("shrep-" + id) + " .ex-rep-card") }), ID3);
ok("A line with an older take and no report shows Get my report (not the old word chips)", f.btn && !f.card, JSON.stringify(f));

/* ---------- 7. short take / offline ---------- */
const s1 = await page.evaluate(async id => { await shLineReport(id, new Blob([new Uint8Array(9000)], { type: "audio/webm" }), 1.5); return document.querySelector("#" + CSS.escape("shrep-" + id) + " .ex-note")?.textContent || ""; }, ID3);
ok("A take under three seconds gets a plain note, not a report", /at least 3 seconds/.test(s1), s1);

/* ---------- 8. sync keeps the report, not the transcript ---------- */
const h = await page.evaluate(id => { const p = fbSyncPayload(S), k = "exrep:shl:" + id; return { sent: !!(p.notes[k] && p.notes[k].ai), tx: p.notes[k] && p.notes[k].tx, local: !!S.notes[k].tx }; }, ID);
ok("The line's report syncs with the notes; the words spoken stay on the device", h.sent && h.tx === undefined && h.local, JSON.stringify(h));

/* ---------- 9. a workshop conversation ends on the interviewers' report ----------
   Owner, 28 Sep 2026 (the same day, reversed): the end of a workshop is the
   earlier report — the interview score, the answer analysis against the trade
   standards, and question by question with each interviewer's own feedback —
   not the AI speaking report. No request goes to the coach for it. */
const nA = analyses().length;
const sim = await page.evaluate(async () => {
  const sc = trackSimulations().find(s => !isFirstDayMission(s)) || trackSimulations()[0];
  go("simulation"); await new Promise(r => setTimeout(r, 300));
  simRun = ProfessionalSimulationEngine.start(sc.id);
  const who = simRun.messages[0].characterId;
  simRun.voiceMeta = { startedAt: Date.now(), mode: "voice-first", turns: 1 };
  simRun.messages.push({ role: "learner", text: "i am welder six years" });
  simRun.answers = [{ q: "open", characterId: who, said: "i am welder six years", answered: true, covered: [], missed: [], vocabUsed: [], vocabMissed: [], coverage: 0.5 }];
  simSave(); go("simulation", sc.id); await new Promise(r => setTimeout(r, 300));
  simComplete(false); await new Promise(r => setTimeout(r, 600));
  const el = document.getElementById("v-simulation");
  return { id: sc.id, started: simRun.startedAt, txt: el.textContent,
    score: !!el.querySelector(".sim-score"), fb: el.querySelectorAll(".sim-fb-play").length,
    ai: !!el.querySelector("#simRepWrap,.ex-rep-card"), attempts: simAttempts(sc.id).length };
});
ok("The end of a workshop is the interviewers' report: score, answer analysis, a Hear the feedback per question — no AI speaking report",
  sim.score && /Your interview score/.test(sim.txt) && /What you said, and what a competent answer needs/.test(sim.txt) && sim.fb >= 1 && !sim.ai && !/Speaking report/.test(sim.txt),
  JSON.stringify({ ...sim, txt: sim.txt.slice(0, 200) }));
ok("No request goes to the AI coach for it; the attempt is recorded", analyses().length === nA && sim.attempts >= 1, JSON.stringify({ n: analyses().length, nA, a: sim.attempts }));

/* ---------- 10. the attempt from "Your previous reports" ---------- */
const p = await page.evaluate(async ([id, started]) => { simOpenAttempt(id, started); await new Promise(r => setTimeout(r, 500));
  const el = document.getElementById("v-simulation"); return { fb: el.querySelectorAll(".sim-fb-play").length, ai: !!el.querySelector("#simRepWrap,.ex-rep-card"), txt: /What you said, and what a competent answer needs/.test(el.textContent) }; }, [sim.id, sim.started]);
ok("Opening that attempt from the history shows the same question-by-question report, with no new request", p.fb >= 1 && p.txt && !p.ai && analyses().length === nA, JSON.stringify(p));
await page.evaluate(() => simCloseAttempt()); await sleep(200);

await page.evaluate(() => go("practice")); await sleep(200);
ok("Leaving the workshop clears the host", await page.evaluate(() => exHost === null));
ok("No page errors", errors.length === 0, errors.join(" | "));
await browser.close(); if (server) server.kill();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
