/* BE Mastery — entitlement core (pure: no I/O, no Worker, no DOM).

   The ONE place that turns a stored entitlement record into what the
   application is allowed to know: which plan is in force, whether it is paid,
   whether advertising applies, which capabilities it carries, and until when.

   Nothing provider-specific reaches this file. A billing adapter
   (src/adapters/) normalises a store / provider event into a RECORD; this
   file resolves a RECORD into a VIEW; the Worker returns the VIEW. The
   application — web today, iOS / Android later — only ever sees the VIEW.

   Fail closed to FREE: a missing, malformed, unknown, expired, revoked or
   not-yet-started record is the free plan. Free is a complete product (the
   curriculum is never metered by plan), so "free by mistake" costs a paying
   learner an ad until the next refresh — never access they had not paid for. */

/* ---------------------------------------------------------------- plans
   Account-level: a plan is the same on General English and Welding. It grants
   CAPABILITIES, never tracks — which features a track has is the app's own
   track authorisation (isGeneralEnglish() / the partner Worker's TRACKS), and
   no plan changes it. Add a plan by adding an entry; nothing else changes. */

/* The capabilities a plan can carry. This list is the contract: the client's
   ENT_CAPS and hasEntitlement() accept exactly these names, be-polish reads
   exactly these names out of the view, and a name that is not here is refused
   rather than silently allowed. Booleans only — ai_allowance and
   practice_allowance are older enums kept for the ad and reward code.
   (There is no /v1/capability route; an earlier comment here named one. The
   entitlements Worker serves GET /v1/entitlement and nothing else reads a
   capability by name over HTTP.)

   EVERY NAME HERE MUST GATE SOMETHING. One was removed on 1 October 2026 for
   failing that rule — "feedback spoken back to you" was row two of the paywall
   and was checked at zero call sites, while the TTS route is deliberately free
   because the natural voice reads CONTENT: lessons, characters, words. Every
   Free learner already had it. A capability nothing enforces is not a
   capability, it is a claim, and selling one is a store-disclosure problem as
   well as a trust one. Add a name here on the day its call site lands, never
   before, and never to make the paywall look longer. */
export const CAPABILITIES = Object.freeze([
  "ad_free",               // no advertising
  "ai_analysis",           // pronunciation / grammar / vocabulary / fluency analysis and the detailed speaking score
  "advanced_progress",     // 30- and 90-day analytics, trends, the long-term record
  "ai_coach",              // the AI coach session and its detailed feedback
  "recommended_content",   // opening the personalised recommendations on Home
]);
export const PLANS = Object.freeze({
  free: Object.freeze({
    id: "free", paid: false, ads: true,
    capabilities: Object.freeze({ ad_free: false, ai_allowance: "standard", practice_allowance: "standard",
      ai_analysis: false, advanced_progress: false, ai_coach: false, recommended_content: false }),
  }),
  premium: Object.freeze({
    id: "premium", paid: true, ads: false,
    capabilities: Object.freeze({ ad_free: true, ai_allowance: "enhanced", practice_allowance: "enhanced",
      ai_analysis: true, advanced_progress: true, ai_coach: true, recommended_content: true }),
  }),
});

/* products are what a store sells; plans are what the app understands.
   Several products can map to one plan (monthly and annual are both Premium).
   The App Store and Google Play sell the SAME two ids (owner, 6 Oct 2026). */
export const PRODUCTS = Object.freeze({
  premium_monthly: "premium",   // 1 month, both stores
  premium_annual: "premium",    // 1 year, both stores
  premium_promo: "premium",
});

/* stored statuses. "in force" = the plan applies (subject to expires_at). */
export const STATUSES = Object.freeze({
  active:   { inForce: true },   // paid and current
  trialing: { inForce: true },   // introductory / free trial
  grace:    { inForce: true },   // renewal failed; the store keeps access until expires_at
  expired:  { inForce: false },  // ran out
  revoked:  { inForce: false },  // refunded / cancelled with immediate effect
  payment_pending: { inForce: false },  // bought with a slow payment method (e.g. cash): no Premium until the store confirms payment
});

