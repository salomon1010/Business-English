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
     mark:slot:<HHMM>      → time last confirmed   "a reminder may be booked at
     mark:pres, mark:nudge                          this minute / an alert phone /
                                                    a pending nudge" (KV LIST budget
                                                    below); a marker only ever says
                                                    "look", never "send"

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
  "https://staging.lomonec.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

const VAPID_SUBJECT = "mailto:contact@lomonec.com";
const MAX_PER_CRON  = 900;   // safety valve: one minute cannot fan out forever
/* Online alerts (owner, 2026-09-19): every 10 minutes (the second cron trigger)
   asks the partner Worker's /presence (behind PUSH_SECRET) for the number of General
   English learners online; when it is ≥ 1, phones that asked for these alerts
   ("pres:" entries) are woken — at most once per PRES_GAP_SEC each, never
   between PRES_QUIET_FROM and PRES_QUIET_TO local hours (the phone sends its
   UTC offset). The wake-up is bare like the reminder; the answer to "why?"
   is parked under why:<id> for the service worker to read. */
const PRES_GAP_SEC    = 4 * 60 * 60;
const PRES_QUIET_FROM = 22, PRES_QUIET_TO = 8;
const PRES_WHY_TTL    = 15 * 60;
const JWT_TTL_SEC   = 3 * 60 * 60;
/* Invitation wake-ups (owner, 2026-09-26): the partner Worker asks, behind
   PUSH_SECRET, for ONE phone to be woken when someone invites its learner to
   a recorded practice ("trial") or a live call ("live"). The push is bare
   like the others; the kind and the host's first name wait under why:<id>
   for the service worker, which rings like a phone. A phone is woken at most
   once per WAKE_GAP_SEC, and a wake older than WAKE_WHY_TTL is not shown —
   the invitation itself has expired by then. */
