/* Phase 8 — the advertising system, in a real browser on a phone viewport.
   Run: cd tests && node ads.mjs

   Ads are ON here only because the test turns them on (be_flags ads_enabled +
   ads_mock_provider, honoured on localhost): production ships them off with no
   provider. The mock draws a labelled TEST creative; nothing here is a real ad.

   Rewarded ads run end to end against the REAL entitlement Worker: requests
   the app makes to http://ent.test are answered by backend/entitlements'
   own handle() over a real SQLite database (node:sqlite), so start → network
   verification → single-use claim is the production code path. Identity uses
   the Worker's DEV_AUTH header (token verification is tested in that Worker's
   suite). */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite"; import { readFileSync, readdirSync } from "node:fs";
import { handle } from "../backend/entitlements/entitlements-worker.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = 8087, BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const b = await chromium.launch();

/* ---- the real entitlement Worker, in process */
function d1() {
  const db = new DatabaseSync(":memory:");
  for (const m of readdirSync(new URL("../backend/entitlements/migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).sort()) db.exec(readFileSync(new URL("../backend/entitlements/migrations/" + m, import.meta.url), "utf8"));
  return { prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; } };
}
let WENV = null;
const workerEnv = (o = {}) => ({ DB: d1(), FIREBASE_PROJECT_ID: "be-mastery", DEV_AUTH: "1", MOCK_REWARDS: "1", ADMIN_TOKEN: "x".repeat(40), ...o });

const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
async function open(track = "general-english", { flags = { ads_enabled: true, ads_mock_provider: true }, vp = { width: 390, height: 844 }, theme = null } = {}) {
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: "block", colorScheme: "light" });
  await ctx.addInitScript(([s, f, th]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_ent_api", "http://ent.test"); if (f) localStorage.setItem("be_flags", JSON.stringify(f)); if (th) localStorage.setItem("be_theme", th); }, [seed(track), flags, theme]);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  /* the app's entitlement / reward requests → the real Worker */
  await ctx.route("http://ent.test/**", async r => {
    const q = r.request(), h = { ...q.headers() };
    const m = /^Bearer test-token-(.+)$/.exec(h.authorization || ""); if (m) { h["x-dev-user"] = m[1]; delete h.authorization; }
    const resp = await handle(new Request(q.url(), { method: q.method(), headers: h, body: ["GET", "HEAD"].includes(q.method()) ? undefined : q.postData() }), WENV, {});
    await r.fulfill({ status: resp.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await resp.text() });
  });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1400);
  await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove());
    window.__ev = []; track = (n, pr) => { window.__ev.push([n, pr || {}]); };
    AD_BOOT = Date.now() - 10 * 60e3; });   /* past the quiet start of a visit */
  return { ctx, p, errs };
}
const signIn = (p, uid) => p.evaluate(uid => { FBUser = { uid, getIdToken: async () => "test-token-" + uid }; return entRefresh(); }, uid);
const grantPremium = async (uid, days = 30) => { await handle(new Request("https://x/v1/admin/grant", { method: "POST", headers: { authorization: "Bearer " + "x".repeat(40), "content-type": "application/json" }, body: JSON.stringify({ uid: "dev:" + uid, plan: "premium", status: "active", expiresAt: Date.now() + days * 864e5, source: "promo" }) }), WENV, {}); };
/* a finished activity, then the learner moves on to `to` */
const breakThen = async (p, ctx = "session_complete", to = "go('journey')") => { await p.evaluate(([c, t]) => { AdManager.markBreak(c); eval(t); }, [ctx, to]); await sleep(1300); };
const overlay = p => p.evaluate(() => { const o = document.getElementById("adOv"); if (!o) return null; const c = o.querySelector(".ad-card").getBoundingClientRect();
  return { label: o.querySelector(".ad-label").textContent, x: !o.querySelector(".ad-x").hidden, cont: !o.querySelector(".ad-continue").hidden, creative: o.querySelector(".ad-creative").textContent, card: { w: c.width, h: c.height, top: c.top, bottom: c.bottom, left: c.left, right: c.right }, vw: innerWidth, vh: innerHeight, view: cur.v, behind: getComputedStyle(document.getElementById("v-" + cur.v)).display !== "none", bg: getComputedStyle(o).backgroundColor, role: o.getAttribute("role") }; });
const closeAd = async p => { await p.waitForSelector("#adOv .ad-continue:not([hidden])", { timeout: 9000 }); await p.click("#adOv .ad-continue"); await sleep(200); };
const events = p => p.evaluate(() => window.__ev.map(([n, pr]) => n + ":" + (pr.format || "") + ":" + (pr.context || "") + ":" + (pr.reason || "")));

