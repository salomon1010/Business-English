/* ============================================================================
   BE Mastery — Practice Partner Worker (be-partner)
   ----------------------------------------------------------------------------
   Owns every piece of partner data: who consented, preferences, the waiting
   queue, candidate offers, practice sessions (pairs) and their voice turns
   (audio in R2, rows in D1), connections, cooldowns, reports, blocks, audit.
   Nothing of this lives in Firestore; the app's users/{uid} blob is untouched.

   GENERAL ENGLISH ONLY. TRACKS holds one id; a request for any other track is
   refused with 403 `track` before anything is written. The client hides the
   feature for other tracks too, but this line is the boundary.

   Identity is the Firebase Auth uid, taken from a verified ID token. A partner
   never learns a uid: candidates are addressed by short-lived opaque offer ids
   and sessions by pair ids, so there is nothing to enumerate.

   Product model (marketing/product/practice-partner/):
   - Match me: join the queue, get up to 3 candidates with a reason each
     (deterministic scoring, configurable weights, no score shown), Try
     practice → a 4-round trial session. Practice now: same, first candidate
     taken automatically; none → the client offers the AI coach and keeps the
     learner in the queue.
   - A session is 4 short voice turns (2 each, alternating). When both have
     spoken twice it is complete and each decides alone: practise together
     again or find someone else. Both "again" → a mutual connection (regular
     after two sessions); either "someone else" → the pair closes, a 14-day
     cooldown stops them being re-offered to each other, nobody has to explain.
   - No text channel exists. The transcript the coach made is SCREENED here
     for contact details before a turn is stored. Screening, not moderation.
   - Audio is never publicly addressable: GET /turns/:id/audio after a
     membership + block check only.
   - Two distinct reporters suspend a member for 30 days. A block closes the
     session and holds both ways until the person who placed it lifts it
     (/connection/unblock); the blocked side is never told either way.
   - History is the learner's own device record (S.ppHist in the app); this
     Worker forgets turns 14 days after a session closes. DELETE /history is
     the "clear my history" half that removes the caller's own recordings
     from closed sessions at once.
   - Reliability (completed / abandoned sessions, response latency) is an
     internal matching signal, never shown to anyone.
   - Live practice (Level 3): /live routes, LIVE_ENABLED="1" only where allowed;
     WebRTC audio peer to peer, signalling relayed as rows, nothing recorded.
   - Four-round review (2026-09-20; coach.model 2026-09-21 — the full
     answer the task expected, in the learner's own facts, in the named
     professional structure for that question type; spoken after the
     script): when a session is complete, POST
     /pairs/:id/review turns the learner's OWN four-round performance (both
     their turns, the per-word pronunciation evidence the app sent with them,
     the partner's turns as conversational context only) plus the DAY'S
     CURRICULUM CONTEXT the app sends (week, topic, objective, task, phrase
     bank) into one private lesson: what went well, what to improve, topic
     mastery by component, pronunciation, sentence patterns, natural English,
     topic vocabulary (must know / upgrade / next level), a voice-coach script,
     a polished version of the learner's own answer, five indicators with
     round-level evidence, the next practice plan. One row per (pair, uid),
     readable by that uid alone — the partner's review is never served to the
     other side. The AI call needs OPENAI_KEY (secret); REVIEW_STUB="1" (dev
     and tests) builds a deterministic review from the transcripts instead.
   - PARTNER_ENABLED != "1" → 503 `disabled` on everything but /health.
   - DEV_AUTH="1" (local wrangler env only) accepts X-Dev-User / X-Dev-Now so
     the whole flow runs locally with no Firebase account and a movable clock.
   ============================================================================ */

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const MAX_AUDIO_BYTES = 1_500_000, MAX_TURN_MS = 75_000, MAX_NAME = 24, MAX_TRANSCRIPT = 2000, MAX_WORDS_JSON = 8000;
const DAY = 86_400_000, SUSPEND_MS = 30 * DAY, PURGE_AFTER_CLOSE_MS = 14 * DAY, OFFER_TTL_MS = 30 * 60_000, COOLDOWN_MS = 14 * DAY;
const BANDS = ["fnd-1-7", "fnd-8-15", "w1-4", "w5-8", "w9-12"];
const TRACKS = new Set(["general-english"]);                       // the product boundary — see header
const GOALS = new Set(["casual", "workplace", "interview", "pronunciation", "daily", "fluency"]);
const MODES = new Set(["voice", "live", "either"]);
const AVAIL = new Set(["morning", "afternoon", "evening", "weekends"]);
const REASONS = new Set(["harassment", "contact_info", "not_english", "abuse", "other"]);
/* ---- limits. Two different things, deliberately kept apart:

   SAFETY_LIMITS are a PRODUCT rule with a day boundary: reporting and
   blocking are safety actions, and an account that fires dozens of them a day
   is the abuse, not the victim of one. These are the only caps a learner may
   be told about in terms of "today".

   There is NO daily cap on practising. A learner may join the queue, match,
   invite, run a session, get its review, decide, rematch and practise again
   as often as they like, with a human or with the AI coach (owner,
   2026-09-23 — an earlier build counted those routes per UTC day and surfaced
   the 429 as "You've reached today's limit", which was never a BE Mastery
   product rule). Abuse of the practice routes is held per MINUTE by
   burstLimited() and ipLimited(): nothing accumulates, and the honest answer
   is "try again shortly". Cost-bearing routes are additionally bounded by
   structure — /review needs a COMPLETED four-turn session and is served from
   the stored row on every repeat, so it cannot be farmed.  */
const SAFETY_LIMITS_DEFAULT = { report: 5, block: 20 };
/* per-environment overrides through the SAFETY_LIMITS var (JSON) — staging
   raises them so a day of device testing on one account can exercise the
   report and block paths repeatedly */
let _limitsEnv = null, SAFETY_LIMITS = { ...SAFETY_LIMITS_DEFAULT };
function applyLimits(env) { if (_limitsEnv === env) return; _limitsEnv = env; SAFETY_LIMITS = { ...SAFETY_LIMITS_DEFAULT }; try { const o = JSON.parse(env.SAFETY_LIMITS || "{}"); for (const k of Object.keys(SAFETY_LIMITS_DEFAULT)) if (Number.isFinite(o[k]) && o[k] > 0) SAFETY_LIMITS[k] = o[k]; } catch (e) {} }
const BURST_PER_MIN_DEFAULT = 60;   // per authenticated learner, per minute, on the action routes

/* live practice: an invitation waits 10 min, an accepted/active session may last 45 min from its last transition */
const LIVE_INVITE_MS = 10 * 60_000, LIVE_SESSION_MS = 45 * 60_000, LIVE_MAX_SIGNALS = 400;
const LIVE_OPEN = new Set(["invited", "accepted", "connecting", "active", "reconnecting"]);
const TRIAL_INVITE_MS = 10 * 60_000;   // a "Try a practice" invitation waits this long for the other learner
const LIVE_KINDS = new Set(["offer", "answer", "ice", "state", "round", "bye"]);
const IP_PER_MIN_DEFAULT = 300;   // two phones on one Wi-Fi polling a live call sit around 100/min together
/* soft-scoring weights; overridable per environment through MATCH_WEIGHTS (JSON) */
const WEIGHTS_DEFAULT = { level: 0.22, goal: 0.20, curriculum: 0.16, mode: 0.12, availability: 0.10, timezone: 0.08, topic: 0.05, reliability: 0.04, history: 0.03 };
const MIN_MATCH_SCORE = 0.35;   // ranking floor only — no longer a filter (owner: no compatibility gate)

/* ---- the transcript screen: anything that could move the conversation off
   the app. Deliberately broad; the cost of a false positive is one re-take. */
const SCREEN = [
  /(?:\+?\d[\s\-.()]*){7,}/,
  /[\w.+-]+@[\w-]+\.[\w.-]+/i,
  /https?:\/\/|www\.|\.(?:com|net|org|io|me|app|ly)\b/i,
  /(?:^|\s)@[a-z0-9_.]{3,}/i,
  /\b(?:whats?\s?app|telegram|instagram|insta|snap\s?chat|facebook|tik\s?tok|discord|signal|viber|imo|wechat|messenger)\b/i,
  /\b(?:my number|mon num[ée]ro|call me|appelle[- ]moi|add me|ajoute[- ]moi)\b/i,
];
function screenTranscript(text) { const t = String(text || ""); for (const re of SCREEN) if (re.test(t)) return false; return true; }

/* ---------------------------------------------------------------- helpers */
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const err = (status, code, detail) => json({ error: code, detail }, status);
const now = (req, env) => { if (env.DEV_AUTH === "1") { const h = req.headers.get("x-dev-now"); if (h && /^\d+$/.test(h)) return Number(h); } return Date.now(); };
const rid = () => { const b = new Uint8Array(8); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, "0")).join(""); };
const dayKey = ms => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const parseList = (v, allowed, max) => (Array.isArray(v) ? v : []).filter(x => allowed.has(x)).slice(0, max);
const jl = s => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const pairKey = (a, b) => (a < b ? [a, b] : [b, a]);

function cors(env, origin) {
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) ? origin : allowed[0] || "";
  return { "access-control-allow-origin": ok, "access-control-allow-methods": "GET,POST,DELETE,OPTIONS", "access-control-allow-headers": "authorization,content-type,x-dev-user,x-dev-now", "access-control-max-age": "86400", "vary": "origin" };
}
const ipHits = new Map();
function ipLimited(ip, env) {
  const limit = Number(env && env.IP_PER_MIN) || IP_PER_MIN_DEFAULT;
  const m = Math.floor(Date.now() / 60_000), k = ip + ":" + m;
  const n = (ipHits.get(k) || 0) + 1; ipHits.set(k, n);
  if (ipHits.size > 5000) for (const key of ipHits.keys()) { if (!key.endsWith(":" + m)) ipHits.delete(key); }
  return n > limit;
}
/* ---- per-LEARNER burst limiter: an abuse control, never a practice quota.
   It counts the action routes per MINUTE for one authenticated uid, so a
   script holding a valid token cannot hammer the Worker by rotating IPs past
   ipLimited(). It shares the `counters` table with the safety caps, which
   makes it exact across isolates and colos (the per-IP limiter above is
   in-memory and best effort; this one is not). Nothing carries over: the key
   changes every minute, the cron sweeps the old rows, and a learner who sees
   it is told to try again shortly, because that is the truth. The ceiling is
   far above any human — tapping Match me, inviting, deciding and starting
   sessions comes nowhere near it. */
const minKey = ms => new Date(ms).toISOString().slice(0, 16).replace(/[-:T]/g, "");
async function burstLimited(env, uid, ms) {
  const limit = Number(env && env.BURST_PER_MIN) || BURST_PER_MIN_DEFAULT;
  const key = `${uid}:burst:${minKey(ms)}`;
  await env.DB.prepare("INSERT INTO counters(key,n) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET n=n+1").bind(key).run();
  const r = await env.DB.prepare("SELECT n FROM counters WHERE key=?").bind(key).first();
  return (r ? r.n : 1) > limit;
}
async function bump(env, uid, route, ms) {
  const key = `${uid}:${route}:${dayKey(ms)}`;
  await env.DB.prepare("INSERT INTO counters(key,n) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET n=n+1").bind(key).run();
  const r = await env.DB.prepare("SELECT n FROM counters WHERE key=?").bind(key).first();
  return r ? r.n : 1;
}
/* audit rows carry ids and enum-like actions only — never audio, transcripts or names */
async function audit(env, ms, actor, action, target, pairId, meta) {
  await env.DB.prepare("INSERT INTO audit(id,ts,actor,action,target,pair_id,meta) VALUES(?,?,?,?,?,?,?)").bind(rid(), ms, actor, action, target || null, pairId || null, JSON.stringify(meta || {})).run();
}

/* ------------------------------------------------------------ auth (JWT) */
let jwksCache = { at: 0, keys: null };
async function fetchJwks(fetcher, force) {
  if (!force && jwksCache.keys && Date.now() - jwksCache.at < 3_600_000) return jwksCache.keys;
  const r = await fetcher(JWKS_URL); if (!r.ok) throw new Error("jwks " + r.status);
  const j = await r.json(); jwksCache = { at: Date.now(), keys: j.keys || [] }; return jwksCache.keys;
}
const b64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
export async function verifyIdToken(token, projectId, deps = {}) {
  const fetcher = deps.fetch || fetch, nowMs = deps.now || Date.now();
  const parts = String(token || "").split("."); if (parts.length !== 3) throw new Error("malformed");
  const header = JSON.parse(new TextDecoder().decode(b64u(parts[0]))), payload = JSON.parse(new TextDecoder().decode(b64u(parts[1])));
  if (header.alg !== "RS256" || !header.kid) throw new Error("alg");
  let keys = deps.keys || await fetchJwks(fetcher); let jwk = keys.find(k => k.kid === header.kid);
  /* Google rotates signing keys; an unknown kid on a cached set means "refetch once", not "reject" */
  if (!jwk && !deps.keys && nowMs - jwksCache.at > 60_000) { keys = await fetchJwks(fetcher, true); jwk = keys.find(k => k.kid === header.kid); }
  if (!jwk) throw new Error("kid");
  if (jwk.kty !== "RSA" || (jwk.alg && jwk.alg !== "RS256")) throw new Error("alg");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, b64u(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("signature");
  const sec = Math.floor(nowMs / 1000);
  if (payload.aud !== projectId) throw new Error("aud");
  if (payload.iss !== "https://securetoken.google.com/" + projectId) throw new Error("iss");
  if (!(payload.exp > sec)) throw new Error("expired");
  if (!(payload.iat <= sec + 300)) throw new Error("iat");
  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) throw new Error("sub");
  return payload.sub;
}
async function authUid(req, env) {
  if (env.DEV_AUTH === "1") { const dev = req.headers.get("x-dev-user"); if (dev && /^[a-z0-9_-]{1,64}$/i.test(dev)) return "dev:" + dev; }
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || ""); if (!m) return null;
  try { return await verifyIdToken(m[1], env.FIREBASE_PROJECT_ID); } catch (e) { return null; }
}

/* --------------------------------------------------------------- queries */
const q = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
const member = (env, uid) => q(env, "SELECT * FROM members WHERE uid=?", uid).first();
const activePair = (env, uid) => q(env, "SELECT * FROM pairs WHERE status='active' AND (uid_a=? OR uid_b=?) ORDER BY created_at DESC LIMIT 1", uid, uid).first();
async function blockedEither(env, a, b) { return !!(await q(env, "SELECT 1 AS x FROM blocks WHERE (by_uid=? AND about_uid=?) OR (by_uid=? AND about_uid=?) LIMIT 1", a, b, b, a).first()); }
async function cooled(env, a, b, ms) { const [x, y] = pairKey(a, b); const r = await q(env, "SELECT until FROM cooldowns WHERE a=? AND b=?", x, y).first(); return !!(r && r.until > ms); }
async function connection(env, a, b) { const [x, y] = pairKey(a, b); return q(env, "SELECT * FROM connections WHERE a=? AND b=?", x, y).first(); }
/* the card's opaque handle for a connection: derived, never stored, and only
   ever resolved against the CALLER's own connections — so it cannot name
   someone else's partnership */
async function connId(a, b) { const [x, y] = pairKey(a, b); const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x + "|" + y)); return [...new Uint8Array(d)].slice(0, 8).map(v => v.toString(16).padStart(2, "0")).join(""); }
async function myConnectionByCid(env, uid, cid) {
  const rows = (await q(env, "SELECT * FROM connections WHERE a=? OR b=?", uid, uid).all()).results || [];
  for (const c of rows) if ((await connId(c.a, c.b)) === cid) return c;
  return null;
}
const openLive = (env, uid) => q(env, "SELECT * FROM live_sessions WHERE (host=? OR guest=?) AND state IN ('invited','accepted','connecting','active','reconnecting') ORDER BY created_at DESC LIMIT 1", uid, uid).first();
async function liveClose(env, s, state, reason, ms) { await q(env, "UPDATE live_sessions SET state=?, end_reason=?, ended_at=?, updated_at=? WHERE id=? AND state IN ('invited','accepted','connecting','active','reconnecting')", state, reason, ms, ms, s.id).run(); }
/* STUN always; TURN only when the owner has put Cloudflare Calls TURN key
   credentials in the environment (short-lived creds minted per request, never
   a permanent secret to the client). Without TURN, two phones behind carrier
   NAT may fail to connect — documented, not hidden. */
