/* Track isolation — the active track has ONE source (26 Sep 2026).
   Run: cd tests && node track-isolation.mjs        (BASE=… to test another tree)

   What a real iPhone showed: a learner on Welding (Welding journey, Welding
   shadow lines, the "International Welder" chip) was ALSO shown Practice
   Partner presence ("2 learner(s) online · 2 ready to practise"), General
   English Polish and an "AI coach practice" history entry. Cause: two sources
   of the active track — S.professionalTracks.activeId (areaId(), every General
   English gate) and ProfessionalTrackContext's own copy (the journey, shadow
   starters, the chip) — and the paths that replace S wholesale (sign-in
   adopting the account copy, pull-on-return, import, restore, sign-out) never
   told the context. This reproduces the sign-in case and checks that every
   General-English-only surface follows the one answer. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8127);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await chromium.launch();
const seed = tr => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1,
  /* a General English AI-coach practice on the account, as in the screenshot */
  ppHist: [{ id: "ai-1", kind: "ai", tk: "general-english", ts: Date.now() - 3600e3, score: 78, title: "AI coach practice" }] });
async function open(track) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(s => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_partner_api", "http://partner.test"); localStorage.setItem("be_flags", JSON.stringify({ practice_partner_enabled: true, practice_partner_notifications_enabled: true })); }, JSON.stringify(seed(track)));
  await ctx.route(u => /be-events|be-polish|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube|entitlements/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const presence = [];
  await ctx.route("http://partner.test/**", r => { const u = new URL(r.request().url()); if (u.pathname === "/presence") presence.push(Date.now());
    r.fulfill({ status: u.pathname === "/presence" ? 200 : 404, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(u.pathname === "/presence" ? { online: 2, waiting: 2 } : { error: "x" }) }); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p, errs, presence };
}
/* what every part of the app believes about the track right now */
const state = p => p.evaluate(() => ({
  area: areaId(), context: ProfessionalTrackContext.active().id, ge: isGeneralEnglish(), journey: isProfessionalJourney() ? "professional" : "general",
  dataTrack: document.documentElement.getAttribute("data-track"), chip: !!(document.getElementById("trackIndicator") || {}).classList?.contains("show"),
  pp: ppAvailable(), sv: svOn(), polishArea: exAreaKey(), hist: ppHist().length, split: shOwnSplit() }));
const agree = s => s.area === s.context && (s.area === "general-english") === s.ge && (s.journey === "general") === s.ge && (s.dataTrack === "general") === s.ge && s.chip === !s.ge;

/* sign-in on a device that is on one track, adopting an account copy on the other */
async function adoptCloud(p, cloudTrack) {
  return p.evaluate(async cloudTrack => {
    const cloud = JSON.parse(JSON.stringify(S)); cloud.professionalTracks = { ...(cloud.professionalTracks || {}), activeId: cloudTrack };
    cloud.profile = { ...cloud.profile, name: "Account copy" };
    let doc = { json: JSON.stringify(cloud) };
    FBdb = { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => doc }), set: async d => { doc = { ...doc, ...d }; } }) }) };
    window.firebase = window.firebase || { firestore: { FieldValue: { serverTimestamp: () => "ts" } } };
    localStorage.setItem("be12_trust_account", "1"); localStorage.setItem("be12_owner", "u-iphone");
    FBUser = { uid: "u-iphone", email: "a@b.c", getIdToken: async () => "t" };
    await fbFirstSync(FBUser);
    return S.professionalTracks.activeId;
  }, cloudTrack);
}

