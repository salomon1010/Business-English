/* The three low-severity defects from the real-device QA (docs/REAL_DEVICE_UX_QA_REPORT.md, 29 Sep 2026):
   D1 the Welding fact card beside "Not measured yet" stretched; D2 "best streak" / "consistency" in lower
   case; D3 Arabic "1 كلمات محفوظة". Run: cd tests && node qa-fixes.mjs  (BASE=… / PORT=…) */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8150);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await webkit.launch();
const DAY = 864e5, d = n => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
const F = (o = {}) => ({ placed: "full", finished: true, day: 1, done: {}, ...o });
const words = n => Object.fromEntries(Array.from({ length: n }, (_, i) => ["w" + i, { ts: 1, reps: 1, due: Date.now() + 9e8, tk: ["general-english"] }]));
const seed = (area, o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: area, tradeId: "welder" }, fnd: { "general-english": F(), welding: F() }, areaSplit: true, days: {}, dates: [], dayLog: {}, steps: {}, vocab: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now(), ...o });
async function open(state, { w = 390, lang = "en", theme = "dark", flags = {}, plans = false } = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: w, height: 800 }, serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|youtube\.com|127\.0\.0\.1:9\//.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(([s, th, f, pl]) => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); localStorage.setItem("be12_v1", s); localStorage.setItem("be_theme", th); localStorage.setItem("be_flags", JSON.stringify(Object.assign({}, f, pl ? { billing_enabled: true } : {}))); if (pl) localStorage.setItem("be_ent_api", "http://127.0.0.1:9/ent") } }, [JSON.stringify(state), theme, flags, plans]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1800);
  if (lang !== "en") { await p.evaluate(l => setLang(l), lang); await sleep(1000); }
  return { ctx, p, errs };
}
const view = async (p, v) => { await p.evaluate(v => { document.querySelectorAll("#wcOv,.cf-ov,.wc-ov,#rmCel,#fndCheckOv,.sync-nudge").forEach(e => e.remove()); go(v); scrollTo(0, 0) }, v); await sleep(900); };
const jsErr = errs => errs.filter(e => !/MIME type/.test(e));

console.log("\n# D1 · Welding: a fact card keeps its own height beside 'Not measured yet'");
for (const [w, lang, theme] of [[375, "en", "dark"], [390, "en", "light"], [400, "en", "dark"], [428, "en", "dark"], [430, "fr", "light"], [428, "ar", "dark"]]) {
  const { ctx, p, errs } = await open(seed("welding", { fnd: { "general-english": F() } }), { w, lang, theme }); await view(p, "home");
  const r = await p.evaluate(() => { const g = document.querySelector("#v-home .career-dashboard-grid"), facts = [...g.children];
    const cols = getComputedStyle(g).gridTemplateColumns.split(" ").length;
    const m = facts.find(x => x.querySelector(".career-dash-why")), i = facts.indexOf(m), nb = facts[i % 2 ? i - 1 : i + 1];
    const inner = e => { const r = e.getBoundingClientRect(); let bottom = r.top; for (const c of e.children) bottom = Math.max(bottom, c.getBoundingClientRect().bottom); return Math.round(r.bottom - bottom) };
    return { cols, why: !!m, mH: Math.round(m.getBoundingClientRect().height), nbH: nb ? Math.round(nb.getBoundingClientRect().height) : null, nbEmpty: nb ? inner(nb) : null, sameRow: nb ? Math.abs(nb.getBoundingClientRect().top - m.getBoundingClientRect().top) < 2 : null, off: facts.some(x => x.getBoundingClientRect().right > innerWidth) } });
  /* stretched = the neighbour grew to the milestone card's height; its own 62px minimum is the design */
  const stretched = r.cols === 2 && r.sameRow && r.nbH >= r.mH - 2;
  ok(`${w}px ${lang} ${theme}: the explanation stays; ${r.cols === 1 ? "one column (nothing beside it)" : "the card beside it is not stretched"}; nothing off-screen`, r.why && !stretched && !r.off, JSON.stringify(r));
  ok(`${w}px ${lang}: no JavaScript errors`, !jsErr(errs).length, errs.join(" | ")); await ctx.close();
}

