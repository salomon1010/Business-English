# Closing the live anonymous-`ytai` exposure — production release plan

**Prepared 1 October 2026** on `feature/product-boundary-implementation`
**`96961313`**. **NOT EXECUTED.** Every command below is for the owner to run.

## 0. What is actually being shipped

Deploying `be-polish` from this branch is **not** a one-line change. Production
`be-polish` (`1421fdd3`, 24 Sep) predates six functional commits:

| Commit | What it adds | Effect in production (`PREMIUM_ENFORCED="0"`) |
|---|---|---|
| `ed992817` | the whole server-side entitlement boundary (`ROUTE_CAP`, `premiumGate`, `CHAT_PURPOSE_CAP`) | **inert** — `premiumOn(env)` is false |
| `9c72f5ce` | per-account limit keyed on the uid; staging/production separation | inert |
| `39220154` | CORS preflight allows `authorization` | additive, safe |
| `f6239c0a` | `transcribe` free of capability | inert |
| `406f2e7e` | **rate limits moved to a Durable Object** | **ACTIVE** — the limits become genuinely enforced |
| `16e03aa1` + `96961313` | **`ytai` requires a verified account** | **ACTIVE** — this is the fix |

So exactly **two** behaviours change in production: rate limits start really
holding, and `ytai` stops serving anonymous callers. Everything else is dormant
until `PREMIUM_ENFORCED` is switched on, which this release does **not** do.

**Read this before approving:** limits that previously leaked (per isolate) will
now bite at their stated numbers. `STT_PER_MIN` 20 per IP is the one to watch on
shared/NAT networks, including a classroom or an office.

## 1. Backup — record before touching anything

```
npx wrangler deployments list                      # expect 1421fdd3-8603-494f-aebf-1793764cdee1
npx wrangler secret list                           # expect 3 names, unchanged
curl -s https://app.lomonec.com/sw.js | grep -o 'be12-v[0-9]*'   # expect be12-v489
git -C <repo> rev-parse origin/main                # expect 1589ff0c
```
Write all four down. They are the rollback targets.

## 2. Production configuration required

One new variable, already in `backend/wrangler.toml` `[vars]`:

```
FIREBASE_PROJECT_ID = "be-mastery"
```

It is a **var, not a secret** — committed, and it must be. Without it the route
answers `503 auth_unavailable` rather than opening: for a route that spends
money a configuration gap must stop the spending, not the checking.
**No secret is added, changed or rotated. `PREMIUM_ENFORCED` stays `"0"`.**

## 3. Migration

**Yes, one, and it is unavoidable.** Production `be-polish` has no Durable
Object today, so the deploy applies:

```
[[migrations]] tag = "v1-rate-limiter"  new_sqlite_classes = ["RateLimiter"]
```

It creates the `RateLimiter` class and its namespace. `new_sqlite_classes` is
the free-plan storage backend. The object stores **only** a count and a reset
time per bucket, keyed by an IP or a uid — no transcript, no audio, no track
(asserted by `tests/polish-track.mjs`).

## 4. Release order — WEB FIRST, THEN THE WORKER

This **reverses** the usual Premium runbook order, and the reason matters:

| Order | What a learner experiences |
|---|---|
| **Web first** (recommended) | the new client stops anonymous `ytai` itself and says *"Sign in to transcribe this video … the video itself is fine"*. The old Worker would still have served them, so the only effect is honest enforcement arriving a few minutes early. **Safe.** |
| Worker first | a learner on a **cached** `be12-v489` client still fires the call, gets `401`, and that client has no `auth_required` branch — so it falls through to **"No transcript for this video"**, a lie about a perfectly good video. **Do not do this.** |

The usual runbook order (entitlements → polish → web) exists to avoid refusing
paying learners. Nothing here is being sold, so the dishonest-message risk
dominates.

### Step 1 — web bundle
```
# in a clean main-based checkout, NOT the owner's feature/practice-partner tree
git -C ~/Documents/GitHub/be-main pull
# merge/cherry-pick this branch, then:
#   confirm sw.js CACHE is greater than the live value
grep -n 'const CACHE' sw.js        # this branch carries be12-v598; live is be12-v489
#   bump it to a fresh number anyway, so a later revert also busts caches
git add -A && git commit && git push origin main
```
GitHub Pages publishes on push; typically 30–60 s, occasionally 10 min. Poll:
```
until curl -s "https://app.lomonec.com/sw.js?x=$RANDOM" | grep -q 'be12-vNNN'; do sleep 10; done
```

