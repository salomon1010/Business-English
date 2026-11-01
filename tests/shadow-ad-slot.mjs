/* THE SHADOW STUDIO AD SLOT — one slot, one place, never over the lesson.
   Run: cd tests && PORT=<free> node shadow-ad-slot.mjs

   Written from four photos of the owner's phone (12 Oct 2026) that showed
   THREE things at once: an ad halfway down the transcript, an ad floating over
   the speaking report, and two ads on screen together. None of them was the
   workspace's own slot misbehaving — they were the LIBRARY's two slots
   (library, library_top), still followed and still drawn by the shell on top
   of a full-screen overlay the page had put in front of them. A native-SDK ad
   is a platform view above the WebView: the page cannot cover it, so the page
   has to say so.

   What this file pins down:
     1  exactly one ad slot in the Shadow workspace;
     2  it is a sibling of the player block and the transcript, between them,
        in every mode — Watch moved the transcript and used to leave it behind;
     3  it is never inside the transcript or one of its paragraphs;
     4  the slot is ordinary flow — no fixed, no absolute, no transform;
     5  re-rendering, changing mode, changing the transcript and recording
        neither duplicate nor move it;
     6  a no-fill leaves the lesson whole;
     7  Premium and the ads_enabled flag still refuse it;
     8  it fits three real phone widths without overflow or overlap;
     9  a slot the learner cannot see is told to HIDE — the actual fault. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite"; import { readFileSync, readdirSync } from "node:fs";
import { handle } from "../backend/entitlements/entitlements-worker.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8571), BASE = `http://127.0.0.1:${PORT}/`;
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
/* the shell, recording what it is told to draw AND where — `moves` is the
   whole point of this file: the shell never decides, it is told. */
const PLUGIN = () => {
  const ad = window.__ad = { calls: [], moves: [], hidden: [], fill: true, natives: {}, vis: {} };
  const P = { configure: async () => ({ available: true, formats: ["interstitial", "native"], npa: true, consent: "can_request" }),
    load: async () => ({ ready: true }), isReady: async () => ({ ready: true }), show: async () => ({ shown: true, completed: true }), dismiss: async () => {},
    showNative: async a => { ad.calls.push("showNative:" + a.placement); ad.natives[a.placement] = a;
      if (ad.fill) ad.vis[a.placement] = a.visible !== false; return { shown: !!ad.fill }; },
    moveNative: async a => { ad.moves.push({ placement: a.placement, visible: a.visible !== false, y: a.y, h: a.h });
      if (a.placement in ad.vis) ad.vis[a.placement] = a.visible !== false; },
    hideNative: async a => { ad.hidden.push(a.placement || "*");
      if (a.placement) { delete ad.natives[a.placement]; delete ad.vis[a.placement]; } else { ad.natives = {}; ad.vis = {}; } } };
  window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true, Plugins: { BEAds: P }, PluginHeaders: [{ name: "BEAds" }] };
};
async function open(track = "general-english", viewport = { width: 390, height: 844 }) {
  const ctx = await b.newContext({ viewport, serviceWorkers: "block", colorScheme: "dark" });
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
  await p.evaluate(() => { document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove());
    window.__ev = []; track = (n, pr) => window.__ev.push(n + ":" + ((pr && pr.format) || "") + ":" + ((pr && pr.context) || "") + ":" + ((pr && pr.reason) || ""));
    AD_BOOT = Date.now() - 10 * 60e3; go("shadow"); });
  await sleep(1200);
  return { ctx, p, errs };
}
const signIn = (p, uid) => p.evaluate(u => { FBUser = { uid: u, getIdToken: async () => "test-token-" + u }; return entRefresh(); }, uid);
const grantPremium = async uid => { await handle(new Request("https://x/v1/admin/grant", { method: "POST", headers: { authorization: "Bearer " + "x".repeat(40), "content-type": "application/json" }, body: JSON.stringify({ uid: "dev:" + uid, plan: "premium", status: "active", expiresAt: Date.now() + 30 * 864e5, source: "promo" }) }), WENV, {}); };
/* the workspace as the learner sees it: visible, a transcript in it, paused */
const workspace = (p, state = 2) => p.evaluate(st => {
  document.body.classList.add("sh-work-open");
  ytPlayer = { getPlayerState: () => st, getCurrentTime: () => 1, getPlaybackRate: () => 1 };
  const w = document.getElementById("shWork"); if (w) w.style.display = "block";
  const tx = document.getElementById("shV2");
  if (tx) { tx.style.display = "block"; tx.innerHTML = '<div class="sv-tx" id="svTx">' +
    Array.from({ length: 8 }, (_, i) => `<p class="sv-seg" data-i="${i}">Line ${i} of the transcript, long enough to wrap on a phone and take some height.</p>`).join("") + "</div>"; }
}, state);
const reset = p => p.evaluate(() => { AdManager.clearShadow(); AdEligibility._resetSession(); localStorage.removeItem(AD_LOG_KEY);
  _adNative = {}; window.__ev = []; window.__ad.calls = []; window.__ad.moves = []; window.__ad.hidden = []; window.__ad.vis = {};
  document.querySelectorAll("[data-ad-slot]").forEach(e => e.remove()); });
