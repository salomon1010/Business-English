/* be-push — Android notifications (FCM HTTP v1), in process.   Run: node backend/push/test/fcm.mjs
   The Worker's real routes and crons with an in-memory KV, a generated RSA service-account
   key, a stand-in Google token endpoint that VERIFIES the signed JWT, and a stand-in FCM
   endpoint recording every message. What this cannot prove: that Google accepts the real
   service account and that a real Android phone shows the notification — those need the
   Firebase Android app and a device (docs/ANDROID_NATIVE_SHELL_PLAN.md phase 6). */
import { webcrypto } from "node:crypto";
import worker, { runCron, runPresence, runNudges, cleanFcm, hasRoute } from "../push-worker.js";
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const H = 3_600_000, ORIGIN = "https://localhost";   // the Android shell's own origin
const TOKEN = "fcmTok_" + "A1b2C3d4".repeat(20) + ":APA91b" + "x".repeat(40), TOKEN2 = "fcmTok2_" + "Z9y8".repeat(40);

const kv = new Map();
const SUBS = {
  async get(k, t) { const v = kv.get(k); if (!v || (v.exp && v.exp < Date.now())) return null; return t === "json" ? JSON.parse(v.v) : v.v; },
  async put(k, v, o = {}) { kv.set(k, { v: String(v), exp: o.expirationTtl ? Date.now() + o.expirationTtl * 1000 : 0 }); },
  async delete(k) { kv.delete(k); },
  async list({ prefix }) { return { keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; },
};

/* a real RSA service-account key, as Google hands it out */
const rsa = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", rsa.privateKey)).toString("base64");
const SA = { type: "service_account", project_id: "be-mastery", client_email: "fcm-sender@be-mastery.iam.gserviceaccount.com",
  private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8.replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n` };
const vapid = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const base = { SUBS, PARTNER_API: "http://partner.test", PUSH_SECRET: "s3cret",
  VAPID_PRIVATE_JWK: JSON.stringify(await webcrypto.subtle.exportKey("jwk", vapid.privateKey)), VAPID_PUBLIC_KEY: "x",
  FCM_SA_JSON: JSON.stringify(SA) };
let env = { ...base };

const b64urlToBuf = s => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
let google = [], tokens = [], fcmReply = () => ({ status: 200, body: JSON.stringify({ name: "projects/be-mastery/messages/1" }) }), tokenSeq = 0;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url), h = init.headers || {};
  if (u === "https://oauth2.googleapis.com/token") {
    const p = new URLSearchParams(String(init.body)), jwt = p.get("assertion") || "";
    const [h64, c64, s64] = jwt.split(".");
    const valid = await webcrypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, rsa.publicKey, b64urlToBuf(s64 || ""), Buffer.from(h64 + "." + c64));
    tokens.push({ grant: p.get("grant_type"), head: JSON.parse(b64urlToBuf(h64)), claims: JSON.parse(b64urlToBuf(c64)), valid });
    return valid ? new Response(JSON.stringify({ access_token: "ya29.test-" + (++tokenSeq), expires_in: 3599 })) : new Response("{}", { status: 400 });
  }
  if (u.startsWith("https://fcm.googleapis.com/v1/projects/")) {
    const req = { url: u, auth: h.authorization, body: JSON.parse(init.body || "{}") };
    google.push(req);
    const r = fcmReply(req, google.length);
    return new Response(r.body ?? "", { status: r.status });
  }
  if (u === "http://partner.test/presence") return new Response(JSON.stringify({ online: 3, waiting: 3 }));
  if (u === "http://partner.test/programme") return new Response(JSON.stringify({ track: "general-english" }));
  if (u.startsWith("https://push.test/")) { google.push({ web: u }); return new Response("", { status: 201 }); }
  return new Response("", { status: 599 });
};
const call = async (path, body, token, method = "POST") => {
  const hd = { origin: ORIGIN, "content-type": "application/json" }; if (token) hd.authorization = "Bearer " + token;
  const r = await worker.fetch(new Request("https://be-push.test" + path, { method, headers: hd, body: method === "POST" ? JSON.stringify(body) : undefined }), env, {});
  return { status: r.status, json: await r.json().catch(() => null) };
};
const TEXT = { reminder: { title: "Time to practise", body: "Week 3 · Clear updates" },
  online: { title: "Learners online now", body: "{{n}} learners are ready to practise." },
  call: { live: { title: "{{name}} wants to practise live with you", body: "Answer to start the call." }, trial: { title: "{{name}} wants to try a practice with you", body: "Four short turns." } },
  someone: "A learner" };
const android = (id, extra = {}) => call("/subscribe", { id, slot: "1900", fcm: { token: TOKEN }, tz: 0, text: TEXT, ...extra });
const reset = () => { google = []; tokens = []; fcmReply = () => ({ status: 200, body: "{}" }); };

/* nudges are checked against the REAL clock (/nudge refuses a record that has
   already expired), so the cron runs "now" and the learner's time zone is chosen
   to put them at midday — outside quiet hours whatever time the suite runs */
const NOON_TZ = () => { const d = new Date(); return 720 - (d.getUTCHours() * 60 + d.getUTCMinutes()); };

console.log("\n# an Android phone registers an FCM token instead of a push subscription");
{
  const r = await android("android-aaaaaa1");
  const rec = await SUBS.get("sub:android-aaaaaa1", "json");
  ok("A1 · the Android shell's origin is allowed and an FCM token is accepted, with no endpoint and no APNs", r.status === 200 && rec.fcm.token === TOKEN && !rec.endpoint && !rec.apns, JSON.stringify({ r, rec }));
  ok("A2 · the row is reachable, so no cron treats the phone as unregistered", hasRoute(rec) === true);
  ok("A3 · the phone's own wording is stored (capped, nothing personal) and the slot row exists", rec.text.reminder.title === "Time to practise" && !!(await SUBS.get("slot:1900:android-aaaaaa1", "json")));
  const bad = await call("/subscribe", { id: "android-badtoken", slot: "1900", fcm: { token: "short" }, tz: 0 });
  ok("A4 · a token that is not an FCM token is refused", bad.status === 400 && /fcm/.test(bad.json.error), JSON.stringify(bad));
  ok("A5 · cleanFcm refuses rubbish (short, spaces, script) and keeps a real token", cleanFcm(null) === null && cleanFcm({ token: "x" }) === null && cleanFcm({ token: "a b".repeat(60) }) === null && cleanFcm({ token: TOKEN }).token === TOKEN);
}

console.log("\n# the daily reminder reaches FCM as a data message, signed with the service account");
{
  reset();
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  const m = google[0], t = tokens[0];
  ok("B1 · one message to the project's v1 endpoint, for that token", google.length === 1 && m.url === "https://fcm.googleapis.com/v1/projects/be-mastery/messages:send" && m.body.message.token === TOKEN, JSON.stringify(google.map(x => x.url)));
  ok("B2 · a DATA message with the phone's own words, the view and tag the app routes by — no 'notification' block", m.body.message.data.title === "Time to practise" && m.body.message.data.body === "Week 3 · Clear updates"
    && m.body.message.data.view === "journey" && m.body.message.data.tag === "be-daily" && !m.body.message.notification, JSON.stringify(m.body));
  ok("B3 · normal priority, an hour to live, collapsed by tag", m.body.message.android.priority === "NORMAL" && m.body.message.android.ttl === "3600s" && m.body.message.android.collapse_key === "be-daily", JSON.stringify(m.body.message.android));
  ok("B4 · OAuth: an RS256 JWT from the service account, the messaging scope, Google's token audience, a signature the key really made, exchanged for the bearer FCM sees",
    t && t.valid && t.head.alg === "RS256" && t.claims.iss === SA.client_email && t.claims.scope === "https://www.googleapis.com/auth/firebase.messaging"
    && t.claims.aud === "https://oauth2.googleapis.com/token" && t.grant === "urn:ietf:params:oauth:grant-type:jwt-bearer" && m.auth === "Bearer ya29.test-1", JSON.stringify(t));
  ok("B5 · every data value is a string (FCM rejects anything else)", Object.values(m.body.message.data).every(v => typeof v === "string"));
  reset(); await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("B6 · the access token is reused, not re-minted on every send", tokens.length === 0 && google[0].auth === "Bearer ya29.test-1");
  reset(); await call("/done", { id: "android-aaaaaa1" }); await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("B7 · a learner who already practised is not woken", google.length === 0);
  await SUBS.delete("done:android-aaaaaa1");
}

console.log("\n# invitations, online alerts and nudges — the same rules as iPhone");
{
  reset();
  await android("android-aaaaaa1", { presence: true, calls: true, nudges: true });
  await call("/wake", { secret: "s3cret", id: "android-aaaaaa1", kind: "live", name: "Ada" });
  const c = google[0];
  ok("C1 · an invitation: the name filled in, HIGH priority, a short life, call kind and urgent flag in the data", c && c.body.message.data.title === "Ada wants to practise live with you" && c.body.message.android.priority === "HIGH"
    && parseInt(c.body.message.android.ttl) <= 600 && c.body.message.data.call === "live" && c.body.message.data.urgent === "1", JSON.stringify(c && c.body));
  reset();
  await runPresence(env, new Date(Date.UTC(2026, 9, 5, 12, 0)));
  ok("C2 · an online alert fills in the count and opens Practice Partner", google.length === 1 && google[0].body.message.data.body === "3 learners are ready to practise." && google[0].body.message.data.view === "partner", JSON.stringify(google[0] && google[0].body));
  reset();
  await call("/nudge", { id: "android-aaaaaa1", tz: NOON_TZ(), rec: { rid: "lesson-x1", kind: "lesson", view: "session", args: [3, "Wed"], title: "Week 3 is ready", body: "25 minutes moves you forward.", sendAfter: Date.now() - 1000, expiresAt: Date.now() + 20 * H } }, "tok-ge");
  await runNudges(env, Date.now() + 1000);
  const n = google[0];
  ok("C3 · a learning nudge carries its title, body, rid, kind and view", google.length === 1 && n.body.message.data.title === "Week 3 is ready" && n.body.message.data.rid === "lesson-x1" && n.body.message.data.nkind === "lesson" && n.body.message.data.view === "session", JSON.stringify(n && n.body));
  await SUBS.delete("done:android-aaaaaa1");
}

console.log("\n# what Google answers");
{
  reset(); tokenSeq = 10;
  let n = 0; fcmReply = () => (++n === 1 ? { status: 401, body: JSON.stringify({ error: { code: 401, status: "UNAUTHENTICATED" } }) } : { status: 200, body: "{}" });
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("D1 · a 401 re-mints the access token once and the send goes through", google.length === 2 && google[1].auth !== google[0].auth && tokens.length === 1, JSON.stringify(google.map(g => g.auth)));
  reset();
  fcmReply = () => ({ status: 404, body: JSON.stringify({ error: { code: 404, status: "NOT_FOUND", details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: "UNREGISTERED" }] } }) });
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("D2 · UNREGISTERED (app removed / token rotated): the row goes, like a 410 from a browser", !(await SUBS.get("sub:android-aaaaaa1")) && !(await SUBS.get("slot:1900:android-aaaaaa1")));
  reset();
  await android("android-aaaaaa2");
  fcmReply = () => ({ status: 500, body: JSON.stringify({ error: { code: 500, status: "INTERNAL" } }) });
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("D3 · a server error at Google keeps the row (try again next time)", !!(await SUBS.get("sub:android-aaaaaa2")));
}

console.log("\n# unconfigured = off, and browsers / iPhones are untouched");
{
  reset();
  env = { ...base, FCM_SA_JSON: "" };
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("E1 · no service account: nothing is sent to Google and nothing throws — and the phone stays registered", google.length === 0 && !!(await SUBS.get("sub:android-aaaaaa2")));
  env = { ...base };
  await SUBS.delete("sub:android-aaaaaa2"); await SUBS.delete("slot:1900:android-aaaaaa2");
  await call("/subscribe", { id: "browser-aaaaaa01", slot: "1900", endpoint: "https://push.test/browser-aaaaaa01", tz: 0 });
  reset(); await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("E2 · a browser row still gets its bare web push, never an FCM call", google.length === 1 && !!google[0].web, JSON.stringify(google));
}

const failed = res.filter(x => !x).length;
console.log(`\n${res.length - failed}/${res.length} passed`);
process.exit(failed ? 1 : 0);
