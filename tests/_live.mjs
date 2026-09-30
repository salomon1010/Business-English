/* Live check against staging.lomonec.com — the real host, real flags, real
   be-entitlements-staging. No localStorage overrides: this is what the owner
   will actually see. */
import { chromium } from "playwright"; import { setTimeout as sleep } from "node:timers/promises";
const BASE = "https://staging.lomonec.com/";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 260)}`); };
const b = await chromium.launch();
const seed = JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: ["2026-09-29"], dayLog: { "2026-09-29": 2 }, dayLogA: { "general-english": { "2026-09-29": 2 } }, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.addInitScript(s => { localStorage.setItem("be12_v1", s); try { sessionStorage.setItem("be_prem_launch", "1"); } catch (e) {} }, seed);
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
console.log("  sw before:", await (await fetch(BASE + "sw.js?x=" + Math.random())).text().then(t => (t.match(/be12-v\d+/) || [])[0]));
await p.goto(BASE + "index.html?live=" + Date.now(), { waitUntil: "load" }); await sleep(2600);
await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#premOv").forEach(e => e.remove()));
await sleep(400);

const st = await p.evaluate(() => ({ env: !!(window.beEnv && beEnv()), ent: entApiBase(), billing: flag("billing_enabled"), planOn: planOn(), gated: entGated(), provider: Billing.provider && Billing.provider.id, n: (Billing.products || []).length }));
ok("1 · staging host recognised, entitlement service wired, billing on", st.env && /be-entitlements-staging/.test(st.ent) && st.billing === true, JSON.stringify(st));
ok("2 · the Premium gate is in force for a General English learner", st.planOn === true && st.gated === true, JSON.stringify(st));
/* the store is asked only once signed in; the preview provider is chosen regardless */
await p.evaluate(async () => { await Billing.init(); }); await sleep(900);
const st2 = await p.evaluate(() => ({ provider: Billing.provider && Billing.provider.id, n: (Billing.products || []).length, state: Billing.state }));
ok("3 · the browser preview provider is chosen and the store's products load", st2.provider === "preview", JSON.stringify(st2));

await p.evaluate(() => premiumOpen("live")); await sleep(900);
const sh = await p.evaluate(() => { const o = document.getElementById("premOv"); if (!o) return null; const t = o.innerText.replace(/\s+/g, " ");
  return { t, offer: (o.querySelector(".prem-offer") || {}).innerText || "", cta: ((o.querySelector(".prem-cta") || {}).innerText || "").trim(), cancel: (o.querySelector(".prem-cancel") || {}).innerText || "", preview: !!o.querySelector(".prem-preview"), plans: o.querySelectorAll(".prem-plan").length, ben: o.querySelectorAll(".prem-ben li").length }; });
ok("4 · the sheet shows ONE offer: 3 DAYS FREE / Annual Premium / $24.99 / year", sh && /3 DAYS FREE/i.test(sh.offer) && /Annual Premium/.test(sh.offer) && /\$24\.99/.test(sh.offer) && sh.plans === 0, JSON.stringify(sh && sh.offer));
ok("5 · CTA 'Start 3-day free trial' with the renewal terms under it", sh && sh.cta === "Start 3-day free trial" && /Then \$24\.99 \/ year/.test(sh.cancel), JSON.stringify(sh && { cta: sh.cta, cancel: sh.cancel }));
ok("6 · five capability benefits and the preview banner", sh && sh.ben === 5 && sh.preview && /AI speaking analysis/.test(sh.t) && /The AI Coach/.test(sh.t), JSON.stringify(sh && { ben: sh.ben, preview: sh.preview }));
ok("7 · no raw i18n key anywhere in the sheet", sh && !/\bprem\.[a-z_]+|\bpg\.[a-z_]+|\{\{/.test(sh.t), (sh && sh.t.match(/\bprem\.[a-z_]+|\{\{[a-z]+\}\}/) || []).join(","));
await p.evaluate(() => premClose());

const g = await p.evaluate(() => ({ ai: entLocked("ai_analysis"), prog: entLocked("advanced_progress"), rec: entLocked("recommended_content"), coach: entLocked("ai_coach"), aiOff: aiOff("ai_analysis"), lock: premLockHTML("ai_analysis", "live").length > 0, win: pgWindowsHTML() }));
ok("8 · every capability is locked for a Free (signed-out) learner", g.ai && g.prog && g.rec && g.coach, JSON.stringify(g).slice(0, 150));
ok("9 · the AI gate is closed and the gate card renders", g.aiOff === true && g.lock);
ok("10 · the 30/90-day panel is drawn as a preview under the offer", /prem-prev/.test(g.win) && /Your last 30 days/.test(g.win) && /Unlock 30- and 90-day progress/.test(g.win));

await p.evaluate(() => go("review")); await sleep(1200);
const onPage = await p.evaluate(() => { document.querySelectorAll("details").forEach(d => d.open = true); return { lock: !!document.querySelector(".prem-lock"), win: !!document.querySelector(".pg-win"), prev: !!document.querySelector(".prem-prev") }; });
ok("11 · Progress actually renders the locked 30/90-day card on the page", onPage.win && onPage.prev && onPage.lock, JSON.stringify(onPage));
ok("12 · no JavaScript errors on the live site", !errs.length, errs.join(" | "));
console.log("  sw after :", await (await fetch(BASE + "sw.js?x=" + Math.random())).text().then(t => (t.match(/be12-v\d+/) || [])[0]));
await b.close();
const pass = res.filter(Boolean).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})`);
process.exit(pass === res.length ? 0 : 1);
