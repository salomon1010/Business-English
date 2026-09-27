/* Home "Because you…" rows (owner, 27 Sep 2026): personalised rows built by the nudge engine from what
   the learner actually did, every card a deep link into the exact activity, General English only.
   Run: cd tests && node home-rows.mjs        (BASE=… for another tree)
   Chromium, iPhone 13 (+ one desktop context). Seeds are real catalogue clips; the SDK/Workers are stubbed. */
import { chromium, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises"; import fs from "node:fs";
const root = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8151);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const cat = JSON.parse(fs.readFileSync(root + "catalogue/general.json", "utf8")); const cats = {}; cat.categories.forEach(c => c.vids.forEach(v => cats[v] = cats[v] || c.id));
const pick = (re, id) => Object.keys(cat.videos).find(v => cats[v] === id && re.test(cat.videos[v].title) && cat.videos[v].cap === "human");
const CH = pick(/meeting/i, "meetings"), SH = pick(/pronunc|accent|sound/i, "skills"); const chT = cat.videos[CH].title, shT = cat.videos[SH].title;
const b = await chromium.launch();
const seed = (o) => ([CH, chT, SH, shT, o]) => { if (sessionStorage.getItem("s")) return; sessionStorage.setItem("s", 1); localStorage.setItem("be_flags", JSON.stringify({ home_v2_enabled: o.flag !== false })); localStorage.setItem("be_theme", "dark");
  const day = 86400000, now = Date.now(), d = n => new Date(now - n * day).toISOString().slice(0, 10); const dates = [0, 1, 2, 3, 5, 6].map(d); const dayLog = {}; dates.forEach(x => dayLog[x] = 1);
  const S = { profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: o.area || "general-english" }, fnd: { "general-english": { placed: "full", finished: true, done: {}, day: 1 }, welding: { placed: "full", finished: true, done: {}, day: 1 } }, days: {}, dates, dayLog, dayLogA: { "general-english": dayLog }, steps: {}, scores: {}, notes: {}, vocab: {}, backupAsked: 1, rmSeen: now, lastSeen: now };
  if (o.history) { const vocab = {}; ["stakeholder", "leverage", "deliverable", "milestone"].forEach((w, i) => vocab[w] = { ts: now - i * day, reps: 1, due: now - day, tk: ["general-english"] }); S.vocab = vocab;
    S.days = { w1Mon: true, w1Tue: true, w1Wed: true, w1Thu: true, w1Fri: true, w1Sat: true, w1Sun: true };
    S.chHistA = { "general-english": [{ kind: "shadow", ts: now - 3600000, vid: SH, title: shT, text: "x", heard: "x" }, { kind: "challenge", ts: now - 2 * day, vid: CH, title: chT, seg: "s1", text: "x", n: 1, level: 2, rung: "sync", verdict: "pass", coverage: 0.9, ok: 9, total: 10, pass: true, heard: "x", issues: [], dims: { words: "good", pron: "good", fluency: "good", timing: "na", rhythm: "na" }, pronMode: null, ctx: null, drills: [] }] };
    S.troubleA = { "general-english": { thorough: { n: 3, ts: now }, schedule: { n: 2, ts: now } } };
    S.phMasterA = { "general-english": { p0: 1, p1: 1, p2: 1, p3: 1 } }; }
  localStorage.setItem("be12_v1", JSON.stringify(S)); };
