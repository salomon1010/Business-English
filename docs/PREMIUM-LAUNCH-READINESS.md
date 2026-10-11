# Premium + Smart Coach — launch readiness (10 Oct 2026)

Status: **READY FOR REVIEW — DO NOT MERGE OR DEPLOY TO PRODUCTION.**
Read-only audit of `staging` (HEAD after `a98aa589`), the live Workers and both store
consoles. Nothing was enabled, deployed, submitted or purchased. No credential or payment
value is recorded here.

## 1. What exists

| Area | State | Evidence |
|---|---|---|
| Play verification | Built. `subscriptionsv2.get` server to server, acknowledge only after a verified active/grace/trial state, RTDN with Google OIDC, voided purchases → revoked, upgrades supersede, pending → `payment_pending` (never acknowledged), duplicates dropped. | `backend/entitlements/src/google-play.js`, `src/billing.js` |
| Apple verification | Built. StoreKit 2 JWS, x5c chain pinned to Apple Root CA G3, bundle id + environment checks, Notifications V2 (REFUND/REVOKE by name, everything else from the signed records), stale-notification guard, `appAccountToken` = HMAC(uid). No App Store Server API key needed. | `src/app-store.js`, `src/billing.js` |
| Account binding | Firebase ID token verified (RS256, aud/iss = project). A purchase is owned by ONE account (first bind wins, 409 otherwise). Restore across devices and platforms; `DELETE /v1/me` erases. | `src/firebase-auth.js`, `entitlements-worker.js` |
| Entitlement | `resolve()` fails closed to Free. Five capabilities, `premium_monthly` / `premium_annual`. | `src/entitlement-core.js` |
| Client | iOS: StoreKit plugin, finishes only after our server answers. Android native shell: `BEPlayBilling` wired before the TWA path. Prices always from the store. Launch reconcile. Pending / "paid, not confirmed" states. Display only. | `index.html` Billing / BillingProviders, `BEStoreKitPlugin.swift`, `BEPlayBillingPlugin.java` |
| AI enforcement (staging code) | `premiumGate` asks be-entitlements, fails closed (503). Verdicts metered: Free 3 / Premium 120 a day. Own-video minutes: Free 10-min trial once, Premium 60 a day. Refund of allowance on errors, dedupe, ledger. | `backend/polish-worker.js`, `ai-guard.js` |
| Smart Coach | Worker + Durable Object, auth via be-entitlements, programme check via be-partner, 30/min + 600/day per account, game rounds confirmed against be-polish's RateLimiter. Plans are Premium server-side (402). **No AI calls, no cron.** | `backend/coach/` |

## 2. Store configuration (read from the consoles, 10 Oct 2026)

| | App Store Connect | Google Play | `docs/TIERS.md` |
|---|---|---|---|
| Monthly `premium_monthly` | US **$2.99**, 3-day free trial, READY_TO_SUBMIT | US **$4.99**, offer `trial3d` (3 days free), ACTIVE | $2.99 + 3-day trial |
| Annual `premium_annual` | US **$19.99**, 3-day free trial, READY_TO_SUBMIT | US **$19.99**, **no trial offer**, ACTIVE | $19.99 + 3-day trial |

Apple matches the spec; **Play does not** (monthly price, annual trial). Apple's products are
not live until they are submitted with an app build.

## 3. Live state

| Worker | Production | Staging |
|---|---|---|
| be-entitlements | deployed (401 without a token), **no secrets at all** → every account Free, store routes 501 | deployed, secrets `ADMIN_TOKEN`, `APP_ACCOUNT_SECRET`, `GOOGLE_SA_JSON`, `PLAY_TOKEN_KEY` |
| be-polish | 1 Oct code + game route + ai-guard (`polish-prod/`) — **enforces no Premium, no metering** | full tiers, `PREMIUM_ENFORCED=1` |
| be-coach | **does not exist** | `be-coach-staging` |
| Client | `billing_enabled=false`, `smart_coach_enabled=false`, `ENT_API=""` | all on |

## 4. Tests run (10 Oct 2026, all local, no network, no money)

Entitlements 61/61 + billing 100/100 · premium-gate 92/92 · rate-limit 73/73 · ai-guard 62/62 ·
wm-game 62/62 · ytai-tiers 23/23 · coach 40/40 · smart-coach-engine 46/46 · smart-coach 35/35 ·
premium-boundary 53/53 · free-premium-contract 89/89 · billing-client 50/50 ·
entitlement-client 45/46 · premium-acquisition 45/45 · premium-value 90/90 · subscription 29/29 ·
ios-storekit 32/32 · monetization-qa 31/31 (210 renders) · android-shell 18/18 · play-parity 8/8 ·
track-isolation 23/23 · welding-premium 42/43.

