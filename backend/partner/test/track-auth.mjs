/* be-partner — the General English boundary, enforced on the SERVER from the
   ACCOUNT (26 Sep 2026).   Run: node backend/partner/test/track-auth.mjs

   The PRODUCTION path runs here in-process — no DEV_AUTH, no x-dev headers:
     identity   a real RS256 Firebase ID token, verified by the Worker's own
                verifyIdToken against a generated key served as Google's JWKS;
     programme  the learner's own Firestore document users/{uid}, read by the
                Worker WITH THAT TOKEN from a fake Firestore that applies the
                project's published rule (request.auth.uid == uid) — read from
                Firebase on 26 Sep 2026:
                  match /users/{uid} { allow read, write: if request.auth != null && request.auth.uid == uid; }
     storage    the Worker's real migrations in SQLite.
   What this cannot prove: Firestore's REST answer shape on the day. That needs
   the staging Worker against the real project (see the report). */
import { DatabaseSync } from "node:sqlite"; import { readFileSync, readdirSync } from "node:fs";
import { generateKeyPairSync, createSign } from "node:crypto";
import worker from "../partner-worker.js";
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };
const b64u = x => Buffer.from(x).toString("base64url");
const PROJECT = "be-mastery";

/* ---- Google's token keys (fake, real crypto) */
const kp = generateKeyPairSync("rsa", { modulusLength: 2048 });
const JWK = { ...kp.publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
const idToken = (uid, o = {}) => { const s = Math.floor(Date.now() / 1000);
  const d = b64u(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" })) + "." + b64u(JSON.stringify({ iss: "https://securetoken.google.com/" + PROJECT, aud: PROJECT, sub: uid, iat: s - 10, exp: s + 3600, ...o }));
  const g = createSign("RSA-SHA256"); g.update(d); return d + "." + b64u(g.sign(o.key || kp.privateKey)); };

/* ---- Firestore: users/{uid}.json is the app's synced state; the published rule applies */
const DOCS = new Map();                 // uid → state object (or undefined = no document)
const FS = { down: false, reads: 0 };
const setTrack = (uid, activeId) => DOCS.set(uid, { profile: { name: uid }, ...(activeId === undefined ? {} : { professionalTracks: { activeId } }) });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith("https://www.googleapis.com/service_accounts/v1/jwk/securetoken")) return new Response(JSON.stringify({ keys: [JWK] }));
  const m = /^https:\/\/firestore\.googleapis\.com\/v1\/projects\/be-mastery\/databases\/\(default\)\/documents\/users\/([^?]+)\?mask\.fieldPaths=json$/.exec(u);
  if (m) {
    FS.reads++;
    if (FS.down) return new Response("{}", { status: 503 });
    const auth = (init.headers && (init.headers.authorization || init.headers.Authorization)) || "";
    const tok = /^Bearer (.+)$/.exec(auth); if (!tok) return new Response("{}", { status: 403 });
    const sub = JSON.parse(Buffer.from(tok[1].split(".")[1], "base64url").toString()).sub;
    const uid = decodeURIComponent(m[1]);
    if (sub !== uid) return new Response(JSON.stringify({ error: { status: "PERMISSION_DENIED" } }), { status: 403 });   // request.auth.uid == uid
    if (!DOCS.has(uid)) return new Response(JSON.stringify({ error: { status: "NOT_FOUND" } }), { status: 404 });
    return new Response(JSON.stringify({ name: "users/" + uid, fields: { json: { stringValue: JSON.stringify(DOCS.get(uid)) } } }));
  }
  return new Response("{}", { status: 599 });
};

