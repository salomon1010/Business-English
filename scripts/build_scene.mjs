#!/usr/bin/env node
/* Build one Shadow Studio scene's audio and captions, once, from its script.

     node scripts/build_scene.mjs coworker-intro

   Reads scenes/<slug>/scene.json + scenes/cast.json and writes
   scenes/<slug>/audio.mp3, scenes/<slug>/captions.json and scenes/<slug>/poster.svg.

   1. Each line is spoken by the Polish Worker's TTS route (OpenAI
      gpt-4o-mini-tts) in the character's voice and delivery note. OpenAI's
      terms allow commercial use of this output; the app labels the voices as
      AI. macOS `say` is NOT used: Apple's licence limits system voices to
      personal, non-commercial use.
   2. Each line's audio goes back through the Worker's transcription route
      (Whisper, word timestamps). The word times in captions.json are those
      MEASURED times, offset into the joined file — nothing is estimated. The
      script's own words are kept as the text; Whisper only lends the timing.
      A line whose words cannot be matched fails the build rather than
      shipping a guessed time.
   3. ffmpeg joins the lines with leadMs of silence first and gapMs between
      them, mono 48 kb/s MP3 (about 6 KB a second).

   Per-line MP3s are cached in $SCENE_CACHE (default: the OS temp dir), so a
   rerun after editing one line pays for that line only. Delete the cache to
   re-voice everything. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const API = process.env.POLISH_API || "https://be-polish.nore-ngou.workers.dev";
const ORIGIN = process.env.SCENE_ORIGIN || "https://staging.lomonec.com";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const slug = process.argv[2];
if (!slug) { console.error("usage: node scripts/build_scene.mjs <slug>"); process.exit(2); }
const dir = path.join(root, "scenes", slug);
const scene = JSON.parse(fs.readFileSync(path.join(dir, "scene.json"), "utf8"));
const cast = JSON.parse(fs.readFileSync(path.join(root, "scenes", "cast.json"), "utf8")).characters;
const cache = path.join(process.env.SCENE_CACHE || os.tmpdir(), "be-scene-cache", slug);
fs.mkdirSync(cache, { recursive: true });

const norm = w => String(w).toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, "");
const dur = f => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());

async function tts(text, voice, style) {
  const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json", Origin: ORIGIN }, body: JSON.stringify({ tts: text, voice, style }) });
  if (!r.ok) throw new Error("tts " + r.status + " " + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}
async function stt(buf) {
  const r = await fetch(API, { method: "POST", headers: { "content-type": "audio/mpeg", Origin: ORIGIN }, body: buf });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !Array.isArray(j.words)) throw new Error("stt " + r.status + " " + JSON.stringify(j).slice(0, 200));
  return j.words;
}
/* script tokens ← Whisper words, in order. Whisper may split or drop
   punctuation; it must not disagree on the words themselves. */
function align(text, heard) {
  const toks = text.split(/\s+/).filter(Boolean), out = [];
  let h = 0;
  for (const tok of toks) {
    const want = norm(tok);
    let k = h; while (k < heard.length && k < h + 3 && norm(heard[k].w) !== want) k++;
    if (k >= heard.length || norm(heard[k].w) !== want) throw new Error(`line "${text}": "${tok}" not found in Whisper's words ${JSON.stringify(heard.map(x => x.w))}`);
    out.push({ w: tok, start: heard[k].start, end: heard[k].end }); h = k + 1;
  }
  /* Whisper sometimes gives two short words the same start ("bit more"); the
     app would then share the run out and mark it estimated. The first word's
     own measured end is where the second begins — still a measured time. */
  for (let k = 1; k < out.length; k++)
    if (out[k].start <= out[k - 1].start && out[k - 1].end > out[k - 1].start) out[k].start = out[k - 1].end;
  return out;
}

