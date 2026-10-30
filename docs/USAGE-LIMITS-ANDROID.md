# Android usage limits — what is enforced, and every deviation from the proposal

Written 22 October 2026 against `fix/welding-product-ids` (`64339712`), on branch
`feature/android-usage-limits`. **Nothing is deployed, merged or published.**

`docs/TIERS.md` stays the commercial source of truth and `docs/ACCESS-MATRIX.md`
the record of per-route enforcement. This file adds the one thing neither had: a
single table of every usage limit with its unit, where it is enforced, and — for
each row of the October 2026 usage-limit proposal — whether the proposed number
was adopted, and if not, why not.

No quota value was changed by this work. The reason is in §3.

## 1. The policy register

One row per metered or capped feature. "Where" is the only place the number
lives; a second copy anywhere else is drift waiting to happen.

| Feature id | Unit | Visitor | Free | Premium | Reset | Where the number lives | Server-enforced |
|---|---|---|---|---|---|---|---|
| `verdicts` — AI speaking reports, pronunciation scores, AI coach replies | actions | none (401) | 3 / day | 120 / day | UTC midnight | `VERDICTS_FREE_PER_DAY` / `VERDICTS_PREMIUM_PER_DAY`, `backend/polish-worker.js` | yes — `verdictAllowance()`, bucket `verdict:<UTC day>` in the `RateLimiter` DO |
| `video` — the learner's own YouTube video transcribed | seconds | none (401, always) | 10 min **once, ever** | 60 min / day | UTC midnight (Premium); the trial never resets | `YTAI_FREE_TRIAL_SEC`, `YTAI_FREE_SEC_PER_DAY`, `YTAI_PREMIUM_SEC_PER_DAY` | yes — bucket `ytaisec:<UTC day>`, charged at request length |
| `energy` — game challenge rounds | rounds | none (401) | 5 / day / programme | no cap | UTC midnight | `WM_FREE_ENERGY`, `backend/wm-game.js` | yes — DO buckets + HMAC round tickets |
| `savedShadow` — saved shadow videos | items | no cloud saves | 2 | 100 | none | `PLAN_LIMITS`, `index.html` | no — a storage cap, not a spend |
| `youtubeImports` | items | unavailable | 1 | 20 | none | `PLAN_LIMITS` | no |
| `polishHistory` — Polish reports kept | items | unavailable | 1 | 50 | none | `PLAN_LIMITS` | no |
| `savedClips` — marked clip ranges | items | no cloud saves | 1 | 30 | none | `PLAN_LIMITS` | no |
| `advanced_progress` — 30/90-day analytics | capability | no | no | yes | — | `CAPABILITIES`, `entitlement-core.js` | yes — hard lock |
| `recommended_content` — personalised Home rows | capability | no | no | yes | — | `CAPABILITIES` | yes — hard lock |
| `ad_free` | capability | no | no | yes | — | `CAPABILITIES` | yes |
| Being heard — transcribe, TTS, captions, Polish rewrite, practice chat | — | none (401) | unmetered | unmetered | — | abuse ceilings only: `ACCT_PER_MIN` 30 / `ACCT_PER_DAY` 600 | account required; no allowance |
| Practice Partner — queue, matching, invites, sessions, live, AI coach | — | none | unrationed | unrationed | — | `BURST_PER_MIN` 60/min, `IP_PER_MIN` 300; `SAFETY_LIMITS` report 5 / block 20 per day | yes, and **General English only** via `accountTrack()` |

`savedShadow` and `savedClips` are **not** duplicates: the first counts saved
videos, the second marked ranges inside a video. The proposal's "Saved shadow
clips" and "Saved clips" rows map onto them one for one, so no consolidation was
needed and no storage model was added.

## 2. How a limit is decided and spent

Unchanged by this work; recorded here because the proposal asked for it.

- **Tier.** `capabilities()` in `backend/polish-worker.js` sends the caller's
  Firebase ID token to be-entitlements `GET /v1/entitlement`. Premium requires
  `plan === "premium" && paid === true && ad_free`. A client-sent tier, counter
  or uid is never read. An unreachable service answers 503 — never a guess.
- **Identity.** The counter subject is the uid out of the token Firebase already
  verified, falling back to the token hash, so a malformed token gets a limit
  rather than a pass.
- **Concurrency.** `consume()` against the `RateLimiter` Durable Object — one
  global instance per subject, one request at a time, all-or-nothing across the
  buckets a request needs.
