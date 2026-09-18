/* Practice Partner — browser end-to-end, two learners, mobile viewport.
   Needs the local Worker:  cd backend/partner && npx wrangler dev --env dev --port 8787
   Run:                     cd tests && node partner.mjs        (or npm run test:partner)
   Skips with exit 0 when the Worker is not reachable, so `npm test` still
   passes on a machine without wrangler. Uses Chromium's fake microphone, so
   the real MediaRecorder path runs; the transcript/score come from the polish
   Worker when online, or stay empty offline — both are valid sends. */
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

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
async function learner(id, name, weekDone) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  await ctx.addInitScript(({ id, name, weekDone, WORKER }) => {
    localStorage.setItem("be_partner_api", WORKER); localStorage.setItem("be_partner_dev_user", id);
    if (!localStorage.getItem("be12_v1")) {
      const st = { profile: { name, role: "", goal: "", slot: "", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "general-english" },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() };
      if (weekDone) ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(d => st.days["w1" + d] = true);
      localStorage.setItem("be12_v1", JSON.stringify(st)); sessionStorage.setItem("be_view", "#practice");
    }
  }, { id, name, weekDone, WORKER });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  await page.goto(BASE + "/index.html?pp=" + Date.now() + "#practice", { waitUntil: "load" });
  await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });
  return { ctx, page, id, name };
}
const txt = (page, sel) => page.evaluate(s => (document.querySelector(s)?.innerText || "").replace(/\s+/g, " "), sel);

const A = await learner("alice", "Alice Ngo", false), B = await learner("bob", "Bob Diallo", true);

/* new user: card on Practice, consent first, refusing shares nothing */
ok("Practice tab shows the Practice Partner card", (await txt(A.page, ".pp-entry")).includes("Practice Partner"));
await A.page.click(".pp-entry"); await sleep(1200);
ok("Opening it lands on #partner under the Practice tab", A.page.url().endsWith("#partner") && await A.page.evaluate(() => document.querySelector('.bnav-item[data-v="practice"]').classList.contains("on")));
ok("First visit asks for consent before anything is shared", (await txt(A.page, "#v-partner")).includes("Before your first partner"), await txt(A.page, "#v-partner"));
await A.page.click("#v-partner .pp-cta button"); await sleep(300);
ok("Consent sheet states what is shared", (await txt(A.page, ".pp-consent")).includes("first name") && (await txt(A.page, ".pp-consent")).includes("14 days"));
await A.page.click(".pp-consent .btn:not(.btn-primary)"); await sleep(300);
ok("Refusing consent keeps the learner unregistered", !(await (await fetch(WORKER + "/me", { headers: { "x-dev-user": "alice" } })).json()).consented);
await A.page.click("#v-partner .pp-cta button"); await sleep(300);
await A.page.click('.pp-consent label:has(input[value="f"])'); await A.page.click(".pp-consent .pp-check"); await A.page.click(".pp-consent .btn-primary"); await sleep(900);
ok("Agreeing registers and offers a partner", (await txt(A.page, "#v-partner")).includes("Get a partner"));

/* no available partner → waiting; refresh keeps it; withdraw works */
await A.page.click("#v-partner .pp-cta .btn-primary"); await sleep(1000);
ok("No compatible partner → waiting state, first in line", (await txt(A.page, "#v-partner")).includes("first in line"));
await A.page.reload({ waitUntil: "load" }); await sleep(1500);
ok("Refresh restores the waiting state on #partner", A.page.url().endsWith("#partner") && (await txt(A.page, "#v-partner")).includes("Looking for your partner"));
await A.page.click("text=Stop looking"); await sleep(800);
ok("Withdraw returns to 'Get a partner'", (await txt(A.page, "#v-partner")).includes("Get a partner"));
await A.page.click("#v-partner .pp-cta .btn-primary"); await sleep(900);

/* matching constraint: bob (man, no same-gender) must not pair with alice (same-gender on) */
await B.page.click(".pp-entry"); await sleep(1200); await B.page.click("#v-partner .pp-cta button"); await sleep(300);
await B.page.click('.pp-consent label:has(input[value="m"])'); await B.page.click(".pp-consent .btn-primary"); await sleep(900);
await B.page.click("#v-partner .pp-cta .btn-primary"); await sleep(1000);
ok("Same-gender preference is honoured (Bob is not paired with Alice)", (await txt(B.page, "#v-partner")).includes("Looking for your partner"));
/* a compatible partner: carla, woman */
await fetch(WORKER + "/consent", { method: "POST", headers: { "x-dev-user": "carla", "content-type": "application/json" }, body: JSON.stringify({ name: "Carla", lang: "fr", gender: "f" }) });
const cj = await (await fetch(WORKER + "/interest", { method: "POST", headers: { "x-dev-user": "carla", "content-type": "application/json" }, body: JSON.stringify({ track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1 }) })).json();
ok("Compatible learner → paired at once", cj.status === "paired" && cj.pair.partner.name === "Alice");
await A.page.click("text=Check again"); await sleep(1200);
const head = await txt(A.page, "#v-partner .pp-head");
ok("Alice sees her partner: first name, band, day — nothing else", head.includes("Your partner: Carla") && head.includes("Day 1 of 7") && !head.includes("@"));
const promptText = await txt(A.page, "#v-partner .pp-prompt");
const expected = await A.page.evaluate(() => trackWeeks()[0].days.Tue.task.slice(0, 40));
ok("Today's prompt is the curriculum's speaking task (Week 1 · Tue)", promptText.includes(expected));

