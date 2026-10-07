#!/usr/bin/env node
/* Builds every translated page of lomonec.com from the English ones.

     node scripts/site-i18n/build.mjs            all languages
     node scripts/site-i18n/build.mjs es         one language (the others are left as they are)

   For each language with dictionaries in this folder:
     home.<code>.mjs      site/index.html           -> site/<code>/index.html
     bemastery.<code>.mjs site/bemastery/index.html -> site/bemastery/<code>/index.html
     labels.<code>.mjs    the words js/config.js + js/app.js draw
                          -> site/bemastery/js/i18n/<code>.js

   The English page stays the only source of the markup. The build copies it,
   sets lang (and dir="rtl" for Arabic and Urdu), points relative paths one
   folder up and swaps every English string in the dictionary for its
   translation. An entry that no longer matches (the English was edited), or
   a script label with no translation, stops the build and is listed, so a
   changed sentence never ships half-translated. It also rewrites, in the
   English pages, the language drop-down and the hreflang links between the
   i18n:* comment markers, from langs.mjs. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { LANGS } from "./langs.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(here, "../../site");
const ONLY = process.argv[2] || "";

const PAGES = [
  { key: "home", src: "index.html", base: "/", indent: "    " },
  { key: "bemastery", src: "bemastery/index.html", base: "/bemastery/", indent: "        " },
];

/* languages that have their translations in this folder */
const BUILT = LANGS.filter((l) => l.code === "en" ||
  PAGES.every((p) => fs.existsSync(path.join(here, `${p.key}.${l.code}.mjs`))) &&
  fs.existsSync(path.join(here, `labels.${l.code}.mjs`)));

const url = (p, code) => p.base + (code === "en" ? "" : code + "/");
const CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

function langBlock(p, lang, labels) {
  const i = p.indent;
  const aria = (labels["Language: {name}"] || "Language: {name}").replace("{name}", lang.name);
  return `<details class="lang" data-lang>\n` +
    `${i}  <summary aria-label="${aria}">${lang.flag}<span>${lang.code.toUpperCase()}</span>${CHEV}</summary>\n` +
    `${i}  <div class="lang-menu">\n` +
    /* the row follows the page's direction (flags line up); the name's own
       script direction is kept by dir="auto" on its span */
    BUILT.map((l) => `${i}    <a href="${url(p, l.code)}" hreflang="${l.code}" lang="${l.code}"` +
      ` aria-current="${l.code === lang.code}">${l.flag}<span dir="auto">${l.name}</span></a>\n`).join("") +
    `${i}  </div>\n${i}</details>`;
}
/* head of every page: the hreflang links, then two things that make a
   language switch feel instant —
   · speculation rules: Chrome starts loading (prerenders) a language as soon
     as its link is pressed or hovered (Safari ignores this; the page scripts
     prefetch on press instead);
   · a flag check, before anything paints: a page reached from the language
     menu skips its entrance animation (html.lang-swap, set by the menu's
     click handler in sessionStorage — see langSwap in app.js / lomonec.js). */
const SPEC = JSON.stringify({ prerender: [{ where: { selector_matches: ".lang-menu a" }, eagerness: "moderate" }] });
const SWAP = '<script>try{if(sessionStorage.getItem("be_lang_swap"))document.documentElement.classList.add("lang-swap","lang-swap-in")}catch(e){}</script>';
function alternates(p) {
  return BUILT.map((l) => `<link rel="alternate" hreflang="${l.code}" href="https://lomonec.com${url(p, l.code)}">`)
    .concat(`<link rel="alternate" hreflang="x-default" href="https://lomonec.com${p.base}">`,
            `<script type="speculationrules">${SPEC}</script>`, SWAP).join("\n");
}
function region(html, name, inner) {
  const re = new RegExp(`(<!-- i18n:${name} -->)[\\s\\S]*?(<!-- /i18n:${name} -->)`);
  if (!re.test(html)) throw new Error(`marker <!-- i18n:${name} --> missing`);
  return html.replace(re, (_, a, b) => a + (name === "alternates" ? "\n" + inner + "\n" : inner) + b);
}

