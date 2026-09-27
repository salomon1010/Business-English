/* be-push — Personalised Learning Nudges, in process.   Run: node backend/push/test/nudge.mjs
   The Worker's real routes and delivery cron, with an in-memory KV, a
   generated VAPID key, a stand-in partner Worker answering /programme (the
   account's programme) and a stand-in push service recording deliveries. */
import { webcrypto } from "node:crypto";
import worker, { runNudges } from "../push-worker.js";
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };
const H = 3_600_000, D = 24 * H, ORIGIN = "https://app.lomonec.com";

/* ---- KV */
const kv = new Map();
const SUBS = {
  async get(k, t) { const v = kv.get(k); if (!v || (v.exp && v.exp < Date.now())) return null; return t === "json" ? JSON.parse(v.v) : v.v; },
  async put(k, v, o = {}) { kv.set(k, { v: String(v), exp: o.expirationTtl ? Date.now() + o.expirationTtl * 1000 : 0 }); },
  async delete(k) { kv.delete(k); },
  async list({ prefix }) { return { keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; },
};
const pk = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const env = { SUBS, PARTNER_API: "http://partner.test", VAPID_PRIVATE_JWK: JSON.stringify(await webcrypto.subtle.exportKey("jwk", pk.privateKey)), VAPID_PUBLIC_KEY: "x" };

/* ---- the partner Worker's /programme (tokens stand for accounts) and the push service */
const PROGRAMME = { "tok-ge": "general-english", "tok-wd": "welding" };
let programmeCalls = 0; const pushes = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === "http://partner.test/programme") {
    programmeCalls++;
    const m = /^Bearer (.+)$/.exec((init.headers && init.headers.authorization) || "");
    if (!m) return new Response('{"error":"auth"}', { status: 401 });
    if (m[1] === "tok-down") throw new Error("network");
    if (!PROGRAMME[m[1]]) return new Response('{"error":"auth"}', { status: 401 });
    return new Response(JSON.stringify({ track: PROGRAMME[m[1]] }));
  }
  if (u.startsWith("https://push.test/")) { pushes.push(u.slice(18)); return new Response("", { status: 201 }); }
  return new Response("", { status: 599 });
};
const call = async (path, body, token, method = "POST") => {
  const h = { origin: ORIGIN, "content-type": "application/json" }; if (token) h.authorization = "Bearer " + token;
  const r = await worker.fetch(new Request("https://be-push.test" + path, { method, headers: h, body: method === "POST" ? JSON.stringify(body) : undefined }), env, {});
  return { status: r.status, json: await r.json().catch(() => null) };
};
const subscribe = id => call("/subscribe", { id, slot: "1900", endpoint: "https://push.test/" + id, tz: 0 });
const noonTz = t => (12 - new Date(t).getUTCHours()) * 60;               // a phone for which `t` is midday
const nightTz = t => (2 - new Date(t).getUTCHours()) * 60;               // … for which `t` is 2 a.m.
const nudge = (o = {}) => ({ rid: "lesson-2026-09-26-3-Wed", kind: "lesson", view: "session", args: [3, "Wed"], title: "Week 3 is ready", body: "🎤 Clear updates — 25 minutes today moves you forward.", reason: "lesson_pending", priority: 70, sendAfter: Date.now(), expiresAt: Date.now() + 20 * H, ...o });
const put = (id, token, o, tz) => call("/nudge", { id, rec: nudge(o), tz: tz ?? noonTz(Date.now()) }, token);

