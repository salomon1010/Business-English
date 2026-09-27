# Personalised Learning Nudges — iPhone test on staging

Staging, 26 Sep 2026. Site `https://staging.lomonec.com` (snapshot of
the release branch, service worker `be12-v486`). Workers: `be-partner-staging`
(`d6be0809`), `be-events-staging` (`27bb9b80`), `be-push-staging` (new, its
own store and key). Production is not involved, except that staging signs in
against the production Firebase project (see "Before you start").

## Before you start

- **Use the web app, not the Xcode build.** iPhone web push works only for a
  site added to the Home Screen (iOS 16.4 or later). The Capacitor app's web
  view has no web push.
  1. Open `https://staging.lomonec.com` in Safari.
  2. Tap Share, then Add to Home Screen.
  3. Open it from the Home Screen icon.

  If an older staging icon is there, delete it and add it again.
- **Staging uses the production Firebase project.** Signing in, and every
  programme switch, updates **your own** account document, exactly as the
  live app does. Use a test account if you would rather not touch your own.
- **Test between 08:00 and 22:00** local time. Quiet hours hold on staging
  too.
- **Staging has shorter limits,** so you can repeat a test in one sitting:
  5 minutes between nudges and 15 minutes per kind, instead of production's
  20 hours and 48 hours.
- **Scheduled delivery does not run on staging.** The account has reached
  Cloudflare's free-plan limit of 5 cron triggers, so staging's 10-minute
  delivery run could not be created. Use **Deliver my next nudge now** in the
  staging panel. It applies the same rules at once.

## Where to look

Settings (App Setup) → Reminders:
- the switch **Suggest my next best practice**;
- under it, a grey **Staging test — learning nudges** panel (staging only).
  It shows whether nudges are ready (General English, signed in,
  notifications, push id, switch) and the engine's ranked recommendations.

## Locked-phone delivery (the first test)

The panel's **Schedule my next nudge (Claude delivers it)** runs the real
engine and the server's account check, but does not deliver. You lock the
phone, then Claude delivers it from the Mac through `be-push-staging`'s
`/nudge/flush` (the Worker's own rules), so the notification arrives on a
locked phone. The panel's **Next:** line shows the exact title, body and
destination beforehand.

A tap on a notification whose activity you already did lands on the road
map with "You already did this one — here is your next step". It never
reopens the finished activity.

## A. General English, end to end

1. Sign in. Confirm the programme is General English.
2. Settings: turn on **Suggest my next best practice**. Allow notifications
   when asked. The panel should read: General English yes, signed in yes,
   notifications granted, push id yes, push Worker
   `be-push-staging.nore-ngou.workers.dev`.
3. Read the **ranked** line: it names the kinds your real state supports
   (for example `lesson (lesson_pending)`).
4. Tap **Deliver my next nudge now**. The toast says `<kind> → sent`, or
   the rule that held it (`quiet`, `gap`, `kind`, `dismissed`).
5. **Lock the phone.** A notification arrives within seconds. Its text must
   match your state (the week and topic, the number of words due …).
6. Tap it. The app opens on that activity:
   - lesson → that session day;
   - words → Practice with the word review started;
   - challenge → Shadow with that clip;
   - shadow → your trouble words;
   - partner → Practice Partner;
   - AI coach → a coach session.
7. Do the activity. Then tap **Deliver my next nudge now** again. The same
   recommendation must **not** come back: the next kind, or "No
   recommendation now".

## B. Personalisation paths (real state only)

| Path | How it arises for real | Expect |
|---|---|---|
| Unfinished lesson | today's lesson not done | `lesson` |
| Words due | 3 or more saved words due (from speaking feedback) | `words`, N = your count |
| Shadow Challenge weakness | a Challenge not passed in the last 7 days | `challenge`, the clip's title |
| Trouble words | 3 or more words in Shadow → History | `shadow` |
| Inactivity / comeback | 3 or more days with no practice | `comeback` |
| Partner opportunity | another learner waiting in Practice Partner | `partner_now` |

Comeback needs days away. In a single session it is covered only by the
automated fixture tests. Partner needs a second learner on staging.

## C. Welding isolation

1. Switch the same account to Welding.
2. The switch and the staging panel disappear from Settings. A pending nudge
   is cancelled on the server.
3. **Server check.** Settings now shows a grey **Staging test — server
   boundary** panel. Tap **Check the server refuses this account**. The
   toast must read `Server: refused (403 track) — correct for a
   non-General-English account`. The staging push Worker asked the staging
   partner Worker for this account's programme, from Firebase, and refused
   it. The app's own gate was bypassed on purpose.
4. No General English nudge arrives while the account is Welding.

## D. Switch back

1. Switch to General English. Open Settings: the panel is back and ranked
   again.
2. **Check the server accepts this account** → `Server: accepted — this
   account is General English`. Allow a few seconds after switching: the
   app saves the switch to your account first.
3. **Deliver my next nudge now** → `sent`. The advice reflects your General
   English state, not the Welding period.

## E. Safety

- **Frequency:** deliver twice within 5 minutes. The second is held with
  `gap`.
- **Cooldown:** the same kind within 15 minutes is held with `kind`.
- **Dismissal:** swipe a nudge away. The same kind is held with `dismissed`
  (7 days). iOS may not report swipes; see limitations.
- **Stale:** get a `words` nudge delivered, but do not open it. Review the
  words in the app first. Then open the notification. It must show the
  plain reminder or nothing new, never "N words to review" again.
- **Quiet hours:** after 22:00 the result is `quiet`.
- **Deep link:** see A.6.

## Known limits on iPhone

- **Swipes may not be reported.** WebKit may not fire `notificationclose`,
  so dismissals may go unreported and the 7-day rest may not apply.
- **Scheduled delivery is untested on staging** (cron limit). The same rules
  run through the panel's button.
- **The daily reminder stops for the staging web app** on this iPhone once
  it moves to be-push-staging, because that Worker has no cron. The live app
  is not affected.
