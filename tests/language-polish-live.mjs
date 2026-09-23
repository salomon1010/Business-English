/* BE Mastery — LANGUAGE POLISH against the REAL model. Not part of npm test.

   Run:  cd backend && npx wrangler dev --remote --port 8796     (a preview of
         THIS branch's be-polish, with the Worker's own secret; deploys nothing)
         cd tests && POLISH_PREVIEW=http://localhost:8796 node language-polish-live.mjs

   The app's calls to the production be-polish URL are proxied to the preview,
   so production is never asked for anything and the branch's Worker shape is
   the one under test. The learner's WORDS are typed, not spoken — the
   microphone and the transcription are the only steps skipped. Everything
   after the transcript is real: the mission scorer, the roleplay character's
   replies and the app's point coverage, and the speaking report.

   This prints the reports for a human to read. Its checks are structural;
   whether the polish is GOOD English is a judgement for the reader. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";

const PREVIEW = process.env.POLISH_PREVIEW;
if (!PREVIEW) { console.log("SKIP — set POLISH_PREVIEW to a be-polish preview URL (see the header)."); process.exit(0); }
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

const root = new URL("..", import.meta.url).pathname;
const mine = readFileSync(root + "index.html", "utf8");
let BASE = null, server = null;
for (const port of [8061, 8062, 8063]) {
  const s = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  await sleep(700);
  let served = null;
  try { served = await (await fetch(`http://127.0.0.1:${port}/index.html`)).text(); } catch (e) {}
  if (served && served.length === mine.length) { server = s; BASE = `http://127.0.0.1:${port}`; break; }
  s.kill();
}
if (!BASE) { console.error("no free port"); process.exit(1); }
const POLISH = "https://be-polish.nore-ngou.workers.dev";
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [], calls = { mvreport: 0, chat: 0, other: 0 };

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
await ctx.addInitScript(() => {
  class F {
    _fire() { const txt = window.__say || ""; if (txt && this.onresult) { const r = [{ 0: { transcript: txt, confidence: 0.9 }, isFinal: true, length: 1 }]; r.length = 1; try { this.onresult({ results: r, resultIndex: 0 }); } catch (e) {} } }
    _end() { this._on = false; clearTimeout(this._t); if (this.onend) setTimeout(() => { try { this.onend(); } catch (e) {} }, 0); }
    start() { this._on = true; this._t = setTimeout(() => { if (this._on) { this._fire(); this._end(); } }, 120); }
    stop() { if (this._on) this._fire(); this._end(); }
    abort() { this._on = false; this._end(); }
  }
  window.SpeechRecognition = F; window.webkitSpeechRecognition = F;
  if (!localStorage.getItem("be12_v1")) localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Awa", role: "", goal: "Speak with confidence at work", slot: "", lang: "fr", ts: Date.now() },
    professionalTracks: { activeId: "general-english" },
    fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
    days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() }));
});
/* proxy: production URL → the branch preview. Speech synthesis and the
   pronunciation grader are answered empty — they are not under test and
   would only spend money. */
await ctx.route(u => u.href.startsWith(POLISH), async route => {
  const req = route.request();
  let b = {}; try { b = JSON.parse(req.postData() || "{}"); } catch (e) {}
  if (b.mvreport) calls.mvreport++; else if (b.messages || b.chat) calls.chat++; else { calls.other++; return route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); }
  const r = await fetch(PREVIEW + new URL(req.url()).pathname, { method: req.method(), headers: { "content-type": "application/json", origin: "http://localhost:8000" }, body: req.postData() });
  return route.fulfill({ status: r.status, contentType: r.headers.get("content-type") || "application/json", body: await r.text() });
});
const page = await ctx.newPage();
page.on("pageerror", e => errors.push(e.message));
await page.goto(BASE + "/index.html?live=" + Date.now(), { waitUntil: "load" });
await sleep(1200);
await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()); try { setLang("en"); } catch (e) {} });
await sleep(400);

const speak = async text => {
  await page.evaluate(t => { window.__say = t; }, text);
  await page.evaluate(() => mvRecord());
  await page.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
  await sleep(1500);
  await page.evaluate(() => mvRecord());
  await page.waitForFunction(() => _mv && !_mv.busy && (_mv.ev || _mv.err), null, { timeout: 60000 }).catch(() => {});
  await sleep(300);
};
const show = (title, said, rep) => {
  console.log(`\n  ── ${title}`);
  if (said) console.log(`  LEARNER: "${said}"`);
  (rep.pol || []).forEach((p, i) => console.log(`  POLISH ${i + 1}: you said "${p.s}"\n            try "${p.b}"\n            why: ${p.w}`));
  if (!(rep.pol || []).length) console.log("  POLISH: (none)");
  console.log(`  BETTER VERSION: ${rep.better || "(none)"}\n  FOCUS: ${rep.one}`);
};

