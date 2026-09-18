# Practice Partner + Shadow Studio V2 — internal pilot plan

Status: **not started.** Nothing here has been executed. Every step is an
owner action; none is performed by the build sessions.

## Preconditions (all true on `feature/practice-partner` at `ac17dca`+)
- Every client flag in `FLAGS_DEFAULT` for these features is `false`.
- `backend/partner/wrangler.toml` `[vars]` has `PARTNER_ENABLED = "0"`; `DEV_AUTH`
  and `IP_PER_MIN` exist only under `[env.dev]`; `database_id` is a placeholder,
  so `wrangler deploy` without the id fails rather than deploying blind.
- `privacy.html` 8b is accurate for the feature whether on or off.

## Staging — device testing from the branch, before any merge (owner)
Nothing has to be merged or switched on in production to run the device
checklist. Three things are needed: the branch served over **HTTPS on a fixed
hostname** (phones refuse `getUserMedia` on plain http, and both Workers
allow-list origins), a **staging** copy of the partner Worker, and the Polish
Worker allowing that hostname.

1. Serve the branch locally: `python3 -m http.server 8000` in the repo root.
2. Expose it on a fixed HTTPS hostname, e.g. a Cloudflare named tunnel
   `staging.lomonec.com → http://localhost:8000` (`cloudflared tunnel create
   be-staging`, DNS route, `cloudflared tunnel run`). A random
   `*.trycloudflare.com` quick tunnel works for Shadow V2 only — the Polish
   Worker will refuse it, so turns arrive without transcript or score.
3. Staging Worker (config already in `backend/partner/wrangler.toml [env.staging]`,
   no `DEV_AUTH`, `PARTNER_ENABLED="1"`, its own D1 and R2):
   ```
   cd backend/partner
   npx wrangler d1 create be-partner-staging            # paste id into [[env.staging.d1_databases]]
   npx wrangler d1 migrations apply be-partner-staging --remote --env staging
   npx wrangler r2 bucket create be-partner-staging-audio
   npx wrangler deploy --env staging
   curl https://be-partner-staging.<account>.workers.dev/health   # {ok:true, dev:false, enabled:true}
   ```
4. **Owner decision — Polish Worker origin.** Transcription and the coach
   score (`fbTranscribe` / `fbAssess`) go to the live `be-polish` Worker, whose
   allow-list is a code constant, not an environment variable:
   `backend/polish-worker.js` → `const ALLOWED_ORIGINS = [ "https://app.lomonec.com", …localhost ports… ]`.
   A request from any other origin gets **403 Forbidden** server-side (not
   only a missing CORS header), so from `https://staging.lomonec.com` every
   turn would be sent with an empty transcript and no score, and Shadow V2
   grading would fail. `backend/wrangler.toml` for `be-polish` has no
   environments, so there is no staging copy to deploy instead.
   The change, if you approve it, is one line and one deploy:
   ```
   // backend/polish-worker.js, inside ALLOWED_ORIGINS
   "https://staging.lomonec.com",     // staging tunnel for device testing
   ```
   then `cd backend && npx wrangler deploy`. **This redeploys the production
   Polish Worker** with exactly one extra allowed origin (a hostname only you
   control); nothing else in it changes. The build session did **not** make
   this edit because it alters production behaviour. Remove the line and
   redeploy when staging is torn down.
   Alternative without touching production: deploy a second Worker
   (`be-polish-staging`) from a copy of the file with the line added and its
   own `OPENAI_API_KEY` secret — but the app's `POLISH_API` is a constant
   with no override, so that also needs a client change. Not recommended.
5. On each phone open `https://staging.lomonec.com/`, sign in with a test
   Firebase account (email/password works from any origin), switch to General
   English, pass the placement check, then in the browser console or via
   the dev toggle set:
   `localStorage.be_partner_api = "https://be-partner-staging.<account>.workers.dev"`
   and `localStorage.be_flags` (below). Reload. The Worker verifies the real
   ID token exactly as production will.
6. Run `DEVICE_CHECKLIST.md` (37 rows × 2 devices). Record results in the file.
7. Turn everything back off: on each phone clear `be_flags` and
   `be_partner_api` (or Profile → Reset everything on the test account);
   `npx wrangler delete --env staging` (or keep it for the pilot's internal
   preview) — the staging D1/R2 hold only test accounts' audio; remove the
   staging line from the Polish allow-list and redeploy `be-polish`; stop the
   tunnel. Production has not changed at any point: `PARTNER_ENABLED="0"`,
   flags off, no production D1/R2.

