/* ============================================================================
   BE Mastery — "Executive Polish" backend (Cloudflare Worker)
   ----------------------------------------------------------------------------
   Holds ONE AI key server-side so end users need only an internet connection.
   Returns several professional rewrites of a sentence. Built with hard caps so
   the bill can never run away:
     • CORS locked to the app's own origin (no one else can call it)
     • input length capped (bounds tokens per request)
     • output tokens capped
     • per-IP rate limit (best-effort, in-memory)
     • REAL hard cap = set a monthly budget limit on the AI provider account
       (see backend/README.md) — that is the backstop that can never be exceeded.

   Provider: OpenAI (model gpt-4o-mini — cheapest capable tier). To use Anthropic
   instead, swap the callAI() body (a few lines) — see README.
   Secret required (Worker → Settings → Variables → add secret):  OPENAI_KEY
   ============================================================================ */

// Local testing happens on whatever port is free, and an origin that is not on
// this list has every AI call blocked by CORS — grading, transcription, natural
// voice and the workshop conversations all fail while the app looks fine. That
// cost real debugging time, so the common dev ports are listed rather than the
// one that happened to be used first.
const ALLOWED_ORIGINS = [
  "https://app.lomonec.com",
  "https://staging.lomonec.com",
  "capacitor://localhost",   // the App Store build (mobile/ios): WKWebView cannot use https for a local bundle
  "http://localhost:8000",  "http://127.0.0.1:8000",   // python3 -m http.server 8000
  "http://localhost:4173",  "http://127.0.0.1:4173",   // vite preview
  "http://localhost:5173",  "http://127.0.0.1:5173",   // vite dev
  "http://localhost:3000",  "http://127.0.0.1:3000",
];

const MAX_INPUT_CHARS = 400;   // bounds prompt size
const MAX_OUTPUT_TOKENS = 320; // bounds reply size
const RATE_PER_MIN = 15;       // max Polish clicks per IP per minute
const RATE_PER_DAY = 300;      // max Polish clicks per IP per day

// ---- Natural voice (text-to-speech) ----
// Same OpenAI key drives OpenAI's TTS. The app plays this MP3 when online and
// falls back to the browser's built-in voice when offline / on any failure.
const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICES = ["alloy","ash","ballad","coral","echo","fable","nova","onyx","sage","shimmer","verse"];
const MAX_TTS_CHARS = 600;     // bounds each clip (words/sentences are short)
const TTS_PER_MIN = 60;        // Hear/Slow taps are frequent but tiny
const TTS_PER_DAY = 2000;

// ---- Precise word timings (speech-to-text) ----
// Whisper returns per-word start/end times for a recording, so the app can play
// back exactly the word the user said (the "You" button), not a guessed chunk.
const STT_MODEL = "whisper-1";
const MAX_STT_BYTES = 12 * 1024 * 1024;  // ~12 MB — practice clips are short
const STT_PER_MIN = 20;
const STT_PER_DAY = 600;
const sttHits = new Map();

// ---- YouTube captions (no provider cost; limits just curb abuse of the proxy) ----
const CAP_PER_MIN = 12;
const CAP_PER_DAY = 400;
const capHits = new Map();

// ---- Pronunciation coach (audio-in language model) ----
// gpt-4o-audio-preview actually LISTENS to the learner's recording and grades
// how each word was pronounced — unlike ASR, which only guesses the intended
// word and so forgives bad pronunciation.
// Try these audio-in models in order; the account may only have some enabled.
// If NONE are available (all 404), we fall back to a Whisper cross-check below.
const ASSESS_MODELS = [
  "gpt-4o-audio-preview",
  "gpt-4o-audio-preview-2025-06-03",
  "gpt-4o-audio-preview-2024-12-17",
  "gpt-4o-mini-audio-preview",
];
const MAX_ASSESS_B64 = 6 * 1024 * 1024;  // ~4.5 MB of audio once base64-encoded
const ASSESS_PER_MIN = 15;
const ASSESS_PER_DAY = 400;
const assessHits = new Map();