console.log("\n# interstitial — natural breaks, Free vs Premium");
{
  WENV = workerEnv();
  const { ctx, p, errs } = await open();
  await signIn(p, "free1");
  await breakThen(p, "session_complete", "go('journey')");
  let o = await overlay(p);
  ok("I1 · Free: a finished session, then the road map → a full-screen interstitial over the road map", o && o.view === "journey" && o.behind && o.role === "dialog", JSON.stringify(o));
  ok("I2 · clearly identified: the card says Advertisement and the creative is the provider's (labelled TEST mock)", o && o.label === "Advertisement" && /TEST/.test(o.creative));
  ok("I3 · the app stays visible behind a dimmed backdrop (not replaced)", o && /rgba\(3, 5, 12, 0\.72\)/.test(o.bg) && o.behind);
  ok("I4 · the close control is not offered for the first seconds…", o && !o.x && !o.cont);
  await closeAd(p);
  o = await overlay(p);
  ok("I5 · …then Continue returns the learner to the page they chose (road map), no dead end", !o && await p.evaluate(() => cur.v === "journey"));
  const ev = await events(p);
  ok("I6 · analytics: checked → requested → loaded → displayed → dismissed, with format + context, nothing personal",
    ["ad_eligibility_checked:interstitial:session_complete:", "ad_requested:interstitial:session_complete:", "ad_loaded:interstitial:session_complete:", "ad_displayed:interstitial:session_complete:", "ad_dismissed:interstitial:session_complete:"].every(x => ev.includes(x))
    && await p.evaluate(() => window.__ev.every(([, pr]) => Object.keys(pr).every(k => ["format", "context", "reason", "provider", "result"].includes(k)))), ev.join(" | "));
  await breakThen(p, "shadow_complete", "go('home')");
  ok("I7 · immediately after an ad, another break is refused by the frequency cap (cap:gap)", !(await overlay(p)) && (await events(p)).some(x => x.startsWith("ad_suppressed:interstitial:shadow_complete:cap_gap")));
  await p.evaluate(() => { localStorage.removeItem("be_ad_log"); _adSession = { interstitial: AD_POLICY.interstitial.maxPerSession }; });
  await breakThen(p, "practice_complete", "go('home')");
  ok("I8 · the session cap holds (cap:session)", !(await overlay(p)) && (await events(p)).some(x => /ad_suppressed:interstitial:practice_complete:cap_session/.test(x)));
  await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem("be_ad_log"); AD_BOOT = Date.now(); });
  await breakThen(p, "practice_complete", "go('home')");
  ok("I9 · not in the first minutes of a visit (cap:launch)", !(await overlay(p)) && (await events(p)).some(x => /cap_launch/.test(x)));
  await p.evaluate(() => { AD_BOOT = Date.now() - 10 * 60e3; });
  await p.evaluate(() => AdManager.markBreak("mid_lesson_whatever")); await p.evaluate(() => go("home")); await sleep(1200);
  ok("I10 · a context that is not a natural break is ignored (no ad)", !(await overlay(p)));
  ok("I11 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# interstitial — never during learning");
{
  WENV = workerEnv();
  const { ctx, p } = await open();
  await signIn(p, "free2");
  const suppressed = async (setup, undo, label) => {
    await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem("be_ad_log"); window.__ev = []; });
    await p.evaluate(setup);
    await breakThen(p, "practice_complete", "go('home')");
    const none = !(await overlay(p));
    await p.evaluate(undo);
    /* proof it was the protected state: the same break shows once it is over */
    await p.evaluate(() => go("home")); await sleep(1300);
    const after = await overlay(p); if (after) await closeAd(p);
    return none && !!after;
  };
  ok("P1 · while recording → no ad (and the break is held, then shown once it is over)", await suppressed(() => { rec.mr = { state: "recording" }; }, () => { rec.mr = null; }));
  ok("P2 · while a microphone stream is live (speaking / Shadow take / AI voice) → no ad", await suppressed(() => { window.__fs = { getAudioTracks: () => [{ readyState: "live" }] }; DS.voice._n.set(window.__fs, {}); }, () => { DS.voice._n.delete(window.__fs); }));
  ok("P3 · while the app is speaking (speech synthesis) → no ad", await suppressed(() => { window.__ss = Object.getOwnPropertyDescriptor(SpeechSynthesis.prototype, "speaking"); Object.defineProperty(speechSynthesis, "speaking", { configurable: true, get: () => true }); }, () => { delete speechSynthesis.speaking; }));
  ok("P4 · during a live human Partner session → no ad", await suppressed(() => { ppLive = { status: "connected" }; }, () => { ppLive = null; }));
  ok("P5 · during an AI voice turn → no ad", await suppressed(() => { rpRec = { mr: {} }; }, () => { rpRec = null; }));
  ok("P6 · while waiting for an AI reply → no ad", await suppressed(() => { rpConv = { busy: true }; }, () => { rpConv = null; }));
  ok("P7 · during pronunciation / Polish assessment → no ad", await suppressed(() => { ex.phase = "busy"; }, () => { ex.phase = "idle"; }));
  ok("P8 · inside the Shadow workspace (recording, player) → no ad", await suppressed(() => { document.body.classList.add("sh-work-open"); }, () => { document.body.classList.remove("sh-work-open"); }));
  /* a break is not lost by a protected destination: it waits for the next safe page */
  await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem("be_ad_log"); });
  await breakThen(p, "session_complete", "go('session',1,'Tue')");
  const inSession = !(await overlay(p));
  await p.evaluate(() => go("journey")); await sleep(1300);
  const later = await overlay(p);
  ok("P9 · moving straight into the next lesson: no ad in the middle of it; it waits for the next browsing page", inSession && later && later.view === "journey");
  if (later) await closeAd(p);
  await ctx.close();
}

