# lomonec.com — public marketing site

**Layout since 7 Oct 2026:** `lomonec.com/` is the **company** page (Lomonec:
AI automation consulting, agentic AI, software, our apps) — `index.html` +
`assets/` (its own CSS/JS, the logo files from the sales kit). Each app has its
own folder; **BE Mastery is `bemastery/`** (everything described below lives
there now, all paths relative). `_redirects` sends the old `/team.html` and
`/blog/…` addresses to their new homes. Public contact is
`contact@lomonec.com` — never a personal name or address. To add an app: give
it a folder and a card in the "Our apps" section of `index.html`.

The public marketing site for **lomonec.com**. No framework, no build step —
plain HTML, four stylesheets and three scripts, served as files.

```
index.html            semantic sections, no inline CSS or JS
css/tokens.css        design tokens — every colour/radius/timing resolves here
css/base.css          reset, type scale, layout primitives
css/components.css    nav, buttons, glass cards, floating cards, social
css/sections.css      ambient background, hero stage, per-section layout
js/config.js          SINGLE SOURCE for store URLs, nav, CTAs, social, footer
js/motion.js          MotionSystem — one rAF loop, one 4 s pulse scheduler
js/app.js             renders nav/stores/social/footer from config, wires the hero
js/team.js            the people on team.html and in blog bylines
js/blog.js            the list of blog posts
js/pages.js           renders the team grid, blog list and bylines
css/pages.css         team, blog list and article layout
js/analytics.js       9 anonymous counts → the be-events Worker (see below)
```

The page sells the **app**. It is not the app, and it does not try to be one:
every feature section shows a preview and then points at the store buttons.
`app.lomonec.com` is no longer offered as the way in — it appears twice, as
"Sign in" for people who already have an account, and as the stop-gap for
iPhone and desktop while there is no App Store listing.

The page tells one story in order: the problem → the method → Shadow Studio →
AI Coach → Practice Partner → how it fits → progress → two programmes →
pricing → download.

## Stores — the page cannot claim a listing that does not exist

`js/config.js` holds `APP_STORE_URL` and `GOOGLE_PLAY_URL` and nothing else
decides what the page says:

| store | today | what renders |
|---|---|---|
| Google Play | **live** — `com.bemastery.app` | a real link, `google_play_clicked` |
| App Store | **no listing** — `APP_STORE_URL` is `""` | a dashed, dimmed, non-link badge reading "Coming soon on the App Store", out of the tab order |

**To go live on iOS:** paste the listing URL into `APP_STORE_URL`. That single
edit turns both badges into links, adds the App Store row to the footer, starts
`app_store_clicked` firing and **removes** the "not on the App Store yet" note
under the download section, which is rendered from the same status
(`buildStoreNote`). Nothing else needs touching. Verified by temporarily
filling the constant in and reloading, 2026-09-22.

### Store badges

The two marks are drawn inline: the Play mark as its four facets in the
official colours, the Apple mark as its standard silhouette. **Before launch
these should be swapped for the official badge artwork** — Apple Marketing
Resources and the Google Play badge generator — because both brand guidelines
ask for the supplied asset rather than a redrawing. The swap is local to
`MARK` in `js/app.js` and the `.store` rules in `css/components.css`.

## Analytics

`js/analytics.js` posts nine counts to the same `be-events` Worker the app
uses — `sendBeacon` with a `text/plain` Blob, no cookie, no device id, no
third party:

`website_visit` · `hero_cta_clicked` · `app_store_clicked` ·
`google_play_clicked` · `pricing_viewed` · `practice_partner_viewed` ·
`shadow_viewed` · `download_section_viewed` · `social_link_clicked`

Only two prop keys are sent, `source` (hero | nav | download | pricing |
footer | menu | …) and `kind` (the social channel). Both were already on the
Worker's `PROP_KEYS`, so that list is untouched.

> **The Worker must be redeployed before any of this records anything.**
> `backend/events/events-worker.js` was changed in the same commit: the nine
> names were added to `EVENTS` and `https://lomonec.com` +
> `https://www.lomonec.com` to `ALLOWED_ORIGINS`. Until that deploy, every
> event is dropped with a 204 — a well-formed no-op, which is the safe
> direction. Deploying it is the owner's call.

Events are suppressed on `localhost`, so a local check never writes into the
production dataset.

## Motion

