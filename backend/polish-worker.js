/* ============================================================================
   BE Mastery — "Executive Polish" backend (Cloudflare Worker)
   ----------------------------------------------------------------------------
   Holds ONE AI key server-side so end users need only an internet connection.
   Returns several professional rewrites of a sentence. Built with hard caps so
   the bill can never run away:
     • CORS locked to the app's own origin (no one else can call it)
     • input length capped (bounds tokens per request)
     • output tokens capped
     • per-IP and per-account rate limits, held in a Durable Object so they
       survive an isolate recycle and apply across isolates (rate-limit.js)
     • REAL hard cap = set a monthly budget limit on the AI provider account
       (see backend/README.md) — that is the backstop that can never be exceeded.

   Provider: OpenAI (model gpt-4o-mini — cheapest capable tier). To use Anthropic
   instead, swap the callAI() body (a few lines) — see README.
   Secret required (Worker → Settings → Variables → add secret):  OPENAI_KEY
   ============================================================================ */

// Local testing happens on whatever port is free, and an origin that is not on
// this list has every AI call blocked by CORS — grading, transcription, natural
// voice and the workshop conversations all fail while the app looks fine. That
// cost real debugging time, so the common dev ports are listed rather than the
// one that happened to be used first.
const ALLOWED_ORIGINS = [
  "https://app.lomonec.com",
  "https://staging.lomonec.com",
  "capacitor://localhost",   // the App Store build (mobile/ios): WKWebView cannot use https for a local bundle
  "https://localhost",       // the Play build as a native shell (mobile/android, androidScheme https)
  "http://localhost:8000",  "http://127.0.0.1:8000",   // python3 -m http.server 8000
  "http://localhost:4173",  "http://127.0.0.1:4173",   // vite preview
  "http://localhost:5173",  "http://127.0.0.1:5173",   // vite dev
  "http://localhost:3000",  "http://127.0.0.1:3000",
];

const MAX_INPUT_CHARS = 400;   // bounds prompt size
const MAX_OUTPUT_TOKENS = 320; // bounds reply size
const RATE_PER_MIN = 15;       // max Polish clicks per IP per minute
const RATE_PER_DAY = 300;      // max Polish clicks per IP per day

// ---- Natural voice (text-to-speech) ----
// Same OpenAI key drives OpenAI's TTS. The app plays this MP3 when online and
// falls back to the browser's built-in voice when offline / on any failure.
const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICES = ["alloy","ash","ballad","coral","echo","fable","nova","onyx","sage","shimmer","verse"];
const MAX_TTS_CHARS = 600;     // bounds each clip (words/sentences are short)
const TTS_PER_MIN = 60;        // Hear/Slow taps are frequent but tiny
const TTS_PER_DAY = 2000;

// ---- Precise word timings (speech-to-text) ----
// Whisper returns per-word start/end times for a recording, so the app can play
// back exactly the word the user said (the "You" button), not a guessed chunk.
const STT_MODEL = "whisper-1";
const MAX_STT_BYTES = 12 * 1024 * 1024;  // ~12 MB — practice clips are short
const STT_PER_MIN = 20;
const STT_PER_DAY = 600;

// ---- YouTube captions (no provider cost; limits just curb abuse of the proxy) ----
const CAP_PER_MIN = 12;
const CAP_PER_DAY = 400;
/* The Gemini transcript route is the only one here that costs money per call,
   and the bill scales with the LENGTH of whatever the learner pasted: roughly
   $0.08 for 15 minutes, so an unattended three-hour podcast is about $1.
   Three separate brakes, because one is not enough:
     1. YTAI_MAX_SEC caps what is transcribed, not what is accepted — Gemini is
        told to read only the first half hour, so the cost of any single call is
        bounded no matter how long the video is.
     2. its own per-IP counters, far tighter than the free caption route's.
     3. the answer is kept at the edge for a month (caches.default, by video
        and window), so a popular video is paid for once per location.
   Raise these deliberately, knowing what each one costs. */
const YTAI_MAX_SEC = 1800;       // 30 minutes ≈ $0.16 worst case per video
const YTAI_PER_MIN = 2;
const YTAI_PER_DAY = 25;
/* A WINDOW (27 Sep 2026): { ytai, from, to } transcribes only that stretch of
   the video. The app asks for the first minute alone, shows it, and fetches
   the rest in windows behind the learner. A pasted 20-minute talk used to wait
   for all 20 minutes to be transcribed before one line appeared (measured on
   staging the same day: 11–13 s for a 3-minute clip, most of a minute for a
   long one). A window costs a slice of the video, so windows have their own
   brake, sized so a day of windows reads no more video than a day of whole
   videos: 150 windows × 5 minutes = 25 videos × 30 minutes. */
/* the per-ACCOUNT ceiling on paid-for video transcription. Sized as a day's
   honest use by one learner (the app asks for the first minute, then windows),
   not as a product limit: a learner who hits this is importing videos far
   faster than they could watch them. */
const YTAI_ACCT_PER_MIN = 4;
const YTAI_ACCT_PER_DAY = 10;
const YTAI_WIN_MAX = 300;          // the longest stretch one window may ask for
const YTAI_WIN_PER_MIN = 12;
const YTAI_WIN_PER_DAY = 150;

/* ============================================================================
   ytai IN THREE TIERS (owner, 3 Oct 2026)
   ----------------------------------------------------------------------------
   J1 below made this route demand an account, because a per-IP brake alone
   cannot bound a bill: addresses are cheap to change and, behind the carrier
   NAT most of this app's learners sit on, one address is a whole city. That
   reasoning still holds. What changes is that a stranger can now TRY the
   feature before deciding to sign up, which is what the account requirement
   was costing.

   Three tiers, each with a different thing standing behind it:

     anonymous   a very small per-IP allowance, AND a single global daily pool
                 shared by every anonymous caller on earth. The pool is the
                 part that actually bounds the bill: per-IP limits bound one
                 address, and an attacker's whole method is to have more than
                 one. Spent in SECONDS OF VIDEO, so a long transcript costs
                 what it costs.
     free        a larger allowance held per ACCOUNT and per IP. It does NOT
                 draw on the anonymous pool, so a day of heavy anonymous use
                 can never lock out the people who signed up — which is also
                 what makes signing up worth doing.
     premium     the highest allowance, still held per account so a compromised
                 login cannot run away.

   WHY THE POOL IS IN DOLLARS. Gemini bills by the length of what it reads, so
   a ceiling counted in REQUESTS is a ceiling in name only: 25 requests is $4
   of 30-minute videos or $0.70 of 5-minute windows, and the limiter cannot
   tell. YTAI_ANON_USD_DAY is the real number — the most anonymous use may cost
   in a day — and the seconds ceiling is derived from it.
   ============================================================================ */
/* ~$0.08 buys 15 minutes, so a second of video costs this */
const YTAI_USD_PER_SEC = 0.08 / 900;
const YTAI_ANON_USD_DAY_DEFAULT = 5;
/* the pool, in seconds of video. $5 ≈ 15.6 hours ≈ 31 full-length transcripts. */
function ytaiAnonPoolSec(env) {
  const usd = Number(env && env.YTAI_ANON_USD_DAY);
  const v = Number.isFinite(usd) && usd > 0 ? usd : YTAI_ANON_USD_DAY_DEFAULT;
  return Math.max(60, Math.round(v / YTAI_USD_PER_SEC));
}
/* what this one call will ask Gemini to read, in seconds — the pool's unit */
const ytaiCostSec = win => win ? Math.max(1, win.to - win.from) : YTAI_MAX_SEC;
/* anonymous, per IP: enough to try the feature on one video, not to live on */
const YTAI_ANON_PER_MIN = 2, YTAI_ANON_PER_DAY = 2;
const YTAI_ANON_WIN_PER_MIN = 6, YTAI_ANON_WIN_PER_DAY = 12;
/* premium: the highest allowance, still an abuse ceiling rather than a product
   limit — a learner who reaches it is importing video faster than they could
   watch it */
const YTAI_PREM_PER_MIN = 8, YTAI_PREM_PER_DAY = 40;
/* anonymous ytai is OFF unless the deployment says otherwise, so this file can
   ship without changing what production does on the day it lands */
const ytaiAnonOn = env => String((env && env.YTAI_ANON) || "") === "1";
/* the answer is kept at the edge by video and stretch: a video's words do not
   change, and a POST's cache-control header is ignored by every cache */
const YTAI_CACHE_S = 30 * 86400;
function ytaiCacheKey(vid, win) {
  return new Request("https://ytai.cache.be-polish.invalid/v1/" + vid + "/" + (win ? win.from + "-" + win.to : "all"));
}
/* { from, to } from the request, or null for the whole video (older apps) */
function ytaiWindow(body) {
  if (body.to == null) return null;
  const from = Math.max(0, Math.floor(Number(body.from) || 0)), to = Math.floor(Number(body.to) || 0);
  if (!(to > from) || from >= YTAI_MAX_SEC) return false;
  return { from, to: Math.min(to, from + YTAI_WIN_MAX, YTAI_MAX_SEC) };
}

// ---- Pronunciation coach (audio-in language model) ----
// gpt-4o-audio-preview actually LISTENS to the learner's recording and grades
// how each word was pronounced — unlike ASR, which only guesses the intended
// word and so forgives bad pronunciation.
// Try these audio-in models in order; the account may only have some enabled.
// If NONE are available (all 404), we fall back to a Whisper cross-check below.
const ASSESS_MODELS = [
  "gpt-4o-audio-preview",
  "gpt-4o-audio-preview-2025-06-03",
  "gpt-4o-audio-preview-2024-12-17",
  "gpt-4o-mini-audio-preview",
];
const MAX_ASSESS_B64 = 6 * 1024 * 1024;  // ~4.5 MB of audio once base64-encoded
const ASSESS_PER_MIN = 15;
const ASSESS_PER_DAY = 400;

/* ---- WHERE THE LIMITS LIVE NOW (1 October 2026) ----
   Every counter above used to be a module-scope Map, which is per-ISOLATE: the
   real ceiling was `limit x however many isolates Cloudflare chose to run`,
   and a recycled isolate handed the caller a fresh allowance. Measured that
   day: 24 of 24 requests passed a limit of 20. The numbers were documentation,
   not a brake.
   They are now held in a Durable Object, which is one global instance per
   subject and handles one request at a time — see backend/rate-limit.js for
   the mechanism, the fixed-window trade-off and the degraded fallback. The
   numbers themselves are unchanged; what changed is that they are true. */
import { RateLimiter, consume } from "./rate-limit.js";
import { wmHandle } from "./wm-game.js";
/* The SAME Firebase ID-token verifier be-entitlements uses — RS256 against
   Google's securetoken JWKS, checking aud, iss, exp, iat and returning the
   `sub` and nothing else. Imported rather than copied so there is one
   implementation of identity in the backend, and esbuild bundles it at deploy.
   Needed because of J1 below: `ytai` must demand an account even where
   PREMIUM_ENFORCED is off and there is no entitlement service to ask. */
import { verifyIdToken } from "./entitlements/src/firebase-auth.js";
/* a DO class must be exported from the Worker's entry module for the binding
   in wrangler.toml to resolve to it */
export { RateLimiter };

/* one route's two windows, held against one subject. Returns a 429 Response to
   send, or null to carry on. */
async function limit(env, subject, name, perMin, perDay, cors) {
  const r = await consume(env, subject, [
    { name: name + ":min", limit: perMin, windowMs: 60_000 },
    { name: name + ":day", limit: perDay, windowMs: 86_400_000 },
  ]);
  if (r.ok) return null;
  return json({ error: "rate_limited", retryAfter: r.retryAfter }, 429, { ...cors, "Retry-After": String(r.retryAfter || 60) });
}

