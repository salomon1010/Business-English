# iOS notifications — what is built, and what only you can do

Built 4 October 2026 on branch `staging`. Nothing is live: the code ships
disabled in practice, because APNs cannot send a thing until the two Apple
steps in §2 are done.

Until then the iPhone app behaves exactly as it did — in-app reminders only —
and the web, Android and the installed PWA are untouched.

---

## 1. How it works (one paragraph)

WKWebView has neither `Notification` nor Web Push, so inside the App Store
shell the whole closed-app half of the reminder was simply absent. The shell
now carries a native plugin (`BEPushPlugin.swift`, exposed to the web layer as
`BEPush`) that obtains an **APNs device token**. The web layer registers that
token with be-push in the *same* `POST /subscribe` call a browser uses for a
push subscription, and be-push sends to Apple instead of to a browser's push
service. Everything that decides *whether* and *when* to notify — the reminder
minute, quiet hours, the one-a-day rule, the nudge engine, the invitation
wake-up — is the code that was already there and is shared by both platforms.

One real difference. A web push is **bare**: `sw.js` reads the wording out of
the device's own cache, which is how a language change reaches a notification
sent days later. APNs has no service worker to ask, so the already-translated
text travels with the subscription (`text` in `/subscribe`) and is re-sent on
every launch. It holds **templates only** — no name, no progress, nothing the
learner typed — and `{{n}}` / `{{name}}` are filled in by the Worker.

| Piece | File |
|---|---|
| Native plugin + the shared token/tap box | `mobile/ios/ios/App/App/Plugins/BEPushPlugin.swift` |
| App delegate (Apple hands the token and the tap here, nowhere else) | `mobile/ios/ios/App/App/Lifecycle/BEAppDelegate.swift` |
| Delegate installed on the SwiftUI scene | `Lifecycle/BEMasteryApp.swift` (`@UIApplicationDelegateAdaptor`) |
| Plugin registered on the bridge | `Lifecycle/BEBridgeViewController.swift` |
| Push entitlement | `App/App.entitlements` (`aps-environment`) |
| Web layer | `index.html` — `beNativePush` / `iosPushOn` / `pushSyncNative` / `pushTapRoute` / `pushNativeBoot` / `pushTextPayload` |
| Worker | `backend/push/push-worker.js` — the APNs section (`sendApns`, `apnsJwt`, `apnsAlert`, `cleanApns`, `cleanText`) |
| Flag | `ios_push_enabled` (ON in both flag tables — it can only do something where the plugin exists **and** the Worker has the key) |

---

## 2. What only you can do

Nothing below can be done from the repository, and none of the values may be
guessed. **Both steps are required**: without 2.1 the app cannot register at
all, and without 2.2 the Worker cannot send.

### 2.1 Apple Developer portal — the App ID capability

1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers**.
2. Open the App ID for **`com.lomonec.bemastery`**.
3. Tick **Push Notifications**, Save.
4. Rebuild. Xcode's automatic signing refreshes the profile, provided the
   Lomonec team (8TKAAK2MG6) is selected.

The entitlement is already committed. A build **will fail to sign** until the
App ID carries the capability — that is the expected failure, not a bug.

### 2.2 The APNs auth key (one key, both environments, both Workers)

1. Same portal → **Keys** → **+** → tick **Apple Push Notifications service
   (APNs)** → Continue → Register.
2. **Download the `.p8` once.** Apple will not offer it again. Note the
   **Key ID** shown beside it.
3. Put the key id in `backend/push/wrangler.toml` — `APNS_KEY_ID`, in **both**
   `[vars]` and `[env.staging.vars]` (it is a public identifier, not a secret).
4. Give the Worker the key itself, per environment:

   ```
   cd backend/push
   npx wrangler secret put APNS_KEY_P8                  # paste the WHOLE file, BEGIN/END lines included
   npx wrangler secret put APNS_KEY_P8 --env staging
   ```
5. Deploy both: `npx wrangler deploy --env ""` and `npx wrangler deploy --env staging`.

`APNS_TEAM_ID` and `APNS_TOPIC` are already filled in. **Never commit the
`.p8`** — `check-release.mjs` fails if anything matching `*.p8` or `AuthKey_`
is tracked.

#### Tried 4 Oct 2026: `AuthKey_LRT44K2796.p8` is not an APNs key

That key (created 2 October, the one in `~/Documents/GitHub/BE Mastey Keys/`)
was loaded into be-push-staging and a provider token signed with it was put to
**both** of Apple's hosts with a fictional device token. Apple answered:

```
HTTP 403  {"reason":"InvalidProviderToken"}
```

The key itself is a valid P-256 key and the Worker signs with it correctly —
verified offline: `ES256`, `kid: LRT44K2796`, `iss: 8TKAAK2MG6`, signature
checks out. And the team is right: `DEVELOPMENT_TEAM = 8TKAAK2MG6` in the Xcode
project. So the key is simply **not enabled for Apple Push Notifications
service** — most likely the key §5 of `docs/auth/SOCIAL_SIGNIN.md` asks for
(Sign in with Apple revocation), which cannot sign APNs tokens.

What to do: in the portal, open **Keys** and look at that key's services. If
**Apple Push Notifications service (APNs)** is not among them, create a NEW key
with that box ticked and use its id and file. Do **not** delete
`LRT44K2796` — if it is the Sign in with Apple key, deleting it would break
account-deletion revocation.

