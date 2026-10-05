# The Android home-screen widget — what it shows, how it is fed, what only you can do

Built 5 October 2026 on branch `staging`, the day after the iOS widget
(`docs/IOS_WIDGET.md`). Same information, same look, same taps — a different
way of getting the data to the phone, because the Play app is a different
kind of app.

---

## 1. What the learner sees

The same three sizes as iOS, drawn from the same snapshot, every word in the
learner's language:

| Size (cells) | What is on it | A tap opens |
|---|---|---|
| **2 × 2** | the streak ring (this week's goal as the ring, the streak as the number, a flame whose colour is the day's mood), today's step by name, the road-map strip, "Week 3 · Tuesday" | today's session |
| **4 × 2** | the ring, TODAY · WEEK 3 · TUESDAY, the step's title, the day's line, **Continue Week 3**, the words-due chip, the strip with "Week 3 / 12" and the percentage | button → the session; chip → the due words; strip → the Road map; ring → Progress |
| **4 × 4** | programme + streak chip, the Today card, the road map with the phases, three facts (this week, words due, best streak), the day's line | each piece to its own page |

The widget resizes between those (`be_widget_info.xml`: 2×2 minimum, up to
420 dp each way) and picks the layout from its actual size. Mood, colours and
the invitation for a phone that has never opened the app are as on iOS
(`IOS_WIDGET.md` §1 and §3); the clock logic is the same code in Java
(`BEWidgetSnapshot.mood`, UTC day keys, 18:00 local).

---

## 2. Why Android needs a Worker (one paragraph)

