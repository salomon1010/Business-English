# Apple Sandbox — StoreKit 2 test checklist

Written for whoever runs the device pass on a Mac with Xcode and a Sandbox
Apple ID. **Nothing in this list has been run**: this machine has no Xcode and
no signing identity, so no Sandbox purchase has ever been made. Every row below
is untested until someone ticks it on a device.

## Before you start

| Prerequisite | State today |
|---|---|
| `billing_enabled` flag on for the build | **OFF** in `FLAGS_DEFAULT` and `FLAGS_IOS` — with it off there is no paywall to test |
| An entitlement service the app can reach | production `be-entitlements` is **not deployed** (404); staging is |
| `premium_annual` + `premium_monthly` in App Store Connect | **not entered** (`SUBSCRIPTIONS.md` is the set-up to enter) |
| Sandbox Apple ID | owner's to create (Users and Access → Sandbox Testers) |
| StoreKit config file for local runs | `BEMastery.storekit` (already in the project) |

Two ways to run these. **StoreKit configuration file** (Xcode → scheme →
Options → StoreKit Configuration) exercises the client only and needs no App
Store Connect entry — use it for rows 1–12. **Sandbox** (a real Sandbox Apple ID
on a device) is the only way to exercise Apple's servers and the notification
path, and needs the products entered first — rows 13–22.

## Client — StoreKit configuration file

| # | Case | Expected |
|---|---|---|
| 1 | Open the Premium sheet | One annual offer. Price, period and trial come from StoreKit, not from the app (`premOfferHTML`) |
| 2 | Price shown vs the config file | Matches `displayPrice` exactly; change the file, the app follows |
| 3 | Trial on a fresh Apple ID | "3 days free" badge, then `prem.then` naming the renewal price |
| 4 | Trial on an Apple ID that already used it | No trial badge — `isEligibleForIntroOffer` is false, and the app never assumes |
| 5 | Buy the annual plan | Sheet completes, `appAccountToken` sent, server asked to verify, Premium appears |
| 6 | Cancel the purchase sheet | `{cancelled:true}`, no state change, no error toast |
| 7 | Ask to Buy / pending | `{pending:true}`; nothing granted; it arrives later through `Transaction.updates` |
| 8 | Kill the app mid-purchase | The transaction is unfinished; next launch offers it again (`pendingTransactions`) |
| 9 | Restore purchases | `AppStore.sync()` runs only on the tap; entitlement returns |
| 10 | Expiration (advance the clock) | Premium drops to Free at the next refresh; nothing deleted |
| 11 | Revoke / refund in the config file | Premium drops to Free; `state` reads `revoked` |
| 12 | Unverified transaction | Rejected client-side (`unverified`) and never sent to the server |

## Apple's servers — Sandbox

| # | Case | Expected |
|---|---|---|
| 13 | Buy with a Sandbox Apple ID | Purchase completes; `signedTransaction` posted to `/v1/purchases/verify`; server verifies the JWS chain to Apple's root and grants Premium |
| 14 | `APPLE_ENVIRONMENTS` | Must include `Sandbox` for a Sandbox test to verify (the staging Worker already does) |
| 15 | Renewal (Sandbox renews fast) | Premium stays; `expiresAt` moves out |
| 16 | Cancel in Manage Subscriptions | `renews:false`, Premium stays until `expiresAt` |
| 17 | Billing retry / grace | `state` reads `grace`, Premium still in force until the grace end |
| 18 | Refund (App Store Server Notification) | Premium ends; `state` reads `revoked` |
| 19 | Restore on a second device, same Apple ID | Premium appears without buying again |
| 20 | Buy on Apple ID A, sign into BE Mastery account B | The `appAccountToken` binds the transaction to the buying account — B must not get Premium |
| 21 | Offline during purchase | No grant; the transaction stays unfinished and is retried at the next launch |
| 22 | Entitlement service unreachable | Nothing granted on a guess; the app says so and retries (the server fails closed) |

## What "done" means

A row is ticked only when it was observed on a device or in the simulator, with
the outcome written next to it. Do not mark a Sandbox row from a StoreKit
configuration-file run: the configuration file never talks to Apple, so it
cannot prove verification, notifications, renewal or refund.
