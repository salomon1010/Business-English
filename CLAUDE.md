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
- **`tracks/<id>/foundations.json`** — Stage 0 of each track (welding and general):
  15 days × 3 A1–A2 sentences plus the 3-sentence placement check. Every line
  carries a gloss per language code (`fr es pt … ko`); questions the learner
  *hears* carry `q<code>`. Loaded by `curriculum-provider.js` as an **optional**
  section (`OPTIONAL=["foundations"]`) — a missing file is `null`, not an error.
- **`backend/polish-worker.js`** + `backend/README.md` — Cloudflare Worker that
  holds the OpenAI key for **Executive Polish** (`POLISH_API` const in index.html).

## Deploy workflow — READ THIS
- **Deploy after every change (owner's standing instruction, 14 Sep 2026:
  "always deploy").** Verify locally first (`python3 -m http.server 8000` and
  the browser checks below), then commit, bump the cache and push — pushing to
  `origin/main` is what auto-deploys. Do not leave verified work unpushed.
- **To deploy** (only on the user's go-ahead):
  1. JS-parse check (see below) + validate any changed `i18n/*.json`.
  1b. **Smoke suite:** `cd tests && npm test` (real headless Chromium; starts its
     own local server). 20 checks: onboarding → one welcome card, every bottom-bar
     tab reaches its page, no invisible overlay, road map < 300 ms, Home cards,
     the notices, reminder copy, speech chunking, no JS errors. After the push,
     `BASE=https://app.lomonec.com npm test` proves the live site. First time:
     `cd tests && npm install && npx playwright install chromium-headless-shell`.
  2. Bump `sw.js` `be12-vNN` → next number.
  3. `git add`, commit (co-author line below), `git push origin main`.
  4. Poll live until it flips, in a **background** Bash job (GitHub Pages usually
     30–60s, occasionally 10 min): loop `curl -s "https://app.lomonec.com/sw.js?x=$RANDOM"`
     and grep for the new `be12-vNN`. A stuck build is nudged with an empty commit.
- End commit messages with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

### Validate before committing
```
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const re=/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g;let n=0,bad=0,m;while((m=re.exec(h))){n++;try{new Function(m[1])}catch(e){bad++;console.log(e.message)}}console.log("scripts:",n,"errors:",bad)'
```
The `ld+json` exclusion matters: the head carries a JSON-LD block that is data,
not JS, and `new Function` chokes on it. Check it separately with
`JSON.parse`. For flyer use `/<script>([\s\S]*?)<\/script>/g`. For JSON:
`python3 -c "import json;json.load(open('i18n/fr.json'))"`.

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
- **Areas (welding vs general English) — READ BEFORE TOUCHING PROGRESS.** The two
  programmes share one engine but must never share evidence: the Progress/Review
  page reports on the OPEN area only. `areaId()` is the area (`S.professionalTracks
  .activeId`); records are stamped `tk` **when written** (`fbHist`, `convos`,
  `simulations.attempts`) and read back through `areaFbHist()` / `areaConvos()` /
  `areaAttempts()`. Per-area maps: `troubleA` / `weeklyA` / `monthlyA` / `dayLogA`,
  reached via `troubleMap()` / `weeklyStore()` / `monthlyStore()` / `areaDayLog()` —
  **never touch `S.trouble` / `S.weekly` / `S.monthly` directly again**, they are
  pre-split legacy. Vocabulary tags a LIST (`v.tk=["welding",…]`) because a word can
  belong to both: use `areaVocab()` / `vocHas()` / `vocPut()` / `vocDrop()`, not
  `S.vocab[w]=…`. `AnswerEvaluator.portfolio(s, area)` and `readiness(s, sims, area)`
  take the area as an optional 2nd/3rd argument; omitting it counts everything.
  `areaSplit()` is the one-time migration — it stamps legacy records with whatever
  area was open at the time (nothing can know better) and is additive, so it is safe
  after a cloud merge. Also per-area, via `aMap(f)` / `aList(f)`: `phMaster`,
  `phExample`, `gram` (maps) and `clips`, `quizHist` (lists) — use those, never
  `S.phMaster` etc. **`days` / `steps` / `scores` and session `notes` are already
  correct without any of this**, because `dayKey()` prefixes the track id (same
  trick as `recCtx()` for recordings) — do NOT re-home them. `streak()`,
  `bestStreak()`, `calActiveSet()` / `calLog()` and everything the Progress
  Calendar draws report the OPEN area; `S.dates` / `S.dayLog` survive as the
  account-wide log that the cloud merge and the backup prompt reason about, and
  no screen reads them directly. `aCountAll(field)` is the account-wide count for
  those account-level questions. `CompetencyEngine.totals/score` and
  `AdaptiveLearningEngine.logs/heatmap/weekly` were already track-filtered; the
  fixed leaks were `score(…,"consistency")`, `retention()`, `pronunciation()` and
  `LearningCoach` grammar runs.
  **Deliberately shared and NOT split** — changing these is a regression: App
  Setup and every setting under it (reminder, theme, language, voice, account /
  sign-in, data, GitHub sync), Help & guide / manual, About, the profile identity
  (name, role, goal, avatar), and share / invite / rate.
  UI: `areaScopeHTML()` is the review's banner, `areaNoteHTML()` the compact
  Profile caption; both switch via `areaSwitch(id, view)` and land on the same
  page in the other area.
- **Foundations (Stage 0) — READ BEFORE TOUCHING HOME, SIMULATION OR ROLEPLAY.**
  Built 2026-09-13 after the first francophone learners said the app opened above
  their level. State is per area in `S.fnd[areaId()]` = `{placed:
  null|"foundations"|"full", day, done:{d1:true, d1r:{0:true,…}}, finished}`.
  `fndNeedsPlacement()` → the 3-sentence check (`fndOpenCheck`) auto-opens once
  per session from Home; all-yes sets `placed:"full"` **and** `finished:true`
  (passing IS finishing). `fndGated()` = placed in Foundations and not finished;
  `rSimulation` and `rRoleplay` render `fndGateHTML` instead of themselves while
  it is true — the check button on that gate is the escape hatch that stops the
  gate ever trapping a misplaced B1 learner. Home leads with `fndHomeCardHTML()`
  on both tracks. The day view is `rFoundations` (`go("foundations", day)`);
  `fndRecord` reuses `phRecInto` with its 5th `onBlob` argument and grades via
  `fbAssess` — the **recording** finishes an item, the **score** is feedback
  (offline-first). The gloss shown is the app language when the pack has it,
  else French (`gl` in `rFoundations`); `fndFill(txt, lang)` fills `{trade}` in
  English and `{tradeL}` from `FND_TRADE[lang]`. Recordings use `recCtx("fnd<day>-<i>")`
  so they are track-scoped like everything else. No `track()` events — the
  Worker allow-list has none for it, and a silently-dropped call is a lie.
- **Road map (the "Road map" tab — formerly "Weeks" — both areas).** `rmSteps()` builds the board from the
  same data as the week cards — `trackWeeks` / `weekDone` / `currentPos` /
  `fndState` / `reviewCheckpoints` — so it cannot disagree with them; `rmHTML()`
  renders the header, `rmMount(el)` → `rmDraw(road)` draws the board: an SVG
  serpentine road (vertical tangents at each pin, crossings between rows) with
  HTML labels beside the pins, phase "road signs" on the crossing that enters a
  phase, chevrons on the other crossings, and the lit stretch drawn by
  stroke-dasharray up to the beacon. It redraws on width change (ResizeObserver). States are
  `done` / `now` (exactly one beacon) / `next` (exactly one, the first grey step
  after the beacon) / `locked`. Welding inherits the general `[4,8,12]`
  checkpoints through the curriculum merge (an empty array inherits), and the
  week view already shows `rMonthly` there, so the map shows them too — do not
  "fix" that in the map alone. The daily reminder reuses it: `rmNotifBody()` is
  the text and `rmNotifImage()` draws a 1024×512 strip on a canvas that
  `remCacheText()` parks in the `be-rem` cache as `./__reminder_map__.png`;
  sw.js serves that path from the cache and passes it as the notification
  `image` (Android shows it when expanded; desktop mostly ignores `image`).
  Two more ways in: the header map button (`rmOpen()`, a full-screen sheet
  over any page) and the **progress strip** `rmCelebrate()` — a floating card
  shown only after `toggleDay` marks a session or a Foundations day finishes,
  waits for `#coachSummary` / dialogs to close, auto-dismisses in 7 s. There
  is deliberately NO permanent floating button (it would cover the action
  buttons and break the one-accent-per-screen rule).
- **Feature flags + the General-English-only boundary (feature/practice-partner,
  NOT on main yet).** `FLAGS_DEFAULT` + `flag(name)`; `localStorage.be_flags`
  (JSON) overrides for local/test/internal preview. Production defaults are OFF
  for `practice_partner_enabled / _matching_enabled / _voice_enabled /
  _notifications_enabled`, `shadow_studio_v2_enabled`, `shadow_apply_phrase_enabled`;
  ON for `practice_partner_ai_fallback_enabled`, `shadow_word_timing_enabled`.
  `isGeneralEnglish()` (`areaId()===AREA_GEN`, `"general-english"`) is the one
  check every GE-only feature makes — Welding gets exactly the app it has today.
- **Practice Partner (feature/practice-partner, NOT on main yet; General English
  only).** Try-before-connect: consent (18+) → goals/mode/availability → **Match
  me** (≤3 candidate cards, plain reasons, opaque `offer` ids, no scores/uids) or
  **Practise now** → a 4-round alternating voice session on the curriculum task →
  each decides alone (`continue` / `rematch`) → mutual → regular connection, or a
  14-day cooldown. AI coach fallback and the post-session tip are always tagged AI.
  Fourth Worker `backend/partner/` (`be-partner`, D1 + R2 + cron; migrations 0001
  + 0002 + 0003; `PARTNER_ENABLED="0"` in prod = 503; `MATCH_WEIGHTS`, `IP_PER_MIN`,
  `DEV_AUTH` dev-only; `TRACKS` refuses any other track with 403) — Firestore
  untouched. Client: `PARTNER_API`, `ppAvailable()` (API && flag && GE), `ppApi()`,
  `rPartner`, `ppMatch/ppNow/ppInvite/ppNext/ppDecide`, `ppPrompt(pair)` (round
  prompts, Apply-It phrase override), `ppHomeCardHTML()`, `ppUnread()`,
  `ppNotify()` (dedup by turn id + 60 s), i18n `pp.*`. Tests:
  `backend/partner/test/run.mjs` (106), `tests/partner.mjs` (122, browser
  contexts incl. a Welding learner, fake mic). **Owner rules, 2026-09-19 — do
  not reintroduce:** no compatibility gate (`candidates()` offers anyone in
  line; band/goals only rank; a cooldown or ended connection sorts last but
  never hides — Block hides; `presence.waiting` === `waiting.available`, one
  filter; the AI coach card is absent while anyone is in line); live is for whoever you
  practise with (`POST /live` → open pair first, a trial with a stranger
  included; candidate cards carry **Practise live** = `/invite {live:true}`,
  migration 0007 `pairs.live_wanted`, the guest's accept opens the room for
  the host; More options in any session has Practise live); presence strip
  `ppPresenceHTML()` (+ Home card counts) + floating `#ppFab` on every non-partner page (steps above the pill, gone only in a live room / under a call banner; needs only the server's `consented`); red hang-up button `ppLiveHangup` in the call card; `ppLiveOn()` follows `/me.liveEnabled` (server `LIVE_ENABLED`), not the per-device flag; `go()` uses replaceState (no hashchange) so it calls `ppCallSync/ppPillSync/ppLiveDotSync/ppFabSync` itself; the live
  beacon (`#ppLiveDot`, pill/call/presence dots) reuses the road map's
  `rmRing`/`rmSpin`, not a box-shadow throb; the partner-left dialog is
  Close / Find another partner and either clears the partner from the screen
  at once (`dismissedClosed`); the Practice-tab card has **How it works**
  (`ppHowSheet`). Dev-only `POST /__uncap {uid}` resets one learner's daily
  caps for the long browser run. **Account deletion:** `DELETE /me` (above the
  kill switch) erases the learner's partner data; `fbDeleteAccount` calls
  `ppEraseMe()` first (flag-independent, 404 = nothing held) — Apple 5.1.1(v)
  / Play account-deletion. Release audit: `docs/release/FINAL_RELEASE_AUDIT.md`
  (2026-09-19): code READY FOR MERGE; Android TWA must move to target API 36
  before the next Play upload; no iOS project. Docs: `marketing/product/practice-partner/`
  (PRODUCT_SPEC, ARCHITECTURE, DATA_MODEL, SAFETY, TEST_PLAN incl. the manual
  real-device checklist, RELEASE_PLAN incl. rollback, PILOT — staging from
  the branch, the owner's step list, what to watch, rollback timings —
  DEVICE_CHECKLIST (63 rows × iPhone / Android, none run), SHADOW_STUDIO_V2).
  `wrangler.toml` has `[env.staging]` (own Worker/D1/R2, no DEV_AUTH) for that.
  Staging also needs `https://staging.lomonec.com` in the Polish Worker's
  hard-coded `ALLOWED_ORIGINS` (a production redeploy — owner decision, not done).
  `privacy.html` 8b says 18+. Nothing deployed, no production flag on.
- **Practice Partner Levels 2–3 (same branch).** Level 2 = the **AI coach
  session** (`ppAiStart`, `S.pp.ai`, one open at a time, pending-turn
  idempotency; replies via the Polish `chat` route, spoken with the natural
  voice; always AI-tagged; human thread untouched). Level 3 = **live practice**:
  WebRTC audio between two *connected* partners, signalling relayed by the
  Worker (`/live*`, `live_sessions` + `live_signals`, migration 0004, server
  state machine, `LIVE_ENABLED` var "0" in prod; TURN optional via
  `TURN_KEY_ID`/`TURN_KEY_TOKEN` secrets, STUN-only otherwise); client
  `ppLive*`, flag `practice_partner_live_enabled` (off). Nothing recorded in
  live. AI sessions are opened through `POST /ai/session` (12/day per learner,
  idempotent). Partner management: **Leave today's practice** (session only,
  `/pairs/:id/leave`) ≠ **Find someone else** (rematch + cooldown) ≠ **End
  partnership** (`/connection/end {cid}`, connection `ended`, not a block) ≠
  Block ≠ Report; the connection card has a Partner options sheet
  (`ppConnMenu`). `tools.sim` on the Practice tab now carries the same name
  as the Life Simulations card (`home.rp_title`) — same `roleplay` page, one
  name. `be-events` has `[env.staging]` (`be-events-staging`, own
  dataset, `EXTRA_ORIGINS`); phones use `localStorage.be_events_api`. Tests:
  Worker 80, e2e 78 (two contexts connect over real WebRTC).
- **Shadow Studio V2 (same branch, General English only, `shadow_studio_v2_enabled`).**
  `shadow-sync.js` (pure engine: `normalizeCaptions` / `normalizeText` / `locate` /
  `neighbour`; levels word → sentence → text → none, honestly labelled) + panel
  `#shV2` in `.sh-work` (`shV2Load` at the end of `shLoad`, `svRender`, rAF `svTick`
  reading `shCurT()`, `svStop` from `shCloseWork`). Modes watch / shadow /
  challenge / apply; Apply It → AI (`S.applyPhrase`, roleplay) or partner
  (`ppState().applyPhrase`). Captions: `captions/<vid>.json` (18; 13 with word
  times). `sw.js` precaches `shadow-sync.js?v=2`. Tests `tests/shadow-sync.test.mjs`
  (27). Events for both features are on the `be-events` allow-list on the branch
  only — deploy that Worker before any flag goes on.
- **iOS app (App Store) — `mobile/ios/`.** Capacitor 8 shell (SPM, no
  CocoaPods) around the web app: `npm run sync` copies the repo root into
  `www/` → `ios/App/App/public` (both git-ignored). Origin in the shell is
  `capacitor://localhost` — it is in the three Workers' allow-lists in code
  (`polish-worker.js`, `events-worker.js`, `partner/wrangler.toml`) and those
  Workers must be **redeployed** before the app's AI/scoring/analytics/partner
  calls work; that is a production deploy, the owner's call. `IS_IOS_APP`
  (index.html) hides the Google Play link/button and the About page's Play
  badges (Apple 2.3.10); nothing else differs. Bundle id `com.bemastery.app`,
  1.1.0 (1), iPhone-only portrait, iOS 15+, `NSMicrophoneUsageDescription`,
  `PrivacyInfo.xcprivacy`, `ITSAppUsesNonExemptEncryption=NO`. Listing text,
  review notes, privacy answers and 6.9" screenshots (1320×2868, from
  `scripts/store-art/shoot.js iphone`) are in `mobile/ios/appstore/`. **No
  Xcode on this Mac** (Command Line Tools only, no signing identity): the
  archive/upload steps in `mobile/ios/README.md` need a Mac with Xcode 26
  and the Lomonec team. Nothing signing-related is ever committed.
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