The wrong key was removed from the staging Worker again, and `APNS_KEY_ID` is
back to empty, so sending is cleanly **off** rather than failing 403 on every
reminder.

#### Also blocking, found the same evening: the account's cron-trigger limit

```
This account has reached the Workers Free limit of 5 cron triggers per account.
```

be-push wants two triggers per environment (every minute for reminders, every
ten for online alerts and nudges), and with be-partner's the account is at the
ceiling — so Cloudflare refuses to set **be-push-staging**'s schedules, and a
`wrangler deploy` of that Worker reports "Trigger configuration … only
partially updated". The Worker CODE deploys fine; only the schedules are
refused, so a staging reminder or nudge may never fire even once the key is
right. Check what is actually registered at dashboard → Workers & Pages →
**be-push-staging** → Settings → Trigger Events.

Two ways out, owner's choice:

1. **Workers Paid** ($5/month) raises the limit to 1,000.
2. **One trigger instead of two**, in code: keep `"* * * * *"` and run the
   ten-minute work (presence + nudges) when the minute is divisible by ten,
   inside `scheduled()`. Same cadence, half the triggers — it takes be-push
   from 4 triggers to 2 across both environments. Nothing else changes.

Nothing is deployed for either yet.

### 2.3 Nothing to do in Firebase

This does not use Firebase Cloud Messaging. be-push talks to Apple directly
with token-based auth, so there is no certificate to renew each year and no
second vendor in the path.

---

## 3. What the learner sees

Exactly what a browser's learner sees, in the same language, from the same
rules:

| Notification | Collapse id | When |
|---|---|---|
| The daily reminder | `be-daily` | the chosen minute, unless they already practised today |
| A partner invitation | `be-partner-call` | someone invites them — time-sensitive, priority 10 |
| Learners online | `be-online` | at most every 4 h, never 22:00–08:00 local |
| A learning nudge | `be-nudge` | the engine's rules (one per 20 h, 4 a week, General English only) |

- The **permission prompt happens on a switch, never on a launch**. A launch
  reads the permission and registers only if it was already granted.
- A learner who refuses gets the in-app reminder and a note saying where to
  turn notifications back on. Nothing is sent and nothing is registered.
- A tap reaches the same screens the service worker's message reaches: a nudge
  through `nudgeArrive`, an invitation to Practice Partner, the reminder to the
  road map. A tap that **launched** the app is held by the plugin
  (`pendingTap`) because nothing is listening that early.
- In the foreground a call does not draw a banner over the app that is already
  ringing; a reminder or a nudge still does.

---

## 4. Two things worth knowing

**The push id is per device and no longer travels.** It used to live only in
`S`, which syncs through Firestore, so a signed-in learner's second device
could inherit the id the first registered with — one row, one route, and the
second device to register would quietly take over the first one's reminder.
That became dangerous the moment the iPhone could register at all, because its
route is an APNs token and would have replaced the browser's endpoint. The id
now lives in `localStorage.be_push_id`, outside `S`, `fbSyncPayload` strips it,
and the shell never adopts an id that arrived from the cloud.

**The environment is read, not assumed.** `aps-environment` in the entitlements
says `development`, which is what a build signed here needs; Xcode's App Store
export rewrites it to `production`. The app reads the value back out of its own
embedded provisioning profile and tells be-push which of Apple's two hosts its
token belongs to. If it is ever wrong anyway, the Worker retries the other host
once on `BadDeviceToken` rather than dropping a working phone.

---

## 5. Tests

| Suite | What it covers |
|---|---|
| `node backend/push/test/apns.mjs` (27) | registration, the alert for all four kinds, Apple's required headers, the ES256 provider token **verified against the key that signed it**, JWT reuse, 410 / BadDeviceToken / ExpiredProviderToken / 503, no key = no send, and a browser still getting a bare web push |
| `cd tests && node ios-push.mjs` (26) | the shell seen for what it is, no prompt on a launch, the subscribe body, the text travelling, refusal, the per-device id (including an id carried in from the cloud), unsubscribe, taps including a cold launch, and the web untouched |
| `mobile/ios` Swift tests (26) | the four plugins registered, the APNs environment is one of Apple's two, and a token arriving before the web layer asks is still handed over |
| `node mobile/ios/scripts/check-release.mjs` | the entitlement value, both files compiled, the plugin registered, the delegate installed, nothing logged |

**What no test here can prove**, and what needs a real device once §2 is done:

| # | Check |
|---|---|
| 1 | The permission prompt appears when the reminder is switched on |
| 2 | A token is issued, and `/subscribe` reaches be-push with it |
| 3 | The daily reminder arrives with the app **closed**, at the chosen minute, in the learner's language |
| 4 | It does **not** arrive on a day they already practised |
| 5 | A partner invitation arrives within seconds and rings as time-sensitive |
| 6 | A nudge arrives and its tap opens the right lesson, clip or partner screen |
| 7 | A tap on a cold launch lands on the right page |
| 8 | Deleting the app stops delivery (Apple answers 410 and the row goes) |
| 9 | Turning notifications off in iOS Settings does not leave the app sending |
| 10 | TestFlight (production environment) and a local Xcode build (sandbox) both deliver |
