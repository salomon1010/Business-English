# Phase 12B — Google Play internal-test environment

Production is untouched: `app.lomonec.com`, no production entitlement Worker,
no production D1, billing and ads OFF. Nothing is uploaded to Play.

## 1. Staging — what exists now (verified 2026-09-25)

| Piece | State |
|---|---|
| Hostname | `staging.lomonec.com`: named tunnel **`be-staging`** (`3c582bf3…`), origin `http://localhost:8000` on the owner's Mac. **No active connection** (530). Port 8000 is used by another project. |
| Entitlement Worker | **`be-entitlements-staging` DEPLOYED** (Phase 12B, version `53d0aba0`), `https://be-entitlements-staging.nore-ngou.workers.dev` |
| Entitlement D1 | **`be-entitlements-staging` CREATED** (`09dd4913-…`), migrations 0001–0004 applied, all tables present |
| Secrets | **`PLAY_TOKEN_KEY` and `APP_ACCOUNT_SECRET` set.** Staging-only random values, never displayed, not the production values. |
| Missing secrets | **`GOOGLE_SA_JSON`** (needs the Play service account). Until it exists, the verify, restore and RTDN routes answer 501 `not_configured`. |
| Vars | `PLAY_PACKAGE`, `APPLE_BUNDLE_ID`, `APPLE_ENVIRONMENTS=Sandbox`, `ALLOWED_ORIGINS=https://staging.lomonec.com`, `FIREBASE_PROJECT_ID`. **`RTDN_AUDIENCE` / `RTDN_SA_EMAIL` not set yet.** |
| Safeguards | Observability OFF, including traces (`wrangler.toml`), because Google URLs carry the token. No `DEV_AUTH`. No `ADMIN_TOKEN`, so the admin route is 404. |
| Client routing | `beEnv()` sends `staging.lomonec.com` to the staging Worker (Phase 12A). `billing_enabled` stays OFF there too: testers turn it on with `?flags=billing_enabled`. |
| Other staging Workers | `be-partner-staging` and `be-events-staging` exist (not changed) |
| Polish Worker | Its origin list is a code constant; `staging.lomonec.com` gets 403. Transcription and scoring do not work on staging. Billing does not need them. |

Checked from outside:
- `/health` → `{"ok":true,"dev":false}`;
- signed-out requests → 401, and a forged `X-Dev-User` → 401;
- RTDN → 501;
- CORS allows only `https://staging.lomonec.com`;
- the admin route → 404.

## 2. Two Android bundles (both signed, neither uploaded)

| | Staging-host bundle (for Internal testing) | Production-host bundle |
|---|---|---|
| Host | `staging.lomonec.com` | `app.lomonec.com` |
| versionCode / name | 9 / 1.1.0 | 9 / 1.1.0 → **rebuild as 10 at release** |
| Use | Internal testing track only | Production, after the internal test |

Every upload needs a new versionCode, higher than the last. With the staging
bundle on the internal track as 9, the production release must be 10. It is
the same recipe with `appVersionCode: 10`
(`docs/PHASE12A-INTERNAL-TEST.md` §1).

## 3. Notification delegation — decision: KEEP ON (required)

**What it controls.** Bubblewrap generates one Android service,
`.DelegationService`. The manifest enables and exports it only if
`enableNotifications` is true (`android:enabled="@bool/enableNotification"`).
When it is on:
- Chrome delegates the site's notifications to the app, which shows them
  itself, with its own icon;
- on Android 13+ the app asks for the `POST_NOTIFICATIONS` runtime permission,
  through `NotificationPermissionRequestActivity`.

**Why BE Mastery needs it.** The Play Billing feature registers
`DigitalGoodsRequestHandler` in that same service's `onCreate` (verified in the
generated `DelegationService.java`). With the service disabled, the page's
`getDigitalGoodsService()` has nothing to talk to, so **Play Billing cannot
work**. Bubblewrap therefore refuses to build `playBilling` without it
(`errorPlayBillingEnableNotifications`).

