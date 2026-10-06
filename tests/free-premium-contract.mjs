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
        pronunciation score and the AI meaning verdict are AI VERDICTS —
        METERED, not locked (the tier spec, docs/TIERS.md, 5 Oct 2026): a
        Free account has 3 a day, Premium 120 a day as a fair-use ceiling.
        With today's allowance the Free learner gets the real verdict; once
        it is spent the gate closes and the card says when it comes back.
     5. Nothing a Free learner had has moved to Premium.
     6. Every benefit the paywall SELLS is enforced somewhere — a capability
        gate or a metered allowance. No phantoms.
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
/* the Worker's count as the client remembers it (localStorage.be_ai_allow): today's allowance spent */
const SPENT = plan => JSON.stringify({ used: plan === "premium" ? 120 : 3, limit: plan === "premium" ? 120 : 3, resetAt: Date.now() + 3600e3, plan, at: Date.now() });
const spend = (L, plan = "free") => L.p.evaluate(s => localStorage.setItem("be_ai_allow", s), SPENT(plan));
const unspend = L => L.p.evaluate(() => localStorage.removeItem("be_ai_allow"));

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
  /* REVERSED BY THE OWNER, 3 Oct 2026: Shadow must not ask anyone to sign up
     to READ the transcript. The translation now declares chat purpose "shadow",
     which the Worker serves anonymously, so it fires and succeeds. The old
     assertion was right for its day — a request that could only 401 should not
     be made — and the thing it protected (never fire a call that cannot
     succeed) is now true for the opposite reason. */
  ok("1.6 · Shadow translation is NOT withheld from a signed-out learner — it is served anonymously",
    tr !== "acct" && !/^ERR/.test(String(tr)), String(tr));
  ok("1.6b · …and it is the ONLY thing a signed-out learner's Shadow asks the Worker for",
    L.calls.every(c => c.route === "chat:shadow"), JSON.stringify(L.calls.map(c => c.route)));
  ok("1.7 · no page error in any of it", L.errs.length === 0, L.errs.join(" | "));
  await L.ctx.close();
}

