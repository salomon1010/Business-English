/* Shadow Studio — hearing your own take, and being in your own language
   (owner, 4 Oct 2026: "when the user records himself in the challenge, he has
   to listen to his voice directly after he finishes the recording. The same
   thing in the shadow. And the language selected has to be the same here —
   for example in French, the explanation should be in French").
   Run: cd tests && node shadow-playback.mjs        (PORT=nnnn for a free port)

   Real: index.html's recorders, svTakePlayback, the Challenge panel and the
   dictionary loader, in Chromium with a fake microphone.
   Played: the Polish Worker (transcription / grade) and, for the language
   checks, a failing then recovering i18n request. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8812), BASE = process.env.BASE || `http://127.0.0.1:${PORT}`;
const own = !process.env.BASE;
const srv = own ? spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }) : null;
if (own) await sleep(900);
{ const disk = readFileSync(root + "index.html", "utf8"); let served = "";
  try { served = await (await fetch(BASE + "/index.html")).text(); } catch (e) {}
  if (!served || served.length !== disk.length) { console.error(`\n${BASE} is not serving this tree. Run with PORT=<a free port>.\n`); if (srv) srv.kill(); process.exit(1); } }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 450)}`); };
const POLISH = "https://be-polish.nore-ngou.workers.dev";
const VID = "MZAjfsyJa1U";
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });

async function learner({ lang = "en", i18nFails = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  await ctx.addInitScript(([lang]) => {
    localStorage.setItem("be_flags", JSON.stringify({ shadow_studio_v2_enabled: true, shadow_challenge_enabled: true, shadow_apply_phrase_enabled: true }));
    localStorage.setItem("be_sv_txopen", "1"); localStorage.setItem("be_sv_watchopen", "1");
    localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Test", lang, goal: "x", ts: 1 }, professionalTracks: { activeId: "general-english" },
      fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} }, welding: { placed: "full", finished: true, day: 15, done: {} } },
      days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }));
    sessionStorage.setItem("be_view", "#shadow");
  }, [lang]);
  /* the dictionary: refuse the first N requests, so the retry and the
     re-localisation can be observed rather than assumed */
  let i18nHits = 0;
  await ctx.route(/\/i18n\/[a-z]{2}\.json/, async r => {
    i18nHits++;
    if (i18nHits <= i18nFails) return r.abort("failed");
    return r.continue();
  });
  await ctx.route(u => u.href.startsWith(POLISH), r => {
    let b = {}; try { b = JSON.parse(r.request().postData() || "{}"); } catch (e) {}
    if (b.captions) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ error: "no_captions" }) });
    if (b.assess) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "whisper", words: [] }) });
    const heard = "streets of New York on Sunday";
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: heard, words: heard.split(" ").map((w, i) => ({ w, start: i * .3, end: i * .3 + .25 })) }) });
  });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(BASE + "/index.html#shadow", { waitUntil: "load" }); await sleep(2200);
  await page.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()));
  return { ctx, page, errs, hits: () => i18nHits };
}
const openClip = async page => { await page.evaluate(v => shLoad({ vid: v, start: 0, end: 0, title: "probe" }), VID); await sleep(2300); };
/* what the studio's one audio element is doing */
const audio = page => page.evaluate(() => ({
  src: (typeof fbAud !== "undefined" && fbAud && fbAud.src || "").slice(0, 5),
  has: !!(typeof fbAud !== "undefined" && fbAud),
  toast: (document.getElementById("toast") || {}).textContent || "",
  paused: (() => { try { return ytPlayer && ytPlayer.getPlayerState ? ytPlayer.getPlayerState() !== 1 : null; } catch (e) { return null; } })(),
}));
/* record for ~1.2 s through the real MediaRecorder, then stop */
async function take(page, start, stop) {
  await page.evaluate(start); await sleep(1300);
  await page.evaluate(stop); await sleep(1800);
}

