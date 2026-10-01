# Welding Premium — one subscription, two tracks

> **HISTORICAL RECORD — not the current contract.** This document describes the
> capability set as it stood when it was written, including
> `ai_verbal_feedback`, which was **removed from the contract on 1 October 2026**
> (advertised on the paywall, enforced at zero call sites, while TTS is free
> because the natural voice reads *content*). The live contract is
> `docs/release/FREE_PREMIUM_CAPABILITY_MATRIX.md`. Nothing below has been
> edited — it is kept as evidence of what was true at the time.

Date: 30 September 2026
Branch: `feature/premium-launch-final`
Base: staging v602 (`e1c9c0bc`), merged with session 42's `a235fa16` (v603)

**Status: READY FOR REVIEW — NOT MERGED, NOT DEPLOYED.**
No production Worker was deployed, no production flag changed, `origin/main`
untouched at `1589ff0c`, nothing force-pushed, no other branch deleted.

---

## 1. Premium architecture

| | |
|---|---|
| ONE BE Mastery Premium subscription | yes |
| ONE StoreKit product offered | `premium_annual` (`premium_monthly` honoured, never offered) |
| ONE subscription group | yes — so ONE trial per Apple ID across both tracks |
| ONE Premium entitlement | yes — `entView()` from `be-entitlements`, account-level, no track term |
| BOTH tracks use it | yes |

**The change is one condition.** `entGated()` was
`planOn() && isGeneralEnglish()`; it is now `planOn()`. A second condition there
would have been a second Premium. `premOffered()`, the App Setup plan card, the
Subscription card and the launch offer dropped the same test.

There is **no** `weldingPremium`, `generalEnglishPremium`, `weldingHasPremium`,
`welding_premium` product or Welding trial anywhere — asserted by test 14 on
identifiers and test 16 on the StoreKit file itself.

Because every Welding AI path already went through `aiOff()`, removing that one
condition is what switched them on. No new AI call site was added.

## 2. General English

Unchanged. `PLAN_LIMITS_TRACK` carries a **Welding** row only, so General
English keeps the numbers it had. Regression results in §7.

## 3. Welding — free vs Premium, as built

| capability | Free | Premium | gate |
|---|---|---|---|
| Curriculum, lessons, practice | full | full | none |
| **Microphone, recording, playback, replay** | **full** | full | **none — deliberately never gated** |
| Shadow **video library** | **full** | full | **none — never withheld** |
| Saved Shadow videos | **1** | 100 | `PLAN_LIMITS_TRACK.welding` |
| Saved Shadow clips | **1** | 30 | `PLAN_LIMITS_TRACK.welding` |
| Local result, self-evaluation | full | full | none |
| Workshop / interviewers' report | full (computed on device) | full | none |
| AI speaking analysis, `assess`, `analyse` | locked | full | `ai_analysis` |
| Speaking reports, workshop AI report | locked | full | `ai_analysis` |
| Shadow Challenge grading | locked | full | `ai_analysis` |
| Simulation answer analysis | locked | full | `ai_analysis` |
| AI verbal feedback | locked | full | `ai_verbal_feedback` |
| 30/90-day analytics, trends, long record | preview | full | `advanced_progress` |
| Recommended content | preview | full | `recommended_content` |
| Ads | shown when `ads_enabled` | none | `ad_free` |

**The Free model holds:** the interviewers' report, the competency engine, the
simulation engine, the answer evaluator and the skills passport make **no
network call at all** (`grep -c fetch` = 0 on each), so a Free Welding learner
still speaks, records, listens, replays and gets a real local result. Only the
AI layer waits.

**Welding Progress** now draws the 30/90-day panel. It reads `areaDayLog()` and
`areaFbHist()`, which are already per-area, so a Welding learner sees **their
Welding record** — one subscription, separate evidence. Locked, the real figures
are drawn dimmed under the offer; nothing is deleted and no graph is removed.

## 4. Professional context

Session 42 landed the ten-profession overlay while this work was in progress,
and it **closes a gap this branch had found and documented**: before it, the
Shadow catalogue sorted videos into ten professions while only three (welder,
pipefitter, boilermaker) had a trade overlay, so the other seven could change
the videos and nothing else.

| | |
|---|---|
| Profession list | the ten `WELD_PROFS`, one list |
| Overlays | **10 of 10** (was 3) |
| Set where | onboarding and the profile card (`profSet` / `profPick`); `weldProfSet` is the Shadow **filter** only |
| Standards | `professional-standards.js` registry → `Trades.standardsFor` → `profStandards(moduleId)` |
| Drives | workshops, questions, model answers, vocabulary, benchmarks, code chips, the report's "Assessed against" card, the AI rewrite prompt, the workshop character prompt |

This branch's own `weldProfTrade()` stopgap was **removed** in the merge: it
wrote the profession from the video filter, which is precisely the split their
design fixes. Their model is the one in place.

**No standard was invented here.** This branch added no ISO, ASME, AWS, API or
OSHA reference; the registry is session 42's and should be reviewed by them and
by a qualified professional before it informs anyone's hiring decision — the
caveat already at the top of `trades.js` still applies.

**The profession is context, not entitlement** — tests 36 and 37: changing
profession never grants or removes a capability, in either direction.

## 5. StoreKit

No second product, no second group, no second trial. `BILLING_PRODUCTS` is
unchanged and `BEMastery.storekit` still contains exactly `premium_annual` and
`premium_monthly` in one group. Purchase, restore, renewal, expiry, refund and
Ask-to-Buy are the v602 implementation, untouched.

