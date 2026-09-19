/* ============================================================================
   BE Mastery — Shadow Studio V2: transcript synchronisation engine
   ----------------------------------------------------------------------------
   Pure functions, no DOM, no player. index.html drives them from the YouTube
   player's currentTime; tests/shadow-sync.test.mjs drives them from numbers.
   The CHALLENGE section at the end compares a spoken attempt with the line
   and picks one strength and one correction — same idea, no DOM either.

   The normalised asset shape (see marketing/product/practice-partner/
   SHADOW_STUDIO_V2.md):
     { segments:[{id,text,startMs,endMs,words?:[{id,text,startMs,endMs}]}],
       level:"word"|"sentence"|"text"|"none" }

   Sources:
     - captions/<vid>.json  {cues:[{t,txt}], words:[{t,w}]}  seconds → word level
     - a caption file without words                              → sentence level
     - a pasted transcript (no timings)                          → text level
     - nothing                                                   → none (the
       lightweight clip mode keeps working; the panel says so)
   Fallback is per asset AND per segment: a segment with no words highlights as
   a sentence even inside a word-level asset.
   ============================================================================ */
(function (global) {
  "use strict";
  const MIN_SEG_MS = 400, MAX_SEG_MS = 12000, TAIL_MS = 2500;

  function splitSentences(text) {
    return String(text || "").replace(/\s+/g, " ").trim()
      .split(/(?<=[.!?…])\s+(?=[A-Z0-9"“(])/).map(s => s.trim()).filter(Boolean);
  }

  /* Caption cues carry only a start; a cue ends where the next begins. Words
     are attached to the cue whose window they fall in. */
  function normalizeCaptions(cap, clipStartS, clipEndS) {
    /* defensive: a caption file is data from outside — drop cues and words
       whose time is not a finite number, and sort both, because locate()
       binary-searches segment starts and a cue ends where the next begins */
    const fin = v => typeof v === "number" && Number.isFinite(v);
    const cues = Array.isArray(cap && cap.cues) ? cap.cues.filter(c => c && fin(c.t) && c.txt).slice().sort((a, b) => a.t - b.t) : [];
    if (!cues.length) return { segments: [], level: "none" };
    const words = Array.isArray(cap.words) ? cap.words.filter(w => w && fin(w.t) && w.w).slice().sort((a, b) => a.t - b.t) : [];
    const s0 = Math.max(0, Number(clipStartS) || 0), s1 = Number(clipEndS) > s0 ? Number(clipEndS) : Infinity;
    const segs = [];
    for (let i = 0; i < cues.length; i++) {
      const startMs = Math.round(cues[i].t * 1000);
      const nextMs = i + 1 < cues.length ? Math.round(cues[i + 1].t * 1000) : startMs + TAIL_MS;
      const endMs = Math.max(startMs + MIN_SEG_MS, Math.min(nextMs, startMs + MAX_SEG_MS));
      if (endMs / 1000 <= s0 || startMs / 1000 >= s1) continue;              // outside the clip marks
      const ws = words.filter(w => w.t * 1000 >= startMs && w.t * 1000 < nextMs);
      const seg = { id: "s" + i, text: String(cues[i].txt).replace(/\s+/g, " ").trim(), startMs, endMs };
      if (ws.length) {
        seg.words = ws.map((w, k) => {
          const wStart = Math.round(w.t * 1000);
          const wEnd = k + 1 < ws.length ? Math.round(ws[k + 1].t * 1000) : endMs;
          return { id: seg.id + "w" + k, text: w.w, startMs: wStart, endMs: Math.max(wStart + 80, wEnd) };
        });
      }
      segs.push(seg);
    }
    if (!segs.length) return { segments: [], level: "none" };
    const anyWords = segs.some(s => s.words && s.words.length);
    return { segments: segs, level: anyWords ? "word" : "sentence" };
  }

  /* A transcript the learner typed or pasted: sentences, no timing. */
  function normalizeText(text) {
    const sents = splitSentences(text);
    if (!sents.length) return { segments: [], level: "none" };
    return { segments: sents.map((t, i) => ({ id: "t" + i, text: t, startMs: -1, endMs: -1 })), level: "text" };
  }

  function levelOf(asset) { return asset && asset.level ? asset.level : "none"; }

  /* Which segment / word is current at time tMs. Binary search on segment
     starts; a gap between segments keeps the previous one lit for
     `graceMs` (caption gaps are pauses, not silence to the reader). */
  function locate(asset, tMs, opts) {
    const graceMs = opts && typeof opts.graceMs === "number" ? opts.graceMs : 700;
    const segs = asset && asset.segments || [];
    if (!segs.length || levelOf(asset) === "text" || levelOf(asset) === "none") return { seg: -1, word: -1 };
    let lo = 0, hi = segs.length - 1, idx = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (segs[mid].startMs <= tMs) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
    if (idx < 0) return { seg: -1, word: -1 };
    const s = segs[idx];
    if (tMs >= s.endMs + graceMs) return { seg: -1, word: -1 };
    if (!s.words || !s.words.length) return { seg: idx, word: -1 };
    let w = -1;
    for (let k = 0; k < s.words.length; k++) { if (s.words[k].startMs <= tMs) w = k; else break; }
    if (w >= 0 && tMs >= s.words[w].endMs + graceMs) w = -1;
    return { seg: idx, word: w };
  }

  /* Next / previous sentence start for the repeat and step controls. */
  function neighbour(asset, segIndex, dir) {
    const segs = asset && asset.segments || [];
    const i = Math.max(0, Math.min(segs.length - 1, segIndex + dir));
    return segs[i] ? { index: i, startMs: segs[i].startMs, endMs: segs[i].endMs } : null;
  }

  /* ==========================================================================
     CHALLENGE — from imitation to production. Pure comparison of what the
     learner SAID with what the clip said, turned into exactly one thing done
     well and one thing to improve. Everything here returns i18n KEYS (with
     variables), never English, so index.html renders them with t() and the
     rules can be unit-tested in Node.
       tokens(text)                         → normalised word list
       align(target, heard)                 → [{op:ok|sub|miss, t, h?, hIdx}]
       findExpression(text, phrases)        → {phrase, tokens, w} | null
       usedExpression(heard, tokens)        → boolean
       challenge(target, heard, opts)       → the feedback object (see below)
     Inputs the caller may have (all optional): Whisper word timings
     [{w,start,end}], the AI pronunciation grade {overall, words:[{word,score,
     note}]} and the clip segment's own duration in ms. Nothing is invented
     when a signal is missing — the rule that needs it is simply skipped.
     ========================================================================== */
  const FILLERS = ["um", "uh", "er", "erm", "ah", "hmm", "mmm"];
  const PAUSE_S = 0.55;                // a gap inside the line this long is a hesitation
  const PASS = 0.8;                    // share of the target words that must be there

  function tokens(text) {
    return String(text || "").toLowerCase().replace(/[‿/|·…]/g, " ").replace(/[^a-z0-9' ]+/g, " ")
      .split(/\s+/).filter(Boolean).map(w => w.replace(/'/g, ""));   // i'll / ill: the recogniser is not consistent
  }
  /* Levenshtein alignment on word lists — the same rule the Shadow report uses. */
  function align(t, h) {
    const m = t.length, n = h.length, D = Array.from({ length: m + 1 }, (_, i) => { const r = Array(n + 1).fill(0); r[0] = i; return r; });
    for (let j = 1; j <= n; j++) D[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) D[i][j] = Math.min(D[i - 1][j - 1] + (t[i - 1] === h[j - 1] ? 0 : 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
    const ops = []; let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (t[i - 1] === h[j - 1] ? 0 : 1)) { ops.unshift({ op: t[i - 1] === h[j - 1] ? "ok" : "sub", t: t[i - 1], h: h[j - 1], hIdx: j - 1 }); i--; j--; }
      else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.unshift({ op: "miss", t: t[i - 1], hIdx: Math.max(0, j - 1) }); i--; }
      else j--;
    }
    return ops;
  }
  function consecutiveAt(hay, needle) {
    if (!needle.length || hay.length < needle.length) return -1;
    for (let i = 0; i + needle.length <= hay.length; i++) { let k = 0; while (k < needle.length && hay[i + k] === needle[k]) k++; if (k === needle.length) return i; }
    return -1;
  }
  /* The curriculum phrase this line carries, if any: phrases are the track's
     {p:"I'll get back to you by…"} items (or plain strings); an ellipsis marks
     the open slot. Two or more words must appear in order; the longest wins. */
  function findExpression(text, phrases) {
    const hay = tokens(text); let best = null;
    for (const item of phrases || []) {
      const p = typeof item === "string" ? item : item && item.p; if (!p) continue;
      const tk = tokens(String(p).replace(/\.{3}|…/g, " "));
      if (tk.length < 2) continue;
      if (consecutiveAt(hay, tk) >= 0 && (!best || tk.length > best.tokens.length)) best = { phrase: String(p).replace(/\s*(\.{3}|…)\s*$/, ""), tokens: tk, w: item && item.w };
    }
    return best;
  }
  function usedExpression(heard, tk) { return consecutiveAt(tokens(heard), tk || []) >= 0; }

  function challenge(target, heard, opts) {
    const o = opts || {};
    const tAll = tokens(target), hAll = tokens(heard);
    const tgt = tAll.filter(w => !FILLERS.includes(w)), hF = hAll.filter(w => !FILLERS.includes(w));
    const fillers = hAll.length - hF.length;
    const ops = tgt.length ? align(tgt, hF) : [];
    const okN = ops.filter(x => x.op === "ok").length;
    const missing = ops.filter(x => x.op === "miss").map(x => x.t);
    const wrong = ops.filter(x => x.op === "sub").map(x => ({ t: x.t, h: x.h }));
    const cnt = (arr, w) => arr.filter(x => x === w).length, usedH = ops.filter(x => x.op !== "miss").map(x => x.h);
    const misplaced = missing.filter(w => cnt(hF, w) > cnt(usedH, w));           // said, but somewhere else (a repeated word is not)
    const swapped = wrong.filter(x => tgt.includes(x.h) && hF.includes(x.t));      // two target words that changed places
    const extra = Math.max(0, hF.length - ops.filter(x => x.op !== "miss").length);
    const coverage = tgt.length ? okN / tgt.length : 0;
    /* timing, only when Whisper gave word times */
    const words = Array.isArray(o.words) && o.words.length ? o.words : null;
    let pauses = [], durS = null;
    if (words) {
      durS = Math.max(0, words[words.length - 1].end - words[0].start);
      for (let i = 1; i < words.length; i++) { const gap = words[i].start - words[i - 1].end; if (gap >= PAUSE_S) pauses.push({ i, before: words[i].w, gapS: +gap.toFixed(2) }); }
      pauses.sort((a, b) => b.gapS - a.gapS);
    }
    const targetS = o.targetMs > 0 ? o.targetMs / 1000 : null;
    const pace = durS != null && targetS ? +(durS / targetS).toFixed(2) : null;
    /* pronunciation, only when the AI grade answered */
    const graded = o.assess && Array.isArray(o.assess.words) && o.assess.words.length ? o.assess.words.filter(w => w && w.word) : null;
    const weak = graded ? graded.filter(w => w.score < 60).sort((a, b) => a.score - b.score) : [];
    const strong = graded ? graded.filter(w => w.score >= 85).sort((a, b) => b.score - a.score) : [];
    const pass = coverage >= PASS;

    /* ONE improvement, most important first: production before polish */
    let improve = null;
    const list = ws => ws.slice(0, 3).join(", ");
    if (!hF.length) improve = { k: "sv.ch_imp_nothing" };
    else if ((misplaced.length && missing.length === misplaced.length && !wrong.length) || (swapped.length && !missing.length && swapped.length === wrong.length)) improve = { k: "sv.ch_imp_order" };
    else if (missing.length) improve = { k: "sv.ch_imp_missing", v: { words: list(missing) } };
    else if (wrong.length) improve = { k: "sv.ch_imp_wrong", v: { said: wrong[0].h, target: wrong[0].t } };
    else if (pauses.length && words) {
      const p = pauses[0], from = Math.max(0, p.i - 1);
      improve = { k: "sv.ch_imp_connect", v: { phrase: words.slice(from, from + 3).map(w => w.w).join(" ") } };
    }
    else if (weak.length) improve = { k: "sv.ch_imp_pron", v: { word: weak[0].word, note: weak[0].note ? " — " + weak[0].note : "" } };
    else if (pace != null && pace > 1.6) improve = { k: "sv.ch_imp_slow" };
    else if (pace != null && pace < 0.55) improve = { k: "sv.ch_imp_fast" };
    else if (fillers) improve = { k: "sv.ch_imp_fillers", v: { n: fillers } };
    else if (extra >= 2) improve = { k: "sv.ch_imp_extra" };
    else improve = { k: "sv.ch_imp_levelup" };

    /* ONE thing done well — never the dimension the improvement is about */
    let good;
    if (coverage === 1 && tgt.length) good = { k: "sv.ch_good_all" };
    else if (words && !pauses.length && improve.k !== "sv.ch_imp_connect" && hF.length >= 3) good = { k: "sv.ch_good_smooth" };
    else if (pace != null && pace >= 0.7 && pace <= 1.4) good = { k: "sv.ch_good_rhythm" };
    else if (strong.length && improve.k !== "sv.ch_imp_pron") good = { k: "sv.ch_good_word", v: { word: strong[0].word } };
    else if (coverage >= PASS) good = { k: "sv.ch_good_most" };
    else good = { k: "sv.ch_good_tried" };

    return { coverage: +coverage.toFixed(2), ok: okN, total: tgt.length, missing, wrong, misplaced, swapped, extra, fillers, pauses, durS, pace, weak, strong, pass, good, improve };
  }

  const api = { normalizeCaptions, normalizeText, locate, neighbour, levelOf, splitSentences, tokens, align, findExpression, usedExpression, challenge, FILLERS, PASS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.ShadowSync = api;
})(typeof window !== "undefined" ? window : globalThis);
