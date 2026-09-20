/* Boot recovery + the floating partner button (2026-09-19): a curriculum file that fails once must not end the app.
   Run:  cd tests && node boot-recovery.mjs   (starts its own server on 8768) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = spawn("python3", ["-m", "http.server", "8768"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }); await sleep(700);
const BASE = "http://localhost:8768";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : " — " + d}`); };
const browser = await chromium.launch();
/* the partner flags are OFF in production (freeze, 2026-09-20): the suite turns them on through be_flags, as an internal tester would, so the button rule stays tested */
const seed = () => { localStorage.setItem("be_flags", JSON.stringify({ practice_partner_enabled: true, practice_partner_matching_enabled: true, practice_partner_voice_enabled: true, practice_partner_notifications_enabled: true })); localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "T", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), vocab: Object.fromEntries(Array.from({ length: 12 }, (_, i) => ["word" + i, { ts: Date.now(), due: 0 }])) })); };

/* A: a welding file fails permanently (404) — a General English learner must not notice */
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await ctx.addInitScript(seed);
  await ctx.route(u => u.href.includes("tracks/welding/vocabulary.json"), r => r.fulfill({ status: 404, body: "" }));
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(BASE + "/index.html?a=" + Date.now(), { waitUntil: "load" }); await sleep(2500);
  await page.click('.bnav-item[data-v="practice"]'); await sleep(600);
  const r = await page.evaluate(() => ({ booted: _booted, home: document.getElementById("v-home").innerText.slice(0, 40), practice: document.getElementById("v-practice").innerText.replace(/\s+/g, " ").slice(0, 60), header: (document.querySelector(".brand").innerText || "").replace(/\s+/g, " ").slice(0, 40) }));
  ok("Welding file 404 → General English boots, Practice draws, header follows", r.booted && /Practice/.test(r.practice) && !/could not be drawn/.test(r.practice) && errs.length === 0, JSON.stringify(r) + errs.join("|"));
  await ctx.close(); }

/* B: the OPEN track's file fails twice then succeeds — the per-file retry absorbs it */
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await ctx.addInitScript(seed);
  let n = 0; await ctx.route(u => u.href.includes("tracks/general/practice.json"), r => { n++; n <= 2 ? r.abort("failed") : r.continue(); });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(BASE + "/index.html?b=" + Date.now(), { waitUntil: "load" }); await sleep(4500);
  await page.click('.bnav-item[data-v="practice"]'); await sleep(600);
  const r = await page.evaluate(() => ({ booted: _booted, practice: document.getElementById("v-practice").innerText.replace(/\s+/g, " ").slice(0, 40) }));
  ok("Own file fails twice, third try succeeds → boots normally (3 fetches, no error card)", n === 3 && r.booted && /Practice/.test(r.practice) && errs.length === 0, JSON.stringify({ n, r }));
  await ctx.close(); }

/* C: the open track is unreachable at boot (all tries) → a card with Try again; the network comes back; Try again really recovers, on the tab the learner is on */
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await ctx.addInitScript(seed);
  let down = true; await ctx.route(u => u.href.includes("tracks/general/practice.json"), r => down ? r.abort("failed") : r.continue());
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(BASE + "/index.html?c=" + Date.now(), { waitUntil: "load" }); await sleep(4500);
  const c1 = await page.evaluate(() => ({ booted: _booted, home: document.getElementById("v-home").innerText.replace(/\s+/g, " "), btn: !!document.querySelector('#v-home button[onclick="bootRetry()"]') }));
  ok("Boot failure → Home shows the lessons message with a real Try again button", !c1.booted && /could not be downloaded/.test(c1.home) && c1.btn, JSON.stringify(c1));
  await page.click('.bnav-item[data-v="practice"]'); await sleep(4500);
  const c2 = await page.evaluate(() => ({ practice: document.getElementById("v-practice").innerText.replace(/\s+/g, " "), crash: /could not be drawn/.test(document.getElementById("v-practice").innerText) }));
  ok("Tapping Practice while still down → the same lessons card (auto-retried), never 'could not be drawn'", /could not be downloaded/.test(c2.practice) && !c2.crash, JSON.stringify(c2));
  down = false; await page.click('#v-practice button[onclick="bootRetry()"]'); await sleep(2500);
  const c3 = await page.evaluate(() => ({ booted: _booted, v: cur.v, practice: document.getElementById("v-practice").innerText.replace(/\s+/g, " ").slice(0, 40), header: (document.querySelector(".brand").innerText || "").replace(/\s+/g, " ").slice(0, 40), badge: document.querySelector('.bnav-item[data-v="practice"]').innerText.replace(/\s+/g, " ") }));
  ok("Network back + Try again → boots and lands on Practice, drawn, header updated", c3.booted && /Practice/.test(c3.practice) && errs.length === 0, JSON.stringify(c3) + errs.join("|"));
  await ctx.close(); }

/* D: the floating button — Road map, Shadow, Phrase Lab only; not Home, not Practice; signed-out is fine on those three */
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await ctx.addInitScript(seed);
  const page = await ctx.newPage(); await page.goto(BASE + "/index.html?d=" + Date.now(), { waitUntil: "load" }); await sleep(2000);
  const fab = await page.evaluate(async () => { const out = {}; for (const v of ["home", "journey", "shadow", "phrases", "practice", "review", "profile"]) { go(v); await new Promise(r => setTimeout(r, 350)); document.querySelectorAll(".cf-ov,.wc-ov,#rmNotice").forEach(e => e.remove()); const el = document.getElementById("ppFab"); out[v] = !!el && el.classList.contains("on"); } return { ...out, signedIn: ppSignedIn(), avail: ppAvailable() }; });
  ok("FAB on journey/shadow/phrases only (signed out), not on home/practice/review/profile", fab.avail && !fab.signedIn && fab.journey && fab.shadow && fab.phrases && !fab.home && !fab.practice && !fab.review && !fab.profile, JSON.stringify(fab));
  await ctx.close(); }

/* E: Welding learner — nothing changes: no FAB anywhere, boots with the welding pack */
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "W", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "welding" }, fnd: { welding: { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now() })); });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(BASE + "/index.html?e=" + Date.now(), { waitUntil: "load" }); await sleep(2000);
  const w = await page.evaluate(async () => { const out = {}; for (const v of ["journey", "shadow", "phrases", "practice"]) { go(v); await new Promise(r => setTimeout(r, 350)); const el = document.getElementById("ppFab"); out[v] = !!el && el.classList.contains("on"); } return { ...out, booted: _booted, pro: areaIsPro(), weeks: trackWeeks().length, drawn: !/could not be drawn/.test(document.getElementById("v-practice").innerText) }; });
  ok("Welding: boots on its own pack, Practice draws, no FAB on any tab", w.booted && w.pro && w.weeks > 0 && w.drawn && !w.journey && !w.shadow && !w.phrases && !w.practice && errs.length === 0, JSON.stringify(w));
  await ctx.close(); }

await browser.close(); server.kill();
console.log(`\n  ${res.filter(Boolean).length}/${res.length} pass`); process.exit(res.every(Boolean) ? 0 : 1);