/* ---- the Worker's own schema */
const db = new DatabaseSync(":memory:");
const dir = new URL("../migrations/", import.meta.url);
for (const f of readdirSync(dir).filter(x => x.endsWith(".sql")).sort()) db.exec(readFileSync(new URL(f, dir), "utf8"));
const D1 = { prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; }, batch: async list => { const out = []; for (const x of list) out.push(await x.run()); return out; } };
const AUDIO = { put: async () => {}, get: async () => null, delete: async () => {}, list: async () => ({ objects: [], truncated: false }) };
const env = { DB: D1, AUDIO, PARTNER_ENABLED: "1", FIREBASE_PROJECT_ID: PROJECT, ALLOWED_ORIGINS: "https://app.lomonec.com", TRACK_CACHE_MS: "0" };
let ipn = 0;
const call = async (method, path, { uid, token, body } = {}) => {
  const h = { "cf-connecting-ip": "10.0." + Math.floor(ipn / 250) + "." + (ipn++ % 250) };
  if (uid) h.authorization = "Bearer " + idToken(uid); if (token) h.authorization = "Bearer " + token;
  if (body !== undefined) h["content-type"] = "application/json";
  const r = await worker.fetch(new Request("https://partner.test" + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {} });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j };
};
const consent = (uid, extra = {}) => call("POST", "/consent", { uid, body: { adult: true, name: "Ann", lang: "en", ...extra } });

console.log("\n# 1–2 · the account's programme decides");
{
  setTrack("ge1", "general-english");
  let r = await consent("ge1", { track: "general-english" });
  ok("1a · a General English account can join Practice Partner (POST /consent → 200)", r.status === 200, JSON.stringify(r));
  r = await call("GET", "/me", { uid: "ge1" });
  ok("1b · … and read its partner state (GET /me → 200)", r.status === 200 && r.json && r.json.consented === true, JSON.stringify(r).slice(0, 200));
  setTrack("wd1", "welding");
  r = await consent("wd1");
  ok("2a · a Welding account is refused at /consent (403 track) — before anything is stored", r.status === 403 && r.json.error === "track" && !db.prepare("SELECT 1 FROM members WHERE uid=?").get("wd1"), JSON.stringify(r));
  r = await call("GET", "/me", { uid: "wd1" });
  ok("2b · … and at GET /me (403 track)", r.status === 403 && r.json.error === "track", JSON.stringify(r));
  for (const [m, p, b] of [["POST", "/queue", { mode: "voice" }], ["POST", "/match", {}], ["POST", "/ai/session", { id: "x".repeat(16) }], ["POST", "/live", {}], ["GET", "/me/history", undefined], ["POST", "/prefs", { mode: "voice" }]]) {
    const x = await call(m, p, { uid: "wd1", body: b });
    ok(`2c · Welding → ${m} ${p} refused server-side (403 track)`, x.status === 403 && x.json.error === "track", JSON.stringify(x));
  }
}

console.log("\n# 3 · unauthenticated");
{
  let r = await call("GET", "/me");
  ok("3a · no token → 401", r.status === 401 && r.json.error === "auth");
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  r = await call("GET", "/me", { token: idToken("ge1", { key: other.privateKey }) });
  ok("3b · a token not signed by Google's key → 401", r.status === 401);
  r = await call("GET", "/me", { token: idToken("ge1", { aud: "someone-else" }) });
  ok("3c · a token for another Firebase project → 401", r.status === 401);
}

console.log("\n# 4–5 · a client-supplied track is never the authority");
{
  let r = await consent("wd1", { track: "general-english" });
  ok("4a · Welding account sending track=general-english in the body → still 403 track", r.status === 403 && r.json.error === "track", JSON.stringify(r));
  r = await call("GET", "/me?track=general-english", { uid: "wd1" });
  ok("4b · … or in the query string → still 403 track", r.status === 403 && r.json.error === "track", JSON.stringify(r));
  const x = await call("POST", "/queue", { uid: "wd1", body: { track: "general-english", mode: "voice" } });
  ok("4c · … or on an action route → still 403 track", x.status === 403 && x.json.error === "track", JSON.stringify(x));
  /* a Welding learner cannot borrow a General English learner's document: the token names the account */
  r = await call("GET", "/me", { token: idToken("wd1") });
  ok("4d · the programme is read for the TOKEN's account only (the Firestore rule refuses any other uid)", r.status === 403, JSON.stringify(r));
  r = await consent("ge1", { track: "welding" });
  const row = db.prepare("SELECT track FROM members WHERE uid=?").get("ge1");
  ok("5a · a General English account sending track=welding is refused (403) and its stored track is unchanged", r.status === 403 && row && row.track === "general-english", JSON.stringify({ r, row }));
  r = await call("GET", "/me", { uid: "ge1" });
  ok("5b · … and it is still authorised by its ACCOUNT's programme (GET /me → 200)", r.status === 200, JSON.stringify(r).slice(0, 160));
}

