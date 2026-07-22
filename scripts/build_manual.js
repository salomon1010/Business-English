/* Regenerates manual/<lang>.html from manual/en.html + scripts/manual-i18n/<lang>.json.
   Each dict is { "<English source text>": "<translation>" }. Any segment missing
   from a dict falls back to English, so partial translations still render cleanly.
   Usage: node scripts/build_manual.js            (build every dict present)
          node scripts/build_manual.js es fr ...  (build only these languages) */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const en = fs.readFileSync(path.join(root, 'manual/en.html'), 'utf8');

// Tokenize into tags/text; collect translatable text runs (contain letters, not inside <code>).
const parts = en.split(/(<[^>]+>)/);
const segs = [];
let template = '', inCode = false;
for (let k = 0; k < parts.length; k++) {
  const part = parts[k];
  if (k % 2 === 1) {
    template += part;
    if (/^<code[ >]/i.test(part)) inCode = true;
    if (/^<\/code>/i.test(part)) inCode = false;
  } else if (!inCode && /[A-Za-zÀ-ɏ]/.test(part) && part.trim()) {
    const lead = part.match(/^\s*/)[0], trail = part.match(/\s*$/)[0];
    segs.push(part.slice(lead.length, part.length - trail.length));
    template += lead + '⟦' + (segs.length - 1) + '⟧' + trail;
  } else {
    template += part;
  }
}

const dir = path.join(__dirname, 'manual-i18n');
let langs = process.argv.slice(2);
if (!langs.length) langs = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_')).map(f => f.replace('.json', ''));

for (const lang of langs) {
  const dictPath = path.join(dir, lang + '.json');
  if (!fs.existsSync(dictPath)) { console.log('skip (no dict):', lang); continue; }
  const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
  let miss = 0;
  const out = template.replace(/⟦(\d+)⟧/g, (_, i) => {
    const s = segs[+i], tr = dict[s];
    if (tr === undefined) { miss++; return s; }
    return tr;
  });
  fs.writeFileSync(path.join(root, 'manual', lang + '.html'), out.endsWith('\n') ? out : out + '\n');
  console.log('built manual/' + lang + '.html - ' + (segs.length - miss) + '/' + segs.length + ' translated (' + miss + ' EN fallback)');
}
// dump the segment list so translators can see every string
fs.writeFileSync(path.join(dir, '_segments.en.json'), JSON.stringify(segs, null, 1));
console.log('total segments:', segs.length);