const lines = [];
for (const [i, ln] of scene.lines.entries()) {
  const c = cast[ln.speaker]; if (!c) throw new Error("no cast member " + ln.speaker);
  const key = crypto.createHash("sha1").update([ln.text, c.voice, c.style].join("|")).digest("hex").slice(0, 12);
  const f = path.join(cache, `l${i}-${key}.mp3`);
  if (!fs.existsSync(f)) { process.stdout.write(`voicing ${i + 1}/${scene.lines.length} (${c.name})… `); fs.writeFileSync(f, await tts(ln.text, c.voice, c.style)); console.log("ok"); }
  const wf = f.replace(/\.mp3$/, ".words.json");
  if (!fs.existsSync(wf)) fs.writeFileSync(wf, JSON.stringify(await stt(fs.readFileSync(f))));
  const words = align(ln.text, JSON.parse(fs.readFileSync(wf, "utf8")));
  lines.push({ ...ln, file: f, dur: dur(f), words });
}

/* join: lead silence, line, gap, line, … */
const lead = (scene.leadMs || 400) / 1000, gap = (scene.gapMs || 700) / 1000;
const args = ["-y", "-v", "error"], parts = [];
let t = lead, n = 0;
args.push("-f", "lavfi", "-t", String(lead), "-i", "anullsrc=r=24000:cl=mono"); parts.push(`[${n++}:a]`);
const cues = [], words = [];
lines.forEach((ln, i) => {
  args.push("-i", ln.file); parts.push(`[${n++}:a]`);
  const first = ln.words[0].start;
  cues.push({ t: +(t + Math.max(0, first - 0.05)).toFixed(3), txt: ln.text, spk: ln.speaker });
  ln.words.forEach(w => words.push({ t: +(t + w.start).toFixed(3), w: w.w }));
  t += ln.dur;
  if (i < lines.length - 1) { args.push("-f", "lavfi", "-t", String(gap), "-i", "anullsrc=r=24000:cl=mono"); parts.push(`[${n++}:a]`); t += gap; }
});
const filter = parts.map(p => p.replace(":a]", ":a]aresample=24000,aformat=channel_layouts=mono")).map((p, i) => `${p}[a${i}]`).join(";") +
  ";" + parts.map((_, i) => `[a${i}]`).join("") + `concat=n=${parts.length}:v=0:a=1[out]`;
const outMp3 = path.join(dir, scene.audio || "audio.mp3");
execFileSync("ffmpeg", [...args, "-filter_complex", filter, "-map", "[out]", "-ac", "1", "-ar", "24000", "-b:a", "48k", outMp3]);

/* the joined file's real length, and a check that the offsets add up to it */
const total = dur(outMp3);
if (Math.abs(total - t) > 0.25) throw new Error(`joined length ${total}s vs computed ${t}s — offsets would drift`);
const captions = { vid: scene.id, source: "scene: OpenAI TTS voices, word times measured by Whisper", lang: "en", measured: true, duration: +total.toFixed(3), cues, words };
fs.writeFileSync(path.join(dir, scene.captions || "captions.json"), JSON.stringify(captions));
/* the library card shows the length; written into scene.json in place, so the hand-kept layout survives */
const sp = path.join(dir, "scene.json"), st = fs.readFileSync(sp, "utf8"), ds = `"durationS": ${total.toFixed(1)}`;
fs.writeFileSync(sp, /"durationS":\s*[\d.]+/.test(st) ? st.replace(/"durationS":\s*[\d.]+/, ds) : st.replace(/("captions":[^\n]*\n)/, `$1  ${ds},\n`));
/* the poster: the stage as one SVG file, drawn by the app's own renderer */
await import(path.join(root, "shadow-scenes.js"));
fs.writeFileSync(path.join(dir, "poster.svg"), globalThis.ShadowScenes.posterSVG(scene, cast) + "\n");
console.log(`${scene.id}: ${lines.length} lines, ${words.length} words, ${total.toFixed(1)} s, ${(fs.statSync(outMp3).size / 1024).toFixed(0)} KB`);
