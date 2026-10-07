/* lomonec.com — the company home page. Two jobs only: the year in the
   footer and the mobile menu. */
(function () {
  "use strict";
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  var btn = document.querySelector(".nav-toggle");
  var links = document.getElementById("navLinks");
  if (!btn || !links) return;
  function set(open) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    links.classList.toggle("open", open);
  }
  btn.addEventListener("click", function () {
    set(btn.getAttribute("aria-expanded") !== "true");
  });
  links.addEventListener("click", function (e) {
    if (e.target.closest("a")) set(false);
  });
})();
