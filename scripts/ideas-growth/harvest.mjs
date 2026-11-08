/* Resolve the eight requested channels and harvest eligible clips, in parallel.
   Metadata only (yt-dlp -J --skip-download), nothing downloaded or cached.
   Nothing invented: a channel or video that does not answer is REPORTED, never guessed,
   and a transport failure is kept distinct from "unavailable". */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const WANT = [
  { name:"mmmEnglish",                 handle:"@mmmEnglish",               cat:"pronunciation" },
  { name:"Speak English With Vanessa", handle:"@SpeakEnglishWithVanessa",  cat:"pronunciation" },
  { name:"RealLife English",           handle:"@reallifeenglish1",         cat:"pronunciation" },
  { name:"Vinh Giang",                 handle:"@askvinh",                  cat:"public_speaking" },
  { name:"Huberman Lab",               handle:"@hubermanlab",              cat:"ideas_growth" },
  { name:"Modern Wisdom",              handle:"@ChrisWillx",               cat:"ideas_growth" },
  { name:"The Diary of a CEO",         handle:"@TheDiaryOfACEO",           cat:"ideas_growth" },
  { name:"The School of Life",         handle:"@theschooloflifetv",        cat:"ideas_growth" },
];
const MIN = 240, MAX = 960, PER_CHANNEL = 12, LIST = 40, CONC = 6;

const run = (args, ms) => new Promise(res => {
  const p = spawn("yt-dlp", args, { stdio:["ignore","pipe","pipe"] });
  let out="", err=""; const t = setTimeout(()=>{ p.kill("SIGKILL"); }, ms);
  p.stdout.on("data",d=>out+=d); p.stderr.on("data",d=>err+=d);
  p.on("close",()=>{ clearTimeout(t); res({out:out.trim(),err:err.trim()}); });
});
async function pool(items, fn, n=CONC) {
  const out=[]; let i=0;
  await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{
    while(i<items.length){ const k=i++; out[k]=await fn(items[k],k); }
  }));
  return out;
}
const en = o => !!(o && Object.keys(o).some(k=>/^en(-|$)/i.test(k)));

/* 1. resolve each channel: id, canonical name, avatar */
const chans = await pool(WANT, async c => {
  let r = await run(["-J","--no-warnings","--skip-download","--playlist-items","0",`https://www.youtube.com/${c.handle}`], 90000);
  if (!r.out) r = await run(["-J","--no-warnings","--skip-download","--playlist-items","0",`https://www.youtube.com/${c.handle}`], 120000);
  if (!r.out) return { ...c, fail:"CHECK FAILED (no output — timeout/throttle, not a statement the channel is absent)" };
  let j; try { j=JSON.parse(r.out); } catch { j=null; }
  if (!j || typeof j !== "object") return { ...c, fail:`no channel object (yt-dlp returned ${String(r.out).slice(0,40)}) — handle may be wrong` };
  const av=(j.thumbnails||[]).filter(t=>/avatar/i.test(t.id||"")||(t.width&&t.width===t.height)).sort((a,b)=>(b.width||0)-(a.width||0))[0];
  return { ...c, id:j.channel_id||j.id||"", observedName:j.channel||j.title||"", avatar: av?av.url:null };
}, 4);
for (const c of chans) console.log(c.fail ? `CHANNEL ${c.name}: ${c.fail}` : `CHANNEL ${c.name} -> ${c.id}  "${c.observedName}"  avatar=${c.avatar?"yes":"NO"}`);

/* 2. list recent uploads (flat, one call per channel) */
const good = chans.filter(c=>c.id && !c.fail);
const listed = await pool(good, async c => {
  const r = await run(["-J","--no-warnings","--skip-download","--flat-playlist","--playlist-end",String(LIST),`https://www.youtube.com/channel/${c.id}/videos`], 120000);
  if (!r.out) return { c, vids:[], note:"CHECK FAILED listing" };
  let j; try{ j=JSON.parse(r.out);}catch{ j=null; }
  if (!j || typeof j !== "object") return { c, vids:[], note:"no listing object" };
  const vids=(j.entries||[]).filter(e=>e&&e.id&&/^[A-Za-z0-9_-]{11}$/.test(e.id))
    .map(e=>({id:e.id,dur:e.duration||0,title:e.title||""}))
    .filter(e=>e.dur>=MIN&&e.dur<=MAX);         // the listing duration is a FILTER; the exact one is measured below
  return { c, vids };
}, 4);
for (const l of listed) console.log(`LIST ${l.c.name}: ${l.vids.length} in ${MIN}-${MAX}s of ${LIST} recent${l.note?"  "+l.note:""}`);

/* 3. validate the shortlist properly, in parallel */
const jobs=[];
for (const l of listed) for (const v of l.vids.slice(0, PER_CHANNEL)) jobs.push({ ...v, ch:l.c });
console.log(`\nvalidating ${jobs.length} videos, concurrency ${CONC}…`);
const checked = await pool(jobs, async j => {
  let r = await run(["-J","--no-warnings","--skip-download",`https://www.youtube.com/watch?v=${j.id}`], 90000);
  if (!r.out) r = await run(["-J","--no-warnings","--skip-download",`https://www.youtube.com/watch?v=${j.id}`], 120000);
  if (!r.out) return { ...j, ok:false, transport:true };
  let i; try{ i=JSON.parse(r.out);}catch{ i=null; }
  if (!i || typeof i !== "object") return { ...j, ok:false, parse:true };
  const dur=Math.round(i.duration||0);
  const embeddable = i.playable_in_embed !== false;
  return { ...j, ok: embeddable && dur>=MIN && dur<=MAX, embeddable, dur,
    title:i.title||j.title, chId:i.channel_id||"",
    caps: en(i.subtitles)?"human": en(i.automatic_captions)?"auto":"none" };
});
const okv = checked.filter(v=>v.ok);
console.log(`validated: ${okv.length} ok, ${checked.filter(v=>v.transport).length} check-failed, ${checked.filter(v=>!v.ok&&!v.transport).length} ineligible`);
writeFileSync(process.argv[2], JSON.stringify({ channels:chans, videos:okv }, null, 1));
console.log("wrote " + process.argv[2]);