console.log("\n# Premium, expired, invalid — the server decides");
{
  WENV = workerEnv();
  await grantPremium("prem1");
  const { ctx, p } = await open();
  await signIn(p, "prem1");
  ok("E1 · the server says premium (real Worker) → displayed as Premium", await p.evaluate(() => entIsPremiumForDisplay()));
  await breakThen(p, "session_complete", "go('journey')");
  await p.evaluate(() => go("home")); await sleep(600);
  ok("E2 · Premium: no interstitial, no native slot anywhere", !(await overlay(p)) && await p.evaluate(() => !document.querySelector("[data-ad-slot]")) && (await events(p)).some(x => /ad_suppressed:interstitial:session_complete:premium/.test(x)));
  const rw = await p.evaluate(() => AdManager.rewarded("extra_ai_practice", "extra_ai", { userInitiated: true }));
  ok("E3 · Premium: no rewarded prompt either", rw.rewarded === false && rw.reason === "premium", JSON.stringify(rw));
  await p.evaluate(() => { localStorage.setItem("be_ent_view", JSON.stringify({ uid: "free-x", at: Date.now(), view: { plan: "premium", paid: true, ads: false } })); });
  await ctx.close();
  /* expired premium */
  WENV = workerEnv();
  await grantPremium("old1", -1);
  const b2 = await open(); await signIn(b2.p, "old1");
  await breakThen(b2.p, "session_complete", "go('journey')");
  ok("E4 · expired Premium → Free behaviour (the interstitial shows)", !!(await overlay(b2.p)) && await b2.p.evaluate(() => !entIsPremiumForDisplay()));
  await b2.ctx.close();
  /* a learner edits the cache to claim Premium: the server's answer replaces it */
  WENV = workerEnv();
  const b3 = await open();
  await b3.p.evaluate(() => localStorage.setItem("be_ent_view", JSON.stringify({ uid: "dev:hack1", at: Date.now(), view: { plan: "premium", paid: true, ads: false, capabilities: { ad_free: true } } })));
  await signIn(b3.p, "hack1");
  await breakThen(b3.p, "session_complete", "go('journey')");
  ok("E5 · a hand-edited 'premium' cache does not survive the server's answer → ads as Free", !!(await overlay(b3.p)) && await b3.p.evaluate(() => !entIsPremiumForDisplay()));
  await b3.ctx.close();
  /* the server answers garbage */
  const b4 = await open();
  await b4.ctx.route("http://ent.test/v1/entitlement", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ plan: "gold", paid: "yes", ads: "no" }) }));
  await signIn(b4.p, "weird1");
  ok("E6 · an invalid entitlement answer is safe: treated as Free", await b4.p.evaluate(() => entView().plan === "free" && AdEligibility.planAllowsAds()));
  await b4.ctx.close();
}

