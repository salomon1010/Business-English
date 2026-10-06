/* Premium acquisition sheet — the visual redesign (2026-09-26): hero → benefits
   → plans → one CTA, the pinned foot, exactly one billing-unavailable state,
   the delayed X, the Settings Subscription card and the General English
   boundary. Run: cd tests && node premium-acquisition.mjs
   SHOTS=<dir> writes screenshots (dark / light / 320 / Arabic / states).

   What is real: index.html and the entitlement Worker (backend/entitlements
   handle(), real SQLite) — the only thing that makes an account Premium.
   What is played: Play Billing (Digital Goods API + Payment Request as a TWA
   exposes them, with the tier spec's prices — docs/TIERS.md, 5 Oct 2026:
   US$19.99 / year with a 3-day trial, US$2.99 / month, BOTH offered, annual
   first), Firebase identity (DEV_AUTH). */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite"; import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { handle } from "../backend/entitlements/entitlements-worker.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8098), BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.SHOTS || ""; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 700)}`); };
const b = await chromium.launch();
const DAY = 864e5, NOW = Date.now();

/* ---- the real entitlement Worker over an in-memory D1 */
const db = new DatabaseSync(":memory:");
for (const m of readdirSync(new URL("../backend/entitlements/migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).sort()) db.exec(readFileSync(new URL("../backend/entitlements/migrations/" + m, import.meta.url), "utf8"));
const D1 = { prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; } };
const WENV = { DB: D1, FIREBASE_PROJECT_ID: "be-mastery", DEV_AUTH: "1", PLAY_PACKAGE: "com.bemastery.app" };
const grant = (uid, { status = "active", expires = NOW + 30 * DAY, product = "premium_annual" } = {}) =>
  db.prepare("INSERT OR REPLACE INTO entitlements(uid,plan,product,status,starts_at,expires_at,source,external_ref,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
    .run("dev:" + uid, "premium", product, status, NOW - DAY, expires, "google_play", "test", Date.now());

const PLAY_STUB = ({ trial, products, owned }) => {
  window.__play = { shows: [], lists: 0, noProducts: !products, trial, owned: owned || [] };
  window.getDigitalGoodsService = async m => { if (m !== "https://play.google.com/billing") throw new Error("x"); return {
    /* the tier spec (docs/TIERS.md, 5 Oct 2026) + the owner's 6 Oct 2026 trial
       decision: US$19.99 a year, US$2.99 a month, the 3-day trial on BOTH plans
       — both sold, both shown, annual first */
    getDetails: async ids => window.__play.noProducts ? [] : [{ itemId: "premium_monthly", title: "Premium (monthly)", price: { currency: "USD", value: "2.99" }, subscriptionPeriod: "P1M", ...(window.__play.trial ? { freeTrialPeriod: "P3D" } : {}) }, { itemId: "premium_annual", title: "Annual Premium", price: { currency: "USD", value: "19.99" }, subscriptionPeriod: "P1Y", ...(window.__play.trial ? { freeTrialPeriod: "P3D" } : {}) }].filter(d => ids.includes(d.itemId)),
    listPurchases: async () => { window.__play.lists++; return window.__play.owned; } }; };
  window.PaymentRequest = class { constructor(m) { this.sku = m[0].data.sku; } async show() { window.__play.shows.push(this.sku); throw new DOMException("closed", "AbortError"); } };
};
const seed = (tr, extra = {}) => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1, ...extra });
async function open({ track = "general-english", uid = null, flags = { billing_enabled: true }, trial = true, products = true, owned = null, stub = true, vp = { width: 390, height: 844 }, theme = null, motion = null, keepLaunch = false, lang = null } = {}) {
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: "block", reducedMotion: motion || "no-preference" });
  await ctx.addInitScript(([s, f, theme]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_ent_api", "http://ent.test"); if (f) localStorage.setItem("be_flags", JSON.stringify(f)); if (theme) localStorage.setItem("be_theme", theme); }, [seed(track), flags, theme]);
  if (stub) await ctx.addInitScript(PLAY_STUB, { trial, products, owned });
  await ctx.route(u => /be-events|be-partner|be-polish|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  await ctx.route("http://ent.test/**", async r => {
    const q = r.request(), h = { ...q.headers() };
    const m = /^Bearer test-token-(.+)$/.exec(h.authorization || ""); if (m) { h["x-dev-user"] = m[1]; delete h.authorization; }
    const resp = await handle(new Request(q.url(), { method: q.method(), headers: h, body: ["GET", "HEAD"].includes(q.method()) ? undefined : q.postData() }), WENV, {});
    await r.fulfill({ status: resp.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await resp.text() });
  });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1400);
  await p.evaluate(async ([keep, lang]) => {
    document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove());
    if (!keep) try { sessionStorage.setItem("be_prem_launch", "1"); } catch (e) {}
    if (lang) await setLang(lang);
  }, [keepLaunch, lang]);
  if (uid) await p.evaluate(async uid => { FBUser = { uid, email: uid + "@test", getIdToken: async () => "test-token-" + uid }; await entRefresh(); await Billing.init(); }, uid);
  else await p.evaluate(async () => { await Billing.init(); });   /* signed out: the store is still looked up, as at boot */
  return { ctx, p, errs };
}
/* everything a check needs to know about the sheet on screen */
const sheet = p => p.evaluate(() => {
  const o = document.getElementById("premOv"); if (!o) return null; const sh = o.querySelector(".prem-sheet"), sc = sh.querySelector(".prem-scroll"), x = o.querySelector(".prem-x"), foot = sh.querySelector(".prem-foot"), cta = sh.querySelector(".prem-cta");
  const vis = el => !!el && (el.checkVisibility ? el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }) : el.offsetParent !== null);
  const top = sel => { const e = sh.querySelector(sel); return e ? e.getBoundingClientRect().top : null; };
  const btns = [...sh.querySelectorAll("button")].filter(vis).map(b => ({ t: b.textContent.trim().slice(0, 30) || b.getAttribute("aria-label"), h: b.getBoundingClientRect().height, clip: b.scrollWidth > b.clientWidth + 1 }));
  const text = sh.innerText.replace(/\s+/g, " ");
  return { from: o.dataset.from, wait: !!o.dataset.xwait, xHidden: !x || x.hidden || !vis(x), xLeft: x ? x.getBoundingClientRect().left : null, xRight: x ? x.getBoundingClientRect().right : null, xAnim: x ? getComputedStyle(x).animationName : "", sheetAnim: getComputedStyle(sh).animationName,
    text, eyebrow: (sh.querySelector(".prem-eyebrow") || {}).innerText || "", gem: !!sh.querySelector(".prem-eyebrow .prem-tag .prem-gem"), h: (sh.querySelector(".prem-h") || {}).innerText || "", lede: (sh.querySelector(".prem-lede") || {}).innerText || "",
    ben: [...sh.querySelectorAll(".prem-ben li")].map(l => l.innerText.replace(/\s+/g, " ").trim()),
    /* the two-plan picker (tier spec, 5 Oct 2026) */
    plans: [...sh.querySelectorAll(".prem-plan")].map(e => ({ id: (/premPick\('([^']+)'/.exec(e.getAttribute("onclick") || "") || [])[1], on: e.classList.contains("on"), checked: e.getAttribute("aria-checked"), name: (e.querySelector(".prem-plan-name") || {}).innerText || "", price: ((e.querySelector(".prem-plan-price") || {}).innerText || "").replace(/\s+/g, " ").trim(), badge: (e.querySelector(".prem-plan-badge") || {}).innerText || "", save: (e.querySelector(".prem-plan-save") || {}).innerText || "", trial: (e.querySelector(".prem-plan-trial") || {}).innerText || "" })),
    radios: sh.querySelectorAll('[role="radiogroup"],[role="radio"]').length,
    offer: (o2 => o2 ? { text: o2.innerText.replace(/\s+/g, " ").trim(), trial: (o2.querySelector(".prem-offer-trial") || {}).innerText || "", name: (o2.querySelector(".prem-offer-name") || {}).innerText || "", price: (o2.querySelector(".prem-offer-price") || {}).innerText.replace(/\s+/g, " ").trim() || "" } : null)(sh.querySelector(".prem-offer")),
    ctas: sh.querySelectorAll(".prem-cta").length, cta: cta ? cta.innerText.trim() : null, ctaIn: cta ? (r => r.top >= 0 && r.bottom <= innerHeight + .5)(cta.getBoundingClientRect()) : null, ctaClip: cta ? cta.scrollWidth > cta.clientWidth + 1 : null,
    footIn: foot ? foot.getBoundingClientRect().bottom <= innerHeight + .5 : null, cancel: (sh.querySelector(".prem-cancel") || {}).innerText || "",
    unavail: sh.querySelectorAll(".prem-unavail").length, unavailText: [...sh.querySelectorAll(".prem-unavail")].map(e => e.innerText.replace(/\s+/g, " ")).join(" | "), retry: !!sh.querySelector(".prem-retry"), skel: sh.querySelectorAll(".prem-skel").length,
    closeBtn: [...sh.querySelectorAll("button")].some(b => !b.classList.contains("prem-x") && /^Close$|^Fermer$|^Cerrar$/i.test(b.textContent.trim())),
    legal: sh.querySelector(".prem-legal") ? { links: [...sh.querySelectorAll(".prem-legal a")].map(a => a.getAttribute("href")), restore: !!sh.querySelector(".prem-legal .prem-restore"), text: sh.querySelector(".prem-legal").innerText.replace(/\s+/g, " ") } : null,
    terms: (sh.querySelector(".prem-terms") || {}).innerText || "", more: sh.querySelector(".prem-more") ? { open: sh.querySelector(".prem-more").open, sum: sh.querySelector(".prem-more summary").innerText.trim(), tableVisible: vis(sh.querySelector(".prem-cmp")) } : null,
    order: { hero: top(".prem-hero"), ben: top(".prem-ben"), plans: top(".prem-plans") ?? top(".prem-offer"), cta: cta ? cta.getBoundingClientRect().top : null },
    overflow: document.documentElement.scrollWidth > innerWidth + 1 || (sc && sc.scrollWidth > sc.clientWidth + 1) || sh.scrollWidth > sh.clientWidth + 1,
    fits: (r => r.left >= -.5 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5)(sh.getBoundingClientRect()),
    btns, minBtn: btns.length ? Math.min(...btns.map(b => b.h)) : 99, clipped: btns.filter(b => b.clip).map(b => b.t), dir: getComputedStyle(sh).direction, theme: document.documentElement.getAttribute("data-theme"),
    done: !!sh.querySelector(".prem-done"), signin: !!sh.querySelector(".prem-signin"), manage: !!sh.querySelector("[onclick='Billing.manage()']"), status: (sh.querySelector(".prem-status") || {}).innerText || "" };
});
const openSheet = async (p, from = "test") => { await p.evaluate(f => premiumOpen(f), from); await sleep(300); return sheet(p); };
const shot = (p, name) => SHOTS ? p.screenshot({ path: `${SHOTS}/${name}.png` }) : null;
const BAD = /unlimited|more AI coaching|extra AI|Practice Partner|simulation|\{\{|\bprem\.[a-z_]+|\bacc\.[a-z_]+/i;

console.log("\n# A · Free, General English, a store with the 3-day trial on the annual plan");
{
  const { ctx, p, errs } = await open({ uid: "a1" });
  let s = await openSheet(p);
  ok("A1 · hero: 'BE Mastery [Premium mark] PREMIUM' eyebrow (visual identity v2: the gem replaced the ✦ glyph), the headline and the supporting line — no 'without limits'", s && /BE Mastery/i.test(s.eyebrow) && s.gem && !/✦/.test(s.eyebrow) && /PREMIUM/i.test(s.eyebrow) && s.h === "Speak with confidence. Go further every day." && /^More AI verdicts a day/.test(s.lede) && !/without limits|unlimited/i.test(s.h + s.lede), JSON.stringify(s && { e: s.eyebrow, h: s.h, l: s.lede }));
  /* the tier spec (5 Oct 2026): the verdicts and the video minutes are DAILY
     ALLOWANCES with their numbers named, then the two hard-locked capabilities,
     then the AI Coach on General English. Never "unlimited". */
  ok("A2 · benefits: 120 AI verdicts a day (fair use), 240 video minutes a day, advanced progress, 30/90-day analytics, the AI Coach; no ad-free claim while ads are off; nothing 'unlimited'", s.ben.length === 5 && /^120 AI verdicts a day \(fair use\)/.test(s.ben[0]) && /^240 minutes a day/.test(s.ben[1]) && /^Advanced progress/.test(s.ben[2]) && s.ben[3] === "30- and 90-day analytics" && /^The AI Coach/.test(s.ben[4]) && !/No ads/.test(s.text) && !BAD.test(s.text), JSON.stringify(s.ben) + " " + (s.text.match(BAD) || ""));
  const [an, mo] = s.plans;
  ok("A3 · TWO plans, annual first and chosen: 'Best value', $19.99 / year, 'Save 44%' computed from the store's two prices, the 3-day trial; then Monthly at $2.99 / month — one radio group", s.plans.length === 2 && an.id === "premium_annual" && an.on && an.checked === "true" && /^best value$/i.test(an.badge) && /\$19\.99/.test(an.price) && /\/ year/.test(an.price) && an.save === "Save 44%" && /3 days free/i.test(an.trial) && mo.id === "premium_monthly" && !mo.on && /\$2\.99/.test(mo.price) && /\/ month/.test(mo.price) && !mo.badge && s.radios === 3 && !/week/i.test(s.text), JSON.stringify({ plans: s.plans, radios: s.radios }));
  ok("A4 · one primary CTA 'Start 3-day free trial', pinned in a foot inside the viewport, with the renewal terms under it: what is charged next, at the store's price, and where to cancel", s.ctas === 1 && s.cta === "Start 3-day free trial" && s.ctaIn && s.footIn && s.cancel === "Then $19.99 / year. Cancel anytime in Google Play.", JSON.stringify({ ctas: s.ctas, cta: s.cta, ctaIn: s.ctaIn, footIn: s.footIn, cancel: s.cancel }));
  ok("A5 · nothing has to be chosen: annual is selected by default and the CTA buys it", await p.evaluate(() => _premSel === "premium_annual"), await p.evaluate(() => String(_premSel)));
  ok("A6 · legal row is secondary: Privacy policy link, Restore purchases (44 px), the store's renewal terms; no second Close button", s.legal && s.legal.links.includes("privacy.html") && s.legal.restore && /Restore purchases/.test(s.legal.text) && /renews automatically until you cancel it in Google Play/.test(s.terms) && !s.closeBtn && s.minBtn >= 44, JSON.stringify({ legal: s.legal, terms: s.terms, close: s.closeBtn, minBtn: s.minBtn, btns: s.btns }));
  ok("A7 · 'See what's included' is folded by default; open, the compact table fits and shows the real limits + 'everything stays included'", s.more && !s.more.open && s.more.sum === "See what's included" && !s.more.tableVisible && await p.evaluate(() => { const d = document.querySelector(".prem-more"); d.open = true; const t = d.querySelector(".prem-cmp"), sh = document.querySelector(".prem-sheet"); const r = t.getBoundingClientRect(), rs = sh.getBoundingClientRect(); return r.width > 0 && r.left >= rs.left - .5 && r.right <= rs.right + .5 && new RegExp("Up to "+planLimit("savedShadow","free")+"\\b").test(t.innerText) && new RegExp("Up to "+planLimit("savedShadow","premium")+"\\b").test(t.innerText) && new RegExp("Up to "+planLimit("youtubeImports","free")+"\\b").test(t.innerText) && new RegExp("Up to "+planLimit("youtubeImports","premium")+"\\b").test(t.innerText) && new RegExp("Last "+planLimit("polishHistory","premium")+"\\b").test(t.innerText) && /Everything you use today stays included/.test(d.innerText); }), JSON.stringify(s.more));
  await shot(p, "sheet-dark-390-included");
  await p.evaluate(() => { document.querySelector(".prem-more").open = false; });
  ok("A8 · hierarchy on screen: hero above benefits above the offer above the CTA", s.order.hero < s.order.ben && s.order.ben < s.order.plans && s.order.plans < s.order.cta, JSON.stringify(s.order));
  ok("A9 · the X is available at once when the sheet is opened by the learner; Escape closes it", !s.xHidden && !s.wait && await p.evaluate(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return !document.getElementById("premOv"); }));
  await openSheet(p); await shot(p, "sheet-dark-390");
  ok("A10 · Continue buys the SELECTED plan through the existing Billing.buy (Play asked for premium_annual)", await p.evaluate(async () => { document.querySelector(".prem-cta").click(); await new Promise(r => setTimeout(r, 300)); return __play.shows[0] === "premium_annual"; }));
  ok("A11 · Restore purchases goes through the existing Billing.restore", await p.evaluate(async () => { document.querySelector(".prem-restore").click(); await new Promise(r => setTimeout(r, 300)); return __play.lists >= 1; }));
  await p.evaluate(() => { const b = [...document.querySelectorAll(".prem-plan")].find(e => /premium_monthly/.test(e.getAttribute("onclick"))); b.click(); });
  await sleep(250); s = await sheet(p);
  ok("A11b · tapping Monthly selects it: the card lights, the CTA keeps the 3-day trial (owner, 6 Oct 2026: the trial is on both plans) with the monthly renewal line, and Continue buys premium_monthly", s.plans.find(x => x.id === "premium_monthly").on && !s.plans.find(x => x.id === "premium_annual").on && s.cta === "Start 3-day free trial" && s.cancel === "Then $2.99 / month. Cancel anytime in Google Play." && await p.evaluate(async () => { document.querySelector(".prem-cta").click(); await new Promise(r => setTimeout(r, 300)); return __play.shows.includes("premium_monthly"); }), JSON.stringify({ plans: s.plans, cta: s.cta, cancel: s.cancel }));
  await p.evaluate(() => premPick("premium_annual"));
  ok("A12 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# B · a store that reports no trial");
{
  const { ctx, p } = await open({ uid: "b1", trial: false });
  let s = await openSheet(p);
  ok("B1 · an Apple ID / account the store says is not eligible: no trial claimed anywhere, the CTA is 'Continue with Premium', and the line under it is the plain cancel note", !/days free|free trial/i.test(s.text) && s.cta === "Continue with Premium" && s.plans.length === 2 && s.plans.every(x => !x.trial) && s.cancel === "Cancel anytime in Google Play", JSON.stringify({ cta: s.cta, cancel: s.cancel, plans: s.plans }));
  await ctx.close();
}

console.log("\n# C · billing unavailable — the store returns no products");
{
  const { ctx, p, errs } = await open({ uid: "c1", products: false });
  let s = await openSheet(p);
  const n = (s.text.match(/Purchases are not available right now/g) || []).length;
  ok("C1 · exactly ONE 'Purchases are not available right now', with a short hint and Try again; the benefits stay; no plan, no price, no CTA, no Close button; the X is there", n === 1 && s.unavail === 1 && /Check your connection and Google Play/.test(s.unavailText) && s.retry && s.ben.length === 5 && !s.offer && !s.plans.length && !/\$/.test(s.text) && s.ctas === 0 && !s.closeBtn && !s.xHidden && s.minBtn >= 44, JSON.stringify({ n, s: s.unavailText, retry: s.retry, ben: s.ben.length, plans: s.plans.length, cta: s.ctas, close: s.closeBtn, x: s.xHidden }));
  await shot(p, "sheet-unavailable-dark-390");
  await p.evaluate(async () => { __play.noProducts = false; premRetry(); await new Promise(r => setTimeout(r, 400)); }); s = await sheet(p);
  ok("C2 · Try again asks the store again: the two plans and the CTA appear", s.plans.length === 2 && s.ctas === 1 && s.unavail === 0, JSON.stringify({ plans: s.plans.length, cta: s.ctas }));
  ok("C3 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# D · no store at all (the open web) · E · signed out");
{
  const { ctx, p } = await open({ uid: "d1", stub: false });
  const s = await openSheet(p);
  ok("D1 · no provider: one plain message (get it from Google Play), the benefits still shown, no price, no Close button, the X leaves", s.unavail === 1 && /can't be bought on this device yet/.test(s.unavailText) && (s.text.match(/can't be bought/g) || []).length === 1 && s.ben.length === 5 && !/\$/.test(s.text) && !s.closeBtn && !s.xHidden && s.ctas === 0, JSON.stringify({ u: s.unavailText, ben: s.ben.length, close: s.closeBtn }));
  await shot(p, "sheet-noprovider-dark-390");
  await ctx.close();
  const o = await open({ uid: null });
  const t = await openSheet(o.p);
  ok("E1 · signed out: the foot asks to sign in; nothing is sold (no plans, no purchase CTA)", t.signin && !t.plans.length && t.ctas === 0 && /Sign in to get Premium/.test(t.text), t.text);
  await o.ctx.close();
}

console.log("\n# F · a Premium learner");
{
  grant("f1"); const { ctx, p } = await open({ uid: "f1", owned: [{ itemId: "premium_annual", purchaseToken: "tok_f1_" + "f".repeat(20) }] });
  const s = await openSheet(p);
  ok("F1 · 'You're on Premium', Active, 'Continue learning' as the one action, Manage subscription and Subscription details; no plans, no CTA, no cancel line", /You're on Premium/.test(s.h) && /Active/.test(s.status) && s.done && s.manage && /Subscription details/.test(s.text) && !s.plans.length && s.ctas === 0 && !s.cancel && !s.closeBtn, JSON.stringify({ h: s.h, st: s.status, done: s.done, manage: s.manage, plans: s.plans.length }));
  await shot(p, "sheet-premium-dark-390");
  await ctx.close();
}

console.log("\n# G · the launch offer: X hidden, then available, then closes");
{
  const { ctx, p, errs } = await open({ uid: "g1", keepLaunch: true }); await sleep(2600);
  let s = await sheet(p);
  ok("G1 · opens by itself for a Free General English learner; the X is hidden and Escape / a tap outside do nothing yet", s && s.from === "launch" && s.xHidden && s.wait && await p.evaluate(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); document.getElementById("premOv").click(); return !!document.getElementById("premOv"); }), JSON.stringify(s && { from: s.from, x: s.xHidden, wait: s.wait }));
  await shot(p, "launch-dark-390-wait");
  let waited = 0; for (; waited < 9000; waited += 200) { s = await sheet(p); if (s && !s.xHidden) break; await sleep(200); }
  const since = await p.evaluate(() => Date.now() - (+document.getElementById("premOv").dataset.t0));
  ok("G2 · after ~5 s (never sooner) the X appears with its fade, and Escape now closes", s && !s.xHidden && !s.wait && since >= 4900 && since < 7000 && s.xAnim === "premXin" && await p.evaluate(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return !document.getElementById("premOv"); }), JSON.stringify(s && { x: s.xHidden, wait: s.wait, anim: s.xAnim, since }));
  await p.evaluate(() => { sessionStorage.removeItem("be_prem_launch"); premiumOpen("launch"); }); await sleep(5600);
  ok("G3 · tapping the X closes the offer and the learner carries on", await p.evaluate(() => { document.querySelector("#premOv .prem-x").click(); return !document.getElementById("premOv"); }));
  ok("G4 · safety net: if the reveal timer never ran, the wait still ends by the clock — the sheet is never impossible to leave", await p.evaluate(() => { premiumOpen("launch"); const o = document.getElementById("premOv"); o.dataset.t0 = String(Date.now() - 20000); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return !document.getElementById("premOv"); }));
  ok("G5 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# H · phones: 320 px, dark / light, Arabic RTL, long translations, reduced motion");
for (const [lab, o] of [["dark-320", { theme: "dark", vp: { width: 320, height: 568 } }], ["light-320", { theme: "light", vp: { width: 320, height: 568 } }], ["light-390", { theme: "light" }], ["dark-412", { theme: "dark", vp: { width: 412, height: 915 } }], ["ar-360", { lang: "ar", vp: { width: 360, height: 740 } }], ["fr-320", { lang: "fr", vp: { width: 320, height: 568 } }], ["de-320", { lang: "de", vp: { width: 320, height: 568 } }], ["reduced", { motion: "reduce" }]]) {
  const { ctx, p, errs } = await open({ uid: "h-" + lab, ...o });
  const s = await openSheet(p);
  await p.evaluate(() => premPick("premium_monthly")); await sleep(150);
  const s2 = await sheet(p);   /* the second selection state: Monthly chosen, its CTA must not clip either */
  await p.evaluate(() => premPick("premium_annual")); await sleep(150);
  await shot(p, "sheet-" + lab);
  /* AA text contrast inside the sheet (gradient text and white-on-gradient controls are token-checked by the design system's own sweep) */
  const con = await p.evaluate(() => { const sh = document.querySelector(".prem-sheet"); const rgb = v => { const m = (v.match(/[\d.]+/g) || []).map(Number); if (/^color\(srgb/.test(v)) { m[0] *= 255; m[1] *= 255; m[2] *= 255; } return m; };   /* color-mix() computes to color(srgb r g b / a) */ const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const blend = (t, u) => { const a = t[3] ?? 1; return [0, 1, 2].map(i => t[i] * a + u[i] * (1 - a)); };
    const bgOf = el => { const L = []; for (let e = el; e; e = e.parentElement) { const b = rgb(getComputedStyle(e).backgroundColor); if (b.length && (b.length < 4 || b[3] > 0)) { L.push(b.length < 4 ? [...b, 1] : b); if (b.length < 4 || b[3] >= 1) break; } } let bg = L.pop() || [0, 0, 0, 1]; while (L.length) bg = blend(L.pop(), bg); return bg; };
    let worst = { r: 99, t: "" }; for (const e of sh.querySelectorAll("*")) { if (!e.checkVisibility() || e.closest(".prem-h2") || e.closest('[aria-hidden="true"]') || getComputedStyle(e).backgroundImage !== "none" || e.closest(".prem-cta,.prem-tag,.prem-best,.prem-radio")) continue; if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const fg = rgb(getComputedStyle(e).color).slice(0, 3), bg = bgOf(e); const [x, y] = [lum(fg), lum(bg)].sort((a, b) => b - a); const r = (x + .05) / (y + .05); if (r < worst.r) worst = { r, t: e.textContent.trim().slice(0, 30), c: e.className }; } return worst; });
  const rtl = lab.startsWith("ar") ? s.dir === "rtl" && s.xLeft < 60 : s.dir === "ltr";
  ok(`H · ${lab}: fits, no sideways scroll, CTA visible without scrolling, no label clipped, every control ≥ 44 px, text ≥ 4.5:1${lab.startsWith("ar") ? ", right-to-left with the X on the left" : ""}${lab === "reduced" ? ", no animation" : ""}, no raw key`, s && s.fits && !s.overflow && s.ctaIn && !s.ctaClip && !s2.ctaClip && !s.clipped.length && s.minBtn >= 44 && rtl && (lab !== "reduced" || s.sheetAnim === "none") && !/\{\{|\bprem\.[a-z_]+/.test(s.text) && s.plans.length === 2 && (!o.theme || s.theme === o.theme) && con.r >= 4.5 && !errs.length, JSON.stringify({ fits: s && s.fits, contrast: con, overflow: s && s.overflow, ctaIn: s && s.ctaIn, clip: s && [s.ctaClip, s2.ctaClip, s.clipped], minBtn: s && s.minBtn, dir: s && s.dir, xLeft: s && s.xLeft, anim: s && s.sheetAnim, errs }));
  await ctx.close();
}

console.log("\n# J · the General English boundary: Welding");
{
  const { ctx, p } = await open({ track: "welding", uid: "j1", keepLaunch: true }); await sleep(2800);
  const w = await p.evaluate(async () => { const launch = !!document.getElementById("premOv"); go("profile"); await new Promise(r => setTimeout(r, 400)); const prof = !!document.querySelector(".pf-prem"); go("data"); await new Promise(r => setTimeout(r, 600)); return { launch, prof, offered: premOffered(), card: !!document.getElementById("entPlan"), sub: !!document.getElementById("subCard") && !document.getElementById("subCard").hidden, ads: !!premRemoveAdsHTML("x") }; });
  /* Owner, 30 September 2026: ONE subscription covers both tracks, so Welding
     now carries the same offer and the same management surfaces. This asserted
     the opposite while Premium was General-English-only. */
  ok("J1 · Welding, Free: the SAME offer and management surfaces as General English — one subscription, one paywall", w.prof && w.offered && w.card && w.sub, JSON.stringify(w));
  await ctx.close();
  grant("j2"); const o = await open({ track: "welding", uid: "j2", owned: [{ itemId: "premium_monthly", purchaseToken: "tok_j2_" + "j".repeat(20) }] });
  const v = await o.p.evaluate(async () => { go("profile"); await new Promise(r => setTimeout(r, 400)); const row = document.querySelector(".pf-prem .pf-row"); go("data"); await new Promise(r => setTimeout(r, 600)); const c = document.getElementById("subCard"); return { row: row && row.textContent.replace(/\s+/g, " "), sub: c ? c.innerText.replace(/\s+/g, " ") : null }; });
  ok("J2 · Welding, Premium: the Subscription row and card still exist (a paying learner can manage the plan)", v.row && /Subscription/.test(v.row) && /Premium/.test(v.row) && v.sub && /Manage subscription/.test(v.sub), JSON.stringify(v));
  await o.ctx.close();
}

console.log("\n# K · App Setup → Subscription");
{
  const { ctx, p } = await open({ uid: "k1" });
  const f = await p.evaluate(async () => { go("data"); for (let i = 0; i < 40 && !document.getElementById("subCard"); i++) await new Promise(r => setTimeout(r, 50)); const c = document.getElementById("subCard"); const t = c.innerText.replace(/\s+/g, " "); c.querySelector(".sub-plans").click(); await new Promise(r => setTimeout(r, 300)); return { t, sheet: !!document.getElementById("premOv"), from: (document.getElementById("premOv") || { dataset: {} }).dataset.from }; });
  ok("K1 · Free: 'Subscription · Current plan Free', 'See Premium plans' opens the acquisition sheet, Restore purchases beside it", /Subscription/.test(f.t) && /Current plan Free/.test(f.t) && /See Premium plans/.test(f.t) && /Restore purchases/.test(f.t) && f.sheet && f.from === "settings" && !/\$/.test(f.t), JSON.stringify(f));
  await p.evaluate(() => premClose()); if (SHOTS) await p.locator("#subCard").screenshot({ path: `${SHOTS}/settings-free-dark-390.png` });
  await ctx.close();
  grant("k2", { expires: NOW + 200 * DAY }); const o = await open({ uid: "k2", owned: [{ itemId: "premium_annual", purchaseToken: "tok_k2_" + "k".repeat(20) }] });
  const pr = await o.p.evaluate(async () => { go("data"); for (let i = 0; i < 40 && !document.getElementById("subCard"); i++) await new Promise(r => setTimeout(r, 50)); const c = document.getElementById("subCard"); return { t: c.innerText.replace(/\s+/g, " "), manage: !!c.querySelector(".sub-manage"), restore: !!c.querySelector(".sub-restore"), pay: !!c.querySelector("input") }; });
  ok("K2 · Premium: 'Premium · Annual', the store's price per year, 'Renews on' a date, Billed by Google Play, Manage subscription (Play's own page) and Restore — no payment or cancellation screen of ours", /Premium · Annual/.test(pr.t) && /\$19\.99 \/ year/.test(pr.t) && /Renews on/.test(pr.t) && /Google Play/.test(pr.t) && pr.manage && pr.restore && !pr.pay, JSON.stringify(pr));
  if (SHOTS) await o.p.locator("#subCard").screenshot({ path: `${SHOTS}/settings-premium-dark-390.png` });
  await o.ctx.close();
}

console.log("\n# L · ad-free is promised only while ads are on");
{
  const { ctx, p } = await open({ uid: "l1", flags: { billing_enabled: true, ads_enabled: true } });
  const s = await openSheet(p);
  ok("L1 · with ads_enabled (General English) the sheet adds 'No ads — ever' as a SIXTH row, after the five benefits; the Profile row no longer claims 'No ads, ever' on its own", s.ben.length === 6 && /No ads — ever/.test(s.ben[5]) && await p.evaluate(async () => { premClose(); go("profile"); await new Promise(r => setTimeout(r, 400)); const r = document.querySelector(".pf-prem .pf-row"); return !!r && /BE Mastery Premium/.test(r.textContent) && /More speaking, shadowing and AI tools/.test(r.textContent); }), JSON.stringify(s.ben));
  await ctx.close();
}

/* the Settings "Free plan" card (29 Sep 2026): its Premium list said "Ad-free learning" in a
   release with no ads anywhere — the benefit is listed only while ads_enabled is on */
for (const [lab, flags, want] of [["production defaults (ads off, billing off)", {}, false], ["billing on, ads off", { billing_enabled: true }, false], ["billing and ads on", { billing_enabled: true, ads_enabled: true }, true]]) {
  const { ctx, p } = await open({ uid: "l2" + want, flags });
  const r = await p.evaluate(async () => { go("data"); await new Promise(r => setTimeout(r, 500)); const d = document.querySelector("details.set-plan"); if (d) d.open = true; const c = document.getElementById("entPlan"); return c ? c.textContent.replace(/\s+/g, " ") : null; });
  ok(`L2 · Settings Premium card, ${lab}: 'Ad-free learning' ${want ? "listed" : "absent"}`, r !== null && /Ad-free learning/.test(r) === want, r);
  await ctx.close();
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
