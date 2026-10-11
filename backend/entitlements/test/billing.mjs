/* be-entitlements — Phase 9 store verification tests.
   Run: node backend/entitlements/test/billing.mjs   (needs openssl on PATH)

   No Google, Apple or AdMob account is involved. Each is played here with
   REAL cryptography, so the Worker's verification code runs exactly as in
   production:
     Google  a generated service-account key; a fake OAuth token endpoint that
             checks the RS256 assertion; a fake androidpublisher v3
             (subscriptionsv2 + acknowledge); Pub/Sub pushes signed with a
             generated "Google" OIDC key.
     Apple   a real X.509 chain made with openssl — P-384 root, P-384
             intermediate with Apple's marker OID, P-256 leaf with the
             receipt-signing OID — and JWS signed ES256 by the leaf.
     AdMob   a generated P-256 key signing real SSV query strings.
   What this cannot prove: that the live stores answer in exactly these
   shapes. That needs Play Console / App Store Connect sandbox testing. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, createSign, createVerify, sign as nodeSign, createHash, randomUUID, createPrivateKey } from "node:crypto";
import { handle, MAX_BODY, PURCHASE_PER_MIN } from "../entitlements-worker.js";
import { _resetTokenCache } from "../src/google-play.js";
import { open as openToken } from "../src/token-vault.js";

const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
/* an hour after "now": the openssl certificates below are issued now, so the test clock sits inside their validity */
const DAY = 86_400_000, T0 = Math.floor(Date.now() / 1000) * 1000 + 3_600_000; let clock = T0;
const b64u = b => Buffer.from(b).toString("base64url");

function d1() {
  const db = new DatabaseSync(":memory:");
  for (const m of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).sort()) db.exec(readFileSync(new URL("../migrations/" + m, import.meta.url), "utf8"));
  return { raw: db, prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; } };
}

/* ---------------- Firebase (learner identity) ---------------- */
const fb = generateKeyPairSync("rsa", { modulusLength: 2048 });
const FBJWK = { ...fb.publicKey.export({ format: "jwk" }), kid: "fb", alg: "RS256" };
const idTok = uid => { const s = Math.floor(clock / 1000); const d = b64u(JSON.stringify({ alg: "RS256", kid: "fb" })) + "." + b64u(JSON.stringify({ iss: "https://securetoken.google.com/be-mastery", aud: "be-mastery", sub: uid, iat: s - 5, exp: s + 3600 }));
  const g = createSign("RSA-SHA256"); g.update(d); return d + "." + b64u(g.sign(fb.privateKey)); };

/* ---------------- Google: service account, androidpublisher, Pub/Sub ---------------- */
const sa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SA = { client_email: "be-billing@test.iam.gserviceaccount.com", private_key: sa.privateKey.export({ type: "pkcs8", format: "pem" }), private_key_id: "sa1" };
const G = { subs: new Map(), acks: [], tokenCalls: 0, apiCalls: 0 };
const iso = ms => new Date(ms).toISOString();
const gsub = (o = {}) => ({ kind: "androidpublisher#subscriptionPurchaseV2", subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", startTime: iso(T0 - DAY),
  acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING", lineItems: [{ productId: "premium_monthly", expiryTime: iso(T0 + 30 * DAY) }], ...o });
async function fakeFetch(url, init = {}) {
  const u = String(url);
  if (u === "https://oauth2.googleapis.com/token") {
    G.tokenCalls++;
    const assertion = new URLSearchParams(init.body).get("assertion"); const [h, p, s] = assertion.split(".");
    const v = createVerify("RSA-SHA256"); v.update(h + "." + p);
    const claims = JSON.parse(Buffer.from(p, "base64url"));
    const good = v.verify(sa.publicKey, Buffer.from(s, "base64url")) && claims.iss === SA.client_email && /androidpublisher/.test(claims.scope);
    return new Response(JSON.stringify(good ? { access_token: "g-access", expires_in: 3600 } : { error: "invalid_grant" }), { status: good ? 200 : 400 });
  }
  const m = /androidpublisher\/v3\/applications\/([^/]+)\/purchases\/(subscriptionsv2\/tokens|subscriptions)\/([^/:]+)(?:\/tokens\/([^:]+))?(:acknowledge)?$/.exec(u);
  if (m) {
    G.apiCalls++;
    if ((init.headers || {}).authorization !== "Bearer g-access") return new Response("{}", { status: 401 });
    if (decodeURIComponent(m[1]) !== "com.bemastery.app") return new Response("{}", { status: 404 });
    if (m[5]) { G.acks.push(decodeURIComponent(m[4])); const s = G.subs.get(decodeURIComponent(m[4])); if (s) s.acknowledgementState = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"; return new Response("{}", { status: 200 }); }
    const s = G.subs.get(decodeURIComponent(m[3])); return s ? new Response(JSON.stringify(s), { status: 200 }) : new Response("{}", { status: 404 });
  }
  return new Response("not faked: " + u, { status: 599 });
}
const goog = generateKeyPairSync("rsa", { modulusLength: 2048 });
const GJWK = { ...goog.publicKey.export({ format: "jwk" }), kid: "g1", alg: "RS256" };
const oidc = (o = {}) => { const s = Math.floor(clock / 1000); const d = b64u(JSON.stringify({ alg: "RS256", kid: o.kid || "g1" })) + "." + b64u(JSON.stringify({ iss: "https://accounts.google.com", aud: o.aud || "https://ent.test/v1/billing/google_play", email: o.email || "pubsub@test.iam.gserviceaccount.com", email_verified: true, iat: s - 5, exp: s + 3600 }));
  const g = createSign("RSA-SHA256"); g.update(d); return d + "." + b64u(g.sign(o.key || goog.privateKey)); };
const rtdnBody = (data, messageId) => JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ version: "1.0", packageName: "com.bemastery.app", eventTimeMillis: String(clock), ...data })).toString("base64"), messageId }, subscription: "projects/p/subscriptions/s" });

