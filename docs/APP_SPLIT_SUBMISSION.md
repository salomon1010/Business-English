# BE Mastery — submission checklists

Two apps, four store listings' worth of work. **Nothing here has been submitted.**
Each list is ordered so that the steps only I could do are already done and the
steps only the account owner can do are marked **OWNER**.

Design and rationale: `docs/APP_SPLIT.md`. Prices in § 3 there were read back
from the live Play console, not assumed.

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
| 3 | launcher icon + 512 listing icon | **done** — `src/welding/res/mipmap-*`, `playstore/welding/play-icon-512.png` |
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

**A7 · the two products**, matching the existing app exactly (figures verified
against both consoles — `docs/APP_SPLIT.md` § 3, and
`mobile/ios/appstore/SUBSCRIPTIONS.md` for the Apple side):

| product id | reference name | duration | price | level |
|---|---|---|---|---|
| `premium_annual` | Premium annual | 1 year | **US$19.99** | 1 |
| `premium_monthly` | Premium monthly | 1 month | **US$2.99** | 1 |

Both at level 1 — the two plans give the same features.

> **REUSING THE IDS IS UNVERIFIED — try it and report what App Store Connect
> says.** An earlier version of this section asserted that "App Store product
> ids are scoped to the app" as settled fact. It is not. Apple's help
> documentation says an id cannot be reused *within* an app and that in-app
> purchases are not shareable between apps, but it does not state the
> account-level rule; developer reports describe the error "The Product ID you
> entered is already being used by another subscription" for an id used only in
> a *different* app on the same account. It could not be tested from here,
> because the test needs the Welding app record to exist first (A5).
>
> Product ids cannot be renamed or reused once created, so this is the one step
> to do deliberately. If App Store Connect refuses `premium_annual` /
> `premium_monthly`, **do not force it** — pick distinct ids (for example
> `welding_premium_annual` / `welding_premium_monthly`), tell the engineers, and
> they change two lists: `PRODUCTS` in
> `backend/entitlements/src/entitlement-core.js` and `BILLING_PRODUCTS` in
> `index.html`. Nothing else moves, because the app a purchase belongs to is
> derived from the store identity Apple signed, never from the product id.

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
