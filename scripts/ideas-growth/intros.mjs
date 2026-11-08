/* Validate the 50 self-introduction links. The list came from another assistant which
   states it did not verify playback, transcripts or two of the runtimes — so NOTHING
   from that table is carried over. Title, duration, channel and embeddability are read
   from YouTube; a row that does not answer is reported, never filled in. */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const ids = readFileSync(process.argv[2],"utf8").split(/\s+/).filter(Boolean);
const run = (a, ms) => new Promise(r => { const p=spawn("yt-dlp",a,{stdio:["ignore","pipe","pipe"]});
  let o=""; const t=setTimeout(()=>p.kill("SIGKILL"),ms); p.stdout.on("data",d=>o+=d); p.on("close",()=>{clearTimeout(t);r(o.trim());}); });
const en = o => !!(o && Object.keys(o).some(k=>/^en(-|$)/i.test(k)));
async function pool(items, fn, n){ let i=0; const out=[]; await Promise.all(Array.from({length:n},async()=>{ while(i<items.length){const k=i++; out[k]=await fn(items[k]);} })); return out; }
const res = await pool(ids, async id => {
  let o = await run(["-J","--no-warnings","--skip-download",`https://www.youtube.com/watch?v=${id}`], 90000);
  if (!o) o = await run(["-J","--no-warnings","--skip-download",`https://www.youtube.com/watch?v=${id}`], 120000);
  if (!o) return { id, state:"check_failed", note:"no output — timeout/throttle, NOT a statement the video is unavailable" };
  let i=null; try{ i=JSON.parse(o);}catch{}
  if (!i || typeof i!=="object") return { id, state:"unavailable", note:"no video object returned" };
  return { id, state:"checked", dur:Math.round(i.duration||0), title:i.title||"", ch:i.channel||i.uploader||"",
    chId:i.channel_id||"", embeddable:i.playable_in_embed!==false,
    caps: en(i.subtitles)?"human": en(i.automatic_captions)?"auto":"none" };
}, 6);
const okRows = res.filter(r => r.state==="checked" && r.embeddable && r.dur>0);
console.log(`checked ${res.length}: ${okRows.length} playable+embeddable, ${res.filter(r=>r.state==="check_failed").length} check-failed, ${res.filter(r=>r.state==="unavailable").length} unavailable, ${res.filter(r=>r.state==="checked"&&!r.embeddable).length} NOT embeddable`);
for (const r of res.filter(r=>r.state!=="checked"||!r.embeddable)) console.log(`  excluded ${r.id}: ${r.state}${r.embeddable===false?" / embedding disabled":""}`);
const short = okRows.filter(r=>r.dur<=75), rest = okRows.filter(r=>r.dur>75);
console.log(`\n45-75s (the baseline target): ${short.length}`);
for (const r of short) console.log(`  ${String(r.dur).padStart(3)}s  ${r.caps.padEnd(6)} ${r.ch} — ${r.title.slice(0,60)}`);
console.log(`longer, excerpt candidates: ${rest.length}`);
writeFileSync(process.argv[3], JSON.stringify(okRows,null,1));
