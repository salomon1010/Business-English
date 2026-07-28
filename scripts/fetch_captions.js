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

// Format C: YouTube json3 (fetched via `yt-dlp --sub-format json3`). Each seg carries a
// per-word offset, so we emit a flat `words:[{t,w}]` track → the app slices EXACTLY to
// the user's marks (no time-proportional estimate). We also keep `cues` for the fallback.
if (subPath.endsWith('.json3') || /^\s*\{[\s\S]*"events"\s*:/.test(raw)) {
  const j = JSON.parse(raw);
  const words = [], jcues = [];
  for (const e of (j.events || [])) {
    if (!e.segs) continue;
    const base = e.tStartMs || 0;
    for (const s of e.segs) {
      const raw2 = s.utf8 || '';
      if (!raw2.trim()) continue;
      const t = +((base + (s.tOffsetMs || 0)) / 1000).toFixed(3);
      for (const w of raw2.trim().split(/\s+/).filter(Boolean)) words.push({ t, w });
    }
    const txt = e.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
    if (txt) jcues.push({ t: +((base) / 1000).toFixed(1), txt });
  }
  writeOut(jcues, words);
  process.exit(0);
}

const cues = [];

// Format B: a YouTube "Show transcript" paste. Handles both layouts:
//   (1) timestamp + text on ONE line: "6:206 minutes, 20 secondsBut then…"
//   (2) timestamp on its OWN line, text on the following line(s): "0:16" \n "How do you…"
// Skips "Search in video"/"Chapter N:" headers and standalone (Laughter)/(Applause).
// Detected when there are no VTT/SRT "-->" cue-timing lines.
if (!/-->/.test(raw)) {
  const anno = s => /^[\[(][^\])]*[\])]$/.test(s.trim()); // whole line is just (Laughter)/[Applause]
  const push = c => { if (c && c.txt.trim() && !anno(c.txt)) cues.push(c); };
  let cur = null;
  for (const line of raw.replace(/\r/g, '').split('\n')) {
    const s = line.trim();
    if (!s || /^Search in video$/i.test(s) || /^Chapter\s/i.test(s)) continue;
    const m = s.match(/^(\d+):(\d{2})(.*)$/);
    if (m) {
      push(cur);
      const t = (+m[1]) * 60 + (+m[2]);
      const inline = m[3]
        .replace(/^\d+\s+(?:minute|second)s?(?:,\s*\d+\s+seconds?)?/, '') // drop redundant duration phrase (layout 1)
        .replace(/\s+/g, ' ').trim();
      cur = { t, txt: inline };
    } else if (cur) {
      if (anno(s)) continue; // drop standalone (Laughter)/[Applause] on its own line
      cur.txt += (cur.txt ? ' ' : '') + s;
    }
  }
  push(cur);
  writeOut(cues);
  return;
}

// Format A: WEBVTT / SRT
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
writeOut(cues);

function writeOut(list, words) {
  // de-duplicate consecutive identical lines (auto-subs repeat a lot)
  const clean = [];
  for (const c of list) if (!clean.length || clean[clean.length - 1].txt !== c.txt) clean.push(c);
  const outDir = path.join(__dirname, '..', 'captions');
  fs.mkdirSync(outDir, { recursive: true });
  const out = { vid, source: path.basename(subPath), lang: 'en', cues: clean };
  if (words && words.length) out.words = words;   // per-word timing → exact slicing
  fs.writeFileSync(path.join(outDir, vid + '.json'), JSON.stringify(out) + '\n');
  console.log(`Wrote captions/${vid}.json — ${clean.length} cues${words && words.length ? ', ' + words.length + ' word-timed' : ''} (${subPath}).`);
}
