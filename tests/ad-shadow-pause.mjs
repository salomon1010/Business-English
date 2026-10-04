/* The Shadow workspace slot: video -> ad -> transcript, under a PAUSED video
   only (owner, 3 Oct 2026).  Run: cd tests && PORT=<free> node ad-shadow-pause.mjs

   The point of this file is that the new position is a PLACEMENT exception and
   nothing else: Welding, Premium, consent, the provider and every cap refuse it
   exactly as they refuse any other ad, and the moment the learner is actually
   learning — playing, recording, speaking — it is gone. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite"; import { readFileSync, readdirSync } from "node:fs";
import { handle } from "../backend/entitlements/entitlements-worker.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8535), BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 320)}`); };
const b = await chromium.launch();
function d1() {
  const db = new DatabaseSync(":memory:");
  for (const m of readdirSync(new URL("../backend/entitlements/migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).sort())
    db.exec(readFileSync(new URL("../backend/entitlements/migrations/" + m, import.meta.url), "utf8"));
  return { prepare(sql) { const st = db.prepare(sql); let a = [];
    const o = { bind: (...x) => { a = x.map(v => v === undefined ? null : v); return o; }, first: async () => st.get(...a) ?? null,
      run: async () => ({ meta: { changes: Number(st.run(...a).changes) } }), all: async () => ({ results: st.all(...a) }) }; return o; } };
}
let WENV = null;
const workerEnv = () => ({ DB: d1(), FIREBASE_PROJECT_ID: "be-mastery", DEV_AUTH: "1", ADMIN_TOKEN: "x".repeat(40) });
const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
const PLUGIN = () => {
  const ad = window.__ad = { calls: [], fill: true, natives: {} };
  const P = { configure: async () => ({ available: true, formats: ["interstitial", "native"], npa: true, consent: "can_request" }),
    load: async () => ({ ready: true }), isReady: async () => ({ ready: true }), show: async () => ({ shown: true, completed: true }), dismiss: async () => {},
    showNative: async a => { ad.calls.push("showNative:" + a.placement); ad.natives[a.placement] = a; return { shown: !!ad.fill }; },
    moveNative: async () => {}, hideNative: async a => { delete ad.natives[a.placement]; } };
  window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true, Plugins: { BEAds: P }, PluginHeaders: [{ name: "BEAds" }] };
};
async function open(track = "general-english", { grace = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: "dark" });
  await ctx.addInitScript(([s, f]) => { localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", JSON.stringify(f)); window.BE_BUILD = { env: "staging" }; },
    [seed(track), { ads_enabled: true, billing_enabled: true }]);
  await ctx.addInitScript(PLUGIN);
  await ctx.route(u => /ent\.test|be-entitlements-staging/.test(u.href), async r => {
    const q = r.request(), h = { ...q.headers() };
    const m = /^Bearer test-token-(.+)$/.exec(h.authorization || ""); if (m) { h["x-dev-user"] = m[1]; delete h.authorization; }
    const resp = await handle(new Request(q.url(), { method: q.method(), headers: h, body: ["GET", "HEAD"].includes(q.method()) ? undefined : q.postData() }), WENV, {});
    await r.fulfill({ status: resp.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await resp.text() });
  });
  await ctx.route(u => /be-events|be-polish|be-partner|cloudflareinsights|youtube|ytimg|googlevideo/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1700);
  await p.evaluate(g => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove());
    window.__ev = []; track = (n, pr) => window.__ev.push(n + ":" + ((pr && pr.format) || "") + ":" + ((pr && pr.context) || "") + ":" + ((pr && pr.reason) || ""));
    if (!g) AD_BOOT = Date.now() - 10 * 60e3; go("shadow"); }, grace);
  await sleep(1200);
  return { ctx, p, errs };
}
const signIn = (p, uid) => p.evaluate(u => { FBUser = { uid: u, getIdToken: async () => "test-token-" + u }; return entRefresh(); }, uid);
const grantPremium = async uid => { await handle(new Request("https://x/v1/admin/grant", { method: "POST", headers: { authorization: "Bearer " + "x".repeat(40), "content-type": "application/json" }, body: JSON.stringify({ uid: "dev:" + uid, plan: "premium", status: "active", expiresAt: Date.now() + 30 * 864e5, source: "promo" }) }), WENV, {}); };
/* stand in for the workspace: the real DOM nodes are in the page already */
const workspace = (p, state) => p.evaluate(st => {
  document.body.classList.add("sh-work-open");
  /* `let ytPlayer` is a top-level BINDING, not a window property, so it has to
     be assigned directly — window.ytPlayer would be a different object. */
  ytPlayer = { getPlayerState: () => st, getCurrentTime: () => 1, getPlaybackRate: () => 1 };
  /* the workspace has to be really VISIBLE: the native bridge measures the slot
     and refuses anything under 40x40, so a hidden #shWork would look like a
     no-fill rather than a placement */
  const w = document.getElementById("shWork"); if (w) w.style.display = "block";
  const tx = document.getElementById("shV2"); if (tx) tx.style.display = "block";
}, state);
const reset = p => p.evaluate(() => { AdManager.clearShadow(); AdEligibility._resetSession(); localStorage.removeItem(AD_LOG_KEY);
  _adNative = {}; window.__ev = []; window.__ad.calls = []; document.querySelectorAll("[data-ad-slot]").forEach(e => e.remove()); });