/* sources are provider-agnostic labels safe to show a client */
export const SOURCES = Object.freeze(["google_play", "app_store", "web", "promo", "manual"]);

const isMs = v => v === null || v === undefined || (Number.isFinite(v) && v >= 0 && v < 8.64e15);

/* A record as stored (see migrations/0001_entitlements.sql). Returns
   { ok: true } or { ok: false, why } — never throws. */
export function validateRecord(r) {
  if (!r || typeof r !== "object") return { ok: false, why: "not_object" };
  if (typeof r.uid !== "string" || !r.uid || r.uid.length > 128) return { ok: false, why: "uid" };
  if (!Object.prototype.hasOwnProperty.call(PLANS, r.plan)) return { ok: false, why: "plan" };
  if (!Object.prototype.hasOwnProperty.call(STATUSES, r.status)) return { ok: false, why: "status" };
  if (!isMs(r.starts_at) || !isMs(r.expires_at) || !isMs(r.updated_at)) return { ok: false, why: "time" };
  if (r.starts_at != null && r.expires_at != null && r.expires_at <= r.starts_at) return { ok: false, why: "window" };
  if (r.source != null && !SOURCES.includes(r.source)) return { ok: false, why: "source" };
  if (r.product != null && PRODUCTS[r.product] !== r.plan) return { ok: false, why: "product" };
  if (r.will_renew != null && r.will_renew !== 0 && r.will_renew !== 1) return { ok: false, why: "will_renew" };
  /* app_id is optional (a store adapter fills it, a pre-split row has none and
     reads as the first programme), but a value that is not a programme this
     deployment knows is a mistake, not a default: it would write a row no read
     can ever find. */
  if (r.app_id != null && typeof r.app_id !== "string") return { ok: false, why: "app_id" };
  return { ok: true };
}

const view = (planId, state, extra = {}) => {
  const p = PLANS[planId];
  return {
    plan: p.id,
    paid: p.paid,
    state,                                  // none | active | trialing | grace | expired | revoked | payment_pending | pending | invalid
    ads: p.ads,                             // plan-level ad eligibility (frequency and context are the client policy's)
    capabilities: { ...p.capabilities },
    startedAt: extra.startedAt ?? null,     // ms; when the paid plan began
    expiresAt: extra.expiresAt ?? null,     // ms; null = no end (or free)
    renews: extra.renews ?? null,           // true renews · false cancelled but paid to expiresAt · null unknown / n.a.
    source: extra.source ?? null,           // provider-agnostic label, never an id
  };
};

/* record (or null) + the server's clock → the application-facing VIEW */
/* ---- WHICH APP A PURCHASE BELONGS TO (owner, 12 Oct 2026) ------------------
   BE Mastery is two store apps, and the owner's rule is that a purchase made
   in one app grants Premium in THAT app only. The app is identified by its
   PROGRAMME ("general-english" / "welding") so one value covers both
   platforms, and the mapping from a store identity to a programme is
   CONFIGURATION, never a client claim:

     PLAY_PACKAGE    = "com.bemastery.app,com.lomonec.bemastery.welding"
     APPLE_BUNDLE_ID = "com.lomonec.bemastery,com.lomonec.bemastery.welding"
     APP_PROGRAMMES  = "general-english,welding"

   The three lists are INDEX-ALIGNED: position i is the same app on Play, on
   the App Store and in the data. programmes() refuses a misaligned
   configuration rather than guess, because guessing would attach a purchase
   to the wrong app.

   With one programme configured (production today) every purchase resolves to
   it and nothing behaves differently from before the split. */
export const programmes = env => {
  const p = String((env && env.APP_PROGRAMMES) || "").split(",").map(x => x.trim()).filter(Boolean);
  return p.length ? p : ["general-english"];
};
export const defaultProgramme = env => programmes(env)[0];
/* A programme the service is configured for, or null. Used to validate the
   app a caller asks about — it can only ever SELECT among this account's own
   purchases, never create an entitlement. */
