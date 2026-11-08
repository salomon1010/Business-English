/* Copies the web app (repository root) into ./www for Capacitor.
   The web app is one file plus its data; nothing is built. What is left out is
   everything that is not the app: backend Workers, marketing, docs, tests, the
   Android project, this folder. Run before `npx cap sync ios`.
   Shared by the Android shell (8 Oct 2026): mobile/android runs this script with
   `--out <its www> --platform android`; without them it is the iOS bundle, as before.
   `--platform web` is the same bundle served by a web server instead of copied
   into a shell: it is what scripts/web/build-standalone.mjs uses to build the
   two standalone WEB apps (docs/WEB-STANDALONE.md).

   THE TWO-APP SPLIT (12 Oct 2026, docs/APP_SPLIT.md). `--track general-english`
   or `--track welding` builds the bundle for ONE of the two store apps:
     - be-build.js carries {track:"<id>"}, which index.html reads as
       BE_APP_TRACK: areaId() is pinned, the programme-selection screens are
       refused and go() turns away the other programme's views;
     - the other programme's CONTENT is removed from the bundle, so the app does
       not merely hide it — it does not carry it.
   Without --track the bundle is the whole app, exactly as before, which is what
   app.lomonec.com serves. */
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");
const argAfter = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const out = argAfter("--out") ? resolve(process.cwd(), argAfter("--out")) : resolve(here, "..", "www");
const PLATFORMS = ["ios", "android", "web"];
const platform = argAfter("--platform") || "ios";
if (!PLATFORMS.includes(platform)) throw new Error(`--platform must be one of ${PLATFORMS.join(" / ")}, got ${platform}`);
/* `site` is the lomonec.com company website (deployed on its own, 7 Oct 2026); the app never loads it */
const skip = new Set([".git", ".github", ".claude", ".agents", ".codex", ".playwright-mcp", ".wrangler", "node_modules", "backend", "branding", "marketing", "docs", "tests", "playstore", "scripts", "mobile", "review", "services", "skills", "site", ".well-known", "CNAME", "TESTING.md", "0703eea26ef786413e910ec4d620b6a0.txt", "robots.txt", "sitemap.xml", "CLAUDE.md", "README.md", "CONTRIBUTING.md", ".gitignore", ".DS_Store",
  /* _site is scripts/portal/build-site.mjs's output. It was not listed here,
     so a bundle built after a portal build copied the whole website into the
     app — and when build-site calls THIS script to produce the two pinned web
     apps, it tried to copy _site into a folder inside _site. */
  "_site", ".nojekyll"]);

const TRACKS = ["general-english", "welding"];
const track = argAfter("--track");
if (track !== null && !TRACKS.includes(track)) throw new Error(`--track must be one of ${TRACKS.join(" / ")}, got ${track}`);

rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
/* copy entry by entry (the destination lives inside the source tree, which cpSync refuses as a whole) */
for (const name of readdirSync(root)) {
  if (skip.has(name) || name.endsWith(".DS_Store")) continue;
  cpSync(resolve(root, name), resolve(out, name), { recursive: true, filter: (src) => !src.endsWith(".DS_Store") });
}

/* ---------------------------------------------------------------- the split
   What belongs to ONE programme and is removed from the other app's bundle.

   What is deliberately NOT removed from the Welding bundle: the SECTION files
   of tracks/general (weeks / shadow / phrases / vocabulary / practice /
   progress / foundations). The Welding curriculum INHERITS the English-language
   machinery from General English — the stop-word list, the CEFR map, the
   grammar rules and the grammar drills — and professional-tracks.js fills only
   the fields the Welding pack leaves EMPTY, so no General English week, phrase
   or word can displace trade content. CurriculumProvider rejects a missing
   section outright, so deleting one would break the Welding app (this is the
   bug that once gave every welder "eight questions at a time" with nothing
   behind them). missions.json is removed: it is in NEVER_INHERIT, so it is
   pure General English content that the merge would not touch anyway.

   Also not removed: the other programme's JavaScript modules (english-mastery.js,
   welding-mastery.js, trades.js …). They are loaded by a plain <script> tag and
   half the app guards them with `window.X &&`; dropping the tags is a bigger
   change than this split needs. They have no reachable entry point (the hub
   gate, the Practice tab and go()'s VIEW_TRACK each refuse), and their content
   packs ARE removed, so there is nothing for them to draw. Noted in
   docs/APP_SPLIT.md as a follow-up. */
