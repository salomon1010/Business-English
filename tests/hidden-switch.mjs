/* The Visible / Hidden switch between the Practise and History tabs (owner,
   2026-09-26): one tap and the learner cannot be found, invited or called;
   the AI coach still works; one tap back. Alice in a browser, Bob over the
   API.  Needs the local Worker on 8797 (see live-rounds.mjs) and the site on
   8773:   PARTNER_API=http://127.0.0.1:8797 BASE=http://127.0.0.1:8773 node hidden-switch.mjs */
import { chromium } from "playwright";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WORKER = process.env.PARTNER_API || "http://127.0.0.1:8797", BASE = process.env.BASE || "http://127.0.0.1:8773";
let workerUp = false; try { workerUp = (await fetch(WORKER + "/health")).ok; } catch (e) {}
if (!workerUp) { console.log(`  SKIP  hidden switch — local Worker not reachable at ${WORKER}`); process.exit(0); }
await fetch(WORKER + "/__reset", { method: "POST" });
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const api = (u, m, p, b) => fetch(WORKER + p, { method: m, headers: { "x-dev-user": u, ...(b ? { "content-type": "application/json" } : {}) }, body: b ? JSON.stringify(b) : undefined });
const FLAGS = { practice_partner_live_enabled: true, practice_partner_enabled: true, practice_partner_matching_enabled: true, practice_partner_voice_enabled: true, practice_partner_ai_fallback_enabled: true };
for (const [u, n] of [["alice", "Alice"], ["bob", "Bob"], ["carl", "Carl"]]) {
  await api(u, "POST", "/consent", { name: n, lang: "fr", adult: true, gender: "f", goals: ["workplace"], avail: ["evening"], tz: 0 });
  await api(u, "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1, goals: ["workplace"] });
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(({ WORKER, FLAGS }) => {
  localStorage.setItem("be_partner_api", WORKER); localStorage.setItem("be_partner_dev_user", "alice"); localStorage.setItem("be_flags", JSON.stringify(FLAGS));
  localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Alice", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: true }));
  sessionStorage.setItem("be_view", "#partner");
}, { WORKER, FLAGS });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto(BASE + "/index.html?hs=" + Date.now() + "#partner", { waitUntil: "load" });
await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });
await page.evaluate(async () => { go("partner"); await ppRefresh(true); ppRender(document.getElementById("v-partner")); }); await sleep(400);
const txt = sel => page.evaluate(s => (document.querySelector(s)?.innerText || "").replace(/\s+/g, " "), sel);
const tabs = () => page.evaluate(() => [...document.querySelectorAll(".pp-tabs .seg-tab")].map(b => b.innerText.trim()));
const online = async () => (await (await fetch(WORKER + "/presence")).json()).online;

