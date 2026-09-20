/* Learners-online presence in the app (owner, 2026-09-19): the Practice tab
   badge, the Practice Partner card pill, the floating button badge and the
   in-app alert all follow one number, and Welding sees none of it. The partner
   Worker is answered by a route here; the service worker's push branch is
   exercised by evaluating sw.js in a stub.   cd tests && node online-presence.mjs */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = spawn("python3", ["-m", "http.server", "8772"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }); await sleep(700);
const BASE = "http://localhost:8772";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : " — " + d}`); };
const browser = await chromium.launch();
let presence = { online: 0, waiting: 0 };
async function learner(track) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  /* partner flags are OFF in production (freeze, 2026-09-20): turned on here through be_flags, as an internal tester would */
  await ctx.addInitScript(track => { localStorage.setItem("be_flags", JSON.stringify({ practice_partner_enabled: true, practice_partner_matching_enabled: true, practice_partner_voice_enabled: true, practice_partner_notifications_enabled: true })); localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "T", lang: "en", ts: Date.now() }, professionalTracks: { activeId: track }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} }, welding: { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), vocab: { synergy: { l: "B2", ts: Date.now(), due: 0 }, leverage: { l: "B2", ts: Date.now(), due: 0 } } })); }, track);
  await ctx.route(u => /be-partner.*\/presence/.test(u.href), r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(presence) }));
  await ctx.route(u => /be-partner/.test(u.href) && !/presence/.test(u.href), r => r.fulfill({ status: 401, contentType: "application/json", body: '{"error":"auth"}' }));
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(BASE + "/index.html?op=" + Date.now(), { waitUntil: "load" }); await sleep(2200);
  return { ctx, page, errs };
}
const badge = page => page.evaluate(() => { const b = document.querySelector('.bnav-item[data-v="practice"] .nav-badge'); return b ? { t: b.textContent, online: b.classList.contains("online") } : null; });

const A = await learner("general-english");
ok("nobody online: the Practice badge shows the words due (2), not green", JSON.stringify(await badge(A.page)) === JSON.stringify({ t: "2", online: false }), JSON.stringify(await badge(A.page)));
presence = { online: 3, waiting: 1 };
await A.page.evaluate(() => ppPresencePoll(true)); await sleep(600);
ok("3 online: the Practice badge turns green and shows 3", JSON.stringify(await badge(A.page)) === JSON.stringify({ t: "3", online: true }), JSON.stringify(await badge(A.page)));
const toastTxt = await A.page.evaluate(() => ({ txt: document.getElementById("toast").innerText, on: document.getElementById("toast").classList.contains("show"), cls: document.getElementById("toast").classList.contains("pp-online") }));
ok("the first time people appear → a tappable alert '3 online now — tap to practise together'", toastTxt.on && toastTxt.cls && /3 online now/.test(toastTxt.txt), JSON.stringify(toastTxt));
await A.page.evaluate(() => document.getElementById("toast").click()); await sleep(500);
ok("tapping the alert opens the partner page", await A.page.evaluate(() => cur.v === "partner"));
await A.page.evaluate(() => go("practice")); await sleep(500);
const pill = await A.page.evaluate(() => { const p = document.getElementById("ppEntryOnline"); return p ? { shown: p.style.display !== "none", txt: p.textContent } : null; });
ok("Practice Partner card carries the green pill '3 online · 1 in line'", pill && pill.shown && pill.txt === "3 online · 1 in line", JSON.stringify(pill));
await A.page.evaluate(() => go("journey")); await sleep(500);
const fab = await A.page.evaluate(() => { const f = document.getElementById("ppFab"); const b = f && f.querySelector(".pp-fab-n"); return { on: !!f && f.classList.contains("on"), n: b && b.textContent }; });
ok("floating button on Road map carries the same count", fab.on && fab.n === "3", JSON.stringify(fab));
presence = { online: 0, waiting: 0 };
await A.page.evaluate(() => { ppPub.at = 0; ppPresencePoll(true); }); await sleep(600);
ok("everyone leaves: badge falls back to words due, pill hidden, no second alert", JSON.stringify(await badge(A.page)) === JSON.stringify({ t: "2", online: false }) && await A.page.evaluate(() => !document.getElementById("ppFab").querySelector(".pp-fab-n")));
presence = { online: 2, waiting: 0 };
await A.page.evaluate(() => { document.getElementById("toast").classList.remove("show"); ppPub.at = 0; ppPresencePoll(true); }); await sleep(600);
ok("people return within 30 min: badge updates but the alert is not repeated", (await badge(A.page)).t === "2" && (await badge(A.page)).online && await A.page.evaluate(() => !document.getElementById("toast").classList.contains("show")));
ok("Settings carries the 'Tell me when learners are online' switch, on by default", await A.page.evaluate(async () => { go("data"); await new Promise(r => setTimeout(r, 400)); const c = document.getElementById("ppAlertsOn"); return !!c && c.checked && ppAlertsOn(); }));
ok("switching it off is remembered", await A.page.evaluate(() => { ppAlertsToggle(false); return S.ppAlerts === false && !ppAlertsOn(); }));
ok("the reminder cache written for the service worker carries the push id and the online wording", await A.page.evaluate(async () => { const c = await caches.open(REM_CACHE); ppAlertsToggle(true); await remCacheText(); const r = await c.match(REM_KEY); const d = r && await r.json(); return !!d && d.pushId === pushId() && d.online && /online/i.test(d.online.title) && d.online.body.includes("{{n}}"); }));
ok("no page errors", A.errs.length === 0, A.errs.join(" | "));

/* Welding: nothing */
presence = { online: 5, waiting: 2 };
const W = await learner("welding");
await W.page.evaluate(() => ppPresencePoll(true)); await sleep(600);
const wb = await badge(W.page);
ok("Welding: no green badge, no pill, no floating button, no alert, no presence request behaviour", (!wb || !wb.online) && await W.page.evaluate(() => ppOnlineCount() === 0 && !document.getElementById("ppEntryOnline") && !(document.getElementById("ppFab") && document.getElementById("ppFab").classList.contains("on")) && !document.getElementById("toast").classList.contains("pp-online")), JSON.stringify(wb));
ok("Welding: Settings has no online-alerts switch", await W.page.evaluate(async () => { go("data"); await new Promise(r => setTimeout(r, 400)); return !document.getElementById("ppAlertsOn"); }));

/* the service worker's push branch, in a stub */
{ const src = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const shown = []; const handlers = {};
  const cacheBody = { title: "Time to practise", body: "reminder body", pushId: "phone-a-0001", online: { title: "Learners online now", body: "{{n}} online — a short practice is one tap away." }, lang: "en", dir: "ltr" };
  let why = { kind: "presence", n: 4 };
  const sandbox = { self: { addEventListener: (k, f) => { handlers[k] = f; }, registration: { showNotification: (t, o) => { shown.push({ t, o }); return Promise.resolve(); } }, skipWaiting: () => {}, clients: {} }, caches: { open: async () => ({ match: async () => ({ json: async () => cacheBody }), put: async () => {}, keys: async () => [] }), keys: async () => [], delete: async () => true }, fetch: async u => ({ ok: true, json: async () => (/\/why\?id=phone-a-0001$/.test(u) ? why : {}) }), clients: { matchAll: async () => [] }, console, URL, Promise, setTimeout };
  new Function(...Object.keys(sandbox), src)(...Object.values(sandbox));
  const run = () => new Promise(r => handlers.push({ waitUntil: p => p.then(r) }));
  await run(); await run.length; const a = shown[0];
  why = { kind: "reminder" }; await run(); const b = shown[1];
  ok("service worker: be-push says 'presence' → 'Learners online now / 4 online', tagged be-online, opens the partner page", a && a.t === "Learners online now" && a.o.body.startsWith("4 online") && a.o.tag === "be-online" && a.o.data.view === "partner", JSON.stringify(a));
  ok("service worker: be-push says 'reminder' → the daily reminder as before", b && b.t === "Time to practise" && b.o.tag === "be-daily", JSON.stringify(b));
}
await browser.close(); server.kill();
const pass = res.filter(Boolean).length; console.log(`\n  ${pass}/${res.length} pass`); process.exit(pass === res.length ? 0 : 1);
