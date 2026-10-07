/* lomonec.com — the company home page. Four small jobs: the footer year,
   the fixed bar's scrolled state + current-section mark, the mobile menu,
   and the scroll-in reveal. */
(function () {
  "use strict";
  var FR = document.documentElement.lang.indexOf("fr") === 0;
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

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
  initLang();

  /* fixed bar: frosted once the page moves; the link of the section in view lights up */
  var bar = document.getElementById("topbar");
  var navAs = [].slice.call(document.querySelectorAll('#navLinks a[href^="#"]:not(.nav-cta)'));
  var secs = navAs.map(function (a) { return document.querySelector(a.getAttribute("href")); });
  var ticking = false;
  function update() {
    ticking = false;
    if (bar) bar.classList.toggle("scrolled", window.scrollY > 10);
    var line = window.scrollY + 120, cur = -1;
    secs.forEach(function (s, i) { if (s && s.offsetTop <= line) cur = i; });
    navAs.forEach(function (a, i) { a.setAttribute("aria-current", i === cur ? "true" : "false"); });
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();

  /* mobile menu */
  var btn = document.querySelector(".nav-toggle");
  var links = document.getElementById("navLinks");
  if (btn && links) {
    var set = function (open) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? (FR ? "Fermer le menu" : "Close menu")
                                          : (FR ? "Ouvrir le menu" : "Open menu"));
      links.classList.toggle("open", open);
      if (open && bar) bar.classList.add("scrolled");
      else update();
    };
    btn.addEventListener("click", function () { set(btn.getAttribute("aria-expanded") !== "true"); });
    links.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { set(false); btn.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (links.classList.contains("open") && !links.contains(e.target) && !btn.contains(e.target)) set(false);
    });
  }

  /* reveal on scroll. Only what starts below the fold is hidden, so nothing
     visible on load ever blinks; without IntersectionObserver nothing hides. */
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var els = document.querySelectorAll(".section-title,.section-lede,.sub,.card,.pain,.flow>li,.facts>div,.cta .wrap>*");
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add("in");
      setTimeout(function () { en.target.style.transitionDelay = ""; }, 1200);
      io.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  var fold = window.innerHeight;
  [].forEach.call(els, function (el) {
    if (el.getBoundingClientRect().top < fold) return;
    /* siblings in a row come in one after another */
    var i = [].indexOf.call(el.parentNode.children, el);
    el.style.transitionDelay = Math.min(i, 5) * 70 + "ms";
    el.classList.add("rv");
    io.observe(el);
  });
})();
