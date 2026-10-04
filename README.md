# BE Mastery — Business English Mastery

An offline-first web app that turns 25 focused minutes a day into confident,
professional spoken English: a 12-week programme, shadowing with real video,
speaking feedback, a phrase bank, Executive Polish and a progress calendar.
Two programmes share one engine — **General English** and **Welding
(Professional English)**.

| | |
|---|---|
| Live app | https://app.lomonec.com (GitHub Pages, branch `main`) |
| Android | Google Play `com.bemastery.app` — a Trusted Web Activity that loads the live site |
| iOS | App Store shell in `mobile/ios/` (Capacitor + SwiftUI), bundle `com.lomonec.bemastery` |
| Owner | Lomonec LLC — never a personal name in anything public |
| Support | contact@lomonec.com |

This file is the front door for a developer. **CLAUDE.md** is the long
engineering memory (architecture, every system, every rule learned the hard
way); read its first two sections before you change anything, and search it
whenever a name in the code is unfamiliar.

## Your first hour

```bash
git clone git@github.com:salomon1010/Business-English.git
cd Business-English
git checkout staging                 # all work happens here; main is production

# 1. Run the web app — there is no build step
python3 -m http.server 8000           # then open http://localhost:8000

# 2. Run the browser test suite (real headless Chromium)
cd tests && npm install && npx playwright install chromium-headless-shell
npm test                              # the default chain, ~40 suites
PORT=8903 node ios-ads.mjs            # one suite, on a port nobody else holds

# 3. Open the iOS shell (a Mac with Xcode 26+)
cd ../mobile/ios && npm install && npm run sync && npx cap open ios
```

Then open `index.html` with `docs/architecture/CODE_MAP.md` beside it: the
map is a generated table of contents for that one file.

## Repository map

The web app is **one HTML file plus data**. Everything else in the repository
serves it: the backend Workers it calls, the store shells that wrap it, the
tests that drive it, the documents that explain it.

| Path | What it is |
|---|---|
| `index.html` | **The whole app** — HTML, CSS and JavaScript in one file (~35 k lines). No framework, no bundler. See the code map. |
| `sw.js` | Service worker. Network-first with cache fallback. `const CACHE = "be12-vNN"` **must be bumped on every deploy**, together with `APP_VERSION` in index.html. |
| `*.js` (18 files at the root) | **Engines**: pure logic loaded by `<script src>` before the main script, each defining one or two globals. `curriculum-provider`, `professional-tracks`, `competency-engine`, `learning-coach`, `nudge-engine`, `professional-simulation-engine`, `conversation-orchestrator`, `shadow-sync`, `shadow-scenes`, `adaptive-learning-engine`, `career-center`, `professional-skills-passport`, `jurisdictions`, `professional-standards`, `trades`, `answer-evaluator`, `mission-engine`, `shadow-lines`. Each file opens with a header that says what it owns. |
| `tracks/<id>/*.json` | The curriculum packs (weeks, phrases, vocabulary, practice, progress, foundations, missions) for `general` and `welding`. |
| `i18n/<code>.json` | 15 language files. `I18N_EN` inside index.html is the English master; every file carries exactly its keys. |
| `captions/`, `catalogue/`, `scenes/` | Shadow Studio content: per-video caption JSON, the two video catalogues, the animated scenes. |
| `manual/<code>.html` | The in-app help centre, one page per language. |
| `flyer.html`, `privacy.html`, `delete-account.html`, `yt-embed.html` | The public landing / About page, the privacy policy, the account-deletion page, the YouTube relay the iOS shell frames. |
| `manifest.json`, `robots.txt`, `sitemap.xml`, `CNAME`, `og.png`, `icon-*.png`, `logo.svg`, `*.jpg` | PWA manifest, search and social metadata, the brand assets the pages reference by URL. |
| `backend/` | Five Cloudflare Workers: `polish-worker.js` (be-polish — the only place the OpenAI key lives), `events/` (analytics), `push/` (reminders and nudges), `partner/` (Practice Partner, D1 + R2), `entitlements/` (Premium, D1). Start with `backend/README.md`. |
| `services/` | `assessor/` and its UI — the answer-assessment service and its build scripts. |
| `mobile/ios/` | The App Store shell. `mobile/ios/README.md` has the source layout, the build steps and the test bundles. |
| `playstore/` | Google Play listing text, store art and the Bubblewrap `twa-manifest.json`. |
| `tests/` | ~100 Playwright and Node suites. `npm test` runs the default chain; `package.json` lists the rest. |
| `scripts/` | Content and release tooling: catalogue builders, caption fetcher, scene builder, store-art shooter, `code-map.mjs`. |
| `docs/` | Product and design specification (`docs/README.md` is its index), release records (`docs/release/`), architecture notes and the generated **`docs/architecture/CODE_MAP.md`**. |
| `marketing/` | Product specs for Practice Partner and Shadow Studio V2, partnership material. |
| `CLAUDE.md` | The engineering guide and memory. Long on purpose. |
| `TESTING.md` | The manual pre-release checklist. |

## How the app works, in ten lines

1. **One file, plain scripts, globals.** No modules, no build. The engines are
   loaded first, then the main script; functions are called by name from
   inline handlers, so a name is an interface.
2. **State** is one object `S` in `localStorage`, saved by `save()`, merged
   with Firestore when the learner is signed in.
3. **Routing**: `go(view)` shows `#v-<view>` and calls `r<View>()` to draw it.
   The current view survives a relaunch via the hash and `sessionStorage`.
4. **Text** goes through `t(key)`; English lives in `I18N_EN`, translations in
   `i18n/*.json`. New English copy means 15 JSON files to update.
5. **Areas**: General English and Welding share code but **never share
   evidence**. Per-area data goes through `aMap()` / `aList()` and the
   `area*()` helpers, never through the legacy top-level fields.
6. **Feature flags**: `flag(name)` with `FLAGS_DEFAULT`; `?flags=a,b` on the
   URL overrides for a device. `isGeneralEnglish()` is the one gate for
   General-English-only features.
7. **AI** is never called from the page with a key. `POLISH_API` points at
   be-polish, which holds the key and enforces plan and rate limits.
8. **Premium** is decided by the server (`hasEntitlement(cap)`), not on sale
   yet; every learner has every feature until the owner switches it on.
9. **Analytics** are anonymous counts through `track(name, props)` to be-events,
   which drops any event or property not on its allow-list.
10. **Deploy** = push to `main`. GitHub Pages serves it; the service worker's
    cache name is what makes installed phones pick it up.

## Branches and releases

- `staging` is the working branch and the release candidate. Commit here.
- `main` is production: a push auto-deploys to app.lomonec.com. Only the
  owner merges `staging` into `main`.
- A web release bumps **two** strings together: `be12-vNN` in `sw.js` and
  `APP_VERSION` in index.html. The full procedure is in `CONTRIBUTING.md` and
  in CLAUDE.md → "Deploy workflow".
- Store shells only need a new upload when native code changes. Web changes
  reach Android through the live site; iOS ships the bundle it was built with.

## Where to read next

| You want to… | Read |
|---|---|
| Find where something is in index.html | `docs/architecture/CODE_MAP.md` (regenerate with `node scripts/code-map.mjs`) |
| Change a feature safely | The matching bullet in CLAUDE.md → "Key systems" |
| Touch the backend | `backend/README.md`, then the Worker's own README |
| Work on the iPhone app | `mobile/ios/README.md` |
| Understand the product and design rules | `docs/README.md` (the specification index) |
| Ship | `CONTRIBUTING.md` |
