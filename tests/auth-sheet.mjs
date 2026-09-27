/* Profile → Backup & sync → Log in / Create account (owner, iPhone, 27 Sep 2026).
   Two faults, one screen: (a) the Backup sheet (z-index 130) stayed over the sign-in sheet (120), so the
   login opened unseen until X — fixed by closing it at the tap; (b) the sheet's own Firebase pre-load then
   made the SDK's first auth callback ("no user") land a second or two after the sheet opened, and
   pfSetupSheetSync tore the sheet down and rebuilt it — right under the finger. The buttons vanished, or the
   rebuilt sheet came back over the login. Invariant now: one auth-related sheet at a time, and the Backup
   sheet is redrawn only for a real account change, built first and swapped in one step.
   Run: cd tests && node auth-sheet.mjs        (BASE=… for another tree)
   WebKit, iPhone 13, real taps. The Firebase SDK is a stand-in (no network, no account) that behaves like the
   real one where it matters: onAuthStateChanged fires "no user" shortly after init, and sign-in fires it again. */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8142);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 600)}`); };
/* the stand-in SDK: 600 ms per part (so "the Backup sheet goes at once" is measured before Firebase is ready),
   an auth observer that reports "no user" 300 ms after init, and email sign-in / sign-out that report the change */
const FAKE_APP = `window.__obs=[];window.__user=null;
const __fire=()=>window.__obs.forEach(f=>{try{f(window.__user)}catch(e){}});
const __signIn=em=>{if(window.__failSignIn)return Promise.reject({code:"auth/wrong-password",message:"wrong"});window.__user={uid:"u1",email:em,getIdToken(){return Promise.resolve("t")}};setTimeout(__fire,0);return Promise.resolve({user:window.__user})};
window.firebase={initializeApp(){},auth(){return {onAuthStateChanged(f){window.__obs.push(f);setTimeout(()=>f(window.__user),300)},getRedirectResult(){return Promise.resolve(null)},get currentUser(){return window.__user},
  signInWithEmailAndPassword:__signIn,createUserWithEmailAndPassword:__signIn,signOut(){window.__user=null;setTimeout(__fire,0);return Promise.resolve()}}},
  firestore(){return {collection(){return {doc(){return {get:()=>Promise.resolve({exists:false,data:()=>null}),set:()=>Promise.resolve(),update:()=>Promise.resolve()}}}}}}};`;
const SEED = () => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Tester", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now() })); }
  /* every add / remove of the two sheets, with a timestamp */
  window.__log = []; const mo = new MutationObserver(ms => { for (const m of ms) { for (const n of m.addedNodes) if (n.id === "pfSetupOv" || n.id === "authOv") __log.push(["add", n.id, Math.round(performance.now())]); for (const n of m.removedNodes) if (n.id === "pfSetupOv" || n.id === "authOv") __log.push(["rm", n.id, Math.round(performance.now())]); } });
  document.addEventListener("DOMContentLoaded", () => mo.observe(document.body, { childList: true })); };
const b = await webkit.launch();
const newPage = async (sdkStatus = 200) => {
  const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|be-mail/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.route(u => u.href.startsWith("https://www.gstatic.com/firebasejs/"), async r => { await sleep(600); r.fulfill({ status: sdkStatus, contentType: "application/javascript", body: sdkStatus === 200 && /app-compat/.test(r.request().url()) ? FAKE_APP : "" }); });
  await ctx.addInitScript(SEED);
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(e.message));
  await p.goto(BASE + "/index.html#profile"); await sleep(2500);
  await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()); go("profile"); }); await sleep(600);
  return p;
};
const openBackup = async p => { await p.click("[onclick^=\"pfSetupSheet('setAcc'\"]"); await sleep(700); };
/* what is on screen, and what a finger at the centre of the sign-in sheet's first field would touch */
const state = p => p.evaluate(() => { const ps = document.getElementById("pfSetupOv"), au = document.getElementById("authOv"), em = document.getElementById("authEmail");
  let top = null; if (em) { const r = em.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); top = el === em ? "the email field" : el ? (el.closest("#pfSetupOv") ? "the Backup sheet" : el.id || el.className || el.tagName) : null; }
  return { backup: !!ps, backups: document.querySelectorAll("#pfSetupOv").length, auth: !!au, auths: document.querySelectorAll("#authOv").length, overlays: document.querySelectorAll(".lang-modal-ov,.auth-ov,.cf-ov").length, title: au ? au.querySelector("h2").innerText : null, top, view: cur && cur.v, bodyOverflow: document.body.style.overflow || "", btns: [...document.querySelectorAll("#pfSetupOv button")].map(x => x.innerText.trim()).filter(Boolean), disabled: [...document.querySelectorAll("#pfSetupOv button, #authOv button")].filter(x => x.disabled).length, log: __log.slice() }; });
const clearLog = p => p.evaluate(() => { __log.length = 0; });

let p = await newPage();
/* ---------- the sheet is left alone by the SDK's first callback ---------- */
await openBackup(p); await clearLog(p);
const first = await p.evaluate(() => { window.__first = document.getElementById("pfSetupOv"); return !!window.__first; });
const s0 = await state(p);
ok("1 · Profile → Backup & sync opens the sheet with Create account and Log in", first && s0.backup && s0.btns.some(x => /Create account/i.test(x)) && s0.btns.some(x => /^Log in$/i.test(x)), JSON.stringify(s0));
await sleep(3000);   /* the SDK arrives (3 × 600 ms) and reports "no user" 300 ms later — while the learner reads */
const s1 = await state(p); const same = await p.evaluate(() => document.getElementById("pfSetupOv") === window.__first);
ok("2 · … and the SDK's first auth callback leaves it alone: same sheet, no remove / rebuild, buttons still there", same && s1.backups === 1 && !s1.log.length && s1.btns.some(x => /^Log in$/i.test(x)), JSON.stringify({ same, log: s1.log, btns: s1.btns }));
/* ---------- TEST 1 — LOGIN ---------- */
await clearLog(p);
await p.click("#pfSetupOv button:has-text('Log in')");
const t0 = Date.now(), now = await p.evaluate(() => !!document.getElementById("pfSetupOv"));
ok("3 · tap Log in: the Backup sheet goes at once", !now, String(now));
await p.waitForSelector("#authOv", { timeout: 5000 }).catch(() => null); const ms = Date.now() - t0;
console.log("     (the login sheet appeared " + ms + " ms after the tap)");
await sleep(1200); const s2 = await state(p);
ok("4 · … the login sheet is the only sheet, on top, and stays so: a tap on its email field reaches the field", s2.auth && s2.auths === 1 && !s2.backup && s2.overlays === 1 && s2.top === "the email field" && /Welcome back|Log in/i.test(s2.title), JSON.stringify(s2));
await p.fill("#authEmail", "someone@example.com"); await p.fill("#authPw", "not-a-real-password");
ok("5 · … and can be used: the email and password fields take typing", (await p.evaluate(() => document.getElementById("authEmail").value)) === "someone@example.com");
/* ---------- TEST 3 — CANCEL LOGIN ---------- */
await p.click("#authOv .auth-x"); await sleep(400); const s3 = await state(p);
ok("6 · closing the login returns to Profile: no sheet, no ghost overlay, scrolling free", !s3.auth && !s3.backup && s3.overlays === 0 && s3.view === "profile" && s3.bodyOverflow === "", JSON.stringify(s3));
/* ---------- TEST 2 — CREATE ACCOUNT ---------- */
await openBackup(p); ok("7 · Backup & sync reopens normally", (await state(p)).backup);
await p.click("#pfSetupOv button:has-text('Create account')"); const now2 = await p.evaluate(() => !!document.getElementById("pfSetupOv")); await p.waitForSelector("#authOv", { timeout: 5000 }).catch(() => null); await sleep(1200);
const s4 = await state(p);
ok("8 · Create account: the Backup sheet goes at once and the create-account sheet is the only sheet, on top", !now2 && s4.auth && s4.auths === 1 && !s4.backup && s4.overlays === 1 && s4.top === "the email field" && /Create/i.test(s4.title), JSON.stringify({ now2, s4 }));
/* ---------- TEST 4 — CANCEL CREATE ACCOUNT ---------- */
await p.click("#authOv .auth-x"); await sleep(400); const s5 = await state(p);
ok("9 · closing Create account returns to Profile: no sheet, no ghost overlay, scrolling free", !s5.auth && !s5.backup && s5.overlays === 0 && s5.view === "profile" && s5.bodyOverflow === "", JSON.stringify(s5));
/* ---------- the redraw race (the iPhone fault) ---------- */
await openBackup(p); await clearLog(p);
const hit1 = await p.evaluate(() => { const ov = document.getElementById("pfSetupOv"); pfSetupSheet(ov.dataset.anchor, ov.dataset.title, true); /* a redraw in flight … */ const b = document.querySelector("#pfSetupOv button.btn.btn-g"); if (b) b.click(); return !!b; /* … as the finger lands on Log in */ });
await sleep(1500); const s6 = await state(p);
ok("10 · a redraw in flight when Log in is tapped: the button is still there to tap, the login is on top and the Backup sheet does not come back over it", hit1 && s6.auth && s6.auths === 1 && !s6.backup && s6.top === "the email field", JSON.stringify({ buttonStillThere: hit1, ...s6 }));
await p.evaluate(() => { document.getElementById("authOv")?.remove(); document.getElementById("pfSetupOv")?.remove(); }); await sleep(300);
await openBackup(p);
const hit2 = await p.evaluate(() => { const ov = document.getElementById("pfSetupOv"); pfSetupSheet(ov.dataset.anchor, ov.dataset.title, true); const b = document.querySelector("#pfSetupOv .pf-sheet-head button"); if (b) b.click(); return !!b; /* X during a redraw */ });
await sleep(1200); const s7 = await state(p);
ok("11 · a redraw in flight when X is tapped: the X is still there and the sheet stays closed", hit2 && !s7.backup && !s7.auth && s7.overlays === 0, JSON.stringify({ xStillThere: hit2, ...s7, log: undefined }));
/* ---------- a real account change redraws the sheet, in one step ---------- */
await openBackup(p); await clearLog(p);
await p.evaluate(() => { const ov = document.getElementById("pfSetupOv"); pfSetupSheet(ov.dataset.anchor, ov.dataset.title, true); });
await sleep(1000); const s8 = await state(p);
const swap = s8.log.length === 2 && s8.log[0][0] === "rm" && s8.log[1][0] === "add" && s8.log[1][2] - s8.log[0][2] <= 16;
ok("12 · a forced redraw swaps the sheet in one step (old removed and new added together, no blank gap)", s8.backups === 1 && swap, JSON.stringify(s8.log));
await p.click("#pfSetupOv .pf-sheet-head button"); await sleep(300);
/* ---------- TEST 5 — REPEATABILITY ---------- */
let rep = true, why = "";
for (let i = 0; i < 3 && rep; i++) {
  for (const [btn, re] of [["Log in", /Welcome back|Log in/i], ["Create account", /Create/i]]) {
    await openBackup(p); const a = await state(p);
    if (!(a.backup && a.backups === 1 && a.overlays === 1 && !a.disabled)) { rep = false; why = `round ${i + 1} ${btn} open: ` + JSON.stringify({ ...a, log: undefined }); break; }
    await p.click(`#pfSetupOv button:has-text('${btn}')`); await p.waitForSelector("#authOv", { timeout: 5000 }).catch(() => null); await sleep(300); const c = await state(p);
    if (!(c.auth && c.auths === 1 && !c.backup && c.overlays === 1 && c.top === "the email field" && re.test(c.title) && !c.disabled)) { rep = false; why = `round ${i + 1} ${btn} tap: ` + JSON.stringify({ ...c, log: undefined }); break; }
    await p.click("#authOv .auth-x"); await sleep(300); const d = await state(p);
    if (!(!d.auth && !d.backup && d.overlays === 0 && d.view === "profile" && d.bodyOverflow === "")) { rep = false; why = `round ${i + 1} ${btn} cancel: ` + JSON.stringify({ ...d, log: undefined }); break; }
  }
}
ok("13 · repeat both flows three times: one sheet at every step, no ghost backdrop, no disabled button, scrolling free", rep, why);
ok("14 · the Backup sheet's X still closes it (and opens nothing)", await (async () => { await openBackup(p); await p.click("#pfSetupOv .pf-sheet-head button"); await sleep(300); const s = await state(p); return !s.backup && !s.auth && s.overlays === 0; })());
/* sign in from the sheet: the login goes, the Backup sheet returns showing the synced account, Profile's row follows */
await openBackup(p);
await p.click("#pfSetupOv button:has-text('Log in')"); await p.waitForSelector("#authOv", { timeout: 5000 }); await sleep(200);
await p.fill("#authEmail", "tester@example.com"); await p.fill("#authPw", "not-a-real-password"); await p.click("#authOv .btn.btn-p"); await sleep(1500);
const s9 = await state(p); const rowTxt = await p.evaluate(() => (document.querySelector("[onclick^=\"pfSetupSheet('setAcc'\"] small") || {}).innerText || "");
ok("15 · signing in from the sheet: the login goes, the Backup sheet returns as the only sheet showing the synced account, Profile's row shows the email", !s9.auth && s9.backup && s9.backups === 1 && s9.overlays === 1 && s9.btns.some(x => /Sign out/i.test(x)) && rowTxt === "tester@example.com", JSON.stringify({ s9: { ...s9, log: undefined }, rowTxt }));
await clearLog(p);
await p.click("#pfSetupOv button:has-text('Sign out')"); await p.waitForSelector(".cf-ov", { timeout: 3000 }); await p.click(".cf-ov button:has-text('Sign out')"); await sleep(1500);
const s10 = await state(p); const rowTxt2 = await p.evaluate(() => (document.querySelector("[onclick^=\"pfSetupSheet('setAcc'\"] small") || {}).innerText || "");
ok("16 · signing out from the sheet (which wipes the device) leaves no sheet behind over Home", !s10.backup && !s10.auth && s10.overlays === 0 && s10.view !== "profile", JSON.stringify({ ...s10, log: undefined }));
const errs1 = p.errs.slice();
/* ---------- the SDK cannot load: no dead end ---------- */
const p2 = await newPage(500);
await openBackup(p2); await p2.click("#pfSetupOv button:has-text('Log in')"); await sleep(2500);
const s11 = await state(p2); const toastTxt = await p2.evaluate(() => (document.getElementById("toast") || {}).textContent || "");
ok("17 · when the SDK cannot load, Log in tells the learner and brings the Backup sheet back — not a blank Profile", s11.backup && s11.backups === 1 && !s11.auth && /isn't set up|not set up/i.test(toastTxt), JSON.stringify({ s11: { ...s11, log: undefined }, toastTxt }));
ok("18 · no JavaScript errors", !errs1.length && !p2.errs.length, [...errs1, ...p2.errs].join(" | "));
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