/* ── A · Week 3 "Raise a problem", a francophone learner's real-sounding answer ── */
console.log("\nA · WEEK 3 — Raise a problem (real model)");
const W3 = "Hello Marc. I want to tell you we have a problem about the delivery of the steel. The supplier he changed the number of the order and because of this we will finish the work three days after the date. I already make a call to their office this morning.";
await page.evaluate(() => mvGo("raise-problem-guided", "speak")); await sleep(300);
await speak(W3);
const a = await page.evaluate(() => { const r = mvStore()["raise-problem"]; const x = r.attempts[r.attempts.length - 1]; return { rep: x.report, moves: x.moves, pending: !!x.coachPending, fold: !![...document.querySelectorAll(".mv-fold summary")].find(s => /Language polish/.test(s.textContent)) }; });
show("Week 3 report", W3, a.rep);
const words = s => s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
ok("the real model answered (AI report, not the offline floor)", a.rep && a.rep.ai && !a.pending, JSON.stringify(a).slice(0, 300));
ok("it offered language polish for this answer, shown in the Language polish fold", (a.rep.pol || []).length >= 1 && a.fold);
ok("every polish 'you said' is the learner's own words", (a.rep.pol || []).every(p => words(W3).includes(words(p.s))));

console.log("\nA2 · WEEK 3 — an already-natural answer (the mission's own model answer)");
const NAT = await page.evaluate(() => MissionEngine.missionOf(mvComp("raise-problem"), "raise-problem-guided").hear.model);
await page.evaluate(() => mvRetry()); await sleep(200);
await speak(NAT);
const a2 = await page.evaluate(() => { const r = mvStore()["raise-problem"]; return r.attempts[r.attempts.length - 1].report; });
show("Natural answer report", NAT, a2);
ok("natural English drew no more than one (optional) polish entry", (a2.pol || []).length <= 1, JSON.stringify(a2.pol));

/* ── B · a real roleplay: Salary negotiation, real character replies ── */
console.log("\nB · ROLEPLAY — Salary negotiation (real character, real report)");
const TURNS = [
  "Thank you very much, I am very happy for this offer.",
  "But honestly eighty-two is too few for me. I was thinking more in ninety, because I have five years of experience in logistics and I manage a team of four persons.",
  "I understand the budget. Maybe if the salary cannot move, we can discuss about more days of holiday or a review after six months.",
];
await page.evaluate(() => { go("roleplay"); rpStart("iv-salary"); });
await sleep(600);
const replies = [];
for (const tx of TURNS) {
  await page.evaluate(t => { (rpConv.turns = rpConv.turns || []).push({ text: t }); return rpUserTurn(t); }, tx);
  await page.waitForFunction(() => rpConv && !rpConv.busy, null, { timeout: 60000 });
  replies.push(await page.evaluate(() => rpConv.history[rpConv.history.length - 1].content));
}
const offline = await page.evaluate(() => !!rpConv.offlineTold);
console.log(TURNS.map((t, i) => `  YOU: ${t}\n  MARCUS: ${replies[i]}`).join("\n"));
ok("the character answered every turn from the real model (no offline fallback)", !offline && replies.every(r => r && r.length > 10));
await page.evaluate(() => rpEnd()); await sleep(500);
await page.evaluate(() => rpReport());
await page.waitForFunction(() => { const c = rpRepConvo(); return c && c.rep; }, null, { timeout: 60000 });
await sleep(300);
const b = await page.evaluate(() => { const c = rpRepConvo(); return { rep: c.rep, covered: c.covered, total: c.total, fold: !![...document.querySelectorAll("#v-roleplay .mv-fold summary")].find(s => /Language polish/.test(s.textContent)) }; });
show(`Salary negotiation report (points covered ${b.covered}/${b.total})`, null, b.rep);
const all = words(TURNS.join(" "));
ok("the real model answered (AI report)", b.rep && b.rep.ai);
ok("it offered language polish, shown in the Language polish fold", (b.rep.pol || []).length >= 1 && b.fold);
ok("every polish 'you said' is the learner's own words", (b.rep.pol || []).every(p => all.includes(words(p.s))));

console.log(`\n  calls proxied to the preview: mvreport ${calls.mvreport}, chat ${calls.chat}; answered empty (tts/assess): ${calls.other}`);
ok("No uncaught page errors", errors.length === 0, errors.join(" | "));
await browser.close(); server.kill();
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) process.exit(1);
