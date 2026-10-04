# Premium launch — Phase 1/2 audit (before any change)

> **HISTORICAL RECORD — not the current contract.** This document describes the
> capability set as it stood when it was written, including
> `ai_verbal_feedback`, which was **removed from the contract on 1 October 2026**
> (advertised on the paywall, enforced at zero call sites, while TTS is free
> because the natural voice reads *content*). The live contract is
> `docs/release/FREE_PREMIUM_CAPABILITY_MATRIX.md`. Nothing below has been
> edited — it is kept as evidence of what was true at the time.

Date: 30 September 2026
Base: `origin/main` @ `1589ff0c` (the live 1.2.0 web release, `sw.js` = `be12-v489`)
Branch: `feature/premium-launch-final` (new, from `origin/main`; nothing changed yet)

> The owner's own checkout `~/Documents/GitHub/Business-English` is on
> `feature/practice-partner` at `sw.js` `be12-v348` with 108 modified files —
> months behind live. Nothing in this audit was read from it.

---

## A. What currently exists

Everything in the brief's phases 4, 6, 8 and 10 already has an implementation in
`main`. It was built across Phases 7–11 and merged. The branches the brief
suspects (`release/premium-integration`, `feature/phase7-entitlements`,
`feature/phase9-native-monetization`, `feature/phase11-store-prep`,
`feature/premium-acquisition-ui`, `release/ios-appstore`) are **all ancestors of
`main`** — there is no unmerged monetisation work to recover. Only
`feature/monetization-ads-premium` has 10 unique commits, and it is 281 commits
behind.

| Layer | Where | State |
|---|---|---|
| Entitlement service (server) | `backend/entitlements/` — Worker, D1 migrations 0001–0004, `entitlement-core.js`, `app-store.js`, `google-play.js`, `firebase-auth.js`, `token-vault.js`, tests | Written, **never deployed**. `database_id = "REPLACE-WITH-D1-ID"` on purpose so an accidental deploy fails. |
| Entitlement client | `index.html` ~21940–22110 | `ENT_API`, `entView()`, `entSanitize()`, `entRefresh()`, `entIsPremiumForDisplay()`, `PLAN_LIMITS`, `planOn()`, `planLimit()`, `entEraseMe()`, `entNoteChange()` |
| StoreKit 2 (native) | `mobile/ios/ios/App/App/Plugins/BEStoreKitPlugin.swift` (245 lines) | Complete: `getProducts` with `isEligibleForIntroOffer`, `purchase` with `appAccountToken`, `restore` via `AppStore.sync()`, `currentEntitlements`, `pendingTransactions`, `finish`, `Transaction.updates` listener, `showManageSubscriptions` |
| Billing client | `index.html` ~22410–22600 | `BillingProviders.storekit` / `.play`, `Billing.init/buy/restore/reconcile/manage`, `billingApi()`, `billingTakeView()` |
| Paywall | `index.html` ~22610–22860 | `premiumOpen()`, `premSheetHTML()`, `premPlans()`, `premPlanHTML()`, `premFootHTML()`, `premLegalHTML()`, launch-offer delayed close |
| Ads | `index.html` ~22120–22380 | `AD_POLICY`, `AdEligibility` (plan + protected-context + frequency), `AdProviders` (none / mock / native bridge), `AdManager` |
| StoreKit test config | `mobile/ios/ios/App/App/BEMastery.storekit` | `premium_monthly` $4.99 + 3-day free trial; `premium_annual` $19.99, no trial |
| App Store Connect plan | `mobile/ios/appstore/SUBSCRIPTIONS.md` | Nothing entered in App Store Connect. Explicitly excluded from 1.1.0. |
| Tests | `tests/` | `entitlement-client.mjs`, `billing-client.mjs`, `ios-storekit.mjs`, `ads.mjs`, `premium-acquisition.mjs`, `premium-value.mjs`, `subscription.mjs`, `monetization-qa.mjs`, `track-isolation.mjs` — none in the default `npm test` chain |

## B. What is already working

- The **entitlement chain is sound in design**: provider → `adapters.js` →
  D1 row → pure `entitlement-core.resolve()` → a VIEW with no ids in it. The
  client treats the VIEW as display only and caches it outside `S`, so a
  Firestore merge can never restore a plan.
