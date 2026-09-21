/* "First Day on a Pipe Crew" end to end, in real headless Chromium, on a phone
   viewport, with the Worker faked: the chat stream always claims to be Maya
   and every TTS request is recorded. The learner's speech is injected at the
   point the recogniser would hand it over (simProcessSpeech), because there is
   no microphone to fake speech through.

   What it proves:
     - the workshop is reachable through the UI: Practice → card → scenario →
       "Talk to Maya" → mission briefing → start
     - the speakers run in the pack's order to the closing and the debrief
     - every TTS request of a turn carries the voice of the person on screen,
       and the name in the bar matches the name on the bubble
     - the same words from two people are two clips, not one
     - a refresh mid-conversation keeps every speaker and continues in order
     - two learner turns fired at once do not cross voices
     - the General English area has no workshops and shows none

   Run:  node workshop.mjs            (starts its own server on a free port)
         BASE=http://… node workshop.mjs */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOT = new URL("..", import.meta.url).pathname;
const pack = JSON.parse(readFileSync(ROOT + "tracks/welding/practice.json", "utf8"));
const cast = Object.fromEntries(pack.simulationCharacters.map(c => [c.id, c]));

/* A port nobody else holds: other sessions leave servers on 8765/8766/8768. */
async function freePort() { return new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); }); }
let BASE = process.env.BASE, server = null;
if (!BASE) { const port = await freePort(); server = spawn("python3", ["-m", "http.server", String(port)], { cwd: ROOT, stdio: "ignore" }); await sleep(700); BASE = "http://localhost:" + port; }

let failures = 0, passes = 0;
const ok = (name, cond, why) => { if (cond) { passes++; console.log(`  PASS  ${name}`); } else { failures++; console.log(`  FAIL  ${name}${why ? " — " + JSON.stringify(why) : ""}`); } };

const browser = await chromium.launch();
const errors = [];
const WAV = Buffer.from("UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=", "base64");

async function learner(track) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const tts = []; let turnNo = 0;
  await ctx.route("https://be-polish.nore-ngou.workers.dev/**", async route => {
    const body = route.request().postDataJSON() || {};
    if (body.tts) { tts.push({ voice: body.voice, style: body.style || "", text: body.tts }); return route.fulfill({ status: 200, contentType: "audio/wav", body: WAV }); }
    if (body.chat) {
      turnNo++;
      const text = `Turn ${turnNo}. Good to have you on the crew. What size pipe are you used to?`;
      const nd = [{ c: "hr" }, { s: `Turn ${turnNo}.` }, { s: "Good to have you on the crew." }, { s: "What size pipe are you used to?" },
        { done: true, characterId: "hr", reply: text, covered: [] }].map(o => JSON.stringify(o)).join("\n") + "\n";
      return route.fulfill({ status: 200, contentType: "application/x-ndjson", body: nd });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  await ctx.addInitScript(({ track }) => {
    if (!localStorage.getItem("be12_v1")) {
      const st = { profile: { name: "Test", role: "", goal: "Speak with confidence at work", slot: "", lang: "en", ts: Date.now() }, professionalTracks: { activeId: track, tradeId: "pipefitter" },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } },
        days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() };
      localStorage.setItem("be12_v1", JSON.stringify(st)); sessionStorage.setItem("be_view", "#practice");
    }
  }, { track });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(track + ": " + e.message));
  await page.goto(BASE + "/index.html?ws=" + Date.now() + "#practice", { waitUntil: "load" });
  await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });
  return { ctx, page, tts };
}
const txt = (page, sel) => page.evaluate(s => (document.querySelector(s)?.innerText || "").replace(/\s+/g, " ").trim(), sel);
/* The last character bubble's name, the bar's name, and the run's last speaker. */
const state = page => page.evaluate(() => {
  const bubbles = [...document.querySelectorAll("#simBody .rp-bubble.ai .sim-bub-who")].map(e => e.textContent.trim());
  return { bar: (document.querySelector("#simSpeaker") || {}).textContent || "", bubble: bubbles[bubbles.length - 1] || "", last: (typeof simRun !== "undefined" && simRun).lastSpeakerId, status: (document.querySelector("#simStatus") || {}).textContent || "",
    msgs: ((typeof simRun !== "undefined" && simRun).messages || []).map(m => ({ role: m.role, characterId: m.characterId, text: m.text })), finished: !!((typeof simRun !== "undefined" && simRun).finished), debrief: !!((typeof simRun !== "undefined" && simRun).debrief), mission: !!((typeof simRun !== "undefined" && simRun).missionComplete) };
});
async function say(page, text) { await page.evaluate(t => simProcessSpeech(t), text); await page.waitForFunction(() => /Your turn|tap the microphone|Tap to continue/i.test((document.querySelector("#simStatus") || {}).textContent || "") || !document.querySelector("#simStatus"), null, { timeout: 8000 }).catch(() => {}); await sleep(250); }

