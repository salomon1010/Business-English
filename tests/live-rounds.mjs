/* Live practice — timed rounds + each learner's own report (owner, 2026-09-25).
   Two learners in a real WebRTC call (two browser contexts, fake microphones):
   choose the round length, start a round, the countdown ends it, the
   microphones pause, each phone analyses ITS OWN round, the next round starts
   from either phone, and after round 4 each phone gets its own four-round
   review built from its own transcripts only.
   Needs the local Worker:  cd backend/partner && npx wrangler dev --env dev --port 8797 --var 'ALLOWED_ORIGINS:http://127.0.0.1:8773'
   Run:                     cd tests && PARTNER_API=http://127.0.0.1:8797 BASE=http://127.0.0.1:8773 node live-rounds.mjs
   The Polish Worker (transcription + quick tip) is intercepted: no model is called. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const WORKER = process.env.PARTNER_API || "http://127.0.0.1:8797";
let workerUp = false; try { workerUp = (await fetch(WORKER + "/health")).ok; } catch (e) {}
if (!workerUp) { console.log(`  SKIP  live rounds — local Worker not reachable at ${WORKER}`); process.exit(0); }
await fetch(WORKER + "/__reset", { method: "POST" });
let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", "8773", "--bind", "127.0.0.1"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }); await sleep(700); BASE = "http://127.0.0.1:8773"; }
const ROUND_SECS = 12;
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const api = (u, m, p, b) => fetch(WORKER + p, { method: m, headers: { "x-dev-user": u, ...(b ? { "content-type": "application/json" } : {}) }, body: b ? JSON.stringify(b) : undefined });
const FLAGS = { practice_partner_live_enabled: true, practice_partner_enabled: true, practice_partner_matching_enabled: true, practice_partner_voice_enabled: true, practice_partner_ai_fallback_enabled: true };

/* a trial pair between Alice and Bob, made through the API */
for (const [u, n] of [["alice", "Alice"], ["bob", "Bob"]]) {
  await api(u, "POST", "/consent", { name: n, lang: "fr", adult: true, gender: "f", goals: ["workplace"], avail: ["evening"], tz: 0 });
  await api(u, "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1, goals: ["workplace"] });
}
const match = await (await api("alice", "POST", "/match", {})).json();
const offer = (match.candidates || []).find(c => c.name === "Bob");
await api("alice", "POST", "/invite", { offer: offer && offer.offer });
const bobInv = (await (await api("bob", "GET", "/me")).json()).invite;
await api("bob", "POST", `/pairs/${bobInv && bobInv.id}/accept`);
ok("Setup: Alice and Bob share an active trial pair", !!(await (await api("alice", "GET", "/me")).json()).pair);

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
const SAID = { alice: "I work at Walmart as a web designer and I am responsible of the checkout pages.", bob: "Bob here, I am a nurse in Lyon and I manage the night shift." };
const polishCalls = { alice: [], bob: [] };
async function learner(id, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  await ctx.addInitScript(({ id, name, WORKER, FLAGS, ROUND_SECS }) => {
    localStorage.setItem("be_partner_api", WORKER); localStorage.setItem("be_partner_dev_user", id); localStorage.setItem("be_flags", JSON.stringify(FLAGS));
    localStorage.setItem("be_live_round_secs", String(ROUND_SECS));
    if (!localStorage.getItem("be12_v1")) {
      localStorage.setItem("be12_v1", JSON.stringify({ profile: { name, role: "", goal: "Speak with confidence", slot: "", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "general-english" },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: true }));
      sessionStorage.setItem("be_view", "#partner");
    }
  }, { id, name, WORKER, FLAGS, ROUND_SECS });
  await ctx.route(u => u.href.startsWith("https://be-polish."), async route => {
    const req = route.request(), ct = (req.headers()["content-type"] || "");
    if (ct.startsWith("audio/")) { polishCalls[id].push({ kind: "stt", bytes: (req.postDataBuffer() || []).length }); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: SAID[id] }) }); }
    let b = {}; try { b = JSON.parse(req.postData() || "{}"); } catch (e) {}
    if (b.chat) { polishCalls[id].push({ kind: "chat", user: b.chat.messages[0].content }); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "WELL: You named your role clearly.\nSAID: I am responsible of the checkout pages\nBETTER: I'm responsible for the checkout pages.\nWHY: We say responsible for, not of.", covered: [] }) }); }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?lr=" + Date.now() + "#partner", { waitUntil: "load" });
  await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });
  await page.evaluate(async () => { go("partner"); await ppRefresh(true); });
  return { ctx, page, id };
}
const txt = (page, sel) => page.evaluate(s => (document.querySelector(s)?.innerText || "").replace(/\s+/g, " "), sel);
const A = await learner("alice", "Alice"), B = await learner("bob", "Bob");

