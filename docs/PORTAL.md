# LOMON EC portal at app.lomonec.com/ and BE Mastery at /bemastery/

Status: **LIVE since 10 Oct 2026 (~16:07 UTC), owner-approved.** PR #9 (merge
`a2b257bf`) put be12-v685 on `main`. Pages source switched to GitHub Actions
(`build_type: workflow`, custom domain and HTTPS kept), repository variable
`PORTAL_PAGES=on`, first workflow run `38066218055` built and deployed. Verified
live: portal at `/`, app at `/bemastery/` (v685), root `/sw.js` = the retiring
worker, legal pages / `yt-embed.html` / `.well-known` / IndexNow key / og.png at
the root, forwarding stubs, smoke 33/33 at `/bemastery/`, and the forwarder for
the Play app (`?wid=`), an installed app, a returning learner and a `#view` link.
**From now on every push to `main` publishes through the workflow; read the live
version from `/bemastery/sw.js` (the root `sw.js` no longer carries it).**

## 1. Decisions (owner, 10 Oct 2026)

| Question | Decision |
|---|---|
| Visitor rule | **Plain web browser only.** A new visitor at `/bemastery/` signs up or signs in before learning. The iOS app, the Play app (TWA), an installed home-screen app and every existing anonymous learner keep today's experience. |
| Hosting | **A Pages build step** (GitHub Actions). No DNS change, no new host, nothing in the repository moves. |
| Staging | **Local preview only** for this phase. staging.lomonec.com was not restaged. |

Royal Touch is not part of this work and is not listed on the portal.

## 2. Layout of the built site

`node scripts/portal/build-site.mjs [outDir]` (default `_site`, git-ignored):

| Address | What it is | Why |
|---|---|---|
| `/` | `portal/index.html` | The LOMON EC app portal: one card per live app (today BE Mastery only). |
| `/bemastery/` | The web app: the same file list the store bundles copy (`mobile/ios/scripts/sync-web.mjs`) | The app is path-agnostic: every asset, fetch, the manifest (`start_url`/`scope` `./`), the service worker and its notification links are relative. |
| `/sw.js` | `portal/root-sw.js` | Retires the old root service worker (§5). |
| `/privacy.html`, `/delete-account.html` | Real copies | These URLs are registered in App Store Connect and Play Console. |
| `/yt-embed.html` | Real copy | The shipped iOS app frames `https://app.lomonec.com/yt-embed.html` (YouTube relay). |
| `/og.png`, `/logo.svg` | Real copies | Shared links in the wild; the two legal pages use the logo. |
| `/.well-known/`, `/CNAME`, IndexNow key, `/.nojekyll` | Copied | Origin-level files: Digital Asset Links for the TWA must stay at the root. |
| `/<page>.html`, `/manual/<page>.html` | Forwarding stubs | GitHub Pages has no server redirects. Each stub is `noindex`, has a canonical to the new address, and forwards with the query and hash kept. |
| `/404.html` | `portal/404.html` | Points to `/bemastery/` and `/`. |
| `/robots.txt`, `/sitemap.xml` | Regenerated | The new addresses. |

Side effect worth knowing: today the Pages site publishes the **whole
repository** (`backend/`, `docs/`, `marketing/`, tests…). The built site
publishes only the app's runtime files and the portal.

## 3. Legacy URL compatibility

The portal's head script forwards to `/bemastery/` + the original query and
hash when the root is opened as the app:

- the Play app (TWA) — its start URL is `/`; the referrer is `android-app://…`
  and every launch carries `?wid=`;
- an installed home-screen app (`display-mode: standalone`);
- a notification, widget or flags link (`?wid=`, `?widget=`, `?nudge=`, `?flags=`,
  or a `#view` hash);
- a learner whose progress is already on this origin (`localStorage.be12_v1`
  holds a profile) — a bookmark of the old root.

