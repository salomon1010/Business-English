/* Copies the web app (repository root) into ./www for Capacitor.
   The web app is one file plus its data; nothing is built. What is left out is
   everything that is not the app: backend Workers, marketing, docs, tests, the
   Android project, this folder. Run before `npx cap sync ios`. */
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");
const out = resolve(here, "..", "www");
const skip = new Set([".git", ".github", ".claude", ".agents", ".playwright-mcp", ".wrangler", "node_modules", "backend", "marketing", "docs", "tests", "playstore", "scripts", "mobile", "review", "services", "skills", ".well-known", "CNAME", "TESTING.md", "0703eea26ef786413e910ec4d620b6a0.txt", "robots.txt", "sitemap.xml", "CLAUDE.md", "README.md", ".gitignore", ".DS_Store"]);

rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
/* copy entry by entry (the destination lives inside the source tree, which cpSync refuses as a whole) */
for (const name of readdirSync(root)) {
  if (skip.has(name) || name.endsWith(".DS_Store")) continue;
  cpSync(resolve(root, name), resolve(out, name), { recursive: true, filter: (src) => !src.endsWith(".DS_Store") });
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
/* Firebase follows the build (29 Sep 2026). The staging Workers verify the
   validation project be-mastery-test, so a staging bundle must sign in there:
   before this it kept the committed production block and signed staging
   testers into be-mastery. The swap happens in the COPY only, from
   staging-firebase.json; a production bundle is checked to carry be-mastery
   and nothing of the test project. Either mismatch stops the sync. */
const FB_BLOCK = /window\.FB_CONFIG=\{[\s\S]*?\};/;
let page = html;
if (staging) {
  writeFileSync(resolve(out, "be-build.js"), 'window.BE_BUILD={env:"staging",flags:{billing_enabled:true}};\n');
  const tag = '<script src="be-build.js"></script>';
  if (!page.includes("<head>")) throw new Error("<head> missing");
  page = page.replace("<head>", "<head>\n" + tag);
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
if (!staging && (/be-mastery-test/.test(page) || existsSync(resolve(out, "be-build.js")))) throw new Error("a production bundle must carry nothing of staging");
writeFileSync(resolve(out, "BUNDLE_INFO.txt"), `BE Mastery web bundle for iOS (${staging ? "STAGING — not for App Store submission" : "production"})\nfirebase ${project}\nsynced ${new Date().toISOString()}\nsource ${root}\n`);
console.log("www ready:", out);
