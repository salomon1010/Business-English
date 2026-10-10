  const MODE_IC = { cards: "cards", quiz: "quiz", sentence: "builder", listen: "headphones", speak: "mic", match: "link", puzzle: "crossword", missions: "chat", daily: "star", advanced: "crown" };
  const CAT_IC = { first: "spark", social: "chat", travel: "map", shopping: "gem", health: "heart", home: "home", wk1: "briefcase", wk3: "briefcase", wk5: "briefcase", wk7: "briefcase", wk9: "briefcase", wk11: "briefcase", idioms: "quote", mine: "myword" };
  function wi(name, cls) { return `<svg class="wm-ic ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${WI[name] || WI.spark}</svg>`; }
  /* the portal mark: two speech bubbles over an open book, a spark of confidence */
  function logo(cls) {
    return `<svg class="wm-logo ${cls || ""}" viewBox="0 0 64 64" role="img" aria-label="English Mastery"><defs><linearGradient id="emLg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#0ea5a4"/></linearGradient><linearGradient id="emLg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb199"/><stop offset="1" stop-color="#f45d48"/></linearGradient></defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#0d1030" stroke="url(#emLg1)" stroke-width="2.5"/>
      <path d="M12 14h22a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H22l-6 5v-5h-4a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5Z" fill="url(#emLg1)"/>
      <path d="M17 21h14M17 26h9" stroke="#0d1030" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M36 24h13a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-2v4l-5-4h-6a5 5 0 0 1-5-5v-1" fill="url(#emLg2)"/>
      <path d="M11 44c6-2.2 12.5-2.2 19 1 6.5-3.2 13-3.2 19-1v10c-6-2.2-12.5-2.2-19 1-6.5-3.2-13-3.2-19-1Z" fill="#eef2ff" stroke="url(#emLg1)" stroke-width="1.6"/>
      <path d="M30 45v10" stroke="#6366f1" stroke-width="1.4"/>
      <g stroke="#ffd36b" stroke-width="1.6" stroke-linecap="round"><path d="M52 9v4M50 11h4M57 17l2-1"/></g>
    </svg>`;
  }
  /* English Mastery has no pictures of things (its content is words, phrases and sentences) */
  function artSVG() { return ""; }
  /* a game's 3D illustration, decorative (the card's own text names the game) */
  function art3d(key, fallbackIcon) { return ART3D[key] ? `<span class="wm-art3d" aria-hidden="true">${ART3D[key]}</span>` : wi(fallbackIcon); }
  function catArt(cat) { return `<span class="wm-catart" aria-hidden="true">${wi(CAT_IC[cat] || "spark")}</span>`; }

  /* ------------------------------------------------------------ data */
  function loadCorpus() {
    if (C) return Promise.resolve(C);
    if (_load) return _load;
    _err = false;
    _load = Promise.all([fetch(CORPUS_URL).then(r => { if (!r.ok) throw new Error("corpus " + r.status); return r.json(); }), fetch(ART3D_URL).then(r => r.ok ? r.json() : {}).catch(() => ({}))])
      .then(([c, a3]) => {
        /* the 3D game artwork: our own SVG, but checked once more before it is placed in the page */
        ART3D = {}; Object.entries(a3 || {}).forEach(([k, v]) => { if (typeof v === "string" && /^<svg[\s>]/.test(v) && !/<(script|foreignObject|image|style)\b|\son[a-z]+\s*=|href\s*=/i.test(v)) ART3D[k] = v; });
        if (!c || !Array.isArray(c.terms) || !c.terms.length || !Array.isArray(c.missions)) throw new Error("corpus shape");
        C = c; TOTAL = C.terms.length;
        C.grammar = Array.isArray(C.grammar) ? C.grammar : [];
        _ids = new Set(C.terms.map(t => t.id));
        return C;
      })
      .catch(e => { _err = true; _load = null; throw e; });
    return _load;
  }
  let _ids = null;
  function official() { return C ? C.terms : []; }
  function gram(id) { return C && C.grammar.find(g => g.id === id) || null; }
  function byId(id) { if (!C) return null; const t = C.terms.find(x => x.id === id); if (t) return t; const m = st() && st().mine[id]; return m && !m.del ? E.mineAsTerm(m) : null; }
  function allTerms() { return official().concat(E.mineList(st()).map(E.mineAsTerm)); }
  function catName(id) { if (id === "mine") return w("c_mine"); if (id === "advanced") return w("g_advanced"); const c = C && C.categories.find(x => x.id === id); return c ? (lang() === "fr" && c.fr ? c.fr : c.en) : id; }
  /* the second line of a card in a list: its meaning, short */
  function name1(t) { return t.en; }
  function name2(t) { const d = t.def && t.def.en || ""; return d.length > 70 ? d.slice(0, 68) + "…" : d; }
  /* mastered = an official item (the corpus terms), never a grammar question or a mission */
  function masteredCount(s) { return Object.entries((s || st()).t).filter(([id, r]) => (_ids ? _ids.has(id) : /^em-(f|p|i|x)-|^em-[a-z]/.test(id) && !/^em-(g|m)-/.test(id)) && E.isMastered(r)).length; }
  function reduced() { try { return st().set.motion === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function canSpeak() { try { return ("speechSynthesis" in window) || (typeof POLISH_API !== "undefined" && !!POLISH_API && navigator.onLine); } catch (e) { return false; } }
  function say(text, rate) { try { if (window.fbSay) window.fbSay(clean(text), rate || 0.92); } catch (e) {} }
  /* the spoken / built form of a phrase: no "…", no X/Y placeholders */
  function clean(s) { return String(s || "").replace(/…/g, " ").replace(/\bX or Y\b/g, "this or that").replace(/\bX\b/g, "it").replace(/\s+/g, " ").trim(); }
  /* the sentence of an item: a Foundations sentence is itself; anything else, its example */
  function sentenceOf(t) { return t.kind === "sentence" ? t.en : (t.ex && t.ex.en) || ""; }
  /* hide the answer inside a clue: the term (its words before "…") and its synonyms */
  function blank(text, t) {
    let s = String(text || "");
    const forms = String(t.en).split("…").map(x => x.trim()).filter(x => x.length > 1).concat(t.syn || []).sort((a, b) => b.length - a.length);
    for (const f of forms) s = s.replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/'/g, "['’]"), "ig"), "_____");
    if (!/\s/.test(t.en) && t.en.length >= 4) s = s.replace(new RegExp("\\b" + t.en.slice(0, Math.max(4, t.en.length - 2)).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + "[a-z]*", "ig"), "_____");
    return s;
  }
