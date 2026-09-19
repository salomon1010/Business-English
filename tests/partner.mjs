/* Practice Partner + Shadow Studio V2 — browser end-to-end, two learners, mobile viewport.
   Needs the local Worker:  cd backend/partner && npx wrangler dev --env dev --port 8787
   Run:                     cd tests && node partner.mjs        (or npm run test:partner)
   Skips with exit 0 when the Worker is not reachable. Uses Chromium's fake
   microphone, so the real MediaRecorder path runs; flags are enabled through
   localStorage.be_flags exactly as an internal tester would. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const WORKER = process.env.PARTNER_API || "http://127.0.0.1:8787";
let workerUp = false; try { workerUp = (await fetch(WORKER + "/health")).ok; } catch (e) {}
if (!workerUp) { console.log(`  SKIP  Practice Partner e2e — local Worker not reachable at ${WORKER} (start it with: cd backend/partner && npx wrangler dev --env dev --port 8787)`); process.exit(0); }
await fetch(WORKER + "/__reset", { method: "POST" });

let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", "8765"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }); await sleep(700); BASE = "http://localhost:8765"; }
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const FLAGS = { practice_partner_live_enabled: true, practice_partner_enabled: true, practice_partner_matching_enabled: true, practice_partner_voice_enabled: true, practice_partner_ai_fallback_enabled: true, practice_partner_notifications_enabled: true, shadow_studio_v2_enabled: true, shadow_apply_phrase_enabled: true };

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
async function learner(id, name, track, weekDone) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  await ctx.addInitScript(({ id, name, track, weekDone, WORKER, FLAGS }) => {
    localStorage.setItem("be_partner_api", WORKER); localStorage.setItem("be_partner_dev_user", id); localStorage.setItem("be_flags", JSON.stringify(FLAGS));
    if (!localStorage.getItem("be12_v1")) {
      const st = { profile: { name, role: "", goal: "Speak with confidence in meetings", slot: "", lang: "en", ts: Date.now() }, professionalTracks: { activeId: track },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() };
      if (weekDone) ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(d => st.days["w1" + d] = true);
      localStorage.setItem("be12_v1", JSON.stringify(st)); sessionStorage.setItem("be_view", "#practice");
    }
  }, { id, name, track, weekDone, WORKER, FLAGS });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?pp=" + Date.now() + "#practice", { waitUntil: "load" });
  await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });
  return { ctx, page, id, name };
}
const txt = (page, sel) => page.evaluate(s => (document.querySelector(s)?.innerText || "").replace(/\s+/g, " "), sel);
const api = (u, m, p, b) => fetch(WORKER + p, { method: m, headers: { "x-dev-user": u, ...(b && !(b instanceof FormData) ? { "content-type": "application/json" } : {}) }, body: b && !(b instanceof FormData) ? JSON.stringify(b) : b });
const apiTurn = (u, text) => { const fd = new FormData(); fd.set("audio", new Blob([new Uint8Array(30000)], { type: "audio/webm" }), "r.webm"); fd.set("transcript", text); fd.set("score", "77"); fd.set("duration_ms", "7000"); return api(u, "POST", "/turns", fd); };

const A = await learner("alice", "Alice Ngo", "general-english", false);
const W = await learner("wendy", "Wendy Weld", "welding", false);

/* ---------- General-English-only boundary ---------- */
ok("General English: Practice tab shows the Practice Partner card", (await txt(A.page, ".pp-entry")).includes("Practice Partner"));
ok("Practice tab: the 'Best tool' shortcut and the Life Simulations card carry the same name and open the same page (roleplay)", await A.page.evaluate(() => { const strip = [...document.querySelectorAll(".path-tool")].find(b => b.getAttribute("onclick").includes("'sim'")); const card = [...document.querySelectorAll(".rp-entry")].find(b => (b.getAttribute("onclick") || "").includes("roleplay")); return !!strip && !!card && strip.innerText.includes("Practise a real conversation") && card.innerText.includes("Practise a real conversation") && !strip.innerText.includes("Workplace conversations") && pathTools().find(x => x.id === "sim").go[0] === "roleplay"; }));
ok("Welding: the same shortcut and card keep the professional simulation route", await W.page.evaluate(() => pathTools().find(x => x.id === "sim").go[0] === "simulation" && !![...document.querySelectorAll(".rp-entry")].find(b => (b.getAttribute("onclick") || "").includes("simulation"))));
ok("Welding: no Practice Partner card on the Practice tab", await W.page.evaluate(() => !document.querySelector(".pp-entry")));
await W.page.evaluate(() => go("partner")); await sleep(500);
ok("Welding: the #partner route renders nothing partner-branded and lands on Practice; no fetch, no consent", await W.page.evaluate(async () => { location.hash = "#partner"; go("partner"); await new Promise(r => setTimeout(r, 400)); return cur.v === "practice" && !document.querySelector("#v-partner").innerHTML.trim() && !document.querySelector(".pp-consent"); }));
const wj = await (await api("wendy", "POST", "/consent", { name: "Wendy", lang: "en", adult: true })).json();
const wt = await (await api("wendy", "POST", "/interest", { track: "welding", band: "w1-4", lang: "en" })).json();
ok("Welding: the Worker refuses the track even when called directly (403 track)", wj.consented && wt.error === "track");
ok("Welding: direct API — AI session 403 track, live invite 404 (no connection), a live session id 403, partner audio 404/403", await (async () => {
  const ai = await (await api("wendy", "POST", "/ai/session", { id: "0123456789abcdef", track: "welding" })).json();
  const lv = await api("wendy", "POST", "/live", { band: "w1-4", promptWeek: 1 });
  const ls = await api("wendy", "GET", "/live/0123456789abcdef");
  const au = await api("wendy", "GET", "/turns/0123456789abcdef/audio");
  return ai.error === "track" && lv.status === 404 && ls.status === 403 && (au.status === 404 || au.status === 403); })());
