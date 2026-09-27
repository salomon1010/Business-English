/* Password reset follows the environment (27 Sep 2026). Staging signs in to the test Firebase
   project, so its reset must never reach be-mail (the production project's mail Worker); production
   keeps be-mail exactly as before, with Firebase's own email as the fallback.
   Run: cd tests && node auth-reset-env.mjs
   WebKit. This tree is served as BOTH hosts (https://staging.lomonec.com and https://app.lomonec.com);
   the staging copy carries the test project's web config, as the staging snapshot does. The Firebase
   SDK and be-mail are stand-ins that record every call — no network, no account, no email. */
import { webkit, devices } from "playwright"; import { readFileSync, existsSync } from "node:fs"; import { extname, join } from "node:path"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const TEST_CFG = { apiKey: "stand-in-test-key", authDomain: "be-mastery-test.firebaseapp.com", projectId: "be-mastery-test", storageBucket: "be-mastery-test.firebasestorage.app", messagingSenderId: "0", appId: "1:0:web:0" };
/* the Firebase compat SDK, stood in: records which project was initialised and every reset asked for */
const FAKE_APP = `window.__fb={init:[],resets:[]};window.firebase={initializeApp(c){__fb.init.push(c.projectId);this._p=c.projectId;return {}},
  auth(){const p=window.firebase._p;return {onAuthStateChanged(){},getRedirectResult(){return Promise.resolve(null)},currentUser:null,
    sendPasswordResetEmail(em,s){__fb.resets.push({project:p,settings:s===undefined?"none":s});return Promise.resolve()}}},
  firestore(){return {}}};`;
const b = await webkit.launch();
async function host(origin, opts = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
  const calls = [];
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.route(u => u.href.startsWith("https://www.gstatic.com/firebasejs/"), r => r.fulfill({ status: 200, contentType: "application/javascript", body: /app-compat/.test(r.request().url()) ? FAKE_APP : "" }));
  await ctx.route(u => u.hostname === "be-mail.nore-ngou.workers.dev", r => { calls.push({ mail: new URL(r.request().url()).pathname, method: r.request().method() });
    const H = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" };
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
    return r.fulfill({ status: opts.mailDown ? 500 : 200, contentType: "application/json", headers: H, body: opts.mailDown ? '{"error":"down"}' : '{"ok":true}' }); });
  await ctx.route(u => u.origin === origin, r => {
    let p = decodeURIComponent(new URL(r.request().url()).pathname); if (p.endsWith("/")) p += "index.html";
    const f = join(root, p); if (!existsSync(f)) return r.fulfill({ status: 404, body: "" });
    let body = readFileSync(f);
    if (p === "/index.html" && origin === "https://staging.lomonec.com") body = String(body).replace(/window\.FB_CONFIG=\{[\s\S]*?\};/, "window.FB_CONFIG=" + JSON.stringify(TEST_CFG) + ";");
    return r.fulfill({ status: 200, contentType: TYPES[extname(p)] || "application/octet-stream", body });
  });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Probe", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now() })); } });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(origin + "/index.html"); await sleep(2500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p, errs, calls };
}
/* a reset from the app's own sign-in sheet: the email field, then fbReset() — what "Forgot password" runs */
const reset = p => p.evaluate(async () => { await fbLoad(); let i = document.getElementById("authEmail");
  if (!i) { i = document.createElement("input"); i.id = "authEmail"; document.body.appendChild(i); const e = document.createElement("p"); e.id = "authErr"; document.body.appendChild(e); }
  i.value = "reset-check@example.com"; await fbReset(); await new Promise(z => setTimeout(z, 300));
  return { mailApi: MAIL_API, project: FB_CONFIG.projectId, fb: window.__fb, note: (document.getElementById("authErr") || {}).textContent || "" }; });

console.log("\n# staging.lomonec.com (Firebase: be-mastery-test)");
{
  const { ctx, p, errs, calls } = await host("https://staging.lomonec.com");
  const r = await reset(p);
  ok("a · a staging reset goes to the TEST project: Firebase's own reset, on be-mastery-test", r.project === "be-mastery-test" && r.fb.init.join() === "be-mastery-test" && r.fb.resets.length === 1 && r.fb.resets[0].project === "be-mastery-test", JSON.stringify(r));
  ok("a2 · … with no continue link to the production app (the test project does not list app.lomonec.com)", r.fb.resets[0] && r.fb.resets[0].settings === "none", JSON.stringify(r.fb.resets));
  ok("a3 · … and the note names the test project's sender, not production's", /noreply@be-mastery-test\.firebaseapp\.com/.test(r.note), r.note);
  ok("c · staging never calls the production reset path: MAIL_API is empty and be-mail is never asked (though it would answer)", r.mailApi === "" && calls.length === 0, JSON.stringify({ mailApi: r.mailApi, calls }));
  const wel = await p.evaluate(() => { try { fbWelcome && fbWelcome(); } catch (e) {} return new Promise(z => setTimeout(() => z(true), 300)); });
  ok("c2 · no welcome mail from staging either (be-mail untouched)", wel && calls.length === 0, JSON.stringify(calls));
  ok("c3 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
console.log("\n# app.lomonec.com (Firebase: be-mastery) — unchanged");
{
  const { ctx, p, errs, calls } = await host("https://app.lomonec.com");
  const r = await reset(p);
  ok("b · a production reset goes to be-mail /reset (the production project's branded email), as before", r.mailApi === "https://be-mail.nore-ngou.workers.dev" && calls.some(c => c.mail === "/reset" && c.method === "POST") && r.fb.resets.length === 0, JSON.stringify({ r, calls }));
  ok("b2 · … and the note names noreply@lomonec.com", /noreply@lomonec\.com/.test(r.note), r.note);
  ok("d · production never touches the test project: the SDK is initialised with be-mastery only", r.project === "be-mastery" && r.fb.init.join() === "be-mastery", JSON.stringify(r.fb));
  ok("b3 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, p, errs, calls } = await host("https://app.lomonec.com", { mailDown: true });
  const r = await reset(p);
  ok("b4 · production with be-mail down: Firebase's own reset on be-mastery, continuing to https://app.lomonec.com/ — exactly as before", calls.some(c => c.mail === "/reset") && r.fb.resets.length === 1 && r.fb.resets[0].project === "be-mastery" && r.fb.resets[0].settings.url === "https://app.lomonec.com/" && /noreply@be-mastery\.firebaseapp\.com/.test(r.note), JSON.stringify({ r, calls }));
  ok("d2 · … never be-mastery-test", !r.fb.init.includes("be-mastery-test"), JSON.stringify(r.fb));
  ok("b5 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
await b.close();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
