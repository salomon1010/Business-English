/* Welding Professional English — Shadow Studio, Practice text shadowing, Home V2 (owner, 29 Sep 2026).
   Run: cd tests && node welding-studio.mjs        (BASE=… to test another tree, e.g. staging)

   Flag welding_studio_enabled (staging on, production off). With it on, a Welding learner gets:
   the video Shadow Studio fed by catalogue/welding.json (ten refinery professions), the workplace
   lines as Practice tool 4 (view "lines"), and Home V2 with Welding recommendations. Nothing of
   General English may reach Welding, and General English must not change. The flag is forced
   here through localStorage.be_flags so the suite also runs on localhost. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8137);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const WELD = JSON.parse(await (await fetch(BASE + "/catalogue/welding.json")).text());
const GEN = JSON.parse(await (await fetch(BASE + "/catalogue/general.json")).text());
const WV = new Set(Object.keys(WELD.videos)), GV = new Set(Object.keys(GEN.videos));
const b = await chromium.launch();
const seed = (tr, o = {}) => Object.assign({ profile: { name: "Alex", lang: o.lang || "en", ts: 1 }, professionalTracks: { activeId: tr, tradeId: o.trade || "welder" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }, o.extra || {});
async function open(track, { width = 390, height = 844, hash = "", lang = "en", flags = { welding_studio_enabled: true, home_v2_enabled: true }, trade, extra } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, lang, f]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_lang", lang); localStorage.setItem("be_flags", f); }, [JSON.stringify(seed(track, { lang, trade, extra })), lang, JSON.stringify(flags)]);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights|gstatic\.com\/firebasejs|entitlements/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html" + hash); await sleep(1800);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#coachSummary").forEach(e => e.remove()));
  return { ctx, p, errs };
}
/* every YouTube id the page shows — thumbnails, slides, rows, data attributes */
const shownVids = p => p.evaluate(() => { const s = new Set(); document.querySelectorAll("[data-vid]").forEach(e => s.add(e.dataset.vid)); document.querySelectorAll("img[src*='/vi/'],img[data-src*='/vi/']").forEach(e => { const m = (e.getAttribute("src") || e.dataset.src || "").match(/\/vi\/([A-Za-z0-9_-]{11})\//); if (m) s.add(m[1]); }); document.querySelectorAll("[onclick*='shLibOpen']").forEach(e => { const m = e.getAttribute("onclick").match(/shLibOpen\('([^']+)'/); if (m) s.add(m[1]); }); return [...s]; });
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

console.log("\n# catalogue: ten professions, real content only");
ok("1 · catalogue/welding.json has the ten professions in four groups", WELD.categories.length === 10 && WELD.groups.length === 4 && WELD.groups.flatMap(g => g.cats).length === 10, WELD.categories.map(c => c.id));
ok("1b · no Welding video is a General English video", [...WV].every(v => !GV.has(v)), [...WV].filter(v => GV.has(v)));
ok("1c · every Welding video names its profession and topic, and ships a caption file", Object.entries(WELD.videos).every(([v, x]) => x.prof && x.topic && x.cap && fs.existsSync(root + "captions/" + v + ".json")), Object.entries(WELD.videos).filter(([v, x]) => !(x.prof && x.topic && x.cap && fs.existsSync(root + "captions/" + v + ".json"))).map(([v]) => v));
ok("1d · every channel in the row has at least one video", WELD.channels.every(c => Object.values(WELD.videos).some(v => v.chId === c.id)), WELD.channels.map(c => c.name));

console.log("\n# Welding · Shadow = the video Shadow Studio");
{
  const { ctx, p, errs } = await open("welding", { trade: "pipefitter" });
  await p.evaluate(() => go("shadow")); await sleep(1500);
  ok("2f · no General English animated scene in the Welding library", await p.evaluate(() => !scnOn() && !document.querySelector("#shLibFeed [onclick*='scnOpen']")));
  const s = await p.evaluate(() => ({ lib: !!document.querySelector("#v-shadow #shLib"), lines: !!document.querySelector("#v-shadow .sh-lines"), chips: [...document.querySelectorAll(".shl-chip")].map(x => x.dataset.cat), chans: document.querySelectorAll(".shl-chan").length, prof: (document.querySelector(".wprof-pill b") || {}).textContent, first: [...document.querySelectorAll("#shLibFeed .shl-row[onclick*='shLibOpen']")].slice(0, 4).map(x => (x.getAttribute("onclick") || "").match(/'([^']+)'/)?.[1]) }));
  ok("2 · the Shadow tab shows the video library, not the workplace lines", s.lib && !s.lines, JSON.stringify(s));
  ok("2b · chips = For you, Your videos, then the professions — the learner's own (Pipefitter) first", s.chips[0] === "foryou" && s.chips[1] === "mine" && s.chips[2] === "pipefitter" && s.chips.every(c => ["foryou", "mine"].includes(c) || WELD.categories.some(k => k.id === c)), s.chips);
  ok("2c · the Welding channels row is there", s.chans === WELD.channels.length, s.chans);
  ok("2d · For you leads with the learner's profession", s.first.length && s.first.every(v => WELD.videos[v] && WELD.videos[v].prof === "pipefitter"), JSON.stringify(s.first.map(v => WELD.videos[v] && WELD.videos[v].prof)));
  ok("2e · the profession row says Pipefitter", s.prof === "Pipefitter", s.prof);
  const v1 = await shownVids(p);
  ok("3 · ISOLATION: every video on the Welding Shadow page is a Welding video", v1.length > 5 && v1.every(v => WV.has(v)), v1.filter(v => !WV.has(v)));
  for (const cat of ["hse", "ndt", "operator"]) { await p.evaluate(c => shLibCat(c), cat); await sleep(150); }
  const v2 = await shownVids(p);
  ok("3b · …on every profession chip", v2.every(v => WV.has(v)), v2.filter(v => !WV.has(v)));
  await p.evaluate(() => shLibQ("steve jobs")); await sleep(150);
  ok("3c · searching for a General English video finds nothing on Welding", (await p.evaluate(() => document.querySelectorAll("#shLibFeed .shl-row").length)) === 0);
  await p.evaluate(() => shLibQ("")); await sleep(100);

  console.log("\n# the same engine: Watch / Shadow / Challenge, transcript from the bundled captions");
  const vid = s.first[0];
  await p.evaluate(v => shLibOpen(v), vid); await sleep(2500);
  const w = await p.evaluate(() => ({ open: shWorkOpen(), v3: !!document.querySelector("#shWork[data-v3]"), sv: svOn(), tabs: [...document.querySelectorAll("#svTabs [data-m], #svTabs button")].map(x => x.dataset.m || x.textContent.trim()), segs: (typeof svAsset !== "undefined" && svAsset && svAsset.segments || []).length, level: typeof svAsset !== "undefined" && svAsset && svAsset.level, tx: document.querySelectorAll("#svTx .sv-seg").length }));
  ok("4 · a Welding clip opens the same workspace (V3) with Studio V2 on", w.open && w.v3 && w.sv, JSON.stringify(w));
  ok("4b · its transcript is loaded from captions/<vid>.json and drawn line by line", w.segs > 3 && w.tx > 3, JSON.stringify(w));
  ok("4c · synchronised at word or sentence level", ["word", "sentence"].includes(w.level), w.level);
  await p.evaluate(() => { svSetMode("shadow"); shv3Sync() }); await sleep(500);
  ok("5 · Shadow mode runs on a Welding clip", await p.evaluate(() => svMode === "shadow" && !!document.getElementById("svSh")));
  await p.evaluate(() => { svSetMode("challenge"); shv3Sync() }); await sleep(600);
  ok("6 · Challenge mode runs on a Welding clip (same Challenge engine)", await p.evaluate(() => svMode === "challenge" && !!document.querySelector("#shV2 .sv-ch, #shV2 [class*='sv-ch']")));
  await p.evaluate(() => { svSetMode("apply"); shv3Sync() }); await sleep(400);
  const ap = await p.evaluate(() => ({ html: (document.querySelector(".sv-apply") || {}).innerHTML || "", ai: svApplyAIOn(), partner: svApplyPartnerOn(), lab: svApplyLabOn() }));
  ok("7 · Apply on Welding offers Phrase Lab — never Practice Partner or the General English coach", ap.lab && !ap.ai && !ap.partner && /svApplyLab/.test(ap.html) && !/svApplyPartner|svApplyAI\(/.test(ap.html), JSON.stringify({ ai: ap.ai, partner: ap.partner, lab: ap.lab }));
  const line = await p.evaluate(() => { if (typeof svAsset === "undefined" || !svAsset) return ""; const i = svPick >= 0 ? svPick : svLast.seg; return svAsset.segments[i >= 0 ? i : 0].text });
  await p.evaluate(() => svApplyLab()); await sleep(900);
  ok("7b · the line lands in the Executive Polish box", await p.evaluate(l => cur.v === "phrases" && (document.getElementById("exIn") || {}).value === l.slice(0, 300), line), line);
  ok("8 · Continue watching remembers the Welding clip on Welding", await p.evaluate(v => (lastClip() || {}).vid === v && !(S.lastClip && S.lastClip.vid === v), vid));
  ok("9 · no page errors on Welding Shadow", !errs.filter(e => !/network error/i.test(e)).length, errs.join(" | "));

  console.log("\n# the profession choice");
  await p.evaluate(() => go("shadow")); await sleep(1000);
  await p.evaluate(() => weldProfSheet()); await sleep(200);
  const sh = await p.evaluate(() => ({ groups: [...document.querySelectorAll(".wprof-g .shl-lbl")].map(x => x.textContent), n: document.querySelectorAll(".wprof-g .pf-row").length }));
  ok("10 · the sheet lists the ten professions in the four groups", sh.n === 10 && sh.groups.length === 4, JSON.stringify(sh));
  await p.evaluate(() => weldProfSet("ndt")); await sleep(800);
  const ndt = await p.evaluate(() => ({ p: S.profile.weldProf, chip: [...document.querySelectorAll(".shl-chip")][2].dataset.cat, first: [...document.querySelectorAll("#shLibFeed .shl-row[onclick*='shLibOpen']")].slice(0, 3).map(x => (x.getAttribute("onclick") || "").match(/'([^']+)'/)?.[1]) }));
  ok("10b · choosing NDT Technician reorders the library (chip and For you)", ndt.p === "ndt" && ndt.chip === "ndt" && ndt.first.every(v => WELD.videos[v] && WELD.videos[v].prof === "ndt"), JSON.stringify(ndt));
  await ctx.close();
}

console.log("\n# Practice · tool 4 = Practise text shadowing (the workplace lines)");
{
  const { ctx, p, errs } = await open("welding");
  await p.evaluate(() => go("practice")); await sleep(500);
  const tl = await p.evaluate(() => [...document.querySelectorAll("#v-practice .path-tool b")].map(x => x.textContent));
  ok("11 · Welding Practice: tool 4 is Practice text shadowing", tl[3] === "Practice text shadowing" && tl.length === 5, JSON.stringify(tl));
  await p.locator("#v-practice .path-tool").nth(0).click(); await sleep(900);
  ok("11b · tool 1 (Shadowing Studio) opens the video Shadow Studio", await p.evaluate(() => cur.v === "shadow" && !!document.querySelector("#shLib")));
  await p.evaluate(() => go("practice")); await sleep(400);
  await p.locator("#v-practice .path-tool").nth(3).click(); await sleep(900);
  const ln = await p.evaluate(() => ({ v: cur.v, lines: document.querySelectorAll("#v-shadow .sh-line").length, lib: !!document.querySelector("#shLib"), lit: [...document.querySelectorAll(".bnav-item")].filter(b => b.classList.contains("on")).map(b => b.dataset.v).join(), hash: location.hash }));
  ok("12 · tool 4 opens the workplace lines on their own page, under the Practice tab", ln.v === "lines" && ln.lines > 3 && !ln.lib && ln.lit === "practice" && ln.hash === "#lines", JSON.stringify(ln));
  await p.evaluate(() => shTab("trouble")); await sleep(300);
  ok("12b · its History / trouble words still work there", await p.evaluate(() => cur.v === "lines" && !!document.getElementById("tbBox")));
  await p.evaluate(() => shTab("create")); await sleep(300);
  await p.reload(); await sleep(2000);
  ok("12c · a refresh on #lines comes back to the lines", await p.evaluate(() => cur.v === "lines" && document.querySelectorAll("#v-shadow .sh-line").length > 3));
  ok("12d · no page errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# Home = Home V2 with Welding recommendations");
{
  const { ctx, p, errs } = await open("welding", { trade: "boilermaker" });
  await p.evaluate(() => go("home")); await sleep(1800);
  const h = await p.evaluate(() => ({ hx: !!document.querySelector("#v-home .hx"), dash: !!document.querySelector(".career-dashboard"), rows: [...document.querySelectorAll(".hx-row")].map(r => r.dataset.row + ":" + r.dataset.variant), dest: [...document.querySelectorAll(".hx-dcard")].map(x => x.dataset.dest), pp: !!document.querySelector("#v-home .pp-home, #v-home [class*='pp-home']"), online: !(document.getElementById("hxOnline") || { hidden: true }).hidden }));
  ok("13 · Welding Home uses the Home V2 architecture (hero, rows, Explore), not the Career Dashboard", h.hx && !h.dash && h.rows.length >= 1 && h.dest.length >= 6, JSON.stringify(h));
  ok("13b · no Practice Partner anywhere on Welding Home (card, Explore, online pill)", !h.pp && !h.dest.includes("partner") && !h.online, JSON.stringify(h));
  ok("13c · Explore on Welding: text shadowing and Workplace simulations", h.dest.includes("lines") && h.dest.includes("convo") && (await p.evaluate(() => document.querySelector('.hx-dcard[data-dest="convo"]').getAttribute("onclick"))).includes("simulation"));
  const hv = await shownVids(p);
  ok("14 · ISOLATION: every video on Welding Home is a Welding video", hv.length >= 3 && hv.every(v => WV.has(v)), hv.filter(v => !WV.has(v)));
  const recs = await p.evaluate(() => homeRecs().map(r => r.kind));
  ok("14b · the ranking never recommends a partner or the AI coach on Welding", !recs.some(k => /partner|ai_coach/.test(k)), recs);
  const lvl = await p.evaluate(() => { const r = _homeRows.find(x => x.id === "level"); return r ? { h: document.querySelector('.hx-row[data-row="level"] h3').textContent, v: r.items.map(i => i.vid) } : null });
  ok("15 · 'Recommended for your profession' carries Boilermaker clips", lvl && /profession/i.test(lvl.h) && lvl.v.filter(Boolean).length >= 1 && lvl.v.filter(Boolean).every(v => WELD.videos[v] && WELD.videos[v].prof === "boilermaker"), JSON.stringify(lvl && { h: lvl.h, p: lvl.v.map(v => WELD.videos[v] && WELD.videos[v].prof) }));
  ok("15b · no page errors on Welding Home", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# General English is unchanged, and sees nothing of Welding");
{
  const { ctx, p, errs } = await open("general-english", { extra: { lastClipA: { welding: { vid: Object.keys(WELD.videos)[0], title: "weld clip", start: 0, end: 0 } } } });
  await p.evaluate(() => go("home")); await sleep(1800);
  const hv = await shownVids(p);
  ok("16 · every video on General English Home is a General English video", hv.length >= 3 && hv.every(v => GV.has(v) || !WV.has(v)), hv.filter(v => WV.has(v)));
  await p.evaluate(() => go("shadow")); await sleep(1500);
  const g = await p.evaluate(() => ({ chips: [...document.querySelectorAll(".shl-chip")].map(x => x.dataset.cat), prof: !!document.querySelector(".wprof-pill"), cont: (document.querySelector(".shl-cont b") || {}).textContent || "" }));
  const sv = await shownVids(p);
  ok("17 · General English Shadow keeps its own categories and no profession row", g.chips.includes("meetings") && !g.chips.some(c => WELD.categories.some(k => k.id === c)) && !g.prof, JSON.stringify(g));
  ok("17b · no Welding video on the General English Shadow page, and no Welding 'Continue'", sv.every(v => !WV.has(v)) && g.cont !== "weld clip", sv.filter(v => WV.has(v)));
  await p.evaluate(() => go("practice")); await sleep(400);
  const tl = await p.evaluate(() => [...document.querySelectorAll("#v-practice .path-tool b")].map(x => x.textContent));
  ok("18 · General English Practice has no text shadowing tool", !tl.includes("Practice text shadowing"), JSON.stringify(tl));
  ok("18b · no page errors", !errs.filter(e => !/network error/i.test(e)).length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# flag off (production default): Welding exactly as before");
{
  const { ctx, p, errs } = await open("welding", { flags: { welding_studio_enabled: false } });
  await p.evaluate(() => go("shadow")); await sleep(1200);
  ok("19 · without the flag, Welding Shadow is still the workplace lines", await p.evaluate(() => !document.querySelector("#shLib") && document.querySelectorAll("#v-shadow .sh-line").length > 3));
  await p.evaluate(() => go("home")); await sleep(1000);
  ok("19b · …and Welding Home is still the Career Dashboard", await p.evaluate(() => !!document.querySelector(".career-dashboard") && !document.querySelector(".hx")));
  ok("19c · …and no Welding catalogue is loaded", await p.evaluate(() => _shCat === null && !weldStudioOn()));
  ok("19d · no page errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# phones, desktop, French, Arabic (RTL)");
for (const [w, h, lang] of [[375, 812, "en"], [390, 844, "fr"], [400, 860, "en"], [428, 926, "ar"], [430, 932, "en"], [1280, 900, "en"]]) {
  const { ctx, p, errs } = await open("welding", { width: w, height: h, lang });
  const o = {};
  for (const v of ["home", "shadow", "lines", "practice"]) { await p.evaluate(v => go(v), v); await sleep(v === "home" || v === "shadow" ? 1500 : 600); o[v] = await overflow(p); }
  if (w === 390) await p.screenshot({ path: "/tmp/claude-501/shots/ws-fr-shadow.png" });
  await p.evaluate(() => go("shadow")); await sleep(1200);
  const txt = await p.evaluate(() => ({ dir: document.documentElement.dir, chip: ([...document.querySelectorAll(".shl-chip")][2] || {}).textContent }));
  ok(`20 · ${w}px ${lang}: no horizontal overflow on Home / Shadow / lines / Practice`, Object.values(o).every(x => x <= 1), JSON.stringify(o));
  if (lang === "fr") ok("20b · French: professions are translated", txt.chip && txt.chip.trim() === "Soudeur", txt.chip);
  if (lang === "ar") ok("20c · Arabic: RTL, professions translated", txt.dir === "rtl" && /[؀-ۿ]/.test(txt.chip || ""), JSON.stringify(txt));
  ok(`20d · ${w}px ${lang}: no page errors`, !errs.length, errs.join(" | "));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
