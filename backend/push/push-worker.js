/* ============================================================================
   BE Mastery — daily reminder push backend (Cloudflare Worker)
   ----------------------------------------------------------------------------
   The in-app reminder is a setTimeout, so it can only fire while the app is
   open — useless for a habit app, because the user who needs reminding is the
   one who has not opened it. This Worker sends a real Web Push instead, from a
   cron that runs every minute.

   WHAT IT DOES NOT SEND
   ---------------------
   The push carries NO payload. That is deliberate, not a shortcut:

     • An encrypted payload needs RFC 8291 (ECDH + HKDF + AES128GCM) hand-rolled
       here. A bare wake-up needs only a VAPID JWT, which WebCrypto signs
       natively. Far less code to get wrong.
     • Nothing about the user crosses the wire at send time. sw.js composes the
       notification text locally from a copy the app left in IndexedDB, already
       translated into the user's language.

   WHAT IT STORES (KV namespace SUBS)
   ----------------------------------
     slot:<HHMM-utc>:<id>  → {endpoint, keys, id}   the send list for one minute
     sub:<id>              → {slot, endpoint, ...}  so a re-register can delete
                                                    the row it used to occupy
     done:<id>             → "YYYY-MM-DD" (48h TTL) today's session is finished

   No name, no email, no progress, no recordings. `id` is a random string the
   client makes up; it is not tied to the Firebase account.

   THE SLOT TRICK
   --------------
   The client converts its local reminder time to UTC and registers into that
   minute's bucket. The cron reads only the current minute's bucket, so cost is
   flat no matter how many users exist. The client recomputes its slot on every
   launch, which is what keeps DST shifts and travel honest — no timezone
   database here.

   SKIPPING PEOPLE WHO ALREADY PRACTISED
   -------------------------------------
   markPracticed() pings /done. The cron skips anyone whose done: key is today,
   so a finished user is never woken at all. This matters beyond politeness:
   userVisibleOnly means every delivered push MUST show a notification, so the
   only way to stay silent is not to send.

   DEPLOY / SECRETS: see README.md in this folder.
   ============================================================================ */

