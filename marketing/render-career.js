/* Render career-flyer.src.html (already inlined by build-flyers.py) to the
   shareable PNG + a WhatsApp-friendly JPEG, and report the vertical layout so
   overflow is caught rather than cropped silently.

   node marketing/render-career.js        # needs playwright-core on NODE_PATH
*/
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const HERE = __dirname;

(async () => {
  const html = fs.readFileSync(path.join(HERE, 'build/career-flyer.html'), 'utf8');
  const b = await chromium.launch({ executablePath: process.env.CHROME ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(900);

  const info = await p.evaluate(() => {
    const bot = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().bottom) : null };
    return { h1: bot('h1'), phones: bot('.phones'), four: bot('.four'), awards: bot('.awards'),
             steps: bot('.steps'), trust: bot('.trust'),
             ctaTop: Math.round(document.querySelector('.cta').getBoundingClientRect().top),
             foot: bot('.foot'), page: document.querySelector('.page').scrollHeight };
  });
  console.log(JSON.stringify(info, null, 1));
  if (info.foot > 1920) console.error('OVERFLOW: footer runs past the page');

  /* The 2x capture is the print master the PDF is built from; the committed
     share files stay 1080x1920 like the other two flyers, so WhatsApp is not
     recompressing four times the pixels it will ever show. Downscaling is done
     by build-share.py, which runs straight after this. */
  await p.screenshot({ path: path.join(HERE, 'career-flyer@2x.png') });
  await b.close();
})();
