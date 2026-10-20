# Migration 0005 + per-app entitlements — deployment plan

For review. **Nothing in this plan has been executed.** No production migration
has been applied, no Worker deployed, no store record created or edited.

Written 13 October 2026. Verified facts are marked **[verified]** with how;
anything taken on report is marked **[reported]** and named.

## 1. What is being changed, and why it is safe to do in two steps

`entitlements` was one row per account. The two-app split needs one row per
(account, app), so a purchase in one app grants Premium in that app only.
`0005_app_scope.sql` adds `purchase_links.app_id` and rebuilds `entitlements`
with primary key `(uid, app_id)`.

Two properties make this a two-step change rather than one atomic outage:

- **`app_id TEXT NOT NULL DEFAULT 'general-english'`.** The Worker running in
  production today is pre-split and inserts no `app_id`. Without the DEFAULT,
  applying 0005 makes every entitlement write fail with
  `NOT NULL constraint failed: entitlements.app_id` until the new Worker ships.
  With it, old and new code both read and write correctly, so the migration and
  the deploy can be minutes apart in either order.
  **[verified]** I applied 0001-0005 to an isolated in-memory database and
  inserted a row the pre-split way (no `app_id`): it succeeded and landed on
  `general-english`.
- **Every column is named explicitly in the rebuild.** `will_renew` was added by
  0003 via `ALTER TABLE`, so a `SELECT *`-style copy would silently drop it and
  turn every cancellation back into a renewal.
  **[verified]** A row with `will_renew = 0` survives as `0`, not `NULL`.

Also **[verified]** in that isolated database: pre-split rows backfill to
`general-english`; `purchase_links.app_id` is nullable and `NULL` for pre-split
rows; `(uid, app_id)` allows one account a separate plan per app and still
refuses a duplicate pair; and re-running 0005 **fails loudly** rather than
silently emptying the table. 10/10 of my own checks, independent of
`test/migration.mjs`, which passes 13/13.

## 2. Current production state

- `be-entitlements` is **deployed and answering**. **[verified]** An
  unauthenticated `GET /v1/entitlement` returns `HTTP 401 {"error":"auth"}`,
  for both no `?app` and `?app=welding`. No credentials were sent.
- `APP_PROGRAMMES = "general-english"`, `APPLE_BUNDLE_ID = "com.lomonec.bemastery"`,
  `PLAY_PACKAGE = "com.bemastery.app"` — all single-valued, the safe
  configuration. **[verified]** read from `wrangler.toml`.
- Migrations 0001-0004 applied 2026-10-03; 0005 not applied; `purchase_links`
  0 rows, `entitlements` 0 rows, `processed_notifications` 18.
  **[reported]** by the `be-staging` session; I have not queried production D1
  and deliberately did not. If the row counts still hold, there is no live
  entitlement data to migrate, which makes this the cheapest moment the change
  will ever have. **Confirm the counts before applying.**

## 3. Order of operations

Steps 1-2 are independent of the stores and can be done now. Steps 3-5 cannot
start until the blocker in §5 is cleared.

1. **Confirm there is no live data.**
   `SELECT count(*) FROM purchase_links; SELECT count(*) FROM entitlements;`
   If either is non-zero, stop and re-read §1 — the plan still holds, but take a
   D1 export first.
2. **Apply 0005 to production D1.** Safe before the Worker deploy because of the
   DEFAULT. Take the D1 export regardless; it costs nothing.
3. **Deploy the new Worker** (`npx wrangler deploy --env ""` — the empty string
   is how wrangler names the top level). Still single-app configured, so
   behaviour is unchanged: every purchase resolves to `general-english`.
4. **Verify** per §4 while still single-app. Nothing about the Welding app is
   live yet.
5. **Extend the three lists together**, in one change, and redeploy:
   ```
   PLAY_PACKAGE    = "com.bemastery.app,com.lomonec.bemastery.welding"
   APPLE_BUNDLE_ID = "com.lomonec.bemastery,com.lomonec.bemastery.welding"
   APP_PROGRAMMES  = "general-english,welding"
   ```
   They are **index-aligned**: position *i* is the same app on Play, on the App
   Store and in the data. Extending a store list without extending
   `APP_PROGRAMMES` makes `programmeOfStoreId` return `null`, which refuses the
   **new** app's purchases and leaves the existing app working — the safe
   direction for a configuration mistake, and the reason to change all three at
   once rather than one at a time.

## 4. Verification after each step

- After step 3, still single-app: an existing General English account reads the
  same plan it read before; `GET /v1/entitlement` with no `?app` answers about
  `general-english` (the pre-split client sends no `?app`, and
  `tests/app-split.mjs` 77/78 guard exactly this).
- After step 5: a Welding purchase grants Premium in Welding and the same
  account still reads Free in General English, and vice versa.
  `backend/entitlements/test/billing.mjs` W1-W23 is that contract.
  **[verified]** 155/155 passing locally.
