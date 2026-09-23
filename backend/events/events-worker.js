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
  "capacitor://localhost",   // the App Store build (mobile/ios)
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
  // partner management: leaving today's session vs ending the partnership
  "partner_left", "partner_connection_ended", "partner_trial_invited",
  // discovery: the floating button, the presence strip, leaving the queue, declining a proposal
  "partner_find_started", "partner_availability_viewed", "partner_queue_left", "partner_trial_declined",
  // a block lifted by the person who placed it; the learner cleared their own history
  "partner_unblocked", "partner_history_cleared",
  // Shadow Studio V2 (General English only)
  "shadow_v2_opened", "shadow_v2_mode", "shadow_v2_sentence_shadowed", "shadow_v2_challenge_started", "shadow_apply_phrase",
  // Shadow Studio Challenge (General English only): opened (the tab), started (+level), recorded,
  // feedback_received (+level, result pass|retry — every graded take), completed (+level — a pass),
  // retry, "use it yourself" (+result used|missed)
  "shadow_challenge_opened", "shadow_challenge_started", "shadow_challenge_recorded", "shadow_challenge_feedback_received",
  "shadow_challenge_completed", "shadow_challenge_retry", "shadow_challenge_apply_it",
  // The Challenge ladder (General English only): which rung the learner is on
  // (+rung, +reason open|up|down|again|faster|slower|past|done) and a drill
  // opened out of a miss (+kind chorus|buildup). Counts only — the rung name
  // is a fixed enum, never the clip, the line or anything spoken.
  "shadow_challenge_rung", "shadow_challenge_drill",
  // Round Review (Practice Partner, General English only): a review landed
  // (+evidence audio|asr|none), the voice coach was played, a pronunciation or
  // sentence practice attempt was graded (+result pass|retry), an item was
  // saved to vocabulary, the conversation booster game was played. Counts only.
  "partner_review_ready", "partner_review_coach", "partner_review_practice", "partner_review_saved", "partner_review_game",
  // BE Mastery V2 competency missions (General English only, Week 3 slice).
  // Every one of these carries track + week + competency, because the audit
  // found the older learning events could not be split by programme at all and
  // the dataset cannot be backfilled. Counts and fixed enums only: `move` is
  // one of the four communication-move ids, `state` is a competency state,
  // `result` is pass|fail or the recommended action. Nothing spoken, nothing
  // transcribed and nothing from the profile ever rides on these.
  "v2_mission_started", "v2_mission_heard", "v2_speak_attempt", "v2_coach_generated",
  "v2_retry_attempt", "v2_transfer_started", "v2_transfer_completed",
  "v2_evidence_recorded", "v2_competency_progressed", "v2_retrieval_scheduled",
  "v2_recommendation_generated",
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
  "reason",
  // evidence: audio | asr | none — how much the Round Review could say about pronunciation. Appended, as above.
  "evidence",
  // rung: gate | sync | recall | blind | retell — which step of the Challenge
  // ladder an event belongs to. Appended, as above: PROP_KEYS iteration order
  // is the blob column order, so this must stay last.
  "rung",
  // V2 missions: competency (clear-update), mission (its id), move (status |
  // issue | impact | next | none), attempt (a count), ai (1|0 — whether the
  // written coaching came from the model or the device). Appended last, as
  // every addition to this list must be. `state`, `week`, `track`, `kind`,
  // `result`, `band` and `n` are reused from above rather than duplicated.
  "competency", "mission", "move", "attempt", "ai", "from"]);

const MAX_VAL = 24;      // props are enums, not sentences
const MAX_BODY = 512;

/* ROW LAYOUT — Analytics Engine takes at most 20 blobs per data point
   (workerd analytics-engine.h: "20 text fields (blobs)"; docs → limits).
   blob1 is the name and blob2 the country, so a row has room for 18 prop
   columns. PROP_KEYS is an allow-list of what may be READ from a beacon; it
   stopped being a safe row layout the moment it passed 18 keys (a420846,
   18 Sept 2026). From the 19 Sept 22:46 UTC deploy every write carried 25+
   blobs and was refused — the catch below swallows the error and the client
   gets its 204, so nothing looked wrong and the dataset simply went quiet
   (last row 2026-09-19, found 22 Sept while preparing the V2 deploy).

   LEGACY is the first 18 keys in their original order: exactly the columns
   blob3..blob20 that ever existed, so every query in README.md and query.sh
   keeps meaning what it meant. Keys after `now` were never readable (there
   is no blob21) and are dropped for legacy events, as they always were.

   An event family may declare its own map. Every query filters on blob1
   first, so a column can carry different keys for different names; each map
   is written down in README.md. V2 missions are the first family: the
   questions they exist to answer — which competency, which move, which
   state — need columns the legacy row never had room for. */
