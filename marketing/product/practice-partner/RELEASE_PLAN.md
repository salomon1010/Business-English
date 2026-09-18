# Practice Partner — release plan

Nothing in this document has been applied. It is the exact list of
production changes required, to be run by the owner after review.

## 0. Review
Branch `feature/practice-partner` — see the final report for the commands.

## 1. Cloudflare (new Worker `be-partner`) — from `backend/partner/`
```
npx wrangler d1 create be-partner            # copy database_id into wrangler.toml
npx wrangler d1 migrations apply be-partner --remote
npx wrangler r2 bucket create be-partner-audio
npx wrangler deploy                          # DEV_AUTH is NOT set in production
```
Then put the deployed URL into `PARTNER_API` in `index.html` (default is
`https://be-partner.nore-ngou.workers.dev`). Optional belt-and-braces: an R2
lifecycle rule deleting objects older than 30 days (the Worker already deletes
at 14 days after a pair closes).

## 2. Events Worker — from `backend/events/`
`npx wrangler deploy` so `partner_pair`, `partner_turn`, `partner_report`,
`partner_block` are accepted (they are on the allow-list on this branch).
Deploy this **before** the site, or those events are dropped silently.

## 3. Site
Merge to `main`, bump `sw.js` `be12-vNN`, push; poll live; run
`BASE=https://app.lomonec.com npm test` from `tests/`.

## 4. Firebase
No change. The Worker verifies ID tokens against Google's public certificates;
no service account, no rule change, no new collection.

## 5. Legal / listing
`privacy.html` (on this branch) goes live with the site. Play listing: add one
line about practising with another learner, within the 4,000-char limit.

## Rollout
- Pilot cohort first (the Petrocertif group: same track, band and language —
  pairs form immediately). Read `./backend/events/query.sh partner` and the
  D1 counts (`wrangler d1 execute be-partner --remote --command "select count(*) from pairs"`).
- Kill switch: set `PARTNER_API=""` in index.html and bump `sw.js` — the
  Practice card then shows "temporarily unavailable" and no request is made.

## Later phases (not on this branch)
Phase 2 push with payload ("your partner replied") — `be-push` needs
`p256dh`/`auth` storage, uid→device map, RFC 8291 encryption, `/notify`.
Phase 3 live 15-minute audio calls — WebRTC + Cloudflare TURN, presence.
Phase 4 Premium via Play Billing — unlimited pairs, filters, live calls.