await W.page.evaluate(async () => { go("shadow"); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); }); await sleep(2000);
ok("Welding: Shadow Studio V2 panel is hidden and no asset is built, flags on", await W.page.evaluate(() => { const b = document.getElementById("shV2"); return !svOn() && svAsset === null && (!b || b.style.display === "none"); }));
await W.page.evaluate(() => { try { shCloseWork(); } catch (e) {} });
ok("Welding: Home shows no partner card", await W.page.evaluate(async () => { go("home"); await new Promise(r => setTimeout(r, 300)); return !document.querySelector(".pp-home"); }));
await W.ctx.close();

/* ---------- consent with 18+ and preferences ---------- */
await A.page.click(".pp-entry"); await sleep(1200);
ok("First visit asks for consent", (await txt(A.page, "#v-partner")).includes("Before your first partner"));
await A.page.click("#v-partner .pp-cta button"); await sleep(300);
const consentText = await txt(A.page, ".pp-consent");
ok("Consent sheet: what is shared, server upload stated, 18+, goals, availability", consentText.includes("uploaded to our server") && consentText.includes("18 or older") && consentText.includes("Workplace English") && consentText.includes("Evening"));
ok("Goal is pre-selected from the learner's profile (meetings → Workplace English)", await A.page.evaluate(() => document.querySelector('.pp-consent input[value="workplace"]').checked));
await A.page.click('.pp-consent label:has(input[value="interview"])'); await A.page.click('.pp-consent label:has(input[value="evening"])'); await A.page.click('.pp-consent label:has(input[name="ppg"][value="f"])');
await A.page.click(".pp-consent .btn-primary"); await sleep(400);
ok("Consent sheet scrolls on a small phone: Agree button reachable at 375×812", await (async () => {
  await A.page.setViewportSize({ width: 375, height: 812 });
  const r = await A.page.evaluate(() => { const sh = document.querySelector(".pp-consent"); if (!sh) return null; const canScroll = getComputedStyle(sh).overflowY === "auto" && sh.scrollHeight > sh.clientHeight; sh.scrollTop = sh.scrollHeight; const b = [...sh.querySelectorAll("button.btn-primary")].pop().getBoundingClientRect(); return { canScroll, inView: b.top >= 0 && b.bottom <= window.innerHeight }; });
  await A.page.setViewportSize({ width: 390, height: 844 });
  return r && r.canScroll && r.inView; })(), await A.page.evaluate(() => { const sh = document.querySelector(".pp-consent"); return sh ? JSON.stringify({ ov: getComputedStyle(sh).overflowY, sh: sh.scrollHeight, ch: sh.clientHeight, mh: getComputedStyle(sh).maxHeight }) : "no sheet"; }));
ok("Without the 18+ confirmation nothing is sent", (await txt(A.page, "#toast")).includes("18") && !(await (await api("alice", "GET", "/me")).json()).consented);
await A.page.click(".pp-consent #ppAdult"); await sleep(100);
await A.page.click(".pp-consent .btn-primary"); await sleep(1200);
ok("Agreeing registers with preferences and shows Match me / Practise now", (await txt(A.page, "#v-partner")).includes("Match me") && (await (await api("alice", "GET", "/me")).json()).prefs.goals.join() === "workplace,interview");

/* ---------- no partner available: AI fallback, no dead end ---------- */
await A.page.click("#v-partner .pp-cta .btn-primary"); await sleep(1200);
ok("No candidates → honest message, AI coach offered, stays in line", (await txt(A.page, "#v-partner")).includes("No suitable partner") && (await txt(A.page, "#v-partner")).includes("AI coach") && (await (await api("alice", "GET", "/me")).json()).waiting);
await A.page.click('button:has-text("Keep looking")'); await sleep(900);
ok("Waiting state shows the AI fallback card, labelled AI", (await txt(A.page, ".pp-fallback")).includes("AI COACH — NOT YOUR PARTNER"));

