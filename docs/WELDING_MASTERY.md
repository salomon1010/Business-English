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

## Server: energy, XP, the daily challenge, the Premium pack (be12-v669)

The game is **server-authoritative** for what can be counted or spent. Route: the be-polish
Worker, body `{wm:{op,…}}`, handled by `backend/wm-game.js` (tests: `backend/test-wm-game.mjs`,
43; live staging check outside the repo, `~/Developer/be-wm-live/live.mjs`, 11, two throwaway
accounts deleted afterwards).

- **Who may play:** a signed-in account (`capabilities()` — be-entitlements verifies the Firebase
  token; no `ENTITLEMENTS_URL` → 503 `wm_unavailable`, never "allowed") whose programme is Welding
  (partner Worker `GET /programme`, read from the account's own Firestore record; anything else →
  403 `track`). A client-sent track is never trusted.
- **Energy:** Free = `WM_FREE_ENERGY` (5) challenge rounds per UTC day, Premium = no cap. One unit
  per round, charged at `start` and nowhere else: a wrong answer, a network failure or a repeated
  request (same `sid`) costs nothing. Cards (review) and the daily challenge are free. Spent →
  429 `{error:"energy"}`; browsing, the Collection, History and Cards stay open.
- **XP:** `finish` pays `2 × correct + 10` per round (+30 once for the daily), against an HMAC
  ticket from `start` (`WM_SECRET`, else derived from `OPENAI_KEY`; 2 days), capped at
  `WM_XP_DAY_CAP` 600 a day and `WM_XP_MODE_DAY_CAP` 120 per mode. A second `finish` pays 0. The
  hub shows the server's total (`st().sx`); `sxd` keeps the per-day awards for the chart.
  Unsent finishes wait in `st().pend` and are flushed on the next status.
- **Atomic:** every count is a bucket in the existing `RateLimiter` Durable Object (`consume` is
  all-or-nothing; the new `peek` reads without writing). Buckets: `wmen:<day>`, `wmxpd:<day>`,
  `wmxpm:<day>:<mode>`, `wmxp`, `wmdaily:<day>`, `wms:<sid>`, `wmf:<sid>`.
- **Offline:** challenges and the daily need the server; Cards play offline and earn no XP.
- **Premium (no new product, price or SKU):** the plan comes from be-entitlements. Premium =
  unlimited energy, the 30/90-day trends on Game Performance (`advanced_progress`, the app's one
  gate — a dimmed preview + `premLockHTML` when locked), the **Advanced workshop** (scenarios in
  Workers KV `WM_PACK`, key `advanced-v1`, served by `op:"pack"` to Premium only — the content file
  is kept OUTSIDE the repo because the repository and `backend/` are public), and the **AI coach**
  on workshop answers (the existing `chat` route, `purpose:"coach"`, metered by the existing
  verdict allowance — 429 says so).
- **Daily layer (device-side display over server facts):** one daily challenge (8 words from 8
  categories, seeded by the UTC day), the weekly goal (5 practice days, Monday-based), skill badges
  (Bronze/Silver/Gold by answers and accuracy, `BADGE_TIERS`, stored in `st().bdg`), and a "next
  goal" line. Mastery and badges are computed on the device from the learner's own answers.
- **Art:** `tracks/welding/mastery-art3d.json` — ten 3D-style illustrations for the game cards,
  sanitised when loaded; the line icon is the fallback.

## What it does NOT have (deliberately, or not yet)

- **Mastery, badges and the weekly goal are device-side.** Only energy and XP are counted on the
  server. The trends lock is a display gate over the learner's own local data.
- **Production cannot use it yet:** be-entitlements has no production Worker, so production
  be-polish answers 503 `wm_unavailable`, and the flag is OFF there. The live Premium path has not
  been tested end to end (a staging promo grant needs the owner-held `ADMIN_TOKEN`).
- **No analytics events.** be-events has none on its allow-list; a dropped call would be a lie.
- **Listening uses synthetic speech** (`fbSay`: the natural Worker voice, else the browser's). The
  round says so, and refuses to run where no voice exists.
- The help centre (`manual/*.html`) does not describe the hub yet.
