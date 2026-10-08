# Closing the live anonymous-`ytai` exposure — production release plan

> **Integration note (2 October 2026).** This file is kept as the *production
> record*: the ytai account requirement described here IS live (be-polish
> `47bdb7d8`, web `be12-v490`, `main fa580172`). The Premium line
> (`feature/product-boundary-implementation`) wrote its own, unexecuted copy of
> this plan and a **different, larger** `backend/polish-worker.js` — one that
> keeps this requirement (`ytaiAccount`, verified before anything else, in both
> modes) and adds server-side Premium enforcement and a Durable Object rate
> limiter. The unified staging candidate adopts THAT worker. So the file deployed
> to production today is no longer the file in the tree: the next be-polish
> production deploy carries more than this record describes, and needs its own
> decision. See `docs/ADS-IOS-RELEASE.md` and `docs/release/STAGING_RC.md`.

**Branch:** `release/ytai-security` · **Commit:** see `git log -1` ·
**Base:** `origin/main` `1589ff0c` (= live production)
**Status: DEPLOYED AND VERIFIED IN PRODUCTION, 1 October 2026.**

## DEPLOYED — the live record

| | |
|---|---|
| **Worker** | `be-polish` **`1421fdd3`** → **`47bdb7d8-5761-4fbc-940d-807e4243f5a2`**, deployed **16:02:23Z** |
| **Web** | **`be12-v489`** → **`be12-v490`**, pushed **16:04:19Z**, live **16:05:18Z** (~50 s) |
| **Order** | Worker first, then web — as corrected below. The preflight gate was checked between the two steps and passed before the web was pushed. |
| **Config** | `FIREBASE_PROJECT_ID = "be-mastery"` added as a **var**. Secrets unchanged (3, same names). No `PREMIUM_ENFORCED`, no `ENTITLEMENTS_URL`, no Durable Object, **no migration**. |
| **Commits** | `a8b9b92f` (code) · `7da1d775` (this plan) · `3a01b7e7` (cache bump). `main` `1589ff0c` → `3a01b7e7`. |
| **Rollback** | Not performed. Not needed. |

### Verified on production

| Check | Result |
|---|---|
| OPTIONS preflight | `content-type, authorization` — **the gate that had to pass before the web** |
| Anonymous `ytai` | **`401 auth_required`** (was 200/502 — the exposure is closed) |
| Malformed / garbage-signature / expired / `alg=none` / forged-signature / wrong-project token | **all `401`** |
| Cached & popular video while signed out | **`401`** — authentication is in front of the cache |
| Provider calls for rejected requests | **none.** The 401s return in **2 ms**; a Gemini transcription takes seconds |
| Free STT, no account, **real audio** | **200** with real per-word timings |
| Shadow translation, no account | **200** — *"Nous devons convenir de la date de livraison avant vendredi."* |
| Every other route (`chat`, `tts`, `captions`, `polish`, `analyse`) with no token | unchanged; **no 401, no 402, no 503** |
| Real browser on the live site | **18/18** — signed out sends no request and shows the honest message; signed in sends `Authorization`, the preflight succeeds, the Worker verifies it |
| Welding | loads; Practice Partner still absent |
| Monitoring (tail from 16:02Z) | 0 exceptions · 0 × 402 · 0 × 429 · 0 × 503 · 0 CORS failures · one 502 explained below |

**The one 502** was a QA artefact, not a regression: my browser check posted 1,200 zero bytes as `audio/webm`, which Whisper rejects. The route was reached and ungated (no 401); re-run with real audio it returns 200 and real word timings, recorded above.

**Still outstanding — the owner's one manual check:** signed in with a **real production account**, paste a YouTube link in Shadow and confirm the words arrive. No account was created in the production Firebase project (`be-mastery` is for real learners; `be-mastery-test` is the validation project), so the signed-in leg was exercised with a deliberately invalid token — which proves the header is sent, the preflight succeeds and the Worker verifies, but not that a valid production token is accepted. That last step is covered by the staging evidence with a real `be-mastery-test` token.

**Premium end-to-end validation remains pending** (no `ADMIN_TOKEN`).

---



## 0. What is being shipped

`ytai` — Gemini transcription of a video the learner pasted, roughly $0.08 for
15 minutes — was reachable with **no account at all**, held only by a per-IP
brake that a changed network defeats. It now requires a verified Firebase ID
token. **It stays free:** there is no plan, capability or entitlement check
anywhere in this Worker, and no other route gained a requirement.

