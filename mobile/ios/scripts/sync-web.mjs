/* Copies the web app (repository root) into ./www for Capacitor.
   The web app is one file plus its data; nothing is built. What is left out is
   everything that is not the app: backend Workers, marketing, docs, tests, the
   Android project, this folder. Run before `npx cap sync ios`.
   Shared by the Android shell (8 Oct 2026): mobile/android runs this script with
   `--out <its www> --platform android`; without them it is the iOS bundle, as before. */
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");
const argAfter = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const out = argAfter("--out") ? resolve(process.cwd(), argAfter("--out")) : resolve(here, "..", "www");
const platform = argAfter("--platform") || "ios";
/* THE TWO-APP SPLIT (12 Oct 2026, docs/APP_SPLIT.md). `--track general-english`
   or `--track welding` builds the bundle for ONE of the two store apps: the web
   layer reads BE_BUILD.track as BE_APP_TRACK and pins areaId() to it, and the
   other programme's CONTENT is removed here so it is not merely hidden.
   Without --track the bundle is the whole app, exactly as before, which is what
   app.lomonec.com still serves. */
const TRACKS = ["general-english", "welding"];
const track = argAfter("--track");
if (track !== null && !TRACKS.includes(track)) throw new Error(`--track must be one of ${TRACKS.join(" / ")}, got ${track}`);
/* `site` is the lomonec.com company website (deployed on its own, 7 Oct 2026); the app never loads it */
const skip = new Set([".git", ".github", ".claude", ".agents", ".codex", ".playwright-mcp", ".wrangler", "node_modules", "backend", "marketing", "docs", "tests", "playstore", "scripts", "mobile", "review", "services", "skills", "site", ".well-known", "CNAME", "TESTING.md", "0703eea26ef786413e910ec4d620b6a0.txt", "robots.txt", "sitemap.xml", ".nojekyll", "CLAUDE.md", "README.md", "CONTRIBUTING.md", ".gitignore", ".DS_Store"]);

/* What belongs to ONE programme only. Derived from the two shipped bundles, not
   guessed. tracks/general's SECTION files are deliberately NOT here: the Welding
   curriculum inherits the English-language machinery from them, so they ride in
   both bundles — only general's missions and mastery packs are dropped. */
const PRUNE = {
  welding: ["rp-photos", "scenes", "english-mastery-logo.svg",
            "catalogue/general.json", "catalogue/sources.json", "catalogue/survey.json",
            "tracks/general/missions.json", "tracks/general/mastery.json", "tracks/general/mastery-art3d.json"],
  "general-english": ["tracks/welding", "sim-photos", "home-photos/welding",
            "welding-mastery-logo.svg", "workshop-team.jpg", "workshop-team-card.jpg",
            "catalogue/welding.json", "catalogue/welding-sources.json", "catalogue/welding-survey.json"],
};
/* every curriculum SECTION the provider loads; a bundle missing one is broken */
const SECTIONS = ["foundations", "phrases", "practice", "progress", "shadow", "vocabulary", "weeks"];

rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
/* copy entry by entry (the destination lives inside the source tree, which cpSync refuses as a whole) */
for (const name of readdirSync(root)) {
  if (skip.has(name) || name.endsWith(".DS_Store")) continue;
  cpSync(resolve(root, name), resolve(out, name), { recursive: true, filter: (src) => !src.endsWith(".DS_Store") });
}

