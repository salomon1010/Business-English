> Superseded on 5 Oct 2026 by docs/TIERS.md (metered AI allowance, two plans, ads on General English only).

# BE Mastery — the authoritative Free / Premium capability matrix

**Status: REVIEWED AND IMPLEMENTED — READY FOR REVIEW, NOT MERGED, NOT DEPLOYED**

> **1 October 2026 — the owner's decisions, and what was built.** The audit
> below is unchanged; this note records what was approved out of it and where
> the code now stands. Nothing was merged and nothing was deployed.
>
> | Audit item | Decision | State |
> |---|---|---|
> | **D1** — may a Free learner use AI without an account? | **Option 1: no.** An authenticated account is required for every AI route, free capabilities included. No anonymous AI. | Already the behaviour; now pinned by `tests/free-premium-contract.mjs` §1 so it cannot drift open |
> | **D2 / F2** — the Shadow Challenge ladder | **Free.** Capture, transcription, participation and the coverage / word-accuracy / rhythm / completion feedback are Free; the per-word pronunciation score and the retell meaning verdict are Premium | **Built.** The six top-level `aiOff` bails are gone; `fbAssess` is the single gate; `ShadowSync.challenge(… assess: null)` was already the shape for it, so there is no parallel implementation |
> | **D3 / F3** — refusals reported as network failures | **Fix.** | **Built.** Six error chains gained a `premium` and an `acct` state; no capability gate anywhere now sets `err = "net"`, asserted in §7 of the new suite |
> | **D5 / F5** — `ai_verbal_feedback` | **Stop selling it.** TTS is free because the natural voice reads *content*; the capability was enforced nowhere, so it was a claim, not a capability | **Built.** Removed from `CAPABILITIES`, `PLANS`, `ENT_CAPS`, the Worker's capability whitelist, `premLockHTML` and `premBenefitRows`; three i18n keys deleted from all 15 packs. Premium now sells four rows on General English, three plus the video headroom on Welding |
> | **Cost control** — module-scope `Map`s were not rate limiting | **Fix properly, across isolates.** | **Built.** `backend/rate-limit.js`: a `RateLimiter` Durable Object, one global instance per subject, atomic under `blockConcurrencyWhile`. Every route moved onto it; `ytai` gained a per-**account** daily cap. No numeric limit was lowered |
> | **J1 — `ytai` was reachable anonymously** | **Fixed. An account is required, the route stays FREE.** `ROUTE_CAP.ytai` is still null, so an authenticated Free learner uses it exactly as before; what changed is that "free" no longer means "anonymous" on the one route that spends money per call (~$0.08 / 15 min) | **Built** (1 Oct 2026). `ytaiAccount()` in polish-worker.js verifies the Firebase ID token with the SAME module be-entitlements uses, so it works where `PREMIUM_ENFORCED` is off and there is no entitlement service to ask. Ordered FIRST on the route — before `no_key`, before the gate, before the edge cache. Fails CLOSED (503) on a missing `FIREBASE_PROJECT_ID` or a cold JWKS outage: for a route that spends money a configuration gap must stop the spending, not the checking. The per-account cap is no longer inert. `PREMIUM_ENFORCED` untouched, no other route changed, nothing became Premium. 20 checks in `backend/test-rate-limit.mjs` §J1 + 4 in `tests/shadow-transcript.mjs` |
> | **Social sign-in** | **Not this release.** Email and password remain the only provider; no Google, no Apple, no linking code | Untouched |
> | **F4** (tie `ytai` to `youtubeImports`), **F6** (split `ai_analysis`), **F7** (a pre-activity notice), **D6**, **D7**, **D8**, **D9** | **Not approved for this pass** | Not built. F4's *enforcement* half is covered by the new per-account `ytai` cap; its storage-limit half is not |
>
> Two earlier documents predate this change and still describe
> `ai_verbal_feedback` as a Premium capability: `PREMIUM_LAUNCH_REPORT.md` and
> `WELDING_PREMIUM_REPORT.md`. They are accurate records of what was true when
> they were written; this file is the current contract.

**Date:** 1 October 2026 · **Audited commit:** `f6239c0a`
(`fix/ai-account-gate-honest-failures`), which is `release/gloat-readiness-sprint`
plus the 1 October AI-gate fixes. **Production:** `be12-v489`, `billing_enabled`
off, `PREMIUM_ENFORCED = "0"` — **nothing is gated in production today.**

Nothing was deployed. Nothing was merged. No production configuration was
touched. No other session's worktree was written to. The only code written in
this audit is this file.

---

## A. The current monetization architecture

