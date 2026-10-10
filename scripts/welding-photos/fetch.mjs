/* Welding Mastery — download the photographs picked from search.mjs's contact sheets into
   tracks/welding/photos/ (hosted with the app, never hotlinked) and credit each one in
   credits.json (author, licence, link to its Commons page), as the licences require.
     node scripts/welding-photos/fetch.mjs
   The picks are by eye, from out/sheet*.png: term id → [sheet, index]. */
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../../", import.meta.url).pathname;
const OUT = root + "scripts/welding-photos/out/", DIR = root + "tracks/welding/photos/";
const PICKS = {
  /* 10 Oct 2026; rejected on sight: chipping hammer, scriber, contact tip (a cutaway drawing), corner joint, undercut */
  "wm-earth-clamp": ["", 0], "wm-fillet-weld-gauge": ["", 9], "wm-file": ["", 12],
  "wm-leather-apron": ["", 11], "wm-ear-defenders": ["", 2], "wm-tungsten-electrode": ["", 11],
  "wm-plate": ["", 7], "wm-crack": ["", 2],
  "wm-bevel": ["-more:wm-root-gap", 0], "wm-incomplete-penetration": ["-more", 0],
};
const sets = { "": JSON.parse(readFileSync(OUT + "candidates.json", "utf8")), "-more": JSON.parse(readFileSync(OUT + "candidates-more.json", "utf8")) };
const credits = JSON.parse(readFileSync(DIR + "credits.json", "utf8"));
const UA = { "user-agent": "BE-Mastery-content-check/1.0 (contact@lomonec.com)" };
for (const [id, [ref, i]] of Object.entries(PICKS)) {
  const [tag, from] = ref.split(":"), c = sets[tag][from || id].candidates[i];
  if (!c) { console.log("missing", id); continue; }
  /* a 1000-px-wide rendition from Commons' own thumbnailer: sharp on a phone, ~100 KB */
  const q = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ action: "query", format: "json", titles: c.title, prop: "imageinfo", iiprop: "url", iiurlwidth: "1000", origin: "*" });
  const j = await (await fetch(q, { headers: UA })).json();
  const info = Object.values(j.query.pages)[0].imageinfo[0];
  const src = /\.png$/i.test(c.title) ? info.thumburl.replace(/\.png$/i, ".png") : info.thumburl;
  const r = await fetch(src, { headers: UA });
  if (!r.ok) { console.log("download failed", id, r.status); continue; }
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = /png/.test(r.headers.get("content-type") || "") ? "png" : "jpg";
  const file = id + "." + ext;
  writeFileSync(DIR + file, buf);
  credits[id] = { file, title: c.title, source: c.page, author: c.author || "Wikimedia Commons contributor", license: c.license, licenseUrl: c.licenseUrl || "" };
  console.log(id.padEnd(28), (buf.length / 1024).toFixed(0) + " KB", c.license, "·", c.title.slice(5, 60));
  await new Promise(r => setTimeout(r, 400));
}
writeFileSync(DIR + "credits.json", JSON.stringify(credits, null, 2) + "\n");
console.log("credits:", Object.keys(credits).length);
