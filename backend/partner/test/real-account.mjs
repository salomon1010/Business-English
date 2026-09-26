/* be-partner — the General English boundary against REAL Google and a REAL
   Firebase account. Nothing is deployed: the Worker runs locally in the dev
   environment with DEV_AUTH switched OFF, so it takes the production path —
   Google's real signing keys, the real Firestore document of the account.

   1. cd backend/partner
      npx wrangler d1 migrations apply be-partner --local --env dev --persist-to /tmp/pp-real
      npx wrangler dev --env dev --port 8899 --persist-to /tmp/pp-real --var DEV_AUTH:0
   2. Two test accounts, signed in to the app (app.lomonec.com or staging):
      one on General English, one on Welding (Profile → programme). In each,
      after the programme is chosen, the browser console:
        copy(await FBUser.getIdToken(true))
      An ID token is valid for one hour. Do not paste it anywhere else.
   3. GE_ID_TOKEN=… WD_ID_TOKEN=… node test/real-account.mjs
      (PARTNER_API=… for another Worker; the default is the local one above.)

   Without tokens only the checks that need no account run (no token, and a
   forged token checked against Google's live key list). Tokens are never
   printed; an account is shown by a short hash of its uid only.
   The Welding account's consent attempt is refused before anything is
   stored, and the General English account only reads — nothing to clean up. */
import { createHash, generateKeyPairSync, createSign } from "node:crypto";
const BASE = process.env.PARTNER_API || "http://127.0.0.1:8899";
const GE = process.env.GE_ID_TOKEN || "", WD = process.env.WD_ID_TOKEN || "";
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 200)}`); };
const b64u = x => Buffer.from(x).toString("base64url");
const claims = t => { try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()); } catch (e) { return {}; } };
const who = t => createHash("sha256").update(String(claims(t).sub || "")).digest("hex").slice(0, 8);
const call = async (method, path, token, body) => {
  const h = {}; if (token) h.authorization = "Bearer " + token; if (body) h["content-type"] = "application/json";
  const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, error: j && j.error, counts: !!(j && "online" in j) };
};

const hz = await (await fetch(BASE + "/health")).json().catch(() => ({}));
ok("the Worker under test runs the PRODUCTION auth path (DEV_AUTH off)", hz.ok && hz.dev === false, JSON.stringify(hz));
if (!(hz.ok && hz.dev === false)) { console.log("\n  stop: this Worker accepts dev identities; start it with --var DEV_AUTH:0"); process.exit(1); }

console.log("\n# no account needed: Google's real key service");
{
  let r = await call("GET", "/presence");
  ok("no token → /presence 401, no counts", r.status === 401 && !r.counts, JSON.stringify(r));
  r = await call("GET", "/me");
  ok("no token → /me 401", r.status === 401, JSON.stringify(r));
  /* a well-formed token for this project, signed by a key Google never issued */
  const k = generateKeyPairSync("rsa", { modulusLength: 2048 }), s = Math.floor(Date.now() / 1000);
  const d = b64u(JSON.stringify({ alg: "RS256", kid: "not-a-google-key", typ: "JWT" })) + "." + b64u(JSON.stringify({ iss: "https://securetoken.google.com/be-mastery", aud: "be-mastery", sub: "forged-uid", iat: s - 5, exp: s + 3600, auth_time: s - 5 }));
  const g = createSign("RSA-SHA256"); g.update(d); const forged = d + "." + b64u(g.sign(k.privateKey));
  r = await call("GET", "/presence", forged);
  ok("a forged token (checked against Google's live key list) → 401, no counts", r.status === 401 && !r.counts, JSON.stringify(r));
}

if (!GE || !WD) {
  console.log("\n  GE_ID_TOKEN / WD_ID_TOKEN not set: the real-account cases did not run.");
} else {
  const ge = claims(GE), wd = claims(WD);
  console.log(`\n# real accounts: General English ${who(GE)}, Welding ${who(WD)}`);
  ok("two different accounts of this project, tokens not expired", ge.sub && wd.sub && ge.sub !== wd.sub && ge.aud === "be-mastery" && wd.aud === "be-mastery" && ge.exp * 1000 > Date.now() && wd.exp * 1000 > Date.now(), "check the tokens");
  let r = await call("GET", "/presence", GE);
  ok("R1 · General English account → /presence 200 with counts", r.status === 200 && r.counts, JSON.stringify(r));
  r = await call("GET", "/me", GE);
  ok("R2 · General English account → /me 200", r.status === 200, JSON.stringify(r));
  r = await call("GET", "/presence", WD);
  ok("R3 · Welding account → /presence 403 track, no counts", r.status === 403 && r.error === "track" && !r.counts, JSON.stringify(r));
  r = await call("GET", "/me", WD);
  ok("R4 · Welding account → /me 403 track", r.status === 403 && r.error === "track", JSON.stringify(r));
  r = await call("GET", "/presence?track=general-english", WD);
  ok("R5 · Welding account + ?track=general-english → still 403 track", r.status === 403 && r.error === "track" && !r.counts, JSON.stringify(r));
  r = await call("POST", "/consent", WD, { adult: true, name: "Test", lang: "en", track: "general-english" });
  ok("R6 · Welding account + body track=general-english → still 403 track", r.status === 403 && r.error === "track", JSON.stringify(r));
  r = await call("POST", "/queue", WD, { track: "general-english", mode: "voice" });
  ok("R7 · … on an action route too", r.status === 403 && r.error === "track", JSON.stringify(r));
}
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
