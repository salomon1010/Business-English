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
     session and is permanent both ways.
   - Reliability (completed / abandoned sessions, response latency) is an
     internal matching signal, never shown to anyone.
   - Live practice (Level 3): /live routes, LIVE_ENABLED="1" only where allowed;
     WebRTC audio peer to peer, signalling relayed as rows, nothing recorded.
   - PARTNER_ENABLED != "1" → 503 `disabled` on everything but /health.
   - DEV_AUTH="1" (local wrangler env only) accepts X-Dev-User / X-Dev-Now so
     the whole flow runs locally with no Firebase account and a movable clock.
   ============================================================================ */

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const MAX_AUDIO_BYTES = 1_500_000, MAX_TURN_MS = 75_000, MAX_NAME = 24, MAX_TRANSCRIPT = 2000;
const DAY = 86_400_000, SUSPEND_MS = 30 * DAY, PURGE_AFTER_CLOSE_MS = 14 * DAY, OFFER_TTL_MS = 30 * 60_000, COOLDOWN_MS = 14 * DAY;
const BANDS = ["fnd-1-7", "fnd-8-15", "w1-4", "w5-8", "w9-12"];
const TRACKS = new Set(["general-english"]);                       // the product boundary — see header
const GOALS = new Set(["casual", "workplace", "interview", "pronunciation", "daily", "fluency"]);
const MODES = new Set(["voice", "live", "either"]);
const AVAIL = new Set(["morning", "afternoon", "evening", "weekends"]);
const REASONS = new Set(["harassment", "contact_info", "not_english", "abuse", "other"]);
const DAILY_LIMITS = { interest: 10, match: 30, invite: 10, report: 5, block: 20, decide: 40, live: 20 };
/* live practice: an invitation waits 10 min, an accepted/active session may last 45 min from its last transition */
const LIVE_INVITE_MS = 10 * 60_000, LIVE_SESSION_MS = 45 * 60_000, LIVE_MAX_SIGNALS = 400;
const LIVE_OPEN = new Set(["invited", "accepted", "connecting", "active", "reconnecting"]);
const LIVE_KINDS = new Set(["offer", "answer", "ice", "state", "round", "bye"]);
const IP_PER_MIN_DEFAULT = 300;   // two phones on one Wi-Fi polling a live call sit around 100/min together
/* soft-scoring weights; overridable per environment through MATCH_WEIGHTS (JSON) */
const WEIGHTS_DEFAULT = { level: 0.22, goal: 0.20, curriculum: 0.16, mode: 0.12, availability: 0.10, timezone: 0.08, topic: 0.05, reliability: 0.04, history: 0.03 };
const MIN_MATCH_SCORE = 0.35;

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
/* report and block are shared by the async thread and live practice */
async function doReport(env, uid, other, ctxId, reason, ms) {
  if (await bump(env, uid, "report", ms) > DAILY_LIMITS.report) return err(429, "limit");
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
  if (await bump(env, uid, "block", ms) > DAILY_LIMITS.block) return err(429, "limit");
  const [x, y] = pairKey(uid, other);
  await env.DB.batch([
    q(env, "INSERT OR IGNORE INTO blocks(by_uid,about_uid,created_at) VALUES(?,?,?)", uid, other, ms),
    q(env, "INSERT INTO connections(a,b,state,sessions,created_at,updated_at) VALUES(?,?,'blocked',0,?,?) ON CONFLICT(a,b) DO UPDATE SET state='blocked', updated_at=excluded.updated_at", x, y, ms, ms),
  ]);
  const p = await activePair(env, uid); if (p && otherOf(p, uid) === other) await closePair(env, p, "blocked", ms);
  const l = await openLive(env, uid); if (l && (l.host === other || l.guest === other)) await liveClose(env, l, "ended", "blocked", ms);
  return null;
}
async function closePair(env, pair, reason, ms) { await q(env, "UPDATE pairs SET status='closed', closed_reason=?, closed_at=? WHERE id=? AND status='active'", reason, ms, pair.id).run(); }
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
  return { score: s, reasons: r.slice(0, 2) };
}
/* hard filters, then scoring, then diversification (candidates offered
   often in the last day are pushed down so a small pool is not exhausted) */
