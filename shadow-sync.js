/* ============================================================================
   BE Mastery — Shadow Studio V2: transcript synchronisation engine
   ----------------------------------------------------------------------------
   Pure functions, no DOM, no player. index.html drives them from the YouTube
   player's currentTime; tests/shadow-sync.test.mjs drives them from numbers.

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
    const cues = Array.isArray(cap && cap.cues) ? cap.cues.filter(c => c && typeof c.t === "number" && c.txt) : [];
    if (!cues.length) return { segments: [], level: "none" };
    const words = Array.isArray(cap.words) ? cap.words.filter(w => w && typeof w.t === "number" && w.w).slice().sort((a, b) => a.t - b.t) : [];
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

  const api = { normalizeCaptions, normalizeText, locate, neighbour, levelOf, splitSentences };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.ShadowSync = api;
})(typeof window !== "undefined" ? window : globalThis);
