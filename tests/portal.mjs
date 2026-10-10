/* The LOMON EC portal at / and BE Mastery at /bemastery/ (docs/PORTAL.md,
   docs/ACCESS-MATRIX.md). Builds the site exactly as the Pages workflow does
   (scripts/portal/build-site.mjs) into a temporary folder, serves it, and
   checks it in a real headless Chromium:
     routing + legacy addresses, the forwarder (and that it cannot send anyone
     off the site), both service workers, static assets, and the web visitor
     landing — shown to a new plain-browser visitor only, never to the Play app,
     an installed app or an existing anonymous learner.

     cd tests && node portal.mjs            (PORT=<free port> if 8791 is taken) */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const repo = new URL("..", import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), "be-portal-"));
const b = spawnSync(process.execPath, [join(repo, "scripts/portal/build-site.mjs"), dir], { encoding: "utf8" });
if (b.status !== 0) { console.error(b.stderr || b.stdout); process.exit(1); }
console.log("  " + b.stdout.trim().split("\n").join("\n  "));

const PORT = +(process.env.PORT || 8791);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: dir, stdio: "ignore" });
await sleep(900);
const BASE = "http://127.0.0.1:" + PORT;

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const browser = await chromium.launch();
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" };
const DESKTOP = { viewport: { width: 1280, height: 800 } };
async function fresh(opts = DESKTOP, init) {
  const ctx = await browser.newContext(opts);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e.message)));
  return { ctx, page, errors };
}
const path = (page) => new URL(page.url()).pathname;
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const GATE_ON = () => localStorage.setItem("be_flags", JSON.stringify({ web_visitor_gate_enabled: true }));

