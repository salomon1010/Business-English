# Store notifications: the acknowledge contract

**Branch `fix/rtdn-ack-permanent-rejections`, 29 October 2026. NOT merged, NOT
deployed.** Read `src/billing.js` § "ACK OR RETRY" with this.

## What happened

`be-entitlements` answered some Google Play Real-time Developer Notifications
with HTTP 422. Google Pub/Sub reads any non-2xx as "not delivered" and sends the
same message again. A notification refused by a business rule can never succeed
on a retry, so it was redelivered for ever.

Measured on the Cloudflare account, 30 September – 29 October 2026:

| | |
|---|---|
| `be-entitlements` requests | 1,340,810 — **84.9%** of all 23 Workers |
| Rate since 23 Oct | ~120,000/day, flat ±2% around the clock |
| Outbound Play Developer API calls | 1,376,090 (1.026 per request) |
| Share of the 200,000/day Play API quota | ~60% |
| Notifications actually processed, 11–27 Oct | **33** |
| Cloudflare-recorded errors | **0** |

Two things hid it. A deliberate 422 is a *successful* response, so the error
metric stayed at zero; and observability is off on this Worker.

## The rule

On this path a status code is not a report, it is an instruction. There are
only two: **2xx = done, never send this again**, anything else = **send it
again**.

- **4xx from the purchase check is permanent.** Acknowledge, record why, change
  nothing. A redelivery cannot turn a licence-test purchase into a paid one.
- **5xx is transient.** Refuse, so the store retries. Google unreachable, or our
  own misconfiguration that a redeploy will fix.
- **Authentication is the deliberate exception.** An unsigned or wrongly signed
  notification is still refused with 401, before any message id is known.
  Acknowledging unauthenticated callers would let anyone silence a store.

## Before and after

`id` = `gp:<messageId>` / `as:<notificationUUID>`.

| Outcome | Status | Before | After | Test |
|---|---|---|---|---|
| Valid notification | — | 200, applied | unchanged | N5, N7, K18 |
| Duplicate message id | — | 200 `duplicate` | unchanged | N6, K5 |
| Play Console test notification | — | 200 | unchanged | N10, K17 |
| Apple wrong environment | — | 200 | unchanged | A-series |
| `unknown_purchase` | 404 | 200, **unrecorded** | 200, **recorded** | K8 |
| `test_purchase` | 422 | **422 → retried for ever** | **200, recorded** | K1–K4 |
| `not_our_product` | 422 | **422 → retried for ever** | **200, recorded** | K7 |
| `product_mismatch` | 422 | **422 → retried for ever** | 200, recorded | — ¹ |
| `account_mismatch` | 403 | **403 → retried for ever** | 200, recorded | — ² |
| `token` malformed | 400 | **400 → retried for ever** | 200, recorded | — ³ |
| Apple `bundle` | 422 | **422 → Apple retries for days** | **200, recorded** | — ⁴ |
| `app_unmapped` | 500 | 500, retried | unchanged — correct | K9, K10 |
| Google unreachable | 502 | 502, retried | unchanged — correct | K11, K12 |
| Bad OIDC signature | 401 | 401, retried | unchanged — correct | K13, N1–N4 |

¹ Unreachable from the RTDN path: it needs `ev.productId`, which a notification
does not carry. Classified anyway.
² Unreachable from the RTDN path: it needs `ctx.uid`, and a notification has no
authenticated user. Classified anyway.
³ Pub/Sub always sends a token; classified for completeness.
⁴ Apple was not storming, but carried the identical defect. Fixed with the same
rule so the incident cannot repeat on the other store.

## Idempotency, and what a rejection does not do

- The message id is claimed with `INSERT OR IGNORE INTO processed_notifications`
  exactly as before. A rejection is recorded **after** that claim, so a
  redelivery is the ordinary `duplicate` reply and writes no second row (K5).
- A rejected notification returns `updates: []`. No uid is ever looked up, so it
  **cannot grant or revoke** anything, for the subject or anyone else (K3, K16).
- A rejection is about one message, not a token. When the same token later
  becomes a real purchase, the next notification applies normally (K15).
- `rejected_notifications` (migration 0006) keeps id, provider, status, reason
  and time. **No purchase token, no uid, no account token** (K4) — the reason is
  the operational fact worth keeping, and `entitlement_audit` already records
  anything that changed a plan.

**Known cost, accepted deliberately.** The claim happens after the purchase
check, so a redelivered message still costs one Play API call before it is
deduped (K6). Claiming the id first would need a release path on every
transient-failure return, and a release that is ever missed loses a real
purchase notification permanently. One extra call on a rare double delivery is
the cheaper risk. Pinned by K6 so changing it is a decision, not a drift.

