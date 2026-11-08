/* Validate every still-unvalidated seed row, in parallel. Same honesty rules as the
   sequential importer: exact duration measured, embeddable read, captions recorded as
   metadata only, and a transport failure kept distinct from "unavailable". */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const REG = "catalogue/drafts/ideas-personal-growth-registry.json";
const reg = JSON.parse(readFileSync(REG, "utf8"));
const todo = Object.entries(reg.videos).filter(([, r]) => !(typeof r.exact_duration_seconds === "number" && r.exact_duration_seconds > 0)).map(([id]) => id);
console.log(`unvalidated rows: ${todo.length}`);
const run = (args, ms) => new Promise(res => {
  const p = spawn("yt-dlp", args, { stdio:["ignore","pipe","pipe"] });
  let out=""; const t=setTimeout(()=>p.kill("SIGKILL"), ms);
  p.stdout.on("data",d=>out+=d); p.on("close",()=>{clearTimeout(t);res(out.trim());});
});
const en = o => !!(o && Object.keys(o).some(k=>/^en(-|$)/i.test(k)));
let done=0, ok=0, tf=0, inel=0;
async function pool(items, fn, n) { let i=0; await Promise.all(Array.from({length:n},async()=>{ while(i<items.length){const k=i++; await fn(items[k]);} })); }
await pool(todo, async id => {
  let out = await run(["-J","--no-warnings","--skip-download",`https://www.youtube.com/watch?v=${id}`], 90000);
  if (!out) out = await run(["-J","--no-warnings","--skip-download",`https://www.youtube.com/watch?v=${id}`], 120000);
  const r = reg.videos[id];
  if (!out) { r.validation = { state:"check_failed", checked:new Date().toISOString(), note:"yt-dlp returned no output (timeout or throttling) — NOT a statement that the video is unavailable" }; tf++; done++; return; }
  let i=null; try{ i=JSON.parse(out);}catch{}
  if (!i || typeof i!=="object") { r.validation={state:"check_failed",checked:new Date().toISOString(),note:"no video object"}; tf++; done++; return; }
  const dur = Math.round(i.duration||0), emb = i.playable_in_embed !== false;
  r.exact_duration_seconds = dur;
  r.embedding_status = emb ? "embeddable" : "not_embeddable";
  r.verified_channel_id = i.channel_id || r.verified_channel_id || "";
  r.title = i.title || r.title;
  r.validation = { state:"checked", checked:new Date().toISOString(), embeddable:emb,
                   captions_available: en(i.subtitles)?"human": en(i.automatic_captions)?"auto":"none" };
  if (emb && dur>=240 && dur<=960) ok++; else inel++;
  done++;
  if (done % 25 === 0) console.log(`  ${done}/${todo.length}…`);
}, 6);
writeFileSync(REG, JSON.stringify(reg, null, 1) + "\n");
console.log(`done: ${ok} eligible (embeddable, 240-960s), ${inel} ineligible, ${tf} check-failed`);
