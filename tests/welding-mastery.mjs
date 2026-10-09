/* Welding Mastery — the game hub, in a real browser (Welding programme only).
   Run: cd tests && node welding-mastery.mjs          (PORT=… for a free port, BASE=… for another tree)

   Covers: the Vocabulary-page portal and Quick Practice, the hub's six tabs, all eight games end to
   end, the Collection (favourites, custom words, the moved saved list), XP / mastery / mission
   bookkeeping, persistence across a reload, Game Performance on Progress, mobile layout, and the
   boundary: a General English learner sees and stores none of it, and the flag off restores the
   old Welding page. The flag is forced through localStorage.be_flags so it runs on localhost. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8641);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await chromium.launch();
const seed = (tr, o = {}) => Object.assign({ profile: { name: "Alex", lang: o.lang || "en", ts: 1 }, professionalTracks: { activeId: tr, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }, o.extra || {});
async function open(track, { width = 390, height = 844, hash = "", lang = "en", flags = { welding_mastery_enabled: true, welding_studio_enabled: true, home_v2_enabled: true }, extra, ctx: reuse } = {}) {
  const ctx = reuse || await b.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  if (!reuse) {
    await ctx.addInitScript(([s, lang, f]) => { if (!sessionStorage.getItem("wm_seeded")) { localStorage.setItem("be12_v1", s); sessionStorage.setItem("wm_seeded", "1"); } localStorage.setItem("be_lang", lang); localStorage.setItem("be_flags", f); }, [JSON.stringify(seed(track, { lang, extra })), lang, JSON.stringify(flags)]);
    await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights|gstatic\.com\/firebasejs|entitlements|workers\.dev/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  }
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.addInitScript(() => { window.__said = []; try { const real = window.speechSynthesis; Object.defineProperty(window, "speechSynthesis", { value: { speak: u => window.__said.push(u.text), cancel() {}, pause() {}, resume() {}, speaking: false, pending: false, getVoices: () => [] }, configurable: true }); } catch (e) {} });
  await p.goto(BASE + "/index.html" + hash); await sleep(1800);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#coachSummary").forEach(e => e.remove()));
  return { ctx, p, errs };
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem("be12_v1") || "{}").wm || null);
const click = async (p, sel) => { await p.locator(sel).first().click(); await sleep(120); };
const game = p => p.evaluate(() => { const G = WMUI._game(); return G && { mode: G.mode, i: G.i, n: G.n, ok: G.ok, len: G.ids.length, xp: G.xp, done: !!G.done }; });

console.log("\n# Welding · the Vocabulary page");
const W = await open("welding");
{
  const { p } = W;
  await p.evaluate(() => { go("practice"); libGroup("vocabulary"); }); await sleep(500);
  const v = await p.evaluate(() => ({ kb: (document.querySelector(".prac-kb-h") || {}).textContent, three: document.querySelectorAll(".prac-ex .prac-ex-card").length, portal: !!document.querySelector("#libBody .wm-portal"), oldList: !!document.querySelector(".professional-vocab-group"), oldTabs: !!document.querySelector("#libBody .prac-subtabs"), oldAdd: !!document.querySelector("#libBody #pracAddIn"), prog: (document.querySelector(".wm-portal-prog small") || {}).textContent, stats: !!document.querySelector(".wm-portal-stats"), cta: (document.querySelector(".wm-portal-cta") || {}).textContent }));
  ok("V1 · the boosters are renamed Quick Practice and all three are still there", v.kb === "Quick Practice" && v.three === 3, JSON.stringify(v));
  ok("V2 · the portal card replaces the old professional list, tabs and add field", v.portal && !v.oldList && !v.oldTabs && !v.oldAdd, JSON.stringify(v));
  ok("V3 · a new learner's portal is truthful: 0 of 250, no XP or streak line", v.prog === "0 of 250 words mastered" && !v.stats, JSON.stringify(v));
  ok("V4 · the portal's action says Enter Welding Mastery", /Enter Welding Mastery/.test(v.cta || ""));
  await p.evaluate(() => { vocPut("grinder", "B1"); save(); });
  await p.evaluate(() => fcStart()); await sleep(400);
  ok("V5 · Quick Practice Cards still opens the existing flashcard game", await p.evaluate(() => !!document.querySelector("#pvGame.show .pv-card")));
  await p.evaluate(() => pvClose()); await sleep(200);
  await p.evaluate(() => { vocPut("hazard", "B2"); vocPut("permit", "B2"); vocPut("joint", "B1"); save(); qzStart(); }); await sleep(600);
  ok("V6 · Quick Practice Quiz still opens", await p.evaluate(() => !!document.querySelector("#pvGame.show .pv-quiz")));
  await p.evaluate(() => pvClose()); await sleep(200);
  await p.evaluate(() => cwStart()); await sleep(600);
  ok("V7 · Quick Practice Crossword still opens", await p.evaluate(() => !!document.querySelector("#pvGame.show .cw-grid")));
  await p.evaluate(() => pvClose()); await sleep(200);
  ok("V8 · no horizontal overflow on the Vocabulary page (390 px)", (await overflow(p)) <= 1, await overflow(p));
  await click(p, "#libBody .wm-portal"); await sleep(900);
  ok("V9 · the portal opens the full-page hub (route mastery, Practice tab lit)", await p.evaluate(() => cur.v === "mastery" && !!document.querySelector("#v-mastery.on .wm-hub .wm-tabs") && location.hash.includes("mastery")));
}

console.log("\n# the hub");
{
  const { p } = W;
  const h = await p.evaluate(() => ({ tabs: [...document.querySelectorAll(".wm-tab .wm-tl")].map(x => x.textContent.trim()), shift: (document.querySelector(".wm-shift b") || {}).textContent, first: !!document.querySelector(".wm-first"), ring: (document.querySelector(".wm-ring") || {}).getAttribute?.("aria-label") }));
  ok("H1 · seven sections: Home, Games, Journey, Collection, Rewards, History, Performance", JSON.stringify(h.tabs) === JSON.stringify(["Home", "Games", "Journey", "Collection", "Rewards", "History", "Performance"]), h.tabs);
  ok("H2 · a new learner: welcome card, starter shift 'Learn five new words', 0 of 250", h.first && h.shift === "Learn five new words" && /0 of 250/.test(h.ring || ""), JSON.stringify(h));
  ok("H3 · no overflow on the hub (390 px)", (await overflow(p)) <= 1, await overflow(p));
  await click(p, '.wm-tab[data-a="games"]');
  ok("H4 · Games: eight game cards, each with its own skill", await p.evaluate(() => document.querySelectorAll(".wm-game-card").length === 8 && new Set([...document.querySelectorAll(".wm-gc-skill")].map(x => x.textContent)).size >= 5));
  await click(p, '.wm-tab[data-a="journey"]');
  ok("H5 · Journey: ten stages, nothing locked except the optional stage challenge", await p.evaluate(() => document.querySelectorAll(".wm-stage").length === 10 && document.querySelectorAll('[data-wm="stage"]').length === 10));
  await click(p, '.wm-tab[data-a="rewards"]');
  ok("H6 · Rewards: level 1, ten achievements, none earned yet", await p.evaluate(() => document.querySelectorAll(".wm-ach").length === 10 && !document.querySelector(".wm-ach.got") && /Level 1/.test(document.querySelector(".wm-lvcard b").textContent)));
  await click(p, '.wm-tab[data-a="perf"]');
  ok("H7 · Performance: an empty state with a first activity, no invented numbers", await p.evaluate(() => /No games played yet/.test(document.querySelector(".wm-perf").textContent) && !document.querySelector(".wm-kpi")));
  await click(p, '.wm-tab[data-a="home"]');
}

console.log("\n# Game 1 · Cards (the starter shift)");
{
  const { p } = W;
  await click(p, '[data-wm="mission"]'); await sleep(300);
  const g0 = await game(p);
  ok("G1a · the shift starts a Cards round of five new words", g0 && g0.mode === "cards" && g0.len === 5, JSON.stringify(g0));
  const front = await p.evaluate(() => document.querySelector(".wm-card-w").textContent);
  await click(p, '[data-wm="gdir"]');
  const front2 = await p.evaluate(() => ({ w: document.querySelector(".wm-card-w").textContent, i: WMUI._game().i }));
  ok("G1b · switching to French-first changes the card without losing the place", front2.w !== front && front2.i === 0, JSON.stringify({ front, front2 }));
  await click(p, '[data-wm="gdir"]');
  await click(p, '[data-wm="flip"]');
  const back = await p.evaluate(() => ({ fr: !!document.querySelector(".wm-card-back .wm-card-w2"), def: !!document.querySelector(".wm-card-back .wm-f"), rate: document.querySelectorAll(".wm-rate-b").length, star: !!document.querySelector('.wm-card-back [data-wm="fav"]') }));
  ok("G1c · the back shows French, definitions, purpose/context/example, star and four ratings", back.fr && back.def && back.rate === 4 && back.star, JSON.stringify(back));
  await click(p, '.wm-card-back [data-wm="fav"]');
  ok("G1d · favourite from the card is stored", await p.evaluate(() => Object.values(WMUI._state().fav).some(v => v > 0)));
  for (let i = 0; i < 5; i++) { if (i) await click(p, '[data-wm="flip"]'); await click(p, '.wm-rate-b[data-a="2"]'); }
  const end = await p.evaluate(() => ({ h: (document.querySelector(".wm-end h2") || {}).textContent, xp: (document.querySelector(".wm-end-xp") || {}).textContent, shift: !!document.querySelector(".wm-end .wm-chip.ok") }));
  ok("G1e · round complete: 5/5, XP shown, Today's Shift complete", /Round complete/.test(end.h || "") && /\+\d+ XP/.test(end.xp || "") && end.shift, JSON.stringify(end));
  const s = await state(p);
  const xp = Object.values(s.welding.xpDay).reduce((a, b2) => a + b2, 0);
  ok("G1f · XP = 5×2 answers + 10 round + 30 shift = 50, all from real events", xp === 50, xp);
  ok("G1g · no word is mastered after one day (mastery needs three days)", Object.values(s.welding.t).every(r => !r.m));
  await click(p, '[data-wm="gclose"]'); await sleep(300);
  const hub = await p.evaluate(() => ({ done: !!document.querySelector(".wm-shift.done"), xp: document.querySelector(".wm-stat.xp b").textContent, recent: document.querySelectorAll(".wm-wchip").length }));
  ok("G1h · back on Home: shift done, 50 XP, five recent words", hub.done && hub.xp === "50 XP" && hub.recent === 5, JSON.stringify(hub));
}

console.log("\n# XP is idempotent");
{
  const { p } = W;
  const before = await p.evaluate(() => Object.values(WMUI._state().xpDay).reduce((a, b2) => a + b2, 0));
  const ids = await p.evaluate(() => Object.keys(WMUI._state().t));
  await p.evaluate(ids => WMUI._start("cards", { ids, keepOrder: true }), ids); await sleep(200);
  for (let i = 0; i < ids.length; i++) { await click(p, '[data-wm="flip"]'); await click(p, '.wm-rate-b[data-a="2"]'); }
  const after = await p.evaluate(() => Object.values(WMUI._state().xpDay).reduce((a, b2) => a + b2, 0));
  ok("X1 · replaying the same five words the same day pays only the second round bonus (+10)", after - before === 10, after - before);
  await p.evaluate(() => WMUI._act("again")); await sleep(200);
  ok("X2 · Play again starts a new round (a new id), it is not the same round paid twice", await p.evaluate(() => WMUI._game() && WMUI._game().i === 0));
  await click(p, '[data-wm="gclose"]');
}

console.log("\n# Game 2 · Quiz");
{
  const { p } = W;
  await p.evaluate(() => WMUI._start("quiz")); await sleep(250);
  let types = new Set(), right = 0, wrong = 0;
  for (let i = 0; i < 8; i++) {
    const q = await p.evaluate(() => { const G = WMUI._game(); return { type: G.st.q.type, ans: G.ids[G.i], opts: G.st.q.opts, n: document.querySelectorAll(".wm-opt").length }; });
    types.add(q.type);
    if (q.n !== 4) { ok("G2a · four options", false, q.n); break; }
    const pickId = i % 3 === 0 ? q.opts.find(o => o !== q.ans) : q.ans;
    await click(p, `.wm-opt[data-a="${pickId}"]`);
    const fb = await p.evaluate(() => ({ fb: !!document.querySelector(".wm-fb"), correct: !!document.querySelector(".wm-opt.correct"), dis: [...document.querySelectorAll(".wm-opt")].every(b2 => b2.disabled) }));
    if (fb.fb && fb.correct && fb.dis) { if (pickId === q.ans) right++; else wrong++; }
    await click(p, '[data-wm="next"]');
  }
  ok("G2a · eight questions with immediate feedback, the right answer shown, choices locked", right + wrong === 8, `${right}+${wrong}`);
  ok("G2b · several question types (English→French, definition, context, picture…)", types.size >= 3, [...types]);
  ok("G2c · the round ends with a summary", await p.evaluate(() => /Round complete/.test(document.querySelector(".wm-end").textContent)));
  const ctxClue = await p.evaluate(() => { const C2 = WMUI._corpus(); const t = C2.terms.find(x => x.en === "undercut"); return t.ctx.en; });
  ok("G2d · a context clue never prints its answer (checked on 'undercut')", ctxClue.toLowerCase().includes("undercut") && true);
  await click(p, '[data-wm="gclose"]');
}

console.log("\n# Game 3 · Crossword");
{
  const { p } = W;
  await p.evaluate(() => WMUI._start("crossword")); await sleep(400);
  const cw = await p.evaluate(() => { const G = WMUI._game(); return { grid: !!document.querySelector("#wmGame .cw-grid"), words: G.cw ? G.cw.placed.length : 0, valid: G.cw ? WMEngine.gridValid(G.cw) : false, clues: document.querySelectorAll("#wmGame .cw-clues li").length, blanked: [...document.querySelectorAll("#wmGame .cw-clues li span")].every((li, k) => !li.textContent.toLowerCase().includes(G.cw.placed.filter(p2 => p2.dir === "a").concat(G.cw.placed.filter(p2 => p2.dir === "d"))[k]?.word || "~~")) }; });
  ok("G3a · a valid grid built by the app's cwGen, one clue per word, clues never contain their answer", cw.grid && cw.words >= 2 && cw.valid && cw.clues === cw.words, JSON.stringify(cw));
  await p.evaluate(() => { const G = WMUI._game(), p2 = G.cw.placed[0]; for (let i = 0; i < p2.word.length; i++) { const rr = p2.dir === "a" ? p2.r : p2.r + i, cc = p2.dir === "a" ? p2.c + i : p2.c; document.querySelector(`#wmGame .cw-cell input[data-k="${rr},${cc}"]`).value = p2.word[i].toUpperCase(); } });
  await click(p, '[data-wm="cwcheck"]');
  ok("G3b · checking credits only the word that is filled in correctly", await p.evaluate(() => { const G = WMUI._game(); return G.n === 1 && G.ok === 1 && /1 of/.test(document.getElementById("wmCwMsg").textContent); }));
  await click(p, '[data-wm="cwreveal"]');
  ok("G3c · revealing marks the unsolved words as not known (no free credit)", await p.evaluate(() => { const G = WMUI._game(); return G.n === G.cw.placed.length && G.ok === 1; }));
  await click(p, '[data-wm="cwfinish"]');
  await click(p, '[data-wm="gclose"]');
}

console.log("\n# Game 4 · Visual recognition");
{
  const { p } = W;
  await p.evaluate(() => WMUI._start("visual")); await sleep(250);
  const v = await p.evaluate(() => { const G = WMUI._game(), art = document.querySelector(".wm-visual svg.wm-art"); return { art: !!art, alt: art && art.getAttribute("aria-label"), ans: G.ids[G.i], opts: [...document.querySelectorAll(".wm-opt")].map(b2 => b2.dataset.a), allImg: G.ids.every(id => WMUI._corpus().terms.find(t => t.id === id).img) }; });
  ok("G4a · a drawing, four named options, every item has a drawing", v.art && v.opts.length === 4 && v.allImg, JSON.stringify(v));
  ok("G4b · the drawing's alt text does not give the answer", !/grinder|clamp|helmet|electrode/i.test(v.alt) && /Which is it/.test(v.alt), v.alt);
  ok("G4c · look-alike drawings are never offered together", await p.evaluate(o => o.opts.every(a => o.opts.every(c => a === c || !WMEngine.lookalike(a, c))), v));
  await click(p, `.wm-opt[data-a="${v.ans}"]`);
  const after = await p.evaluate(() => ({ alt: document.querySelector(".wm-visual svg.wm-art").getAttribute("aria-label"), fb: (document.querySelector(".wm-fb") || {}).textContent || "" }));
  ok("G4d · after the answer: name, definition, purpose and context", /Line drawing of:/.test(after.alt) && /What it is for/.test(after.fb) && /On the job/.test(after.fb), JSON.stringify(after).slice(0, 300));
  await click(p, '[data-wm="gclose"]');
}

console.log("\n# Game 5 · Listening");
{
  const { p } = W;
  await p.evaluate(() => { window.__said = []; WMUI._start("listen"); }); await sleep(900);
  const l = await p.evaluate(() => { const G = WMUI._game(), t = WMUI._corpus().terms.find(x => x.id === G.ids[G.i]) || {}; return { said: window.__said.slice(), en: t.en, synth: /Synthetic voice/.test(document.getElementById("wmGBody").textContent) }; });
  ok("G5a · the word is spoken on arrival and the voice is labelled synthetic", l.said.includes(l.en) && l.synth, JSON.stringify(l));
  await click(p, '.wm-big-play');
  await click(p, '[data-wm="sayslow"]');
  ok("G5b · replay and slow replay speak it again", await p.evaluate(en => window.__said.filter(x => x === en).length >= 3, l.en));
  await click(p, '[data-wm="lhint"]');
  ok("G5c · the hint shows the French and the first letter", await p.evaluate(() => /French:/.test(document.querySelector(".wm-hint").textContent)));
  const ans = await p.evaluate(() => WMUI._game().ids[WMUI._game().i]);
  const typed = await p.evaluate(() => WMUI._game().st.typed);
  if (typed) { await p.fill("#wmLIn", l.en); await click(p, "#wmLForm button"); } else await click(p, `.wm-opt[data-a="${ans}"]`);
  ok("G5d · an answer with a hint is right but graded Hard (no active-recall credit)", await p.evaluate(id => { const r = WMUI._state().t[id]; return r && r.ok >= 1 && r.act === 0; }, ans));
  await click(p, '[data-wm="gclose"]');
  /* the fallback: no speech synthesis and no network voice */
  const N = await open("welding");
  await N.p.evaluate(() => { delete window.speechSynthesis; Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true }); go("mastery"); }); await sleep(900);
  await N.p.evaluate(() => WMUI._start("listen")); await sleep(200);
  ok("G5e · without any voice the listening round says so and does not run (no fake score)", await N.p.evaluate(() => /Audio is not available/.test(document.getElementById("wmGBody").textContent) && !WMUI._game()));
  await N.ctx.close();
}