## 6. Server-side security — what is actually enforced

**Nothing is server-enforced for Welding, or for General English, on staging.**

- `backend/polish-worker.js` has the entitlement gate on all 10 routes, but
  `PREMIUM_ENFORCED = "0"` and `ENTITLEMENTS_URL = ""`, so it is **off**.
- `be-polish` is a single Worker **shared with production**; deploying it is a
  production change and was not authorised, so it was not deployed.
- Therefore the Welding gates, like the General English gates, are **client-side
  only** today. A determined caller can still reach the AI Worker directly.
- The Worker gate has **no Welding track authorisation and no profession
  validation** — it checks account and capability only. Adding those is
  possible (the partner Worker's `TRACKS` is the precedent) but is not built.

## 7. Tests actually executed

Every number below was produced by running the suite on this merged branch.
Nothing is listed that was not run.

### New

| suite | result |
|---|---|
| `tests/welding-premium.mjs` — the shared-subscription proof | **37/37 PASS** |

### The Premium boundary

| suite | result |
|---|---|
| `tests/premium-boundary.mjs` | 45/45 PASS |
| `tests/premium-acquisition.mjs` | 40/40 PASS |
| `tests/billing-client.mjs` | 50/50 PASS |
| `tests/entitlement-client.mjs` | 46/46 PASS |
| `tests/ios-storekit.mjs` | 26/26 PASS |
| `tests/subscription.mjs` | 29/29 PASS |
| `tests/ads.mjs` | 50/50 PASS |
| `tests/monetization-qa.mjs` | 31/31 PASS (210 renders) |
| `backend/test-premium-gate.mjs` | 29/29 PASS |
| `backend/entitlements/test/run.mjs` | 61/61 PASS |
| `backend/entitlements/test/billing.mjs` | 100/100 PASS |

### Welding and track isolation

| suite | result |
|---|---|
| `tests/track-isolation.mjs` | 23/23 PASS |
| `tests/professions.mjs` (session 42's) | 164/164 PASS |
| `tests/welding-ai-report.mjs` | 20/20 PASS |
| `tests/welding-interview-report.mjs` | 14/14 PASS |
| `tests/workshop-voice.mjs` | 9/9 PASS |

### General English regression (§34 of the brief)

| suite | result |
|---|---|
| `tests/smoke.mjs` | 33/33 PASS |
| JS parse check, index.html | 4 scripts, 0 errors |
| i18n key parity, 15 packs | 3,353 keys, 0 missing, 0 orphan |

**No General English regression survives.** One was introduced and caught here:
gating the App Setup plan card on `premOffered()` removed it from General
English whenever billing is off — which is production today.
`monetization-qa` found it (1/31), and it was fixed in the **code**, not the
test; the suite is back to 31/31.

### BLOCKED — not run

| what | why |
|---|---|
| Real Apple purchase / restore / trial on device | needs Xcode and a sandbox Apple ID; not on this machine |
| Real Play Billing purchase | needs a Play Console internal-testing track |
| Server-side entitlement end to end | `be-polish` not deployed (§6) |
| Ads actually rendering | `ads_enabled` is false; wiring verified, no ad requested |

### A caution about these numbers

Four results in this session were **false** before they were right, every time
because a suite with a hard-coded port silently read another session's
worktree: `welding-premium` first reported 21/34, `premium-acquisition` 23/40,
`billing-client` a detailed failure of code that was correct. `welding-premium`
now refuses to run unless the served page is this tree, and the same guard
belongs in the others.

## 8. Known limitations — honest

1. **Server enforcement is off** (§6). The client gates are UX, not security.
2. **`ai_coach` gates nothing on Welding.** The capability is granted and
   checked, but its only call sites are Practice Partner's AI coach, which is
   General-English-only and which the brief explicitly says not to bring into
   Welding. Welding's coach-like surfaces (the interview coaches, simulations)
   are gated under `ai_analysis`. Wiring a distinct Welding AI Coach is not
   built.
3. **"One retained recording line" is not implemented.** No recording-retention
   cap exists in the codebase (`grep` for any take/recording cap returns
   nothing). Building it is new Shadow mechanics, not a gate around existing
   behaviour, so it was not attempted.
4. **"One Shadow Challenge clip" is not implemented**, for the same reason: no
   Challenge cap exists to gate.
5. **Ad-free is untestable in practice** because `ads_enabled` is false; the
   entitlement wiring is verified (tests 22, 24) but no ad is ever requested.
6. **Professions 4–10 were not exercised end to end by me.** Session 42 reports
   `professions.mjs` 164/164 locally and over the tunnel; I verified the
   registry answers and that codes differ per profession, not every workshop of
   every profession.
7. **No device testing**, and no real Apple purchase — that needs Xcode and a
   sandbox Apple ID, which this machine does not have.

## 9. Staging readiness

**Ready for staging, with one caveat.** The merged branch passes its own suite
and the General English regression (§7), and staging already runs v603 which
contains session 42's half. What this branch adds on top is the shared
entitlement.

The caveat: staging has `billing_enabled` **on**, so publishing this makes
Welding visibly gated for every staging learner the moment it goes up. That is
the intended behaviour and the point of reviewing it — but it is a visible
change to the Welding experience, not a silent one, and the owner should expect
it.

Not for production: `billing_enabled` stays false in `FLAGS_DEFAULT`, so
production sees none of this until the owner deploys `be-entitlements`, turns on
`PREMIUM_ENFORCED`, and ships the web bundle in the order in
`backend/wrangler.toml`.
