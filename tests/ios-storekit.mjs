/* iOS (App Store shell) — the StoreKit 2 bridge end to end, in a browser.
   Run: cd tests && node ios-storekit.mjs        (needs openssl on PATH)

   What is real: index.html (beNativeBilling(), BillingProviders.storekit,
   Billing, the Premium sheet, the Subscription card, account deletion) and the
   entitlement Worker (backend/entitlements handle(), real SQLite) verifying
   Apple JWS with a REAL X.509 chain made here with openssl (P-384 root,
   intermediate with Apple's marker OID, P-256 leaf with the receipt-signing
   OID), pinned through APPLE_ROOT_SHA256 exactly as in production.
   What is played: the Capacitor bridge and the Swift plugin (BEStoreKitPlugin)
   — a fake `BEStoreKit` plugin with the same method and event names, whose
   transactions are signed by that test chain. What this cannot prove: that
   StoreKit on a device answers in exactly these shapes. That needs Xcode, a
   Sandbox Apple ID and TestFlight. */
import { chromium } from "playwright"; import { spawn, spawnSync } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite"; import { readFileSync, readdirSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
import { sign as nodeSign, createHash, createPrivateKey } from "node:crypto";
import { handle } from "../backend/entitlements/entitlements-worker.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8099), BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.SHOTS || ""; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const DAY = 864e5, NOW = Date.now();
const b64u = b => Buffer.from(b).toString("base64url");

/* ---- a real certificate chain, as billing.mjs makes it */
const dir = mkdtempSync(join(tmpdir(), "be-ios-"));
const ossl = (...a) => { const r = spawnSync("openssl", a, { cwd: dir, encoding: "utf8" }); if (r.status !== 0) throw new Error("openssl " + a.join(" ") + ": " + r.stderr); return r.stdout; };
function chain(tag) {
  ossl("ecparam", "-name", "secp384r1", "-genkey", "-noout", "-out", `${tag}root.key`);
  ossl("req", "-x509", "-new", "-key", `${tag}root.key`, "-sha384", "-days", "3650", "-subj", `/CN=${tag} Test Root`, "-out", `${tag}root.pem`, "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign");
  writeFileSync(join(dir, `${tag}inter.ext`), "basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign\n1.2.840.113635.100.6.2.1=ASN1:NULL\n");
  ossl("ecparam", "-name", "secp384r1", "-genkey", "-noout", "-out", `${tag}inter.key`);
  ossl("req", "-new", "-key", `${tag}inter.key`, "-subj", `/CN=${tag} Test Intermediate`, "-out", `${tag}inter.csr`);
  ossl("x509", "-req", "-in", `${tag}inter.csr`, "-CA", `${tag}root.pem`, "-CAkey", `${tag}root.key`, "-CAcreateserial", "-sha384", "-days", "3650", "-extfile", `${tag}inter.ext`, "-out", `${tag}inter.pem`);
  writeFileSync(join(dir, `${tag}leaf.ext`), "basicConstraints=critical,CA:FALSE\n1.2.840.113635.100.6.11.1=ASN1:NULL\n");
  ossl("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", `${tag}leaf.key`);
  ossl("req", "-new", "-key", `${tag}leaf.key`, "-subj", `/CN=${tag} Test Signing`, "-out", `${tag}leaf.csr`);
  ossl("x509", "-req", "-in", `${tag}leaf.csr`, "-CA", `${tag}inter.pem`, "-CAkey", `${tag}inter.key`, "-CAcreateserial", "-sha256", "-days", "365", "-extfile", `${tag}leaf.ext`, "-out", `${tag}leaf.pem`);
  const der = f => { ossl("x509", "-in", f, "-outform", "DER", "-out", f + ".der"); return readFileSync(join(dir, f + ".der")); };
  const r = der(`${tag}root.pem`), i = der(`${tag}inter.pem`), l = der(`${tag}leaf.pem`);
  return { x5c: [l, i, r].map(b => b.toString("base64")), rootSha: createHash("sha256").update(r).digest("hex"), leafKey: createPrivateKey(readFileSync(join(dir, `${tag}leaf.key`))) };
}
const APPLE = chain("a");
const jws = payload => { const d = b64u(JSON.stringify({ alg: "ES256", x5c: APPLE.x5c })) + "." + b64u(JSON.stringify(payload));
  return d + "." + b64u(nodeSign("sha256", Buffer.from(d), { key: APPLE.leafKey, dsaEncoding: "ieee-p1363" })); };
