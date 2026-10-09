/* ============================================================================
   BE Mastery — Welding Mastery engine (Welding Professional English only)
   --------------------------------------------------------------------------
   The learning logic behind the Welding Mastery game hub: spaced repetition,
   mastery, XP, levels, streak, achievements, Today's Shift, the journey and
   the Game Performance numbers.

   Pure: no DOM, no storage, no network. welding-mastery.js holds the screens
   and hands this file the learner's own record (S.wm.welding) and the corpus
   (tracks/welding/mastery.json). Same input → same output, so every rule is
   unit-tested in Node (tests/welding-mastery-engine.test.mjs).

   Two numbers that must never be confused:
     XP       — meaningful engagement. Idempotent: every award has an event id
                and an id is paid once (wmAward). Repeating a finished round or
                re-answering a word the same day pays nothing more.
     Mastery  — demonstrated knowledge, per word (isMastered). It cannot be
                bought with XP: it needs correct answers on three different
                days, the latest answer correct, and at least one of them an
                ACTIVE recall (spelling, typing what you heard, or a card rated
                Good/Easy) — picking from four choices alone never masters a
                word.
   ============================================================================ */
(function (global) {
  const MIN = 60_000, H = 60 * MIN, DAY = 24 * H;
  const VERSION = 1;

  /* ---- games and the skill each one measures ---- */
  const MODES = ["cards", "quiz", "crossword", "visual", "listen", "builder", "match", "workshop"];
  /* recognition = choosing among options; recall = producing it yourself;
     listening = from the ear; context = using it in a situation; spelling. */
  const SKILLS = ["recognition", "recall", "listening", "context", "spelling", "visual"];
  const MODE_SKILL = { cards: "recall", quiz: "recognition", crossword: "spelling", visual: "visual", listen: "listening", builder: "spelling", match: "recognition", workshop: "context" };
  /* a correct answer in these skills is ACTIVE recall (counts toward mastery) */
  const ACTIVE = new Set(["recall", "spelling", "listening_typed"]);

  /* ---- spaced repetition (SM-2, simplified) ---- */
  const Q = { again: 0, hard: 1, good: 2, easy: 3 };
  const EASE0 = 250, EASE_MIN = 130, EASE_MAX = 320;
  const MASTERY_DAYS = 3;          // correct on this many different days …
  const RELEARN_MS = 10 * MIN;     // a failed word comes back soon

  /* ---- XP ---- */
  const XP = { answer: 2, session: 10, mission: 30, mastered: 25, hardMastered: 15, stage: 100 };
  const SESSION_MIN_ANSWERS = 5;   // a "session" is at least this many graded answers
  const SESSIONS_PAID_PER_DAY = 5; // the sixth round of the day still teaches, it just pays no bonus
  const EVENT_KEEP_DAYS = 45;      // day-scoped idempotency keys are kept this long

  function dayOf(now) { return new Date(now).toISOString().slice(0, 10); }   // UTC, like the app's streak()
  function dayNum(d) { return Math.round(Date.parse(d + "T00:00:00Z") / DAY); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function fresh() {
    return { v: VERSION, t: {}, fav: {}, mine: {}, xpDay: {}, ev: {}, days: {}, modes: {}, ach: {}, mis: null, set: { sound: false, motion: "auto", first: "en" }, resume: null, ws: {}, hist: [] };
  }
  /* repair whatever the device holds (older shape, a half-written object) */
  function normalize(st) {
    const f = fresh();
    if (!st || typeof st !== "object") return f;
    for (const k of Object.keys(f)) if (st[k] == null || typeof st[k] !== typeof f[k]) st[k] = f[k];
    for (const k of Object.keys(f.set)) if (st.set[k] == null) st.set[k] = f.set[k];   // in place: callers hold references to st.set
    if (st.mis && typeof st.mis !== "object") st.mis = null;
    st.v = VERSION;
    return st;
  }
  function term(st, id) {
    return st.t[id] || (st.t[id] = { e: EASE0, iv: 0, due: 0, n: 0, ok: 0, lapses: 0, last: 0, okDays: [], act: 0, m: 0, mEver: 0, hard: 0, sk: {} });
  }

  /* ---- XP: one id, one payment ---- */
  function award(st, id, xp, now) {
    if (!id || !(xp > 0) || st.ev[id]) return 0;
    const day = dayOf(now);
    st.ev[id] = day;
    st.xpDay[day] = (st.xpDay[day] || 0) + xp;
    return xp;
  }
  function xpTotal(st) { return Object.values(st.xpDay || {}).reduce((a, b) => a + (+b || 0), 0); }
  /* day-scoped keys (answers, sessions, missions) only need to live while
     their day can still be replayed; permanent keys (a word mastered, a
     stage finished) are kept for ever — they are what stops a second payment */
  function pruneEvents(st, now) {
    const cut = dayNum(dayOf(now)) - EVENT_KEEP_DAYS;
    for (const [k, d] of Object.entries(st.ev)) if (/^(a|s|m|sc):/.test(k) && dayNum(d) < cut) delete st.ev[k];
  }

  /* ---- levels: transparent thresholds, 0 · 100 · 300 · 600 · 1000 … ---- */
  function levelFloor(L) { return 50 * L * (L - 1); }
  function level(xp) {
    let L = 1; while (xp >= levelFloor(L + 1)) L++;
    const lo = levelFloor(L), hi = levelFloor(L + 1);
    return { level: L, xp, floor: lo, next: hi, into: xp - lo, need: hi - xp, pct: Math.round(100 * (xp - lo) / (hi - lo)) };
  }

  /* ---- mastery ---- */
  function isMastered(rec) { return !!(rec && rec.m); }
  function masteryCheck(rec) {
    return (rec.okDays || []).length >= MASTERY_DAYS && rec.act >= 1 && rec.lastOk === 1;
  }

  /* ---- one graded answer ----
     q: 0 again · 1 hard · 2 good · 3 easy.  skill: the skill the game measured
     (listening typed in counts as active; listening chosen from options does
     not).  Returns what happened, including XP paid and whether the word has
     just become mastered, so the screen can celebrate a REAL event only. */
  function grade(st, id, q, opts) {
    const o = Object.assign({ mode: "cards", skill: null, now: Date.now(), cat: null }, opts || {});
    const now = o.now, day = dayOf(now), mode = o.mode, skill = o.skill || MODE_SKILL[mode] || "recognition";
    q = clamp(Math.round(+q || 0), 0, 3);
    const r = term(st, id), ok = q >= 1;
    const firstToday = !r.last || dayOf(r.last) !== day;
    const due = !r.due || r.due <= now, wasNew = r.n === 0, wasDue = r.n > 0 && due;
    r.n++; r.last = now; r.lastOk = ok ? 1 : 0;
    if (ok) r.ok++;
    const sk = r.sk[skill] || (r.sk[skill] = [0, 0]); sk[1]++; if (ok) sk[0]++;

    /* the schedule only moves when the word was due (or never seen); practising
       ahead keeps the plan, but a failure is information and always counts */
    if (!ok) {
      r.lapses += r.n > 1 ? 1 : 0;
      r.iv = 0; r.due = now + RELEARN_MS; r.e = clamp(r.e - 20, EASE_MIN, EASE_MAX);
      if (r.m) { r.m = 0; }                    // mastery is lost until it is shown again (mEver stays)
      r.okDays = (r.okDays || []).filter(d => d !== day).slice(-1);   // a lapse: two more good days to earn it back
    } else if (due) {
      if (q === 1) { r.iv = Math.max(1, Math.round(r.iv * 1.2)); r.e = clamp(r.e - 15, EASE_MIN, EASE_MAX); }
      else if (q === 2) r.iv = r.iv === 0 ? 1 : r.iv === 1 ? 3 : Math.round(r.iv * r.e / 100);
      else { r.iv = r.iv === 0 ? 3 : Math.round(r.iv * r.e / 100 * 1.3); r.e = clamp(r.e + 15, EASE_MIN, EASE_MAX); }
      r.due = now + r.iv * DAY;
    }
    if (ok) {
      if (!r.okDays.includes(day)) r.okDays = r.okDays.concat(day).slice(-10);
      const active = skill === "recall" ? q >= 2 : ACTIVE.has(skill);
      if (active) r.act++;
    }

    /* aggregates for Game Performance */
    const D = st.days[day] || (st.days[day] = { n: 0, ok: 0, md: {} });
    D.n++; if (ok) D.ok++;
    const mk = D.md[mode] || (D.md[mode] = [0, 0]); mk[1]++; if (ok) mk[0]++;
    const sk2 = skill === "listening_typed" ? "listening" : skill;
    D.sk = D.sk || {}; const s3 = D.sk[sk2] || (D.sk[sk2] = [0, 0]); s3[1]++; if (ok) s3[0]++;

    let xp = 0, mastered = false;
    /* one paid correct answer per word, per game, per day */
    if (ok) xp += award(st, `a:${day}:${mode}:${id}`, XP.answer, now);
    if (ok && !r.m && masteryCheck(r)) {
      r.m = now; mastered = true;
      if (!r.mEver) r.mEver = now;
      xp += award(st, `w:${id}`, XP.mastered, now);
      if (r.hard || r.lapses >= 2) xp += award(st, `h:${id}`, XP.hardMastered, now);
    }
    return { ok, q, xp, mastered, firstToday, wasNew, wasDue, due: r.due };
  }

  /* the learner's own "this one is difficult" toggle */
  function setHard(st, id, on) { term(st, id).hard = on ? 1 : 0; }
  function setFav(st, id, on, now) { st.fav[id] = (on ? 1 : -1) * (now || Date.now()); }
  function isFav(st, id) { return (st.fav[id] || 0) > 0; }

  /* ---- what to practise next ----
     overdue first (the longer overdue the sooner), then the words this learner
     finds difficult, then new words in the corpus order (category by category),
     then words not due yet; mastered words that are not due come last. */
  function difficulty(rec) {
    if (!rec || !rec.n) return 0;
    const acc = rec.ok / rec.n;
    return (rec.hard ? 2 : 0) + Math.min(3, rec.lapses) + (rec.n >= 3 ? (1 - acc) * 3 : 0);
  }
  function priority(st, id, now, idx) {
    const r = st.t[id];
    if (!r || !r.n) return 500 - idx / 1000;                       // new
    const diff = difficulty(r);
    if (r.due && r.due <= now) return 1000 + Math.min(200, (now - r.due) / DAY * 10) + diff * 20;
    if (diff >= 2) return 700 + diff * 10;
    if (r.m) return 50 - (r.due - now) / DAY;
    return 300 - (r.due - now) / DAY;
  }
  function pick(st, ids, n, now, filter) {
    now = now || Date.now();
    return ids.map((id, i) => ({ id, p: priority(st, id, now, i) }))
      .filter(x => !filter || filter(x.id))
      .sort((a, b) => b.p - a.p || (a.id < b.id ? -1 : 1))
      .slice(0, n).map(x => x.id);
  }
  function dueCount(st, now) { return Object.values(st.t).filter(r => r.n && r.due && r.due <= now).length; }
  function difficultIds(st, n) {
    return Object.entries(st.t).filter(([, r]) => difficulty(r) >= 2 && !r.m).sort((a, b) => difficulty(b[1]) - difficulty(a[1]) || (a[0] < b[0] ? -1 : 1)).slice(0, n || 99).map(([id]) => id);
  }

  /* ---- deterministic shuffles (a seed, so tests and a resumed round agree) ---- */
  function rng(seed) { let s = (Math.imul((seed >>> 0) ^ 0x9e3779b9, 2654435761) >>> 0) || 1; for (let i = 0; i < 4; i++) { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; } return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function shuffle(a, seed) { const r = rng(seed), b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* drawings that look alike are never offered against each other */
  const LOOKALIKE = [["wm-electrode", "wm-tungsten-electrode", "wm-scriber", "wm-filler-rod"], ["wm-regulator", "wm-flowmeter"], ["wm-cutting-disc", "wm-flap-disc"]];
  function lookalike(a, b) { return LOOKALIKE.some(g => g.includes(a) && g.includes(b)); }
  /* three distractors: same category first (the confusable ones are the useful
     ones), never a look-alike for picture questions, never a duplicate label */
  function distractors(terms, target, n, seed, opts) {
    const o = opts || {}, byId = {}; terms.forEach(t => byId[t.id] = t);
    const T = byId[target]; if (!T) return [];
    const label = t => (o.label ? o.label(t) : t.en).toLowerCase();
    const pool = terms.filter(t => t.id !== target && (!o.needImg || t.img) && !(o.needImg && lookalike(t.id, target)) && label(t) !== label(T));
    const same = shuffle(pool.filter(t => t.cat === T.cat), seed), other = shuffle(pool.filter(t => t.cat !== T.cat), seed + 1);
    const out = [], seen = new Set([label(T)]);
    for (const t of same.concat(other)) { if (out.length >= n) break; if (seen.has(label(t))) continue; seen.add(label(t)); out.push(t.id); }
    return out;
  }

  /* ---- answer checking for typed answers (Word Builder, Listening) ----
     case, accents, hyphens and spaces are forgiven; the letters are not */
  function normAns(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, ""); }
  function checkTyped(input, t) {
    const a = normAns(input); if (!a) return false;
    return [t.en].concat(t.syn || []).some(x => normAns(x) === a);
  }
  /* letter tiles for Word Builder: the word's letters (no spaces/punctuation),
     shuffled so the order never spells the answer */
  function tiles(word, seed) {
    const letters = String(word).toUpperCase().replace(/[^A-Z0-9]/g, "").split("");
    let s = seed, out = shuffle(letters, s), guard = 0;
    while (letters.length > 2 && out.join("") === letters.join("") && guard++ < 10) out = shuffle(letters, ++s);
    return out;
  }
  function builderOk(t) { const n = String(t.en).replace(/[^A-Za-z0-9]/g, "").length; return n >= 2 && n <= 14; }
  /* the existing crossword generator takes single words of letters only */
  function crosswordOk(t) { return /^[a-z]{3,10}$/i.test(t.en); }

  /* A crossword is only shown if every crossing agrees and no two words touch
     side by side where they should not. cwGen in index.html builds the grid;
     this checks what it built. */
  function gridValid(layout) {
    if (!layout || !Array.isArray(layout.placed) || layout.placed.length < 2) return false;
    const cell = {};
    for (const p of layout.placed) {
      for (let i = 0; i < p.word.length; i++) {
        const r = p.dir === "a" ? p.r : p.r + i, c = p.dir === "a" ? p.c + i : p.c, k = r + "," + c;
        if (r < 0 || c < 0 || r >= layout.rows || c >= layout.cols) return false;
        if (cell[k] && cell[k] !== p.word[i]) return false;
        cell[k] = p.word[i];
      }
    }
    /* every run of letters in the grid must be a placed word (or a single crossing letter) */
    const words = new Set(layout.placed.map(p => p.dir + p.r + "," + p.c + p.word));
    for (let r = 0; r < layout.rows; r++) for (let c = 0; c < layout.cols; c++) {
      for (const dir of ["a", "d"]) {
        const prev = dir === "a" ? cell[r + "," + (c - 1)] : cell[(r - 1) + "," + c];
        if (!cell[r + "," + c] || prev) continue;
        let w = "", rr = r, cc = c;
        while (cell[rr + "," + cc]) { w += cell[rr + "," + cc]; if (dir === "a") cc++; else rr++; }
        if (w.length > 1 && !words.has(dir + r + "," + c + w)) return false;
      }
    }
    return true;
  }

  /* ---- sessions: a round of a game ---- */
  function finishSession(st, s, now) {
    const day = dayOf(now), out = { xp: 0, paid: false };
    const M = st.modes[s.mode] || (st.modes[s.mode] = { runs: 0, ok: 0, n: 0, best: 0 });
    M.runs++; M.ok += s.ok || 0; M.n += s.n || 0;
    const pct = s.n ? Math.round(100 * (s.ok || 0) / s.n) : 0; if (pct > M.best) M.best = pct;
    if ((s.n || 0) >= SESSION_MIN_ANSWERS) {
      const paidToday = Object.keys(st.ev).filter(k => k.startsWith("s:" + day + ":")).length;
      if (paidToday < SESSIONS_PAID_PER_DAY) { out.xp = award(st, `s:${day}:${s.id}`, XP.session, now); out.paid = out.xp > 0; }
    }
    const D = st.days[day] || (st.days[day] = { n: 0, ok: 0, md: {} });
    D.runs = D.runs || {}; D.runs[s.mode] = (D.runs[s.mode] || 0) + 1;
    st.resume = null;
    return out;
  }

  /* ---- streak: days with at least one graded answer. One rest day a week is
     forgiven (owner spec: motivate, never punish) — a single missed day does
     not reset it if no other day was forgiven in the seven before it. ---- */
  function streak(st, now) {
    const days = new Set(Object.keys(st.days).filter(d => st.days[d].n > 0));
    if (!days.size) return { current: 0, best: 0, today: false, rest: false };
    const today = dayNum(dayOf(now)), has = n => days.has(new Date(n * DAY).toISOString().slice(0, 10));
    const walk = start => {
      let n = 0, d = start, lastRest = null, rested = false;
      for (;;) {
        if (has(d)) { n++; d--; continue; }
        /* a single missed day between two active days, the first in seven */
        if (n > 0 && has(d - 1) && (lastRest === null || lastRest - d > 7)) { lastRest = d; rested = true; d--; continue; }
        break;
      }
      return { n, rested };
    };
    const t = has(today), start = t ? today : today - 1;
    const cur = has(start) ? walk(start) : { n: 0, rested: false };
    let best = cur.n;
    for (const d of days) best = Math.max(best, walk(dayNum(d)).n);
    return { current: cur.n, best, today: t, rest: cur.rested };
  }

  /* ---- achievements: data, not code paths ---- */
  const ACH = [
    { id: "first_practice", ic: "spark", test: x => x.answers >= 1 },
    { id: "first_mastered", ic: "medal", test: x => x.mastered >= 1 },
    { id: "mastered_10", ic: "medal", test: x => x.mastered >= 10 },
    { id: "safety_25", ic: "shield", test: x => (x.byCat.ppe || 0) >= 25 },
    { id: "first_listen", ic: "headphones", test: x => (x.runs.listen || 0) >= 1 },
    { id: "first_workshop", ic: "workshop", test: x => (x.runs.workshop || 0) >= 1 },
    { id: "first_stage", ic: "flag", test: x => x.stagesDone >= 1 },
    { id: "mastered_50", ic: "trophy", test: x => x.mastered >= 50 },
    { id: "mastered_100", ic: "trophy", test: x => x.mastered >= 100 },
    { id: "mastered_250", ic: "crown", test: x => x.mastered >= 250 }
  ];
  function facts(st, terms) {
    const byCat = {}, cats = {};
    terms.forEach(t => { cats[t.cat] = (cats[t.cat] || 0) + 1; if (isMastered(st.t[t.id])) byCat[t.cat] = (byCat[t.cat] || 0) + 1; });
    const official = new Set(terms.map(t => t.id));
    const mastered = Object.entries(st.t).filter(([id, r]) => official.has(id) && isMastered(r)).length;
    const answers = Object.values(st.days).reduce((a, d) => a + (d.n || 0), 0);
    const runs = {}; for (const [m, v] of Object.entries(st.modes)) runs[m] = v.runs || 0;
    const stagesDone = Object.keys(cats).filter(c => (byCat[c] || 0) >= cats[c]).length;
    return { mastered, byCat, cats, answers, runs, stagesDone };
  }
  /* grants what is newly true; never revokes (an achievement is a moment that happened) */
  function checkAchievements(st, terms, now) {
    const x = facts(st, terms), got = [];
    for (const a of ACH) if (!st.ach[a.id] && a.test(x)) { st.ach[a.id] = now; got.push(a.id); }
    /* a finished stage pays once */
    let xp = 0;
    for (const c of Object.keys(x.cats)) if ((x.byCat[c] || 0) >= x.cats[c]) { const p = award(st, `g:${c}`, XP.stage, now); if (p) { xp += p; got.push("stage:" + c); } }
    return { got, xp };
  }

  /* ---- the journey: one stage per category, progress from mastery ---- */
  function journey(st, terms, categories) {
    return categories.map((c, i) => {
      const ids = terms.filter(t => t.cat === c.id).map(t => t.id);
      const mastered = ids.filter(id => isMastered(st.t[id])).length, seen = ids.filter(id => st.t[id] && st.t[id].n).length;
      const pct = ids.length ? Math.round(100 * mastered / ids.length) : 0;
      return { id: c.id, n: ids.length, mastered, seen, pct, done: ids.length > 0 && mastered >= ids.length, started: seen > 0, i };
    });
  }

  /* ---- Today's Shift: one small, real mission a day (3–7 minutes) ----
     chosen from what the learner actually has; a new learner gets the starter */
  const MISSIONS = {
    start5:   { mode: "cards",   target: 5, ic: "cards" },      // learn five new words
    hard5:    { mode: "cards",   target: 5, ic: "target" },     // review five difficult words
    due5:     { mode: "cards",   target: 5, ic: "clock" },      // review five words that are due
    tools5:   { mode: "visual",  target: 5, ic: "tool" },       // identify five tools correctly
    listen1:  { mode: "listen",  target: 1, ic: "headphones" }, // complete one listening challenge
    recall3:  { mode: "builder", target: 3, ic: "keyboard" },   // spell three words without a hint
    workshop1:{ mode: "workshop",target: 1, ic: "workshop" }    // complete one workshop challenge
  };
  function chooseMission(st, terms, now) {
    const day = dayOf(now), y = dayOf(now - DAY);
    const yesterday = st.mis && st.mis.day === y ? st.mis.kind : null;
    const seen = Object.values(st.t).filter(r => r.n).length;
    const runs = k => (st.modes[k] && st.modes[k].runs) || 0;
    const tools = terms.filter(t => t.img && (t.cat === "tools" || t.cat === "ppe")).length;
    const order = [];
    if (seen < 5) order.push("start5");
    if (difficultIds(st).length >= 5) order.push("hard5");
    if (dueCount(st, now) >= 5) order.push("due5");
    if (seen >= 5 && !runs("listen")) order.push("listen1");
    if (seen >= 5 && tools) order.push("tools5");
    if (seen >= 10) order.push("recall3");
    if (seen >= 10 && !runs("workshop")) order.push("workshop1");
    order.push("start5");
    /* not the same mission two days running when there is another choice */
    const kind = order.find(k => k !== yesterday) || order[0];
    const ids = kind === "hard5" ? difficultIds(st, 5) : [];
    return { day, kind, mode: MISSIONS[kind].mode, target: MISSIONS[kind].target, prog: 0, done: 0, ids };
  }
  function ensureMission(st, terms, now) {
    if (!st.mis || st.mis.day !== dayOf(now)) st.mis = chooseMission(st, terms, now);
    return st.mis;
  }
  /* called with every graded answer and every finished round; returns XP paid
     when this event completed the mission */
  function missionStep(st, ev, now) {
    const m = st.mis; if (!m || m.day !== dayOf(now) || m.done) return 0;
    let inc = 0;
    if (ev.type === "answer" && ev.ok) {
      if (m.kind === "start5" && ev.mode === "cards" && ev.wasNew) inc = 1;
      if (m.kind === "due5" && ev.mode === "cards" && ev.wasDue) inc = 1;
      if (m.kind === "hard5" && ev.mode === "cards" && (m.ids || []).includes(ev.id)) inc = 1;
      if (m.kind === "tools5" && ev.mode === "visual") inc = 1;
      if (m.kind === "recall3" && ev.mode === "builder" && !ev.hint) inc = 1;
    }
    if (ev.type === "session" && (m.kind === "listen1" && ev.mode === "listen" || m.kind === "workshop1" && ev.mode === "workshop") && ev.n >= 1) inc = 1;
    if (!inc) return 0;
    m.prog = Math.min(m.target, m.prog + inc);
    if (m.prog >= m.target) { m.done = now; return award(st, `m:${m.day}`, XP.mission, now); }
    return 0;
  }

  /* ---- Game Performance (Progress page) ----
     only what was measured; a rate is shown only with enough answers behind it */
  const MIN_SAMPLE = 10;
  function performance(st, terms, now, span) {
    span = span || 30;
    const today = dayNum(dayOf(now));
    const inSpan = (d, a, b) => { const n = today - dayNum(d); return n >= a && n < b; };
    const sum = (a, b) => {
      const sk = {}, md = {}; let n = 0, ok = 0, active = 0;
      for (const [d, D] of Object.entries(st.days)) {
        if (!inSpan(d, a, b)) continue;
        n += D.n || 0; ok += D.ok || 0; if (D.n) active++;
        for (const [k, v] of Object.entries(D.sk || {})) { const x = sk[k] || (sk[k] = [0, 0]); x[0] += v[0]; x[1] += v[1]; }
        for (const [k, v] of Object.entries(D.md || {})) { const x = md[k] || (md[k] = [0, 0]); x[0] += v[0]; x[1] += v[1]; }
      }
      return { n, ok, active, sk, md };
    };
    const cur = sum(0, span), last7 = sum(0, 7), prev7 = sum(7, 14);
    const rate = v => v && v[1] >= MIN_SAMPLE ? Math.round(100 * v[0] / v[1]) : null;
    const skills = SKILLS.map(k => ({ id: k, n: (cur.sk[k] || [0, 0])[1], pct: rate(cur.sk[k]) }));
    const modes = MODES.map(k => ({ id: k, n: (cur.md[k] || [0, 0])[1], pct: rate(cur.md[k]), runs: (st.modes[k] && st.modes[k].runs) || 0, best: (st.modes[k] && st.modes[k].best) || 0 }));
    const xpSeries = []; for (let i = 13; i >= 0; i--) { const d = new Date((today - i) * DAY).toISOString().slice(0, 10); xpSeries.push({ d, xp: st.xpDay[d] || 0, n: (st.days[d] && st.days[d].n) || 0 }); }
    const f = facts(st, terms);
    const improved = SKILLS.map(k => {
      const a = rate(last7.sk[k]), b = rate(prev7.sk[k]);
      return a != null && b != null && a - b >= 10 ? { id: k, from: b, to: a } : null;
    }).filter(Boolean);
    const newlyMastered = Object.entries(st.t).filter(([, r]) => r.m && today - dayNum(dayOf(r.m)) < 7).map(([id]) => id);
    const days7 = Object.keys(st.days).filter(d => inSpan(d, 0, 7) && st.days[d].n).length;
    return {
      mastered: f.mastered, total: terms.length, byCat: f.byCat, cats: f.cats,
      answers: cur.n, accuracy: cur.n >= MIN_SAMPLE ? Math.round(100 * cur.ok / cur.n) : null,
      activeDays: cur.active, days7, xp: xpTotal(st), xpSeries, skills, modes, improved, newlyMastered,
      difficult: difficultIds(st, 8), due: dueCount(st, now), empty: !Object.keys(st.days).length
    };
  }
  /* one plain next step, from the numbers above; no claim without a sample */
  const SKILL_MODE = { recognition: "quiz", recall: "cards", listening: "listen", context: "workshop", spelling: "builder", visual: "visual" };
  function recommend(perf) {
    if (perf.empty) return { kind: "first", mode: "cards" };
    const rated = perf.skills.filter(s => s.pct != null).sort((a, b) => b.pct - a.pct);
    if (rated.length >= 2 && rated[0].pct - rated[rated.length - 1].pct >= 15)
      return { kind: "gap", strong: rated[0].id, weak: rated[rated.length - 1].id, mode: SKILL_MODE[rated[rated.length - 1].id] };
    if (perf.due >= 5) return { kind: "due", n: perf.due, mode: "cards" };
    if (perf.difficult.length >= 3) return { kind: "difficult", n: perf.difficult.length, mode: "cards" };
    const untried = perf.skills.find(s => s.n === 0);
    if (untried) return { kind: "try", skill: untried.id, mode: SKILL_MODE[untried.id] };
    return { kind: "keep", mode: "quiz" };
  }

  /* ---- cloud merge: two devices, one record; nothing is inflated ---- */
  function maxMap(a, b) { const o = Object.assign({}, b || {}); for (const [k, v] of Object.entries(a || {})) o[k] = Math.max(+v || 0, +o[k] || 0); return o; }
  function mergeArea(L, C) {
    if (!C) return L; if (!L) return C;
    L = normalize(JSON.parse(JSON.stringify(L))); C = normalize(JSON.parse(JSON.stringify(C)));
    const m = fresh();
    /* a word: the copy with more answers behind it wins; a tie goes to the newer */
    for (const id of new Set(Object.keys(L.t).concat(Object.keys(C.t)))) {
      const a = L.t[id], b = C.t[id];
      m.t[id] = !a ? b : !b ? a : (a.n > b.n || (a.n === b.n && a.last >= b.last)) ? a : b;
      if (a && b) { m.t[id].mEver = Math.min(a.mEver || Infinity, b.mEver || Infinity); if (!isFinite(m.t[id].mEver)) m.t[id].mEver = 0; m.t[id].hard = (a.last >= b.last ? a : b).hard; }
    }
    for (const id of new Set(Object.keys(L.fav).concat(Object.keys(C.fav)))) { const a = L.fav[id] || 0, b = C.fav[id] || 0; m.fav[id] = Math.abs(a) >= Math.abs(b) ? a : b; }
    for (const id of new Set(Object.keys(L.mine).concat(Object.keys(C.mine)))) { const a = L.mine[id], b = C.mine[id]; m.mine[id] = !a ? b : !b ? a : (a.u >= b.u ? a : b); }
    m.xpDay = maxMap(L.xpDay, C.xpDay);              // per day, the larger — never the sum
    m.ev = Object.assign({}, C.ev, L.ev);
    for (const d of new Set(Object.keys(L.days).concat(Object.keys(C.days)))) { const a = L.days[d], b = C.days[d]; m.days[d] = !a ? b : !b ? a : ((a.n || 0) >= (b.n || 0) ? a : b); }
    for (const k of new Set(Object.keys(L.modes).concat(Object.keys(C.modes)))) { const a = L.modes[k] || {}, b = C.modes[k] || {}; m.modes[k] = (a.runs || 0) >= (b.runs || 0) ? Object.assign({}, a, { best: Math.max(a.best || 0, b.best || 0) }) : Object.assign({}, b, { best: Math.max(a.best || 0, b.best || 0) }); }
    for (const k of new Set(Object.keys(L.ach).concat(Object.keys(C.ach)))) m.ach[k] = Math.min(L.ach[k] || Infinity, C.ach[k] || Infinity);
    m.mis = !L.mis ? C.mis : !C.mis ? L.mis : (L.mis.day > C.mis.day ? L.mis : C.mis.day > L.mis.day ? C.mis : ((L.mis.done || L.mis.prog >= (C.mis.prog || 0)) ? L.mis : C.mis));
    m.set = L.set; m.resume = (L.resume && (!C.resume || L.resume.ts >= C.resume.ts)) ? L.resume : C.resume;
    m.ws = maxMap(L.ws, C.ws);
    /* history: union by round id; when both devices hold a round, the one with more answers wins */
    { const by = {}; for (const r of [].concat(C.hist || [], L.hist || [])) { if (!r || !r.id) continue; const c = by[r.id]; if (!c || (r.it ? r.it.length : 0) > (c.it ? c.it.length : 0) || (!c.it && r.it)) by[r.id] = r; }
      m.hist = Object.values(by).sort((a, b) => a.ts - b.ts); capHist(m); }
    return m;
  }
  function merge(local, cloud) {
    const out = {};
    for (const a of new Set(Object.keys(local || {}).concat(Object.keys(cloud || {})))) out[a] = mergeArea((local || {})[a], (cloud || {})[a]);
    return out;
  }
  /* the cloud copy is trimmed: per-day aggregates older than 120 days go */
  function trimForSync(st, now) {
    const s = JSON.parse(JSON.stringify(st)), cut = dayNum(dayOf(now)) - 120;
    for (const d of Object.keys(s.days || {})) if (dayNum(d) < cut) delete s.days[d];
    s.resume = null;
    return s;
  }

  /* ---- the learner's history: every round, every answer ----
     One record per round (finished or left part-way): the game, when, the
     score, the XP, and each answer — what was asked (k), what the learner
     chose or typed (p), whether it was right (o) and whether a hint was used
     (h). The newest HIST_FULL rounds keep their answers; older ones keep the
     summary line, so years of practice still fit in the synced record. */
  const HIST_FULL = 200, HIST_MAX = 1000;
  function compactItem(x) {
    const o = { o: x.ok ? 1 : 0 };
    if (x.t) o.t = String(x.t).slice(0, 60);
    if (x.s) o.s = String(x.s).slice(0, 12);          // a workshop scenario id
    if (x.k) o.k = String(x.k).slice(0, 12);          // the kind of question
    if (x.p != null && x.p !== "") o.p = cleanText(x.p, 40);   // the learner's choice or typed answer
    if (x.q != null) o.q = x.q;                        // a card rating 0–3
    if (x.h) o.h = 1;
    return o;
  }
  function logRound(st, r, now) {
    if (!r || !r.id || !(r.items && r.items.length)) return null;
    const cats = [...new Set((r.cats || []).filter(Boolean))].slice(0, 10);
    const rec = { id: String(r.id).slice(0, 40), m: r.mode, ts: r.ts || now, end: now, n: r.n || 0, ok: r.ok || 0, xp: r.xp || 0, cats, it: r.items.slice(0, 60).map(compactItem) };
    if (r.part) rec.part = 1;
    st.hist = (st.hist || []).filter(x => x.id !== rec.id).concat(rec).sort((a, b) => a.ts - b.ts);
    capHist(st);
    return rec;
  }
  function capHist(st) {
    if (st.hist.length > HIST_MAX) st.hist = st.hist.slice(-HIST_MAX);
    const cut = st.hist.length - HIST_FULL;
    for (let i = 0; i < cut; i++) if (st.hist[i].it) { st.hist[i].sum = 1; delete st.hist[i].it; }
  }
  function histRound(st, id) { return (st.hist || []).find(x => x.id === id) || null; }
  /* by day, newest first: [{day, rounds:[…newest first], n, ok, xp}] */
  function histByDay(st) {
    const by = {};
    for (const r of st.hist || []) { const d = dayOf(r.ts); (by[d] = by[d] || { day: d, rounds: [], n: 0, ok: 0, xp: 0 }); const g = by[d]; g.rounds.push(r); g.n += r.n; g.ok += r.ok; g.xp += r.xp || 0; }
    return Object.values(by).sort((a, b) => (a.day < b.day ? 1 : -1)).map(g => (g.rounds.sort((a, b) => b.ts - a.ts), g));
  }
  /* every word the learner got wrong, grouped by stage: how often, when last,
     and where it stands now (still difficult / answered right since / mastered) */
  function errorsByStage(st, terms) {
    const cat = {}; terms.forEach(t => cat[t.id] = t.cat);
    const by = {};
    for (const r of st.hist || []) for (const x of r.it || []) {
      if (x.o || !x.t) continue;
      const c = cat[x.t] || (String(x.t).startsWith("my-") ? "mine" : null); if (!c) continue;
      const g = by[c] || (by[c] = {}); const e = g[x.t] || (g[x.t] = { t: x.t, n: 0, last: 0, picks: [] });
      e.n++; if (r.ts > e.last) e.last = r.ts; if (x.p && !e.picks.includes(x.p) && e.picks.length < 3) e.picks.push(x.p);
    }
    const out = {};
    for (const [c, g] of Object.entries(by)) out[c] = Object.values(g).map(e => {
      const rec = st.t[e.t];
      e.now = rec && rec.m ? "mastered" : rec && rec.lastOk && rec.last > e.last ? "fixed" : "open";
      return e;
    }).sort((a, b) => (a.now === "open" ? 0 : 1) - (b.now === "open" ? 0 : 1) || b.n - a.n || b.last - a.last);
    return out;
  }

  /* ---- custom words: the learner's own, never mixed with the official list ---- */
  function cleanText(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
  function addMine(st, input, now, officialTerms) {
    const en = cleanText(input.en, 60), fr = cleanText(input.fr, 60), def = cleanText(input.def, 220), ex = cleanText(input.ex, 220);
    if (!en || !/[A-Za-z]/.test(en)) return { error: "empty" };
    const key = normAns(en);
    const live = Object.values(st.mine).filter(w => !w.del && w.id !== input.id);
    if (live.some(w => normAns(w.en) === key)) return { error: "duplicate" };
    if ((officialTerms || []).some(t => normAns(t.en) === key)) return { error: "official" };
    if (!input.id && live.length >= 200) return { error: "full" };
    const id = input.id && st.mine[input.id] ? input.id : "my-" + hash(en + ":" + now).toString(36);
    st.mine[id] = { id, en, fr, def, ex, u: now };
    return { id };
  }
  function delMine(st, id, now) { if (st.mine[id]) { st.mine[id] = { id, del: 1, u: now }; delete st.t[id]; delete st.fav[id]; return true; } return false; }
  function mineList(st) { return Object.values(st.mine).filter(w => w && !w.del && w.en).sort((a, b) => b.u - a.u); }
  /* a custom word in the shape every game reads */
  function mineAsTerm(w) {
    return { id: w.id, en: w.en, fr: w.fr || "", syn: [], frSyn: [], cat: "mine", lvl: "", def: { en: w.def || "", fr: "" }, use: { en: "", fr: "" }, ctx: { en: "", fr: "" }, ex: { en: w.ex || "", fr: "" }, mine: true };
  }

  const api = {
    VERSION, MODES, SKILLS, MODE_SKILL, Q, XP, MASTERY_DAYS, SESSION_MIN_ANSWERS, SESSIONS_PAID_PER_DAY, ACH, MISSIONS, MIN_SAMPLE, LOOKALIKE,
    dayOf, fresh, normalize, term, grade, award, xpTotal, pruneEvents, level, levelFloor, isMastered, masteryCheck, setHard, setFav, isFav,
    difficulty, priority, pick, dueCount, difficultIds, rng, shuffle, hash, distractors, lookalike, normAns, checkTyped, tiles, builderOk, crosswordOk, gridValid,
    finishSession, streak, facts, checkAchievements, journey, chooseMission, ensureMission, missionStep, performance, recommend,
    merge, mergeArea, trimForSync, logRound, histRound, histByDay, errorsByStage, HIST_FULL, HIST_MAX, addMine, delMine, mineList, mineAsTerm, cleanText
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.WMEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
