# The unified staging release candidate

2 October 2026. Written for whoever decides what ships. Nothing here is
deployed, pushed or merged: the candidate is the local branch
`integration/staging-rc`.

## Why this exists

Two development lines had diverged and neither was a superset of the other:

| | BASE A — `6960d6ab` (the `be-social` worktree) | BASE B — `feature/product-boundary-implementation` |
|---|---|---|
| Carries | Google + Apple sign-in, Apple revocation on deletion, the current Xcode project, `adsTrackAllows()`, the AdMob/UMP work | the newer Premium UI, server-side entitlement enforcement, the product boundary, 534 caption/content files, `professional-standards.js` |
| Commits unique to it | 9 | 94 |
| Contains all of `origin/main` | **yes** | **no — missing 6** |

Their merge base is `1589ff0c`, the 1.2.0 release that went live on 29
September.

## The base is BASE A, and the reason is not that it is newer

BASE B is missing six commits that are **live in production**:

```
51670064 chore(release): bump the service-worker cache for the Practice Partner fix
91ad35ca fix(practice-partner): restore how-it-works, and make the release QA tell the truth
fa580172 docs(release): the live production record for the ytai security fix
3a01b7e7 chore(release): bump the service-worker cache for the ytai security release
7da1d775 docs(release): corrected plan — WORKER FIRST, with the measured CORS evidence
a8b9b92f feat(security): ytai requires an account — the minimal release, on main
```

Basing the candidate on B would have silently reverted a shipped **security**
fix: anonymous `ytai` — the one route that spends real money per call — would
have become reachable again. So BASE A is the first parent, which also keeps the
candidate a descendant of `origin/main` (verified with
`git merge-base --is-ancestor origin/main HEAD`). Everything from B is merged in;
nothing from either line is dropped.

Only **7 files** conflicted at the committed level, and all but one cluster on
the same cause: both lines implemented the ytai account requirement
independently.

## What was reconciled, and how

| File | Resolution |
|---|---|
| `index.html` (4 hunks) | **Reconciled, not sided.** B's ytai comment wording; ONE `POLISH_API` const with a comment carrying both lines' facts and **no duplicate signing wrapper** — both sides had the byte-identical wrapper in different places, so B's 4-line comment was carried into the surviving copy; **both** new flags kept (`social_signin_enabled`, `billing_preview_provider`); the auth-gap comment merged from both. |
| `i18n/*.json` (15) | Union — both sides appended different keys. 3381 keys per file, no duplicates, all valid JSON. |
| `backend/polish-worker.js` | B's. It is a strict functional superset: it keeps `ytaiAccount` (verified before anything else, in both modes — stronger than main's) **and** adds `premiumGate`/`ROUTE_CAP` plus the Durable Object rate limiter. `ROUTE_CAP.ytai` is `null`, so ytai still needs an account and never a plan. |
| `backend/wrangler.toml` | B's, which contains A's `FIREBASE_PROJECT_ID` ytai var plus `global_fetch_strictly_public`, the `RATE_LIMITER` Durable Object and `PREMIUM_ENFORCED = "0"` / `ENTITLEMENTS_URL = ""` — production enforcement stays **off**. |
| `backend/test-polish-ytai.mjs`, `tests/shadow-transcript.mjs` | B's, so they match the worker that was adopted. |
| `sw.js` | `be12-v620` — ahead of production's `v491` and the Premium line's `v598`, so no client can keep a cache from either. |
| `mobile/ios/appstore/SUBSCRIPTIONS.md` | B's table, which matches the fixture the merge produced: annual **$24.99** carrying the 3-day trial, monthly $4.99 without, annual the only offer. |
| `docs/release/YTAI_RELEASE_PLAN.md` | A's — the **production record** ("DEPLOYED"), not B's unexecuted copy, plus a note that the adopted worker is now B's, so the next be-polish production deploy carries more than that record describes. |

`Info.plist`, `project.pbxproj`, `PrivacyInfo.xcprivacy`, `BEMastery.storekit`,
`privacy.html` and `tests/ads.mjs` auto-merged cleanly.

## One test was re-scoped, and nothing was weakened

`backend/test-ytai-auth.mjs` checks 8 and 9 asserted that *this Worker contains
no entitlement gate anywhere*. That was true when ytai shipped, because
server-side Premium did not exist yet; it is deliberately false of the worker
the candidate adopts. Deleting the checks would have left the real invariant
unguarded, so they now assert it directly instead:

- **8** — `ROUTE_CAP.ytai` is `null`, so an account is the whole requirement;
- **8b** — no plan-specific branch was added to the ytai handler;
- **9** — *behavioural*: with `PREMIUM_ENFORCED` ON and the entitlement service
  reporting a **Free** plan, an authenticated ytai call is not refused for
  payment.

The suite went from 18 checks to 19 and still passes in full.

## The one product question — ANSWERED by the owner, 2 October 2026

`premOffered()` decides whether Premium is offered at all:

