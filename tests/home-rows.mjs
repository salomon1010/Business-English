/* Home "Because you…" — one primary recommendation + up to EIGHT conditional rows (owner, 27 Sep 2026).
   Every row rests on real learner evidence, every card is a specific piece of content with its exact
   deep link, General English only.
   Run: cd tests && node home-rows.mjs        (BASE=… for another tree, PORT=… for the local server, BROWSER=webkit for Safari's engine)
   Chromium, iPhone 13 (+ one desktop context). Seeds are real catalogue clips; the Workers are stubbed. */
import { chromium, webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises"; import fs from "node:fs";
const root = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8157);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 700)}`); };
const cat = JSON.parse(fs.readFileSync(root + "catalogue/general.json", "utf8"));
const V = { W: "S0kfnpgY-Gs", SH: "-5q6tNovay8", CF: "mmfo9spNaWA" }; const T = k => cat.videos[V[k]].title;
/* billing_enabled is pinned OFF so the rows render their CARDS. Without Premium a row shows its
   heading and one offer bar instead (homeRowsHTML), which is premium-boundary.mjs's subject, not
   this file's — and on staging, where FLAGS_STAGING turns billing on, this suite would otherwise
   be testing the locked rendering by accident. */
const FLAGS = { billing_enabled: false, home_v2_enabled: true, welding_studio_enabled: false /* pinned off: these rows are the General English engine; Welding with the studio is tests/welding-studio.mjs */, shadow_studio_v2_enabled: true, shadow_challenge_enabled: true, shadow_word_timing_enabled: true, shadow_library_enabled: true };
const ENGINE = process.env.BROWSER === "webkit" ? webkit : chromium; console.log(`  engine: ${process.env.BROWSER || "chromium"} · ${BASE}`);
const b = await ENGINE.launch();
const seed = ([V, T, o, FLAGS]) => { if (sessionStorage.getItem("s")) return; sessionStorage.setItem("s", 1); localStorage.setItem("be_flags", JSON.stringify(o.flag === false ? { home_v2_enabled: false } : FLAGS)); localStorage.setItem("be_theme", "dark");
  const GE = "general-english", day = 86400000, H = 3600000, now = Date.now(), d = n => new Date(now - n * day).toISOString().slice(0, 10);
  const dates = (!o.history ? [] : o.away ? [o.away, o.away + 1, o.away + 2] : [0, 1, 2, 3]).map(d); const dayLog = {}; dates.forEach(x => dayLog[x] = 1);
  const S = { profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: o.area || GE }, fnd: { [GE]: { placed: "full", finished: true, done: {}, day: 1 }, welding: { placed: "full", finished: true, done: {}, day: 1 } }, days: {}, dates, dayLog, dayLogA: { [GE]: dayLog, welding: dayLog }, steps: {}, scores: {}, notes: {}, vocab: {}, convos: [], backupAsked: 1, rmSeen: now, lastSeen: now };
  if (o.history) { const ago = o.away ? o.away * day : 0;
    ["leverage", "milestone", "deliverable"].forEach((w, i) => S.vocab[w] = { ts: now - ago - i * H, reps: 1, due: now - day, tk: [GE] });
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(x => S.days["w1" + x] = true);
    const dims = { words: "fair", pron: "fair", fluency: "good", timing: "na", rhythm: "na" }, ch = (ts) => ({ kind: "challenge", ts, vid: V.CF, title: T.CF, seg: "s1", text: "x", n: 1, level: 2, rung: "gate", verdict: "retry", coverage: 0.5, ok: 5, total: 10, pass: false, heard: "x", issues: [{ type: "mispron", text: "schedule" }], dims, pronMode: null, ctx: null, drills: [] });
    S.chHistA = { [GE]: [{ kind: "shadow", ts: now - ago - H, vid: V.SH, title: T.SH, text: "x", heard: "x", score: 71, wpm: 120, fillers: 1, fix: ["thorough", "status"], ctx: null }, ch(now - ago - day), ch(now - ago - day - H)] };
    S.watchedA = { [GE]: [{ vid: V.W, title: T.W, ts: now - ago - 2 * H, secs: 240 }] };
    S.troubleA = { [GE]: { thorough: 3, schedule: 2 } };
    S.convos = [{ ts: now - ago - day, id: "standup", title: "Daily stand-up", cat: "work", tk: GE, covered: 2, total: 3, turns: 3, lines: [] }];
    S.notes["exrep:w1Fri"] = { at: now - ago - 3 * H, tk: GE, key: "w1Fri", m: { fillerN: 3, hedgeN: 2, wpm: 130 }, ai: null, tx: "x", targets: [] }; }
  localStorage.setItem("be12_v1", JSON.stringify(S)); };
const open = async (o, desktop) => {
  const ctx = await b.newContext(desktop ? { viewport: { width: 1280, height: 900 }, serviceWorkers: "block" } : { ...devices["iPhone 13"], serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|be-mail|gstatic/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.route(u => /i\.ytimg\.com|yt3\.googleusercontent\.com/.test(u.href), r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") }));
  await ctx.addInitScript(seed, [V, { W: T("W"), SH: T("SH"), CF: T("CF") }, o, FLAGS]);
  /* "A network error occurred." is raised by the Shadow workspace's third-party media in headless Chromium
     whenever a clip is opened (verified on the unmodified base), so it is filtered */
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => { if (e.message !== "A network error occurred.") p.errs.push(e.message); });
  await p.goto(BASE + "/index.html#home"); await sleep(2500);
  await p.evaluate(() => { window.__ev = []; window.track = (n, pr) => __ev.push([n, pr || {}]); try { homeRecImpress._seen = {} } catch (e) {} document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#syncNudge").forEach(e => e.remove()); go("home"); }); await sleep(2500);
  return { ctx, p };
};
/* Since 12 Oct 2026 only ONE row is open at a time (the accordion section at the
   foot of this file is its own subject). Everything above is about what each row
   CONTAINS and how it lays out when it is shown, so the panels are un-hidden for
   the measurement and put back exactly as they were — the accordion's own state
   is never touched by reading it. */
const rows = p => p.evaluate(() => { const was = [...document.querySelectorAll(".hx-row-p")].map(e => [e, e.hidden]); was.forEach(([e]) => e.hidden = false);
  const out = [...document.querySelectorAll(".hx-row")].map(r => ({ id: r.dataset.row, v: r.dataset.variant, lead: r.classList.contains("hx-row-lead"), h: r.querySelector("h3").textContent, cards: [...r.querySelectorAll(".hx-rcard")].map(c => ({ type: c.dataset.type, cid: c.dataset.cid, vid: c.dataset.vid || null, title: c.querySelector("b").textContent, line: c.querySelector("small").textContent, w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height })), scroll: (() => { const s = r.querySelector(".hx-row-scroll"); return { w: s.scrollWidth > s.clientWidth, display: getComputedStyle(s).display }; })() }));
  was.forEach(([e, h]) => e.hidden = h); return out; });
const home = async p => { await p.evaluate(() => { try { shCloseWork() } catch (e) {} go("home"); }); await sleep(1500); };
/* a learner opens the row before tapping a card in it, so the test does too */
const tap = async (p, row, type) => { await p.evaluate(([row, type]) => { const r = document.querySelector(`.hx-row[data-row="${row}"]`); if (r && !r.classList.contains("open") && typeof homeRowToggle === "function") homeRowToggle(row);
  const c = document.querySelector(`.hx-row[data-row="${row}"] .hx-rcard[data-type="${type}"]`); if (!c) throw new Error("no card " + row + "/" + type); c.click(); }, [row, type]); await sleep(2500); };
const here = p => p.evaluate(() => ({ v: cur && cur.v, a1: cur && cur.arg1, a2: cur && cur.arg2, clip: typeof shClip !== "undefined" && shClip ? shClip.vid : null, mode: typeof svMode !== "undefined" ? svMode : null, tab: typeof _shTab !== "undefined" ? _shTab : null, prac: typeof _pracTab !== "undefined" ? _pracTab : null }));

/* ---------- an active learner: every evidence type but inactivity ---------- */
{ const { ctx, p } = await open({ history: true });
  const R = await rows(p);
  const ids = R.map(r => r.id);
  ok("1 · an active learner sees the seven row types their evidence supports — watched, practiced, feedback, struggled, saved, learning, partner — and no 'haven't practised' (they practised today)", ["watched", "practiced", "feedback", "struggled", "saved", "learning", "partner"].every(x => ids.includes(x)) && !ids.includes("inactive") && R.length === 7, JSON.stringify(R.map(r => [r.id, r.v, r.h])));
  const H = Object.fromEntries(R.map(r => [r.id, r.h]));
  ok("2 · each heading names the learner's own evidence: the clip that played, the take, the words the report flagged, the Challenge missed, the words saved, the week, the scenario and character",
    H.watched.startsWith("Because you watched") && H.watched.includes("TOY STORY") && /^Because your feedback flagged .*thorough/.test(H.feedback) && /struggled with the Challenge on .*Disagree/.test(H.struggled)
    && /Because you saved .*leverage/.test(H.saved) && /Because you finished Week 1/.test(H.learning) && /Daily stand-up.* with Priya/.test(H.partner) && /^Because you practised/.test(H.practiced), JSON.stringify(H));
  ok("3 · exactly one lead row, first; every row's cards are the same small size (≤ 47% of the screen, 16:9 pictures)", R[0].lead && R.filter(r => r.lead).length === 1 && R.every(r => r.cards.every(c => Math.abs(c.w - R[1].cards[0].w) < 2 && c.w <= 0.47 * 390)), JSON.stringify(R.map(r => [r.id, r.lead, Math.round(r.cards[0].w)])));
  const col = await p.evaluate(() => { const c = e => getComputedStyle(e).color, m = document.createElement("i"); m.style.color = "var(--mut)"; document.body.appendChild(m); const mut = c(m); m.remove();
    return { mut, h3: c(document.querySelector(".hx-row-h h3")), titles: [...new Set([...document.querySelectorAll(".hx-rbody b")].map(c))] }; });
  ok("3b · card titles are grey (the muted text colour), never the white of the row heading above them", col.titles.length === 1 && col.titles[0] === col.mut && col.titles[0] !== col.h3, JSON.stringify(col));
  const ranked = await p.evaluate(() => _homeRows.map(r => r.score));
  ok("4 · rows are ranked by the engine's signal strength, strongest first (not a fixed order)", ranked.every((x, i) => i === 0 || ranked[i - 1] >= x), JSON.stringify(ranked));
  ok("5 · every card is specific content (a title, a type line, a content id), 2–3 per row; no clip twice; none the learner already has as a 'new' clip",
    R.every(r => r.cards.length >= 2 && r.cards.length <= 3 && r.cards.every(c => c.title && c.line && c.cid)) && (() => { const v = R.flatMap(r => r.cards.filter(c => c.type === "video" || c.type === "challenge").map(c => c.vid)); return new Set(v).size === v.length && !R.find(r => r.id === "watched").cards.some(c => c.vid === V.W); })(), JSON.stringify(R.map(r => r.cards.map(c => [c.type, c.cid]))));
  const hero = await p.evaluate(() => ({ kind: document.querySelector(".hx").dataset.kind, best: (NudgeEngine.rank(nudgeSignals(), {})[0] || {}).kind, order: [".hx", "#hxRows", ".hx-dest"].map(s => document.querySelector(s)).every((e, i, a) => e && (i === 0 || a[i - 1].compareDocumentPosition(e) & 4)) }));
  ok("6 · hierarchy: the hero (the engine's own first choice) → the rows → Explore", hero.kind === hero.best && hero.order, JSON.stringify(hero));
  ok("7 · on the phone each row swipes sideways inside itself; the page has no sideways scroll; cards ≥ 120 px tall and real buttons",
    R.every(r => r.scroll.display === "flex") && R.some(r => r.scroll.w) && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll(".hx-rcard")].every(e => e.tagName === "BUTTON")) && R.every(r => r.cards.every(c => c.h >= 120)));
  const imp = await p.evaluate(() => __ev.filter(e => e[0] === "recommendation_impression").map(e => e[1]));
  ok("8 · recommendation_impression once per row: row type, variant, reason, content id, content type, rank, track, week, day — nothing else, nothing personal",
    imp.length === R.length && imp.map(x => x.kind).join() === ids.join() && imp.every((x, i) => x.rank === String(i + 1) && x.track === "general-english" && x.week === "2" && x.day === "Mon" && x.cid && x.to && Object.keys(x).sort().join() === "cid,day,kind,n,rank,reason,to,track,variant,week") && !JSON.stringify(imp).match(/thorough|leverage|Priya|TOY/i), JSON.stringify(imp));
  /* the exact destinations */
  const sv = R.find(r => r.id === "struggled").cards[0];
  await tap(p, "struggled", "challenge"); let at = await here(p);
  ok("9 · the Challenge card opens Shadow Studio on that exact clip, in Challenge mode", at.v === "shadow" && at.clip === sv.vid && at.clip === V.CF && at.mode === "challenge", JSON.stringify({ sv, at }));
  const op = await p.evaluate(() => __ev.filter(e => e[0] === "recommendation_open").map(e => e[1]));
  ok("10 · … and sends recommendation_open with the row, the content id (the public video id) and the type", op.length === 1 && op[0].kind === "struggled" && op[0].cid === V.CF && op[0].to === "challenge", JSON.stringify(op));
  await home(p); const wv = (await rows(p)).find(r => r.id === "watched").cards[0];
  await tap(p, "watched", "video"); at = await here(p);
  ok("11 · a 'watched' card opens that exact related clip in Shadow Studio", at.v === "shadow" && at.clip === wv.vid, JSON.stringify({ wv, at }));
  await home(p); await tap(p, "partner", "roleplay"); at = await here(p);
  ok("12 · a conversation card opens that exact role-play scenario", at.v === "roleplay" && at.a1 === "standup", JSON.stringify(at));
  await home(p); const lr = (await rows(p)).find(r => r.id === "learning");
  const phc = lr.cards.find(c => c.type === "phrases") || (await rows(p)).find(r => r.id === "saved").cards.find(c => c.type === "phrases");
  await p.evaluate(() => { const c = document.querySelector('.hx-rcard[data-type="phrases"]'); c.click(); }); await sleep(1500); at = await here(p);
  ok("13 · an expressions card opens the Phrase Lab bank on that exact week", at.v === "phrasebank" && String(at.a1) === "2", JSON.stringify({ phc, at }));
  await home(p); await tap(p, "saved", "words"); at = await here(p);
  ok("14 · a saved-words card opens the word review", at.v === "practice" && at.prac === "ready", JSON.stringify(at));
  await home(p); const sc = (await rows(p)).find(r => r.cards.some(c => c.type === "session"));
  await p.evaluate(() => document.querySelector('.hx-rcard[data-type="session"]').click()); await sleep(1500); at = await here(p);
  ok("15 · a session card opens that exact session day", at.v === "session" && String(at.a1) === "2" && at.a2 === "Mon", JSON.stringify({ sc: sc && sc.id, at }));
  /* started + completed: finish the day the card offered */
  await p.evaluate(() => { toggleDay(dayKey(2, "Mon"), 2, "Mon"); }); await sleep(800);
  const fin = await p.evaluate(() => ({ st: __ev.filter(e => e[0] === "recommendation_started").map(e => e[1]), done: __ev.filter(e => e[0] === "recommendation_completed").map(e => e[1]) }));
  ok("16 · finishing the recommended session sends recommendation_started and recommendation_completed with that session's content id", fin.st.length >= 1 && fin.done.length === 1 && fin.done[0].cid === "w2Mon" && fin.done[0].to === "session", JSON.stringify(fin));
  /* verified watching: opening a clip is not watching it; 30 s of PLAYING is */
  await p.evaluate(() => go("shadow")); await sleep(1200);
  const wt = await p.evaluate(async () => { const L = aList("watched"); const n0 = L.length; const real = ytPlayer; const vid = "ApI1rroJNeg";
    await shLoad({ vid, start: 0, end: 0, title: "Build Your Social Fluency" }); const opened = aList("watched").some(x => x.vid === vid);
    ytPlayer = { getPlayerState: () => 1, getCurrentTime: () => 0 }; for (let t = 0; t <= 40; t += 0.25) shWatchTick(t);
    ytPlayer = { getPlayerState: () => 2 }; for (let t = 40; t <= 100; t += 0.25) shWatchTick(t); ytPlayer = real;
    const e = aList("watched").find(x => x.vid === vid); return { opened, secs: e && e.secs, first: aList("watched")[0].vid === vid }; });
  ok("17 · verified watching: loading a clip records nothing; 40 s of playing records ≥ 35 s; paused time adds nothing", !wt.opened && wt.secs >= 35 && wt.secs <= 41 && wt.first, JSON.stringify(wt));
  /* the header is two single lines, and there is no "Not now" (owner, 27 Sep 2026) */
  await home(p); const hd = await p.evaluate(() => [...document.querySelectorAll(".hx-row")].map(r => { const h = r.querySelector(".hx-row-h h3"), q = r.querySelector(".hx-row-h p"), lh = e => parseFloat(getComputedStyle(e).lineHeight);
    /* `button:not(.hx-rcard)` used to stand in for "no dismiss control". The header now
       carries the accordion's own toggle (owner, 12 Oct 2026), so the rule is named
       directly: no "Not now", and no button in the header but that toggle. */
    return { id: r.dataset.row, hide: !!r.querySelector(".hx-row-hide") || [...r.querySelectorAll("button:not(.hx-rcard)")].some(b => !b.classList.contains("hx-row-tog") && !b.classList.contains("hx-row-prem")), h1: h.getBoundingClientRect().height <= lh(h) + 1, p1: q.getBoundingClientRect().height <= lh(q) + 1, hs: parseFloat(getComputedStyle(h).fontSize), ps: parseFloat(getComputedStyle(q).fontSize), fits: r.querySelector(".hx-row-h").scrollWidth <= r.querySelector(".hx-row-h").clientWidth + 1 }; }));
  ok("18 · every row header is one heading line + one small line, no 'Not now', nothing wider than the screen", hd.length >= 2 && hd.every(x => !x.hide && x.h1 && x.p1 && x.hs <= 16 && x.ps < x.hs && x.fits), JSON.stringify(hd));
  ok("19 · no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
/* ---------- five days away: the eighth row joins and leads ---------- */
{ const { ctx, p } = await open({ history: true, away: 5 });
  const R = await rows(p);
  ok("20 · after five days away, 'Because you haven't practised for 5 days' is the lead row, with a short way back", R[0].id === "inactive" && R[0].lead && /haven't practised for 5 days/.test(R[0].h) && R[0].cards.length >= 2, JSON.stringify(R.map(r => [r.id, r.h])));
  ok("21 · the evidence rows that are still recent (≤ 14 days) stay, the ones past their window go", R.some(r => r.id === "watched") && R.some(r => r.id === "struggled"), JSON.stringify(R.map(r => r.id)));
  ok("22 · no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
/* ---------- a brand-new learner: curriculum rows only ---------- */
{ const { ctx, p } = await open({ history: false });
  const R = await rows(p);
  const txt = await p.evaluate(() => document.getElementById("hxRows").textContent);
  ok("23 · a new learner: 'Start here: your Week 1 learning path' then 'Recommended for your level' — no 'Because you' anywhere", R.map(r => r.id + ":" + r.v).join() === "learning:new,level:" && /Start here: your Week 1/.test(R[0].h) && !/Because you/.test(txt), JSON.stringify(R.map(r => [r.id, r.v, r.h])));
  ok("24 · … the path holds specific Week 1 content (a first clip to shadow, the week's expressions or scenario), never the hero's own session twice", R[0].cards.length >= 2 && !R.some(r => r.cards.some(c => c.cid === "w1Mon")) && R[0].cards.every(c => c.cid), JSON.stringify(R[0].cards));
  ok("25 · no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
/* ---------- Welding: nothing of this ---------- */
{ const { ctx, p } = await open({ history: true, area: "welding" });
  const w = await p.evaluate(() => ({ rows: document.querySelectorAll(".hx-row").length, txt: /Because you|Start here/.test(document.getElementById("v-home").textContent), ev: __ev.filter(e => /^rec/.test(e[0])).length, engine: NudgeEngine.rows(nudgeSignals(), homeContent()).length }));
  ok("26 · Welding (studio off): no rows, no 'Because you', no recommendation event, and the engine itself returns nothing for the area", w.rows === 0 && !w.txt && w.ev === 0 && w.engine === 0, JSON.stringify(w));
  await ctx.close(); }
/* ---------- flag off: today's Home ---------- */
{ const { ctx, p } = await open({ history: true, flag: false });
  ok("27 · home_v2_enabled off: no rows, the existing Home unchanged", await p.evaluate(() => document.querySelectorAll(".hx-row,.hx").length === 0 && !!document.querySelector(".today-card")));
  await ctx.close(); }
/* ---------- desktop ---------- */
{ const { ctx, p } = await open({ history: true }, true);
  const R = await rows(p);
  ok("28 · desktop: the same rows as three-up grids (no sideways scroller), no sideways page scroll", R.length === 7 && R.every(r => r.scroll.display === "grid" && !r.scroll.w) && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(R.map(r => r.scroll)));
  ok("29 · desktop: no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
/* ---------- ONE ROW OPEN AT A TIME (owner, 12 Oct 2026) ----------
   Eight rows, each with its own swipe strip, filled the whole page. The rows and
   the engine are untouched; only one strip is open at a time, the strongest
   signal first. Everything below is about that control and nothing else. */
{ const { ctx, p } = await open({ history: true });
  /* what the learner can actually see, row by row */
  const acc = () => p.evaluate(() => [...document.querySelectorAll(".hx-row")].map(r => {
    const b = r.querySelector(".hx-row-tog"), pa = r.querySelector(".hx-row-p"),
      h = r.querySelector(".hx-row-h h3"), q = r.querySelector(".hx-row-h p"), cards = [...r.querySelectorAll(".hx-rcard")];
    return { id: r.dataset.row, open: r.classList.contains("open"), expanded: b && b.getAttribute("aria-expanded"),
      shown: !!pa && !pa.hidden && pa.getBoundingClientRect().height > 0,
      head: !!h && h.getBoundingClientRect().height > 0, sub: !!q && q.getBoundingClientRect().height > 0,
      chev: (() => { const c = r.querySelector(".hx-row-chev"); return !!c && c.getBoundingClientRect().height > 0; })(),
      cardsSeen: cards.filter(c => c.getBoundingClientRect().height > 0).length, cardsIn: cards.length,
      items: (_homeRows.find(x => x.id === r.dataset.row) || { items: [] }).items.length };
  }));
  const toggle = async id => { await p.evaluate(i => homeRowToggle(i), id); await sleep(260); };
  const openIds = a => a.filter(x => x.open).map(x => x.id);

  const a0 = await acc();
  ok("30 · on load the FIRST recommendation group is expanded — its heading, its reason and its cards",
    a0.length >= 3 && a0[0].open && a0[0].expanded === "true" && a0[0].shown && a0[0].cardsSeen === a0[0].items && a0[0].items >= 2, JSON.stringify(a0[0]));
  ok("31 · every group after it is collapsed: no cards, and its heading, reason and chevron still there to tap",
    a0.slice(1).every(x => !x.open && x.expanded === "false" && !x.shown && x.cardsSeen === 0 && x.head && x.sub && x.chev), JSON.stringify(a0.slice(1)));
  ok("32 · the collapsed rows KEEP their cards in the page — nothing was filtered out of the engine",
    a0.slice(1).every(x => x.cardsIn === x.items && x.items >= 1), JSON.stringify(a0.slice(1).map(x => [x.id, x.cardsIn, x.items])));

  await toggle(a0[1].id); const a1 = await acc();
  ok("33 · opening the second group closes the first", openIds(a1).join() === a0[1].id && a1[0].expanded === "false" && !a1[0].shown && a1[1].shown, JSON.stringify(openIds(a1)));
  await toggle(a0[2].id); const a2 = await acc();
  ok("34 · opening a third closes the second", openIds(a2).join() === a0[2].id && !a2[1].shown && a2[2].shown, JSON.stringify(openIds(a2)));
  ok("35 · only ONE group is ever expanded", [a0, a1, a2].every(a => a.filter(x => x.open).length === 1), JSON.stringify([a0, a1, a2].map(openIds)));

  await toggle(a0[2].id); const a3 = await acc();
  ok("36 · closing the open group leaves them ALL collapsed — nothing reopens by itself",
    a3.every(x => !x.open && x.expanded === "false" && !x.shown) && a3.every(x => x.head), JSON.stringify(openIds(a3)));

  /* each group's own cards, never another's */
  await toggle(a0[1].id);
  const mine = await p.evaluate(id => { const r = document.querySelector(`.hx-row[data-row="${id}"]`);
    const shown = [...document.querySelectorAll(".hx-rcard")].filter(c => c.getBoundingClientRect().height > 0);
    const eng = (_homeRows.find(x => x.id === id) || { items: [] }).items;
    return { onlyMine: shown.every(c => r.contains(c)), n: shown.length,
      same: shown.map(c => c.dataset.cid || c.dataset.vid || c.dataset.type).join() === eng.map(i => i.cid || i.vid || i.type).join() }; }, a0[1].id);
  ok("37 · the open group shows ITS OWN cards, in the engine's order, and no other group's", mine.onlyMine && mine.same && mine.n >= 1, JSON.stringify(mine));

  /* a re-render: the library index landing, the role-play photos, a trip to Home and back */
  await p.evaluate(() => { go("profile"); }); await sleep(900); await home(p);
  const a4 = await acc();
  ok("38 · leaving Home and coming back keeps the learner's choice, and exactly one group open",
    a4.filter(x => x.open).length === 1 && a4.find(x => x.open).id === a0[1].id, JSON.stringify(openIds(a4)));
  await p.evaluate(() => { const el = document.getElementById("v-home"); rHomeV2(el); }); await sleep(900);
  const a5 = await acc();
  ok("39 · a full re-render never leaves two groups expanded", a5.filter(x => x.open).length === 1, JSON.stringify(openIds(a5)));

  /* the control itself */
  const aria = await p.evaluate(() => [...document.querySelectorAll(".hx-row")].map(r => { const b = r.querySelector(".hx-row-tog"), pa = r.querySelector(".hx-row-p");
    return { tag: b && b.tagName, type: b && b.getAttribute("type"), controls: !!(b && pa && b.getAttribute("aria-controls") === pa.id && pa.id),
      labelled: !!(b && document.getElementById(b.getAttribute("aria-labelledby"))), region: pa && pa.getAttribute("role"),
      wide: b && r.querySelector(".hx-row-h") ? b.getBoundingClientRect().width >= r.querySelector(".hx-row-h").getBoundingClientRect().width - 1 : false }; }));
  ok("40 · each control is a real button with aria-expanded, aria-controls on its own panel, a name from its heading, and it covers the whole header row",
    aria.every(x => x.tag === "BUTTON" && x.type === "button" && x.controls && x.labelled && x.region === "region" && x.wide), JSON.stringify(aria[1]));
  const kb = await p.evaluate(async () => { const r = document.querySelectorAll(".hx-row")[2], b = r.querySelector(".hx-row-tog");
    b.focus(); const focused = document.activeElement === b; b.click();            /* Enter/Space on a <button> is a click */
    await new Promise(x => setTimeout(x, 250));
    return { focused, open: r.classList.contains("open"), exp: b.getAttribute("aria-expanded") }; });
  ok("41 · the control takes keyboard focus and opens on activation", kb.focused && kb.open && kb.exp === "true", JSON.stringify(kb));

  /* a card tap must open the recommendation, never the accordion */
  const before = await acc();
  const openRow = before.find(x => x.open).id;
  await tap(p, openRow, (await p.evaluate(id => (_homeRows.find(x => x.id === id).items[0] || {}).type, openRow)));
  const went = await here(p);
  ok("42 · tapping a card inside the open group navigates and does not collapse anything", went.v !== "home", JSON.stringify(went));
  await home(p);
  const a6 = await acc();
  ok("43 · …and coming back the same group is still the open one", a6.filter(x => x.open).length === 1 && a6.find(x => x.open).id === openRow, JSON.stringify(openIds(a6)));

  /* the carousel inside an open group, and the page itself */
  const car = await p.evaluate(id => { const s = document.querySelector(`.hx-row[data-row="${id}"] .hx-row-scroll`);
    const can = s.scrollWidth > s.clientWidth; s.scrollLeft = 120;
    return { can, moved: s.scrollLeft > 0, overflowX: getComputedStyle(s).overflowX, page: document.documentElement.scrollWidth <= innerWidth + 1 }; }, openRow);
  ok("44 · the open group's carousel still scrolls sideways, and the page does not", car.can && car.moved && car.overflowX === "auto" && car.page, JSON.stringify(car));
  const line = await p.evaluate(() => [...document.querySelectorAll(".hx-row")].map(r => { const h = r.querySelector(".hx-row-h h3"), q = r.querySelector(".hx-row-h p"), hd = r.querySelector(".hx-row-h"), lh = e => parseFloat(getComputedStyle(e).lineHeight);
    return h.getBoundingClientRect().height <= lh(h) + 1 && q.getBoundingClientRect().height <= lh(q) + 1 && hd.scrollWidth <= hd.clientWidth + 1; }));
  ok("45 · the chevron did not cost the header its two single lines", line.every(Boolean), JSON.stringify(line));
  /* the motion is restrained, and it is off when the learner asked for that */
  const mo = await p.evaluate(() => { const pa = document.querySelector(".hx-row.open .hx-row-p"); const c = getComputedStyle(pa);
    return { name: c.animationName, dur: parseFloat(c.animationDuration) || 0 }; });
  ok("46 · opening a group animates, briefly", mo.name === "hxRowIn" && mo.dur > 0 && mo.dur <= 0.3, JSON.stringify(mo));
  await p.emulateMedia({ reducedMotion: "reduce" }); await sleep(200);
  const mr = await p.evaluate(() => { const pa = document.querySelector(".hx-row.open .hx-row-p"), ch = document.querySelector(".hx-row.open .hx-row-chev");
    return { name: getComputedStyle(pa).animationName, chev: getComputedStyle(ch).transitionDuration }; });
  /* the app's own global reduced-motion rule clamps every transition to .01ms
     (index.html ~5839), so "no sweep" is that clamp or a flat 0, never the .18s */
  ok("47 · reduced motion: no animation on the panel and no sweep on the chevron", mr.name === "none" && parseFloat(mr.chev) <= 0.001, JSON.stringify(mr));
  await p.emulateMedia({ reducedMotion: "no-preference" });
  ok("48 · no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
/* ---------- desktop: the same one-at-a-time rule ---------- */
{ const { ctx, p } = await open({ history: true }, true);
  const d = await p.evaluate(() => [...document.querySelectorAll(".hx-row")].map(r => ({ id: r.dataset.row, open: r.classList.contains("open"),
    shown: (() => { const pa = r.querySelector(".hx-row-p"); return !!pa && !pa.hidden; })(),
    grid: (() => { const s = r.querySelector(".hx-row-scroll"); const pa = r.querySelector(".hx-row-p"); const was = pa.hidden; pa.hidden = false; const g = getComputedStyle(s).display; pa.hidden = was; return g; })() })));
  ok("49 · desktop: the first group open, the rest collapsed, and an open group is still a three-up grid",
    d.length >= 3 && d[0].open && d[0].shown && d.slice(1).every(x => !x.open && !x.shown) && d.every(x => x.grid === "grid"), JSON.stringify(d));
  ok("50 · desktop: no sideways page scroll", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok("51 · desktop: no JavaScript errors", !p.errs.length, p.errs.join(" | "));
  await ctx.close(); }
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
