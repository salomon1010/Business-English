/* Premium value + acquisition — Shadow saved videos (Free 5 / Premium 100),
   YouTube imports (Free 2 / Premium 20), Polish history (Free latest 1 /
   Premium last 50), the launch offer, and the cloud copy's size guard.
   Run: cd tests && node premium-value.mjs

   What is real: index.html, the curated catalogue, and the entitlement Worker
   (backend/entitlements handle(), real SQLite) — the ONLY thing that makes an
   account Premium here; rows go straight into its database, as a verified
   purchase would write them. What is played: Firestore (a fake that refuses a
   document over 1 MiB, as Firestore does), Play Billing (the Digital Goods API
   + Payment Request as a TWA exposes them), the Polish Worker (counted, so a
   transcription request that should not happen is seen), and the YouTube
   player (shLoad is recorded, not run). Identity uses DEV_AUTH. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite"; import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { handle } from "../backend/entitlements/entitlements-worker.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8097), BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.SHOTS || ""; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 600)}`); };
const b = await chromium.launch();
const DAY = 864e5, NOW = Date.now();
const CAT = JSON.parse(readFileSync(new URL("../catalogue/general.json", import.meta.url), "utf8"));
const LIB = Object.keys(CAT.videos);                               // the curated catalogue ids
const yt = i => "y" + String(i).padStart(10, "0");                 // pasted, not in the catalogue
const wv = i => "w" + String(i).padStart(10, "0");

/* ---- the real entitlement Worker over an in-memory D1 */
const db = new DatabaseSync(":memory:");
for (const m of readdirSync(new URL("../backend/entitlements/migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).sort()) db.exec(readFileSync(new URL("../backend/entitlements/migrations/" + m, import.meta.url), "utf8"));
const D1 = { prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; } };
const WENV = { DB: D1, FIREBASE_PROJECT_ID: "be-mastery", DEV_AUTH: "1", PLAY_PACKAGE: "com.bemastery.app" };
const grant = (uid, { status = "active", expires = NOW + 30 * DAY } = {}) =>
  db.prepare("INSERT OR REPLACE INTO entitlements(uid,plan,product,status,starts_at,expires_at,source,external_ref,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
    .run("dev:" + uid, "premium", "premium_annual", status, NOW - DAY, expires, "google_play", "test", Date.now());   /* DEV_AUTH identities are "dev:<name>" */

const PLAY_STUB = trial => {
  window.__play = { shows: [], lists: 0 };
  window.getDigitalGoodsService = async m => { if (m !== "https://play.google.com/billing") throw new Error("x"); return {
    getDetails: async ids => [{ itemId: "premium_monthly", title: "Premium (monthly)", price: { currency: "USD", value: "4.99" }, subscriptionPeriod: "P1M", ...(trial ? { freeTrialPeriod: "P3D" } : {}) }, { itemId: "premium_annual", title: "Premium (annual)", price: { currency: "USD", value: "19.99" }, subscriptionPeriod: "P1Y" }].filter(d => ids.includes(d.itemId)),
    listPurchases: async () => { window.__play.lists++; return []; } }; };
  window.PaymentRequest = class { constructor(m) { this.sku = m[0].data.sku; } async show() { window.__play.shows.push(this.sku); throw new DOMException("closed", "AbortError"); } };
};
const seed = (tr, extra = {}) => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1, ...extra });
const NET = { down: false };
/* billing: true → billing_enabled (plan limits ON); false → the shipped default */
async function open({ track = "general-english", uid = null, billing = true, extra = {}, trial = true, vp = { width: 390, height: 844 }, theme = null, motion = null, keepLaunch = false, ctx: reuse = null } = {}) {
  const ctx = reuse || await b.newContext({ viewport: vp, serviceWorkers: "block", reducedMotion: motion || "no-preference" });
  const polish = [];
  if (!reuse) {
    await ctx.addInitScript(([s, bill, theme]) => {
      if (!localStorage.getItem("__seeded")) { localStorage.setItem("be12_v1", s); localStorage.setItem("__seeded", "1"); }
      localStorage.setItem("be_ent_api", "http://ent.test");
      if (bill) localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: true }));
      if (theme) localStorage.setItem("be_theme", theme);
    }, [seed(track, extra), billing, theme]);
    await ctx.addInitScript(PLAY_STUB, trial);
    await ctx.route(u => /be-events|be-partner|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube\.com|youtube-nocookie/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
    await ctx.route(u => /be-polish/.test(u.href), async r => {
      let body = {}; try { body = JSON.parse(r.request().postData() || "{}"); } catch (e) {}
      const kind = body.ytai ? "ytai" : body.captions ? "captions" : "other"; polish.push({ kind, vid: body.ytai || body.captions || null });
      if (kind === "ytai") return r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ vid: body.ytai, source: "gemini", lang: "en", cues: [{ t: 0, txt: "hello there" }, { t: 3, txt: "second line" }] }) });
      return r.fulfill({ status: 404, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" });
    });
    await ctx.route("http://ent.test/**", async r => {
      const q = r.request(), h = { ...q.headers() };
      if (NET.down) return r.abort("internetdisconnected");
      const m = /^Bearer test-token-(.+)$/.exec(h.authorization || ""); if (m) { h["x-dev-user"] = m[1]; delete h.authorization; }
      const resp = await handle(new Request(q.url(), { method: q.method(), headers: h, body: ["GET", "HEAD"].includes(q.method()) ? undefined : q.postData() }), WENV, {});
      await r.fulfill({ status: resp.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await resp.text() });
    });
  }
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1400);
  await p.evaluate(keep => {
    document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove());
    window.__loads = []; window.shLoad = async c => { __loads.push(c.vid); };            /* the player is not under test */
    window.__asks = []; window.askConfirm = async o => { __asks.push(o); return !!window.__yes; };
    if (!keep) try { sessionStorage.setItem("be_prem_launch", "1"); } catch (e) {}       /* the launch offer has its own section */
    window.__writes = []; window.__doc = null; window.__refused = 0;
    window.firebase = window.firebase || { firestore: { FieldValue: { serverTimestamp: () => "ts" } } };
  }, keepLaunch);
  if (uid) await p.evaluate(async uid => { FBUser = { uid, email: uid + "@test", getIdToken: async () => "test-token-" + uid }; await entRefresh(); await Billing.init(); }, uid);
  return { ctx, p, errs, polish };
}
const paste = (p, id) => p.evaluate(async id => {
  let u = document.getElementById("shUrl"); if (!u) { u = document.createElement("input"); u.id = "shUrl"; u.hidden = true; document.body.appendChild(u); }
  u.value = "https://youtu.be/" + id; document.getElementById("toast").textContent = ""; const a = __asks.length, l = __loads.length;
  await shLoadFromInput();
  return { toast: document.getElementById("toast").textContent, ask: __asks.length > a ? __asks[__asks.length - 1] : null, loaded: __loads.length > l, lib: shOwnCount("lib"), yt: shOwnCount("yt"), n: shOwn().length };
}, id);
const libSave = (p, id) => p.evaluate(async id => { document.getElementById("toast").textContent = ""; const a = __asks.length; await shLibSave(id); return { toast: document.getElementById("toast").textContent, ask: __asks.length > a ? __asks[__asks.length - 1] : null, lib: shOwnCount("lib"), n: shOwn().length }; }, id);
const bulk = (p, ids, kind) => p.evaluate(([ids, kind]) => ids.map(v => shOwnAdd(v, v, kind)), [ids, kind]);

