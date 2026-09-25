# Phase 12D — Google Play internal test: checklist and first-device plan

The release candidate is commit `4a66a24` on `feature/phase11-store-prep`.
`staging.lomonec.com` serves an exact snapshot of it (Phase 12C). Android only;
Apple is not in scope.

Every item is labelled:
- **A** verified in code or tests (2026-09-25);
- **B** must be configured by hand in Play Console;
- **C** must be tested on a real Android device;
- **D** waits for the production release.

## 1. Artifacts

| Bundle | Use | SHA-256 (start) |
|---|---|---|
| `BE-Mastery-1.1.0-vc9-INTERNAL-TEST-staging-host.aab` | **Upload this one to Internal testing** | `8e1bbde09d4375ce` |
| `BE-Mastery-1.1.0-vc9-production-host-DO-NOT-UPLOAD.aab` | Reference only. Production will be rebuilt as versionCode 10 (**D**) | `75781a44cc89ffe4` |

Both are in session scratch `bundles/`: **copy them somewhere permanent.**

Both bundles (**A**):
- `com.bemastery.app`, 1.1.0 / 9, min 23, target 36;
- signed with the upload key `3D:E6:6D…`;
- Play Billing Library 8.3.0;
- no keys, Worker URLs, `localhost` or keystore passwords inside.

The internal bundle opens `staging.lomonec.com`, and the other bundle contains
no staging string.

## 2. What is already verified (A)

- **Products:** `premium_monthly` and `premium_annual`. The client's
  `BILLING_PRODUCTS` and the server's `PRODUCTS` are identical. **The
  Play Console ids must match them exactly.**
- **Purchase:** Payment Request → `purchaseToken` → `POST /v1/purchases/verify`
  → Google `subscriptionsv2` → bound to the account (first bind wins) →
  acknowledged when Google says it is unacknowledged. The sheet is told
  `success`, or `unknown` if our server could not be reached; never `fail` after
  payment.
- **Restore:** `listPurchases()` → `/v1/purchases/restore`. It is also run
  silently at every launch, which retries a failed acknowledgement.
- **Pending (slow payment):** `payment_pending`, no Premium, never acknowledged.
  Premium follows when Play reports the purchase as paid.
- **RTDN:** checks Google's OIDC signature, audience, service-account email and
  package; duplicates are applied once; refund → revoked → Free at once.
- **Token vault:** AES-256-GCM, staging-only `PLAY_TOKEN_KEY`; erased on
  refund, upgrade, expiry and account deletion.
- **Analytics:** `purchase_*` and `entitlement_*` are allow-listed, with fixed
  values only. A token or order id is written blank.
- **Automated tests** (fake Google / fake Play sheet): see the report.
- **Staging Worker:**
  - health ok, `dev:false`;
  - signed-out → 401;
  - calls allowed only from `https://staging.lomonec.com`;
  - secrets present: `PLAY_TOKEN_KEY`, `APP_ACCOUNT_SECRET`.
- **Missing on staging:** `GOOGLE_SA_JSON`. It is the name the code reads; there
  is no `PLAY_ACCOUNT_JSON`. The RTDN vars are also missing. Until they are set,
  verify, restore and RTDN answer `501 not_configured`.

## 3. Play Console steps (B) — in this order

1. **Payments profile:** merchant account active (needed before paid products).
2. **Subscriptions** (Monetize → Products → Subscriptions):
   - `premium_monthly`: one base plan, auto-renewing, 1 month, price per
     country, then **activate**;
   - `premium_annual`: one base plan, auto-renewing, 1 year, then activate;
   - offers are optional: a free trial shows as Premium.
3. **API access:**
   - in Google Cloud, enable the *Google Play Android Developer API*;
   - create a service account and download a JSON key;
   - in Play Console → Users and permissions, invite the service account's email
     with **View financial data** and **Manage orders and subscriptions**;
   - then, on this Mac:
     `cd backend/entitlements && npx wrangler secret put GOOGLE_SA_JSON --env staging`
     and paste the JSON.
4. **RTDN:**
   - create a Pub/Sub topic;
   - grant *Pub/Sub Publisher* to
     `google-play-developer-notifications@system.gserviceaccount.com`;
   - create a push subscription to
     `https://be-entitlements-staging.nore-ngou.workers.dev/v1/billing/google_play`,
     with authentication on (a service account; audience = that URL);
   - put `RTDN_AUDIENCE` (the audience) and `RTDN_SA_EMAIL` (the push service
     account) in `[env.staging.vars]`, then run `npx wrangler deploy --env staging`;
   - Play Console → Monetization setup → topic name → **Send test
     notification**, which must answer 200;
   - one topic per app: repoint it to production at release (**D**).
5. **License testers:** Settings → License testing. Add the testers' Google
   accounts and set the response to *RESPOND_NORMALLY*.
