/* USAGE (from the repo root; the inputs are committed snapshots of what the scripts below read from YouTube):
     node scripts/ideas-growth/build-overlay.mjs \
       catalogue/drafts/ideas-growth-inputs/harvest.json   catalogue/drafts/ideas-growth-inputs/intros.json \
       catalogue/drafts/ideas-growth-inputs/intro-roles.json catalogue/drafts/ideas-growth-inputs/mmm.json
   Refreshing the inputs: harvest.mjs, intros.mjs + tag-intros.mjs, mmm.mjs, validate-seeds.mjs (all yt-dlp,
   metadata only, nothing downloaded). This file replaced scripts/build_ideas_growth_overlay.mjs, which
   predates the multi-category overlay and would overwrite it with a 20-video single-category file. */
/* Build catalogue/ideas-growth.json from TWO validated sources:
     - the seed registry (the four Ideas creators)
     - the harvest of the channels the owner asked for
   Nothing here invents a value: every title, duration and channel id comes from a
   yt-dlp read, and a row without one is dropped rather than filled in. The file
   still declares reviewed:false — none of this has had editorial or rights review. */
import { readFileSync, writeFileSync } from "node:fs";
const reg = JSON.parse(readFileSync("catalogue/drafts/ideas-personal-growth-registry.json","utf8"));
const har = JSON.parse(readFileSync(process.argv[2],"utf8"));
const src = JSON.parse(readFileSync("catalogue/ideas-personal-growth-sources.json","utf8"));
const MIN=240, MAX=960;
const ID = /^[A-Za-z0-9_-]{11}$/;
const videos={}, byCat={ ideas_growth:[], pronunciation:[], public_speaking:[] }, chans=new Map();

/* --- the seed registry: the four Ideas creators --- */
let dropped=0;
for (const [vid,r] of Object.entries(reg.videos)) {
  const dur=r.exact_duration_seconds;
  if (!ID.test(vid)) { dropped++; continue; }                       // the ipg-NNN bug, caught structurally
  if (r.embedding_status!=="embeddable") { dropped++; continue; }
  if (!(typeof dur==="number" && dur>=MIN && dur<=MAX)) { dropped++; continue; }
  if (!r.verified_channel_id) { dropped++; continue; }
  const caps=(r.validation||{}).captions_available;
  videos[vid]={ title:r.title, ch:(r.channel||r.creator), chId:r.verified_channel_id, dur,
    cap:(caps==="human"||caps==="auto")?"player":null, watch:true, up:null };
  byCat.ideas_growth.push(vid);
  if (!chans.has(r.verified_channel_id)) {
    const s=(src.channels||[]).find(c=>c.channel_id===r.verified_channel_id);
    chans.set(r.verified_channel_id,{ id:r.verified_channel_id, name:(r.channel||r.creator), avatar:(s&&s.avatar)||null, handle:(s&&s.handle)||null });
  }
}
/* --- the harvested channels --- */
for (const v of har.videos) {
  if (!ID.test(v.id) || !v.embeddable || !(v.dur>=MIN&&v.dur<=MAX) || !v.chId) { dropped++; continue; }
  videos[v.id]={ title:v.title, ch:v.ch.observedName||v.ch.name, chId:v.chId, dur:v.dur,
    cap:(v.caps==="human"||v.caps==="auto")?"player":null, watch:true, up:null };
  (byCat[v.ch.cat]||byCat.ideas_growth).push(v.id);
  if (!chans.has(v.chId)) chans.set(v.chId,{ id:v.chId, name:v.ch.observedName||v.ch.name, avatar:v.ch.avatar||null, handle:v.ch.handle||null });
}
/* --- the self-introduction clips (Week 1 Pronunciation baseline) ---
   Their channels are small employer/practice channels, ~35 of them. They are deliberately
   NOT added to the channel rail: forty one-video chips would bury the twelve that mean
   something. The videos still carry their channel name, so each card says who it is. */
const intros = JSON.parse(readFileSync(process.argv[3],"utf8"));
const roles  = JSON.parse(readFileSync(process.argv[4],"utf8"));
byCat.introductions = [];
for (const v of intros) {
  if (!ID.test(v.id) || !v.embeddable || !(v.dur>0) ) { dropped++; continue; }
  const r = roles[v.id] || {};
  videos[v.id] = { title:v.title, ch:v.ch, chId:v.chId, dur:v.dur,
    cap:(v.caps==="human"||v.caps==="auto")?"player":null, watch:true, up:null,
    /* the profession tag IntroPick ranks on. DERIVED FROM THE TITLE and not yet
       confirmed by anyone who watched the clip — hence editorial:"pending". */
    /* other.other means the title named no role; it is not a profession, and carrying it would make
       every learner who answers "Other" an exact match for clips nobody has characterised */
    role:(r.role&&r.role!=="other.other")?r.role:null, roleGroup:(r.role&&r.role!=="other.other")?(r.roleGroup||null):null,
    roleBasis:r.roleBasis||null,
    editorial:"pending",
    /* whole-clip shadowing needs no approved excerpt; anything longer does, and only
       a human can approve a timestamp, so it stays a library video, not a lesson one */
    lessonEligible: v.dur>=40 && v.dur<=75 };
  byCat.introductions.push(v.id);
}
/* mmmEnglish — resolved by the channel id the owner supplied after its handle failed */
const mmm = JSON.parse(readFileSync(process.argv[5],"utf8"));
for (const v of mmm.videos) {
  if (!ID.test(v.id)) { dropped++; continue; }
  videos[v.id] = { title:v.title, ch:v.ch, chId:v.chId, dur:v.dur,
    cap:(v.caps==="human"||v.caps==="auto")?"player":null, watch:true, up:null };
  byCat[mmm.channel.cat].push(v.id);
}
if (!chans.has(mmm.channel.id)) chans.set(mmm.channel.id, { id:mmm.channel.id, name:mmm.channel.name, avatar:mmm.channel.avatar, handle:mmm.channel.handle });
const LABEL={ ideas_growth:"Ideas & Personal Growth", pronunciation:"Pronunciation", public_speaking:"Public speaking", introductions:"Introductions" };
const categories=Object.entries(byCat).filter(([,v])=>v.length).map(([id,vids])=>({ id, label:LABEL[id], vids }));
const out={ built:new Date().toISOString().slice(0,10), reviewed:false,
  review_warning:"NOT editorially reviewed and NOT rights-reviewed. Every video here is a CANDIDATE: validation proves only that it plays, is embeddable and is the stated length. Behind ideas_personal_growth_enabled, which is false in production.",
  categories, channels:[...chans.values()].sort((a,b)=>a.name.localeCompare(b.name)), videos };
writeFileSync("catalogue/ideas-growth.json", JSON.stringify(out,null,1)+"\n");
for (const c of categories) console.log(`  ${c.id.padEnd(16)} ${String(c.vids.length).padStart(3)} videos`);
console.log(`  channels: ${out.channels.length}  (${out.channels.filter(c=>c.avatar).length} with an avatar)`);
console.log(`  videos total: ${Object.keys(videos).length}   dropped as ineligible: ${dropped}`);
for (const c of out.channels) console.log(`    ${c.avatar?"img":" — "}  ${c.name}`);
