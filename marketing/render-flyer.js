const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

/* Self-contained: every input lives in the repo, so this reproduces from a
   clean checkout. It previously pointed at a session scratchpad that no longer
   exists, which made the script unrunnable. */
const HERE = __dirname;
const REPO = path.resolve(HERE, '..');
const SHOTS = path.join(REPO, 'playstore/store-art-2026-08/phone');

const uri = (f, mime) => `data:${mime};base64,` + fs.readFileSync(f).toString('base64');

const outName = process.argv[2] || 'whatsapp-flyer.png';
const src = process.argv[3] || 'whatsapp-flyer.src.html';

let html = fs.readFileSync(path.join(HERE, src), 'utf8')
  .replace('__LOGO__', uri(path.join(REPO, 'logo.svg'), 'image/svg+xml'))
  .replace('__SHOT1__', uri(path.join(SHOTS, '01-dashboard.png'), 'image/png'))
  .replace('__SHOT2__', uri(path.join(SHOTS, '03-phrases.png'), 'image/png'))
  .replace('__SHOT3__', uri(path.join(SHOTS, '04-progress.png'), 'image/png'))
  .replace('__SHOT4__', uri(path.join(SHOTS, '07-trend.png'), 'image/png'))
  .replace('__QR__', uri(path.join(HERE, 'qr-applomonec.png'), 'image/png'));

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(700);

  // report overflow so we can tune the layout
  const info = await p.evaluate(() => {
    const pg = document.querySelector('.page');
    return {
      bodyScroll: document.body.scrollHeight,
      pageScroll: pg.scrollHeight,
      ctaTop: document.querySelector('.cta').getBoundingClientRect().top,
      featsBottom: document.querySelector('.feats').getBoundingClientRect().bottom,
      trustBottom: document.querySelector('.trust').getBoundingClientRect().bottom,
      h1Bottom: document.querySelector('h1').getBoundingClientRect().bottom,
      phonesBottom: document.querySelector('.phones').getBoundingClientRect().bottom,
      qr: (r=>({x:r.x,y:r.y,w:r.width,h:r.height}))(document.querySelector('.qr img').getBoundingClientRect()),
    };
  });
  console.log(JSON.stringify(info, null, 1));

  /* deviceScaleFactor 2 -> a 2160x3840 capture; the committed PNG is the
     shareable 1080x1920, so downscale on the way out. */
  /* PNG for quality, JPEG for WhatsApp (it recompresses anything large). */
  await p.screenshot({ path: path.join(HERE, outName) });
  await p.screenshot({ path: path.join(HERE, outName.replace(/\.png$/, '.jpg')),
                       type: 'jpeg', quality: 92 });
  await b.close();
})();
