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

  /* Each cue's start, corrected against the word stream.
     Cue times come back rounded — YouTube gives 11.6 for a line whose first
     word is stamped 11.553 — so a [cueStart, nextCueStart) window put that
     line's words in the PREVIOUS cue: the card showed one sentence while the
     words of the next one scrolled through it, and a cue that lost every word
     to its neighbour printed its own text again a line later. Snap each cue
     to the nearest word timestamp within SNAP_MS (in the library that is
     100,251 cues out of 100,253), monotonically so two cues never take the
     same one; a cue with no timestamp near it keeps its own time and the old
     window, so a stray word far outside every cue is still dropped. */
  const SNAP_MS = 500;
  function cueStarts(cues, words) {
    const raw = cues.map(c => Math.round(c.t * 1000));
    if (!words.length) return raw;
    const times = [];                                     // distinct word starts, ms, ascending
    for (const w of words) { const ms = Math.round(w.t * 1000); if (!times.length || ms !== times[times.length - 1]) times.push(ms); }
    const out = []; let prev = -Infinity, prevG = -1;
    for (let i = 0; i < cues.length; i++) {
      let lo = 0, hi = times.length - 1, j = times.length;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] >= raw[i]) { j = m; hi = m - 1 } else lo = m + 1 }
      let g = -1;
      for (const k of [j - 1, j]) if (k >= 0 && k < times.length && (g < 0 || Math.abs(times[k] - raw[i]) < Math.abs(times[g] - raw[i]))) g = k;
      let ms = raw[i];
      if (g > prevG && Math.abs(times[g] - raw[i]) <= SNAP_MS) { ms = times[g]; prevG = g; }
      out.push(Math.max(ms, prev)); prev = out[i];
    }
    return out;
  }

  /* One timestamp per caption SEGMENT, repeated on every word in it, is what
     the caption files actually carry for most lines. Read literally that lit
     the LAST word of a line the moment the line began and left it there — the
     highlight never moved. Words sharing a timestamp get an estimated moment
     inside their run, shared out by letter count exactly as estimateWords()
     does, and marked `estimated` so the panel says so. */
  function timeWords(id, ws, endMs) {
    const out = [];
    for (let k = 0; k < ws.length;) {
      let j = k; while (j + 1 < ws.length && ws[j + 1].t === ws[k].t) j++;
      const runStart = Math.round(ws[k].t * 1000);
      const runEnd = Math.max(runStart + 80, j + 1 < ws.length ? Math.round(ws[j + 1].t * 1000) : endMs);
      if (j === k) { out.push({ id: id + "w" + k, text: ws[k].w, startMs: runStart, endMs: runEnd }); k++; continue; }
      const weights = [];
      for (let q = k; q <= j; q++) weights.push(Math.max(1, String(ws[q].w).replace(/[^\p{L}\p{N}']/gu, "").length) + 1);
      const total = weights.reduce((x, y) => x + y, 0), span = runEnd - runStart;
      let at = runStart;
      for (let q = k; q <= j; q++) {
        const st = Math.round(at); at += span * weights[q - k] / total;
        out.push({ id: id + "w" + q, text: ws[q].w, startMs: st, endMs: Math.max(st + 80, Math.round(at)), estimated: true });
      }
      k = j + 1;
    }
    return out;
  }

  /* Caption cues carry only a start; a cue ends where the next begins. Words
     are attached to the cue whose (corrected) window they fall in. */
  function normalizeCaptions(cap, clipStartS, clipEndS) {
    /* defensive: a caption file is data from outside — drop cues and words
       whose time is not a finite number, and sort both, because locate()
       binary-searches segment starts and a cue ends where the next begins */
    const fin = v => typeof v === "number" && Number.isFinite(v);
    const cues = Array.isArray(cap && cap.cues) ? cap.cues.filter(c => c && fin(c.t) && c.txt).slice().sort((a, b) => a.t - b.t) : [];
    if (!cues.length) return { segments: [], level: "none" };
    const words = Array.isArray(cap.words) ? cap.words.filter(w => w && fin(w.t) && w.w).slice().sort((a, b) => a.t - b.t) : [];
    const s0 = Math.max(0, Number(clipStartS) || 0), s1 = Number(clipEndS) > s0 ? Number(clipEndS) : Infinity;
    const begins = cueStarts(cues, words);
    const segs = []; let wi = 0;                                  // words are sorted: one pass, not a filter per cue
    for (let i = 0; i < cues.length; i++) {
      const startMs = begins[i];
      const nextMs = i + 1 < cues.length ? begins[i + 1] : startMs + TAIL_MS;
      const endMs = Math.max(startMs + MIN_SEG_MS, Math.min(nextMs, startMs + MAX_SEG_MS));
      while (wi < words.length && Math.round(words[wi].t * 1000) < startMs) wi++;
      let wj = wi; while (wj < words.length && Math.round(words[wj].t * 1000) < nextMs) wj++;
      const ws = words.slice(wi, wj); wi = wj;
      if (endMs / 1000 <= s0 || startMs / 1000 >= s1) continue;              // outside the clip marks
      const seg = { id: "s" + i, text: String(cues[i].txt).replace(/\s+/g, " ").trim(), startMs, endMs };
      if (ws.length) seg.words = timeWords(seg.id, ws, endMs);
      segs.push(seg);
    }
    if (!segs.length) return { segments: [], level: "none" };
    const anyWords = segs.some(s => s.words && s.words.length);
    const out = { segments: segs, level: anyWords ? "word" : "sentence" };
    if (segs.some(s => s.words && s.words.some(w => w.estimated))) out.estimated = true;
    return out;
  }

  /* Sentence-only captions (13 of the 18 library clips have word times; the
     rest, every Worker-fetched caption file and every model-written transcript
     carry line times only): give each word an ESTIMATED moment. The result is
     marked `estimated` so the panel can say so — this is not word timing from
     the captions, and nothing else should treat it as such.

     Pacing, and why it is not an even share of the line. A line runs to the
     start of the next one, pauses and breath included, so spreading its words
     evenly over that span stretches every one of them and the mark slides off
     the voice. Words are paced by SYLLABLES at an ordinary speaking rate
     instead, from the line's start — which is the part a model gets right —
     and whatever time the line has left over is held by the last word while
     the speaker pauses. A line said faster than that rate is compressed to
     fit, so the mark can never run past its own line. Mid-line pauses still
     drift; the line itself stays lit underneath, which is the honest part. */
  const SYLL_MS = 235;                   /* ~4.2 syllables a second, unhurried speech */
  function syllables(word) {
    const s = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!s) return 1;
    const g = s.replace(/e$/, "").match(/[aeiouy]+/g);
    return Math.max(1, g ? g.length : 1);
  }
  function estimateWords(asset) {
    if (!asset || !asset.segments || !asset.segments.length) return asset;
    const segs = asset.segments.map(seg => {
      if ((seg.words && seg.words.length) || !(seg.endMs > seg.startMs)) return seg;
      const parts = String(seg.text || "").split(/\s+/).filter(Boolean);
      if (!parts.length) return seg;
      const weights = parts.map(syllables);
      const total = weights.reduce((a, b) => a + b, 0), span = seg.endMs - seg.startMs;
      const per = Math.min(SYLL_MS, span / total);     /* natural pace, compressed if the line is tight */
      let at = seg.startMs;
      const words = parts.map((w, k) => {
        const start = Math.round(at); at += per * weights[k];
        const last = k === parts.length - 1;
        return { id: seg.id + "w" + k, text: w, startMs: start, estimated: true,
                 endMs: last ? Math.max(start + 80, seg.endMs) : Math.max(start + 80, Math.round(at)) };
      });
      return Object.assign({}, seg, { words });
    });
    const anyEst = segs.some(s => s.words && s.words.length && s.words[0].estimated);
    return Object.assign({}, asset, { segments: segs, level: segs.some(s => s.words && s.words.length) ? "word" : asset.level, estimated: anyEst || !!asset.estimated });
  }

  /* A transcript the learner pasted, with timing worked out:
       1. YouTube's "Show transcript" panel copies with timestamps — "0:04" on
          its own line or at the start of one, "[00:04]", "1:02:03". Two or more
          make real cue timing (each cue ends where the next starts; the last
          runs to the video's end or TAIL_MS). Level "sentence", source
          "stamps".
       2. No timestamps: the sentences are spread over the clip's length by
          letter count. Honest but rough — level "sentence", source "spread",
          `estimated` true — and needs durationS; without it → normalizeText.
     Either way estimateWords() then gives per-word times, so a pasted clip
     lights up exactly like a library one. The plain text (stamps stripped) is
     returned as `text` for the notes box and the recorder. */
  const STAMP = /^[\[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?(?=\s|$)/;
  function stampToS(x) { const p = x.split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; }
  function normalizePasted(raw, opts) {
    const o = opts || {}, startS = Math.max(0, Number(o.startS) || 0), durationS = Number(o.durationS) > 0 ? Number(o.durationS) : 0;
    /* every timestamp starts a line, wherever it was pasted */
    const lines = String(raw || "").replace(/\r/g, "").replace(/(^|\s)([\[(]?(?:\d{1,2}:)?\d{1,2}:\d{2}[\])]?)(?=\s|$)/g, "$1\n$2").split("\n");
    const cues = []; let cur = null, stamps = 0;
    for (const ln of lines) {
      const t = ln.trim(); if (!t) continue;
      const m = t.match(STAMP);
      if (m) { stamps++; cur = { t: stampToS(m[1]), txt: t.slice(m[0].length).trim() }; cues.push(cur); }
      else if (cur) cur.txt = (cur.txt ? cur.txt + " " : "") + t;
      else cues.push({ t: -1, txt: t });
    }
    const text = stamps >= 2 ? cues.map(c => c.txt).filter(Boolean).join("\n") : String(raw || "").replace(/\r/g, "").trim();   // one lone "12:30" in prose is prose
    if (stamps >= 2 && cues.filter(c => c.t >= 0 && c.txt).length >= 2) {
      const timed = cues.filter(c => c.t >= 0 && c.txt);
      const cap = { cues: timed.map(c => ({ t: c.t, txt: c.txt })) };
      const a = normalizeCaptions(cap, startS, durationS ? startS + durationS : 0);
      return Object.assign(a, { source: "stamps", text });
    }
    const sents = splitSentences(text);
    if (!sents.length) return { segments: [], level: "none", text };
    if (!durationS) return Object.assign(normalizeText(text), { text });
    const weights = sents.map(t => Math.max(1, t.replace(/[^\p{L}\p{N}]/gu, "").length) + 6);
    const total = weights.reduce((x, y) => x + y, 0); let at = startS * 1000;
    const segs = sents.map((t, i) => { const startMs = Math.round(at); at += durationS * 1000 * weights[i] / total; return { id: "p" + i, text: t, startMs, endMs: Math.max(startMs + MIN_SEG_MS, Math.round(at)) }; });
    return { segments: segs, level: "sentence", estimated: true, source: "spread", text };
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
     learner SAID with what the clip said, turned into a coaching report for
     the NEXT attempt. Everything here returns i18n KEYS (with variables),
     never English, so index.html renders them with t() and the rules can be
     unit-tested in Node.
       tokens(text)                         → normalised word list
       norm(list)                           → tokens with contractions expanded,
                                              numbers spelt, spelling folded
       align(target, heard)                 → [{op:ok|sub|miss, t, h?, hIdx}]
       findExpression(text, phrases)        → {phrase, tokens, w} | null
       usedExpression(heard, tokens)        → boolean
       challenge(target, heard, opts)       → the report (see below)
       verdict(report)                      → strong | good | practice | attention
       progress(prev, cur)                  → better | same | first
     Inputs the caller may have (all optional): Whisper word timings
     [{w,start,end}], the clip's own word times [{text,startMs,endMs,
     estimated}], the AI pronunciation grade {overall, mode, words:[{word,
     score, note}]} and the clip segment's duration in ms. Nothing is invented
     when a signal is missing — the rule that needs it is skipped and the
     dimension reports "na", never a number.
     What each dimension really measures (be honest in the UI):
       words    — speech recognition + word alignment. "Did the words come?"
       pron     — an audio model LISTENED and scored each word; only when the
                  Worker answered with mode "ai". The Whisper fallback is a
                  string match and is NOT pronunciation — it is reported as na.
       fluency  — gaps between recognised words and filler words. Timing only.
       timing   — the take's length against the clip's line.
       rhythm   — relative word lengths against the speaker's own word times,
                  only when the clip carries REAL word times (not estimated)
                  and enough words aligned. An estimate, labelled so.
     Pitch, stress and intonation are NOT measured: the speaker's audio is
     inside a YouTube frame the page cannot read, so there is nothing to
     compare against. No dimension is drawn for them.
     ========================================================================== */
  const FILLERS = ["um", "uh", "er", "erm", "ah", "hmm", "mmm"];
  const PAUSE_S = 0.55;                // a gap inside the line this long is a hesitation
  const PASS = 0.8;                    // share of the target words that must be there
  const WEAK = 60, STRONG = 85;        // AI word scores: below / above

  function tokens(text) {
    return String(text || "").toLowerCase().replace(/[‿/|·…]/g, " ").replace(/[^a-z0-9' ]+/g, " ")
      .split(/\s+/).filter(Boolean).map(w => w.replace(/'/g, ""));   // i'll / ill: the recogniser is not consistent
  }
  /* "I'm" for "I am" is the same line said naturally, and the recogniser
     writes either at will; the same for "honoured" / "honored" and "25" /
     "twenty five". Both sides go through the same fold, so nothing here can
     turn a real difference into a match — only the spelling of one. Words
     that are also ordinary words (well, were, id, hell) are left alone. */
  const CONTRACTIONS = { im: "i am", ive: "i have", ill: "i will", youre: "you are", youve: "you have", youll: "you will", hes: "he is", shes: "she is", its: "it is", itll: "it will",
    weve: "we have", theyre: "they are", theyve: "they have", theyll: "they will", isnt: "is not", arent: "are not", wasnt: "was not", werent: "were not", dont: "do not", doesnt: "does not",
    didnt: "did not", cant: "can not", cannot: "can not", wont: "will not", wouldnt: "would not", couldnt: "could not", shouldnt: "should not", havent: "have not", hasnt: "has not", hadnt: "had not",
    thats: "that is", whats: "what is", wheres: "where is", theres: "there is", heres: "here is", whos: "who is", hows: "how is", lets: "let us", gonna: "going to", wanna: "want to", gotta: "got to", ok: "okay" };
  const SPELL = { grey: "gray", programme: "program", cheque: "check", practise: "practice", licence: "license", defence: "defense", offence: "offense", enrol: "enroll", fulfil: "fulfill",
    judgement: "judgment", ageing: "aging", travelled: "traveled", travelling: "traveling", traveller: "traveler", cancelled: "canceled", cancelling: "canceling", modelling: "modeling", modelled: "modeled",
    labelled: "labeled", labelling: "labeling", counselling: "counseling", levelled: "leveled", fuelled: "fueled", marvellous: "marvelous", jewellery: "jewelry", kerb: "curb", tyre: "tire", mum: "mom",
    learnt: "learned", spelt: "spelled", dreamt: "dreamed", burnt: "burned", whilst: "while", amongst: "among", aluminium: "aluminum", storey: "story", pyjamas: "pajamas", moustache: "mustache",
    plough: "plow", sceptical: "skeptical", skilful: "skillful", wilful: "willful", instalment: "installment", artefact: "artifact", cosy: "cozy", mould: "mold", draught: "draft", tonne: "ton", manoeuvre: "maneuver" };
  const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  function numWords(n) {
    if (n < 20) return [ONES[n]];
    if (n < 100) return n % 10 ? [TENS[Math.floor(n / 10)], ONES[n % 10]] : [TENS[n / 10]];
    if (n < 1000) return [ONES[Math.floor(n / 100)], "hundred"].concat(n % 100 ? numWords(n % 100) : []);
    if (n < 10000 && n % 1000 === 0) return [ONES[n / 1000], "thousand"];
    return [String(n)];
  }
  function fold(w) {
    if (SPELL[w]) return SPELL[w];
    let x = w;
    if (x.length >= 6) x = x.replace(/our(s|ed|ing|able|ite|ites)?$/, "or$1");      // colour, honoured, favourite — never "four", "hour"
    x = x.replace(/isation(s)?$/, "ization$1").replace(/is(e|ed|es|er|ers|ing)$/, "iz$1").replace(/ys(e|ed|es|ing)$/, "yz$1");
    x = x.replace(/([bt])re$/, "$1er").replace(/ogue(s)?$/, "og$1");                  // centre, theatre, dialogue
    return x;
  }
  /* list of {text, ...} (a caption word, a Whisper word, or a plain split of
     the text) → [{k, disp, wi, ...timing}], one entry per normalised token,
     each pointing back at the word it came from */
  function norm(list) {
    const out = [];
    (list || []).forEach((item, wi) => {
      const src = typeof item === "string" ? { text: item } : item || {};
      const disp = String(src.text || "").toLowerCase().replace(/[^a-z0-9' ]+/g, "").trim();
      tokens(src.text).forEach(tk => {
        let ks = /^\d+$/.test(tk) && tk.length <= 4 ? numWords(+tk) : (CONTRACTIONS[tk] ? CONTRACTIONS[tk].split(" ") : [tk]);
        ks.forEach(k => out.push(Object.assign({ k: fold(k), disp, wi }, src.startMs != null ? { ms: [src.startMs, src.endMs], est: !!src.estimated } : {}, src.start != null ? { s: [src.start, src.end] } : {})));
      });
    });
    return out;
  }
  /* Levenshtein alignment on word lists — the same rule the Shadow report uses. */
  function align(t, h) {
    const m = t.length, n = h.length, D = Array.from({ length: m + 1 }, (_, i) => { const r = Array(n + 1).fill(0); r[0] = i; return r; });
    for (let j = 1; j <= n; j++) D[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) D[i][j] = Math.min(D[i - 1][j - 1] + (t[i - 1] === h[j - 1] ? 0 : 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
    const ops = []; let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (t[i - 1] === h[j - 1] ? 0 : 1)) { ops.unshift({ op: t[i - 1] === h[j - 1] ? "ok" : "sub", t: t[i - 1], h: h[j - 1], hIdx: j - 1, tIdx: i - 1 }); i--; j--; }
      else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.unshift({ op: "miss", t: t[i - 1], hIdx: Math.max(0, j - 1), tIdx: i - 1 }); i--; }
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

  /* Function words: never a vocabulary item, and their trouble is usually
     connected speech, not the word itself. */
  const FUNCTION_WORDS = new Set(("a an the and or but so if of to in on at by for with from as into onto about over under up down out off than then that this these those " +
    "i me my you your he him his she her it its we us our they them their who whom whose which what when where why how am is are was were be been being have has had do does did " +
    "will would can could shall should may might must not no yes here there very just also too only own same such both each all any some more most other").split(" "));
  const isFunction = w => FUNCTION_WORDS.has(w);
  const uniqDisp = items => { const out = []; items.forEach(x => { if (!out.length || out[out.length - 1].wi !== x.wi) out.push(x); }); return out.map(x => x.disp).join(" "); };
  function pearson(xs, ys) {
    const n = xs.length; if (n < 2) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    return sxx && syy ? +(sxy / Math.sqrt(sxx * syy)).toFixed(2) : null;
  }

  function challenge(target, heard, opts) {
    const o = opts || {};
    /* the two sides, normalised the same way, each token remembering its word
       (for display and for the audio span it came from) */
    const words = Array.isArray(o.words) && o.words.length ? o.words : null;
    const hSrc = words ? words.map(w => ({ text: w.w, start: w.start, end: w.end })) : String(heard || "").split(/\s+/).filter(Boolean);
    const tAllN = norm(String(target || "").split(/\s+/).filter(Boolean)), hAllN = norm(hSrc);
    /* the clip's word times belong to the text the learner sees: the caption
       word track can carry a word the cue does not (or split one differently),
       so the text defines the tokens and the track only lends each its time */
    if (Array.isArray(o.targetWords) && o.targetWords.length) {
      const twN = norm(o.targetWords);
      align(tAllN.map(x => x.k), twN.map(x => x.k)).forEach(op => { if (op.op === "ok" && twN[op.hIdx].ms) { tAllN[op.tIdx].ms = twN[op.hIdx].ms; tAllN[op.tIdx].est = twN[op.hIdx].est; } });
    }
    const tN = tAllN.filter(x => !FILLERS.includes(x.k)), hN = hAllN.filter(x => !FILLERS.includes(x.k));
    const fillers = hAllN.length - hN.length;
    const tgt = tN.map(x => x.k), hF = hN.map(x => x.k);
    const ops = tgt.length ? align(tgt, hF) : [];
    const okN = ops.filter(x => x.op === "ok").length;
    const missing = ops.filter(x => x.op === "miss").map(x => x.t);
    const wrong = ops.filter(x => x.op === "sub").map(x => ({ t: x.t, h: x.h, tIdx: x.tIdx, hIdx: x.hIdx }));
    const cnt = (arr, w) => arr.filter(x => x === w).length, usedH = ops.filter(x => x.op !== "miss").map(x => x.h);
    const misplaced = missing.filter(w => cnt(hF, w) > cnt(usedH, w));           // said, but somewhere else (a repeated word is not)
    const swapped = wrong.filter(x => tgt.includes(x.h) && hF.includes(x.t));      // two target words that changed places
    const extra = Math.max(0, hF.length - ops.filter(x => x.op !== "miss").length);
    const coverage = tgt.length ? okN / tgt.length : 0;
    /* timing, only when Whisper gave word times */
    let pauses = [], durS = null;
    if (words) {
      durS = Math.max(0, words[words.length - 1].end - words[0].start);
      for (let i = 1; i < words.length; i++) { const gap = words[i].start - words[i - 1].end; if (gap >= PAUSE_S) pauses.push({ i, before: words[i].w, gapS: +gap.toFixed(2), s: [words[i - 1].start, words[i].end] }); }
      pauses.sort((a, b) => b.gapS - a.gapS);
    }
    const targetS = o.targetMs > 0 ? o.targetMs / 1000 : null;
    /* a cue-only line's length includes the silence after it, so against an
       estimated target only "slower than even that" is a finding */
    let pace = durS != null && targetS ? +(durS / targetS).toFixed(2) : null;
    if (pace != null && o.targetEstimated && pace <= 1.6) pace = null;
    /* pronunciation, only when an audio model actually listened ("ai"). The
       Whisper fallback is a transcript match and must not pose as one. */
    const pronMode = o.assess && Array.isArray(o.assess.words) && o.assess.words.length ? (o.assess.mode || "ai") : null;
    const graded = pronMode === "ai" ? o.assess.words.filter(w => w && w.word).map(w => Object.assign({}, w, { k: fold(tokens(w.word)[0] || "") })) : null;
    const weak = graded ? graded.filter(w => w.score < WEAK).sort((a, b) => a.score - b.score) : [];
    const strong = graded ? graded.filter(w => w.score >= STRONG).sort((a, b) => b.score - a.score) : [];
    const pass = coverage >= PASS;

    /* per target word: what happened to it, where it is in the clip, where it
       is in the take (Whisper span of the heard word, or the gap it should
       have filled) */
    const scoreOf = k => { const g = graded && graded.find(w => w.k === k); return g ? g : null; };
    const tokensOut = tN.map((x, i) => {
      const op = ops.find(p => p.tIdx === i) || { op: "miss" };
      const hTok = op.op !== "miss" ? hN[op.hIdx] : null;
      const g = op.op === "ok" ? scoreOf(x.k) : null;
      let state = op.op === "ok" ? (g && g.score < WEAK ? "pron" : "ok") : op.op;
      const gapAfter = !!(hTok && hTok.s && words && pauses.some(p => words[p.i - 1] && hTok.s[1] === words[p.i - 1].end));
      return { i, k: x.k, text: x.disp, wi: x.wi, state, h: hTok ? hTok.disp : null, ms: x.ms || null, est: !!x.est, s: hTok && hTok.s ? hTok.s : null, score: g ? g.score : null, note: g && g.note ? g.note : "", pauseAfter: !!gapAfter, fn: isFunction(x.k) };
    });
    /* the learner's span for a missing run: from the heard word before it to
       the heard word after it — the place the words should have been */
    const spanAround = (i0, i1) => {
      let a = null, b = null;
      for (let i = i0 - 1; i >= 0; i--) if (tokensOut[i].s) { a = tokensOut[i].s; break; }
      for (let i = i1 + 1; i < tokensOut.length; i++) if (tokensOut[i].s) { b = tokensOut[i].s; break; }
      return a || b ? [a ? a[0] : b[0], b ? b[1] : a[1]] : null;
    };
    const msSpan = (i0, i1) => { const a = tokensOut[i0].ms, b = tokensOut[i1].ms; return a && b ? [a[0], b[1]] : null; };
    const estSpan = (i0, i1) => tokensOut.slice(i0, i1 + 1).some(x => x.est);
    const textSpan = (i0, i1) => uniqDisp(tN.slice(i0, i1 + 1));

    /* ---- issues, most important first, at most three, distinct kinds ---- */
    const issues = [];
    const push = it => { if (issues.length < 3 && !(it.type !== "missing" && it.type !== "pron" && issues.some(x => x.type === it.type))) issues.push(it); };
    const list = ws => ws.slice(0, 3).join(", ");
    if (!hF.length) push({ type: "nothing", dim: "words", k: "sv.ch_imp_nothing" });
    else if ((misplaced.length && missing.length === misplaced.length && !wrong.length) || (swapped.length && !missing.length && swapped.length === wrong.length)) push({ type: "order", dim: "words", k: "sv.ch_imp_order", tSpan: [0, tN.length - 1], text: textSpan(0, tN.length - 1), ms: msSpan(0, tN.length - 1), s: hN.length && hN[0].s ? [hN[0].s[0], hN[hN.length - 1].s[1]] : null });
    else {
      /* missing words grouped into the phrases they form ("with you"), longest first */
      const runs = []; let run = null;
      tokensOut.forEach(x => { if (x.state === "miss") { if (run && run[1] === x.i - 1) run[1] = x.i; else runs.push(run = [x.i, x.i]); } });
      runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
      runs.slice(0, 2).forEach(([i0, i1]) => push({ type: "missing", dim: "words", k: i1 > i0 ? "sv.ch_imp_missing_phrase" : "sv.ch_imp_missing", v: { words: textSpan(i0, i1), phrase: textSpan(i0, i1) }, tSpan: [i0, i1], text: textSpan(i0, i1), ms: msSpan(i0, i1), est: estSpan(i0, i1), s: spanAround(i0, i1) }));
      if (wrong.length) { const w = wrong[0], x = tokensOut[w.tIdx]; push({ type: "wrong", dim: "words", k: "sv.ch_imp_wrong", v: { said: hN[w.hIdx].disp, target: x.text }, tSpan: [w.tIdx, w.tIdx], text: x.text, ms: x.ms, est: x.est, s: x.s }); }
      weak.slice(0, 2).forEach(w => { const x = tokensOut.find(y => y.k === w.k && y.state !== "miss"); if (!x) return; push({ type: "pron", dim: "pron", k: "sv.ch_imp_pron", v: { word: x.text, note: w.note ? " — " + w.note : "" }, tSpan: [x.i, x.i], text: x.text, ms: x.ms, est: x.est, s: x.s, score: w.score, note: w.note || "" }); });
      if (pauses.length && words) {
        const p = pauses[0], from = Math.max(0, p.i - 1), ph = words.slice(from, from + 3).map(w => w.w).join(" ");
        const at = tokensOut.find(x => x.s && x.s[0] === words[p.i].start), i0 = at ? Math.max(0, at.i - 1) : -1, i1 = at ? Math.min(tN.length - 1, at.i + 1) : -1;
        push({ type: "pause", dim: "fluency", k: "sv.ch_imp_connect", v: { phrase: ph }, tSpan: at ? [i0, i1] : null, text: at ? textSpan(i0, i1) : ph, ms: at ? msSpan(i0, i1) : null, est: at ? estSpan(i0, i1) : false, s: [words[from].start, words[Math.min(words.length - 1, from + 2)].end], gapS: p.gapS });
      }
      if (pace != null && pace > 1.6) push({ type: "slow", dim: "timing", k: "sv.ch_imp_slow" });
      else if (pace != null && pace < 0.55) push({ type: "fast", dim: "timing", k: "sv.ch_imp_fast" });
      if (fillers) push({ type: "fillers", dim: "fluency", k: "sv.ch_imp_fillers", v: { n: fillers } });
      if (extra >= 2) push({ type: "extra", dim: "words", k: "sv.ch_imp_extra" });
    }
    /* ---- rhythm: relative word lengths against the speaker's, only with real
       word times on both sides and enough words aligned ---- */
    let rhythm = null;
    if (words && tN.some(x => x.ms)) {
      const pairs = tokensOut.filter(x => x.state !== "miss" && x.state !== "sub" && x.ms && x.s && !x.est && x.ms[1] > x.ms[0] && x.s[1] > x.s[0]);
      const seen = new Set(), uniq = pairs.filter(x => !seen.has(x.wi) && seen.add(x.wi));   // one entry per source word
      if (uniq.length >= 6) {
        const dT = uniq.map(x => (x.ms[1] - x.ms[0]) / 1000), dH = uniq.map(x => x.s[1] - x.s[0]);
        const r = pearson(dT, dH);
        if (r != null) rhythm = { r, n: uniq.length };
      }
    }
    if (rhythm && rhythm.r < 0.35 && !issues.some(x => x.dim === "words" && x.type !== "extra")) push({ type: "rhythm", dim: "rhythm", k: "sv.ch_imp_rhythm", tSpan: [0, tN.length - 1], text: textSpan(0, tN.length - 1), ms: msSpan(0, tN.length - 1), s: hN.length && hN[0].s ? [hN[0].s[0], hN[hN.length - 1].s[1]] : null });
    if (!issues.length) push({ type: "levelup", dim: "words", k: "sv.ch_imp_levelup" });

    /* ---- dimensions: a state only where there is a signal ---- */
    const dims = {
      words: { state: !tgt.length ? "na" : coverage === 1 && !wrong.length && extra < 2 ? "strong" : coverage >= 0.9 ? "good" : coverage >= PASS ? "practice" : "attention", basis: "asr" },
      pron: { state: !graded ? "na" : (() => { const avg = graded.reduce((a, w) => a + w.score, 0) / graded.length; return avg >= STRONG && !weak.length ? "strong" : avg >= 70 && weak.length <= 1 ? "good" : weak.length <= 2 ? "practice" : "attention"; })(), basis: pronMode === "ai" ? "ai" : pronMode === "whisper" ? "whisper" : null },
      fluency: { state: !words || hF.length < 3 ? "na" : (() => { const n = pauses.length + fillers; return n === 0 ? "strong" : n === 1 ? "good" : n === 2 ? "practice" : "attention"; })(), basis: "timing" },
      timing: { state: pace == null ? "na" : (pace >= 0.85 && pace <= 1.2) ? "strong" : (pace >= 0.7 && pace <= 1.4) ? "good" : (pace >= 0.55 && pace <= 1.6) ? "practice" : "attention", basis: "timing" },
      rhythm: { state: !rhythm ? "na" : rhythm.r >= 0.6 ? "strong" : rhythm.r >= 0.35 ? "good" : "practice", basis: "estimate" },
    };

    /* ONE improvement (the first issue) and ONE thing done well — the pair the
       first Challenge showed; still the spine of the report */
    const improve = { k: issues[0].k, v: issues[0].v };
    let good;
    if (coverage === 1 && tgt.length) good = { k: "sv.ch_good_all" };
    else if (words && !pauses.length && improve.k !== "sv.ch_imp_connect" && hF.length >= 3) good = { k: "sv.ch_good_smooth" };
    else if (pace != null && pace >= 0.7 && pace <= 1.4) good = { k: "sv.ch_good_rhythm" };
    else if (strong.length && improve.k !== "sv.ch_imp_pron") good = { k: "sv.ch_good_word", v: { word: strong[0].word } };
    else if (coverage >= PASS) good = { k: "sv.ch_good_most" };
    else good = { k: "sv.ch_good_tried" };

    /* weak words to drill: mispronounced (AI), then missing, then substituted —
       content words first, each once */
    const weakWords = [];
    const addWeak = (x, why, score, note) => { if (x && !weakWords.some(w => w.k === x.k)) weakWords.push({ k: x.k, text: x.text, i: x.i, why, score: score == null ? null : score, note: note || "", ms: x.ms, est: x.est, s: x.s, fn: x.fn, vocab: !x.fn && x.k.length >= 3 }); };
    weak.forEach(w => addWeak(tokensOut.find(y => y.k === w.k && y.state !== "miss"), "pron", w.score, w.note));
    tokensOut.filter(x => x.state === "miss" && !x.fn).forEach(x => addWeak(x, "miss"));
    tokensOut.filter(x => x.state === "sub").forEach(x => addWeak(x, "sub"));
    tokensOut.filter(x => x.state === "miss" && x.fn).forEach(x => addWeak(x, "miss"));

    const report = { coverage: +coverage.toFixed(2), ok: okN, total: tgt.length, missing, wrong: wrong.map(x => ({ t: x.t, h: x.h })), misplaced, swapped, extra, fillers, pauses, durS, pace, weak, strong, pass, good, improve,
      tokens: tokensOut, heardTokens: hN.map(x => ({ k: x.k, text: x.disp, s: x.s || null })), issues, dims, rhythm, pronMode, weakWords };
    report.verdict = verdict(report);
    return report;
  }
  /* one word for the attempt as a whole */
  function verdict(r) {
    if (!r || !r.total) return "attention";
    const issueful = r.issues.filter(x => x.type !== "levelup");
    if (r.coverage === 1 && !r.wrong.length && !issueful.some(x => x.dim !== "timing" && x.dim !== "rhythm")) return "strong";
    if (r.pass) return "good";
    if (r.coverage >= 0.5) return "practice";
    return "attention";
  }
  /* attempt-to-attempt: did it get better? Counted on what is measured on
     both — words first, then fewer issues, then pronunciation. */
  function progress(prev, cur) {
    if (!prev) return "first";
    const rank = { attention: 0, practice: 1, good: 2, strong: 3 };
    if (cur.coverage > prev.coverage + 0.04) return "better";
    if (cur.coverage < prev.coverage - 0.04) return "worse";
    const n = r => r.issues.filter(x => x.type !== "levelup").length;
    if (n(cur) < n(prev)) return "better";
    if (n(cur) > n(prev)) return "worse";
    if (rank[cur.verdict] > rank[prev.verdict]) return "better";
    if (rank[cur.verdict] < rank[prev.verdict]) return "worse";
    return "same";
  }
  /* the state of one word drill from its grade: the same thresholds as the
     line, and "heard" / "not heard" when only the transcript answered */
  function drillState(assess, heardText, word) {
    const ks = norm([String(word || "")]).map(x => x.k);
    const heardK = norm(String(heardText || "").split(/\s+/)).map(x => x.k);
    const heard = ks.length > 0 && ks.every(k => heardK.includes(k));
    if (assess && assess.mode === "ai" && Array.isArray(assess.words) && assess.words.length) {
      const hits = ks.map(k => assess.words.find(x => fold(tokens(x.word)[0] || "") === k)).filter(Boolean);
      const use = hits.length ? hits : assess.words;
      const score = Math.round(use.reduce((a, w) => a + (+w.score || 0), 0) / use.length);
      const worst = use.slice().sort((a, b) => a.score - b.score)[0];
      return { mode: "ai", score, heard, note: (worst && worst.note) || "", state: score >= STRONG ? "strong" : score >= WEAK ? "good" : "practice" };
    }
    return { mode: "asr", score: null, heard, note: "", state: heard ? "good" : "practice" };
  }

  /* ==========================================================================
     THE LADDER — one paragraph, five rungs, the app choosing which one
     --------------------------------------------------------------------------
     Kadota & Tamai's four shadowing stages (mumbling → synchronised reading →
     prosody shadowing → content shadowing) folded into a single tab, with a
     listening gate in front of them. The learner never picks a level: the rung
     comes out of what the last attempt actually scored, which is the one thing
     a picker could never get right (owner, 22 Sep 2026: one way to challenge a
     paragraph, no row of tabs).

       gate    tap the words you heard — no microphone, proves you listened
       sync    speak WITH the clip, reading it: scored on lag, not on words
       recall  read it, it blurs, say it from memory  (the old Challenge)
       blind   never shown: hear it once, then say it
       retell  say what it meant, in your own words

     Every rung is skipped when the clip cannot support it honestly — sync
     needs real word times, gate needs enough content words — so a clip with a
     pasted transcript still has a Challenge, just a shorter ladder.
     ========================================================================== */
  const RUNGS = ["gate", "sync", "recall", "blind", "retell"];
  const SPEEDS = [0.75, 1, 1.25];

  /* Which rungs this clip can actually carry. `words` is true only when the
     paragraph has REAL (not estimated) word times, because sync measures a lag
     against them and an estimate would invent one. */
  function rungsFor(o) {
    const c = o || {};
    return RUNGS.filter(r => {
      if (r === "sync") return !!c.words && !!c.clip;
      if (r === "gate") return (c.contentWords || 0) >= 4;
      if (r === "retell") return (c.contentWords || 0) >= 6;
      return true;
    });
  }

  /* The next rung after an attempt. Pass → up. One miss → the same rung again.
     Two misses in a row → down one, and a notch slower, because repeating a
     rung you cannot do is how a learner decides the app is broken.
     Speed only ever changes on the spoken rungs; gate and retell ignore it. */
  function nextRung(st) {
    const s = st || {}, list = s.rungs && s.rungs.length ? s.rungs : RUNGS;
    const spoken = s.rung === "recall" || s.rung === "blind" || s.rung === "sync";
    const at = Math.max(0, list.indexOf(s.rung));
    const si = Math.max(0, SPEEDS.indexOf(s.speed == null ? 1 : s.speed));
    const fails = +s.fails || 0;
    if (s.pass) {
      /* passing below full speed earns the speed, not the next rung: the same
         words at 1.25× is a different exercise from the next rung down */
      if (spoken && si < SPEEDS.length - 1 && s.speed < 1) return { rung: s.rung, speed: SPEEDS[si + 1], move: "faster", fails: 0 };
      if (at >= list.length - 1) return { rung: s.rung, speed: SPEEDS[si], move: "done", fails: 0 };
      return { rung: list[at + 1], speed: spoken && si > 1 ? 1 : SPEEDS[si], move: "up", fails: 0 };
    }
    if (fails + 1 >= 2 && at > 0) return { rung: list[at - 1], speed: spoken && si > 0 ? SPEEDS[si - 1] : SPEEDS[si], move: "down", fails: 0 };
    /* Nothing below the first rung to drop to. Missing it twice must still
       move the learner ON rather than hold them there: a gate that can trap
       somebody is worse than no gate, and the rung above is where the actual
       practice is. */
    if (fails + 1 >= 2 && at === 0 && list.length > 1) return { rung: list[1], speed: SPEEDS[si], move: "past", fails: 0 };
    if (fails + 1 >= 2 && spoken && si > 0) return { rung: s.rung, speed: SPEEDS[si - 1], move: "slower", fails: 0 };
    return { rung: s.rung, speed: SPEEDS[si], move: "again", fails: fails + 1 };
  }

  /* ---- gate: the words you heard ----
     Content words blanked out of the line, each with two decoys taken from the
     SAME paragraph. Decoys from elsewhere would be guessable by topic alone;
     decoys from inside it mean the only way through is to have listened. A
     paragraph with too few content words makes fewer blanks rather than
     borrowing words it does not have. */
  function gapItems(text, n, seed) {
    /* the raw words, so a chip reads "PayPal" and not the folded "paypal" */
    const raw = String(text || "").split(/\s+/);
    const show = i => String(raw[i] == null ? "" : raw[i]).replace(/^[^\w'’-]+|[^\w'’-]+$/g, "") || String(raw[i] || "");
    const ws = norm(raw).filter(x => x.k);
    const content = ws.filter(x => !isFunction(x.k) && x.k.length >= 4);
    const seen = new Set(), pool = content.filter(x => !seen.has(x.k) && seen.add(x.k));
    const want = Math.min(n || 3, pool.length, Math.max(0, pool.length - 2));   // always leave two words to be decoys
    if (want < 1) return [];
    const rnd = mulberry(seed == null ? pool.length * 7919 : seed);
    const pick = [], taken = new Set();
    /* spread the blanks across the line rather than clustering at the front */
    const step = pool.length / want;
    for (let i = 0; i < want; i++) {
      let j = Math.min(pool.length - 1, Math.floor(i * step + rnd() * step));
      while (taken.has(j)) j = (j + 1) % pool.length;
      taken.add(j); pick.push(pool[j]);
    }
    pick.sort((a, b) => a.wi - b.wi);
    return pick.map(x => {
      const others = pool.filter(y => y.k !== x.k);
      const decoys = [];
      while (decoys.length < 2 && others.length) decoys.push(show(others.splice(Math.floor(rnd() * others.length), 1)[0].wi));
      const opts = [show(x.wi)].concat(decoys);
      for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
      return { wi: x.wi, k: x.k, answer: show(x.wi), options: opts };
    });
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---- sync: speaking WITH the speaker ----
     No transcript is involved, and none could be: the clip is playing into the
     room while the learner talks, so an ASR pass would hear both of them. What
     CAN be measured is when the learner made sound against when the speaker
     did. `mine` is the microphone's loudness sampled at a fixed step
     (SYNC_STEP seconds), `target` is the clip's real word spans in ms. The
     report is a lag in seconds, how tightly the two rise and fall together,
     and how many of the speaker's words the learner was actually speaking
     over.

     `bleed` is the honest escape hatch: a microphone that is hearing the video
     rather than the learner produces a near-perfect correlation at almost zero
     lag, which no human achieves. We say so instead of awarding a top score. */
  /* SYNC_DRIFT is deliberately low: smoothing attenuates a growing lag, so a
     measured quarter-second of drift is already more than that in the room. */
  const SYNC_STEP = 0.04, SYNC_MAX_LAG = 1.6, SYNC_MIN_LAG = -0.4, SYNC_SMOOTH = 0.28, SYNC_ON = 0.18, SYNC_DRIFT = 0.22, SYNC_QUIET = 0.012;
  const smooth = (xs, win) => {
    const w = Math.max(1, Math.round(win));
    const out = new Array(xs.length).fill(0);
    let sum = 0;
    for (let i = 0; i < xs.length + w; i++) {
      if (i < xs.length) sum += xs[i];
      if (i - w >= 0) sum -= xs[i - w];
      const c = i - (w >> 1);
      if (c >= 0 && c < xs.length) out[c] = sum / Math.min(w, i + 1);
    }
    return out;
  };
  const variance = xs => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length; };

  function syncReport(mine, target, opts) {
    const o = opts || {}, step = o.step || SYNC_STEP;
    const v = (mine && mine.v) || [], t0 = (mine && mine.t0) || 0;
    const words = (target || []).filter(w => w && w.endMs > w.startMs);
    if (v.length < 8 || !words.length) return { state: "na", reason: "short" };
    /* the learner's envelope, normalised against its own loudest moment, with
       the quiet 20% treated as the room rather than as speech */
    const sorted = v.slice().sort((a, b) => a - b);
    const peak = sorted[sorted.length - 1];
    /* The room's level, not the learner's. A plain low percentile fails on the
       very takes this rung is for: someone shadowing well is making sound most
       of the time, so the tenth percentile lands INSIDE their speech, the
       floor comes out at the peak and the whole take reads as silence. Capping
       the floor well below the peak keeps a usable range whether the paragraph
       is full of pauses or barely has any. */
    const floor = Math.min(sorted[Math.floor(sorted.length * 0.1)], peak * 0.35);
    const span = Math.max(1e-6, peak - floor);
    const mn = v.map(x => Math.max(0, Math.min(1, (x - floor) / span)));
    const voiced = mn.filter(x => x > SYNC_ON).length / mn.length;
    /* Silence has to be judged on the ABSOLUTE level, not the normalised one:
       normalising always stretches the loudest sample to 1, so a room recorded
       in silence comes back looking like continuous speech. Automatic gain is
       switched off at the microphone, so a whole paragraph whose loudest
       moment is this quiet really is nobody speaking. */
    if (peak < SYNC_QUIET) return { state: "na", reason: "quiet", voiced: 0 };
    if (voiced < 0.06) return { state: "na", reason: "quiet", voiced: +voiced.toFixed(2) };
    /* A microphone delivering one unchanging level — a drone, a fan, a dead
       line — has no words in it to place against anything. Coverage alone
       would read it as "speaking the whole way through", so it is refused
       here rather than flattered by the report. */
    if (variance(mn) < 0.02) return { state: "na", reason: "flat", voiced: +voiced.toFixed(2) };
    /* the speaker's envelope on the same grid, from the word spans */
    const a0 = words[0].startMs / 1000, a1 = words[words.length - 1].endMs / 1000;
    const n = Math.ceil((a1 - a0) / step);
    if (n < 12) return { state: "na", reason: "short" };
    const tg = new Array(n).fill(0);
    words.forEach(w => {
      const i0 = Math.max(0, Math.floor((w.startMs / 1000 - a0) / step)), i1 = Math.min(n - 1, Math.ceil((w.endMs / 1000 - a0) / step));
      for (let i = i0; i <= i1; i++) tg[i] = 1;
    });
    /* Where the learner's voice starts and stops. This is what carries the
       measurement on dense speech: a paragraph read straight through has
       almost no phrase shape to correlate against, and the correlation then
       has nothing to lock on to — while "how long after they started did you
       start" is exactly the question this rung asks, and is answerable from
       the edges alone. Three samples in a row keeps a cough or a click from
       counting as the start. */
    const RUN = 3;
    const edge = back => {
      const n2 = mn.length;
      for (let i = 0; i < n2; i++) {
        const j = back ? n2 - 1 - i : i;
        let okRun = true;
        for (let k = 0; k < RUN; k++) { const q = back ? j - k : j + k; if (q < 0 || q >= n2 || mn[q] <= SYNC_ON) { okRun = false; break; } }
        if (okRun) return t0 + j * step;
      }
      return null;
    };
    const inS = edge(false), outS = edge(true);
    const lag0 = inS == null ? null : +(inS - a0).toFixed(2);
    const lagEnd = outS == null ? null : +(outS - a1).toFixed(2);
    /* Keeping up at the start and falling behind by the end is the thing
       shadowers actually feel and no transcript can show. */
    const drift = lag0 != null && lagEnd != null ? +(lagEnd - lag0).toFixed(2) : null;
    /* Correlating the raw envelopes aliases: words come at a steady rate, so a
       shift of one whole word scores as well as no shift at all, and the
       search happily reports a lag that is really a word out. Smoothing both
       sides to about a quarter of a second throws the word-rate ripple away
       and leaves the PHRASE shape — where the speaker breathes — which repeats
       far too slowly to alias inside the search window. A paragraph said
       straight through has no such shape, and then there is simply no shape
       score to give. */
    const win = Math.round(SYNC_SMOOTH / step);
    const tgS = smooth(tg, win), mnS = smooth(mn, win);
    const shaped = variance(tgS) >= 0.01;
    /* the search is kept near the lag the edges already found, so it refines
       that answer rather than wandering off onto a neighbouring word */
    const centre = lag0 == null ? 0.2 : Math.max(SYNC_MIN_LAG, Math.min(SYNC_MAX_LAG, lag0));
    let best = null;
    if (shaped) {
      best = { r: -2, lag: centre };
      for (let L = Math.round((centre - 0.3) / step); L <= Math.round((centre + 0.3) / step); L++) {
        const xs = [], ys = [];
        for (let i = 0; i < n; i++) {
          const j = Math.round(i + (a0 - t0) / step) + L;
          if (j < 0 || j >= mnS.length) continue;
          xs.push(tgS[i]); ys.push(mnS[j]);
        }
        if (xs.length < 12) continue;
        const r2 = pearson(xs, ys);
        if (r2 != null && r2 > best.r) best = { r: r2, lag: +(L * step).toFixed(2) };
      }
      if (best.r < -1) best = null;
    }
    /* the edges give the lag; the correlation, when there is a shape to
       correlate, gives how closely the rise and fall were followed */
    const lag = lag0 != null ? lag0 : (best ? best.lag : null);
    const r = best ? best.r : null;
    /* A microphone hearing the VIDEO rather than the learner starts exactly
       when the speaker starts, stops exactly when they stop and never misses a
       word — which no human does, because nobody predicts speech. We say so
       rather than award a top score for it. */
    const bleed = lag != null && Math.abs(lag) <= 0.06 && (drift == null || Math.abs(drift) <= 0.08) && (r == null || r >= 0.7);
    /* Coverage is measured on samples, not on word windows: with words a third
       of a second apart, a window wide enough to be fair to one word reaches
       into its neighbours and every word comes back "said". The question is
       simply how much of the time the speaker was speaking the learner was
       speaking too, with the lag taken out. */
    const shift = Math.round((lag || 0) / step);
    let on = 0, both = 0;
    const wordHit = words.map(() => 0), wordN = words.map(() => 0);
    words.forEach((w, wi) => {
      const i0 = Math.max(0, Math.floor((w.startMs / 1000 - a0) / step)), i1 = Math.min(n - 1, Math.ceil((w.endMs / 1000 - a0) / step));
      for (let i = i0; i <= i1; i++) {
        const j = Math.round(i + (a0 - t0) / step) + shift;
        wordN[wi]++;
        if (j >= 0 && j < mn.length && mn[j] > SYNC_ON) wordHit[wi]++;
      }
    });
    for (let i = 0; i < n; i++) {
      if (!tg[i]) continue;
      on++;
      const j = Math.round(i + (a0 - t0) / step) + shift;
      if (j >= 0 && j < mn.length && mn[j] > SYNC_ON) both++;
    }
    const hits = wordHit.filter((h, i) => wordN[i] && h / wordN[i] >= 0.5).length;
    const cover = on ? both / on : 0;
    const issues = [];
    if (bleed) issues.push({ type: "bleed", dim: "sync", k: "sv.ch_sync_bleed" });
    else {
      if (drift != null && drift >= SYNC_DRIFT) issues.push({ type: "drift", dim: "sync", k: "sv.ch_sync_drift", v: { s: drift.toFixed(1) } });
      else if (lag != null && lag > 0.7) issues.push({ type: "behind", dim: "sync", k: "sv.ch_sync_behind", v: { s: lag.toFixed(1) } });
      else if (lag != null && lag < -0.15) issues.push({ type: "ahead", dim: "sync", k: "sv.ch_sync_ahead" });
      if (cover < 0.72) issues.push({ type: "dropped", dim: "sync", k: "sv.ch_sync_dropped", v: { n: words.length - hits } });
      if (r != null && r < 0.35) issues.push({ type: "flat", dim: "sync", k: "sv.ch_sync_flat" });
    }
    /* With no lag to judge, coverage alone decides — and it cannot earn the
       top state, because staying with the speaker is what the top state means. */
    /* A take that says every word in step still only covers about 0.85 of the
       speaker's voiced time: words here are a quarter of a second long with
       gaps barely shorter, so half a sample of lag error costs both edges.
       The bands are set against that ceiling, not against a theoretical 1.0. */
    const late = lag == null ? false : lag > 0.45, drifting = drift != null && drift >= SYNC_DRIFT;
    const state = bleed ? "na"
      : (cover >= 0.78 && (r == null || r >= 0.6) && !late && !drifting) ? (lag == null ? "good" : "strong")
        : (cover >= 0.62 && (r == null || r >= 0.4) && (lag == null || lag <= 0.8) && !drifting) ? "good"
          : (cover >= 0.45) ? "practice" : "attention";
    return { state, reason: bleed ? "bleed" : null, lag, r, hits, total: words.length,
      cover: +cover.toFixed(2), voiced: +voiced.toFixed(2), bleed, drift, shaped, issues,
      pass: state === "strong" || state === "good" };
  }

  /* ---- backward build-up ----
     The classic fix for a line that falls apart at the end: say the last few
     words, then a few more in front of them, until the whole thing is one
     breath. Growing from the END is the point — the tail is the part that is
     dropped, and each step ends on words the mouth has already made. */
  function buildup(text, steps) {
    const ws = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (ws.length < 6) return ws.length ? [ws.join(" ")] : [];
    const n = Math.max(2, Math.min(steps || 4, Math.floor(ws.length / 3)));
    const out = [];
    for (let i = 1; i <= n; i++) {
      const take = i === n ? ws.length : Math.max(3, Math.round(ws.length * i / n));
      const chunk = ws.slice(ws.length - take).join(" ");
      if (!out.includes(chunk)) out.push(chunk);
    }
    return out;
  }

  /* ---- chorus ----
     Kjellin's repetition drill: the same short piece, many times, at a speed
     you can actually hit. A single word is too small to carry rhythm, so the
     chunk is the word plus its neighbours — and it comes back with the clip
     span, so the repetitions play the speaker, not a synthetic voice. */
  const CHORUS_REPS = 6;
  function chunkAround(tokensOut, tSpan, width) {
    const toks = tokensOut || [];
    if (!toks.length || !tSpan) return null;
    const w = width || 2;
    const i0 = Math.max(0, tSpan[0] - w), i1 = Math.min(toks.length - 1, tSpan[1] + w);
    const slice = toks.slice(i0, i1 + 1);
    const ms = slice.filter(x => x.ms), est = slice.some(x => x.est);
    /* challenge()'s tokens carry `text`, not the `disp` that uniqDisp reads,
       and two tokens can share one source word ("I'm"), so the chunk is built
       here from one entry per source word */
    const seen = new Set();
    const text = slice.filter(x => !seen.has(x.wi) && seen.add(x.wi)).map(x => x.text).join(" ");
    return { text, tSpan: [i0, i1],
      ms: ms.length ? [ms[0].ms[0], ms[ms.length - 1].ms[1]] : null, est,
      reps: CHORUS_REPS };
  }

  /* ---- retell: did they say what it MEANT? ----
     The verdict is the AI's; this is the guard in front of it. A retell that
     is really the line said again is the commonest way the exercise is dodged,
     and it is cheap to spot locally: a long run of the original's own content
     words, in order. `overlap` is the opposite check — a retell that shares
     almost nothing with the line is about something else. */
  function retellCheck(heard, text) {
    const h = norm(String(heard || "").split(/\s+/)).filter(x => x.k).map(x => x.k);
    const t = norm(String(text || "").split(/\s+/)).filter(x => x.k).map(x => x.k);
    const key = t.filter(k => !isFunction(k) && k.length >= 3), seen = new Set();
    const uniq = key.filter(k => !seen.has(k) && seen.add(k));
    if (!h.length) return { words: 0, echo: false, overlap: 0, run: 0 };
    let run = 0, best = 0;                       // longest stretch copied verbatim
    for (let i = 0; i < h.length; i++) {
      const j = t.indexOf(h[i]);
      if (j >= 0 && i > 0 && t[j - 1] === h[i - 1]) { run++; best = Math.max(best, run + 1); } else run = 0;
    }
    const hit = uniq.filter(k => h.includes(k)).length;
    const overlap = uniq.length ? hit / uniq.length : 0;
    return { words: h.length, run: best, overlap: +overlap.toFixed(2),
      echo: best >= 6 || (overlap >= 0.8 && h.length >= t.length * 0.7),
      /* a good retell reuses FEW of the original's words, so a low overlap is
         not a fault — only a retell too short to carry a thought is */
      thin: h.length < 5 };
  }

  const api = { normalizeCaptions, normalizeText, normalizePasted, estimateWords, locate, neighbour, levelOf, splitSentences, tokens, norm, fold, align, findExpression, usedExpression, challenge, verdict, progress, drillState, isFunction, FILLERS, PASS, WEAK, STRONG,
    RUNGS, SPEEDS, rungsFor, nextRung, gapItems, syncReport, buildup, chunkAround, retellCheck, SYNC_STEP, CHORUS_REPS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.ShadowSync = api;
})(typeof window !== "undefined" ? window : globalThis);
