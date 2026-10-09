# Welding Mastery — the Welding vocabulary game hub

Welding Professional English only. Flag `welding_mastery_enabled`: **ON on staging, OFF in
production** (FLAGS_DEFAULT). Built 9 October 2026 on `feature/welding-mastery`.

## Where it sits

- **Vocabulary page (Practice › Vocabulary & Grammar › Vocabulary), Welding only.** The three
  boosters are headed **Quick Practice** (same `fcStart` / `qzStart` / `cwStart`, unchanged). The
  old "Welder vocabulary" list, the Study / Review / Mastered tabs, the empty state and the add
  field are replaced by ONE portal card (`WMUI.portalInto`, hook at the top of `rLibVocab`).
  All of that functionality lives on inside the hub, under Collection › My words.
- **The hub** is the view `mastery` (`#v-mastery`, `go("mastery", tab)`, Practice tab lit). Seven
  tabs: Home · Games · Journey · Collection · Rewards · History · Performance (short label
  "Stats" under 440 px). A gear opens sound / reduced motion / English- or French-first.
- **Progress page:** a Game Performance card after the certificate (`WMUI.perfCardHTML`).
- General English: none of it. `WMUI.on()` = flag AND `areaId()==="welding"`; every entry point,
  every renderer and every write checks it. The corpus is never even downloaded on General English.

## Files

| File | What it is |
|---|---|
| `welding-mastery-engine.js` | Pure rules (no DOM / storage / network): spaced repetition, mastery, XP, levels, streak, achievements, missions, journey, performance, recommendations, history, merge. |
| `welding-mastery.js` | The screens, the eight games, the portal, the Progress card. Its own en/fr dictionary (`TX`), French when the app language is French. |
| `welding-mastery.css` | The hub's room (navy, electric blue, amber XP, green mastery, purple collection/journey). |
| `tracks/welding/mastery.json` | The 250 terms (10 categories × 25) + 40 workshop scenarios. |
| `tracks/welding/mastery-art.json` | 52 original line drawings (tools, PPE, joints, defects), inner SVG markup only. |
| `tests/welding-mastery-engine.test.mjs` | Unit tests (engine + corpus). |
| `tests/welding-mastery.mjs` | Browser suite (every game, Collection, History, sync payload, Progress, isolation, flag off). |

## The corpus

250 unique terms. The 38 existing words are all in it: the 24 of `tracks/welding/vocabulary.json`
keep their definition word for word (`orig`) and their level; the 14 of the welder trade
(`trades.js`) got their first definitions. Neither source file was changed — the old list still
renders exactly as before when the flag is off. Each term: `en`, `fr`, `syn`, `frSyn`, `cat`,
`lvl`, `def/use/ctx/ex` × `en/fr`, `src`, optional `img`, optional `verify`.

**Eleven French renderings carry `verify`** (fillet weld gauge, fire watch, backing strip,
stick-out, leg length, weld map, witness point, welding code, method statement, readiness, site
manager): workshop usage varies and a francophone welding trainer should confirm them. The card
says so to the learner. Images are **original line drawings by Lomonec LLC, not photographs**
(the card says so); 52 of 250 terms have one, the rest show their category icon. The
`LOOKALIKE` groups keep drawings that read alike out of the same question.

## The rules (engine)

- **Mastery ≠ XP.** A word is mastered after correct answers on **3 different days**, the latest
  answer correct, and **at least one active recall** (spelling, typing what you heard, or a card
  rated Good/Easy). Multiple choice alone never masters a word. A wrong answer removes mastery
  (the date it was first mastered is kept) and leaves one good day, so two more are needed.
- **Spaced repetition:** SM-2, simplified. The schedule moves only when a word is due; a failure
  always counts (back in 10 minutes). Order: overdue → difficult (marked by the learner, lapses,
  low accuracy) → new, in corpus order → not due → mastered.
- **XP is idempotent:** every award has an event id and is paid once — 2 per correct answer per
  word per game per UTC day, 10 per round of ≥5 answers (5 paid rounds a day), 30 per daily
  mission, 25 per word mastered (+15 if it had been difficult), 100 per stage completed.
  Levels open at 0 · 100 · 300 · 600 · 1000 … (`50·L·(L−1)`).
- **Streak:** days with at least one graded answer (UTC, like the app's `streak()`); one missed day
  in seven is forgiven ("rest day").
- **Today's Shift:** one mission a day from the learner's real state (starter: five new words).
- **Performance:** a rate is shown only with ≥10 answers behind it; the recommendation names a
  weak skill only when two skills are rated and 15 points apart.

## Persistence and sync

Everything is in `S.wm.welding` (normalised by `WMEngine.normalize`), saved with `save()`, and on
a signed-in account it rides the existing Firestore sync: `fbMerge` → `WMEngine.merge` (per word
the copy with more answers; XP per day the larger copy, never the sum; achievements their earliest
date; history united by round id) and `fbSyncPayload` → `trimForSync` (drops the open round and
day aggregates older than 120 days). **History:** every round, finished or left part-way, with
each answer (what was asked, what was chosen or typed, right or wrong, hint). The newest 200
rounds keep their answers; up to 1000 keep their summary line.

## What it does NOT have (deliberately, or not yet)

- **No Worker, no server-side check.** There is no game API to protect: the corpus is a static
  curriculum file like every `tracks/<id>/*.json`, and the learner's record is in their own S /
  Firestore document under the existing rules. XP is decided on the device; a learner who edits
  their own localStorage can give themselves XP — it buys nothing (no leaderboard, no reward).
  If XP ever becomes competitive or spendable, it must move server-side first.
- **No energy / lives limit.** The icon set draws the energy icons, nothing uses them: the owner's
  rule is that Free is a complete product, and a limit would be a product decision.
- **No analytics events.** be-events has none on its allow-list; a dropped call would be a lie.
- **Listening uses synthetic speech** (`fbSay`: the natural Worker voice, else the browser's). The
  round says so, and refuses to run where no voice exists.
- The help centre (`manual/*.html`) does not describe the hub yet.
