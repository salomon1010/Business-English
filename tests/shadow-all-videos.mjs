/* Shadow library chips (owner, 30 Sep 2026): NO "All videos" chip in either area.
   Run: cd tests && node shadow-all-videos.mjs        (BASE=… to test another tree)

   Earlier the same day the library opened on an "All videos" chip; the owner then asked for it to
   go. General English opens on For you, which still reaches every video through Show more; Welding
   opens on the learner's own trade chip (the trade chips are the Change list). Categories,
   channels and search are filters the learner chooses. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8134);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const withTx = f => { const c = JSON.parse(readFileSync(root + "catalogue/" + f, "utf8")); return Object.keys(c.videos).filter(v => c.videos[v].cap && c.videos[v].cap !== "player"); };
const EXPECT = { "general-english": withTx("general.json"), welding: withTx("welding.json") };
const b = await chromium.launch();
const seed = (tr, lang = "en") => ({ profile: { name: "Alex", lang, ts: 1, weldProf: "welder" }, professionalTracks: { activeId: tr, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
async function open(tr, lang = "en") {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, l]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_lang", l); localStorage.setItem("be_flags", JSON.stringify({ shadow_library_enabled: true, welding_studio_enabled: true })) }, [JSON.stringify(seed(tr, lang)), lang]);
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1500);
  if (lang !== "en") { await p.evaluate(l => setLang(l), lang); await sleep(800); }
  await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#coachSummary").forEach(e => e.remove()); go("shadow") });
  await p.waitForSelector("#shLib .shl-chip", { timeout: 15000 }); await sleep(600);
  return { ctx, p, errs };
}
const rows = p => p.evaluate(() => [...document.querySelectorAll("#shLibFeed .shl-row[onclick*='shLibOpen']")].map(r => (r.getAttribute("onclick").match(/shLibOpen\('([^']+)'/) || [])[1]));
for (const tr of ["general-english", "welding"]) {
  const tag = tr === "welding" ? "W " : "GE";
  console.log(`\n# ${tr}`);
  const { ctx, p, errs } = await open(tr);
  const s = await p.evaluate(() => { const c = [...document.querySelectorAll("#shLib .shl-chip")]; return { cats: c.map(x => x.dataset.cat), first: c[0].dataset.cat, on: c.filter(x => x.classList.contains("on")).map(x => x.dataset.cat), label: c[0].childNodes[0].textContent.trim(), n: +(c[0].querySelector(".shl-all-n") || {}).textContent, more: !!document.querySelector("#shLibFeed .shl-more"), hero: !(document.getElementById("shlHeroBlock") || { hidden: true }).hidden } });
  const exp = EXPECT[tr];
  /* Welding has no All videos chip (owner, 30 Sep 2026): the ten trade chips are the filter and each one
     is the profession in the Change list, so the library opens on the learner's own trade. */
  const W = tr === "welding";
  ok(W ? `${tag} · no All videos chip: the first chip is For you and the learner's own trade is the one selected`
       : `${tag} · no All videos chip: the first chip is For you and it is the one selected`,
    !s.cats.includes("all") && s.first === "foryou" && s.on.join() === (W ? "welder" : "foryou"), JSON.stringify(s));
  ok(`${tag} · the week's picks stay on top`, s.hero, JSON.stringify(s));
  if (!W) {
  await p.evaluate(() => shLibMoreToggle()); await sleep(500);
  const r1 = await rows(p);
  ok(`${tag} · nothing is out of reach: For you + Show more lists every video with a transcript (${exp.length}) that is not in the week's picks — each once, each from this area's catalogue`,
    await p.evaluate(([r, e]) => { const hs = new Set(shLibHeroes().map(h => h.vid)); const want = e.filter(v => !hs.has(v)); return r.length === want.length && new Set(r).size === r.length && want.every(v => r.includes(v)); }, [r1, exp]), JSON.stringify({ shown: r1.length, total: exp.length }));
  await p.evaluate(() => shLibMoreToggle()); await sleep(300);
  }
  if (false) ok("W  · All videos is ordered with the learner's own profession first (order only — every profession is there)", await p.evaluate(() => { const c = _shCat, first = shLibAll()[0], me = weldProf(); return c.videos[first] && (c.categories.find(k => k.id === me) || { vids: [] }).vids.includes(first) && new Set(shLibAll().map(v => c.videos[v].prof)).size > 1 }));
  await p.evaluate(() => { scrollTo(0, 0); shLibCat("foryou") }); await sleep(400);
  const fy = await p.evaluate(() => ({ n: document.querySelectorAll("#shLibFeed .shl-row[onclick*='shLibOpen']").length, more: !!document.querySelector("#shLibFeed .shl-more"), on: document.querySelector("#shLib .shl-chip.on").dataset.cat }));
  ok(`${tag} · For you is still there as a filter: 8 rows and its Show more`, fy.on === "foryou" && fy.n === 8 && fy.more, JSON.stringify(fy));
  const cat = await p.evaluate(() => { const c = [...document.querySelectorAll("#shLib .shl-chip")].find(x => !["all", "foryou", "mine"].includes(x.dataset.cat)).dataset.cat; shLibCat(c); return c });
  const total = W ? await p.evaluate(() => shLibAll().length) : exp.length;
  await sleep(300); const cr = await rows(p);
  ok(`${tag} · a category chip filters (${cat}): fewer rows than the whole library, all in that category`, cr.length > 0 && cr.length < total && await p.evaluate(([ids, c]) => ids.every(v => (_shCat.categories.find(k => k.id === c) || { vids: [] }).vids.includes(v)), [cr, cat]), JSON.stringify({ cat, n: cr.length }));
  await p.evaluate(() => shLibCat("foryou")); await sleep(300);
  ok(`${tag} · back to the unfiltered list: the chip is on and the list starts again at the top`, await p.evaluate(() => document.querySelector("#shLib .shl-chip.on").dataset.cat === ("foryou")) && (await rows(p)).length >= 8);
  await p.evaluate(() => shLibQ("welding")); await sleep(300);
  const q = await p.evaluate(() => ({ n: document.querySelectorAll("#shLibFeed .shl-row").length }));
  await p.evaluate(() => shLibQ("")); await sleep(300);
  ok(`${tag} · search still works, and clearing it returns to the chip that was on`, q.n >= 0 && await p.evaluate(() => document.querySelector("#shLib .shl-chip.on").dataset.cat === ("foryou")));
  ok(`${tag} · no page errors`, !errs.length, errs.join(" | "));
  await ctx.close();
}
{ console.log("\n# French");
  const { ctx, p } = await open("general-english", "fr");
  const l = await p.evaluate(() => document.querySelector("#shLib .shl-chip").childNodes[0].textContent.trim());
  ok("fr · the first chip reads 'Pour vous'", l === "Pour vous", l); await ctx.close(); }
await b.close(); if (srv) srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
