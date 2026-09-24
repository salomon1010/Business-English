/* ============================================================================
   BE Mastery V2 — Mission Engine
   ----------------------------------------------------------------------------
   The learning loop the V2 audit asked for, as pure functions:

     SEE → HEAR → NOTICE → SPEAK → COACH → RETRY → TRANSFER → EVIDENCE
       → LEARNER MEMORY → NEXT RECOMMENDATION

   No DOM, no fetch, no globals beyond AnswerEvaluator. index.html drives it
   from the recorder and the microphone; tests/mission-week3.mjs drives it from
   strings. That is deliberate: every progression decision in here has to be
   reproducible without a browser, because these decisions are the ones that
   tell a learner they are ready.

   WHAT THIS ENGINE WILL AND WILL NOT CLAIM
   ----------------------------------------
   It measures whether the learner MADE the communication moves the task needs,
   how clearly they organised them, and whether they could do it again in a
   situation nobody rehearsed with them. It does not measure "English level",
   and it never awards progress for opening a screen, listening to a model,
   pressing complete or rating yourself. Evidence means recorded speech that
   covered the moves. Nothing else counts.

   Pronunciation is recorded as comprehensibility only and is deliberately NOT
   a gate on progression. A learner whose accent differs from the model speaker
   is not worse at giving an update, and the product must never imply it.

   TRACK BOUNDARY
   --------------
   This engine is content-agnostic; it is the missions.json pack that is
   General English only. Three independent things keep it there: Welding ships
   no missions.json, professional-tracks.js refuses to inherit the section
   (NEVER_INHERIT), and every write below goes through guard() which rejects
   any area but the one the competency pack was resolved for.
   ============================================================================ */