/* one bucket, one window, with a weight — the pool. limit() above is the
   two-window per-minute/per-day shape every route uses; this is for the single
   daily budget that is spent in units rather than in calls. */
async function limit2(env, subject, name, cap, windowMs, cost, cors) {
  const r = await consume(env, subject, [{ name: name + ":day", limit: cap, windowMs, cost }]);
  if (r.ok) return null;
  return json({ error: "rate_limited", scope: "anon_pool", retryAfter: r.retryAfter }, 429,
              { ...cors, "Retry-After": String(r.retryAfter || 60) });
}

function corsHeaders(origin) {
  /* Device testing happens over the LAN — a phone loads the dev server by the
     Mac's address, so the origin is http://192.168.x.x:PORT and no fixed list
     can name it in advance. Private ranges are admitted for that reason.
     This is not a hole: CORS only governs browsers, and anything that wanted to
     call this Worker directly could always do so with curl. What actually
     protects the key and the bill are the per-IP rate limits and the length cap
     above, none of which depend on the origin. */
  const lan = /^http:\/\/(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(origin);
  const allow = (ALLOWED_ORIGINS.includes(origin) || lan) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    /* `authorization` carries the Firebase ID token that premiumGate() needs.
       The client adds it to every POLISH_API call once the learner is signed in
       (the one signing wrapper in index.html), which turns the request into a
       PREFLIGHTED one — so if this does not name the header, the browser
       refuses the call before this Worker ever runs, and every AI feature dies
       with whatever generic "needs a connection" message that caller shows.
       curl never sees it: curl sends no preflight. Found 2026-09-30 through the
       Shadow Translate card on staging. */
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Vary": "Origin",
  };
}

/* ============================================================================
   PREMIUM ENFORCEMENT (Phase 8) — the server-side entitlement boundary
   ----------------------------------------------------------------------------
   The client decides what to DRAW; this file decides what is SPENT. A learner
   who edits localStorage, or who calls this Worker directly with curl and a
   forged Origin header, gets exactly as much paid AI as the entitlement
   service says their account has bought.

   OFF BY DEFAULT. Enforcement needs BOTH:
       PREMIUM_ENFORCED = "1"        (var)
       ENTITLEMENTS_URL = "https://entitlements.lomonec.com"   (var)
   With either missing this Worker behaves exactly as it always has, which is
   what production does today: Premium is not on sale, so nothing is gated. It
   mirrors the client's planOn() precisely, and the two must be switched on
   together.

   How a request is authorised:
     1. the caller sends their Firebase ID token (Authorization: Bearer …),
     2. this Worker forwards that header to be-entitlements /v1/entitlement,
        which verifies the token itself and answers with the VIEW for that uid,
     3. the capability the route needs is read from view.capabilities.
   No secret is shared between the two Workers, and this one never learns how
   to mint identity — it can only ask.

   Answers are cached per token for ENT_CACHE_MS. The cache key is a SHA-256 of
   the token, never the token itself, and never the uid.

   HONEST LIMIT — read before trusting this:
   The `chat` route takes a system prompt FROM THE CLIENT. Whoever can call it
   can make the model do anything, whatever capability label the request
   carries, so `chat` cannot be fully protected by a label. What the label does
   buy is real but narrower: a Free account cannot use the app's own coach and
   report flows, and every call is tied to a verified account and rate-limited
   per account rather than per IP. The routes that do fixed server-side work —
   transcription, `assess`, `analyse`, `mvreport` — ARE properly protected,
   because the work is defined here and not by the caller.
   Closing the `chat` gap means moving the system prompts into this Worker.
   That is a larger change and is listed as remaining work.
   ============================================================================ */
const ENT_CACHE_MS = 60_000;
const entCache = new Map();               // sha256(token) -> { at, caps }
const premiumOn = env => env.PREMIUM_ENFORCED === "1" && !!env.ENTITLEMENTS_URL;

/* what each route needs. null = free: the practice itself is never metered. */
const ROUTE_CAP = {
  /* BEING HEARD IS FREE (owner, 1 October 2026). This route is audio in -> words
     out, and nothing else: it is what lets a learner SPEAK and have the app
     understand them. Charging for it made the interview and the workshop — the
     spoken heart of both programmes — unusable on the Free plan, and the app
     reported the refusal as a microphone that heard nothing. Being understood is
     the activity; the JUDGEMENT of it is the product. So this is null and
     `assess` / `analyse` / `mvreport` / chat purposes `report` and `coach` below
     are not: a Free learner is heard, keeps the recording, and gets the local
     result the app already computes offline, while the AI's verdict stays paid.
     null does NOT mean unmetered — the `cap === null` branch still demands a
     verified account, and STT_PER_MIN / STT_PER_DAY and the per-account limit
     still apply, so this cannot be used as free transcription at scale. */
  transcribe: null,
  assess:     "ai_analysis",
  analyse:    "ai_analysis",
  mvreport:   "ai_analysis",
  captions:   null,            // library content, not a judgement of the learner
  ytai:       null,
  tts:        null,            // the natural voice reads characters and lessons too
  polish:     null,            // the Executive Polish rewrite stays Free (PLAN_LIMITS caps its history)
  repolish:   null,
};
/* `chat` serves several features. The purpose is declared by the caller and is
   NOT a security claim (see the honest limit above) — it is how the app's own
   flows are gated. An absent purpose reads as "practice", so an older cached
   index.html keeps working exactly as it does now. */
const CHAT_PURPOSE_CAP = { practice: null, coach: "ai_coach", report: "ai_analysis", shadow: null };
/* SHADOW READS WITHOUT AN ACCOUNT (owner, 3 October 2026).

   Shadow is where a learner watches a real speaker and says the lines back. Its
   reading helpers — the translation of the line, and the IPA hint above it —
   are part of READING the transcript, not a judgement of the learner, and the
   owner's rule is that the Shadow experience must not ask anyone to sign up.

   Those helpers used to ride on purpose "practice", which is `null` (free) but
   still hits the `cap === null` branch below: with PREMIUM_ENFORCED on, a free
   route STILL demands a verified account so every call is attributable. In
   production (PREMIUM_ENFORCED = "0") the gate returns early, so this was
   already anonymous there; on staging, and on the day enforcement is switched
   on in production, a signed-out learner got 401 and the app drew "Sign in to
   use the AI features" over the transcript. This purpose is the exception, and
   it is deliberately narrow:

     · ONE purpose, used by two Shadow helpers and nothing else. `practice`,
       `coach` and `report` are untouched, so Executive Polish, the AI coach,
       the reports, Practice Partner and every other route keep the account and
       Premium requirements they have today.
     · Attributability is replaced, not dropped. An anonymous caller has no
       account to charge, so it is held per IP by its OWN counter (SHADOW_PER_*
       below) on top of the shared chat IP limit that already ran — a smaller
       ceiling than an account gets, not a larger one.
     · It buys no capability. `shadow: null` means free, exactly as before; it
       can never reach a Premium model path. */
const CHAT_PURPOSE_ANON = new Set(["shadow"]);
/* the anonymous ceiling, per IP: a translated line is short and cheap, and this
   is well under what one learner reading a transcript needs */
const SHADOW_PER_MIN = 20, SHADOW_PER_DAY = 400;

/* ============================================================================
   THE DAILY AI ALLOWANCE (owner's tier spec, 5 October 2026)
   ----------------------------------------------------------------------------
   The AI's VERDICTS — a speaking report (`analyse`, `mvreport`, chat purpose
   `report`), a pronunciation assessment (`assess`) and an AI coach reply (chat
   purpose `coach`) — are no longer a Premium LOCK. They are METERED per
   account per UTC day: a Free account gets VERDICTS_FREE_PER_DAY, a Premium
   account VERDICTS_PREMIUM_PER_DAY. The Premium number is a fair-use ceiling
   against a compromised account, not a feature, and must never be sold as
   "unlimited". One verdict = one call on one of those routes. The count lives
   in the same Durable Object the other limits use, in a bucket named after
   the UTC day, so it turns over at UTC midnight for everyone and the app can
   show the reset in local time.

   Being heard stays unmetered: `transcribe`, `tts`, `polish`, `repolish`,
   `captions` and chat purposes `practice` / `shadow` cost no verdict (the
   account limits in perAccount still hold them).

   `ytai` (the learner's own YouTube video transcribed) is metered the same
   way but in SECONDS OF VIDEO: YTAI_FREE_SEC_PER_DAY for Free,
   YTAI_PREMIUM_SEC_PER_DAY for Premium, charged at what the request would
   cost (a whole video is charged at YTAI_MAX_SEC, a window at its length).

   Every answer on a metered route carries `X-BE-Allowance` (verdicts) or
   `X-BE-Video-Allowance` (seconds): {used, limit, resetAt, plan}. A refusal is
   429 {error:"allowance", scope:"verdicts"|"video", limit, used, resetAt,
   plan, retryAfter}. The client reads the header in its one fetch wrapper.
   ============================================================================ */
const VERDICT_CAPS = new Set(["ai_analysis", "ai_coach"]);
const VERDICTS_FREE_PER_DAY = 3, VERDICTS_PREMIUM_PER_DAY = 120;
const YTAI_FREE_SEC_PER_DAY = 30 * 60, YTAI_PREMIUM_SEC_PER_DAY = 60 * 60;
/* THE FREE TRIAL (owner, 6 Oct 2026): transcribing your own YouTube video is a
   Premium feature. A Free account gets YTAI_FREE_TRIAL_SEC of video ONCE, in
   total — enough to see it work — and then the Premium offer. It applies only
   while enforcement is on, because that is the only state in which Premium can
   be bought; with enforcement off every verified account is "free" and keeps
   YTAI_FREE_SEC_PER_DAY, so no learner loses the feature before it is on sale.
   The bucket is named without a day and its window is a century, i.e. it never
   turns over. A cached video is still served free to anyone (it costs nothing).
   Premium went from 240 to 60 minutes a day the same day: at ~$0.32 an hour of
   video, 4 hours a day could cost more than the plan earns. */
const YTAI_FREE_TRIAL_SEC = 10 * 60;
const YTAI_TRIAL_WINDOW_MS = 100 * 365 * 86_400_000;
const utcDay = now => new Date(now).toISOString().slice(0, 10);
const utcMidnightAfter = now => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
/* the header rides on `cors`, which every json() of this request spreads into
   its headers — one place to set, no handler to touch */
function allowanceHeader(cors, name, state) {
  try {
    cors[name] = JSON.stringify(state);
    cors["Access-Control-Expose-Headers"] = "X-BE-Allowance, X-BE-Video-Allowance, Retry-After";
  } catch (e) {}
}
function allowanceRefused(cors, scope, limitN, resetAt, plan, now) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
  /* `used` is exact for verdicts (one call = one unit, so a refusal means the
     bucket is full) and unknown for the seconds budget (a 30-minute request can
     be refused with 20 minutes still unspent) — so it is omitted there rather
     than guessed */
  const body = { error: "allowance", scope, limit: limitN, resetAt, plan, retryAfter };
  if (scope === "verdicts") body.used = limitN;
  return json(body, 429, { ...cors, "Retry-After": String(retryAfter), "Access-Control-Expose-Headers": "X-BE-Allowance, X-BE-Video-Allowance, Retry-After" });
}
/* one verdict against the account's day bucket; null = carry on */
async function verdictAllowance(a, env, cors) {
  const id = a.uid ? "u:" + a.uid : (a.key ? "t:" + a.key : null);
  if (!id) return null;
  const now = Date.now(), plan = a.premium ? "premium" : "free";
  const limitN = a.premium ? VERDICTS_PREMIUM_PER_DAY : VERDICTS_FREE_PER_DAY;
  const name = "verdict:" + utcDay(now), resetAt = utcMidnightAfter(now);
  const r = await consume(env, "acct:" + id, [{ name, limit: limitN, windowMs: 86_400_000 }]);
  if (!r.ok) return allowanceRefused(cors, "verdicts", limitN, resetAt, plan, now);
  const used = Math.min(limitN, Number((r.counts && r.counts[name]) || 0) || 0);
  allowanceHeader(cors, "X-BE-Allowance", { used, limit: limitN, resetAt, plan });
  return null;
}

