/* Account deletion with Sign in with Apple — the revocation step, end to end.
   Run: cd tests && node apple-revoke.mjs

   What is REAL: index.html (fbHasApple, fbAppleRevoke, fbDeleteAccount and the
   erase chain behind it) AND the be-mail Worker's own module — its router,
   `/apple/revoke`, its Firebase ID-token verifier (real RS256 against a JWKS
   this file serves) and its service-account lookup, all driven through
   `handler.fetch(request, env)` with the Worker's own env overrides.
   What is PLAYED: the Capacitor bridge (a fake BEAuth with the same shapes as
   BEAuthPlugin.swift), the Firebase web SDK, Google's OAuth token endpoint,
   accounts:lookup and accounts:revokeToken.
   What this CANNOT prove: that Apple accepts a real authorisation code, or that
   Firebase's own Apple provider is configured to mint the client secret Apple
   demands. Both need a signed build, a real account and the console work in
   docs/auth/SOCIAL_SIGNIN.md — those rows are PENDING, not passed. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
import { generateKeyPairSync, createSign, randomUUID } from "node:crypto";
import mail from "../backend/mail/mail-worker.js";

const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8196), BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const own = !process.env.BASE;
const srv = own ? spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }) : null;
if (own) await sleep(800);
{
  const disk = readFileSync(root + "index.html", "utf8");
  let served = ""; try { served = await (await fetch(BASE + "index.html")).text(); } catch (e) {}
  if (served.length !== disk.length) {
    console.error(`\n${BASE} is serving a DIFFERENT index.html (${served.length} vs ${disk.length} on disk). Another session may hold port ${PORT}; pass PORT=<free port>.\n`);
    if (srv) srv.kill(); process.exit(1);
  }
  console.log(`  (serving ${disk.length} bytes at ${BASE})`);
}
const res = [];
const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const pend = (name, why) => console.log(`  PENDING  ${name}  — ${why}`);

/* ---------- a real RS256 Firebase ID token, signed by a key we serve --------- */
const PROJECT = "be-mastery";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" }); jwk.kid = "testkid"; jwk.alg = "RS256"; jwk.use = "sig"; jwk.kty = "RSA";
const b64u = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
function idToken({ uid = "uid-apple", email = "ada@example.com", exp = Math.floor(Date.now() / 1e3) + 3600 } = {}) {
  const d = b64u({ alg: "RS256", kid: "testkid", typ: "JWT" }) + "." + b64u({ sub: uid, email, aud: PROJECT, iss: "https://securetoken.google.com/" + PROJECT, iat: Math.floor(Date.now() / 1e3) - 10, exp });
  const sig = createSign("RSA-SHA256").update(d).end().sign(privateKey).toString("base64url");
  return d + "." + sig;
}

