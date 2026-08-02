# Product events

Cloudflare Web Analytics answers *how many people arrived and from where*. It has
no custom-event API, so it cannot answer the questions that decide what to build
next:

- do people finish onboarding, or leave during it
- do they come back on day 2, day 7, day 30
- **where in the 12 weeks do they stop**

This Worker captures those into a Cloudflare **Analytics Engine** dataset on the
same account that already runs `be-polish` and `be-push`. No third-party
analytics vendor, no cookies, no consent banner, no monthly fee.

Page views stay with the Cloudflare beacon. The two systems are independent on
purpose — page views keep working whatever happens here.

## Deploy

```bash
cd backend/events
npx wrangler deploy
```

No secret, no KV. The dataset is created on first write. Then check `EVENTS_API`
in index.html matches the deployed `*.workers.dev` URL.

## The trade-off you accepted

There is **no hosted dashboard**. That is the price of not paying a vendor and
not handing user data to one. Numbers come out of the SQL API below.

## Querying

Needs an account API token with **Account Analytics: Read**. Keep it out of the
repo — export it in your shell instead.

```bash
export CF_ACCOUNT=<account id>
export CF_TOKEN=<api token>

q(){ curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/analytics_engine/sql" \
      -H "Authorization: Bearer $CF_TOKEN" --data "$1"; }
```

Column mapping, fixed by the Worker — `blob1` … `blob8` in this order:

| column | meaning |
|---|---|
| `blob1` | event name |
| `blob2` | country (from Cloudflare's edge) |
| `blob3` | `streak` |
| `blob4` | `week` |
| `blob5` | `day` |
| `blob6` | `source` |
| `blob7` | `lang` |
| `blob8` | `result` |

**Which events fire at all, last 7 days**

```sql
SELECT blob1 AS event, sum(_sample_interval) AS n
FROM be_events WHERE timestamp > now() - INTERVAL '7' DAY
GROUP BY event ORDER BY n DESC
```

**The activation funnel** — compare the three numbers by hand; a drop from
`app_open` to `onboarding_complete` is an onboarding problem, a drop from
`onboarding_complete` to `practice_day` is a first-session problem.

```sql
SELECT blob1 AS event, sum(_sample_interval) AS n
FROM be_events
WHERE timestamp > now() - INTERVAL '30' DAY
  AND blob1 IN ('app_open','onboarding_complete','practice_day')
GROUP BY event
```

**Where in the 12 weeks people stop** — the question the whole exercise exists
for. A cliff between two adjacent weeks is worth more than any other number in
this file.

```sql
SELECT blob4 AS week, sum(_sample_interval) AS sessions
FROM be_events WHERE blob1 = 'session_complete'
  AND timestamp > now() - INTERVAL '90' DAY
GROUP BY week ORDER BY week
```

**Which markets to translate for next**

```sql
SELECT blob2 AS country, sum(_sample_interval) AS n
FROM be_events WHERE blob1 = 'app_open'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY country ORDER BY n DESC LIMIT 20
```

`_sample_interval` matters: Analytics Engine samples under load, and summing it
rather than counting rows is what keeps the totals honest once volume grows.

## Reading the numbers honestly

These are **event counts, not people**. Nothing here has a device ID — that is
deliberate — so "40 app_open" may be 40 people or one person opening the app 40
times. Trends and ratios are trustworthy; absolute user counts are not. Play
Console gives you real install and retention figures; use those for anything
that has to be exact.

## Adding an event

1. Add the name to `EVENTS` in `events-worker.js`, and any new prop key to
   `PROP_KEYS`.
2. Call `track("name", {prop:"value"})` in index.html.
3. Redeploy the Worker *before* the site, or the event is dropped with 204.

The allow-list is the safety mechanism, not red tape: it stops junk being
written, and it stops a careless future `track()` shipping something personal
without anyone noticing. Props are short enums by design. **Never** add one that
could carry free text — no phrase text, no transcript, no note, no name, no
email. If an event seems to need one, the event is wrong.