Four mechanisms, in the order a request meets them. A capability must pass all
four that apply to it.

| # | Layer | Where | What it decides |
|---|---|---|---|
| 1 | **Plan resolution** | `backend/entitlements/src/entitlement-core.js` | A stored D1 record → the application-facing VIEW (`plan`, `paid`, `ads`, `capabilities`, `expiresAt`). Fails closed to Free. |
| 2 | **Entitlement service** | `backend/entitlements/entitlements-worker.js`, `GET /v1/entitlement` | Verifies the Firebase ID token, picks the deciding record, returns the VIEW. The only thing that can say "Premium". |
| 3 | **Client gate (what is DRAWN)** | `index.html` — `planOn()` → `entGated()` → `hasEntitlement(cap)` → `entLocked(cap)` → `aiOff(cap)` / `sttOff()` | Whether a lock card, an offer or a degraded path is shown, and whether a call is worth making. Explicitly **not** a security boundary. |
| 4 | **Server gate (what is SPENT)** | `backend/polish-worker.js` — `premiumOn(env)` → `ROUTE_CAP` / `CHAT_PURPOSE_CAP` → `premiumGate()` | The real boundary. Forwards the caller's token to layer 2 and refuses `402 premium_required` without the capability. |

Switches that must all agree:

| Switch | Where | Production | Staging |
|---|---|---|---|
| `billing_enabled` | `FLAGS_DEFAULT` / `FLAGS_STAGING`, index.html | `false` | `true` |
| `ENT_API` / `beEnv().entitlements` | index.html | `""` | `be-entitlements-staging` |
| `PREMIUM_ENFORCED` | `backend/wrangler.toml` | `"0"` | `"1"` (`[env.staging]`) |
| `ENTITLEMENTS_URL` | `backend/wrangler.toml` | `""` | `be-entitlements-staging` |

`planOn() = billing_enabled && entApiBase()`. With either off, `entGated()` is
false, `hasEntitlement()` returns **true for everything**, and the app is
exactly what it is today. That is why production is unaffected by everything
below — **this is a Premium-launch audit, not a live-site incident.**

Two things that are deliberately **not** in the boundary:

- **Track.** One subscription covers General English and Welding (owner,
  30 September 2026). `entGated()` carries no track term by design. What
  differs per track is only which benefits are *advertised*
  (`premBenefitRows()`) and the Free *storage* numbers (`PLAN_LIMITS_TRACK`).
- **The partner Worker.** `backend/partner/partner-worker.js` contains no
  entitlement check at all. Matching, invites, human practice, live audio and
  History are free server-side; only the AI coach's *replies* are gated, and
  they are gated at be-polish (`chat` purpose `coach`), not here.

### The six capabilities — the whole contract

`CAPABILITIES` in entitlement-core.js and `ENT_CAPS` in index.html, same names,
same order (test 1 of `premium-boundary.mjs` asserts this):

`ad_free` · `ai_analysis` · `ai_verbal_feedback` · `advanced_progress` ·
`ai_coach` · `recommended_content`

`ai_allowance` and `practice_allowance` are legacy enums kept for the ad and
reward code; nothing reads them as a gate.

---

## B. Complete capability inventory

Every gate in the codebase, with the layer that enforces it. "Free" below means
free *of a capability* — see **D1**, which is about accounts, not capabilities.

### Client gates — the complete list of call sites

| Capability | Call site (index.html) | Feature |
|---|---|---|
| `recommended_content` | `homeRecLocked` 12173, `homeItemLocked` 12174, `homeRowsPremHTML` 12241 | Home "Because you…" rows: the video and Challenge cards |
| `ai_coach` | `ppAiChoiceHTML` 27714, `ppAiStart` 28823 | Practice Partner AI coach |
| `advanced_progress` | `pgRecordLocked` 30207 | Progress → "See all details": 30/90-day analytics, trends, the long record |
| `ai_analysis` | 21 sites via `aiOff("ai_analysis")` | every AI judgement — see the table below |
| `ai_verbal_feedback` | **none** | **nothing. Sold, never enforced — see D5** |
| `ad_free` | `AdEligibility.planAllowsAds` 23279 | advertising (`ads_enabled` is `false`, so inert) |

The 21 `ai_analysis` sites, grouped:

