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

  /* ── icons ───────────────────────────────────────────────────────────── */
  var ICON = {
    youtube:'<path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8z"/><path d="M10 15V9l5 3z" fill="currentColor" stroke="none"/>',
    tiktok:'<path d="M15 3v9.6a3.4 3.4 0 1 1-2.6-3.3"/><path d="M15 3c.4 2.3 2 3.9 4.3 4.1"/>',
    instagram:'<rect x="3.5" y="3.5" width="17" height="17" rx="4.6"/><circle cx="12" cy="12" r="3.9"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>',
    linkedin:'<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V17M8 7.6v.1M11.7 17v-3.6a2.1 2.1 0 0 1 4.2 0V17"/>'
  };
  function svg(path, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
           (extra || '') + '>' + path + '</svg>';
  }

  /* ── navigation ──────────────────────────────────────────────────────── */
  function buildNav() {
    var links = $("#navLinks"), menu = $("#mobileMenu");
    if (links) {
      links.innerHTML = C.nav.map(function (n) {
        return '<a href="' + n.href + '">' + n.label + '</a>';
      }).join("");
    }
    if (menu) {
      menu.innerHTML =
        C.nav.map(function (n) { return '<a href="' + n.href + '">' + n.label + '</a>'; }).join("") +
        '<div class="sep"></div>' +
        '<a href="' + C.cta.signin.href + '">' + C.cta.signin.label + '</a>' +
        '<a class="btn btn-primary" href="' + C.cta.primary.href + '">' + C.cta.primary.label + '</a>';
    }
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
    var ids = C.nav.map(function (n) { return n.href; })
                   .filter(function (h) { return h.charAt(0) === "#"; });
    var ticking = false;
    function update() {
      ticking = false;
      nav.classList.toggle("scrolled", window.scrollY > 12);
      var y = window.scrollY + 140, cur = "";
      ids.forEach(function (id) {
        var el = document.querySelector(id);
        if (el && el.offsetTop <= y) cur = id;
      });
      $$("#navLinks a").forEach(function (a) {
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
               'title="BE Mastery on ' + s.label + '" aria-label="BE Mastery on ' + s.label +
               ' (opens in a new tab)">' + svg(ICON[s.key]) + '</a>';
      }).join("");
    });
  }

  /* ── footer columns ──────────────────────────────────────────────────── */
  function buildFooter() {
    var host = $("#footerCols");
    if (!host) return;
    host.innerHTML = C.footer.map(function (col) {
      return '<nav class="f-col" aria-label="' + col.title + '"><h4>' + col.title + '</h4>' +
        col.links.map(function (l) {
          var ext = /^https?:/.test(l.href) && l.href.indexOf("app.lomonec.com") === -1 &&
                    l.href.indexOf("#") !== 0;
          return '<a href="' + l.href + '"' +
                 (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + '>' + l.label + '</a>';
        }).join("") + '</nav>';
    }).join("");
  }

  /* ── real Play figures, only when supplied ───────────────────────────── */
  function applyStats() {
    var s = C.stats || {};
    if (s.rating) {
      var pill = $("#heroPill");
      if (pill) pill.innerHTML = '<span class="dot"></span>' + s.rating + ' on Google Play';
    }
    if (s.downloads && s.learners) {
      var set = function (k, n, l) {
        var a = $('[data-n="' + k + '"]'), b = $('[data-l="' + k + '"]');
        if (a) a.textContent = n; if (b) b.textContent = l;
      };
      set("a", s.downloads, "Downloads");
      set("b", s.rating || "—", "Google Play rating");
      set("c", s.learners, "Active learners");
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

  function init() {
    buildNav(); initMenu(); initNavState();
    buildSocial(); buildFooter(); applyStats();
    if (window.MotionSystem) window.MotionSystem.init();
    initSpeakingInterface();
    initLoopway();
    initRounds();
    var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