## Growth / discoverability layer
- **Social + search preview:** `index.html` and `flyer.html` each carry a
  `description`, `canonical`, full `og:*` and `twitter:*` tags. The share image is
  **`og.png`** (1200×630), rebuilt by `python3 scripts/make_og.py` from the repo
  root. `index.html` also has a JSON-LD `SoftwareApplication` block.
- **`robots.txt` + `sitemap.xml`** at the root. The sitemap lists `/`,
  `flyer.html`, `manual/en.html` and the legal pages.
- **IndexNow** key file `0703eea26ef786413e910ec4d620b6a0.txt` at the root — do
  not delete or rename it, the ping fails without it. Notifies Bing / Yandex /
  Seznam / Naver of changed URLs, no account needed:
  `curl "https://api.indexnow.org/indexnow?url=<page>&key=<key>"`. **Google
  ignores IndexNow and retired its sitemap ping** — Google only picks the
  sitemap up from `robots.txt`, or from a manual Search Console submission.
- **`flyer.html` is the public landing page**, not only the in-app About panel. Its
  English copy is written **inline** in the HTML (`render()` overwrites it with the
  same text, or a translation) so crawlers and no-JS visitors see real content —
  **keep the inline copy and `FL.en` in step**. Same for the static cards inside
  `#bgrid`, which `render()` clears and rebuilds. `index.html` has a `<noscript>`
  summary for the same reason.
