/* Phase 10 — Monetization QA matrix: the Premium card in every state, in
   five languages (incl. Arabic RTL, long German, Japanese), both themes and
   three widths. Run: cd tests && node monetization-qa.mjs

   Display-level: the store (Play's Digital Goods API + Payment Request) is
   stubbed in the page and each state is set the way the app sets it
   (Billing fields + billingTakeView), so every combination renders in one
   page. The purchase flow itself — against the real Worker — is
   billing-client.mjs.

   Checked in every render:
     no horizontal page overflow; the card inside the viewport; every button
     at least 44 px tall and its label not clipped; no raw i18n key or
     unfilled {{placeholder}}; Arabic laid out right-to-left; the note text
     readable against the card (WCAG AA 4.5:1); renewal terms and the
   Privacy link beside every offer (Apple 3.1.2 / Play); ads allowed exactly when the
     plan is not Premium; no JavaScript error. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = 8097, BASE = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const srv = process.env.BASE ? null : spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
if (srv) await sleep(800);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

const LANGS = ["en", "fr", "ar", "de", "ja"];
const WIDTHS = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 800 }];
const THEMES = ["dark", "light"];
const STATES = ["billing_off", "signed_out", "ready", "pending_verify", "cancelled_own", "grace_own", "elsewhere"];

const seed = JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {} } }, days: {}, dates: [], rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
const PLAY_STUB = () => {
  window.__play = { details: [{ itemId: "premium_monthly", title: "Premium (monthly)", price: { currency: "EUR", value: "4.49" } }, { itemId: "premium_annual", title: "Premium (annual)", price: { currency: "EUR", value: "29.99" } }], owned: [] };
  window.getDigitalGoodsService = async m => { if (m !== "https://play.google.com/billing") throw new Error("unsupported"); return { getDetails: async ids => __play.details.filter(d => ids.includes(d.itemId)), listPurchases: async () => __play.owned.slice() }; };
  window.PaymentRequest = class { async show() { throw new DOMException("x", "AbortError"); } };
};

/* sets one state the way the app would, then redraws App Setup with the plan section open */
const SET = async (state) => {
  const D = 864e5, now = Date.now();
  const FREE = { plan: "free", state: "none" };
  const PREM = o => ({ plan: "premium", paid: true, state: "active", ads: false, capabilities: { ad_free: true }, expiresAt: now + 20 * D, startedAt: now - 10 * D, ...o });
  const user = { uid: "qa", getIdToken: async () => "x" };
  Billing._uid = null; Billing.note = ""; Billing.state = "idle";
  if (state === "billing_off") { localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: false })); Billing.provider = null; FBUser = user; billingTakeView(FREE); }
  else {
    localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: true }));
    Billing.provider = BillingProviders.play; await BillingProviders.play.available();
    Billing.products = await BillingProviders.play.products();
    if (state === "signed_out") { FBUser = null; _entView = null; }
    else { FBUser = user; Billing._uid = "qa"; Billing.state = "ready"; }
    if (state === "ready") billingTakeView(FREE);
    if (state === "pending_verify") { billingTakeView(FREE); Billing.state = "failed"; Billing.note = t("acc.prem_pending_verify"); }
    if (state === "cancelled_own") billingTakeView(PREM({ source: "google_play", renews: false }));
    if (state === "grace_own") billingTakeView(PREM({ source: "google_play", state: "grace", renews: true }));
    if (state === "elsewhere") billingTakeView(PREM({ source: "app_store", renews: true }));
  }
  go("data");
  for (let i = 0; i < 40 && !document.querySelector("details.set-plan"); i++) await new Promise(r => setTimeout(r, 25));
  await new Promise(r => setTimeout(r, 60));
  const d = document.querySelector("details.set-plan"); if (d) d.open = true;
  const el = document.getElementById("entPlan"); if (el) el.outerHTML = entPlanCardHTML();
};