**If enabled:**
- reminders and partner alerts appear as BE Mastery notifications;
- Android 13+ shows the system permission dialog. The app asks only when the
  learner turns on reminders or partner alerts (`remToggle`, `ppAlertsToggle`,
  the partner nudge); it never asks at launch.

**If disabled:** notifications stay with Chrome, as in 1.0.1, and **Play Billing
fails.**

**Risk to check on a device:** learners on Android 13+ who already turned
reminders on gave that permission to *Chrome*, not to the app. After the update
the app has no permission yet, so their reminders may not appear until they
switch reminders off and on (which asks again). This is device-test row D-1.
The optional follow-up is an in-app re-ask; it is not built.

## 4. Owner steps, in order — MANUAL ACTION REQUIRED

1. **Play Console → service account** (see §5.7), then set the key on staging:
   `cd backend/entitlements && npx wrangler secret put GOOGLE_SA_JSON --env staging`.
2. **RTDN for staging:**
   - create a Pub/Sub topic and grant Publisher to
     `google-play-developer-notifications@system.gserviceaccount.com`;
   - create an authenticated push subscription to
     `https://be-entitlements-staging.nore-ngou.workers.dev/v1/billing/google_play`;
   - add `RTDN_AUDIENCE` and `RTDN_SA_EMAIL` to `[env.staging.vars]` and run
     `npx wrangler deploy --env staging`;
   - in Play Console, Monetization setup → topic → **Send test notification**;
     it must answer 200.
   - Play allows one topic per app: switch it to production after the test.
3. **Serve this branch on staging.**
   - Serve this branch's checkout with `python3 -m http.server <port>`.
   - Run `cloudflared tunnel run --url http://localhost:<port> be-staging`,
     or free port 8000 and use the tunnel's usual origin.
   - Keep the Mac awake for the whole test.
   - Check `https://staging.lomonec.com/.well-known/assetlinks.json` → 200.
4. Upload the **staging-host bundle** (§2) to **Internal testing**.
5. Add testers and license testers, create the subscriptions, then run §6.

## 5. Play Console checklist — MANUAL ACTION REQUIRED (none verified)

1. **App:** existing `com.bemastery.app`. Do not create a new app.
2. **Internal testing:** create a release; upload the staging-host bundle
   (versionCode 9, 1.1.0); release name "1.1.0 (9) internal billing test".
3. **Testers:** an email list, plus the opt-in URL sent to each tester.
4. **License testers:** Setup → License testing. Add the same Google accounts
   and set the response to RESPOND_NORMALLY.
5. **Subscriptions:** Monetize → Subscriptions:
   - `premium_monthly`: base plan, auto-renewing, monthly;
   - `premium_annual`: base plan, auto-renewing, yearly;
   - prices are the owner's decision; activate both.
6. **Payments profile:** merchant account active.
7. **API access:**
   - Google Cloud: enable the Google Play Android Developer API;
   - create a service account and a JSON key;
   - in Play Console, Users and permissions: invite its email with "View
     financial data" and "Manage orders and subscriptions".
8. **RTDN:** §4.2.
9. **App access:** a reviewer test account (email and password). Premium needs
   a license tester.
10. **Store listing, Data safety, rating:** §7.

## 6. Real test sequence (Play internal track + a real Android phone)

Each row records:
- a date/time;
- a screenshot;
- the staging D1 evidence below;
- **REAL** (Play) or **MOCK** (automated).

MOCK equivalents already pass (Phase 10–12A suites); they are **not** Play
validation.

Evidence queries (staging, read-only):
```
npx wrangler d1 execute be-entitlements-staging --remote --env staging --command \
 "SELECT provider,plan,product,status,expires_at,will_renew,secret_ref IS NOT NULL AS sealed,substr(secret_ref,1,3) AS fmt FROM purchase_links"
npx wrangler d1 execute be-entitlements-staging --remote --env staging --command \
 "SELECT ts,actor,action,plan,status FROM entitlement_audit ORDER BY ts DESC LIMIT 20"
```
(`fmt` must read `v1.`. The token itself is never printed.)

