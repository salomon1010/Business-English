# be-partner — the Practice Partner Worker

Owns all Practice Partner data (D1 + R2). Nothing lives in Firestore. Design:
`marketing/product/practice-partner/`. **Not deployed** — see RELEASE_PLAN.md.

## Routes (all need `Authorization: Bearer <Firebase ID token>`)
| Method | Path | Does |
|---|---|---|
| GET | `/me` | Everything the client shows: consent, waiting state (count only), the active pair with partner `{name, band, lang}`, turns, unread, streaks, silence/fallback flags |
| POST | `/consent` | `{name, lang, gender?, sameGender?}` — registers (required before anything else) |
| POST | `/interest` | `{track, band, lang, promptWeek, fndDay}` — joins the queue; pairs at once when someone compatible waits |
| DELETE | `/interest` | leave the queue |
| POST | `/turns` | multipart `audio, day, transcript, score, duration_ms, turn_id` — screened, stored; 3 per day; idempotent on `turn_id` |
| GET | `/turns/:id/audio` | streams the audio to pair members only |
| POST | `/pairs/:id/seen` · `/leave` · `/report {reason}` · `/block` | as named |
| GET | `/health` | `{ok, dev}` |
Dev only (`DEV_AUTH=1`): `X-Dev-User`, `X-Dev-Now`, `POST /__reset`, `POST /__cron`.

## Local development (nothing leaves the machine)
```
npx wrangler d1 migrations apply be-partner --local --env dev
npx wrangler dev --env dev --port 8787
node test/run.mjs            # 28 integration checks against the local Worker
```
In the app (served locally), set `localStorage.be_partner_api = "http://127.0.0.1:8787"` and
`localStorage.be_partner_dev_user = "alice"`; the client then sends `X-Dev-User`
instead of a Firebase token. It does this only for localhost/127.0.0.1 hosts.

## Errors the client handles
`auth` 401 · `consent` 403 · `suspended` 403 · `forbidden` 403 · `paired` 409 ·
`no_pair` 409 · `day` 409 (the day rolled over) · `expired` 410 · `too_large` 413 ·
`moderation` 422 (contact details in the transcript) · `limit` 429 · `ip_limit` 429.

## Safety rules implemented here
Transcript screen (phones, e-mails, links, handles, messenger names); audio only
via membership-checked route; block = pair closed + never re-paired; two distinct
reporters = 30-day suspension; daily limits (interest 10, report 5, block 20,
turns 3/pair/day, audio ≤1.5 MB / ≤75 s); 120 req/min per IP; audio of closed
pairs purged after 14 days by the daily cron.
