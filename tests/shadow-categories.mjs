/* Shadow library — the "learn with" categories: TV shows, Movies, Songs.
   Run:  cd tests && node shadow-categories.mjs      (BASE=… for another server)
   Catalogue integrity is checked on the file itself; the chips, the feed and
   the six-slide strip in a General English page at phone size. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOT = new URL("..", import.meta.url).pathname;
let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", "8799"], { cwd: ROOT, stdio: "ignore" }); await sleep(800); BASE = "http://localhost:8799"; }
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

/* the catalogue file */
const cat = JSON.parse(fs.readFileSync(ROOT + "catalogue/general.json", "utf8"));
const ids = cat.categories.map(c => c.id);
ok("the catalogue keeps the five categories in their order and adds tv, movies, songs after them", ids.join() === "meetings,presentations,interviews,everyday,skills,tv,movies,songs", ids.join());
for (const [id, min] of [["tv", 20], ["movies", 20], ["songs", 15]]) {
  const c = cat.categories.find(x => x.id === id);
  ok(`${id}: at least ${min} videos, every one with a transcript file`, c && c.vids.length >= min && c.vids.every(v => cat.videos[v] && cat.videos[v].cap && fs.existsSync(ROOT + "captions/" + v + ".json")), c && c.vids.filter(v => !fs.existsSync(ROOT + "captions/" + v + ".json")).join());
  ok(`${id}: no video twice`, c && new Set(c.vids).size === c.vids.length);
}
const songs = cat.categories.find(x => x.id === "songs").vids.map(v => cat.videos[v].ch);
ok("songs are teacher-led lessons (EnglishClass101, FluentU, Learning English Songs, Learn English With TV Series), not music-label uploads", songs.every(ch => /EnglishClass101|FluentU|Learning English Songs|Learn English With TV Series/i.test(ch)), [...new Set(songs)].join(" | "));
ok("every category video exists in the video map", cat.categories.every(c => c.vids.every(v => cat.videos[v])));
ok("cartoon lessons are flagged for the strip (toon)", Object.values(cat.videos).filter(v => v.toon).length >= 8);

/* the page */
const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  if (!localStorage.getItem("be12_v1")) localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Alex", lang: "en", ts: Date.now() }, professionalTracks: { activeId: "general-english" },
    fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() }));
});
const p = await ctx.newPage();
p.on("pageerror", e => errors.push(e.message));
await p.goto(BASE + "/index.html?c=" + Date.now() + "#shadow", { waitUntil: "load" }); await sleep(1200);
await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); go("shadow"); });
await p.waitForSelector(".shl-chip[data-cat='tv']", { timeout: 15000 });
const chips = await p.evaluate(() => [...document.querySelectorAll(".shl-chip")].map(b => ({ id: b.dataset.cat, fun: b.classList.contains("fun"), svg: !!b.querySelector("svg"), t: b.textContent.trim(), col: getComputedStyle(b).color })));
ok("chip order: For you, Your videos, TV shows, Movies, Songs, then the five", chips.map(c => c.id).join() === "foryou,mine,tv,movies,songs,meetings,presentations,interviews,everyday,skills", chips.map(c => c.id).join());
ok("the three new chips are labelled TV shows / Movies / Songs, each with an icon", ["TV shows", "Movies", "Songs"].every((l, i) => chips[2 + i].t.startsWith(l) && chips[2 + i].svg && chips[2 + i].fun), JSON.stringify(chips.slice(2, 5)));
ok("each new chip has its own colour", new Set(chips.slice(2, 5).map(c => c.col)).size === 3, chips.slice(2, 5).map(c => c.col).join(" "));
for (const id of ["tv", "movies", "songs"]) {
  const r = await p.evaluate(async id => { shLibCat(id); await new Promise(z => setTimeout(z, 250)); const b = document.querySelector(`.shl-chip[data-cat='${id}']`);
    const rows = [...document.querySelectorAll("#shLibFeed .shl-row:not(.scn-lrow)")]; await new Promise(z => setTimeout(z, 500)); const br = b.getBoundingClientRect(), rr = b.parentElement.getBoundingClientRect(); return { seen: br.left >= rr.left - 1 && br.right <= rr.right + 1, on: b.classList.contains("on"), bg: getComputedStyle(b).backgroundImage, n: rows.length, first: (rows[0] && rows[0].querySelector("b") || {}).textContent }; }, id);
  ok(`${id}: tapping the chip fills it, brings it into view and lists its videos`, r.seen && r.on && /gradient/.test(r.bg) && r.n >= 8, JSON.stringify(r));
}
await p.evaluate(() => shLibCat("foryou")); await sleep(200);
const hero = await p.evaluate(() => { const s = [...document.querySelectorAll("#shlHeroTrack .shl-hero")]; return { n: s.length, tags: s.map(x => (x.querySelector(".shl-hero-tag") || {}).className || ""), dots: document.querySelectorAll("#shlHeroDots .shl-dot").length }; });
ok("the strip has six slides and six dots", hero.n === 6 && hero.dots === 6, JSON.stringify(hero));
ok("slide 1 fits the plan and one slide is a cartoon", /plan/.test(hero.tags[0]) && hero.tags.filter(t => /toon/.test(t)).length === 1, hero.tags.join(" | "));
const mix = await p.evaluate(() => { const a = shLibHeroes({ seed: 11 }).map(h => h.vid).join(), b = shLibHeroes({ seed: 12 }).map(h => h.vid).join(), c = shLibHeroes({ seed: 11 }).map(h => h.vid).join(); return { same: a === c, differ: a !== b }; });
ok("the mix is the same within a day and different on another day", mix.same && mix.differ, JSON.stringify(mix));
ok("no page errors", errors.length === 0, errors.join(" | "));

const pass = res.filter(r => r.pass).length;
console.log(`\n${pass}/${res.length} passed`);
await browser.close(); if (server) server.kill();
process.exit(pass === res.length ? 0 : 1);
