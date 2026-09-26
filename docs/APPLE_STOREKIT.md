# Apple in-app purchase: StoreKit 2 bridge, server and test plan (2026-09-26)

Branch `release/premium-integration`. This covers what is **built and
tested** and what is **still blocked** on Apple-side access. **No device,
Sandbox or TestFlight test has run**: this Mac has no Xcode, no iOS SDK and
no signing identity.

## How it fits together
```
StoreKit 2 (device)
  └─ BEStoreKitPlugin.swift (Capacitor plugin "BEStoreKit", registered by BEBridgeViewController)
       └─ window.BENativeBilling  ← beNativeBilling() in index.html
            └─ BillingProviders.storekit → Billing (the same object Google Play uses)
                 └─ be-entitlements: POST /v1/purchases/verify | /restore   (Apple JWS verified, appAccountToken checked)
App Store Server Notifications V2 → POST /v1/billing/app_store                 (JWS verified, UUID de-duplicated)
```
- Nothing on the device decides the plan. The Worker derives it from Apple's
  **signed** transaction and renewal info, verified against the pinned Apple
  Root CA - G3.
- The provider-neutral model (purchase_links → entitlements → the view) is
  unchanged. Apple is one more provider next to Google Play.

## Native bridge (mobile/ios/ios/App/App)
| File | What it does |
|---|---|
| `BEStoreKitPlugin.swift` | These plugin methods: `getProducts`, `purchase`, `currentEntitlements`, `restore`, `pendingTransactions`, `finish`, `manageSubscriptions`, plus the `transaction` event. |
| `BEBridgeViewController.swift` | `CAPBridgeViewController` plus `registerPluginInstance(BEStoreKitPlugin())`. Used by `SceneDelegate` and `Main.storyboard`. |
| `BEMastery.storekit` | Local StoreKit configuration for Xcode testing only: one group, both products at level 1, a 3-day free trial on monthly. |

What the plugin does:
- **Products:** only `premium_monthly` and `premium_annual`. For each it
  returns the price, currency, period (ISO) and the trial, but the trial
  **only when `isEligibleForIntroOffer`**.
- **Purchase:** `product.purchase(options: [.appAccountToken(token)])`. The
  token comes from the server (`GET /v1/purchases/account-token`).
  - A verified transaction returns its JWS, plus the renewal-info JWS of the
    same subscription.
  - User cancelled → `{cancelled}`. Ask to Buy → `{pending}`.
- **Finishing:** a transaction is finished **only after our server answered**
  (`finish`). If our server was unreachable, it stays unfinished and comes
  back at the next launch through `pendingTransactions`.
- **Updates:** `Transaction.updates` starts at plugin load. Each verified
  update (renewal, Ask to Buy approval, refund, upgrade, purchase on another
  device) is sent as a `transaction` event and **held until the web layer
  listens**.
- **Restore:** `AppStore.sync()`, run only from a tap, then
  `Transaction.currentEntitlements`.
- **Manage:** `AppStore.showManageSubscriptions(in: scene)`, Apple's own sheet.

**Checked here:** `swiftc -typecheck` against the macOS StoreKit SDK in Swift
5 mode, with stand-in Capacitor types. It passes with no warnings.
**Not checked:** the iOS build itself (no iOS SDK) and the iOS-only
`showManageSubscriptions` branch.

## Web layer (index.html)
- **`beNativeBilling()`** builds `window.BENativeBilling` from
  `Capacitor.registerPlugin("BEStoreKit")`, and only inside the App Store app.
- **`BillingProviders.storekit`** carries the store's price, period and trial
  to the Premium sheet, as Google Play does. It returns `{pending}` for Ask to
  Buy, finishes a transaction only on a definite server answer, and
  `listen()` sends updates and unfinished transactions to
  `/v1/purchases/restore`.
- **`Billing.buy`**: pending → "payment pending", and no Premium until the
  store confirms.
