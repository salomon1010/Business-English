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
| 12 | app + server | Found at the final gate. The verify granted Premium, but Google's **acknowledge** call failed: `acknowledge()` returns `false` and `afterBind` swallows it. The reconcile (defect 1) skipped Premium accounts, and a Play notification never ran `afterBind`. | Nothing retried the acknowledge. Play refunds and revokes after 3 days, so the learner loses a subscription they bought. | The reconcile runs once per account per launch whether or not the account is Premium; this is Google's own advice to check `listPurchases` on every launch. A Play notification for a bound purchase now runs `afterBind` too. The server never acknowledges twice, because `needsAck` comes from Google's own state. | Q10–Q13 · C10–C11 (Q11 and C11 failed before the fix) |

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
   keep: the Play purchase token itself (`secret_ref`; its SHA-256 is the
   lookup key; see "Stored Play token" below: no code reads it today), Apple's original transaction id,
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

## Stored Play token (`purchase_links.secret_ref`), reviewed at the final gate

> **Superseded by Phase 11** (`docs/PHASE11-STORE-PREPARATION.md` §3): the token is now sealed with AES-256-GCM and erased on revoke, supersede, expiry and deletion.

- **What and where.** The raw Play purchase token is stored in D1
  `purchase_links.secret_ref`. It is written by the verify, restore and
  notification routes (`bindLink`), and `COALESCE` keeps the first value.
- **Read by no code path.** Nothing selects `secret_ref`. `recompute()`
  does run `SELECT *`, but it copies only the plan fields. Every Google call
  (`subscriptionsv2.get`, `acknowledge`) uses the token that arrived in the
  same request, from the app or from Play's notification. The earlier line
  "kept to acknowledge and re-check" described a use the code does not have.
- **At rest.** D1 encrypts everything with AES-256-GCM (Cloudflare's platform
  encryption; there is no application-level encryption). Anyone with D1
  access on the Cloudflare account, `wrangler d1 export` or a Time Travel
  restore can read it.
- **Never leaves the server.** It is not in any response (tests G3, P6), not
  in the audit table, and not in any error code. The only `console.error` is
  the top-level catch. Every Google `fetch`, whose URL contains the token, is
  inside a try/catch that returns a code, so no URL reaches that log. No
  Workers observability or tail is configured.
- **Reuse if the database leaks.** The token alone cannot be used with Google:
  that needs our service-account key, a Worker secret that is not in D1.
  Against our own API, first-bind-wins means a stolen token only gets
  `bound_elsewhere`. The exception is a token whose account was deleted
  (`DELETE /v1/me` frees it; test P5): anyone holding it could claim a
  subscription that is still active.
- **Retention.** Account deletion removes the row. Superseded (upgrade),
  expired and revoked links keep the token indefinitely. D1 Time Travel keeps
  deleted rows restorable for 30 days (Workers Paid) or 7 days (Free).
- **Replay and idempotency.** Binding is first-wins and atomic (G4, G5), and
  Pub/Sub message ids are de-duplicated (N6). An acknowledged purchase is
  never acknowledged again (Q13).
- **Verdict.** It is not exposed, but there is no reason to keep it: nothing
  reads it. It was left unchanged at this gate, as instructed. The owner
  should decide one of these before billing goes live (Phase 11):
  1. stop storing it (write `NULL`), which removes the risk entirely; or
  2. keep it for a future server-side re-check job, and clear it when a link
     is superseded, revoked or expired. The privacy policy would then also
     have to state the Time Travel window.
