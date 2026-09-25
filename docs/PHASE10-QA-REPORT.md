# Phase 10 — Monetization + Product QA

Branch `feature/phase10-monetization-qa`, from Phase 9 (`df1fdba`).

**Scope.** The Phase 7 roadmap names this phase only as "Monetization +
Product QA". It came with no brief, so it was run as a QA pass over Phases
7–9 as one product. The pass found defects, fixed them and added tests. It
added no features.

**Status.** Nothing is live:
- `billing_enabled` and `ads_enabled` are OFF, and `ENT_API` is empty;
- no store credentials, products or prices are set anywhere;
- nothing is deployed, merged or pushed.

## Method

1. **Code read** of the purchase path, from the store sheet through our
   Worker to the view. The question was where money or access can be lost.
2. **Server tests** against the real Worker code on SQLite. Google, Apple and
   AdMob are played with real cryptography (`backend/entitlements/test/`).
3. **Browser tests** of the real app:
   - `tests/billing-client.mjs` drives the purchase flow against the real
     Worker in-process;
   - `tests/monetization-qa.mjs` is a display matrix.
4. **Mutation checks:** each new guard was removed once to confirm its test
   fails without it. This was done for the rate limit, the silent reconcile
   and placeholder breakage.
5. **Full regression** of the app suites.

## Defects found and fixed

| # | Where | Defect | Consequence | Fix | Test |
|---|---|---|---|---|---|
| 1 | app | Play took the payment, then our server could not be reached. The app told Play the payment **failed**, and nothing ever re-sent the purchase. | The learner pays and stays on Free. Play refunds an unacknowledged purchase after 3 days. | The app tells Play `"unknown"`, never `"fail"`. A new message says the payment is safe and not yet confirmed. A **silent reconcile** runs at sign-in or launch when the account is not Premium: it sends what the store says the device owns (Play `listPurchases`, StoreKit `currentEntitlements`), with no prompt, once per account per session. | C1, C2 · Q7–Q9 |
| 2 | app (iOS) | If the account-token request failed, `buy()` treated the error as a cancel. | The purchase silently did nothing. | A thrown error is "failed", with a message. The store sheet is never opened without the token. | C6 |
| 3 | app | The purchase message (for example "belongs to another account") survived a sign-out and sign-in as someone else. | Another learner saw the previous account's message. | `Billing.init()` resets state and note when the account changes. | C3 |
| 4 | app | Restore could run while the purchase sheet was open. | Two verifications ran at once, and the result depended on timing. | Restore is disabled, and does nothing, while a purchase is open. | C4 |
| 5 | app | The store returned no products (none set up in Play Console yet). | An empty area appeared with no explanation. | "Purchases are not available right now." | C5 |
| 6 | app | **Manage subscription** always opened the current device's store. | A Google Play subscriber in the iPhone app was sent to Apple's page. | Manage opens only the store that sold the plan. A plan from the other store is named instead ("managed in Google Play"). | C7, C8 |
| 7 | app | No renewal terms or legal links beside the offer. | Apple guideline 3.1.2 and the Play subscription policy require them, so this would be rejected at review. | One line under the offer: it renews until cancelled in {store}, and payment is taken by {store}. It links the Privacy policy and, on iOS, Apple's standard EULA. It shows only beside a real offer. | C9 · matrix |
| 8 | server | No request-size limit. | Unbounded bodies were read into memory. | `content-length` over 256 KB gets `413 too_large`. | Q1 |
| 9 | server | No rate limit on the purchase routes, and each call costs a Google or Apple API request. | One signed-in account could spend the app's store API quota. | 10 calls per account per minute on `verify`, `restore` and `account-token`, then `429 rate`, **before** any store call. A D1 counter in migration 0004. | Q2–Q6 |
| 10 | tests | The harnesses listed migrations by hand. | Phase 9's migration broke `ads.mjs` once. | All four harnesses apply every file in `migrations/`. | — |
| 11 | docs | The bridge comment said `restore()` is `currentEntitlements`. | A plugin written from it would restore without `AppStore.sync`, or sync without a tap. | Corrected in index.html and the ADR, and `currentEntitlements()` was added to the bridge contract. | — |

**Reviewed and not a defect.** The Arabic `pro.one_attempt` has no `{{n}}`.
It reads "one attempt" (محاولة واحدة), which is the correct Arabic singular.

## The display matrix (`tests/monetization-qa.mjs`)

The matrix renders **210 combinations**:
- **5 languages:** en, fr, ar (RTL), de (long words), ja;
- **3 widths:** 320, 390 and 1280 px;
- **2 themes:** dark and light;
- **7 states:** billing off, signed out, offer, "paid, not confirmed", cancelled but paid, grace, and a plan from the other store.

Every render must pass all of these checks:
- no page overflow, and the card stays inside the viewport;
- every button is at least 44 px tall, with its label not clipped;
- no raw key and no `{{placeholder}}` left in the text;
- the card is actually in the chosen language, and Arabic is right-to-left;
- note text meets WCAG AA contrast (4.5:1);
- the renewal terms appear exactly beside an offer;
- ads are allowed exactly when the plan is not Premium;
- the state shows the right controls;
- no JavaScript error.

A placeholder check also covers the whole app: every `{{var}}` in the 2,878
English strings survives in all 15 translation files. The only exception is
the Arabic singular noted above.

## What is NOT tested, and why

| Needs | What |
|---|---|
| **Play Console** | Products and prices, an internal-testing track, the service account, and the Pub/Sub RTDN subscription. Also real purchase tokens and the real Play sheet, including how it shows `complete("unknown")`. |
| **Xcode + TestFlight** | The StoreKit plugin (`BENativeBilling`, not written), sandbox purchases, `AppStore.sync`, and `Transaction.currentEntitlements`. |
| **Store sandboxes** | Real Google and Apple response shapes. The fakes are built from the documentation. |
| **Production configuration** | Worker secrets, the D1 id, migrations 0001–0004, the Apple root hash, AdMob SSV, `ENT_API`. |
| **The owner / legal** | `privacy.html` does not mention purchases or subscriptions, and there is no Terms page of our own. Both are Phase 11 content, not code. |

## Handover to Phase 11 (Store Preparation)

1. Privacy policy: a section on purchases (what the stores share, what we
   keep: the Play purchase token itself (kept to acknowledge and re-check the
   purchase; its SHA-256 is the lookup key), Apple's original transaction id,
   the product, the plan and its dates; all erased by account deletion). Decide whether to have our own Terms or rely on the store
   EULAs.
2. Play Console:
   - the two subscription products, `premium_monthly` and `premium_annual`;
   - their prices (the owner's decision);
   - an internal-testing track;
   - a new AAB with `playBilling`, targeting API 36 (see the release audit).
3. App Store Connect: the same two products, the StoreKit plugin, and a
   TestFlight build.
4. The Worker:
   - apply migrations 0001–0004;
   - set the secrets;
   - deploy;
   - set `ENT_API`;
   - then turn on `billing_enabled` for internal testers only (`?flags=`).
