# Release 1.1.0 — production and staging runbook (NOT EXECUTED)

Prepared 29 Sep 2026 on `fix/ios-release-hardening`. **Nothing in this file has
been run.** Every step is the owner's to authorise, one at a time, verifying
between steps. Worker commands run from a clean checkout of the reviewed release
commit, never from a working tree with unrelated edits. Never print or paste a
secret value; `wrangler secret put` prompts for it.

## 0. Current production (read-only checks on 29 Sep 2026)
| Worker | Version | Notes |
|---|---|---|
| be-partner | `c4bc80e4-97b2-4690-9481-583fc16812a3` (26 Sep 06:21Z) | **no `accountTrack`**; `LIVE_ENABLED="1"`; `FIREBASE_PROJECT_ID="be-mastery"`; secrets `OPENAI_KEY`, `PUSH_SECRET`, `TURN_KEY_ID`, `TURN_KEY_TOKEN`; D1 migrations 0001–0010 all applied |
| be-push | `086e23a9-fdfc-458f-a8a5-f096e1743119` (26 Sep 05:29Z) | LISTs KV every minute (~1,440/day + up to 144); crons `* * * * *`, `*/10 * * * *` |
| be-polish | `1421fdd3-8603-494f-aebf-1793764cdee1` | secret with a credential-like NAME (§6) |
| be-events | `c2012c8d-3083-4af5-bd30-f1ab7ffe9a6e` | unused `OPENAI_KEY` secret (§7) |
| be-mail | `86e383bd-8e45-4a5a-958a-5eb85f97efad` | Brevo; allows only `https://app.lomonec.com` |
| be-entitlements | none | Premium is not active in 1.1.0 — do **not** create it |

## 1. Order
1. Review, then commit the Phase 3 and Phase 4 changes on the release branch; the owner merges it into `main` (not done here).
2. **be-partner** (§2) — the security fix; before anything else that depends on it.
3. **be-push** (§3) — after be-partner (its `/nudge` route asks be-partner `/programme`).
4. **Website**: `sw.js` and `APP_VERSION` in `index.html` are already **be12-v488** on `release/1.1.0` (next after live v487; the iOS bundle carries the same number); push `main`, poll `https://app.lomonec.com/sw.js` until it shows v488. This publishes the corrected `privacy.html`, About page and help centre — **the privacy URL must show this wording before the App Store submission.**
5. **iOS build** (owner, Xcode): commit `DEVELOPMENT_TEAM`, `cd mobile/ios && npm ci && npm run sync` (production; the script refuses a bundle that is not `be-mastery`), archive, upload to TestFlight.
6. **App Store Connect** tasks (§8).
Staging (§4) can go any time; it touches nothing in production.

## 2. be-partner (production) — server-side General English check
- **Source:** `backend/partner/partner-worker.js` at the release commit (identical to `acac2495`, which staging runs as `d4aece8c`). No new migration.
- **Config** (top-level `wrangler.toml`, unchanged, matches what is deployed): `FIREBASE_PROJECT_ID="be-mastery"`, `ALLOWED_ORIGINS="https://app.lomonec.com,https://salomon1010.github.io,capacitor://localhost"`, `PARTNER_ENABLED="1"`, `LIVE_ENABLED="1"`, `MATCH_WEIGHTS="{}"`, `PAIR_DAYS="7"`, `PARTNER_TIMEOUT_H="24"`, `PUSH_API="https://be-push.nore-ngou.workers.dev"`; D1 `be-partner` (`9ad063a2-…`), R2 `be-partner-audio`, cron `17 3 * * *`; the four existing secrets stay.
- **Command:** `cd backend/partner && npx wrangler deploy`
- **Verify:**
  - `curl -s https://be-partner.nore-ngou.workers.dev/health` → `{"ok":true,"dev":false,"enabled":true}`
  - `curl -s -o /dev/null -w '%{http_code}\n' https://be-partner.nore-ngou.workers.dev/presence` → **401** (the old code answered 200 to anyone; the new one only to a General English account or be-push)
  - in the app, a General English account opens Practice Partner; a Welding account does not see it (and a crafted request gets `403 track`)
- **Expected changes:** Welding accounts → `403 track`; accounts with no synced cloud copy → `403 track_unverified`; the web badge for signed-out visitors shows 0 online; one Firestore read per authenticated request (§5); names containing contact details become "Learner" at the next daily cron (a data change a rollback does not undo).
- **Rollback:** `cd backend/partner && npx wrangler rollback c4bc80e4-97b2-4690-9481-583fc16812a3`

## 3. be-push (production) — KV LIST budget
- **Source:** `backend/push/push-worker.js` at the release commit (marker keys + fuller `forget()`); test `node backend/push/test/kv-marks.mjs`.
- **Config** unchanged: KV `SUBS` = `3a92211829224fc7a8824d500e31d61d`, `PARTNER_API="https://be-partner.nore-ngou.workers.dev"`, `VAPID_PUBLIC_KEY`, secrets `VAPID_PRIVATE_JWK`, `PUSH_SECRET`, crons as today.
- **Command:** `cd backend/push && npx wrangler deploy`
- **Verify:** `npx wrangler tail be-push` for ~10 minutes: within a few minutes a `{"marks":"migrated"}` line; afterwards no per-minute log line at minutes nobody booked. `curl -s https://be-push.nore-ngou.workers.dev/key` → 200. Over the next day the Cloudflare dashboard's KV LIST count falls from ~1,440+/day to about one per booked minute.
- **Rollback:** `cd backend/push && npx wrangler rollback 086e23a9-fdfc-458f-a8a5-f096e1743119` — the `mark:*` / `meta:*` keys it leaves do not match any prefix the old code lists, so they are inert.

