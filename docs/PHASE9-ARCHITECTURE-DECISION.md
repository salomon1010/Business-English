# Phase 9 — Native mobile monetization: architecture decision

Branch `feature/phase9-native-monetization`, built on Phases 7 (entitlements)
and 8 (advertising). **Nothing is live:**
- `billing_enabled` and `ads_enabled` are OFF;
- `ENT_API` is empty;
- no store credentials, product ids or prices are configured;
- nothing is deployed, merged or pushed.

**Review status (2026-09-24):** the owner passed the iPhone test of commit
`d311874` (Safari preview of this branch). That test covers the web
behaviour on iPhone: the Premium card still reads "Coming soon", and it
stays that way with `?flags=billing_enabled` because Safari has no store
provider. The rest of the app showed no regression. It does NOT cover a real
purchase: StoreKit needs the Swift plugin, Xcode and TestFlight; Play
Billing needs a Play Console internal-testing track (§16, §17).

This document is also the LOMON EC architecture case study for billing. Each
major decision is written as an architecture decision record (ADR): Problem,
Context, Options, Trade-offs, Decision, Consequences, Future alternative.

---

## 1. Current architecture

```
┌──────────── clients ────────────┐        ┌──────── be-entitlements (Cloudflare Worker + D1) ────────┐
│ Web      app.lomonec.com (PWA)  │        │ firebase-auth  verified uid (RS256 ID token)             │
│ Android  TWA = Chrome → same web │──────▶ │ billing.js     provider interface                        │
│ iOS      Capacitor shell → web   │ HTTPS  │   google_play  subscriptionsv2 · acknowledge · RTDN       │
└──────────────────────────────────┘        │   app_store    JWS + x5c chain · Notifications V2         │
          ▲            ▲                    │   revenuecat   named slot (501)                           │
          │            │ purchase evidence  │ purchase_links  one row per store purchase, one owner     │
          │            └────────────────────│ entitlements    DERIVED per account (recompute)           │
          │ view: plan · state · startedAt  │ entitlement-core  resolve() → provider-neutral VIEW       │
          │ expiresAt · renews · source     │ rewards  start → network verifies (AdMob SSV) → claim     │
          └─────────────────────────────────└───────────────────────────────────────────────────────────┘
                      ▲                                         ▲                       ▲
                      │ Play Billing sheet                      │ RTDN (Pub/Sub push,   │ App Store Server
                 Google Play                                    │  Google OIDC)         │  Notifications V2 (JWS)
                                                           Google Play Developer API   Apple
```

- **Identity:** the Firebase Auth uid. Every learner route derives it only
  from a verified ID token.
- **The app:**
  - `entView()` is for display only;
  - `AdEligibility` is the only ad gate;
  - `Billing` is the only purchase flow;
  - `billing_enabled` guards all of it.

## 2. Why Android remains a TWA — ADR-9.1

- **Problem.** Premium on Android must be bought through Google Play Billing,
  and the app must learn about it reliably.
- **Context.** The Android app is a Bubblewrap TWA: Chrome showing
  app.lomonec.com, with no native code of ours. Chrome exposes Play Billing to
  web content inside a TWA through the **Digital Goods API** and **Payment
  Request** (`https://play.google.com/billing`), once the TWA is built with
  Play Billing enabled.
- **Options.**
  - (a) Keep the TWA and use Digital Goods and Payment Request.
  - (b) Rewrite Android as a Capacitor shell with the native Play Billing
    Library.
- **Trade-offs.**
  - (a) has no rewrite, one codebase, and the web deploy still ships Android.
    It is limited to what Chrome exposes: subscriptions, one-time products,
    `listPurchases`, `getDetails`. There are no native ad SDKs inside a TWA.
  - (b) has full native APIs and AdMob native ads, but means a second native
    project to build, sign and review, and web changes no longer ship alone.
- **Decision.** (a) Keep the TWA. It meets every Phase 9 billing requirement.
  No blocker was found.
- **Consequences.**
  - `playstore/twa-manifest.json` now has `"features": {"playBilling":
    {"enabled": true}}`. It takes effect only in the next AAB, which is not
    built.
  - Ads on Android can only be web ads (policy to confirm) or house ads. A
    native ad SDK is not possible there.
- **Future alternative.** A Capacitor Android shell. The client `Billing`
  layer already speaks to providers through one interface, so a native Play
  Billing bridge would be one more provider.

## 3. iOS architecture — ADR-9.2

- **Problem.** Premium on iOS must be bought with StoreKit (App Store rule
  3.1.1), and a web checkout is not allowed.
