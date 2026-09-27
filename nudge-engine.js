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
     phrase group, a scenario or a trouble word is placed on the topics its own
     words hit, and "related" content is whatever shares those topics, that
     category or that channel — never random, and deterministic (the same
     learner sees the same rows). Home's hero pictures use the same table
     (index.html: homeVisuals), so one relationship serves the pictures, the
     rows and the push nudges alike. */
  const TOPICS = [
    { id: "introductions", re: /introduc|yourself|first impression|role clarity|network|small talk/i, terms: ["introduc", "yourself", "first impression", "small talk", "network"], cat: "everyday", scen: ["iv-tellme", "neighbour"] },
    { id: "pronunciation", re: /pronunc|shadow|stress|accent|speech|intonation|sound|rhythm|baseline|delivery/i, terms: ["pronunc", "accent", "shadow", "clear", "intonation", "sound", "rhythm", "stress"], cat: "skills", scen: [] },
    { id: "fluency", re: /fluen|rambl|organi[sz]e|hesitat|filler|confiden|think in english|long-form|listening|comprehension/i, terms: ["fluen", "rambl", "organi", "hesitat", "filler", "confiden", "listening", "comprehension", "think in english"], cat: "skills", scen: [] },
    { id: "meetings", re: /meeting|agenda|stand-?up|interrupt|disagree|clarif|update|status|blocker|escalat|sprint|coordinat|problem/i, terms: ["meeting", "interrupt", "disagree", "agenda", "clarif", "update", "blocker", "problem", "stand-up", "standup"], cat: "meetings", scen: ["standup", "oneone"] },
    { id: "presentations", re: /present|pitch|slide|summar|explain|leadership|executive|technical/i, terms: ["present", "pitch", "explain", "summar", "leader", "executive", "structure"], cat: "presentations", scen: ["oneone"] },
    { id: "interviews", re: /interview|job|salary|strength|weakness|experience|hiring/i, terms: ["interview", "tell me about", "strength", "weakness", "salary", "hiring", "job"], cat: "interviews", scen: ["interview", "iv-weakness", "iv-conflict"] },
    { id: "persuasion", re: /negotiat|persuad|recommend|decid|win support|push ?back|influence|stakeholder/i, terms: ["negotiat", "persuad", "recommend", "convinc", "influence", "decision"], cat: "meetings", scen: ["iv-salary", "oneone"] },
    { id: "vocabulary", re: /\bwords?\b|vocab|phrase|idiom|expression/i, terms: ["vocabulary", "words", "phrases", "idiom", "expression"], cat: "skills", scen: [] },
    { id: "conversation", re: /partner|conversation|coach|chat|question|talk/i, terms: ["conversation", "small talk", "chat", "question", "talk"], cat: "everyday", scen: ["coffee", "neighbour", "oneone"] },
    /* the story clips ("Learn English with TOY STORY …"): reachable from the everyday
       category and from each other, never from a meeting seed */
    { id: "story", re: /learn english with|tv series|movie|film|disney|pixar|netflix|cartoon|animated/i, terms: ["learn english with", "movie", "disney", "netflix", "film"], cat: "everyday", scen: ["coffee", "neighbour"] },
  ];
  function topicsOf(text) { const t = String(text || ""); return TOPICS.filter(x => x.re.test(t)).map(x => x.id); }
  /* content.videos = { vid: { title, cat, dur, cap, ch } } (the library index, category filled
     in by the caller). seed = { vid?, text?, topics? }. A candidate is related when it shares a
     topic word, the seed's category or the seed's channel — never on nothing. opts.challenge
     keeps clips with captions (the Challenge needs their lines); opts.exclude = vids to leave
     out; opts.short prefers clips under six minutes (a comeback, a first clip). */
  function related(content, seed, opts) {
    const o = opts || {}, vids = (content && content.videos) || {}, ex = new Set(o.exclude || []);
    const sv = seed && seed.vid && vids[seed.vid] ? vids[seed.vid] : null;
    const text = [seed && seed.text, sv && sv.title].filter(Boolean).join(" ");
    const ids = (seed && seed.topics && seed.topics.length) ? seed.topics : topicsOf(text);
    const tops = TOPICS.filter(x => ids.includes(x.id)).slice(0, 2);
    if (!tops.length && !sv) return [];
    const si = sv ? Object.keys(vids).indexOf(seed.vid) : 0;
    return Object.keys(vids).map((v, i) => {
      if (v === (seed && seed.vid) || ex.has(v)) return null;
      const x = vids[v], ti = String(x.title || "").toLowerCase(); let s = 0, hit = false;
      tops.forEach(tp => { tp.terms.forEach(w => { if (ti.includes(w)) { s += 3; hit = true; } }); if (x.cat === tp.cat) { s += 1; hit = true; } });
      if (sv) { if (sv.cat && x.cat === sv.cat) { s += 2; hit = true; } if (sv.ch && x.ch === sv.ch) { s += 3; hit = true; } }
      if (o.challenge) { if (!x.cap) return null; if (x.cap === "human") s += 1; }
      if (x.dur && x.dur > 20 * 60) s -= 2;                  // a long lecture is a poor "next clip"
      if (o.short) { if (x.dur && x.dur <= 6 * 60) s += 2; else if (x.dur > 12 * 60) return null; }
      return hit ? { vid: v, title: x.title || "", dur: x.dur || 0, cap: x.cap || null, ch: x.ch || "", s, i } : null;
    /* ties go to the clips nearest the seed in the library (the index is ordered by channel and date),
       so two story clips lead to their own neighbours rather than the same three */
    }).filter(Boolean).sort((a, b) => b.s - a.s || Math.abs(a.i - si) - Math.abs(b.i - si) || a.i - b.i).slice(0, o.n || 3);
  }
  /* the role-play scenario for a subject: the first scenario a topic names that exists */
  function scenarioFor(content, text, exclude) {
    const list = (content && content.scenarios) || [], ex = new Set(exclude || []);
    const ids = topicsOf(text);
    for (const tp of TOPICS.filter(x => ids.includes(x.id))) for (const id of tp.scen) { const sc = list.find(x => x.id === id); if (sc && !ex.has(id)) return sc; }
    return null;
  }

  /* ========================= "BECAUSE YOU…" ROWS =========================
     One primary recommendation (the hero, best()) and up to EIGHT conditional
     rows (owner, 27 Sep 2026). Each row type reads ONE kind of real evidence
     and names it; with no evidence the row is not produced — a new learner
     sees the curriculum rows only, an active learner may see all eight.
     Every card is a specific piece of content with its exact deep link
     ({view, act, args}, the resolver the notifications use: nudgeGo), never a
     feature. The rows are ranked by the strength of the signal (need,
     unfinished work, recency, difficulty) — the same learner state the hero
     and the push nudges read, no second engine. */
  const ROW_IDS = ["watched", "practiced", "feedback", "struggled", "saved", "learning", "partner", "inactive"];
  const MAX_ROWS = 8, MAX_ITEMS = 3;
  /* a clip title as a row heading quotes it: no leading emoji, cut at a word, at most ~56 characters */
  function clipTitle(t) {
    let x = String(t || "").replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}️‍\s]+/u, "").replace(/\s+/g, " ").trim();
    if (x.length > 56) { const cut = x.slice(0, 56).replace(/\s+\S*$/, ""); x = (cut.length >= 24 ? cut : x.slice(0, 56)).replace(/[\s,;:\-—|&]+$/, "") + "…"; }
    return x;
  }
  function item(o) { return Object.assign({ type: "video", title: "", dur: 0, view: "shadow", act: null, args: [], challenge: false, external: false, cid: "" }, o); }
  function vidItem(v, challenge) { return item({ type: challenge ? "challenge" : "video", vid: v.vid, title: v.title, dur: v.dur, view: "shadow", act: "clip", args: [v.vid], challenge: !!challenge, external: true, cid: v.vid }); }
  function sessItem(pos, weeks) { const wk = weeks.find(x => x.n === pos.w) || {}, day = (wk.days && wk.days[pos.d]) || {}; return item({ type: "session", view: "session", args: [pos.w, pos.d], w: pos.w, d: pos.d, title: day.focus || wk.theme || "", cid: "w" + pos.w + pos.d }); }
  function phraseItem(w) { return item({ type: "phrases", view: "phrasebank", args: [w], w, title: "", cid: "ph-w" + w }); }
  function scenItem(sc) { return item({ type: "roleplay", view: "roleplay", args: [sc.id], title: sc.title || "", persona: sc.persona || "", cid: sc.id }); }
  function partnerItem(p, s) {
    if (p.available) return item({ type: "partner", view: "partner", act: "match", title: "", cid: "partner" });
    if (p.consented && s.aiCoach) return item({ type: "ai", view: "partner", act: "ai", title: "", cid: "ai" });
    return null;
  }
  const quote = w => "“" + w + "”";
  function rows(s, content) {
    if (!s || !s.ge) return [];                                 // General English only
    const R = s.recent || {}, now = s.now || Date.now(), c = content || {}, weeks = c.weeks || [], pos = s.pos || null;
    const seen = new Set(R.seen || []), used = new Set(s.heroCid ? [s.heroCid] : []), out = [];
    /* the hero already IS that recommendation: a row never repeats it */
    const sess = () => { if (!pos || pos.done) return null; const it = sessItem(pos, weeks); if (used.has(it.cid)) return null; used.add(it.cid); return it; };
    const ageD = ts => Math.max(0, (now - (ts || 0)) / DAY);
    const fresh = (ts, days) => !!ts && now - ts <= days * DAY;
    const take = (list, n) => list.filter(v => !used.has(v.vid)).slice(0, n == null ? MAX_ITEMS : n).map(v => { used.add(v.vid); return v; });
    const rel = (seed, opts) => take(related(c, seed, Object.assign({ exclude: [...seen], n: 8 }, opts || {})), (opts && opts.take) || MAX_ITEMS);
    const push = r => { if (r && r.items.length >= 2) out.push(Object.assign(r, { items: r.items.slice(0, MAX_ITEMS) })); };
    /* the week's own clip (the mission pack names one for six weeks) is the exact curriculum
       link, so it is kept for the learning row before any other row takes clips */
    const mc0 = pos && c.missions && c.missions[pos.w] && c.missions[pos.w].vid, mission = mc0 && c.videos && c.videos[mc0] && !seen.has(mc0) ? Object.assign({ vid: mc0 }, c.videos[mc0]) : null;
    if (mission) used.add(mission.vid);
    const week = n => weeks.find(x => x.n === n) || {};
    const p = s.partner || {};
    const talk = () => partnerItem(p, s);
    const tw = (s.troubleWords || []).filter(Boolean).slice(0, 3);

    /* 8 · BECAUSE YOU HAVEN'T PRACTISED — the strongest signal there is: a short way back */
    if (pos && !pos.done && ((s.daysAway || 0) >= 3 || (R.speakAway || 0) >= 5) && !s.practicedToday) {
      const speaking = (s.daysAway || 0) < 3, items = [sess()].filter(Boolean);
      rel({ text: [week(pos.w).theme, "pronunciation"].join(" ") }, { short: true, take: 1 }).forEach(v => items.push(vidItem(v, false)));
      /* a quick conversation: a partner or the AI coach when there is one, else the week's role-play */
      const tk = talk() || (() => { const sc = scenarioFor(c, week(pos.w).theme); return sc ? scenItem(sc) : null; })(); if (tk) items.push(tk);
      if (items.length < MAX_ITEMS) rel({ topics: ["fluency"] }, { short: true, take: MAX_ITEMS - items.length }).forEach(v => items.push(vidItem(v, false)));
      push({ id: "inactive", variant: speaking ? "speaking" : "days", reason: speaking ? "no_speaking_" + Math.min(R.speakAway, 30) + "d" : "inactive_" + Math.min(s.daysAway, 30) + "d", score: speaking ? 84 : 92, vars: { n: speaking ? R.speakAway : s.daysAway }, items });
    }
    /* 3 · BECAUSE YOUR FEEDBACK SHOWED — a real assessment named a need (Challenge issues, the
       Shadow report's words to fix, the Polish report's targets, a partner turn's weakest words) */
    const fb = R.feedback;
    if (fb && fresh(fb.ts, 14) && fb.need) {
      const items = [], words = (fb.words || []).slice(0, 3);
      if (fb.need === "words" && fb.vid && c.videos && c.videos[fb.vid] && c.videos[fb.vid].cap) { used.add(fb.vid); items.push(vidItem(Object.assign({ vid: fb.vid }, c.videos[fb.vid]), true)); }
      if (fb.need === "pron" || fb.need === "words") { if (tw.length || words.length) items.push(item({ type: "trouble", view: "shadow", act: "trouble", title: "", cid: "trouble" })); }
      if (fb.need === "expressions" && pos) items.push(phraseItem(pos.w));
      const topic = { pron: ["pronunciation"], words: ["pronunciation"], fluency: ["fluency"], expressions: ["vocabulary"] }[fb.need] || ["pronunciation"];
      rel({ topics: topic }, { challenge: fb.need !== "expressions", take: MAX_ITEMS - items.length }).forEach(v => items.push(vidItem(v, fb.need === "words")));
      push({ id: "feedback", variant: fb.need, reason: "feedback_" + fb.need + "_" + fb.src, score: 84 - 2 * Math.min(ageD(fb.ts), 14), seed: fb.vid || "", vars: { title: clipTitle(fb.title), words: words.map(quote).join(", "), n: words.length }, items });
    }
    /* 4 · BECAUSE YOU STRUGGLED WITH — a Challenge missed twice and not passed since, or trouble words on record */
    const cf = R.challengeFailed;
    if (cf && cf.vid && fresh(cf.ts, 14) && c.videos && c.videos[cf.vid]) {
      used.add(cf.vid);
      const items = [vidItem(Object.assign({ vid: cf.vid }, c.videos[cf.vid]), true)];
      if (tw.length) items.push(item({ type: "trouble", view: "shadow", act: "trouble", title: "", cid: "trouble" }));
      rel({ vid: cf.vid, text: cf.title }, { challenge: true, short: true, take: MAX_ITEMS - items.length }).forEach(v => items.push(vidItem(v, true)));
      push({ id: "struggled", variant: "challenge", reason: "challenge_failed_" + Math.min(cf.fails || 2, 9), score: 80 - Math.min(ageD(cf.ts), 14), seed: cf.vid, vars: { title: clipTitle(cf.title), n: cf.fails || 2 }, items });
    } else if (tw.length) {
      const items = [item({ type: "trouble", view: "shadow", act: "trouble", title: "", cid: "trouble" })];
      if ((s.wordsReady || 0) >= 1) items.push(item({ type: "words", view: "practice", act: "study-due", n: s.wordsReady, cid: "words-due" }));
      rel({ topics: ["pronunciation"] }, { take: MAX_ITEMS - items.length }).forEach(v => items.push(vidItem(v, false)));
      push({ id: "struggled", variant: "words", reason: "trouble_words_" + Math.min(tw.length, 9), score: 72 + 2 * tw.length, vars: { words: tw.map(quote).join(", "), n: tw.length }, items });
    }
    /* 6 · BECAUSE YOU'RE LEARNING — the curriculum position: today's session, the week's own
       clip (the mission's, else one on the theme), the week's expressions, the week's scenario */
    if (pos) {
      const wk = week(pos.w), items = [], done = !!R.weekDone && pos.w === R.weekDone + 1;
      const variant = (!R.any && pos.w === 1) ? "new" : (done ? "week_done" : "week");
      const si = sess(); if (si) items.push(si);
      if (mission) items.push(vidItem(mission, false));
      if (variant === "new" && items.length < MAX_ITEMS) { const st = (c.starters || []).find(x => x && x.vid && x.cap && !used.has(x.vid) && !seen.has(x.vid)); if (st) { used.add(st.vid); items.push(vidItem({ vid: st.vid, title: st.name || "", dur: 0 }, false)); } }
      if (items.length < MAX_ITEMS) rel({ text: [wk.theme, wk.goal].join(" ") }, { take: 1 }).forEach(v => items.push(vidItem(v, false)));
      if (items.length < MAX_ITEMS) items.push(phraseItem(pos.w));
      if (items.length < MAX_ITEMS) { const sc = scenarioFor(c, [wk.theme, wk.goal].join(" ")); if (sc) items.push(scenItem(sc)); }
      push({ id: "learning", variant, reason: variant === "new" ? "new_learner" : variant === "week_done" ? "week_done_" + R.weekDone : "week_" + pos.w, score: variant === "week_done" ? 78 : (variant === "new" ? 70 : 60 + (pos.done ? 0 : 6)), vars: { n: pos.w, done: R.weekDone || 0, theme: String(wk.theme || "").slice(0, 60) }, items });
    }
    /* 2 · BECAUSE YOU PRACTISED — the newest completed practice: a recorded Shadow take or a
       session day with its report → the next content: the Challenge on that clip, the next
       clip at that level, the next session */
    const pr = R.practiced;
    if (pr && fresh(pr.ts, 14)) {
      const items = [];
      const clip = pr.kind === "shadow" || pr.kind === "challenge";
      /* a take → the Challenge on that same clip (unless it was passed); a Challenge → the next
         clips at that level, opened in the Challenge; a session → the next session */
      if (pr.kind === "shadow" && pr.vid && c.videos && c.videos[pr.vid] && c.videos[pr.vid].cap && !(R.challengePassed && R.challengePassed.vid === pr.vid) && !used.has(pr.vid)) { used.add(pr.vid); items.push(vidItem(Object.assign({ vid: pr.vid }, c.videos[pr.vid]), true)); }
      if (pr.kind === "challenge" && !pr.pass && pr.vid && c.videos && c.videos[pr.vid] && !used.has(pr.vid)) { used.add(pr.vid); items.push(vidItem(Object.assign({ vid: pr.vid }, c.videos[pr.vid]), true)); }
      if (pr.kind === "session") { const si = sess(); if (si) items.push(si); }
      const seedText = clip ? "" : [pr.focus, week(pr.w).theme].join(" ");
      rel(clip ? { vid: pr.vid, text: pr.title } : { text: seedText }, { challenge: pr.kind === "challenge", take: MAX_ITEMS - items.length }).forEach(v => items.push(vidItem(v, pr.kind === "challenge")));
      if (items.length < MAX_ITEMS && pr.kind === "session") { const sc = scenarioFor(c, seedText); if (sc) items.push(scenItem(sc)); }
      push({ id: "practiced", variant: pr.kind === "challenge" ? (pr.pass ? "challenge" : "challenge_try") : pr.kind, reason: "practiced_" + pr.kind, score: 68 - 2 * Math.min(ageD(pr.ts), 14), seed: pr.vid || "", vars: { title: clipTitle(pr.title), focus: String(pr.focus || "").slice(0, 60), w: pr.w || 0 }, items });
    }
    /* 1 · BECAUSE YOU WATCHED — verified playback (≥ 30 s of a clip actually playing) → clips
       on the same subject, from the same voice, and the week's own clip when it fits */
    const wt = R.watched;
    if (wt && wt.vid && fresh(wt.ts, 30) && (wt.secs || 0) >= 30 && !(pr && pr.vid === wt.vid && pr.ts >= wt.ts)) {
      const items = rel({ vid: wt.vid, text: wt.title }, {}).map(v => vidItem(v, false));
      push({ id: "watched", variant: "", reason: "clip_watched", score: 62 - 2 * Math.min(ageD(wt.ts), 14), seed: wt.vid, vars: { title: clipTitle(wt.title) }, items });
    }
    /* 7 · BECAUSE YOU PRACTISED WITH — a partner, the AI coach, or a role-play character, in the last two weeks */
    const pw = R.partner;
    if (pw && fresh(pw.ts, 14)) {
      const items = [];
      if (pw.kind === "roleplay" && pw.sid) { const sc = (c.scenarios || []).find(x => x.id === pw.sid); if (sc) items.push(scenItem(sc)); const nx = scenarioFor(c, [sc && sc.title, pw.topic].join(" "), [pw.sid]) || (c.scenarios || []).find(x => x.cat === pw.cat && x.id !== pw.sid); if (nx) items.push(scenItem(nx)); }
      else { const tk = talk(); if (tk) items.push(tk); if (pw.kind !== "ai" && p.consented && s.aiCoach && !items.some(x => x.type === "ai")) items.push(item({ type: "ai", view: "partner", act: "ai", title: "", cid: "ai" })); }
      rel({ text: [pw.topic, "conversation"].join(" ") }, { take: MAX_ITEMS - items.length }).forEach(v => items.push(vidItem(v, false)));
      push({ id: "partner", variant: pw.kind, reason: "practised_with_" + pw.kind, score: 56 - 2 * Math.min(ageD(pw.ts), 14), vars: { topic: String(pw.topic || "").slice(0, 48), title: clipTitle(pw.title), persona: String(pw.persona || "").slice(0, 24), name: String(pw.name || "").slice(0, 24) }, items });
    }
    /* 5 · BECAUSE YOU SAVED — words in the vocabulary, clips saved in Shadow, expressions written in Phrase Lab */
    const sv = R.saved || {};
    if ((sv.words || 0) >= 1 || (sv.clips || []).length) {
      const items = [], clip = (sv.clips || [])[0];
      if ((sv.words || 0) >= 1) items.push(item({ type: "words", view: "practice", act: "study-due", n: s.wordsReady || 0, cid: "words-due", saved: sv.words }));
      if (clip && clip.vid) { used.add(clip.vid); items.push(item({ type: "video", vid: clip.vid, title: clip.title || "", view: "shadow", act: "clip", args: [clip.vid, clip.start || 0, clip.end || 0], external: true, cid: clip.vid, saved: true })); }
      if (pos && items.length < MAX_ITEMS) items.push(phraseItem(pos.w));
      const variant = clip && !(sv.words >= 1) ? "clips" : "words";
      push({ id: "saved", variant, reason: variant === "clips" ? "saved_clip" : "saved_words_" + Math.min(sv.words, 99), score: 44 + ((s.wordsReady || 0) >= 3 ? 10 : 0), vars: { n: sv.words || 0, title: clipTitle(clip && clip.title), words: (sv.newest || []).slice(0, 3).map(quote).join(", ") }, items });
    }
    /* the empty state: with fewer than two evidence rows, a curriculum row "Recommended for your
       level" — the shadow starters and short human-captioned clips — never a "because you" */
    const evidence = out.filter(r => r.id !== "learning").length;
    if (evidence < 2) {
      const items = [];
      (c.starters || []).filter(x => x && x.vid && x.cap && !used.has(x.vid) && !seen.has(x.vid)).slice(0, 1).forEach(st => { used.add(st.vid); items.push(vidItem({ vid: st.vid, title: st.name || "", dur: 0 }, false)); });
      rel({ topics: ["introductions", "fluency"] }, { short: true, take: MAX_ITEMS - items.length }).forEach(v => items.push(vidItem(v, false)));
      push({ id: "level", variant: "", reason: "level", score: 30, vars: {}, items });
    }
    /* the learner's weakest competency lifts the rows that train it — the same +15/+8 logic as rank() */
    const SKILL = { feedback: "pronunciation", struggled: "pronunciation", saved: "vocabulary", partner: "communication", practiced: "pronunciation" };
    out.forEach(r => { if (s.weakest && SKILL[r.id] === s.weakest) r.score += 8; r.score = Math.round(r.score * 10) / 10; });
    return out.sort((a, b) => b.score - a.score || ROW_IDS.indexOf(a.id) - ROW_IDS.indexOf(b.id)).slice(0, MAX_ROWS);
  }

  const api = { candidates, rank, best, satisfied, KINDS, KIND_COOLDOWN, DISMISS_COOLDOWN, TOPICS, topicsOf, related, scenarioFor, rows, clipTitle, ROW_IDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.NudgeEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
