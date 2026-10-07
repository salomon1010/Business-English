/* lomonec.com — the company home page. Four small jobs: the footer year,
   the fixed bar's scrolled state + current-section mark, the mobile menu,
   and the scroll-in reveal. */
(function () {
  "use strict";
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

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
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
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
