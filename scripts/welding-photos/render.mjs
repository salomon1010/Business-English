/* Welding Mastery — our own picture-style illustrations (owner, 10 Oct 2026) for the 13
   terms Wikimedia Commons has no clear, freely licensed photograph of. Original work by
   Lomonec LLC: drawn here in SVG (shaded steel, copper, rippled weld beads, heat tint),
   rendered to JPEG by headless Chromium, and credited as "Illustration: Lomonec LLC" —
   never passed off as a photograph.
     node scripts/welding-photos/render.mjs            (all 13)
     node scripts/welding-photos/render.mjs wm-spatter (one) */
import { chromium } from "../../tests/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../../", import.meta.url).pathname, DIR = root + "tracks/welding/photos/";
const W = 800, H = 600;

/* ---- shared look: a cool blue-grey steel with a teal cast, warm workshop light */
const DEFS = `<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#36404d"/><stop offset=".62" stop-color="#4a5562"/><stop offset="1" stop-color="#2a313b"/></linearGradient>
 <radialGradient id="lamp" cx=".3" cy=".18" r=".9"><stop offset="0" stop-color="#ffe3b8" stop-opacity=".28"/><stop offset=".55" stop-color="#ffe3b8" stop-opacity="0"/></radialGradient>
 <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
 <linearGradient id="top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9c9cf"/><stop offset=".5" stop-color="#8fa4ad"/><stop offset="1" stop-color="#6c818b"/></linearGradient>
 <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b6c75"/><stop offset="1" stop-color="#3a464d"/></linearGradient>
 <linearGradient id="side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4c5b63"/><stop offset="1" stop-color="#2f3a40"/></linearGradient>
 <linearGradient id="vert" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7d929b"/><stop offset=".55" stop-color="#a9bcc3"/><stop offset="1" stop-color="#687c86"/></linearGradient>
 <radialGradient id="rip" cx=".45" cy=".35" r=".7"><stop offset="0" stop-color="#f6f1e6"/><stop offset=".45" stop-color="#c3bba9"/><stop offset=".85" stop-color="#7b7466"/><stop offset="1" stop-color="#5a554b"/></radialGradient>
 <radialGradient id="ball" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fbf6ea"/><stop offset=".4" stop-color="#a9a293"/><stop offset="1" stop-color="#3f3b34"/></radialGradient>
 <radialGradient id="pore" cx=".55" cy=".6" r=".6"><stop offset="0" stop-color="#14110d"/><stop offset=".7" stop-color="#2b2620"/><stop offset="1" stop-color="#8d8573"/></radialGradient>
 <linearGradient id="cu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7c08f"/><stop offset=".35" stop-color="#d9844d"/><stop offset=".7" stop-color="#a5552a"/><stop offset="1" stop-color="#6e3317"/></linearGradient>
 <linearGradient id="rod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef3f5"/><stop offset=".45" stop-color="#9aa9b0"/><stop offset="1" stop-color="#4a575d"/></linearGradient>
 <linearGradient id="paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fb3d6"/><stop offset=".5" stop-color="#2f7fae"/><stop offset="1" stop-color="#1b4f70"/></linearGradient>
 <linearGradient id="curt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9532b" stop-opacity=".88"/><stop offset=".5" stop-color="#ff8a4c" stop-opacity=".82"/><stop offset="1" stop-color="#c2421f" stop-opacity=".9"/></linearGradient>
 <filter id="tex" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.04" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .55 0" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="gi"/><feBlend in="SourceGraphic" in2="gi" mode="overlay"/></filter>
 <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="2" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .18 0" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="gi"/><feBlend in="SourceGraphic" in2="gi" mode="overlay"/></filter>
 <filter id="soft"><feGaussianBlur stdDeviation="9"/></filter>
 <filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
 <filter id="drop" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#000" flood-opacity=".5"/></filter>
</defs>`;
const scene = body => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}
 <rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#lamp)"/>
 <rect y="${H * .62}" width="${W}" height="${H * .38}" fill="#20262d" opacity=".55" filter="url(#grain)"/>
 ${body}
 <rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;

