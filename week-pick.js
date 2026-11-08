/* ============================================================================
   BE Mastery — which model clip a General English learner shadows each week.
   PURE: no DOM, no network, no AI call, no S. Same input -> same output.

   Every learner practises the same SKILL each week (the curriculum's theme). What differs is the
   CLIP, chosen from what the onboarding profile already says. The step that shows it, stores it
   and counts the shadows belongs to the lesson (daily-learning-plan.js, the dlp* block); this file
   only answers "which clip", with a RANKED LIST the caller stores and walks.

   WHY A LIST, AND WHY THE CALLER STORES IT. Re-running this later is not the same as remembering
   the answer: the profile can change between sessions, so the clip could move under a learner
   mid-exercise. Deterministic is not stable over time; only the stored list is. A playback failure
   advances an index into it. Nothing here re-reads the profile after the first call.

   TIERS (the owner's order): 1 same profession · 2 same industry · 3 same situation or goal ·
   4 a general clip. Level decides suitability BEFORE tier: a clear clip from a related role beats
   an exact-role clip the learner cannot comfortably shadow.

   WHAT IS AND IS NOT MEASURED — read before trusting a ranking:
   - PACE is measured, in words per minute, but only where there is a transcript (the bundled
     caption clips). A clip with no transcript has pace null: it is never penalised for it, and it
     is never claimed to be easy.
   - ENGLISH LEVEL comes from the learner's own onboarding answer, not a test. It sets a pace the
     learner is likely to follow. The wpm ceilings are engineering defaults, not CEFR claims.
   - VOCABULARY is NOT measured. It would need a word-frequency list; there is none, so it is not
     used and not implied.
   - ROLE / INDUSTRY / SITUATION tags on a clip are only as good as whoever set them. Tags taken
     from a title are not confirmed by anyone who watched the clip; the pool says so.
   - NOTHING here has watched a video. `editorial` is a field a human sets.
   ============================================================================ */
