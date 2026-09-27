#!/usr/bin/env node
/* Turn catalogue/raw/<handle>.json (from build_catalogue.mjs --raw) into
 * catalogue/survey.json — the selection the build step then fetches captions for.
 *
 *   node scripts/curate_catalogue.mjs            # write the selection + print it
 *
 * Curation happens here, offline, so changing the mix costs nothing: the raw
 * dumps already hold title, channel, duration and which caption track exists.
 *
 * The rules below are per channel per category, because a keyword sweep across
 * every channel at once puts pronunciation drills in "Meetings". Each rule is a
 * regex over the title plus a cap, and videos are taken newest-first. Channels
 * that teach in a language other than English are deliberately absent: the
 * learner shadows the audio, so a French lesson about English is no use.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'catalogue', 'raw');
const OUT = path.join(ROOT, 'catalogue', 'survey.json');

/* promos, trailers and housekeeping are not lessons — they slip through any
   keyword rule because their titles borrow the channel's own vocabulary */
const PROMO = /membership|subscribe|sign[- ]?up|anthem|trailer|coming soon|introducing|our new course|enroll|webinar|application week|award dinner|channel update|live stream|shorts?$/i;
const MIN = 60, MAX = 2700;          // 1–45 min: long clips are fine, the learner marks 20–30 s
const PER_CHANNEL_CAT = 8;           // no single channel owns a category
/* cartoon-based lessons: the Shadow hero strip always carries one (owner, 27 Sep
   2026), so the flag travels with the record from here through the build */
const TOON = /toy story|despicable me|ratatouille|lion king|\bcoco\b|disney|pixar|super mario|tangled|frozen|moana|shrek|minions?|inside out|zootopia|finding nemo|incredibles|encanto|cartoon|animat/i;