console.log("\n# 2. AUTHENTICATED FREE — the basic spoken loop is whole");
{
  const L = await learner({ plan: FREE });
  const g = await L.p.evaluate(() => ({ gated: entGated(), noAcct: aiNoAccount(), stt: sttOff(), ai: aiOff("ai_analysis"), plan: entView().plan }));
  ok("2.1 · signed in, Free, and the gate is live — so this is the real Premium-on shape", g.gated === true && g.plan === "free" && g.noAcct === false, JSON.stringify(g));
  ok("2.2 · transcription is NOT withheld: microphone -> recording -> words is free", g.stt === false);
  ok("2.3 · …and the AI's judgement is NOT withheld while today's allowance holds — the verdicts are metered, not locked", g.ai === false && await L.p.evaluate(() => entLocked("ai_analysis") === false && entLocked("ai_coach") === false), JSON.stringify(g));
  const turn = await L.p.evaluate(async () => { const b = new Blob([new Uint8Array(4000)], { type: "audio/webm" }); const said = await fbTranscribe(b); return { said, why: fbTxWhy() }; });
  ok("2.4 · a Free learner's spoken answer comes back as words", /delivery date/.test(turn.said) && !turn.why, JSON.stringify(turn));
  ok("2.5 · the call was attributed to the account (a token went with it), which is what makes free metering possible",
    L.calls.length === 1 && L.calls[0].route === "transcribe" && /^Bearer /.test(L.calls[0].auth || ""), JSON.stringify(L.calls));
  const tr = await L.p.evaluate(async () => { try { return await svShTrFetch({ id: 1, text: "We must agree the delivery date before Friday." }); } catch (e) { return "ERR:" + e.message; } });
  ok("2.6 · Shadow translation works for a Free learner — a learner cannot practise a line they cannot read", /date de livraison/.test(tr), tr);
  ok("2.7 · …over the free Shadow purpose, never a paid one", L.calls.some(c => c.route === "chat:shadow")
    && !L.calls.some(c => c.route === "chat:report" || c.route === "chat:coach"), JSON.stringify(L.calls.map(c => c.route)));
  const words = await L.p.evaluate(async () => { const b = new Blob([new Uint8Array(4000)], { type: "audio/webm" }); const w = await fbWords(b); return Array.isArray(w) && w.length; });
  ok("2.8 · per-word TIMINGS (the free transcript) are available; it is the per-word SCORE that is paid", words > 0, String(words));
  /* fbAssess re-encodes the take to WAV before sending, so the blob has to
     decode: half a second of silence in a WAV header */
  const WAV = `(() => { const sr = 16000, n = sr / 2, ab = new ArrayBuffer(44 + n * 2), dv = new DataView(ab), wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); wr(8, "WAVE"); wr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); wr(36, "data"); dv.setUint32(40, n * 2, true);
    return new Blob([ab], { type: "audio/wav" }); })()`;
  const assess = await L.p.evaluate(async wav => await fbAssess(eval(wav), "we must agree"), WAV);
  ok("2.9 · the pronunciation grade IS returned to a Free learner with allowance — fbAssess is the one gate, and it is open", assess && assess.mode === "ai" && Array.isArray(assess.words) && assess.words.length === 3, JSON.stringify(assess));
  ok("2.10 · …and the request was made over the account's token, which is how the Worker counts it against today's 3", L.calls.some(c => c.route === "assess" && /^Bearer /.test(c.auth || "")), JSON.stringify(L.calls.map(c => c.route)));
  /* today's three are spent: the same gate closes, in the same place */
  await spend(L);
  const out = await L.p.evaluate(async wav => ({ off: aiOff("ai_analysis"), locked: entLocked("ai_analysis"), note: aiOffNote("ai_analysis"), reset: allowResetText(aiAllowance()), card: premLockHTML("ai_analysis", "t"), assess: await fbAssess(eval(wav), "the delivery") }), WAV);
  ok("2.11 · with today's allowance SPENT, aiOff is true while entLocked stays false — the count closes the gate, not the plan", out.off === true && out.locked === false, JSON.stringify({ off: out.off, locked: out.locked }));
  ok("2.12 · …the note names the allowance and the time it comes back, never the connection", /used today's 3 AI verdicts/.test(out.note) && out.reset && out.note.includes(out.reset) && !/connection|online/i.test(out.note), out.note);
  ok("2.13 · …the allowance card is drawn with the offer (a Free learner can buy more), and never says 'unlimited'", /prem-lock prem-allow/.test(out.card) && /prem-lock-go/.test(out.card) && /Today's AI verdicts are used up/.test(out.card) && !/unlimited/i.test(out.card), out.card.slice(0, 300));
  ok("2.14 · …and fbAssess returns null WITHOUT a request: a spent allowance costs nothing", out.assess === null && L.calls.filter(c => c.route === "assess").length === 1, JSON.stringify(L.calls.map(c => c.route)));
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
  ok("3.6 · the PRONUNCIATION dimension is PRESENT — the Worker's assess answered, and a Free learner's allowance covers it", fb && fb.dims.pron && fb.dims.pron !== "na" && fb.pronMode === "ai", JSON.stringify(fb));
  const txt = await panelText(L);
  ok("3.7 · the panel says nothing about Premium or a spent allowance — there is nothing to say while the allowance holds", !/used up|in Premium|Unlock Premium/i.test(txt), txt.slice(0, 500));
  ok("3.8 · and NOWHERE does it blame the connection — the exact lie the owner reported as 'intermittent'", !/connection|online/i.test(txt), (txt.match(/[^.]*connection[^.]*\./i) || [""])[0]);
  ok("3.9 · no lock and no offer under the report: the practice AND its verdict are the learner's", await L.p.evaluate(() => document.querySelectorAll("#svCh .prem-lock").length === 0 && !!document.querySelector("#svCh .sv-ch-rep")));
  ok("3.10 · the assess call WAS made, with the account's token", L.calls.some(c => c.route === "assess" && /^Bearer /.test(c.auth || "")), JSON.stringify(L.calls.map(c => c.route)));
  /* the same report, once today's verdicts are spent: the dimension note says
     so in words and the allowance card appears under it — the practice stays */
  await spend(L);
  const sp = await L.p.evaluate(() => ({ dims: svChDimsHTML(svCh.fb).replace(/<[^>]+>/g, " "), card: premLockHTML("ai_analysis", "challenge") }));
  ok("3.10b · with the allowance spent the pronunciation note says today's AI verdicts are used up, and the allowance card (with its offer) is drawn — no connection blamed",
    /pronunciation score is an AI verdict, and today's are used up/i.test(sp.dims) && !/connection|online/i.test(sp.dims) && /prem-allow/.test(sp.card) && /prem-lock-go/.test(sp.card), JSON.stringify(sp).slice(0, 400));
  await unspend(L);
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
  ok("4.3 · no Premium note and no offer, because there is nothing to offer", !/is in Premium|used up/i.test(txt) && await L.p.evaluate(() => !document.querySelector("#svCh .prem-lock")));
  /* Premium is metered too: 120 a day is a fair-use ceiling, never "unlimited" */
  await spend(L, "premium");
  const fair = await L.p.evaluate(() => ({ off: aiOff("ai_analysis"), card: premLockHTML("ai_analysis", "t"), note: aiOffNote("ai_analysis") }));
  ok("4.3b · a paying learner at the fair-use ceiling: the gate closes, the card names the ceiling and the reset time, and carries NO offer (nothing to sell)",
    fair.off === true && /prem-allow/.test(fair.card) && /fair-use ceiling of 120 AI verdicts/.test(fair.card) && !/prem-lock-go|Unlock Premium/.test(fair.card) && !/unlimited/i.test(fair.card + fair.note), JSON.stringify(fair).slice(0, 400));
  await unspend(L);
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
  ok("5.2 · …and the verdict is the AI's own, not a pass marked 'Premium judges this' — the meaning check is one of today's 3", r && r.prem === false && r.res.why === "" && r.res.tip === "Say it a little slower.", JSON.stringify(r && r.res));
  const rt = await panelText(L);
  ok("5.3 · …the panel carries the AI's feedback, says nothing about a spent allowance and nothing about a connection", /Say it a little slower/.test(rt) && !/used up|comes back tomorrow/i.test(rt) && !/connection/i.test(rt), rt.slice(0, 400));
  ok("5.4 · …and the meaning call WAS made, over the report purpose, with the account's token", L.calls.some(c => c.route === "chat:report" && /^Bearer /.test(c.auth || "")), JSON.stringify(L.calls.map(c => c.route)));
  /* once today's verdicts are spent the rung still completes — marked as
     unjudged, with the allowance wording, never a fabricated pass */
  const spentWord = await L.p.evaluate(() => t("sv.ch_retell_prem"));
  ok("5.4b · the spent-allowance wording for this rung says 'recorded and counted' and that the verdict comes back, not 'Premium judges it'", /Recorded and counted/.test(spentWord) && /AI verdict/.test(spentWord) && /used up/.test(spentWord) && !/Premium judges/.test(spentWord) && !/connection/i.test(spentWord), spentWord);
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
  ok("6.4 · every benefit still sold maps to an enforcement point: a capability gate (advanced_progress, ai_coach) or a metered allowance (AI verdicts, video minutes)",
    g.rows.length >= 4 && g.rows.every(r => /AI verdicts a day|minutes a day of your own YouTube|progress|analytics|Coach|Shadow videos/i.test(r)) && !g.rows.some(r => /unlimited/i.test(r)), JSON.stringify(g.rows));
  ok("6.4b · the allowance rows name the Premium numbers (120 verdicts, 60 minutes — owner, 6 Oct 2026) and call them fair use — never 'unlimited'",
    g.rows.some(r => /^120 AI verdicts a day \(fair use\)/.test(r)) && g.rows.some(r => /^60 minutes a day/.test(r)), JSON.stringify(g.rows));
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
  /* 3 Oct 2026: the chains now also catch a signed-out learner the caller did
     not classify, so the condition is `.err==="acct"||aiNoAccount()`. Broader
     than before, never narrower — the pattern follows it. */
  const acct = [...src.matchAll(/\.err==="acct"\|\|aiNoAccount\(\)\?t\("ai\.need_acct"\)/g)].length;
  ok("7.2 · every error chain that can say 'offline' can also say 'allowance spent' (err \"premium\") and 'sign in'", chains > 0 && prem === chains && acct === chains, `net ${chains} / premium ${prem} / acct ${acct}`);
  const L = await learner({ plan: FREE });
  await spend(L);
  const fix = await L.p.evaluate(async () => ({ locked: entLocked("ai_analysis"), off: aiOff("ai_analysis"), note: aiOffNote("ai_analysis"), chain: t("sv.ch_err_prem"), sess: t("sess.report_prem") }));
  ok("7.3 · and the shared note for a Free learner whose verdicts are spent names the AI verdicts and the allowance, not the network", fix.off === true && /AI verdicts/.test(fix.note) && /come back at/.test(fix.note) && !/connection|online/i.test(fix.note), fix.note);
  ok("7.3b · the graders' \"premium\" error and the session's note both say 'AI verdicts … used up', and that the recording is saved — neither blames the network nor calls it a lock",
    /today's AI verdicts, and they are used up/.test(fix.chain) && /recording is saved/.test(fix.chain) && /Today's AI verdicts are used up/.test(fix.sess) && /recording is saved/.test(fix.sess) && !/connection|online|unlock/i.test(fix.chain + fix.sess), JSON.stringify(fix));
  await L.ctx.close();
}

console.log("\n# 8. WELDING — one subscription, and the free loop whole on both tracks");
{
  const L = await learner({ track: "welding", plan: FREE });
  const g = await L.p.evaluate(() => ({ area: areaId(), gated: entGated(), stt: sttOff(), ai: aiOff("ai_analysis"), rows: premBenefitRows().map(r => t(r[0], r[2] || {})) }));
  ok("8.1 · a Welding learner is held by the SAME metered rule — the boundary carries no track term: the AI runs on today's allowance, and stops the same way once it is spent",
    g.area === "welding" && g.gated === true && g.ai === false && await L.p.evaluate(s => { localStorage.setItem("be_ai_allow", s); const r = aiOff("ai_analysis") === true && /prem-allow/.test(premLockHTML("ai_analysis", "t")); localStorage.removeItem("be_ai_allow"); return r; }, SPENT("free")), JSON.stringify(g));
  ok("8.2 · and is heard for free, exactly as on General English: the workshop and the interview stay usable", g.stt === false);
  const turn = await L.p.evaluate(async () => { const b = new Blob([new Uint8Array(4000)], { type: "audio/webm" }); return { said: await fbTranscribe(b), why: fbTxWhy() }; });
  ok("8.3 · a Welding spoken turn comes back as words, with no Premium wall mid-activity", /delivery date/.test(turn.said) && !turn.why, JSON.stringify(turn));
  ok("8.4 · Welding is not sold the removed 'spoken back' row either", !g.rows.some(r => /spoken back|aloud/i.test(r)), JSON.stringify(g.rows));
  const prem = await learner({ track: "welding", plan: PREMIUM });
  ok("8.5 · the same purchase makes Welding Premium — no second subscription, no second question",
    await prem.p.evaluate(() => entGated() && hasEntitlement("ai_analysis") === true && aiOff("ai_analysis") === false));
  await prem.ctx.close(); await L.ctx.close();
}

console.log("\n# 9. F7 — the account requirement is stated BEFORE the activity, not after a turn fails");
{
  /* Before this, every one of these screens let a signed-out learner start,
     speak, and only then read "Sign in to use the AI features". The message was
     right and the moment was wrong, which is how it was experienced as
     "sometimes it just does not work". */
  const OUT = await learner({ plan: null });          // signed out, billing on
  const notice = await OUT.p.evaluate(() => ({
    needed: aiAcctNeeded(),
    html: aiAcctNoticeHTML("t"),
  }));
  ok("9.1 · a signed-out General English learner is one the notice applies to", notice.needed === true);
  /* 9.2, 9.3 and 9.5 asked for the CARD's wording: a FREE ACCOUNT chip, a
     "this is not Premium" disclaimer and the "still counts" reassurance. The
     owner replaced that card with one sentence on 3 Oct 2026, so the old
     strings are gone by instruction. The invariants behind them are not, and
     are asserted directly instead: the thing must still be an ACCOUNT offer
     and must still be impossible to mistake for a paywall — which a sentence
     carrying no Premium word at all guarantees more strongly than a
     disclaimer did. */
  ok("9.2 · it is an invitation to create an account — no price, no lock, no Premium word",
    /account/i.test(notice.html) && !/\$|£|€/.test(notice.html) && !/ic-lock|prem-lock/.test(notice.html)
    && !/premium/i.test(notice.html), notice.html.slice(0, 300));
  ok("9.3 · …and it is ONE compact link, not a card: no second button, no paragraphs",
    (notice.html.match(/<button/g) || []).length === 1 && !/<p[ >]/.test(notice.html)
    && !/class="card/.test(notice.html) && /acct-link/.test(notice.html), notice.html);
  ok("9.4 · …and offers creating an account, not a purchase",
    /fbOpenModal\('up'\)/.test(notice.html) && !/premiumOpen/.test(notice.html));
  ok("9.5 · …and the promise that practice still counts is still made where a run fails",
    await OUT.p.evaluate(() => /still counts|saved/i.test(t("ai.need_acct"))));
  ok("9.5b · the whole sentence is the tap target, and it is reachable by keyboard",
    /<button[^>]*type="button"[^>]*class="acct-link"/.test(notice.html)
    && />[^<]{10,}<\/button>/.test(notice.html), notice.html);
  /* THE SHAPE (owner, 5 Oct 2026): a small centred pill in the gap between two
     cards, not a full-width row — and the Premium gate's button is the same
     family, so the two read alike wherever they appear. */
  const pill = await OUT.p.evaluate(() => {
    const host = document.createElement("div"); host.style.width = "390px"; document.body.appendChild(host);
    host.innerHTML = aiAcctNoticeHTML("polish") + premLockHTML("advanced_progress", "probe");
    const a = host.querySelector(".acct-link"), g = host.querySelector(".prem-lock-go");
    const shape = e => { if (!e) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return { h: Math.round(r.height), w: Math.round(r.width), round: cs.borderTopLeftRadius, mid: Math.round(r.left + r.width / 2), full: Math.round(r.width) >= 380 }; };
    const out = { a: shape(a), g: shape(g), hostMid: 195 };
    host.remove(); return out;
  });
  ok("9.5c · both are a small centred pill: rounded, never the full width, 40 px tall",
    pill.a && pill.g && pill.a.round === "999px" && pill.g.round === "999px"
    && !pill.a.full && !pill.g.full && pill.a.h <= 48 && pill.g.h <= 48
    && Math.abs(pill.a.mid - pill.hostMid) <= 3 && Math.abs(pill.g.mid - pill.hostMid) <= 3, JSON.stringify(pill));

  /* every screen in the brief, drawn signed out */
  const screens = await OUT.p.evaluate(async () => {
    const out = {};
    /* Executive Polish (the dictation mic and the rewrite both call the Worker) */
    out.polish = /acct-link/.test(exIdleHTML());
    /* the daily session's Record yourself panel. NOTE the session renders into
       #v-journey, not a #v-session of its own, so this looks for the panel and
       the notice in the document and checks their ORDER — which is the property
       F7 is actually about. */
    go("session", 1, "Mon"); await new Promise(r => setTimeout(r, 700));
    const recP = document.querySelector(".rec-panel"), na = document.querySelector(".acct-link");
    out.session = !!(recP && na);
    out.sessionBeforeMic = !!(recP && na && (na.compareDocumentPosition(recP) & Node.DOCUMENT_POSITION_FOLLOWING));
    /* role-play: the intro screen that carries the Start button */
    go("roleplay", "iv-tellme"); await new Promise(r => setTimeout(r, 700));
    const rp = document.getElementById("v-roleplay");
    out.roleplay = !!(rp && rp.querySelector(".acct-link"));
    out.roleplayBeforeStart = !!(rp && rp.querySelector(".acct-link") && rp.querySelector(".rp-start") &&
      rp.querySelector(".acct-link").compareDocumentPosition(rp.querySelector(".rp-start")) & Node.DOCUMENT_POSITION_FOLLOWING);
    return out;
  });
  ok("9.6 · Executive Polish shows it", screens.polish === true);
  ok("9.7 · the daily session's Record yourself panel shows it", screens.session === true, JSON.stringify(screens));
  ok("9.7b · …above the microphone, not under it", screens.sessionBeforeMic === true, JSON.stringify(screens));
  ok("9.8 · role-play shows it", screens.roleplay === true, JSON.stringify(screens));
  ok("9.9 · …ABOVE the Start button — the point of F7 is that it comes first", screens.roleplayBeforeStart === true, JSON.stringify(screens));
  await OUT.ctx.close();

  /* Shadow and the Challenge, on a real clip */
  const SH = await learner({ plan: null });
  await toChallenge(SH);
  const sh = await SH.p.evaluate(() => ({
    challenge: !!document.querySelector("#svCh .acct-link"),
    mic: !!document.getElementById("svChRecBtn"),
    shadowCard: (() => { try { svSetMode("shadow"); return /acct-link/.test(svShHTML()); } catch (e) { return "ERR:" + e.message; } })(),
  }));
  /* 9.10 and 9.12 asserted that the account notice appears INSIDE Shadow. The
     owner removed it from the whole Shadow experience on 3 Oct 2026, so they
     now assert its absence. 9.11 is untouched and still carries the point both
     of them were really making: the notice never blocked the activity. */
  ok("9.10 · the Shadow Challenge panel shows NO account notice — Shadow asks nobody to sign up", sh.challenge === false, JSON.stringify(sh));
  ok("9.11 · …and the microphone is still there: the notice informs, it does not block", sh.mic === true, JSON.stringify(sh));
  ok("9.12 · nor does the Shadow paragraph card", sh.shadowCard === false, JSON.stringify(sh));

  /* 2. no doomed request while signed out */
  SH.calls.length = 0;
  const fired = await SH.p.evaluate(async () => {
    const blob = new Blob([new Uint8Array(4000)], { type: "audio/webm" });
    const r = { said: await fbTranscribe(blob), words: await fbWords(blob), assess: await fbAssess(blob, "x") };
    try { await svShTrFetch({ id: 9, text: "Hello." }); r.tr = "ok"; } catch (e) { r.tr = e.message; }
    return r;
  });
  /* The rule was "signed out, spend nothing". Shadow's reading helpers are now
     the ONE exception the owner carved (3 Oct 2026), so the rule becomes: the
     only thing a signed-out learner can spend is the Shadow helper, and the
     judgement paths — transcription, scoring, analysis — still spend nothing.
     That is the property worth guarding, and it is now asserted directly. */
  ok("9.13 · signed out, the ONLY request fired is the Shadow reading helper — nothing is judged",
    SH.calls.every(c => c.route === "chat:shadow"), JSON.stringify(SH.calls.map(c => c.route)));
  ok("9.13b · …and specifically no transcription, no scoring and no analysis",
    !SH.calls.some(c => /transcribe|assess|analyse|mvreport|chat:report|chat:coach/.test(c.route)), JSON.stringify(SH.calls.map(c => c.route)));
  ok("9.14 · the judged paths still return their honest empty answer rather than a fabricated one",
    fired.said === "" && fired.words === null && fired.assess === null, JSON.stringify(fired));
  ok("9.14b · …while the translation now actually arrives for that same signed-out learner",
    fired.tr !== "acct" && !/^ERR/.test(String(fired.tr)), JSON.stringify(fired));
  await SH.ctx.close();

  /* 3. a Free authenticated learner may proceed, and sees no notice */
  const FREEL = await learner({ plan: FREE });
  const f = await FREEL.p.evaluate(() => ({ needed: aiAcctNeeded(), html: aiAcctNoticeHTML("t"), polish: /acct-link/.test(exIdleHTML()) }));
  ok("9.15 · a signed-in FREE learner sees NO account notice — the requirement is met", f.needed === false && f.html === "" && f.polish === false, JSON.stringify(f));
  await FREEL.ctx.close();

  /* 4. the allowance card still says "allowance", not "account" */
  const PR = await learner({ plan: FREE });
  const lock0 = await PR.p.evaluate(() => premLockHTML("ai_analysis", "t"));
  await spend(PR);
  const pr = await PR.p.evaluate(() => ({
    lock: premLockHTML("ai_analysis", "t"),
    note: aiOffNote("ai_analysis"),
    acct: aiAcctNoticeHTML("t"),
  }));
  ok("9.16 · for a signed-in Free learner the AI card is drawn only once today's verdicts are spent — and then it is the allowance card with the offer, never the account link",
    lock0 === "" && /prem-lock prem-allow/.test(pr.lock) && /premiumOpen/.test(pr.lock) && !/acct-link/.test(pr.lock), pr.lock.slice(0, 200));
  ok("9.17 · …and the two messages are never both shown: the account one is empty here", pr.acct === "", pr.acct);
  ok("9.18 · …and the allowance note does not mention an account or signing in",
    !/sign in|create an account/i.test(pr.note), pr.note);
  await PR.ctx.close();

  /* 5. Welding is untouched */
  const W = await learner({ track: "welding", plan: null });
  const w = await W.p.evaluate(() => ({
    area: areaId(),
    needed: aiAcctNeeded(),
    html: aiAcctNoticeHTML("t"),
    noAcct: aiNoAccount(),
    polish: /acct-link/.test(exIdleHTML()),
    stt: sttOff(),
  }));
  /* REVERSED by the owner, 3 Oct 2026: "the Polish side in General English —
     do the same for the Welding side, exactly the same restriction." The
     account requirement was always identical on both tracks server-side; the
     old gate only withheld the explanation from welders. */
  ok("9.19 · WELDING signed out: the SAME account link renders — the restriction is identical on both tracks",
    w.area === "welding" && w.needed === true && /acct-link/.test(w.html) && w.polish === true, JSON.stringify(w));
  ok("9.20 · …while the underlying account requirement is still TRUE there, so the runtime message still tells the truth",
    w.noAcct === true && w.stt === true, JSON.stringify(w));
  await W.ctx.close();
}

await browser.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})\n`);
process.exit(pass === res.length ? 0 : 1);
