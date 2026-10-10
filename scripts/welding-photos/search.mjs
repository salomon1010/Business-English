/* Welding Mastery — find freely licensed photographs on Wikimedia Commons for the terms
   that still show a drawing. Read-only: it writes candidates to scripts/welding-photos/out/
   (git-ignored) and an HTML contact sheet to review by eye. Nothing is downloaded into the
   app here — fetch.mjs does that for the picks.
     node scripts/welding-photos/search.mjs            (all terms still drawn)
     node scripts/welding-photos/search.mjs wm-file    (one term)
   Licences kept: CC0, public domain, CC BY, CC BY-SA (any version). Never NC / ND / fair use. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const root = new URL("../../", import.meta.url).pathname;
const OUT = root + "scripts/welding-photos/out/";
mkdirSync(OUT, { recursive: true });
const m = JSON.parse(readFileSync(root + "tracks/welding/mastery.json", "utf8"));
const have = JSON.parse(readFileSync(root + "tracks/welding/photos/credits.json", "utf8"));
/* better search words than the bare term, where the trade word is ambiguous */
const Q = {
  "wm-earth-clamp": ["welding ground clamp", "welding earth clamp", "ground clamp welder"],
  "wm-chipping-hammer": ["chipping hammer", "welding chipping hammer", "slag hammer"],
  "wm-fillet-weld-gauge": ["fillet weld gauge", "weld gauge", "welding gauge"],
  "wm-file": ["metal file tool", "hand file metalworking", "flat file tool"],
  "wm-scriber": ["scriber tool", "metal scriber", "scribing tool"],
  "wm-leather-apron": ["welding apron", "leather apron", "blacksmith apron"],
  "wm-ear-defenders": ["ear defenders", "earmuffs hearing protection", "hearing protection earmuffs"],
  "wm-welding-screen": ["welding screen", "welding curtain", "welding protection curtain"],
  "wm-tungsten-electrode": ["tungsten electrode", "TIG electrode", "tungsten electrodes welding"],
  "wm-contact-tip": ["MIG contact tip", "welding contact tip", "MIG torch nozzle tip"],
  "wm-plate": ["steel plate", "steel plates stack", "metal plate steel"],
  "wm-t-joint": ["T-joint weld", "tee joint welding", "fillet weld T joint"],
  "wm-corner-joint": ["corner joint weld", "corner weld steel", "welded corner joint"],
  "wm-bevel": ["bevel weld preparation", "beveled pipe welding", "pipe bevel"],
  "wm-root-gap": ["root gap welding", "weld root opening", "butt joint gap welding"],
  "wm-undercut": ["undercut weld", "weld undercut defect", "undercut welding"],
  "wm-porosity": ["weld porosity", "porosity welding defect", "gas porosity weld"],
  "wm-crack": ["weld crack", "crack in weld", "welding crack defect"],
  "wm-incomplete-penetration": ["incomplete penetration weld", "lack of penetration weld", "lack of fusion weld"],
  "wm-spatter": ["weld spatter", "welding spatter", "spatter welding"],
  "wm-overlap": ["weld overlap defect", "overlap welding", "cold lap weld"],
  "wm-burn-through": ["burn through weld", "weld burn-through", "burnthrough welding"],
  "wm-excess-reinforcement": ["excess weld reinforcement", "weld reinforcement", "excessive weld"],
};
/* second pass (--more): other wording and other languages, for the terms the first left bare */
const MORE = {
  "wm-welding-screen": ["Schweißvorhang", "welding curtain workshop", "rideau de soudure", "welding booth curtain"],
  "wm-t-joint": ["fillet weld", "Kehlnaht", "T-Stoß Schweißen", "soudure d'angle"],
  "wm-bevel": ["weld preparation bevel", "Schweißnahtvorbereitung", "chanfrein soudure", "V groove weld"],
  "wm-root-gap": ["butt weld preparation", "Stumpfnaht", "root pass pipe", "tack weld pipe"],
  "wm-porosity": ["Porosität Schweißnaht", "Schweißfehler", "weld defect", "porosité soudure", "pores weld"],
  "wm-incomplete-penetration": ["Bindefehler", "weld root defect", "manque de pénétration", "weld cross section macro"],
  "wm-spatter": ["Schweißspritzer", "welding spatter steel", "projections soudure", "spatter MIG"],
  "wm-overlap": ["Schweißfehler Überlappung", "weld macro section", "bad weld", "poor weld"],
  "wm-burn-through": ["Durchbrand Schweißen", "hole weld sheet metal", "bad weld hole", "burnt through weld"],
  "wm-excess-reinforcement": ["Nahtüberhöhung", "weld cap", "weld bead pipe", "weld seam close up"],
};
if (process.argv.includes("--more")) Object.assign(Q, MORE);
const only = process.argv.slice(2).find(a => !a.startsWith("--"));
const terms = m.terms.filter(t => t.img && !have[t.id] && (!only || t.id === only) && (!process.argv.includes("--more") || MORE[t.id]));
const OK = /^(cc0|public domain|pd|cc by(-sa)? \d(\.\d)?|cc by(-sa)?)/i;
const strip = s => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
async function search(q) {
  const u = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ action: "query", format: "json", generator: "search", gsrsearch: q + " filetype:bitmap", gsrnamespace: "6", gsrlimit: "12", prop: "imageinfo", iiprop: "url|size|extmetadata|mime", iiurlwidth: "480", origin: "*" });
  const r = await fetch(u, { headers: { "user-agent": "BE-Mastery-content-check/1.0 (contact@lomonec.com)" } });
  if (!r.ok) return [];
  const j = await r.json();
  return Object.values((j.query && j.query.pages) || {}).map(p => {
    const i = (p.imageinfo || [])[0] || {}, e = i.extmetadata || {};
    return { title: p.title, page: i.descriptionurl, thumb: i.thumburl, url: i.url, w: i.width, h: i.height, mime: i.mime,
      license: strip(e.LicenseShortName && e.LicenseShortName.value), licenseUrl: strip(e.LicenseUrl && e.LicenseUrl.value), author: strip(e.Artist && e.Artist.value), desc: strip(e.ImageDescription && e.ImageDescription.value).slice(0, 160) };
  }).filter(c => c.thumb && /jpeg|png/.test(c.mime || "") && c.w >= 500 && OK.test(c.license) && !/\bNC\b|\bND\b|non-?commercial|no ?deriv/i.test(c.license));
}
const all = {};
for (const t of terms) {
  const seen = new Set(), list = [];
  for (const q of Q[t.id] || [t.en]) {
    for (const c of await search(q)) if (!seen.has(c.title)) { seen.add(c.title); list.push(c); }
    await new Promise(r => setTimeout(r, 300));
  }
  all[t.id] = { en: t.en, candidates: list.slice(0, 18) };
  console.log(t.id.padEnd(28), list.length);
}
const tag = process.argv.includes("--more") ? "-more" : "";
writeFileSync(OUT + "candidates" + tag + ".json", JSON.stringify(all, null, 1));
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
writeFileSync(OUT + "sheet" + tag + ".html", `<!doctype html><meta charset="utf-8"><style>body{font:12px system-ui;background:#fff;margin:8px}h2{margin:14px 0 4px;font-size:15px}.r{display:flex;flex-wrap:wrap;gap:6px}figure{margin:0;width:150px}img{width:150px;height:110px;object-fit:cover;display:block;background:#eee}figcaption{font-size:10px;line-height:1.2;height:24px;overflow:hidden}</style>` +
  Object.entries(all).map(([id, v]) => `<h2>${esc(id)} — ${esc(v.en)}</h2><div class="r">${v.candidates.map((c, i) => `<figure><img src="${esc(c.thumb)}"><figcaption>${i}. ${esc(c.license)} · ${esc(c.title.replace(/^File:/, "").slice(0, 40))}</figcaption></figure>`).join("")}</div>`).join(""));
console.log("wrote", OUT + "candidates.json", "and sheet.html");