| Group | Sites | What a Free learner loses |
|---|---|---|
| Session / mission reports | `mvPron` 11154, `mvCoach` 11181, `mvRepMount` 11360, `mvExReport` 11370, `sessReport` 17892, `wsReport` 17985 | the AI speaking report |
| Interview / simulation | `simEnrichAnalysis` 20000 | the AI enrichment **on top of** the local `AnswerEvaluator` rubric score |
| Role-play | `rpRepEvidence` 31084, `rpRepRun` 31209, `rpReport` 31239, `rpHistMake` 32094 | the role-play speaking report |
| Pronunciation | `fbAssess` 21204 (`/assess`), `exAI` 21708 (`/analyse`) | per-word pronunciation scoring, fluency analysis |
| Grammar fix | `fbFixGrade` 18695 | the graded grammar drill |
| **Shadow Challenge ladder** | `svChGrade` 26004, `svChRetellGrade` 25728, `svChChorusGrade` 25837, `svChBuildGrade` 25915, `svChDrillGrade` 26337, `svChUseGrade` 26538 | **all five rungs: the whole Challenge is unusable — see D2** |
| Live practice | `ppLiveRoundTip` 28275 | the round tip in a live call |

`sttOff()` (no capability, account only) guards `fbWords` 21072,
`fbTranscribe` 21125, `exTranscribe` 21697.

### Server gates — `ROUTE_CAP`, backend/polish-worker.js:194

| Route | Capability | Used by |
|---|---|---|
| `transcribe` (raw audio body) | **null** — free since 1 Oct 2026 | every spoken turn: interview, workshop, role-play, Challenge, Foundations |
| `captions` | null | YouTube's own captions |
| `ytai` | null | AI transcription of a video (costs real money per video) |
| `tts` | null | the natural voice |
| `polish` / `repolish` | null | Executive Polish rewrite |
| `assess` | `ai_analysis` | per-word pronunciation grade |
| `analyse` | `ai_analysis` | fluency / filler analysis |
| `mvreport` | `ai_analysis` | the mission report |
| `chat` purpose `practice` | null | role-play replies, Shadow translation, IPA, simulation characters |
| `chat` purpose `report` | `ai_analysis` | speaking reports |
| `chat` purpose `coach` | `ai_coach` | the AI coach session |

### Storage limits — `PLAN_LIMITS`, index.html:23175

Limits on what a learner **keeps**, never on practising. None of the usage rows
is enforced; all five are `null` on both plans.

| Limit | Free (GE) | Free (Welding) | Premium | Enforced at |
|---|---|---|---|---|
| `savedShadow` | 2 | 1 | 100 | `shOwnCap` 14888 |
| `youtubeImports` | 1 | 1 | 20 | `shOwnCap` 14888 |
| `savedClips` | 1 | 1 | 30 | `shClipCap` 15378 |
| `polishHistory` | 1 | 1 | 50 | `exRepHTML` 21495 |
| `aiConversationDaily`, `aiSimulationDaily`, `partnerSessionMin`, `partnerSessionsDaily`, `reportHistory`, `progressHistoryDays` | null | null | null | nowhere |

### Rate limits — not a plan lever

Per-IP per route (`RATE_PER_MIN` 15, `STT_PER_MIN` 20 / `STT_PER_DAY` 600,
`CHAT_PER_MIN` 20, `ASSESS_PER_MIN` 15, `YTAI_PER_MIN` 2 / `_PER_DAY` 25), plus,
once enforcement is on, per **account** `ACCT_PER_MIN` 30 / `ACCT_PER_DAY` 600.
**Identical for Free and Premium.** Usage is not currently differentiated by
plan anywhere in the system.

### Ungated — verified, no gate of any kind

The 12-week curriculum and road map · Foundations / Stage 0 and the placement
check · phrase bank and Phrase Lab · vocabulary and spaced repetition · the
progress calendar, streak and year graph · the Career Centre and the
certificate · Practice Partner discovery, Match me, invites, human practice,
live audio, History · Executive Polish rewrites · the Shadow library, Watch and
Shadow modes, transcripts, recording and replay · Shadow translation and IPA ·
every character reply in interview, workshop and role-play · sign-in, profile,
backup and sync · the manual, About and every setting.

---

## C. The proposed matrix

**Principle (owner, Phase 2):** Free is a **complete but limited** learning
product. A Free learner completes Learn → Practice → Speak → Feedback →
Improve. Premium adds depth, personalisation, advanced analysis, headroom and
convenience. No paywall stands in front of a mechanism the learner needs in
order to perform the activity.

Changes from the current implementation are marked **→ MOVE** and reasoned in
section D.