// best-effort in-memory counters (reset when the worker instance recycles;
// the provider budget cap is the real guarantee)
const hits = new Map();        // ip -> {min:[ts...], day:[ts...]}  (Polish)
const ttsHits = new Map();     // ip -> {min:[ts...], day:[ts...]}  (TTS)

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}

function rateLimited(ip, map, perMin, perDay) {
  const now = Date.now();
  const rec = map.get(ip) || { min: [], day: [] };
  rec.min = rec.min.filter(t => now - t < 60_000);
  rec.day = rec.day.filter(t => now - t < 86_400_000);
  if (rec.min.length >= perMin || rec.day.length >= perDay) {
    map.set(ip, rec);
    return true;
  }
  rec.min.push(now); rec.day.push(now);
  map.set(ip, rec);
  if (map.size > 5000) map.clear(); // crude memory guard
  return false;
}

// Delivery instructions make gpt-4o-mini-tts noticeably warmer and more human
// than its default read — this is the difference between "robotic" and "natural".
const TTS_INSTRUCTIONS =
  "Speak in warm, natural, confident spoken American English — the voice of a " +
  "supportive executive-communication coach. Use relaxed, human intonation and " +
  "rhythm, clear articulation, and a friendly, encouraging tone. Never flat, " +
  "monotone, or robotic; sound like a real person speaking to a colleague.";

// A workplace character is not a communication coach. When the app names one —
// "calm, direct shop supervisor" — the delivery note is appended to the house
// instruction rather than replacing it, so the warmth and clarity survive and only
// the persona changes. Capped and stripped of newlines: this text reaches the
// provider, so it is treated as untrusted input, not as configuration.
const MAX_TTS_STYLE = 180;
function ttsInstructions(style) {
  const s = String(style || "").replace(/[\r\n]+/g, " ").trim().slice(0, MAX_TTS_STYLE);
  return s ? `${TTS_INSTRUCTIONS} For this line, speak in character: ${s}` : TTS_INSTRUCTIONS;
}

async function callTTS(env, text, voice, style) {
  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_KEY}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice,
      input: text,
      instructions: ttsInstructions(style),
      response_format: "mp3",
    }),
  });
}

// Whisper drops "um" and "uh" unless it is shown that they are wanted. The
// speech analysis wants them (they are the "filler words" it counts), the
// shadowing and role-play callers do not — so it is opt-in: POST ...?fillers=1.
const FILLER_PROMPT = "Um, uh, er, hmm, you know, I mean, like, so... Okay, um, let me think.";
async function callTranscribe(env, bytes, mime, keepFillers) {
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("language", "en");
  if (keepFillers) form.append("prompt", FILLER_PROMPT);
  const ext = mime.includes("mp4") || mime.includes("m4a") ? "m4a"
    : mime.includes("ogg") ? "ogg"
    : mime.includes("wav") ? "wav"
    : mime.includes("mpeg") || mime.includes("mp3") ? "mp3"
    : "webm";
  form.append("file", new File([bytes], "clip." + ext, { type: mime || "audio/webm" }));
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_KEY}` },  // fetch sets the multipart boundary itself
    body: form,
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const words = Array.isArray(j.words)
    ? j.words.map(x => ({ w: String(x.word || "").trim(), start: +x.start, end: +x.end }))
             .filter(x => x.w && isFinite(x.start) && isFinite(x.end))
    : [];
  return { words, text: String(j.text || "") };
}

async function callAssess(env, target, audioB64, fmt) {
  const system =
    "You are a strict but fair English pronunciation coach. You will HEAR a learner " +
    "attempt to say a target phrase. Judge ONLY pronunciation — the actual sounds, " +
    "stress and clarity you hear — NOT grammar or word choice. Be honest: if a word " +
    "is mispronounced, unclear, missing or mumbled, score it low even if you can guess " +
    "what was intended. Give each target word a score from 0 (wrong/unintelligible) to " +
    "100 (native-clear). Respond with ONLY minified JSON, no code fences: " +
    '{"overall":<0-100>,"words":[{"word":"<target word>","score":<0-100>,"note":"<max 6-word tip, or empty if good>"}]} ' +
    "with one item per target word, in order.";
  const payload = model => JSON.stringify({
    model,
    modalities: ["text"],
    max_tokens: 600,
    messages: [
      { role: "system", content: system },
      { role: "user", content: [
        { type: "text", text: `Target phrase: "${target}". Score how clearly I pronounced each word.` },
        { type: "input_audio", input_audio: { data: audioB64, format: fmt } },
      ] },
    ],
  });
  let j = null;
  for (const model of ASSESS_MODELS) {                 // use whichever audio model the account has
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_KEY}` },
      body: payload(model),
    });
    if (r.status === 404) continue;                    // model not enabled → try next
    if (!r.ok) throw new Error("provider " + r.status);
    j = await r.json();
    break;
  }
  if (!j) return null;                                 // no audio model available → caller falls back to Whisper
  let raw = j.choices?.[0]?.message?.content || "{}";
  raw = raw.replace(/^```[a-z]*\s*|\s*```$/g, "").trim();
  let parsed; try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  const words = Array.isArray(parsed.words)
    ? parsed.words.map(w => ({
        word: String(w.word || "").trim(),
        score: Math.max(0, Math.min(100, Math.round(+w.score))) || 0,
        note: String(w.note || "").trim().slice(0, 60),
      })).filter(w => w.word).slice(0, 60)
    : [];
  const overall = Math.max(0, Math.min(100, Math.round(+parsed.overall))) || 0;
  return { overall, words, mode: "ai" };
}

