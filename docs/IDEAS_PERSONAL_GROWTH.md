# Ideas & Personal Growth — Shadow library category (draft pipeline)

**Status: DRAFT ONLY. No video has been published. `ideas_personal_growth_enabled` is
`false` in `FLAGS_DEFAULT` (production) and `true` in `FLAGS_STAGING` (preview — but
the preview is empty, because `catalogue/general.json` carries no `ideas_growth`
category yet). Nothing in this feature has been merged, deployed, or submitted for
review by anyone but the owner.**

Branch: `feature/ideas-personal-growth` (isolated worktree, off local `main` at
`0ed85bd4`, created because the active checkout (`feature/ge-practice-redesign`) had
unrelated uncommitted work from another session that must not be touched).

## What this is

General English only. A new Shadow Studio library category for philosophy /
psychology / self-development content, seeded from a 200-video candidate pack
(`catalogue/drafts/ideas-personal-growth-seed.json`) across four creators (Robert
Greene, Einzelgänger, Pursuit of Wonder, Academy of Ideas), plus a 16-channel
candidate list (`catalogue/ideas-personal-growth-sources.json`) for a future second
discovery pass. This is optional practice content alongside the existing curriculum,
not a replacement for it, and reuses the existing Shadow Studio picker/player —
nothing about Shadow Studio itself was rebuilt or redesigned.

## Why a draft pipeline, not a direct catalogue edit

`catalogue/general.json` is the LIVE, published General English catalogue, built by
the maintainer-run `scripts/build_catalogue.mjs` from `catalogue/sources.json`
(channel + regex rules) via `yt-dlp` — there is no official YouTube Data API key
anywhere in this repository (checked: no `YOUTUBE_API_KEY`, no
`googleapis.com/youtube` reference outside caption transcript text that happens to
contain those words). Editing `general.json` directly would mean shipping 200
unreviewed videos straight to the live library. Instead:

- `catalogue/drafts/ideas-personal-growth-seed.json` — the 200-video seed pack, copied
  into the repo verbatim (version-controlled, not referenced from an external path).
- `catalogue/ideas-personal-growth-sources.json` — the channel-level registry for the
  20 channels. Only 4 (already seeded above) carry any video reference; the other 16
  are `candidate_new` with no video-level rows, because no reliable video ID could be
  obtained for them this session (see "Why the 16 new channels have no videos yet").
- `scripts/import_ideas_personal_growth.mjs` — the idempotent import/dry-run tool.
  Writes only to `catalogue/drafts/ideas-personal-growth-registry.json`; it never
  touches `catalogue/general.json` or `catalogue/welding.json`.
- A real, human editorial/rights review (owner-only — nothing here can substitute for
  someone actually watching these videos) is what moves an entry from this registry
  into a real `ideas_growth` category inside `catalogue/general.json`, through the
  SAME `build_catalogue.mjs`-style pipeline the other categories already use (survey →
  curate → build), once specific video IDs are approved. That step is **not done** and
  is outside what an agent should decide unilaterally.

## Why the 16 new channels have no videos yet