ok("The tabs row reads Practise · Visible · History; the switch carries a green dot and is a switch, not a tab", JSON.stringify(await tabs()) === JSON.stringify(["Practise", "Visible", "History"]) && await page.evaluate(() => { const b = document.querySelector(".pp-vis"); return b.getAttribute("role") === "switch" && b.getAttribute("aria-checked") === "true" && !!b.querySelector(".pp-vis-dot") && b.classList.contains("is-visible"); }), JSON.stringify(await tabs()));
const onlineBefore = await online();
await page.click(".pp-vis"); await sleep(900);
const hid = await page.evaluate(() => ({ me: ppMe.prefs.optedOut, cls: document.querySelector(".pp-vis").className, checked: document.querySelector(".pp-vis").getAttribute("aria-checked"), page: document.getElementById("v-partner").innerText.replace(/\s+/g, " "), toast: (document.querySelector(".toast, #toast")?.innerText || "") }));
ok("Tap → Hidden: the switch reads Hidden with a grey dot, the server agrees (opted out), a toast explains", hid.me === true && /is-hidden/.test(hid.cls) && hid.checked === "false" && /hidden/i.test(hid.toast), JSON.stringify({ me: hid.me, cls: hid.cls, toast: hid.toast }));
ok("The Practise tab shows the hidden card — nobody can find, invite or call you — with Become visible, and the AI coach still on offer; no Match me", /You are hidden right now/.test(hid.page) && /Become visible/.test(hid.page) && /AI/.test(hid.page) && !/Match me/.test(hid.page), hid.page.slice(0, 300));
ok("Hidden learners are not counted online", (await online()) === onlineBefore - 1, `${onlineBefore} → ${await online()}`);
ok("Carl's Match me no longer offers Alice", await (async () => { const m = await (await api("carl", "POST", "/match", {})).json(); return !(m.candidates || []).some(c => c.name === "Alice"); })());
ok("Match me / Practise now are refused on the phone with a plain message, no queue join", await page.evaluate(async () => { await ppMatch(); await ppNow(); return !ppMe.waiting && /hidden/i.test(document.querySelector(".toast, #toast")?.innerText || ""); }));
await page.click('.pp-hidden-card button:has-text("Become visible")'); await sleep(900);
const back = await page.evaluate(() => ({ me: ppMe.prefs.optedOut, tabs: [...document.querySelectorAll(".pp-tabs .seg-tab")].map(b => b.innerText.trim()), page: document.getElementById("v-partner").innerText.replace(/\s+/g, " ") }));
ok("Become visible → the switch reads Visible again, the server agrees, the normal Practise page is back with Match me", back.me === false && back.tabs[1] === "Visible" && !/You are hidden right now/.test(back.page) && /Match me/.test(back.page), JSON.stringify(back.tabs));
ok("Online count is back", (await online()) === onlineBefore);
/* now a session partner: Alice and Bob share a trial pair, so a live call between them is possible */
await api("alice", "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 1, goals: ["workplace"] });
const m0 = await (await api("alice", "POST", "/match", {})).json();
await api("alice", "POST", "/invite", { offer: (m0.candidates || []).find(c => c.name === "Bob").offer });
const inv = (await (await api("bob", "GET", "/me")).json()).invite; await api("bob", "POST", `/pairs/${inv.id}/accept`);
await page.evaluate(async () => { await ppRefresh(true); go("home"); }); await sleep(500);
ok("With an open session, other pages show the 'your turn' pill while visible", await page.evaluate(() => { ppPillSync(); const e = document.getElementById("ppPill"); return !!e && e.classList.contains("on"); }));
await page.evaluate(() => go("partner")); await sleep(400);
await page.click(".pp-vis"); await sleep(900);
ok("Hidden inside a session: the session thread stays reachable, the switch reads Hidden", await page.evaluate(() => ppMe.prefs.optedOut === true && document.querySelector(".pp-vis").classList.contains("is-hidden") && !!document.querySelector(".pp-thread, .pp-head")));
ok("Bob (her session partner) cannot start a live call with her: 409 hidden", (await api("bob", "POST", "/live", { band: "w1-4", promptWeek: 1 })).status === 409 && (await (await api("bob", "POST", "/live", { band: "w1-4", promptWeek: 1 })).json()).error === "hidden");
ok("She cannot start one either while hidden: 403 opted_out", (await (await api("alice", "POST", "/live", { band: "w1-4", promptWeek: 1 })).json()).error === "opted_out");
await page.evaluate(() => go("home")); await sleep(500);
ok("Hidden: nothing pulls her back — no 'your turn' pill on other pages", await page.evaluate(() => { ppPillSync(); const e = document.getElementById("ppPill"); return !e || !e.classList.contains("on"); }));
await page.evaluate(() => go("partner")); await sleep(400);
await page.click(".pp-vis"); await sleep(900);
ok("The switch flips her back to Visible from inside the session; Bob can call her again", (await page.evaluate(() => ppMe.prefs.optedOut === false)) && (await api("bob", "POST", "/live", { band: "w1-4", promptWeek: 1 })).status === 201);
ok("No page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = res.filter(x => !x).length; console.log(`\n${res.length - failed}/${res.length} passed`); process.exit(failed ? 1 : 0);
