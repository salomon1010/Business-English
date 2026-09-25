# be-entitlements — who is on which plan (Phase 7)

**Not deployed.** The client's `ENT_API` is empty, so every learner is Free
and no request is made. Nothing in production changes until the owner deploys
this Worker, sets `ENT_API`, and (Phase 9) a store adapter is built.

## The chain

```
Store / provider (Google Play · App Store · promo)
        │  signed notification / purchase token
        ▼
src/adapters.js          provider → RECORD   (the only code that knows a provider)
        ▼
D1 table `entitlements`  one row per Firebase uid (no row = Free)
        ▼
src/entitlement-core.js  RECORD + server clock → VIEW   (pure; fail closed to Free)
        ▼
GET /v1/entitlement      the caller's VIEW, for the uid in their verified token
        ▼
app (web / iOS / Android) displays it; AdEligibility reads view.ads
```

The VIEW is all a client ever sees:

```json
{ "plan": "premium", "paid": true, "state": "active", "ads": false,
  "capabilities": { "ad_free": true, "ai_allowance": "enhanced", "practice_allowance": "enhanced" },
  "expiresAt": 1790000000000, "source": "promo", "checkedAt": 1789000000000 }
```

No provider identifier, product id, customer id or uid is ever in it.

## Plans, statuses, sources

- **Plans** (`PLANS`): `free`, `premium`. A plan grants *capabilities*, never
  tracks. General-English-only features stay behind `isGeneralEnglish()` in
  the app and the partner Worker's `TRACKS`; no plan changes that. Add a plan
  by adding an entry.
- **Products** (`PRODUCTS`): what a store sells → the plan it grants
  (`premium_monthly`, `premium_annual` and `premium_promo` → `premium`).
- **Statuses**: `active`, `trialing`, `grace` are in force until `expires_at`.
  `expired` and `revoked` are not. A record that has not started yet reads
  `pending` (Free). Anything malformed reads `invalid` (Free).
- **Sources**: `google_play`, `app_store`, `web`, `promo`, `manual`. These
  are labels, not ids.

## Routes

| route | who | what |
|---|---|---|
| `GET /health` | anyone | liveness |
| `GET /v1/entitlement` | signed-in learner | their VIEW; 401 without a valid token |
| `DELETE /v1/me` | signed-in learner | erase their row (account deletion) |
| `POST /v1/admin/grant` | owner (`ADMIN_TOKEN`) | manual / promotional grant; 404 if no secret is set |
| `POST /v1/billing/google_play` | Google Pub/Sub (RTDN) | OIDC-authenticated (aud + service-account email); applied once per `messageId`; re-reads the subscription from Google |
| `POST /v1/billing/app_store` | Apple (Server Notifications V2) | JWS + pinned x5c chain; applied once per `notificationUUID` |
| `GET /v1/purchases/account-token` | signed-in learner | the account's StoreKit `appAccountToken` (HMAC of the uid) |
| `POST /v1/purchases/verify` | signed-in learner | `{provider, …evidence}` — verified WITH THE STORE, bound to the caller (first bind wins, 409 otherwise), entitlement recomputed |
| `POST /v1/purchases/restore` | signed-in learner | `{provider, items[]}` — same, per item; answers only how many bound |
| `GET /v1/rewards/verify/admob` | AdMob (SSV) | ECDSA-signed callback against Google's published keys (`ADMOB_SSV_ENABLED="1"`) |
| `POST /v1/rewards/start` | signed-in learner | a single-use nonce for one rewarded ad; the kind must be enabled server-side (`REWARD_KINDS_ENABLED`, empty = none); refused for Premium; daily cap per kind |
| `POST /v1/rewards/verify/:provider` | the AD NETWORK, server to server | marks the nonce watched; `provider_txn` UNIQUE (one ad → one session). `mock` only with `MOCK_REWARDS="1"` (dev/test); `admob` 501 until Phase 9 SSV |
| `POST /v1/rewards/claim` | signed-in learner | credits the kind once (one conditional UPDATE); a replay returns `credited:false` |
| `GET /v1/rewards` | signed-in learner | their balances |

## Why a client cannot give itself Premium

- The uid comes only from a Firebase ID token verified against Google's JWKS
  (RS256, `aud`/`iss` = the project, `exp`/`iat`). There is no route where a
  client names a uid, and none where a client writes a plan.
- Query parameters, headers and bodies are not read by the learner routes.
  `X-Dev-User` works only with `DEV_AUTH="1"`, which is the local wrangler env.
- The admin route needs a separate 32+ character secret, compared in constant
  time. A Firebase token is not an admin credential.
- The app's cached copy (`localStorage.be_ent_view`) is for drawing the screen.
  It is bound to the uid, has a 12-hour TTL, is never displayed past its own
  `expiresAt`, is outside `S` (so never synced to Firestore), and is replaced
  by every server answer. Editing it changes what one screen draws, never what
  a Worker grants. **Every paid capability must be enforced where it is spent**:
  the Polish Worker's AI allowances, when they exist, check this service
  server-side (a service binding or a signed view), never a client flag.

## Tests

`node backend/entitlements/test/run.mjs` runs 61 checks (41 entitlement + 20 rewarded);
`node backend/entitlements/test/billing.mjs` runs 60 store checks (Google, Apple, AdMob) with real
cryptography — a generated service account, an openssl-made certificate chain, a P-256 SSV key. They use the real
`handle()`, a real SQLite database (`node:sqlite`) built from the real
migration, and genuinely RS256-signed tokens from a key generated per run. No
wrangler, Cloudflare or Firebase is needed.

## Setup (owner, when billing is ready — not before)

```
cd backend/entitlements
npx wrangler d1 create be-entitlements                 # paste the id into wrangler.toml
npx wrangler d1 migrations apply be-entitlements --remote
npx wrangler secret put ADMIN_TOKEN                     # >= 32 random characters
npx wrangler deploy --env ""
```

Then set `ENT_API` in `index.html`, and add the Worker's origin to nothing
else: it serves only `app.lomonec.com` and `capacitor://localhost`.

## Phase 9 — stores (see docs/PHASE9-ARCHITECTURE-DECISION.md)

`src/billing.js` is the provider interface (`google_play`, `app_store`, a `revenuecat` slot);
`purchase_links` (migration 0003) binds each store purchase to ONE account and the
`entitlements` row is derived from an account's links. Configuration, all secrets / vars:
`GOOGLE_SA_JSON`, `PLAY_PACKAGE`, `RTDN_AUDIENCE`, `RTDN_SA_EMAIL`, `APPLE_BUNDLE_ID`,
`APPLE_ROOT_SHA256` (copy and check it from https://www.apple.com/certificateauthority/),
`APPLE_ENVIRONMENTS`, `APP_ACCOUNT_SECRET`, `ADMOB_SSV_ENABLED`. Without them each route answers 501.

**Phase 10 limits.** Every request with a `content-length` over `MAX_BODY`
(256 KB) is refused with 413. The purchase routes (`verify`, `restore`,
`account-token`) allow `PURCHASE_PER_MIN` (10) calls per account per minute,
then answer `429 rate` without calling the store — a D1 counter in
`rate_hits` (migration 0004). A Google failure is `502 google_api`; the app
reads any 5xx / network failure after a store payment as "paid, not confirmed
yet" and re-sends what the store holds at the next launch.
