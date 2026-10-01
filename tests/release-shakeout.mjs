/* Release-readiness shakeout (Apple 1.2.x). Drives a real headless Chromium at
   staging and asks the questions the owner's manual testing raised:

     cd tests && BASE=https://staging.lomonec.com node release-shakeout.mjs

   Every check records what the app ACTUALLY did, not what it should do. A FAIL
   here is a defect; a NOTE is evidence for the report. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

let BASE = process.env.BASE, server = null;
if (!BASE) {
  server = spawn("python3", ["-m", "http.server", "8799"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
  await sleep(700); BASE = "http://localhost:8799";
}
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond, detail }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const note = (name, value) => { console.log(`  NOTE  ${name}: ${typeof value === "string" ? value : JSON.stringify(value)}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  permissions: ["microphone"],
  userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36",
});
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e.message)));
/* record every POLISH_API request and whether it carried a bearer token */
const aiCalls = [];
page.on("request", r => { if (/be-polish/.test(r.url())) aiCalls.push({ url: r.url(), auth: !!r.headers()["authorization"] }); });
const aiResp = [];
page.on("response", r => { if (/be-polish/.test(r.url())) aiResp.push({ status: r.status() }); });

await page.goto(BASE + "/index.html?shake=" + Date.now(), { waitUntil: "load" });
const wait = ms => page.waitForTimeout(ms);
await page.evaluate(async () => { if (window.OB) { OB.name = "Shake"; obFinish(); } });
await wait(700);
await page.evaluate(() => { document.querySelectorAll(".cf-ov,.wc-ov,.lang-modal-ov,#obWrap").forEach(e => e.remove()); });

console.log("\n── A. environment as the page sees it ──");
const env = await page.evaluate(() => ({
  sw: (document.querySelector("meta[name=build]") || {}).content || null,
  polish: (() => { try { return POLISH_API } catch (e) { return "ERR" } })(),
  ent: (() => { try { return entApiBase() } catch (e) { return "ERR" } })(),
  partner: (() => { try { return ppApiBase() } catch (e) { return "ERR" } })(),
  billing: (() => { try { return flag("billing_enabled") } catch (e) { return "ERR" } })(),
  planOn: (() => { try { return planOn() } catch (e) { return "ERR" } })(),
  gated: (() => { try { return entGated() } catch (e) { return "ERR" } })(),
  plan: (() => { try { return entView().plan } catch (e) { return "ERR" } })(),
  fbUser: (() => { try { return !!FBUser } catch (e) { return "ERR" } })(),
  area: (() => { try { return areaId() } catch (e) { return "ERR" } })(),
}));
note("environment", env);
ok("A1 staging routes AI to be-polish-staging", /be-polish-staging/.test(env.polish), env.polish);
ok("A2 staging routes entitlements to be-entitlements-staging", /be-entitlements-staging/.test(env.ent), env.ent);

console.log("\n── B. the AI gate a signed-out learner meets ──");
const gate = await page.evaluate(() => ({
  aiAnalysis: (() => { try { return aiOff("ai_analysis") } catch (e) { return "ERR" } })(),
  aiCoach: (() => { try { return aiOff("ai_coach") } catch (e) { return "ERR" } })(),
  hasAnalysis: (() => { try { return hasEntitlement("ai_analysis") } catch (e) { return "ERR" } })(),
}));
note("client gate (signed out)", gate);

/* the exact request Shadow translation makes */
const chat = await page.evaluate(async () => {
  try {
    const r = await fetch(POLISH_API, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat: { purpose: "practice", system: "You are a translator.", messages: [{ role: "user", content: "Hello there." }] } }) });
    let b = ""; try { b = (await r.text()).slice(0, 120) } catch (e) {}
    return { status: r.status, body: b };
  } catch (e) { return { status: "THREW", body: String(e && e.message) } }
});
note("chat purpose=practice, signed out", chat);
ok("B1 the translation route answers a signed-out learner without a CORS failure", chat.status !== "THREW", JSON.stringify(chat));
ok("B2 the translation route SUCCEEDS for a signed-out learner", chat.status === 200, "status " + chat.status + " " + chat.body);

/* the exact request an interview turn makes */
const tx = await page.evaluate(async () => {
  const blob = new Blob([new Uint8Array(4000)], { type: "audio/webm" });
  try {
    const r = await fetch(POLISH_API, { method: "POST", headers: { "content-type": "audio/webm" }, body: blob });
    let b = ""; try { b = (await r.text()).slice(0, 120) } catch (e) {}
    return { status: r.status, body: b };
  } catch (e) { return { status: "THREW", body: String(e && e.message) } }
});
note("transcribe, signed out", tx);
ok("B3 the transcription route SUCCEEDS for a signed-out learner", tx.status === 200, "status " + tx.status + " " + tx.body);

console.log("\n── C. what the learner is TOLD when it fails ──");
const told = await page.evaluate(async () => {
  const blob = new Blob([new Uint8Array(4000)], { type: "audio/webm" });
  const said = await fbTranscribe(blob);
  return { transcript: said, isEmpty: said === "", message: typeof SIM_NOTHING_HEARD === "string" ? SIM_NOTHING_HEARD : null };
});
note("fbTranscribe + the resulting message", told);
ok("C1 a refused transcription is distinguishable from silence", !(told.isEmpty && /nothing came through/i.test(told.message || "")),
   "fbTranscribe returned \"\" and the turn reports: " + told.message);

console.log("\n── D. the token race (why it is intermittent) ──");
const race = await page.evaluate(() => ({
  ownerKey: (() => { try { return !!localStorage.getItem("be12_owner") } catch (e) { return "ERR" } })(),
  fbAuth: (() => { try { return !!FBauth } catch (e) { return "ERR" } })(),
  fbUser: (() => { try { return !!FBUser } catch (e) { return "ERR" } })(),
  signedFetch: !!(window.fetch && window.fetch.bePolishSigned),
}));
note("auth state at the moment an AI call can be made", race);
ok("D1 POLISH_API calls are wrapped by the signing fetch", race.signedFetch === true, JSON.stringify(race));
note("POLISH_API requests this run (url/auth)", aiCalls.map(c => (c.auth ? "signed" : "UNSIGNED")));
ok("D2 every POLISH_API request this run carried a token", aiCalls.length > 0 && aiCalls.every(c => c.auth),
   aiCalls.filter(c => !c.auth).length + " of " + aiCalls.length + " unsigned");

console.log("\n── E. Shadow translation, through the app's own function ──");
const trRes = await page.evaluate(async () => {
  const out = { reached: false };
  try {
    out.trOn = typeof svShTrOn === "function" ? null : "missing";
    out.lang = svShLang();
    const sg = { id: "t1", vid: "TESTVID", text: "We need to align on the delivery date before Friday." };
    out.reached = true;
    try { out.text = await svShTrFetch(sg) } catch (e) { out.error = String(e && e.message) }
  } catch (e) { out.fatal = String(e && e.message) }
  return out;
});
note("svShTrFetch", trRes);
ok("E1 svShTrFetch returns a translation", !!trRes.text, "error: " + (trRes.error || trRes.fatal || "none"));

console.log("\n── F. page errors ──");
ok("F1 no uncaught page errors", errors.length === 0, errors.slice(0, 4).join(" ;; "));

const pass = res.filter(r => r.pass).length;
console.log(`\n${pass}/${res.length} checks passed  (BASE=${BASE})`);
console.log("be-polish responses seen: " + JSON.stringify(aiResp));
await browser.close(); if (server) server.kill();
process.exit(0);