console.log("\n# production default — billing off: the app is as it was");
{
  const { ctx, p, errs } = await open({ billing: false, uid: "prod" });
  const r = [];
  for (let i = 1; i <= 6; i++) r.push(await paste(p, yt(i)));
  ok("P1 · pasted links share one list of 5, the sixth refused with the old message, and still plays", r.slice(0, 5).every((x, i) => x.toast === `Saved to Your videos (${i + 1}/5)`) && r[5].n === 5 && r[5].toast === "You already have 5 of your own videos — remove one to keep this one" && r[5].loaded, JSON.stringify(r[5]));
  const ui = await p.evaluate(async () => { go("shadow"); await new Promise(r => setTimeout(r, 700)); return { bookmark: document.querySelectorAll(".shl-save").length, planOn: planOn() }; });
  ok("P2 · no bookmark on library rows, plan limits off", ui.bookmark === 0 && ui.planOn === false, JSON.stringify(ui));
  ok("P3 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# A · curated library + saved Shadow videos (General English)");
{
  ok("A0 · the catalogue is intact: 301 videos, 5 categories, 295 caption files", LIB.length === 301 && CAT.categories.length === 5 && LIB.filter(v => { try { readFileSync(new URL("../captions/" + v + ".json", import.meta.url)); return true; } catch (e) { return false; } }).length === 295);
  const { ctx, p, errs, polish } = await open({ uid: "fa" });
  const r = []; for (let i = 0; i < 2; i++) r.push(await libSave(p, LIB[i]));
  ok("A1 · Free saves 1–2 library videos: 'Saved to Your videos (n/2)' (owner, 27 Sep 2026: 5 → 2)", r.every((x, i) => x.lib === i + 1 && x.toast === `Saved to Your videos (${i + 1}/2)`), JSON.stringify(r.map(x => x.toast)));
  const six = await libSave(p, LIB[2]);
  ok("A2 · the third is refused and explained: 'You've saved 2 Shadow videos' — Premium saves up to 100", six.lib === 2 && six.ask && six.ask.title === "You've saved 2 Shadow videos" && /Premium lets you save up to 100/.test(six.ask.body) && six.ask.confirmLabel === "See Premium plans", JSON.stringify(six));
  const all = await p.evaluate(async ids => { const out = []; for (const v of ids) { shLibOpen(v); } await new Promise(r => setTimeout(r, 50)); return { loads: __loads.length, cats: _shCat.categories.map(c => c.vids.length) }; }, LIB);
  ok("A3 · with the saved list full, every one of the 301 library videos still opens", all.loads === 301 && JSON.stringify(all.cats) === JSON.stringify(CAT.categories.map(c => c.vids.length)), JSON.stringify(all));
  const rows = await p.evaluate(async () => { go("shadow"); await new Promise(r => setTimeout(r, 800)); const b = [...document.querySelectorAll(".shl-save")]; return { n: b.length, on: b.filter(x => x.getAttribute("aria-pressed") === "true").length, big: b.length && b[0].getBoundingClientRect().height >= 44 }; });
  ok("A4 · library rows carry a bookmark (44 px), saved ones pressed", rows.n > 0 && rows.on >= 1 && rows.big, JSON.stringify(rows));
  const un = await libSave(p, LIB[0]);
  ok("A5 · tapping a saved bookmark removes it and frees the slot", un.lib === 1 && un.toast === "Removed from your saved videos" && (await libSave(p, LIB[5])).lib === 2);
  ok("A6 · saving and opening library videos made no transcription request", polish.filter(x => x.kind === "ytai").length === 0, JSON.stringify(polish));
  ok("A7 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
  grant("pa");
  const P = await open({ uid: "pa" });
  const st = await bulk(P.p, LIB.slice(0, 100), "lib");
  ok("A8 · Premium (from the Worker) saves library videos 1–100", st.every(x => x === "saved") && await P.p.evaluate(() => planKey() === "premium" && shOwnCount("lib") === 100));
  const c101 = await libSave(P.p, LIB[100]);
  ok("A9 · the 101st is refused gracefully: 'You have 100 saved Shadow videos, the most your plan keeps'", c101.lib === 100 && /^You have 100 saved Shadow videos/.test(c101.toast) && !c101.ask, JSON.stringify(c101));
  await P.ctx.close();
}

console.log("\n# B · YouTube imports (General English)");
{
  const { ctx, p, errs, polish } = await open({ uid: "yb" });
  const a = await paste(p, yt(1));
  ok("B1 · Free imports one YouTube video (owner, 27 Sep 2026: 2 → 1): 'Added to Your YouTube videos (1/1)', it loads", a.toast === "Added to Your YouTube videos (1/1)" && a.loaded, JSON.stringify(a));
  const before = polish.length;
  const three = []; for (let k = 0; k < 5; k++) three.push(await paste(p, yt(2)));
  ok("B2 · the second import is refused: 'You've reached your 1-video YouTube limit', Premium up to 20", three[0].yt === 1 && three[0].ask && three[0].ask.title === "You've reached your 1-video YouTube limit" && /Premium lets you save up to 20 YouTube videos/.test(three[0].ask.body), JSON.stringify(three[0]));
  ok("B3 · refused five times over: it never loads and never asks the Worker to transcribe", three.every(x => !x.loaded) && polish.length === before, JSON.stringify({ loads: three.map(x => x.loaded), polish: polish.slice(before) }));
  await p.evaluate(async () => { await loadCaptions("y0000000001"); });
  ok("B4 · an allowed import is transcribed once (one ytai request)", polish.filter(x => x.kind === "ytai" && x.vid === "y0000000001").length === 1, JSON.stringify(polish));
  const direct = await p.evaluate(async () => { const r = await shCapAsk("y0000000003", 60); return { r, err: _capErr["y0000000003"] }; });
  ok("B5 · even asked directly, a link that is not an import makes no request", direct.r === null && direct.err === "not_imported" && !polish.some(x => x.vid === "y0000000003"), JSON.stringify(direct));
  const del = await p.evaluate(async () => { window.__yes = true; await shOwnDel(shOwnFind("y0000000001")); window.__yes = false; return shOwnCount("yt"); });
  const after = await paste(p, yt(3));
  ok("B6 · deleting an import frees its slot: the next one is added (1/1)", del === 0 && after.toast === "Added to Your YouTube videos (1/1)" && after.loaded, JSON.stringify(after));
  ok("B7 · a removed import is not transcribed again", await p.evaluate(async () => (await shCapAsk("y0000000001", 60)) === null) && polish.filter(x => x.vid === "y0000000001" && x.kind === "ytai").length === 1);
  const link = await p.evaluate(async () => { shLinkSheet(); document.getElementById("shLinkIn").value = "https://youtu.be/y0000000009"; const l = __loads.length, a = __asks.length; await shLinkGo(); return { loaded: __loads.length > l, asked: __asks.length > a, yt: shOwnCount("yt") }; });
  ok("B8 · the library's 'Add a link' sheet refuses the same way (no load, the limit explained)", !link.loaded && link.asked && link.yt === 1, JSON.stringify(link));
  const libs = []; for (let i = 0; i < 2; i++) libs.push(await libSave(p, LIB[i]));
  ok("B9 · Free holds 2 saved library videos AND 1 YouTube import together", await p.evaluate(() => shOwnCount("lib") === 2 && shOwnCount("yt") === 1 && shOwn().length === 3));
  const paste_lib = await paste(p, LIB[20]);
  ok("B10 · a pasted link to a LIBRARY video counts as a library save (not an import) and still plays", paste_lib.yt === 1 && paste_lib.loaded && /^You have 2 saved Shadow videos/.test(paste_lib.toast), JSON.stringify(paste_lib));
  const sheet = await p.evaluate(() => { shOwnSheet(); const o = document.getElementById("shOwnOv"); const g = [...o.querySelectorAll(".sh-own-grp")].map(x => ({ h: x.querySelector("h3").innerText, cards: x.querySelectorAll(".sh-own").length })); o.remove(); return g; });
  ok("B11 · Your videos shows two groups: 'Saved from the library 2/2' and 'Your YouTube videos 1/1'", sheet.length === 2 && /Saved from the library\s+2\/2/.test(sheet[0].h) && sheet[0].cards === 2 && /Your YouTube videos\s+1\/1/.test(sheet[1].h) && sheet[1].cards === 1, JSON.stringify(sheet));
  ok("B12 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
  grant("yp");
  const P = await open({ uid: "yp" });
  await bulk(P.p, LIB.slice(0, 100), "lib");
  const r = []; for (let i = 1; i <= 20; i++) r.push(await paste(P.p, yt(i)));
  ok("B13 · Premium imports 1–20 ('… (20/20)'), alongside 100 library saves", r.every(x => x.loaded) && r[19].toast === "Added to Your YouTube videos (20/20)" && await P.p.evaluate(() => shOwnCount("lib") === 100 && shOwnCount("yt") === 20), JSON.stringify(r[19]));
  const x21 = await paste(P.p, yt(21));
  ok("B14 · the 21st is refused gracefully ('You have 20 YouTube videos …'), never loads, no request", x21.yt === 20 && !x21.loaded && /^You have 20 YouTube videos/.test(x21.toast) && !P.polish.some(x => x.vid === yt(21)), JSON.stringify(x21));
  await P.ctx.close();
}

console.log("\n# E · existing learners — classification, nothing lost; downgrade");
{
  const legacy = [LIB[0], LIB[1], yt(1), yt(2), yt(3)].map((v, i) => ({ vid: v, title: "https://youtu.be/" + v, ts: NOW - i * 1000 }));
  const weld = [wv(1), wv(2)].map((v, i) => ({ vid: v, title: v, ts: NOW - i }));
  const { ctx, p, errs } = await open({ uid: "ex", extra: { shOwnA: { "general-english": legacy, welding: weld }, shTx: { [yt(1)]: "0:01 kept" } } });
  const c = await p.evaluate(async () => { await shCatLoad(); return { src: S.shOwnA["general-english"].map(o => o.src), n: S.shOwnA["general-english"].length, weld: JSON.stringify(S.shOwnA.welding), tx: !!S.shTx.y0000000001 }; });
  ok("E1 · five legacy entries classified once: 2 library, 3 YouTube — none removed, transcripts kept", JSON.stringify(c.src) === JSON.stringify(["lib", "lib", "yt", "yt", "yt"]) && c.n === 5 && c.tx, JSON.stringify(c));
  ok("E2 · Welding's entries are not touched (no field added)", c.weld === JSON.stringify(weld));
  const imp = await paste(p, yt(4));
  ok("E3 · 3 imports on a 2-import plan: all kept, a new import waits ('All 3 of your YouTube videos are kept')", imp.yt === 3 && !imp.loaded && imp.ask && /^All 3 of your YouTube videos are kept/.test(imp.ask.body), JSON.stringify(imp));
  { const e4 = await libSave(p, LIB[2]);
  ok("E4 · two legacy library saves fill the Free plan (2 of 2): a third is refused and explained, nothing removed", e4.lib === 2 && e4.ask && e4.ask.title === "You've saved 2 Shadow videos", JSON.stringify(e4)); }
  ok("E5 · the old imports still open and still transcribe (they are imports)", await p.evaluate(async () => { shOwnOpen(shOwnFind("y0000000002")); return (await shCapMayAsk("y0000000002")) === true && __loads.includes("y0000000002"); }));
  ok("E6 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
  grant("dg");
  const D = await open({ uid: "dg" });
  await bulk(D.p, LIB.slice(0, 8), "lib"); await bulk(D.p, [1, 2, 3, 4].map(yt), "yt");
  grant("dg", { status: "expired", expires: NOW - DAY });
  await D.p.evaluate(() => entRefresh());
  const d = await D.p.evaluate(async () => (await shCatLoad(), { plan: planKey(), lib: shOwnCount("lib"), yt: shOwnCount("yt"), add: shOwnAdd("y0000000009", "x", "yt"), addLib: shOwnAdd(Object.keys(_shCat.videos)[50], "x", "lib") }));
  ok("E7 · Premium → Free: 8 saved + 4 imports all kept; new saves of each kind wait ('over')", d.plan === "free" && d.lib === 8 && d.yt === 4 && d.add === "over" && d.addLib === "over", JSON.stringify(d));
  await D.ctx.close();
}

console.log("\n# C · Polish history");
async function polishRuns(p, n) {
  return p.evaluate(async n => {
    go("phrases"); await new Promise(r => setTimeout(r, 300));
    const out = [];
    for (let i = 0; i < n; i++) {
      const ta = document.getElementById("exIn"); ta.value = `I think we should maybe look at the budget again and um basically decide by Friday, take ${i}.`;
      exPolish(); for (let k = 0; k < 80 && ex.phase !== "idle"; k++) await new Promise(r => setTimeout(r, 50));
      out.push(exReps().length);
    }
    return out;
  }, n);
}
const histSheet = p => p.evaluate(() => { exHistSheet(); const o = document.getElementById("exHistOv"); const r = { rows: o.querySelectorAll(".pf-row").length, lock: (o.querySelector(".ex-hist-lock") || {}).innerText || "", cta: !!o.querySelector(".ex-hist-cta"), note: (o.querySelector(".ex-hist-note") || {}).innerText || "" }; o.remove(); return r; });
{
  const { ctx, p, errs } = await open({ uid: "pf" });
  const runs = await polishRuns(p, 3);
  ok("C1 · Free can practise Polish: three reports in a row, each produced", JSON.stringify(runs) === "[1,2,3]", JSON.stringify(runs));
  const h = await histSheet(p);
  ok("C2 · Free history shows the latest report; the 2 older ones wait for Premium (kept, not deleted), with the Premium entry", h.rows === 1 && /^2 older reports are kept for Premium/.test(h.lock) && h.cta, JSON.stringify(h));
  ok("C3 · 'vs last time' survives: the newest report carries the previous numbers", await p.evaluate(() => !!exReps()[0].pm && exReps()[0].pm.words > 0));
  const many = await polishRuns(p, 9);
  ok("C4 · no daily limit: twelve reports in a row all produced; Free keeps its usual 5 stored", many.length === 9 && await p.evaluate(() => exReps().length === 5), JSON.stringify(many));
  const open1 = await p.evaluate(() => { exHistOpen(0); const w = document.querySelector(".ex-rep-card"); return !!w && /report/i.test(w.innerText); });
  ok("C5 · the latest report re-opens with its feedback", open1);
  ok("C6 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
  grant("pp");
  const P = await open({ uid: "pp" });
  await polishRuns(P.p, 7);
  const ph = await histSheet(P.p);
  ok("C7 · Premium keeps all 7 (more than Free's 5) and lists every one", ph.rows === 7 && !ph.lock && await P.p.evaluate(() => exReps().length === 7), JSON.stringify(ph));
  ok("C8 · an older Premium report re-opens with its AI feedback intact", await P.p.evaluate(() => { const r = exReps()[4]; exHistOpen(4); return ex.report === r && !!document.querySelector(".ex-rep-card"); }));
  const P2 = await open({ ctx: P.ctx, uid: "pp" });
  ok("C9 · Premium history survives a reload (7 reports)", await P2.p.evaluate(() => exReps().length === 7));
  ok("C10 · …and an account restore: the cloud copy carries all 7, and a merge onto an empty device keeps them", await P2.p.evaluate(() => { const c = JSON.parse(fbCloudJson(S)); const m = fbMerge({ exRepA: {} }, c); return c.exRepA["general-english"].length === 7 && m.exRepA["general-english"].length === 7; }));
  grant("pp", { status: "expired", expires: NOW - DAY });
  await P2.p.evaluate(() => entRefresh());
  await polishRuns(P2.p, 1);
  const dh = await histSheet(P2.p);
  ok("C11 · after Premium ends a new report does not wipe the history: still 7 kept, 1 shown, 6 waiting", await P2.p.evaluate(() => exReps().length === 7) && dh.rows === 1 && /^6 older reports/.test(dh.lock), JSON.stringify(dh));
  await P.ctx.close();
  const W = await open({ track: "welding", uid: "pp" });
  const wr = await polishRuns(W.p, 7);
  ok("C12 · Welding Polish is unchanged: 5 kept, no history button, no new field", wr[6] === 5 && await W.p.evaluate(() => !document.querySelector(".ex-hist-btn") && !exReps().some(r => r.pm)), JSON.stringify(wr));
  await W.ctx.close();
}

console.log("\n# E/H · Welding is unchanged even for a Premium account");
{
  grant("wp");
  const { ctx, p, errs, polish } = await open({ track: "welding", uid: "wp" });
  const r = []; for (let i = 1; i <= 6; i++) r.push(await paste(p, wv(i)));
  ok("W1 · Welding: 5 pasted links with '(n/5)', the sixth refused with the old message and still plays", r.slice(0, 5).every((x, i) => x.toast === `Saved to Your videos (${i + 1}/5)`) && r[5].n === 5 && r[5].toast === "You already have 5 of your own videos — remove one to keep this one" && r[5].loaded, JSON.stringify(r[5]));
  ok("W2 · Welding entries carry no kind field; the plan limits do not apply there", await p.evaluate(() => S.shOwnA.welding.every(o => !("src" in o)) && !shOwnSplit() && shOwnCap("yt") === 5));
  ok("W3 · Welding transcription is as before (a pasted link is not gated)", await p.evaluate(async () => (await shCapMayAsk("w0000000009")) === true));
  const sheet = await p.evaluate(() => { premiumOpen("t"); const t = document.getElementById("premOv").innerText; premClose(); return t; });
  ok("W4 · Welding's Premium sheet has none of the General English lines or the comparison", !/Shadow videos|YouTube|Polish/.test(sheet), sheet);
  ok("W5 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# I · Premium is the server's answer — no client-only bypass");
{
  const PV = { plan: "premium", paid: true, state: "active", ads: false, capabilities: { ad_free: true, ai_allowance: "enhanced", practice_allowance: "enhanced" }, expiresAt: NOW + 30 * DAY, startedAt: NOW - DAY, renews: true, source: "google_play" };
  const { ctx, p } = await open({ uid: null });
  const r = await p.evaluate(async v => {
    localStorage.setItem("be_ent_view", JSON.stringify({ uid: "tz", at: Date.now(), view: v }));
    FBUser = { uid: "tz", getIdToken: async () => "test-token-tz" };
    await entRefresh();
    const a = { plan: planKey(), yt: shOwnCap("yt"), lib: shOwnCap("lib"), polish: planLimit("polishHistory") };
    localStorage.setItem("be_ent_api", "");                                  /* no entitlement service = the production build */
    localStorage.setItem("be_ent_view", JSON.stringify({ uid: "tz", at: Date.now(), view: v })); _entView = null;
    const b2 = { plan: planKey(), on: planOn() };
    return { a, b2, frozen: Object.isFrozen(PLAN_LIMITS) && Object.isFrozen(PLAN_LIMITS.free) };
  }, PV);
  ok("I1 · a hand-written Premium cache is replaced by the server's answer: Free, 1 / 2 / 1", r.a.plan === "free" && r.a.yt === 1 && r.a.lib === 2 && r.a.polish === 1, JSON.stringify(r));
  ok("I2 · without an entitlement service a cached Premium counts for nothing, and the limits are off", r.b2.plan === "free" && r.b2.on === false, JSON.stringify(r));
  ok("I3 · the limits table is frozen (no client knob)", r.frozen);
  await ctx.close();
}

console.log("\n# G · the cloud copy's size guard");
{
  grant("sg");
  const { ctx, p, errs } = await open({ uid: "sg" });
  await p.evaluate(() => {
    const len = x => new TextEncoder().encode(x).length;
    FBdb = { collection: () => ({ doc: () => ({ set: async d => { if (len(d.json) + 400 > 1048576) { __refused++; throw Object.assign(new Error("too large"), { code: "invalid-argument" }); } __writes.push(d); __doc = Object.assign({}, __doc || {}, d); }, get: async () => ({ exists: !!__doc, data: () => __doc }) }) }) };
  });
  await bulk(p, LIB.slice(0, 100), "lib"); await bulk(p, [...Array(20)].map((_, i) => yt(i + 1)), "yt");
  const push = () => p.evaluate(async () => { const n = __writes.length; fbLastPushOk = null; fbPush(); for (let i = 0; i < 60 && __writes.length === n && fbLastPushOk === null; i++) await new Promise(r => setTimeout(r, 100)); });
  await p.evaluate(() => { S.shTx = S.shTx || {}; for (let i = 1; i <= 20; i++) S.shTx["y" + String(i).padStart(10, "0")] = "0:01 a long transcript line ".repeat(1500); save(); });
  await push();
  let g = await p.evaluate(() => { const len = x => new TextEncoder().encode(x).length, d = JSON.parse(__doc.json); const el = document.createElement("div"); el.id = "fbSyncMsg"; document.body.appendChild(el); fbSyncStatus();
    return { size: len(__doc.json), lib: d.shOwnA["general-english"].filter(o => o.src === "lib").length, yt: d.shOwnA["general-english"].filter(o => o.src === "yt").length, tx: Object.keys(d.shTx).length, local: Object.keys(S.shTx).length, msg: el.textContent, refused: __refused }; });
  ok("G1 · 100 saves + 20 imports + ~800 KB of transcripts: the list syncs whole, transcripts within budget, under 900 KB", g.lib === 100 && g.yt === 20 && g.size <= 900 * 1024 && g.tx > 0 && g.tx < 20 && g.refused === 0, JSON.stringify(g));
  ok("G2 · the device keeps all 20 transcripts, and the account card says how many stay here", g.local === 20 && /Shadow transcripts stay on this device only/.test(g.msg), g.msg);
  const prev = await p.evaluate(() => __doc.json);
  await p.evaluate(() => { S.notes["sh:filler"] = "n".repeat(1000 * 1024); save(); });
  await push();
  g = await p.evaluate(prev => { fbSyncStatus(); return { same: __doc.json === prev, err: fbLastPushErr, msg: document.getElementById("fbSyncMsg").textContent, refused: __refused, local: shOwn().length }; }, prev);
  ok("G3 · too large for one document: no write, the account copy unchanged, the device keeps everything, the card says why", g.same && g.err === "be/doc-too-large" && g.refused === 0 && g.local === 120 && /^⚠️ Not saved to your account/.test(g.msg), JSON.stringify(g));
  ok("G4 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# D · the launch offer + the Premium sheet");
const launchState = p => p.evaluate(() => { const o = document.getElementById("premOv"); if (!o) return null; const x = o.querySelector(".prem-x"); const sel = o.querySelector('.prem-plan[aria-checked="true"]');
  return { from: o.dataset.from, xHidden: !x || x.hidden || getComputedStyle(x).display === "none", wait: !!o.dataset.xwait, sel: sel && sel.dataset.id, cta: (o.querySelector(".prem-cta") || {}).textContent, text: o.innerText, plans: [...o.querySelectorAll(".prem-plan")].map(x => x.dataset.id) }; });
{
  let o = await open({ uid: "lo", billing: false, keepLaunch: true }); await sleep(3000);
  ok("D1 · billing off → no launch offer", !(await launchState(o.p))); await o.ctx.close();
  grant("lp"); o = await open({ uid: "lp", keepLaunch: true }); await sleep(3000);
  ok("D2 · Premium → no launch offer", !(await launchState(o.p))); await o.ctx.close();
  o = await open({ uid: null, keepLaunch: true }); await sleep(3000);
  ok("D3 · signed out → no launch offer (a purchase needs an account)", !(await launchState(o.p))); await o.ctx.close();
  o = await open({ track: "welding", uid: "lw", keepLaunch: true }); await sleep(3000);
  ok("D4 · Welding → no launch offer (today's Premium benefits are General English ones)", !(await launchState(o.p))); await o.ctx.close();

  const L = await open({ uid: "lf", keepLaunch: true, theme: "dark" }); await sleep(2600);
  let s = await launchState(L.p);
  ok("D5 · Free, General English: the offer opens by itself on launch", s && s.from === "launch", JSON.stringify(s));
  ok("D6 · the close X is hidden at first", s && s.xHidden && s.wait, JSON.stringify(s));
  await L.p.keyboard.press("Escape"); await L.p.mouse.click(5, 5); await sleep(200);
  ok("D7 · before the X: Escape and a tap outside do not dismiss it", !!(await launchState(L.p)));
  ok("D8 · annual first and selected; CTA 'Continue with Premium'; real benefits listed; the 3-day trial on Monthly", s.plans[0] === "premium_annual" && s.sel === "premium_annual" && s.cta === "Continue with Premium" && /Save up to 100 Shadow videos/.test(s.text) && /Bring your own YouTube videos — up to 20/.test(s.text) && /Keep your last 50 Polish speaking reports/.test(s.text) && /3-day free trial/.test(s.text) && /Save \d+%/.test(s.text) && /renews automatically/.test(s.text) && /Restore purchases/i.test(s.text) && /Privacy/.test(s.text), s.text);
  ok("D9 · nothing unbuilt is promised: no 'unlimited', no 'more AI coaching'", !/unlimited|more AI coaching/i.test(s.text));
  if (SHOTS) await L.p.screenshot({ path: SHOTS + "/launch-dark-390-wait.png" });
  await sleep(5200);
  s = await launchState(L.p);
  ok("D10 · after ~5 s the X appears", s && !s.xHidden && !s.wait, JSON.stringify(s));
  if (SHOTS) await L.p.screenshot({ path: SHOTS + "/launch-dark-390.png" });
  await L.p.evaluate(() => premPick("premium_monthly")); s = await launchState(L.p);
  ok("D11 · Monthly selected → 'Start 3-day free trial'", s.sel === "premium_monthly" && s.cta === "Start 3-day free trial", JSON.stringify(s));
  await L.p.evaluate(() => premPick("premium_annual"));
  await L.p.evaluate(() => document.querySelector("#premOv .prem-cta").click()); await sleep(400);
  ok("D12 · Continue goes through the existing purchase flow (Play sheet asked for premium_annual)", await L.p.evaluate(() => __play.shows[0] === "premium_annual"));
  await L.p.evaluate(() => document.querySelector("#premOv .prem-restore").click()); await sleep(400);
  ok("D13 · Restore purchases goes through the existing Billing.restore (Play asked what it owns)", await L.p.evaluate(() => __play.lists >= 1));
  await L.p.evaluate(() => document.querySelector("#premOv .prem-x").click()); await sleep(200);
  ok("D14 · the X closes it; the learner carries on", !(await launchState(L.p)));
  await L.p.reload(); await sleep(1400);
  await L.p.evaluate(async () => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,#fndCheckOv").forEach(e => e.remove()); FBUser = { uid: "lf", email: "lf@test", getIdToken: async () => "test-token-lf" }; await entRefresh(); await Billing.init(); });
  await sleep(3000);
  ok("D15 · same app session (a reload of the page): not shown again", !(await launchState(L.p)));
  ok("D16 · no JavaScript errors", !L.errs.length, L.errs.join(" | "));
  await L.ctx.close();

  const N = await open({ uid: "ln", keepLaunch: true, trial: false }); await sleep(2600);
  await N.p.evaluate(() => premPick("premium_monthly")); s = await launchState(N.p);
  ok("D17 · when Play reports no trial: no trial line, CTA 'Continue with Premium'", s && !/free trial/i.test(s.text) && s.cta === "Continue with Premium", s && s.text);
  const ld = await N.p.evaluate(() => { Billing.state = "loading"; premDraw(); const a = document.getElementById("premOv").innerText; Billing.state = "ready"; const keep = Billing.products; Billing.products = []; premDraw(); const b = document.getElementById("premOv").innerText; Billing.products = keep; premDraw(); return { a, b }; });
  ok("D18 · loading and no-products states are plain and closable", /Loading|Checking/i.test(ld.a) && /Premium isn.t available|not available|can.t be bought|unavailable/i.test(ld.b), JSON.stringify(ld));
  await N.ctx.close();

  for (const [lab, o] of [["light-320", { theme: "light", vp: { width: 320, height: 640 } }], ["dark-320", { theme: "dark", vp: { width: 320, height: 640 } }], ["reduced", { motion: "reduce" }]]) {
    const V = await open({ uid: "lv-" + lab, keepLaunch: true, ...o }); await sleep(7600);
    const r = await V.p.evaluate(() => { const o = document.getElementById("premOv"), sh = o && o.querySelector(".prem-sheet"), x = o && o.querySelector(".prem-x"), tb = o && o.querySelector(".prem-cmp"); if (o) { const d = o.querySelector(".prem-more"); if (d) d.open = true; }   /* the comparison sits behind "See what's included" */
      return o ? { overflow: document.documentElement.scrollWidth > innerWidth || sh.scrollWidth > sh.clientWidth + 1, table: tb && tb.getBoundingClientRect().right <= sh.getBoundingClientRect().right + 1, xAnim: x ? getComputedStyle(x).animationName : "", theme: document.documentElement.getAttribute("data-theme") } : null; });
    if (SHOTS) await V.p.screenshot({ path: `${SHOTS}/launch-${lab}.png` });
    ok(`D19 · ${lab}: fits with no sideways scroll${lab === "reduced" ? ", and the X appears with no animation" : ""}`, r && !r.overflow && r.table && (lab !== "reduced" || r.xAnim === "none"), JSON.stringify(r));
    await V.ctx.close();
  }
  const A = await open({ uid: "la" });
  const ar = await A.p.evaluate(async () => { await setLang("ar"); premiumOpen("t"); await new Promise(r => setTimeout(r, 300)); const t = document.getElementById("premOv").innerText, sh = document.querySelector("#premOv .prem-sheet"); return { t, dir: document.documentElement.dir, over: sh.scrollWidth > sh.clientWidth + 1 }; });
  if (SHOTS) await A.p.screenshot({ path: SHOTS + "/sheet-ar.png" });
  ok("D20 · Arabic: right-to-left, the benefits translated, no raw keys, fits", ar.dir === "rtl" && /احفظ حتى 100/.test(ar.t) && /أحضر مقاطع YouTube الخاصة بك — حتى 20/.test(ar.t) && !/\b(prem|sh|ex)\.[a-z_]+\b/.test(ar.t) && !ar.over, ar.t);
  const card = await A.p.evaluate(async () => { premClose(); await setLang("en"); go("data"); for (let i = 0; i < 40 && !document.getElementById("entPlan"); i++) await new Promise(r => setTimeout(r, 50)); return document.getElementById("entPlan").textContent.replace(/\s+/g, " "); });
  ok("D21 · Settings Premium card lists the three real benefits and 'See Premium plans'", /Save up to 100 Shadow videos/.test(card) && /up to 20/.test(card) && /last 50 Polish/.test(card) && /See Premium plans/.test(card), card);
  await A.ctx.close();
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