console.log("\n# D2 · 'Best streak' and 'Consistency' in sentence case, like their neighbours");
{ const { ctx, p } = await open(seed("general-english", { days: { w1Mon: true }, dates: [d(1)], dayLog: { [d(1)]: 1 }, dayLogA: { "general-english": { [d(1)]: 1 } } }), { flags: { home_v2_enabled: true } }); await view(p, "review");
  const y = await p.evaluate(() => [...document.querySelectorAll("#v-review .pg-year .pcal-stat span")].map(x => x.innerText));
  ok("billing off, the year card: 'Best streak', 'Days practised', 'Consistency'", y.join("|") === "Best streak|Days practised|Consistency", JSON.stringify(y)); await ctx.close(); }
{ const { ctx, p } = await open(seed("general-english", { days: { w1Mon: true }, dates: [d(1)], dayLog: { [d(1)]: 1 }, dayLogA: { "general-english": { [d(1)]: 1 } } }), { flags: { home_v2_enabled: true }, plans: true }); await view(p, "review");
  const r = await p.evaluate(() => ({ free: [...document.querySelectorAll("#v-review .pf-stats-3 .stat .l")].map(x => x.innerText), card: [...document.querySelectorAll("#v-review .pg-rec-list li")].map(x => x.innerText.trim()) }));
  ok("plans on, a free learner: 'Best streak' among the free counts; the Premium card lists 'Days practised', 'Consistency', 'Your year'", r.free[2] === "Best streak" && r.card.join("|") === "Days practised|Consistency|Your year", JSON.stringify(r)); await ctx.close(); }
for (const [lang, want] of [["fr", ["Meilleure série", "Régularité"]], ["ar", ["أفضل سلسلة", "الانتظام"]]]) {
  const { ctx, p } = await open(seed("general-english", { days: { w1Mon: true }, dates: [d(1)], dayLog: { [d(1)]: 1 }, dayLogA: { "general-english": { [d(1)]: 1 } } }), { lang, flags: { home_v2_enabled: true } }); await view(p, "review");
  const y = await p.evaluate(() => [...document.querySelectorAll("#v-review .pg-year .pcal-stat span")].map(x => x.innerText));
  ok(`${lang}: the year card reads '${want[0]}' and '${want[1]}' (meaning unchanged)`, y[0] === want[0] && y[2] === want[1], JSON.stringify(y)); await ctx.close();
}

console.log("\n# D3 · saved-word counts read correctly — Arabic's singular, dual, 3–10 and 11+ forms");
{ const { ctx, p } = await open(seed("general-english"), { lang: "ar" });
  const r = await p.evaluate(() => Object.fromEntries([1, 2, 3, 10, 11, 99, 100].map(n => [n, tCount("pg.have_words", n)])));
  const want = { 1: "كلمة واحدة محفوظة", 2: "كلمتان محفوظتان", 3: "3 كلمات محفوظة", 10: "10 كلمات محفوظة", 11: "11 كلمة محفوظة", 99: "99 كلمة محفوظة", 100: "100 كلمة محفوظة" };
  for (const n of Object.keys(want)) ok(`ar · ${n}: ${want[n]}`, r[n] === want[n], r[n]);
  await ctx.close(); }
for (const [n, want] of [[0, null], [1, "كلمة واحدة محفوظة"], [2, "كلمتان محفوظتان"], [3, "3 كلمات محفوظة"], [12, "12 كلمة محفوظة"]]) {
  const { ctx, p } = await open(seed("general-english", { vocab: words(n) }), { lang: "ar", w: 375 }); await view(p, "review");
  const r = await p.evaluate(() => { const s = document.querySelector("#v-review .pg-start"); return { panel: !!s, lines: s ? [...s.querySelectorAll(".pg-start-have li")].map(x => x.innerText.trim()) : [], dir: s ? getComputedStyle(s).direction : "" } });
  const line = r.lines.find(x => /كلم/.test(x)) || null;
  ok(`ar · Progress start panel with ${n} saved: ${want === null ? "no saved-words line (nothing to count)" : "'" + want + "'"}, right-to-left`, r.panel && r.dir === "rtl" && line === want, JSON.stringify(r));
  await ctx.close();
}
for (const [lang, n, want] of [["en", 1, "1 word saved"], ["en", 2, "2 words saved"], ["fr", 1, "1 mot enregistré"], ["fr", 5, "5 mots enregistrés"]]) {
  const { ctx, p } = await open(seed("general-english", { vocab: words(n) }), { lang }); await view(p, "review");
  const line = await p.evaluate(() => [...document.querySelectorAll("#v-review .pg-start-have li")].map(x => x.innerText.trim()).find(x => /\d/.test(x) && !/Week|Semaine/.test(x)) || null);
  ok(`${lang} · ${n} saved: '${want}'`, line === want, line); await ctx.close();
}

await b.close(); if (srv) srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
