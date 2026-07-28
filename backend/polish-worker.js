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

const ALLOWED_ORIGINS = [
  "https://app.lomonec.com",
  "http://localhost:8000",     // local testing (python3 -m http.server 8000)
  "http://127.0.0.1:8000",
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

async function callTTS(env, text, voice) {
  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_KEY}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice,
      input: text,
      instructions: TTS_INSTRUCTIONS,
      response_format: "mp3",
    }),
  });
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
    if (!cors["Access-Control-Allow-Origin"]) return new Response("Forbidden", { status: 403 });

    const ip = request.headers.get("CF-Connecting-IP") || "0";

    let body; try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400, cors); }

    // ---- TTS path: natural voice for the app's Hear/Slow buttons ----
    if (typeof body.tts === "string" && body.tts.trim()) {
      if (rateLimited(ip, ttsHits, TTS_PER_MIN, TTS_PER_DAY)) return json({ error: "rate_limited" }, 429, cors);
      const text = body.tts.trim().slice(0, MAX_TTS_CHARS);
      let voice = String(body.voice || "alloy").toLowerCase();
      if (!TTS_VOICES.includes(voice)) voice = "alloy";
      try {
        const r = await callTTS(env, text, voice);
        if (!r.ok) return json({ error: "tts_unavailable", detail: "provider " + r.status }, 502, cors);
        return new Response(r.body, {
          status: 200,
          headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=86400", ...cors },
        });
      } catch (e) {
        return json({ error: "tts_unavailable", detail: String(e.message || e) }, 502, cors);
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