/* everything measured on one render */
const MEASURE = () => {
  const c = document.getElementById("entPlan"); if (!c) return { missing: true };
  const r = c.getBoundingClientRect(), W = innerWidth;
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([R, G, B]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(R) + .7152 * f(G) + .0722 * f(B); };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const b = rgb(getComputedStyle(e).backgroundColor); if (b.length && (b.length < 4 || b[3] > .9)) return b.slice(0, 3); } return [0, 0, 0]; };
  const contrast = el => { const f = rgb(getComputedStyle(el).color).slice(0, 3), b = bgOf(el); const [x, y] = [lum(f), lum(b)].sort((a, b) => b - a); return (x + .05) / (y + .05); };
  const buttons = [...c.querySelectorAll("button")].map(b => { const br = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 40), h: br.height, clip: b.scrollWidth > b.clientWidth + 1, inside: br.left >= r.left - .5 && br.right <= r.right + .5 }; });
  const notes = [...c.querySelectorAll(".sub")].map(contrast);
  return {
    text: c.textContent.replace(/\s+/g, " ").trim(),
    overflow: document.documentElement.scrollWidth > W + 1,
    inView: r.left >= -.5 && r.right <= W + .5,
    buttons, minNote: notes.length ? Math.min(...notes) : 99,
    dir: getComputedStyle(c).direction,
    adsAllowed: AdEligibility.planAllowsAds(), prem: entIsPremiumForDisplay(),
    manage: !!c.querySelector("[onclick='Billing.manage()']"), buys: c.querySelectorAll(".ent-buy").length,
    signin: !!c.querySelector("[onclick='fbOpenModal()']"), restore: !!c.querySelector("[onclick='Billing.restore()']"),
    terms: !!c.querySelector(".ent-terms a[href='privacy.html']") && /Google Play/.test((c.querySelector(".ent-terms") || {}).textContent || ""),
  };
};

/* what each state must show — independent of language */
const SHAPE = {
  billing_off: m => !m.buys && !m.restore && !m.manage && !m.signin && !m.prem && !m.terms,
  signed_out: m => m.signin && !m.buys && !m.restore && !m.terms,
  ready: m => m.buys === 2 && m.restore && !m.manage && m.terms,        /* renewal terms + Privacy beside every offer */
  pending_verify: m => m.buys === 2 && m.restore && m.terms,
  cancelled_own: m => m.prem && m.manage && !m.buys && !m.terms,
  grace_own: m => m.prem && m.manage && !m.buys && !m.terms,
  elsewhere: m => m.prem && !m.manage && !m.buys && !m.terms && /App Store/.test(m.text),
};

const b = await chromium.launch();
const ctx = await b.newContext({ serviceWorkers: "block" });
await ctx.addInitScript(s => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_ent_api", "http://ent.test"); }, seed);
await ctx.addInitScript(PLAY_STUB);
await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights|ent\.test/.test(u.href), r => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(BASE + "index.html"); await sleep(1500);
await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));

let renders = 0;
for (const lang of LANGS) {
  await p.evaluate(async l => { await setLang(l); }, lang); await sleep(300);
  for (const vp of WIDTHS) {
    await p.setViewportSize(vp);
    for (const theme of THEMES) {
      await p.evaluate(th => setTheme(th), theme);
      const bad = [];
      for (const st of STATES) {
        await p.evaluate(SET, st);
        const m = await p.evaluate(MEASURE); renders++;
        const why = [];
        if (m.missing) why.push("no card");
        else {
          if (m.overflow) why.push("page overflows");
          if (!m.inView) why.push("card outside viewport");
          for (const x of m.buttons) { if (x.h < 44) why.push(`button <44px "${x.t}" ${x.h.toFixed(0)}`); if (x.clip) why.push(`label clipped "${x.t}"`); if (!x.inside) why.push(`button outside card "${x.t}"`); }
          if (/acc\.prem|\{\{/.test(m.text)) why.push("raw key/placeholder: " + m.text.match(/(acc\.prem\S*|\{\{\w+\}\})/)[0]);
          if (lang === "ar" && m.dir !== "rtl") why.push("not RTL");
          const SCRIPT = { ar: /[\u0600-\u06FF]/, ja: /[\u3040-\u30FF\u4E00-\u9FFF]/, fr: /[àâçéèêëîïôûùüÿœ]/i };
          if (SCRIPT[lang] && !SCRIPT[lang].test(m.text)) why.push("card not in " + lang + ": " + m.text.slice(0, 60));
          if (m.minNote < 4.5) why.push("note contrast " + m.minNote.toFixed(2));
          if (m.adsAllowed === m.prem) why.push(`ads ${m.adsAllowed ? "allowed" : "blocked"} while ${m.prem ? "Premium" : "Free"}`);
          if (!SHAPE[st](m)) why.push("wrong controls: " + JSON.stringify({ buys: m.buys, restore: m.restore, manage: m.manage, signin: m.signin, prem: m.prem }));
        }
        if (why.length) bad.push(st + ": " + why.join("; "));
      }
      ok(`${lang} · ${vp.width}px · ${theme}: ${STATES.length} states render correctly`, !bad.length, bad.join(" | "));
    }
  }
}
ok(`no JavaScript errors across ${renders} renders`, !errs.length, errs.slice(0, 3).join(" | "));

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed (${renders} renders)`);
process.exit(pass === res.length ? 0 : 1);