console.log("\n# native / banner");
{
  WENV = workerEnv();
  const { ctx, p } = await open();
  const fresh = () => p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem("be_ad_log"); _adNative = {}; document.querySelectorAll("[data-ad-slot]").forEach(e => e.remove()); });
  await fresh(); await p.evaluate(() => go("home")); await sleep(900);
  const n = await p.evaluate(() => { const s = document.querySelector("#v-home [data-ad-slot]"); if (!s) return null; const v = document.getElementById("v-home"); return { last: v.lastElementChild === s, label: s.querySelector(".ad-label").textContent, filled: /TEST/.test(s.textContent), dashed: getComputedStyle(s).borderTopStyle, place: s.dataset.placement }; });
  ok("N1 · Free: one native slot at the FOOT of Home, labelled Advertisement, filled by the provider, dashed so it cannot pass for a lesson card", n && n.last && n.label === "Advertisement" && n.filled && n.dashed === "dashed" && n.place === "home_feed", JSON.stringify(n));
  const imp0 = (await events(p)).filter(x => x.startsWith("ad_displayed:native")).length;
  await p.evaluate(() => go("home")); await sleep(900);
  ok("N2 · re-rendering the page keeps the SAME ad — one slot, no second impression", await p.evaluate(() => document.querySelectorAll("#v-home [data-ad-slot]").length === 1) && (await events(p)).filter(x => x.startsWith("ad_displayed:native")).length === imp0);
  await p.evaluate(() => go("review")); await sleep(900);
  /* The 60 s native gap is counted PER PLACEMENT since 3 Oct 2026 (29409303:
     "the gap exists to stop the SAME surface repeating an ad at a learner" —
     the library ad used to block the Shadow one). Progress is its own
     placement (progress_foot), so right after Home's ad it still carries one
     ad; what the gap forbids is Home repeating ITS ad within the minute. */
  const pf = await p.evaluate(() => ({ review: document.querySelectorAll("#v-review [data-ad-slot]").length, home: document.querySelectorAll("#v-home [data-ad-slot]").length, gap: AdEligibility.decide("native", "home_feed").reason }));
  ok("N2b · the native gap is per placement: Progress right after Home's ad gets its own one ad, while Home itself is held by the 60 s gap (cap:gap)", pf.review === 1 && pf.home === 1 && pf.gap === "cap:gap", JSON.stringify(pf));
  for (const [v, js] of [["session", "go('session',1,'Mon')"], ["phrases", "go('phrases')"], ["roleplay", "go('roleplay')"], ["partner", "go('partner')"]]) { await p.evaluate(js); await sleep(700); }
  ok("N3 · never on a learning screen: session, Phrase Lab (Polish recorder), roleplay, partner carry no ad", await p.evaluate(() => !document.querySelector("#v-session [data-ad-slot],#v-phrases [data-ad-slot],#v-roleplay [data-ad-slot],#v-partner [data-ad-slot],#v-journey [data-ad-slot]")));
  await fresh(); await p.evaluate(() => go("review")); await sleep(900);
  const pr = await p.evaluate(() => { const s = document.querySelector("#v-review [data-ad-slot]"); if (!s) return null; const r = s.getBoundingClientRect(); const btns = [...document.querySelectorAll("#v-review button, .bnav button, .bnav a")].filter(bn => { const q = bn.getBoundingClientRect(); return q.width && !(q.bottom <= r.top || q.top >= r.bottom || q.right <= r.left || q.left >= r.right); }); return { overlap: btns.length, overflow: document.documentElement.scrollWidth > innerWidth + 1 }; });
  ok("N4 · Progress: the slot overlaps no control and adds no horizontal overflow", pr && pr.overlap === 0 && !pr.overflow, JSON.stringify(pr));
  await fresh(); await p.evaluate(() => { go("shadow"); }); await sleep(900);
  ok("N5 · the Shadow LIBRARY (browsing) may carry one", await p.evaluate(() => !!document.querySelector("#v-shadow [data-ad-slot]")));
  /* the slot the owner asked for: between the featured video and the list */
  await fresh(); await p.evaluate(() => go("shadow")); await sleep(1500);
  const lib = await p.evaluate(() => {
    const host = document.getElementById("shLibAdHost"), s = host && host.querySelector("[data-ad-slot]");
    if (!s) return { host: !!host, slot: false };
    const feed = document.getElementById("shLibFeed"), stat = document.getElementById("shLibStatic");
    const r = s.getBoundingClientRect();
    const btns = [...document.querySelectorAll("#v-shadow button, .bnav button")].filter(b => b.getBoundingClientRect().width > 0);
    const hit = b => { const q = b.getBoundingClientRect(); return !(q.right < r.left || q.left > r.right || q.bottom < r.top || q.top > r.bottom); };
    return { host: true, slot: true, place: s.dataset.placement, label: (s.querySelector(".ad-label") || {}).textContent,
      filled: /TEST/.test(s.innerText), dashed: getComputedStyle(s).borderTopStyle,
      afterStatic: !!stat && host.previousElementSibling === stat, beforeFeed: !!feed && host.nextElementSibling === feed,
      overlap: btns.filter(hit).length, overflow: document.documentElement.scrollWidth > innerWidth + 1,
      both: document.querySelectorAll("#v-shadow [data-ad-slot]").length };
  });
  /* no dashed border here, unlike the foot cards: the strip is edge to edge
     and a border across the screen would read as a divider (see N5g) */
  ok("N5b · the Shadow library carries a second labelled slot between the featured video and the list, overlapping no control", lib.slot && lib.place === "library_top" && lib.label === "Advertisement" && lib.filled && lib.dashed === "none" && lib.afterStatic && lib.beforeFeed && lib.overlap === 0 && !lib.overflow, JSON.stringify(lib));
  ok("N5c · it is a SECOND slot: the foot one is still there, so the page carries both", lib.both === 2, JSON.stringify({ both: lib.both }));
  /* a SHORT strip, not a block that pushes the list off the screen (owner, 5 Oct 2026) */
  const sz = await p.evaluate(() => {
    const top = document.querySelector('[data-ad-slot][data-placement="library_top"]'), foot = document.querySelector('[data-ad-slot][data-placement="library"]');
    const h = e => e ? Math.round(e.getBoundingClientRect().height) : null;
    const r = top && top.getBoundingClientRect();
    const rem = top && top.querySelector(".ad-remove");
    return { top: h(top), foot: h(foot), vh: innerHeight, reserved: adNativeH("library_top"), reservedFoot: adNativeH("home_feed"),
      left: r && Math.round(r.left), width: r && Math.round(r.width), vw: innerWidth,
      label: !!(top && top.querySelector(".ad-label")), removeShown: !!(rem && getComputedStyle(rem).display !== "none"),
      rows: top ? top.querySelectorAll(".ad-native-body").length : 0 };
  });
  ok("N5f · the in-content slot is a short strip: well under a quarter of the screen, and shorter than the foot slot's reservation", sz.top !== null && sz.top < sz.vh / 4 && sz.reserved < sz.reservedFoot, JSON.stringify(sz));
  /* the shape the owner photographed: one row, the full width of the screen,
     the label in a corner chip rather than on a line of its own, and no
     Premium link stealing a second row (it stays on the foot slots) */
  ok("N5g · and it is the shape asked for: edge to edge, one row about 68 px, a corner label, no second row",
    sz.left === 0 && sz.width >= sz.vw - 1 && sz.top <= 76 && sz.label === true && sz.removeShown === false, JSON.stringify(sz));
  /* searching: an ad above somebody's search results is not "between the video and the list" */
  const searched = await p.evaluate(async () => { _shLibQ = "weld"; shLibMount(); await new Promise(z => setTimeout(z, 900));
    const h = document.getElementById("shLibAdHost"); return { hidden: !h || h.hidden, slot: !!(h && h.querySelector("[data-ad-slot]")) }; });
  ok("N5d · while searching the host is hidden and nothing is placed there", searched.hidden && !searched.slot, JSON.stringify(searched));
  await p.evaluate(() => { _shLibQ = ""; shLibMount(); });
  /* App Setup's foot slot: declared in AD_POLICY from the start, never wired until now */
  await fresh(); await p.evaluate(() => go("data")); await sleep(900);
  const setf = await p.evaluate(() => { const s = document.querySelector("#v-data [data-ad-slot]"); return s ? { place: s.dataset.placement, last: document.getElementById("v-data").lastElementChild === s } : null; });
  ok("N5e · App Setup carries the settings_foot slot that the policy always declared", !!setf && setf.place === "settings_foot" && setf.last, JSON.stringify(setf));
  await grantPremium("up1"); await signIn(p, "up1");
  ok("N6 · the moment the server says Premium, every slot already on screen is withdrawn", await p.evaluate(() => !document.querySelector("[data-ad-slot]")));
  await ctx.close();
}