21 files, +380/−8 against live production. For contrast, the reviewed branch
`feature/product-boundary-implementation` is **636 files and +23,040 lines**
ahead — the whole Premium, captions and visual-identity lineage. That is a
separate release.

| Component | Change |
|---|---|
| `backend/polish-worker.js` | `ytaiAccount()` + the CORS `authorization` header |
| `backend/wrangler.toml` | `FIREBASE_PROJECT_ID` var, and a staging env |
| `index.html` | the signing wrapper, `fbAuthPending`/`fbAuthSettled`, `ytaiNoAccount()`, the `shCapAsk` guard, the `svNoCap*` branches, `POLISH_API` via `beEnv()` |
| `i18n/*.json` ×15 | two keys |
| tests | `test-ytai-auth.mjs` (new, 18), `test-polish-ytai.mjs`, `shadow-transcript.mjs` |

**No Durable Object. No migration.** The authentication fix does not require
one, so the rate limiter is untouched and main's per-IP YTAI brakes remain the
cost ceiling.

## 1. Backup — record before touching anything

```
npx wrangler deployments list                      # expect 1421fdd3-8603-494f-aebf-1793764cdee1
npx wrangler secret list                           # expect 3 names, unchanged
curl -s https://app.lomonec.com/sw.js | grep -o 'be12-v[0-9]*'   # expect be12-v489
git rev-parse origin/main                          # expect 1589ff0c
```

## 2. Production configuration

One new **var** (not a secret), already committed in `[vars]`:

```
FIREBASE_PROJECT_ID = "be-mastery"
```

Removing it makes the route answer `503 auth_unavailable` rather than opening:
for a route that spends money a configuration gap must stop the spending, not
the checking. **No secret is added, changed or rotated.**

## 3. RELEASE ORDER — **WORKER FIRST, THEN THE WEB**

> **This corrects the previous version of this document, which said web first.
> That order would have broken production.** The evidence, measured on
> 1 October 2026, not assumed:
>
> ```
> production be-polish  OPTIONS → access-control-allow-headers: content-type
> this release          OPTIONS → access-control-allow-headers: content-type, authorization
> ```
>
> The new web bundle attaches `authorization` to every `POLISH_API` call (the
> signing wrapper). A preflighted request carrying a header the Worker does not
> allow is **refused by the browser before the Worker runs**.
>
> | Order | Consequence |
> |---|---|
> | **Web first** | every signed-in learner's AI call — transcription, translation, reports, TTS — is blocked at the browser. **Catastrophic.** |
> | **Worker first** | the old client sends no `authorization` at all, so there is no preflight to fail. It simply keeps its old ytai behaviour until the web lands. **Safe.** |
>
> The usual runbook order (entitlements → polish → web) exists to avoid refusing
> paying learners. Nothing is sold in this release, so the CORS constraint
> dominates.

### Step 1 — the Worker
```
cd ~/Documents/GitHub/be-main/backend     # a clean main-based checkout
git log -1 --oneline                      # confirm the release commit
npx --yes wrangler@latest deploy --env ""  # --env "" silences the multi-env warning
```
Verify immediately, before going on:
```
curl -s -D - -o /dev/null -X OPTIONS -H "Origin: https://app.lomonec.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" \
  https://be-polish.nore-ngou.workers.dev/ | grep -i allow-headers
#   expect: content-type, authorization
```
**If that does not say `authorization`, STOP and roll the Worker back. Do not
deploy the web.**

### Step 2 — the web bundle, immediately afterwards
```
grep -n 'const CACHE' sw.js     # bump it; production is be12-v489
git add -A && git commit && git push origin main
until curl -s "https://app.lomonec.com/sw.js?x=$RANDOM" | grep -q 'be12-v<new>'; do sleep 10; done
```

### The window between the two steps
`ytai` returns `401` for **everyone**, signed in included, because the old
client sends no token — and the old client has no `auth_required` branch, so it
shows *"No transcript for this video"*. A cosmetic untruth on a paste-a-link
feature, for the minutes between the two steps. Keep the window short; it is the
price of not breaking every AI call.

## 4. Cache / service-worker implications

`sw.js` is network-first, so most clients take the new bundle on the next load;
an **installed PWA or iOS home-screen app may need a full close and reopen**.
Until a given device refreshes it runs the old client, which is harmless with
the new Worker — that is the whole reason for this order. The `be-rem` cache
must survive the bump; the activate sweep already excludes it.