let txSeq = 1;
/* a JWSTransactionDecodedPayload + JWSRenewalInfoDecodedPayload, signed */
function signedTx({ product = "premium_monthly", token, orig, days = 30, trial = false, env = "Sandbox", revoked = false } = {}) {
  const id = String(2000000000 + txSeq++), o = orig || id;
  const tx = { transactionId: id, originalTransactionId: o, bundleId: "com.lomonec.bemastery", productId: product, purchaseDate: NOW - 60e3, originalPurchaseDate: NOW - 60e3,
    expiresDate: NOW + days * DAY, type: "Auto-Renewable Subscription", inAppOwnershipType: "PURCHASED", environment: env, signedDate: NOW, appAccountToken: token, ...(trial ? { offerType: 1 } : {}), ...(revoked ? { revocationDate: NOW } : {}) };
  const ren = { originalTransactionId: o, autoRenewProductId: product, productId: product, autoRenewStatus: 1, environment: env, signedDate: NOW };
  return { signedTransaction: jws(tx), signedRenewalInfo: jws(ren), transactionId: id, originalTransactionId: o, productId: product };
}

/* ---- the Worker (staging-like: Sandbox) */
const db = new DatabaseSync(":memory:");
for (const m of readdirSync(new URL("../backend/entitlements/migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).sort()) db.exec(readFileSync(new URL("../backend/entitlements/migrations/" + m, import.meta.url), "utf8"));
const D1 = { prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; } };
const WENV = { DB: D1, FIREBASE_PROJECT_ID: "be-mastery", DEV_AUTH: "1", APPLE_BUNDLE_ID: "com.lomonec.bemastery", APPLE_ENVIRONMENTS: "Sandbox", APPLE_ROOT_SHA256: APPLE.rootSha, APP_ACCOUNT_SECRET: "s".repeat(40) };
const NET = { down: false };

const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
/* the fake BEStoreKit plugin — same names as BEStoreKitPlugin.swift */
const PLUGIN = ([eligible]) => {
  const sk = window.__sk = { calls: [], finished: [], listeners: [], owned: [], unfinished: [], next: "buy", eligible };
  const P = {
    getProducts: async ({ ids }) => { sk.calls.push("getProducts"); return { products: [
      /* mirrors mobile/ios/ios/App/App/BEMastery.storekit (owner, 6 Oct 2026): the
         3-day introductory offer is on BOTH plans, and Apple reports it only
         for an Apple ID that is still eligible (once per subscription group) */
      { id: "premium_monthly", title: "Premium (monthly)", description: "", displayPrice: "$4.99", price: 4.99, currencyCode: "USD", period: "P1M", ...(sk.eligible ? { trial: "P3D", trialEligible: true } : { trialEligible: false }) },
      { id: "premium_annual", title: "Annual Premium", description: "", displayPrice: "$24.99", price: 24.99, currencyCode: "USD", period: "P1Y", ...(sk.eligible ? { trial: "P3D", trialEligible: true } : { trialEligible: false }) }].filter(p => ids.includes(p.id)) }; },
    purchase: async ({ id, appAccountToken }) => { sk.calls.push("purchase:" + id);
      if (sk.next === "cancel") return { cancelled: true };
      if (sk.next === "pending") return { pending: true };
      const t = await window.__appleSign({ product: id, token: sk.tokenOverride || appAccountToken, trial: id === "premium_annual" && sk.eligible, days: id === "premium_annual" ? 365 : 30 });
      sk.owned = [t]; return t; },
    currentEntitlements: async () => { sk.calls.push("currentEntitlements"); return { items: sk.owned }; },
    restore: async () => { sk.calls.push("restore"); return { items: sk.owned }; },
    pendingTransactions: async () => { sk.calls.push("pendingTransactions"); return { items: sk.unfinished }; },
    finish: async ({ transactionId }) => { sk.finished.push(transactionId); },
    manageSubscriptions: async () => { sk.calls.push("manageSubscriptions"); },
    addListener: (ev, cb) => { if (ev === "transaction") sk.listeners.push(cb); return { remove() {} }; },
  };
  sk.emit = x => sk.listeners.forEach(cb => cb(x));
  /* THE REAL iOS BRIDGE SHAPE: Capacitor.Plugins.<jsName>. registerPlugin is an
     @capacitor/core API the unbundled shell does not have, so it is deliberately
     ABSENT here — inventing it is what hid the BEStoreKit bridge defect. */
  window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true,
    Plugins: { BEStoreKit: P }, PluginHeaders: [{ name: "BEStoreKit" }] };
};
async function open({ uid = null, eligible = true, track = "general-english", pre = null, vp = { width: 390, height: 844 } } = {}) {
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: "block" });
  await ctx.exposeFunction("__appleSign", o => signedTx(o));
  /* a STAGING iOS bundle, exactly as `npm run sync:staging` makes it: be-build.js
     routes the app to the staging Workers (served here by the local Worker) and turns billing on.
     A hand-set be_ent_api is ALSO planted, to prove the App Store shell ignores it. */
  await ctx.addInitScript(([s]) => { window.BE_BUILD = { env: "staging", flags: { billing_enabled: true } }; localStorage.setItem("be12_v1", s); localStorage.setItem("be_ent_api", "http://evil.test"); try { sessionStorage.setItem("be_prem_launch", "1"); } catch (e) {} }, [seed(track)]);
  await ctx.addInitScript(PLUGIN, [eligible]);
  if (pre) await ctx.addInitScript(pre);
  await ctx.route(u => /be-events|be-partner|be-polish|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const calls = [];
  await ctx.route("http://evil.test/**", r => { calls.push("EVIL"); r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ plan: "premium", paid: true, state: "active", ads: false, capabilities: { ad_free: true } }) }); });
  await ctx.route("https://be-entitlements-staging.nore-ngou.workers.dev/**", async r => {
    const q = r.request(), h = { ...q.headers() }; calls.push(q.method() + " " + new URL(q.url()).pathname);
    if (NET.down && /\/v1\/purchases\/verify/.test(q.url())) return r.abort("internetdisconnected");   /* Apple took the payment; only OUR answer is missing */
    const m = /^Bearer test-token-(.+)$/.exec(h.authorization || ""); if (m) { h["x-dev-user"] = m[1]; delete h.authorization; }
    const resp = await handle(new Request(q.url(), { method: q.method(), headers: h, body: ["GET", "HEAD"].includes(q.method()) ? undefined : q.postData() }), WENV, {});
    await r.fulfill({ status: resp.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await resp.text() });
  });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1400);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  if (uid) await p.evaluate(async uid => { FBUser = { uid, email: uid + "@test", getIdToken: async () => "test-token-" + uid }; await entRefresh(); await Billing.init(); await new Promise(r => setTimeout(r, 400)); }, uid);
  return { ctx, p, errs, calls };
}
const b = await chromium.launch();
const sheet = p => p.evaluate(() => { premiumOpen("t"); const o = document.getElementById("premOv"); const r = { text: o.innerText, plans: [...o.querySelectorAll(".prem-plan")].map(x => x.dataset.id), offer: (e => e ? e.innerText.replace(/\s+/g, " ").trim() : null)(o.querySelector(".prem-offer")), cta: (o.querySelector(".prem-cta") || {}).textContent, eula: !!o.querySelector('a[href*="apple.com/legal/internet-services/itunes/dev/stdeula"]'), privacy: !!o.querySelector('a[href="privacy.html"]') }; return r; });
const card = async p => { await p.evaluate(async () => { premClose(); go("data"); for (let i = 0; i < 60 && !document.querySelector("details.set-plan"); i++) await new Promise(r => setTimeout(r, 50)); }); await sleep(250);
  return p.evaluate(() => { const c = document.getElementById("subCard"); return c && !c.hidden ? { text: c.innerText, rows: Object.fromEntries([...c.querySelectorAll(".sub-dl > div")].map(d => [d.querySelector("dt").textContent, d.querySelector("dd").textContent])), manage: !!c.querySelector(".sub-manage") } : null; }); };