`js/motion.js` owns every recurring animation. Components never set their own
timers. It runs one `requestAnimationFrame` loop that drives the particle field,
the floating cards, the pointer tilt and the "intelligence pulse" — a ~4 s event
(varied 3.7–4.65 s so it does not feel robotic) exposed to CSS as `--pulse`
(0 → 1 → 0). The loop stops when the tab is hidden, when the hero scrolls out of
view, or when the visitor prefers reduced motion; `--pulse` is only written when
it changes, so the ~3 idle seconds of every cycle cost no style recalculation.

It is separate from the app. `app.lomonec.com` keeps serving `index.html` at
the repo root, and `flyer.html` keeps being the in-app About panel. Nothing in
the app changes when this folder changes.

## Only claim what is switched ON in production

The copy was re-checked against the live app (`be12-v479`, 2026-09-24) and its
`FLAGS_DEFAULT`. Before adding a feature to this page, check the flag:

- **On, and on the page:** Practice Partner (`practice_partner_enabled`, with
  matching / voice / AI coach / notifications) **and live calls** (these follow
  the Worker's `LIVE_ENABLED`, set to "1" on 2026-09-24, not the client flag).
  Shadow Studio V2 with the video library (`shadow_library_enabled`, about 300
  videos) and the Challenge ladder (`shadow_challenge_enabled`). The speaking
  report: Executive Polish, every session's "Record yourself" card, and every
  Life Simulation (14 `SCENARIOS`). The certificate after all 84 sessions.
  Foundations, the trade track, the road map.
- **Off, so deliberately absent:** Apply It (`shadow_apply_phrase_enabled`)
  and the V2 daily missions (hidden app-wide since be12-v463). There is **no
  iOS App Store listing**, which is why the App Store badge renders as "Coming
  soon" rather than as a link. See § Stores.
- **The Shadow artwork is drawn, not screenshotted.** The app's Shadow screens
  show YouTube thumbnails and players, which are someone else's likeness and
  copyright. The studio frame, library card, ladder and report in `#shadow`
  are HTML copies of the app's layout with our own sample line. Keep it that
  way, and do not name the library's channels here.
- **The Challenge ladder is "up to" five steps.** "Together" needs real word
  timing, so clips without it skip that step (`svChRungs`).
- **Pricing:** there is **no billing anywhere in this product** — no Play
  Billing, no Stripe, no RevenueCat, and the app's own Premium row renders a
  "coming soon" chip. The Pricing section therefore prints **no figure**: one
  card says Free, the other says a paid tier is in preparation and states
  plainly that no price is shown because none is configured. Put real numbers
  there the day a real SKU exists, and not before.
- **Privacy wording:** recordings are *saved on the device and we keep no copy*;
  they ARE sent to the Worker and on to OpenAI for scoring. Do not write
  "your recordings never leave your phone" — `privacy.html` §2 says otherwise.

## What the page shows, and what it keeps for the app (2026-09-28)

Rewritten after reading the landing pages of Speak, ELSA Speak, Praktika and
Cambly (Duolingo's did not render for the reader). They all share the same
shape: an outcome-led hero with the store buttons, a three-step method, a
feature grid with one picture and one line per feature, "who it is for", proof
(ratings, reviews), light pricing, an FAQ and a final download call. None of
them explains how a feature works inside — no rules, no algorithms, no content
counts beyond one headline number. The page now follows that:

- **Shown:** the promise, the daily method, a picture grid of what is inside
  (`#inside`, art in `img/inside/`), Shadow Studio, the AI coach, Practice
  Partner, progress and the certificate, who it is for (`#who`), the two
  programmes, "free to start", an FAQ (`#faq`) and the download.
- **Kept for the app:** the Challenge rules, how the queue and matching work,
  the "double yes", the five report steps, the "how it fits together" loop
  (section removed), exact content counts other than 84 / 152 / 14 / 15.
- **Never:** invented ratings, reviews or learner numbers (see below).

### Claims that need staging features in production first

lomonec.com is not live. The copy was updated against **staging be12-v568**,
so before the site goes public these must be on app.lomonec.com, or the lines
removed:

- Grammar exercises (Inside grid, General English list) — Home V2 Explore card.
- "Open the app and your page is already waiting" (Inside intro) — Home V2.
- Welding: "a report from each interviewer" and "professional interview
  coaches, judged against the trade's own standards".
- "A Premium plan is on its way" (Pricing, FAQ) — billing is off everywhere;
  no price is printed until a real one exists.

The hero phone is now `img/phone-session.webp` — the redesigned session day,
shot from the staging line with the neutral "Alex" profile. Home V2 was not
used: its hero reel shows YouTube artwork. The site's body text follows the
app's softer `#cbd0e2` (`--color-text`).

## Real numbers only

`STATS` at the top of `<body>` holds the Google Play figures (`rating`,
`downloads`, `learners`). All three ship empty, and the page then shows product
facts (84 sessions / 152 phrases / 15 languages) in the hero chips and a
"Free to start · No account needed · Works offline once installed · Guidance in
15 languages" line under the store buttons. Paste figures from Play Console
when there are figures worth showing; nothing is invented.

## Team and blog

Two inner pages share the home page's nav and footer. `<body data-page>` names
the page and `data-root` is the path back to the root (`"../"` under `blog/`),
so `app.js` turns `#section` links into links back to the home page.

- **`team.html`** is rendered from **`js/team.js`**. `group:"core"` → "The
  makers", `group:"contributor"` → "Contributors" (hidden while empty). An
  entry with `name:""` is never published; on localhost it shows as a dashed
  "fill me in" card. Photos go in `img/team/` (square, 600×600 or more); with
  no photo the card shows initials.
- **`blog/index.html`** lists **`js/blog.js`**, newest first; a future date
  stays hidden until that day. To publish: copy `blog/_template.html` to
  `blog/<slug>.html`, write it, add the entry to `js/blog.js`, add the URL to
  `sitemap.xml`. `author` is a team id or `"team"` (BE Mastery Team).
- The nav has no room for an eighth item at 1,024 px, which is why
  "Professional English" is in the footer and not the top bar.

## French pages (7 Oct 2026)

`/fr/` and `/bemastery/fr/` are the French copies of the two home pages,
reached from the EN / FR drop-down (`details.lang`) in each top bar. They are
**generated — never edit them by hand**. After any change to `index.html` or
`bemastery/index.html`, run from the repo root:

```
node scripts/site-fr/build.mjs
```

It copies the English page, sets `lang="fr"`, points relative paths one folder
up and swaps each string in `scripts/site-fr/home.fr.mjs` /
`bemastery.fr.mjs`. If an English sentence was edited, its entry no longer
matches: the build stops and lists it — translate it in the dictionary and run
again. A new English sentence that is not in the dictionary stays English, so
read the French page after adding copy. The labels drawn by the scripts
(menu, footer, store badges) come from `L()` in `js/config.js` and `T()` in
`js/app.js`, keyed on `<html lang>`. Team and blog are English only. The
French was machine-written: a native speaker should read it before it is
promoted.

## Assets

- `img/logo.svg`, `img/icon-192.png` — copies of the app's own.
- `img/phone-*.webp` — 540×1200 versions of `playstore/store-art-2026-08/phone/`
  (neutral "Alex" profile). Regenerate from those PNGs if the store art changes.
- The social preview image is the app's `https://app.lomonec.com/og.png`
  (absolute URL, so it works from either domain).

## Cache-busting

Every stylesheet and script link carries `?v=YYYYMMDDx`. `python3 -m http.server`
sends no cache headers, so browsers reuse old copies; bump the `?v=` in
`index.html`, `team.html` and `blog/*.html` whenever a CSS or JS file changes.

## Check locally

```
cd site && python3 -m http.server 8041
```
Other sessions often hold 80xx ports serving *other* checkouts — confirm with
`curl -s localhost:8041/ | grep '<title>'` that you are looking at this page.

## Deploy to lomonec.com

**LIVE since 7 Oct 2026** as the Worker `lomonec-site` (static assets, no
code) on the custom domains `lomonec.com` and `www.lomonec.com`. Config is
`wrangler.jsonc` in this folder; `.assetsignore` keeps the README, the config
and `img/widgets/_home.html` (the composer for the widget home-screen shots)
off the web. Redeploy after every change:
```
cd site && npx wrangler deploy
```
**Not Pages:** wrangler 4.148 turns `wrangler pages project create` into a
Workers deploy of whatever folder it runs in — it began uploading a whole
repo checkout as a Worker named after the folder. Never run it here.

At launch the App Store badge is "Coming soon" (`IOS_LIVE = false` in
`js/config.js`) and the Welding copy leaves out the 534-video studio, which is
off in production. Flip `IOS_LIVE` and redeploy the day Apple releases 1.1.0.

Still to do now the site is live:
- submit `https://lomonec.com/sitemap.xml` in Google Search Console;
- ping IndexNow for Bing: the key file at the app root only covers
  `app.lomonec.com`, so lomonec.com needs its own key file first.
