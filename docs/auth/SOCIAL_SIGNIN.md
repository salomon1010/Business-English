# Google and Apple sign-in — what is built, and what only you can do

Branch `feature/social-signin-ios`, from `origin/main` `51670064`. Not merged,
not pushed, not deployed. Production is untouched.

Email and password still work exactly as before, everywhere. Google and Apple
appear **only inside the App Store app**, and only once the console work below is
done. The web app at app.lomonec.com is unchanged.

---

## 1. How it works (one paragraph)

Firebase Authentication stays the only identity store. A native plugin
(`BEAuthPlugin.swift`, exposed to the web layer as `BEAuth`) obtains a provider
ID token on the device; the web layer turns it into a Firebase credential with
`signInWithCredential`. From that point the app cannot tell which provider was
used: the same `FBUser`, the same first sync, and the same ID token that every
Worker already verifies. There is no second session, and no server of ours in the
sign-in path.

Why native rather than the web SDK's popup or redirect: the shell is served from
`capacitor://localhost`, which cannot be a Firebase authorised domain, and on
app.lomonec.com the auth handler sits on be-mastery.firebaseapp.com, whose
storage browsers partition. Both paths leave the learner on a page that looks
signed out. That is why `fbGoogle()` has never been offered and why the buttons
are drawn only where the plugin exists.

- **Apple** — `ASAuthorizationAppleIDProvider`, the system sheet. The request
  carries SHA-256 of a fresh nonce; the raw nonce goes to Firebase so the
  credential is bound to that request.
- **Google** — `ASWebAuthenticationSession` + PKCE against Google's own
  endpoints, using the project's **iOS OAuth client** (a public client: no
  secret exists, so there is nothing to keep out of the repository). No
  GoogleSignIn SDK, no `CFBundleURLTypes`: the session owns its callback scheme.
  The access token is discarded — BE Mastery never calls a Google API.

Nothing is logged: not a token, not a code, not a verifier.

---

## 2. What you must do by hand

Nothing below can be done from the repository, and none of the values may be
guessed. Until step 2.2 is done, the app shows **Apple only**; until 2.1 and 2.3
are done, a tap on either button fails at Firebase.

### 2.1 Apple Developer portal — the App ID capability

1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers**.
2. Open the App ID for **`com.lomonec.bemastery`** (create it if it is not
   there — it is also what the bundle id needs).
3. Tick **Sign in with Apple**, leave it as *Enable as a primary App ID*, Save.
4. Regenerate/refresh the provisioning profile — in Xcode, automatic signing
   does this when you next build, provided the Lomonec team (8TKAAK2MG6) is
   selected.

The entitlement is already committed (`mobile/ios/ios/App/App/App.entitlements`,
`com.apple.developer.applesignin = [Default]`, wired into both build
configurations). A build will fail to sign until the App ID carries the
capability.

**Service ID, Apple private key, key ID, team ID:** not needed for *signing in*
— we sign in on Apple platforms only — but they **are** needed for revoking the
authorisation when an account is deleted, which Apple requires of us. They go
into the Firebase console, never here. Full steps in **§5**.

### 2.2 Google Cloud — the iOS OAuth client

1. console.cloud.google.com → the project behind Firebase **be-mastery** →
   APIs & Services → **Credentials**.
2. **Create credentials → OAuth client ID → iOS**. Bundle ID:
   `com.lomonec.bemastery`.
3. Copy the **Client ID** (it looks like
   `1234567890-abcdefghijklmnop.apps.googleusercontent.com`).
4. Paste it into `mobile/ios/ios/App/App/Info.plist`, as the value of
   **`BEGoogleIosClientID`** (the key is committed with an empty string).
   An iOS OAuth client has no secret, so this value is public by design — it is
   the same thing a `GoogleService-Info.plist` carries in the clear.
5. Rebuild. The Google button appears only when that value is non-empty; the
   plugin reports what the build can offer and the sheet draws from that.

No redirect URI needs registering: an iOS client's redirect is its own client ID
reversed, which `ASWebAuthenticationSession` claims itself.

### 2.4 The web (4 Oct 2026) — the same two buttons on app.lomonec.com

The owner asked for Apple, Google and email on **every** sign-in sheet, not only
in the App Store app. On the web the two buttons now use Firebase's **popup**
flow (`fbSocialWeb` in index.html): the popup on `<project>.firebaseapp.com`
hands its result back to the page with `postMessage`, so the partitioned
storage that broke `signInWithRedirect` does not come into it. Gate: flag
**`social_signin_web_enabled`** — ON on staging, **OFF in production** until the
console work below is done, because a button that fails is worse than none.

What only you can do, per Firebase project (be-mastery for production,
be-mastery-test for staging):

1. Authentication → Sign-in method → **Google**: Enable (project support e-mail
   set). Nothing else: the web client is created by Firebase.
2. Authentication → Sign-in method → **Apple**: Enable, and fill in **Services
   ID**, **Apple team ID**, **Key ID**, **Private key** — on the web these are
   REQUIRED (on iOS they were only needed for revocation). The Services ID's
   return URL is `https://<project>.firebaseapp.com/__/auth/handler`, and its
   associated domain list must carry the Services ID's web domain. §5 has where
   each value comes from.
