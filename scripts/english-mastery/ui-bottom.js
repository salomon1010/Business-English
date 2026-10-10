  function feedbackHTML(t, okFlag, extra) {
    return `<div class="wm-fb ${okFlag ? "ok" : "no"}" role="status">${wi(okFlag ? "check" : "cross")}<div><b>${h(okFlag ? w("ok") : w("no"))}</b>${okFlag ? "" : `<span>${h(w("the_answer", { w: t.en }))}</span>`}
      ${t.kind === "sentence" ? "" : `<p lang="en">${h(t.def.en)}</p>`}${t.ex && t.ex.en ? `<p lang="en"><i>“${h(t.ex.en)}”</i></p>` : ""}${extra || ""}${glossHTML(t)}</div></div>
      <button class="btn btn-p wm-wide" data-em="next" autofocus>${h(w("next"))} →</button>`;
  }
  function gramFeedbackHTML(g, okFlag) {
    return `<div class="wm-fb ${okFlag ? "ok" : "no"}" role="status">${wi(okFlag ? "check" : "cross")}<div><b>${h(okFlag ? w("ok") : w("no"))}</b>${okFlag ? "" : `<span lang="en">${h(w("the_answer", { w: g.o[g.a] }))}</span>`}<p lang="en">${h(g.why)}</p></div></div>
      <button class="btn btn-p wm-wide" data-em="next" autofocus>${h(w("next"))} →</button>`;
  }
  const optsHTML = (list, ans, rightId, act, lbl) => `<div class="wm-opts" role="group">${list.map(id => { const cls = ans != null ? (id === rightId ? "correct" : id === ans ? "wrong" : "") : ""; return `<button class="wm-opt ${cls}" data-em="${act}" data-a="${h(id)}" ${ans != null ? "disabled" : ""}>${h(lbl(id))}</button>`; }).join("")}</div>`;

  /* -- Game 1: Word Quest (cards) -- */
  function cardsHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    return `<div class="wm-card ${G.st.flipped ? "flipped" : ""}">
        <div class="wm-card-front">${catArt(t.cat)}<small>${h(catName(t.cat))}${t.lvl ? " · " + h(t.lvl) : ""}</small><b class="wm-card-w ${t.kind === "sentence" ? "long" : ""}" lang="en">${h(t.en)}</b>
          <button class="btn btn-g btn-sm" data-em="say" data-a="${h(t.kind === "sentence" ? t.en : clean(t.en))}">${wi("sound")} ${h(w("hear"))}</button></div>
        ${G.st.flipped ? `<div class="wm-card-back">${fullCardHTML(t, true, true)}</div>` : ""}
      </div>
      ${G.st.flipped ? `<p class="wm-rate-q">${h(w("rate_q"))}</p><div class="wm-rate">${[["again", 0], ["hard", 1], ["good", 2], ["easy", 3]].map(([k, q]) => `<button class="wm-rate-b r${q}" data-em="rate" data-a="${q}">${h(w(k))}</button>`).join("")}</div>`
        : `<button class="btn btn-p wm-wide" data-em="flip" autofocus>${h(w("reveal"))}</button>`}`;
  }

  /* -- Game 2: Quick Quiz (words, phrases and grammar) -- */
  const quizPool = () => official().filter(t => t.kind !== "sentence");
  function quizQ(t, seed) {
    const r = E.rng(seed), types = ["def"].concat(t.ex && t.ex.en && blank(t.ex.en, t) !== t.ex.en ? ["ex"] : []).concat(t.use && t.use.en && t.kind === "phrase" ? ["use"] : []);
    const type = types[Math.floor(r() * types.length)];
    const opts = E.shuffle([t.id].concat(E.distractors(quizPool(), t.id, 3, seed, { label: x => x.en })), seed + 7);
    const prompt = type === "def" ? `<p class="wm-q-clue" lang="en">“${h(blank(t.def.en, t))}”</p>` : type === "ex" ? `<p class="wm-q-clue" lang="en">“${h(blank(t.ex.en, t))}”</p>` : `<p class="wm-q-clue" lang="en">${h(t.use.en)}</p>`;
    return { type, opts, prompt, skill: type === "def" ? "recognition" : "context" };
  }
  function quizHTML() {
    const G = _G, id = G.ids[G.i], g = gram(id);
    if (g) {
      const ans = G.st.ans;
      return `<p class="wm-q-h">${h(w("q_gram"))}</p><div class="wm-q-p"><p class="wm-q-clue" lang="en">${h(g.q)}</p></div>
        ${optsHTML(g.o.map((_, k) => String(k)), ans, String(g.a), "gpick", k => g.o[+k])}${ans != null ? gramFeedbackHTML(g, +ans === g.a) : ""}`;
    }
    const t = byId(id); if (!t) { setTimeout(nextItem, 0); return ""; }
    const Qz = G.st.q || (G.st.q = quizQ(t, G.seed + G.i * 31)), ans = G.st.ans;
    return `<p class="wm-q-h">${h(w({ def: "q_def", ex: "q_ex", use: "q_use" }[Qz.type]))}</p>
      <div class="wm-q-p">${Qz.prompt}</div>
      ${optsHTML(Qz.opts, ans, t.id, "qpick", x => clean((byId(x) || { en: x }).en))}
      ${ans ? feedbackHTML(t, ans === t.id) : ""}`;
  }

  /* -- Game 3: Sentence Builder (word order, and "find the correct sentence") -- */
  const toks = s => clean(s).split(/\s+/).filter(Boolean);
  function sentHTML() {
    const G = _G, id = G.ids[G.i], g = gram(id), S2 = G.st;
    if (g) {
      return `<p class="wm-q-h">${h(w("s_fix"))}</p>${optsHTML(g.o.map((_, k) => String(k)), S2.ans, String(g.a), "fpick", k => g.o[+k])}${S2.ans != null ? gramFeedbackHTML(g, +S2.ans === g.a) : ""}`;
    }
    const t = byId(id); if (!t) { setTimeout(nextItem, 0); return ""; }
    const target = toks(sentenceOf(t));
    if (!S2.tiles) { let sh = E.shuffle(target.map((x, k) => k), G.seed + G.i), guard = 0; while (target.length > 2 && sh.every((v, k) => target[v] === target[k]) && guard++ < 10) sh = E.shuffle(sh, G.seed + G.i + guard); S2.tiles = sh.map(k => ({ w: target[k], used: false })); S2.picked = []; S2.tries = 0; S2.hint = 0; }
    const built = S2.picked.map(p => S2.tiles[p].w);
    const done = S2.ans;
    return `<p class="wm-q-h">${h(w("s_prompt"))}</p>
      ${t.kind === "sentence" && glossOf(t) ? `<p class="wm-mut center" dir="auto">${h(glossOf(t).text)}</p>` : t.kind !== "sentence" ? `<p class="wm-mut small center" lang="en">${h(clean(t.en))} — ${h(name2(t))}</p>` : ""}
      <div class="em-built" aria-live="polite">${built.length ? built.map((x, k) => `<span class="em-tok f ${k < S2.hint ? "hint" : ""}">${h(x)}</span>`).join("") : `<span class="wm-mut small">…</span>`}</div>
      ${done ? "" : `<div class="em-toks" role="group">${S2.tiles.map((x, i) => `<button class="em-tok" data-em="stile" data-a="${i}" ${x.used ? "disabled" : ""}>${h(x.w)}</button>`).join("")}</div>
      <div class="wm-row center"><button class="btn btn-g btn-sm" data-em="sundo" ${S2.picked.length > S2.hint ? "" : "disabled"}>${h(w("s_undo"))}</button><button class="btn btn-g btn-sm" data-em="shint" ${S2.hint >= target.length - 1 ? "disabled" : ""}>${h(w("s_hint"))}</button></div>
      ${S2.msg ? `<p class="wm-err" role="alert">${h(S2.msg)}</p>` : ""}`}
      ${done ? feedbackHTML(t, done === "ok", done === "ok" ? "" : `<p lang="en"><b>${h(w("s_ok_order"))}</b> ${h(target.join(" "))}</p>`) : ""}`;
  }
  function sentTry() {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st, target = toks(sentenceOf(t));
    if (S2.picked.length < target.length) return draw();
    const val = S2.picked.map(p => S2.tiles[p].w).join(" ");
    if (val === target.join(" ")) { S2.ans = "ok"; answer(t.id, S2.hint ? 1 : 2, S2.hint ? "grammar" : "grammar_built", { hint: S2.hint > 0, k: "sent", p: val }); }
    else { S2.tries++; S2.msg = w("s_try"); S2.lastWrong = val; sentHint(); if (S2.tries >= 2) { S2.ans = "bad"; answer(t.id, 0, "grammar", { k: "sent", p: val }); } }
    draw();
  }
  /* a hint fixes the next word in place (and makes the answer Hard, not Good) */
  function sentHint() {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st, target = toks(sentenceOf(t));
    S2.picked = []; S2.tiles.forEach(x => x.used = false);
    for (let k = 0; k < S2.hint; k++) { const ix = S2.tiles.findIndex(x => !x.used && x.w === target[k]); if (ix >= 0) { S2.tiles[ix].used = true; S2.picked.push(ix); } }
  }

  /* -- Game 4: Listen & Win (a little faster as the round goes on) -- */
  const RATES = [0.85, 0.9, 0.95, 1, 1.05, 1.1];
  function rate() { const G = _G; return RATES[Math.min(RATES.length - 1, G ? G.i : 0)]; }
  function spoken(t) { return t.kind === "sentence" ? t.en : clean(t.en); }
  function listenTyped(t) { const r = st().t[t.id]; return /^[A-Za-z]{3,12}$/.test(t.en) && r && r.n >= 1 && (_G.i % 2 === 1); }
  function listenHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    const sent = t.kind === "sentence";
    const typed = !sent && (G.st.typed != null ? G.st.typed : (G.st.typed = listenTyped(t)));
    const ans = G.st.ans;
    const pool = sent ? official().filter(x => x.kind === "sentence") : quizPool();
    const opts = typed ? null : (G.st.opts || (G.st.opts = E.shuffle([t.id].concat(E.distractors(pool, t.id, 3, G.seed + G.i, { label: x => x.en })), G.seed + G.i * 5)));
    return `<p class="wm-q-h">${h(sent ? w("l_sent") : typed ? w("l_type") : w("l_prompt"))}</p>
      <div class="wm-listen">
        <button class="wm-big-play" data-em="sayrate" data-a="${h(spoken(t))}" aria-label="${h(w("replay"))}">${wi("headphones")}</button>
        <div class="wm-row center"><button class="btn btn-g btn-sm" data-em="sayslow" data-a="${h(spoken(t))}">${h(w("slow"))}</button><button class="btn btn-g btn-sm" data-em="lhint" ${G.st.hint || ans ? "disabled" : ""}>${h(w("l_hint"))}</button></div>
        ${G.st.hint ? `<p class="wm-hint" lang="en">${h(w("l_hint_txt", { c: t.en[0].toUpperCase(), d: sent ? (glossOf(t) || {}).text || "" : name2(t) }))}</p>` : ""}
        <p class="wm-mut small center">${wi("sound")} ${h(w("l_synth"))} ${h(w("l_speed", { n: rate() }))}</p>
      </div>
      ${typed ? `<form class="wm-typed" id="emLForm"><input id="emLIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${h(w("l_type_ph"))}" aria-label="${h(w("l_type_ph"))}" ${ans ? "disabled" : ""} value="${h(G.st.val || "")}"><button class="btn btn-p" ${ans ? "disabled" : ""}>${h(w("check"))}</button></form>`
        : optsHTML(opts, ans, t.id, "lpick", x => clean((byId(x) || { en: x }).en))}
      ${ans ? feedbackHTML(t, ans === "ok" || ans === t.id) : ""}`;
  }
  function listenBind() {
    const f = document.getElementById("emLForm"); if (!f) return;
    f.addEventListener("submit", e => {
      e.preventDefault(); const G = _G, t = byId(G.ids[G.i]); if (!t || G.st.ans) return;
      const v = document.getElementById("emLIn").value; G.st.val = v;
      const good = E.checkTyped(v, t);
      G.st.ans = good ? "ok" : "bad";
      answer(t.id, good ? (G.st.hint ? 1 : 2) : 0, good && !G.st.hint ? "listening_typed" : "listening", { hint: G.st.hint, k: "listen-t", p: v });
      draw();
    });
  }

  /* -- Game 5: Speak Up (record → the app hears you → word score; AI pronunciation optional) --
     Hearing the learner (transcription) is free; the per-word pronunciation
     score is an AI verdict and metered (fbAssess, aiOff("ai_analysis")). A take
     that could not be heard is never counted, and Skip costs nothing. */
  function speakTarget(t) { return clean(sentenceOf(t)); }
  function coverage(target, heard) {
    const want = toks(target).map(E.normAns).filter(Boolean), got = toks(heard).map(E.normAns).filter(Boolean), pool = got.slice();
    const marks = want.map(x => { const i = pool.indexOf(x); if (i >= 0) { pool.splice(i, 1); return true; } return false; });
    return { pct: want.length ? Math.round(100 * marks.filter(Boolean).length / want.length) : 0, marks };
  }
  function speakPanelHTML(target, sp) {
    sp = sp || {};
    const cov = sp.heard != null ? coverage(target, sp.heard) : null;
    let aiOffNow = true; try { aiOffNow = typeof aiOff === "function" ? aiOff("ai_analysis") : true; } catch (e) {}
    return `<div class="em-speak">
      <p class="em-say" lang="en">${cov ? toks(target).map((x, k) => `<span class="${cov.marks[k] ? "ok" : "miss"}">${h(x)}</span>`).join(" ") : h(target)}</p>
      <div class="wm-row center"><button class="btn btn-g btn-sm" data-em="say" data-a="${h(target)}">${wi("sound")} ${h(w("hear"))}</button><button class="btn btn-g btn-sm" data-em="sayslow" data-a="${h(target)}">${h(w("slow"))}</button></div>
      <button class="em-mic ${sp.recording ? "on" : ""}" data-em="sprec" ${sp.busy ? "disabled" : ""} aria-pressed="${!!sp.recording}">${wi("mic")}<span>${h(sp.recording ? w("sp_stop") : sp.heard != null ? w("sp_again") : w("sp_rec"))}</span></button>
      ${sp.busy ? `<p class="wm-mut center" role="status">${h(w("sp_busy"))}</p>` : ""}
      ${sp.err ? `<p class="wm-err" role="alert">${h(sp.err)}</p>` : ""}
      ${cov ? `<div class="em-sp-res" role="status"><b>${h(w("sp_score", { p: cov.pct }))}</b><small>${h(w("sp_heard"))} “${h(sp.heard)}”</small>
        <div class="wm-row center">${sp.url ? `<button class="btn btn-g btn-sm" data-em="spplay">${wi("play")} ${h(w("sp_play"))}</button>` : ""}
        ${sp.ai != null ? `<span class="wm-chip">${h(w("sp_ai_res", { p: sp.ai }))} · AI</span>` : aiOffNow ? "" : `<button class="btn btn-g btn-sm" data-em="spai" ${sp.aiBusy ? "disabled" : ""}>${wi("spark")} ${h(sp.aiBusy ? w("sp_ai_busy") : w("sp_ai"))}</button>`}</div>
        ${sp.ai == null && !aiOffNow ? `<small class="wm-mut">${h(w("sp_ai_meter"))}</small>` : ""}${sp.aiErr ? `<small class="wm-mut">${h(w("sp_ai_off"))}</small>` : ""}</div>` : ""}
    </div>`;
  }
  function speakHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    const sp = G.st.sp || (G.st.sp = {});
    return `<p class="wm-q-h">${h(w("sp_prompt"))}</p>
      ${t.kind !== "sentence" ? `<p class="wm-mut small center" lang="en"><b>${h(clean(t.en))}</b> — ${h(name2(t))}</p>` : glossOf(t) ? `<p class="wm-mut small center" dir="auto">${h(glossOf(t).text)}</p>` : ""}
      ${speakPanelHTML(speakTarget(t), sp)}
      ${G.st.graded ? `<button class="btn btn-p wm-wide" data-em="next">${h(w("next"))} →</button>` : `<button class="btn btn-g wm-wide" data-em="spskip">${h(w("skip"))}</button>`}`;
  }
  /* one recorder for Speak Up and the Missions' "say it" step */
  async function spToggle() {
    const G = _G; if (!G) return;
    const sp = G.st.sp || (G.st.sp = {});
    if (sp.recording && sp.mr) { try { sp.mr.stop(); } catch (e) {} return; }
    sp.err = ""; sp.aiErr = false;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { sp.err = w("sp_mic"); return draw(); }
    const mr = new MediaRecorder(stream), chunks = [];
    sp.mr = mr; sp.recording = true; sp.t0 = Date.now(); draw();
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach(x => x.stop());
      sp.recording = false; clearTimeout(sp.timer);
      const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      if (_G !== G) return;
      if (blob.size < 1200 || Date.now() - sp.t0 < 400) { sp.err = w("sp_empty"); return draw(); }
      if (sp.url) try { URL.revokeObjectURL(sp.url); } catch (e) {}
      sp.blob = blob; sp.url = URL.createObjectURL(blob); sp.ai = null; sp.busy = true; draw();
      let heard = "";
      try { heard = typeof fbTranscribe === "function" ? await fbTranscribe(blob) : ""; } catch (e) { heard = ""; }
      sp.busy = false;
      if (_G !== G) return;
      if (!heard) { sp.err = navigator.onLine ? w("sp_empty") : w("sp_tx_off"); return draw(); }
      sp.heard = heard;
      spGraded(G);
      draw();
    };
    mr.start();
    sp.timer = setTimeout(() => { try { if (mr.state === "recording") mr.stop(); } catch (e) {} }, 15000);
  }
  /* Speak Up grades the FIRST take it could hear (a retake is practice); the Missions' step is practice only */
  function spGraded(G) {
    if (G.mode !== "speak" || G.st.graded) return;
    const t = byId(G.ids[G.i]); if (!t) return;
    const pct = coverage(speakTarget(t), G.st.sp.heard).pct;
    G.st.graded = true;
    answer(t.id, pct >= 80 ? 2 : pct >= 50 ? 1 : 0, "speaking", { k: "speak", p: String(G.st.sp.heard).slice(0, 40) });
  }
  async function spAi() {
    const G = _G, sp = G && G.st.sp; if (!sp || !sp.blob || sp.aiBusy) return;
    const target = G.mode === "speak" ? speakTarget(byId(G.ids[G.i])) : (G.st.sayTarget || "");
    sp.aiBusy = true; draw();
    let r = null; try { r = typeof fbAssess === "function" ? await fbAssess(sp.blob, target) : null; } catch (e) { r = null; }
    sp.aiBusy = false;
    if (r && r.words && r.words.length) sp.ai = Number.isFinite(r.overall) ? Math.round(r.overall) : Math.round(100 * r.words.filter(x => x && x.score >= 80).length / r.words.length);
    else sp.aiErr = true;
    if (_G === G) draw();
  }

  /* -- Game 6: Phrase Match -- */
  const MATCH_KINDS = ["def", "ex", "use"];
  function matchRound() {
    const G = _G, round = G.st.round || 0, slice = G.ids.slice(round * 5, round * 5 + 5);
    if (slice.length < 2) return finish();
    let items = slice.map(byId).filter(Boolean);
    let kind = MATCH_KINDS[(G.seed + round) % MATCH_KINDS.length];
    if (kind === "use" && items.filter(x => x.use && x.use.en).length < items.length) kind = "def";
    if (kind === "ex" && items.some(x => !x.ex || !x.ex.en)) kind = "def";
    const right = x => kind === "def" ? blank(x.def.en, x) : kind === "ex" ? blank(x.ex.en, x) : x.use.en;
    G.st = { round, kind, items, rightOrder: E.shuffle(items.map(x => x.id), G.seed + round * 11), sel: null, done: {}, miss: {}, right };
    matchDraw();
  }
  function matchDraw() {
    const G = _G, M = G.st;
    gameOpen("match", `<p class="wm-q-h">${h(w("m_" + M.kind))}</p><p class="wm-mut small">${h(w("m_prompt"))}</p>
      <div class="wm-match">
        <div class="wm-mcol">${M.items.map(x => `<button class="wm-m ${M.sel === x.id ? "sel" : ""} ${M.done[x.id] ? (M.miss[x.id] ? "late" : "ok") : ""}" data-em="mleft" data-a="${h(x.id)}" ${M.done[x.id] ? "disabled" : ""} aria-pressed="${M.sel === x.id}" lang="en">${h(clean(x.en))}</button>`).join("")}</div>
        <div class="wm-mcol">${M.rightOrder.map(id => `<button class="wm-m r ${M.done[id] ? (M.miss[id] ? "late" : "ok") : ""} ${M.flash === id ? "bad" : ""}" data-em="mright" data-a="${h(id)}" ${M.done[id] ? "disabled" : ""} lang="en"><span>${h(M.right(byId(id)))}</span></button>`).join("")}</div>
      </div>${M.flash ? `<p class="wm-err" role="alert">${h(w("m_wrong"))}</p>` : ""}`);
  }
  /* a pair counts as known only if it was matched without a wrong try on that
     phrase — a lucky match after a miss is filed as "Again", not as success */
  function matchPick(side, id) {
    const G = _G, M = G.st;
    if (side === "l") { M.sel = M.sel === id ? null : id; M.flash = null; return matchDraw(); }
    if (!M.sel) return;
    if (M.sel === id) { M.done[id] = 1; answer(id, M.miss[id] ? 0 : 2, "recognition", { k: "match-" + M.kind, p: M.miss[id] || "" }); M.sel = null; M.flash = null; G.i++; }
    else { if (!M.miss[M.sel]) M.miss[M.sel] = id; M.flash = id; tone("no"); }
    if (M.items.every(x => M.done[x.id])) { M.round++; G.st = { round: M.round }; if (M.round * 5 >= G.ids.length) return finish(); return setTimeout(matchRound, 450); }
    matchDraw();
  }

  /* -- Game 7: Word Puzzle (spell it from its meaning) -- */
  function puzzleHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    const S2 = G.st;
    if (!S2.tiles) { S2.tiles = E.tiles(t.en, G.seed + G.i).map((c, k) => ({ c, k, used: false })); S2.picked = []; S2.tries = 0; S2.hint = 0; }
    const target = t.en.toUpperCase(), letters = target.replace(/[^A-Z]/g, "");
    let li = 0;
    const slots = target.split("").map(() => { const p = S2.picked[li]; const fixed = li < S2.hint; li++; return `<span class="wm-slot ${p != null ? "f" : ""} ${fixed ? "hint" : ""}">${p != null ? h(S2.tiles[p].c) : ""}</span>`; }).join("");
    const done = S2.ans;
    return `<p class="wm-q-h">${h(w("b_prompt"))}</p>
      <div class="wm-q-p"><p lang="en">${h(blank(t.def.en, t))}</p>${t.ex && t.ex.en ? `<p class="wm-mut small" lang="en">“${h(blank(t.ex.en, t))}”</p>` : ""}</div>
      <div class="wm-slots" aria-label="${letters.length} letters" aria-live="polite">${slots}</div>
      ${done ? "" : `<div class="wm-tiles" role="group">${S2.tiles.map((x, i) => `<button class="wm-tile" data-em="tile" data-a="${i}" ${x.used ? "disabled" : ""} aria-label="${h(x.c)}">${h(x.c)}</button>`).join("")}</div>
      <div class="wm-row center"><button class="btn btn-g btn-sm" data-em="bback" aria-label="Backspace">⌫</button><button class="btn btn-g btn-sm" data-em="bclear">${h(w("b_clear"))}</button><button class="btn btn-g btn-sm" data-em="bhint" ${S2.hint >= letters.length - 1 ? "disabled" : ""}>${h(w("b_hint"))}</button></div>
      <form class="wm-typed" id="emBForm"><input id="emBIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${h(w("b_type_ph"))}" aria-label="${h(w("b_type_ph"))}"><button class="btn btn-p">${h(w("check"))}</button></form>
      ${S2.msg ? `<p class="wm-err" role="alert">${h(S2.msg)}</p>` : ""}`}
      ${done ? feedbackHTML(t, done === "ok") : ""}`;
  }
  function builderBind() {
    const f = document.getElementById("emBForm"); if (!f) return;
    f.addEventListener("submit", e => { e.preventDefault(); builderCheck(document.getElementById("emBIn").value); });
  }
  function builderTry() {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st, need = t.en.replace(/[^A-Za-z]/g, "").length;
    if (S2.picked.length === need) builderCheck(S2.picked.map(p => S2.tiles[p].c).join(""));
    else draw();
  }
  function builderCheck(val) {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st; if (S2.ans) return;
    if (E.checkTyped(val, t)) { S2.ans = "ok"; answer(t.id, S2.hint ? 1 : 2, "spelling", { hint: S2.hint > 0, k: "spell", p: val }); }
    else { S2.tries++; S2.msg = w("b_try"); builderApplyHint(); if (S2.tries >= 2) { S2.ans = "bad"; answer(t.id, 0, "spelling", { k: "spell", p: val }); } }
    draw();
  }
  function builderApplyHint() {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st, letters = t.en.toUpperCase().replace(/[^A-Z]/g, "");
    S2.picked = []; S2.tiles.forEach(x => x.used = false);
    for (let k = 0; k < S2.hint; k++) { const ix = S2.tiles.findIndex(x => !x.used && x.c === letters[k]); if (ix >= 0) { S2.tiles[ix].used = true; S2.picked.push(ix); } }
  }

  /* -- Game 8: Real-Life Missions (choose → say it → or your own words with the AI coach) -- */
  function scen(id) { return (C && C.missions.find(x => x.id === id)) || (_pack && (_pack.scenarios || []).find(x => x.id === id)) || null; }
  function missionsHTML() {
    const G = _G, sc = scen(G.ids[G.i]); if (!sc) { setTimeout(nextItem, 0); return ""; }
    const S2 = G.st, ok = sc.options.find(o => o.ok);
    const order = S2.order || (S2.order = E.shuffle(sc.options.map((o, k) => k), G.seed + G.i * 13));
    if (S2.a != null) G.st.sayTarget = ok.en;
    return `<div class="wm-ws em-mis"><div class="wm-ws-h">${wi(sc.kind === "work" ? "briefcase" : "chat")}<span><small>${h(sc.title || catName(sc.cat || "advanced"))}</small><b>${h(sc.who)}</b></span></div>
      <p class="wm-mut small">${h(sc.where)}</p>
      <blockquote lang="en">“${h(sc.asks)}”</blockquote>
      ${sc.goal || sc.context ? `<details class="wm-tr"><summary>${h(w("mi_goal"))}</summary>${sc.goal ? `<p>${h(sc.goal)}</p>` : ""}${sc.context ? `<p class="wm-mut small"><b>${h(w("mi_ctx"))}</b> ${h(sc.context)}</p>` : ""}</details>` : ""}
      <p class="wm-q-h">${h(w("mi_q"))}</p>
      <div class="wm-opts col" role="group">${order.map(k => { const o = sc.options[k], cls = S2.a != null ? (o.ok ? "correct" : k === S2.a ? "wrong" : "") : ""; return `<button class="wm-opt long ${cls}" data-em="mpick" data-a="${k}" ${S2.a != null ? "disabled" : ""} lang="en">${h(o.en)}</button>`; }).join("")}</div>
      ${S2.a != null ? `<div class="wm-fb ${sc.options[S2.a].ok ? "ok" : "no"}" role="status">${wi(sc.options[S2.a].ok ? "check" : "cross")}<div><b>${h(sc.options[S2.a].ok ? w("ok") : w("no"))}</b><p>${h(sc.why)}</p></div></div>
        <h3 class="wm-h3">${wi("mic")} ${h(w("mi_say"))}</h3>${canRecord() ? speakPanelHTML(ok.en, S2.sp || (S2.sp = {})) : ""}
        ${coachHTML(sc)}
        <button class="btn btn-p wm-wide" data-em="next">${h(w("next"))} →</button>` : ""}
    </div>`;
  }
  /* ---- the AI coach inside Real-Life Missions ----
     The learner answers in their OWN words; the coach judges it against the
     situation. The existing chat route, purpose "coach": a verdict, so it is
     metered by the server (Free 3 a day, Premium 120), needs a signed-in
     account, and is labelled AI everywhere it speaks. */
  function coachTask(sc) { return sc.task || w("co_task", { who: String(sc.who || "").replace(/^(The|A|An|Your) /, m => m.toLowerCase()) }); }
  function coachHTML(sc) {
    const C2 = _G.st.coach || {};
    let off = false; try { off = typeof aiOff === "function" && aiOff("ai_coach"); } catch (e) {}
    if (!signedIn()) off = true;
    return `<div class="card wm-coach" id="emCoach"><div class="wm-coach-h">${wi("chat")}<span><small>${h(w("mi_own"))} · ${h(w("co_h"))}</small><b>${h(coachTask(sc))}</b></span></div>
      ${C2.res ? `<div class="wm-coach-out v-${h(C2.res.verdict || "almost")}"><b>${h(w("co_v_" + (C2.res.verdict || "almost")))}</b>
          ${C2.res.well ? `<p>${wi("check")} ${h(C2.res.well)}</p>` : ""}${C2.res.fix ? `<p>${wi("target")} ${h(C2.res.fix)}</p>` : ""}
          ${C2.res.better ? `<p class="wm-coach-better" lang="en">“${h(C2.res.better)}”</p>` : ""}${C2.res.tip ? `<p class="fr" dir="auto">${h(C2.res.tip)}</p>` : ""}
          <p class="wm-mut small">${h(w("co_ai"))}</p></div>`
        : `<textarea id="emCoachIn" rows="3" maxlength="400" placeholder="${h(w("co_ph"))}" aria-label="${h(w("co_ph"))}" ${C2.busy ? "disabled" : ""}>${h(C2.txt || "")}</textarea>
          ${C2.err ? `<p class="wm-err" role="alert">${h(C2.err)}</p>` : ""}
          <button class="btn btn-g wm-wide" data-em="coach" ${C2.busy || off ? "disabled" : ""}>${wi("chat")} ${h(C2.busy ? w("co_busy") : w("co_btn"))}</button>
          ${off ? `<p class="wm-mut small">${h(signedIn() ? w("co_off") : w("au_short"))}</p>` : `<p class="wm-mut small">${h(w("co_meter"))}</p>`}`}
    </div>`;
  }
  async function coachAsk() {
    const G = _G; if (!G) return;
    const sc = scen(G.ids[G.i]), box = document.getElementById("emCoachIn");
    const txt = (box && box.value || "").replace(/\s+/g, " ").trim().slice(0, 400);
    G.st.coach = G.st.coach || {}; G.st.coach.txt = txt;
    if (txt.split(" ").length < 4) { G.st.coach.err = w("co_short"); return draw(); }
    G.st.coach.busy = true; G.st.coach.err = ""; draw();
    const L = glLang(), ok = sc.options.find(o => o.ok);
    const system = `You are an English communication coach in BE Mastery (General English). You are an AI, not a person. A learner is practising what to say in a real situation.
Situation: ${sc.where} ${sc.who} says: "${sc.asks}"${sc.goal ? "\nGoal: " + sc.goal : ""}${sc.context ? "\nBackground: " + sc.context : ""}
Task: ${coachTask(sc)}
One natural answer (for reference only): ${ok ? ok.en : ""}
Judge ONLY the learner's own answer: does it do the job in this situation, is it clear, polite and natural, is the grammar right? Be specific, short and kind. Keep their facts.
Reply as JSON: {"reply": "VERDICT: good|almost|retry\\nWELL: <one short line on what worked>\\nFIX: <one short line, the single most useful correction>\\nBETTER: <the learner's own answer rewritten naturally, max 2 sentences>\\nTIP: <one-line tip ${L.ok ? "in " + L.name : "in simple English"}>"}`;
    try {
      const r = await fetch(POLISH_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat: { purpose: "coach", system, messages: [{ role: "user", content: txt }] } }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) { G.st.coach.busy = false; G.st.coach.err = w("co_spent"); return draw(); }
      if (r.status === 401) { G.st.coach.busy = false; G.st.coach.err = w("au_short"); return draw(); }
      if (!r.ok || j.error) throw new Error("ai");
      const o = {}; String(j.reply || "").split(/\n+/).forEach(l => { const m = /^\s*(VERDICT|WELL|FIX|BETTER|TIP)\s*:\s*(.+)$/i.exec(l); if (m) o[m[1].toLowerCase()] = m[2].trim(); });
      if (!o.better && !o.fix) throw new Error("shape");
      G.st.coach.res = { verdict: /^(good|almost|retry)$/i.test(o.verdict || "") ? o.verdict.toLowerCase() : "almost", well: o.well, fix: o.fix, better: o.better, tip: o.tip };
      G.log.push({ s: sc.id, ok: G.st.coach.res.verdict === "good", k: "coach", p: G.st.coach.res.verdict });
    } catch (e) { G.st.coach.err = w("co_fail"); }
    G.st.coach.busy = false; persist(); if (_G === G) draw();
  }
  /* after a Missions round: the next rung of the loop — a real person, or a real video */
  function endLinksHTML(G) {
    if (G.mode !== "missions") return "";
    let pp = false; try { pp = typeof ppAvailable === "function" && ppAvailable(); } catch (e) {}
    const sh = G.ids.map(scen).filter(Boolean).map(x => x.shadow).find(Boolean);
    return `${pp ? `<button class="wm-link" data-em="partner">${wi("user_plus")} ${h(w("mi_partner"))} →</button>` : ""}${sh && shadowOk() ? `<button class="wm-link" data-em="shadow" data-a="${h(sh.vid)}">${wi("play")} ${h(w("mi_shadow", { t: sh.title }))} →</button>` : ""}`;
  }
  function loopHTML() {
    let pp = false; try { pp = typeof ppAvailable === "function" && ppAvailable(); } catch (e) {}
    const sh = shadowOk();
    if (!pp && !sh) return "";
    return `<div class="card em-loop"><div class="em-loop-h">${wi("renew")}<span><small>${h(w("loop_h"))}</small><b>${h(w("loop_b"))}</b></span></div>
      <div class="wm-row">${pp ? `<button class="btn btn-p btn-sm" data-em="partner">${wi("user_plus")} ${h(w("loop_pp"))}</button>` : ""}${sh ? `<button class="btn btn-g btn-sm" data-em="nav" data-a="shadow">${wi("play")} ${h(w("loop_sh"))}</button>` : ""}</div></div>`;
  }

  function draw() {
    const G = _G; if (!G) return;
    if (G.mode === "match") return matchDraw();
    const fn = { cards: cardsHTML, quiz: quizHTML, sentence: sentHTML, listen: listenHTML, speak: speakHTML, puzzle: puzzleHTML, missions: missionsHTML }[G.mode];
    gameOpen(G.mode, fn());
    if (G.mode === "listen" && !G.st.played) { G.st.played = 1; setTimeout(() => { const t = byId(G.ids[G.i]); if (t && _G === G) say(spoken(t), rate()); }, 350); }
    if (G.mode === "puzzle") builderBind();
    if (G.mode === "listen") listenBind();
  }

  /* ------------------------------------------------------------ one click handler */
  function act(a, arg, btn) {
    const s = st(); if (!s && a !== "nav") return;
    const G = _G;
    switch (a) {
      case "nav":
        if (document.getElementById("emGame") && document.getElementById("emGame").classList.contains("show")) gameClose();
        sheetClose(); go(arg); return;
      case "open": go("english", "games"); setTimeout(() => start(arg), 60); return;
      case "retry": _err = false; redraw(); return;
      case "tab": _tab = arg; render(document.getElementById("v-english")); try { jumpTop(); } catch (e) {} return;
      case "settings": return settingsOpen();
      case "sheetclose": return sheetClose();
      case "set": { const [k, v] = arg.split(":"); if (k === "sound") s.set.sound = v === "1"; else s.set[k] = v; persist(); document.documentElement.classList.toggle("wm-still", reduced()); settingsOpen(); redraw(); return; }
      case "mission": return startMission();
      case "hseg": _histSeg = arg; return redraw();
      case "practerr": return start("cards", { ids: String(arg).split(",").filter(Boolean), keepOrder: true, n: 20 });
      case "resume": { const r = resumeValid(s); if (r) start(r.mode, { resume: r }); return; }
      case "play": return start(arg);
      case "daily": return start("quiz", { daily: true });
      case "signin": sheetClose(); try { fbOpenModal("in"); } catch (e) {} return;
      case "premium": sheetClose(); try { premiumOpen(arg || "em"); } catch (e) {} return;
      case "energy": return energySheet({ resetAt: _srv && _srv.energy ? _srv.energy.resetAt : 0 });
      case "trend": _trendSpan = +arg === 90 ? 90 : 30; { const el = document.getElementById("emTrends"); if (el) el.outerHTML = trendsHTML(true); } return;
      case "coach": return coachAsk();
      case "gloss": return glossFetch(arg);
      case "partner": if (document.getElementById("emGame") && document.getElementById("emGame").classList.contains("show")) gameClose(); sheetClose(); try { go("partner"); } catch (e) {} return;
      case "shadow": { const vid = arg; if (document.getElementById("emGame") && document.getElementById("emGame").classList.contains("show")) gameClose(); sheetClose(); try { go("shadow"); setTimeout(() => { try { shLoad({ vid, start: 0, end: 0, title: "" }); } catch (e) {} }, 250); } catch (e) {} return; }
      case "advanced": {
        if (!signedIn()) return authSheet();
        if (!_srv) { srvRefresh().then(() => act("advanced")); return; }
        if (!isPremium()) return premiumAsk("em_advanced");
        if (_pack) return start("missions", { advanced: true });
        srv("pack").then(r => { if (r.status === 200 && r.j && Array.isArray(r.j.scenarios)) { _pack = r.j; start("missions", { advanced: true }); } else if (r.status === 402) premiumAsk("em_advanced"); else msgSheet("chat", w("adv_fail_h"), w("adv_fail_b")); }).catch(() => msgSheet("bolt", w("off_h"), w("off_b")));
        return;
      }
      case "stage": return start("cards", { cat: arg });
      case "stagetest": return start(arg === "first" ? "sentence" : "quiz", { cat: arg, n: 10 });
      case "practise": return start("cards", { ids: collList().slice(0, 20).map(t => t.id), keepOrder: true, n: 20 });
      case "seg": _coll.seg = arg; _edit = null; return redraw();
      case "cat": _coll.cat = arg; return redraw();
      case "word": return wordSheet(arg);
      case "fav": { E.setFav(s, arg, !E.isFav(s, arg), Date.now()); persist(); const sh = document.getElementById("emSheet"); if (sh) wordSheet(arg); if (G) draw(); else redraw(); return; }
      case "hard": { const r = s.t[arg]; E.setHard(s, arg, !(r && r.hard)); persist(); const sh = document.getElementById("emSheet"); if (sh) wordSheet(arg); if (G) draw(); else redraw(); return; }
      case "savelist": { const t = byId(arg); if (t) { try { vocPut(clean(t.en).toLowerCase(), /^[ABC][12]$/.test(t.lvl) ? t.lvl : "B1"); save(); toast(clean(t.en) + " ✓"); } catch (e) {} } if (document.getElementById("emSheet")) wordSheet(arg); else if (G) draw(); return; }
      case "say": return say(arg);
      case "sayslow": return say(arg, 0.7);
      case "sayrate": return say(arg, rate());
      case "myedit": _edit = arg; return redraw();
      case "mycancel": _edit = null; return redraw();
      case "mydel": { const m = s.mine[arg]; if (!m) return; sheet(`<p>${h(w("my_del_q", { w: m.en }))}</p><div class="wm-row"><button class="btn btn-p" data-em="mydelok" data-a="${h(arg)}">${h(w("del_conf"))}</button><button class="btn btn-g" data-em="sheetclose">${h(w("cancel"))}</button></div>`); return; }
      case "mydelok": E.delMine(s, arg, Date.now()); persist(); sheetClose(); toast(w("my_deleted")); _edit = null; return redraw();
      /* in a game */
      case "gclose": return gameClose();
      case "again": { const m = G && G.mode, o = G && G.opts; gameClose(); if (m) start(m, o && !o.resume ? o : {}); return; }
      case "next": return G && G.mode === "match" ? null : nextItem();
      case "flip": G.st.flipped = true; return draw();
      case "rate": { if (G.st.rated) return; G.st.rated = 1; answer(G.ids[G.i], +arg, "recall", { k: "card" }); return nextItem(); }
      case "qpick": { if (G.st.ans) return; G.st.ans = arg; const t = byId(G.ids[G.i]); answer(t.id, arg === t.id ? 2 : 0, G.st.q.skill, { k: G.st.q.type, p: arg === t.id ? "" : arg }); return draw(); }
      case "gpick": case "fpick": { if (G.st.ans != null) return; G.st.ans = arg; const g = gram(G.ids[G.i]); answer(g.id, +arg === g.a ? 2 : 0, "grammar", { k: a === "gpick" ? "gram" : "fix", p: arg }); return draw(); }
      case "lpick": { if (G.st.ans) return; G.st.ans = arg; const t = byId(G.ids[G.i]); answer(t.id, arg === t.id ? (G.st.hint ? 1 : 2) : 0, "listening", { hint: G.st.hint, k: t.kind === "sentence" ? "listen-s" : "listen", p: arg === t.id ? "" : arg }); return draw(); }
      case "lhint": G.st.hint = 1; return draw();
      case "stile": { const S2 = G.st, i = +arg; if (S2.ans || S2.tiles[i].used) return; S2.tiles[i].used = true; S2.picked.push(i); S2.msg = ""; return sentTry(); }
      case "sundo": { const S2 = G.st; if (S2.picked.length > S2.hint) { const p = S2.picked.pop(); S2.tiles[p].used = false; } return draw(); }
      case "shint": { const S2 = G.st; S2.hint++; sentHint(); return sentTry(); }
      case "sprec": return spToggle();
      case "spplay": { const sp = G.st.sp; if (sp && sp.url) { try { new Audio(sp.url).play(); } catch (e) {} } return; }
      case "spai": return spAi();
      case "spskip": { const sp = G.st.sp; if (sp && sp.recording && sp.mr) try { sp.mr.stop(); } catch (e) {} return nextItem(); }
      case "tile": { const S2 = G.st, i = +arg; if (S2.ans || S2.tiles[i].used) return; S2.tiles[i].used = true; S2.picked.push(i); S2.msg = ""; return builderTry(); }
      case "bback": { const S2 = G.st; if (S2.picked.length > S2.hint) { const p = S2.picked.pop(); S2.tiles[p].used = false; } return draw(); }
      case "bclear": builderApplyHint(); return draw();
      case "bhint": { const S2 = G.st; S2.hint++; builderApplyHint(); return draw(); }
      case "mleft": return matchPick("l", arg);
      case "mright": return matchPick("r", arg);
      case "mpick": { if (G.st.a != null) return; G.st.a = +arg; const sc = scen(G.ids[G.i]); const ok = !!sc.options[+arg].ok; answer(sc.id, ok ? 2 : 0, "context", { k: "mis", s: sc.id, p: String(+arg) }); return draw(); }
    }
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-em]");
    if (!b || b.disabled) return;
    if (!b.closest("#v-english,#emGame,#emSheet,.em-portal,.em-perf-card")) return;
    e.preventDefault();
    try { act(b.dataset.em, b.dataset.a, b); } catch (err) { try { console.error("[em]", err); } catch (_) {} }
  });
  document.addEventListener("submit", e => {
    if (e.target && e.target.id === "emMyForm") {
      e.preventDefault();
      const s = st(); if (!s) return;
      const id = e.target.dataset.id || undefined;
      const r = E.addMine(s, { id, en: document.getElementById("emMyEn").value, fr: document.getElementById("emMyFr").value, def: document.getElementById("emMyDef").value, ex: document.getElementById("emMyEx").value }, Date.now(), official());
      if (r.error) { const er = document.getElementById("emMyErr"); if (er) er.textContent = w("my_e_" + r.error); return; }
      persist(); _edit = null; toast(w(id ? "my_saved" : "my_added")); redraw();
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { if (document.getElementById("emSheet")) return sheetClose(); const ov = document.getElementById("emGame"); if (ov && ov.classList.contains("show")) gameClose(); }
  });

  /* ------------------------------------------------------------ Home, recommendations, widget
     Read from the learner's own record without the corpus (Home is often the
     first page drawn), so nothing waits on a download. */
  const LOGO_URL = "english-mastery-logo.svg";
  function todayShift(s) { const m = s.mis; return m && m.day === E.dayOf(Date.now()) ? m : null; }
  function signals() {
    const s = st(); if (!s) return null;
    const now = Date.now(), m = todayShift(s);
    const perf = E.performance(s, [], now), rec = E.recommend(perf);
    const untried = E.MODES.filter(k => !(s.modes[k] && s.modes[k].runs) && k !== rec.mode);
    return { shift: m ? { kind: m.kind, prog: m.prog, target: m.target, done: !!m.done } : { kind: "start5", prog: 0, target: 5, done: false, fresh: true },
      mode: rec.mode, why: rec.kind, strong: rec.strong ? w("skill_" + rec.strong).toLowerCase() : "", weak: rec.weak ? w("skill_" + rec.weak).toLowerCase() : "",
      due: E.dueCount(s, now), mastered: masteredCount(s), untried: untried.slice(0, 2), extra: ["quiz", "speak", "missions"], view: "english", activity: "english_mastery" };
  }
  function shiftName(kind) { return w("m_" + (kind || "start5")); }
  function heroText(r) {
    const v = r.vars || {};
    if (r.act === "shift") return { title: w("r_shift_t", { m: shiftName(v.kind) }), body: w("r_shift_b", { p: v.prog || 0, n: v.target || 5 }), cta: w("r_cta"), meta: w("r_kicker") };
    return { title: w("r_due_t", { n: v.n || 0 }), body: w("r_due_b"), cta: w("r_cta"), meta: w("r_kicker") };
  }
  function rowHead(r) { const v = r.vars || {}; return { h: w("row_h"), s: w("row_s_" + (r.variant || "keep"), v) }; }
  function itemTitle(it) { return it.act === "shift" ? shiftName((todayShift(st() || {}) || {}).kind) : w("g_" + it.act); }
  function itemLine(it) { return it.act === "shift" ? w("it_shift") : w("g_" + it.act + "_d"); }
  function exploreTile() {
    const s = st(); if (!s) return null;
    const m = todayShift(s);
    return { ic: "trophy", t: w("title"), s: m ? (m.done ? w("explore_done", { m: masteredCount(s) }) : w("explore_shift", { p: m.prog, n: m.target })) : w("explore_s", { total: TOTAL }), go: "go('english')", img: LOGO_URL, art: 0 };
  }
  /* a recommendation, a widget tap or a Home card asked for a game: open the hub on it */
  function play(actName) {
    if (!on()) return false;
    try { go("english", actName === "shift" ? "home" : "games"); } catch (e) { return false; }
    const run = () => { if (actName === "shift") { E.ensureMission(st(), official(), Date.now()); persist(); startMission(); } else if (E.MODES.includes(actName)) start(actName); };
    loadCorpus().then(() => setTimeout(run, 120)).catch(() => {});
    return true;
  }
  function widgetData() {
    const s = st(); if (!s) return null;
    const now = Date.now(), lv = E.level(xpShown()), sk = E.streak(s, now), m = todayShift(s), sig = signals();
    return { m: masteredCount(s), total: TOTAL, lvl: lv.level, xp: lv.xp, need: lv.need, pct: lv.pct, streak: sk.current,
      shift: m ? { t: shiftName(m.kind), p: m.prog, n: m.target, done: !!m.done } : { t: shiftName("start5"), p: 0, n: 5, done: false },
      next: sig ? w("g_" + sig.mode) : "",
      labels: { title: w("w_title"), mastered: w("w_mastered"), level: w("w_level", { n: lv.level }), xp: w("w_xp"), streak: w("w_streak"), shift: w("w_shift"), done: w("w_done"), open: w("w_open"), empty: w("w_empty") } };
  }

  window.EMUI = {
    signals, heroText, rowHead, itemTitle, itemLine, exploreTile, play, widgetData, LOGO_URL,
    on, render, portalHTML, perfCardHTML, title: () => w("title"),
    /* test hooks */
    _state: st, _corpus: () => C, _load: loadCorpus, _start: start, _game: () => _G, _act: act, _refresh: srvRefresh, _coverage: coverage, _pool: poolFor, _choose: chooseIds
  };
})();