- **Context.** iOS is a Capacitor 8 shell with no plugins. This Mac has no
  Xcode, so nothing native can be built or run here.
- **Decision.** Keep the shell. Define the boundary the native side must
  fulfil and build everything that is not native:
  - **Client bridge contract** `window.BENativeBilling`: `getProducts(ids)`,
    `purchase(id, {appAccountToken})` → `{signedTransaction,
    signedRenewalInfo}`, `restore()`, `manageSubscriptions()`, and (Phase 10)
    `currentEntitlements()` — StoreKit's `Transaction.currentEntitlements`,
    which never prompts, used for the silent reconcile at launch; `restore()`
    is `AppStore.sync` and is only ever called from a tap. Documented at
    the BILLING block in index.html. It is honoured only when `IS_IOS_APP` is
    true.
  - **Server:** verification of StoreKit 2 signed transactions and App Store
    Server Notifications V2, fully implemented and tested with a real
    certificate chain generated in the tests.
- **Consequences.** The StoreKit plugin (Swift, `Transaction` /
  `Product.purchase(options: [.appAccountToken(uuid)])`) is **not written**.
  It must be added in Xcode (§17). Until then the storekit provider reports
  itself unavailable, and the Premium card shows "Coming soon".
- **Future alternative.** RevenueCat's Capacitor SDK in place of our own
  plugin. The server would take its webhook through a revenuecat adapter
  (ADR-9.5).

## 4. Apple billing flow

1. The app asks the server for this account's `appAccountToken`:
   `GET /v1/purchases/account-token`. It is an HMAC of the uid with
   `APP_ACCOUNT_SECRET`, shaped as a UUID v4, and recorded in `app_accounts`.
2. StoreKit sells the product with that token. It returns a **signed
   transaction** (JWS, ES256, `x5c` chain).
3. `POST /v1/purchases/verify {provider:"app_store", signedTransaction,
   signedRenewalInfo?}`. The server verifies:
   - the root's SHA-256 is in `APPLE_ROOT_SHA256`;
   - root → intermediate → leaf signatures are valid;
   - the intermediate carries OID 1.2.840.113635.100.6.2.1 and the leaf
     carries 1.2.840.113635.100.6.11.1;
   - every certificate is within its validity window;
   - the JWS signature is ES256 by the leaf;
   - `bundleId` matches and `environment` is allowed;
   - the product is known;
   - **`appAccountToken` equals this account's token**.
4. The purchase link `(app_store, originalTransactionId)` is bound to the
   account, and the entitlement is recomputed.
5. **App Store Server Notifications V2** (`POST /v1/billing/app_store`,
   `signedPayload`) are verified the same way. They carry
   `signedTransactionInfo` and `signedRenewalInfo`, and are applied once per
   `notificationUUID`. A purchase Apple reports before the app does binds
   through `app_accounts` (the appAccountToken names the account).
6. **App Store Server API** is not called in Phase 9. It is not needed to
   verify signed data, which carries its own proof. It is the tool for
   reconciliation: `Get All Subscription Statuses` for a nightly sweep, and
   `Get Transaction History` for support. It needs an ES256 JWT from an App
   Store Connect `.p8` key (§20).

## 5. Google billing flow

1. In the TWA, `getDigitalGoodsService("https://play.google.com/billing")`
   lists the products. **Titles and prices come from Play** (`getDetails`).
2. Payment Request (`supportedMethods: play billing`, `data.sku`) opens
   Play's sheet. The page receives a `purchaseToken`.
3. `POST /v1/purchases/verify {provider:"google_play", productId,
   purchaseToken}`. The server:
   - obtains an OAuth token as the service account (an RS256 JWT assertion);
   - calls `purchases.subscriptionsv2.get`;
   - maps `subscriptionState` and the line item's expiry to a record;
   - **acknowledges** the purchase if it is pending (Play refunds
     unacknowledged purchases after 3 days);
   - binds `(google_play, sha256(token))` to the account;
   - recomputes the entitlement.
4. The page completes Payment Request with `success` or `fail` according to
   the **server's** answer.
5. **Real-time Developer Notifications** arrive as Pub/Sub push
   (`POST /v1/billing/google_play`).
   - They are authenticated by Google's OIDC token (RS256 against Google's
     certs, `aud` = `RTDN_AUDIENCE`, `email` = `RTDN_SA_EMAIL`, verified) and
     the package name.
   - They are applied once per Pub/Sub `messageId`.
   - A subscription notification means "ask Google again": the server re-reads
     `subscriptionsv2`; the notification's own content is never trusted as
     state.
   - A **voided purchase** (refund or chargeback) revokes at once.
   - An **upgrade** (`linkedPurchaseToken`) supersedes the old link.

