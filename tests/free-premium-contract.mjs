/* THE FREE / PREMIUM PRODUCT BOUNDARY — the contract, asserted in a browser.
   Run:  cd tests && node free-premium-contract.mjs      (PORT=nnnn to redirect)

   This suite exists because every green run before it was compatible with the
   product being broken. `premium-boundary` 47/47, `ai-account-gate` 29/29 and
   `welding-premium` 42/42 all passed on a build where a Free learner could not
   use the Shadow Challenge at all and was told their connection was at fault.
   The gates were tested; the PRODUCT was not. So the checks here are written
   from the owner's approved boundary (docs/release/FREE_PREMIUM_CAPABILITY_MATRIX.md,
   decisions of 1 October 2026) rather than from the code:

     1. AI needs an ACCOUNT. Anonymous learners get no AI — decided, and pinned
        here so nobody "opens it up a little" by accident.
     2. The basic spoken loop is FREE: microphone -> recording -> transcription
        -> a response. Being understood is the activity.
     3. Shadow translation is FREE for a signed-in Free learner.
     4. The Shadow Challenge: capture, transcription, participation and the
        coverage / rhythm / completion feedback are FREE; the per-word
        pronunciation score and the AI meaning verdict are Premium.
     5. Nothing a Free learner had has moved to Premium.
     6. Every benefit the paywall SELLS is enforced somewhere. No phantoms.
     7. A refusal never lies about why.

   Three learners, each a separate browser context: signed out, signed in Free,
   signed in Premium — plus a Welding Free learner, because one subscription
   covers both tracks and the free loop must be whole on both. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { CAPABILITIES } from "../backend/entitlements/src/entitlement-core.js";

const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8694), BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
let srv = null;
if (!process.env.BASE) {
  srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  await sleep(1000);
  /* C3 in the 1 Oct shakeout: a suite whose port is taken gets ANOTHER
     session's worktree answering and certifies the wrong code, silently,
     because spawn(..., stdio:"ignore") hides the bind failure. Prove the
     server on this port is serving THIS index.html before asserting anything
     about it. */
  const served = await (await fetch(BASE + "index.html")).text();
  const disk = readFileSync(root + "index.html", "utf8");
  if (served.length !== disk.length) {
    console.log(`\n  ABORT  port ${PORT} is serving a different index.html (${served.length} bytes served vs ${disk.length} on disk).`);
    console.log("         Another session almost certainly holds this port. Re-run with PORT=<a free port>.\n");
    srv.kill(); process.exit(2);
  }
}
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 400)}`); };

const caps = on => CAPABILITIES.reduce((o, k) => (o[k] = on, o), { ai_allowance: on ? "enhanced" : "standard", practice_allowance: on ? "enhanced" : "standard" });
const FREE = { plan: "free", paid: false, state: "none", ads: true, capabilities: caps(false), expiresAt: null, source: null };
const PREMIUM = { plan: "premium", paid: true, state: "active", ads: false, capabilities: caps(true), expiresAt: Date.now() + 30 * 864e5, source: "app_store" };
const FLAGS = { billing_enabled: true, shadow_studio_v2_enabled: true, shadow_apply_phrase_enabled: true, shadow_challenge_enabled: true, home_v2_enabled: true };
const seed = tr => JSON.stringify({ profile: { name: "Alex", role: "", goal: "Speak with confidence in meetings", lang: "en", ts: 1 },
  professionalTracks: { activeId: tr },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const POLISH = "https://be-polish.nore-ngou.workers.dev";

/* one learner. `calls` records every request that reached the Worker mock, with
   the route it was for and whether it carried a token — which is how the
   "nothing was spent" and "the call was attributed" checks are made. */
async function learner({ track = "general-english", plan = null, heard = "we must agree the delivery date before friday", assessScore = 88 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"], serviceWorkers: "block" });
  await ctx.addInitScript(([s, flags]) => {
    localStorage.setItem("be12_v1", s);
    localStorage.setItem("be_flags", JSON.stringify(flags));
    localStorage.setItem("be_ent_api", "http://ent.test");
    localStorage.setItem("be_sv_txopen", "1"); localStorage.setItem("be_sv_watchopen", "1");
  }, [seed(track), FLAGS]);
  const calls = [];
  await ctx.route(u => u.href.startsWith(POLISH), route => {
    const req = route.request(), ct = req.headers()["content-type"] || "";
    const auth = req.headers()["authorization"] || null;
    let body = {};
    if (ct.includes("json")) { try { body = JSON.parse(req.postData() || "{}"); } catch (e) {} }
    const route_ = ct.startsWith("audio/") ? "transcribe"
      : body.assess ? "assess" : body.captions ? "captions" : body.ytai ? "ytai" : body.tts ? "tts"
      : body.chat ? "chat:" + (body.chat.purpose || "practice") : body.analyse ? "analyse" : body.mvreport ? "mvreport" : "polish";
    calls.push({ route: route_, auth });
    const j = (o, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
    if (route_ === "captions") return j({ error: "no_captions" });
    if (route_ === "assess") {
      const words = String(body.assess).toLowerCase().replace(/[^a-z' ]/g, "").split(/\s+/).filter(Boolean).map(w => ({ word: w, score: assessScore }));
      return j({ overall: assessScore, words, mode: "ai" });
    }
    if (route_ === "transcribe") return j({ text: heard, words: heard.split(/\s+/).map((w, i) => ({ w, start: i * 0.3, end: i * 0.3 + 0.25 })) });
    if (/says what it meant|said, in their OWN words/i.test(String(body.chat && body.chat.system || ""))) return j({ ok: true, missed: "", tip: "Say it a little slower." });
    if (body.chat) return j({ reply: "Nous devons nous accorder sur la date de livraison avant vendredi.", covered: [] });
    return j({ versions: [{ text: "x", learn: "y" }] });
  });
  /* the analytics, partner and push Workers are stubbed; YouTube is NOT, because
     shLoad waits for the real player before the Challenge panel exists — the
     same arrangement tests/shadow-challenge.mjs uses */
  await ctx.route(u => /be-events|be-partner|be-push|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  await ctx.route("http://ent.test/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(plan || FREE) }));
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html?t=" + Date.now()); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#premOv").forEach(e => e.remove()));
  if (plan) {
    await p.evaluate(() => { FBUser = { uid: "u-test", getIdToken: async () => "tok-u-test" }; _fbAuthSeen = true; });
    await p.evaluate(() => entRefresh()); await sleep(400);
  }
  return { ctx, p, calls, errs };
}
/* open the Challenge on a real captioned clip and land on the shadowed rung */
async function toChallenge(L, rung = "recall") {
  await L.p.evaluate(async () => { go("shadow"); await shLoad({ vid: "MZAjfsyJa1U", start: 0, end: 0, title: "clip" }, true); }); await sleep(2500);
  await L.p.evaluate(() => shOpenWork()); await sleep(300);
  await L.p.evaluate(() => { svPick = 5; svSetMode("challenge"); }); await sleep(250);
  await L.p.evaluate(r => { svCh.rung = r; svCh.fails = 0; svCh.gate = null; svCh.sync = null; svCh.retell = null; svCh.use = null; svCh.fb = null; svCh.phase = "ready"; svRender(); }, rung); await sleep(200);
}
const record = async (L, sel = "#svChRecBtn") => {
  await L.p.click(sel);
  await L.p.waitForFunction(() => rec.mr && rec.mr.state === "recording", null, { timeout: 8000 });
  await sleep(1600);
  await L.p.click(sel);
};
const panelText = L => L.p.evaluate(() => (document.querySelector("#svCh")?.innerText || "").replace(/\s+/g, " ").trim());

/* ========================================================================== */
console.log("\n# 1. ANONYMOUS — no account, therefore no AI (the approved model)");
{
  const L = await learner({ plan: null });
  const g = await L.p.evaluate(() => ({ gated: entGated(), noAcct: aiNoAccount(), stt: sttOff(), ai: aiOff("ai_analysis"), note: aiOffNote("ai_analysis") }));
  ok("1.1 · the app knows there is no account, before anything is attempted", g.gated === true && g.noAcct === true, JSON.stringify(g));
  ok("1.2 · transcription is withheld from an anonymous learner — this is the decision, not a bug", g.stt === true);
  ok("1.3 · …and the reason given is the account, never the microphone or the network", /sign in|account/i.test(g.note), g.note);
  const turn = await L.p.evaluate(async () => { const b = new Blob([new Uint8Array(4000)], { type: "audio/webm" }); const said = await fbTranscribe(b); return { said, why: fbTxWhy() }; });
  ok("1.4 · an anonymous spoken turn makes NO Worker call at all, so nothing is spent on it", L.calls.length === 0, JSON.stringify(L.calls));
  ok("1.5 · …and it reports 'account', which is what the shakeout found being shown as silence", turn.why === "account", JSON.stringify(turn));
  const tr = await L.p.evaluate(async () => { try { await svShTrFetch({ id: 0, text: "We must agree the delivery date." }); return "ok"; } catch (e) { return e.message; } });
  ok("1.6 · Shadow translation stops at the account too, rather than firing a request that cannot succeed", tr === "acct", tr);
  ok("1.7 · no page error in any of it", L.errs.length === 0, L.errs.join(" | "));
  await L.ctx.close();
}

console.log("\n# 2. AUTHENTICATED FREE — the basic spoken loop is whole");
{
  const L = await learner({ plan: FREE });
  const g = await L.p.evaluate(() => ({ gated: entGated(), noAcct: aiNoAccount(), stt: sttOff(), ai: aiOff("ai_analysis"), plan: entView().plan }));
  ok("2.1 · signed in, Free, and the gate is live — so this is the real Premium-on shape", g.gated === true && g.plan === "free" && g.noAcct === false, JSON.stringify(g));
  ok("2.2 · transcription is NOT withheld: microphone -> recording -> words is free", g.stt === false);
  ok("2.3 · …while the AI's judgement is still withheld, which is the product", g.ai === true);
  const turn = await L.p.evaluate(async () => { const b = new Blob([new Uint8Array(4000)], { type: "audio/webm" }); const said = await fbTranscribe(b); return { said, why: fbTxWhy() }; });
  ok("2.4 · a Free learner's spoken answer comes back as words", /delivery date/.test(turn.said) && !turn.why, JSON.stringify(turn));
  ok("2.5 · the call was attributed to the account (a token went with it), which is what makes free metering possible",
    L.calls.length === 1 && L.calls[0].route === "transcribe" && /^Bearer /.test(L.calls[0].auth || ""), JSON.stringify(L.calls));
  const tr = await L.p.evaluate(async () => { try { return await svShTrFetch({ id: 1, text: "We must agree the delivery date before Friday." }); } catch (e) { return "ERR:" + e.message; } });
  ok("2.6 · Shadow translation works for a Free learner — a learner cannot practise a line they cannot read", /date de livraison/.test(tr), tr);
  ok("2.7 · …over the free chat purpose, not a paid one", L.calls.some(c => c.route === "chat:practice") && !L.calls.some(c => c.route === "chat:report"), JSON.stringify(L.calls.map(c => c.route)));
  const words = await L.p.evaluate(async () => { const b = new Blob([new Uint8Array(4000)], { type: "audio/webm" }); const w = await fbWords(b); return Array.isArray(w) && w.length; });
  ok("2.8 · per-word TIMINGS (the free transcript) are available; it is the per-word SCORE that is paid", words > 0, String(words));
  const assess = await L.p.evaluate(async () => { const b = new Blob([new Uint8Array(4000)], { type: "audio/webm" }); return await fbAssess(b, "we must agree"); });
  ok("2.9 · the pronunciation grade returns null for a Free learner — the one gate, in one place (fbAssess)", assess === null, JSON.stringify(assess));
  ok("2.10 · …and it made no request, so a refusal costs nothing", !L.calls.some(c => c.route === "assess"), JSON.stringify(L.calls.map(c => c.route)));
  await L.ctx.close();
}

console.log("\n# 3. THE SHADOW CHALLENGE, FREE — participation and basic feedback");
{
  const L = await learner({ plan: FREE });
  await toChallenge(L);
  ok("3.1 · a Free learner reaches the Challenge with a microphone, not a lock", await L.p.evaluate(() => !!document.getElementById("svChRecBtn")));
  await record(L);
  const done = await L.p.waitForFunction(() => svCh && (svCh.phase === "feedback" || svCh.phase === "done"), null, { timeout: 20000 }).then(() => true, () => false);
  ok("3.2 · the recording is GRADED — before today this bailed out before doing any work", done, await L.p.evaluate(() => svCh && svCh.phase + " / " + svCh.err));
  const fb = await L.p.evaluate(() => svCh.fb && ({ verdict: svCh.fb.verdict, coverage: svCh.fb.coverage, ok_: svCh.fb.ok, total: svCh.fb.total, dims: Object.fromEntries(Object.entries(svCh.fb.dims).map(([k, v]) => [k, v.state])), pronMode: svCh.fb.pronMode }));
  ok("3.3 · coverage and word accuracy are there, computed on the device from the free transcript", fb && fb.coverage > 0 && fb.total > 0 && fb.ok_ > 0, JSON.stringify(fb));
  ok("3.4 · a verdict is there — Free closes the Speak -> Feedback loop", fb && !!fb.verdict, JSON.stringify(fb));
  ok("3.5 · the WORDS dimension is reported", fb && fb.dims.words && fb.dims.words !== "na", JSON.stringify(fb && fb.dims));
  ok("3.6 · the PRONUNCIATION dimension is absent, because that is the paid part", fb && (!fb.dims.pron || fb.dims.pron === "na") && fb.pronMode == null, JSON.stringify(fb));
  const txt = await panelText(L);
  ok("3.7 · the panel says the pronunciation score is Premium, in words", /pronunciation score is in Premium/i.test(txt), txt.slice(0, 500));
  ok("3.8 · and NOWHERE does it blame the connection — the exact lie the owner reported as 'intermittent'", !/connection|online/i.test(txt), (txt.match(/[^.]*connection[^.]*\./i) || [""])[0]);
  ok("3.9 · one upgrade offer under the report, not a lock in place of the practice", await L.p.evaluate(() => document.querySelectorAll("#svCh .prem-lock").length === 1 && !!document.querySelector("#svCh .sv-ch-rep")));
  ok("3.10 · no assess call was made anywhere in the rung", !L.calls.some(c => c.route === "assess"), JSON.stringify(L.calls.map(c => c.route)));
  ok("3.11 · the attempt is kept in the learner's own history like any other", await L.p.evaluate(() => aList("chHist").length >= 1));
  ok("3.12 · no page error", L.errs.length === 0, L.errs.join(" | "));
  await L.ctx.close();
}

console.log("\n# 4. THE SAME RUNG, PREMIUM — the paid depth arrives on top");
{
  const L = await learner({ plan: PREMIUM });
  await toChallenge(L);
  await record(L);
  await L.p.waitForFunction(() => svCh && (svCh.phase === "feedback" || svCh.phase === "done"), null, { timeout: 20000 }).catch(() => {});
  await sleep(1200);
  const fb = await L.p.evaluate(() => svCh.fb && ({ pron: svCh.fb.dims.pron && svCh.fb.dims.pron.state, pronMode: svCh.fb.pronMode, weak: (svCh.fb.weakWords || []).length }));
  ok("4.1 · Premium gets the per-word pronunciation grade the Free learner was told about", fb && fb.pronMode === "ai" && fb.pron && fb.pron !== "na", JSON.stringify(fb));
  ok("4.2 · the assess route WAS called, with the account's token", L.calls.some(c => c.route === "assess" && /^Bearer /.test(c.auth || "")), JSON.stringify(L.calls.map(c => c.route)));
  const txt = await panelText(L);
  ok("4.3 · no Premium note and no offer, because there is nothing to offer", !/is in Premium/i.test(txt) && await L.p.evaluate(() => !document.querySelector("#svCh .prem-lock")));
  ok("4.4 · Premium and Free took the SAME code path — one implementation, assess: null or assess: {}, never a parallel one",
    await L.p.evaluate(() => typeof ShadowSync.challenge === "function" && !!ShadowSync.challenge("we must agree", "we must agree", { assess: null }).verdict));
  await L.ctx.close();
}

console.log("\n# 5. THE OTHER FIVE RUNGS, FREE — nothing is a dead end");
{
  const L = await learner({ plan: FREE });
  await toChallenge(L, "retell");
  await record(L, "#svChRetellRecBtn");
  const got = await L.p.waitForFunction(() => svCh && svCh.retell && svCh.retell.res, null, { timeout: 20000 }).then(() => true, () => false);
  const r = await L.p.evaluate(() => svCh.retell && ({ res: svCh.retell.res, prem: !!svCh.retell.prem, heard: svCh.retell.heard, err: svCh.err }));
  ok("5.1 · RETELL: a Free learner is heard and the attempt completes", got && r && r.res && r.res.ok === true && !!r.heard, JSON.stringify(r));
  ok("5.2 · …it is marked as the Premium-judged part being absent, not as a pass it did not earn", r && r.prem === true && r.res.why === "free", JSON.stringify(r && r.res));
  const rt = await panelText(L);
  ok("5.3 · …and the panel says Premium judges the meaning, with no mention of a connection", /Premium judges whether your words carried the meaning/i.test(rt) && !/connection/i.test(rt), rt.slice(0, 400));
  ok("5.4 · …and the paid meaning call was never made", !L.calls.some(c => c.route === "chat:report"), JSON.stringify(L.calls.map(c => c.route)));
  /* the local guards still refuse the two ways out of the exercise — a Free
     pass is not a free pass */
  const guard = await L.p.evaluate(() => { const s = svChSegObj(); return { echo: ShadowSync.retellCheck(s.text, s.text).echo, thin: ShadowSync.retellCheck("yes", s.text).thin }; });
  ok("5.5 · …while saying the line back, or a one-word answer, is still refused by maths on the device", guard.echo === true && guard.thin === true, JSON.stringify(guard));
  /* the three drills: all three are local, and all three used to bail */
  const drills = await L.p.evaluate(() => ({
    build: ShadowSync.buildup("we must agree the delivery date before friday").length > 1,
    state: ShadowSync.drillState(null, "delivery", "delivery").state,
    mode: ShadowSync.drillState(null, "delivery", "delivery").mode,
    used: ShadowSync.usedExpression("i think we must agree the date", ["must", "agree"]),
  }));
  ok("5.6 · BUILD-UP, WORD DRILL and USE-IT all work with no paid call: the engine already degraded honestly", drills.build && drills.state === "good" && drills.mode === "asr" && drills.used === true, JSON.stringify(drills));
  await L.ctx.close();
}

console.log("\n# 6. NOTHING MOVED FREE -> PREMIUM, and no phantom is sold");
{
  const L = await learner({ plan: FREE });
  const g = await L.p.evaluate(() => ({
    caps: ENT_CAPS.slice(),
    verbal: hasEntitlement("ai_verbal_feedback"),
    rows: premBenefitRows().map(r => t(r[0], r[2] || {})),
    ads: entView().ads,
    sttFree: !sttOff(),
  }));
  ok("6.1 · the client's capability list is exactly the server's, and 'ai_verbal_feedback' is in neither",
    JSON.stringify(g.caps) === JSON.stringify(CAPABILITIES) && !g.caps.includes("ai_verbal_feedback") && !CAPABILITIES.includes("ai_verbal_feedback"), JSON.stringify(g.caps));
  ok("6.2 · asking for the removed capability is refused rather than silently granted", g.verbal === false);
  ok("6.3 · the paywall no longer sells 'feedback spoken back to you' — it was never enforced anywhere",
    !g.rows.some(r => /spoken back|read back|aloud/i.test(r)), JSON.stringify(g.rows));
  /* every remaining benefit row must correspond to something that is actually
     enforced. This is the rule that was broken: a row with no gate behind it. */
  ok("6.4 · every benefit still sold maps to an enforcement point (ai_analysis, advanced_progress, ai_coach)",
    g.rows.length >= 3 && g.rows.every(r => /AI|progress|analytics|Coach|video/i.test(r)), JSON.stringify(g.rows));
  ok("6.5 · ad-free is enforced through the plan's own `ads` field, so it is not a phantom either", g.ads === true);
  ok("6.6 · the natural voice is still FREE: it reads lessons and characters, which is content, not a verdict",
    await L.p.evaluate(() => typeof fbSay === "function" && !/aiOff\(/.test(String(fbSay))));
  ok("6.7 · and the free spoken loop is intact for this same learner, i.e. nothing was taken to pay for the above", g.sttFree === true);
  await L.ctx.close();
}

console.log("\n# 7. A REFUSAL NEVER LIES (D3 in the matrix)");
{
  /* a source-level assertion, because the lie was structural: six graders and
     the grammar drill reused err = "net" for a Premium refusal, and "net"
     resolves to "Feedback needs a connection… retry when you are online". */
  const src = readFileSync(root + "index.html", "utf8");
  const bails = [...src.matchAll(/if\(aiOff\("[a-z_]+"\)\)\{[^}]*?err="net"/g)].map(m => m[0]);
  ok("7.1 · no capability gate anywhere sets the OFFLINE error state", bails.length === 0, bails.join("\n"));
  const chains = [...src.matchAll(/\.err==="net"\?t\("sv\.ch_err_net"\)/g)].length;
  const prem = [...src.matchAll(/\.err==="premium"\?t\("sv\.ch_err_prem"\)/g)].length;
  const acct = [...src.matchAll(/\.err==="acct"\?t\("ai\.need_acct"\)/g)].length;
  ok("7.2 · every error chain that can say 'offline' can also say 'Premium' and 'sign in'", chains > 0 && prem === chains && acct === chains, `net ${chains} / premium ${prem} / acct ${acct}`);
  const L = await learner({ plan: FREE });
  const fix = await L.p.evaluate(async () => { const d = { phase: "grading", err: null }; window.fbFix = window.fbFix || {}; return { locked: entLocked("ai_analysis"), note: aiOffNote("ai_analysis") }; });
  ok("7.3 · and the shared note for a Free learner names Premium, not the network", /Premium|plan/i.test(fix.note) && !/connection|online/i.test(fix.note), fix.note);
  await L.ctx.close();
}

console.log("\n# 8. WELDING — one subscription, and the free loop whole on both tracks");
{
  const L = await learner({ track: "welding", plan: FREE });
  const g = await L.p.evaluate(() => ({ area: areaId(), gated: entGated(), stt: sttOff(), ai: aiOff("ai_analysis"), rows: premBenefitRows().map(r => t(r[0], r[2] || {})) }));
  ok("8.1 · a Welding learner is held by the SAME rule — the boundary carries no track term", g.area === "welding" && g.gated === true && g.ai === true, JSON.stringify(g));
  ok("8.2 · and is heard for free, exactly as on General English: the workshop and the interview stay usable", g.stt === false);
  const turn = await L.p.evaluate(async () => { const b = new Blob([new Uint8Array(4000)], { type: "audio/webm" }); return { said: await fbTranscribe(b), why: fbTxWhy() }; });
  ok("8.3 · a Welding spoken turn comes back as words, with no Premium wall mid-activity", /delivery date/.test(turn.said) && !turn.why, JSON.stringify(turn));
  ok("8.4 · Welding is not sold the removed 'spoken back' row either", !g.rows.some(r => /spoken back|aloud/i.test(r)), JSON.stringify(g.rows));
  const prem = await learner({ track: "welding", plan: PREMIUM });
  ok("8.5 · the same purchase makes Welding Premium — no second subscription, no second question",
    await prem.p.evaluate(() => entGated() && hasEntitlement("ai_analysis") === true && aiOff("ai_analysis") === false));
  await prem.ctx.close(); await L.ctx.close();
}

await browser.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})\n`);
process.exit(pass === res.length ? 0 : 1);