- **Analytics** is a provider-agnostic `track(name, props)` in a head `<script>`.
  `PROVIDER` is set to **`"cfweb"` (Cloudflare Web Analytics)** — the user's
  choice — and the beacon token **is set and live** (`ID` at index.html:90,
  public by design), so the beacon loads on every page view.
  - **Cloudflare Web Analytics has no custom-event API** — page views, referrers
    and Core Web Vitals only. So the job is **split in two (2026-08-02)**: the
    beacon keeps page views, and `track()` posts to **our own Worker**,
    `backend/events/` (`be-events` → Cloudflare **Analytics Engine**). No
    third-party vendor, no cookies, no fee. Read `backend/events/README.md`
    before adding an event — the SQL queries for the funnel and the
    where-people-stop question live there.
  - The Worker enforces an **allow-list** of event names and prop keys; anything
    else is dropped with 204. Adding a `track()` call in index.html without
    adding the name to `EVENTS` first means it silently does nothing. The list
    is also the guard against a future event shipping something personal.
  - The client uses `sendBeacon` with a **`text/plain`** Blob. That is not
    sloppiness: sendBeacon cannot set a JSON content type without a CORS
    preflight it may not make, and it reports no errors, so "fixing" the content
    type would stop events silently.
  - The Plausible/GA4 branches still exist but **replace** `track()` — enabling
    one sends events there instead of to our Worker.
  - **GA4 needs a privacy.html update and an EU consent notice** (it sets
    cookies). Cloudflare and Plausible are cookie-less and need neither.
  - Only anonymous counts — never recordings, transcripts, phrase text or profile
    fields. Instrumented (11, exactly matching the Worker's allow-list):
    `app_open`, `onboarding_complete`, `practice_day` (+streak, week),
    `session_complete` (+week, day), `reminder_on`, `share`, `invite`,
    `rate_click`, `rate_later`, `play_click`, `install`.
  - **No device ID, by design** — so these are event counts, not people. Trends
    and ratios are sound; absolute user numbers are not. Use Play Console when a
    real install/retention figure is needed.
- **Share/invite/rate:** `APP_URL` and `PLAY_URL` consts near `shShare`. Share text
  gets the URL appended **in code**, so the 15 translation files never need
  re-cutting when the address changes. `shApp()` is the plain "share the app"
  action (Profile). `rateHTML()`/`rateGo()`/`rateLater()` put a Play-rating card on
  Home after **7** sessions; "not now" snoozes it 30 days (`S.rateSnoozed`),
  rating sets `S.rated`.
- **`manifest.json`** carries `screenshots` (narrow form factor) so Chrome shows
  the richer install prompt.
- **Play listing text** lives in `playstore/listing-full-description.txt` and is
  pasted into Play Console by hand. The full description has a hard 4,000-char
  limit and the file sits at exactly that; count before editing.

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
- **Live version:** always read the current `be12-vNN` out of `sw.js` before
  bumping. Do NOT trust a number written here — it goes stale every deploy.
- **Check before claiming anything is unbuilt.** This file has repeatedly been
  behind the code (the daily reminder, Firebase sign-in and the Play release were
  all listed as pending long after they shipped). Grep the source first.

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

- **Foundations / placement check (2026-09-13)** — see Key systems. Also in the
  help centre (section 2 of every `manual/<code>.html`), the flyer (11th benefit
  card, 16 languages) and the Play listing (`playstore/listing-full-description.txt`,
  at exactly 4,000 chars — trim before adding). The partnership documents in
  `marketing/partnership/` describe the pilot as two stages because of it.

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
  **Key parity verified 2026-09-13**: `I18N_EN` holds 1,426 keys and every one of
  the 15 files carries exactly those — no missing keys, no orphans. What may still
  lag is the *text* behind a key when English narrative copy changes (see i18n
  above); the key set itself is complete. When auditing, match keys with
  `/"([A-Za-z0-9_.\-]+)"\s*:/g` — a line-anchored `^\s*"…"` regex undercounts by
  36, because entries like `"gfix.0.cat":…,"gfix.0.note":…` share a line.

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
  reminder toggle + time, `rem.*` keys, plus Google-Calendar/.ics export). The
  in-app half is a `setTimeout` + a launch nudge + `Notification` when permitted.
  - **Web Push added 2026-08-02** so it also fires with the app closed:
    `backend/push/` is a **second Worker** (`be-push`, KV `SUBS`, cron every
    minute) — read `backend/push/README.md` before touching it. Client side is
    `PUSH_API`/`pushSync`/`pushOff`/`pushDone`/`pushSlot` next to the reminder
    code; `sw.js` has the `push` handler.
  - **Push carries NO payload** — a bare wake-up needs only a VAPID JWT, an
    encrypted payload needs RFC 8291 by hand. `sw.js` reads the wording from the
    **`be-rem` cache**, which the app writes via `t()`. That cache is
    deliberately **excluded from the activate sweep** in sw.js — don't "tidy"
    that filter, a version bump would wipe the text a pending push needs.
  - `pushDone()` (from `markPracticed`) is not an optimisation: `userVisibleOnly`
    forces every delivered push to raise a notification, so the only way to stay
    quiet for someone who already practised is for the cron not to send.
  - **Code is committed but the Worker is NOT deployed** — no KV id, no VAPID
    pair yet, so `/key` fails and `pushSync()` silently no-ops. Harmless: the
    old setTimeout path is untouched. See the README for the setup commands.
