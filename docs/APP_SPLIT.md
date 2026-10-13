# BE Mastery — two apps from one codebase

**Owner's decision, 12 October 2026.** BE Mastery ships as two independently
installable products:

| | Google Play | App Store | Programme |
|---|---|---|---|
| **BE Mastery** (General English) | `com.bemastery.app` | `com.lomonec.bemastery` | `general-english` |
| **BE Mastery Welding** | `com.lomonec.bemastery.welding` | `com.lomonec.bemastery.welding` | `welding` |

The Welding package was **confirmed by the owner on 12 Oct 2026** as
`com.lomonec.bemastery.welding` on both stores — one identifier per app. (A
later brief quoted `com.bemastery.welding`; that string appears nowhere in this
repository and was never used. A Play package is permanent from the first
upload, so it was settled before anything was uploaded. Nothing has been.)

The existing app keeps its identity, its listings, its users and its progress.
Welding English is a new listing on both stores. This is a product separation,
not a rewrite: one repository, one web app, one backend, one account, one
Premium subscription.

**Nothing here is deployed, uploaded or submitted.** Everything that only the
account owner can do is in § Store actions at the end.

---

## 1. How the separation works

`areaId()` is the single question every feature in index.html asks about the
programme (see CLAUDE.md § Areas). Pinning it pins everything downstream — the
curriculum, Home's recommendations, Shadow Studio, the game hubs, the ads gate,
the analytics boundary and the backend's own programme read — in one place.

```
mobile/ios/scripts/sync-web.mjs --track welding
        │
        ├─ writes be-build.js      window.BE_BUILD={"track":"welding"}
        ├─ loads it first in <head> of the bundled index.html
        └─ REMOVES the other programme's content from the bundle
                │
index.html      BE_APP_TRACK = "welding"
        ├─ areaId() returns it, whatever the saved or synced state says
        ├─ ProfessionalTrackContext.bindActive() is bound to it
        ├─ S.professionalTracks.activeId is REWRITTEN to it at boot
        ├─ selectProfessionalTrack / areaSwitch / obTrackPick refuse the other id
        ├─ go() refuses the other programme's views (VIEW_TRACK)
        ├─ the onboarding programme step is skipped
        ├─ Home draws no other-programme card and no Programme row
        └─ curriculumBoot loads only what this app needs
```

Four locks, not one:

1. **The build** names the programme; the page cannot be argued out of it.
2. **The router** (`VIEW_TRACK` in `go()`) turns away the other programme's
   pages — a typed hash, a view restored from `sessionStorage` after a
   relaunch, a `bemastery://` deep link, a widget tap, a notification.
3. **The bundle** does not contain the other programme's curriculum, video
   library, captions, scenes or photos, so there is nothing to draw even if a
   screen were reached.
4. **The native build** (Gradle flavor / Xcode xcconfig) refuses to package a
   web bundle for the other programme — see § 4.

`BE_APP_TRACK` is `null` on the web and in any bundle built without `--track`,
so **app.lomonec.com is unchanged**: it still serves both programmes to one
account, with the Programme page and the switch, exactly as today.

### What each app contains

| | General English app | Welding app |
|---|---|---|
| Curriculum | `tracks/general` | `tracks/welding` (+ the English-language machinery it inherits — see below) |
| Video library | `catalogue/general.json`, 385 clips | `catalogue/welding.json`, 534 clips |
| Captions | its own 400 files | its own 554 files |
| Shadow Studio | Watch / Shadow / Challenge / Apply | the same, on refinery-trade clips |
| Animated scenes | yes | no |
| Game hub | English Mastery (`#english`) | Welding Mastery (`#mastery`) |
| Practice Partner, Life Simulations, learning nudges | yes | no |
| Workshops, workplace lines, Career Destination, trades, professional standards | no | yes |
| Executive Polish, Foundations, Road map, Progress, phrase bank, Smart Coach | yes | yes |
| Premium, ads, authentication, notifications, widgets | yes | yes |