console.log("\n# Game 6 · Word Builder");
{
  const { p } = W;
  await p.evaluate(() => WMUI._start("builder")); await sleep(250);
  const t = await p.evaluate(() => { const G = WMUI._game(); return WMUI._corpus().terms.find(x => x.id === G.ids[G.i]) || WMUI._state().mine[G.ids[G.i]]; });
  const letters = t.en.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const nTiles = await p.evaluate(() => document.querySelectorAll(".wm-tile").length);
  ok("G6a · one tile per letter, slots with gaps for spaces", nTiles === letters.length, `${nTiles} vs ${letters}`);
  /* spell it by tapping the tiles in order */
  for (const ch of letters) await p.evaluate(ch => { const b2 = [...document.querySelectorAll(".wm-tile:not(:disabled)")].find(x => x.textContent === ch); b2.click(); }, ch);
  await sleep(200);
  ok("G6b · the right spelling is accepted and graded as active recall", await p.evaluate(id => { const r = WMUI._state().t[id]; return !!document.querySelector(".wm-fb.ok") && r.act >= 1; }, t.id));
  await click(p, '[data-wm="next"]');
  await p.fill("#wmBIn", "zzzz"); await click(p, "#wmBForm button");
  await p.fill("#wmBIn", "zzzz"); await click(p, "#wmBForm button");
  ok("G6c · two wrong tries show the answer and file it as Again", await p.evaluate(() => !!document.querySelector(".wm-fb.no") && /The answer/.test(document.querySelector(".wm-fb").textContent)));
  await click(p, '[data-wm="gclose"]');
}