## PLAY_ALLOW_TEST_PURCHASES — investigated, deliberately unchanged

Production does not set it; `be-entitlements-staging` sets `"1"`. Verified
against both the live Worker settings and `wrangler.toml`, whose `[env.staging]`
comment states the intent: *"Production deliberately does not set it, so a free
test purchase can never become a production entitlement."*

**This is correct and must stay.** The defect was never the refusal — it was
expressing a permanent refusal as a retryable one. Setting the variable in
production would stop the storm by making licence-test purchases grant real
Premium, which is the failure the control exists to prevent. T1–T5 and K14 hold
the refusal; K1–K4 hold the acknowledgement.

## Test results

`node backend/entitlements/test/{run,billing,migration}.mjs` — real SQLite built
from the real migrations, genuinely signed RS256/ES256 tokens, no network.

| Suite | Before | After |
|---|---|---|
| `run.mjs` | 61/61 | 61/61 |
| `billing.mjs` | 165/165 | **192/192** (+27: K1–K18 here, K19–K22 with the atomic batch, +5 from `feature/android-usage-limits`) |
| `migration.mjs` | 13/13 | 13/13 |
| **Total** | 239 | **266, 0 failing** |

## Expected reduction

Measured baseline: 123,269 requests/day account-wide over the last 7 days, of
which ~118,500 is this storm.

| | Requests/day | Play API calls/day |
|---|---|---|
| Now | ~123,300 | ~120,000 |
| After the fix | **~4,800** | **< 100** |
| Free allowance | 100,000 | 200,000 (Play) |

The account returns to roughly **5% of the Cloudflare free allowance**, and Play
API use falls from ~60% of quota to negligible. Workers Paid is not needed for
capacity.

Each backlogged message is acknowledged on its **next** delivery, so the backlog
drains itself — nothing has to be discarded. Drain time is backlog ÷ ~1.4
messages/second.

## Rollback

The change is one Worker deploy plus one additive migration.

1. `npx wrangler rollback --name be-entitlements` — or deploy the previous
   version id, recorded in the checklist below before deploying.
2. Migration 0006 only **adds** a table. Nothing reads it except the insert, so
   a rolled-back Worker ignores it. **Do not drop it** — rolling back twice would
   then fail. It is inert.
3. Rolling back restores the 422 answers and therefore the storm. If the Pub/Sub
   dead-letter queue (see `RTDN-PUBSUB-RUNBOOK.md`) is already attached, the
   storm is bounded at 5 attempts per message instead of unbounded — which is
   why the runbook is worth doing **before** the deploy, not after.

## Production deployment checklist

Nothing below has been done. Each line is an owner action.

**Before**
- [ ] Record the current version id: `npx wrangler deployments list --name be-entitlements`
- [ ] Confirm the three suites pass on the MERGED tree (266/266). This branch
      alone is 261/261; the extra 5 come from `feature/android-usage-limits`,
      so the number to check is the one for the tree actually being released.
- [ ] Apply the dead-letter queue first — `RTDN-PUBSUB-RUNBOOK.md` §1–§5
- [ ] Decide the merge order against `feature/android-usage-limits`, which also
      touches `backend/entitlements` (refusal logging + `welding_premium_*`
      products). This branch is cut from `main` and does not include it.

**Migration**
- [ ] Staging: `npx wrangler d1 migrations apply be-entitlements-staging --remote`
- [ ] Verify: `SELECT name FROM sqlite_master WHERE name='rejected_notifications'`
- [ ] Production: `npx wrangler d1 migrations apply be-entitlements --remote`

**Deploy**
- [ ] Staging: `npx wrangler deploy --env staging`
- [ ] Exercise staging with a refused notification; expect 200 and one row in
      `rejected_notifications`
- [ ] Production: `npx wrangler deploy --env ""` (the empty string is how
      wrangler names the top level)

**Verify, in this order**
- [ ] `npx wrangler tail be-entitlements` for 60 s — the 422 stream must stop;
      expect `notification_refused` lines instead
- [ ] `SELECT why, count(*) FROM rejected_notifications GROUP BY why` — this
      finally names the exact reason, which `tail` could not show
- [ ] Watch `num_undelivered_messages` on the subscription fall to zero
- [ ] Next day: account requests ≈ 4,800/day, not ≈ 123,000
- [ ] Confirm the four live `purchase_links` rows are unchanged and still active

**Afterwards (separate changes, not part of this one)**
- [ ] Turn observability on for `be-entitlements` — a 422 counted as a success
      is why this ran for fourteen days unseen
- [ ] Alert on account-wide daily requests at 50,000
- [ ] Alert on `rejected_notifications` growth — refusals are now silent by
      design, so the table is the only thing that will say so
