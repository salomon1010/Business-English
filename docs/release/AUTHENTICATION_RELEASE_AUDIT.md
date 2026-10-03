# Authentication release audit — BE Mastery

**Date:** 1 October 2026
**Audited commit:** `1589ff0c` (`origin/main`) — verified identical to the live
site (`https://app.lomonec.com/sw.js` serves `be12-v489`, and the live
`index.html` carries the same `ENT_API=""` and `PARTNER_API` constants).
**Method:** static inspection of the repository plus unauthenticated probes of
the live Workers. No code was changed, nothing was deployed, nothing was merged.
**Scope note:** the owner's working checkout is `feature/practice-partner`, which
is behind production. Everything below was read from a clean `origin/main`
worktree, not from that checkout.

---

## 1. Current authentication architecture

One provider, one path:

```
learner → Profile → Backup & sync → fbOpenModal()
        → Firebase Auth (email + password, compat SDK 10.12.5, loaded on demand)
        → onAuthStateChanged → fbOnAuth(u) → fbFirstSync(u)
        → Firestore users/{uid}.json   (progress only, never audio)
        → FBUser.getIdToken() attached per request to the Workers that verify it
```

| Concern | Where | State |
|---|---|---|
| Firebase config | `index.html` `window.FB_CONFIG` (project `be-mastery`, authDomain `be-mastery.firebaseapp.com`) | public by design |
| SDK load | `FB_SDK` + `FB_PARTS`, lazy via `fbLoad()`; re-loaded at boot only when `localStorage["be12_owner"]` exists | fine |
| Auth state restoration | `FBauth.onAuthStateChanged(fbOnAuth)`; `getRedirectResult()` also called at init | fine |
| Session persistence | **no `setPersistence()` call anywhere** — SDK default (IndexedDB, local) | works, but undeclared |
| Token refresh | SDK-internal; every call site re-reads `await FBUser.getIdToken()` rather than caching | correct |
| Account creation | `fbEmailAuth("up")` → `createUserWithEmailAndPassword` → `fbWelcome()` (branded welcome mail) | implemented |
| Sign-in | `fbEmailAuth("in")` → `signInWithEmailAndPassword` | implemented |
| Logout | `fbSignOut()` → confirm → `signOut()` → `fbWipeDevice()` (clears state, entitlement cache, Polish box, IndexedDB recordings, push id) | implemented |
| Password reset | `fbReset()` → `be-mail` `/reset` (branded, `noreply@lomonec.com`), falling back to `sendPasswordResetEmail` | implemented |
| Account deletion | `fbDeleteAccount()` → `ppEraseMe()` → `entEraseMe()` → Firestore doc delete → `FBUser.delete()` → device wipe; handles `auth/requires-recent-login` | implemented |
| Email verification | **absent** — no `sendEmailVerification`, no `emailVerified` read anywhere | not implemented |
| Account linking | **absent** — no `linkWithCredential`, `linkWithPopup`, `linkWithRedirect`, `fetchSignInMethodsForEmail` or `unlink` anywhere | not implemented |
| Anonymous auth | **absent** — no `signInAnonymously`; the app works fully signed-out instead | not implemented (by design) |
| Custom auth | **absent** — no custom token minting | not implemented |
| i18n | 70 `auth.*` keys in `index.html`, all 70 present in `i18n/fr.json` | complete |
| CSP | none in `index.html` or the iOS `Info.plist` | noted, not an auth defect |

### Frontend authentication surfaces

There are exactly four, all in `index.html`:

1. `fbOpenModal(mode)` — the sign-in / create-account sheet (`#authOv`). Email,
   password, error line, submit, "forgot password", a Log in ⇄ Create account
   link, and a terms line. It remembers the sheet it was opened from (`from`)
   and returns there on success.
2. `fbAuthCard()` — the account card injected by `rData()` (App Setup): signed
   in shows the address, sync truth, *Test sync*, *Sign out*, *Delete account*;
   signed out shows *Create account* / *Log in*.
