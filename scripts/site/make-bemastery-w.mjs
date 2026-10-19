/* ───────────────────────────────────────────────────────────────────────────
   site/bemastery-w/index.html  —  BUILT, NOT HAND-WRITTEN.

   The sibling of make-bemastery-g.mjs, and the same rule: one app, one page.
   This one forks /bemastery/ and makes it the WELDING page — the same shell,
   the same stylesheets and scripts, so the same animations (the hero stage,
   the drifting feature strip, the Shadow Studio that turns its own pages, the
   reveal-on-scroll) — with the General English half taken out and the trade
   content put in its place.

       node scripts/site/make-bemastery-w.mjs

   WHAT MUST STAY TRUE HERE. Practice Partner is General English only
   (ppAvailable() requires isGeneralEnglish(), and the Welding store listing
   says so in as many words), so it is removed, not reworded. Every figure on
   the page is counted from this repository, not estimated:

       84 guided sessions   tracks/welding/weeks.json — 12 weeks × 7 day templates
       12 stages            the same file
       10 refinery trades   catalogue/welding.json categories
       534 video clips      catalogue/welding.json videos
       250 trade words      tracks/welding/mastery.json terms
       52 drawings          tracks/welding/mastery-art.json
       15 languages         i18n/

   This app is LIVE on Google Play — com.lomonec.bemastery.welding, 1.0.0,
   listing verified public 19 Oct 2026 — so the Android badge is a real link
   and the page carries its own al:android metadata. The App Store listing is
   still in review, so that badge stays an honest "coming soon" and no Apple
   URL appears anywhere on the page.
   Re-run the script when /bemastery/ changes; every cut asserts that it
   matched, and the guard at the end refuses to write a page that still names
   the other app or any General-English-only feature.
   ─────────────────────────────────────────────────────────────────────────── */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* The Welding app's own store identity. It is deliberately NOT in
   site/bemastery/js/config.js: that file is the OTHER app's config, shared
   with /bemastery/ and its sixteen translations. This page is the only thing
   that may name this package, so the package is named here, once. */
const W_PKG  = "com.lomonec.bemastery.welding";
const W_PLAY = `https://play.google.com/store/apps/details?id=${W_PKG}`;

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../../site/bemastery/index.html");
const OUT = resolve(here, "../../site/bemastery-w/index.html");

let h = readFileSync(SRC, "utf8");
const steps = [];

const sub = (what, from, to, count = 1) => {
  const parts = h.split(from);
  if (parts.length - 1 !== count) throw new Error(`replace "${what}": matched ${parts.length - 1}×, expected ${count}×`);
  h = parts.join(to);
  steps.push(`edit ${what}`);
};
const cutBefore = (what, from, to) => {
  const i = h.indexOf(from), j = h.indexOf(to, i);
  if (i < 0) throw new Error(`cut "${what}": the opening text is gone — ${from.slice(0, 60)}`);
  if (j < 0) throw new Error(`cut "${what}": the closing text is gone — ${to.slice(0, 60)}`);
  h = h.slice(0, i) + h.slice(j);
  steps.push(`cut  ${what} (${j - i} chars)`);
};
/* Rewrite one section in place, so a replacement cannot escape into another. */
const section = (id, fn) => {
  const open = h.indexOf(`id="${id}"`);
  if (open < 0) throw new Error(`section #${id} is gone`);
  const start = h.lastIndexOf("<section", open);
  const end = h.indexOf("\n</section>", start) + "\n</section>".length;
  const before = h.slice(start, end);
  const after = fn(before);
  if (after === before) throw new Error(`section #${id}: nothing changed`);
  h = h.slice(0, start) + after + h.slice(end);
  steps.push(`edit section #${id}`);
};
const one = (hay, what, from, to) => {
  const parts = hay.split(from);
  if (parts.length - 1 !== 1) throw new Error(`${what}: matched ${parts.length - 1}×, expected 1×`);
  return parts.join(to);
};

/* ── the shots this page shows, all of them already in the repository ──── */
const shot = (img, w, hh, alt, title, sub_, delay) =>
  `<figure class="shot" data-reveal${delay ? ` data-reveal-delay="${delay}"` : ""}><div class="shot-phone">` +
  `<img src="/bemastery/img/welding/${img}" width="${w}" height="${hh}" alt="${alt}" loading="lazy"></div>` +
  `<figcaption><b>${title}</b><span>${sub_}</span></figcaption></figure>`;

