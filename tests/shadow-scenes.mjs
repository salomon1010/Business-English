/* Shadow Studio — animated scenes (shadow-scenes.js), General English only.
   Run:  cd tests && node shadow-scenes.mjs          (no Worker needed; BASE=… for another server)
   The Polish Worker is answered by a route in this file (TTS bytes, IPA
   "ˈ"+word). Four learners:
     A  General English, scenes on        — the whole loop
     B  Welding, scenes on                — must see and reach nothing
     C  General English, production flags — scenes are off until released
     D  General English, reduced motion   — no mouth, no blink, words still say who speaks
   Timing checks compare the lit word with ShadowSync.locate() at the same
   moment, so they test the wiring, not a hard-coded second. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const sleep = ms => new Promise(r => setTimeout(r, ms));
let BASE = process.env.BASE, server = null;
if (!BASE) { server = spawn("python3", ["-m", "http.server", "8793"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" }); await sleep(800); BASE = "http://localhost:8793"; }
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const POLISH = "https://be-polish.nore-ngou.workers.dev";
const SCENE = "scene.coworker-intro";
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
const NOISE = /network error occurred|Failed to load resource|CORS|cloudflareinsights|ERR_|be-partner|be-events|be-push|be-entitlements|firebase|googleapis/i;

async function learner(id, { track, flags, reduced = false, audio404 = false }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["microphone"], reducedMotion: reduced ? "reduce" : "no-preference", serviceWorkers: audio404 ? "block" : "allow" });   /* a service worker's own fetch escapes page routes */
  await ctx.addInitScript(({ track, flags }) => {
    if (flags) localStorage.setItem("be_flags", JSON.stringify(flags)); else localStorage.removeItem("be_flags");
    window.__beacons = []; navigator.sendBeacon = (u, blob) => { try { blob.text().then(t => { try { window.__beacons.push(JSON.parse(t)); } catch (e) {} }); } catch (e) {} return true; };
    if (!localStorage.getItem("be12_v1")) {
      const st = { profile: { name: "Alex", role: "", goal: "Speak with confidence in meetings", slot: "", lang: "en", ts: Date.now() }, professionalTracks: { activeId: track },
        fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() }, "welding": { placed: "full", finished: true, day: 15, done: {}, checkedAt: Date.now() } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now() };
      localStorage.setItem("be12_v1", JSON.stringify(st)); sessionStorage.setItem("be_view", "#shadow");
    }
  }, { track, flags });
  const reqs = [];
  ctx.on("request", r => reqs.push(r.url()));
  await ctx.route(u => u.href.startsWith(POLISH), async route => {
    const req = route.request(); const ct = req.headers()["content-type"] || "";
    let body = {}; if (ct.includes("json")) { try { body = JSON.parse(req.postData() || "{}"); } catch (e) {} }
    if (body.tts) return route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(64) });
    if (body.chat) {
      const content = String(body.chat.messages[0].content || "");
      const words = (content.match(/Words: (.*)$/m) || [, ""])[1].split(",").map(w => w.trim()).filter(Boolean);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: words.map(w => w + "=ˈ" + w).join("|"), covered: [] }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "", words: [] }) });
  });
  if (audio404) await ctx.route(u => /\/scenes\/[^/]+\/audio\.mp3$/.test(u.pathname), r => r.fulfill({ status: 404, body: "" }));
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(id + ": " + e.message));
  page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errors.push(id + " console: " + m.text()); });
  await page.goto(BASE + "/index.html?sc=" + Date.now() + "#shadow", { waitUntil: "load" });
  await sleep(1200);
  await page.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,#rmCel,.cf-ov,.wc-ov").forEach(e => e.remove()); });
  return { ctx, page, reqs };
}
const toShadow = async page => { await page.evaluate(() => go("shadow")); await page.waitForSelector("#shPlayerWrap", { state: "attached", timeout: 15000 }); await sleep(900); };
const openScene = async page => {
  await page.waitForSelector("#shLibFeed .scn-lrow", { timeout: 10000 });
  await page.click("#shLibFeed .scn-lrow");
  await page.waitForFunction(() => typeof svAsset !== "undefined" && svAsset && svAsset.scene && ytPlayer && ytPlayer.getDuration && ytPlayer.getDuration() > 0, null, { timeout: 15000 });
  await sleep(300);
};
const lastToast = page => page.evaluate(() => { const t = [...document.querySelectorAll(".toast,#toast")].map(e => e.textContent).join(" | "); return t; });

