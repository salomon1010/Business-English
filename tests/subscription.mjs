/* Subscription card (App Setup) + the Profile row — Free and Premium states.
   Run: cd tests && node subscription.mjs   (SHOTS=<dir> saves screenshots)

   Real: index.html and the entitlement Worker (backend/entitlements handle(),
   real SQLite) — Premium comes only from a row in its database. Played: Play
   Billing (Digital Goods API + Payment Request, with what the device "owns"),
   window.open (to see where Manage goes). Identity uses DEV_AUTH. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite"; import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { handle } from "../backend/entitlements/entitlements-worker.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8098), BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.SHOTS || ""; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await chromium.launch();
const DAY = 864e5, NOW = Date.now();
const db = new DatabaseSync(":memory:");
for (const m of readdirSync(new URL("../backend/entitlements/migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).sort()) db.exec(readFileSync(new URL("../backend/entitlements/migrations/" + m, import.meta.url), "utf8"));
const D1 = { prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; } };
const WENV = { DB: D1, FIREBASE_PROJECT_ID: "be-mastery", DEV_AUTH: "1", PLAY_PACKAGE: "com.bemastery.app" };
const EXP = NOW + 200 * DAY;
const grant = (uid, { status = "active", renew = 1, source = "google_play", product = "premium_annual" } = {}) =>
  db.prepare("INSERT OR REPLACE INTO entitlements(uid,plan,product,status,starts_at,expires_at,will_renew,source,external_ref,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run("dev:" + uid, "premium", product, status, NOW - DAY, EXP, renew, source, "test", Date.now());
const PLAY_STUB = owned => {
  window.__play = { lists: 0 }; window.__opened = [];
  window.open = (u) => { window.__opened.push(String(u)); return null; };
  window.getDigitalGoodsService = async m => { if (m !== "https://play.google.com/billing") throw new Error("x"); return {
    getDetails: async ids => [{ itemId: "premium_monthly", title: "Premium (monthly)", price: { currency: "USD", value: "4.99" }, subscriptionPeriod: "P1M", freeTrialPeriod: "P3D" }, { itemId: "premium_annual", title: "Premium (annual)", price: { currency: "USD", value: "19.99" }, subscriptionPeriod: "P1Y" }].filter(d => ids.includes(d.itemId)),
    listPurchases: async () => { window.__play.lists++; return owned ? [{ itemId: owned, purchaseToken: "tok_" + owned + "_" + "x".repeat(20) }] : []; } }; };
  window.PaymentRequest = class { constructor() {} async show() { throw new DOMException("closed", "AbortError"); } };
};
const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
async function open({ track = "general-english", uid = null, billing = true, owned = null, vp = { width: 390, height: 844 }, theme = "dark", lang = null } = {}) {
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: "block" });
  await ctx.addInitScript(([s, bill, theme]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_ent_api", "http://ent.test"); if (bill) localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: true })); localStorage.setItem("be_theme", theme); try { sessionStorage.setItem("be_prem_launch", "1"); } catch (e) {} }, [seed(track), billing, theme]);
  await ctx.addInitScript(PLAY_STUB, owned);
  await ctx.route(u => /be-events|be-partner|be-polish|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  await ctx.route("http://ent.test/**", async r => {
    const q = r.request(), h = { ...q.headers() };
    const m = /^Bearer test-token-(.+)$/.exec(h.authorization || ""); if (m) { h["x-dev-user"] = m[1]; delete h.authorization; }
    const resp = await handle(new Request(q.url(), { method: q.method(), headers: h, body: ["GET", "HEAD"].includes(q.method()) ? undefined : q.postData() }), WENV, {});
    await r.fulfill({ status: resp.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await resp.text() });
  });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1400);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  if (lang) await p.evaluate(async l => { await setLang(l); }, lang);
  if (uid) await p.evaluate(async uid => { FBUser = { uid, email: uid + "@test", getIdToken: async () => "test-token-" + uid }; await entRefresh(); await Billing.init(); await new Promise(r => setTimeout(r, 300)); }, uid);
  return { ctx, p, errs };
}
/* App Setup renders asynchronously: wait for the page, then read the card */
const settings = async p => { await p.evaluate(async () => { go("data"); for (let i = 0; i < 60 && !document.querySelector("details.set-plan"); i++) await new Promise(r => setTimeout(r, 50)); }); await sleep(250);
  return p.evaluate(() => { const c = document.getElementById("subCard"); if (!c || c.hidden) return null;
    const rows = Object.fromEntries([...c.querySelectorAll(".sub-dl > div")].map(d => [d.querySelector("dt").textContent, d.querySelector("dd").textContent]));
    return { rows, text: c.innerText, manage: !!c.querySelector(".sub-manage"), restore: !!c.querySelector(".sub-restore"), plans: !!c.querySelector(".sub-plans"), h: c.querySelector("h3").textContent, labelled: c.getAttribute("aria-labelledby") === "subH" && c.tagName === "SECTION",
      btnsOk: [...c.querySelectorAll("button")].every(x => x.getBoundingClientRect().height >= 44) }; }); };