console.log("\n# the iPhone case: a Welding device signs in, the account copy is General English");
{
  const { ctx, p, errs } = await open("welding");
  let s = await state(p);
  ok("R0 · before sign-in: Welding everywhere (area, journey, chip), no General English feature", s.area === "welding" && agree(s) && !s.pp && !s.sv && s.hist === 0, JSON.stringify(s));
  const adopted = await adoptCloud(p, "general-english"); await sleep(400);
  s = await state(p);
  ok("R1 · after adopting the account copy (General English): the journey, the chip and every feature gate give the SAME answer", adopted === "general-english" && agree(s), JSON.stringify(s));
  ok("R2 · …and that answer is General English everywhere — no Welding journey beside General English features", s.context === "general-english" && s.journey === "general" && s.dataTrack === "general" && !s.chip, JSON.stringify(s));
  ok("R3 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# the reverse: a General English device adopts a Welding account copy");
{
  const { ctx, p, errs, presence } = await open("general-english");
  await sleep(2000);
  let s = await state(p);
  ok("V0 · General English device: Practice Partner available, the presence count is fetched", s.pp && presence.length >= 1, JSON.stringify({ s, presence: presence.length }));
  await adoptCloud(p, "welding"); await sleep(400);
  s = await state(p);
  ok("V1 · after adopting a Welding account copy: every part agrees on Welding", s.area === "welding" && agree(s), JSON.stringify(s));
  ok("V2 · Practice Partner, Shadow Studio V2 and the Premium Shadow/YouTube limits are off; Polish writes to the Welding bucket", !s.pp && !s.sv && !s.split && s.polishArea === "welding", JSON.stringify(s));
  ok("V3 · the General English 'AI coach practice' history is not listed on Welding", s.hist === 0, JSON.stringify(s));
  const n0 = presence.length;
  await p.evaluate(() => { ppPub.at = 0; ppPresencePoll(true); document.dispatchEvent(new Event("visibilitychange")); }); await sleep(800);
  ok("V4 · no presence request is made on Welding ('N learner(s) online' cannot be fetched, let alone drawn)", presence.length === n0 && await p.evaluate(() => ppOnlineCount() === 0 && ppPresenceHTML() === ""), JSON.stringify({ n0, now: presence.length }));
  const route = await p.evaluate(async () => { go("partner"); await new Promise(r => setTimeout(r, 400)); return cur.v; });
  ok("V5 · the partner page cannot be opened on Welding (sent back to Practice)", route === "practice", route);
  const practice = await p.evaluate(async () => { go("practice"); await new Promise(r => setTimeout(r, 500)); const v = document.getElementById("v-practice"); return v ? v.innerText : ""; });
  ok("V6 · the Practice tab on Welding shows no Practice Partner card and no 'online' count", !/Practice Partner|online ·|ready to practise|learner\(s\) online/i.test(practice), practice.slice(0, 300));
  ok("V7 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# every other wholesale replacement of the state");
{
  const { ctx, p, errs } = await open("welding");
  const direct = await p.evaluate(() => { S = JSON.parse(JSON.stringify(S)); S.professionalTracks.activeId = "general-english"; return { area: areaId(), context: ProfessionalTrackContext.active().id }; });
  ok("S1 · even a raw replacement of S (any future path) cannot split the track: the context reads the state", direct.area === direct.context && direct.area === "general-english", JSON.stringify(direct));
  const odd = await p.evaluate(() => { S.professionalTracks.activeId = "not-a-track"; return { area: areaId(), context: ProfessionalTrackContext.active().id, ge: isGeneralEnglish() }; });
  ok("S2 · an unknown track id resolves the same way on both sides (General English), never 'not GE here, GE there'", odd.area === "general-english" && odd.context === "general-english" && odd.ge, JSON.stringify(odd));
  const imp = await p.evaluate(() => { const d = JSON.parse(JSON.stringify(S)); d.professionalTracks.activeId = "welding"; S = d; trackStateReloaded(); return { area: areaId(), context: ProfessionalTrackContext.active().id, dataTrack: document.documentElement.getAttribute("data-track") }; });
  ok("S3 · import / restore path (S replaced, then trackStateReloaded): Welding everywhere, theme repainted", imp.area === "welding" && imp.context === "welding" && imp.dataTrack === "welding", JSON.stringify(imp));
  const wipe = await p.evaluate(() => { S = load(); trackStateReloaded(); return { area: areaId(), context: ProfessionalTrackContext.active().id }; });
  ok("S4 · sign-out wipe (S = load()): both back to the same default", wipe.area === wipe.context, JSON.stringify(wipe));
  const sw = await p.evaluate(() => { S.professionalTracks.activeId = "general-english"; selectProfessionalTrack("welding"); return { area: areaId(), context: ProfessionalTrackContext.active().id }; });
  ok("S5 · the normal switch still works (General English → Welding)", sw.area === "welding" && sw.context === "welding", JSON.stringify(sw));
  ok("S6 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# the account copy follows a switch at once (the partner Worker reads the programme from it)");
{
  const { ctx, p, errs } = await open("general-english");
  const w = await p.evaluate(async () => {
    const writes = [];
    FBdb = { collection: () => ({ doc: uid => ({ set: async d => { writes.push({ uid, at: Date.now(), track: JSON.parse(d.json).professionalTracks.activeId }); }, get: async () => ({ exists: false }) }) }) };
    window.firebase = window.firebase || { firestore: { FieldValue: { serverTimestamp: () => "ts" } } };
    FBUser = { uid: "u-sw", email: "a@b.c", getIdToken: async () => "t" };
    const t0 = Date.now(); selectProfessionalTrack("welding");
    await new Promise(r => setTimeout(r, 900)); const soon = writes.slice();
    const t1 = Date.now(); areaSwitch("general-english", "practice");
    await new Promise(r => setTimeout(r, 900)); const back = writes.slice(soon.length);
    /* an ordinary edit still waits for the burst to end */
    const t2 = Date.now(); save(); await new Promise(r => setTimeout(r, 900)); const edit = writes.length - soon.length - back.length;
    FBUser = null; FBdb = null;
    return { soon: soon.map(x => ({ track: x.track, ms: x.at - t0 })), back: back.map(x => ({ track: x.track, ms: x.at - t1 })), edit };
  });
  ok("S7 · switching to Welding while signed in writes 'welding' to the account copy within a second (not after the 2.5 s debounce)", w.soon.length >= 1 && w.soon[w.soon.length - 1].track === "welding" && w.soon[0].ms < 900, JSON.stringify(w));
  ok("S8 · switching back (areaSwitch) writes 'general-english' at once too", w.back.length >= 1 && w.back[w.back.length - 1].track === "general-english", JSON.stringify(w));
  ok("S9 · an ordinary edit still debounces (no write within 0.9 s)", w.edit === 0, JSON.stringify(w));
  ok("S10 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
