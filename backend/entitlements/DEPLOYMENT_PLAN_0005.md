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

## 5. Blocker — step 5 cannot be reached yet

**There is no App Store Connect app record for the Welding app.**
**[verified]** read-only via the App Store Connect API on 13 Oct 2026: the
account holds exactly one app, `com.lomonec.bemastery` (id 6817207864).

The Developer-portal side is complete: `com.lomonec.bemastery.welding`,
`.welding.BEPushService` and `.welding.BEWidget` are registered, all four App
Store profiles are ACTIVE to 2027-09-29, and the Welding bundle id carries
`APPLE_ID_AUTH`, `APP_GROUPS`, `IN_APP_PURCHASE`, `PUSH_NOTIFICATIONS` —
identical to the General English app. **[verified]**

Consequences:
- The Welding subscription group cannot be created until the app record exists,
  so the Welding app has nothing to sell and step 5 would configure a programme
  with no products behind it.
- Whether `premium_annual` / `premium_monthly` can be **reused** on a second app
  cannot be tested until then. Apple's help documentation says an id cannot be
  reused within an app and that in-app purchases are not shareable between apps,
  but does not state the account-level rule; developer reports describe the
  error "The Product ID you entered is already being used by another
  subscription" for an id used only in a different app on the same account.
  **This is unresolved.** Product ids cannot be renamed once created, so test it
  before anything depends on it.
- The code is agnostic either way: the app is derived from the store identity
  Apple and Google signed, never from the product id. If the ids must differ,
  `PRODUCTS` in `entitlement-core.js` and `BILLING_PRODUCTS` in `index.html`
  take different strings and nothing else moves.

The app record must be created in the App Store Connect web UI. The API appears
to offer no app-creation endpoint — a developer report shows `POST /v1/apps`
returning allowed operations `GET_COLLECTION`, `GET_INSTANCE`, `UPDATE` with no
create — so this is an owner action, not an automatable one.

## 6. Rollback

- **Step 5** (configuration): revert the three lists to single-valued and
  redeploy. Welding purchases are then refused with `app_unmapped`; General
  English is untouched. No data change.
- **Step 3** (Worker): redeploy the previous version. Safe while 0005 is
  applied, because the DEFAULT lets pre-split code keep writing — that is the
  whole point of it.
- **Step 2** (migration): there is no down-migration, and 0005 drops and
  recreates `entitlements`. Rollback is restore-from-export. This is why step 1
  exists and why the export is not optional.

## 7. Not to be done under this plan

- Do not apply 0005 to production, deploy the Worker, or extend the lists
  without the owner's explicit authorisation.
- Do not widen `APPLE_BUNDLE_ID` or `PLAY_PACKAGE` without `APP_PROGRAMMES` in
  the same change.
- Do not change the server video allowance to match marketing copy. 60 minutes
  a day (`YTAI_PREMIUM_SEC_PER_DAY = 60 * 60`) is the owner-approved limit, and
  the published App Store descriptions name no number, so nothing obliges a
  change. **[verified]** the live en-US descriptions are "All of Premium, billed
  once a year." and "The same Premium, billed monthly."
