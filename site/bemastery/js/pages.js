/* ───────────────────────────────────────────────────────────────────────────
   Team page, blog list and post bylines — rendered from js/team.js and
   js/blog.js. Loaded only by team.html and the pages under blog/.
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  var TEAM  = window.BEM_TEAM  || [];
  var POSTS = window.BEM_POSTS || [];
  var ROOT  = document.body.dataset.root || "";
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
              location.protocol === "file:";
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  /* a photo path in team.js is relative to the site root */
  function asset(p) { return /^(https?:|\/)/.test(p) ? p : ROOT + p; }
  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); })
               .join("").toUpperCase();
  }

  var LINK_ICON = {
    linkedin:'<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V17M8 7.6v.1M11.7 17v-3.6a2.1 2.1 0 0 1 4.2 0V17"/>',
    website:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    youtube:'<path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8z"/><path d="M10 15V9l5 3z" fill="currentColor" stroke="none"/>',
    email:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>'
  };
  var LINK_LABEL = { linkedin:"LinkedIn", website:"Website", youtube:"YouTube", email:"Email" };

  function svg(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  function portrait(p, cls) {
    return p.photo
      ? '<img class="' + cls + '" src="' + esc(asset(p.photo)) + '" alt="' + esc(p.name) +
        '" loading="lazy" width="600" height="600">'
      : '<span class="' + cls + ' mono" aria-hidden="true">' + esc(initials(p.name) || "?") + '</span>';
  }

  /* ── team ────────────────────────────────────────────────────────────── */
  function personCard(p, i) {
    var links = Object.keys(p.links || {}).filter(function (k) { return p.links[k] && LINK_ICON[k]; })
      .map(function (k) {
        var v = p.links[k], href = k === "email" && v.indexOf("mailto:") !== 0 ? "mailto:" + v : v;
        var ext = k !== "email";
        return '<a href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") +
               ' aria-label="' + esc(p.name + " — " + LINK_LABEL[k]) + (ext ? " (opens in a new tab)" : "") +
               '">' + svg(LINK_ICON[k]) + '</a>';
      }).join("");
    return '<article class="person glass" data-reveal data-reveal-delay="' + (i % 3) * 90 + '">' +
             '<div class="ph">' + portrait(p, "ph-img") + '</div>' +
             '<div class="pb">' +
               '<h3>' + esc(p.name) + '</h3>' +
               '<p class="role">' + esc(p.role) + '</p>' +
               (p.bio ? '<p class="bio">' + esc(p.bio) + '</p>' : "") +
               (links ? '<div class="plinks">' + links + '</div>' : "") +
             '</div>' +
           '</article>';
  }
  /* local only: shows where an unnamed entry will appear, never on the live site */
  function draftCard(p) {
    return '<article class="person draft" data-reveal>' +
             '<div class="ph"><span class="ph-img mono" aria-hidden="true">+</span></div>' +
             '<div class="pb"><h3>Add a name</h3>' +
             '<p class="role">' + esc(p.role || p.id) + '</p>' +
             '<p class="bio">Fill in <code>name</code> and <code>photo</code> for “' + esc(p.id) +
             '” in <code>js/team.js</code>. Only visible on localhost.</p></div>' +
           '</article>';
  }
  function buildTeam() {
    $$("[data-team]").forEach(function (host) {
      var group = host.dataset.team;
      var people = TEAM.filter(function (p) { return (p.group || "core") === group; });
      var named  = people.filter(function (p) { return p.name && p.name.trim(); });
      var html   = named.map(personCard);
      if (LOCAL) html = html.concat(people.filter(function (p) { return !named.includes(p); }).map(draftCard));
      host.innerHTML = html.join("");
      /* a group with nobody in it hides its whole section */
      var sec = host.closest("[data-team-section]");
      if (sec) sec.hidden = !html.length;
    });
  }

  /* ── blog ────────────────────────────────────────────────────────────── */
  var TEAM_AUTHOR = { name:"BE Mastery Team", role:"", photo:"img/logo.svg", team:true };
  function author(id) {
    var p = TEAM.filter(function (m) { return m.id === id && m.name && m.name.trim(); })[0];
    return p || TEAM_AUTHOR;
  }
  function fmtDate(d) {
    var t = new Date(d + "T12:00:00");
    return isNaN(t) ? d : t.toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });
  }
  function byline(a, date, minutes) {
    return '<div class="byline">' + portrait(a, "av" + (a.team ? " logo" : "")) +
             '<div><b>' + esc(a.name) + '</b>' +
             '<span>' + (date ? '<time datetime="' + esc(date) + '">' + fmtDate(date) + '</time>' : "") +
             (minutes ? '<i aria-hidden="true">·</i>' + minutes + ' min read' : "") + '</span></div>' +
           '</div>';
  }
  function buildPosts() {
    var host = document.querySelector("[data-posts]");
    if (!host) return;
    var today = new Date().toISOString().slice(0, 10);
    var list = POSTS.filter(function (p) { return p.slug && p.title && p.date <= today; })
                    .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var empty = document.querySelector("[data-posts-empty]");
    if (empty) empty.hidden = list.length > 0;
    host.innerHTML = list.map(function (p, i) {
      var href = ROOT + "blog/" + encodeURIComponent(p.slug) + ".html";
      return '<article class="post-card glass card" data-reveal data-reveal-delay="' + (i % 3) * 90 + '">' +
               (p.category ? '<span class="cat">' + esc(p.category) + '</span>' : "") +
               '<h3><a href="' + href + '">' + esc(p.title) + '</a></h3>' +
               (p.summary ? '<p>' + esc(p.summary) + '</p>' : "") +
               byline(author(p.author), p.date, p.minutes) +
               '<a class="more" href="' + href + '" tabindex="-1" aria-hidden="true">Read the guide ' +
                 svg('<path d="M5 12h14M13 6l6 6-6 6"/>') + '</a>' +
             '</article>';
    }).join("");
  }
  /* on a post page: <div data-byline data-author="founder" data-date="…" data-minutes="7"> */
  function buildBylines() {
    $$("[data-byline]").forEach(function (el) {
      el.innerHTML = byline(author(el.dataset.author), el.dataset.date, el.dataset.minutes);
    });
  }

  buildTeam(); buildPosts(); buildBylines();
})();