console.log("\n# the bridge and the store's products");
{
  const { ctx, p, errs, calls } = await open({ uid: "ia" });
  const st = await p.evaluate(() => ({ ios: IS_IOS_APP, provider: Billing.provider && Billing.provider.id, native: typeof window.BENativeBilling, keys: Object.keys(window.BENativeBilling || {}).sort().join(","), products: Billing.products.map(x => [x.id, x.price, x.period, x.trial || ""].join("|")) }));
  ok("I1 · inside the App Store shell the StoreKit provider is chosen, through the BEStoreKit plugin", st.ios && st.provider === "app_store" && st.native === "object", JSON.stringify(st));
  ok("I1b · a staging iOS bundle (BE_BUILD) reaches the STAGING entitlement Worker; a hand-set be_ent_api is ignored inside the App Store shell", await p.evaluate(() => entApiBase() === "https://be-entitlements-staging.nore-ngou.workers.dev") && !calls.includes("EVIL"), JSON.stringify(calls.slice(0, 4)));
  /* REGRESSION, 2 Oct 2026: beNativeBilling() used to demand
     Capacitor.registerPlugin, which Capacitor's native-bridge.js does not
     provide in this unbundled shell — StoreKit was dead on a real iPhone while
     this suite passed, because the stub invented that API. The stub now models
     the real shape and registerPlugin is absent, so these two pin it. */
  const shape = await p.evaluate(() => ({ reg: typeof window.Capacitor.registerPlugin,
    plugins: typeof window.Capacitor.Plugins, sk: typeof (window.Capacitor.Plugins || {}).BEStoreKit,
    viaHelper: typeof capPlugin("BEStoreKit") }));
  ok("I1c · the shell exposes Capacitor.Plugins.BEStoreKit and NO registerPlugin — the real shape",
    shape.reg === "undefined" && shape.plugins === "object" && shape.sk === "object", JSON.stringify(shape));
  ok("I1d · StoreKit is discovered through the repository's one helper, capPlugin",
    shape.viaHelper === "object" && st.native === "object", JSON.stringify(shape));
  ok("I2 · the bridge exposes the whole contract", st.keys === "currentEntitlements,finish,getProducts,manageSubscriptions,onTransaction,pendingTransactions,purchase,restore,supports", st.keys);
  ok("I3 · the App Store's own prices and ISO periods reach the app; the trial only as Apple reported it", st.products.includes("premium_monthly|$4.99|P1M|P3D") && st.products.includes("premium_annual|$24.99|P1Y|P3D"), JSON.stringify(st.products));
  const s = await sheet(p);
  /* two plans (tier spec, 5 Oct 2026): annual first, then the monthly Apple sells; both prices are Apple's */
  ok("I4 · the Premium sheet: both App Store plans, annual first at $24.99 / year with the 3-day trial leading it, monthly at $4.99; Apple's EULA and the privacy policy linked", s.plans.length === 2 && /\$24\.99/.test(s.text) && /\$4\.99/.test(s.text) && /3 days free/i.test(s.text) && /Start 3-day free trial/.test(s.cta) && s.eula && s.privacy && /App Store/.test(s.text), JSON.stringify({ plans: s.plans.length, cta: s.cta, eula: s.eula, privacy: s.privacy }));
  ok("I5 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
  const n = await open({ uid: "ib", eligible: false });
  const s2 = await sheet(n.p);
  ok("I6 · an Apple ID Apple says is NOT eligible for the introductory offer: no trial claimed anywhere, and the CTA does not promise one", !/free trial|days free/i.test(s2.text) && /Continue with Premium/.test(s2.cta), JSON.stringify({ cta: s2.cta, offer: s2.offer }));
  await n.ctx.close();
}

console.log("\n# purchase → the server's verdict → finish");
{
  const { ctx, p, errs, calls } = await open({ uid: "ic" });
  await p.evaluate(() => { __sk.next = "cancel"; }); await p.evaluate(() => Billing.buy("premium_monthly"));
  ok("P1 · the learner closes Apple's sheet: nothing is sent to the server, still Free", !calls.some(x => /verify/.test(x)) && await p.evaluate(() => !entIsPremiumForDisplay() && Billing.state === "ready"));
  await p.evaluate(() => { __sk.next = "pending"; }); await p.evaluate(() => Billing.buy("premium_monthly"));
  ok("P2 · Ask to Buy (pending): 'payment pending', still Free, nothing verified", !calls.some(x => /verify/.test(x)) && await p.evaluate(() => !entIsPremiumForDisplay() && /pending|confirms/i.test(Billing.note)), await p.evaluate(() => Billing.note));
  /* the introductory offer is on the ANNUAL plan now, so this is the purchase
     that carries the trial and must come back as state "trialing" */
  await p.evaluate(() => { __sk.next = "buy"; }); await p.evaluate(() => Billing.buy("premium_annual")); await sleep(600);
  const v = await p.evaluate(() => ({ v: entView(), finished: __sk.finished.slice(), owned: __sk.owned[0] && __sk.owned[0].transactionId }));
  ok("P3 · a purchase with the 3-day trial: the server verifies Apple's JWS and the account's appAccountToken → Premium, state trialing, source app_store", v.v.plan === "premium" && v.v.state === "trialing" && v.v.source === "app_store" && calls.includes("GET /v1/purchases/account-token") && calls.includes("POST /v1/purchases/verify"), JSON.stringify(v.v));
  ok("P4 · the transaction is finished only after the server answered", v.finished.includes(v.owned), JSON.stringify(v));
  const c = await card(p);
  ok("P5 · Subscription card: 'Premium · Annual', the store's '$24.99 / year', 'Billed by App Store', Manage subscription", c && c.rows["Current plan"] === "Premium · Annual" && c.rows["Price"] === "$24.99 / year" && c.rows["Billed by"] === "App Store" && c.manage, JSON.stringify(c));
  await p.evaluate(() => document.querySelector("#subCard .sub-manage").click());
  ok("P6 · Manage subscription opens Apple's own sheet (StoreKit showManageSubscriptions)", await p.evaluate(() => __sk.calls.includes("manageSubscriptions")));
  if (SHOTS) await p.locator("#subCard").screenshot({ path: SHOTS + "/ios-subscription-card.png" });
  /* a renewal delivered by Transaction.updates while the app is open */
  const tok = await p.evaluate(async () => (await (await fetch("https://be-entitlements-staging.nore-ngou.workers.dev/v1/purchases/account-token", { headers: { authorization: "Bearer test-token-ic" } })).json()).appAccountToken);
  const renewal = signedTx({ product: "premium_annual", token: tok, orig: v.v && (await p.evaluate(() => __sk.owned[0].originalTransactionId)), days: 365 });
  await p.evaluate(x => __sk.emit(x), renewal); await sleep(800);
  const r = await p.evaluate(() => ({ v: entView(), finished: __sk.finished.slice() }));
  ok("P7 · Transaction.updates (a change to annual) → sent to the server → the plan follows, and the update is finished", r.v.plan === "premium" && r.v.expiresAt > Date.now() + 300 * 864e5 && r.finished.includes(renewal.transactionId), JSON.stringify(r));
  ok("P8 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# offline, restore, launch, another account");
{
  let { ctx, p } = await open({ uid: "id" });
  NET.down = true; await p.evaluate(() => Billing.buy("premium_annual")); await sleep(400); NET.down = false;
  const o = await p.evaluate(() => ({ prem: entIsPremiumForDisplay(), finished: __sk.finished.length, note: Billing.note }));
  ok("O1 · our server unreachable after Apple took the payment: 'we'll confirm', NOT finished (StoreKit offers it again), still Free for now", !o.prem && o.finished === 0 && /confirm|could not|again/i.test(o.note), JSON.stringify(o));
  await ctx.close();
  const tok = await (async () => { const r = await handle(new Request("http://ent.test/v1/purchases/account-token", { headers: { "x-dev-user": "id" } }), WENV, {}); return (await r.json()).appAccountToken; })();
  const left = signedTx({ product: "premium_annual", token: tok, days: 365 });
  ({ ctx, p } = await open({ uid: "id", pre: ([x]) => { const t = setInterval(() => { if (window.__sk) { window.__sk.unfinished = [x]; clearInterval(t); } }, 1); }, }));
  await p.evaluate(x => { __sk.unfinished = [x]; }, left);
  await p.evaluate(() => { Billing.provider._listening = false; Billing.provider.listen(); }); await sleep(800);
  const l = await p.evaluate(() => ({ prem: entIsPremiumForDisplay(), finished: __sk.finished.slice(), calls: __sk.calls.slice() }));
  ok("O2 · next launch: the unfinished transaction is sent, the account becomes Premium, and it is finished", l.prem && l.finished.includes(left.transactionId) && l.calls.includes("pendingTransactions"), JSON.stringify(l));
  await ctx.close();
  ({ ctx, p } = await open({ uid: "ie" }));
  const tIe = await (async () => { const r = await handle(new Request("http://ent.test/v1/purchases/account-token", { headers: { "x-dev-user": "ie" } }), WENV, {}); return (await r.json()).appAccountToken; })();
  await p.evaluate(x => { __sk.owned = [x]; }, signedTx({ product: "premium_monthly", token: tIe, days: 20 }));
  await p.evaluate(() => Billing.restore()); await sleep(300);
  ok("O3 · Restore purchases: AppStore.sync, then the server re-verifies what this Apple ID owns → '1 restored', Premium", await p.evaluate(() => __sk.calls.includes("restore") && entIsPremiumForDisplay() && /1 restored/.test(Billing.note)), await p.evaluate(() => Billing.note));
  await ctx.close();
  ({ ctx, p } = await open({ uid: "if" }));
  await p.evaluate(t => { __sk.tokenOverride = t; }, tIe);   /* bought under ANOTHER account's appAccountToken */
  await p.evaluate(() => Billing.buy("premium_monthly")); await sleep(400);
  const x = await p.evaluate(() => ({ prem: entIsPremiumForDisplay(), note: Billing.note, finished: __sk.finished.length }));
  ok("O4 · a transaction carrying another account's appAccountToken is refused ('belongs to another BE Mastery account'), still Free, and finished (the answer is final)", !x.prem && /belongs to another BE Mastery account/.test(x.note) && x.finished === 1, JSON.stringify(x));
  await ctx.close();
  ({ ctx, p } = await open({ uid: "ig" }));
  const tIg = await (async () => { const r = await handle(new Request("http://ent.test/v1/purchases/account-token", { headers: { "x-dev-user": "ig" } }), WENV, {}); return (await r.json()).appAccountToken; })();
  await p.evaluate(x => __sk.emit(x), signedTx({ product: "premium_monthly", token: tIg, days: 20, env: "Production" })); await sleep(500);
  ok("O5 · a Production transaction at the Sandbox (staging) server is not accepted — the environments never mix", await p.evaluate(() => !entIsPremiumForDisplay()));
  await ctx.close();
}

console.log("\n# the plan follows the server while the app stays open");
{
  const { ctx, p, calls } = await open({ uid: "ik" });
  await p.evaluate(() => Billing.buy("premium_monthly")); await sleep(600);
  const before = await p.evaluate(() => entIsPremiumForDisplay());
  /* the server now says the plan ended (e.g. an EXPIRED / REFUND notification reached it while the app was open) */
  db.prepare("UPDATE entitlements SET status='revoked' WHERE uid=?").run("dev:ik");
  const n0 = calls.filter(x => x === "GET /v1/entitlement").length;
  await p.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); }); await sleep(500);
  const n1 = calls.filter(x => x === "GET /v1/entitlement").length;
  ok("R1 · back in the app within 5 minutes of the last check: the server is not asked again (no request storm)", before && n1 === n0, JSON.stringify({ before, n0, n1 }));
  await p.evaluate(() => { _entAskedAt = Date.now() - 6 * 60e3; document.dispatchEvent(new Event("visibilitychange")); }); await sleep(700);
  ok("R2 · back in the app later: the server is asked again and a revoked plan returns to Free without a relaunch", await p.evaluate(() => !entIsPremiumForDisplay() && entView().state === "revoked") && calls.filter(x => x === "GET /v1/entitlement").length === n1 + 1);
  db.prepare("UPDATE entitlements SET status='active' WHERE uid=?").run("dev:ik");
  await p.evaluate(() => entRefresh()); const back = await p.evaluate(() => entIsPremiumForDisplay());
  /* the learner opens Apple's sheet and cancels there; by the time it closes the server knows */
  db.prepare("UPDATE entitlements SET status='revoked' WHERE uid=?").run("dev:ik");
  await p.evaluate(() => { _entAskedAt = Date.now(); Billing.manage(); }); await sleep(700);
  ok("R3 · when Apple's Manage subscription sheet closes, the plan is asked again at once (not throttled)", back && await p.evaluate(() => __sk.calls.includes("manageSubscriptions") && !entIsPremiumForDisplay()));
  await ctx.close();
}