async function candidates(env, uid, ms, limit = 3) {
  const me = await q(env, "SELECT * FROM interest WHERE uid=?", uid).first();
  const mm = await member(env, uid);
  if (!me || !mm) return [];
  const rows = (await q(env, `SELECT i.uid, i.track, i.band, i.lang, i.prompt_week, i.fnd_day, i.mode AS imode, i.topic, i.goals, i.created_at,
      m.gender, m.same_gender, m.suspended_until, m.opted_out, m.mode, m.avail, m.tz, m.sessions_completed, m.sessions_abandoned
    FROM interest i JOIN members m ON m.uid=i.uid WHERE i.uid<>? AND i.track=? ORDER BY i.created_at ASC LIMIT 200`, uid, me.track).all()).results || [];
  const W = weights(env), out = [];
  for (const c of rows) {
    if (!TRACKS.has(c.track)) continue;
    if (c.suspended_until && c.suspended_until > ms) continue;
    if (c.opted_out) continue;
    if (Math.abs(bandIdx(me.band) - bandIdx(c.band)) > 1) continue;
    if (mm.same_gender && (!mm.gender || c.gender !== mm.gender)) continue;
    if (c.same_gender && (!c.gender || c.gender !== mm.gender)) continue;
    if (await blockedEither(env, uid, c.uid)) continue;
    if (await cooled(env, uid, c.uid, ms)) continue;
    if (await activePair(env, c.uid)) continue;
    const conn = await connection(env, uid, c.uid);
    if (conn && (conn.state === "blocked" || conn.state === "disconnected")) continue;
    const { score: s, reasons } = score(me, mm, c, W, conn && conn.sessions > 0);
    if (s < MIN_MATCH_SCORE) continue;
    const exposure = (await q(env, "SELECT COUNT(*) AS n FROM offers WHERE cand_uid=? AND created_at>?", c.uid, ms - DAY).first()).n;
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
    cards.push({ offer: id, name: p ? p.name : "?", band: c.band, goals: jl(c.goals).slice(0, 2), topic: c.topic || "", availability: c.imode === "now" ? "now" : "later", reasons, waitingMin: Math.max(0, Math.round((ms - c.created_at) / 60_000)) });
  }
  return cards;
}
/* pair two people atomically: both interest rows must still exist. In D1 a
   batch is one transaction, so two inviters racing for the same candidate
   cannot both win — the second sees fewer than two rows deleted. */