console.log(`workshop — First Day on a Pipe Crew  (${BASE})\n`);

/* ---------- Welding learner: the scenario through the UI ---------- */
const W = await learner("welding");
const { page, tts } = W;
ok("Practice tab shows the workshop card on Welding", (await txt(page, "#v-practice")).includes("Professional Workplace Scenarios"));
await page.click(".workplace-simulation-entry");
await page.waitForSelector("#v-simulation .sim-scenario-card", { timeout: 5000 });
const cards = await page.$$eval("#v-simulation .sim-scenario-card h2", els => els.map(e => e.textContent.trim()));
ok("the catalogue lists the twelve workshops, the first-day one first", cards.length === 12 && /First Day/.test(cards[0]), cards.slice(0, 2));
await page.click("#v-simulation .sim-scenario-card:first-of-type summary");
await sleep(200);
const castBtns = await page.$$eval("#v-simulation .sim-scenario-card[open] .sim-cast button b", els => els.map(e => e.textContent.trim()));
ok("the first-day workshop offers all five people", JSON.stringify(castBtns) === JSON.stringify(["Talk to Maya", "Talk to Daniel", "Talk to Luis", "Talk to Priya", "Talk to Amelia"]), castBtns);
await page.click("#v-simulation .sim-scenario-card[open] .sim-cast button:has-text('Talk to Maya')");
await page.waitForSelector(".mission-start", { timeout: 5000 });
ok("choosing Maya opens the mission briefing that begins with Maya", (await txt(page, ".mission-contact")).startsWith("You will begin with Maya"));
await page.click(".mission-start");
await page.waitForSelector("#simSpeaker", { timeout: 5000 });
await sleep(900);
let s = await state(page);
ok("Maya opens: bar, bubble and run agree", s.bar === "Maya" && s.bubble === "Maya" && s.last === "hr", s);
ok("Maya's opening is requested in Maya's voice only", tts.length > 0 && tts.every(t => t.voice === cast.hr.voice), tts.map(t => t.voice));

/* Every turn: the speaker the pack schedules, on screen and in every clip. */
const sc = pack.simulations[0];
const expected = ["supervisor", "coworker", "safety", "coworker", "qa", "qa"];   /* t0, event after turn 2, t1, t2, t3, closing */
const perTurn = [];
for (let i = 0; i < expected.length; i++) {
  const before = tts.length;
  await say(page, `I'm a pipefitter with six years on process piping. Turn ${i + 1}.`);
  s = await state(page);
  const mine = tts.slice(before);
  const last = s.msgs.filter(m => m.role === "character").slice(-1)[0] || {};
  perTurn.push({ id: last.characterId, bar: s.bar, bubble: s.bubble, voices: [...new Set(mine.map(t => t.voice))] });
  if (s.mission || s.debrief) break;
}
ok("speakers follow the pack: Daniel → Luis (interrupts) → Priya → Luis → Amelia → Amelia closes",
  JSON.stringify(perTurn.map(p => p.id)) === JSON.stringify(expected), perTurn.map(p => p.id));
/* On the closing turn the app has already moved to the mission-complete
   screen, so there is no bar or bubble left to read — the voice still must be
   Amelia's. */
ok("every turn's clips carry the voice of the person on screen, and bar = bubble = that person",
  perTurn.every((p, i) => p.voices.length === 1 && p.voices[0] === cast[p.id].voice && (i === perTurn.length - 1 || (p.bar === cast[p.id].name && p.bubble === cast[p.id].name))), perTurn);
ok("the model's claim to be Maya on every turn changed nothing", !perTurn.some(p => p.id === "hr"));
s = await state(page);
ok("the first day completes and lands on the mission-complete screen", s.mission && (await txt(page, "#v-simulation")).length > 0, { mission: s.mission, status: s.status });
/* Each character message's clips were requested with its own voice — mapped by
   the turn number the fake Worker put in the text, not by the order they came. */
