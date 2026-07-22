#!/usr/bin/env node
/* Build captions/<videoId>.json for a curated library video.
 *
 * The app never fetches captions at runtime (YouTube blocks that cross-origin);
 * instead we bundle a timestamped caption track ahead of time, and the app
 * slices it to the user's marks offline.
 *
 * Usage:
 *   1) Get a timestamped subtitle file for the video (any of these):
 *        yt-dlp --skip-download --write-subs --write-auto-subs \
 *               --sub-lang en --sub-format vtt --convert-subs vtt \
 *               "https://www.youtube.com/watch?v=<ID>"
 *      (prefer human subs over --write-auto-subs when available — cleaner text)
 *   2) node scripts/fetch_captions.js <videoId> path/to/subs.vtt
 *
 * Produces captions/<videoId>.json = { vid, source, lang, cues:[{t, txt}] }.
 * Only same-origin, offline data ends up in the app. Respect each video's
 * license/ToS — TED talks (CC BY-NC-ND) are a safe, education-friendly source. */
const fs = require('fs'), path = require('path');

const [vid, subPath] = process.argv.slice(2);
if (!vid || !subPath) {
  console.error('Usage: node scripts/fetch_captions.js <videoId> <subs.vtt|.srt>');
  process.exit(1);
}
const raw = fs.readFileSync(subPath, 'utf8');

// Parse a timestamp "HH:MM:SS.mmm" or "MM:SS.mmm" (VTT) / "HH:MM:SS,mmm" (SRT) → seconds
function toSec(ts) {
  const m = ts.trim().replace(',', '.').match(/(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)/);
  if (!m) return null;
  return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
}

const cues = [];
const blocks = raw.replace(/\r/g, '').split(/\n\n+/);
for (const b of blocks) {
  const line = b.split('\n').find(l => l.includes('-->'));
  if (!line) continue;
  const [a] = line.split('-->');
  const t = toSec(a);
  if (t == null) continue;
  const txt = b.split('\n')
    .filter(l => !l.includes('-->') && !/^\d+$/.test(l.trim()) && l.trim() && !/^WEBVTT/.test(l))
    .join(' ')
    .replace(/<[^>]+>/g, '')        // strip inline timing/karaoke tags
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
  if (txt) cues.push({ t: Math.round(t * 10) / 10, txt });
}
// de-duplicate consecutive identical lines (auto-subs repeat a lot)
const clean = [];
for (const c of cues) if (!clean.length || clean[clean.length - 1].txt !== c.txt) clean.push(c);

const outDir = path.join(__dirname, '..', 'captions');
fs.mkdirSync(outDir, { recursive: true });
const out = { vid, source: path.basename(subPath), lang: 'en', cues: clean };
fs.writeFileSync(path.join(outDir, vid + '.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`Wrote captions/${vid}.json — ${clean.length} cues (${subPath}).`);
console.log('Then set cap:true on this video in SHADOW_STARTERS.');