/* a plate in a three-quarter view: top face, front edge, right edge */
function plate(x, y, w, d, t, sk = d * .55) {
  const top = `${x},${y} ${x + w},${y} ${x + w + sk},${y - d} ${x + sk},${y - d}`;
  return `<g filter="url(#drop)"><polygon points="${top}" fill="url(#top)" filter="url(#tex)"/>
   <polygon points="${x},${y} ${x + w},${y} ${x + w},${y + t} ${x},${y + t}" fill="url(#edge)"/>
   <polygon points="${x + w},${y} ${x + w + sk},${y - d} ${x + w + sk},${y - d + t} ${x + w},${y + t}" fill="url(#side)"/>
   <polyline points="${x},${y} ${x + w},${y} ${x + w + sk},${y - d}" fill="none" stroke="#e6f0f2" stroke-opacity=".55" stroke-width="1.5"/></g>`;
}
/* a weld bead from (x0,y0) to (x1,y1): overlapping ripples drawn far-to-near, heat tint beside it */
function bead(x0, y0, x1, y1, wd, o = {}) {
  const n = o.n || Math.round(Math.hypot(x1 - x0, y1 - y0) / (wd * .26)), ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
  const hgt = o.h || 1, rx = wd / 2, ry = wd * .3 * hgt;
  let out = `<g><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#d6a95f" stroke-width="${wd * 2.1}" stroke-opacity=".38" stroke-linecap="round" filter="url(#soft)"/>
   <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#6d5aa0" stroke-width="${wd * 1.45}" stroke-opacity=".35" stroke-linecap="round" filter="url(#soft)"/>
   <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#2c2924" stroke-width="${wd * 1.04}" stroke-linecap="round" stroke-opacity=".75"/>`;
  for (let i = 0; i <= n; i++) {
    const f = i / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
    out += `<ellipse cx="${x.toFixed(1)}" cy="${(y - (hgt - 1) * wd * .18).toFixed(1)}" rx="${(ry * 1.15).toFixed(1)}" ry="${rx.toFixed(1)}" transform="rotate(${ang.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#rip)" stroke="#4d483f" stroke-width="1.2" stroke-opacity=".7"/>`;
  }
  return out + `</g>`;
}
const pt = (x0, y0, x1, y1, f, off = 0) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); return [x0 + dx * f - dy / L * off, y0 + dy * f + dx / L * off]; };
const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(42);

