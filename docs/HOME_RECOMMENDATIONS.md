# Home — personalised "Because you…" rows

*27 September 2026 · General English only · behind `home_v2_enabled` (on for staging, off in production)*

Home answers one question: **"based on what you have been doing, what should you do next?"**
The hero is the engine's single best next step. Under it, up to three
"Because you…" rows name one thing the learner actually did and offer up to three
exact destinations for it. Then Explore.

## One engine, one learner state

There is no second recommendation system. `nudge-engine.js` (the pure engine the
push nudges use) gained three functions:

| Function | What it does |
|---|---|
| `TOPICS` / `topicsOf(text)` | The content-relationship table: a topic is a set of title words plus the library category it lives in. A lesson, a clip, a phrase group or a trouble word is placed on the topics its own words hit. `homeVisuals` (the hero's pictures) reads the same table. |
| `related(content, seed, opts)` | Clips sharing the seed's topics, best first, deterministic. `opts.challenge` keeps only captioned clips (the Challenge needs their lines); `opts.exclude` keeps clips the learner already has out; a long lecture ranks below a short clip. |
| `rows(signals, content)` | The rows. Reads only `signals.recent` and `signals.troubleWords`, produces nothing without evidence, at most three rows of three. |

`index.html` supplies the evidence in `nudgeSignals()` (the same function the
nudges and the hero use) and the content in `homeContent()` (the library index
`catalogue/general.json` + the curriculum weeks + the shadow starters). Every
card deep-links through `nudgeGo`, the resolver the notifications use, so a card,
a push notification and the Continue button can never disagree about where an
activity lives.

## The rows and their evidence

| Row id | Evidence (per area, never invented) | Cards |
|---|---|---|
| `challenge_done` | a Challenge passed in the last 14 days (`chHist`, kind `ch*`, `pass`) | 3 captioned clips on the same subject, each opened **in the Challenge** |
| `shadowed` | the newest recorded take (`chHist`, kind `shadow`) in the last 30 days | 3 clips on the same subject, opened in Shadow |
| `opened` | no take, but a clip left open (`S.lastClip`) — worded "opened", never "watched" | same |
| `trouble` | trouble words on record (`troubleMap()`) — the words are quoted | Shadow's Trouble words tab · the words due (Practice) · a pronunciation clip |
| `week_done` | the last whole week done (`weekDone(n)` = every day) and the plan is past it | the next session · a clip on the new week's theme · a partner (or the AI coach) |
| `phrases` | ≥ 3 expressions mastered in Phrase Lab (`phMaster`) | Phrase Lab · clips full of expressions |
| `partner_done` | a partner / live / AI session this week (`ppHist`) | a partner · the AI coach · a conversation clip |
| `start` | **no history at all** and Week 1 — the empty state | Week 1's session · a starter clip · introductions clips |

A clip the learner already has (history, saved clips, the clip left open) is never
offered again, and no clip appears twice across the rows. External (YouTube)
clips are marked "YouTube" on the card. There is no cartoon / animated content in
the repository (searched 27 Sep 2026): the rows draw on the 301 catalogue clips
and the curriculum only.

"Not now" hides a row for seven days (`S.recHide`).

## Analytics (be-events, allow-listed on this branch)

`rec_impression` (a row drawn: `kind` = row id, `reason`, `n` cards) →
`rec_open` (a card tapped: `to` = card type) → `rec_started` (first practice
action within 2 h) · `rec_dismissed`. Every event carries `track`, `week`, `day`.
Never a clip id, a word, a title or a phrase. The app sends nothing on a
non-General-English area, and the engine returns no rows there either.

## Tests

- `tests/nudge-engine.test.mjs` — R1–R16 (topics, related, every row rule, the empty state, area isolation).
- `tests/home-rows.mjs` — 25 checks in Chromium (iPhone 13 + desktop): truthful headings, cards, sideways scroll on the phone / grid on desktop, the deep links (Challenge clip, trouble tab, words due, session), analytics, Not now, the new learner, Welding, the flag off.
- `tests/home-v2.mjs` check 22 now expects the first row (else Explore) on the first screen.
