/* The rating ask (31 Oct 2026, owner: "add reminder for rating the app").
   From the 3rd finished session (was the 7th), in BOTH store apps (was Android
   only). In a store app the post-session ask is the store's OWN sheet (BEReview →
   Play in-app review / Apple requestReview) with no dialog of ours in front of it,
   at most once in RATE_NATIVE_GAP, and it never marks the learner as rated. The
   Home card's button opens the store listing (App Store: write-review). An Android
   browser keeps the existing dialog.

     cd tests && node rate-ask.mjs        (PORT=<free port> if 8799 is taken) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = +(process.env.PORT || 8799);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
await sleep(900);
const BASE = "http://127.0.0.1:" + PORT;
const res = [];
const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 240)}`); };
const browser = await chromium.launch();
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

/* a store shell: Capacitor reports the platform, BEReview records each request */
const SHELL = ([plat]) => {
  window.__rv = { calls: 0 };
  const a = (window.Capacitor = window.Capacitor || {});
  a.getPlatform = () => plat; a.isNativePlatform = () => true;
  (a.Plugins = a.Plugins || {}).BEReview = { available: async () => ({ available: true }), request: async () => { window.__rv.calls++; return { done: true }; } };
};
async function fresh({ plat = null, ua = ANDROID_UA } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua });
  /* the reminder ask is a separate prompt with its own suite; keep it out of the way */
  await ctx.addInitScript(() => { try { Object.defineProperty(Notification, "permission", { get: () => "denied", configurable: true }); } catch (e) {} });
  if (plat) await ctx.addInitScript(SHELL, [plat]);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e.message)));
  await page.goto(BASE + "/index.html", { waitUntil: "load" });
  await page.evaluate(() => { OB.name = "Rate"; obFinish(); try { wcClose(); } catch (e) {} });
  await sleep(500);
  await page.evaluate(() => document.querySelectorAll(".cf-ov,.wc-ov").forEach(o => o.remove()));
  return { ctx, page, errors };
}
async function finish(page, w) {
  /* an Android browser is offered "Get it on Google Play" (.pi-ov); the rating never
     opens on top of another dialog, so close it as a learner would */
  await page.evaluate(w => { document.querySelectorAll(".cf-ov.pi-ov:not(.ra-ov)").forEach(o => o.remove()); toggleDay(dayKey(w, "Mon"), w, "Mon"); }, w);
  for (let i = 0; i < 16; i++) { await sleep(250); await page.evaluate(() => { const c = document.getElementById("coachSummary"); if (c) c.remove(); }); }
  await sleep(1800);
}

try {
  {
    const { ctx, page, errors } = await fresh({ plat: "android" });
    ok("1 · RATE_MIN is 3", await page.evaluate(() => RATE_MIN) === 3);
    await finish(page, 1); await finish(page, 2);
    ok("2 · Android app: nothing after 2 sessions", await page.evaluate(() => window.__rv.calls === 0 && !document.querySelector(".ra-ov")));
    await finish(page, 3);
    const a = await page.evaluate(() => ({ calls: window.__rv.calls, dialog: !!document.querySelector(".ra-ov"), rated: !!S.rated, at: !!S.rateNativeAt }));
    ok("3 · Android app: the 3rd session asks Play's own review card", a.calls === 1, JSON.stringify(a));
    ok("4 · …with no dialog of ours in front of it (Play policy)", a.dialog === false, JSON.stringify(a));
    ok("5 · …and the learner is not marked as rated (the store never says)", a.rated === false && a.at === true, JSON.stringify(a));
    await finish(page, 4);
    ok("6 · not asked again within RATE_NATIVE_GAP", await page.evaluate(() => window.__rv.calls) === 1);
    const later = await page.evaluate(() => { S.rateNativeAt = Date.now() - RATE_NATIVE_GAP - 1000; return rateNativeDue(); });
    ok("7 · due again after the gap", later === true);
    ok("8 · the Home card's button opens the Play listing", await page.evaluate(() => rateStoreUrl() === playUrl()));
    ok("9 · no page errors", !errors.length, errors.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await fresh({ plat: "ios", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" });
    for (const w of [1, 2, 3]) await finish(page, w);
    const i = await page.evaluate(() => ({ calls: window.__rv.calls, dialog: !!document.querySelector(".ra-ov") }));
    ok("10 · iPhone app: asked too (it never was) — Apple's own sheet, no custom dialog", i.calls === 1 && i.dialog === false, JSON.stringify(i));
    const u = await page.evaluate(() => ({ u: rateStoreUrl(), card: !!rateHTML() }));
    ok("11 · the iPhone Home card points at the App Store write-review page", /^https:\/\/apps\.apple\.com\/app\/id\d+\?action=write-review$/.test(u.u) && u.card, JSON.stringify(u));
    ok("12 · no page errors", !errors.length, errors.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh();
    for (const w of [1, 2, 3]) await finish(page, w);
    ok("13 · Android browser (not the app): the existing dialog after the 3rd session", await page.evaluate(() => !!document.querySelector(".ra-ov")));
    ok("14 · …which offers the Play listing, as before", await page.evaluate(() => rateStoreUrl() === playUrl() && !rateNative()));
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" });
    for (const w of [1, 2, 3]) await finish(page, w);
    ok("15 · a desktop browser is never asked (no listing to send it to)", await page.evaluate(() => !document.querySelector(".ra-ov") && !rateHTML()));
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
const failed = res.filter(x => !x).length;
console.log(`\n${res.length - failed}/${res.length} passed`);
process.exit(failed ? 1 : 0);
