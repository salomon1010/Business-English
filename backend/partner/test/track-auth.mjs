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
const DOCS = new Map();                 // uid → { st: state object, ver: updateTime }
const FS = { down: false, full: 0, small: 0, clock: 0 };
const setTrack = (uid, activeId) => DOCS.set(uid, { st: { profile: { name: uid }, savedAt: Date.now(), ...(activeId === undefined ? {} : { professionalTracks: { activeId } }) }, ver: new Date(Date.UTC(2026, 8, 26) + ++FS.clock).toISOString() });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith("https://www.googleapis.com/service_accounts/v1/jwk/securetoken")) return new Response(JSON.stringify({ keys: [JWK] }));
  const m = /^https:\/\/firestore\.googleapis\.com\/v1\/projects\/be-mastery\/databases\/\(default\)\/documents\/users\/([^?]+)\?mask\.fieldPaths=(json|savedAt)$/.exec(u);
  if (m) {
    if (m[2] === "json") FS.full++; else FS.small++;
    if (FS.down) return new Response("{}", { status: 503 });
    const auth = (init.headers && (init.headers.authorization || init.headers.Authorization)) || "";
    const tok = /^Bearer (.+)$/.exec(auth); if (!tok) return new Response("{}", { status: 403 });
    const sub = JSON.parse(Buffer.from(tok[1].split(".")[1], "base64url").toString()).sub;
    const uid = decodeURIComponent(m[1]);
    if (sub !== uid) return new Response(JSON.stringify({ error: { status: "PERMISSION_DENIED" } }), { status: 403 });   // request.auth.uid == uid
    if (!DOCS.has(uid)) return new Response(JSON.stringify({ error: { status: "NOT_FOUND" } }), { status: 404 });
    const d = DOCS.get(uid);
    /* Firestore's Document: name, fields (only the masked ones), createTime, updateTime */
    const fields = m[2] === "json" ? (d.nojson ? {} : { json: { stringValue: d.raw != null ? d.raw : JSON.stringify(d.st) } }) : { savedAt: { integerValue: String(d.st.savedAt) } };   // raw / nojson: malformed-document cases (M1–M2)
    return new Response(JSON.stringify({ name: "projects/be-mastery/databases/(default)/documents/users/" + uid, fields, createTime: "2026-09-01T00:00:00Z", updateTime: d.ver }));
  }
  return new Response("{}", { status: 599 });
};

/* ---- the Worker's own schema */
const db = new DatabaseSync(":memory:");
const dir = new URL("../migrations/", import.meta.url);
for (const f of readdirSync(dir).filter(x => x.endsWith(".sql")).sort()) db.exec(readFileSync(new URL(f, dir), "utf8"));
const D1 = { prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; }, batch: async list => { const out = []; for (const x of list) out.push(await x.run()); return out; } };
const AUDIO = { put: async () => {}, get: async () => null, delete: async () => {}, list: async () => ({ objects: [], truncated: false }) };
const env = { DB: D1, AUDIO, PARTNER_ENABLED: "1", FIREBASE_PROJECT_ID: PROJECT, ALLOWED_ORIGINS: "https://app.lomonec.com", PUSH_SECRET: "test-secret-0123456789abcdef" };
let ipn = 0;
const call = async (method, path, { uid, token, body, headers } = {}) => {
  const h = { "cf-connecting-ip": "10.0." + Math.floor(ipn / 250) + "." + (ipn++ % 250), ...(headers || {}) };
  if (uid) h.authorization = "Bearer " + idToken(uid); if (token) h.authorization = "Bearer " + token;
  if (body !== undefined) h["content-type"] = "application/json";
  const r = await worker.fetch(new Request("https://partner.test" + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {} });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j, cache: r.headers.get("cache-control") };
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
  ok("E5 · … and switching back to General English is seen at once", r.status === 200, JSON.stringify(r).slice(0, 120));
  /* a learner who joined on General English and has since moved the account to Welding */
  setTrack("sw1", "general-english"); await consent("sw1"); setTrack("sw1", "welding");
  r = await call("GET", "/me", { uid: "sw1" });
  ok("E6a · a member who moved to Welding loses partner access (403 track)", r.status === 403 && r.json.error === "track", JSON.stringify(r));
  r = await call("DELETE", "/history", { uid: "sw1" });
  ok("E6b · … but can still erase their own partner history (data rights)", r.status === 200, JSON.stringify(r));
  r = await call("DELETE", "/me", { uid: "sw1" });
  ok("E7 · … and their partner data on account deletion (DELETE /me)", r.status === 200 && !db.prepare("SELECT 1 FROM members WHERE uid=?").get("sw1"), JSON.stringify(r));
}

