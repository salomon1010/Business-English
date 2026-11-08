#!/usr/bin/env node
/* Idempotent draft import + review gate for the "Ideas & Personal Growth" Shadow library
 * category (General English only). This script NEVER writes to catalogue/general.json or
 * catalogue/welding.json — those are the live, published catalogues and this feature's own
 * rules forbid editing a deployed catalogue directly. Everything this script writes lands in
 * catalogue/drafts/, the review/import-gate store that stands in for an admin CMS this
 * project doesn't have.
 *
 * Usage:
 *   node scripts/import_ideas_personal_growth.mjs --env=development            dry run (default)
 *   node scripts/import_ideas_personal_growth.mjs --env=development --write    persist the registry
 *   node scripts/import_ideas_personal_growth.mjs --env=development --manifest [--select=20]
 *       writes the review manifest: the deterministic first-review candidate set, with the
 *       reason each one was picked. Selection is an ordering proposal for a human reviewer —
 *       it is NOT an approval and sets no review field.
 *   node scripts/import_ideas_personal_growth.mjs --env=development --validate=3
 *       metadata-only playability check (yt-dlp -J) on the first N seed ids.
 *   node scripts/import_ideas_personal_growth.mjs --env=development --validate-selected --write
 *       the same check against the manifest's candidate set, recording the result on each
 *       registry row (embedding_status, exact duration, observed title/channel id).
 *   node scripts/import_ideas_personal_growth.mjs --env=development --validate-ids=ID,ID
 *   node scripts/import_ideas_personal_growth.mjs --env=development --emit-category
 *       prints the catalogue block this category WOULD contribute, built only from rows that
 *       pass every gate in publishable(). Exits 3 and prints nothing publishable when none do.
 *       It never writes a catalogue — merging the block is a human, owner-authorised step.
 *
 * Captions/transcripts are never fetched, downloaded or stored by any path in this file.
 * Validation is metadata only, the same signals scripts/build_catalogue.mjs already computes
 * for the live catalogues.
 *
 * Idempotency contract: re-running with the same seed never duplicates a registry entry
 * (upsert keyed by video_id) and never regresses a review field a human has already advanced
 * past its pending default (see mergeRecord). Machine-written validation fields survive a
 * re-import too, and are only replaced by a newer validation run.
 *
 * Rollback: this script only ever adds/updates rows in files under catalogue/drafts/. To roll
 * back any import, `git checkout -- catalogue/drafts/` — no other catalogue, category or
 * learner progress is touched. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = path.join(ROOT, 'catalogue/drafts/ideas-personal-growth-seed.json');
const REGISTRY = path.join(ROOT, 'catalogue/drafts/ideas-personal-growth-registry.json');
const MANIFEST = path.join(ROOT, 'catalogue/drafts/ideas-personal-growth-review-manifest.json');
const REPORT = path.join(ROOT, 'catalogue/drafts/ideas-personal-growth-import-report.json');
const GENERAL = path.join(ROOT, 'catalogue/general.json');
const WELDING = path.join(ROOT, 'catalogue/welding.json');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => { const p = argv.find(a => a.startsWith(`--${name}=`)); return p ? p.split('=')[1] : null; };

const ENV = opt('env');
const WRITE = flag('write');
const VALIDATE_N = opt('validate') ? parseInt(opt('validate'), 10) : 0;
const VALIDATE_IDS = (opt('validate-ids') || '').split(',').map(s => s.trim()).filter(Boolean);
const VALIDATE_SELECTED = flag('validate-selected');
const WANT_MANIFEST = flag('manifest');
const EMIT_CATEGORY = flag('emit-category');
const SELECT_N = opt('select') ? parseInt(opt('select'), 10) : 20;

if (!ENV) {
  console.error('Refusing to run without an explicit --env=<name> (e.g. development, staging). This import never runs against production.');
  process.exit(1);
}
if (ENV === 'production') {
  console.error('Refusing: this import is for development/staging review queues only, never production. Publication happens through the existing owner-approved release process, not this script.');
  process.exit(1);
}

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const seed = readJson(SEED, null);
if (!seed || !Array.isArray(seed.videos)) {
  console.error(`Missing or malformed seed file: ${SEED}`);
  process.exit(1);
}

const general = readJson(GENERAL, { videos: {} });
const welding = readJson(WELDING, { videos: {} });
const registry = readJson(REGISTRY, { updated: null, env: ENV, videos: {} });

// --- 1. uniqueness / shape checks on the seed itself ---
const seenIds = new Map();
const malformed = [];
for (const v of seed.videos) {
  if (!v.video_id || !/^[A-Za-z0-9_-]{6,20}$/.test(v.video_id)) { malformed.push(v.id || '(no id)'); continue; }
  if (seenIds.has(v.video_id)) {
    console.error(`FATAL: duplicate video_id ${v.video_id} in seed (entries ${seenIds.get(v.video_id)} and ${v.id}) — refusing to import until the seed file is fixed.`);
    process.exit(1);
  }
  seenIds.set(v.video_id, v.id);
}
if (malformed.length) {
  console.error(`FATAL: ${malformed.length} seed entries have a missing/malformed video_id: ${malformed.join(', ')}`);
  process.exit(1);
}

// --- 2. dedup against the live, published catalogues ---
const report = { inserted: [], unchanged: [], reused: [], conflicted: [], rejected: [], unavailable: [], check_failed: [] };

/* Review fields a human may have already advanced — upsert must never regress these. */
const PROTECTED_FIELDS = ['status', 'embedding_status', 'rights_review', 'editorial_review',
  'caption_rights', 'publication_ready', 'playback_tested_in_app', 'full_content_viewed', 'cefr'];