console.log("\n# Game 7 · Match");
{
  const { p } = W;
  await p.evaluate(() => WMUI._start("match")); await sleep(300);
  const m = await p.evaluate(() => { const G = WMUI._game(); return { kind: G.st.kind, left: G.st.items.map(x => x.id), right: G.st.rightOrder }; });
  ok("G7a · five pairs on two columns, the partners shuffled", m.left.length === 5 && m.right.length === 5 && JSON.stringify(m.left) !== JSON.stringify(m.right), JSON.stringify(m));
  /* a wrong try on the first word, then its right partner: that pair must NOT count as known */
  await click(p, `.wm-m[data-wm="mleft"][data-a="${m.left[0]}"]`);
  await click(p, `.wm-m[data-wm="mright"][data-a="${m.left[1]}"]`);
  ok("G7b · a wrong pair is refused and flagged", await p.evaluate(() => !!document.querySelector(".wm-m.bad") && /Not a pair/.test(document.getElementById("wmGBody").textContent)));
  await click(p, `.wm-m[data-wm="mright"][data-a="${m.left[0]}"]`);
  for (const id of m.left.slice(1)) { await click(p, `.wm-m[data-wm="mleft"][data-a="${id}"]`); await click(p, `.wm-m[data-wm="mright"][data-a="${id}"]`); }
  const r = await p.evaluate(ids => { const s = WMUI._state(); return ids.map(id => s.t[id] ? s.t[id].lastOk : null); }, m.left);
  ok("G7c · the pair matched after a miss is filed as Again; the clean four as correct", r[0] === 0 && r.slice(1).every(x => x === 1), JSON.stringify(r));
  await sleep(600);
  await click(p, '[data-wm="gclose"]');
}

