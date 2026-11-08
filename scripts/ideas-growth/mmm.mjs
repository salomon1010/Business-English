import { spawn } from "node:child_process"; import { writeFileSync } from "node:fs";
const ID="UCrRiVfHqBIIvSgKmgnSY66g", MIN=240, MAX=960, TAKE=12;
const run=(a,ms)=>new Promise(r=>{const p=spawn("yt-dlp",a,{stdio:["ignore","pipe","pipe"]});let o="";const t=setTimeout(()=>p.kill("SIGKILL"),ms);p.stdout.on("data",d=>o+=d);p.on("close",()=>{clearTimeout(t);r(o.trim());});});
const en=o=>!!(o&&Object.keys(o).some(k=>/^en(-|$)/i.test(k)));
const list=await run(["-J","--no-warnings","--skip-download","--flat-playlist","--playlist-end","40",`https://www.youtube.com/channel/${ID}/videos`],120000);
let j=null; try{j=JSON.parse(list);}catch{}
if(!j||typeof j!=="object"){ console.log("listing failed"); process.exit(1); }
const cand=(j.entries||[]).filter(e=>e&&e.id&&(e.duration||0)>=MIN&&(e.duration||0)<=MAX).slice(0,TAKE);
console.log(`candidates in ${MIN}-${MAX}s: ${cand.length}`);
async function pool(items,fn,n){let i=0;const o=[];await Promise.all(Array.from({length:n},async()=>{while(i<items.length){const k=i++;o[k]=await fn(items[k]);}}));return o;}
const out=await pool(cand, async e=>{
  let s=await run(["-J","--no-warnings","--skip-download",`https://www.youtube.com/watch?v=${e.id}`],90000);
  if(!s) s=await run(["-J","--no-warnings","--skip-download",`https://www.youtube.com/watch?v=${e.id}`],120000);
  let i=null; try{i=JSON.parse(s);}catch{}
  if(!i||typeof i!=="object") return null;
  const dur=Math.round(i.duration||0);
  if(i.playable_in_embed===false||dur<MIN||dur>MAX) return null;
  return { id:e.id, dur, title:i.title||"", chId:i.channel_id||"", ch:i.channel||"mmmEnglish",
           caps: en(i.subtitles)?"human": en(i.automatic_captions)?"auto":"none" };
},6);
const ok=out.filter(Boolean);
console.log(`validated ok: ${ok.length}`);
writeFileSync(process.argv[2], JSON.stringify({ channel:{ id:ID, name:"mmmEnglish", handle:"@mmmEnglish",
  avatar:"https://yt3.googleusercontent.com/RFXL_Eqyw1aVTicQvA6RFL5LwKQ5yUof989SYz0blxzzyW_sTtAlp6rjr_cyxcO1ejF-Ek5_hg=s900-c-k-c0x00ffffff-no-rj",
  cat:"pronunciation" }, videos:ok }, null, 1));
for(const v of ok) console.log(`  ${String(v.dur).padStart(3)}s ${v.caps.padEnd(6)} ${v.title.slice(0,66)}`);
