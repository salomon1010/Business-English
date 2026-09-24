/* be-entitlements — tests. Run: node backend/entitlements/test/run.mjs

   No wrangler, no Cloudflare, no Firebase: the Worker's own handle() runs
   against a real SQLite database (node:sqlite) built from the real migration,
   and every request carries a genuinely RS256-signed Firebase-shaped ID token
   from a key generated here. The JWKS and the clock are injected through the
   handler's deps argument, which no request can reach. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { generateKeyPairSync, createSign } from "node:crypto";
import { handle } from "../entitlements-worker.js";
import { resolve, validateRecord, isPremium, adsEnabled, hasCapability, PLANS } from "../src/entitlement-core.js";

const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const DAY = 86_400_000, T0 = Date.UTC(2026, 8, 24, 12);
let clock = T0;

/* ---- D1 shim over a real SQLite database (the three calls the Worker uses) */
function d1() {
  const db = new DatabaseSync(":memory:");
  for (const m of ["0001_entitlements.sql", "0002_rewards.sql", "0003_purchases.sql"]) db.exec(readFileSync(new URL("../migrations/" + m, import.meta.url), "utf8"));
  const norm = v => v === undefined ? null : v;
  return {
    raw: db,
    prepare(sql) {
      const st = db.prepare(sql); let args = [];
      const o = { bind: (...a) => { args = a.map(norm); return o; }, first: async () => st.get(...args) ?? null, run: async () => { const r = st.run(...args); return { success: true, meta: { changes: Number(r.changes) } }; }, all: async () => ({ results: st.all(...args) }) };
      return o;
    },
  };
}

/* ---- tokens */
const PROJECT = "be-mastery";
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const JWK = { ...publicKey.export({ format: "jwk" }), kid: "test-kid", alg: "RS256", use: "sig" };
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const b64u = b => Buffer.from(b).toString("base64url");
function token(uid, o = {}) {
  const sec = Math.floor((o.at ?? clock) / 1000);
  const h = { alg: "RS256", kid: o.kid || "test-kid", typ: "JWT" };
  const p = { iss: "https://securetoken.google.com/" + (o.proj || PROJECT), aud: o.proj || PROJECT, sub: uid, iat: sec - 10, exp: sec + (o.ttl ?? 3600), ...(o.extra || {}) };
  const data = b64u(JSON.stringify(h)) + "." + b64u(JSON.stringify(p));
  const s = createSign("RSA-SHA256"); s.update(data);
  return data + "." + b64u(s.sign(o.key || privateKey));
}

const ADMIN = "a".repeat(20) + "-owner-secret-0123456789";
const baseEnv = () => ({ DB: d1(), FIREBASE_PROJECT_ID: PROJECT, ALLOWED_ORIGINS: "https://app.lomonec.com,capacitor://localhost", ADMIN_TOKEN: ADMIN });
let env = baseEnv();
const deps = { now: () => clock, auth: { keys: [JWK], now: undefined } };
async function call(method, path, { tok, headers = {}, body, origin } = {}) {
  deps.auth.now = clock;
  const h = { ...headers };
  if (tok) h.authorization = "Bearer " + tok;
  if (origin) h.origin = origin;
  if (body !== undefined) h["content-type"] = "application/json";
  const r = await handle(new Request("https://ent.test" + path, { method, headers: h, body: body === undefined ? undefined : (typeof body === "string" ? body : JSON.stringify(body)) }), env, deps);
  const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
  return { status: r.status, json: j, text: txt, headers: r.headers };
}
const grant = (b, secret = ADMIN) => call("POST", "/v1/admin/grant", { headers: { authorization: "Bearer " + secret }, body: b });
const me = (uid, o) => call("GET", "/v1/entitlement", { tok: token(uid, o), ...(o || {}) });

