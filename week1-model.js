/* ============================================================================
   BE Mastery — Week 1 Pronunciation Baseline: the model introduction. PURE, no DOM.

   The lesson (index.html, the dlp* block) records the learner's UNCOACHED introduction first. Only
   then does it reveal one model introduction, chosen by WeekPick from the onboarding profile, which
   the learner shadows 6-8 times before recording their own introduction again.

   This file holds the decisions so they can be tested without a browser: which clips are candidates,
   what is frozen and stored, what a playback failure does, and what the learner may do next. It never
   reads S, never touches the page, never calls a model.

   THREE RULES THE CALLER MUST KEEP, each learned the hard way:
   1. FREEZE ONCE. freeze() runs after the baseline take and its result is stored. Re-running it for an
      attempt that has recorded anything would re-read a profile that may have changed, and the clip
      would move under the learner. The lesson's shadow records are keyed by ordinal, so a reordered
      list would also re-point every stored shadow at a clip it was never recorded against.
   2. THE ASSIGNMENT IS WRITE-ONCE AND LIVES OUTSIDE THE ATTEMPT (S.dlpAssign["general:w1"]).
      "Do this day again" mints a fresh attempt with empty stepData; Week 12 must still find the clip
      the learner recorded against. A restart therefore REBUILDS the model from the stored assignment
      and never re-selects.
   3. A MISSING OR BROKEN CLIP IS NEVER A DEAD END. An empty catalogue, a clip whose captions will not
      load and a clip whose player fails each leave the baseline take usable and the lesson able to
      advance. The model block is an addition to the Try step; it gates nothing.
   ============================================================================ */
