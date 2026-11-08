/* ============================================================================
   BE Mastery — Week 1 Pronunciation Baseline: which model introduction to show.
   PURE. No DOM, no network, no AI call, no S. Same input -> same output, always.

   The step owns when the clip is revealed, how it persists and the shadow count
   (daily-learning-plan.js + the dlp* block). This file only answers "which clip",
   and it answers with a RANKED LIST, because the caller stores the list and walks
   it on a playback failure. Re-running selection later is NOT equivalent: the
   learner's profile can change between sessions, and the clip must not move under
   someone mid-exercise. Deterministic is not the same as stable; only the stored
   list is stable.

   WHAT THIS DOES NOT MEASURE, and must not pretend to:
   - speaking pace and vocabulary. The owner asked for them as tie-breakers. Both
     need the transcript, and we are not authorised to export captions from these
     videos, so there is no honest way to compute either. Ties fall through to
     caption availability and then to the video id, which is arbitrary but STABLE.
   - whether the clip really contains a 45-60s first-person introduction. That is
     editorial review of a video, which no code here has watched. Clips carry
     `editorial:"pending"` until a human says otherwise, and `lessonEligible` means
     only that the machine-checkable parts hold.
   ============================================================================ */
(function (global) {
  "use strict";

  /* The lesson wants a clip the learner can shadow whole. A clip inside this band
     needs no excerpt, so start/end are the whole video and nobody has to approve a
     timestamp. Anything longer needs an APPROVED start/end that only a human can
     give, so it stays out of the lesson and lives in the Shadow library instead. */
  var MIN_S = 40, MAX_S = 75, IDEAL_S = 55;

  /* Situations and goals for which "introduce yourself" is the thing being practised.
     Ids are from onboarding-catalog.js D.SITUATIONS / D.GOALS — not invented. */
  var INTRO_SITUATIONS = ["interviews", "networking", "small_talk", "presentations", "meetings"];
  var INTRO_GOALS = ["ace_interviews", "career_growth", "present_confidently", "speak_meetings", "sound_executive"];

  function str(x) { return typeof x === "string" ? x : ""; }
  function arr(x) { return Object.prototype.toString.call(x) === "[object Array]" ? x : []; }

  /* A clip is a lesson candidate only on facts a machine can check. */
  function eligible(c) {
    return !!c && typeof c.id === "string" && /^[A-Za-z0-9_-]{11}$/.test(c.id)
      && c.embeddable !== false
      && typeof c.dur === "number" && c.dur >= MIN_S && c.dur <= MAX_S;
  }

  /* Tier 1..4, exactly the owner's order. Lower is better. */
  function tierOf(clip, p) {
    var roleId = str(p.roleId), roleCat = str(p.roleCat);
    if (roleId && clip.role === roleId) return 1;                       /* same profession */
    /* "Same industry" compares the catalogue GROUP, never roleId's prefix: the prefix
       and the group disagree for real rows (eng.civil_eng is in `trades`,
       tech.product_manager is in `mgmt`, energy.process_operator is in `agri`). */
    if (roleCat && clip.roleGroup === roleCat) return 2;
    var sits = arr(p.situations).map(str), goal = str(p.goalId);
    var wants = sits.some(function (s) { return INTRO_SITUATIONS.indexOf(s) >= 0; })
      || (goal && INTRO_GOALS.indexOf(goal) >= 0);
    if (wants) return 3;                                                /* same situation or goal */
    return 4;                                                           /* verified general introduction */
  }

  function whyOf(clip, p, tier) {
    if (tier === 1) return { tier: 1, match: "profession", field: "roleId", value: str(p.roleId) };
    if (tier === 2) return { tier: 2, match: "industry", field: "roleCat", value: str(p.roleCat) };
    if (tier === 3) {
      var sits = arr(p.situations).map(str);
      var hit = sits.filter(function (s) { return INTRO_SITUATIONS.indexOf(s) >= 0; })[0];
      if (hit) return { tier: 3, match: "situation", field: "situations", value: hit };
      return { tier: 3, match: "goal", field: "goalId", value: str(p.goalId) };
    }
    return { tier: 4, match: "general", field: null, value: null };
  }

  /* Caption availability is a WEAK proxy and is used only to break a tie: a clip whose
     player can show English is easier to shadow than one that cannot. It says nothing
     about accuracy — nothing here has read a caption. */
  function capRank(c) { return c === "human" ? 0 : c === "auto" ? 1 : 2; }

  function choose(profile, clips) {
    var p = profile && typeof profile === "object" ? profile : {};
    var pool = arr(clips).filter(eligible);
    if (!pool.length) return { ranked: [], picked: -1, degraded: true, reason: "no eligible clip" };

    /* A degraded profile (onboarding V2 off, or nothing answered) has no roleId and no
       roleCat. It must land on the general tier rather than compare undefined to
       undefined and rank on noise. */
    var degraded = !str(p.roleId) && !str(p.roleCat) && !arr(p.situations).length && !str(p.goalId);

    var scored = pool.map(function (c) {
      var tier = degraded ? 4 : tierOf(c, p);
      return {
        id: c.id, start: 0, end: c.dur, dur: c.dur, tier: tier, why: whyOf(c, p, tier),
        role: c.role || null, roleGroup: c.roleGroup || null,
        editorial: c.editorial || "pending",
        _cap: capRank(c.caps), _near: Math.abs(c.dur - IDEAL_S)
      };
    });
    scored.sort(function (a, b) {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a._cap !== b._cap) return a._cap - b._cap;      /* tie-break 1: player can show English */
      if (a._near !== b._near) return a._near - b._near;  /* tie-break 2: closest to the 55s target */
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;      /* tie-break 3: arbitrary but STABLE */
    });
    scored.forEach(function (s) { delete s._cap; delete s._near; });
    return { ranked: scored, picked: 0, degraded: degraded, reason: "" };
  }

  global.IntroPick = { choose: choose, eligible: eligible, MIN_S: MIN_S, MAX_S: MAX_S, IDEAL_S: IDEAL_S,
    INTRO_SITUATIONS: INTRO_SITUATIONS, INTRO_GOALS: INTRO_GOALS };
})(typeof globalThis !== "undefined" ? globalThis : this);