const ALLOWED_ORIGINS = [
  "https://app.lomonec.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

const VAPID_SUBJECT = "mailto:contact@lomonec.com";
const MAX_PER_CRON  = 900;   // safety valve: one minute cannot fan out forever
const JWT_TTL_SEC   = 3 * 60 * 60;

/* ---------------------------------------------------------------- helpers -- */

const enc = new TextEncoder();

function b64url(bytes){
  let s = "";
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function cors(origin){
  const ok = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, origin){
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

// Reject anything that is not a plausible push endpoint, so this cannot be
// turned into a general-purpose request relay.
function validEndpoint(u){
  let p;
  try { p = new URL(u); } catch (e) { return false; }
  return p.protocol === "https:" && u.length < 1000;
}

function cleanId(v){
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : null;
}

function cleanSlot(v){
  return typeof v === "string" && /^([01]\d|2[0-3])[0-5]\d$/.test(v) ? v : null;
}

function todayUTC(){
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ VAPID -- */
/* The private key is stored as a JWK in the VAPID_PRIVATE_JWK secret. Import it
   once per isolate and reuse — the cron signs one JWT per push origin, not per
   subscriber, because `aud` is the origin and most subscribers share one. */

let _key = null;
async function signingKey(env){
  if (_key) return _key;
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  _key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  return _key;
}

async function vapidHeader(env, audience){
  const key = await signingKey(env);
  const head = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + JWT_TTL_SEC,
    sub: VAPID_SUBJECT,
  })));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + body)
  );
  // WebCrypto returns the raw r||s pair, which is exactly what JWS ES256 wants.
  return `vapid t=${head}.${body}.${b64url(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

/* A 410/404 from the push service means the browser threw the subscription
   away (app uninstalled, permission revoked). Drop the row rather than retry
   it every minute forever. */
async function sendOne(env, rec, audCache){
  const origin = new URL(rec.endpoint).origin;
  if (!audCache[origin]) audCache[origin] = await vapidHeader(env, origin);
  const res = await fetch(rec.endpoint, {
    method: "POST",
    headers: {
      "Authorization": audCache[origin],
      "TTL": "3600",              // an old reminder helps no one; expire it
      "Content-Length": "0",
      "Urgency": "normal",
    },
  });
  if (res.status === 404 || res.status === 410) return "gone";
  return res.ok ? "sent" : "fail:" + res.status;
}

async function forget(env, id, slot){
  await env.SUBS.delete(`slot:${slot}:${id}`);
  await env.SUBS.delete(`sub:${id}`);
}

/* ------------------------------------------------------------------ routes -- */

async function subscribe(req, env, origin){
  const b = await req.json().catch(() => null);
  if (!b) return json({ error: "bad json" }, 400, origin);

  const id   = cleanId(b.id);
  const slot = cleanSlot(b.slot);
  if (!id || !slot) return json({ error: "bad id or slot" }, 400, origin);
  if (!b.endpoint || !validEndpoint(b.endpoint)) {
    return json({ error: "bad endpoint" }, 400, origin);
  }

  // Moving the reminder time leaves a row in the old minute; clear it first or
  // the user gets reminded twice, once at each time they have ever chosen.
  const prev = await env.SUBS.get(`sub:${id}`, "json");
  if (prev && prev.slot && prev.slot !== slot) {
    await env.SUBS.delete(`slot:${prev.slot}:${id}`);
  }

  const rec = { id, slot, endpoint: b.endpoint };
  await env.SUBS.put(`slot:${slot}:${id}`, JSON.stringify(rec));
  await env.SUBS.put(`sub:${id}`, JSON.stringify(rec));
  return json({ ok: true, slot }, 200, origin);
}

async function unsubscribe(req, env, origin){
  const b = await req.json().catch(() => null);
  const id = b && cleanId(b.id);
  if (!id) return json({ error: "bad id" }, 400, origin);
  const prev = await env.SUBS.get(`sub:${id}`, "json");
  if (prev) await forget(env, id, prev.slot);
  return json({ ok: true }, 200, origin);
}

// Called by markPracticed(). Suppresses today's reminder for this device only.
async function done(req, env, origin){
  const b = await req.json().catch(() => null);
  const id = b && cleanId(b.id);
  if (!id) return json({ error: "bad id" }, 400, origin);
  await env.SUBS.put(`done:${id}`, todayUTC(), { expirationTtl: 172800 });
  return json({ ok: true }, 200, origin);
}

/* -------------------------------------------------------------------- cron -- */

async function runCron(env){
  const now  = new Date();
  const slot = String(now.getUTCHours()).padStart(2, "0")
             + String(now.getUTCMinutes()).padStart(2, "0");
  const day  = todayUTC();

  // One JWT per push origin, reused across the whole run — signing per
  // subscriber would be the expensive part of a large fan-out.
  const audCache = {};
  let cursor, scanned = 0, sent = 0, skipped = 0, dropped = 0;
  do {
    const page = await env.SUBS.list({ prefix: `slot:${slot}:`, cursor });
    for (const k of page.keys) {
      if (scanned >= MAX_PER_CRON) break;
      scanned++;
      const rec = await env.SUBS.get(k.name, "json");
      if (!rec || !rec.endpoint) continue;

      const fin = await env.SUBS.get(`done:${rec.id}`);
      if (fin === day) { skipped++; continue; }   // already practised today

      let out;
      try { out = await sendOne(env, rec, audCache); }
      catch (e) { out = "fail:throw"; }
      if (out === "sent") sent++;
      else if (out === "gone") { await forget(env, rec.id, slot); dropped++; }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor && scanned < MAX_PER_CRON);

  console.log(JSON.stringify({ slot, scanned, sent, skipped, dropped }));
}

/* ------------------------------------------------------------------ export -- */

export default {
  async fetch(req, env){
    const origin = req.headers.get("Origin") || "";
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    const path = new URL(req.url).pathname;

    // The public key is served rather than hard-coded in index.html, so
    // rotating the VAPID pair does not need a site deploy.
    if (req.method === "GET" && path === "/key") {
      return json({ key: env.VAPID_PUBLIC_KEY || "" }, 200, origin);
    }

    if (req.method !== "POST") return json({ error: "method" }, 405, origin);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: "origin" }, 403, origin);

    if (path === "/subscribe")   return subscribe(req, env, origin);
    if (path === "/unsubscribe") return unsubscribe(req, env, origin);
    if (path === "/done")        return done(req, env, origin);
    return json({ error: "not found" }, 404, origin);
  },

  async scheduled(evt, env, ctx){
    ctx.waitUntil(runCron(env));
  },
};