| # | Step | Expected | REAL / MOCK status |
|---|---|---|---|
| A | Install from the internal-test link | App opens `staging.lomonec.com` full-screen (no URL bar = asset links verified) | REAL: NOT RUN |
| B | Sign in (email / password) | Signed in | REAL: NOT RUN |
| C | Open with `?flags=billing_enabled` once, then Settings → Premium | Free; the store's own titles and prices; Restore; renewal terms | REAL: NOT RUN · MOCK: B5 pass |
| D | Tap Get Premium | Play sheet opens | REAL: NOT RUN |
| E | (Only if a slow payment method is offered) | "Your payment is still being processed…"; D1 `status=payment_pending`; not acknowledged | REAL: NOT RUN · MOCK: PP1, C12 pass |
| F | Pay with the license-tester test card | Sheet closes | REAL: NOT RUN |
| G | Server validation | D1 row: `google_play`, `premium_monthly`, `status=active`, `fmt=v1.`; audit `verify` | REAL: NOT RUN · MOCK: G1 pass |
| H | Acknowledgement | Play Console → Order management: the order is acknowledged | REAL: NOT RUN · MOCK: G2 pass |
| I | Premium active | "Premium · Active until …" | REAL: NOT RUN · MOCK: B8 pass |
| J–K | Force-stop, relaunch | Still Premium, no purchase sheet | REAL: NOT RUN · MOCK: C11 pass |
| L | Ads | None (ads are off anyway; with `?flags=ads_enabled`, the policy must refuse them for Premium) | REAL: NOT RUN · MOCK: E2 pass |
| M | Cancel in the Play subscription centre | "Cancelled — Premium stays on until …"; `will_renew=0`; RTDN received | REAL: NOT RUN · MOCK: N7, B13 pass |
| N | Let the test subscription expire, **or** Play Console refund **with "remove entitlement"** | Free; D1 `expired` or `revoked`; `sealed=0` (token erased) | REAL: NOT RUN · MOCK: V5, V7 pass |
| O | Relaunch | Free | REAL: NOT RUN |
| P | Restore purchases, and wait for a notification | **Must stay Free.** Record Google's `subscriptionState` for the old token. **This settles the Phase 10 question.** | REAL: NOT RUN (open question) |
| Q | Buy again (a new token) | Premium | REAL: NOT RUN · MOCK: P-6 equivalent pass |
| R | Relaunch | Premium; the old link stays expired or revoked | REAL: NOT RUN |
| D-1 | Android 13+ phone that had reminders on in 1.0.1: update to 1.1.0 | Record whether reminders still arrive; if not, re-toggling reminders must bring the permission dialog | REAL: NOT RUN |

## 7. Play listing — MANUAL ACTION REQUIRED (nothing published)

| Item | Exact action |
|---|---|
| Full description | Paste `playstore/listing-full-description.txt` (3,996 characters). It says "The free version may show ads, never while you speak; a Premium subscription removes them." There is no "no ads" and no "100% free" |
| Short description | Check the live short description (not stored in the repo). It must not say "no ads" or "free" without qualification |
| Ads declaration | **Keep "No" while no ad provider is live.** Switch to "Contains ads: Yes" in the same release that turns an ad provider on |
| Premium / subscription | Play shows "In-app purchases" once the products exist. The description already names the Premium subscription. Price and renewal come from Play |
| Screenshots | `playstore/store-art-2026-09/` (phone, tablet), ready, not uploaded |
| Data safety | Add **Financial info → Purchase history**: collected, not shared, for app functionality and account management; encrypted in transit; deletion on request. When an ad SDK is added: device or other IDs, and advertising |
| Privacy policy | URL `https://app.lomonec.com/privacy.html`. Sections 5b and 7b exist on this branch only; they must be live **before** a production release with billing or ads |
| Content rating | Re-check the questionnaire when ads are enabled |
| App access | Give the reviewer account; say that Premium needs a license tester |