console.log("\n# Premium offer beside an ad");
{
  WENV = workerEnv();
  let { ctx, p } = await open();
  await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem("be_ad_log"); _adNative = {}; go("home"); }); await sleep(900);
  ok("NP1 · billing off (production today): the native slot carries no Premium link", await p.evaluate(() => { const s = document.querySelector("#v-home [data-ad-slot]"); return !!s && !s.querySelector(".ad-remove"); }));
  await ctx.close();
  ({ ctx, p } = await open("general-english", { flags: { ads_enabled: true, ads_mock_provider: true, billing_enabled: true } }));
  await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem("be_ad_log"); _adNative = {}; go("home"); }); await sleep(900);
  const r = await p.evaluate(() => { const s = document.querySelector("#v-home [data-ad-slot]"); const b = s && s.querySelector(".ad-remove"); if (!b) return null; const h = b.getBoundingClientRect().height; b.click(); return { text: b.textContent, h, sheet: !!document.getElementById("premOv"), from: (document.getElementById("premOv") || {}).dataset?.from }; });
  ok("NP2 · billing live: the slot offers 'Remove ads with Premium' (44 px tall), and it opens the Premium sheet", r && r.text === "Remove ads with Premium" && r.h >= 32 && r.sheet && r.from === "ad_native", JSON.stringify(r));
  await ctx.close();
}

