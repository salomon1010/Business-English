# Contributing to BE Mastery

How work gets into this repository without breaking the phones that already
have it installed. Short on purpose; the reasoning behind each rule is in
`CLAUDE.md`.

## 1. Branch

- Work on **`staging`**. It is the release candidate; `main` is production and
  auto-deploys to app.lomonec.com when pushed. Only the owner merges to `main`.
- For a large change, branch from `staging` (`feature/<name>`) and merge back
  into `staging` when it is verified.
- Commit messages: a short imperative subject, then a body that says **what
  changed and why**, and what was verified. End with the co-author line used in
  this repository (see CLAUDE.md → "Deploy workflow").

## 2. Before you commit

Run what applies, from the repository root:

```bash
# index.html still parses (every inline <script>)
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const re=/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g;let n=0,bad=0,m;while((m=re.exec(h))){n++;try{new Function(m[1])}catch(e){bad++;console.log(e.message)}}console.log("scripts:",n,"errors:",bad)'

# any i18n file you touched is valid JSON
python3 -c "import json;json.load(open('i18n/fr.json'))"

# the browser suites (first time: npm install && npx playwright install chromium-headless-shell)
cd tests && npm test

# the code map, if you added a section, a view or a script tag
node scripts/code-map.mjs
```

Suites start their own local server on a fixed port. If another checkout is
serving on it you get `… is not defined` failures that are not yours — run with
`PORT=<free port> node <suite>.mjs`.

## 3. Conventions inside `index.html`

- **Sections start with a banner comment** — `/* ===== NAME ===== */` for a
  section, `/* ----- name ----- */` for a sub-section. `scripts/code-map.mjs`
  reads them, so a new area of code gets a banner.
- **Function prefixes name the system**: `r<View>` renders a view; `ex*`
  Executive Polish; `sh*` / `sv*` Shadow Studio (classic / V2); `pp*` Practice
  Partner; `mv*` missions; `rm*` road map; `fnd*` Foundations; `ent*` / `prem*`
  entitlements and Premium; `voc*` vocabulary; `rec*` the recorder; `nudge*`
  nudges. Known wart: `fb*` is both speaking **feedback** (`fbAssess`,
  `fbShowResults`) and **Firebase** (`fbMerge`, `fbEmailAuth`) — read the body.
- **Text**: never a literal string in the UI. Add the key to `I18N_EN`, then to
  all 15 `i18n/*.json` files (machine translation is acceptable for narrative
  copy; mark it for native review).
- **Icons**: `ic("name")` from the `ICON` table. No emoji in UI strings — the
  sweep converts them, but do not rely on it.
- **Per-area data**: anything a learner produces is stamped with the area and
  read through `areaId()`, `aMap()`, `aList()` and the `area*()` helpers. The
  Progress page reports on the open area only. Never read `S.trouble`,
  `S.weekly`, `S.monthly`, `S.phMaster` directly.
- **A new view** = a `<div id="v-name">` in the body, an `rName()` renderer,
  an entry in the render map inside `go()`, and the view name in the valid list.
- **A new engine file** = a header comment that says what it owns, a
  `<script src="file.js?v=1">` tag in the head, the same path in `sw.js`
  `SHELL`, and a test under `tests/`.
- **A new analytics event** = the Worker's allow-list first (`backend/events/`),
  then `track()` in the page. The Worker drops unknown names silently.

## 4. Things that bite

- `sw.js` `CACHE` and `APP_VERSION` move together on every deploy. Forget one
  and installed phones keep the old app.
- Changing an English string does not change its 15 translations.
- A `?v=` cache-buster on an engine file must be bumped when the file changes,
  in both index.html and `sw.js`.
- Premium and AI limits are enforced in the Workers. A client-side `if
  (premium)` is a display choice, never a gate.
- Welding is never gated: Premium is sold on General English only.
- `be-rem` and `be-captions` caches are deliberately kept out of the service
  worker's cleanup sweep. Do not "tidy" that filter.
- Public-facing text credits **Lomonec LLC**, never a person.

## 5. Shipping a web release (owner, or with the owner's go-ahead)

1. Section 2 checks pass. `cd tests && npm test` is green.
2. Bump `const CACHE = "be12-vNN"` in `sw.js` **and** `APP_VERSION` in
   index.html to the next number.
3. Commit on `staging`, push. When the owner merges to `main`, GitHub Pages
   deploys within a few minutes.
4. Prove the live site: `cd tests && BASE=https://app.lomonec.com npm test`.
5. Installed apps pick the change up on next launch; iOS Safari and some PWAs
   need a full close and reopen.

## 6. Shipping the iOS shell

See `mobile/ios/README.md`. In short: `npm run sync`, open the Xcode project,
`Product → Test` (both test bundles are in the App scheme), bump the build with
`scripts/bump-build.mjs`, archive, upload. Nothing signing-related is ever
committed.
