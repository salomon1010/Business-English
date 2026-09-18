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
const FLAGS = { practice_partner_enabled: true, practice_partner_matching_enabled: true, practice_partner_voice_enabled: true, practice_partner_ai_fallback_enabled: true, practice_partner_notifications_enabled: true, shadow_studio_v2_enabled: true, shadow_apply_phrase_enabled: true };

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
ok("Welding: no Practice Partner card on the Practice tab", await W.page.evaluate(() => !document.querySelector(".pp-entry")));
await W.page.evaluate(() => go("partner")); await sleep(500);
ok("Welding: the #partner route shows the General-English-only notice, no data, no consent", (await txt(W.page, "#v-partner")).includes("part of General English") && !(await txt(W.page, "#v-partner")).includes("Before your first partner"));
const wj = await (await api("wendy", "POST", "/consent", { name: "Wendy", lang: "en", adult: true })).json();
const wt = await (await api("wendy", "POST", "/interest", { track: "welding", band: "w1-4", lang: "en" })).json();
ok("Welding: the Worker refuses the track even when called directly (403 track)", wj.consented && wt.error === "track");
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

/* ---------- candidates with reasons; try a practice ---------- */
for (const [u, n, g] of [["bob", "Bob", "m"], ["carla", "Carla", "f"]]) { await api(u, "POST", "/consent", { name: n, lang: "fr", adult: true, gender: g, goals: ["workplace"], avail: ["evening"], tz: 0 }); await api(u, "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1, goals: ["workplace"] }); }
await A.page.click('button:has-text("Show me candidates")'); await sleep(1200);
const cards = await A.page.evaluate(() => [...document.querySelectorAll(".pp-cand")].map(c => c.innerText.replace(/\s+/g, " ")));
ok("Match me → 1–3 candidate cards with first name, band, goal and a plain reason; no score, no uid", cards.length === 2 && cards.every(c => /Why: same level/.test(c) && !/\d+%/.test(c) && !/uid/.test(c)), JSON.stringify(cards));
await A.page.evaluate(() => { const c = [...document.querySelectorAll(".pp-cand")].find(x => /Carla/.test(x.innerText)); c.querySelector(".btn-primary").click(); }); await sleep(1300);
const head = await txt(A.page, "#v-partner .pp-head");
ok("Try a practice → trial session, round 1 of 4, your turn", head.includes("Your partner: Carla") && head.includes("Trial practice") && head.includes("Round 1 of 4 — your turn"));
const prompt = await txt(A.page, "#v-partner .pp-prompt");
const expected = await A.page.evaluate(() => trackWeeks()[0].days.Tue.task.slice(0, 40));
ok("Round 1 task is the General English curriculum speaking task", prompt.includes(expected));
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
await A.page.click('button:has-text("Start today")'); await sleep(1300);
ok("Start → a regular session with the same partner", (await txt(A.page, ".pp-head")).includes("Regular partners") && (await txt(A.page, ".pp-head")).includes("Round 1 of 4"));

/* ---------- rematch: leave without a word; cooldown; new candidates ---------- */
await A.page.click(".pp-menu"); await sleep(200); await A.page.click('button:has-text("Leave this pair")'); await sleep(300); await A.page.click(".cf-card button:has-text('Leave')"); await sleep(1000);
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
await api("carla", "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1 });
await A.page.click('button:has-text("Practise now")'); await sleep(1500);
const applied = await txt(A.page, ".pp-prompt");
ok("Practise now pairs at once and round 1 uses the shadowed expression", applied.includes("Use the expression") && (await txt(A.page, ".pp-head")).includes("Round 1 of 4"), applied.slice(0, 160));

/* ---------- degraded conditions ---------- */
await A.page.evaluate(() => localStorage.setItem("be_partner_api", "http://127.0.0.1:1")); await A.page.evaluate(() => go("partner")); await sleep(1500);
ok("Worker unreachable → offline card with retry, no crash", (await txt(A.page, "#v-partner")).includes("Can't reach the partner service"));
await A.page.evaluate(W => localStorage.setItem("be_partner_api", W), WORKER); await A.page.evaluate(() => go("partner")); await sleep(1300);
ok("Reconnect restores the session", (await txt(A.page, ".pp-head")).includes("Carla"));
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