- **Failure and cancellation.** The quota is spent before validation and the
  provider call, and **refunded** on any answer ≥ 400 (`settle` →
  `release` in `backend/rate-limit.js`), so a 400, a 413 or a provider failure
  costs the learner nothing.
- **Duplicates.** `AI_DEDUPE=1` → one identical metered request in flight per
  caller, 409 `duplicate_in_flight`. Game rounds are idempotent by round id.
- **Across devices.** The counter is per account in one Durable Object, so two
  phones share it.
- **Reset.** UTC midnight, server-defined, returned as `resetAt` and rendered in
  the learner's own time zone by `allowResetText()`.
- **Cost, separately from actions.** `backend/ai-guard.js` tracks route class,
  audio and video duration, provider, estimated cost, failures and retries into
  Analytics Engine (`AI_LEDGER` / `be_ai_ledger`, caller HMAC-salted, no
  content), with a per-IP and global anonymous USD pool. The action count is not
  the cost control; this is. Prices in it are **unverified estimates**.

## 3. The proposal, row by row — and why no number changed

The proposal's own two rules decided most of this: *"Keep existing limits where
they are more restrictive"* and *"not permission to silently reduce an existing
allowance"*. Four further conflicts were put to the owner on 22 Oct 2026 and
answered; those answers are recorded as D1–D4.

| Proposed | Status | Reason |
|---|---|---|
| Saved shadow clips 2 / 100 | **Already exact** | `PLAN_LIMITS.savedShadow` |
| YouTube imports 1 / 20 | **Already exact** | `PLAN_LIMITS.youtubeImports` |
| Polish history 1 / 50 | **Already exact** | `PLAN_LIMITS.polishHistory` |
| Saved clips 1 / 30 | **Already exact** | `PLAN_LIMITS.savedClips` |
| 30/90-day analytics — Premium only | **Already exact** | `advanced_progress` |
| Personalised recommendations — Premium only | **Already exact** | `recommended_content` |
| Advertising — preserve current configuration | **Preserved** | not touched |
| Curriculum, recorder, phrase bank, Foundations | **Already as described** | never gated |
| AI speaking verdicts, Free 3 / day | **Already exact** | `VERDICTS_FREE_PER_DAY` |
| Personal YouTube, Premium 60 min / day | **Already exact** | `YTAI_PREMIUM_SEC_PER_DAY` |
| Practice Partner — account required | **Already exact** | `accountTrack()` |
| **Visitor** — 5 AI actions, 2 verdicts, 1 video, 10 min TTS a day | **Not adopted (D1)** | Owner rule, 1 Oct 2026: an AI route needs an account. `ytai` is the one route that spends real money per call, and its per-account cap is the only thing between a pasted video list and a real bill. Adopting this would create the exposure §4 of the proposal exists to prevent. Owner confirmed 22 Oct 2026: keep the account requirement |
| **Practice Partner** — 3 match requests + 2 sessions a day | **Not adopted (D4)** | Owner rule, 23 Sep 2026: there is no daily practice quota, and "You've reached today's limit" must never appear for practising. Human practice costs nothing per call. Owner confirmed 22 Oct 2026: leave it unrationed. Abuse is held per minute instead |
| **AI verdicts, Premium 30 / day** | **Not adopted (D2)** | A 75% cut for subscribers who are already paying. 120 stands |
| **Captions and TTS 10 / 30 / 120 min a day** | **Not adopted (D2)** | `TIERS.md` §1 sells being heard as unmetered; metering it is a store-disclosure change, not a configuration one. Abuse ceilings still apply |
| **AI transcription / chat / Polish / TTS, 5 / 15 / 200 combined** | **Not adopted (D2)** | Same reason. The expensive half of these — the verdicts — is already metered separately |
| **Personal YouTube, Free 10 min a day** | **Not adopted** | Free gets 10 min **once ever** today (`YTAI_FREE_TRIAL_SEC`), so 10 min *a day* is an **increase**, not a cut. The stricter existing value stands under the proposal's own rule |
| **Shadow Studio 3 / 10 / 50 sessions a day** | **Not adopted** | No such quota exists, so any number is a new restriction on free practice. Shadowing's expensive part — the AI report — is already metered under `verdicts`; the rest is local work, and the curriculum is never gated |
| **Games 3 / 10 / unlimited rounds a day** | **Not adopted** | Free is 5 a day (`WM_FREE_ENERGY`). 10 is more generous, so the more restrictive existing value stands. Premium already has no cap |