const WELD_SHOTS =
  shot("01-roadmap.webp", 660, 1434, "BE Mastery Welding: the 12-stage road map, Stage 1 Entering the Workshop", "The road map", "Twelve stages, workshop to interview", 0) +
  shot("02-practice.webp", 660, 1434, "BE Mastery Welding: Practice, with the best tool for today's step", "Practice", "The best tool for today's step, first", 60) +
  shot("03-lines.webp", 660, 1434, "BE Mastery Welding: workplace lines to shadow, spoken by the recruiter and the supervisor", "Workplace lines", "Hear the line, say it back, get a report", 120) +
  shot("04-simulation.webp", 660, 1434, "BE Mastery Welding: workplace simulations, from the first day to the shift handover", "Workplace simulations", "First day, handover, permit, safety stop", 180) +
  shot("05-career.webp", 660, 1434, "BE Mastery Welding: career destination, readiness and the interview coaches", "Career and interviews", "Your destination, readiness and coaches", 240) +
  shot("06-progress.webp", 660, 1434, "BE Mastery Welding: progress for the welding programme", "Your own progress", "Streak, calendar and every report kept", 300);

/* ── 1. the page's own address and what it says it is ─────────────────── */
sub("canonical", '<link rel="canonical" href="https://lomonec.com/bemastery/">',
                 '<link rel="canonical" href="https://lomonec.com/bemastery-w/">');
sub("og:url", '<meta property="og:url" content="https://lomonec.com/bemastery/">',
              '<meta property="og:url" content="https://lomonec.com/bemastery-w/">');
sub("title", "<title>BE Mastery — AI English Speaking Practice</title>",
             "<title>BE Mastery Welding — English for the refinery trades</title>");
sub("description", '<meta name="description" content="Practise English speaking with AI, shadow real speakers and practise with real learners. BE Mastery is a 25-minutes-a-day speaking app — free on Google Play, and soon on the App Store.">',
  '<meta name="description" content="English for welders, pipefitters, boilermakers and the eight other refinery trades: shadow real workshop video, rehearse the toolbox talk and sit the interview before it counts. Twenty-five minutes a day.">');
sub("og:site_name", '<meta property="og:site_name" content="BE Mastery">',
                    '<meta property="og:site_name" content="BE Mastery Welding">');
sub("og:title", '<meta property="og:title" content="BE Mastery — AI English Speaking Practice">',
                '<meta property="og:title" content="BE Mastery Welding — English for the refinery trades">');
sub("og:description", '<meta property="og:description" content="Practise with AI. Shadow real speakers. Practise with real people. Download the BE Mastery speaking app — free on Google Play, and soon on the App Store.">',
  '<meta property="og:description" content="You already know the work. This is where you learn to say it: the floor, the toolbox talk and the interview, in English.">');
sub("og:image", '<meta property="og:image" content="https://app.lomonec.com/og.png">',
                '<meta property="og:image" content="https://lomonec.com/bemastery/img/welding/01-roadmap.webp">');
sub("og:image dims", '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n',
                     '<meta property="og:image:width" content="660">\n<meta property="og:image:height" content="1434">\n');
sub("og:image:alt", '<meta property="og:image:alt" content="BE Mastery — a speaking practice session shown on a phone">',
                    '<meta property="og:image:alt" content="BE Mastery Welding — the twelve-stage road map shown on a phone">');
sub("twitter:title", '<meta name="twitter:title" content="BE Mastery — AI English Speaking Practice">',
                     '<meta name="twitter:title" content="BE Mastery Welding — English for the refinery trades">');
sub("twitter:description", '<meta name="twitter:description" content="Practise with AI. Shadow real speakers. Practise with real people. Free on Google Play, and soon on the App Store.">',
  '<meta name="twitter:description" content="English for welders, pipefitters, boilermakers and the eight other refinery trades. Twenty-five minutes a day.">');
sub("twitter:image", '<meta name="twitter:image" content="https://app.lomonec.com/og.png">',
                     '<meta name="twitter:image" content="https://lomonec.com/bemastery/img/welding/01-roadmap.webp">');

/* no translations of this page exist yet, so it claims none */
cutBefore("hreflang alternates", "<!-- i18n:alternates -->", '<meta name="theme-color"');
cutBefore("language picker", "        <!-- Language: a real link per page", "        <a class=\"btn btn-primary btn-sm\" href=\"#download\"");

/* ── 2. store metadata: this app's Play listing, and no Apple one ──────── */
cutBefore("the app-link metadata", "<!-- App links for Google Play only.", '<link rel="icon"');
/* The approved Welding logo (owner, 13 Oct 2026). branding/welding/README.md
   is the source: logo-master.png → icon-192.png, copied to the site as
   img/welding/logo-192.png. The General English logo stays on /bemastery/. */