// Whisper fallback: transcribe the audio and score each target word by whether
// Whisper actually heard it (in order). Stricter than the browser recogniser,
// and works on any account that has whisper-1.
function b64ToBytes(b64) {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[m][n];
}
async function whisperAssess(env, bytes, mime, target) {
  const { words: wl } = await callTranscribe(env, bytes, mime);
  const heard = wl.map(x => x.w.toLowerCase().replace(/[^a-z0-9']/g, "")).filter(Boolean);
  const tgt = target.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
  let hi = 0, sum = 0; const words = [];
  for (const w of tgt) {
    let score = 18, note = "not heard clearly";
    for (let k = hi; k < Math.min(heard.length, hi + 3); k++) {
      if (heard[k] === w) { score = 95; note = ""; hi = k + 1; break; }
    }
    if (score < 95) for (let k = hi; k < Math.min(heard.length, hi + 3); k++) {
      const sim = 1 - lev(heard[k], w) / Math.max(heard[k].length, w.length, 1);
      if (sim >= 0.6) { score = 55; note = "unclear — practise this sound"; hi = k + 1; break; }
    }
    words.push({ word: w, score, note }); sum += score;
  }
  return { overall: Math.round(sum / Math.max(1, tgt.length)), words, mode: "whisper" };
}

async function callAI(env, sentence, avoid) {
  const system =
    "You are an elite executive communication coach. Rewrite the user's sentence " +
    "into 3 DIFFERENT professional, spoken business-English versions. Each version " +
    "must use different vocabulary and, where natural, a business idiom or executive " +
    "phrase. Keep each concise and natural to say out loud, and preserve the original " +
    "meaning. Do not reuse any sentence in the 'avoid' list. " +
    'Respond with ONLY minified JSON, no code fences: ' +
    '{"versions":[{"text":"<rewrite>","learn":"<the idiom or key phrase used, a few words>"}]} ' +
    "with exactly 3 items.";
  const user = `Sentence: "${sentence}"\nAvoid (do not repeat): ${avoid.length ? avoid.join(" | ") : "none"}`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 1,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const raw = j.choices?.[0]?.message?.content || "{}";
  let parsed; try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  let versions = Array.isArray(parsed.versions) ? parsed.versions : [];
  versions = versions
    .map(v => ({ text: String(v.text || "").trim(), learn: String(v.learn || "").trim() }))
    .filter(v => v.text.length > 3)
    .slice(0, 3);
  return versions;
}

/* ---------------------------------------------------------------
   YouTube captions for a pasted video.

   There is no official way to read captions for a video you don't own
   (the Data API's captions.download is owner-only), so this reads the
   watch page and follows the caption track it advertises. That means it
   is inherently fragile: YouTube changes the page from time to time,
   may serve a consent/bot wall to datacentre IPs, and many videos have
   captions disabled. Every failure returns a plain reason so the app can
   fall back to asking the user to paste the transcript.

   Returns the same shape as the bundled captions/<id>.json files:
   { vid, source, lang, cues:[{t,txt}], words:[{t,w}] }
--------------------------------------------------------------- */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchYouTubeCaptions(vid) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) return { error: "bad_id" };

  const page = await fetch("https://www.youtube.com/watch?v=" + vid + "&hl=en", {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
  });
  if (!page.ok) return { error: "page_" + page.status };
  const html = await page.text();

  // the player response carries the caption track list
  const m = html.match(/"captionTracks":(\[.*?\])/);
  if (!m) return { error: "no_captions" };
  let tracks; try { tracks = JSON.parse(m[1]); } catch { return { error: "parse_failed" }; }
  if (!tracks.length) return { error: "no_captions" };

  // prefer a real English track, then any English, then whatever exists
  const pick =
    tracks.find(t => (t.languageCode || "").startsWith("en") && t.kind !== "asr") ||
    tracks.find(t => (t.languageCode || "").startsWith("en")) ||
    tracks[0];
  if (!pick || !pick.baseUrl) return { error: "no_track" };

  const tt = await fetch(pick.baseUrl + "&fmt=json3", { headers: { "user-agent": UA } });
  if (!tt.ok) return { error: "track_" + tt.status };
  let data; try { data = await tt.json(); } catch { return { error: "track_parse" }; }

  const cues = [], words = [];
  for (const ev of data.events || []) {
    if (!ev.segs) continue;
    const start = (ev.tStartMs || 0) / 1000;
    let txt = "";
    for (const s of ev.segs) {
      const piece = (s.utf8 || "").replace(/\n/g, " ");
      if (!piece.trim()) { txt += piece; continue; }
      words.push({ t: +(start + (s.tOffsetMs || 0) / 1000).toFixed(3), w: piece.trim() });
      txt += piece;
    }
    txt = txt.replace(/\s+/g, " ").trim();
    if (txt) cues.push({ t: +start.toFixed(2), txt });
  }
  if (!cues.length) return { error: "empty_track" };

  return {
    vid,
    source: "youtube",
    lang: pick.languageCode || "en",
    asr: pick.kind === "asr",
    cues,
    words,
  };
}

/* ---------------------------------------------------------------
   Role-play conversation.

   The app used to call Anthropic straight from the browser with a key
   the user pasted in themselves, which is why the feature stayed
   hidden — you cannot ship that. The call lives here now so the key
   never leaves the Worker and users need nothing.

   In: { chat: { system, messages:[{role,content}] } }
   Out: { reply, covered:[n] }   (the model is asked for exactly this)
--------------------------------------------------------------- */
const CHAT_PER_MIN = 20;
const CHAT_PER_DAY = 500;
const chatHits = new Map();
const CHAT_MODEL = "gpt-4o-mini";
const MAX_CHAT_TURNS = 40;

/* ---------------------------------------------------------------
   Executive Polish — speech analysis.

   The learner spoke for about a minute. The app already measured what a
   machine measures well (pace, pauses, pitch range, filler and hedging
   counts, sentence length, vocabulary) on the device; this call asks the
   model for what only a reader can judge — the key message, how it was
   structured, what makes it credible or not, and the one thing to work on
   next. Every field is a short string, sliced hard, so the report renders
   the same whatever the model returns.
--------------------------------------------------------------- */
const AN_MODEL = "gpt-4o-mini";
const AN_PER_MIN = 6;
const AN_PER_DAY = 150;
const anHits = new Map();
const MAX_AN_CHARS = 4000;     // ~10 minutes of speech; the app sends ~1
const AN_FIELDS = {            // field -> max chars
  key_message: 240, clarity: 8, sharper: 280, structure_note: 260, answer_directly: 260,
  example: 280, evidence: 260, credibility: 260, remember_title: 90, remember_body: 320,
  next_recording: 320, quick_win_title: 90, quick_win_goal: 220, concept_title: 70, concept_body: 240,
};
const AN_LANGS = { en:"English", es:"Spanish", fr:"French", pt:"Portuguese", it:"Italian", de:"German", ru:"Russian", ar:"Arabic", ur:"Urdu", hi:"Hindi", bn:"Bengali", id:"Indonesian", vi:"Vietnamese", zh:"Chinese", ja:"Japanese", ko:"Korean" };
function anStr(v, max) { return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : ""; }
async function callAnalyse(env, transcript, metrics, lang) {
  const language = AN_LANGS[lang] || "English";
  const system =
    "You are an executive speaking coach for professionals who use English as a second language. " +
    "The learner spoke for about a minute (transcript below, fillers kept). Measured numbers are given; do not re-measure. " +
    "Judge what a listener judges: the key message, the structure, what makes the speaker credible, and the one change that matters most. " +
    "Be concrete and specific: quote the learner's own words. Never invent facts the learner did not say. " +
    "Write in " + language + ", EXCEPT key_message, sharper, example and the hedges' better versions, which are lines the learner will SAY and must be in plain spoken English (B1 level, short). " +
    "Respond with ONLY minified JSON, no code fences, exactly these keys: " +
    '{"key_message":"<the one thing they were saying, one sentence, English, in their words>",' +
    '"clarity":"clear"|"fuzzy",' +
    '"sharper":"<the key message said better: one plain sentence, max 22 words>",' +
    '"structure":["<part 1>","<part 2>",...],' +
    '"structure_note":"<one sentence: what the order did for the listener>",' +
    '"answer_directly":"<one sentence: the first change to make to the opening>",' +
    '"example":"<one English sentence they could open with>",' +
    '"evidence":"<one sentence on the proof they gave or did not give>",' +
    '"credibility":"<one sentence on hedges and certainty, quoting them>",' +
    '"hedges":[{"said":"<phrase they used>","better":"<the same idea stated plainly>"}],' +
    '"remember_title":"<3-8 words>","remember_body":"<two sentences>",' +
    '"next_recording":"<the exact task for the next 60-second recording>",' +
    '"quick_win_title":"<3-8 words>","quick_win_goal":"<one measurable goal>",' +
    '"concept_title":"<a speaking principle they just used or need, 2-5 words>","concept_body":"<one sentence tying it to their speech>",' +
    '"versions":[{"style":"<2-4 words naming the register, e.g. Clear and direct / Executive polish>","text":"<the WHOLE speech said again in that register>","learn":["<each professional phrase or business idiom this version introduced, exact words as they appear in text>"]}],' +
    '"idioms":[{"idiom":"<a professional idiom or executive phrase the learner did NOT use>","meaning":"<plain meaning, one line>","when":"<the situation it fits, one line>","example":"<one sentence using it about the learner\'s own topic>"}]} ' +
    "structure has 3 to 5 items of at most 6 words each; hedges has 0 to 3 items. " +
    "versions has EXACTLY 2 items: two different ways the learner could have said the same thing — every fact, name and number kept, first person, spoken register, 60-110% of the original length, no filler, no hedging; version 1 plain and direct (B1), version 2 polished executive English (B2-C1). Each version must weave in 2 or 3 professional phrases or business idioms naturally and list them in learn, and versions and their learn items are always in English. " +
    "idioms has EXACTLY 3 items: NEW professional idioms or executive phrases (not ones the learner used, and different from those in versions) that fit the learner's topic and next conversation; idiom and example in English, meaning and when in " + language + ".";
  const user = "Transcript:\n" + transcript + "\n\nMeasured:\n" + JSON.stringify(metrics);
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: AN_MODEL, max_tokens: 2600, temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const raw = ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "{}").trim();
  let p; try { p = JSON.parse(raw); } catch { p = {}; }
  const out = {};
  for (const [k, max] of Object.entries(AN_FIELDS)) out[k] = anStr(p[k], max);
  out.clarity = out.clarity === "fuzzy" ? "fuzzy" : "clear";
  out.structure = (Array.isArray(p.structure) ? p.structure : []).map(x => anStr(x, 60)).filter(Boolean).slice(0, 5);
  out.hedges = (Array.isArray(p.hedges) ? p.hedges : [])
    .map(h => h && typeof h === "object" ? { said: anStr(h.said, 60), better: anStr(h.better, 160) } : null)
    .filter(h => h && h.said && h.better).slice(0, 3);
  /* two full versions of what they said (owner, 2026-09-21) + three idioms to learn */
  out.versions = (Array.isArray(p.versions) ? p.versions : [])
    .map(v => v && typeof v === "object" ? { style: anStr(v.style, 40), text: anStr(v.text, 1600), learn: (Array.isArray(v.learn) ? v.learn : []).map(x => anStr(x, 60)).filter(Boolean).slice(0, 4) } : null)
    .filter(v => v && v.text.split(" ").length >= 8).slice(0, 2);
  out.idioms = (Array.isArray(p.idioms) ? p.idioms : [])
    .map(x => x && typeof x === "object" ? { idiom: anStr(x.idiom, 60), meaning: anStr(x.meaning, 160), when: anStr(x.when, 160), example: anStr(x.example, 220) } : null)
    .filter(x => x && x.idiom && x.meaning).slice(0, 3);
  return out;
}