try {
  /* ── the portal ── */
  for (const [label, opts] of [["laptop", DESKTOP], ["phone", MOBILE]]) {
    const { ctx, page, errors } = await fresh(opts);
    await page.goto(BASE + "/", { waitUntil: "load" });
    const r = await page.evaluate(() => ({ h1: document.querySelector("h1")?.textContent, apps: [...document.querySelectorAll(".app a.btn-p")].map(a => a.getAttribute("href")) }));
    ok(`Portal (${label}): renders, one app, BE Mastery → /bemastery/`, path(page) === "/" && r.h1 === "Lomonec apps" && r.apps.length === 1 && r.apps[0] === "/bemastery/", JSON.stringify(r));
    ok(`Portal (${label}): no sideways scroll, no script errors`, await noOverflow(page) && !errors.length, errors.join(" | "));
    if (label === "laptop") {
      await page.click(".app a.btn-p"); await page.waitForLoadState("load"); await sleep(1200);
      ok("Portal → Open BE Mastery loads the app at /bemastery/ (first run: onboarding, as today)", path(page) === "/bemastery/" && !!(await page.$("#obWrap")) && !errors.length, path(page) + " " + errors.join(" | "));
    }
    await ctx.close();
  }

  /* ── the forwarder: legacy launches reach the app, with their query and hash ── */
  {
    const { ctx, page } = await fresh(MOBILE);
    const wid = "0123456789abcdef0123456789abcdef";
    await page.goto(BASE + "/?wid=" + wid, { waitUntil: "load" }); await sleep(800);
    const r = await page.evaluate(() => ({ s: location.search, w: localStorage.getItem("be_widget_wid") }));
    ok("Play app launch (/?wid=…) → /bemastery/, the app keeps the widget id and strips it", path(page) === "/bemastery/" && r.w === wid && !/wid=/.test(r.s), path(page) + JSON.stringify(r));
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh();
    await page.goto(BASE + "/#journey", { waitUntil: "load" }); await sleep(500);
    ok("Notification link (/#journey) → /bemastery/#journey", path(page) === "/bemastery/" && new URL(page.url()).hash === "#journey", page.url());
    await page.goto(BASE + "/?portal=1#journey", { waitUntil: "load" }); await sleep(400);
    ok("?portal=1 always shows the portal", path(page) === "/", page.url());
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh(DESKTOP, () => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Old", lang: "en" } })); } });
    await page.goto(BASE + "/", { waitUntil: "load" }); await sleep(500);
    ok("A learner whose progress is on this origin (bookmark of the old root) → /bemastery/", path(page) === "/bemastery/", page.url());
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh(DESKTOP, () => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => /standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q); });
    await page.goto(BASE + "/", { waitUntil: "load" }); await sleep(500);
    ok("An installed home-screen app opened at / → /bemastery/", path(page) === "/bemastery/", page.url());
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh();
    await page.goto(BASE + "/?next=https://evil.example/&redirect=//evil.example", { waitUntil: "load" }); await sleep(400);
    const a = new URL(page.url());
    await page.goto(BASE + "/#//evil.example/x", { waitUntil: "load" }); await sleep(400);
    const c = new URL(page.url());
    ok("No open redirect: hostile query or hash never leaves the site", a.origin === BASE && a.pathname === "/" && c.origin === BASE, a.href + " | " + c.href);
    await ctx.close();
  }

  /* ── legacy addresses ── */
  {
    const { ctx, page } = await fresh();
    const get = async (p) => { const r = await page.request.get(BASE + p); return { s: r.status(), t: (r.headers()["content-type"] || ""), body: await r.text().catch(() => "") }; };
    const priv = await get("/privacy.html"), del = await get("/delete-account.html"), yt = await get("/yt-embed.html");
    ok("Store-registered pages answer at the root with their real content (privacy, delete-account)", priv.s === 200 && /Privacy/i.test(priv.body) && !/has moved/.test(priv.body) && del.s === 200 && !/has moved/.test(del.body));
    ok("The shipped iOS app's YouTube relay answers at /yt-embed.html", yt.s === 200 && /iframe_api/.test(yt.body));
    const al = await get("/.well-known/assetlinks.json");
    let alOk = false; try { alOk = Array.isArray(JSON.parse(al.body)); } catch {}
    ok("Origin-level files stay at the root (.well-known/assetlinks.json, IndexNow key, og.png, robots, sitemap)",
      alOk && (await get("/0703eea26ef786413e910ec4d620b6a0.txt")).s === 200 && (await get("/og.png")).t.includes("image") && /bemastery/.test((await get("/sitemap.xml")).body) && /Sitemap:/.test((await get("/robots.txt")).body));
    await page.goto(BASE + "/flyer.html?lang=fr#x", { waitUntil: "load" }); await sleep(500);
    ok("Old page address (/flyer.html?lang=fr#x) forwards to /bemastery/flyer.html with query and hash", path(page) === "/bemastery/flyer.html" && new URL(page.url()).search === "?lang=fr" && new URL(page.url()).hash === "#x", page.url());
    await page.goto(BASE + "/manual/en.html", { waitUntil: "load" }); await sleep(500);
    ok("Old help-centre address (/manual/en.html) forwards to /bemastery/manual/en.html", path(page) === "/bemastery/manual/en.html", page.url());
    const stub = await get("/flyer.html");
    ok("A forwarding stub is noindex with a canonical to the new address", /noindex/.test(stub.body) && /rel="canonical" href="https:\/\/app\.lomonec\.com\/bemastery\/flyer\.html"/.test(stub.body));
    await ctx.close();
  }

  /* ── static assets + service workers ── */
  {
    const { ctx, page } = await fresh();
    await page.goto(BASE + "/bemastery/", { waitUntil: "load" });
    const sw = readFileSync(join(dir, "bemastery/sw.js"), "utf8");
    const shell = JSON.parse(/const SHELL\s*=\s*(\[[\s\S]*?\]);/.exec(sw)[1].replace(/,\s*\]/, "]"));
    const bad = [];
    for (const f of shell) { const r = await page.request.get(new URL(f, BASE + "/bemastery/").href); if (r.status() !== 200) bad.push(f + " " + r.status()); }
    ok(`Every app-shell file (${shell.length}) answers under /bemastery/`, !bad.length, bad.join(", "));
    const reg = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.register("sw.js");
      const w = r.installing || r.waiting || r.active;
      await new Promise(res => { if (w.state === "activated") return res(); w.addEventListener("statechange", () => { if (w.state === "activated") res(); }); setTimeout(res, 15000); });
      return { scope: r.scope, state: (r.active || {}).state, caches: await caches.keys() };
    });
    ok("The app's service worker registers with scope /bemastery/ and precaches its shell", reg.scope === BASE + "/bemastery/" && reg.state === "activated" && reg.caches.some(c => /^be12-v\d+$/.test(c)), JSON.stringify(reg));
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh();
    await page.goto(BASE + "/?portal=1", { waitUntil: "load" });
    const r = await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await new Promise(res => setTimeout(res, 2500));
      return (await navigator.serviceWorker.getRegistrations()).map(x => x.scope);
    });
    ok("The root /sw.js retires itself (an old root registration does not linger)", !r.includes(BASE + "/"), JSON.stringify(r));
    await ctx.close();
  }

  /* ── the web visitor landing ── */
  {
    const { ctx, page, errors } = await fresh(MOBILE, GATE_ON);
    await page.goto(BASE + "/bemastery/", { waitUntil: "load" }); await sleep(1200);
    const r = await page.evaluate(() => { const g = document.getElementById("webGate"); return { gate: !!g, modal: g && g.getAttribute("aria-modal"), ob: !!document.getElementById("obWrap"), btns: g ? [...g.querySelectorAll("button")].map(b => b.textContent.trim()) : [], text: g ? g.innerText : "" }; });
    ok("Visitor (plain browser, no account, nothing on the device): the landing, not the app", r.gate && r.modal === "true" && !r.ob, JSON.stringify(r).slice(0, 300));
    ok("The landing names both programmes and offers Create account + Sign in", /General English/.test(r.text) && /Welding/.test(r.text) && r.btns.includes("Create a free account") && r.btns.includes("Sign in"), JSON.stringify(r.btns));
    ok("Landing: no sideways scroll on a phone, no script errors", await noOverflow(page) && !errors.length, errors.join(" | "));
    await page.click("#webGate .ob-go"); await sleep(500);
    ok("Create a free account opens the sign-up sheet above the landing", await page.evaluate(() => !!document.querySelector(".auth-ov")));
    await page.evaluate(() => document.querySelectorAll(".auth-ov").forEach(e => e.remove()));
    const lift = await page.evaluate(async () => {
      FBUser = { uid: "test", displayName: "Ada Lovelace" };
      webGateLift();
      const out = { gate: !!document.getElementById("webGate"), ob: !!document.getElementById("obWrap"), name: (document.getElementById("obName") || {}).value };
      FBUser = null; return out;
    });
    ok("Signed in as a NEW account: the landing gives way to the usual questions, name filled in", !lift.gate && lift.ob && lift.name === "Ada", JSON.stringify(lift));
    /* Welding must match General English: the same new web account can choose Welding and land in it */
    const weld = await page.evaluate(async () => {
      OB.name = "Ada"; obTrackPick("welding"); OB.trade = OB.trade || ""; obFinish();
      await new Promise(r => setTimeout(r, 500)); try { wcClose(); } catch (e) {}
      await new Promise(r => setTimeout(r, 400));
      return { area: areaId(), gate: !!document.getElementById("webGate"), ob: !!document.getElementById("obWrap"), profile: !!S.profile, ge: isGeneralEnglish() };
    });
    ok("…and that new account can choose Welding and lands in the Welding programme (no General English area)", weld.area === "welding" && !weld.ge && weld.profile && !weld.gate && !weld.ob, JSON.stringify(weld));
    const back = await page.evaluate(() => { document.getElementById("obWrap")?.remove(); fbWipeDevice(); const on = webGateOn(); if (on) webGateRender(); return on && !!document.getElementById("webGate"); });
    ok("After sign-out / account deletion wipes the device, the visitor is back on the landing", back);
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh({ ...MOBILE, locale: "fr-FR" }, GATE_ON);
    await page.goto(BASE + "/bemastery/", { waitUntil: "load" }); await sleep(2500);
    ok("The landing speaks the visitor's browser language (fr)", await page.evaluate(() => /Créer un compte gratuit/.test(document.getElementById("webGate")?.innerText || "")));
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh(MOBILE, () => { localStorage.setItem("be_flags", JSON.stringify({ web_visitor_gate_enabled: true })); sessionStorage.setItem("be_twa", "1"); });
    await page.goto(BASE + "/bemastery/", { waitUntil: "load" }); await sleep(1000);
    ok("Play app (TWA): no landing — first run is onboarding, as today", await page.evaluate(() => !document.getElementById("webGate") && !!document.getElementById("obWrap")));
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh(MOBILE, () => { localStorage.setItem("be_flags", JSON.stringify({ web_visitor_gate_enabled: true })); const mm = window.matchMedia.bind(window); window.matchMedia = (q) => /standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q); });
    await page.goto(BASE + "/bemastery/", { waitUntil: "load" }); await sleep(1000);
    ok("Installed home-screen app: no landing — onboarding, as today", await page.evaluate(() => !document.getElementById("webGate") && !!document.getElementById("obWrap")));
    await ctx.close();
  }
  {
    /* an existing anonymous learner keeps learning without an account */
    const { ctx, page, errors } = await fresh(DESKTOP);
    await page.goto(BASE + "/bemastery/", { waitUntil: "load" }); await sleep(800);
    await page.evaluate(() => { OB.name = "Anon"; obFinish(); wcClose(); });
    await sleep(500);
    await page.evaluate(GATE_ON);
    await page.goto("about:blank");   /* a hash-only goto would stay in the same document */
    await page.goto(BASE + "/bemastery/#journey", { waitUntil: "load" }); await sleep(1500);
    const r = await page.evaluate(() => ({ gate: !!document.getElementById("webGate"), on: document.getElementById("v-journey")?.classList.contains("on") }));
    ok("Existing anonymous learner with the gate on: no landing, deep link #journey opens the road map", !r.gate && r.on, JSON.stringify(r));
    await page.reload({ waitUntil: "load" }); await sleep(1500);
    ok("Refresh keeps the page (#journey) under /bemastery/", path(page) === "/bemastery/" && await page.evaluate(() => document.getElementById("v-journey")?.classList.contains("on")) && !errors.length, errors.join(" | "));
    await ctx.close();
  }
  {
    /* production default is ON (be12-v686), but a local test host never shows the landing
       without an explicit be_flags entry, so every other suite still meets onboarding */
    const { ctx, page } = await fresh(MOBILE);
    await page.goto(BASE + "/bemastery/", { waitUntil: "load" }); await sleep(1000);
    ok("Landing ON by default in production, but never on a local test host without an explicit override", await page.evaluate(() => FLAGS_DEFAULT.web_visitor_gate_enabled === true && webGateFlag() === false && !document.getElementById("webGate") && !!document.getElementById("obWrap")));
    await ctx.close();
  }
  {
    /* the Play app forwarded from the portal (referrer android-app://) is marked for the app */
    const { ctx, page } = await fresh(MOBILE, GATE_ON);
    await page.goto(BASE + "/?portal=1", { waitUntil: "load" });
    await page.evaluate(() => { sessionStorage.setItem("be_twa", "1"); });
    await page.goto(BASE + "/bemastery/", { waitUntil: "load" }); await sleep(1000);
    ok("A tab the portal marked as the Play app (be_twa) gets onboarding, never the landing", await page.evaluate(() => !document.getElementById("webGate") && !!document.getElementById("obWrap")));
    await ctx.close();
  }
} finally {
  await browser.close(); server.kill();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
const failed = res.filter(r => !r.pass).length;
console.log(`\n  ${res.length - failed}/${res.length} passed`);
process.exit(failed ? 1 : 0);