async function createPair(env, uid, cand, ms, seed) {
  const conn = await connection(env, uid, cand);
  const kind = conn && (conn.state === "mutual" || conn.state === "regular") ? "regular" : "trial";
  const id = rid();
  const [x, y] = pairKey(uid, cand);
  const res = await env.DB.batch([
    q(env, "DELETE FROM interest WHERE uid IN (?,?)", uid, cand),
    q(env, "INSERT INTO pairs(id,uid_a,uid_b,track,band,prompt_week,fnd_day,week_start,status,created_at,kind,rounds,prompt_json) VALUES(?,?,?,?,?,?,?,?,'active',?,?,4,?)",
      id, x, y, seed.track, seed.band, seed.promptWeek, seed.fndDay, ms, ms, kind, seed.promptJson || null),
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
    out.waiting = { track: waiting.track, band: waiting.band, mode: waiting.mode, since: waiting.created_at, count: c ? c.n : 1 };
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
    const last = await q(env, "SELECT closed_reason, closed_at FROM pairs WHERE status='closed' AND (uid_a=? OR uid_b=?) ORDER BY closed_at DESC LIMIT 1", uid, uid).first();
    if (last && ms - last.closed_at < 3 * DAY) out.lastClosed = { reason: last.closed_reason, at: last.closed_at };
    const conns = (await q(env, "SELECT * FROM connections WHERE (a=? OR b=?) AND state IN ('mutual','regular') ORDER BY last_practice_at DESC LIMIT 1", uid, uid).all()).results || [];
    if (conns[0]) { const other = conns[0].a === uid ? conns[0].b : conns[0].a; const p = await member(env, other); if (p && !(await blockedEither(env, uid, other))) out.connection = { name: p.name, state: conns[0].state, sessions: conns[0].sessions, lastPracticeAt: conns[0].last_practice_at, canStart: !(await activePair(env, other)), canLive: env.LIVE_ENABLED === "1" && !(await openLive(env, other)) }; }
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
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, "") || "/", ms = now(req, env);
  const ip = req.headers.get("cf-connecting-ip") || "0";
  if (ipLimited(ip, env)) return err(429, "ip_limit");
  if (path === "/health") return json({ ok: true, dev: env.DEV_AUTH === "1", enabled: env.PARTNER_ENABLED === "1" });
  if (env.PARTNER_ENABLED !== "1") return err(503, "disabled");
  if (req.method === "POST" && path === "/__reset" && env.DEV_AUTH === "1") {
    for (const t of ["turns", "pairs", "interest", "reports", "blocks", "counters", "members", "connections", "cooldowns", "offers", "audit", "live_signals", "live_sessions"]) await q(env, `DELETE FROM ${t}`).run();
    let cursor; do { const l = await env.AUDIO.list({ cursor }); for (const o of l.objects) await env.AUDIO.delete(o.key); cursor = l.truncated ? l.cursor : null; } while (cursor);
    return json({ ok: true });
  }

  const uid = await authUid(req, env);
  if (!uid) return err(401, "auth");
  const m = await member(env, uid);
  if (m && ms - m.last_seen > 60_000) await q(env, "UPDATE members SET last_seen=? WHERE uid=?", ms, uid).run();
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
    if (m) await q(env, "UPDATE members SET name=?, lang=?, gender=?, same_gender=?, adult=1, goals=?, mode=?, avail=?, tz=?, last_seen=? WHERE uid=?", name, lang, gender, same, goals, mode, avail, tz, ms, uid).run();
    else await q(env, "INSERT INTO members(uid,name,lang,gender,same_gender,consent_at,created_at,last_seen,adult,goals,mode,avail,tz) VALUES(?,?,?,?,?,?,?,?,1,?,?,?,?)", uid, name, lang, gender, same, ms, ms, ms, goals, mode, avail, tz).run();
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
    if (await bump(env, uid, "interest", ms) > DAILY_LIMITS.interest) return err(429, "limit");
    const lang = /^[a-z]{2}$/.test(b.lang || "") ? b.lang : m.lang;
    const pw = Math.max(0, Math.min(12, Number(b.promptWeek) || 0)), fd = Math.max(0, Math.min(15, Number(b.fndDay) || 0));
    const mode = b.mode === "now" ? "now" : "later", topic = clean(b.topic, 60);
    const gl = parseList(b.goals, GOALS, 3), goals = JSON.stringify(gl.length ? gl : jl(m.goals));
    await q(env, "INSERT INTO interest(uid,track,band,lang,prompt_week,fnd_day,created_at,mode,topic,goals) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET track=excluded.track, band=excluded.band, lang=excluded.lang, prompt_week=excluded.prompt_week, fnd_day=excluded.fnd_day, mode=excluded.mode, topic=excluded.topic, goals=excluded.goals",
      uid, b.track, b.band, lang, pw, fd, ms, mode, topic, goals).run();
    await audit(env, ms, uid, "queue_joined", null, null, { mode });
    let pairId = null, cards = [];
    const cands = await candidates(env, uid, ms, 3);
    if (mode === "now" && cands.length) {
      const mine = await q(env, "SELECT * FROM interest WHERE uid=?", uid).first();
      pairId = await createPair(env, uid, cands[0].c.uid, ms, seedFrom(mine, cands[0].c, b.phrase));
    } else if (cands.length) cards = await offerCards(env, uid, ms, cands);
    return json({ status: pairId ? "paired" : "waiting", candidates: cards, ...(await meView(env, uid, ms)) });
  }
  if (req.method === "DELETE" && path === "/interest") { await q(env, "DELETE FROM interest WHERE uid=?", uid).run(); return json(await meView(env, uid, ms)); }

  /* POST /match — up to 3 candidates for a learner in the queue, each with a reason. Opaque offer ids, never uids. */
  if (req.method === "POST" && path === "/match") {
    if (suspended) return err(403, "suspended", m.suspended_until);
    if (await activePair(env, uid)) return err(409, "paired");
    if (!(await q(env, "SELECT 1 AS x FROM interest WHERE uid=?", uid).first())) return err(409, "not_waiting");
    if (await bump(env, uid, "match", ms) > DAILY_LIMITS.match) return err(429, "limit");
    const cards = await offerCards(env, uid, ms, await candidates(env, uid, ms, 3));
    return json({ candidates: cards, ...(await meView(env, uid, ms)) });
  }

  /* POST /invite {offer, phrase?} — try a practice with an offered candidate */
  if (req.method === "POST" && path === "/invite") {
    if (suspended) return err(403, "suspended", m.suspended_until);
    const b = await req.json().catch(() => ({}));
    const off = /^[a-f0-9]{16}$/.test(b.offer || "") ? await q(env, "SELECT * FROM offers WHERE id=? AND for_uid=?", b.offer, uid).first() : null;
    if (!off || off.expires_at < ms) return err(404, "offer");
    if (await bump(env, uid, "invite", ms) > DAILY_LIMITS.invite) return err(429, "limit");
    if (await activePair(env, uid)) return err(409, "paired");
    const mine = await q(env, "SELECT * FROM interest WHERE uid=?", uid).first(), theirs = await q(env, "SELECT * FROM interest WHERE uid=?", off.cand_uid).first();
    if (!mine || !theirs || await blockedEither(env, uid, off.cand_uid) || await cooled(env, uid, off.cand_uid, ms)) return err(409, "gone");
    const pairId = await createPair(env, uid, off.cand_uid, ms, seedFrom(mine, theirs, b.phrase));
    if (!pairId) return err(409, "gone");
    return json({ status: "paired", ...(await meView(env, uid, ms)) });
  }

  /* pair-scoped: /pairs/:id/(seen|leave|report|block|decide) */
  let pm = /^\/pairs\/([a-f0-9]{16})\/(seen|leave|report|block|decide)$/.exec(path);
  if (pm && req.method === "POST") {
    const pair = await q(env, "SELECT * FROM pairs WHERE id=?", pm[1]).first();
    if (!isMember(pair, uid)) return err(403, "forbidden");
    const other = otherOf(pair, uid);
    if (await blockedEither(env, uid, other) && pm[2] !== "block") return err(403, "forbidden");
    if (pm[2] === "seen") { await q(env, `UPDATE pairs SET ${pair.uid_a === uid ? "seen_a" : "seen_b"}=? WHERE id=?`, ms, pair.id).run(); return json({ ok: true }); }
    if (pm[2] === "leave") { await closePair(env, pair, "left", ms); await audit(env, ms, uid, "left", other, pair.id, {}); return json(await meView(env, uid, ms)); }
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
      if (!["continue", "rematch"].includes(b.choice)) return err(400, "bad_request");
      if (pair.status !== "active") return err(409, "closed");
      if (await bump(env, uid, "decide", ms) > DAILY_LIMITS.decide) return err(429, "limit");
      const turns = (await q(env, "SELECT from_uid, created_at FROM turns WHERE pair_id=?", pair.id).all()).results || [];
      const rv = roundsView(pair, turns, uid);
      const myLast = [...turns].reverse().find(t => t.from_uid === uid);
      const silentMs = ms - Math.max(myLast ? myLast.created_at : 0, pair.created_at);
      if (!rv.complete && !(b.choice === "rematch" && silentMs >= Number(env.PARTNER_TIMEOUT_H || 24) * 3_600_000)) return err(409, "not_complete");
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
        await closePair(env, fresh, "rematch", ms);
      } else if (fresh.decision_a === "continue" && fresh.decision_b === "continue") {
        const conn = await connection(env, uid, other);
        const sessions = ((conn && conn.sessions) || 0) + 1;
        const state = sessions >= 2 ? "regular" : "mutual";
        await q(env, "INSERT INTO connections(a,b,state,sessions,created_at,updated_at,last_practice_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(a,b) DO UPDATE SET state=excluded.state, sessions=excluded.sessions, updated_at=excluded.updated_at, last_practice_at=excluded.last_practice_at", x, y, state, sessions, ms, ms, ms).run();
        await closePair(env, fresh, "completed", ms);
        await audit(env, ms, "system", "connection_" + state, y, pair.id, { sessions });
      }
      return json(await meView(env, uid, ms));
    }
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
      const conns = (await q(env, "SELECT * FROM connections WHERE (a=? OR b=?) AND state IN ('mutual','regular')", uid, uid).all()).results || [];
      const c = conns[0]; if (!c) return err(404, "no_connection");
      const other = c.a === uid ? c.b : c.a;
      if (await blockedEither(env, uid, other)) return err(403, "forbidden");
      const mine = await openLive(env, uid); if (mine) return json({ live: await withName(view(mine, uid)), ...(await meView(env, uid, ms)) });   // idempotent
      if (await openLive(env, other)) return err(409, "busy");
      if (await bump(env, uid, "live", ms) > DAILY_LIMITS.live) return err(429, "limit");
      const id = rid();
      await q(env, "INSERT INTO live_sessions(id,host,guest,state,band,prompt_week,fnd_day,prompt_json,created_at,updated_at,expires_at) VALUES(?,?,?,'invited',?,?,?,?,?,?,?)",
        id, uid, other, BANDS.includes(b.band) ? b.band : null, Math.max(0, Math.min(12, Number(b.promptWeek) || 0)), Math.max(0, Math.min(15, Number(b.fndDay) || 0)), b.phrase ? JSON.stringify({ phrase: clean(b.phrase, 160) }) : null, ms, ms, ms + LIVE_INVITE_MS).run();
      await audit(env, ms, uid, "live_invited", other, id, {});
      const s = await q(env, "SELECT * FROM live_sessions WHERE id=?", id).first();
      return json({ live: await withName(view(s, uid)), ...(await meView(env, uid, ms)) }, 201);
    }
    const lm = /^\/live\/([a-f0-9]{16})(?:\/(accept|decline|cancel|signal|signals|end|report|block))?$/.exec(path);
    if (!lm) return err(404, "not_found");
    const s = await q(env, "SELECT * FROM live_sessions WHERE id=?", lm[1]).first();
    if (!s || (s.host !== uid && s.guest !== uid)) return err(403, "forbidden");
    const other = s.host === uid ? s.guest : s.host, isHost = s.host === uid, act = lm[2] || "";
    if (act !== "block" && await blockedEither(env, uid, other)) return err(403, "forbidden");
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
    const mime = /^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)/i.test(audio.type) ? audio.type.split(";")[0] : "audio/webm";
    const ext = mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("mpeg") ? "mp3" : "webm";
    const key = `pairs/${pair.id}/${turnId}.${ext}`;
    await env.AUDIO.put(key, audio.stream(), { httpMetadata: { contentType: mime } });
    try {
      await q(env, "INSERT INTO turns(id,pair_id,from_uid,day,seq,audio_key,mime,bytes,duration_ms,transcript,score,created_at) VALUES(?,?,?,0,?,?,?,?,?,?,?,?)",
        turnId, pair.id, uid, turns.length + 1, key, mime, audio.size, durationMs, transcript, score, ms).run();
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
  await q(env, "DELETE FROM offers WHERE expires_at < ?", ms).run();
  await q(env, "DELETE FROM cooldowns WHERE until < ?", ms).run();
  await q(env, "DELETE FROM counters WHERE key NOT LIKE ?", "%:" + dayKey(ms)).run();
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
export { screenTranscript, maintenance, score, WEIGHTS_DEFAULT };
