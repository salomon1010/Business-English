/* Phase 8 — coming back to the app is a natural break (owner, 3 Oct 2026).
   Run: cd tests && PORT=<free> node ad-resume.mjs

   The resume trigger gets NO exemption, so most of this file is the proof that
   every existing gate still refuses it. The ad path is the real one: a BEAds
   plugin stub shaped exactly like BEAdsPlugin.swift, so `load:interstitial:
   app_resume` and `show:interstitial:app_resume` reach the native bridge the
   iPhone uses. Nothing here is a real ad, and the entitlement answers come from
   backend/entitlements' own handle() over a real in-memory SQLite database. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite"; import { readFileSync, readdirSync } from "node:fs";
import { handle } from "../backend/entitlements/entitlements-worker.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8505), BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 320)}`); };
const b = await chromium.launch();

function d1() {
  const db = new DatabaseSync(":memory:");
  for (const m of readdirSync(new URL("../backend/entitlements/migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).sort())
    db.exec(readFileSync(new URL("../backend/entitlements/migrations/" + m, import.meta.url), "utf8"));
  return { prepare(sql) { const st = db.prepare(sql); let a = [];
    const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; },
      first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }),
      all: async () => ({ results: st.all(...a) }) }; return o; } };
}
let WENV = null;
const workerEnv = () => ({ DB: d1(), FIREBASE_PROJECT_ID: "be-mastery", DEV_AUTH: "1", ADMIN_TOKEN: "x".repeat(40) });
const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

/* the shell's BEAds plugin, same method names and answers as the Swift one */
const PLUGIN = ([cfg]) => {
  const ad = window.__ad = { calls: [], cfg, fill: true, shown: 0 };
  const P = {
    configure: async () => { ad.calls.push("configure"); return ad.cfg; },
    load: async a => { ad.calls.push("load:" + a.format + ":" + (a.context || "")); return { ready: !!ad.fill }; },
    isReady: async () => ({ ready: !!ad.fill }),
    show: async a => { ad.calls.push("show:" + a.format + ":" + (a.context || "")); if (!ad.fill) return { shown: false }; ad.shown++; return { shown: true, completed: true }; },
    dismiss: async () => { ad.calls.push("dismiss"); },
    showNative: async () => ({ shown: true }), moveNative: async () => {}, hideNative: async () => {},
  };
  window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true, Plugins: { BEAds: P }, PluginHeaders: [{ name: "BEAds" }] };
};
const NOPLUGIN = () => { window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true, Plugins: {}, PluginHeaders: [] }; };

async function open(track = "general-english", { ios = PLUGIN, cfg = { available: true, formats: ["interstitial", "native"], npa: true, consent: "can_request" }, grace = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: "dark" });
  await ctx.addInitScript(([s, f]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_ent_api", "http://ent.test");
    localStorage.setItem("be_flags", JSON.stringify(f)); window.BE_BUILD = { env: "staging" }; },
    [seed(track), { ads_enabled: true, billing_enabled: true }]);
  await ctx.addInitScript(ios, [cfg]);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  /* IS_IOS_APP makes entApiBase() ignore be_ent_api and use beEnv()'s staging
     host, exactly as the real staging bundle does — so the in-process
     entitlement Worker has to answer THAT host, not a test one. */
  await ctx.route(u => /ent\.test|be-entitlements-staging/.test(u.href), async r => {
    const q = r.request(), h = { ...q.headers() };
    const m = /^Bearer test-token-(.+)$/.exec(h.authorization || ""); if (m) { h["x-dev-user"] = m[1]; delete h.authorization; }
    const resp = await handle(new Request(q.url(), { method: q.method(), headers: h, body: ["GET", "HEAD"].includes(q.method()) ? undefined : q.postData() }), WENV, {});
    await r.fulfill({ status: resp.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await resp.text() });
  });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1600);
  await p.evaluate(g => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove());
    window.__ev = []; track = (n, pr) => window.__ev.push(n + ":" + ((pr && pr.format) || "") + ":" + ((pr && pr.context) || "") + ":" + ((pr && pr.reason) || ""));
    if (!g) AD_BOOT = Date.now() - 10 * 60e3; go("home"); }, grace);
  await sleep(1300);
  return { ctx, p, errs };
}
const signIn = (p, uid) => p.evaluate(u => { FBUser = { uid: u, getIdToken: async () => "test-token-" + u }; return entRefresh(); }, uid);
const grantPremium = async uid => { await handle(new Request("https://x/v1/admin/grant", { method: "POST", headers: { authorization: "Bearer " + "x".repeat(40), "content-type": "application/json" }, body: JSON.stringify({ uid: "dev:" + uid, plan: "premium", status: "active", expiresAt: Date.now() + 30 * 864e5, source: "promo" }) }), WENV, {}); };

