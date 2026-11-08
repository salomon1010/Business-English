# Weekly model-clip selection (8 Nov 2026)

Every General English learner practises the same skill each week. The app should choose the **clip**
from the onboarding profile. This is the selection, the data and the tests. **Nothing consumes it
yet**, and several things must change first (see "What blocks it").

## What exists

| File | What it is |
|---|---|
| `week-pick.js` | Pure module: `WeekPick.choose(profile, week, pool, {preview})`, `reuseWeek1(assignment, pool)`. No DOM, no network, no AI. |
| `catalogue/week-clips.json` | The owner's 11-link review queue. Every row `lessonReady:false`, editorial and rights `pending`. |
| `scripts/build_week_clips.mjs` | Rebuilds that registry from YouTube metadata (`--write`). |
| `tests/week-pick.test.mjs` | 50 checks, including every one of the 284 onboarding professions through Weeks 1-11 (56,232 profiles). |
| `scripts/ideas-growth/*`, `catalogue/drafts/ideas-growth-inputs/*` | The Shadow-library overlay generators and their committed inputs. Before this, the real generators lived only in a scratch directory and the committed one would have overwritten the overlay with 20 videos. |

## The ranking

Tiers, in the owner's order: 1 same profession, 2 same industry, 3 same situation or goal, 4 general.
**Level outranks tier**: a clip whose pace is more than 25 wpm past the learner's ceiling ranks below
every clip they can follow, whatever its tier. Ties go to the gentler pace, then the pace nearest a
comfortable one, then a clip with a transcript, then the id (arbitrary but stable).

- "Same industry" compares the catalogue **group**, never the `roleId` prefix. They differ:
  `eng.civil_eng` is in `trades`, `tech.product_manager` in `mgmt`, `energy.process_operator` in `agri`.
- `other.other` and the groups `career` / `home` (students, job seekers, retirees) are not industries.
  A learner who answers "Other" is an exact match for nothing.
- **Pace is measured**, in words per minute, only where there is a transcript. **English level** is the
  learner's own onboarding answer. **Vocabulary is not measured**: it needs a word-frequency list the
  repo does not have.

## What it returns, and what the lesson must do with it

`{ ranked[], picked, candidates[], wouldPick, held[], gap, degraded }`

- `ranked` is what the lesson can use **today**, best first. Empty means a gap: keep the existing lesson.
- `candidates` / `wouldPick` include blocked clips, each with its `blockers[]`. This is what an owner
  reviewing the queue wants. It is never a live pick.
- Every entry has a stable `key` (`id:start-end`) and a structured `why` for the lesson to translate.

**The caller must freeze the list.** The lesson's shadow records are keyed by the passage's *ordinal*
(`stepData.listen.sh[ix]`), so a list that comes back in a different order on a later call would
silently re-point every stored shadow at a clip it was never recorded against. Choose once, store the
ranked list, walk an index into it on a playback failure, and never re-run selection for an existing
attempt. The Week 1 assignment that Week 12 reuses must live **outside** the attempt: a restart mints a
fresh entry and would otherwise re-pick it.

## What blocks it

1. **Transcripts.** The shadow step takes its segment, its target text and its scoring from the clip's
   captions (`dlpShLive` -> `svShSeg` -> the caption paragraph). A clip with none lets the learner
   record in the studio while the lesson never notices a take, so the step cannot complete. None of
   the 49 Introductions clips and none of the 11 queue clips has a transcript in the app. Bundling
   captions needs a documented authorisation path; a visible caption track is not permission to export it.
2. **`DLP_WEEKS = 1`.** Weeks 2 and up do not run the guided lesson. Raising it was the owner's decision
   to make ("Week 1 complete and correct, not 12 weeks of guesses").
3. **Editorial and rights review** of every clip, and **exact start and end** for 7 of the 10 week-specific
   queue rows. Only a person who has watched a clip can approve a timestamp.
