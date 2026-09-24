/* Phase 7 — the client half of entitlements and ad eligibility.
   Run: cd tests && node entitlement-client.mjs

   The entitlement Worker's own security is tested in
   backend/entitlements/test/run.mjs. Here the app talks to a stand-in for it
   (Playwright answers http://ent.test/v1/entitlement with whatever the case
   needs), so these checks are about what the CLIENT does with an answer:
   display only, fail to Free, ignore anything a learner can edit, keep the
   track boundary, and never let an ad near a protected learning state. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = 8084, BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const b = await chromium.launch();
const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
const PREMIUM = { plan: "premium", paid: true, state: "active", ads: false, capabilities: { ad_free: true, ai_allowance: "enhanced", practice_allowance: "enhanced" }, expiresAt: Date.now() + 30 * 864e5, source: "promo", checkedAt: Date.now() };
const FREE = { plan: "free", paid: false, state: "none", ads: true, capabilities: { ad_free: false, ai_allowance: "standard", practice_allowance: "standard" }, expiresAt: null, source: null };

async function page(track = "general-english", { api = true, flags = null, vp = { width: 390, height: 844 } } = {}) {
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: "block", colorScheme: "light" });
  await ctx.addInitScript(([s, api, flags]) => { localStorage.setItem("be12_v1", s); if (api) localStorage.setItem("be_ent_api", "http://ent.test"); if (flags) localStorage.setItem("be_flags", JSON.stringify(flags)); }, [seed(track), api, flags]);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const reqs = []; let answer = { status: 200, body: FREE };
  await ctx.route("http://ent.test/**", async r => { reqs.push({ url: r.request().url(), method: r.request().method(), headers: r.request().headers(), body: r.request().postData() });
    if (answer.abort) return r.abort();
    await r.fulfill({ status: answer.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(answer.body) }); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1400);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p, reqs, errs, set: a => { answer = a; } };
}
const signIn = (p, uid = "u1") => p.evaluate(uid => { FBUser = { uid, getIdToken: async () => "test-token-" + uid }; }, uid);
const view = p => p.evaluate(() => ({ v: entView(), prem: entIsPremiumForDisplay() }));
/* App Setup renders on go("data"); wait for the plan section rather than assume it is there */
async function openPlan(p) { await p.evaluate(() => go("data")); await p.waitForSelector("details.set-plan", { state: "attached", timeout: 15000 }); await p.evaluate(() => { document.querySelector("details.set-plan").open = true; }); await sleep(300); }

