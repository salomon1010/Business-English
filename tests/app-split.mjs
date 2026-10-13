/* THE TWO-APP SPLIT — the boundary suite.
 *
 *   cd tests && node app-split.mjs            (BASE=… PORT=… to point elsewhere)
 *
 * BE Mastery ships as two store apps from one codebase. A store bundle carries
 * be-build.js `{track:"<id>"}`; index.html reads it as BE_APP_TRACK, and that
 * ONE value pins areaId() — the single question every feature asks — so the
 * curriculum, Home, the studio, the games, the ads gate and the backend's
 * programme read all follow it.
 *
 * This suite is the guard on that boundary. It was lost with the worktree on
 * 13 Oct 2026 and is rebuilt here from the architecture and from the two
 * shipped bundles, which are the record of what each app actually contains.
 *
 * What it holds, and why each matters:
 *   §1 the pin itself — BE_APP_TRACK decides areaId(), and nothing else can
 *   §2 the router refuses the other programme's views (not merely hides them)
 *   §3 the programme cannot be switched from inside a pinned build
 *   §4 General English-only features are absent from the Welding app
 *   §5 the entitlement client asks about ITS app and accepts no other answer
 *   §6 the unpinned web build still serves both programmes
 *
 * §5 is the one with teeth: the deployed entitlement service predates the split
 * and answers without naming an app. A client that accepted such an answer as
 * its own would hand every General English subscriber Premium inside Welding.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const PORT = process.env.PORT || 9890;
const BASE = process.env.BASE || `http://127.0.0.1:${PORT}`;

const res = [];
const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let srv = null;
if (!process.env.BASE) {
  srv = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: root, stdio: "ignore" });
  await sleep(1200);
}
const b = await chromium.launch();

/* A learner who has used both programmes, so a leak would be visible rather
   than merely absent. The track is what the BUILD pins, not what S says. */
const seed = track => JSON.stringify({
  profile: { name: "Alex", lang: "en", ts: Date.now() - 30 * 86400000, weldProf: "pipefitter" },
  onboarded: true,
  professionalTracks: { activeId: track, tradeId: "pipefitter" },
  fnd: { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(),
});

/* `build` is be-build.js as a store bundle carries it; null is the website. */
async function open({ build = null, track = "general-english", flags = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, bd, f]) => {
    localStorage.setItem("be12_v1", s);
    if (f) localStorage.setItem("be_flags", JSON.stringify(f));
    if (bd) window.BE_BUILD = bd;
  }, [seed(track), build, flags]);
  const ent = [];
  await ctx.route(u => /entitlements|be-entitlements/.test(u.href), r => {
    ent.push({ method: r.request().method(), url: r.request().url() });
    return r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ plan: "free", paid: false, state: "none", ads: true, capabilities: {} }) });
  });
  await ctx.route(u => /be-polish|be-partner|be-events|be-coach|be-push|cloudflareinsights|gstatic|ytimg|youtube/.test(u.href),
    r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html");
  await sleep(1800);
  return { ctx, p, ent, errs };
}
const g = f => `(()=>{try{return ${f}}catch(e){return "n/a:"+String(e.message).slice(0,40)}})()`;
const probe = (p, fields) => p.evaluate(new Function("return {" + Object.entries(fields).map(([k, v]) => `${k}: ${g(v)}`).join(",") + "}"));

console.log("\n# 1 · the pin: BE_APP_TRACK decides the programme");
{
  const w = await open({ build: { track: "welding" }, track: "general-english" });
  const s = await probe(w.p, { track: "window.BE_APP_TRACK", area: "areaId()", ge: "isGeneralEnglish()", stored: "S.professionalTracks.activeId" });
  ok("1 · a welding bundle pins areaId() to welding even though the saved state says general-english",
    s.track === "welding" && s.area === "welding" && s.ge === false, JSON.stringify(s));
  ok("2 · …and the pin is written back, so everything that reads S agrees", s.stored === "welding", JSON.stringify(s));
  ok("3 · no JavaScript errors", !w.errs.length, w.errs.join(" | "));
  await w.ctx.close();

  const ge = await open({ build: { track: "general-english" }, track: "welding" });
  const t = await probe(ge.p, { track: "window.BE_APP_TRACK", area: "areaId()", ge: "isGeneralEnglish()" });
  ok("4 · a general-english bundle pins the other way, from the same code",
    t.track === "general-english" && t.area === "general-english" && t.ge === true, JSON.stringify(t));
  await ge.ctx.close();
}

console.log("\n# 2 · the router REFUSES the other programme's views");
{
  const w = await open({ build: { track: "welding" } });
  const s = await probe(w.p, {
    refuse: `["partner","english","roleplay"].map(v=>v+":"+(viewAllowedHere(v)?"ALLOWED":"refused")).join(" ")`,
    allow: `["mastery","simulation","lines","career"].map(v=>v+":"+(viewAllowedHere(v)?"allowed":"REFUSED")).join(" ")`,
  });
  ok("5 · the Welding app refuses partner, english and roleplay", !/ALLOWED/.test(s.refuse), s.refuse);
  ok("6 · …and allows its own mastery, simulation, lines and career", !/REFUSED/.test(s.allow), s.allow);
  /* refusing must mean LANDING somewhere safe, not a blank screen */
  const landed = await w.p.evaluate(async () => { try { go("partner"); } catch (e) {} await new Promise(r => setTimeout(r, 600)); return cur.v; });
  ok("7 · asking for a refused view lands on a real page rather than a blank one", landed && landed !== "partner", String(landed));
  await w.ctx.close();

  const ge = await open({ build: { track: "general-english" } });
  const t = await probe(ge.p, { refuse: `["mastery","simulation","lines","career"].map(v=>v+":"+(viewAllowedHere(v)?"ALLOWED":"refused")).join(" ")` });
  ok("8 · the General English app refuses the Welding views, the same way", !/ALLOWED/.test(t.refuse), t.refuse);
  await ge.ctx.close();
}

