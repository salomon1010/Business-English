/* ============================================================================
   BE Mastery — Practice Partner Worker (be-partner)
   ----------------------------------------------------------------------------
   Owns every piece of partner data: who consented, who is waiting, the weekly
   pairs, the voice turns (audio in R2, rows in D1), reports and blocks.
   Nothing of this lives in Firestore; the app's users/{uid} blob is untouched.

   Identity is the Firebase Auth uid, taken from a verified ID token. The
   partner never learns a uid, an e-mail, or anything but a first name, a
   level band and an interface language.

   Design notes that matter (see marketing/product/practice-partner/):
   - No text channel exists. The only text is the transcript the coach made
     from the recording, and it is SCREENED here for contact details before a
     turn is stored. Screening, not moderation — the client copy says so.
   - Audio is never publicly addressable. R2 objects are only streamed by
     GET /turns/:id/audio after a membership + block check.
   - Two distinct reporters suspend a member for 30 days. A block closes the
     pair and is permanent in both directions.
   - DEV_AUTH="1" (local wrangler env only) accepts X-Dev-User and X-Dev-Now
     headers so the whole flow can be tested with no Firebase account and a
     movable clock. Production config must never set it.
   ============================================================================ */

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const MAX_AUDIO_BYTES = 1_500_000;
const MAX_TURN_MS = 75_000;
const MAX_NAME = 24;
const MAX_TRANSCRIPT = 2000;
const DAY = 86_400_000;
const SUSPEND_MS = 30 * DAY;
const PURGE_AFTER_CLOSE_MS = 14 * DAY;
const BANDS = new Set(["fnd-1-7", "fnd-8-15", "w1-4", "w5-8", "w9-12"]);
const TRACKS = new Set(["general-english", "welding"]);
const REASONS = new Set(["harassment", "contact_info", "not_english", "abuse", "other"]);
const DAILY_LIMITS = { interest: 10, report: 5, block: 20 };
const IP_PER_MIN = 120;

/* ---- the transcript screen: anything that could move the conversation off
   the app. Deliberately broad; the cost of a false positive is one re-take. */
const SCREEN = [
  /(?:\+?\d[\s\-.()]*){7,}/,                                   // 7+ digits with any separators — a phone number
  /[\w.+-]+@[\w-]+\.[\w.-]+/i,                                // e-mail
  /https?:\/\/|www\.|\.(?:com|net|org|io|me|app|ly)\b/i,      // links
  /(?:^|\s)@[a-z0-9_.]{3,}/i,                                 // @handle
  /\b(?:whats?\s?app|telegram|instagram|insta|snap\s?chat|facebook|tik\s?tok|discord|signal|viber|imo|wechat|messenger)\b/i,
  /\b(?:my number|mon num[ée]ro|call me|appelle[- ]moi|add me|ajoute[- ]moi)\b/i,
];
function screenTranscript(text) {
  const t = String(text || "");
  for (const re of SCREEN) if (re.test(t)) return false;
  return true;
}

/* ---------------------------------------------------------------- helpers */
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...extra } });
const err = (status, code, detail) => json({ error: code, detail }, status);
const now = (req, env) => {
  if (env.DEV_AUTH === "1") { const h = req.headers.get("x-dev-now"); if (h && /^\d+$/.test(h)) return Number(h); }
  return Date.now();
};
const rid = () => { const b = new Uint8Array(8); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, "0")).join(""); };
const dayKey = ms => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
const midnightUTC = ms => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

function cors(env, origin) {
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) ? origin : allowed[0] || "";
  return {
    "access-control-allow-origin": ok,
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-dev-user,x-dev-now",
    "access-control-max-age": "86400",
    "vary": "origin",
  };
}

/* ---- per-IP limiter, in-memory per isolate (same approach as be-polish) */
const ipHits = new Map();
function ipLimited(ip) {
  const m = Math.floor(Date.now() / 60_000), k = ip + ":" + m;
  const n = (ipHits.get(k) || 0) + 1; ipHits.set(k, n);
  if (ipHits.size > 5000) for (const key of ipHits.keys()) { if (!key.endsWith(":" + m)) ipHits.delete(key); }
  return n > IP_PER_MIN;
}