async function callChat(env, system, messages) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 400,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const raw = ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").trim();
  return shapeChat(raw);
}
function shapeChat(raw) {
  let p;
  try { p = JSON.parse(raw); } catch { p = { reply: raw, covered: [] }; }
  if (!p.reply || typeof p.reply !== "string") p.reply = "Sorry, could you say that again?";
  if (!Array.isArray(p.covered)) p.covered = [];
  // Two callers, two id schemes: the interview coaches number their talking
  // points 1..n, the workplace simulations name their objectives ("safety",
  // "handover"). Coercing with Number() was written for the first and silently
  // turned every one of the second into NaN, so the model's coverage judgement
  // never reached the simulations at all. Both shapes pass through now; the
  // client is the one that validates an id against its own rubric, and it
  // already refuses anything it does not recognise.
  p.covered = p.covered
    .filter(v => typeof v === "number" ? Number.isFinite(v)
               : typeof v === "string" ? v.length > 0 && v.length <= 64
               : false)
    .slice(0, 32);                       // a reply cannot cover more than a scenario has
  const out = { reply: p.reply.slice(0, 800), covered: p.covered };
  if (typeof p.characterId === "string" && p.characterId.length <= 64) out.characterId = p.characterId;
  return out;
}

/* Walks the model's JSON as it is typed. The moment a "characterId" string is
   complete it calls emit({c}) — once, and only if it arrives before the reply
   does, because a speaker named afterwards is too late to change the voice
   that is already talking. Then it finds the "reply" string, decodes it
   (escapes included) and calls emit({s}) for each finished sentence; end()
   emits whatever is left. Pure, so it is unit-tested in Node. */
