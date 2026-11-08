/* Ideas & Personal Growth in the Shadow library (8 Nov 2026).
   Run: cd tests && node ideas-growth-library.mjs

   The point of this suite is the kill switch. The library's channel row, hero strip,
   search and "all" feed read _shCat with no flag check of their own, so the only safe
   place for unreviewed content is a file production never fetches. These checks prove
   that: with the flag off, not one of the 20 videos, 4 channels or the category exists
   anywhere in the loaded catalogue — and the overlay file is never even requested. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8167);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };

const overlay = JSON.parse(fs.readFileSync(new URL("../catalogue/ideas-growth.json", import.meta.url)));
const IDS = overlay.category.vids, CH = overlay.channels.map(c => c.id);
/* The overlay is checked against the REGISTRY, not against itself. Checking an artefact
   with ids taken from that same artefact proves nothing: an earlier build keyed every
   record by the seed label ("ipg-001") instead of the YouTube id, so the library asked
   i.ytimg.com for /vi/ipg-001/ and every thumbnail and player url was wrong — while a
   self-referential test passed happily. */
const registry = JSON.parse(fs.readFileSync(new URL("../catalogue/drafts/ideas-personal-growth-registry.json", import.meta.url)));
console.log("\n# the overlay against its source of truth");
ok("every id is an 11-character YouTube video id", IDS.every(v => /^[A-Za-z0-9_-]{11}$/.test(v)), IDS.filter(v => !/^[A-Za-z0-9_-]{11}$/.test(v)).join());
ok("every id is a real key in the validated registry", IDS.every(v => registry.videos[v]), IDS.filter(v => !registry.videos[v]).join());
ok("no seed label (ipg-NNN) leaked in as a video id", !IDS.some(v => /^ipg-/.test(v)), IDS.filter(v => /^ipg-/.test(v)).join());
ok("the videos map and the category list hold the same ids", JSON.stringify(Object.keys(overlay.videos).sort()) === JSON.stringify([...IDS].sort()));
ok("every title matches the registry row", IDS.every(v => overlay.videos[v].title === registry.videos[v].title));
ok("every duration is the measured one, not the rounded listing", IDS.every(v => overlay.videos[v].dur === registry.videos[v].exact_duration_seconds));
ok("every record carries a verified channel id", IDS.every(v => overlay.videos[v].chId && overlay.videos[v].chId === registry.videos[v].verified_channel_id));
ok("every row was actually validated as embeddable", IDS.every(v => registry.videos[v].embedding_status === "embeddable"));
ok("the file states it is not reviewed", overlay.reviewed === false && /NOT editorially reviewed/i.test(overlay.review_warning));

const b = await chromium.launch();
const seed = tr => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr, tradeId: "welder" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