/* recording with the fake microphone: record → stop → playback → re-record → send */
const recordOnce = async (page, ms) => {
  await page.click("#ppRecorder .pp-recbtn, #ppRecorder .btn:has-text('Record again')");
  await page.waitForSelector("#ppRecorder .pp-stop", { timeout: 10000 }); await sleep(ms);
  await page.click("#ppRecorder .pp-stop");
  await page.waitForSelector("#ppRecorder audio", { timeout: 10000 });
};
await A.page.click("#ppRecorder .pp-recbtn"); await A.page.waitForSelector("#ppRecorder .pp-stop", { timeout: 10000 }); await sleep(2500);
ok("Recording state shows the live timer", (await txt(A.page, "#ppRecorder")).includes("Recording"));
await A.page.click("#ppRecorder .pp-stop"); await A.page.waitForSelector("#ppRecorder audio", { timeout: 10000 }).catch(() => {});
ok("Stopping shows the take with a player and a re-record option", await A.page.evaluate(() => !!document.querySelector("#ppRecorder audio") && !!document.querySelector("#ppRecorder .pp-row")), await txt(A.page, "#ppRecorder"));
await recordOnce(A.page, 2200);
ok("Re-record replaces the take", await A.page.evaluate(() => !!document.querySelector("#ppRecorder audio") && ppRec && ppRec.blob && ppRec.blob.size > 1000));
await A.page.waitForFunction(() => ppRec && !ppRec.busy, null, { timeout: 30000 }).catch(() => {});
const sendState = await A.page.evaluate(() => ({ disabled: document.getElementById("ppSend").disabled, hasScoreOrNote: /Coach score|couldn't hear|The coach/.test(document.getElementById("ppRecorder").innerText) }));
ok("Send is enabled once the coach has finished (score shown, or an honest note when it heard nothing)", !sendState.disabled && sendState.hasScoreOrNote, JSON.stringify(sendState));
await A.page.evaluate(() => { ppSend(); ppSend(); });   /* duplicate tap */
await sleep(2500);
const afterSend = await A.page.evaluate(() => ({ turns: ppMe.pair.turns.filter(t => t.mine).length, mine: (document.querySelector(".pp-turn.mine")?.innerText || "").replace(/\s+/g, " "), practised: S.dates.includes(new Date().toISOString().slice(0, 10)) }));
ok("Send stores exactly one turn (double tap ignored), marks the day practised", afterSend.turns === 1 && afterSend.mine.includes("You") && afterSend.practised, JSON.stringify(afterSend));

/* partner receives: carla's view via API, audio protected, then she replies */
const carlaMe = await (await fetch(WORKER + "/me", { headers: { "x-dev-user": "carla" } })).json();
ok("Partner sees the turn as unread", carlaMe.pair.unread === 1);
const turnId = carlaMe.pair.turns[0].id;
const mallory = await fetch(WORKER + "/turns/" + turnId + "/audio", { headers: { "x-dev-user": "mallory" } });
const noauth = await fetch(WORKER + "/turns/" + turnId + "/audio");
ok("Audio is refused to non-members (403) and without auth (401)", mallory.status === 403 && noauth.status === 401, mallory.status + " " + noauth.status);
const fd = new FormData(); fd.set("audio", new Blob([new Uint8Array(30000)], { type: "audio/webm" }), "r.webm"); fd.set("day", "0"); fd.set("transcript", "Hi Alice, I am Carla, I work in a bank in Yaounde."); fd.set("score", "77"); fd.set("duration_ms", "7000");
ok("Partner reply accepted", (await fetch(WORKER + "/turns", { method: "POST", headers: { "x-dev-user": "carla" }, body: fd })).status === 201);

/* original user is notified: Home card + Practice badge + toast; thread shows the reply and plays it */
await A.page.evaluate(async () => { go("home"); await ppRefresh(); go("home"); });
await sleep(600);
const notif = await A.page.evaluate(() => ({ card: (document.querySelector(".pp-home")?.innerText || "").replace(/\s+/g, " "), badge: document.querySelector('[data-v="practice"] .nav-badge')?.innerText || "", toast: document.getElementById("toast")?.innerText || "" }));
ok("Reply → Home card, Practice badge and toast", notif.card.includes("Carla replied") && notif.badge === "1" && notif.toast.includes("replied"), JSON.stringify(notif));
await A.page.evaluate(() => go("partner")); await sleep(1300);
ok("Thread shows the partner's turn with transcript and duo streak 1", (await txt(A.page, ".pp-turn.theirs")).includes("Carla") && (await txt(A.page, ".pp-stats")).includes("Duo streak 1"));
const played = await A.page.evaluate(async () => { const id = ppMe.pair.turns.find(t => !t.mine).id; await ppPlay(id, null); return ppAudioUrls.has(id); });
ok("Partner audio streams through the Worker with credentials", played);
ok("Opening the thread clears unread", (await (await fetch(WORKER + "/me", { headers: { "x-dev-user": "alice" } })).json()).pair.unread === 0);

/* partner timeout → explicit AI fallback, never impersonating the partner.
   Alice speaks again (a synthetic take — the recorder path is already proven), then Carla stays silent for 30 h. */
await A.page.evaluate(async () => { const blob = new Blob([new Uint8Array(20000)], { type: "audio/webm" }); ppRec = { mr: null, chunks: [], t0: Date.now() - 6000, blob, url: URL.createObjectURL(blob), dur: 6000, transcript: "Thanks Carla. What do you do at the bank?", score: 80, words: null, busy: false }; await ppSend(); });
await sleep(800);
await A.page.evaluate(() => localStorage.setItem("be_partner_dev_now", String(Date.now() + 30 * 3600 * 1000)));
await A.page.evaluate(() => go("partner")); await sleep(1300);
const fb = await txt(A.page, ".pp-fallback");
ok("After 24 h of silence: explicit AI-coach fallback, labelled as AI", fb.includes("hasn't responded yet") && fb.includes("AI COACH — NOT YOUR PARTNER") && fb.includes("Practise with the AI coach"));
await A.page.click(".pp-fallback .btn-primary"); await sleep(600);
ok("The fallback opens the existing AI conversation practice", A.page.url().endsWith("#roleplay"));
await A.page.evaluate(() => localStorage.removeItem("be_partner_dev_now"));

/* network failure: Worker unreachable → honest offline card, retry works */
await A.page.evaluate(() => localStorage.setItem("be_partner_api", "http://127.0.0.1:1"));
await A.page.evaluate(() => go("partner")); await sleep(1500);
ok("Worker unreachable → offline card with retry, no crash", (await txt(A.page, "#v-partner")).includes("Can't reach the partner service"));
await A.page.evaluate(W => localStorage.setItem("be_partner_api", W), WORKER);
await A.page.evaluate(() => go("partner")); await sleep(1300);
ok("Retry after reconnect restores the thread", (await txt(A.page, "#v-partner .pp-head")).includes("Carla"));

/* report and block from the thread menu; blocked side loses access */
await A.page.click(".pp-menu"); await sleep(200);
ok("Menu offers Report, Block and Leave", (await txt(A.page, ".pp-sheet")).includes("Report") && (await txt(A.page, ".pp-sheet")).includes("Block") && (await txt(A.page, ".pp-sheet")).includes("Leave"));
await A.page.click(".pp-sheet-btn >> nth=0"); await sleep(200); await A.page.click("text=Asked for contact details"); await sleep(800);
ok("Report recorded; the pair continues after one report", (await txt(A.page, "#toast")).includes("report is recorded") && await A.page.evaluate(() => !!ppMe.pair));
await A.page.click(".pp-menu"); await sleep(200); await A.page.click(".pp-sheet-btn >> nth=1"); await sleep(300);
await A.page.click(".cf-card button:has-text('Block')"); await sleep(1000);
const carlaAfter = await fetch(WORKER + "/turns/" + turnId + "/audio", { headers: { "x-dev-user": "carla" } });
ok("Block ends the pair; the blocked partner loses access to the audio (403)", await A.page.evaluate(() => !ppMe.pair) && carlaAfter.status === 403, String(carlaAfter.status));

/* logout/login: without an identity the feature asks to sign in; nothing else breaks */
await A.page.evaluate(() => { localStorage.removeItem("be_partner_dev_user"); go("partner"); }); await sleep(600);
ok("Signed out → sign-in card, no data shown", (await txt(A.page, "#v-partner")).includes("Create your free account"));
await A.page.evaluate(() => { localStorage.setItem("be_partner_dev_user", "alice"); go("partner"); }); await sleep(1300);
ok("Signed back in → own state restored (can get a new partner)", (await txt(A.page, "#v-partner")).includes("Get a partner"));

ok("No uncaught JavaScript errors in either learner's browser", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); if (server) server.kill();
const pass = res.filter(r => r.pass).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE} + ${WORKER})`);
process.exit(pass === res.length ? 0 : 1);
