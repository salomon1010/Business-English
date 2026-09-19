/* ============================================================================
   BE Mastery — product events (Cloudflare Worker + Analytics Engine)
   ----------------------------------------------------------------------------
   Cloudflare Web Analytics answers "how many people arrived, and from where".
   It has no custom-event API, so it cannot answer the questions that decide
   what to build next: do people finish onboarding, do they come back on day 2,
   where in the 12 weeks do they stop. This Worker captures those.

   Self-owned on purpose. No third-party analytics vendor, no cookies, no
   consent banner, no monthly fee — the data lands in an Analytics Engine
   dataset on the same account that already runs be-polish and be-push.

   WHAT IS ACCEPTED
   ----------------
   An allow-list, and nothing else (EVENTS / PROP_KEYS below). An open endpoint
   would let anyone write junk into the dataset, and — worse — would let a
   future careless track() call ship something personal without anyone noticing.
   A name that is not on the list is dropped with 204, not stored.

   Values are truncated hard and are expected to be small enums ("3", "week_2").
   Never add a prop that could carry free text: no phrase text, no transcript,
   no note, no name, no email. If a new event needs one of those, the answer is
   that the event is wrong, not that the cap should be raised.

   WHAT IS NOT STORED
   ------------------
   No cookie, no device ID, no IP. Analytics Engine keeps the country Cloudflare
   already knows from the edge, which is coarse enough to stay anonymous and
   useful enough to tell you which markets to translate for next.

   DEPLOY / QUERYING: see README.md in this folder.
   ============================================================================ */

const ALLOWED_ORIGINS = [
  "https://app.lomonec.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

// Every event the app is allowed to record. Adding one here is the deliberate
// step that lets it through — keep this in step with index.html.
const EVENTS = new Set([
  "app_open",
  "onboarding_complete",
  "practice_day",
  "session_complete",
  "share",
  "invite",
  "rate_click",
  "rate_later",
  "play_click",
  "install",
  "reminder_on",
  // The workshops are where the app now measures anything, so they are the two
  // events that answer "does this work?". Neither carries what was said.
  "workshop_start",
  "workshop_score_band",
  // A learner coming back after two hours or more, landing on the road map.
  // Answers "do people come back, and after how long?" — counts, not people.
  "return_open",
  // Someone tapped "I want a practice partner" on the demand card. Sizes the
  // partner feature before it is built. Counts, not people.
  "partner_interest",
  // Practice Partner (feature/practice-partner): a pair formed, a voice turn
  // sent (+day 0-6), a report filed, a block placed. Counts only — no names,
  // no audio, no transcript, no uid.
  "partner_pair", "partner_turn", "partner_report", "partner_block",
  // Practice Partner phase 2 funnel (General English only): profile → match
  // requested → queue → candidates shown → trial → turns → completion →
  // continue / rematch → connection; safety; AI fallback; in-app notice.
  "partner_profile_completed", "partner_match_requested", "partner_queue_joined", "partner_candidate_shown",
  "partner_trial_started", "partner_turn_recorded", "partner_turn_sent", "partner_turn_received",
  "partner_session_completed", "partner_continue_selected", "partner_rematch_selected",
  "partner_connection_created", "partner_connection_disconnected", "partner_reported", "partner_blocked",
  "partner_ai_fallback", "partner_notification_sent",
  // Level 2 (AI coach session) and Level 3 (live practice) lifecycle. Counts only.
  "partner_ai_fallback_started", "partner_ai_turn", "partner_ai_fallback_completed",
  "partner_live_invited", "partner_live_accepted", "partner_live_started", "partner_live_reconnected",
  "partner_live_completed", "partner_live_left", "partner_live_failed", "partner_live_help",
  // Shadow Studio V2 (General English only)
  "shadow_v2_opened", "shadow_v2_mode", "shadow_v2_sentence_shadowed", "shadow_v2_challenge_started", "shadow_apply_phrase",
]);

// Prop keys that may accompany an event. Same reasoning as above.
const PROP_KEYS = new Set(["streak", "week", "day", "source", "lang", "result",
  // module: 1-12, the workshop. trade: welder | pipefitter | boilermaker.
  // band: good | fair | poor. All small enums, none of them personal.
  "module", "trade", "band",
  // These were being sent by the client and silently dropped: app_open's three
  // bucketed retention fields and the share kind. Appended rather than inserted
  // — PROP_KEYS iteration order is the blob column order, so inserting in the
  // middle would shift every existing column.
  "installed", "onboarded", "stage", "kind",
  // gap: 2h-1d | 1-3d | 4-7d | 8d+ — how long return_open was away. Appended, as above.
  "gap",
  // track: general-english | welding, on partner_interest. Appended, as above.
  "track",
  // phase 2: n (candidates shown), round (1-4), now ("1"), regular ("1"), state (mutual|regular),
  // level (word|sentence|text|none), mode (watch|shadow|challenge|apply), to (ai|partner)
  "n", "round", "now", "regular", "state", "level", "mode", "to",
  // reason: mic | (why an AI/live path was taken: waiting | nocand | silent | choice | again). Appended, as above.
  "reason"]);

const MAX_VAL = 24;      // props are enums, not sentences
const MAX_BODY = 512;

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

function clean(v){
  return String(v == null ? "" : v).replace(/[^\w.:-]/g, "").slice(0, MAX_VAL);
}

export default {
  async fetch(req, env){
    const origin = req.headers.get("Origin") || "";
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (req.method !== "POST") {
      return new Response("method", { status: 405, headers: cors(origin) });
    }
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response("origin", { status: 403, headers: cors(origin) });
    }

    /* The client uses sendBeacon, which cannot set Content-Type: application/json
       without triggering a CORS preflight it is not allowed to make. So the body
       arrives as text/plain and is parsed here. Do not "fix" this by requiring a
       JSON content type — beacons would silently stop being sent, and because
       sendBeacon reports no errors, nothing would look broken. */
    const raw = (await req.text().catch(() => "")).slice(0, MAX_BODY);
    let b;
    try { b = JSON.parse(raw); } catch (e) { b = null; }
    if (!b || !EVENTS.has(b.name)) {
      // 204 either way: a rejected event must not tell a prober what exists.
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const blobs = [b.name, req.cf && req.cf.country ? req.cf.country : "??"];
    const props = b.props && typeof b.props === "object" ? b.props : {};
    for (const k of PROP_KEYS) blobs.push(props[k] != null ? clean(props[k]) : "");

    try {
      env.AE.writeDataPoint({
        indexes: [b.name],        // the dimension you group by most
        blobs,
        doubles: [1],
      });
    } catch (e) { /* never let analytics break the app */ }

    return new Response(null, { status: 204, headers: cors(origin) });
  },
};