/* every label the page scripts ask for: L("…") in config.js, T("…") in app.js */
const JS = ["bemastery/js/config.js", "bemastery/js/app.js"].map((f) => fs.readFileSync(path.join(SITE, f), "utf8")).join("\n");
const LABEL_KEYS = [...new Set([...JS.matchAll(/\b[LT]\("((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`)))]
  .concat("Language: {name}");

let failed = false;
const report = (what, list) => {
  failed = true;
  console.error(`\n${what}:`);
  list.forEach((m) => console.error("  · " + m.slice(0, 120).replace(/\n/g, "\\n")));
};

/* 1 — the English pages: drop-down + alternates */
const SRC = {};
for (const p of PAGES) {
  let html = fs.readFileSync(path.join(SITE, p.src), "utf8");
  html = region(html, "alternates", alternates(p));
  html = region(html, "lang", langBlock(p, LANGS[0], {}));
  /* a one-language build (a translator checking their work) leaves the
     shared English pages alone, so several can run at once */
  if (!ONLY) fs.writeFileSync(path.join(SITE, p.src), html);
  SRC[p.key] = html;
}

/* 2 — every other language */
for (const lang of BUILT) {
  if (lang.code === "en" || (ONLY && ONLY !== lang.code)) continue;
  const labels = (await import(`./labels.${lang.code}.mjs`)).default;
  const noLabel = LABEL_KEYS.filter((k) => !(k in labels));
  if (noLabel.length) { report(`labels.${lang.code}.mjs: ${noLabel.length} label(s) not translated`, noLabel); continue; }

  const js = `/* generated by scripts/site-i18n/build.mjs — do not edit */\nwindow.BEM_I18N=${JSON.stringify(labels)};\n`;
  const jsFile = path.join(SITE, `bemastery/js/i18n/${lang.code}.js`);
  fs.mkdirSync(path.dirname(jsFile), { recursive: true });
  fs.writeFileSync(jsFile, js);
  const jsVer = crypto.createHash("sha1").update(js).digest("hex").slice(0, 8);

  for (const p of PAGES) {
    const pairs = (await import(`./${p.key}.${lang.code}.mjs`)).default;
    let html = region(SRC[p.key], "lang", "@@LANG@@");
    html = html.replace('<html lang="en">', `<html lang="${lang.code}"${lang.dir ? ` dir="${lang.dir}"` : ""}>`);

    /* longest first, so a short entry never cuts into a longer sentence */
    const missing = [];
    [...pairs].sort((a, b) => b[0].length - a[0].length).forEach(([en, tr]) => {
      if (!html.includes(en)) { missing.push(en); return; }
      html = html.split(en).join(tr);
    });
    if (missing.length) { report(`${p.key}.${lang.code}.mjs: ${missing.length} English string(s) not found`, missing); continue; }

    /* the same for every language: this page's own address, and links that
       must stay inside the language */
    const own = "https://lomonec.com" + url(p, lang.code);
    html = html.replace(`<link rel="canonical" href="https://lomonec.com${p.base}">`, `<link rel="canonical" href="${own}">`)
               .replace(`<meta property="og:url" content="https://lomonec.com${p.base}">`, `<meta property="og:url" content="${own}">`);
    if (p.key === "home") {
      html = html.split('href="/bemastery/"').join(`href="/bemastery/${lang.code}/"`);
    } else {
      html = html.replace(`"url":"https://lomonec.com${p.base}",`, `"url":"${own}",`)
                 .replace("<body>", '<body data-root="../">')
                 .replace('<a href="/">LOMON EC LLC</a>', `<a href="/${lang.code}/">LOMON EC LLC</a>`)
                 .replace('<script src="js/config.js', `<script src="js/i18n/${lang.code}.js?v=${jsVer}"></script>\n<script src="js/config.js`);
    }
    /* one folder deeper: relative src/href go up one level */
    html = html.replace(/(\s(?:src|href)=")(?!https?:|mailto:|#|\/|data:)/g, "$1../");
    html = html.replace("@@LANG@@", langBlock(p, lang, labels));

    const out = path.join(SITE, path.dirname(p.src), lang.code, "index.html");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    console.log(`${path.relative(SITE, out)}: ${pairs.length} strings`);
  }
}
console.log(`languages: ${BUILT.map((l) => l.code).join(" ")}`);
process.exit(failed ? 1 : 0);
