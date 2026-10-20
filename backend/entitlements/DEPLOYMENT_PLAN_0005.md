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

## 2. Current production state — RE-READ 20 OCTOBER 2026

**This section was wrong and is now corrected from the live account, not from
`wrangler.toml` and not from report.** Steps 1-5 in § 3 have, in substance,
already been carried out. Do **not** run them again.

Queried read-only on 20 Oct 2026 (`wrangler d1 execute … --remote` with SELECTs
only, `wrangler versions view`, `wrangler secret list`; no value of any secret
was printed and nothing was written):

- **Migration 0005 IS applied.** `d1_migrations` lists 0001-0005, and the live
  `entitlements` table carries `app_id` with `PRIMARY KEY (uid, app_id)`.
  **[verified]** The earlier line here — "0001-0004 applied; 0005 not applied" —
  was marked `[reported]` and was never checked against the database. It is
  false.
- **The deployed Worker already has both apps configured**, and the three lists
  are extended **together**, which is the aligned, safe shape:
  `APP_PROGRAMMES = "general-english,welding"`,
  `APPLE_BUNDLE_ID = "com.lomonec.bemastery,com.lomonec.bemastery.welding"`,
  `PLAY_PACKAGE = "com.bemastery.app,com.lomonec.bemastery.welding"`.
  **[verified]** from the deployed version's own bindings, not from the repo.
- Deployed version `4e4d86ba`, created **2026-10-16**. The app-scoping code
  (`programmeOfStoreId`, `purchase_links.app_id`) landed on 13 Oct in
  `effe9de0`, three days earlier, and the pre-split configuration had no
  `APP_PROGRAMMES` variable at all. `/health` answers `{"ok":true,"dev":false}`,
  the current code's shape. **[verified]** — though see the caveat below.
- Other deployed bindings: `FIREBASE_PROJECT_ID = "be-mastery"`,
  `APPLE_ENVIRONMENTS = "Production,Sandbox"`, `APPLE_ROOT_SHA256`,
  `ALLOWED_ORIGINS`, `RTDN_AUDIENCE`, `RTDN_SA_EMAIL`, D1 bound to
  `ead9ecb9…`. Secrets present by **name only**: `APP_ACCOUNT_SECRET`,
  `GOOGLE_SA_JSON`, `PLAY_TOKEN_KEY`, `ADMIN_TOKEN`. **[verified]**
- `purchase_links` **0 rows**, `entitlements` **0 rows**,
  `processed_notifications` **21**. **[verified]** No account has ever held a
  store entitlement in production, so there is still nothing to migrate or to
  lose.

> **THE ONE THING NOT PROVEN.** The deployed *configuration* is post-split
> beyond doubt. The deployed *code* is inferred — from the 16 Oct deploy date
> against the 13 Oct commit, from variables that only exist post-split, and
> from the `/health` shape. An unauthenticated probe cannot distinguish the two
> code paths, because the auth check runs before app resolution, so every probe
> answers 401.
>
> This matters because **widened lists in front of pre-split code is the one
> combination that leaks Premium across the two apps** (§ 6). The evidence is
> strong that this is not the live state, but if certainty is wanted before the
> first real purchase, redeploy from `main` (`npx wrangler deploy --env ""`),
> which is idempotent here and makes the deployed code a known quantity.

**What this means for the plan below.** § 3 steps 1-5 describe work that is
already done. They are kept as the record of how it was meant to be sequenced
and as the procedure for any future environment. § 6's rollback ordering still
applies in full and is the part to read if anything has to be undone.

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

**What still blocks a working Welding purchase — corrected 20 Oct 2026.**
The first two items that stood here (0005 unapplied; the three lists still
single-valued) were **both false**, and the backend is not the blocker at all.
Re-read from the live account, the backend is ready: 0005 applied, both apps
configured, Apple and Play credentials present, 0 rows of live data.

What actually blocks it is **on the app side, and only there**:

1. **Welding build 2 is the build attached to version 1.0**, and build 2 is the
   one that asks the App Store for `premium_monthly` / `premium_annual` — ids
   the Welding app record does not hold. StoreKit answers with an EMPTY product
   list, so the paywall has nothing on it and nothing can be bought. Build 3
   carries the fix; it must be uploaded **and attached to the version**.
2. Nothing else. Once a build that asks for `welding_premium_*` is in front of
   a learner, the products exist (READY_TO_SUBMIT, 175 territories, 3-day
   trial) and the server can file the purchase per-app.

So a Welding purchase has never been *possible*, but not for the reason this
document gave. A passing local suite still does not prove a production
purchase: the suites run against an in-memory database, and no real purchase
has been made on either store in either app.

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

---

## 8. Forward checklist — from here to the first real Welding purchase

Written 20 Oct 2026, after re-reading production. **Nothing in it has been
executed.** Steps 1-3 are owner-only store actions; 4 is optional belt-and-
braces; 5 is the only thing that proves the chain.

| # | Step | Who | Done when |
|---|---|---|---|
| 1 | Upload the verified IPA (`1.0.0 (3)`, SHA-256 `2ce4ab0f…`) with `bash scripts/upload.sh welding` | owner | App Store Connect shows build 3 and finishes processing |
| 2 | **Attach build 3 to version 1.0**, replacing build 2 | owner | the version's build reads 3, not 2 |
| 3 | Resubmit (submission `d0a067bd` is `UNRESOLVED_ISSUES`; read the Resolution Center message first — the API does not expose it) | owner | state leaves `UNRESOLVED_ISSUES` |
| 4 | *Optional:* redeploy the Worker from `main` so the deployed code is a known quantity rather than an inference (§ 2 caveat) | owner | `wrangler deployments list` shows a fresh version |
| 5 | One sandbox purchase in each app, then read `purchase_links` and `entitlements` back | owner | one row per app, each with the right `app_id`; the other app still reads Free |

Step 5 is the only evidence that the chain works end to end. Until it is done,
"configured" is all that can honestly be claimed: no real purchase has been
made on either store, in either app.

### Rollback, and the one ordering that must never be used

The backend is already in the wide configuration, so a rollback means
**narrowing** it. That is where the leak lives.

| Undo | Order | Why |
|---|---|---|
| Stop selling in Welding only | Narrow the three lists **together** (`APP_PROGRAMMES`, `APPLE_BUNDLE_ID`, `PLAY_PACKAGE`) and redeploy | `programmeOfStoreId` then returns `null` for the Welding identity, so Welding purchases are refused with `app_unmapped` and General English is untouched. No data change. |
| Roll the Worker back to pre-split code | **Narrow the lists FIRST. Confirm the narrow config is live. Only then roll the code back.** | See below. |
| Undo 0005 | Restore from a D1 export | There is no down-migration and 0005 recreates `entitlements`. Today this costs nothing (0 rows) — it will not stay that way after step 5. |

> **NEVER: widened lists in front of pre-split code.** The pre-split Worker has
> no app dimension — it writes one entitlement row per account. With both
> bundle ids still on the allow-list it will *accept* a Welding transaction and
> write it as that account's only entitlement, and **General English will then
> read Premium from a Welding purchase.** The allow-list decides only *whether*
> to accept; only the app scoping decides *what it grants*.
>
> This is why the code rollback is second and the configuration rollback is
> first, and why the two must never be reordered "to save a deploy" — not even
> for the minutes between two commands. If a rollback is ever started and
> interrupted, the safe resting state is **narrow lists**, whichever code is
> running.
