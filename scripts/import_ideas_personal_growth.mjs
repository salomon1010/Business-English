#!/usr/bin/env node
/* Idempotent draft import for the "Ideas & Personal Growth" Shadow library category
 * (General English only). This script NEVER writes to catalogue/general.json or
 * catalogue/welding.json — those are the live, published catalogues and this prompt's
 * own rules forbid editing a deployed catalogue directly. Everything this script writes
 * lands in catalogue/drafts/ideas-personal-growth-registry.json, a review/import-gate
 * file that stands in for an admin CMS this project doesn't have.
 *
 * Usage:
 *   node scripts/import_ideas_personal_growth.mjs --env=development            dry run (default)
 *   node scripts/import_ideas_personal_growth.mjs --env=development --write    actually writes the registry
 *   node scripts/import_ideas_personal_growth.mjs --env=development --validate=3   (opt-in) runs yt-dlp -J
 *       against the first N candidate ids to check public/embeddable/age-limit/duration, same
 *       signals scripts/build_catalogue.mjs's record() already computes for the live catalogues.
 *       Never fetches captions/transcripts — this is a metadata-only playability check.
 *
 * Idempotency contract: re-running with the same seed file never duplicates a registry
 * entry (upsert keyed by video_id) and never regresses a review field a human has already
 * advanced past "pending" (see mergeRecord). Running twice produces the same report counts
 * for "inserted" on the first run and 0 "inserted" / N "unchanged" on the second.
 *
 * Rollback: this script only ever adds/updates rows in one brand-new JSON file under
 * version control. To roll back any import, `git checkout -- catalogue/drafts/ideas-personal-growth-registry.json`
 * (or delete the file before its first commit) — nothing else is touched, so no other
 * catalogue, category or learner progress is at risk. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = path.join(ROOT, 'catalogue/drafts/ideas-personal-growth-seed.json');
const REGISTRY = path.join(ROOT, 'catalogue/drafts/ideas-personal-growth-registry.json');
const GENERAL = path.join(ROOT, 'catalogue/general.json');
const WELDING = path.join(ROOT, 'catalogue/welding.json');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => { const p = argv.find(a => a.startsWith(`--${name}=`)); return p ? p.split('=')[1] : null; };

const ENV = opt('env');
const WRITE = flag('write');
const VALIDATE_N = opt('validate') ? parseInt(opt('validate'), 10) : 0;

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
const report = { inserted: [], unchanged: [], reused: [], conflicted: [], rejected: [], unavailable: [] };

// review fields a human may have already advanced — upsert must never regress these
const PROTECTED_FIELDS = ['status', 'embedding_status', 'rights_review', 'editorial_review',
  'caption_rights', 'publication_ready', 'playback_tested_in_app', 'full_content_viewed', 'cefr'];
const PENDING_VALUES = new Set([null, undefined, 'draft', 'unchecked', 'pending', false]);

function mergeRecord(existing, incoming) {
  if (!existing) return { ...incoming, imported_at: existing?.imported_at || new Date().toISOString() };
  const merged = { ...incoming, ...existing }; // existing (human-touched) wins by default
  for (const f of Object.keys(incoming)) {
    if (!PROTECTED_FIELDS.includes(f)) merged[f] = incoming[f]; // non-review fields always refresh from the seed (title, url, etc. can legitimately be re-synced)
  }
  for (const f of PROTECTED_FIELDS) {
    const existingVal = existing[f];
    // if the human never touched it (still a pending/default value), let the seed's value through;
    // once a human has advanced it past pending, the seed must never regress it.
    merged[f] = PENDING_VALUES.has(existingVal) ? incoming[f] : existingVal;
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

// --- 3. optional opt-in metadata validation via yt-dlp (never captions, never bulk) ---
function validateOne(id) {
  const r = spawnSync('yt-dlp', ['-J', '--no-warnings', '--skip-download', `https://www.youtube.com/watch?v=${id}`],
    { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
  const out = (r.stdout || '').toString('utf8').trim();
  if (!out) return { id, ok: false, error: (r.stderr || '').toString('utf8').split('\n').filter(Boolean).pop() || 'yt-dlp produced no output' };
  let info;
  try { info = JSON.parse(out); } catch (e) { return { id, ok: false, error: 'unparseable yt-dlp output' }; }
  const why = [];
  if (info.is_live || info.live_status === 'is_live' || info.live_status === 'is_upcoming') why.push('live');
  if (info.age_limit) why.push('age-limited');
  if (info.playable_in_embed === false) why.push('not embeddable');
  if (info.availability && info.availability !== 'public') why.push(info.availability);
  if (info.channel_is_verified === undefined) { /* not a rejection signal, just unavailable in this yt-dlp version */ }
  return {
    id, ok: why.length === 0,
    why,
    durationSec: Math.round(info.duration || 0),
    title: info.title,
    channel: info.channel || info.uploader,
    embeddable: info.playable_in_embed !== false,
    availability: info.availability || 'unknown',
  };
}

let validation = null;
if (VALIDATE_N > 0) {
  const sample = seed.videos.slice(0, VALIDATE_N);
  validation = sample.map(v => validateOne(v.video_id));
  for (const r of validation) {
    if (!r.ok) report.unavailable.push({ video_id: r.id, why: r.why || [r.error] });
  }
}

// --- 4. write (or just report) ---
console.log(`[ideas-personal-growth import] env=${ENV} write=${WRITE} validate=${VALIDATE_N || 0}`);
console.log(`  seed videos:       ${seed.videos.length}`);
console.log(`  inserted (new):    ${report.inserted.length}`);
console.log(`  unchanged (dupe run): ${report.unchanged.length}`);
console.log(`  reused (already in general.json): ${report.reused.length}`);
console.log(`  conflicted (owned by welding.json): ${report.conflicted.length}`);
console.log(`  rejected:          ${report.rejected.length}`);
console.log(`  unavailable (failed --validate check): ${report.unavailable.length}`);
if (validation) {
  console.log('  --- validation sample ---');
  for (const r of validation) console.log(`    ${r.id}: ${r.ok ? 'OK' : 'FAIL ' + JSON.stringify(r.why)} dur=${r.durationSec}s title="${r.title}"`);
}

if (WRITE) {
  fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2) + '\n');
  console.log(`  wrote ${REGISTRY}`);
} else {
  console.log('  DRY RUN — no file written. Pass --write to persist.');
}

fs.writeFileSync(path.join(ROOT, 'catalogue/drafts/ideas-personal-growth-import-report.json'),
  JSON.stringify({ env: ENV, write: WRITE, validateN: VALIDATE_N, ranAt: new Date().toISOString(), report, validation }, null, 2) + '\n');