- Before step 5 and after, an app the service does not know answers Free for
  that app, never another app's plan (W16).

## 5. Step 5's old blocker is CLEARED; a different one remains

**Superseded 20 October 2026.** This section used to say there was no App Store
Connect app record for the Welding app, so the subscription group could not be
created and the id-reuse question could not be tested. Both are now settled.
Read-only App Store Connect API, 20 Oct 2026, no credentials printed:

- The account holds **two** apps: `com.lomonec.bemastery` (6817207864) and
  **`com.lomonec.bemastery.welding` (6822527532)**. **[verified]**
- Welding subscription group **22484497** "BE Mastery Welding Premium" exists,
  holding `welding_premium_annual` (6823575232, ONE_YEAR) and
  `welding_premium_monthly` (6823574822, ONE_MONTH), both **READY_TO_SUBMIT**,
  USA 19.99 / 2.99, 175 territory prices each and 175 FREE_TRIAL / THREE_DAYS
  introductory offers each. **[verified]**
- **The ids could NOT be reused.** Apple refused the Welding app the ids the
  General English app already holds, so it carries `welding_premium_*`. The
  question this section left open is answered, and answered the other way.
  Google Play is unaffected: a Play product id is scoped to its package, and
  **both** packages sell `premium_annual` / `premium_monthly`, ACTIVE, with a
  `trial3d` P3D offer on each. **[verified]** read-only Play Developer API.
- As §5 predicted, the code was agnostic: `PRODUCTS` in `entitlement-core.js`
  and `APPLE_BILLING_PRODUCTS` in `index.html` took different strings and the
  app scoping did not move, because the app is derived from the store identity
  Apple and Google signed, never from the product id.

**What still blocks a working Welding purchase in production**, in order:

1. **0005 is not applied to production D1** and the **deployed Worker is still
   the pre-split code**. Until both are done, the Worker has no app dimension,
   so no purchase in either app can be filed per-app. Steps 1-4 above are the
   procedure; nothing about them has changed.
2. **The three lists are still single-valued in production.** Step 5 can now
   actually be reached once 1 is done — the products it would configure exist.
3. **Welding build 2 is the build attached to version 1.0**, and build 2 is the
   one that asked for the wrong product ids. A build carrying the fix (3) has
   to be uploaded and attached before the app can sell anything at all.

Until 1 and 2 are done, a Welding purchase cannot be verified in production
even though the store records are complete. A passing local suite does not
change that: the suites run against an in-memory database with the two-app
configuration already set.

## 6. Rollback

- **Step 5** (configuration): revert the three lists to single-valued and
  redeploy. Welding purchases are then refused with `app_unmapped`; General
  English is untouched. No data change.
- **Step 3** (Worker): redeploy the previous version — but **only after step 5
  has been rolled back first**. The order is not interchangeable, and getting it
  wrong is the one way this change can leak Premium across the two apps:

  > **THE FAILURE PATH.** The pre-split Worker has no app dimension at all — it
  > derives one entitlement row per account, not per (account, app). If it is
  > running while `APPLE_BUNDLE_ID` / `PLAY_PACKAGE` still name both apps, it
  > will accept a Welding transaction (the bundle id is on the allow-list) and
  > write it as that account's single entitlement — and General English will
  > then read Premium from a Welding purchase. This is precisely why a bundle-id
  > allow-list is not sufficient on its own: the allow-list decides *whether* to
  > accept, and only the app scoping decides *what it grants*.
  >
  > So: **revert the lists, confirm the revert is live, then roll the Worker
  > back.** Never the other way round, and never leave the widened lists in
  > place with the old Worker deployed, even briefly.

  With the lists already single-valued, the rollback is safe: 0005's
  `DEFAULT 'general-english'` lets the pre-split code keep inserting, which is
  the whole point of the DEFAULT.
- **Step 2** (migration): there is no down-migration, and 0005 drops and
  recreates `entitlements`. Rollback is restore-from-export. This is why step 1
  exists and why the export is not optional.

## 7. Not to be done under this plan

- Do not apply 0005 to production, deploy the Worker, or extend the lists
  without the owner's explicit authorisation.
- Do not widen `APPLE_BUNDLE_ID` or `PLAY_PACKAGE` without `APP_PROGRAMMES` in
  the same change, and never widen any of them while the pre-split Worker is
  the deployed one — see the failure path in §6.
- Do not change the server video allowance to match marketing copy. 60 minutes
  a day (`YTAI_PREMIUM_SEC_PER_DAY = 60 * 60`) is the owner-approved limit, and
  the published App Store descriptions name no number, so nothing obliges a
  change. **[verified]** the live en-US descriptions are "All of Premium, billed
  once a year." and "The same Premium, billed monthly."