## 5. Immediate security tests
```
# anonymous — must be refused and spend nothing
curl -s -X POST -H "Origin: https://app.lomonec.com" -H "content-type: application/json" \
  -d '{"ytai":"dQw4w9WgXcQ","from":0,"to":10}' https://be-polish.nore-ngou.workers.dev/
#   expect {"error":"auth_required"} with 401

# a junk token — must also be 401, never 501 and never 200
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://app.lomonec.com" \
  -H "content-type: application/json" -H "authorization: Bearer not.a.token" \
  -d '{"ytai":"dQw4w9WgXcQ","from":0,"to":10}' https://be-polish.nore-ngou.workers.dev/

# every OTHER route must still work with NO token
curl -s -o /dev/null -w "tts %{http_code}\n" -X POST -H "Origin: https://app.lomonec.com" \
  -H "content-type: application/json" -d '{"tts":"hello"}' https://be-polish.nore-ngou.workers.dev/
#   expect 200
```
Then **signed in on a real device**: paste a YouTube link in Shadow and confirm
the words arrive. That is the one check proving Free `ytai` still works end to
end, and it cannot be done from a test environment — no staging Worker has a
provider key, deliberately.

## 6. Limiter smoke test

This release changes no limiter, so the check is only that the existing per-IP
brake still answers: ask for the same **whole** video three times in a minute
from one address signed in; the third should be `429` with a `Retry-After`.
Do not burn provider quota proving more than that.

## 7. Monitoring window

`npx wrangler tail --format json` for the first few minutes. Compare with the
pre-deployment baseline:

| Signal | Baseline | After |
|---|---|---|
| `401` on ytai | none | expected, for anonymous callers only |
| `402` | none | **none** — there is no plan check in this Worker |
| `429` | per-IP brakes only | unchanged |
| `5xx` | none | none |
| `503 auth_unavailable` | n/a | **none** — would mean the var or the JWKS is wrong |
| Durable Object errors | n/a | n/a — no DO in this release |

## 8. Rollback conditions

Roll back if: anonymous ytai still returns 200; a **signed-in** learner cannot
transcribe a pasted video; any other AI route starts answering 401/503;
`503 auth_unavailable` appears at all; `smoke.mjs` drops below its baseline; or
the preflight check in step 1 fails.

### Worker rollback
```
npx wrangler versions deploy 1421fdd3-8603-494f-aebf-1793764cdee1 --env ""
```
Instant and exact. No migration was applied, so there is nothing to undo.

### Web rollback
```
git revert <commit> && git push origin main      # then bump sw.js again
```
Slower — a Pages build plus each device's service-worker refresh. **If both must
go back, revert the web FIRST and the Worker second**, the mirror of the deploy
order, so the token-sending client is never live against the old Worker.

## 9. Staging evidence behind this plan

| | |
|---|---|
| Validation Worker | `be-polish-ytai-staging` **`5d85beae`**, `FIREBASE_PROJECT_ID=be-mastery-test`, no provider secrets |
| Why not `be-polish-staging` | it holds live Durable Objects from the other branch; a script without the `RateLimiter` class is refused (Cloudflare 10064) and deleting them is destructive on shared infrastructure. It was left untouched at `83326ed2`. |
| Real runtime | 7/7 — anonymous 401; a verified Free account passes the gate; a cached video while signed out 401; six bad-token classes 401; no other route requires an account |
| Real browser | 13/13 — the browser's own preflight succeeded, the `Authorization` header arrived, authentication succeeded, and the signed-out path fires no request and shows the honest message |
| Local | `test-ytai-auth` 18/18 · `test-polish-ytai` 14/14 · `shadow-transcript` 18/18 · `polish-track` 15/15 · `track-isolation` 23/23 · `entitlement-client` 46/46 · `shadow-sync` 83/83 |
| Not testable anywhere | the ytai **success** path, because no staging Worker has a provider key — by design |

## 10. What is NOT in this release

No Durable Object or migration · no entitlement or plan check · `PREMIUM_ENFORCED`
is not introduced · `be-entitlements` stays undeployed · no secret touched ·
Welding unchanged · Practice Partner unchanged · **Premium end-to-end validation
remains pending** (no `ADMIN_TOKEN` is available).
