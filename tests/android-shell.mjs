/* The native Android shell (mobile/android, Capacitor, 8 Oct 2026 — replaces the TWA).
   Run: cd tests && node android-shell.mjs
   The page is served AS https://localhost — the shell's own origin (androidScheme
   "https") — with a Capacitor stub that says "android" and carries no plugins yet,
   which is what phase 1-2 ships. Both programmes are checked (owner rule, 8 Oct 2026). */
import { chromium } from "playwright"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 400)}`); };
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg" };
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 8 Build/AP3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36";
const b = await chromium.launch();
async function open({ area = "general-english", platform = "android" } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: ANDROID, serviceWorkers: "block" });
  await ctx.route(u => u.hostname === "localhost", r => { let p = new URL(r.request().url()).pathname; if (p.endsWith("/")) p += "index.html"; const f = join(root, decodeURIComponent(p));
    return existsSync(f) ? r.fulfill({ status: 200, contentType: TYPES[extname(f)] || "application/octet-stream", body: readFileSync(f) }) : r.fulfill({ status: 404, body: "" }); });
  await ctx.route(u => /be-events|be-push|be-partner|be-polish|be-widget|entitlements|cloudflareinsights|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  await ctx.addInitScript(([area, platform]) => {
    /* BEPlayBilling stands in for BEPlayBillingPlugin.java with Play's answer shapes;
       window.__buy decides what the purchase sheet returns */
    const BEPlayBilling = {
      available: async () => ({ ok: true }),
      products: async () => ({ products: [
        { id: "premium_monthly", title: "Monthly", price: "$2.99", amount: 2.99, currency: "USD", period: "P1M", trial: "P3D" },
        { id: "premium_annual", title: "Annual", price: "$19.99", amount: 19.99, currency: "USD", period: "P1Y", trial: "P3D" }] }),
      purchase: async (args) => { window.__buyArgs = args; const id = args.id; return (window.__buy || (() => ({ productId: id, purchaseToken: "tok-" + id })))(id); },
      addListener: (name, cb) => { (window.__pl = window.__pl || {})[name] = cb; return { remove() {} }; },
      owned: async () => ({ items: [{ productId: "premium_annual", purchaseToken: "tok-owned", acknowledged: true, pending: false }, { productId: "someone_elses_sku", purchaseToken: "x" }] }),
      manage: async (o) => { window.__managed = o; },
    };
    if (window === window.top) window.Capacitor = { getPlatform: () => platform, isNativePlatform: () => platform !== "web", Plugins: platform === "android" ? { BEPlayBilling } : {}, PluginHeaders: [] };
    localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: area }, fnd: { [area]: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }));
  }, [area, platform]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("https://localhost/index.html"); await sleep(2500);
  await p.evaluate(() => { document.querySelectorAll(".cf-ov,.wc-ov,#rmCel,#syncNudge").forEach(e => e.remove()); go("home"); }); await sleep(1500);
  return { ctx, p, errs };
}
const state = p => p.evaluate(() => ({ android: IS_ANDROID_APP, ios: IS_IOS_APP, native: IS_NATIVE_APP, play: isPlayApp(), v2: flag("home_v2_enabled"), area: areaId(), hv2: homeV2On(), hero: (document.querySelector("#v-home .hx") || { dataset: {} }).dataset.kind || null, playLinks: document.querySelectorAll('a[href*="play.google.com"]').length, mic: micDeniedText("rec.mic_denied_toast") }));

console.log("\n# the Android shell is recognised as the Play app");
{ const { p, ctx, errs } = await open();
  const s = await state(p);
  ok("1 · IS_ANDROID_APP and IS_NATIVE_APP are true, IS_IOS_APP is false", s.android && s.native && !s.ios, JSON.stringify(s));
  ok("2 · isPlayApp() is true with no referrer and no ?wid= (the shell IS the Play app)", s.play === true, JSON.stringify(s));
  ok("3 · it gets the store apps' defaults (FLAGS_IOS: Home V2)", s.v2 === true, JSON.stringify(s));
  ok("4 · General English draws Home V2", s.area === "general-english" && s.hv2 && !!s.hero, JSON.stringify(s));
  ok("5 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close(); }

console.log("\n# Welding gets the same app (owner rule, 8 Oct 2026)");
{ const { p, ctx, errs } = await open({ area: "welding" });
  const s = await state(p);
  ok("6 · Welding draws Home V2 with the Welding studio", s.area === "welding" && s.hv2 && !!s.hero, JSON.stringify(s));
  await p.evaluate(() => go("shadow")); await sleep(2000);
  ok("7 · Welding's Shadow is the video Shadow Studio", await p.evaluate(() => typeof weldStudioOn === "function" && weldStudioOn() && cur.v === "shadow"), "");
  ok("8 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close(); }

console.log("\n# what stays Apple-only");
{ const { p, ctx } = await open();
  const r = await p.evaluate(() => ({ storekit: typeof beNativeBilling === "function" ? beNativeBilling() : "n/a" }));
  ok("9 · StoreKit is not offered on Android (beNativeBilling() is null)", r.storekit === null, JSON.stringify(r));
  await ctx.close(); }
{ const { p, ctx } = await open({ platform: "ios" });
  const s = await state(p);
  ok("10 · the iOS shell is unchanged: IS_IOS_APP true, IS_ANDROID_APP false, not the Play app", s.ios && !s.android && s.native && !s.play, JSON.stringify(s));
  await ctx.close(); }

console.log("\n# Play Billing goes through the native plugin, with the evidence the server already verifies");
{ const { p, ctx, errs } = await open();
  const r = await p.evaluate(async () => {
    const P = BillingProviders.play;
    const api = []; billingApi = async (m, path, body) => { api.push({ m, path, body }); if (path === "/v1/purchases/account-token") return { appAccountToken: "0b6f3c2a-1d4e-4f5a-8b9c-0d1e2f3a4b5c" }; return { view: null, results: [] }; };
    const out = { available: await P.available(), native: !!P._native, digitalGoods: !!P._svc };
    out.products = await P.products();
    const buy = await P.purchase("premium_annual"); out.evidence = buy.evidence; out.finishIsFn = typeof buy.finish === "function"; out.buyArgs = window.__buyArgs;
    window.__buy = () => ({ cancelled: true }); out.cancel = await P.purchase("premium_monthly");
    window.__buy = () => ({ owned: true }); out.owned = await P.purchase("premium_monthly");
    out.restore = await P.restore();
    P.manage("premium_annual"); out.managed = window.__managed;
    FBUser = { uid: "u1" }; P._listening = false; P.listen();
    await window.__pl.purchase({ productId: "premium_monthly", purchaseToken: "tok-later" }); await new Promise(r => setTimeout(r, 50));
    out.bg = api.filter(x => x.path === "/v1/purchases/restore").map(x => x.body);
    return out;
  });
  ok("11 · available() takes the native plugin, not Chrome's Digital Goods API", r.available && r.native && !r.digitalGoods, JSON.stringify(r));
  ok("12 · products are Play's own (price, period, 3-day trial) — never a number from the code", r.products.length === 2 && r.products[1].price === "$19.99" && r.products[1].period === "P1Y" && r.products[0].trial === "P3D", JSON.stringify(r.products));
  ok("13 · a purchase hands the server {provider:'google_play', productId, purchaseToken}", r.evidence && r.evidence.provider === "google_play" && r.evidence.productId === "premium_annual" && r.evidence.purchaseToken === "tok-premium_annual" && r.finishIsFn, JSON.stringify(r.evidence));
  ok("14 · a cancelled sheet is a cancel; an owned plan is reported as owned (Billing then restores it), not a purchase", r.cancel.cancelled === true && !r.cancel.evidence && r.owned.owned === true, JSON.stringify([r.cancel, r.owned]));
  ok("15 · restore lists only our two products, silently", r.restore.length === 1 && r.restore[0].productId === "premium_annual" && r.restore[0].purchaseToken === "tok-owned", JSON.stringify(r.restore));
  ok("16 · Manage opens Play's page through the plugin, for that plan", r.managed && r.managed.product === "premium_annual", JSON.stringify(r.managed));
  ok("16b · the purchase carries the server's account token (obfuscatedAccountId), never the uid", r.buyArgs && r.buyArgs.accountId === "0b6f3c2a-1d4e-4f5a-8b9c-0d1e2f3a4b5c", JSON.stringify(r.buyArgs));
  ok("16c · a purchase Play reports outside a purchase call (a pending payment that cleared) goes to the server at once", r.bg.length === 1 && r.bg[0].provider === "google_play" && r.bg[0].items[0].purchaseToken === "tok-later", JSON.stringify(r.bg));
  ok("17 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close(); }
{ const { p, ctx } = await open({ platform: "ios" });
  ok("18 · the iOS shell never offers Play Billing", await p.evaluate(async () => (await BillingProviders.play.available()) === false));
  await ctx.close(); }

await b.close();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