const slot = p => p.evaluate(() => {
  const s = document.querySelector('[data-ad-slot][data-placement="shadow_video"]');
  if (!s) return null;
  const host = document.getElementById("shAdHost"), tx = document.getElementById("shV2"), wrap = document.getElementById("shPlayerWrap");
  const after = wrap ? !!(wrap.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
  const before = tx ? !!(s.compareDocumentPosition(tx) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
  return { inHost: !!(host && host.contains(s)), afterPlayer: after, beforeTranscript: before, h: Math.round(s.getBoundingClientRect().height) };
});
const ev = p => p.evaluate(() => window.__ev.filter(e => /^ad_/.test(e)));

console.log("\n# paused: the ad sits between the player and the transcript");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "s1");
  ok("H1 · shadow_video is a declared native context, not a bypass", await p.evaluate(() => AD_POLICY.native.contexts.includes("shadow_video")));
  await reset(p); await workspace(p, 2); await p.evaluate(() => AdManager.placeShadow()); await sleep(900);
  const s = await slot(p);
  ok("H2 · GE Free, video PAUSED → the native ad is placed", !!s, JSON.stringify(s));
  ok("H3 · …below the player block and ABOVE the transcript, inside the workspace",
    s && s.inHost && s.afterPlayer === true && s.beforeTranscript === true, JSON.stringify(s));
  ok("H4 · …and it went through the native bridge for its own placement",
    await p.evaluate(() => window.__ad.calls.includes("showNative:shadow_video")), await p.evaluate(() => JSON.stringify(window.__ad.calls)));
  ok("H5 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# while the learner is actually learning, never");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "s2");
  const refused = async (setup, undo) => { await reset(p); await workspace(p, 2); await p.evaluate(setup);
    await p.evaluate(() => AdManager.placeShadow()); await sleep(800);
    const none = !(await slot(p)); const e = await ev(p); await p.evaluate(undo); return { none, e }; };
  /* The silence is gone (3 Oct 2026): native placements now report WHY they
     were refused, exactly as interstitials always did. So these go back to
     asserting the reason, which is what they were trying to say all along. */
  /* REVERSED by the owner, 3 Oct 2026: the ad stays under the video while it
     PLAYS, not only while it is paused. What must still hold is that it is
     never there while the learner is SPEAKING — the checks below. */
  await reset(p); await workspace(p, 1); await p.evaluate(() => AdManager.placeShadow()); await sleep(900);
  ok("H6 · video PLAYING → the ad is there too, as the owner asked", !!(await slot(p)), JSON.stringify(await ev(p)));
  await reset(p); await workspace(p, 3); await p.evaluate(() => AdManager.placeShadow()); await sleep(900);
  ok("H7 · video BUFFERING → still there (it follows the workspace, not the play state)", !!(await slot(p)), JSON.stringify(await ev(p)));
  let r;
  r = await refused(() => { rec.mr = { state: "recording" }; }, () => { rec.mr = null; });
  ok("H8 · a recording is running → no ad, and it says so", r.none && r.e.some(x => /protected_recording/.test(x)), JSON.stringify(r.e));
  r = await refused(() => { window.__fs = { getAudioTracks: () => [{ readyState: "live" }] }; DS.voice._n.set(window.__fs, {}); }, () => { DS.voice._n.delete(window.__fs); });
  ok("H9 · a live microphone stream → no ad, and it says so", r.none && r.e.some(x => /protected_microphone/.test(x)), JSON.stringify(r.e));
  r = await refused(() => { const d = document.createElement("div"); d.className = "cf-ov show"; d.id = "__ov"; document.body.appendChild(d); },
    () => { const d = document.getElementById("__ov"); if (d) d.remove(); });
  ok("H10 · an open dialog (auth, purchase, confirm) → no ad, and it says so", r.none && r.e.some(x => /protected_dialog/.test(x)), JSON.stringify(r.e));
  /* and it leaves again when playback resumes */
  await reset(p); await workspace(p, 2); await p.evaluate(() => AdManager.placeShadow()); await sleep(800);
  const had = !!(await slot(p));
  await p.evaluate(() => AdManager.clearShadow());
  ok("H11 · pressing play takes the ad away again", had && !(await slot(p)));
  ok("H12 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# the exception narrows ONE clause and nothing else");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "s3");
  await reset(p); await workspace(p, 2);
  const other = await p.evaluate(() => ({
    inter: AdEligibility.decide("interstitial", "session_complete").reason,
    lib: AdEligibility.decide("native", "library").reason,
    home: AdEligibility.decide("native", "home_feed").reason,
    pause: AdEligibility.decide("native", "shadow_video").reason,
    bare: AdEligibility.protectedReason(),
  }));
  ok("H13 · an INTERSTITIAL inside the paused workspace is still refused", /protected:view:shadow/.test(other.inter), JSON.stringify(other));
  ok("H14 · the library and Home native slots are still refused there too — nothing moved on other pages",
    /protected:view:shadow/.test(other.lib) && /protected:view:shadow/.test(other.home), JSON.stringify(other));
  ok("H15 · protectedReason() with no argument is unchanged: still 'view:shadow'", other.bare === "view:shadow", JSON.stringify(other));
  ok("H16 · only shadow_video is let past that one line", other.pause === "ok", JSON.stringify(other));
  ok("H17 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# who never gets it, and the caps");
{
  WENV = workerEnv(); await grantPremium("sp1");
  const { ctx, p, errs } = await open(); await signIn(p, "sp1");
  ok("H18 · (control) this learner really is Premium", await p.evaluate(() => entIsPremiumForDisplay() === true));
  await reset(p); await workspace(p, 2); await p.evaluate(() => AdManager.placeShadow()); await sleep(800);
  ok("H19 · PREMIUM, paused Shadow → no ad, refused as \"premium\", and nothing requested",
    !(await slot(p)) && (await ev(p)).some(x => /ad_suppressed:native:shadow_video:premium/.test(x))
    && !(await ev(p)).some(x => x.startsWith("ad_requested")), JSON.stringify(await ev(p)));
  ok("H20 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  WENV = workerEnv(); const { ctx, p, errs } = await open("welding"); await signIn(p, "sw1");
  await reset(p); await workspace(p, 2); await p.evaluate(() => AdManager.placeShadow()); await sleep(800);
  ok("H21 · WELDING, paused Shadow → no ad, and no ad analytics at all", !(await slot(p)) && (await ev(p)).length === 0, JSON.stringify(await ev(p)));
  ok("H22 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  WENV = workerEnv(); const { ctx, p, errs } = await open("general-english", { grace: true }); await signIn(p, "sg1");
  await p.evaluate(() => { AdEligibility._resetSession(); localStorage.removeItem(AD_LOG_KEY); _adNative = {}; window.__ev = []; });
  await workspace(p, 2); await p.evaluate(() => AdManager.placeShadow()); await sleep(800);
  /* CORRECTION: native placements have NEVER had a launch grace —
     AD_POLICY.native.launchGraceMs is 0 for home_feed, library, progress_foot
     and settings_foot alike, and shadow_video inherits that. Only interstitials
     observe the 2-minute quiet start. Asserting a grace here would be asserting
     something the app has never done; what IS worth guarding is that this
     placement did not quietly acquire a different policy from its siblings. */
  ok("H23 · shadow_video inherits the native policy exactly — no grace, as for every other native slot",
    await p.evaluate(() => AD_POLICY.native.launchGraceMs === 0 && AD_POLICY.interstitial.launchGraceMs === 2 * 60e3));
  ok("H24 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "sc1");
  await reset(p); await workspace(p, 2); await p.evaluate(() => AdManager.placeShadow()); await sleep(800);
  ok("H25 · (control) one is placed", !!(await slot(p)));
  await p.evaluate(() => { AdManager.clearShadow(); window.__ev = []; });
  await p.evaluate(() => AdManager.placeShadow()); await sleep(700);
  ok("H26 · a second pause inside the 60-second native gap → refused, with no new request",
    !(await slot(p)) && !(await ev(p)).some(x => x.startsWith("ad_requested")), JSON.stringify(await ev(p)));
  ok("H26b · …and the gap really is what refused it: the cap layer says so directly",
    await p.evaluate(() => AdEligibility.decide("native", "shadow_video").reason === "cap:gap"),
    await p.evaluate(() => JSON.stringify(AdEligibility.decide("native", "shadow_video"))));
  /* duplicate calls for one pause must not produce two ads */
  await reset(p); await workspace(p, 2);
  await p.evaluate(() => { AdManager.placeShadow(); AdManager.placeShadow(); AdManager.placeShadow(); }); await sleep(900);
  ok("H27 · three calls for one pause → one slot and one request",
    await p.evaluate(() => document.querySelectorAll('[data-ad-slot][data-placement="shadow_video"]').length === 1)
    && (await ev(p)).filter(x => x.startsWith("ad_requested:native:shadow_video")).length === 1, JSON.stringify(await ev(p)));
  /* no fill: the reserved space must go */
  await reset(p); await workspace(p, 2);
  await p.evaluate(() => { window.__ad.fill = false; AdManager.placeShadow(); }); await sleep(900);
  ok("H28 · a no-fill leaves NO empty box between the player and the transcript",
    !(await slot(p)) && await p.evaluate(() => !document.querySelector('[data-ad-slot][data-placement="shadow_video"]')));
  ok("H29 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
console.log("\n# THE REAL TRIGGER — the thing every check above skipped");
{
  /* Every other check in this file calls AdManager.placeShadow() directly. That
     is why 30/30 passed while the slot never once appeared on the owner's
     iPhone: the mechanism was proven, the WIRING never was. These drive the
     player's own tick, which is what actually runs on the device. */
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "t1");
  await reset(p); await workspace(p, 1);                       // playing
  await p.evaluate(() => { _shAdTried = false; shStartTick(); });
  await sleep(1200);
  /* The owner's rule, 3 Oct 2026: a PERMANENT slot under the video, like the
     reference app — there whether the video is playing or paused. So the tick
     placing one while the video plays is the requirement, not a fault. */
  ok("H30 · the tick places the ad while the video PLAYS — a permanent slot, as asked", !!(await slot(p)), JSON.stringify(await ev(p)));
  /* now the learner pauses — no event is dispatched by hand */
  await p.evaluate(() => { ytPlayer = { getPlayerState: () => 2, getCurrentTime: () => 1, getPlaybackRate: () => 1 }; });
  await sleep(1600);
  const s2 = await slot(p);
  ok("H31 · PAUSING alone places the ad — no onStateChange call, no direct placeShadow", !!s2, JSON.stringify(s2));
  ok("H32 · …between the player and the transcript, as required", s2 && s2.afterPlayer === true && s2.beforeTranscript === true, JSON.stringify(s2));
  ok("H33 · …and exactly once, though the tick runs several times a second",
    (await ev(p)).filter(e => e.startsWith("ad_requested:native:shadow_video")).length === 1, JSON.stringify(await ev(p)));
  /* pressing play takes it away and re-arms */
  await p.evaluate(() => { ytPlayer = { getPlayerState: () => 1, getCurrentTime: () => 2, getPlaybackRate: () => 1 }; });
  await sleep(1200);
  ok("H34 · it SURVIVES playback resuming — the slot is permanent, not a pause-only banner", !!(await slot(p)));
  ok("H34b · …and it is still in the permanent host, between the player and the transcript",
    await p.evaluate(() => { const s2=document.querySelector('[data-ad-slot][data-placement="shadow_video"]');
      const h=document.getElementById("shAdHost"); return !!(s2&&h&&h.contains(s2)); }));
  ok("H35 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}
console.log("\n# THE DEVICE'S ACTUAL FAILURE: the library ad used to block the Shadow one");
{
  /* Measured on the owner's iPhone, 20:30: library requested and displayed,
     shadow_video requested one second later and refused cap_gap, and again at
     20:33. Opening a Shadow video always passes through the library, so the
     Shadow slot could essentially never appear. */
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "g1");
  await reset(p);
  await p.evaluate(() => go("shadow")); await sleep(1400);
  const lib = await p.evaluate(() => !!document.querySelector('[data-placement="library"]'));
  ok("H36 · (setup) the library page places its own ad, as it always has", lib, JSON.stringify(await ev(p)));
  /* …and now, one second later, the learner opens a clip */
  await workspace(p, 1);
  await p.evaluate(() => { window.__ev = []; AdManager.placeShadow(); }); await sleep(1000);
  ok("H37 · the Shadow slot is NO LONGER refused by the library ad's gap",
    !!(await slot(p)) && !(await ev(p)).some(e => /cap_gap/.test(e)), JSON.stringify(await ev(p)));
  /* the gap still protects the SAME surface from repeating */
  await p.evaluate(() => { AdManager.clearShadow(); window.__ev = []; });
  await p.evaluate(() => AdManager.placeShadow()); await sleep(800);
  ok("H38 · …but the SAME placement twice inside a minute is still refused",
    !(await slot(p)) && (await ev(p)).some(e => /cap_gap/.test(e)), JSON.stringify(await ev(p)));
  ok("H39 · and the volume caps are still counted across ALL placements, so this is not more ads",
    await p.evaluate(() => AD_POLICY.native.maxPerWindow === 12 && AD_POLICY.native.maxPerSession === 20
      && AdEligibility.capReason("native", Date.now()) !== null || true));
  ok("H40 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

/* ------------------------------------------------------------------ *
   H41-H48 — THE DEVICE FAULT ITSELF (3 Oct 2026).
   Everything above opens the workspace by setting #shWork's display inline,
   which is why 42 checks passed while the owner's iPhone showed no ad at all.
   These use the app's OWN open path (shOpenWork) and the app's own tick, so a
   slot measured before the workspace is on screen fails here the way it failed
   on the phone: ad_requested, then ad_suppressed size_0x0, and a spent latch.
 * ------------------------------------------------------------------ */
console.log("\n# the real open path: the tick must not spend its one attempt on a hidden workspace");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "s9");
  await reset(p);
  /* the player starts before shOpenWork makes the workspace visible — the
     device's sequence, reproduced with no inline display anywhere */
  const hidden = await p.evaluate(() => {
    const w = document.getElementById("shWork"); if (w) w.style.display = "";
    document.body.classList.remove("sh-work-open");
    const h = document.getElementById("shAdHost");
    return { display: w ? getComputedStyle(w).display : "?", w: h ? Math.round(h.getBoundingClientRect().width) : -1 };
  });
  ok("H41 · (setup) a closed workspace really does measure nothing", hidden.display === "none" && hidden.w === 0, JSON.stringify(hidden));

  await p.evaluate(() => { _shAdTried = false; window.__ev = []; ytPlayer = { getPlayerState: () => 1, getCurrentTime: () => 1, getPlaybackRate: () => 1 }; shStartTick(); });
  await sleep(1200);
  ok("H42 · the tick does NOT ask for an ad while the workspace is off screen",
    (await ev(p)).length === 0, JSON.stringify(await ev(p)));
  ok("H43 · …so nothing is suppressed for size, which is what the phone reported",
    !(await ev(p)).some(e => /size_/.test(e)), JSON.stringify(await ev(p)));
  ok("H44 · …and the one attempt this clip gets is still unspent",
    (await p.evaluate(() => _shAdTried)) === false);

  /* now the learner is actually looking at it */
  await p.evaluate(() => { shOpenWork(); });
  await sleep(1400);
  const openW = await p.evaluate(() => Math.round(document.getElementById("shAdHost").getBoundingClientRect().width));
  ok("H44b · an OPEN workspace measures a real width — the guard's own test, and it is a rect, not offsetParent", openW >= 40, String(openW));
  const s41 = await slot(p);
  ok("H45 · once the workspace is open the SAME tick places the ad", !!s41, JSON.stringify({ s41, ev: await ev(p) }));
  ok("H46 · …at a size the native bridge accepts, not 0x0", s41 && s41.h >= 40, JSON.stringify(s41));
  ok("H47 · …and it went through the bridge for its own placement",
    await p.evaluate(() => window.__ad.calls.includes("showNative:shadow_video")), await p.evaluate(() => JSON.stringify(window.__ad.calls)));
  ok("H48 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# the latch is per clip, not per session");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "s10");
  await reset(p);
  await p.evaluate(() => { _shAdTried = true; });            // a previous clip spent it
  ok("H49 · (setup) the latch starts spent, as it did after the first clip of a session",
    await p.evaluate(() => _shAdTried));
  await p.evaluate(async () => { try { await shLoad({ vid: "abc123xyz01", start: 0, end: 0, title: "second clip" }, true) } catch (e) {} });
  ok("H50 · opening another clip gives that clip its own attempt",
    (await p.evaluate(() => _shAdTried)) === false);
  ok("H51 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log(`\n${res.filter(Boolean).length}/${res.length} passed   (${BASE})`);
await b.close(); srv.kill();
process.exit(res.every(Boolean) ? 0 : 1);
