/* Curriculum clips: the LISTEN step points at a passage that really speaks the week's phrase,
   lands the learner on it, keeps it apart from the personal clip cap, and measures mastery from
   real graded attempts. Run: cd tests && node curriculum-clips.mjs */
import { chromium } from "playwright";
import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 300)}`); };
setTimeout(() => { console.log("WATCHDOG"); process.exit(2); }, 300000).unref?.();
const root = new URL("..", import.meta.url).pathname;
const PORT = process.env.PORT || 8994; let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900); BASE = "http://127.0.0.1:" + PORT; }
const b = await chromium.launch();

console.log("\n# 1. the index itself");
{
  const ix = JSON.parse(readFileSync(root + "tracks/general/clip-index.json", "utf8"));
  ok("1 · schemaVersion is the string the provider demands", ix.schemaVersion === "1", JSON.stringify(ix.schemaVersion));
  const all = Object.values(ix.weeks).flat();
  ok("2 · every entry names a video, and a PHRASE entry names its phrase and paragraph", all.length > 0 && all.every(e => e.vid) &&
    all.filter(e => e.match === "phrase").every(e => e.phrase && e.para >= 1 && e.of >= e.para), all.length);
  ok("3 · every entry carries the segment range mastery is counted over", all.every(e => Number.isInteger(e.from) && Number.isInteger(e.to) && e.to >= e.from));
  ok("3b · every passage is long enough to shadow as one piece", all.every(e => e.seconds >= 25), JSON.stringify(all.filter(e => e.seconds < 25).map(e => e.seconds)));
  /* the boundary: a General English learner must never be sent into the Welding library */
  const weld = JSON.parse(readFileSync(root + "catalogue/welding.json", "utf8")).videos || {};
  ok("4 · no entry is a Welding video", all.every(e => !weld[e.vid]), all.filter(e => weld[e.vid]).map(e => e.vid).join(","));
  const ge = JSON.parse(readFileSync(root + "catalogue/general.json", "utf8")).videos || {};
  const starters = new Set(JSON.parse(readFileSync(root + "tracks/general/shadow.json", "utf8")).starters.map(s => s.vid));
  ok("5 · every entry is in the General English library", all.every(e => ge[e.vid] || starters.has(e.vid)));
  /* the honesty rule: the passage must really contain the phrase */
  const win = {}; new Function("window", readFileSync(root + "shadow-sync.js", "utf8"))(win);
  const bad = all.filter(e => !win.ShadowSync.findExpression(e.text, [e.phrase]));
  const says = (await import("node:fs")).readFileSync && (() => { const w = {}; new Function("window", readFileSync(root + "shadow-sync.js", "utf8"))(w); new Function("window", readFileSync(root + "daily-learning-plan.js", "utf8"))(w); return w.DailyPlan.makeSays(w.ShadowSync.findExpression); })();
  const phraseEntries = all.filter(e => e.match === "phrase");
  const bad2 = phraseEntries.filter(e => !says(e.text, e.phrase));
  ok("6 · every PHRASE passage really says its phrase (the rule the learner is credited on)", bad2.length === 0, bad2.slice(0, 2).map(e => e.phrase).join(" | "));
  /* the owner's requirement: no week is left with nothing */
  const weeks = Object.keys(ix.weeks).map(Number).sort((a, b) => a - b);
  ok("6b · every one of the 12 weeks has at least one passage", weeks.length === 12 && weeks.every(w => ix.weeks[w].length >= 1), JSON.stringify(weeks));
  ok("6c · each passage says HOW it matched, so the lesson never implies more than it found", all.every(e => e.match === "phrase" || e.match === "topic"));
  /* a topic passage must not claim to teach a phrase */
  ok("6d · a topic passage carries no phrase claim", all.filter(e => e.match === "topic").every(e => !e.phrase && (!e.teaches || !e.teaches.length)));
  /* and no single phrase may fill a week */
  const over = weeks.filter(w => { const c = {}; ix.weeks[w].forEach(e => (e.teaches || []).forEach(t => c[t] = (c[t] || 0) + 1)); return Object.values(c).some(n => n > 2); });
  ok("6e · no single phrase fills a week (at most two passages teach the same one)", over.length === 0, "weeks: " + over.join(","));
}

console.log("\n# 2. the lesson step");
const state = { profile: { name: "Mariana", role: "Engineering / Data", goal: "Get promoted", slot: "", selfLevel: "Can get by", lang: "en", ts: 1 },
  professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 1, done: {} } },
  areaSplit: true, days: {}, dates: [], dayLog: {}, steps: {}, vocab: {} };
async function openListen(extra = {}, flags = { onboarding_v2_enabled: true, daily_learning_plan_pilot_enabled: true }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([st, f]) => { window.BE_BUILD = { track: "general-english" };
    localStorage.setItem("be_flags", JSON.stringify(f)); localStorage.setItem("be12_v1", JSON.stringify(st)); }, [Object.assign({}, state, extra), flags]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html");
  /* wait for the curriculum pack itself, not a guessed delay: on a loaded machine 2.4 s was not
     always enough and rSession then read phrases off a null pack */
  await p.waitForFunction(() => { try { const c = curriculumOrEmpty(); return !!(c && c.weeks && c.weeks.length); } catch (e) { return false; } }, null, { timeout: 30000 });
  await sleep(400);
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(1400);
  for (let i = 0; i < 2; i++) { await p.evaluate(() => { const e = _dlpEntry; e.stepData[e.step] = e.stepData[e.step] || { done: true }; dlpAdvance(1, "Mon", e.step); }); await sleep(600); }
  return { ctx, p, errs };
}
{
  const { ctx, p, errs } = await openListen();
  ok("7 · the curriculum pack carries the clip index", (await p.evaluate(() => { const c = curriculumOrEmpty().clipIndex; return c ? Object.keys(c).length : 0; })) > 0);
  ok("8 · the step is LISTEN", (await p.evaluate(() => _dlpEntry.step)) === "listen");
  const rows = await p.evaluate(() => [...document.querySelectorAll(".dlp-pass")].map(r => r.innerText.replace(/\s+/g, " ")));
  ok("9 · it offers real passages, not a bare library link", rows.length >= 1, rows.length);
  ok("10 · each names the paragraph and the phrase it teaches", rows.every(r => /Passage \d+ of \d+/.test(r) && /teaches/.test(r)), rows[0]);
  /* the quote must be the passage, so the learner knows what they are about to shadow */
  /* the quote is folded behind "Read the passage", so read textContent — innerText is empty while hidden */
  ok("11 · each quotes the passage itself", await p.evaluate(() => { const q = [...document.querySelectorAll(".dlp-pass-q")]; return q.length > 0 && q.every(x => x.textContent.trim().length > 200); }), await p.evaluate(() => [...document.querySelectorAll(".dlp-pass-q")].map(x => x.textContent.trim().length).join(",")));
  /* the owner's complaint, as a test: a 5-second fragment is not something anyone can master */
  const lens = await p.evaluate(() => [...document.querySelectorAll(".dlp-pass")].map(r => { const m = /(\d+)\s*seconds/.exec(r.innerText); return m ? +m[1] : 0; }));
  ok("11b · each passage is long enough to shadow as one piece (>= 25 s)", lens.length > 0 && lens.every(n => n >= 25), JSON.stringify(lens));
  /* LISTEN is not done just because the step drew */
  const before = await p.evaluate(() => { const e = DailyPlan.load(S, DailyPlan.lessonId("general", 1, "Mon")); return (e && e.stepData.listen) || null; });
  ok("12 · LISTEN is not marked seen merely by rendering when a passage exists", !before || !before.seen, JSON.stringify(before));
  await p.evaluate(() => document.querySelectorAll(".dlp-pass-go .btn")[0].click()); await sleep(1600);
  const after = await p.evaluate(() => { const e = DailyPlan.load(S, DailyPlan.lessonId("general", 1, "Mon")); return e && e.stepData.listen; });
  ok("13 · opening the passage records WHICH passage was opened", !!(after && after.opened && after.opened.vid && after.opened.para), JSON.stringify(after));
  ok("14 · and it lands in the studio with a way back to the lesson", (await p.evaluate(() => location.hash)) === "#shadow" && (await p.evaluate(() => JSON.stringify(SESS_RETURN))) === JSON.stringify({ v: "shadow", w: 1, d: "Mon" }));
  ok("15 · no JavaScript errors from the lesson side", errs.filter(e => !/MIME|ERR_|CORS|cloudflare|seekTo|ytPlayer|YT /i.test(e)).length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n# 3. keeping a passage, and what it costs");
{
  const { ctx, p } = await openListen();
  await p.evaluate(() => document.querySelectorAll(".dlp-pass-go .btn")[1].click()); await sleep(800);
  const c = await p.evaluate(() => aList("clips")[0]);
  ok("16 · the kept clip is stamped with its lesson", !!(c && c.cur && c.cur.w === 1 && c.cur.d === "Mon" && c.cur.lessonId), JSON.stringify(c && c.cur));
  ok("17 · and with the paragraph and phrase it came from", !!(c && c.para && c.phrase && Number.isInteger(c.from)), JSON.stringify({ para: c && c.para, phrase: c && c.phrase }));
  ok("18 · a course passage does NOT spend the personal clip allowance", (await p.evaluate(() => shPersonalClips().length)) === 0);
  ok("19 · keeping it twice does not duplicate it", await p.evaluate(async () => { const n = aList("clips").length; const b = [...document.querySelectorAll(".dlp-pass-go .btn")][1]; if (b && !b.disabled) b.click(); return aList("clips").length === n; }));
  await ctx.close();
}

console.log("\n# 4. mastery is counted from real graded attempts");
{
  const { ctx, p } = await openListen();
  await p.evaluate(() => document.querySelectorAll(".dlp-pass-go .btn")[1].click()); await sleep(700);
  const m0 = await p.evaluate(() => dlpClipMastery(aList("clips")[0]));
  ok("20 · a fresh passage is not mastered and has no attempts", m0.attempts === 0 && m0.days === 0 && !m0.mastered, JSON.stringify(m0));
  const m1 = await p.evaluate(() => { const c = aList("clips")[0]; const day = n => new Date(Date.now() - n * 864e5).getTime();
    aList("chHist").unshift({ kind: "challenge", ts: day(0), vid: c.vid, seg: "s" + c.from, pass: true });
    aList("chHist").unshift({ kind: "challenge", ts: day(1), vid: c.vid, seg: "s" + c.from, pass: true });
    aList("chHist").unshift({ kind: "challenge", ts: day(1), vid: c.vid, seg: "s" + c.from, pass: true });   /* same day again */
    return dlpClipMastery(c); });
  ok("21 · three passes on two days is not mastery (days, not attempts)", m1.passes === 3 && m1.days === 2 && !m1.mastered, JSON.stringify(m1));
  const m2 = await p.evaluate(() => { const c = aList("clips")[0];
    aList("chHist").unshift({ kind: "challenge", ts: Date.now() - 2 * 864e5, vid: c.vid, seg: "s" + c.to, pass: true });
    return dlpClipMastery(c); });
  ok("22 · a third day makes it mastered", m2.days === 3 && m2.mastered, JSON.stringify(m2));
  const m3 = await p.evaluate(() => { const c = aList("clips")[0];
    aList("chHist").unshift({ kind: "challenge", ts: Date.now(), vid: c.vid, seg: "s" + (c.to + 50), pass: true });
    return dlpClipMastery(c); });
  ok("23 · an attempt on ANOTHER passage of the same video does not count", m3.days === 3, JSON.stringify(m3));
  const m4 = await p.evaluate(() => { const c = aList("clips")[0];
    aList("chHist").unshift({ kind: "challenge", ts: Date.now() - 9 * 864e5, vid: c.vid, seg: "s" + c.from, pass: false });
    return dlpClipMastery(c); });
  ok("24 · a failed attempt counts as practice, never as a pass", m4.attempts > m4.passes && m4.days === 3, JSON.stringify(m4));
  await ctx.close();
}

console.log("\n# 5. Welding is untouched");
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.BE_BUILD = { track: "welding" };
    localStorage.setItem("be_flags", JSON.stringify({ daily_learning_plan_pilot_enabled: true })); });
  const p = await ctx.newPage(); await p.goto(BASE + "/index.html"); await sleep(2200);
  /* two independent guards: the guided lesson never runs outside General English, and the passage
     lookup refuses outright — so Welding can never be handed a General English clip */
  ok("25 · the guided lesson does not run on Welding", (await p.evaluate(() => dlpOn(1, "Mon"))) === false);
  ok("26 · and the passage lookup returns nothing there", (await p.evaluate(() => dlpPassages(1, 2).length)) === 0);
  await ctx.close();
}

await b.close(); if (server) server.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