const WAKE_KINDS = new Set(["live", "trial"]);
const WAKE_GAP_SEC = 20, WAKE_WHY_TTL = 10 * 60;

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",   // Authorization: /nudge carries the learner's Firebase token
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
function validEndpoint(u, env){
  let p;
  try { p = new URL(u); } catch (e) { return false; }
  if (env && env.DEV_LOCAL_ENDPOINTS === "1" && p.protocol === "http:" && p.hostname === "127.0.0.1") return u.length < 1000;   // the local test suite's fake push service only
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
async function sendOne(env, rec, audCache, urgent){
  const origin = new URL(rec.endpoint).origin;
  if (!audCache[origin]) audCache[origin] = await vapidHeader(env, origin);
  const res = await fetch(rec.endpoint, {
    method: "POST",
    headers: {
      "Authorization": audCache[origin],
      "TTL": urgent ? String(WAKE_WHY_TTL) : "3600",   // an old reminder or invitation helps no one; expire it
      "Content-Length": "0",
      "Urgency": urgent ? "high" : "normal",           // a call wakes a dozing phone now, not at its next batch
    },
  });
  if (res.status === 404 || res.status === 410) return "gone";
  return res.ok ? "sent" : "fail:" + res.status;
}

/* Every row keyed by this phone's id goes: the send lists, the subscription, and
   (29 Sep 2026) the pending nudge, its delivery log, today's done mark and the
   parked "why" answers — nothing waits for a TTL after an unsubscribe or a 410.
   Markers (mark:*) are shared by prefix and are retired by the empty-LIST rule. */
async function forget(env, id, slot){
  if (slot) await env.SUBS.delete(`slot:${slot}:${id}`);
  for (const k of ["pres", "sub", "nudge", "nlog", "done", "why", "plast", "wlast"]) await env.SUBS.delete(`${k}:${id}`);
}

/* ------------------------------------------------------- KV LIST budget -- */
/* Workers KV allows 1,000 LIST operations a day on the free plan (29 Sep 2026:
   the account hit it). The crons used to LIST on every run, even with nothing
   to find — runCron alone listed its minute 1,440 times a day, almost always
   an empty prefix. Now each prefix a cron reads has a MARKER key, written by
   the route that adds a row there (subscribe → mark:slot:<HHMM> / mark:pres,
   /nudge → mark:nudge). A cron GETs the marker (100,000 reads a day) and
   LISTs only when it is there. The rows (slot:, pres:, nudge:) stay the
   truth: a marker only ever says "look".

   Race safety without transactions. A route re-confirms a marker older than
   MARK_REFRESH; a cron deletes one only when its LIST came back EMPTY and the
   marker is older than MARK_GRACE. MARK_GRACE is far longer than MARK_REFRESH
   plus KV's ~60 s propagation, so a marker whose row was written in the last
   hour can never be cleared by a LIST that has not seen that row yet. Two
   runs at once write the same value or delete an already-stale marker —
   idempotent either way. Deleting a row (forget, unsubscribe, a sent nudge)
   never touches a marker; the empty-LIST rule retires it later.

   Migration. Rows written before markers existed have none. Until
   meta:marks-v1 reads "done", runCron walks the old rows one page per minute
   (slot:, then pres:, then nudge:) writing their markers, and every cron
   keeps LISTing exactly as before — nobody misses a reminder during the
   switch. A one-off cost of one LIST per MARK_PAGE rows. */
const MARK_REFRESH = 60 * 60_000, MARK_GRACE = 36 * 60 * 60_000, MARK_PAGE = 200;
const MIG_KEY = "meta:marks-v1", MIG_PREFIXES = ["slot:", "pres:", "nudge:"];
const markSlot = slot => `mark:slot:${slot}`;
let _marksDone = false;   // per isolate: once "done" is read it stays done

/* a route added a row under this marker's prefix: confirm it, at most hourly
   (every launch re-subscribes, and KV allows 1,000 writes a day) */
async function markSeen(env, key, now){
  const at = Number(await env.SUBS.get(key)) || 0;
  if (now - at >= MARK_REFRESH) await env.SUBS.put(key, String(now));
}
/* the LIST under this marker found nothing: retire it once it is old enough */
async function markEmpty(env, key, now){
  const at = Number(await env.SUBS.get(key)) || 0;
  if (at && now - at > MARK_GRACE) await env.SUBS.delete(key);
}
async function marksMigrated(env){
  if (_marksDone) return true;
  _marksDone = (await env.SUBS.get(MIG_KEY)) === "done";
  return _marksDone;
}
/* one page of the migration; true once every old row has its marker */
async function migrateMarks(env, now){
  const raw = await env.SUBS.get(MIG_KEY);
  if (raw === "done") return (_marksDone = true);
  let st = null; try { st = JSON.parse(raw || "null"); } catch (e) {}
  if (!st || !Number.isInteger(st.p) || st.p < 0 || st.p >= MIG_PREFIXES.length) st = { p: 0, c: null };
  const prefix = MIG_PREFIXES[st.p];
  const page = await env.SUBS.list(st.c ? { prefix, cursor: st.c, limit: MARK_PAGE } : { prefix, limit: MARK_PAGE });
  const marks = new Set();
  for (const k of page.keys) {
    if (prefix === "slot:") { const m = /^slot:(\d{4}):/.exec(k.name); if (m) marks.add(markSlot(m[1])); }
    else marks.add(prefix === "pres:" ? "mark:pres" : "mark:nudge");
  }
  for (const key of marks) await env.SUBS.put(key, String(now));
  st = page.list_complete ? { p: st.p + 1, c: null } : { p: st.p, c: page.cursor };
  if (st.p >= MIG_PREFIXES.length) { await env.SUBS.put(MIG_KEY, "done"); console.log(JSON.stringify({ marks: "migrated" })); return (_marksDone = true); }
  await env.SUBS.put(MIG_KEY, JSON.stringify(st));
  return false;
}

/* ---------------------------------------------------------- online alerts -- */

function localHour(tzMin, now){ return ((now.getUTCHours() * 60 + now.getUTCMinutes() + tzMin) / 60 + 48) % 24; }
function quietNow(tzMin, now){ const h = localHour(tzMin, now); return h >= PRES_QUIET_FROM || h < PRES_QUIET_TO; }

async function runPresence(env, now){
  if (!env.PARTNER_API) return;
  let p = null;
  /* /presence is General English partner availability: the partner Worker
     answers it only to a signed-in General English account or to this Worker,
     behind the secret the two already share for invitations. No secret = no
     count = no alerts (never a guess). */
  if (!env.PUSH_SECRET) { console.log(JSON.stringify({ presence: "no_secret" })); return; }
  /* nobody asked for alerts: no count to fetch, no LIST (KV LIST budget) */
  const migrating = !(await marksMigrated(env));
  if (!migrating && !(await env.SUBS.get("mark:pres"))) { console.log(JSON.stringify({ presence: "no_subscribers" })); return; }
  try { const r = await fetch(env.PARTNER_API + "/presence", { headers: { "accept": "application/json", "x-push-secret": env.PUSH_SECRET } }); if (r.ok) p = await r.json(); } catch (e) {}
  const online = p && Number(p.online) || 0, waiting = p && Number(p.waiting) || 0;
  if (online < 1) { console.log(JSON.stringify({ presence: "none" })); return; }
  const audCache = {};
  let cursor, scanned = 0, sent = 0, quiet = 0, recent = 0, dropped = 0, listed = 0;
  do {
    const page = await env.SUBS.list(cursor ? { prefix: "pres:", cursor } : { prefix: "pres:" });
    listed += page.keys.length;
    for (const k of page.keys) {
      if (scanned >= MAX_PER_CRON) break;
      scanned++;
      const rec = await env.SUBS.get(k.name, "json");
      if (!rec || !rec.endpoint) continue;
      if (quietNow(rec.tz || 0, now)) { quiet++; continue; }
      if (await env.SUBS.get(`plast:${rec.id}`)) { recent++; continue; }
      let out; try { out = await sendOne(env, rec, audCache); } catch (e) { out = "fail:throw"; }
      if (out === "sent") {
        sent++;
        await env.SUBS.put(`why:${rec.id}`, JSON.stringify({ kind: "presence", n: online, waiting, at: Date.now() }), { expirationTtl: PRES_WHY_TTL });
        await env.SUBS.put(`plast:${rec.id}`, "1", { expirationTtl: PRES_GAP_SEC });
      } else if (out === "gone") { await forget(env, rec.id, rec.slot); dropped++; }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor && scanned < MAX_PER_CRON);
  if (!listed) await markEmpty(env, "mark:pres", now.getTime());
  console.log(JSON.stringify({ presence: online, waiting, scanned, sent, quiet, recent, dropped }));
}

/* -------------------------------------------------- personalised nudges -- */
/* Personalised Learning Nudges (26 Sep 2026) — General English only.
   The app's NudgeEngine picks the learner's best next action; this Worker
   decides WHETHER and WHEN it may be shown:
     POST /nudge          {id, rec, tz} + Authorization: Bearer <Firebase ID token>
                          → the partner Worker's /programme must answer
                            general-english for that account (the one
                            account-based authority; no second auth system),
                            otherwise 403 and any pending nudge is dropped.
                          One pending nudge per phone; a newer one replaces it.
     POST /nudge/cancel   {id, rid?}  the learner already did it → never sent
     POST /nudge/dismiss  {id, kind}  swiped away → that kind rests 7 days
     cron (every 10 min)  delivers when due: never in quiet hours, at most one
                          nudge per 20 h and 4 per 7 days per phone, the same
                          kind at most every 48 h, never after it expires, the
                          same rid never twice. Sending one marks the phone done
                          for today, so the plain daily reminder stays quiet —
                          one notification a day at most.
   The wording is the app's (fixed i18n templates filled with the learner's own
   numbers); this Worker only checks its shape and length. */
const NUDGE_KINDS = new Set(["lesson", "comeback", "words", "challenge", "shadow", "partner_now", "partner_streak", "ai_coach"]);
const NUDGE_VIEWS = new Set(["session", "practice", "shadow", "partner"]);
const NUDGE_ACTS = new Set(["study-due", "clip", "trouble", "match", "ai"]);
const NUDGE_GAP = 20 * 3600_000, NUDGE_WEEK_MAX = 4, NUDGE_KIND_GAP = 48 * 3600_000, NUDGE_DISMISS_GAP = 7 * 86400_000, NUDGE_MAX_LIFE = 36 * 3600_000;
const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n) : "");
function cleanNudge(r, now){
  if (!r || typeof r !== "object" || !NUDGE_KINDS.has(r.kind) || !NUDGE_VIEWS.has(r.view)) return null;
  const rid = typeof r.rid === "string" && /^[A-Za-z0-9_-]{4,60}$/.test(r.rid) ? r.rid : null;
  const title = str(r.title, 80), body = str(r.body, 180);
  const expiresAt = Math.min(Number(r.expiresAt) || 0, now + NUDGE_MAX_LIFE);
  const sendAfter = Math.max(Number(r.sendAfter) || now, now);
  if (!rid || !title || !body || expiresAt <= now || sendAfter >= expiresAt) return null;
  const args = (Array.isArray(r.args) ? r.args : []).slice(0, 2).map(a => (typeof a === "number" ? a : str(String(a), 16)));
  return { rid, kind: r.kind, view: r.view, act: NUDGE_ACTS.has(r.act) ? r.act : null, args, title, body,
    reason: str(r.reason, 24), priority: Math.max(0, Math.min(100, Number(r.priority) || 0)), createdAt: now, sendAfter, expiresAt };
}
async function programmeOf(req, env){
  if (!env.PARTNER_API) return null;
  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+/.test(auth)) return null;
  try { const r = await fetch(env.PARTNER_API + "/programme", { headers: { authorization: auth } }); if (!r.ok) return null; const j = await r.json(); return j && typeof j.track === "string" ? j.track : null; }
  catch (e) { return null; }
}
async function nudgePut(req, env, origin){
  const b = await req.json().catch(() => null);
  const id = b && cleanId(b.id);
  if (!id) return json({ error: "bad id" }, 400, origin);
  const now = Date.now();
  const prev = await env.SUBS.get(`nudge:${id}`, "json");
  const previous = prev ? { rid: prev.rid, kind: prev.kind, status: now > prev.expiresAt ? "expired" : "replaced" } : null;
  const track = await programmeOf(req, env);
  if (track !== "general-english") {                                     // Welding, unverifiable, or no token: nothing is kept
    await env.SUBS.delete(`nudge:${id}`);
    return json({ error: track ? "track" : "unverified", previous }, 403, origin);
  }
  const sub = await env.SUBS.get(`sub:${id}`, "json");
  if (!sub || !sub.endpoint) return json({ error: "no phone", previous }, 404, origin);
  const rec = cleanNudge(b.rec, now);
  if (!rec) return json({ error: "bad nudge", previous }, 400, origin);
  rec.tz = Number.isFinite(+b.tz) ? Math.max(-840, Math.min(840, Math.round(+b.tz))) : (sub.tz || 0);
  await env.SUBS.put(`nudge:${id}`, JSON.stringify(rec), { expirationTtl: Math.max(60, Math.ceil((rec.expiresAt - now) / 1000)) });
  await markSeen(env, "mark:nudge", now);
  return json({ ok: true, rid: rec.rid, sendAfter: rec.sendAfter, expiresAt: rec.expiresAt, previous: previous && previous.rid !== rec.rid ? previous : null }, 200, origin);
}
async function nudgeCancel(req, env, origin){
  const b = await req.json().catch(() => null);
  const id = b && cleanId(b.id);
  if (!id) return json({ error: "bad id" }, 400, origin);
  const prev = await env.SUBS.get(`nudge:${id}`, "json");
  const hit = prev && (!b.rid || b.rid === prev.rid);
  if (hit) await env.SUBS.delete(`nudge:${id}`);
  /* shown but not yet read by the service worker: void that too */
  const w = await env.SUBS.get(`why:${id}`, "json");
  if (w && w.kind === "nudge" && (!b.rid || b.rid === w.rid)) await env.SUBS.delete(`why:${id}`);
  return json({ ok: true, cancelled: !!hit }, 200, origin);
}
async function nudgeLog(env, id){ return (await env.SUBS.get(`nlog:${id}`, "json")) || { sent: [], kinds: {}, dismissed: {}, rids: [] }; }
async function nudgeDismiss(req, env, origin){
  const b = await req.json().catch(() => null);
  const id = b && cleanId(b.id);
  if (!id || !NUDGE_KINDS.has(b.kind)) return json({ error: "bad request" }, 400, origin);
  const log = await nudgeLog(env, id); log.dismissed[b.kind] = Date.now();
  await env.SUBS.put(`nlog:${id}`, JSON.stringify(log), { expirationTtl: 30 * 86400 });
  return json({ ok: true }, 200, origin);
}
/* the limits: production defaults; a staging Worker may shorten the three
   gaps for device testing (NUDGE_GAP_MS, NUDGE_KIND_GAP_MS, NUDGE_WEEK_MAX in
   [env.staging] only — production's wrangler.toml sets none of them) */
