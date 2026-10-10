# AI cost control — audit, controls and rollout

Written 10 Oct 2026 on `staging`, from the code (not from earlier reports).
Code: `backend/ai-guard.js`, `backend/rate-limit.js`, `backend/polish-worker.js`,
`backend/polish-prod/entry.js`. Tests: `backend/test-ai-guard.mjs` (51),
`tests/ai-anon-client.mjs` (7). **Nothing here is deployed.** Production runs
`backend/polish-prod/` (1 Oct code + the game route) and is unchanged until the
owner deploys it.

## 1. Baseline inventory of billable AI calls

10 paid call sites, 3 Workers. No Worker retries a provider call. Before this
work, no provider call had a timeout and no Worker read the provider's usage.

| Route (be-polish body key) | Provider · model | Server-side input caps | Output cap | Auth in production today | Auth on staging (`PREMIUM_ENFORCED=1`) |
|---|---|---|---|---|---|
| raw `audio/*` (transcribe) | OpenAI · whisper-1 | 12 MB; **no duration check** | – | **none** | account |
| `chat` (+ stream) | OpenAI · gpt-4o-mini | system ≤4,000 chars (**from the client**), 40 msgs × 2,000 | 400 tok | **none** | account; `coach`/`report` metered |
| `chat` purpose `shadow` | OpenAI · gpt-4o-mini | as above | 400 tok | none | none (owner, 3 Oct) + own per-IP cap |
| `mvreport` | OpenAI · gpt-4o-mini | system ≤6,000 (client), said ≤2,400 | 700 tok | **none** | account, metered |
| `analyse` | OpenAI · gpt-4.1-mini | transcript ≤4,000 + server prompt | 4,200 tok | **none** | account, metered |
| `repolish` | OpenAI · gpt-4.1-mini | ≤4,000 + 4 × 1,600 | 1,200 tok | **none** | account |
| `text` (polish) | OpenAI · gpt-4o-mini | ≤400 + 12 × 200 | 320 tok | **none** | account |
| `assess` | OpenAI · gpt-4o-audio-preview (3 fallbacks on 404), then Whisper | base64 ≤6 MB, target ≤400 | 600 tok | **none** | account, metered |
| `tts` | OpenAI · gpt-4o-mini-tts | ≤600 chars, style ≤180 | – | **none** | account |
| `ytai` | Google · gemini-3.6-flash on a YouTube URL | ≤1,800 s of video | 60,000 tok | account (Firebase verify) | account, seconds budget |
| be-partner `POST /pairs/:id/review`, `/live/:id/review` | OpenAI · gpt-4o-mini | ≤4 × 4,000 chars | 3,400 tok | account + GE track | same |

Free (no provider): `captions` (YouTube scrape), `wm` (game state). The
Durable Object rate limiter holds every route in the repo version. **Production's
1 Oct code uses per-isolate in-memory Maps** for its IP limits. The repo
measured these as ineffective (24 of 24 requests passed a limit of 20).

## 2. Anonymous access and cost exposure

**Production today: every AI route except `ytai` and the game route answers a
caller with no account.** The only brakes are an Origin header (forgeable
outside a browser) and the per-isolate Maps. `chat` and `mvreport` accept the
system prompt from the client, so they work as a general model proxy.

Estimated cost per request, from `ai-guard.js` `preCostUsd` (output assumed at
its cap; **list prices unverified**, see §6):

| Request | Estimate |
|---|---|
| transcribe — 60 s take | $0.006 |
| transcribe — worst case (body ≤12 MB, counted up to 30 min) | $0.18 |
| tts — 600 chars | $0.010 |
| chat — typical / worst case input | $0.0003 / $0.0034 |
| analyse — one minute of speech (output at 4,200-token cap) | $0.0074 |
| assess — 25 s clip | $0.016 |
| ytai — 5-min window / whole 30-min video | $0.027 / $0.16 |

