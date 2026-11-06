/* ============================================================================
   BE Mastery — DailyLearningPlan (Phase 2, General English only)
   --------------------------------------------------------------------------
   A deterministic, versioned contract for ONE guided curriculum session
   (TRY/LEARN/LISTEN/REHEARSE/CONVERSE/IMPROVE/FINISH). Pure logic, no DOM —
   the same pattern as shadow-sync.js / adaptive-learning-engine.js, so it is
   unit-testable with `node tests/daily-learning-plan.test.mjs` and reusable
   from index.html via window.DailyPlan.

   The plan does NOT create curriculum content: competencyObjective and
   assessmentCriteria come only from the curriculum pack (weeks.json /
   missions.json / phrases.json) and are never personalized. Scenario,
   expressions shown and scaffolding MAY be personalized by the caller before
   render — this module only guarantees the non-personalizable fields stay
   fixed and validates that a plan handed back to it hasn't drifted from them.

   Persistence lives in S.dlp, a plain object keyed by lessonId — NOT by
   calendar date, so:
   - a lesson is tied to a curriculum session (trackId:w<N><Day>), so it
     resumes across calendar days (load() never expires an entry by date);
   - two different lessons completed on the same day are two different
     keys, so neither can overwrite the other;
   - start() is idempotent: once a lessonId has an IN-PROGRESS entry, calling
     start() again returns that same entry (same profileSnapshot, same
     plan) rather than rebuilding from whatever the live profile says now —
     a profile edit mid-lesson must never silently rewrite it. Only a
     lessonId with NO entry, or one already completed, builds fresh.
   No raw transcript/audio lives here — the existing session report
   (S.notes["exrep:"+key]) is still the single place that data is kept, with
   its own existing sync-stripping; this module only tracks step position
   and lightweight evidence counts. */
