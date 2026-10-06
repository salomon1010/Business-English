# BE Mastery — the three tiers (the source of truth)

Owner's spec, 5 October 2026. Everything below is implemented on `staging`
(commit after this file's first version); what is still the owner's to do is
in §6. When code and this file disagree, this file wins and the code is wrong.

**Price:** Premium **US$2.99 a month** or **US$19.99 a year** (44% off the
monthly run-rate). Both plans are offered, annual first. One subscription,
the same capabilities on General English and Welding. Prices live in the
stores; the app shows what the store says and never a number of its own.

## 1. At a glance

| | No account | Free account | Premium |
|---|---|---|---|
| The 12-week programme, road map, daily sessions | ✅ | ✅ | ✅ |
| Recording yourself, playback, posture coach | ✅ | ✅ | ✅ |
| Shadow library + captions, text shadowing | ✅ | ✅ | ✅ |
| **Shadow translation + IPA** | ✅ | ✅ | ✅ |
| Phrase bank, progress calendar, Foundations | ✅ | ✅ | ✅ |
| **Being heard** (speech → text) | ❌ | ✅ unmetered | ✅ unmetered |
| Executive Polish AI rewrite | ❌ | ✅ unmetered | ✅ unmetered |
| Natural voice (TTS) | ❌ | ✅ unmetered | ✅ unmetered |
| Cloud backup & sync, multi-device | ❌ | ✅ | ✅ |
| Practice Partner + live calls (General English, 18+) | ❌ | ✅ unrationed | ✅ unrationed |
| **AI verdicts** — speaking reports / pronunciation / AI coach | ❌ | **3 a day** | **120 a day** (fair use) |
| **Your own YouTube videos** transcribed | ❌ | **30 min a day** | **240 min a day** (fair use) |
| 30- and 90-day analytics | ❌ | ❌ | ✅ |
| Personalised Home recommendations | ❌ | ❌ | ✅ |
| Ads (General English only) | Yes | Yes | None |
| Ads on Welding | None | None | None |

"Unmetered" means no allowance at all; the per-account abuse ceilings in the
Worker (30 a minute, 600 a day, every route) still stand underneath.

## 2. Tier 1 — no account at all

The whole app as a local product. The one AI route open to anonymous callers
is the Shadow transcript's translation and IPA (`CHAT_PURPOSE_ANON = {"shadow"}`),
held per IP. With enforcement on, every other AI route answers `401
auth_required`: no transcription, no speaking report, no pronunciation score,
no AI coach, no AI role-play replies, no Executive Polish rewrite, no YouTube
transcription. No Practice Partner (it needs an identity for safety). No cloud
sync. Sees ads on General English, because anonymous is Free.

## 3. Tier 2 — Free account

Everything above, plus cloud backup and sync; being heard free and unmetered
(transcription, the natural voice, library captions, the Polish rewrite);
Practice Partner in full with no daily quota; **3 AI verdicts a day** — one
speaking report, one pronunciation assessment, or one AI coach reply each,
resetting at UTC midnight and shown in local time; **30 minutes a day** of
the learner's own pasted YouTube video transcribed.

Storage: 2 saved Shadow videos · 1 YouTube import · 1 Polish report kept ·
1 saved clip — the same on Welding (the Welding 1/1/1 override is gone).

Hard-locked: the 30- and 90-day analytics (`advanced_progress`) and the
personalised Home recommendation rows (`recommended_content`; the heading
stays, the cards go, one offer bar replaces them).

## 4. Tier 3 — Premium

Everything, with no ads anywhere, plus **120 AI verdicts a day** and **240
video minutes a day** — fair-use ceilings against a compromised account, not
feature limits, and never called "unlimited" in any copy; 100 saved Shadow
videos · 20 YouTube imports · 50 Polish reports · 30 saved clips; the 30- and
90-day analytics and the long-term record; personalised recommendations on
Home; the AI coach (its replies count within the 120).

## 5. How it is built

| Rule | Where |
|---|---|
| Verdicts metered, not locked | `backend/polish-worker.js` — `VERDICT_CAPS`, `verdictAllowance`, the changed `premiumGate` (402 no longer occurs for `ai_analysis` / `ai_coach`); bucket `verdict:<UTC day>` in the RateLimiter DO; 429 `{error:"allowance", scope:"verdicts", limit, used, resetAt, plan}`; header `X-BE-Allowance` on every metered answer |
| Video minutes | same file, the ytai per-account block: bucket `ytaisec:<UTC day>` with `cost` = seconds (whole video 1800, a window its length), 1800 / 14400 a day; 429 `scope:"video"`; header `X-BE-Video-Allowance` |
| The tier | `capabilities()` returns `premium` from the entitlement view (`plan:"premium"`, `paid:true`, `ad_free:true`); anything else is Free |
| Client gates | `index.html` — `ENT_METERED`, `entLocked()` false for metered caps, `aiAllowance / aiAllowOut / aiAllowNote / ytAllowNote`, `aiAllowTap` in the one fetch wrapper beside `POLISH_API`; `aiOff()` adds "allowance spent"; `premLockHTML` draws the allowance card only when spent (no offer for a paying learner); `ppAiStart` tells and offers; `localStorage.be_ai_allow` / `be_yt_allow` (display only, never the gate) |
| Two plans | `premOffers / premOffer / premSaving / premPick / premOfferHTML` — annual first with the saving computed from the store's two prices |
| Ads | `adsTrackAllows()` returns `isGeneralEnglish()`; `premBenHTML` / `premCmpHTML` show the ad rows only where ads exist |
| Limits | `PLAN_LIMITS` for both programmes; `PLAN_LIMITS_TRACK` is empty |
| Copy | `prem.*`, `ai.allow_*`, `sh.cap_allow_*`, `sess.report_prem`, `sv.ch_*_prem` — the numbers named, "unlimited" nowhere |
| Tests | `backend/test-premium-gate.mjs` (92), `backend/test-rate-limit.mjs` (67), `tests/premium-boundary.mjs`, `tests/free-premium-contract.mjs`, `tests/welding-premium.mjs`, the ads suites (`tests/ads.mjs`, `ios-ads.mjs`, `ad-resume.mjs`, `ad-shadow-pause.mjs`) |

Day boundary: UTC midnight, deliberately — one moment for everyone, and the
app shows it in the learner's local time (`allowResetText`). The known
fixed-window burst (`backend/rate-limit.js` header) does not apply to the day
buckets, which are named after the day rather than started by the first hit.

## 6. What only the owner can do

1. **Set the prices in both stores:** App Store Connect `BEMastery_Annual`
   US$19.99 / year and `BEMastery_Premium` US$2.99 / month (the monthly plan is
   now offered, so it must be approved and available); Play Console the same
   two base plans. The app always shows the store's own `displayPrice`.
   Regional prices must be re-set for the new tiers. **Free trial: 3 days on
   both plans, both stores** (owner, 6 Oct 2026 — Apple has no 5-day option;
   3 days is the shortest both stores share): an introductory offer on each
   App Store product, a `trial3d` offer on each Play base plan.
2. **Switch Premium on when ready:** deploy `be-entitlements` (production D1
   exists, Worker not deployed), set `ENTITLEMENTS_URL` + `PREMIUM_ENFORCED="1"`
   on `be-polish` and redeploy it from `main` (the metering ships with it),
   set `ENT_API` and `billing_enabled` in the app, bump the cache. Staging
   has all of this on already.
3. **Ads:** `ads_enabled` stays off until AdMob exists (`docs/ADS-IOS-RELEASE.md`).
4. **Store listing copy** (`mobile/ios/appstore/METADATA.md`, Play listing)
   must describe Premium as above and never as "unlimited".