console.log("\n# the server decides who may receive a General English nudge — from the ACCOUNT");
{
  await subscribe("phone-ge-01"); await subscribe("phone-wd-01"); await subscribe("phone-xx-01");
  let r = await put("phone-ge-01", "tok-ge");
  ok("S1 · General English account → 200, stored", r.status === 200 && r.json.rid === "lesson-2026-09-26-3-Wed" && !!(await SUBS.get("nudge:phone-ge-01")), JSON.stringify(r));
  r = await put("phone-wd-01", "tok-wd");
  ok("S2 · Welding account → 403 track, nothing stored", r.status === 403 && r.json.error === "track" && !(await SUBS.get("nudge:phone-wd-01")), JSON.stringify(r));
  r = await call("/nudge", { id: "phone-wd-01", rec: nudge(), tz: 0, track: "general-english", programme: "general-english" }, "tok-wd");
  ok("S3 · Welding claiming General English in the body → still 403 (the body is never the authority)", r.status === 403 && r.json.error === "track", JSON.stringify(r));
  r = await put("phone-xx-01", null);
  ok("S4 · no token → 403 unverified", r.status === 403 && r.json.error === "unverified", JSON.stringify(r));
  r = await put("phone-xx-01", "tok-forged");
  ok("S5 · a token the partner Worker rejects → 403 unverified", r.status === 403 && r.json.error === "unverified", JSON.stringify(r));
  r = await put("phone-xx-01", "tok-down");
  ok("S6 · the partner Worker unreachable → 403 unverified (fails closed)", r.status === 403, JSON.stringify(r));
  PROGRAMME["tok-sw"] = "general-english"; await subscribe("phone-sw-01"); await put("phone-sw-01", "tok-sw");
  PROGRAMME["tok-sw"] = "welding"; r = await put("phone-sw-01", "tok-sw");
  ok("S7 · the account moves to Welding: its next registration is refused AND the pending nudge is dropped", r.status === 403 && !(await SUBS.get("nudge:phone-sw-01")), JSON.stringify(r));
  r = await put("phone-none-01", "tok-ge");
  ok("S8 · a phone never subscribed → 404", r.status === 404, JSON.stringify(r));
  for (const [what, o] of [["unknown kind", { kind: "dating" }], ["unknown view", { view: "https://evil" }], ["already expired", { expiresAt: Date.now() - 1 }], ["no text", { title: "" }], ["bad rid", { rid: "x y" }]]) {
    const x = await put("phone-ge-01", "tok-ge", o); ok(`S9 · ${what} → 400`, x.status === 400, JSON.stringify(x));
  }
  const long = await put("phone-ge-01", "tok-ge", { expiresAt: Date.now() + 30 * D, title: "T".repeat(300), body: "<b>" + "B".repeat(400) });
  const kept = await SUBS.get("nudge:phone-ge-01", "json");
  ok("S10 · expiry capped at 36 h, text clipped (80 / 180) and stripped of markup", long.status === 200 && kept.expiresAt - Date.now() <= 36 * H + 1000 && kept.title.length === 80 && kept.body.length <= 180 && !/[<>]/.test(kept.body), JSON.stringify({ exp: kept.expiresAt - Date.now(), t: kept.title.length, b: kept.body.length }));
  await put("phone-ge-01", "tok-ge");   // back to the plain one
}