const PRUNE = {
  "general-english": {
    dirs: ["tracks/welding", "sim-photos", "home-photos/welding"],
    files: ["catalogue/welding.json", "catalogue/welding-sources.json", "catalogue/welding-survey.json",
            "welding-mastery-logo.svg", "workshop-team.jpg", "workshop-team-card.jpg"],
    captionsOf: "welding",
  },
  welding: {
    dirs: ["scenes", "rp-photos"],
    files: ["catalogue/general.json", "catalogue/sources.json", "catalogue/survey.json",
            "tracks/general/missions.json", "tracks/general/mastery.json", "tracks/general/mastery-art3d.json",
            "english-mastery-logo.svg",
            /* Onboarding V2 and the General English learner profile (7 Nov 2026): General English only, so the Welding
               bundle does not carry the code at all. index.html guards every use (window.X &&), and the script tags are
               removed below so the app does not even ask for them. */
            "learner-profile.js", "onboarding-catalog.js", "onboarding-v2.js"],
    captionsOf: "general",
  },
};
/* ---------------------------------------------------------------- branding
   The app's own mark, as the LEARNER sees it inside the app: the logo on the
   certificate and the share card, and the icon and badge on every notification
   the web layer raises. index.html asks for "icon-192.png" in all of those
   places, so the mark is changed by giving the bundle a different file of that
   name — no branch in the app, and app.lomonec.com keeps the General English
   icon because the repository's own icon-192.png / icon-512.png are not
   touched. The launcher icon is a different thing entirely and lives in each
   store project (Android product flavor, iOS asset catalog).
   Sources are generated by scripts/branding/make-welding-icons.py. */
const BRAND = {
  welding: { "icon-192.png": "branding/welding/icon-192.png",
             "icon-512.png": "branding/welding/icon-512.png",
             /* the mark index.html draws in the header, the onboarding hero,
                the About row and the sign-in sheet */
             "logo.svg": "branding/welding/logo.svg",
             /* the Welding Mastery hub's own mark: a 160x100 banner that every
                .wm-logo rule draws into a SQUARE box (40-84px), so the square
                app mark fits it better than the banner did. The filename is
                kept, so welding-mastery.js and tests/welding-mastery.mjs E1
                are untouched. */
             "welding-mastery-logo.svg": "branding/welding/logo.svg" },
};

/* Which catalogue a caption file belongs to. The two catalogues share no video
   id at all (checked: 385 General English, 534 Welding, 0 in common), so a
   caption can be attributed exactly. A caption that belongs to neither (a
   starter clip, a scene) stays in both bundles. */
function captionIds(name) {
  const f = resolve(root, "catalogue", name + ".json");
  if (!existsSync(f)) return null;
  try { return new Set(Object.keys(JSON.parse(readFileSync(f, "utf8")).videos || {})); } catch (e) { return null; }
}
let pruned = { dirs: 0, files: 0, captions: 0, bytes: 0 };
const branded = [];
function sizeOf(p) {
  const st = statSync(p);
  if (!st.isDirectory()) return st.size;
  return readdirSync(p).reduce((a, n) => a + sizeOf(resolve(p, n)), 0);
}
function drop(rel, kind) {
  const p = resolve(out, rel);
  if (!existsSync(p)) return;
  pruned.bytes += sizeOf(p);
  rmSync(p, { recursive: true, force: true });
  pruned[kind]++;
}

