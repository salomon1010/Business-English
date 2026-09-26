/* An incoming live call rings like a phone (owner, 2026-09-25): the banner
   rings (British ring cadence + vibration) every 3 s until the call is
   answered, declined or gone, and gives up after 45 s. No Worker needed: the
   invitation is placed straight into ppMe, the ring and vibration are counted.
   Run: cd tests && node live-ring.mjs   (or BASE=… for another server) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const sleep = ms => new Promise(r => setTimeout(r, ms));
let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", "8774", "--bind", "127.0.0.1"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }); await sleep(700); BASE = "http://127.0.0.1:8774"; }
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const FLAGS = { practice_partner_live_enabled: true, practice_partner_enabled: true, practice_partner_matching_enabled: true, practice_partner_voice_enabled: true };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(FLAGS => {
  localStorage.setItem("be_flags", JSON.stringify(FLAGS)); localStorage.setItem("be_partner_api", "http://127.0.0.1:9");
  localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Julie", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: true }));
  window.__vib = []; navigator.vibrate = p => { window.__vib.push(p); return true; };
}, FLAGS);
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto(BASE + "/index.html?ring=" + Date.now() + "#home", { waitUntil: "load" });
await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });
await page.mouse.click(5, 400);   /* the learner has tapped the app once: audio unlocked */
await page.evaluate(() => { window.__bursts = 0; const real = ppRingBurst; window.__kinds = []; window.ppRingBurst = k => { window.__bursts++; window.__kinds.push(k); real(k); }; });

const invite = (kind) => page.evaluate(kind => {
  const partner = { name: "Passy" }, exp = Date.now() + 600000;
  ppMe = kind === "live" ? { consented: true, live: { id: "a1b2c3d4e5f6a7b8", role: "guest", state: "invited", expiresAt: exp, partner } }
    : kind === "trial-live" ? { consented: true, invite: { id: "b1b2c3d4e5f6a7b8", live: true, expiresAt: exp, partner } }
    : { consented: true, invite: { id: "c1b2c3d4e5f6a7b8", live: false, expiresAt: exp, partner } };
  ppCallSync();
}, kind);

await invite("live"); await sleep(7000);
const liveKinds = await page.evaluate(() => __kinds.slice());
const r1 = await page.evaluate(() => ({ bursts: __bursts, vib: __vib.filter(v => Array.isArray(v) && v[0] === 400).length, key: ppRingKey, banner: document.getElementById("ppCall")?.innerText.replace(/\s+/g, " ") || "", ac: _ppChimeAC && _ppChimeAC.state }));
ok("A live invitation rings like a phone: a ring every 3 s (3 in 7 s), each with a vibration, banner 'Passy wants to practise live'", r1.bursts === 3 && r1.vib === 3 && r1.key && /Passy/.test(r1.banner), JSON.stringify(r1));
ok("The ring plays through an unlocked audio context", r1.ac === "running", r1.ac);
await page.evaluate(() => ppCallHide()); const b1 = await page.evaluate(() => __bursts); await sleep(4000);
ok("Answering or declining (the banner closes) stops the ring at once and cancels the vibration", (await page.evaluate(() => __bursts)) === b1 && (await page.evaluate(() => ppRingKey)) === null && (await page.evaluate(() => __vib.some(v => v === 0))));

await page.evaluate(() => { __bursts = 0; __kinds = []; ppCallShown = null; }); await invite("live"); await sleep(3500);
await page.evaluate(() => { ppMe = { consented: true }; ppCallSync(); }); const b2 = await page.evaluate(() => __bursts); await sleep(4000);
ok("The caller cancels / the invitation expires → the banner goes and the ring stops", b2 >= 1 && (await page.evaluate(() => __bursts)) === b2 && !(await page.evaluate(() => ppRingKey)));

await page.evaluate(() => { __bursts = 0; __kinds = []; ppCallShown = null; }); await invite("live"); await sleep(1000);
await page.evaluate(() => { ppRingUntil = Date.now() - 1; }); await sleep(3500); const b3 = await page.evaluate(() => __bursts); await sleep(3500);
ok("After the ring time (45 s) it stops by itself; the banner stays up to answer", (await page.evaluate(() => __bursts)) === b3 && !(await page.evaluate(() => ppRingKey)) && (await page.evaluate(() => document.getElementById("ppCall").classList.contains("on"))));
await page.evaluate(() => ppCallHide());

await page.evaluate(() => { __bursts = 0; __kinds = []; ppCallShown = null; }); await invite("trial-live"); await sleep(3500);
ok("A stranger's invitation to a live call rings too", (await page.evaluate(() => __bursts)) >= 2);
await page.evaluate(() => ppCallHide());
await page.evaluate(() => { __bursts = 0; __kinds = []; ppCallShown = null; }); await invite("trial"); await sleep(3500);
ok("A recorded-voice practice invitation rings too, with its OWN sound (three rising notes) and vibration, not the phone ring", await page.evaluate(() => __bursts >= 2 && __kinds.every(k => k === "voice") && ppRingKey && __vib.some(v => Array.isArray(v) && v.length === 5 && v[0] === 150)), JSON.stringify(await page.evaluate(() => ({ b: __bursts, k: __kinds }))));
ok("…while a live invitation's rings were all the phone ring", liveKinds.length === 3 && liveKinds.every(k => k === "live"), JSON.stringify(liveKinds));
await page.evaluate(() => ppCallHide());

await page.evaluate(() => { __bursts = 0; __kinds = []; ppCallShown = null; }); await invite("live"); await sleep(500);
await page.evaluate(() => ppLiveOpen({ id: "a1b2c3d4e5f6a7b8", role: "guest", state: "invited", partner: { name: "Passy" } })); const b4 = await page.evaluate(() => __bursts); await sleep(3500);
ok("Joining the call silences the ring", (await page.evaluate(() => __bursts)) === b4 && !(await page.evaluate(() => ppRingKey)));
await page.evaluate(() => { try { ppLiveTeardown(false); } catch (e) {} });

ok("No page errors", errors.length === 0, errors.join(" | "));
await browser.close(); if (server) server.kill();
const failed = res.filter(r => !r.pass).length;
console.log(`\n${res.length - failed}/${res.length} passed`);
process.exit(failed ? 1 : 0);