On iOS the app and the widget share an App Group: the app writes, the widget
reads, no network. The Play app is a **Trusted Web Activity**: the web page
runs inside Chrome, in Chrome's process, and our own app is a thin launcher.
Chrome's documented page-to-app channel (postMessage for TWA, Chrome 115+)
needs the browser session object, which the android-browser-helper library
keeps private — the only way at it is reflection into a private field
([android-browser-helper #472](https://github.com/GoogleChrome/android-browser-helper/issues/472)
is open on exactly this). So instead:

1. The Android app mints a random 32-hex **widget id** once
   (`BEWidgetStore.wid`) and appends `?wid=<id>` to **every** launch URL
   (`BEWidgetLaunch.decorate`, Chrome's documented "query parameters" pattern).
2. index.html reads it once, stores it (`localStorage.be_widget_wid`), strips
   it from the address, and from then on **publishes the same snapshot the
   iOS widget gets** to **be-widget** (`backend/widget/`) under that id —
   `widgetFeedSend`, debounced, only when something visible changed, at most
   one a minute, forced at launch and when the app goes to the background.
3. The widget (`BEWidgetProvider`) **pulls** `GET /feed?wid=` — every 30
   minutes by the system, 25 s after the app is opened and 4 s after the
   learner comes back from it (`LauncherActivity` hooks) — caches it, draws.

What this costs: a widget update is seconds-to-minutes behind the app, not
instant; the phone needs network for a fresh one (it keeps the last one
otherwise); and there is a Worker to run. What it buys: no private APIs,
nothing that breaks with the next library version, and a path that can be
tested end to end from this Mac.

**What is stored on the Worker.** Exactly the snapshot the iOS widget shows:
the learner's own progress numbers, the day's title and button text, the
road map as a row of states, translated labels. `shapeSnap` drops every key
not on its allow-list and caps every string, so **no name, no email, no uid,
no transcript** can be parked there even by a future client. The id is random
and tied to no account. Rows go after 30 days; 60 writes an hour per id.
Suite: `node backend/widget/test/run.mjs` (17).

| Piece | File |
|---|---|
| Worker | `backend/widget/widget-worker.js`, `wrangler.toml`, `migrations/0001_feeds.sql` |
| Web | `index.html` — the `?wid=` / `?widget=` capture next to the `?flags=` one, `WIDGET_API`, `widgetFeedWid / widgetFeedOn / widgetFeedSend / widgetFeedBoot`, the feed branches in `widgetSync` / `widgetClear`; flag `android_widget_enabled` |
| Android | `playstore/android-widget/src/main/java/com/bemastery/app/widget/` — `BEWidgetProvider` (the widget), `BEWidgetRenderer` (RemoteViews + the ring / strip / phase bitmaps), `BEWidgetSnapshot` (parse + the clock), `BEWidgetFeed` (the GET), `BEWidgetStore` (id + cache), `BEWidgetLaunch` (the `?wid=` and the taps) |
| Android resources | `res/layout/be_widget_{small,medium,large,empty}.xml`, `res/drawable/be_widget_*.xml`, `res/xml/be_widget_info.xml`, `res/values/be_widget.xml` |
| Debug preview | `src/debug/` — `BEWidgetPreviewActivity` renders the three sizes from a sample; debug builds only |
| The script that puts it into the Bubblewrap project | `playstore/android-widget/apply.mjs` (tests: `test/apply.test.mjs`) |

---

## 3. Building the Play app with the widget

Bubblewrap owns the Android project and **overwrites hand-made changes** on
every `update` (its README says so). The widget therefore lives in the repo
and is applied by a script, every time:

```
cd <the Bubblewrap project>                 # e.g. ~/Documents/GitHub/Business-English/playstore
npx @bubblewrap/cli@1.25.0 update --skipVersionUpgrade
node <repo>/playstore/android-widget/apply.mjs .
npx @bubblewrap/cli@1.25.0 build            # or ./gradlew assembleDebug for a test APK
```

`apply.mjs` is idempotent: it copies the sources, writes the feed address for
the project's host (`twa-manifest.staging.json` → be-widget-staging, the
production manifest → be-widget), adds `INTERNET` and the `<receiver>` to the
manifest, and patches `LauncherActivity` (`?wid=` + the two refresh hooks).
It refuses a `LauncherActivity` that is not Bubblewrap's rather than
half-patching it.

A widget is a native change, so it ships only with a **new AAB** — versionCode
10 for production, per `docs/PHASE12A-INTERNAL-TEST.md`. Web changes alone
(the publishing side) ship with `git push`, as always.

---

## 4. What only you can do

1. **Deploy the production Worker.** Staging (`be-widget-staging`, D1
   `91355285-…`) is deployed and tested. Production is not:
   ```
   cd backend/widget
   npx wrangler d1 create be-widget                      # paste the id into wrangler.toml [[d1_databases]]
   npx wrangler d1 migrations apply be-widget --remote
   npx wrangler deploy --env ""
   ```
   Then give the production page its address: `WIDGET_API` in index.html
   reads `beEnv().widget` and is **empty** otherwise — set the production
   fallback to `https://be-widget.nore-ngou.workers.dev` in the same
   expression, bump `be12-vNNN`, push. Until then the production page
   publishes nothing and a production widget shows the invitation.
2. **Build and upload the AAB** (§3) — the widget cannot reach a phone any
   other way.
3. **Decide the cadence**, if 30 minutes feels slow: `updatePeriodMillis`
   cannot go below 30 min (Android's floor); the two launcher hooks are what
   make it feel live. A WorkManager job could add a 15-minute floor at the
   cost of a dependency; not done.

---

## 5. Tests

| Suite | What it covers |
|---|---|
| `node backend/widget/test/run.mjs` (17) | publish / read back / 404 / 30-day expiry, the allow-list (a name, an email, a uid, a transcript never stored), caps, 400 / 413, 60-an-hour, DELETE, origins incl. a local test server, preflight |
| `cd tests && node android-widget.mjs` (13) | `?wid=` kept and stripped, the boot publish and its shape, `?widget=words` → Practice, nothing personal, republish on practice, not on an unchanged save, DELETE on sign-out, `?widget=1#session/…` kept on a comeback, a malformed id, no id, the flag, production with no address |
| `node playstore/android-widget/test/apply.test.mjs` (8) | the files land, debug-only preview, the feed address per host, the manifest patch, the LauncherActivity patch, idempotency, refusal of a foreign LauncherActivity |
| Gradle `assembleDebug` on a fresh Bubblewrap 1.25.0 project + the debug preview on the emulator | the Java compiles against the generated project; the three sizes draw |

**What needs a real phone** (the Play app, a build from §3):

| # | Check |
|---|---|
| 1 | Add the widget from the launcher's widget list: 2×2, 4×2, 4×4 draw the current learner |
| 2 | Open the app, finish a session, go back to the home screen → the widget moves within ~30 s |
| 3 | Change the language in the app → the widget's words follow |
| 4 | Welding ↔ General English → amber ↔ indigo |
| 5 | Taps: the button opens the session; the chip the due words; the strip the Road map; from a cold start too |
| 6 | Sign out → the invitation; sign in → it fills again on the next refresh |
| 7 | Aeroplane mode → the last snapshot stays, no blank |
| 8 | At 18:00 with nothing done the flame is red; after midnight (UTC) "done" becomes "pending" |
