#!/usr/bin/env node
/* Build the Welding Professional English Shadow library:
 *   catalogue/welding-sources.json  (hand-curated, per profession)  →
 *   catalogue/welding.json          (what the app loads)
 *   captions/<vid>.json             (same shape as the General English ones)
 *   catalogue/welding-survey.json   (every candidate, and why any was left out)
 *
 *   node scripts/build_welding_catalogue.mjs            check + build
 *   node scripts/build_welding_catalogue.mjs --force    re-fetch captions that exist
 *
 * Same rules as scripts/build_catalogue.mjs, which built the General English
 * library: public, embeddable, not live, not age-limited, 60 s–30 min, English
 * captions. One rule is stricter here: the SPOKEN language must be English.
 * YouTube offers an auto-translated "en" track on almost every video, so a
 * French talk would otherwise pass — and the learner shadows the audio, not the
 * text. A video passes when it has human English subtitles, an English original
 * auto-caption track (en-orig), or YouTube reports its language as English.
 *
 * The app never calls YouTube except for the embedded player and thumbnails.
 * Needs yt-dlp on PATH; runs on the maintainer's machine only. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'catalogue', 'welding-sources.json');
const OUT = path.join(ROOT, 'catalogue', 'welding.json');
const SURVEY = path.join(ROOT, 'catalogue', 'welding-survey.json');
const CAP_DIR = path.join(ROOT, 'captions');
const TMP = path.join(ROOT, 'catalogue', '.subs-welding');
const FORCE = process.argv.includes('--force');
/* --offline: no request to YouTube at all — judge from the cached answers, keep only videos
   whose caption file is already on disk, and read channel names/avatars from RAW_DIR dumps
   (yt-dlp --flat-playlist -J <channel>/videos). For when YouTube is rate-limiting this machine. */
const OFFLINE = process.argv.includes('--offline');
const RAW_DIR = process.env.RAW_DIR || '';
const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const rules = Object.assign({ minSec: 60, maxSec: 1800 }, src.rules || {});

