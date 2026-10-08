/* Help centre (rManual → helpBuild): topic tiles, one topic at a time, search.
   - the default view is a grid of tiles, two a row on a phone, one per section
   - a tile opens ONE topic; "All topics" and the previous / next cards work
   - search shows every matching topic, highlighted, and clearing it returns
   - a translated manual (older section ids, no data-sum) gets the same layout
   Run: cd tests && node help-centre.mjs        (PORT=nnnn for another port)
   SHOTS=1 also writes /tmp/help-*.png */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOT = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8796), BASE = `http://localhost:${PORT}`;
const srv = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 400)}`); };
const SHOTS = !!process.env.SHOTS;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 2 : 1 });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(BASE + "/index.html?t=" + Date.now(), { waitUntil: "load" });
await p.evaluate(() => { OB.name = "Check"; obFinish(); }); await sleep(700);
await p.evaluate(() => { try { wcClose() } catch (e) {} document.querySelectorAll(".cf-ov,.wc-ov,#fndCheckOv").forEach(e => e.remove()); });

console.log("\n# topics");
await p.evaluate(() => openManual()); await sleep(1200);
const g = await p.evaluate(() => {
  const md = document.getElementById("manualDoc");
  const tiles = [...md.querySelectorAll(".help-tile")], secs = [...md.querySelectorAll("section.help-topic")];
  const vis = secs.filter(s => getComputedStyle(s).display !== "none").length;
  const cols = getComputedStyle(md.querySelector(".help-grid")).gridTemplateColumns.split(" ").length;
  const icons = tiles.map(t => t.querySelectorAll("svg").length);
  return { tiles: tiles.length, secs: secs.length, vis, cols, icons, sum: tiles.filter(t => t.querySelector(".help-tile-s")).length,
    t0: tiles[0] && tiles[0].querySelector(".help-tile-t").textContent, sub: (document.querySelector(".help-hero-sub") || {}).textContent };
});
ok("C1 · one tile per section, and no section shown until one is opened", g.tiles === g.secs && g.secs >= 18 && g.vis === 0, JSON.stringify(g));
ok("C2 · two tiles a row on a phone", g.cols === 2, g.cols);
ok("C3 · each tile carries exactly one icon (no doubled emoji / number icons)", g.icons.every(n => n === 1), JSON.stringify(g.icons));
ok("C4 · the English manual gives every tile a one-line summary", g.sum === g.tiles, g.sum + "/" + g.tiles);
ok("C5 · tile titles are clean text (no leading number or emoji)", /^Getting started$/.test(g.t0), g.t0);
ok("C6 · the hero carries the new subtitle", g.sub === "Search, or tap a topic.", g.sub);
if (SHOTS) await p.screenshot({ path: "/tmp/help-grid.png" });

console.log("\n# reading one topic");
const r = await p.evaluate(async () => {
  helpOpen("man-shadow"); await new Promise(r => setTimeout(r, 500));
  const md = document.getElementById("manualDoc");
  const on = [...md.querySelectorAll("section.help-topic")].filter(s => getComputedStyle(s).display !== "none").map(s => s.id);
  const grid = getComputedStyle(md.querySelector(".help-grid")).display;
  const pg = [...md.querySelectorAll("#helpPager .help-pg-t")].map(x => x.textContent);
  const head = md.querySelector("#man-shadow > h2").textContent.trim();
  return { on, grid, pg, head, back: getComputedStyle(md.querySelector(".help-readbar")).display };
});
ok("R1 · a tile opens that topic alone and hides the grid", JSON.stringify(r.on) === '["man-shadow"]' && r.grid === "none" && r.back !== "none", JSON.stringify(r));
ok("R2 · previous / next name the neighbouring topics", r.pg[0] === "Your daily session" && r.pg[1] === "Your speaking reports", JSON.stringify(r.pg));
if (SHOTS) { await p.evaluate(() => scrollTo(0, 0)); await sleep(300); await p.screenshot({ path: "/tmp/help-topic.png" }); }
const n = await p.evaluate(async () => {
  document.querySelector("#helpPager .help-pg-next").click(); await new Promise(r => setTimeout(r, 400));
  const now = [...document.querySelectorAll("section.help-topic")].find(s => getComputedStyle(s).display !== "none");
  return now && now.id;
});
ok("R3 · Next opens the following topic", n === "man-feedback", n);
const bk = await p.evaluate(async () => {
  helpBack(); await new Promise(r => setTimeout(r, 400));
  const md = document.getElementById("manualDoc");
  return { grid: getComputedStyle(md.querySelector(".help-grid")).display, vis: [...md.querySelectorAll("section.help-topic")].filter(s => getComputedStyle(s).display !== "none").length };
});
ok("R4 · All topics returns to the grid", bk.grid !== "none" && bk.vis === 0, JSON.stringify(bk));

console.log("\n# search");
const s = await p.evaluate(async () => {
  helpOpen("man-faq");
  const inp = document.getElementById("helpSearch"); inp.value = "Practice Partner"; helpFilter(inp.value);
  await new Promise(r => setTimeout(r, 300));
  const md = document.getElementById("manualDoc");
  const vis = [...md.querySelectorAll("section.help-topic")].filter(s => getComputedStyle(s).display !== "none").map(s => s.id);
  const res = { vis, hits: md.querySelectorAll(".help-hl").length, grid: getComputedStyle(md.querySelector(".help-grid")).display, pagerHit: md.querySelectorAll("#helpPager .help-hl").length };
  inp.value = ""; helpFilter(""); await new Promise(r => setTimeout(r, 300));
  res.after = [...md.querySelectorAll("section.help-topic")].filter(s => getComputedStyle(s).display !== "none").map(s => s.id);
  return res;
});
ok("S1 · a search shows every matching topic in full, highlighted, without the grid", s.vis.length >= 3 && s.vis.includes("man-partner") && s.hits >= 3 && s.grid === "none", JSON.stringify(s));
ok("S2 · the pager text is never a search hit", s.pagerHit === 0, s.pagerHit);
ok("S3 · clearing the search returns to the topic it started from", JSON.stringify(s.after) === '["man-faq"]', JSON.stringify(s.after));

console.log("\n# a translated manual");
const f = await p.evaluate(async () => {
  S.profile.lang = "fr"; await setLang("fr"); go("manual"); await new Promise(r => setTimeout(r, 1500));
  const md = document.getElementById("manualDoc");
  const tiles = md.querySelectorAll(".help-tile").length, secs = md.querySelectorAll("section.help-topic").length;
  return { tiles, secs, all: t("help.all") };
});
ok("T1 · the French manual (older ids, no summaries) gets the same tiles", f.tiles === f.secs && f.secs >= 10, JSON.stringify(f));
ok("T2 · the new labels are translated", f.all === "Tous les thèmes", f.all);

ok("E · no JS errors", errs.length === 0, errs.join(" | "));
await b.close(); srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