(function (global) {
  "use strict";

  var MIN_SHADOWS = 6, MAX_SHADOWS = 8, KEEP = 3;

  function str(x) { return typeof x === "string" ? x : ""; }
  function arr(x) { return Object.prototype.toString.call(x) === "[object Array]" ? x : []; }

  /* An approved model entry has the SAME shape as a tracks/general/clip-index.json passage — vid, from,
     to, startMs, endMs, seconds, words, sentences, text — plus the tags WeekPick ranks on. Building it
     from the bundled captions is a build step (scripts/shadow/build-week1-models.mjs); nothing here
     invents a transcript. A passage without text cannot drive the shadow step, so it is not one. */
  function passageOf(e) {
    if (!e || !/^[A-Za-z0-9_-]{11}$/.test(str(e.vid)) || !str(e.text)) return null;
    if (typeof e.startMs !== "number" || typeof e.endMs !== "number" || !(e.endMs > e.startMs)) return null;
    return { vid: e.vid, title: str(e.title), match: "model", para: 0, of: 1,
      from: e.from, to: e.to, startMs: e.startMs, endMs: e.endMs, seconds: e.seconds,
      sentences: e.sentences, words: e.words, text: e.text, wordTimes: !!e.wordTimes,
      fixture: !!e.fixture };
  }

  /* models.json -> WeekPick pool items. Only an entry that yields a passage becomes a candidate. */
  function poolOf(models, WP) {
    var P = WP || global.WeekPick;
    return arr(models && models.clips).map(function (e) {
      var p = passageOf(e); if (!p) return null;
      var it = P.fromClipIndex(1, e); if (!it) return null;
      it.source = "model"; it.editorial = str(e.editorial) || "pending";
      it.role = str(e.role) || null; it.roleGroup = str(e.roleGroup) || null;
      it.industries = arr(e.industries); it.situations = arr(e.situations);
      it.passage = p; it.fixture = !!e.fixture;
      return it;
    }).filter(Boolean);
  }

  function slim(r) { return { key: r.key, id: r.id, start: r.start, end: r.end, tier: r.tier, why: r.why, wpm: r.wpm, fixture: !!r.fixture }; }

  /* freeze(profile, pool, assignment, now) -> { assign, model }
       assign   the write-once record to store, or null when nothing was chosen / one already exists
       model    what the attempt stores in stepData.try.model */
  function freeze(profile, pool, assignment, now, WP) {
    var P = WP || global.WeekPick, items = arr(pool);
    var byKey = {}; items.forEach(function (c) { byKey[c.key] = c; });
    var r = P.choose(profile, 1, items);
    var snap = function (list) {
      var m = {}; list.forEach(function (x) { if (byKey[x.key] && byKey[x.key].passage) m[x.key] = byKey[x.key].passage; }); return m;
    };

    if (assignment && assignment.key) {
      /* a restart, or a second device: the stored assignment wins, and selection is not consulted */
      var asg = r.ranked.filter(function (x) { return x.key === assignment.key; })[0];
      if (!asg) return { assign: null, model: { unavailable: true, original: assignment, reason: "the clip assigned in Week 1 is no longer available",
        ranked: [], picked: -1, failed: [], passages: {}, frozenAt: now } };
      var rest = r.ranked.filter(function (x) { return x.key !== assignment.key; });
      var lst = [asg].concat(rest).slice(0, KEEP), slimmed = lst.map(slim);
      /* the assigned clip keeps the reason it was ASSIGNED for. Re-scoring it against today's profile would
         explain the same clip with a different reason — a doctor now, so "your situation" instead of "your
         profession" — which is a different story about the same video. */
      if (assignment.tier != null) slimmed[0].tier = assignment.tier;
      if (assignment.why) slimmed[0].why = assignment.why;
      return { assign: null, model: { ranked: slimmed, picked: 0, failed: [], passages: snap(lst), frozenAt: now, fromAssignment: true } };
    }
    if (!r.ranked.length) return { assign: null, model: { gap: true, ranked: [], picked: -1, failed: [], passages: {}, frozenAt: now,
      reason: r.candidates.length ? "no approved clip is ready" : "the approved catalogue is empty" } };
    var top = r.ranked.slice(0, KEEP), first = top[0];
    return { assign: { key: first.key, vid: first.id, start: first.start, end: first.end, at: now, src: "week-pick", tier: first.tier, why: first.why },
      model: { ranked: top.map(slim), picked: 0, failed: [], passages: snap(top), frozenAt: now } };
  }

  /* the clip on screen, from the FROZEN snapshot — never from the live catalogue */
  function current(model) {
    if (!model || model.picked == null || model.picked < 0) return null;
    var e = arr(model.ranked)[model.picked]; if (!e) return null;
    var p = model.passages && model.passages[e.key]; return p ? Object.assign({}, p, { key: e.key, tier: e.tier, why: e.why }) : null;
  }

  /* a clip that will not play (or whose captions will not load): move to the next one, keep everything else */
  function fail(model, key, reason) {
    if (!model || !arr(model.ranked).length) return model;
    var failed = arr(model.failed).concat([{ key: key, reason: str(reason) || "failed", at: 0 }]);
    var bad = {}; failed.forEach(function (f) { bad[f.key] = 1; });
    var next = -1;
    model.ranked.forEach(function (e, i) { if (next < 0 && !bad[e.key]) next = i; });
    return Object.assign({}, model, { failed: failed, picked: next, exhausted: next < 0 });
  }
  function alternatives(model) {
    if (!model) return 0;
    var bad = {}; arr(model.failed).forEach(function (f) { bad[f.key] = 1; });
    return arr(model.ranked).filter(function (e, i) { return i !== model.picked && !bad[e.key]; }).length;
  }

  /* What the learner may do next. `n` is the shadows recorded on the model passage; `hasBaseline` is the
     uncoached take. The model block never decides whether the lesson can continue. */
  function status(model, n, hasBaseline) {
    n = n || 0;
    if (!hasBaseline) return { phase: "baseline", reveal: false, canShadow: false, canRecordAfter: false };
    if (!model) return { phase: "preparing", reveal: false, canShadow: false, canRecordAfter: false };
    if (model.gap) return { phase: "empty", reveal: false, canShadow: false, canRecordAfter: false, reason: model.reason };
    if (model.unavailable) return { phase: "original-gone", reveal: false, canShadow: false, canRecordAfter: false, reason: model.reason };
    if (model.exhausted) return { phase: "exhausted", reveal: false, canShadow: false, canRecordAfter: false };
    return { phase: n >= MIN_SHADOWS ? "ready-for-second-take" : "shadowing", reveal: true, canShadow: true,
      canRecordAfter: n >= MIN_SHADOWS, shadows: n, min: MIN_SHADOWS, max: MAX_SHADOWS, atMax: n >= MAX_SHADOWS };
  }

  global.Week1Model = { passageOf: passageOf, poolOf: poolOf, freeze: freeze, current: current, fail: fail, alternatives: alternatives,
    status: status, MIN_SHADOWS: MIN_SHADOWS, MAX_SHADOWS: MAX_SHADOWS, KEEP: KEEP };
})(typeof globalThis !== "undefined" ? globalThis : this);