sub("the icon links",
  '<link rel="icon" type="image/svg+xml" href="img/logo.svg">\n<link rel="apple-touch-icon" href="img/icon-192.png">',
  `<!-- App links. Google Play only: this app's App Store listing is still in
     review, so there is no apple-itunes-app banner and no al:ios URL to
     follow — Safari would open a 404. Add them the day Apple approves it. -->
<meta property="al:android:url" content="${W_PLAY}">
<meta property="al:android:package" content="${W_PKG}">
<meta property="al:android:app_name" content="BE Mastery Welding">
<link rel="icon" type="image/png" sizes="192x192" href="/bemastery/img/welding/logo-192.png">
<link rel="apple-touch-icon" href="/bemastery/img/welding/logo-192.png">`);

sub("a note in their place", '<!-- Structured data: Google Play only, for the same reason as above. -->',
  '<!-- Structured data: this app claims its Play listing only. The App Store\n     listing is in review, so no Apple URL is claimed. -->');

/* the structured record describes THIS app, and claims no store page */
sub("JSON-LD name", '"name":"BE Mastery","alternateName":"Business English Mastery"',
                    '"name":"BE Mastery Welding","alternateName":"BE Mastery for the refinery trades"');
/* the browser link under the stores points at THIS app's own web app
   (docs/WEB-STANDALONE.md): one programme per address, like the store app. */
sub("the web app link", 'href="https://app.lomonec.com/bemastery/">use it in your browser',
                        'href="https://app.lomonec.com/welding-english/">use it in your browser');
sub("JSON-LD url", '"url":"https://lomonec.com/bemastery/"', '"url":"https://lomonec.com/bemastery-w/"');
sub("JSON-LD store urls", '"installUrl":["https://play.google.com/store/apps/details?id=com.bemastery.app"],"downloadUrl":["https://play.google.com/store/apps/details?id=com.bemastery.app"],',
  `"installUrl":"${W_PLAY}","downloadUrl":"${W_PLAY}",`);

/* ── 3. one directory out: assets keep their absolute shared paths ─────── */
sub("body attributes", "<body>", '<body data-root="/bemastery/">');
/* the wordmark in the header names this app */
sub("the brand mark", '<img src="img/logo.svg" alt="" width="29" height="29">',
                     '<img src="/bemastery/img/welding/logo-192.png" alt="" width="29" height="29">', 2);  /* header and footer */
sub("the brand wordmark", 'BE&nbsp;<span class="grad">Mastery</span></a>',
                          'BE&nbsp;<span class="grad">Mastery</span>&nbsp;Welding</a>', 2);  /* header and footer */