export const knownProgramme = (env, id) => {
  const list = programmes(env);
  return typeof id === "string" && list.includes(id) ? id : null;
};
/* The programme a store identity belongs to, by position in the aligned lists.
   Returns null when the lists disagree or the identity is not one of ours, and
   the caller then refuses the purchase rather than filing it under the wrong
   app. */
export function programmeOfStoreId(env, storeId) {
  if (typeof storeId !== "string" || !storeId) return null;
  const progs = programmes(env);
  const split = v => String((env && v) || "").split(",").map(x => x.trim()).filter(Boolean);
  for (const list of [split(env && env.PLAY_PACKAGE), split(env && env.APPLE_BUNDLE_ID)]) {
    const i = list.indexOf(storeId);
    if (i < 0) continue;
    /* Only the position that HAS a programme maps. Adding a second package or
       bundle id without extending APP_PROGRAMMES therefore refuses the new
       app's purchases and leaves the existing app's untouched — the safe
       direction for a configuration mistake, rather than taking live billing
       down with it. */
    return progs[i] || null;
  }
  return null;
}
/* NULL in the database means "made before the split", which can only be the
   first configured app. */
export const appOf = (env, stored) => stored || defaultProgramme(env);

export function resolve(record, nowMs) {
  if (record == null) return view("free", "none");
  const v = validateRecord(record);
  if (!v.ok) return view("free", "invalid");
  const st = STATUSES[record.status];
  if (!st.inForce) return view("free", record.status);
  if (record.starts_at != null && nowMs < record.starts_at) return view("free", "pending");
  if (record.expires_at != null && nowMs >= record.expires_at) return view("free", "expired");
  return view(record.plan, record.status, { startedAt: record.starts_at ?? null, expiresAt: record.expires_at ?? null,
    renews: record.will_renew == null ? null : record.will_renew === 1, source: record.source ?? null });
}

/* The questions the brief asks the service to answer — all derived from a
   VIEW, so no caller re-implements the rules. */
/* among an account's records, the one that should decide its entitlement:
   an in-force paid record with the latest expiry; otherwise the most recent
   record (so the view can say "expired" / "revoked" and from where) */
export function pickRecord(records, nowMs, app) {
  /* `app` (a programme id) narrows the records to the ones bought in THAT app.
     Omit it and every record counts, which is the pre-split behaviour and what
     a single-app configuration still does. A record with no app_id is the
     original app's — the caller resolves that before calling. */
  const scoped = app == null ? (records || []) : (records || []).filter(r => r.app_id === app);
  const valid = scoped.filter(r => validateRecord(r).ok);
  if (!valid.length) return null;
  const live = valid.filter(r => resolve(r, nowMs).paid);
  const byExp = (a, b) => (b.expires_at ?? Infinity) - (a.expires_at ?? Infinity) || (b.updated_at || 0) - (a.updated_at || 0);
  if (live.length) return live.sort(byExp)[0];
  return valid.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))[0];
}
export const isPremium = v => !!v && v.plan === "premium" && v.paid === true;
export const adsEnabled = v => !v || v.ads !== false;
export const hasCapability = (v, name) => !!v && !!v.capabilities && v.capabilities[name] === true;

/* ------------------------------------------------------------ rewards
   What a rewarded ad can earn. Every kind ships DISABLED: no metered Free
   allowance exists yet for a reward to extend, and a reward with nothing to
   spend it on would be a promise the app cannot keep. The server enables a
   kind by configuration (env REWARD_KINDS_ENABLED), never a client. */
export const REWARD_KINDS = Object.freeze({
  extra_ai_practice: Object.freeze({ amount: 1, dailyMax: 3 }),
  extra_shadow_challenge: Object.freeze({ amount: 1, dailyMax: 3 }),
});
export const REWARD_SESSION_TTL_MS = 30 * 60_000;
export function rewardKindEnabled(kind, envList) {
  if (!Object.prototype.hasOwnProperty.call(REWARD_KINDS, kind)) return false;
  return String(envList || "").split(",").map(s => s.trim()).filter(Boolean).includes(kind);
}
