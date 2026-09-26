# Phase 12A — Google Play internal-test preparation

Branch `feature/phase11-store-prep`. Nothing is uploaded, deployed or switched
on. Billing and ads stay OFF.

## 1. The Android update (built locally, not uploaded)

| Field | Value |
|---|---|
| Package | `com.bemastery.app` (unchanged: this is an update) |
| versionCode / versionName | **9 / 1.1.0** (live: 8 / 1.0.1) |
| compileSdk / targetSdk / minSdk | 36 / **36** / **23** (live: 36 / 35 / 21) |
| Play Billing | `androidbrowserhelper:billing:1.2.0` → Play Billing Library **8.3.0**; `PaymentActivity` + `PaymentService` in the manifest |
| Notification delegation | **on** (`enableNotifications: true`): Bubblewrap refuses Play Billing without it |
| TWA host | `app.lomonec.com` (production) |
| Built with | Bubblewrap **1.25.0** (npx; 1.24.1's template hard-codes targetSdk 35) |
| Signed with | the upload key `bemastery` from `playstore/android.keystore` (Play App Signing re-signs; the upload certificate is `3D:E6:6D…`, already in `assetlinks.json`) |

Four changes to `playstore/twa-manifest.json` produce this build:
- versionCode 9 / versionName 1.1.0;
- `playBilling` (from Phase 9);
- `enableNotifications: true`;
- **`minSdkVersion: 23`**.

### Owner decisions before upload
1. **minSdk 21 → 23 (drops Android 5.0–5.1 from updates).** Google requires
   Play Billing Library 8+ for app updates from 31 August 2026 (an extension to
   1 November 2026 can be requested). PBL 8 needs API 23.
   - Existing Android 5 users keep 1.0.1. Because the app is a TWA, they still
     receive every web update; they just cannot buy through Play.
   - New installs on Android 5 are no longer offered.
2. **Notification delegation on.** Web-push reminders appear as the app's own
   notifications, and Android 13+ asks for notification permission. Check the
   daily reminder on a device.
3. **targetSdk 36 (Android 16).** Android 16 ignores orientation locks on large
   screens (≥600dp). The app is locked to portrait, so check that it lays out
   correctly in landscape on a tablet.

### Rebuild recipe (owner machine)
1. Put the four `twa-manifest.json` changes into the `playstore/` project.
2. Run `npx @bubblewrap/cli@1.25.0 update --skipVersionUpgrade`.
3. Run `npx @bubblewrap/cli@1.25.0 build`. The global 1.24.1 would regenerate
   the project back to target 35. `build.expect` answers the prompts if its
   `spawn` line is changed to that command.

## 2. What the bundle can and cannot test

The bundle is a shell. The billing *logic* is the web app it loads. With host
`app.lomonec.com`, an internal tester sees today's production site: billing
code absent and `ENT_API` empty, so the Premium card says "Coming soon". So
**this bundle alone cannot run a real purchase.** One of these is needed:

- **(a) Staging (recommended, production untouched):** a second internal-test
  bundle whose host is `staging.lomonec.com`, pointing at the staging stack in
  §3. It takes versionCode 9 on the internal track, so the production update
  then becomes 10.
- **(b) Production web:** ship this branch's web code to `app.lomonec.com` with
  billing still OFF, set `ENT_API` to the production Worker, and turn billing on
  only on testers' devices with `?flags=billing_enabled`.

## 3. Staging stack — what exists, what is missing

| Piece | State |
|---|---|
| `staging.lomonec.com` | DNS + a cloudflared tunnel to port 8000 on the owner's Mac. **Down (530).** Port 8000 now serves an unrelated folder. When it was up, it served another session's `cert-main` worktree, not this branch. |
| `beEnv()` | Staging entry **added in Phase 12A**: `entitlements: https://be-entitlements-staging.nore-ngou.workers.dev` (events and partner were already there) |
| Entitlement Worker | **`[env.staging]` added in Phase 12A** in `backend/entitlements/wrangler.toml`: its own name, its own D1, `ALLOWED_ORIGINS=https://staging.lomonec.com`, `APPLE_ENVIRONMENTS=Sandbox`, no `DEV_AUTH`. **Not deployed; D1 not created.** |
| Events / partner staging Workers | Exist (`be-events-staging`, `be-partner-staging`). The billing event names are on this branch only (§5). |
| `assetlinks.json` on staging | In the repo; it must be served at `staging.lomonec.com/.well-known/assetlinks.json` |

### Owner steps to bring staging up (none executed)
1. Serve **this branch** at the tunnel's origin and restart the tunnel. It must
   stay up for the whole test, so the Mac must not sleep.
2. Create the staging entitlement Worker. The command list is in `wrangler.toml`:
   - `d1 create`;
   - `migrations apply --env staging`;
   - secrets `GOOGLE_SA_JSON`, **a staging-only** `PLAY_TOKEN_KEY`,
     `APP_ACCOUNT_SECRET`;
   - `deploy --env staging`.
3. Set up a Pub/Sub push subscription for staging RTDN, and set `RTDN_AUDIENCE`
   and `RTDN_SA_EMAIL` on the staging Worker. Play Console allows **one** RTDN
   topic per app, so it must point at staging during the test and at production
   afterwards.
4. Build an internal-test bundle with host `staging.lomonec.com`.

## 4. Google Play Console — MANUAL ACTION REQUIRED (none verified)

| # | Item | Details |
|---|---|---|
| 1 | Internal testing track | Create a release. Upload the bundle (§1, or the staging-host bundle from §2a) |
| 2 | Testers | An email list; testers join through the opt-in link and install from Play |
| 3 | License testers | Setup → License testing: add the same Google accounts (test cards, no charge, accelerated renewals) |
| 4 | Subscriptions | `premium_monthly`, `premium_annual`. The ids must match the server's `PRODUCTS`. One auto-renewing base plan each; prices are your decision; optional offers |
| 5 | Payments profile | Merchant account active |
| 6 | RTDN | Pub/Sub topic; grant Publisher to `google-play-developer-notifications@system.gserviceaccount.com`; authenticated push to `…/v1/billing/google_play`; **Send test notification** → 200 |
| 7 | API credentials | Enable Google Play Android Developer API; service account + JSON key → `GOOGLE_SA_JSON`; invite it in Users and permissions with "View financial data" and "Manage orders and subscriptions" |
| 8 | App access | A reviewer test account (email + password), noting that Premium needs a license tester |
| 9 | Privacy policy URL | `https://app.lomonec.com/privacy.html`. The new wording (sections 5b, 7b) goes live only when this branch is deployed; it must be live before billing or ads are |
| 10 | Data safety | Add **Purchase history**, collected, not shared, for app functionality. If an ad SDK is added later: device or other IDs, and advertising. Review "No data shared" |
| 11 | Ads declaration | "Contains ads: **Yes**", only when an ad provider is actually on |
| 12 | Store listing | Paste `playstore/listing-full-description.txt` (3,996 characters): "may show ads… a Premium subscription removes them" |
| 13 | Screenshots | `playstore/store-art-2026-09/` is ready (not uploaded) |
| 14 | Content rating | Re-answer the questionnaire when ads go on |
| 15 | Subscription disclosures | The in-app offer already shows renewal terms, the store and the privacy link (C9); the store adds its own |
| 16 | Target API / PBL | Satisfied by §1: target 36, PBL 8.3.0 |

## 5. Billing analytics (be-events) — deploy order

New events: `purchase_started`, `purchase_pending`, `purchase_confirmed`,
`purchase_failed` (reason), `purchase_restore` (source, result),
`entitlement_expired`, `entitlement_cancelled`, `entitlement_revoked`.

Their row is: provider, product, reason, result, source, state. **Every value
must be one of a fixed list, or the Worker writes it blank**, so a token or an
order id can never reach Analytics Engine.

This branch's `events-worker.js` lacks main's `cert_*` events (v481). **Merge
with main before deploying be-events**, or the certificate events are lost.
Verify `max(timestamp)` after deploying.