/* ------------------------------------------------- General English reads no Welding
   Owner (7 Nov 2026): the General English app shows no Welding text anywhere a learner can
   read it. PRUNE removes the other programme's CONTENT FILES; this removes the other
   programme's WORDS from the two files the General English app keeps for itself:
     - the Help centre (manual/<lang>.html): the programmes section (id "man-track", present
       in all 15 languages), its contents-list entry, the sections after it renumbered, and in
       English the sentences that name Welding;
     - the About page (flyer.html): the "English for your trade" benefit card, in the static
       markup and in each of the 16 language blocks (it is always the second row).
   The repository's own files are never touched, so app.lomonec.com (both programmes) and the
   Welding bundle are exactly as before. Every edit must match exactly once, and a count that
   is not what was expected fails the build, so a change to those files cannot silently
   leave Welding text behind.
   NOT touched, on purpose: privacy.html (the registered legal text, which describes both
   apps), and the unreachable Welding JavaScript modules and i18n key names (see PRUNE). */
function stripWeldingText() {
  const fail = (m) => { throw new Error("General English text strip: " + m); };
  const once = (h, from, to, label) => {
    const n = h.split(from).length - 1;
    if (n !== 1) fail(`${label} matched ${n} times (expected 1)`);
    return h.replace(from, to);
  };
  const dir = resolve(out, "manual");
  let files = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".html") || f === "index.html") continue;
    const p = resolve(dir, f);
    let h = readFileSync(p, "utf8");
    const a = h.indexOf('<section id="man-track"');
    if (a < 0) fail(`${f}: the programmes section (man-track) was not found`);
    const b = h.indexOf("</section>", a);
    if (b < 0 || h.slice(a + 10, b).includes("<section")) fail(`${f}: man-track is not a single closed section`);
    const num = /class="no">(\d+)</.exec(h.slice(a, b));
    if (!num) fail(`${f}: man-track has no section number`);
    h = h.slice(0, a) + h.slice(b + "</section>".length);
    const removed = Number(num[1]);
    h = h.replace(/<span class="no">(\d+)<\/span>/g, (m, n) => Number(n) > removed ? `<span class="no">${Number(n) - 1}</span>` : m);
    const lines = h.split("\n"), keep = lines.filter(l => !(/<li>.*man-track.*<\/li>/.test(l)));
    if (lines.length - keep.length !== 1) fail(`${f}: expected exactly one contents entry for man-track, removed ${lines.length - keep.length}`);
    h = keep.join("\n");
    if (f === "en.html") {
      for (const [re, label] of [[/^ *<div class="tip"><b>💡 On Welding English<\/b>.*<\/div>\n/m, "career-dashboard tip"],
                                 [/^ *<p class="note">On Welding English, the Shadow tab.*<\/p>\n/m, "workshop-lines note"],
                                 [/^ *<li><b>Professional Workplace Scenarios<\/b> and the <b>interview coaches<\/b> — on Welding English\.<\/li>\n/m, "workplace-scenarios item"]]) {
        const n = (h.match(new RegExp(re.source, "gm")) || []).length;
        if (n !== 1) fail(`en.html ${label} matched ${n} times (expected 1)`);
        h = h.replace(re, "");
      }
      h = once(h, "the app language → where you want to learn (<b>General English</b> or <b>Welding</b>) → what you do", "the app language → what you do", "welcome-steps sentence");
      h = once(h, "(follows the programme you have open), <b>General English</b> or <b>Welding English</b>, in small", "or <b>General English</b>, in small", "widget sentence");
    }
    if (/weld|boilermaker|pipefitter/i.test(h) && f === "en.html") fail("en.html still names Welding after the strip");
    if (h.includes("man-track")) fail(`${f}: a reference to man-track is left`);
    writeFileSync(p, h);
    files++;
  }
  if (files !== 16) fail(`expected 16 manual pages (15 languages + English), stripped ${files}`);

  const fp = resolve(out, "flyer.html");
  let fl = readFileSync(fp, "utf8");
  const card = /^ *<div class="b"><h3>English for your trade<span class="badge">NEW<\/span><\/h3>.*<\/div>\n/m;
  if ((fl.match(new RegExp(card.source, "gm")) || []).length !== 1) fail("the static trade card was not found exactly once in flyer.html");
  fl = fl.replace(card, "");
  const L = fl.split("\n"); let blocks = 0;
  for (let i = 0; i < L.length; i++) {
    if (/^ *ben:\[\[/.test(L[i])) {
      if (!/^ *\[".*"\],?\s*$/.test(L[i + 1])) fail(`flyer.html language block ${blocks + 1}: the second benefit row is not a single row`);
      L.splice(i + 1, 1); blocks++;
    }
  }
  if (blocks !== 16) fail(`expected 16 flyer language blocks, found ${blocks}`);
  fl = L.join("\n");
  if (/English for your trade|boilermaker|pipefitter/i.test(fl)) fail("flyer.html still mentions the trade card");
  writeFileSync(fp, fl);
  return { manual: files, flyerBlocks: blocks };
}
const idxEarly = resolve(out, "index.html");
if (track) {
  const plan = PRUNE[track];
  plan.dirs.forEach(d => drop(d, "dirs"));
  plan.files.forEach(f => drop(f, "files"));
  const theirs = captionIds(plan.captionsOf);
  if (!theirs) throw new Error(`catalogue/${plan.captionsOf}.json is needed to prune captions and was not readable`);
  const capDir = resolve(out, "captions");
  if (existsSync(capDir)) for (const f of readdirSync(capDir)) {
    if (f.endsWith(".json") && theirs.has(f.replace(/\.json$/, ""))) drop("captions/" + f, "captions");
  }
  /* The Welding app must still be able to boot: every curriculum SECTION of
     both its own pack and its inherit parent has to be present. */
  const SECTIONS = ["weeks", "shadow", "phrases", "vocabulary", "practice", "progress"];
  const need = track === "welding" ? ["welding", "general"] : ["general"];
  for (const id of need) for (const sec of SECTIONS) {
    const f = resolve(out, "tracks", id, sec + ".json");
    if (!existsSync(f)) throw new Error(`pruning removed a curriculum section the ${track} app needs: tracks/${id}/${sec}.json`);
  }
  /* the General English-only scripts are gone, so their <script> tags go too (and the build fails if either is left behind) */
  if (track === "welding") {
    let page = readFileSync(idxEarly, "utf8");
    for (const f of ["learner-profile.js", "onboarding-catalog.js", "onboarding-v2.js"]) {
      const re = new RegExp('<script src="' + f.replace(".", "\\.") + '(\\?v=\\d+)?"></script>\\n?', "g");
      if ((page.match(re) || []).length !== 1) throw new Error(`Welding bundle: the <script> tag for ${f} was not found exactly once in index.html`);
      page = page.replace(re, "");
      if (existsSync(resolve(out, f))) throw new Error(`${f} is still in the Welding bundle`);
    }
    writeFileSync(idxEarly, page);
  }
  /* and it must NOT carry the other programme's library */
  const gone = track === "welding" ? "catalogue/general.json" : "catalogue/welding.json";
  if (existsSync(resolve(out, gone))) throw new Error(`${gone} is still in the ${track} bundle`);
  for (const [dest, src] of Object.entries(BRAND[track] || {})) {
    const from = resolve(root, src);
    if (!existsSync(from)) throw new Error(`the ${track} bundle needs ${src}; run scripts/branding/make-welding-icons.py`);
    cpSync(from, resolve(out, dest));
    branded.push(dest);
  }
  /* The boot splash (#beSplash) draws its mark as an INLINE svg, so copying a
     file over it is not enough: a Welding learner would watch the General
     English tile animate in before the app painted. The one <svg class="bs-logo">
     is swapped for the programme's own logo.svg here rather than branched in
     index.html, so the shared file keeps exactly one splash and General English
     is untouched. The tile/bar keyframes simply have nothing to animate
     afterwards; the row still glides, which is the motion that is actually
     visible. */
  if (BRAND[track] && BRAND[track]["logo.svg"]) {
    const page = readFileSync(idxEarly, "utf8");
    const open = page.indexOf('<svg class="bs-logo"');
    const close = open < 0 ? -1 : page.indexOf("</svg>", open);
    if (open < 0 || close < 0) throw new Error("the #beSplash mark (svg.bs-logo) was not found — index.html changed shape");
    if (page.indexOf('<svg class="bs-logo"', open + 1) !== -1) throw new Error("more than one svg.bs-logo in index.html");
    writeFileSync(idxEarly, page.slice(0, open)
      + '<img class="bs-logo" src="logo.svg" alt="" style="border-radius:22px">'
      + page.slice(close + "</svg>".length));
    branded.push("#beSplash mark");
  }
  if (track === "general-english") { const r = stripWeldingText(); branded.push(`General English text strip (${r.manual} help pages, ${r.flyerBlocks} About blocks)`); }
  /* manifest.json names the Play app this bundle belongs to. Left alone, the
     Welding bundle advertised com.bemastery.app: getInstalledRelatedApps()
     would have answered with the OTHER app, and any installer reading the
     manifest would have sent the learner to the wrong listing. The repository's
     own manifest.json is untouched, so app.lomonec.com keeps naming the
     existing app. */
  const mf = resolve(out, "manifest.json");
  if (existsSync(mf)) {
    /* The repository's manifest lists BOTH Play apps under
       related_applications, because app.lomonec.com serves both programmes
       (19 Oct 2026). A single-programme bundle must name exactly one: left
       alone, getInstalledRelatedApps() would answer with the other app and any
       installer reading the manifest would send the learner to the wrong
       listing. The repository's own file is untouched. */
    const PKG = { "general-english": "com.bemastery.app", welding: "com.lomonec.bemastery.welding" };
    const m = JSON.parse(readFileSync(mf, "utf8"));
    const id = PKG[track];
    if (!id) throw new Error(`no Play package is known for the ${track} bundle`);
    if (!Array.isArray(m.related_applications) || !m.related_applications.length) throw new Error("manifest.json has no related_applications to re-point");
    if (!m.related_applications.some((r) => r.id === id)) throw new Error(`manifest.json does not list ${id}, so this bundle cannot claim it`);
    m.related_applications = [{ platform: "play", id, url: "https://play.google.com/store/apps/details?id=" + id }];
    /* The name is what an installed web app shows under its icon, so the
       Welding bundle must not be installed as "Business English Mastery".
       Done here rather than in a second manifest file so the repository keeps
       exactly one manifest.json. */
    if (track === "welding") {
      m.name = "BE Mastery Welding — English for the trades";
      m.short_name = "BE Welding";
    }
    writeFileSync(mf, JSON.stringify(m, null, 2) + "\n");
    branded.push("manifest related_applications");
  }
}

/* The service worker precaches the app shell, and the shell list in the
   repository names BOTH programmes' catalogues and curricula. A pruned bundle
   does not carry the other one, so every entry that is no longer here is taken
   out of the list: the worker then asks only for files this bundle has. sw.js
   caches entry by entry and skips a miss, so this is not what makes the
   install work — it is what stops it making requests we know will 404, on a
   learner's mobile data, on every version bump. */
if (track) {
  const swp = resolve(out, "sw.js");
  const txt = readFileSync(swp, "utf8");
  const m = txt.match(/const SHELL = \[([\s\S]*?)\];/);
  if (!m) throw new Error("sw.js: the SHELL list was not found — sw.js changed shape");
  const items = m[1].match(/"[^"]+"/g).map(s => s.slice(1, -1));
  const kept = items.filter(u => u === "./" || existsSync(resolve(out, u.split("?")[0])));
  const dropped = items.filter(u => !kept.includes(u));
  if (!dropped.length) throw new Error("sw.js: nothing was dropped from SHELL, yet this bundle is pruned — check the prune plan");
  writeFileSync(swp, txt.replace(m[0],
    "const SHELL = [" + kept.map(u => JSON.stringify(u)).join(", ") + "];   /* " +
    dropped.length + " entries the " + track + " bundle does not carry were removed by sync-web.mjs */"));
  console.log(`sw.js SHELL: kept ${kept.length}, dropped ${dropped.length} (${dropped.join(", ")})`);
}

/* The service worker cannot run inside WKWebView (no ServiceWorker in a
   custom-scheme web view); the app already guards every registration. The
   file stays in the bundle so relative fetches of it do not 404. */
const idx = resolve(out, "index.html");
if (!existsSync(idx)) throw new Error("index.html missing from the bundle");
const html = readFileSync(idx, "utf8");
if (!/<meta name="viewport"/.test(html)) throw new Error("viewport meta missing");
/* `npm run sync:staging` (TestFlight against staging): the COPY gets
   be-build.js, loaded first, which points the app at the staging Workers
   (beEnv) and turns billing on for Sandbox testing. Never used for an App Store
   submission; the committed index.html is not touched. `--track` writes the
   same file with the app's programme — that one IS used for store builds. */
const staging = process.argv.includes("--staging");
/* DEVELOPMENT ONLY (owner-approved simulator hook, 7 Nov 2026): --dev-flags '{"flag":true}' turns feature flags
   on inside a SIMULATOR/EMULATOR bundle so a flow behind a flag can be driven on a device-like target. It is
   refused for --device / --archive / --staging by the build scripts, it writes the marker `dev:true`, and
   check-release.mjs fails any bundle carrying that marker — so it cannot reach a store build. */
const devFlagsArg = argAfter("--dev-flags");
let devFlags = null;
if (devFlagsArg !== null) {
  if (staging) throw new Error("--dev-flags and --staging are contradictory");
  try { devFlags = JSON.parse(devFlagsArg); } catch (e) { throw new Error("--dev-flags must be a JSON object, e.g. '{\"onboarding_v2_enabled\":true}'"); }
  if (!devFlags || typeof devFlags !== "object" || Array.isArray(devFlags)) throw new Error("--dev-flags must be a JSON object");
  if (!Object.keys(devFlags).length || Object.values(devFlags).some(v => typeof v !== "boolean")) throw new Error("--dev-flags takes at least one flag, each true or false");
}
/* Firebase follows the build (29 Sep 2026). The staging Workers verify the
   validation project be-mastery-test, so a staging bundle must sign in there:
   before this it kept the committed production block and signed staging
   testers into be-mastery. The swap happens in the COPY only, from
   staging-firebase.json; a production bundle is checked to carry be-mastery
   and nothing of the test project. Either mismatch stops the sync. */
const FB_BLOCK = /window\.FB_CONFIG=\{[\s\S]*?\};/;
let page = html;
const build = {};
if (staging) build.env = "staging";
if (track) build.track = track;
if (staging) build.flags = { billing_enabled: true };
if (devFlags) { build.flags = Object.assign({}, build.flags, devFlags); build.dev = true; }
/* --no-billing (13 Oct 2026): a PRODUCTION bundle — real Firebase, real
   Workers, real signing — with Premium purchasing switched off, for a
   TestFlight round that is about lessons, speaking and the Shadow Studio.
   Needed because a TestFlight purchase is a Sandbox transaction that the
   production entitlement service accepts, so "just try buying" would write a
   real production entitlement through a path whose server half is not yet
   deployed. --staging is NOT the answer: it also swaps Firebase to
   be-mastery-test and every endpoint to the staging Workers, which would
   change the very authentication and analytics such a round is meant to test.
   This flag can only WITHHOLD a capability — planOn() becomes false, so the
   offer, the gates and PLAN_LIMITS all go quiet — and the guard below refuses
   anything else. */
const noBilling = process.argv.includes("--no-billing");
if (noBilling && staging) throw new Error("--no-billing and --staging are contradictory: staging turns billing ON");
if (noBilling) build.flags = { billing_enabled: false };
if (staging || track || noBilling || devFlags) {
  writeFileSync(resolve(out, "be-build.js"), "window.BE_BUILD=" + JSON.stringify(build) + ";\n");
  const tag = '<script src="be-build.js"></script>';
  if (!page.includes("<head>")) throw new Error("<head> missing");
  page = page.replace("<head>", "<head>\n" + tag);
  writeFileSync(idx, page);
}
if (staging) {
  const cfg = JSON.parse(readFileSync(resolve(here, "..", "staging-firebase.json"), "utf8"));
  delete cfg._note;
  if (cfg.projectId !== "be-mastery-test") throw new Error("staging-firebase.json is not the validation project");
  if ((page.match(new RegExp(FB_BLOCK.source, "g")) || []).length !== 1) throw new Error("window.FB_CONFIG block not found exactly once");
  page = page.replace(FB_BLOCK, "window.FB_CONFIG=" + JSON.stringify(cfg) + ";   /* STAGING BUNDLE ONLY: be-mastery-test */");
  writeFileSync(idx, page);
}
const project = (/window\.FB_CONFIG=\{[\s\S]*?"?projectId"?\s*:\s*"([^"]+)"/.exec(page) || [])[1];
const want = staging ? "be-mastery-test" : "be-mastery";
if (project !== want) throw new Error(`Firebase project in the bundle is ${project}, expected ${want}`);
/* A production bundle must carry nothing of staging. be-build.js is allowed
   now that it also carries the programme, so its CONTENT is what is checked:
   no env, no staging flags. */
if (!staging) {
  if (/be-mastery-test/.test(page)) throw new Error("a production bundle must carry nothing of staging");
  const bb = resolve(out, "be-build.js");
  if (existsSync(bb)) {
    const txt = readFileSync(bb, "utf8");
    if (/staging/.test(txt)) throw new Error("a production be-build.js must carry nothing of staging: " + txt.trim());
    /* The content is checked key by key rather than by pattern, because one
       exception is now allowed and it must be exactly that one: a bundle may
       say billing_enabled:false (subtractive — it can only switch Premium
       purchasing OFF) and nothing else. No env, no other flag, no `true`. */
    let parsed; try { parsed = JSON.parse(txt.replace(/^window\.BE_BUILD=/, "").replace(/;\s*$/, "")); }
    catch (e) { throw new Error("be-build.js is not the expected one-line assignment: " + txt.trim()); }
    if (parsed.dev) {
      /* a development bundle: allowed here only because this very run asked for it, and refused by
         check-release.mjs and by the build scripts for device/archive builds */
      if (!devFlags) throw new Error("be-build.js carries the development marker but --dev-flags was not given");
    }
    const extra = Object.keys(parsed).filter(k => k !== "track" && k !== "flags" && !(devFlags && k === "dev"));
    if (extra.length) throw new Error("a production be-build.js may carry track (and at most flags.billing_enabled:false), got: " + txt.trim());
    if (parsed.flags !== undefined) {
      const keys = Object.keys(parsed.flags);
      if (!devFlags && (keys.length !== 1 || keys[0] !== "billing_enabled" || parsed.flags.billing_enabled !== false))
        throw new Error("the only build flag a production bundle may carry is billing_enabled:false, got: " + txt.trim());
    }
    if (!parsed.track) throw new Error("be-build.js written without --track in a production bundle");
  }
}
writeFileSync(resolve(out, "BUNDLE_INFO.txt"),
  `BE Mastery web bundle for ${{ android: "Android", web: "the web", ios: "iOS" }[platform]} (${staging ? "STAGING — not for store submission" : "production"})\n` +
  `programme ${track || "both (unsplit)"}\nfirebase ${project}\n` +
  (noBilling ? "billing DISABLED in this bundle (--no-billing): Premium cannot be purchased\n" : "") +
  (branded.length ? `branding ${branded.join(", ")} replaced from branding/${track}/\n` : "") +
  `synced ${new Date().toISOString()}\nsource ${root}\n`);
console.log("www ready:", out, track ? `(programme ${track})` : "(both programmes)");
if (branded.length) console.log(`branding: ${branded.join(", ")} taken from branding/${track}/`);
if (track) console.log(`pruned ${pruned.dirs} dirs, ${pruned.files} files, ${pruned.captions} caption files — ${(pruned.bytes / 1048576).toFixed(1)} MB of the other programme's content`);