console.log("\n# partner availability (/presence) is General English only, on the server");
{
  setTrack("ge2", "general-english"); setTrack("wd3", "welding");
  let r = await call("GET", "/presence");
  ok("A1 · no token → 401, no counts in the body", r.status === 401 && !("online" in (r.json || {})), JSON.stringify(r));
  r = await call("GET", "/presence", { uid: "wd3" });
  ok("A2 · a signed-in Welding account → 403 track, no counts in the body", r.status === 403 && r.json.error === "track" && !("online" in r.json), JSON.stringify(r));
  r = await call("GET", "/presence?track=general-english", { uid: "wd3", headers: { "x-track": "general-english" } });
  ok("A3 · … even when it claims General English (query and header)", r.status === 403 && r.json.error === "track", JSON.stringify(r));
  r = await call("GET", "/presence", { uid: "ge2" });
  ok("A4 · a signed-in General English account → 200, two counts and nothing else", r.status === 200 && typeof r.json.online === "number" && Object.keys(r.json).sort().join() === "online,waiting", JSON.stringify(r));
  ok("A5 · the answer is private: no browser or edge may keep it (cache-control: private, no-store)", /private/.test(r.cache || "") && /no-store/.test(r.cache || ""), r.cache);
  r = await call("GET", "/presence", { uid: "nodoc2" });
  ok("A6 · signed in, programme unverifiable → 403 track_unverified, no counts", r.status === 403 && r.json.error === "track_unverified" && !("online" in r.json), JSON.stringify(r));
  r = await call("GET", "/presence", { headers: { "x-push-secret": env.PUSH_SECRET } });
  ok("A7 · the push Worker, with the secret the two Workers share → 200 (online alerts keep working)", r.status === 200 && typeof r.json.online === "number", JSON.stringify(r));
  r = await call("GET", "/presence", { headers: { "x-push-secret": "test-secret-0123456789abcdeX" } });
  ok("A8 · a wrong secret → 401", r.status === 401, JSON.stringify(r));
  const noSecret = { ...env }; delete noSecret.PUSH_SECRET;
  const x = await worker.fetch(new Request("https://partner.test/presence", { headers: { "x-push-secret": "", "cf-connecting-ip": "10.7.0.1" } }), noSecret, { waitUntil() {} });
  ok("A9 · a Worker with no secret configured never lets an empty secret through (401)", x.status === 401);
}

