"""Assembles english-mastery.js (10 Oct 2026).

English Mastery shares the Welding Mastery hub's screens (render, Home,
Journey, Collection, History, Rewards, Performance, trends, sheets, the daily
layer, the server client, the round machinery). Rather than editing
welding-mastery.js — Welding must stay exactly as it is — this script takes
that middle section, applies the General English changes below (each one
asserted to match exactly once, so a change in the Welding file stops the
build instead of producing a silently different hub), and joins it with the
English Mastery parts written in this folder:

  ui-top.js     header, gate, wording (en + fr)
  [WI icons]    copied from welding-mastery.js, plus the icons this hub adds
  ui-data.js    icons map, logo, content loading, helpers
  [middle]      from welding-mastery.js, edited here
  ui-setup.js   what each game draws from, start(), the daily goal
  ui-hist.js    the History rows
  ui-card.js    the full card + the translation into the learner's language
  ui-bottom.js  the eight games, the coach, the click handler, Home hooks

Run from the repo root: python3 scripts/english-mastery/assemble.py
"""
import os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(ROOT, "welding-mastery.js"), encoding="utf8").read()
part = lambda f: open(os.path.join(HERE, f), encoding="utf8").read()

def between(s, a, b):
    i = s.index(a); j = s.index(b, i)
    return s[i:j]

# ---- the icon set, plus five this hub needs
wi_block = between(src, "  const WI = {", "  const MODE_IC")
extra = """,
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 12.5h18M10.5 12.5v2h3v-2"/>',
    quote: '<path d="M5 18c2.5-1 4-3 4-6V7H4v5h4M15 18c2.5-1 4-3 4-6V7h-5v5h4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5Z" fill="currentColor"/>'
  };
"""
wi_block = re.sub(r"\n  \};\s*$", extra, wi_block.rstrip() + "\n")

# ---- the shared middle: from the celebration code to the game drawer
mid = between(src, "  /* ------------------------------------------------------------ sound + celebration */", "  function draw() {")

edits = []
def rep(a, b, n=1):
    edits.append((a, b, n))

# the hub frame
rep('<div class="wm-top"><button class="back" data-wm="nav" data-a="practice">', '<div class="wm-top"><button class="back" data-wm="nav" data-a="practice">')
rep('<div class="wm-hero-t"><h1>WELDING <span>MASTERY</span></h1>', '<div class="wm-hero-t"><h1>ENGLISH <span>MASTERY</span></h1>')
rep('<nav class="wm-tabs" role="tablist" aria-label="Welding Mastery">', '<nav class="wm-tabs" role="tablist" aria-label="English Mastery">')
rep('function redraw() { const el = document.getElementById("v-mastery"); if (el && typeof cur !== "undefined" && cur && cur.v === "mastery") render(el); }',
    'function redraw() { const el = document.getElementById("v-english"); if (el && typeof cur !== "undefined" && cur && cur.v === "english") render(el); }')