const beforePaths = h;
h = h.replace(/(src|href|poster)="(img|css|js)\//g, '$1="/bemastery/$2/');
if (h === beforePaths) throw new Error("no relative asset path was re-pointed");
steps.push("edit asset paths → /bemastery/");

/* ── 4. the shared nav, footer and store badges ────────────────────────── */
sub("nav/footer/store override", '<script src="/bemastery/js/analytics.js',
  `<!-- This page is the Welding app. js/config.js is shared with /bemastery/
     and its sixteen translations, so it is not edited: the entries that belong
     to the other app are dropped here, after config.js has run and before the
     deferred app.js renders anything.
     The stores: Google Play is this app's own listing, the App Store one is
     still in review. app.js renders a badge as a link only while
     status === "live" and a url is set, and buildStoreNote() reads the same
     two fields, so setting them is all it takes. -->
<script>
(function () {
  var C = window.BEM; if (!C) return;
  var GE_ONLY = /general english|practice partner|welding/i;   /* "Welding" is the whole page here, so its nav entry is redundant */
  var keep = function (list) {
    return (list || []).filter(function (x) {
      return !GE_ONLY.test(x.label || "") && !GE_ONLY.test(x.href || "") && x.href !== "#paths" && x.href !== "#partner";
    });
  };
  C.nav = keep(C.nav);
  (C.footer || []).forEach(function (g) { g.links = keep(g.links); });
  C.play = "${W_PLAY}";
  C.stores.android.url = C.play; C.stores.android.status = "live";
  C.stores.ios.url = "";         C.stores.ios.status = "coming_soon";
  /* buildFooter() renders the Download column from each link's own href, not
     from C.stores, so the Android row has to be re-pointed as well or the
     footer would send a Welding reader to the other app's listing. */
  (C.footer || []).forEach(function (g) {
    (g.links || []).forEach(function (l) { if (l.store === "android") l.href = C.play; });
  });
})();
</script>
<script src="/bemastery/js/analytics.js`);

/* ── 5. the hero ───────────────────────────────────────────────────────── */
section("hero", s => {
  s = one(s, "hero pill", '<span class="label" id="heroPill"><span class="dot"></span>AI + human speaking practice</span>',
                          '<span class="label" id="heroPill"><span class="dot"></span>For the refinery trades</span>');
  s = one(s, "hero headline", `<span class="line"><span>Speak English</span></span>
        <span class="line"><span>like you belong</span></span>
        <span class="line"><span class="grad">in the room.</span></span>`,
    `<span class="line"><span>You already</span></span>
        <span class="line"><span>know the work.</span></span>
        <span class="line"><span class="grad">Now say it.</span></span>`);
  s = one(s, "hero lede", "Practise with AI. Shadow real speakers. Practise with real people. Build the confidence for real conversations.",
    "English for welders, pipefitters, boilermakers and the eight other refinery trades — the words you actually use on the floor, in the toolbox talk and in the interview.");
  s = one(s, "hero kicker", "<p class=\"cta-kicker\">Download BE Mastery</p>", "<p class=\"cta-kicker\">BE Mastery Welding</p>");
  s = one(s, "hero fine print", "Free on Android, iPhone coming soon · Sign in with Apple, Google or email · Your progress follows you between phones · Guidance in 15 languages.",
    "Free on Google Play, iPhone coming soon · Sign in with Apple, Google or email · Your progress follows you between phones · Guidance in 15 languages.");
  s = one(s, "hero chips", `<span class="chip"><b>84</b> guided sessions</span>
        <span class="chip"><b>12</b> weeks</span>
        <span class="chip"><b>152</b> phrases</span>
        <span class="chip"><b>25</b> min a day</span>`,
    `<span class="chip"><b>84</b> guided sessions</span>
        <span class="chip"><b>12</b> stages</span>
        <span class="chip"><b>250</b> trade words</span>
        <span class="chip"><b>25</b> min a day</span>`);
  s = one(s, "hero float: the partner card", '<span class="fc"><span class="ft">Practice Partner</span><span class="fv">Match found</span></span>',
                                             '<span class="fc"><span class="ft">Workplace lines</span><span class="fv">Ready to shadow</span></span>');
  s = one(s, "hero phone", '<img src="/bemastery/img/phone-session.webp" width="540" height="1200" alt="The BE Mastery app: today\'s session — the 25-minute practice timer, the phrases to say aloud and the recorder" fetchpriority="high">',
    '<img src="/bemastery/img/welding/01-roadmap.webp" width="660" height="1434" alt="BE Mastery Welding: the twelve-stage road map, Stage 1 Entering the Workshop" fetchpriority="high">');
  return s;
});

/* ── 6. the drifting strip ─────────────────────────────────────────────── */
const MQ = ["Daily 25-minute sessions", "AI speaking report", "Shadowing Studio", "534 trade video clips",
            "Translate &amp; IPA", "Challenge ladder", "Workplace lines", "Workshop simulations",
            "Interview coaches", "Welding Mastery", "250 trade words", "10 refinery trades",
            "Home-screen widgets", "Sign in with Apple", "15 languages"]
  .map(x => `<span class="mq-i"><i aria-hidden="true"></i>${x}</span>`).join("");
h = h.replace(/<div class="mq-track">[\s\S]*?<\/div>/, `<div class="mq-track">${MQ}${MQ}</div>`);
steps.push("edit the feature strip");

/* ── 7. the screens strip ──────────────────────────────────────────────── */
section("screens", s => {
  s = one(s, "screens label", '<span class="dot"></span>Inside BE Mastery</span>', '<span class="dot"></span>Inside BE Mastery Welding</span>');
  return s.replace(/<div class="shots" data-shots>[\s\S]*?<\/div>\n/, `<div class="shots" data-shots>${WELD_SHOTS}</div>\n`);
});

/* ── 8. the problem, in the workshop ───────────────────────────────────── */
section("problem", s => one(s, "problem copy",
  "You read it fine. You follow the meeting. Then it's your turn, and the sentence you had ready arrives a beat too late — so you say the shorter, smaller version instead.",
  "You can read the drawing, run the machine and spot the defect. Then the supervisor asks what happened on the night shift, and the sentence you had ready arrives a beat too late — so you say the shorter, smaller version instead."));

/* ── 9. the method ─────────────────────────────────────────────────────── */
section("method", s => one(s, "method lede", "One guided session a day for twelve weeks, in four short steps.",
                                             "One guided session a day through twelve stages, in four short steps."));

/* ── 10. inside the app: the Welding tools ─────────────────────────────── */
section("inside", s => {
  s = one(s, "inside lede", "Open the app and your page is already waiting: today's session first, then the practice that fits it.",
                            "Open the app and your page is already waiting: today's session first, then the practice that fits it. Pick your profession and the scenarios, the vocabulary and the model answers change with you.");
  /* The six cards are the ones the Welding section of /bemastery/ already
     carries — copy that has been through the owner and the store listings —
     each with its own drawing from img/inside/welding-*. */
  const cards = [
    ["convo", "Workplace simulations", "Talk it through before the shift — the handover, the permit, the safety stop, the first day in a new workshop.", 400],
    ["vocab", "Trade vocabulary", "Torch, arc, root pass, weld bead: the words of your trade, heard and said in real sentences.", 401],
    ["grammar", "Grammar for the job", "Short drills built from workshop sentences — the grammar you need to report, ask and confirm.", 400],
    ["phrases", "Your words", "Every word you trip on comes back with its sound and meaning until it sticks.", 401],
    ["roadmap", "Road map", "Twelve stages, from your first day in the workshop to the hiring interview. You always know the next step.", 400],
    ["progress", "Career readiness", "See how completely you explain your work in English, measured against your trade's expectations.", 400]
  ].map(([img, t, p, hh], i) => `<article class="in-card glass" data-reveal${i % 3 ? ` data-reveal-delay="${(i % 3) * 60}"` : ""}>` +
      `<img src="/bemastery/img/inside/welding-${img}.webp" alt="" width="640" height="${hh}" loading="lazy">` +
      `<div><h3>${t}</h3><p>${p}</p></div></article>`).join("\n      ");
  const a = s.indexOf('<div class="inside">'), b = s.indexOf("</div>\n    <p class=\"mini-cta center\"", a);
  if (a < 0 || b < 0) throw new Error("inside: the card grid is gone");
  return s.slice(0, a) + '<div class="inside">\n      ' + cards + "\n    " + s.slice(b);
});

/* ── 11. Shadow Studio, on trade video ─────────────────────────────────── */
section("shadow", s => {
  s = one(s, "shadow lede", "Pick a real talk, interview or lesson. Watch it with the words lighting up, shadow it one paragraph at a time, then say it without looking. When you do, it's yours.",
    "Five hundred and thirty-four hand-checked clips from your own trade, each with a synchronised transcript. Watch one with the words lighting up, shadow it a paragraph at a time, then say it without looking. When you do, it's yours.");
  s = one(s, "studio title", '<span class="st-title">Give a clear update in the stand-up</span>',
                             '<span class="st-title">Report a near miss on the floor</span>');
  s = one(s, "watch pane", `<p class="transcript"><w>I</w> <w>want</w> <w>to</w> <w>make</w> <w>sure</w> <w>we</w> <w>are</w> <w>aligned</w> <w>before</w> <w>we</w> <w>commit</w> <w>to</w> <w>the</w> <w>deadline.</w></p>`,
    `<p class="transcript"><w>I</w> <w>stopped</w> <w>the</w> <w>job</w> <w>because</w> <w>the</w> <w>gas</w> <w>line</w> <w>was</w> <w>leaking.</w></p>`);
  s = one(s, "watch pane, the dim lines", "So here is where we are. The design is finished, and testing starts on Monday.",
    "I told the supervisor straight away and we tagged the valve.");
  s = one(s, "watch pane, the second dim line", "The one risk is the supplier, and I will know more by Thursday.",
    "Nobody was hurt, and the permit is on hold until it has been checked.");
  s = one(s, "shadow chips", `<span>I</span><span>want</span><span>to</span><span>make</span><span>sure</span><span>we</span><span>are</span><span class="hot">aligned</span><span>before</span><span>we</span><span>commit</span>`,
    `<span>I</span><span>stopped</span><span>the</span><span>job</span><span>because</span><span>the</span><span>gas</span><span>line</span><span>was</span><span class="hot">leaking.</span>`);
  s = one(s, "shadow translation", `<p class="st-tr" lang="fr">Je veux m'assurer que nous sommes d'accord avant de nous engager sur l'échéance.</p>`,
    `<p class="st-tr" lang="fr">J'ai arrêté le travail parce que la conduite de gaz fuyait.</p>`);
  s = one(s, "shadow IPA", `<p class="st-ipa">/aɪ wɑnt tə meɪk ʃʊr wi ɑr əˈlaɪnd bɪˈfɔr wi kəˈmɪt tə ðə ˈdɛdˌlaɪn/</p>`,
    `<p class="st-ipa">/aɪ stɑpt ðə dʒɑb bɪˈkɔz ðə ɡæs laɪn wəz ˈlikɪŋ/</p>`);
  s = one(s, "challenge blanks", `<div class="st-card st-blanks">I want to make sure we are <u>&nbsp;</u> before we <u>&nbsp;</u> to the deadline.</div>`,
    `<div class="st-card st-blanks">I <u>&nbsp;</u> the job because the gas line was <u>&nbsp;</u>.</div>`);
  s = one(s, "challenge picks", `<div class="st-picks"><span>aligned</span><span>agreed</span><span>commit</span><span>common</span></div>`,
    `<div class="st-picks"><span>stopped</span><span>started</span><span>leaking</span><span>leaning</span></div>`);
  s = one(s, "the library card", "Hundreds of real videos, sorted for work.", "Five hundred clips, sorted by trade.");
  s = one(s, "the studio footnote", "The library, Watch, Shadow and Challenge are part of General English.",
    "The library, Watch, Shadow and Challenge are in this app, on trade video.");
  /* the three cards under the studio: the library mock and the one word the
     report picks are both still the General English example */
  s = one(s, "library filters", '<div class="lib-chips"><span class="on">For you</span><span>Meetings</span><span>Presentations</span><span>Interviews</span><span>Everyday</span></div>',
    '<div class="lib-chips"><span class="on">For you</span><span>Welder</span><span>Pipefitter</span><span>HSE</span><span>QA/QC</span></div>');
  s = one(s, "library row 1", "<b>This week · Week 1</b><i>Fits your plan</i>", "<b>This stage · Stage 1</b><i>Fits your plan</i>");
  s = one(s, "library row 2", "<b>Meetings · 11 min</b>", "<b>Toolbox talk · 11 min</b>");
  s = one(s, "library note", "Search by topic, or take the pick for this week of your plan. Any video link works too.",
    "Search by trade, or take the pick for this stage of your plan. Any video link works too.");
  s = one(s, "the focus word", "<b>aligned</b><em>/əˈlaɪnd/</em>", "<b>leaking</b><em>/ˈlikɪŋ/</em>");
  return s;
});

/* ── 12. the speaking report ───────────────────────────────────────────── */
section("coach", s => {
  s = one(s, "report: what you said", "I am responsible <s>of</s> managing the team, and <s>we are finishing</s> the tests since Monday.",
    "I am responsible <s>of</s> running the night shift, and <s>we are doing</s> the root pass since Monday.");
  s = one(s, "report: the correction", "I am responsible <b>for</b> managing the team, and <b>we have been running</b> the tests <b>since</b> Monday.",
    "I am responsible <b>for</b> running the night shift, and <b>we have been doing</b> the root pass <b>since</b> Monday.");
  s = one(s, "report: the upgrade", '<b>get it over the line</b><span class="d">to finish something that was hard to complete</span>',
    '<b>sign it off</b><span class="d">to approve the work formally once it has passed inspection</span>');
  s = one(s, "coach lede", "Talk for a minute about your project, your role or the update you owe someone.",
    "Talk for a minute about the job you are on, your trade or the handover you owe the next shift.");
  s = one(s, "coach: the simulations bullet", "<b>14 Life Simulations:</b> a job interview, a salary negotiation, the daily stand-up, a hotel check-in. The character answers you out loud.",
    "<b>Workshop simulations with the whole crew:</b> HR, your supervisor, the tool room, materials and QA in one conversation, the way a real first day goes. Each character answers you out loud.");
  return s;
});

/* ── 13. progress ──────────────────────────────────────────────────────── */
section("progress", s => {
  /* The certificate block goes: the one example image has "Business English
     Mastery" printed on it, which is the other app. Put it back when a Welding
     example has been rendered from the app's own certificate. */
  const c0 = s.indexOf('<div class="cert-peek">');
  if (c0 < 0) throw new Error("progress: the certificate block is gone");
  const c1 = s.indexOf("</div>\n        <div class=\"stats\"", c0);
  if (c1 < 0) throw new Error("progress: the end of the certificate block moved");
  s = s.slice(0, s.lastIndexOf("<!-- The certificate", c0)) + s.slice(c1 + "</div>\n        ".length);
  s = one(s, "progress: what is kept", "Every report is kept: your Shadow history, every Life Simulation attempt, and the words that keep coming back across sessions.",
    "Every report is kept: your Shadow history, every workshop simulation and interview attempt, and the words that keep coming back across sessions.");
  s = one(s, "progress: the second stat", '<div class="n" data-n="b">152</div><div class="l" data-l="b">Phrases</div>',
                                         '<div class="n" data-n="b">250</div><div class="l" data-l="b">Trade words</div>');
  return s;
});

/* ── 14. the home screen ───────────────────────────────────────────────── */
section("widgets", s => {
  s = one(s, "widgets: the sizes line", "<b>Small, medium and large,</b> plus the lock screen on iPhone. A General English and a Welding English widget, side by side if you study both.",
    "<b>Small, medium and large,</b> plus the lock screen on iPhone. Your streak, today's step and your place on the road map.");
  const i = s.indexOf('<figure class="shot" data-reveal data-reveal-delay="160"><div class="shot-phone"><img src="/bemastery/img/widgets/home-both.webp"');
  if (i < 0) throw new Error("widgets: the both-programmes shot is gone");
  const j = s.indexOf("</figure>", i) + "</figure>".length;
  return s.slice(0, i) + s.slice(j);
});

/* ── 15. the game hub ──────────────────────────────────────────────────── */
section("games", s => {
  s = one(s, "games lede", "Each programme has its own game hub, built from its own lessons. Eight short games turn what you are learning into answers you can give out loud.",
    "The game hub is built from the trade itself: 250 terms and 52 original drawings. Eight short games turn them into answers you can give out loud.");
  /* the English Mastery heading and its three shots go; the Welding ones stay */
  const a = s.indexOf('<h3 class="shots-h" data-reveal>English Mastery · General English</h3>');
  const b = s.indexOf('<h3 class="shots-h" data-reveal>Welding Mastery · Welding English</h3>');
  if (a < 0 || b < 0) throw new Error("games: a hub heading is gone");
  s = s.slice(0, a) + s.slice(b);
  s = one(s, "games: the remaining heading", '<h3 class="shots-h" data-reveal>Welding Mastery · Welding English</h3>\n    ', "");
  const li = s.indexOf("<li><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m5 13 4 4L19 7\"/></svg><span><b>English Mastery, for General English:</b>");
  if (li < 0) throw new Error("games: the English Mastery bullet is gone");
  const liEnd = s.indexOf("</li>", li) + "</li>".length;
  s = s.slice(0, li) + s.slice(liEnd);
  s = one(s, "games: the Welding bullet", "<b>Welding Mastery, for Welding English:</b> 250 trade words with real photographs of the tools, a crossword, listening rounds and workshop challenges.",
    "<b>Welding Mastery:</b> 250 trade terms and 52 original drawings in eight games — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle and Real-Life Missions.");
  s = one(s, "games: the rounds note", "Free: five challenge rounds a day in each programme — a wrong answer never costs a round",
    "Free: five challenge rounds a day — a wrong answer never costs a round");
  return s;
});

/* ── 16. who it's for ──────────────────────────────────────────────────── */
section("who", s => {
  s = one(s, "who: in meetings", "<b>In meetings</b><p>You follow every word, then freeze when it's your turn. Rehearse the update before you give it.</p>",
    "<b>On the floor</b><p>You hear the instruction, then freeze when it's your turn to answer. Rehearse the report before you give it.</p>");
  s = one(s, "who: interview", "<b>Before an interview</b><p>Answer the questions out loud, hear how you came across, and fix it before the day.</p>",
    "<b>Before an interview</b><p>Answer the trade questions out loud, hear how you came across, and fix it before the day.</p>");
  s = one(s, "who: abroad", "<b>Moving abroad for work</b><p>Settle in faster: small talk, handovers, calls and the paperwork conversations.</p>",
    "<b>Moving abroad for work</b><p>Settle in faster: the induction, the handover, the permit and the paperwork conversations.</p>");
  s = one(s, "who: trades", "<b>Skilled trades</b><p>Welders get their own programme: the workshop, safety, quality checks and the interview.</p>",
    "<b>Ten trades</b><p>Welder, pipefitter, boilermaker, millwright, operator, instrumentation, electrician, HSE, NDT and process.</p>");
  return s;
});

/* ── 17. pricing ───────────────────────────────────────────────────────── */
section("pricing", s => {
  s = one(s, "pricing lede", "The twelve-week programme, Shadow Studio, the AI coach, Practice Partner and your progress are free today.",
    "The twelve-stage programme, the Shadowing Studio, the AI coach, the games and your progress are free today.");
  s = one(s, "pricing: sessions", "84 guided 25-minute sessions across 12 weeks", "84 guided 25-minute sessions across 12 stages");
  const i = s.indexOf("<li><svg");
  const pp = s.indexOf("Practice Partner with live calls, on General English (18+)");
  if (pp < 0) throw new Error("pricing: the Practice Partner line is gone");
  const start = s.lastIndexOf("<li>", pp), end = s.indexOf("</li>", pp) + "</li>".length;
  if (start < i - 1) throw new Error("pricing: could not find the bullet around it");
  s = s.slice(0, start) + "<li><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m5 13 4 4L19 7\"/></svg><span>Welding Mastery: 250 trade terms, 52 drawings and eight games</span></li>" + s.slice(end);
  s = one(s, "pricing: the subscription line", "One subscription for both programmes, for learners who practise every day.",
    "One subscription, for learners who practise every day.");
  return s;
});

/* ── 18. the questions ─────────────────────────────────────────────────── */
section("faq", s => {
  s = one(s, "faq: is it free", "Yes. The full twelve-week programme, Shadow Studio, the AI coach, Practice Partner and your progress are free today, with no card needed.",
    "Yes. The full twelve-stage programme, the Shadowing Studio, the AI coach, Welding Mastery and your progress are free today, with no card needed.");
  s = one(s, "faq: level", "If you can read English but freeze when you speak, you are the learner it was built for.",
    "If you know the trade but freeze when you have to say it in English, you are the learner it was built for.");
  s = one(s, "faq: stores", "Yes. BE Mastery is on Google Play now, and the iPhone app is with Apple for review.",
    "BE Mastery Welding is on Google Play now — the button at the top of this page opens it. The iPhone app is with Apple for review, and this page will carry that link the day it is approved.");
  s = one(s, "faq: recordings", "Practice Partner live calls are never recorded.", "Nothing you record leaves the phone unless a take is being scored.");
  /* the two Practice Partner questions, and the trade question that pointed here */
  const dropOne = (needle, what) => {
    const at = s.indexOf(needle);
    if (at < 0) throw new Error(`faq: ${what} is gone`);
    const start = s.lastIndexOf("<details", at), end = s.indexOf("</details>", at) + "</details>".length;
    s = s.slice(0, start) + s.slice(end);
  };
  dropOne("Is Practice Partner safe?", "the Practice Partner question");
  s = one(s, "faq: the trade question", "<summary>Is there a programme for my trade?",
                                        "<summary>Which trades is it for?");
  s = one(s, "faq: the trade answer", "Yes, for welding and the trades around it: welders, pipefitters, boilermakers, millwrights, refinery operators, instrumentation technicians, industrial electricians, HSE officers, NDT technicians and process engineers. Choose Welding English when you open the app.",
    "Ten refinery trades: welders, pipefitters, boilermakers, millwrights, refinery operators, instrumentation technicians, industrial electricians, HSE officers, NDT technicians and process engineers. Pick yours when you open the app and the scenarios, vocabulary and model answers follow it.");
  return s;
});

/* ── 19. the download section ──────────────────────────────────────────── */
section("download", s => one(s, "download lede",
  "Twenty-five minutes on the train, in the car park, before the meeting. The app records, scores and remembers — and a partner can be waiting when you open it.",
  "Twenty-five minutes in the car park, in the canteen, before the shift. The app records, scores and remembers, and it works with no signal."));

/* ── 20. what belongs to the other app ─────────────────────────────────── */
cutBefore("Practice Partner, which is General English only", "<!-- ── 06 PRACTICE PARTNER", "<!-- ── PROGRESS");
cutBefore("the two-programmes and Welding sections", "<!-- ── 09 TWO PATHS", "<!-- ── 10 PRICING");
/* What's new: the cards that are about the other app */
sub("What's new: the game hubs", "English Mastery and Welding Mastery: eight games each, a daily mission and skill badges.",
                                 "Welding Mastery: eight games on 250 trade terms, a daily mission and skill badges.");
sub("What's new: the studio card", "<h3>Welding English studio</h3><p>Ten trades, workplace simulations, interview coaches and real workshop lines to shadow.</p>",
                                   "<h3>Ten trades</h3><p>Pick your profession and the scenarios, the vocabulary and the model answers change with you.</p>");
sub("What's new: the live-calls card", "<h3>Live practice calls</h3><p>Timed rounds with a real partner, and a private report on your side of the call.</p>",
                                       "<h3>Workplace lines</h3><p>The pre-job brief, the hot-work permit, the hand-over and the near-miss report, line by line.</p>");

/* ── 21. the printed section numbers ───────────────────────────────────── */
let n = 0;
h = h.replace(/<span class="n">\d\d<\/span>/g, () => `<span class="n">${String(++n).padStart(2, "0")}</span>`);
if (n < 10) throw new Error(`only ${n} numbered sections were found`);
steps.push(`edit renumbered ${n} sections 01–${String(n).padStart(2, "0")}`);

/* ── the guard: what a visitor can actually read ───────────────────────── */
const visible = h.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
const banned = /general english|practice partner|life simulation|english mastery|partner/gi;
const found = visible.match(banned);
if (found) {
  const where = [...visible.matchAll(/[\s\S]{0,80}(general english|practice partner|life simulation|english mastery|partner)[\s\S]{0,80}/gi)]
    .map(m => "    …" + m[0].replace(/\s+/g, " ") + "…").join("\n");
  throw new Error(`the Welding page still carries ${found.length} General-English thing(s):\n${where}`);
}
if (h.includes('id="partner"') || h.includes('id="paths"') || h.includes('id="welding"')) throw new Error("a cut section is still there");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, h);
console.log(steps.map(s => "  " + s).join("\n"));
console.log(`\n  wrote site/bemastery-w/index.html — ${(h.length / 1024).toFixed(1)} KB`);