| Capability | Free | Premium | Reason | Usage limit | Track | Notes |
|---|---|---|---|---|---|---|
| **AUTH** | | | | | | |
| Sign up / sign in | ✅ | ✅ | identity is not a product | — | both | optional today, and must stay so |
| Profile, goal, avatar | ✅ | ✅ | deliberately shared | — | both | never split by area |
| Session restore, backup, Firestore sync | ✅ | ✅ | the learner's own data | — | both | audio never synced |
| Account deletion | ✅ | ✅ | Apple 5.1.1(v) / Play | — | both | `DELETE /me` + `ppEraseMe` |
| **CURRICULUM** | | | | | | |
| 12-week plan, lessons, road map | ✅ | ✅ | "the curriculum is never metered by plan" | — | both | |
| Foundations / Stage 0 + placement | ✅ | ✅ | it is the entry point for A1–A2 learners | — | both | francophone-majority audience |
| Vocabulary, spaced repetition, words due | ✅ | ✅ | core loop | — | both | |
| Phrase bank, Phrase Lab | ✅ | ✅ | core loop | — | both | |
| Listening, transcripts, Watch | ✅ | ✅ | core loop | — | both | |
| Progress calendar, streak, year graph | ✅ | ✅ | the learner's own record | — | both | |
| **SPEAKING** | | | | | | |
| Microphone permission, recording, replay | ✅ | ✅ | a mechanism, not a product | — | both | never gated, in any state |
| **Basic transcription** (`transcribe`) | ✅ | ✅ | being understood *is* the activity | `STT_PER_MIN` 20 / `_PER_DAY` 600 + `ACCT_PER_DAY` 600 | both | fixed 1 Oct 2026 |
| Conversation / character replies (`chat practice`) | ✅ | ✅ | without these a spoken activity has no partner | `CHAT_PER_MIN` 20 | both | |
| Interview / workshop / simulation participation and completion | ✅ | ✅ | the flagship spoken loop | — | both | |
| **Basic feedback** — local `AnswerEvaluator` rubric score, coverage, self-score | ✅ | ✅ | Free must close the loop with *some* feedback | — | both | runs on-device, no AI |
| AI speaking report (pronunciation / grammar / vocabulary / fluency) | ❌ | ✅ | the judgement is the product | — | both | `ai_analysis` |
| Per-word pronunciation scoring (`assess`) | ❌ | ✅ | advanced analysis | `ASSESS_PER_MIN` 15 | both | `ai_analysis` |
| Fluency / filler analysis (`analyse`) | ❌ | ✅ | advanced analysis | — | both | `ai_analysis` |
| Interview AI enrichment, interviewers' report | ❌ | ✅ | depth on top of the free local score | — | both | `ai_analysis` |
| **SHADOW STUDIO** | | | | | | |
| Library, video, transcript, synchronised transcript | ✅ | ✅ | content, not judgement | `CAP_PER_MIN` 12 | GE + Welding | |
| AI transcription of an un-captioned video (`ytai`) | ✅ | ✅ | without it a video has no words at all | `YTAI_PER_MIN` 2 / `_PER_DAY` 25 | both | real per-video cost; watch this one |
| Watch, Shadow, record, replay | ✅ | ✅ | core loop | — | both | |
| Basic translation (sentence), word lookup, IPA | ✅ | ✅ | a francophone A2 learner cannot practise a line they cannot read | `CHAT_PER_MIN` 20 | both | `chat practice` |
| **Challenge — entering, recording, coverage + rhythm feedback** | ✅ **→ MOVE** | ✅ | currently Premium in effect; it is the Speak → Feedback step of Shadow | — | GE | **D2** |
| Challenge — per-word pronunciation grade (`assess`) | ❌ | ✅ | advanced analysis, degrades cleanly to null | — | GE | the ladder already handles a missing grade |
| Advanced AI analysis, coach report, micro-practice | ❌ | ✅ | depth | — | GE | `ai_analysis` |
| Saved videos / clips / imports | 2 / 1 / 1 (GE) · 1 / 1 / 1 (Welding) | 100 / 30 / 20 | headroom, not access | — | per track | `PLAN_LIMITS(_TRACK)` |
| **PRACTICE PARTNER** (General English) | | | | | | |
| Discovery, presence, Match me, matching, invites | ✅ | ✅ | human practice is the free product | `BURST_PER_MIN` 60 | GE | no entitlement check in the Worker |
| Human voice session, 4 rounds, decisions, rematch | ✅ | ✅ | unrationed by owner decision, 23 Sep 2026 | per-minute only | GE | **no daily quota, ever** |
| Live practice (WebRTC) | ✅ | ✅ | same | — | GE | `LIVE_ENABLED` |
| Transcription inside a partner session | ✅ | ✅ | same rule as every spoken turn | STT limits | GE | |
| History, unblock, report, block | ✅ | ✅ | safety and the learner's own record | `report` 5 / `block` 20 per day | GE | |
| AI coach session and its feedback | ❌ | ✅ | an on-demand coach is depth | 12 sessions/day (Worker) | GE | `ai_coach`; the card stays visible and tagged |
| Post-session AI tip, live round tip | ❌ | ✅ | depth | — | GE | `ai_analysis` |
| **AI** | | | | | | |
| TTS / the natural voice reading lessons and characters | ✅ | ✅ | it reads the *content* | `TTS_PER_MIN` 60 | both | |
| **Feedback spoken back to the learner** | ❌ **→ DECIDE** | ✅ | advertised as Premium; **enforced nowhere** | — | both | **D5** |
| Executive Polish rewrite | ✅ | ✅ | owner decision; history is what is capped | `RATE_PER_MIN` 15 | both | |
| Executive Polish history | latest 1 | last 50 | storage headroom | — | both | |
| **CAREER** | | | | | | |
| Career Centre, destination, standards, certificate | ✅ | ✅ | no gate exists today | — | both | |
| Professional / career readiness report | ✅ | ✅ | ungated today; **leave it** until a product decision says otherwise | — | both | **D8** |
| **PROGRESS** | | | | | | |
| Calendar, streak, consistency, year graph | ✅ | ✅ | the learner's own record | — | both | |
| 30/90-day analytics, trends, long record | ❌ | ✅ | advanced analysis | — | both | `advanced_progress`; real figures shown dimmed, nothing deleted |
| **HOME** | | | | | | |
| Home, programme card, next step, hero | ✅ | ✅ | navigation | — | both | |
| Personalised recommendation rows (video + Challenge cards) | ❌ | ✅ | personalisation | — | both | `recommended_content`; heading and reason stay, cards go, one offer bar |
| **MONETIZATION** | | | | | | |
| Subscription status, entitlement read | ✅ | ✅ | the learner must see what they have | — | both | |
| Upgrade flow, restore purchase | ✅ | ✅ | required by both stores | — | both | |
| Ad-free | ❌ | ✅ | `ad_free` | — | both | `ads_enabled` false — inert |