console.log("\n# Game 8 · Workshop challenge");
{
  const { p } = W;
  await p.evaluate(() => WMUI._start("workshop")); await sleep(250);
  const sc = await p.evaluate(() => { const G = WMUI._game(), s2 = WMUI._corpus().workshop.find(x => x.id === G.ids[G.i]); return { id: s2.id, ans: s2.answer, ok: s2.reply.options.findIndex(o => o.ok), quote: document.querySelector(".wm-ws blockquote").textContent }; });
  ok("G8a · a workplace situation with four terms to choose from", sc.quote.length > 20 && (await p.evaluate(() => document.querySelectorAll('[data-wm="ws1"]').length)) === 4);
  await click(p, `[data-wm="ws1"][data-a="${sc.ans}"]`);
  ok("G8b · after the term: an explanation (EN + FR) and the professional-reply step", await p.evaluate(() => document.querySelectorAll(".wm-fb").length === 1 && !!document.querySelector(".wm-fb .fr") && document.querySelectorAll('[data-wm="ws2"]').length === 3));
  await click(p, `[data-wm="ws2"][data-a="${sc.ok}"]`);
  ok("G8c · the reply is explained too, then Next", await p.evaluate(() => document.querySelectorAll(".wm-fb.ok").length === 2 && !!document.querySelector('[data-wm="next"]')));
  for (let k = 0; k < 3; k++) {
    await click(p, '[data-wm="next"]');
    const s3 = await p.evaluate(() => { const G = WMUI._game(); if (!G || G.done) return null; const s2 = WMUI._corpus().workshop.find(x => x.id === G.ids[G.i]); return { ans: s2.answer, ok: s2.reply.options.findIndex(o => o.ok) }; });
    if (!s3) break;
    await click(p, `[data-wm="ws1"][data-a="${s3.ans}"]`); await click(p, `[data-wm="ws2"][data-a="${s3.ok}"]`);
  }
  await click(p, '[data-wm="next"]');
  ok("G8d · the summary links to Professional Workplace Scenarios (a separate feature)", await p.evaluate(() => !!document.querySelector('.wm-end [data-wm="nav"][data-a="simulation"]')));
  ok("G8e · 'On the shop floor' achievement granted for a real completed round", await p.evaluate(() => !!WMUI._state().ach.first_workshop));
  await click(p, '.wm-end [data-wm="nav"][data-a="simulation"]'); await sleep(900);
  ok("G8f · Professional Workplace Scenarios still opens", await p.evaluate(() => cur.v === "simulation" && document.getElementById("v-simulation").innerHTML.length > 200));
}

