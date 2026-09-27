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
  /* ======================= CONTENT RELATIONSHIPS =======================
     One light table relates everything the app can recommend: a topic is a set
     of title words plus the library category it lives in. A lesson, a clip, a
     phrase group or a trouble word is placed on the topics its own words hit,
     and "related" content is whatever shares those topics — never random, and
     deterministic (the same learner sees the same rows). Home's hero pictures
     use the same table (index.html: homeVisuals), so one relationship serves
     the pictures, the rows and the push nudges alike. */
  const TOPICS = [
    { id: "introductions", re: /introduc|yourself|first impression|role clarity|network|small talk/i, terms: ["introduc", "yourself", "first impression", "small talk", "network"], cat: "everyday" },
    { id: "pronunciation", re: /pronunc|shadow|stress|accent|speech|intonation|fluen|sound|rhythm|baseline/i, terms: ["pronunc", "accent", "shadow", "clear", "fluen", "intonation", "sound", "rhythm"], cat: "skills" },
    { id: "meetings", re: /meeting|agenda|stand-?up|interrupt|disagree|clarif|update|status|blocker|escalat/i, terms: ["meeting", "interrupt", "disagree", "agenda", "clarif", "update"], cat: "meetings" },
    { id: "presentations", re: /present|pitch|slide|summar|explain|leadership|executive/i, terms: ["present", "pitch", "explain", "summar", "leader"], cat: "presentations" },
    { id: "interviews", re: /interview|job|salary|strength|weakness|experience/i, terms: ["interview", "tell me about", "strength", "weakness", "salary"], cat: "interviews" },
    { id: "persuasion", re: /negotiat|persuad|recommend|decid|win support|push ?back|influence|stakeholder/i, terms: ["negotiat", "persuad", "recommend", "convinc", "influence"], cat: "meetings" },
    { id: "vocabulary", re: /\bwords?\b|vocab|phrase|idiom|expression/i, terms: ["vocabulary", "words", "phrases", "idiom", "expression"], cat: "skills" },
    { id: "conversation", re: /partner|conversation|coach|chat|question/i, terms: ["conversation", "small talk", "chat", "question"], cat: "everyday" },
  ];
  function topicsOf(text) { const t = String(text || ""); return TOPICS.filter(x => x.re.test(t)).map(x => x.id); }
  /* content.videos = { vid: { title, cat, dur, cap } } (the library index, category filled
     in by the caller). seed = { vid?, text?, topics? }. opts.challenge prefers clips
     with captions (the Challenge needs their lines); opts.exclude = vids to leave out. */
  function related(content, seed, opts) {
    const o = opts || {}, vids = (content && content.videos) || {}, ex = new Set(o.exclude || []);
    const sv = seed && seed.vid && vids[seed.vid] ? vids[seed.vid] : null;
    const text = [seed && seed.text, sv && sv.title].filter(Boolean).join(" ");
    const ids = (seed && seed.topics && seed.topics.length) ? seed.topics : topicsOf(text);
    const tops = TOPICS.filter(x => ids.includes(x.id)).slice(0, 2);
    if (!tops.length) return [];
    return Object.keys(vids).map((v, i) => {
      if (v === (seed && seed.vid) || ex.has(v)) return null;
      const x = vids[v], ti = String(x.title || "").toLowerCase(); let s = 0, hit = false;
      tops.forEach(tp => { tp.terms.forEach(w => { if (ti.includes(w)) { s += 3; hit = true; } }); if (x.cat === tp.cat) s += 1; });
      if (sv && sv.cat && x.cat === sv.cat) { s += 1; hit = hit || !!(o.sameCatOk); }
      if (o.challenge) { if (!x.cap) return null; if (x.cap === "human") s += 1; }
      if (x.dur && x.dur > 20 * 60) s -= 1;                  // a long lecture is a poor "next clip"
      return hit ? { vid: v, title: x.title || "", dur: x.dur || 0, cap: x.cap || null, s, i } : null;
    }).filter(Boolean).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, o.n || 3);
  }

  /* ========================= "BECAUSE YOU…" ROWS =========================
     Each row reads ONE piece of real evidence in s.recent and names it; a row
     with no evidence is not produced. At most three rows, three items each,
     every item a deep link nudgeGo already understands ({view, act, args}).
     Rows support the hero (the engine's best()), they never replace it. */
  const MAX_ROWS = 3;
  /* a clip title as a row heading quotes it: no leading emoji, cut at a word, at most ~56 characters */
  function clipTitle(t) {
    let x = String(t || "").replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/u, "").replace(/\s+/g, " ").trim();
    if (x.length > 56) { const cut = x.slice(0, 56).replace(/\s+\S*$/, ""); x = (cut.length >= 24 ? cut : x.slice(0, 56)).replace(/[\s,;:\-\u2014|&]+$/, "") + "\u2026"; }
    return x;
  }
  function item(o) { return Object.assign({ type: "video", title: "", dur: 0, view: "shadow", act: null, args: [], challenge: false, external: false }, o); }
  function vidItem(v, challenge) { return item({ type: challenge ? "challenge" : "video", vid: v.vid, title: v.title, dur: v.dur, view: "shadow", act: "clip", args: [v.vid], challenge: !!challenge, external: true }); }
  function rows(s, content) {
    if (!s || !s.ge) return [];                                 // General English only
    const R = s.recent || {}, now = s.now || Date.now(), out = [], seen = new Set(R.seen || []);
    const c = content || {}, weeks = c.weeks || [], pos = s.pos || null;
    const used = new Set();                                     // a clip is offered once across the rows
    const take = (list) => list.filter(v => !used.has(v.vid)).slice(0, 3).map(v => { used.add(v.vid); return v; });
    /* 1 · a Challenge passed in the last two weeks → three more clips at that level, opened in the Challenge */
    const cp = R.challengePassed;
    if (cp && cp.vid && now - (cp.ts || 0) <= 14 * DAY) {
      const vs = take(related(c, { vid: cp.vid, text: cp.title }, { challenge: true, exclude: [...seen], n: 6 }));
      if (vs.length >= 2) out.push({ id: "challenge_done", reason: "challenge_passed", vars: { title: clipTitle(cp.title) }, seed: cp.vid, items: vs.map(v => vidItem(v, true)) });
    }
    /* 2 · a clip actually shadowed (a recorded take) or opened in the last month → clips on the same subject */
    const sh = R.shadowed;
    if (sh && sh.vid && now - (sh.ts || 0) <= 30 * DAY && !(cp && cp.vid === sh.vid && out.length)) {
      const vs = take(related(c, { vid: sh.vid, text: sh.title }, { exclude: [...seen], n: 6 }));
      if (vs.length >= 2) out.push({ id: sh.recorded ? "shadowed" : "opened", reason: sh.recorded ? "clip_shadowed" : "clip_opened", vars: { title: clipTitle(sh.title) }, seed: sh.vid, items: vs.map(v => vidItem(v, false)) });
    }
    /* 3 · trouble words on record → hear them in real speech, drill them, review the words due */
    const tw = (s.troubleWords || []).filter(Boolean).slice(0, 3);
    if (tw.length && out.length < MAX_ROWS) {
      const items = [item({ type: "trouble", view: "shadow", act: "trouble", title: "" })];
      if ((s.wordsReady || 0) >= 1) items.push(item({ type: "words", view: "practice", act: "study-due", n: s.wordsReady }));
      take(related(c, { topics: ["pronunciation"] }, { exclude: [...seen], n: 4 })).slice(0, 3 - items.length).forEach(v => items.push(vidItem(v, false)));
      out.push({ id: "trouble", reason: "trouble_words_" + Math.min(tw.length, 9), vars: { words: tw.map(w => "\u201c" + w + "\u201d").join(", "), n: tw.length }, items });
    }
    /* 4 · a whole week done → the next session on the road map, a clip on its theme, a partner on the topic */
    const wd = R.weekDone;
    if (wd && pos && pos.w > wd && out.length < MAX_ROWS) {
      const wk = weeks.find(x => x.n === pos.w) || {}, items = [];
      if (!pos.done) items.push(item({ type: "session", view: "session", args: [pos.w, pos.d], w: pos.w, d: pos.d, title: (wk.days && wk.days[pos.d] && wk.days[pos.d].focus) || wk.theme || "" }));
      const p = s.partner || {}, talk = p.available ? item({ type: "partner", view: "partner", act: "match", title: "" }) : (p.consented && s.aiCoach ? item({ type: "ai", view: "partner", act: "ai", title: "" }) : null);
      take(related(c, { text: [wk.theme, wk.goal].join(" ") }, { exclude: [...seen], n: 4 })).slice(0, 3 - items.length - (talk ? 1 : 0)).forEach(v => items.push(vidItem(v, false)));
      if (talk) items.push(talk);
      if (items.length >= 2) out.push({ id: "week_done", reason: "week_done_" + wd, vars: { n: wd, next: pos.w, theme: String(wk.theme || "").slice(0, 60) }, items: items.slice(0, 3) });
    }
    /* 5 · expressions mastered in Phrase Lab → use them, and clips full of them */
    if ((R.phrasesMastered || 0) >= 3 && out.length < MAX_ROWS) {
      const items = [item({ type: "phrases", view: "phrases", title: "", n: R.phrasesMastered })];
      take(related(c, { topics: ["vocabulary"] }, { exclude: [...seen], n: 4 })).slice(0, 2).forEach(v => items.push(vidItem(v, false)));
      out.push({ id: "phrases", reason: "phrases_mastered_" + Math.min(R.phrasesMastered, 99), vars: { n: R.phrasesMastered }, items });
    }
    /* 6 · a partner session this week → keep the conversation going */
    if (R.partnerAt && now - R.partnerAt <= 7 * DAY && out.length < MAX_ROWS) {
      const p = s.partner || {}, items = [];
      if (p.available) items.push(item({ type: "partner", view: "partner", act: "match", title: "" }));
      if (p.consented && s.aiCoach) items.push(item({ type: "ai", view: "partner", act: "ai", title: "" }));
      take(related(c, { topics: ["conversation"] }, { exclude: [...seen], n: 4 })).slice(0, 3 - items.length).forEach(v => items.push(vidItem(v, false)));
      if (items.length >= 2) out.push({ id: "partner_done", reason: "partner_recent", vars: {}, items });
    }
    /* 0 · no history at all → curriculum discovery, never a "because you" */
    if (!out.length && pos && pos.w === 1 && !R.shadowed && !R.challengePassed && !tw.length && !R.weekDone) {
      const wk = weeks.find(x => x.n === 1) || {}, items = [];
      if (!pos.done) items.push(item({ type: "session", view: "session", args: [1, pos.d], w: 1, d: pos.d, title: (wk.days && wk.days[pos.d] && wk.days[pos.d].focus) || wk.theme || "" }));
      const st = (c.starters || []).filter(x => x && x.vid && x.cap)[0];
      if (st) items.push(vidItem({ vid: st.vid, title: st.name || "", dur: 0 }, false));
      take(related(c, { topics: ["introductions"] }, { n: 3 })).slice(0, 3 - items.length).forEach(v => items.push(vidItem(v, false)));
      if (items.length >= 2) out.push({ id: "start", reason: "new_learner", vars: { theme: String(wk.theme || "").slice(0, 60) }, items });
    }
    return out.slice(0, MAX_ROWS).map(r => Object.assign(r, { items: r.items.slice(0, 3) }));
  }

  const api = { candidates, rank, best, satisfied, KINDS, KIND_COOLDOWN, DISMISS_COOLDOWN, TOPICS, topicsOf, related, rows, clipTitle };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.NudgeEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