console.log("\n# core — resolve()");
{
  const free = resolve(null, T0);
  ok("1 · missing record → free, state none, ads on", free.plan === "free" && free.state === "none" && free.ads === true && !isPremium(free));
  const pr = resolve({ uid: "u", plan: "premium", status: "active", starts_at: T0 - DAY, expires_at: T0 + 30 * DAY, source: "promo", updated_at: T0 }, T0);
  ok("2 · active premium → premium, paid, no ads, ad_free capability, expiry exposed", isPremium(pr) && pr.ads === false && hasCapability(pr, "ad_free") && pr.expiresAt === T0 + 30 * DAY && pr.source === "promo");
  const exp = resolve({ uid: "u", plan: "premium", status: "active", starts_at: T0 - 40 * DAY, expires_at: T0 - 1, updated_at: T0 }, T0);
  ok("3 · expired by time → free (state expired), ads on", exp.plan === "free" && exp.state === "expired" && adsEnabled(exp));
  ok("3b · status expired / revoked → free", ["expired", "revoked"].every(s => resolve({ uid: "u", plan: "premium", status: s, updated_at: T0 }, T0).plan === "free"));
  ok("3c · trialing and grace are in force until expires_at", ["trialing", "grace"].every(s => isPremium(resolve({ uid: "u", plan: "premium", status: s, expires_at: T0 + DAY, updated_at: T0 }, T0))));
  ok("3d · not yet started → free (pending)", resolve({ uid: "u", plan: "premium", status: "active", starts_at: T0 + DAY, updated_at: T0 }, T0).state === "pending");
  const bad = [
    { uid: "u", plan: "gold", status: "active", updated_at: T0 },
    { uid: "u", plan: "premium", status: "lifetime", updated_at: T0 },
    { uid: "u", plan: "premium", status: "active", expires_at: "tomorrow", updated_at: T0 },
    { uid: "u", plan: "premium", status: "active", starts_at: T0, expires_at: T0 - 1, updated_at: T0 },
    { uid: "u", plan: "premium", status: "active", product: "premium_lifetime", updated_at: T0 },
    { uid: "u", plan: "premium", status: "active", source: "cus_123", updated_at: T0 },
    { plan: "premium", status: "active", updated_at: T0 },
    "premium", 42,
  ];
  ok("4 · invalid records (unknown plan/status/product/source, bad times, no uid, non-objects) → free (state invalid)", bad.every(r => { const v = resolve(r, T0); return v.plan === "free" && v.state === "invalid"; }));
  ok("4b · a free-plan record is free", resolve({ uid: "u", plan: "free", status: "active", updated_at: T0 }, T0).plan === "free");
  ok("4c · the view carries no provider fields", Object.keys(pr).sort().join() === "ads,capabilities,expiresAt,paid,plan,renews,source,startedAt,state");
  ok("4d · plans are account-level capabilities, not tracks", Object.values(PLANS).every(p => !("tracks" in p) && !Object.keys(p.capabilities).some(k => /partner|shadow|welding|general|track/i.test(k))));
  ok("4e · validateRecord explains a refusal", validateRecord({ uid: "u", plan: "x", status: "active" }).why === "plan");
}

console.log("\n# Worker — reading the caller's entitlement");
{
  let r = await call("GET", "/v1/entitlement");
  ok("5 · no token → 401 (signed-out clients are free locally, the server gives nothing)", r.status === 401 && r.json.error === "auth");
  r = await me("alice");
  ok("6 · signed-in user with no row → free, state none", r.status === 200 && r.json.plan === "free" && r.json.state === "none" && r.json.ads === true);
  ok("6b · responses are no-store", r.headers.get("cache-control") === "no-store");
  r = await grant({ uid: "alice", product: "premium_annual", status: "active", expiresAt: T0 + 365 * DAY, source: "promo", note: "store-ref-SECRET-123" });
  ok("7 · owner grant (admin secret) stores a premium record", r.status === 200 && r.json.view.plan === "premium");
  r = await me("alice");
  ok("8 · server-authoritative: alice now reads premium, ads off", r.json.plan === "premium" && r.json.paid && r.json.ads === false && r.json.capabilities.ad_free === true);
  ok("9 · no billing identifiers reach the client (external_ref / product / uid absent)", !/SECRET|external_ref|premium_annual/.test(r.text) && !("uid" in r.json));
  clock = T0 + 366 * DAY;
  r = await me("alice");
  ok("10 · after expires_at the same row reads free (expired) with no write", r.json.plan === "free" && r.json.state === "expired");
  clock = T0;
}