## Sequence to production (owner, after the checklist passes)
| # | Action | Where | Verifies |
|---|---|---|---|
| 1 | Code review; merge `feature/practice-partner` → `main` | GitHub | Everything off: learners see no change |
| 2 | Bump `sw.js` `be12-vNN`, push, poll live, `BASE=https://app.lomonec.com npm test` | repo | Live site healthy; `shadow-sync.js?v=2` precached |
| 3 | `cd backend/events && npx wrangler deploy` | Cloudflare | `partner_*` / `shadow_v2_*` names accepted (dropped with 204 until then) |
| 4 | `npx wrangler d1 create be-partner` → paste `database_id` into `wrangler.toml [[d1_databases]]` | Cloudflare | |
| 5 | `npx wrangler d1 migrations apply be-partner --remote` (0001, 0002, 0003 — all additive) | Cloudflare | |
| 6 | `npx wrangler r2 bucket create be-partner-audio` | Cloudflare | |
| 7 | `cd backend/partner && npx wrangler deploy` (no `--env`) | Cloudflare | `curl …/health` → `{"ok":true,"dev":false,"enabled":false}`; `/me` with a real token → 503 `disabled` |
| 8 | Internal preview on the live site with `be_flags`; Worker still off → partner page shows "temporarily unavailable"; Shadow V2 works | phones | Client gating on production |
| 9 | `PARTNER_ENABLED = "1"` in `[vars]`, `wrangler deploy` | Cloudflare | `/health` → `enabled:true` |
| 10 | Pilot cohort of 6–12 General English learners on the same lesson and language, each with `be_flags` set; 2 weeks | | Signals below |
| 11 | Monitor daily; expand to a second cohort only when no warning sign fired for 7 days | | |
| 12 | General release: flip flags in `FLAGS_DEFAULT`, bump `sw.js`, push | repo | |

Internal-preview flags:
```
localStorage.be_flags = '{"practice_partner_enabled":true,"practice_partner_matching_enabled":true,"practice_partner_voice_enabled":true,"practice_partner_notifications_enabled":true,"shadow_studio_v2_enabled":true,"shadow_apply_phrase_enabled":true}'
```

## What to watch during the pilot
Analytics (`./backend/events/query.sh`, names in `backend/events/README.md`):
`partner_profile_completed` → `partner_match_requested` → `partner_candidate_shown` →
`partner_trial_started` → `partner_turn_sent` → `partner_turn_received` →
`partner_session_completed` → `partner_continue_selected` / `partner_rematch_selected` →
`partner_connection_created`; plus `partner_ai_fallback`, `partner_reported`,
`partner_blocked`, `partner_notification_sent`, `shadow_v2_*`.

D1 (`wrangler d1 execute be-partner --remote --command "…"`):
```
select kind, status, closed_reason, count(*) from pairs group by 1,2,3;
select action, count(*) from audit where ts > (strftime('%s','now')-86400)*1000 group by 1;
select count(*) from interest;                       -- queue depth
select count(*), sum(bytes)/1e6 as mb from turns;    -- audio footprint
select count(*) from members where suspended_until > (strftime('%s','now'))*1000;
```
Worker: Cloudflare dashboard → be-partner → requests by status (401/403/429/500),
CPU time, `console.error("partner", …)` lines in Logs. R2: object count and size
(should fall 14 days after pairs close).

## Warning signs → roll back (see RELEASE_PLAN.md rollback table)
- Any 500 rate above a handful a day, or any `partner` error line repeating.
- `partner_turn_sent` / `partner_turn_recorded` < 0.7 (uploads failing).
- `partner_session_completed` / `partner_trial_started` < 0.3 after week 1 (sessions die).
- `turn_screened` audit rows from one member ≥ 3, or any report of harassment
  (suspend by hand: `update members set suspended_until=… where uid=…`).
- Queue depth growing with no pairs formed (cold start: keep AI fallback, add learners).
- R2 footprint not falling after day 21 (purge cron not running → check the trigger).
- Any 401/403 burst from one IP (someone probing; the IP limit holds, but look).

## Rollback timing
| Action | Takes effect |
|---|---|
| `PARTNER_ENABLED="0"` + `wrangler deploy` | seconds, every client |
| Pilot testers clear `be_flags` | immediate, that device |
| Flip `FLAGS_DEFAULT` + `sw.js` bump + push | ~1 min (GitHub Pages) + next app open |
| Shadow V2 / Apply flags | same as above; the classic studio is untouched |
No rollback needs a schema change, a Play upload, or touching Firestore.
