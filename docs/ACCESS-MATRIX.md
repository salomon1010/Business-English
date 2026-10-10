# BE Mastery access matrix — Visitor / Free / Premium

Written 10 Oct 2026 from the code on `staging` (ad414906 + the portal work).
`docs/TIERS.md` is the commercial source of truth; this file records what the
code **enforces**, where, and the gaps. Nothing here changes a quota or a price.

## 1. The three states

| State | Who | How it is decided |
|---|---|---|
| **Visitor** | No Firebase account on this device | Client: `FBUser` null. Server: no / invalid ID token. |
| **Free** | Signed in, no in-force paid entitlement | be-entitlements `GET /v1/entitlement` → `plan:"free"` (or no entitlement service configured) |
| **Premium** | Signed in, in-force paid entitlement | be-entitlements: `active`, `trialing` or `grace` on any `purchase_links` row of the uid |

One account moves between the states; there is no second account for Premium.
The plan is per **account**, the same on General English and Welding.

### Where a visitor can go (owner, 10 Oct 2026)

| Platform | Visitor without local progress | Visitor with local progress |
|---|---|---|
| Plain web browser at `/bemastery/` | **Landing** (`webGateRender`): what BE Mastery is, both programmes, Free/Premium, Create account / Sign in. No learning until signed in. Flag `web_visitor_gate_enabled` (OFF in production and staging until the portal is live). | App as today |
| Installed home-screen app (PWA) | Onboarding, as today | App as today |
| Play app (TWA) | Onboarding, as today | App as today |
| iOS app | Onboarding, as today | App as today |

The landing is a **front door, not a security boundary**: a visitor who bypasses
it in the browser only reaches what anonymous learners in the apps already have
(the curriculum and progress stored on their own device). What an account
protects is listed in §2 and must be enforced by the Workers.

## 2. Server enforcement, per route

"Repo" = `backend/polish-worker.js` (what staging runs). "Prod" =
`backend/polish-prod/` (what production runs: the 1 Oct code + the game route).

### be-polish (AI)

| Route | Visitor | Free | Premium | Enforced on server? |
|---|---|---|---|---|
| transcribe, tts, captions, polish, repolish, practice chat | Repo: refused when `PREMIUM_ENFORCED=1` (staging). **Prod: allowed** | allowed (per-account 30/min, 600/day when enforced) | allowed | Repo yes (staging). **Prod no** |
| chat purpose `shadow` | allowed (IP limits) | allowed | allowed | IP limits only (by design) |
| AI verdicts: assess, analyse, mvreport, chat `coach`/`report` | Repo: refused when enforced. **Prod: allowed** | metered 3/UTC day (`VERDICT_CAPS`) when enforced | metered 120/day | Repo yes (staging). **Prod no** |
| ytai (own YouTube video) | refused (token required, both versions) | Repo enforced: one 600 s trial; else 1800 s/day | 3600 s/day | yes |
| wm (game hubs) | refused (401) | 5 energy/day per programme | no energy cap; `pack`/advanced need Premium (402) | yes, incl. the programme check via be-partner `/programme` |

### Other Workers

| Worker / route | Visitor | Free | Premium | Track check |
|---|---|---|---|---|
| be-entitlements `/v1/entitlement`, `/v1/purchases/*`, `DELETE /v1/me` | refused | own record only | own record only | — |
| be-partner (Practice Partner, live, reviews) | refused | allowed | allowed | **General English only**, from the account's own Firestore record (`accountTrack`), 403 otherwise |
| be-coach (Smart Coach, staging only) | refused | read-only ops | approve / reschedule / complete | yes (`/programme`) |
| be-push `/nudge` | refused | allowed | allowed | General English only |
| be-push `/subscribe`, `/why`… ; be-events ; be-widget | Origin allow-list / random device id; no account data | — | — | — |
| Firestore `users/{uid}` (progress sync) | — | own document only (security rules) | same | — |

## 3. Premium across platforms

- be-entitlements recomputes one entitlement per uid from **all** that uid's
  `purchase_links`, whatever store sold it (`recompute`, `pickRecord`). A Play
  purchase bound to an account therefore answers Premium for the same account in
  a desktop browser — **by construction; no real store purchase has been made
  yet**, so this is verified in tests, not in the field.
- A purchase belongs to the first account that binds it (409 `bound_elsewhere`
  otherwise); Apple purchases must carry the account's `appAccountToken`; store
  notifications are de-duplicated; a temporary store/API failure binds nothing
  and leaves the current plan as it was; Workers that depend on the service
  answer 503 rather than guess.
- Cancelled but paid up: shown as active with "Cancelled — Premium stays on
  until {date}". Grace: "Payment problem — Premium stays on until {date}".
  Expired / payment pending / "paid, not confirmed yet" each have their own
  message. `revoked` (refund) is treated as not Premium and shows as Free.
- **Buying on the web: not possible, by design.** No web checkout exists or was
  added. A plain browser has no store provider, so it never shows a Manage
  button; a Premium learner sees "Your subscription is managed in {store}".
  The visitor landing names Google Play as the place to buy (the iOS app is not
  approved yet).
- **Production today:** `ENT_API` empty and `billing_enabled` false, so every
  learner is Free and nothing is sold. The production be-entitlements Worker is
  deployed with no store secrets (store routes answer 501).

## 4. Track isolation

General English-only features: Practice Partner (server-enforced in be-partner),
learning nudges (server-enforced in be-push), Shadow Studio V2 / Challenge /
Apply It and analytics events (client-enforced via `isGeneralEnglish()` and
`GE_ONLY_EVENT`; analytics are anonymous, so the client guard is the boundary).
The game hubs check the account's programme on the server. The portal work adds
no feature to either programme and does not touch these checks.
**Not enforced on the server:** be-polish AI routes have no programme check (the
`context.track` field only shapes the prompt); they are shared tools, so this is
consistent with the 26 Sep 2026 "shared tool, scoped data" rule.

## 5. Gaps and decisions for the owner

1. **Production AI is open to anonymous callers** (every be-polish route except
   `ytai` and the game route), held only by in-memory per-isolate limits that the
   repo itself measured as ineffective. The fix exists in the repo
   (`PREMIUM_ENFORCED=1` + `ENTITLEMENTS_URL`, the RateLimiter DO) but is a
   production deploy — and it would end anonymous AI for app learners, which the
   1 Oct 2026 rule ("an AI route needs an account") already decided. Owner call
   on timing.
2. `docs/TIERS.md` vs code: Premium video allowance is 60 min/day in code
   (`YTAI_PREMIUM_SEC_PER_DAY`) vs 240 min in TIERS.md; Free with enforcement on
   gets a one-off 10-minute trial in code vs 30 min/day in TIERS.md. Not changed.
3. be-partner's two OpenAI review routes are held by its D1 burst limit and an
   in-memory IP limit, not the RateLimiter DO.
4. be-push `/wake` compares `PUSH_SECRET` with `!==` (not constant-time).
5. `entitlements/wrangler.toml` still says "NOT DEPLOYED" while
   `polish-prod/README.md` records the 10 Oct production deploy.