---

## D. Misclassified capabilities

### MISCLASSIFIED AS PREMIUM

**D1 — `PREMIUM_ENFORCED` requires an *account* on every route, free ones
included. P0.**
`premiumGate()`'s `cap === null` branch still calls `capabilities()` so a call
can be attributed and rate-limited per account. Sign-in is **optional** in this
product (CLAUDE.md: the Firestore user count is "a floor — sign-in is
optional"). So the moment Premium goes on sale, a learner who has never signed
in loses transcription, translation, IPA, TTS, every character reply and every
report — `401 auth_required`, measured 20/20 in
`docs/release/SHAKEOUT_2026-10-01.md`.

The client half is now honest (`aiNoAccount()` / `sttOff()` / `ai.need_acct`,
and `ai-account-gate.mjs` 29/29 proves it). The **product** question is not
fixed and is yours: *may a Free learner use the core spoken loop without an
account at all?* Three options:

1. **Require an account for any AI** (today's behaviour). Simple, attributable,
   abuse-resistant. Costs you every learner who will not sign up before trying
   — on a francophone-Africa audience that is the expensive option.
2. **Allow anonymous free routes**, held by IP and a device-scoped token.
   Keeps the funnel open; weakens per-account abuse control on `ytai`, which
   costs roughly $0.08 per video.
3. **Anonymous allowance then sign-in**: *n* free spoken turns per device, then
   an account. Best funnel, most work, and it is a new metered path — the first
   thing in this product that would meter practising.

I recommend **3** for launch if there is time, **1** if there is not — but **1**
must then be stated to the learner *before* they start a spoken activity, not
when their first turn fails.

**D2 — The whole Shadow Challenge ladder is Premium in effect, and reports
itself as an offline error. P0 for the General English Free product.**
All five rungs (`svChGrade`, `svChRetellGrade`, `svChChorusGrade`,
`svChBuildGrade`, `svChDrillGrade`, `svChUseGrade`) bail on
`aiOff("ai_analysis")` **before** doing any work. A Free learner can enter the
Challenge from the library, record, and then be told: *"Feedback needs a
connection. Your recording is saved — retry when you are online"* — beside a
Retry button that can never succeed. Verified in a browser: with
`billing_enabled` on and a Free plan, `aiOff("ai_analysis")` is `true` and that
is the string the error path resolves to.

This is also the clean fix, because the grading already separates:
`ShadowSync.challenge(text, heard, { words, assess, … })` accepts `assess:
null`, and `svChGrade` has a whole `c.pending` path for a pronunciation grade
that arrives late or not at all. `fbWords` and `fbTranscribe` are **free** now
(`transcribe: null`). So gate `fbAssess` alone and a Free learner gets coverage,
word accuracy and rhythm from the free transcript, while the per-word
pronunciation grade stays Premium. Removing the six top-level bails is most of
the work.

**D3 — Seven sites report a Premium refusal as a network failure. P1.**
`fbFixGrade` 18695 and the six Challenge graders set `err = "net"` →
`sv.ch_err_net` ("needs a connection"). The owner's "functionality appears
intermittent" report came from exactly this class of lie. `aiOffNote(cap)`
already returns the right three-way message and is used by every report path;
these seven never adopted it. Fixing D2 removes six of them; `fbFixGrade` needs
its own `err = "premium"` state and string.

### MISCLASSIFIED AS FREE

**D4 — `ytai` is free and costs real money.**
AI transcription of an un-captioned video is `null` in `ROUTE_CAP`, correctly:
without words there is no lesson. But it is the only free route with a
meaningful per-call cost (~$0.08 for 15 minutes), held only by
`YTAI_PER_MIN` 2 / `YTAI_PER_DAY` 25 per IP. Keep it free, but tie it to the
Free `youtubeImports` limit (1) so a Free learner cannot transcribe an unbounded
number of pasted videos. This is the one genuine revenue leak in the matrix.

**D5 — `ai_verbal_feedback` is sold and enforced nowhere. P1 — store-compliance
risk.**
`prem.b_verbal` ("AI feedback spoken back to you, so you hear it as well as
read it") is row 2 of the paywall on both tracks. The capability is checked at
**zero** call sites, and `tts` is `null` server-side. A Free learner already
has it. Advertising a subscription benefit the free tier already provides is an
App Store 3.1.2 / Play subscription-disclosure problem as well as a trust one.
Two honest ways out: enforce it (the *report being read aloud* becomes Premium
while the voice reading *content* stays free), or drop the row from
`premBenefitRows()`. **Dropping the row is the smaller, safer change** and I
recommend it for launch.

### CORRECTLY FREE

Curriculum, road map, Foundations, phrase bank, vocabulary, the progress
calendar, the Career Centre, the certificate, recording and replay, the Shadow
library, Watch and Shadow, transcripts, translation, IPA, character replies,
Executive Polish rewrites, Practice Partner discovery / matching / human
practice / live / History / safety, transcription, TTS of content, sign-in and
sync. All verified ungated.

### CORRECTLY PREMIUM

`ai_analysis` for the **verdict** (speaking reports, per-word pronunciation
scoring, fluency analysis, interview enrichment, coach reports) ·
`advanced_progress` (30/90-day analytics) · `ai_coach` (the on-demand coach) ·
`recommended_content` (personalised rows) · `ad_free` · the storage headroom in
`PLAN_LIMITS`.

### UNCERTAIN / REQUIRES PRODUCT DECISION

| # | Question | Why it is yours |
|---|---|---|
| D1 | May a Free learner use AI without an account? | funnel vs abuse cost |
| D5 | Enforce `ai_verbal_feedback` or stop selling it? | revenue vs honesty |
| D6 | Should Free get a *small* AI allowance (e.g. 1 report/day) rather than none? | the strongest upgrade trigger is tasting the thing. Nothing in `PLAN_LIMITS` is wired for this yet — `aiConversationDaily` and friends are all `null`. |
| D7 | `recommended_content`: the rows currently hide **all** cards, free ones included (v608). Correct, or should free cards stay? | you reversed this once already; stated here so it is a decision, not a drift |
| D8 | Career readiness report: Premium or free? | the matrix lists Premium "advanced career readiness"; **no such gate exists** and I did not add one |
| D9 | Welding Free gets 1 saved video vs General English's 2 | deliberate (30 Sep); confirm it survives this reset |

---

## E. Root causes

1. **One capability is doing five jobs.** `ai_analysis` guards 21 sites that
   mean three different things: the *verdict* (correctly Premium), the
   *mechanism* that produces it (was wrongly Premium — `transcribe`, fixed), and
   the *basic feedback* a Free learner needs to close the loop (D2, still
   wrong). A capability named after a feature rather than a *value* will keep
   collecting unrelated gates.
2. **The gate was added to the call, not to the spend.** The pattern
   `if (aiOff(cap)) return` was retrofitted onto existing offline guards. Where
   a function did several things — grade, and also transcribe, and also compute
   locally — the guard landed on all of them. That is exactly D2.
3. **"Free" conflated with "anonymous".** `premiumGate` needs an account to
   *attribute* a call; the product does not require one to *learn*. Nothing in
   the design wrote that distinction down. That is D1.
4. **The refusal reason was thrown away.** A boolean gate cannot explain
   itself, so the nearest existing error state was reused — `"net"`. That is
   D3, and it is why three different causes looked like one intermittent bug.
5. **The paywall copy and the enforcement were written separately.** That is
   D5.

---

## F. Recommended changes — for your approval, not yet written

| # | Change | Files | Risk |
|---|---|---|---|
| F1 | Decide D1, then implement it | `backend/polish-worker.js` (`premiumGate` null branch), `index.html` (`aiNoAccount`, `sttOff`, pre-activity notice) | high — it is the funnel |
| F2 | Remove the six top-level `aiOff` bails in the Challenge ladder; let `fbAssess` be the only gated part; show the free coverage/rhythm feedback with an honest "pronunciation grade is Premium" line | `index.html` 25728, 25837, 25915, 26004, 26337, 26538 | medium — touches the released Challenge ladder |
| F3 | Give `fbFixGrade` a `premium` error state and use `aiOffNote` | `index.html` 18695, `sv.ch_err_*` + 15 i18n files | low |
| F4 | Tie `ytai` to the Free `youtubeImports` limit | `index.html` (`shCapMayAsk`), optionally `backend/polish-worker.js` | low |
| F5 | Drop `prem.b_verbal` from `premBenefitRows()` (or enforce it) | `index.html` 23194, paywall copy, 15 i18n files | low |
| F6 | Split `ai_analysis` into `ai_report` (the verdict) and leave basic grading free — **or** document that `ai_analysis` means "the verdict only" and audit all 21 sites against that sentence | `entitlement-core.js`, `index.html`, `backend/polish-worker.js`, every test | high — it is the contract; only worth it if F2 is not enough |
| F7 | A pre-activity notice: say what Free gets *before* a spoken activity, never after a turn fails | `index.html` | low, high value |
| F8 | Correct the stale `/v1/capability` comment in `entitlement-core.js` — that route does not exist in the entitlements Worker | `entitlement-core.js` | trivial |

**Deploy order, when approved** (unchanged from the existing runbook, and it
matters): be-entitlements → confirm `/v1/entitlement` answers → be-polish with
`PREMIUM_ENFORCED` + `ENTITLEMENTS_URL` and the CORS/`global_fetch_strictly_public`
fix → *then* the web bundle with `billing_enabled`. Reversing the last two
leaves every signed-in AI call refused by the browser.

---

## G. Security implications

- **No change weakens the boundary.** Every recommendation above moves work
  from the *gated* side to the *free* side of a gate that the server still
  enforces, or makes a message honest. `hasEntitlement` stays the single client
  gate; `premiumGate` stays the single server gate; the client never becomes
  authoritative.
- **F2 spends nothing new.** It consumes `transcribe` (already free) and skips
  `assess` (still gated). No new route, no new capability, no new spend.
- **F4 tightens** a free route that currently has only an IP limit.
- **The known `chat` hole is unchanged and still open:** the system prompt comes
  from the client, so a caller who can reach the route can make the model do
  anything whatever purpose they declare. `purpose` gates the app's own flows,
  not an attacker. Closing it means moving the system prompts into the Worker —
  out of scope here, and it should stay on the register.
- **D1 option 2 or 3 would weaken per-account attribution** on the free routes.
  If you choose either, `ytai` should be excluded from the anonymous set.

---

## H. Revenue and usage implications

- **F2 (Challenge basic feedback free)** is the one change that gives value
  away. It is the right trade: a Free learner who never once completes
  Speak → Feedback has nothing to upgrade *from*. The per-word pronunciation
  grade — the thing learners actually ask for — stays paid.
- **F5** removes an advertised benefit. It does not remove anything a payer
  has, because nothing enforced it; it removes a claim you cannot support.
- **F4** reduces cost. It is the only recommendation that saves money.
- **D6 (a small Free AI allowance)** is the strongest untested upgrade lever
  and the only one that needs new metering. Note that it would be the first
  limit in this product on *practising* rather than on *keeping*, which cuts
  against the stated principle — if you want it, frame it as a taste of the
  verdict, not a cap on practice.
- **Unchanged and deliberate:** there is **no daily practice quota** anywhere
  (owner, 23 Sep 2026), rate limits are identical on both plans, and `ACCT_PER_DAY`
  600 is an abuse ceiling, not a product limit. Nothing above introduces one.

---

## I. Required tests

**Would become invalid / need updating**

| Suite | Assertion | Why |
|---|---|---|
| `tests/premium-boundary.mjs` | 11 "the AI analysis gate is closed", 14 "asking for a report made NO call" | still true for *reports*; must not be read as covering the Challenge once F2 lands |
| `tests/premium-boundary.mjs` | 31 "the recommended videos and Challenges are Premium content" | wording: Home's Challenge *cards* are Premium; the Challenge *activity* would not be |
| `tests/premium-value.mjs`, `tests/premium-acquisition.mjs`, `tests/subscription.mjs` | any assertion on the benefit rows | F5 removes `prem.b_verbal` |
| `tests/welding-premium.mjs` | the benefit-row assertions | same |
| `backend/test-premium-gate.mjs` | `ROUTE_CAP` table | only if F6 is chosen |

**New tests needed**

1. Free + billing on, Shadow Challenge: a recording is graded, coverage and
   rhythm are shown, the pronunciation block says Premium — and the word
   "connection" appears nowhere.
2. Every `err` state that can be reached while `entGated()` is true resolves to
   a message naming the real reason. A grep-style assertion that no
   `aiOff(...)` branch sets `err = "net"`.
3. `ai_verbal_feedback`: either it gates something, or it is not in
   `premBenefitRows()`. One or the other must hold.
4. A Free learner's `ytai` call is refused past the `youtubeImports` limit.
5. Whatever D1 resolves to, asserted in both states (signed out, signed in Free)
   on both tracks.
6. A Welding Free learner completes a workshop turn end to end: heard,
   transcribed, locally scored, no Premium wall mid-activity.

**Test-harness defect that must be fixed before any "all green" is trusted**
(C3 in the shakeout, re-confirmed today): suites hardcode ports and
`spawn(…, stdio: "ignore")` hides a bound port, so another session's worktree
answers and the suite certifies the wrong code. During this audit port **8097**
was held by another session; `premium-boundary.mjs` cannot be redirected because
it ignores `PORT`. Run on a verified free port, or the result means nothing.

**What was actually run in this audit** — commit `f6239c0a`, verified free
ports, real headless Chromium:

| Suite | Result |
|---|---|
| `premium-boundary.mjs` (port 8591) | **47/47** |
| `ai-account-gate.mjs` (port 8661) | **29/29** |
| `welding-premium.mjs` (port 8298) | **42/42** |

All green — and **none of them catches D2, D3, D4 or D5.** That is the point of
item 1–4 above.

---

## J. Files that would need modification

Nothing below has been touched.

| File | For |
|---|---|
| `index.html` | F2 (6 sites), F3, F4, F5, F7, and F1's client half |
| `backend/polish-worker.js` | F1 (`premiumGate` null branch), F4 server half, F6 if chosen |
| `backend/entitlements/src/entitlement-core.js` | F6 if chosen, F8 |
| `backend/wrangler.toml` | only at release, and only in the documented order |
| `i18n/*.json` (15) | F3, F5, F7 — French, Spanish, Portuguese and Arabic translated; English left in the other 11 per the standing rule |
| `tests/premium-boundary.mjs`, `premium-value.mjs`, `premium-acquisition.mjs`, `subscription.mjs`, `welding-premium.mjs`, `ai-account-gate.mjs` | section I |
| `backend/test-premium-gate.mjs` | F6 if chosen |
| `docs/release/PREMIUM_LAUNCH_AUDIT.md`, `WELDING_PREMIUM_REPORT.md`, `SHAKEOUT_2026-10-01.md` | cross-reference this matrix |
| `CLAUDE.md` | once the matrix is approved, it becomes the monetization reference |

---

## Phase 9 summary — the decision in front of you

| | |
|---|---|
| **Moving Premium → Free** | Challenge basic feedback (coverage, word accuracy, rhythm) — **D2/F2**. Already done before this audit: `transcribe` — being heard. |
| **Moving Free → Premium** | **None.** Nothing is being taken from a Free learner. |
| **Stopping being sold** | "AI feedback spoken back to you" — **D5/F5** — because it was never enforced. |
| **New usage limits** | One: `ytai` tied to `youtubeImports` — **D4/F4**. No new limit on practising. |
| **Still open, and yours** | D1 (account for AI?), D5 (enforce or drop), D6 (a Free taste of the verdict?), D7, D8, D9. |
| **Unchanged** | Track isolation, the one-subscription rule, the server as the only boundary, no daily practice quota, the deploy order. |

**READY FOR REVIEW — DO NOT MERGE OR DEPLOY.** (The decisions above are
implemented on `feature/product-boundary-implementation`; the deploy order in
section F still applies and has not been run.)