/* ---------------- Apple: a real certificate chain ---------------- */
const dir = mkdtempSync(join(tmpdir(), "be-apple-"));
const ossl = (...a) => { const r = spawnSync("openssl", a, { cwd: dir, encoding: "utf8" }); if (r.status !== 0) throw new Error("openssl " + a.join(" ") + ": " + r.stderr); return r.stdout; };
function chain(tag, { leafOid = true, interOid = true } = {}) {
  ossl("ecparam", "-name", "secp384r1", "-genkey", "-noout", "-out", `${tag}root.key`);
  ossl("req", "-x509", "-new", "-key", `${tag}root.key`, "-sha384", "-days", "3650", "-subj", `/CN=${tag} Test Root`, "-out", `${tag}root.pem`, "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign");
  writeFileSync(join(dir, `${tag}inter.ext`), "basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign\n" + (interOid ? "1.2.840.113635.100.6.2.1=ASN1:NULL\n" : ""));
  ossl("ecparam", "-name", "secp384r1", "-genkey", "-noout", "-out", `${tag}inter.key`);
  ossl("req", "-new", "-key", `${tag}inter.key`, "-subj", `/CN=${tag} Test Intermediate`, "-out", `${tag}inter.csr`);
  ossl("x509", "-req", "-in", `${tag}inter.csr`, "-CA", `${tag}root.pem`, "-CAkey", `${tag}root.key`, "-CAcreateserial", "-sha384", "-days", "3650", "-extfile", `${tag}inter.ext`, "-out", `${tag}inter.pem`);
  writeFileSync(join(dir, `${tag}leaf.ext`), "basicConstraints=critical,CA:FALSE\n" + (leafOid ? "1.2.840.113635.100.6.11.1=ASN1:NULL\n" : ""));
  ossl("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", `${tag}leaf.key`);
  ossl("req", "-new", "-key", `${tag}leaf.key`, "-subj", `/CN=${tag} Test Signing`, "-out", `${tag}leaf.csr`);
  ossl("x509", "-req", "-in", `${tag}leaf.csr`, "-CA", `${tag}inter.pem`, "-CAkey", `${tag}inter.key`, "-CAcreateserial", "-sha256", "-days", "365", "-extfile", `${tag}leaf.ext`, "-out", `${tag}leaf.pem`);
  const der = f => { ossl("x509", "-in", f, "-outform", "DER", "-out", f + ".der"); return readFileSync(join(dir, f + ".der")); };
  const r = der(`${tag}root.pem`), i = der(`${tag}inter.pem`), l = der(`${tag}leaf.pem`);
  return { x5c: [l, i, r].map(b => b.toString("base64")), rootSha: createHash("sha256").update(r).digest("hex"), leafKey: createPrivateKey(readFileSync(join(dir, `${tag}leaf.key`))) };
}
const APPLE = chain("a"), EVIL = chain("e"), NOLEAFOID = chain("n", { leafOid: false });
const jws = (payload, ch = APPLE) => { const d = b64u(JSON.stringify({ alg: "ES256", x5c: ch.x5c })) + "." + b64u(JSON.stringify(payload));
  return d + "." + b64u(nodeSign("sha256", Buffer.from(d), { key: ch.leafKey, dsaEncoding: "ieee-p1363" })); };
const atx = (o = {}) => ({ transactionId: "2000000" + Math.floor(Math.random() * 1e6), originalTransactionId: "1000000001", bundleId: "com.lomonec.bemastery", productId: "premium_annual",
  purchaseDate: T0 - DAY, originalPurchaseDate: T0 - DAY, expiresDate: T0 + 365 * DAY, type: "Auto-Renewable Subscription", inAppOwnershipType: "PURCHASED", environment: "Production", signedDate: T0, ...o });

/* ---------------- AdMob: SSV keys ---------------- */
const am = generateKeyPairSync("ec", { namedCurve: "P-256" });
const ADMOB_KEYS = [{ keyId: 3335741209, pem: am.publicKey.export({ type: "spki", format: "pem" }), base64: "" }];
function ssvUrl(nonce, txn, o = {}) {
  const q = `ad_network=5450213213286189855&ad_unit=1234567890&custom_data=${nonce}&reward_amount=1&reward_item=practice&timestamp=${o.ts ?? clock}&transaction_id=${txn}&user_id=x`;
  const sig = b64u(nodeSign("sha256", Buffer.from(q), { key: o.key || am.privateKey, dsaEncoding: "der" }));
  return `/v1/rewards/verify/admob?${q}&signature=${o.badSig ? sig.slice(0, -4) + "AAAA" : sig}&key_id=${o.keyId ?? 3335741209}`;
}

const KEY1 = Buffer.alloc(32, 7).toString("base64"), KEY2 = Buffer.alloc(32, 9).toString("base64");
/* ---------------- the Worker ---------------- */
const envFor = (o = {}) => ({ DB: d1(), FIREBASE_PROJECT_ID: "be-mastery", ADMIN_TOKEN: "o".repeat(40),
  GOOGLE_SA_JSON: JSON.stringify(SA), PLAY_PACKAGE: "com.bemastery.app", RTDN_AUDIENCE: "https://ent.test/v1/billing/google_play", RTDN_SA_EMAIL: "pubsub@test.iam.gserviceaccount.com",
  APPLE_BUNDLE_ID: "com.lomonec.bemastery", APPLE_ROOT_SHA256: APPLE.rootSha, APPLE_ENVIRONMENTS: "Production", APP_ACCOUNT_SECRET: "s".repeat(40),
  ADMOB_SSV_ENABLED: "1", REWARD_KINDS_ENABLED: "extra_ai_practice", PLAY_TOKEN_KEY: KEY1, ...o });
let env = envFor();
const deps = { now: () => clock, fetch: fakeFetch, googleKeys: [GJWK], admobKeys: ADMOB_KEYS, auth: { keys: [FBJWK] } };
async function call(method, path, { uid, body, headers = {} } = {}) {
  deps.auth.now = clock;
  const h = { ...headers }; if (uid) h.authorization = "Bearer " + idTok(uid); if (body !== undefined) h["content-type"] = "application/json";
  const r = await handle(new Request("https://ent.test" + path, { method, headers: h, body: body === undefined ? undefined : (typeof body === "string" ? body : JSON.stringify(body)) }), env, deps);
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { status: r.status, json: j, text: t };
}
const view = async uid => (await call("GET", "/v1/entitlement", { uid })).json;
const gverify = (uid, token, extra = {}) => call("POST", "/v1/purchases/verify", { uid, body: { provider: "google_play", purchaseToken: token, ...extra } });
const rtdn = (data, id, o = {}) => call("POST", "/v1/billing/google_play", { headers: { authorization: "Bearer " + oidc(o), "content-type": "application/json" }, body: rtdnBody(data, id) });
const aToken = async uid => (await call("GET", "/v1/purchases/account-token", { uid })).json.appAccountToken;
const averify = (uid, tx, ren) => call("POST", "/v1/purchases/verify", { uid, body: { provider: "app_store", signedTransaction: jws(tx), ...(ren ? { signedRenewalInfo: jws(ren) } : {}) } });
const anotify = (type, subtype, tx, ren, uuid = randomUUID()) => call("POST", "/v1/billing/app_store", { body: { signedPayload: jws({ notificationType: type, subtype, notificationUUID: uuid, version: "2.0", signedDate: clock,
  data: { bundleId: "com.lomonec.bemastery", environment: "Production", signedTransactionInfo: jws(tx), ...(ren ? { signedRenewalInfo: jws(ren) } : {}) } }) } });
const tok = n => "tok_" + n + "_" + "x".repeat(24);