/* id → label + the rules that fill it */
const CATS = [
  { id: 'meetings', label: 'Meetings', rules: [
    ['SpeakConfidentEnglish', /meeting|interrupt|small talk|disagree|speak up|organi[sz]e your thoughts|rambling|deeper conversation|ask better|say no|polite|professional|boundar|conflict|apolog|clarif|colleague|work|email|phone|request|opinion/i, 20],
    ['ThinkFastTalkSmart', /meeting|conversation|listen|question|disagree|conflict|feedback|negotiat|difficult|team|influence|persuad|connect|small talk|speak up|clear/i, 16],
    ['BusinessEnglishPod', /phone|call|meeting|instruction|explain a problem|support|doubt|arrangement|price|topic|generali[sz]|opinion|agree|negotiat|present|email|report|discuss/i, 12],
    ['harvardbusinessreview', /disagree|hard news|feedback|team|listen|conversation|trust|conflict|difficult|manage|boss|colleague/i, 12],
  ]},
  /* TED is deliberately absent. Their talks are the best delivery models on
     YouTube, but the licence is CC BY-NC-ND, so shipping the transcript inside
     an app with a paid tier is a risk the owner has not taken. Listing them
     WITHOUT a transcript was worse: the feed promises "tap and shadow with the
     words on screen", and exceptions break that promise. To reinstate them, add
     a TED rule here — the build then fetches their transcripts like everyone
     else's. */
  { id: 'presentations', label: 'Presentations', rules: [
    ['ThinkFastTalkSmart', /present|speak|talk|story|pitch|persuad|audience|confiden|improv|nerv|spontaneous|communicat|voice|message/i, 18],
    ['harvardbusinessreview', /leader|lead like|purpose|innovat|brand|story|imposter|bored|resilient|learning|culture|strategy|vision|decision|growth|ceo/i, 18],
    ['stanfordgsb', /communicat|speak|present|confiden|persua|think fast|talk|voice|leader|story|pitch/i, 12],
    ['RachelsEnglish', /confidence|sound natural|smooth|think in english|critical phrases|improve|speaking/i, 8],
    ['LinkedIn', /career|work|leader|skill|interview|communicat|present/i, 6],
  ]},
  { id: 'interviews', label: 'Interviews', rules: [
    ['Indeed', /interview|resume|question|answer|hire|career|network|skill|job search|salary|internship|pivot|cv|offer/i, 24],
    ['LindaRaynier', /interview|question|answer|manager|salary|resume|tell me|job|career|promot/i, 16],
    ['CNBCMakeIt', /interview|resume|job|career|salary|hire|work|boss|promot|negotiat/i, 14],
    ['BusinessEnglishPod', /interview/i, 6],
  ]},
  { id: 'everyday', label: 'Everyday', rules: [
    ['EasyEnglishVideos', /conversation|vocabulary|everyday|shopping|work|phone|strangers|tourist|street|people|talk/i, 20],
    ['EnglishwithLucy', /phrases|conversation|slang|polite|british|pronounce|speak|words|accent|daily/i, 20],
    ['LearnEnglishWithTVSeries', /.*/, 12],
    ['EnglishClass101', /conversation|phrases|daily|listening|speak|vocabulary/i, 10],
  ]},
  { id: 'skills', label: 'Learning skills', rules: [
    ['bbclearningenglish', /.*/, 24],
    ['RachelsEnglish', /sound|pronunciation|english|speaking|accent|word|practice|listen/i, 16],
    ['EnglishFluencyJourney', /fluen|speak|listen|practice|english|story|learn/i, 12],
    ['SpeakConfidentEnglish', /fluency|practice|confidence|tense|past|storytelling|vocabulary|grammar/i, 10],
  ]},
  /* Learn English WITH TV, films and songs (owner, 27 Sep 2026). Teacher-led
     lessons built on a clip — the teacher's commentary is what gets shadowed.
     These three come after the five above and are `shared`: a film lesson
     already filed under Everyday may appear under Movies too, so adding them
     changes nothing in the existing categories. The app shows their chips
     first (right after Your videos); For you keeps the order below. */
  { id: 'tv', label: 'TV shows', shared: true, rules: [
    ['FluentUEnglish', /tv|series|friends|brooklyn|the office|ted lasso|grey'?s|modern family|after life|breaking bad|70s show|wednesday|simpsons|rick and morty|spongebob/i, 14],
    ['EnglishByMovie', /friends|rick and morty|family guy|game of thrones|himym|how i met|wednesday|gravity falls/i, 14],
    ['LearnEnglishWithTVSeries', /friends|simpsons|netflix'?s you|emily in paris|wednesday|great tv series/i, 8],
  ]},
  { id: 'movies', label: 'Movies', shared: true, rules: [
    ['LearnEnglishWithTVSeries', /toy story|despicable|ratatouille|lion king|\bcoco\b|narnia|spider-man|frozen|cast away|kung fu|tangled|encanto|\bsoul\b|notting hill|disney|super mario|movie/i, 14],
    ['FluentUEnglish', /movies?/i, 12],
    ['EnglishByMovie', /avatar|hangover|onward|the shack|with home|tangled|deadpool|joker|going in style|her movie|hotel transy|squid game/i, 10],
    ['EnglishFluencyJourney', /disney|mario|movie/i, 4],
  ]},
  { id: 'songs', label: 'Songs', shared: true, rules: [
    ['EnglishClass101LyricLab', /./, 14],
    ['FluentUEnglish', /songs?|music/i, 10],
    ['LearningEnglishSongs', /./, 10],
    ['LearnEnglishWithTVSeries', /songs?|music/i, 4],
  ]},
];

/* the recommended-channels row, in the order it is shown */
const ROW = ['bbclearningenglish', 'SpeakConfidentEnglish', 'ThinkFastTalkSmart', 'Indeed',
  'harvardbusinessreview', 'EnglishwithLucy', 'RachelsEnglish', 'CNBCMakeIt', 'LindaRaynier',
  'BusinessEnglishPod', 'EasyEnglishVideos', 'stanfordgsb'];

const raw = {};
for (const f of fs.readdirSync(RAW)) raw[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));

/* an earlier survey already fetched the channel avatars — reuse them rather than
   asking YouTube again; a missing one falls back to initials in the UI */
let avatars = {};
try {
  const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  for (const c of prev.channels || []) avatars[c.handle.replace(/^@/, '')] = c;
} catch {}

const videos = {}, cats = [];
/* videos whose caption track could not be fetched on an earlier build: the feed
   promises a transcript, so they do not belong in it (re-run --build --force to
   retry one, then take it out of this list) */
const NO_TRACK = new Set(['vDXvdG8ndvM']);
const usable = v => v.cap && !NO_TRACK.has(v.vid) && v.dur >= MIN && v.dur <= MAX &&
  !(v.skip || []).some(w => w !== 'too long' && w !== 'no captions');

for (const c of CATS) {
  const vids = [];
  for (const [handle, re, cap, opt] of c.rules) {
    const d = raw[handle];
    if (!d) { console.error(`  (no dump for ${handle})`); continue; }
    let n = 0;
    for (const v of d.videos) {
      if (n >= cap) break;
      if (!usable(v) || vids.includes(v.vid) || (videos[v.vid] && !(c.shared && !videos[v.vid].shared))) continue;   // shared: may repeat an older category's video, never another shared one's
      if (!re.test(v.title) || PROMO.test(v.title)) continue;
      if (videos[v.vid]) { vids.push(v.vid); n++; continue; }   // already listed by an older category: list it here too, keep its record
      const rec = { ...v, handle };
      if (c.shared) rec.shared = true;
      if (TOON.test(v.title)) rec.toon = true;
      if (opt && opt.bundle === false) rec.cap = 'player';   // listed, transcript not shipped (licence)
      delete rec.skip;
      videos[v.vid] = rec; vids.push(v.vid); n++;
    }
    if (n < cap) console.error(`  ${c.id}/${handle}: ${n} of ${cap}`);
  }
  cats.push({ id: c.id, label: c.label, vids });
}

const channels = ROW.filter(h => raw[h]).map(h => ({
  handle: '@' + h, id: raw[h].id, name: raw[h].channel,
  avatar: (avatars[h] && avatars[h].avatar) || '',
}));

fs.writeFileSync(OUT, JSON.stringify({ surveyed: new Date().toISOString().slice(0, 10), categories: cats, channels, videos }, null, 1) + '\n');

const all = Object.values(videos);
console.log(`\n${all.length} videos · ${all.filter(v => v.cap === 'human').length} human subtitles · ${all.filter(v => v.cap === 'auto').length} auto · ${all.filter(v => v.cap === 'player').length} captions-in-player only`);
for (const c of cats) {
  console.log(`\n${c.label} — ${c.vids.length}`);
  for (const v of c.vids.map(x => videos[x])) {
    const mark = v.cap === 'human' ? '●' : v.cap === 'auto' ? '○' : '◍';
    console.log(`  ${mark} ${String(Math.floor(v.dur / 60)).padStart(3)}m  ${v.title.slice(0, 62).padEnd(62)}  ${v.ch}`);
  }
}
console.log('\n● human subtitles  ○ auto captions  ◍ listed, transcript not shipped');