## 6. Entitlement Service — ADR-9.3 (why it belongs on our backend)

- **Problem.** Something must answer "is this learner Premium?" for every
  client and every server feature, the same way everywhere.
- **Context.** Purchases happen in two stores and later perhaps on the web.
  Paid features include future AI allowances, which are spent in Workers.
  Learners sign in with Firebase.
- **Options.**
  - (a) Each client asks its store and decides locally.
  - (b) A third party (RevenueCat) is the entitlement authority, read
    directly by clients.
  - (c) Our backend holds a provider-neutral entitlement per account, fed by
    verified store data.
- **Trade-offs.**
  - (a) is quick, but the client is trivially forgeable, cross-platform access
    is impossible (bought on Android, used on the web), and server features
    have no answer.
  - (b) solves cross-platform, but ties every feature check to a vendor's API,
    uptime and pricing. Server features would call a third party on every
    request.
  - (c) is more code to own, but it is one authority keyed by *our* account,
    usable by every client and Worker, with the stores' proof checked
    server-side.
- **Decision.** (c) `be-entitlements` is the authority for BE Mastery's
  **application entitlement**.
- **Consequences.**
  - Every paid capability must be checked where it is spent: in a Worker,
    against this service.
  - The client's copy is display only.
  - The Worker must be deployed and kept highly available. When it cannot be
    reached, the client keeps its last known view for display, and servers
    fail closed to Free.
- **Future alternative.** A managed entitlement vendor behind the same routes
  (ADR-9.5).

## 7. Provider adapter — ADR-9.4 (why provider details must not leak)

- **Problem.** Apple, Google and future providers describe the same fact
  ("paid until X") in incompatible ways.
- **Decision.** One provider interface (`src/billing.js`):
  - `configured(env)`;
  - `verifyPurchase(evidence, ctx)`;
  - `notification(req, ctx)`;
  - `afterBind(link, ctx)`.

  Each provider returns provider-neutral **purchase links**. The Worker binds,
  de-duplicates and recomputes the same way for every provider, and the VIEW
  is `{plan, paid, state, startedAt, expiresAt, renews, source,
  capabilities, ads}`.
- **Why.**
  - If the app knew "Google says SUBSCRIPTION_STATE_IN_GRACE_PERIOD", every
    screen, every Worker and the ad policy would need rewriting for each
    provider.
  - Here, adding a provider touches one file. The Premium UI, `AdEligibility`,
    feature checks and the client API do not change.
  - Store identifiers (tokens, transaction ids) never reach the client, so
    they cannot leak or be replayed from it.

## 8. Future RevenueCat option — ADR-9.5

- **Problem.** Store edge cases (family sharing, offer codes, price
  migrations, cross-grade chains) are laborious to own.
- **Why RevenueCat is an adapter, not the entitlement model.** If the app
  read RevenueCat's entitlements directly, BE Mastery's authorization would
  depend on a vendor's data model, availability and fees. As an adapter,
  RevenueCat becomes one more source of verified purchase links:
  - its webhook becomes `notification()`;
  - its subscriber lookup becomes `verifyPurchase()`;
  - the rest of the system does not notice.
- **Trade-offs.** Faster edge-case coverage and a dashboard, against a revenue
  share above their free tier, a third-party dependency and a second source
  of truth to reconcile.
- **Decision.** Not in Phase 9: no concrete technical reason emerged. The
  `revenuecat` slot exists (501) so the route and docs are ready.
- **Consequence.** Choosing RevenueCat later is a vendor decision, not an
  architecture change.

## 9. Ad architecture (unchanged from Phase 8)

Premium comes from the server entitlement and passes through
`AdEligibility` → **no ads** of any format. Free passes through
`AdEligibility` (flag → plan → format → context → protected state → caps)
→ `AdManager` → provider.

A purchase or restore updates the view, and `entApply` →
`AdManager.withdraw()` removes any ad on screen at once.

Rewarded ads:
- AdMob **server-side verification** is implemented: `GET
  /v1/rewards/verify/admob`, with an ECDSA P-256 signature over the query
  string checked against Google's published keys, a staleness check, and
  `custom_data` = our nonce.
- Replay is guarded by the UNIQUE `transaction_id`.
- A claim is single use, the start is capped per day, and Premium is refused.
- **Reward kinds stay disabled** because no metered Free resource exists yet.

## 10. Account binding — ADR-9.6

```
BE Mastery account (uid) ──1:N── purchase_links (provider, ext_id) ──derives──▶ entitlements (uid)
```