`?portal=1` always shows the portal. The destination path is a constant, so no
query or hash can send anyone off the site (tested: `?next=https://evil…`,
`#//evil…`). No API, Worker, OAuth or callback address is involved: every Worker
lives on its own host, Firebase's auth helper is on `auth.lomonec.com`, and the
origin (`https://app.lomonec.com`) does not change, so the Workers' Origin
allow-lists, Firebase's authorised domains and localStorage / IndexedDB data all
carry over untouched.

`APP_URL` (share links, the password-reset return URL) follows the page: on
`app.lomonec.com/bemastery/` it is that address; everywhere else (the root
today, the store apps, staging) it is the root as before.

## 4. Switching production (done 10 Oct 2026 — kept as the record and for a re-run)

1. Merge `staging` to `main` through the usual PR (the workflow is dormant:
   a push skips it unless `PORTAL_PAGES` is `on`).
2. Settings → Pages → Source → **GitHub Actions**
   (`gh api -X PUT repos/salomon1010/Business-English/pages -f build_type=workflow`).
3. Settings → Secrets and variables → Actions → Variables → `PORTAL_PAGES` = `on`,
   then run the workflow once (Actions → "Pages (portal + /bemastery/)" → Run).
4. Check: `/` is the portal, `/bemastery/` the app, `/privacy.html`,
   `/delete-account.html`, `/yt-embed.html` and `/.well-known/assetlinks.json`
   answer 200; `BASE=https://app.lomonec.com/bemastery npm test` (smoke).
5. **Done in be12-v686 (PR #10, 10 Oct 2026):** `web_visitor_gate_enabled: true` in
   `FLAGS_DEFAULT` and `FLAGS_STAGING`. Verified live: a new plain-browser visitor sees the landing;
   the Play app (forwarded with `?wid=`, and the portal now marks a forwarded Play tab in
   `sessionStorage.be_twa`), an installed app and an existing learner go straight into the app.
   Local/LAN test hosts never show it without an explicit `be_flags` entry (`webGateFlag`); the
   smoke suite opts out explicitly so it keeps testing the app behind it.

**Rollback:** Settings → Pages → Source → "Deploy from a branch" → `main` / root.
The previous site returns as it was; learners' data is untouched (same origin).

**Later, not required for the switch:** at the next Android build, point
`twa-manifest.json` `startUrl` to `/bemastery/` and `webManifestUrl` to
`/bemastery/manifest.json` (the forwarder covers the old start URL until then);
update the Play/App Store listing's marketing URL if it names the root;
`site/bemastery/` (lomonec.com) links can move to `/bemastery/` — they work
through the forwarder meanwhile.

## 5. Service workers and push — the one real migration risk

- BE Mastery's worker moves from `/sw.js` (scope `/`) to `/bemastery/sw.js`
  (scope `/bemastery/`). Its activate step already removes every old
  `be12-vNN` cache on the origin and keeps `be-rem` / `be-captions`.
- `/sw.js` becomes a worker that installs, unregisters itself and leaves. It has
  no fetch handler and deletes no cache.
- **Web-push subscriptions belong to a registration.** A browser or Play-app
  learner's reminder subscription is on the old root registration. When the
  learner next opens the app at `/bemastery/`, `pushSync()` subscribes on the new
  registration with the same per-device push id, and be-push replaces the
  endpoint. A learner who does **not** open the app after the switch stops
  getting the web reminder once their browser runs its next update check of
  `/sw.js` (at most about a day). iOS app reminders (APNs) are not affected.
  If that gap is not acceptable, keep the old `sw.js` at the root for a few
  weeks instead of the retiring one (one line in the build script) — the
  trade-off is that its offline fallback then serves the portal.

## 6. Adding an app

Give the app its own path (`/<app>/`), its own account and plans unless a
shared service has clear ownership. Add one card to `portal/index.html`, a line
to the build script if its files live in this repository (or a separate Pages
artefact/route if not), and a row to the access matrix. Do not list an app
before its address answers.

## 7. Tests

`cd tests && node portal.mjs` (33 checks) builds the site into a temporary
folder, serves it and checks the portal, the forwarder and its open-redirect
guard, the legacy addresses, every app-shell file under `/bemastery/`, both
service workers, and the visitor landing on every platform rule.
