/* BE Mastery — the Shadow library's hero strip: six slides, one always a
   cartoon, the plan's own clip first, and a different mix each day.

   Owner brief, 27 Sep 2026: "make them six different pages … always make
   sure there is a cartoon video there … those pages should be dynamic, not
   always the same thing all the time … first, Fits your plan".

   What this proves, in a real headless Chromium against the served tree:
     - the catalogue flags the cartoon-based lessons (`toon`), all with captions
     - the strip renders SIX distinct slides and six dots
     - slide 1 carries "Fits your plan"; in a week whose mission links a clip it
       IS that clip; in a week without one it comes from that week's category
     - exactly one slide is the cartoon, and it is never slide 1
     - the other slides span the categories: no channel owns the strip
     - the same day + week always draws the same strip; another day draws a
       different one (across 30 days the cartoon moves between slots)
     - a video the learner has already shadowed is passed over while the pool
       allows, so a returning learner sees something new
     - the "For you" feed repeats none of the six
     - the strip rotates on its own and stops the moment the learner taps a dot

   Run:  cd tests && node hero-slides.mjs            (BASE=… to test a server) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const CATALOGUE = JSON.parse(readFileSync(ROOT + "catalogue/general.json", "utf8"));
const PACK = JSON.parse(readFileSync(ROOT + "tracks/general/missions.json", "utf8"));
const res = [];
const ok = (n, c, d = "") => { res.push({ name: n, pass: !!c }); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };

/* ---- the data ---- */
const toons = Object.entries(CATALOGUE.videos).filter(([, v]) => v.toon);
ok("The catalogue flags at least five cartoon-based lessons, every one with a caption file",
  toons.length >= 5 && toons.every(([id, v]) => v.cap && v.cap !== "player" && existsSync(ROOT + "captions/" + id + ".json")),
  toons.map(([id, v]) => id + ":" + v.cap).join());
const linked = PACK.competencies.filter(c => c.shadow && c.shadow.vid && CATALOGUE.videos[c.shadow.vid]);
const unlinked = PACK.competencies.filter(c => !(c.shadow && c.shadow.vid));
ok("The mission pack links a clip for some weeks and none for others (both paths are exercised below)", linked.length >= 1 && unlinked.length >= 1);

/* ---- the served tree ---- */
let BASE = process.env.BASE, server = null;
if (!BASE) {
  const mine = readFileSync(ROOT + "index.html", "utf8");
  for (const port of [8156, 8157, 8158, 8159, 8160]) {
    const s = spawn("python3", ["-m", "http.server", String(port)], { cwd: ROOT, stdio: "ignore" });
    await sleep(700);
    let served = null;
    try { served = await (await fetch(`http://localhost:${port}/index.html`)).text(); } catch (e) {}
    if (served && served.length === mine.length) { server = s; BASE = `http://localhost:${port}`; break; }
    s.kill(); console.log(`  (port ${port} is serving another tree — next)`);
  }
  if (!BASE) { console.error("no free port; pass BASE="); process.exit(1); }
}
console.log("  serving: " + BASE);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  localStorage.setItem("be_flags", JSON.stringify({ shadow_library_enabled: true }));
  localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "T", lang: "en", goal: "Speak with confidence in meetings", ts: Date.now() },
    professionalTracks: { activeId: "general-english" },
    fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} }, "welding": { placed: "full", finished: true, day: 15, done: {} } },
    days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() }));
});
/* thumbnails and the player stay off the network: this is about which slides are chosen */
await ctx.route(u => /youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com/.test(u.href), route => route.abort());
const page = await ctx.newPage(); const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto(BASE + "/index.html?hero=" + Date.now(), { waitUntil: "load" });
await sleep(1000);
await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov").forEach(e => e.remove()); go("shadow"); });
const drawn = await page.waitForFunction(() => document.querySelector("#shlHeroTrack .shl-hero"), null, { timeout: 8000 }).then(() => true).catch(() => false);
ok("The library draws the hero strip", drawn);