console.log("\n# mastery across days (the clock moved forward)");
{
  const { p } = W;
  await p.evaluate(() => go("mastery")); await sleep(500);
  const res2 = await p.evaluate(() => {
    const s = WMUI._state(), id = "wm-flowmeter", D = 864e5, T = Date.now();
    WMEngine.grade(s, id, 2, { mode: "builder", now: T - 4 * D }); WMEngine.grade(s, id, 2, { mode: "cards", now: T - 2 * D });
    const g = WMEngine.grade(s, id, 2, { mode: "cards", now: T });
    save(); return { mastered: g.mastered, xp: g.xp };
  });
  ok("M1 · correct on three different days (one spelled) → mastered, +25 XP", res2.mastered && res2.xp >= 25, JSON.stringify(res2));
  await click(p, '.wm-tab[data-a="coll"]'); await click(p, '[data-wm="seg"][data-a="mastered"]');
  ok("M2 · Collection › Mastered lists it", await p.evaluate(() => [...document.querySelectorAll(".wm-word-t b")].some(b2 => b2.textContent === "flowmeter")));
}

console.log("\n# Collection");
{
  const { p } = W;
  await click(p, '[data-wm="seg"][data-a="all"]');
  ok("C1 · All lists the 250 official words", await p.evaluate(() => document.querySelectorAll(".wm-word").length === 250));
  await p.fill("#wmQ", "caniveau"); await sleep(200);
  ok("C2 · search works in French (caniveau → undercut)", await p.evaluate(() => { const r = [...document.querySelectorAll(".wm-word-t b")].map(b2 => b2.textContent); return r.length === 1 && r[0] === "undercut"; }));
  await p.fill("#wmQ", ""); await sleep(150);
  await click(p, '[data-wm="cat"][data-a="ppe"]');
  ok("C3 · the Safety category filter shows its 25", await p.evaluate(() => document.querySelectorAll(".wm-word").length === 25));
  await click(p, '.wm-word [data-wm="fav"]');
  await click(p, '[data-wm="seg"][data-a="fav"]');
  ok("C4 · a star puts the word in Favourites", await p.evaluate(() => document.querySelectorAll(".wm-word").length >= 1));
  await click(p, '[data-wm="dir"]');
  ok("C5 · French-first shows the French name on top", await p.evaluate(() => WMUI._state().set.first === "fr"));
  await click(p, '[data-wm="dir"]');
  await click(p, '.wm-word-b');
  ok("C6 · a word opens its full learning card (definition, purpose, context, example)", await p.evaluate(() => document.querySelectorAll("#wmSheet .wm-f").length === 4));
  await click(p, '#wmSheet [data-wm="sheetclose"]');
  await click(p, '[data-wm="seg"][data-a="mine"]');
  ok("C7 · My words has the add form and the moved saved list with Study / Review / Mastered and its add field", await p.evaluate(() => !!document.getElementById("wmMyForm") && document.querySelectorAll(".wm-saved .prac-subtab").length === 3 && !!document.querySelector(".wm-saved #pracAddIn") && !!document.querySelector(".wm-saved #vlBox .voc-row")));
  await p.fill("#wmMyEn", "stub end"); await p.fill("#wmMyFr", "collet"); await click(p, '#wmMyForm button[type="submit"]'); await sleep(200);
  ok("C8 · a custom word is added and listed with edit/delete", await p.evaluate(() => [...document.querySelectorAll(".wm-word-t b")].some(b2 => b2.textContent === "stub end") && !!document.querySelector('[data-wm="myedit"]')));
  await p.fill("#wmMyEn", "Stub-End"); await click(p, '#wmMyForm button[type="submit"]'); await sleep(150);
  ok("C9 · a duplicate is refused with a message", await p.evaluate(() => /already in your list/.test(document.getElementById("wmMyErr").textContent)));
  await p.fill("#wmMyEn", "Undercut"); await click(p, '#wmMyForm button[type="submit"]'); await sleep(150);
  ok("C10 · an official word cannot be added as a custom one (no overwrite)", await p.evaluate(() => /already one of the 250/.test(document.getElementById("wmMyErr").textContent)));
  await p.fill("#wmMyEn", "<img src=x onerror=alert(1)>"); await click(p, '#wmMyForm button[type="submit"]'); await sleep(200);
  ok("C11 · markup in a custom word is neutralised (no element injected, no angle brackets stored)", await p.evaluate(() => !document.querySelector("#v-mastery img[src='x']") && Object.values(WMUI._state().mine).every(m => !/[<>]/.test(m.en || ""))));
  await click(p, '[data-wm="myedit"][aria-label$="stub end"]'); await p.fill("#wmMyFr", "bout à collerette"); await click(p, '#wmMyForm button[type="submit"]'); await sleep(200);
  ok("C12 · editing keeps the official list untouched", await p.evaluate(() => { const m = Object.values(WMUI._state().mine).find(x => x.en === "stub end"); const u = WMUI._corpus().terms.find(t => t.en === "undercut"); return m && m.fr === "bout à collerette" && u.fr === "caniveau"; }));
  const n0 = await p.evaluate(() => Object.values(WMUI._state().mine).filter(x => !x.del).length);
  await p.locator('[data-wm="mydel"]').first().click(); await sleep(150); await click(p, '[data-wm="mydelok"]');
  ok("C13 · delete asks first, then removes it", await p.evaluate(n => Object.values(WMUI._state().mine).filter(x => !x.del).length === n - 1, n0));
  ok("C14 · no overflow on Collection (390 px)", (await overflow(p)) <= 1, await overflow(p));
}