ok("The live room says only your own voice is recorded (no more 'Nothing is recorded')", await A.page.evaluate(() => t("pp.live_human").includes("Only your own voice") && !/Nothing is recorded/.test(t("pp.live_human"))));
await A.page.evaluate(() => ppLiveInvite()); await A.page.waitForSelector(".pp-live-head", { timeout: 10000 }).catch(() => {});
await B.page.evaluate(async () => { await ppRefresh(true); }); await sleep(500);
await B.page.evaluate(() => ppLiveAccept());
const up = await Promise.all([A, B].map(L => L.page.waitForSelector(".pp-live-status.active", { timeout: 40000 }).then(() => true).catch(() => false)));
ok("Both phones connect", up[0] && up[1]);
await sleep(4200);   /* the 3-2-1 */

const SHOTS = process.env.SHOTS; const shot = async (L, name) => { if (SHOTS) { await L.page.evaluate(() => document.querySelector(".pp-lr, .pp-live-end, .pp-rv-head, #v-partner")?.scrollIntoView({ block: "start" })); await L.page.screenshot({ path: `${SHOTS}/${name}.png` }); } };
const ready = await txt(A.page, ".pp-lr"); await shot(A, "1-ready");
ok("Before round 1: the question, 'Minutes per round' with 2 / 3 / 4 / 5 min, 3 chosen by default, and Start round 1 · 3 min", /round 1 of 4/i.test(ready) && ready.includes("Minutes per round") && ["2 min", "3 min", "4 min", "5 min"].every(x => ready.includes(x)) && (await A.page.evaluate(() => document.querySelector(".pp-lr-chip.on")?.innerText)) === "3 min" && ready.includes("Start round 1 · 3 min"), ready);
ok("No manual Previous / Next round buttons any more", !(await txt(A.page, "#v-partner")).includes("Next round"));
await A.page.click('.pp-lr-chip:has-text("4 min")'); await sleep(5000);
ok("Alice picks 4 min → Bob's phone shows 4 min chosen too (shared length)", (await B.page.evaluate(() => ppLive.mins)) === 4 && (await B.page.evaluate(() => document.querySelector(".pp-lr-chip.on")?.innerText)) === "4 min");