console.log("\n# account deletion and Welding");
{
  const { ctx, p } = await open({ uid: "ih" });
  await p.evaluate(() => Billing.buy("premium_annual")); await sleep(500);
  let asked = null;
  await p.evaluate(() => { FBauth = FBauth || {}; window.askConfirm = async o => { window.__asked = o; return false; }; });
  await p.evaluate(() => fbDeleteAccount()); asked = await p.evaluate(() => window.__asked && window.__asked.body);
  ok("D1 · deleting the account of a paying learner says the App Store subscription is NOT cancelled and where to cancel it", /does not cancel your BE Mastery Premium subscription\. Cancel it in the App Store/.test(asked || ""), asked);
  await ctx.close();
  const f = await open({ uid: "ii" });
  await f.p.evaluate(() => { FBauth = FBauth || {}; window.askConfirm = async o => { window.__asked = o; return false; }; });
  await f.p.evaluate(() => fbDeleteAccount());
  ok("D2 · a Free learner's deletion message is unchanged (no subscription line)", await f.p.evaluate(() => !/subscription/i.test(window.__asked.body)));
  await f.ctx.close();
  const w = await open({ uid: "ij", track: "welding" });
  const ws = await sheet(w.p);
  /* The same StoreKit product and the same sheet on either track — ONE
     subscription. What the sheet ADVERTISES follows the open track: the AI
     Coach is reached through Practice Partner, which is General English only,
     so Welding is sold the saved-video headroom its Premium really raises
     instead (premBenefitRows in index.html). This asserted /The AI Coach/ on
     Welding until 30 September 2026, which was the claim being corrected. */
  ok("W1 · Welding in the iOS app: the SAME Premium is offered — the same two App Store plans, the shared capabilities", /AI verdicts a day/.test(ws.text) && ws.plans.length === 2, JSON.stringify({ plans: ws.plans.length }));
  ok("W2 · …and it does not promise Welding the AI Coach, which Welding cannot reach", !/AI Coach/.test(ws.text) && /Save up to 100 Shadow videos/.test(ws.text), ws.text.replace(/\s+/g, " ").slice(0, 220));
  await w.ctx.close();
}