const shot = async (p, name) => { if (!SHOTS) return; await sleep(300); const el = p.locator("#subCard"); if (await el.count()) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: `${SHOTS}/${name}.png` }); } };
const fmtDate = ms => new Date(ms).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

console.log("\n# Free (General English)");
{
  const { ctx, p, errs } = await open({ uid: "fr1" });
  const c = await settings(p);
  ok("1 · Free: a Subscription card — 'Current plan Free', 'Unlock Premium', 'See Premium plans'", c && c.h === "Subscription" && c.rows["Current plan"] === "Free" && /Unlock Premium — save up to 100 Shadow videos, bring up to 20 YouTube videos and keep your last 50 Polish reports\./.test(c.text) && c.plans, JSON.stringify(c));
  ok("2 · Free: no 'Manage subscription' anywhere on the card", c && !c.manage && !/Manage subscription/.test(c.text));
  ok("3 · Free: Restore purchases is there (a purchase made in Play can be found again)", c && c.restore);
  ok("4 · a section labelled by its heading; every button ≥ 44 px", c && c.labelled && c.btnsOk, JSON.stringify(c));
  await p.evaluate(() => document.querySelector("#subCard .sub-plans").click()); await sleep(300);
  ok("5 · 'See Premium plans' opens the existing Premium sheet", await p.evaluate(() => !!document.getElementById("premOv") && document.getElementById("premOv").dataset.from === "settings"));
  await p.evaluate(() => premClose());
  await p.evaluate(() => document.querySelector("#subCard .sub-restore").click()); await sleep(600);
  ok("6 · Restore goes through the existing Billing.restore (Play asked what it owns) and says the result", await p.evaluate(() => __play.lists >= 1 && /No purchase|nothing|none/i.test(document.getElementById("subCard").innerText)), await p.evaluate(() => document.getElementById("subCard").innerText));
  await shot(p, "settings-free-dark-390");
  const prof = await p.evaluate(() => { go("profile"); const r = document.querySelector(".pf-prem .pf-row"); return r ? { text: r.innerText, click: r.getAttribute("onclick") } : null; });
  ok("7 · Profile keeps its Premium row for Free, opening the Premium sheet (unchanged)", prof && /BE Mastery Premium/.test(prof.text) && prof.click === "premiumOpen('profile')", JSON.stringify(prof));
  ok("8 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
  const L = await open({ uid: "fr2", theme: "light" }); await settings(L.p); await shot(L.p, "settings-free-light-390"); await L.ctx.close();
}

console.log("\n# Premium (from the Worker)");
{
  grant("pa");
  const { ctx, p, errs } = await open({ uid: "pa", owned: "premium_annual" });
  const c = await settings(p);
  ok("9 · Premium: 'Premium · Annual', '$19.99 / year' from Play, 'Renews on <date>' from the server, 'Billed by Google Play'", c && c.rows["Current plan"] === "Premium · Annual" && c.rows["Price"] === "$19.99 / year" && c.rows["Renews on"] === fmtDate(EXP) && c.rows["Billed by"] === "Google Play" && /Active/.test(c.text), JSON.stringify(c));
  ok("10 · Premium: 'Manage subscription' + Restore purchases, no 'See Premium plans'", c && c.manage && c.restore && !c.plans, JSON.stringify(c));
  await p.evaluate(() => document.querySelector("#subCard .sub-manage").click());
  const url = await p.evaluate(() => __opened[0] || "");
  ok("11 · Manage opens Google Play's own subscriptions page for THIS app and THIS product", /^https:\/\/play\.google\.com\/store\/account\/subscriptions\?package=com\.bemastery\.app&sku=premium_annual$/.test(url), url);
  await shot(p, "settings-premium-dark-390");
  const prof = await p.evaluate(() => { go("profile"); const r = document.querySelector(".pf-prem .pf-row"); return { text: r.innerText, click: r.getAttribute("onclick") }; });
  ok("12 · Profile row for Premium: 'Subscription · Premium · Annual', opening the card", /Subscription/.test(prof.text) && /Premium · Annual/.test(prof.text) && prof.click === "subOpen()", JSON.stringify(prof));
  await p.evaluate(() => subOpen()); await sleep(900);
  ok("13 · …which lands on App Setup with the card in view and focus on its first button", await p.evaluate(() => { const c = document.getElementById("subCard"), r = c.getBoundingClientRect(); return cur.v === "data" && r.top < innerHeight && r.bottom > 0 && c.contains(document.activeElement); }));
  await p.evaluate(() => premiumOpen("t")); await sleep(200);
  await p.evaluate(() => document.querySelector("#premOv .prem-subdetails").click()); await sleep(900);
  ok("14 · the Premium sheet (Premium state) links to 'Subscription details'", await p.evaluate(() => !document.getElementById("premOv") && cur.v === "data" && !!document.getElementById("subCard")));
  ok("15 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
  const L = await open({ uid: "pa", owned: "premium_annual", theme: "light" }); await settings(L.p); await shot(L.p, "settings-premium-light-390"); await L.ctx.close();

  grant("pm", { product: "premium_monthly" });
  let o = await open({ uid: "pm", owned: "premium_monthly" }); let m = await settings(o.p);
  ok("16 · Monthly: 'Premium · Monthly', '$4.99 / month'", m && m.rows["Current plan"] === "Premium · Monthly" && m.rows["Price"] === "$4.99 / month", JSON.stringify(m)); await o.ctx.close();
  grant("pc", { renew: 0 });
  o = await open({ uid: "pc", owned: "premium_annual" }); m = await settings(o.p);
  ok("17 · cancelled: 'Ends on <date>' and 'Cancelled — Premium stays on until …', Manage still there", m && m.rows["Ends on"] === fmtDate(EXP) && /Cancelled — Premium stays on until/.test(m.text) && m.manage, JSON.stringify(m)); await o.ctx.close();
  grant("pg", { status: "grace" });
  o = await open({ uid: "pg", owned: "premium_annual" }); m = await settings(o.p);
  ok("18 · payment problem (grace): 'Premium stays on until <date>' and the store-payment warning", m && m.rows["Premium stays on until"] === fmtDate(EXP) && /Payment problem/.test(m.text) && m.manage, JSON.stringify(m)); await o.ctx.close();
  grant("po");
  o = await open({ uid: "po", owned: null }); m = await settings(o.p);
  await o.p.evaluate(() => document.querySelector("#subCard .sub-manage").click());
  const u2 = await o.p.evaluate(() => __opened[0] || "");
  ok("19 · bought on another phone (this device owns nothing): 'Premium', no invented plan or price; Manage opens Play's page for the app", m && m.rows["Current plan"] === "Premium" && !m.rows["Price"] && m.manage && /package=com\.bemastery\.app$/.test(u2), JSON.stringify({ m, u2 })); await o.ctx.close();
  grant("pi", { source: "app_store" });
  o = await open({ uid: "pi", owned: null }); m = await settings(o.p);
  ok("20 · a plan sold by the App Store, seen on Android: no Manage button, told where to manage it", m && !m.manage && /App Store/.test(m.text) && m.rows["Billed by"] === "App Store", JSON.stringify(m)); await o.ctx.close();
}

console.log("\n# billing off, Welding, layout");
{
  let o = await open({ uid: "off", billing: false });
  let c = await settings(o.p);
  const same = await o.p.evaluate(() => ({ plan: !!document.querySelector("details.set-plan"), entPlan: !!document.getElementById("entPlan"), prof: (go("profile"), !!document.querySelector(".pf-prem")) }));
  ok("21 · billing off (production today): no Subscription card, no Profile row; App Setup's plan section as before", !c && same.plan && same.entPlan && !same.prof, JSON.stringify({ c, same })); await o.ctx.close();
  o = await open({ track: "welding", uid: "wf" }); c = await settings(o.p);
  ok("22 · Welding, Free: no Subscription card (App Setup unchanged)", !c, JSON.stringify(c)); await o.ctx.close();
  grant("wp");
  o = await open({ track: "welding", uid: "wp", owned: "premium_annual" }); c = await settings(o.p);
  ok("23 · Welding, paying: the card lets them manage their account's subscription, with no General English benefit copy", c && c.manage && c.rows["Current plan"] === "Premium · Annual" && !/Shadow|YouTube|Polish/.test(c.text), JSON.stringify(c)); await o.ctx.close();
  for (const [lab, uid, owned, theme] of [["free-dark-320", "l1", null, "dark"], ["free-light-320", "l2", null, "light"], ["premium-dark-320", "pa", "premium_annual", "dark"], ["premium-light-320", "pa", "premium_annual", "light"]]) {
    o = await open({ uid, owned, theme, vp: { width: 320, height: 640 } }); c = await settings(o.p);
    const r = await o.p.evaluate(() => { const card = document.getElementById("subCard"), rc = card.getBoundingClientRect();
      const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length && (c.length < 4 || c[3] > 0.5)) return c; } return [0, 0, 0]; };
      const L = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const els = [...card.querySelectorAll("dt,dd,.sub-up,.sub-hint,h3")];
      return { over: document.documentElement.scrollWidth > innerWidth, inside: rc.left >= 0 && rc.right <= innerWidth, minCr: Math.round(Math.min(...els.map(e => cr(rgb(getComputedStyle(e).color), bgOf(e)))) * 10) / 10, theme: document.documentElement.getAttribute("data-theme") }; });
    await shot(o.p, "settings-" + lab);
    ok(`24 · ${lab}: fits at 320 px, no sideways scroll, text contrast ≥ 4.5:1`, c && !r.over && r.inside && r.minCr >= 4.5 && r.theme === theme, JSON.stringify(r));
    await o.ctx.close();
  }
  o = await open({ uid: "pa", owned: "premium_annual", lang: "ar", vp: { width: 320, height: 640 } }); c = await settings(o.p);
  const ar = await o.p.evaluate(() => ({ dir: document.documentElement.dir, over: document.documentElement.scrollWidth > innerWidth }));
  await shot(o.p, "settings-premium-ar-320");
  ok("25 · Arabic: right-to-left, translated, no raw keys, fits", c && ar.dir === "rtl" && /الاشتراك/.test(c.text) && /الخطة الحالية/.test(c.text) && !/\bsub\.[a-z_]+/.test(c.text) && !ar.over, c && c.text);
  const fr = await open({ uid: "fr3", lang: "fr" }); const f = await settings(fr.p);
  ok("26 · French: 'Abonnement', 'Formule actuelle', 'Débloquez Premium'", f && /Abonnement/.test(f.text) && /Formule actuelle/.test(f.text) && /Débloquez Premium/.test(f.text), f && f.text);
  await o.ctx.close(); await fr.ctx.close();
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
