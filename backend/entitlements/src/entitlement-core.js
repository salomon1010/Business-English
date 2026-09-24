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
export const PLANS = Object.freeze({
  free: Object.freeze({
    id: "free", paid: false, ads: true,
    capabilities: Object.freeze({ ad_free: false, ai_allowance: "standard", practice_allowance: "standard" }),
  }),
  premium: Object.freeze({
    id: "premium", paid: true, ads: false,
    capabilities: Object.freeze({ ad_free: true, ai_allowance: "enhanced", practice_allowance: "enhanced" }),
  }),
});

/* products are what a store sells; plans are what the app understands.
   Several products can map to one plan (monthly and annual are both Premium). */
export const PRODUCTS = Object.freeze({
  premium_monthly: "premium",
  premium_annual: "premium",
  premium_promo: "premium",
});

/* stored statuses. "in force" = the plan applies (subject to expires_at). */
export const STATUSES = Object.freeze({
  active:   { inForce: true },   // paid and current
  trialing: { inForce: true },   // introductory / free trial
  grace:    { inForce: true },   // renewal failed; the store keeps access until expires_at
  expired:  { inForce: false },  // ran out
  revoked:  { inForce: false },  // refunded / cancelled with immediate effect
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
  return { ok: true };
}

const view = (planId, state, extra = {}) => {
  const p = PLANS[planId];
  return {
    plan: p.id,
    paid: p.paid,
    state,                                  // none | active | trialing | grace | expired | revoked | pending | invalid
    ads: p.ads,                             // plan-level ad eligibility (frequency and context are the client policy's)
    capabilities: { ...p.capabilities },
    expiresAt: extra.expiresAt ?? null,     // ms; null = no end (or free)
    source: extra.source ?? null,           // provider-agnostic label, never an id
  };
};

/* record (or null) + the server's clock → the application-facing VIEW */
export function resolve(record, nowMs) {
  if (record == null) return view("free", "none");
  const v = validateRecord(record);
  if (!v.ok) return view("free", "invalid");
  const st = STATUSES[record.status];
  if (!st.inForce) return view("free", record.status);
  if (record.starts_at != null && nowMs < record.starts_at) return view("free", "pending");
  if (record.expires_at != null && nowMs >= record.expires_at) return view("free", "expired");
  return view(record.plan, record.status, { expiresAt: record.expires_at ?? null, source: record.source ?? null });
}

/* The questions the brief asks the service to answer — all derived from a
   VIEW, so no caller re-implements the rules. */
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