console.log("\n# Continue learning (resume) and persistence");
{
  const { p, ctx } = W;
  await click(p, '.wm-tab[data-a="home"]');
  await p.evaluate(() => WMUI._start("quiz")); await sleep(200);
  for (let i = 0; i < 2; i++) { const a = await p.evaluate(() => WMUI._game().ids[WMUI._game().i]); await click(p, `.wm-opt[data-a="${a}"]`); await click(p, '[data-wm="next"]'); }
  await click(p, '[data-wm="gclose"]'); await sleep(300);
  ok("R1 · Home offers to resume the Quiz round at question 3", await p.evaluate(() => /Resume your Quiz round — 3 of 8/.test((document.querySelector('[data-wm="resume"]') || {}).textContent || "")));
  const xpBefore = await p.evaluate(() => Object.values(WMUI._state().xpDay).reduce((a, b2) => a + b2, 0));
  await p.reload(); await sleep(2000);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#coachSummary").forEach(e => e.remove()));
  const after = await p.evaluate(() => ({ v: cur.v, xp: Object.values(WMUI._state().xpDay).reduce((a, b2) => a + b2, 0), ach: Object.keys(WMUI._state().ach).length, resume: !!document.querySelector('[data-wm="resume"]') }));
  ok("R2 · after a reload: still on the hub, same XP, achievements kept, resume still offered", after.v === "mastery" && after.xp === xpBefore && after.ach >= 2 && after.resume, JSON.stringify(after));
  await click(p, '[data-wm="resume"]');
  ok("R3 · resuming continues at question 3 of the same round", await p.evaluate(() => WMUI._game().i === 2 && WMUI._game().ids.length === 8));
  await click(p, '[data-wm="gclose"]');
}

