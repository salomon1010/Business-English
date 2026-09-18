# be-partner — the Practice Partner Worker

Owns all Practice Partner data (D1 + R2). Nothing lives in Firestore. Design
and the full data model: `marketing/product/practice-partner/`. **Not
deployed** — see `RELEASE_PLAN.md` there. **General English only**: `TRACKS`
holds one id and any other track is refused with `403 track`.

## Switches (wrangler.toml `[vars]`)
| Var | Production | Dev | Effect |
|---|---|---|---|
| `PARTNER_ENABLED` | `"0"` | `"1"` | not `"1"` → `503 disabled` on everything but `/health` |
| `MATCH_WEIGHTS` | `"{}"` | `"{}"` | JSON overrides of `WEIGHTS_DEFAULT` (level, goal, curriculum, mode, availability, timezone, topic, reliability, history) |
| `PAIR_DAYS` / `PARTNER_TIMEOUT_H` | 7 / 24 | 7 / 24 | session expiry · partner-silence threshold for the AI fallback and early rematch |
| `IP_PER_MIN` | unset (120) | 100000 | per-IP request limit; the suites hammer one IP |
| `DEV_AUTH` | **unset** | `"1"` | accept `X-Dev-User` / `X-Dev-Now`, enable `/__reset` and `/__cron` |

## Routes (all need `Authorization: Bearer <Firebase ID token>`)
| Method | Path | Does |
|---|---|---|
| GET | `/health` | `{ok, dev, enabled}` (no auth) |
| GET | `/me` | consent, `adult`, prefs, waiting state, active pair with partner `{name, band, lang}`, `rounds` view, turns, unread, `fallback`/`canRepair`, decisions, `lastClosed`, the best `connection` |
| POST | `/consent` | `{name, lang, adult: true, gender?, sameGender?, goals?, mode?, avail?, tz?}` — refuses without `adult` (`403 age`) |
| POST | `/prefs` | update goals / mode / avail / tz / same-gender / opt-out |
| POST | `/interest` | `{track, band, lang, promptWeek, fndDay, mode: now\|later, topic?, goals?, phrase?}` — join the queue; `now` pairs with the best candidate at once, `later` returns up to 3 candidate cards |
| DELETE | `/interest` | leave the queue |
| POST | `/match` | fresh candidate cards (opaque `offer` ids, 30-min TTL, reasons, never uids) |
| POST | `/invite` | `{offer, phrase?}` — try a practice: creates the 4-round trial pair atomically |
| POST | `/next` | `{promptWeek, fndDay, band, phrase?}` — a connected (mutual/regular) partner starts the next session |
| GET | `/pairs/:id` | the pair, members only |
| POST | `/pairs/:id/seen` · `/leave` · `/report {reason}` · `/block` · `/decide {choice: continue\|rematch}` | as named |
| POST | `/turns` | multipart `audio, transcript, score, duration_ms, turn_id` — turn-order enforced, screened, stored; idempotent on `turn_id`; the 4th turn completes the session |
| GET | `/turns/:id/audio` | streams audio to pair members only |
Dev only (`DEV_AUTH=1`): `X-Dev-User`, `X-Dev-Now`, `POST /__reset`, `POST /__cron`.

## Local development (nothing leaves the machine)
```
npx wrangler d1 migrations apply be-partner --local --env dev   # 0001 + 0002
npx wrangler dev --env dev --port 8787
node test/run.mjs            # 48 integration checks against the local Worker
```
In the app (served locally), set `localStorage.be_partner_api = "http://127.0.0.1:8787"`,
`localStorage.be_partner_dev_user = "alice"` and
`localStorage.be_flags = '{"practice_partner_enabled":true,"practice_partner_matching_enabled":true,"practice_partner_voice_enabled":true,"practice_partner_notifications_enabled":true}'`.
The client sends `X-Dev-User` instead of a Firebase token only for localhost/127.0.0.1 hosts.

## Errors the client handles
`auth` 401 · `disabled` 503 · `consent` / `age` / `suspended` / `opted_out` / `forbidden` / `track` 403 ·
`paired` / `not_waiting` / `gone` / `busy` / `closed` / `complete` / `not_your_turn` / `not_complete` / `no_pair` 409 ·
`offer` / `no_connection` / `not_found` 404 · `too_large` 413 · `moderation` 422 · `limit` / `ip_limit` 429.

## Safety rules implemented here
Transcript screen (phones, e-mails, links, handles, messenger names, "call
me / add me" EN+FR); audio only via membership-checked route; block = pair
closed + never re-paired; rematch = 14-day cooldown; two distinct reporters =
30-day suspension; daily limits (interest 10, match 30, invite 10, report 5,
block 20, decide 40); turns alternate, four per session, audio ≤ 1.5 MB /
≤ 75 s; per-IP limit; `audit` table (90 days); audio of closed pairs purged
14 days after close by the daily cron, which also stamps abandoned sessions
on the laggard's reliability counter and sweeps offers, cooldowns, counters.