**Rules:**
1. A purchase is bound to the account that first presents it verified. The
   conditional upsert (`… WHERE purchase_links.uid = excluded.uid`) makes the
   first bind win atomically. Any other account gets **409
   bound_elsewhere**, and the owner is unchanged.
2. **Apple:** a transaction binds only if its `appAccountToken` equals the
   presenting account's token. The HMAC key is server-side, so a token cannot
   be forged or guessed. A transaction with no token cannot be claimed.
3. **Google:** a token must be one Google confirms for our package. It is
   stored as `sha256(token)` for lookup, with the token kept server-side
   (`secret_ref`) only to ask Google again. An arbitrary token is 404.
4. **Replays** of the owner's own verification are idempotent. Replays by
   anyone else are refused (rule 1).
5. **Switching account on a device** cannot move Premium. Restore under a
   different BE Mastery account is refused per purchase; the UI says "This
   purchase belongs to another BE Mastery account".
6. **Account deletion** erases the account's links, app account and
   entitlement. The store subscription is cancelled in the store, not by us.
   The buyer can then bind the purchase to a new account by restoring.
7. **Moving a purchase between accounts** on purpose is a support action
   (admin), never self-service.

## 11. Security

| threat | control | test |
|---|---|---|
| client claims Premium (localStorage, body, query, headers) | the view comes only from the server; learner routes read no plan fields | Phase 7 suites; G9 |
| forged / arbitrary Google token | verified with the Play Developer API; unknown → 404 | G6, G7, G8 |
| forged / other-app / sandbox Apple transaction | pinned-root chain, OIDs, validity, ES256, bundle, environment | A6–A11, A18 |
| stealing a purchase for another account | first-bind-wins; appAccountToken HMAC | G4, A3–A5, A19, B10 |
| forged provider notification | Google OIDC (aud + service-account email); Apple JWS chain | N1–N4, A18 |
| duplicate notifications / retries | `processed_notifications` (messageId / notificationUUID); rolled back on failure so the store retries | N6, A14 |
| race: two binds or two claims | single conditional statements | G4, R14 |
| refund / chargeback | voided purchase (Google), REFUND / REVOKE (Apple) → revoked → Free | N8, A16 |
| rewarded-ad abuse | server-verified completion, UNIQUE transaction, single-use claim, daily cap, Premium refused, stale-callback refusal | S1–S11, R1–R20 |
| leaking identifiers | the view has no tokens or ids; responses are no-store; `external_ref` / `secret_ref` never returned | G3, P6 |
| mock paths in production | mock reward verifier only with `MOCK_REWARDS=1`; mock ad provider only on localhost / staging | R4; Phase 8 |

Payment data: **none is stored.** No card, bank or payment credential ever
reaches BE Mastery. Stored: the purchase link (plan, product, status, dates,
renewal flag), `sha256(token)` plus the Google token (a store reference, not a
payment credential), and Apple's `originalTransactionId`.

## 12. Restore purchases

- **Google:** `listPurchases()` in the TWA → `POST /v1/purchases/restore
  {provider, items}`. Each item is re-verified with Google and binds under
  rule 1.
- **Apple:** `restore()` runs `AppStore.sync()` (it may ask for the Apple
  ID, so only from a tap), then returns `Transaction.currentEntitlements` as
  signed transactions → the same route. Each item must carry this account's
  appAccountToken.
- **Silent reconcile (Phase 10):** at sign-in / launch, when the account is
  not Premium, the app sends what the store says this device owns — Play's
  `listPurchases()`, StoreKit's `currentEntitlements()` — without any
  prompt, once per account per session. This recovers a purchase the store
  took while our server was unreachable, before Play's 3-day
  acknowledgement deadline.
- The response says only how many bound; it names no ids.

## 13. Cancellation

- **Google:** `SUBSCRIPTION_STATE_CANCELED` → Premium to expiry,
  `renews:false`.
- **Apple:** `autoRenewStatus = 0` (signedRenewalInfo, or a
  DID_CHANGE_RENEWAL_STATUS notification) → the same.
- The UI shows "Cancelled — Premium stays on until …".

## 14. Expiration

- `expires_at` is stored, and `resolve()` returns Free once the server clock
  passes it, even with no notification (lazy expiry).
- **Grace:** Google's IN_GRACE_PERIOD, or Apple's `gracePeriodExpiresDate` in
  the future. The result is Premium with state `grace` until the grace end;
  the UI says "Payment problem — …".
- **Google hold, pause or pending:** no Premium.

## 15. Refund / revocation

