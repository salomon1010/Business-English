# Executive Polish + Natural Voice backend (Cloudflare Worker)

A tiny serverless endpoint that holds ONE AI key so app users need only an
internet connection — no key of their own. It does three jobs on the same URL:
- **Polish** — several professional rewrites of a sentence (`{text, avoid}` → JSON).
- **Voice (TTS)** — a natural spoken reading of any label (`{tts, voice}` → MP3),
  used by every "Hear / Slow" button. The app plays this when online and falls
  back to the device's built-in browser voice when offline or on any error.
- **Word timings (Whisper)** — POST a recording as raw audio (`content-type:
  audio/webm`) and get back `{words:[{w,start,end}], text}`. This powers the
  precise **"You"** playback: it plays back exactly the one word you mispronounced
  from your own recording, instead of a guessed chunk. Offline, the app falls back
  to its on-device energy-based estimate.
- **Pronunciation coach (gpt-4o-audio)** — POST `{assess:"<target phrase>",
  audio:"<base64 wav>", format:"wav"}` and get `{overall, words:[{word,score,note}]}`.
  An audio model actually *listens* and grades how each word was pronounced — unlike
  ASR, which only guesses the intended word and so forgives bad pronunciation.
  Needs the **gpt-4o-audio-preview** model enabled on the OpenAI account.

> **Redeploy note:** if you already have this Worker running for Polish, just
> re-paste the updated `polish-worker.js` (Worker → Edit code → Save and deploy).
> The same `OPENAI_KEY` secret powers the voice — nothing else to add.

It is built with hard caps so the bill cannot run away (CORS locked to the app
origin, input/output token limits, per-IP rate limits). The **real** guarantee
is the provider budget cap in step 5 — set it and you can never be surprised.

---

## One-time setup (~15 minutes)

### 1. Get an AI key
- Create an account at **platform.openai.com** → API keys → create a key
  (starts with `sk-...`). Keep it secret.

### 2. Create the Worker
- Go to **dash.cloudflare.com** → **Workers & Pages** → **Create** → **Worker**.
- Give it a name, e.g. `be-polish`. Deploy the default, then **Edit code**.
- Paste the entire contents of `polish-worker.js` over the default code. **Save
  and deploy.**

### 3. Add the secret key
- Worker → **Settings** → **Variables and Secrets** → **Add** → type **Secret**.
- Name: `OPENAI_KEY` — Value: your `sk-...` key. Save and deploy again.

### 4. Note your Worker URL
- It looks like `https://be-polish.<your-subdomain>.workers.dev`.
- Put this URL into the app: in `index.html`, set
  `const POLISH_API = "https://be-polish.<your-subdomain>.workers.dev";`
  (a placeholder is already there near the Executive Polish code). Commit + push.

### 5. Set the hard budget cap (do NOT skip — this is the real safety net)
- **platform.openai.com → Settings → Limits (Billing) → set a monthly budget
  cap**, e.g. £5 or £10. If usage ever hits it, the provider simply stops
  serving requests — the app falls back to its offline clean-up. You can never
  be charged above the cap.

---

## Costs (approximate — check current provider pricing)
- Model `gpt-4o-mini`: roughly **£0.0001–0.0002 per Polish click**
  (~5,000–10,000 clicks per £1).
- Voice `gpt-4o-mini-tts`: billed per character of text spoken — a few pennies
  per thousand short "Hear" taps. The app **caches** each clip, so replaying the
  same word/sentence costs nothing, and clips are capped at 600 characters.
- Word timings `whisper-1`: ~£0.005 per minute of audio. The app transcribes each
  recording **once** and caches the result, and clips are capped at 12 MB.
- Cloudflare Workers free tier covers ~100,000 requests/day — **£0** at your scale.
- So: near-zero at launch; a few pounds a month only once you have real traffic.
- The **monthly budget cap** (step 5) covers Polish *and* voice together — one cap,
  never exceeded.

## Adjusting the caps
Edit the constants at the top of `polish-worker.js`:
`MAX_INPUT_CHARS`, `MAX_OUTPUT_TOKENS`, `RATE_PER_MIN`, `RATE_PER_DAY`,
`MAX_TTS_CHARS`, `TTS_PER_MIN`, `TTS_PER_DAY`, `TTS_VOICES` (allowed voices),
and `ALLOWED_ORIGINS` (add any new domains the app is served from).

## Using Anthropic (Claude Haiku) instead of OpenAI
In `callAI()`, swap the fetch to `https://api.anthropic.com/v1/messages` with
headers `x-api-key: env.ANTHROPIC_KEY` and `anthropic-version: 2023-06-01`,
body `{model:"claude-haiku-4-5-20251001", max_tokens:320, system, messages:[{role:"user",content:user}]}`,
and read the reply from `j.content[0].text`. Then store the secret as
`ANTHROPIC_KEY` instead of `OPENAI_KEY`. (Haiku is a bit pricier than 4o-mini.)
