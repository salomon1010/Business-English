#!/usr/bin/env node
/* Builds the French pages of lomonec.com from the English ones.

     node scripts/site-fr/build.mjs

   site/index.html           -> site/fr/index.html            (home.fr.mjs)
   site/bemastery/index.html -> site/bemastery/fr/index.html  (bemastery.fr.mjs)

   The English page stays the only source of the markup: this script copies
   it, sets lang="fr", points relative paths one folder up and swaps every
   English string listed in the dictionary for its French one. A dictionary
   entry that no longer matches (the English was edited) stops the build and
   is listed, so a changed sentence can never ship half-translated. Run again
   after any edit to the English page, then check the French page. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(here, "../../site");

const PAGES = [
  { src: "index.html",           out: "fr/index.html",           dict: "./home.fr.mjs" },
  { src: "bemastery/index.html", out: "bemastery/fr/index.html", dict: "./bemastery.fr.mjs" },
];

let failed = false;
for (const p of PAGES) {
  const pairs = (await import(p.dict)).default;
  let html = fs.readFileSync(path.join(SITE, p.src), "utf8");

  html = html.replace('<html lang="en">', '<html lang="fr">');

  /* longest first, so a short entry never cuts into a longer sentence */
  const missing = [];
  [...pairs].sort((a, b) => b[0].length - a[0].length).forEach(([en, fr]) => {
    if (!html.includes(en)) { missing.push(en); return; }
    html = html.split(en).join(fr);
  });

  /* the page is one folder deeper: relative src/href go up one level */
  html = html.replace(/(\s(?:src|href)=")(?!https?:|mailto:|#|\/|data:)/g, "$1../");

  if (missing.length) {
    failed = true;
    console.error(`\n${p.src}: ${missing.length} English string(s) not found — update ${p.dict}:`);
    missing.forEach((m) => console.error("  · " + m.slice(0, 110).replace(/\n/g, "\\n")));
    continue;
  }
  const out = path.join(SITE, p.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`${p.out}: ${pairs.length} strings translated`);
}
process.exit(failed ? 1 : 0);