console.log("\n# production defaults (nothing deployed)");
{
  const { ctx, p, reqs, errs } = await page("general-english", { api: false });
  await signIn(p); await p.evaluate(() => entRefresh());
  const v = await view(p);
  ok("1 · ENT_API is empty in the shipped build: every learner is Free and no entitlement request is made", v.v.plan === "free" && !v.prem && reqs.length === 0);
  const d = await p.evaluate(() => AdEligibility.decide("interstitial", "lesson_complete", { now: Date.now() + 10 * 60e3 }));
  ok("2 · ads_enabled is off by default: the policy refuses every ad (flag_off)", d.show === false && d.reason === "flag_off");
  ok("3 · no ad slot exists anywhere in the page", await p.evaluate(() => !document.querySelector("[data-ad-slot]")));
  ok("4 · dark by default is untouched (fresh page, device appearance Light)", await p.evaluate(() => document.documentElement.getAttribute("data-theme") === "dark"));
  ok("5 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# the server decides; the client only displays");
{
  const { ctx, p, reqs, set } = await page();
  let v = await view(p);
  ok("6 · signed out → Free, without asking the server", v.v.plan === "free" && reqs.length === 0);
  await signIn(p); set({ status: 200, body: FREE }); await p.evaluate(() => entRefresh());
  v = await view(p);
  ok("7 · signed in, server says free → Free", v.v.plan === "free" && !v.prem);
  const rq = reqs[reqs.length - 1];
  ok("8 · the request carries only the Firebase token: GET, no body, no query, no plan hint", rq.method === "GET" && !rq.body && !/\?/.test(rq.url) && rq.headers.authorization === "Bearer test-token-u1" && !Object.keys(rq.headers).some(h => /plan|premium/i.test(h)));
  set({ status: 200, body: PREMIUM }); await p.evaluate(() => entRefresh());
  v = await view(p);
  ok("9 · server says premium → Premium is displayed", v.v.plan === "premium" && v.prem && v.v.ads === false);
  await openPlan(p);
  const card = await p.evaluate(() => { const d = document.querySelector("details.set-plan"); return { sum: d.querySelector("summary").textContent, prem: !!d.querySelector(".ent-plan.on"), free: /Active — everything included/.test(d.textContent), active: /Active until/.test(d.textContent), price: /\$|€|£|per month|\/month|buy|subscribe/i.test(d.textContent) }; });
  ok("10 · App Setup shows Premium · Active until …, the Free card is gone, and there is no price or purchase button", /Premium/.test(card.sum) && card.prem && !card.free && card.active && !card.price, JSON.stringify(card));
  set({ status: 200, body: { ...FREE, state: "expired" } }); await p.evaluate(() => entRefresh());
  v = await view(p);
  ok("11 · the server later says expired → Free again", v.v.plan === "free" && !v.prem);
  set({ status: 200, body: { plan: "gold", paid: "yes", ads: "no", capabilities: { ad_free: 1 } } }); await p.evaluate(() => entRefresh());
  v = await view(p);
  ok("12 · an invalid answer (unknown plan, wrong types) is read as Free", v.v.plan === "free" && v.v.ads === true);
  set({ status: 200, body: PREMIUM }); await p.evaluate(() => entRefresh());
  set({ abort: true }); await p.evaluate(() => entRefresh());
  ok("13 · a network failure keeps the last server answer for display (no flicker to ads for a paying learner)", (await view(p)).prem);
  set({ status: 401, body: { error: "auth" } }); await p.evaluate(() => entRefresh());
  v = await view(p);
  ok("14 · a 401 drops the cached plan → Free", v.v.plan === "free" && await p.evaluate(() => !localStorage.getItem("be_ent_view")));
  await ctx.close();
}

console.log("\n# a learner cannot make the client believe in Premium");
{
  const { ctx, p, set } = await page();
  await signIn(p, "u1"); set({ status: 200, body: FREE });
  await p.evaluate(() => { localStorage.setItem("be_ent_view", JSON.stringify({ uid: "u1", at: Date.now(), view: { plan: "premium", paid: true, ads: false, capabilities: { ad_free: true } } })); localStorage.setItem("premium", "true"); localStorage.setItem("be_premium", "1"); S.premium = true; S.plan = "premium"; S.sub = { state: "PREMIUM" }; });
  await p.evaluate(() => entRefresh());
  ok("15 · an edited cache plus premium/S.plan/S.sub keys: the next server answer wins → Free", (await view(p)).v.plan === "free");
  await p.evaluate(e => { _entView = null; localStorage.setItem("be_ent_view", JSON.stringify({ uid: "someone-else", at: Date.now(), view: e })); }, PREMIUM);
  ok("16 · a cached plan that belongs to another account is ignored", (await view(p)).v.plan === "free");
  await p.evaluate(e => { _entView = null; localStorage.setItem("be_ent_view", JSON.stringify({ uid: "u1", at: Date.now(), view: { ...e, expiresAt: Date.now() - 1000 } })); }, PREMIUM);
  ok("17 · a cached plan past its own expiry is not displayed", (await view(p)).v.plan === "free");
  await p.evaluate(e => { _entView = null; localStorage.setItem("be_ent_view", JSON.stringify({ uid: "u1", at: Date.now() - 13 * 3600e3, view: e })); }, PREMIUM);
  ok("18 · a cached plan older than the 12 h display TTL is not displayed", (await view(p)).v.plan === "free");
  ok("19 · the entitlement cache is outside S, so it is never synced to the cloud", await p.evaluate(() => !JSON.stringify(fbSyncPayload(S)).includes("be_ent_view") && !("ent" in S)));
  set({ status: 200, body: PREMIUM }); await p.evaluate(() => entRefresh());
  await p.evaluate(() => fbWipeDevice());
  ok("20 · sign-out / account deletion wipe the cached plan", await p.evaluate(() => !localStorage.getItem("be_ent_view")));
  await ctx.close();
}

console.log("\n# ad eligibility — one policy, conservative, protected learning");
{
  const { ctx, p, set } = await page("general-english", { flags: { ads_enabled: true } });
  const T = await p.evaluate(() => AD_BOOT + 5 * 60e3);
  const d = (f, c, o = {}) => p.evaluate(([f, c, o]) => AdEligibility.decide(f, c, o), [f, c, o]);
  await p.evaluate(() => go("home"));
  let r = await d("interstitial", "lesson_complete", { now: await p.evaluate(() => AD_BOOT + 60e3) });
  ok("21 · no interstitial in the first minutes of a visit (launch grace)", r.reason === "cap:launch", JSON.stringify(r));
  r = await d("interstitial", "lesson_complete", { now: T });
  ok("22 · Free, ads flag on, a natural break, nothing protected → eligible", r.show === true, JSON.stringify(r));
  await p.evaluate(t => AdEligibility.record("interstitial", t), T);
  r = await d("interstitial", "lesson_complete", { now: T + 60e3 });
  ok("23 · immediately after an interstitial → refused (cap:gap)", r.reason === "cap:gap");
  r = await d("interstitial", "lesson_complete", { now: T + 16 * 60e3 });
  ok("24 · after the minimum gap → eligible again", r.show === true);
  await p.evaluate(t => AdEligibility.record("interstitial", t), T + 16 * 60e3);
  r = await d("interstitial", "lesson_complete", { now: T + 33 * 60e3 });
  ok("25 · a third within the rolling hour → refused (cap:window, max 2/h)", r.reason === "cap:window", JSON.stringify(r));
  await p.evaluate(t => AdEligibility.record("interstitial", t), T + 70 * 60e3);
  r = await d("interstitial", "lesson_complete", { now: T + 200 * 60e3 });
  ok("26 · the session cap holds (max 3 per session)", r.reason === "cap:session", JSON.stringify(r));
  await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem("be_ad_log"); });
  r = await d("interstitial", "home_feed", { now: T });
  ok("27 · an interstitial outside a natural break (home_feed) → refused (context)", r.reason === "context");
  r = await d("rewarded", "extra_practice", { now: T });
  ok("28 · a rewarded ad is never pushed: without userInitiated → refused", r.reason === "not_user_initiated");
  r = await d("rewarded", "extra_practice", { now: T, userInitiated: true });
  ok("29 · a rewarded ad the learner asked for → eligible", r.show === true);
  r = await d("popup", "lesson_complete", { now: T });
  ok("30 · an unknown format → refused", r.reason === "format");
  const prot = async (setup, undo, want) => { await p.evaluate(setup); const x = await d("interstitial", "lesson_complete", { now: T }); await p.evaluate(undo); return x.reason === "protected:" + want ? true : x.reason; };
  ok("31 · while recording → protected:recording", (await prot(() => { rec.mr = { state: "recording" }; }, () => { rec.mr = null; }, "recording")) === true);
  ok("32 · while any microphone stream is live (speaking / Shadow / AI voice / partner) → protected:microphone", (await prot(() => { window.__fs = { getAudioTracks: () => [{ readyState: "live" }] }; DS.voice._n.set(window.__fs, {}); }, () => { DS.voice._n.delete(window.__fs); }, "microphone")) === true);
  ok("33 · during a live human partner session → protected:live_partner", (await prot(() => { ppLive = { status: "connected" }; }, () => { ppLive = null; }, "live_partner")) === true);
  ok("34 · during an AI voice turn → protected:ai_voice", (await prot(() => { rpRec = { mr: {} }; }, () => { rpRec = null; }, "ai_voice")) === true);
  ok("35 · while pronunciation is being assessed (Polish busy) → protected:polish", (await prot(() => { ex.phase = "busy"; }, () => { ex.phase = "idle"; }, "polish")) === true);
  ok("36 · while a dialog is open → protected:dialog", (await prot(() => { const o = document.createElement("div"); o.className = "cf-ov show"; o.id = "__ov"; document.body.appendChild(o); }, () => document.getElementById("__ov").remove(), "dialog")) === true);
  ok("37 · a flow can hold ads off explicitly (Phase 8 hook) → protected:hold", (await prot(() => AdEligibility.protect("shadow-take"), () => AdEligibility.release("shadow-take"), "hold:shadow-take")) === true);
  for (const [v, js] of [["session", "go('session',1,'Mon')"], ["shadow", "go('shadow')"], ["roleplay", "go('roleplay')"]]) {
    await p.evaluate(js); await sleep(300);
    const x = await d("interstitial", "lesson_complete", { now: T });
    ok(`38 · on the ${v} screen itself → protected:view:${v}`, x.reason === "protected:view:" + v, JSON.stringify(x));
  }
  await p.evaluate(() => go("home"));
  await signIn(p); set({ status: 200, body: PREMIUM }); await p.evaluate(() => entRefresh());
  r = await d("interstitial", "lesson_complete", { now: T });
  const r2 = await d("native", "home_feed", { now: T }), r3 = await d("rewarded", "extra_practice", { now: T, userInitiated: true });
  ok("39 · Premium (server-confirmed) → every format refused (premium), even with the ads flag on", [r, r2, r3].every(x => x.show === false && x.reason === "premium"), JSON.stringify([r, r2, r3]));
  await ctx.close();
}