const PENDING_VALUES = new Set([null, undefined, 'draft', 'unchecked', 'pending', false]);
/* Fields written by a validation run, never by the seed: they must survive a plain re-import
   (the seed carries exact_duration_seconds:null, which would otherwise wipe a real figure). */
const MACHINE_FIELDS = ['exact_duration_seconds', 'validation', 'verified_channel_id'];

function mergeRecord(existing, incoming) {
  if (!existing) return { ...incoming, imported_at: new Date().toISOString() };
  const merged = { ...incoming, ...existing }; // existing (human-touched) wins by default
  for (const f of Object.keys(incoming)) {
    // non-review fields always refresh from the seed (title, url, etc. can legitimately be re-synced)
    if (!PROTECTED_FIELDS.includes(f) && !MACHINE_FIELDS.includes(f)) merged[f] = incoming[f];
  }
  for (const f of PROTECTED_FIELDS) {
    const existingVal = existing[f];
    // if the human never touched it (still a pending/default value), let the seed's value through;
    // once a human has advanced it past pending, the seed must never regress it.
    merged[f] = PENDING_VALUES.has(existingVal) ? incoming[f] : existingVal;
  }
  for (const f of MACHINE_FIELDS) {
    if (existing[f] !== undefined && existing[f] !== null) merged[f] = existing[f];
  }
  merged.imported_at = existing.imported_at || new Date().toISOString();
  merged.reimported_at = new Date().toISOString();
  return merged;
}

for (const v of seed.videos) {
  const id = v.video_id;
  if (general.videos && general.videos[id]) {
    // Already a real, published, approved video in the live GE catalogue — reuse it,
    // never create a second draft record for the same YouTube video.
    report.reused.push({ id: v.id, video_id: id, reason: 'already published in catalogue/general.json', existingCategory: (general.categories || []).filter(c => (c.vids || []).includes(id)).map(c => c.id) });
    continue;
  }
  if (welding.videos && welding.videos[id]) {
    // Same video already owned by the Welding track — track ownership conflict, quarantine
    // rather than guess which track should keep it.
    report.conflicted.push({ id: v.id, video_id: id, reason: 'video_id already present in catalogue/welding.json (track conflict) — quarantined, not imported' });
    continue;
  }
  const existing = registry.videos[id];
  const isNew = !existing;
  registry.videos[id] = mergeRecord(existing, v);
  (isNew ? report.inserted : report.unchanged).push({ id: v.id, video_id: id });
}

registry.env = ENV;
registry.updated = new Date().toISOString();
registry.source_seed = path.relative(ROOT, SEED);