export function replyWalker(emit) {
  let head = "", inReply = false, done = false, esc = false, uni = null, reply = "", sentAt = 0, named = false;
  const flush = final => {
    const pending = reply.slice(sentAt);
    const parts = final ? [pending] : (pending.match(/[^.!?…]+[.!?…]+["')\]]*\s+/g) || []);
    for (const part of parts) { const t = part.trim(); if (t) emit({ s: t }); sentAt += part.length; }
  };
  const feedChar = ch => {
    if (done) return;
    if (esc) {
      if (uni !== null) { uni += ch; if (uni.length === 4) { reply += String.fromCharCode(parseInt(uni, 16) || 63); uni = null; esc = false; } return; }
      if (ch === "u") { uni = ""; return; }
      reply += (ch === "n" || ch === "t" || ch === "r") ? " " : ch; esc = false; return;
    }
    if (ch === "\\") { esc = true; uni = null; return; }
    if (ch === '"') { done = true; flush(true); return; }
    reply += ch; if (/\s/.test(ch)) flush(false);
  };
  return {
    feed(delta) {
      for (const ch of delta) {
        if (inReply) { feedChar(ch); continue; }
        head += ch;
        if (!named) {
          const c = /"characterId"\s*:\s*"([^"\\]{1,64})"/.exec(head);
          if (c) { named = true; emit({ c: c[1] }); }
        }
        const m = /"reply"\s*:\s*"$/.test(head);
        if (m) { inReply = true; head = ""; }
      }
    },
    end() { if (inReply && !done) { done = true; flush(true); } },
    text() { return reply; }
  };
}

/* ---- Streaming chat: the same call with stream:true, read token by token.
   The model answers as a JSON object whose first field is "characterId" and
   whose second is "reply"; this names the speaker as soon as the id is typed,
   then walks the reply string and emits each finished sentence at once, so
   the app can start speaking — in the right voice — while the rest is still
   being written. The last line carries the full, validated object exactly as
   the non-streaming path would have returned it. NDJSON, one object per line:
     {"c":"supervisor"}  {"s":"First sentence."}   … {"done":true,"reply":…,"covered":[…],"characterId":…}
   Anything that goes wrong mid-stream ends with {"error":…}; the client then
   falls back to what it already has. */
async function streamChat(env, system, messages, cors) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: CHAT_MODEL, max_tokens: 400, temperature: 0.8, stream: true,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!r.ok || !r.body) throw new Error("provider " + r.status);
  const enc = new TextEncoder(), dec = new TextDecoder();
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  const line = obj => w.write(enc.encode(JSON.stringify(obj) + "\n"));
  (async () => {
    let raw = "", sse = "";
    const walker = replyWalker(obj => line(obj));
    try {
      const reader = r.body.getReader();
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        sse += dec.decode(value, { stream: true });
        let nl; while ((nl = sse.indexOf("\n")) >= 0) {
          const l = sse.slice(0, nl).trim(); sse = sse.slice(nl + 1);
          if (!l.startsWith("data:")) continue; const d = l.slice(5).trim(); if (d === "[DONE]") continue;
          let delta = ""; try { delta = JSON.parse(d).choices[0].delta.content || ""; } catch { continue; }
          raw += delta; walker.feed(delta);
        }
      }
      walker.end();
      await line({ done: true, ...shapeChat(raw.trim()) });
    } catch (e) { try { await line({ error: String(e.message || e) }); } catch {} }
    try { await w.close(); } catch {}
  })();
  return new Response(readable, { status: 200, headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", ...cors } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
    if (!cors["Access-Control-Allow-Origin"]) return new Response("Forbidden", { status: 403 });

    const ip = request.headers.get("CF-Connecting-IP") || "0";

    // ---- Transcribe path: raw audio in → per-word timings out ----
    const ctype = request.headers.get("content-type") || "";
    if (ctype.startsWith("audio/")) {
      if (rateLimited(ip, sttHits, STT_PER_MIN, STT_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength) return json({ error: "empty" }, 400, cors);
      if (bytes.byteLength > MAX_STT_BYTES) return json({ error: "too_large" }, 413, cors);
      try {
        const keepFillers = new URL(request.url).searchParams.get("fillers") === "1";
        const out = await callTranscribe(env, bytes, ctype, keepFillers);
        return json(out, 200, cors);
      } catch (e) {
        return json({ error: "stt_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    let body; try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400, cors); }

    // ---- Role-play chat: scenario + history in → in-character reply out ----
    if (body.chat && typeof body.chat === "object") {
      if (rateLimited(ip, chatHits, CHAT_PER_MIN, CHAT_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      const system = String(body.chat.system || "").slice(0, 4000);
      let messages = Array.isArray(body.chat.messages) ? body.chat.messages : [];
      messages = messages
        .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-MAX_CHAT_TURNS)                       // cap history so a long chat cannot balloon the bill
        .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
      if (!system || !messages.length) return json({ error: "bad_request" }, 400, cors);
      try {
        if (body.chat.stream === true) return await streamChat(env, system, messages, cors);
        return json(await callChat(env, system, messages), 200, cors);
      } catch (e) {
        return json({ error: "chat_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- Captions path: video id in → cues + word timings out ----
    if (typeof body.captions === "string" && body.captions.trim()) {
      if (rateLimited(ip, capHits, CAP_PER_MIN, CAP_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      try {
        const out = await fetchYouTubeCaptions(body.captions.trim());
        // cache successes hard — a video's captions do not change
        const headers = out.error ? cors : { "cache-control": "public, max-age=604800", ...cors };
        return json(out, out.error ? 404 : 200, headers);
      } catch (e) {
        return json({ error: "captions_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- TTS path: natural voice for the app's Hear/Slow buttons ----
    if (typeof body.tts === "string" && body.tts.trim()) {
      if (rateLimited(ip, ttsHits, TTS_PER_MIN, TTS_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      const text = body.tts.trim().slice(0, MAX_TTS_CHARS);
      let voice = String(body.voice || "alloy").toLowerCase();
      if (!TTS_VOICES.includes(voice)) voice = "alloy";
      try {
        const r = await callTTS(env, text, voice, body.style);
        if (!r.ok) return json({ error: "tts_unavailable", detail: "provider " + r.status }, 502, cors);
        return new Response(r.body, {
          status: 200,
          headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=86400", ...cors },
        });
      } catch (e) {
        return json({ error: "tts_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- Pronunciation-assessment path: audio (base64) + target → per-word scores ----
    if (typeof body.assess === "string" && body.assess.trim() && typeof body.audio === "string" && body.audio) {
      if (rateLimited(ip, assessHits, ASSESS_PER_MIN, ASSESS_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      if (body.audio.length > MAX_ASSESS_B64) return json({ error: "too_large" }, 413, cors);
      const target = body.assess.trim().slice(0, MAX_INPUT_CHARS);
      const fmt = body.format === "mp3" ? "mp3" : "wav";
      try {
        let out = await callAssess(env, target, body.audio, fmt);
        if (!out) out = await whisperAssess(env, b64ToBytes(body.audio), "audio/" + fmt, target); // no audio model → cross-check
        return json(out, 200, cors);
      } catch (e) {
        return json({ error: "assess_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- Speech-analysis path: transcript + device-measured numbers → coaching report ----
    if (body.analyse && typeof body.analyse === "object") {
      if (rateLimited(ip, anHits, AN_PER_MIN, AN_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      const transcript = String(body.analyse.transcript || "").replace(/\s+/g, " ").trim().slice(0, MAX_AN_CHARS);
      if (transcript.split(" ").length < 5) return json({ error: "empty" }, 400, cors);
      const metrics = body.analyse.metrics && typeof body.analyse.metrics === "object" ? body.analyse.metrics : {};
      const m = {};                                    // numbers only, a bounded set — nothing personal rides along
      for (const k of ["seconds","words","wpm","hesitations","fillers","hedges","wordsPerSentence","sentences","vocabularyPct","pitchSemitones"]) {
        if (Number.isFinite(+metrics[k])) m[k] = Math.round(+metrics[k] * 10) / 10;
      }
      const lang = String(body.analyse.lang || "en").slice(0, 5).toLowerCase();
      try {
        return json(await callAnalyse(env, transcript, m, lang), 200, cors);
      } catch (e) {
        return json({ error: "analyse_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }

    // ---- Polish path ----
    if (rateLimited(ip, hits, RATE_PER_MIN, RATE_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
    const sentence = String(body.text || "").trim().slice(0, MAX_INPUT_CHARS);
    const avoid = Array.isArray(body.avoid) ? body.avoid.slice(0, 12).map(s => String(s).slice(0, 200)) : [];
    if (!sentence) return json({ error: "empty" }, 400, cors);

    try {
      const versions = await callAI(env, sentence, avoid);
      if (!versions.length) return json({ error: "no_versions" }, 502, cors);
      return json({ versions }, 200, cors);
    } catch (e) {
      return json({ error: "ai_unavailable", detail: String(e.message || e) }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
