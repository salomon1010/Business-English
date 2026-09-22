# lomonec.com — public marketing site

The public marketing site for **lomonec.com**. No framework, no build step —
plain HTML, four stylesheets and three scripts, served as files.

```
index.html            semantic sections, no inline CSS or JS
css/tokens.css        design tokens — every colour/radius/timing resolves here
css/base.css          reset, type scale, layout primitives
css/components.css    nav, buttons, glass cards, floating cards, social
css/sections.css      ambient background, hero stage, per-section layout
js/config.js          SINGLE SOURCE for nav, CTAs, social URLs, footer, stats
js/motion.js          MotionSystem — one rAF loop, one 4 s pulse scheduler
js/app.js             renders nav/social/footer from config, wires the hero
```

The page tells one story in order: the problem → the method → Shadow Studio →
AI Coach → Practice Partner → progress → two programmes → start.

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

The copy was written against the live app (`be12-v429`, 2026-09-22) and its
`FLAGS_DEFAULT`. Before adding a feature to this page, check the flag:

- **On, and on the page:** Practice Partner (`practice_partner_enabled`, with
  matching / voice / AI fallback / notifications), Shadow Studio V2 and the
  five-rung Challenge ladder (`shadow_studio_v2_enabled`,
  `shadow_challenge_enabled`), Executive Polish's one-minute speech report,
  Life Simulations, Foundations, the trade track, the road map.
- **Off, so deliberately absent:** the searchable 301-video Shadow library
  (`shadow_library_enabled`), live WebRTC calls between partners
  (`practice_partner_live_enabled`, and the Worker's `LIVE_ENABLED="0"`),
  Apply It (`shadow_apply_phrase_enabled`). There is also **no iOS App Store
  listing** — do not add an App Store badge.
- **Privacy wording:** recordings are *saved on the device and we keep no copy*;
  they ARE sent to the Worker and on to OpenAI for scoring. Do not write
  "your recordings never leave your phone" — `privacy.html` §2 says otherwise.

## Real numbers only

`STATS` at the top of `<body>` holds the Google Play figures (`rating`,
`downloads`, `learners`). All three ship empty, and the page then shows product
facts (84 sessions / 152 phrases / 15 languages) in the trust band and a
"Free · Google Play + web · Works offline" pill in the hero. Paste figures from
Play Console when there are figures worth showing; nothing is invented.

## Assets

- `img/logo.svg`, `img/icon-192.png` — copies of the app's own.
- `img/phone-*.webp` — 540×1200 versions of `playstore/store-art-2026-08/phone/`
  (neutral "Alex" profile). Regenerate from those PNGs if the store art changes.
- The social preview image is the app's `https://app.lomonec.com/og.png`
  (absolute URL, so it works from either domain).

## Check locally

```
cd site && python3 -m http.server 8041
```
Other sessions often hold 80xx ports serving *other* checkouts — confirm with
`curl -s localhost:8041/ | grep '<title>'` that you are looking at this page.

## Deploy to lomonec.com

`lomonec.com` serves nothing today (2026-09-21). Two options; the first is
simpler because the DNS zone is already on Cloudflare.

**A. Cloudflare Pages (recommended)**
```
npx wrangler pages project create lomonec-site --production-branch main
npx wrangler pages deploy site --project-name lomonec-site
```
Then Cloudflare dashboard → Workers & Pages → lomonec-site → Custom domains →
add `lomonec.com` and `www.lomonec.com` (Cloudflare writes the DNS records).
Redeploy after every change with the second command.

**B. GitHub Pages, second repo**
Push this folder to `salomon1010/lomonec-site`, enable Pages on `main`, add a
`CNAME` file containing `lomonec.com`, and point the apex `A` records at GitHub
Pages' IPs plus `www` → `salomon1010.github.io`.

Either way, when the site is live:
- submit `https://lomonec.com/sitemap.xml` in Google Search Console;
- ping IndexNow for Bing: the key file at the app root only covers
  `app.lomonec.com`, so lomonec.com needs its own key file first.