rep('try { console.error("[wm]", e); }', 'try { console.error("[em]", e); }')
# resume: a mission round, or grammar items, are valid ids too
rep('if (r.mode !== "workshop" && r.ids.some(id => !byId(id))) return null;', 'if (r.mode !== "missions" && r.ids.some(id => !byId(id) && !gram(id))) return null;')
# Home: the welcome counts the real number; the learning loop sits after the overview
rep('<p>${h(w("first_b"))}</p>', '<p>${h(w("first_b", { total: TOTAL }))}</p>')
rep('      ${missionHTML(s)}\n      <h2 class="wm-h2">${h(w("cont_h"))}</h2>', '      ${missionHTML(s)}\n      ${loopHTML()}\n      <h2 class="wm-h2">${h(w("cont_h"))}</h2>')
rep('<button class="wm-wchip ${E.isMastered(s.t[t.id]) ? "m" : ""}" data-wm="word" data-a="${h(t.id)}">${h(name1(t))}</button>', '<button class="wm-wchip ${E.isMastered(s.t[t.id]) ? "m" : ""}" data-wm="word" data-a="${h(t.id)}" lang="en">${h(clean(name1(t)).slice(0, 40))}</button>')
# Games: this hub's charged set; the Premium card is advanced situations
rep('const cost = WM_CHARGED.has(md);', 'const cost = EM_CHARGED.has(md);')
rep('<span class="wm-gc-ic ${ART3D.advanced ? "a3" : ""}">${art3d("advanced", "workshop")}</span>', '<span class="wm-gc-ic ${ART3D.advanced ? "a3" : ""}">${art3d("advanced", "chat")}</span>')
# Collection: search the English and the meaning; no French direction toggle; the saved list stays on the Practice page
rep('if (q) list = list.filter(t => [t.en, t.fr].concat(t.syn || [], t.frSyn || []).some(x => E.normAns(x).includes(q)));', 'if (q) list = list.filter(t => [t.en, t.def && t.def.en].concat(t.syn || []).some(x => E.normAns(x).includes(q)));')
rep("""        <button class="wm-dir" data-wm="dir" aria-label="${h(w("dir"))}">${wi("swap")}<span>${h(w("dir"))}: <b>${h(first() === "fr" ? w("dir_fr") : w("dir_en"))}</b></span></button>
""", "")
rep('${_coll.seg === "mine" ? mineFormHTML() + savedListHTML() : ""}', '${_coll.seg === "mine" ? mineFormHTML() : ""}')
rep('<span class="wm-word-t"><b>${h(name1(t))}</b><small>${h(name2(t))}</small></span>', '<span class="wm-word-t"><b lang="en">${h(name1(t))}</b><small>${h(name2(t))}</small></span>')
# History rows: this hub's own (ui-hist.js)
mid_hist_a = "  function label(id) {"
mid_hist_b = "  function roundHTML(r) {\n"
# Rewards / next goal: this engine's skill → game map
rep('  const SKILL_MODE = { recognition: "quiz", recall: "cards", listening: "listen", context: "workshop", spelling: "builder", visual: "visual" };', '  const SKILL_MODE = E.SKILL_MODE;')
rep('lock = premLockHTML("advanced_progress", "wm_trends", { kept: false });', 'lock = premLockHTML("advanced_progress", "em_trends", { kept: false });')
# the Progress card and the portal carry the hub's class (its click scope and colours)
rep('return `<section class="card wm-perf-card" aria-labelledby="wmPerfH">', 'return `<section class="card wm-perf-card em em-perf-card" aria-labelledby="wmPerfH">')
rep('<p class="wm-mut">${h(w("p_empty"))}</p><button class="btn btn-p" data-wm="${inHub ? "play" : "open"}" data-a="cards">', '<p class="wm-mut">${h(w("p_empty"))}</p><button class="btn btn-p" data-wm="${inHub ? "play" : "open"}" data-a="cards">')
rep("""  function portalInto(el) {
    const s = st(); if (!s) return;""", """  function portalHTML() {
    const s = st(); if (!s) return "";""")
rep("""    el.innerHTML = `<button class="wm-portal" data-wm="nav" data-a="mastery" aria-label="${h(w("enter"))}">""", """    return `<button class="wm-portal em em-portal" data-wm="nav" data-a="english" aria-label="${h(w("enter"))}">""")
rep('<b class="wm-portal-title">WELDING <span>MASTERY</span></b>', '<b class="wm-portal-title">ENGLISH <span>MASTERY</span></b>')
# Settings: no "show French first" row
rep("""      ${row("first", w("set_dir"), set.first, ["en", w("dir_en")], ["fr", w("dir_fr")])}
""", "")
rep('const d = document.createElement("div"); d.id = "wmSheet"; d.className = "wm-sheet-bg";', 'const d = document.createElement("div"); d.id = "wmSheet"; d.className = "wm-sheet-bg em";')
rep("""    sheet(fullCardHTML(t, true));
  }""", """    sheet(fullCardHTML(t, true));
    const d = document.getElementById("wmSheet"); if (d) d.dataset.word = id;
  }""")
