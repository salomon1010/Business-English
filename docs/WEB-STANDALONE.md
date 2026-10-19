# The two standalone web apps, and the three levels of access

Written 19 October 2026, owner's brief: *"two stand-alone web versions, basic by
default with three levels of access — 1 basic without logging in, 2 login, 3
premium; when they buy Premium from the phone it syncs with the website
version."*

## 1. What there was, and what there is now

`app.lomonec.com/bemastery/` is **one** web app carrying both programmes: it
asks a new learner which one they want and lets them switch afterwards. That
stays exactly as it is — nothing in this work changes it.

Beside it there are now **two web apps, one per programme**, pinned the same way
the two store apps are pinned:

| address | programme | store app it mirrors | linked from |
|---|---|---|---|
| `app.lomonec.com/general-english/` | General English | `com.bemastery.app` | `lomonec.com/bemastery-g/` |
| `app.lomonec.com/welding-english/` | Welding English | `com.lomonec.bemastery.welding` | `lomonec.com/bemastery-w/` |

They are published by `scripts/portal/build-site.mjs` — the same build that
publishes `/bemastery/` — so a push to `main` deploys all three. The build
asserts the opposite rules for each: `/bemastery/` must carry **no** build tag,
and each pinned root must carry one, with no staging environment and no build
flags in it.

Pinned means `be-build.js` carries `{track:"<id>"}`, which `index.html` reads as
`BE_APP_TRACK`: `areaId()` is fixed, the programme-selection screens are
refused, `go()` turns away the other programme's views, and the other
programme's **content is removed from the bundle** rather than hidden. The
evidence is `tests/app-split.mjs` (89 checks) — the same suite that covers the
store apps, because this is the same mechanism.

They are built by the same script the store bundles use, so a web app and its
store app are the same app from the same source:

```
node scripts/web/build-standalone.mjs --out <dir>              # staging
node scripts/web/build-standalone.mjs --out <dir> --production # not used yet
```

Staging is the default and production has to be asked for by name: the output of
this script is a web root, and a script like that must not default to the
public one. A staging build also carries `{env:"staging"}`, which points every
endpoint at the staging Workers (`beEnv`) and signs in to the `be-mastery-test`
Firebase project, and turns `billing_enabled` on so all three levels can be seen.

## 2. The three levels

| | who | what they get | decided by |
|---|---|---|---|
| **1 · Basic** | no account | the whole course on this device: the plan, the shadowing, the recordings, the progress calendar. No AI feedback, and nothing survives the browser clearing its data. | the client, and the Workers: **an AI route needs an account** (owner, 1 Oct 2026) — `premiumGate`'s `cap === null` branch refuses anonymous callers |
| **2 · Free account** | signed in | the same course, progress saved to the account and waiting on the phone, and AI feedback within the free daily allowance | be-entitlements answers `plan:"free"` |
| **3 · Premium** | signed in, with a paid entitlement | the larger daily allowance, 30/90-day analytics, the AI coach, personalised recommendations, no ads | be-entitlements answers `plan:"premium"` from that account's purchases |

The landing a browser visitor meets (`webGateRender`) offers one door per level:
**Create a free account**, **Sign in**, **Start without an account**. The third
one is deliberately the quietest of the three — it costs the learner their
progress if the browser is cleared — and it is remembered in
`localStorage.be_web_try`, **outside `S`**, because a cloud sync replaces `S`
wholesale and a device that has already chosen must not be asked again because
another device wrote something. Same reasoning as `RESTORE_ASK_KEY`.

The landing is **a front door, not a security boundary** (see
`docs/ACCESS-MATRIX.md` §1). A visitor who walks past it reaches exactly what an
anonymous learner in the store apps already has. Everything an account protects
is enforced by the Workers.

On a pinned build the landing describes **one** programme, because there is no
way to reach the other one from there. The combined app still shows both.

## 3. Premium bought on the phone, seen on the web

This is by construction, not by a copy: be-entitlements derives one entitlement
per **(account, programme)** from all of that account's `purchase_links`,
whatever store sold them (migration `0005_app_scope.sql`). `app_id` is the
PROGRAMME, not a store id, so *an iPhone purchase and an Android purchase in the
same app are the same app* — and so is the web app for that programme.

