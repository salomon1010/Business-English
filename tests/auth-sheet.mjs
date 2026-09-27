/* Profile → Backup & sync → Log in / Create account (owner, iPhone, 27 Sep 2026): the Backup sheet
   (z-index 130) stayed over the sign-in sheet (120), so the login opened unseen behind it until X.
   Run: cd tests && node auth-sheet.mjs        (BASE=… for another tree)
   WebKit, iPhone 13, real taps. The Firebase SDK is a stand-in (no network, no account). */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8142);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
/* a slow stand-in SDK (600 ms), so "the Backup sheet goes at once" is measured before Firebase is ready */
const FAKE_APP = `window.firebase={initializeApp(){},auth(){return {onAuthStateChanged(){},getRedirectResult(){return Promise.resolve(null)},currentUser:null}},firestore(){return {}}};`;
const b = await webkit.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|be-mail/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
await ctx.route(u => u.href.startsWith("https://www.gstatic.com/firebasejs/"), async r => { await sleep(600); r.fulfill({ status: 200, contentType: "application/javascript", body: /app-compat/.test(r.request().url()) ? FAKE_APP : "" }); });
await ctx.addInitScript(() => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Tester", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now() })); } });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(BASE + "/index.html#profile"); await sleep(2500);
await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()); go("profile"); }); await sleep(600);
const openBackup = async () => { await p.click("[onclick^=\"pfSetupSheet('setAcc'\"]"); await sleep(700); };
/* what a finger at the centre of the sign-in sheet's first field would touch */
const state = () => p.evaluate(() => { const ps = document.getElementById("pfSetupOv"), au = document.getElementById("authOv"), em = document.getElementById("authEmail");
  let top = null; if (em) { const r = em.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); top = el === em ? "the email field" : el ? (el.closest("#pfSetupOv") ? "the Backup sheet" : el.id || el.className || el.tagName) : null; }
  return { backup: !!ps, auth: !!au, title: au ? au.querySelector("h2").innerText : null, top }; });

await openBackup(); await sleep(1500);   /* a learner reads the sheet for a moment */
const s0 = await state(), btns = await p.evaluate(() => [...document.querySelectorAll("#pfSetupOv button")].map(x => x.innerText.trim()).filter(Boolean));
ok("1 · Profile → Backup & sync opens the sheet with Create account and Log in", s0.backup && btns.some(x => /Create account/i.test(x)) && btns.some(x => /^Log in$/i.test(x)), JSON.stringify({ s0, btns }));
await p.click("#pfSetupOv button:has-text('Log in')");
const t0 = Date.now(), now = await p.evaluate(() => !!document.getElementById("pfSetupOv"));
ok("2 · tap Log in: the Backup sheet goes at once", !now, String(now));
await p.waitForSelector("#authOv", { timeout: 5000 }).catch(() => null); const ms = Date.now() - t0;
console.log("     (the login sheet appeared " + ms + " ms after the tap; the stand-in SDK takes 3 × 600 ms, fetched from the moment the Backup sheet opened)");
const s1 = await state();
ok("3 · … the login sheet is open and on top: a tap on its email field reaches the field (not the Backup sheet)", s1.auth && !s1.backup && s1.top === "the email field" && /Welcome back|Log in/i.test(s1.title), JSON.stringify(s1));
await p.fill("#authEmail", "someone@example.com"); await p.fill("#authPw", "not-a-real-password");
const typed = await p.evaluate(() => document.getElementById("authEmail").value);
ok("4 · … and can be used: the email and password fields take typing", typed === "someone@example.com", typed);
await p.click("#authOv .auth-x"); await sleep(300);
const s2 = await state();
ok("5 · closing the login leaves nothing behind — no stale Backup sheet", !s2.auth && !s2.backup, JSON.stringify(s2));
await openBackup();
ok("6 · Backup & sync reopens normally", (await state()).backup);
await p.click("#pfSetupOv button:has-text('Create account')"); const now2 = await p.evaluate(() => !!document.getElementById("pfSetupOv")); await p.waitForSelector("#authOv", { timeout: 5000 }).catch(() => null); await sleep(200);
const s3 = await state();
ok("7 · Create account: the Backup sheet goes at once and the create-account sheet is on top", !now2 && s3.auth && !s3.backup && s3.top === "the email field" && /Create/i.test(s3.title), JSON.stringify({ now2, s3 }));
await p.click("#authOv .auth-x"); await sleep(300);
await openBackup();
await p.click("#pfSetupOv .pf-sheet-head button"); await sleep(300);
const s4 = await state();
ok("8 · the Backup sheet's X still closes it (and opens nothing)", !s4.backup && !s4.auth, JSON.stringify(s4));
ok("9 · no JavaScript errors", !errs.length, errs.join(" | "));
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
