/* ============================================================================
   BE Mastery — Smart Coach engine (Smart Practice Planner, 10 Oct 2026)
   --------------------------------------------------------------------------
   Learner evidence → one priority skill → up to three plans for THAT skill →
   an exact schedule the learner may move (never the skill, never the length)
   → per-session states → the programme's outcome → the next step.

   Pure: no DOM, no storage, no network. index.html gathers the evidence from
   the learner's own records (scSignals) and the be-coach Worker imports this
   SAME file to validate what it stores, so a plan the app accepts and a plan
   the server accepts can never disagree. Tested in Node
   (tests/smart-coach-engine.test.mjs).

   HONEST RULES, kept here because both sides depend on them:
     · No rule fires without evidence. With too little, the answer is a
       diagnostic (or the next lesson), never a guessed weakness.
     · The evidence is returned as i18n keys + the learner's own numbers.
     · Durations, session counts and the programme defaults below are
       starting points chosen by the product, not a proven optimum.
     · Completing the sessions, reaching the pass mark on the final check
       and improving on the starting check are three different outcomes and
       are reported separately (outcome()).
   ============================================================================ */
(function (global) {
  const DAY = 86_400_000;
  const TRACKS = ["general-english", "welding"];
  /* the three programmes. `days` is the programme's length (fixed once
     proposed); `offsets` are the default practice days inside it. */
  const KINDS = {
    quick:   { days: 3,  min: 3, max: 3, minutes: 5, check: false, offsets: [0, 1, 2] },
    sprint:  { days: 5,  min: 4, max: 5, minutes: 8, check: true,  offsets: [0, 1, 3, 4] },
    mastery: { days: 14, min: 6, max: 8, minutes: 8, check: true,  offsets: [0, 1, 3, 5, 8, 11, 13] },
  };
  const KIND_ORDER = ["quick", "sprint", "mastery"];
  const PASS = 80;                 // a final check at or above this is "competent"
  const QUIET_FROM = 22 * 60, QUIET_TO = 7 * 60;   // no session reminder 22:00–07:00
  const GRACE_DAYS = 1;            // a session is missed after the end of the day AFTER its date
  const END_GRACE_DAYS = 1;        // completions are accepted until the end of the day after the last day
  const MAX_AHEAD_DAYS = 14;       // a programme may start at most two weeks ahead
  const REVIEW_AFTER_DAYS = 10;    // a skill passed this long ago is due a spaced review

  /* activity types. `verify`: who confirms a completion — "server" (the game
     round is closed by be-polish, which the coach Worker checks) or "device"
     (the learner's own saved record). `measured`: produces a 0–100 score. */
  const ACT = {
    words:   { verify: "device", measured: false, view: "practice" },
    quiz:    { verify: "device", measured: true,  view: "practice" },
    grammar: { verify: "device", measured: true,  view: "practice" },
    game:    { verify: "server", measured: true,  view: "game" },
    shadow:  { verify: "device", measured: true,  view: "shadow" },
  };
  const GAME_MODES = {
    "welding": ["cards", "quiz", "visual", "listen", "builder", "match", "workshop"],
    "general-english": ["cards", "quiz", "sentence", "listen", "speak", "match", "puzzle"],
  };
  const SKILLS = ["vocabulary", "pronunciation", "grammar", "topic", "listening", "diagnostic"];
  const MIN_ROUND = 5;             // a game round or flashcard run of at least 5 answers counts

  /* ---------------------------------------------------------------- dates */
  const YMD = /^\d{4}-\d{2}-\d{2}$/, HM = /^([01]\d|2[0-3]):[0-5]\d$/;
  function ymdOk(s) { if (!YMD.test(s || "")) return false; const d = new Date(s + "T00:00:00Z"); return !isNaN(d) && d.toISOString().slice(0, 10) === s; }
  function addDays(ymd, n) { const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function diffDays(a, b) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY); }
  function weekday(ymd) { return new Date(ymd + "T00:00:00Z").getUTCDay(); }
  function minutesOf(hm) { const [h, m] = hm.split(":").map(Number); return h * 60 + m; }
  function quiet(hm) { const m = minutesOf(hm); return m >= QUIET_FROM || m < QUIET_TO; }
  function tzOk(tz) { if (typeof tz !== "string" || !tz || tz.length > 64) return false; try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch (e) { return false; } }
  /* the wall clock of an instant in a time zone */
  function localParts(at, tz) {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const p = {}; f.formatToParts(new Date(at)).forEach(x => { p[x.type] = x.value; });
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
  }
  /* the instant a wall-clock date + time names in a time zone — DST-correct:
     the offset is read AT that moment, twice, so a date across a clock change
     gets the offset of its own day. A time inside a spring-forward gap moves
     forward by the gap (quiet hours keep sessions far from 02:00 anyway). */
  function atOf(date, time, tz) {
    const [y, mo, d] = date.split("-").map(Number), [h, mi] = time.split(":").map(Number);
    const want = Date.UTC(y, mo - 1, d, h, mi);
    let at = want;
    for (let i = 0; i < 3; i++) {
      const p = localParts(at, tz), [py, pm, pd] = p.date.split("-").map(Number), [ph, pmi] = p.time.split(":").map(Number);
      const seen = Date.UTC(py, pm - 1, pd, ph, pmi);
      if (seen === want) return at;
      at += want - seen;
    }
    return at;
  }
  function todayIn(now, tz) { return localParts(now, tz).date; }

  /* ------------------------------------------------------------- evidence */
  const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
  const ev = (k, vars) => ({ k, vars: vars || {} });
  /* every candidate objective, scored, each with the evidence behind it.
     sig: see scSignals() in index.html — only the learner's own records. */
  function candidates(sig) {
    const out = [];
    if (!sig || !TRACKS.includes(sig.track)) return out;
    const g = sig.game, welding = sig.track === "welding";
    /* pronunciation: words that keep failing in recorded takes, low or falling scores */
    const sh = (sig.shadow && sig.shadow.scores) || [], tr = sig.trouble || { n: 0, words: [] };
    if (tr.n >= 3 || (sh.length >= 2 && avg(sh) < 75)) {
      const e = [], recent = sh.slice(-3), prev = sh.slice(-6, -3);
      let score = 30;
      if (tr.n >= 3) { e.push(ev("sc.ev_trouble", { n: tr.n, words: tr.words.slice(0, 3).join(", ") })); score += Math.min(30, tr.n * 3); }
      if (sh.length >= 2) { e.push(ev("sc.ev_shadow_avg", { n: sh.length, p: avg(sh) })); if (avg(sh) < 75) score += 12; }
      if (prev.length === 3 && avg(prev) - avg(recent) >= 8) { e.push(ev("sc.ev_shadow_drop", { from: avg(prev), to: avg(recent) })); score += 10; }
      out.push({ skill: "pronunciation", cat: null, score, evidence: e, recurring: tr.n >= 5 });
    }
    /* grammar: a category whose latest drill fell under 70 % */
    (sig.grammar || []).forEach(c => {
      const last = c.last || [];
      if (!c.runs || !last.length || last[last.length - 1] >= 70) return;
      const p = last[last.length - 1], twice = last.length >= 2 && last[last.length - 2] < 70;
      const e = [ev("sc.ev_gram", { cat: c.cat, p, runs: c.runs })];
      if (twice) e.push(ev("sc.ev_gram_rep", { cat: c.cat }));
      out.push({ skill: "grammar", cat: c.cat, score: 30 + Math.round((70 - p) / 2) + (twice ? 12 : 0), evidence: e, recurring: twice });
    });
    /* a vocabulary area of the game hub with repeated open errors */
    if (g) (g.cats || []).forEach(c => {
      if (!(c.open >= 3)) return;
      const e = [ev("sc.ev_cat_err", { cat: c.id, n: c.open })];
      let score = 28 + Math.min(30, c.open * 3);
      if (welding && c.id === "ppe") { e.push(ev("sc.ev_safety")); score += 10; }
      out.push({ skill: "topic", cat: c.id, score, evidence: e, recurring: c.open >= 5 });
    });
    /* listening, from the game's own skill measure (≥10 answers) */
    if (g) { const l = (g.skills || []).find(s => s.id === "listening"); if (l && l.pct != null && l.n >= 10 && l.pct < 70) out.push({ skill: "listening", cat: null, score: 30 + Math.round((70 - l.pct) / 2), evidence: [ev("sc.ev_listen", { p: l.pct, n: l.n })], recurring: l.pct < 55 }); }
    /* vocabulary recall: words due, low quiz scores, game words due */
    const v = sig.vocab || {}, q = v.quiz || [], e = [];
    let vs = 0;
    if (v.ready >= 8) { e.push(ev("sc.ev_words_due", { n: v.ready })); vs += 20 + Math.min(20, v.ready); }
    if (q.length >= 2 && avg(q.slice(-3)) < 70) { e.push(ev("sc.ev_quiz", { p: avg(q.slice(-3)), n: Math.min(3, q.length) })); vs += 18; }
    if (g && g.due >= 8) { e.push(ev("sc.ev_game_due", { n: g.due })); vs += 12 + Math.min(12, g.due / 2); }
    if (vs) out.push({ skill: "vocabulary", cat: null, score: 10 + Math.round(vs), evidence: e, recurring: e.length >= 2 });
    return applyHistory(out, sig);
  }
  /* the programmes already finished shape the next step: a failed check is
     reinforced, a skill just passed rests, a skill passed long ago is due a review */
  function applyHistory(list, sig) {
    const hist = (sig.history || []).filter(h => h && h.status === "completed").sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    const same = (c, h) => c.skill === h.skill && (c.cat || null) === (h.cat || null);
    const now = sig.now || Date.now();
    const last = hist[0];
    if (last && last.skill !== "diagnostic") {
      const o = last.outcome || {};
      if (o.competent === false || (o.delta != null && o.delta <= 0)) {
        let c = list.find(x => same(x, last));
        if (!c) { c = { skill: last.skill, cat: last.cat || null, score: 0, evidence: [], recurring: true }; list.push(c); }
        c.score += 30; c.reinforce = last.kind;
        c.evidence.unshift(ev(o.final != null ? "sc.ev_reinforce" : "sc.ev_reinforce_nf", { p: o.final, from: o.start }));
      }
    }
    for (const h of hist) {
      const passed = h.outcome && h.outcome.competent === true, age = (now - (h.endedAt || 0)) / DAY;
      const c = list.find(x => same(x, h));
      if (passed && age < REVIEW_AFTER_DAYS && c && !c.reinforce) c.score -= 40;   // just passed: let it settle
      if (passed && age >= REVIEW_AFTER_DAYS && !list.some(x => same(x, h) && x.review)) {
        if (c) { c.score += 8; c.review = true; c.evidence.push(ev("sc.ev_review", { d: Math.floor(age) })); }
        else list.push({ skill: h.skill, cat: h.cat || null, score: 22, evidence: [ev("sc.ev_review", { d: Math.floor(age) })], review: true });
      }
    }
    return list.filter(c => c.score > 0).sort((a, b) => b.score - a.score || SKILLS.indexOf(a.skill) - SKILLS.indexOf(b.skill));
  }
  /* how much the device has actually measured — the floor for any claim */
  function measuredCount(sig) {
    const g = sig.game;
    return ((sig.vocab && sig.vocab.quiz) || []).length + ((sig.shadow && sig.shadow.scores) || []).length
      + (sig.grammar || []).reduce((n, c) => n + (c.runs || 0), 0) + (g ? Math.floor((g.answers || 0) / 10) : 0);
  }
  /* the priority: the strongest candidate, or a diagnostic when the evidence
     is too thin. ctx says which activities this learner can reach. */
  function analyse(sig, ctx) {
    const list = candidates(sig).filter(c => feasible(c, ctx));
    const measured = measuredCount(sig);
    if (!list.length || (measured < 3 && !list.some(c => c.score >= 45))) {
      return { priority: { skill: "diagnostic", cat: null, score: 0, evidence: [ev(measured ? "sc.ev_thin" : "sc.ev_none", { n: measured })] }, others: [], measured, sufficient: false, lesson: sig.lesson || null };
    }
    const top = list[0];
    return { priority: top, others: list.slice(1, 4), measured, sufficient: true, lesson: sig.lesson || null };
  }
  /* the programme length the evidence calls for */
  function recommendKind(c) {
    if (!c || c.skill === "diagnostic") return "quick";
    if (c.reinforce) return KIND_ORDER[Math.min(2, KIND_ORDER.indexOf(c.reinforce) + 1)];
    if (c.review) return "quick";
    if (c.score >= 70) return "mastery";
    if (c.recurring || c.score >= 45) return "sprint";
    return "quick";
  }

  /* ---------------------------------------------------- activities per skill */
  /* ctx = { track, game:bool, words:n (saved words), grammarCats:[...], shadow:bool } */
  function feasible(c, ctx) {
    if (!ctx) return true;
    if (c.skill === "topic" || c.skill === "listening") return !!ctx.game;
    if (c.skill === "grammar") return (ctx.grammarCats || []).includes(c.cat);
    if (c.skill === "pronunciation") return !!ctx.shadow;
    if (c.skill === "vocabulary") return !!ctx.game || ctx.words >= 5;
    return true;
  }
  const A = (type, o) => Object.assign({ type }, o || {});
  /* the measured instrument used for BOTH the starting check and the final
     check, so a difference between them compares like with like */
  function instrument(obj, ctx) {
    switch (obj.skill) {
      case "pronunciation": return A("shadow");
      case "grammar": return A("grammar", { cat: obj.cat });
      case "topic": return A("game", { mode: "quiz", cat: obj.cat });
      case "listening": return A("game", { mode: "listen" });
      case "vocabulary": return ctx.game ? A("game", { mode: "quiz" }) : A("quiz");
      default: return null;
    }
  }
  /* the practice steps, in order; they cycle when a programme is longer */
  function practice(obj, ctx) {
    const welding = ctx.track === "welding";
    switch (obj.skill) {
      case "pronunciation": return ctx.game ? [A("shadow"), A("game", { mode: welding ? "listen" : "speak" }), A("shadow")] : [A("shadow")];
      case "grammar": return [A("grammar", { cat: obj.cat })];
      case "topic": return [A("game", { mode: "cards", cat: obj.cat }), A("game", { mode: welding ? "visual" : "match", cat: obj.cat }), A("game", { mode: "match", cat: obj.cat }), A("game", { mode: "quiz", cat: obj.cat })];
      case "listening": return [A("game", { mode: "listen" }), A("game", { mode: "cards" }), A("game", { mode: "listen" })];
      case "vocabulary": {
        const s = [];
        if (ctx.words >= 5) s.push(A("words"));
        if (ctx.game) s.push(A("game", { mode: "cards" }), A("game", { mode: "match" }));
        if (ctx.words >= 4) s.push(A("quiz"));
        return s.length ? s : [A("words")];
      }
      case "diagnostic": {
        const s = [];
        if (ctx.game) s.push(A("game", { mode: "quiz" })); else if (ctx.words >= 4) s.push(A("quiz"));
        if ((ctx.grammarCats || []).length) s.push(A("grammar", { cat: ctx.grammarCats[0] }));
        if (ctx.shadow) s.push(A("shadow"));
        while (s.length < 3) s.push(ctx.game ? A("game", { mode: "cards" }) : A("words"));
        return s;
      }
    }
    return [A("words")];
  }
  /* every activity an objective may ever be planned with, whatever this
     learner can reach — the server checks a stored plan against it, so a
     plan cannot swap its curriculum destinations for easier ones */
  const actKey = a => [a.type, a.mode || "", a.cat || ""].join("/");
  function allowedActs(obj, track) {
    const set = new Set();
    [true, false].forEach(game => [0, 4, 5].forEach(words => {
      const ctx = { track, game, words, grammarCats: obj.cat ? [obj.cat] : ["_"], shadow: true };
      practice(obj, ctx).concat(instrument(obj, ctx) || []).forEach(a => set.add(actKey(a)));
    }));
    if (obj.skill === "diagnostic") set.add("grammar//*");
    return set;
  }
  function actAllowed(obj, track, a) {
    const set = allowedActs(obj, track);
    return set.has(actKey(a)) || (obj.skill === "diagnostic" && a.type === "grammar" && !!a.cat);
  }
  /* one programme of a kind for an objective, on its default days */
  function plan(kind, obj, ctx, start) {
    const K = KINDS[kind]; if (!K) return null;
    if (obj.skill === "diagnostic" && kind !== "quick") return null;
    const steps = practice(obj, ctx), ins = instrument(obj, ctx), n = K.offsets.length;
    const sessions = K.offsets.map((off, i) => {
      let role = "practice", act;
      if (K.check && ins && i === 0) { role = "start"; act = ins; }
      else if (K.check && ins && i === n - 1) { role = "check"; act = ins; }
      else act = steps[(K.check && ins ? i - 1 : i) % steps.length];
      return { i, role, act: Object.assign({}, act), minutes: K.minutes, date: start ? addDays(start, off) : null, time: null };
    });
    return { kind, days: K.days, objective: { skill: obj.skill, cat: obj.cat || null }, sessions, check: K.check && !!ins, minutes: K.minutes * sessions.length };
  }
  /* up to three programmes, all for the SAME objective */
  function plans(obj, ctx, start) { return KIND_ORDER.map(k => plan(k, obj, ctx, start)).filter(Boolean); }

  /* --------------------------------------------------------------- schedule */
  /* move a programme onto a start date, practice weekdays and one time.
     The length never changes; with weekdays, the sessions are spread over the
     chosen days inside the SAME window, first and last day included where
     they qualify. Returns { plan } or { error } when the window has too few
     of those days. */
  function arrange(p, o) {
    const K = KINDS[p.kind], start = o.start, n = p.sessions.length;
    let dates;
    if (o.weekdays && o.weekdays.length) {
      const ok = [];
      for (let d = 0; d < K.days; d++) { const ymd = addDays(start, d); if (o.weekdays.includes(weekday(ymd))) ok.push(ymd); }
      if (ok.length < n) return { error: "few_days", need: n, have: ok.length };
      dates = n === 1 ? [ok[0]] : Array.from({ length: n }, (_, i) => ok[Math.round(i * (ok.length - 1) / (n - 1))]);
    } else dates = K.offsets.slice(0, n).map(off => addDays(start, off));
    const out = JSON.parse(JSON.stringify(p));
    out.start = start; out.end = addDays(start, K.days - 1);
    out.sessions.forEach((s, i) => { s.date = dates[i]; s.time = (o.times && o.times[i]) || o.time || s.time || "19:00"; });
    return { plan: out };
  }
  /* every rule a stored programme must keep. Returns [] or a list of codes.
     opts: { today (the learner's date), track } */
  function validate(p, opts) {
    const errs = [], o = opts || {};
    const K = p && KINDS[p.kind];
    if (!K) return ["kind"];
    if (p.days !== K.days) errs.push("duration");
    const ss = Array.isArray(p.sessions) ? p.sessions : [];
    if (ss.length < K.min || ss.length > K.max) errs.push("count");
    if (!p.objective || !SKILLS.includes(p.objective.skill)) errs.push("objective");
    if (p.objective && p.objective.skill === "diagnostic" && p.kind !== "quick") errs.push("objective");
    if (!ymdOk(p.start)) return errs.concat("start");
    if (o.today) {
      if (p.start < o.today) errs.push("start_past");
      else if (diffDays(o.today, p.start) > MAX_AHEAD_DAYS) errs.push("start_far");
    }
    const end = addDays(p.start, K.days - 1);
    let prev = "";
    ss.forEach((s, i) => {
      if (!s || s.i !== i) { errs.push("index"); return; }
      if (!ymdOk(s.date) || s.date < p.start || s.date > end) errs.push("outside");
      else if (prev && s.date <= prev) errs.push("order");
      prev = s.date || prev;
      if (!HM.test(s.time || "")) errs.push("time");
      else if (quiet(s.time)) errs.push("quiet");
      const t = s.act && ACT[s.act.type];
      if (!t) errs.push("activity");
      else if (s.act.type === "game" && !(GAME_MODES[o.track] || []).includes(s.act.mode)) errs.push("activity");
      else if (o.track && p.objective && SKILLS.includes(p.objective.skill) && !actAllowed(p.objective, o.track, s.act)) errs.push("activity");
      if (!["start", "practice", "check"].includes(s.role)) errs.push("role");
    });
    if (K.check && p.objective && p.objective.skill !== "diagnostic") {
      if (!ss.length || ss[ss.length - 1].role !== "check" || ss[0].role !== "start") errs.push("check");
      else if (actKey(ss[0].act || {}) !== actKey(ss[ss.length - 1].act || {})) errs.push("check");
    }
    return [...new Set(errs)];
  }
  /* the parts the learner may never change once proposed: compared field by
     field by the server whenever a schedule is replaced */
  function lockedOf(p) {
    return JSON.stringify({ kind: p.kind, days: p.days, objective: { skill: p.objective.skill, cat: p.objective.cat || null }, acts: p.sessions.map(s => [s.role, s.act.type, s.act.mode || null, s.act.cat || null]) });
  }

  /* ----------------------------------------------------------------- states */
  /* one session, now. done → "done"; before its day → "upcoming"; on its day
     before its time → "today"; then "due" until the end of the following
     day; after that "missed" (still completable until the programme closes). */
  function sessionState(s, now, tz) {
    if (s.done) return "done";
    const open = atOf(s.date, "00:00", tz), at = atOf(s.date, s.time, tz), miss = atOf(addDays(s.date, GRACE_DAYS + 1), "00:00", tz);
    if (now < open) return "upcoming";
    if (now < at) return "today";
    if (now < miss) return "due";
    return "missed";
  }
  function closeAt(p) { return atOf(addDays(p.end, END_GRACE_DAYS + 1), "00:00", p.tz); }
  /* when a session may be completed: from the start of its day (never before
     the programme was approved) until the programme closes */
  function windowOf(p, s) { return { from: Math.max(atOf(s.date, "00:00", p.tz), p.approvedAt || 0), to: closeAt(p) }; }
  function progress(p, now) {
    const st = p.sessions.map(s => sessionState(s, now, p.tz));
    const done = st.filter(x => x === "done").length, missed = st.filter(x => x === "missed").length;
    const next = p.sessions.find((s, i) => st[i] !== "done") || null;
    let status = p.status;
    if (status === "active" && done === p.sessions.length) status = "completed";
    if ((status === "active" || status === "paused") && done < p.sessions.length && now >= closeAt(p)) status = "overdue";
    return { states: st, done, total: p.sessions.length, missed, next, status, pct: Math.round(100 * done / Math.max(1, p.sessions.length)) };
  }
  /* three separate outcomes — never folded into one */
  function outcome(p) {
    const ss = p.sessions, done = ss.filter(s => s.done).length;
    const st = ss.find(s => s.role === "start"), ck = ss.find(s => s.role === "check");
    const start = st && st.done && st.score != null ? st.score : null, final = ck && ck.done && ck.score != null ? ck.score : null;
    return {
      done, required: ss.length, activitiesComplete: done === ss.length,
      start, final, competent: final == null ? null : final >= PASS,
      delta: start != null && final != null ? final - start : null,
      serverVerified: ss.filter(s => s.done && s.verifiedBy === "server").length,
    };
  }

  /* ---------------------------------------------------------- completion */
  /* does a record prove this session? records = the learner's saved activity
     rows, already normalised by the app: { type, ref, ts, n?, ok?, score?, mode?, cats?, cat? } */
  function matches(act, r) {
    if (!r || r.type !== act.type) return false;
    if (act.type === "game") { if (r.mode !== act.mode) return false; if (act.cat && !(r.cats || []).includes(act.cat)) return false; if (!(r.n >= MIN_ROUND)) return false; }
    if (act.type === "grammar" && act.cat && r.cat !== act.cat) return false;
    if (act.type === "words" && !(r.n >= MIN_ROUND)) return false;
    if (ACT[act.type].measured && !(r.score >= 0 && r.score <= 100)) return false;
    return true;
  }
  function evidenceFor(p, s, records, used) {
    const w = windowOf(p, s), taken = new Set(used || []);
    return (records || []).filter(r => r.ts >= w.from && r.ts < w.to && !taken.has(r.type + ":" + r.ref) && matches(s.act, r)).sort((a, b) => a.ts - b.ts)[0] || null;
  }

  const api = { TRACKS, KINDS, KIND_ORDER, PASS, ACT, GAME_MODES, SKILLS, MIN_ROUND, GRACE_DAYS, END_GRACE_DAYS, MAX_AHEAD_DAYS,
    ymdOk, addDays, diffDays, weekday, quiet, tzOk, localParts, atOf, todayIn,
    candidates, analyse, recommendKind, measuredCount, feasible, plan, plans, instrument, allowedActs, actAllowed, actKey,
    arrange, validate, lockedOf, sessionState, closeAt, windowOf, progress, outcome, matches, evidenceFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.SmartCoachEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
