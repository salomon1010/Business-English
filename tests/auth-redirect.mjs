/* Google / Apple sign-in fixes (9 Oct 2026).
   1. The installed web app (Play TWA, home-screen app) signs in by REDIRECT. The
      reload used to load Firebase only for a device that had signed in before, so a
      FIRST sign-in came back looking signed out. A mark (be_auth_redirect, 10 min)
      now makes the boot load Firebase and read the result; reading it clears it.
   2. A redirect that collides with a password account gets the same honest route
      as the popup: the sheet opens with the address and links after the log in.
   3. The Android Capacitor shell (https://localhost) has no sign-in plugin, no
      popup opener and is not an authorised domain: no Google/Apple buttons there.
   Run: cd tests && node auth-redirect.mjs      (BASE=… for another tree)
   The real Firebase SDK is loaded from Google's CDN; nothing signs in. */
import { chromium, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8149);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await chromium.launch();
const PROFILE = JSON.stringify({ profile: { name: "QA", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now() });
async function page({ mark = null, owner = false, android = false } = {}) {
  const ctx = await b.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
  await ctx.route(u => /cloudflareinsights|be-events/.test(u.href), r => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(([P, mark, owner, android]) => {
    if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", P);
      if (mark) localStorage.setItem("be_auth_redirect", JSON.stringify(mark));
      if (owner) localStorage.setItem("be12_owner", "someone"); }
    if (android) window.Capacitor = { getPlatform: () => "android", Plugins: {}, isNativePlatform: () => true };
  }, [PROFILE, mark, owner, android]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html?ar=" + Date.now() + "#home"); await sleep(4500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p, errs };
}

console.log("\n# 1 · a redirect sign-in comes back to a page that reads it");
{
  let { ctx, p } = await page();
  ok("R1 · a fresh device with no redirect under way does not load Firebase at boot (unchanged)", await p.evaluate(() => !FBauth));
  const m = await p.evaluate(() => { fbRedirectMark("apple"); return { pend: fbRedirectPending(), kind: fbRedirectKind() }; });
  ok("R2 · fbRedirectMark records the provider and the time", m.pend && m.kind === "apple", JSON.stringify(m));
  await ctx.close();
  ({ ctx, p } = await page({ mark: { kind: "google", at: Date.now() } }));
  const s = await p.evaluate(async () => { for (let i = 0; i < 40 && !FBauth; i++) await new Promise(z => setTimeout(z, 250)); await new Promise(z => setTimeout(z, 1500)); return { loaded: !!FBauth, mark: localStorage.getItem("be_auth_redirect") }; });
  ok("R3 · a FIRST sign-in returning from the redirect: the boot loads Firebase (getRedirectResult can run)", s.loaded, JSON.stringify(s));
  ok("R4 · reading the redirect result clears the mark", s.mark === null, JSON.stringify(s));
  await ctx.close();
  ({ ctx, p } = await page({ mark: { kind: "google", at: Date.now() - 11 * 60000 } }));
  ok("R5 · a mark older than ten minutes is ignored (no Firebase at boot)", await p.evaluate(async () => { await new Promise(z => setTimeout(z, 1500)); return !FBauth; }));
  await ctx.close();
  ({ ctx, p } = await page({ owner: true }));
  ok("R6 · a device that signed in before still loads Firebase at boot (unchanged)", await p.evaluate(async () => { for (let i = 0; i < 40 && !FBauth; i++) await new Promise(z => setTimeout(z, 250)); return !!FBauth; }));
  await ctx.close();
}

console.log("\n# 2 · the redirect result, every outcome");
{
  const { ctx, p, errs } = await page();
  await p.evaluate(() => fbLoad()); await sleep(2500);
  const coll = await p.evaluate(async () => {
    fbRedirectMark("google");
    await fbRedirectDone(Promise.reject({ code: "auth/account-exists-with-different-credential", email: "Learner@Example.com", credential: { fake: 1 } }));
    await new Promise(z => setTimeout(z, 800));
    return { open: !!document.getElementById("authOv"), email: (document.getElementById("authEmail") || {}).value, err: (document.getElementById("authErr") || {}).textContent, pend: !!(_fbPend && _fbPend.email === "learner@example.com" && _fbPend.kind === "google"), mark: localStorage.getItem("be_auth_redirect") };
  });
  ok("R7 · an e-mail that already has a password: the sheet opens with the address and the honest line", coll.open && coll.email === "learner@example.com" && /already has an account|learner@example\.com/.test(coll.err), JSON.stringify(coll));
  ok("R8 · …and the provider is kept for that address only, to link after the password log in", coll.pend && coll.mark === null, JSON.stringify(coll));
  await p.evaluate(() => { fbCloseModal(); _fbPend = null; });
  const fail = await p.evaluate(async () => { document.getElementById("toast").textContent = ""; fbRedirectMark("apple"); await fbRedirectDone(Promise.reject({ code: "auth/network-request-failed" })); await new Promise(z => setTimeout(z, 300)); return document.getElementById("toast").textContent; });
  ok("R9 · a failed redirect of ours says so (plain words, no raw Firebase text)", fail.length > 5 && !/auth\//.test(fail), fail);
  const quiet = await p.evaluate(async () => { document.getElementById("toast").textContent = ""; await fbRedirectDone(Promise.reject({ code: "auth/network-request-failed" })); await new Promise(z => setTimeout(z, 300)); return document.getElementById("toast").textContent; });
  ok("R10 · a page load with no redirect of ours under way says nothing", quiet === "", quiet);
  const none = await p.evaluate(async () => { fbRedirectMark("google"); await fbRedirectDone(Promise.resolve(null)); return localStorage.getItem("be_auth_redirect"); });
  ok("R11 · no result (an ordinary load) clears a mark too", none === null, none);
  ok("R12 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# 3 · where the buttons are offered");
{
  let { ctx, p } = await page({ android: true });
  const a = await p.evaluate(async () => { const on = socialWebOn(); await fbOpenModal("in"); await new Promise(z => setTimeout(z, 2500)); return { android: IS_ANDROID_APP, on, buttons: document.querySelectorAll(".auth-soc").length, email: !!document.getElementById("authEmail") }; });
  ok("R13 · the Android Capacitor shell: no Google/Apple buttons (they could only fail), e-mail and password stay", a.android && !a.on && a.buttons === 0 && a.email, JSON.stringify(a));
  await ctx.close();
  ({ ctx, p } = await page());
  const w = await p.evaluate(async () => { await fbOpenModal("in"); await new Promise(z => setTimeout(z, 2500)); return { on: socialWebOn(), buttons: [...document.querySelectorAll(".auth-soc")].map(x => x.textContent.trim()) }; });
  ok("R14 · the web in a browser tab still offers Apple then Google (unchanged)", w.on && w.buttons.length === 2 && /Apple/.test(w.buttons[0]) && /Google/.test(w.buttons[1]), JSON.stringify(w));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`);
process.exit(n === res.length ? 0 : 1);
