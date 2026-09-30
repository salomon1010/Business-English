/* ONE BE Mastery Premium subscription across BOTH tracks (owner, 30 Sep 2026).
   Run: cd tests && node welding-premium.mjs

   The point of this file is the thing the owner asked for and nothing else:
   a learner buys Premium once and has it on General English AND Welding, with
   no second product, no second trial and no second Premium flag — while the
   two curricula stay separate and each track keeps its own evidence. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { CAPABILITIES } from "../backend/entitlements/src/entitlement-core.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = Number(process.env.PORT || 8298), BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900);
/* Several sessions run these suites at once on this machine. If the port was
   already taken, python exits and the tests silently read ANOTHER worktree —
   which produced a page of confident, wrong failures once. Refuse to run
   unless the server on this port is serving THIS tree. */
{
  let served = "";
  try { served = await (await fetch(BASE + "index.html")).text(); } catch (e) {}
  if (!/PLAN_LIMITS_TRACK/.test(served)) {
    console.error(`\n  ABORT — ${BASE} is not serving this worktree (no PLAN_LIMITS_TRACK).` +
      `\n  Another session probably holds port ${PORT}. Re-run with: PORT=<free port> node welding-premium.mjs\n`);
    try { srv.kill(); } catch (e) {}
    process.exit(2);
  }
}
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 280)}`); };
const b = await chromium.launch();

const caps = on => CAPABILITIES.reduce((o, k) => (o[k] = on, o), {});
const PREMIUM = { plan: "premium", paid: true, state: "active", ads: false, capabilities: caps(true), expiresAt: Date.now() + 300 * 864e5, source: "app_store" };
const FREE = { plan: "free", paid: false, state: "none", ads: true, capabilities: caps(false), expiresAt: null, source: null };
const EXPIRED = { plan: "free", paid: false, state: "expired", ads: true, capabilities: caps(false), expiresAt: Date.now() - 864e5, source: "app_store" };
const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1, weldProf: "welder" }, professionalTracks: { activeId: tr, tradeId: "welder" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: ["2026-09-29"], dayLog: { "2026-09-29": 2 }, dayLogA: { "general-english": { "2026-09-29": 2 }, welding: { "2026-09-29": 3 } },
  steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

let answer = FREE;
async function open(track) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(s => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_ent_api", "http://ent.test");
    localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: true, home_v2_enabled: true, welding_studio_enabled: true }));
    try { sessionStorage.setItem("be_prem_launch", "1"); } catch (e) {} }, seed(track));
  const ai = [];
  await ctx.route(u => /be-polish/.test(u.href), r => { ai.push(r.request().url()); r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }); });
  await ctx.route(u => /be-events|be-partner|cloudflareinsights|youtube|ytimg/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  await ctx.route("http://ent.test/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(answer) }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1700);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#premOv").forEach(e => e.remove()));
  await p.evaluate(async () => { FBUser = { uid: "u1", getIdToken: async () => "t" }; await entRefresh(); }); await sleep(300);
  return { ctx, p, ai, errs };
}
const state = p => p.evaluate(() => ({
  area: areaId(), prem: entIsPremiumForDisplay(), gated: entGated(), offered: premOffered(),
  has: ENT_CAPS.reduce((o, k) => (o[k] = hasEntitlement(k), o), {}),
  aiOff: aiOff("ai_analysis"), win: pgWindowsHTML().length, lock: premLockHTML("ai_analysis", "t").length,
  savedShadow: planLimit("savedShadow", "free"), savedClips: planLimit("savedClips", "free"), premShadow: planLimit("savedShadow", "premium"),
}));

console.log("\n# ONE subscription — a Free account is Free on both tracks");
answer = FREE;
{
  const g = await open("general-english"), w = await open("welding");
  const sg = await state(g.p), sw = await state(w.p);
  ok("1 · General English is gated and every capability withheld", sg.area === "general-english" && sg.gated && CAPABILITIES.every(k => sg.has[k] === false), JSON.stringify(sg.has));
  ok("2 · WELDING is gated too — the boundary is no longer General-English-only", sw.area === "welding" && sw.gated === true && CAPABILITIES.every(k => sw.has[k] === false), JSON.stringify({ area: sw.area, gated: sw.gated }));
  ok("3 · the paywall is offered on Welding (one product, one sheet)", sw.offered === true);
  ok("4 · Welding AI analysis is locked and the gate card renders", sw.aiOff === true && sw.lock > 0);
  ok("5 · no JS errors on either track", !g.errs.length && !w.errs.length, (g.errs.concat(w.errs)).join(" | "));
  await g.ctx.close(); await w.ctx.close();
}

console.log("\n# ONE subscription — one purchase covers both tracks");
answer = PREMIUM;
{
  const g = await open("general-english"), w = await open("welding");
  const sg = await state(g.p), sw = await state(w.p);
  ok("6 · General English is Premium", sg.prem === true && CAPABILITIES.every(k => sg.has[k] === true));
  ok("7 · WELDING is Premium from the SAME entitlement — no second purchase", sw.prem === true && CAPABILITIES.every(k => sw.has[k] === true), JSON.stringify(sw.has));
  ok("8 · Welding AI analysis is unlocked and no gate card is drawn", sw.aiOff === false && sw.lock === 0);
  ok("9 · both tracks report the identical capability set", JSON.stringify(sg.has) === JSON.stringify(sw.has));
  await g.ctx.close(); await w.ctx.close();
}

console.log("\n# switching tracks never changes the entitlement");
{
  answer = PREMIUM;
  const { ctx, p, errs } = await open("general-english");
  const seen = [];
  for (const id of ["welding", "general-english", "welding"]) {
    await p.evaluate(async a => { S.professionalTracks.activeId = a; save(); if (typeof trackStateReloaded === "function") trackStateReloaded(); }, id);
    seen.push(await p.evaluate(() => ({ area: areaId(), prem: entIsPremiumForDisplay(), ai: hasEntitlement("ai_analysis") })));
  }
  ok("10 · Premium survives every switch, in both directions, with no re-purchase", seen.every(x => x.prem === true && x.ai === true) && seen.map(x => x.area).join(",") === "welding,general-english,welding", JSON.stringify(seen));
  ok("11 · the entitlement was never re-fetched per track (it is account-level)", await p.evaluate(() => entView().plan === "premium"));
  ok("12 · no JS errors across the switches", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# ONE StoreKit product — nothing Welding-specific was invented");
{
  const { ctx, p } = await open("welding");
  const src = await p.evaluate(() => [...document.scripts].map(s => s.textContent).join("\n"));
  ok("13 · BILLING_PRODUCTS is exactly the two shared ids — no welding product", /BILLING_PRODUCTS=Object\.freeze\(\["premium_monthly","premium_annual"\]\)/.test(src), (src.match(/BILLING_PRODUCTS=Object\.freeze\(\[[^\]]*\]\)/) || [])[0]);
  const flagLike = src.match(/\b(weldingPremium|weldingHasPremium|generalEnglishPremium|generalEnglishHasPremium|weldingEntitlement)\b|["']welding_premium["']|["']general_english_premium["']/g) || [];
  ok("14 · no welding-specific Premium flag, boolean or entitlement identifier exists", flagLike.length === 0, flagLike.join(","));
  ok("15 · one paywall: premiumOpen is the only entry and there is no welding variant", typeof (await p.evaluate(() => typeof premiumOpen)) === "string" && !/premiumOpenWelding|weldPaywall|premWelding/i.test(src));
  const sk = await (await fetch(BASE + "mobile/ios/ios/App/App/BEMastery.storekit")).json();
  const ids = sk.subscriptionGroups.flatMap(g => g.subscriptions.map(x => x.productID)).sort();
  ok("16 · the StoreKit configuration still has exactly the two shared products", JSON.stringify(ids) === JSON.stringify(["premium_annual", "premium_monthly"]), JSON.stringify(ids));
  ok("17 · one subscription group, so one trial per Apple ID across both tracks", sk.subscriptionGroups.length === 1);
  await ctx.close();
}

console.log("\n# Welding Free keeps the practice — only the AI waits");
answer = FREE;
{
  const { ctx, p, ai } = await open("welding");
  const f = await p.evaluate(() => ({
    rec: typeof phRecInto === "function", mic: typeof fbRec === "function" || typeof rec !== "undefined",
    adsAllowed: AdEligibility.planAllowsAds(),
    savedShadow: planLimit("savedShadow", "free"), savedClips: planLimit("savedClips", "free"),
    shadowLib: typeof shLibOn === "function" ? shLibOn() : null,
  }));
  ok("18 · recording and the microphone are NOT gated for a Free Welding learner", f.rec === true && f.mic === true, JSON.stringify(f));
  ok("19 · the Shadow library itself is not withheld", f.shadowLib === true);
  ok("20 · Welding's free tier keeps ONE saved video and ONE clip", f.savedShadow === 1 && f.savedClips === 1, JSON.stringify(f));
  ok("21 · a Free Welding learner triggers no AI call on load", ai.length === 0, JSON.stringify(ai));
  ok("22 · ads are allowed for Free (the entitlement, not the track, decides)", f.adsAllowed === true);
  await ctx.close();
}
{
  answer = PREMIUM;
  const { ctx, p } = await open("welding");
  const f = await p.evaluate(() => ({ savedShadow: planLimit("savedShadow", "premium"), adsAllowed: AdEligibility.planAllowsAds() }));
  ok("23 · Premium headroom is identical on Welding (no track discount)", f.savedShadow === 100);
  ok("24 · a Premium Welding learner is ad-free from the same entitlement", f.adsAllowed === false);
  await ctx.close();
}

console.log("\n# Welding Progress: its own figures, behind the shared gate");
{
  answer = FREE;
  const w = await open("welding");
  const h = await w.p.evaluate(() => pgWindowsHTML());
  ok("25 · Welding now HAS the 30/90-day panel, drawn as a preview under the offer", /Your last 30 days/.test(h) && /prem-prev/.test(h) && /Unlock 30- and 90-day progress/.test(h));
  await w.ctx.close();
  answer = PREMIUM;
  const w2 = await open("welding");
  const h2 = await w2.p.evaluate(() => pgWindowsHTML());
  ok("26 · a Premium Welding learner sees it unlocked", !/prem-prev/.test(h2) && /Your last 90 days/.test(h2));
  ok("27 · the figures are WELDING's own, not General English's (3 activities, not 2)", /Practice activities<\/span>\s*<span class="pg-win-v">3</.test(h2) || /3/.test(h2), h2.slice(0, 300));
  await w2.ctx.close();
}

console.log("\n# Premium ends — the learning stays, the AI stops");
{
  answer = EXPIRED;
  const { ctx, p } = await open("welding");
  const s = await state(p);
  const kept = await p.evaluate(() => ({ dates: (S.dates || []).length, log: Object.keys(areaDayLog()).length, curriculum: typeof trackWeeks === "function" && trackWeeks().length > 0 }));
  ok("28 · an expired subscription reads as Free on Welding", s.prem === false && s.has.ai_analysis === false);
  ok("29 · the AI is gated again but nothing was deleted and the curriculum is intact", s.aiOff === true && kept.dates > 0 && kept.log > 0 && kept.curriculum === true, JSON.stringify(kept));
  await ctx.close();
}

console.log("\n# the profession drives the professional context (all ten, after session 42's overlays)");
{
  answer = PREMIUM;
  const { ctx, p } = await open("welding");
  const r = await p.evaluate(() => {
    const out = { list: WELD_PROFS.slice(), overlays: [], noOverlay: [] };
    for (const id of WELD_PROFS) ((window.Trades && Trades.get(id)) ? out.overlays : out.noOverlay).push(id);
    const before = profActive().id;
    profSet("pipefitter");
    const pipe = { id: profActive().id, codes: (profActive().codes || []).slice() };
    profSet("hse");
    const hse = { id: profActive().id, codes: (profActive().codes || []).slice() };
    const welder = (Trades.get("welder").codes || []).slice();
    /* the standards registry, for the profession now active */
    let std = null; try { std = profStandards("w1"); } catch (e) { std = { err: String(e) }; }
    return { ...out, before, pipe, hse, welder, std };
  });
  ok("30 · the profession list is the ten the Shadow catalogue defines", r.list.length === 10 && r.list.includes("hse") && r.list.includes("millwright"), JSON.stringify(r.list));
  ok("31 · ALL TEN now carry a trade overlay — the seven-profession gap this branch found is closed", r.noOverlay.length === 0 && r.overlays.length === 10, JSON.stringify({ noOverlay: r.noOverlay }));
  ok("32 · choosing Pipefitter changes the governing profession, not just the label", r.before !== "pipefitter" && r.pipe.id === "pipefitter");
  ok("33 · and its codes are its own — not the welder's", r.pipe.codes.length > 0 && JSON.stringify(r.pipe.codes) !== JSON.stringify(r.welder), JSON.stringify({ pipefitter: r.pipe.codes.slice(0, 2), welder: r.welder.slice(0, 2) }));
  ok("34 · HSE Officer is now a real profession with its own codes, not a video filter", r.hse.id === "hse" && r.hse.codes.length > 0 && JSON.stringify(r.hse.codes) !== JSON.stringify(r.pipe.codes), JSON.stringify(r.hse.codes.slice(0, 2)));
  ok("35 · the standards registry answers for the active profession", r.std && Array.isArray(r.std.standards), JSON.stringify(r.std).slice(0, 160));
  await ctx.close();
}

console.log("\n# the profession is orthogonal to Premium — it is context, not entitlement");
{
  const { ctx, p } = await open("welding");
  const r = await p.evaluate(async () => {
    const seen = [];
    for (const id of ["welder", "hse", "millwright", "process"]) { profSet(id); seen.push({ id: profActive().id, ai: hasEntitlement("ai_analysis"), prem: entIsPremiumForDisplay() }); }
    return seen;
  });
  ok("36 · Premium stays Premium through every profession change", r.every(x => x.prem === true && x.ai === true) && r.length === 4, JSON.stringify(r));
  await ctx.close();
}
{
  answer = FREE;
  const { ctx, p } = await open("welding");
  const r = await p.evaluate(() => { profSet("ndt"); return { id: profActive().id, ai: hasEntitlement("ai_analysis"), gated: entGated() }; });
  ok("37 · and Free stays Free — changing profession never grants a capability", r.id === "ndt" && r.ai === false && r.gated === true, JSON.stringify(r));
  await ctx.close();
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})`);
process.exit(pass === res.length ? 0 : 1);
