# BE Mastery — submission checklists

Two apps, four store listings' worth of work. **Nothing here has been submitted.**
Each list is ordered so that the steps only I could do are already done and the
steps only the account owner can do are marked **OWNER**.

Design and rationale: `docs/APP_SPLIT.md`. Prices in § 3 there were read back
from the live Play console, not assumed.

---

## 0 · Verified release state — Welding, 20 October 2026

Everything in this section was executed and read back. **Nothing was uploaded,
submitted, merged or deployed, and no production migration or billing flag was
touched.**

### Repository

| | |
|---|---|
| worktree | `~/Developer/be-welding-ids` (isolated; the main repo's dirty files, the other session's stash and all 9 worktrees untouched) |
| branch | `fix/welding-product-ids` |
| commits | `d1b34a4c` the product-id fix + checker · `0dcd94ec` the i18n parity fix |
| PR | [#16](https://github.com/salomon1010/Business-English/pull/16) — OPEN, MERGEABLE, **not merged** |

### Release checker

```
cd mobile/ios && node scripts/check-release.mjs --programme welding          # PASS 0 failures 0 warnings
cd mobile/ios && node scripts/check-release.mjs --programme general-english  # PASS 0 failures 0 warnings
```

Both clean. Two defects were fixed to get there, and neither check was weakened:

- **i18n parity.** `land.levels_h`, `land.prog_h`, `land.try`, `land.basic_t`,
  `land.basic_b` and `land.free_b1` went into `I18N_EN` with the web visitor
  gate and were never cut into `i18n/*.json`, so all 15 files sat at 3506 of
  3512 keys. Fixed to the convention already in those files: French translated,
  the other fourteen carry the English text. Additive; no existing translation
  touched.
- **Bundle freshness.** The checker compared a bundled `index.html` with the raw
  repo root, so it reported STALE for every *correct* Welding bundle —
  `sync-web.mjs` also swaps the `#beSplash` mark for the programme's own logo.
  The comparison now mirrors `sync-web.mjs`, and a **new positive check**
  asserts a branded bundle really carries its own mark. General English has no
  branded logo, so its comparison is byte-for-byte what it always was.

### iOS artifacts

```
cd mobile/ios && bash scripts/build.sh welding --archive    # ** ARCHIVE SUCCEEDED **
cd mobile/ios && bash scripts/export.sh welding             # distribution IPA — see the blocker below
```

| | |
|---|---|
| archive | `mobile/ios/build/welding.xcarchive` — 61 MB |
| bundle id | `com.lomonec.bemastery.welding` |
| version | **1.0.0 (3)** — app and both extensions |
| next build number | 3 is correct: App Store Connect holds builds **1 and 2**, both VALID (read-only, 20 Oct) |
| signing | `Apple Development: Salomon Nore Ngoucheme`, team 8TKAAK2MG6 |
| entitlements | Welding App Group, Sign in with Apple `[Default]`; widget: app group only; push service: neither (it only downloads images) |
| extensions | `…welding.BEPushService`, `…welding.BEWidget`, both 1.0.0 (3) |
| web bundle | `programme welding`, `be-build.js {"track":"welding"}`, Welding splash mark, **zero** General English inline `svg.bs-logo` |
| product ids | the page holds `welding_premium_monthly` / `welding_premium_annual`; the binary carries the Welding bundle-id case, so `products(for:)` selects that pair at run time |
| icon / launch | `AppIconWelding` / `LaunchScreenWelding` |

An archive from this pipeline is **development-signed by design** — the
preserved 13 Oct archive is identical in that respect, and `export.sh`
re-signs with `Apple Distribution: LOMON EC LLC` at export. A development-signed
archive is **not** distribution-ready on its own. Its embedded profile is the
**Team Provisioning Profile** (1 device, `aps-environment: development`,
`get-task-allow: true`), which is what the export replaces.

> **THE EXPORT FAILED on 20 Oct 2026 — there is no distribution IPA.** It chose
> the right identity (`Apple Distribution: LOMON EC LLC (8TKAAK2MG6)`, hash
> `6336…`) and then stopped on the first framework:
>
> ```
> error: exportArchive codesign command failed
>   …/App.app/Frameworks/GoogleMobileAds.framework: replacing existing signature
>   …/App.app/Frameworks/GoogleMobileAds.framework: errSecInternalComponent
> ** EXPORT FAILED **
> ```
>
> `errSecInternalComponent` from codesign means it could not use the private
> key. A SecurityAgent authorisation dialog was open for the whole run (the
> keychain itself was unlocked, `no-timeout`), so this is the **per-key access
> control** on the distribution key, not a locked keychain and not a
> provisioning problem. Nothing in the archive, the project or the signing
> configuration is at fault, and the archive is intact.
>
> **Fix, owner only:** open **Keychain Access → login → My Certificates →
> `Apple Distribution: LOMON EC LLC`**, expand it, double-click the **private
> key → Access Control**, and either add `/usr/bin/codesign` to the allowed
> list or choose *Allow all applications to access this item*. Then re-run
> `bash scripts/export.sh welding`. Running the export from a terminal you are
> attending and clicking **Always Allow** on the prompt does the same thing.

The 13 Oct build-1 archive lives in a different worktree
(`~/Developer/be-welding-tf/mobile/ios/build/welding.xcarchive`) and was not
touched; the two paths never collide.

### Android artifacts

```
cd mobile/android && npm ci                       # the worktree had no @capacitor/android
cd mobile/android && bash scripts/release.sh welding
```

| | |
|---|---|
| AAB | `mobile/android/android/app/build/outputs/bundle/weldingRelease/app-welding-release.aab` |
| size | 25,766,320 bytes (24.6 MB) |
| SHA-256 | `55abbeb0feebc2c3cf0a45935de9368c473bf860172cddb49aa45f61cead962e` |
| package | `com.lomonec.bemastery.welding` (read from the AAB's own manifest) |
| version | versionCode **5**, versionName 1.0.1 |
| upload key | `3D:E6:6D:FE:51:6D:73:6A:59:16:A9:6A:DF:34:3A:DC:39:C8:36:1C:B2:EF:3F:5F:46:0D:8B:A3:D1:3A:07:52`, CN=Salomon N, O=BE Mastery |
| billing | `com.android.vending.BILLING` present (merged from Billing Library 8.0.0); `BEPlayBillingPlugin.ALLOWED` = the shared Play pair, correct for both packages |
| widgets | only `BEWidgetProvider` — `BEWidgetProviderGE` and `…Pro` are absent from the artifact, not just from the overlay |
| web bundle | `programme welding`, Welding splash, no General English catalogue or logo |
| secrets | none found in the bundle |

**This AAB is a verification artifact and cannot be uploaded.** versionCode 5 is
**already live in production** on Play (1.0.1 — read-only, 20 Oct), so Play
would refuse it. The next free code is **6**, and changing it is an owner
decision; no committed version number was altered to build this.

The Welding Android app does **not** carry the defect this branch fixes: Play
ids are scoped per package, both packages sell `premium_annual` /
`premium_monthly`, and the plugin's allow-list is already right. Nothing on the
Android side needed changing.

### Store records — read-only, 20 October 2026

**App Store Connect** — app `6822527532`, `com.lomonec.bemastery.welding`:

| | |
|---|---|
| version | 1.0 — `READY_FOR_REVIEW` (prepared, **not** submitted) |
| build attached | **build 2** — the one that asked for the wrong ids |
| builds held | 1 (14 Oct) and 2 (16 Oct), both VALID, neither expired |
| subscription group | 22484497 "BE Mastery Welding Premium" |
| products | `welding_premium_annual` 6823575232 ONE_YEAR · `welding_premium_monthly` 6823574822 ONE_MONTH — both **READY_TO_SUBMIT** |
| prices | USA 19.99 (proceeds 16.99) / 2.99 (proceeds 2.54), 175 territories each |
| intro offers | 175 rows each, all FREE_TRIAL / THREE_DAYS |
| description | 3,984 chars, carries the **Terms of Use (EULA)** link, the privacy line and the renewal terms — 3.1.2 satisfied |
| privacy policy | `https://app.lomonec.com/privacy.html` |
| support / marketing | `https://www.lomonec.com/bemastery` |
| screenshots | 6 × `APP_IPHONE_67` |
| age rating | declared, nothing objectionable |
| review notes | 1,735 chars; names the embedded third-party YouTube content |
| categories | EDUCATION, BUSINESS |
| submissions | `d0a067bd` **UNRESOLVED_ISSUES** (the 3.1.2 rejection) · `421ae512` COMPLETE |

The shipped IPA's product ids and these product records agree. **A configured
subscription is not a working purchase** — see the production gate below.

**Google Play** — `com.lomonec.bemastery.welding`: production **completed, vc 5
(1.0.1)**; alpha and internal at vc 4. Both products ACTIVE with a `trial3d`
P3D free phase.

### Production billing gate — purchases are BLOCKED

Verified by reading `backend/entitlements/wrangler.toml` and the migrations:

1. `0005_app_scope.sql` is **not applied** to production D1, and the deployed
   Worker is still the **pre-split** code, which has no app dimension at all.
2. `PLAY_PACKAGE`, `APPLE_BUNDLE_ID` and `APP_PROGRAMMES` are still
   single-valued in production.

So **no Welding purchase can be verified in production today**, in either app,
however complete the store records are. The ordered rollout, the verification
after each step, and the rollback — including the one ordering that could leak
Premium across the two apps — are in
`backend/entitlements/DEPLOYMENT_PLAN_0005.md`. Nothing in it has been executed.

### Automated tests — actually run, in this worktree

| suite | result |
|---|---|
| `backend/entitlements/test/billing.mjs` | 170/170 |
| `tests/welding-premium.mjs` | 53/53 |
| `tests/ios-storekit.mjs` | 32/32 |
| `tests/ios-ads.mjs` | 96/96 |
| `tests/premium-boundary.mjs` | 53/53 |
| `tests/billing-client.mjs` | 50/50 |
| `tests/portal.mjs` | 38/38 |
| index.html JS parse | 5 scripts, 0 errors |

W1-W27 in the billing suite are the two-app contract: a purchase in one app
grants Premium in that app only, in both directions; **restore cannot cross
apps** (W24-W27); an unknown product id fails closed (W14e); an app the service
does not know answers Free for that app rather than handing over another app's
plan (W16); a pre-split row with no `app_id` still counts as the original app's
(W20). W14a-W14e add the case this branch created: the signed bundle id decides
the scope, never the client-supplied product id.

### Known limitations, verified

- **`.codex/skills/*.md` ships inside the iOS bundle** (6 files, ~20 KB, no
  secrets, already public in the repo). The skip list at
  `mobile/ios/scripts/sync-web.mjs:32` excludes `.claude`, `.agents` and
  `skills` but was never updated for `.codex`. The **Android** bundle does not
  carry it. Cosmetic; pre-existing and identical on `main`.
- **`BEAdsAllowTestUnits` is `true` on `main`**, though CLAUDE.md says it should
  be false there. Still double-locked by the Sandbox-receipt check with
  `ads_enabled:false`, so no test creative can reach a learner — but the flag
  and the documentation disagree.
- **`BEMasteryWelding.storekit` is not registered in `project.pbxproj`**, so it
  cannot yet be selected as a scheme's StoreKit configuration. It has no bearing
  on an archive.
- **No device or emulator run.** No physical iPhone is connected and this Mac
  has no Android emulator binary. Nothing below the artifact level was verified
  at run time.

---

## A · BE Mastery — General English (the existing app)

The identity, listings, users and subscriptions are unchanged. What is new is
only that its bundle now declares its programme.

### Google Play — `com.bemastery.app`

| | step | state |
|---|---|---|
| 1 | AAB built and signed | **done** — `app-general-release.aab`, versionCode 19, 1.2.0, upload key SHA-256 `3D:E6:6D…` |
| 2 | bundle carries the General English web app only | **done** — `be-build.js {"track":"general-english"}`, 400 captions, no Welding catalogue |
| 3 | subscriptions already live | **done** — `premium_monthly` $2.99 P1M, `premium_annual` $19.99 P1Y, `trial3d` on both |
| 4 | listing, data safety, content rating, privacy policy | already published |
| 5 | **upload to a test track and promote** | **OWNER** |

#### What Play actually has today — verified, and it changes the risk

Read from the Play Developer API on 12 Oct 2026 (read-only; the edit used to
read it was deleted):

```
production   completed   versionCodes ["8"]    "8 (1.0.1)"
internal     completed   versionCodes ["17"]   "1.2.0 (17) staging — purchase test"
beta         draft       (none)
bundles uploaded: 5, 8, 13, 14, 15, 16, 17
```

**versionCode 8 is the Trusted Web Activity**, the thin wrapper that loads
app.lomonec.com. The native Capacitor shell has never been released to
production: 12–17 were staging internal tests, and **18 and 19 have never been
uploaded at all**.

So uploading `app-general-release.aab` (vc 19) is not "shipping the split". It
is the **first production release of the native shell** — Play Billing, the
native plugins, notifications, widgets, the bundled web app instead of the live
website — on top of the split. That is a much larger change than this task's
scope, it is the owner's release decision, and it should go to internal testing
first rather than straight to production.

A smaller alternative exists if the owner wants the split without the shell
change: the TWA loads the website, so the General English app needs no upload
at all once the web code is on `main` — only the Welding app is genuinely new.
That is a product decision, not a technical one.

> versionCode 19 is free (uploaded codes are 5, 8, 13–17). If Play ever reports
> it as taken, raise it in `build.gradle` under
> `productFlavors { general { … } }` — not in `defaultConfig`, which no longer
> carries one.

### App Store — `com.lomonec.bemastery`

| | step | state |
|---|---|---|
| 1 | archive built | **done** — `build/general-english.xcarchive` |
| 2 | exported as a Distribution-signed IPA | **done** — `build/export-general/App.ipa`, `Apple Distribution: LOMON EC LLC (8TKAAK2MG6)`, `aps-environment = production`, Store profile, 1.1.0 (2). Re-verified 12 Oct from the IPA itself: all three bundles carry `Authority=Apple Distribution: LOMON EC LLC (8TKAAK2MG6)`, Xcode-managed `iOS Team Store Provisioning Profile` profiles expiring 2027-09-29, and `get-task-allow = false` |
| 3 | extensions signed with matching ids | **done** — `…BEPushService`, `…BEWidget` |
| 4 | release checks | **done** — `check-release.mjs` PASS, 0 failures |
| 5 | **raise the build number** before a second upload | **OWNER** — `scripts/bump-build.mjs`; App Store Connect refuses a reused `CFBundleVersion` |
| 6 | **upload** (`xcrun altool`/Transporter or Xcode Organizer) | **OWNER** — needs an App Store Connect API key or an Apple ID session; neither is on this machine |
| 7 | **submit for review** | **OWNER** |

#### The profile generated on 12 Oct — verified, and not needed

`~/Downloads/BE_Mastery_App_Store_2026.mobileprovision`, inspected on 12 Oct:

| field | value |
|---|---|
| name | BE Mastery App Store 2026 |
| App ID | `8TKAAK2MG6.com.lomonec.bemastery` (exact, not a wildcard) |
| team | LOMON EC LLC · 8TKAAK2MG6 |
| type | App Store — `get-task-allow = false`, `beta-reports-active = true` |
| created / expires | 12 Oct 2026 → **28 Sep 2027** |
| Xcode-managed | no (hand-made) |
| certificate | one, SHA-1 `6336E8FF…ED46` — byte-identical to the keychain's `Apple Distribution: LOMON EC LLC (8TKAAK2MG6)` |
| entitlements | `aps-environment = production`, App Group `group.com.lomonec.bemastery`, Sign in with Apple, team id, keychain access groups |

Its entitlements are an exact superset of what the shipped app actually seals
(the app does not request `keychain-access-groups`), so it is a correct profile.
**It is still not needed**, for two reasons: the app already signs through
automatic signing with an equivalent Xcode-managed Store profile, and this
profile covers only the app — not `…BEWidget` or `…BEPushService`, which an
App Store archive must also sign. Adopting it would mean manual signing and two
more profiles for no gain.

What it does prove is useful: the App ID `com.lomonec.bemastery` has App Groups,
Push Notifications and Sign in with Apple enabled in the portal, and the
Distribution certificate is current. Keep the file — if the cached managed
profiles are ever lost and Xcode still has no account, it becomes the fallback,
and belongs in `~/Library/Developer/Xcode/UserData/Provisioning Profiles/`.

---

### Owner's decision, 12 Oct 2026: General English stays a TWA for this release

No Capacitor migration, no new AAB for `com.bemastery.app`. Nothing in this
repository forces one, so scope was not expanded. **But the consequence has to
be said out loud**, because it is not what §2 of the earlier brief assumed:

The TWA (`twa-manifest.json`: packageId `com.bemastery.app`, host
`app.lomonec.com`, startUrl `/`) loads the LIVE WEBSITE. The website is the
**unsplit** app — verified on 12 Oct 2026: `app.lomonec.com/bemastery/` serves
be12-v686, which carries no `BE_APP_TRACK` pin, no `be-build.js`, and reaches
the Welding programme in the ordinary way.

So for this release:

| | what the learner gets |
|---|---|
| **BE Mastery** (TWA, Play, unchanged) | the full app — **both** programmes, the Programme page, the switch |
| **BE Mastery Welding** (new, Capacitor) | Welding only, enforced four ways |

That is a coherent release — the existing app is untouched, and Welding gets a
focused standalone — but the General English app is **not** General-English-only,
and Welding content is reachable in both. Two consequences worth deciding before
submission:

1. **Premium is asymmetric.** A purchase in the TWA files under
   `general-english`, which unlocks the Welding features *inside the TWA*. The
   standalone Welding app asks for its own purchase. A learner who uses both
   could reasonably feel charged twice for the same programme.
2. **The listings should not claim otherwise.** The existing listing must keep
   describing both programmes.

**If you want the TWA to be General-English-only, there is a one-line web
change — no new AAB.** `isPlayApp()` already identifies the TWA (by
`document.referrer` = `android-app://com.bemastery.app`), so `BE_APP_TRACK`
could default to `general-english` there. The cost is real and is why it was not
done unasked: every existing Android learner who uses Welding inside that app
would lose it until they install the Welding app. That is a product call, not a
technical one.

## B · BE Mastery — Welding English (new)

### Google Play — `com.lomonec.bemastery.welding`

| | step | state |
|---|---|---|
| 1 | AAB built and signed | **done** — `app-welding-release.aab`, versionCode 1, 1.0.0, same upload key |
| 2 | bundle carries the Welding app only | **done** — `be-build.js {"track":"welding"}`, 554 captions, no General English catalogue, scenes or role-play photos |
| 3 | launcher icon + 512 listing icon | **done** — redrawn from the owner's logo of 13 Oct 2026 (`branding/welding/logo-master.png`): `src/welding/res/mipmap-*`, the flavour's own `drawable*/splash.png` launch screen, and `playstore/welding/play-icon-512.png`. Regenerate with `scripts/branding/make-welding-icons.py`, check with `verify-welding-icons.py`. **The AAB in row 1 predates this and would have to be rebuilt to carry it** |
| 4 | listing title, short and full description | **done** — `playstore/welding/listing-*.txt` (18 / 76 / 3 725 characters, all within limits) |
| 5 | **create the app** in Play Console with this exact package | **OWNER** — the Publisher API has no create-app call (probed: `404 Package not found`). The package is fixed at the first upload and can never be changed |

> **Package confirmed by the owner, 12 Oct 2026:** `com.lomonec.bemastery.welding`.
> An earlier brief said `com.bemastery.welding`; that string appears nowhere in
> the repository and was not used. The chosen id is identical to the iOS bundle
> id, so the Welding app has one identifier on both stores.
| 6 | **create the two subscriptions** | **OWNER** — `premium_monthly` base plan `monthly` P1M US$2.99 grace P3D; `premium_annual` base plan `annual` P1Y US$19.99 grace P14D; a `trial3d` offer (one P3D free phase) on each; the same 174 regions and `WITHDRAWAL_RIGHT_SERVICE` |
| 7 | screenshots | **done** — six 1080×2400 shots of the Welding app in `playstore/welding/phone/` (road map, practice tools, workshop, workplace lines, progress, phrase bank). `scripts/store-art/shoot.js` gained a `PROGRAMME=welding` mode that pins the app under the camera to the Welding build |
| 7b | tablet screenshots + 1024×500 feature graphic | **done** — six 1440×2560 tablet shots in `playstore/welding/tablet/`, and `playstore/welding/feature-graphic.png` generated by the new `scripts/store-art/feature-graphic.mjs` from the app's own mark, palette and photography. **No artwork is outstanding** |
| 8 | **data safety, content rating, target audience, privacy policy URL, account-deletion URL** | **OWNER** — the SAME answers as the existing app: the two release APKs declare an identical permission set (verified), the only difference being the per-package `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` that Gradle derives from the applicationId |
| 9 | **grant the existing service account access** to the new app | **OWNER** — if Play does not inherit it |
| 10 | **upload to internal testing** | **OWNER** |

### App Store — `com.lomonec.bemastery.welding`

| | step | state |
|---|---|---|
| 1 | build identity in place | **done** — `ios/App/Welding.xcconfig`; a Release build for the Simulator produces `com.lomonec.bemastery.welding` / `BE Welding` / `group.com.lomonec.bemastery.welding` with both extensions correctly prefixed |
| 2 | release checks | **done** — `check-release.mjs --programme welding` PASS, 0 failures, 0 warnings |
| 3 | archive + Distribution IPA | **done** (13 Oct 2026) — `welding.xcarchive` and a Distribution-signed IPA exist; verified `Apple Distribution: LOMON EC LLC (8TKAAK2MG6)`, `application-identifier 8TKAAK2MG6.com.lomonec.bemastery.welding`, `aps-environment production`, `group.com.lomonec.bemastery.welding`, `get-task-allow false`, both extensions, embedded bundle "programme welding" |
| 3b | app icon + launch screen | **done** (13 Oct 2026, later) — `AppIconWelding` and `LaunchScreenWelding`, selected by `BE_APPICON_NAME` / `BE_LAUNCH_STORYBOARD` in `Welding.xcconfig`; a Release build was checked to carry `CFBundleIconName = AppIconWelding` and `UILaunchStoryboardName = LaunchScreenWelding`. **The IPA in row 3 was archived BEFORE this and carries the old icon — re-archive before uploading** |

#### Why this could not be done on 12 Oct — SUPERSEDED 13 Oct 2026

> **A1–A4 ARE COMPLETE. Do not work through them again** — see the note at the
> head of A1–A4. The three conditions below were true on 12 Oct and are no
> longer: the identifiers are registered, App Store profiles are ACTIVE, and
> the API issuer id is present in the local tooling (`asc-tools/asc.mjs`),
> which is how the read-only queries in this document's verification notes were
> made. Kept only as the record of why the work moved to the portal that day.

Checked on 12 Oct 2026, now historical:

* `AuthKey_A88M365B2K.p8` is on the Mac and `mobile/ios/appstore/SUBSCRIPTIONS.md`
  records it as an App Store Connect API key with the App Manager role.
* **The issuer ID is nowhere on the machine** — not in the environment, the shell
  profiles, `~/.config/be-mastery`, `~/.appstoreconnect`, any fastlane config, or
  the repository. It cannot be derived from the key; it is an account-level UUID
  shown only in App Store Connect.
* **Xcode has no Apple account signed in** (`DVTDeveloperAccountManagerAppleIDLists`
  → `IDE.Identifiers.Prod` is empty), so `xcodebuild -allowProvisioningUpdates`
  cannot register anything either.

So no already-authorized local tool can register these identifiers. The owner
does it in the portal, or supplies the issuer ID (from App Store Connect →
Users and Access → Integrations → App Store Connect API) so the API can.

#### A1–A4 · Apple Developer portal — **ALREADY DONE, do not repeat**

> **COMPLETE — verified read-only against the App Store Connect API by two
> independent sessions, 13 October 2026.** All three identifiers are
> registered:
>
> | identifier | registered | Store profile |
> |---|---|---|
> | `com.lomonec.bemastery.welding` | yes | ACTIVE, expires 2027-09-29 |
> | `com.lomonec.bemastery.welding.BEWidget` | yes | ACTIVE, expires 2027-09-29 |
> | `com.lomonec.bemastery.welding.BEPushService` | yes | ACTIVE, expires 2027-09-29 |
>
> **Three** Welding Store profiles, not four — an earlier version of this note
> said four, having miscounted General English's own profile, which expires on
> the same date.
>
> **Do not go looking for those three in the portal: they are not listed
> there.** They are Xcode-managed ("iOS Team Store Provisioning Profile: …"),
> minted by `-allowProvisioningUpdates` during the archive on this Mac. They
> are real records — the API returns them under each bundle id — but the
> account-wide profiles listing shows only one profile for the whole team,
> "BE Mastery App Store 2026" (expires 2027-09-28), which is the General
> English one. On a different Mac, Xcode would mint its own from the same
> registered identifiers.
>
> **The evidence that the capabilities are right is the signed binary, not a
> capability list.** The Distribution-signed Welding IPA carries
> `aps-environment = production`, `group.com.lomonec.bemastery.welding` and
> `com.apple.developer.applesignin` as entitlements, and Apple does not issue a
> profile for entitlements the identifier is not enabled for. A capability
> listing read from the API is poor evidence here, because `IN_APP_PURCHASE`
> comes back on every identifier on the account, extensions included — it is on
> by default and means nothing in particular.
>
> **The remaining Apple work is A5–A8 only.**

Kept for the record. Sign in at <https://developer.apple.com/account> as
**LOMON EC LLC (8TKAAK2MG6)**, then **Certificates, Identifiers & Profiles →
Identifiers**.

**A1 · the app's own identifier**

1. **+** → **App IDs** → **Continue** → type **App** → **Continue**.
2. Description: `BE Mastery Welding`. Bundle ID: **Explicit** →
   `com.lomonec.bemastery.welding`.
3. Under **Capabilities**, tick exactly these three — no others:
   * **App Groups**
   * **Push Notifications**
   * **Sign in with Apple** (leave it as the primary app, do not group it)
4. **Continue → Register**.

**A2 · the widget extension's identifier**

1. **+** → **App IDs** → **App** → **Continue**.
2. Description: `BE Mastery Welding Widget`. Bundle ID: **Explicit** →
   `com.lomonec.bemastery.welding.BEWidget`.
3. Capabilities: **App Groups** only.
4. **Continue → Register**.

**A3 · the notification-service extension's identifier**

1. **+** → **App IDs** → **App** → **Continue**.
2. Description: `BE Mastery Welding Push Service`. Bundle ID: **Explicit** →
   `com.lomonec.bemastery.welding.BEPushService`.
3. Capabilities: **none**. (It has no entitlements file; adding any would be a
   capability the app does not use.)
4. **Continue → Register**.

> **Observed 13 October 2026 — a drift from step 3, recorded so nobody
> "corrects" it.** The registered `…welding.BEPushService` identifier reports
> four capabilities, including **Push Notifications** and **Sign in with
> Apple**, which step 3 does not ask for. Xcode enabled them while provisioning
> during the archive.
>
> **Nothing is granted by them, and they must be left alone.** The extension
> ships no entitlements file, so it claims none of them at signing time. And
> **revoking a capability can invalidate a provisioning profile Apple has
> already issued** — the three Welding Store profiles are live and were used to
> sign the verified IPA, so "tidying" this to match step 3 risks breaking a
> working signing setup in order to fix nothing.
>
> This is observed state, not a finding: a capability listing is weak evidence
> in both directions, because `IN_APP_PURCHASE` comes back on every identifier
> on the account by default. Step 3 above is left exactly as written — it is
> still the right instruction for registering the identifier from scratch.

**A4 · the App Group**

1. **Identifiers** → the type dropdown (top right, reads "App IDs") →
   **App Groups** → **+**.
2. Description: `BE Mastery Welding`. Identifier:
   `group.com.lomonec.bemastery.welding`. **Continue → Register**.
3. Go back to **Identifiers → App IDs →** `com.lomonec.bemastery.welding` →
   **App Groups → Configure** → tick `group.com.lomonec.bemastery.welding` →
   **Continue → Save**.
4. Repeat 3 for `com.lomonec.bemastery.welding.BEWidget`. **Both** must be in
   the group or the widget cannot read the app's snapshot.

> Why each one: the capability list is taken from the app's actual entitlement
> files, not guessed. `App/App.entitlements` asks for `aps-environment`,
> `com.apple.developer.applesignin` and `com.apple.security.application-groups`;
> `BEWidgetExtension.entitlements` asks for the App Group alone; the push
> service has no entitlements file at all.

**A4b · download three App Store provisioning profiles.** This step was
missing from an earlier version of this checklist, which said automatic signing
would create them. **It will not, on this Mac.** Automatic signing asks Apple
for a profile, and Xcode has no Apple account signed in
(`DVTDeveloperAccountManagerAppleIDLists` → `IDE.Identifiers.Prod` is empty), so
it cannot ask. General English signs today only because three Xcode-managed
App Store profiles are already cached on disk from 5–6 Oct; there is no cached
profile for any Welding identifier, and none can be minted here.

So in **Profiles → +** → **App Store Connect** → **App Store**, create and
download one profile for each identifier from A1–A3, with the
**Apple Distribution: LOMON EC LLC (8TKAAK2MG6)** certificate selected:

| identifier | suggested profile name |
|---|---|
| `com.lomonec.bemastery.welding` | BE Welding App Store 2026 |
| `com.lomonec.bemastery.welding.BEWidget` | BE Welding Widget App Store 2026 |
| `com.lomonec.bemastery.welding.BEPushService` | BE Welding Push App Store 2026 |

All three are needed: an App Store archive signs the app *and* every embedded
extension, and a profile covers exactly one App ID. Leave the `.mobileprovision`
files in `~/Downloads` — the one generated for the existing app on 12 Oct landed
there as `BE_Mastery_App_Store_2026.mobileprovision`, and that is where I will
look for these.

**The alternative, which replaces A4b entirely:** sign in to Xcode once
(**Xcode → Settings → Accounts → +**, Apple ID, LOMON EC LLC). Automatic signing
then mints all three itself, and this checklist's original claim becomes true.
One sign-in is less work than three downloads, and it also removes the latent
risk that clearing the profile cache breaks the General English build.

**Then tell me, and I will:** switch the Welding build to manual signing — three
lines in `ios/App/Welding.xcconfig`, which is already the only file that carries
the Welding identity, so General English keeps its working automatic signing
untouched — archive the Welding app, export a Distribution-signed IPA, and
verify its bundle id, version, display name, embedded profile, entitlements,
extension ids and bundled curriculum: the same checks the General English IPA
passed. If you sign in to Xcode instead, no file changes at all.

#### A5–A8 · App Store Connect (can be done in parallel)

**A5 · the app record.** <https://appstoreconnect.apple.com> → **Apps → +
→ New App**: iOS, name `BE Mastery Welding`, primary language English (U.S.),
Bundle ID `com.lomonec.bemastery.welding` (it appears once A1 is done), SKU
e.g. `bemastery-welding`, Full access.

**A6 · its own subscription group.** → the new app → **Monetization →
Subscriptions → Create**. A subscription group belongs to one app, so this
cannot be shared with the existing app — which is the point of the split.
Reference name: `BE Mastery Welding Premium`.

**A7 · the two products — DONE, with DIFFERENT ids from the other app.**
Verified read-only against App Store Connect on 20 Oct 2026: group **22484497**
"BE Mastery Welding Premium", both products **READY_TO_SUBMIT**, 175 territory
prices and 175 FREE_TRIAL / THREE_DAYS introductory offers each.

| product id | ASC id | reference name | duration | USA price | level | state |
|---|---|---|---|---|---|---|
| `welding_premium_annual` | 6823575232 | Welding Premium annual | 1 year | **US$19.99** (proceeds 16.99) | 1 | READY_TO_SUBMIT |
| `welding_premium_monthly` | 6823574822 | Welding Premium monthly | 1 month | **US$2.99** (proceeds 2.54) | 1 | READY_TO_SUBMIT |

Both at level 1 — the two plans give the same features. The prices match the
other app's exactly; only the identifiers differ.

> **THE IDS COULD NOT BE REUSED — this is now settled (20 Oct 2026).** The
> paragraph that stood here warned that reuse was unverified and said to pick
> distinct ids if App Store Connect refused. It did refuse: the Welding app
> record could not take `premium_annual` / `premium_monthly`, which the General
> English app already holds. So the Welding app carries `welding_premium_*`.
>
> **Google Play is unaffected.** A Play product id is scoped to its package, so
> **both** packages sell `premium_annual` / `premium_monthly` — verified ACTIVE
> on both, with a `trial3d` P3D free phase on each (read-only Play Developer
> API, 20 Oct 2026). `BILLING_PRODUCTS` in `index.html` is that Play list and
> did not move.
>
> **Four places carry the Apple ids, not two** — the old note undercounted:
> `APPLE_BILLING_PRODUCTS` in `index.html` (new, chosen by `window.BE_APP_TRACK`),
> `BEStoreKitPlugin.products(for:)` (keyed on the bundle id), `PRODUCTS` in
> `backend/entitlements/src/entitlement-core.js`, and
> `mobile/ios/ios/App/App/BEMasteryWelding.storekit` (Xcode's local store).
> The app a purchase belongs to is still derived from the store identity Apple
> or Google signed, never from the product id — `billing.js` resolves it with
> `programmeOfStoreId(env, tx.bundleId)`, and `test/billing.mjs` W14a-W14e prove
> neither app's ids can unlock the other and that an unknown id fails closed.
>
> **Why it mattered.** Asking StoreKit for an id the app record does not hold
> returns an EMPTY product list, not an error. Welding 1.0.0 (2) therefore
> shipped a paywall with no plans on it and could not be bought. Nothing logged.

**A8 · the trial.** On each product → **Introductory Offers → +** → Free trial,
**3 days**, new subscribers, all territories. Apple allows one introductory
offer per group per Apple ID, so the learner gets it once whichever plan they
pick — the same as the existing app.

## C · Backend, before the first Welding purchase

| | step | state |
|---|---|---|
| 1 | per-app entitlement code | **done** — migration 0005, `app_id` on every link, `?app=` on the view, the client asks about itself |
| 2 | **apply migration 0005** to the production D1 | **OWNER** — `npx wrangler d1 migrations apply be-entitlements --remote`. Before the deploy: the column has to exist before anything writes it |
| 3 | **set the three aligned lists and redeploy** | **OWNER** — `PLAY_PACKAGE`, `APPLE_BUNDLE_ID`, `APP_PROGRAMMES` (see `docs/APP_SPLIT.md` § 6 step 14) |

> **The release order is safe in both directions** (since 12 Oct 2026). If the
> Welding app reaches a store before this Worker is updated, it reports Free
> rather than inheriting the General English plan — `entViewIsOurs()` refuses a
> view that does not name this app, and an older service names none. Before that
> fix, shipping the app first would have made every General English subscriber
> Premium in the Welding app. Checks 77–81 in `tests/app-split.mjs`.
| 4 | **second Firebase Android app** for the Welding package | **OWNER** — without its `google-services.json` the Welding Android build has no notifications; no Worker change needed, an FCM token identifies the app by itself |
| 5 | **second Firebase iOS app + per-row APNs topic** | **OWNER** — `be-push` sends one hard-coded `apns-topic`, so Welding iOS notifications need a Worker change first |
| 6 | **AdMob app + units per listing** | **OWNER** — the Welding build ships Google's sample ids and `BEAdsPlugin` refuses to start the SDK on the sample app id in a non-test build, so this cannot quietly become production |
| 7 | **`be-auth` per-app Apple redirect** | **OWNER** — until then Sign in with Apple is not offered in the Welding Android build (Google and e-mail are) |

---

## D · What must be true before either app is submitted

- `ads_enabled` is `false`, so neither app shows an ad. Submitting with ads off
  is the current intent; the Data Safety and App Privacy answers must match
  whatever is actually switched on at submission time.
- The two apps' subscriptions are **independent**. A learner who wants Premium
  in both pays twice. The store listings and the in-app Premium copy must not
  imply otherwise.
- Nothing in this repository uploads or submits anything. There is no CI step,
  no script, and no stored credential that could.