console.log("\n# rewarded — opt-in, server-verified, single use");
{
  WENV = workerEnv();
  const { ctx, p } = await open();
  await signIn(p, "rw1");
  let r = await p.evaluate(() => AdManager.rewarded("extra_ai_practice", "extra_ai"));
  ok("W1 · never automatic: without an explicit user action nothing starts", r.rewarded === false && r.reason === "not_user_initiated" && !(await events(p)).some(x => x.startsWith("rewarded_ad_started")));
  r = await p.evaluate(() => AdManager.rewarded("extra_ai_practice", "extra_ai", { userInitiated: true }));
  ok("W2 · every reward kind ships disabled on the server → no reward (403 kind_off)", r.rewarded === false && /start_403/.test(r.reason), JSON.stringify(r));
  WENV = workerEnv({ REWARD_KINDS_ENABLED: "extra_ai_practice" });
  await signIn(p, "rw1");
  r = await p.evaluate(() => AdManager.rewarded("extra_ai_practice", "extra_ai", { userInitiated: true, cancel: true }));
  ok("W3 · a cancelled / failed ad produces no reward", r.rewarded === false && r.reason === "not_completed", JSON.stringify(r));
  r = await p.evaluate(() => AdManager.rewarded("extra_ai_practice", "extra_ai", { userInitiated: true }));
  ok("W4 · a completed ad, verified server to server, produces exactly one reward", r.rewarded === true && r.balances.extra_ai_practice === 1, JSON.stringify(r));
  const ev = await events(p);
  ok("W5 · analytics: rewarded_ad_started then rewarded_ad_completed", ev.some(x => x.startsWith("rewarded_ad_started:rewarded:extra_ai")) && ev.some(x => x.startsWith("rewarded_ad_completed:rewarded:extra_ai")));
  const replay = await p.evaluate(async () => {
    const h = { "content-type": "application/json", authorization: "Bearer test-token-rw1" };
    const s = await (await fetch("http://ent.test/v1/rewards/start", { method: "POST", headers: h, body: JSON.stringify({ kind: "extra_ai_practice" }) })).json();
    await fetch("http://ent.test/v1/rewards/verify/mock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nonce: s.nonce, txn: "replay-" + s.nonce.slice(0, 10) }) });
    const out = [];
    for (let i = 0; i < 4; i++) out.push(await (await fetch("http://ent.test/v1/rewards/claim", { method: "POST", headers: h, body: JSON.stringify({ nonce: s.nonce }) })).json());
    return out;
  });
  ok("W6 · the same completion claimed four times → one credit (duplicate callbacks cannot mint rewards)", replay.filter(x => x.credited).length === 1 && replay[3].balances.extra_ai_practice === 2, JSON.stringify(replay.map(x => x.credited)));
  const forged = await p.evaluate(async () => { const h = { "content-type": "application/json", authorization: "Bearer test-token-rw1" };
    const s = await (await fetch("http://ent.test/v1/rewards/start", { method: "POST", headers: h, body: JSON.stringify({ kind: "extra_ai_practice" }) })).json();
    return (await fetch("http://ent.test/v1/rewards/claim", { method: "POST", headers: h, body: JSON.stringify({ nonce: s.nonce, completed: true, verified: true }) })).status; });
  ok("W7 · a client that claims 'completed' without the network's verification gets nothing (409)", forged === 409);
  ok("W8 · no screen offers a rewarded ad yet (no metered allowance exists to extend)", await p.evaluate(() => !document.querySelector("[data-rewarded],[onclick*='AdManager.rewarded']")));
  await ctx.close();
}

console.log("\n# track isolation");
{
  WENV = workerEnv();
  const { ctx, p } = await open("welding");
  await signIn(p, "weld1");
  /* Welding's video Shadow Studio comes from the Welding studio (production ON since be12-v654,
     owner 8 Oct 2026), never from the ad system: Shadow V2 follows weldStudioOn() exactly */
  const w = await p.evaluate(() => ({ ge: isGeneralEnglish(), pp: ppAvailable(), sv: typeof svOn === "function" ? svOn() : null, studio: typeof weldStudioOn === "function" ? weldStudioOn() : null }));
  ok("T1 · Welding: the shared ad system adds no General-English feature (no Practice Partner; Shadow V2 only through the Welding studio)", !w.ge && !w.pp && w.sv === w.studio, JSON.stringify(w));
  await breakThen(p, "practice_complete", "go('home')");
  const o = await overlay(p);
  /* The tier spec (docs/TIERS.md, 5 Oct 2026): ads are General English only
     and Welding shows none on any plan — adsTrackAllows() is isGeneralEnglish()
     again. The workshop debrief's markBreak("practice_complete") therefore arms
     nothing on Welding, and no ad event of any kind is written. */
  ok("T2 · Welding: a finished workshop produces NO interstitial — Welding shows no ads on any plan, and leaves no ad event", o === null && !(await events(p)).some(x => /^ad_/.test(x)), JSON.stringify({ o: o && o.view, ev: (await events(p)).filter(x => /^ad_/.test(x)) }));
  if (o) await closeAd(p);
  await p.evaluate(() => go("practice")); await sleep(600);
  ok("T3 · Welding's Practice page shows the Welding simulation entry, no partner card", await p.evaluate(() => !document.querySelector("#v-practice .pp-entry")));
  await ctx.close();
}

/* ADS ARE GENERAL ENGLISH ONLY (the owner's tier spec, docs/TIERS.md, 5 Oct
   2026): "Ads (General English only) · Ads on Welding: None". adsTrackAllows()
   is isGeneralEnglish() again, so a Welding learner — Free OR Premium — is
   refused at the eligibility layer with reason "track", before the plan is even
   asked; no break is armed, no slot is placed, no ad event is written, and the
   "Remove ads with Premium" button has no slot to sit on. General English Free
   is unchanged, and the plan is still what takes ads away THERE. */
console.log("\n# Welding shows no ads on any plan; General English Free is unchanged");
{
  WENV = workerEnv();
  const { ctx, p } = await open("welding");
  await signIn(p, "weldfree");
  await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem("be_ad_log"); window.__ev = []; });
  const d = await p.evaluate(() => ({
    track: AdEligibility.trackAllowsAds(),
    flag: flag("ads_enabled"),
    plan: AdEligibility.planAllowsAds(),
    inter: AdEligibility.decide("interstitial", "session_complete"),
    nat: AdEligibility.decide("native", "home_feed"),
    rew: AdEligibility.decide("rewarded", "extra_practice", { userInitiated: true }),
    spon: AdEligibility.decide("sponsored", "tip_card"),
  }));
  ok("TW1 · a free Welding learner: the flag is on and the plan would allow ads, but the PROGRAMME refuses (adsTrackAllows false)", d.flag === true && d.plan === true && d.track === false, JSON.stringify(d));
  ok("TW2 · Welding: an interstitial is refused for 'track'", d.inter.show === false && d.inter.reason === "track", JSON.stringify(d.inter));
  ok("TW3 · Welding: a native slot is refused for 'track'", d.nat.show === false && d.nat.reason === "track", JSON.stringify(d.nat));
  ok("TW4 · Welding: a rewarded ad the learner asked for is refused for 'track'", d.rew.show === false && d.rew.reason === "track", JSON.stringify(d.rew));
  ok("TW5 · Welding: sponsored is refused for 'track' too — every format, one rule", d.spon.show === false && d.spon.reason === "track", JSON.stringify(d.spon));

  /* markBreak must not even ARM a break: an armed one would be waiting to fire
     on the next navigation, which is how it would leak across a track switch */
  await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem("be_ad_log"); AdManager.markBreak("practice_complete"); });
  const armed = await p.evaluate(() => _adBreak !== null && _adBreak !== undefined);
  await p.evaluate(() => go("home")); await sleep(1500);
  const wo = await overlay(p);
  ok("TW6 · Welding: a completed activity arms NO break, and the next page shows nothing", armed === false && wo === null, JSON.stringify({ armed, view: wo && wo.view }));
  if (wo) await closeAd(p);

  /* every entry point, called directly */
  const direct = await p.evaluate(async () => ({
    inter: await AdManager.interstitial("session_complete"),
    rew: await AdManager.rewarded("extra_practice", "extra_practice", { userInitiated: true }),
    slots: (() => { AdManager.placeNative("home"); AdManager.placeNative("review"); AdManager.placeNative("shadow"); AdManager.placeNative("phrasebank");
                    AdManager.placeNative("data"); AdManager.placeLibrary(); AdManager.placeShadow();
                    return document.querySelectorAll("[data-ad-slot]").length; })(),
  }));
  ok("TW7 · Welding: no native place fills — home, Progress, the library (both slots), App Setup and the Shadow slot all stay empty; the interstitial returns false and the reward is refused for 'track'",
    direct.inter === false && direct.rew.rewarded === false && direct.rew.reason === "track" && direct.slots === 0, JSON.stringify(direct));

  /* there is no slot, so there is nothing for "Remove ads with Premium" to sit
     on: on Welding the plan is not sold as a way out of ads it never shows */
  const esc = await p.evaluate(() => ({ slot: !!document.querySelector("[data-ad-slot]"), remove: !!document.querySelector(".ad-remove"), offered: premOffered() }));
  ok("TW8 · Welding: no slot and no 'Remove ads with Premium' button anywhere, whether or not Premium is offered here (it is sold on Welding for its other benefits)",
    esc.slot === false && esc.remove === false, JSON.stringify(esc));
  const ev = await events(p);
  ok("TW8b · and NO ad event of any kind is written on Welding — the programme leaves no trace, not even a 'suppressed'", !ev.some(x => /^ad_|^rewarded_ad_/.test(x)), JSON.stringify(ev.filter(x => /^ad_|^rewarded_ad_/.test(x)).slice(0, 4)));
  await ctx.close();
}
{
  /* GE is untouched: Free still eligible, Premium still suppressed — and the
     decision follows the OPEN programme within a session */
  WENV = workerEnv();
  const { ctx, p } = await open("general-english");
  await signIn(p, "gefree");
  const ge = await p.evaluate(() => AdEligibility.decide("interstitial", "session_complete"));
  ok("TW9 · General English Free is still eligible — the existing behaviour is preserved", ge.show === true && ge.reason === "ok", JSON.stringify(ge));

  const after = await p.evaluate(() => { S.professionalTracks.activeId = "welding"; return AdEligibility.decide("interstitial", "session_complete"); });
  ok("TW10 · switching GE → Welding inside one session: the decision follows the open programme — refused for 'track'", after.show === false && after.reason === "track", JSON.stringify(after));
  const back = await p.evaluate(() => { S.professionalTracks.activeId = "general-english"; return AdEligibility.decide("interstitial", "session_complete"); });
  ok("TW11 · and switching back restores eligibility", back.show === true, JSON.stringify(back));

  await grantPremium("geprem");
  await signIn(p, "geprem");
  const prem = await p.evaluate(() => AdEligibility.decide("interstitial", "session_complete"));
  ok("TW12 · Premium is still suppressed for 'premium' on General English — there, the plan is what takes ads away", prem.show === false && prem.reason === "premium", JSON.stringify(prem));
  const wprem = await p.evaluate(() => { S.professionalTracks.activeId = "welding"; return AdEligibility.decide("interstitial", "session_complete"); });
  ok("TW13 · a Premium account on Welding is refused for 'track' as well — the programme rule comes before the plan, so Welding shows no ads on ANY plan", wprem.show === false && wprem.reason === "track", JSON.stringify(wprem));
  await ctx.close();
}