const byTurn = {};
for (const m of s.msgs.filter(x => x.role === "character" && /^Turn \d+/.test(x.text))) byTurn[/^Turn (\d+)/.exec(m.text)[1]] = cast[m.characterId].voice;
const mism = tts.filter(t => /^Turn \d+\.$/.test(t.text)).filter(t => byTurn[/^Turn (\d+)/.exec(t.text)[1]] !== t.voice);
ok("audio ↔ message association: every 'Turn N' clip used the voice of the message it belongs to", Object.keys(byTurn).length >= 5 && mism.length === 0, mism);

/* ---------- same words, two people ---------- */
{
  const before = tts.length;
  await page.evaluate(async () => { await Promise.all([fbTtsUrl("Same words, two people.", "coral", ""), fbTtsUrl("Same words, two people.", "ash", "")]); });
  const two = tts.slice(before).filter(t => t.text === "Same words, two people.");
  ok("identical text from Maya and Daniel is two clips, one per voice", two.length === 2 && new Set(two.map(t => t.voice)).size === 2, two);
  const again = tts.length;
  await page.evaluate(async () => { await fbTtsUrl("Same words, two people.", "ash", ""); });
  ok("and a repeat of Daniel's is served from the cache, not re-fetched", tts.length === again);
}

/* ---------- refresh mid-conversation ---------- */
{
  await page.evaluate(() => { simRun = null; if (window.ConversationOrchestrator) { const S0 = appState(); S0.simulations = S0.simulations || {}; delete (S0.simulations.live || {})["welding-sim-1"]; } });
  await page.evaluate(() => go("simulation"));
  await sleep(200);
  await page.evaluate(() => simStart("welding-sim-1", "hr"));
  await sleep(800);
  await say(page, "Hello, I'm new.");
  await say(page, "Six years on process piping.");
  const beforeReload = await state(page);
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });
  await page.evaluate(() => go("simulation", "welding-sim-1"));
  await page.waitForSelector("#simSpeaker", { timeout: 5000 });
  const after = await state(page);
  ok("after a refresh every message keeps its speaker",
    JSON.stringify(after.msgs.map(m => m.characterId || "-")) === JSON.stringify(beforeReload.msgs.map(m => m.characterId || "-")) && after.last === beforeReload.last, { before: beforeReload.msgs.map(m => m.characterId), after: after.msgs.map(m => m.characterId) });
  ok("and the bar shows the person who spoke last (Luis, who interrupted)", after.bar === "Luis" && after.last === "coworker", after.bar);
  const before = tts.length;
  await say(page, "Yes, I've done that.");
  const s3 = await state(page);
  const mine = tts.slice(before);
  ok("the conversation resumes with the next scheduled person, Priya, in Priya's voice",
    s3.last === "safety" && s3.bar === "Priya" && mine.length > 0 && mine.every(t => t.voice === cast.safety.voice), { last: s3.last, bar: s3.bar, voices: mine.map(t => t.voice) });
}

/* ---------- two turns fired at once ---------- */
{
  const before = tts.length;
  await page.evaluate(() => { simProcessSpeech("First thing."); simProcessSpeech("Second thing."); });
  await sleep(2500);
  const s4 = await state(page);
  const chars = s4.msgs.filter(m => m.role === "character" && /^Turn \d+/.test(m.text));
  const byT = {}; for (const m of chars) byT[/^Turn (\d+)/.exec(m.text)[1]] = cast[m.characterId].voice;
  const cross = tts.slice(before).filter(t => /^Turn \d+\.$/.test(t.text)).filter(t => byT[/^Turn (\d+)/.exec(t.text)[1]] && byT[/^Turn (\d+)/.exec(t.text)[1]] !== t.voice);
  ok("two learner turns at once: no clip crosses to another person's voice, no JS error", cross.length === 0 && !errors.length, { cross, errors });
}

/* ---------- General English: nothing of this exists ---------- */
const G = await learner("general-english");
ok("General English Practice tab has no workshop card", !(await txt(G.page, "#v-practice")).includes("Professional Workplace Scenarios"));
ok("General English curriculum carries no simulations", await G.page.evaluate(() => (activeCurriculum().simulations || []).length === 0 && !((activeCurriculum().simulationCharacters || []).length)));
ok("No uncaught JavaScript errors", errors.length === 0, errors);

console.log(`\n${passes} pass, ${failures} fail  (${BASE})`);
await browser.close(); if (server) server.kill();
process.exit(failures ? 1 : 0);
