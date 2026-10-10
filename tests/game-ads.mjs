/* Ads in the game hubs — Welding Mastery AND English Mastery (owner, 10 Oct 2026).
   Run: cd tests && node game-ads.mjs        (PORT=… for a free port)

   The mock provider (flags ads_enabled + ads_mock_provider, honoured on localhost) draws a
   labelled TEST card where a real network would. Checks: a native slot at the foot of every
   hub tab and one mid-page on the long tabs, on BOTH programmes; nothing while a round is in
   play; a banner on the end screen; the full-screen break after a finished round with its own
   looser caps (4 min / 6 an hour) and every other break untouched (8 min / 3); Welding's OTHER
   pages stay ad-free; Premium removes everything; ads off = nothing. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8791);
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 400)}`); };
const b = await chromium.launch();
async function open(tr, { ads = true, premium = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([tr, ads]) => { localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "A", lang: "en", ts: 1 }, professionalTracks: { activeId: tr }, fnd: { [tr]: { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, backupAsked: 1 }));
    localStorage.setItem("be_flags", JSON.stringify({ english_mastery_enabled: true, welding_mastery_enabled: true, ads_enabled: ads, ads_mock_provider: ads })); }, [tr, ads]);
  const view = { day: new Date().toISOString().slice(0, 10), plan: "free", energy: { used: 0, limit: null }, xp: { total: 0, today: 0, dayCap: 600 }, daily: { done: false } };
  await ctx.route(u => /be-polish/.test(u.href), r => { let body = {}; try { body = JSON.parse(r.request().postData() || "{}"); } catch (e) {} const w = body.wm || {};
    return r.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify(w.op === "start" ? { ok: true, ticket: "t:" + w.sid, ...view } : { ok: true, awarded: 12, ...view }) }); });
  await ctx.route(u => /be-events|be-partner|cloudflareinsights|entitlements|gstatic\.com\/firebasejs/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`); await sleep(1700);
  await p.evaluate(([premium]) => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,.lang-modal-ov,#fndCheckOv,#coachSummary").forEach(e => e.remove());
    AD_BOOT = Date.now() - 10 * 60e3; FBUser = { uid: "u", getIdToken: async () => "t" }; if (premium) window.entIsPremiumForDisplay = () => true; }, [premium]);
  return { ctx, p, errs };
}
const reset = p => p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem("be_ad_log"); _adNative = {}; document.querySelectorAll("[data-ad-slot]").forEach(e => e.remove()); });
const slots = (p, sel) => p.evaluate(s => document.querySelectorAll(s + " [data-ad-slot]").length, sel);

for (const [tr, view, ui, name] of [["general-english", "english", "EMUI", "English Mastery"], ["welding", "mastery", "WMUI", "Welding Mastery"]]) {
  console.log(`\n# ${name}`);
  const { ctx, p, errs } = await open(tr);
  await p.evaluate(v => go(v, "home"), view); await sleep(900);
  await p.evaluate(ui => window[ui]._load(), ui); await sleep(300);
  const per = {};
  for (const tab of ["home", "games", "journey", "coll", "rewards", "hist", "perf"]) {
    await reset(p);
    await p.evaluate(([ui, t]) => window[ui]._act("tab", t), [ui, tab]); await sleep(900);
    per[tab] = await p.evaluate(v => ({ foot: document.querySelectorAll(`#v-${v} .wm-ad-foot [data-ad-slot]`).length, mid: document.querySelectorAll(`#v-${v} .wm-ad-mid [data-ad-slot]`).length, label: /Ad|TEST/i.test((document.querySelector(`#v-${v} .wm-ad-foot [data-ad-slot]`) || {}).textContent || "") }), view);
  }
  ok(`${name} · A1 · a labelled ad at the foot of every hub tab (7 of 7)`, Object.values(per).every(x => x.foot === 1 && x.label), JSON.stringify(per));
  ok(`${name} · A2 · a second, mid-page ad on the long tabs (Games, Journey, Collection, Rewards)`, ["games", "journey", "coll", "rewards"].every(t => per[t].mid === 1), JSON.stringify(per));
  /* a round in play: no ad; the end screen: a banner under the actions */
  await reset(p);
  await p.evaluate(ui => window[ui]._start("cards", { n: 5 }), ui); await sleep(900);
  ok(`${name} · A3 · while a round is in play nothing is drawn over it or inside it`, await p.evaluate(() => !document.querySelector("#wmGame [data-ad-slot],#emGame [data-ad-slot],#adOv") && AdEligibility.decide("native", "game_hub").reason === "protected:game"));
  for (let i = 0; i < 8; i++) { const more = await p.evaluate(async ui => { const G = window[ui]._game(); if (!G || G.done) return false; const q = s => document.querySelector(s); if (q('[data-wm="flip"],[data-em="flip"]')) q('[data-wm="flip"],[data-em="flip"]').click(); await new Promise(r => setTimeout(r, 120)); const r = q('.wm-rate-b[data-a="2"]'); if (r) r.click(); await new Promise(r => setTimeout(r, 120)); return true; }, ui); if (!more) break; }
  await sleep(900);
  const end = await p.evaluate(() => { const e = document.querySelector("#wmGame .wm-ad-end [data-ad-slot],#emGame .wm-ad-end [data-ad-slot]"); if (!e) return null; const r = e.getBoundingClientRect(), btn = [...document.querySelectorAll("#wmGame .wm-end .btn,#emGame .wm-end .btn")].map(x => x.getBoundingClientRect()); return { gap: Math.round(r.top - Math.max(...btn.map(x => x.bottom))) }; });
  ok(`${name} · A4 · the end screen carries a banner, below the buttons and clear of them`, end && end.gap >= 12, JSON.stringify(end));
  await p.evaluate(ui => window[ui]._act("gclose"), ui); await sleep(1600);
  ok(`${name} · A5 · leaving the finished round shows the full-screen break (game_complete)`, await p.evaluate(() => !!document.getElementById("adOv")));
  await p.evaluate(() => { const o = document.getElementById("adOv"); if (o) o.remove(); });
  const caps = await p.evaluate(() => { const now = Date.now(); return { game3: AdEligibility.capReason("interstitial", now + 3 * 60e3, "game_complete"), game5: AdEligibility.capReason("interstitial", now + 5 * 60e3, "game_complete"), lesson5: AdEligibility.capReason("interstitial", now + 5 * 60e3, "lesson_complete") }; });
  ok(`${name} · A6 · its own caps: 4 minutes apart for game rounds; every other break still 8`, caps.game3 === "cap:gap" && caps.game5 === null && caps.lesson5 === "cap:gap", JSON.stringify(caps));
  ok(`${name} · A7 · no page errors`, errs.length === 0, errs.join(" | "));
  if (tr === "welding") {
    await reset(p);
    await p.evaluate(() => go("home")); await sleep(1200); await p.evaluate(() => go("review")); await sleep(1200);
    const w = await p.evaluate(() => ({ slots: document.querySelectorAll("#v-home [data-ad-slot],#v-review [data-ad-slot]").length, home: AdEligibility.decide("native", "home_feed").reason, lesson: AdEligibility.decide("interstitial", "lesson_complete").reason, any: adsTrackAllows() }));
    ok("Welding · A8 · every OTHER Welding page stays ad-free (Home, Progress, lessons): refused for the programme", w.slots === 0 && w.home === "track" && w.lesson === "track" && w.any === false, JSON.stringify(w));
    ok("Welding · A9 · with Welding Mastery off, its placements are refused too (nothing on Welding at all)", await p.evaluate(() => { const real = WMUI.on; WMUI.on = () => false; const r = { track: adsTrackAllows("game_hub"), d: AdEligibility.decide("native", "game_hub").reason }; WMUI.on = real; return r.track === false && r.d === "track"; }));
  }
  await ctx.close();
}

console.log("\n# Premium and ads off");
{
  const { ctx, p } = await open("welding", { premium: true });
  await p.evaluate(() => go("mastery", "games")); await sleep(1200); await p.evaluate(() => WMUI._act("tab", "games")); await sleep(900);
  ok("P1 · Premium (Welding Mastery): no ad in the hub", await slots(p, "#v-mastery") === 0 && await p.evaluate(() => AdEligibility.decide("native", "game_hub").reason === "premium"));
  await ctx.close();
  const o = await open("general-english", { ads: false });
  await o.p.evaluate(() => go("english", "games")); await sleep(1200); await o.p.evaluate(() => EMUI._act("tab", "games")); await sleep(900);
  ok("P2 · ads switched off (production today): no slot, no ad", await slots(o.p, "#v-english") === 0 && await o.p.evaluate(() => AdEligibility.decide("native", "game_hub").reason === "flag_off"));
  await o.ctx.close();
}
await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
