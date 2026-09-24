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
import { DatabaseSync } from "node:sqlite"; import { readFileSync } from "node:fs"; import { generateKeyPairSync } from "node:crypto";
import { handle } from "../backend/entitlements/entitlements-worker.js";
import { _resetTokenCache } from "../backend/entitlements/src/google-play.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = 8092, BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
const b = await chromium.launch();
const DAY = 864e5, NOW = Date.now(), iso = ms => new Date(ms).toISOString();

/* ---- fake Google behind the real Worker */
const sa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SUBS = new Map();
const gsub = (o = {}) => ({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", startTime: iso(NOW - DAY), acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING", lineItems: [{ productId: "premium_monthly", expiryTime: iso(NOW + 30 * DAY) }], ...o });
async function googleFetch(url, init = {}) {
  const u = String(url);
  if (u === "https://oauth2.googleapis.com/token") return new Response(JSON.stringify({ access_token: "g", expires_in: 3600 }), { status: 200 });
  const m = /subscriptionsv2\/tokens\/([^/:]+)$/.exec(u); if (m) { const s = SUBS.get(decodeURIComponent(m[1])); return s ? new Response(JSON.stringify(s)) : new Response("{}", { status: 404 }); }
  if (/:acknowledge$/.test(u)) return new Response("{}");
  return new Response("{}", { status: 599 });
}
function d1() {
  const db = new DatabaseSync(":memory:");
  for (const m of ["0001_entitlements.sql", "0002_rewards.sql", "0003_purchases.sql"]) db.exec(readFileSync(new URL("../backend/entitlements/migrations/" + m, import.meta.url), "utf8"));
  return { prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; } };
}
const WENV = { DB: d1(), FIREBASE_PROJECT_ID: "be-mastery", DEV_AUTH: "1", GOOGLE_SA_JSON: JSON.stringify({ client_email: "x@y.iam.gserviceaccount.com", private_key: sa.privateKey.export({ type: "pkcs8", format: "pem" }) }), PLAY_PACKAGE: "com.bemastery.app" };
const WDEPS = { fetch: googleFetch };

const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} }, welding: { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
/* the Digital Goods API + Payment Request exactly as a Play-billed TWA exposes them (stub) */
const PLAY_STUB = () => {
  window.__play = { details: [{ itemId: "premium_monthly", title: "Premium (monthly)", price: { currency: "EUR", value: "4.49" } }, { itemId: "premium_annual", title: "Premium (annual)", price: { currency: "EUR", value: "29.99" } }],
    next: { token: null, cancel: false }, owned: [], completes: [], shows: 0 };
  window.getDigitalGoodsService = async method => { if (method !== "https://play.google.com/billing") throw new Error("unsupported"); return {
    getDetails: async ids => window.__play.details.filter(d => ids.includes(d.itemId)),
    listPurchases: async () => window.__play.owned.slice() }; };
  window.PaymentRequest = class { constructor(m) { this.sku = m[0].data.sku; this.method = m[0].supportedMethods; }
    async show() { window.__play.shows++; if (window.__play.next.cancel) throw new DOMException("cancelled", "AbortError");
      return { details: { purchaseToken: window.__play.next.token }, complete: r => window.__play.completes.push(r) }; } };
};
async function open({ track = "general-english", flags = { billing_enabled: true }, stub = true, vp = { width: 390, height: 844 }, uid = null } = {}) {
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: "block" });
  await ctx.addInitScript(([s, f]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_ent_api", "http://ent.test"); if (f) localStorage.setItem("be_flags", JSON.stringify(f)); }, [seed(track), flags]);
  if (stub) await ctx.addInitScript(PLAY_STUB);
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const calls = [];
  await ctx.route("http://ent.test/**", async r => {
    const q = r.request(), h = { ...q.headers() }; calls.push(q.method() + " " + new URL(q.url()).pathname);
    const m = /^Bearer test-token-(.+)$/.exec(h.authorization || ""); if (m) { h["x-dev-user"] = m[1]; delete h.authorization; }
    const resp = await handle(new Request(q.url(), { method: q.method(), headers: h, body: ["GET", "HEAD"].includes(q.method()) ? undefined : q.postData() }), WENV, WDEPS);
    await r.fulfill({ status: resp.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await resp.text() });
  });
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

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