async function open(track, ideasOn) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  /* addInitScript passes exactly ONE argument through — both values travel in one object */
  await ctx.addInitScript(a => {
    localStorage.setItem("be12_v1", a.s);
    localStorage.setItem("be_flags", JSON.stringify({ shadow_library_enabled: true, shadow_studio_v2_enabled: true, welding_studio_enabled: true, ideas_personal_growth_enabled: !!a.on }));
  }, { s: JSON.stringify(seed(track)), on: ideasOn });
  await ctx.route(u => /be-events|be-polish|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube|entitlements/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const asked = [];
  await ctx.route("**/catalogue/ideas-growth.json", r => { asked.push(r.request().url()); r.continue(); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1400);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  await p.evaluate(() => go("shadow")); await sleep(1200);
  return { ctx, p, errs, asked };
}
const cat = p => p.evaluate(() => ({
  cats: (_shCat && _shCat.categories || []).map(c => c.id),
  chans: (_shCat && _shCat.channels || []).map(c => c.id),
  vids: Object.keys((_shCat && _shCat.videos) || {}),
  chipLabels: [...document.querySelectorAll(".shl-chip")].map(e => e.textContent.trim()),
  chanNames: [...document.querySelectorAll(".shl-chan span")].map(e => e.textContent.trim()),
}));

console.log("\n# flag OFF — production: the overlay does not exist as far as the app is concerned");
{
  const { ctx, p, errs, asked } = await open("general-english", false);
  const c = await cat(p);
  ok("the overlay file is never requested", asked.length === 0, asked.join());
  ok("no ideas_growth category in the loaded catalogue", !c.cats.includes("ideas_growth"), c.cats.join());
  ok("none of the 4 creator channels is in the channel row", !CH.some(id => c.chans.includes(id)), c.chans.join());
  ok("not one of the 20 video ids is in the catalogue", !IDS.some(v => c.vids.includes(v)), IDS.filter(v => c.vids.includes(v)).join());
  ok("no chip carries the category label", !c.chipLabels.some(l => /Ideas & Personal Growth/i.test(l)), c.chipLabels.join(" | "));
  const found = await p.evaluate(() => { shLibQ("Nietzsche"); return shLibList().length; });
  ok("searching a title from the pack finds nothing", found === 0, String(found));
  ok("no JavaScript errors", errs.length === 0, errs.join());
  await ctx.close();
}

console.log("\n# flag ON — staging preview: the category, its channels and its videos are there");
let onPage = null;
{
  const { ctx, p, errs, asked } = await open("general-english", true);
  const c = await cat(p);
  ok("the overlay file is fetched exactly once", asked.length === 1, String(asked.length));
  ok("ideas_growth is in the catalogue", c.cats.includes("ideas_growth"), c.cats.join());
  ok("all 4 creator channels joined the channel row", CH.every(id => c.chans.includes(id)), c.chans.join());
  ok("all 20 videos joined the catalogue", IDS.every(v => c.vids.includes(v)), String(IDS.filter(v => !c.vids.includes(v)).length) + " missing");
  ok("the existing 12 channels are still there, none replaced", c.chans.length === 12 + CH.length, String(c.chans.length));
  ok("the existing categories are untouched", ["meetings", "presentations", "interviews", "everyday", "skills", "tv", "movies", "songs"].every(id => c.cats.includes(id)), c.cats.join());
  ok("a chip is drawn for the category", c.chipLabels.some(l => /Ideas & Personal Growth/i.test(l)), c.chipLabels.join(" | "));
  ok("the four creators are named in the channel row", ["Robert Greene", "Academy of Ideas", "Einzelgänger", "Pursuit of Wonder"].every(n => c.chanNames.includes(n)), c.chanNames.join(" | "));

  const n = await p.evaluate(() => { shLibQ(""); shLibCat("ideas_growth"); return shLibList().length; });
  ok("selecting the chip lists all 20 videos", n === 20, String(n));
  const s = await p.evaluate(() => { shLibQ("Nietzsche"); return shLibList().length; });
  ok("search reaches them too", s > 0, String(s));
  const chf = await p.evaluate(id => { shLibQ(""); shLibChan(id); return shLibList().length; }, CH[0]);
  ok("filtering by one of the new channels lists only its videos", chf === 5, String(chf));

  /* the honest part: these carry no transcript, and the record says so */
  const rec = (await p.evaluate(v => _shCat.videos[v], IDS[0])) || {};
  ok("every record is watch-only (cap is player-or-none, watch:true)", rec.watch === true && (rec.cap === "player" || rec.cap === null), JSON.stringify(rec));
  ok("so the studio will not claim a transcript for it", await p.evaluate(v => !(_shCat.videos[v].cap && _shCat.videos[v].cap !== "player"), IDS[0]));
  ok("the record carries the verified channel id, not a guess", /^UC[\w-]{20,}$/.test(rec.chId), rec.chId);
  ok("no JavaScript errors", errs.length === 0, errs.join());
  onPage = ctx;
}
await onPage.close();

console.log("\n# Welding — the programme boundary, with the flag ON");
{
  const { ctx, p, errs, asked } = await open("welding", true);
  const c = await cat(p);
  ok("the overlay is never fetched for a Welding learner", asked.length === 0, asked.join());
  ok("no ideas_growth category on Welding", !c.cats.includes("ideas_growth"), c.cats.join());
  ok("none of the 20 videos reached the Welding catalogue", !IDS.some(v => c.vids.includes(v)));
  ok("no JavaScript errors", errs.length === 0, errs.join());
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const bad = res.filter(x => !x).length;
console.log(`\n${res.length - bad}/${res.length} passed`);
process.exit(bad ? 1 : 0);