const ytJson = url => new Promise(res => {
  const p = spawn('yt-dlp', ['-J', '--no-warnings', '--force-ipv4', '--skip-download', url], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
  const bad = () => ({ _err: (err.trim().split('\n').pop() || 'no output').slice(0, 160) });
  p.on('close', () => { try { res(JSON.parse(out) || bad()) } catch { res(bad()) } });
});
/* yt-dlp answers are cached for a day, so re-running after a curation change
   only asks YouTube about the videos that are new */
const CACHE = path.join(os.tmpdir(), 'be-welding-info');
fs.mkdirSync(CACHE, { recursive: true });
async function info(vid) {
  const f = path.join(CACHE, vid + '.json');
  try { const st = fs.statSync(f); if (OFFLINE || Date.now() - st.mtimeMs < 864e5) return JSON.parse(fs.readFileSync(f, 'utf8')) } catch {}
  if (OFFLINE) return { _err: 'not checked yet (offline build)' };
  const j = await ytJson('https://www.youtube.com/watch?v=' + vid);
  if (!j._err) fs.writeFileSync(f, JSON.stringify(j));
  return j;
}
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
const isEn = k => k === 'en' || k.startsWith('en-');
function judge(info, minSec = rules.minSec) {
  if (info._err) return { skip: ['unavailable: ' + info._err] };
  const subs = Object.keys(info.subtitles || {}), autos = Object.keys(info.automatic_captions || {});
  const human = subs.some(isEn);
  /* YouTube's own language label wins when it names another language: a Hindi talk can still
     carry an en-US-orig track (heat-exchanger hydrotest, 29 Sep 2026) */
  const langOk = !info.language || /^en/i.test(info.language);
  const spokenEn = langOk && (human || autos.some(k => /^en(-[A-Za-z]+)?-orig$/.test(k)) || /^en/i.test(info.language || ''));
  const cap = human ? 'human' : (spokenEn && autos.some(isEn)) ? 'auto' : null;
  const why = [];
  if (info.is_live || /is_live|is_upcoming/.test(info.live_status || '')) why.push('live');
  if (info.age_limit) why.push('age-limited');
  if (info.playable_in_embed === false) why.push('not embeddable');
  if (info.availability && info.availability !== 'public') why.push(info.availability);
  const dur = Math.round(info.duration || 0);
  if (dur < minSec) why.push('short');
  if (dur > rules.maxSec) why.push('too long');
  if (!subs.length && !autos.length) why.push('no captions at all');
  else if (!spokenEn) why.push('not spoken in English');
  else if (!cap) why.push('no English captions');
  return {
    title: info.title || '', ch: info.channel || info.uploader || '', chId: info.channel_id || '',
    handle: info.uploader_id || '', dur, cap,
    up: (info.upload_date || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
    skip: why.length ? why : null,
  };
}

const cands = [];
for (const c of src.categories) for (const [vid, topic] of c.videos) cands.push({ vid, topic, cat: c.id });
/* channelOnly: a channel the owner wants in full (PetroCertif, 30 Sep 2026) — its English videos that fit no
   single profession are listed under the channel and in search only (cat "" = in no profession chip) */
const CH_ONLY = src.channelOnly || { videos: [] };
for (const [vid, topic] of CH_ONLY.videos) cands.push({ vid, topic, cat: '', chanOnly: true });
console.error(`checking ${cands.length} curated videos…`);
const judged = await pool(cands, 2, async (c, k) => {
  const r = judge(await info(c.vid), c.chanOnly && CH_ONLY.minSec ? CH_ONLY.minSec : rules.minSec);
  process.stderr.write(`${k + 1}/${cands.length} ${r.skip ? '✗' : '✓'} ${c.vid} ${r.skip ? r.skip.join(', ') : ''}\n`);
  return Object.assign({}, c, r);
});

/* captions: one yt-dlp pass per kept video that lacks a file (same flags and
   conversion as build_catalogue.mjs, so the files are interchangeable) */
fs.mkdirSync(TMP, { recursive: true });
const kept = judged.filter(v => !v.skip);
let made = 0;
for (const v of kept) {
  const target = path.join(CAP_DIR, v.vid + '.json');
  if (fs.existsSync(target) && !FORCE) continue;
  if (OFFLINE) { v.skip = ['caption not fetched yet']; continue; }
  process.stderr.write(`captions ${v.vid} …`);
  /* the track URL yt-dlp already reported (signed, valid for hours) is fetched
     directly: one plain request, which YouTube answers even when it has started
     asking this machine to "confirm you're not a bot" for new page loads */
  try {
    const inf = await info(v.vid), subs = inf.subtitles || {}, autos = inf.automatic_captions || {};
    const keys = v.cap === 'human' ? ['en', 'en-US', 'en-GB'].filter(k => subs[k]) : Object.keys(autos).filter(k => /^en(-[A-Za-z]+)?-orig$/.test(k)).concat(autos.en ? ['en'] : []);
    const list = v.cap === 'human' ? subs : autos;
    for (const k of keys) {
      const f = (list[k] || []).find(x => x.ext === 'json3');
      if (!f) continue;
      /* IPv4: on 29 Sep 2026 YouTube answered this machine's IPv6 with 429 / "confirm you're not a bot"
         for hours while IPv4 answered normally */
      const cr = spawnSync('curl', ['-4', '-s', '-w', '\n%{http_code}', f.url], { maxBuffer: 1 << 26 });
      const o = (cr.stdout || '').toString(), code = +o.slice(o.lastIndexOf('\n') + 1);
      const r = { ok: code === 200, text: async () => o.slice(0, o.lastIndexOf('\n')) };
      if (r.ok) { const body = await r.text(); if (/"events"/.test(body)) { fs.writeFileSync(path.join(TMP, `${v.vid}.${k}.json3`), body); break; } }
    }
    await new Promise(z => setTimeout(z, 400));
  } catch {}
  if (!fs.readdirSync(TMP).some(n => n.startsWith(v.vid + '.') && n.endsWith('.json3'))) spawnSync('yt-dlp', ['--skip-download', '--no-warnings', '--force-ipv4', '--write-subs', '--write-auto-subs',
    '--sub-lang', v.cap === 'human' ? 'en,en-US,en-GB' : 'en-orig,en-US-orig,en-GB-orig,en', '--sub-format', 'json3', '--sleep-requests', '2',
    '-o', path.join(TMP, '%(id)s'), 'https://www.youtube.com/watch?v=' + v.vid], { stdio: ['ignore', 'pipe', 'pipe'] });
  const pick = fs.readdirSync(TMP).filter(n => n.startsWith(v.vid + '.') && n.endsWith('.json3'));
  const f = pick.find(n => /\.en(-[A-Za-z]+)?-orig\.json3$/.test(n)) || pick.find(n => /\.en\.json3$/.test(n)) || pick[0];
  if (!f) { console.error(' none'); v.skip = ['caption track could not be fetched']; continue; }
  const conv = spawnSync('node', [path.join(ROOT, 'scripts', 'fetch_captions.js'), v.vid, path.join(TMP, f)], { stdio: ['ignore', 'pipe', 'pipe'] });
  for (const n of pick) { try { fs.unlinkSync(path.join(TMP, n)) } catch {} }
  if (conv.status !== 0) { console.error(' convert failed'); v.skip = ['caption conversion failed']; continue; }
  console.error(' ok'); made++;
}
try { fs.rmSync(TMP, { recursive: true, force: true }) } catch {}
/* auto-captions mark music and noise ("♪ Music ♪", "[Applause]"): not words anyone says, so
   they must never become a Challenge blank or a line to shadow — stripped from every Welding file */
const NOISE = /^(♪+|\[[^\]]*\]|\([^)]*\))$/;
for (const v of kept) {
  const f = path.join(CAP_DIR, v.vid + '.json');
  try {
    const cap = JSON.parse(fs.readFileSync(f, 'utf8'));
    const clean = t => String(t || '').replace(/♪[^♪]*♪|♪|\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
    const ws = cap.words || [];
    const keepW = ws.filter((w, i) => { const x = String(w.w || ''); if (NOISE.test(x)) return false; if (/^music$/i.test(x) && ((ws[i - 1] && /♪/.test(ws[i - 1].w)) || (ws[i + 1] && /♪/.test(ws[i + 1].w)))) return false; return true; })
      .map(w => Object.assign({}, w, { w: String(w.w).replace(/[♪\[\]]/g, '') })).filter(w => w.w);
    const keepC = (cap.cues || []).map(q => Object.assign({}, q, { txt: clean(q.txt) })).filter(q => q.txt);
    if (keepW.length !== ws.length || keepC.length !== (cap.cues || []).length || keepC.some((q, i) => q.txt !== cap.cues[i].txt)) {
      cap.words = keepW; cap.cues = keepC; fs.writeFileSync(f, JSON.stringify(cap));
    }
  } catch {}
}
/* speech density: a clip that is mostly silent footage or music gives nothing to shadow.
   Under 50 words a minute (the library's median is ~150) it is left out, and says so. */
const MIN_WPM = 50;
for (const v of kept) {
  if (v.skip) continue;
  try {
    const cap = JSON.parse(fs.readFileSync(path.join(CAP_DIR, v.vid + '.json'), 'utf8'));
    const words = (cap.cues || []).reduce((n, q) => n + String(q.txt || '').split(/\s+/).filter(Boolean).length, 0);
    const wpm = Math.round(words / Math.max(1, v.dur / 60));
    /* a channel asked for in full keeps its short clips (a 25-second intro reads slower than a lesson) */
    const min = v.chanOnly && CH_ONLY.minWpm ? CH_ONLY.minWpm : MIN_WPM;
    if (wpm < min) v.skip = [`mostly silent (${wpm} words a minute)`];
  } catch { v.skip = ['caption file unreadable']; }
}

/* channels row — name + avatar, one call each */
const channels = await pool(src.channels || [], 4, async h => {
  const rawF = RAW_DIR && path.join(RAW_DIR, h.replace(/^@/, '') + '.json');
  const info = OFFLINE ? (() => { try { return JSON.parse(fs.readFileSync(rawF, 'utf8')) || {} } catch { return {} } })() : await new Promise(res => {
    const p = spawn('yt-dlp', ['-J', '--no-warnings', '--force-ipv4', '--flat-playlist', '--playlist-items', '0', 'https://www.youtube.com/' + h], { stdio: ['ignore', 'pipe', 'ignore'] });
    let o = ''; p.stdout.on('data', d => o += d); p.on('close', () => { try { res(JSON.parse(o)) } catch { res({}) } });
  });
  const av = (info.thumbnails || []).filter(t => /avatar/i.test(t.id || '') || (t.width && t.width === t.height)).sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  return { handle: h, id: info.channel_id || '', name: info.channel || info.title || h, avatar: av ? av.url : '' };
});

/* a caption file for a video that did not make it in is dead weight in the app — removed,
   unless the General English library uses the same video */
{ let gen = {}; try { gen = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogue', 'general.json'), 'utf8')).videos || {} } catch {}
  for (const v of judged) if (v.skip && !gen[v.vid]) { try { fs.unlinkSync(path.join(CAP_DIR, v.vid + '.json')) } catch {} } }
const videos = {}, cats = [];
for (const c of src.categories) {
  const vids = judged.filter(v => v.cat === c.id && !v.skip).map(v => v.vid);
  cats.push({ id: c.id, label: c.label, group: c.group, vocab: c.vocab, vids });
  for (const v of judged.filter(v => v.cat === c.id && !v.skip))
    videos[v.vid] = { title: v.title, ch: v.ch, chId: v.chId, dur: v.dur, cap: v.cap, up: v.up, prof: c.id, topic: v.topic };
}
for (const v of judged.filter(v => v.chanOnly && !v.skip && !videos[v.vid]))
  videos[v.vid] = { title: v.title, ch: v.ch, chId: v.chId, dur: v.dur, cap: v.cap, up: v.up, prof: '', topic: v.topic, chan: true };
const out = { built: new Date().toISOString().slice(0, 10), area: 'welding', groups: src.groups, categories: cats,
  /* a channel chip filters the library by channel: one with no video in it would open an empty list */
  channels: channels.filter(c => c.id && Object.values(videos).some(v => v.chId === c.id)), hero: src.hero || {}, videos };
fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
fs.writeFileSync(SURVEY, JSON.stringify({ checked: out.built, videos: judged.map(v => ({ vid: v.vid, cat: v.cat, topic: v.topic, title: v.title, ch: v.ch, dur: v.dur, cap: v.cap, skip: v.skip })) }, null, 1) + '\n');
console.log(`\nWrote catalogue/welding.json — ${Object.keys(videos).length} videos in ${cats.length} professions, ${out.channels.length} channels, ${made} new caption files.`);
for (const c of cats) console.log(`  ${c.label.padEnd(28)} ${c.vids.length}`);
const left = judged.filter(v => v.skip);
if (left.length) { console.log(`\nLeft out (${left.length}):`); for (const v of left) console.log(`  ${v.vid} [${v.cat}] ${(v.title || "").slice(0, 60)} — ${v.skip.join(', ')}`); }
