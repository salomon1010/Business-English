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

  /* Closed, deterministic scenario/vocabulary maps — NOT an AI call. Same
     principle as the rest of this module: bounded personalization from a
     fixed, reviewable table, never open-ended generation. An unrecognised
     situation/role simply yields no match and the curriculum's own generic
     task/phrase order is used untouched (see staticFallback in build()). */
  const SCENARIO_BY_SITUATION = {
    meetings: { frame: "Introduce yourself at the start of a team meeting, the way you actually would at work.", keywords: ["meeting", "team", "standup", "corporate", "business"] },
    presentations: { frame: "Introduce yourself and your role before you present to a group.", keywords: ["presentation", "leadership", "conference", "keynote", "pitch"] },
    interviews: { frame: "Introduce yourself the way you would at the start of a job interview.", keywords: ["interview", "career", "hiring", "job"] },
    everyday: { frame: "Introduce yourself to someone you're meeting for the first time today.", keywords: ["everyday", "conversation", "casual", "customer"] },
    skills: { frame: "Introduce yourself and one skill you bring to your work.", keywords: ["skills", "learning", "growth"] },
    /* Onboarding V2 situations (flag onboarding_v2_enabled): one frame each, same closed-table rule */
    standups: { frame: "Introduce yourself and say what you are working on this week, as you would in a team stand-up.", keywords: ["standup", "update", "team", "agile"] },
    calls: { frame: "Introduce yourself at the start of a phone or video call.", keywords: ["call", "phone", "video", "remote"] },
    clients: { frame: "Introduce yourself and your role to a new client.", keywords: ["client", "customer", "account", "service"] },
    customer_service: { frame: "Introduce yourself and offer your help, the way you would greet a customer.", keywords: ["customer", "service", "help", "support"] },
    negotiation: { frame: "Introduce yourself and your role at the start of a negotiation.", keywords: ["negotiation", "deal", "persuasion", "influence"] },
    workplace_safety: { frame: "Introduce yourself and your role to a new team on site, clearly and calmly.", keywords: ["safety", "instructions", "operations", "site"] },
    networking: { frame: "Introduce yourself to someone you have just met at a professional event.", keywords: ["networking", "career", "leadership", "connection"] },
    small_talk: { frame: "Introduce yourself to a colleague over a coffee.", keywords: ["casual", "conversation", "everyday"] },
    socialising: { frame: "Introduce yourself to someone at a social gathering.", keywords: ["conversation", "friends", "casual"] },
    travel: { frame: "Introduce yourself and say what you do, as you would when travelling.", keywords: ["travel", "journey", "adventure"] },
    healthcare_visits: { frame: "Introduce yourself clearly at a doctor's office or a public-service desk.", keywords: ["health", "service", "conversation"] }
  };
  const ROLE_VOCAB_HINT = {
    "Engineering / Data": ["deadline", "deploy", "pipeline", "data", "system"],
    "Product / PM": ["roadmap", "stakeholder", "priority", "launch", "timeline"],
    "Finance / Business": ["budget", "forecast", "revenue", "report"],
    "Sales / Marketing": ["client", "pitch", "campaign", "target"],
    "Student": ["course", "assignment", "exam", "study"]
  };
  /* Profession GROUP (roleCat) hints: used with the legacy role hints above, never instead of the curriculum's own order */
  const ROLE_CAT_HINT = {
    tech: ["data", "system", "deploy", "product", "code"], mgmt: ["roadmap", "stakeholder", "priority", "timeline", "team"], bizfin: ["budget", "forecast", "revenue", "report"],
    sales: ["client", "pitch", "campaign", "target"], eng: ["process", "quality", "safety", "design"], trades: ["site", "tools", "safety", "team"],
    health: ["patient", "care", "team"], edu: ["students", "course", "study"], logistics: ["delivery", "schedule", "supply"], hosp: ["guest", "service", "team"],
    beauty: ["client", "service"], retail: ["customer", "store"], legalgov: ["policy", "public", "case"], media: ["audience", "creative", "story"],
    agri: ["field", "environment", "energy"], home: ["family", "community"], career: ["career", "skills", "goal"]
  };
  const VOCAB_HINT = { work_vocab: ["work", "team", "project"], meeting_phrases: ["meeting", "agree", "update"], phone_phrases: ["call", "phone"], formal_phrases: ["formal", "polite", "professional"],
    softening_language: ["polite", "diplomatic"], small_talk_phrases: ["casual", "conversation"], academic_words: ["study", "research"], numbers_data: ["data", "figures", "report"] };
  function roleHintsFor(profile) { return ((profile && ROLE_VOCAB_HINT[profile.role]) || []).concat((profile && ROLE_CAT_HINT[profile.roleCat]) || []); }
  function vocabHintsFor(profile) { return ((profile && profile.vocabGoals) || []).reduce((a, g) => a.concat(VOCAB_HINT[g] || []), []); }
  /* 3-5 useful expressions per lesson, sized by the time the learner says they have; unset or "it varies" keeps the five this module always used */
  const EXPR_BY_MINUTES = { m5: 3, m10: 3, m15: 4, m20: 4, m25: 5, m30: 5, m45: 5, m60: 5, flexible: 5 };
  function expressionCount(profile) { return EXPR_BY_MINUTES[profile && profile.dailyMinutes] || 5; }
  /* Pronunciation priorities the learner DECLARED. This is a preference, not a finding: the corrections still come only from the learner's own take. */
  const PRON_PRIORITIES = ["pronunciation", "word_stress_rhythm", "intonation", "accent"];
  function declaredPronunciation(profile) { return ((profile && profile.priorities) || []).filter(p => PRON_PRIORITIES.includes(p)).slice(0, 3); }
  /* The learner's first listed situation that this module recognises wins —
     situations is a short, intentionally-ordered list (see obSituationToggle),
     not a bag, so "first match" respects the order the learner picked in. */
  function scenarioFor(profile) {
    const situations = (profile && profile.situations) || [];
    const key = situations.find(s => SCENARIO_BY_SITUATION[s]);
    return key ? SCENARIO_BY_SITUATION[key] : null;
  }
  /* Scaffolding, not assessment: sizes the TASK (how long/complex a turn is
     invited to be) directly from the learner's own self-declared confidence —
     a legitimate, everyday use of self-report, same as any app asking "how
     comfortable are you?" before picking a starting difficulty. This is
     deliberately a DIFFERENT question from proficiencyRange() above, which
     protects a separate claim (a VERIFIED CEFR band) from ever resting on
     self-report alone. Scaffolding size is not a skill claim, so it is free
     to use selfLevel directly; an unset/"Not sure" level gets a wide,
     unconstrained default rather than assuming the easiest case. */
  function difficultyFor(profile) {
    const level = (profile && profile.selfLevel) || "";
    if (level === "New to speaking English") return { minSeconds: 12, maxSeconds: 40, complexity: "short, simple sentences" };
    if (level === "Can get by") return { minSeconds: 14, maxSeconds: 50, complexity: "short sentences with a little detail" };
    if (level === "Comfortable but not confident") return { minSeconds: 15, maxSeconds: 60, complexity: "a few connected sentences" };
    if (level === "Fluent, want to sound sharper") return { minSeconds: 20, maxSeconds: 90, complexity: "a fuller, more nuanced answer" };
    return { minSeconds: 15, maxSeconds: 90, complexity: "whatever length feels natural" };
  }
  /* Role + situation keywords rank the SAME curriculum phrase pool — never a
     different pool per learner — so two learners on the same week/day always
     choose from identical source material, just in a different order. Stable
     sort: ties keep the curriculum's own original order. */
  function personalizedExpressions(pool, profile) {
    const scenario = scenarioFor(profile);
    const kw = [...(scenario ? scenario.keywords : []), ...roleHintsFor(profile), ...vocabHintsFor(profile)].map(k => k.toLowerCase());
    const n = expressionCount(profile);
    if (!kw.length) return pool.slice(0, n);
    return pool.map((p, i) => ({ p, i, hit: kw.some(k => p.toLowerCase().includes(k)) ? 1 : 0 }))
      .sort((a, b) => b.hit - a.hit || a.i - b.i).map(x => x.p).slice(0, n);
  }
  function videoKeywordsFor(profile, fallback) {
    const scenario = scenarioFor(profile);
    const kw = [...(scenario ? scenario.keywords : []), ...roleHintsFor(profile)];
    return kw.length ? kw : (fallback || []);
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
    const pool = (phrases || []).map(p => String(p.p || p));
    const scenario = scenarioFor(profile);
    const diff = difficultyFor(profile);
    const chosen = personalizedExpressions(pool, profile);
    return {
      curriculumVersion: core.curriculumVersion,
      learnerProfileVersion: SCHEMA_VERSION,
      lessonId: id,
      week: w, day: d,
      competencyObjective: core.competencyObjective,
      learnerContext: { selfLevel: (profile && profile.selfLevel) || "", role: (profile && profile.role) || "", roleCat: (profile && profile.roleCat) || "", goalId: (profile && profile.goalId) || "", situations: (profile && profile.situations) || [], priorities: (profile && profile.priorities) || [], vocabGoals: (profile && profile.vocabGoals) || [], dailyMinutes: (profile && profile.dailyMinutes) || "", proficiency: prof },
      personalizedScenario: { task: (scenario && scenario.frame) || core._task, missionPattern: core._missionPattern, missionObjective: core._missionObjective, personalized: !!scenario },
      targetExpressions: chosen,
      pronunciationFocus: { source: "observed from the learner's own take, not prescribed in advance", declared: declaredPronunciation(profile) },
      speakingTask: { kind: "shadow-then-own-intro", minSeconds: diff.minSeconds, maxSeconds: diff.maxSeconds, complexity: diff.complexity },
      assessmentCriteria: core.assessmentCriteria,
      supportingVideo: video || null,
      vocabularyReview: { phrases: chosen },
      evidenceStatus: "not_assessed",
      nextAction: null,
      generatedAt: Date.now(),
      planVersion: SCHEMA_VERSION,
      staticFallback: { competencyObjective: core.competencyObjective, task: core._task, out: core._out, expressions: pool.slice(0, 5) }
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
  function pickSupportingVideo(starters, keywords, index) {
    starters = starters || []; keywords = keywords || [];
    const keys = keywords.map(k => String(k).toLowerCase()).filter(Boolean);
    let best = null, bestScore = 0, bestFrom = "";
    starters.forEach(s => {
      /* the blurb is what the catalogue CLAIMS; the transcript is what the speaker actually says.
         Both are scored, the transcript weighted higher, so a clip is named because its words match
         the day — not because someone wrote the right sentence in its "why". */
      const hay = (String(s.name || "") + " " + String(s.why || "")).toLowerCase();
      const blurb = keys.reduce((n, k) => n + (hay.includes(k) ? 1 : 0), 0);
      const prof = index && index[s.vid];
      const spoken = prof ? keys.reduce((n, k) => n + (prof[k] ? Math.min(3, prof[k]) : 0), 0) : 0;
      const score = blurb + spoken * 2;
      if (score > bestScore) { bestScore = score; best = s; bestFrom = spoken ? (blurb ? "both" : "transcript") : "blurb"; }
    });
    if (!best) return null;
    return { id: best.vid, title: best.name, matchedOn: bestFrom,
      matchReason: "closest professional-register match in the library — " + best.why };
  }

  /* ---------------------------------------------------------------- paragraphs
     The learner is sent to a PASSAGE, not to a 126-paragraph speech. The grouping rule is the
     studio's own (index.html svParas delegates here) so the paragraph numbers the lesson quotes
     are the numbers the studio shows. */
  function paragraphsOf(segments) {
    const segs = Array.isArray(segments) ? segments : [];
    const out = []; let cur = null, chars = 0;
    segs.forEach((sg, i) => {
      const txt = String((sg && (sg.text || sg.txt)) || "").trim(), ends = /[.!?…]["'\u2019)\]]*$/.test(txt);
      if (!cur) { cur = { from: i, to: i }; chars = txt.length; } else { cur.to = i; chars += txt.length + 1; }
      const n = cur.to - cur.from + 1;
      if (n >= 3 || (n >= 2 && ends && chars >= 110) || chars >= 260) { out.push(cur); cur = null; chars = 0; }
    });
    if (cur) out.push(cur);
    return out;
  }

  /* ------------------------------------------------- passages worth shadowing
     A paragraph is a READING unit (svParas closes after ~3 lines), far too short to master: the
     week-1 pick was 5.3 s and stopped at "and I've". A PASSAGE is a speaking unit — it starts where
     a sentence starts, ends where one ends, and runs long enough to be a real model. The curriculum
     asks for 45-60 seconds, so that is what is aimed at (owner, 7 Nov 2026). */
  const PASSAGE = { minS: 25, targetS: 45, maxS: 75, maxSentences: 7, backCap: 10 };
  const SENT_END = /[.!?…]["'\u2019)\]]*$/;
  /* caption noise that is not speech: [music], [applause], and the ">>" speaker marks */
  function cleanLine(t) { return String(t || "").replace(/\[[^\]]*\]/g, " ").replace(/>>+/g, " ").replace(/\s+/g, " ").trim(); }
  const segText = sg => cleanLine(sg && (sg.text || sg.txt));
  const endsSentence = sg => SENT_END.test(segText(sg));

  /* The sentence a phrase is spoken in, normalised. Two passages whose phrase-sentence matches are
     the same teaching moment however differently they open — the library repeats presenters across
     videos, so comparing the first words is not enough (owner, 7 Nov 2026). */
  function phraseSentence(text, phrase) {
    const parts = String(text || "").split(/(?<=[.!?…])\s+/);
    const want = paraTokens(phrase).join(" ");
    const hit = parts.find(p => paraTokens(p).join(" ").includes(want)) || parts[0] || "";
    return paraTokens(hit).join(" ");
  }

  /* Grow a hit outward to the nearest complete thought. Returns null when the captions cannot
     support one (no sentence end anywhere near) rather than hand back another fragment. */
  function expandPassage(segments, from, to) {
    const segs = Array.isArray(segments) ? segments : [];
    if (!segs.length || from == null) return null;
    let a = Math.max(0, from), b = Math.min(segs.length - 1, to == null ? from : to);
    /* back up to the start of the sentence the hit sits in */
    let back = 0;
    while (a > 0 && back < PASSAGE.backCap && !endsSentence(segs[a - 1])) { a--; back++; }
    const startMs = segs[a].startMs;
    /* forward, remembering every sentence end as a candidate stopping point */
    const stops = []; let seen = 0;
    for (let i = b; i < segs.length; i++) {
      const secs = (segs[i].endMs - startMs) / 1000;
      if (endsSentence(segs[i])) { seen++; stops.push({ i, secs }); }
      if (secs >= PASSAGE.maxS || seen >= PASSAGE.maxSentences) break;
    }
    if (!stops.length) return null;                       /* no complete thought available here */
    /* the stop closest to the target that is still long enough; else the longest we found */
    const enough = stops.filter(s => s.secs >= PASSAGE.minS);
    const pick = enough.length
      ? enough.reduce((best, s) => Math.abs(s.secs - PASSAGE.targetS) < Math.abs(best.secs - PASSAGE.targetS) ? s : best)
      : stops[stops.length - 1];
    b = pick.i;
    const lines = segs.slice(a, b + 1).map(segText).filter(Boolean);
    const text = lines.join(" ").replace(/\s+/g, " ").trim();
    if (!text) return null;
    /* count over the WHOLE passage, not from the hit onward: the hit can sit mid-way */
    const sentences = (text.match(/[.!?…]+/g) || []).length || 1;
    return { from: a, to: b, text, startMs, endMs: segs[b].endMs,
      seconds: Math.round((segs[b].endMs - startMs) / 100) / 10,
      sentences, words: text.split(/\s+/).length,
      /* how much of it was caption noise rather than speech — a ranking signal, not a filter */
      noise: segs.slice(a, b + 1).filter(sg => /\[|>>/.test(String(sg.text || ""))).length };
  }

  const PARA_STOP = new Set(("a an and are as at be but by for from had has have he her his i if in is it its of on or our she that the their them then there these they this to was we were what when which who will with you your").split(" "));
  function paraTokens(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/)
      .filter(w => w.length > 2 && !PARA_STOP.has(w));
  }

  /* Score each paragraph against the day's own language (its phrases and focus words) and return the
     best `want`, in the order they are SPOKEN. Only paragraphs that really match are returned: a zero
     score is not a recommendation, and an empty list means the lesson says nothing about passages. */
  function pickParagraphs(segments, phrases, want) {
    const segs = Array.isArray(segments) ? segments : [];
    const paras = paragraphsOf(segs);
    if (!paras.length) return [];
    const keys = new Set();
    (phrases || []).forEach(p => paraTokens(p).forEach(w => keys.add(w)));
    if (!keys.size) return [];
    const scored = paras.map((p, i) => {
      const text = segs.slice(p.from, p.to + 1).map(s => (s && (s.text || s.txt)) || "").join(" ");
      const toks = paraTokens(text);
      const hit = new Set(toks.filter(w => keys.has(w)));
      /* density, not raw count: a long paragraph must not win just by being long */
      const score = hit.size + hit.size / Math.max(8, toks.length) * 4;
      return { i, index: i + 1, of: paras.length, from: p.from, to: p.to, text: text.trim(), hits: [...hit], score };
    }).filter(p => p.hits.length);
    if (!scored.length) return [];
    scored.sort((a, b) => b.score - a.score || a.i - b.i);
    return scored.slice(0, Math.max(1, want || 2)).sort((a, b) => a.i - b.i);
  }

  /* ------------------------------------------------- evaluation after each step
     Being HEARD is unmetered (transcription); only a VERDICT costs an allowance. So every step can
     carry real numbers on any plan, and the AI verdict is layered on by plan (owner, 7 Nov 2026):
       Free with an account — numbers everywhere, a verdict on the baseline and on the conversation
       Premium              — a verdict on every spoken step, plus one overall verdict at the end
     A learner with no account gets the numbers only: an AI route needs an account, free or not. */
  function evaluationPlan(opts) {
    const o = opts || {}, acct = !!o.account, premium = !!o.premium && acct;
    return {
      try: acct ? "ai" : "device",
      /* REHEARSE is now the same exercise as LEARN (owner, 8 Nov 2026): the AI WRITES the five
         sentences (content, unmetered) and the device grades them against the 80% bar. So it
         buys no verdict on any plan — the page is identical for a free learner and a paying one. */
      rehearse: "device",
      shadow: "device",                      /* the word-by-word accuracy is aligned on the device */
      /* The spoken shadowing coach (owner, 7 Nov 2026). It ALWAYS runs: the read of the attempt is
         assembled from the alignment, and the method — before / during / after / what to focus on —
         is written content, the same for everybody. "ai" only means the model personalises that
         script. A free day is already sized to the free cap, so the AI pass is Premium until the
         owner raises the cap; the learner is never shown an empty coach either way. */
      shadowCoach: premium ? "ai" : "device",
      converse: acct ? "ai" : "device",
      finish: "compare",                     /* before/after needs no new verdict: both are already measured */
      /* The closing report is part of ONE free day, not a Premium extra (owner, 7 Nov 2026):
         a free learner must be able to start Monday, finish it and read the verdict. What Premium
         buys is doing it AGAIN — repeat takes, a second day, and AI on every step. */
      overall: acct,
      account: acct,
      premium: premium,
      /* What the spine costs, so the free cap can be sized against it rather than guessed:
         TRY report + IMPROVE report (the converse take) + the closing verdict. Writing the
         practice sentences is content, not a verdict, and is unmetered, and so is the shadow
         transcript, and so are the practice sentences on steps 2 and 4. Premium additionally pays
         for a coach on each of the two shadows — which is why the free day, and only the free
         day, has to equal the free cap. */
      verdicts: (acct ? 1 : 0) + (acct ? 1 : 0) + (acct ? 1 : 0) + (premium ? 2 : 0),
    };
  }

  /* ShadowSync.tokens() turns "I'm" into one token "im", so findExpression never matches a learner
     who says "I'm responsible for" against the curriculum's "I am responsible for" — nor a speaker
     who does. Both sides are expanded first (found 7 Nov 2026). ShadowSync itself is left alone:
     the Challenge grades against it and must not shift underneath. */
  const CONTRACTIONS = [["i'm","i am"],["i've","i have"],["i'll","i will"],["i'd","i would"],
    ["we're","we are"],["we've","we have"],["we'll","we will"],["we'd","we would"],
    ["you're","you are"],["you've","you have"],["you'll","you will"],["you'd","you would"],
    ["they're","they are"],["they've","they have"],["they'll","they will"],["they'd","they would"],
    ["he's","he is"],["she's","she is"],["it's","it is"],["that's","that is"],["there's","there is"],
    ["what's","what is"],["here's","here is"],["who's","who is"],["let's","let us"],
    ["don't","do not"],["doesn't","does not"],["didn't","did not"],["can't","cannot"],["won't","will not"],
    ["isn't","is not"],["aren't","are not"],["wasn't","was not"],["weren't","were not"],
    ["haven't","have not"],["hasn't","has not"],["hadn't","had not"],
    ["wouldn't","would not"],["couldn't","could not"],["shouldn't","should not"]];
  function foldContractions(text) {
    let out = " " + String(text || "").toLowerCase().replace(/[\u2019]/g, "'") + " ";
    for (const [a, b] of CONTRACTIONS) out = out.split(" " + a + " ").join(" " + b + " ");
    return out.replace(/\s+/g, " ").trim();
  }
  /* The curriculum writes a phrase as a TEACHING line, not as a sentence anyone utters:
       "At a high level… the main blocker is… what I'd recommend is…"   three phrases in one
       "I'd suggest we validate X before…"                              X is a slot, not a word
     Matching the decorated string finds nothing — which is why weeks 6, 7, 10, 11 and 12 had no
     passage at all. Split it into the parts actually spoken, cut each at its first placeholder,
     and keep the parts long enough to be a real match (owner, 7 Nov 2026). */
  const PLACEHOLDER = /^(x|y|z|n|\[[^\]]*\])$/i;
  function phraseVariants(phrase) {
    const raw = String(phrase || "").replace(/[\u2019]/g, "'");
    const out = [];
    for (const part of raw.split(/\u2026|\.{3}|\u2014|\u2013/)) {
      const words = part.replace(/[^A-Za-z0-9'\-\s]/g, " ").split(/\s+/).filter(Boolean);
      const cut = []; 
      for (const wd of words) { if (PLACEHOLDER.test(wd)) break; cut.push(wd); }
      const text = cut.join(" ").trim();
      /* three words is the floor: "the risk is" is a phrase, "the risk" is a coincidence */
      if (text && cut.length >= 3 && !out.includes(text)) out.push(text);
    }
    return out.length ? out : [raw.trim()].filter(Boolean);
  }

  /* The one question "did they say it?" — used by the lesson AND by the index builder, so a passage
     is found on the same rule a learner is credited on. */
  function makeSays(findExpression) {
    return (text, phrase) => !!makeFinds(findExpression)(text, phrase);
  }
  /* Which part of the phrase was actually said — so the lesson can name the real line
     ("the main blocker is") instead of the teaching string it came from. */
  function makeFinds(findExpression) {
    return (text, phrase) => {
      if (!text || !phrase) return null;
      const folded = foldContractions(text);
      for (const v of phraseVariants(phrase)) {
        if (findExpression(text, [v]) || findExpression(folded, [foldContractions(v)])) return v;
      }
      return null;
    };
  }

  const FILLER = /\b(um+|uh+|er+|ah+|hmm+|like|you know|i mean|sort of|kind of|basically|actually)\b/gi;
  /* What a recording shows WITHOUT spending anything: did the target language actually come out,
     how fast, how hesitant. `has` is the engine's own phrase check, so it folds contractions and
     spelling the same way the Challenge does. */
  function measure(transcript, targets, seconds, has) {
    const text = String(transcript || "").trim();
    const words = text ? text.split(/\s+/).length : 0;
    const list = (targets || []).filter(Boolean);
    const used = typeof has === "function" ? list.filter(x => has(text, x)) : [];
    const fillers = (text.match(FILLER) || []).length;
    const secs = Number(seconds) > 0 ? Number(seconds) : 0;
    return {
      words, seconds: Math.round(secs * 10) / 10,
      wpm: secs > 0 ? Math.round(words / (secs / 60)) : null,
      targets: list.length, used: used.length, usedList: used,
      coverage: list.length ? Math.round(used.length / list.length * 100) : null,
      fillers, fillerRate: words ? Math.round(fillers / words * 1000) / 10 : 0,
    };
  }

  /* The day's real question: did anything change between the first attempt and the last, on the
     SAME task. Only states what both measurements support — never "you improved" from one number. */
  function compareAttempts(before, after) {
    if (!before || !after) return { comparable: false, changes: [] };
    const ch = [];
    const d = (k) => (after[k] == null || before[k] == null) ? null : after[k] - before[k];
    const cov = d("coverage");
    if (cov != null && Math.abs(cov) >= 10) ch.push({ k: "coverage", from: before.coverage, to: after.coverage, dir: cov > 0 ? "up" : "down" });
    const wpm = d("wpm");
    if (wpm != null && Math.abs(wpm) >= 15) ch.push({ k: "pace", from: before.wpm, to: after.wpm, dir: wpm > 0 ? "up" : "down" });
    const fr = d("fillerRate");
    if (fr != null && Math.abs(fr) >= 1) ch.push({ k: "fillers", from: before.fillerRate, to: after.fillerRate, dir: fr > 0 ? "up" : "down" });
    const words = d("words");
    if (words != null && Math.abs(words) >= 15) ch.push({ k: "length", from: before.words, to: after.words, dir: words > 0 ? "up" : "down" });
    return { comparable: true, changes: ch, steady: ch.length === 0 };
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
    if (next) { if (STEPS.indexOf(next) > reached(e)) e.reached = next; e.step = next; }
    return e;
  }

  /* How far the learner has GOT, as opposed to where they are looking. The lesson lets them walk
     back to any step they have finished (owner, 7 Nov 2026 — "when the user is in step 3 you can
     go back to step 2 or step 1 and see what happened"), so the open step is no longer the high
     water mark. Older entries carry no `reached`, and then the open step IS the mark. */
  function reached(entry) {
    if (!entry) return 0;
    const a = STEPS.indexOf(entry.step), b = STEPS.indexOf(entry.reached || entry.step);
    return Math.max(a < 0 ? 0 : a, b < 0 ? 0 : b);
  }
  /* Move the view WITHOUT crediting anything: only to a step already reached, and never forward
     past it. Walking back and pressing Continue again must not re-award a later step's data. */
  function goStep(S, id, step) {
    const e = load(S, id); if (!e) return null;
    const i = STEPS.indexOf(step); if (i < 0 || i > reached(e)) return e;
    if (!e.reached) e.reached = e.step;
    e.step = step;
    return e;
  }

  function complete(S, id) {
    const e = load(S, id); if (!e) return null;
    e.completedAt = Date.now();
    e.step = "finish";
    e.reached = "finish";
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

  const api = { roleHintsFor, vocabHintsFor, expressionCount, declaredPronunciation, STEPS, SCHEMA_VERSION, lessonId, proficiencyRange, canonicalCore, build, validate, validateAgainstCurriculum, pickSupportingVideo, paragraphsOf, pickParagraphs, expandPassage, phraseSentence, PASSAGE, evaluationPlan, measure, compareAttempts, foldContractions, makeSays, makeFinds, phraseVariants, load, start, setStep, reached, goStep, complete, completedAttempts, evidenceStatus, scenarioFor, difficultyFor, personalizedExpressions, videoKeywordsFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.DailyPlan = api;
})(typeof window !== "undefined" ? window : globalThis);
