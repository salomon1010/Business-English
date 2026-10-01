/* The AI account gate, and telling the truth when the AI does not run.
   Run: cd tests && node ai-account-gate.mjs

   Two defects found in the 1 Oct 2026 release shakeout, both verified against
   the live staging Workers before anything was changed:

   1. With PREMIUM_ENFORCED on, be-polish requires a verified account for EVERY
      route — the free-capability ones too (premiumGate's `cap === null` branch).
      A signed-out learner's call therefore returns 401 auth_required. The app
      fired it anyway: Shadow translation showed a generic error next to a Retry
      that could never work, and an interview turn said "Nothing came through",
      which reads as a dead microphone. Evidence, staging, 1 Oct 2026:
        chat purpose=practice, no token  -> 401 {"error":"auth_required"}
        audio/webm transcribe, no token  -> 401 {"error":"auth_required"}
        same transcribe, real token, Free -> 402 {"error":"premium_required"}

   2. fbTranscribe returned "" for a refusal and for real silence alike, so the
      caller could not tell them apart and always blamed the microphone.

   The regression that matters most is check 3: in production shape — Premium not
   on sale — none of this may change a thing. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { CAPABILITIES } from "../backend/entitlements/src/entitlement-core.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = 8661, BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 300)}`); };
const b = await chromium.launch();

const caps = on => CAPABILITIES.reduce((o, k) => (o[k] = on, o), { ai_allowance: on ? "enhanced" : "standard", practice_allowance: on ? "enhanced" : "standard" });
const PREMIUM = { plan: "premium", paid: true, state: "active", ads: false, capabilities: caps(true), expiresAt: Date.now() + 30 * 864e5, source: "app_store" };
const FREE = { plan: "free", paid: false, state: "none", ads: true, capabilities: caps(false), expiresAt: null, source: null };
const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

async function open({ track = "general-english", billing = true, api = true, plan = FREE, signedIn = false, status = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, api, flags]) => { localStorage.setItem("be12_v1", s); if (api) localStorage.setItem("be_ent_api", "http://ent.test"); if (flags) localStorage.setItem("be_flags", JSON.stringify(flags)); },
    [seed(track), api, billing ? { billing_enabled: true, home_v2_enabled: true } : { home_v2_enabled: true }]);
  const ai = [];
  await ctx.route(u => /be-polish/.test(u.href), r => {
    ai.push({ auth: r.request().headers()["authorization"] || null });
    if (status) return r.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ error: "x" }) });
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ text: "the words I said" }) });
  });
  await ctx.route(u => /be-events|be-partner|cloudflareinsights|youtube|ytimg/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  await ctx.route("http://ent.test/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(plan) }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#premOv").forEach(e => e.remove()));
  if (signedIn) { await p.evaluate(() => { FBUser = { uid: "u1", getIdToken: async () => "tok-u1" }; }); await p.evaluate(() => entRefresh()); await sleep(350); }
  return { ctx, p, ai, errs };
}
/* what an interview turn ends up showing, for a given transcription outcome */
const turnMessage = p => p.evaluate(async () => {
  const blob = new Blob([new Uint8Array(4000)], { type: "audio/webm" });
  const said = (await fbTranscribe(blob)).trim();
  const why = fbTxWhy();
  return { said, why, msg: said ? null : ((why && fbTxWhyText()) || SIM_NOTHING_HEARD) };
});