(function (global) {
  const STEPS = ["try", "learn", "listen", "rehearse", "converse", "improve", "finish"];
  const SCHEMA_VERSION = "1";

  function lessonId(trackId, w, d) { return `${trackId}:w${w}${d}`; }

  /* USER-DECLARED selfLevel alone must never produce a "verified" narrow
     range — only real speaking evidence (profile.baseline, an onboarding or
     later speaking attempt score) narrows it. This is the one function that
     stands between a self-report and a false claim of assessment. */
  function proficiencyRange(profile) {
    profile = profile || {};
    const WIDE = ["A1", "C2"];
    const BY_LEVEL = { "New to speaking English": ["A1", "A2"], "Can get by": ["A2", "B1"], "Comfortable but not confident": ["B1", "B2"], "Fluent, want to sound sharper": ["B2", "C1"], "Not sure": WIDE, "": WIDE };
    const fromLevel = BY_LEVEL[profile.selfLevel] || WIDE;
    const hasEvidence = typeof profile.baseline === "number" && profile.baseline > 0;
    if (!hasEvidence) return { range: WIDE, confidence: "low", basis: profile.selfLevel ? "self-declared only, not yet evidenced" : "none" };
    /* real baseline evidence can narrow toward the self-declared band, never past it alone */
    const narrowed = profile.baseline >= 70 ? [fromLevel[0], fromLevel[1]] : WIDE;
    return { range: narrowed, confidence: profile.baseline >= 70 ? "medium" : "low", basis: "selfLevel + baseline attempt" };
  }

  /* The one non-personalizable core of a plan, derived only from the
     curriculum pack. AI/personalization callers must never overwrite these
     three fields — validate() checks a plan still matches them. */
  function canonicalCore(pack, w, d) {
    const weeks = (pack && pack.weeks) || [];
    const wk = weeks[w - 1];
    const dd = wk && wk.days && wk.days[d];
    if (!dd) return null;
    const mission = ((pack && pack.missions && pack.missions.competencies) || []).find(c => c.week === w) || null;
    return {
      competencyObjective: String(dd.focus || ""),
      assessmentCriteria: ["recordingExists", "usesAtLeast1TargetExpression", "taskTypeMatchesTranscript"],
      curriculumVersion: SCHEMA_VERSION,
      _task: String(dd.task || ""), _out: String(dd.out || ""),
      _missionPattern: mission ? mission.pattern : null, _missionObjective: mission ? mission.objective : null
    };
  }

  /* Builds a fresh plan. Never called directly by start() when an
     in-progress entry already exists (see start()). */
  function build(opts) {
    const { trackId, w, d, pack, profile, phrases, video } = opts || {};
    const core = canonicalCore(pack, w, d);
    if (!core) return null;
    const prof = proficiencyRange(profile);
    const id = lessonId(trackId, w, d);
    return {
      curriculumVersion: core.curriculumVersion,
      learnerProfileVersion: SCHEMA_VERSION,
      lessonId: id,
      week: w, day: d,
      competencyObjective: core.competencyObjective,
      learnerContext: { selfLevel: (profile && profile.selfLevel) || "", role: (profile && profile.role) || "", proficiency: prof },
      personalizedScenario: { task: core._task, missionPattern: core._missionPattern, missionObjective: core._missionObjective },
      targetExpressions: (phrases || []).slice(0, 5).map(p => String(p.p || p)),
      pronunciationFocus: { source: "observed from the learner's own take, not prescribed in advance" },
      speakingTask: { kind: "shadow-then-own-intro", minSeconds: 15, maxSeconds: 90 },
      assessmentCriteria: core.assessmentCriteria,
      supportingVideo: video || null,
      vocabularyReview: { phrases: (phrases || []).slice(0, 5).map(p => String(p.p || p)) },
      evidenceStatus: "not_assessed",
      nextAction: null,
      generatedAt: Date.now(),
      planVersion: SCHEMA_VERSION,
      staticFallback: { competencyObjective: core.competencyObjective, task: core._task, out: core._out, expressions: (phrases || []).slice(0, 5).map(p => String(p.p || p)) }
    };
  }

  function validate(plan) {
    const errors = [];
    if (!plan || typeof plan !== "object") return { valid: false, errors: ["plan is not an object"] };
    ["curriculumVersion", "learnerProfileVersion", "lessonId", "competencyObjective", "assessmentCriteria", "staticFallback"].forEach(k => { if (plan[k] === undefined || plan[k] === null) errors.push("missing " + k); });
    if (plan.assessmentCriteria && !Array.isArray(plan.assessmentCriteria)) errors.push("assessmentCriteria must be an array");
    if (!plan.staticFallback || !plan.staticFallback.competencyObjective) errors.push("staticFallback must carry its own competencyObjective — never AI-only");
    return { valid: errors.length === 0, errors };
  }

  /* Re-checks a plan against the curriculum's own canonical core — catches a
     personalization step that drifted the objective or criteria, which must
     never happen regardless of what AI content was layered on top. */
  function validateAgainstCurriculum(plan, pack) {
    const core = canonicalCore(pack, plan.week, plan.day);
    if (!core) return { valid: false, errors: ["no matching curriculum day"] };
    const errors = [];
    if (plan.competencyObjective !== core.competencyObjective) errors.push("competencyObjective drifted from the curriculum");
    if (JSON.stringify(plan.assessmentCriteria) !== JSON.stringify(core.assessmentCriteria)) errors.push("assessmentCriteria drifted from the curriculum");
    return { valid: errors.length === 0, errors };
  }

  /* Picks a supporting video from the REAL Shadow Studio starters catalogue —
     never invents a clip or a reason. The catalogue is 19 commencement/TED
     speeches; none is literally "a professional introducing themselves"
     (verified against tracks/general/shadow.json — the same honest gap
     missions.json's own week-1 competency hit, which is why that file omits
     a shadow block entirely rather than force a link). This phase needs a
     LISTEN clip, so it picks the closest professional-register match by real
     keyword overlap in the catalogue's own name/why text, and the match
     reason shown to the learner must say "closest match", never claim the
     clip literally is a self-introduction. Returns null — never a fabricated
     pick — if nothing in the catalogue matches at all. */
  function pickSupportingVideo(starters, keywords) {
    starters = starters || []; keywords = keywords || [];
    let best = null, bestScore = 0;
    starters.forEach(s => {
      const hay = (String(s.name || "") + " " + String(s.why || "")).toLowerCase();
      const score = keywords.reduce((n, k) => n + (hay.includes(k.toLowerCase()) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = s; }
    });
    if (!best) return null;
    return { id: best.vid, title: best.name, matchReason: "closest professional-register match in the library — " + best.why };
  }

  function load(S, id) { return (S.dlp && S.dlp[id]) || null; }

  /* Idempotent: an in-progress (not yet completed) entry is returned
     UNCHANGED — a live profile edit must not silently rewrite it. Only
     "no entry yet" or "previous attempt already completed" builds fresh. */
  function start(S, buildOpts) {
    S.dlp = S.dlp || {};
    const id = lessonId(buildOpts.trackId, buildOpts.w, buildOpts.day || buildOpts.d);
    const existing = S.dlp[id];
    if (existing && !existing.completedAt) return existing;
    const plan = build({ ...buildOpts, d: buildOpts.day || buildOpts.d });
    if (!plan) return null;
    const entry = {
      lessonId: id, plan, step: "try", stepData: {},
      profileSnapshot: { selfLevel: plan.learnerContext.selfLevel, role: plan.learnerContext.role },
      startedAt: Date.now(), completedAt: null,
      attempt: existing ? (existing.attempt || 1) + 1 : 1
    };
    S.dlp[id] = entry;
    return entry;
  }

  function setStep(S, id, step, data) {
    const e = load(S, id); if (!e) return null;
    if (data !== undefined) e.stepData[step] = data;
    const i = STEPS.indexOf(step);
    const next = STEPS[i + 1];
    if (next) e.step = next;
    return e;
  }

  function complete(S, id) {
    const e = load(S, id); if (!e) return null;
    e.completedAt = Date.now();
    e.step = "finish";
    return e;
  }

  /* How many of this lesson's attempts are actually DONE — counting the
     current one once it's completed (entry.completedAt set), never before.
     A still-in-progress attempt (started a retry, not finished) counts only
     the completed cycles before it — it is not evidence yet. */
  function completedAttempts(entry) {
    if (!entry) return 0;
    return entry.completedAt ? (entry.attempt || 1) : Math.max(0, (entry.attempt || 1) - 1);
  }

  /* Four states, built only from real evidence counts — never an invented
     weakness, never a claim of improvement from one unsupported score. */
  function evidenceStatus(attempts) {
    const n = attempts || 0;
    if (n <= 0) return "not_assessed";
    if (n === 1) return "initial";
    if (n === 2) return "developing";
    return "established";
  }

  const api = { STEPS, SCHEMA_VERSION, lessonId, proficiencyRange, canonicalCore, build, validate, validateAgainstCurriculum, pickSupportingVideo, load, start, setStep, complete, completedAttempts, evidenceStatus };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.DailyPlan = api;
})(typeof window !== "undefined" ? window : globalThis);
