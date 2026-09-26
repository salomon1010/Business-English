# Phase 11 — Store preparation (Google Play + App Store)

Branch `feature/phase11-store-prep`, from Phase 10 (`c3d03e2`). **Billing stays
OFF**: `ENT_API` is empty, `billing_enabled` is off, and `be-entitlements` is not
deployed. No Play Console or App Store Connect product exists, no credential has
been created, and nothing here was tested against a real store.

What this phase did in code:
- sealed the stored Play token and set its retention (§3);
- handled Play's "pending" purchases (§5);
- added tests.

Everything else here is a checklist or a test plan for the owner. Each real-store
row is marked **NOT RUN** until someone runs it on a real store and records the
evidence.

## 0. Current state (checked 2026-09-25)

| Area | State |
|---|---|
| Android | TWA `com.bemastery.app`, host `app.lomonec.com`. `playstore/twa-manifest.json`: `playBilling` enabled, target SDK 36, versionCode 8 (the next AAB must be ≥ 9). `.well-known/assetlinks.json` has both fingerprints. |
| iOS | Capacitor shell `com.bemastery.app`, iOS 15+ (`mobile/ios/`). **No StoreKit code, no In-App Purchase capability, and no `.entitlements` file.** The `BENativeBilling` bridge is a documented contract only (index.html, above `BillingProviders`). |
| Server | `backend/entitlements` (Worker + D1, migrations 0001–0004). Google and Apple adapters in `src/`. Not deployed; `database_id` is a placeholder. |
| Client | `Billing` / `BillingProviders` / `entPlanCardHTML`, behind `billing_enabled` (OFF) and `ENT_API` (empty). |
| Ads | `AdEligibility` / `AdManager`, `ads_enabled` OFF, mock provider only. |

**Prerequisite decision for any real Play test (owner).** Play Billing only runs
inside the Play-installed TWA, and that TWA always loads `app.lomonec.com`. On
that host `ENT_API` is empty, and `beEnv()` names no entitlement Worker, even on
staging. Before an internal-testing purchase is possible, one of these is needed:
- **(a)** an internal-testing AAB whose host is `staging.lomonec.com`, with
  `assetlinks.json` served there, and `beEnv()` given an `entitlements` URL for a
  staging `be-entitlements` Worker. This option keeps production untouched and is
  recommended.
- **(b)** production carries the billing code with `ENT_API` set, and
  `billing_enabled` stays off except through `?flags=billing_enabled` on the
  testers' devices.

## 1. Google Play

### 1.1 Play Console checklist (owner)

| # | Item | Notes |
|---|---|---|
| G-1 | Payments profile + merchant account active | Needed before any paid product |
| G-2 | Subscriptions `premium_monthly` and `premium_annual` | The ids must match `PRODUCTS` in `src/entitlement-core.js` exactly, or the server answers `422 not_our_product`. |
| G-3 | One auto-renewing **base plan** per subscription, prices per country | The server reads `lineItems[].productId` and `expiryTime`. Base-plan and offer ids are not used, so they can be added freely. |
| G-4 | Offers (free trial / intro price), optional | Google reports a trial as `ACTIVE`, and it shows as Premium. No code change needed. |
| G-5 | Grace period and account hold settings | Grace → Premium with "payment problem". Hold / paused → Free. Both are handled. |
| G-6 | Internal-testing track + tester list | Testers must install from the track's opt-in link. |
| G-7 | **License testers** (Setup → License testing) | Test cards, no charge. Test subscriptions renew on an accelerated schedule; check Google's current table before timing a test. |
| G-8 | New AAB: versionCode ≥ 9, `playBilling` on, target SDK 36 | `bubblewrap update` then `build` (see CLAUDE.md). Needed for the Digital Goods API. |
| G-9 | Data safety form: purchase history | We keep product, plan, dates and a sealed purchase token (§3). |

### 1.2 Service account and API (owner)

1. In a Google Cloud project, enable the **Google Play Android Developer API**.
2. Create a service account and a JSON key → Worker secret `GOOGLE_SA_JSON`.
3. In Play Console → Users and permissions, invite that account's email, with
   at least "View financial data" and "Manage orders and subscriptions".
4. `PLAY_PACKAGE = com.bemastery.app`.

### 1.3 Real-time Developer Notifications (owner)

1. Create a Pub/Sub topic. Grant `google-play-developer-notifications@system.gserviceaccount.com`
   the Publisher role on it.
2. Create a **push** subscription to `https://<entitlements-worker>/v1/billing/google_play`
   with **authentication on**: a service account, audience = the push URL.