/* The account a token belongs to, for the rate-limit bucket ONLY.

   This is the token's own `sub` claim, read without verifying the signature —
   which is sound here and nowhere else: this function is reached only after
   be-entitlements answered 200 for this same token, and be-entitlements
   verifies it against Firebase's JWKS. A token it accepted is genuine, so the
   `sub` inside it is the real uid. Nothing is authorised on this value; it
   decides which counter a call is charged to. A token that cannot be parsed
   falls back to the token hash, so a malformed one gets a limit, not a pass. */
function tokenSub(tok) {
  try {
    const p = String(tok).split(".");
    if (p.length !== 3) return null;
    let b = p[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const sub = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0)))).sub;
    return (typeof sub === "string" && sub && sub.length <= 128) ? sub : null;
  } catch (e) { return null; }
}
async function tokenKey(tok) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tok));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
/* the account's capabilities, or a reason it could not be established.
   { caps } | { status: 401|503 } */
async function capabilities(req, env) {
  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer \S+$/.test(auth)) return { status: 401 };
  const tok = auth.slice(7);
  const key = await tokenKey(tok);
  const uid = tokenSub(tok);
  const hit = entCache.get(key);
  if (hit && Date.now() - hit.at < ENT_CACHE_MS) return { caps: hit.caps, key, uid, premium: hit.premium === true };
  let r;
  try {
    r = await fetch(String(env.ENTITLEMENTS_URL).replace(/\/+$/, "") + "/v1/entitlement", { headers: { authorization: auth } });
  } catch (e) {
    return { status: 503 };                       // the service is unreachable: say so, never guess
  }
  if (r.status === 401 || r.status === 403) return { status: 401 };
  if (!r.ok) return { status: 503 };
  let j; try { j = await r.json(); } catch (e) { return { status: 503 }; }
  const src = (j && j.capabilities && typeof j.capabilities === "object") ? j.capabilities : {};
  const caps = {};
  /* ai_verbal_feedback was removed on 1 October 2026: it was advertised on the
     paywall and checked at ZERO call sites, while `tts` is free because the
     natural voice reads CONTENT (lessons, characters, words). A Free learner
     already had everything that name described, so it was a claim, not a
     capability. Removed from CAPABILITIES in entitlement-core.js too; an older
     deployed entitlements Worker that still sends it is simply ignored here. */
  for (const k of ["ad_free", "ai_analysis", "advanced_progress", "ai_coach", "recommended_content"]) caps[k] = src[k] === true;
  /* the TIER, for the daily allowance: the view's own plan when it is paid and
     in force; ad_free as the fallback for an older entitlements Worker that
     sends capabilities only. A promo that grants part of Premium stays Free. */
  const premium = (j && j.plan === "premium" && j.paid === true && caps.ad_free === true) || (caps.ad_free === true && !(j && j.plan));
  if (entCache.size > 5000) entCache.clear();
  entCache.set(key, { at: Date.now(), caps, uid, premium });
  return { caps, key, uid, premium };
}
/* Returns a Response to send instead, or null to carry on. */
/* ============================================================================
   J1 — ytai REQUIRES AN ACCOUNT, WHATEVER THE PLAN OR THE ENFORCEMENT STATE
   ----------------------------------------------------------------------------
   `ytai` is the only free route that spends real money per call (~$0.08 for 15
   minutes of video), and until now it inherited its authentication from
   premiumGate — which returns immediately when PREMIUM_ENFORCED is off. In
   production, where enforcement IS off, that left the route reachable with no
   account at all, held only by a per-IP brake that a changed network defeats,
   and with the per-account cap inert because there was no account to charge.

   This closes that without touching the product model: `ROUTE_CAP.ytai` stays
   null, so the route is still FREE — an authenticated Free learner may use it
   exactly as before. What changes is that "free" no longer means "anonymous"
   on this one route. Nothing else moves: no other route gains a requirement,
   nothing becomes Premium, and PREMIUM_ENFORCED is untouched.

   Two modes, one requirement:
     · enforcement ON  — premiumGate already demands a verified account through
       be-entitlements. Nothing is added; this returns the account so the
       per-account cap can use it.
     · enforcement OFF — there is no entitlement service to ask, so the token
       is verified HERE against FIREBASE_PROJECT_ID, with the same module
       be-entitlements verifies with.

   FAILS CLOSED, deliberately. A missing FIREBASE_PROJECT_ID or an unreachable
   JWKS answers 503 rather than letting the call through: for a route that
   spends money, a configuration gap must stop the spending, not the checking.
   That is the opposite of the choice made for the rate limiter, and for the
   opposite reason — a limiter outage must not take a free feature down, while
   an auth outage must not open a paid provider.
   ============================================================================ */
async function ytaiAccount(req, env, cors) {
  const auth = req.headers.get("Authorization") || "";
  /* No token. Before 3 Oct 2026 this was the end of the route. It still is
     wherever YTAI_ANON is not set, so a deployment that has not opted in keeps
     exactly the behaviour J1 describes. Where it IS set, the caller becomes the
     anonymous tier: the smallest per-IP allowance, plus the global pool, both
     applied at the call site where the length of the request is known. */
  if (!/^Bearer \S+$/.test(auth)) {
    if (ytaiAnonOn(env)) return { ok: true, subject: null, tier: "anon" };
    return { res: json({ error: "auth_required" }, 401, cors) };
  }
  if (premiumOn(env)) {
    /* Enforcement on: be-entitlements is the verifier, so premiumGate IS the
       check and it has to run HERE — inside the gate — not further down the
       route. It used to be called after the `no_key` test, which meant a
       PRESENT but junk Bearer header passed this function and was answered 501
       instead of 401: the header was taken as proof of an account. Measured on
       be-polish-staging on 1 Oct 2026 — a malformed token, alg=none, a
       self-signed one and a token for the wrong Firebase project all got 501.
       No paid work was reachable that way (the key is absent on staging and
       premiumGate still stood in front of the provider), but it leaked whether
       a key is configured and it broke the one ordering rule this gate exists
       to keep: nothing on this route happens before the token is verified. */
    const g = await premiumGate(req, env, "ytai", cors);
    if (g) return { res: g };
    /* Premium is read from the capabilities be-entitlements just returned, not
       guessed: ad_free is the one every paid plan carries. A promo that grants
       only part of Premium therefore stays on the free allowance, which is the
       safe direction to be wrong in. */
    let tier = "free";
    try { const a = await capabilities(req, env); if (a && a.caps && a.caps.ad_free === true) tier = "premium"; } catch (e) {}
    return { ok: true, subject: await acctSubject(req, env), tier };
  }
  if (!env.FIREBASE_PROJECT_ID) return { res: json({ error: "auth_unavailable" }, 503, cors) };
  let uid;
  try {
    uid = await verifyIdToken(auth.slice(7), env.FIREBASE_PROJECT_ID);
  } catch (e) {
    /* a JWKS fetch that failed is OUR problem and retriable; everything else
       (malformed, wrong project, expired, bad signature) is the caller's */
    const m = String((e && e.message) || e);
    if (/^jwks/.test(m) || m === "project") return { res: json({ error: "auth_unavailable" }, 503, cors) };
    return { res: json({ error: "auth_required" }, 401, cors) };
  }
  /* enforcement off: there is no entitlement service to ask, so a verified
     account is a FREE account here. Premium cannot be distinguished in this
     mode and must not be assumed — the free allowance is the honest answer. */
  return { ok: true, subject: uid ? "acct:u:" + uid : null, tier: "free" };
}

/* the rate-limit subject for the ACCOUNT behind a request, or null when there
   is none to find (enforcement off, or no usable token). Never an authorisation
   decision — capabilities() has already been asked by premiumGate on every
   route that reaches this, and its answer is cached per token for ENT_CACHE_MS,
   so this costs nothing extra. */
async function acctSubject(req, env) {
  if (!premiumOn(env)) return null;
  try {
    const a = await capabilities(req, env);
    if (a.status) return null;
    return a.uid ? "acct:u:" + a.uid : (a.key ? "acct:t:" + a.key : null);
  } catch (e) { return null; }
}
async function premiumGate(req, env, route, cors, purpose) {
  if (!premiumOn(env)) return null;                                   // not switched on: behave as before
  /* the Shadow exception (see CHAT_PURPOSE_ANON): no account demanded, and no
     capability granted either — it is held per IP at the call site instead */
  if (route === "chat" && CHAT_PURPOSE_ANON.has(String(purpose || ""))) return null;
  const cap = route === "chat" ? CHAT_PURPOSE_CAP[String(purpose || "practice")] : ROUTE_CAP[route];
  if (cap === undefined) return json({ error: "bad_request" }, 400, cors);
  if (cap === null) {
    /* a free route still needs a verified account while enforcement is on, so
       every call is attributable and can be limited per account */
    const a = await capabilities(req, env);
    if (a.status === 401) return json({ error: "auth_required" }, 401, cors);
    if (a.status === 503) return json({ error: "entitlement_unavailable" }, 503, cors);
    return await perAccount(a, env, cors);
  }
  const a = await capabilities(req, env);
  if (a.status === 401) return json({ error: "auth_required" }, 401, cors);
  /* the service is down: a paying learner must not be told they are Free, and
     no paid work is done on a guess. 503 is retriable and honest. */
  if (a.status === 503) return json({ error: "entitlement_unavailable" }, 503, cors);
  /* a VERDICT capability is metered, not locked (the tier spec): Free and
     Premium both pass here and the day bucket decides; anything else that
     names a capability the account lacks is still 402 */
  if (!a.caps[cap] && !VERDICT_CAPS.has(cap)) return json({ error: "premium_required", capability: cap }, 402, cors);
  const held = await perAccount(a, env, cors);
  if (held) return held;
  if (VERDICT_CAPS.has(cap)) return await verdictAllowance(a, env, cors);
  return null;
}
/* per-ACCOUNT rate limit: an IP limit alone is useless behind carrier NAT, and
   once every call carries a uid the account is the right unit to hold.

   Held against the UID, not the token. A Firebase ID token is refreshed about
   every hour, so keying on its hash handed a learner a fresh ACCT_PER_DAY
   allowance every refresh — roughly 24x the daily cap this file claims to set.
   The uid is the `sub` of a token be-entitlements has just accepted (see
   tokenSub), so it cannot be chosen by the caller. The token hash stays as the
   fallback, so a token that will not parse gets a limit rather than none. */
const ACCT_PER_MIN = 30, ACCT_PER_DAY = 600;
async function perAccount(a, env, cors) {
  const id = a.uid ? "u:" + a.uid : (a.key ? "t:" + a.key : null);
  if (!id) return null;
  return await limit(env, "acct:" + id, "acct", ACCT_PER_MIN, ACCT_PER_DAY, cors);
}


// Delivery instructions make gpt-4o-mini-tts noticeably warmer and more human
// than its default read — this is the difference between "robotic" and "natural".
const TTS_INSTRUCTIONS =
  "Speak in warm, natural, confident spoken American English — the voice of a " +
  "supportive executive-communication coach. Use relaxed, human intonation and " +
  "rhythm, clear articulation, and a friendly, encouraging tone. Never flat, " +
  "monotone, or robotic; sound like a real person speaking to a colleague.";