3. `fbUpdateNudge()` — the one-time floating "back up your progress" bar after
   the first completed session.
4. `pfSetupSheet("setAcc", …)` — the Profile → Backup & sync row that opens (1).

### Backend verification

| Worker | Verifies a Firebase ID token? | How | Live state |
|---|---|---|---|
| `be-partner` | **yes** | own `verifyIdToken` (RS256, Google securetoken JWKS, checks `aud`, `iss`, `exp`, `iat`, `sub`); identity is `sub` only | `/health` → `{"ok":true,"dev":false,"enabled":true}` |
| `be-entitlements` | **yes** | shared module `backend/entitlements/src/firebase-auth.js`, same checks | **not deployed** — `/v1/entitlement` returns 404 |
| `be-mail` | **yes** | own `verifyIdToken`, then an `identitytoolkit accounts:lookup` to confirm the account is minutes old before sending the welcome mail | deployed (bare `curl` → 403, i.e. origin-rejected) |
| `be-polish` | **no** | protected only by a CORS origin allow-list plus per-IP per-minute and per-day rate limits | deployed |
| `be-push` | indirectly | forwards the caller's bearer to `be-partner` `/programme` and trusts that answer for the track | deployed |
| `be-events` | **no** | anonymous counts only; no uid is ever sent | deployed |

`DEV_AUTH="1"` (the `X-Dev-User` header bypass) exists **only** in
`[env.dev]` of `backend/partner/wrangler.toml`. Production and staging do not
set it, and the live `/health` confirms `dev:false`.

### Auth-related configuration (names only, no values)

- Client, public by design: `FB_CONFIG.apiKey`, `authDomain`, `projectId`,
  `messagingSenderId`, `appId`; `MAIL_API`, `PARTNER_API`, `ENT_API`,
  `APP_URL`, `RESET_CONTINUE`.
- Worker vars: `FIREBASE_PROJECT_ID` (`be-partner`, `be-entitlements`),
  `FB_PROJECT_ID` (`be-mail`), `PARTNER_ENABLED`, `LIVE_ENABLED`, `DEV_AUTH`,
  `JWKS_URL`, `IDTK_URL`, `PARTNER_API`.
- Worker secrets (never in the repo): the `be-mail` service-account credential
  used for `accounts:lookup`, the Brevo key, `OPENAI_KEY`, `TURN_KEY_ID` /
  `TURN_KEY_TOKEN`.

Nothing auth-related is hard-coded as a secret in the repository.

---

## 2. Google Sign-In — status

**It exists as code and is unreachable. Treat the product as having no Google
Sign-In.**

- `window.fbGoogle()` (`index.html:32078`) is complete and sensible: a
  `GoogleAuthProvider`, popup for browser tabs, `signInWithRedirect` for
  installed/standalone, and a redirect fallback on `popup-blocked`,
  `operation-not-supported`, `web-storage-unsupported` or `internal-error`.
- **It has no call site.** `grep` finds `fbGoogle` on exactly two lines: the
  definition and an HTML comment. The same is true of `FB_G_ICON` and
  `FB_A_ICON` (`index.html:32197-32198`) — both Google and Apple logo SVGs are
  defined and never referenced. All of it is dead code.
- The sign-in sheet carries a comment explaining the removal:
  `signInWithRedirect` cannot complete while the app is served from
  `app.lomonec.com` but the Firebase auth handler lives on
  `be-mastery.firebaseapp.com`. Browsers partition third-party storage, so the
  session never returns and the learner lands on a page that looks signed out.
  The repository records this as verified on a real device. The stated fix is
  serving Firebase's `/__/auth/` handler from the app's own domain, which GitHub
  Pages cannot do.
- `FBauth.getRedirectResult()` is still called in `fbInit()` — harmless with no
  redirect in flight, and the piece that would be needed again.

