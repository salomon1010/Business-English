# Daily reminder push backend

Makes the reminder work **with the app closed**. Without this, `remSchedule()` in
index.html is a `setTimeout` — it only fires while the app is already open, which
is the one situation where nobody needs reminding.

This is a **second Worker**, separate from `be-polish`. Keep it separate: the
cron runs every minute, and a mistake here must not be able to take Executive
Polish down with it.

## One-time setup

```bash
cd backend/push
node genkeys.js                            # prints the VAPID pair — run it yourself
npx wrangler kv namespace create SUBS      # copy the id into wrangler.toml
npx wrangler secret put VAPID_PRIVATE_JWK  # paste the JSON line from genkeys.js
# paste the public key into wrangler.toml → [vars] VAPID_PUBLIC_KEY
npx wrangler deploy
```

Then check the app is pointing at the right host: `PUSH_API` in index.html must
match the deployed `*.workers.dev` URL (it is next to the reminder code).

The private key **never** goes in this repo — the repo is public. The public key
is meant to be public; the browser needs it to subscribe, and the Worker serves
it from `GET /key` so rotating the pair does not need a site deploy.

Rotating the pair invalidates every existing subscription. Users would each have
to toggle reminders off and on again, so treat the pair as permanent.

## How it fits together

```
Settings toggle ──► pushSync()  ──► POST /subscribe {id, slot, endpoint}
                                     stored in KV under slot:<HHMM-utc>:<id>

cron, every minute ──► mark:slot:<now>? ──► list slot:<now>:* ──► skip anyone whose done:<id> is today
                                        └─► POST endpoint (VAPID, no payload)

push arrives ──► sw.js reads the text the app cached in "be-rem" ──► notification

markPracticed() ──► POST /done ──► tonight's push is not sent at all
```

**The push carries no payload.** An encrypted payload means implementing RFC 8291
(ECDH + HKDF + AES128GCM) by hand; a bare wake-up needs only a VAPID JWT, which
WebCrypto signs natively. `sw.js` composes the wording from a copy the app leaves
in the `be-rem` cache, already run through `t()` — so notifications are in the
user's language and no dictionary has to be duplicated into the service worker.

**The slot trick.** The client converts its local reminder time to UTC and
registers into that minute's bucket. The cron reads only the current minute, so
cost is flat regardless of how many users exist. The client recomputes its slot
on every launch, which is what keeps DST changes and travel correct — there is no
timezone database on the server.

**Why `/done` exists.** `userVisibleOnly` means every push that gets delivered
*must* raise a notification; a service worker cannot silently decide to stay
quiet. So the only way not to nag someone who has already practised is not to
send. `markPracticed()` posts the flag; the cron checks it.

## What is stored

| Key | Value | Notes |
|---|---|---|
| `slot:<HHMM>:<id>` | endpoint | the send list for one minute |
| `sub:<id>` | endpoint + slot | so changing the time can clear the old row |
| `done:<id>` | `YYYY-MM-DD` | 48h TTL |
| `mark:slot:<HHMM>` / `mark:pres` / `mark:nudge` | time last confirmed | "look here": a cron LISTs a prefix only when its marker exists (below) |
| `meta:marks-v1` | `done` or the switch's cursor | one-time migration state |

No name, no email, no progress, no recordings. `id` is a random value the client
generates and is deliberately **not** the Firebase uid — signing out must not
orphan a subscription, and two devices should be able to hold different times.
Covered by privacy.html section 8.

## Limits and cost

Free tier throughout: ~1,440 cron invocations a day, flat.

**KV LIST budget (29 Sep 2026).** The free plan allows 1,000 KV LIST operations
a day. The crons used to LIST on every run — 1,440 a day for the per-minute
reminder cron alone, almost always an empty minute — and the account hit the
limit on 27 Sep. Each prefix a cron reads now has a marker key written by the
route that adds rows there (`/subscribe` → `mark:slot:<HHMM>`, `mark:pres`;
`/nudge` → `mark:nudge`). The crons GET the marker and LIST only when it
exists, so a day costs one LIST per booked minute (plus ≤144 for alerts while
someone is online and ≤144 while a nudge is pending). The `/nudge/flush` route
reads its one key directly. A route re-confirms a marker at most hourly; a
cron deletes one only after an EMPTY list and 36 h without confirmation, so KV's
~60 s propagation can never retire a live marker. Rows written before markers
existed are migrated by `runCron`, one page of 200 per minute, while every
cron keeps listing as before until `meta:marks-v1` reads `done`.
Test: `node test/kv-marks.mjs` (in process, counts every KV operation). `MAX_PER_CRON` caps
one minute's fan-out at 900 so a single popular reminder time cannot run away.
If real usage ever concentrates that hard, shard the bucket
(`slot:<HHMM>:<0-9>:<id>`) rather than raising the cap.

A `404`/`410` from a push service means the browser threw the subscription away
(uninstalled, permission revoked). The row is deleted rather than retried
forever.

## Testing it

Push cannot be tested from `python3 -m http.server` alone — a subscription needs
the deployed Worker to hand back the public key. Once deployed:

1. Open the live app, Settings → reminders on, allow notifications.
2. Set the time to two minutes ahead. Close the app completely.
3. `npx wrangler tail` — you should see one line per minute with
   `{slot, scanned, sent, skipped, dropped}`.