// A workplace character is not a communication coach. When the app names one —
// "calm, direct shop supervisor" — the delivery note is appended to the house
// instruction rather than replacing it, so the warmth and clarity survive and only
// the persona changes. Capped and stripped of newlines: this text reaches the
// provider, so it is treated as untrusted input, not as configuration.
const MAX_TTS_STYLE = 180;
function ttsInstructions(style) {
  const s = String(style || "").replace(/[\r\n]+/g, " ").trim().slice(0, MAX_TTS_STYLE);
  return s ? `${TTS_INSTRUCTIONS} For this line, speak in character: ${s}` : TTS_INSTRUCTIONS;
}

async function callTTS(env, text, voice, style) {
  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_KEY}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice,
      input: text,
      instructions: ttsInstructions(style),
      response_format: "mp3",
    }),
  });
}

// Whisper drops "um" and "uh" unless it is shown that they are wanted. The
// speech analysis wants them (they are the "filler words" it counts), the
// shadowing and role-play callers do not — so it is opt-in: POST ...?fillers=1.
const FILLER_PROMPT = "Um, uh, er, hmm, you know, I mean, like, so... Okay, um, let me think.";
async function callTranscribe(env, bytes, mime, keepFillers) {
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("language", "en");
  if (keepFillers) form.append("prompt", FILLER_PROMPT);
  const ext = mime.includes("mp4") || mime.includes("m4a") ? "m4a"
    : mime.includes("ogg") ? "ogg"
    : mime.includes("wav") ? "wav"
    : mime.includes("mpeg") || mime.includes("mp3") ? "mp3"
    : "webm";
  form.append("file", new File([bytes], "clip." + ext, { type: mime || "audio/webm" }));
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_KEY}` },  // fetch sets the multipart boundary itself
    body: form,
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const words = Array.isArray(j.words)
    ? j.words.map(x => ({ w: String(x.word || "").trim(), start: +x.start, end: +x.end }))
             .filter(x => x.w && isFinite(x.start) && isFinite(x.end))
    : [];
  return { words, text: String(j.text || "") };
}

async function callAssess(env, target, audioB64, fmt) {
  const system =
    "You are a strict but fair English pronunciation coach. You will HEAR a learner " +
    "attempt to say a target phrase. Judge ONLY pronunciation — the actual sounds, " +
    "stress and clarity you hear — NOT grammar or word choice. Be honest: if a word " +
    "is mispronounced, unclear, missing or mumbled, score it low even if you can guess " +
    "what was intended. Give each target word a score from 0 (wrong/unintelligible) to " +
    "100 (native-clear). Respond with ONLY minified JSON, no code fences: " +
    '{"overall":<0-100>,"words":[{"word":"<target word>","score":<0-100>,"note":"<max 6-word tip, or empty if good>"}]} ' +
    "with one item per target word, in order.";
  const payload = model => JSON.stringify({
    model,
    modalities: ["text"],
    max_tokens: 600,
    messages: [
      { role: "system", content: system },
      { role: "user", content: [
        { type: "text", text: `Target phrase: "${target}". Score how clearly I pronounced each word.` },
        { type: "input_audio", input_audio: { data: audioB64, format: fmt } },
      ] },
    ],
  });
  let j = null;
  for (const model of ASSESS_MODELS) {                 // use whichever audio model the account has
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_KEY}` },
      body: payload(model),
    });
    if (r.status === 404) continue;                    // model not enabled → try next
    if (!r.ok) throw new Error("provider " + r.status);
    j = await r.json();
    break;
  }
  if (!j) return null;                                 // no audio model available → caller falls back to Whisper
  let raw = j.choices?.[0]?.message?.content || "{}";
  raw = raw.replace(/^```[a-z]*\s*|\s*```$/g, "").trim();
  let parsed; try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  const words = Array.isArray(parsed.words)
    ? parsed.words.map(w => ({
        word: String(w.word || "").trim(),
        score: Math.max(0, Math.min(100, Math.round(+w.score))) || 0,
        note: String(w.note || "").trim().slice(0, 60),
      })).filter(w => w.word).slice(0, 60)
    : [];
  const overall = Math.max(0, Math.min(100, Math.round(+parsed.overall))) || 0;
  return { overall, words, mode: "ai" };
}

// Whisper fallback: transcribe the audio and score each target word by whether
// Whisper actually heard it (in order). Stricter than the browser recogniser,
// and works on any account that has whisper-1.
function b64ToBytes(b64) {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[m][n];
}
async function whisperAssess(env, bytes, mime, target) {
  const { words: wl } = await callTranscribe(env, bytes, mime);
  const heard = wl.map(x => x.w.toLowerCase().replace(/[^a-z0-9']/g, "")).filter(Boolean);
  const tgt = target.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
  let hi = 0, sum = 0; const words = [];
  for (const w of tgt) {
    let score = 18, note = "not heard clearly";
    for (let k = hi; k < Math.min(heard.length, hi + 3); k++) {
      if (heard[k] === w) { score = 95; note = ""; hi = k + 1; break; }
    }
    if (score < 95) for (let k = hi; k < Math.min(heard.length, hi + 3); k++) {
      const sim = 1 - lev(heard[k], w) / Math.max(heard[k].length, w.length, 1);
      if (sim >= 0.6) { score = 55; note = "unclear — practise this sound"; hi = k + 1; break; }
    }
    words.push({ word: w, score, note }); sum += score;
  }
  return { overall: Math.round(sum / Math.max(1, tgt.length)), words, mode: "whisper" };
}

async function callAI(env, sentence, avoid) {
  const system =
    "You are an elite executive communication coach. Rewrite the user's sentence " +
    "into 3 DIFFERENT professional, spoken business-English versions. Each version " +
    "must use different vocabulary and, where natural, a business idiom or executive " +
    "phrase. Keep each concise and natural to say out loud, and preserve the original " +
    "meaning. Do not reuse any sentence in the 'avoid' list. " +
    'Respond with ONLY minified JSON, no code fences: ' +
    '{"versions":[{"text":"<rewrite>","learn":"<the idiom or key phrase used, a few words>"}]} ' +
    "with exactly 3 items.";
  const user = `Sentence: "${sentence}"\nAvoid (do not repeat): ${avoid.length ? avoid.join(" | ") : "none"}`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 1,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const raw = j.choices?.[0]?.message?.content || "{}";
  let parsed; try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  let versions = Array.isArray(parsed.versions) ? parsed.versions : [];
  versions = versions
    .map(v => ({ text: String(v.text || "").trim(), learn: String(v.learn || "").trim() }))
    .filter(v => v.text.length > 3)
    .slice(0, 3);
  return versions;
}

/* ---------------------------------------------------------------
   YouTube captions for a pasted video.

   There is no official way to read captions for a video you don't own
   (the Data API's captions.download is owner-only), so this reads the
   watch page and follows the caption track it advertises. That means it
   is inherently fragile: YouTube changes the page from time to time,
   may serve a consent/bot wall to datacentre IPs, and many videos have
   captions disabled. Every failure returns a plain reason so the app can
   fall back to asking the user to paste the transcript.

   Returns the same shape as the bundled captions/<id>.json files:
   { vid, source, lang, cues:[{t,txt}], words:[{t,w}] }
--------------------------------------------------------------- */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const GEMINI_MODEL = "gemini-3.6-flash";
const YTAI_PROMPT =
  "Transcribe the spoken English in this video. For every sentence give the MM:SS timestamp at which it begins. " +
  "Return ONLY minified JSON: {\"cues\":[{\"ts\":\"MM:SS\",\"txt\":\"<sentence>\"}]}. " +
  "Cover the whole video from 00:00 to the end. No commentary.";
const YTAI_PROMPT_WIN =
  "Transcribe the spoken English in this video clip. For every sentence give the MM:SS timestamp at which it begins, " +
  "measured from the START OF THE VIDEO (not from the start of the clip). " +
  "Return ONLY minified JSON: {\"cues\":[{\"ts\":\"MM:SS\",\"txt\":\"<sentence>\"}]}. " +
  "Cover the clip from its first word to its last. No commentary.";

async function geminiCaptions(env, vid, win) {
  /* the key goes in the header, not the query string: a secret that picked up a
     stray newline or space silently breaks a URL parameter (that is a 401 with
     no explanation), and Google documents the header as the supported form */
  const key = String(env.GEMINI_KEY || "").trim();
  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent",
    { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [
          { fileData: { fileUri: "https://www.youtube.com/watch?v=" + vid },
            /* the hard cost brake: Gemini reads at most YTAI_MAX_SEC of the
               video, so a three-hour upload costs the same as a half-hour one */
            videoMetadata: { startOffset: (win ? win.from : 0) + "s", endOffset: (win ? win.to : YTAI_MAX_SEC) + "s" } },
          { text: win ? YTAI_PROMPT_WIN : YTAI_PROMPT },
        ] }],
        /* low media resolution: we are after the words, not the picture, and it
           is roughly a third of the tokens */
        generationConfig: { temperature: 0, responseMimeType: "application/json",
          maxOutputTokens: 60000, mediaResolution: "MEDIA_RESOLUTION_LOW" },
      }) });
  if (!r.ok) {
    let detail = ""; try { detail = JSON.stringify(await r.json()).slice(0, 200) } catch {}
    /* 401/403 is our key, not the learner's video. The fingerprint is the first
       8 hex of SHA-256 — enough to tell whether the secret is the key you meant
       to store, and useless to anyone who sees it. */
    let fp = "";
    try {
      const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
      fp = [...new Uint8Array(h)].slice(0, 4).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch {}
    return { error: "gemini_" + r.status, detail, keyLen: key.length, keyFp: fp };
  }
  const j = await r.json();
  const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let parsed; try { parsed = JSON.parse(txt) } catch { return { error: "gemini_parse" } }
  const toSec = ts => { const m = String(ts || "").match(/(\d+):(\d{1,2})(?::(\d{1,2}))?/);
    if (!m) return null;
    return m[3] ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]); };
  const cues = [];
  for (const c of (parsed.cues || [])) {
    const t = toSec(c.ts), s = String(c.txt || "").replace(/\s+/g, " ").trim();
    if (t == null || !s) continue;
    if (cues.length && t < cues[cues.length - 1].t) continue;   // never let it go backwards
    cues.push({ t, txt: s });
  }
  if (!cues.length) return { error: "gemini_empty" };
  if (win) {
    /* The model is asked for times from the start of the video, but a clip's
       times may still come back from the start of the clip. Clip-relative times
       all fit inside the clip's length and start before `from`; move them. */
    const len = win.to - win.from;
    if (win.from > 0 && cues[0].t < win.from - 5 && cues[cues.length - 1].t <= len + 15) cues.forEach(c => { c.t += win.from });
    const kept = cues.filter(c => c.t >= win.from - 5 && c.t < win.to + 5);
    if (!kept.length) return { error: "gemini_empty" };
    return { vid, source: "gemini", lang: "en", cues: kept, maxSec: YTAI_MAX_SEC, win: [win.from, win.to] };
  }
  /* no `words`: the model's timings are line-level, and inventing word times
     from them would be a lie the highlighter would act on */
  const out = { vid, source: "gemini", lang: "en", cues, maxSec: YTAI_MAX_SEC };
  /* if the last line lands near the cap the video was almost certainly longer,
     and the app should say so rather than let the words run out mid-talk */
  if (cues[cues.length - 1].t >= YTAI_MAX_SEC - 90) out.truncated = true;
  return out;
}