So: buy Premium in the General English app on Android → sign in with the same
account at `/general-english/` → `entRefresh()` asks
`GET /v1/entitlement?app=general-english` → Premium. The Welding app and
`/welding-english/` are the other pair. A purchase in one app does **not** unlock
the other; that is the owner's rule of 12 Oct 2026, and
`tests/../entitlements/test/billing.mjs` § "Two apps, separate entitlements"
holds it.

Two things had to be fixed for this to actually work:

- **`entApp()` is `BE_APP_TRACK || AREA_GEN`.** On the combined web app
  `BE_APP_TRACK` is null, so it always asks about General English — a Welding
  learner there would be told about the wrong app's plan. On a pinned build it is
  right by construction, which is one more reason these two web apps exist.
- **The owner's manual grant could only ever reach the first programme.**
  `bindLink` reads `app_id` from the link and the admin route passed none, so a
  granted tester opened the Welding app and still saw Free. The route now names
  the programme, validates it against `APP_PROGRAMMES`, and keys a non-default
  programme's grant separately so withdrawing one does not touch the other
  (`GR1`–`GR6` in the billing suite).

**Buying on the web is still not possible, by design.** A plain browser has no
store provider, so `billingWhy()` is `no_store` and the Premium sheet says
Premium can't be bought on this device and *links this app's own Play listing*.
Nothing on the web takes a payment.

## 4. The service worker, and a trap worth remembering

`sw.js` precached its shell with `cache.addAll`, which **rejects the whole batch
if a single entry 404s**. The shell list names both programmes' catalogues and
curricula, so in a pruned bundle it could never succeed: the worker never
installed, there was no offline shell at all, and the app looked perfectly fine
until the connection went. Two changes:

- `sw.js` caches **entry by entry** and skips a miss, so a shell with one hole
  still works offline. This also covers a `?v=` bump that misses a file.
- `sync-web.mjs` rewrites the shell list for a pruned bundle, so the worker only
  ever asks for files that bundle has (11 entries dropped from the General
  English bundle, 4 from the Welding one — it prints which).

## 5. Testing on staging

`staging.lomonec.com` is a cloudflared tunnel to a local server on this Mac
(LaunchAgents `com.lomonec.staging-tunnel` and `com.lomonec.staging-server`),
serving whatever `~/Developer/be-staging-site/current` points at.

```
node scripts/web/build-standalone.mjs --out ~/Developer/be-staging-site/snapshots/web-$(date +%Y%m%d-%H%M)
ln -sfn ~/Developer/be-staging-site/snapshots/web-<stamp> ~/Developer/be-staging-site/current
launchctl kickstart -k gui/$(id -u)/com.lomonec.staging-server
```

- https://staging.lomonec.com/ — a chooser
- https://staging.lomonec.com/general-english/
- https://staging.lomonec.com/welding-english/

**The server is `scripts/web/serve-staging.mjs`, not `python3 -m http.server`,
and that matters.** Cloudflare sits in front of the tunnel and caches `.js` by
default: the first build of this work was served with `max-age=14400` and the
edge then handed out that `sw.js` for hours, so a rebuilt worker never reached
the browser and kept failing to install against files the new bundle no longer
had. The Node server sends `no-store` for `sw.js`, `index.html`, `be-build.js`
and `manifest.json`; belt and braces, a staging build also registers
`sw.js?b=<stamp>`, so a new build is a new script and nothing the edge holds can
answer for it. Production keeps the plain `sw.js`.

### Seeing Premium without a store

No store purchase can be made on staging — be-entitlements-staging has no store
secrets, so the purchase routes answer 501. Use the owner's grant:

```
node scripts/staging/grant-premium.mjs <uid>                      # General English
node scripts/staging/grant-premium.mjs <uid> --app welding        # the Welding app
node scripts/staging/grant-premium.mjs <uid> --app welding --withdraw
```

The uid is the signed-in account's Firebase uid (`be-mastery-test`). The app
picks the change up on the next sign-in, or within the 12-hour display cache —
`entRefresh()` runs on every auth change.