console.log("\n# mobile, dark first, light borders");
{
  for (const [theme, vp] of [[null, { width: 375, height: 667 }], [null, { width: 390, height: 844 }], ["light", { width: 390, height: 844 }], [null, { width: 430, height: 932 }]]) {
    WENV = workerEnv();
    const { ctx, p } = await open("general-english", { vp, theme });
    await breakThen(p, "session_complete", "go('journey')");
    await p.waitForSelector("#adOv .ad-continue:not([hidden])", { timeout: 9000 });
    const o = await p.evaluate(() => { const c = document.querySelector("#adOv .ad-card").getBoundingClientRect(), k = document.querySelector("#adOv .ad-continue").getBoundingClientRect(), x = document.querySelector("#adOv .ad-x").getBoundingClientRect();
      return { fits: c.left >= 0 && c.right <= innerWidth && c.top >= 0 && c.bottom <= innerHeight, big: c.height >= innerHeight * 0.6, cont: k.bottom <= innerHeight && k.height >= 44, xSize: Math.round(x.width), overflow: document.documentElement.scrollWidth > innerWidth + 1, theme: document.documentElement.getAttribute("data-theme"), border: getComputedStyle(document.querySelector("#adOv .ad-card")).borderTopColor }; });
    ok(`M · ${theme || "dark"} ${vp.width}×${vp.height}: a large card that fits, Continue reachable (≥44 px), close ≥44 px, no overflow${theme ? ", dark-blue light border" : ", dark by default"}`,
      o.fits && o.big && o.cont && o.xSize >= 44 && !o.overflow && (theme ? /30, 45, 120/.test(o.border) : o.theme === "dark"), JSON.stringify(o));
    await ctx.close();
  }
}