async function fetchYouTubeCaptions(vid) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) return { error: "bad_id" };

  const page = await fetch("https://www.youtube.com/watch?v=" + vid + "&hl=en", {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
  });
  if (!page.ok) return { error: "page_" + page.status };
  const html = await page.text();

  // the player response carries the caption track list
  const m = html.match(/"captionTracks":(\[.*?\])/);
  if (!m) return { error: "no_captions" };
  let tracks; try { tracks = JSON.parse(m[1]); } catch { return { error: "parse_failed" }; }
  if (!tracks.length) return { error: "no_captions" };

  // prefer a real English track, then any English, then whatever exists
  const pick =
    tracks.find(t => (t.languageCode || "").startsWith("en") && t.kind !== "asr") ||
    tracks.find(t => (t.languageCode || "").startsWith("en")) ||
    tracks[0];
  if (!pick || !pick.baseUrl) return { error: "no_track" };

  const tt = await fetch(pick.baseUrl + "&fmt=json3", { headers: { "user-agent": UA } });
  if (!tt.ok) return { error: "track_" + tt.status };
  let data; try { data = await tt.json(); } catch { return { error: "track_parse" }; }

  const cues = [], words = [];
  for (const ev of data.events || []) {
    if (!ev.segs) continue;
    const start = (ev.tStartMs || 0) / 1000;
    let txt = "";
    for (const s of ev.segs) {
      const piece = (s.utf8 || "").replace(/\n/g, " ");
      if (!piece.trim()) { txt += piece; continue; }
      words.push({ t: +(start + (s.tOffsetMs || 0) / 1000).toFixed(3), w: piece.trim() });
      txt += piece;
    }
    txt = txt.replace(/\s+/g, " ").trim();
    if (txt) cues.push({ t: +start.toFixed(2), txt });
  }
  if (!cues.length) return { error: "empty_track" };

  return {
    vid,
    source: "youtube",
    lang: pick.languageCode || "en",
    asr: pick.kind === "asr",
    cues,
    words,
  };
}

/* ---------------------------------------------------------------
   Role-play conversation.

   The app used to call Anthropic straight from the browser with a key
   the user pasted in themselves, which is why the feature stayed
   hidden — you cannot ship that. The call lives here now so the key
   never leaves the Worker and users need nothing.

   In: { chat: { system, messages:[{role,content}] } }
   Out: { reply, covered:[n] }   (the model is asked for exactly this)
--------------------------------------------------------------- */
const CHAT_PER_MIN = 20;
const CHAT_PER_DAY = 500;
const CHAT_MODEL = "gpt-4o-mini";
const MAX_CHAT_TURNS = 40;

/* ---------------------------------------------------------------
   Executive Polish — speech analysis.

   The learner spoke for about a minute. The app already measured what a
   machine measures well (pace, pauses, pitch range, filler and hedging
   counts, sentence length, vocabulary) on the device; this call asks the
   model for what only a reader can judge — the key message, how it was
   structured, what makes it credible or not, and the one thing to work on
   next. Every field is a short string, sliced hard, so the report renders
   the same whatever the model returns.
--------------------------------------------------------------- */
/* gpt-4o-mini could hold the old fifteen-field contract; it could not hold this
   one. The report now asks for the learner's own errors with the rule behind
   each, three of their own sentences rebuilt on a named pattern, word upgrades
   and collocation fixes — twenty-odd fields where every item must quote the
   learner. Measured on real minutes: mini invented sentences the learner never
   said and returned three identical "corrections". 4.1-mini holds it. One call
   per recording, so the cost stays a fraction of the Whisper pass. */
const AN_MODEL = "gpt-4.1-mini";
const AN_PER_MIN = 6;
const AN_PER_DAY = 150;
const MAX_AN_CHARS = 4000;     // ~10 minutes of speech; the app sends ~1
const AN_FIELDS = {            // field -> max chars
  key_message: 240, clarity: 8, sharper: 280, structure_note: 260, answer_directly: 260,
  example: 280, evidence: 260, credibility: 260, remember_title: 90, remember_body: 320,
  next_recording: 320, quick_win_title: 90, quick_win_goal: 220, concept_title: 70, concept_body: 240,
  level: 4, level_note: 240, coach_script: 900,
};
const AN_LEVELS = ["A2","B1","B1+","B2","B2+","C1"];
const AN_LANGS = { en:"English", es:"Spanish", fr:"French", pt:"Portuguese", it:"Italian", de:"German", ru:"Russian", ar:"Arabic", ur:"Urdu", hi:"Hindi", bn:"Bengali", id:"Indonesian", vi:"Vietnamese", zh:"Chinese", ja:"Japanese", ko:"Korean" };
function anStr(v, max) { return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : ""; }
/* ---- the session's context (2026-09-24) ----
   The daily session's Record yourself card sends the same minute through this
   route, with what the learner was asked to do: the programme (welding or
   business English), the week's focus, today's task and the phrases on the
   "say these aloud" card. Bounded and optional: Executive Polish sends none
   and reads exactly as before. A welding minute is coached in the register of
   the workshop and the site, not the boardroom. */