3. Authentication → Settings → **Authorized domains**: `app.lomonec.com` is
   already on be-mastery; **`staging.lomonec.com` must be added to
   be-mastery-test** (it is not there today — checked 4 Oct 2026), or the staging
   popup is refused with `auth/unauthorized-domain`.
4. Then set `social_signin_web_enabled:true` in `FLAGS_DEFAULT` for production.

Known limits, by design:

- An **installed** web app whose `authDomain` is another origin — the Play TWA,
  an iOS home-screen PWA — shows email and password alone (`socialWebOn()`):
  there is no popup opener there, and a redirect never returns from a
  partitioned handler. Lifting that means serving `/__/auth/*` from
  app.lomonec.com itself (a Cloudflare Worker in front of the host, which today
  points straight at GitHub Pages) and setting `authDomain` to the app's host.
  A hosting decision; not done.
- A provider the console has not switched on answers `auth/operation-not-allowed`
  on tap; the sheet says "… sign-in is switched off for BE Mastery right now" and
  the email form is still there.
- A blocked popup shows `auth.err_popup_blocked`; a closed popup says nothing.

Tests: `tests/auth-social.mjs` section "the web offers both providers too"
(W1–W12).

### 2.3 Firebase console — enable the two providers

Firebase console → project **be-mastery** → Authentication → **Sign-in method**.

| Provider | What to set |
|---|---|
| **Google** | Enable. The project support e-mail must be set. The iOS client from 2.2 is picked up automatically because it belongs to the same Google Cloud project; nothing to paste. |
| **Apple** | Enable. Sign-in alone works with **Services ID**, **Apple team ID**, **Key ID** and **Private key** empty — but account-deletion revocation needs all four, so fill them in now: **§5** has where each one comes from. |
| **Email/Password** | Already enabled. Leave it alone. |

Also check, in the same place: **Authentication → Settings → User account
linking**. Both settings work with this build, but they behave differently and
you should choose deliberately:

- **"Link accounts that use the same email" (one account per e-mail)** —
  recommended. Firebase refuses the second provider with
  `auth/account-exists-with-different-credential`, and the app then shows
  *"name@example.com already has an account with a password. Log in below and
  we'll connect them."*, pre-fills the address, and links the provider to the
  existing account after the password sign-in. One learner, one account, all
  their progress.
- **"Create multiple accounts for each identity provider"** — the same person
  signing in with Google would get a *second, empty* account and would think
  their progress had vanished. Do not choose this.

Do **not** add `capacitor://localhost` to the authorised domains: it is not a
valid domain and the native path does not need it.

### 2.4 For the validation project (optional)

The same three steps in **be-mastery-test** if you want to exercise sign-in on
staging. The staging bundle (`npm run sync:staging`) signs in there.

---

## 3. What the learner sees

The sign-in sheet (Log in and Create account both) now shows, in this order:

```
    [  Continue with Apple   ]
    [  Continue with Google  ]
    ───────────  or  ───────────
    e-mail
    password                  [eye]
    [ Log in / Create account ]
```

- Apple first, as Apple asks where it is offered beside other providers. Both
  buttons are white with a hairline border in both themes, 48 px tall, each
  carrying its own mark.
- Cancelling either sheet says **nothing** — no error, the sheet stays open.
- A provider failure says *"That sign-in couldn't finish. Try again, or use your
  email and password."* A raw Firebase or OAuth message is never shown.
- The eye reveals the password and never touches its value (see §6).
- Strings are in all 15 packs; French, Spanish, Portuguese and Arabic are
  translated, the other eleven fall back to English as usual.

Apple's name, when Apple sends it (first authorisation only), fills an **empty**
profile name and never overwrites one. Apple's e-mail is deliberately ignored by
the app: it may be a private relay address, so only Firebase's own record of the
account is trusted. Nothing assumes the Apple address is the learner's real one.

---

## 4. Kill switch

`FLAGS_DEFAULT.social_signin_enabled` is `true`. Setting it to `false` — or
`localStorage.be_flags = {"social_signin_enabled":false}` on a device — removes
both buttons and leaves e-mail and password. It changes nothing on the web,
where the buttons never appear.

---

## 5. Apple revocation on account deletion — built

Apple requires an app offering Sign in with Apple **and** account deletion to
hand the authorisation back when the account goes. Deleting the Firebase user
does not do it. This is implemented, not deferred.

**How it works.** `fbDeleteAccount()` now starts with `fbAppleRevoke()`:

1. Does this account carry an `apple.com` provider? If not, nothing happens and
   deletion proceeds exactly as it always did.
2. If it does, the learner confirms once with Apple's sheet. That is deliberate:
   an authorisation code is single-use, lives about five minutes, and Firebase
   keeps none — so the only honest way to have one at deletion time is to ask.
   The same confirmation satisfies Firebase's recent-login rule, which deletion
   needs anyway.