console.log("\n# Worker — a client cannot grant itself Premium");
{
  let r = await call("GET", "/v1/entitlement?plan=premium&premium=1&uid=alice", { tok: token("bob") });
  ok("11 · query parameters (plan / premium / uid) are ignored — bob stays free", r.json.plan === "free");
  r = await call("GET", "/v1/entitlement", { tok: token("bob"), headers: { "x-plan": "premium", "x-dev-user": "alice", "x-premium": "true" } });
  ok("12 · spoofed headers incl. X-Dev-User are ignored without DEV_AUTH — bob stays bob, free", r.json.plan === "free");
  r = await call("GET", "/v1/entitlement", { headers: { "x-dev-user": "alice" } });
  ok("12b · X-Dev-User alone (no token) is not an identity in production → 401", r.status === 401);
  r = await call("GET", "/v1/entitlement", { tok: token("bob"), body: undefined });
  ok("13 · reading someone else is impossible: the uid is the token's sub", r.json.plan === "free");
  r = await call("POST", "/v1/entitlement", { tok: token("bob"), body: { plan: "premium", status: "active" } });
  ok("14 · no client write route: POST /v1/entitlement → 404", r.status === 404);
  r = await grant({ uid: "bob", plan: "premium", status: "active" }, "not-the-secret-" + "x".repeat(30));
  ok("15 · admin grant with a wrong secret → 401, nothing written", r.status === 401 && (await me("bob")).json.plan === "free");
  r = await call("POST", "/v1/admin/grant", { tok: token("bob"), body: { uid: "bob", plan: "premium", status: "active" } });
  ok("16 · a valid Firebase token is NOT an admin credential → 401", r.status === 401 && (await me("bob")).json.plan === "free");
  r = await me("bob", { key: other.privateKey });
  ok("17 · token signed by another key → 401", r.status === 401);
  r = await me("bob", { proj: "someone-else" });
  ok("18 · token for another Firebase project → 401", r.status === 401);
  r = await me("bob", { at: T0 - 3 * 3600_000, ttl: 3600 });
  ok("19 · expired token → 401", r.status === 401);
  const t = token("bob"); const [h, p, s] = t.split(".");
  const forged = h + "." + b64u(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url")), sub: "alice" })) + "." + s;
  r = await call("GET", "/v1/entitlement", { tok: forged });
  ok("20 · editing the token's sub to another user breaks the signature → 401", r.status === 401);
  r = await call("GET", "/v1/entitlement", { tok: "eyJhbGciOiJub25lIn0.eyJzdWIiOiJhbGljZSJ9." });
  ok("21 · alg:none token → 401", r.status === 401);
  r = await grant({ uid: "carol", plan: "gold", status: "active" });
  ok("22 · admin grant is validated: unknown plan refused (400)", r.status === 400 && r.json.why === "plan");
  r = await grant({ uid: "carol", plan: "premium", status: "active", source: "cus_999" });
  ok("22b · a provider id cannot be smuggled in as the source", r.status === 400 && r.json.why === "source");
}

console.log("\n# Worker — providers, erase, CORS, hidden admin");
{
  let r = await call("POST", "/v1/billing/google_play", { body: { purchaseToken: "x" } });
  ok("23 · Google Play notifications → 501 not_configured (no live provider this phase)", r.status === 501 && r.json.error === "not_configured");
  r = await call("POST", "/v1/billing/app_store", { body: {} });
  ok("24 · App Store notifications → 501 not_configured", r.status === 501);
  r = await call("POST", "/v1/billing/manual", { body: { uid: "bob", plan: "premium" } });
  ok("25 · the manual adapter is not reachable as a public billing route", r.status === 404);
  r = await call("DELETE", "/v1/me", { tok: token("alice") });
  ok("26 · DELETE /v1/me erases only the caller's row", r.status === 200 && r.json.erased === true && (await me("alice")).json.state === "none");
  const n = env.DB.raw.prepare("SELECT count(*) AS n FROM entitlement_audit WHERE uid='alice'").get().n;
  ok("27 · grant and erase are audited", n === 2, String(n));
  r = await call("GET", "/v1/entitlement", { tok: token("bob"), origin: "https://evil.example" });
  ok("28 · CORS: an unknown origin gets no allow-origin header", !r.headers.get("access-control-allow-origin"));
  r = await call("GET", "/v1/entitlement", { tok: token("bob"), origin: "capacitor://localhost" });
  ok("29 · CORS: the iOS shell origin is allowed (native-ready)", r.headers.get("access-control-allow-origin") === "capacitor://localhost");
  const env2 = baseEnv(); delete env2.ADMIN_TOKEN; const keep = env; env = env2;
  r = await grant({ uid: "bob", plan: "premium", status: "active" });
  ok("30 · without a configured ADMIN_TOKEN the admin route does not exist (404)", r.status === 404);
  env = { ...baseEnv(), DEV_AUTH: "1" };
  r = await call("GET", "/v1/entitlement", { headers: { "x-dev-user": "dana" } });
  ok("31 · X-Dev-User works only when DEV_AUTH=1 (local dev)", r.status === 200 && r.json.plan === "free");
  env = keep;
}

console.log("\n# rewarded ads — server-verified, single-use");
{
  const R = (method, path, o = {}) => call(method, path, o);
  const start = (uid, kind = "extra_ai_practice") => R("POST", "/v1/rewards/start", { tok: token(uid), body: { kind } });
  const verify = (nonce, txn, prov = "mock") => R("POST", "/v1/rewards/verify/" + prov, { body: { nonce, txn } });
  const claim = (uid, nonce, extra = {}) => R("POST", "/v1/rewards/claim", { tok: token(uid), body: { nonce, ...extra } });
  env = baseEnv();
  let r = await R("POST", "/v1/rewards/start", { body: { kind: "extra_ai_practice" } });
  ok("R1 · starting a reward needs a signed-in learner (401)", r.status === 401);
  r = await start("erin");
  ok("R2 · every reward kind ships disabled: start → 403 kind_off", r.status === 403 && r.json.error === "kind_off");
  env = { ...baseEnv(), REWARD_KINDS_ENABLED: "extra_ai_practice" };
  r = await start("erin", "unlimited_everything");
  ok("R3 · an unknown kind is refused even when rewards are on", r.status === 403);
  r = await verify("0".repeat(32), "txn-00000001");
  ok("R4 · the mock verifier does not exist outside dev/test (404)", r.status === 404);
  env = { ...env, MOCK_REWARDS: "1" };
  r = await start("erin"); const n1 = r.json.nonce;
  ok("R5 · a learner starts one → a single-use nonce", r.status === 200 && /^[a-f0-9]{32}$/.test(n1));
  r = await claim("erin", n1);
  ok("R6 · a cancelled / unfinished ad earns nothing: claim before verification → 409 not_verified", r.status === 409 && r.json.error === "not_verified");
  r = await claim("erin", n1, { verified: true, completed: true, reward: 99 });
  ok("R7 · the client cannot claim completion in the request body", r.status === 409);
  r = await verify(n1, "txn-erin-0001");
  ok("R8 · the network verifies the ad (server to server)", r.status === 200 && r.json.ok);
  r = await claim("frank", n1);
  ok("R9 · another learner cannot claim erin's nonce (404)", r.status === 404);
  r = await claim("erin", n1);
  ok("R10 · a verified completion produces exactly one reward", r.status === 200 && r.json.credited === true && r.json.balances.extra_ai_practice === 1);
  r = await claim("erin", n1);
  ok("R11 · a duplicate claim produces no second reward", r.status === 200 && r.json.credited === false && r.json.balances.extra_ai_practice === 1);
  r = await verify(n1, "txn-erin-0001");
  ok("R12 · the network's retry of the same callback is idempotent", r.status === 200 && r.json.again === true);
  const n2 = (await start("erin")).json.nonce;
  r = await verify(n2, "txn-erin-0001");
  ok("R13 · one watched ad (transaction id) cannot verify a second nonce (409)", r.status === 409);
  await verify(n2, "txn-erin-0002");
  const both = await Promise.all([claim("erin", n2), claim("erin", n2), claim("erin", n2)]);
  ok("R14 · three racing claims on one nonce credit exactly once", both.filter(x => x.json && x.json.credited).length === 1 && (await R("GET", "/v1/rewards", { tok: token("erin") })).json.balances.extra_ai_practice === 2);
  const n3 = (await start("erin")).json.nonce; clock += 31 * 60_000;
  r = await verify(n3, "txn-erin-0003");
  ok("R15 · an expired nonce cannot be verified (410)", r.status === 410);
  r = await claim("erin", n3);
  ok("R16 · …nor claimed", r.status === 409 || r.status === 410);
  clock = T0;
  for (let i = 0; i < 3; i++) { const n = (await start("gina")).json.nonce; await verify(n, "txn-gina-000" + i); await claim("gina", n); }
  r = await start("gina");
  ok("R17 · the daily cap per kind holds (429 daily_cap)", r.status === 429 && r.json.error === "daily_cap");
  await grant({ uid: "hana", plan: "premium", status: "active", expiresAt: T0 + 30 * 864e5, source: "promo" });
  r = await start("hana");
  ok("R18 · Premium never receives a rewarded ad (409 premium)", r.status === 409 && r.json.error === "premium");
  r = await R("GET", "/v1/rewards/verify/admob");
  ok("R19 · AdMob verification answers 501 until ADMOB_SSV_ENABLED is set (tested in billing.mjs)", r.status === 501);
  r = await R("GET", "/v1/rewards", { tok: token("ivan") });
  ok("R20 · a learner with nothing earned has empty balances; the response names no other account", r.status === 200 && Object.keys(r.json.balances).length === 0);
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
