# be-widget — the feed behind the Android home-screen widget

Why it exists, what it stores, and how to run it: **`docs/ANDROID_WIDGET.md`**
(§2 and §4). In one line: the Play app is a Trusted Web Activity and cannot
receive anything from the page it shows, so the page publishes the widget's
snapshot here and the widget pulls it back by a random id.

| Route | Who | What |
|---|---|---|
| `POST /feed` `{wid, snap}` | the page (CORS: the app's origins) | store the snapshot for that id — version 1, allow-listed keys only, ≤ 16 KB, 60 an hour |
| `GET /feed?wid=` | the widget (no Origin) | `{snap, at}`, `no-store`; 404 when nothing is published or it is older than 30 days |
| `DELETE /feed?wid=` | the page, on sign-out | the row goes; the widget shows its invitation |

No cron (the account is at the Free plan's cron limit): old rows are swept on
one write in fifty. Nothing is logged.

```
node test/run.mjs                                   # 17 checks, in-memory SQLite as D1
npx wrangler deploy --env staging                   # be-widget-staging (deployed 5 Oct 2026)
npx wrangler deploy --env ""                        # production — see the doc's §4 first
```