## 4. Staging (config committed on the branch; not deployed)
1. `cd backend/entitlements && npx wrangler deploy --env staging` → staging verifies **be-mastery-test** (was be-mastery). Check: `npx wrangler versions view <new id> --name be-entitlements-staging` shows `FIREBASE_PROJECT_ID ("be-mastery-test")`. Staging rows from earlier tests are keyed by be-mastery uids and become unreachable (test data only).
2. `cd backend/partner && npx wrangler deploy --env staging` → `PUSH_API` = be-push-staging; `FIREBASE_PROJECT_ID` is now in the file (no `--var` needed).
3. Optional, staging-only push secret (never the production value): `openssl rand -hex 32` → `cd backend/partner && npx wrangler secret put PUSH_SECRET --env staging` and `cd backend/push && npx wrangler secret put PUSH_SECRET --env staging` with that same new value.
4. `cd backend/push && npx wrangler deploy --env staging` → marker code on staging. be-push-staging currently has **no cron triggers registered** although its config declares two; the likely cause is the free plan's account-wide cron-trigger limit (verify in the dashboard). Do not raise the plan for it.
5. Staging iPhone build: `cd mobile/ios && npm run sync:staging` → the bundle signs in to be-mastery-test and calls the staging Workers (the script refuses anything else).

## 5. Firebase (Spark plan) — monitoring only
`be-mastery` has billing disabled. Firestore reads were **75–577 a day** (Cloud Monitoring, 22–27 Sep). After §2 every authenticated Practice Partner request costs one read (the programme check), and an open Practice Partner screen polls every 8–10 s — roughly 360–450 reads per active learner-hour. Watch it for the first weeks:
```sh
TOK=$(gcloud auth print-access-token); curl -s -H "Authorization: Bearer $TOK" "https://monitoring.googleapis.com/v3/projects/be-mastery/timeSeries?filter=metric.type%3D%22firestore.googleapis.com%2Fdocument%2Fread_count%22&interval.startTime=$(date -u -v-7d +%FT%TZ)&interval.endTime=$(date -u +%FT%TZ)&aggregation.alignmentPeriod=86400s&aggregation.perSeriesAligner=ALIGN_SUM&aggregation.crossSeriesReducer=REDUCE_SUM"
```
If daily reads approach the free quota, the programme check fails closed (Practice Partner answers `track_unverified`) — decide then; no change now.

## 6. be-polish — secret with a credential-like NAME (rotation procedure, owner only)
Finding: one secret on production be-polish has a **name** that looks like a credential value (55 characters, beginning `AQ.`); secret names are visible to everyone with access to the Cloudflare account and in API listings. The deployed be-polish code reads only `env.GEMINI_KEY` and `env.OPENAI_KEY`, so nothing uses that secret.
1. **Identify the issuer:** the `AQ.` prefix is the format of a Google Cloud API key; confirm in Google Cloud console → APIs & Services → Credentials (and Google AI Studio) which key it is and whether it is the same key stored as `GEMINI_KEY`.
2. **Create a replacement** key there, restricted to the Generative Language API.
3. **Store it under the proper name:** `cd backend && npx wrangler secret put GEMINI_KEY` (prompts for the value; a new version deploys at once — no code change).
4. **Verify:** add a YouTube video without captions in the app (General English, Shadow → paste a link) and confirm its lines appear; `npx wrangler tail be-polish` shows no `gemini_401/403`.
5. **Remove the mis-named secret** in the Cloudflare dashboard (Workers → be-polish → Settings → Variables and Secrets → delete), so its name is never typed into a shell history.
6. **Check exposure:** the repository and its history were searched for the value's first characters (result in the Phase 4 report); also check any screenshots, tickets or chats where the Cloudflare secret list was shared.
7. **Revoke the old key** at the issuer (delete it in Google Cloud / AI Studio) once step 4 passes.

## 7. be-events — unused OPENAI_KEY
Verified unused: the deployed be-events code reads only `env.AE` and `env.EXTRA_ORIGINS`; the repository's `backend/events` has no reference to it. Removal (owner): `cd backend/events && npx wrangler secret delete OPENAI_KEY` → then send one event from the app and confirm a new row in the dataset (`./backend/events/query.sh raw`). Deleting the secret does not revoke the OpenAI key; if the same key is used by be-polish, keep it there.

## 8. App Store Connect (owner)
Listing `mobile/ios/appstore/METADATA.md` (+ `METADATA.fr.md`), privacy answers `PRIVACY_ANSWERS.md` (settle the three REQUIRES-OWNER rows), review notes `docs/APPLE_APP_REVIEW.md` § Notes, demo accounts `docs/release/REVIEWER_ACCOUNTS.md`, screenshots per `SCREENSHOTS.md`, no in-app purchases, age rating per `METADATA.md`.
