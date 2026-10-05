# The iOS home-screen widget — what it shows, how it is fed, what only you can do

Built 5 October 2026 on branch `staging` (owner: "a widget that displays useful
information — road map, training progress — better than what the competitors
do, very beautiful"). iPhone only, through the App Store shell. The web app,
Android and the installed PWA are untouched: a TWA and a PWA have no widgets.

---

## 1. What the learner sees

Three gallery entries (since 5 Oct 2026, evening — owner: "the same widget for
Welding English as well"):

| Gallery entry | Shows | Reads |
|---|---|---|
| **Your road map** | whichever programme is open in the app | the latest snapshot |
| **General English** | that programme's last state, whatever is open | the snapshot last published while General English was open |
| **Welding English** | that programme's last state, whatever is open | the snapshot last published while Welding was open |

A learner on both programmes can keep both on the home screen. A programme's
progress only changes while that programme is open, so its widget is exact
until the next time it is opened; only the translated labels can lag a
language change until then. A fixed-programme widget whose programme has
never been opened shows an invitation in that programme's colours. The plugin
stores every snapshot twice: as the latest (`be_widget_snapshot`) and under
its programme (`be_widget_snapshot_ge` / `_pro`); sign-out clears all three.

Each entry comes in three home-screen sizes and three lock-screen shapes, all
drawn from the same snapshot, every word in the learner's language.

| Size | What is on it | A tap opens |
|---|---|---|
| **Small** | The streak ring (this week's goal as the ring, the streak as the number, a flame whose colour is the day's mood), today's step by name, the road map as a strip, "Week 3 · Tuesday" | today's session |
| **Medium** | The ring, TODAY · WEEK 3 · TUESDAY, the step's title, the day's line, a **Continue Week 3** button, the words-due chip, the road-map strip with "Week 3 / 12" and the overall percentage | the button → the session; the chip → Practice (words due); the strip → the Road map; the ring → Progress |
| **Large** | Programme name + streak badge, the Today card, the road map with the phases underneath, three facts (this week 3/6, words due, best streak), the day's line | each piece to its own page |
| **Lock screen, circular** (iOS 16+) | a gauge of the week's goal with the streak inside | today's session |
| **Lock screen, rectangular** | "Week 3 · Tuesday", the step, the overall progress bar | today's session |
| **Lock screen, inline** | 🔥 12 · Week 3 · Tuesday | today's session |

**The mood.** The best-known language-app widget shows a streak and a mascot
whose mood sours as the day goes by. The widget keeps the two ideas that work
and leaves out the mascot: the flame is gold once today is done, the
programme's accent while the day is young, red from **18:00 local** when there
is a streak to lose and nothing done yet, grey when no streak is alive. The
line under the title follows: *Today's practice is done* / the reminder's own
line / *Keep your streak alive tonight* / *Start a new streak today*. The
widget works this out from the clock by itself (§3), so it is right at 23:00
and after midnight without the app being opened.

**What it does that the competitor's does not:** the learner's actual place
on the plan (the strip, the week, the percentage), the next step **by name**,
the week's goal, the words waiting for review, and a tap that lands on the
very lesson rather than on the app's front door.

**Colours** follow the programme (General English indigo → cyan, Welding
amber) and the app's own theme (dark / light), not the system's. A phone that
has never opened the app sees an invitation ("Open BE Mastery — your road map
and streak will appear here") rather than zeros.

---

## 2. How it is fed (one paragraph)

The app is a web app; everything about the learner is in the web view's
storage, which a widget — its own process — cannot read. So the **app
publishes** what the widget shows: `widgetSnapshot()` (index.html) builds a
small JSON object from the same functions Home and the Road map use
(`rmSteps`, `rmData`, `currentPos`, `streak`, `calWeekProgress`, the words
due…), already translated through `t()`, and `widgetSync()` hands it to the
shell's **BEWidget** plugin, which stores it in the **App Group**
`group.com.lomonec.bemastery` and asks WidgetKit to redraw. The widget
(`BEWidget` extension) decodes it with every field optional and draws. It
computes nothing except the time of day.

| Piece | File |
|---|---|
| Snapshot builder, debounce, tap routing, boot | `index.html` — `widgetSnapshot` / `widgetSync` / `widgetClear` / `widgetOpenRoute` / `widgetNativeBoot` (next to the push code) |
| Native plugin + the tap box | `mobile/ios/ios/App/App/Plugins/BEWidgetPlugin.swift` (`BEWidgetPlugin`, `BEWidgetBox`) |
| Registered on the bridge | `Lifecycle/BEBridgeViewController.swift` |
| The URL reaches the box | `Lifecycle/BEMasteryApp.swift` (`.onOpenURL`) |
| URL scheme `bemastery://` | `App/Info.plist` (`CFBundleURLTypes`) |
| App Group entitlement | `App/App.entitlements` and `BEWidgetExtension.entitlements` |
| The widget | `mobile/ios/ios/App/BEWidget/` — `BEWidgetModel.swift` (snapshot, store, clock, links), `BEWidget.swift` (provider, palette, views), `BEWidgetBundle.swift`, `Info.plist` (`com.apple.widgetkit-extension`) |
| Target | `BEWidgetExtension`, bundle id `com.lomonec.bemastery.BEWidget`, iOS 15.0, iPhone, 1.1.0 (1), embedded in App |
| Flag | `ios_widget_enabled` (ON in both tables; a kill switch for the shell, nothing on the web) |

**When it publishes.** `saveFlush()` — the one place every change to `S`
goes through — calls `widgetSync()`, which waits 1.2 s and sends only when
something the widget shows has **changed** (a signature compare; WidgetKit
gives an app a daily budget of redraws and `save()` runs on every tap). The
app going to the background, and a launch, publish at once; the launch
publishes a second time 2.5 s later in case the curriculum was still loading.
A theme change publishes too (the theme lives outside `S`).

**What travels.** The learner's own numbers (streak, best, this week's count,
sessions done, words due), the day's title and button text, the road map as
a row of `done | now | next | locked`, the programme name, the language and
direction, the theme, and the translated labels. **No name, no email, no
transcript, no recording** — `tests/ios-widget.mjs` check 4 fails if the
seed's name or email ever appears. Under 6 KB; the plugin refuses anything
over 16 KB or not a version-1 object.

**Sign-out / account deletion.** `fbWipeDevice()` calls `widgetClear()`:
the plugin removes the snapshot and the widget goes back to the invitation.
While there is no profile (onboarding, or just after a wipe) nothing is
published, so a blank learner never replaces the one who left.

**A tap.** The widget opens `bemastery://open?view=session&w=3&d=Tue` (or
`view=practice&act=words`, `view=journey`, `view=review`). The SwiftUI scene
hands the URL to `BEWidgetBox.route`, which keeps only a view from a short
allow-list, a week number 1–52, a weekday and one of three actions — nothing
else can reach the web layer — and the plugin raises the `open` event
(`retainUntilConsumed`), or keeps it for `pendingOpen()` when the tap is what
launched the app. `widgetOpenRoute()` then goes where a learning nudge would:
the session, Practice (and the due words), the Road map, Progress.

---

## 3. The clock

Day keys are **UTC dates** (`yyyy-MM-dd`), because that is what index.html
keeps (`new Date().toISOString().slice(0,10)`) — the widget's "practised
today" must agree with the app's `streak()`, and it does only if both use the
same day. The snapshot carries `lastDay`; the widget compares it with today
and yesterday at the moment it is drawn:

| `lastDay` | Mood | Streak shown |
|---|---|---|
| today | done | the snapshot's |
| yesterday, streak > 0, before 18:00 local | pending | the snapshot's |
| yesterday, streak > 0, 18:00 or later | at risk | the snapshot's |
| older, or no streak | cold | 0 |

The timeline asks WidgetKit to redraw at **18:00 local**, at the **next UTC
midnight** and the one after, then `.atEnd`. Everything else is redrawn by the
app's own publishes.

---

## 4. What only you can do

**Nothing in a console, this time** — with one thing to watch. The App Group
is a capability on the App ID, and Xcode's **automatic signing registers it
by itself** the first time the project builds on a Mac signed in to the
Lomonec team (8TKAAK2MG6): it adds the group to both App IDs
(`com.lomonec.bemastery` and `com.lomonec.bemastery.BEWidget`) and refreshes
the profiles. If a build ever says *"Provisioning profile doesn't include the
com.apple.security.application-groups entitlement"*, open the target's
Signing & Capabilities tab once so Xcode repairs the profile; do not remove
the capability.

Without the group the plugin's `available()` answers `group:false`, `update`
rejects `no_group`, and the web layer simply keeps going — the widget shows the
invitation.

---

## 5. Tests

| Suite | What it covers |
|---|---|
| `cd tests && node ios-widget.mjs` (19) | the snapshot at boot (shape, deep link, labels, nothing personal, size), republishing on practice / a finished session / a language change / a theme change, NOT republishing when nothing changed, tap routing incl. the launch tap and refused views, Welding's own snapshot, sign-out clearing, the flag, the web untouched |
| `mobile/ios` Swift tests — `BEWidgetPluginTests` (6, 9 cases) | only a version-1 object is accepted, URL routing and its allow-lists, bad arguments dropped, the early tap kept and served once, the App Group id |
| `node mobile/ios/scripts/check-release.mjs` | the entitlement on both targets and nothing else, the extension's product type / deployment target / platforms / device family, the plugin compiled and registered, the SAME group and key in the app and the widget, nothing logged or fetched in the widget, the URL scheme and its routing, the allow-lists present |
| Xcode previews | small, medium and large rendered during the build (iPhone 18 Pro, iOS 27) |

**What no test here can prove**, and what needs a real device:

| # | Check |
|---|---|
| 1 | Add the widget from the gallery: small, medium, large show the current learner, not the sample |
| 2 | Finish a session in the app → the widget moves within seconds without reopening |
| 3 | Switch programme (Welding ↔ General English) → the widget follows, in the right colours |
| 4 | Change the language → the widget's words change |
| 5 | At 18:00 with nothing done the flame turns red and the line says so; after midnight (UTC) "done" becomes "pending" |
| 6 | Tap the button → the session; the chip → Practice; the strip → the Road map; a cold launch from the widget lands right |
| 7 | Lock-screen circular / rectangular / inline (iOS 16+) draw and open the session |
| 8 | Sign out → the widget shows the invitation; sign in → it fills again |
| 9 | Light theme in the app → light widget |
| 10 | Arabic / Urdu: right-to-left layout |
