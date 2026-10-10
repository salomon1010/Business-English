// throwaway: forwarding + service-worker checks against the LIVE site (deleted after use)
import { chromium } from "playwright";
const B = "https://app.lomonec.com";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 200)}`); };
const b = await chromium.launch();
const ctx = async (init, opts = {}) => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, ...opts }); if (init) await c.addInitScript(init); const p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message)); return { c, p, errs }; };
const path = p => new URL(p.url()).pathname;
{ const { c, p, errs } = await ctx(); await p.goto(B + "/", { waitUntil: "load" }); await p.waitForTimeout(800);
  ok("new visitor at / sees the portal, one app card → /bemastery/", path(p) === "/" && (await p.$$eval(".app a.btn-p", a => a.map(x => x.getAttribute("href")))).join() === "/bemastery/" && !errs.length, path(p)); await c.close(); }
{ const { c, p } = await ctx(null, { userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36" });
  await p.goto(B + "/?wid=0123456789abcdef0123456789abcdef", { waitUntil: "load" }); await p.waitForTimeout(1500);
  ok("Play app launch (/?wid=…) forwards into /bemastery/ and the app strips the id", path(p) === "/bemastery/" && !/wid=/.test(p.url()), p.url()); await c.close(); }
{ const { c, p } = await ctx(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => /standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q); });
  await p.goto(B + "/", { waitUntil: "load" }); await p.waitForTimeout(1200);
  ok("installed home-screen app opened at / forwards into /bemastery/", path(p) === "/bemastery/", p.url()); await c.close(); }
{ const { c, p } = await ctx(() => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Old", lang: "en" } })); } });
  await p.goto(B + "/#journey", { waitUntil: "load" }); await p.waitForTimeout(1500);
  ok("returning learner + notification link (/#journey) → /bemastery/#journey", path(p) === "/bemastery/" && new URL(p.url()).hash === "#journey", p.url()); await c.close(); }
{ const { c, p } = await ctx(); await p.goto(B + "/?next=https://evil.example/", { waitUntil: "load" }); await p.waitForTimeout(600);
  ok("no open redirect from the live portal", new URL(p.url()).origin === B, p.url()); await c.close(); }
{ const { c, p, errs } = await ctx(); await p.goto(B + "/bemastery/", { waitUntil: "load" }); await p.waitForTimeout(3500);
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? r.scope : null; });
  ok("the app at /bemastery/ registers its own service worker with scope /bemastery/", sw === B + "/bemastery/", sw);
  ok("first run at /bemastery/ shows onboarding (landing flag off), no page errors", !!(await p.$("#obWrap")) && !(await p.$("#webGate")) && !errs.length, errs.join(" | ")); await c.close(); }
await b.close();
const f = res.filter(x => !x).length; console.log(`\n${res.length - f}/${res.length} passed against the live site`); process.exit(f ? 1 : 0);