- at the merge base: `(planOn() && isGeneralEnglish()) || entIsPremiumForDisplay()`
- in BASE B, and so in this candidate: `planOn() || entIsPremiumForDisplay()`

BASE B removed the General-English gate **on purpose**, in `184f3a0e`
*"ONE subscription across both tracks — Welding joins the entitlement"*, and
`tests/welding-premium.mjs` encodes that decision in 20 checks, including
*"WELDING is gated too — the boundary is no longer General-English-only"* and
*"the paywall is offered on Welding (one product, one sheet)"*.

An earlier brief asked instead for *"Welding = no Premium offering"*, which
cannot hold at the same time, so the candidate was left on B's behaviour and the
question was put to the owner.

**The owner's answer, 2 October 2026: ONE PREMIUM SUBSCRIPTION ACROSS BOTH
TRACKS.** Keep `premOffered() = planOn() || entIsPremiumForDisplay()` — do **not**
restore the General-English gate — and keep `adsTrackAllows()`
General-English-only. So:

| | Free | Premium |
|---|---|---|
| **General English** | ads allowed | available · **no ads** |
| **Welding** | **completely ad-free** | available · **completely ad-free** |

A Welding learner may buy Premium, and a Welding learner never sees an ad on any
plan. There is one subscription, one product pair and one subscription group
across both tracks; `tests/welding-premium.mjs` (42 checks) is the suite that
holds that, including that no welding-specific product, flag or entitlement
identifier exists.

Verified in a real browser on all four track/plan combinations, with
`ads_enabled` ON so that only policy could refuse an ad: General English Free is
the only case that gets one, both Premium cases are ad-free, and **Welding emits
no ad analytics at all on either plan** (`decide()` answers `track`, before any
event). `ENT_CAPS` equals the server's `CAPABILITIES` in the same order, and a
General English subscriber and a Welding subscriber are granted the identical
capability set.

**The ads rule is unaffected either way.** Welding is completely ad-free in the
candidate: `adsTrackAllows()` is `isGeneralEnglish()`, it throws closed, and it
is checked at 9 sites — in `AdEligibility.decide()` before any analytics event,
in `markBreak`, `interstitial`, `placeNative`, `rewarded`, in the native-slot
watcher and in the gate that builds the AdMob bridge at all.

## Correction, same day: the 12 "pre-existing" failures were a test-harness artefact

An earlier run of this candidate reported 12 failures in `premium-acquisition`,
`premium-value` and `premium-boundary`, and a control run of BASE B alone
reported the **same 12**, which looked like proof they pre-dated the
integration. They did not pre-date anything. Those three suites default to
ports **8097/8098**, and other sessions on this machine were holding them with
`python3 -m http.server` instances serving an **older checkout** — one whose
`index.html` still contains `ai_verbal_feedback`. Both runs silently tested a
foreign application. The BASE B control matched for the same reason, which is
why the failure sets were byte-identical.

Re-run on verified-free ports, with no change to any implementation or any test:

| suite | on the busy port | on a free port |
|---|---|---|
| `premium-boundary` | 43 pass / 4 fail | **47 / 0** |
| `premium-value` | 86 / 4 | **90 / 0** |
| `premium-acquisition` | 36 / 4 | **40 / 0** |
| `monetization-qa` | 31 / 0 *(invalid — wrong app)* | **31 / 0** |
| `subscription` | 29 / 0 *(invalid)* | **29 / 0** |
| `ios-storekit` | 27 / 0 *(invalid)* | **27 / 0** |

Six suites were affected, and a *pass* on a foreign server is no more
meaningful than a failure. Only some suites in this repository compare the
served `index.html` against the one on disk and refuse to run on a mismatch
(`auth-social` does, and it caught this). **Always pass an explicit free
`PORT`** — or add that guard to the rest — before trusting any suite that
spawns its own server.

Full result on free ports: **824 browser checks and 343 Worker checks, 0
failures.**

## State

- Branch `integration/staging-rc`, three commits plus the merge, on top of
  `6960d6ab`. **Not pushed, not merged.**
- `ads_enabled` = false, `billing_enabled` = false, `ENT_API` = `""`,
  `PREMIUM_ENFORCED` = `"0"` in production, AdMob ids are placeholders.
- `npm run sync` run: root, `www/` and `ios/App/App/public/` `index.html` are
  byte-identical.
- Verified on free ports: **824 browser checks + 343 Worker checks, 0 failures**
  (18 browser suites, 6 Worker suites). iOS builds clean in **Debug and Release**
  with Xcode 27 — GMA 12.14.0 and UMP 3.1.0 embedded as frameworks, all three
  plugins in the binary, Apple Sign-In entitlement present, bundle id
  `com.lomonec.bemastery`. `mobile/ios/scripts/check-release.mjs`: **PASS**, one
  environmental warning (`xcode-select` points at CommandLineTools; the builds
  ran against Xcode 27 through `DEVELOPER_DIR`, and archiving will need
  `sudo xcode-select -s`).