console.log("\n# 3 · a pinned build cannot be switched out of its programme");
{
  const w = await open({ build: { track: "welding" } });
  const after = await w.p.evaluate(async () => {
    const before = areaId();
    try { selectProfessionalTrack("general-english"); } catch (e) {}
    try { areaSwitch("general-english", "home"); } catch (e) {}
    try { obTrackPick("general-english"); } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
    return { before, after: areaId(), stored: S.professionalTracks.activeId };
  });
  ok("9 · selectProfessionalTrack, areaSwitch and obTrackPick all refuse the other programme",
    after.after === "welding" && after.stored === "welding", JSON.stringify(after));
  await w.ctx.close();
}

console.log("\n# 4 · General English-only features are absent from the Welding app");
{
  const w = await open({ build: { track: "welding" } });
  const s = await probe(w.p, {
    pp: "ppAvailable()", scenes: "scnOn()", applyPartner: "svApplyPartnerOn()", applyAI: "svApplyAIOn()",
    catalogue: "SH_CAT_FILE[areaId()]", geEvent: `GE_ONLY_EVENT.test("partner_matched")`,
  });
  ok("10 · Practice Partner is unavailable", s.pp === false, JSON.stringify(s));
  ok("11 · the animated scenes are off", s.scenes === false, JSON.stringify(s));
  ok("12 · Apply It reaches neither a human partner nor the General English coach",
    s.applyPartner === false && s.applyAI === false, JSON.stringify(s));
  ok("13 · the Shadow library reads the WELDING catalogue", s.catalogue === "catalogue/welding.json", String(s.catalogue));
  ok("14 · General English-only analytics are dropped, so a Welding learner never lands in a GE funnel",
    s.geEvent === true, JSON.stringify(s));
  await w.ctx.close();
}

console.log("\n# 5 · the entitlement client asks about ITS app, and accepts no other answer");
{
  const w = await open({ build: { track: "welding" } });
  const asked = await w.p.evaluate(async () => {
    FBUser = { uid: "split-u1", getIdToken: async () => "t" };
    try { await entRefresh(); } catch (e) {}
    return { app: entApp(), urls: [] };
  });
  await sleep(400);
  const urls = w.ent.filter(r => r.method === "GET").map(r => r.url);
  ok("15 · the Welding app names itself in the request", asked.app === "welding", JSON.stringify(asked));
  ok("16 · …and the request carries ?app=welding", urls.some(u => /[?&]app=welding\b/.test(u)), JSON.stringify(urls.slice(-2)));

  /* The teeth. The deployed service predates the split and answers without an
     `app`; a GENERAL ENGLISH client must read that as its own (it is the only
     app that could have sold it), and a WELDING client must not. */
  const verdicts = await w.p.evaluate(() => ({
    weldingOnSilent: entViewIsOurs({ plan: "premium", paid: true }),
    weldingOnWelding: entViewIsOurs({ plan: "premium", app: "welding" }),
    weldingOnGeneral: entViewIsOurs({ plan: "premium", app: "general-english" }),
  }));
  ok("17 · a Welding app REFUSES an answer that names no app — the pre-split service's shape",
    verdicts.weldingOnSilent === false, JSON.stringify(verdicts));
  ok("18 · …refuses one that names the other app", verdicts.weldingOnGeneral === false, JSON.stringify(verdicts));
  ok("19 · …and accepts its own", verdicts.weldingOnWelding === true, JSON.stringify(verdicts));
  await w.ctx.close();

  const ge = await open({ build: { track: "general-english" } });
  const geV = await ge.p.evaluate(() => ({
    silent: entViewIsOurs({ plan: "premium", paid: true }),
    general: entViewIsOurs({ plan: "premium", app: "general-english" }),
    welding: entViewIsOurs({ plan: "premium", app: "welding" }),
  }));
  ok("20 · the General English app DOES accept the silent answer, so it keeps working against the deployed service",
    geV.silent === true && geV.general === true, JSON.stringify(geV));
  ok("21 · …but still refuses an answer about the Welding app", geV.welding === false, JSON.stringify(geV));
  await ge.ctx.close();
}

console.log("\n# 6 · the website is unchanged: no build marker, both programmes");
{
  const web = await open({ build: null, track: "general-english" });
  const s = await probe(web.p, { track: "window.BE_APP_TRACK", area: "areaId()", partner: "viewAllowedHere('partner')", mastery: "viewAllowedHere('mastery')" });
  ok("22 · with no be-build.js the pin is null, so app.lomonec.com still serves both", s.track === null, JSON.stringify(s));
  ok("23 · …and no view is refused there", s.partner === true && s.mastery === true, JSON.stringify(s));
  const switched = await web.p.evaluate(async () => { try { areaSwitch("welding", "home"); } catch (e) {} await new Promise(r => setTimeout(r, 500)); return areaId(); });
  ok("24 · …and the learner can still switch programme", switched === "welding", String(switched));
  ok("25 · no JavaScript errors", !web.errs.length, web.errs.join(" | "));
  await web.ctx.close();
}

await b.close();
if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
