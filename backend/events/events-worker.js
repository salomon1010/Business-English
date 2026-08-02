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
]);

// Prop keys that may accompany an event. Same reasoning as above.
const PROP_KEYS = new Set(["streak", "week", "day", "source", "lang", "result"]);

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
