/* ============================================================================
   BE Mastery — Nudge Engine (Personalised Learning Nudges, General English)
   --------------------------------------------------------------------------
   Learner state → ranked recommendations → the best next action. The engine
   CHOOSES the action; wording comes from fixed i18n templates filled with the
   learner's own numbers (never free AI text), and every recommendation points
   at an activity that exists: today's lesson, words due, a Shadow Challenge
   clip, trouble words in Shadow, Practice Partner, or the AI coach.

   Pure: no DOM, no storage, no network. index.html gathers the signals from
   the existing learner state (nudgeSignals) and schedules the winner through
   be-push. Same input → same output, so it is unit-tested in Node
   (tests/nudge-engine.test.mjs).
   ============================================================================ */
(function (global) {
  const H = 3_600_000, DAY = 24 * H;
  /* how long after a notification of a kind before that kind may come again,
     and how long a swipe-away silences it — mirrored by be-push, which is the
     authority (the device may be offline or wiped) */
  const KIND_COOLDOWN = 48 * H, DISMISS_COOLDOWN = 7 * DAY;
  const KINDS = ["lesson", "comeback", "words", "challenge", "shadow", "partner_now", "partner_streak", "ai_coach"];

  function rec(o) {
    return Object.assign({ confidence: 0.8, minutes: 5, expiresInMs: DAY, delayMs: null, args: [], act: null, curriculum: null }, o);
  }
  /* every rule reads only what the learner actually did; a rule with no
     evidence produces nothing */
  function candidates(s) {
    const out = [];
    if (!s || !s.ge) return out;                       // General English only
    const pos = s.pos || null;
    if (pos && !pos.done && !s.practicedToday) {
      const back = (s.daysAway || 0) >= 3;
      out.push(rec({
        kind: back ? "comeback" : "lesson", reason: back ? "inactive_" + Math.min(s.daysAway, 30) + "d" : "lesson_pending",
        skill: "communication", activity: "session", view: "session", args: [pos.w, pos.d],
        curriculum: { week: pos.w, day: pos.d, topic: pos.topic || "" },
        priority: back ? 78 : 70, confidence: 0.9, minutes: back ? 5 : 25,
        vars: { w: pos.w, topic: pos.topic || "", min: back ? 5 : 25 },
      }));
    }
    if ((s.wordsReady || 0) >= 3) {
      const n = s.wordsReady;
      out.push(rec({ kind: "words", reason: "words_due_" + Math.min(n, 99), skill: "vocabulary", activity: "vocab_review", view: "practice", act: "study-due",
        priority: 55 + Math.min(n, 15), confidence: 0.95, minutes: Math.max(3, Math.ceil(n / 2)), vars: { n, min: Math.max(3, Math.ceil(n / 2)) } }));
    }
    const ch = s.challenge;
    if (ch && !ch.pass && ch.vid && s.now - (ch.ts || 0) <= 7 * DAY) {
      out.push(rec({ kind: "challenge", reason: "challenge_not_passed", skill: "pronunciation", activity: "shadow_challenge", view: "shadow", act: "clip", args: [ch.vid],
        priority: 65, confidence: 0.8, minutes: 5, vars: { title: String(ch.title || "").slice(0, 40) } }));
    }
    if ((s.trouble || 0) >= 3) {
      out.push(rec({ kind: "shadow", reason: "trouble_words_" + Math.min(s.trouble, 99), skill: "pronunciation", activity: "shadow", view: "shadow", act: "trouble",
        priority: 50, confidence: 0.85, minutes: 5, vars: { n: s.trouble } }));
    }
    const p = s.partner || {};
    if (p.available && (p.waiting || 0) >= 1) {
      out.push(rec({ kind: "partner_now", reason: "partner_waiting_" + Math.min(p.waiting, 9), skill: "communication", activity: "practice_partner", view: "partner", act: "match",
        priority: 75, confidence: Math.min(0.9, 0.5 + 0.1 * p.waiting), minutes: 5, expiresInMs: 90 * 60_000, delayMs: 10 * 60_000, vars: {} }));
    }
    if (p.available && p.streakWeeks >= 2 && !p.practisedThisWeek) {
      out.push(rec({ kind: "partner_streak", reason: "streak_at_risk_" + p.streakWeeks + "w", skill: "communication", activity: "practice_partner", view: "partner",
        priority: 72, confidence: 0.85, minutes: 10, expiresInMs: 36 * H, vars: { n: p.streakWeeks } }));
    }
    if (p.consented && s.aiCoach && !(p.waiting > 0) && (p.daysSincePartner == null || p.daysSincePartner >= 3)) {
      out.push(rec({ kind: "ai_coach", reason: "no_partner_" + (p.daysSincePartner == null ? "never" : Math.min(p.daysSincePartner, 30) + "d"), skill: "communication", activity: "ai_coach", view: "partner", act: "ai",
        priority: 45, confidence: 0.7, minutes: 5, vars: {} }));
    }
    return out;
  }
  /* rank: priority × confidence, + 15 when it trains the weakest competency,
     + 8 for a short action after three days away; minus what the learner was
     just sent, swiped away, or has already done today */
  function rank(s, hist) {
    const h = hist || {}, now = s && s.now || Date.now();
    return candidates(s).filter(r => {
      if (h.sent && h.sent[r.kind] && now - h.sent[r.kind] < KIND_COOLDOWN) return false;
      if (h.dismissed && h.dismissed[r.kind] && now - h.dismissed[r.kind] < DISMISS_COOLDOWN) return false;
      if (h.done && h.done[r.kind] && now - h.done[r.kind] < DAY) return false;
      return true;
    }).map(r => Object.assign(r, { score: r.priority * r.confidence + (s.weakest && r.skill === s.weakest ? 15 : 0) + ((s.daysAway || 0) >= 3 && r.minutes <= 10 ? 8 : 0) }))
      .sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind));
  }
  function best(s, hist) {
    const r = rank(s, hist)[0];
    if (!r) return null;
    const day = new Date(s.now).toISOString().slice(0, 10);
    r.rid = (r.kind + "-" + day + "-" + (r.args.join("-") || "x")).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
    r.messageKey = "nudge." + r.kind;
    return r;
  }
  /* completed-action invalidation: has the learner already done what this
     recommendation asked for? Read from fresh signals, never from the record */
  function satisfied(r, s) {
    if (!r || !s) return false;
    switch (r.kind) {
      case "lesson": case "comeback": return !!s.practicedToday || !s.pos || s.pos.done || s.pos.w !== r.args[0] || s.pos.d !== r.args[1];
      case "words": return (s.wordsReady || 0) < 3;
      case "challenge": return !s.challenge || s.challenge.vid !== r.args[0] || !!s.challenge.pass;
      case "shadow": return (s.trouble || 0) < 3;
      case "partner_now": return !(s.partner && s.partner.available && s.partner.waiting >= 1);
      case "partner_streak": return !!(s.partner && s.partner.practisedThisWeek);
      case "ai_coach": return !!(s.partner && s.partner.daysSincePartner === 0);
      default: return true;
    }
  }
  const api = { candidates, rank, best, satisfied, KINDS, KIND_COOLDOWN, DISMISS_COOLDOWN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.NudgeEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