### Step 2 — Worker (only once step 1 is live)
```
cd ~/Documents/GitHub/be-main/backend
git log -1 --oneline                 # confirm the expected commit
npx --yes wrangler@latest deploy --env ""    # --env "" silences the multi-env warning
```
Record the new version id from the output.

## 5. Cache / service-worker implications

`sw.js` is network-first, so most clients pick the new bundle up on the next
load; an **installed PWA or iOS home-screen app may need a full close and
reopen**. Between the push and a given device's refresh, that device runs the
old client — which is exactly why the web goes first. The `be-rem` cache must
survive the version bump; the activate sweep already excludes it, and nothing
here changes that.

## 6. Smoke tests immediately after

```
# anonymous ytai must be refused, and spend nothing
curl -s -X POST -H "Origin: https://app.lomonec.com" -H "content-type: application/json" \
  -d '{"ytai":"dQw4w9WgXcQ","from":0,"to":10}' https://be-polish.nore-ngou.workers.dev/
#   expect: {"error":"auth_required"}  with 401

# a junk token must also be refused — not 501, not 200
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://app.lomonec.com" \
  -H "content-type: application/json" -H "authorization: Bearer not.a.token" \
  -d '{"ytai":"dQw4w9WgXcQ","from":0,"to":10}' https://be-polish.nore-ngou.workers.dev/
#   expect: 401

# every OTHER free route must still work with NO token (enforcement is off)
curl -s -X POST -H "Origin: https://app.lomonec.com" -H "content-type: application/json" \
  -d '{"tts":"hello"}' -o /dev/null -w "tts %{http_code}\n" https://be-polish.nore-ngou.workers.dev/
#   expect: 200

cd tests && BASE=https://app.lomonec.com node smoke.mjs      # expect 37/37
```
Then, signed in on a real device: paste a YouTube link in Shadow and confirm the
words arrive. **That is the one check that proves Free `ytai` still works end to
end, and it cannot be done from here** — staging has no `GEMINI_KEY`.

## 7. Rollback conditions

Roll back if any of these is true after the deploy:
- anonymous `ytai` still returns 200 (the fix did not land);
- a **signed-in** learner cannot transcribe a pasted video (503/401 for a good
  account — suspect `FIREBASE_PROJECT_ID` or the JWKS);
- any other AI route starts answering 401/402 (enforcement switched on by
  accident — check the deployed vars);
- 429s appear on ordinary single-learner use (a limit is mis-sized now that it
  really holds);
- `smoke.mjs` drops below 37/37.

## 8. Worker rollback
```
npx wrangler deployments list                 # find 1421fdd3-…
npx wrangler versions deploy 1421fdd3-8603-494f-aebf-1793764cdee1 --env ""
```
Instant, and it restores the pre-change script exactly. **Caveat:** the
`RateLimiter` namespace created by the migration remains on the account. It is
harmless — the old script has no binding to it and it holds only counters — and
it means a re-deploy forward needs no second migration.

## 9. Web rollback
```
git revert <merge/commit> && git push origin main      # then bump sw.js again
```
Slower than the Worker (a Pages build plus each device's service-worker
refresh), which is the second reason the web goes first: the component that is
hardest to withdraw is the one deployed while the other side is still tolerant.

## 10. Verification that anonymous `ytai` is closed

The two curl probes in §6, plus `wrangler tail --format json` during them:
expect `401` responses and **no outbound subrequest to
`generativelanguage.googleapis.com`**. Zero provider calls is the measurement
that matters — a 401 with a provider call behind it would still have cost money.

## 11. Verification that Free authenticated `ytai` still works

Signed in as a real Free account on a real device: paste a link, see the words
appear within ~10 s for the opening window. Then confirm the caps hold by
pasting five different videos in a minute — the fifth should be refused `429`
(`YTAI_ACCT_PER_MIN` 4) and nothing should be charged for it.

## What is NOT in this release

`PREMIUM_ENFORCED` stays `"0"` · `ENTITLEMENTS_URL` stays empty ·
`be-entitlements` stays undeployed in production · no secret is touched ·
Welding is unchanged · the Welding pre-activity notice remains an open decision
(`WELDING_ACCOUNT_AUDIT.md`).