3. Worker vars: `RTDN_AUDIENCE` = that audience; `RTDN_SA_EMAIL` = the push
   subscription's service-account email.
4. Play Console → Monetization setup → set the topic, then press **Send test
   notification**. It must answer 200 (`testNotification`; tested in N10 with fakes).

The server checks Google's RS256 OIDC signature, issuer, audience, the
service-account email with `email_verified`, and the package name, **before**
reading anything (N1–N4). Duplicate Pub/Sub messages are applied once (N6).

### 1.4 Worker configuration checklist

| Name | Kind | Purpose |
|---|---|---|
| `database_id` | wrangler.toml | Replace the placeholder, then `wrangler d1 migrations apply --remote` (0001–0004) |
| `FIREBASE_PROJECT_ID` | var | `be-mastery` |
| `ALLOWED_ORIGINS` | var | `https://app.lomonec.com,capacitor://localhost` (+ staging for option (a)) |
| `GOOGLE_SA_JSON` | secret | §1.2 |
| `PLAY_PACKAGE` | var | `com.bemastery.app` |
| `RTDN_AUDIENCE`, `RTDN_SA_EMAIL` | var | §1.3 |
| **`PLAY_TOKEN_KEY`** | **secret** | **New in Phase 11** (§3): `openssl rand -base64 32` |
| `APPLE_*`, `APP_ACCOUNT_SECRET` | var / secret | §2.3 |
| `ADMIN_TOKEN` | secret | Owner grants only |
| `DEV_AUTH` | — | **Never set** outside local dev |
| observability traces | — | **Keep OFF.** Google API URLs carry the token. |

### 1.5 Flow as built (verified with fakes; NOT yet with Play)

- **Purchase:**
  1. The Payment Request sheet returns a `purchaseToken`.
  2. The app sends `POST /v1/purchases/verify`.
  3. The server calls `subscriptionsv2.get`, binds the purchase to the account
     (the first bind wins) and grants Premium.
  4. If Google reports the purchase as not yet acknowledged, the server
     acknowledges it.
  5. The app tells the sheet `success`. If the server could not be reached, it
     says `unknown`, never `fail`.
- **Acknowledgement** is server-side only. It happens only for a paid state
  (`active`, `grace`, `trialing`), and never twice (Q13, PP1). It is retried by
  the next launch's reconcile, and by any Play notification for a bound purchase
  (Q10–Q12, C10–C11).
- **Restore / revalidation:** `listPurchases()`, then `POST /v1/purchases/restore`.
  Google is asked again every time; nothing the client says about the plan is
  used (G9).
- **Pending payment (slow methods such as cash):** bound, no Premium, the view
  shows `payment_pending`, not acknowledged. Once paid, a notification or the
  next launch gives Premium and acknowledges it (PP1–PP3, C12–C13).

### 1.6 Real Play lifecycle test plan — **ALL NOT RUN**

Run on the internal-testing track with a license tester. Record for each row:
- the date;
- the device and Play Store version;
- the `subscriptionsv2` state (from the Play Developer API);
- our `GET /v1/entitlement` answer;
- the `entitlement_audit` rows;
- a screenshot of the Premium card.

| # | Step | Expected | Status |
|---|---|---|---|
| P-1 | Buy `premium_monthly` | Premium; card "Active until …"; `acknowledgementState` ACKNOWLEDGED within a minute; RTDN PURCHASED processed | NOT RUN |
| P-2 | Kill the app while the sheet is open, pay, reopen | Premium after the launch reconcile; acknowledged | NOT RUN |
| P-3 | Airplane mode right after paying | "Your payment went through…"; after reconnect and relaunch, Premium | NOT RUN |
| P-4 | Cancel in the Play subscription centre | "Cancelled — Premium stays on until …"; RTDN CANCELED | NOT RUN |
| P-5 | Let the test subscription expire | Free, "Your Premium has ended"; ads eligible again (flag permitting); stored token erased | NOT RUN |
| P-6 | Buy again (a new token) | Premium restored; the old link stays expired | NOT RUN |
| P-7 | Play Console: **refund with "remove entitlement"** | Voided RTDN → Free at once, state revoked, token erased. **Then relaunch the app and send a Play notification: must stay Free.** Record the `subscriptionsv2` state after the revoke. Phase 10 showed that if Google still reports ACTIVE, the next re-check restores Premium; this row decides whether a sticky revoke is needed. | NOT RUN |
| P-8 | Refund **without** removing entitlement | Google sends no voided notification for this. Premium continues to the paid expiry; confirm | NOT RUN |
| P-9 | Restore on a second device, same account | Premium | NOT RUN |
| P-10 | Restore signed in as another BE Mastery account | "This purchase belongs to another BE Mastery account", still Free | NOT RUN |
| P-11 | Upgrade monthly → annual | The annual link decides; the old link is expired and its token erased | NOT RUN |
| P-12 | Slow payment method, if offered to testers | "Your payment is still being processed…"; Premium only after payment | NOT RUN |
| P-13 | Grace: a test card that declines on renewal | "Payment problem — Premium stays on until …" | NOT RUN |

