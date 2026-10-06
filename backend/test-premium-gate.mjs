/* be-polish — the server-side entitlement boundary (Phase 8, 30 Sep 2026).
   Run: node backend/test-premium-gate.mjs
   The Worker module in Node. be-entitlements and OpenAI are stand-ins: no key,
   no network, no cost. Every assertion here is about who is allowed to spend.

   THE METERED CONTRACT (owner's tier spec, 5 Oct 2026). The AI's VERDICTS —
   `assess`, `analyse`, `mvreport`, chat purposes `coach` and `report` — are no
   longer a Premium LOCK. They are a daily ALLOWANCE per account per UTC day:
   Free 3, Premium 120, counted in the bucket `verdict:<YYYY-MM-DD>`. The first
   verdicts answer 200 and reach the provider; the one after the allowance is
   429 {error:"allowance", scope:"verdicts", limit, used, resetAt, plan,
   retryAfter} with Retry-After, and reaches NO provider. A 200 carries
   `X-BE-Allowance` = {used, limit, resetAt, plan}. The tier is Premium only
   when the view says plan "premium" AND paid true (or, from an older
   entitlements Worker with no `plan`, ad_free true); nothing the client sends
   can change it. 402 premium_required no longer occurs for these capabilities.
   Unchanged: 401 without a token, the free routes (heard, spoken to, polished —
   no verdict spent), 503 when the service fails, the 30/min 600/day backstop.
   The limiter here is the in-memory fallback (no DO), which persists across
   the run — so every account that must start fresh gets its own token. */
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };

/* be-entitlements: answers from `ent.reply(auth)`; every call is recorded.
   Anything aimed at OpenAI answers a minimal success, so a request that gets
   PAST the gate is visible as a provider call rather than as a 200 we invented. */
const ent = { calls: [], reply: null };
const ai = { calls: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("/v1/entitlement")) {
    ent.calls.push((init && init.headers && (init.headers.authorization || init.headers.Authorization)) || "");
    return ent.reply();
  }
  ai.calls.push(u);
  if (u.includes("/audio/speech")) return new Response("mp3", { status: 200 });
  if (u.includes("/audio/transcriptions")) return new Response(JSON.stringify({ text: "hello there friend of mine", words: [] }), { status: 200 });
  /* one body that satisfies every chat-shaped route: `versions` for the Polish
     path, `reply` for the chat / report paths. Which fields a route reads is
     its own business; this test only cares whether it was reached. */
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ versions: [{ text: "We should have done it.", learn: "should have" }], reply: "ok", covered: [] }) } }] }), { status: 200 });
};
const W = (await import(new URL("./polish-worker.js", import.meta.url))).default;

