/* BE Mastery — Welding Mastery's server side (9 Oct 2026), inside be-polish.
   ----------------------------------------------------------------------------
   One JSON route, `{ wm: { op, … } }`. Everything that must not rest on the
   learner's own device lives here:

     · AUTHENTICATION   every op needs a verified Firebase account (the same
                        be-entitlements check every AI route uses). No token → 401.
     · THE PROGRAMME    Welding Professional English only, decided from the
                        ACCOUNT, never from the request: the partner Worker's
                        GET /programme reads the caller's own Firestore record
                        with the caller's token. Anything else → 403 "track".
     · ENERGY           Free: WM_FREE_ENERGY challenge rounds per UTC day.
                        Premium: no cap. Charged ONCE per round id when the round
                        STARTS — never per answer, never for a wrong answer, never
                        twice for a retry, a double tap or a resumed round. Cards
                        (review) and the daily challenge cost nothing.
     · XP               Awarded HERE, once per round id, from the round's own
                        reported tally, bounded per game and per day, only for a
                        round this server started (an HMAC ticket). The total is
                        kept on the server; the app shows the server's figure.
     · PREMIUM PACK     the advanced workshop scenarios are served only to a
                        verified Premium account, from Workers KV — not from the
                        public site, whose repository is public.

   Storage is the RateLimiter Durable Object every limit already uses (one
   object per account, atomic all-or-nothing consumes, which bucket refused is
   reported), plus its read-only peek. Fixed windows: each bucket is named with
   its UTC day, so a new day is a new bucket.

   HONEST LIMITS: the server cannot see the answers themselves, so it bounds what
   a round can be worth instead (an altered client can claim a perfect round, at
   most WM_MAX_ANSWERS[mode] answers, at most WM_XP_DAY_CAP a day, and only for
   a round it really started — energy spent for Free). Mastery, the spaced-
   repetition schedule and the per-word history stay on the device: they are the
   learner's own study record and buy nothing.

   TWO PROGRAMMES (10 Oct 2026). The same rules serve Welding Mastery and
   English Mastery (General English). The request names the programme
   (`prog`: "welding" — the default, so an older Welding client is unchanged —
   or "general-english"); the server serves it only when the ACCOUNT's own
   programme is that one, so a Welding account can never start, finish or earn
   in English Mastery and the reverse. Each programme has its own games, its own
   buckets (Welding keeps its original names; General English is prefixed
   "em"), its own energy (5 a day each for Free) and its own Premium pack key.
   ============================================================================ */
import { consume, peek } from "./rate-limit.js";

export const WM_MODES = ["cards", "quiz", "crossword", "visual", "listen", "builder", "match", "workshop", "daily", "advanced"];
/* the seven challenge games cost one unit; Cards is review, the daily challenge is the daily habit */
export const WM_CHARGED = new Set(["quiz", "crossword", "visual", "listen", "builder", "match", "workshop", "advanced"]);
export const WM_FREE_ENERGY = 5;
export const WM_MAX_ANSWERS = { cards: 20, quiz: 10, crossword: 10, visual: 10, listen: 10, builder: 10, match: 10, workshop: 8, daily: 8, advanced: 10 };
/* English Mastery's eight games: Word Quest (cards, review), Quick Quiz, Sentence Builder,
   Listen & Win, Speak Up, Phrase Match, Word Puzzle, Real-Life Missions */
export const EM_MODES = ["cards", "quiz", "sentence", "listen", "speak", "match", "puzzle", "missions", "daily", "advanced"];
export const EM_CHARGED = new Set(["quiz", "sentence", "listen", "speak", "match", "puzzle", "missions", "advanced"]);
export const EM_MAX_ANSWERS = { cards: 20, quiz: 10, sentence: 8, listen: 10, speak: 6, match: 10, puzzle: 10, missions: 6, daily: 8, advanced: 8 };
/* per programme: which account track it belongs to, its games, its bucket prefix, its pack */
export const PROGS = {
  "welding":         { track: "welding",         modes: WM_MODES, charged: WM_CHARGED, max: WM_MAX_ANSWERS, pre: "wm", pack: "advanced-v1" },
  "general-english": { track: "general-english", modes: EM_MODES, charged: EM_CHARGED, max: EM_MAX_ANSWERS, pre: "em", pack: "ge-advanced-v1" },
};
export const WM_XP = { answer: 2, round: 10, daily: 30 };
export const WM_XP_DAY_CAP = 600;
/* per game per day: repeating the free review (Cards) or one favourite game all day stops paying at this */
export const WM_XP_MODE_DAY_CAP = 120;
const ROUND_MIN = 5;                       // a round of at least this many answers pays the round bonus
const DAY_MS = 86_400_000;
const TICKET_DAYS = 2;                     // a round may be finished up to two days after it started

const utcDay = now => new Date(now).toISOString().slice(0, 10);
const midnightAfter = now => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
const SID = /^[a-z0-9-]{8,48}$/;

