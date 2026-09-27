/* Home hero highlight reel (owner, 27 Sep 2026): six video slides at the top of Home, each one opens its clip —
   and every card without a video shows a screenshot of the page it opens.
   Run: cd tests && node home-highlights.mjs        (BASE=… for another tree)
   WebKit (iPhone Safari's engine), iPhone 13, flag home_v2_enabled. Thumbnails are real ytimg URLs; the
   partner / push / events Workers are stood in. */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8147);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 600)}`); };
const b = await webkit.launch();
const today = new Date().toISOString().slice(0, 10);
const seed = (o = {}) => ({ profile: { name: "Tester", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english", tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true } }, days: {}, dates: [today], dayLog: { [today]: 1 }, dayLogA: { "general-english": { [today]: 1 } }, steps: {}, scores: {}, notes: {}, vocab: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now(), ...o });
const THUMB = /i\.ytimg\.com\/vi\/([A-Za-z0-9_-]{11})\//;
async function open(state, opts = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block", reducedMotion: "reduce" });   /* reduce: no automatic rotation, so the slide on screen is the one the test chose */
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|youtube\.com/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  if (opts.noCatalogue) await ctx.route(u => /catalogue\/general\.json/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const thumbs = new Set(); ctx.on("request", r => { const m = r.url().match(THUMB); if (m && /maxresdefault/.test(r.url())) thumbs.add(m[1]); });
  await ctx.addInitScript(s => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", JSON.stringify({ home_v2_enabled: true, practice_partner_enabled: true })); } }, JSON.stringify(seed(state)));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => { if (!/A network error occurred/.test(e.message)) errs.push(e.message); });
  await p.goto(BASE + "/index.html"); await sleep(3200);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p, errs, thumbs };
}
const reel = p => p.evaluate(() => [...document.querySelectorAll(".hx-slide")].map(x => ({ vid: x.dataset.vid, tag: x.dataset.tag, title: x.dataset.title, meta: x.dataset.meta, on: x.classList.contains("on"), src: !!x.getAttribute("src"), isNew: !!x.dataset.new })));
const cap = p => p.evaluate(() => { const o = document.getElementById("hxOpen"); return { hidden: o.hidden, vid: o.dataset.vid, tag: o.querySelector(".hx-ctag").innerText, title: o.querySelector("b").innerText, meta: o.querySelector("small").innerText, aria: o.getAttribute("aria-label"), tagName: o.tagName }; });
const swipe = (p, dx) => p.evaluate(dx => { const el = document.getElementById("hxMedia"), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const ev = (type, cx) => { const e = new Event(type, { bubbles: true }); const t = [{ clientX: cx, clientY: y, identifier: 1, target: el }]; Object.defineProperty(e, "touches", { value: type === "touchend" ? [] : t }); Object.defineProperty(e, "changedTouches", { value: t }); el.dispatchEvent(e); };
  ev("touchstart", x); ev("touchend", x + dx); }, dx);

console.log("\n# six highlight slides, each one a video");
{ const { ctx, p, errs, thumbs } = await open({});
  const r = await reel(p);
  const cat = await p.evaluate(v => v.map(x => !!(_shCat && _shCat.videos[x])), r.map(x => x.vid));
  ok("1 · six slides, six different library videos, six dots", r.length === 6 && new Set(r.map(x => x.vid)).size === 6 && cat.every(Boolean) && await p.evaluate(() => document.querySelectorAll("#hxDots button").length) === 6, JSON.stringify({ r, cat }));
  ok("2 · the first slide is the clip for the next step, tagged 'Fits your plan'", r[0].tag === "Fits your plan" && r[0].on, JSON.stringify(r[0]));
  const film = r.filter(x => x.tag === "Film lesson"), cats = r.slice(1).filter(x => x.tag !== "Film lesson").map(x => x.tag);
  ok("3 · exactly one film lesson, and the other highlights are one per category (no subject twice)", film.length === 1 && /learn english with|disney|mario|tv series/i.test(film[0].title) && cats.length === 4 && new Set(cats).size === 4 && cats.every(x => /Meetings|Presentations|Interviews|Everyday|Learning skills/.test(x)), JSON.stringify(r.map(x => x.tag)));
  const rowVids = await p.evaluate(() => [...document.querySelectorAll(".hx-rcard[data-vid]")].map(x => x.dataset.vid));
  ok("4 · no highlight repeats a clip already shown in the 'Because you…' rows below", r.slice(1).every(x => !rowVids.includes(x.vid)), JSON.stringify({ rowVids, reel: r.map(x => x.vid) }));
  const c = await cap(p);
  ok("5 · the picture is one real button whose caption names the clip on screen: label, title, channel · minutes, and a spoken label", c.tagName === "BUTTON" && !c.hidden && c.vid === r[0].vid && c.title === r[0].title && /Fits your plan/i.test(c.tag) && / min$/.test(c.meta) && c.meta === r[0].meta && c.aria === "Open the video: " + r[0].title, JSON.stringify(c));
  const box = await p.evaluate(() => { const o = document.getElementById("hxOpen").getBoundingClientRect(), m = document.getElementById("hxMedia").getBoundingClientRect(); return { ow: Math.round(o.width), mw: Math.round(m.width), oh: Math.round(o.height), mh: Math.round(m.height) }; });
  ok("6 · the whole picture is the tap target, not a small link", box.ow === box.mw && box.oh === box.mh, JSON.stringify(box));
  /* owner, 27 Sep 2026: the caption is ONE line on the picture — no panel, a small play at the end of the line */
  const line = await p.evaluate(() => { const c = document.querySelector("#hxOpen .hx-cap"), b = c.querySelector("b"), pl = document.querySelector("#hxOpen .hx-cplay"), m = document.getElementById("hxMedia").getBoundingClientRect(), cs = getComputedStyle(c), cr = c.getBoundingClientRect(), pr = pl.getBoundingClientRect(), br = b.getBoundingClientRect();
    return { capH: Math.round(cr.height), titleH: Math.round(br.height), bg: cs.backgroundColor, blur: cs.backdropFilter || cs.webkitBackdropFilter || "none", playW: Math.round(pr.width), sameRow: Math.abs((pr.top + pr.bottom) / 2 - (cr.top + cr.bottom) / 2) < 3, playLast: pr.left >= br.right, coverPct: Math.round(100 * cr.height / m.height), metaShown: getComputedStyle(c.querySelector("small")).display !== "none" }; });
  ok("6b · the caption is one line, transparent, with a small play at the end of that line", line.capH <= 30 && line.titleH <= 20 && /rgba\(0, 0, 0, 0\)|transparent/.test(line.bg) && line.blur === "none" && line.playW <= 30 && line.sameRow && line.playLast && !line.metaShown && line.coverPct <= 16, JSON.stringify(line));
  ok("7 · data: only the slide on screen and the next one load their thumbnails at first", r.filter(x => x.src).length === 2 && thumbs.size === 2 && thumbs.has(r[0].vid) && thumbs.has(r[1].vid), JSON.stringify({ src: r.map(x => x.src), thumbs: [...thumbs] }));
  await p.click("#hxDots button:nth-child(3)"); await sleep(400);
  const c3 = await cap(p), r3 = await reel(p);
  ok("8 · a dot brings up its slide, the caption follows it, and the slide after it starts loading", c3.vid === r[2].vid && c3.title === r[2].title && r3[2].on && r3[3].src, JSON.stringify({ c3, src: r3.map(x => x.src) }));
  await swipe(p, -120); await sleep(300);
  const afterL = await cap(p);
  await swipe(p, 120); await sleep(300);
  const afterR = await cap(p);
  ok("9 · swiping left shows the next clip, swiping right the previous one", afterL.vid === r[3].vid && afterR.vid === r[2].vid, JSON.stringify({ afterL: afterL.vid, afterR: afterR.vid, want: [r[3].vid, r[2].vid] }));
  await p.evaluate(() => hxOpenCur()); await sleep(300);
  ok("10 · … and the tap that ends a swipe does not open a video by accident", await p.evaluate(() => cur.v === "home"), await p.evaluate(() => cur.v));
  await sleep(500);
  await p.click("#hxOpen", { position: { x: 60, y: 90 } }); await sleep(1500);
  const opened = await p.evaluate(() => ({ v: cur.v, url: (document.getElementById("shUrl") || {}).value || "", work: !!document.querySelector(".sh-work") && getComputedStyle(document.querySelector(".sh-work")).display !== "none" }));
  ok("11 · tapping the picture opens that exact clip in the Shadow Studio", opened.v === "shadow" && opened.url.endsWith("v=" + r[2].vid), JSON.stringify(opened));
  ok("12 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# the reel changes with the days and with what the learner has done");
{ const { ctx, p, errs } = await open({});
  const d = await p.evaluate(() => { const top = homeDoneCard(), a = homeHighlights(top, _homeRows, 1000).map(x => x.vid), a2 = homeHighlights(top, _homeRows, 1000).map(x => x.vid), n = homeHighlights(top, _homeRows, 1001).map(x => x.vid);
    return { a, a2, n, same: a.filter(v => n.includes(v)).length }; });
  ok("13 · the same day draws the same reel; the next day draws a different one (the first slide stays the plan's clip)", JSON.stringify(d.a) === JSON.stringify(d.a2) && d.a[0] === d.n[0] && d.same < 6, JSON.stringify(d));
  const r = await reel(p), done = r.slice(1).map(x => ({ vid: x.vid, start: 0, end: 10, title: x.title, ts: Date.now() }));
  await p.evaluate(c => { aList("clips").push(...c); save(); go("home"); }, done); await sleep(800);
  const r2 = await reel(p);
  ok("14 · clips the learner has already shadowed give way to ones they have not", r2.length === 6 && r2.slice(1).every(x => !done.some(y => y.vid === x.vid)), JSON.stringify({ before: r.map(x => x.vid), after: r2.map(x => x.vid) }));
  const nw = await p.evaluate(() => [...document.querySelectorAll(".hx-slide")].map(x => ({ up: (_shCat.videos[x.dataset.vid] || {}).up, n: !!x.dataset.new })));
  ok("15 · 'New' marks only clips uploaded in the last three weeks", nw.every(x => x.n === (Date.now() - Date.parse(x.up) < 21 * 864e5)), JSON.stringify(nw));
  ok("16 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# language");
{ const { ctx, p, errs } = await open({ profile: { name: "Awa", lang: "fr", ts: 1 } });
  await p.evaluate(async () => { await setLang("fr"); go("home"); }); await sleep(1200);
  const r = await reel(p), c = await cap(p);
  ok("17 · French: the labels and the spoken label are French", r[0].tag === "Adapté à votre plan" && r.some(x => x.tag === "Leçon de film") && /^Ouvrir la vidéo : /.test(c.aria), JSON.stringify({ tags: r.map(x => x.tag), aria: c.aria }));
  ok("18 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

console.log("\n# no video, no empty box: every card without a clip shows the page it opens");
const cards = p => p.evaluate(async () => {   /* the pictures are lazy: bring each card on screen (rows scroll sideways) before asking */
  for (const c of document.querySelectorAll(".hx-rcard,.hx-dcard,.hx-feat")) { c.scrollIntoView({ block: "center", inline: "center" }); await new Promise(z => setTimeout(z, 250)); }
  await new Promise(z => setTimeout(z, 1500));
  const one = c => { const i = c.querySelector("img"); return { type: c.dataset.type || c.dataset.dest, src: i ? i.getAttribute("src") : null, loaded: !!(i && i.complete && i.naturalWidth > 0) }; };
  return { rows: [...document.querySelectorAll(".hx-rcard")].map(one), explore: [...document.querySelectorAll(".hx-dcard,.hx-feat")].map(one), empty: document.querySelectorAll(".hx-rimg.none").length }; });
{ const { ctx, p, errs } = await open({ dates: [], dayLog: {}, dayLogA: {} });
  const c = await cards(p), ses = c.rows.find(x => x.type === "session");
  ok("19 · a new learner's 'Start here' lesson card shows the lesson page (no empty box)", ses && ses.src === "home-shots/session.jpg" && ses.loaded && c.empty === 0, JSON.stringify(c.rows));
  const ph = c.explore.find(x => x.type === "phrases"), pp = c.explore.find(x => x.type === "partner");
  ok("20 · Explore: Phrase Lab and Practice Partner show screenshots of those pages", ph && ph.src === "home-shots/phrases.jpg" && ph.loaded && pp && pp.src === "home-shots/partner.jpg" && pp.loaded, JSON.stringify(c.explore));
  ok("21 · every Explore card has a picture that loaded", c.explore.length >= 5 && c.explore.every(x => x.src && x.loaded), JSON.stringify(c.explore));
  ok("22 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }
{ const words = {}; ["negotiate", "deadline", "proposal", "agenda", "quarterly"].forEach((w, i) => words[w] = { ts: Date.now() - i, reps: 1, due: Date.now() - 1000, tk: ["general-english"] });
  const { ctx, p, errs } = await open({ vocab: words, troubleA: { "general-english": { thorough: 2, schedule: 1 } } });
  const c = await cards(p), tr = c.rows.find(x => x.type === "trouble"), wd = c.rows.find(x => x.type === "words");
  ok("23 · trouble words and words due: their cards show the trouble-words list and the word list", tr && tr.src === "home-shots/trouble.jpg" && tr.loaded && wd && wd.src === "home-shots/vocab.jpg" && wd.loaded && c.empty === 0, JSON.stringify(c.rows));
  ok("24 · every card in the 'Because you…' rows has a picture that loaded", c.rows.length && c.rows.every(x => x.src && x.loaded), JSON.stringify(c.rows));
  const shots = await p.evaluate(async () => { const r = {}; for (const k of ["session", "vocab", "trouble", "phrases", "partner", "ai"]) { const i = new Image(); i.src = `home-shots/${k}.jpg`; await i.decode().catch(() => {}); r[k] = [i.naturalWidth, i.naturalHeight]; } return r; });
  ok("25 · all six screenshots exist and are 16:9", Object.values(shots).every(([w, h]) => w >= 700 && Math.abs(w / h - 16 / 9) < .02), JSON.stringify(shots));
  ok("26 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }
{ const { ctx, p, errs } = await open({}, { noCatalogue: true });
  const h = await p.evaluate(() => ({ slides: [...document.querySelectorAll(".hx-slide")].map(x => x.getAttribute("src")), empty: document.getElementById("hxMedia").classList.contains("empty"), open: document.getElementById("hxOpen").hidden }));
  ok("27 · the video list cannot be reached: the top picture is the page the next step opens, not an empty gradient (and nothing pretends to be a video)", h.slides.length === 1 && h.slides[0] === "home-shots/session.jpg" && !h.empty && h.open, JSON.stringify(h));
  ok("28 · no JavaScript errors", !errs.length, errs.join(" | ")); await ctx.close(); }

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