**D3 — platform scope.** Every quota above is enforced in Cloudflare Workers that
Android, iOS and the web all call. A server-side limit cannot be scoped to
Android without trusting a client-supplied platform field, which the proposal
forbids. Owner decision, 22 Oct 2026: enforce on all platforms, and ship the new
UI through the shared web layer that the Android app bundles. **No file under
`mobile/ios/` was touched.**

## 4. What this branch actually changed

| File | Change |
|---|---|
| `index.html` | `METERS` + `meterFigures()` / `meterCount()` / `meterHTML()` — the usage-indicator card. CSS `.meter*` beside `.ai-allow`. 14 `meter.*` strings in `I18N_EN`. `entUnconfirmed()` / `entUnconfSet()` plus a 503 branch in `aiAllowTap()`. Mounted at **four** points, each above the control that spends the allowance: the Executive Polish card (`exIdleHTML`), the session record card (`rSession`, after `aiAcctNoticeHTML("session")`), the Shadow Studio report card (above `fbFromRec()`), and the paste-a-link box (`#shAddBox`, before Load) |
| `i18n/*.json` (15) | the 12 keys, append-only. fr / es / pt translated; the other 12 carry the English text, as the project does for new keys. **ar / bn / hi / ja / ko etc. are untranslated and flagged** |
| `tests/usage-meters.mjs` | 20 checks (new) |
| `tests/package.json` | `test:meters`, and the suite added to `test:premium` |

The card shows: feature name, used against the allowance, a progress bar, the
reset in local time, one sentence of why, and the action that follows. It holds
**no limit numbers** — every figure is the server's own, read from
`X-BE-Allowance` / `X-BE-Video-Allowance` by `aiAllowTap()`. It renders nothing
unless `entGated()`, and nothing before the server has answered once: an
invented "3 of 3" would be a guess. A subscriber at the fair-use ceiling is
shown no offer, and the ceiling is never called "unlimited".

States, each of which shows something true or nothing at all:

| State | What the card does |
|---|---|
| Not gated (`billing_enabled` off, or no service) | nothing |
| No server answer yet | nothing — an invented "3 of 3" would be a guess |
| Mid-allowance | count, bar, reset in local time, one line of why |
| Quota exhausted | `.out`, "Limit reached", the ungated curriculum first, then the offer |
| Premium | "Premium access", fair-use wording, **no offer** |
| One-off trial | named as a trial, no reset claimed |
| Plan unconfirmed (503 `entitlement_unavailable` / `auth_unavailable`) | last known figures, labelled out of date, **no offer** |
| Offline | last known figures, labelled as the last count received |
| Window lapsed | nothing — it never announces a reset it was not told about |

`aiAllowHTML()` was already in the file with **zero call sites** — dead code
written for this purpose and never mounted. It is left alone rather than
removed, because other work may be mid-flight against it.

## 5. Verified production behaviour (22 October 2026)

Established by probing the live Workers read-only and by reading
`backend/polish-prod/deployed.js`, the committed copy of the deployed code.
**`wrangler` is not installed on this machine and no Cloudflare API token is
set, so deployed version ids and bound secrets could not be read.** Everything
below is behaviour and artefact evidence, not console evidence.

### 5.1 The three records do not actually disagree

They describe three different things, and reading `backend/wrangler.toml` as
"the production config" was the mistake:

| Record | What it describes | Accurate? |
|---|---|---|
| `backend/polish-prod/wrangler.toml` + `deployed.js` + `entry.js` | **what production runs** | yes |
| `docs/PREMIUM-LAUNCH-READINESS.md` "Phase C prepared, NOT switched on" | the server half of Phase C | yes |
| `backend/wrangler.toml` `[vars]` with `PREMIUM_ENFORCED="1"` | the **full** `polish-worker.js` build, not production | yes, but it shares the Worker name `be-polish`, so a deploy from `backend/` would overwrite production and switch Phase C on in one step |

### 5.2 What is actually enforced in production

`deployed.js` contains **zero** occurrences of `premiumGate`, `VERDICT_CAPS`,
`verdictAllowance`, `X-BE-Allowance`, `PREMIUM_ENFORCED`, `ENTITLEMENTS_URL` or
`YTAI_FREE_TRIAL_SEC`. Its only ceilings are **per IP**: `AN_PER_DAY` 150
(`analyse`), `ASSESS_PER_DAY` 400, `CHAT_PER_DAY` 500, `STT_PER_DAY` 600,
`YTAI_PER_DAY` 25 videos, `YTAI_WIN_PER_DAY` 150 windows. There is no
`verdict:`, `acct:` or `ytaisec:` bucket and no per-account ceiling of any kind.
`entry.js` adds the game route and the anonymous policy (`ANON_AI_POLICY =
"enforce"`); production carries no `PREMIUM_ENFORCED`.

