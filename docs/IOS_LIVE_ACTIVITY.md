# The game streak countdown (iOS Live Activity)

Built 10 Oct 2026 (owner: "this kind of notification for the game, on both sides, with the
stopwatch"). It covers both game hubs, English Mastery (General English) and Welding Mastery
(Welding English), on iPhone with iOS 16.2+. The flag is `ios_live_activity_enabled`: ON on
staging, OFF in production. Android is a planned follow-up (see the end).

## What the learner sees

A lock-screen card, plus the Dynamic Island on phones that have one:
- the flame with the hub's streak, and the hub's name;
- a large countdown to the end of the game day, run by the system;
- "Last chance! Keep your 4-day streak.", in English or French.

When the daily is finished, the card turns green, says "Done — your streak is safe." and leaves
after a few seconds. Tapping the card opens today's daily (`bemastery://open?view=english|mastery&act=daily`).

## When

- **Starts:** when the learner LEAVES the app (the page is hidden) in the last 3 hours of the game
  day (`LIVE_WINDOW_MS`), with today's daily mission (English Mastery) or daily challenge
  (Welding Mastery) not done, on the programme that is open, while signed in.
- **Game day:** UTC midnight, the same day the hubs and the server count.
- **Ends:**
  - the moment the daily is finished (the server answers `daily.done`);
  - when the app returns with it done;
  - at sign-out (`widgetClear`);
  - at the deadline, when the card goes stale and shows a tick.
- **Only one card:** starting a new one ends the previous one.

## Code

| Where | What |
|---|---|
| `index.html` | `liveSync()` (on hide), `liveDone()`, `liveClear()`, `beLive()` / `liveOn()`; the flag; `widgetOpenRoute` handles `act=daily`. |
| `welding-mastery.js` + English Mastery (`scripts/english-mastery/ui-*.js`, assembled) | `liveInfo()`: programme, title, line, done-line, streak, deadline, done. Also the `daily` action in `play()`, and the `liveDone()` call when a finished daily is confirmed. |
| `App/Plugins/BEWidgetPlugin.swift` | `liveStart` / `liveEnd` (ActivityKit), and `english` / `daily` on the link allow-lists. |
| `BEWidget/BEStreakActivity.swift` | The card, the Dynamic Island and a `#Preview`. |
| App Info.plist | `NSSupportsLiveActivities = YES` (added through Xcode). |

`BEStreakActivityAttributes` is declared in both targets, with the same name and the same shape;
that is how ActivityKit matches them.

Nothing about the learner is sent to a server: the card is started on the phone and the system
runs the clock. There is no push-to-start, so a closed app that was not left in the window shows
no card.

## Tests

- `tests/live-activity.mjs` (18): when it starts, what it sends, finishing, sign-out, the tap,
  French, and nothing outside the iOS app.
- Swift `BEWidgetPluginTests`: the two new links.

## Android (follow-up, not built)

The Play app wraps the website, so the countdown needs native code in the app shell: an ongoing
notification with a counting-down chronometer, started from the widget feed. It is added through
`playstore/android-widget/apply.mjs` like the widget, and needs a new AAB upload.
