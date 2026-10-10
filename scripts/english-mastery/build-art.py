"""English Mastery's 3D game art (10 Oct 2026): tracks/general/mastery-art3d.json.

Five of Welding Mastery's illustrations are generic and are reused as they are
(cards, quiz, listen, daily, advanced); the crossword grid serves Word Puzzle.
Four are drawn here for the games only this hub has. Same style: 120x120,
gradient bodies, a white highlight, a soft shadow ellipse, ids prefixed by the
key so two drawings never share a gradient id. Lomonec LLC original work.

Run from the repo root: python3 scripts/english-mastery/build-art.py
"""
import json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
W = json.load(open(os.path.join(ROOT, "tracks/welding/mastery-art3d.json")))

def lg(i, a, b, x2="0", y2="1"):
    return f'<linearGradient id="{i}" x1="0" y1="0" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'
def shadow(k): return f'<radialGradient id="{k}-sh" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'

# Sentence Builder: three word tiles stepping into a line, an arrow placing the last one
sentence = ('<svg viewBox="0 0 120 120"><defs>' + lg("sentence-a", "#5eead4", "#0d9488") + lg("sentence-b", "#a5b4fc", "#4f46e5") + lg("sentence-c", "#fda4af", "#e11d48") + lg("sentence-ar", "#fde68a", "#f59e0b", "1", "0") + shadow("sentence") + '</defs>'
  '<ellipse cx="60" cy="104" rx="44" ry="7" fill="url(#sentence-sh)"/>'
  '<rect x="10" y="62" width="30" height="26" rx="7" fill="#134e4a" transform="translate(2 3)"/><rect x="10" y="62" width="30" height="26" rx="7" fill="url(#sentence-a)"/><path d="M15 67h16" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/><path d="M18 79h14" stroke="#042f2e" stroke-width="4" stroke-linecap="round"/>'
  '<rect x="45" y="62" width="30" height="26" rx="7" fill="#312e81" transform="translate(2 3)"/><rect x="45" y="62" width="30" height="26" rx="7" fill="url(#sentence-b)"/><path d="M50 67h16" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/><path d="M52 79h16" stroke="#1e1b4b" stroke-width="4" stroke-linecap="round"/>'
  '<g transform="rotate(-12 95 40)"><rect x="80" y="26" width="30" height="26" rx="7" fill="#881337" transform="translate(2 3)"/><rect x="80" y="26" width="30" height="26" rx="7" fill="url(#sentence-c)"/><path d="M85 31h16" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/><path d="M87 43h12" stroke="#4c0519" stroke-width="4" stroke-linecap="round"/></g>'
  '<path d="M92 56c0 6-2 9-6 11" fill="none" stroke="url(#sentence-ar)" stroke-width="5" stroke-linecap="round"/><path d="m80 63 7 5 1-8" fill="none" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
  '<rect x="80" y="62" width="30" height="26" rx="7" fill="none" stroke="#fde68a" stroke-width="2.5" stroke-dasharray="5 4"/></svg>')

# Speak Up: a studio microphone with sound waves
speak = ('<svg viewBox="0 0 120 120"><defs>' + lg("speak-hd", "#99f6e4", "#0f766e", "1", "1") + lg("speak-bd", "#475569", "#0f172a", "1", "0") + lg("speak-wv", "#fda4af", "#e11d48") + shadow("speak") + '</defs>'
  '<ellipse cx="60" cy="106" rx="30" ry="6" fill="url(#speak-sh)"/>'
  '<path d="M36 52a24 24 0 0 0 48 0" fill="none" stroke="#1e293b" stroke-width="7" stroke-linecap="round" transform="translate(1 2)"/><path d="M36 52a24 24 0 0 0 48 0" fill="none" stroke="url(#speak-bd)" stroke-width="7" stroke-linecap="round"/>'
  '<rect x="56" y="76" width="8" height="18" rx="3" fill="url(#speak-bd)"/><rect x="42" y="92" width="36" height="9" rx="4.5" fill="url(#speak-bd)"/>'
  '<rect x="44" y="14" width="32" height="54" rx="16" fill="#134e4a" transform="translate(2 3)"/><rect x="44" y="14" width="32" height="54" rx="16" fill="url(#speak-hd)"/>'
  '<path d="M48 30h24M48 38h24M48 46h24" stroke="#0f766e" stroke-opacity=".55" stroke-width="2.5" stroke-linecap="round"/><path d="M51 22a10 10 0 0 1 8-5" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>'
  '<path d="M90 30c5 6 5 18 0 24M98 24c8 10 8 26 0 36" fill="none" stroke="url(#speak-wv)" stroke-width="4" stroke-linecap="round"/>'
  '<path d="M30 30c-5 6-5 18 0 24M22 24c-8 10-8 26 0 36" fill="none" stroke="url(#speak-wv)" stroke-width="4" stroke-linecap="round"/></svg>')