Live probes, 22 Oct 2026: production answered `400` to an unauthenticated
metered request where **staging answered `401 auth_required`** for the identical
body — different code, confirmed. `be-entitlements` production and
`entitlements.lomonec.com` both answer `401` without a token, so the entitlement
service is deployed and reachable.

| | Published by the app | Enforced in production |
|---|---|---|
| Free AI verdicts | 3 a day | **not metered** — per-IP only, up to `AN_PER_DAY` 150 |
| Premium AI verdicts | 120 a day (fair use) | **not metered** |
| Free video minutes | 10 min once (client copy) / 30 min a day (`TIERS.md`) | **no per-account cap** — account required, then per-IP 25 videos a day |
| Premium video minutes | 60 min a day | **not metered** |

### 5.3 The discrepancy this creates

The live bundle is `be12-v690` with `billing_enabled: true` and
`ENT_API = "https://entitlements.lomonec.com"`, so `planOn()` is true and
**Premium is on sale**. The paywall's comparison table states Free 3 verdicts a
day and Premium 120, from `VERDICTS_FREE` / `VERDICTS_PREMIUM` in `index.html`.
The server counts neither. Every learner therefore receives **more** than
published, which is the safe direction for the learner and a disclosure problem
for the store listing, not a security one.

It also means **the usage meters are inert in production**: no deployed route
sends `X-BE-Allowance`, so `aiAllowTap()` never writes `be_ai_allow`,
`aiAllowance()` is null and `meterHTML()` returns `""` at all four mount points.
That is the designed behaviour — it never invents a figure — but it means the
new UI cannot be seen in production until the full Worker is deployed, and it
can only be reviewed on staging.

### 5.4 Cost exposure worth the owner's attention

`CLAUDE.md` states that ytai's "per-account cap is the only thing standing
between a pasted video list and a real bill". That describes the repo, not
production: the deployed code requires a verified Firebase account for ytai
(`verifyIdToken`, J1) but holds it **per IP**, at 25 videos a day. One account
moving between IPs is not bounded by an account cap, because there is none
deployed.

## 6. Known gaps, unchanged by this work

1. **`docs/TIERS.md` §1 is wrong about Free video minutes.** It says 30 min a
   day; with enforcement on, the code gives 10 minutes once ever. Already noted
   in `ACCESS-MATRIX.md` §5.2 and still not fixed. A store-listing claim
   question, so the owner's to settle.
2. **`chat` cannot be fully protected**: its system prompt is client-supplied, so
   `purpose` gates the app's own flows, not a determined caller. Closing it means
   moving the prompts server-side.
4. **be-polish has no programme check** — the AI routes are shared tools by the
   26 Sep 2026 "shared tool, scoped data" rule. Track isolation for them is the
   client's.
5. `be-push` `/wake` compares `PUSH_SECRET` with `!==`, not a constant-time
   comparison (`ACCESS-MATRIX.md` §5.4).
6. The anonymous cost ledger's **prices are unverified estimates**.
7. **Deployed version ids and bound secrets were not read** — no `wrangler` and
   no Cloudflare API token on this machine (§5).
8. **No device or emulator run.** Both debug APKs build; neither was installed
   or launched, and no Free / Premium / visitor flow was exercised on a device.
9. **The meters cannot be reviewed in production** (§5.3) — only on staging,
   where the full Worker sends `X-BE-Allowance`.

## 7. Before any of this is enabled

- Turning `PREMIUM_ENFORCED` on caps every existing free learner at 3 verdicts a
  day with no notice, and drops Free video to a once-ever 10-minute trial. Both
  are reductions against **today's unmetered production behaviour** (§5.2), not
  only against the published numbers. That is the lock-out case; it needs a
  migration or announcement decision from the owner first.
- **Do not `wrangler deploy` from `backend/`.** It carries the same Worker name
  and `PREMIUM_ENFORCED="1"`, so it is the Phase C switch, not a routine deploy.
  Production is deployed from `backend/polish-prod/`.
- Order matters: be-entitlements must answer **before** `PREMIUM_ENFORCED` is
  set, or every AI call answers `entitlement_unavailable`. It does answer today
  (§5.2), so step 3 of the runbook in `backend/wrangler.toml` is the only one
  outstanding.
- Rollback is one step: `billing_enabled` off.
- `sw.js` is at `be12-v690`; the cache and `APP_VERSION` must both be bumped
  before any deploy of this branch. They were deliberately left alone.