/* ---- the single publication gate ----------------------------------------------------
   Every condition must be positively true. Anything unknown — a pending review, a null
   duration, an unchecked embed, a null CEFR — means NOT publishable. There is deliberately
   no "assume ok" branch: this is what "fails closed" means for this feature. */
function publishable(rec) {
  return rec
    && rec.status === 'approved'
    && rec.editorial_review === 'approved'
    && rec.rights_review === 'approved'
    && rec.embedding_status === 'embeddable'
    && rec.playback_tested_in_app === true
    && rec.full_content_viewed === true
    && rec.publication_ready === true
    && typeof rec.exact_duration_seconds === 'number' && rec.exact_duration_seconds > 0
    && typeof rec.cefr === 'string' && rec.cefr.length > 0;
}
function unmetGates(rec) {
  const miss = [];
  if (!rec || rec.status !== 'approved') miss.push('status');
  if (!rec || rec.editorial_review !== 'approved') miss.push('editorial_review');
  if (!rec || rec.rights_review !== 'approved') miss.push('rights_review');
  if (!rec || rec.embedding_status !== 'embeddable') miss.push('embedding_status');
  if (!rec || rec.playback_tested_in_app !== true) miss.push('playback_tested_in_app');
  if (!rec || rec.full_content_viewed !== true) miss.push('full_content_viewed');
  if (!rec || rec.publication_ready !== true) miss.push('publication_ready');
  if (!rec || typeof rec.exact_duration_seconds !== 'number' || !(rec.exact_duration_seconds > 0)) miss.push('exact_duration_seconds');
  if (!rec || typeof rec.cefr !== 'string' || !rec.cefr) miss.push('cefr');
  return miss;
}

/* ---- deterministic first-review selection -------------------------------------------
   An ordering proposal for the human who will actually watch these, not a clearance.
   Rules, in order: a listing duration that carries seconds (YouTube rounds longer cards,
   so a seconds-precise card is the one we can sanity-check against real metadata); 4-16
   minutes (long enough for a real passage, short enough for one practice sitting); then
   round-robin across the four creators so no single voice dominates the first batch, and
   within a creator, a subtopic not already taken. Ties break on seed id, so the same seed
   always produces the same list. */
