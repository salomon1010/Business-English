/* The web carries the store subscription of the programme that is OPEN (owner, 31 Oct 2026:
   "three ways in, two ways to subscribe"). Run: cd tests && node web-per-app.mjs
   Real index.html + the real entitlement Worker (in-memory D1). One account: Premium bought in
   the WELDING app only. On the combined web app (/bemastery/, no BE_APP_TRACK) it must read
   Free in General English and Premium in Welding, and switching back must never draw Welding's
   plan in General English. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite"; import { readFileSync, readdirSync } from "node:fs";
import { handle } from "../backend/entitlements/entitlements-worker.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8799), BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const NOW = Date.now(), DAY = 864e5;
const db = new DatabaseSync(":memory:");
for (const m of readdirSync(new URL("../backend/entitlements/migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).sort()) db.exec(readFileSync(new URL("../backend/entitlements/migrations/" + m, import.meta.url), "utf8"));
const D1 = { prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; } };
const WENV = { DB: D1, FIREBASE_PROJECT_ID: "be-mastery", DEV_AUTH: "1", PLAY_PACKAGE: "com.bemastery.app,com.lomonec.bemastery.welding", APP_PROGRAMMES: "general-english,welding" };
const grant = (uid, app) => db.prepare("INSERT OR REPLACE INTO entitlements(uid,app_id,plan,product,status,starts_at,expires_at,source,external_ref,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
  .run("dev:" + uid, app, "premium", "premium_annual", "active", NOW - DAY, NOW + 300 * DAY, "google_play", "test", Date.now());
grant("weld", "welding");
const asked = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.addInitScript(() => { localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "W", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 })); localStorage.setItem("be_ent_api", "http://ent.test"); localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: true })); });
await ctx.route(u => /be-events|be-partner|be-polish|be-push|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
await ctx.route("http://ent.test/**", async r => {
  const q = r.request(), h = { ...q.headers() }; asked.push(new URL(q.url()).searchParams.get("app"));
  const m = /^Bearer test-token-(.+)$/.exec(h.authorization || ""); if (m) { h["x-dev-user"] = m[1]; delete h.authorization; }
  const resp = await handle(new Request(q.url(), { method: q.method(), headers: h }), WENV, {});
  await r.fulfill({ status: resp.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await resp.text() });
});
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(BASE + "index.html"); await sleep(1800);
await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#premOv,#webGate").forEach(e => e.remove()));
const state = () => p.evaluate(() => ({ track: typeof BE_APP_TRACK !== "undefined" ? BE_APP_TRACK : "?", area: areaId(), app: entApp(), prem: entIsPremiumForDisplay(), crown: !!(document.getElementById("hdrPrem") || {}).classList?.contains("is-active") }));
await p.evaluate(async () => { FBUser = { uid: "weld", email: "weld@test", getIdToken: async () => "test-token-weld" }; await entRefresh(); });
let s = await state();
ok("W1 · the combined web app (no store programme) in General English asks about the General English app → Free", s.track === null && s.area === "general-english" && s.app === "general-english" && !s.prem && asked.at(-1) === "general-english", JSON.stringify({ s, asked }));
await p.evaluate(() => areaSwitch("welding", "home")); await sleep(1500);
s = await state();
ok("W2 · switching to Welding asks about the Welding app → the Welding subscription is Premium here", s.area === "welding" && s.app === "welding" && s.prem && asked.at(-1) === "welding", JSON.stringify({ s, asked }));
ok("W3 · …and the crown says so", s.crown, JSON.stringify(s));
await p.evaluate(() => areaSwitch("general-english", "home")); await sleep(300);
const quick = await state();
ok("W4 · switching back draws General English's plan at once — never Welding's (Free before the server even answers)", quick.app === "general-english" && !quick.prem, JSON.stringify(quick));
await sleep(1200); s = await state();
ok("W5 · …and after the server answers it is still Free in General English", !s.prem && asked.at(-1) === "general-english", JSON.stringify({ s, asked }));
ok("W6 · no JavaScript errors", !errs.length, errs.join(" | "));
await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
