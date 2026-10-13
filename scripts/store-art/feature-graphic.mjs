/* Play feature graphic — 1024×500, one per app.
 *
 *   python3 -m http.server 8767 --bind 127.0.0.1
 *   node scripts/store-art/feature-graphic.mjs welding
 *   node scripts/store-art/feature-graphic.mjs general
 *
 * Output: playstore/welding/feature-graphic.png (welding)
 *         playstore/feature-graphic-general.png (general — the existing
 *         playstore/feature-graphic.png is the live listing's and is NOT
 *         overwritten).
 *
 * Built from the app's OWN assets and palette, so the banner, the launcher icon
 * and the app agree: the programme's mark (welding-mastery-logo.svg /
 * logo.svg), the programme's accent (--acc2 gold on --bg navy for Welding) and
 * one of the programme's own photographs. Nothing is invented and no third-party
 * artwork is used — the same rule the screenshot sets follow.
 *
 * Play's safe area: the graphic is cropped on some surfaces, so nothing that
 * matters sits in the outer 10%, and the text block is left-weighted with the
 * image bleeding off the right.
 */
import { chromium } from "../../tests/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const BASE = process.env.BASE || "http://127.0.0.1:8767";

const ART = {
  welding: {
    out: "playstore/welding/feature-graphic.png",
    mark: "welding-mastery-logo.svg",
    photo: "home-photos/welding/convo.jpg",
    bg: "#0a0e1a", bg2: "#141b30", accent: "#f6c453", sub: "#c9cfdc",
    title: "BE Mastery", tag: "Welding English",
    line: "Speak English on the floor, in the toolbox talk, in the interview.",
  },
  general: {
    out: "playstore/feature-graphic-general.png",
    mark: "logo.svg",
    photo: "home-photos/phrases.jpg",
    bg: "#0b0f1a", bg2: "#151c2e", accent: "#5b8cff", sub: "#c9cfdc",
    title: "BE Mastery", tag: "General English",
    line: "25 focused minutes a day until the hesitation is gone.",
  },
};

const which = process.argv[2] || "welding";
const A = ART[which];
if (!A) { console.error("usage: feature-graphic.mjs [welding|general]"); process.exit(2); }

const html = `<!doctype html><meta charset="utf-8">
<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap");
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1024px;height:500px;overflow:hidden}
  body{background:${A.bg};font-family:Inter,-apple-system,system-ui,sans-serif;color:#fff;position:relative}
  /* the photograph bleeds off the right, faded into the background so the
     text side stays legible at any crop */
  .ph{position:absolute;inset:0 0 0 46%;background:url("${BASE}/${A.photo}") center/cover no-repeat;}
  .ph::after{content:"";position:absolute;inset:0;
    background:linear-gradient(90deg,${A.bg} 0%,${A.bg}dd 18%,${A.bg}66 55%,${A.bg}22 100%)}
  .glow{position:absolute;left:-120px;top:-140px;width:620px;height:620px;border-radius:50%;
    background:radial-gradient(circle,${A.accent}22 0%,transparent 62%)}
  .wrap{position:absolute;inset:0;display:flex;align-items:center;gap:34px;padding:0 0 0 72px}
  .mark{width:124px;height:124px;flex:0 0 124px;border-radius:30px;background:${A.bg2};
    display:grid;place-items:center;box-shadow:0 18px 50px rgba(0,0,0,.55)}
  .mark img{width:124px;height:124px;border-radius:30px;display:block}
  .tx{max-width:470px}
  .t{font-size:46px;font-weight:800;letter-spacing:-.6px;line-height:1.02}
  .t em{font-style:normal;color:${A.accent}}
  .g{font-size:30px;font-weight:800;color:${A.accent};letter-spacing:-.3px;margin-top:2px}
  .l{font-size:19px;font-weight:400;color:${A.sub};line-height:1.45;margin-top:16px}
  .by{position:absolute;left:72px;bottom:34px;font-size:13px;font-weight:600;color:#7b8499;letter-spacing:.14em;text-transform:uppercase}
</style>
<div class="ph"></div><div class="glow"></div>
<div class="wrap">
  <div class="mark"><img src="${BASE}/${A.mark}" alt=""></div>
  <div class="tx">
    <div class="t">BE <em>Mastery</em></div>
    <div class="g">${A.tag}</div>
    <div class="l">${A.line}</div>
  </div>
</div>
<div class="by">Lomonec LLC</div>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await p.setContent(html, { waitUntil: "load" });
await p.waitForTimeout(1200);                       // webfont + the photograph
const out = resolve(root, A.out);
mkdirSync(dirname(out), { recursive: true });
await p.screenshot({ path: out });
await b.close();
console.log(`${which} -> ${A.out}  (1024x500)`);
