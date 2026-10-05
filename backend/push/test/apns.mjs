/* be-push — iOS notifications (APNs), in process.   Run: node backend/push/test/apns.mjs
   The Worker's real routes and crons with an in-memory KV, a generated APNs
   signing key, and a stand-in Apple recording every request: host, headers,
   JWT and payload. The JWT is verified with the matching public key, so a
   signature this Worker could not actually have made fails the suite.

   What this cannot prove: that Apple accepts the key, and that a real iPhone
   shows the notification. Those need an APNs auth key and a device —
   docs/IOS_NOTIFICATIONS.md lists them. */
import { webcrypto } from "node:crypto";
import worker, { runCron, runPresence, runNudges, apnsAlert, cleanApns, cleanText, cleanImage, hasRoute } from "../push-worker.js";
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const H = 3_600_000, ORIGIN = "capacitor://localhost", TOKEN = "a".repeat(64), TOKEN2 = "b".repeat(64);

/* ---- KV */
const kv = new Map();
const SUBS = {
  async get(k, t) { const v = kv.get(k); if (!v || (v.exp && v.exp < Date.now())) return null; return t === "json" ? JSON.parse(v.v) : v.v; },
  async put(k, v, o = {}) { kv.set(k, { v: String(v), exp: o.expirationTtl ? Date.now() + o.expirationTtl * 1000 : 0 }); },
  async delete(k) { kv.delete(k); },
  async list({ prefix }) { return { keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; },
};

/* ---- the APNs signing key: a real P-256 pair, exported as the .p8 secret is */
const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
const P8 = `-----BEGIN PRIVATE KEY-----\n${pkcs8.replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;
const vapid = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);

const base = {
  SUBS, PARTNER_API: "http://partner.test", PUSH_SECRET: "s3cret",
  VAPID_PRIVATE_JWK: JSON.stringify(await webcrypto.subtle.exportKey("jwk", vapid.privateKey)), VAPID_PUBLIC_KEY: "x",
  APNS_KEY_P8: P8, APNS_KEY_ID: "ABC1234567", APNS_TEAM_ID: "8TKAAK2MG6", APNS_TOPIC: "com.lomonec.bemastery",
};
let env = { ...base };

/* ---- the stand-in Apple, plus the partner Worker's /presence and /programme */
let apple = [];              // every APNs request
let appleReply = () => ({ status: 200, body: "" });
let online = 0;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url), h = init.headers || {};
  if (/api(\.sandbox)?\.push\.apple\.com/.test(u)) {
    const req = { url: u, host: new URL(u).host, token: u.split("/3/device/")[1], headers: h, body: JSON.parse(init.body || "{}") };
    apple.push(req);
    const r = appleReply(req, apple.length);
    return new Response(r.body ?? "", { status: r.status });
  }
  if (u === "http://partner.test/presence") return new Response(JSON.stringify({ online, waiting: online }));
  if (u === "http://partner.test/programme") return new Response(JSON.stringify({ track: "general-english" }));
  if (u.startsWith("https://push.test/")) { apple.push({ web: u }); return new Response("", { status: 201 }); }
  return new Response("", { status: 599 });
};
const call = async (path, body, token, method = "POST") => {
  const hd = { origin: ORIGIN, "content-type": "application/json" }; if (token) hd.authorization = "Bearer " + token;
  const r = await worker.fetch(new Request("https://be-push.test" + path, { method, headers: hd, body: method === "POST" ? JSON.stringify(body) : undefined }), env, {});
  return { status: r.status, json: await r.json().catch(() => null) };
};
const TEXT = {
  reminder: { title: "Time to practise", body: "Week 3 · Clear updates" },
  online: { title: "Learners online now", body: "{{n}} learners are ready to practise." },
  call: { live: { title: "{{name}} wants to practise live with you", body: "Answer to start the call." },
          trial: { title: "{{name}} wants to try a practice with you", body: "Four short turns." } },
  someone: "A learner",
};
const iphone = (id, extra = {}) => call("/subscribe", { id, slot: "1900", apns: { token: TOKEN, env: "production" }, tz: 0, text: TEXT, ...extra });
const b64urlToBuf = s => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const reset = () => { apple = []; appleReply = () => ({ status: 200, body: "" }); };

console.log("\n# an iPhone registers a device token instead of a push subscription");
{
  let r = await iphone("iphone-aaaaaaa1");
  const rec = await SUBS.get("sub:iphone-aaaaaaa1", "json");
  ok("A1 · the shell's own origin is allowed and an APNs token is accepted, with no endpoint", r.status === 200 && rec.apns.token === TOKEN && rec.apns.env === "production" && !rec.endpoint, JSON.stringify({ r, rec }));
  ok("A2 · the row is reachable, so no cron treats the phone as unregistered", hasRoute(rec) === true && hasRoute({ endpoint: "https://x/y" }) === true && hasRoute({}) === false);
  ok("A3 · the slot row was written, so the reminder minute finds it", !!(await SUBS.get("slot:1900:iphone-aaaaaaa1", "json")));
  ok("A4 · the wording it will show is stored, capped, and holds nothing personal", rec.text.reminder.title === "Time to practise" && rec.text.call.live.title.includes("{{name}}") && !("endpoint" in rec.text));
  r = await call("/subscribe", { id: "iphone-bad-token", slot: "1900", apns: { token: "nope" }, tz: 0 });
  ok("A5 · a token that is not a device token is refused", r.status === 400 && /apns/.test(r.json.error), JSON.stringify(r));
  ok("A6 · cleanApns / cleanText refuse rubbish and keep only known fields",
    cleanApns(null) === null && cleanApns({ token: "zz" }) === null && cleanApns({ token: TOKEN.toUpperCase(), env: "weird" }).env === "production"
    && cleanText({ reminder: { title: "x".repeat(300), body: "b" } }).reminder.title.length === 80
    && cleanText({ nonsense: 1 }) === null && cleanText({ reminder: { body: "no title" } }) === null);
}

console.log("\n# the daily reminder reaches Apple, signed, addressed and collapsible");
{
  reset();
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  const a = apple[0];
  ok("B1 · one request, to Apple's production host, for that device token", apple.length === 1 && a.host === "api.push.apple.com" && a.token === TOKEN, JSON.stringify(apple.map(x => x.url)));
  ok("B2 · the alert carries the phone's own words — APNs has no service worker to ask", a.body.aps.alert.title === "Time to practise" && a.body.aps.alert.body === "Week 3 · Clear updates", JSON.stringify(a.body));
  ok("B3 · the headers Apple requires: the app's topic, an alert push, normal priority, an expiry and a collapse id matching the web tag",
    a.headers["apns-topic"] === "com.lomonec.bemastery" && a.headers["apns-push-type"] === "alert" && a.headers["apns-priority"] === "5"
    && Number(a.headers["apns-expiration"]) > Math.floor(Date.now() / 1000) && a.headers["apns-collapse-id"] === "be-daily", JSON.stringify(a.headers));
  ok("B4 · the payload tells the app where to go, and nothing else", a.body.be.view === "journey" && a.body.be.tag === "be-daily" && Object.keys(a.body.be).length === 2, JSON.stringify(a.body.be));
  /* the JWT: Apple's own shape, and a signature this key really made */
  const [h64, p64, s64] = String(a.headers.authorization).replace(/^bearer /, "").split(".");
  const head = JSON.parse(b64urlToBuf(h64)), claims = JSON.parse(b64urlToBuf(p64));
  const verified = await webcrypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, b64urlToBuf(s64), Buffer.from(h64 + "." + p64));
  ok("B5 · token-based auth: ES256, the key id in the header, the team as issuer, and a signature the .p8 made",
    head.alg === "ES256" && head.kid === "ABC1234567" && claims.iss === "8TKAAK2MG6" && Math.abs(claims.iat - Math.floor(Date.now() / 1000)) < 120 && verified === true,
    JSON.stringify({ head, claims, verified }));
  /* a second send reuses it: Apple asks for a refresh at most every 20 minutes */
  reset(); await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("B6 · the provider token is reused rather than re-signed on every send", apple[0].headers.authorization === String(a.headers.authorization));
  /* practised today: the cron must stay silent, exactly as for a browser */
  reset();
  await call("/done", { id: "iphone-aaaaaaa1" });
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("B7 · a learner who already practised is not woken at all", apple.length === 0);
  await SUBS.delete("done:iphone-aaaaaaa1");
}

console.log("\n# invitations, online alerts and nudges — the same rules, an Apple payload");
{
  reset();
  await iphone("iphone-aaaaaaa1", { presence: true, calls: true, nudges: true });
  let r = await call("/wake", { secret: "s3cret", id: "iphone-aaaaaaa1", kind: "live", name: "Ada" });
  const a = apple[0];
  ok("C1 · an invitation rings: the host's name filled in, time-sensitive, priority 10, a short expiry", r.status === 200 && a.body.aps.alert.title === "Ada wants to practise live with you"
    && a.body.aps["interruption-level"] === "time-sensitive" && a.headers["apns-priority"] === "10" && a.body.be.call === "live"
    && Number(a.headers["apns-expiration"]) - Math.floor(Date.now() / 1000) <= 600, JSON.stringify({ r, aps: a.body.aps, h: a.headers["apns-priority"] }));
  ok("C2 · a nameless inviter is still a sentence, not a gap", apnsAlert({ text: TEXT }, { kind: "trial", name: "  " }).title === "A learner wants to try a practice with you");
  reset(); online = 3;
  await runPresence(env, new Date(Date.UTC(2026, 9, 5, 12, 0)));
  ok("C3 · an online alert fills in the count and points at Practice Partner", apple.length === 1 && apple[0].body.aps.alert.body === "3 learners are ready to practise." && apple[0].body.be.view === "partner", JSON.stringify(apple[0] && apple[0].body));
  reset(); online = 0;
  await call("/nudge", { id: "iphone-aaaaaaa1", tz: (12 - 12) * 60, rec: { rid: "lesson-x1", kind: "lesson", view: "session", args: [3, "Wed"], title: "Week 3 is ready", body: "25 minutes moves you forward.", sendAfter: Date.now() - 1000, expiresAt: Date.now() + 20 * H } }, "tok-ge");
  await runNudges(env, Date.UTC(2026, 9, 5, 12, 0));
  const n = apple[0];
  ok("C4 · a learning nudge carries its own title and body, its rid and the view it opens", apple.length === 1 && n.body.aps.alert.title === "Week 3 is ready" && n.body.be.rid === "lesson-x1" && n.body.be.view === "session" && n.headers["apns-collapse-id"] === "be-nudge", JSON.stringify(n && n.body));
  ok("C5 · sending it marks the phone done, so the plain reminder stays quiet today", (await SUBS.get("done:iphone-aaaaaaa1")) === new Date(Date.UTC(2026, 9, 5, 12, 0)).toISOString().slice(0, 10));
  ok("C6 · a plain nudge is delivered exactly as before: no mutable-content, no image field", n.body.aps["mutable-content"] === undefined && !("image" in n.body.be), JSON.stringify(n.body));
  await SUBS.delete("done:iphone-aaaaaaa1");

  /* A recommendation with a picture (5 Oct 2026): the clip's own thumbnail.
     iOS can only draw it if the payload says mutable-content and the app's
     notification extension (BEPushService) fetches it. */
  reset(); await SUBS.delete("nudge:iphone-aaaaaaa1"); await SUBS.delete("nlog:iphone-aaaaaaa1");   // a fresh log: the 20 h gap is nudge.mjs's subject, not this one's
  const IMG = "https://i.ytimg.com/vi/UF8uR6Z6KLc/hqdefault.jpg";
  await call("/nudge", { id: "iphone-aaaaaaa1", tz: 0, rec: { rid: "challenge-x2", kind: "challenge", view: "shadow", act: "clip", args: ["UF8uR6Z6KLc"], title: "Shadow this clip", body: "Two minutes with Steve Jobs.", image: IMG, sendAfter: Date.now() - 1000, expiresAt: Date.now() + 20 * H } }, "tok-ge");
  await runNudges(env, Date.UTC(2026, 9, 5, 12, 0));
  const m = apple[0];
  ok("C7 · a recommendation with a thumbnail asks for mutable-content and hands the extension the picture's address", apple.length === 1 && m.body.aps["mutable-content"] === 1 && m.body.be.image === IMG && m.body.aps.alert.title === "Shadow this clip", JSON.stringify(m && m.body));
  ok("C8 · the picture may come only from YouTube's thumbnail hosts or our own site, over https — anything else is dropped, not sent",
    cleanImage(IMG) === IMG && cleanImage("https://app.lomonec.com/og.png") === "https://app.lomonec.com/og.png"
    && cleanImage("http://i.ytimg.com/vi/x/hqdefault.jpg") === "" && cleanImage("https://evil.example/i.ytimg.com/x.jpg") === ""
    && cleanImage("https://i.ytimg.com.evil.example/x.jpg") === "" && cleanImage("javascript:alert(1)") === "" && cleanImage(null) === "" && cleanImage("https://i.ytimg.com/" + "a".repeat(300)) === "");
  await SUBS.delete("done:iphone-aaaaaaa1");

  /* The same recommendation to a browser stays a bare push; the picture travels
     through /why, which sw.js reads once — so the web banner gets it too. */
  reset();
  await call("/subscribe", { id: "browser-img00001", slot: "0700", endpoint: "https://push.test/browser-img00001", tz: 0, nudges: true });
  await call("/nudge", { id: "browser-img00001", tz: 0, rec: { rid: "challenge-x3", kind: "challenge", view: "shadow", act: "clip", args: ["UF8uR6Z6KLc"], title: "Shadow this clip", body: "Two minutes.", image: IMG, sendAfter: Date.now() - 1000, expiresAt: Date.now() + 20 * H } }, "tok-ge");
  await runNudges(env, Date.UTC(2026, 9, 5, 12, 0));
  const why = await call("/why?id=browser-img00001", null, null, "GET");
  ok("C9 · a browser's push stays bare, and /why serves the picture with the rest of the recommendation", apple.some(x => x.web) && why.status === 200 && why.json.kind === "nudge" && why.json.image === IMG && why.json.rid === "challenge-x3", JSON.stringify({ apple, why }));
  /* leave the later sections the rows they expect: the iPhone alone in slot 1900 */
  for (const k of ["sub:browser-img00001", "slot:0700:browser-img00001", "why:browser-img00001", "nlog:browser-img00001", "done:browser-img00001", "why:iphone-aaaaaaa1"]) await SUBS.delete(k);
}

console.log("\n# what Apple answers");
{
  reset();
  appleReply = () => ({ status: 410, body: JSON.stringify({ reason: "Unregistered" }) });
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("D1 · 410 Unregistered (the app was deleted): the row goes, like a 410 from a browser's push service", !(await SUBS.get("sub:iphone-aaaaaaa1")) && !(await SUBS.get("slot:1900:iphone-aaaaaaa1")));

  reset();
  await iphone("iphone-sandbox1");
  /* a token minted in the other environment: production refuses it, sandbox takes it */
  appleReply = req => req.host === "api.push.apple.com" ? { status: 400, body: JSON.stringify({ reason: "BadDeviceToken" }) } : { status: 200, body: "" };
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("D2 · BadDeviceToken on one host is retried on the other, so a TestFlight phone is not dropped", apple.length === 2 && apple[0].host === "api.push.apple.com" && apple[1].host === "api.sandbox.push.apple.com" && !!(await SUBS.get("sub:iphone-sandbox1")), JSON.stringify(apple.map(x => x.host)));

  reset();
  appleReply = () => ({ status: 400, body: JSON.stringify({ reason: "BadDeviceToken" }) });
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("D3 · refused by BOTH hosts: nothing can ever reach it, so the row goes", apple.length === 2 && !(await SUBS.get("sub:iphone-sandbox1")));

  reset();
  await iphone("iphone-expired1");
  let n = 0;
  appleReply = () => (++n === 1 ? { status: 403, body: JSON.stringify({ reason: "ExpiredProviderToken" }) } : { status: 200, body: "" });
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("D4 · an expired provider token is Apple asking for a fresh JWT, not a dead device: re-signed and retried, the phone kept",
    apple.length === 2 && apple[0].headers.authorization !== apple[1].headers.authorization && !!(await SUBS.get("sub:iphone-expired1")), JSON.stringify({ n: apple.length }));

  reset();
  appleReply = () => ({ status: 503, body: JSON.stringify({ reason: "ServiceUnavailable" }) });
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("D5 · Apple having a bad day is not the learner's fault: the row stays and it is tried again tomorrow", !!(await SUBS.get("sub:iphone-expired1")));
}

console.log("\n# no key, no sending — and the web is untouched either way");
{
  reset();
  env = { ...base, APNS_KEY_P8: "", APNS_KEY_ID: "", APNS_TEAM_ID: "" };
  await iphone("iphone-nokey01");
  const r = await SUBS.get("sub:iphone-nokey01", "json");
  ok("E1 · with no APNs key the phone still registers — it works the moment the key is added", !!r && r.apns.token === TOKEN);
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  ok("E2 · and nothing is sent, nothing thrown, and the phone is not dropped", apple.length === 0 && !!(await SUBS.get("sub:iphone-nokey01")));
  env = { ...base };

  reset();
  await call("/subscribe", { id: "browser-00000001", slot: "1900", endpoint: "https://push.test/browser-00000001", tz: 0 });
  await runCron(env, Date.UTC(2026, 9, 5, 19, 0));
  const web = apple.filter(x => x.web), ios = apple.filter(x => !x.web);
  ok("E3 · a browser still gets a BARE web push (no payload, no text) while an iPhone gets an Apple alert", web.length === 1 && ios.length >= 1 && ios.every(x => x.body.aps), JSON.stringify({ web: web.length, ios: ios.length }));
  const phone = await SUBS.get("sub:iphone-nokey01", "json");
  ok("E4 · a phone that never sent its wording is left silent rather than shown an empty banner", apnsAlert({ ...phone, text: null }, { kind: "reminder" }) === null);
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