console.log("\n# Premium is live here and nobody is signed in");
{
  const { ctx, p, ai, errs } = await open({ signedIn: false });
  const g = await p.evaluate(() => ({ noAcct: aiNoAccount(), off: aiOff("ai_analysis"), note: aiOffNote("ai_analysis"), gated: entGated() }));
  ok("1 · the app knows there is no account to charge the call to", g.gated === true && g.noAcct === true, JSON.stringify(g));
  ok("2 · so the AI is off, and the reason given is to sign in — not 'offline' and not 'Premium'", g.off === true && /sign in/i.test(g.note), JSON.stringify(g));
  const m = await turnMessage(p);
  ok("3 · an interview turn says to sign in instead of blaming the microphone", m.why === "account" && /sign in/i.test(m.msg) && !/nothing came through/i.test(m.msg), JSON.stringify(m));
  ok("4 · and the message still contains 'tap to', so simSetStatus paints the mic ready", /tap to/i.test(m.msg), m.msg);
  ok("5 · no doomed request is sent to the AI Worker at all", ai.length === 0, JSON.stringify(ai));
  const tr = await p.evaluate(async () => {
    const sg = { id: "t1", vid: "V", text: "We need to align on the delivery date." };
    let err = null; try { await svShTrFetch(sg) } catch (e) { err = String(e && e.message) }
    return { err, html: svShTrInner("err", "acct", true) };
  });
  ok("6 · Shadow translation stops with an account reason, not a generic failure", tr.err === "acct", JSON.stringify(tr.err));
  ok("7 · and it offers no Retry, because retrying cannot help", /sign in/i.test(tr.html) && !/sv-sh-retry/.test(tr.html), tr.html);
  ok("8 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# PRODUCTION TODAY — Premium is not on sale, so nothing above may change");
{
  const { ctx, p, ai, errs } = await open({ billing: false, api: false, signedIn: false });
  const g = await p.evaluate(() => ({ noAcct: aiNoAccount(), off: aiOff("ai_analysis"), gated: entGated() }));
  ok("9 · with billing off there is no account requirement and the AI stays on", g.gated === false && g.noAcct === false && g.off === false, JSON.stringify(g));
  const m = await turnMessage(p);
  ok("10 · a signed-out learner's interview turn is transcribed exactly as before", m.said === "the words I said" && m.why === null, JSON.stringify(m));
  ok("11 · the call really was made (the gate did not quietly swallow it)", ai.length === 1, JSON.stringify(ai));
  ok("12 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# signed in, Free: the account exists, the capability does not");
{
  const { ctx, p } = await open({ signedIn: true, plan: FREE });
  const g = await p.evaluate(() => ({ noAcct: aiNoAccount(), off: aiOff("ai_analysis"), note: aiOffNote("ai_analysis") }));
  ok("13 · this is a Premium question, not a sign-in question", g.noAcct === false && g.off === true && /Premium/.test(g.note), JSON.stringify(g));
  const m = await turnMessage(p);
  ok("14 · the turn says the hearing is Premium and that the recording is kept", m.why === "premium" && /Premium/.test(m.msg) && /recording is saved/i.test(m.msg), JSON.stringify(m));
  await ctx.close();
}

console.log("\n# signed in, Premium: nothing is withheld");
{
  const { ctx, p, ai } = await open({ signedIn: true, plan: PREMIUM });
  const g = await p.evaluate(() => ({ noAcct: aiNoAccount(), off: aiOff("ai_analysis") }));
  ok("15 · the AI is on", g.noAcct === false && g.off === false, JSON.stringify(g));
  const m = await turnMessage(p);
  ok("16 · the turn is transcribed and carries no excuse", m.said === "the words I said" && m.why === null, JSON.stringify(m));
  ok("17 · the request carried the learner's own token", ai.length === 1 && ai[0].auth === "Bearer tok-u1", JSON.stringify(ai));
  await ctx.close();
}

console.log("\n# a Worker that refuses mid-session is reported as itself");
for (const [status, why, re] of [[401, "account", /sign in/i], [402, "premium", /Premium/], [429, "busy", /busy/i], [500, "server", /did not reach/i]]) {
  const { ctx, p } = await open({ signedIn: true, plan: PREMIUM, status });
  const m = await turnMessage(p);
  ok(`18 · ${status} from the Worker reads as "${why}"`, m.why === why && re.test(m.msg) && /tap to/i.test(m.msg), JSON.stringify(m));
  await ctx.close();
}

console.log("\n# real silence is still real silence");
{
  const { ctx, p } = await open({ signedIn: true, plan: PREMIUM });
  const m = await p.evaluate(async () => {
    const blob = new Blob([new Uint8Array(4000)], { type: "audio/webm" });
    await fbTranscribe(blob);                                   // success, clears the reason
    const empty = new Blob([new Uint8Array(4000)], { type: "audio/webm" });
    window.__t = await fbTranscribe(empty);
    return { why: fbTxWhy(), msg: (fbTxWhy() && fbTxWhyText()) || SIM_NOTHING_HEARD };
  });
  ok("19 · with no refusal to report, the turn still says nothing came through", m.why === null && /nothing came through/i.test(m.msg), JSON.stringify(m));
  await ctx.close();
}

console.log("\n# the session is still being restored: wait for the token, do not accuse the learner");
{
  /* A device that HAS signed in before, with the first onAuthStateChanged not yet
     delivered. This is the window that made every AI failure look random. */
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be12_owner", "someone@example.com");
    localStorage.setItem("be_ent_api", "http://ent.test"); localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: true })); }, [seed("general-english")]);
  const ai = [];
  await ctx.route(u => /be-polish/.test(u.href), r => { ai.push({ auth: r.request().headers()["authorization"] || null });
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ text: "heard you" }) }); });
  await ctx.route(u => /be-events|be-partner|cloudflareinsights|youtube|ytimg|gstatic/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  await ctx.route("http://ent.test/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(PREMIUM) }));
  const p = await ctx.newPage(); await p.goto(BASE + "index.html"); await sleep(1200);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#premOv").forEach(e => e.remove()));
  /* the SDK was blocked, so no callback has arrived: the restore is pending */
  const g = await p.evaluate(() => ({ pending: fbAuthPending(), noAcct: aiNoAccount(), uid: entUid() }));
  ok("20 · the app knows the difference between 'no account' and 'not restored yet'", g.pending === true && g.uid === null && g.noAcct === false, JSON.stringify(g));
  const m = await turnMessage(p);
  ok("21 · so a signed-in learner is never told to sign in during the restore", !/sign in/i.test(String(m.msg || "")), JSON.stringify(m));
  /* the signing fetch waited for the token; with the SDK blocked it gives up after
     its bound and sends unsigned rather than hanging the feature for ever */
  ok("22 · nor told their plan is too small, when the plan is not knowable yet", m.why === "restoring" && /restoring your session/i.test(m.msg) && !/Premium/.test(m.msg), JSON.stringify(m));
  ok("23 · and nothing was spent on a call that could not have carried a token", ai.length === 0, JSON.stringify(ai));
  await ctx.close();
}

const pass = res.filter(Boolean).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})`);
await b.close(); srv.kill(); process.exit(pass === res.length ? 0 : 1);
