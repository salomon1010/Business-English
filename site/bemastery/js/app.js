/* ───────────────────────────────────────────────────────────────────────────
   Page wiring. Renders navigation, social links and the footer from
   js/config.js so there is one place to change a URL, then starts the
   MotionSystem. No third-party dependencies.
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  var C = window.BEM;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* Every page shares this nav and footer. <body data-page> names the page
     ("home", "team", "blog") and data-root is the way back to the site root
     ("" at the root, "../" under blog/). A "#section" link stays a scroll
     on the home page and becomes a link back to that section elsewhere. */
  var PAGE = document.body.dataset.page || "home";
  var ROOT = document.body.dataset.root || "";
  var HOME = PAGE === "home";
  /* T(en): the wording in the page's language (see L() in config.js) */
  var T = C.L || function (en) { return en; };
  /* "/x" is already absolute: the ROOT prefix is only for relative links */
  function href(h) {
    if (!h || /^(https?:|mailto:|\/)/.test(h)) return h;
    if (h.charAt(0) === "#") return HOME ? h : (ROOT || "./") + h;
    return ROOT + h;
  }

  /* ── icons ───────────────────────────────────────────────────────────── */
  var ICON = {
    youtube:'<path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8z"/><path d="M10 15V9l5 3z" fill="currentColor" stroke="none"/>',
    tiktok:'<path d="M15 3v9.6a3.4 3.4 0 1 1-2.6-3.3"/><path d="M15 3c.4 2.3 2 3.9 4.3 4.1"/>',
    instagram:'<rect x="3.5" y="3.5" width="17" height="17" rx="4.6"/><circle cx="12" cy="12" r="3.9"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>',
    linkedin:'<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V17M8 7.6v.1M11.7 17v-3.6a2.1 2.1 0 0 1 4.2 0V17"/>'
  };
  /* Platform marks. Accurate renditions of the two store glyphs — the Play
     mark is its four facets in the official colours, the Apple mark its
     standard silhouette. BEFORE LAUNCH these should be swapped for the
     official downloadable badge artwork (Apple Marketing Resources; the
     Google Play badge generator), which is what both brand guidelines ask
     for. See README.md § Store badges. */
  var MARK = {
    android:
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="mk">' +
      '<path fill="#00A0FF" d="M1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924z"/>' +
      '<path fill="#00E676" d="M13.544 10.989l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973z"/>' +
      '<path fill="#FFCE00" d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594z"/>' +
      '<path fill="#FF3A44" d="M13.544 13.056l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z"/></svg>',
    ios:
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="mk">' +
      '<path fill="currentColor" d="M17.05 12.53c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.61-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.58 2.17-1.53 2.65-.39 6.57 1.1 8.72.73 1.05 1.6 2.23 2.74 2.19 1.1-.05 1.51-.71 2.84-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.47z"/>' +
      '<path fill="currentColor" d="M15.1 6.13c.61-.74 1.02-1.77.91-2.8-.88.04-1.94.59-2.57 1.32-.56.65-1.05 1.7-.92 2.7.98.08 1.98-.5 2.58-1.22z"/></svg>'
  };
  var EV = { android:"google_play_clicked", ios:"app_store_clicked" };

  /* One store button. A store that is not live renders as a non-link badge
     that says so — the page can never claim a listing that does not exist. */
  function storeBtn(st, source, size) {
    var live = st.status === "live" && st.url;
    var cls  = "store" + (live ? "" : " is-soon") + (size ? " " + size : "");
    var top  = live ? (st.key === "ios" ? T("Download on the") : T("Get it on"))
                    : T("Coming soon on");
    var name = st.key === "ios" ? "App Store" : "Google Play";
    var body = '<span class="mkw">' + MARK[st.key] + '</span>' +
               '<span class="stxt"><small>' + top + '</small><b>' + name + '</b></span>' +
               (live ? "" : '<span class="soon-tag">' + T("Soon") + '</span>');
    if (!live) {
      return '<span class="' + cls + '" role="img" aria-label="' +
             (st.key === "ios" ? T("BE Mastery is not on the App Store yet — coming soon")
                               : T("BE Mastery is not on Google Play yet — coming soon")) +
             '">' + body + '</span>';
    }
    return '<a class="' + cls + '" href="' + st.url + '" target="_blank" rel="noopener noreferrer"' +
           ' data-ev="' + EV[st.key] + '" data-ev-source="' + source + '"' +
           ' aria-label="' + st.live + T(" (opens in a new tab)") + '">' + body + '</a>';
  }

  /* The note under the store buttons. It is rendered from the same status the
     badges are, so it cannot outlive what it describes: while a store is not
     live it explains the gap and offers the browser as a stop-gap; once both
     stores are live it disappears entirely. */
  function buildStoreNote() {
    var host = $("[data-store-note]");
    if (!host) return;
    var soon = Object.keys(C.stores)
      .map(function (k) { return C.stores[k]; })
      .filter(function (st) { return !(st.status === "live" && st.url); });
    if (!soon.length) { host.hidden = true; host.innerHTML = ""; return; }
    host.hidden = false;
    host.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.1"/></svg>' +
      '<span>' + soon.map(function (st) {
        return st.key === "ios" ? T("The iPhone app is on its way to the App Store.")
                                : T("The Android app is on its way to Google Play.");
      }).join(" ") + " " + T("It will be listed here the moment it is live.") + '</span>';
  }

  /* every [data-stores] host renders both stores, in the order given */
  function buildStores() {
    $$("[data-stores]").forEach(function (host) {
      var source = host.dataset.stores || "page";
      var size   = host.dataset.storeSize || "";
      host.innerHTML = storeBtn(C.stores.ios, source, size) +
                       storeBtn(C.stores.android, source, size);
    });
  }

  function svg(path, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
           (extra || '') + '>' + path + '</svg>';
  }

  /* ── navigation ──────────────────────────────────────────────────────── */
  /* the way back to the company site: a pill under the brand on every page,
     and the first row of the mobile menu */
  var BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  var WORD = '<span class="pc-word">LOMON<b>EC</b></span>';
  function buildParent() {
    var brand = $("#nav .brand");
    if (!brand || $("#nav .parent-chip")) return;
    var a = document.createElement("a");
    a.className = "parent-chip";
    a.href = C.home || "/";
    a.setAttribute("aria-label", T("Back to Lomonec, the company behind BE Mastery"));
    a.title = T("Lomonec — the company behind BE Mastery");
    a.innerHTML = '<span class="pc-in">' + BACK_SVG + WORD + '</span>';
    /* under the brand, not beside it: the bar has no width to spare */
    var g = document.createElement("div");
    g.className = "brand-group";
    brand.parentNode.insertBefore(g, brand);
    g.appendChild(brand);
    g.appendChild(a);
  }

  function buildNav() {
    buildParent();
    var links = $("#navLinks"), menu = $("#mobileMenu");
    if (links) {
      links.innerHTML = C.nav.map(function (n) {
        return '<a href="' + href(n.href) + '"' +
               (n.page ? ' aria-current="' + (n.page === PAGE ? "page" : "false") + '"' : "") +
               '>' + n.label + '</a>';
      }).join("");
    }
    if (menu) {
      menu.innerHTML =
        '<a class="menu-parent" href="' + (C.home || "/") + '">' + BACK_SVG + T("Back to {brand}").replace("{brand}", WORD) + '</a>' +
        C.nav.map(function (n) {
          return '<a href="' + href(n.href) + '"' +
                 (n.page === PAGE ? ' aria-current="page"' : "") + '>' + n.label + '</a>';
        }).join("") +
        '<div class="sep"></div>' +
        '<a class="btn btn-primary" href="' + href(C.cta.primary.href) +
          '" data-ev="hero_cta_clicked" data-ev-source="menu">' + C.cta.primary.label + '</a>';
    }
  }

  /* The top bar must never be wider than its frame. Menu words differ in
     length per language (French and German run long), so the bar measures
     its own row: too wide → the links close up (nav-snug); still too wide →
     the compact bar (html.nav-tight: links in the menu button, language and
     Download kept), the same layout CSS gives every screen under 1000px. */
  function fitNav() {
    var html = document.documentElement, nav = $("#nav"), bar = $("#nav .bar"), links = $("#navLinks");
    if (!nav || !bar || !links) return;
    html.classList.remove("nav-tight"); nav.classList.remove("nav-snug");
    if (getComputedStyle(links).display === "none") return;      // already compact by width
    function fits() {
      var cs = getComputedStyle(bar), gap = parseFloat(cs.columnGap) || 0, used = 0, n = 0;
      [].forEach.call(bar.children, function (c) {
        if (!c.offsetWidth) return;
        used += c === links ? links.scrollWidth : c.offsetWidth; n++;
      });
      used += gap * (n - 1) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      return used <= bar.clientWidth + 0.5;
    }
    if (fits()) return;
    nav.classList.add("nav-snug");
    if (fits()) return;
    nav.classList.remove("nav-snug");
    html.classList.add("nav-tight");
  }
  function initFitNav() {
    fitNav();
    var pending = false;
    window.addEventListener("resize", function () {
      if (pending) return; pending = true;
      requestAnimationFrame(function () { pending = false; fitNav(); });
    });
    /* the web font changes every width once it arrives */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitNav);
  }

  function initMenu() {
    var btn = $("#menuBtn"), menu = $("#mobileMenu");
    if (!btn || !menu) return;
    var open = false;
    function set(v) {
      open = v;
      menu.dataset.open = v ? "true" : "false";
      btn.setAttribute("aria-expanded", v ? "true" : "false");
    }
    set(false);
    btn.addEventListener("click", function () { set(!open); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) { set(false); btn.focus(); } });
    document.addEventListener("click", function (e) {
      if (open && !menu.contains(e.target) && !btn.contains(e.target)) set(false);
    });
  }

  /* nav shrinks + frosts once the page scrolls; section link marks itself */
  function initNavState() {
    var nav = $("#nav");
    var ids = HOME ? C.nav.map(function (n) { return n.href; })
                          .filter(function (h) { return h.charAt(0) === "#"; }) : [];
    var ticking = false;
    function update() {
      ticking = false;
      nav.classList.toggle("scrolled", window.scrollY > 12);
      var y = window.scrollY + 140, cur = "";
      ids.forEach(function (id) {
        var el = document.querySelector(id);
        if (el && el.offsetTop <= y) cur = id;
      });
      if (!ids.length) return;
      $$("#navLinks a").forEach(function (a) {
        if (a.getAttribute("aria-current") === "page") return;
        a.setAttribute("aria-current", a.getAttribute("href") === cur ? "true" : "false");
      });
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ── social — a link with an empty url is not rendered at all ─────────── */
  function buildSocial() {
    var live = C.social.filter(function (s) { return s.url; });
    $$("[data-social]").forEach(function (host) {
      host.innerHTML = live.map(function (s) {
        return '<a href="' + s.url + '" target="_blank" rel="noopener noreferrer" ' +
               'data-ev="social_link_clicked" data-ev-kind="' + s.key + '" ' +
               'title="' + T("BE Mastery on {network}").replace("{network}", s.label) + '" aria-label="' +
               T("BE Mastery on {network}").replace("{network}", s.label) +
               T(" (opens in a new tab)") + '">' + svg(ICON[s.key]) + '</a>';
      }).join("");
    });
  }

  /* ── footer columns ──────────────────────────────────────────────────── */
  function buildFooter() {
    var host = $("#footerCols");
    if (!host) return;
    host.innerHTML = C.footer.map(function (col) {
      var links = col.links.filter(function (l) {
        /* a store link is rendered only while that store is actually live */
        if (!l.store) return true;
        var st = C.stores[l.store];
        return st && st.status === "live" && st.url;
      });
      return '<nav class="f-col" aria-label="' + col.title + '"><h4>' + col.title + '</h4>' +
        links.map(function (l) {
          var ext = /^https?:/.test(l.href) && l.href.indexOf("app.lomonec.com") === -1 &&
                    l.href.indexOf("#") !== 0;
          return '<a href="' + href(l.href) + '"' +
                 (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + '>' + l.label + '</a>';
        }).join("") + '</nav>';
    }).join("");
  }

  /* ── real Play figures, only when supplied ───────────────────────────── */
  function applyStats() {
    var s = C.stats || {};
    if (s.rating) {
      var pill = $("#heroPill");
      if (pill) pill.innerHTML = '<span class="dot"></span>' + T("{rating} on Google Play").replace("{rating}", s.rating);
    }
    if (s.downloads && s.learners) {
      var set = function (k, n, l) {
        var a = $('[data-n="' + k + '"]'), b = $('[data-l="' + k + '"]');
        if (a) a.textContent = n; if (b) b.textContent = l;
      };
      set("a", s.downloads, T("Downloads"));
      set("b", s.rating || "—", T("Google Play rating"));
      set("c", s.learners, T("Active learners"));
    }
  }

  /* ── hero: waveform + pipeline, both driven by the shared frame ──────── */
  function initSpeakingInterface() {
    var bars = $$("#wave i"), stages = $$("[data-stage-step]"), words = $$(".transcript w");
    if (!bars.length) return;
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {                              // a still, legible resting state
      bars.forEach(function (b, i) { b.style.setProperty("--h", (5 + (i % 5) * 3) + "px"); });
      stages.forEach(function (s, i) { s.dataset.on = i === 2 ? "true" : "false"; });
      words.forEach(function (w) { w.dataset.on = "true"; });
      return;
    }
    if (!window.MotionSystem) return;
    window.MotionSystem.onFrame(function (t, pulse) {
      for (var i = 0; i < bars.length; i++) {   // voice: quiet, with a lift on the pulse
        var h = 4 + (Math.sin(t * 5.5 + i * 0.7) * 0.5 + 0.5) * (9 + pulse * 13);
        bars[i].style.setProperty("--h", h.toFixed(1) + "px");
      }
      var step = Math.floor(t / 1.6) % stages.length;   // voice → transcript → analysis → feedback
      for (var j = 0; j < stages.length; j++) stages[j].dataset.on = (j === step) ? "true" : "false";
      var lead = Math.floor((t * 2.2) % (words.length + 5));
      for (var k = 0; k < words.length; k++) words[k].dataset.on = (k <= lead) ? "true" : "false";
    });
  }

  /* ── the loop: one step lit at a time, advanced by the shared clock ──── */
  function initLoopway() {
    var ways = $$("[data-way]");
    if (!ways.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.MotionSystem) {
      return;                                  // all steps stay equally legible
    }
    var section = document.getElementById("loop"), inView = false;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) {
        inView = e[0].isIntersecting;
        if (!inView) ways.forEach(function (w) { w.dataset.live = "false"; });
      }, { threshold: .25 }).observe(section);
    } else { inView = true; }
    window.MotionSystem.onFrame(function (t) {
      if (!inView) return;
      var i = Math.floor(t / 1.15) % ways.length;
      for (var k = 0; k < ways.length; k++) ways[k].dataset.live = (k === i) ? "true" : "false";
    });
  }

  /* ── progress: four rounds, each a little better than the last ───────── */
  function initRounds() {
    var tabs = $$("#roundTabs span"), chart = $("#chart");
    if (!chart || !tabs.length) return;
    /* illustrative shape only — stated as such in the caption under the chart */
    var ROUNDS = [
      { p:58, v:52, s:61, f:47 },
      { p:67, v:60, s:68, f:56 },
      { p:79, v:71, s:76, f:68 },
      { p:88, v:82, s:85, f:79 }
    ];
    var keys = ["p", "v", "s", "f"];
    function show(n) {
      var r = ROUNDS[n];
      keys.forEach(function (k) {
        var fill = chart.querySelector('[data-metric="' + k + '"]');
        var num  = chart.querySelector('[data-num="' + k + '"]');
        if (fill) fill.style.width = r[k] + "%";
        if (num)  num.textContent  = r[k];
      });
      tabs.forEach(function (t, i) { t.dataset.on = (i === n) ? "true" : "false"; });
    }
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { show(ROUNDS.length - 1); return; }   // show the outcome, no cycling

    var i = 0, timer = 0;
    function step() { show(i); i = (i + 1) % ROUNDS.length; }
    /* runs only while the section is on screen — no timer left behind */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) {
          if (!timer) { step(); timer = setInterval(step, 2200); }
        } else if (timer) { clearInterval(timer); timer = 0; }
      }, { threshold: .3 }).observe(chart);
    } else { show(ROUNDS.length - 1); }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && timer) { clearInterval(timer); timer = 0; }
    });
  }

  /* ── Shadow Studio frame: three pages, switched by the tabs beside it.
        While it is on screen it turns the pages itself; the first click hands
        control to the visitor for good. ─────────────────────────────────── */
  function initStudio() {
    var studio = $("[data-studio]"), tabs = $$("[data-studio-tab]");
    if (!studio || !tabs.length) return;
    var order = tabs.map(function (t) { return t.dataset.studioTab; });
    function show(name, focus) {
      studio.dataset.page = name;
      $$("[data-pane]", studio).forEach(function (p) { p.hidden = p.dataset.pane !== name; });
      tabs.forEach(function (t) {
        var on = t.dataset.studioTab === name;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
    }
    var timer = 0, manual = false;
    function stopAuto() { if (timer) { clearInterval(timer); timer = 0; } }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { manual = true; stopAuto(); show(t.dataset.studioTab); });
      t.addEventListener("keydown", function (e) {           // arrow keys move along the tab list
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault(); manual = true; stopAuto();
        show(order[(i + d + order.length) % order.length], true);
      });
    });
    show(order[0]);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    function next() {
      var i = order.indexOf(studio.dataset.page);
      show(order[(i + 1) % order.length]);
    }
    new IntersectionObserver(function (e) {
      if (e[0].isIntersecting && !manual) { if (!timer) timer = setInterval(next, 5200); }
      else stopAuto();
    }, { threshold: .45 }).observe(studio);
    document.addEventListener("visibilitychange", function () { if (document.hidden) stopAuto(); });
  }

  /* ── in-page links: every section lands just under the menu (owner,
     2026-09-28: "come close to the menu"). The browser's own jump uses one
     fixed scroll-padding, but the bar shrinks once the page scrolls and a
     split section centres its text against a taller picture — so landings
     varied from 19 to 60px. Here the target is the section's topmost visible
     content, measured with offsetTop (reveal transforms do not move it), and
     the bar is measured in its scrolled state. The CSS scroll-margin stays
     as the no-JS fallback. ──────────────────────────────────────────────── */
  function initAnchorJump() {
    var GAP = 14, nav = $("#nav"), jumpSeq = 0;
    function pageTop(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }
    function contentTop(sec) {
      var wrap = sec.querySelector(".wrap") || sec, best = Infinity;
      [].slice.call(wrap.children).forEach(function (c) {
        [c].concat([].slice.call(c.children)).forEach(function (e) {
          if (!e.offsetHeight) return;
          var t = pageTop(e);
          if (t < best) best = t;
        });
      });
      return best === Infinity ? pageTop(sec) : best;
    }
    function contentRect(sec) {
      var wrap = sec.querySelector(".wrap") || sec, best = Infinity;
      [].slice.call(wrap.children).forEach(function (c) {
        [c].concat([].slice.call(c.children)).forEach(function (e) {
          if (e.offsetHeight) best = Math.min(best, e.getBoundingClientRect().top);
        });
      });
      return best === Infinity ? sec.getBoundingClientRect().top : best;
    }
    function barBottom() {
      var bar = nav && (nav.querySelector(".bar") || nav);
      if (!bar) return 0;
      var had = nav.classList.contains("scrolled"), els = [nav, bar], tr = els.map(function (x) { return x.style.transition; });
      els.forEach(function (x) { x.style.transition = "none"; });   /* measure the end state, not a frame of the shrink */
      nav.classList.add("scrolled");
      var b = bar.getBoundingClientRect().bottom;
      if (!had) nav.classList.remove("scrolled");
      void bar.offsetHeight;
      els.forEach(function (x, i) { x.style.transition = tr[i]; });
      return b;
    }
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var sec = document.getElementById(id.slice(1));
      if (!sec || id === "#top") return;
      e.preventDefault();
      var y = Math.max(0, contentTop(sec) - barBottom() - GAP);
      var smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: y, behavior: smooth ? "smooth" : "auto" });
      if (history.pushState) history.pushState(null, "", id);
      /* then check where it really landed (the bar's shrink and late layout can
         move it a few px) and settle the difference */
      var token = ++jumpSeq, lastY = -1, still = 0, t0 = Date.now();
      (function watch() {
        if (token !== jumpSeq) return;                         /* a newer jump took over */
        var yNow = window.scrollY;
        still = (yNow === lastY) ? still + 1 : 0; lastY = yNow;
        if (still < 8 && Date.now() - t0 < 3000) { requestAnimationFrame(watch); return; }
        var bar = nav && (nav.querySelector(".bar") || nav);
        var d = contentRect(sec) - (bar ? bar.getBoundingClientRect().bottom : 0) - GAP;
        if (Math.abs(d) > 1) window.scrollBy({ top: d, behavior: "auto" });
      })();
    });
  }

  /* ── language switch: feel instant ─────────────────────────────────────
     Each language is its own page. To make the change feel like the words
     simply turn into another language:
     · press (pointerdown/hover/focus) a language → its page is prefetched,
       so the click usually finds it already downloaded;
     · click → remember the section on screen and how far through it the
       reader is (sessionStorage "be_lang_swap");
     · the new page (html.lang-swap, set by the inline head script) skips its
       entrance animation, returns to that spot at once, and the browser
       cross-fades (@view-transition in the CSS). */
  function langSwapAway() {
    var y = window.scrollY, best = null;
    [].forEach.call(document.querySelectorAll("main [id], section[id]"), function (el) {
      var t = el.getBoundingClientRect().top + y;
      if (t <= y + 1 && (!best || t >= best.t)) best = { id: el.id, t: t, h: el.offsetHeight || 1 };
    });
    try {
      sessionStorage.setItem("be_lang_swap", JSON.stringify(best ? { id: best.id, f: (y - best.t) / best.h } : { y: y }));
    } catch (e) {}
  }
  function langSwapArrive() {
    var raw = null;
    try { raw = sessionStorage.getItem("be_lang_swap"); sessionStorage.removeItem("be_lang_swap"); } catch (e) {}
    var html = document.documentElement;
    if (!raw) return;
    var at;
    try { at = JSON.parse(raw); } catch (e) { at = {}; }
    var el = at.id && document.getElementById(at.id);
    /* a scroll asked for while the page is still being laid out can be
       dropped, and pictures above may still change heights: place the
       reader now, on the next frame and at load — unless they have already
       started scrolling themselves */
    var moved = false;
    function stop() { moved = true; }
    ["wheel", "touchstart", "keydown"].forEach(function (t) { window.addEventListener(t, stop, { once: true, passive: true }); });
    function place() {
      if (moved) return;
      /* the same fraction of the same section: sections differ in height per language */
      var y = el ? el.getBoundingClientRect().top + window.scrollY + (at.f || 0) * el.offsetHeight : (at.y || 0);
      if (y <= 0) return;
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, y);
      html.style.scrollBehavior = "";
    }
    place();
    requestAnimationFrame(place);
    if (document.readyState === "complete") setTimeout(place, 0);
    else window.addEventListener("load", place, { once: true });
    /* entrance transitions come back for what the reader scrolls to next */
    setTimeout(function () { html.classList.remove("lang-swap-in"); }, 1200);
  }
  function initLang() {
    langSwapArrive();
    var fetched = {};
    [].forEach.call(document.querySelectorAll("[data-lang]"), function (d) {
      document.addEventListener("click", function (e) { if (d.open && !d.contains(e.target)) d.open = false; });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && d.open) { d.open = false; d.querySelector("summary").focus(); }
      });
      [].forEach.call(d.querySelectorAll(".lang-menu a"), function (a) {
        var href = a.getAttribute("href");
        function prefetch() {
          if (fetched[href] || a.getAttribute("aria-current") === "true") return;
          fetched[href] = 1;
          var l = document.createElement("link");
          l.rel = "prefetch"; l.href = href; l.as = "document";
          document.head.appendChild(l);
        }
        a.addEventListener("pointerdown", prefetch);
        a.addEventListener("mouseenter", prefetch);
        a.addEventListener("focus", prefetch);
        a.addEventListener("click", function (e) {
          if (a.getAttribute("aria-current") === "true") { e.preventDefault(); d.open = false; return; }
          langSwapAway();
        });
      });
    });
  }

  function init() {
    initLang();
    buildNav(); initFitNav(); initMenu(); initNavState(); initAnchorJump();
    buildStores(); buildStoreNote(); buildSocial(); buildFooter(); applyStats();
    if (window.MotionSystem) window.MotionSystem.init();
    initSpeakingInterface();
    initLoopway();
    initRounds();
    initStudio();
    var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