| Item | State |
|---|---|
| Web implementation | present but unreachable (no call site) |
| iOS implementation | **none** — no auth plugin, no URL scheme (below) |
| Firebase provider enabled | **cannot be read from the repository** — console check required |
| OAuth client / redirect URI | nothing in the repository; `authDomain` is `be-mastery.firebaseapp.com` |
| Bundle / app configuration | **none** — see §3 |
| Account linking behaviour | **none implemented** — see §5 |
| Tests | none; no test in `tests/` or `backend/partner/test/` exercises Google |
| Staging configuration | `mobile/ios/staging-firebase.json` points at `be-mastery-test`; no provider config either way |
| Production configuration | `FB_CONFIG` → `be-mastery`; no provider config |

### The requested end-to-end test

**Not run, and not runnable as the product stands.** Google sign-in has no
button, so `Google sign-in → Firebase user → application account → profile →
entitlement → logout → sign back in` cannot be exercised through the UI. Running
it would mean adding a button (an implementation change, excluded from this
audit) and signing in against the production Firebase project.

### Does Google create a duplicate account when the email already exists?

**Unresolved from the repository, and it is a console setting.** Firebase's
"one account per email address" versus "multiple accounts per email address"
lives in the Firebase Authentication settings and is not expressed anywhere in
this codebase, so the answer must be read in the console rather than inferred.

What the code does tell us, and it matters:

- With one-account-per-email (the Firebase default), a Google sign-in for an
  address that already has a password account fails with
  `auth/account-exists-with-different-credential`. **`fbErr()`
  (`index.html:32075`) does not map that code**, so the learner would be shown
  the raw Firebase message. No linking would happen, because there is no
  linking code to run.
- With multiple-accounts-per-email, Google would mint a **second uid**, and
  since all progress is stored under `users/{uid}`, that learner would see an
  empty account. Nothing in the client detects or repairs this.
- One partial safeguard exists at device level: `FB_OWNER_KEY`
  (`localStorage["be12_owner"]`) records which uid the device's data belongs to.
  In `fbFirstSync`, a signed-in uid that differs from the stored owner causes the
  device copy and its recordings to be dropped rather than merged into the new
  account. That prevents data crossing between accounts; it does **not** prevent
  the duplicate account itself.

---

## 3. Sign in with Apple — status

**Entirely absent. Nothing to inspect, everything to build.**

A repository-wide search for `signInWithApple`, `OAuthProvider`,
`AppleAuthProvider`, `ASAuthorizationApple`, `SignInWithApple` and
`com.apple.developer.applesignin` returns **no matches** in any `.html`, `.js`,
`.json`, `.toml`, `.swift`, `.plist` or `.entitlements` file.