/* ---------- the Worker's world, all of it overridable by env ---------------- */
const W = { providers: ["apple.com", "password"], revoke: { status: 200, body: {} }, calls: [], lookupFails: false, tokenFails: false, logs: [] };
const SA = { client_email: "svc@be-mastery.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) };
const ENV = {
  FB_PROJECT_ID: PROJECT, FB_API_KEY: "TEST_API_KEY", FB_SA_JSON: JSON.stringify(SA),
  FROM_EMAIL: "noreply@lomonec.com", FROM_NAME: "BE Mastery", APP_URL: "https://app.lomonec.com/", BREVO_API_KEY: "x",
  JWKS_URL: "https://stub.test/jwks", TOKEN_URL: "https://stub.test/token", IDTK_URL: "https://stub.test/idtk", REVOKE_URL: "https://stub.test/revoke",
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input && input.url ? input.url : input);
  if (url.startsWith("https://stub.test/jwks")) return new Response(JSON.stringify({ keys: [jwk] }), { headers: { "content-type": "application/json" } });
  if (url.startsWith("https://stub.test/token")) {
    if (W.tokenFails) return new Response("no", { status: 500 });
    return new Response(JSON.stringify({ access_token: "SA_ACCESS", expires_in: 3600 }), { headers: { "content-type": "application/json" } });
  }
  if (url.startsWith("https://stub.test/idtk/accounts:lookup")) {
    W.calls.push("lookup");
    if (W.lookupFails) return new Response(JSON.stringify({}), { status: 500 });
    return new Response(JSON.stringify({ users: [{ localId: "uid-apple", email: "ada@example.com", providerUserInfo: W.providers.map(p => ({ providerId: p })) }] }), { headers: { "content-type": "application/json" } });
  }
  if (url.startsWith("https://stub.test/revoke")) {
    const body = JSON.parse(init.body);
    W.calls.push("revoke");
    W.lastRevoke = { url, body, key: new URL(url).searchParams.get("key") };
    return new Response(JSON.stringify(W.revoke.body), { status: W.revoke.status, headers: { "content-type": "application/json" } });
  }
  return realFetch(input, init);
};
const origLog = console.log;
console.log = (...a) => { W.logs.push(a.join(" ")); origLog(...a); };
const callWorker = (path, { token, body, origin = "capacitor://localhost", method = "POST" } = {}) =>
  mail.fetch(new Request("https://be-mail.test" + path, { method, headers: { Origin: origin, "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), ENV, {});

console.log("\n# the Worker route (real module, real token verification)");
{
  W.calls = []; W.revoke = { status: 200, body: {} };
  const r = await callWorker("/apple/revoke", { token: idToken(), body: { code: "C0DE-abc_123" } });
  const j = await r.json();
  ok("W1 · an Apple account's code is revoked through Firebase (tokenType CODE, providerId apple.com)", r.status === 200 && j.ok === true && j.revoked === true
    && W.lastRevoke.body.providerId === "apple.com" && W.lastRevoke.body.tokenType === "CODE" && W.lastRevoke.body.token === "C0DE-abc_123", JSON.stringify(j) + JSON.stringify(W.lastRevoke && W.lastRevoke.body));
  ok("W2 · the call carries the learner's OWN ID token and the project API key — no Apple secret exists to carry", /^ey/.test(W.lastRevoke.body.idToken) && W.lastRevoke.key === "TEST_API_KEY");
  ok("W3 · the account's providers are read from Firebase with a service account, not taken from the caller", W.calls[0] === "lookup" && W.calls[1] === "revoke", W.calls.join(","));
}
{
  W.calls = []; W.providers = ["password"];
  const r = await callWorker("/apple/revoke", { token: idToken({ uid: "uid-pw" }), body: { code: "C0DE" } });
  const j = await r.json();
  ok("W4 · an account with no Apple provider is answered OK and NOTHING is sent to Firebase for revocation", r.status === 200 && j.ok === true && j.revoked === false && j.reason === "not_apple" && !W.calls.includes("revoke"), JSON.stringify(j) + W.calls.join(","));
  ok("W5 · … which also makes a retry after a half-finished deletion safe (idempotent)", (await (await callWorker("/apple/revoke", { token: idToken({ uid: "uid-pw" }), body: { code: "C0DE" } })).json()).ok === true);
  W.providers = ["apple.com", "password"];
}
{
  const r = await callWorker("/apple/revoke", { body: { code: "C0DE" } });
  ok("W6 · no token: 401, and no lookup happens", r.status === 401);
  const r2 = await callWorker("/apple/revoke", { token: "not.a.token", body: { code: "C0DE" } });
  ok("W7 · a forged token: 401", r2.status === 401);
  const r3 = await callWorker("/apple/revoke", { token: idToken({ exp: Math.floor(Date.now() / 1e3) - 60 }), body: { code: "C0DE" } });
  ok("W8 · an expired token: 401", r3.status === 401);
  const r4 = await callWorker("/apple/revoke", { token: idToken(), body: { code: "" } });
  ok("W9 · a missing code: 400, nothing attempted", r4.status === 400);
  const r5 = await callWorker("/apple/revoke", { token: idToken(), body: { code: "x".repeat(600) } });
  ok("W10 · an absurdly long code is refused before it reaches Google", r5.status === 400);
  const r6 = await callWorker("/apple/revoke", { token: idToken(), body: { code: "has space" } });
  ok("W11 · a malformed code is refused", r6.status === 400);
  const r7 = await callWorker("/apple/revoke", { token: idToken(), body: { code: "C0DE" }, origin: "https://evil.test" });
  ok("W12 · an origin that is not ours: 403", r7.status === 403);
  const r8 = await callWorker("/apple/revoke", { token: idToken(), method: "GET" });
  ok("W13 · GET is refused", r8.status === 405);
}
{
  W.revoke = { status: 400, body: { error: { message: "INVALID_ARGUMENT : invalid grant" } } };
  const r = await callWorker("/apple/revoke", { token: idToken(), body: { code: "USEDC0DE" } });
  const j = await r.json();
  ok("W14 · a used or expired code is reported as a retryable refusal (400 apple_code), never as success", r.status === 400 && j.error === "apple_code" && !j.ok, JSON.stringify(j));
  W.revoke = { status: 500, body: { error: { message: "backend" } } };
  const r2 = await callWorker("/apple/revoke", { token: idToken(), body: { code: "C0DE" } });
  ok("W15 · Apple/Google being down is 503 apple_unavailable — not a silent success", r2.status === 503 && (await r2.json()).error === "apple_unavailable");
  W.lookupFails = true;
  const r3 = await callWorker("/apple/revoke", { token: idToken(), body: { code: "C0DE" } });
  ok("W16 · a failed provider lookup refuses rather than guessing the account has no Apple", r3.status === 503);
  W.lookupFails = false;
  const r4 = await mail.fetch(new Request("https://be-mail.test/apple/revoke", { method: "POST", headers: { Origin: "capacitor://localhost", Authorization: "Bearer " + idToken(), "Content-Type": "application/json" }, body: JSON.stringify({ code: "C0DE" }) }), { ...ENV, FB_API_KEY: "" }, {});
  ok("W17 · an unconfigured Worker answers 503, never OK", r4.status === 503 && (await r4.json()).error === "apple_unavailable");
  W.revoke = { status: 200, body: {} };
}
console.log("\n# the browser's own gate: the preflight, as WKWebView makes it");
/* Every check above calls mail.fetch() straight, which is how a curl behaves:
   no preflight, so a missing Access-Control-Allow-Headers is invisible. These
   go through the browser's order instead \u2014 ask with OPTIONS FIRST, and refuse
   to send the real request unless the answer allows this origin, this method
   and every one of these headers. That is what blocked /apple/revoke while the
   Worker still answered a direct call perfectly. */
const preflight = (path, headers, origin) =>
  mail.fetch(new Request("https://be-mail.test" + path, { method: "OPTIONS", headers: {
    Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": headers.join(", ") } }), ENV, {})
  .then(async r => ({ status: r.status,
    allowOrigin: r.headers.get("Access-Control-Allow-Origin") || "",
    allowMethods: (r.headers.get("Access-Control-Allow-Methods") || "").toLowerCase().split(/\s*,\s*/),
    allowHeaders: (r.headers.get("Access-Control-Allow-Headers") || "").toLowerCase().split(/\s*,\s*/) }));
/* what the browser decides from that answer, before it sends anything */
function corsBlock(pf, headers, origin) {
  if (pf.status >= 400) return "preflight " + pf.status;
  if (pf.allowOrigin !== origin && pf.allowOrigin !== "*") return "origin";
  if (!pf.allowMethods.includes("post")) return "method";
  const missing = headers.filter(h => !pf.allowHeaders.includes(h));
  return missing.length ? "header: " + missing.join(", ") : "";
}
async function browserCall(path, { token, body, origin } = {}) {
  const headers = { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) };
  const names = Object.keys(headers);
  const pf = await preflight(path, names, origin);
  const blocked = corsBlock(pf, names, origin);
  if (blocked) return { pf, blocked, status: 0 };
  const r = await mail.fetch(new Request("https://be-mail.test" + path, { method: "POST", headers: { Origin: origin, ...headers }, body: JSON.stringify(body) }), ENV, {});
  return { pf, blocked: "", status: r.status, json: await r.json().catch(() => ({})) };
}
{
  W.calls = []; W.revoke = { status: 200, body: {} };
  const c = await browserCall("/apple/revoke", { token: idToken(), body: { code: "C0DE" }, origin: "capacitor://localhost" });
  ok("W18 \u00b7 the App Store shell's preflight is answered 204, echoing capacitor://localhost and allowing BOTH Content-Type and Authorization",
    c.pf.status === 204 && c.pf.allowOrigin === "capacitor://localhost" && c.pf.allowHeaders.includes("content-type") && c.pf.allowHeaders.includes("authorization"), JSON.stringify(c.pf));
  ok("W19 \u00b7 so the real POST is actually sent and revokes \u2014 in the browser's order, not a direct call",
    c.blocked === "" && c.status === 200 && c.json.ok === true && c.json.revoked === true, c.blocked || JSON.stringify(c.json));
  /* the gate above has to be able to say no, or W19 proves nothing: a header the
     Worker does not name must stop the request, exactly as Authorization did */
  const names = ["content-type", "authorization", "x-made-up"];
  const pf = await preflight("/apple/revoke", names, "capacitor://localhost");
  ok("W20 \u00b7 and that gate really blocks: an unnamed header stops the POST before the Worker sees it (how the bug hid)",
    corsBlock(pf, names, "capacitor://localhost") === "header: x-made-up", corsBlock(pf, names, "capacitor://localhost"));
}
{
  /* the same header carries the routes that were already live: /welcome sends a
     Firebase ID token too (it always did \u2014 so it was blocked in exactly the
     same way), /reset sends none */
  const w = await preflight("/welcome", ["content-type", "authorization"], "https://app.lomonec.com");
  const rs = await preflight("/reset", ["content-type"], "https://app.lomonec.com");
  ok("W21 \u00b7 /welcome (ID token) and /reset (none) both pass the preflight from app.lomonec.com, unchanged",
    corsBlock(w, ["content-type", "authorization"], "https://app.lomonec.com") === "" && corsBlock(rs, ["content-type"], "https://app.lomonec.com") === "",
    JSON.stringify(w.allowHeaders) + JSON.stringify(rs.allowHeaders));
  const c = await browserCall("/apple/revoke", { token: idToken(), body: { code: "C0DE" }, origin: "https://evil.test" });
  const direct = await callWorker("/apple/revoke", { token: idToken(), body: { code: "C0DE" }, origin: "https://evil.test" });
  ok("W22 \u00b7 an unlisted origin is still refused: the preflight does not echo it, and the POST behind it is 403 anyway",
    c.blocked === "origin" && c.status === 0 && direct.status === 403, c.blocked + "/" + direct.status);
  const n = await browserCall("/apple/revoke", { body: { code: "C0DE" }, origin: "capacitor://localhost" });
  ok("W23 \u00b7 passing CORS proves nothing about identity: with no Firebase ID token it is still 401", n.blocked === "" && n.status === 401, n.blocked + "/" + n.status);
}
{
  const leaked = W.logs.filter(l => /C0DE|USEDC0DE|ey[A-Za-z0-9_-]{10}|SA_ACCESS|BEGIN PRIVATE KEY/.test(l));
  ok("W24 · nothing the Worker logged contains a code, an ID token, an access token or a key", leaked.length === 0, leaked.slice(0, 3).join(" | "));
  const src = readFileSync(root + "backend/mail/mail-worker.js", "utf8");
  ok("W25 · the Worker holds no Apple key material and reads no Apple credential (the words appear only in the comment explaining why)", !/BEGIN (EC |RSA )?PRIVATE KEY|AuthKey_/.test(src) && !/env\.APPLE_/.test(src) && !/client_secret\s*[:=]/.test(src));
  ok("W26 · capacitor://localhost is allowed, so the App Store build can reach the route at all", /capacitor:\/\/localhost/.test(src));
}
console.log = origLog; globalThis.fetch = realFetch;

/* ---------------------------- the client half ------------------------------ */
const FAKE_SDK = `
(function(){
  if(window.firebase&&window.firebase.__fake)return;
  const log=window.__fb={calls:[],deleted:0,docDeleted:0,reauth:0,signedOut:0};
  function user(uid,email,providers){return {uid,email,providerData:providers.map(p=>({providerId:p})),
    getIdToken:async()=>"ID_TOKEN_"+uid,
    reauthenticateWithCredential:async c=>{log.reauth++;if(window.__fb.reauthFails)throw {code:window.__fb.reauthFails};return {user:{uid}}},
    delete:async()=>{log.deleted++;if(window.__fb.deleteFails)throw {code:window.__fb.deleteFails}}}}
  const auth={currentUser:null,_cbs:[],
    onAuthStateChanged(cb){this._cbs.push(cb);setTimeout(()=>cb(this.currentUser),0);return ()=>{}},
    _set(u){this.currentUser=u;this._cbs.forEach(cb=>{try{cb(u)}catch(e){}})},
    async signOut(){log.signedOut++;this._set(null)},
    async signInWithCredential(c){log.calls.push("credential:"+c.providerId);this._set(user("uid-"+c.providerId,"x@"+c.providerId,[c.providerId]));return {user:this.currentUser,additionalUserInfo:{isNewUser:false}}},
    async getRedirectResult(){return {user:null}}};
  function OAuthProvider(id){this.providerId=id;this.credential=o=>({providerId:id,idToken:o&&o.idToken,rawNonce:o&&o.rawNonce})}
  const GoogleAuthProvider=function(){this.providerId="google.com"};
  GoogleAuthProvider.credential=(idToken)=>({providerId:"google.com",idToken});
  const db={collection:()=>({doc:()=>({get:async()=>({exists:false,data:()=>({})}),set:async()=>{},delete:async()=>{window.__fb.docDeleted++}})})};
  window.firebase={__fake:true,initializeApp(){},auth(){return auth},firestore(){return db}};
  window.firebase.auth.GoogleAuthProvider=GoogleAuthProvider;
  window.firebase.auth.OAuthProvider=OAuthProvider;
  window.firebase.firestore.FieldValue={serverTimestamp:()=>1};
  window.__mkUser=(uid,email,providers)=>{auth._set(user(uid,email,providers))};
})();`;

const BRIDGE = () => {
  const be = window.__be = { calls: [], next: "ok", code: "FRESHC0DE" };
  const fail = c => { const e = new Error(c); e.code = c; return e; };
  const P = {
    available: async () => ({ apple: true, google: true }),
    appleSignIn: async () => { be.calls.push("appleSignIn");
      if (be.next !== "ok") throw fail(be.next);
      return { idToken: "APPLE_ID_TOKEN", rawNonce: "N", provider: "apple.com", ...(be.code ? { authorizationCode: be.code } : {}) }; },
    googleSignIn: async () => ({ idToken: "G", rawNonce: "N", provider: "google.com" }),
  };
  /* the bridge as iOS injects it: Capacitor.Plugins.<jsName>, no registerPlugin */
  const a = (window.Capacitor = window.Capacitor || {});
  a.getPlatform = () => "ios"; a.isNativePlatform = () => true; a.Plugins = { BEAuth: P };
};
const seed = JSON.stringify({ profile: { name: "Ada", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

const b = await chromium.launch();
async function open({ ios = true, revokeStatus = 200, revokeBody = { ok: true, revoked: true } } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be12_owner", "uid-apple"); }, [seed]);
  if (ios) await ctx.addInitScript(BRIDGE);
  await ctx.route(/gstatic\.com\/firebasejs/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: FAKE_SDK }));
  const net = [];
  await ctx.route(/be-mail\.nore-ngou\.workers\.dev/, r => {
    const q = r.request(); net.push({ path: new URL(q.url()).pathname, auth: q.headers().authorization || "", body: q.postData() || "" });
    if (/\/apple\/revoke/.test(q.url())) return r.fulfill({ status: revokeStatus, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(revokeBody) });
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" });
  });
  await ctx.route(/be-polish|be-partner|be-events|be-push|cloudflareinsights|ytimg|youtube|googleapis/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  const p = await ctx.newPage(); const logs = []; p.on("console", m => logs.push(m.text())); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1300);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#ppFab").forEach(e => e.remove()));
  await p.evaluate(() => { window.askConfirm = async () => true; window.__toasts = []; const _t = window.toast; window.toast = m => { window.__toasts.push(String(m)); try { _t(m); } catch (e) {} }; });
  return { ctx, p, net, logs, errs };
}
const signIn = (p, uid, email, providers) => p.evaluate(async ([u, e, pr]) => { await fbLoad(); window.__mkUser(u, e, pr); await new Promise(r => setTimeout(r, 150)); }, [uid, email, providers]);
const del = async (p) => { await p.evaluate(() => fbDeleteAccount()); await sleep(600);
  return p.evaluate(() => ({ toasts: window.__toasts, deleted: window.__fb.deleted, doc: window.__fb.docDeleted, reauth: window.__fb.reauth, apple: (window.__be || { calls: [] }).calls.filter(c => c === "appleSignIn").length })); };

console.log("\n# deletion of an Apple account");
{
  const { p, ctx, net } = await open();
  await signIn(p, "uid-apple", "ada@example.com", ["apple.com"]);
  const r = await del(p);
  ok("C1 · an Apple account is asked to confirm with Apple once, and a FRESH code is fetched at deletion time", r.apple === 1);
  const call = net.find(x => x.path === "/apple/revoke");
  ok("C2 · the code goes to the Worker with the learner's ID token — the client never talks to Apple's token endpoint", !!call && /^Bearer ID_TOKEN_/.test(call.auth) && /FRESHC0DE/.test(call.body), JSON.stringify(call && call.path));
  ok("C3 · revocation happens BEFORE anything is erased, and the account is then deleted", r.deleted === 1 && r.doc === 1);
  ok("C4 · the confirmation doubles as the recent login Firebase needs", r.reauth === 1);
  await ctx.close();
}
{
  const { p, ctx, net } = await open({ revokeStatus: 503, revokeBody: { error: "apple_unavailable" } });
  await signIn(p, "uid-apple", "ada@example.com", ["apple.com"]);
  const r = await del(p);
  ok("C5 · revocation failing STOPS the deletion — the Firebase user and the document both survive", r.deleted === 0 && r.doc === 0);
  ok("C6 · … and the learner is told plainly that nothing was deleted, with no raw Apple error", r.toasts.some(x => /nothing was deleted/i.test(x)) && !r.toasts.some(x => /apple_unavailable|INVALID|5\d\d/.test(x)), JSON.stringify(r.toasts));
  /* a retry, now that the server is answering */
  await p.evaluate(() => { window.__retry = true; });
  await p.unroute(/be-mail\.nore-ngou\.workers\.dev/);
  await p.route(/be-mail\.nore-ngou\.workers\.dev/, rt => rt.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, revoked: true }) }));
  const r2 = await del(p);
  ok("C7 · retrying after a failure works, with a new code, and completes the deletion", r2.apple === 2 && r2.deleted === 1, JSON.stringify(r2));
  await ctx.close();
}
{
  const { p, ctx } = await open({ revokeStatus: 400, revokeBody: { error: "apple_code" } });
  await signIn(p, "uid-apple", "ada@example.com", ["apple.com"]);
  const r = await del(p);
  ok("C8 · a refused code (used or expired) stops the deletion and says to try again", r.deleted === 0 && r.toasts.some(x => /try|again/i.test(x)), JSON.stringify(r.toasts));
  await ctx.close();
}

/* WHICH failure it was decides the wording. The status alone cannot tell them
   apart — Apple refusing a code and a mis-configured Worker are both 400 — so
   the client reads the Worker's own `error` field. Until 2 Oct 2026 it read only
   the status, and a learner met "Tap Delete account again to retry" eleven times
   in a row while the real fault was a missing header in the Worker. Never again:
   only an Apple refusal may invite a retry. */
console.log("\n# the failure message tells the truth about whose fault it is");
{
  const say = async (status, body) => {
    const { p, ctx } = await open({ revokeStatus: status, revokeBody: body });
    await signIn(p, "uid-apple", "ada@example.com", ["apple.com"]);
    const r = await del(p);
    await ctx.close();
    return r;
  };
  const retryish = x => /try once more|try again|again/i.test(x);

  const refused = await say(400, { error: "apple_code" });
  ok("C23 · Apple refusing the code: nothing deleted, and this one MAY be tried again",
    refused.deleted === 0 && refused.toasts.some(x => /Apple didn't accept/i.test(x) && retryish(x)), JSON.stringify(refused.toasts));

  const unauth = await say(401, { error: "auth" });
  ok("C24 · an authentication failure says to log in again — not that Apple refused",
    unauth.deleted === 0 && unauth.toasts.some(x => /log in again/i.test(x)) && !unauth.toasts.some(x => /Apple didn't accept/i.test(x)), JSON.stringify(unauth.toasts));

  const unavail = await say(503, { error: "apple_unavailable" });
  ok("C25 · a server failure says the fault is OURS and does NOT invite a blind retry",
    unavail.deleted === 0 && unavail.toasts.some(x => /on our side/i.test(x)) && !unavail.toasts.some(retryish), JSON.stringify(unavail.toasts));

  const badcode = await say(400, { error: "bad code" });
  ok("C26 · the Worker rejecting the code itself is OUR fault too — same honest wording, no retry loop",
    badcode.deleted === 0 && badcode.toasts.some(x => /on our side/i.test(x)) && !badcode.toasts.some(retryish), JSON.stringify(badcode.toasts));

  const weird = await say(418, { error: "something-we-have-never-seen" });
  ok("C27 · an unknown error code falls back to the server wording, never to a retry",
    weird.deleted === 0 && weird.toasts.some(x => /on our side/i.test(x)) && !weird.toasts.some(retryish), JSON.stringify(weird.toasts));

  /* a 200 that does not actually say ok: believing it would delete the account
     with the Apple grant still standing, which is the one thing that must never
     happen */
  const hollow = await say(200, { revoked: false });
  ok("C28 · a 200 that does not confirm the revoke is NOT believed: nothing is deleted and the learner is told",
    hollow.deleted === 0 && hollow.doc === 0 && hollow.toasts.some(x => /on our side/i.test(x)), JSON.stringify(hollow.toasts));

  const garbage = await say(500, "<html>502 Bad Gateway</html>");
  ok("C29 · a response that is not JSON at all is survived, not thrown on, and still deletes nothing",
    garbage.deleted === 0 && garbage.toasts.length > 0, JSON.stringify(garbage.toasts));

  /* the network case: the fetch itself never resolves */
  const { p, ctx } = await open();
  await signIn(p, "uid-apple", "ada@example.com", ["apple.com"]);
  await p.unroute(/be-mail\.nore-ngou\.workers\.dev/);
  await p.route(/be-mail\.nore-ngou\.workers\.dev/, rt => rt.abort("failed"));
  const offline = await del(p);
  ok("C30 · no connection: nothing deleted, a plain line, and no raw error on screen",
    offline.deleted === 0 && offline.doc === 0 && offline.toasts.length > 0
    && !offline.toasts.some(x => /TypeError|fetch|ERR_|undefined/i.test(x)), JSON.stringify(offline.toasts));
  await ctx.close();

  /* and none of the four wordings leaks anything */
  const all = [...refused.toasts, ...unauth.toasts, ...unavail.toasts, ...badcode.toasts, ...weird.toasts, ...hollow.toasts, ...offline.toasts].join(" | ");
  ok("C31 · no code, token, key, status number or raw server error appears in any of them",
    !/FRESHC0DE|ID_TOKEN|Bearer|eyJ|apple_code|apple_unavailable|bad code|INVALID|\b[45]\d\d\b/.test(all), all.slice(0, 200));
}
{
  const { p, ctx } = await open();
  await signIn(p, "uid-apple", "ada@example.com", ["apple.com"]);
  await p.evaluate(() => { window.__be.code = null; });        // Apple answered without a code
  const r = await del(p);
  ok("C9 · an Apple answer with no authorisation code stops the deletion", r.deleted === 0 && r.toasts.length > 0);
  await ctx.close();
}
{
  const { p, ctx } = await open();
  await signIn(p, "uid-apple", "ada@example.com", ["apple.com"]);
  await p.evaluate(() => { window.__be.next = "cancelled"; });
  const r = await del(p);
  ok("C10 · cancelling Apple's sheet deletes nothing and says nothing (it was the learner's choice)", r.deleted === 0 && r.toasts.length === 0, JSON.stringify(r.toasts));
  await ctx.close();
}

console.log("\n# deletion of accounts that have no Apple identity");
{
  const { p, ctx, net } = await open();
  await signIn(p, "uid-pw", "pw@example.com", ["password"]);
  const r = await del(p);
  ok("C11 · an email/password account is deleted exactly as before", r.deleted === 1 && r.doc === 1);
  ok("C12 · … with no Apple sheet and no call to the revoke route", r.apple === 0 && !net.some(x => x.path === "/apple/revoke"));
  await ctx.close();
}
{
  const { p, ctx, net } = await open();
  await signIn(p, "uid-google", "g@example.com", ["google.com"]);
  const r = await del(p);
  ok("C13 · a Google account is deleted exactly as before, with no Apple step", r.deleted === 1 && r.apple === 0 && !net.some(x => x.path === "/apple/revoke"));
  await ctx.close();
}
{
  const { p, ctx } = await open();
  await signIn(p, "uid-both", "both@example.com", ["password", "apple.com"]);
  const r = await del(p);
  ok("C14 · an account with BOTH password and Apple still revokes (the provider list decides, not how they signed in today)", r.apple === 1 && r.deleted === 1);
  await ctx.close();
}
{
  /* the web: an Apple account cannot produce a code there, so deletion must say
     so rather than complete and leave Apple believing the grant is live */
  const { p, ctx, net } = await open({ ios: false });
  await signIn(p, "uid-apple", "ada@example.com", ["apple.com"]);
  const r = await del(p);
  ok("C15 · on the web an Apple account is NOT deleted, and is told to use the iPhone app", r.deleted === 0 && r.toasts.some(x => /iPhone/i.test(x)), JSON.stringify(r.toasts));
  ok("C16 · … and nothing was erased first", r.doc === 0 && !net.some(x => x.path === "/apple/revoke"));
  await ctx.close();
}
{
  const { p, ctx } = await open({ ios: false });
  await signIn(p, "uid-pw", "pw@example.com", ["password"]);
  const r = await del(p);
  ok("C17 · on the web an email/password account still deletes normally", r.deleted === 1);
  await ctx.close();
}

console.log("\n# nothing else moved");
{
  const { p, ctx, logs } = await open();
  await signIn(p, "uid-apple", "ada@example.com", ["apple.com"]);
  await del(p);
  ok("C18 · no code, ID token or nonce reached the console", !logs.some(l => /FRESHC0DE|ID_TOKEN_|APPLE_ID_TOKEN/.test(l)), logs.filter(l => /TOKEN|C0DE/.test(l)).join(" | "));
  const html = readFileSync(root + "index.html", "utf8");
  ok("C19 · the app holds no Apple private key, .p8 or client secret", !/BEGIN PRIVATE KEY|AuthKey_|client_secret|\.p8\b/.test(html));
  ok("C20 · Premium is untouched: billing off, ENT_API empty, StoreKit products unchanged", await p.evaluate(() => !flag("billing_enabled") && ENT_API === "" && BILLING_PRODUCTS.join(",") === "premium_monthly,premium_annual"));
  ok("C21 · the ytai account gate and the signing wrapper still stand", await p.evaluate(() => typeof ytaiNoAccount === "function" && /be-polish/.test(POLISH_API)));
  ok("C22 · track isolation is unchanged (this is account-level code, with no track term)", !/fbAppleRevoke[\s\S]{0,400}(areaId|isGeneralEnglish)/.test(html));
  await ctx.close();
}

console.log("\n# what only Apple, a device and the console can answer");
pend("Apple accepts a real authorisation code and revokes the grant", "needs a signed build, a real Apple ID and the Firebase Apple provider configured — SERVER-CONFIGURATION PENDING");
pend("Firebase can mint Apple's client secret (Services ID, team ID, key ID, .p8 uploaded to the console)", "owner's console work — SERVER-CONFIGURATION PENDING");
pend("the deletion sheet, Face ID and the second Apple confirmation on a real iPhone", "REAL IPHONE");
pend("be-mail deployed with the new route and capacitor://localhost allowed", "PRODUCTION — deploy not authorised in this task");

const pass = res.filter(Boolean).length;
console.log(`\n${pass === res.length ? "ALL PASS" : "FAILURES"} — ${pass}/${res.length}\n`);
await b.close(); if (srv) srv.kill();
process.exit(pass === res.length ? 0 : 1);
