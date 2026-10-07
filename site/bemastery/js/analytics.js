/* ───────────────────────────────────────────────────────────────────────────
   Marketing-site analytics. Same architecture as the app: anonymous counts
   posted to our own Cloudflare Worker (backend/events), no vendor, no cookie,
   no device id. Counts, never people.

   THREE THINGS THE WORKER ENFORCES — all three must be true or an event is
   dropped with a silent 204:
   1. The event NAME is on the Worker's EVENTS allow-list.
   2. Every PROP KEY is on its PROP_KEYS allow-list. This file therefore sends
      only "source" and "kind", which are already on it.
   3. The page ORIGIN is on its ALLOWED_ORIGINS list.
   The nine names below and the two lomonec.com origins were added to
   backend/events/events-worker.js in the same change as this file. THE WORKER
   MUST BE REDEPLOYED before any of it records anything — until then every call
   here is a well-formed no-op, which is the safe direction.

   sendBeacon + a text/plain Blob is deliberate, copied from the app: a beacon
   cannot set a JSON content type without a CORS preflight it is not allowed to
   make, and it reports no errors, so "fixing" the type would silently stop
   every event. The Worker parses text/plain on purpose.
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var API = "https://be-events.nore-ngou.workers.dev/e";
  /* a local check should not write into the production dataset */
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
              location.protocol === "file:";
  try {                                   // same override key the app uses
    var o = localStorage.getItem("be_events_api");
    if (o !== null) API = o;
  } catch (e) {}

  function track(name, props) {
    try {
      if (!API || LOCAL) return;
      var body = JSON.stringify({ name: name, props: props || null });
      if (navigator.sendBeacon) navigator.sendBeacon(API, new Blob([body], { type: "text/plain" }));
      else fetch(API, { method: "POST", body: body, keepalive: true }).catch(function () {});
    } catch (e) {}                        // analytics must never break the page
  }

  /* ── one visit per page load ─────────────────────────────────────────── */
  track("website_visit");

  /* ── clicks: anything carrying data-ev, with data-ev-source / data-ev-kind
        as its two (allow-listed) props ─────────────────────────────────── */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-ev]");
    if (!el) return;
    var p = {};
    if (el.dataset.evSource) p.source = el.dataset.evSource;
    if (el.dataset.evKind)   p.kind   = el.dataset.evKind;
    track(el.dataset.ev, Object.keys(p).length ? p : null);
  }, true);

  /* ── section views: fired once, when a section is properly on screen ─── */
  var SEEN = {
    "#pricing":  "pricing_viewed",
    "#partner":  "practice_partner_viewed",
    "#shadow":   "shadow_viewed",
    "#download": "download_section_viewed"
  };
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var name = SEEN["#" + en.target.id];
        if (name) track(name);
        io.unobserve(en.target);          // once per page load, not per scroll
      });
    }, { threshold: 0.4 });
    Object.keys(SEEN).forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) io.observe(el);
    });
  }

  window.BEMTrack = track;                // available to app.js if it needs it
})();