console.log("\n# delivery: when a nudge may go");
{
  kv.delete("nlog:phone-ge-01"); pushes.length = 0;
  const t0 = Date.now();
  let o = await runNudges(env, t0);
  ok("D1 · due, daytime, nothing sent before → delivered once, to that phone", o.sent === 1 && pushes.join() === "phone-ge-01", JSON.stringify({ o, pushes }));
  ok("D2 · the plain daily reminder is called off for today (done:<id>), so one notification a day at most", (await SUBS.get("done:phone-ge-01")) === new Date(t0).toISOString().slice(0, 10));
  let w = await call("/why?id=phone-ge-01", null, null, "GET");
  ok("D3 · the service worker learns what it is: kind nudge, the text, the deep link (view session, args 3/Wed)", w.json.kind === "nudge" && w.json.view === "session" && w.json.args[0] === 3 && w.json.args[1] === "Wed" && /Week 3/.test(w.json.title), JSON.stringify(w.json));
  w = await call("/why?id=phone-ge-01", null, null, "GET");
  ok("D4 · served once: asked again → the ordinary reminder", w.json.kind === "reminder", JSON.stringify(w.json));
  await put("phone-ge-01", "tok-ge", { rid: "words-2026-09-26-x", kind: "words", view: "practice", act: "study-due", args: [], expiresAt: Date.now() + 30 * H });
  o = await runNudges(env, t0 + 2 * H);
  ok("D5 · another nudge 2 h later is held (one per 20 h)", o.sent === 0 && o.held >= 1, JSON.stringify(o));
  o = await runNudges(env, t0 + 21 * H);
  ok("D6 · … and goes after 20 h", o.sent === 1, JSON.stringify(o));
  /* registered two days on (as the app would), due now, midday for the phone */
  const t2 = t0 + 43 * H;
  kv.set("nudge:phone-ge-01", { v: JSON.stringify({ ...nudge({ rid: "words-2026-09-28-x", kind: "words", view: "practice", act: "study-due", args: [] }), createdAt: t2, sendAfter: t2, expiresAt: t2 + 20 * H, tz: noonTz(t2) }), exp: 0 });
  o = await runNudges(env, t2);
  ok("D7 · the same kind again within 48 h is held", o.sent === 0 && o.held >= 1, JSON.stringify(o));
  await SUBS.delete("nudge:phone-ge-01");
}
{
  await subscribe("phone-q-01"); kv.delete("nlog:phone-q-01"); pushes.length = 0;
  await call("/nudge", { id: "phone-q-01", rec: nudge(), tz: nightTz(Date.now()) }, "tok-ge");
  let o = await runNudges(env, Date.now());
  ok("D8 · quiet hours (2 a.m. for this phone) → held, never sent at night", o.sent === 0 && !pushes.includes("phone-q-01"), JSON.stringify(o));
  await call("/nudge", { id: "phone-q-01", rec: nudge({ sendAfter: Date.now() + 5 * H }), tz: noonTz(Date.now()) }, "tok-ge");
  o = await runNudges(env, Date.now());
  ok("D9 · not yet due (sendAfter in 5 h) → held", o.sent === 0, JSON.stringify(o));
  o = await runNudges(env, Date.now() + 21 * H);
  ok("D10 · expired before it could go → dropped, never sent", o.sent === 0 && o.expired >= 1 && !(await SUBS.get("nudge:phone-q-01")) && !pushes.includes("phone-q-01"), JSON.stringify(o));
}
{
  await subscribe("phone-c-01"); pushes.length = 0;
  await put("phone-c-01", "tok-ge");
  const c = await call("/nudge/cancel", { id: "phone-c-01", rid: "lesson-2026-09-26-3-Wed" });
  const o = await runNudges(env, Date.now());
  ok("D11 · the learner did it first → cancelled, never sent (completed-action invalidation)", c.json.cancelled === true && !pushes.includes("phone-c-01"), JSON.stringify({ c, o }));
  await put("phone-c-01", "tok-ge"); await runNudges(env, Date.now());
  await call("/nudge/cancel", { id: "phone-c-01", rid: "lesson-2026-09-26-3-Wed" });
  const w = await call("/why?id=phone-c-01", null, null, "GET");
  ok("D12 · done after delivery but before the phone asked → the stale advice is voided (the phone shows the plain reminder)", w.json.kind === "reminder", JSON.stringify(w.json));
}
{
  await subscribe("phone-d-01"); pushes.length = 0;
  const x = await call("/nudge/dismiss", { id: "phone-d-01", kind: "lesson" });
  await put("phone-d-01", "tok-ge");
  let o = await runNudges(env, Date.now());
  ok("D13 · a swiped-away kind rests: the same kind within 7 days is held", x.status === 200 && o.sent === 0 && !pushes.includes("phone-d-01"), JSON.stringify(o));
  await put("phone-d-01", "tok-ge", { rid: "words-2026-09-26-y", kind: "words", view: "practice", act: "study-due", args: [] });
  o = await runNudges(env, Date.now());
  ok("D14 · … another kind may still go", pushes.includes("phone-d-01"), JSON.stringify({ o, pushes }));
}
{
  await subscribe("phone-w-01"); kv.delete("nlog:phone-w-01"); pushes.length = 0;
  const kinds = ["lesson", "words", "challenge", "shadow", "ai_coach"], t0 = Date.now();
  let sent = 0;
  for (let i = 0; i < kinds.length; i++) {
    const at = t0 + i * 21 * H;
    kv.set("nudge:phone-w-01", { v: JSON.stringify({ ...nudge({ rid: kinds[i] + "-r" + i, kind: kinds[i], view: kinds[i] === "words" ? "practice" : kinds[i] === "lesson" ? "session" : kinds[i] === "ai_coach" ? "partner" : "shadow" }), createdAt: at, sendAfter: at, expiresAt: at + 20 * H, tz: noonTz(at) }), exp: 0 });
    sent += (await runNudges(env, at)).sent;
  }
  ok("D15 · at most 4 nudges in 7 days, even when each is 21 h apart and a different kind", sent === 4, "sent " + sent);
}
{
  await subscribe("phone-r-01"); kv.delete("nlog:phone-r-01");
  await put("phone-r-01", "tok-ge"); await runNudges(env, Date.now()); pushes.length = 0;
  kv.set("nudge:phone-r-01", { v: JSON.stringify({ ...nudge(), createdAt: Date.now(), tz: noonTz(Date.now() + 49 * H), sendAfter: Date.now(), expiresAt: Date.now() + 60 * H }), exp: 0 });
  const o = await runNudges(env, Date.now() + 49 * H);
  ok("D16 · the same recommendation (rid) is never delivered twice", !pushes.includes("phone-r-01") && o.expired >= 1, JSON.stringify(o));
  await put("phone-r-01", "tok-ge", { rid: "shadow-2026-09-26-x", kind: "shadow", view: "shadow", act: "trouble", args: [] });
  const r = await put("phone-r-01", "tok-ge", { rid: "words-2026-09-26-z", kind: "words", view: "practice", act: "study-due", args: [] });
  ok("D17 · one pending nudge per phone: a newer one replaces it and says so", r.json.previous && r.json.previous.rid === "shadow-2026-09-26-x" && r.json.previous.status === "replaced" && (await SUBS.get("nudge:phone-r-01", "json")).rid === "words-2026-09-26-z", JSON.stringify(r.json));
}
{
  const r = await worker.fetch(new Request("https://be-push.test/nudge", { method: "OPTIONS", headers: { origin: ORIGIN } }), env, {});
  ok("X1 · CORS lets the app send its token (Authorization allowed)", /Authorization/.test(r.headers.get("access-control-allow-headers") || ""));
  const x = await worker.fetch(new Request("https://be-push.test/nudge", { method: "POST", headers: { origin: "https://evil.example", authorization: "Bearer tok-ge", "content-type": "application/json" }, body: JSON.stringify({ id: "phone-ge-01", rec: nudge() }) }), env, {});
  ok("X2 · another web origin → 403 before anything else", x.status === 403);
}
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
