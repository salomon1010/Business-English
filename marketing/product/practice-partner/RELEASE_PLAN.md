# Practice Partner + Shadow Studio V2 — release and rollback plan

**Nothing in this document has been applied.** The branch ships with every
production flag off and the Worker kill switch closed, so merging alone
changes nothing a learner can see. Each step below is run by the owner,
in order, after review.

## 0. Review
Branch `feature/practice-partner`. `main` carries only the other session's
footer commit (`35e2da2`), which is also on this branch. See the
final report for the commit list and test commands.

## 0b. Before merging: real-device validation from the branch
PILOT.md § Staging + DEVICE_CHECKLIST.md. Uses the `staging` Worker
environment, a staging D1/R2 and one extra allowed origin on the Polish
Worker (owner decision, documented there). Production is not touched.

## 1. Merge (safe: everything off)
Merge to `main`, bump `sw.js` `be12-vNN` (also precaches `shadow-sync.js`),
push, poll live, `BASE=https://app.lomonec.com npm test` from `tests/`.
Result: identical app for every learner. Welding unchanged. `partner_*` and
`shadow_v2_*` events are not sent because no flag is on.

## 2. Events Worker — from `backend/events/`
`npx wrangler deploy` so the new names are accepted. Deploy this **before**
any flag goes on, or those events are dropped silently.

## 3. Partner Worker — from `backend/partner/` (first time)
```
npx wrangler d1 create be-partner            # paste database_id into wrangler.toml
npx wrangler d1 migrations apply be-partner --remote   # 0001 … 0007 (all additive)
npx wrangler r2 bucket create be-partner-audio
npx wrangler deploy                          # PARTNER_ENABLED and LIVE_ENABLED stay "0"
# optional, for live calls across carrier NAT: wrangler secret put TURN_KEY_ID / TURN_KEY_TOKEN (Cloudflare Calls TURN key)
curl https://be-partner.<account>.workers.dev/health   # {ok:true, dev:false, enabled:false}
```
`DEV_AUTH` and `IP_PER_MIN` exist only in `[env.dev]`. Optional
belt-and-braces: an R2 lifecycle rule deleting objects older than 30 days.

## 4. Shadow Studio V2 — internal preview, then on
- Internal testers set `localStorage.be_flags =
  '{"shadow_studio_v2_enabled":true,"shadow_apply_phrase_enabled":true}'` on
  the live site and run the manual checklist rows 8–9 on real phones.
- To release: flip `shadow_studio_v2_enabled` (and, if wanted,
  `shadow_apply_phrase_enabled`) to `true` in `FLAGS_DEFAULT`, bump `sw.js`,
  push. General English only by construction (`svOn()`).

## 5. Practice Partner — staged
1. **Worker on**: set `PARTNER_ENABLED = "1"` in `[vars]`, `npx wrangler
   deploy`. Nothing visible yet — the client flag is still off.
2. **Pilot cohort** (same lesson, same language — pairs form at once):
   testers set `be_flags` with `practice_partner_enabled`,
   `practice_partner_matching_enabled`, `practice_partner_voice_enabled`
   (and `practice_partner_notifications_enabled`) and run the manual
   checklist. Watch `./backend/events/query.sh` for the funnel
   (`partner_profile_completed → match_requested → candidate_shown →
   trial_started → turn_sent → session_completed → continue/rematch →
   connection_created`) and the D1 counts:
   `wrangler d1 execute be-partner --remote --command "select kind, closed_reason, count(*) from pairs group by 1,2"`.
3. **General release**: flip the four `practice_partner_*` flags in
   `FLAGS_DEFAULT`, bump `sw.js`, push. Update the Play listing (one line,
   within the 4,000-char limit) and, if desired, the flyer.

## 6. Legal
`privacy.html` section 8b (18+, what is shared, retention, screening) goes
live with step 1 — it is accurate whether or not the feature is on.

## Rollback (each independent, fastest first)
| Symptom | Action | Effect |
|---|---|---|
| Anything wrong server-side | `PARTNER_ENABLED = "0"` + `wrangler deploy` (seconds) | Every partner call returns 503 `disabled`; the client shows the offline card; no data written |
| Live calls only | `LIVE_ENABLED = "0"` + deploy, or `practice_partner_live_enabled: false` | `/live` → 403 `live_off`; open calls end at their next poll; recording practice untouched |
| AI coach practice only | `practice_partner_ai_fallback_enabled: false` | the AI buttons disappear; an open AI session cannot be continued |
| Anything wrong client-side | flip the flag(s) back to `false` in `FLAGS_DEFAULT`, bump `sw.js`, push (GitHub Pages ~1 min) | Feature hidden; Welding never affected |
| Shadow V2 misbehaving | `shadow_studio_v2_enabled: false`, bump, push | The classic Shadow Studio is untouched underneath |
| Need to stop matching only | `practice_partner_matching_enabled: false` | Existing sessions can finish; no new pairs |
| Need to silence notifications | `practice_partner_notifications_enabled: false` | Home card and badge stay; no toasts |
| Data concern | `wrangler d1 execute … "delete from interest"` (queue) — never drop tables; audio purges itself 14 d after close | |

None of the rollbacks needs a Play upload (the TWA loads the live site).

## Later phases (not on this branch)
Push with payload ("your turn") via `be-push`; live 15-minute audio calls
(WebRTC + Cloudflare TURN); Premium via Play Billing; human moderation queue.
