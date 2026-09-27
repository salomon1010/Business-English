# Home: one primary recommendation and up to eight "Because you…" rows

*27 September 2026 · General English only · behind `home_v2_enabled` (on for staging, off in production)*

Home answers three questions in order: **what should I do next?**, **why are you
recommending it?**, and **let me start it now**.

1. **Hero.** The single next step, `NudgeEngine.rank()` over `nudgeSignals()`, the same
   ranking the push nudges use. The placement check and Foundations come first when
   they gate the programme.
2. **The rows.** Up to eight conditional rows. The first is drawn as the lead:
   larger cards and a gold "Your strongest signal" label.
3. **Explore**, then the rest of the page.

## The eight row types

Every row is conditional. With no evidence, the row is not drawn and nothing is
invented. A brand-new learner sees only the curriculum rows. An active learner can
see all eight.

| Row (`id`) | Evidence it needs (per area) | Variants | Cards |
|---|---|---|---|
| `watched` | A clip that **played** for 30 s or more in the last 30 days (`aList("watched")`, counted from the player's own clock while it reports PLAYING). Opening a clip is not watching it. | none | Related clips: same subject words, same category, same channel |
| `practiced` | The newest recorded Shadow take, Challenge attempt or session-day report, within 14 days | `shadow` · `challenge` · `challenge_try` · `session` | Take → that clip in the Challenge, then related clips. Challenge → next clips at that level, in the Challenge. Session → the next session, clips and a role-play on its theme |
| `feedback` | The newest assessment that named a need, within 14 days: Shadow report words to fix, Challenge issues, Polish or session report targets and fillers, weakest words from a partner or AI turn | `words` · `pron` · `fluency` · `expressions` | Remediation: the Challenge on the flagged clip, the trouble words, and clips on that skill |
| `struggled` | A Challenge clip missed twice and not passed since, within 14 days. Otherwise, trouble words on record | `challenge` · `words` | That clip again in the Challenge (it reopens one rung lower), shorter Challenge clips, and the trouble tab and words due |
| `saved` | Words in the vocabulary, or clips saved in Shadow | `words` · `clips` | The word review, the saved clip at its saved span, and the week's expressions |
| `learning` | The curriculum position: the week, whether the last week is finished, and whether the learner is new | `new` · `week` · `week_done` | The session day, the week's own clip (from the mission pack, 6 weeks have one), the week's expressions, and the week's role-play |
| `partner` | A partner session, a live call, an AI-coach session or a role-play conversation, within 14 days | `partner` · `live` · `ai` · `roleplay` | Find a partner and the AI coach. For a role-play: that scenario again, then the next one on the subject |
| `inactive` | Three or more days without practice, or practice but nothing spoken for five days | `days` · `speaking` | The session, a short clip, and a quick conversation |
| `level` | **Empty state only:** fewer than two evidence rows | none | Starter voices and short, clear clips. Never worded "because you" |

The new learner's `learning` row is headed "Start here: your Week 1 learning path",
not "because you".

## Ranking

The engine gives each row a score from the strength of its signal and sorts the rows,
strongest first. Inactivity scores highest. Then come fresh feedback, a failed
Challenge, a finished week, trouble words, and practice. Watching, partner practice
and saving score lower. Each row loses points as its evidence ages. A row that trains
the learner's weakest competency (`sig.weakest`, the same value `rank()` uses) gains 8.
The same state always gives the same rows in the same order.

## Content relationships

`nudge-engine.js` is the only engine. It gained `ROW_IDS`, `rows()`, a wider `related()`
and `scenarioFor()`.

- **Topics** (`TOPICS`). Each topic is a set of title words, a library category and the
  role-play scenarios that train it. The `fluency` and `story` topics are new, so the
  12 "Learn English with TOY STORY / COCO / LION KING …" clips are reachable.
- **`related()`** scores a candidate clip on shared topic words, the seed's category and
  the seed's channel. It never matches on nothing. Ties go to the clips nearest the
  seed in the library, so each clip gets its own neighbours. On the real catalogue,
  every one of the 301 clips yields related clips. 237 clips can appear as a
  recommendation, including 11 of the 12 story clips (it was 141 and 1).
- **The week's own clip.** The mission pack names one for Weeks 2, 3, 7, 8, 9 and 10.
  It is reserved for the `learning` row before other rows take clips.
- **The hero is never repeated.** `sig.heroCid` is the hero's content id, and no row
  offers it again.
- **No repeats.** A clip the learner already has is never offered as a new clip: its
  history, saved clips, watched clips and last open clip are all excluded. No clip
  appears twice across the rows.

## Exact deep links

Every card resolves through `nudgeGo`, the resolver the notifications use.

| Card type | Destination |
|---|---|
| `video` | Shadow Studio on that exact clip. A saved clip opens at its saved start and end |
| `challenge` | That exact clip, switched into Challenge mode once its lines load |
| `session` | `go("session", w, d)`: that exact day |
| `phrases` | `go("phrasebank", w)`: the phrase bank on that exact week |
| `roleplay` | `go("roleplay", id)`: that exact scenario |
| `words` | Practice, straight into the word review |
| `trouble` | Shadow's trouble-words tab, scrolled to the words |
| `partner` / `ai` | The Practice Partner page, or the AI coach session started directly |

## Analytics (be-events)

The events are `recommendation_impression` (one per row), `recommendation_open`,
`recommendation_started` (first practice action within 2 h of a tap),
`recommendation_completed` and `recommendation_dismissed`.

`recommendation_completed` fires when the offered thing is actually done, read from
the learner's state within 24 h. Examples: the session day is ticked, the Challenge
is passed, a take is recorded or 60 s of the clip is watched, the review is finished,
the scenario is completed, a phrase is mastered, or a partner or AI session is closed.

Props: `kind` (row type), `variant`, `reason`, `cid`, `to` (content type), `n`, `rank`,
`track`, `week` and `day`. The `cid` is a public content id: a library video id, a
session day such as `w3Tue`, a scenario id, `ph-w3`, `trouble`, `words-due`, `partner`
or `ai`. Events never carry a word, a title, or anything the learner said. Row layout:
blob3 kind, 4 variant, 5 reason, 6 cid, 7 to, 8 n, 9 rank, 10 track, 11 week, 12 day.
`MAX_BODY` rose from 512 to 640 bytes, because the every-key test body passed 512. A
real event is about 230 bytes. The older `rec_*` names stay allowed so old clients
still land. The app sends nothing outside General English, and the engine returns no
rows there.

## Not in the product

- **"What Is Shadowing?"** is not a clip in the catalogue (searched on 27 Sep 2026).
  The rows only ever quote clips that exist.
- **Cartoon content.** The only animated or film content is the "Learn English With
  TV Series" channel and the Super Mario / Disney lessons. It is reachable through
  the `story` topic and its channel.

## Tests

- `tests/nudge-engine.test.mjs`: 48 checks. Rows are R6 to R27: every row type, the
  ranking, exact links, verified watching, the hero exclusion, stale evidence, the
  offline first paint, and determinism.
- `tests/home-rows.mjs`: 29 checks in Chromium on an iPhone 13 profile and a desktop.
  Seven rows for an active learner and eight after five days away. One tap per card
  type lands on its exact destination. Also covered: all five analytics events,
  verified watching, the new learner, Welding, the flag off and the desktop grid.