function parseDisplayDuration(s) {
  if (!s) return { seconds: null, precise: false };
  const h = /(\d+)\s*hour/.exec(s), m = /(\d+)\s*minute/.exec(s), sec = /(\d+)\s*second/.exec(s);
  if (!h && !m && !sec) return { seconds: null, precise: false };
  const total = (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (sec ? +sec[1] : 0);
  return { seconds: total, precise: !!sec };
}
function selectReviewCandidates(n) {
  const eligible = seed.videos.filter(v => {
    const d = parseDisplayDuration(v.display_duration);
    return d.precise && d.seconds >= 240 && d.seconds <= 960;
  });
  const byChannel = new Map();
  for (const v of eligible) {
    if (!byChannel.has(v.channel)) byChannel.set(v.channel, []);
    byChannel.get(v.channel).push(v);
  }
  const channels = [...byChannel.keys()].sort();
  for (const c of channels) byChannel.get(c).sort((a, b) => a.id.localeCompare(b.id));
  const picked = [], usedSubtopic = new Map();
  let guard = 0;
  while (picked.length < n && guard++ < 10000) {
    let progressed = false;
    for (const c of channels) {
      if (picked.length >= n) break;
      const pool = byChannel.get(c);
      const used = usedSubtopic.get(c) || new Set();
      let i = pool.findIndex(v => !used.has(v.proposed_subtopic));
      if (i === -1) i = pool.length ? 0 : -1;      // every subtopic already taken: fall back to the next in id order
      if (i === -1) continue;
      const v = pool.splice(i, 1)[0];
      used.add(v.proposed_subtopic); usedSubtopic.set(c, used);
      const d = parseDisplayDuration(v.display_duration);
      picked.push({
        id: v.id, video_id: v.video_id, title: v.title, channel: v.channel,
        proposed_subtopic: v.proposed_subtopic, display_duration: v.display_duration,
        display_duration_seconds: d.seconds,
        reason: `listing duration is seconds-precise (${v.display_duration}) and inside the 4-16 min practice window; ${v.channel} slot ${(used.size)}; subtopic "${v.proposed_subtopic}" not yet represented for this creator`,
      });
      progressed = true;
    }
    if (!progressed) break;
  }
  return picked;
}

const selected = (WANT_MANIFEST || VALIDATE_SELECTED) ? selectReviewCandidates(SELECT_N) : [];

// --- 3. opt-in metadata validation via yt-dlp (never captions, never bulk) ---
function ytdlpVersion() {
  const r = spawnSync('yt-dlp', ['--version'], { encoding: 'utf8' });
  return (r.stdout || '').trim() || 'unknown';
}
function probe(id, timeoutMs) {
  return spawnSync('yt-dlp', ['-J', '--no-warnings', '--skip-download', `https://www.youtube.com/watch?v=${id}`],
    { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs });
}
/* A lookup that produces nothing is a TOOL failure (timeout, throttling, no network) and must
   never be recorded as "this video is unavailable" — those are opposite claims about the world.
   One unhurried retry separates a slow answer from a real absence; anything still empty after
   that is reported as a failed check and leaves the row's embedding_status at check_failed. */
function validateOne(id) {
  let r = probe(id, 90000);
  if (!(r.stdout || '').toString('utf8').trim()) r = probe(id, 120000);
  const out = (r.stdout || '').toString('utf8').trim();
  if (!out) return { id, ok: false, transport: true, error: (r.stderr || '').toString('utf8').split('\n').filter(Boolean).pop() || 'yt-dlp produced no output' };
  let info;
  try { info = JSON.parse(out); } catch (e) { return { id, ok: false, error: 'unparseable yt-dlp output' }; }
  const why = [];
  if (info.is_live || info.live_status === 'is_live' || info.live_status === 'is_upcoming') why.push('live');
  if (info.age_limit) why.push('age-limited');
  if (info.playable_in_embed === false) why.push('not embeddable');
  if (info.availability && info.availability !== 'public') why.push(info.availability);
  return {
    id, ok: why.length === 0,
    why,
    durationSec: Math.round(info.duration || 0),
    title: info.title,
    channel: info.channel || info.uploader,
    channelId: info.channel_id || null,
    handle: info.uploader_id || null,
    ageLimit: info.age_limit || 0,
    liveStatus: info.live_status || null,
    embeddable: info.playable_in_embed !== false,
    availability: info.availability || 'unknown',
  };
}

let validation = null, validatedIds = [];
if (VALIDATE_SELECTED) validatedIds = selected.map(v => v.video_id);
else if (VALIDATE_IDS.length) validatedIds = VALIDATE_IDS;
else if (VALIDATE_N > 0) validatedIds = seed.videos.slice(0, VALIDATE_N).map(v => v.video_id);

if (validatedIds.length) {
  const tool = `yt-dlp ${ytdlpVersion()}`;
  const checkedAt = new Date().toISOString();
  validation = validatedIds.map(id => validateOne(id));
  for (const r of validation) {
    if (r.transport) report.check_failed.push({ video_id: r.id, why: r.error });
    else if (!r.ok) report.unavailable.push({ video_id: r.id, why: r.why });
    const rec = registry.videos[r.id];
    if (!rec) continue;
    const seedDur = parseDisplayDuration(rec.display_duration);
    /* embedding_status is a review field, but this is the machine half of the review and the
       only thing that may set it: a positive check says "embeddable", a negative one says why.
       It never says anything about rights, editorial suitability or caption permission. */
    rec.embedding_status = r.error ? 'check_failed' : (!r.embeddable ? 'not_embeddable' : (r.ok ? 'embeddable' : 'restricted'));
    rec.validation = {
      checked_at: checkedAt, tool,
      availability: r.availability || null, embeddable: r.embeddable === undefined ? null : r.embeddable,
      age_limit: r.ageLimit === undefined ? null : r.ageLimit, live_status: r.liveStatus || null,
      observed_title: r.title || null, observed_channel: r.channel || null,
      observed_channel_id: r.channelId || null, observed_handle: r.handle || null,
      title_matches_seed: r.title ? r.title.trim() === String(rec.title || '').trim() : null,
      display_duration_matches: (r.durationSec && seedDur.seconds) ? Math.abs(r.durationSec - seedDur.seconds) <= 60 : null,
      error: r.error || null,
      note: 'Metadata only. Embeddable is a playback signal, not permission for transcripts, extraction, derivatives or AI use.',
    };
    if (r.durationSec) rec.exact_duration_seconds = r.durationSec;
    if (r.channelId) rec.verified_channel_id = r.channelId;
  }
}

// --- 4. report ---
console.log(`[ideas-personal-growth import] env=${ENV} write=${WRITE} validate=${validatedIds.length || 0}`);
console.log(`  seed videos:       ${seed.videos.length}`);
console.log(`  inserted (new):    ${report.inserted.length}`);
console.log(`  unchanged (dupe run): ${report.unchanged.length}`);
console.log(`  reused (already in general.json): ${report.reused.length}`);
console.log(`  conflicted (owned by welding.json): ${report.conflicted.length}`);
console.log(`  rejected:          ${report.rejected.length}`);
console.log(`  unavailable (checked, and genuinely not usable): ${report.unavailable.length}`);
console.log(`  check_failed (lookup gave no answer — says nothing about the video): ${report.check_failed.length}`);
if (validation) {
  console.log('  --- validation sample ---');
  for (const r of validation) console.log(`    ${r.id}: ${r.ok ? 'OK' : (r.transport ? 'NO ANSWER' : 'RESTRICTED ' + JSON.stringify(r.why))} dur=${r.durationSec || 0}s title="${r.title || ''}"`);
}

const rows = Object.values(registry.videos);
const ready = rows.filter(publishable);
console.log(`  publishable right now (all gates met): ${ready.length} of ${rows.length}`);

if (WANT_MANIFEST) {
  console.log(`  review candidates selected: ${selected.length} (--select=${SELECT_N})`);
}

// --- 5. the category block this feature would contribute, built only from publishable rows ---
if (EMIT_CATEGORY) {
  if (!ready.length) {
    const sample = rows[0] ? unmetGates(rows[0]) : ['(registry empty)'];
    console.error('\nREFUSING to emit a category: 0 of ' + rows.length + ' rows pass publishable().');
    console.error('Unmet gates on the first row (representative): ' + sample.join(', '));
    console.error('Nothing publishes until a human advances those fields. This is the fail-closed path, not an error.');
    process.exit(3);
  }
  const block = {
    category: { id: 'ideas_growth', label: 'Ideas & Personal Growth', vids: ready.map(r => r.video_id) },
    videos: Object.fromEntries(ready.map(r => [r.video_id, {
      title: r.title, ch: r.channel, chId: r.verified_channel_id || null,
      dur: r.exact_duration_seconds, cap: null, up: null,
    }])),
    note: 'Proposed block only. Merging it into catalogue/general.json is a human, owner-authorised step through the existing release process.',
  };
  console.log('\n' + JSON.stringify(block, null, 2));
}

// --- 6. write ---
if (WRITE) {
  fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2) + '\n');
  console.log(`  wrote ${REGISTRY}`);
  if (WANT_MANIFEST) {
    fs.writeFileSync(MANIFEST, JSON.stringify({
      about: 'First-review candidate set for Ideas & Personal Growth. A review ORDER, not a clearance: every row below is still a draft and sets no review field. A human must watch the video, decide rights and editorial suitability, and advance the registry row before anything can publish.',
      generated: new Date().toISOString(), env: ENV, select_n: SELECT_N,
      selection_rules: [
        'listing duration carries seconds (YouTube rounds longer cards; a seconds-precise card is the one real metadata can be checked against)',
        'between 4 and 16 minutes',
        'round-robin across the four creators so the first batch is not one voice',
        'within a creator, prefer a proposed subtopic not already represented',
        'ties break on seed id, so the same seed always yields the same list',
      ],
      candidates: selected,
    }, null, 2) + '\n');
    console.log(`  wrote ${MANIFEST}`);
  }
} else {
  console.log('  DRY RUN — no file written. Pass --write to persist.');
}

fs.writeFileSync(REPORT, JSON.stringify({
  env: ENV, write: WRITE, validated: validatedIds.length, ranAt: new Date().toISOString(),
  report, validation, publishable: ready.length, rows: rows.length,
}, null, 2) + '\n');
