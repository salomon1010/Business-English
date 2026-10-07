/* ───────────────────────────────────────────────────────────────────────────
   BE Mastery — single source of truth for every outbound link and label.
   Change a URL HERE and it changes everywhere on the page.

   TWO RULES THIS FILE ENFORCES
   1. A link with url:"" is "not published yet". It is never rendered as a live
      link, so the page cannot ship a dead one.
   2. A store with status:"coming_soon" renders a badge that says so. The page
      never says "Available on the App Store" until APP_STORE_URL is filled in
      AND the status is flipped to "live".
   ─────────────────────────────────────────────────────────────────────────── */
window.BEM = (function () {

  /* ── store URLs ─────────────────────────────────────────────────────────
     GOOGLE_PLAY_URL — live, verified: the listing is public and the TWA ships
     from it (playstore/README.md, CLAUDE.md).
     APP_STORE_URL   — the App Store listing (app id 6817207864, 1.1.0 submitted
     6 Oct 2026). ► IOS_LIVE must be true only once Apple has approved the app
     AND it has been released: until then the listing page answers 404, and
     the badge would be a dead link. false = an honest "Coming soon" badge.   */
  var APP_STORE_URL   = "https://apps.apple.com/app/id6817207864";
  var IOS_LIVE        = true;
  var GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.bemastery.app";

  /* The app's own pages (privacy, help, delete account). BE Mastery is used
     through the two store apps only (owner, 7 Oct 2026): nothing on this site
     sends a learner to the web app to practise or to sign in. */
  var APP = "https://app.lomonec.com/";

  return {
    app:  APP,
    play: GOOGLE_PLAY_URL,

    /* ── the two stores ───────────────────────────────────────────────────
       status: "live" → a real link | "coming_soon" → an honest, inert badge */
    stores: {
      ios: {
        key:    "ios",
        os:     "iPhone",
        url:    APP_STORE_URL,
        status: APP_STORE_URL && IOS_LIVE ? "live" : "coming_soon",
        live:   "Download on the App Store",
        soon:   "Coming soon on the App Store"
      },
      android: {
        key:    "android",
        os:     "Android",
        url:    GOOGLE_PLAY_URL,
        status: "live",
        live:   "Get it on Google Play",
        soon:   "Coming soon on Google Play"
      }
    },

    cta: {
      primary:   { label: "Download the app",   href: "#download" },
      secondary: { label: "See how it works",   href: "#method"   }
    },

    /* desktop nav + mobile menu are rendered from this list. One word each
       (owner, 2026-09-28): a label must never wrap onto two lines.
       "#x" = a section of the home page; on the other pages app.js turns it
       into a link back to that section. page:"…" = its own page, and marks
       itself current there (matched against <body data-page>). */
    nav: [
      { label: "Method",               href: "#method"  },
      { label: "Features",             href: "#inside"  },
      { label: "Shadowing",            href: "#shadow"  },
      { label: "Partners",             href: "#partner" },
      { label: "Welding",              href: "#welding" },
      { label: "Pricing",              href: "#pricing" },
      { label: "FAQ",                  href: "#faq"     },
      { label: "Blog",                 href: "blog/",     page: "blog" },
      { label: "Team",                 href: "team.html", page: "team" }
    ],

    /* VERIFIED 2026-09-22: youtube + tiktok are Lomonec's own channels and are
       already linked from the app. linkedin.com/company/lomonec 404s and no
       Instagram account is established — leave "" until they exist. */
    social: [
      { key:"youtube",   label:"YouTube",   url:"https://www.youtube.com/@lomonec" },
      { key:"tiktok",    label:"TikTok",    url:"https://www.tiktok.com/@lomonec"  },
      { key:"instagram", label:"Instagram", url:"" },
      { key:"linkedin",  label:"LinkedIn",  url:"" }
    ],

    /* only pages that actually exist are listed here. A link with store:"ios"
       is rendered only once that store is live. */
    footer: [
      { title:"Product", links:[
        { label:"General English",      href:"#paths"   },
        { label:"Practice Partner",     href:"#partner" },
        { label:"Shadow Studio",        href:"#shadow"  },
        { label:"AI Coach",             href:"#coach"   },
        { label:"Welding English",      href:"#welding" },
        { label:"Home-screen widgets",  href:"#widgets" },
        { label:"Pricing",              href:"#pricing" },
        { label:"FAQ",                  href:"#faq"     }
      ]},
      { title:"Company", links:[
        { label:"About BE Mastery", href:"https://app.lomonec.com/flyer.html" },
        { label:"Team",             href:"team.html" },
        { label:"Blog",             href:"blog/" },
        { label:"Contact",          href:"mailto:contact@lomonec.com" },
        { label:"Help centre",      href:"https://app.lomonec.com/manual/en.html" }
      ]},
      { title:"Download", links:[
        { label:"Google Play", href:GOOGLE_PLAY_URL, store:"android" },
        { label:"App Store",   href:APP_STORE_URL,   store:"ios"     }
      ]},
      { title:"Legal", links:[
        { label:"Privacy",        href:"https://app.lomonec.com/privacy.html" },
        { label:"Delete account", href:"https://app.lomonec.com/delete-account.html" }
      ]}
    ],

    /* Google Play figures. Empty = the page shows product facts instead.
       Nothing here is ever invented — paste real numbers only. */
    stats: { rating:"", downloads:"", learners:"" }
  };
})();