**Highest exposure, in order:**
1. **transcribe.** Anonymous in production, has no duration check, and is billed per minute. A scripted caller sending 12 MB files can cost about $0.18 a call, with no per-account brake.
2. **assess.** The audio model is the most expensive per token.
3. **chat / mvreport.** Cheap per call, but they act as an open proxy, so the risk is volume rather than unit price.
4. **ytai.** High unit cost, but account-gated and cached.

The bounding factor today is the provider account's monthly budget cap, not the
code.

## 3. What changed, and why

| Change | Where | Default | Why |
|---|---|---|---|
| **Anonymous policy** `ANON_AI_POLICY` = off / report / enforce | ai-guard `anonGate`; polish-worker and prod `entry.js` | **off** | A caller without a *verified* Firebase token (a forged `Bearer x` counts as anonymous) gets a small per-IP daily allowance per kind of work, plus one **global anonymous pool counted in estimated money**, so fresh IP addresses buy nothing extra. |
| **Refunds** | ai-guard `settle` + DO `release` | always on | Before: a verdict was spent before validation and never returned, so a 400, 413, 502 or timeout cost the learner a verdict. Now verdicts, video seconds and anonymous allowances come back when the request ends ≥400. Rate-limit windows are not refunded; they are abuse ceilings. |
| **One identical request in flight** | ai-guard `inflightGate` | **off** (`AI_DEDUPE=1` on staging) | A double tap cannot spend two verdicts or pay twice. The second request gets 409 `duplicate_in_flight`, and nothing is charged. |
| **Provider timeouts** | ai-guard `pfetch` | always on | 30–90 s per route; 300 s for Gemini. Times are measured to the response headers, so streams are not cut. `AI_TIMEOUT_MS` overrides. |
| **Provider usage captured** | `pfetch` | always on | Reads tokens, audio tokens, Whisper `duration` and Gemini `usageMetadata` from the response. |
| **Usage ledger** | ai-guard `ledger` | writes only with an `AI_LEDGER` binding | One Analytics Engine row per billable request (§5). |
| **Gemini key leak fixed** | polish-worker `geminiCaptions` | – | `keyLen` / `keyFp` no longer reach the client; on 401/403 they go to the Worker log. Production's `deployed.js` still returns them until it is redeployed from this code (§8). |
| **Client** | index.html `aiAllowTap`, `aiAnonOut`, `aiNoAccount` | inert until enforce | A `scope:"anon"` refusal shows the existing "Sign in to use the AI features" path instead of a generic error, and is not filed as a spent Free allowance. |

**What did NOT change:**
- the Free verdict quota (3/day) and the Premium fair-use ceiling (120/day);
- the video seconds budgets;
- `PREMIUM_ENFORCED` in any environment;
- prices, SKUs and payment flows;
- the anonymous mobile experience (the policy ships off);
- Welding;
- the track checks.

## 4. Quotas — proposed vs in force

| Quota | Value | Status |
|---|---|---|
| Free AI verdicts / UTC day | 3 | **in force on staging** (unchanged) |
| Premium AI verdicts / UTC day | 120 | **in force on staging** (unchanged) |
| Free / Premium video seconds | 1,800 (one-off 600 s trial with enforcement on) / 3,600 | in force on staging (unchanged) |
| Visitor transcribe / IP / day | 40 | **proposed** — code default, policy off |
| Visitor practice chat / IP / day | 40 | proposed |
| Visitor polish + repolish / IP / day | 15 | proposed |
| Visitor TTS / IP / day | 150 | proposed |
| Visitor AI verdicts / IP / day | 3 | proposed (= Free) |
| Global anonymous pool / UTC day | $10 estimated | proposed |
| Shadow helpers (anonymous, per IP) | 20/min, 400/day | in force (unchanged, 3 Oct) |

Every proposed value can be overridden without a code change:
`ANON_AI_<CLASS>_PER_DAY` (CLASS = TRANSCRIBE, CHAT, POLISH, TTS, VERDICT) and
`ANON_AI_POOL_USD`.

