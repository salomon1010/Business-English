#!/usr/bin/env node
/* Build the Shadow library catalogue + its caption files from a list of sources.
 *
 *   node scripts/build_catalogue.mjs --survey        list every source's videos and
 *                                                    whether they carry captions
 *                                                    (writes catalogue/survey.json)
 *   node scripts/build_catalogue.mjs --build         write catalogue/general.json and
 *                                                    captions/<vid>.json for every
 *                                                    selected video (uses the survey)
 *   node scripts/build_catalogue.mjs --build --force re-fetch captions that exist
 *
 * Input: catalogue/sources.json —
 *   { "categories": [{ "id", "label", "sources": [
 *        { "channel": "@Handle", "limit": 12, "match": "regex on title", "bundle": false },
 *            // bundle:false = list the video but ship no transcript (licence,
 *            // e.g. TED's CC BY-NC-ND) — the learner gets YouTube's captions
 *            // inside the player and the app says so
 *        { "playlist": "PL…", "limit": 20 },
 *        { "vid": "abc123" } ] }],
 *     "channels": ["@Handle", …],          // the recommended-channels row
 *     "hero": { "1": "vid", "2": "vid" }, // one editorial pick per plan week
 *     "rules": { "minSec": 60, "maxSec": 1800 } }
 *
 * Runs on the maintainer's machine only (needs yt-dlp on PATH). The app never
 * fetches anything from YouTube at runtime except the embedded player and the
 * thumbnails; every transcript ships with the app, so browsing and the transcript
 * work offline. Conversion of the subtitle track reuses scripts/fetch_captions.js,
 * so the file shape is identical to the 18 hand-built ones.
 *
 * Kept out on purpose: shorts (< minSec), live streams, age-limited videos and
 * anything YouTube marks as not embeddable — the player would show a grey box. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAT_DIR = path.join(ROOT, 'catalogue');
const CAP_DIR = path.join(ROOT, 'captions');
const SRC = path.join(CAT_DIR, 'sources.json');
const SURVEY = path.join(CAT_DIR, 'survey.json');
const OUT = path.join(CAT_DIR, 'general.json');
const TMP = path.join(CAT_DIR, '.subs');

const args = new Set(process.argv.slice(2));
const MODE = args.has('--build') ? 'build' : args.has('--raw') ? 'raw' : 'survey';
const FORCE = args.has('--force');

if (!fs.existsSync(SRC)) { console.error('Missing ' + SRC); process.exit(1); }
const sources = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const rules = Object.assign({ minSec: 60, maxSec: 1800 }, sources.rules || {});

try { execFileSync('yt-dlp', ['--version'], { stdio: 'pipe' }); }
catch { console.error('yt-dlp is not on PATH — brew install yt-dlp'); process.exit(1); }

const ytJson = (url, extra = []) => {
  const out = execFileSync('yt-dlp', ['-J', '--no-warnings', '--ignore-errors', ...extra, url],
    { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out.toString('utf8'));
};
const srcUrl = s => s.channel ? `https://www.youtube.com/${s.channel}/videos`
  : s.playlist ? `https://www.youtube.com/playlist?list=${s.playlist}`
  : `https://www.youtube.com/watch?v=${s.vid}`;

/* ---- one video's record, from yt-dlp's full info ---- */
function record(info) {
  const en = o => o && Object.keys(o).some(k => k === 'en' || k.startsWith('en-'));
  const cap = en(info.subtitles) ? 'human' : en(info.automatic_captions) ? 'auto' : null;
  const why = [];
  if (info.is_live || info.live_status === 'is_live' || info.live_status === 'is_upcoming') why.push('live');
  if (info.age_limit) why.push('age-limited');
  if (info.playable_in_embed === false) why.push('not embeddable');
  if (info.availability && info.availability !== 'public') why.push(info.availability);
  const dur = Math.round(info.duration || 0);
  if (dur && dur < rules.minSec) why.push('short');
  if (dur > rules.maxSec) why.push('too long');
  if (!cap) why.push('no captions');
  return {
    vid: info.id, title: info.title || '', ch: info.channel || info.uploader || '',
    chId: info.channel_id || '', handle: info.uploader_id || '', dur, cap,
    up: (info.upload_date || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
    lic: info.license || 'standard', skip: why.length ? why : null,
  };
}

/* ---- survey: every source → its videos, judged ---- */
function survey() {
  const videos = {}, cats = [];
  for (const c of sources.categories || []) {
    const cat = { id: c.id, label: c.label, vids: [] };
    for (const s of c.sources || []) {
      const limit = s.limit || 15;
      process.stderr.write(`[${c.id}] ${srcUrl(s)} …`);
      let info;
      try { info = ytJson(srcUrl(s), s.vid ? [] : ['--playlist-end', String(limit)]); }
      catch (e) { console.error(' failed: ' + String(e.message || e).split('\n')[0]); continue; }
      const entries = info.entries ? info.entries.filter(Boolean) : [info];
      const re = s.match ? new RegExp(s.match, 'i') : null;
      let kept = 0;
      for (const e of entries) {
        const r = record(e);
        if (re && !re.test(r.title)) continue;
        if (s.bundle === false && r.cap) r.cap = 'player';
        videos[r.vid] = Object.assign(videos[r.vid] || {}, r);
        if (!cat.vids.includes(r.vid)) cat.vids.push(r.vid);
        if (!r.skip) kept++;
      }
      console.error(` ${entries.length} seen, ${kept} usable`);
    }
    cats.push(cat);
  }
  /* channel row: name + avatar, one call each */
  const channels = [];
  for (const h of sources.channels || []) {
    try {
      const info = ytJson(`https://www.youtube.com/${h}`, ['--playlist-items', '0']);
      const av = (info.thumbnails || []).filter(t => /avatar/i.test(t.id || '') || (t.width && t.width === t.height))
        .sort((a, b) => (b.width || 0) - (a.width || 0))[0];
      channels.push({ handle: h, id: info.channel_id || info.id || '', name: info.channel || info.title || h, avatar: av ? av.url : '' });
    } catch { channels.push({ handle: h, id: '', name: h, avatar: '' }); }
  }
  const out = { surveyed: new Date().toISOString().slice(0, 10), categories: cats, channels, videos };
  fs.mkdirSync(CAT_DIR, { recursive: true });
  fs.writeFileSync(SURVEY, JSON.stringify(out, null, 1) + '\n');
  report(out);
  return out;
}

function report(sv) {
  const all = Object.values(sv.videos);
  const ok = all.filter(v => !v.skip);
  console.log(`\n${all.length} videos seen · ${ok.length} usable · ${ok.filter(v => v.cap === 'human').length} with human subtitles · ${ok.filter(v => v.cap === 'auto').length} auto only`);
  for (const c of sv.categories) {
    const vs = c.vids.map(v => sv.videos[v]);
    console.log(`\n${c.label} — ${vs.filter(v => !v.skip).length}/${vs.length} usable`);
    for (const v of vs) {
      const m = `${Math.floor(v.dur / 60)}:${String(v.dur % 60).padStart(2, '0')}`;
      console.log(`  ${v.skip ? '✗' : v.cap === 'human' ? '●' : '○'} ${v.vid} ${m.padStart(6)}  ${v.title.slice(0, 64)}${v.skip ? '  [' + v.skip.join(', ') + ']' : ''}  — ${v.ch}`);
    }
  }
  console.log('\n● human subtitles  ○ auto captions  ✗ left out');
}

/* ---- build: catalogue JSON + caption files for every usable video ---- */
function build() {
  const sv = fs.existsSync(SURVEY) && !args.has('--fresh') ? JSON.parse(fs.readFileSync(SURVEY, 'utf8')) : survey();
  const videos = {}, cats = [];
  for (const c of sv.categories) {
    const keep = c.vids.filter(v => sv.videos[v] && !sv.videos[v].skip);
    cats.push({ id: c.id, label: c.label, vids: keep });
    for (const v of keep) {
      const r = sv.videos[v];
      videos[v] = { title: r.title, ch: r.ch, chId: r.chId, dur: r.dur, cap: r.cap, up: r.up };
    }
  }
  /* captions: one yt-dlp pass per video that lacks a file */
  fs.mkdirSync(TMP, { recursive: true });
  let made = 0, failed = [];
  for (const vid of Object.keys(videos)) {
    const target = path.join(CAP_DIR, vid + '.json');
    if (videos[vid].cap === 'player') continue;
    if (fs.existsSync(target) && !FORCE) continue;
    process.stderr.write(`captions ${vid} …`);
    /* Exact language names, never the 'en.*' wildcard: that also matches
       YouTube's auto-TRANSLATED tracks (en-ar, en-fr, …). Each one is a separate
       request, YouTube answers the extra ones with 429, and yt-dlp then exits
       non-zero having already written the English file we wanted. So we ask for
       the English variants only, and judge the result by the file on disk rather
       than by the exit status. */
    const r = spawnSync('yt-dlp', ['--skip-download', '--no-warnings', '--write-subs', '--write-auto-subs',
      '--sub-lang', 'en,en-orig,en-US,en-GB', '--sub-format', 'json3', '--sleep-requests', '1',
      '-o', path.join(TMP, '%(id)s'), `https://www.youtube.com/watch?v=${vid}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    const pick = fs.readdirSync(TMP).filter(n => n.startsWith(vid + '.') && n.endsWith('.json3'));
    /* plain "en" first: the others are regional or original-language duplicates */
    const f = pick.find(n => /\.en\.json3$/.test(n)) || pick[0];
    if (!f) { console.error(' none' + (r.status !== 0 ? ' (yt-dlp ' + r.status + ')' : '')); failed.push(vid); continue; }
    const conv = spawnSync('node', [path.join(ROOT, 'scripts', 'fetch_captions.js'), vid, path.join(TMP, f)], { stdio: ['ignore', 'pipe', 'pipe'] });
    if (conv.status !== 0) { console.error(' convert failed'); failed.push(vid); continue; }
    for (const n of pick) { try { fs.unlinkSync(path.join(TMP, n)) } catch {} }
    console.error(' ok'); made++;
  }
  for (const vid of failed) { videos[vid].cap = null; }
  /* a video whose track could not be fetched stays in the feed, marked
     "captions in player" — the learner still gets YouTube's own captions */
  const out = {
    built: new Date().toISOString().slice(0, 10),
    categories: cats,
    channels: sv.channels,
    hero: sources.hero || {},
    videos,
  };
  fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  const n = Object.keys(videos).length;
  console.log(`\nWrote catalogue/general.json — ${n} videos in ${cats.length} categories, ${made} new caption files${failed.length ? ', ' + failed.length + ' without a track: ' + failed.join(' ') : ''}.`);
}

/* ---- raw: one dump per channel, no filtering — curation then happens offline
   against catalogue/raw/<handle>.json instead of costing another network run ---- */
function raw() {
  const dir = path.join(CAT_DIR, 'raw');
  fs.mkdirSync(dir, { recursive: true });
  const handles = [...new Set([].concat(
    ...(sources.categories || []).map(c => (c.sources || []).filter(s => s.channel).map(s => s.channel)),
    sources.channels || [], sources.probe || []))];
  const n = +(process.env.RAW_N || 40);
  for (const h of handles) {
    const out = path.join(dir, h.replace(/^@/, '') + '.json');
    if (fs.existsSync(out) && !FORCE) { console.error(`${h} — have it`); continue; }
    process.stderr.write(`${h} …`);
    let info;
    try { info = ytJson(`https://www.youtube.com/${h}/videos`, ['--playlist-end', String(n)]); }
    catch (e) { console.error(' failed: ' + String(e.message || e).split('\n')[0]); continue; }
    const vids = (info.entries || []).filter(Boolean).map(record);
    fs.writeFileSync(out, JSON.stringify({ handle: h, channel: info.channel || h, id: info.channel_id || '', videos: vids }, null, 1) + '\n');
    console.error(` ${vids.length}`);
  }
}

MODE === 'build' ? build() : MODE === 'raw' ? raw() : survey();
