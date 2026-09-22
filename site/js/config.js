/* ───────────────────────────────────────────────────────────────────────────
   BE Mastery — single source of truth for every outbound link and label.
   Change a URL HERE and it changes everywhere on the page.
   A link with url:"" is treated as "not published yet" and is not rendered,
   so the page never ships a dead link.
   ─────────────────────────────────────────────────────────────────────────── */
window.BEM = (function () {

  var APP  = "https://app.lomonec.com/";
  var PLAY = "https://play.google.com/store/apps/details?id=com.bemastery.app";

  return {
    app:  APP,
    play: PLAY,

    cta: {
      primary:   { label: "Start free",        href: APP },
      secondary: { label: "See how it works",  href: "#method" },
      signin:    { label: "Sign in",           href: APP },
      play:      { label: "Get it on Google Play", href: PLAY }
    },

    /* desktop nav + mobile menu are rendered from this list */
    nav: [
      { label: "The method",          href: "#method"    },
      { label: "Shadow Studio",       href: "#shadow"    },
      { label: "AI Coach",            href: "#coach"     },
      { label: "Practice Partner",    href: "#partner"   },
      { label: "How it fits",         href: "#loop"      },
      { label: "Professional English",href: "#paths"     }
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

    /* only pages that actually exist are listed here */
    footer: [
      { title:"Product", links:[
        { label:"General English",     href:APP },
        { label:"Practice Partner",    href:"#partner" },
        { label:"Shadow Studio",       href:"#shadow" },
        { label:"AI Coach",            href:"#coach" },
        { label:"Professional English",href:"#paths" }
      ]},
      { title:"Company", links:[
        { label:"About BE Mastery", href:"https://app.lomonec.com/flyer.html" },
        { label:"Contact",          href:"mailto:contact@lomonec.com" },
        { label:"Help centre",      href:"https://app.lomonec.com/manual/en.html" }
      ]},
      { title:"Get the app", links:[
        { label:"Open in your browser", href:APP },
        { label:"Google Play",          href:PLAY }
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