if (track) {
  const IDS = /["'\/]([A-Za-z0-9_-]{11})["'\/]/g;
  const idsIn = fp => { const out = new Set(); if (!existsSync(fp)) return out;
    readFileSync(fp, "utf8").replace(IDS, (_, v) => (out.add(v), _)); return out; };
  const idsUnder = dir => { const out = new Set(); if (!existsSync(dir)) return out;
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const fp = resolve(dir, f.name);
      if (f.isDirectory()) { for (const v of idsUnder(fp)) out.add(v); }
      else if (f.name.endsWith(".json")) for (const v of idsIn(fp)) out.add(v);
    } return out; };

  /* The OTHER programme's clips, read before its catalogue is deleted. Captions
     are pruned SUBTRACTIVELY — only what demonstrably belongs to the programme
     being removed — so a caption that no shipped catalogue claims (a few exist,
     left over from channel vetting) is kept rather than silently dropped. */
  const otherIds = new Set();
  for (const rel of PRUNE[track]) if (rel.startsWith("catalogue/")) for (const v of idsIn(resolve(out, rel))) otherIds.add(v);

  for (const rel of PRUNE[track]) rmSync(resolve(out, rel), { recursive: true, force: true });

  /* what the surviving curriculum still names: its own catalogue (one level
     deep — catalogue/raw/ is channel-vetting data naming hundreds of General
     English videos and ships in both bundles) and tracks/, whose
     tracks/general/shadow.json carries the starters the Welding library
     inherits. */
  const keep = new Set();
  for (const f of readdirSync(resolve(out, "catalogue"), { withFileTypes: true }))
    if (f.isFile() && f.name.endsWith(".json")) for (const v of idsIn(resolve(out, "catalogue", f.name))) keep.add(v);
  for (const v of idsUnder(resolve(out, "tracks"))) keep.add(v);

  const capDir = resolve(out, "captions");
  if (existsSync(capDir)) for (const f of readdirSync(capDir)) {
    const vid = f.replace(/\.json$/, "");
    if (otherIds.has(vid) && !keep.has(vid)) rmSync(resolve(capDir, f), { force: true });
  }

  /* the other programme's content is gone; the app's own machinery must not be */
  for (const sec of SECTIONS)
    if (!existsSync(resolve(out, "tracks", "general", sec + ".json")))
      throw new Error(`pruning removed a curriculum section the app needs: tracks/general/${sec}.json`);
  if (!existsSync(resolve(out, "tracks", track === "welding" ? "welding" : "general")))
    throw new Error(`the ${track} curriculum is missing from its own bundle`);
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
   submission; the committed index.html is not touched. */
const staging = process.argv.includes("--staging");
/* --no-billing (13 Oct 2026): a PRODUCTION bundle — real Firebase, real
   Workers, real signing — with Premium purchasing switched off, for a
   TestFlight/internal round that is about lessons and the studio, not billing.
   A store sandbox purchase is accepted by the production entitlement service,
   so "just try buying" would write a real production entitlement through a path
   whose server half is not deployed. --staging is NOT the answer: it also swaps
   Firebase to be-mastery-test and every endpoint to the staging Workers, which
   would change the authentication such a round is meant to test. This flag can
   only WITHHOLD a capability, and the guard below refuses anything else. */
const noBilling = process.argv.includes("--no-billing");
if (noBilling && staging) throw new Error("--no-billing and --staging are contradictory: staging turns billing ON");
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
if (noBilling) build.flags = { billing_enabled: false };
if (staging || track || noBilling) {
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
/* A production bundle must carry nothing of staging. be-build.js is allowed now
   that it also carries the programme, so its CONTENT is checked key by key —
   one exception is permitted and it must be exactly that one: billing_enabled
   false, which can only switch Premium purchasing OFF. */
if (!staging) {
  if (/be-mastery-test/.test(page)) throw new Error("a production bundle must carry nothing of staging");
  const bb = resolve(out, "be-build.js");
  if (existsSync(bb)) {
    const txt = readFileSync(bb, "utf8");
    if (/staging/.test(txt)) throw new Error("a production be-build.js must carry nothing of staging: " + txt.trim());
    let parsed; try { parsed = JSON.parse(txt.replace(/^window\.BE_BUILD=/, "").replace(/;\s*$/, "")); }
    catch (e) { throw new Error("be-build.js is not the expected one-line assignment: " + txt.trim()); }
    const extra = Object.keys(parsed).filter(k => k !== "track" && k !== "flags");
    if (extra.length) throw new Error("a production be-build.js may carry track (and at most flags.billing_enabled:false), got: " + txt.trim());
    if (parsed.flags !== undefined) {
      const keys = Object.keys(parsed.flags);
      if (keys.length !== 1 || keys[0] !== "billing_enabled" || parsed.flags.billing_enabled !== false)
        throw new Error("the only build flag a production bundle may carry is billing_enabled:false, got: " + txt.trim());
    }
    if (!parsed.track) throw new Error("be-build.js written without --track in a production bundle");
  }
}
writeFileSync(resolve(out, "BUNDLE_INFO.txt"), `BE Mastery web bundle for ${platform === "android" ? "Android" : "iOS"} (${staging ? "STAGING — not for store submission" : "production"})\n` +
  `programme ${track || "both (unsplit)"}\nfirebase ${project}\n` +
  (noBilling ? "billing DISABLED in this bundle (--no-billing): Premium cannot be purchased\n" : "") +
  `synced ${new Date().toISOString()}\nsource ${root}\n`);
console.log("www ready:", out, track ? `(programme ${track})` : "(both programmes)");