/* everything this file asks about the slot, in one read */
const look = p => p.evaluate(() => {
  const work = document.getElementById("shWork"), host = document.getElementById("shAdHost");
  const tx = document.getElementById("shV2"), stick = document.querySelector("#shPlayerWrap .sh-stick");
  const all = [...document.querySelectorAll("[data-ad-slot]")];
  const inWork = all.filter(s => work && work.contains(s));
  const s = inWork[0] || null;
  const r = e => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) }; };
  const cs = s && getComputedStyle(s), csb = s && getComputedStyle(s.querySelector(".ad-native-body") || s);
  return {
    total: all.length, inWork: inWork.length,
    placement: s && s.getAttribute("data-placement"),
    inHost: !!(s && host && host.contains(s)),
    hostBeforeTx: !!(host && tx && tx.previousElementSibling === host),
    hostIsChildOfWrap: !!(host && host.parentElement && host.parentElement.id === "shPlayerWrap"),
    siblingOfTx: !!(s && tx && host && host.parentElement === tx.parentElement),
    insideTranscript: !!(s && (tx && tx.contains(s) || s.closest(".sv-seg,.sv-para,.sv-tx"))),
    afterPlayer: !!(s && stick && (stick.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)),
    beforeTx: !!(s && tx && (s.compareDocumentPosition(tx) & Node.DOCUMENT_POSITION_FOLLOWING)),
    pos: cs && cs.position, posBody: csb && csb.position, transform: cs && cs.transform,
    offsets: cs ? [cs.top, cs.right, cs.bottom, cs.left] : [],
    rect: s ? r(s) : null, txRect: tx ? r(tx) : null, stickRect: stick ? r(stick) : null,
    docW: Math.round(document.documentElement.getBoundingClientRect().width),
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    txVisible: !!(tx && tx.getBoundingClientRect().height > 0),
    recVisible: !!document.querySelector("#shPlayerWrap .rec-panel"),
  };
});
const place = async (p, mode) => { await p.evaluate(m => { svMode = m; svPlace(m === "watch"); }, mode); await sleep(60); };