## 2. App Store

### 2.1 App Store Connect checklist (owner)

| # | Item | Notes |
|---|---|---|
| A-1 | Paid Applications agreement, banking, tax | Required before any IAP |
| A-2 | Subscription group with `premium_monthly`, `premium_annual` | The product ids must match `PRODUCTS` |
| A-3 | Localised display names, review screenshot, prices | |
| A-4 | App Store Server Notifications **V2** | Production URL `https://<worker>/v1/billing/app_store`; a separate sandbox URL (staging Worker) recommended |
| A-5 | Sandbox testers (Users and Access → Sandbox) | Accelerated renewals in sandbox |
| A-6 | App Privacy: "Purchases" data type | |
| A-7 | TestFlight build with the StoreKit plugin (§2.2) | TestFlight purchases are in the **Sandbox** environment |

### 2.2 Native work required (not written; needs a Mac with Xcode)

- The Xcode target needs the **In-App Purchase** capability.
- The Capacitor plugin `BENativeBilling` (Swift, StoreKit 2, iOS 15+) must
  implement **exactly** the contract documented in index.html:

| JS method | StoreKit 2 |
|---|---|
| `supports()` | `true` |
| `getProducts(ids)` | `Product.products(for:)` → `{id, title: displayName, displayPrice}` |
| `purchase(id, {appAccountToken})` | `product.purchase(options: [.appAccountToken(UUID(uuidString:))])` → on `.success(.verified(tx))` return `{signedTransaction: result.jwsRepresentation, signedRenewalInfo}`; `.userCancelled` → `{cancelled:true}`; `.pending` (Ask to Buy) → `{cancelled:true}` (it arrives later through `Transaction.updates`) |
| `restore()` | `AppStore.sync()`, then `Transaction.currentEntitlements` → `[{signedTransaction, signedRenewalInfo}]` (only from a tap: it can ask for the Apple ID) |
| `currentEntitlements()` | `Transaction.currentEntitlements` (silent; used by the launch reconcile) |
| `manageSubscriptions()` | `AppStore.showManageSubscriptions(in:)` |

- **Finishing transactions.** The plugin should call `transaction.finish()` after
  returning the JWS. This is safe, because the launch reconcile reads
  `currentEntitlements`, which lists finished transactions too.