**Why the Welding bundle still carries `tracks/general/*`.** The Welding
curriculum *inherits* the English-language machinery from General English — the
stop-word list, the CEFR map, the grammar rules and the grammar drills —
through `professional-tracks.js`, which fills only the fields the Welding pack
leaves **empty**. No General English week, phrase or word can displace trade
content. `CurriculumProvider` rejects a missing section outright, so deleting
one would break the Welding app; this is the bug that once gave every welder
"eight questions at a time" with nothing behind them. What *is* removed from
the Welding bundle is General English **content**: `missions.json`, the English
Mastery pack, the video catalogue and its captions, the animated scenes and the
role-play photos.

**What is deliberately still shared in both bundles.** The other programme's
JavaScript modules (`english-mastery.js`, `welding-mastery.js`, `trades.js`,
`professional-standards.js`) are loaded by plain `<script>` tags and half the
app guards them with `window.X &&`. Dropping the tags is a bigger change than
this split needs, so they stay — with no reachable entry point (the hub gate,
the Practice tab and `go()`'s `VIEW_TRACK` each refuse) and with their content
packs removed, so there is nothing for them to draw. Worth doing later for
bundle size; it is not a leak.

---

## 2. One account, two apps

Authentication, progress, the phrase bank, Premium and the backend are **shared
and unchanged**. A learner signs in with the same account in both apps; each
app shows only its own programme's records, exactly as the one app already does
when you switch programme (`areaId()`-scoped stores — CLAUDE.md § Areas).

### The one thing to know about the backend

The server's authority on "which programme is this account in" is the account's
own synced state: `be-partner`'s `accountTrack()` reads
`users/{uid}.json → professionalTracks.activeId` from Firestore with the
caller's own token, and `be-push`, `be-coach` and the game Worker all reuse it
through `GET /programme`. That is why each app **writes its own programme into
the state at boot**.

**Documented limit.** With both apps installed on one account, the server's view
follows whichever app synced last. It cannot leak content (each bundle ships
only its own), it cannot change Premium (that is account-level by design) and it
cannot reach another learner's data. What it can do, in the seconds between
switching apps and the next sync, is mis-scope Practice Partner availability or
a game energy bucket. Closing it properly needs a per-app identity on the
request — Play Integrity on Android, App Attest on iOS — or a per-app document;
both are separate pieces of work, and neither is needed for the first release.

---

## 3. Premium — one app, one subscription

**Owner's rule, 12 October 2026: each app sells its own subscription, and a
purchase in one app does NOT unlock the other.** Both apps use the same price
points; neither can be unlocked by the other's purchase.

> This REVERSES the shared-entitlement design of the same morning, which let a
> purchase in either app grant Premium on the account. If you want the shared
> behaviour back, see § 7 Rollback — it is a configuration change, not a code
> change.

### The price points — verified, not assumed

Read back from the live Play console on 12 Oct 2026 (`androidpublisher
v3 subscriptions.list`, read-only):

| product | base plan | period | US | GB | FR | CM | grace | regions | offer |
|---|---|---|---|---|---|---|---|---|---|
| `premium_monthly` | `monthly` | P1M | **$2.99** | £2.69 | €3.19 | 2 100 XAF | P3D | 174 | `trial3d` = 3 days free |
| `premium_annual` | `annual` | P1Y | **$19.99** | £17.99 | €20.99 | 13 700 XAF | P14D | 174 | `trial3d` = 3 days free |

Both base plans ACTIVE, `eeaWithdrawalRightType = WITHDRAWAL_RIGHT_SERVICE`.
**The Welding app's products must be created with these same figures.** Nothing
here was invented, and the figures in older notes that disagree (a $4.99
monthly, a $24.99 annual) are not what the console holds.

Store product ids are per app, so the Welding app can reuse
`premium_monthly` / `premium_annual`: they are separate products in a separate
listing, with their own subscription group on Apple. No new ids are invented,
and `PRODUCTS` in `entitlement-core.js` needs no change.

### How the separation is enforced

Three things, and the first two are the ones that matter:

1. **A purchase records the app that sold it, from the store's own signature.**
   `billing.js` takes the Play listing Google verified the token against, or the
   `bundleId` inside Apple's JWS, and maps it to a programme. Never from the
   client.
2. **The entitlement is resolved per (account, app).** `purchase_links.app_id`
   and a per-app `entitlements` row (migration 0005). `GET /v1/entitlement?app=…`
   answers about one app, and the view carries `app` so a reply can never be
   mistaken for the other app's.
3. **The client asks about itself.** `entApp()` is `BE_APP_TRACK` (the General
   English app on the web), the cache is keyed by (uid, app), and a purchase
   reply naming another app is refused rather than drawn.

The mapping is index-aligned configuration:

```
PLAY_PACKAGE    = "com.bemastery.app,com.lomonec.bemastery.welding"
APPLE_BUNDLE_ID = "com.lomonec.bemastery,com.lomonec.bemastery.welding"
APP_PROGRAMMES  = "general-english,welding"
```

Position *i* is the same app everywhere. Two deliberate failure modes:

* **Extending a store list without extending `APP_PROGRAMMES`** refuses the new
  app's purchases (`500 app_unmapped`) and leaves the existing app's working. A
  configuration mistake must not take live billing down.
* **An app the service is not configured for is answered Free**, never another
  app's plan. Without this, the Welding app would have been handed the General
  English plan on every deployment where `APP_PROGRAMMES` had not been extended
  yet — which is exactly the leak the rule forbids. (Found by a test, not by
  reasoning: `W23`.)

### Deployment order is part of the boundary (found 12 Oct 2026)

The client asks `GET /v1/entitlement?app=<programme>`, and the service names the
app it answered about. **An older service does not know about apps at all** — it
answers about the account as a whole. That is the pre-split contract, and it is
right for the General English app, which is the only app that has ever sold a
subscription. For any other app it is another app's plan.

The deployed `be-entitlements` is that older service today. So if the Welding
app reached a store before the Worker was updated, every General English
subscriber would silently have been Premium in the Welding app too — the exact
cross-app unlock the owner's rule forbids, arriving through the most likely
deployment order rather than through a bug in the rule.

`entViewIsOurs(j)` closes it, mirroring on the client what the server already
does with an unknown app:

* the view names **this** app → take it;
* the view names **another** app → refuse it outright;
* the view names **no** app → accept it only for the default app
  (General English), because that is the pre-split contract.

A refused view is Free, and nothing is cached. Checks 77–81 in
`tests/app-split.mjs` are the regression, and they fail against the code as it
stood before the fix.

**Consequence for the release order:** the Welding app can ship before the
Worker is updated without leaking anything — it will simply report Free until
the Worker understands `?app=`. The order is now safe in both directions.

### What this costs, stated plainly

* A learner who wants Premium in both apps **pays twice**. That is the owner's
  decision; it is not a defect.
* `Billing.reconcile()` and **Manage subscription** work per app, which is now
  correct rather than a limitation: each app only ever deals with the store
  listing that sold its own subscription.
* **Existing subscribers are unaffected.** Their purchase has no `app_id`, every
  read treats that as the General English app, and that is the only app that has
  ever sold a subscription. A Welding subscriber does not exist yet.
* The website keeps the General English app's entitlement, which is what it has
  always sold.

### Not gated on the client

`hasEntitlement()` is still the one gate and still reads a server view. No
client flag grants Premium: `?app=` can only *select* among the account's own
real purchases, and what creates one is only a store-signed transaction.

Tests: `backend/entitlements/test/billing.mjs` § "Two apps, separate
entitlements" (W1–W23) — 138/138; `tests/app-split.mjs` § 10 (66–76) — 76/76.

## 4. Native builds

### Android — Gradle product flavors

`mobile/android/android/app/build.gradle`:

| flavor | applicationId | versionCode | label |
|---|---|---|---|
| `general` | `com.bemastery.app` | 19 | BE Mastery |
| `welding` | `com.lomonec.bemastery.welding` | 1 | BE Welding |

```
cd mobile/android
bash scripts/build.sh            # General English debug APK
bash scripts/build.sh welding    # Welding debug APK
bash scripts/release.sh welding  # signed Welding AAB
```

`verify<Variant>WebBundleProgramme` runs before the assets are merged and fails
the build if `assets/public/BUNDLE_INFO.txt` names a different programme — so a
Welding listing can never be filled with General English lessons.

Flavor overlays:

* `src/welding/res/values/strings.xml` — app name, package name, URL scheme, widget labels.
* `src/welding/res/values/ic_launcher_background.xml` + `mipmap-*` — the launcher
  icon, generated from the app's own `welding-mastery-logo.svg` on the Welding
  navy. `playstore/welding/play-icon-512.png` is the listing icon.
* `src/welding/AndroidManifest.xml` — removes `BEWidgetProviderGE` and
  `BEWidgetProviderPro` (in this app `BEWidgetProvider` *is* the Welding road map).
* `src/general/AndroidManifest.xml` — removes `BEWidgetProviderPro` and
  `BEWidgetMasteryProvider`. **This is the one place the existing app loses
  something**: both are Welding-only (the Mastery widget reads the `pro`
  snapshot and its tap opens `#mastery`), so in a General-English-only app they
  could only draw an empty card and lead nowhere.

**Sign in with Apple on Android is not offered in the Welding build.**
`auth.lomonec.com` redirects Apple's answer to a hard-coded `bemastery://apple`,
which only one installed app may claim; a second claimant would put an app
chooser between the learner and their sign-in, and the app that did not start
the flow would silently drop it (the state would not match). The Welding flavor
claims `bemasterywelding://` instead and `BEAuthPlugin.available()` answers
`apple: false`. Google and e-mail are unaffected. It turns on the day be-auth
can choose the scheme per app — a change to a **production** Worker, so it is an
owner decision, not a build change.

### iOS — one project, two identities

The project's own settings are the existing app. `ios/App/Welding.xcconfig`
overrides four build settings and `mobile/ios/scripts/build.sh` passes it:

```
BE_APP_BUNDLE_ID = com.lomonec.bemastery.welding
BE_APP_GROUP     = group.com.lomonec.bemastery.welding
BE_DISPLAY_NAME  = BE Welding
BE_PROGRAMME     = welding
```

Every target derives its bundle id from `BE_APP_BUNDLE_ID`
(`$(BE_APP_BUNDLE_ID)`, `$(BE_APP_BUNDLE_ID).BEPushService`,
`$(BE_APP_BUNDLE_ID).BEWidget`), so the app and both extensions move together
and cannot drift — which is also Apple's signing rule. `CFBundleDisplayName`,
`BEAppGroup` and `BEProgramme` come from the build; the two entitlement files
name the App Group as `$(BE_APP_GROUP)`, so each app signs for its own
container and the Welding widget can never read the other app's snapshot.

```
cd mobile/ios
bash scripts/build.sh                     # General English, Simulator
bash scripts/build.sh welding             # Welding, Simulator
bash scripts/build.sh welding --archive   # Welding archive (needs a Distribution profile)
node scripts/check-release.mjs --programme welding
```

`build.sh` syncs the right web bundle and verifies `BUNDLE_INFO.txt` before
`xcodebuild` runs, the same guarantee Gradle gives on Android. The widget
gallery is chosen at **compile** time (`#if BE_WELDING` / `#elseif BE_GENERAL`
in `BEWidgetBundle.swift`), because `WidgetBundleBuilder` has no runtime branch;
`build.sh` passes the condition. A plain build straight from Xcode sets neither
and keeps today's gallery.

> This Mac has Xcode 27 at `/Applications/Xcode.app` but `xcode-select` points
> at the Command Line Tools and switching it needs `sudo`. `build.sh` sets
> `DEVELOPER_DIR` instead, so no password is required for a build.
>
> **A SIGNED build needs someone at the keyboard.** `--device` and `--archive`
> run to the end of compilation and then stop dead inside `codesign`, at 0% CPU,
> because macOS raises a keychain prompt for the signing key and `SecurityAgent`
> waits for a human to click Allow. Nothing in the log says so — the build simply
> never finishes (`pgrep -fl SecurityAgent` is how to tell). Either click the
> prompt, or unlock the keychain and grant `codesign` always-allow access to the
> identity first. `--simulator` (the default) is unaffected: it builds with
> `CODE_SIGNING_ALLOWED=NO`.

---

## 5. Website

**No change, and that is the recommendation.** `app.lomonec.com/bemastery/`
keeps serving the unsplit web app: both programmes, the Programme page, the
switch. Existing web learners lose nothing, and a learner who uses both
programmes on the web is served by one page as they are today. A separate
Welding web entry point would be a new product decision with its own SEO,
listing and portal work; nothing in the split requires it.

---

## 6. Store actions — only the account owner can do these

Nothing below can be done from this repository. The Play Android Publisher API
has no "create application" call (probed: `com.lomonec.bemastery.welding` →
`404 Package not found`), and App Store Connect needs an API key with an issuer
id that is not on this machine.

**Google Play**

1. Play Console → **Create app** → `com.lomonec.bemastery.welding`, name
   "BE Mastery Welding". The package is fixed at the first upload and can never
   be changed.
2. Upload `mobile/android/android/app/build/outputs/bundle/weldingRelease/app-welding-release.aab`
   to **Internal testing** (it is signed with the existing upload key, SHA-256
   `3D:E6:6D:…`; Play App Signing will mint a separate app signing key for the
   new app).
3. Store listing: title, short and full description, screenshots, feature
   graphic; icon `playstore/welding/play-icon-512.png`.
4. Data safety, content rating, target audience, privacy policy URL
   (`https://app.lomonec.com/privacy.html`), account deletion URL.
5. Subscriptions, matching the existing app exactly (figures read back from the
   console on 12 Oct 2026 — § 3):
   * `premium_monthly`, base plan `monthly`, **P1M**, **US$2.99**, grace **P3D**
   * `premium_annual`, base plan `annual`, **P1Y**, **US$19.99**, grace **P14D**
   * a `trial3d` offer on each base plan: one phase, **P3D**, free
   * the same 174 regions and `WITHDRAWAL_RIGHT_SERVICE`
   These are SEPARATE products in a separate listing — the ids may be reused
   because store product ids are per app.
6. Grant the existing service account access to the new app, if Play does not
   inherit it.

**App Store Connect**

7. Register the App ID `com.lomonec.bemastery.welding` plus
   `…welding.BEPushService` and `…welding.BEWidget`, and the App Group
   `group.com.lomonec.bemastery.welding` (automatic signing in Xcode will do
   this when signed in as LOMON EC LLC, team `8TKAAK2MG6`).
8. New app record, name "BE Mastery Welding", bundle id as above.
9. Its OWN subscription group with `premium_monthly` / `premium_annual`, the
   same price tiers as the existing app (US$2.99 / US$19.99) and a 3-day
   introductory free trial on both. An App Store subscription group belongs to
   one app, so this cannot be shared with the existing app — which is the point.
10. Listing text, screenshots, privacy answers, review notes, age rating.

**Firebase**

11. Add `com.lomonec.bemastery.welding` as a second **Android** app in project
    `be-mastery`, with the upload and Play App Signing SHA-1s, and put the
    `google-services.json` at
    `~/.config/be-mastery/firebase/google-services.welding.production.json`.
    Until it exists the Welding Android build simply has no notifications
    (`BEPush.available()` is false). **No Worker change is needed**: be-push
    sends FCM `messages:send` with a registration token, which identifies the
    app by itself, and the same `FCM_SA_JSON` service account covers every app
    in the project.
12. Add `com.lomonec.bemastery.welding` as a second **iOS** app for APNs. This
    one DOES need a Worker change: `be-push` sends the `apns-topic` header from
    a single `APNS_TOPIC` var (`com.lomonec.bemastery`, with the same value
    hard-coded as `APNS_TOPIC_DEFAULT`), and Apple refuses a token whose topic
    does not match. Each subscription row has to carry its own bundle id before
    Welding iOS notifications can work — the same allow-list treatment
    `PLAY_PACKAGE` has just had. Until then the Welding iOS app registers
    normally and is simply never sent to.

**AdMob**

13. A new AdMob app for each new store listing, with its own app id and ad unit
    ids (`res/values/ads.xml` on Android, `Info.plist` on iOS). Not urgent:
    `ads_enabled` is `false`, and on Welding ads are limited to the game hub in
    any case.

**Workers (production changes — owner's call)**

14. `be-entitlements`: apply **migration 0005** (`npx wrangler d1 migrations
    apply be-entitlements --remote`), then set all three lists together and
    redeploy:
    ```
    PLAY_PACKAGE    = "com.bemastery.app,com.lomonec.bemastery.welding"
    APPLE_BUNDLE_ID = "com.lomonec.bemastery,com.lomonec.bemastery.welding"
    APP_PROGRAMMES  = "general-english,welding"
    ```
    **Do this before the first Welding purchase**, or it is refused
    (`500 app_unmapped`) — which is the intended safe failure, not a bug. The
    migration first: the new column has to exist before a deploy writes to it.
15. `be-auth`: redirect Apple's answer per app before Sign in with Apple can be
    offered in the Welding Android build.

---

## 7. Rollback

* **The web app**: nothing to roll back. `BE_APP_TRACK` is `null` without
  `--track`, so app.lomonec.com is byte-for-byte the app it was.
* **The existing Android app**: build with `scripts/build.sh` / `release.sh`
  with no argument — the `general` flavor is `com.bemastery.app` at versionCode
  19, as before. Nothing about its identity, signing or listing changed.
* **The existing iOS app**: build with no `-xcconfig`. The project defaults are
  the existing identity.
* **The Welding apps**: they do not exist on either store until the owner
  creates them. Deleting the flavor / xcconfig removes them from the build.
* **`be-entitlements`**: the lists accept a single value, so reverting
  `PLAY_PACKAGE` / `APPLE_BUNDLE_ID` / `APP_PROGRAMMES` to one entry each puts
  every purchase back under the General English app and the service behaves
  exactly as it did before the split. Migration 0005 is additive (a nullable
  column plus a rebuilt derived cache) and needs no undo.
* **To go back to ONE SHARED subscription across both apps** (the design of the
  12 Oct morning, before the owner reversed it): set
  `APP_PROGRAMMES = "general-english,general-english"` — both store listings
  then map to the same programme, so either app's purchase grants both. No code
  change. The reverse, splitting them again, is the same one-line edit.

---

## 8. Tests

| suite | what it covers |
|---|---|
| `tests/app-split.mjs` (76) | the whole separation: the pinned programme, refused selection, the router, the cross-programme UI, onboarding, the unchanged web build, Premium/ads parity, and the BUILT bundles' content |
| `tests/app-split.mjs` § 10 (66–76) | Premium is per app on the client: each app asks about itself, the cache cannot cross apps, a purchase reply about the other app is refused |
| `backend/entitlements/test/billing.mjs` (138) | § "Two apps, separate entitlements" W1–W23: the selling app decides, the other app stays Free, the safe failure modes, pre-split rows, deletion |
| `mobile/ios/scripts/check-release.mjs --programme <id>` | the Xcode identity, entitlements, Info.plist and the bundled web app, per app |
| Gradle `verify<Variant>WebBundleProgramme` | the web bundle and the flavor agree |
