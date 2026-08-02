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

cron, every minute ──► list slot:<now>:* ──► skip anyone whose done:<id> is today
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

No name, no email, no progress, no recordings. `id` is a random value the client
generates and is deliberately **not** the Firebase uid — signing out must not
orphan a subscription, and two devices should be able to hold different times.
Covered by privacy.html section 8.

## Limits and cost

Free tier throughout: ~1,440 cron invocations a day, flat. `MAX_PER_CRON` caps
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