console.log("\n# the programme cache: scoped to the account AND its current version");
{
  setTrack("c1", "general-english");
  let r = await call("GET", "/presence", { uid: "c1" });
  const f0 = FS.full, s0 = FS.small;
  r = await call("GET", "/presence", { uid: "c1" });
  ok("C1 · a repeat request uses the cache: one small version read, no full read of the synced state", r.status === 200 && FS.full === f0 && FS.small === s0 + 1, JSON.stringify({ full: FS.full - f0, small: FS.small - s0 }));
  setTrack("c1", "welding");
  r = await call("GET", "/presence", { uid: "c1" });
  ok("C2 · the learner switches to Welding: the VERY NEXT request is refused (no time window; the new version forces a re-read)", r.status === 403 && r.json.error === "track", JSON.stringify(r));
  r = await call("GET", "/me", { uid: "c1" });
  ok("C3 · … on every route, not only /presence", r.status === 403 && r.json.error === "track", JSON.stringify(r));
  setTrack("c1", "general-english");
  r = await call("GET", "/presence", { uid: "c1" });
  ok("C4 · switching back is seen at once too", r.status === 200, JSON.stringify(r));
  FS.down = true; r = await call("GET", "/presence", { uid: "c1" }); FS.down = false;
  ok("C5 · a warm cache is never served without a fresh authorised read: Firestore down → 403 track_unverified", r.status === 403 && r.json.error === "track_unverified", JSON.stringify(r));
  await call("GET", "/presence", { uid: "c1" });
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  r = await call("GET", "/presence", { token: idToken("c1", { key: other.privateKey }) });
  ok("C6 · a forged token for a cached account gets 401 — the cache is behind authentication, never in front of it", r.status === 401, JSON.stringify(r));
  r = await call("GET", "/presence", { token: idToken("c1", { exp: Math.floor(Date.now() / 1000) - 60 }) });
  ok("C7 · an expired token for a cached account → 401", r.status === 401, JSON.stringify(r));
  setTrack("c2", "welding");
  r = await call("GET", "/presence", { uid: "c2" });
  ok("C8 · one account's cached General English answer never serves another account (Welding c2 → 403)", r.status === 403 && r.json.error === "track", JSON.stringify(r));
  DOCS.delete("c1");
  r = await call("GET", "/presence", { uid: "c1" });
  ok("C9 · the account document disappears → the cached answer is dropped (403 track_unverified)", r.status === 403 && r.json.error === "track_unverified", JSON.stringify(r));
}

console.log("\n# /programme — the account's programme, for be-push's nudge gate");
{
  setTrack("pg1", "general-english"); setTrack("pw1", "welding");
  let r = await call("GET", "/programme", { uid: "pg1" });
  ok("G1 · General English account → 200 {track: general-english}, private", r.status === 200 && r.json.track === "general-english" && /no-store/.test(r.cache || ""), JSON.stringify(r));
  r = await call("GET", "/programme?track=general-english", { uid: "pw1" });
  ok("G2 · Welding account → 200 {track: welding}, whatever the query says", r.status === 200 && r.json.track === "welding", JSON.stringify(r));
  r = await call("GET", "/programme");
  ok("G3 · no token → 401", r.status === 401);
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  r = await call("GET", "/programme", { token: idToken("pg1", { key: other.privateKey }) });
  ok("G4 · forged token → 401", r.status === 401);
  r = await call("GET", "/programme", { uid: "nodoc-pg" });
  ok("G5 · no account document → 403 track_unverified", r.status === 403 && r.json.error === "track_unverified");
  const off = await worker.fetch(new Request("https://partner.test/programme", { headers: { authorization: "Bearer " + idToken("pg1"), "cf-connecting-ip": "10.6.0.1" } }), { ...env, PARTNER_ENABLED: "0" }, { waitUntil() {} });
  ok("G6 · answers even with Practice Partner switched off (nudges do not depend on it)", off.status === 200);
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

console.log("\n# malformed account documents (29 Sep 2026)");
{
  const ver = () => new Date(Date.UTC(2026, 8, 29) + ++FS.clock).toISOString();
  DOCS.set("bad-json", { st: { savedAt: 1 }, raw: "{not json", ver: ver() });
  let r = await call("GET", "/me", { uid: "bad-json" });
  ok("M1 · the synced state is not valid JSON → 403 track_unverified (fail closed)", r.status === 403 && r.json.error === "track_unverified", JSON.stringify(r));
  DOCS.set("no-json", { st: { savedAt: 1 }, nojson: true, ver: ver() });
  r = await call("GET", "/me", { uid: "no-json" });
  ok("M2 · the document has no json field → 403 track_unverified (fail closed)", r.status === 403 && r.json.error === "track_unverified", JSON.stringify(r));
  setTrack("odd-track", "medical");
  r = await consent("odd-track");
  ok("M3 · an unknown programme id is General English, the app's own areaId() default (intentional; the account owner chooses the programme anyway)", r.status === 200, JSON.stringify(r));
  DOCS.set("num-track", { st: { savedAt: 1, professionalTracks: { activeId: 7 } }, ver: ver() });
  r = await consent("num-track");
  ok("M4 · a non-string programme id is treated the same way (General English)", r.status === 200, JSON.stringify(r));
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
