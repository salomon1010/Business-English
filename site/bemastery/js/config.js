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

  /* the page's language: <html lang="fr"> on bemastery/fr/. L(en, fr) picks
     the label; everything else (URLs, statuses) is shared. */
  var FR = document.documentElement.lang.indexOf("fr") === 0;
  function L(en, fr) { return FR ? fr : en; }

  /* ── store URLs ─────────────────────────────────────────────────────────
     GOOGLE_PLAY_URL — live, verified: the listing is public and the TWA ships
     from it (playstore/README.md, CLAUDE.md).
     APP_STORE_URL   — the App Store listing (app id 6817207864, 1.1.0 submitted
     6 Oct 2026). ► IOS_LIVE must be true only once Apple has approved the app
     AND it has been released: until then the listing page answers 404, and
     the badge would be a dead link. false = an honest "Coming soon" badge.   */
  var APP_STORE_URL   = "https://apps.apple.com/app/id6817207864";
  var IOS_LIVE        = false;
  var GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.bemastery.app";

  /* The app's own pages (privacy, help, delete account). BE Mastery is used
     through the two store apps only (owner, 7 Oct 2026): nothing on this site
     sends a learner to the web app to practise or to sign in. */
  var APP = "https://app.lomonec.com/";

  return {
    fr:   FR,
    home: FR ? "/fr/" : "/",
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
        live:   L("Download on the App Store", "Télécharger dans l'App Store"),
        soon:   L("Coming soon on the App Store", "Bientôt sur l'App Store")
      },
      android: {
        key:    "android",
        os:     "Android",
        url:    GOOGLE_PLAY_URL,
        status: "live",
        live:   L("Get it on Google Play", "Disponible sur Google Play"),
        soon:   L("Coming soon on Google Play", "Bientôt sur Google Play")
      }
    },

    cta: {
      primary:   { label: L("Download the app", "Télécharger l'app"), href: "#download" },
      secondary: { label: L("See how it works", "Voir comment ça marche"), href: "#method"   }
    },

    /* desktop nav + mobile menu are rendered from this list. One word each
       (owner, 2026-09-28): a label must never wrap onto two lines.
       "#x" = a section of the home page; on the other pages app.js turns it
       into a link back to that section. page:"…" = its own page, and marks
       itself current there (matched against <body data-page>). */
    nav: [
      { label: L("New", "Nouveautés"),      href: "#new"     },
      { label: L("Method", "Méthode"),        href: "#method"  },
      { label: L("Features", "Fonctions"),    href: "#inside"  },
      { label: "Shadowing",            href: "#shadow"  },
      { label: L("Welding", "Soudage"),       href: "#welding" },
      { label: L("Pricing", "Tarifs"),        href: "#pricing" },
      { label: "Widgets",              href: "#widgets" },
      { label: "FAQ",                  href: "#faq"     },
      { label: L("Team", "Équipe"),          href: "team.html", page: "team" }
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
      { title:L("Product", "Produit"), links:[
        { label:L("General English", "Anglais général"), href:"#paths" },
        { label:"Practice Partner",     href:"#partner" },
        { label:"Shadow Studio",        href:"#shadow"  },
        { label:L("AI Coach", "Coach IA"),   href:"#coach"   },
        { label:L("Welding English", "Anglais du soudage"), href:"#welding" },
        { label:L("Home-screen widgets", "Widgets d'écran d'accueil"), href:"#widgets" },
        { label:L("Pricing", "Tarifs"),      href:"#pricing" },
        { label:"FAQ",                  href:"#faq"     }
      ]},
      { title:L("Company", "Entreprise"), links:[
        { label:"Lomonec",         href:FR ? "/fr/" : "/" },
        { label:L("About BE Mastery", "À propos de BE Mastery"), href:"https://app.lomonec.com/flyer.html" + L("", "?lang=fr") },
        { label:L("Team", "Équipe"),        href:"team.html" },
        { label:"Blog",             href:"blog/" },
        { label:"Contact",          href:"mailto:contact@lomonec.com" },
        { label:L("Help centre", "Centre d'aide"), href:"https://app.lomonec.com/manual/" + L("en", "fr") + ".html" }
      ]},
      { title:L("Download", "Télécharger"), links:[
        { label:"Google Play", href:GOOGLE_PLAY_URL, store:"android" },
        { label:"App Store",   href:APP_STORE_URL,   store:"ios"     }
      ]},
      { title:L("Legal", "Mentions légales"), links:[
        { label:L("Privacy", "Confidentialité"), href:"https://app.lomonec.com/privacy.html" },
        { label:L("Delete account", "Supprimer le compte"), href:"https://app.lomonec.com/delete-account.html" }
      ]}
    ],

    /* Google Play figures. Empty = the page shows product facts instead.
       Nothing here is ever invented — paste real numbers only. */
    stats: { rating:"", downloads:"", learners:"" }
  };
})();
