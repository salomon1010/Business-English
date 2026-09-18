# Practice Partner + Shadow Studio V2 — internal pilot plan

Status: **not started.** Nothing here has been executed. Every step is an
owner action; none is performed by the build sessions.

## Preconditions (all true on `feature/practice-partner` at `15381a6`+)
- Every client flag in `FLAGS_DEFAULT` for these features is `false`.
- `backend/partner/wrangler.toml` `[vars]` has `PARTNER_ENABLED = "0"`; `DEV_AUTH`
  and `IP_PER_MIN` exist only under `[env.dev]`; `database_id` is a placeholder,
  so `wrangler deploy` without the id fails rather than deploying blind.
- `privacy.html` 8b is accurate for the feature whether on or off.

## Sequence (owner)
| # | Action | Where | Verifies |
|---|---|---|---|
| 1 | Code review; merge `feature/practice-partner` → `main` | GitHub | Everything off: learners see no change |
| 2 | Bump `sw.js` `be12-vNN`, push, poll live, `BASE=https://app.lomonec.com npm test` | repo | Live site healthy; `shadow-sync.js?v=2` precached |
| 3 | `cd backend/events && npx wrangler deploy` | Cloudflare | `partner_*` / `shadow_v2_*` names accepted (dropped with 204 until then) |
| 4 | `npx wrangler d1 create be-partner` → paste `database_id` into `wrangler.toml [[d1_databases]]` | Cloudflare | |
| 5 | `npx wrangler d1 migrations apply be-partner --remote` (0001, 0002, 0003 — all additive) | Cloudflare | |
| 6 | `npx wrangler r2 bucket create be-partner-audio` | Cloudflare | |
| 7 | `cd backend/partner && npx wrangler deploy` (no `--env`) | Cloudflare | `curl …/health` → `{"ok":true,"dev":false,"enabled":false}`; `/me` with a real token → 503 `disabled` |
| 8 | Internal preview: on the live site set `localStorage.be_flags` (see below); Worker still off → the partner page shows "temporarily unavailable"; Shadow V2 works | phones | Client gating and Shadow V2 on real devices |
| 9 | Real-device checklist (TEST_PLAN.md, 16 rows) on iPhone Safari + Android Chrome | phones | **This is the blocker today** |
| 10 | `PARTNER_ENABLED = "1"` in `[vars]`, `wrangler deploy` | Cloudflare | `/health` → `enabled:true` |
| 11 | Pilot cohort of 6–12 General English learners on the same lesson and language, each with `be_flags` set; 2 weeks | | Funnel below |
| 12 | Monitor daily (below); expand to a second cohort only when no warning sign fired for 7 days | | |
| 13 | General release: flip flags in `FLAGS_DEFAULT`, bump `sw.js`, push | repo | |

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