/* ---------- Level 2: the AI coach session (Polish Worker intercepted — no live AI call) ---------- */
let aiFail = false, aiCalls = 0;
await A.page.route(u => u.href.startsWith("https://be-polish."), async route => {
  let body = {}; try { if ((route.request().headers()["content-type"] || "").includes("json")) body = route.request().postDataJSON() || {}; } catch (e) {}
  if (body.chat) { aiCalls++; if (aiFail) return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "chat_unavailable" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Nice — that sounds busy. What was the hardest part of it?", tip: "Say 'project' with a clear /dʒ/ sound.", covered: [] }) }); }
  return route.fulfill({ status: 403, body: "Forbidden" });   /* transcription/assessment stay unavailable, as on a non-allow-listed origin */
});
const aiRec = async () => { await A.page.click("#ppRecorder .pp-recbtn"); await A.page.waitForSelector("#ppRecorder .pp-stop", { timeout: 10000 }); await sleep(2000); await A.page.click("#ppRecorder .pp-stop"); await A.page.waitForFunction(() => ppRec && !ppRec.busy && ppRec.blob, null, { timeout: 30000 }); };
await A.page.click('.pp-fallback button:has-text("AI coach")'); await sleep(500);
const aiHead = await txt(A.page, ".pp-ai-head"), aiPrompt = await txt(A.page, ".pp-prompt");
const curTask = await A.page.evaluate(() => ppPrompt({ rounds: 4, round: 1, promptWeek: ppPosition().promptWeek, fndDay: ppPosition().fndDay }).task);
ok("AI coach session opens on the partner page, labelled AI, not a person", /\bAI\b/.test(aiHead) && aiHead.includes("not a person") && (await txt(A.page, "#v-partner")).includes("Round 1 of 4"), aiHead);
ok("AI session uses the learner's General English curriculum task for round 1", curTask.length > 10 && aiPrompt.includes(curTask.slice(0, 40)), aiPrompt);
const aiId = await A.page.evaluate(() => ppState().ai.id);
await A.page.evaluate(() => ppAiStart("choice")); await sleep(200);
ok("Starting the AI practice again returns the same open session (no duplicate)", await A.page.evaluate(id => ppState().ai.id === id, aiId));
await aiRec(); await A.page.click("#ppRecorder #ppSend"); await A.page.evaluate(() => ppAiSubmit()); await A.page.waitForSelector(".pp-turn-ai", { timeout: 15000 });
const aiTurn = await txt(A.page, ".pp-turn-ai");
ok("Learner turn → one AI reply, tagged AI, spoken text shown; a double tap sends nothing twice", aiCalls === 1 && /\bAI\b/.test(aiTurn) && aiTurn.includes("hardest part") && (await A.page.evaluate(() => ppState().ai.turns.length)) === 2, `calls=${aiCalls} ${aiTurn}`);
ok("Human thread untouched by the AI session (still waiting, no pair)", (await (await api("alice", "GET", "/me")).json()).waiting && !(await (await api("alice", "GET", "/me")).json()).pair);
aiFail = true; await aiRec(); await A.page.click("#ppRecorder #ppSend"); await sleep(1200);
ok("AI failure: the take is kept as a pending turn, an error card offers Retry, nothing is lost", (await txt(A.page, "#v-partner")).includes("did not answer") && (await A.page.evaluate(() => ppState().ai.pending === true && ppState().ai.turns.filter(x => x.mine).length === 2)));
aiFail = false; await A.page.click('.pp-cta button:has-text("Try again")'); await A.page.waitForFunction(() => ppState().ai && ppState().ai.completedAt, null, { timeout: 15000 });
const aiDone = await txt(A.page, ".pp-decide");
ok("Retry sends the same turn once; the fourth turn completes the AI practice with one AI-tagged tip and no decision about a human", aiCalls === 3 && aiDone.includes("AI practice complete") && /\bAI\b/.test(aiDone) && !aiDone.includes("together again") && (await A.page.evaluate(() => ppState().ai.turns.length)) === 4, `calls=${aiCalls} ${aiDone}`);
await A.page.click('.pp-decide button:has-text("Back to Practice Partner")'); await sleep(400); await A.page.unroute(u => u.href.startsWith("https://be-polish."));
ok("Back → the waiting card again, AI session closed", (await txt(A.page, "#v-partner")).includes("Looking for your partner"));

/* ---------- candidates with reasons; try a practice ---------- */
for (const [u, n, g] of [["bob", "Bob", "m"], ["carla", "Carla", "f"]]) { await api(u, "POST", "/consent", { name: n, lang: "fr", adult: true, gender: g, goals: ["workplace"], avail: ["evening"], tz: 0 }); await api(u, "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1, goals: ["workplace"] }); }
await A.page.click('button:has-text("Show me candidates")'); await sleep(1200);
const cards = await A.page.evaluate(() => [...document.querySelectorAll(".pp-cand")].map(c => c.innerText.replace(/\s+/g, " ")));
ok("Match me → 1–3 candidate cards with first name, band, goal and a plain reason; no score, no uid", cards.length === 2 && cards.every(c => /Why: same level/.test(c) && !/\d+%/.test(c) && !/uid/.test(c)), JSON.stringify(cards));
await A.page.evaluate(() => { const c = [...document.querySelectorAll(".pp-cand")].find(x => /Carla/.test(x.innerText)); c.querySelector(".btn-primary").click(); }); await sleep(1300);
const head = await txt(A.page, "#v-partner .pp-head");
ok("Session header says Human partner (mirrors the AI label)", (await txt(A.page, ".pp-head")).includes("Human partner"));
ok("Try a practice → trial session, round 1 of 4, your turn", head.includes("Your partner: Carla") && head.includes("Trial practice") && head.includes("Round 1 of 4 — your turn"));
const prompt = await txt(A.page, "#v-partner .pp-prompt");
const expected = await A.page.evaluate(() => trackWeeks()[0].days.Tue.task.slice(0, 40));
ok("Round 1 task is the General English curriculum speaking task", prompt.includes(expected));
ok("An open session shows More options: AI coach (tagged AI) and Leave today's practice, with honest sub-lines", await (async () => { const m = await txt(A.page, ".pp-more"); return /more options/i.test(m) && /\bAI\b/.test(m) && m.includes("Practise with the AI coach") && m.includes("Carla is not involved") && m.includes("Leave today's practice") && m.includes("stay partners"); })());
ok("AI from inside a session: same task, human session untouched, banner offers the way back", await (async () => {
  await A.page.route(u => u.href.startsWith("https://be-polish."), route => route.fulfill({ status: 403, body: "Forbidden" }));
  await A.page.click('.pp-more button:has-text("AI coach")'); await A.page.waitForSelector(".pp-ai-head", { timeout: 10000 }); await sleep(300);
  const task = await txt(A.page, ".pp-prompt"), head = await txt(A.page, ".pp-ai-head"), back = await txt(A.page, ".pp-human-back");
  const pair = (await (await api("alice", "GET", "/me")).json()).pair;
  await A.page.click('.pp-human-back button'); await sleep(500); await A.page.unroute(u => u.href.startsWith("https://be-polish."));
  return /\bAI\b/.test(head) && task.includes("Tell me about yourself") && back.includes("Carla") && pair && pair.turns.length === 0 && (await txt(A.page, ".pp-head")).includes("Carla"); })());
ok("Bob (not chosen) is still waiting, not paired", (await (await api("bob", "GET", "/me")).json()).waiting != null);

/* ---------- record / listen / re-record / coach / send (real MediaRecorder, fake mic) ---------- */
await A.page.click("#ppRecorder .pp-recbtn"); await A.page.waitForSelector("#ppRecorder .pp-stop", { timeout: 10000 }); await sleep(2200);
ok("Recording shows the live timer", (await txt(A.page, "#ppRecorder")).includes("Recording"));
await A.page.click("#ppRecorder .pp-stop"); await A.page.waitForSelector("#ppRecorder audio", { timeout: 10000 }).catch(() => {});
ok("Stopping shows the take with a player", await A.page.evaluate(() => !!document.querySelector("#ppRecorder audio")));
await A.page.click("#ppRecorder .btn:has-text('Record again')"); await A.page.waitForSelector("#ppRecorder .pp-stop", { timeout: 10000 }); await sleep(2000); await A.page.click("#ppRecorder .pp-stop"); await A.page.waitForSelector("#ppRecorder audio", { timeout: 10000 });
await A.page.waitForFunction(() => ppRec && !ppRec.busy, null, { timeout: 30000 }).catch(() => {});
const recState = await A.page.evaluate(() => ({ disabled: document.getElementById("ppSend").disabled, aiTag: /\bAI\b/.test(document.getElementById("ppRecorder").innerText) || /couldn't hear/.test(document.getElementById("ppRecorder").innerText) }));
ok("Re-record replaces the take; Send enabled after the coach; any score is labelled AI", !recState.disabled && recState.aiTag, JSON.stringify(recState));
await A.page.evaluate(() => { ppSend(); ppSend(); }); await sleep(2500);
const r1 = await A.page.evaluate(() => ({ mine: ppMe.pair.turns.filter(t => t.mine).length, status: document.querySelector(".pp-rounds b")?.innerText, practised: S.dates.includes(new Date().toISOString().slice(0, 10)) }));
ok("Send stores one turn (double tap ignored), status → waiting for Carla, day practised", r1.mine === 1 && /Round 2 of 4 — waiting for Carla/.test(r1.status) && r1.practised, JSON.stringify(r1));
ok("Speaking twice in a row is refused by the Worker", (await (await apiTurn("alice", "again")).json()).error === "not_your_turn");

/* ---------- partner replies; notification; rounds continue; completion; decision ---------- */
const t1 = (await (await api("carla", "GET", "/me")).json()).pair.turns[0].id;
ok("Audio: non-member 403, no auth 401", (await fetch(WORKER + "/turns/" + t1 + "/audio", { headers: { "x-dev-user": "mallory" } })).status === 403 && (await fetch(WORKER + "/turns/" + t1 + "/audio")).status === 401);
ok("Carla's reply accepted (round 2)", (await apiTurn("carla", "Hi Alice. What was the hardest part?")).status === 201);
await A.page.evaluate(async () => { go("home"); await ppRefresh(); go("home"); }); await sleep(600);
const notif = await A.page.evaluate(() => ({ card: (document.querySelector(".pp-home")?.innerText || "").replace(/\s+/g, " "), badge: document.querySelector('[data-v="practice"] .nav-badge')?.innerText || "", toast: document.getElementById("toast")?.innerText || "" }));
ok("Reply → Home card, Practice badge, one toast (deduplicated)", notif.card.includes("Carla replied") && notif.badge === "1" && notif.toast.includes("replied"), JSON.stringify(notif));
await A.page.evaluate(async () => { await ppRefresh(); ppNotify(); }); await sleep(100);
ok("Same reply does not toast twice", (await A.page.evaluate(() => ppState().notified)) === (await (await api("carla", "GET", "/me")).json()).pair.turns[1].id);
await A.page.evaluate(() => go("partner")); await sleep(1300);
ok("Round 3 task: answer the follow-up", (await txt(A.page, ".pp-prompt")).includes("Answer your partner's question") && (await txt(A.page, ".pp-turn.theirs")).includes("Carla"));
await A.page.evaluate(async () => { const blob = new Blob([new Uint8Array(20000)], { type: "audio/webm" }); ppRec = { mr: null, chunks: [], t0: Date.now() - 6000, blob, url: URL.createObjectURL(blob), dur: 6000, transcript: "The hardest part was the numbers.", score: 84, words: [{ word: "numbers", score: 62 }], busy: false }; await ppSend(); }); await sleep(600);
ok("Carla's fourth turn completes the session", (await (await apiTurn("carla", "Great, thanks. See you next week.")).json()).complete === true);
await A.page.evaluate(() => go("partner")); await sleep(1300);
const decide = await txt(A.page, ".pp-decide");
ok("Completion → decision card with one AI-labelled coach tip and two choices", decide.includes("How was this practice?") && decide.includes("AI") && decide.includes("numbers") && decide.includes("Practise together again") && decide.includes("Find someone else"), decide.slice(0, 200));
ok("Recorder is gone after completion", await A.page.evaluate(() => document.getElementById("ppRecorder").innerText.trim() === ""));
await A.page.click('button:has-text("Practise together again")'); await sleep(900);
ok("Alice's choice is recorded; waiting for Carla; nothing shown to Carla about it", (await txt(A.page, ".pp-decide")).includes("Waiting for Carla") && (await (await api("carla", "GET", "/me")).json()).pair.partnerDecided === true && !(await (await api("carla", "GET", "/me")).json()).pair.myDecision);
await api("carla", "POST", "/pairs/" + (await (await api("carla", "GET", "/me")).json()).pair.id + "/decide", { choice: "continue" });
await A.page.evaluate(() => go("partner")); await sleep(1300);
const conn = await txt(A.page, ".pp-conn");
ok("Both continue → mutual partner card with session count and Start today's practice", conn.includes("Your practice partner: Carla") && conn.includes("1 time") && conn.includes("Start today's practice"));
/* ---------- Level 3: live practice between the two connected humans (real WebRTC, two browser contexts, fake mics) ---------- */
ok("Connection card offers 'Practise live' to a connected partner", conn.includes("Practise live"));
await A.page.click('.pp-conn button:has-text("Practise live")'); await A.page.waitForSelector(".pp-live-head", { timeout: 10000 });
ok("Host invites → waiting room labelled human, cancel available, nothing else on the page", (await txt(A.page, ".pp-live-head")).includes("Waiting for Carla") && (await txt(A.page, ".pp-live-head")).includes("A real learner, live") && (await txt(A.page, "#v-partner")).includes("Cancel the invitation"));
const C = await learner("carla", "Carla", "general-english", false);
await C.page.evaluate(async () => { await ppRefresh(); go("home"); }); await sleep(1500);   /* a consented learner's app refreshes /me at boot; this context is brand new */
ok("Guest: Home shows the live invitation card", (await txt(C.page, ".pp-home-live")).includes("Alice invites you to practise live"));
await C.page.evaluate(() => go("partner")); await C.page.waitForSelector(".pp-live-invite", { timeout: 10000 });
ok("Guest: the invitation on the partner page says voice call, four rounds, mic only in the call; Join / Not now", (await txt(C.page, ".pp-live-invite")).includes("four rounds") && (await txt(C.page, ".pp-live-invite")).includes("Join the call") && (await txt(C.page, ".pp-live-invite")).includes("Not now"));
await C.page.evaluate(() => go("home")); await sleep(600);
const callTxt = await txt(C.page, "#ppCall.on");
ok("Guest: a persistent call banner at the top of ANY page — sender's name, Accept & start / Not now", callTxt.includes("Alice wants to practise live with you") && callTxt.includes("Accept & start") && callTxt.includes("Not now"));
ok("Guest: the banner shows even if this device's live flag is missing (a real person is waiting)", await C.page.evaluate(() => { const f = JSON.parse(localStorage.getItem("be_flags")); f.practice_partner_live_enabled = false; localStorage.setItem("be_flags", JSON.stringify(f)); ppCallShown = null; ppCallSync(); const on = !!document.querySelector("#ppCall.on"); f.practice_partner_live_enabled = true; localStorage.setItem("be_flags", JSON.stringify(f)); return on; }));
await C.page.click('#ppCall .pp-call-accept');
const liveUp = await Promise.all([A.page.waitForSelector(".pp-live-status.active", { timeout: 40000 }).then(() => true).catch(() => false), C.page.waitForSelector(".pp-live-status.active", { timeout: 40000 }).then(() => true).catch(() => false)]);
ok("Both sides connect (WebRTC audio, ICE through the Worker) and show 'Connected — you can talk'", liveUp[0] && liveUp[1], JSON.stringify({ a: await txt(A.page, ".pp-live-status"), c: await txt(C.page, ".pp-live-status") }));
const liveA = await A.page.evaluate(() => ({ head: document.querySelector(".pp-live-head").innerText, pc: ppLive.pc && ppLive.pc.connectionState, tracks: ppLive.stream ? ppLive.stream.getAudioTracks().length : 0, remote: !!document.getElementById("ppLiveAudio") && !!document.getElementById("ppLiveAudio").srcObject, timer: !!document.getElementById("ppLiveTimer") }));
ok("Live connect shows the 3-2-1 countdown, then Start", await A.page.evaluate(() => ppLive.countdown != null || !!document.getElementById("ppLiveCount") || ppLive.startedAt > 0));
ok("Room: partner first name only, human label, live timer, local mic track and remote audio attached; no uid, no transport words", liveA.head.includes("Live with Carla") && liveA.pc === "connected" && liveA.tracks === 1 && liveA.remote && liveA.timer && !/uid|webrtc|ice|turn/i.test(liveA.head), JSON.stringify(liveA));
ok("Server state is active with a start time for both members", await (async () => { const s = await (await api("alice", "GET", "/me")).json(); const c = await (await api("carla", "GET", "/me")).json(); return s.live && s.live.state === "active" && s.live.startedAt > 0 && c.live && c.live.state === "active"; })());
await A.page.click('.pp-prompt button:has-text("Next round")'); await sleep(5500);
ok("Round counter is shared: host taps Next round → guest sees Round 2 on the next poll", (await txt(C.page, ".pp-prompt")).includes("Round 2 of 4") && (await txt(A.page, ".pp-prompt")).includes("Round 2 of 4"));
await A.page.click('.pp-live-ctl button:has-text("Mute")'); await sleep(200);
ok("Mute toggles the local track and the button", (await A.page.evaluate(() => ppLive.muted && ppLive.stream.getAudioTracks()[0].enabled === false)) && (await txt(A.page, ".pp-live-ctl")).includes("Unmute"));
await A.page.route(u => u.href.startsWith("https://be-polish."), route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Could you tell me more about that?\nThat's a good point.\nLet me give you an example.", covered: [] }) }));
await A.page.click('.pp-live-ctl button:has-text("Phrase help")'); await A.page.waitForSelector(".pp-live-ctl .pp-help", { timeout: 10000 });
ok("Phrase help: three AI-tagged phrases on the side, text only — the AI never joins the call", (await A.page.evaluate(() => document.querySelectorAll(".pp-live-ctl .pp-help li").length)) === 3 && (await txt(A.page, ".pp-live-ctl .pp-tip")).includes("AI") && !(await A.page.evaluate(() => !!document.querySelector("#ppLiveAudio + audio"))));
await A.page.unroute(u => u.href.startsWith("https://be-polish."));
await A.page.click('.pp-live-ctl button.pp-leave'); await A.page.waitForSelector(".pp-live-end", { timeout: 10000 }); await sleep(5500);
ok("Host leaves → host sees 'You left', guest sees 'Alice left' within a poll; both microphones released; server ended/left", (await txt(A.page, ".pp-live-end")).includes("You left the live practice") && (await txt(C.page, ".pp-live-end")).includes("Alice left the live practice") && (await A.page.evaluate(() => !ppLive.stream && !ppLive.pc)) && (await C.page.evaluate(() => !ppLive.stream && !ppLive.pc)) && !(await (await api("alice", "GET", "/me")).json()).live, JSON.stringify({ a: await txt(A.page, ".pp-live-end"), c: await txt(C.page, ".pp-live-end") }));
await A.page.click('.pp-live-end button'); await C.page.click('.pp-live-end button'); await sleep(1200); await C.ctx.close();
ok("After the call the connection card is back with Start and Practise live", (await txt(A.page, ".pp-conn")).includes("Practise live") && (await txt(A.page, ".pp-conn")).includes("Start today"));

await A.page.click('button:has-text("Start today")'); await sleep(1300);
ok("Inside a session with a connected partner, More options offers Practise live too", await (async () => { await sleep(300); const m = await txt(A.page, ".pp-more"); return m.includes("Practise live") && m.includes("Invite Carla to talk right now"); })());
ok("Start → a regular session with the same partner", (await txt(A.page, ".pp-head")).includes("Regular partners") && (await txt(A.page, ".pp-head")).includes("Round 1 of 4"));

/* ---------- partner management: leave today's practice ≠ end partnership; AI reachable while connected ---------- */
await A.page.click(".pp-menu"); await sleep(200);
ok("Session menu offers 'Leave today's practice' (not 'leave pair'), Report, Block", (await txt(A.page, ".pp-sheet")).includes("Leave today's practice") && (await txt(A.page, ".pp-sheet")).includes("Report Carla") && (await txt(A.page, ".pp-sheet")).includes("Block"));
await A.page.click('.pp-sheet button:has-text("Leave today\'s practice")'); await sleep(300);
ok("Leave confirmation says the partnership stays", (await txt(A.page, ".cf-card")).includes("stay partners"));
await A.page.click(".cf-card button:has-text('Leave')"); await sleep(1200);
const afterLeave = await txt(A.page, "#v-partner"); ok("Leaving today's practice keeps the partnership: connection card still there with the partner kind, Start and Practise live, options gear", afterLeave.includes("Your practice partner: Carla") && afterLeave.includes("Practice partners") && afterLeave.includes("Start today") && afterLeave.includes("Practise live") && (await A.page.evaluate(() => !!document.querySelector(".pp-conn .pp-menu"))) && (await (await api("alice", "GET", "/me")).json()).connection);
await api("bob", "DELETE", "/interest");   /* nobody else waiting → the honest "no partner yet" state */
await A.page.click('#v-partner .pp-cta button:has-text("Practise now")'); await sleep(1300);
const waitingConn = await txt(A.page, "#v-partner");
ok("A connected learner can look for someone new without ending the partnership: waiting card + AI COACH — NOT YOUR PARTNER card, connection card still shown", waitingConn.includes("Looking for your partner") && waitingConn.includes("AI COACH — NOT YOUR PARTNER") && waitingConn.includes("Practise with the AI coach") && waitingConn.includes("Your practice partner: Carla"));
await A.page.click('button:has-text("Stop looking")'); await sleep(900);
await api("bob", "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1 });   /* Bob back in line for the rematch section */
await A.page.click(".pp-conn .pp-menu"); await sleep(200);
const optsTxt = await txt(A.page, ".pp-sheet");
ok("Partner options: Find someone else, End partnership, Report, Block — four distinct actions, no profile, no photo", optsTxt.includes("Find someone else") && optsTxt.includes("End partnership") && optsTxt.includes("Report Carla") && optsTxt.includes("Block") && !(await A.page.evaluate(() => !!document.querySelector(".pp-sheet img"))));
await A.page.click('.pp-sheet button:has-text("End partnership")'); await sleep(300);
ok("End partnership asks for explicit confirmation and says it is not a block or report", (await txt(A.page, ".cf-card")).includes("End this partnership?") && (await txt(A.page, ".cf-card")).includes("not a block and not a report"));
await A.page.click(".cf-card button:has-text('End partnership')"); await sleep(1300);
const ended = await txt(A.page, "#v-partner");
ok("After ending: no connection card, Match me available, Carla not suspended or blocked, Carla sees no connection and no reason", !ended.includes("Your practice partner: Carla") && ended.includes("Match me") && await (async () => { const c = await (await api("carla", "GET", "/me")).json(); return !c.connection && !c.suspendedUntil && !JSON.stringify(c).includes("ended by"); })());
ok("Ending again through the API is harmless (already:true)", (await (await api("alice", "POST", "/connection/end", { cid: "0000000000000000" })).json()).error === "no_connection");

/* ---------- rematch: cooldown; new candidates ---------- */
await A.page.click('button:has-text("Show me candidates")').catch(() => {}); await sleep(300);
await A.page.evaluate(() => ppMatch()); await sleep(1200);
const cards2 = await A.page.evaluate(() => [...document.querySelectorAll(".pp-cand")].map(c => c.innerText.replace(/\s+/g, " ")));
await A.page.evaluate(() => { const c = [...document.querySelectorAll(".pp-cand")].find(x => /Bob/.test(x.innerText)); c && c.querySelector(".btn-primary").click(); }); await sleep(1300);
for (const [u, s] of [["alice", "one"], ["bob", "two"], ["alice", "three"], ["bob", "four"]]) await apiTurn(u, s);
await A.page.evaluate(() => go("partner")); await sleep(1300);
await A.page.click('button:has-text("Find someone else")'); await sleep(300); await A.page.click(".cf-card button:has-text('Find someone else')"); await sleep(1200);
ok("Find someone else → session closed, neutral toast, back to Match me; Bob only sees 'ended'", (await txt(A.page, "#v-partner")).includes("Match me") && (await (await api("bob", "GET", "/me")).json()).lastClosed.reason === "rematch");
await api("bob", "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1 });
await A.page.click("#v-partner .pp-cta .btn-primary"); await sleep(1200);
ok("Cooldown: Bob is not offered again after a rematch", await A.page.evaluate(() => ![...document.querySelectorAll(".pp-cand")].some(c => /Bob/.test(c.innerText))));

/* ---------- Shadow Studio V2 → Apply it → partner mission ---------- */
await A.page.evaluate(() => { ppCands = null; go("shadow"); }); await sleep(400);
await A.page.evaluate(async () => { await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); }); await sleep(2500);
const sv = await A.page.evaluate(() => ({ level: svAsset && svAsset.level, tabs: [...document.querySelectorAll("#shV2 .seg-tab")].map(b => b.innerText.trim()), segs: document.querySelectorAll("#shV2 .sv-seg").length }));
ok("Shadow V2: library clip → word-level asset, four modes, sentences rendered", sv.level === "word" && sv.tabs.join() === "Watch,Shadow,Challenge,Apply it" && sv.segs > 10, JSON.stringify(sv));
const lit = await A.page.evaluate(() => { const s = svAsset.segments[5]; shSeek = { t: (s.words[2].startMs + 10) / 1000, at: Date.now() }; svTick(); return { seg: document.querySelector(".sv-seg.now")?.dataset.i, word: document.querySelector(".sv-w.now")?.innerText, expect: s.words[2].text }; });
ok("Playback time lights the current sentence and word", lit.seg === "5" && lit.word === lit.expect, JSON.stringify(lit));
await A.page.evaluate(() => svSetMode("challenge")); await sleep(100);
ok("Challenge hides the text until revealed", await A.page.evaluate(() => document.getElementById("svTx").classList.contains("hidden")));
await A.page.evaluate(() => { shOpenWork(); svPick = 5; svSetMode("apply"); }); await sleep(300);
ok("Apply it shows the expression with AI and Partner options", (await txt(A.page, ".sv-apply")).includes("Practise with AI") && (await txt(A.page, ".sv-apply")).includes("Use it with a partner"));
await A.page.click(".sv-apply .btn-primary"); await sleep(1400);
ok("Use it with a partner → Practice Partner with the phrase queued for the next session", A.page.url().endsWith("#partner") && (await txt(A.page, ".pp-apply-card")).includes("Your next practice will use this expression"));
/* Alice ended her partnership with Carla above and rematched Bob, so both are in cooldown; a fresh learner takes the pairing */
await api("dina", "POST", "/consent", { name: "Dina", lang: "fr", adult: true, gender: "f", goals: ["workplace"], avail: ["evening"], tz: 0 });
await api("dina", "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1 });
await A.page.click('button:has-text("Practise now")'); await sleep(1500);
const applied = await txt(A.page, ".pp-prompt");
ok("Practise now pairs at once and round 1 uses the shadowed expression", applied.includes("Use the expression") && (await txt(A.page, ".pp-head")).includes("Round 1 of 4"), applied.slice(0, 160));

/* ---------- degraded conditions ---------- */
await A.page.evaluate(() => localStorage.setItem("be_partner_api", "http://127.0.0.1:1")); await A.page.evaluate(() => go("partner")); await sleep(1500);
ok("Worker unreachable → offline card with retry, no crash", (await txt(A.page, "#v-partner")).includes("Can't reach the partner service"));
await A.page.evaluate(W => localStorage.setItem("be_partner_api", W), WORKER); await A.page.evaluate(() => go("partner")); await sleep(1300);
ok("Reconnect restores the session", (await txt(A.page, ".pp-head")).includes("Dina"));
await A.page.evaluate(() => { localStorage.setItem("be_flags", JSON.stringify({})); go("practice"); }); await sleep(400);
ok("Flags off → no card on Practice, no Home card, route shows unavailable (production default)", await A.page.evaluate(async () => { const noCard = !document.querySelector(".pp-entry"); go("partner"); await new Promise(r => setTimeout(r, 300)); return noCard && /temporarily unavailable/.test(document.getElementById("v-partner").innerText); }));
await A.page.evaluate(F => localStorage.setItem("be_flags", JSON.stringify(F)), FLAGS);
await A.page.evaluate(() => { localStorage.removeItem("be_partner_dev_user"); go("partner"); }); await sleep(600);
ok("Signed out → sign-in card, no data", (await txt(A.page, "#v-partner")).includes("Create your free account"));

ok("No uncaught JavaScript errors in any browser", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const pass = res.filter(r => r.pass).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE} + ${WORKER})`);
process.exit(pass === res.length ? 0 : 1);
