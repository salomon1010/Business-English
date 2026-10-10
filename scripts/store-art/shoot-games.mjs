/* lomonec.com/bemastery — the six "Play to learn" screenshots (10 Oct 2026).
 *
 *   python3 -m http.server 8765        (from the repo root)
 *   node scripts/store-art/shoot-games.mjs
 *
 * Output: site/bemastery/img/games/{em-home,em-games,em-speak,wm-home,wm-games,wm-visual}.webp,
 * 660x1434 like the site's other phone shots (330x717 CSS px at 2x), via cwebp.
 *
 * The screens are the app's own, drawn from index.html with the flags on. The
 * game server (be-polish) is answered by a stand-in with the real contract, so
 * the shots need no account; the learner is the neutral demo "Alex" with a few
 * days of practice graded through the engine itself (nothing is drawn by hand).
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(path.join(here, "../../tests/package.json"));
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:8765";
const OUT = path.join(here, "../../site/bemastery/img/games");
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
async function page(track) {
  const ctx = await b.newContext({ viewport: { width: 330, height: 717 }, deviceScaleFactor: 2, serviceWorkers: "block", permissions: ["microphone"] });
  const st = { profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: track, tradeId: "welder" }, fnd: { [track]: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 };
  await ctx.addInitScript(s => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", JSON.stringify({ english_mastery_enabled: true, welding_mastery_enabled: true, welding_studio_enabled: true, home_v2_enabled: true })); }, JSON.stringify(st));
  const view = { day: new Date().toISOString().slice(0, 10), plan: "free", energy: { used: 1, limit: 5, resetAt: Date.now() + 3600_000 }, xp: { total: 340, today: 46, dayCap: 600 }, daily: { done: false } };
  await ctx.route(u => /be-polish/.test(u.href), r => { let body = {}; try { body = JSON.parse(r.request().postData() || "{}"); } catch (e) {} const w = body.wm || {};
    return r.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify(w.op === "start" ? { ok: true, ticket: "t:" + w.sid, ...view } : view) }); });
  await ctx.route(u => /be-events|be-partner|cloudflareinsights|gstatic\.com\/firebasejs|entitlements/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { Object.defineProperty(window, "speechSynthesis", { value: { speak() {}, cancel() {}, getVoices: () => [] }, configurable: true }); } catch (e) {} });
  await p.goto(BASE + "/index.html"); await sleep(1800);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#coachSummary").forEach(e => e.remove()));
  await p.evaluate(() => { FBUser = { uid: "demo", getIdToken: async () => "demo" }; });
  return { ctx, p };
}
/* a few days of real practice, graded by the engine (so streak, week dots and mastery are its own figures) */
async function practise(p, ui, eng) {
  await p.evaluate(async ([ui, eng]) => {
    const U = window[ui], E = window[eng]; await U._load(); const s = U._state(), T = U._corpus().terms, now = Date.now(), D = 864e5;
    for (let d = 4; d >= 0; d--) for (let i = 0; i < 14; i++) { const t = T[(i * 7 + d * 3) % T.length]; E.grade(s, t.id, i % 5 ? 2 : 1, { mode: ["cards", "quiz", "listen", "match"][i % 4], now: now - d * D - i * 60000 }); }
    save(); U._refresh && await U._refresh();
  }, [ui, eng]);
}
async function shot(p, name) { await p.evaluate(() => { document.querySelectorAll(".wm-cel").forEach(e => e.remove()); if (document.activeElement) document.activeElement.blur(); }); const png = path.join(OUT, name + ".png"); await p.screenshot({ path: png }); execFileSync("cwebp", ["-quiet", "-q", "82", png, "-o", path.join(OUT, name + ".webp")]); fs.unlinkSync(png); console.log("  " + name + ".webp"); }

{ /* English Mastery */
  const { ctx, p } = await page("general-english");
  await practise(p, "EMUI", "EMEngine");
  await p.evaluate(() => go("english", "home")); await sleep(900); await p.evaluate(() => EMUI._act("tab", "home")); await sleep(500);
  await shot(p, "em-home");
  await p.evaluate(() => EMUI._act("tab", "games")); await sleep(600);
  await p.evaluate(() => { const g = document.querySelector("#v-english .wm-games"); if (g) window.scrollTo(0, g.getBoundingClientRect().top + window.scrollY - 190); }); await sleep(400);
  await shot(p, "em-games");
  /* Speak Up after one take: the transcription stand-in heard all but one word */
  await p.evaluate(() => EMUI._start("speak", { n: 3 })); await sleep(900);
  await p.evaluate(() => { const C = EMUI._corpus(), G = EMUI._game(), t = C.terms.find(x => x.id === G.ids[G.i]); const s = (t.kind === "sentence" ? t.en : t.ex.en).split(/\s+/); window.fbTranscribe = async () => s.filter((_, k) => k !== 2).join(" "); });
  await p.click('[data-em="sprec"]'); await sleep(1600); await p.click('[data-em="sprec"]'); await sleep(3600);   /* past the achievement toast */
  await shot(p, "em-speak");
  await ctx.close();
}
{ /* Welding Mastery */
  const { ctx, p } = await page("welding");
  await practise(p, "WMUI", "WMEngine");
  await p.evaluate(() => go("mastery", "games")); await sleep(900); await p.evaluate(() => WMUI._act("tab", "games")); await sleep(600);
  await p.evaluate(() => { const g = document.querySelector("#v-mastery .wm-games"); if (g) window.scrollTo(0, g.getBoundingClientRect().top + window.scrollY - 190); }); await sleep(400);
  await shot(p, "wm-games");
  await p.evaluate(() => { WMUI._act("tab", "home"); window.scrollTo(0, 0); }); await sleep(500);
  await shot(p, "wm-home");
  /* Visual recognition: a real photograph (Wikimedia Commons, credited in the app) and four names */
  await p.evaluate(() => WMUI._start("visual", { n: 6 })); await sleep(1400);
  await shot(p, "wm-visual");
  await ctx.close();
}
await b.close();