- **Account deletion:** a paying learner is told the store subscription is
  **not** cancelled and where to cancel it.
- **Unchanged:** the Subscription card, Manage subscription and the Premium
  sheet (with the EULA link on iOS) work unmodified with the App Store as the
  provider.

## Server (backend/entitlements)
Already in place from Phase 9, and still tested:
- JWS chain verification with the pinned root, Apple's marker OIDs, validity
  and the ES256 signature;
- the `appAccountToken` HMAC binding;
- the environment allow-list (`APPLE_ENVIRONMENTS`);
- grace (`gracePeriodExpiresDate`), revocation, the trial (`offerType 1` →
  `trialing`) and renewal status;
- Notifications V2 with `notificationUUID` de-duplication;
- REFUND and REVOKE; binding through the `appAccountToken` when Apple reports
  first.

Added in this workstream:
- **Upgraded transactions:** an `isUpgraded` transaction is ignored (the new
  one holds the plan). As proof it is refused with 409 `superseded`.
- **Wrong environment:** a notification for the other environment is
  acknowledged (200) and changes nothing, instead of 422, which made Apple
  retry for days.
- **Out-of-order notifications:** an older transaction that arrives late
  cannot roll an active plan back. The comparison uses the transaction's own
  expiry, so a grace record still accepts the end of its grace.
- **Staging config:** `APPLE_ROOT_SHA256` is set in `[env.staging.vars]` as
  the public fingerprint of AppleRootCA-G3.cer (from apple.com).

## Tests
- `backend/entitlements/test/billing.mjs`: Apple A1–A28, run with openssl.
- `tests/ios-storekit.mjs`: the StoreKit path end to end in a browser, with a
  fake plugin whose transactions are signed by an openssl chain and verified
  by the real Worker.

## What remains blocked, in order
1. **A Mac with Xcode 26 and the Lomonec LLC team:**
   - build;
   - fix any compile issue the macOS type-check could not see (UIKit, the
     Capacitor module);
   - run on a device with `BEMastery.storekit`.
2. **App Store Connect:**
   - Paid Apps agreement, tax and banking;
   - the group and products in `mobile/ios/appstore/SUBSCRIPTIONS.md`;
   - the Notifications V2 URLs.
3. **Sandbox:** a Sandbox Apple ID, then the matrix in
   `mobile/ios/appstore/SUBSCRIPTIONS.md` and below: purchase, trial,
   renewal, expiry, cancel, refund, restore, reinstall.
4. **TestFlight:** bump the build, archive, upload, internal testing.

## Sandbox / TestFlight test matrix (to run on a device)
| # | Test | Expected |
|---|---|---|
| 1 | Products load | $4.99 / month (3-day trial if eligible), $19.99 / year; Annual first |
| 2 | Monthly purchase with trial | Premium, state trialing; the card shows Premium · Monthly |
| 3 | Annual purchase | Premium; renews in a year (sandbox: accelerated) |
| 4 | Trial eligibility | a second trial on the same Sandbox Apple ID is not offered |
| 5 | Restore on a second device | "1 restored", Premium |
| 6 | Manage subscription | Apple's sheet opens |
| 7 | Renewal (sandbox accelerated) | expiry moves on; notification DID_RENEW received |
| 8 | Cancel auto-renew | Premium until expiry, "Ends on …" |
| 9 | Expiry | Free after the period; notification EXPIRED |
| 10 | Refund (sandbox refund request) | revoked → Free |
| 11 | Reinstall | the launch reconcile (`currentEntitlements`) restores Premium silently |
| 12 | Other BE Mastery account on the same Apple ID | "belongs to another BE Mastery account" |
| 13 | Ask to Buy | "payment pending", then Premium after approval |
| 14 | Server Notifications | staging Worker records them; a repeat UUID is ignored |
| 15 | Offline purchase | not finished; confirmed at next launch |