function anCtx(raw) {
  if (!raw || typeof raw !== "object") return null;
  const track = raw.track === "welding" ? "welding" : raw.track === "general" ? "general" : "";
  const week = Number.isInteger(+raw.week) && +raw.week >= 1 && +raw.week <= 52 ? +raw.week : 0;
  const out = { track, week, day: anStr(raw.day, 3), focus: anStr(raw.focus, 160), task: anStr(raw.task, 300), out: anStr(raw.out, 200),
    phrases: (Array.isArray(raw.phrases) ? raw.phrases : []).map(x => anStr(x, 80)).filter(Boolean).slice(0, 6) };
  return (out.track || out.task || out.focus || out.phrases.length) ? out : null;
}
function anTrade(ctx) { return !!(ctx && ctx.track === "welding"); }
function anCoachLine(ctx) {
  return anTrade(ctx)
    ? "You are a workplace English coach for welders and skilled tradespeople who use English as a second language. The register is the workshop, the site and the site office — plain, practical, safety-minded — never the boardroom: every idiom, phrase and word upgrade must be one a foreman, an inspector or a client on site would actually say, and polish means a supervisor's clarity, not corporate jargon. "
    : "You are an executive speaking coach for professionals who use English as a second language. ";
}
function anTaskBlock(ctx) {
  if (!ctx) return "";
  const parts = [];
  parts.push("THE TASK. This minute is a daily exercise on a " + (anTrade(ctx) ? "welding workplace English" : "business English") + " programme" + (ctx.week ? ", week " + ctx.week : "") + (ctx.focus ? " (focus: " + ctx.focus + ")" : "") + ".");
  if (ctx.task) parts.push("The task was: " + ctx.task);
  if (ctx.out) parts.push("The expected outcome: " + ctx.out);
  if (ctx.phrases.length) parts.push("They were asked to use these phrases: " + ctx.phrases.map(x => '"' + x + '"').join(", ") + ".");
  parts.push("Judge the minute AGAINST THIS TASK: evidence says whether they did what the task asked and which of the assigned phrases they used, quoting them; answer_directly is the first change that would make the minute meet the task; next_recording is the same task again, done better — never a different topic; example, sharper, the versions and the idioms must all fit this task and this workplace; coach_script names the task and says plainly whether it was met.");
  return parts.join(" ") + " ";
}
async function callAnalyse(env, transcript, metrics, lang, ctx) {
  const language = AN_LANGS[lang] || "English";
  const trade = anTrade(ctx);
  const system =
    anCoachLine(ctx) +
    "The learner spoke for about a minute (transcript below, fillers kept). Measured numbers are given; do not re-measure. " +
    "Judge what a listener judges: the key message, the structure, what makes the speaker credible, and the one change that matters most. " +
    "Then teach: correct the real mistakes with the rule behind each, rebuild their own sentences on patterns they can reuse, and upgrade their words. " +
    "Be concrete and specific: every item must quote the learner's own words. Never invent a sentence they did not say, and never invent facts. " +
    "Two languages are in play and mixing them up ruins the report; the rule is at the end of this prompt and it is not optional. " +
    "Respond with ONLY minified JSON, no code fences, exactly these keys: " +
    '{"key_message":"<the one thing they were saying, one sentence, English, in their words>",' +
    '"clarity":"clear"|"fuzzy",' +
    '"sharper":"<the key message said better: one plain sentence, max 22 words>",' +
    '"level":"A2"|"B1"|"B1+"|"B2"|"B2+"|"C1",' +
    '"level_note":"<one sentence: the single thing holding them at this level, from this transcript>",' +
    '"structure":["<part 1>","<part 2>",...],' +
    '"structure_note":"<one sentence: what the order did for the listener>",' +
    '"answer_directly":"<one sentence: the first change to make to the opening>",' +
    '"example":"<one English sentence they could open with>",' +
    '"evidence":"<one sentence on the proof they gave or did not give>",' +
    '"credibility":"<one sentence on hedges and certainty, quoting them>",' +
    '"hedges":[{"said":"<phrase they used>","better":"<the same idea stated plainly>"}],' +
    '"corrections":[{"said":"<the exact words they got wrong, copied from the transcript>","fix":"<the same words, correct>","why":"<one short line: the rule, so they can apply it again>","kind":"tense"|"article"|"plural"|"preposition"|"word form"|"word choice"|"agreement"|"word order"}],' +
    '"sentences":[{"said":"<one whole sentence of theirs, copied>","rebuilt":"<the same idea, same facts, on a stronger structure, spoken English>","pattern":"<the reusable frame with square-bracket slots, e.g. Because [problem], we [action] so that [result]>","pattern_use":"<one line: the situation this frame is for>"}],' +
    '"words":[{"said":"<the plain or vague word they used, copied>","better":"<the precise professional word or phrase>","meaning":"<one line, plain>","example":"<their own sentence rewritten with it, English>"}],' +
    '"collocations":[{"said":"<the awkward word pairing they used, copied>","better":"<what a native speaker pairs those words with>","why":"<one short line>"}],' +
    '"remember_title":"<3-8 words>","remember_body":"<two sentences>",' +
    '"next_recording":"<the exact task for the next 60-second recording>",' +
    '"quick_win_title":"<3-8 words>","quick_win_goal":"<one measurable goal>",' +
    '"concept_title":"<a speaking principle they just used or need, 2-5 words>","concept_body":"<one sentence tying it to their speech>",' +
    '"coach_script":"<what the coach SAYS to them, 75-95 words of plain spoken English (B1), second person, in this order: how they came across, the one mistake and its rule, the one sentence to copy, and the task for the next recording. Sentences only, no lists, no markdown, no headings.>",' +
    '"versions":[{"style":"<2-4 words naming the register, e.g. Clear and direct / Executive polish>","text":"<the WHOLE speech said again in that register>","learn":["<each professional phrase or business idiom this version introduced, exact words as they appear in text>"]}],' +
    '"idioms":[{"idiom":"<a professional idiom or executive phrase the learner did NOT use>","meaning":"<plain meaning, one line>","when":"<the situation it fits, one line>","example":"<one sentence using it about the learner\'s own topic>"}]} ' +
    "structure has 3 to 5 items of at most 6 words each; hedges has 0 to 3 items. " +
    "corrections: only real mistakes actually present in the transcript, at most 5, most damaging first, never the same rule twice; said must appear in the transcript word for word; if the English is already correct, return an empty array rather than inventing one. Ignore missing punctuation and capitalisation — this was speech. " +
    "sentences: EXACTLY 3 (or one per sentence they said, if they said fewer). said must be copied from the transcript. Three DIFFERENT patterns. A pattern is a content-free frame: every noun, number, month, job title and topic word of theirs becomes a [slot], and only the connective skeleton survives, so the frame still works tomorrow on a completely different subject. 2 or 3 slots, never more. \"so I suggest we [action] next month\" is wrong — the month is content; \"I am asking for [what] by [when]\" is right. " +
    "words: 4 to 6 upgrades of words they actually used; said must appear in the transcript. An upgrade is a MORE PRECISE word, not a bigger one: never a plural or tense fix (that is a correction), never the same word with an adjective bolted on, never a bookish synonym nobody says out loud, and never a word already handled in corrections. If you cannot find 4 honest upgrades, return fewer. " +
    "collocations: 0 to 3, only genuinely unnatural pairings they used (e.g. 'do a training' -> 'run a training session'); an empty array is the right answer when everything sounded natural. " +
    "versions has EXACTLY 2 items: two different ways the learner could have said the same thing — every fact, name and number kept, first person, spoken register, 60-110% of the original length, no filler, no hedging; version 1 plain and direct (B1), version 2 " + (trade ? "the way a confident supervisor says it on site (B2), still plain" : "polished executive English (B2-C1)") + ". Each version must weave in 2 or 3 " + (trade ? "phrases tradespeople and supervisors really use" : "professional phrases or business idioms") + " naturally and list them in learn, and versions and their learn items are always in English. " +
    "idioms has EXACTLY 4 items: NEW " + (trade ? "workplace idioms or phrases heard on site and in the workshop" : "professional idioms or executive phrases") + " (not ones the learner used, and different from those in versions) that fit the learner's topic and next conversation. " +
    anTaskBlock(ctx) +
    /* Measured on the live Worker, 22 Sep 2026: with the language rule stated once,
       mid-prompt, as a list of exceptions, a French learner got a report written
       entirely in English. Most of this app's learners are francophone. So the rule
       is last, it names both sets of fields, and it says what each set is FOR. */
    "LANGUAGE — the report is bilingual and this is the most important instruction here. " +
    "ENGLISH (what the learner will SAY OUT LOUD, so it must be plain spoken English): key_message, sharper, example, coach_script, every versions[].text and versions[].learn, every idioms[].idiom and idioms[].example, every hedges[].better, every corrections[].said and corrections[].fix, every sentences[].said, sentences[].rebuilt and sentences[].pattern, every words[].said, words[].better and words[].example, every collocations[].said and collocations[].better. " +
    (lang === "en" ? "Everything else is in English too. " :
      "EVERY OTHER FIELD (what the learner READS to understand — level_note, structure, structure_note, answer_directly, evidence, credibility, remember_title, remember_body, next_recording, quick_win_title, quick_win_goal, concept_title, concept_body, every corrections[].why and corrections[].kind, every sentences[].pattern_use, every words[].meaning, every collocations[].why, every idioms[].meaning and idioms[].when, and every versions[].style) MUST be written in " + language + ". Not English. A learner who reads " + language + " is reading these to understand the English ones. ");
  const user = "Transcript:\n" + transcript + "\n\nMeasured:\n" + JSON.stringify(metrics) + (ctx ? "\n\nContext:\n" + JSON.stringify(ctx) : "");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: AN_MODEL, max_tokens: 4200, temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const raw = ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "{}").trim();
  let p; try { p = JSON.parse(raw); } catch { p = {}; }
  const out = {};
  for (const [k, max] of Object.entries(AN_FIELDS)) out[k] = anStr(p[k], max);
  out.clarity = out.clarity === "fuzzy" ? "fuzzy" : "clear";
  out.level = AN_LEVELS.includes(out.level) ? out.level : "";
  out.structure = (Array.isArray(p.structure) ? p.structure : []).map(x => anStr(x, 60)).filter(Boolean).slice(0, 5);
  out.hedges = (Array.isArray(p.hedges) ? p.hedges : [])
    .map(h => h && typeof h === "object" ? { said: anStr(h.said, 60), better: anStr(h.better, 160) } : null)
    .filter(h => h && h.said && h.better).slice(0, 3);
  /* two full versions of what they said (owner, 2026-09-21) + three idioms to learn */
  out.versions = (Array.isArray(p.versions) ? p.versions : [])
    .map(v => v && typeof v === "object" ? { style: anStr(v.style, 40), text: anStr(v.text, 1600), learn: (Array.isArray(v.learn) ? v.learn : []).map(x => anStr(x, 60)).filter(Boolean).slice(0, 4) } : null)
    .filter(v => v && v.text.split(" ").length >= 8).slice(0, 2);
  out.idioms = (Array.isArray(p.idioms) ? p.idioms : [])
    .map(x => x && typeof x === "object" ? { idiom: anStr(x.idiom, 60), meaning: anStr(x.meaning, 160), when: anStr(x.when, 160), example: anStr(x.example, 220) } : null)
    .filter(x => x && x.idiom && x.meaning).slice(0, 4);
  /* ---- the teaching half (owner, 22 Sep 2026): the mistakes with their rule,
     their own sentences rebuilt on a reusable pattern, and the words. Each one
     is checked against the transcript before it is sent: a "correction" of
     something the learner never said is worse than no correction at all, and
     the model does occasionally produce one. Anything unverifiable is dropped
     rather than shown — an empty section is honest, a fabricated one is not. */
  const said = " " + transcript.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ") + " ";
  const quoted = v => { const q = String(v || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim(); return q.length > 1 && said.includes(" " + q + " "); };
  const seen = new Set();
  out.corrections = (Array.isArray(p.corrections) ? p.corrections : [])
    .map(c => c && typeof c === "object" ? { said: anStr(c.said, 90), fix: anStr(c.fix, 120), why: anStr(c.why, 160), kind: anStr(c.kind, 20).toLowerCase() } : null)
    .filter(c => c && c.said && c.fix && c.why && quoted(c.said) && c.said.toLowerCase() !== c.fix.toLowerCase())
    .filter(c => { const k = c.said.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 5);
  out.sentences = (Array.isArray(p.sentences) ? p.sentences : [])
    .map(x => x && typeof x === "object" ? { said: anStr(x.said, 300), rebuilt: anStr(x.rebuilt, 320), pattern: anStr(x.pattern, 160), pattern_use: anStr(x.pattern_use, 180) } : null)
    .filter(x => x && x.said && x.rebuilt && x.pattern && quoted(x.said))
    .slice(0, 3);
  /* A "vocabulary upgrade" that is really the plural fix from two sections up
     teaches nothing twice. Anything already corrected, and anything whose whole
     upgrade is an -s or a bolted-on adjective, is dropped here rather than
     trusted to the prompt. */
  const corrected = new Set(out.corrections.flatMap(c => [c.said.toLowerCase(), c.fix.toLowerCase()]));
  const bare = x => x.toLowerCase().replace(/[^a-z ]+/g, "").replace(/\s+/g, " ").trim();
  out.words = (Array.isArray(p.words) ? p.words : [])
    .map(w => w && typeof w === "object" ? { said: anStr(w.said, 60), better: anStr(w.better, 80), meaning: anStr(w.meaning, 160), example: anStr(w.example, 220) } : null)
    .filter(w => w && w.said && w.better && quoted(w.said) && w.said.toLowerCase() !== w.better.toLowerCase())
    .filter(w => !corrected.has(w.said.toLowerCase()) && !corrected.has(w.better.toLowerCase()))
    .filter(w => {                                   // same word, plural or with a word glued on
      const a = bare(w.said), b = bare(w.better);
      if (a.replace(/s$/, "") === b.replace(/s$/, "")) return false;
      return !(b.endsWith(" " + a) || b.startsWith(a + " "));
    })
    .slice(0, 6);
  out.collocations = (Array.isArray(p.collocations) ? p.collocations : [])
    .map(c => c && typeof c === "object" ? { said: anStr(c.said, 80), better: anStr(c.better, 100), why: anStr(c.why, 160) } : null)
    .filter(c => c && c.said && c.better && quoted(c.said) && c.said.toLowerCase() !== c.better.toLowerCase())
    .slice(0, 3);
  return out;
}

/* ---- Polish again ------------------------------------------------------
   The report ends on "this is what you should have said". One version is a
   verdict; three are a choice, and the learner asked for the choice — each
   press writes another whole version of their minute, in a register the
   earlier ones did not use, carrying MORE professional phrases than the last,
   plus two more idioms for their own topic to memorise. Far cheaper than
   re-running the analysis: same transcript, one short answer. The avoid list
   is what they have already been shown, capped so the request cannot grow
   without limit. */
const RP_PER_MIN = 8;
const RP_PER_DAY = 200;
async function callRepolish(env, transcript, avoid, lang, n, ctx) {
  const language = AN_LANGS[lang] || "English";
  const trade = anTrade(ctx);
  const system =
    anCoachLine(ctx) + "The learner spoke for about a minute; the transcript is below. " +
    (ctx && ctx.task ? "It was their answer to this task: " + ctx.task + " — the new version must still answer it. " : "") +
    "Write ONE more way they could have said the WHOLE thing — every fact, name and number kept, first person, spoken register, 60-110% of the original length, no filler and no hedging. " +
    "It must be clearly different from the versions already shown (listed below): a different register and different phrasing, not a reshuffle. " +
    "Carry " + (n >= 3 ? "four" : "three") + (trade ? " phrases tradespeople and supervisors really use on site" : " professional phrases or business idioms") + " inside it, woven in naturally, and list them in learn exactly as they appear in text. " +
    "Then give 2 MORE " + (trade ? "workplace idioms heard on site" : "professional idioms") + " the learner has not been shown, chosen for their topic, for them to memorise. " +
    "Respond with ONLY minified JSON: " +
    '{"version":{"style":"<2-4 words naming the register>","text":"<the whole speech, said that way>","learn":["<each phrase or idiom it introduced>"]},' +
    '"idioms":[{"idiom":"<an idiom they have not been shown>","meaning":"<plain meaning, one line>","when":"<the situation it fits, one line>","example":"<one sentence using it about the learner\'s own topic>"}]} ' +
    "LANGUAGE: version.text, version.learn, every idiom and every example are lines the learner will SAY, so they are in plain spoken English. " +
    (lang === "en" ? "So is everything else. " :
      "version.style, and every meaning and when, are what the learner READS to understand, so they MUST be written in " + language + " — not English.");
  const user = "Transcript:\n" + transcript + "\n\nAlready shown, do not repeat:\n" + (avoid.join("\n---\n") || "(nothing yet)");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: AN_MODEL, max_tokens: 1200, temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  let p; try { p = JSON.parse(((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "{}").trim()); } catch { p = {}; }
  const v = p.version && typeof p.version === "object" ? p.version : {};
  const out = { version: null, idioms: [] };
  const text = anStr(v.text, 1600);
  if (text.split(" ").length >= 8) out.version = { style: anStr(v.style, 40), text, learn: (Array.isArray(v.learn) ? v.learn : []).map(x => anStr(x, 60)).filter(Boolean).slice(0, 5) };
  out.idioms = (Array.isArray(p.idioms) ? p.idioms : [])
    .map(x => x && typeof x === "object" ? { idiom: anStr(x.idiom, 60), meaning: anStr(x.meaning, 160), when: anStr(x.when, 160), example: anStr(x.example, 220) } : null)
    .filter(x => x && x.idiom && x.meaning).slice(0, 2);
  return out;
}

async function callChat(env, system, messages) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 400,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const raw = ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").trim();
  return shapeChat(raw);
}
function shapeChat(raw) {
  let p;
  try { p = JSON.parse(raw); } catch { p = { reply: raw, covered: [] }; }
  if (!p.reply || typeof p.reply !== "string") p.reply = "Sorry, could you say that again?";
  if (!Array.isArray(p.covered)) p.covered = [];
  // Two callers, two id schemes: the interview coaches number their talking
  // points 1..n, the workplace simulations name their objectives ("safety",
  // "handover"). Coercing with Number() was written for the first and silently
  // turned every one of the second into NaN, so the model's coverage judgement
  // never reached the simulations at all. Both shapes pass through now; the
  // client is the one that validates an id against its own rubric, and it
  // already refuses anything it does not recognise.
  p.covered = p.covered
    .filter(v => typeof v === "number" ? Number.isFinite(v)
               : typeof v === "string" ? v.length > 0 && v.length <= 64
               : false)
    .slice(0, 32);                       // a reply cannot cover more than a scenario has
  const out = { reply: p.reply.slice(0, 800), covered: p.covered };
  if (typeof p.characterId === "string" && p.characterId.length <= 64) out.characterId = p.characterId;
  return out;
}

/* ---- V2 mission speaking report ------------------------------------------
   The chat route deliberately strips a reply down to {reply, covered}; the
   speaking report needs a richer, fixed shape, so it gets its own door rather
   than a loophole in that one. The SYSTEM prompt comes from the client
   (mission-engine.js builds it from the curriculum, exactly as the coach's
   does), so a new week never needs a Worker deploy; this side only bounds the
   inputs and validates the output shape. The client re-validates every claim
   against its own deterministic evidence — this shape check is the transport
   contract, not the truth check. */
export function shapeMvReport(raw) {
  let p; try { p = JSON.parse(raw); } catch { p = {}; }
  const str = (v, n) => (typeof v === "string" && v.trim()) ? v.replace(/\s+/g, " ").trim().slice(0, n) : "";
  const anchored = (v, cap) => (Array.isArray(v) ? v : [])
    .map(x => x && typeof x === "object" ? { move: str(x.move, 64), note: str(x.note, 200) } : null)
    .filter(x => x && x.move && x.note).slice(0, cap);
  return {
    covered: (Array.isArray(p.covered) ? p.covered : [])
      .filter(v => typeof v === "string" && v.length > 0 && v.length <= 64).slice(0, 16),
    well: anchored(p.well, 3),
    improve: anchored(p.improve, 2),
    better: str(p.better, 800),
    expressions: (Array.isArray(p.expressions) ? p.expressions : [])
      .map(x => x && typeof x === "object" ? { e: str(x.e, 80), why: str(x.why, 160) } : null)
      .filter(x => x && x.e).slice(0, 3),
    one: str(p.one, 200),
    /* language polish (23 Sep 2026): you-said → better → why, at most two.
       Transport shape only — the client drops any entry whose "said" is not
       found in the learner's own transcript, so the model cannot put words
       in the learner's mouth. */
    polish: (Array.isArray(p.polish) ? p.polish : [])
      .map(x => x && typeof x === "object" ? { said: str(x.said, 200), better: str(x.better, 260), why: str(x.why, 200) } : null)
      .filter(x => x && x.said && x.better).slice(0, 2),
  };
}

async function callMvReport(env, system, said) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 700,
      temperature: 0.4,                       // a report, not a character — steadier is better
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: said }],
    }),
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  return shapeMvReport(((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").trim());
}

/* Walks the model's JSON as it is typed. The moment a "characterId" string is
   complete it calls emit({c}) — once, and only if it arrives before the reply
   does, because a speaker named afterwards is too late to change the voice
   that is already talking. Then it finds the "reply" string, decodes it
   (escapes included) and calls emit({s}) for each finished sentence; end()
   emits whatever is left. Pure, so it is unit-tested in Node. */
export function replyWalker(emit) {
  let head = "", inReply = false, done = false, esc = false, uni = null, reply = "", sentAt = 0, named = false;
  const flush = final => {
    const pending = reply.slice(sentAt);
    const parts = final ? [pending] : (pending.match(/[^.!?…]+[.!?…]+["')\]]*\s+/g) || []);
    for (const part of parts) { const t = part.trim(); if (t) emit({ s: t }); sentAt += part.length; }
  };
  const feedChar = ch => {
    if (done) return;
    if (esc) {
      if (uni !== null) { uni += ch; if (uni.length === 4) { reply += String.fromCharCode(parseInt(uni, 16) || 63); uni = null; esc = false; } return; }
      if (ch === "u") { uni = ""; return; }
      reply += (ch === "n" || ch === "t" || ch === "r") ? " " : ch; esc = false; return;
    }
    if (ch === "\\") { esc = true; uni = null; return; }
    if (ch === '"') { done = true; flush(true); return; }
    reply += ch; if (/\s/.test(ch)) flush(false);
  };
  return {
    feed(delta) {
      for (const ch of delta) {
        if (inReply) { feedChar(ch); continue; }
        head += ch;
        if (!named) {
          const c = /"characterId"\s*:\s*"([^"\\]{1,64})"/.exec(head);
          if (c) { named = true; emit({ c: c[1] }); }
        }
        const m = /"reply"\s*:\s*"$/.test(head);
        if (m) { inReply = true; head = ""; }
      }
    },
    end() { if (inReply && !done) { done = true; flush(true); } },
    text() { return reply; }
  };
}

/* ---- Streaming chat: the same call with stream:true, read token by token.
   The model answers as a JSON object whose first field is "characterId" and
   whose second is "reply"; this names the speaker as soon as the id is typed,
   then walks the reply string and emits each finished sentence at once, so
   the app can start speaking — in the right voice — while the rest is still
   being written. The last line carries the full, validated object exactly as
   the non-streaming path would have returned it. NDJSON, one object per line:
     {"c":"supervisor"}  {"s":"First sentence."}   … {"done":true,"reply":…,"covered":[…],"characterId":…}
   Anything that goes wrong mid-stream ends with {"error":…}; the client then
   falls back to what it already has. */
async function streamChat(env, system, messages, cors) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: CHAT_MODEL, max_tokens: 400, temperature: 0.8, stream: true,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!r.ok || !r.body) throw new Error("provider " + r.status);
  const enc = new TextEncoder(), dec = new TextDecoder();
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  const line = obj => w.write(enc.encode(JSON.stringify(obj) + "\n"));
  (async () => {
    let raw = "", sse = "";
    const walker = replyWalker(obj => line(obj));
    try {
      const reader = r.body.getReader();
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        sse += dec.decode(value, { stream: true });
        let nl; while ((nl = sse.indexOf("\n")) >= 0) {
          const l = sse.slice(0, nl).trim(); sse = sse.slice(nl + 1);
          if (!l.startsWith("data:")) continue; const d = l.slice(5).trim(); if (d === "[DONE]") continue;
          let delta = ""; try { delta = JSON.parse(d).choices[0].delta.content || ""; } catch { continue; }
          raw += delta; walker.feed(delta);
        }
      }
      walker.end();
      await line({ done: true, ...shapeChat(raw.trim()) });
    } catch (e) { try { await line({ error: String(e.message || e) }); } catch {} }
    try { await w.close(); } catch {}
  })();
  return new Response(readable, { status: 200, headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", ...cors } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
    if (!cors["Access-Control-Allow-Origin"]) return new Response("Forbidden", { status: 403 });

    const ip = request.headers.get("CF-Connecting-IP") || "0";

    // ---- Transcribe path: raw audio in → per-word timings out ----
    const ctype = request.headers.get("content-type") || "";
    if (ctype.startsWith("audio/")) {
      { const l = await limit(env, "ip:" + ip, "stt", STT_PER_MIN, STT_PER_DAY, cors); if (l) return l; }
      { const g = await premiumGate(request, env, "transcribe", cors); if (g) return g; }
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength) return json({ error: "empty" }, 400, cors);
      if (bytes.byteLength > MAX_STT_BYTES) return json({ error: "too_large" }, 413, cors);
      try {
        const keepFillers = new URL(request.url).searchParams.get("fillers") === "1";
        const out = await callTranscribe(env, bytes, ctype, keepFillers);
        return json(out, 200, cors);
      } catch (e) {
        return json({ error: "stt_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    let body; try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400, cors); }

    // ---- Welding Mastery: energy, XP and the Premium pack, all decided here (wm-game.js) ----
    if (body.wm && typeof body.wm === "object") {
      { const l = await limit(env, "ip:" + ip, "wm", 60, 3000, cors); if (l) return l; }
      return await wmHandle(body, request, env, cors, { capabilities, perAccount, json });
    }

    // ---- Role-play chat: scenario + history in → in-character reply out ----
    if (body.chat && typeof body.chat === "object") {
      { const l = await limit(env, "ip:" + ip, "chat", CHAT_PER_MIN, CHAT_PER_DAY, cors); if (l) return l; }
      /* an anonymous Shadow helper has no account ceiling behind it, so it gets
         its own per-IP one as well — before the gate, so it applies whether or
         not enforcement is on and whether or not the caller is signed in */
      if (CHAT_PURPOSE_ANON.has(String(body.chat.purpose || ""))) {
        const l = await limit(env, "ip:" + ip, "shadowchat", SHADOW_PER_MIN, SHADOW_PER_DAY, cors); if (l) return l;
      }
      { const g = await premiumGate(request, env, "chat", cors, body.chat.purpose); if (g) return g; }
      const system = String(body.chat.system || "").slice(0, 4000);
      let messages = Array.isArray(body.chat.messages) ? body.chat.messages : [];
      messages = messages
        .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-MAX_CHAT_TURNS)                       // cap history so a long chat cannot balloon the bill
        .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
      if (!system || !messages.length) return json({ error: "bad_request" }, 400, cors);
      try {
        if (body.chat.stream === true) return await streamChat(env, system, messages, cors);
        return json(await callChat(env, system, messages), 200, cors);
      } catch (e) {
        return json({ error: "chat_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- V2 speaking report: mission context + one answer in → validated report out ----
    if (body.mvreport && typeof body.mvreport === "object") {
      { const l = await limit(env, "ip:" + ip, "chat", CHAT_PER_MIN, CHAT_PER_DAY, cors); if (l) return l; }
      { const g = await premiumGate(request, env, "mvreport", cors); if (g) return g; }
      const system = String(body.mvreport.system || "").slice(0, 6000);
      const said = String(body.mvreport.said || "").replace(/\s+/g, " ").trim().slice(0, 2400);
      if (!system || said.split(" ").length < 5) return json({ error: "bad_request" }, 400, cors);
      try {
        return json(await callMvReport(env, system, said), 200, cors);
      } catch (e) {
        return json({ error: "report_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- Captions path: video id in → cues + word timings out ----
    if (typeof body.captions === "string" && body.captions.trim()) {
      { const l = await limit(env, "ip:" + ip, "cap", CAP_PER_MIN, CAP_PER_DAY, cors); if (l) return l; }
      { const g = await premiumGate(request, env, "captions", cors); if (g) return g; }
      try {
        const out = await fetchYouTubeCaptions(body.captions.trim());
        // cache successes hard — a video's captions do not change
        const headers = out.error ? cors : { "cache-control": "public, max-age=604800", ...cors };
        return json(out, out.error ? 404 : 200, headers);
      } catch (e) {
        return json({ error: "captions_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    /* ---- Gemini transcript: the only route that works for a video the learner
       pasted. YouTube refuses this Worker's datacentre IP for its own caption
       track (measured 22 Sep 2026: track_parse / page_429 on every video), but
       Google's own model accepts a public YouTube URL as input and transcribes
       it. Two things learned by measurement and encoded here:
         · ask for MM:SS, never raw seconds. With seconds the model invents
           times past the end of the video — median error 280 s on a 15-minute
           talk. With MM:SS the median error is 1 s, the 90th percentile 5 s.
         · that is line-level accuracy, not word-level, so the app must mark
           word timing as estimated for these. It already does.
       ~$0.08 for a 15-minute video, so the answer is cached hard: a video's
       words do not change. Without GEMINI_KEY set this route simply says so. */
    if (typeof body.ytai === "string" && /^[A-Za-z0-9_-]{11}$/.test(body.ytai.trim())) {
      /* FIRST, before anything else on this route — see J1 above. It is also
         before the no_key check on purpose: an anonymous caller should not be
         able to learn whether a provider key is configured, and a 501 arriving
         ahead of the 401 would make the route look open on an environment that
         simply has no key (staging, where GEMINI_KEY is deliberately absent).
         It is before the CACHE lookup on purpose too: a kept answer is free to
         serve but it is still this learner's content, and authentication must
         not be skippable by asking for a popular video. */
      const acct = await ytaiAccount(request, env, cors);
      if (acct.res) return acct.res;
      if (!env.GEMINI_KEY) return json({ error: "no_key" }, 501, cors);
      /* no premiumGate call here: ytaiAccount above already ran it in the
         enforcement-on mode, which is what put the verification FIRST. */
      const vid = body.ytai.trim(), win = ytaiWindow(body);
      if (win === false) return json({ error: "bad_window" }, 400, cors);
      const cache = typeof caches !== "undefined" ? caches.default : null, key = ytaiCacheKey(vid, win);
      /* a kept answer is free: served before the brake, which counts only calls that cost */
      try { const hit = cache && await cache.match(key); if (hit) return json({ ...(await hit.json()), cached: true }, 200, cors); } catch {}
      const tier = acct.tier || "free";
      /* PER IP, sized by tier. The anonymous allowance is deliberately the
         smallest thing here: it buys a try, not a habit. */
      { const a = tier === "anon";
        const l = win ? await limit(env, "ip:" + ip, a ? "ytaianonwin" : "ytaiwin",
                                    a ? YTAI_ANON_WIN_PER_MIN : YTAI_WIN_PER_MIN,
                                    a ? YTAI_ANON_WIN_PER_DAY : YTAI_WIN_PER_DAY, cors)
                      : await limit(env, "ip:" + ip, a ? "ytaianon" : "ytai",
                                    a ? YTAI_ANON_PER_MIN : YTAI_PER_MIN,
                                    a ? YTAI_ANON_PER_DAY : YTAI_PER_DAY, cors);
        if (l) return l; }
      /* THE GLOBAL ANONYMOUS POOL — the only limit here that bounds the BILL
         rather than one caller. Every anonymous request on every address shares
         one bucket, spent in seconds of video, so a thousand fresh addresses
         cost the same as one. Signed-in learners never touch it: a busy day of
         strangers must not be able to lock out the people who signed up.
         It is the LAST brake checked, so a request already refused per IP does
         not spend the pool it was never going to use. */
      if (tier === "anon") {
        const l = await limit2(env, "global:ytai-anon", "anonpool", ytaiAnonPoolSec(env), 86_400_000, ytaiCostSec(win), cors);
        if (l) return l;
      }
      /* AND against the ACCOUNT, not only the IP. This is the one free route
         with a real per-call cost (~$0.08 for 15 minutes of video), and a
         per-IP limit is worth very little on the carrier NAT most of this
         app's learners are behind: a whole city can share one address, and one
         learner can change theirs by walking between two wifi networks. The
         account is the unit that actually corresponds to a person.
         Only available while enforcement is on, because that is the only state
         in which a call carries a verified account at all — with Premium not
         on sale the IP limits above are still the whole brake, which is why
         this route must not be opened to anonymous callers. */
      { /* enforcement off: the uid ytaiAccount just verified. Enforcement on:
           the uid be-entitlements accepted, read back from the cached answer.
           Either way the subject string is the same shape, so one learner has
           one bucket whichever mode the Worker is in — and the cap is no
           longer inert in production.
           METERED IN SECONDS OF VIDEO per UTC day (the tier spec, 5 Oct 2026):
           30 minutes on Free, 240 on Premium, charged at what the request
           would cost — a whole video at YTAI_MAX_SEC, a window at its length —
           in the same all-or-nothing bucket as the per-minute brake. The
           per-call day counts (YTAI_ACCT_PER_DAY / YTAI_PREM_PER_DAY) are
           replaced by that budget; the per-minute caps stay. */
        const a = acct.subject || await acctSubject(request, env);
        const prem = tier === "premium";
        /* Free while Premium is on sale = the one-off trial (YTAI_FREE_TRIAL_SEC) */
        const trial = !prem && premiumOn(env);
        if (a) {
          const now = Date.now(), budget = prem ? YTAI_PREMIUM_SEC_PER_DAY : trial ? YTAI_FREE_TRIAL_SEC : YTAI_FREE_SEC_PER_DAY;
          const name = trial ? "ytaitrial" : "ytaisec:" + utcDay(now), resetAt = utcMidnightAfter(now), cost = ytaiCostSec(win);
          const r = await consume(env, a, [
            { name: "ytaiacct:min", limit: prem ? YTAI_PREM_PER_MIN : YTAI_ACCT_PER_MIN, windowMs: 60_000 },
            { name, limit: budget, windowMs: trial ? YTAI_TRIAL_WINDOW_MS : 86_400_000, cost },
          ]);
          if (!r.ok) {
            if (r.bucket === "ytaiacct:min") return json({ error: "rate_limited", retryAfter: r.retryAfter }, 429, { ...cors, "Retry-After": String(r.retryAfter || 60) });
            /* a spent trial has nothing to wait for — the answer is Premium — so
               it says trial:true and carries no resetAt and no Retry-After */
            if (trial) return json({ error: "allowance", scope: "video", limit: budget, plan: "free", trial: true }, 429, { ...cors, "Access-Control-Expose-Headers": "X-BE-Allowance, X-BE-Video-Allowance, Retry-After" });
            return allowanceRefused(cors, "video", budget, resetAt, prem ? "premium" : "free", now);
          }
          const used = Math.min(budget, Number((r.counts && r.counts[name]) || 0) || 0);
          allowanceHeader(cors, "X-BE-Video-Allowance", trial ? { used, limit: budget, plan: "free", trial: true }
                                                              : { used, limit: budget, resetAt, plan: prem ? "premium" : "free" });
        } }
      try {
        const out = await geminiCaptions(env, vid, win);
        if (!out.error && cache) {
          try { await cache.put(key, new Response(JSON.stringify(out), { headers: { "content-type": "application/json", "cache-control": "public, max-age=" + YTAI_CACHE_S } })); } catch {}
        }
        return json(out, out.error ? 502 : 200, cors);
      } catch (e) {
        return json({ error: "ytai_failed", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- TTS path: natural voice for the app's Hear/Slow buttons ----
    if (typeof body.tts === "string" && body.tts.trim()) {
      { const l = await limit(env, "ip:" + ip, "tts", TTS_PER_MIN, TTS_PER_DAY, cors); if (l) return l; }
      { const g = await premiumGate(request, env, "tts", cors); if (g) return g; }
      const text = body.tts.trim().slice(0, MAX_TTS_CHARS);
      let voice = String(body.voice || "alloy").toLowerCase();
      if (!TTS_VOICES.includes(voice)) voice = "alloy";
      try {
        const r = await callTTS(env, text, voice, body.style);
        if (!r.ok) return json({ error: "tts_unavailable", detail: "provider " + r.status }, 502, cors);
        return new Response(r.body, {
          status: 200,
          headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=86400", ...cors },
        });
      } catch (e) {
        return json({ error: "tts_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- Pronunciation-assessment path: audio (base64) + target → per-word scores ----
    if (typeof body.assess === "string" && body.assess.trim() && typeof body.audio === "string" && body.audio) {
      { const l = await limit(env, "ip:" + ip, "assess", ASSESS_PER_MIN, ASSESS_PER_DAY, cors); if (l) return l; }
      { const g = await premiumGate(request, env, "assess", cors); if (g) return g; }
      if (body.audio.length > MAX_ASSESS_B64) return json({ error: "too_large" }, 413, cors);
      const target = body.assess.trim().slice(0, MAX_INPUT_CHARS);
      const fmt = body.format === "mp3" ? "mp3" : "wav";
      try {
        let out = await callAssess(env, target, body.audio, fmt);
        if (!out) out = await whisperAssess(env, b64ToBytes(body.audio), "audio/" + fmt, target); // no audio model → cross-check
        return json(out, 200, cors);
      } catch (e) {
        return json({ error: "assess_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- Speech-analysis path: transcript + device-measured numbers → coaching report ----
    if (body.analyse && typeof body.analyse === "object") {
      { const l = await limit(env, "ip:" + ip, "analyse", AN_PER_MIN, AN_PER_DAY, cors); if (l) return l; }
      { const g = await premiumGate(request, env, "analyse", cors); if (g) return g; }
      const transcript = String(body.analyse.transcript || "").replace(/\s+/g, " ").trim().slice(0, MAX_AN_CHARS);
      if (transcript.split(" ").length < 5) return json({ error: "empty" }, 400, cors);
      const metrics = body.analyse.metrics && typeof body.analyse.metrics === "object" ? body.analyse.metrics : {};
      const m = {};                                    // numbers only, a bounded set — nothing personal rides along
      for (const k of ["seconds","words","wpm","hesitations","fillers","hedges","wordsPerSentence","sentences","vocabularyPct","pitchSemitones"]) {
        if (Number.isFinite(+metrics[k])) m[k] = Math.round(+metrics[k] * 10) / 10;
      }
      const lang = String(body.analyse.lang || "en").slice(0, 5).toLowerCase();
      const ctx = anCtx(body.analyse.context);
      try {
        return json(await callAnalyse(env, transcript, m, lang, ctx), 200, cors);
      } catch (e) {
        return json({ error: "analyse_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- Polish again: one more whole version of the same minute ----
    if (body.repolish && typeof body.repolish === "object") {
      { const l = await limit(env, "ip:" + ip, "repolish", RP_PER_MIN, RP_PER_DAY, cors); if (l) return l; }
      { const g = await premiumGate(request, env, "repolish", cors); if (g) return g; }
      const transcript = String(body.repolish.transcript || "").replace(/\s+/g, " ").trim().slice(0, MAX_AN_CHARS);
      if (transcript.split(" ").length < 5) return json({ error: "empty" }, 400, cors);
      const avoid = (Array.isArray(body.repolish.avoid) ? body.repolish.avoid : [])
        .map(x => String(x || "").replace(/\s+/g, " ").trim().slice(0, 1600)).filter(Boolean).slice(-4);
      const lang = String(body.repolish.lang || "en").slice(0, 5).toLowerCase();
      const ctx = anCtx(body.repolish.context);
      try {
        return json(await callRepolish(env, transcript, avoid, lang, avoid.length + 1, ctx), 200, cors);
      } catch (e) {
        return json({ error: "repolish_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- Polish path ----
    { const l = await limit(env, "ip:" + ip, "polish", RATE_PER_MIN, RATE_PER_DAY, cors); if (l) return l; }
    { const g = await premiumGate(request, env, "polish", cors); if (g) return g; }
    const sentence = String(body.text || "").trim().slice(0, MAX_INPUT_CHARS);
    const avoid = Array.isArray(body.avoid) ? body.avoid.slice(0, 12).map(s => String(s).slice(0, 200)) : [];
    if (!sentence) return json({ error: "empty" }, 400, cors);

    try {
      const versions = await callAI(env, sentence, avoid);
      if (!versions.length) return json({ error: "no_versions" }, 502, cors);
      return json({ versions }, 200, cors);
    } catch (e) {
      return json({ error: "ai_unavailable", detail: String(e.message || e) }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