/* ---- the round ticket: proof that THIS server started THIS round for THIS account ---- */
async function hmacKey(env) {
  const secret = String(env.WM_SECRET || (env.OPENAI_KEY ? "wm-ticket:" + env.OPENAI_KEY : ""));
  if (!secret) return null;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/* the programme is signed in for General English, so a ticket from one programme
   cannot finish a round in the other; Welding's tickets keep their original form */
export async function wmTicket(env, uid, sid, mode, day, prog = "welding") {
  const k = await hmacKey(env); if (!k) return null;
  const parts = prog === "welding" ? [uid, sid, mode, day] : [uid, sid, mode, day, prog];
  return b64u(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(parts.join("|"))));
}
async function ticketOk(env, uid, sid, mode, ticket, now, prog) {
  if (typeof ticket !== "string" || ticket.length > 64) return null;
  for (let i = 0; i <= TICKET_DAYS; i++) {
    const day = utcDay(now - i * DAY_MS);
    if (ticket === await wmTicket(env, uid, sid, mode, day, prog)) return day;
  }
  return null;
}

/* ---- the programme, from the account ---- */
const trackCache = new Map();               // uid -> { track, at }
const TRACK_TTL = 10 * 60_000;
async function programme(req, env, uid, want) {
  const hit = uid && trackCache.get(uid);
  /* only a cached answer that MATCHES is trusted: a learner who has just switched
     programme is asked about again at once, not refused for the cache's ten minutes */
  if (hit && Date.now() - hit.at < TRACK_TTL && (!want || hit.track === want)) return { track: hit.track };
  if (!env.PARTNER_API) return { status: 503 };
  let r;
  try { r = await fetch(String(env.PARTNER_API).replace(/\/+$/, "") + "/programme", { headers: { authorization: req.headers.get("Authorization") || "" } }); }
  catch (e) { return { status: 503 }; }
  if (r.status === 401) return { status: 401 };
  if (r.status === 403) return { track: null };                  // track_unverified: no programme on the account
  if (!r.ok) return { status: 503 };
  let j; try { j = await r.json(); } catch (e) { return { status: 503 }; }
  const track = j && typeof j.track === "string" ? j.track : null;
  if (uid) { if (trackCache.size > 5000) trackCache.clear(); trackCache.set(uid, { track, at: Date.now() }); }
  return { track };
}

/* ---- the account's numbers, per programme (Welding: "wm…", the original names) ---- */
const buckets = pre => ({
  energy: day => pre + "en:" + day,
  xpDay: day => pre + "xpd:" + day,
  xpMode: (day, mode) => pre + "xpm:" + day + ":" + mode,
  xp: pre + "xp",
  daily: day => pre + "daily:" + day,
  started: sid => pre + "s:" + sid,
  finished: sid => pre + "f:" + sid,
});
async function standing(env, subject, now, premium, B) {
  const day = utcDay(now);
  const p = await peek(env, subject, [B.energy(day), B.xpDay(day), B.xp, B.daily(day)]);
  if (!p.ok) return null;
  const c = p.counts || {};
  return {
    day, plan: premium ? "premium" : "free",
    energy: { used: premium ? 0 : Math.min(WM_FREE_ENERGY, c[B.energy(day)] || 0), limit: premium ? null : WM_FREE_ENERGY, resetAt: midnightAfter(now) },
    xp: { total: c[B.xp] || 0, today: c[B.xpDay(day)] || 0, dayCap: WM_XP_DAY_CAP },
    daily: { done: (c[B.daily(day)] || 0) > 0 },
  };
}

/* XP a finished round is worth, from its reported tally, bounded by the game */
export function roundXp(mode, n, ok, maxes = WM_MAX_ANSWERS) {
  const max = maxes[mode] || 10;
  const N = Math.max(0, Math.min(max, Math.floor(+n || 0)));
  const K = Math.max(0, Math.min(N, Math.floor(+ok || 0)));
  return { n: N, ok: K, xp: K * WM_XP.answer + (N >= ROUND_MIN ? WM_XP.round : 0) };
}

