/* Renders the welcome-email hero as an animated GIF (mail/welcome.gif) and a
   still (mail/welcome.png). Email clients play GIFs, not video — this is the
   Roku-style "little movie" at the top of the welcome message: the tagline,
   then one card per thing the learner can do, on the app's purple gradient.
     node scripts/mail/hero.mjs            (needs tests/node_modules playwright + python3 Pillow)
   Frames are shot at 2× and assembled by Pillow with a 128-colour palette so
   the file stays well under 1 MB. Text is drawn here in English on purpose:
   the email body is localised, the picture is the same for everyone. */
import { createRequire } from "node:module";
const { chromium } = createRequire(new URL("../../tests/package.json", import.meta.url))("playwright");   // the tests folder holds the only playwright install
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
const root = new URL("../..", import.meta.url).pathname;
const icons = JSON.parse(readFileSync(new URL("./icons.json", import.meta.url), "utf8"));
const tmp = root + "mail/.frames"; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const W = 600, H = 300;
const slides = [
  { kind: "title", h: "Welcome to BE Mastery", s: "25 focused minutes a day. Confident, professional English." },
  { icon: "map", h: "Your road map", s: "A 12-week plan — one clear step every day." },
  { icon: "headphones", h: "Shadow Studio", s: "Copy a native speaker's rhythm, line by line." },
  { icon: "chat", h: "Phrase Lab & Executive Polish", s: "Your own sentences, made boardroom-ready." },
  { icon: "user", h: "Practice Partner", s: "Short voice turns with a real learner — no scheduling." },
  { kind: "title", h: "Your first 25 minutes start today.", s: "app.lomonec.com" },
];
const page = await (await chromium.launch()).newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const svg = k => `<svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[k]}</svg>`;
const frame = (sl, t) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  body{background:linear-gradient(135deg,#1b1747 0%,#3b2a9e 45%,#6d5dfc 100%);color:#fff;position:relative}
  .blob{position:absolute;border-radius:24px;background:linear-gradient(135deg,#f6a05a,#f05d8f);opacity:.85}
  .b1{width:150px;height:60px;left:${-40 + t * 30}px;top:${40 + t * 12}px;transform:rotate(-8deg)}
  .b2{width:110px;height:110px;right:${-30 + t * 22}px;bottom:${-20 + t * 10}px;border-radius:50% 50% 0 50%}
  .b3{width:60px;height:60px;left:${420 + t * 16}px;top:${18 + t * 6}px;opacity:.55;border-radius:50%}
  .card{position:absolute;inset:36px 54px;border:2px solid rgba(255,255,255,.55);border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 40px;background:rgba(255,255,255,.06)}
  .ic{width:56px;height:56px;margin-bottom:12px;opacity:${sl.kind === "title" ? 0 : 1}}
  h1{font-size:${sl.kind === "title" ? 36 : 30}px;font-weight:800;margin:0 0 10px;letter-spacing:-.3px;line-height:1.15}
  p{font-size:17px;margin:0;opacity:.92;line-height:1.4}
  .brand{position:absolute;left:24px;top:16px;font-weight:800;font-size:15px;letter-spacing:.3px;opacity:.9}.brand span{color:#67e8f9}
  .dots{position:absolute;bottom:14px;left:0;right:0;text-align:center}.dots i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#fff;opacity:.35;margin:0 3px}.dots i.on{opacity:1}
</style></head><body>
  <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
  <div class="brand">BE <span>Mastery</span></div>
  <div class="card">${sl.icon ? `<div class="ic">${svg(sl.icon)}</div>` : ""}<h1>${sl.h}</h1><p>${sl.s}</p></div>
  <div class="dots">${slides.map((_, i) => `<i class="${slides[i] === sl ? "on" : ""}"></i>`).join("")}</div>
</body></html>`;
let n = 0;
for (const sl of slides) { await page.setContent(frame(sl, slides.indexOf(sl))); await page.screenshot({ path: `${tmp}/f${String(n++).padStart(2, "0")}.png` }); }
await page.context().browser().close();
execFileSync("python3", ["-c", `
from PIL import Image
import glob
fr=[Image.open(p).convert("RGB").resize((${W},${H}),Image.LANCZOS) for p in sorted(glob.glob("${tmp}/f*.png"))]
q=[f.quantize(colors=128,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.FLOYDSTEINBERG) for f in fr]
dur=[2600]+[1900]*(len(q)-2)+[2600]
q[0].save("${root}mail/welcome.gif",save_all=True,append_images=q[1:],duration=dur,loop=0,optimize=True)
fr[0].save("${root}mail/welcome.png",optimize=True)
import os;print("gif",os.path.getsize("${root}mail/welcome.gif"),"png",os.path.getsize("${root}mail/welcome.png"))
`]);
rmSync(tmp, { recursive: true, force: true });