- **`Transaction.updates`.** It should be listened to from launch.
  **Recommendation (a contract addition, owner's call):** a `transactionUpdated`
  event that the page answers with `/v1/purchases/verify`, so Ask to Buy and
  renewals made while the app is open are applied without waiting for a
  notification. Apple's V2 notifications cover it on the server in any case.

### 2.3 Server side (built; tested with a real X.509 chain made by openssl, not with Apple)

- **Binding:** `GET /v1/purchases/account-token` returns an HMAC of the uid
  (`APP_ACCOUNT_SECRET`). A transaction binds only if its `appAccountToken` equals
  the caller's token (A1–A5, A19).
- **JWS:** ES256 with the x5c chain, pinned to `APPLE_ROOT_SHA256`; the leaf and
  intermediate marker OIDs; certificate validity; bundle id; environment
  (A6–A11). **Set `APPLE_ROOT_SHA256` from Apple Root CA – G3, copied and checked
  at apple.com/certificateauthority.**
- **`APPLE_ENVIRONMENTS`:** `Sandbox` on the staging Worker, `Production` on
  production.
- **Notifications V2:** `DID_RENEW`, auto-renew off, grace, `REFUND` / `REVOKE`
  → revoked, de-duplicated by `notificationUUID` (A12–A18).
- **Restore:** A19. **Expiry:** by `expiresDate`.

### 2.4 Real App Store test plan — **ALL NOT RUN** (blocked on §2.2)

Rows A-P1 … A-P10 are the Play rows adapted to Apple:
- buy / kill mid-purchase / offline;
- cancel (auto-renew off);
- expiry;
- buy again;
- refund (a sandbox refund request) → `REFUND` → Free;
- restore on a second device;
- restore under another account → `account_mismatch`;
- Ask to Buy → pending, then approved.

Record for each row:
- the sandbox tester;
- the device;
- the `notificationType` received;
- our entitlement answer.

## 3. Play purchase-token security — decision and implementation

**Decision: B, a protected, encrypted database field, now implemented.** The token
is not simply deleted: a server-side re-check or acknowledgement without the app
(for example a future retry job for the 72-hour acknowledgement window) needs it.

| Topic | Policy (as implemented) |
|---|---|
| Protection at rest | `purchase_links.secret_ref` = `v1.<iv>.<AES-256-GCM ciphertext>`, key = Worker secret `PLAY_TOKEN_KEY`; row id `provider:ext_id` as associated data (`src/token-vault.js`). D1's own AES-256 at-rest encryption sits underneath. |
| No key configured | Nothing is stored (NULL). **Plaintext is never written.** Billing still works (V4). |
| Backend access | Only `be-entitlements` binds the database. `open()` is the one decryption path; no route calls it today. |
| Logging | Forbidden. There is no log statement on any path that holds the token, and Workers traces must stay OFF. |
| Client exposure | Forbidden. No response carries it (G3, P6); the client caches only the sanitised view. |
| Retention | Kept only while the purchase can still matter: active, grace, trialing, payment pending. |
| Supersession (upgrade) | The old link is expired and its token erased (V6). |
| Refund / revocation | The token is erased with the revoke (V5). |
| Expiry | Erased when Google reports it expired (V7). |
| Account deletion | The row is deleted (V8). |
| Backups | D1 Time Travel (30 days on Workers Paid) holds ciphertext only; the key is not in D1. Rows from before a deletion stay restorable for that window: state this in the privacy policy. |
| Key rotation | Old values stop opening; the next verify, restore or notification re-seals under the new key (V9). |
| Stored plaintext anywhere | None; every row of every table is scanned (V3, V10). |

## 4. Billing UI (provider-neutral), with the test that covers each state

Get Premium with the store's own titles and prices (B5) · signed out (B4) ·
billing unavailable / web (B1, B3) · no products (C5) · purchase pending on the
store sheet (C4) · **payment pending (C12, new)** · success (B8) · failure (B7) ·
"paid, not confirmed" (C1) · restore (B11, B12) · current entitlement (B8,
entitlement-client 9–10) · cancelled (B13) · grace (B14) · expired (B15) · a plan
from the other store (C7) · renewal terms and legal links (C9).

No platform token is shown or stored by the client. The display always follows
the server's view (entitlement-client 15, E5).

## 5. Pending purchases (fixed in this phase)

Google reports a slow payment method as `SUBSCRIPTION_STATE_PENDING`. Before this
phase, that mapped to `expired`, so after paying with such a method the card said
"Your Premium has ended" **and** "Premium is on. Thank you." at the same time.

Now:
- the status is `payment_pending` (not in force, never acknowledged);
- the card says "Your payment is still being processed…";
- the purchase message follows the server's view instead of always saying "success".

New string `acc.prem_payment_pending`: translated in fr, es, pt and ar, and in
English in the other 11 files (for native review).

## 6. Test taxonomy

| Kind | What | Where |
|---|---|---|
| Unit | Plan resolution, validation, rewards | `backend/entitlements/test/run.mjs` |
| Integration, fake providers | The real Worker on SQLite. Google, Apple and AdMob are played with real cryptography (a generated service account and OIDC key, an openssl X.509 chain, P-256 SSV) | `test/billing.mjs` |
| Browser, fake providers | The real app plus the real Worker in-process. The Digital Goods API / Payment Request are stubbed, and Google is faked | `tests/billing-client.mjs`, `entitlement-client.mjs`, `ads.mjs`, `monetization-qa.mjs` |
| Sandbox (Apple) | — | **none run** |
| Internal testing (Play) | — | **none run** |
| Real device | — | **none in Phase 11**; see §7 |

**No fake-provider test is a store test.**

## 7. Device validation checklist (owner, NOT RUN in Phase 11)

On an iPhone and an Android phone, dark and light:
- Free / Premium cards;
- purchase and restore entry;
- billing-disabled state;
- offline state;
- loading and pending states;
- the Premium → Free transition;
- no ads for Premium;
- keyboard, navigation and reduced motion.

With billing off, which is the only safe setting before §0's decision, the phones
can only show "Coming soon". The purchase states are reachable on a device only
through a local preview with the fake store. They mean something for the stores
only on the internal-testing / TestFlight builds.