The owner asked for real, observed video data for the channels added later (Daily
Stoic, The School of Life, Freedom in Thought, Philosophies for Life, After Skool, Big
Think, The Well, Sprouts, Better Ideas, Nathaniel Drew, Matt D'Avella, Sisyphus 55,
Like Stories of Old, exurb1a, Improvement Pill, Better Than Yesterday) — live, not
fabricated, the same way the original 200 were apparently sourced (direct observation
of each channel's rendered video listing).

Two lookup paths were tried and both failed to produce trustworthy per-video data:

1. **WebSearch** returns real titles (often via third-party aggregator sites) but not
   reliably the matching `watch?v=` URL. A targeted search for one exact Daily Stoic
   title returned five or six *different*, similarly-named Daily Stoic videos, and the
   tool itself said it could not find the exact URL — accepting one of those as "close
   enough" would mean recording a wrong video ID against a title, which is a real
   integrity risk for a rights-sensitive catalogue.
2. **WebFetch** against a channel's `/videos` page returns only the static page
   footer — YouTube's video grid is rendered client-side by JavaScript, so there is
   nothing to extract.

**No official YouTube Data API key is configured anywhere in this project.** What
*is* available: `yt-dlp` (2026.08.19, confirmed on `PATH`) and this project's own
existing maintainer-run tooling (`scripts/build_catalogue.mjs`, which already builds
the live General English catalogue the same way). That tool was smoke-tested this
session against 3 of the already-known 200 seed videos (`--validate=3`, metadata only,
no captions fetched) and returned correct, matching durations and titles — so it
works and is a real option. It was **not** run against the 16 new channels, because
running it is a real batch of outbound requests to YouTube for channels nobody has
reviewed yet, and the owner's instruction was to prepare the discovery mechanism and
report the missing (official) API configuration, not to substitute an unofficial one
without a further decision. `node scripts/import_ideas_personal_growth.mjs
--env=development --validate=N` is the prepared, ready-to-run mechanism — one command
away, pending that decision.

## Data model

Each seed entry carries both content fields (title, channel, canonical `url`,
`display_duration`, proposed subtopic, an independently-written generic speaking
prompt) and review-state fields that must reach a real value before anything
publishes: `status`, `embedding_status`, `rights_review`, `editorial_review`,
`caption_rights`, `publication_ready`, `playback_tested_in_app`,
`full_content_viewed`, `cefr` (always `null` here — CEFR is not assigned from a title
alone). The import script's `mergeRecord()` never regresses a review field a human has
already advanced past its pending/default value — re-running the import after a
partial review is safe.

## Import results (dry run + write, this session)

Ran `node scripts/import_ideas_personal_growth.mjs --env=development [--write]`
against the 200-video seed, twice (to prove idempotency), plus a 3-video
`--validate` smoke test:

| Metric | Count |
|---|---:|
| Seed videos | 200 |
| Unique `video_id`s | 200 (0 internal duplicates) |
| Inserted (new drafts, run 1) | 200 |
| Unchanged (run 2, same input) | 200 |
| Reused (already published in `catalogue/general.json`) | 0 |
| Conflicted (owned by `catalogue/welding.json`, quarantined) | 0 |
| Rejected | 0 |
| Unavailable (of the 3 validated) | 0 |

None of the 200 seed videos currently exist in either live catalogue, so every one is
a genuinely new candidate record — there was nothing to deduplicate against yet. The
dedup/quarantine code paths are exercised and proven by
`tests/ideas-personal-growth-import.mjs` using a synthetic 3-video mini-seed (one
clean, one colliding with a fake "published" GE video, one colliding with a fake
Welding video), not by this real run, since this real run had no collisions to show.

### What `--validate=3` (real, not mocked) showed

Checked via live `yt-dlp -J` against YouTube (metadata only — titles/duration/
embeddability, never captions or any download):

| Seed ID | video_id | Result | Duration | Title match |
|---|---|---|---|---|
| ipg-001 | OTvm5LfhDzg | OK, embeddable, public | 375s (6m15s) | exact |
| ipg-002 | UKPkqrkgKmw | OK, embeddable, public | 241s (4m1s) | exact |
| ipg-003 | Z-zYu4patP8 | OK, embeddable, public | 584s (9m44s) | exact |

The seed pack's displayed durations matched the live, API-less check to within
rounding. The remaining 197 seed videos and all candidates from the 16 new channels
are **not validated** — running 200+ live checks against YouTube was judged out of
scope for this session without a further go-ahead (same caution as not making
hundreds of unnecessary AI calls); the mechanism is proven and ready to run on request.

## Rules conflict worth flagging now

`catalogue/sources.json`'s global rule is `minSec:60, maxSec:1800` (30 minutes). Some
seed entries already exceed that (`ipg-004`, `ipg-025` at 1h11m; `ipg-030` at 1h1m;
several others at 20–27 minutes), and several of the 16 new candidate channels are
known for long-form content (Big Think interviews, The School of Life essays, Matt
D'Avella documentaries). **No maxSec change was made.** Either those specific long
videos get excluded at review time, or the owner decides to raise the limit for this
category specifically — not decided here.

## Rights holds beyond the generic YouTube ToS review

- **TED/TEDx/TED-Ed are excluded outright** (no commercial license) — confirmed none
  are in the 200-seed or the 20-channel registry.
- **Big Think / The Well**: interview-style content with named academic/public-figure
  guests; likely has its own licensing posture (similar caution to TED) separate from
  standard YouTube ToS review — flagged in the source registry, not resolved.
- **Like Stories of Old**: film-essay format that embeds copyrighted film clips
  throughout its own videos — a materially different rights profile than a single
  narrator talking to camera. Needs an explicit fair-use/publisher check before any
  import, not just the standard embeddability check.
- **After Skool**: narrates over third-party audio/talks with original animation
  layered on top — whose voice/rights are actually in play needs checking per video,
  not assumed from the channel.
- **exurb1a**: literary, occasionally dark/mature themes — needs the content-
  sensitivity review called for in the implementation brief more than the other
  candidates do.
- Across all 200 seed entries and the registry, **no entry claims embeddability,
  caption rights, or editorial clearance** — those fields are `pending`/`unchecked`/
  `not_verified` throughout, by construction.

## Feature flag

`ideas_personal_growth_enabled` in `index.html`'s `FLAGS_DEFAULT` (`false`) and
`FLAGS_STAGING` (`true`, preview-only). The only code that reads it today is
`shLibCatsOrdered()`, which filters an `ideas_growth` category id out of the Shadow
library's chip list when the flag is off — a real kill switch, but currently a no-op
in practice because `catalogue/general.json` doesn't carry that category id at all
yet. This is deliberately the ONLY UI change: everything else about Shadow Studio
(player, picker, "Your videos", recording/AI feedback pipeline) is reused unmodified,
per the brief's instruction not to rebuild or redesign it.

## 20 first-review candidates (NOT cleared — for the owner's own review queue)

Picked from the 200-seed by title/duration alone: short-to-medium length (2m20s–
11m49s, comfortably inside the existing 30-minute rule with margin), evergreen
non-political framing (no election/news-adjacent titles, nothing from the Daily-Stoic-
style current-events mixing observed during research), and spread across all four
seeded channels and several subtopics so the owner's first pass sees variety. Title
alone cannot establish listening difficulty, full-content suitability, or rights —
these still need the same embeddability/editorial/rights review as the other 180.

| ID | Title | Channel | Duration | Subtopic |
|---|---|---|---:|---|
| ipg-045 | The Power Of Discipline | Robert Greene | 3m21s | Habits & Learning |
| ipg-060 | How People Misread The 48 Laws | Robert Greene | 2m20s | Human Nature & Communication |
| ipg-048 | Novels That Have Inspired Me | Robert Greene | 3m33s | Books & Ideas |
| ipg-057 | Exercises for Mastering the Laws of Human Nature | Robert Greene | 3m24s | Practical Philosophy |
| ipg-002 | The Pleasures and Powers from Reading Books | Robert Greene | 4m2s | Books & Ideas |
| ipg-079 | The Power Of Walking Away | Einzelgänger | 4m9s | Strategy & Decisions |
| ipg-078 | How To Be Alone \| 4 Healthy Ways | Einzelgänger | 8m17s | Human Nature & Communication |
| ipg-092 | 7 Stoic Exercises to Calm Your Mind | Einzelgänger | 7m57s | Resilience & Perspective |
| ipg-096 | How Marcus Aurelius Stayed Calm in Chaos \| 3 Stoic Methods | Einzelgänger | 6m57s | Resilience & Perspective |
| ipg-104 | 8 Ways To Enter The Present Moment | Einzelgänger | 7m26s | Practical Philosophy |
| ipg-111 | A Reason To Stop Worrying - Watch This Whenever You're Stressed Or Anxious | Pursuit of Wonder | 4m19s | Resilience & Perspective |
| ipg-134 | The Paradox of Being Nice | Pursuit of Wonder | 6m38s | Human Nature & Communication |
| ipg-153 | The Lie That Every Story Has In Common - Kurt Vonnegut On The Shapes of Stories | Pursuit of Wonder | 8m7s | Books & Ideas |
| ipg-112 | The Nova Effect - The Tragedy of Good Luck | Pursuit of Wonder | 5m55s | Practical Philosophy |
| ipg-149 | The Backwards Law - Why Happiness Is Ruining Your Life | Pursuit of Wonder | 6m18s | Strategy & Decisions |
| ipg-162 | Carl Jung - What are the Archetypes? | Academy of Ideas | 11m49s | Self-Awareness & Creativity |
| ipg-167 | The Psychology of Solitude | Academy of Ideas | 7m51s | Human Nature & Communication |
| ipg-176 | The Psychology of Conformity | Academy of Ideas | 10m57s | Human Nature & Communication |
| ipg-194 | Why Purpose and Discipline Promote Psychological Well-Being | Academy of Ideas | 7m17s | Habits & Learning |
| ipg-181 | Introduction to Ethics | Academy of Ideas | 10m8s | Practical Philosophy |

None of these are marked approved, cleared, or publication-ready. This is a proposed
starting order for the owner's own review, nothing more.

## Tests run this session (all automated, no mocked data presented as live)

`tests/ideas-personal-growth-import.mjs` (pure Node, 30/30 passing):
seed uniqueness/shape/draft-state checks; source-registry dedup/shape checks; a
synthetic 3-video dedup/conflict/idempotency/non-mutation test against the real import
script (not the real catalogues — a disposable temp copy); the flag's default/staging
values read directly out of `index.html`; `shLibCatsOrdered`'s actual gating logic
extracted and run standalone against both flag states.

Separately, by hand: the project's standard inline-script validation one-liner (from
CLAUDE.md) against the modified `index.html` — 5 scripts, 0 errors. A real (non-mocked)
`yt-dlp` metadata check against 3 of the 200 real YouTube videos (see table above).

**Not run:** the Playwright browser suite (`cd tests && npm test`) — not executed this
session; nothing changed in the rendered UI yet (the category doesn't exist in the
live catalogue, so there's no new screen to click through), but this should still be
run before anything in this branch is considered for merge, to catch any regression
the `shLibCatsOrdered` edit might cause for Welding's profession reordering (same
function, `weldStudioOn()` branch untouched but adjacent). iOS/Android WebView
playback and mobile layout: **not checked** — no visible change exists to check yet.
Live validation of the other 197 seed videos and any video from the 16 new channels:
**not run**, see above.

## Rollback

Everything this session touched is additive and isolated:

- `git branch -D feature/ideas-personal-growth` (and remove the worktree with `git
  worktree remove`) discards the whole thing; nothing was pushed or merged.
- Within the branch, the only non-additive change is the `shLibCatsOrdered` edit and
  the two `FLAGS_DEFAULT`/`FLAGS_STAGING` entries in `index.html` — reverting that one
  hunk removes 100% of the runtime behaviour change (the flag defaulting to `false`
  already means zero behaviour change in production even without reverting).
- Everything under `catalogue/drafts/`, `catalogue/ideas-personal-growth-sources.json`,
  `scripts/import_ideas_personal_growth.mjs`, and this doc are new files with no
  interaction with any other feature; deleting them is a clean, total rollback of the
  data/tooling side.

## Known limitations (explicit, not implied)

- Zero videos are approved, embeddability-checked at scale, or caption-rights-checked.
- CEFR is null everywhere; no level claim exists anywhere in this pipeline.
- The 16 new channels have channel-level metadata only — no video has been discovered,
  verified, or recorded for them.
- The Watch → speak → record → AI-feedback learning flow described in the brief is not
  built in this session: there is nothing to attach it to yet (no published video), and
  building it against zero real content would be exactly the kind of invented
  infrastructure the brief warns against. `shLoad()` (the existing, source-agnostic
  player/detail opener used by every other Shadow Studio video) is the correct reuse
  target once real `ideas_growth` videos exist in `catalogue/general.json` — confirmed
  via code reading, not exercised against this category because it has no content yet.
- No server-side route exists for catalogue content at all (it's static JSON fetched
  by the client) — the GE/Welding boundary here is the same client-side, file-level
  separation (`general.json` vs `welding.json`) used by every other Shadow Studio
  category and by Welding Mastery/English Mastery's own content split, not a new
  server enforcement layer. This matches existing project precedent; it is not a new
  gap introduced by this work.


---

# Session 2 — 8 Nov 2026: the review gate, real metadata, verified creators

Branch: `feature/ideas-growth-review-gate`, cut from `release/ge-baseline-recovery`
(`b35640a1`), which already carries session 1's pipeline as `b26c67c0`. Session 1's
worktree branch `feature/ideas-personal-growth` was left untouched; its sibling
`feature/ge-shadow-ideas-category` was deliberately **not** merged (see below).

## What was actually wrong, and is now fixed

1. **Validation results were computed and thrown away.** `--validate` printed a
   verdict to the console and wrote nothing to the registry, so `embedding_status`
   could never leave `unchecked` and `exact_duration_seconds` could never leave
   `null` — the two fields a publication decision most needs. A validated row now
   records `embedding_status`, `exact_duration_seconds`, `verified_channel_id` and a
   `validation` block (availability, age limit, live status, observed title/channel/
   handle, whether the observed title and duration agree with the seed, the tool and
   timestamp).
2. **Validation could only ever check the first N seed rows** (`slice(0, N)`), which
   are all Robert Greene. Added `--validate-ids=` and `--validate-selected`.
3. **Nothing enforced "publication fails closed".** There is now one `publishable()`
   gate requiring nine conditions to be positively true, and `--emit-category`, which
   builds the catalogue block this category *would* contribute — from publishable rows
   only. With all 200 rows still drafts it exits 3, prints no block, and names every
   unmet gate. It never writes a catalogue; merging the block stays a human step.
4. **A re-import wiped machine-written fields.** The seed carries
   `exact_duration_seconds: null`, and `mergeRecord` refreshed every non-review field
   from the seed — so a plain re-import erased a real measured duration. `MACHINE_FIELDS`
   now survive re-import and are replaced only by a newer validation run.
5. **`catalogue/drafts/` shipped inside the store apps.** ~700 KB of seed, registry and
   CSV was being copied into both the iOS and Android bundles — including the Welding
   bundle, which has no business carrying General English review-queue data. No app code
   ever fetches it (only `scripts/` and `tests/` read it). `mobile/ios/scripts/sync-web.mjs`
   now prunes `catalogue/drafts` from both bundles. The already-synced copies in the
   local bundles are untracked build output and are replaced on the next sync.
6. **The gate was the flag alone.** `shLibCatsOrdered` now requires
   `flag('ideas_personal_growth_enabled') && isGeneralEnglish()`.

## Why `feature/ge-shadow-ideas-category` was not merged

That branch adds an `ideas_growth` category and 20 channel records to the LIVE
`catalogue/general.json`, plus a `draft:true` code change whose stated purpose is to
make a category chip appear **while it is still empty**. Both conflict with this
feature's own rules: an empty category page is exactly what the brief forbids, and 16
of those 20 channel records carry no verified channel id, no avatar and no videos —
its own commit message says so. Nothing from it is lost: the 16 channels already live
in `catalogue/ideas-personal-growth-sources.json` as `candidate_new`.

## Live metadata validation (real, not mocked)

`yt-dlp 2026.08.19` metadata lookups (`-J --skip-download`) against the 20 first-review
candidates. **No captions, transcripts, audio or video were fetched** by any path.

| Result | Count |
|---|---:|
| Checked | 20 |
| `public`, embeddable, not age-limited, not live | 20 |
| Observed title disagrees with the seed | 0 |
| Observed duration disagrees with the listing | 0 |
| Genuinely unavailable | 0 |

**A caveat that matters more than the table.** The first pass reported 9 of 20 as
failures. They were not failures of the videos: a 40-second subprocess timeout under
throttling returned empty output, and the script counted that as "unavailable". One of
the nine had already been verified by hand minutes earlier. A tool that gives no answer
and a video that is genuinely gone are opposite claims about the world, and the script
was conflating them. `validateOne` now retries once with a longer deadline, and the
report counts `check_failed` separately from `unavailable`. All 9 passed on retry.
The remaining **180 seed rows are still `unchecked`** — not assumed good.

## Verified creator identities

Each of the four seeded creators' channel ids was resolved from **five of that
creator's own validated seed videos**, agreeing unanimously:

| Creator | channel_id | Handle |
|---|---|---|
| Robert Greene | `UC-qsP49Ai2GymJgyKX38l1w` | `@RobertGreeneOfficial` |
| Academy of Ideas | `UCiRiQGCHGjDLT9FQXFW0I3A` | `@academyofideas` |
| Einzelgänger | `UCybBViio_TH_uiFFDJuz5tg` | `@Einzelgänger` |
| Pursuit of Wonder | `UC-tLyAaPbRZiYrOJxAGB7dQ` | `@PursuitofWonder` |

Einzelgänger's listed handle (`@einzelganger`) differs from the observed one by case
and an umlaut only; the channel id was identical on every lookup, so the file records
the difference rather than quietly rewriting either value. The 16 `candidate_new`
channels still have **no channel id** and were not looked up.

## The 20 first-review candidates

`catalogue/drafts/ideas-personal-growth-review-manifest.json`. Selection is deterministic
and is a review **order**, not a clearance — it advances no review field. Rules: the
listing duration carries seconds (YouTube rounds longer cards, so a seconds-precise card
is the one real metadata can be checked against); 4–16 minutes; round-robin across the
four creators so the first batch is not one voice; within a creator, prefer a subtopic
not yet represented; ties break on seed id. Result: 5 per creator, 8 distinct subtopics.

## Tests

`node tests/ideas-personal-growth-import.mjs` — **56/56 pass** (was 25). New coverage:
manifest determinism and balance, the fail-closed publication gate and its unmet-gate
reporting, that `--emit-category` emits only approved rows, machine-field survival across
re-import, the Welding programme gate, and that no committed registry row claims to be
publication-ready, CEFR-levelled or playback-tested.

`index.html` passes the project JS parse check (5 scripts, 0 errors).

## Still not done (unchanged from session 1 unless noted)

- **No video is approved, published or visible.** `catalogue/general.json` still has no
  `ideas_growth` category; the production flag is still `false`.
- 180 of 200 seed rows have no metadata check.
- Caption rights, editorial suitability and use-policy review: **untouched by any of
  this**. An embeddable flag is a playback signal, nothing more — the registry says so
  on every validated row.
- The Watch → speak → record → AI-feedback flow is still unbuilt, for the same reason as
  session 1: there is no approved content to attach it to.
- No device or simulator check was run; no bundle was rebuilt. The `sync-web.mjs` prune
  is a code change verified by reading and by the existing prune mechanism (`drop(d,
  "dirs")` already handles nested paths such as `home-photos/welding`) — **it has not
  been exercised by an actual build in this session.**


---

# Session 3 — 8 Nov 2026: the category is on the Shadow page (staging only)

Owner instruction: "add channels and video links plus new category". Done, behind the
existing flag. **Production is unchanged**: `ideas_personal_growth_enabled` is still
`false` in `FLAGS_DEFAULT`.

## Why an overlay file instead of editing catalogue/general.json

The library's channel row, hero strip, search and "all" feed all read `_shCat` directly
and contain **no feature-flag check of their own** — `shLibCatsOrdered` only filters the
category chip list. So content placed in `general.json` would reach production whatever
the flag said: the channels would appear in the channel row, and the videos would be
findable by search. That is not an acceptable way to carry unreviewed third-party
content.

`catalogue/ideas-growth.json` is therefore a separate file, merged into `_shCat` by
`shCatMergeIdeas()` inside `shCatLoad()` **only when the flag is on and the open
programme is General English**. With the flag off the file is never fetched, so
production's catalogue is identical byte for byte to what it was. The kill switch is
absence, not a filter someone can forget to apply.

## What is in it

20 videos, 4 channels, one category. Only rows this project verified against real
YouTube metadata are included: public, embeddable, not age-limited, not live, measured
duration, and a channel id confirmed from that creator's own videos. The other 180 seed
rows are excluded because nobody has checked them.

Every record is `cap:"player"` (13 have human captions, 7 auto — availability read from
metadata; **no caption file is fetched, converted or bundled**, because this category has
no authorisation to) plus `watch:true`. `watch` is the one new concept: it tells
`shLibHasTx` to list a video whose transcript we cannot provide. The studio needs no
change — `svRender()` already draws its no-transcript card and hides the Shadow/Challenge
tabs for an item with no asset, which is exactly the "WATCH plus independent speaking
practice" fallback the brief asks for.

## The bug this nearly shipped

The first overlay build keyed every record by the seed label (`ipg-001`) instead of the
YouTube id, because the generator spread the row after the key: `({ id, ...r })` — and
`r.id` is the seed label. The library then asked `i.ytimg.com/vi/ipg-001/mqdefault.jpg`
and would have handed `ipg-001` to the player. Every thumbnail was a grey placeholder
and no video would have played.

The suite passed anyway, because it took its list of ids from the overlay it was
checking — a self-referential test proves nothing. It was caught by looking at a
screenshot and reading the image URLs. The suite now checks the overlay against the
**registry**: ids are 11-character YouTube ids, every id is a real registry key, no
`ipg-` label leaked in, and titles, durations and channel ids match the validated rows.

## Changed

| File | Change |
|---|---|
| `catalogue/ideas-growth.json` | new — the overlay (20 videos, 4 channels, 1 category) |
| `scripts/build_ideas_growth_overlay.mjs` | new — builds it from the registry; refuses to emit a non-11-character id or a channel without a verified id |
| `index.html` | `shCatMergeIdeas()` + `shLibHasTx` accepts `watch:true` |
| `sw.js` | precache the overlay beside the catalogue it extends |
| `mobile/ios/scripts/sync-web.mjs` | the overlay and the sources file are pruned from the Welding bundle |
| `tests/ideas-growth-library.mjs` | new — 35 checks |

## Tests

`node tests/ideas-growth-library.mjs` — **35/35**. Flag off: the overlay file is never
requested, no category, no channel, not one of the 20 ids in the catalogue, and a search
for a title in the pack finds nothing. Flag on: category, 4 channels and 20 videos
present, the existing 12 channels and 8 categories untouched, the chip drawn, the chip
feed lists 20, search and channel filtering reach them. Welding with the flag on: the
overlay is never fetched. Verified visually too — real thumbnails load from
`i.ytimg.com` and the four creators appear in the channel rail with the initials
fallback.

`node tests/ideas-personal-growth-import.mjs` — 56/56. `index.html` JS parse check clean.

## What this still is not

- **Not reviewed.** Every one of the 20 is `editorial_review: pending` and
  `rights_review: pending`. Nobody has watched them. `publishable()` still refuses all
  200, and the overlay file says `reviewed: false` with a warning in it.
- **Not in production.** The flag is false there, and this must not be turned on in
  production on the strength of a playability check.
- **No transcript**, so Shadow and Challenge do not work on these videos — Watch only.
- The four new channels sit at the END of the channel rail (after the existing 12) and
  the rail is not re-ordered per category; a scene row still appears above the feed for
  every category, as it already did. Both are existing behaviour, not introduced here.
- `sw.js` `CACHE` was NOT bumped — nothing is being deployed. A deploy would need it.

**READY FOR REVIEW — DO NOT MERGE OR DEPLOY.**