console.log("\n# Challenge: the take plays back the moment it stops");
{
  const { page, ctx, errs } = await learner();
  await openClip(page);
  await page.evaluate(() => { svPick = 5; svSetMode("challenge"); svCh.rung = "recall"; svCh.phase = "ready"; svRender(); }); await sleep(400);
  const before = await audio(page);
  await take(page, () => svChRecord(), () => { if (rec && rec.mr && rec.mr.state === "recording") rec.mr.stop(); });
  const after = await audio(page);
  ok("1 · before the take nothing is playing", !before.has || before.src !== "blob:", JSON.stringify(before));
  ok("2 · the recording is played back through the studio's audio element, from the take itself (a blob)", after.src === "blob:", JSON.stringify(after));
  ok("3 · the learner is told what they are hearing, in words", /Listen to what you just said/i.test(after.toast), after.toast);
  ok("4 · the video is not left playing over it", after.paused !== false, JSON.stringify({ paused: after.paused }));
  ok("5 · the take is still graded — playback does not replace the feedback", ["grading", "feedback", "error"].includes(await page.evaluate(() => svCh && svCh.phase)), await page.evaluate(() => svCh && svCh.phase));
  ok("6 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# Shadow: the same, through the studio's own recorder");
{
  const { page, ctx, errs } = await learner();
  await openClip(page);
  await page.evaluate(() => { svPick = 5; svSetMode("shadow"); }); await sleep(400);
  await take(page, () => shRec(), () => { if (rec && rec.mr && rec.mr.state === "recording") recToggle(); });
  const after = await audio(page);
  ok("7 · a Shadow take plays back at once too", after.src === "blob:", JSON.stringify(after));
  ok("8 · and says so", /Listen to what you just said/i.test(after.toast), after.toast);
  /* a second Shadow tap must not talk over the playback */
  await page.evaluate(() => shRec()); await sleep(500);
  ok("9 · starting the next take stops the playback instead of speaking over it", await page.evaluate(() => !fbAud || fbAud.paused), await page.evaluate(() => !!fbAud && !fbAud.paused));
  await page.evaluate(() => { try { if (rec && rec.mr && rec.mr.state === "recording") recToggle(); } catch (e) {} }); await sleep(900);
  ok("10 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# a take that is NOT in the studio stays silent");
{
  const { page, ctx } = await learner();
  /* the daily session uses the same recorder; it must not start talking */
  await page.evaluate(() => { go("session", currentPos().w, currentPos().d); }); await sleep(900);
  const quiet = await page.evaluate(() => ({ work: typeof shWorkOpen === "function" ? shWorkOpen() : null, would: svTakePlayback(new Blob(["x".repeat(4000)], { type: "audio/webm" })) }));
  ok("11 · with the workspace closed the playback refuses — a session or mission take is unaffected", quiet.work === false && quiet.would === false, JSON.stringify(quiet));
  await ctx.close();
}

console.log("\n# the learner's language reaches this screen");
{
  const { page, ctx } = await learner({ lang: "fr" });
  await openClip(page);
  await page.evaluate(() => { svPick = 5; svSetMode("challenge"); svCh.rung = "recall"; svCh.phase = "ready"; svRender(); }); await sleep(400);
  const txt = await page.evaluate(() => (document.getElementById("shV2") || {}).innerText || "");
  ok("12 · a French learner's Challenge panel is French, including the hint and the paragraph note", /De mémoire/.test(txt) && /Utilisez les flèches/.test(txt) && !/From memory|Use the arrows/.test(txt), txt.slice(0, 200));
  await take(page, () => svChRecord(), () => { if (rec && rec.mr && rec.mr.state === "recording") rec.mr.stop(); });
  ok("13 · and the playback notice is French too", /Écoutez ce que vous venez de dire/.test((await audio(page)).toast), (await audio(page)).toast);
  await ctx.close();
}
{
  /* the dictionary request fails once: the app must not be left in English */
  const { page, ctx, hits } = await learner({ lang: "fr", i18nFails: 1 });
  const first = await page.evaluate(() => ({ code: _dictCode, keys: Object.keys(DICT).length, missing: dictMissing() }));
  await sleep(1600);
  const retried = await page.evaluate(() => ({ code: _dictCode, keys: Object.keys(DICT).length, missing: dictMissing() }));
  ok("14 · a dropped dictionary request is retried rather than leaving the session in English", retried.code === "fr" && retried.keys > 3000 && retried.missing === false, JSON.stringify({ first, retried, hits: hits() }));
  await openClip(page);
  await page.evaluate(() => { svPick = 5; svSetMode("challenge"); svCh.rung = "recall"; svCh.phase = "ready"; svRender(); }); await sleep(400);
  ok("15 · so the Challenge panel still comes up French", /De mémoire/.test(await page.evaluate(() => (document.getElementById("shV2") || {}).innerText || "")));
  await ctx.close();
}
{
  /* the workspace is open when the dictionary lands: it must redraw IN PLACE,
     because re-rendering the view would close it */
  const { page, ctx } = await learner({ lang: "fr" });
  await openClip(page);
  await page.evaluate(() => { svPick = 5; svSetMode("challenge"); svCh.rung = "recall"; svCh.phase = "ready"; svRender(); }); await sleep(300);
  const r = await page.evaluate(async () => {
    /* pretend the pack arrived only now, with the workspace open */
    const keep = DICT; DICT = {}; _dictCode = "en";
    svRender(); const english = (document.getElementById("shV2") || {}).innerText || "";
    DICT = keep; _dictCode = "fr";
    relocalizeNow(); await new Promise(z => setTimeout(z, 400));
    return { english, after: (document.getElementById("shV2") || {}).innerText || "", stillOpen: shWorkOpen(), view: cur.v };
  });
  ok("16 · a dictionary arriving while the workspace is open re-draws the panel in the learner's language", /From memory/.test(r.english) && /De mémoire/.test(r.after), JSON.stringify({ en: r.english.slice(0, 80), fr: r.after.slice(0, 80) }));
  ok("17 · and the workspace is NOT closed in the process — the learner stays on their clip", r.stillOpen === true && r.view === "shadow", JSON.stringify({ open: r.stillOpen, view: r.view }));
  await ctx.close();
}

await browser.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