- **StoreKit 2 is genuinely complete**, not a stub. Restore goes
  `AppStore.sync()` → `Transaction.currentEntitlements` → signed JWS →
  `POST /v1/purchases/restore` → server verifies against a pinned Apple Root
  CA - G3 → the server's view decides. There is no
  `restoreButtonTapped → premium = true` anywhere.
- **Renewal, expiry, cancellation, refund, Ask-to-Buy and billing retry** are
  all handled: `Transaction.updates` listener, `pendingTransactions` replay, a
  launch `reconcile()`, `entRefreshSoon()` on foreground, `grace` state,
  `entNoteChange()` analytics.
- **Offline and failure states are honest**: a purchase the store took but our
  server never confirmed finishes as `"unknown"` so StoreKit offers it again,
  and the message says "not confirmed", never "failed".
- **Ad protection is thorough**: `AdEligibility.protectedReason()` blocks ads
  during a live microphone, recording, TTS, a live partner call, AI voice, a
  simulation, Executive Polish, any dialog, and on every protected view.
- **Track isolation holds**: `premOffered()` requires `isGeneralEnglish()`;
  Premium is not offered on Welding and the partner Worker's `TRACKS` refuses
  other tracks with 403.

## C. What is incomplete

1. **Nothing is switched on.** `ENT_API = ""`, `billing_enabled: false`,
   `ads_enabled: false` in `FLAGS_DEFAULT` *and* `FLAGS_STAGING`. `planOn()` is
   therefore false everywhere, `premOffered()` is false, and the paywall is
   unreachable in production. No learner has ever been shown a price.
2. **`be-entitlements` has never been deployed.** No D1 database, no
   `ADMIN_TOKEN`, no `APP_ACCOUNT_SECRET`, no `PLAY_TOKEN_KEY`. Staging has a
   D1 id but is also undeployed.
3. **Nothing is entered in App Store Connect** — no subscription group, no
   products, no prices, no introductory offer, no server-notification URL. The
   paid-apps agreement, tax and banking status is unknown from here.
4. **No Terms of Use page.** `PREM_TERMS_URL = ""`. On iOS the paywall falls
   back to Apple's standard EULA, which satisfies 3.1.2, but there is no
   BE Mastery terms page.

## D. What is incorrectly implemented (against the brief)

1. **The paywall offers two competing plans.** `premPlans()` returns annual +
   monthly and `premSheetHTML()` renders them as a radio group with a "BEST"
   badge, a "save N%" chip and a per-month breakdown. The brief wants **one**
   offer.
2. **The trial is on the wrong product.** `BEMastery.storekit` and
   `SUBSCRIPTIONS.md` put the 3-day free trial on `premium_monthly` ($4.99) and
   give `premium_annual` ($19.99) no trial. The brief wants the 3-day trial on
   a **$24.99 annual**. This is an App Store Connect change first; the repo
   files must follow.
3. **The price in the plan is $19.99, not $24.99.** Correctly, the app never
   hard-codes a price — every figure comes from `Billing.products`. But the
   documented and simulated product is $19.99.
4. **Premium promises the wrong things.** `premBenHTML()` / `premCmpHTML()` sell
   storage limits — 100 saved Shadow videos, 20 YouTube imports, 50 Polish
   reports — plus ad-free. The brief's Premium is AI analysis, AI verbal
   feedback, advanced progress, 30/90-day analytics, AI Coach and ad-free.
   These do not overlap at all.
5. **No AI feature is gated.** All 16 `entIsPremiumForDisplay()` call sites
   gate: the plan card, ad eligibility, the paywall itself, the Profile row,
   the App Setup section, and the Progress "Your record" history card
   (`pgRecordLocked`). **Not one gates an AI path.**
6. **The AI Worker has no authentication at all.** `backend/polish-worker.js`
   checks an `Origin` allow-list and an IP rate limit, and nothing else — no
   Firebase token, no entitlement call. It serves: audio transcription
   (Whisper), `assess` (pronunciation scoring), `analyse` (fluency/grammar),
   `mvreport` (the speaking report), `chat` (role-play, AI coach, workshop,
   interviewer report), `tts` (natural voice) and `captions`. A free learner —
   or anyone with `curl` and a forged `Origin` header — can call every paid AI
   route directly. This is the single largest gap in the brief.
