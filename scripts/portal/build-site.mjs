/* Builds the app.lomonec.com site with the LOMON EC portal at the root and
   BE Mastery at /bemastery/ (docs/PORTAL.md). Nothing in the repository moves:
   the app stays at the repository root, where the tests, the iOS / Android
   bundles (mobile/ios/scripts/sync-web.mjs) and local development expect it.

     node scripts/portal/build-site.mjs [outDir]      # default: _site

   Layout of the output:
     /                      portal/index.html (+ 404.html, favicon.svg)
     /bemastery/            the web app — the same files the store bundles copy
     /sw.js                 portal/root-sw.js: retires the old root service worker
     /privacy.html, /delete-account.html
                            real copies: these addresses are registered in
                            App Store Connect and Play Console
     /yt-embed.html         real copy: the shipped iOS app frames this address
     /og.png, /logo.svg     real copies: shared links and the two pages above
     /.well-known/, IndexNow key, CNAME, .nojekyll
                            origin-level files that must stay at the root
     /<page>.html, /manual/<page>.html
                            forwarding stubs to /bemastery/<same path>, query
                            and hash kept (GitHub Pages has no server redirects)
     /robots.txt, /sitemap.xml   rewritten for the new layout
   Used by .github/workflows/pages-portal.yml; tests/portal.mjs serves the
   output and checks it. */
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const out = resolve(process.cwd(), process.argv[2] || resolve(root, "_site"));
const HOST = "https://app.lomonec.com";
const APP = "bemastery";

/* the output is deleted first: never the repository or a folder above it, and
   inside the repository only _site */
{
  const up = relative(out, root), down = relative(root, out);
  const outside = down.startsWith("..") || resolve(down) === down;
  if (up === "" || !up.startsWith("..") || (!outside && down !== "_site"))
    throw new Error("refusing to write into " + out + " — use _site or a folder outside the repository");
}

/* What is not the web app: the same list as mobile/ios/scripts/sync-web.mjs,
   plus this build's own inputs and output. Origin-level files (.well-known,
   CNAME, IndexNow key, robots, sitemap) are placed at the root below. */
const skip = new Set([".git", ".github", ".claude", ".agents", ".playwright-mcp", ".wrangler", "node_modules", "backend", "marketing", "docs", "tests", "playstore", "scripts", "mobile", "review", "services", "skills", "site", ".well-known", "CNAME", "TESTING.md", "0703eea26ef786413e910ec4d620b6a0.txt", "robots.txt", "sitemap.xml", "CLAUDE.md", "README.md", "CONTRIBUTING.md", ".gitignore", ".DS_Store",
  "portal", "_site", ".nojekyll"]);

rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(out, APP), { recursive: true });
const noDS = (src) => !src.endsWith(".DS_Store");

/* 1. the app, under /bemastery/ */
for (const name of readdirSync(root)) {
  if (skip.has(name) || name.endsWith(".DS_Store")) continue;
  cpSync(resolve(root, name), resolve(out, APP, name), { recursive: true, filter: noDS });
}
const appIndex = resolve(out, APP, "index.html");
if (!existsSync(appIndex)) throw new Error("index.html missing from /" + APP + "/");
const page = readFileSync(appIndex, "utf8");
/* the public site must carry the production Firebase project and no staging build tag */
const project = (/window\.FB_CONFIG=\{[\s\S]*?"?projectId"?\s*:\s*"([^"]+)"/.exec(page) || [])[1];
if (project !== "be-mastery") throw new Error("Firebase project is " + project + ", expected be-mastery");
if (/<script[^>]+src="be-build\.js"/.test(page) || existsSync(resolve(out, APP, "be-build.js"))) throw new Error("a staging build tag reached the public site");
if (!existsSync(resolve(out, APP, "sw.js"))) throw new Error("sw.js missing from /" + APP + "/");

/* 2. the portal at the root */
for (const f of ["index.html", "404.html", "favicon.svg"]) copyFileSync(resolve(root, "portal", f), resolve(out, f));
copyFileSync(resolve(root, "portal", "root-sw.js"), resolve(out, "sw.js"));

/* 3. real copies that must answer at their old root address */
const REAL = ["privacy.html", "delete-account.html", "yt-embed.html", "og.png", "logo.svg"];
for (const f of REAL) {
  if (!existsSync(resolve(root, f))) throw new Error(f + " missing");
  copyFileSync(resolve(root, f), resolve(out, f));
}
/* origin-level files */
for (const f of [".well-known", "CNAME", "0703eea26ef786413e910ec4d620b6a0.txt", ".nojekyll"]) {
  if (existsSync(resolve(root, f))) cpSync(resolve(root, f), resolve(out, f), { recursive: true, filter: noDS });
}
if (!existsSync(resolve(out, ".nojekyll"))) writeFileSync(resolve(out, ".nojekyll"), "");

/* 4. forwarding stubs for every other old page address */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function stub(rel) {
  const to = "/" + APP + "/" + rel;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BE Mastery has moved</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(HOST + to)}">
<script>location.replace(${JSON.stringify(to)}+location.search+location.hash)</script>
<meta http-equiv="refresh" content="0; url=${esc(to)}">
</head><body><p>BE Mastery has moved to <a href="${esc(to)}">${esc(HOST + to)}</a>.</p></body></html>
`;
  mkdirSync(dirname(resolve(out, rel)), { recursive: true });
  writeFileSync(resolve(out, rel), html);
}
const stubs = [];
for (const name of readdirSync(root)) {
  if (!name.endsWith(".html") || skip.has(name) || name === "index.html" || REAL.includes(name)) continue;
  if (!statSync(resolve(root, name)).isFile()) continue;
  stub(name); stubs.push(name);
}
if (existsSync(resolve(root, "manual"))) {
  for (const name of readdirSync(resolve(root, "manual"))) {
    if (!name.endsWith(".html")) continue;
    stub(join("manual", name)); stubs.push("manual/" + name);
  }
}

/* 5. robots + sitemap for the new layout */
writeFileSync(resolve(out, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${HOST}/sitemap.xml\n`);
const urls = ["/", "/" + APP + "/", "/" + APP + "/flyer.html", "/" + APP + "/manual/en.html", "/privacy.html", "/delete-account.html"];
writeFileSync(resolve(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${HOST}${u}</loc></url>`).join("\n")}\n</urlset>\n`);

/* size report — a Pages artifact must stay well under 1 GB */
let bytes = 0, files = 0;
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n), s = statSync(p); if (s.isDirectory()) walk(p); else { bytes += s.size; files++; } } })(out);
console.log(`site ready: ${out}\n  ${files} files, ${(bytes / 1048576).toFixed(1)} MB; ${stubs.length} forwarding stubs; Firebase ${project}`);