# Phrase Match: two linked pieces, "Aa" meeting a meaning card
match = ('<svg viewBox="0 0 120 120"><defs>' + lg("match-l", "#a5b4fc", "#4338ca", "1", "1") + lg("match-r", "#5eead4", "#0f766e", "1", "1") + lg("match-k", "#fde68a", "#f59e0b") + shadow("match") + '</defs>'
  '<ellipse cx="60" cy="104" rx="44" ry="7" fill="url(#match-sh)"/>'
  '<path d="M10 36h34v12a7 7 0 1 1 0 14v14H10Z" fill="#1e1b4b" transform="translate(2 3)"/><path d="M10 36h34v12a7 7 0 1 1 0 14v14H10Z" fill="url(#match-l)"/>'
  '<text x="27" y="64" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="18" fill="#fff">Aa</text><path d="M15 41h20" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>'
  '<path d="M58 36h48v40H58V62a7 7 0 1 0 0-14Z" fill="#042f2e" transform="translate(2 3)"/><path d="M58 36h48v40H58V62a7 7 0 1 0 0-14Z" fill="url(#match-r)"/>'
  '<path d="M68 48h28M68 56h22M68 64h26" stroke="#ecfeff" stroke-width="3.5" stroke-linecap="round"/>'
  '<circle cx="51" cy="24" r="9" fill="url(#match-k)"/><path d="m46 24 3.5 3.5L56 21" fill="none" stroke="#78350f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>')

# Real-Life Missions: two people's speech bubbles, a question and an answer
missions = ('<svg viewBox="0 0 120 120"><defs>' + lg("missions-q", "#fda4af", "#e11d48", "1", "1") + lg("missions-a", "#5eead4", "#0d9488", "1", "1") + lg("missions-st", "#fde68a", "#f59e0b") + shadow("missions") + '</defs>'
  '<ellipse cx="60" cy="106" rx="42" ry="7" fill="url(#missions-sh)"/>'
  '<path d="M14 18h50a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H34l-12 10V58h-8A10 10 0 0 1 4 48V28a10 10 0 0 1 10-10Z" fill="#4c0519" transform="translate(2 3)"/>'
  '<path d="M14 18h50a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H34l-12 10V58h-8A10 10 0 0 1 4 48V28a10 10 0 0 1 10-10Z" fill="url(#missions-q)"/>'
  '<text x="39" y="47" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="24" fill="#fff">?</text><path d="M12 25h22" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>'
  '<path d="M56 50h50a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10h-6v10L88 88H56a10 10 0 0 1-10-10V60a10 10 0 0 1 10-10Z" fill="#042f2e" transform="translate(2 3)"/>'
  '<path d="M56 50h50a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10h-6v10L88 88H56a10 10 0 0 1-10-10V60a10 10 0 0 1 10-10Z" fill="url(#missions-a)"/>'
  '<path d="M58 63h40M58 72h30" stroke="#ecfeff" stroke-width="4" stroke-linecap="round"/>'
  '<path d="m102 14 2.6 5.4 6 .9-4.3 4.2 1 5.9-5.3-2.8-5.3 2.8 1-5.9-4.3-4.2 6-.9Z" fill="url(#missions-st)"/></svg>')

out = {"cards": W["cards"], "quiz": W["quiz"], "sentence": sentence, "listen": W["listen"], "speak": speak, "match": match, "puzzle": W["crossword"], "missions": missions, "daily": W["daily"], "advanced": W["advanced"]}
for k, v in out.items():
    assert v.startswith("<svg") and "<script" not in v and "href" not in v, k
json.dump(out, open(os.path.join(ROOT, "tracks/general/mastery-art3d.json"), "w"), separators=(",", ":"))

logo = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="English Mastery"><defs><linearGradient id="emLg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#0ea5a4"/></linearGradient><linearGradient id="emLg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb199"/><stop offset="1" stop-color="#f45d48"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="15" fill="#0d1030" stroke="url(#emLg1)" stroke-width="2.5"/><path d="M12 14h22a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H22l-6 5v-5h-4a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5Z" fill="url(#emLg1)"/><path d="M17 21h14M17 26h9" stroke="#0d1030" stroke-width="2.2" stroke-linecap="round"/><path d="M36 24h13a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-2v4l-5-4h-6a5 5 0 0 1-5-5v-1" fill="url(#emLg2)"/><path d="M11 44c6-2.2 12.5-2.2 19 1 6.5-3.2 13-3.2 19-1v10c-6-2.2-12.5-2.2-19 1-6.5-3.2-13-3.2-19-1Z" fill="#eef2ff" stroke="url(#emLg1)" stroke-width="1.6"/><path d="M30 45v10" stroke="#6366f1" stroke-width="1.4"/><g stroke="#ffd36b" stroke-width="1.6" stroke-linecap="round"><path d="M52 9v4M50 11h4M57 17l2-1"/></g></svg>
"""
open(os.path.join(ROOT, "english-mastery-logo.svg"), "w").write(logo)
print("art", len(json.dumps(out)), "bytes · logo written")
