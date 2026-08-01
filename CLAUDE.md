# BE Mastery — project guide for Claude

**Business English Mastery** — an offline-first PWA that turns 25 focused minutes a
day into confident, professional spoken English (12-week plan, shadowing,
pronunciation feedback, phrase bank, Executive Polish, progress calendar).

- **Hosting:** GitHub Pages (`salomon1010/Business-English`, branch `main`) →
  custom domain **app.lomonec.com**. Wrapped as an Android **TWA** for Google Play.
- **Owner / credit:** always **Lomonec LLC** — never the user's personal name in
  any public-facing content.

## Architecture — it's basically one file
- **`index.html`** — the *entire* app (HTML + CSS in `<style>` + all JS inline). No
  build step, no framework, no bundler. Everything lives here.
- **`sw.js`** — service worker, network-first. `const CACHE = "be12-vNN"`. **Bump
  this integer on every deploy** or clients keep the old cache.
- **`flyer.html`** — self-contained marketing / **About** page, loaded in an iframe
  from Profile → About (`openAbout()` passes `?lang=&theme=&v=`). Has its *own*
  data-driven i18n dictionary `FL = {en:{…}, es:{…}, …}` + `EXTRA` (do not confuse
  with the app's i18n). Theme-aware via `data-theme`; `<base target="_top">` so its
  links break out of the iframe.
- **`manual/<code>.html`** — in-app Help-centre content (English + 14 langs),
  fetched by `rManual()`.
- **`i18n/<code>.json`** — 15 language override files (flat `{key: "translated"}`).
- **`backend/polish-worker.js`** + `backend/README.md` — Cloudflare Worker that
  holds the OpenAI key for **Executive Polish** (`POLISH_API` const in index.html).

## Deploy workflow — READ THIS
- **Local-first by default: do NOT `git push` until the user explicitly says
  "deploy".** They test on their own machine first (`python3 -m http.server 8000`).
  Local commits are fine; pushing to `origin/main` is what auto-deploys.
- **To deploy** (only on the user's go-ahead):
  1. JS-parse check (see below) + validate any changed `i18n/*.json`.
  2. Bump `sw.js` `be12-vNN` → next number.
  3. `git add`, commit (co-author line below), `git push origin main`.
  4. Poll live until it flips, in a **background** Bash job (GitHub Pages usually
     30–60s, occasionally 10 min): loop `curl -s "https://app.lomonec.com/sw.js?x=$RANDOM"`
     and grep for the new `be12-vNN`. A stuck build is nudged with an empty commit.
- End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

### Validate before committing
```
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;let n=0,bad=0,m;while((m=re.exec(h))){n++;try{new Function(m[1])}catch(e){bad++;console.log(e.message)}}console.log("scripts:",n,"errors:",bad)'
```
For flyer use `/<script>([\s\S]*?)<\/script>/g`. For JSON: `python3 -c "import json;json.load(open('i18n/fr.json'))"`.

## Key systems
- **i18n:** `t(key, vars)` → `DICT[key] ?? I18N_EN[key] ?? key`, then `{{var}}`
  substitution. `I18N_EN = {…}` in index.html is the English master (source of every
  key). `setLang(code)` loads `i18n/<code>.json` into `DICT`. RTL for `ar`, `ur`.
  When you change an English narrative string, the 15 JSON files still hold the
  *old* translation — update them too (they don't auto-follow).
- **Icons:** `const ICON = { name: '<path …>' }` (24×24, `stroke=currentColor`).
  `ic(name)` wraps in `<svg>`. `tIc(key, iconName)` prepends a `.btn-ic` icon and
  **strips the leading emoji** from the label. `hIcon` for headings. Emoji in
  strings are auto-swapped to line-icons via `EMOJI_ICON` + `manIconize`/
  `manIconizeInline` sweeps. Prefer clean line-icons over emoji/text glyphs.
- **Router:** `go(v, a1, a2)`; views are `#v-<name>` divs; render map in the base
  `go`. Current page persists in `location.hash` **and** `sessionStorage["be_view"]`
  (so an installed-PWA relaunch to `start_url:"./"`, which drops the hash, restores
  the page). Valid views incl. home/journey/phrases/shadow/review/profile/data/
  session/manual (roleplay/pron exist but are hidden from nav).
- **State:** single `S` object in `localStorage`; `save()` persists (+ Firebase push
  if signed in). Activity for streak/calendar: `S.dates` (YYYY-MM-DD), `S.dayLog`
  (per-day count), `S.fbHist` (timestamped feedback). `markPracticed()` lights up a
  day — called by every practice action.
- **Speech:** browser-only — `SR` (SpeechRecognition, US-English), `fbSay()` (TTS).
  No per-word timing available (be honest about this limitation).
- **Theme:** `data-theme` = "light"/"dark" on `<html>`, stored in
  `localStorage["be_theme"]`; `applyTheme()` / `toggleTheme()`.

## Writing / voice
- Default: **British English**, concrete, short sentences, no hype. Never invent
  stats/quotes; flag uncertainty.
- **Exception — the "dream" narrative voice:** feature descriptions, onboarding,
  empty states, feedback verdicts and marketing use an aspirational,
  transformation-focused voice (Sinek "why" / MLK "I have a dream" — vivid, concrete
  future scenes in second person: "…until the version of you who hesitates begins to
  disappear"). Keep functional labels/buttons/errors plain and clear.
- **Translations** of that emotional copy are best-effort machine transcreation and
  **should be reviewed by a native speaker** before heavy promotion (esp. bn, ur,
  hi, ja, ko, ar).

## Secrets & gotchas
- **OpenAI key** lives *only* in the Cloudflare Worker (Executive Polish). Never in
  the repo, never sent to the model in the browser. Firebase `apiKey` in index.html
  is public by design (fine).
- **GitHub sync** (repo + PAT backup) is a maker-only tool, hidden behind a dev
  toggle: tap **"Program start date"** in Profile → Settings 5× to reveal/hide.
- After deploy, an installed PWA / iOS Safari may keep the old cache — tell the user
  to fully close & reopen the app (the flyer has a `?v=` cache-bust for the About
  page specifically).
- Playwright MCP is used for visual checks (serve locally first); the browser can
  get "in use" locked between sessions — fall back to Node/structural checks.

## Current status
- **Live version:** service worker was at **`be12-v78`** at last deploy. Always
  check `sw.js` for the current number before bumping.
- **Staged locally, not yet pushed:** the Phrases "Mark mastered" button
  (trophy icon → turns **green** when mastered, `.ph-mastered` class; the old "✓"
  was stripped from `ph.mastered_btn` in all 15 langs), and this `CLAUDE.md`.

## What's been built (feature history)
UI / design
- App-wide **emoji → line-icon** conversion (`ICON`/`ic`/`tIc`/`EMOJI_ICON`/
  `manIconize`); ongoing "clean minimal icon buttons" pass (Shadow clip toolbar:
  ⬇ Start / ⬇ End / doc Transcript / red-bin Clear; Shadow player transport:
  skip-to-start / rewind / play-pause-that-swaps / forward / repeat loop; Phrases
  trophy button).
- **Light/dark theme** (`data-theme`, `toggleTheme`) with a header sun/moon toggle.
- **Profile tab** holding the avatar/stats + a **Progress Calendar** + menu rows
  (Settings → `data` view, Help → `manual`, About → `openAbout()`).
- All stat-card grids **centre-aligned** (`.stats-center`).

Features
- **Executive Polish** (Phrases tab): say it casually → **two** boardroom-ready
  rewrites via AI. Powered by the **Cloudflare Worker** (`POLISH_API`, holds the
  OpenAI key) so users need only internet, no key; offline/no-URL falls back to a
  local rule-based clean-up. User-controlled **dictation mic** (tap start / tap
  stop, whole paragraphs), resizable textarea, **Clear** button. Shows two versions
  at a time with "Polish again" for more (extra results queued to save cost; the
  avoid-list sent to the API is capped at 6).
- **Shadowing Studio**: pick/paste a YouTube clip → a **focused full-screen
  workspace** (`.sh-work`, opened by `shLoad`→`shOpenWork`, closed by
  `shCloseWork`) with player, clip marking, transcript, record, waveform, posture
  coach, word-by-word speaking feedback; picker keeps saved clips / trouble words /
  vocab. Per-word "You" playback estimates position (browser gives no word timing).
- **Progress Calendar** (Profile): weekly goal tracker (x/6), month heat-map with
  tap-for-detail, **year contribution graph**, streak / best-streak / consistency %
  stats, insight line. Driven by `S.dates` + `S.dayLog`.
- **Words due**: `vocState`/`VOC_INTERVALS` spaced repetition drives a Practice nav
  badge (`navBadgeCount`) and a green **"N words are ready to review"** card at the
  top of the Home dashboard (`.home-due`, hidden at zero).
- **Daily session**: 25-min timer, recorder + example/transcript + notes + self-
  score + mark-complete; the **25-minute template checklist was moved to the
  bottom** so practice comes first.
- **AI Conversation practice** and **Pronunciation practice** exist in code but are
  **hidden from the UI** and listed under Premium "coming soon" (browser-only tech
  wasn't good enough yet). Don't re-expose without the user asking.

Narrative / i18n
- The **transformation "dream" voice** was applied across onboarding, home, journey,
  session, phrases/shadow/executive-polish, feedback verdicts, empty states,
  completion toasts, and the flyer — then **translated into all 15 languages**
  (plus help-centre + profile-menu keys that had been falling back to English).
- **Flyer / About page** rebuilt: benefit-led, theme-adaptive **SVG logo** (tile
  follows theme), phone + feature screenshots, "Why professionals love this",
  theme toggle + close ✕, `?v=` cache-bust, localised.

Fixes / infra
- **Refresh no longer drops to Home**: SW no longer auto-reloads in the first 5s of
  boot, and the current view is restored from `sessionStorage` when the hash is
  dropped (installed-PWA `start_url`).
- Support email is **contact@lomonec.com**.
- Screenshots regenerated with a neutral "Alex" profile, cache-busted `?v=`.
- 15 `i18n/*.json` files exist (es fr pt it de ru ar ur hi bn id vi zh ja ko).

## Not yet built / open threads
- **Firebase cloud sign-in**: **DONE and verified live 2026-08-01** — email/password
  sign-in, Firestore sync and merge (`fbEmailAuth`, `fbMerge`, `fbPush`), console
  setup complete, `app.lomonec.com` authorised, rules published. Confirmed working
  on a real Android device against the live app. **Google sign-in is
  deliberately hidden** — `signInWithRedirect` cannot complete while the app is on
  `app.lomonec.com` and the auth handler is on `be-mastery.firebaseapp.com`
  (partitioned third-party storage). `fbGoogle()` stays for when hosting can serve
  `/__/auth/`. Syncs progress JSON, **not audio recordings**.
- **Daily reminder is BUILT** (`remSchedule`/`remFire`/`remToggle`, Settings →
  reminder toggle + time, `rem.*` keys, plus Google-Calendar/.ics export). It is a
  `setTimeout` while the app is open + a launch nudge + `Notification` when
  permitted — there is **no push server**, so it cannot fire with the app closed.
  That's the remaining gap if reminders ever need to be reliable.
- **Google Play**: app is in review/internal testing (`com.bemastery.app`,
  org account "Lomonec"); assetlinks + Console rollout pending.
- **Monetisation** direction discussed: freemium subscription (Play Billing needs a
  backend + budget cap) and B2B licensing; nothing built yet.
- Native-speaker **review of the emotional translations** still recommended.