4. **Role-tagged clips for Weeks 2-11.** The only lesson-ready pool there is the existing clip index:
   generic English-lesson videos with no role. Until approved, role-tagged clips exist, a learner's
   profession changes nothing in those weeks; only pace and level can.

## Refreshing

```
node scripts/build_week_clips.mjs --write
I=catalogue/drafts/ideas-growth-inputs
node scripts/ideas-growth/build-overlay.mjs $I/harvest.json $I/intros.json $I/intro-roles.json $I/mmm.json
node tests/week-pick.test.mjs
```

## Week 1 Monday wiring (8 Nov 2026) — a PATCH, not yet in the lesson

The lesson code is in another session's uncommitted working tree, so the wiring is handed over as
`docs/patches/week1-baseline-wiring.patch` (`git apply --3way`). It touches `index.html` (14 hunks), `sw.js`
(two script entries), all 15 `i18n/*.json` (27 keys; fr/es/pt/ar translated) and adds
`tests/week1-baseline.mjs`. Flag `week1_model_clip_enabled`: OFF in production, absent from `FLAGS_IOS`, ON in
`FLAGS_STAGING`. `DLP_WEEKS` is unchanged (1).

What the lesson does: the learner records an uncoached introduction; **only then** is one model introduction
revealed (chosen by `WeekPick`, frozen into `stepData.try.model`, written once to `S.dlpAssign["general:w1"]`);
they shadow it (the model clip is Listen's passage 0, so the report, coach and word drills are the existing
ones; 6 shadows unlock the second take, up to 8 are asked for); then record again into `recCtx("dlp-try-after")`,
stored as `stepData.try.after`. Both takes replay separately. **Nothing in this block gates the lesson**: an
empty catalogue, captions that will not load and a player that errors each leave the recordings intact and
Continue open.

Hooks into existing code (everything else is a new block after `dlpTryHTML`): `dlpPassages` (frozen model leads),
the Listen row label, `dlpTypeFallback` (carries `model`/`after`/`baseAt` across), `dlpTryHTML`, `dlpTryRec`
(`baseAt`, freeze), `rGuidedLesson` (resume), `shVideoError` (player failure), `dlpShSync` (studio card: "back to
the lesson", never the Listen step's next button), `dlpMeasure`.

**A defect found on the way, fixed in the patch.** The Try step records under the session key (`w1Mon`), but
`dlpMeasure("try")` read the context `dlp-try`. They never matched, so the baseline measurement was never
produced and the day's closing before/after could not compare anything. No test covered the path. The patch
passes the real context through.

**THE PATCH IS INERT ON ITS OWN.** `dlpBaseOn` requires `window.Week1Model` and `window.WeekPick`, which come
from `week1-model.js` and `week-pick.js` (this branch). Apply the patch without them and, with the staging flag
on, the block simply never appears. That is safe, and it looks exactly like a bug. Apply the patch with both
files, `catalogue/week1-models.json` and the flag on a staging build.

**Do not read the rights status off this feature.** The clips in `tracks/general/clip-index.json` are treated as
"shipping" (what runs today), never as approved, and the audit in `docs/WEEK1_CLIP_APPROVAL.md` finds no caption
basis for any third-party clip, and two Week 1 passages that are the channel's own advertising. The fixture clips
used by the tests and the device demo are arbitrary library passages (one is that advertising); each is labelled
"TEST CLIP · not reviewed" on screen.

### Tests, kept apart
- **Fixture tests (pass):** `tests/week1-model.test.mjs` 41/41 (pure) and `tests/week1-baseline.mjs` 67/67 (the real
  lesson, Chromium, fake microphone). The clips are real library videos with their real captions given TEST role
  tags and `fixture:true`; the card says so on screen. **They prove the integration, not the content.**
- **Tests with approved content: none can run.** `catalogue/week1-models.json` is empty because nobody has
  approved a clip, and `catalogue/drafts/week1-model-approvals.json` is where a person records an approval.