const SCENES = {
  /* the defects: one plate, one bead, the fault drawn where a welder would see it */
  "wm-porosity": () => { const b = [190, 380, 640, 250]; let s = plate(90, 470, 560, 260, 26) + bead(...b, 70);
    for (const [f, o, r] of [[.12, 6, 7], [.2, -10, 5], [.31, 4, 9], [.38, -6, 4], [.47, 9, 6], [.55, -3, 8], [.63, 7, 5], [.71, -9, 6], [.8, 2, 7], [.88, -5, 4]]) { const [x, y] = pt(...b, f, o); s += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .8}" fill="url(#pore)"/>`; }
    return s; },
  "wm-spatter": () => { const b = [190, 380, 640, 250]; let s = plate(90, 470, 560, 260, 26) + bead(...b, 64);
    for (let i = 0; i < 70; i++) { const f = rnd(), side = rnd() < .5 ? -1 : 1, off = side * (48 + rnd() * 130), [x, y] = pt(...b, f, off), r = 2.5 + rnd() * 6.5;
      s += `<ellipse cx="${x + 2}" cy="${y + r * .7}" rx="${r}" ry="${r * .45}" fill="#000" opacity=".35"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#ball)"/>`; }
    return s; },
  "wm-undercut": () => { const b = [190, 380, 640, 250]; let s = plate(90, 470, 560, 260, 26) + bead(...b, 66);
    const [ax, ay] = pt(...b, 0, -44), [bx, by] = pt(...b, 1, -44), [cx, cy] = pt(...b, 0, -38), [dx, dy] = pt(...b, 1, -38);
    s += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#15130f" stroke-width="10" stroke-linecap="round"/><line x1="${cx}" y1="${cy}" x2="${dx}" y2="${dy}" stroke="#e9eef0" stroke-width="2" stroke-opacity=".6"/>`;
    return s; },
  "wm-overlap": () => { const b = [190, 380, 640, 250]; let s = plate(90, 470, 560, 260, 26);
    /* weld metal rolled over the near toe without fusing: a smooth lip, a dark crease under it */
    const P = (f, o) => pt(...b, f, o).map(v => v.toFixed(1)).join(",");
    s += `<polygon points="${P(.04, 30)} ${P(.96, 30)} ${P(.92, 62)} ${P(.08, 62)}" fill="#c9c2b2" stroke="#6f685b" stroke-width="2"/>
      <line x1="${pt(...b, .08, 64)[0]}" y1="${pt(...b, .08, 64)[1]}" x2="${pt(...b, .92, 64)[0]}" y2="${pt(...b, .92, 64)[1]}" stroke="#0d0b08" stroke-width="7" stroke-linecap="round"/>
      <line x1="${pt(...b, .1, 52)[0]}" y1="${pt(...b, .1, 52)[1]}" x2="${pt(...b, .9, 52)[0]}" y2="${pt(...b, .9, 52)[1]}" stroke="#f3eee2" stroke-width="3" stroke-opacity=".7"/>` + bead(...b, 70);
    return s; },
  "wm-burn-through": () => { const b = [190, 380, 640, 250]; let s = plate(90, 470, 560, 210, 12) + bead(190, 380, 380, 324, 60) + bead(500, 289, 640, 250, 60);
    s += `<path d="M380 300 q24 -26 60 -18 q34 4 62 0 q18 22 6 48 q-26 30 -66 26 q-40 2 -64 -18 q-14 -18 2 -38z" fill="#0a0806"/><path d="M380 300 q24 -26 60 -18 q34 4 62 0 q18 22 6 48 q-26 30 -66 26 q-40 2 -64 -18 q-14 -18 2 -38z" fill="none" stroke="#b9772f" stroke-width="7" stroke-opacity=".75" filter="url(#blur3)"/>
      <path d="M392 306 q20 -14 48 -10" stroke="#e8c48a" stroke-width="3" fill="none" opacity=".6"/>`;
    return s; },
  "wm-excess-reinforcement": () => { const b = [190, 380, 640, 250]; let s = plate(90, 470, 560, 260, 26);
    /* a butt joint whose cap stands far too proud of the plate: a tall bead, its profile on the front edge */
    s += bead(...b, 86, { h: 2.6 });
    const [fx, fy] = [190, 470];
    s += `<path d="M${fx - 46} ${fy} q46 -150 92 0z" fill="url(#rip)" stroke="#4d483f" stroke-width="2"/><line x1="${fx}" y1="${fy}" x2="${fx}" y2="${fy + 26}" stroke="#20262b" stroke-width="2"/>`;
    return s; },
  "wm-root-gap": () => { let s = plate(70, 470, 300, 250, 44, 150);
    s += `<g filter="url(#drop)"><polygon points="430,470 730,470 880,220 580,220" fill="url(#top)" filter="url(#tex)"/><polygon points="430,470 730,470 730,514 448,514" fill="url(#edge)"/></g>`;
    s = s.replace(`<polygon points="70,470 370,470 370,514 70,514" fill="url(#edge)"/>`, `<polygon points="70,470 370,470 352,514 70,514" fill="url(#edge)"/>`);
    s += `<polygon points="370,470 430,470 448,514 352,514" fill="#10131a" opacity=".9"/><line x1="352" y1="540" x2="448" y2="540" stroke="#ffcf7a" stroke-width="3"/><line x1="352" y1="530" x2="352" y2="550" stroke="#ffcf7a" stroke-width="3"/><line x1="448" y1="530" x2="448" y2="550" stroke="#ffcf7a" stroke-width="3"/>`;
    return s; },
  /* joints */
  "wm-t-joint": () => { let s = plate(80, 480, 600, 230, 24, 150);
    s += `<g filter="url(#drop)"><polygon points="250,400 650,400 725,280 325,280" fill="none"/><polygon points="290,140 690,40 690,330 290,430" fill="url(#vert)" filter="url(#tex)"/><polygon points="290,140 270,148 270,438 290,430" fill="url(#edge)"/></g>`;
    s += bead(282, 440, 700, 334, 40, { h: 1.2 });
    return s; },
  "wm-corner-joint": () => { let s = plate(150, 480, 420, 230, 26, 170);
    s += `<g filter="url(#drop)"><polygon points="150,480 150,180 320,0 320,250" fill="url(#vert)" filter="url(#tex)"/><polygon points="150,180 126,188 126,488 150,480" fill="url(#edge)"/></g>`;
    s += bead(140, 486, 318, 254, 34, { h: 1.25 });
    return s; },
  /* tools and equipment */
  "wm-chipping-hammer": () => `<ellipse cx="420" cy="520" rx="300" ry="26" fill="#000" opacity=".4" filter="url(#soft)"/>
    <g filter="url(#drop)" transform="rotate(-14 400 300)">
      <polygon points="150,220 560,206 640,236 560,262 150,252" fill="url(#rod)" filter="url(#tex)"/>
      <polygon points="150,220 110,236 150,252" fill="#d7e1e5"/><polygon points="560,206 668,234 560,262" fill="url(#rod)"/>
      <rect x="330" y="246" width="34" height="58" rx="6" fill="url(#paint)"/>
      ${Array.from({ length: 13 }, (_, i) => `<ellipse cx="${347}" cy="${314 + i * 18}" rx="26" ry="9" fill="none" stroke="url(#rod)" stroke-width="7"/>`).join("")}
      <rect x="318" y="540" width="58" height="40" rx="12" fill="url(#paint)"/></g>`,
  "wm-scriber": () => plate(70, 500, 640, 260, 24, 170) + `<line x1="250" y1="410" x2="560" y2="330" stroke="#f4fbff" stroke-width="2.5" opacity=".85"/>
    <g filter="url(#drop)"><polygon points="250,410 300,372 310,380" fill="url(#rod)"/><polygon points="300,372 640,110 652,124 310,380" fill="url(#rod)"/>
      ${Array.from({ length: 16 }, (_, i) => { const x = 420 + i * 9, y = 280 - i * 6.9; return `<line x1="${x}" y1="${y}" x2="${x + 14}" y2="${y + 14}" stroke="#39454b" stroke-width="2"/>`; }).join("")}
      <polygon points="640,110 690,72 700,86 652,124" fill="url(#rod)"/></g>`,
  "wm-contact-tip": () => `<ellipse cx="400" cy="440" rx="300" ry="24" fill="#000" opacity=".45" filter="url(#soft)"/>
    <g filter="url(#drop)">
      <rect x="150" y="250" width="200" height="110" rx="6" fill="url(#cu)"/>
      ${Array.from({ length: 16 }, (_, i) => `<rect x="${154 + i * 12.4}" y="250" width="5" height="110" fill="#6e3317" opacity=".55"/>`).join("")}
      <rect x="350" y="262" width="260" height="86" rx="8" fill="url(#cu)" filter="url(#tex)"/>
      <polygon points="610,262 690,284 690,326 610,348" fill="url(#cu)"/>
      <ellipse cx="690" cy="305" rx="8" ry="21" fill="#a5552a"/><circle cx="690" cy="305" r="6" fill="#1a0d06"/></g>
    <line x1="692" y1="305" x2="790" y2="352" stroke="url(#rod)" stroke-width="6" stroke-linecap="round"/>`,
  "wm-welding-screen": () => { let s = `<ellipse cx="400" cy="548" rx="330" ry="22" fill="#000" opacity=".45" filter="url(#soft)"/>
    <g filter="url(#drop)"><rect x="110" y="70" width="580" height="16" rx="6" fill="url(#rod)"/><rect x="110" y="70" width="14" height="470" fill="url(#rod)"/><rect x="676" y="70" width="14" height="470" fill="url(#rod)"/>
      <rect x="60" y="532" width="114" height="14" rx="6" fill="url(#rod)"/><rect x="626" y="532" width="114" height="14" rx="6" fill="url(#rod)"/></g>
    <g>`;
    for (let i = 0; i < 9; i++) { const x = 124 + i * 61.3; s += `<rect x="${x}" y="86" width="62" height="430" fill="url(#curt)"/><rect x="${x + 44}" y="86" width="10" height="430" fill="#7a1f0b" opacity=".35"/><rect x="${x + 8}" y="86" width="6" height="430" fill="#ffd2b0" opacity=".35"/>`; }
    for (let i = 0; i < 10; i++) s += `<circle cx="${130 + i * 60}" cy="94" r="5" fill="#d7e1e5"/>`;
    return s + `</g><circle cx="420" cy="300" r="40" fill="#fff6d8" opacity=".55" filter="url(#soft)"/>`; },
};

const only = process.argv[2];
const credits = JSON.parse(readFileSync(DIR + "credits.json", "utf8"));
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
for (const [id, f] of Object.entries(SCENES)) {
  if (only && id !== only) continue;
  await p.setContent(`<html><body style="margin:0">${scene(f())}</body></html>`);
  await p.waitForTimeout(150);
  const file = id + ".jpg";
  await p.screenshot({ path: DIR + file, type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: W, height: H } });
  credits[id] = { file, title: "Illustration of a " + id.slice(3).replace(/-/g, " "), source: "", author: "Lomonec LLC", license: "Illustration", kind: "illustration" };
  console.log(id);
}
await b.close();
writeFileSync(DIR + "credits.json", JSON.stringify(credits, null, 2) + "\n");