Staging state as of 19 Oct 2026 (the staging rig is unchanged by the
production deploy): D1 migrated through `0005`, `ADMIN_TOKEN` set,
`APP_PROGRAMMES = "general-english,welding"` (it was the first programme only,
which is why the Welding app was told "unknown app → Free"), Worker version
`db037138-b907-4dc9-a9fe-761792b2ed9a`.

## 6. One host or two — the decision this work leaves open

On the phone the two apps are genuinely separate: two packages, two sandboxes,
nothing shared. On the web, **two paths on one host cannot be**, because browser
storage is per ORIGIN. Measured on staging, 19 Oct 2026:

| | result |
|---|---|
| a key written by `/general-english/` | read back by `/welding-english/` |
| `localStorage.be12_v1` (the learner's whole state) | one copy, shared |
| `be_web_try`, `be_flags`, `be_push_id` | one copy, shared |
| `S.professionalTracks.activeId` | flips to whichever app was opened last |
| `areaId()` in each app | still its OWN programme — the pin decides, not the state |
| progress, reports, vocabulary per programme | still separate (every record is `tk`-stamped) |
| the service worker | one per path, one shared `CacheStorage`, keyed by URL so no collision |
| the reminder cache `be-rem` | one copy — the last app opened owns the notification wording |

So one host gives: **one sign-in and one device profile across both apps, with
the learning itself still separated per programme.** That may well be what is
wanted on the web — a learner with one account, two programmes. It is not what
"standalone" means on a phone.

Two hosts (`general.lomonec.com` / `welding.lomonec.com`, or two paths on two
subdomains) would make them as separate as the store apps: own storage, own
service worker, own push subscription, own install. It needs DNS, the host added
to the Firebase authorised domains, and the origin added to every Worker's
`ALLOWED_ORIGINS` — four Workers, each a deploy.

**One host is what production does today** (owner, 19 Oct 2026: "deploy them").
The deciding reason is not the storage: it is that `app.lomonec.com` is already
in every Worker's `ALLOWED_ORIGINS` and in Firebase's authorised domains, so
publishing there changed **no server configuration at all**. A new origin would
need the host added to Firebase and to five Workers — including the production
AI Worker, whose origin list is in code — for a gain the learning data does not
need.

## 7. What the production deploy changed beyond the two apps

Publishing these required the website to run the same codebase the two store
apps run, which it had not. Besides the two new addresses, that brings:

- **`billing_enabled` is true on the website and `ENT_API` is set.** This is
  what level 3 *is*: without it `planOn()` is false and every learner is Free.
  Nothing can be bought on the web; what the website now does is **read** the
  plan an account already has. Production be-entitlements is deployed with all
  four secrets and both programmes configured, so a Play purchase in either app
  is verified and answers Premium here.
- `smart_coach_enabled` and `android_push_enabled` become true on the website,
  as they already are in both store apps. The production `be-coach` Worker is
  deployed.
- The website moves from `be12-v688` to `be12-v690`.
- `/bemastery/` is unchanged and stays: it is the support URL registered in both
  store listings and the `start_url` of every installed copy.

Still not done, deliberately:

- **Two hosts** (§6) — one host was chosen for the reason given there.
- **The new landing copy is English.** The 15 `i18n/*.json` files fall back to
  English for `land.levels_h`, `land.prog_h`, `land.try`, `land.basic_t`,
  `land.basic_b` and `land.free_b1` until they are cut.
- **No real purchase has ever completed on either store**, so the phone → web
  path is proved by the service's own tests and by a manual grant, not in the
  field. That remains the one thing only a licence-tester purchase can settle.

## 8. Tests

| suite | checks | what it holds |
|---|---|---|
| `tests/web-levels.mjs` | 29 | the three doors, the programme the landing names, the device marker outside `S`, `entApp()` per build, the no-store sheet linking the right listing, the combined app unchanged |
| `tests/app-split.mjs` | 89 | the pin itself, on the same bundles |
| `backend/entitlements/test/billing.mjs` | 165 | per-app entitlements, incl. `GR1`–`GR6` for the per-app grant |
| `backend/entitlements/test/run.mjs` | 61 | the service's own contract |
| `backend/entitlements/test/migration.mjs` | 13 | `0005` is backward-compatible |