for (let n = 1; n <= 4; n++) {
  const starter = n % 2 ? A : B, other = n % 2 ? B : A;
  await starter.page.click('.pp-lr button:has-text("Start round")');
  await sleep(1500);
  const talkS = await starter.page.evaluate(() => ({ phase: ppLive.phase, rec: !!(ppLive.rec && ppLive.rec.mr.state === "recording"), clock: document.getElementById("ppLiveLeft")?.innerText || "", mic: ppLive.stream.getAudioTracks()[0].enabled }));
  await other.page.waitForFunction(r => ppLive && ppLive.phase === "talk" && ppLive.round === r, n, { timeout: 8000 }).catch(() => {});
  const talkO = await other.page.evaluate(() => ({ phase: ppLive.phase, round: ppLive.round, rec: !!(ppLive.rec && ppLive.rec.mr.state === "recording") }));
  if (n === 1 || n === 2) ok(`Round ${n}: started on ${starter.id}'s phone → both phones in the round, recording their own mic, countdown shown`, talkS.phase === "talk" && talkS.rec && /^\d:\d\d$/.test(talkS.clock) && talkS.mic && talkO.phase === "talk" && talkO.round === n && talkO.rec, JSON.stringify({ talkS, talkO }));
  if (n === 1) await shot(A, "2-talk");
  if (n === 1) ok("The round card says your voice is being recorded for your report", (await txt(A.page, ".pp-lr")).includes("Recording your voice for your report"));
  if (n < 4) {
    await Promise.all([A, B].map(L => L.page.waitForFunction(() => ppLive && ppLive.phase === "break", null, { timeout: (ROUND_SECS + 10) * 1000 }).catch(() => {})));
    await Promise.all([A, B].map(L => L.page.waitForFunction(r => ppLive && ppLive.rr[r] && ppLive.rr[r].tip && typeof ppLive.rr[r].tip === "object", n, { timeout: 15000 }).catch(() => {})));
    const brk = await A.page.evaluate(() => ({ phase: ppLive.phase, mic: ppLive.stream.getAudioTracks()[0].enabled, card: document.querySelector(".pp-lr")?.innerText.replace(/\s+/g, " ") || "" }));
    if (n === 1) {
      await shot(A, "3-break");
      ok("Countdown over → the round stops: microphones paused, connection kept", brk.phase === "break" && brk.mic === false && (await A.page.evaluate(() => ppLive.pc && ppLive.pc.connectionState === "connected")), JSON.stringify(brk));
      ok("Round analysis on Alice's phone: what SHE said, what went well, the better sentence, and the next round's question with Start round 2", /round 1 of 4 — done/i.test(brk.card) && brk.card.includes(SAID.alice.slice(0, 30)) && brk.card.includes("You named your role clearly") && brk.card.includes("I'm responsible for the checkout pages") && /round 2 question/i.test(brk.card) && brk.card.includes("Start round 2 · 4 min"), brk.card);
      const bc = await txt(B.page, ".pp-lr");
      ok("Bob's phone analyses only Bob's words", bc.includes(SAID.bob.slice(0, 20)) && !bc.includes("Walmart"), bc);
    }
  }
}
/* after round 4: the call ends itself as completed, the report builds and opens on both phones */
await Promise.all([A, B].map(L => L.page.waitForFunction(() => typeof ppRevOpenId === "string" && ppRevOpenId, null, { timeout: (ROUND_SECS + 40) * 1000 }).catch(() => {})));
await sleep(600); await shot(A, "4-report");
const rep = await Promise.all([A, B].map(L => L.page.evaluate(() => { const r = ppRevGet(ppRevOpenId); return { open: !!r, live: r && r.live, pairId: r && r.pairId, original: r && r.review.answer && r.review.answer.original || "", page: document.getElementById("v-partner").innerText.replace(/\s+/g, " ").slice(0, 400), hist: ppHist().find(e => e.kind === "live") }; })));
ok("After round 4 each phone opens its own four-round review (the same report as a recorded session)", rep[0].open && rep[1].open && rep[0].live && /^live:/.test(rep[0].pairId) && /four-round review/i.test(rep[0].page), JSON.stringify(rep.map(r => r.page.slice(0, 160))));
ok("Alice's report is built from Alice's words only; Bob's from Bob's only", rep[0].original.includes("Walmart") && !rep[0].original.includes("nurse") && rep[1].original.includes("nurse") && !rep[1].original.includes("Walmart"), JSON.stringify([rep[0].original, rep[1].original]));
ok("The call is recorded in History as completed, 4 rounds, with the report linked", rep[0].hist && rep[0].hist.end === "completed" && rep[0].hist.revId === (await A.page.evaluate(() => ppRevOpenId)), JSON.stringify(rep[0].hist));
const sttA = polishCalls.alice.filter(c => c.kind === "stt"), chatA = polishCalls.alice.filter(c => c.kind === "chat");
ok("Alice's phone transcribed four rounds of its own audio and asked for four quick tips — each tip sent only Alice's words", sttA.length === 4 && chatA.length === 4 && chatA.every(c => c.user.includes("Walmart") && !c.user.includes("nurse")), JSON.stringify({ stt: sttA.length, chat: chatA.length }));
ok("Server: both reviews exist, each readable by its owner only", await (async () => { const a = await (await api("alice", "GET", "/reviews")).json(), b = await (await api("bob", "GET", "/reviews")).json(); return a.reviews.length === 1 && b.reviews.length === 1 && a.reviews[0].id !== b.reviews[0].id; })());
ok("Repeating the review request returns the stored one (idempotent)", await (async () => { const sid = rep[0].pairId.slice(5); const r = await (await api("alice", "POST", `/live/${sid}/review`, { rounds: [{ seq: 1, transcript: "x" }] })).json(); return r.id && r.pairId === sid; })());
ok("A stranger cannot request a review of this call", await (async () => { const sid = rep[0].pairId.slice(5); return (await api("carol", "POST", `/live/${sid}/review`, { rounds: [{ seq: 1, transcript: "x" }] })).status === 403; })());
await A.page.evaluate(() => { ppRevClose(); go("partner", "history"); }); await sleep(800);
ok("History: the live-call row carries 'Open my report'", (await txt(A.page, "#v-partner")).includes("Open my report"));

/* leaving early still gives each phone a report from the rounds that exist */
await A.page.evaluate(() => ppLiveInvite()); await sleep(800);
await B.page.evaluate(async () => { ppRevClose(); await ppRefresh(true); }); await sleep(500);
await B.page.evaluate(() => ppLiveAccept());
await Promise.all([A, B].map(L => L.page.waitForSelector(".pp-live-status.active", { timeout: 40000 }).catch(() => {})));
await sleep(4200);
await A.page.click('.pp-lr button:has-text("Start round")');
await B.page.waitForFunction(() => ppLive && ppLive.phase === "talk", null, { timeout: 8000 }).catch(() => {});
await sleep(5000);
const revsBefore = await A.page.evaluate(() => ppRevList().length);
await A.page.evaluate(() => ppLiveHangup());
await Promise.all([A, B].map(L => L.page.waitForFunction(n => ppRevList().length > n, revsBefore, { timeout: 30000 }).catch(() => {})));
const early = await Promise.all([A, B].map(L => L.page.evaluate(() => { const r = ppRevList().slice(-1)[0]; return { n: ppRevList().length, rounds: r && (r.review.rounds || []).length, open: typeof ppRevOpenId === "string" && ppRevOpenId === (r && r.id) }; })));
ok("Hang up in round 1 → each phone still builds a report from its one recorded round, and opens it", early[0].n === revsBefore + 1 && early[1].n === revsBefore + 1 && early[0].open && early[1].open, JSON.stringify(early));
await fetch(WORKER + "/__reset", { method: "POST" });
ok("No page errors", errors.length === 0, errors.join(" | "));
await browser.close(); if (server) server.kill();
const failed = res.filter(r => !r.pass).length;
console.log(`\n${res.length - failed}/${res.length} passed`);
process.exit(failed ? 1 : 0);