function nudgeLimits(env){
  const n = (v, d) => (v != null && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  return { gap: n(env && env.NUDGE_GAP_MS, NUDGE_GAP), kindGap: n(env && env.NUDGE_KIND_GAP_MS, NUDGE_KIND_GAP), weekMax: n(env && env.NUDGE_WEEK_MAX, NUDGE_WEEK_MAX), dismissGap: NUDGE_DISMISS_GAP };
}
/* why this nudge may not go now (null = it may) */
function nudgeHold(rec, log, now, L){
  L = L || nudgeLimits(null);
  if (now >= rec.expiresAt) return "expired";
  if (now < rec.sendAfter) return "early";
  if (quietNow(rec.tz || 0, new Date(now))) return "quiet";
  const sent = (log.sent || []).filter(t => now - t < 7 * 86400_000);
  if (sent.length && now - Math.max(...sent) < L.gap) return "gap";
  if (sent.length >= L.weekMax) return "week";
  if (log.kinds && log.kinds[rec.kind] && now - log.kinds[rec.kind] < L.kindGap) return "kind";
  if (log.dismissed && log.dismissed[rec.kind] && now - log.dismissed[rec.kind] < L.dismissGap) return "dismissed";
  if ((log.rids || []).includes(rec.rid)) return "duplicate";
  return null;
}
async function runNudges(env, nowMs, onlyId){
  const now = nowMs || Date.now(), L = nudgeLimits(env);
  const audCache = {};
  let cursor, scanned = 0, sent = 0, held = 0, expired = 0, dropped = 0, last = null, listed = 0;
  /* KV LIST budget: the flush route knows its one key — a GET, not a LIST;
     the cron LISTs only while a nudge is pending somewhere (mark:nudge) */
  const direct = !!onlyId, migrating = !direct && !(await marksMigrated(env));
  if (!direct && !migrating && !(await env.SUBS.get("mark:nudge"))) { console.log(JSON.stringify({ nudges: 0, list: "skip" })); return { scanned, sent, held, expired, dropped, last }; }
  do {
    const page = direct
      ? { keys: (await env.SUBS.get(`nudge:${onlyId}`)) != null ? [{ name: `nudge:${onlyId}` }] : [], list_complete: true }
      : await env.SUBS.list(cursor ? { prefix: "nudge:", cursor } : { prefix: "nudge:" });
    listed += page.keys.length;
    for (const k of page.keys) {
      if (scanned >= MAX_PER_CRON) break;
      scanned++;
      const id = k.name.slice(6), rec = await env.SUBS.get(k.name, "json");
      if (!rec) continue;
      const log = await nudgeLog(env, id);
      if (onlyId && id !== onlyId) continue;
      const why = nudgeHold(rec, log, now, L);
      last = why || "sent";
      if (why === "expired" || why === "duplicate") { await env.SUBS.delete(k.name); expired++; continue; }
      if (why) { held++; continue; }
      const sub = await env.SUBS.get(`sub:${id}`, "json");
      if (!sub || !sub.endpoint) { await env.SUBS.delete(k.name); dropped++; continue; }
      let out; try { out = await sendOne(env, sub, audCache); } catch (e) { out = "fail:throw"; }
      if (out === "sent") {
        sent++;
        await env.SUBS.put(`why:${id}`, JSON.stringify({ kind: "nudge", rid: rec.rid, nkind: rec.kind, view: rec.view, act: rec.act, args: rec.args, title: rec.title, body: rec.body, createdAt: rec.createdAt, expiresAt: rec.expiresAt, at: now }),
          { expirationTtl: Math.max(60, Math.ceil((rec.expiresAt - now) / 1000)) });
        await env.SUBS.put(`done:${id}`, new Date(now).toISOString().slice(0, 10), { expirationTtl: 172800 });   // the plain reminder stays quiet today
        log.sent = [...(log.sent || []).filter(t => now - t < 7 * 86400_000), now];
        log.kinds = Object.assign({}, log.kinds, { [rec.kind]: now });
        log.rids = [...(log.rids || []), rec.rid].slice(-20);
        await env.SUBS.put(`nlog:${id}`, JSON.stringify(log), { expirationTtl: 30 * 86400 });
        await env.SUBS.delete(k.name);
      } else if (out === "gone") { await forget(env, id, sub.slot); await env.SUBS.delete(k.name); dropped++; }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor && scanned < MAX_PER_CRON);
  if (!direct && !listed) await markEmpty(env, "mark:nudge", now);
  console.log(JSON.stringify({ nudges: scanned, sent, held, expired, dropped }));
  return { scanned, sent, held, expired, dropped, last };
}

/* ------------------------------------------------------------------ routes -- */

async function subscribe(req, env, origin){
  const b = await req.json().catch(() => null);
  if (!b) return json({ error: "bad json" }, 400, origin);

  const id   = cleanId(b.id);
  const slot = b.slot == null ? null : cleanSlot(b.slot);   // null: online alerts only, no daily reminder
  const presence = b.presence === true, calls = b.calls === true;   // calls: invitations may wake this phone
  const nudges = b.nudges === true;   // learning nudges only (2026-09-26): a phone with no reminder may still want them
  const tz = Number.isFinite(+b.tz) ? Math.max(-840, Math.min(840, Math.round(+b.tz))) : 0;
  if (!id || (b.slot != null && !slot) || (!slot && !presence && !calls && !nudges)) return json({ error: "bad id or slot" }, 400, origin);
  if (!b.endpoint || !validEndpoint(b.endpoint, env)) {
    return json({ error: "bad endpoint" }, 400, origin);
  }

  // Moving the reminder time leaves a row in the old minute; clear it first or
  // the user gets reminded twice, once at each time they have ever chosen.
  const prev = await env.SUBS.get(`sub:${id}`, "json");
  if (prev && prev.slot && prev.slot !== slot) {
    await env.SUBS.delete(`slot:${prev.slot}:${id}`);
  }

  const rec = { id, slot, endpoint: b.endpoint, presence, calls, nudges, tz };
  if (slot) await env.SUBS.put(`slot:${slot}:${id}`, JSON.stringify(rec));
  if (presence) await env.SUBS.put(`pres:${id}`, JSON.stringify(rec));
  else await env.SUBS.delete(`pres:${id}`);
  await env.SUBS.put(`sub:${id}`, JSON.stringify(rec));
  const now = Date.now();
  if (slot) await markSeen(env, markSlot(slot), now);
  if (presence) await markSeen(env, "mark:pres", now);
  return json({ ok: true, slot, presence, calls, nudges }, 200, origin);
}

/* POST /wake {secret, id, kind, name, ref?} — from the partner Worker only.
   One push to one phone; the answer to "why?" is parked for the service
   worker and served once. 404 = that phone never registered (or was dropped),
   429 = rung a moment ago, 403 = not the partner Worker. */
async function wakeOne(req, env, origin){
  if (!env.PUSH_SECRET) return json({ error: "off" }, 503, origin);
  const b = await req.json().catch(() => null);
  if (!b || b.secret !== env.PUSH_SECRET) return json({ error: "forbidden" }, 403, origin);
  const id = cleanId(b.id), kind = WAKE_KINDS.has(b.kind) ? b.kind : null;
  const name = typeof b.name === "string" ? b.name.replace(/[<>\s]+/g, " ").trim().slice(0, 24) : "";
  const ref = typeof b.ref === "string" && /^[a-f0-9]{16}$/.test(b.ref) ? b.ref : null;
  if (!id || !kind) return json({ error: "bad request" }, 400, origin);
  const rec = await env.SUBS.get(`sub:${id}`, "json");
  if (!rec || !rec.endpoint || !rec.calls) return json({ error: "no phone" }, 404, origin);
  const last = Number(await env.SUBS.get(`wlast:${id}`)) || 0;   /* KV expiry cannot go under 60 s, so the gap is checked from the stored time */
  if (Date.now() - last < WAKE_GAP_SEC * 1000) return json({ error: "recent" }, 429, origin);
  let out; try { out = await sendOne(env, rec, {}, true); } catch (e) { out = "fail:throw"; }
  if (out === "sent") {
    await env.SUBS.put(`why:${id}`, JSON.stringify({ kind, name, ref, at: Date.now() }), { expirationTtl: WAKE_WHY_TTL });
    await env.SUBS.put(`wlast:${id}`, String(Date.now()), { expirationTtl: 60 });
  } else if (out === "gone") await forget(env, id, rec.slot);
  console.log(JSON.stringify({ wake: kind, out }));
  return json({ ok: out === "sent", out }, out === "sent" ? 200 : 502, origin);
}

// The service worker asks what a bare push was for. Public by id (an opaque
// random id the phone chose); the answer is two small numbers or "reminder".
async function why(req, env, origin){
  const id = cleanId(new URL(req.url).searchParams.get("id") || "");
  if (!id) return json({ error: "bad id" }, 400, origin);
  const w = await env.SUBS.get(`why:${id}`, "json");
  if (w && w.kind === "nudge") {       /* a learning nudge: served once; void once expired */
    await env.SUBS.delete(`why:${id}`);
    if (Date.now() < (w.expiresAt || 0)) return json({ kind: "nudge", rid: w.rid, nkind: w.nkind, view: w.view, act: w.act, args: w.args || [], title: w.title, body: w.body, createdAt: w.createdAt, expiresAt: w.expiresAt }, 200, origin);
    return json({ kind: "reminder" }, 200, origin);
  }
  if (w && WAKE_KINDS.has(w.kind)) {   /* an invitation: served once, so a later presence push cannot re-ring it */
    await env.SUBS.delete(`why:${id}`);
    if (Date.now() - (w.at || 0) < WAKE_WHY_TTL * 1000) return json({ kind: w.kind, name: w.name || "", ref: w.ref || null, at: w.at }, 200, origin);
    return json({ kind: "reminder" }, 200, origin);
  }
  if (w && Date.now() - (w.at || 0) < PRES_WHY_TTL * 1000) return json({ kind: "presence", n: w.n, waiting: w.waiting, at: w.at }, 200, origin);
  return json({ kind: "reminder" }, 200, origin);
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

async function runCron(env, nowMs){
  const now  = nowMs ? new Date(nowMs) : new Date();
  const slot = String(now.getUTCHours()).padStart(2, "0")
             + String(now.getUTCMinutes()).padStart(2, "0");
  const day  = todayUTC();

  // One JWT per push origin, reused across the whole run — signing per
  // subscriber would be the expensive part of a large fan-out.
  /* KV LIST budget: while old rows still lack markers, migrate one page and
     LIST as before; afterwards LIST only a minute someone booked */
  const migrating = !(await marksMigrated(env));
  if (migrating) { try { await migrateMarks(env, now.getTime()); } catch (e) { console.log(JSON.stringify({ marks: "migrate_failed" })); } }
  if (!migrating && !(await env.SUBS.get(markSlot(slot)))) return;   // nobody booked this minute: no LIST, no log line

  const audCache = {};
  let cursor, scanned = 0, sent = 0, skipped = 0, dropped = 0, listed = 0;
  do {
    const page = await env.SUBS.list(cursor ? { prefix: `slot:${slot}:`, cursor } : { prefix: `slot:${slot}:` });
    listed += page.keys.length;
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

  if (!listed) await markEmpty(env, markSlot(slot), now.getTime());
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
    if (req.method === "GET" && path === "/why") return why(req, env, origin);

    if (req.method !== "POST") return json({ error: "method" }, 405, origin);
    if (path === "/wake") return wakeOne(req, env, origin);   // server to server: the secret is the check, not the Origin
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: "origin" }, 403, origin);

    if (path === "/subscribe")   return subscribe(req, env, origin);
    if (path === "/unsubscribe") return unsubscribe(req, env, origin);
    if (path === "/done")        return done(req, env, origin);
    if (path === "/nudge")          return nudgePut(req, env, origin);
    if (path === "/nudge/cancel")   return nudgeCancel(req, env, origin);
    if (path === "/nudge/dismiss")  return nudgeDismiss(req, env, origin);
    /* staging only (NUDGE_FLUSH="1"): run the delivery rules for one phone
       now instead of at the next ten-minute tick — the same rules, so a
       held nudge stays held and says why */
    if (path === "/nudge/flush" && env.NUDGE_FLUSH === "1") {
      const b = await req.json().catch(() => null), id = b && cleanId(b.id);
      if (!id) return json({ error: "bad id" }, 400, origin);
      const o = await runNudges(env, Date.now(), id);
      return json({ ok: true, result: o.last || "none", sent: o.sent }, 200, origin);
    }
    return json({ error: "not found" }, 404, origin);
  },

  async scheduled(evt, env, ctx){
    /* two triggers: every minute = the daily reminders, every ten = online alerts */
    ctx.waitUntil(evt.cron && evt.cron.startsWith("*/10") ? Promise.all([runPresence(env, new Date()), runNudges(env)]) : runCron(env));
  },
};

/* for the in-process tests (test/nudge.mjs) */
/* only functions: the Workers runtime treats every named export of the entry
   module as a handler, and a plain constant stops the Worker from starting */
function marksConfig(){ return { MARK_REFRESH, MARK_GRACE, MARK_PAGE, MIG_KEY }; }
export { runNudges, nudgeHold, cleanNudge, nudgeLimits, runCron, runPresence, marksConfig };
