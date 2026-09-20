# Four-round review — the human conversation as the lesson

**Status (2026-09-20): built on `feature/round-review`, tested locally, NOT merged, NOT deployed.**
General English only. Nothing in it reaches the Welding track: the client gate is
`ppAvailable()` (API + flag + `isGeneralEnglish()`), the Worker gate is `TRACKS`
on the pair, and the Worker suite proves a non-member / other-track caller is
refused.

## What it does
A Practice Partner session is four alternating voice turns about the day's
curriculum topic (e.g. Week 1 · Tue — *"Tell me about yourself"*). When all
four are in, each learner's app asks the Worker for **its own** review:
`POST /pairs/:id/review {context, learned}`.

- `context` is the day's curriculum as the app reads it (`ppRevContext`):
  week, day, topic (`days[d].focus`), objective (`weeks[n].goal`), task
  (`days[d].task` — its "A → B → C → D" text names the expected components),
  the expected output and the week's phrase bank. The Worker never owns
  the curriculum; it judges against what it is sent.
- `learned` is up to 20 expressions the learner saved from earlier reviews,
  so the review can say "you used *I'm responsible for* correctly".
- The Worker gathers the caller's turns (transcripts + the per-word
  pronunciation evidence the app sent with each turn, migration 0009
  `turns.words`), the partner's turns **as the questions that were
  answered only**, the caller's previous plan, and calls the model
  (`OPENAI_KEY`, `gpt-4o-mini`, JSON mode) — or `reviewStub()` under
  `REVIEW_STUB="1"` (dev/tests).
- `reviewShape()` clamps every field before storage. One row per
  (pair, uid); every read is `WHERE uid = caller`. There is no route that
  serves another learner's review.

## The report (client `ppRevHTML`, in this order)
This conversation was about: *topic* · session n · evidence line →
1 What you did well (evidence-cited) → 2 What you should improve (recurring
patterns with counts) → 3 Topic mastery (the task's components, each
Strong / Developing / Needs practice / Missing, plus a verdict) →
4 Pronunciation (You said / Target / Why / Hear / Say it, graded; "Heard in
your recording" only under audio evidence, otherwise "Worth checking") →
5 Sentence structure and grammar (You said → Better → Why → Try, kinds
`Grammar / Sounds clumsy / More natural / Nice self-correction / Normal
hesitation`; only Grammar is ever "wrong") → 6 Natural English (more natural
/ more professional) → 7 Vocabulary to master (used well · misused · Must
know · Useful upgrade with the real count · Next level · Sentence patterns;
every item: Hear · Say it · Save) → 8 Voice coach (script spoken sentence by
sentence in the natural voice, device voice fallback; then Listen → repeat →
graded) → Your answer, rebuilt (original / polished / what changed; Hear;
record your version, graded) → Progress (five indicator tiles with delta vs
last session; line chart R1 → R3 → Session; biggest improvement / still
developing / next priority; last plan judged; reused expressions) → Your next
practice (pronounce / memorise / master the pattern / rehearse / apply next
time; Practise with AI · Practise with a human).

## Honesty rules (enforced in prompt + shaper + UI)
- Evidence level is shown on the report: **audio** (an audio-in model scored
  the words), **asr** (a recogniser only recognised them — the flat "95 on
  every word" case), **none**. Under asr/none, pronunciation items are
  "worth checking", never verdicts; the pron indicator is null under none.
- Indicators are BE Mastery learning indicators from observable signals;
  the report says so under the chart. Round values are evidence, the session
  value is the result; no per-turn "final scores".
- Rewrites keep the learner's facts (tested: the polished answer still
  contains the learner's own details).

## Vocabulary + games
`ppRevSave` → `vocPut` + `{meaning, pron, example, ctx, upg, src:{pp, pair,
session, topic, partner, problem}}`; the dictionary store is seeded so
expressions the dictionary lacks still get a flashcard / quiz clue.
**Conversation booster** (Practice tab › Vocabulary, `cvStart`, GE only):
hear & choose · fill the blank · which sounds more natural (from the
review's fixes) · say it (graded) · *use one of today's new expressions in
a sentence* (transcribed; passes when one is in it). Right answers feed
`vocMark` (the same spaced-repetition clock as the other games).

## Retrieval
`ppRevLearned()` is sent with the request; the review's `reused[]` says
"Great — you used X correctly" or nudges. The task card offers two learned
expressions as *Try to use* chips when it is the learner's turn.

## Data on the device / in the cloud
`S.ppRev` (top-level, tk-stamped, 60 per area, merged by id in `fbMerge`,
synced whole — it holds only the learner's own words). Practice attempts,
saves and coach plays live on the entry. `Clear my history` wipes the area's
reviews locally and the Worker deletes the caller's reviews of closed
sessions (`DELETE /history`); `DELETE /me` deletes them all.

## Tests that ran (2026-09-20, local)
- Worker `backend/partner/test/run.mjs`: 146/146 — completion gate,
  topic-anchored components, error vs unnatural classification, must/upgrade
  vocabulary with counts, polished answer keeps facts, asr evidence honesty,
  idempotency, non-member 403, two learners' reviews independent and
  non-quoting, own-only listing, history deletion.
- Browser `tests/partner.mjs` (real Chromium, fake mic, local Worker):
  151/153 — the two failures are Shadow Studio V2 checks that fail
  identically on `main`'s tree (no Shadow code changed here). New checks:
  review card after completion, curriculum context, the report's sections
  and order, five tiles + R1/R3/Session chart, client idempotency, both
  learners private, Welding refused (Worker + client), practice take graded
  86 → "Got it" then re-scored 61 → "once more" with best kept, voice coach
  play/stop/count, save with topic + problem metadata + dictionary seed,
  booster game readiness and rounds, spaced-repetition on a right answer,
  History tab, offline park-and-retry, no uncaught errors.
- `smoke.mjs` 27/27, `shadow-sync.test.mjs` 57/57, `boot-recovery` 7/7,
  `zoom` 7/7, `online-presence` 16/16.

## Not done / known limits
- The model path (`reviewAI`) has not been run against the provider from
  this machine — no key here. Everything above ran on `reviewStub`.
- The AI-coach session (client-only turns) has no review; only human
  sessions do.
- No shared "Conversation highlights" between partners (kept private by
  design; optional in the spec).
- French strings are translated; the other 14 languages carry English for
  the 140 new keys (parity kept, native review needed).
- Production needs: `wrangler secret put OPENAI_KEY` on `be-partner`
  (+ staging), migration 0009 applied remotely, the events Worker
  redeployed for the five new event names.
