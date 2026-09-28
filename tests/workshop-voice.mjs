/* The workshop colleague's voice (owner, 28 Sep 2026: "Daniel … stopped in the
   middle of the sentence … too many delays between sentences").
   - a streamed reply is voiced in few clips, not one clip per sentence;
   - a clip the phone pauses on its own is resumed, and the turn still comes back;
   - a voice request that never answers cannot leave "… is speaking" on screen;
   - tapping the microphone mid-reply stops the rest of the reply.
   The Worker is faked inside the page: the chat streams its sentences with
   delays, the voice returns a real short WAV (so "ended" is real).
   Run: cd tests && node workshop-voice.mjs  (or BASE=http://localhost:8011 …) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
const ROOT = new URL("..", import.meta.url).pathname;
let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", "8798"], { cwd: ROOT, stdio: "ignore" }); await sleep(800); BASE = "http://localhost:8798"; }
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"], serviceWorkers: "block" });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e.message)));
await ctx.addInitScript(() => {
  localStorage.setItem("be_events_api", "");
  if (!localStorage.getItem("be12_v1")) localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Salomon", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "welding" },
    fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() }));
  /* a real WAV of n seconds of near-silence */
  const wav = sec => { const sr = 8000, n = Math.round(sr * sec), b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(i / 7) * 60), true); return new Blob([b], { type: "audio/wav" }); };
  window.__tts = []; window.__ttsHang = null; window.__reply = null;
  const real = window.fetch.bind(window);
  window.fetch = async (url, opt) => {
    let body = null; try { body = JSON.parse(opt && opt.body || "null") } catch (e) {}
    if (body && typeof body.tts === "string") {
      window.__tts.push(body.tts);
      if (window.__ttsHang && window.__ttsHang.test(body.tts)) return new Promise(() => {});
      await new Promise(r => setTimeout(r, 600));
      return new Response(wav(0.25 + body.tts.split(/\s+/).length * 0.33), { status: 200, headers: { "content-type": "audio/wav" } });
    }
    if (body && body.chat) {
      const R = window.__reply || { who: "", sentences: ["Thanks."] }, enc = new TextEncoder();
      const stream = new ReadableStream({ async start(c) {
        for (const s of R.sentences) { await new Promise(r => setTimeout(r, 250)); c.enqueue(enc.encode(JSON.stringify({ s }) + "\n")); }
        c.enqueue(enc.encode(JSON.stringify({ done: true, reply: R.sentences.join(" "), covered: [], characterId: R.who }) + "\n")); c.close(); } });
      return new Response(stream, { status: 200 });
    }
    return real(url, opt);
  };
});
await page.goto(BASE + "/index.html?wv=" + Date.now()); await sleep(1200);
const setup = await page.evaluate(async () => {
  document.querySelectorAll(".cf-ov,.wc-ov,.lang-modal-ov,#rmNotice").forEach(e => e.remove());
  audioUnlock();
  const sc = trackSimulations().find(s => !isFirstDayMission(s) && (s.turns || []).length) || trackSimulations().find(s => !isFirstDayMission(s));
  simStart(sc.id);
  for (let i = 0; i < 150 && !/Your turn/.test(simRun.voiceStatus || ""); i++) await new Promise(r => setTimeout(r, 100));
  return { id: sc.id, status: simRun.voiceStatus, api: !!POLISH_API };
});
ok("The opening line is spoken and hands the turn to the learner", /Your turn/.test(setup.status) && setup.api, JSON.stringify(setup));

/* speak one learner turn and wait until the turn comes back (or a limit) */
const turn = (sentences, limitMs, during) => page.evaluate(async ([sentences, limitMs, during]) => {
  const next = (simRun.messages || []).slice(-1)[0] || {};
  window.__reply = { who: "", sentences }; window.__tts.length = 0; _ttsCache.clear();
  const t0 = Date.now();
  simProcessSpeech("My name is Salomon. I have been working as a welder for three years, some of it offshore on a vessel.");
  let paused = false, tapped = false;
  while (Date.now() - t0 < limitMs && !/Your turn|Listening/.test(simRun.voiceStatus || "")) {
    await new Promise(r => setTimeout(r, 50));
    const a = typeof _ttsPlayer !== "undefined" && _ttsPlayer;
    if (during === "pause" && !paused && a && !a.paused && a.currentTime > 0.1) { paused = true; a.pause(); }
    if (during === "mic" && !tapped && a && !a.paused && a.currentTime > 0.1) { tapped = true; await simVoiceToggle(); break; }
  }
  const a = _ttsPlayer;
  return { ms: Date.now() - t0, status: simRun.voiceStatus, tts: window.__tts.slice(), paused, tapped, playing: !!(a && !a.paused && a.src) };
}, [sentences, limitMs, during]);

const R1 = ["Daniel here.", "Offshore work sounds interesting.", "We run a lot of structural work here.", "What positions are you comfortable in?"];
const a = await turn(R1, 20000);
ok("A four-sentence streamed reply is voiced in at most two clips, not four", a.tts.length >= 1 && a.tts.length <= 2, JSON.stringify(a.tts));
ok("The short opener is joined to the next sentence (\"Daniel here. Offshore work…\")", /^Daniel here\. Offshore work/.test(a.tts[0] || ""), a.tts[0]);
ok("Every sentence is spoken", R1.every(s => a.tts.join(" ").includes(s)), JSON.stringify(a.tts));
ok("The turn comes back to the learner when the reply ends", /Your turn/.test(a.status), JSON.stringify(a));

const b = await turn(R1, 20000, "pause");
ok("A clip the phone pauses on its own is resumed and the turn still comes back", b.paused && /Your turn/.test(b.status), JSON.stringify(b));

await page.evaluate(() => { window.__ttsHang = /structural/; });
const c = await turn(R1, 30000);
await page.evaluate(() => { window.__ttsHang = null; });
ok("A voice request that never answers cannot leave '… is speaking' on screen", /Your turn/.test(c.status) && c.ms < 25000, JSON.stringify(c));

const d = await turn(R1, 20000, "mic");
await sleep(1500);
const after = await page.evaluate(() => ({ status: simRun.voiceStatus, playing: !!(_ttsPlayer && !_ttsPlayer.paused && _ttsPlayer.getAttribute("src")) }));
ok("Tapping the microphone mid-reply stops the rest of the reply", d.tapped && !after.playing && !/is speaking/.test(after.status), JSON.stringify({ d, after }));
await page.evaluate(() => { try { simStopListening(); } catch (e) {} });

ok("No page errors", errors.length === 0, errors.join(" | "));
await browser.close(); if (server) server.kill();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
