/* THE TWO-APP SPLIT — one codebase, two store apps (owner, 12 Oct 2026).
   Run: cd tests && node app-split.mjs          (PORT=… BASE=… as usual)

   BE Mastery ships as "BE Mastery — General English" and "BE Mastery — Welding
   English". A store bundle carries be-build.js {track:"<id>"}, index.html reads
   it as BE_APP_TRACK, and that one value pins areaId() — the single question
   every feature asks about the programme. This suite is the evidence that the
   separation is real and not a hidden tab:

     §1 the app opens in its own programme, whatever the state says
     §2 the other programme cannot be selected, switched to or onboarded into
     §3 the other programme's VIEWS are refused by the router — typed hash,
        restored view, deep link, widget tap
     §4 tampering (localStorage, the synced state, the context, a client flag)
        cannot move the app
     §5 the cross-programme UI is not drawn
     §6 the unsplit web build is unchanged — both programmes, as today
     §7 Premium, ads and the analytics boundary still follow the programme
     §8 the BUILT bundles carry only their own programme's content

   Nothing here needs a network: every Worker call is routed to a 404. */
import { chromium } from "playwright"; import { spawn, spawnSync } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { existsSync, readdirSync, readFileSync, mkdtempSync, rmSync } from "node:fs"; import { resolve } from "node:path"; import { tmpdir } from "node:os";

const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8231);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };

const b = await chromium.launch();
/* A learner who is well past onboarding, with BOTH programmes placed, so no
   gate card or placement dialog stands in front of what is being checked. */
const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr, tradeId: "welder" },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

/* `build` is the programme the BUNDLE is pinned to (null = the web app).
   `stateTrack` is what the device's saved state says — deliberately the OTHER
   programme in most checks, because that is the tampering case. */
