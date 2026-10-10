var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// entitlements/src/firebase-auth.js
var JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
var jwksCache = { at: 0, keys: null };
async function fetchJwks(fetcher, force) {
  if (!force && jwksCache.keys && Date.now() - jwksCache.at < 36e5) return jwksCache.keys;
  const r = await fetcher(JWKS_URL);
  if (!r.ok) throw new Error("jwks " + r.status);
  const j = await r.json();
  jwksCache = { at: Date.now(), keys: j.keys || [] };
  return jwksCache.keys;
}
__name(fetchJwks, "fetchJwks");
var b64u = /* @__PURE__ */ __name((s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}, "b64u");
async function verifyIdToken(token, projectId, deps = {}) {
  const fetcher = deps.fetch || fetch, nowMs = deps.now || Date.now();
  if (!projectId) throw new Error("project");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("malformed");
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64u(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64u(parts[1])));
  } catch (e) {
    throw new Error("malformed");
  }
  if (header.alg !== "RS256" || !header.kid) throw new Error("alg");
  let keys = deps.keys || await fetchJwks(fetcher);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk && !deps.keys && nowMs - jwksCache.at > 6e4) {
    keys = await fetchJwks(fetcher, true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error("kid");
  if (jwk.kty !== "RSA" || jwk.alg && jwk.alg !== "RS256") throw new Error("alg");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, b64u(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("signature");
  const sec = Math.floor(nowMs / 1e3);
  if (payload.aud !== projectId) throw new Error("aud");
  if (payload.iss !== "https://securetoken.google.com/" + projectId) throw new Error("iss");
  if (!(payload.exp > sec)) throw new Error("expired");
  if (!(payload.iat <= sec + 300)) throw new Error("iat");
  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) throw new Error("sub");
  return payload.sub;
}
__name(verifyIdToken, "verifyIdToken");

// polish-worker.js
var ALLOWED_ORIGINS = [
  "https://app.lomonec.com",
  "https://staging.lomonec.com",
  "capacitor://localhost",
  "https://localhost",
  // the App Store build (mobile/ios): WKWebView cannot use https for a local bundle
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  // python3 -m http.server 8000
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  // vite preview
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  // vite dev
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
var MAX_INPUT_CHARS = 400;
var MAX_OUTPUT_TOKENS = 320;
var RATE_PER_MIN = 15;
var RATE_PER_DAY = 300;
var TTS_MODEL = "gpt-4o-mini-tts";
var TTS_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];
var MAX_TTS_CHARS = 600;
var TTS_PER_MIN = 60;
var TTS_PER_DAY = 2e3;
var STT_MODEL = "whisper-1";
var MAX_STT_BYTES = 12 * 1024 * 1024;
var STT_PER_MIN = 20;
var STT_PER_DAY = 600;
var sttHits = /* @__PURE__ */ new Map();
var CAP_PER_MIN = 12;
var CAP_PER_DAY = 400;
var capHits = /* @__PURE__ */ new Map();
var YTAI_MAX_SEC = 1800;
var YTAI_PER_MIN = 2;
var YTAI_PER_DAY = 25;
var ytaiHits = /* @__PURE__ */ new Map();
var YTAI_WIN_MAX = 300;
var YTAI_WIN_PER_MIN = 12;
var YTAI_WIN_PER_DAY = 150;
var ytaiWinHits = /* @__PURE__ */ new Map();
var YTAI_CACHE_S = 30 * 86400;
function ytaiCacheKey(vid, win) {
  return new Request("https://ytai.cache.be-polish.invalid/v1/" + vid + "/" + (win ? win.from + "-" + win.to : "all"));
}
__name(ytaiCacheKey, "ytaiCacheKey");
function ytaiWindow(body) {
  if (body.to == null) return null;
  const from = Math.max(0, Math.floor(Number(body.from) || 0)), to = Math.floor(Number(body.to) || 0);
  if (!(to > from) || from >= YTAI_MAX_SEC) return false;
  return { from, to: Math.min(to, from + YTAI_WIN_MAX, YTAI_MAX_SEC) };
}
__name(ytaiWindow, "ytaiWindow");
var ASSESS_MODELS = [
  "gpt-4o-audio-preview",
  "gpt-4o-audio-preview-2025-06-03",
  "gpt-4o-audio-preview-2024-12-17",
  "gpt-4o-mini-audio-preview"
];
var MAX_ASSESS_B64 = 6 * 1024 * 1024;
var ASSESS_PER_MIN = 15;
var ASSESS_PER_DAY = 400;
var assessHits = /* @__PURE__ */ new Map();
var hits = /* @__PURE__ */ new Map();
var ttsHits = /* @__PURE__ */ new Map();
function corsHeaders(origin) {
  const lan = /^http:\/\/(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(origin);
  const allow = ALLOWED_ORIGINS.includes(origin) || lan ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    /* `authorization` carries the Firebase ID token the ytai gate needs. The
       client adds it to every POLISH_API call once the learner is signed in (the
       one signing wrapper in index.html), which turns the request into a
       PREFLIGHTED one — so if this does not name the header, the browser refuses
       the call before this Worker ever runs, and every AI feature dies with
       whatever generic "needs a connection" message that caller shows. curl
       never sees it: curl sends no preflight. Measured on production
       2026-10-01: allow-headers was `content-type` only, which is why the web
       bundle must NOT ship before this Worker. */
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Vary": "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
async function ytaiAccount(req, env, cors) {
  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer \S+$/.test(auth)) return { res: json({ error: "auth_required" }, 401, cors) };
  if (!env.FIREBASE_PROJECT_ID) return { res: json({ error: "auth_unavailable" }, 503, cors) };
  try {
    await verifyIdToken(auth.slice(7), env.FIREBASE_PROJECT_ID);
  } catch (e) {
    const m = String(e && e.message || e);
    if (/^jwks/.test(m) || m === "project") return { res: json({ error: "auth_unavailable" }, 503, cors) };
    return { res: json({ error: "auth_required" }, 401, cors) };
  }
  return { ok: true };
}
__name(ytaiAccount, "ytaiAccount");
function rateLimited(ip, map, perMin, perDay) {
  const now = Date.now();
  const rec = map.get(ip) || { min: [], day: [] };
  rec.min = rec.min.filter((t) => now - t < 6e4);
  rec.day = rec.day.filter((t) => now - t < 864e5);
  if (rec.min.length >= perMin || rec.day.length >= perDay) {
    map.set(ip, rec);
    return true;
  }
  rec.min.push(now);
  rec.day.push(now);
  map.set(ip, rec);
  if (map.size > 5e3) map.clear();
  return false;
}
__name(rateLimited, "rateLimited");
var TTS_INSTRUCTIONS = "Speak in warm, natural, confident spoken American English \u2014 the voice of a supportive executive-communication coach. Use relaxed, human intonation and rhythm, clear articulation, and a friendly, encouraging tone. Never flat, monotone, or robotic; sound like a real person speaking to a colleague.";
var MAX_TTS_STYLE = 180;
function ttsInstructions(style) {
  const s = String(style || "").replace(/[\r\n]+/g, " ").trim().slice(0, MAX_TTS_STYLE);
  return s ? `${TTS_INSTRUCTIONS} For this line, speak in character: ${s}` : TTS_INSTRUCTIONS;
}
__name(ttsInstructions, "ttsInstructions");
async function callTTS(env, text, voice, style) {
  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_KEY}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice,
      input: text,
      instructions: ttsInstructions(style),
      response_format: "mp3"
    })
  });
}
__name(callTTS, "callTTS");
var FILLER_PROMPT = "Um, uh, er, hmm, you know, I mean, like, so... Okay, um, let me think.";
async function callTranscribe(env, bytes, mime, keepFillers) {
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("language", "en");
  if (keepFillers) form.append("prompt", FILLER_PROMPT);
  const ext = mime.includes("mp4") || mime.includes("m4a") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : "webm";
  form.append("file", new File([bytes], "clip." + ext, { type: mime || "audio/webm" }));
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_KEY}` },
    // fetch sets the multipart boundary itself
    body: form
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const words = Array.isArray(j.words) ? j.words.map((x) => ({ w: String(x.word || "").trim(), start: +x.start, end: +x.end })).filter((x) => x.w && isFinite(x.start) && isFinite(x.end)) : [];
  return { words, text: String(j.text || "") };
}
__name(callTranscribe, "callTranscribe");
async function callAssess(env, target, audioB64, fmt) {
  const system = 'You are a strict but fair English pronunciation coach. You will HEAR a learner attempt to say a target phrase. Judge ONLY pronunciation \u2014 the actual sounds, stress and clarity you hear \u2014 NOT grammar or word choice. Be honest: if a word is mispronounced, unclear, missing or mumbled, score it low even if you can guess what was intended. Give each target word a score from 0 (wrong/unintelligible) to 100 (native-clear). Respond with ONLY minified JSON, no code fences: {"overall":<0-100>,"words":[{"word":"<target word>","score":<0-100>,"note":"<max 6-word tip, or empty if good>"}]} with one item per target word, in order.';
  const payload = /* @__PURE__ */ __name((model) => JSON.stringify({
    model,
    modalities: ["text"],
    max_tokens: 600,
    messages: [
      { role: "system", content: system },
      { role: "user", content: [
        { type: "text", text: `Target phrase: "${target}". Score how clearly I pronounced each word.` },
        { type: "input_audio", input_audio: { data: audioB64, format: fmt } }
      ] }
    ]
  }), "payload");
  let j = null;
  for (const model of ASSESS_MODELS) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_KEY}` },
      body: payload(model)
    });
    if (r.status === 404) continue;
    if (!r.ok) throw new Error("provider " + r.status);
    j = await r.json();
    break;
  }
  if (!j) return null;
  let raw = j.choices?.[0]?.message?.content || "{}";
  raw = raw.replace(/^```[a-z]*\s*|\s*```$/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const words = Array.isArray(parsed.words) ? parsed.words.map((w) => ({
    word: String(w.word || "").trim(),
    score: Math.max(0, Math.min(100, Math.round(+w.score))) || 0,
    note: String(w.note || "").trim().slice(0, 60)
  })).filter((w) => w.word).slice(0, 60) : [];
  const overall = Math.max(0, Math.min(100, Math.round(+parsed.overall))) || 0;
  return { overall, words, mode: "ai" };
}
__name(callAssess, "callAssess");
function b64ToBytes(b64) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
__name(b64ToBytes, "b64ToBytes");
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => {
    const r = new Array(n + 1).fill(0);
    r[0] = i;
    return r;
  });
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
__name(lev, "lev");
async function whisperAssess(env, bytes, mime, target) {
  const { words: wl } = await callTranscribe(env, bytes, mime);
  const heard = wl.map((x) => x.w.toLowerCase().replace(/[^a-z0-9']/g, "")).filter(Boolean);
  const tgt = target.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
  let hi = 0, sum = 0;
  const words = [];
  for (const w of tgt) {
    let score = 18, note = "not heard clearly";
    for (let k = hi; k < Math.min(heard.length, hi + 3); k++) {
      if (heard[k] === w) {
        score = 95;
        note = "";
        hi = k + 1;
        break;
      }
    }
    if (score < 95) for (let k = hi; k < Math.min(heard.length, hi + 3); k++) {
      const sim = 1 - lev(heard[k], w) / Math.max(heard[k].length, w.length, 1);
      if (sim >= 0.6) {
        score = 55;
        note = "unclear \u2014 practise this sound";
        hi = k + 1;
        break;
      }
    }
    words.push({ word: w, score, note });
    sum += score;
  }
  return { overall: Math.round(sum / Math.max(1, tgt.length)), words, mode: "whisper" };
}
__name(whisperAssess, "whisperAssess");
async function callAI(env, sentence, avoid) {
  const system = `You are an elite executive communication coach. Rewrite the user's sentence into 3 DIFFERENT professional, spoken business-English versions. Each version must use different vocabulary and, where natural, a business idiom or executive phrase. Keep each concise and natural to say out loud, and preserve the original meaning. Do not reuse any sentence in the 'avoid' list. Respond with ONLY minified JSON, no code fences: {"versions":[{"text":"<rewrite>","learn":"<the idiom or key phrase used, a few words>"}]} with exactly 3 items.`;
  const user = `Sentence: "${sentence}"
Avoid (do not repeat): ${avoid.length ? avoid.join(" | ") : "none"}`;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 1,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }]
    })
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const raw = j.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  let versions = Array.isArray(parsed.versions) ? parsed.versions : [];
  versions = versions.map((v) => ({ text: String(v.text || "").trim(), learn: String(v.learn || "").trim() })).filter((v) => v.text.length > 3).slice(0, 3);
  return versions;
}
__name(callAI, "callAI");
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
var GEMINI_MODEL = "gemini-3.6-flash";
var YTAI_PROMPT = 'Transcribe the spoken English in this video. For every sentence give the MM:SS timestamp at which it begins. Return ONLY minified JSON: {"cues":[{"ts":"MM:SS","txt":"<sentence>"}]}. Cover the whole video from 00:00 to the end. No commentary.';
var YTAI_PROMPT_WIN = 'Transcribe the spoken English in this video clip. For every sentence give the MM:SS timestamp at which it begins, measured from the START OF THE VIDEO (not from the start of the clip). Return ONLY minified JSON: {"cues":[{"ts":"MM:SS","txt":"<sentence>"}]}. Cover the clip from its first word to its last. No commentary.';
async function geminiCaptions(env, vid, win) {
  const key = String(env.GEMINI_KEY || "").trim();
  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [
          {
            fileData: { fileUri: "https://www.youtube.com/watch?v=" + vid },
            /* the hard cost brake: Gemini reads at most YTAI_MAX_SEC of the
               video, so a three-hour upload costs the same as a half-hour one */
            videoMetadata: { startOffset: (win ? win.from : 0) + "s", endOffset: (win ? win.to : YTAI_MAX_SEC) + "s" }
          },
          { text: win ? YTAI_PROMPT_WIN : YTAI_PROMPT }
        ] }],
        /* low media resolution: we are after the words, not the picture, and it
           is roughly a third of the tokens */
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          maxOutputTokens: 6e4,
          mediaResolution: "MEDIA_RESOLUTION_LOW"
        }
      })
    }
  );
  if (!r.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await r.json()).slice(0, 200);
    } catch {
    }
    let fp = "";
    try {
      const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
      fp = [...new Uint8Array(h)].slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
    }
    return { error: "gemini_" + r.status, detail, keyLen: key.length, keyFp: fp };
  }
  const j = await r.json();
  const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let parsed;
  try {
    parsed = JSON.parse(txt);
  } catch {
    return { error: "gemini_parse" };
  }
  const toSec = /* @__PURE__ */ __name((ts) => {
    const m = String(ts || "").match(/(\d+):(\d{1,2})(?::(\d{1,2}))?/);
    if (!m) return null;
    return m[3] ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2];
  }, "toSec");
  const cues = [];
  for (const c of parsed.cues || []) {
    const t = toSec(c.ts), s = String(c.txt || "").replace(/\s+/g, " ").trim();
    if (t == null || !s) continue;
    if (cues.length && t < cues[cues.length - 1].t) continue;
    cues.push({ t, txt: s });
  }
  if (!cues.length) return { error: "gemini_empty" };
  if (win) {
    const len = win.to - win.from;
    if (win.from > 0 && cues[0].t < win.from - 5 && cues[cues.length - 1].t <= len + 15) cues.forEach((c) => {
      c.t += win.from;
    });
    const kept = cues.filter((c) => c.t >= win.from - 5 && c.t < win.to + 5);
    if (!kept.length) return { error: "gemini_empty" };
    return { vid, source: "gemini", lang: "en", cues: kept, maxSec: YTAI_MAX_SEC, win: [win.from, win.to] };
  }
  const out = { vid, source: "gemini", lang: "en", cues, maxSec: YTAI_MAX_SEC };
  if (cues[cues.length - 1].t >= YTAI_MAX_SEC - 90) out.truncated = true;
  return out;
}
__name(geminiCaptions, "geminiCaptions");
async function fetchYouTubeCaptions(vid) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) return { error: "bad_id" };
  const page = await fetch("https://www.youtube.com/watch?v=" + vid + "&hl=en", {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" }
  });
  if (!page.ok) return { error: "page_" + page.status };
  const html = await page.text();
  const m = html.match(/"captionTracks":(\[.*?\])/);
  if (!m) return { error: "no_captions" };
  let tracks;
  try {
    tracks = JSON.parse(m[1]);
  } catch {
    return { error: "parse_failed" };
  }
  if (!tracks.length) return { error: "no_captions" };
  const pick = tracks.find((t) => (t.languageCode || "").startsWith("en") && t.kind !== "asr") || tracks.find((t) => (t.languageCode || "").startsWith("en")) || tracks[0];
  if (!pick || !pick.baseUrl) return { error: "no_track" };
  const tt = await fetch(pick.baseUrl + "&fmt=json3", { headers: { "user-agent": UA } });
  if (!tt.ok) return { error: "track_" + tt.status };
  let data;
  try {
    data = await tt.json();
  } catch {
    return { error: "track_parse" };
  }
  const cues = [], words = [];
  for (const ev of data.events || []) {
    if (!ev.segs) continue;
    const start = (ev.tStartMs || 0) / 1e3;
    let txt = "";
    for (const s of ev.segs) {
      const piece = (s.utf8 || "").replace(/\n/g, " ");
      if (!piece.trim()) {
        txt += piece;
        continue;
      }
      words.push({ t: +(start + (s.tOffsetMs || 0) / 1e3).toFixed(3), w: piece.trim() });
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
    words
  };
}
__name(fetchYouTubeCaptions, "fetchYouTubeCaptions");
var CHAT_PER_MIN = 20;
var CHAT_PER_DAY = 500;
var chatHits = /* @__PURE__ */ new Map();
var CHAT_MODEL = "gpt-4o-mini";
var MAX_CHAT_TURNS = 40;
var AN_MODEL = "gpt-4.1-mini";
var AN_PER_MIN = 6;
var AN_PER_DAY = 150;
var anHits = /* @__PURE__ */ new Map();
var MAX_AN_CHARS = 4e3;
var AN_FIELDS = {
  // field -> max chars
  key_message: 240,
  clarity: 8,
  sharper: 280,
  structure_note: 260,
  answer_directly: 260,
  example: 280,
  evidence: 260,
  credibility: 260,
  remember_title: 90,
  remember_body: 320,
  next_recording: 320,
  quick_win_title: 90,
  quick_win_goal: 220,
  concept_title: 70,
  concept_body: 240,
  level: 4,
  level_note: 240,
  coach_script: 900
};
var AN_LEVELS = ["A2", "B1", "B1+", "B2", "B2+", "C1"];
var AN_LANGS = { en: "English", es: "Spanish", fr: "French", pt: "Portuguese", it: "Italian", de: "German", ru: "Russian", ar: "Arabic", ur: "Urdu", hi: "Hindi", bn: "Bengali", id: "Indonesian", vi: "Vietnamese", zh: "Chinese", ja: "Japanese", ko: "Korean" };
function anStr(v, max) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
__name(anStr, "anStr");
function anCtx(raw) {
  if (!raw || typeof raw !== "object") return null;
  const track = raw.track === "welding" ? "welding" : raw.track === "general" ? "general" : "";
  const week = Number.isInteger(+raw.week) && +raw.week >= 1 && +raw.week <= 52 ? +raw.week : 0;
  const out = {
    track,
    week,
    day: anStr(raw.day, 3),
    focus: anStr(raw.focus, 160),
    task: anStr(raw.task, 300),
    out: anStr(raw.out, 200),
    phrases: (Array.isArray(raw.phrases) ? raw.phrases : []).map((x) => anStr(x, 80)).filter(Boolean).slice(0, 6)
  };
  return out.track || out.task || out.focus || out.phrases.length ? out : null;
}
__name(anCtx, "anCtx");
function anTrade(ctx) {
  return !!(ctx && ctx.track === "welding");
}
__name(anTrade, "anTrade");
function anCoachLine(ctx) {
  return anTrade(ctx) ? "You are a workplace English coach for welders and skilled tradespeople who use English as a second language. The register is the workshop, the site and the site office \u2014 plain, practical, safety-minded \u2014 never the boardroom: every idiom, phrase and word upgrade must be one a foreman, an inspector or a client on site would actually say, and polish means a supervisor's clarity, not corporate jargon. " : "You are an executive speaking coach for professionals who use English as a second language. ";
}
__name(anCoachLine, "anCoachLine");
function anTaskBlock(ctx) {
  if (!ctx) return "";
  const parts = [];
  parts.push("THE TASK. This minute is a daily exercise on a " + (anTrade(ctx) ? "welding workplace English" : "business English") + " programme" + (ctx.week ? ", week " + ctx.week : "") + (ctx.focus ? " (focus: " + ctx.focus + ")" : "") + ".");
  if (ctx.task) parts.push("The task was: " + ctx.task);
  if (ctx.out) parts.push("The expected outcome: " + ctx.out);
  if (ctx.phrases.length) parts.push("They were asked to use these phrases: " + ctx.phrases.map((x) => '"' + x + '"').join(", ") + ".");
  parts.push("Judge the minute AGAINST THIS TASK: evidence says whether they did what the task asked and which of the assigned phrases they used, quoting them; answer_directly is the first change that would make the minute meet the task; next_recording is the same task again, done better \u2014 never a different topic; example, sharper, the versions and the idioms must all fit this task and this workplace; coach_script names the task and says plainly whether it was met.");
  return parts.join(" ") + " ";
}
__name(anTaskBlock, "anTaskBlock");
async function callAnalyse(env, transcript, metrics, lang, ctx) {
  const language = AN_LANGS[lang] || "English";
  const trade = anTrade(ctx);
  const system = anCoachLine(ctx) + `The learner spoke for about a minute (transcript below, fillers kept). Measured numbers are given; do not re-measure. Judge what a listener judges: the key message, the structure, what makes the speaker credible, and the one change that matters most. Then teach: correct the real mistakes with the rule behind each, rebuild their own sentences on patterns they can reuse, and upgrade their words. Be concrete and specific: every item must quote the learner's own words. Never invent a sentence they did not say, and never invent facts. Two languages are in play and mixing them up ruins the report; the rule is at the end of this prompt and it is not optional. Respond with ONLY minified JSON, no code fences, exactly these keys: {"key_message":"<the one thing they were saying, one sentence, English, in their words>","clarity":"clear"|"fuzzy","sharper":"<the key message said better: one plain sentence, max 22 words>","level":"A2"|"B1"|"B1+"|"B2"|"B2+"|"C1","level_note":"<one sentence: the single thing holding them at this level, from this transcript>","structure":["<part 1>","<part 2>",...],"structure_note":"<one sentence: what the order did for the listener>","answer_directly":"<one sentence: the first change to make to the opening>","example":"<one English sentence they could open with>","evidence":"<one sentence on the proof they gave or did not give>","credibility":"<one sentence on hedges and certainty, quoting them>","hedges":[{"said":"<phrase they used>","better":"<the same idea stated plainly>"}],"corrections":[{"said":"<the exact words they got wrong, copied from the transcript>","fix":"<the same words, correct>","why":"<one short line: the rule, so they can apply it again>","kind":"tense"|"article"|"plural"|"preposition"|"word form"|"word choice"|"agreement"|"word order"}],"sentences":[{"said":"<one whole sentence of theirs, copied>","rebuilt":"<the same idea, same facts, on a stronger structure, spoken English>","pattern":"<the reusable frame with square-bracket slots, e.g. Because [problem], we [action] so that [result]>","pattern_use":"<one line: the situation this frame is for>"}],"words":[{"said":"<the plain or vague word they used, copied>","better":"<the precise professional word or phrase>","meaning":"<one line, plain>","example":"<their own sentence rewritten with it, English>"}],"collocations":[{"said":"<the awkward word pairing they used, copied>","better":"<what a native speaker pairs those words with>","why":"<one short line>"}],"remember_title":"<3-8 words>","remember_body":"<two sentences>","next_recording":"<the exact task for the next 60-second recording>","quick_win_title":"<3-8 words>","quick_win_goal":"<one measurable goal>","concept_title":"<a speaking principle they just used or need, 2-5 words>","concept_body":"<one sentence tying it to their speech>","coach_script":"<what the coach SAYS to them, 75-95 words of plain spoken English (B1), second person, in this order: how they came across, the one mistake and its rule, the one sentence to copy, and the task for the next recording. Sentences only, no lists, no markdown, no headings.>","versions":[{"style":"<2-4 words naming the register, e.g. Clear and direct / Executive polish>","text":"<the WHOLE speech said again in that register>","learn":["<each professional phrase or business idiom this version introduced, exact words as they appear in text>"]}],"idioms":[{"idiom":"<a professional idiom or executive phrase the learner did NOT use>","meaning":"<plain meaning, one line>","when":"<the situation it fits, one line>","example":"<one sentence using it about the learner's own topic>"}]} structure has 3 to 5 items of at most 6 words each; hedges has 0 to 3 items. corrections: only real mistakes actually present in the transcript, at most 5, most damaging first, never the same rule twice; said must appear in the transcript word for word; if the English is already correct, return an empty array rather than inventing one. Ignore missing punctuation and capitalisation \u2014 this was speech. sentences: EXACTLY 3 (or one per sentence they said, if they said fewer). said must be copied from the transcript. Three DIFFERENT patterns. A pattern is a content-free frame: every noun, number, month, job title and topic word of theirs becomes a [slot], and only the connective skeleton survives, so the frame still works tomorrow on a completely different subject. 2 or 3 slots, never more. "so I suggest we [action] next month" is wrong \u2014 the month is content; "I am asking for [what] by [when]" is right. words: 4 to 6 upgrades of words they actually used; said must appear in the transcript. An upgrade is a MORE PRECISE word, not a bigger one: never a plural or tense fix (that is a correction), never the same word with an adjective bolted on, never a bookish synonym nobody says out loud, and never a word already handled in corrections. If you cannot find 4 honest upgrades, return fewer. collocations: 0 to 3, only genuinely unnatural pairings they used (e.g. 'do a training' -> 'run a training session'); an empty array is the right answer when everything sounded natural. versions has EXACTLY 2 items: two different ways the learner could have said the same thing \u2014 every fact, name and number kept, first person, spoken register, 60-110% of the original length, no filler, no hedging; version 1 plain and direct (B1), version 2 ` + (trade ? "the way a confident supervisor says it on site (B2), still plain" : "polished executive English (B2-C1)") + ". Each version must weave in 2 or 3 " + (trade ? "phrases tradespeople and supervisors really use" : "professional phrases or business idioms") + " naturally and list them in learn, and versions and their learn items are always in English. idioms has EXACTLY 4 items: NEW " + (trade ? "workplace idioms or phrases heard on site and in the workshop" : "professional idioms or executive phrases") + " (not ones the learner used, and different from those in versions) that fit the learner's topic and next conversation. " + anTaskBlock(ctx) + /* Measured on the live Worker, 22 Sep 2026: with the language rule stated once,
     mid-prompt, as a list of exceptions, a French learner got a report written
     entirely in English. Most of this app's learners are francophone. So the rule
     is last, it names both sets of fields, and it says what each set is FOR. */
  "LANGUAGE \u2014 the report is bilingual and this is the most important instruction here. ENGLISH (what the learner will SAY OUT LOUD, so it must be plain spoken English): key_message, sharper, example, coach_script, every versions[].text and versions[].learn, every idioms[].idiom and idioms[].example, every hedges[].better, every corrections[].said and corrections[].fix, every sentences[].said, sentences[].rebuilt and sentences[].pattern, every words[].said, words[].better and words[].example, every collocations[].said and collocations[].better. " + (lang === "en" ? "Everything else is in English too. " : "EVERY OTHER FIELD (what the learner READS to understand \u2014 level_note, structure, structure_note, answer_directly, evidence, credibility, remember_title, remember_body, next_recording, quick_win_title, quick_win_goal, concept_title, concept_body, every corrections[].why and corrections[].kind, every sentences[].pattern_use, every words[].meaning, every collocations[].why, every idioms[].meaning and idioms[].when, and every versions[].style) MUST be written in " + language + ". Not English. A learner who reads " + language + " is reading these to understand the English ones. ");
  const user = "Transcript:\n" + transcript + "\n\nMeasured:\n" + JSON.stringify(metrics) + (ctx ? "\n\nContext:\n" + JSON.stringify(ctx) : "");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: AN_MODEL,
      max_tokens: 4200,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }]
    })
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const raw = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "{}").trim();
  let p;
  try {
    p = JSON.parse(raw);
  } catch {
    p = {};
  }
  const out = {};
  for (const [k, max] of Object.entries(AN_FIELDS)) out[k] = anStr(p[k], max);
  out.clarity = out.clarity === "fuzzy" ? "fuzzy" : "clear";
  out.level = AN_LEVELS.includes(out.level) ? out.level : "";
  out.structure = (Array.isArray(p.structure) ? p.structure : []).map((x) => anStr(x, 60)).filter(Boolean).slice(0, 5);
  out.hedges = (Array.isArray(p.hedges) ? p.hedges : []).map((h) => h && typeof h === "object" ? { said: anStr(h.said, 60), better: anStr(h.better, 160) } : null).filter((h) => h && h.said && h.better).slice(0, 3);
  out.versions = (Array.isArray(p.versions) ? p.versions : []).map((v) => v && typeof v === "object" ? { style: anStr(v.style, 40), text: anStr(v.text, 1600), learn: (Array.isArray(v.learn) ? v.learn : []).map((x) => anStr(x, 60)).filter(Boolean).slice(0, 4) } : null).filter((v) => v && v.text.split(" ").length >= 8).slice(0, 2);
  out.idioms = (Array.isArray(p.idioms) ? p.idioms : []).map((x) => x && typeof x === "object" ? { idiom: anStr(x.idiom, 60), meaning: anStr(x.meaning, 160), when: anStr(x.when, 160), example: anStr(x.example, 220) } : null).filter((x) => x && x.idiom && x.meaning).slice(0, 4);
  const said = " " + transcript.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ") + " ";
  const quoted = /* @__PURE__ */ __name((v) => {
    const q = String(v || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
    return q.length > 1 && said.includes(" " + q + " ");
  }, "quoted");
  const seen = /* @__PURE__ */ new Set();
  out.corrections = (Array.isArray(p.corrections) ? p.corrections : []).map((c) => c && typeof c === "object" ? { said: anStr(c.said, 90), fix: anStr(c.fix, 120), why: anStr(c.why, 160), kind: anStr(c.kind, 20).toLowerCase() } : null).filter((c) => c && c.said && c.fix && c.why && quoted(c.said) && c.said.toLowerCase() !== c.fix.toLowerCase()).filter((c) => {
    const k = c.said.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 5);
  out.sentences = (Array.isArray(p.sentences) ? p.sentences : []).map((x) => x && typeof x === "object" ? { said: anStr(x.said, 300), rebuilt: anStr(x.rebuilt, 320), pattern: anStr(x.pattern, 160), pattern_use: anStr(x.pattern_use, 180) } : null).filter((x) => x && x.said && x.rebuilt && x.pattern && quoted(x.said)).slice(0, 3);
  const corrected = new Set(out.corrections.flatMap((c) => [c.said.toLowerCase(), c.fix.toLowerCase()]));
  const bare = /* @__PURE__ */ __name((x) => x.toLowerCase().replace(/[^a-z ]+/g, "").replace(/\s+/g, " ").trim(), "bare");
  out.words = (Array.isArray(p.words) ? p.words : []).map((w) => w && typeof w === "object" ? { said: anStr(w.said, 60), better: anStr(w.better, 80), meaning: anStr(w.meaning, 160), example: anStr(w.example, 220) } : null).filter((w) => w && w.said && w.better && quoted(w.said) && w.said.toLowerCase() !== w.better.toLowerCase()).filter((w) => !corrected.has(w.said.toLowerCase()) && !corrected.has(w.better.toLowerCase())).filter((w) => {
    const a = bare(w.said), b = bare(w.better);
    if (a.replace(/s$/, "") === b.replace(/s$/, "")) return false;
    return !(b.endsWith(" " + a) || b.startsWith(a + " "));
  }).slice(0, 6);
  out.collocations = (Array.isArray(p.collocations) ? p.collocations : []).map((c) => c && typeof c === "object" ? { said: anStr(c.said, 80), better: anStr(c.better, 100), why: anStr(c.why, 160) } : null).filter((c) => c && c.said && c.better && quoted(c.said) && c.said.toLowerCase() !== c.better.toLowerCase()).slice(0, 3);
  return out;
}
__name(callAnalyse, "callAnalyse");
var RP_PER_MIN = 8;
var RP_PER_DAY = 200;
var rpHits = /* @__PURE__ */ new Map();
async function callRepolish(env, transcript, avoid, lang, n, ctx) {
  const language = AN_LANGS[lang] || "English";
  const trade = anTrade(ctx);
  const system = anCoachLine(ctx) + "The learner spoke for about a minute; the transcript is below. " + (ctx && ctx.task ? "It was their answer to this task: " + ctx.task + " \u2014 the new version must still answer it. " : "") + "Write ONE more way they could have said the WHOLE thing \u2014 every fact, name and number kept, first person, spoken register, 60-110% of the original length, no filler and no hedging. It must be clearly different from the versions already shown (listed below): a different register and different phrasing, not a reshuffle. Carry " + (n >= 3 ? "four" : "three") + (trade ? " phrases tradespeople and supervisors really use on site" : " professional phrases or business idioms") + " inside it, woven in naturally, and list them in learn exactly as they appear in text. Then give 2 MORE " + (trade ? "workplace idioms heard on site" : "professional idioms") + ` the learner has not been shown, chosen for their topic, for them to memorise. Respond with ONLY minified JSON: {"version":{"style":"<2-4 words naming the register>","text":"<the whole speech, said that way>","learn":["<each phrase or idiom it introduced>"]},"idioms":[{"idiom":"<an idiom they have not been shown>","meaning":"<plain meaning, one line>","when":"<the situation it fits, one line>","example":"<one sentence using it about the learner's own topic>"}]} LANGUAGE: version.text, version.learn, every idiom and every example are lines the learner will SAY, so they are in plain spoken English. ` + (lang === "en" ? "So is everything else. " : "version.style, and every meaning and when, are what the learner READS to understand, so they MUST be written in " + language + " \u2014 not English.");
  const user = "Transcript:\n" + transcript + "\n\nAlready shown, do not repeat:\n" + (avoid.join("\n---\n") || "(nothing yet)");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: AN_MODEL,
      max_tokens: 1200,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }]
    })
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  let p;
  try {
    p = JSON.parse((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "{}").trim());
  } catch {
    p = {};
  }
  const v = p.version && typeof p.version === "object" ? p.version : {};
  const out = { version: null, idioms: [] };
  const text = anStr(v.text, 1600);
  if (text.split(" ").length >= 8) out.version = { style: anStr(v.style, 40), text, learn: (Array.isArray(v.learn) ? v.learn : []).map((x) => anStr(x, 60)).filter(Boolean).slice(0, 5) };
  out.idioms = (Array.isArray(p.idioms) ? p.idioms : []).map((x) => x && typeof x === "object" ? { idiom: anStr(x.idiom, 60), meaning: anStr(x.meaning, 160), when: anStr(x.when, 160), example: anStr(x.example, 220) } : null).filter((x) => x && x.idiom && x.meaning).slice(0, 2);
  return out;
}
__name(callRepolish, "callRepolish");
async function callChat(env, system, messages) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 400,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages]
    })
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  const raw = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "").trim();
  return shapeChat(raw);
}
__name(callChat, "callChat");
function shapeChat(raw) {
  let p;
  try {
    p = JSON.parse(raw);
  } catch {
    p = { reply: raw, covered: [] };
  }
  if (!p.reply || typeof p.reply !== "string") p.reply = "Sorry, could you say that again?";
  if (!Array.isArray(p.covered)) p.covered = [];
  p.covered = p.covered.filter((v) => typeof v === "number" ? Number.isFinite(v) : typeof v === "string" ? v.length > 0 && v.length <= 64 : false).slice(0, 32);
  const out = { reply: p.reply.slice(0, 800), covered: p.covered };
  if (typeof p.characterId === "string" && p.characterId.length <= 64) out.characterId = p.characterId;
  return out;
}
__name(shapeChat, "shapeChat");
function shapeMvReport(raw) {
  let p;
  try {
    p = JSON.parse(raw);
  } catch {
    p = {};
  }
  const str = /* @__PURE__ */ __name((v, n) => typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, n) : "", "str");
  const anchored = /* @__PURE__ */ __name((v, cap) => (Array.isArray(v) ? v : []).map((x) => x && typeof x === "object" ? { move: str(x.move, 64), note: str(x.note, 200) } : null).filter((x) => x && x.move && x.note).slice(0, cap), "anchored");
  return {
    covered: (Array.isArray(p.covered) ? p.covered : []).filter((v) => typeof v === "string" && v.length > 0 && v.length <= 64).slice(0, 16),
    well: anchored(p.well, 3),
    improve: anchored(p.improve, 2),
    better: str(p.better, 800),
    expressions: (Array.isArray(p.expressions) ? p.expressions : []).map((x) => x && typeof x === "object" ? { e: str(x.e, 80), why: str(x.why, 160) } : null).filter((x) => x && x.e).slice(0, 3),
    one: str(p.one, 200),
    /* language polish (23 Sep 2026): you-said → better → why, at most two.
       Transport shape only — the client drops any entry whose "said" is not
       found in the learner's own transcript, so the model cannot put words
       in the learner's mouth. */
    polish: (Array.isArray(p.polish) ? p.polish : []).map((x) => x && typeof x === "object" ? { said: str(x.said, 200), better: str(x.better, 260), why: str(x.why, 200) } : null).filter((x) => x && x.said && x.better).slice(0, 2)
  };
}
__name(shapeMvReport, "shapeMvReport");
async function callMvReport(env, system, said) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 700,
      temperature: 0.4,
      // a report, not a character — steadier is better
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: said }]
    })
  });
  if (!r.ok) throw new Error("provider " + r.status);
  const j = await r.json();
  return shapeMvReport((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "").trim());
}
__name(callMvReport, "callMvReport");
function replyWalker(emit) {
  let head = "", inReply = false, done = false, esc = false, uni = null, reply = "", sentAt = 0, named = false;
  const flush = /* @__PURE__ */ __name((final) => {
    const pending = reply.slice(sentAt);
    const parts = final ? [pending] : pending.match(/[^.!?…]+[.!?…]+["')\]]*\s+/g) || [];
    for (const part of parts) {
      const t = part.trim();
      if (t) emit({ s: t });
      sentAt += part.length;
    }
  }, "flush");
  const feedChar = /* @__PURE__ */ __name((ch) => {
    if (done) return;
    if (esc) {
      if (uni !== null) {
        uni += ch;
        if (uni.length === 4) {
          reply += String.fromCharCode(parseInt(uni, 16) || 63);
          uni = null;
          esc = false;
        }
        return;
      }
      if (ch === "u") {
        uni = "";
        return;
      }
      reply += ch === "n" || ch === "t" || ch === "r" ? " " : ch;
      esc = false;
      return;
    }
    if (ch === "\\") {
      esc = true;
      uni = null;
      return;
    }
    if (ch === '"') {
      done = true;
      flush(true);
      return;
    }
    reply += ch;
    if (/\s/.test(ch)) flush(false);
  }, "feedChar");
  return {
    feed(delta) {
      for (const ch of delta) {
        if (inReply) {
          feedChar(ch);
          continue;
        }
        head += ch;
        if (!named) {
          const c = /"characterId"\s*:\s*"([^"\\]{1,64})"/.exec(head);
          if (c) {
            named = true;
            emit({ c: c[1] });
          }
        }
        const m = /"reply"\s*:\s*"$/.test(head);
        if (m) {
          inReply = true;
          head = "";
        }
      }
    },
    end() {
      if (inReply && !done) {
        done = true;
        flush(true);
      }
    },
    text() {
      return reply;
    }
  };
}
__name(replyWalker, "replyWalker");
async function streamChat(env, system, messages, cors) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_KEY },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 400,
      temperature: 0.8,
      stream: true,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages]
    })
  });
  if (!r.ok || !r.body) throw new Error("provider " + r.status);
  const enc = new TextEncoder(), dec = new TextDecoder();
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  const line = /* @__PURE__ */ __name((obj) => w.write(enc.encode(JSON.stringify(obj) + "\n")), "line");
  (async () => {
    let raw = "", sse = "";
    const walker = replyWalker((obj) => line(obj));
    try {
      const reader = r.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sse += dec.decode(value, { stream: true });
        let nl;
        while ((nl = sse.indexOf("\n")) >= 0) {
          const l = sse.slice(0, nl).trim();
          sse = sse.slice(nl + 1);
          if (!l.startsWith("data:")) continue;
          const d = l.slice(5).trim();
          if (d === "[DONE]") continue;
          let delta = "";
          try {
            delta = JSON.parse(d).choices[0].delta.content || "";
          } catch {
            continue;
          }
          raw += delta;
          walker.feed(delta);
        }
      }
      walker.end();
      await line({ done: true, ...shapeChat(raw.trim()) });
    } catch (e) {
      try {
        await line({ error: String(e.message || e) });
      } catch {
      }
    }
    try {
      await w.close();
    } catch {
    }
  })();
  return new Response(readable, { status: 200, headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", ...cors } });
}
__name(streamChat, "streamChat");
var polish_worker_default = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
    if (!cors["Access-Control-Allow-Origin"]) return new Response("Forbidden", { status: 403 });
    const ip = request.headers.get("CF-Connecting-IP") || "0";
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
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad_request" }, 400, cors);
    }
    if (body.chat && typeof body.chat === "object") {
      if (rateLimited(ip, chatHits, CHAT_PER_MIN, CHAT_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      const system = String(body.chat.system || "").slice(0, 4e3);
      let messages = Array.isArray(body.chat.messages) ? body.chat.messages : [];
      messages = messages.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-MAX_CHAT_TURNS).map((m) => ({ role: m.role, content: m.content.slice(0, 2e3) }));
      if (!system || !messages.length) return json({ error: "bad_request" }, 400, cors);
      try {
        if (body.chat.stream === true) return await streamChat(env, system, messages, cors);
        return json(await callChat(env, system, messages), 200, cors);
      } catch (e) {
        return json({ error: "chat_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }
    if (body.mvreport && typeof body.mvreport === "object") {
      if (rateLimited(ip, chatHits, CHAT_PER_MIN, CHAT_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      const system = String(body.mvreport.system || "").slice(0, 6e3);
      const said = String(body.mvreport.said || "").replace(/\s+/g, " ").trim().slice(0, 2400);
      if (!system || said.split(" ").length < 5) return json({ error: "bad_request" }, 400, cors);
      try {
        return json(await callMvReport(env, system, said), 200, cors);
      } catch (e) {
        return json({ error: "report_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }
    if (typeof body.captions === "string" && body.captions.trim()) {
      if (rateLimited(ip, capHits, CAP_PER_MIN, CAP_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      try {
        const out = await fetchYouTubeCaptions(body.captions.trim());
        const headers = out.error ? cors : { "cache-control": "public, max-age=604800", ...cors };
        return json(out, out.error ? 404 : 200, headers);
      } catch (e) {
        return json({ error: "captions_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }
    if (typeof body.ytai === "string" && /^[A-Za-z0-9_-]{11}$/.test(body.ytai.trim())) {
      {
        const a = await ytaiAccount(request, env, cors);
        if (a.res) return a.res;
      }
      if (!env.GEMINI_KEY) return json({ error: "no_key" }, 501, cors);
      const vid = body.ytai.trim(), win = ytaiWindow(body);
      if (win === false) return json({ error: "bad_window" }, 400, cors);
      const cache = typeof caches !== "undefined" ? caches.default : null, key = ytaiCacheKey(vid, win);
      try {
        const hit = cache && await cache.match(key);
        if (hit) return json({ ...await hit.json(), cached: true }, 200, cors);
      } catch {
      }
      if (win ? rateLimited(ip, ytaiWinHits, YTAI_WIN_PER_MIN, YTAI_WIN_PER_DAY) : rateLimited(ip, ytaiHits, YTAI_PER_MIN, YTAI_PER_DAY))
        return json({ error: "rate_limited" }, 429, cors);
      try {
        const out = await geminiCaptions(env, vid, win);
        if (!out.error && cache) {
          try {
            await cache.put(key, new Response(JSON.stringify(out), { headers: { "content-type": "application/json", "cache-control": "public, max-age=" + YTAI_CACHE_S } }));
          } catch {
          }
        }
        return json(out, out.error ? 502 : 200, cors);
      } catch (e) {
        return json({ error: "ytai_failed", detail: String(e.message || e) }, 502, cors);
      }
    }
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
          headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=86400", ...cors }
        });
      } catch (e) {
        return json({ error: "tts_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }
    if (typeof body.assess === "string" && body.assess.trim() && typeof body.audio === "string" && body.audio) {
      if (rateLimited(ip, assessHits, ASSESS_PER_MIN, ASSESS_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      if (body.audio.length > MAX_ASSESS_B64) return json({ error: "too_large" }, 413, cors);
      const target = body.assess.trim().slice(0, MAX_INPUT_CHARS);
      const fmt = body.format === "mp3" ? "mp3" : "wav";
      try {
        let out = await callAssess(env, target, body.audio, fmt);
        if (!out) out = await whisperAssess(env, b64ToBytes(body.audio), "audio/" + fmt, target);
        return json(out, 200, cors);
      } catch (e) {
        return json({ error: "assess_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }
    if (body.analyse && typeof body.analyse === "object") {
      if (rateLimited(ip, anHits, AN_PER_MIN, AN_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      const transcript = String(body.analyse.transcript || "").replace(/\s+/g, " ").trim().slice(0, MAX_AN_CHARS);
      if (transcript.split(" ").length < 5) return json({ error: "empty" }, 400, cors);
      const metrics = body.analyse.metrics && typeof body.analyse.metrics === "object" ? body.analyse.metrics : {};
      const m = {};
      for (const k of ["seconds", "words", "wpm", "hesitations", "fillers", "hedges", "wordsPerSentence", "sentences", "vocabularyPct", "pitchSemitones"]) {
        if (Number.isFinite(+metrics[k])) m[k] = Math.round(+metrics[k] * 10) / 10;
      }
      const lang = String(body.analyse.lang || "en").slice(0, 5).toLowerCase();
      const ctx = anCtx(body.analyse.context);
      try {
        return json(await callAnalyse(env, transcript, m, lang, ctx), 200, cors);
      } catch (e) {
        return json({ error: "analyse_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }
    if (body.repolish && typeof body.repolish === "object") {
      if (rateLimited(ip, rpHits, RP_PER_MIN, RP_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      const transcript = String(body.repolish.transcript || "").replace(/\s+/g, " ").trim().slice(0, MAX_AN_CHARS);
      if (transcript.split(" ").length < 5) return json({ error: "empty" }, 400, cors);
      const avoid2 = (Array.isArray(body.repolish.avoid) ? body.repolish.avoid : []).map((x) => String(x || "").replace(/\s+/g, " ").trim().slice(0, 1600)).filter(Boolean).slice(-4);
      const lang = String(body.repolish.lang || "en").slice(0, 5).toLowerCase();
      const ctx = anCtx(body.repolish.context);
      try {
        return json(await callRepolish(env, transcript, avoid2, lang, avoid2.length + 1, ctx), 200, cors);
      } catch (e) {
        return json({ error: "repolish_unavailable", detail: String(e.message || e) }, 502, cors);
      }
    }
    if (rateLimited(ip, hits, RATE_PER_MIN, RATE_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
    const sentence = String(body.text || "").trim().slice(0, MAX_INPUT_CHARS);
    const avoid = Array.isArray(body.avoid) ? body.avoid.slice(0, 12).map((s) => String(s).slice(0, 200)) : [];
    if (!sentence) return json({ error: "empty" }, 400, cors);
    try {
      const versions = await callAI(env, sentence, avoid);
      if (!versions.length) return json({ error: "no_versions" }, 502, cors);
      return json({ versions }, 200, cors);
    } catch (e) {
      return json({ error: "ai_unavailable", detail: String(e.message || e) }, 502, cors);
    }
  }
};
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors }
  });
}
__name(json, "json");
export {
  polish_worker_default as default,
  corsHeaders,
  replyWalker,
  shapeMvReport
};