console.log("\n# track isolation");
{
  const { ctx, p, set } = await page("welding");
  await signIn(p); set({ status: 200, body: PREMIUM }); await p.evaluate(() => entRefresh());
  const w = await p.evaluate(() => ({ prem: entIsPremiumForDisplay(), ge: isGeneralEnglish(), pp: ppAvailable(), sv: typeof svOn === "function" ? svOn() : null }));
  ok("40 · Welding + Premium: Premium applies, but General-English-only features stay off (Practice Partner, Shadow V2)", w.prem && !w.ge && !w.pp && w.sv === false, JSON.stringify(w));
  await p.evaluate(() => areaSwitch("general-english", "home")); await sleep(300);
  const g = await p.evaluate(() => ({ prem: entIsPremiumForDisplay(), pp: ppAvailable() }));
  ok("41 · the same account in General English: same plan, Practice Partner as before", g.prem && g.pp === true, JSON.stringify(g));
  await ctx.close();
}

console.log("\n# mobile layout");
{
  for (const [theme, vp] of [["dark", { width: 375, height: 812 }], ["light", { width: 390, height: 844 }]]) {
    const { ctx, p, set } = await page("general-english", { vp });
    if (theme === "light") await p.evaluate(() => setTheme("light"));
    await signIn(p); set({ status: 200, body: PREMIUM }); await p.evaluate(() => entRefresh());
    await openPlan(p);
    const m = await p.evaluate(() => { const c = document.querySelector(".ent-plan"), r = c.getBoundingClientRect(); return { w: Math.round(r.width), fits: r.right <= innerWidth + 0.5 && r.left >= -0.5, overflow: document.documentElement.scrollWidth > innerWidth + 1, border: getComputedStyle(c).borderTopColor }; });
    ok(`42 · ${theme} ${vp.width}px: the Premium card fits, no horizontal overflow${theme === "light" ? ", border from the light dark-blue token" : ""}`, m.fits && !m.overflow && (theme !== "light" || /30, 45, 120/.test(m.border)), JSON.stringify(m));
    await ctx.close();
  }
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