/* the real lifecycle: the page really hid `ms` ago, then one foregrounding.
   `_hiddenAt` is set alongside it because a genuine hide writes both. */
const resume = async (p, ms = 60e3, times = 1) => {
  await p.evaluate(([m, n]) => { const t = Date.now() - m; _adHidAt = t; _hiddenAt = t;
    for (let i = 0; i < n; i++) document.dispatchEvent(new Event("visibilitychange")); }, [ms, times]);
  await sleep(1600);
};
const clearCaps = p => p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem(AD_LOG_KEY); _adResumeAt = 0; _adHidAt = 0; window.__ev = []; window.__ad.calls = []; });
const ev = p => p.evaluate(() => window.__ev.filter(e => /^ad_/.test(e)));
const calls = p => p.evaluate(() => window.__ad ? window.__ad.calls.slice() : []);
const shown = p => p.evaluate(() => window.__ad ? window.__ad.shown : -1);
const sawResume = async p => (await ev(p)).some(e => e.startsWith("ad_displayed:interstitial:app_resume"));
const suppressedFor = async (p, reason) => (await ev(p)).some(e => e.startsWith("ad_suppressed:interstitial:app_resume:" + reason));

console.log("\n# the resume is a natural break, through the proven native path");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "r1");
  ok("R1 · app_resume is in AD_POLICY, not a bypass around it", await p.evaluate(() => AD_POLICY.interstitial.contexts.includes("app_resume")));
  await clearCaps(p); await resume(p, 60e3);
  ok("R2 · General English Free, a real minute in the background → the interstitial is offered", await sawResume(p), JSON.stringify(await ev(p)));
  const c = await calls(p);
  ok("R3 · the NATIVE bridge received load:interstitial:app_resume then show:interstitial:app_resume",
    c.includes("load:interstitial:app_resume") && c.includes("show:interstitial:app_resume"), JSON.stringify(c));
  ok("R4 · analytics name the context app_resume, told apart from every completion break",
    (await ev(p)).every(e => !/session_complete|shadow_complete|lesson_complete|practice_complete/.test(e)) &&
    (await ev(p)).some(e => e.startsWith("ad_eligibility_checked:interstitial:app_resume")), JSON.stringify(await ev(p)));
  ok("R5 · the learner is left on the screen they returned to — the resume never navigates",
    await p.evaluate(() => cur.v === "home" && !document.getElementById("adOv")));
  ok("R6 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# who never gets one");
{
  /* grant BEFORE the first sign-in: entRefresh() returns its in-flight promise,
     so a grant made between two sign-ins is never re-fetched (that is a harness
     trap, not app behaviour). The control below proves the client really is
     Premium, so this can never pass by accident. */
  WENV = workerEnv(); await grantPremium("prem1");
  const { ctx, p, errs } = await open(); await signIn(p, "prem1");
  ok("R6b · (control) the client really is Premium before the test runs", await p.evaluate(() => entIsPremiumForDisplay() === true && AdEligibility.planAllowsAds() === false));
  await clearCaps(p); await resume(p, 60e3);
  ok("R7 · PREMIUM → no resume ad, refused as 'premium'", !(await sawResume(p)) && await suppressedFor(p, "premium"), JSON.stringify(await ev(p)));
  ok("R8 · and the SDK was never asked", !(await calls(p)).some(x => /^(load|show):/.test(x)), JSON.stringify(await calls(p)));
  ok("R9 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  WENV = workerEnv(); const { ctx, p, errs } = await open("welding"); await signIn(p, "w1");
  await clearCaps(p); await resume(p, 60e3);
  /* the tier spec (docs/TIERS.md, 5 Oct 2026): ads are General English only and
     Welding shows none on any plan — the resume path is refused for the
     programme before the SDK is asked, and leaves no ad event at all */
  ok("R10 · WELDING Free → NO resume ad: nothing displayed, the SDK never asked to show, and no ad event written (the programme refuses before any event)",
    !(await sawResume(p)) && !(await calls(p)).some(x => /^(load|show):/.test(x)) && (await ev(p)).length === 0 && await p.evaluate(() => adsTrackAllows() === false && AdEligibility.decide("interstitial", "app_resume").reason === "track"), JSON.stringify({ ev: await ev(p), calls: await calls(p) }));
  /* 10 Oct 2026: Welding Mastery's hub may show ads, so the bridge exists while that hub is on; otherwise never */
  ok("R11 · the bridge is built on Welding ONLY while Welding Mastery (whose hub may show ads) is on", await p.evaluate(() => (window.WMUI && WMUI.on()) || (_adsBridge !== true && !window.BENativeAds)), await p.evaluate(() => String(_adsBridge) + " hub:" + !!(window.WMUI && WMUI.on())));
  ok("R12 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  WENV = workerEnv(); await grantPremium("wprem");
  const { ctx, p, errs } = await open("welding"); await signIn(p, "wprem");
  ok("R12b · (control) Welding learner really is Premium", await p.evaluate(() => entIsPremiumForDisplay() === true));
  await clearCaps(p); await resume(p, 60e3);
  /* on Welding the programme rule comes before the plan: a Premium learner is
     refused for "track" too, so Welding shows no ads on ANY plan */
  ok("R13 · WELDING Premium → still nothing shown, and the reason is the programme ('track'), not the plan",
    !(await sawResume(p)) && !(await calls(p)).some(x => /^(load|show):/.test(x)) && (await ev(p)).length === 0 && await p.evaluate(() => AdEligibility.decide("interstitial", "app_resume").reason === "track"), JSON.stringify(await ev(p)));
  ok("R14 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# every frequency gate still refuses it");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open("general-english", { grace: true }); await signIn(p, "g1");
  await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem(AD_LOG_KEY); _adResumeAt = 0; _adHidAt = 0; window.__ev = []; });
  await resume(p, 60e3);
  ok("R15 · inside the first 2 minutes of a visit → cap:launch", !(await sawResume(p)) && await suppressedFor(p, "cap_launch"), JSON.stringify(await ev(p)));
  ok("R16 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "g2");
  await clearCaps(p); await resume(p, 60e3);
  ok("R17 · (control) the first return does show one", await sawResume(p));
  await p.evaluate(() => { window.__ev = []; _adResumeAt = 0; _adHidAt = 0; });
  await resume(p, 60e3);
  ok("R18 · a second return straight afterwards → cap:gap, the 8-minute interval is not waived",
    !(await sawResume(p)) && await suppressedFor(p, "cap_gap"), JSON.stringify(await ev(p)));
  /* the rolling hour */
  await p.evaluate(() => { const now = Date.now(), P = AD_POLICY.interstitial;
    localStorage.setItem(AD_LOG_KEY, JSON.stringify(Array.from({ length: P.maxPerWindow }, (_, i) => ({ f: "interstitial", t: now - (P.minGapMs + 60e3) * (i + 1) }))));
    AdEligibility._resetSession(); _adResumeAt = 0; _adHidAt = 0; window.__ev = []; });
  await resume(p, 60e3);
  ok("R19 · the hourly cap refuses it → cap:window", !(await sawResume(p)) && await suppressedFor(p, "cap_window"), JSON.stringify(await ev(p)));
  await p.evaluate(() => { localStorage.removeItem(AD_LOG_KEY); _adSession = { interstitial: AD_POLICY.interstitial.maxPerSession }; _adResumeAt = 0; _adHidAt = 0; window.__ev = []; });
  await resume(p, 60e3);
  ok("R20 · the visit cap refuses it → cap:session", !(await sawResume(p)) && await suppressedFor(p, "cap_session"), JSON.stringify(await ev(p)));
  ok("R21 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# protected learning, and the lifecycle itself");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "g3");
  await clearCaps(p);
  await p.evaluate(() => { rec.mr = { state: "recording" }; });
  await resume(p, 60e3);
  const whileRec = !(await sawResume(p)) && await suppressedFor(p, "protected_recording");
  await p.evaluate(() => { rec.mr = null; });
  ok("R22 · returning while a recording is live → no ad (protected:recording)", whileRec, JSON.stringify(await ev(p)));
  await clearCaps(p);
  await p.evaluate(() => { const d = document.createElement("div"); d.className = "cf-ov show"; d.id = "__ovTest"; document.body.appendChild(d); });
  await resume(p, 60e3);
  const whileDlg = !(await sawResume(p)) && await suppressedFor(p, "protected_dialog");
  await p.evaluate(() => { const d = document.getElementById("__ovTest"); if (d) d.remove(); });
  ok("R23 · returning into an open dialog (auth, purchase, confirm) → no ad (protected:dialog)", whileDlg, JSON.stringify(await ev(p)));
  await clearCaps(p); await resume(p, 60e3, 3);
  ok("R24 · three visibility callbacks for ONE foregrounding → exactly one attempt",
    (await ev(p)).filter(e => e.startsWith("ad_eligibility_checked:interstitial:app_resume")).length === 1, JSON.stringify(await ev(p)));
  await clearCaps(p);
  /* The real cold-launch shape, and the one that caught a bug in this feature:
     boot calls touchSeen(), so `_hiddenAt` is ALREADY an old timestamp while
     the app has never once been backgrounded. Only `_adHidAt` can tell them
     apart, so this check drives exactly that state. */
  await p.evaluate(() => { _hiddenAt = Date.now() - 10 * 60e3; _adHidAt = 0; document.dispatchEvent(new Event("visibilitychange")); }); await sleep(1400);
  ok("R25 · never backgrounded, but boot primed _hiddenAt ten minutes ago → still no attempt", (await ev(p)).length === 0, JSON.stringify(await ev(p)));
  await clearCaps(p); await resume(p, 5e3);
  ok("R26 · a transient hide — a permission sheet, the share sheet — is not a return", (await ev(p)).length === 0, JSON.stringify(await ev(p)));
  ok("R27 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# the provider may be absent, refused, or fail — never a trap");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open("general-english", { ios: NOPLUGIN }); await signIn(p, "g4");
  await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem(AD_LOG_KEY); _adResumeAt = 0; _adHidAt = 0; window.__ev = []; });
  await resume(p, 60e3);
  ok("R28 · no BEAds plugin at all → a safe no-op, reported as no_provider, learner untouched",
    !(await sawResume(p)) && (await ev(p)).some(e => e.startsWith("ad_suppressed:interstitial:app_resume:no_provider")) &&
    await p.evaluate(() => !document.getElementById("adOv") && cur.v === "home"), JSON.stringify(await ev(p)));
  ok("R29 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  WENV = workerEnv();
  const { ctx, p, errs } = await open("general-english", { cfg: { available: false, reason: "consent", formats: [], npa: true, consent: "consent" } });
  await signIn(p, "g5");
  await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem(AD_LOG_KEY); _adResumeAt = 0; _adHidAt = 0; window.__ev = []; window.__ad.calls = []; });
  await resume(p, 60e3);
  ok("R30 · UMP refused or unobtainable → no bridge, no ad, and the plugin is never asked to load or show",
    !(await sawResume(p)) && await p.evaluate(() => _adsBridge === false) && !(await calls(p)).some(x => /^(load|show):/.test(x)), JSON.stringify(await calls(p)));
  ok("R31 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "g6");
  await clearCaps(p);
  await p.evaluate(() => { window.__ad.fill = false; });
  await resume(p, 60e3);
  ok("R32 · the network has nothing to show → no_fill, no frame left on screen, the learner stays where they were",
    !(await sawResume(p)) && (await ev(p)).some(e => e.startsWith("ad_suppressed:interstitial:app_resume:no_fill")) &&
    await p.evaluate(() => !document.getElementById("adOv") && !document.querySelector(".ad-ov") && cur.v === "home"), JSON.stringify(await ev(p)));
  await clearCaps(p);
  await p.evaluate(() => { window.__ad.fill = true; window.__ad.showThrows = true;
    const P = window.Capacitor.Plugins.BEAds; const orig = P.show.bind(P);
    P.show = async a => { window.__ad.calls.push("show:" + a.format + ":" + (a.context || "")); throw new Error("boom"); }; void orig; });
  await resume(p, 60e3);
  ok("R33 · show() throwing never traps the learner: no stuck frame, still on their own screen",
    await p.evaluate(() => !document.getElementById("adOv") && !document.querySelector(".ad-ov") && cur.v === "home"));
  ok("R34 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log(`\n${res.filter(Boolean).length}/${res.length} passed   (${BASE})`);
await b.close(); srv.kill();
process.exit(res.every(Boolean) ? 0 : 1);