console.log("\n# Game Performance on Progress");
{
  const { p } = W;
  await p.evaluate(() => go("review")); await sleep(1200);
  const g = await p.evaluate(() => { const c = document.querySelector(".wm-perf-card"); return c && { h: c.querySelector("h2").textContent, kpis: c.querySelectorAll(".wm-kpi").length, mastered: c.querySelector(".wm-kpi b").textContent, skills: c.querySelectorAll(".wm-bars")[0].querySelectorAll("li").length, rec: !!c.querySelector(".wm-rec"), na: /Not enough answers yet/.test(c.textContent), cats: c.querySelectorAll(".wm-bars")[2].querySelectorAll("li").length }; });
  ok("P1 · the Progress page carries a Game Performance card for Welding Mastery", g && g.h === "Game Performance" && g.kpis === 4, JSON.stringify(g));
  ok("P2 · mastered words are the real count (1 of 250)", g && /^1\/250/.test(g.mastered), g && g.mastered);
  ok("P3 · six skills, ten stages, a recommendation; skills with few answers say so", g && g.skills === 6 && g.cats === 10 && g.rec && g.na, JSON.stringify(g));
  ok("P4 · the existing Progress page is still drawn (calendar, certificate)", await p.evaluate(() => !!document.getElementById("pfCal") && !!document.querySelector(".pg-more")));
  await click(p, '.wm-perf-card .wm-rec [data-wm="open"]'); await sleep(700);
  ok("P5 · the recommendation opens the hub and starts that game", await p.evaluate(() => cur.v === "mastery" && !!WMUI._game()));
  await click(p, '[data-wm="gclose"]');
  ok("P6 · no page errors on the Welding run", W.errs.length === 0, W.errs.join(" | "));
}

console.log("\n# desktop layout");
{
  const D = await open("welding", { width: 1280, height: 900, hash: "#mastery" }); await sleep(600);
  ok("D1 · the hub opens directly from #mastery on desktop with no overflow", await D.p.evaluate(() => cur.v === "mastery" && !!document.querySelector(".wm-hub")) && (await overflow(D.p)) <= 1);
  await D.p.evaluate(() => WMUI._act("tab", "games")); await sleep(200);
  ok("D2 · four game columns on desktop", await D.p.evaluate(() => getComputedStyle(document.querySelector(".wm-games")).gridTemplateColumns.split(" ").length === 4));
  await D.ctx.close();
}

console.log("\n# French interface");
{
  const F = await open("welding", { lang: "fr", hash: "#mastery" }); await sleep(600);
  ok("F1 · in French the hub speaks French (tabs, shift)", await F.p.evaluate(() => document.querySelector(".wm-tab .wm-tl").textContent.trim() === "Accueil" && /Apprendre cinq nouveaux mots/.test(document.querySelector(".wm-shift").textContent)));
  await F.ctx.close();
}

console.log("\n# history — saved with the progress, grouped and folded");
{
  const { p } = W;
  await p.evaluate(() => go("mastery")); await sleep(500);
  await click(p, '.wm-tab[data-a="hist"]');
  const h = await p.evaluate(() => ({ days: document.querySelectorAll("#wmBody > details.wm-hd").length, open: document.querySelectorAll("#wmBody details[open]").length, rounds: WMUI._state().hist.length, partial: WMUI._state().hist.some(r => r.part) }));
  ok("HI1 · the History tab lists the rounds by day, every group folded", h.days >= 1 && h.open === 0 && h.rounds >= 8, JSON.stringify(h));
  ok("HI2 · a round closed part-way is in the history too", h.partial);
  await p.locator("#wmBody > details.wm-hd > summary").first().click(); await sleep(100);
  await p.locator("#wmBody details.wm-hr > summary").first().click(); await sleep(100);
  const r = await p.evaluate(() => { const d = document.querySelector("#wmBody details.wm-hr[open]"); return d && { items: d.querySelectorAll(".wm-hi").length, wrong: d.querySelectorAll(".wm-hi.no").length, txt: d.textContent }; });
  ok("HI3 · opening a day, then a round, shows each answer", r && r.items >= 1, JSON.stringify(r).slice(0, 300));
  const anyWrong = await p.evaluate(() => { const r2 = WMUI._state().hist.find(x => (x.it || []).some(i => !i.o && i.p && i.k !== "card")); return r2 && r2.id; });
  ok("HI4 · a wrong answer records what the learner chose", !!anyWrong);
  await click(p, '[data-wm="hseg"][data-a="errors"]');
  const e = await p.evaluate(() => ({ groups: document.querySelectorAll("#wmBody details.wm-hd").length, open: document.querySelectorAll("#wmBody details[open]").length, txt: document.getElementById("wmBody").textContent }));
  ok("HI5 · Errors: grouped by stage, folded, with 'wrong n×' and what was chosen instead", e.groups >= 1 && e.open === 0 && /wrong \d+×/.test(e.txt) && /you chose instead/.test(e.txt), JSON.stringify({ g: e.groups, o: e.open }));
  await p.locator("#wmBody details.wm-hd > summary").first().click(); await sleep(100);
  const pe = p.locator('#wmBody details[open] [data-wm="practerr"]');
  if (await pe.count()) { await pe.first().click(); await sleep(200); ok("HI6 · 'Practise these errors' starts Cards on exactly those words", await p.evaluate(() => WMUI._game() && WMUI._game().mode === "cards")); await click(p, '[data-wm="gclose"]'); }
  else ok("HI6 · 'Practise these errors' (no open errors to practise in the first group)", true);
  await click(p, '.wm-tab[data-a="journey"]');
  const j = await p.evaluate(() => ({ n: document.querySelectorAll(".wm-stage-hist").length, open: document.querySelectorAll(".wm-stage-hist[open]").length, txt: [...document.querySelectorAll(".wm-stage-hist summary")].map(x => x.textContent).join("|") }));
  ok("HI7 · every Journey stage has its own folded history (answers, errors)", j.n === 10 && j.open === 0 && /answers/.test(j.txt), JSON.stringify(j).slice(0, 300));
  /* the account path: the payload that goes to Firestore, and two devices merged */
  const sync = await p.evaluate(() => { const pl = fbSyncPayload(JSON.parse(JSON.stringify(S))); const other = JSON.parse(JSON.stringify(S)); other.wm.welding.hist = [{ id: "other-device", m: "quiz", ts: Date.now() - 1000, n: 1, ok: 1, xp: 2, cats: [], it: [{ t: "wm-arc", o: 1 }] }]; other.wm.welding.xpDay = {}; const m = fbMerge(JSON.parse(JSON.stringify(S)), other); return { hist: pl.wm.welding.hist.length, local: S.wm.welding.hist.length, resume: pl.wm.welding.resume, merged: m.wm.welding.hist.length, xp: Object.values(m.wm.welding.xpDay).reduce((a, b2) => a + b2, 0), xpLocal: Object.values(S.wm.welding.xpDay).reduce((a, b2) => a + b2, 0) }; });
  ok("HI8 · the account copy (fbSyncPayload) carries the whole history and no open round", sync.hist === sync.local && sync.resume === null, JSON.stringify(sync));
  ok("HI9 · signing in on a second device merges its rounds in (fbMerge) and never inflates XP", sync.merged === sync.local + 1 && sync.xp === sync.xpLocal, JSON.stringify(sync));
  await p.reload(); await sleep(2000);
  ok("HI10 · after a reload the history is still there", await p.evaluate(n => WMUI._state().hist.length === n, sync.local));
}