Practising first should show `skipped:1` and deliver nothing, which is the case
worth checking deliberately — it is the one that annoys real users if wrong.

**Not supported anywhere:** desktop Safari, iOS before 16.4, and iOS home-screen
apps that were not installed via Share → Add to Home Screen. On all of those the
old `setTimeout` and the launch nudge still run, unchanged. Push is added on top
and never depended on.

## Invitation wake-ups (2026-09-26)

`POST /wake {secret, id, kind:"live"|"trial", name, ref?}` — called by the
partner Worker (never by a browser) when a learner is invited to a recorded
practice or a live call. Behind `PUSH_SECRET`, which must be set to the same
value here and on be-partner:

    npx wrangler secret put PUSH_SECRET            # in backend/push
    npx wrangler secret put PUSH_SECRET --env ""   # in backend/partner (production)

One bare push (Urgency high, TTL 600 s) to `sub:<id>` if the phone registered
with `calls:true`; `why:<id>` then answers `{kind,name,ref}` once. A phone is
woken at most once per 20 s. Without the secret `/wake` answers 503 and
invitations are only noticed inside the app.

## Personalised Learning Nudges (2026-09-26, General English only)

The app's `NudgeEngine` (nudge-engine.js) chooses the learner's best next
action from their own state; this Worker decides whether and when it may be
shown. `POST /nudge {id, rec, tz}` carries the learner's Firebase ID token:
the Worker asks the partner Worker's `GET /programme` (the one account-based
authority, `accountTrack()`) and stores the nudge only for a General English
account — Welding, no token or an unverifiable account → 403 and any pending
nudge for that phone is dropped. One pending nudge per phone (`nudge:<id>`,
TTL = its expiry); a newer one replaces it.

The ten-minute cron (`runNudges`) delivers what is due: never in quiet hours
(22:00–08:00 local), at most one per 20 h and four per 7 days per phone, the
same kind at most every 48 h, a swiped-away kind (`POST /nudge/dismiss`) not
for 7 days, never after expiry (36 h cap), the same `rid` never twice
(`nlog:<id>`). Delivering one sets `done:<id>` for today, so the plain
reminder stays quiet: one notification a day at most. `POST /nudge/cancel
{id, rid}` voids it when the learner does it first — also after delivery,
before the phone reads `/why`. `/why` serves a nudge once
(`{kind:"nudge", title, body, view, act, args}`); the service worker shows it
(tag `be-nudge`, deep link `./?nudge=<rid>#<view>`) or the plain reminder if
it expired or the app lists its rid in `nudgeDone`.

Needs: `PARTNER_API` (already set) and the partner Worker with `/programme`
deployed first. Tests: `node test/nudge.mjs` (in process).

### Staging (be-push-staging, 2026-09-26)

`[env.staging]` in wrangler.toml: its own Worker (`be-push-staging`), KV
namespace and VAPID pair; `PARTNER_API` = the staging partner Worker. The
staging site reaches it through `beEnv().push` (index.html `PUSH_API`), and
the service worker learns it from the reminder cache (`pushApi`). A phone
subscribed under production's key is re-subscribed automatically (pushSync
compares `sub.options.applicationServerKey` with `/key`). Staging only:
`NUDGE_FLUSH="1"` (`POST /nudge/flush {id}` runs the delivery rules for one
phone now — the Settings "Staging test" panel uses it) and shortened gaps
(`NUDGE_GAP_MS` 5 min, `NUDGE_KIND_GAP_MS` 15 min, `NUDGE_WEEK_MAX` 30).
Production sets none of these. `PUSH_SECRET` is not set on staging, so
online alerts do not run there.

## iOS notifications (4 October 2026)

The App Store shell has no service worker and no Web Push, so it registers an
**APNs device token** instead of a push subscription — same `POST /subscribe`,
`apns:{token, env}` in place of `endpoint`, plus `text` (the already-translated
wording, templates only). `sendOne` branches on the row: a browser gets the
bare web push it always got, an iPhone gets an Apple alert carrying that text,
because there is no service worker here to read it from a cache.

Auth is token-based: `APNS_TEAM_ID` / `APNS_KEY_ID` / `APNS_TOPIC` vars and the
`APNS_KEY_P8` secret (the .p8 file itself). **Missing any of them = sending is
off**: a phone still registers and starts working the moment the key is added,
and a send reports `fail:apns_off` instead of throwing. One JWT is signed per
40 minutes, inside Apple's refresh window.

`410 Unregistered` drops the row exactly as a 410 from a browser's push service
does. `BadDeviceToken` is retried once on Apple's other host — a TestFlight
build's token is a production token, a local build's is a sandbox one — and
only dropped when BOTH refuse. `ExpiredProviderToken` re-signs and retries.

**A picture on a recommendation (5 October 2026).** A nudge may carry `image`:
`cleanImage` keeps it only if it is https on an allow-listed host (YouTube's
thumbnail hosts and our own two sites) — the value is handed to a phone to
fetch, so it must never be able to point anywhere else. It rides on the `why:`
row for the web (sw.js shows it as the notification `image`) and, for an
iPhone, the alert gets `aps.mutable-content = 1` plus `be.image`, which the
app's notification service extension downloads and attaches. No image = the
payload is exactly what it was before.

Setup, the device checklist and the two Apple steps only the owner can do:
**docs/IOS_NOTIFICATIONS.md**. Tests: `node test/apns.mjs`.