/* ============================================================================
   The App Store shell is NOT a developer machine (30 Sep 2026)
   ----------------------------------------------------------------------------
   The iOS shell loads from capacitor://localhost, so location.hostname is
   literally "localhost" there. Every host test written as "localhost means a
   developer machine" therefore read a shipped iOS build as one. The flags are
   false in FLAGS_DEFAULT and FLAGS_IOS so nothing shipped reached it, but a
   flag is a preview switch, not a boundary — these force both flags ON and
   prove the HOST test refuses anyway. The served page here is on 127.0.0.1,
   which is exactly the trap: the hostname looks local and IS_IOS_APP is true.
   ========================================================================== */
console.log("\n# the App Store shell is not a developer machine");
{
  /* an iOS PRODUCTION build: Capacitor present, no BE_BUILD (that is staging only) */
  async function openIOS(ios, flags) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await ctx.addInitScript(([s, f, isIos]) => {
      localStorage.setItem("be12_v1", s); if (f) localStorage.setItem("be_flags", JSON.stringify(f));
      if (isIos) window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true, registerPlugin: () => ({}) };
    }, [seed("general-english"), flags, ios]);
    await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights|ent\.test/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
    const p = await ctx.newPage(); await p.goto(BASE + "index.html"); await sleep(1300);
    const o = await p.evaluate(async () => ({
      ios: IS_IOS_APP, host: location.hostname, env: !!(window.beEnv && beEnv()),
      adsFlag: flag("ads_mock_provider"), billFlag: flag("billing_preview_provider"),
      mockAds: AdProviders.mock.available(), previewBilling: await BillingProviders.preview.available(),
    }));
    await ctx.close(); return o;
  }
  const BOTH = { ads_enabled: true, ads_mock_provider: true, billing_enabled: true, billing_preview_provider: true };
  /* the other dev doors, with their override keys planted: a release build must
     ignore every one of them (§3 of the readiness sprint) */
  async function openIOSPlanted() {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await ctx.addInitScript(([s, f]) => {
      localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", JSON.stringify(f));
      localStorage.setItem("be_ent_api", "http://ent.evil");          /* a planted entitlement service */
      localStorage.setItem("be_partner_dev_user", "attacker");        /* a planted dev identity */
      window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true, registerPlugin: () => ({}) };
    }, [seed("general-english"), BOTH]);
    await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights|ent\./.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
    const p = await ctx.newPage(); await p.goto(BASE + "index.html"); await sleep(1300);
    const o = await p.evaluate(() => ({ ios: IS_IOS_APP, ent: entApiBase(), devUser: ppDevUser(), partner: ppApiBase(), build: !!window.BE_BUILD }));
    await ctx.close(); return o;
  }

  const i = await openIOS(true, BOTH);
  ok("X1 · the iOS shell really does look local: IS_IOS_APP true and hostname localhost/127.0.0.1", i.ios === true && /^(localhost|127\.0\.0\.1)$/.test(i.host), JSON.stringify(i));
  ok("X2 · …and it is NOT a staging build (beEnv null), so only the host test could have let it through", i.env === false, JSON.stringify(i));
  ok("X3 · both preview flags are forced ON, so this tests the HOST guard and not the flag", i.adsFlag === true && i.billFlag === true, JSON.stringify(i));
  ok("X4 · iOS production: mock ads are NOT available", i.mockAds === false, JSON.stringify(i));
  ok("X5 · iOS production: preview billing is NOT available", i.previewBilling === false, JSON.stringify(i));

  /* local web development must keep working exactly as before */
  const w = await openIOS(false, BOTH);
  ok("X6 · local web development is untouched: mock ads still available with the flag on", w.ios === false && w.mockAds === true, JSON.stringify(w));
  ok("X7 · local web development: preview billing still available with the flag on", w.previewBilling === true, JSON.stringify(w));

  /* and with the flags at their production defaults, neither is available anywhere */
  const d = await openIOS(false, null);
  ok("X8 · production defaults on the web: no mock ads, no preview billing", d.adsFlag === false && d.mockAds === false && d.previewBilling === false, JSON.stringify(d));

  /* the remaining dev doors named in the readiness audit */
  const q = await openIOSPlanted();
  ok("X9 · iOS production ignores a planted be_ent_api — the entitlement service is not redirectable there", q.ios === true && q.ent !== "http://ent.evil", JSON.stringify(q));
  ok("X10 · iOS production ignores a planted be_partner_dev_user — no development authentication (the header is never sent)", q.devUser === null, JSON.stringify(q));
  ok("X11 · …and it is a production bundle: no BE_BUILD, so no staging Workers and no staging-only UI", q.build === false && q.partner === "https://be-partner.nore-ngou.workers.dev", JSON.stringify(q));
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