async function iceServers(env) {
  const out = [{ urls: "stun:stun.cloudflare.com:3478" }];
  if (env.TURN_KEY_ID && env.TURN_KEY_TOKEN) {
    try {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate`, { method: "POST", headers: { authorization: "Bearer " + env.TURN_KEY_TOKEN, "content-type": "application/json" }, body: JSON.stringify({ ttl: 3600 }) });
      if (r.ok) { const j = await r.json(); if (j.iceServers) out.push(j.iceServers); }
    } catch (e) {}
  }
  return out;
}
/* Erase everything Practice Partner holds about one learner. Idempotent: a
   second call finds nothing and still answers ok. What stays, and why (this is
   also what privacy.html says): reports OTHER people filed about this learner
   and blocks OTHER people placed on them (their safety choices, keyed by an
   id that no longer resolves to anyone), and audit rows, which the cron drops
   after 90 days. The partner of an open session sees it end as "left". */
/* the learner's own recordings: every turn they sent (account deletion) or
   only those of sessions that are already closed ("clear my history" — an
   open session keeps its turns so the partner's thread does not lose half
   a conversation mid-way). Audio first, then the rows; a missing object is
   not an error. */
async function eraseTurns(env, uid, closedOnly) {
  const sql = closedOnly
    ? "SELECT t.id, t.audio_key FROM turns t JOIN pairs p ON p.id=t.pair_id WHERE t.from_uid=? AND p.status='closed'"
    : "SELECT id, audio_key FROM turns WHERE from_uid=?";
  const turns = (await q(env, sql, uid).all()).results || [];
  let audio = 0; for (const t of turns) { try { await env.AUDIO.delete(t.audio_key); audio++; } catch (e) {} }
  for (let i = 0; i < turns.length; i += 50) {   /* D1 caps bound parameters per statement */
    const ch = turns.slice(i, i + 50);
    await q(env, `DELETE FROM turns WHERE id IN (${ch.map(() => "?").join(",")})`, ...ch.map(t => t.id)).run();
  }
  return { turns: turns.length, audio };
}
async function eraseMember(env, uid, ms) {
  const p = await activePair(env, uid); if (p) await closePair(env, p, "left", ms, uid);
  const l = await openLive(env, uid); if (l) await liveClose(env, l, "ended", "left", ms);
  const { audio } = await eraseTurns(env, uid, false);
  await env.DB.batch([
    q(env, "DELETE FROM turns WHERE pair_id IN (SELECT id FROM pairs WHERE uid_a=? OR uid_b=?)", uid, uid),
    q(env, "DELETE FROM live_signals WHERE session_id IN (SELECT id FROM live_sessions WHERE host=? OR guest=?)", uid, uid),
    q(env, "DELETE FROM live_sessions WHERE host=? OR guest=?", uid, uid),
    q(env, "DELETE FROM pairs WHERE uid_a=? OR uid_b=?", uid, uid),
    q(env, "DELETE FROM interest WHERE uid=?", uid),
    q(env, "DELETE FROM offers WHERE for_uid=? OR cand_uid=?", uid, uid),
    q(env, "DELETE FROM connections WHERE a=? OR b=?", uid, uid),
    q(env, "DELETE FROM cooldowns WHERE a=? OR b=?", uid, uid),
    q(env, "DELETE FROM reports WHERE by_uid=?", uid),
    q(env, "DELETE FROM blocks WHERE by_uid=?", uid),
    q(env, "DELETE FROM counters WHERE key LIKE ?", uid + ":%"),
    q(env, "DELETE FROM reviews WHERE uid=?", uid),
    q(env, "DELETE FROM members WHERE uid=?", uid),
  ]);
  await audit(env, ms, uid, "account_deleted", null, null, { audio });
  return { ok: true, deleted: true, audio };
}
/* report and block are shared by the async thread and live practice */
async function doReport(env, uid, other, ctxId, reason, ms) {
  if (await bump(env, uid, "report", ms) > SAFETY_LIMITS.report) return err(429, "limit");
  await q(env, "INSERT OR IGNORE INTO reports(id,pair_id,by_uid,about_uid,reason,created_at) VALUES(?,?,?,?,?,?)", rid(), ctxId, uid, other, reason, ms).run();
  const n = (await q(env, "SELECT COUNT(DISTINCT by_uid) AS n FROM reports WHERE about_uid=?", other).first()).n;
  await q(env, "UPDATE members SET strikes=? WHERE uid=?", n, other).run();
  await audit(env, ms, uid, "reported", other, ctxId, { reason, strikes: n });
  if (n >= 2) {
    await q(env, "UPDATE members SET suspended_until=? WHERE uid=?", ms + SUSPEND_MS, other).run();
    await q(env, "DELETE FROM interest WHERE uid=?", other).run();
    const p = await activePair(env, other); if (p) await closePair(env, p, "suspended", ms);
    const l = await openLive(env, other); if (l) await liveClose(env, l, "ended", "suspended", ms);
    await audit(env, ms, "system", "suspended", other, ctxId, { days: 30 });
  }
  return null;
}
async function doBlock(env, uid, other, ms) {
  if (await bump(env, uid, "block", ms) > SAFETY_LIMITS.block) return err(429, "limit");
  const [x, y] = pairKey(uid, other);
  await env.DB.batch([
    q(env, "INSERT OR IGNORE INTO blocks(by_uid,about_uid,created_at) VALUES(?,?,?)", uid, other, ms),
    q(env, "INSERT INTO connections(a,b,state,sessions,created_at,updated_at) VALUES(?,?,'blocked',0,?,?) ON CONFLICT(a,b) DO UPDATE SET state='blocked', updated_at=excluded.updated_at", x, y, ms, ms),
  ]);
  const p = await activePair(env, uid); if (p && otherOf(p, uid) === other) await closePair(env, p, "blocked", ms, uid);
  await q(env, "UPDATE pairs SET status='closed', closed_reason='blocked', closed_at=?, closed_by=? WHERE status='invited' AND uid_a=? AND uid_b=?", ms, uid, x, y).run();
  const l = await openLive(env, uid); if (l && (l.host === other || l.guest === other)) await liveClose(env, l, "ended", "blocked", ms);
  return null;
}
async function closePair(env, pair, reason, ms, by) { await q(env, "UPDATE pairs SET status='closed', closed_reason=?, closed_at=?, closed_by=? WHERE id=? AND status='active'", reason, ms, by || null, pair.id).run(); }
const otherOf = (pair, uid) => (pair.uid_a === uid ? pair.uid_b : pair.uid_a);
const isMember = (pair, uid) => !!pair && (pair.uid_a === uid || pair.uid_b === uid);
const bandIdx = b => BANDS.indexOf(b);
const reliability = m => { const done = m.sessions_completed || 0, bad = m.sessions_abandoned || 0; return done + bad === 0 ? 0.6 : done / (done + bad); };

/* ------------------------------------------------------------- matching */
function weights(env) { try { return Object.assign({}, WEIGHTS_DEFAULT, JSON.parse(env.MATCH_WEIGHTS || "{}")); } catch (e) { return WEIGHTS_DEFAULT; } }
/* deterministic, explainable. me/c are interest rows joined with members. */
function score(me, mm, c, W, hist) {
  const r = [];
  const bd = Math.abs(bandIdx(me.band) - bandIdx(c.band));
  const level = bd === 0 ? 1 : bd === 1 ? 0.5 : 0;
  const g1 = jl(me.goals), g2 = jl(c.goals), sharedGoals = g1.filter(g => g2.includes(g));
  const goal = g1.length && g2.length ? (sharedGoals.length ? 1 : 0) : 0.5;
  const curriculum = me.prompt_week && c.prompt_week ? (me.prompt_week === c.prompt_week ? 1 : Math.abs(me.prompt_week - c.prompt_week) <= 1 ? 0.6 : 0.2) : (me.fnd_day && c.fnd_day ? 1 : 0.5);
  const mode = mm.mode === c.mode || mm.mode === "either" || c.mode === "either" ? 1 : 0;
  const a1 = jl(mm.avail), a2 = jl(c.avail), sharedAvail = a1.filter(a => a2.includes(a));
  const availability = a1.length && a2.length ? (sharedAvail.length ? 1 : 0) : 0.5;
  const tzd = Math.abs((mm.tz || 0) - (c.tz || 0));
  const timezone = tzd <= 1 ? 1 : tzd <= 3 ? 0.6 : tzd <= 6 ? 0.3 : 0;
  const topic = me.topic && c.topic ? (me.topic === c.topic ? 1 : 0) : 0.5;
  const rel = reliability(c);
  const history = hist ? 1 : 0;
  const s = W.level * level + W.goal * goal + W.curriculum * curriculum + W.mode * mode + W.availability * availability + W.timezone * timezone + W.topic * topic + W.reliability * rel + W.history * history;
  /* reasons: the strongest true facts, in plain words, max 2 */
  if (level === 1) r.push("same_level");
  if (curriculum === 1) r.push(me.prompt_week ? "same_lesson" : "same_stage");
  if (sharedGoals.length) r.push("goal:" + sharedGoals[0]);
  if (c.imode === "now") r.push("available_now");
  if (sharedAvail.length && r.length < 2) r.push("same_time:" + sharedAvail[0]);
  if (hist) r.unshift("practised_before");
  if (!r.length && level >= 0.5) r.push("similar_level");
  if (!r.length) r.push("in_line");
  return { score: s, reasons: r.slice(0, 2) };
}
/* hard filters, then scoring, then diversification (candidates offered
   often in the last day are pushed down so a small pool is not exhausted) */
async function candidates(env, uid, ms, limit = 3) {
  const mm = await member(env, uid);
  if (!mm) return [];
  /* not in line yet (the presence strip asks before a tap): score against a
     neutral row so the count is the same set a Match me would show */
  const me = (await q(env, "SELECT * FROM interest WHERE uid=?", uid).first()) || { uid, track: "general-english", band: null, lang: mm.lang, prompt_week: 0, fnd_day: 0, topic: null, goals: mm.goals, mode: "later", created_at: ms };
  /* whoever can be asked right now: everyone IN LINE on this track (a queue
     row younger than 7 days) plus everyone merely ONLINE on this track
     (consented, seen in the last 5 minutes, not in a session) — owner rule
     2026-09-19: "as soon as someone is available, Show me candidates shows
     them". An online member has no queue row, so their card is built from the
     member row (band unknown → ranked by the rest). members.track is what
     keeps a Welding member from ever appearing here. */
  const rows = (await q(env, `SELECT m.uid, COALESCE(i.track, m.track) AS track, i.band, COALESCE(i.lang, m.lang) AS lang, COALESCE(i.prompt_week, 0) AS prompt_week, COALESCE(i.fnd_day, 0) AS fnd_day,
      COALESCE(i.mode, 'later') AS imode, i.topic, COALESCE(i.goals, m.goals) AS goals, COALESCE(i.created_at, m.last_seen) AS created_at, (i.uid IS NOT NULL) AS in_line,
      m.gender, m.same_gender, m.suspended_until, m.opted_out, m.mode, m.avail, m.tz, m.sessions_completed, m.sessions_abandoned
    FROM members m LEFT JOIN interest i ON i.uid=m.uid AND i.created_at>?
    WHERE m.uid<>? AND m.adult=1 AND ((i.uid IS NOT NULL AND i.track=?) OR (i.uid IS NULL AND m.track=? AND m.last_seen>? AND m.last_seen<=?))
    ORDER BY in_line DESC, created_at ASC LIMIT 200`, ms - 7 * DAY, uid, me.track, me.track, ms - 5 * 60_000, ms + 60_000).all()).results || [];
  const W = weights(env), out = [];
  /* four set queries instead of five per row (this runs on every /me poll):
     who I have blocked / who blocked me, who is in an open session, my
     connections, my cooldowns, and how often each candidate was offered today */
  const blocked = new Set(((await q(env, "SELECT by_uid, about_uid FROM blocks WHERE by_uid=? OR about_uid=?", uid, uid).all()).results || []).map(r => (r.by_uid === uid ? r.about_uid : r.by_uid)));
  const busy = new Set(((await q(env, "SELECT uid_a, uid_b FROM pairs WHERE status='active'").all()).results || []).flatMap(r => [r.uid_a, r.uid_b]));
  const conns = new Map(((await q(env, "SELECT * FROM connections WHERE a=? OR b=?", uid, uid).all()).results || []).map(r => [r.a === uid ? r.b : r.a, r]));
  const cools = new Set(((await q(env, "SELECT a, b FROM cooldowns WHERE (a=? OR b=?) AND until>?", uid, uid, ms).all()).results || []).map(r => (r.a === uid ? r.b : r.a)));
  const exposures = new Map(((await q(env, "SELECT cand_uid, COUNT(*) AS n FROM offers WHERE created_at>? GROUP BY cand_uid", ms - DAY).all()).results || []).map(r => [r.cand_uid, r.n]));
  for (const c of rows) {
    if (!TRACKS.has(c.track)) continue;
    if (c.suspended_until && c.suspended_until > ms) continue;
    if (c.opted_out) continue;
    /* no compatibility gate (owner, 2026-09-19): anyone in line on this track
       can be asked; band, goals and the rest only order the cards. What stays
       is safety — suspension, opt-out, the same-gender preference, blocks, a
       cooldown after an ended pair — and "not already in a session". */
    if (mm.same_gender && (!mm.gender || c.gender !== mm.gender)) continue;
    if (c.same_gender && (!c.gender || c.gender !== mm.gender)) continue;
    if (blocked.has(c.uid)) continue;
    if (busy.has(c.uid)) continue;
    const conn = conns.get(c.uid) || null;
    if (conn && conn.state === "blocked") continue;
    /* someone you ended with or rematched away from is still online and still
       askable (owner, 2026-09-19: the strip must never count a learner the
       cards then hide) — they just sort last */
    const again = cools.has(c.uid) || (conn && (conn.state === "disconnected" || conn.state === "ended"));
    let { score: s, reasons } = score(me, mm, c, W, conn && conn.sessions > 0);
    if (again) s -= 1;
    if (!c.in_line) { s -= 0.5; reasons = ["online_now", ...reasons.filter(r => r !== "in_line")].slice(0, 2); }   /* people actually in line come first */
    const exposure = exposures.get(c.uid) || 0;
    out.push({ c, s: s - Math.min(0.15, exposure * 0.03), reasons });
  }
  out.sort((a, b) => b.s - a.s || a.c.created_at - b.c.created_at);
  return out.slice(0, limit);
}
async function offerCards(env, uid, ms, cands) {
  const cards = [];
  for (const { c, reasons } of cands) {
    const id = rid();
    await q(env, "INSERT INTO offers(id,for_uid,cand_uid,reasons,created_at,expires_at) VALUES(?,?,?,?,?,?)", id, uid, c.uid, JSON.stringify(reasons), ms, ms + OFFER_TTL_MS).run();
    const p = await member(env, c.uid);
    cards.push({ offer: id, name: p ? p.name : "?", band: c.band || null, inLine: !!c.in_line, goals: jl(c.goals).slice(0, 2), topic: c.topic || "", availability: c.imode === "now" ? "now" : "later", reasons, waitingMin: Math.max(0, Math.round((ms - c.created_at) / 60_000)) });
  }
  return cards;
}
/* pair two people atomically: both interest rows must still exist. In D1 a
   batch is one transaction, so two inviters racing for the same candidate
   cannot both win — the second sees fewer than two rows deleted. */
/* a trial is PROPOSED, not started: the host asks, the guest answers within
   TRIAL_INVITE_MS. Both stay in the queue meanwhile (and remain visible to
   others); acceptance is the atomic step that takes them both out. One
   open proposal per host→guest is enough: asking again returns it. */
const invitedPairFor = (env, uid, ms) => q(env, "SELECT * FROM pairs WHERE status='invited' AND host<>? AND (uid_a=? OR uid_b=?) AND invite_expires>? ORDER BY created_at DESC LIMIT 1", uid, uid, uid, ms).first();
const invitedPairBy = (env, uid, ms) => q(env, "SELECT * FROM pairs WHERE status='invited' AND host=? AND invite_expires>? ORDER BY created_at DESC LIMIT 1", uid, ms).first();
/* Wake the invitee's phone through be-push (owner, 2026-09-26) so a practice
   or live invitation rings with the app closed. Server to server, behind
   PUSH_SECRET; only the invitee's opaque push id, the kind and the host's
   first name travel. Fire-and-forget: an unreachable push service must never
   slow or fail the invitation itself. In dev the wakes are recorded for the
   tests (GET /__wakes) and still posted when PUSH_API is set. */
const devWakes = [];
async function wake(env, ctx, uid, kind, name, ref) {
  try {
    const m = await member(env, uid);
    const id = m && m.push_id; if (!id) return;
    const body = { id, kind, name: clean(name, 24), ref };
    if (env.DEV_AUTH === "1") devWakes.push({ uid, ...body, at: Date.now() });
    if (!env.PUSH_API || !env.PUSH_SECRET) return;
    const p = fetch(env.PUSH_API + "/wake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, secret: env.PUSH_SECRET }) }).catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
  } catch (e) {}
}
async function proposePair(env, uid, cand, ms, seed, live, ctx) {
  if (await activePair(env, uid) || await activePair(env, cand)) return null;
  const open = await q(env, "SELECT * FROM pairs WHERE status='invited' AND host=? AND (uid_a=? OR uid_b=?) AND invite_expires>? LIMIT 1", uid, cand, cand, ms).first();
  if (open) return open.id;
  const id = rid(), [x, y] = pairKey(uid, cand);
  await q(env, "INSERT INTO pairs(id,uid_a,uid_b,track,band,prompt_week,fnd_day,week_start,status,created_at,kind,rounds,prompt_json,host,invite_expires,live_wanted) VALUES(?,?,?,?,?,?,?,?,'invited',?,'trial',4,?,?,?,?)",
    id, x, y, seed.track, seed.band, seed.promptWeek, seed.fndDay, ms, ms, seed.promptJson || null, uid, ms + TRIAL_INVITE_MS, live ? 1 : 0).run();
  await audit(env, ms, uid, "trial_invited", cand, id, {});
  const host = await member(env, uid);
  await wake(env, ctx, cand, live ? "live" : "trial", host ? host.name : "", id);
  return id;
}
/* the guest said yes: both leave the queue, the pair goes active, any other
   open proposals involving either of them are closed as 'expired' */
async function acceptPair(env, pair, ms) {
  const a = pair.uid_a, b = pair.uid_b;
  if (await activePair(env, a) || await activePair(env, b)) { await q(env, "UPDATE pairs SET status='closed', closed_reason='expired', closed_at=? WHERE id=? AND status='invited'", ms, pair.id).run(); return false; }
  const res = await env.DB.batch([
    q(env, "UPDATE pairs SET status='active', week_start=?, created_at=? WHERE id=? AND status='invited'", ms, ms, pair.id),
    q(env, "DELETE FROM interest WHERE uid IN (?,?)", a, b),
    q(env, "UPDATE pairs SET status='closed', closed_reason='expired', closed_at=? WHERE status='invited' AND id<>? AND (uid_a IN (?,?) OR uid_b IN (?,?))", ms, pair.id, a, b, a, b),
    q(env, "DELETE FROM offers WHERE for_uid IN (?,?) OR cand_uid IN (?,?)", a, b, a, b),
  ]);
  if (!(res[0] && res[0].meta && res[0].meta.changes)) return false;
  const conn = await connection(env, a, b);
  /* two learners who are already partners and meet again through the queue
     get a regular session, not a second trial with a second vote (found on
     staging 2026-09-20: the proposal row is minted as 'trial' before anyone
     has looked at the connection) */
  const kind = conn && (conn.state === "mutual" || conn.state === "regular") ? "regular" : "trial";
  if (kind === "regular") await q(env, "UPDATE pairs SET kind='regular' WHERE id=?", pair.id).run();
  if (!conn) await q(env, "INSERT OR IGNORE INTO connections(a,b,state,sessions,created_at,updated_at) VALUES(?,?,'trial',0,?,?)", a, b, ms, ms).run();
  await audit(env, ms, pair.host === a ? b : a, "trial_accepted", pair.host, pair.id, {});
  await audit(env, ms, "system", "pair_created", null, pair.id, { kind });
  return true;
}
async function createPair(env, uid, cand, ms, seed) {
  const conn = await connection(env, uid, cand);
  const kind = conn && (conn.state === "mutual" || conn.state === "regular") ? "regular" : "trial";
  const id = rid();
  const [x, y] = pairKey(uid, cand);
  const res = await env.DB.batch([
    q(env, "DELETE FROM interest WHERE uid IN (?,?)", uid, cand),
    q(env, "INSERT INTO pairs(id,uid_a,uid_b,track,band,prompt_week,fnd_day,week_start,status,created_at,kind,rounds,prompt_json,host) VALUES(?,?,?,?,?,?,?,?,'active',?,?,4,?,?)",
      id, x, y, seed.track, seed.band, seed.promptWeek, seed.fndDay, ms, ms, kind, seed.promptJson || null, uid),
  ]);
  const deleted = res[0] && res[0].meta ? res[0].meta.changes : 0;
  if (deleted < 2) { await q(env, "DELETE FROM pairs WHERE id=?", id).run(); return null; }
  if (!conn) await q(env, "INSERT OR IGNORE INTO connections(a,b,state,sessions,created_at,updated_at) VALUES(?,?,'trial',0,?,?)", x, y, ms, ms).run();
  await q(env, "DELETE FROM offers WHERE for_uid IN (?,?) OR cand_uid IN (?,?)", uid, cand, uid, cand).run();
  await audit(env, ms, uid, "pair_created", cand, id, { kind });
  return id;
}
const seedFrom = (a, b, phrase) => ({
  track: a.track, band: a.band,
  promptWeek: Math.min(a.prompt_week || 99, b.prompt_week || 99) === 99 ? 0 : Math.min(a.prompt_week || 99, b.prompt_week || 99),
  fndDay: Math.min(a.fnd_day || 99, b.fnd_day || 99) === 99 ? 0 : Math.min(a.fnd_day || 99, b.fnd_day || 99),
  promptJson: phrase ? JSON.stringify({ phrase: clean(phrase, 160) }) : null,
});

/* ---------------------------------------------------------- the me view */
function roundsView(pair, turns, uid) {
  const mine = turns.filter(t => t.from_uid === uid).length, theirs = turns.length - mine;
  const per = Math.ceil(pair.rounds / 2);
  const total = turns.length, complete = !!pair.completed_at || total >= pair.rounds;
  /* alternate: you may lead by one turn at most */
  const myTurn = !complete && mine < per && mine <= theirs;
  return { round: Math.min(pair.rounds, total + 1), rounds: pair.rounds, mine, theirs, per, complete, myTurn, waiting: !complete && !myTurn };
}
async function meView(env, uid, ms) {
  const m = await member(env, uid);
  const out = { consented: !!m, name: m ? m.name : null, adult: !!(m && m.adult), suspendedUntil: m && m.suspended_until && m.suspended_until > ms ? m.suspended_until : null, serverNow: ms,
    prefs: m ? { goals: jl(m.goals), mode: m.mode, avail: jl(m.avail), tz: m.tz, gender: m.gender || "", sameGender: !!m.same_gender, optedOut: !!m.opted_out } : null };
  const waiting = m ? await q(env, "SELECT * FROM interest WHERE uid=?", uid).first() : null;
  if (waiting) {
    const c = await q(env, "SELECT COUNT(*) AS n FROM interest WHERE track=? AND band=?", waiting.track, waiting.band).first();
    /* how many compatible learners are in line right now (no offers minted — a
       count for the waiting card and the "someone is available" notice) */
    let available = 0; try { available = (await candidates(env, uid, ms, 300)).length; } catch (e) {}
    out.waiting = { track: waiting.track, band: waiting.band, mode: waiting.mode, since: waiting.created_at, count: c ? c.n : 1, available };
  }
  if (m) {
    /* presence: counts only, never a list. "online" = eligible learners on
       the General English track seen in the last 5 minutes or in the queue,
       band within one step, not me, not blocked/suspended/opted out;
       "waiting" = those of them in the queue. Stale queue rows (7 days) do
       not count. */
    try {
      const rows = (await q(env, `SELECT m.uid, i.band, i.created_at AS q_at FROM members m LEFT JOIN interest i ON i.uid=m.uid AND i.track='general-english' AND i.created_at>?
        WHERE m.uid<>? AND (m.suspended_until IS NULL OR m.suspended_until<=?) AND (m.opted_out=0 OR m.opted_out IS NULL) AND (i.uid IS NOT NULL OR m.last_seen>?) LIMIT 300`, ms - 7 * DAY, uid, ms, ms - 5 * 60_000).all()).results || [];
      let online = 0;
      for (const r of rows) {
        if (r.uid === uid) continue;
        if (await blockedEither(env, uid, r.uid)) continue;
        online++;
      }
      /* "waiting" is exactly the set the cards can show — same filter, same
         number — so the strip never promises someone the cards then hide */
      const waiting = out.waiting ? out.waiting.available : (await candidates(env, uid, ms, 300)).length;
      out.presence = { online, waiting };
      out.liveEnabled = env.LIVE_ENABLED === "1";   /* the client's single source of truth for the live buttons */
    } catch (e) { out.presence = { online: 0, waiting: 0 }; }
    await q(env, "UPDATE pairs SET status='closed', closed_reason='expired', closed_at=? WHERE status='invited' AND invite_expires<=? AND (uid_a=? OR uid_b=?)", ms, ms, uid, uid).run();
    const inv = await invitedPairFor(env, uid, ms);
    if (inv && !(await blockedEither(env, uid, inv.host))) { const p = await member(env, inv.host); let prompt = null; try { prompt = inv.prompt_json ? JSON.parse(inv.prompt_json) : null; } catch (e) {} out.invite = { id: inv.id, live: !!inv.live_wanted, partner: { name: p ? p.name : "?" }, band: inv.band, promptWeek: inv.prompt_week, fndDay: inv.fnd_day, prompt, expiresAt: inv.invite_expires, createdAt: inv.created_at }; }
    const mine = await invitedPairBy(env, uid, ms);
    if (mine) { const other = otherOf(mine, uid), p = await member(env, other); out.pairInvite = { id: mine.id, live: !!mine.live_wanted, partner: { name: p ? p.name : "?" }, expiresAt: mine.invite_expires, createdAt: mine.created_at }; }
  }
  const pair = m ? await activePair(env, uid) : null;
  if (pair) {
    const partnerUid = otherOf(pair, uid), p = await member(env, partnerUid);
    const turns = (await q(env, "SELECT id,from_uid,seq,mime,duration_ms,transcript,score,created_at FROM turns WHERE pair_id=? ORDER BY created_at", pair.id).all()).results || [];
    const seenMe = pair.uid_a === uid ? pair.seen_a : pair.seen_b;
    const myLast = [...turns].reverse().find(t => t.from_uid === uid), theirLast = [...turns].reverse().find(t => t.from_uid !== uid);
    const sinceMs = Math.max(myLast ? myLast.created_at : 0, pair.created_at);
    const silentMs = theirLast && theirLast.created_at > sinceMs ? 0 : ms - sinceMs;
    const timeoutH = Number(env.PARTNER_TIMEOUT_H || 24);
    const rv = roundsView(pair, turns, uid);
    const conn = await connection(env, uid, partnerUid);
    const myDecision = pair.uid_a === uid ? pair.decision_a : pair.decision_b;
    let prompt = null; try { prompt = pair.prompt_json ? JSON.parse(pair.prompt_json) : null; } catch (e) {}
    out.pair = {
      id: pair.id, kind: pair.kind, track: pair.track, band: pair.band, promptWeek: pair.prompt_week, fndDay: pair.fnd_day, prompt, startedAt: pair.created_at,
      partner: p ? { name: p.name, band: pair.band, lang: p.lang } : { name: "?", band: pair.band, lang: "en" },
      turns: turns.map(t => ({ id: t.id, mine: t.from_uid === uid, seq: t.seq, mime: t.mime, durationMs: t.duration_ms, transcript: t.transcript, score: t.score, at: t.created_at })),
      unread: turns.filter(t => t.from_uid !== uid && t.created_at > seenMe).length,
      ...rv, myDecision: myDecision || null, partnerDecided: !!(pair.uid_a === uid ? pair.decision_b : pair.decision_a),
      partnerSilentH: Math.floor(silentMs / 3_600_000), fallback: !rv.complete && rv.waiting && silentMs >= timeoutH * 3_600_000,
      canRepair: silentMs >= timeoutH * 3_600_000,
      connection: conn ? { state: conn.state, sessions: conn.sessions } : null,
    };
  } else if (m) {
    const last = await q(env, "SELECT id, uid_a, uid_b, closed_reason, closed_at, closed_by FROM pairs WHERE status='closed' AND (uid_a=? OR uid_b=?) ORDER BY closed_at DESC LIMIT 1", uid, uid).first();
    if (last && ms - last.closed_at < 3 * DAY) {
      const o = otherOf(last, uid), p = await member(env, o);
      const byOther = !!last.closed_by && last.closed_by !== uid;
      /* the blocked side is only ever told the partner left */
      const reason = last.closed_reason === "blocked" && byOther ? "left" : last.closed_reason;
      out.lastClosed = { id: last.id, reason, at: last.closed_at, byOther, name: p ? p.name : "?" };
    }
    const conns = (await q(env, "SELECT * FROM connections WHERE (a=? OR b=?) AND state IN ('mutual','regular') ORDER BY last_practice_at DESC LIMIT 1", uid, uid).all()).results || [];
    if (conns[0]) { const other = conns[0].a === uid ? conns[0].b : conns[0].a; const p = await member(env, other); if (p && !(await blockedEither(env, uid, other))) out.connection = { cid: await connId(conns[0].a, conns[0].b), name: p.name, state: conns[0].state, sessions: conns[0].sessions, lastPracticeAt: conns[0].last_practice_at, canStart: !(await activePair(env, other)), canLive: env.LIVE_ENABLED === "1" && !(await openLive(env, other)) }; }
  }
  /* the learners I blocked, so the app can offer to lift a block: first name
     (or "?" once that account is gone), the connection handle, when. Never
     the other direction — nobody learns who blocked them. */
  if (m) {
    const rows = (await q(env, "SELECT about_uid, created_at FROM blocks WHERE by_uid=? ORDER BY created_at DESC LIMIT 50", uid).all()).results || [];
    out.blocked = [];
    for (const r of rows) { const p = await member(env, r.about_uid); out.blocked.push({ cid: await connId(uid, r.about_uid), name: p ? p.name : "?", at: r.created_at }); }
  }
  /* an open live session (either role) rides along so the invitation card,
     the resume card and the notification all come from the same read */
  if (m && env.LIVE_ENABLED === "1") {
    const l = await openLive(env, uid);
    if (l && l.expires_at > ms) { const other = l.host === uid ? l.guest : l.host; const p = await member(env, other); if (!(await blockedEither(env, uid, other))) out.live = { id: l.id, role: l.host === uid ? "host" : "guest", state: l.state, partner: { name: p ? p.name : "?" }, createdAt: l.created_at, startedAt: l.started_at, expiresAt: l.expires_at }; }
  }
  return out;
}

/* ------------------------------------------------------------ handlers */
async function handle(req, env, ctx) {
  applyLimits(env);
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, "") || "/", ms = now(req, env);
  const ip = req.headers.get("cf-connecting-ip") || "0";
  if (ipLimited(ip, env)) return err(429, "ip_limit");
  if (path === "/health") return json({ ok: true, dev: env.DEV_AUTH === "1", enabled: env.PARTNER_ENABLED === "1" });
  /* Account deletion (Apple 5.1.1(v), Google Play account-deletion policy):
     the app's "Delete account" calls this before it deletes the Firebase user.
     It sits ABOVE the kill switch on purpose — a learner who took part in the
     pilot must be able to erase their data even after PARTNER_ENABLED="0". */
  if (req.method === "DELETE" && path === "/me") {
    const duid = await authUid(req, env); if (!duid) return err(401, "auth");
    return json(await eraseMember(env, duid, ms));
  }
  if (env.PARTNER_ENABLED !== "1") return err(503, "disabled");
  /* Public, counts only, no auth: the floating button's badge for a learner
     who has not signed in yet. Same "online" rule as /me's presence minus the
     per-person block filter (there is no "me" to filter against). Nothing
     personal leaves — two integers, cached 30 s at the edge. */
  if (req.method === "GET" && path === "/presence") {
    const fresh = ms - 7 * DAY;
    const o = await q(env, `SELECT COUNT(DISTINCT m.uid) AS n FROM members m LEFT JOIN interest i ON i.uid=m.uid AND i.track='general-english' AND i.created_at>?
      WHERE (m.suspended_until IS NULL OR m.suspended_until<=?) AND (m.opted_out=0 OR m.opted_out IS NULL) AND (i.uid IS NOT NULL OR m.last_seen>?)`, fresh, ms, ms - 5 * 60_000).first();
    const w = await q(env, "SELECT COUNT(DISTINCT uid) AS n FROM interest WHERE track='general-english' AND created_at>?", fresh).first();
    return new Response(JSON.stringify({ online: o ? o.n : 0, waiting: w ? w.n : 0 }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30" } });
  }
  if (req.method === "POST" && path === "/__reset" && env.DEV_AUTH === "1") {
    devWakes.length = 0;
    for (const t of ["turns", "pairs", "interest", "reports", "blocks", "counters", "members", "connections", "cooldowns", "offers", "audit", "live_signals", "live_sessions", "reviews"]) await q(env, `DELETE FROM ${t}`).run();
    let cursor; do { const l = await env.AUDIO.list({ cursor }); for (const o of l.objects) await env.AUDIO.delete(o.key); cursor = l.truncated ? l.cursor : null; } while (cursor);
    return json({ ok: true });
  }
  /* dev only (same guard): clear one learner's daily counters, so a long
     browser run can keep joining the queue without loosening the caps the
     Worker suite asserts */
  if (req.method === "GET" && path === "/__wakes" && env.DEV_AUTH === "1") return json({ wakes: devWakes });
  if (req.method === "POST" && path === "/__uncap" && env.DEV_AUTH === "1") {
    const b = await req.json().catch(() => ({})); if (typeof b.uid !== "string" || !b.uid) return err(400, "uid");
    await q(env, "DELETE FROM counters WHERE key LIKE ?", b.uid + ":%").run();
    return json({ ok: true });
  }

  const uid = await authUid(req, env);
  if (!uid) return err(401, "auth");
  const m = await member(env, uid);
  if (m && ms - m.last_seen > 60_000) await q(env, "UPDATE members SET last_seen=? WHERE uid=?", ms, uid).run();
  /* the phone's push id (the random id it registered with be-push), sent on
     /me as ?push=, so an invitation can wake THIS phone with the app closed.
     Two phones on one account: the one used last is the one rung. */
  const pid = url.searchParams.get("push");
  if (m && pid && /^[A-Za-z0-9_-]{8,64}$/.test(pid) && pid !== m.push_id) await q(env, "UPDATE members SET push_id=? WHERE uid=?", pid, uid).run();
  const suspended = m && m.suspended_until && m.suspended_until > ms;

  if (req.method === "GET" && path === "/me") return json(await meView(env, uid, ms));

  /* POST /consent {name, lang, adult, gender?, sameGender?, goals?, mode?, avail?, tz?} */
  if (req.method === "POST" && path === "/consent") {
    const b = await req.json().catch(() => ({}));
    if (b.adult !== true) return err(403, "age");
    const name = clean(b.name, MAX_NAME) || "Learner";
    const lang = /^[a-z]{2}$/.test(b.lang || "") ? b.lang : "en";
    const gender = ["f", "m", "x"].includes(b.gender) ? b.gender : null;
    const same = b.sameGender && gender ? 1 : 0;
    const goals = JSON.stringify(parseList(b.goals, GOALS, 3)), mode = MODES.has(b.mode) ? b.mode : "voice", avail = JSON.stringify(parseList(b.avail, AVAIL, 4));
    const tz = Math.max(-12, Math.min(14, Math.round(Number(b.tz) || 0)));
    /* the programme is optional here (older clients) but, when given, must be
       the one this Worker serves — it is what lets an online member be offered */
    if (b.track !== undefined && !TRACKS.has(b.track)) return err(403, "track");
    const track = TRACKS.has(b.track) ? b.track : (m && m.track) || null;
    if (m) await q(env, "UPDATE members SET name=?, lang=?, gender=?, same_gender=?, adult=1, goals=?, mode=?, avail=?, tz=?, last_seen=?, track=? WHERE uid=?", name, lang, gender, same, goals, mode, avail, tz, ms, track, uid).run();
    else await q(env, "INSERT INTO members(uid,name,lang,gender,same_gender,consent_at,created_at,last_seen,adult,goals,mode,avail,tz,track) VALUES(?,?,?,?,?,?,?,?,1,?,?,?,?,?)", uid, name, lang, gender, same, ms, ms, ms, goals, mode, avail, tz, track).run();
    await audit(env, ms, uid, m ? "prefs_updated" : "consented", null, null, {});
    return json(await meView(env, uid, ms));
  }
  if (!m) return err(403, "consent");

  /* POST /prefs — partial update of matching preferences; opting out leaves the queue */
  if (req.method === "POST" && path === "/prefs") {
    const b = await req.json().catch(() => ({}));
    const sets = [], vals = [];
    if ("goals" in b) { sets.push("goals=?"); vals.push(JSON.stringify(parseList(b.goals, GOALS, 3))); }
    if ("mode" in b && MODES.has(b.mode)) { sets.push("mode=?"); vals.push(b.mode); }
    if ("avail" in b) { sets.push("avail=?"); vals.push(JSON.stringify(parseList(b.avail, AVAIL, 4))); }
    if ("tz" in b) { sets.push("tz=?"); vals.push(Math.max(-12, Math.min(14, Math.round(Number(b.tz) || 0)))); }
    if ("gender" in b) { const g = ["f", "m", "x"].includes(b.gender) ? b.gender : null; sets.push("gender=?"); vals.push(g); if (!g) sets.push("same_gender=0"); }
    if ("sameGender" in b) { sets.push("same_gender=?"); vals.push(b.sameGender ? 1 : 0); }
    if ("optedOut" in b) { sets.push("opted_out=?"); vals.push(b.optedOut ? 1 : 0); if (b.optedOut) await q(env, "DELETE FROM interest WHERE uid=?", uid).run(); }
    if (sets.length) await q(env, `UPDATE members SET ${sets.join(",")} WHERE uid=?`, ...vals, uid).run();
    return json(await meView(env, uid, ms));
  }

  /* POST /interest {track, band, lang, promptWeek, fndDay, mode:'now'|'later', topic, goals, phrase?} — join the queue.
     mode 'now' takes the best candidate at once when there is one. */
  if (req.method === "POST" && path === "/interest") {
    if (suspended) return err(403, "suspended", m.suspended_until);
    if (m.opted_out) return err(403, "opted_out");
    if (await activePair(env, uid)) return err(409, "paired");
    const b = await req.json().catch(() => ({}));
    if (!TRACKS.has(b.track)) return err(403, "track");
    if (!BANDS.includes(b.band)) return err(400, "bad_request");
    if (await burstLimited(env, uid, ms)) return err(429, "rate");
    const lang = /^[a-z]{2}$/.test(b.lang || "") ? b.lang : m.lang;
    const pw = Math.max(0, Math.min(12, Number(b.promptWeek) || 0)), fd = Math.max(0, Math.min(15, Number(b.fndDay) || 0));
    const mode = b.mode === "now" ? "now" : "later", topic = clean(b.topic, 60);
    const gl = parseList(b.goals, GOALS, 3), goals = JSON.stringify(gl.length ? gl : jl(m.goals));
    await q(env, "UPDATE members SET track=? WHERE uid=?", b.track, uid).run();
    await q(env, "INSERT INTO interest(uid,track,band,lang,prompt_week,fnd_day,created_at,mode,topic,goals) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET track=excluded.track, band=excluded.band, lang=excluded.lang, prompt_week=excluded.prompt_week, fnd_day=excluded.fnd_day, mode=excluded.mode, topic=excluded.topic, goals=excluded.goals",
      uid, b.track, b.band, lang, pw, fd, ms, mode, topic, goals).run();
    await audit(env, ms, uid, "queue_joined", null, null, { mode });
    let pairId = null, cards = [];
    const cands = await candidates(env, uid, ms, 3);
    let invited = null;
    if (mode === "now" && cands.length) {
      const mine = await q(env, "SELECT * FROM interest WHERE uid=?", uid).first();
      invited = await proposePair(env, uid, cands[0].c.uid, ms, seedFrom(mine, cands[0].c, b.phrase), false, ctx);
    } else if (cands.length) cards = await offerCards(env, uid, ms, cands);
    return json({ status: invited ? "invited" : "waiting", candidates: cards, ...(await meView(env, uid, ms)) });
  }
  if (req.method === "DELETE" && path === "/interest") { await q(env, "DELETE FROM interest WHERE uid=?", uid).run(); return json(await meView(env, uid, ms)); }

  /* POST /match — up to 3 candidates for a learner in the queue, each with a reason. Opaque offer ids, never uids. */
  if (req.method === "POST" && path === "/match") {
    if (suspended) return err(403, "suspended", m.suspended_until);
    if (await activePair(env, uid)) return err(409, "paired");
    if (!(await q(env, "SELECT 1 AS x FROM interest WHERE uid=?", uid).first())) return err(409, "not_waiting");
    if (await burstLimited(env, uid, ms)) return err(429, "rate");
    const cards = await offerCards(env, uid, ms, await candidates(env, uid, ms, 3));
    return json({ candidates: cards, ...(await meView(env, uid, ms)) });
  }

  /* POST /invite {offer, phrase?} — try a practice with an offered candidate */
  if (req.method === "POST" && path === "/invite") {
    if (suspended) return err(403, "suspended", m.suspended_until);
    const b = await req.json().catch(() => ({}));
    const off = /^[a-f0-9]{16}$/.test(b.offer || "") ? await q(env, "SELECT * FROM offers WHERE id=? AND for_uid=?", b.offer, uid).first() : null;
    if (!off || off.expires_at < ms) return err(404, "offer");
    if (await burstLimited(env, uid, ms)) return err(429, "rate");
    if (await activePair(env, uid)) return err(409, "paired");
    const mine = await q(env, "SELECT * FROM interest WHERE uid=?", uid).first();
    let theirs = await q(env, "SELECT * FROM interest WHERE uid=?", off.cand_uid).first();
    if (!theirs) {   /* an online member, not in line: still askable while they are on this track, seen recently and free */
      const om = await member(env, off.cand_uid);
      if (om && TRACKS.has(om.track) && om.last_seen > ms - 5 * 60_000 && !om.opted_out && !(om.suspended_until > ms)) theirs = { uid: om.uid, track: om.track, band: null, lang: om.lang, prompt_week: 0, fnd_day: 0 };
    }
    if (!mine || !theirs || await blockedEither(env, uid, off.cand_uid)) return err(409, "gone");
    const pairId = await proposePair(env, uid, off.cand_uid, ms, seedFrom(mine, theirs, b.phrase), b.live === true && env.LIVE_ENABLED === "1", ctx);
    if (!pairId) return err(409, "gone");
    return json({ status: "invited", ...(await meView(env, uid, ms)) });
  }

  /* pair-scoped: /pairs/:id/(seen|leave|report|block|decide) */
  let pm = /^\/pairs\/([a-f0-9]{16})\/(seen|leave|report|block|decide|accept|decline|cancel)$/.exec(path);
  if (pm && req.method === "POST") {
    const pair = await q(env, "SELECT * FROM pairs WHERE id=?", pm[1]).first();
    if (!isMember(pair, uid)) return err(403, "forbidden");
    const other = otherOf(pair, uid);
    if (await blockedEither(env, uid, other) && pm[2] !== "block") return err(403, "forbidden");
    /* a proposed trial: the guest accepts or declines, the host may cancel */
    if (pm[2] === "accept" || pm[2] === "decline" || pm[2] === "cancel") {
      if (pair.status === "active" && pm[2] === "accept") return json({ ok: true, already: true, ...(await meView(env, uid, ms)) });
      if (pair.status !== "invited") return err(409, "closed");
      if (pair.invite_expires <= ms) { await q(env, "UPDATE pairs SET status='closed', closed_reason='expired', closed_at=? WHERE id=? AND status='invited'", ms, pair.id).run(); return err(409, "closed"); }
      const isHost = pair.host === uid;
      if (pm[2] === "accept") {
        if (isHost) return err(403, "forbidden");
        if (suspended) return err(403, "suspended", m.suspended_until);
        const ok = await acceptPair(env, pair, ms); if (!ok) return err(409, "gone");
        /* a live proposal: the room opens now, host side, so the guest's accept is
           one tap and the host's poll walks straight in */
        if (pair.live_wanted && env.LIVE_ENABLED === "1" && !(await openLive(env, pair.host)) && !(await openLive(env, uid))) {
          const lid = rid();
          await q(env, "INSERT INTO live_sessions(id,host,guest,state,band,prompt_week,fnd_day,prompt_json,created_at,updated_at,expires_at) VALUES(?,?,?,'invited',?,?,?,?,?,?,?)",
            lid, pair.host, uid, pair.band, pair.prompt_week || 0, pair.fnd_day || 0, pair.prompt_json || null, ms, ms, ms + LIVE_INVITE_MS).run();
          await audit(env, ms, pair.host, "live_invited", uid, lid, { via: "proposal" });
        }
        return json({ ok: true, already: false, ...(await meView(env, uid, ms)) });
      }
      if ((pm[2] === "decline" && isHost) || (pm[2] === "cancel" && !isHost)) return err(403, "forbidden");
      const why = pm[2] === "decline" ? "declined" : "cancelled";
      await q(env, "UPDATE pairs SET status='closed', closed_reason=?, closed_at=?, closed_by=? WHERE id=? AND status='invited'", why, ms, uid, pair.id).run();
      await audit(env, ms, uid, "trial_" + why, other, pair.id, {});
      return json({ ok: true, ...(await meView(env, uid, ms)) });
    }
    if (pair.status === "invited") return err(409, "closed");   /* nothing else applies to a proposal */
    if (pm[2] === "seen") { await q(env, `UPDATE pairs SET ${pair.uid_a === uid ? "seen_a" : "seen_b"}=? WHERE id=?`, ms, pair.id).run(); return json({ ok: true }); }
    if (pm[2] === "leave") { await closePair(env, pair, "left", ms, uid); await audit(env, ms, uid, "left", other, pair.id, {}); return json(await meView(env, uid, ms)); }
    if (pm[2] === "report") {
      const b = await req.json().catch(() => ({}));
      if (!REASONS.has(b.reason)) return err(400, "bad_request");
      const r = await doReport(env, uid, other, pair.id, b.reason, ms); if (r) return r;
      return json({ ok: true, ...(await meView(env, uid, ms)) });
    }
    if (pm[2] === "block") {
      const r = await doBlock(env, uid, other, ms); if (r) return r;
      await closePair(env, pair, "blocked", ms); await audit(env, ms, uid, "blocked", other, pair.id, {});
      return json({ ok: true, ...(await meView(env, uid, ms)) });
    }
    if (pm[2] === "decide") {
      const b = await req.json().catch(() => ({}));
      /* continue = keep practising (a regular connection only when BOTH say so);
         rematch = someone else (cooldown); later = not now (the trial stays on
         record, no connection, no cooldown, both are free to come back) */
      if (!["continue", "rematch", "later"].includes(b.choice)) return err(400, "bad_request");
      if (pair.status !== "active") return err(409, "closed");
      if (await burstLimited(env, uid, ms)) return err(429, "rate");
      const turns = (await q(env, "SELECT from_uid, created_at FROM turns WHERE pair_id=?", pair.id).all()).results || [];
      const rv = roundsView(pair, turns, uid);
      const myLast = [...turns].reverse().find(t => t.from_uid === uid);
      const silentMs = ms - Math.max(myLast ? myLast.created_at : 0, pair.created_at);
      if (!rv.complete && !(b.choice === "rematch" && silentMs >= Number(env.PARTNER_TIMEOUT_H || 24) * 3_600_000)) return err(409, "not_complete");
      if (b.choice === "continue" && (await blockedEither(env, uid, other))) return err(403, "forbidden");   /* a block on either side can never become a connection */
      const col = pair.uid_a === uid ? "decision_a" : "decision_b";
      await q(env, `UPDATE pairs SET ${col}=? WHERE id=?`, b.choice, pair.id).run();
      const fresh = await q(env, "SELECT * FROM pairs WHERE id=?", pair.id).first();
      const [x, y] = pairKey(uid, other);
      await audit(env, ms, uid, "decided", other, pair.id, { choice: b.choice });
      if (b.choice === "rematch") {
        await env.DB.batch([
          q(env, "INSERT INTO cooldowns(a,b,until,reason) VALUES(?,?,?,'rematch') ON CONFLICT(a,b) DO UPDATE SET until=excluded.until, reason='rematch'", x, y, ms + COOLDOWN_MS),
          q(env, "UPDATE connections SET state='disconnected', updated_at=? WHERE a=? AND b=? AND state<>'blocked'", ms, x, y),
        ]);
        await closePair(env, fresh, "rematch", ms, uid);
      } else if (b.choice === "later") {
        /* nothing is created; closing the pair frees both to practise with anyone */
        await closePair(env, fresh, "completed", ms, uid);
      } else if (fresh.decision_a === "continue" && fresh.decision_b === "continue") {
        /* mutual consent, once: the close is the atomic step — only the call
           whose UPDATE actually flips the pair creates the connection, so two
           simultaneous "continue"s (or a repeat) cannot count a session twice */
        const flipped = await q(env, "UPDATE pairs SET status='closed', closed_reason='completed', closed_at=? WHERE id=? AND status='active' AND decision_a='continue' AND decision_b='continue'", ms, pair.id).run();
        if (flipped && flipped.meta && flipped.meta.changes) {
          const conn = await connection(env, uid, other);
          const sessions = ((conn && conn.sessions) || 0) + 1;
          const state = sessions >= 2 ? "regular" : "mutual";
          await q(env, "INSERT INTO connections(a,b,state,sessions,created_at,updated_at,last_practice_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(a,b) DO UPDATE SET state=excluded.state, sessions=excluded.sessions, updated_at=excluded.updated_at, last_practice_at=excluded.last_practice_at", x, y, state, sessions, ms, ms, ms).run();
          await audit(env, ms, "system", "connection_" + state, y, pair.id, { sessions });
        }
      }
      return json(await meView(env, uid, ms));
    }
  }
  /* ---------------- partner management on the connection card ----------------
     POST /connection/end    {cid}          — end the partnership (not a block, not a report)
     POST /connection/report {cid, reason}  — report the partner outside a session
     POST /connection/block  {cid}          — block the partner outside a session
     POST /connection/unblock {cid}         — lift MY block: a fresh start, not a
                                              restored partnership (state 'ended',
                                              no cooldown); the other side's own
                                              block, if any, stands
     The cid is resolved against the caller's OWN connections only; anyone
     else's partnership simply does not resolve (404). Ending and unblocking
     are idempotent. */
  {
    const cm = /^\/connection\/(end|report|block|unblock)$/.exec(path);
    if (cm && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      const cid = /^[a-f0-9]{16}$/.test(b.cid || "") ? b.cid : null; if (!cid) return err(400, "bad_request");
      const c = await myConnectionByCid(env, uid, cid); if (!c) return err(404, "no_connection");
      const other = c.a === uid ? c.b : c.a;
      if (cm[1] === "end") {
        if (c.state === "ended" || c.state === "blocked") return json({ ok: true, already: true, ...(await meView(env, uid, ms)) });
        if (await burstLimited(env, uid, ms)) return err(429, "rate");
        await env.DB.batch([
          q(env, "UPDATE connections SET state='ended', updated_at=? WHERE a=? AND b=? AND state NOT IN ('blocked')", ms, c.a, c.b),
          q(env, "INSERT INTO cooldowns(a,b,until,reason) VALUES(?,?,?,'ended') ON CONFLICT(a,b) DO UPDATE SET until=excluded.until, reason='ended'", c.a, c.b, ms + COOLDOWN_MS),
        ]);
        /* an open session with that partner cannot outlive the partnership */
        const p = await activePair(env, uid); if (p && otherOf(p, uid) === other) await closePair(env, p, "left", ms, uid);
        const l = await openLive(env, uid); if (l && (l.host === other || l.guest === other)) await liveClose(env, l, "ended", "left", ms);
        await audit(env, ms, uid, "connection_ended", other, null, { sessions: c.sessions });
        return json({ ok: true, already: false, ...(await meView(env, uid, ms)) });
      }
      if (cm[1] === "report") {
        if (!REASONS.has(b.reason)) return err(400, "bad_request");
        const r = await doReport(env, uid, other, "conn:" + cid, b.reason, ms); if (r) return r;
        return json({ ok: true, ...(await meView(env, uid, ms)) });
      }
      if (cm[1] === "block") {
        const r = await doBlock(env, uid, other, ms); if (r) return r;
        await audit(env, ms, uid, "blocked", other, null, { connection: true });
        return json({ ok: true, ...(await meView(env, uid, ms)) });
      }
      if (cm[1] === "unblock") {
        const mine = await q(env, "SELECT 1 AS x FROM blocks WHERE by_uid=? AND about_uid=?", uid, other).first();
        if (!mine) return json({ ok: true, already: true, ...(await meView(env, uid, ms)) });
        if (await bump(env, uid, "block", ms) > SAFETY_LIMITS.block) return err(429, "limit");
        await q(env, "DELETE FROM blocks WHERE by_uid=? AND about_uid=?", uid, other).run();
        const theirs = await q(env, "SELECT 1 AS x FROM blocks WHERE by_uid=? AND about_uid=?", other, uid).first();
        if (!theirs) await q(env, "UPDATE connections SET state='ended', updated_at=? WHERE a=? AND b=? AND state='blocked'", ms, c.a, c.b).run();
        await audit(env, ms, uid, "unblocked", other, null, { theirs: !!theirs });
        return json({ ok: true, already: false, ...(await meView(env, uid, ms)) });
      }
    }
  }

  /* DELETE /history — "clear my history": the caller's own recordings from
     sessions that are already closed go now instead of at the 14-day purge.
     The device-side record (S.ppHist) is the app's to clear; pairs, connections
     and safety rows stay (they are what keeps matching honest). Idempotent. */
  if (req.method === "DELETE" && path === "/history") {
    const r = await eraseTurns(env, uid, true);
    /* the learner's own Round Reviews of closed sessions go with the turns they came from */
    const rv = await q(env, "DELETE FROM reviews WHERE uid=? AND pair_id IN (SELECT id FROM pairs WHERE status='closed')", uid).run();
    r.reviews = (rv.meta && rv.meta.changes) || 0;
    const lrv = await q(env, "DELETE FROM reviews WHERE uid=? AND pair_id IN (SELECT id FROM live_sessions WHERE (host=? OR guest=?) AND state NOT IN ('invited','accepted','connecting','active','reconnecting'))", uid, uid, uid).run();   /* live-call reviews too */
    r.reviews += (lrv.meta && lrv.meta.changes) || 0;
    if (r.turns) await audit(env, ms, uid, "history_cleared", null, null, r);
    return json({ ok: true, ...r });
  }

  /* POST /ai/session {id, track} — the AI coach session itself runs on the
     client and the Polish Worker, but it is opened through here so the count
     is per AUTHENTICATED learner, not per IP: 12 new sessions a day (enough
     for a keen learner, not enough to run a bot through it). Idempotent on
     the client's session id — a repeated open never counts twice. */
  if (req.method === "POST" && path === "/ai/session") {
    if (suspended) return err(403, "suspended", m.suspended_until);
    const b = await req.json().catch(() => ({}));
    if (!TRACKS.has(b.track)) return err(403, "track");
    const id = /^[a-f0-9]{16}$/.test(b.id || "") ? b.id : null; if (!id) return err(400, "bad_request");
    const seen = await q(env, "SELECT 1 AS x FROM audit WHERE actor=? AND action='ai_started' AND pair_id=? LIMIT 1", uid, id).first();
    if (seen) return json({ ok: true, id, repeat: true });
    if (await burstLimited(env, uid, ms)) return err(429, "rate");
    await audit(env, ms, uid, "ai_started", null, id, { reason: clean(b.reason, 16) });
    return json({ ok: true, id, repeat: false }, 201);
  }

  /* ================================================================ LIVE (Level 3)
     A live session is a real-time voice call between two CONNECTED partners.
     The Worker holds the state machine and relays WebRTC signalling as
     append-only rows; audio flows peer to peer and is never stored.
       invited → accepted → connecting → active ⇄ reconnecting → ended
       invited → declined | cancelled | expired ; any open → failed | ended(blocked)
     Every route: member only, block check, LIVE_ENABLED, opaque 16-hex ids. */
  if (path === "/live" || path.startsWith("/live/")) {
    if (env.LIVE_ENABLED !== "1") return err(403, "live_off");
    if (suspended) return err(403, "suspended", m.suspended_until);
    const view = (s, meUid) => {
      const role = s.host === meUid ? "host" : "guest", other = role === "host" ? s.guest : s.host;
      let prompt = null; try { prompt = s.prompt_json ? JSON.parse(s.prompt_json) : null; } catch (e) {}
      return { id: s.id, role, state: s.state, band: s.band, promptWeek: s.prompt_week, fndDay: s.fnd_day, prompt, createdAt: s.created_at, acceptedAt: s.accepted_at, startedAt: s.started_at, endedAt: s.ended_at, endReason: s.end_reason, expiresAt: s.expires_at, other };
    };
    const withName = async (v) => { const p = await member(env, v.other); const { other, ...rest } = v; return { ...rest, partner: { name: p ? p.name : "?" } }; };
    if (req.method === "POST" && path === "/live") {
      const b = await req.json().catch(() => ({}));
      /* live is for whoever you are practising with: the open session's partner
         first (a trial included — "if you are not compatible, leave"), else
         your connected partner */
      let other = null;
      const ap = await activePair(env, uid); if (ap) other = otherOf(ap, uid);
      if (!other) { const conns = (await q(env, "SELECT * FROM connections WHERE (a=? OR b=?) AND state IN ('mutual','regular')", uid, uid).all()).results || []; if (conns[0]) other = conns[0].a === uid ? conns[0].b : conns[0].a; }
      if (!other) return err(404, "no_connection");
      if (await blockedEither(env, uid, other)) return err(403, "forbidden");
      if (m.opted_out) return err(403, "opted_out");                                        /* hidden: not reachable, not reaching out */
      { const om = await member(env, other); if (om && om.opted_out) return err(409, "hidden"); }   /* a hidden partner is not rung */
      const mine = await openLive(env, uid); if (mine) return json({ live: await withName(view(mine, uid)), ...(await meView(env, uid, ms)) });   // idempotent
      if (await openLive(env, other)) return err(409, "busy");
      if (await burstLimited(env, uid, ms)) return err(429, "rate");
      const id = rid();
      await q(env, "INSERT INTO live_sessions(id,host,guest,state,band,prompt_week,fnd_day,prompt_json,created_at,updated_at,expires_at) VALUES(?,?,?,'invited',?,?,?,?,?,?,?)",
        id, uid, other, BANDS.includes(b.band) ? b.band : null, Math.max(0, Math.min(12, Number(b.promptWeek) || 0)), Math.max(0, Math.min(15, Number(b.fndDay) || 0)), b.phrase ? JSON.stringify({ phrase: clean(b.phrase, 160) }) : null, ms, ms, ms + LIVE_INVITE_MS).run();
      await audit(env, ms, uid, "live_invited", other, id, {});
      await wake(env, ctx, other, "live", m.name, id);
      const s = await q(env, "SELECT * FROM live_sessions WHERE id=?", id).first();
      return json({ live: await withName(view(s, uid)), ...(await meView(env, uid, ms)) }, 201);
    }
    const lm = /^\/live\/([a-f0-9]{16})(?:\/(accept|decline|cancel|signal|signals|end|report|block|review))?$/.exec(path);
    if (!lm) return err(404, "not_found");
    const s = await q(env, "SELECT * FROM live_sessions WHERE id=?", lm[1]).first();
    if (!s || (s.host !== uid && s.guest !== uid)) return err(403, "forbidden");
    const other = s.host === uid ? s.guest : s.host, isHost = s.host === uid, act = lm[2] || "";
    if (act !== "block" && act !== "review" && await blockedEither(env, uid, other)) return err(403, "forbidden");   /* a learner who blocked mid-call still gets their own review */
    const open = LIVE_OPEN.has(s.state) && s.expires_at > ms;
    if (LIVE_OPEN.has(s.state) && s.expires_at <= ms) { await liveClose(env, s, "expired", "expired", ms); s.state = "expired"; }
    const seenCol = isHost ? "host_seen" : "guest_seen";
    if (req.method === "GET" && act === "") {
      await q(env, `UPDATE live_sessions SET ${seenCol}=? WHERE id=?`, ms, s.id).run();
      return json({ live: await withName(view(s, uid)), iceServers: await iceServers(env), partnerSeen: isHost ? s.guest_seen : s.host_seen });
    }
    if (req.method === "GET" && act === "signals") {
      const after = Math.max(0, Number(url.searchParams.get("after")) || 0);
      const rows = (await q(env, "SELECT id,kind,payload,created_at FROM live_signals WHERE session_id=? AND from_uid<>? AND id>? ORDER BY id LIMIT 100", s.id, uid, after).all()).results || [];
      await q(env, `UPDATE live_sessions SET ${seenCol}=? WHERE id=?`, ms, s.id).run();
      return json({ state: s.state, endReason: s.end_reason, startedAt: s.started_at, partnerSeen: isHost ? s.guest_seen : s.host_seen, signals: rows.map(r => ({ id: r.id, kind: r.kind, payload: r.payload, at: r.created_at })) });
    }
    if (req.method !== "POST") return err(404, "not_found");
    if (act === "accept") {
      if (isHost) return err(403, "forbidden");
      if (s.state === "invited" && open) { await q(env, "UPDATE live_sessions SET state='accepted', accepted_at=?, updated_at=?, expires_at=? WHERE id=? AND state='invited'", ms, ms, ms + LIVE_SESSION_MS, s.id).run(); await audit(env, ms, uid, "live_accepted", other, s.id, {}); }
      else if (!LIVE_OPEN.has(s.state)) return err(409, "closed");
      const f = await q(env, "SELECT * FROM live_sessions WHERE id=?", s.id).first();
      return json({ live: await withName(view(f, uid)), iceServers: await iceServers(env) });
    }
    if (act === "decline" || act === "cancel") {
      if ((act === "decline" && isHost) || (act === "cancel" && !isHost)) return err(403, "forbidden");
      if (open && (s.state === "invited" || s.state === "accepted")) { await liveClose(env, s, act === "decline" ? "declined" : "cancelled", act === "decline" ? "declined" : "cancelled", ms); await audit(env, ms, uid, "live_" + act, other, s.id, {}); }
      return json(await meView(env, uid, ms));
    }
    if (act === "signal") {
      if (!open || s.state === "invited") return err(409, "closed");
      const b = await req.json().catch(() => ({}));
      if (!LIVE_KINDS.has(b.kind) || typeof b.payload !== "string" || b.payload.length > 8000) return err(400, "bad_request");
      const n = (await q(env, "SELECT COUNT(*) AS n FROM live_signals WHERE session_id=? AND from_uid=?", s.id, uid).first()).n;
      if (n >= LIVE_MAX_SIGNALS) return err(429, "limit");
      await q(env, "INSERT INTO live_signals(session_id,from_uid,kind,payload,created_at) VALUES(?,?,?,?,?)", s.id, uid, b.kind, b.payload, ms).run();
      /* the transport drives the state: an offer/answer means connecting, the
         first "connected" report starts the clock, a drop reports reconnecting */
      let next = null;
      if ((b.kind === "offer" || b.kind === "answer") && s.state === "accepted") next = "connecting";
      if (b.kind === "state" && b.payload === "connected" && (s.state === "connecting" || s.state === "reconnecting" || s.state === "accepted")) next = "active";
      if (b.kind === "state" && b.payload === "reconnecting" && s.state === "active") next = "reconnecting";
      if (next) {
        await q(env, `UPDATE live_sessions SET state=?, updated_at=?, expires_at=? ${next === "active" && !s.started_at ? ", started_at=" + Number(ms) : ""} WHERE id=? AND state=?`, next, ms, ms + LIVE_SESSION_MS, s.id, s.state).run();
        if (next === "active" && !s.started_at) await audit(env, ms, "system", "live_started", null, s.id, {});
        if (next === "reconnecting") await audit(env, ms, uid, "live_reconnecting", other, s.id, {});
      }
      if (b.kind === "bye") { await liveClose(env, s, "ended", "left", ms); await audit(env, ms, uid, "live_left", other, s.id, {}); }
      const f = await q(env, "SELECT state FROM live_sessions WHERE id=?", s.id).first();
      return json({ ok: true, state: f.state });
    }
    if (act === "end") {
      const b = await req.json().catch(() => ({}));
      const reason = ["left", "completed", "failed"].includes(b.reason) ? b.reason : "left";
      if (LIVE_OPEN.has(s.state)) { await liveClose(env, s, reason === "failed" ? "failed" : "ended", reason, ms); await audit(env, ms, uid, "live_" + (reason === "completed" ? "completed" : reason === "failed" ? "failed" : "left"), other, s.id, { secs: s.started_at ? Math.round((ms - s.started_at) / 1000) : 0 }); }
      const f = await q(env, "SELECT * FROM live_sessions WHERE id=?", s.id).first();
      return json({ live: await withName(view(f, uid)), ...(await meView(env, uid, ms)) });
    }
    if (act === "report") {
      const b = await req.json().catch(() => ({}));
      if (!REASONS.has(b.reason)) return err(400, "bad_request");
      const r = await doReport(env, uid, other, s.id, b.reason, ms); if (r) return r;
      const fresh = await q(env, "SELECT * FROM live_sessions WHERE id=?", s.id).first();
      if (LIVE_OPEN.has(fresh.state) && (await member(env, other)).suspended_until > ms) await liveClose(env, fresh, "ended", "suspended", ms);
      return json({ ok: true, ...(await meView(env, uid, ms)) });
    }
    /* POST /live/:id/review {rounds:[{seq,transcript,durationMs}], context?, learned?}
       — the live call's four-round review (owner, 2026-09-25). Call audio
       still never reaches this Worker: each phone recorded ITS OWN learner's
       microphone per timed round, had it transcribed, and sends only those
       transcripts. The partner's words never arrive — their phone builds
       their own review. Same model, same shape, same table as a pair's
       review (keyed by the live session id); idempotent per (session, uid).
       Evidence is "asr": a recogniser heard the words, nothing scored sounds. */
    if (act === "review") {
      if (!s.started_at) return err(409, "not_complete");
      const have = await q(env, "SELECT * FROM reviews WHERE pair_id=? AND uid=?", s.id, uid).first();
      if (have && have.status === "ready") return json(reviewRow(have, null));
      if (have && have.status === "pending" && ms - have.created_at < 90_000) return json({ pending: true }, 202);
      const b = await req.json().catch(() => ({}));
      const myTurns = (Array.isArray(b.rounds) ? b.rounds : []).slice(0, 4).map((r, i) => ({
        seq: Math.max(1, Math.min(4, Number(r && r.seq) || i + 1)), transcript: clean(r && r.transcript, 4000),   /* a timed round runs longer than a 60-s turn */
        durationMs: Math.max(0, Math.min(15 * 60_000, Number(r && r.durationMs) || 0)), score: null, words: { mode: "whisper", list: [] },
      })).filter(t => t.transcript);
      if (!myTurns.length) return err(400, "empty");
      if (have) await q(env, "DELETE FROM reviews WHERE id=?", have.id).run();
      if (env.REVIEW_STUB !== "1" && !env.OPENAI_KEY) return err(503, "review_off");
      if (await burstLimited(env, uid, ms)) return err(429, "rate");
      const n = ((await q(env, "SELECT COUNT(*) AS n FROM reviews WHERE uid=? AND status='ready'", uid).first()) || {}).n || 0;
      const id = rid();
      try { await q(env, "INSERT INTO reviews(id,pair_id,uid,round,status,json,created_at) VALUES(?,?,?,?,'pending','{}',?)", id, s.id, uid, n + 1, ms).run(); }
      catch (e) { return json({ pending: true }, 202); }
      const prevRev = await q(env, "SELECT json FROM reviews WHERE uid=? AND status='ready' ORDER BY created_at DESC LIMIT 1", uid).first();
      let prevNext = []; try { const pj = JSON.parse(prevRev ? prevRev.json : "{}"); prevNext = nextPlanItems(pj.next).slice(0, 5); } catch (e) {}
      let prompt = null; try { prompt = s.prompt_json ? JSON.parse(s.prompt_json) : null; } catch (e) {}
      const learned = (Array.isArray(b.learned) ? b.learned : []).map(x => clean(x, 60)).filter(Boolean).slice(0, 20);
      const input = { myTurns, theirTurns: [], context: reviewContext(b.context, prompt), lang: m.lang || "en", band: s.band, round: n + 1, prevNext, learned };
      let review, model;
      try {
        const r = env.REVIEW_STUB === "1" ? reviewStub(input) : await reviewAI(env, input);
        review = reviewShape(r.review, input); model = r.model;
      } catch (e) {
        await q(env, "DELETE FROM reviews WHERE id=?", id).run();
        await audit(env, ms, uid, "review_failed", null, s.id, { live: true });
        return err(502, "review_unavailable", env.DEV_AUTH === "1" ? String(e.message || e) : undefined);
      }
      await q(env, "UPDATE reviews SET status='ready', evidence=?, model=?, json=? WHERE id=?", review.evidence, model, JSON.stringify(review), id).run();
      await audit(env, ms, uid, "review_ready", null, s.id, { evidence: review.evidence, live: true });
      const row = await q(env, "SELECT * FROM reviews WHERE id=?", id).first();
      return json(reviewRow(row, null), 201);
    }
    if (act === "block") {
      const r = await doBlock(env, uid, other, ms); if (r) return r;
      if (LIVE_OPEN.has(s.state)) await liveClose(env, s, "ended", "blocked", ms);
      await audit(env, ms, uid, "blocked", other, s.id, { live: true });
      return json({ ok: true, ...(await meView(env, uid, ms)) });
    }
    return err(404, "not_found");
  }

  /* POST /next {promptWeek, fndDay, band, phrase?} — a connected partner starts the next session directly */
  if (req.method === "POST" && path === "/next") {
    if (suspended) return err(403, "suspended", m.suspended_until);
    if (await activePair(env, uid)) return err(409, "paired");
    const conns = (await q(env, "SELECT * FROM connections WHERE (a=? OR b=?) AND state IN ('mutual','regular')", uid, uid).all()).results || [];
    const c = conns[0]; if (!c) return err(404, "no_connection");
    const other = c.a === uid ? c.b : c.a;
    if (await blockedEither(env, uid, other) || await activePair(env, other)) return err(409, "busy");
    if (m.opted_out) return err(403, "opted_out");
    { const om = await member(env, other); if (om && om.opted_out) return err(409, "hidden"); }   /* a hidden partner is not started with */
    const b = await req.json().catch(() => ({}));
    if (!BANDS.includes(b.band)) return err(400, "bad_request");
    const id = rid(), [x, y] = pairKey(uid, other);
    await q(env, "INSERT INTO pairs(id,uid_a,uid_b,track,band,prompt_week,fnd_day,week_start,status,created_at,kind,rounds,prompt_json) VALUES(?,?,?,?,?,?,?,?,'active',?,'regular',4,?)",
      id, x, y, "general-english", b.band, Math.max(0, Math.min(12, Number(b.promptWeek) || 0)), Math.max(0, Math.min(15, Number(b.fndDay) || 0)), ms, ms, b.phrase ? JSON.stringify({ phrase: clean(b.phrase, 160) }) : null).run();
    await audit(env, ms, uid, "pair_created", other, id, { kind: "regular" });
    return json({ status: "paired", ...(await meView(env, uid, ms)) });
  }
  if (req.method === "GET" && (pm = /^\/pairs\/([a-f0-9]{16})$/.exec(path))) {
    const pair = await q(env, "SELECT * FROM pairs WHERE id=?", pm[1]).first();
    if (!isMember(pair, uid) || await blockedEither(env, uid, otherOf(pair, uid))) return err(403, "forbidden");
    return json(await meView(env, uid, ms));
  }

  /* POST /turns — multipart: audio, transcript, score, duration_ms, turn_id */
  if (req.method === "POST" && path === "/turns") {
    if (suspended) return err(403, "suspended", m.suspended_until);
    const pair = await activePair(env, uid);
    if (!pair) return err(409, "no_pair");
    const other = otherOf(pair, uid);
    if (await blockedEither(env, uid, other)) return err(403, "forbidden");
    const fd = await req.formData().catch(() => null);
    if (!fd) return err(400, "bad_request");
    const audio = fd.get("audio");
    if (!audio || typeof audio === "string") return err(400, "bad_request", "audio");
    const turnId = /^[a-f0-9]{16}$/.test(fd.get("turn_id") || "") ? fd.get("turn_id") : rid();
    const dup = await q(env, "SELECT * FROM turns WHERE id=?", turnId).first();
    if (dup) return json({ turn: { id: dup.id, seq: dup.seq }, duplicate: true }, 200);
    const turns = (await q(env, "SELECT from_uid, created_at FROM turns WHERE pair_id=? ORDER BY created_at", pair.id).all()).results || [];
    const rv = roundsView(pair, turns, uid);
    if (rv.complete) return err(409, "complete");
    if (!rv.myTurn) return err(409, "not_your_turn");
    const durationMs = Math.max(0, Number(fd.get("duration_ms")) || 0);
    if (audio.size > MAX_AUDIO_BYTES) return err(413, "too_large");
    if (audio.size < 1200 || durationMs > MAX_TURN_MS) return err(400, "bad_request", "audio_size_or_length");
    const transcript = clean(fd.get("transcript"), MAX_TRANSCRIPT);
    if (!screenTranscript(transcript)) { await audit(env, ms, uid, "turn_screened", other, pair.id, {}); return err(422, "moderation"); }
    const score = fd.get("score") === null || fd.get("score") === "" ? null : Math.max(0, Math.min(100, Math.round(Number(fd.get("score")) || 0)));
    const words = wordsEvidence(fd.get("words"));   /* per-word pronunciation evidence, for the Round Review */
    const mime = /^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)/i.test(audio.type) ? audio.type.split(";")[0] : "audio/webm";
    const ext = mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("mpeg") ? "mp3" : "webm";
    const key = `pairs/${pair.id}/${turnId}.${ext}`;
    await env.AUDIO.put(key, audio.stream(), { httpMetadata: { contentType: mime } });
    try {
      await q(env, "INSERT INTO turns(id,pair_id,from_uid,day,seq,audio_key,mime,bytes,duration_ms,transcript,score,words,created_at) VALUES(?,?,?,0,?,?,?,?,?,?,?,?,?)",
        turnId, pair.id, uid, turns.length + 1, key, mime, audio.size, durationMs, transcript, score, words, ms).run();
    } catch (e) { await env.AUDIO.delete(key).catch(() => {}); throw e; }
    /* reliability: how fast did this reply follow the partner's last turn */
    const theirLast = [...turns].reverse().find(t => t.from_uid !== uid);
    if (theirLast) await q(env, "UPDATE members SET resp_ms_sum=resp_ms_sum+?, resp_n=resp_n+1 WHERE uid=?", Math.min(ms - theirLast.created_at, 7 * DAY), uid).run();
    const complete = turns.length + 1 >= pair.rounds;
    if (complete) {
      await q(env, "UPDATE pairs SET completed_at=? WHERE id=?", ms, pair.id).run();
      await q(env, "UPDATE members SET sessions_completed=sessions_completed+1 WHERE uid IN (?,?)", pair.uid_a, pair.uid_b).run();
      await audit(env, ms, "system", "session_completed", null, pair.id, { turns: turns.length + 1 });
    }
    return json({ turn: { id: turnId, seq: turns.length + 1, at: ms }, complete }, 201);
  }

  /* ================================================================ FOUR-ROUND REVIEW
     POST /pairs/:id/review {context?, learned?} — once the session is complete
     (all four rounds in), the caller's OWN performance across their rounds
     becomes a private, topic-aware lesson. Member only; the pair must be on an
     allowed track; idempotent per (pair, uid) — a repeat returns the stored
     review, a concurrent repeat gets 202 {pending:true} while the first is
     still being written. `context` = the day's curriculum (week, topic,
     objective, task, phrase bank — the app owns the curriculum, the Worker
     does not), `learned` = up to 20 expressions the learner saved earlier
     (their own data), so the review can say "you used X correctly". The
     partner's turns reach the model as the questions that were answered and
     nothing of them is stored in the review. */
  if (req.method === "POST" && (pm = /^\/pairs\/([a-f0-9]{16})\/review$/.exec(path))) {
    if (suspended) return err(403, "suspended", m.suspended_until);
    const pair = await q(env, "SELECT * FROM pairs WHERE id=?", pm[1]).first();
    if (!isMember(pair, uid)) return err(403, "forbidden");
    if (!TRACKS.has(pair.track)) return err(403, "track");
    const turns = (await q(env, "SELECT seq, from_uid, transcript, words, duration_ms, score FROM turns WHERE pair_id=? ORDER BY seq", pair.id).all()).results || [];
    const rv = roundsView(pair, turns, uid);
    if (!rv.complete) return err(409, "not_complete");
    const mine = turns.filter(t => t.from_uid === uid);
    if (!mine.length) return err(404, "not_found");
    const have = await q(env, "SELECT * FROM reviews WHERE pair_id=? AND uid=?", pair.id, uid).first();
    if (have && have.status === "ready") return json(reviewRow(have, pair));
    if (have && have.status === "pending" && ms - have.created_at < 90_000) return json({ pending: true }, 202);
    if (have) await q(env, "DELETE FROM reviews WHERE id=?", have.id).run();   /* a stale pending row (the first attempt died) */
    if (env.REVIEW_STUB !== "1" && !env.OPENAI_KEY) return err(503, "review_off");   /* not configured here: say so, never serve heuristics as a model's reading */
    if (await burstLimited(env, uid, ms)) return err(429, "rate");
    const n = ((await q(env, "SELECT COUNT(*) AS n FROM reviews WHERE uid=? AND status='ready'", uid).first()) || {}).n || 0;
    const id = rid();
    try { await q(env, "INSERT INTO reviews(id,pair_id,uid,round,status,json,created_at) VALUES(?,?,?,?,'pending','{}',?)", id, pair.id, uid, n + 1, ms).run(); }
    catch (e) { return json({ pending: true }, 202); }   /* lost the race: the other request is writing it */
    const b = await req.json().catch(() => ({}));
    const prevRev = await q(env, "SELECT json FROM reviews WHERE uid=? AND status='ready' ORDER BY created_at DESC LIMIT 1", uid).first();
    let prevNext = []; try { const pj = JSON.parse(prevRev ? prevRev.json : "{}"); prevNext = nextPlanItems(pj.next).slice(0, 5); } catch (e) {}
    let prompt = null; try { prompt = pair.prompt_json ? JSON.parse(pair.prompt_json) : null; } catch (e) {}
    const learned = (Array.isArray(b.learned) ? b.learned : []).map(s => clean(s, 60)).filter(Boolean).slice(0, 20);
    const context = reviewContext(b.context, prompt);
    const myTurns = mine.map(t => { let w = null; try { w = t.words ? JSON.parse(t.words) : null; } catch (e) {} return { seq: t.seq, transcript: t.transcript, words: w, durationMs: t.duration_ms, score: t.score }; });
    const theirTurns = turns.filter(t => t.from_uid !== uid).map(t => ({ seq: t.seq, transcript: String(t.transcript || "").slice(0, 600) }));
    const input = { myTurns, theirTurns, context, lang: m.lang || "en", band: pair.band, round: n + 1, prevNext, learned };
    let review, model;
    try {
      const r = env.REVIEW_STUB === "1" ? reviewStub(input) : await reviewAI(env, input);
      review = reviewShape(r.review, input); model = r.model;
    } catch (e) {
      await q(env, "DELETE FROM reviews WHERE id=?", id).run();
      await audit(env, ms, uid, "review_failed", null, pair.id, {});
      return err(502, "review_unavailable", env.DEV_AUTH === "1" ? String(e.message || e) : undefined);
    }
    await q(env, "UPDATE reviews SET status='ready', evidence=?, model=?, json=? WHERE id=?", review.evidence, model, JSON.stringify(review), id).run();
    await audit(env, ms, uid, "review_ready", null, pair.id, { evidence: review.evidence });
    const row = await q(env, "SELECT * FROM reviews WHERE id=?", id).first();
    return json(reviewRow(row, pair), 201);
  }

  /* GET /reviews — the caller's own reviews, newest first (≤ 40), for the
     across-sessions line and the History tab. Nobody else's, ever. */
  if (req.method === "GET" && path === "/reviews") {
    const rows = (await q(env, "SELECT * FROM reviews WHERE uid=? AND status='ready' ORDER BY created_at DESC LIMIT 40", uid).all()).results || [];
    const out = [];
    for (const r of rows) { const pair = await q(env, "SELECT * FROM pairs WHERE id=?", r.pair_id).first(); out.push(reviewRow(r, pair)); }
    return json({ reviews: out });
  }

  /* GET /turns/:id/audio — members only, never a public URL */
  if (req.method === "GET" && (pm = /^\/turns\/([a-f0-9]{16})\/audio$/.exec(path))) {
    const turn = await q(env, "SELECT * FROM turns WHERE id=?", pm[1]).first();
    if (!turn) return err(404, "not_found");
    const pair = await q(env, "SELECT * FROM pairs WHERE id=?", turn.pair_id).first();
    if (!isMember(pair, uid) || await blockedEither(env, uid, otherOf(pair, uid))) return err(403, "forbidden");
    const obj = await env.AUDIO.get(turn.audio_key);
    if (!obj) return err(404, "gone");
    return new Response(obj.body, { status: 200, headers: { "content-type": turn.mime, "cache-control": "private, max-age=3600", "content-length": String(obj.size) } });
  }

  if (req.method === "POST" && path === "/__cron" && env.DEV_AUTH === "1") return json(await maintenance(env, ms));
  return err(404, "not_found");
}

/* ================================================================ FOUR-ROUND REVIEW engine
   The learner's own rounds of one session → one private, topic-aware lesson.
   Layers: wordsEvidence() keeps what the app sent with each turn;
   reviewContext() keeps the day's curriculum the app sent with the request;
   reviewAI() / reviewStub() produce a candidate; reviewShape() is the only
   thing that reaches a phone — every field clamped, every list capped, every
   enum checked, so neither the model nor a bug can hand the client something
   unbounded or off-schema.

   Honesty rules baked into the prompt and the shaper:
   - evidence: "audio" only when an audio-in model scored the words of at
     least one of the learner's turns (mode "ai"); "asr" when only a recogniser
     heard them (mode "whisper" — it recognises words, it does not judge
     sounds); "none" when nothing was scored. Under "asr"/"none" a
     pronunciation item may only be "worth checking", never "mispronounced".
   - indicators are BE Mastery learning indicators from observable signals
     (the transcripts, the scores, the model's judgement) — not a proficiency
     measurement, and the client says so. Round-level values are evidence
     for the line; the session values are the result.
   - fixes carry a kind: error | awkward | unnatural | self_correction |
     hesitation. Only "error" may be called wrong.
   - the daily topic is the anchor: task mastery is judged against the
     components the curriculum task names, never against invented ones. */
function wordsEvidence(raw) {
  if (!raw || typeof raw !== "string" || raw.length > MAX_WORDS_JSON) return null;
  let v; try { v = JSON.parse(raw); } catch (e) { return null; }
  const list = (Array.isArray(v && v.list) ? v.list : []).map(w => ({ word: clean(w && w.word, 40), score: Math.max(0, Math.min(100, Math.round(Number(w && w.score)) || 0)), note: clean(w && w.note, 60) })).filter(w => w.word).slice(0, 80);
  if (!list.length) return null;
  const mode = v.mode === "ai" ? "ai" : "whisper";
  return JSON.stringify({ mode, list });
}
/* the day's curriculum as the app sent it, clamped; the session's own
   phrase (Apply It) wins as topic when there is one */
function reviewContext(c, prompt) {
  c = c && typeof c === "object" ? c : {};
  const out = {
    week: Math.max(0, Math.min(52, Number(c.week) || 0)), day: clean(c.day, 12),
    topic: clean(c.topic, 160), objective: clean(c.objective, 300), task: clean(c.task, 400), out: clean(c.out, 200), theme: clean(c.theme, 160),
    phrases: (Array.isArray(c.phrases) ? c.phrases : []).map(p => ({ p: clean(p && p.p, 80), u: clean(p && p.u, 80) })).filter(p => p.p).slice(0, 12),
  };
  if (prompt && prompt.phrase) { out.phrase = clean(prompt.phrase, 160); if (!out.topic) out.topic = out.phrase; }
  if (!out.topic) out.topic = "a workplace conversation";
  return out;
}
const nextPlanItems = n => { if (!n || typeof n !== "object") return []; const o = []; (n.pron || []).forEach(x => o.push("Pronounce " + x)); (n.vocab || []).forEach(x => o.push("Use " + x)); if (n.pattern) o.push(n.pattern); if (n.skill) o.push(n.skill); return o.filter(Boolean); };
const REVIEW_MODEL = "gpt-4o-mini";
const REVIEW_SYSTEM = `You are an applied-linguistics coach for adult learners of spoken English (Business English Mastery). ONE learner has just finished a four-round practice conversation with another learner about the DAY'S CURRICULUM TOPIC. You receive: the curriculum context (week, topic, objective, the task with its expected components, the week's phrase bank), the learner's own turns (automatic transcripts, ~60 s each) with optional per-word pronunciation scores, and the partner's turns purely as the questions that were answered. Analyse THIS learner's performance ACROSS ALL THEIR ROUNDS against the day's task. Answer with minified JSON matching exactly:
{"topic":"the topic in a few words",
 "summary":"1-2 warm, specific sentences",
 "well":[{"text":"strength shown, with the actual words","evidence":"Round 1"}],
 "improve":[{"text":"recurring pattern worth fixing, with counts where true","evidence":"Rounds 1 and 3"}],
 "task":{"objective":"what the learner was supposed to accomplish","components":[{"name":"","status":"strong|developing|needs_practice|missing","note":"one sentence"}],"verdict":"one sentence: did they acquire the English this task needed?"},
 "rounds":[{"seq":1,"pron":0-100 or null,"grammar":0-100,"vocab":0-100,"fluency":0-100,"task":0-100}],
 "indicators":{"pron":0-100 or null,"grammar":0-100,"vocab":0-100,"fluency":0-100,"task":0-100},
 "pron":[{"word":"","heard":"","target":"respelling or IPA","why":"one simple sentence","confidence":"heard|check","rounds":[1,3]}],
 "fixes":[{"said":"exact quote","better":"","why":"one plain sentence","kind":"error|awkward|unnatural|self_correction|hesitation","practice":"the sentence to say aloud","pattern":"the recurring pattern, or empty","count":1}],
 "natural":[{"said":"","natural":"","professional":""}],
 "vocab":{"used_well":["terms the learner used correctly"],"misused":[{"term":"","said":"","better":""}],"must":[{"term":"","meaning":"","pron":"","example":"","ctx":""}],"upgrade":[{"term":"","replaces":"the basic word they overused","count":3,"meaning":"","example":""}],"next":[{"term":"","meaning":"","pron":"","example":"","ctx":""}],"patterns":["I've been working in … for …"]},
 "answer":{"original":"condensed, in the learner's words","polished":"the improved answer, same facts","changed":["vocabulary: …","structure: …"]},
 "coach":{"script":["sentence","sentence"],"model":{"structure":"the named professional structure for this question type","answer":"the full answer that was expected, in the learner's own facts","moves":["one line per part of the structure"]},"practice":[{"said":"the learner's exact words, or empty","expected":"what the task expected at that point","say":"the full polished sentence to say","teach":"why it is better"}]},
 "next":{"pron":["word"],"vocab":["term"],"pattern":"sentence pattern to master","answer":"one improved sentence to rehearse","skill":"one communication skill for the next session"},
 "reused":[{"term":"","ok":true,"note":""}],
 "prev":[{"text":"","met":true,"note":""}],
 "highlights":[""]}
Rules:
- The daily topic is the anchor. Derive the task components from the task text (it often reads "A → B → C → D"); judge each from the learner's rounds. Never invent components the task does not imply. If the session carried a specific phrase to apply, one component is "used the phrase".
- Quote the learner exactly in "said"; keep their intended meaning and facts in every rewrite, including "answer.polished".
- well / improve: 2-4 each, evidence-based (cite rounds, quote words, give real counts). No generic praise.
- fixes: at most 4, the recurring or highest-value ones. "error" only for incorrect grammar; "awkward" for grammatical but clumsy; "unnatural" for phrasing a fluent speaker would not use; "self_correction" when the learner fixed themselves (praise it); "hesitation" for normal speech hesitation (never a fault). Never call awkward or unnatural English "wrong".
- pron: aggregate across rounds. With evidence "audio" a word scored under 70 may be "heard". With "asr" or "none" you have NO sound evidence: at most 3 words "check" that are commonly hard for a speaker of the learner's first language, said to be worth checking. Do not penalise an understandable accent. Empty is fine.
- vocab: only what this topic and this learner's speech call for. must = 2-4 highest-priority items (from the phrase bank when it fits); upgrade = words they repeated (with the real count); next = 1-3 level-appropriate stretches; patterns = 1-3 sentence patterns. Do not dump the whole phrase bank.
- rounds: one entry per learner turn (their seq numbers) — round-level evidence; indicators = the session result. pron null when evidence is "none". These are learning indicators, not a proficiency measurement.
- coach.script is the WHOLE feedback spoken aloud — the learner presses play once and hears everything. 5 to 9 short sentences in a natural teacher voice, under 170 words, in this order: (1) what this conversation was about and what the task asked for; (2) what went well across the rounds, quoting the learner's actual words; (3) the one pattern to change, with the corrected sentence; (4) the two or three expressions to learn; (5) end with exactly this lead-in as its own sentence: "Now listen to the full answer I was expecting from you, built with your own details." (the app reads coach.model.answer straight after it — do NOT put the model answer inside the script).
- coach.model is the real-world example: "This is what we were expecting from you." Choose the structure professionals are taught for THIS question type and name it in "structure" — e.g. "Present → Past → Future" for Tell me about yourself; "Situation → Task → Action → Result" for describing an achievement, a problem or a decision; "Point → Reason → Example → Next step" for an opinion or a recommendation; "Context → Options → Recommendation" for a proposal; "Acknowledge → Clarify → Answer" for handling a question. "answer" = the FULL spoken answer to the day's question, 80 to 150 words, first person, natural professional register, organised by that structure and built ONLY from the facts the learner actually gave (their role, company, years, team, projects, numbers, goals — reuse their exact details and emphasise the topic they chose). Use two or three of the must-know expressions. Never invent facts they did not say; where the task expected a part they never covered, phrase it from what they did say or as a short bridging sentence without new facts. "moves" = one line per part of the structure, saying what that part does and which of the learner's details goes there (3 to 5 lines). coach.practice: 2 to 4 REAL EXAMPLES from this conversation, each a complete sentence the learner can master. "said" = the learner's exact words for that moment (empty if they never covered it); "expected" = what the task expected there, in one plain line; "say" = the full sentence they should have said — natural, professional, 8 to 25 words, keeping their own facts, never a fragment; "teach" = one sentence on why it is better. Take them from the fixes, the missing task components and the must-know vocabulary, in that order.
- next: concrete and specific to what was found (1-2 pron, 2-3 vocab, one pattern, one sentence, one skill).
- reused: for each "learned" item used, ok:true with a one-line praise; for important unused ones, ok:false with a gentle way in. Max 3.
- prev: judge each item of "prevNext" met or not from this session. Max 5.
- Never mention the partner's mistakes or quote the partner. All text in English, short, concrete. Output JSON only.`;
async function reviewAI(env, input) {
  const evidence = reviewEvidence(input.myTurns);
  const user = JSON.stringify({
    curriculum: input.context, first_language: input.lang, level_band: input.band, session_number: input.round,
    my_rounds: input.myTurns.map(t => ({ round: t.seq, transcript: t.transcript, overall_score: t.score, duration_s: Math.round((t.durationMs || 0) / 1000), word_scores: t.words ? t.words.list.slice(0, 80) : [] })),
    partner_rounds_context_only: input.theirTurns, evidence, prevNext: input.prevNext, learned: input.learned,
  });
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({ model: REVIEW_MODEL, temperature: 0.3, max_tokens: 3400, response_format: { type: "json_object" }, messages: [{ role: "system", content: REVIEW_SYSTEM }, { role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const raw = ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").trim();
  let review; try { review = JSON.parse(raw); } catch (e) { throw new Error("bad_json"); }
  return { review, model: REVIEW_MODEL };
}
function reviewEvidence(myTurns) { const modes = myTurns.map(t => t.words && t.words.mode).filter(Boolean); return modes.includes("ai") ? "audio" : modes.length ? "asr" : "none"; }
/* Deterministic review from the transcripts alone — dev and tests (no key,
   nothing leaves the machine). Simple heuristics stand in for the model: the
   task's "A → B → C" components matched by keyword, "since" + duration, "very
   good", overused basic words counted across rounds, the phrase bank. */
function reviewStub(input) {
  const ctx = input.context, all = input.myTurns.map(t => t.transcript).join(" "), low = [];
  input.myTurns.forEach(t => (t.words ? t.words.list : []).forEach(w => { if (w.score < 70) low.push({ ...w, seq: t.seq }); }));
  const evidence = reviewEvidence(input.myTurns);
  const rx = s => new RegExp("\\b" + s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
  const count = (s, txt = all) => (txt.match(new RegExp("\\b" + s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi")) || []).length;
  const parts = (ctx.task.match(/[^:]+→[^.]+/) ? ctx.task.replace(/^[^:]*:\s*/, "") : "").split("→").map(s => s.trim().replace(/[.]$/, "")).filter(Boolean).slice(0, 5);
  const compWords = { "current role": /\b(work as|i am a|i'm a|my role|my job|i work|i am working|i'm working)\b/i, "core responsibilities": /\b(responsib|in charge|manage|handle|take care)\b/i, "previous experience": /\b(before|previous|used to|experience|years)\b/i, "current focus": /\b(focus|currently|right now|at the moment|working on)\b/i };
  const components = parts.map(name => { const re = compWords[name.toLowerCase()] || rx(name.split(" ")[0]); const hits = input.myTurns.filter(t => re.test(t.transcript)).map(t => t.seq); const status = hits.length >= 2 || (hits.length === 1 && input.myTurns.find(t => t.seq === hits[0]).transcript.length >= 60) ? "strong" : hits.length === 1 ? "developing" : "missing"; return { name, status, note: hits.length ? `Covered in round${hits.length > 1 ? "s" : ""} ${hits.join(" and ")}.` : "Not covered in this session." }; });
  if (ctx.phrase) components.push({ name: "used the phrase", status: rx(ctx.phrase.replace(/…/g, "")).test(all) ? "strong" : "missing", note: "" });
  const fixes = [];
  const m1 = /\b(I am|I'm) (working|living|studying) (in|at|on) (.+?) since (\w+ years?)\b/i.exec(all);
  if (m1) fixes.push({ said: m1[0], better: `I've been ${m1[2]} ${m1[3]} ${m1[4]} for ${m1[5]}`, why: "Use the present perfect continuous with 'for' + a duration.", kind: "error", practice: `I've been ${m1[2]} ${m1[3]} ${m1[4]} for ${m1[5]}.`, pattern: "duration with 'since' instead of 'for'", count: count("since") });
  if (count("very good")) fixes.push({ said: "very good", better: "really effective", why: "'Good' is vague in a work context; a precise adjective sounds more professional.", kind: "unnatural", practice: "The new process is really effective.", pattern: "vague adjectives", count: count("very good") });
  if (/\.\.\.|\bum\b|\buh\b/i.test(all)) fixes.push({ said: (all.match(/[^.]*\.\.\.[^.]*/) || [all.slice(0, 60)])[0].trim(), better: (all.match(/[^.]*\.\.\.[^.]*/) || [all.slice(0, 60)])[0].replace(/\.\.\./g, "").trim(), why: "A pause while you think is normal speech — nothing to fix.", kind: "hesitation", practice: "", pattern: "", count: 1 });
  const basic = [["work on", "be responsible for"], ["good", "effective"], ["big", "significant"], ["thing", "aspect"], ["nice", "pleasant"]].map(([w, up]) => ({ w, up, n: count(w) })).filter(x => x.n >= 1).sort((a, b) => b.n - a.n);
  const bank = ctx.phrases.slice(0, 6);
  const usedWell = bank.filter(p => rx(p.p.replace(/…/g, "").trim()).test(all)).map(p => p.p);
  const must = bank.filter(p => !rx(p.p.replace(/…/g, "").trim()).test(all)).slice(0, 3).map(p => ({ term: p.p, meaning: p.u || "a phrase for this topic", pron: "", example: p.p.replace(/…/g, "") + " the reporting process.", ctx: ctx.topic }));
  if (!must.length) must.push({ term: "I'm responsible for", meaning: "Describe ownership of a task", pron: "", example: "I'm responsible for the weekly report.", ctx: ctx.topic });
  const upgrade = basic.slice(0, 2).map(x => ({ term: x.up, replaces: x.w, count: x.n, meaning: `a more precise way to say '${x.w}'`, example: `I'm responsible for the invoice process.` }));
  const longest = [...new Set(all.toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter(w => w.length >= 8))].slice(0, 2);
  const next = longest.map(w => ({ term: w, meaning: "a word you used — make it yours", pron: w, example: `We should talk about the ${w}.`, ctx: "from your rounds" }));
  const pron = []; const seen = new Set();
  for (const w of low) { if (seen.has(w.word)) { pron.find(p => p.word === w.word).rounds.push(w.seq); continue; } seen.add(w.word); pron.push({ word: w.word, heard: w.note || "unclear", target: w.word, why: "Say it slowly, then at normal speed.", confidence: evidence === "audio" ? "heard" : "check", rounds: [w.seq] }); if (pron.length >= 3) break; }
  const sc = t => Number.isFinite(t.score) ? t.score : 70;
  const rounds = input.myTurns.map(t => { const tx = t.transcript; const tk = Math.round(100 * components.filter(c => (compWords[c.name.toLowerCase()] || rx(c.name.split(" ")[0])).test(tx)).length / Math.max(1, components.length)); return { seq: t.seq, pron: t.words ? Math.round(t.words.list.reduce((a, w) => a + w.score, 0) / t.words.list.length) : null, grammar: Math.max(30, sc(t) - (/since \w+ years/i.test(tx) ? 12 : 0)), vocab: Math.max(30, sc(t) - basic.filter(x => rx(x.w).test(tx)).length * 8), fluency: Math.max(30, sc(t) - (/\.\.\./.test(tx) ? 10 : 0)), task: tk }; });
  const avg = k => { const v = rounds.map(r => r[k]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const strong = components.filter(c => c.status === "strong").map(c => c.name), missing = components.filter(c => c.status !== "strong").map(c => c.name);
  const learned = input.learned || [], reused = learned.slice(0, 3).map(term => ({ term, ok: rx(term.replace(/…/g, "").trim()).test(all), note: "" }));
  const prev = (input.prevNext || []).map(text => ({ text, met: rx(text.split(" ").slice(-1)[0].replace(/[^a-zA-Z']/g, "") || "zzz").test(all), note: "" }));
  const original = input.myTurns.map(t => t.transcript).join(" ").slice(0, 400);
  let polished = original; fixes.filter(f => f.kind === "error" || f.kind === "unnatural").forEach(f => { polished = polished.replace(f.said, f.better); }); basic.slice(0, 1).forEach(x => { polished = x.w === "work on" ? polished.replace(/\bI work on\b/i, "I'm responsible for") : polished.replace(new RegExp("\\b" + x.w + "\\b", "i"), x.up); });
  const script = [strong.length ? `You did well explaining your ${strong[0]}${strong[1] ? " and your " + strong[1] : ""}.` : `You kept the conversation going across your rounds.`];
  if (basic[0]) script.push(`Across the rounds I noticed you used "${basic[0].w}" ${basic[0].n} time${basic[0].n > 1 ? "s" : ""}. For this topic, learn "${basic[0].up}".`);
  if (fixes[0] && fixes[0].kind === "error") script.push(`You said, "${fixes[0].said}". Say instead, "${fixes[0].better}". ${fixes[0].why}`);
  if (must[0]) script.push(`And add the expression "${must[0].term.replace(/…/g, "")}".`);
  script.push("Now listen to the full answer I was expecting from you, built with your own details.");
  /* the expected answer, from the learner's own words: their polished text
     (their facts, their topic) plus one bridging line per missing component */
  const modelAnswer = [polished.replace(/\.\.\./g, "").trim()].concat(missing.slice(0, 2).map(n => `As for my ${n}, that is the part I would add next, in one clear sentence.`)).join(" ").replace(/\s+/g, " ").trim();
  const coachModel = { structure: "Present → Past → Future", answer: modelAnswer, moves: ["Present: your current role and what you are responsible for, in one sentence.", "Past: the experience that brought you here — where, how long, what you handled.", "Future: what you are focused on now and where you want to take it."] };
  return { model: "stub", review: {
    topic: ctx.topic, summary: `This conversation was about ${ctx.topic}. ${strong.length ? "You covered " + strong.join(" and ") + " clearly." : "You kept going through every round."} ${missing.length ? "The missing piece was " + missing[0] + "." : ""}`.trim(),
    well: (strong.slice(0, 2).map(n => ({ text: `You explained your ${n} clearly.`, evidence: "Rounds " + input.myTurns.map(t => t.seq).join(" and ") })).concat(usedWell.slice(0, 1).map(p => ({ text: `You used "${p}" correctly.`, evidence: "" }))).concat([{ text: "You answered in every round and kept the conversation going.", evidence: "Rounds " + input.myTurns.map(t => t.seq).join(" and ") }])).slice(0, 3),
    improve: [].concat(basic[0] ? [{ text: `You used "${basic[0].w}" ${basic[0].n} time${basic[0].n > 1 ? "s" : ""} — for this topic, learn "${basic[0].up}".`, evidence: "across your rounds" }] : [], missing[0] ? [{ text: `The missing piece was your ${missing[0]}. Practise connecting your current role to it.`, evidence: "" }] : [], fixes[0] && fixes[0].kind === "error" ? [{ text: fixes[0].pattern, evidence: "Round " + input.myTurns[0].seq }] : []),
    task: { objective: ctx.objective || ctx.task, components, verdict: missing.length ? `Most of the task landed; ${missing[0]} still needs the language for it.` : "You had the English this task needed." },
    rounds, indicators: { pron: evidence === "none" ? null : avg("pron"), grammar: avg("grammar"), vocab: avg("vocab"), fluency: avg("fluency"), task: avg("task") },
    pron, fixes, natural: fixes[0] && fixes[0].kind !== "hesitation" ? [{ said: fixes[0].said, natural: fixes[0].better, professional: fixes[0].better.replace(/^I've been/, "I have been") }] : [],
    vocab: { used_well: usedWell, misused: [], must, upgrade, next, patterns: ["I've been working in … for …", "I'm responsible for …"] },
    answer: { original, polished, changed: [].concat(basic[0] ? [`vocabulary: "${basic[0].w}" → "${basic[0].up}"`] : [], fixes.filter(f => f.kind === "error").map(f => `grammar: ${f.pattern}`), pron[0] ? [`pronunciation target: ${pron[0].word}`] : []) },
    coach: { script, model: coachModel, practice: [].concat(fixes[0] && fixes[0].practice ? [{ said: fixes[0].said, expected: ctx.objective || ctx.task || "", say: fixes[0].practice, teach: fixes[0].why }] : [], missing[0] ? [{ said: "", expected: `Cover your ${missing[0]}.`, say: `As for my ${missing[0]}, I am responsible for the day-to-day work of my team.`, teach: `The task asked for your ${missing[0]}; this sentence covers it in one clear line.` }] : [], must[0] ? [{ said: "", expected: `Use "${must[0].term}" for this topic.`, say: must[0].example, teach: must[0].meaning }] : [], upgrade[0] ? [{ said: upgrade[0].replaces, expected: `A more precise word than "${upgrade[0].replaces}".`, say: upgrade[0].example, teach: upgrade[0].meaning }] : []).slice(0, 4) },
    next: { pron: pron.slice(0, 2).map(p => p.word), vocab: [].concat(upgrade.map(u => u.term), must.map(m => m.term)).slice(0, 3), pattern: "I've been working in … for …", answer: fixes[0] && fixes[0].practice ? fixes[0].practice : polished.split(/(?<=[.!?])\s+/)[0], skill: missing[0] ? `Cover your ${missing[0]} without being asked.` : "Add one detail your partner did not ask about." },
    reused, prev, highlights: usedWell.slice(0, 2),
  } };
}
const S_ = (v, n) => clean(typeof v === "string" ? v : "", n);
const N_ = v => (v === null || v === undefined || v === "" ? null : Math.max(0, Math.min(100, Math.round(Number(v)))));
const L_ = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);
const SL_ = (v, n, len) => L_(v, n).map(s => S_(s, len)).filter(Boolean);
function reviewShape(r, input) {
  r = r && typeof r === "object" ? r : {};
  const evidence = reviewEvidence(input.myTurns);
  const ind = r.indicators && typeof r.indicators === "object" ? r.indicators : {};
  const kinds = new Set(["error", "awkward", "unnatural", "self_correction", "hesitation"]), st = new Set(["strong", "developing", "needs_practice", "missing"]);
  const mySeqs = new Set(input.myTurns.map(t => t.seq));
  const term = (x, len) => ({ term: S_(x && x.term, 60), meaning: S_(x && x.meaning, 160), pron: S_(x && x.pron, 60), example: S_(x && x.example, 200), ctx: S_(x && x.ctx, len || 120) });
  const v = r.vocab && typeof r.vocab === "object" ? r.vocab : {};
  const task = r.task && typeof r.task === "object" ? r.task : {};
  const ans = r.answer && typeof r.answer === "object" ? r.answer : {};
  const nx = r.next && typeof r.next === "object" ? r.next : {};
  const out = {
    v: 2, evidence, round: input.round, seqs: [...mySeqs],
    topic: S_(r.topic, 120) || input.context.topic, summary: S_(r.summary, 320),
    well: L_(r.well, 4).map(x => ({ text: S_(x && x.text, 240), evidence: S_(x && x.evidence, 60) })).filter(x => x.text),
    improve: L_(r.improve, 4).map(x => ({ text: S_(x && x.text, 240), evidence: S_(x && x.evidence, 60) })).filter(x => x.text),
    task: { objective: S_(task.objective, 300) || input.context.objective, components: L_(task.components, 6).map(c => ({ name: S_(c && c.name, 60), status: st.has(c && c.status) ? c.status : "developing", note: S_(c && c.note, 160) })).filter(c => c.name), verdict: S_(task.verdict, 240) },
    rounds: L_(r.rounds, 4).map(x => ({ seq: Number(x && x.seq), pron: evidence === "none" ? null : N_(x && x.pron), grammar: N_(x && x.grammar) ?? 60, vocab: N_(x && x.vocab) ?? 60, fluency: N_(x && x.fluency) ?? 60, task: N_(x && x.task) ?? 60 })).filter(x => mySeqs.has(x.seq)).sort((a, b) => a.seq - b.seq),
    indicators: { pron: evidence === "none" ? null : N_(ind.pron), grammar: N_(ind.grammar) ?? 60, vocab: N_(ind.vocab) ?? 60, fluency: N_(ind.fluency) ?? 60, task: N_(ind.task) ?? 60 },
    pron: L_(r.pron, 4).map(x => ({ word: S_(x && x.word, 40), heard: S_(x && x.heard, 60), target: S_(x && x.target, 60), why: S_(x && x.why, 160), confidence: evidence === "audio" && x && x.confidence === "heard" ? "heard" : "check", rounds: L_(x && x.rounds, 4).map(Number).filter(n => mySeqs.has(n)) })).filter(x => x.word),
    fixes: L_(r.fixes, 4).map(x => ({ said: S_(x && x.said, 240), better: S_(x && x.better, 240), why: S_(x && x.why, 240), kind: kinds.has(x && x.kind) ? x.kind : "awkward", practice: S_(x && x.practice, 240), pattern: S_(x && x.pattern, 80), count: Math.max(0, Math.min(20, Math.round(Number(x && x.count)) || 0)) })).filter(x => x.said && x.better),
    natural: L_(r.natural, 3).map(x => ({ said: S_(x && x.said, 240), natural: S_(x && x.natural, 240), professional: S_(x && x.professional, 240) })).filter(x => x.said && (x.natural || x.professional)),
    vocab: { used_well: SL_(v.used_well, 6, 60), misused: L_(v.misused, 3).map(x => ({ term: S_(x && x.term, 60), said: S_(x && x.said, 160), better: S_(x && x.better, 160) })).filter(x => x.term && x.better),
      must: L_(v.must, 4).map(x => term(x)).filter(x => x.term && x.meaning), upgrade: L_(v.upgrade, 3).map(x => ({ term: S_(x && x.term, 60), replaces: S_(x && x.replaces, 40), count: Math.max(0, Math.min(20, Math.round(Number(x && x.count)) || 0)), meaning: S_(x && x.meaning, 160), example: S_(x && x.example, 200) })).filter(x => x.term && x.replaces),
      next: L_(v.next, 3).map(x => term(x)).filter(x => x.term && x.meaning), patterns: SL_(v.patterns, 3, 100) },
    answer: { original: S_(ans.original, 600), polished: S_(ans.polished, 700), changed: SL_(ans.changed, 5, 120) },
    coach: { script: SL_(r.coach && r.coach.script, 10, 320),
      model: (m => ({ structure: S_(m && m.structure, 80), answer: S_(m && m.answer, 1200), moves: SL_(m && m.moves, 5, 200) }))(r.coach && r.coach.model),
      practice: L_(r.coach && r.coach.practice, 4).map(x => ({ said: S_(x && x.said, 240), expected: S_(x && x.expected, 200), say: S_(x && x.say, 240), teach: S_(x && x.teach, 200) })).filter(x => x.say) },
    next: { pron: SL_(nx.pron, 2, 40), vocab: SL_(nx.vocab, 3, 60), pattern: S_(nx.pattern, 120), answer: S_(nx.answer, 240), skill: S_(nx.skill, 160) },
    reused: L_(r.reused, 3).map(x => ({ term: S_(x && x.term, 60), ok: !!(x && x.ok), note: S_(x && x.note, 160) })).filter(x => x.term),
    prev: L_(r.prev, 5).map(x => ({ text: S_(x && x.text, 160), met: !!(x && x.met), note: S_(x && x.note, 160) })).filter(x => x.text),
    highlights: SL_(r.highlights, 2, 120),
  };
  if (!out.coach.script.length) out.coach.script = [out.summary || "Good work. Listen to the sentences below and repeat them."];
  if (!out.answer.polished) out.answer.polished = out.answer.original;
  return out;
}
function reviewRow(row, pair) {
  let review; try { review = JSON.parse(row.json); } catch (e) { review = {}; }
  return { id: row.id, pairId: row.pair_id, round: row.round, evidence: row.evidence, at: row.created_at, partnerBand: pair ? pair.band : null, review };
}

/* ------------------------------------------------------- daily maintenance */
async function maintenance(env, ms) {
  const pairDays = Number(env.PAIR_DAYS || 7);
  const timeoutMs = Number(env.PARTNER_TIMEOUT_H || 24) * 3_600_000;
  const expired = (await q(env, "SELECT * FROM pairs WHERE status='active' AND created_at <= ?", ms - pairDays * DAY).all()).results || [];
  let abandoned = 0;
  for (const p of expired) {
    if (!p.completed_at) {
      /* abandoned: the member whose turn it was carries it — but only when they
         had at least PARTNER_TIMEOUT_H to reply. A turn sent an hour before the
         week ran out is not the other side's fault. Equal counts = nobody. */
      const turns = (await q(env, "SELECT from_uid, created_at FROM turns WHERE pair_id=? ORDER BY created_at", p.id).all()).results || [];
      const a = turns.filter(t => t.from_uid === p.uid_a).length, b = turns.length - a;
      const laggard = a === b ? null : a < b ? p.uid_a : p.uid_b;
      const lastAt = turns.length ? turns[turns.length - 1].created_at : p.created_at;
      if (laggard && ms - lastAt >= timeoutMs) { abandoned++; await q(env, "UPDATE members SET sessions_abandoned=sessions_abandoned+1 WHERE uid=?", laggard).run(); }
    }
    await closePair(env, p, "expired", ms);
  }
  await q(env, "UPDATE pairs SET status='closed', closed_reason='expired', closed_at=? WHERE status='invited' AND invite_expires<=?", ms, ms).run();
  const stale = (await q(env, "SELECT id FROM pairs WHERE status='closed' AND closed_at <= ?", ms - PURGE_AFTER_CLOSE_MS).all()).results || [];
  let purged = 0;
  for (const p of stale) {
    const turns = (await q(env, "SELECT id,audio_key FROM turns WHERE pair_id=?", p.id).all()).results || [];
    for (const t of turns) { await env.AUDIO.delete(t.audio_key).catch(() => {}); purged++; }
    await q(env, "DELETE FROM turns WHERE pair_id=?", p.id).run();
  }
  /* live: open sessions past their expiry close as expired; signalling rows
     of closed sessions go at once (they are worthless after the call), the
     session rows after 30 days */
  await q(env, "UPDATE live_sessions SET state='expired', end_reason='expired', ended_at=?, updated_at=? WHERE state IN ('invited','accepted','connecting','active','reconnecting') AND expires_at < ?", ms, ms, ms).run();
  await q(env, "DELETE FROM live_signals WHERE session_id IN (SELECT id FROM live_sessions WHERE state NOT IN ('invited','accepted','connecting','active','reconnecting'))").run();
  await q(env, "DELETE FROM live_sessions WHERE state NOT IN ('invited','accepted','connecting','active','reconnecting') AND updated_at < ?", ms - 30 * DAY).run();
  /* a learner who never came back stops being "waiting" after 7 days */
  await q(env, "DELETE FROM interest WHERE created_at < ?", ms - 7 * DAY).run();
  await q(env, "DELETE FROM offers WHERE expires_at < ?", ms).run();
  await q(env, "DELETE FROM cooldowns WHERE until < ?", ms).run();
  await q(env, "DELETE FROM counters WHERE key NOT LIKE ? AND key NOT LIKE ?", "%:" + dayKey(ms), "%:burst:%").run();
  /* burst rows are per minute: anything not from this minute is already spent */
  await q(env, "DELETE FROM counters WHERE key LIKE ? AND key NOT LIKE ?", "%:burst:%", "%:burst:" + minKey(ms)).run();
  await q(env, "DELETE FROM audit WHERE ts < ?", ms - 90 * DAY).run();
  return { expired: expired.length, abandoned, purgedTurns: purged };
}

export default {
  async fetch(req, env, ctx) {
    const h = cors(env, req.headers.get("origin") || "");
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    let res;
    try { res = await handle(req, env, ctx); } catch (e) { console.error("partner", String(e && e.message || e).slice(0, 200)); res = err(500, "server", env.DEV_AUTH === "1" ? String(e && e.message || e).slice(0, 200) : undefined); }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(h)) out.headers.set(k, v);
    return out;
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(maintenance(env, Date.now())); },
};
export { screenTranscript, maintenance, score, WEIGHTS_DEFAULT, SAFETY_LIMITS_DEFAULT, minKey };