const AE_MAX_BLOBS = 20;
const MAX_COLS = AE_MAX_BLOBS - 2;                 // blob1 is the name, blob2 the country
const LEGACY = [...PROP_KEYS].slice(0, MAX_COLS);
const LAYOUTS = [
  // v2_* → blob3 track, 4 week, 5 competency, 6 mission, 7 kind, 8 move,
  // 9 result, 10 band, 11 state, 12 from, 13 attempt, 14 ai
  [/^v2_/, ["track", "week", "competency", "mission", "kind", "move", "result", "band", "state", "from", "attempt", "ai"]],
  // partner_* → blob3 kind, 4 round, 5 n, 6 now, 7 regular, 8 state, 9 reason,
  // 10 evidence, 11 result, 12 day. Not partner_interest: that is a legacy-era
  // event ./query.sh partner reads at blob14 (stage) and blob17 (track).
  // No partner row was ever recorded before this map existed (the names
  // arrived 18 Sept 2026, the day the row went over the limit), so nothing
  // historical is re-read through it.
  [/^partner_(?!interest$)/, ["kind", "round", "n", "now", "regular", "state", "reason", "evidence", "result", "day"]],
  // shadow_* → blob3 level, 4 mode, 5 to, 6 rung, 7 reason, 8 result, 9 kind.
  // Same history: no shadow row was ever recorded.
  [/^shadow_/, ["level", "mode", "to", "rung", "reason", "result", "kind"]],
];
/* The invariant lives where the row is built, not only in a test: whatever a
   future edit declares, a layout can never put more than MAX_COLS keys into a
   row. test/run.mjs asserts that no layout actually needs the cut, so this
   slice is a guard, never a behaviour. */
function layoutFor(name){
  const m = LAYOUTS.find(([re]) => re.test(name));
  return (m ? m[1] : LEGACY).slice(0, MAX_COLS);
}
/* Named exports for test/run.mjs only; the runtime reads the default export. */
export { AE_MAX_BLOBS, MAX_COLS, LEGACY, LAYOUTS, layoutFor };

function cors(origin, extra = []){
  const ok = ALLOWED_ORIGINS.includes(origin) || extra.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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
    const extra = String(env.EXTRA_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin, extra) });
    }
    if (req.method !== "POST") {
      return new Response("method", { status: 405, headers: cors(origin, extra) });
    }
    /* EXTRA_ORIGINS is set only on the staging environment (wrangler.toml
       [env.staging]); production has no such var, so nothing changes there */
    if (!ALLOWED_ORIGINS.includes(origin) && !extra.includes(origin)) {
      return new Response("origin", { status: 403, headers: cors(origin, extra) });
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
      return new Response(null, { status: 204, headers: cors(origin, extra) });
    }

    const blobs = [b.name, req.cf && req.cf.country ? req.cf.country : "??"];
    const props = b.props && typeof b.props === "object" ? b.props : {};
    for (const k of layoutFor(b.name)) blobs.push(props[k] != null ? clean(props[k]) : "");

    try {
      env.AE.writeDataPoint({
        indexes: [b.name],        // the dimension you group by most
        blobs,
        doubles: [1],
      });
    } catch (e) {
      /* Never let analytics break the app — the client keeps its 204. But say
         so where an operator can see it: `wrangler tail` live, and Workers Logs
         if observability is switched on. The 19–22 Sept 2026 outage was
         invisible precisely because this block was silent. Nothing from the
         beacon is logged: the name is allow-listed, the message is workerd's. */
      console.error("be-events: writeDataPoint failed for", b.name, "-", e && e.name, e && e.message, "- blobs:", blobs.length);
    }

    return new Response(null, { status: 204, headers: cors(origin, extra) });
  },
};