3. The fresh code goes to **be-mail `POST /apple/revoke`** with the learner's ID
   token. That Worker proves from Firebase, with a service account, that the
   account really has Apple on it, then calls `accounts:revokeToken`
   (`providerId: "apple.com"`, `tokenType: "CODE"`).
4. **Only on success does anything get erased.** Partner data, the entitlement
   row, the Firestore document and the Firebase user all come after.
5. If revocation cannot be confirmed, nothing is deleted, the account is left
   whole, and the learner is told plainly to try again. A retry fetches a new
   code and works.

**No Apple private key is anywhere in this repository, in any Worker, or in the
iOS bundle.** Firebase performs the exchange with Apple, so the `.p8` is
uploaded once to the Firebase console and never leaves Google.

### What you must configure for it to work

Firebase console → Authentication → Sign-in method → **Apple**: fill in
**Services ID**, **Apple team ID**, **Key ID** and the **private key (.p8)**.
These are the fields §2.3 said to leave empty for sign-in alone — revocation is
what needs them. To get them:

1. developer.apple.com → Identifiers → **Services IDs** → create one (e.g.
   `com.lomonec.bemastery.signin`), enable Sign in with Apple, and configure it
   with the primary App ID `com.lomonec.bemastery`. Firebase shows the return
   URL to paste (`https://be-mastery.firebaseapp.com/__/auth/handler`).
2. developer.apple.com → **Keys** → create a key with **Sign in with Apple**
   enabled, tied to that App ID. Download the `.p8` **once** — Apple will not
   show it again. Note its **Key ID**. Your **Team ID** is 8TKAAK2MG6.
3. Paste all four into the Firebase Apple provider and save. Do **not** put the
   `.p8` in this repository or in a Worker secret; it belongs in Firebase only.

Then deploy be-mail (`cd backend/mail && npx wrangler deploy`) and set the new
var — it is already in `wrangler.toml`, so a deploy carries it.

**Until that is done, `/apple/revoke` answers 503 and an Apple learner cannot
delete their account.** That is the deliberate, safe failure: it is better than
telling someone their account is gone while Apple still believes they are signed
in. It also means **Apple sign-in must not be switched on in a shipped build
before this is configured and be-mail is deployed** — the two go in the same
release.

**One honest limitation:** deleting an Apple-linked account **from the web** is
refused, with a message asking the learner to use the iPhone app, because no
authorisation code can be obtained outside the native sheet. Email/password and
Google accounts delete on the web exactly as before.

## 6. Show/hide password

One authentication password field exists in the app (the sign-in sheet serves
both Log in and Create account); password reset is an e-mail link, with no
new-password field, and there is no confirm-password field. That one field now
carries an eye button: a real `<button type="button">` beside the input inside a
positioning wrapper, 46×44 px, `aria-pressed` and an `aria-label` that flips
between *Show password* and *Hide password*. It changes the input's `type` and
nothing else — the value is never read, copied, stored or sent, so validation,
strength rules and the sign-in call behave exactly as before.

The four other `type="password"` inputs in the app are maker-only API-key fields
(GitHub token, Anthropic, ElevenLabs, OpenAI), behind the hidden developer
toggle. They are not authentication and were left alone.

---

## 7. Device matrix — what is still unproven

Everything below needs a signed build on a physical iPhone and is **PENDING**.
Nothing in the automated suite can stand in for it.

| # | Check |
|---|---|
| 1 | Apple's sheet appears, Face ID / passcode completes it |
| 2 | "Hide My Email" produces a working relay account and the app behaves |
| 3 | Apple's name arrives once and fills an empty profile name |
| 4 | Google's account chooser opens, an account is picked, the app comes back |
| 5 | Google on a device already signed in to Google (no password typed) |
| 6 | Cancelling each sheet leaves the app exactly as it was |
| 7 | Aeroplane mode during each flow gives the network line, not a hang |
| 8 | An existing password account signing in with Google links, keeps progress |
| 9 | Session survives a real force-close and relaunch |
| 10 | Sign out, then sign in again with each of the three ways |
| 11 | Account deletion of an Apple account: the second Apple confirmation appears, revocation succeeds, the account goes |
| 11b | Deleting an Apple account with be-mail unreachable: nothing is deleted and the message says so |
| 11c | Account deletion still completes for a Google and for an email/password account, with no Apple sheet |
| 11d | In Apple's Settings → Sign in with Apple, BE Mastery is gone after a deletion |
| 12 | An AI call (Shadow transcript) works after each kind of sign-in |
| 13 | The eye button on a real thumb, in both themes, in WKWebView |

Automated, already passing locally: `cd tests && node auth-social.mjs` — 86
checks — and `node apple-revoke.mjs` — 42 checks, which run the real be-mail
module with real RS256 token verification (the Capacitor bridge, the Firebase web
SDK and Google's endpoints are stand-ins). Plus `node auth-sheet.mjs` 18/18
unchanged, `node mail-welcome.mjs` unchanged, and `cd mobile/ios && node
scripts/check-release.mjs` with ten new iOS-configuration checks.
