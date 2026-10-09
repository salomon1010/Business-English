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
    if (window === window.top) window.Capacitor = { getPlatform: () => platform, isNativePlatform: () => platform !== "web", Plugins: {}, PluginHeaders: [] };
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

await b.close();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