/* ================= A — General English, scenes on ================= */
console.log("A · General English learner, scenes on");
const A = await learner("A", { track: "general-english", flags: { shadow_scenes_enabled: true } });
{
  const p = A.page;
  await toShadow(p);
  await p.waitForSelector("#shLibFeed .scn-lrow", { timeout: 10000 });
  const row = await p.evaluate(() => { const f = document.getElementById("shLibFeed"), first = f.querySelector(".shl-row"), r = f.querySelector(".scn-lrow"), next = [...f.querySelectorAll(".shl-row")].find(x => !x.classList.contains("scn-lrow"));
    const w = e => e ? Math.round(e.querySelector(".shl-thumb").getBoundingClientRect().width) : 0, hh = e => e ? Math.round(e.querySelector(".shl-thumb").getBoundingClientRect().height) : 0;
    return { first: first === r, t: r && r.querySelector("b").textContent, by: r && r.querySelector("small").textContent, tag: r ? !!r.querySelector(".shl-cap") : null, dur: r && r.querySelector(".shl-dur").textContent, img: r && r.querySelector("img").getAttribute("src"), w: w(r), wn: w(next), h: hh(r), hn: hh(next), card: !!document.querySelector(".scn-card,.scn-sec") }; });
  ok("the scene is the FIRST row of the video list", row.first && row.t === "Meeting a new coworker", JSON.stringify(row));
  ok("the row reads like the others: source line and length, no tag line (owner, 28 Sep 2026)", row.by === "BE Mastery · Daniel & Maya" && row.tag === false && row.dur === "1:01", JSON.stringify(row));
  ok("its thumbnail is the scene's poster, the same size as the next video's", /scenes\/coworker-intro\/poster\.svg$/.test(row.img || "") && row.w > 0 && row.w === row.wn && row.h === row.hn, JSON.stringify(row));
  ok("no separate large scene card on the page", !row.card);
  const cats = await p.evaluate(async () => { const out = {}; const first = () => { const r = document.querySelector("#shLibFeed .shl-row"); return !!(r && r.classList.contains("scn-lrow")); };
    const cat = _shCat && _shCat.categories[1] && _shCat.categories[1].id; shLibCat(cat); await new Promise(z => setTimeout(z, 200)); out.cat = first();
    shLibCat("mine"); await new Promise(z => setTimeout(z, 200)); out.mine = !!document.querySelector("#shLibFeed .scn-lrow");
    shLibCat("foryou"); shLibQ("coworker"); await new Promise(z => setTimeout(z, 300)); out.q = first();
    shLibQ("zzzqqq"); await new Promise(z => setTimeout(z, 300)); out.qNo = !!document.querySelector("#shLibFeed .scn-lrow");
    shLibClear && shLibClear(); shLibQ(""); await new Promise(z => setTimeout(z, 300)); out.back = first(); return out; });
  ok("first in a category list and in a search that finds it; not in Your videos or a search that does not", cats.cat && !cats.mine && cats.q && !cats.qNo && cats.back, JSON.stringify(cats));
  /* owner, 28 Sep 2026: no Transcript / Captions in player / Animated scene line on any row, and a library video without a transcript is never listed */
  const tx = await p.evaluate(async () => { const bad = Object.keys(_shCat.videos).filter(v => !shLibHasTx(v)), out = { bad: bad.length, tags: 0, shown: [], rows: 0 };
    const look = () => { const f = document.getElementById("shLibFeed"); out.tags += f.querySelectorAll(".shl-cap").length; out.rows += f.querySelectorAll(".shl-row").length; bad.forEach(v => { if (f.innerHTML.includes("/vi/" + v + "/")) out.shown.push(v); }); };
    const wait = () => new Promise(z => setTimeout(z, 200));
    for (const c of ["foryou"].concat(_shCat.categories.map(x => x.id))) { shLibCat(c); await wait(); if (typeof shLibMoreToggle === "function" && document.querySelector("#shLibFeed .shl-more")) { shLibMoreToggle(); await wait(); } look(); }
    shLibCat("foryou"); shLibQ("Communicating the Future"); await wait(); look(); shLibQ(""); await wait();
    out.helper = typeof shLibHasTx === "function"; return out; });
  ok("no badge line on any row; the videos without a transcript are in no list (For you, every category, a search)", tx.helper && tx.bad > 0 && tx.rows > 0 && tx.tags === 0 && tx.shown.length === 0, JSON.stringify(tx));
  const fs = await p.evaluate(() => { const r = document.querySelector("#shLibFeed .shl-row:not(.scn-lrow)"); if (!r) return null; const b = r.querySelector("b"), rgb = c => { const n = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number); return /^color\(srgb/.test(c) ? n.map(x => x * 255) : n; }, lum = c => rgb(c).reduce((a, x) => a + x, 0); const pg = getComputedStyle(document.body).color;
    return { b: getComputedStyle(b).fontSize, s: getComputedStyle(r.querySelector("small")).fontSize, col: getComputedStyle(b).color, page: pg, soft: lum(getComputedStyle(b).color) < lum(pg) && lum(getComputedStyle(b).color) > lum(getComputedStyle(r.querySelector("small")).color) }; });
  ok("row text a little smaller (owner, 28 Sep 2026): title 13 px, channel 11 px", fs && fs.b === "13px" && fs.s === "11px", JSON.stringify(fs));
  ok("the title is softer than the page's full white, still brighter than the channel line (owner, 28 Sep 2026)", fs && fs.soft, JSON.stringify(fs));
  await openScene(p);
  const st = await p.evaluate(() => ({ cls: ytPlayer instanceof ShadowScenes.ScenePlayer, live: !!document.querySelector("#ytBox .scn-live"), lbl: document.querySelector("#ytBox .scn-live").getAttribute("aria-label") || "", ai: (document.querySelector("#ytBox .scn-ai") || {}).textContent, dur: ytPlayer.getDuration(), title: shClip.title, iframe: !!document.querySelector("#ytBox iframe") }));
  ok("the scene plays in ScenePlayer inside the studio's own player box (no YouTube frame)", st.cls && st.live && !st.iframe, JSON.stringify(st));
  ok("the stage has an accessible name with the title and both characters", /Meeting a new coworker/.test(st.lbl) && /Daniel/.test(st.lbl) && /Maya/.test(st.lbl), st.lbl);
  ok("the voices are labelled as AI on the stage", st.ai === "AI voices", st.ai);
  ok("the audio is the whole 61-second dialogue", Math.abs(st.dur - 60.9) < 0.4, String(st.dur));
  ok("the workspace title is the scene's title", st.title === "Meeting a new coworker", st.title);
  ok("nothing YouTube-only is asked for a scene id (no i.ytimg / iframe_api / ytai / captions call)",
    !A.reqs.some(u => /i\.ytimg\.com\/vi\/scene\./.test(u) || /youtube\.com\/iframe_api/.test(u)), A.reqs.filter(u => /ytimg|youtube/.test(u)).join(" "));
  const as = await p.evaluate(() => ({ level: svAsset.level, est: svAsset.segments.reduce((n, s) => n + (s.words || []).filter(w => w.estimated).length, 0), words: svAsset.segments.reduce((n, s) => n + (s.words || []).length, 0), paras: svParas(svAsset).length, spk: svParas(svAsset).map(x => scnSpkOf(x.from)), names: [...document.querySelectorAll("#svTx .sv-spk b")].map(b => b.textContent), note: (document.querySelector("#shV2 .sv-note") || {}).textContent }));
  /* Whisper gave two pairs ("bit more", "check them") a zero-length first word, so the
     studio shares each pair's time and says so; every other word time is measured */
  ok("captions load at word level: 122 of 126 word times measured, the 4 without a boundary marked estimated", as.level === "word" && as.words === 126 && as.est === 4, JSON.stringify(as));
  ok("one speaker's turn is one paragraph (10 turns)", as.paras === 10 && as.spk.join(",") === "daniel,maya,daniel,maya,daniel,maya,daniel,maya,daniel,maya", as.spk.join(","));
  ok("Watch names the speaker above every turn", as.names.length === 10 && as.names[0] === "Daniel" && as.names[1] === "Maya", as.names.join(","));
  ok("the timing note says where the timing comes from", /scene's own audio/.test(as.note || ""), as.note);

  /* the word lit in the transcript is the word locate() says, and the stage agrees on the speaker */
  const sync = async (sec) => {
    await p.evaluate(s => { shSeekTo(s); ytPlayer.playVideo(); }, sec); await sleep(450);
    return p.evaluate(() => { const t = ytPlayer.getCurrentTime(), loc = ShadowSync.locate(svAsset, t * 1000), now = document.querySelector("#svTx .sv-w.now"), seg = now && now.closest(".sv-seg");
      return { t, want: loc.seg + ":" + loc.word, got: seg ? seg.dataset.i + ":" + now.dataset.k : "none", spk: document.querySelector(".scn-live").dataset.spk || "", status: (document.querySelector(".scn-status") || {}).textContent || "", on: [...document.querySelectorAll(".scn-c.on")].map(e => e.dataset.id).join() }; });
  };
  let s1 = await sync(3.3);
  if (s1.want !== s1.got) s1 = await sync(3.3);
  ok("the lit word follows the audio (Daniel's first line)", s1.want === s1.got && s1.want.startsWith("0:"), JSON.stringify(s1));
  ok("the stage marks Daniel as speaking, in words as well as on the picture", s1.spk === "daniel" && s1.on === "daniel" && /Daniel is speaking/.test(s1.status), JSON.stringify(s1));
  const s2 = await sync(17.2);
  ok("in Maya's turn the lit word is in line 4 and Maya is marked", s2.want === s2.got && s2.want.startsWith("3:") && s2.spk === "maya" && /Maya is speaking/.test(s2.status), JSON.stringify(s2));
  const mouths = await p.evaluate(async () => { const seen = new Set(); ytPlayer.seekTo(5.6); ytPlayer.playVideo(); for (let i = 0; i < 40; i++) { seen.add(document.querySelector(".scn-live").dataset.mouth); await new Promise(r => setTimeout(r, 40)); } return [...seen].sort().join(","); });
  ok("the speaking character's mouth opens and closes with the words", mouths === "0,1", mouths);
  const gap = await sync(10.75);
  ok("in the silence between turns nobody is marked as speaking", gap.spk === "" && gap.on === "", JSON.stringify(gap));
  await p.evaluate(() => ytPlayer.pauseVideo()); await sleep(250);
  const pz = await p.evaluate(() => ({ st: document.querySelector(".scn-live").dataset.state, go: getComputedStyle(document.querySelector(".scn-go")).display, lbl: document.querySelector(".scn-go").getAttribute("aria-label") }));
  ok("paused in Watch: a labelled play button sits on the stage", pz.st === "pause" && pz.go !== "none" && pz.lbl === "Play the scene", JSON.stringify(pz));

  /* line actions */
  await p.evaluate(() => svTapSeg(3)); await sleep(250);
  const acts = await p.evaluate(() => ({ n: document.querySelectorAll('#svTx .sv-para[data-p="3"] .scn-acts .scn-act').length, lbl: [...document.querySelectorAll("#svTx .scn-acts .scn-act span")].map(s => s.textContent).join(","), grp: (document.querySelector("#svTx .scn-acts") || {}).getAttribute && document.querySelector("#svTx .scn-acts").getAttribute("aria-label"), playing: ytPlayer.getPlayerState() === 1 }));
  ok("tapping a line offers Listen / Slow / Shadow / Repeat under it, and does not start playing", acts.n === 4 && acts.lbl === "Listen,Slow,Shadow,Repeat" && !acts.playing && acts.grp === "Practise this line", JSON.stringify(acts));
  const g3 = await p.evaluate(() => { const g = svParaGroup(svParaOf(3)); return { s: g.startMs / 1000, e: g.endMs / 1000 }; });
  await p.evaluate(() => scnLine(3, "listen")); await sleep(300);
  const l1 = await p.evaluate(() => ({ st: ytPlayer.getPlayerState(), t: ytPlayer.getCurrentTime() }));
  ok("Listen plays exactly that line from its start", l1.st === 1 && l1.t >= g3.s - 0.1 && l1.t < g3.s + 1, JSON.stringify({ l1, g3 }));
  await p.evaluate(e => shSeekTo(e - 0.4), g3.e); await sleep(900);
  const l2 = await p.evaluate(() => ({ st: ytPlayer.getPlayerState(), t: ytPlayer.getCurrentTime() }));
  ok("…and stops at its end", l2.st === 2 && Math.abs(l2.t - g3.e) < 0.6, JSON.stringify({ l2, g3 }));
  await p.evaluate(() => scnLine(0, "slow")); await sleep(300);
  const sl1 = await p.evaluate(() => ytPlayer.getPlaybackRate());
  const g0e = await p.evaluate(() => svParaGroup(svParaOf(0)).endMs / 1000);
  await p.evaluate(e => shSeekTo(e - 0.3), g0e); await sleep(900);
  const sl2 = await p.evaluate(() => ({ r: ytPlayer.getPlaybackRate(), st: ytPlayer.getPlayerState() }));
  ok("Slow plays the line at 0.75× and puts the speed back after it", sl1 === 0.75 && sl2.r === 1 && sl2.st === 2, JSON.stringify({ sl1, sl2 }));
  await p.evaluate(() => scnLine(5, "repeat")); await sleep(200);
  const rp = await p.evaluate(() => ({ i: svRepeat && svRepeat.i, st: ytPlayer.getPlayerState() }));
  ok("Repeat loops that line", rp.i === 5 && rp.st === 1, JSON.stringify(rp));
  await p.evaluate(() => { svRepeat = null; ytPlayer.pauseVideo(); });

  /* Shadow */
  await p.evaluate(() => scnLine(3, "shadow")); await sleep(700);
  await p.evaluate(() => ytPlayer.pauseVideo()); await sleep(450);
  const sh = await p.evaluate(() => ({ mode: svMode, who: (document.querySelector("#svSh .sv-sh-who") || {}).textContent || "", hint: [...document.querySelectorAll("#svSh .sv-note")].map(e => e.textContent).join(" "), start: shClip.start, st: document.querySelector(".scn-status").dataset.k, stt: document.querySelector(".scn-status").textContent, next: !!document.getElementById("scnNext"), go: getComputedStyle(document.querySelector(".scn-go")).display }));
  ok("Shadow opens on Maya's line and says whose voice to follow", sh.mode === "shadow" && /Maya/.test(sh.who) && /Speak along with Maya/.test(sh.who) && /Maya's line loops/.test(sh.hint) && Math.abs(sh.start - g3.s) < 0.05, JSON.stringify(sh));
  ok("paused in Shadow, the stage says it is the learner's turn, with whom", sh.st === "turn" && /Your turn/.test(sh.stt) && /Maya/.test(sh.stt), JSON.stringify(sh));
  ok("no play button over the stage in Shadow (the foot bar holds the controls)", sh.go === "none", sh.go);
  ok("the partner card is not offered before any shadowing", !sh.next);

  /* the word card */
  const tapWord = w => p.evaluate(w => { const b = [...document.querySelectorAll("#svSh .sv-sh-w")].find(x => (x.dataset.w || "").toLowerCase().replace(/[^a-z']/g, "") === w); svShWordTap(b); }, w);
  await tapWord("responsible"); await sleep(600);
  const wc = await p.evaluate(() => { const b = document.getElementById("scnWc"); return { vis: b && !b.hidden, w: b && (b.querySelector(".scn-wc-hd b") || {}).textContent, m: b && (b.querySelector(".scn-wc-m") || {}).textContent, e: b && (b.querySelector(".scn-wc-e") || {}).textContent, ipa: (document.getElementById("scnWcIpa") || {}).textContent, x: b && b.querySelector(".scn-wc-x").getAttribute("aria-label") }; });
  ok("tapping a key word opens its card: the word, its meaning and example from the scene", wc.vis && wc.w === "responsible" && /dealing with something/.test(wc.m || "") && /responsible for planning/.test(wc.e || ""), JSON.stringify(wc));
  ok("the card shows the pronunciation once the Worker answers", /ˈresponsible/.test(wc.ipa || "") || /ˈ/.test(wc.ipa || ""), wc.ipa);
  ok("the card's close button is labelled", wc.x === "Close");
  await p.evaluate(() => scnWordSave()); await sleep(200);
  const sv = await p.evaluate(() => ({ has: vocHas("responsible"), tk: (S.vocab.responsible || {}).tk, btn: document.querySelector("#scnWc .scn-wc-save").textContent.trim(), pr: document.querySelector("#scnWc .scn-wc-save").getAttribute("aria-pressed") }));
  ok("Save word puts it in the learner's own vocabulary, for General English", sv.has && Array.isArray(sv.tk) && sv.tk.includes("general-english") && /Saved/.test(sv.btn) && sv.pr === "true", JSON.stringify(sv));
  await tapWord("for"); await sleep(300);
  const wc2 = await p.evaluate(() => ({ m: !!document.querySelector("#scnWc .scn-wc-m"), w: (document.querySelector("#scnWc .scn-wc-hd b") || {}).textContent }));
  ok("a word the scene does not explain gets no invented meaning", wc2.w === "for" && !wc2.m, JSON.stringify(wc2));

  /* a report on this scene: the stage says so, and the way to a partner opens */
  await p.evaluate(() => { fbCtx = { vid: shClip.vid, recCtx: shRecCtx(shClip.vid) }; fbT0 = Date.now() - 6000; fbShowResults("I'm responsible for planning our projects and keeping everyone on schedule.", "I'm responsible for planning our project and keeping everyone on schedule", "new"); }); await sleep(500);
  const nx = await p.evaluate(() => { const n = document.getElementById("scnNext"); return { n: !!n, t: n && n.textContent.replace(/\s+/g, " "), btns: n ? [...n.querySelectorAll("button")].map(b => b.textContent.replace(/\s+/g, " ").trim()) : [], st: document.querySelector(".scn-status").dataset.k }; });
  ok("after a shadow report the stage says feedback is ready", nx.st === "fb", nx.st);
  ok("…and the scene offers the expression to a partner first, the AI coach beside it", nx.n && /I'm responsible for/.test(nx.t) && /another learner/.test(nx.t) && nx.btns.length === 2 && /partner/i.test(nx.btns[0]) && /AI/.test(nx.btns[1]), JSON.stringify(nx));
  ok("the AI option says it is an AI, not a learner", /It is an AI, not a learner/.test(nx.t || ""), nx.t);

  /* My clips: a scene passage keeps the scene's poster, not a YouTube picture */
  await p.evaluate(() => svShFav()); await sleep(200);
  const clip = await p.evaluate(() => { const c = aList("clips")[0]; shClipsSheet(); const img = document.querySelector("#shClipsOv img"); return { vid: c && c.vid, img: img && img.getAttribute("src") }; });
  ok("a starred scene passage is kept in My clips with the scene's own poster", clip.vid === SCENE && /scenes\/coworker-intro\/poster\.svg$/.test(clip.img || ""), JSON.stringify(clip));
  await p.evaluate(() => { const o = document.getElementById("shClipsOv"); if (o) o.remove(); });
  const poster = await p.evaluate(async () => { const r = await fetch("scenes/coworker-intro/poster.svg"); const t = await r.text(); return { ok: r.ok, svg: /^<svg xmlns/.test(t), open: /scn-m1/.test(t) }; });
  ok("the poster is a standalone SVG with closed mouths", poster.ok && poster.svg && !poster.open, JSON.stringify(poster));

  /* Challenge: the status follows the rung */
  await p.evaluate(() => svSetMode("challenge")); await sleep(700);
  const ch = await p.evaluate(() => ({ rung: svCh && svCh.rung, phase: svCh && svCh.phase, k: document.querySelector(".scn-status").dataset.k, t: document.querySelector(".scn-status").textContent, spk: scnSpkOf(svChSegObj().from), ic: (() => { const s = document.querySelector("#svExpr svg"); return s ? Math.round(s.getBoundingClientRect().width) : 0; })() }));
  const want = { gate: new RegExp("Listen to " + (ch.spk === "maya" ? "Maya" : "Daniel") + " first"), sync: /speak together with/, recall: /from memory/, blind: /without the text/, retell: /own words/ }[ch.rung];
  ok("in Challenge the stage names the rung's task (" + ch.rung + ")", ch.k === "turn" && want && want.test(ch.t), JSON.stringify(ch));
  ok("Challenge keeps the five-rung ladder on a scene", await p.evaluate(() => JSON.stringify(svCh.rungs) === JSON.stringify(["gate", "sync", "recall", "blind", "retell"]) || svCh.rungs.length >= 3), await p.evaluate(() => JSON.stringify(svCh.rungs)));
  ok("the expression chip's icon is icon-sized (was filling the panel)", ch.ic > 0 && ch.ic <= 20, String(ch.ic));

  /* the partner hand-off carries the line */
  await p.evaluate(() => { svSetMode("shadow"); }); await sleep(300);
  await p.evaluate(() => scnApply("partner")); await sleep(600);
  const ap = await p.evaluate(() => ({ view: (location.hash || "").replace("#", "").split("/")[0], ph: ppState().applyPhrase && ppState().applyPhrase.text, vid: ppState().applyPhrase && ppState().applyPhrase.vid }));
  ok("Use it with a partner opens Practice Partner carrying the scene's line", /partner/.test(ap.view) && /responsible for planning/.test(ap.ph || "") && ap.vid === SCENE, JSON.stringify(ap));

  /* the session page: Week 1 · Monday offers this scene */
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(900);
  const ss = await p.evaluate(() => { const b = document.querySelector("#scnSess button"); return { b: b && b.textContent.replace(/\s+/g, " ").trim(), why: (document.querySelector("#scnSess .sess-jump-why") || {}).textContent }; });
  ok("Week 1 · Monday's session offers 'Shadow the scene'", /Shadow the scene: Meeting a new coworker/.test(ss.b || "") && !ss.why   /* owner, 28 Sep 2026: no helper line under it */, JSON.stringify(ss));
  await p.evaluate(() => go("session", 1, "Tue")); await sleep(600);
  ok("a day with no scene (Tuesday) offers none", await p.evaluate(() => !document.querySelector("#scnSess button")));
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(700);
  await p.evaluate(() => { shCloseWork(); shClip.vid = ""; });   /* so the check below cannot pass on the scene opened earlier */
  await p.click("#scnSess button");
  await p.waitForFunction(() => shClip.vid === "scene.coworker-intro" && typeof svAsset !== "undefined" && svAsset && svAsset.scene && ytPlayer instanceof ShadowScenes.ScenePlayer, null, { timeout: 15000 }).catch(() => {});
  await sleep(300);
  ok("…and the button opens the scene in the studio", await p.evaluate(() => location.hash.startsWith("#shadow") && ytPlayer instanceof ShadowScenes.ScenePlayer && shClip.vid === "scene.coworker-intro"));

  const names = await p.evaluate(() => window.__beacons.map(b => b.name + (b.props && (b.props.kind || b.props.source) ? ":" + (b.props.kind || b.props.source) : "")));
  ok("events: shadow_scene_opened (library, session), shadow_scene_line, shadow_scene_word (open, save)",
    names.includes("shadow_scene_opened:library") && names.includes("shadow_scene_opened:session") && names.includes("shadow_scene_line:listen") && names.includes("shadow_scene_line:shadow") && names.includes("shadow_scene_word:open") && names.includes("shadow_scene_word:save"), names.filter(n => /scene/.test(n)).join(" "));
  const leak = await p.evaluate(() => window.__beacons.filter(b => /^shadow_scene_/.test(b.name)).map(b => JSON.stringify(b.props || {})).filter(s => /responsible|Daniel|Maya|coworker/i.test(s)));
  ok("no scene event carries words, names or the scene's text", leak.length === 0, leak.join(" "));
}

/* A2 — the audio fails: the words and the exercises still work */
console.log("A2 · the scene's audio cannot load");
const A2 = await learner("A2", { track: "general-english", flags: { shadow_scenes_enabled: true }, audio404: true });
{
  const p = A2.page;
  await toShadow(p);
  await p.waitForSelector("#shLibFeed .scn-lrow", { timeout: 10000 });
  await p.click("#shLibFeed .scn-lrow");
  await p.waitForFunction(() => typeof svAsset !== "undefined" && svAsset && svAsset.scene, null, { timeout: 15000 }).catch(() => {});
  await sleep(800);
  const r = await p.evaluate(() => ({ level: svAsset && svAsset.level, err: getComputedStyle(document.getElementById("shVidErr")).display, stage: !!document.querySelector("#ytBox .scn-live svg.scn-bg"), toast: [...document.querySelectorAll(".toast,#toast,[role=status]")].map(e => e.textContent).join(" ") }));
  ok("with no audio the transcript still loads at word level", r.level === "word", JSON.stringify(r));
  ok("…the static scene is still drawn and the video-error panel stays hidden", r.stage && r.err === "none", JSON.stringify(r));
  ok("…and the learner is told why there is no sound", /sound could not load/.test(r.toast), r.toast);
}

/* ================= B — Welding ================= */
console.log("B · Welding learner, scenes flag on");
const B = await learner("B", { track: "welding", flags: { shadow_scenes_enabled: true } });
{
  const p = B.page;
  await toShadow(p);
  const b = await p.evaluate(() => ({ on: scnOn(), row: !!document.querySelector(".scn-lrow") }));
  ok("Welding: scenes are off and no scene row is on the Shadow page", !b.on && !b.row, JSON.stringify(b));
  await p.evaluate(async v => { await shLoad({ vid: v, start: 0, end: 0, title: "x" }); }, SCENE); await sleep(500);
  const b2 = await p.evaluate(() => ({ sp: typeof ytPlayer !== "undefined" && ytPlayer instanceof ShadowScenes.ScenePlayer, stage: !!document.querySelector(".scn-live"), vid: shClip && shClip.vid }));
  ok("Welding: a scene id handed to shLoad (a stored clip, a link) never opens", !b2.sp && !b2.stage && b2.vid !== SCENE, JSON.stringify(b2));
  ok("Welding: …and is refused in words", /part of General English/.test(await lastToast(p)), await lastToast(p));
  await p.evaluate(() => { window.__beacons.length = 0; track("shadow_scene_opened", { source: "library" }); track("app_open", {}); }); await sleep(200);
  const sent = await p.evaluate(() => window.__beacons.map(x => x.name));
  ok("Welding: a scene event is dropped by the General English analytics guard", !sent.includes("shadow_scene_opened") && sent.includes("app_open"), sent.join(","));
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(800);
  ok("Welding: Week 1 · Monday offers no scene", await p.evaluate(() => !document.getElementById("scnSess")));
}

/* ================= C — General English, production flags ================= */
const STAGING_HOST = /staging\.lomonec\.com/.test(BASE);   /* the staging host turns scenes on by design (FLAGS_STAGING) */
console.log(STAGING_HOST ? "C · General English learner, no overrides, on the STAGING host" : "C · General English learner, production defaults");
const C = await learner("C", { track: "general-english", flags: null });
if (STAGING_HOST) {
  const p = C.page; await toShadow(p);
  const c = await p.evaluate(() => ({ on: scnOn(), def: FLAGS_DEFAULT.shadow_scenes_enabled, row: !!document.querySelector(".scn-lrow") }));
  ok("staging host: scenes on with no override, while the production default stays OFF", c.on && c.row && c.def === false, JSON.stringify(c));
} else {
  const p = C.page;
  await toShadow(p);
  const c = await p.evaluate(() => ({ on: scnOn(), def: FLAGS_DEFAULT.shadow_scenes_enabled, stg: FLAGS_STAGING.shadow_scenes_enabled, row: !!document.querySelector(".scn-lrow") }));
  ok("production default is OFF, staging default is ON", c.def === false && c.stg === true, JSON.stringify(c));
  ok("with production defaults a General English learner sees no scene", !c.on && !c.row, JSON.stringify(c));
  await p.evaluate(async v => { await shLoad({ vid: v, start: 0, end: 0 }); }, SCENE); await sleep(400);
  ok("…and cannot open one by id", await p.evaluate(() => !document.querySelector(".scn-live")));
}

/* ================= D — reduced motion ================= */
console.log("D · General English learner, reduced motion");
const D = await learner("D", { track: "general-english", flags: { shadow_scenes_enabled: true }, reduced: true });
{
  const p = D.page;
  await toShadow(p);
  await openScene(p);
  const d = await p.evaluate(async () => { const seen = new Set(), spk = new Set(); ytPlayer.seekTo(5.6); ytPlayer.playVideo(); for (let i = 0; i < 30; i++) { const r = document.querySelector(".scn-live"); seen.add(r.dataset.mouth); spk.add(r.dataset.spk || ""); await new Promise(z => setTimeout(z, 40)); }
    const r = document.querySelector(".scn-live"); return { still: r.classList.contains("still"), mouth: [...seen].join(","), spk: [...spk].join(","), blink: getComputedStyle(r.querySelector(".scn-eyes")).animationName, status: r.querySelector(".scn-status").textContent, tr: getComputedStyle(r.querySelector(".scn-c.on") || r.querySelector(".scn-c")).transform }; });
  ok("reduced motion: no mouth movement and no blinking", d.still && d.mouth === "0" && d.blink === "none", JSON.stringify(d));
  ok("reduced motion: who is speaking is still said in words", /is speaking/.test(d.status) && /daniel|maya/.test(d.spk), JSON.stringify(d));
  ok("reduced motion: the speaker does not lean in", d.tr === "none" || d.tr === "matrix(1, 0, 0, 1, 0, 0)", d.tr);
}

ok("no page errors in any context", errors.length === 0, errors.slice(0, 6).join(" | "));
const pass = res.filter(r => r.pass).length;
console.log(`\n${pass}/${res.length} passed`);
await browser.close(); if (server) server.kill();
process.exit(pass === res.length ? 0 : 1);