(function (global) {
  "use strict";

  /* a segment the learner can shadow whole; Week 1 is a spoken introduction, the rest passages */
  var BAND = { 1: [40, 75] }, DEFAULT_BAND = [25, 90];

  /* pace ceilings by onboarding answer (labels are what the catalogue stores — D.CONFIDENCE) and
     how far past a ceiling a clip may be before level outranks tier */
  var CEILING = { "New to speaking English": 135, "Can get by": 150, "Comfortable but not confident": 165,
    "Fluent, want to sound sharper": 999, "Not sure": 999 };
  var UNKNOWN_CEILING = 999, TOLERANCE = 25, TARGET_WPM = 150;

  /* a goal says which SITUATION the learner is preparing for; only goals that name one are mapped */
  var GOAL_SITUATIONS = { ace_interviews: ["interviews"], speak_meetings: ["meetings", "standups"],
    present_confidently: ["presentations"], phone_video_calls: ["calls"],
    customer_clients: ["clients", "customer_service"], sound_executive: ["meetings", "presentations"],
    lead_teams: ["meetings", "standups"] };
  var INTRO_SITUATIONS = ["interviews", "networking", "small_talk", "presentations", "meetings"];

  /* the catalogue's "group" for students, job seekers, retirees and "Other" is not an industry:
     matching on it would pair a university student with every other "career" row */
  var NON_INDUSTRY = { career: 1, home: 1 };
  var OTHER = "other.other";

  function str(x) { return typeof x === "string" ? x : ""; }
  function arr(x) { return Object.prototype.toString.call(x) === "[object Array]" ? x : []; }
  function num(x) { return typeof x === "number" && isFinite(x) ? x : null; }
  function bandFor(week) { return BAND[week] || DEFAULT_BAND; }
  function keyOf(id, start, end) { return id + ":" + Math.round(start * 10) / 10 + "-" + Math.round(end * 10) / 10; }

  /* ---- adapters: three sources, one shape --------------------------------------------------- */

  /* a passage from tracks/general/clip-index.json: bundled captions, exact times, measured pace.
     These ARE the production lesson's clips today, hence editorial "shipping". */
  function fromClipIndex(week, e) {
    if (!e || !e.vid) return null;
    var s = num(e.startMs) !== null ? e.startMs / 1000 : null, t = num(e.endMs) !== null ? e.endMs / 1000 : null;
    var dur = num(e.seconds), words = num(e.words);
    return { key: s !== null && t !== null ? keyOf(e.vid, s, t) : e.vid, id: e.vid, week: week, start: s, end: t, dur: dur,
      source: "clip-index", editorial: "shipping", role: null, roleGroup: null, industries: [], situations: [],
      wpm: dur && words ? Math.round(words / dur * 60) : null, hasText: !!e.text, boundaries: s !== null && t !== null ? "exact" : "none",
      embeddable: true, title: str(e.title) };
  }
  /* an Introductions clip from the Shadow-library overlay: played whole, so there is no excerpt to
     approve, but no transcript either (cap "player" = captions inside YouTube's frame only) */
  function fromIntro(id, v) {
    if (!v) return null;
    return { key: keyOf(id, 0, v.dur), id: id, week: 1, start: 0, end: v.dur, dur: v.dur, source: "intros",
      editorial: str(v.editorial) || "pending", role: str(v.role) && v.role !== OTHER ? v.role : null,
      roleGroup: str(v.roleGroup) || null, industries: [], situations: INTRO_SITUATIONS.slice(), wpm: null, hasText: false,
      boundaries: "whole", embeddable: true, title: str(v.title) };
  }
  /* a row from catalogue/week-clips.json: the owner's review queue */
  function fromQueue(week, r) {
    if (!r) return null;
    var s = num(r.start), t = num(r.end), both = s !== null && t !== null && t > s;
    return { key: both ? keyOf(r.id, s, t) : r.id, id: r.id, week: week, start: s, end: t, dur: both ? t - s : null,
      source: "queue", editorial: str(r.editorial) || "pending", role: str(r.role) || null, roleGroup: str(r.roleGroup) || null,
      industries: arr(r.industries), situations: arr(r.situations), wpm: null, hasText: false,
      boundaries: both ? "claimed" : "none", embeddable: r.embeddable !== false, title: str(r.title) };
  }

  /* ---- readiness: why a clip is or is not usable in the lesson -------------------------------
     INVALID  = can never be used as it stands (bad id, embedding off, rejected, wrong length).
     BLOCKERS = could be used once someone acts (approve it, set its boundaries, bundle its captions).
     A missing TRANSCRIPT is a blocker in every mode and preview does not relax it: the shadow step
     takes its segment, its target text and its scoring from the clip's captions
     (dlpShLive -> svShSeg -> the caption paragraph). A clip without them lets the learner record in
     the studio all day while the lesson never notices a take. That is not a degraded card; it is a
     step that cannot complete. */
  function readiness(c, week, preview) {
    var invalid = [], blockers = [], band = bandFor(week);
    if (!c || !/^[A-Za-z0-9_-]{11}$/.test(str(c.id))) return { invalid: ["not a YouTube video id"], blockers: [] };
    if (c.embeddable === false) invalid.push("embedding is disabled");
    if (c.editorial === "rejected") invalid.push("editorially rejected");
    if (c.dur !== null && (c.dur < band[0] || c.dur > band[1])) invalid.push("length " + Math.round(c.dur) + "s is outside " + band[0] + "-" + band[1] + "s");
    if (c.editorial === "pending" && !preview) blockers.push("editorial review pending");
    if (c.boundaries === "none") blockers.push("no exact start and end");
    else if (c.boundaries === "claimed" && !preview) blockers.push("start and end are an unverified claim");
    if (!c.hasText) blockers.push("no transcript in the app");
    return { invalid: invalid, blockers: blockers };
  }

  /* ---- the ranking -------------------------------------------------------------------------- */
  function usable(p) {
    var roleId = str(p.roleId) === OTHER ? "" : str(p.roleId);
    var cat = roleId ? str(p.roleCat) : "";            /* an "Other" role has no industry to match */
    if (NON_INDUSTRY[cat]) cat = "";
    var sits = arr(p.situations).map(str).filter(Boolean), goal = str(p.goalId);
    var wanted = sits.slice();
    (GOAL_SITUATIONS[goal] || []).forEach(function (s) { if (wanted.indexOf(s) < 0) wanted.push(s); });
    return { roleId: roleId, cat: cat, situations: sits, goal: goal, wanted: wanted, level: str(p.selfLevel) };
  }
  function tierOf(c, u) {
    if (u.roleId && c.role === u.roleId) return 1;
    if (u.cat && (c.roleGroup === u.cat || c.industries.indexOf(u.cat) >= 0)) return 2;
    if (c.situations.some(function (s) { return u.wanted.indexOf(s) >= 0; })) return 3;
    return 4;
  }
  function whyOf(c, u, tier) {
    if (tier === 1) return { tier: 1, match: "profession", field: "roleId", value: u.roleId };
    if (tier === 2) return { tier: 2, match: "industry", field: "roleCat", value: u.cat };
    if (tier === 3) {
      var hit = c.situations.filter(function (s) { return u.situations.indexOf(s) >= 0; })[0];
      if (hit) return { tier: 3, match: "situation", field: "situations", value: hit };
      var viaGoal = c.situations.filter(function (s) { return u.wanted.indexOf(s) >= 0; })[0];
      return { tier: 3, match: "goal", field: "goalId", value: u.goal || viaGoal || "" };
    }
    return { tier: 4, match: "general", field: null, value: null };
  }

  /* choose(profile, week, pool, {preview}) ->
       ranked      clips the lesson can use TODAY, best first. Empty = a gap: keep the existing lesson.
       picked      index into ranked, or -1
       candidates  the same ranking INCLUDING clips that are blocked, each with its blockers[]
       wouldPick   candidates[0]: who would be chosen if the blockers were cleared. This is what an
                   owner reviewing the queue wants to see, and it is never presented as a live pick.
       held        clips that can never be used as they stand, with the reason
     preview=true (staging) relaxes editorial review and unverified boundaries only. It never relaxes
     the transcript. */
  function choose(profile, week, pool, opts) {
    var preview = !!(opts && opts.preview), p = profile && typeof profile === "object" ? profile : {}, u = usable(p);
    var degraded = !u.roleId && !u.cat && !u.situations.length && !u.goal;
    var ceiling = Object.prototype.hasOwnProperty.call(CEILING, u.level) ? CEILING[u.level] : UNKNOWN_CEILING;
    var held = [], rows = [];
    arr(pool).forEach(function (c) {
      if (!c || (c.week !== undefined && c.week !== week)) return;
      var r = readiness(c, week, preview);
      if (r.invalid.length) { held.push({ id: c.id, key: c.key, source: c.source, reasons: r.invalid }); return; }
      var tier = degraded ? 4 : tierOf(c, u), over = c.wpm !== null ? Math.max(0, c.wpm - ceiling) : 0;
      rows.push({ id: c.id, key: c.key, start: c.start, end: c.end, dur: c.dur, tier: tier, why: whyOf(c, u, tier),
        wpm: c.wpm, over: over, tooHard: over > TOLERANCE, source: c.source, editorial: c.editorial,
        blockers: r.blockers, boundaries: c.boundaries, role: c.role, roleGroup: c.roleGroup, title: c.title,
        _gap: c.wpm !== null ? Math.abs(c.wpm - Math.min(TARGET_WPM, ceiling)) : 0, _cap: c.hasText ? 0 : 1 });
    });
    rows.sort(function (a, b) {
      if (a.tooHard !== b.tooHard) return a.tooHard ? 1 : -1;     /* level decides suitability first */
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.over !== b.over) return a.over - b.over;              /* tie-break 1: the gentler pace */
      if (a._gap !== b._gap) return a._gap - b._gap;              /* tie-break 2: nearest a comfortable pace */
      if (a._cap !== b._cap) return a._cap - b._cap;              /* tie-break 3: one with a transcript */
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;          /* last: arbitrary but STABLE */
    });
    rows.forEach(function (r) { delete r._gap; delete r._cap; });
    var ranked = rows.filter(function (r) { return !r.blockers.length; });
    return { week: week, ranked: ranked, picked: ranked.length ? 0 : -1, degraded: degraded, gap: !ranked.length,
      candidates: rows, wouldPick: rows.length ? rows[0] : null, held: held };
  }

  /* Week 12 compares a fresh introduction with the ORIGINAL baseline, so it must replay the exact
     clip and segment Week 1 assigned. If that clip is no longer available the original is still
     returned, untouched, and anything shown instead is labelled as a different clip — never passed
     off as the one the learner recorded against. */
  function reuseWeek1(assignment, pool, profile, opts) {
    var a = assignment && typeof assignment === "object" ? assignment : null;
    if (!a || !str(a.id) || num(a.start) === null || num(a.end) === null)
      return { week: 12, same: false, original: null, substitute: null, label: "no baseline was assigned" };
    var original = { id: a.id, start: a.start, end: a.end, key: keyOf(a.id, a.start, a.end) };
    var here = arr(pool).filter(function (c) { return c && c.id === a.id && c.start === a.start && c.end === a.end; })[0];
    if (here && here.embeddable !== false) return { week: 12, same: true, original: original, substitute: null, clip: original, label: "the same clip as Week 1" };
    var alt = choose(profile, 1, pool, opts);
    return { week: 12, same: false, original: original, substitute: alt.picked >= 0 ? alt.ranked[alt.picked] : null,
      label: "a DIFFERENT clip from your Week 1 baseline — the original is no longer available" };
  }

  global.WeekPick = { choose: choose, reuseWeek1: reuseWeek1, readiness: readiness, tierOf: tierOf, usable: usable,
    fromClipIndex: fromClipIndex, fromIntro: fromIntro, fromQueue: fromQueue, keyOf: keyOf,
    BAND: BAND, DEFAULT_BAND: DEFAULT_BAND, CEILING: CEILING, TOLERANCE: TOLERANCE,
    GOAL_SITUATIONS: GOAL_SITUATIONS, INTRO_SITUATIONS: INTRO_SITUATIONS, NON_INDUSTRY: NON_INDUSTRY };
})(typeof globalThis !== "undefined" ? globalThis : this);