console.log("\n# 1-4 · ONE slot, between the player and the transcript, in ordinary flow");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "a1");
  await reset(p); await workspace(p); await p.evaluate(() => AdManager.placeShadow()); await sleep(900);
  const v = await look(p);
  ok("S1 · the Shadow workspace carries exactly ONE ad slot", v.inWork === 1, JSON.stringify(v));
  ok("S2 · …and it is the workspace's own placement, not a library ad drawn into it", v.placement === "shadow_video", JSON.stringify(v));
  ok("S3 · it lives in the permanent host, a direct child of the player wrapper", v.inHost && v.hostIsChildOfWrap, JSON.stringify(v));
  ok("S4 · the host is the transcript's immediate previous sibling — video → ad → transcript", v.hostBeforeTx && v.siblingOfTx, JSON.stringify(v));
  ok("S5 · it follows the player block and precedes the transcript in document order", v.afterPlayer && v.beforeTx, JSON.stringify(v));
  ok("S6 · it is NOT inside the transcript, a paragraph or a line", v.insideTranscript === false, JSON.stringify(v));
  /* `relative` with no offset IS document flow: the strip needs a containing
     block for its small corner "Ad" chip, which is the one absolutely-placed
     thing here and is required by the network. What is forbidden is a slot
     taken OUT of flow — fixed or absolute — or nudged off its own box. */
  ok("S7 · the slot is ordinary document flow — never fixed or absolute, and never offset",
    v.pos !== "fixed" && v.pos !== "absolute" && v.pos !== "sticky" && v.posBody !== "fixed" && v.posBody !== "absolute"
    && v.offsets.every(o => o === "auto" || o === "0px"), JSON.stringify({ pos: v.pos, posBody: v.posBody, offsets: v.offsets }));
  ok("S8 · …and it is not moved by a transform either", v.transform === "none" || v.transform === "", String(v.transform));
  ok("S9 · it sits BELOW the player, with no overlap", v.rect && v.stickRect && v.rect.y >= v.stickRect.bottom - 1, JSON.stringify({ ad: v.rect, player: v.stickRect }));
  ok("S10 · …and ABOVE the transcript, with no overlap", v.rect && v.txRect && v.rect.bottom <= v.txRect.y + 1, JSON.stringify({ ad: v.rect, tx: v.txRect }));
  ok("S11 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# 5 · the order is the same in every mode, and nothing duplicates or relocates it");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "a2");
  await reset(p); await workspace(p); await p.evaluate(() => AdManager.placeShadow()); await sleep(900);
  for (const m of ["watch", "shadow", "challenge", "watch"]) {
    await place(p, m); const v = await look(p);
    ok(`S12 · ${m}: still one slot, still between the video and the transcript`,
      v.inWork === 1 && v.hostBeforeTx && v.afterPlayer && v.beforeTx && !v.insideTranscript, JSON.stringify(v));
  }
  /* WATCH WAS THE BROKEN ONE: svPlace(true) lifts the transcript above the clip
     tools, and the host used to stay behind it — so the order read
     video → transcript → ad, and shLowerShow then set the host display:none. */
  await place(p, "watch");
  ok("S13 · Watch does not hide the host behind shLowerShow's sibling walk",
    await p.evaluate(() => { shLowerShow(false); const h = document.getElementById("shAdHost"); svPlace(true);
      return getComputedStyle(h).display !== "none" && h.getBoundingClientRect().height > 0; }));
  /* a transcript rebuild, the kind svRender does on every tick of new captions */
  await p.evaluate(() => { const tx = document.getElementById("shV2");
    tx.innerHTML = '<div class="sv-tx" id="svTx"><p class="sv-seg" data-i="0">A completely new transcript.</p></div>'; svPlace(svMode === "watch"); });
  await sleep(150);
  const afterTx = await look(p);
  ok("S14 · rebuilding the transcript neither duplicates the slot nor moves it", afterTx.inWork === 1 && afterTx.hostBeforeTx && afterTx.beforeTx, JSON.stringify(afterTx));
  /* placeShadow again, as the player tick does whenever the state changes */
  await p.evaluate(() => { AdManager.placeShadow(); AdManager.placeShadow(); }); await sleep(700);
  const twice = await look(p);
  ok("S15 · asking twice more does not add a second slot", twice.inWork === 1, JSON.stringify(twice));
  ok("S16 · …and the shell was asked to draw the workspace placement once",
    await p.evaluate(() => window.__ad.calls.filter(c => c === "showNative:shadow_video").length) === 1,
    await p.evaluate(() => JSON.stringify(window.__ad.calls)));
  /* starting to record: an ad must not be beside a live microphone */
  await p.evaluate(() => { rec = Object.assign(rec || {}, { mr: { state: "recording" } }); AdManager.placeShadow(); }); await sleep(400);
  ok("S17 · starting to record adds no slot (protected:recording, as before)", (await look(p)).inWork === 1, JSON.stringify(await look(p)));
  await p.evaluate(() => { rec.mr = null; }); await sleep(100);
  ok("S18 · …and stopping leaves the original one where it was", (await look(p)).hostBeforeTx);
  ok("S19 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# 6 · a no-fill leaves the lesson whole");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "a3");
  await reset(p); await workspace(p);
  await p.evaluate(() => { window.__ad.fill = false; AdManager.placeShadow(); }); await sleep(900);
  const v = await look(p);
  ok("S20 · no fill → no labelled empty box is left in the middle of the lesson", v.inWork === 0, JSON.stringify(v));
  ok("S21 · …the transcript is still there", v.txVisible, JSON.stringify(v));
  ok("S22 · …the practice controls are still there", v.recVisible);
  ok("S23 · …and the shell was told, so it is a no_fill in the data, not silence",
    (await p.evaluate(() => window.__ev)).some(e => /ad_suppressed:native:shadow_video:no_fill/.test(e)), JSON.stringify(await p.evaluate(() => window.__ev)));
  ok("S24 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log("\n# 7 · Premium and the flag still refuse it");
{
  WENV = workerEnv(); await grantPremium("a4");
  const { ctx, p, errs } = await open(); await signIn(p, "a4"); await sleep(500);
  await reset(p); await workspace(p); await p.evaluate(() => AdManager.placeShadow()); await sleep(800);
  ok("S25 · (control) the learner really is Premium", await p.evaluate(() => entIsPremiumForDisplay() === true));
  ok("S26 · Premium → no slot in the workspace", (await look(p)).inWork === 0, JSON.stringify(await look(p)));
  await ctx.close();
  WENV = workerEnv(); const f = await open(); await signIn(f.p, "a5");
  await f.p.evaluate(() => { const o = JSON.parse(localStorage.getItem("be_flags") || "{}"); o.ads_enabled = false; localStorage.setItem("be_flags", JSON.stringify(o)); _flags = null; });
  await reset(f.p); await workspace(f.p); await f.p.evaluate(() => AdManager.placeShadow()); await sleep(800);
  ok("S27 · ads_enabled off → no slot", (await look(f.p)).inWork === 0, JSON.stringify(await look(f.p)));
  ok("S28 · no JavaScript errors", errs.length === 0 && f.errs.length === 0, JSON.stringify(errs.concat(f.errs)));
  await f.ctx.close();
}

console.log("\n# 8 · three real phone widths");
{
  for (const width of [360, 390, 412]) {
    WENV = workerEnv(); const { ctx, p, errs } = await open("general-english", { width, height: 780 }); await signIn(p, "w" + width);
    await reset(p); await workspace(p); await p.evaluate(() => AdManager.placeShadow()); await sleep(900);
    const v = await look(p);
    ok(`S29 · ${width}px: the slot is placed and spans the screen without overflowing it`,
      v.inWork === 1 && v.rect && v.rect.w > 0 && v.rect.w <= width && v.scrollW <= v.clientW + 1, JSON.stringify(v));
    ok(`S30 · ${width}px: still player → ad → transcript, no overlap either side`,
      v.rect.y >= v.stickRect.bottom - 1 && v.rect.bottom <= v.txRect.y + 1, JSON.stringify({ ad: v.rect, player: v.stickRect, tx: v.txRect }));
    ok(`S31 · ${width}px: no JavaScript errors`, errs.length === 0, JSON.stringify(errs));
    await ctx.close();
  }
}

console.log("\n# 9 · THE FAULT: a slot the learner cannot see must be told to hide");
{
  WENV = workerEnv(); const { ctx, p, errs } = await open(); await signIn(p, "a9");
  await reset(p);
  /* the library page places its own ad, as it always has — this is the step the
     learner always passes through on the way to a clip */
  await p.evaluate(() => AdManager.placeNative("shadow")); await sleep(900);
  const lib = await p.evaluate(() => !!document.querySelector('[data-ad-slot][data-placement="library"]'));
  ok("S32 · (setup) the Shadow LIBRARY page places its own native ad", lib, JSON.stringify(await p.evaluate(() => window.__ev)));
  ok("S33 · (setup) the shell is following it", await p.evaluate(() => window.__ad.calls.includes("showNative:library")));
  /* Bring it where the learner can actually see it. The library slot sits at the
     foot of a long page, i.e. already off screen — which the follower hides, and
     that is the same rule, checked on its own at S39b. Nudging the box up is the
     shortest way to a slot in view; the follower is told nothing but the
     rectangle it measures. */
  const intoView = () => p.evaluate(() => { const s = document.querySelector('[data-ad-slot][data-placement="library"]');
    s.style.position = "relative"; s.style.top = "0px";
    s.style.top = -(Math.round(s.getBoundingClientRect().top) - 400) + "px"; adNativeSync(); });
  await intoView(); await sleep(250);
  ok("S34 · (setup) in view on the library page, the shell is drawing it",
    await p.evaluate(() => window.__ad.vis.library === true), await p.evaluate(() => JSON.stringify(window.__ad.vis)));
  /* now the learner opens a clip: the workspace is a full-screen overlay OVER
     that slot. The page can cover its own element; it cannot cover a platform
     view, so it has to say so. THIS IS THE FAULT IN THE PHOTOS. */
  await p.evaluate(() => { window.__ad.moves = []; });
  await workspace(p); await p.evaluate(() => adNativeSync()); await sleep(250);
  ok("S35 · opening the workspace tells the shell to HIDE the library ad",
    await p.evaluate(() => window.__ad.vis.library === false),
    await p.evaluate(() => JSON.stringify({ vis: window.__ad.vis, moves: window.__ad.moves })));
  ok("S36 · …the slot itself is kept, so there is no new request and no second impression",
    await p.evaluate(() => !!document.querySelector('[data-ad-slot][data-placement="library"]'))
    && await p.evaluate(() => window.__ad.calls.filter(c => c === "showNative:library").length) === 1,
    await p.evaluate(() => JSON.stringify(window.__ad.calls)));
  /* and the workspace's own slot is still allowed — it is the one exception */
  await p.evaluate(() => { AdManager.placeShadow(); }); await sleep(900);
  const v = await look(p);
  ok("S37 · the workspace's own slot is still placed, and it is the only one in the workspace",
    v.inWork === 1 && v.placement === "shadow_video", JSON.stringify(v));
  ok("S38 · …so the shell is drawing exactly ONE ad, the workspace's, not the library's on top of the lesson",
    await p.evaluate(() => Object.keys(window.__ad.vis).filter(k => window.__ad.vis[k]).join(",")) === "shadow_video",
    await p.evaluate(() => JSON.stringify(window.__ad.vis)));
  /* close it again: the library is in front once more, same creative */
  await p.evaluate(() => { document.body.classList.remove("sh-work-open");
    const w = document.getElementById("shWork"); if (w) w.style.display = "none"; });
  await intoView(); await sleep(250);
  ok("S39 · closing the workspace shows the library ad again, with no new request",
    await p.evaluate(() => window.__ad.vis.library === true)
    && await p.evaluate(() => window.__ad.calls.filter(c => c === "showNative:library").length) === 1,
    await p.evaluate(() => JSON.stringify({ vis: window.__ad.vis, calls: window.__ad.calls })));
  /* scrolled out of the viewport is the same question */
  await p.evaluate(() => { const s = document.querySelector('[data-ad-slot][data-placement="library"]');
    s.style.top = (parseFloat(s.style.top || "0") - 5000) + "px"; adNativeSync(); });
  await sleep(250);
  ok("S39b · a slot scrolled off the screen is hidden too, so it cannot paint over the header",
    await p.evaluate(() => window.__ad.vis.library === false), await p.evaluate(() => JSON.stringify(window.__ad.vis)));
  /* and the player going full screen is the same question again: the page is
     covered by the player's own element, and a platform view would be over it */
  await p.evaluate(() => { const s = document.querySelector('[data-ad-slot][data-placement="library"]');
    s.style.top = "0px"; s.style.top = -(Math.round(s.getBoundingClientRect().top) - 400) + "px"; adNativeSync(); });
  await sleep(200);
  ok("S39c · (control) back in view, it is drawn again", await p.evaluate(() => window.__ad.vis.library === true), await p.evaluate(() => JSON.stringify(window.__ad.vis)));
  /* the owner's photo of 31 Oct 2026: the slot scrolled UNDER a pinned element
     (the sticky player, the library bar) while staying inside the viewport, and
     the shell drew the ad over it. elementFromPoint is the page's answer. */
  await p.evaluate(() => { const s = document.querySelector('[data-ad-slot][data-placement="library"]');
    s.style.top = "0px"; s.style.top = -(Math.round(s.getBoundingClientRect().top) - 120) + "px"; adNativeSync(); });
  await sleep(200);
  ok("S39e · slid under the library's pinned bar → the ad is hidden, never drawn on top of it",
    await p.evaluate(() => window.__ad.vis.library === false), await p.evaluate(() => JSON.stringify(window.__ad.vis)));
  await p.evaluate(() => { const s = document.querySelector('[data-ad-slot][data-placement="library"]'), r = s.getBoundingClientRect(), c = document.createElement("div"); c.id = "__pin";
    s.style.top = "0px"; s.style.top = -(Math.round(s.getBoundingClientRect().top) - 400) + "px";
    const q = (s.querySelector(".ad-native-body") || s).getBoundingClientRect(); c.style.cssText = `position:fixed;left:0;right:0;top:${q.top - 10}px;height:40px;z-index:99999;background:#000`;
    document.body.appendChild(c); adNativeSync(); });
  await sleep(200);
  ok("S39f · a fixed element over part of the slot → hidden", await p.evaluate(() => window.__ad.vis.library === false), await p.evaluate(() => JSON.stringify(window.__ad.vis)));
  await p.evaluate(() => { document.getElementById("__pin").remove(); adNativeSync(); });
  await sleep(200);
  ok("S39g · (control) uncovered again, it is drawn again", await p.evaluate(() => window.__ad.vis.library === true), await p.evaluate(() => JSON.stringify(window.__ad.vis)));
  await p.evaluate(() => { Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => document.getElementById("ytBox") }); adNativeSync(); });
  await sleep(200);
  ok("S39d · the video full screen → every native ad is hidden, none over the player",
    await p.evaluate(() => window.__ad.vis.library === false), await p.evaluate(() => JSON.stringify(window.__ad.vis)));
  ok("S40 · no JavaScript errors", errs.length === 0, JSON.stringify(errs));
  await ctx.close();
}

console.log(`\n${res.filter(Boolean).length}/${res.length} passed   (${BASE})`);
await b.close(); srv.kill();
process.exit(res.every(Boolean) ? 0 : 1);