/* the handler. deps = { capabilities, perAccount, json } from polish-worker.js */
export async function wmHandle(body, req, env, cors, deps) {
  const { json } = deps;
  const w = body && body.wm;
  const op = w && typeof w.op === "string" ? w.op : "";
  if (!["status", "start", "finish", "pack"].includes(op)) return json({ error: "bad_request" }, 400, cors);
  const progId = w.prog === undefined ? "welding" : String(w.prog);
  const P = Object.prototype.hasOwnProperty.call(PROGS, progId) ? PROGS[progId] : null;
  if (!P) return json({ error: "bad_request" }, 400, cors);
  const B = buckets(P.pre);
  if (!env.ENTITLEMENTS_URL) return json({ error: "wm_unavailable" }, 503, cors);   // no account service here (production today)

  const a = await deps.capabilities(req, env);
  if (a.status === 401) return json({ error: "auth_required" }, 401, cors);
  if (a.status === 503) return json({ error: "entitlement_unavailable" }, 503, cors);
  if (!a.uid) return json({ error: "auth_required" }, 401, cors);

  const t = await programme(req, env, a.uid, P.track);
  if (t.status === 401) return json({ error: "auth_required" }, 401, cors);
  if (t.status === 503) return json({ error: "track_unavailable" }, 503, cors);
  /* the ACCOUNT's programme must be the one asked for — never the request's word for it */
  if (t.track !== P.track) return json({ error: "track", track: t.track || null }, 403, cors);

  const held = await deps.perAccount(a, env, cors);
  if (held) return held;

  const subject = "acct:u:" + a.uid, now = Date.now(), day = utcDay(now), premium = a.premium === true;

  if (op === "status") {
    const s = await standing(env, subject, now, premium, B);
    return s ? json(s, 200, cors) : json({ error: "wm_store_unavailable" }, 503, cors);
  }

  if (op === "pack") {
    if (!premium) return json({ error: "premium_required" }, 402, cors);
    if (!env.WM_PACK) return json({ error: "pack_unavailable" }, 503, cors);
    let pack = null; try { pack = await env.WM_PACK.get(P.pack, "json"); } catch (e) {}
    if (!pack) return json({ error: "pack_unavailable" }, 503, cors);
    return json(pack, 200, { ...cors, "cache-control": "private, no-store" });
  }

  const sid = String(w.sid || ""), mode = String(w.mode || "");
  if (!SID.test(sid) || !P.modes.includes(mode)) return json({ error: "bad_request" }, 400, cors);
  if (mode === "advanced" && !premium) return json({ error: "premium_required" }, 402, cors);

  if (op === "start") {
    const charged = P.charged.has(mode) && !premium;
    /* all-or-nothing: the round id first, so a repeat is recognised before any energy is looked at */
    const buckets = [{ name: B.started(sid), limit: 1, windowMs: (TICKET_DAYS + 1) * DAY_MS }];
    if (charged) buckets.push({ name: B.energy(day), limit: WM_FREE_ENERGY, windowMs: DAY_MS });
    const r = await consume(env, subject, buckets);
    const ticket = await wmTicket(env, a.uid, sid, mode, day, progId);
    if (!ticket) return json({ error: "wm_unavailable" }, 503, cors);
    if (!r.ok && r.bucket === B.started(sid)) {
      const s = await standing(env, subject, now, premium, B);
      return json({ ok: true, duplicate: true, sid, mode, ticket, charged: false, ...(s || {}) }, 200, cors);
    }
    if (!r.ok) {
      const resetAt = midnightAfter(now);
      return json({ error: "energy", used: WM_FREE_ENERGY, limit: WM_FREE_ENERGY, resetAt, plan: "free", retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)) }, 429, cors);
    }
    const s = await standing(env, subject, now, premium, B);
    return json({ ok: true, sid, mode, ticket, charged, degraded: !!r.degraded, ...(s || {}) }, 200, cors);
  }

  /* op === "finish" */
  const startedDay = await ticketOk(env, a.uid, sid, mode, w.ticket, now, progId);
  if (!startedDay) return json({ error: "ticket" }, 403, cors);
  const { n, ok, xp: base } = roundXp(mode, w.n, w.ok, P.max);
  const wantDaily = mode === "daily" && ok >= 1;
  const tryAward = async (xp, daily) => {
    const bs = [{ name: B.finished(sid), limit: 1, windowMs: (TICKET_DAYS + 1) * DAY_MS }];
    if (xp > 0) bs.push({ name: B.xpDay(day), limit: WM_XP_DAY_CAP, windowMs: DAY_MS, cost: xp }, { name: B.xpMode(day, mode), limit: WM_XP_MODE_DAY_CAP, windowMs: DAY_MS, cost: xp }, { name: B.xp, limit: 1e12, windowMs: 100 * 365 * DAY_MS, cost: xp });
    if (daily) bs.push({ name: B.daily(day), limit: 1, windowMs: DAY_MS });
    return consume(env, subject, bs);
  };
  let award = base + (wantDaily ? WM_XP.daily : 0), daily = wantDaily;
  let r = await tryAward(award, daily);
  /* which bucket refused decides the next step: a finished round is a duplicate
     (nothing more is paid); a daily bonus already taken is dropped; a full day
     cap pays nothing more today but still closes the round */
  if (!r.ok && r.bucket === B.daily(day)) { daily = false; award = base; r = await tryAward(award, false); }
  if (!r.ok && (r.bucket === B.xpDay(day) || r.bucket === B.xpMode(day, mode))) { award = 0; r = await tryAward(0, false); }
  if (!r.ok && r.bucket === B.finished(sid)) {
    const s = await standing(env, subject, now, premium, B);
    return json({ ok: true, duplicate: true, awarded: 0, n, okAnswers: ok, ...(s || {}) }, 200, cors);
  }
  if (!r.ok) return json({ error: "wm_store_unavailable" }, 503, cors);
  /* a limiter that failed OPEN cannot be trusted with a total: say so instead of inventing one */
  if (r.degraded && !r.counts) return json({ error: "wm_store_unavailable" }, 503, cors);
  const s = await standing(env, subject, now, premium, B);
  return json({ ok: true, awarded: award, dailyBonus: daily ? WM_XP.daily : 0, n, okAnswers: ok, ...(s || {}) }, 200, cors);
}
export function _wmReset() { trackCache.clear(); }   // tests only
