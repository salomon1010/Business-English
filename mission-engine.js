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
     The competency is "give a CLEAR update" and its shape is four parts. An
     answer that states the status, names the issue and promises to follow up
     but never says what it means for Friday is the exact answer this whole
     mission exists to fix — and at three moves out of four it would have
     scored 0.75 and been called demonstrated. Coverage bands describe an
     answer; they do not decide whether someone can do the job. */
  const DEMONSTRATE_ALL = true;
  const FLUENT_WPM  = [70, 180];   // outside this band, delivery is what to fix
  const MAX_ATTEMPTS = 60;   // per competency, newest kept

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
  function addAttempt(store, id, attempt, area, intervals) {
    if (!guard(area)) return null;
    const r = record(store, id);
    const key = attempt && attempt.key;
    if (key && r.attempts.some(x => x && x.key === key)) {
      return { record: r, duplicate: true, attempt: r.attempts.find(x => x.key === key) };
    }
    const at = attempt.at || Date.now();
    const row = Object.assign({}, attempt, { at, tk: TRACK });
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
A good answer makes four communication moves, in this shape: ${ctx.pattern}

THE MOVES
${moves}
${prev}${weak}

WHAT TO DO
Read the transcript of what they said. Decide which of the four moves they
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
    out.retry = wm ? wm.retry : "Give the update again, keeping it under four sentences.";

    if (raw && typeof raw.reply === "string" && raw.reply.trim()) {
      out.improve = raw.reply.trim().slice(0, 240);
      out.ai = true;
    }
    return out;
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
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.MissionEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