/* ---- what is on the screen ---- */
const dom = await page.evaluate(() => {
  const s = [...document.querySelectorAll("#shlHeroTrack .shl-hero")];
  const vid = b => (b.getAttribute("onclick").match(/shLibOpen\('([^']+)'\)/) || [])[1];
  return {
    n: s.length, dots: document.querySelectorAll("#shlHeroDots .shl-dot").length,
    vids: s.map(vid), tags: s.map(b => b.querySelector(".shl-hero-tag").className.replace("shl-hero-tag", "").trim()),
    labels: s.map(b => b.querySelector(".shl-hero-tag").textContent),
    label: document.querySelector("#shlHeroBlock .shl-lbl").textContent,
    feed: [...document.querySelectorAll("#shLibFeed .shl-row")].map(vid),
    firstEager: s[0] && s[0].querySelector("img").loading === "eager",
  };
});
ok("Six slides and six dots", dom.n === 6 && dom.dots === 6, JSON.stringify([dom.n, dom.dots]));
ok("Six different videos", new Set(dom.vids).size === 6, dom.vids.join());
ok("Slide 1 says \"Fits your plan\"; the strip is titled for the current week", dom.tags[0] === "plan" && dom.labels[0] === "Fits your plan" && /Week 1/.test(dom.label), JSON.stringify([dom.tags[0], dom.labels[0], dom.label]));
ok("Exactly one slide is the cartoon, labelled so, and it is not slide 1", dom.tags.filter(t => t === "toon").length === 1 && dom.tags[0] !== "toon" && dom.labels[dom.tags.indexOf("toon")] === "Cartoon", JSON.stringify(dom.tags));
ok("The cartoon slide is one of the flagged lessons", !!CATALOGUE.videos[dom.vids[dom.tags.indexOf("toon")]]?.toon, dom.vids[dom.tags.indexOf("toon")]);
ok("Every other slide carries its category's label", dom.tags.every((t, i) => t === "plan" || t === "toon" || (/^c-/.test(t) && dom.labels[i].length > 0)), JSON.stringify(dom.labels));
const catOf = v => (CATALOGUE.categories.find(c => c.vids.includes(v)) || {}).id;
ok("The slides span at least four categories — no channel owns the strip", new Set(dom.vids.map(catOf)).size >= 4, dom.vids.map(catOf).join());
ok("Every slide has captions we ship (never a captions-in-player video)", dom.vids.every(v => CATALOGUE.videos[v] && CATALOGUE.videos[v].cap && CATALOGUE.videos[v].cap !== "player"));
ok("The \"For you\" feed repeats none of the six", dom.feed.length >= 6 && dom.vids.every(v => !dom.feed.includes(v)), JSON.stringify({ feed: dom.feed.slice(0, 8), vids: dom.vids }));
ok("Slide 1 loads eagerly (it is above the fold)", dom.firstEager);

/* ---- the choice itself, week by week and day by day ---- */
const linkedWeek = linked[0].week, unlinkedWeek = unlinked[0].week;
const byWeek = await page.evaluate(([lw, uw, lv]) => ({
  linked: shLibHeroes({ w: lw, seed: 7 }), unlinked: shLibHeroes({ w: uw, seed: 7 }), lv,
}), [linkedWeek, unlinkedWeek, linked[0].shadow.vid]);
ok(`Week ${linkedWeek} (mission links a clip): slide 1 IS that clip, tagged plan`, byWeek.linked[0].vid === byWeek.lv && byWeek.linked[0].tag === "plan", JSON.stringify(byWeek.linked[0]));
ok(`Week ${unlinkedWeek} (no linked clip): slide 1 still says plan and comes from a real category`, byWeek.unlinked[0].tag === "plan" && !!byWeek.unlinked[0].cat && CATALOGUE.categories.some(c => c.id === byWeek.unlinked[0].cat && c.vids.includes(byWeek.unlinked[0].vid)), JSON.stringify(byWeek.unlinked[0]));

const days = await page.evaluate(() => {
  const out = [];
  for (let d = 0; d < 30; d++) out.push(shLibHeroes({ w: 1, seed: 2026000 + d }));
  return { out, again: shLibHeroes({ w: 1, seed: 2026000 }) };
});
ok("Same day, same week: the same six in the same order", JSON.stringify(days.again) === JSON.stringify(days.out[0]));
const sets = days.out.map(s => s.map(x => x.vid).join());
ok("Across 30 days the strip is different on at least 25 of them", new Set(sets).size >= 25, String(new Set(sets).size));
ok("Every one of those 30 strips has six distinct slides, exactly one cartoon, slide 1 = plan",
  days.out.every(s => s.length === 6 && new Set(s.map(x => x.vid)).size === 6 && s.filter(x => x.tag === "toon").length === 1 && s[0].tag === "plan"));
const toonSlots = new Set(days.out.map(s => s.findIndex(x => x.tag === "toon")));
ok("The cartoon moves between slots over the month (mixed in, not parked)", toonSlots.size >= 3 && !toonSlots.has(0), [...toonSlots].join());
const toonVids = new Set(days.out.map(s => s.find(x => x.tag === "toon").vid));
ok("More than one cartoon lesson gets its turn over the month", toonVids.size >= 3, [...toonVids].join());

/* ---- what the learner already did makes way ---- */
const seen = await page.evaluate(() => {
  const before = shLibHeroes({ w: 1, seed: 2026005 });
  const target = before.find(x => x.tag === "toon").vid;
  aList("chHist").unshift({ vid: target, ts: Date.now(), line: "x", verdict: "ok", issues: [], dims: {}, drills: [] });
  const after = shLibHeroes({ w: 1, seed: 2026005 });
  aList("chHist").shift();
  return { target, afterToon: after.find(x => x.tag === "toon").vid, afterN: after.length };
});
ok("A cartoon the learner already shadowed gives way to another one, same day", seen.afterToon !== seen.target && seen.afterN === 6, JSON.stringify(seen));

/* ---- motion: rotates alone, stops on a deliberate tap ---- */
const motion = await page.evaluate(async () => {
  const track = document.getElementById("shlHeroTrack");
  const at = () => track.style.transform || "";
  const t0 = at();
  await new Promise(r => setTimeout(r, 5600));
  const t1 = at();
  shlHeroDot(3);
  const t2 = at();
  await new Promise(r => setTimeout(r, 5600));
  return { t0, t1, t2, t3: at(), ms: typeof SHL_HERO_MS === "number" ? SHL_HERO_MS : null };
});
ok("The strip has moved on its own after one interval", motion.t0 !== motion.t1, JSON.stringify(motion));
ok("A tap on a dot lands on that slide and ends the rotation", /-300%/.test(motion.t2) && motion.t2 === motion.t3, JSON.stringify(motion));

ok("No page errors", errors.length === 0, errors.join(" | "));

await browser.close(); if (server) server.kill();
const fails = res.filter(r => !r.pass).length;
console.log(`\n${res.length - fails}/${res.length} checks passed`);
process.exit(fails ? 1 : 0);