/* ---- per-uid daily counters in D1 (survive isolates) */
async function bump(env, uid, route, ms) {
  const key = `${uid}:${route}:${dayKey(ms)}`;
  await env.DB.prepare("INSERT INTO counters(key,n) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET n=n+1").bind(key).run();
  const r = await env.DB.prepare("SELECT n FROM counters WHERE key=?").bind(key).first();
  return r ? r.n : 1;
}

/* ------------------------------------------------------------ auth (JWT) */
let jwksCache = { at: 0, keys: null };
async function fetchJwks(fetcher) {
  if (jwksCache.keys && Date.now() - jwksCache.at < 3_600_000) return jwksCache.keys;
  const r = await fetcher(JWKS_URL);
  if (!r.ok) throw new Error("jwks " + r.status);
  const j = await r.json();
  jwksCache = { at: Date.now(), keys: j.keys || [] };
  return jwksCache.keys;
}
const b64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
/* Verify a Firebase ID token (RS256). `deps` lets the test inject a JWKS
   fetcher and a clock; production uses the real ones. Exported for tests. */
export async function verifyIdToken(token, projectId, deps = {}) {
  const fetcher = deps.fetch || fetch, nowMs = deps.now || Date.now();
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("malformed");
  const header = JSON.parse(new TextDecoder().decode(b64u(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64u(parts[1])));
  if (header.alg !== "RS256" || !header.kid) throw new Error("alg");
  const keys = deps.keys || await fetchJwks(fetcher);
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error("kid");
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
  if (env.DEV_AUTH === "1") {
    const dev = req.headers.get("x-dev-user");
    if (dev && /^[a-z0-9_-]{1,64}$/i.test(dev)) return "dev:" + dev;
  }
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  try { return await verifyIdToken(m[1], env.FIREBASE_PROJECT_ID); } catch (e) { return null; }
}

/* --------------------------------------------------------------- queries */
const q = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
async function member(env, uid) { return q(env, "SELECT * FROM members WHERE uid=?", uid).first(); }
async function activePair(env, uid) {
  return q(env, "SELECT * FROM pairs WHERE status='active' AND (uid_a=? OR uid_b=?) ORDER BY created_at DESC LIMIT 1", uid, uid).first();
}
async function blockedEither(env, a, b) {
  const r = await q(env, "SELECT 1 AS x FROM blocks WHERE (by_uid=? AND about_uid=?) OR (by_uid=? AND about_uid=?) LIMIT 1", a, b, b, a).first();
  return !!r;
}
async function closePair(env, pair, reason, ms) {
  await q(env, "UPDATE pairs SET status='closed', closed_reason=?, closed_at=? WHERE id=? AND status='active'", reason, ms, pair.id).run();
}
const otherOf = (pair, uid) => (pair.uid_a === uid ? pair.uid_b : pair.uid_a);
const isMember = (pair, uid) => pair && (pair.uid_a === uid || pair.uid_b === uid);
const pairDay = (pair, ms) => Math.floor((ms - pair.week_start) / DAY);

/* Streaks from turns: duo = consecutive pair-days (ending today or yesterday)
   where BOTH sent; mine = consecutive days I sent. */
function streaks(turns, pair, uid, ms) {
  const today = pairDay(pair, ms);
  const mine = new Set(), theirs = new Set();
  for (const t of turns) (t.from_uid === uid ? mine : theirs).add(t.day);
  const run = pred => { let n = 0, d = pred(today) ? today : today - 1; while (d >= 0 && pred(d)) { n++; d--; } return n; };
  return { duoStreak: run(d => mine.has(d) && theirs.has(d)), myStreak: run(d => mine.has(d)) };
}

/* The view a member gets of their own situation. Never returns the partner's
   uid, gender, e-mail — only name, band, lang. */
async function meView(env, uid, ms) {
  const m = await member(env, uid);
  const out = { uid: null, consented: !!m, name: m ? m.name : null, suspendedUntil: m && m.suspended_until && m.suspended_until > ms ? m.suspended_until : null, serverNow: ms };
  const waiting = m ? await q(env, "SELECT * FROM interest WHERE uid=?", uid).first() : null;
  if (waiting) {
    const c = await q(env, "SELECT COUNT(*) AS n FROM interest WHERE track=? AND band=?", waiting.track, waiting.band).first();
    out.waiting = { track: waiting.track, band: waiting.band, since: waiting.created_at, count: c ? c.n : 1 };
  }
  const pair = m ? await activePair(env, uid) : null;
  if (pair) {
    const partnerUid = otherOf(pair, uid);
    const p = await member(env, partnerUid);
    const turns = (await q(env, "SELECT id,from_uid,day,seq,mime,duration_ms,transcript,score,created_at FROM turns WHERE pair_id=? ORDER BY created_at", pair.id).all()).results || [];
    const seenMe = pair.uid_a === uid ? pair.seen_a : pair.seen_b;
    const myLast = [...turns].reverse().find(t => t.from_uid === uid);
    const theirLast = [...turns].reverse().find(t => t.from_uid !== uid);
    const sinceMs = Math.max(myLast ? myLast.created_at : 0, pair.created_at);
    const silentMs = theirLast && theirLast.created_at > sinceMs ? 0 : ms - sinceMs;
    const timeoutH = Number(env.PARTNER_TIMEOUT_H || 24);
    const day = pairDay(pair, ms);
    const st = streaks(turns, pair, uid, ms);
    out.pair = {
      id: pair.id, track: pair.track, band: pair.band, promptWeek: pair.prompt_week, fndDay: pair.fnd_day,
      weekStart: pair.week_start, day, daysLeft: Math.max(0, Number(env.PAIR_DAYS || 7) - day),
      partner: p ? { name: p.name, band: pair.band, lang: p.lang } : { name: "?", band: pair.band, lang: "en" },
      turns: turns.map(t => ({ id: t.id, mine: t.from_uid === uid, day: t.day, seq: t.seq, mime: t.mime, durationMs: t.duration_ms, transcript: t.transcript, score: t.score, at: t.created_at })),
      unread: turns.filter(t => t.from_uid !== uid && t.created_at > seenMe).length,
      myTurnsToday: turns.filter(t => t.from_uid === uid && t.day === day).length,
      turnsPerDay: Number(env.TURNS_PER_DAY || 3),
      partnerSilentH: Math.floor(silentMs / 3_600_000),
      fallback: silentMs >= timeoutH * 3_600_000,
      canRepair: silentMs >= 2 * timeoutH * 3_600_000,
      ...st,
    };
  } else if (m) {
    const last = await q(env, "SELECT closed_reason, closed_at FROM pairs WHERE status='closed' AND (uid_a=? OR uid_b=?) ORDER BY closed_at DESC LIMIT 1", uid, uid).first();
    if (last && ms - last.closed_at < 3 * DAY) out.lastClosed = { reason: last.closed_reason, at: last.closed_at };
  }
  return out;
}

/* ------------------------------------------------------------- matching */
async function tryPair(env, uid, ms) {
  const me = await q(env, "SELECT * FROM interest WHERE uid=?", uid).first();
  if (!me) return null;
  const mm = await member(env, uid);
  const cands = (await q(env, `SELECT i.*, m.gender, m.same_gender, m.suspended_until FROM interest i JOIN members m ON m.uid=i.uid
     WHERE i.uid<>? AND i.track=? AND i.band=? ORDER BY (i.lang=?) DESC, i.created_at ASC LIMIT 25`, uid, me.track, me.band, me.lang).all()).results || [];
  for (const c of cands) {
    if (c.suspended_until && c.suspended_until > ms) continue;
    if (mm.same_gender && (!mm.gender || c.gender !== mm.gender)) continue;
    if (c.same_gender && (!c.gender || c.gender !== mm.gender)) continue;
    if (await blockedEither(env, uid, c.uid)) continue;
    if (await activePair(env, c.uid)) continue;
    const id = rid();
    const promptWeek = Math.min(me.prompt_week || 99, c.prompt_week || 99) === 99 ? 0 : Math.min(me.prompt_week || 99, c.prompt_week || 99);
    const fndDay = Math.min(me.fnd_day || 99, c.fnd_day || 99) === 99 ? 0 : Math.min(me.fnd_day || 99, c.fnd_day || 99);
    await env.DB.batch([
      q(env, "INSERT INTO pairs(id,uid_a,uid_b,track,band,prompt_week,fnd_day,week_start,status,created_at) VALUES(?,?,?,?,?,?,?,?,'active',?)",
        id, c.uid, uid, me.track, me.band, promptWeek, fndDay, midnightUTC(ms), ms),
      q(env, "DELETE FROM interest WHERE uid IN (?,?)", uid, c.uid),
    ]);
    return id;
  }
  return null;
}

/* ------------------------------------------------------------ handlers */
async function handle(req, env, ctx) {
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, "") || "/", ms = now(req, env);
  const ip = req.headers.get("cf-connecting-ip") || "0";
  if (ipLimited(ip)) return err(429, "ip_limit");
  if (path === "/health") return json({ ok: true, dev: env.DEV_AUTH === "1" });
  /* dev-only: wipe the LOCAL database and bucket so a test run starts clean */
  if (req.method === "POST" && path === "/__reset" && env.DEV_AUTH === "1") {
    for (const t of ["turns", "pairs", "interest", "reports", "blocks", "counters", "members"]) await q(env, `DELETE FROM ${t}`).run();
    let cursor; do { const l = await env.AUDIO.list({ cursor }); for (const o of l.objects) await env.AUDIO.delete(o.key); cursor = l.truncated ? l.cursor : null; } while (cursor);
    return json({ ok: true });
  }

  const uid = await authUid(req, env);
  if (!uid) return err(401, "auth");
  const m = await member(env, uid);
  /* awaited, not waitUntil: the local D1 emulation locks on a write that
     overlaps the next request, and a throttled await costs nothing */
  if (m && ms - m.last_seen > 60_000) await q(env, "UPDATE members SET last_seen=? WHERE uid=?", ms, uid).run();
  const suspended = m && m.suspended_until && m.suspended_until > ms;

  /* GET /me — everything the client needs, in one call */
  if (req.method === "GET" && path === "/me") return json(await meView(env, uid, ms));

  /* POST /consent {name, lang, gender?, sameGender?} */
  if (req.method === "POST" && path === "/consent") {
    const b = await req.json().catch(() => ({}));
    const name = clean(b.name, MAX_NAME) || "Learner";
    const lang = /^[a-z]{2}$/.test(b.lang || "") ? b.lang : "en";
    const gender = ["f", "m", "x"].includes(b.gender) ? b.gender : null;
    const same = b.sameGender && gender ? 1 : 0;
    if (m) await q(env, "UPDATE members SET name=?, lang=?, gender=?, same_gender=?, last_seen=? WHERE uid=?", name, lang, gender, same, ms, uid).run();
    else await q(env, "INSERT INTO members(uid,name,lang,gender,same_gender,consent_at,created_at,last_seen) VALUES(?,?,?,?,?,?,?,?)", uid, name, lang, gender, same, ms, ms, ms).run();
    return json(await meView(env, uid, ms));
  }
  if (!m) return err(403, "consent");

  /* POST /interest {track, band, lang, promptWeek, fndDay} — join the queue, pair at once when possible */
  if (req.method === "POST" && path === "/interest") {
    if (suspended) return err(403, "suspended", m.suspended_until);
    if (await activePair(env, uid)) return err(409, "paired");
    const b = await req.json().catch(() => ({}));
    if (!TRACKS.has(b.track) || !BANDS.has(b.band)) return err(400, "bad_request");
    if (await bump(env, uid, "interest", ms) > DAILY_LIMITS.interest) return err(429, "limit");
    const lang = /^[a-z]{2}$/.test(b.lang || "") ? b.lang : m.lang;
    const pw = Math.max(0, Math.min(12, Number(b.promptWeek) || 0)), fd = Math.max(0, Math.min(15, Number(b.fndDay) || 0));
    await q(env, "INSERT INTO interest(uid,track,band,lang,prompt_week,fnd_day,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET track=excluded.track, band=excluded.band, lang=excluded.lang, prompt_week=excluded.prompt_week, fnd_day=excluded.fnd_day",
      uid, b.track, b.band, lang, pw, fd, ms).run();
    const pairId = await tryPair(env, uid, ms);
    const view = await meView(env, uid, ms);
    return json({ status: pairId ? "paired" : "waiting", ...view });
  }
  if (req.method === "DELETE" && path === "/interest") {
    await q(env, "DELETE FROM interest WHERE uid=?", uid).run();
    return json(await meView(env, uid, ms));
  }

  /* pair-scoped routes: /pairs/:id/(seen|leave|report|block) */
  let pm = /^\/pairs\/([a-f0-9]{16})\/(seen|leave|report|block)$/.exec(path);
  if (pm && req.method === "POST") {
    const pair = await q(env, "SELECT * FROM pairs WHERE id=?", pm[1]).first();
    if (!isMember(pair, uid)) return err(403, "forbidden");
    if (await blockedEither(env, uid, otherOf(pair, uid)) && pm[2] !== "block") return err(403, "forbidden");
    const other = otherOf(pair, uid);
    if (pm[2] === "seen") {
      await q(env, `UPDATE pairs SET ${pair.uid_a === uid ? "seen_a" : "seen_b"}=? WHERE id=?`, ms, pair.id).run();
      return json({ ok: true });
    }
    if (pm[2] === "leave") { await closePair(env, pair, "left", ms); return json(await meView(env, uid, ms)); }
    if (pm[2] === "report") {
      const b = await req.json().catch(() => ({}));
      if (!REASONS.has(b.reason)) return err(400, "bad_request");
      if (await bump(env, uid, "report", ms) > DAILY_LIMITS.report) return err(429, "limit");
      await q(env, "INSERT OR IGNORE INTO reports(id,pair_id,by_uid,about_uid,reason,created_at) VALUES(?,?,?,?,?,?)", rid(), pair.id, uid, other, b.reason, ms).run();
      const n = (await q(env, "SELECT COUNT(DISTINCT by_uid) AS n FROM reports WHERE about_uid=?", other).first()).n;
      await q(env, "UPDATE members SET strikes=? WHERE uid=?", n, other).run();
      if (n >= 2) {
        await q(env, "UPDATE members SET suspended_until=? WHERE uid=?", ms + SUSPEND_MS, other).run();
        await q(env, "DELETE FROM interest WHERE uid=?", other).run();
        await closePair(env, pair, "suspended", ms);
      }
      return json({ ok: true, ...(await meView(env, uid, ms)) });
    }
    if (pm[2] === "block") {
      if (await bump(env, uid, "block", ms) > DAILY_LIMITS.block) return err(429, "limit");
      await q(env, "INSERT OR IGNORE INTO blocks(by_uid,about_uid,created_at) VALUES(?,?,?)", uid, other, ms).run();
      await closePair(env, pair, "blocked", ms);
      return json({ ok: true, ...(await meView(env, uid, ms)) });
    }
  }
  if (req.method === "GET" && (pm = /^\/pairs\/([a-f0-9]{16})$/.exec(path))) {
    const pair = await q(env, "SELECT * FROM pairs WHERE id=?", pm[1]).first();
    if (!isMember(pair, uid) || await blockedEither(env, uid, otherOf(pair, uid))) return err(403, "forbidden");
    return json(await meView(env, uid, ms));
  }

  /* POST /turns — multipart: audio, day, transcript, score, duration_ms, turn_id */
  if (req.method === "POST" && path === "/turns") {
    if (suspended) return err(403, "suspended", m.suspended_until);
    const pair = await activePair(env, uid);
    if (!pair) return err(409, "no_pair");
    if (await blockedEither(env, uid, otherOf(pair, uid))) return err(403, "forbidden");
    const fd = await req.formData().catch(() => null);
    if (!fd) return err(400, "bad_request");
    const audio = fd.get("audio");
    if (!audio || typeof audio === "string") return err(400, "bad_request", "audio");
    const turnId = /^[a-f0-9]{16}$/.test(fd.get("turn_id") || "") ? fd.get("turn_id") : rid();
    const dup = await q(env, "SELECT * FROM turns WHERE id=?", turnId).first();
    if (dup) return json({ turn: { id: dup.id, seq: dup.seq, day: dup.day }, duplicate: true }, 200);
    const day = pairDay(pair, ms);
    if (Number(fd.get("day")) !== day) return err(409, "day", day);
    if (day >= Number(env.PAIR_DAYS || 7)) { await closePair(env, pair, "expired", ms); return err(410, "expired"); }
    const durationMs = Math.max(0, Number(fd.get("duration_ms")) || 0);
    if (audio.size > MAX_AUDIO_BYTES) return err(413, "too_large");
    if (audio.size < 1200 || durationMs > MAX_TURN_MS) return err(400, "bad_request", "audio_size_or_length");
    const cnt = (await q(env, "SELECT COUNT(*) AS n FROM turns WHERE pair_id=? AND from_uid=? AND day=?", pair.id, uid, day).first()).n;
    if (cnt >= Number(env.TURNS_PER_DAY || 3)) return err(429, "limit", "turns_per_day");
    const transcript = clean(fd.get("transcript"), MAX_TRANSCRIPT);
    if (!screenTranscript(transcript)) return err(422, "moderation");
    const score = fd.get("score") === null || fd.get("score") === "" ? null : Math.max(0, Math.min(100, Math.round(Number(fd.get("score")) || 0)));
    const mime = /^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)/i.test(audio.type) ? audio.type.split(";")[0] : "audio/webm";
    const ext = mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("mpeg") ? "mp3" : "webm";
    const key = `pairs/${pair.id}/${turnId}.${ext}`;
    await env.AUDIO.put(key, audio.stream(), { httpMetadata: { contentType: mime } });
    try {
      await q(env, "INSERT INTO turns(id,pair_id,from_uid,day,seq,audio_key,mime,bytes,duration_ms,transcript,score,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        turnId, pair.id, uid, day, cnt + 1, key, mime, audio.size, durationMs, transcript, score, ms).run();
    } catch (e) { await env.AUDIO.delete(key).catch(() => {}); throw e; }
    return json({ turn: { id: turnId, seq: cnt + 1, day, at: ms } }, 201);
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

  /* dev-only: run the daily maintenance on demand for the tests */
  if (req.method === "POST" && path === "/__cron" && env.DEV_AUTH === "1") { const r = await maintenance(env, ms); return json(r); }

  return err(404, "not_found");
}

/* ------------------------------------------------------- daily maintenance */
async function maintenance(env, ms) {
  const pairDays = Number(env.PAIR_DAYS || 7);
  const expired = (await q(env, "SELECT * FROM pairs WHERE status='active' AND week_start <= ?", ms - pairDays * DAY).all()).results || [];
  for (const p of expired) await closePair(env, p, "expired", ms);
  const stale = (await q(env, "SELECT id FROM pairs WHERE status='closed' AND closed_at <= ?", ms - PURGE_AFTER_CLOSE_MS).all()).results || [];
  let purged = 0;
  for (const p of stale) {
    const turns = (await q(env, "SELECT id,audio_key FROM turns WHERE pair_id=?", p.id).all()).results || [];
    for (const t of turns) { await env.AUDIO.delete(t.audio_key).catch(() => {}); purged++; }
    await q(env, "DELETE FROM turns WHERE pair_id=?", p.id).run();
  }
  await q(env, "DELETE FROM counters WHERE key NOT LIKE ?", "%:" + dayKey(ms)).run();
  return { expired: expired.length, purgedTurns: purged };
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get("origin") || "";
    const h = cors(env, origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    let res;
    try { res = await handle(req, env, ctx); }
    catch (e) { res = err(500, "server", String(e && e.message || e)); }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(h)) out.headers.set(k, v);
    return out;
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(maintenance(env, Date.now())); },
};
export { screenTranscript, maintenance };
