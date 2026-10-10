/* The Play app gets what the App Store app has (owner, 6 Oct 2026).
   Run: cd tests && node play-parity.mjs
   The page is served AS https://app.lomonec.com (Playwright answers that host
   from this tree), on an Android user agent, so the host and app rules are the
   real ones. Firebase's SDK is the real one from gstatic (network needed). */
import { chromium } from "playwright"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 400)}`); };
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg" };
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const b = await chromium.launch();
async function open({ ua = ANDROID, query = "", standalone = false, flags = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua, serviceWorkers: "block" });
  await ctx.route(u => u.hostname === "app.lomonec.com", r => { let p = new URL(r.request().url()).pathname; if (p.endsWith("/")) p += "index.html"; const f = join(root, decodeURIComponent(p));
    return existsSync(f) ? r.fulfill({ status: 200, contentType: TYPES[extname(f)] || "application/octet-stream", body: readFileSync(f) }) : r.fulfill({ status: 404, body: "" }); });
  await ctx.route(u => /be-events|be-push|be-partner|be-polish|be-widget|entitlements|cloudflareinsights|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  await ctx.addInitScript(([standalone, flags]) => {
    localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 }));
    if (flags) localStorage.setItem("be_flags", JSON.stringify(flags));
    if (standalone) { const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q); }
  }, [standalone, flags]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("https://app.lomonec.com/index.html" + query); await sleep(2500);
  return { ctx, p, errs };
}
console.log("\n# the Play app is recognised, a browser is not");
{ const { p, ctx, errs } = await open({ query: "?wid=abababababababababababababababab", standalone: true });
  const r = await p.evaluate(() => ({ play: isPlayApp(), v2: flag("home_v2_enabled"), mic: micDeniedText("rec.mic_denied_toast"), sr: srErrText("not-allowed", "x"), why: (() => { try { return billingWhy(); } catch (e) { return "err"; } })() }));
  ok("1 · Android + the app's widget id → the Play app", r.play === true, JSON.stringify(r));
  ok("2 · the Play app gets the App Store app's defaults (Home V2 on, as on iPhone)", r.v2 === true, JSON.stringify(r));
  ok("3 · a blocked microphone points to the app icon's Site settings, not 'your browser'", /Site settings/.test(r.mic) && /Site settings/.test(r.sr), JSON.stringify(r));
  ok("4 · no JavaScript errors", errs.length === 0, errs.join(" | "));
  await ctx.close(); }
{ const { p, ctx } = await open({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" });
  /* compared with FLAGS_DEFAULT itself: Home V2 became the website default in be12-v653 */
  const r = await p.evaluate(() => ({ play: isPlayApp(), v2: flag("home_v2_enabled"), web: !!FLAGS_DEFAULT.home_v2_enabled, mic: micDeniedText("rec.mic_denied_toast") }));
  ok("5 · a desktop browser is not the Play app and keeps the website's defaults", r.play === false && r.v2 === r.web && !/Site settings/.test(r.mic), JSON.stringify(r));
  await ctx.close(); }
console.log("\n# Google and Apple sign-in inside the installed Play app");
{ const { p, ctx } = await open({ query: "?wid=abababababababababababababababab", standalone: true, flags: { social_signin_web_enabled: true, auth_proxy_enabled: false } });
  const r = await p.evaluate(async () => { try { await fbLoad(); } catch (e) {} return { dom: FB_CONFIG.authDomain, same: fbAuthSameOrigin(), on: socialWebOn() }; });
  ok("6 · with the proxy switched off the installed app hides Google / Apple — firebaseapp.com cannot hand the result back", r.dom === "be-mastery.firebaseapp.com" && r.same === false && r.on === false, JSON.stringify(r));
  await ctx.close(); }
{ const { p, ctx } = await open({ query: "?wid=abababababababababababababababab", standalone: true, flags: { social_signin_web_enabled: true, auth_proxy_enabled: true } });
  const r = await p.evaluate(async () => { try { await fbLoad(); } catch (e) {} return { dom: FB_CONFIG.authDomain, same: fbAuthSameOrigin(), on: socialWebOn(), auth: !!FBauth }; });
  ok("7 · with auth_proxy_enabled the helper is auth.lomonec.com, the same site as the app, so the installed app offers Google and Apple (redirect)", r.dom === "auth.lomonec.com" && r.same === true && r.on === true, JSON.stringify(r));
  const s = await p.evaluate(() => [fbSite("auth.lomonec.com"), fbSite("app.lomonec.com"), fbSite("be-mastery.firebaseapp.com"), fbSite("evil-lomonec.com")]);
  ok("8 · the site rule: auth. and app.lomonec.com are one site; firebaseapp.com and a look-alike are not", s[0] === s[1] && s[2] !== s[1] && s[3] !== s[1], JSON.stringify(s));
  await ctx.close(); }
await b.close();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
