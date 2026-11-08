#!/usr/bin/env node
/* Build catalogue/ideas-growth.json — the Ideas & Personal Growth OVERLAY.
 *
 * Why a separate file instead of editing catalogue/general.json:
 * the Shadow library's channel row, hero strip, search and "all" feed all read `_shCat`
 * directly, with no feature-flag check anywhere in them. Putting this content into
 * general.json would therefore surface it in PRODUCTION even with
 * ideas_personal_growth_enabled off — the flag only filters the category chip list.
 * As its own file, merged into `_shCat` by shCatLoad() only when the flag is on AND the
 * open programme is General English, the content is absent from production by
 * construction rather than by a render-time filter somebody can forget.
 *
 * What goes in: only rows this project has actually verified against YouTube metadata —
 * public, embeddable, not age-limited, not live, with a measured duration and a channel
 * id confirmed from the creator's own videos. Rows that were never checked are left out.
 *
 * What this is NOT: an editorial or rights clearance. Every row here is still
 * `editorial_review: pending` and `rights_review: pending` in the registry, which is why
 * the file carries `reviewed: false` and the flag stays false in production. Building
 * this file does not advance any review field, and publishable() still refuses them.
 *
 * Captions: every record is cap:"player" (captions exist inside YouTube's player) or
 * cap:null (none listed). This category bundles NO caption files — it has no
 * authorisation to — so the Shadow/Challenge transcript modes do not apply to these
 * videos. index.html already handles that: svRender() shows its "no transcript" card
 * and hides the mode tabs. `watch:true` is what tells the library to list a video whose
 * transcript we cannot provide.
 *
 * Usage: node scripts/build_ideas_growth_overlay.mjs [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = path.join(ROOT, 'catalogue/drafts/ideas-personal-growth-registry.json');
const SOURCES = path.join(ROOT, 'catalogue/ideas-personal-growth-sources.json');
const OUT = path.join(ROOT, 'catalogue/ideas-growth.json');
const WRITE = process.argv.includes('--write');
if (WRITE) {
  console.error('REFUSED: this generator predates the multi-source overlay. Writing would replace catalogue/ideas-growth.json');
  console.error('(four categories, ~280 videos) with a single-category file of the first 20. Use scripts/ideas-growth/build-overlay.mjs.');
  process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const sources = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));

/* The registry KEY is the YouTube video id; r.id is the seed's own "ipg-001" label.
   Spreading r after id silently overwrote the key with the seed label, which built an
   overlay whose thumbnails and player urls pointed at ipg-001 instead of OTvm5LfhDzg.
   Keep them in separate fields so they can never be confused again. */
const rows = Object.entries(registry.videos).map(([vid, r]) => ({ ...r, vid, seedId: r.id }));
const eligible = [], skipped = [];
for (const r of rows) {
  const v = r.validation;
  const why = [];
  if (!v) why.push('never validated');
  else {
    if (r.embedding_status !== 'embeddable') why.push('embedding_status=' + r.embedding_status);
    if (v.availability !== 'public') why.push('availability=' + v.availability);
    if (v.age_limit) why.push('age-limited');
    if (v.live_status && v.live_status !== 'not_live') why.push('live=' + v.live_status);
    if (v.title_matches_seed === false) why.push('observed title disagrees with the seed');
  }
  if (!(typeof r.exact_duration_seconds === 'number' && r.exact_duration_seconds > 0)) why.push('no measured duration');
  if (!r.verified_channel_id) why.push('no verified channel id');
  (why.length ? skipped : eligible).push({ ...r, why });
}

/* A channel earns a row only if it has at least one eligible video here AND a channel id
   verified from its own videos (the owner's rule, 7 Nov 2026). No invented metadata:
   avatar is null and the UI's existing initials fallback draws it. */
const byChannel = new Map();
for (const r of eligible) {
  if (!byChannel.has(r.channel)) byChannel.set(r.channel, []);
  byChannel.get(r.channel).push(r);
}
const channels = [];
for (const [name, vids] of byChannel) {
  const src = (sources.channels || []).find(c => c.name === name);
  const id = vids[0].verified_channel_id;
  if (!src || !src.channel_id) { console.error(`FATAL: ${name} has eligible videos but no verified channel_id in the sources registry.`); process.exit(1); }
  if (src.channel_id !== id) { console.error(`FATAL: channel id disagreement for ${name}: sources=${src.channel_id} videos=${id}`); process.exit(1); }
  channels.push({ id, name, avatar: null, handle: src.handle, videos: vids.length });
}
channels.sort((a, b) => a.name.localeCompare(b.name));

const videos = {};
for (const r of eligible.sort((a, b) => String(a.seedId).localeCompare(String(b.seedId)))) {
  const caps = (r.validation || {}).captions_available;
  if (!/^[A-Za-z0-9_-]{11}$/.test(r.vid)) { console.error(`FATAL: ${r.vid} is not an 11-character YouTube video id`); process.exit(1); }
  videos[r.vid] = {
    title: r.title,
    ch: r.channel,
    chId: r.verified_channel_id,
    dur: r.exact_duration_seconds,
    /* captions exist only inside YouTube's player; this project bundles none for them */
    cap: caps === 'human' || caps === 'auto' ? 'player' : null,
    /* list it anyway: a video we may not transcribe is still a video to watch and speak about */
    watch: true,
    up: null,
  };
}

const out = {
  about: 'Ideas & Personal Growth — PREVIEW overlay for the General English Shadow library. Merged into the catalogue by shCatLoad() only when ideas_personal_growth_enabled is on AND the open programme is General English. It is a separate file precisely so that production, where the flag is false, never loads it at all.',
  reviewed: false,
  review_warning: 'NOT editorially reviewed and NOT rights-cleared. Every video here is still editorial_review:pending and rights_review:pending in catalogue/drafts/ideas-personal-growth-registry.json. What IS verified is playability: public, embeddable, not age-limited, not live, measured duration, channel id confirmed from the creator own videos. Do not enable this flag in production on the strength of this file.',
  captions: 'No caption file is bundled for any video here and none may be fetched without a documented authorisation decision. Records are cap:"player" or cap:null, so the Shadow and Challenge transcript modes do not apply; the app shows its existing no-transcript card instead.',
  built: new Date().toISOString().slice(0, 10),
  source: 'catalogue/drafts/ideas-personal-growth-registry.json',
  category: { id: 'ideas_growth', label: 'Ideas & Personal Growth', vids: Object.keys(videos) },
  channels,
  videos,
};

console.log(`[ideas-growth overlay] eligible ${eligible.length} · skipped ${skipped.length} of ${rows.length}`);
for (const c of channels) console.log(`  channel: ${c.name} (${c.id}) — ${c.videos} videos`);
const capN = Object.values(videos).filter(v => v.cap === 'player').length;
console.log(`  captions listed by YouTube (not bundled): ${capN} of ${Object.keys(videos).length}`);
if (!eligible.length) { console.error('Refusing to write an empty overlay — nothing has been validated yet.'); process.exit(3); }

if (WRITE) { fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n'); console.log(`  wrote ${OUT}`); }
else console.log('  DRY RUN — pass --write to persist.');