6. **Internal testing:**
   - Testing → Internal testing → Testers: create an email list and add the
     same accounts;
   - Create release → upload **`…INTERNAL-TEST-staging-host.aab`** → release
     name `1.1.0 (9) internal`;
   - release notes: "Internal billing test";
   - Save → Review → **Start rollout to Internal testing**;
   - send testers the opt-in link.
7. **App access:** "All or some functionality is restricted". Give a reviewer
   email and password, and say that Premium requires a license tester.
8. **Data safety:**
   - add **Financial info → Purchase history**: collected, not shared;
     purposes App functionality and Account management; encrypted in transit;
     deletable on request;
   - leave the ads-related entries alone until an ad SDK is live (**D**).
9. **Subscription and purchase disclosures:**
   - the in-app offer already shows the renewal terms, the store, the Privacy
     link and the store's own titles and prices (**A**);
   - Play adds "In-app purchases" and its own subscription terms automatically.
   - **D:**
     - the privacy policy sections 5b and 7b must be live on
       `app.lomonec.com` before the production release;
     - the listing text (`playstore/listing-full-description.txt`) is pasted at
       release;
     - "Contains ads: Yes" only when an ad provider is on.

## 4. First real device test (C) — one Android phone, Android 6 or later

Preconditions:
- steps 1–6 above are done;
- the Mac stays awake with staging up (`staging-README.txt`);
- the tester is signed into Play with a license-tester account.

Evidence queries (read-only, staging):
```
cd backend/entitlements
npx wrangler d1 execute be-entitlements-staging --remote --env staging --command "SELECT uid,provider,product,status,expires_at,will_renew,secret_ref IS NOT NULL AS sealed,substr(secret_ref,1,3) AS fmt FROM purchase_links"
npx wrangler d1 execute be-entitlements-staging --remote --env staging --command "SELECT ts,actor,action,plan,status FROM entitlement_audit ORDER BY ts DESC LIMIT 20"
```

| # | Step | Expected result |
|---|---|---|
| 1 | Install from the internal-test opt-in link | "BE Mastery" installs as 1.1.0 (9); opens full-screen with no browser bar (the site's asset links verify) |
| 2 | First launch, Free account | Onboarding; Home. Premium card: "Coming soon" (billing is still off) |
| 3 | Open `https://staging.lomonec.com/?flags=billing_enabled` once in the app, then Settings → Premium | The offer shows two plans with **Play's** titles and prices, Restore, and the renewal terms naming Google Play |
| 4 | Sign in (email / password) | Signed in; the Premium card is still Free |
| 5 | General English: Home, a session, Practice, Progress | Works as on production |
| 6 | Switch to Welding: Home, a workshop, Practice | Welding content only; no Practice Partner card, no Shadow Studio V2 |
| 7 | Ads | **None**: `ads_enabled` is off and there is no provider. (Optional: `?flags=ads_enabled`. Only the mock provider exists, and it is refused on non-local hosts, so still none.) |
| 8 | Protected states: record in a session; speak in Practice / roleplay; open the Shadow workspace | Nothing interrupts; no overlay |
| 9 | Get Premium · monthly → Play sheet → pay with the test card | Play's sheet shows the test instrument; the purchase completes |
| 10 | After the sheet closes | "Premium is on. Thank you."; the card shows "Active until …" and Manage subscription |
| 11 | Server evidence | D1 `purchase_links`: `google_play`, `premium_monthly`, `status=active`, `fmt=v1.`; the audit shows `verify`; Play Console → Order management shows the order **acknowledged** |
| 12 | Ads with Premium | None; with `?flags=ads_enabled` the policy still refuses (Premium) |
| 13 | Force-stop, reopen | Still Premium, no purchase sheet (the launch check runs quietly) |
| 14 | Sign out → the Premium card shows Free; sign back in | Premium again, from the server |
| 15 | Settings → Premium → Restore purchases | "1 purchase restored"; still Premium |
| 16 | Pending (only if Play offers a slow test method) | "Your payment is still being processed…"; D1 `payment_pending`; Premium only after it clears |
| 17 | Play Store → Subscriptions → cancel | The card says "Cancelled — Premium stays on until …"; D1 `will_renew=0` |
| 18 | Wait for expiry (license-tester renewals are accelerated; Play's own table sets the timing) | Free, "Your Premium has ended"; D1 `expired`, `sealed=0` |
| 19 | Buy again, then Play Console → Order management → **Refund**, with the entitlement removed | Free at once; D1 `revoked`, `sealed=0` |
| 20 | Restore purchases after the refund, and reopen the app | **Must stay Free.** Record Google's reported state for that purchase. This settles the Phase 10 question |
| 21 | Buy again (a new purchase) | Premium; the refunded link stays revoked |
| 22 | Reminder (Android 13+) | Settings → Reminders → on → **Android asks for notification permission**; allow; the reminder arrives as a BE Mastery notification |

Each row: record REAL (not automated), the date/time, a screenshot and the D1
output.
