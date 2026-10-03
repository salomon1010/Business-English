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

## The one product question the integration cannot answer

`premOffered()` decides whether Premium is offered at all:

- at the merge base: `(planOn() && isGeneralEnglish()) || entIsPremiumForDisplay()`
- in BASE B, and so in this candidate: `planOn() || entIsPremiumForDisplay()`

BASE B removed the General-English gate **on purpose**, in `184f3a0e`
*"ONE subscription across both tracks — Welding joins the entitlement"*, and
`tests/welding-premium.mjs` encodes that decision in 20 checks, including
*"WELDING is gated too — the boundary is no longer General-English-only"* and
*"the paywall is offered on Welding (one product, one sheet)"*.

The integration brief asks instead for **"Welding = no Premium offering"**. Both
cannot hold. The candidate keeps B's behaviour, because it is the deliberate,
documented, test-backed decision and reversing it would mean failing an existing
release suite. Restoring the gate is one line:

```js
function premOffered(){try{return (planOn()&&isGeneralEnglish())||entIsPremiumForDisplay()}catch(e){return false}}
```

…and would require `tests/welding-premium.mjs` to be rewritten to the opposite
rule. **This is the owner's decision, not the integrator's.**

**The ads rule is unaffected either way.** Welding is completely ad-free in the
candidate: `adsTrackAllows()` is `isGeneralEnglish()`, it throws closed, and it
is checked at 9 sites — in `AdEligibility.decide()` before any analytics event,
in `markBreak`, `interstitial`, `placeNative`, `rewarded`, in the native-slot
watcher and in the gate that builds the AdMob bridge at all.

## State

- Branch `integration/staging-rc`, three commits plus the merge, on top of
  `6960d6ab`. **Not pushed, not merged.**
- `ads_enabled` = false, `billing_enabled` = false, `ENT_API` = `""`,
  `PREMIUM_ENFORCED` = `"0"` in production, AdMob ids are placeholders.
- `npm run sync` run: root, `www/` and `ios/App/App/public/` `index.html` are
  byte-identical.
