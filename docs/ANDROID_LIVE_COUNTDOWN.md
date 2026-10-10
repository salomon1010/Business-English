# The game streak countdown on Android

Built 10 Oct 2026. It is the Android twin of the iPhone Live Activity (`docs/IOS_LIVE_ACTIVITY.md`)
and covers both game hubs: English Mastery (General English) and Welding Mastery (Welding English).
The flag is `android_live_countdown_enabled`: ON on staging, OFF in production. It ships in the Play
app from versionCode 10.

## What the learner sees

An ongoing notification in the last three hours of the game day (UTC midnight), while today's
daily mission or challenge is not done. It uses the same look as the iPhone card:
- a dark console card;
- a ring that drains over the three hours, cyan with a waveform for English Mastery, amber with a
  bolt for Welding Mastery;
- `ENGLISH MASTERY // 🔥 4` in monospaced capitals;
- a large glowing countdown, run by the system (`Chronometer`, Android 7+);
- "Last chance! Keep your 4-day streak.", in the app's language.

It is silent, with no sound and no vibration. Its channel is "Streak countdown", so a learner can
turn it off in Android's settings. When the daily is finished, the card turns green ("Done — your
streak is safe."), then disappears after 8 seconds. Tapping it opens today's daily
(`?widget=daily#english|mastery`). At the deadline the system removes it (`setTimeoutAfter`).

## How it gets its facts

The Play app is a Trusted Web Activity, so the page cannot call native code. Instead:
- The page adds a `live` block to the widget snapshot it already publishes to be-widget
  (`widgetLiveBlock()` in index.html, from the hub's `liveInfo()`).
- be-widget's `shapeSnap` keeps only the block's own fields.
- `BEStreakCountdown` reads the stored snapshots. `BEWidgetFeed.refresh` fetches them, whether
  or not a widget is placed.

**A day without opening the app:** if the last published day was finished, the streak carries over.
The next day's countdown then shows with the same words, which is the case that matters most. If
the last published day was not finished, the streak has gone, so nothing is shown.

## When it runs

`BEStreakReceiver` runs the countdown at these moments:
- 26 s after a launch;
- 5 s after coming back to the app;
- 8 s after leaving it (the page publishes when it is hidden);
- at the start of the window;
- every 15 minutes inside the window;
- after a reboot or an app update;
- with every widget refresh.

Each run plans the next one. The alarms are inexact (`setAndAllowWhileIdle`), so Doze may delay
one by a few minutes.

## Code

| Where | What |
|---|---|
| `playstore/android-widget/src/main/java/.../BEStreakCountdown.java` | Choosing a hub, carrying a day over, posting the notification, alarms. |
| `.../BEStreakReceiver.java` | The wake-up: fetch, redraw the widgets, sync. |
| `res/layout/be_live_small.xml`, `be_live_big.xml`, `res/drawable/be_live_*` | The card. |
| `apply.mjs` | The receiver, `RECEIVE_BOOT_COMPLETED`, and the LauncherActivity hooks (an older patched project is upgraded). |
| `backend/widget/widget-worker.js` | `live` in `shapeSnap`. |
| `index.html` | `widgetLiveBlock()`, the flag, and `?widget=daily`. |

## Tests

- `playstore/android-widget/test/apply.test.mjs`: L1–L4.
- `backend/widget/test/run.mjs`: LV1–LV3.
- `tests/live-activity.mjs`: L11.
- On the emulator: `bash playstore/android-widget/dev-live.sh <debug apk> out.png ge|pro|safe`.

## The Play build (10 Oct 2026)

- The staging-host bundle is **vc 10 / 1.1.0** (`playstore/twa-manifest.staging.json`), built by
  `playstore/android-widget/dev-release.sh` and signed with the upload key (`3D:E6:6D…`). Its file
  is `~/Documents/GitHub/Business-English/playstore/BE-Mastery-1.1.0-vc10-INTERNAL-TEST-staging-host.aab`.
- **minSdk 24.** Play refused minSdk 23 ("Play automatic protection requires a minimum SDK
  version of 24"). This drops Android 6 from updates; the countdown needs Android 7 anyway. The
  production manifest still says 23 and will need the same change before its upload.
- The production rebuild moves to **vc 11** (`playstore/twa-manifest.json`).
- **Upload:** `~/Developer/play-tools/internal.mjs` uploads the bundle, but `edits:commit` answers 403
  until the service account `be-mastery-google-play@…` has Play Console's "Release apps to testing
  tracks" permission. Until then, upload the file by hand in Play Console → Testing → Internal
  testing → Create new release.
