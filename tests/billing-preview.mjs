/* The staging PREVIEW billing provider in a real browser (owner, 4 Oct 2026:
   "Premium can't be bought on this device yet … no_store" on staging in Chrome).
   Chrome defines window.getDigitalGoodsService on every page (Android, ChromeOS),
   so its mere presence used to make the preview refuse — as if the page were the
   Play app — while the Play provider's own probe correctly rejected outside a
   TWA. No provider was left and the production message appeared on staging.
   The preview now ASKS the API: it resolves only inside a Play-billed TWA.
   Run: cd tests && node billing-preview.mjs      (PORT=nnnn for another port) */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8798), BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await chromium.launch();
const seed = JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

/* dgs: "reject" = a plain Chrome tab (the API exists, the call fails) · "none" = a browser without it · "twa" = inside the Play app */
async function open({ dgs, preview = true }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, preview]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_ent_api", "http://ent.test"); localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: true, billing_preview_provider: preview })); }, [seed, preview]);
  await ctx.addInitScript(dgs => {
    if (dgs === "none") return;
    window.__dgsAsked = 0;
    window.getDigitalGoodsService = async m => { window.__dgsAsked++; if (dgs === "reject" || m !== "https://play.google.com/billing") throw new DOMException("not in a TWA", "NotSupportedError");
      return { getDetails: async () => [{ itemId: "premium_annual", title: "Annual Premium", price: { currency: "USD", value: "24.99" }, subscriptionPeriod: "P1Y" }], listPurchases: async () => [] }; };
    window.PaymentRequest = class { async show() { throw new DOMException("closed", "AbortError"); } };
  }, dgs);
  await ctx.route(u => /be-events|be-partner|be-polish|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  await ctx.route("http://ent.test/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ plan: "free", capabilities: [] }) }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1200);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,#fndCheckOv").forEach(e => e.remove()));
  await p.evaluate(async () => { await Billing.init(); });   /* signed out: the store is still looked up, as at boot (same as premium-acquisition.mjs) */
  await p.evaluate(() => premiumOpen("test")); await sleep(1800);
  const s = await p.evaluate(() => { const o = document.getElementById("premOv"); const t = o ? o.innerText : "";
    return { open: !!o, provider: Billing.provider ? Billing.provider.id : null, state: Billing.state, preview: !!(o && o.querySelector(".prem-preview")), unavail: !!(o && o.querySelector(".prem-unavail")), noStore: /no_store/.test(t), price: /24\.99/.test(t), asked: window.__dgsAsked || 0, text: t.slice(0, 200) }; });
  await ctx.close(); return { ...s, errs };
}

const a = await open({ dgs: "reject" });
ok("1 · a plain Chrome tab (the Play API exists but rejects): the preview provider wins, the offer is listed with its price and the 'preview' notice, no 'can't be bought' card, no reason code", a.open && a.provider === "preview" && a.preview && a.price && !a.unavail && !a.noStore && a.asked >= 1, JSON.stringify(a));
const n = await open({ dgs: "none" });
ok("2 · a browser without the Play API (desktop, Safari): the preview provider, same offer", n.open && n.provider === "preview" && n.preview && n.price && !n.unavail, JSON.stringify(n));
const t = await open({ dgs: "twa" });
ok("3 · inside the Play app (the API resolves): the REAL Play provider wins and the preview stays out (signed out, so the store is not asked for prices yet — the sheet asks to sign in)", t.open && t.provider === "google_play" && !t.preview && !t.unavail && !t.noStore, JSON.stringify(t));
const off = await open({ dgs: "reject", preview: false });
ok("4 · with the preview flag off (production), a plain browser gets the honest card — Premium is bought in the store app — and the reason code no_store under it", off.open && off.provider === null && off.unavail && off.noStore && !off.price, JSON.stringify(off));
ok("5 · no JavaScript errors", [a, n, t, off].every(x => !x.errs.length), JSON.stringify([a, n, t, off].flatMap(x => x.errs)));

await b.close(); srv.kill();
const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