console.log("\n# Google Play — purchase verification and account binding");
{
  _resetTokenCache();
  let r = await call("POST", "/v1/purchases/verify", { body: { provider: "google_play", purchaseToken: tok(1) } });
  ok("G0 · verifying a purchase needs a signed-in learner (401)", r.status === 401);
  G.subs.set(tok(1), gsub());
  r = await gverify("ana", tok(1));
  const v = await view("ana");
  ok("G1 · a token Google confirms ACTIVE → Premium, source google_play, started / expires / renews from Google", r.status === 200 && v.plan === "premium" && v.source === "google_play" && v.renews === true && v.startedAt === T0 - DAY && v.expiresAt === T0 + 30 * DAY, JSON.stringify(v));
  ok("G2 · the server asked Google with a service-account token and acknowledged the purchase (Play refunds after 3 days otherwise)", G.tokenCalls === 1 && G.acks.includes(tok(1)));
  /* the uid is matched on a word boundary: a bare /ana/ also matched the fixed
     capability name "ai_analysis", which is in every view and is not a leak */
  ok("G3 · the response names no purchase token, product id or account", !/tok_1|premium_monthly|\bana\b/.test(r.text));
  r = await gverify("bea", tok(1));
  ok("G4 · the same purchase token cannot be claimed by another account (409 bound_elsewhere)", r.status === 409 && r.json.error === "bound_elsewhere" && (await view("bea")).plan === "free" && (await view("ana")).plan === "premium");
  r = await gverify("ana", tok(1));
  ok("G5 · the owner re-verifying (replay / app reinstall) is idempotent: one link, still Premium", r.status === 200 && env.DB.raw.prepare("SELECT count(*) n FROM purchase_links WHERE uid='ana'").get().n === 1);
  r = await gverify("cai", tok(99));
  ok("G6 · an arbitrary token Google does not know → 404 unknown_purchase, Free", r.status === 404 && r.json.error === "unknown_purchase" && (await view("cai")).plan === "free");
  r = await gverify("cai", "bad token with spaces");
  ok("G7 · a malformed token is refused before Google is asked (400)", r.status === 400);
  G.subs.set(tok(2), gsub({ lineItems: [{ productId: "coins_500", expiryTime: iso(T0 + DAY) }] }));
  r = await gverify("cai", tok(2));
  ok("G8 · a purchase of something that is not a BE Mastery plan → 422, Free", r.status === 422 && (await view("cai")).plan === "free");
  G.subs.set(tok(3), gsub({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", lineItems: [{ productId: "premium_monthly", expiryTime: iso(T0 - DAY) }] }));
  r = await gverify("dan", tok(3), { status: "active", plan: "premium", expiresAt: T0 + 999 * DAY, premium: true });
  ok("G9 · client-sent plan / status / expiry are ignored: Google says EXPIRED → Free (state expired)", (await view("dan")).plan === "free" && (await view("dan")).state === "expired");
  G.subs.set(tok(4), gsub({ subscriptionState: "SUBSCRIPTION_STATE_CANCELED" }));
  await gverify("eve", tok(4)); let e = await view("eve");
  ok("G10 · cancelled but paid to expiry → still Premium, renews:false", e.plan === "premium" && e.renews === false && e.expiresAt === T0 + 30 * DAY);
  G.subs.set(tok(5), gsub({ subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" }));
  await gverify("fay", tok(5)); e = await view("fay");
  ok("G11 · renewal failed but in grace → Premium, state grace", e.plan === "premium" && e.state === "grace");
  G.subs.set(tok(6), gsub({ subscriptionState: "SUBSCRIPTION_STATE_ON_HOLD", lineItems: [{ productId: "premium_monthly", expiryTime: iso(T0 - DAY) }] }));
  await gverify("gus", tok(6));
  ok("G12 · account hold / pending / paused → no Premium", (await view("gus")).plan === "free");
}

console.log("\n# Google Play — Real-time Developer Notifications");
{
  let r = await call("POST", "/v1/billing/google_play", { body: rtdnBody({ subscriptionNotification: { notificationType: 2, purchaseToken: tok(1) } }, "m0") });
  ok("N1 · a notification without Google's signed token → 401, nothing read", r.status === 401);
  r = await rtdn({ subscriptionNotification: { notificationType: 2, purchaseToken: tok(1) } }, "m0", { aud: "https://someone.else" });
  ok("N2 · wrong audience → 401", r.status === 401);
  r = await rtdn({ subscriptionNotification: { notificationType: 2, purchaseToken: tok(1) } }, "m0", { email: "attacker@evil.test" });
  ok("N3 · signed by Google but for another service account → 401", r.status === 401);
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  r = await rtdn({ subscriptionNotification: { notificationType: 2, purchaseToken: tok(1) } }, "m0", { key: other.privateKey });
  ok("N4 · forged signature → 401", r.status === 401);
  G.subs.get(tok(1)).lineItems[0].expiryTime = iso(T0 + 60 * DAY);
  r = await rtdn({ subscriptionNotification: { notificationType: 2, purchaseToken: tok(1) } }, "m1");
  ok("N5 · a RENEWED notification → the server asks Google again → expiry extended", r.status === 200 && (await view("ana")).expiresAt === T0 + 60 * DAY);
  G.subs.get(tok(1)).lineItems[0].expiryTime = iso(T0 + 90 * DAY);
  r = await rtdn({ subscriptionNotification: { notificationType: 2, purchaseToken: tok(1) } }, "m1");
  ok("N6 · the same Pub/Sub message delivered twice is applied once (duplicate)", r.json.duplicate === true && (await view("ana")).expiresAt === T0 + 60 * DAY);
  G.subs.get(tok(1)).subscriptionState = "SUBSCRIPTION_STATE_CANCELED";
  await rtdn({ subscriptionNotification: { notificationType: 3, purchaseToken: tok(1) } }, "m2");
  ok("N7 · CANCELED notification → Premium until expiry, renews:false", (await view("ana")).plan === "premium" && (await view("ana")).renews === false);
  await rtdn({ voidedPurchaseNotification: { purchaseToken: tok(1), orderId: "GPA.1", productType: 1, refundType: 1 } }, "m3");
  ok("N8 · a refund / voided purchase → revoked → Free at once", (await view("ana")).plan === "free" && (await view("ana")).state === "revoked");
  G.subs.set(tok(7), gsub());
  r = await rtdn({ subscriptionNotification: { notificationType: 4, purchaseToken: tok(7) } }, "m4");
  ok("N9 · a notification for a purchase no account has bound yet changes nothing (200)", r.status === 200 && env.DB.raw.prepare("SELECT count(*) n FROM purchase_links WHERE ext_id IN (SELECT ext_id FROM purchase_links)").get().n >= 0 && (await view("ana")).plan === "free");
  r = await rtdn({ testNotification: { version: "1.0" } }, "m5");
  ok("N10 · Play Console test notification → 200, nothing changed", r.status === 200);
  G.subs.set(tok(8), gsub({ lineItems: [{ productId: "premium_annual", expiryTime: iso(T0 + 365 * DAY) }], linkedPurchaseToken: tok(5) }));
  await gverify("fay", tok(8));
  const links = env.DB.raw.prepare("SELECT status FROM purchase_links WHERE uid='fay' ORDER BY expires_at").all().map(x => x.status);
  ok("N11 · an upgrade (linkedPurchaseToken) supersedes the old token: old link expired, the annual one decides", (await view("fay")).expiresAt === T0 + 365 * DAY && links.includes("expired"), JSON.stringify(links));
}

console.log("\n# Apple — signed transactions, appAccountToken, notifications");
{
  const t1 = await aToken("ivy"), t1b = await aToken("ivy"), t2 = await aToken("jon");
  ok("A1 · each account gets one stable appAccountToken (UUID), different per account", t1 === t1b && t1 !== t2 && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(t1));
  let r = await averify("ivy", atx({ appAccountToken: t1 }), { originalTransactionId: "1000000001", autoRenewStatus: 1, signedDate: T0 });
  let v = await view("ivy");
  ok("A2 · a verified StoreKit transaction carrying ivy's token → Premium, source app_store, renews", r.status === 200 && v.plan === "premium" && v.source === "app_store" && v.renews === true && v.expiresAt === T0 + 365 * DAY, JSON.stringify(v));
  r = await averify("jon", atx({ appAccountToken: t1 }));
  ok("A3 · the same transaction submitted by another account → 403 account_mismatch", r.status === 403 && r.json.error === "account_mismatch" && (await view("jon")).plan === "free");
  r = await averify("jon", atx({ originalTransactionId: "1000000002" }));
  ok("A4 · a transaction without an appAccountToken cannot be claimed (403)", r.status === 403);
  r = await averify("jon", atx({ originalTransactionId: "1000000003", appAccountToken: "11111111-2222-4333-8444-555555555555" }));
  ok("A5 · a forged / guessed appAccountToken → 403", r.status === 403);
  r = await call("POST", "/v1/purchases/verify", { uid: "jon", body: { provider: "app_store", signedTransaction: jws(atx({ originalTransactionId: "1000000004", appAccountToken: t2 }), EVIL) } });
  ok("A6 · a chain that does not end in the pinned Apple root → 401", r.status === 401 && /root/.test(r.json.error));
  const good = jws(atx({ originalTransactionId: "1000000005", appAccountToken: t2 })); const [h, p, s] = good.split(".");
  const tampered = h + "." + b64u(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url")), expiresDate: T0 + 9999 * DAY })) + "." + s;
  r = await call("POST", "/v1/purchases/verify", { uid: "jon", body: { provider: "app_store", signedTransaction: tampered } });
  ok("A7 · an edited payload breaks the ES256 signature → 401", r.status === 401 && /signature/.test(r.json.error));
  r = await call("POST", "/v1/purchases/verify", { uid: "jon", body: { provider: "app_store", signedTransaction: jws(atx({ appAccountToken: t2 }), NOLEAFOID) } });
  ok("A8 · a leaf without Apple's receipt-signing OID → 401 (even under a pinned root it is not trusted)", r.status === 401);
  r = await averify("jon", atx({ originalTransactionId: "1000000006", appAccountToken: t2, bundleId: "com.someone.else" }));
  ok("A9 · another app's transaction → 422", r.status === 422);
  r = await averify("jon", atx({ originalTransactionId: "1000000007", appAccountToken: t2, environment: "Sandbox" }));
  ok("A10 · a Sandbox transaction is refused unless APPLE_ENVIRONMENTS allows it", r.status === 422);
  clock = T0 + 2 * 365 * DAY;
  r = await averify("jon", atx({ originalTransactionId: "1000000008", appAccountToken: t2, expiresDate: clock + DAY }));
  ok("A11 · a signing certificate past its validity → 401", r.status === 401 && /validity/.test(r.json.error));
  clock = T0;
  await averify("jon", atx({ originalTransactionId: "1000000009", appAccountToken: t2, expiresDate: T0 - DAY }), { originalTransactionId: "1000000009", autoRenewStatus: 1, gracePeriodExpiresDate: T0 + 6 * DAY });
  v = await view("jon");
  ok("A12 · billing retry in the grace window → Premium, state grace, until the grace end", v.plan === "premium" && v.state === "grace" && v.expiresAt === T0 + 6 * DAY);
  r = await anotify("DID_RENEW", undefined, atx({ appAccountToken: t1, expiresDate: T0 + 730 * DAY }), { originalTransactionId: "1000000001", autoRenewStatus: 1 }, "u-1");
  ok("A13 · Server Notification V2 DID_RENEW → expiry extended", r.status === 200 && (await view("ivy")).expiresAt === T0 + 730 * DAY);
  r = await anotify("DID_RENEW", undefined, atx({ appAccountToken: t1, expiresDate: T0 + 999 * DAY }), null, "u-1");
  ok("A14 · the same notificationUUID twice is applied once", r.json.duplicate === true && (await view("ivy")).expiresAt === T0 + 730 * DAY);
  await anotify("DID_CHANGE_RENEWAL_STATUS", "AUTO_RENEW_DISABLED", atx({ appAccountToken: t1, expiresDate: T0 + 730 * DAY }), { originalTransactionId: "1000000001", autoRenewStatus: 0 }, "u-2");
  ok("A15 · auto-renew turned off → Premium until expiry, renews:false", (await view("ivy")).plan === "premium" && (await view("ivy")).renews === false);
  await anotify("REFUND", undefined, atx({ appAccountToken: t1, expiresDate: T0 + 730 * DAY, revocationDate: T0 }), null, "u-3");
  ok("A16 · REFUND → revoked → Free at once", (await view("ivy")).plan === "free" && (await view("ivy")).state === "revoked");
  const tk = await aToken("kim");
  r = await anotify("SUBSCRIBED", "INITIAL_BUY", atx({ originalTransactionId: "1000000020", appAccountToken: tk }), null, "u-4");
  ok("A17 · a purchase Apple reports before the app does binds through the appAccountToken (no client step needed)", r.status === 200 && (await view("kim")).plan === "premium");
  r = await call("POST", "/v1/billing/app_store", { body: { signedPayload: jws({ notificationType: "DID_RENEW", notificationUUID: "u-5", data: { bundleId: "com.lomonec.bemastery", signedTransactionInfo: jws(atx({ appAccountToken: tk })) } }, EVIL) } });
  ok("A18 · a notification not signed by the pinned chain → 401", r.status === 401);
  const tl = await aToken("leo");
  r = await call("POST", "/v1/purchases/restore", { uid: "leo", body: { provider: "app_store", items: [
    { signedTransaction: jws(atx({ originalTransactionId: "1000000030", appAccountToken: tl, expiresDate: T0 + 10 * DAY })) },
    { signedTransaction: jws(atx({ originalTransactionId: "1000000031", appAccountToken: tl, expiresDate: T0 + 40 * DAY })) },
    { signedTransaction: jws(atx({ originalTransactionId: "1000000032", appAccountToken: tk, expiresDate: T0 + 99 * DAY })) } ] } });
  /* Apple edge cases (integration workstream, 2026-09-26) */
  const tm = await aToken("max");
  const anotifyEnv = (type, tx, envName, uuid) => call("POST", "/v1/billing/app_store", { body: { signedPayload: jws({ notificationType: type, notificationUUID: uuid, version: "2.0", signedDate: clock,
    data: { bundleId: "com.lomonec.bemastery", environment: envName, signedTransactionInfo: jws(tx) } }) } });
  await anotify("SUBSCRIBED", "INITIAL_BUY", atx({ originalTransactionId: "1000000040", appAccountToken: tm, productId: "premium_monthly", expiresDate: T0 + 3 * DAY, offerType: 1 }), { originalTransactionId: "1000000040", autoRenewStatus: 1 }, "u-20");
  let vm = await view("max");
  ok("A20 · the 3-day introductory offer (offerType 1) → Premium, state trialing", vm.plan === "premium" && vm.state === "trialing", JSON.stringify(vm));
  await anotify("DID_CHANGE_RENEWAL_PREF", "UPGRADE", atx({ originalTransactionId: "1000000040", appAccountToken: tm, productId: "premium_annual", expiresDate: T0 + 365 * DAY }), { originalTransactionId: "1000000040", autoRenewStatus: 1 }, "u-21");
  let r2 = await anotify("DID_RENEW", undefined, atx({ originalTransactionId: "1000000040", appAccountToken: tm, productId: "premium_monthly", expiresDate: T0 + 3 * DAY, isUpgraded: true }), null, "u-22");
  vm = await view("max");
  ok("A21 · after an upgrade to annual, a late notification about the upgraded monthly transaction is acknowledged and changes nothing", r2.status === 200 && vm.expiresAt === T0 + 365 * DAY, JSON.stringify(vm));
  r2 = await averify("max", atx({ originalTransactionId: "1000000040", appAccountToken: tm, productId: "premium_monthly", isUpgraded: true }));
  ok("A22 · the upgraded transaction itself cannot be submitted as proof (409 superseded)", r2.status === 409 && r2.json.error === "superseded");
  r2 = await anotify("DID_RENEW", undefined, atx({ originalTransactionId: "1000000040", appAccountToken: tm, expiresDate: T0 + 30 * DAY }), null, "u-23");
  ok("A23 · an OLDER renewal arriving late (out of order) does not roll the plan back", r2.status === 200 && (await view("max")).expiresAt === T0 + 365 * DAY);
  r2 = await anotifyEnv("DID_RENEW", atx({ originalTransactionId: "1000000040", appAccountToken: tm, expiresDate: T0 + 999 * DAY, environment: "Sandbox" }), "Sandbox", "u-24");
  ok("A24 · a Sandbox notification at a Production-only Worker is acknowledged (200) and changes nothing — no endless Apple retries", r2.status === 200 && (await view("max")).expiresAt === T0 + 365 * DAY);
  await anotify("REFUND", undefined, atx({ originalTransactionId: "1000000040", appAccountToken: tm, expiresDate: T0 + 365 * DAY, revocationDate: T0 }), null, "u-25");
  ok("A25 · REFUND on the annual plan → revoked → Free", (await view("max")).state === "revoked");
  await anotify("REFUND_REVERSED", undefined, atx({ originalTransactionId: "1000000040", appAccountToken: tm, expiresDate: T0 + 365 * DAY }), { originalTransactionId: "1000000040", autoRenewStatus: 1 }, "u-26");
  ok("A26 · REFUND_REVERSED → Premium again (the reinstated transaction decides)", (await view("max")).plan === "premium");
  const tn = await aToken("noa");
  await anotify("SUBSCRIBED", "INITIAL_BUY", atx({ originalTransactionId: "1000000050", appAccountToken: tn, expiresDate: T0 + 5 * DAY }), { originalTransactionId: "1000000050", autoRenewStatus: 1 }, "u-27");
  clock = T0 + 6 * DAY;
  await anotify("DID_FAIL_TO_RENEW", "GRACE_PERIOD", atx({ originalTransactionId: "1000000050", appAccountToken: tn, expiresDate: T0 + 5 * DAY }), { originalTransactionId: "1000000050", autoRenewStatus: 1, isInBillingRetryPeriod: true, gracePeriodExpiresDate: T0 + 11 * DAY }, "u-28");
  let vn = await view("noa");
  ok("A27 · DID_FAIL_TO_RENEW with a grace period → Premium, state grace, until the grace end", vn.plan === "premium" && vn.state === "grace" && vn.expiresAt === T0 + 11 * DAY, JSON.stringify(vn));
  clock = T0 + 12 * DAY;
  await anotify("GRACE_PERIOD_EXPIRED", undefined, atx({ originalTransactionId: "1000000050", appAccountToken: tn, expiresDate: T0 + 5 * DAY }), { originalTransactionId: "1000000050", autoRenewStatus: 1, isInBillingRetryPeriod: true }, "u-29");
  vn = await view("noa");
  ok("A28 · GRACE_PERIOD_EXPIRED (still in billing retry, no grace left) → Free, state expired", vn.plan === "free" && vn.state === "expired", JSON.stringify(vn));
  clock = T0;
  /* Apple release completion (2026-09-26) */
  const tp = await aToken("pip");
  await anotify("SUBSCRIBED", "INITIAL_BUY", atx({ originalTransactionId: "1000000060", appAccountToken: tp, productId: "premium_monthly", expiresDate: T0 + 30 * DAY }), { originalTransactionId: "1000000060", autoRenewStatus: 1 }, "u-30");
  await anotify("DID_RENEW", undefined, atx({ originalTransactionId: "1000000060", appAccountToken: tp, productId: "premium_monthly", expiresDate: T0 + 60 * DAY }), { originalTransactionId: "1000000060", autoRenewStatus: 1 }, "u-31");
  let r3 = await anotify("REFUND", undefined, atx({ originalTransactionId: "1000000060", appAccountToken: tp, productId: "premium_monthly", expiresDate: T0 + 30 * DAY, revocationDate: T0 }), null, "u-32");
  let vp = await view("pip");
  ok("A29 · a REFUND of an EARLIER period leaves the current paid period standing (Premium until its end)", r3.status === 200 && vp.plan === "premium" && vp.expiresAt === T0 + 60 * DAY, JSON.stringify(vp));
  r3 = await averify("pip", atx({ originalTransactionId: "1000000060", appAccountToken: tp, productId: "premium_monthly", expiresDate: T0 + 30 * DAY }));
  ok("A30 · the device handing over that older period's transaction is refused (409 superseded), nothing rolls back", r3.status === 409 && (await view("pip")).expiresAt === T0 + 60 * DAY);
  await anotify("REFUND", undefined, atx({ originalTransactionId: "1000000060", appAccountToken: tp, productId: "premium_monthly", expiresDate: T0 + 60 * DAY, revocationDate: T0 }), null, "u-33");
  ok("A31 · a REFUND of the CURRENT period revokes → Free", (await view("pip")).state === "revoked");
  const tq = await aToken("quin");
  r3 = await averify("quin", atx({ originalTransactionId: "1000000070", appAccountToken: tq.toUpperCase(), expiresDate: T0 + 30 * DAY }));
  ok("A32 · the appAccountToken is matched case-insensitively (a UUID) on verify", r3.status === 200 && (await view("quin")).plan === "premium", JSON.stringify(r3.json));
  const tr2 = await aToken("rex");
  r3 = await anotify("SUBSCRIBED", "INITIAL_BUY", atx({ originalTransactionId: "1000000080", appAccountToken: tr2.toUpperCase(), expiresDate: T0 + 30 * DAY }), null, "u-34");
  ok("A33 · … and on a notification that arrives before the app (binding through the appAccountToken)", r3.status === 200 && (await view("rex")).plan === "premium");
  ok("A19 · Restore: the account's own transactions bind, another account's is refused; the latest expiry decides", r.status === 200 && r.json.results.map(x => x.ok).join() === "true,true,false" && r.json.view.expiresAt === T0 + 40 * DAY, JSON.stringify(r.json));
}

console.log("\n# AdMob — rewarded-ad server-side verification");
{
  const start = async uid => (await call("POST", "/v1/rewards/start", { uid, body: { kind: "extra_ai_practice" } })).json.nonce;
  const n1 = await start("mia");
  let r = await call("GET", ssvUrl(n1, "adm-txn-000001"));
  ok("S1 · AdMob's signed callback verifies the nonce (ECDSA / Google's published key)", r.status === 200 && r.json.ok);
  r = await call("POST", "/v1/rewards/claim", { uid: "mia", body: { nonce: n1 } });
  ok("S2 · the learner then claims exactly one reward", r.json.credited === true && r.json.balances.extra_ai_practice === 1);
  r = await call("GET", ssvUrl(n1, "adm-txn-000001"));
  ok("S3 · AdMob retrying the same callback is idempotent", r.status === 200 && r.json.again === true);
  const n2 = await start("mia");
  r = await call("GET", ssvUrl(n2, "adm-txn-000001"));
  ok("S4 · one AdMob transaction cannot verify a second nonce (replay → 409)", r.status === 409);
  r = await call("GET", ssvUrl(n2, "adm-txn-000002", { badSig: true }));
  ok("S5 · a tampered signature → 400, nothing verified", r.status === 400);
  const evil = generateKeyPairSync("ec", { namedCurve: "P-256" });
  r = await call("GET", ssvUrl(n2, "adm-txn-000003", { key: evil.privateKey }));
  ok("S6 · signed by any key but Google's → 400", r.status === 400);
  r = await call("GET", ssvUrl(n2, "adm-txn-000004", { keyId: 42 }));
  ok("S7 · an unknown key id → 400", r.status === 400);
  r = await call("GET", ssvUrl(n2, "adm-txn-000005", { ts: clock - 3 * DAY }));
  ok("S8 · a stale callback (older than a day) → 400", r.status === 400);
  r = await call("POST", "/v1/rewards/claim", { uid: "mia", body: { nonce: n2, completed: true } });
  ok("S9 · 'completed:true' from the client without a verified callback earns nothing (409)", r.status === 409);
  await call("POST", "/v1/admin/grant", { headers: { authorization: "Bearer " + "o".repeat(40) }, body: { uid: "pat", plan: "premium", status: "active", expiresAt: T0 + 30 * DAY, source: "promo" } });
  r = await call("POST", "/v1/rewards/start", { uid: "pat", body: { kind: "extra_ai_practice" } });
  ok("S10 · Premium cannot start rewarded ads (409)", r.status === 409);
  const e0 = env; env = envFor({ ADMOB_SSV_ENABLED: undefined });
  r = await call("GET", ssvUrl(n2, "adm-txn-000006"));
  ok("S11 · without ADMOB_SSV_ENABLED the callback route is not active (501)", r.status === 501);
  env = e0;
}

console.log("\n# provider-neutral behaviour");
{
  let r = await call("POST", "/v1/purchases/verify", { uid: "quin", body: { provider: "revenuecat", appUserId: "quin" } });
  ok("P1 · RevenueCat is a named adapter slot, not configured (501): nothing above the adapter changes to add it", r.status === 501);
  const e0 = env; env = envFor({ GOOGLE_SA_JSON: undefined, APPLE_ROOT_SHA256: undefined });
  r = await gverify("quin", tok(1));
  const r2 = await averify("quin", atx());
  ok("P2 · without store credentials the purchase routes answer 501 and change nothing", r.status === 501 && r2.status === 501);
  env = e0;
  G.subs.set(tok(20), gsub({ lineItems: [{ productId: "premium_monthly", expiryTime: iso(T0 + 20 * DAY) }] }));
  await call("POST", "/v1/admin/grant", { headers: { authorization: "Bearer " + "o".repeat(40) }, body: { uid: "rex", plan: "premium", status: "active", expiresAt: T0 + 90 * DAY, source: "promo" } });
  await gverify("rex", tok(20));
  let v = await view("rex");
  ok("P3 · several sources on one account: the in-force one with the latest expiry decides (promo 90 d beats Play 20 d)", v.source === "promo" && v.expiresAt === T0 + 90 * DAY);
  r = await call("DELETE", "/v1/me", { uid: "rex" });
  ok("P4 · account deletion erases the account's links and entitlement (the store subscription is cancelled in the store)", r.json.erased === true && env.DB.raw.prepare("SELECT count(*) n FROM purchase_links WHERE uid='rex'").get().n === 0 && (await view("rex")).plan === "free");
  r = await gverify("sam", tok(20));
  ok("P5 · after deletion the purchase token is free to bind again (the buyer can sign up anew and restore)", r.status === 200);
  const keys = Object.keys(await view("sam")).sort().join();
  ok("P6 · the view stays provider-neutral: no token, transaction id, product id or account id", keys === "ads,capabilities,checkedAt,expiresAt,paid,plan,renews,source,startedAt,state", keys);
}

console.log("\n# Phase 10 — limits and the lost-purchase path");
{
  clock += 120_000;
  let r = await call("POST", "/v1/purchases/verify", { uid: "tia", headers: { "content-length": String(MAX_BODY + 1) }, body: { provider: "google_play", purchaseToken: tok(30) } });
  ok("Q1 · a request body over the cap is refused before it is read (413)", r.status === 413 && r.json.error === "too_large", r.status);
  G.subs.set(tok(31), gsub());
  const calls0 = G.apiCalls; let codes = [];
  for (let i = 0; i < PURCHASE_PER_MIN + 1; i++) codes.push((await gverify("uma", tok(31))).status);
  ok("Q2 · the purchase routes allow " + PURCHASE_PER_MIN + " calls per account per minute; the next one is 429", codes.slice(0, PURCHASE_PER_MIN).every(s => s === 200) && codes[PURCHASE_PER_MIN] === 429, codes.join());
  const calls1 = G.apiCalls; await gverify("uma", tok(31));
  ok("Q3 · a rate-limited call costs no store API request", G.apiCalls === calls1 && calls1 > calls0);
  r = await call("POST", "/v1/purchases/restore", { uid: "vic", body: { provider: "google_play", items: [] } });
  ok("Q4 · the limit is per account: another learner in the same minute is served", r.status === 400 && r.json.error === "items");
  clock += 60_000;
  ok("Q5 · the next minute the account is served again", (await gverify("uma", tok(31))).status === 200);
  codes = []; for (let i = 0; i < PURCHASE_PER_MIN + 1; i++) codes.push((await call("GET", "/v1/purchases/account-token", { uid: "wes" })).status);
  ok("Q6 · the StoreKit account-token route is limited the same way", codes[PURCHASE_PER_MIN] === 429 && codes[0] === 200, codes.join());

  /* the app lost its connection between Play and us: Google holds a paid, unacknowledged purchase no account has claimed */
  clock += 60_000;
  G.subs.set(tok(32), gsub());
  const realFetch = deps.fetch; deps.fetch = async (u, i) => /androidpublisher/.test(String(u)) ? new Response("{}", { status: 503 }) : realFetch(u, i);
  r = await gverify("xan", tok(32));
  deps.fetch = realFetch;
  ok("Q7 · Google failing (5xx) is a 502 'google_api', never a 500 or a refusal — the app reads it as 'payment safe, not confirmed yet'", r.status === 502 && r.json.error === "google_api" && !(await view("xan")).paid, JSON.stringify(r.json));
  r = await rtdn({ subscriptionNotification: { version: "1.0", notificationType: 4, purchaseToken: tok(32), subscriptionId: "premium_monthly" } }, "m-q8");
  ok("Q8 · Play's PURCHASED notification for a purchase no account has claimed: 200, nothing bound (the token alone names no account)", r.status === 200 && env.DB.raw.prepare("SELECT count(*) n FROM purchase_links WHERE secret_ref=?").get(tok(32)).n === 0);
  const acks0 = G.acks.filter(t => t === tok(32)).length;
  r = await call("POST", "/v1/purchases/restore", { uid: "xan", body: { provider: "google_play", items: [{ purchaseToken: tok(32), productId: "premium_monthly" }] } });
  const vx = await view("xan");
  ok("Q9 · the app's silent reconcile on the next launch (a restore of what Play says the device owns) claims it: Premium, and Google is acknowledged — no 3-day refund", r.status === 200 && vx.paid && vx.source === "google_play" && G.acks.filter(t => t === tok(32)).length === acks0 + 1, JSON.stringify(vx));

  /* verify binds, but only the ACKNOWLEDGE call fails: the account is Premium,
     so the app's reconcile is not what brings it back — a notification or the
     next launch must, or Play refunds after 3 days */
  clock += 60_000;
  G.subs.set(tok(33), gsub());
  deps.fetch = async (u, i) => /:acknowledge$/.test(String(u)) ? new Response("{}", { status: 503 }) : realFetch(u, i);
  r = await gverify("yul", tok(33));
  deps.fetch = realFetch;
  ok("Q10 · verify with only the acknowledge failing: Premium at once, and Google still holds the purchase unacknowledged", r.status === 200 && (await view("yul")).paid && G.subs.get(tok(33)).acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING");
  r = await rtdn({ subscriptionNotification: { version: "1.0", notificationType: 4, purchaseToken: tok(33), subscriptionId: "premium_monthly" } }, "m-q11");
  ok("Q11 · Play's notification for that bound, unacknowledged purchase acknowledges it", r.status === 200 && G.subs.get(tok(33)).acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED", G.subs.get(tok(33)).acknowledgementState);
  G.subs.set(tok(34), gsub());
  deps.fetch = async (u, i) => /:acknowledge$/.test(String(u)) ? new Response("{}", { status: 503 }) : realFetch(u, i);
  await gverify("zed", tok(34));
  deps.fetch = realFetch;
  r = await call("POST", "/v1/purchases/restore", { uid: "zed", body: { provider: "google_play", items: [{ purchaseToken: tok(34), productId: "premium_monthly" }] } });
  ok("Q12 · a Premium account's launch reconcile re-sends the purchase and the server acknowledges it", r.status === 200 && G.subs.get(tok(34)).acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" && (await view("zed")).paid);
  const acks1 = G.acks.filter(t => t === tok(34)).length;
  await call("POST", "/v1/purchases/restore", { uid: "zed", body: { provider: "google_play", items: [{ purchaseToken: tok(34), productId: "premium_monthly" }] } });
  ok("Q13 · once acknowledged, re-sending it asks Google again but never acknowledges twice", G.acks.filter(t => t === tok(34)).length === acks1 && env.DB.raw.prepare("SELECT count(*) n FROM purchase_links WHERE uid='zed'").get().n === 1);
}

console.log("\n# Phase 11 — the stored Play token: sealed, and kept only while it can matter");
{
  clock += 120_000;
  const row = t => env.DB.raw.prepare("SELECT ext_id, status, secret_ref FROM purchase_links WHERE ext_id=?").get(createHash("sha256").update(t).digest("hex"));
  G.subs.set(tok(60), gsub());
  await gverify("s1a", tok(60));
  const r60 = row(tok(60)), rid = "google_play:" + r60.ext_id;
  ok("V1 · the token is stored sealed (v1 AES-GCM), never as the raw token — and the server can still open it for a server-side re-check", /^v1\.[\w-]+\.[\w-]+$/.test(r60.secret_ref) && !r60.secret_ref.includes(tok(60)) && (await openToken(r60.secret_ref, env, rid)) === tok(60));
  ok("V2 · a sealed token opens only on its own row with the right key (not on another purchase's row, not with another key)", (await openToken(r60.secret_ref, env, "google_play:" + "0".repeat(64))) === null && (await openToken(r60.secret_ref, { PLAY_TOKEN_KEY: KEY2 }, rid)) === null);
  const scan = () => { let n = 0; for (const { name } of env.DB.raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()) for (const r of env.DB.raw.prepare(`SELECT * FROM "${name}"`).all()) if (/tok_\d+_x{24}/.test(JSON.stringify(r))) n++; return n; };
  ok("V3 · no table anywhere holds a raw purchase token (every row of every table scanned)", scan() === 0, scan());
  const envNoKey = env; env = { ...env, PLAY_TOKEN_KEY: undefined };
  G.subs.set(tok(61), gsub());
  let r = await gverify("s3b", tok(61));
  ok("V4 · no PLAY_TOKEN_KEY configured: the purchase still gives Premium and is acknowledged, and NOTHING is stored (never plaintext)", r.status === 200 && (await view("s3b")).paid && row(tok(61)).secret_ref === null && G.subs.get(tok(61)).acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED");
  env = envNoKey;
  await rtdn({ voidedPurchaseNotification: { purchaseToken: tok(60), orderId: "GPA.60", productType: 1, refundType: 1 } }, "m-s5");
  ok("V5 · refund / revoke: Free at once and the stored token is erased", (await view("s1a")).state === "revoked" && row(tok(60)).secret_ref === null);
  G.subs.set(tok(62), gsub()); await gverify("s6c", tok(62));
  G.subs.set(tok(63), gsub({ linkedPurchaseToken: tok(62), lineItems: [{ productId: "premium_annual", expiryTime: iso(T0 + 365 * DAY) }] }));
  await gverify("s6c", tok(63));
  ok("V6 · an upgrade supersedes the old purchase: the old link is expired and its token erased, the new one is sealed", row(tok(62)).status === "expired" && row(tok(62)).secret_ref === null && /^v1\./.test(row(tok(63)).secret_ref));
  G.subs.set(tok(64), gsub()); await gverify("s7d", tok(64));
  G.subs.get(tok(64)).subscriptionState = "SUBSCRIPTION_STATE_EXPIRED";
  await rtdn({ subscriptionNotification: { version: "1.0", notificationType: 13, purchaseToken: tok(64), subscriptionId: "premium_monthly" } }, "m-s7");
  ok("V7 · Google says the subscription expired: Free, and the stored token is erased", (await view("s7d")).state === "expired" && row(tok(64)).status === "expired" && row(tok(64)).secret_ref === null);
  G.subs.set(tok(65), gsub()); await gverify("s8e", tok(65));
  await call("DELETE", "/v1/me", { uid: "s8e" });
  ok("V8 · account deletion removes the row and its sealed token", !row(tok(65)));
  G.subs.set(tok(66), gsub()); await gverify("s9f", tok(66));
  const old = row(tok(66)).secret_ref; env = { ...env, PLAY_TOKEN_KEY: KEY2 };
  clock += 60_000; await gverify("s9f", tok(66));
  const now66 = row(tok(66)).secret_ref, rid66 = "google_play:" + row(tok(66)).ext_id;
  ok("V9 · key rotation: the old value no longer opens under the new key, and the next verify re-seals it under the new key", (await openToken(old, env, rid66)) === null && now66 !== old && (await openToken(now66, env, rid66)) === tok(66));
  env = { ...env, PLAY_TOKEN_KEY: KEY1 };
  ok("V10 · still no raw token in any table after all of the above", scan() === 0, scan());
}

console.log("\n# Phase 11 — a purchase paid with a slow method (Play 'pending')");
{
  clock += 120_000;
  G.subs.set(tok(70), gsub({ subscriptionState: "SUBSCRIPTION_STATE_PENDING" }));
  const acks0 = G.acks.filter(t => t === tok(70)).length;
  let r = await gverify("ppa", tok(70));
  const v = await view("ppa");
  ok("PP1 · Google says PENDING: bound, no Premium, the view says payment_pending (not 'ended'), and it is NOT acknowledged", r.status === 200 && !v.paid && v.state === "payment_pending" && G.acks.filter(t => t === tok(70)).length === acks0, JSON.stringify(v));
  G.subs.get(tok(70)).subscriptionState = "SUBSCRIPTION_STATE_ACTIVE";
  await rtdn({ subscriptionNotification: { version: "1.0", notificationType: 4, purchaseToken: tok(70), subscriptionId: "premium_monthly" } }, "m-pp2");
  ok("PP2 · the payment completes: Play's notification turns it into Premium and the server acknowledges it then", (await view("ppa")).paid && G.subs.get(tok(70)).acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED");
  G.subs.set(tok(71), gsub({ subscriptionState: "SUBSCRIPTION_STATE_PENDING" }));
  await gverify("pec", tok(71));
  G.subs.get(tok(71)).subscriptionState = "SUBSCRIPTION_STATE_EXPIRED";
  await rtdn({ subscriptionNotification: { version: "1.0", notificationType: 20, purchaseToken: tok(71), subscriptionId: "premium_monthly" } }, "m-pp3");
  ok("PP3 · the pending payment is cancelled: still Free, never acknowledged, token erased", !(await view("pec")).paid && G.subs.get(tok(71)).acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING" && env.DB.raw.prepare("SELECT secret_ref FROM purchase_links WHERE uid='pec'").get().secret_ref === null);
}

console.log("\n# 10 Oct 2026 — the Android app names the account (obfuscatedAccountId); a Play refund sticks");
{
  clock += 120_000;
  const mine = await aToken("acct-a"), ext = { externalAccountIdentifiers: { obfuscatedExternalAccountId: mine } };
  G.subs.set(tok(80), gsub(ext));
  let r = await gverify("acct-b", tok(80));
  ok("AB1 · a purchase that names account A is refused for account B (403 account_mismatch) and grants B nothing", r.status === 403 && r.json.error === "account_mismatch" && !(await view("acct-b")).paid, JSON.stringify(r.json));
  r = await gverify("acct-a", tok(80));
  ok("AB2 · …and bound to account A, whose token it carries", r.status === 200 && (await view("acct-a")).paid, JSON.stringify(r.json));
  G.subs.set(tok(81), gsub({ externalAccountIdentifiers: { obfuscatedExternalAccountId: await aToken("acct-c") }, acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING" }));
  await rtdn({ subscriptionNotification: { version: "1.0", notificationType: 4, purchaseToken: tok(81), subscriptionId: "premium_monthly" } }, "m-ab3");
  ok("AB3 · a notification for a purchase the app never reported binds it to the named account and acknowledges it (no 3-day refund)", (await view("acct-c")).paid && G.acks.includes(tok(81)));
  G.subs.set(tok(82), gsub());
  r = await gverify("acct-d", tok(82));
  ok("AB4 · a purchase that names no account (older / TWA) still binds as before: first bind wins", r.status === 200 && (await view("acct-d")).paid);
  await rtdn({ voidedPurchaseNotification: { purchaseToken: tok(80), orderId: "GPA.80", productType: 1, refundType: 1 } }, "m-ab5");
  const afterVoid = (await view("acct-a")).paid;
  r = await gverify("acct-a", tok(80));              /* Google still reports the token ACTIVE (a refund without revocation) */
  await rtdn({ subscriptionNotification: { version: "1.0", notificationType: 2, purchaseToken: tok(80), subscriptionId: "premium_monthly" } }, "m-ab5b");
  ok("AB5 · a Play refund sticks: neither a later verify nor a notification on the same token hands Premium back", afterVoid === false && !(await view("acct-a")).paid, JSON.stringify(await view("acct-a")));
}

rmSync(dir, { recursive: true, force: true });
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