async function open(build, stateTrack, { hash = "", view = null, onboard = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(({ build, s, view }) => {
    if (build) window.BE_BUILD = { track: build };
    if (s) localStorage.setItem("be12_v1", s);
    if (view) sessionStorage.setItem("be_view", view);
    localStorage.setItem("be_partner_api", "http://partner.test");
    localStorage.setItem("be_flags", JSON.stringify({ practice_partner_enabled: true, web_visitor_gate_enabled: false }));
  }, { build, s: onboard ? null : seed(stateTrack), view });
  await ctx.route(u => /be-events|be-polish|be-partner|be-push|be-coach|be-widget|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube|entitlements|partner\.test/.test(u.href),
    r => r.fulfill({ status: 404, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html" + hash); await sleep(1600);
  if (!onboard) await p.evaluate(() => document.querySelectorAll("#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p, errs };
}
/* every answer the app gives about its programme */
const facts = p => p.evaluate(() => ({
  appTrack: window.BE_APP_TRACK, area: areaId(), ctxTrack: ProfessionalTrackContext.active().id, ge: isGeneralEnglish(),
  saved: S.professionalTracks && S.professionalTracks.activeId, dataTrack: document.documentElement.getAttribute("data-track"),
  offered: ProfessionalTrackContext.all().map(x => x.id),
  pp: typeof ppAvailable === "function" && ppAvailable(), sv: svOn(), weld: typeof weldStudioOn === "function" && weldStudioOn(),
  wm: !!(window.WMUI && WMUI.on()), em: !!(window.EMUI && EMUI.on()), adsTrack: adsTrackAllows("home_feed"),
  cur: (typeof cur !== "undefined" && cur) ? cur.v : null }));
const tryGo = (p, v) => p.evaluate(v => { try { go(v) } catch (e) { return "throw:" + e.message } return cur.v }, v);

const GE = "general-english", W = "welding";
const GE_ONLY = ["partner", "english", "roleplay"], W_ONLY = ["mastery", "simulation", "lines", "career"];

console.log("\n# §1 — the app opens in its own programme, whatever the device state says");
{
  const { ctx, p, errs } = await open(GE, W);           /* a GE app whose saved state says Welding */
  const f = await facts(p);
  ok("1 · a General English build reports General English everywhere", f.appTrack === GE && f.area === GE && f.ctxTrack === GE && f.ge === true, JSON.stringify(f));
  ok("2 · …and REWRITES the saved state, which is what the backend reads as the account's programme", f.saved === GE, JSON.stringify(f));
  ok("3 · …and the theme follows it (no Welding identity in the General English app)", f.dataTrack === "general", JSON.stringify(f));
  ok("4 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, p, errs } = await open(W, GE);           /* a Welding app whose saved state says GE */
  const f = await facts(p);
  ok("5 · a Welding build reports Welding everywhere", f.appTrack === W && f.area === W && f.ctxTrack === W && f.ge === false, JSON.stringify(f));
  ok("6 · …and rewrites the saved state to Welding", f.saved === W, JSON.stringify(f));
  ok("7 · …and carries the Welding identity", f.dataTrack === "welding", JSON.stringify(f));
  ok("8 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# §2 — the other programme cannot be chosen");
{
  const { ctx, p } = await open(GE, GE);
  const r = await p.evaluate(() => {
    const before = areaId();
    selectProfessionalTrack("welding"); const afterSelect = areaId();
    areaSwitch("welding", "home"); const afterSwitch = areaId();
    ProfessionalTrackContext.setActive("welding"); const afterCtx = areaId();
    try { obTrackPick("welding") } catch (e) {}
    return { before, afterSelect, afterSwitch, afterCtx, ctxTrack: ProfessionalTrackContext.active().id, saved: S.professionalTracks.activeId };
  });
  ok("9 · selectProfessionalTrack('welding') does nothing", r.afterSelect === GE, JSON.stringify(r));
  ok("10 · areaSwitch('welding') does nothing", r.afterSwitch === GE, JSON.stringify(r));
  ok("11 · even ProfessionalTrackContext.setActive('welding') cannot move the app — the build is bound, not the state", r.afterCtx === GE && r.ctxTrack === GE, JSON.stringify(r));
  ok("12 · the saved programme is still this app's", r.saved === GE, JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, p } = await open(W, W);
  const r = await p.evaluate(() => { selectProfessionalTrack("general-english"); areaSwitch("general-english", "home"); ProfessionalTrackContext.setActive("general-english"); return { area: areaId(), ctxTrack: ProfessionalTrackContext.active().id } });
  ok("13 · the Welding app cannot be moved to General English either", r.area === W && r.ctxTrack === W, JSON.stringify(r));
  await ctx.close();
}

console.log("\n# §3 — the router refuses the other programme's pages (hash, restored view, deep link)");
{
  const { ctx, p } = await open(GE, GE);
  const out = {}; for (const v of W_ONLY) out[v] = await tryGo(p, v);
  ok("14 · a General English app turns away every Welding-only view (mastery / simulation / lines / career)", W_ONLY.every(v => out[v] === "practice"), JSON.stringify(out));
  const own = {}; for (const v of GE_ONLY) own[v] = await tryGo(p, v);
  ok("15 · …and still opens its OWN pages (partner / english / roleplay)", GE_ONLY.every(v => own[v] === v), JSON.stringify(own));
  await ctx.close();
}
{
  const { ctx, p } = await open(W, W);
  const out = {}; for (const v of GE_ONLY) out[v] = await tryGo(p, v);
  ok("16 · a Welding app turns away every General English-only view (partner / english / roleplay)", GE_ONLY.every(v => out[v] === "practice"), JSON.stringify(out));
  const own = {}; for (const v of W_ONLY) own[v] = await tryGo(p, v);
  ok("17 · …and still opens its OWN pages (mastery / simulation / lines / career)", W_ONLY.every(v => own[v] === v), JSON.stringify(own));
  await ctx.close();
}
{
  const { ctx, p } = await open(W, W, { hash: "#partner" });
  const f = await facts(p);
  ok("18 · a typed #partner URL in the Welding app lands on Practice, not Practice Partner", f.cur === "practice", JSON.stringify(f));
  await ctx.close();
}
{
  const { ctx, p } = await open(GE, GE, { hash: "#mastery" });
  const f = await facts(p);
  ok("19 · a typed #mastery URL in the General English app lands on Practice, not Welding Mastery", f.cur === "practice", JSON.stringify(f));
  await ctx.close();
}
{
  /* a relaunch restoring the page the learner was on (sessionStorage be_view —
     the installed-app path, where start_url drops the hash) */
  const { ctx, p } = await open(W, W, { view: "english" });
  const f = await facts(p);
  ok("20 · a restored be_view naming the other programme's page is refused on relaunch", f.cur === "practice", JSON.stringify(f));
  await ctx.close();
}
{
  const { ctx, p } = await open(GE, GE, { hash: "#lines" });
  ok("21 · #lines (the Welding workplace lines) is refused in the General English app", (await facts(p)).cur === "practice");
  await ctx.close();
}

console.log("\n# §4 — the cross-programme UI is not drawn");
{
  const { ctx, p } = await open(GE, GE);
  const u = await p.evaluate(() => { go("home"); const home = document.getElementById("v-home").innerHTML;
    return { otherCard: /ob-track-weld|tracks\.welding/.test(home), tracksRow: home.includes("go('tracks')"),
      scope: areaScopeHTML(), note: areaNoteHTML("review"), tracksPage: (() => { const d = document.createElement("div"); rTracks(d, "home"); return (d.innerHTML.match(/track-card|trackSelectionCard/g) || []).length + "|" + /welding/i.test(d.innerHTML) })() } });
  ok("22 · Home draws no card for the other programme and no way to the Programme page", !u.otherCard && !u.tracksRow, JSON.stringify(u));
  ok("23 · the Progress banner and the Profile caption that offer the other area are empty", u.scope === "" && u.note === "", JSON.stringify(u));
  ok("24 · the Programme page never names Welding in the General English app", !/true$/.test(u.tracksPage) && !u.tracksPage.endsWith("|true"), u.tracksPage);
  await ctx.close();
}
{
  const { ctx, p } = await open(W, W);
  const u = await p.evaluate(() => { go("home"); const home = document.getElementById("v-home").innerHTML;
    return { tracksRow: home.includes("go('tracks')"), geCard: /tracks\.general|Practice Partner/.test(home), scope: areaScopeHTML() } });
  ok("25 · the Welding app's Home offers no General English card and no Programme row", !u.tracksRow && !u.geCard && u.scope === "", JSON.stringify(u));
  await ctx.close();
}

console.log("\n# §5 — onboarding never asks which programme");
{
  const { ctx, p, errs } = await open(W, null, { onboard: true });
  const r = await p.evaluate(async () => {
    const wrap = document.getElementById("obWrap") || document.querySelector(".ob-wrap");
    /* the programme question is the step whose buttons call obTrackPick — NOT any
       step with .ob-track buttons (the Welding trade picker uses the same class) */
    const seen = []; const snap = () => { const c = document.querySelector(".ob-card"); seen.push({ step: OB.step, ask: !!(c && /obTrackPick\(/.test(c.innerHTML)), dots: c ? c.querySelectorAll(".ob-dot").length : 0 }) };
    snap();
    const nm = document.getElementById("obName"); if (nm) nm.value = "Alex";
    obNext(); snap();                      /* 0 -> 1 (language) */
    obLangPick("en"); await new Promise(r => setTimeout(r, 120)); snap();   /* 1 -> (2 skipped) -> 3 */
    return { onboarding: !!wrap, seen, track: OB.track, area: areaId() };
  });
  ok("26 · the onboarding reaches step 3 with no programme question in between", r.seen.length >= 3 && r.seen[r.seen.length - 1].step === 3 && !r.seen.some(x => x.ask), JSON.stringify(r.seen));
  ok("27 · the programme is the app's, already chosen", r.track === W && r.area === W, JSON.stringify(r));
  ok("28 · the step dots count six, not seven", r.seen[r.seen.length - 1].dots === 6, JSON.stringify(r.seen));
  ok("29 · no JavaScript errors through onboarding", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# §6 — the unsplit web build is unchanged");
{
  const { ctx, p, errs } = await open(null, GE);
  const f = await facts(p);
  ok("30 · no pin on the web: BE_APP_TRACK is null and the state decides, as always", f.appTrack === null && f.area === GE && f.saved === GE, JSON.stringify(f));
  const sw = await p.evaluate(() => { areaSwitch("welding", "home"); return { area: areaId(), ctxTrack: ProfessionalTrackContext.active().id, saved: S.professionalTracks.activeId } });
  ok("31 · switching programme still works on the web", sw.area === W && sw.ctxTrack === W && sw.saved === W, JSON.stringify(sw));
  const views = await p.evaluate(() => { const o = {}; ["mastery", "lines", "simulation"].forEach(v => { go(v); o[v] = cur.v }); return o });
  ok("32 · the router guard is inert on the web — a Welding learner reaches the Welding pages", views.mastery === "mastery" && views.lines === "lines" && views.simulation === "simulation", JSON.stringify(views));
  const back = await p.evaluate(() => { areaSwitch("general-english", "home"); const o = {}; ["partner", "english", "roleplay"].forEach(v => { go(v); o[v] = cur.v }); return { area: areaId(), ...o } });
  ok("33 · …and after switching back, the General English pages too", back.area === GE && back.partner === "partner" && back.english === "english" && back.roleplay === "roleplay", JSON.stringify(back));
  ok("34 · the Programme page still offers both programmes on the web", (await p.evaluate(() => { const d = document.createElement("div"); rTracks(d, "home"); return /tracks\.general|General English/i.test(d.innerHTML) && /welding/i.test(d.innerHTML) })));
  ok("35 · Home still draws the other programme's card and the Programme row on the web", (await p.evaluate(() => { go("home"); const h = document.getElementById("v-home").innerHTML; return h.includes("go('tracks')") })));
  ok("36 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# §7 — Premium, ads and the analytics boundary still follow the programme");
/* The Premium contract must be IDENTICAL in both apps and on the web for the
   same account: one subscription, one account-level entitlement, the same
   capabilities and the same locks (THE TIERS, 5 Oct 2026 — one plan, both
   programmes). The point of these checks is that the split neither loosened a
   lock (a paid AI feature must not become free) nor invented a per-app plan. */
const prem = async (build, tr) => { const { ctx, p } = await open(build, tr);
  const r = await p.evaluate(() => ({ caps: ENT_CAPS.slice().sort().join(","), gated: entGated(), billing: flag("billing_enabled"), api: !!entApiBase(),
    locked: ["ad_free", "ai_analysis", "advanced_progress", "ai_coach", "recommended_content"].map(c => (entLocked(c) ? 1 : 0)).join(""),
    has: ["ad_free", "ai_analysis", "advanced_progress", "ai_coach", "recommended_content"].map(c => (hasEntitlement(c) ? 1 : 0)).join(""),
    plan: (entView() || {}).plan || "free", ads: adsTrackAllows("home_feed"),
    geEvent: GE_ONLY_EVENT.test("partner_matched") && GE_ONLY_EVENT.test("shadow_challenge_opened") }));
  await ctx.close(); return r; };
{
  const g = await prem(GE, GE), w = await prem(W, W), web = await prem(null, GE);
  ok("37 · the capability list is untouched by the split — the same five in both apps and on the web", g.caps === web.caps && w.caps === web.caps && g.caps.split(",").length === 5, g.caps + " | " + w.caps + " | " + web.caps);
  ok("38 · the gate is in force in both apps exactly as on the web (plans on, no entitlement service reachable here \u2192 Free)", g.gated === web.gated && w.gated === web.gated && g.billing === web.billing, JSON.stringify({ g, w, web }));
  ok("39 · every capability answers the SAME in the General English app, the Welding app and the web — Premium is account-level, never per app", g.locked === web.locked && w.locked === web.locked && g.has === web.has && w.has === web.has, JSON.stringify({ g: g.locked + "/" + g.has, w: w.locked + "/" + w.has, web: web.locked + "/" + web.has }));
  ok("40 · the split did not make a paid feature free: advanced_progress and recommended_content stay locked for a Free account", g.locked[2] === "1" && g.locked[4] === "1" && w.locked[2] === "1" && w.locked[4] === "1", JSON.stringify({ g: g.locked, w: w.locked }));
  ok("41 · neither app grants a plan a client never bought — both read Free with no entitlement service", g.plan === "free" && w.plan === "free", JSON.stringify({ g: g.plan, w: w.plan }));
  ok("42 · ads: allowed in the General English app, refused on an ordinary Welding page \u2014 the shipped General-English-only rule survives", g.ads === true && w.ads === false && web.ads === true, JSON.stringify({ g: g.ads, w: w.ads, web: web.ads }));
  ok("43 · the General-English-only analytics boundary is still in force in both apps", g.geEvent === true && w.geEvent === true);
}

console.log("\n# §8 — the BUILT bundles carry only their own programme's content");
{
  const tmp = mkdtempSync(resolve(tmpdir(), "be-split-"));
  const run = (t, out) => spawnSync("node", [resolve(root, "mobile/ios/scripts/sync-web.mjs"), "--out", resolve(tmp, out), "--track", t, "--platform", "android"], { encoding: "utf8" });
  const ge = run(GE, "ge"), w = run(W, "weld");
  ok("44 · a General English bundle builds", ge.status === 0, (ge.stderr || "").slice(0, 300));
  ok("45 · a Welding bundle builds", w.status === 0, (w.stderr || "").slice(0, 300));
  const has = (d, f) => existsSync(resolve(tmp, d, f));
  const caps = d => existsSync(resolve(tmp, d, "captions")) ? new Set(readdirSync(resolve(tmp, d, "captions")).map(x => x.replace(/\.json$/, ""))) : new Set();
  const ids = f => new Set(Object.keys(JSON.parse(readFileSync(resolve(root, "catalogue", f), "utf8")).videos || {}));
  const gIds = ids("general.json"), wIds = ids("welding.json");
  ok("46 · the General English bundle carries its own library and NOT the Welding one", has("ge", "catalogue/general.json") && !has("ge", "catalogue/welding.json"));
  ok("47 · the Welding bundle carries its own library and NOT the General English one", has("weld", "catalogue/welding.json") && !has("weld", "catalogue/general.json"));
  ok("48 · no Welding curriculum in the General English bundle", !has("ge", "tracks/welding/weeks.json") && !has("ge", "tracks/welding/mastery.json"));
  ok("49 · no General English missions or English Mastery pack in the Welding bundle", !has("weld", "tracks/general/missions.json") && !has("weld", "tracks/general/mastery.json"));
  ok("50 · the Welding bundle KEEPS the General English curriculum sections it inherits the English machinery from", ["weeks", "shadow", "phrases", "vocabulary", "practice", "progress"].every(s => has("weld", `tracks/general/${s}.json`)));
  ok("51 · the Welding bundle carries no General English animated scenes or role-play photos", !has("weld", "scenes/index.json") && !existsSync(resolve(tmp, "weld", "rp-photos")) && !existsSync(resolve(tmp, "weld", "scenes")));
  ok("52 · the General English bundle carries no Welding workshop photos", !existsSync(resolve(tmp, "ge", "sim-photos")) && !existsSync(resolve(tmp, "ge", "home-photos", "welding")));
  const cg = caps("ge"), cw = caps("weld");
  ok("53 · no caption of a Welding video is in the General English bundle", [...wIds].every(v => !cg.has(v)), [...wIds].filter(v => cg.has(v)).slice(0, 4).join(","));
  ok("54 · no caption of a General English video is in the Welding bundle", [...gIds].every(v => !cw.has(v)), [...gIds].filter(v => cw.has(v)).slice(0, 4).join(","));
  ok("55 · each bundle still has the captions of its OWN videos", [...gIds].some(v => cg.has(v)) && [...wIds].some(v => cw.has(v)));
  const bb = d => readFileSync(resolve(tmp, d, "be-build.js"), "utf8");
  ok("56 · each bundle declares its programme and nothing of staging", /"track":"general-english"/.test(bb("ge")) && /"track":"welding"/.test(bb("weld")) && !/staging/.test(bb("ge") + bb("weld")), bb("ge") + bb("weld"));
  ok("57 · be-build.js is loaded first in the bundled page, before the app reads BE_APP_TRACK",
    /<head>\s*\n?\s*<script src="be-build\.js"><\/script>/.test(readFileSync(resolve(tmp, "ge", "index.html"), "utf8")));
  ok("58 · BUNDLE_INFO names the programme and the production Firebase project", /programme general-english/.test(readFileSync(resolve(tmp, "ge", "BUNDLE_INFO.txt"), "utf8")) && /firebase be-mastery\b/.test(readFileSync(resolve(tmp, "weld", "BUNDLE_INFO.txt"), "utf8")));
  /* an unknown --track must be refused rather than silently build the whole app */
  const bad = spawnSync("node", [resolve(root, "mobile/ios/scripts/sync-web.mjs"), "--out", resolve(tmp, "bad"), "--track", "plumbing"], { encoding: "utf8" });
  ok("59 · an unknown programme is refused by the build script", bad.status !== 0 && /--track must be one of/.test(bad.stderr || ""), (bad.stderr || "").slice(0, 160));
  rmSync(tmp, { recursive: true, force: true });
}

console.log("\n# \u00a711 \u2014 deployment order cannot leak a plan across apps");
/* The entitlement service names the app it answered about. An OLDER service
   does not know about apps and answers about the ACCOUNT — which is the
   pre-split contract, and right for the General English app, the only app that
   has ever sold a subscription. For any other app it would be another app's
   plan. If the Welding app reached a store before be-entitlements understood
   `?app=`, every General English subscriber would silently be Premium in the
   Welding app too. These checks are what stops that.

   Verified as a real regression, not a theoretical one: with the one
   enforcement line removed from entRefresh and nothing else changed, 77 and 79
   both fail — 77 with {"plan":"premium","paid":true,"prem":true}, i.e. the
   Welding app genuinely inheriting the General English plan. 78, 80 and 81 pass
   either way, which is the point: the fix closes the leak without touching the
   cases that were already right. */
async function entRigRaw(build, body) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(({ build, s }) => {
    if (build) window.BE_BUILD = { track: build };
    localStorage.setItem("be12_v1", s);
    localStorage.setItem("be_ent_api", "http://ent.test");
    localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: true, web_visitor_gate_enabled: false }));
  }, { build, s: seed(build || GE) });
  await ctx.route("http://ent.test/**", r => r.fulfill({ status: 200, contentType: "application/json",
    headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) }));
  await ctx.route(u => /be-events|be-polish|be-partner|be-push|be-coach|be-widget|cloudflareinsights|gstatic|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1200);
  await p.evaluate(() => { FBUser = { uid: "u-order", email: "a@b.c", getIdToken: async () => "tok" }; });
  const v = await p.evaluate(async () => { const r = await entRefresh(); return { plan: r.plan, paid: r.paid, prem: hasEntitlement("advanced_progress") } });
  await ctx.close(); return { v, errs };
}
const PREM = extra => Object.assign({ plan: "premium", paid: true, state: "active", ads: false,
  capabilities: { ad_free: true, ai_analysis: true, advanced_progress: true, ai_coach: true, recommended_content: true },
  expiresAt: Date.now() + 30 * 86400e3, startedAt: Date.now() - 1e3, renews: true, source: "google_play" }, extra || {});
{
  /* the exact hazard: an OLD service, which names no app */
  const r = await entRigRaw(W, PREM());
  ok("77 \u00b7 an entitlement service too old to name the app cannot make the Welding app Premium",
    r.v.plan === "free" && r.v.paid === false && r.v.prem === false, JSON.stringify(r.v));
  const g = await entRigRaw(GE, PREM());
  ok("78 \u00b7 \u2026and the General English app still trusts it \u2014 the pre-split contract, and the only app that has ever sold a plan",
    g.v.plan === "premium" && g.v.paid === true && g.v.prem === true, JSON.stringify(g.v));
  const w = await entRigRaw(W, PREM({ app: "general-english" }));
  ok("79 \u00b7 a view that names the OTHER app is refused outright", w.v.plan === "free" && w.v.paid === false, JSON.stringify(w.v));
  const own = await entRigRaw(W, PREM({ app: "welding" }));
  ok("80 \u00b7 \u2026and a view that names THIS app is taken", own.v.plan === "premium" && own.v.paid === true, JSON.stringify(own.v));
  ok("81 \u00b7 no JavaScript errors through any of it", !r.errs.length && !g.errs.length && !w.errs.length && !own.errs.length,
    [].concat(r.errs, g.errs, w.errs, own.errs).join(" | "));
}

console.log("\n# \u00a79 \u2014 an existing learner loses no data");
/* The split repoints S.professionalTracks.activeId to the app's own programme.
   That is the ONE write it makes, and it must not touch a single record: every
   per-area store (CLAUDE.md \u00a7 Areas) keeps both programmes' evidence, and the
   learner's Welding history is waiting for them in the Welding app. Nothing is
   migrated, nothing is deleted. */
{
  const rich = JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "welding", tradeId: "pipefitter" },
    fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
    /* evidence in BOTH programmes */
    dayLogA: { welding: { "2026-10-01": 3 }, "general-english": { "2026-10-02": 1 } },
    weeklyA: { welding: { w1: { score: 7 } } }, monthlyA: { welding: { m1: { score: 6 } } },
    troubleA: { welding: { weld: { n: 2 } } }, phMasterA: { welding: { "root gap": 1 } },
    clipsA: { welding: [{ vid: "w1", title: "Welding clip" }] }, chHistA: { welding: [{ ts: 1, verdict: "good" }] },
    exRepA: { welding: [{ at: 1, level: "B1" }] }, watchedA: { welding: [{ vid: "w9", title: "x", ts: 1 }] },
    vocab: { bevel: { tk: ["welding"], state: 2 }, leverage: { tk: ["general-english"], state: 1 } },
    fbHist: [{ tk: "welding", score: 70, at: 1 }, { tk: "general-english", score: 80, at: 2 }],
    days: { "welding:w1-Mon": true }, dates: ["2026-10-01"], dayLog: { "2026-10-01": 3 },
    steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(s => { window.BE_BUILD = { track: "general-english" }; localStorage.setItem("be12_v1", s);
    localStorage.setItem("be_flags", JSON.stringify({ web_visitor_gate_enabled: false })); }, rich);
  await ctx.route(u => /be-events|be-polish|be-partner|be-push|be-coach|be-widget|cloudflareinsights|gstatic|ytimg|youtube|entitlements/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1600);
  const r = await p.evaluate(() => { const saved = JSON.parse(localStorage.getItem("be12_v1") || "{}"); return {
    area: areaId(), activeId: saved.professionalTracks && saved.professionalTracks.activeId,
    weldDayLog: JSON.stringify((saved.dayLogA || {}).welding), weldWeekly: JSON.stringify((saved.weeklyA || {}).welding),
    weldMonthly: JSON.stringify((saved.monthlyA || {}).welding), weldTrouble: JSON.stringify((saved.troubleA || {}).welding),
    weldPhrases: JSON.stringify((saved.phMasterA || {}).welding), weldClips: ((saved.clipsA || {}).welding || []).length,
    weldChallenge: ((saved.chHistA || {}).welding || []).length, weldPolish: ((saved.exRepA || {}).welding || []).length,
    weldWatched: ((saved.watchedA || {}).welding || []).length, weldVocab: !!(saved.vocab || {}).bevel,
    weldFb: (saved.fbHist || []).filter(x => x.tk === "welding").length, weldDays: !!(saved.days || {})["welding:w1-Mon"],
    trade: saved.professionalTracks && saved.professionalTracks.tradeId,
    dates: (saved.dates || []).length, dayLog: JSON.stringify(saved.dayLog),
    /* and the open programme reports only ITS own evidence, as it always did */
    ownFb: areaFbHist().length, ownVocab: Object.keys(areaVocab()).join(",") }; });
  ok("60 \u00b7 the General English app opens in General English although the saved programme was Welding", r.area === GE && r.activeId === GE, JSON.stringify({ area: r.area, activeId: r.activeId }));
  ok("61 \u00b7 every Welding record is still there, untouched \u2014 progress, weekly, monthly, trouble words, phrases",
    r.weldDayLog === '{"2026-10-01":3}' && r.weldWeekly === '{"w1":{"score":7}}' && r.weldMonthly === '{"m1":{"score":6}}'
    && r.weldTrouble === '{"weld":{"n":2}}' && r.weldPhrases === '{"root gap":1}', JSON.stringify(r));
  ok("62 \u00b7 …and the saved clips, Challenge history, Polish reports, watched clips, vocabulary, feedback and finished days",
    r.weldClips === 1 && r.weldChallenge === 1 && r.weldPolish === 1 && r.weldWatched === 1 && r.weldVocab === true && r.weldFb === 1 && r.weldDays === true, JSON.stringify(r));
  ok("63 \u00b7 the trade, the account-wide activity log and the streak dates are untouched", r.trade === "pipefitter" && r.dates === 1 && r.dayLog === '{"2026-10-01":3}', JSON.stringify(r));
  ok("64 \u00b7 the app still reports on the OPEN programme only — one General English feedback row, no Welding word",
    r.ownFb === 1 && r.ownVocab === "leverage", JSON.stringify({ ownFb: r.ownFb, ownVocab: r.ownVocab }));
  ok("65 \u00b7 no JavaScript errors on that learner's first launch after the update", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# \u00a710 \u2014 Premium is per app on the client too");
/* Owner's rule, 12 Oct 2026: each app sells its own subscription and a purchase
   in one app does NOT unlock the other. The server enforces it (the purchase
   link records the app the STORE says sold it — backend/entitlements, W1-W23);
   these checks are the client half: every entitlement question names this app,
   the cache cannot be read across apps, and a reply about the other app is
   refused rather than drawn. */
async function entRig(build) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(({ build, s }) => {
    if (build) window.BE_BUILD = { track: build };
    localStorage.setItem("be12_v1", s);
    localStorage.setItem("be_ent_api", "http://ent.test");       /* honoured on 127.0.0.1 only */
    localStorage.setItem("be_flags", JSON.stringify({ billing_enabled: true, web_visitor_gate_enabled: false }));
  }, { build, s: seed(build || GE) });
  const asked = [];
  await ctx.route("http://ent.test/**", r => {
    const u = new URL(r.request().url());
    asked.push(u.pathname + u.search);
    /* the server answers about the app that was ASKED about: Premium only for
       the General English app, so a Welding build must come out Free */
    const app = u.searchParams.get("app") || "general-english";
    const premium = app === "general-english";
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ plan: premium ? "premium" : "free", paid: premium, state: premium ? "active" : "none", app,
        ads: !premium, capabilities: { ad_free: premium, ai_analysis: premium, advanced_progress: premium, ai_coach: premium, recommended_content: premium },
        expiresAt: premium ? Date.now() + 30 * 86400e3 : null, startedAt: premium ? Date.now() - 86400e3 : null, renews: premium ? true : null, source: premium ? "google_play" : null }) });
  });
  await ctx.route(u => /be-events|be-polish|be-partner|be-push|be-coach|be-widget|cloudflareinsights|gstatic|ytimg|youtube/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1200);
  /* A signed-in learner, without a real Firebase round trip. FBUser is a
     script-scope `let`, so it must be ASSIGNED — window.FBUser would create a
     second, unread binding (which is what made these checks silently pass
     nothing on the first run). */
  await p.evaluate(() => { FBUser = { uid: "u-split", email: "a@b.c", getIdToken: async () => "tok" }; });
  return { ctx, p, errs, asked };
}
{
  const { ctx, p, errs, asked } = await entRig(GE);
  const v = await p.evaluate(async () => { const r = await entRefresh(); return { plan: r.plan, paid: r.paid, app: entApp(), prem: hasEntitlement("advanced_progress") } });
  ok("66 \u00b7 the General English app asks about itself", asked.some(u => u === "/v1/entitlement?app=general-english"), asked.join(" | "));
  ok("67 \u00b7 …and is Premium when that app's purchase is in force", v.plan === "premium" && v.paid === true && v.prem === true, JSON.stringify(v));
  ok("68 \u00b7 no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, p, errs, asked } = await entRig(W);
  const v = await p.evaluate(async () => { const r = await entRefresh(); return { plan: r.plan, paid: r.paid, app: entApp(), prem: hasEntitlement("advanced_progress"), locked: entLocked("advanced_progress") } });
  ok("69 \u00b7 the Welding app asks about ITSELF, never the other app", asked.some(u => u === "/v1/entitlement?app=welding") && !asked.some(u => /app=general-english/.test(u)), asked.join(" | "));
  ok("70 \u00b7 …and the same account is Free there — a purchase in the General English app does not unlock Welding",
    v.plan === "free" && v.paid === false && v.prem === false && v.locked === true, JSON.stringify(v));
  ok("71 \u00b7 no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
{
  /* the cached plan must not cross apps: a Welding build must ignore a cache
     entry the General English app wrote for the same account */
  const { ctx, p } = await entRig(W);
  const r = await p.evaluate(() => {
    const prem = { plan: "premium", paid: true, state: "active", ads: false, capabilities: { ad_free: true, ai_analysis: true, advanced_progress: true, ai_coach: true, recommended_content: true }, expiresAt: Date.now() + 30 * 86400e3, startedAt: Date.now() - 1e3, renews: true, source: "google_play" };
    const out = {};
    localStorage.setItem("be_ent_view", JSON.stringify({ uid: "u-split", app: "general-english", at: Date.now(), view: prem }));
    _entView = null; _entUid = null;
    out.otherApp = entView().plan;
    localStorage.setItem("be_ent_view", JSON.stringify({ uid: "u-split", at: Date.now(), view: prem }));   /* written before the split: no app */
    _entView = null; _entUid = null;
    out.preSplit = entView().plan;
    localStorage.setItem("be_ent_view", JSON.stringify({ uid: "u-split", app: "welding", at: Date.now(), view: prem }));
    _entView = null; _entUid = null;
    out.ownApp = entView().plan;
    return out;
  });
  ok("72 \u00b7 a cache entry the OTHER app wrote is ignored", r.otherApp === "free", JSON.stringify(r));
  ok("73 \u00b7 a cache entry written before the split counts as the General English app's, so Welding ignores it too", r.preSplit === "free", JSON.stringify(r));
  ok("74 \u00b7 …and this app's own cached plan is still used", r.ownApp === "premium", JSON.stringify(r));
  await ctx.close();
}
{
  /* a purchase route's reply names the app that SOLD it */
  const { ctx, p } = await entRig(W);
  const r = await p.evaluate(() => {
    const prem = app => ({ app, plan: "premium", paid: true, state: "active", ads: false, capabilities: { ad_free: true, ai_analysis: true, advanced_progress: true, ai_coach: true, recommended_content: true }, expiresAt: Date.now() + 30 * 86400e3, startedAt: Date.now() - 1e3, renews: true, source: "app_store" });
    _entView = null; _entUid = null; try { localStorage.removeItem("be_ent_view") } catch (e) {}
    billingTakeView(prem("general-english"));
    const after = entView().plan;
    billingTakeView(prem("welding"));
    return { afterOther: after, afterOwn: entView().plan };
  });
  ok("75 \u00b7 a purchase reply about the other app is refused, not drawn", r.afterOther === "free", JSON.stringify(r));
  ok("76 \u00b7 …and a reply about this app is taken", r.afterOwn === "premium", JSON.stringify(r));
  await ctx.close();
}

{
  /* SIGN IN WITH APPLE ACROSS THE TWO APPS (14 Oct 2026). Apple's answer comes back on a
     URL scheme, and only one installed app may claim a scheme — so each app has its own and
     the proxy chooses between them from the state's prefix. Four files have to agree, and
     nothing at build time would notice if they stopped: a Welding build that listened on the
     wrong scheme would simply drop every answer it was handed and report "cancelled". */
  const gradle = readFileSync(resolve(root, "mobile/android/android/app/build.gradle"), "utf8");
  const plug = readFileSync(resolve(root, "mobile/android/android/app/src/main/java/com/bemastery/app/BEAuthPlugin.java"), "utf8");
  const proxy = readFileSync(resolve(root, "backend/auth-proxy/auth-proxy.js"), "utf8");
  const scheme = f => (gradle.match(new RegExp(f + "\\s*\\{[\\s\\S]*?beAppleScheme: \"([a-z]+)\"")) || [])[1];
  const geScheme = scheme("general"), wScheme = scheme("welding");
  ok("82 \u00b7 the two apps claim DIFFERENT Apple schemes", !!geScheme && !!wScheme && geScheme !== wScheme, geScheme + " / " + wScheme);
  ok("83 \u00b7 the plugin listens on each app's own scheme, never a hard-coded one",
    /appleScheme\(\)\.equals\(d\.getScheme\(\)\)/.test(plug) && plug.includes('"' + wScheme + '"') && plug.includes('"' + geScheme + '"'),
    (plug.match(/equals\(d\.getScheme\(\)\)/g) || []).join(","));
  ok("84 \u00b7 every scheme the plugin answers on is one the proxy can actually send to",
    [geScheme, wScheme].every(s => new RegExp('"' + s + '://apple"').test(proxy)), proxy.match(/be[a-z]*:\/\/apple/g).join(","));
  /* read the prefixes off the ONE line that mints them, so a prefix merely mentioned in a
     comment cannot stand in for the code actually doing it */
  const mint = (plug.match(/appleStatePrefix\(\)[^\n]*/) || [""])[0];
  const prefixes = [...new Set((mint.match(/"(be[a-z]\.)"/g) || []).map(x => x.slice(1, -1)))];
  ok("85 \u00b7 the app mints exactly one prefix per programme, and the proxy knows both",
    prefixes.length === 2 && prefixes.every(x => new RegExp('"' + x + '":').test(proxy)), mint);
}
{
  /* WHICH APP THE APP POINTS AT (14 Oct 2026). Found by running the Welding build:
     it covered its own screen with "Install the app from Google Play" — in the app,
     over the sign-in sheet — and the link went to the OTHER app. Three places name a
     Play listing and all three have to follow the build's own programme. */
  const page = readFileSync(resolve(root, "index.html"), "utf8");
  ok("86 \u00b7 the install card never appears inside a store shell",
    /function playAskDue\(\)\{[\s\S]{0,700}?if\(IS_NATIVE_APP\)return false;/.test(page),
    (page.match(/function playAskDue\(\)\{[\s\S]{0,200}/) || [""])[0].slice(0, 160));
  ok("87 \u00b7 the Play link is built from the programme, never a single hard-coded package",
    /PLAY_URL\s*=\s*"https:\/\/play\.google\.com\/store\/apps\/details\?id="\s*\+\s*PLAY_PKG/.test(page)
    && /PLAY_PKG[\s\S]{0,200}BE_APP_TRACK\s*===\s*"welding"[\s\S]{0,80}com\.lomonec\.bemastery\.welding/.test(page),
    (page.match(/const PLAY_URL[^\n]*/) || [""])[0]);
  const tmp2 = mkdtempSync(resolve(tmpdir(), "be-split-mf-"));
  const w2 = spawnSync("node", [resolve(root, "mobile/ios/scripts/sync-web.mjs"), "--out", resolve(tmp2, "weld"), "--track", W, "--platform", "android"], { encoding: "utf8" });
  let mw = {}, mrepo = {};
  try { mw = JSON.parse(readFileSync(resolve(tmp2, "weld", "manifest.json"), "utf8")); } catch (e) {}
  try { mrepo = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")); } catch (e) {}
  const ids = m => (m.related_applications || []).map(a => a.id + " " + (a.url || "")).join(" ");
  ok("88 \u00b7 the Welding bundle's manifest names the Welding app and never the other one",
    w2.status === 0 && /com\.lomonec\.bemastery\.welding/.test(ids(mw)) && !/com\.bemastery\.app/.test(ids(mw)), ids(mw) || (w2.stderr || "").slice(0, 200));
  ok("89 \u00b7 …and the repository's own manifest still names the existing app, so the web is unchanged",
    /com\.bemastery\.app/.test(ids(mrepo)) && !/welding/.test(ids(mrepo)), ids(mrepo));
  rmSync(tmp2, { recursive: true, force: true });
}
await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed${BASE ? "   (" + BASE + ")" : ""}`);
process.exit(pass === res.length ? 0 : 1);