const open = async (o, desktop) => {
  const ctx = await b.newContext(desktop ? { viewport: { width: 1280, height: 900 }, serviceWorkers: "block" } : { ...devices["iPhone 13"], serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|be-mail|gstatic/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  /* thumbnails and channel avatars: a 1×1 PNG (the avatars are ORB-blocked in headless Chromium and raise "A network error occurred") */
  await ctx.route(u => /i\.ytimg\.com|yt3\.googleusercontent\.com/.test(u.href), r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") }));
  await ctx.addInitScript(seed(o), [CH, chT, SH, shT, o]);
  /* "A network error occurred." is raised by the Shadow workspace's third-party media in headless Chromium
     whenever a clip is opened — verified on the unmodified base (f026b457) through nudgeGo — so it is filtered */
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => { if (e.message !== "A network error occurred.") p.errs.push(e.message); });
  await p.goto(BASE + "/index.html#home"); await sleep(2500);
  await p.evaluate(() => { window.__ev = []; window.track = (n, pr) => __ev.push([n, pr || {}]); try { homeRecImpress._seen = {} } catch (e) {} document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#syncNudge").forEach(e => e.remove()); go("home"); }); await sleep(2500);
  return { ctx, p };
};
const rows = p => p.evaluate(() => [...document.querySelectorAll(".hx-row")].map(r => ({ id: r.dataset.row, h: r.querySelector("h3").textContent, sub: r.querySelector("p").textContent, cards: [...r.querySelectorAll(".hx-rcard")].map(c => ({ type: c.dataset.type, vid: c.dataset.vid || null, title: c.querySelector("b").textContent, line: c.querySelector("small").textContent, img: !!c.querySelector("img"), lazy: c.querySelector("img") ? c.querySelector("img").getAttribute("loading") : null, tag: !!c.querySelector(".hx-rtag"), h: c.getBoundingClientRect().height })), scroll: (() => { const s = r.querySelector(".hx-row-scroll"); return { w: s.scrollWidth > s.clientWidth, display: getComputedStyle(s).display }; })() })));

/* ---------- a learner with history: three truthful rows ---------- */
{ const { ctx, p } = await open({ history: true });
  const R = await rows(p);
  ok("1 · with a passed Challenge, a recorded take and trouble words on record, Home shows three rows, in that order, each headed 'Because you…'", R.length === 3 && R.map(r => r.id).join() === "challenge_done,shadowed,trouble" && R.every(r => /^Because you/.test(r.h)), JSON.stringify(R.map(r => [r.id, r.h])));
  const ct = chT.replace(/^[\p{Extended_Pictographic}\s]+/u, "").slice(0, 24), st = shT.replace(/^[\p{Extended_Pictographic}\s]+/u, "").slice(0, 24);
  ok("2 · the headings quote the exact clips from the learner's own history — the Challenge passed and the take recorded (truthful, never invented)", R[0].h.includes(ct) && R[1].h.includes(st) && /shadowed/.test(R[1].h) && /thorough|schedule/.test(R[2].h), JSON.stringify([R[0].h, R[1].h, R[2].h]));
  ok("3 · every card: a title, a type line, a lazy thumbnail for a clip, the Challenge tag on Challenge cards, 'YouTube' on external clips, at most three per row", R.every(r => r.cards.length >= 2 && r.cards.length <= 3 && r.cards.every(c => c.title && c.line && (!c.vid || (c.img && c.lazy === "lazy" && /YouTube/.test(c.line))))) && R[0].cards.every(c => c.type === "challenge" && c.tag && c.vid), JSON.stringify(R.map(r => r.cards)));
  ok("4 · the rows never offer a clip the learner already has (the seeds themselves), and no clip twice across the rows", (() => { const v = R.flatMap(r => r.cards.map(c => c.vid).filter(Boolean)); return !v.includes(CH) && !v.includes(SH) && new Set(v).size === v.length; })());
  const sw = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  ok("5 · on the phone each row swipes sideways (its own scroller), and the page itself has no sideways scroll", R.every(r => r.scroll.w) && sw, JSON.stringify(R.map(r => r.scroll)));
  ok("6 · cards are touch-sized (≥ 120 px tall) and are real buttons", R.every(r => r.cards.every(c => c.h >= 120)) && await p.evaluate(() => [...document.querySelectorAll(".hx-rcard")].every(e => e.tagName === "BUTTON")));
  const hero = await p.evaluate(() => ({ kind: document.querySelector(".hx").dataset.kind, best: (NudgeEngine.best(nudgeSignals()) || {}).kind }));
  ok("7 · the hero is still the engine's own first choice — the rows support it, they do not replace it (rows sit after the hero, before Explore)", hero.kind === hero.best && await p.evaluate(() => { const a = document.querySelector(".hx"), r = document.getElementById("hxRows"), d = document.querySelector(".hx-dest"); return a && r && d && a.compareDocumentPosition(r) & 4 && r.compareDocumentPosition(d) & 4; }), JSON.stringify(hero));
  const imp = await p.evaluate(() => __ev.filter(e => e[0] === "rec_impression").map(e => e[1]));
  ok("8 · analytics: one rec_impression per row, carrying the row kind, its reason, the item count, track = general-english, week and day — nothing else", imp.length === 3 && imp.map(x => x.kind).join() === "challenge_done,shadowed,trouble" && imp.every(x => x.track === "general-english" && x.week === "2" && x.day === "Mon" && /^\d$/.test(x.n) && x.reason && Object.keys(x).sort().join() === "day,kind,n,reason,track,week"), JSON.stringify(imp));
  /* tap the first Challenge card */
  const vid = R[0].cards[0].vid;
  await p.click(`.hx-row[data-row="challenge_done"] .hx-rcard >> nth=0`); await sleep(3000);
  const after = await p.evaluate(() => ({ v: cur && cur.v, clip: shClip && shClip.vid, work: !!document.querySelector(".sh-work") && getComputedStyle(document.querySelector(".sh-work")).display !== "none", opened: S.rec && S.rec.opened && S.rec.opened.id }));
  ok("9 · tapping a Challenge card opens Shadow Studio on that exact clip (the workspace, not the library), through the notifications' own resolver", after.v === "shadow" && after.clip === vid && after.work && after.opened === "challenge_done", JSON.stringify({ vid, after }));
  const opn = await p.evaluate(() => __ev.filter(e => e[0] === "rec_open").map(e => e[1]));
  ok("10 · … and sends rec_open with the row kind and the card type (never the clip id)", opn.length === 1 && opn[0].kind === "challenge_done" && opn[0].to === "challenge" && !JSON.stringify(opn[0]).includes(vid), JSON.stringify(opn));
  await p.evaluate(() => { try { shCloseWork() } catch (e) {} markPracticed(); });
  const st2 = await p.evaluate(() => __ev.filter(e => e[0] === "rec_started").map(e => e[1]));
  ok("11 · the first practice action after the tap sends rec_started once", st2.length === 1 && st2[0].kind === "challenge_done" && st2[0].to === "challenge", JSON.stringify(st2));
  await p.evaluate(() => { markPracticed(); go("home"); }); await sleep(2000);
  const R2 = await rows(p);
  ok("12 · back on Home: the same rows in the same order; the clip just opened is now 'seen' and no longer offered; no duplicates; rec_started not repeated", R2.map(r => r.id).join() === R.map(r => r.id).join() && !R2.some(r => r.cards.some(c => c.vid === vid)) && (() => { const v = R2.flatMap(r => r.cards.map(c => c.vid).filter(Boolean)); return new Set(v).size === v.length; })() && (await p.evaluate(() => __ev.filter(e => e[0] === "rec_started").length)) === 1, JSON.stringify(R2.map(r => [r.id, r.cards.map(c => c.vid)])));
  /* trouble words → Shadow's trouble tab; words due → Practice's review */
  await p.click(`.hx-row[data-row="trouble"] .hx-rcard[data-type="trouble"]`); await sleep(1500);
  const tr = await p.evaluate(() => ({ v: cur && cur.v, tab: typeof _shTab !== "undefined" ? _shTab : null, box: !!document.getElementById("tbBox") }));
  ok("13 · the trouble-words card lands on Shadow's Trouble words tab, on the words themselves", tr.v === "shadow" && tr.tab === "trouble" && tr.box, JSON.stringify(tr));
  await p.evaluate(() => go("home")); await sleep(1500);
  await p.click(`.hx-row[data-row="trouble"] .hx-rcard[data-type="words"]`); await sleep(1500);
  const wd = await p.evaluate(() => ({ v: cur && cur.v, tab: typeof _pracTab !== "undefined" ? _pracTab : null }));
  ok("14 · the words-due card opens Practice on the words ready for review", wd.v === "practice" && wd.tab === "ready", JSON.stringify(wd));
  /* Not now */
  await p.evaluate(() => go("home")); await sleep(1500);
  await p.evaluate(() => document.querySelector('.hx-row[data-row="shadowed"] .hx-row-hide').click()); await sleep(400);
  const hid = await p.evaluate(() => ({ rows: [...document.querySelectorAll(".hx-row")].map(r => r.dataset.row), ev: __ev.filter(e => e[0] === "rec_dismissed").map(e => e[1]), keep: !!(S.recHide && S.recHide.shadowed) }));
  await p.evaluate(() => go("shadow")); await sleep(300); await p.evaluate(() => go("home")); await sleep(1800);
  const hid2 = await p.evaluate(() => [...document.querySelectorAll(".hx-row")].map(r => r.dataset.row));
  ok("15 · 'Not now' hides that row at once, remembers it (a week), sends rec_dismissed — and the row stays away on the next visit", hid.rows.join() === "challenge_done,trouble" && hid.ev.length === 1 && hid.ev[0].kind === "shadowed" && hid.keep && hid2.join() === "challenge_done,trouble", JSON.stringify({ hid, hid2 }));
  ok("16 · no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
/* ---------- a brand-new learner: discovery, never 'because you' ---------- */
{ const { ctx, p } = await open({ history: false });
  const R = await rows(p);
  ok("17 · a new learner with no history gets one 'Start here' row for Week 1 — no 'Because you' anywhere on Home", R.length === 1 && R[0].id === "start" && /Start here/.test(R[0].h) && !(await p.evaluate(() => /Because you/.test(document.getElementById("v-home").textContent))), JSON.stringify(R.map(r => [r.id, r.h])));
  ok("18 · … its cards: the Week 1 Monday session first, then a first clip to shadow (a real catalogue starter)", R[0].cards[0].type === "session" && /Week 1/.test(R[0].cards[0].line) && R[0].cards.slice(1).every(c => c.vid && c.type === "video"), JSON.stringify(R[0].cards));
  await p.click(`.hx-row[data-row="start"] .hx-rcard[data-type="session"]`); await sleep(1500);
  const sv = await p.evaluate(() => ({ v: cur && cur.v, a: cur && [cur.arg1, cur.arg2] }));
  ok("19 · tapping the session card opens that exact session (Week 1, Monday)", sv.v === "session" && String(sv.a[0]) === "1" && sv.a[1] === "Mon", JSON.stringify(sv));
  ok("20 · no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
/* ---------- Welding: nothing of this ---------- */
{ const { ctx, p } = await open({ history: true, area: "welding" });
  const w = await p.evaluate(() => ({ rows: document.querySelectorAll(".hx-row").length, txt: /Because you|Start here/.test(document.getElementById("v-home").textContent), ev: __ev.filter(e => /^rec_/.test(e[0])).length, engine: NudgeEngine.rows(nudgeSignals(), homeContent()).length }));
  ok("21 · Welding: no rows, no 'Because you', no rec_* event, and the engine itself returns nothing for the area (not only the UI)", w.rows === 0 && !w.txt && w.ev === 0 && w.engine === 0, JSON.stringify(w));
  ok("22 · Welding: no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
/* ---------- flag off: today's Home ---------- */
{ const { ctx, p } = await open({ history: true, flag: false });
  ok("23 · home_v2_enabled off (production today): no rows, the existing Home unchanged", await p.evaluate(() => document.querySelectorAll(".hx-row,.hx").length === 0 && !!document.querySelector(".today-card")));
  await ctx.close(); }
/* ---------- desktop ---------- */
{ const { ctx, p } = await open({ history: true }, true);
  const R = await rows(p);
  ok("24 · desktop: the same rows as a three-up grid (no sideways scroller), and no sideways page scroll", R.length === 3 && R.every(r => r.scroll.display === "grid" && !r.scroll.w) && await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), JSON.stringify(R.map(r => r.scroll)));
  ok("25 · desktop: no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