console.log("\n# edge cases — fail closed, switching, erasure");
{
  let r = await call("GET", "/me", { uid: "nodoc" });
  ok("E1 · signed in but no account document yet → 403 track_unverified (fail closed)", r.status === 403 && r.json.error === "track_unverified", JSON.stringify(r));
  FS.down = true; r = await call("GET", "/me", { uid: "ge1" }); FS.down = false;
  ok("E2 · Firestore unreachable → 403 track_unverified, never a guess", r.status === 403 && r.json.error === "track_unverified", JSON.stringify(r));
  setTrack("legacy", undefined);
  r = await consent("legacy");
  ok("E3 · an account that never chose a programme is General English (the app's own default) → allowed", r.status === 200, JSON.stringify(r));
  setTrack("ge1", "welding");
  r = await call("GET", "/me", { uid: "ge1" });
  ok("E4 · the learner switches the ACCOUNT to Welding → refused on the next call", r.status === 403 && r.json.error === "track", JSON.stringify(r));
  setTrack("ge1", "general-english");
  r = await call("GET", "/me", { uid: "ge1" });
  ok("E5 · … and switching back to General English is seen at once (a non-GE answer is never cached)", r.status === 200, JSON.stringify(r).slice(0, 120));
  /* a learner who joined on General English and has since moved the account to Welding */
  setTrack("sw1", "general-english"); await consent("sw1"); setTrack("sw1", "welding");
  r = await call("GET", "/me", { uid: "sw1" });
  ok("E6a · a member who moved to Welding loses partner access (403 track)", r.status === 403 && r.json.error === "track", JSON.stringify(r));
  r = await call("DELETE", "/history", { uid: "sw1" });
  ok("E6b · … but can still erase their own partner history (data rights)", r.status === 200, JSON.stringify(r));
  r = await call("DELETE", "/me", { uid: "sw1" });
  ok("E7 · … and their partner data on account deletion (DELETE /me)", r.status === 200 && !db.prepare("SELECT 1 FROM members WHERE uid=?").get("sw1"), JSON.stringify(r));
  r = await call("GET", "/presence");
  ok("E8 · /presence stays a public pair of counts (no identity, nothing per learner)", r.status === 200 && typeof r.json.online === "number" && Object.keys(r.json).sort().join() === "online,waiting", JSON.stringify(r));
  const reads = FS.reads;
  const env2 = { ...env, TRACK_CACHE_MS: "60000" };
  const r1 = await worker.fetch(new Request("https://partner.test/me", { headers: { authorization: "Bearer " + idToken("ge1"), "cf-connecting-ip": "10.9.9.1" } }), env2, { waitUntil() {} });
  const r2 = await worker.fetch(new Request("https://partner.test/me", { headers: { authorization: "Bearer " + idToken("ge1"), "cf-connecting-ip": "10.9.9.2" } }), env2, { waitUntil() {} });
  ok("E9 · with the cache on, a General English answer spares Firestore on the next poll", r1.status === 200 && r2.status === 200 && FS.reads - reads <= 1, `reads ${FS.reads - reads}`);
}

console.log("\n# the local-development switch cannot reach production");
{
  const raw = (e, h) => worker.fetch(new Request("https://partner.test/me", { headers: { "cf-connecting-ip": "10.8.0." + (ipn++ % 250), ...h } }), e, { waitUntil() {} });
  setTrack("wd2", "welding"); let r = await raw(env, { authorization: "Bearer " + idToken("wd2"), "x-dev-user": "ann", "x-dev-track": "general-english" });
  ok("P1 · production (no DEV_AUTH): x-dev-user / x-dev-track are ignored — a Welding token stays 403", r.status === 403 && (await r.json()).error === "track");
  r = await raw(env, { "x-dev-user": "ann" });
  ok("P2 · production: a dev identity header alone is unauthenticated (401)", r.status === 401);
  const dev = { ...env, DEV_AUTH: "1" };
  r = await raw(dev, { "x-dev-user": "wdev", "x-dev-track": "welding" });
  ok("P3 · local development (DEV_AUTH=1) can simulate a Welding account: 403 track", r.status === 403 && (await r.json()).error === "track");
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