- **Google:** `voidedPurchaseNotification` → link revoked.
- **Apple:** REFUND or REVOKE, or `revocationDate` on a transaction → revoked.
- Either way the entitlement is recomputed immediately, so the learner is Free
  and ads return. The audit table records it.

## 16. Known platform limitations

- **TWA:**
  - no native ad SDK;
  - Digital Goods API only inside a TWA built with Play Billing, with the
    products created in Play Console;
  - Payment Request needs a placeholder total (Play decides the price);
  - no Play Billing on the plain web.
- **iOS:**
  - digital Premium must be sold with StoreKit;
  - the external-link and web-checkout entitlements are not assumed;
  - nothing native can be built on this Mac.
- **Web:** no provider; web subscriptions are a separate decision (§20).
- **Cross-platform:** a subscription bought on Android is honoured on web and
  iOS through the account. Apple requires that iOS also offers the purchase
  in-app, which it does through StoreKit.

## 17. Native work still required

| | where | what |
|---|---|---|
| iOS StoreKit plugin | Xcode (Mac with Xcode 26) | a Capacitor plugin implementing `BENativeBilling` with StoreKit 2; pass `appAccountToken`; listen to `Transaction.updates` and forward new transactions to `/v1/purchases/verify` |
| iOS AdMob (optional) | Xcode | a Capacitor AdMob plugin behind `window.BENativeAds` (Phase 8 contract); SSV callback URL = `/v1/rewards/verify/admob`; ATT prompt and consent |
| Android AAB | Bubblewrap | `bubblewrap update` with `playBilling` enabled → new AAB (`appVersionCode` 9), internal testing track |

## 18. Implementation dependencies

- **Play Console:**
  - subscription products `premium_monthly` and `premium_annual`, with prices
    set by the owner;
  - license testers;
  - RTDN topic → Pub/Sub push subscription to `/v1/billing/google_play` with
    OIDC auth;
  - a service account with the Android Publisher API.
- **App Store Connect:**
  - an auto-renewable subscription group with the same product ids;
  - Server Notifications V2 URL = `/v1/billing/app_store` (sandbox and
    production);
  - an in-app purchase key (`.p8`) for the Server API (later);
  - sandbox testers.
- **be-entitlements:**
  - D1 plus migrations 0001–0004 (0004, Phase 10: `rate_hits`);
  - secrets `GOOGLE_SA_JSON`, `APP_ACCOUNT_SECRET` and `ADMIN_TOKEN`;
  - vars `PLAY_PACKAGE`, `RTDN_AUDIENCE`, `RTDN_SA_EMAIL`, `APPLE_BUNDLE_ID`,
    `APPLE_ROOT_SHA256` (copied and checked from Apple PKI),
    `APPLE_ENVIRONMENTS`, `ADMOB_SSV_ENABLED` and `REWARD_KINDS_ENABLED`.
- **The app:** `ENT_API` set, then `billing_enabled` on for testers first.

## 19. Risks

1. **Real store payloads may differ from the fixtures** (fields, date
   formats, edge states). This must be proven in sandbox and internal testing
   before any real sale.
2. **Apple root fingerprint misconfigured:** every Apple purchase is refused
   (fail closed). It must be checked against Apple PKI.
3. **Worker downtime:** new purchases cannot be verified. The stores keep the
   purchase and restore recovers it. Play auto-refunds if acknowledgement is
   missing for 3 days, so the Worker must be up.
4. **Play auto-refund** if acknowledge fails repeatedly. It is retried on every
   verify and RTDN; monitor for unacknowledged purchases.
5. **Clock skew** in certificate validity checks (Worker clocks are
   reliable).
6. **Policy:**
   - web ads in a TWA (AdSense / Ad Manager terms);
   - iOS anti-steering rules;
   - consent (EU/UK, ATT);
   - Data Safety and privacy labels.
7. **Machine translation** of the purchase strings (fr/es/pt/ar translated;
   the other 11 fall back to English).

## 20. Open questions

1. **Prices, trials and introductory offers** per country. They are set in the
   consoles by the owner, never in code.
2. **Web subscriptions:** whether to sell on app.lomonec.com, and with which
   provider (Stripe, Paddle…). This would come through the same adapter
   layer.
3. **Nightly reconciliation** with the App Store Server API and Play
   (subscriptionsv2 for bound tokens).
4. **Family Sharing / offer codes** policy for iOS.
5. **Which Free resource a rewarded ad should extend**, which is needed before
   any reward kind is enabled.
6. **Android ads:** web network versus house ads versus a future Capacitor
   Android shell.
7. **Support tooling** to re-bind a purchase between accounts on request.
