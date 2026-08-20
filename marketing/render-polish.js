/* Render polish-flyer.src.html (already inlined by build-flyers.py) to the print
   master, and report the vertical layout so overflow is caught rather than
   cropped silently.

   python3 marketing/build-flyers.py polish
   NODE_PATH=<where playwright-core is> node marketing/render-polish.js
   python3 marketing/build-share.py polish
*/
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const HERE = __dirname;

(async () => {
  const html = fs.readFileSync(path.join(HERE, 'build/polish-flyer.html'), 'utf8');
  const b = await chromium.launch({ executablePath: process.env.CHROME ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(900);

  const info = await p.evaluate(() => {
    const bot = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().bottom) : null };
    return { h1: bot('h1'), sub: bot('.sub'), swap: bot('.swap'), phones: bot('.phones'),
             loop: bot('.loop'), trust: bot('.trust'), note: bot('.note'),
             ctaTop: Math.round(document.querySelector('.cta').getBoundingClientRect().top),
             foot: bot('.foot'), page: document.querySelector('.page').scrollHeight };
  });
  console.log(JSON.stringify(info, null, 1));
  if (info.foot > 1920) console.error('OVERFLOW: footer runs past the page');
  if (info.ctaTop - info.note < 8) console.error('TIGHT: the CTA is touching the block above it');

  await p.screenshot({ path: path.join(HERE, 'polish-flyer@2x.png') });
  await b.close();
})();