The two failures are stale expectations, not defects: entitlement-client 40 expects Welding
without Shadow V2 (Welding has the same studio since the "Welding must match General
English" rule); welding-premium 41 expects "240 video minutes", but Premium was cut to 60 on
6 Oct (server `YTAI_PREMIUM_SEC_PER_DAY = 60*60`, copy `YT_MIN_PREMIUM=60` — they agree).

**Not tested:** any real store transaction (Apple sandbox, Play licence tester), RTDN /
Notifications V2 delivery, a device purchase.

## 5. Blockers and risks

**Must fix before selling**
1. **Production be-entitlements has no secrets**: `GOOGLE_SA_JSON`, `PLAY_TOKEN_KEY`,
   `APP_ACCOUNT_SECRET` (≥32 chars, never changed afterwards), `ADMIN_TOKEN`; plus the RTDN
   Pub/Sub topic + push subscription (`RTDN_AUDIENCE`, `RTDN_SA_EMAIL`) and the App Store
   Server Notifications V2 production URL.
2. **Production be-polish enforces nothing.** Selling AI allowances means deploying
   `polish-worker.js` to production with production vars (`PREMIUM_ENFORCED=1`,
   `ENTITLEMENTS_URL`, `AI_LEDGER`, `LEDGER_SALT`, `WM_PACK`, the RateLimiter) — which also
   releases the metering for EVERY account (Free drops to 3 AI verdicts a day and a one-off
   10-minute own-video trial). That is the product change, not a side effect.
3. **Smart Coach has no production Worker**: add a production env (Durable Object +
   `RATE_LIMITER` bound to the production be-polish script), a production URL in the client
   (today only `beEnv()` staging), then the flag.
4. **Play pricing**: monthly $4.99 → $2.99, and add `trial3d` to the annual base plan — or
   change the spec. Apple's products must be submitted with a build.
5. **Android client**: (a) no `obfuscatedAccountId` on the purchase, so ownership relies on
   "first bind wins"; (b) purchase updates outside an open purchase call are dropped (a
   pending purchase that clears later reaches the server only at the next launch);
   (c) `ITEM_ALREADY_OWNED` shows "failed" instead of offering Restore.
6. **Real-store sandbox tests** (§6) have never run.

**Should fix / accept knowingly**
7. Play refund then restore: a later verify can overwrite `revoked` with Google's current
   state (open question since Phase 10).
8. An RTDN for a purchase no account has bound yet is skipped; acknowledgement then depends
   on the app's next-launch reconcile (Play refunds unacknowledged purchases after 3 days).
9. `chat` takes its purpose and prompt from the client, so a Free account can run coach-like
   prompts as `practice` without spending verdicts (bounded by 30/min, 600/day per account).
10. `advanced_progress`, `recommended_content` and `ad_free` are enforced on the device only
    (their data and the ads live there); a modified client could unlock them.
11. The web sells nothing; with billing on, web learners see lock cards with no way to buy
    there — the copy must point to the apps.
12. Smart Coach reminders are push on iPhone only; Android and the web get in-app reminders.
13. Privacy policy §5b/§7b and the Play Data safety form must describe purchases before
    launch; App Privacy answers in App Store Connect likewise.
14. A Sign in with Apple private key (`LRT44K2796`) was printed in a working session on
    10 Oct 2026 — rotate it (new key → Firebase Apple provider → revoke the old one).

## 6. Launch checklist (each step needs the owner's go-ahead)

**Phase A — sandbox, no production change**
1. Fix §5.5 (Android client) on `staging`; update the two stale tests.
2. Play: add licence testers; build a STAGING Android bundle (vc ≥ 17) for internal testing;
   be-mastery-test needs the Google safelist step (or use e-mail sign-in) — sign-in on a
   staging build is limited by design.
3. Play test purchases against be-entitlements-staging: buy monthly with trial, cancel,
   resubscribe, upgrade to annual, pending payment (slow card), refund in Play Console,
   restore on a second device, account deletion. Confirm acknowledgement within minutes.
4. Apple: TestFlight staging build + sandbox Apple ID: buy, Ask to Buy, renewal (accelerated
   sandbox renewals), expiry, refund via sandbox, restore, a second device.
5. Smart Coach on staging with a Premium sandbox account: approve a plan, complete via a
   confirmed game round, pause/cancel; Free account gets 402 on plan actions.

**Phase B — production configuration (behind flags, nothing visible yet)**
6. Set production be-entitlements secrets + RTDN + Apple notification URL; verify
   `GET /v1/entitlement` for a real account.
7. Fix Play prices/offers per the decided spec.
8. Deploy be-coach production (no cron).
9. Deploy the full `polish-worker.js` to production (metering for everyone) — the biggest
   learner-visible change; announce the new Free limits.

**Phase C — switch on**
10. `ENT_API` + `billing_enabled` + `smart_coach_enabled` in `FLAGS_DEFAULT`; production
    Android build + iOS build submitted with the subscriptions; staged rollout.
11. Watch: be-entitlements errors, RTDN acknowledgements, AI ledger cost, 429 rates.

## 7. Rollback

| Change | Undo |
|---|---|
| Client flags | `billing_enabled` / `smart_coach_enabled` false + cache bump (web at once; apps need a build, or the server routes off) |
| be-polish full deploy | `wrangler rollback` to the current wrapper version (record its id first; today's is in `backend/polish-prod/README.md` / memory) |
| be-entitlements secrets | remove the secrets → store routes answer 501, everyone reads Free; existing purchase rows stay |
| be-coach | delete the production Worker or unset its URL; the client shows "could not be reached" |
| Store prices | change back in the console (Play price changes notify existing subscribers) |
| Subscriptions sold | cannot be "undone": refunds are per purchase in each console — the reason for Phase A |

## 8. Next action requiring approval

**Phase A, steps 1–2:** fix the three Android purchase gaps and the two stale tests on
`staging`, then build a staging Android bundle (vc 17) for internal testing so licence
testers can make Play test purchases against be-entitlements-staging. No production
Worker, configuration, price or flag changes.