7. **Home recommendations are not gated and are off in production anyway.**
   Home V2 (`homeV2On()` → `NudgeEngine.rank` / `.rows`, the "Because you…"
   rows and the hero highlight reel) is behind `home_v2_enabled`, which is
   `false` in `FLAGS_DEFAULT` and **`true` in `FLAGS_IOS`** — so the App Store
   build ships it. Nothing in it checks a plan.

## E. What must change

| # | Change | Where |
|---|---|---|
| E1 | One annual offer; drop the plan chooser, the BEST badge and the save chip from the sheet | `premPlans`, `premPlanHTML`, `premMainHTML`, `premFootHTML` |
| E2 | 3-day trial on annual at $24.99 | App Store Connect (owner), then `BEMastery.storekit`, `SUBSCRIPTIONS.md` |
| E3 | Capability API — `hasEntitlement('ai_analysis' \| 'ai_verbal_feedback' \| 'advanced_progress' \| 'ai_coach' \| 'ad_free')` over the existing `entView().capabilities` | `index.html` entitlement block |
| E4 | Gate every AI analysis path on the client, keeping the practice and the local/offline result intact | ~20 `POLISH_API` call sites |
| E5 | Server-side entitlement check on every paid `be-polish` route | `backend/polish-worker.js` + a shared secret or Firebase verify |
| E6 | Premium benefit copy rewritten to the six real capabilities, in 16 languages | `prem.*` keys, `I18N_EN`, `i18n/*.json` |
| E7 | 30/90-day progress behind the gate with a real preview, not an empty chart | Progress view |
| E8 | Home recommendation: visible, explained, thumbnail shown; the action gated | Home V2 rows |
| E9 | Tests for all of the above, and the monetisation suites added to `npm test` | `tests/` |

## F. What can be reused unchanged

`entitlement-core.js` and the whole `backend/entitlements/` chain; the Swift
`BEStoreKitPlugin`; `Billing` and both providers; `billingApi`/`billingTakeView`;
`AdEligibility`/`AdManager`/`AdProviders`; `entRefresh`/`entRefreshSoon`/
`entNoteChange`/`entEraseMe`; the paywall's hero, legal foot, restore control
and every purchase state; `pgRecordLocked` as the pattern for E7.

## G. What must NOT be changed

- `PLAN_LIMITS` semantics — storage limits, never limits on practising.
- Any Welding behaviour. `premOffered()` stays behind `isGeneralEnglish()`.
- The `ENT_FREE` fail-closed default and `entSanitize()`.
- `finish("unknown")` on an unconfirmed purchase.
- `AdEligibility.protectedReason()` — the list of moments an ad may not appear.
- The `be-rem` cache exclusion in `sw.js`.
- The deliberately shared, never-split surfaces (App Setup, Help, About,
  profile identity, share/invite/rate).

## Free / Premium today, as built

**Free:** everything. Practice, curriculum, Shadow, Practice Partner, all AI
analysis, all AI feedback, the AI Coach, every graph, and no ads (because
`ads_enabled` is off).

**Premium:** nothing is sold, so nobody has it. Were it switched on today it
would grant storage headroom and ad-free — not the brief's list.

## Production risks found

| Risk | Detail |
|---|---|
| **R1** | `be-polish` is unauthenticated. Gating AI in the client alone would be cosmetic — and the OpenAI bill stays open to anyone. |
| **R2** | Entitlement is keyed to a Firebase uid. Sign-in is optional today, so gating AI on entitlement makes AI unavailable to signed-out learners. That is a product decision, not a bug. |
| **R3** | `FLAGS_IOS` turns Home V2 on for the App Store build only. Any Home gating must be verified with that flag on, or it will not be seen in a web check. |
| **R4** | `SUBSCRIPTIONS.md` documents $4.99/$19.99 with the trial on monthly. If App Store Connect is filled in from that file the offer will not match the brief. |
| **R5** | Turning `billing_enabled` on without deploying `be-entitlements` leaves `planOn()` false — the paywall still will not appear. Both are needed. |