console.log("\n# signed out on the iPhone: the sheet starts billing itself (owner's phone, 6 Oct 2026)");
{
  /* no saved session = the sign-in SDK never loads = fbOnAuth never runs =
     Billing.init() never ran. The sheet used to say "Premium can't be bought on
     this device" (plugin_ok_no_products) to a learner who only had to sign in. */
  const { ctx, p, errs } = await open({ uid: null });
  const before = await p.evaluate(() => ({ ran: !!Billing._ran, provider: Billing.provider && Billing.provider.id }));
  await p.evaluate(() => premiumOpen("t")); await sleep(700);
  const s = await p.evaluate(() => { const o = document.getElementById("premOv"); return { provider: Billing.provider && Billing.provider.id, signin: !!o.querySelector(".prem-signin"), unavail: !!o.querySelector(".prem-unavail"), text: o.innerText.replace(/\s+/g, " ") }; });
  ok("SO1 · signed out, no init yet: opening Premium finds the App Store and asks to sign in — not 'can't be bought on this device'", !before.ran && s.provider === "app_store" && s.signin && !s.unavail && !/can't be bought|plugin_ok_no_products/.test(s.text), JSON.stringify({ before, ...s, text: s.text.slice(-160) }));
  await p.evaluate(async () => { premClose(); FBUser = { uid: "so1", email: "so1@test", getIdToken: async () => "test-token-so1" }; await entRefresh(); await Billing.init(); });
  const s2 = await sheet(p);
  ok("SO2 · after signing in, the same sheet shows both App Store plans", s2.plans.length === 2 && !/can't be bought/.test(s2.text), JSON.stringify({ plans: s2.plans }));
  ok("SO3 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