(function(global){

  const AE = global.AnswerEvaluator || (typeof require === "function" ? require("./answer-evaluator.js") : null);

  /* The one track this pack may ever be used from. Not read from state: a
     constant cannot be moved by a bug somewhere else in the app. */
  const TRACK = "general-english";

  /* Competency states, in order. Index comparison is the whole ladder. */
  const STATES = ["NOT_STARTED", "INTRODUCED", "PRACTICING", "DEMONSTRATED", "TRANSFER_READY", "STRONG"];
  const rank = s => Math.max(0, STATES.indexOf(s));

  /* Thresholds. Named, because every one of them is a claim about a learner. */
  const MIN_WORDS   = 8;     // fewer than this is not an update, it is a noise
  const STRONG_COV  = 0.75;  // AnswerEvaluator's "strong" band, used for the label only
  const PASS_COV    = 0.5;   // below this the attempt is a retry, not a result
  /* What DEMONSTRATED actually requires: every move, not most of them.
     A competency's shape is its OWN move list, however long that is — five for
     Week 1, four for Week 2, five for Week 3, and whatever a future week declares. An
     answer that states the status, names the issue and promises to follow up
     but never says what it means for Friday is the exact answer this whole
     mission exists to fix — and at three moves out of four it would have
     scored 0.75 and been called demonstrated. Coverage bands describe an
     answer; they do not decide whether someone can do the job.

     Expressed as coverage >= 1 rather than as a count, so it is the same rule
     whatever number of moves a competency declares. */
  const DEMONSTRATE_ALL = true;
  const FLUENT_WPM  = [70, 180];   // outside this band, delivery is what to fix
  const MAX_ATTEMPTS = 60;   // per competency, newest kept
  const MAX_SUPPORT  = 20;   // supporting evidence from other surfaces (Shadow)

  /* ==========================================================================
     THE V2 EVIDENCE CONTRACT  (v1)

     One shape, produced in one place, consumed by progress, retrieval, the AI
     coach, analytics and any future mission. Everything downstream reads THIS
     and nothing else, which is what keeps those systems from growing knowledge
     of each other.

     The rule that matters most: a dimension the product cannot actually
     measure is `null`, and null is not zero. `pron` is null on a device where
     the audio grader is unavailable or fell back to whisper; `seconds`/`wpm`
     are null when the recorder could not report a duration; `clarityBasis`
     says which question clarity was able to ask. A consumer that shows a
     number must first check for null, and the UI shows "—".
     ========================================================================== */
  const EVIDENCE_VERSION = 1;
  /* null in, null out. `+null` is 0 and `+""` is 0, both of which are finite,
     so the obvious one-liner silently turned "we could not measure this" into
     "we measured it and it was zero" — the precise failure this contract
     exists to stop. Booleans are rejected for the same reason. */
  const num = (v, lo, hi) => {
    if (v == null || v === "" || typeof v === "boolean") return null;
    const n = +v;
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null;
  };

  function contract(ev, meta) {
    const m = meta || {};
    const moves = {};
    (m.moveIds || Object.keys(ev.moves || {})).forEach(id => { moves[id] = !!(ev.moves || {})[id]; });
    return {
      v: EVIDENCE_VERSION,
      /* identity */
      tk: TRACK,
      week: m.week == null ? null : +m.week,
      competency: m.competency || null,
      missionId: ev.missionId || m.missionId || null,
      kind: ev.kind || "guided",                 // guided | retry | transfer
      key: ev.key || null,                       // idempotency key — one spoken turn, one row
      at: ev.at || Date.now(),
      /* what was said */
      said: ev.said || "",
      words: num(ev.words, 0, 5000),
      seconds: num(ev.seconds, 0, 3600),
      wpm: num(ev.wpm, 0, 600),
      answered: !!ev.answered,
      /* the six dimensions — null where unmeasurable, never invented */
      task: num(ev.coverage, 0, 1),
      moves,
      clarity: num(ev.clarity, 0, 1),
      clarityBasis: ev.clarityBasis || null,
      fluency: num(ev.fluency, 0, 1),
      vocab: num(ev.vocab, 0, 1),
      vocabUsed: Array.isArray(ev.vocabUsed) ? ev.vocabUsed.slice(0, 16) : [],
      pron: num(ev.pron, 0, 100),                // comprehensibility; null = not measured
      pronSource: ev.pronSource || null,         // "audio" | "shadow" | null
      /* verdicts */
      coverage: num(ev.coverage, 0, 1),
      verdict: ev.verdict || "thin",
      passed: passes(ev),
      transfer: (ev.kind === "transfer") ? passes(ev) : null,
      assisted: !!ev.assisted,
      /* coaching */
      coachPending: !!ev.coachPending,
      coachMove: ev.coachMove || null,
      coachAi: ev.coachAi == null ? null : !!ev.coachAi,
    };
  }

  /* ---------------------------------------------------------------- helpers */
  const clamp01 = n => Math.max(0, Math.min(1, Number(n) || 0));
  const words = t => String(t || "").trim().split(/\s+/).filter(Boolean);
  const HEDGE = ["um", "uh", "er", "erm", "ah", "hmm", "like", "you know", "sort of", "kind of", "i mean", "basically", "actually"];

  function competencyOf(pack, id) {
    const list = (pack && pack.competencies) || [];
    return list.find(c => c && c.id === id) || null;
  }
  function missionOf(comp, id) {
    return ((comp && comp.missions) || []).find(m => m && m.id === id) || null;
  }
  function moveIds(comp) { return ((comp && comp.moves) || []).map(m => m.id); }
  function moveOf(comp, id) { return ((comp && comp.moves) || []).find(m => m.id === id) || null; }

  /* The competency's moves expressed as an AnswerEvaluator rubric. Reusing that
     engine rather than writing a second cue matcher is the point: it already
     handles word boundaries, stems and silent-e endings, it is already the
     thing Welding's 60 workshop questions are scored with, and its assist
     contract (a model may ADD a covered point, never remove one) is exactly
     what we want from an AI pass over a spoken update. */
  function rubricFor(comp, mission) {
    return {
      ask: (mission && mission.prompt) || "",
      model: (mission && mission.hear && mission.hear.model) || "",
      why: (comp && comp.objective) || "",
      source: "BE Mastery V2 communication pattern: " + ((comp && comp.pattern) || ""),
      points: ((comp && comp.moves) || []).map(m => ({ id: m.id, label: m.label, cues: m.cues || [] })),
      vocab: ((comp && comp.expressions) || []).map(e => e.w),
    };
  }

  /* ------------------------------------------------------------- SPEAK/grade
     One attempt, graded from what was actually said. Deterministic and
     offline: the same transcript always produces the same evidence, so a
     learner who loses the network does not lose the result, only the prose. */
  function grade(comp, mission, said, meta) {
    const m = meta || {};
    const rb = rubricFor(comp, mission);
    const base = AE.evaluate(said, rb);
    const w = words(said);
    const seconds = Number(m.seconds) > 0 ? Number(m.seconds) : null;
    const wpm = seconds ? Math.round(w.length / (seconds / 60)) : null;

    /* CLARITY — is this organised as an update, or is it one long run-on?
       Two things a listener actually notices: whether the moves arrive in a
       sensible order, and whether the sentences are short enough to follow. */
    const order = moveIds(comp);
    const low0 = String(said || "").toLowerCase();
    /* Where each move first shows up, so we can ask whether they arrived in an
       order a listener can follow. A move credited by the AI carries no cue, so
       it has no position and is simply left out of the ordering question
       rather than being parked at the end and counted as out of order. */
    const seen = base.covered
      .filter(c => c.cue && c.cue !== "assisted")
      .map(c => ({ id: c.id, at: low0.indexOf(String(c.cue).toLowerCase()) }))
      .filter(x => x.at >= 0 && order.includes(x.id))
      .sort((a, b) => a.at - b.at);
    let inOrder = 0;
    for (let i = 1; i < seen.length; i++) if (order.indexOf(seen[i].id) > order.indexOf(seen[i - 1].id)) inOrder++;
    const orderScore = seen.length > 1 ? inOrder / (seen.length - 1) : (seen.length ? 1 : 0);

    /* Sentence length only means something when there are sentences to measure.
       Browser speech recognition very often returns a single unpunctuated run
       of words, and scoring that as "one 60-word sentence" would mark every
       learner on every device as unclear — a property of the transcriber, not
       of their speech. With no punctuation the question is not asked, and
       clarity rests on ordering alone. */
    const marks = (String(said || "").match(/[.!?]/g) || []).length;
    const punctuated = marks >= 2 || (marks === 1 && w.length <= 25);
    let clarity;
    if (punctuated) {
      const sentences = String(said || "").split(/[.!?]+/).map(x => x.trim()).filter(Boolean).length || 1;
      const perSentence = w.length / sentences;
      /* Up to ~22 words a sentence reads as spoken professional English. Longer
         is where a listener loses the thread; that is the only claim made. */
      const lengthScore = perSentence <= 22 ? 1 : perSentence <= 32 ? 0.6 : 0.3;
      clarity = clamp01(orderScore * 0.6 + lengthScore * 0.4);
    } else {
      clarity = clamp01(orderScore);
    }

    /* FLUENCY — could they get it out without breaking down? Not speed for its
       own sake: a band, plus how much of the turn was hesitation. */
    const low = String(said || "").toLowerCase();
    const hedges = HEDGE.reduce((n, h) => n + (low.split(h).length - 1), 0);
    const hedgeRate = w.length ? hedges / w.length : 0;
    const paceOk = wpm == null ? 0.7 : (wpm >= FLUENT_WPM[0] && wpm <= FLUENT_WPM[1]) ? 1 : 0.5;
    const fluency = clamp01(paceOk * 0.6 + (1 - Math.min(1, hedgeRate * 8)) * 0.4);

    /* VOCABULARY — did any of the competency's own expressions get used?
       Reported, never required: an original answer that avoids all eight is
       still a good update. */
    const vocabUsed = base.vocabUsed.slice();
    const vocab = rb.vocab.length ? clamp01(vocabUsed.length / Math.min(3, rb.vocab.length)) : 0;

    return {
      said,
      words: w.length,
      seconds,
      wpm,
      moves: order.reduce((o, id) => { o[id] = base.covered.some(c => c.id === id); return o; }, {}),
      covered: base.covered.map(c => c.id),
      missed: base.missed.map(mm => mm.id),
      coverage: base.coverage,
      verdict: base.verdict,
      clarity,
      clarityBasis: punctuated ? "order+length" : "order",
      fluency,
      vocab,
      vocabUsed,
      /* filled in later, from the audio grader, when there is one */
      pron: null,
      answered: base.answered && w.length >= MIN_WORDS,
      assisted: false,
    };
  }

  /* An AI pass may only ADD a move the cues missed. It can notice that "that
     puts Friday in danger" is an impact statement when no cue fired; it can
     never take away something the learner said, and it can never invent a
     score. Anything that is not a known move id is dropped on the floor. */
  function applyCoachMoves(ev, comp, ids) {
    if (!ev || !Array.isArray(ids)) return ev;
    const known = new Set(moveIds(comp));
    let moved = false;
    ids.filter(id => known.has(id)).forEach(id => {
      if (ev.moves[id]) return;
      ev.moves[id] = true;
      ev.covered.push(id);
      ev.missed = ev.missed.filter(x => x !== id);
      moved = true;
    });
    if (moved) {
      const total = known.size || 1;
      ev.coverage = ev.covered.length / total;
      ev.verdict = ev.coverage >= STRONG_COV ? "strong" : ev.coverage >= 0.4 ? "partial" : "thin";
      ev.assisted = true;
    }
    return ev;
  }

  /* The single most valuable thing to fix next. Ordered, not scored: the move
     that is missing beats the move that is weak, and an earlier move beats a
     later one because a listener who has lost the status never recovers. */
  function weakestMove(comp, ev, history) {
    const order = moveIds(comp);
    const missing = order.filter(id => ev && !ev.moves[id]);
    if (missing.length) return missing[0];
    /* Nothing missing this time — fall back to the move this learner has
       missed most often, so a recurring habit still surfaces. */
    const tally = {};
    (history || []).forEach(a => order.forEach(id => { if (a && a.moves && !a.moves[id]) tally[id] = (tally[id] || 0) + 1; }));
    const worst = order.filter(id => tally[id]).sort((a, b) => tally[b] - tally[a])[0];
    return worst || null;
  }

  /* ------------------------------------------------------------------- state
     S.v2A[area] = { <competencyId>: record }. Keyed by area for the same
     reason every other V2-era store is, and written only through guard(). */
  function guard(area) { return (area || TRACK) === TRACK; }

  function blank(id) {
    return { id, state: "NOT_STARTED", introducedAt: 0, attempts: [], transfer: { passed: 0, failed: 0 }, weakness: null, retrieval: null, updatedAt: 0 };
  }
  function record(store, id) {
    const box = store || {};
    box[id] = box[id] || blank(id);
    if (!Array.isArray(box[id].attempts)) box[id].attempts = [];
    if (!box[id].transfer) box[id].transfer = { passed: 0, failed: 0 };
    return box[id];
  }

  /* SEE/HEAR/NOTICE move the learner to INTRODUCED and nothing further. This
     is the line the V2 brief draws and it is drawn here, once, so no caller
     can accidentally credit a competency for a screen being opened. */
  function introduce(store, id, area, now) {
    if (!guard(area)) return null;
    const r = record(store, id);
    if (!r.introducedAt) r.introducedAt = now || Date.now();
    if (rank(r.state) < rank("INTRODUCED")) r.state = "INTRODUCED";
    r.updatedAt = now || Date.now();
    return r;
  }

  /* ---------------------------------------------------------- the state rule
     Written as one pure function of the whole attempt history so that it can
     never drift between the screen that shows a state and the engine that
     awards it, and so a test can assert it without replaying a session. */
  /* The single bar, in one place. Everything that asks "was that good enough?"
     — the state machine, the transfer tally, the recommendation — asks here, so
     the screen and the engine can never disagree about what the learner did. */
  function passes(ev) {
    if (!ev || !ev.answered) return false;
    return DEMONSTRATE_ALL ? (ev.coverage >= 1) : (ev.coverage >= STRONG_COV);
  }

  function stateFrom(r) {
    const a = r.attempts || [];
    if (!a.length) return r.introducedAt ? "INTRODUCED" : "NOT_STARTED";
    const spoken = a.filter(x => x && x.answered);
    if (!spoken.length) return r.introducedAt ? "INTRODUCED" : "NOT_STARTED";

    const guidedStrong = spoken.filter(x => x.kind !== "transfer" && passes(x));
    const transferStrong = spoken.filter(x => x.kind === "transfer" && passes(x));

    if (!guidedStrong.length) return "PRACTICING";
    /* Guided success alone is DEMONSTRATED and stops there. A learner who
       performs with the prompt in front of them and then cannot do it cold has
       not mastered anything, and the product must not tell them they have. */
    if (!transferStrong.length) return "DEMONSTRATED";
    /* One cold success is transfer-ready. STRONG needs a second one that is
       not part of the same sitting — evidence that it survived a night. */
    const distinctDays = new Set(transferStrong.map(x => new Date(x.at).toISOString().slice(0, 10)));
    return distinctDays.size >= 2 ? "STRONG" : "TRANSFER_READY";
  }

  /* Record one graded attempt. Idempotent on `key`: a retried network call, a
     double tap or a replayed queue cannot write the same speaking turn twice,
     which would otherwise inflate every number built on top of it. */
  function addAttempt(store, id, attempt, area, intervals, meta) {
    if (!guard(area)) return null;
    const r = record(store, id);
    const key = attempt && attempt.key;
    if (key && r.attempts.some(x => x && x.key === key)) {
      return { record: r, duplicate: true, attempt: r.attempts.find(x => x.key === key) };
    }
    const at = attempt.at || Date.now();
    /* Everything stored goes through the contract, so no caller can smuggle an
       undocumented field into the learner record or leave a dimension as an
       accidental 0 when it was never measured. */
    const row = contract(Object.assign({}, attempt, { at }),
      { competency: id, week: (meta && meta.week) || null, moveIds: (meta && meta.moveIds) || null, missionId: attempt.missionId });
    r.attempts.push(row);
    if (r.attempts.length > MAX_ATTEMPTS) r.attempts = r.attempts.slice(-MAX_ATTEMPTS);
    if (row.kind === "transfer" && row.answered) {
      if (passes(row)) r.transfer.passed++; else r.transfer.failed++;
    }
    r.state = stateFrom(r);
    r.updatedAt = at;
    r.retrieval = scheduleRetrieval(r, intervals, at);
    return { record: r, duplicate: false, attempt: row };
  }

  /* --------------------------------------------------------------- retrieval
     Spacing reuses the track's own vocabulary intervals rather than inventing
     a second ladder — the same [1,3,7,21,60] the word store already runs on.
     Only something the learner has actually demonstrated is worth spacing;
     anything weaker is due now, because the fix is practice, not waiting. */
  function scheduleRetrieval(r, intervals, now) {
    const t0 = now || Date.now();
    const list = (intervals && intervals.length) ? intervals : [1, 3, 7, 21, 60];
    const st = r.state;
    if (rank(st) < rank("DEMONSTRATED")) return { due: t0, reps: 0, reason: "practice" };
    const reps = (r.transfer.passed || 0) + (rank(st) >= rank("STRONG") ? 1 : 0);
    if (rank(st) === rank("DEMONSTRATED")) return { due: t0, reps, reason: "transfer" };
    const days = list[Math.min(Math.max(0, reps - 1), list.length - 1)];
    return { due: t0 + days * 86400000, reps, reason: "retrieval" };
  }

  /* ==========================================================================
     SHADOW → V2 SUPPORTING EVIDENCE

     The Challenge ladder is the strongest learning loop in the product and it
     already writes a rich, track-scoped record (aList("chHist")). This turns
     one of those entries into V2 evidence WITHOUT either side learning about
     the other: Shadow keeps writing exactly what it wrote before, and this
     reads it.

     It is deliberately SUPPORTING evidence, not a mission attempt. Shadowing a
     paragraph of a talk is practice of rhythm and phrasing; it is not the
     learner giving a clear update in their own words, and folding the two
     together would be precisely the kind of invented evidence this engine
     exists to avoid. So support never moves the competency state.

     What it IS good for, and what it is used for below: it shows the learner
     that the practice counted, and it can supply a real comprehensibility
     number for a competency whose own attempts could not measure one (the
     production audio grader usually falls back to whisper, which cannot).

     KNOWN LIMITATION, adapted around rather than papered over: a `challenge`
     history entry does not record which rung it was on (only chsync/chretell
     name theirs). svChHistPut now writes `rung`, so entries from this version
     forward carry it; older rows come back rung:null and are reported as
     unknown rather than guessed. */
  const SHADOW_RUNGS = ["gate", "sync", "recall", "blind", "retell"];

  function fromShadow(entry, comp) {
    const e = entry || {};
    if (!e.ts || !e.vid) return null;
    const kind = e.kind || "challenge";
    if (!["challenge", "chsync", "chretell", "shadow"].includes(kind)) return null;
    /* Linked only when it is THIS competency's clip. Anything else is still
       real Shadow work, but it is not evidence about this competency, and the
       caller is told which it is rather than being left to assume. */
    const clip = comp && comp.shadow && comp.shadow.vid;
    const linked = !!clip && e.vid === clip;
    const rung = e.rung && SHADOW_RUNGS.includes(e.rung) ? e.rung
      : (kind === "chsync" ? "sync" : kind === "chretell" ? "retell" : null);
    /* One honest number per kind. A challenge round reports coverage of the
       line; a shadow report reports its own score out of 100; sync and retell
       are pass/fail and say so by leaving score null. */
    const score = kind === "shadow" ? num(e.score, 0, 100)
      : kind === "challenge" ? (num(e.coverage, 0, 1) == null ? null : Math.round(num(e.coverage, 0, 1) * 100))
      : null;
    /* Comprehensibility only when the entry actually measured it. A challenge
       round in whisper mode says so in pronMode, exactly as the mission's own
       attempts do, and a whisper number is not a pronunciation judgement. */
    const pron = (kind === "challenge" && e.pronMode && e.pronMode !== "whisper" && e.dims && e.dims.pron && e.dims.pron !== "na")
      ? score
      : (kind === "shadow" ? num(e.score, 0, 100) : null);
    return {
      v: EVIDENCE_VERSION, src: "shadow", tk: TRACK,
      key: "sh:" + e.ts,                       // idempotent: one history row, one support row
      at: e.ts, kind, rung, linked,
      vid: e.vid, seg: e.seg == null ? null : e.seg,
      title: String(e.title || "").slice(0, 120),
      passed: !!e.pass,
      score, pron,
      words: e.heard ? String(e.heard).trim().split(/\s+/).filter(Boolean).length : null,
      competency: (comp && comp.id) || null,
    };
  }

  /* Support is bounded and idempotent, like attempts. It never touches state. */
  function addSupport(store, id, item, area) {
    if (!guard(area) || !item || !item.key) return null;
    const r = record(store, id);
    r.support = Array.isArray(r.support) ? r.support : [];
    if (r.support.some(x => x && x.key === item.key)) return { record: r, duplicate: true };
    r.support.push(item);
    r.support.sort((a, b) => (a.at || 0) - (b.at || 0));
    if (r.support.length > MAX_SUPPORT) r.support = r.support.slice(-MAX_SUPPORT);
    return { record: r, duplicate: false };
  }

  function supportSummary(r) {
    const list = ((r && r.support) || []).filter(Boolean);
    const linked = list.filter(x => x.linked);
    const withPron = list.filter(x => x.pron != null);
    return {
      total: list.length,
      linked: linked.length,
      passed: linked.filter(x => x.passed).length,
      /* how far up the ladder this learner has got on the competency's clip */
      bestRung: linked.reduce((best, x) => {
        const i = SHADOW_RUNGS.indexOf(x.rung);
        return i > best ? i : best;
      }, -1),
      rungName: (() => {
        const i = linked.reduce((b, x) => Math.max(b, SHADOW_RUNGS.indexOf(x.rung)), -1);
        return i >= 0 ? SHADOW_RUNGS[i] : null;
      })(),
      /* the comprehensibility the mission's own attempts usually cannot get */
      pron: withPron.length ? Math.round(withPron.reduce((n, x) => n + x.pron, 0) / withPron.length) : null,
      lastAt: list.length ? list[list.length - 1].at : null,
    };
  }

  /* ==========================================================================
     PROGRESS SUMMARY — the one shape the progress surfaces render.

     Deliberately a plain object of numbers and labels: the Passport asks for
     it through a global hook and renders it, and therefore never learns what a
     mission, a move or a rung is. */
  function progressSummary(r, comp) {
    const spoken = ((r && r.attempts) || []).filter(x => x && x.answered);
    const best = spoken.slice().sort((a, b) => (b.coverage || 0) - (a.coverage || 0))[0] || null;
    const sup = supportSummary(r);
    const ids = moveIds(comp);
    /* per move: how many spoken answers actually made it */
    const byMove = ids.map(id => ({
      id, label: (moveOf(comp, id) || {}).label || id,
      made: spoken.filter(a => a.moves && a.moves[id]).length,
      of: spoken.length,
    }));
    const avg = k => { const v = spoken.map(a => a[k]).filter(x => x != null); return v.length ? v.reduce((n, x) => n + x, 0) / v.length : null; };
    return {
      competency: (comp && comp.id) || null,
      title: (comp && comp.title) || "",
      week: (comp && comp.week) || null,
      state: (r && r.state) || "NOT_STARTED",
      attempts: spoken.length,
      passed: spoken.filter(a => a.passed).length,
      transferPassed: (r && r.transfer && r.transfer.passed) || 0,
      transferFailed: (r && r.transfer && r.transfer.failed) || 0,
      bestTask: best ? best.task : null,
      clarity: avg("clarity"),
      fluency: avg("fluency"),
      vocab: avg("vocab"),
      /* the mission's own measured comprehensibility, else Shadow's, else null */
      pron: (() => { const own = spoken.map(a => a.pron).filter(x => x != null); return own.length ? Math.round(own.reduce((n, x) => n + x, 0) / own.length) : sup.pron; })(),
      pronSource: (() => { const own = spoken.some(a => a.pron != null); return own ? "audio" : (sup.pron != null ? "shadow" : null); })(),
      byMove,
      weakness: (r && r.weakness) || null,
      shadow: sup,
      retrieval: (r && r.retrieval) || null,
      coachPending: spoken.filter(a => a.coachPending).length,
    };
  }

  /* ---------------------------------------------------------- recommendation
     Deterministic and explainable, in priority order. Every branch returns the
     reason it fired, because an app that decides for the learner has to be
     able to say why — that is the whole difference between coaching and a
     locked door. No model, no weights, no training data. */
  function recommend(r, comp, now) {
    const t0 = now || Date.now();
    const a = (r && r.attempts) || [];
    const last = a[a.length - 1] || null;
    const pending = a.filter(x => x && x.coachPending);
    const st = (r && r.state) || "NOT_STARTED";
    const weak = (r && r.weakness) || (last ? weakestMove(comp, last, a) : null);
    const wl = weak ? (moveOf(comp, weak) || {}).label || weak : null;
    const M = (comp && comp.missions) || [];
    const guided = (M.find(m => m.kind === "guided") || {}).id || null;
    const transfer = (M.find(m => m.kind === "transfer") || {}).id || null;

    if (pending.length) {
      return { action: "coach", missionId: pending[pending.length - 1].missionId, move: weak,
        reason: "coach_pending", n: pending.length };
    }
    if (st === "NOT_STARTED" || st === "INTRODUCED") {
      return { action: "speak", missionId: guided, move: null, reason: "not_spoken_yet" };
    }
    if (st === "PRACTICING") {
      return { action: "retry", missionId: (last && last.missionId) || guided, move: weak,
        reason: weak ? "weak_move" : "coverage_low" };
    }
    if (st === "DEMONSTRATED") {
      /* Demonstrated but transfer has been failed: more guided reps first, on
         the move that broke, before asking them to go cold again. */
      if (r.transfer.failed > 0) {
        return { action: "retry", missionId: guided, move: weak, reason: "transfer_failed" };
      }
      return { action: "transfer", missionId: transfer, move: null, reason: "ready_for_transfer" };
    }
    const due = (r.retrieval && r.retrieval.due) || 0;
    if (t0 >= due) {
      return { action: "retrieval", missionId: transfer || guided, move: weak,
        reason: st === "STRONG" ? "retrieval_due_strong" : "retrieval_due" };
    }
    return { action: "rest", missionId: null, move: weak, reason: "scheduled", due, label: wl };
  }

  /* ==========================================================================
     WHICH COMPETENCY IS TODAY'S?

     The moment there is more than one competency, something has to choose
     which one Home offers and which one the coach speaks for. This is that
     something, and it is the only concept the engine gained when the second
     competency arrived.

     It invents no new ranking. recommend() already expresses the engine's
     priority for a single competency -- unresolved coaching first, then the
     weak move, then a failed transfer, then a competency nobody has spoken
     for, then a due retrieval -- and this applies that SAME order across
     competencies. A competency with nothing to ask for ("rest") is never
     chosen.

     The tie-break, and only the tie-break, is the week number ascending: when
     two competencies are equally urgent the earlier one comes first, because a
     learner working through a programme should not be bounced backwards. No
     week is hardcoded as the winner; week 2 beats week 3 only when their
     evidence has made them equal. */
  const ACTION_PRIORITY = ["coach", "retry", "transfer", "speak", "retrieval", "rest"];
  const actionRank = a => { const i = ACTION_PRIORITY.indexOf(a); return i < 0 ? ACTION_PRIORITY.length : i; };

  /* comps: the competency list. get(id) returns that competency's record (or
     undefined). Returns {comp, record, rec} for the one to put in front of the
     learner, or null when every competency is resting. */
  function pickNext(comps, get, now) {
    const t0 = now || Date.now();
    let best = null;
    (comps || []).forEach(c => {
      if (!c || !c.id) return;
      const r = (get && get(c.id)) || blank(c.id);
      const rec = recommend(r, c, t0);
      if (!rec || rec.action === "rest") return;
      const rank = actionRank(rec.action);
      const week = Number(c.week) || 0;
      if (!best || rank < best.rank || (rank === best.rank && week < best.week)) {
        best = { comp: c, record: r, rec, rank, week };
      }
    });
    return best ? { comp: best.comp, record: best.record, rec: best.rec } : null;
  }

  /* ------------------------------------------------------- AI learner context
     Small on purpose. The AI gets the task, the moves, one summary line about
     the last attempt and the current weakness — never the attempt history,
     never past transcripts, never the profile. Everything here is either
     curriculum text or a number this engine computed. */
  function aiContext(r, comp, mission, opts) {
    const o = opts || {};
    const a = (r && r.attempts) || [];
    const prev = a.filter(x => x && x.answered && x.missionId === (mission && mission.id)).slice(-1)[0] || null;
    const spoken = a.filter(x => x && x.answered);
    return {
      track: TRACK,
      competency: comp && comp.id,
      competencyTitle: comp && comp.title,
      pattern: comp && comp.pattern,
      mission: mission && mission.id,
      missionKind: mission && mission.kind,
      prompt: mission && mission.prompt,
      targetMoves: ((comp && comp.moves) || []).map(m => ({ id: m.id, label: m.label, hint: m.hint })),
      recentEvidence: {
        attempts: spoken.length,
        bestCoverage: spoken.length ? Math.max(...spoken.map(x => x.coverage || 0)) : 0,
        lastVerdict: prev ? prev.verdict : null,
      },
      currentWeakness: o.weakness || (r && r.weakness) || null,
      /* A summary, not a transcript: which moves landed last time and how long
         it was. The learner's previous words stay on the device. */
      previousAttemptSummary: prev ? { moves: prev.moves, words: prev.words, verdict: prev.verdict } : null,
    };
  }

  /* The system prompt. The model is asked for exactly the shape the existing
     Worker chat route already guarantees — {reply, covered} — so this needs no
     new endpoint, no deploy and no second response schema to validate. The
     coverage list is move ids; the reply is ONE improvement sentence. */
  function coachPrompt(ctx, spokenRule) {
    const moves = ctx.targetMoves.map(m => `${m.id} (${m.label}) — ${m.hint}`).join("\n");
    const prev = ctx.previousAttemptSummary
      ? `\nLAST TIME\nThey made: ${Object.keys(ctx.previousAttemptSummary.moves || {}).filter(k => ctx.previousAttemptSummary.moves[k]).join(", ") || "none of the moves"}. Do not repeat advice they have already acted on.`
      : "";
    const weak = ctx.currentWeakness ? `\nThe deterministic scorer thinks "${ctx.currentWeakness}" is the weakest move. Say so only if you agree with it.` : "";
    return `You are a speaking coach listening to one short workplace update in English.

THE TASK
${ctx.prompt}
A good answer makes ${ctx.targetMoves.length} communication moves, in this shape: ${ctx.pattern}

THE MOVES
${moves}
${prev}${weak}

WHAT TO DO
Read the transcript of what they said. Decide which of the ${ctx.targetMoves.length} moves they
GENUINELY made — in their own words, not by using a particular phrase. Then
write ONE sentence of coaching naming the single highest-value thing to fix.

RULES
- One improvement only. Never list two. Never write a correction report.
- Never comment on their accent, and never compare them to a native speaker.
- Never correct grammar unless it stopped you understanding the message.
- Speak to them directly, in plain British English, under 25 words.
- Credit a move they made in their own words even if the wording is unusual.

${spokenRule || ""}

Return JSON only:
{"covered":["the move ids they genuinely made"],"reply":"your one coaching sentence"}`;
  }

  /* Whatever comes back is data, never application state. The reply is capped
     and the coverage list is filtered against the rubric by applyCoachMoves.
     A model that returns nothing usable leaves the deterministic result
     standing, which is the correct failure mode: the evidence was already
     complete before the network was ever asked. */
  function shapeCoach(raw, comp, ev) {
    const out = { worked: "", improve: "", retry: "", move: null, ai: false };
    const weak = weakestMove(comp, ev, []);
    const wm = weak ? moveOf(comp, weak) : null;
    const made = moveIds(comp).filter(id => ev.moves[id]).map(id => (moveOf(comp, id) || {}).label || id);

    out.worked = made.length
      ? `You made ${made.length === 1 ? "one move clearly" : "these moves clearly"}: ${made.join(", ")}.`
      : "You spoke a full turn without stopping — that is the hard part.";
    out.move = weak;
    out.improve = wm ? `${wm.label} is the move to add: ${wm.hint}` : "Say the same update again, a little shorter.";
    /* One sentence per move, plus nothing else — stated from the rubric rather
       than from a number typed into this file, which was "four" and therefore
       wrong for any competency that is not "Give a clear update"'s. */
    out.retry = wm ? wm.retry : `Say it again, one short sentence for each of the ${moveIds(comp).length} moves.`;

    if (raw && typeof raw.reply === "string" && raw.reply.trim()) {
      out.improve = raw.reply.trim().slice(0, 240);
      out.ai = true;
    }
    return out;
  }

  /* ==========================================================================
     SPEAKING REPORT — the richer feedback loop the pilot asked for.

     Three functions, same philosophy as the coach: the DETERMINISTIC evidence
     decides what was shown; the model only explains it and offers language.
     Every claim in the report is anchored to a move id, and shapeReport drops
     any AI sentence whose anchor disagrees with the evidence — praise for a
     move the scorer did not credit, or a correction for one it did. The model
     cannot create mastery, remove mastery, move a state or invent a score;
     it can only say WHY a move landed, WHY one is missing, and HOW the same
     message could be said better.

     The better version is language coaching, not a model answer to copy: the
     prompt pins it to the learner's own meaning and level, and a report that
     comes back without one (offline, or a refusal) simply shows no better
     version rather than inventing one deterministically — we cannot write the
     learner's answer for them without the model, and pretending otherwise is
     the invented-performance failure this file exists to stop. */
  /* ==========================================================================
     FACTUAL GROUNDING — the better version may reword, never add.

     The prompt asks the model to keep the learner's facts; this checks that it
     did, deterministically, against the transcript the report was written
     about. It is deliberately a small set of rules a person can read, not an
     NLP system, and it errs towards refusing: a rejected better version is
     simply not shown (there is no fallback — we cannot write the learner's
     answer without the model), while an accepted invention would teach the
     learner to say something they never meant. What it rejects:
       number   — a figure (digits or number words) the learner never said
       time     — a day, month, date word or deadline they never said
       request  — asking someone for something when the learner asked nothing
       name     — a capitalised name or an acronym absent from the transcript
       need     — "I/we need …" when the learner stated no need
       clause   — a clause whose content words are mostly not theirs
                  (stricter when it asks or commits). Scored per CLAUSE, not
                  per sentence: the production model's favourite invention
                  rides on a true sentence — "I've spoken to their office,
                  but I need their confirmation to proceed" — and a
                  sentence average lets it through.
     `bank` is the task's own expression list: the prompt tells the model to
     use it, so its words count as grounded vocabulary. */
  const GR_NUM = { zero: 0, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1e6, billion: 1e9, half: 0.5, quarter: 0.25, dozen: 12, double: "x2", twice: "x2", percent: "%" };
  const GR_TIME = /\b(january|february|march|april|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|yesterday|tonight|weekend|this (?:morning|afternoon|evening)|midday|noon|midnight|deadline|eod|asap|o'clock|next (?:week|month|year|quarter)|last (?:week|month|year|quarter)|end of (?:the )?(?:day|week|month|year|quarter))\b/g;
  const GR_REQ = /\b(?:could|can|would|will) you\b|\bplease\b|\bneed (?:your|you|help|support|approval|a decision)\b|\b(?:would like|want|need) you to\b|\bappreciate (?:it )?if\b|\blet me know\b|\b(?:could|can|may) (?:i|we) ask\b|\bask(?:ing)? (?:you|for)\b|\b(?:tell|send|give|help) (?:me|us)\b/g;
  const GR_COMMIT = /\b(?:i|we) (?:will|shall|am going to|are going to|promise|commit|guarantee)\b/;
  const GR_STOP = new Set(("a an the and or but so if then than that this these those there here it its it's i me my mine we us our you your he him his she her they them their " +
    "is are was were be been being am do does did done have has had having get got getting make made go going went gone say said tell told " +
    "to of in on at by for with from about into over under after before up down out off as not no yes just also very really already still now then " +
    "well okay ok um uh er like which who whom whose what when where why how all any some more most much many each every other another " +
    "can could will would shall should may might must need needs needed let lets thing things way really quite too because while since until " +
    "first second finally however therefore also actually basically currently one ones").split(/\s+/));
  const grNorm = s => " " + String(s || "").toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\b(i|you|we|they|he|she|it)'ll\b/g, "$1 will").replace(/\bwon't\b/g, "will not").replace(/\bcan't\b/g, "cannot")
    .replace(/\bi'm\b/g, "i am").replace(/\b(you|we|they)'re\b/g, "$1 are").replace(/\b(i|you|we|they)'ve\b/g, "$1 have")
    .replace(/\b(i|you|we|they|he|she)'d\b/g, "$1 would").replace(/n't\b/g, " not")
    .replace(/(\d),(\d{3})\b/g, "$1$2")
    .replace(/[^a-z0-9'%.\s-]+/g, " ").replace(/(\D)\.|\.(\D|$)/g, "$1 $2").replace(/-/g, " ").replace(/\s+/g, " ") + " ";
  const grWords = s => grNorm(s).split(" ").filter(Boolean);
  const grStem = w => w.replace(/'s$/, "").replace(/(ies|ing|ed|es|ly|e|s|y)$/, "").slice(0, 6);
  const grNums = s => {
    const out = new Set();
    grWords(s).forEach(w => {
      const d = w.match(/^\d+(?:\.\d+)?%?$/); if (d) { out.add(String(parseFloat(w))); if (/%$/.test(w)) out.add("%"); return; }
      if (w === "one") return;                           /* a pronoun far more often than a figure */
      if (Object.prototype.hasOwnProperty.call(GR_NUM, w)) out.add(String(GR_NUM[w]));
    });
    return out;
  };
  const grContent = s => grWords(s).filter(w => w.length >= 3 && !GR_STOP.has(w) && !/^\d/.test(w) && !Object.prototype.hasOwnProperty.call(GR_NUM, w));
  const grCount = (re, s) => (grNorm(s).match(re) || []).length;

  function groundCheck(text, said, opts) {
    opts = opts || {};
    const reasons = [];
    const T = String(text || "").trim(), S = String(said || "").trim();
    if (!T) return reasons;
    if (!S) return ["no-transcript"];                    /* nothing to check against is not a pass */
    const sN = grNorm(S), tN = grNorm(T);
    const sNums = grNums(S);
    grNums(T).forEach(n => { if (!sNums.has(n)) reasons.push("number:" + n); });
    (tN.match(GR_TIME) || []).forEach(w => { if (sN.indexOf(" " + w + " ") < 0) reasons.push("time:" + w); });
    if (grCount(GR_REQ, T) && !grCount(GR_REQ, S)) reasons.push("request");
    if (/ (?:i|we) (?:really |also |still |urgently )?need /.test(tN) && !/ need /.test(sN)) reasons.push("need");
    const known = new Set(grWords(S).concat(grWords((opts.bank || []).join(" "))));
    T.split(/\s+/).forEach((raw, i, all) => {
      const w = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9']+$/g, "");
      if (!w || /^I('|$)/.test(w)) return;
      const acro = /^[A-Z]{2,}s?$/.test(w);
      const startsSentence = i === 0 || /[.!?:]["')\]]*$/.test(all[i - 1]);
      if (!acro && (startsSentence || !/^[A-Z]/.test(w))) return;
      const lw = w.toLowerCase().replace(/'s$/, "");
      if (!known.has(lw) && !(" " + lw + " ").match(GR_TIME)) reasons.push("name:" + w);
    });
    if (opts.clauses !== false) {
      const stems = new Set([...known].map(grStem));
      const clauses = [];
      (T.match(/[^.!?]+[.!?]*/g) || []).forEach(sent =>   /* no lookbehind: iOS 15 WebKit cannot parse one */
        sent.split(/[;:]|,?\s+but\s+|,\s+(?=and (?:i|we|they|he|she)\b)/i).forEach(c => { if (c && c.trim()) clauses.push(c.trim()); }));
      clauses.forEach(sent => {
        const cw = grContent(sent);
        if (cw.length < 3) return;
        const hit = cw.filter(w => stems.has(grStem(w))).length;
        const asks = grCount(GR_REQ, sent) > 0 || GR_COMMIT.test(grNorm(sent));
        if (hit / cw.length < (asks ? 2 / 3 : 1 / 2)) reasons.push("clause:" + sent.slice(0, 60));
      });
    }
    return Array.from(new Set(reasons));
  }

  const REPORT_CAPS = { well: 3, improve: 2, note: 160, better: 700, expr: 3, one: 180, polish: 2, psaid: 160, pbetter: 220, pwhy: 160 };

  function reportPrompt(ctx, ev, comp) {
    const made = moveIds(comp).filter(id => ev.moves[id]);
    const missed = moveIds(comp).filter(id => !ev.moves[id]);
    const lbl = id => (moveOf(comp, id) || {}).label || id;
    const moves = ctx.targetMoves.map(m => `${m.id} (${m.label}) — ${m.hint}`).join("\n");
    const bank = ((comp && comp.expressions) || []).slice(0, 8).map(e => `"${e.w}" — ${e.def || e.move || ""}`).join("\n");
    return `You are a speaking coach reviewing ONE short workplace answer in English.

THE TASK
${ctx.prompt}
A good answer makes ${ctx.targetMoves.length} communication moves, in this shape: ${ctx.pattern}

THE MOVES
${moves}

THE SCORER'S VERDICT (deterministic, from the transcript — this is the truth you work from)
Credited: ${made.length ? made.map(id => `${id} (${lbl(id)})`).join(", ") : "none"}
Not heard: ${missed.length ? missed.map(id => `${id} (${lbl(id)})`).join(", ") : "none"}
${ctx.currentWeakness ? `Recurring weak move: ${ctx.currentWeakness}` : ""}

USEFUL EXPRESSIONS FOR THIS TASK (pick from these, or from words the learner used)
${bank}

WHAT TO DO
Read the transcript. Write a short report as JSON:
- "covered": move ids the learner GENUINELY made in their own words that the
  scorer did not credit. Only additions; never remove a credited move.
- "well": up to ${REPORT_CAPS.well} entries {"move": id, "note": one sentence}.
  Each note explains why that CREDITED move worked. Never praise a move from
  the "Not heard" list.
- "improve": up to ${REPORT_CAPS.improve} entries {"move": id, "note": one
  sentence}. Only moves from the "Not heard" list; say what was missing and
  how to add it. If everything was credited, coach the weak move or delivery.
- "better": the learner's SAME answer, improved. Keep their meaning, their
  facts and their level; at most 70 words; natural spoken English, not an
  essay. Never add facts they did not say. You may improve grammar, sentence
  structure, vocabulary, naturalness, register and clarity — nothing else.
  Do NOT add any request, question, action, commitment, number, date,
  deadline, person, organisation or claim the learner did not say. A move
  from the "Not heard" list stays missing here: coach it in "improve", never
  write it into the better version for them. If they asked for nothing, the
  better version asks for nothing. Every sentence must be one they could
  recognise as their own.
- "expressions": up to ${REPORT_CAPS.expr} entries {"e": expression, "why":
  when it helps here, under 15 words}.
- "one": ONE actionable focus for next time, under 25 words, imperative.
- "polish": up to ${REPORT_CAPS.polish} entries {"said": the learner's EXACT
  words quoted from the transcript, "better": a more natural, professional
  way to say the same thing in THIS situation, "why": one plain sentence}.
  Only where the rewording MATERIALLY improves clarity, naturalness,
  professional register, sentence structure or word choice for this task.
  Keep the learner's meaning and facts — no new numbers, dates, names,
  requests or actions. If their language is already
  natural and professional, return an empty list — never correct a minor
  slip for its own sake, and never call awkward but clear English "wrong".

RULES
- The scorer's verdict is final. Explain it; never contradict it.
- Never comment on accent, and never compare them to a native speaker.
- Never correct grammar unless it stopped you understanding the message.
- No scores, no percentages, no letter grades.
- Plain British English, spoken register.

Return JSON only:
{"covered":[],"well":[{"move":"","note":""}],"improve":[{"move":"","note":""}],"better":"","expressions":[{"e":"","why":""}],"one":"","polish":[{"said":"","better":"","why":""}]}`;
  }

  /* Validate the model's report against the evidence. Called AFTER
     applyCoachMoves, so "credited" already includes anything the model added
     through `covered` — an entry it praised and covered in the same reply
     stays, one it praised without covering is dropped. Null raw (offline, a
     refusal, bad JSON) produces the honest deterministic report. */
  function shapeReport(raw, comp, ev) {
    const made = moveIds(comp).filter(id => ev.moves[id]);
    const missed = moveIds(comp).filter(id => !ev.moves[id]);
    const lbl = id => (moveOf(comp, id) || {}).label || id;
    const str = (v, n) => (typeof v === "string" && v.trim()) ? v.replace(/\s+/g, " ").trim().slice(0, n) : "";
    const weak = weakestMove(comp, ev, []);
    const wm = weak ? moveOf(comp, weak) : null;

    const out = { well: [], improve: [], better: null, expr: [], one: "", polish: [], ai: false };

    if (raw && typeof raw === "object") {
      (Array.isArray(raw.well) ? raw.well : []).forEach(x => {
        if (!x || out.well.length >= REPORT_CAPS.well) return;
        const id = str(x.move, 64), note = str(x.note, REPORT_CAPS.note);
        if (id && note && made.includes(id) && !out.well.some(y => y.move === id)) out.well.push({ move: id, label: lbl(id), note });
      });
      (Array.isArray(raw.improve) ? raw.improve : []).forEach(x => {
        if (!x || out.improve.length >= REPORT_CAPS.improve) return;
        const id = str(x.move, 64), note = str(x.note, REPORT_CAPS.note);
        /* a missed move, or — when everything landed — the recurring weakness */
        if (id && note && (missed.includes(id) || (!missed.length && id === weak)) && !out.improve.some(y => y.move === id)) out.improve.push({ move: id, label: lbl(id), note });
      });
      const b = str(raw.better, REPORT_CAPS.better);
      /* FACTUAL GROUNDING: a better version that adds a number, a date, a
         name, a request or a clause the learner never said is not shown.
         No fallback is written in its place (see groundCheck). The reasons
         ride on the ephemeral report for tests and the console only —
         attachReport never stores them. */
      const bank = ((comp && comp.expressions) || []).map(e => e && e.w).filter(Boolean);
      const why = b ? groundCheck(b, ev.said, { bank }) : [];
      if (why.length) out.betterBlocked = why;
      out.better = b.split(/\s+/).length >= 5 && !why.length ? b : null;
      (Array.isArray(raw.expressions) ? raw.expressions : []).forEach(x => {
        if (!x || out.expr.length >= REPORT_CAPS.expr) return;
        const e = str(x.e, 60), why = str(x.why, 140);
        if (e) out.expr.push({ e, why });
      });
      out.one = str(raw.one, REPORT_CAPS.one);
      /* LANGUAGE POLISH — coaching only, and only on words the learner
         actually spoke: an entry whose "said" is not found in the transcript
         is dropped (the model may not put words in the learner's mouth), and
         a rewrite that changes nothing is dropped (no correction for its own
         sake). The transcript is ev.said; a caller with no transcript gets
         no polish rather than unverifiable polish. Deliberately NO
         deterministic floor here — like the better version, polish cannot be
         written without the model, so an empty list means "nothing worth
         changing", never "we made something up". */
      const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9À-ɏ']+/gi, " ").trim();
      const spoken = norm(ev.said);
      (Array.isArray(raw.polish) ? raw.polish : []).forEach(x => {
        if (!x || out.polish.length >= REPORT_CAPS.polish) return;
        const said = str(x.said, REPORT_CAPS.psaid), better = str(x.better, REPORT_CAPS.pbetter), why = str(x.why, REPORT_CAPS.pwhy);
        if (!said || !better) return;
        if (!spoken || spoken.indexOf(norm(said)) < 0) return;
        if (norm(better) === norm(said)) return;
        /* a rewording may change the words, never the facts: same number,
           date, name and request rules as the better version (the clause
           rule is off — replacing the words is what polish is for) */
        if (groundCheck(better, ev.said, { clauses: false }).length) return;
        out.polish.push({ said, better, why });
      });
      out.ai = !!(out.well.length || out.improve.length || out.better || out.one || out.polish.length);
    }

    /* Deterministic floor: the report is never empty. Missing moves are named
       from the rubric, expressions come from the same picker the vocabulary
       store uses, and the focus is the weak move's own retry line. */
    if (!out.improve.length) {
      (missed.length ? (weak && missed.includes(weak) ? [weak].concat(missed.filter(id => id !== weak)) : missed) : [])
        .slice(0, REPORT_CAPS.improve)
        .forEach(id => { const m = moveOf(comp, id); out.improve.push({ move: id, label: lbl(id), note: (m && m.hint) || "" }); });
    }
    if (!out.expr.length) {
      expressionsToLearn(comp, ev, weak).slice(0, REPORT_CAPS.expr).forEach(e => out.expr.push({ e: e.w, why: e.def || "" }));
    }
    if (!out.one) out.one = wm ? wm.retry : `Say it again, one short sentence for each of the ${moveIds(comp).length} moves.`;
    return out;
  }

  /* Persist the report onto the attempt row it belongs to — found by the same
     idempotency key the attempt was written under, so the offline-recovery
     path UPDATES the row instead of duplicating anything, and a report can
     never attach to speech it was not about. Compact on purpose: anchors and
     short strings, never the transcript, never the raw model output. */
  function attachReport(store, id, key, report, area) {
    if (!guard(area) || !key || !report) return null;
    const r = (store || {})[id];
    const row = r && (r.attempts || []).find(x => x && x.key === key);
    if (!row) return null;
    row.report = {
      well: (report.well || []).slice(0, REPORT_CAPS.well).map(x => ({ m: x.move, n: String(x.note || "").slice(0, REPORT_CAPS.note) })),
      fix: (report.improve || []).slice(0, REPORT_CAPS.improve).map(x => ({ m: x.move, n: String(x.note || "").slice(0, REPORT_CAPS.note) })),
      better: report.better ? String(report.better).slice(0, REPORT_CAPS.better) : null,
      expr: (report.expr || []).slice(0, REPORT_CAPS.expr).map(x => ({ e: String(x.e || "").slice(0, 60), why: String(x.why || "").slice(0, 140) })),
      one: String(report.one || "").slice(0, REPORT_CAPS.one),
      ai: !!report.ai,
      at: Date.now(),
    };
    /* language polish rides only when the model found something worth
       changing — it is the learner's own words, so the sync payload strips
       it exactly as it strips `better` */
    if (report.polish && report.polish.length) row.report.pol = report.polish.slice(0, REPORT_CAPS.polish)
      .map(x => ({ s: String(x.said || "").slice(0, REPORT_CAPS.psaid), b: String(x.better || "").slice(0, REPORT_CAPS.pbetter), w: String(x.why || "").slice(0, REPORT_CAPS.pwhy) }));
    return row;
  }

  /* A report stored before the grounding check existed may carry a better
     version that invents facts. Where the transcript is on this device the
     same check runs again at read time, so an old invention is never shown or
     spoken from the history; the stored row is left untouched. Without a
     transcript (another device) the better version and polish were stripped
     by the sync payload anyway. */
  function groundedReport(rep, said, comp) {
    if (!rep || !said) return rep || null;
    const bank = ((comp && comp.expressions) || []).map(e => e && e.w).filter(Boolean);
    let out = rep;
    if (rep.better && groundCheck(rep.better, said, { bank }).length) out = Object.assign({}, out, { better: null });
    if (rep.pol && rep.pol.length) {
      const pol = rep.pol.filter(x => x && !groundCheck(x.b, said, { clauses: false }).length);
      if (pol.length !== rep.pol.length) { out = Object.assign({}, out); if (pol.length) out.pol = pol; else delete out.pol; }
    }
    return out;
  }

  /* ONE ATTEMPT, TWO COPIES — the cloud merge rule.
     The sync payload deliberately strips the learner's words from every
     attempt (`said`, the report's `better`, the language polish `pol`), so
     the cloud copy of an attempt is always the POORER copy of the same
     record. Picking a side by position therefore threw the device's own
     transcript and better version away on every pull. Instead the two
     copies are merged field by field:
       evidence  — the copy whose coaching finished (coachPending false) is
                   the later state of the same attempt, so it leads;
       private   — said / pron are kept from whichever copy has them;
       report    — an AI report is never replaced by the offline floor,
                   whatever its timestamp; otherwise the later report (`at`)
                   leads. Either way a better version or polish missing from
                   the leading copy is taken from the other: both copies are
                   about the same spoken answer, and a missing field is far
                   more often the sync payload's stripping than a model that
                   had nothing to say. A later but poorer copy therefore
                   cannot erase learner-facing data.
     Nothing here can resurrect data the learner deleted: sign-out and
     account deletion wipe the device before any merge runs. */
  function mergeReport(c, l) {
    if (!c) return l || null;
    if (!l) return c;
    let lead = l, other = c;                              /* equal `at`: the device leads */
    if (!!c.ai !== !!l.ai) { if (c.ai) { lead = c; other = l; } }
    else if ((c.at || 0) > (l.at || 0)) { lead = c; other = l; }
    const out = Object.assign({}, other, lead);
    out.better = lead.better || other.better || null;
    const pol = (lead.pol && lead.pol.length) ? lead.pol : other.pol;
    if (pol && pol.length) out.pol = pol; else delete out.pol;
    return out;
  }
  function mergeAttempt(c, l) {
    if (!c) return l || null;
    if (!l) return c;
    const out = (!c.coachPending && l.coachPending) ? Object.assign({}, l, c) : Object.assign({}, c, l);
    if (!out.said && (l.said || c.said)) out.said = l.said || c.said;
    if (out.pron == null && (l.pron != null || c.pron != null)) out.pron = l.pron != null ? l.pron : c.pron;
    const rep = mergeReport(c.report, l.report);
    if (rep) out.report = rep; else delete out.report;
    return out;
  }

  /* The learning history, oldest week first, newest attempt first inside a
     week: every spoken attempt with its evidence and (when one was written)
     its report. A flat list of plain objects so the history screen renders it
     without learning what a mission is — the same bargain progressSummary
     already makes with the Passport. */
  function history(get, comps) {
    const out = [];
    (comps || []).slice().sort((a, b) => (a.week || 0) - (b.week || 0)).forEach(c => {
      const r = (get && get(c.id)) || null;
      ((r && r.attempts) || []).filter(a => a && a.answered).forEach(a => {
        out.push({
          competency: c.id, week: c.week || null, title: c.title || "",
          missionId: a.missionId, kind: a.kind, key: a.key, at: a.at,
          passed: !!a.passed, moves: a.moves || {}, state: (r && r.state) || "NOT_STARTED",
          report: groundedReport(a.report, a.said, c),
        });
      });
    });
    return out.sort((a, b) => (a.week || 0) - (b.week || 0) || (b.at || 0) - (a.at || 0));
  }

  /* ------------------------------------------------- automatic word handling
     The audit's finding was that a learner taps Save on every word. Here the
     system decides: expressions they USED are worth spacing so they stick, and
     the expressions belonging to the move they MISSED are worth meeting. The
     caller does the storing; this only says which, and why. */
  function expressionsToLearn(comp, ev, weak) {
    const all = (comp && comp.expressions) || [];
    const used = new Set((ev && ev.vocabUsed) || []);
    const out = [];
    all.forEach(e => { if (used.has(e.w)) out.push(Object.assign({ why: "used" }, e)); });
    if (weak) all.forEach(e => { if (e.move === weak && !used.has(e.w)) out.push(Object.assign({ why: "missing" }, e)); });
    return out.slice(0, 5);
  }

  const api = {
    TRACK, STATES, rank, MIN_WORDS, STRONG_COV, PASS_COV,
    competencyOf, missionOf, moveIds, moveOf, rubricFor,
    grade, applyCoachMoves, weakestMove, passes,
    blank, record, introduce, stateFrom, addAttempt, scheduleRetrieval, recommend,
    aiContext, coachPrompt, shapeCoach, expressionsToLearn, guard,
    reportPrompt, shapeReport, attachReport, history, REPORT_CAPS,
    groundCheck, groundedReport, mergeReport, mergeAttempt,
    EVIDENCE_VERSION, contract, fromShadow, addSupport, supportSummary, progressSummary,
    SHADOW_RUNGS, MAX_SUPPORT, ACTION_PRIORITY, pickNext,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.MissionEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