**Known limits of the proposal:**
- **Shared IP addresses.** A per-IP allowance can hold several anonymous learners behind one carrier NAT. That is why it should run in `report` first. The global pool is the real brake on the bill.
- **No platform distinction.** The policy cannot tell a web visitor from an anonymous app learner. The iOS app's Origin is `capacitor://localhost`, while the Play app, an installed PWA and a browser tab all send `https://app.lomonec.com`, and Origin is forgeable anyway. So it applies to every anonymous caller on every platform. The new web landing has **no AI at all**: a web visitor must sign in before any activity.

## 5. The ledger

Analytics Engine, binding `AI_LEDGER`. Staging dataset: `be_ai_ledger_staging`
(declared in `backend/wrangler.toml`, not deployed). No audio, transcript,
prompt, token, raw uid or IP. The caller is a 16-hex HMAC under the
`LEDGER_SALT` secret; with no salt, no caller id is written.

| Column | Field |
|---|---|
| blob1 | route |
| blob2 | track_declared (the client's claim; recorded, never trusted) |
| blob3 | state: visitor / account / free / premium / token_unverified / no_token |
| blob4 | provider |
| blob5 | model |
| blob6 | outcome: ok / limited / refused / invalid / provider_error / provider_timeout / anon_refused_ip / anon_refused_pool / anon_would_refuse_* / duplicate_in_flight |
| blob7 | caller_hmac |
| blob8 | cost_method: provider-usage / request-estimate / video-seconds-estimate / not-billed |
| blob9 | anon_policy |
| blob10 | refunded |
| double1 | status |
| double2 | prompt_tokens |
| double3 | completion_tokens |
| double4 | audio_sec |
| double5 | tts_chars |
| double6 | input_chars |
| double7 | verdicts_charged |
| double8 | est_usd_micro |
| double9 | provider_calls |
| double10 | billed_calls |
| double11 | latency_ms |

Example questions (Analytics Engine SQL API):

```sql
-- usage and estimated spend by route and access state, last 7 days
SELECT blob1 AS route, blob3 AS state, count() AS n, sum(double8)/1e6 AS est_usd
FROM be_ai_ledger_staging WHERE timestamp > NOW() - INTERVAL '7' DAY
GROUP BY route, state ORDER BY est_usd DESC;

-- how often learners are blocked, and why
SELECT blob6 AS outcome, blob3 AS state, count() AS n
FROM be_ai_ledger_staging WHERE timestamp > NOW() - INTERVAL '7' DAY AND double1 >= 400
GROUP BY outcome, state ORDER BY n DESC;

-- errors and timeouts that cost money (billed but failed)
SELECT blob1, blob6, count() AS n, sum(double8)/1e6 AS est_usd
FROM be_ai_ledger_staging WHERE double10 > 0 AND double1 >= 400 GROUP BY blob1, blob6;
```

**Reconciliation.** These are estimates. Compare the weekly `sum(est_usd)` by
model with the OpenAI usage dashboard (per model, per day) and the Google AI
Studio billing export. The token columns come from the providers' own `usage`
fields, so only the price table needs correcting; it lives in `ai-guard.js`
`PRICES`.

**Production limit.** Production's wrapper cannot see inside the old code's
provider calls. Its rows are `request-estimate`, with output assumed at the cap
and every 2xx assumed billed, so they overstate cost. `ytai` cache hits are also
counted as billed there.

## 6. Cost assumptions and unknowns

- **Prices (USD) are the author's list-price knowledge, all `verified:false`:**
  - gpt-4o-mini: $0.15 in / $0.60 out per 1M tokens
  - gpt-4.1-mini: $0.40 / $1.60 per 1M tokens
  - gpt-4o-audio-preview: $2.50 text in, $40 audio in, $10 out per 1M tokens
  - gpt-4o-mini-audio-preview: $0.15 text in, $10 audio in, $0.60 out per 1M tokens
  - whisper-1: $0.006 per minute
  - gpt-4o-mini-tts: ≈ $0.015 per minute of speech
  - Gemini: the repo's own figure of $0.08 per 15 minutes of video
- **Verify every one** against the provider pricing pages and the invoices before quoting a figure.
- **Conversion assumptions:** 4 characters per token; spoken English at 15 characters per second; the recorder at ≈ 4,000 bytes per second (Opus 32 kbit/s); assess WAV at 32,000 bytes per second; about 10 audio tokens per second for assess.
- **Unknowns:**
  - real token counts per session in production (no ledger there yet);
  - Gemini per-token pricing for this model;
  - whether OpenAI bills a 404 on the assess model fallback (assumed not).

## 7. Security and compatibility risks

- **Chat proxy.** `chat` and `mvreport` still take their system prompt from the client. A signed-in caller can use them as a general model proxy within the per-account limits. Closing this means moving the prompts server-side, a larger change.
- **Refunds on billed failures.** A request that the provider billed but that ends ≥400 (e.g. unparseable JSON) is refunded to the learner. That is learner-friendly but costs us; the ledger counts it (`billed_calls > 0`, `status ≥ 400`).
- **Fail-open limiter.** The Durable Object fails *open* if it is unreachable (unchanged, deliberate). The provider budget cap remains the backstop.
- **Track isolation.** Unchanged: Practice Partner, nudges, Smart Coach and the game hubs check the account's programme on the server. be-polish AI routes have no track check (shared tools).

## 8. Staging validation and rollback

1. Deploy the repo Worker to **staging** (`cd backend && npx wrangler deploy --env staging`). The owner decides; this is not done.
2. Set `LEDGER_SALT` on staging (`wrangler secret put LEDGER_SALT --env staging`).
3. Use the app on staging for a day, then run the SQL in §5 against `be_ai_ledger_staging`.
4. **Production, in order** (each step needs owner approval):
   a. redeploy `polish-prod` with this `entry.js` and no new config — behaviour identical, and the Gemini key leak stays until `deployed.js` is patched;
   b. add the `AI_LEDGER` binding (dataset e.g. `be_ai_ledger`) plus `LEDGER_SALT`;
   c. set `ANON_AI_POLICY="report"` for a week;
   d. read the would-refuse counts and choose the values;
   e. switch to `enforce`.

**Rollback:**
- `ANON_AI_POLICY="off"` takes effect on the next request (tested: D9).
- Removing `AI_DEDUPE` turns the duplicate guard off.
- The previous production version id is in `backend/polish-prod/README.md`.

## 9. Decisions that need the owner

1. Whether to put production's anonymous AI behind the policy at all, and the visitor allowances and pool size (§4).
2. When to turn on `PREMIUM_ENFORCED` in production. That decides the account rule and the Free/Premium meter; it is separate from this.
3. Whether a provider-billed failure should be refunded to the learner (current choice: yes).
4. Verifying the price table against the invoices.
5. Patching production's `deployed.js` for the Gemini key leak (a production deploy).

## 10. Rollout status (10 Oct 2026, afternoon)

| Stage | Status | Evidence |
|---|---|---|
| Local implementation | **done** | commits `0a9fc456` and `bec7f39c` on local `staging`; NOT pushed |
| Local tests | **pass** | `backend/test-ai-guard.mjs` 62/62 (incl. L1–L5: a refused request makes zero provider calls; M1–M2: possibly-billed failures are costed; N1–N4: production wrapper report mode, 5xx costing, duplicate guard). All other server suites and the client suites pass. |
| Staging deploy | **done** | `be-polish-staging` version `43245010-10a4-42dc-89f1-ceaf275df6c4`, deployed from `bec7f39c`'s tree. `LEDGER_SALT` set as a staging secret. Previous version `956df561-8b2c-487c-a812-749564cd5973`. |
| Staging validation | **done, 7/7** | `node backend/validate-ai-cost-staging.mjs` against the deployed Worker with a throwaway `be-mastery-test` account (deleted): no account → 401; Shadow helper anonymous → 200; Free allowance 1/3 → a 400 refunded (next reads 2/3) → duplicate pair 200 + 409 → 4th verdict 429 `scope:verdicts limit:3`. |
| Staging ledger | **verified** | 8 rows in `be_ai_ledger_staging` for the 8 requests, outcomes ok / invalid+refunded / duplicate_in_flight / limited / refused, 16-hex caller HMAC, no content. Real `analyse` usage: 1,707 input / 832–1,031 output tokens ≈ **$0.002–0.0023** (the pre-call estimate, with output at its cap, is $0.0074 — deliberately high). |
| Anonymous policy on a deployed Worker | **not validated** | Staging has `PREMIUM_ENFORCED=1`, so the policy never runs there. It is covered by local tests only (D1–D9, E1–E2, K1–K5, N1–N4). |
| Production | **nothing deployed** | `be-polish` production is still `fc218aad-47c1-4e68-a428-5977e13060dd` (10 Oct game-route deploy). |

**Staging rollback:** `cd backend && npx wrangler rollback 956df561-8b2c-487c-a812-749564cd5973 --env staging`.

### The mobile limitation, restated

The server **cannot tell a web visitor from an anonymous learner in the iOS app,
the Play app or an installed PWA.** The Play app, the PWA and a browser tab all
send `Origin: https://app.lomonec.com`. The iOS app sends `capacitor://localhost`,
which any script can also send. No client header can be trusted. So
`ANON_AI_POLICY=enforce` would hold anonymous **app** learners too.

That is why the report-only week must answer one question before any
enforcement: how many visitor rows per day come from legitimate learners? The
signals are steady low volumes across many caller HMACs, spread over the routes
a session uses. Abuse looks like high volume from few HMACs, or a single route
(typically `chat` or `transcribe`).

The web landing itself has no AI: a web visitor signs in before any activity
(`web_visitor_gate_enabled`, client-side, separate from this).

### Proposed production release (needs the owner's explicit approval — NOT done)

**P1 — wrapper in report-only mode** (no learner-visible change):

```diff
# backend/polish-prod/wrangler.toml
 [vars]
 FIREBASE_PROJECT_ID = "be-mastery"
 ENTITLEMENTS_URL = "https://be-entitlements.nore-ngou.workers.dev"
 PARTNER_API = "https://be-partner.nore-ngou.workers.dev"
+ANON_AI_POLICY = "report"
+
+[[analytics_engine_datasets]]
+binding = "AI_LEDGER"
+dataset = "be_ai_ledger"
```

Then:
```
openssl rand -hex 24 | npx wrangler secret put LEDGER_SALT      # in backend/polish-prod, value never printed
bash backend/polish-prod/build.sh --deploy
```

What P1 changes:
- Every non-game request is classified.
- Visitor requests consume the per-IP and pool counters but are never refused.
- One ledger row per billable request.
- Provider calls, the old code's answers, the game route and signed-in learners are untouched.

**Cost of P1:**
- For a visitor request, up to two Durable Object round trips (per-IP + global pool), and a Firebase token verification when a Bearer header is present.
- All visitor requests pass through ONE global-pool object, which processes them one at a time. That is fine at this app's volume, but it is the first thing to watch if latency rises.

**Rollback:** `npx wrangler rollback fc218aad-47c1-4e68-a428-5977e13060dd` (from `backend/polish-prod`), or set `ANON_AI_POLICY = "off"`.

**P2 — after about a week of report data:**
1. Choose the allowances and the pool size from the evidence (the `ANON_AI_*` variables).
2. Optionally set `AI_DEDUPE = "1"`.
3. Then `ANON_AI_POLICY = "enforce"`.

This is a separate approval.

**Not part of this rollout:**
- `PREMIUM_ENFORCED` or any blanket account rule;
- changes to the Free (3) or Premium (120) verdict quotas or the video budgets;
- mobile builds.

### Security finding outside this change

Production `be-polish` has a Worker **secret whose NAME is a credential-shaped
string** (it begins `AQ.Ab8…`, the shape of a Google API key or token). Secret
*names* are shown in plain text in the dashboard and the API. If the string is a
live key:
1. treat it as exposed and rotate it with whoever issued it;
2. delete that secret (`npx wrangler secret delete '<name>'` in `backend/polish-prod`).

Deleting it is a production change — owner approval.