# the full card: this hub's own (ui-card.js)
card_a = "  function fullCardHTML(t, withActions, noHead) {"
card_b = "  /* ------------------------------------------------------------ the daily habit"
# the daily mission: every stage except First steps (sentences have no quiz question)
rep('const day = E.dayOf(Date.now()), seed = E.hash("wm-daily:" + day), out = [];', 'const day = E.dayOf(Date.now()), seed = E.hash("em-daily:" + day), out = [];')
rep('const cats = C.categories.map(c => c.id), byCat = {};', 'const cats = C.categories.filter(c => c.id !== "first").map(c => c.id), byCat = {};')
rep('official().forEach(t => (byCat[t.cat] = byCat[t.cat] || []).push(t.id));', 'official().filter(t => t.kind !== "sentence").forEach(t => (byCat[t.cat] = byCat[t.cat] || []).push(t.id));')
# the server: this hub's programme and games
rep('  const WM_CHARGED = new Set(["quiz", "crossword", "visual", "listen", "builder", "match", "workshop", "advanced"]);', '  const EM_CHARGED = new Set(["quiz", "sentence", "listen", "speak", "match", "puzzle", "missions", "advanced"]);')
rep('body: JSON.stringify({ wm: Object.assign({ op }, extra || {}) })', 'body: JSON.stringify({ wm: Object.assign({ op, prog: PROG }, extra || {}) })')
rep('<div class="wm-row"><button class="btn btn-g" data-wm="play" data-a="cards">${wi("cards")} ${h(w("en_cards"))}</button>', '<div class="wm-row"><button class="btn btn-g" data-wm="play" data-a="cards">${wi("cards")} ${h(w("en_cards"))}</button>')
rep('${offer ? `<button class="btn btn-p wm-wide wm-prem-btn" data-wm="premium" data-a="wm_energy">', '${offer ? `<button class="btn btn-p wm-wide wm-prem-btn" data-wm="premium" data-a="em_energy">')
# games setup: this hub's own (ui-setup.js)
games_a = "  /* ------------------------------------------------------------ games */"
games_b = "  function gameOpen(mode, inner) {"
# the round machinery: the overlay carries the hub's class; the title and the finish
rep('ov = document.createElement("div"); ov.id = "wmGame"; ov.className = "wm-game";', 'ov = document.createElement("div"); ov.id = "wmGame"; ov.className = "wm-game em";')
rep('const G = _G; if (!G || G.mode === "crossword" || G.mode === "match") return;', 'const G = _G; if (!G || G.mode === "match") return;')
rep("""    if (g.mastered) { const t = byId(id); G.mastered.push(id); celebrate("mastered", w("cel_mastered"), t ? t.en + (t.fr ? " · " + t.fr : "") : ""); }""", """    if (g.mastered) { const t = byId(id); G.mastered.push(id); celebrate("mastered", w("cel_mastered"), t ? clean(t.en) : ""); }""")
rep('    if (G.mode === "workshop") G.ids.forEach(id => { s.ws[id] = (s.ws[id] || 0) + 1; });', '    if (G.mode === "missions") G.ids.forEach(id => { s.ws[id] = (s.ws[id] || 0) + 1; });')
rep('const names = G.mastered.map(id => (byId(id) || { en: id }).en);', 'const names = G.mastered.map(id => clean((byId(id) || { en: id }).en));')
rep("""      ${G.mode === "workshop" ? `<button class="wm-link" data-wm="nav" data-a="simulation">${wi("workshop")} ${h(w("w_link"))} →</button>` : ""}""", """      ${endLinksHTML(G)}""")

for a, b, n in edits:
    c = mid.count(a)
    if c != n:
        sys.exit(f"edit matched {c}x (want {n}): {a[:90]!r}")
    mid = mid.replace(a, b)

def cut(s, a, b, new):
    i = s.index(a); j = s.index(b, i)
    return s[:i] + new + s[j + len(b) if b.endswith("\n") else j:]

mid = cut(mid, mid_hist_a, mid_hist_b, part("ui-hist.js"))
mid = cut(mid, card_a, card_b, part("ui-card.js"))
mid = cut(mid, games_a, games_b, part("ui-setup.js"))

# the hub's own attribute and element ids, so its clicks never reach Welding's handler and back
mid = mid.replace("data-wm=", "data-em=").replace('"wmGame"', '"emGame"').replace('"wmSheet"', '"emSheet"')
mid = re.sub(r'id="wm([A-Z])', r'id="em\1', mid)
mid = re.sub(r'getElementById\("wm([A-Z])', r'getElementById("em\1', mid)
mid = mid.replace('aria-labelledby="wmPerfH"', 'aria-labelledby="emPerfH"')

top = part("ui-top.js").replace("385 words, phrases and sentences", "{{total}} words, phrases and sentences").replace("385 mots, expressions et phrases", "{{total}} mots, expressions et phrases") \
  .replace('explore_s: "385 words and phrases, eight games"', 'explore_s: "{{total}} words and phrases, eight games"').replace('explore_s: "385 mots et expressions, huit jeux"', 'explore_s: "{{total}} mots et expressions, huit jeux"')
out = top + "\n  /* ------------------------------------------------------------ icons (the Welding hub's set, plus mic, briefcase, quote, globe, play) */\n" + wi_block + part("ui-data.js") + "\n" + mid + part("ui-bottom.js")
assert "data-wm" not in out, "a data-wm attribute survived"
open(os.path.join(ROOT, "english-mastery.js"), "w", encoding="utf8").write(out)
print("english-mastery.js", len(out.splitlines()), "lines")