| Item | State |
|---|---|
| Xcode capability | **missing** — no `.entitlements` file exists anywhere under `mobile/ios/`, and `project.pbxproj` has no `CODE_SIGN_ENTITLEMENTS` and no `SystemCapabilities` block |
| Apple Developer App ID capability | cannot be read from the repository; must be checked in the developer portal for `com.lomonec.bemastery` |
| Entitlements (`com.apple.developer.applesignin`) | **missing** |
| Firebase Apple provider | cannot be read from the repository; console check required |
| OAuth / Services ID | **missing**. A Services ID is required for the **web** flow (and therefore for the Capacitor shell if it signs in through the web SDK); a native `ASAuthorizationController` flow on iOS needs only the App ID capability |
| Nonce / state handling | **missing** — Firebase's `OAuthProvider("apple.com")` requires a raw nonce plus its SHA-256 for the native path; none of this exists |
| Redirect URI | **missing** — would be `https://be-mastery.firebaseapp.com/__/auth/handler` unless the handler moves to an owned domain |
| Backend token validation | **no change needed.** The three verifying Workers check `aud`, `iss`, `exp`, `iat` and `sub` on the Firebase ID token and are provider-agnostic; a token minted from an Apple credential verifies identically |
| Account linking | **missing** — see §5 |
| Private relay email | **no handling.** `@privaterelay.appleid.com` appears nowhere. `fbAuthCard()` would display the relay address verbatim, and `be-mail` would send the welcome and reset mail to it (deliverable only while the Apple private-mail relay domain is registered in Apple's console) |
| First-login name | **no handling.** Apple returns the display name only on the first authorisation; nothing captures it. The app's profile name is collected in onboarding instead, so this is a missed convenience rather than a defect |
| Subsequent-login behaviour | n/a — not implemented |

### What is missing, concretely

1. The `Sign in with Apple` capability on the App ID `com.lomonec.bemastery`.
2. A `.entitlements` file containing `com.apple.developer.applesignin`, wired
   into `project.pbxproj` via `CODE_SIGN_ENTITLEMENTS` for both configurations.
3. The Apple provider enabled in the `be-mastery` Firebase project (and in
   `be-mastery-test` for staging), with a Services ID and key if the web flow is
   used.
4. Client code: either `firebase.auth().signInWithPopup(new
   firebase.auth.OAuthProvider("apple.com"))`, or — better in the shell — a
   native `ASAuthorizationController` behind a small Capacitor plugin feeding
   `signInWithCredential`, which avoids the redirect problem in §2 entirely.
5. A relay-email policy, a first-login name capture, and the linking rules in §5.
6. UI, including the 70-key `auth.*` i18n set extended across all 15 language
   files.

---

## 4. iOS requirements (Apple App Review)

### The applicable guideline, quoted

App Store Review Guidelines **4.8 Login Services**:

> Apps that use a third-party or social login service (such as Facebook Login,
> Google Sign-In, Log in with X, Sign In with LinkedIn, Login with Amazon, or
> WeChat Login) to set up or authenticate the user's primary account with the app
> must also offer as an equivalent option another login service with the
> following features:
> - the login service limits data collection to the user's name and email address;
> - the login service allows users to keep their email address private as part of
>   setting up their account; and
> - the login service does not collect interactions with your app for advertising
>   purposes without consent.
>
> […] Another login service is not required if:
> - Your app exclusively uses your company's own account setup and sign-in
>   systems. […]

### How BE Mastery stands against it today

**The app uses only company-owned authentication, so no additional login service
is required.** The sole reachable method is email and password through Firebase
Authentication in the `be-mastery` project, which Lomonec LLC controls. Firebase
is infrastructure, not a third-party social login service in the sense 4.8
names, and the app offers no Facebook, Google, X, LinkedIn, Amazon or WeChat
login. The first exemption bullet applies. This matches the unreachable state of
`fbGoogle()` established in §2 — and only because it is unreachable.

**The requirement flips the moment Google Sign-In becomes reachable.** If a
Google button is added to set up or authenticate the primary account, 4.8
applies and an equivalent privacy-preserving option must ship **in the same
release**. Sign in with Apple is the option that satisfies all three listed
features. Shipping Google without it is a predictable 4.8 rejection.

This is a reading of the published guideline against the code, not legal advice;
the owner should confirm it with App Review if a mixed-provider release is
planned.

### Related: 5.1.1(v) Account Sign-In

> If your app doesn't include significant account-based features, let people use
> it without a login. If your app supports account creation, you must also offer
> account deletion within the app.

Both halves are satisfied. The app is fully usable signed out (no anonymous auth,
no gate), and `fbDeleteAccount()` deletes the account from inside the app,
erasing Practice Partner data in `be-partner` and the entitlement row first.

### Practical iOS notes

- The shell's origin is `capacitor://localhost` (`capacitor.config.json`). Email
  and password sign-in works from there, because the Identity Toolkit password
  endpoints do not enforce Firebase's authorized-domains list — that list gates
  OAuth redirect handlers. `mobile/ios/README.md` attributes this to `localhost`
  being authorized by default, which gets the right answer for the wrong reason;
  the distinction matters as soon as an OAuth provider is added.
- `capacitor://localhost` cannot be added as a Firebase authorized domain, so
  **a web-SDK redirect or popup OAuth flow will not work in the shell.** Any
  social provider on iOS needs the native path.
- No OAuth URL scheme is registered: `Info.plist` has no `CFBundleURLTypes`.
- Installed dependencies are `@capacitor/core` and `@capacitor/ios` only, plus
  the in-house `BEStoreKitPlugin.swift`. There is no auth plugin.

---

## 5. Account linking

**There is no account-linking logic in this codebase.** No
`linkWithCredential`, `linkWithPopup`, `linkWithRedirect`,
`fetchSignInMethodsForEmail` or `unlink` call exists. Firebase's own behaviour,
governed by a console setting nobody has recorded, is therefore the whole of the
app's behaviour.

The scenarios, as the code stands:

| | Scenario | Behaviour today |
|---|---|---|
| A | Creates account with email/password | Works. `createUserWithEmailAndPassword` → `fbWelcome()` → `fbFirstSync` adopts the account copy. The one-provider case is sound. |
| B | Same email signs in with Google | **Not reachable** (no button). Were it reachable: one-account-per-email → `auth/account-exists-with-different-credential`, unmapped in `fbErr()`, raw message shown, no linking. Multiple-accounts-per-email → a second uid and an apparently empty account. |
| C | Same email signs in with Apple | **Not implemented.** Same two outcomes as B once it is. |
| D | Apple private relay email | **Not implemented, and no handling designed.** The relay address becomes the account identity, is displayed verbatim in `fbAuthCard()`, and is what `be-mail` sends to. It can never collide with a password account, so it always creates a distinct account — correct in Firebase's terms, and invisible to a learner who believes they already have one. |
| E | Previously used Apple, signs in again | **Not implemented.** Would work once built: Apple returns the same stable `sub`, Firebase returns the same uid, `FB_OWNER_KEY` matches, `fbFirstSync` adopts the account copy silently. |
| F | Previously used Google, later uses email/password | **Not reachable.** Were it: with one-account-per-email, `signInWithEmailAndPassword` fails `auth/wrong-password` or `auth/user-not-found` (both mapped) because no password credential exists on that account, and the only route back is the password reset in `fbReset()`, which does effectively add one. No code explains this to the learner. |
| G | Signs out and signs back in | **Works, and is the best-tested path.** `fbSignOut()` signs out first, then `fbWipeDevice()` clears state, recordings, entitlement cache and the push id — so nothing of that account is left for the next person on the device. Signing back in re-runs `fbFirstSync`, which adopts the account copy. |
| H | Deletes account | **Works.** Partner data erased first (a failure aborts the deletion rather than orphaning data), then the entitlement row, then the Firestore document, then the Firebase user, then the device. `auth/requires-recent-login` falls back to signing out and wiping. |

### Risks

- **R1 — duplicate learner accounts (high, latent).** Any second provider
  introduces them, and with one provider today the risk is zero. The protection
  that exists (`FB_OWNER_KEY`) guards device data, not account identity. Without
  a linking strategy, a learner who taps the wrong button sees an empty app and
  their weeks of progress apparently gone.
- **R2 — unmapped linking error (certain, small).** `fbErr()` lacks
  `auth/account-exists-with-different-credential`, so the one error that *will*
  occur first shows an untranslated Firebase string.
- **R3 — relay-email invisibility (medium).** A learner cannot tell that
  `abc123@privaterelay.appleid.com` is their account, and support cannot match
  it to a person.
- **R4 — no email verification (low here).** Nothing in the product trusts the
  address beyond delivering mail to it, so there is no privilege to escalate.
  Worth noting rather than fixing.

---

## 6. Entitlement integration

The wiring is correct in code and **inert in production**.

```
FBUser → getIdToken() → Worker verifyIdToken() → uid (token `sub`, nothing else)
       → be-entitlements D1 row → entitlement-core resolve() → plan + capabilities
       → client entSanitize() → entView()  [display only]
```

| Concern | State |
|---|---|
| Free entitlement | `ENT_FREE` is the floor; `entView()` returns it for any signed-out learner and for any uid with no cached answer |
| Premium entitlement | decided only by the server (`GET /v1/entitlement`); `entSanitize()` rejects any other shape |
| Subscription state | `state`, `expiresAt`, `renews`, `source`; `entRefreshSoon()` re-asks at most every 5 minutes on foreground, so a refund or cancellation drops to Free without a relaunch |
| Server-side capabilities | **`ENT_API=""` in `index.html:21950`, and `be-entitlements` returns 404 — not deployed.** Every production learner is Free and no entitlement request is made at all |
| AI gates | **none in production.** `be-polish` performs no token verification; it is held by a CORS origin allow-list and per-IP rate limits only. AI features are therefore available to any signed-out learner, Free or otherwise |
| Track authorisation | `be-partner` `TRACKS = {"general-english"}` refuses any other track with `403 track`, and `403 track_unverified` when the account's synced copy names no programme. Derived from the verified uid, not from a request field |
| Practice Partner authorisation | identity is resolved by `authUid()` once at the head of the protected section (plus two routes that resolve it earlier), and every route below uses that uid; `PARTNER_ENABLED="1"` and `LIVE_ENABLED="1"` in production, confirmed live |
| Audio authorisation | recordings live in IndexedDB (`recs`) and are never part of the synced state, so no filtering is needed; `fbSyncPayload` separately strips transcripts, spoken answers and the résumé. Audio sent to `be-polish` for transcription or assessment carries **no token** |
| Protected resources | `be-mail` `/welcome` requires a valid token and independently confirms with Identity Toolkit that the account is minutes old — the best-guarded route in the set |
| Provider → entitlement coupling | **none, correctly.** The uid is the token's `sub` and the plan is keyed on uid alone. No Worker and no client path reads the sign-in provider, so adding Apple or Google cannot change anyone's plan |

The caching deserves credit: `ENT_CACHE_KEY` lives outside `S`, so the
entitlement view is never synced to Firestore and a cloud merge cannot restore a
lapsed plan. `entWipe()` runs on sign-out and on deletion.

**One real gap for a paid release.** Because `be-polish` verifies nothing, the
only thing standing between a Free learner and the paid AI routes is the browser's
CORS policy — which a non-browser client ignores. Premium cannot be enforced
until `be-polish` verifies the token and asks `be-entitlements` for the plan, and
`be-entitlements` is deployed. This is an entitlement problem rather than an
authentication one, but it is reached through authentication and belongs on the
same work list.

---

## 7. Mobile testing — what must be run on a real iPhone

Nothing in this table has been run. The audit was static plus unauthenticated
probes; no device test, no simulator test, and no sign-in against the production
Firebase project was performed.

| # | Test | Status |
|---|---|---|
| 1 | Email/password — create account in the shell (`capacitor://localhost`) | **NOT TESTED** |
| 2 | Email/password — sign in to an existing account | **NOT TESTED** |
| 3 | Google sign-in | **NOT IMPLEMENTED** (code present, no UI) |
| 4 | Sign in with Apple | **NOT IMPLEMENTED** |
| 5 | Logout — confirm the device is wiped (no progress, no recordings, no plan) | **NOT TESTED** |
| 6 | Session restoration — force-quit, relaunch, still signed in | **NOT TESTED** |
| 7 | Session restoration — relaunch after 1 hour (token refresh) | **NOT TESTED** |
| 8 | Account linking — same email across two providers | **NOT IMPLEMENTED** |
| 9 | Private relay email — sign in, receive mail, display | **NOT IMPLEMENTED** |
| 10 | Password reset — branded mail arrives, link returns to the app | **NOT TESTED** |
| 11 | Password reset — `be-mail` down, Firebase fallback still sends | **NOT TESTED** |
| 12 | Entitlement after login | **NOT TESTED** — and currently unobservable: `ENT_API=""`, so everyone is Free |
| 13 | Entitlement after app restart (cache + `entRefreshSoon`) | **NOT TESTED** — same reason |
| 14 | Account deletion — partner data erased, account gone, device wiped | **NOT TESTED** |
| 15 | Account deletion with an active store subscription (the `auth.delete_sub_note` warning) | **NOT TESTED** |
| 16 | Two accounts on one device — second sign-in drops the first's data (`FB_OWNER_KEY`) | **NOT TESTED** |
| 17 | Sign-in conflict dialog — unsynced local work versus an account copy | **NOT TESTED** |
| 18 | Practice Partner after a fresh sign-in — the `403 track_unverified` path until the first sync lands | **NOT TESTED** |

Tests 1, 2, 5, 6, 7, 10, 14, 16 and 17 are the minimum for an App Store
submission of the product as it stands today. Tests 12 and 13 only become
meaningful once `be-entitlements` is deployed.

Also outstanding, from `docs/release/REVIEWER_ACCOUNTS.md`: **no demo account
has been created.** Practice Partner refuses an account whose programme has never
synced (`403 track_unverified`), so a reviewer account must be created, placed,
consented and synced before submission.

---

## 8. Release gap report

### 1. Current authentication architecture
Firebase Authentication, email and password only, in the `be-mastery` project.
Lazy-loaded compat SDK, `onAuthStateChanged` for restoration, SDK-default
persistence, per-request `getIdToken()`. Progress syncs to Firestore
`users/{uid}`; recordings stay in IndexedDB on the device. Three Workers verify the token properly;
`be-polish` verifies nothing.

### 2. Existing login providers
Email + password. One.

### 3. Missing providers
Google Sign-In (code present, unreachable, no iOS path). Sign in with Apple
(entirely absent). Email verification (absent). Anonymous and custom auth
(absent, deliberately).

### 4. Google status
Dead code. `fbGoogle()` and both logo constants have no call site. Removed from
the UI on purpose, because `signInWithRedirect` cannot complete while the app is
on `app.lomonec.com` and the auth handler is on `be-mastery.firebaseapp.com`.
No iOS implementation, no URL scheme, no tests. Provider state in the Firebase
console is unknown.
Separately: **the `feature/social-signin` branch holds no Google or Apple work.**
It has zero commits beyond `origin/main` and its worktree no longer exists, so
the uncommitted social sign-in work recorded against it is gone. Anyone briefed
otherwise should be corrected before planning.

### 5. Apple status
Not started. No capability, no `.entitlements` file, no provider, no nonce
handling, no relay-email policy, no client code, no UI, no tests.

### 6. Firebase configuration status
Project `be-mastery`, authDomain `be-mastery.firebaseapp.com`; staging validation
project `be-mastery-test` (`mobile/ios/staging-firebase.json`). Firestore sync
and rules confirmed working in the repository's own records. **Three console
facts cannot be read from the repository and must be checked by hand:** which
providers are enabled; whether the project is set to one account per email
address; and the authorized-domains list.

### 7. iOS / Xcode status
Capacitor 8 shell, bundle id `com.lomonec.bemastery`, origin
`capacitor://localhost`. No `.entitlements` file at all, no
`CODE_SIGN_ENTITLEMENTS`, no `CFBundleURLTypes`, no auth plugin. Email/password
works in the shell; any OAuth provider needs a native flow, because
`capacitor://localhost` cannot be a Firebase authorized domain. No Xcode on the
build Mac for the archive step.

### 8. Account-linking risks
R1 duplicate learner accounts (zero today, high the moment a second provider
ships, with no linking code to prevent it). R2 the unmapped
`auth/account-exists-with-different-credential` error. R3 relay-email
invisibility. R4 no email verification. Details in §5.

### 9. Entitlement / auth risks
Entitlement resolution is keyed on the verified uid and is provider-blind, so
login provider cannot alter a plan — good. But `be-entitlements` is not deployed
and `ENT_API` is empty, so every learner is Free; and `be-polish` verifies no
token, so the paid AI routes are guarded only by CORS and per-IP rate limits.
Premium cannot be enforced in production as things stand.

### 10. Apple release requirements
As shipped today, guideline 4.8 does **not** require an additional login
service: the app exclusively uses the company's own account setup and sign-in
system. Guideline 5.1.1(v) is satisfied — the app works without a login and
offers in-app account deletion. **If Google Sign-In is made reachable, 4.8
applies and Sign in with Apple must ship in the same release.**

### 11. Required implementation work

Ordered by what the release actually needs.

**Must do before submission, whatever is decided about providers**
1. Map `auth/account-exists-with-different-credential` in `fbErr()` and add the
   key to all 15 `i18n/*.json` files. Cheap, and it is the first error any
   multi-provider release produces.
2. Verify the three Firebase console facts in §8.6 and record them.
3. Create and sync the App Review demo accounts per
   `docs/release/REVIEWER_ACCOUNTS.md`, and settle the matching-exposure
   decision recorded there.
4. Decide on the dead code: either delete `fbGoogle()`, `FB_G_ICON` and
   `FB_A_ICON`, or keep them with a comment that survives the next audit. Dead
   auth code invites exactly the confusion this audit had to resolve.

**Only if Google Sign-In is to ship**
5. Sign in with Apple, in the same release (4.8). Items 6–10 below.
6. A native iOS flow rather than a web redirect: `ASAuthorizationController` (and
   `GIDSignIn`, or the native Google flow) behind a Capacitor plugin, feeding
   `signInWithCredential`. The `signInWithRedirect` problem is not fixable on
   GitHub Pages.
7. Apple capability on the App ID, a `.entitlements` file with
   `com.apple.developer.applesignin`, `CODE_SIGN_ENTITLEMENTS` in
   `project.pbxproj` for both configurations, and the Apple provider enabled in
   `be-mastery` and `be-mastery-test`.
8. Nonce handling: a raw nonce plus its SHA-256 for the native credential.
9. A linking strategy, written down before any code: set the project to one
   account per email address, catch
   `auth/account-exists-with-different-credential`, use
   `fetchSignInMethodsForEmail` to tell the learner which method their account
   uses, and link with `linkWithCredential` after they prove the existing one.
10. Relay-email handling: register the Apple private-mail relay domain so
    `be-mail` can deliver, capture the first-login display name, and show
    something a learner recognises instead of the bare relay address.

**For a paid release (reached through auth, listed for completeness)**
11. Deploy `be-entitlements` and set `ENT_API`.
12. Make `be-polish` verify the Firebase token and resolve the plan server-side.
    Per the project's own notes, the production CORS fix must ship before or with
    any bundle that sends signed-in AI calls.

### 12. Required tests

- The 18 device rows in §7, with 1, 2, 5, 6, 7, 10, 14, 16 and 17 as the
  submission minimum.
- Worker-side: extend `backend/partner/test/run.mjs` with a token carrying an
  Apple or Google `firebase.sign_in_provider` claim, proving the verifier stays
  provider-blind and the uid still comes from `sub`.
- A browser test in `tests/` for the sign-in sheet: the error line renders a
  mapped message for each code in `fbErr()`, including the new linking code.
- If linking is built: an automated pass over scenarios A–H in §5 against the
  `be-mastery-test` project, never against production.
- `be-mail`: `/welcome` and `/reset` with an absent, malformed, expired and
  valid token.
- i18n parity for every new `auth.*` key across all 15 files.

---

## READY FOR AUTHENTICATION IMPLEMENTATION REVIEW — DO NOT MERGE OR DEPLOY
