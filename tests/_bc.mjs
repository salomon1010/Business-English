/* Phase 9 — the app's billing layer, in a real browser (phone viewport).
   Run: cd tests && node billing-client.mjs

   What is real: index.html's Billing / BillingProviders / Premium card, and
   the entitlement Worker (backend/entitlements handle(), real SQLite) that
   the app's /v1/purchases/* requests reach.
   What is played: Chrome's Digital Goods API and Payment Request (as a
   Play-billed TWA exposes them) are stubbed in the page, and the Worker's
   calls to Google (OAuth + androidpublisher) go to a fake Google in this
   file. Identity uses the Worker's DEV_AUTH header.
   Not provable here: the live Play Billing sheet, real prices and real
   purchase tokens — that needs a Play Console internal-testing track.
   iOS StoreKit needs Xcode + a StoreKit plugin (not on this Mac). */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite"; import { readFileSync, readdirSync } from "node:fs"; import { generateKeyPairSync } from "node:crypto";
import { handle } from "../backend/entitlements/entitlements-worker.js";
import { _resetTokenCache } from "../backend/entitlements/src/google-play.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = 8192, BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const b = await chromium.launch();
const DAY = 864e5, NOW = Date.now(), iso = ms => new Date(ms).toISOString();

/* ---- fake Google behind the real Worker */
const sa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SUBS = new Map(), GACK = { down: false };
const gsub = (o = {}) => ({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", startTime: iso(NOW - DAY), acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING", lineItems: [{ productId: "premium_monthly", expiryTime: iso(NOW + 30 * DAY) }], ...o });
async function googleFetch(url, init = {}) {
  const u = String(url);
  if (u === "https://oauth2.googleapis.com/token") return new Response(JSON.stringify({ access_token: "g", expires_in: 3600 }), { status: 200 });
  const m = /subscriptionsv2\/tokens\/([^/:]+)$/.exec(u); if (m) { const s = SUBS.get(decodeURIComponent(m[1])); return s ? new Response(JSON.stringify(s)) : new Response("{}", { status: 404 }); }
  if (/:acknowledge$/.test(u)) {   /* GACK.down: Google fails the acknowledge only */
    if (GACK.down) return new Response("{}", { status: 503 });
    const t = /tokens\/([^/:]+):acknowledge$/.exec(u), s = t && SUBS.get(decodeURIComponent(t[1]));
    if (s) s.acknowledgementState = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"; return new Response("{}");
  }
  return new Response("{}", { status: 599 });
}
function d1() {
  const db = new DatabaseSync(":memory:");
  for (const m of readdirSync(new URL("../backend/entitlements/migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).sort()) db.exec(readFileSync(new URL("../backend/entitlements/migrations/" + m, import.meta.url), "utf8"));
  return { prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; } };
}
const WENV = { DB: d1(), FIREBASE_PROJECT_ID: "be-mastery", DEV_AUTH: "1", GOOGLE_SA_JSON: JSON.stringify({ client_email: "x@y.iam.gserviceaccount.com", private_key: sa.privateKey.export({ type: "pkcs8", format: "pem" }) }), PLAY_PACKAGE: "com.bemastery.app" };
const WDEPS = { fetch: googleFetch };

const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} }, welding: { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
/* the Digital Goods API + Payment Request exactly as a Play-billed TWA exposes them (stub) */
const PLAY_STUB = () => {
  /* the stub store mirrors the real configuration (SUBSCRIPTIONS.md, 30 Sep 2026):
     the 3-day free trial is on the ANNUAL plan, which is the only one offered.
     Monthly stays defined, as it does in the store, to prove it is NOT shown. */
  window.__play = { details: [{ itemId: "premium_monthly", title: "Premium (monthly)", price: { currency: "EUR", value: "4.49" }, subscriptionPeriod: "P1M" }, { itemId: "premium_annual", title: "Annual Premium", price: { currency: "EUR", value: "29.99" }, subscriptionPeriod: "P1Y", freeTrialPeriod: "P3D" }],
    next: { token: null, cancel: false }, owned: [], completes: [], shows: 0 };
  window.getDigitalGoodsService = async method => { if (method !== "https://play.google.com/billing") throw new Error("unsupported"); return {
    getDetails: async ids => window.__play.details.filter(d => ids.includes(d.itemId)),
    listPurchases: async () => window.__play.owned.slice() }; };
  window.PaymentRequest = class { constructor(m) { this.sku = m[0].data.sku; this.method = m[0].supportedMethods; }
    async show() { window.__play.shows++; if (window.__play.next.cancel) throw new DOMException("cancelled", "AbortError");
      return { details: { purchaseToken: window.__play.next.token }, complete: r => window.__play.completes.push(r) }; } };
};
const NET = { down: false };   /* true: our server is unreachable (the request is aborted) */
async function open({ track = "general-english", flags = { billing_enabled: true }, stub = true, vp = { width: 390, height: 844 }, uid = null, pre = null } = {}) {
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: "block" });
  await ctx.addInitScript(([s, f]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_ent_api", "http://ent.test"); if (f) localStorage.setItem("be_flags", JSON.stringify(f)); }, [seed(track), flags]);
  if (stub) await ctx.addInitScript(PLAY_STUB);
  if (pre) await ctx.addInitScript(pre);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const calls = [];
  const entRoute = async r => {
    const q = r.request(), h = { ...q.headers() }; calls.push(q.method() + " " + new URL(q.url()).pathname);
    if (NET.down && /\/v1\/purchases\//.test(q.url())) return r.abort("internetdisconnected");
    const m = /^Bearer test-token-(.+)$/.exec(h.authorization || ""); if (m) { h["x-dev-user"] = m[1]; delete h.authorization; }
    const resp = await handle(new Request(q.url(), { method: q.method(), headers: h, body: ["GET", "HEAD"].includes(q.method()) ? undefined : q.postData() }), WENV, WDEPS);
    await r.fulfill({ status: resp.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await resp.text() });
  };
  await ctx.route("http://ent.test/**", entRoute);
  await ctx.route("https://be-entitlements-staging.nore-ngou.workers.dev/**", entRoute);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1400);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  if (uid) await p.evaluate(async uid => { FBUser = { uid, getIdToken: async () => "test-token-" + uid }; await entRefresh(); await Billing.init(); }, uid);
  else await p.evaluate(async () => { await Billing.init(); });
  await p.evaluate(() => { go("data"); const d = document.querySelector("details.set-plan"); if (d) d.open = true; }); await sleep(400);
  return { ctx, p, calls, errs };
}
const card = p => p.evaluate(() => { const c = document.getElementById("entPlan"); return c ? { text: c.textContent.replace(/\s+/g, " "), buys: [...c.querySelectorAll(".ent-buy")].map(x => x.textContent.replace(/\s+/g, " ")), open: !!(c.closest("details") && c.closest("details").open), signin: !!c.querySelector("[onclick='fbOpenModal()']"), restore: !!c.querySelector("[onclick='Billing.restore()']"), manage: !!c.querySelector("[onclick='Billing.manage()']"), state: Billing.state } : null; });

console.log("\n# production defaults");
{
  const { ctx, p, calls, errs } = await open({ flags: null, uid: "u0" });
  const c = await card(p);
  ok("B1 · billing_enabled is OFF by default: no store, no prices, no buttons — 'Coming soon' as before", c && /Coming soon/.test(c.text) && !c.buys.length && !c.restore && !calls.some(x => /purchases/.test(x)), JSON.stringify(c));
  ok("B2 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
  const o2 = await open({ stub: false, uid: "u0" });
  ok("B3 · flag on but not inside a Play-billed TWA (plain web): no provider, nothing sold on the web", /Coming soon/.test((await card(o2.p)).text) && !(await card(o2.p)).buys.length);
  await o2.ctx.close();
}

console.log("\n# Android TWA — Play Billing through the Digital Goods API");
{
  _resetTokenCache();
  let { ctx, p, calls } = await open();
  let c = await card(p);
  ok("B4 · signed out: 'Sign in to get Premium' — nothing can be bought without an account", c.signin && !c.buys.length, JSON.stringify(c));
  await ctx.close();
  ({ ctx, p, calls } = await open({ uid: "anna" }));
  c = await card(p);
  ok("B5 · signed in: the offers carry the STORE's titles and prices, formatted from Play's currency — none invented", c.buys.length === 2 && c.buys.some(x => /Premium \(monthly\)/.test(x) && /4\.49/.test(x) && /€/.test(x)) && c.buys.some(x => /29\.99/.test(x)) && c.restore, JSON.stringify(c.buys));
  await p.evaluate(() => { __play.next = { token: "tok_anna_" + "a".repeat(20), cancel: true }; });
  await p.evaluate(() => Billing.buy("premium_monthly"));
  c = await card(p);
  ok("B6 · the learner closes the Play sheet: nothing sent to the server, plan unchanged, offers still there", !calls.some(x => /purchases\/verify/.test(x)) && c.buys.length === 2 && c.state === "ready");
  await p.evaluate(() => { __play.next = { token: "tok_unknown_" + "u".repeat(20), cancel: false }; });
  await p.evaluate(() => Billing.buy("premium_monthly"));
  c = await card(p);
  ok("B7 · a token Google does not know → failed state, the sheet told 'fail', still Free", c.state === "failed" && /did not go through/.test(c.text) && await p.evaluate(() => __play.completes.includes("fail") && !entIsPremiumForDisplay()), c.text);
  SUBS.set("tok_anna_" + "a".repeat(20), gsub());
  await p.evaluate(() => { __play.next = { token: "tok_anna_" + "a".repeat(20), cancel: false }; });
  await p.evaluate(() => { document.querySelector("details.set-plan").open = true; });
  await p.evaluate(() => Billing.buy("premium_monthly")); await sleep(1200);   /* App Setup redraws asynchronously */
  c = await card(p);
  ok("B8 · a purchase Google confirms → the SERVER grants Premium; success state; sheet told 'success'; Manage subscription offered", c.state === "success" && /Premium is on/.test(c.text) && c.manage && !c.buys.length && await p.evaluate(() => entIsPremiumForDisplay() && __play.completes.includes("success")), c.text);
  ok("B8b · the plan section stays open through the purchase (the result is not folded away)", c.open === true);
  ok("B9 · Premium from the store removes ads through the one policy (Phase 8)", await p.evaluate(() => AdEligibility.decide("interstitial", "session_complete").reason === "flag_off" && !AdEligibility.planAllowsAds()));
  await ctx.close();
  ({ ctx, p } = await open({ uid: "bert" }));
  await p.evaluate(() => { __play.next = { token: "tok_anna_" + "a".repeat(20), cancel: false }; });
  await p.evaluate(() => Billing.buy("premium_monthly"));
  c = await card(p);
  ok("B10 · the same Play purchase on another BE Mastery account → 'belongs to another account', still Free", /belongs to another BE Mastery account/.test(c.text) && await p.evaluate(() => !entIsPremiumForDisplay()), c.text);
  await ctx.close();
}

console.log("\n# Restore, cancellation, grace, expiry");
{
  SUBS.set("tok_cara_" + "c".repeat(20), gsub({ lineItems: [{ productId: "premium_annual", expiryTime: iso(NOW + 300 * DAY) }] }));
  let { ctx, p } = await open({ uid: "cara" });
  await p.evaluate(() => { __play.owned = [{ itemId: "premium_annual", purchaseToken: "tok_cara_" + "c".repeat(20) }]; });
  await p.evaluate(() => Billing.restore());
  let c = await card(p);
  ok("B11 · Restore purchases: what Play says this device owns is re-verified by the server → Premium, '1 restored'", /1 restored/.test(c.text) && await p.evaluate(() => entIsPremiumForDisplay()), c.text);
  await ctx.close();
  ({ ctx, p } = await open({ uid: "dora" }));
  await p.evaluate(() => { __play.owned = []; }); await p.evaluate(() => Billing.restore());
  ok("B12 · Restore with nothing owned → 'No purchases found', still Free", /No purchases found/.test((await card(p)).text));
  await ctx.close();
  SUBS.set("tok_ed_" + "e".repeat(20), gsub({ subscriptionState: "SUBSCRIPTION_STATE_CANCELED" }));
  ({ ctx, p } = await open({ uid: "ed" }));
  await p.evaluate(() => { __play.next = { token: "tok_ed_" + "e".repeat(20), cancel: false }; }); await p.evaluate(() => Billing.buy("premium_monthly"));
  ok("B13 · cancelled but paid to expiry → 'Cancelled — Premium stays on until …'", /Cancelled — Premium stays on until/.test((await card(p)).text));
  await ctx.close();
  SUBS.set("tok_flo_" + "f".repeat(20), gsub({ subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" }));
  ({ ctx, p } = await open({ uid: "flo" }));
  await p.evaluate(() => { __play.next = { token: "tok_flo_" + "f".repeat(20), cancel: false }; }); await p.evaluate(() => Billing.buy("premium_monthly"));
  ok("B14 · grace period → 'Payment problem — Premium stays on until …'", /Payment problem/.test((await card(p)).text));
  await ctx.close();
  SUBS.set("tok_gil_" + "g".repeat(20), gsub({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", lineItems: [{ productId: "premium_monthly", expiryTime: iso(NOW - DAY) }] }));
  ({ ctx, p } = await open({ uid: "gil" }));
  await p.evaluate(() => { __play.next = { token: "tok_gil_" + "g".repeat(20), cancel: false }; }); await p.evaluate(() => Billing.buy("premium_monthly"));
  const g = await card(p);
  ok("B15 · expired → 'Your Premium has ended', and Get Premium is offered again", /Your Premium has ended/.test(g.text) && g.buys.length === 2, g.text);
  await ctx.close();
}

console.log("\n# iOS boundary, tracks, layout");
{
  let { ctx, p } = await open({ uid: "hal" });
  const k = await p.evaluate(() => { window.BENativeBilling = { purchase: async () => ({}), getProducts: async () => [], restore: async () => [] }; return BillingProviders.storekit.available(); });
  ok("B16 · the StoreKit bridge is honoured only inside the iOS shell (IS_IOS_APP), never on the web", k === false);
  await ctx.close();
  SUBS.set("tok_ivo_" + "i".repeat(20), gsub());
  ({ ctx, p } = await open({ uid: "ivo", track: "welding" }));
  await p.evaluate(() => { __play.next = { token: "tok_ivo_" + "i".repeat(20), cancel: false }; }); await p.evaluate(() => Billing.buy("premium_monthly"));
  const w = await p.evaluate(() => ({ prem: entIsPremiumForDisplay(), ge: isGeneralEnglish(), pp: ppAvailable(), sv: typeof svOn === "function" ? svOn() : null }));
  ok("B17 · Welding: Premium applies to the account; no General-English feature appears (Practice Partner, Shadow V2)", w.prem && !w.ge && !w.pp && w.sv === false, JSON.stringify(w));
  await ctx.close();
  for (const [theme, vp] of [["dark", { width: 375, height: 667 }], ["light", { width: 390, height: 844 }]]) {
    ({ ctx, p } = await open({ uid: "jo" + theme, vp }));
    if (theme === "light") { await p.evaluate(() => { setTheme("light"); go("data"); document.querySelector("details.set-plan").open = true; }); await sleep(300); }
    const m = await p.evaluate(() => { const c = document.getElementById("entPlan").getBoundingClientRect(); const bs = [...document.querySelectorAll("#entPlan button")].map(x => x.getBoundingClientRect());
      return { fits: c.left >= 0 && c.right <= innerWidth + .5, tall: bs.every(r => r.height >= 44), wide: bs.every(r => r.right <= innerWidth + .5), overflow: document.documentElement.scrollWidth > innerWidth + 1, border: getComputedStyle(document.getElementById("entPlan")).borderTopColor }; });
    ok(`B18 · ${theme} ${vp.width}px: the Premium card and its store buttons fit, no overflow${theme === "light" ? ", dark-blue light border" : ""}`, m.fits && m.tall && m.wide && !m.overflow && (theme !== "light" || /30, 45, 120/.test(m.border)), JSON.stringify(m));
    await ctx.close();
  }
}

console.log("\n# Phase 10 — the purchase flow under failure");
{
  /* C1-C2: Play takes the payment, then our server cannot be reached */
  SUBS.set("tok_kim_" + "k".repeat(20), gsub());
  let { ctx, p } = await open({ uid: "kim" });
  await p.evaluate(() => { document.querySelector("details.set-plan").open = true; __play.next = { token: "tok_kim_" + "k".repeat(20), cancel: false }; });
  NET.down = true; await p.evaluate(() => Billing.buy("premium_monthly")); NET.down = false; await sleep(300);
  let c = await card(p);
  const done = await p.evaluate(() => __play.completes.slice());
  ok("C1 · server unreachable after Play took the payment: 'your payment went through… Restore', Play told 'unknown' (never 'fail'), still Free", /payment went through/.test(c.text) && done.join() === "unknown" && await p.evaluate(() => !entIsPremiumForDisplay()), c.text + " | " + done.join());
  await ctx.close();
  ({ ctx, p } = await open({ uid: "kim", pre: () => { __play.owned = [{ itemId: "premium_monthly", purchaseToken: "tok_kim_" + "k".repeat(20) }]; } }));
  await sleep(800);   /* nothing is called by the test: Billing.init() at sign-in runs the reconcile */
  const k2 = await p.evaluate(() => ({ prem: entIsPremiumForDisplay(), shows: __play.shows }));
  ok("C2 · next launch: the silent reconcile claims the purchase Play holds — Premium, with no purchase sheet and no tap", k2.prem && k2.shows === 0, JSON.stringify(k2));
  await ctx.close();

  /* C10-C11: the server granted Premium but Google's acknowledge failed.
     Premium does not stop the launch reconcile: it re-sends what Play holds,
     and the server acknowledges it before Play's 3-day refund. */
  SUBS.set("tok_moe_" + "o".repeat(20), gsub());
  ({ ctx, p } = await open({ uid: "moe" }));
  await p.evaluate(() => { document.querySelector("details.set-plan").open = true; __play.next = { token: "tok_moe_" + "o".repeat(20), cancel: false }; });
  GACK.down = true; await p.evaluate(() => Billing.buy("premium_monthly")); GACK.down = false; await sleep(300);
  const m1 = await p.evaluate(() => ({ prem: entIsPremiumForDisplay(), done: __play.completes.slice() }));
  ok("C10 · the acknowledge alone fails: the learner still gets Premium at once (Play told 'success'), and Google still holds it unacknowledged", m1.prem && m1.done.join() === "success" && SUBS.get("tok_moe_" + "o".repeat(20)).acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING", JSON.stringify(m1));
  await ctx.close();
  let calls; ({ ctx, p, calls } = await open({ uid: "moe", pre: () => { __play.owned = [{ itemId: "premium_monthly", purchaseToken: "tok_moe_" + "o".repeat(20) }]; } }));
  await sleep(800);
  ok("C11 · next launch on a Premium account: the silent reconcile still runs and the purchase is acknowledged — no 3-day refund", calls.includes("POST /v1/purchases/restore") && SUBS.get("tok_moe_" + "o".repeat(20)).acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" && await p.evaluate(() => entIsPremiumForDisplay() && __play.shows === 0), calls.join());
  await ctx.close();

  /* C12-C13 (Phase 11): Play accepts a slow payment method (cash) — the
     subscription is PENDING until it is paid. No Premium, no "Premium is on",
     no acknowledge; the next launch after payment gives Premium. */
  SUBS.set("tok_pax_" + "p".repeat(20), gsub({ subscriptionState: "SUBSCRIPTION_STATE_PENDING" }));
  ({ ctx, p } = await open({ uid: "pax" }));
  await p.evaluate(() => { document.querySelector("details.set-plan").open = true; __play.next = { token: "tok_pax_" + "p".repeat(20), cancel: false }; });
  await p.evaluate(() => Billing.buy("premium_monthly")); await sleep(300);
  c = await card(p);
  const pp = await p.evaluate(() => ({ prem: entIsPremiumForDisplay(), state: entView().state }));
  ok("C12 · payment pending: 'still being processed… no need to buy again', never 'Premium is on' or 'ended', still Free, not acknowledged", /still being processed/.test(c.text) && !/Premium is on|has ended/.test(c.text) && !pp.prem && pp.state === "payment_pending" && SUBS.get("tok_pax_" + "p".repeat(20)).acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING", c.text + " " + JSON.stringify(pp));
  await ctx.close();
  SUBS.get("tok_pax_" + "p".repeat(20)).subscriptionState = "SUBSCRIPTION_STATE_ACTIVE";
  ({ ctx, p } = await open({ uid: "pax", pre: () => { __play.owned = [{ itemId: "premium_monthly", purchaseToken: "tok_pax_" + "p".repeat(20) }]; } }));
  await sleep(800);
  ok("C13 · once the store confirms the payment, the next launch gives Premium and the purchase is acknowledged", await p.evaluate(() => entIsPremiumForDisplay()) && SUBS.get("tok_pax_" + "p".repeat(20)).acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED");
  await ctx.close();

  /* C14-C15 (Phase 12A): the purchase funnel's analytics. Every track() the
     Billing code makes is recorded: allow-listed names, map keys only, fixed
     values — and never a token, whatever the flow. */
  const PREM_KEYS = ["provider", "product", "reason", "result", "source", "state"];
  const REC = () => { window.__ev = []; window.track = (n, p) => { if (/^(purchase_|entitlement_)/.test(n)) window.__ev.push([n, p || {}]); }; };
  SUBS.set("tok_qa1_" + "q".repeat(20), gsub());
  SUBS.set("tok_qa2_" + "w".repeat(20), gsub({ subscriptionState: "SUBSCRIPTION_STATE_PENDING" }));
  ({ ctx, p } = await open({ uid: "qa1" }));
  await p.evaluate(REC);
  await p.evaluate(() => { __play.next = { token: "tok_qa9_" + "z".repeat(20), cancel: true }; }); await p.evaluate(() => Billing.buy("premium_monthly"));
  await p.evaluate(() => { __play.next = { token: "tok_qa2_" + "w".repeat(20), cancel: false }; }); await p.evaluate(() => Billing.buy("premium_monthly"));
  await p.evaluate(() => { __play.owned = []; }); await p.evaluate(() => Billing.restore());
  await p.evaluate(() => { __play.next = { token: "tok_qa1_" + "q".repeat(20), cancel: false }; }); await p.evaluate(() => Billing.buy("premium_monthly"));
  SUBS.get("tok_qa1_" + "q".repeat(20)).subscriptionState = "SUBSCRIPTION_STATE_CANCELED";
  await p.evaluate(() => { __play.owned = [{ itemId: "premium_monthly", purchaseToken: "tok_qa1_" + "q".repeat(20) }]; }); await p.evaluate(() => Billing.restore());
  SUBS.get("tok_qa1_" + "q".repeat(20)).subscriptionState = "SUBSCRIPTION_STATE_EXPIRED";
  SUBS.get("tok_qa1_" + "q".repeat(20)).lineItems = [{ productId: "premium_monthly", expiryTime: iso(NOW - DAY) }];
  await p.evaluate(() => Billing.restore()); await p.evaluate(() => entRefresh());
  const evs = await p.evaluate(() => window.__ev);
  const names = evs.map(e => e[0]);
  ok("C14 · the funnel is counted: started → failed(cancelled), started → pending, restore(none), started → confirmed, then cancelled and expired as the server reports them",
    ["purchase_started", "purchase_failed", "purchase_pending", "purchase_restore", "purchase_confirmed", "entitlement_cancelled", "entitlement_expired"].every(n => names.includes(n))
    && evs.some(([n, q]) => n === "purchase_failed" && q.reason === "cancelled") && evs.some(([n, q]) => n === "purchase_restore" && q.result === "none" && q.source === "tap"), JSON.stringify(evs));
  ok("C15 · every event carries only the map keys and fixed values — no token, order id, account or date anywhere",
    evs.every(([, q]) => Object.keys(q).every(k => PREM_KEYS.includes(k))) && !/tok_|GPA|qa1|qa2|@|\d{10}/.test(JSON.stringify(evs)), JSON.stringify(evs));
  await ctx.close();

  /* PR1-PR9: the Premium sheet — the store's plans, one purchase path, every state */
  const sheet = pp => pp.evaluate(() => { const o = document.getElementById("premOv"); if (!o) return null; const sh = o.querySelector(".prem-sheet");
    const off = o.querySelector(".prem-offer");
    const offer = off ? { text: off.textContent.replace(/\s+/g, " ").trim(), trial: (off.querySelector(".prem-offer-trial") || {}).textContent || "", price: (off.querySelector(".prem-offer-price") || {}).textContent || "" } : null;
    const plans = [...o.querySelectorAll(".prem-plan")];   /* the old chooser: must be gone */
    const r = sh.getBoundingClientRect(), btns = [...o.querySelectorAll("button")].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height);
    return { text: sh.textContent.replace(/\s+/g, " "), plans, offer, ctaText: ((o.querySelector(".prem-cta") || {}).textContent || "").replace(/\s+/g, " ").trim(), radios: o.querySelectorAll('[role="radiogroup"],[role="radio"]').length, cta: !!o.querySelector(".prem-cta"), fits: r.left >= -0.5 && r.right <= innerWidth + 0.5, overflow: document.documentElement.scrollWidth > innerWidth + 1, minBtn: Math.min(...btns), rtl: getComputedStyle(sh).direction }; });
  ({ ctx, p } = await open({ uid: "prq", flags: null }));
  await p.evaluate(() => go("profile")); await sleep(500);
  const off = await p.evaluate(() => ({ row: !!document.querySelector(".pf-prem"), open: (premiumOpen("test"), document.querySelector("#premOv .prem-sheet").textContent) }));
  ok("PR1 · billing off (production today): no Premium row in Profile; the sheet, if opened, only says it cannot be bought here", !off.row && /can't be bought on this device/.test(off.open) && !/Continue|Save/.test(off.open), JSON.stringify(off));
  await ctx.close();
  ({ ctx, p } = await open({ uid: "prr" }));
  await p.evaluate(() => go("profile")); await sleep(500);
  ok("PR2 · billing live: Profile shows 'BE Mastery Premium · More speaking, shadowing and AI tools' (no ad-free claim while ads are off)", await p.evaluate(() => { const r = document.querySelector(".pf-prem .pf-row"); return !!r && /BE Mastery Premium/.test(r.textContent) && /More speaking, shadowing and AI tools/.test(r.textContent) && !/No ads/.test(r.textContent); }));
  await p.evaluate(() => document.querySelector(".pf-prem .pf-row").click()); await sleep(300);
  let sh = await sheet(p);
  ok("PR3 · ONE offer (owner, 30 Sep 2026): the annual plan, its price straight from the store, per year — no chooser, no radio group, no 'best value', no saving to compare against", sh && sh.offer && /29\.99/.test(sh.offer.price) && /\/ year/.test(sh.offer.price) && sh.plans.length === 0 && sh.radios === 0 && !/Best value|Save \d+%|a month, billed once a year/.test(sh.text), JSON.stringify(sh && { offer: sh.offer, plans: sh.plans.length, radios: sh.radios }));
  ok("PR4 · the monthly product the store still sells is NOT offered: no monthly price, no '/ month', nothing to choose between", !/4\.49/.test(sh.text) && !/\/ month/.test(sh.text) && !/Monthly/.test(sh.text), sh.text);
  ok("PR4b · the free trial leads the offer and the CTA, and the renewal line says what happens next, at the store's price, where to cancel", /3 days free/i.test(sh.offer.trial) && /Start 3-day free trial/.test(sh.ctaText) && /Then .*29\.99 \/ year\. Cancel anytime in Google Play\./.test(sh.text), JSON.stringify({ trial: sh.offer.trial, cta: sh.ctaText }));
  ok("PR5 · the benefits are the capabilities Premium actually grants (AI analysis, verbal feedback, advanced progress, 30/90-day analytics, AI Coach); no ad-free claim while ads are off; the store's renewal terms, Privacy and Restore; no raw key and no {{placeholder}}", /AI speaking analysis/.test(sh.text) && /AI feedback spoken back to you/.test(sh.text) && /Advanced progress/.test(sh.text) && /30- and 90-day analytics/.test(sh.text) && /The AI Coach/.test(sh.text) && !/No ads/.test(sh.text) && /renews automatically until you cancel it in Google Play/.test(sh.text) && /Restore purchases/.test(sh.text) && !/prem\.|acc\.|pg\.|\{\{|More AI coaching/.test(sh.text), sh.text);
  ok("PR6 · there is nothing to pick: the CTA buys the annual plan without a selection step", await p.evaluate(() => _premSel === "premium_annual"), await p.evaluate(() => String(_premSel)));
  /* Google must report the ANNUAL product for this token: the app now buys
     premium_annual, and the Worker refuses a purchase whose claimed product
     does not match Google's record (billing.js "product_mismatch") */
  SUBS.set("tok_prr_" + "r".repeat(20), gsub({ lineItems: [{ productId: "premium_annual", expiryTime: iso(NOW + 365 * DAY) }] }));
  await p.evaluate(() => { __play.next = { token: "tok_prr_" + "r".repeat(20), cancel: false }; });
  const bought = await p.evaluate(async () => { const orig = Billing.buy.bind(Billing); let asked = null; Billing.buy = id => { asked = id; return orig(id); }; document.querySelector(".prem-cta").click(); await new Promise(r => setTimeout(r, 1500)); Billing.buy = orig; return { asked, prem: entIsPremiumForDisplay(), note: Billing.note, state: Billing.state }; });
  sh = await sheet(p);
  ok("PR7 · the CTA buys the one offer through the existing Billing.buy, and the sheet turns into 'Active · Continue learning' when the server says Premium", bought.asked === "premium_annual" && bought.prem && sh && /Active/.test(sh.text) && /Continue learning/.test(sh.text) && !sh.cta, JSON.stringify(bought) + " " + (sh && sh.text));
  await p.evaluate(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); }); await sleep(100);
  ok("PR8 · Escape closes the sheet", await p.evaluate(() => !document.getElementById("premOv")));
  await ctx.close();
  ({ ctx, p } = await open({ uid: null }));
  await p.evaluate(() => premiumOpen("test")); await sleep(200);
  ok("PR9 · signed out: the sheet asks to sign in, sells nothing", /Sign in to get Premium/.test((await sheet(p)).text) && !(await sheet(p)).cta);
  await ctx.close();
  for (const [lang, vp, theme] of [["en", { width: 320, height: 640 }, "dark"], ["ar", { width: 360, height: 740 }, "light"], ["fr", { width: 390, height: 844 }, "light"]]) {
    ({ ctx, p } = await open({ uid: "prl" + lang, vp }));
    await p.evaluate(async ([l, th]) => { if (l !== "en") await setLang(l); if (th === "light") setTheme("light"); premiumOpen("test"); }, [lang, theme]); await sleep(600);
    sh = await sheet(p);
    ok(`PR10 · ${lang} ${vp.width}px ${theme}: the sheet fits, no page overflow, every button ≥ 44 px${lang === "ar" ? ", right-to-left" : ""}, no raw key`, sh && sh.fits && !sh.overflow && sh.minBtn >= 44 && (lang !== "ar" || sh.rtl === "rtl") && !/prem\.|pg\.|\{\{/.test(sh.text) && !!(sh && sh.offer), JSON.stringify({ fits: sh && sh.fits, overflow: sh && sh.overflow, minBtn: sh && sh.minBtn, rtl: sh && sh.rtl, offer: sh && sh.offer }));
    await ctx.close();
  }
  ({ ctx, p } = await open({ uid: "prs" }));
  const card2 = await card(p);
  ok("PR11 · App Setup card: 'See Premium plans' opens the same sheet, and it no longer promises 'More AI coaching' (no feature delivers it)", /See Premium plans/.test(card2.text) && !/More AI coaching/.test(card2.text) && await p.evaluate(() => { document.querySelector("#entPlan .prem-open").click(); return !!document.getElementById("premOv"); }), card2.text);
  await ctx.close();
  ({ ctx, p } = await open({ uid: "prn", pre: () => { window.__noPeriod = true; } }));
  await p.evaluate(async () => { __play.details = __play.details.map(d => ({ itemId: d.itemId, title: d.title, price: d.price })); Billing.products = await Billing.provider.products(); premiumOpen("test"); }); await sleep(300);
  sh = await sheet(p);
  ok("PR12 · a store that reports no period or trial: the annual offer is still found by product id, and NO trial is claimed or invented", !!sh.offer && /29\.99/.test(sh.offer.price) && !/free trial|days free/i.test(sh.text), JSON.stringify({ offer: sh.offer }));
  await ctx.close();

  /* C3: another account on the same device never sees the last one's message */
  ({ ctx, p } = await open({ uid: "lea" }));
  await p.evaluate(() => { Billing.note = t("acc.prem_bound"); Billing.state = "failed"; Billing._draw(); });
  await p.evaluate(async () => { FBUser = { uid: "max", getIdToken: async () => "test-token-max" }; await entRefresh(); await Billing.init(); });
  c = await card(p);
  ok("C3 · switching account clears the previous account's purchase message", !/belongs to another/.test(c.text) && c.buys.length === 2, c.text);

  /* C4: no restore while a purchase is open */
  await p.evaluate(() => { __play.next = { token: null, cancel: false }; window.__release = null;
    window.PaymentRequest.prototype.show = function () { __play.shows++; return new Promise(res => { window.__release = () => res({ details: { purchaseToken: "tok_none_" + "n".repeat(20) }, complete: r => __play.completes.push(r) }); }); };
    Billing.buy("premium_monthly"); });
  await sleep(200);
  const mid = await p.evaluate(async () => { const rb = document.querySelector("#entPlan [onclick='Billing.restore()']"); const before = Billing.state; await Billing.restore(); return { disabled: !!(rb && rb.disabled), state: Billing.state, before }; });
  await p.evaluate(() => window.__release && window.__release()); await sleep(300);
  ok("C4 · while the purchase sheet is open, Restore is disabled and a call to it does nothing", mid.disabled && mid.before === "purchasing" && mid.state === "purchasing", JSON.stringify(mid));
  await ctx.close();

  /* C5: Play returns no products (none set up in Play Console yet) */
  ({ ctx, p } = await open({ uid: "ned", pre: () => { window.__noProducts = true; } }));
  await p.evaluate(async () => { if (window.__noProducts) __play.details = []; await Billing.init(); document.querySelector("details.set-plan").open = true; });
  c = await card(p);
  ok("C5 · no products from the store: 'Purchases are not available right now', no empty buy area", /not available right now/.test(c.text) && !c.buys.length, c.text);
  await ctx.close();

  /* C6: iOS shell, the account-token call fails (here: App Store not configured on the server) */
  ({ ctx, p } = await open({ uid: "ola", stub: false, pre: () => {
    window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true }; window.BE_BUILD = { env: "staging", flags: { billing_enabled: true } };   /* the App Store shell ignores be_ent_api: a staging iOS bundle reaches the staging Worker (d4cc447) */
    window.__sk = { purchases: 0 };
    window.BENativeBilling = { getProducts: async ids => ids.map(id => ({ id, title: id === "premium_annual" ? "Premium (annual)" : "Premium (monthly)", displayPrice: "€4.99" })),
      purchase: async () => { __sk.purchases++; return { signedTransaction: "x" }; }, restore: async () => [], manageSubscriptions: () => {} };
  } }));
  await p.evaluate(async () => { await Billing.init(); document.querySelector("details.set-plan").open = true; });
  const pv = await p.evaluate(() => Billing.provider && Billing.provider.id);
  await p.evaluate(() => Billing.buy("premium_monthly"));
  c = await card(p);
  const sk = await p.evaluate(() => __sk.purchases);
  ok("C6 · iOS shell: if the account token cannot be fetched the purchase does not start and the learner is told it failed (not a silent cancel)", pv === "app_store" && sk === 0 && c.state === "failed" && /did not go through|could not|failed/i.test(c.text), pv + " " + sk + " " + c.state + " " + c.text);

  const tl = await p.evaluate(() => { const e = document.querySelector("#entPlan .ent-terms"); return e ? { text: e.textContent, links: [...e.querySelectorAll("a")].map(a => a.getAttribute("href")) } : null; });
  ok("C9 · iOS offer: renewal terms name the App Store, with the Privacy policy and Apple's standard EULA linked (guideline 3.1.2)", tl && /App Store/.test(tl.text) && tl.links.includes("privacy.html") && tl.links.some(u => /apple\.com\/legal\/internet-services\/itunes\/dev\/stdeula/.test(u)), JSON.stringify(tl));
  /* C7-C8: Manage opens only the store that sold the plan */
  await p.evaluate(() => { billingTakeView({ plan: "premium", paid: true, state: "active", ads: false, capabilities: { ad_free: true }, expiresAt: Date.now() + 9e8, source: "google_play", renews: true }); Billing._draw(); });
  c = await card(p);
  ok("C7 · a Google Play plan seen in the iPhone app: 'managed in Google Play', no Manage button that would open Apple's page", /managed in Google Play/.test(c.text) && !c.manage, c.text);
  await ctx.close();
  SUBS.set("tok_pia_" + "p".repeat(20), gsub());
  ({ ctx, p } = await open({ uid: "pia" }));
  await p.evaluate(() => { __play.next = { token: "tok_pia_" + "p".repeat(20), cancel: false }; window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
  await p.evaluate(() => Billing.buy("premium_monthly")); await sleep(1200);
  await p.evaluate(() => Billing.manage());
  const opened = await p.evaluate(() => window.__opened);
  ok("C8 · a Play plan in the Android app: Manage opens Play's subscription page for this package", opened.length === 1 && /play\.google\.com\/store\/account\/subscriptions\?package=com\.bemastery\.app/.test(opened[0]), opened.join());
  await ctx.close();
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