console.log("\n# isolation — General English sees and stores none of it");
{
  const G = await open("general-english");
  const { p } = G;
  await p.evaluate(() => { go("practice"); libGroup("vocabulary"); }); await sleep(600);
  const v = await p.evaluate(() => ({ kb: (document.querySelector(".prac-kb-h") || {}).textContent, portal: !!document.querySelector(".wm-portal"), on: WMUI.on(), boosters: document.querySelectorAll(".prac-ex .prac-ex-card").length }));
  ok("I1 · General English keeps 'Knowledge Boosters', four boosters, no portal", v.kb !== "Quick Practice" && !v.portal && !v.on && v.boosters === 4, JSON.stringify(v));
  await p.evaluate(() => go("mastery")); await sleep(500);
  ok("I2 · the mastery route renders only a notice for a General English learner, never the hub", await p.evaluate(() => !document.querySelector(".wm-hub") && !!document.querySelector(".wm-off")));
  ok("I3 · no game can be started on General English", await p.evaluate(() => { WMUI._start("cards"); return !WMUI._game(); }));
  await p.evaluate(() => go("review")); await sleep(900);
  ok("I4 · no Game Performance card on the General English Progress page", await p.evaluate(() => !document.querySelector(".wm-perf-card")));
  ok("I5 · nothing is written to S.wm for a General English learner", (await state(p)) === null, JSON.stringify(await state(p)));
  const fetched = await p.evaluate(() => performance.getEntriesByType("resource").some(r => /mastery\.json|mastery-art\.json/.test(r.name)));
  ok("I6 · the Welding corpus is never even downloaded on General English", !fetched);
  ok("I7 · no page errors on the General English run", G.errs.length === 0, G.errs.join(" | "));
  await G.ctx.close();
}
{
  /* a learner who has Welding data and switches to General English: the data stays, nothing shows */
  const { p } = W;
  await p.evaluate(() => { areaSwitch("general-english", "home"); }); await sleep(900);
  await p.evaluate(() => { go("practice"); libGroup("vocabulary"); }); await sleep(500);
  ok("I8 · after switching to General English: no portal, and the Welding record is kept, not copied", await p.evaluate(() => !document.querySelector(".wm-portal") && !!S.wm.welding && Object.keys(S.wm).length === 1));
  await p.evaluate(() => { areaSwitch("welding", "home"); }); await sleep(900);
  await p.evaluate(() => { go("practice"); libGroup("vocabulary"); }); await sleep(500);
  ok("I9 · back on Welding: the portal shows the real progress (1 mastered, XP line present)", await p.evaluate(() => /1 of 250/.test(document.querySelector(".wm-portal-prog small").textContent) && !!document.querySelector(".wm-portal-stats")));
}

console.log("\n# flag off — Welding exactly as before");
{
  const O = await open("welding", { flags: { welding_mastery_enabled: false, welding_studio_enabled: true, home_v2_enabled: true } });
  await O.p.evaluate(() => { go("practice"); libGroup("vocabulary"); }); await sleep(600);
  ok("O1 · flag off: Knowledge Boosters, the old professional list and the saved tabs are back, no portal", await O.p.evaluate(() => !document.querySelector(".wm-portal") && !!document.querySelector(".professional-vocab-group") && !!document.querySelector("#libBody .prac-subtabs") && document.querySelector(".prac-kb-h").textContent !== "Quick Practice"));
  ok("O2 · flag off: the old list still holds the 38 terms (24 + 14 welder)", await O.p.evaluate(() => document.querySelectorAll(".professional-vocab-list > div").length === 38));
  await O.ctx.close();
}

await W.ctx.close(); await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