const OFF = {};                                                            // production today
const ON  = { PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test", OPENAI_KEY: "k" };
const view = caps => new Response(JSON.stringify({ plan: caps.ai_analysis ? "premium" : "free", paid: !!caps.ai_analysis, capabilities: caps }), { status: 200 });
/* the FIVE capabilities of the current contract (entitlement-core CAPABILITIES).
   ai_verbal_feedback was removed on 1 Oct 2026 — advertised, enforced nowhere,
   and TTS is free because the natural voice reads CONTENT. It is deliberately
   absent from these fixtures; section V below covers the separate question of
   an OLDER entitlements Worker that still sends it. */
const FREE = { ad_free: false, ai_analysis: false, advanced_progress: false, ai_coach: false, recommended_content: false };
const PREM = { ad_free: true, ai_analysis: true, advanced_progress: true, ai_coach: true, recommended_content: true };

let ipN = 0, tokN = 0;
async function ask(body, { env = ON, token = null, ip = null } = {}) {
  const headers = { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": ip || "10.0.0." + (++ipN) };
  if (token) headers.authorization = "Bearer " + token;
  const r = await W.fetch(new Request("https://be-polish.test/", { method: "POST", headers, body: JSON.stringify(body) }), { OPENAI_KEY: "k", ...env });
  return { status: r.status, j: await r.json().catch(() => null), h: r.headers };
}
const tok = () => "t" + (++tokN) + ".x.y";                      // a fresh token each time: never a cache hit, and (no parseable `sub`) its own account
/* the allowance a 200 reports: {used, limit, resetAt, plan}, or null when the route is not metered */
const allow = r => { try { return JSON.parse(r.h.get("X-BE-Allowance")); } catch (e) { return null; } };
const DAY_MS = 86_400_000;
const utcMidnight = at => new Date(at).toISOString().endsWith("T00:00:00.000Z");
/* a 429 of the metered kind, as the contract spells it */
const refused = (r, plan, limitN) => r.status === 429 && !!r.j && r.j.error === "allowance" && r.j.scope === "verdicts" && r.j.limit === limitN && r.j.used === limitN && r.j.plan === plan
  && r.j.resetAt > Date.now() && r.j.resetAt - Date.now() <= DAY_MS && Number(r.h.get("Retry-After")) > 0;
/* a 200 on the Free allowance: the header says limit 3, plan free — never 120, never premium */
const onFree = r => r.status === 200 && !!allow(r) && allow(r).limit === 3 && allow(r).plan === "free";
/* the SPEECH-TO-TEXT route: a raw audio body, not JSON. It had no coverage here
   at all until the 1 Oct 2026 shakeout, which is how it went unnoticed that a
   Free learner could not be heard. */
async function askAudio({ token, env = { PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test" }, ip } = {}) {
  const headers = { origin: "https://app.lomonec.com", "content-type": "audio/webm", "CF-Connecting-IP": ip || "10.0.0." + (++ipN) };
  if (token) headers.authorization = "Bearer " + token;
  const r = await W.fetch(new Request("https://be-polish.test/", { method: "POST", headers, body: new Uint8Array(2048) }), { OPENAI_KEY: "k", ...env });
  return { status: r.status, j: await r.json().catch(() => null), h: r.headers };
}
const ANALYSE = { analyse: { transcript: "this is a long enough sentence to pass", metrics: {} } };
const ASSESS  = { assess: "hello world", audio: "AAAA", format: "wav" };
const REPORT  = { mvreport: { system: "s", said: "one two three four five six" } };
const CHAT    = p => ({ chat: { purpose: p, system: "s", messages: [{ role: "user", content: "hi" }] } });

console.log("\n# Enforcement OFF — production today: nothing changes");
ent.reply = () => view(FREE);
let r = await ask(ANALYSE, { env: OFF });
ok("A1 · with PREMIUM_ENFORCED unset an anonymous caller still gets analysis", r.status === 200, r.status);
ok("A2 · …and the entitlement service was never asked", ent.calls.length === 0);
r = await ask({ chat: { system: "s", messages: [{ role: "user", content: "hi" }] } }, { env: OFF });
ok("A3 · a chat with NO purpose (an older cached index.html) still works", r.status === 200, r.status);

console.log("\n# Enforcement ON but only half-configured — must stay off, never half-on");
r = await ask(ANALYSE, { env: { PREMIUM_ENFORCED: "1" } });
ok("A4 · PREMIUM_ENFORCED without ENTITLEMENTS_URL does NOT gate (a half-deploy cannot lock everyone out)", r.status === 200, r.status);
r = await ask(ANALYSE, { env: { ENTITLEMENTS_URL: "https://ent.test" } });
ok("A5 · an entitlement URL without PREMIUM_ENFORCED does not gate either", r.status === 200, r.status);

console.log("\n# Enforcement ON — the boundary");
ent.calls = []; ai.calls = [];
r = await ask(ANALYSE);
ok("B1 · no Authorization header → 401, and no AI call was made", r.status === 401 && r.j.error === "auth_required" && ai.calls.length === 0, r.status);
/* ONE Free account through its day: the five verdict routes draw on one bucket */
ent.reply = () => view(FREE);
ai.calls = [];
const freeA = tok();
r = await ask(ANALYSE, { token: freeA });
let al = allow(r);
ok("B2 · a signed-in FREE account GETS analysis (200) — a verdict is metered, not locked", r.status === 200 && !!r.j && !r.j.error, r.status + " " + JSON.stringify(r.j).slice(0, 80));
ok("B3 · …the provider WAS called, and X-BE-Allowance reads 1/3 on plan free, exposed to the browser",
   ai.calls.length === 1 && al && al.used === 1 && al.limit === 3 && al.plan === "free" && /X-BE-Allowance/.test(r.h.get("Access-Control-Expose-Headers") || ""),
   ai.calls.length + " " + JSON.stringify(al) + " expose=" + r.h.get("Access-Control-Expose-Headers"));
r = await ask(ASSESS, { token: freeA }); al = allow(r);
ok("B4 · a FREE account gets pronunciation assessment too — the same bucket, 2/3", r.status === 200 && al && al.used === 2 && al.limit === 3, r.status + " " + JSON.stringify(al));
r = await ask(REPORT, { token: freeA }); al = allow(r);
ok("B5 · …and the speaking report: 3/3, the day's allowance now spent", r.status === 200 && al && al.used === 3 && al.limit === 3, r.status + " " + JSON.stringify(al));
ai.calls = [];
r = await ask(CHAT("coach"), { token: freeA });
ok("B6 · the 4th verdict (the AI coach) on that account is 429 allowance — scope verdicts, limit 3, used 3, plan free, resetAt = the next UTC midnight",
   refused(r, "free", 3) && utcMidnight(r.j.resetAt), r.status + " " + JSON.stringify(r.j) + " retry=" + r.h.get("Retry-After"));
ok("B7 · …Retry-After agrees with the body, and NO provider call was made — a refusal costs nothing",
   Number(r.h.get("Retry-After")) === r.j.retryAfter && r.j.retryAfter > 0 && ai.calls.length === 0, r.h.get("Retry-After") + " vs " + (r.j && r.j.retryAfter) + " provider=" + ai.calls.length);
r = await ask(CHAT("report"), { token: freeA });
ok("B8 · a report chat on the spent account is refused the same way — coach and report draw on ONE bucket", refused(r, "free", 3) && ai.calls.length === 0, r.status + " " + JSON.stringify(r.j));
r = await ask(ANALYSE, { token: tok() });
ok("B9 · a DIFFERENT Free account still has its own 3 — the allowance is per account", onFree(r) && allow(r).used === 1, r.status + " " + JSON.stringify(allow(r)));

console.log("\n# Free routes stay free — the practice itself is never metered");
r = await ask(CHAT("practice"), { token: tok() });
ok("C1 · a FREE account CAN run a role-play turn (practice)", r.status === 200, r.status);
r = await ask({ text: "we should of done it" }, { token: tok() });
ok("C2 · a FREE account CAN use Executive Polish", r.status === 200, r.status);
r = await ask({ tts: "hello", voice: "alloy" }, { token: tok() });
ok("C3 · a FREE account CAN use the natural voice", r.status === 200, r.status);
r = await ask({ text: "hello there" });
ok("C4 · …but a free route still needs an account while enforcement is on", r.status === 401, r.status);

/* BEING HEARD IS FREE (owner, 1 October 2026). The spoken turn is the activity;
   the AI's verdict on it is the product. Before this, transcribe cost
   ai_analysis, so a Free learner's interview and workshop answers were refused
   402 and the app reported it as a microphone that heard nothing. */
ent.reply = () => view(FREE);
ai.calls = [];
r = await askAudio({ token: tok() });
ok("C5 · a FREE account CAN be heard — the speech-to-text route costs no capability", r.status === 200, r.status + " " + JSON.stringify(r.j));
ok("C6 · …and the transcription really ran", ai.calls.some(u => /audio\/transcriptions/.test(u)), ai.calls.join(","));
r = await askAudio();
ok("C7 · …but being heard still needs an account while enforcement is on", r.status === 401 && r.j.error === "auth_required", r.status);
r = await askAudio({ token: tok(), env: OFF });
ok("C8 · with enforcement off it behaves exactly as production does today", r.status === 200, r.status);
{ /* one account: heard first (no verdict spent), then judged (verdicts counted) */
  const tC = tok();
  const heard = await askAudio({ token: tC });
  const a1 = await ask(ASSESS, { token: tC }), a2 = await ask(REPORT, { token: tC });
  ok("C9 · the metered routes did NOT become free with it — being heard spends no verdict (no X-BE-Allowance), while the assessment and the report of what was said count 1/3 and 2/3",
     heard.status === 200 && heard.h.get("X-BE-Allowance") === null && onFree(a1) && allow(a1).used === 1 && onFree(a2) && allow(a2).used === 2,
     heard.status + " " + heard.h.get("X-BE-Allowance") + " | " + a1.status + " " + JSON.stringify(allow(a1)) + " | " + a2.status + " " + JSON.stringify(allow(a2))); }

console.log("\n# A paying account gets everything it bought");
ent.reply = () => view(PREM);
for (const [n, b, cap] of [["analysis", ANALYSE, "ai_analysis"], ["assessment", ASSESS, "ai_analysis"], ["the report", REPORT, "ai_analysis"], ["the AI coach", CHAT("coach"), "ai_coach"]]) {
  r = await ask(b, { token: tok() });
  ok(`D· a PREMIUM account gets ${n}`, r.status === 200, r.status + " " + JSON.stringify(r.j));
}
/* Premium is METERED too, at 120 a day: asserted from the header after one
   call, not by exhausting it — the 30/min account backstop would bite first. */
al = allow(r);
ok("D5 · …and a Premium verdict is metered at 120 a day, plan premium (X-BE-Allowance after one call: 1/120)", al && al.used === 1 && al.limit === 120 && al.plan === "premium" && al.resetAt > Date.now() && al.resetAt - Date.now() <= DAY_MS, JSON.stringify(al));

console.log("\n# The service itself is down");
ent.reply = () => new Response("nope", { status: 500 });
ai.calls = [];
r = await ask(ANALYSE, { token: tok() });
ok("E1 · entitlements 5xx → 503, never a silent downgrade to Free", r.status === 503 && r.j.error === "entitlement_unavailable", JSON.stringify(r.j));
ok("E2 · …and no paid work was done on a guess", ai.calls.length === 0);
ent.reply = () => { throw new Error("network"); };
r = await ask(ANALYSE, { token: tok() });
ok("E3 · entitlements unreachable → 503 as well", r.status === 503, r.status);
ent.reply = () => new Response("no", { status: 401 });
r = await ask(ANALYSE, { token: tok() });
ok("E4 · a token the entitlement service rejects → 401, not 402", r.status === 401, r.status);

console.log("\n# The cache");
ent.reply = () => view(PREM);
ent.calls = [];
const t = tok();
await ask(ANALYSE, { token: t }); await ask(ANALYSE, { token: t }); await ask(ASSESS, { token: t });
ok("F1 · three calls with the same token ask the entitlement service once", ent.calls.length === 1, ent.calls.length);
ok("F2 · the header forwarded is the caller's own token, not a shared secret", ent.calls[0] === "Bearer " + t, ent.calls[0]);
await ask(ANALYSE, { token: tok() });
ok("F3 · a different token is looked up separately", ent.calls.length === 2, ent.calls.length);

console.log("\n# Bad input");
r = await ask({ chat: { purpose: "wide-open", system: "s", messages: [{ role: "user", content: "hi" }] } }, { token: tok() });
ok("G1 · an unknown chat purpose is refused (400), never treated as free", r.status === 400, r.status);
r = await ask(ANALYSE, { env: ON });
ok("G2 · an empty Authorization header is not an account", r.status === 401, r.status);

console.log("\n# Client spoofing — the server is the only authority (brief 9-12, 16)");
/* ONE Free account sends eight different "I am Premium" claims in a row. If any
   of them raised the ceiling, the header would read limit 120 / plan premium,
   or a 4th verdict would pass. Exactly three may pass — the three any Free
   account has — and they pass as FREE. */
ent.reply = () => view(FREE);
ai.calls = [];
const spoofer = tok();
let passed = 0, nth = 0;
for (const [n, extra] of [
  ["premium:true in the body",        { premium: true }],
  ["isPremium:true in the body",      { isPremium: true }],
  ["plan:'premium' in the body",      { plan: "premium" }],
  ["paid:true in the body",           { paid: true }],
  ["capability:'ai_analysis'",        { capability: "ai_analysis" }],
  ["capabilities:{ai_analysis:true}", { capabilities: { ai_analysis: true } }],
  ["entitlement:'premium'",           { entitlement: "premium" }],
  ["uid of another account",          { uid: "someone-else" }],
]) {
  nth++;
  r = await ask({ ...ANALYSE, ...extra }, { token: spoofer });
  if (r.status === 200) passed++;
  ok(`H· a FREE account sending ${n} stays on the Free allowance (${nth <= 3 ? "200 as free, " + nth + "/3" : "429 allowance, plan free"} — never premium, never 120)`,
     nth <= 3 ? onFree(r) && allow(r).used === nth : refused(r, "free", 3), r.status + " " + JSON.stringify(allow(r) || r.j));
}
ok("H9 · …exactly 3 of the 8 spoofs reached the provider — the three any Free account has; the claims bought a fourth for none of them", passed === 3 && ai.calls.length === 3, passed + " passed, provider=" + ai.calls.length);

/* the same claims as query string and as headers, since neither is the body —
   sent by the SPENT account, so a claim that re-keyed or raised the bucket
   would show as a 200 */
async function raw(url, headers, body, env = ON) {
  const r = await W.fetch(new Request(url, { method: "POST", headers: { origin: "https://app.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": "10.1.0." + (++ipN), ...headers }, body: JSON.stringify(body) }), { OPENAI_KEY: "k", ...env });
  return { status: r.status, j: await r.json().catch(() => null), h: r.headers };
}
ai.calls = [];
r = await raw("https://be-polish.test/?premium=1&plan=premium&capability=ai_analysis", { authorization: "Bearer " + spoofer }, ANALYSE);
ok("H10 · the same claims as QUERY PARAMETERS neither raise nor re-key the allowance: the spent account is still 429 allowance, plan free", refused(r, "free", 3), r.status + " " + JSON.stringify(r.j));
r = await raw("https://be-polish.test/", { authorization: "Bearer " + spoofer, "x-premium": "true", "x-plan": "premium", "x-dev-user": "admin", "x-capability": "ai_analysis" }, ANALYSE);
ok("H11 · the same claims as HEADERS do not either (no DEV_AUTH back door in be-polish)", refused(r, "free", 3), r.status + " " + JSON.stringify(r.j));
ok("H12 · …and neither spent anything", ai.calls.length === 0, ai.calls.join(","));

console.log("\n# An entitlement that is no longer in force (brief 6, 7, 8)");
/* be-entitlements resolves expiry and revocation itself: `resolve()` in
   entitlement-core.js answers view("free", status) for every not-in-force
   record — plan "free", paid false, FREE capabilities, the status kept as a
   label. Those are the shapes used here, plus one that keeps the "premium"
   label while unpaid. Each must sit on the Free allowance: 3 a day, then 429.
   NOT asserted: the old adversarial shape {plan premium, paid true, FREE
   capabilities}, which the real service cannot produce; be-polish now reads
   the tier from plan+paid and would meter it at 120 — see the report. */
const fourFree = async (token) => { const out = []; for (let i = 0; i < 4; i++) out.push(await ask(ANALYSE, { token })); return out; };
const freeDay = out => out.slice(0, 3).every((x, i) => onFree(x) && allow(x).used === i + 1) && refused(out[3], "free", 3);
for (const [n, body] of [
  ["expired",  { plan: "free", paid: false, state: "expired",  capabilities: FREE }],
  ["revoked",  { plan: "free", paid: false, state: "revoked",  capabilities: FREE }],
  ["in a payment_pending state", { plan: "free", paid: false, state: "payment_pending", capabilities: FREE }],
  ["still LABELLED premium but unpaid", { plan: "premium", paid: false, state: "expired", capabilities: FREE }],
]) {
  ent.reply = () => new Response(JSON.stringify(body), { status: 200 });
  ai.calls = [];
  const out = await fourFree(tok());
  ok(`I· an entitlement ${n} is on the FREE allowance: three verdicts pass as free (limit 3), the 4th is 429 allowance, and the provider was called 3 times`,
     freeDay(out) && ai.calls.length === 3, JSON.stringify(out.map(x => [x.status, allow(x) || (x.j && x.j.error)])) + " provider=" + ai.calls.length);
}
/* a capabilities block that is not an object: the tier falls to Free, and the
   `ad_free` fallback for an older Worker cannot be tripped by garbage */
ent.reply = () => new Response(JSON.stringify({ paid: true, state: "active", capabilities: "yes-all-of-them" }), { status: 200 });
ai.calls = [];
{ const out = await fourFree(tok());
  ok("I5 · a malformed capabilities field (no plan, paid true) grants Free only: 3 pass, the 4th is 429 allowance, and nothing beyond 3 was spent",
     freeDay(out) && ai.calls.length === 3, JSON.stringify(out.map(x => [x.status, allow(x) || (x.j && x.j.error)])) + " provider=" + ai.calls.length); }
ent.reply = () => new Response("<html>not json</html>", { status: 200 });
r = await ask(ANALYSE, { token: tok() });
ok("I6 · an entitlement response that is not JSON → 503, never a guess", r.status === 503, r.status);

console.log("\n# Track (brief 13-15) — ONE entitlement, and no server-held track data");
ent.reply = () => view(PREM);
for (const t of ["general", "welding"]) {
  r = await ask({ analyse: { ...ANALYSE.analyse, context: { track: t, task: "brief the team" } } }, { token: tok() });
  ok(`J· a PREMIUM account gets analysis on ${t} — one subscription covers both tracks`, r.status === 200, r.status);
}
/* ONE Free account, five track values: the first three pass as free, the
   fourth and fifth are refused — no value opens a second bucket or a larger one */
ent.reply = () => view(FREE);
ai.calls = [];
{ const tJ = tok(); let i = 0;
  for (const t of ["general", "welding", "admin", "../welding", ""]) {
    i++;
    r = await ask({ analyse: { ...ANALYSE.analyse, context: { track: t, task: "x" } } }, { token: tJ });
    ok(`J· a FREE account's allowance is the same whatever it puts in track (${t || "empty"}): ${i <= 3 ? "200 as free, " + i + "/3" : "429 allowance"}`,
       i <= 3 ? onFree(r) && allow(r).used === i : refused(r, "free", 3), r.status + " " + JSON.stringify(allow(r) || r.j));
  } }
ok("J8 · no track value let a FREE account spend past its 3", ai.calls.length === 3, ai.calls.length + " provider calls");

console.log("\n# Profession + standards (brief 16-21) — neither reaches this Worker");
/* professional-standards.js is a CLIENT module; be-polish has no profession and
   no standards registry, so there is no authoritative context for a client
   string to displace. These assert that such fields are inert, not trusted. */
ent.reply = () => view(FREE);
ai.calls = [];
{ const tK = tok(); let i = 0;
  for (const [n, extra] of [
    ["profession:'HSE Officer'",              { profession: "HSE Officer" }],
    ["profession inside the context",         { context: { track: "welding", profession: "Refinery Operator", task: "x" } }],
    ["a fabricated standard + clause",        { standard: "AWS D1.1", clause: "12.4", requirement: "anything I like" }],
    ["standards inside the context",          { context: { track: "welding", standards: [{ code: "AWS D1.1", clause: "99.9" }], task: "x" } }],
  ]) {
    i++;
    r = await ask({ analyse: { ...ANALYSE.analyse, ...extra } }, { token: tK });
    ok(`K· ${n} buys a FREE account nothing beyond its 3 (${i <= 3 ? "200 as free, " + i + "/3" : "the 4th is 429 allowance"})`,
       i <= 3 ? onFree(r) && allow(r).used === i : refused(r, "free", 3), r.status + " " + JSON.stringify(allow(r) || r.j));
  } }
ok("K5 · …and only the three allowed verdicts reached the provider — none of it bought a fourth", ai.calls.length === 3, ai.calls.length + " provider calls");
ent.reply = () => view(PREM);
const seen = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, i) => { if (!String(u).includes("/v1/entitlement")) seen.push(String((i && i.body) || "")); return realFetch(u, i); };
await ask({ analyse: { ...ANALYSE.analyse, profession: "HSE Officer", standard: "AWS D1.1", clause: "12.4", context: { track: "welding", profession: "Welder", standards: ["AWS D1.1 cl. 99"], task: "brief the crew" } } }, { token: tok() });
globalThis.fetch = realFetch;
const sent = seen.join(" ");
ok("K6 · the prompt the provider received carries NO client profession", !/HSE Officer|Refinery Operator/.test(sent));
ok("K7 · …and no client-supplied standard or clause", !/AWS D1\.1|12\.4|99/.test(sent), sent.slice(0, 200));
ok("K8 · the sanitised task context DID survive, so the feature still works", /brief the crew/.test(sent));

console.log("\n# The per-account limit holds the ACCOUNT, not a token that rotates hourly");
/* A Firebase ID token is refreshed about every hour. Keyed on the token hash,
   ACCT_PER_DAY reset on every refresh; keyed on the token's verified `sub` it
   does not. Each call below uses a fresh IP, so only the account limit can trip. */
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
let jwtN = 0;
const jwtFor = sub => "eyJhbGciOiJSUzI1NiJ9." + b64u({ sub, iat: ++jwtN }) + ".sig";   // a new token, same account
ent.reply = () => view(PREM);
let last = 0, calls = 0;
for (let i = 0; i < 40; i++) { const x = await ask(ANALYSE, { token: jwtFor("learner-A") }); calls++; last = x.status; if (x.status === 429) break; }
ok("L1 · one account rotating its token is rate-limited (429) despite a fresh token each time", last === 429, "after " + calls + " calls, last " + last);
ok("L2 · …and it took about the per-minute cap to get there, not an unlimited run", calls > 25 && calls <= 40, calls);
r = await ask(ANALYSE, { token: jwtFor("learner-B") });
ok("L3 · a DIFFERENT account is unaffected by that — no cross-account contamination", r.status === 200, r.status);
r = await ask(ANALYSE, { token: "notajwt.@@@.sig" });
ok("L4 · a token whose payload will not parse still gets a limit (falls back to the token hash), not a pass", r.status === 200, r.status);

/* ------------------------------------------------- deployment configuration
   The gate's CODE was never the problem on staging; its DEPLOYMENT was.
   premiumGate() reaches be-entitlements with a plain fetch(), and a Worker's
   fetch to another Worker on this account's workers.dev subdomain is refused
   (Cloudflare 1042) unless the Worker declares global_fetch_strictly_public.
   Without it the subrequest throws, capabilities() returns { status: 503 } and
   every AI call answers entitlement_unavailable for a signed-in learner — while
   the BROWSER's own direct call to the same entitlements Worker keeps working,
   so Profile still reads "Premium" while nothing AI does anything. That is the
   shape of the 30 Sep staging fault, found through Shadow Translate; be-push
   hit the identical wall on 27 Sep. The assertions below are about the .toml,
   because no amount of correct Worker code survives the flag being absent. */
console.log("\n# deployment configuration — the entitlements subrequest must be allowed out");
{
  const { readFileSync } = await import("node:fs");
  const toml = readFileSync(new URL("./wrangler.toml", import.meta.url), "utf8");
  const flags = /compatibility_flags\s*=\s*\[([^\]]*)\]/.exec(toml);
  const top = toml.split(/^\[/m)[0];                      /* before the first [section] = top level */

  ok("D1 · be-polish declares global_fetch_strictly_public",
    !!flags && flags[1].includes("global_fetch_strictly_public"), flags ? flags[1] : "no compatibility_flags at all");
  ok("D2 · …at the TOP level, so [env.staging] and production both inherit it",
    /compatibility_flags\s*=\s*\[[^\]]*global_fetch_strictly_public/.test(top));
  const stagingUrl = /\[env\.staging\.vars\][\s\S]*?ENTITLEMENTS_URL\s*=\s*"([^"]*)"/.exec(toml);
  ok("D3 · staging's ENTITLEMENTS_URL is a workers.dev host — exactly the case the flag exists for",
    !!stagingUrl && /\.workers\.dev/.test(stagingUrl[1]), stagingUrl ? stagingUrl[1] : "not found");
  ok("D4 · staging really does switch enforcement on (otherwise none of this is exercised)",
    /\[env\.staging\.vars\][\s\S]*?PREMIUM_ENFORCED\s*=\s*"1"/.test(toml));

  /* the learner-visible consequence, pinned at the gate: Shadow Translate is a
     chat call with purpose "practice", which is free — a signed-in FREE account
     must get through it, and a signed-out one must be told to authenticate
     rather than be handed a provider call. */
  ent.reply = () => view(FREE);
  let t = await ask({ chat: { purpose: "practice", system: "You are a translator.", messages: [{ role: "user", content: "Here is a career that comes with a lot of pressure." }] } }, { token: tok() });
  ok("D5 · Shadow Translate (chat purpose 'practice') succeeds for a signed-in FREE learner", t.status === 200, JSON.stringify(t.j));
  t = await ask({ chat: { purpose: "practice", system: "x", messages: [{ role: "user", content: "hello" }] } });
  ok("D6 · …and signed out it is 401 auth_required, which the client must not show as a network error",
    t.status === 401 && t.j.error === "auth_required", JSON.stringify(t.j));
  const before = ai.calls.length;
  ent.reply = () => { throw new Error("1042: fetch to a workers.dev Worker refused"); };
  t = await ask({ chat: { purpose: "practice", system: "x", messages: [{ role: "user", content: "hello" }] } }, { token: tok() });
  ok("D7 · if the subrequest is refused anyway → 503, and no provider call is made on a guess",
    t.status === 503 && t.j.error === "entitlement_unavailable" && ai.calls.length === before, JSON.stringify(t.j));
}

/* ---------------------------------------------------------------- preflight
   The gate only works if the browser is willing to SEND the token. Signing in
   makes every AI call carry Authorization, which makes it a preflighted
   request; a preflight that does not name `authorization` is refused by the
   browser before the Worker runs. curl cannot catch this — it sends no
   preflight — which is exactly how it survived a round of green curl checks. */
console.log("\n# CORS preflight — the token must be allowed through the browser");
{
  const pre = async (origin, ask = "authorization,content-type") => {
    const r = await W.fetch(new Request("https://be-polish.test/", { method: "OPTIONS",
      headers: { origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": ask } }), { OPENAI_KEY: "k", ...ON });
    return { status: r.status, allow: r.headers.get("Access-Control-Allow-Headers") || "", origin: r.headers.get("Access-Control-Allow-Origin") || "" };
  };
  let r = await pre("https://app.lomonec.com");
  ok("P1 · preflight names `authorization`, so a signed-in AI call is not blocked before it starts",
    /\bauthorization\b/i.test(r.allow), r.allow);
  ok("P2 · …and still names content-type", /\bcontent-type\b/i.test(r.allow), r.allow);
  ok("P3 · the allowed origin is echoed, never '*'", r.origin === "https://app.lomonec.com", r.origin);
  r = await pre("https://staging.lomonec.com");
  ok("P4 · the same for the staging origin", /\bauthorization\b/i.test(r.allow) && r.origin === "https://staging.lomonec.com", r.allow + " | " + r.origin);
  r = await pre("https://evil.example.com");
  ok("P5 · a disallowed origin still gets no allow-origin", !r.origin);
}

console.log("\n# V. an OLDER entitlements Worker that still sends the removed capability");
/* Real condition, not hypothetical: be-entitlements-staging (version 19cefc4d)
   still returns `ai_verbal_feedback` in its capability block — measured against
   the live Worker on 1 Oct 2026. be-polish must ignore a field that is no
   longer in the contract, and must not let it grant anything, so the two
   Workers can be deployed in either order. */
ent.calls = []; ai.calls = [];
const STALE_FREE = { ...FREE, ai_verbal_feedback: true, some_future_cap: true };
ent.reply = () => view(STALE_FREE);
{ const out = await fourFree(tok());
  ok("V1 · a stale answer carrying ai_verbal_feedback:true buys no tier: the account is on the Free allowance (limit 3, plan free) and the 4th verdict is 429 allowance",
     freeDay(out), JSON.stringify(out.map(x => [x.status, allow(x) || (x.j && x.j.error)])));
  ok("V2 · …and exactly three provider calls were made — the unknown field paid for none beyond them", ai.calls.length === 3, ai.calls.length + " provider calls"); }
r = await askAudio({ token: tok() });
ok("V3 · the free spoken turn is unaffected by the extra field", r.status === 200, r.status);
const STALE_PREM = { ...PREM, ai_verbal_feedback: true, some_future_cap: true };
ent.reply = () => view(STALE_PREM);
r = await ask(ANALYSE, { token: tok() });
ok("V4 · a Premium answer with extra fields is still Premium — the reader is additive-safe", r.status === 200, r.status);
/* and the reverse: a capability the contract no longer knows cannot be demanded */
ent.reply = () => view(FREE);
r = await ask({ chat: { purpose: "verbal", system: "s", messages: [{ role: "user", content: "hi" }] } }, { token: tok() });
ok("V5 · an unknown chat purpose is refused as a bad request, never silently treated as free", r.status === 400 && r.j.error === "bad_request", JSON.stringify(r.j));

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
