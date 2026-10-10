  /* ------------------------------------------------------------ games
     What each game draws from, in the order the CURRICULUM suggests: the
     learner's current week of the 12-week plan first (and the week after),
     then everyday English, then First steps (first for a learner placed in
     Foundations), then the rest. Due and difficult items still come first —
     that is the engine's spaced-repetition rule (E.pick). */
  const SIZE = { cards: 10, quiz: 8, sentence: 6, listen: 6, speak: 5, match: 10, puzzle: 6, missions: 4 };
  function curWeek() { try { return typeof currentPos === "function" ? (currentPos().w || 1) : 1; } catch (e) { return 1; } }
  function inFoundations() { try { return typeof fndGated === "function" && fndGated(); } catch (e) { return false; } }
  function rank(t, wk, fnd) {
    if (t.cat === "first") return fnd ? 0 : 3;
    if (t.wk) { const d = Math.abs(t.wk - wk); return d <= 1 ? (fnd ? 2 : 0) : 4 + d; }
    return t.mine ? 2 : 1;
  }
  function aligned(list) { const wk = curWeek(), fnd = inFoundations(); return list.map((t, i) => ({ t, i, r: rank(t, wk, fnd) })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.t); }
  const words = s => clean(s).split(/\s+/).filter(Boolean);
  function poolFor(mode) {
    const all = mode === "cards" ? allTerms() : official();
    if (mode === "cards") return all;
    if (mode === "sentence") return all.filter(t => { const n = words(sentenceOf(t)).length; return n >= 4 && n <= 12; });
    if (mode === "speak") return all.filter(t => { const n = words(sentenceOf(t)).length; return n >= 3 && n <= 14; });
    if (mode === "puzzle") return all.filter(t => /^[A-Za-z]{3,12}$/.test(t.en) && t.def && t.def.en);
    if (mode === "listen") return all.filter(t => t.kind === "sentence" || (t.def && t.def.en));
    return all.filter(t => t.kind !== "sentence");   // quiz, match: words and phrases with a meaning
  }
  function chooseMissions(o) {
    const s = st();
    if (o.advanced) return (_pack && _pack.scenarios || []).slice().sort((a, b) => (s.ws[a.id] || 0) - (s.ws[b.id] || 0) || (a.id < b.id ? -1 : 1)).slice(0, 5).map(x => x.id);
    const wk = curWeek();
    const near = m => m.wk ? Math.abs(m.wk - wk) : 1;   // everyday situations sit beside the current week
    return C.missions.filter(m => !o.cat || m.cat === o.cat).slice().sort((a, b) => (s.ws[a.id] || 0) - (s.ws[b.id] || 0) || near(a) - near(b) || (a.id < b.id ? -1 : 1)).slice(0, o.n || SIZE.missions).map(x => x.id);
  }
  function chooseIds(mode, opts) {
    const s = st(), now = Date.now(), o = opts || {};
    if (mode === "missions") return chooseMissions(o);
    let pool = aligned(poolFor(mode));
    if (o.ids) { const set = new Set(o.ids); pool = pool.filter(t => set.has(t.id)); if (o.keepOrder) return o.ids.filter(id => pool.some(t => t.id === id)).slice(0, o.n || 20); }
    if (o.cat) pool = pool.filter(t => t.cat === o.cat);
    const filter = o.onlyNew ? id => !s.t[id] || !s.t[id].n : o.onlyDue ? id => s.t[id] && s.t[id].n && s.t[id].due <= now : null;
    const n = o.n || SIZE[mode];
    /* Quick Quiz carries two grammar questions, Sentence Builder one "find the correct sentence" */
    const g = !o.cat && !o.ids && !filter ? (mode === "quiz" ? 2 : mode === "sentence" ? 1 : 0) : 0;
    let ids = E.pick(s, pool.map(t => t.id), n - g, now, filter);
    if (ids.length < (o.min || 1) && filter) ids = E.pick(s, pool.map(t => t.id), n - g, now);
    if (g && C.grammar.length) {
      const gp = C.grammar.filter(x => mode === "quiz" ? x.cat !== "correction" : x.cat === "correction").map(x => x.id);
      E.pick(s, gp, g, now).forEach((gid, k) => ids.splice(Math.min(ids.length, 2 + k * 3), 0, gid));
    }
    return ids;
  }
  function canRecord() { try { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); } catch (e) { return false; } }
  function start(mode, opts) {
    if (!on() || !C) return;
    const o = opts || {};
    if (mode === "listen" && !canSpeak()) { gameOpen(mode, `<div class="wm-g-msg">${wi("headphones", "big")}<p>${h(w("l_no_audio"))}</p><button class="btn btn-p" data-em="gclose">${h(w("close"))}</button></div>`); return; }
    if (mode === "speak" && !canRecord()) { gameOpen(mode, `<div class="wm-g-msg">${wi("mic", "big")}<p>${h(w("sp_mic"))}</p><button class="btn btn-p" data-em="gclose">${h(w("close"))}</button></div>`); return; }
    const ids = o.resume ? o.resume.ids : o.daily ? dailyIds() : chooseIds(mode, o);
    if (!ids.length || (mode === "match" && ids.length < 4) || (mode === "quiz" && official().length < 4)) { gameOpen(mode, `<div class="wm-g-msg"><p>${h(w("none_words"))}</p><button class="btn btn-p" data-em="gclose">${h(w("close"))}</button></div>`); return; }
    /* every round needs a signed-in account: XP is awarded and saved by the server */
    if (!signedIn()) return authSheet();
    const sid = o.resume ? o.resume.sid : rid(mode);
    const smode = o.daily || (o.resume && o.resume.daily) ? "daily" : o.advanced || (o.resume && o.resume.adv) ? "advanced" : mode;
    const begin = (ticket, offline) => {
      const prevLog = o.resume ? E.histRound(st(), sid) : null;
      _G = { log: prevLog && prevLog.it ? prevLog.it.map(x => ({ ok: x.o, t: x.t, s: x.s, k: x.k, p: x.p, q: x.q, h: x.h })) : [], t0: prevLog ? prevLog.ts : Date.now(), mode, ids, i: o.resume ? o.resume.i : 0, sid, n: o.resume ? o.resume.n || 0 : 0, ok: o.resume ? o.resume.ok || 0 : 0, xp: 0, mastered: [], combo: 0, seed: E.hash(sid), opts: o, step: 0, st: {},
        smode, ticket, offline: !!offline, daily: smode === "daily", adv: smode === "advanced" };
      if (mode === "match") return matchRound();
      draw();
    };
    _G = null;
    gameOpen(mode, `<div class="wm-g-msg" role="status">${wi("bolt", "big")}<p>${h(w(EM_CHARGED.has(smode) && !isPremium() ? "en_check" : "en_open"))}</p></div>`);
    srv("start", { sid, mode: smode }).then(r => {
      if (r.status === 200 && r.j && r.j.ticket) { srvApply(r.j); persist(); return begin(r.j.ticket, false); }
      gameClose();
      if (r.status === 429 && r.j && r.j.error === "energy") { if (_srv && _srv.energy) _srv.energy.used = _srv.energy.limit; return energySheet(r.j); }
      if (r.status === 401) return authSheet();
      if (r.status === 402) return premiumAsk("em_advanced");
      if (r.status === 403 && r.j && r.j.error === "track") return msgSheet("map", w("trk_h"), w("trk_b"));
      return offlineStart();
    }).catch(() => { gameClose(); offlineStart(); });
    /* the server cannot be reached: nothing is charged. Review (Word Quest) still
       runs, without XP; a challenge waits for a connection rather than run unaccounted. */
    function offlineStart() {
      if (EM_CHARGED.has(smode) || smode === "daily") return msgSheet("bolt", w("off_h"), w("off_b"));
      begin(null, true);
    }
  }
  function premiumAsk(from) {
    let offer = false; try { offer = premOffered(); } catch (e) {}
    sheet(`<div class="wm-en-sheet"><span class="wm-en-big prem">${wi("crown")}</span><h2>${h(w("pr_h"))}</h2><p>${h(w("pr_b"))}</p>
      <ul class="wm-list"><li>${wi("bolt")} ${h(w("pr_1"))}</li><li>${wi("chat")} ${h(w("pr_2"))}</li><li>${wi("chart")} ${h(w("pr_3"))}</li><li>${wi("spark")} ${h(w("pr_4"))}</li></ul>
      ${offer ? `<button class="btn btn-p wm-wide wm-prem-btn" data-em="premium" data-a="${h(from)}">${wi("crown")} ${h(w("pr_btn"))}</button>` : `<p class="wm-mut small">${h(w("pr_soon"))}</p>`}</div>`);
  }
  function startMission() {
    const s = st(), m = s.mis; if (!m || m.done) return;
    const left = m.target - m.prog;
    if (m.kind === "start5") return start("cards", { onlyNew: true, n: Math.max(left, 1) });
    if (m.kind === "hard5") return start("cards", { ids: m.ids, keepOrder: true, n: 10 });
    if (m.kind === "due5") return start("cards", { onlyDue: true, n: Math.max(left + 2, 5) });
    if (m.kind === "speak3") return start("speak", { n: Math.max(left + 2, 4) });
    if (m.kind === "sentence3") return start("sentence", { n: Math.max(left + 2, 5) });
    return start(m.mode);
  }