- **Google Play**: **LIVE** — `com.bemastery.app`, publisher "Lomonec", listing at
  play.google.com/store/apps/details?id=com.bemastery.app (verified 2026-08-01,
  store page shows "Updated on Jul 31, 2026"). `.well-known/assetlinks.json` carries
  BOTH fingerprints (Play App Signing `92:73:D3…` + local keystore `3D:E6:6D…`) and
  is served live from app.lomonec.com, so the TWA verifies with no browser bar.
  Because a TWA just loads the live site, **web changes ship via `git push` alone —
  no Play upload needed**. A new AAB is only for native-shell changes, and then the
  `twa-manifest.json` `appVersionCode` must increase (`bubblewrap update` +
  `expect build.expect`; answer the versionName prompt "1.0.0", never pipe "y").
  **Enforce HTTPS is ON** (enabled 2026-08-01) — `http://app.lomonec.com` 301s to
  https, assetlinks included. Nothing outstanding on the Play/hosting side.
- **Monetisation** direction discussed: freemium subscription (Play Billing needs a
  backend + budget cap) and B2B licensing; nothing built yet.
- Native-speaker **review of the emotional translations** still recommended.
- **Play listing art — current set is `playstore/store-art-2026-08/`** (`phone/`
  1080×2400 and `tablet/` 1440×2560, six each, neutral "Alex", current line-icon
  nav). Regenerate with **`scripts/store-art/shoot.js`** — see its header. Both
  older folders carried the owner's real first name and were **deleted
  2026-08-01** (`playstore/screenshots/`, `playstore/tablet-screenshots/`);
  recover from git history if ever needed. `playstore/screenshots-2026-08/` is
  the interim phone-only set, superseded by `store-art-2026-08/phone/`.
  - **Upload is manual in Play Console — nothing in the repo pushes it.**
    **Uploaded and live 2026-08-02** — the store page now shows the six phone
    shots and the tablet set, version 1.0.1, "Updated on Jul 31, 2026".
  - **There is deliberately no Shadow screenshot.** Every dense screen in the
    studio renders third-party YouTube artwork (the clip picker pulls a real
    thumbnail — Steve Jobs at Stanford — and the workspace embeds the player),
    which is someone else's likeness and copyright sitting in store marketing.
    The one clean screen, Trouble words, is two-thirds empty. Practice takes the
    slot instead. Don't "fix" this by shooting the picker.
  - `feature-graphic.png` (1024×500) was checked 2026-08-01 and is **clean** —
    correct branding, no personal name, tagline already matches the new copy.
- **`rp-photos/` — the 19 images are AI-GENERATED** (owner-confirmed 2026-08-17,
  recorded in `rp-photos/SOURCES.md`). Nothing in the files says so: every scrap
  of metadata was stripped before they were committed, and the `Exif` marker in
  `maya.jpg` is a false positive (Huffman tables). This is *lower* risk than
  stock photos of real people — no model releases, no likeness rights — so the
  folder README's Google-Images warning does not apply. What is still open is
  **which generator and which plan**, since several grant commercial use only on
  a paid tier. Do not re-open the "where did these come from" question; it is
  answered.
- **Analytics: LIVE end to end since 2026-08-14.** The Cloudflare beacon collects
  page views and referrers; `be-events` is deployed and its writes are confirmed
  landing in the `be_events` Analytics Engine dataset (verified by querying them
  back, not by trusting the 204 — the Worker swallows write errors on purpose).
  Analytics Engine had to be enabled on the account by hand first; `wrangler
  deploy` fails with `code: 10089` until it is. Read the numbers with
  **`./backend/events/query.sh`** (`events` / `people` / `funnel` / `weeks` /
  `stage` / `countries` / `raw`), which needs a token carrying Account
  Analytics: Read — the wrangler OAuth login does NOT have that scope.
  All 13 `track()` names and every prop key are verified against the Worker's
  allow-list. Adding an event still means the Worker first, then index.html.
  **The dataset cannot backfill** — nothing before 2026-08-14 exists anywhere.
- **"How many users?" has no answer in this repo.** Events are counts, not
  people (no device ID, by design). `app_open` carries `installed`
  (display-mode standalone) which splits the installed app from the open web,
  but cannot tell Play from an iOS PWA. **Never add the web and Play numbers** —
  the TWA loads app.lomonec.com, so every Play user is already in the page
  views. Real head-counts: Play Console (installs, active devices) and the
  Firestore `users/{uid}` count (a floor — sign-in is optional).
- **No email capture and no testimonials** anywhere. Both need things the repo
  can't supply on its own (a list backend / real users willing to be quoted).
- **No iOS App Store presence** — iPhone users get the PWA install flow only.
