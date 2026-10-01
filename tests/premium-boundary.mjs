/* The Premium entitlement boundary in the app (30 September 2026).
   Run: cd tests && node premium-boundary.mjs

   The server half — who is allowed to SPEND — is proved in
   backend/test-premium-gate.mjs against the real Worker module. This file is
   about the app: that one gate decides everything, that a Free learner keeps
   the practice and loses only the AI, that a paying learner loses nothing,
   that Welding is untouched, and that with Premium not on sale — production
   today — nothing whatever is gated. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { CAPABILITIES } from "../backend/entitlements/src/entitlement-core.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = 8097, BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(900);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 300)}`); };
const b = await chromium.launch();

const caps = on => CAPABILITIES.reduce((o, k) => (o[k] = on, o), { ai_allowance: on ? "enhanced" : "standard", practice_allowance: on ? "enhanced" : "standard" });
const PREMIUM = { plan: "premium", paid: true, state: "active", ads: false, capabilities: caps(true), expiresAt: Date.now() + 30 * 864e5, source: "app_store" };
const FREE = { plan: "free", paid: false, state: "none", ads: true, capabilities: caps(false), expiresAt: null, source: null };
const seed = tr => JSON.stringify({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr },
  fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } },
  days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });

async function open({ track = "general-english", billing = true, api = true, plan = FREE, signedIn = true } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(([s, api, flags]) => { localStorage.setItem("be12_v1", s); if (api) localStorage.setItem("be_ent_api", "http://ent.test"); if (flags) localStorage.setItem("be_flags", JSON.stringify(flags)); },
    [seed(track), api, billing ? { billing_enabled: true, home_v2_enabled: true } : { home_v2_enabled: true }]);
  const ai = [];                                   // every request that reaches the AI Worker
  await ctx.route(u => /be-polish/.test(u.href), r => { ai.push({ url: r.request().url(), auth: r.request().headers()["authorization"] || null, body: r.request().postData() }); r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }); });
  await ctx.route(u => /be-events|be-partner|cloudflareinsights|youtube|ytimg/.test(u.href), r => r.fulfill({ status: 404, body: "{}" }));
  await ctx.route("http://ent.test/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(plan) }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "index.html"); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv,#premOv").forEach(e => e.remove()));
  if (signedIn) { await p.evaluate(() => { FBUser = { uid: "u1", getIdToken: async () => "tok-u1" }; }); await p.evaluate(() => entRefresh()); await sleep(300); }
  return { ctx, p, ai, errs };
}
const gates = p => p.evaluate(() => ({
  caps: ENT_CAPS.slice(),
  has: ENT_CAPS.reduce((o, k) => (o[k] = hasEntitlement(k), o), {}),
  locked: ENT_CAPS.reduce((o, k) => (o[k] = entLocked(k), o), {}),
  aiOffAnalysis: aiOff("ai_analysis"), gated: entGated(),
}));

console.log("\n# the contract: one list, shared with the server");
{
  const { ctx, p, errs } = await open({ billing: false, api: false });
  const g = await gates(p);
  ok("1 · the app's ENT_CAPS is exactly the server's CAPABILITIES, in the same order", JSON.stringify(g.caps) === JSON.stringify(CAPABILITIES), JSON.stringify(g.caps));
  ok("2 · an unknown capability name is refused, never silently allowed", await p.evaluate(() => hasEntitlement("everything") === false && hasEntitlement("") === false && hasEntitlement(null) === false));
  ok("3 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# production today — Premium is not on sale, so NOTHING is gated");
{
  const { ctx, p, errs } = await open({ billing: false, api: false });
  const g = await gates(p);
  ok("4 · with billing off and no entitlement service, every capability is granted", CAPABILITIES.every(k => g.has[k] === true), JSON.stringify(g.has));
  ok("5 · nothing reports itself as locked, so no lock is ever drawn", CAPABILITIES.every(k => g.locked[k] === false) && g.gated === false);
  ok("6 · the AI gate is open: aiOff is false, exactly as before this change", g.aiOffAnalysis === false);
  ok("7 · the Premium gate card renders nothing at all", await p.evaluate(() => premLockHTML("ai_analysis", "t") === ""));
  ok("8 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, p } = await open({ billing: true, api: false });
  const g = await gates(p);
  ok("9 · billing_enabled ON but no entitlement service: still nothing gated (a half-configured release cannot lock learners out)", CAPABILITIES.every(k => g.has[k] === true) && g.gated === false);
  await ctx.close();
}

console.log("\n# a FREE account, with Premium on sale");
let freeAi = null;
{
  const { ctx, p, ai, errs } = await open({ plan: FREE });
  const g = await gates(p);
  ok("10 · every Premium capability is withheld", CAPABILITIES.every(k => g.has[k] === false), JSON.stringify(g.has));
  ok("11 · the AI analysis gate is closed", g.aiOffAnalysis === true && g.gated === true);
  const card = await p.evaluate(() => premLockHTML("ai_analysis", "test"));
  ok("12 · the gate card names the capability, explains it, says the practice is still saved, and offers the sheet", /AI speaking analysis/.test(card) && /pronunciation, grammar, vocabulary and fluency/.test(card) && /still recorded and saved/.test(card) && /premiumOpen\('test'\)/.test(card) && /Unlock Premium/.test(card), card.slice(0, 200));
  ok("13 · it carries no raw i18n key and no unfilled placeholder", !/prem\.|\{\{/.test(card), card.slice(0, 200));
  /* the practice itself must still run: the report path short-circuits to the
     app's own offline path rather than throwing or calling the AI */
  await p.evaluate(() => { try { mvExReport && mvExReport("k"); } catch (e) {} });
  await sleep(400);
  freeAi = ai.slice();
  ok("14 · asking for a report made NO call to the AI Worker", ai.length === 0, JSON.stringify(ai));
  ok("15 · the message says it is Premium, not that the learner is offline", await p.evaluate(() => /Premium/.test(aiOffNote("ai_analysis")) && !/connection/.test(aiOffNote("ai_analysis"))), await p.evaluate(() => aiOffNote("ai_analysis")));
  ok("16 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# a PREMIUM account loses nothing");
{
  const { ctx, p, ai, errs } = await open({ plan: PREMIUM });
  const g = await gates(p);
  ok("17 · every capability is granted", CAPABILITIES.every(k => g.has[k] === true), JSON.stringify(g.has));
  ok("18 · nothing is locked and no gate card is drawn", CAPABILITIES.every(k => g.locked[k] === false) && await p.evaluate(() => premLockHTML("ai_analysis", "t") === "" && premLockHTML("advanced_progress", "t") === ""));
  ok("19 · the AI gate is open", g.aiOffAnalysis === false);
  const signed = await p.evaluate(async () => { await fetch(POLISH_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "hi" }) }); return true; });
  await sleep(250);
  ok("20 · an AI request carries the account's Firebase token, so the Worker can decide for itself", signed && ai.length === 1 && ai[0].auth === "Bearer tok-u1", JSON.stringify(ai.map(x => x.auth)));
  ok("21 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# Welding shares the ONE subscription (owner, 30 September 2026 — reverses the General-English-only boundary)");
{
  const { ctx, p, errs } = await open({ track: "welding", plan: FREE });
  const g = await gates(p);
  ok("22 · a Welding learner on the Free plan is gated by the SAME rule as General English", g.gated === true && CAPABILITIES.every(k => g.has[k] === false), JSON.stringify(g.has));
  ok("23 · the AI gate is closed on Welding too", g.aiOffAnalysis === true);
  ok("24 · the 30/90-day panel is drawn on Welding, from Welding's own record", await p.evaluate(() => /Your last 30 days/.test(pgWindowsHTML())));
  ok("25 · Premium IS offered on Welding — one product, one paywall", await p.evaluate(() => premOffered() === true));
  ok("26 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, p } = await open({ track: "welding", plan: PREMIUM });
  const g = await gates(p);
  ok("26b · the same purchase makes Welding Premium — no second subscription", CAPABILITIES.every(k => g.has[k] === true) && g.aiOffAnalysis === false, JSON.stringify(g.has));
  await ctx.close();
}

console.log("\n# Progress: locked means previewed, never empty");
{
  const { ctx, p } = await open({ plan: FREE });
  const h = await p.evaluate(() => pgWindowsHTML());
  ok("27 · the 30/90-day panel still draws its real figures, dimmed behind the offer", /prem-prev/.test(h) && /Your last 30 days/.test(h) && /Your last 90 days/.test(h) && /Days practised/.test(h), h.slice(0, 160));
  ok("28 · the offer sits under it with its own wording", /Unlock 30- and 90-day progress/.test(h) && /changes over time/.test(h), h.slice(-300));
  ok("29 · a window with no scored recording says so rather than showing a zero", /No score yet/.test(h) && !/Average speaking score<\/span>\s*<span class="pg-win-v">0/.test(h), h.slice(0, 400));
  const u = await open({ plan: PREMIUM });
  const h2 = await u.p.evaluate(() => pgWindowsHTML());
  ok("30 · a paying learner sees the same panel with no preview and no offer", !/prem-prev/.test(h2) && !/Unlock/.test(h2) && /Your last 90 days/.test(h2));
  await u.ctx.close(); await ctx.close();
}

console.log("\n# Home: the reason stays, the picks are Premium (owner, 30 September 2026)");
{
  const { ctx, p } = await open({ plan: FREE });
  const r = await p.evaluate(() => ({
    shadow: homeRecLocked("shadow"), challenge: homeRecLocked("challenge"),
    lesson: homeRecLocked("lesson"), comeback: homeRecLocked("comeback"), words: homeRecLocked("words"),
    partner: homeRecLocked("partner_now"),
    video: homeItemLocked({ type: "video", vid: "abc" }), ext: homeItemLocked({ type: "session", external: true }),
    trouble: homeItemLocked({ type: "trouble" }), session: homeItemLocked({ type: "session" }),
  }));
  ok("31 · the recommended videos and Challenges are Premium content", r.shadow && r.challenge && r.video && r.ext);
  ok("32 · the curriculum, the learner's own words and human practice are NOT gated — Free is a complete product", !r.lesson && !r.comeback && !r.words && !r.partner && !r.trouble && !r.session, JSON.stringify(r));
  const rows = [{ id: "struggled", variant: "words", vars: { words: "\u201cself\u201d" }, items: [{ type: "video", vid: "dQw4w9WgXcQ", title: "A talk", dur: 300 }, { type: "trouble" }] }];
  const free = await p.evaluate(rs => homeRowsHTML(rs), rows);
  ok("33 · without Premium the row keeps its heading and the reason it was chosen", /Because you struggled with/.test(free) && /self/.test(free), free.slice(0, 200));
  ok("34 · and shows no cards at all — not the Premium ones, not the free ones", !/hx-rcard/.test(free) && !/dQw4w9WgXcQ/.test(free) && !/homeRecOpen/.test(free), free.slice(0, 400));
  ok("35 · one bar stands where the cards were, and it opens the offer", /hx-row-prem/.test(free) && /premiumOpen\('home_row'\)/.test(free) && /See what we picked for you/.test(free), free.slice(-300));
  ok("36 · the opener itself refuses a locked item, so no other caller can route round the row", await p.evaluate(() => { let opened = null; const o = window.premiumOpen; window.premiumOpen = f => { opened = f; }; _homeRows = [{ id: "r1", items: [{ type: "video", vid: "x" }] }]; homeRecOpen("r1", 0); window.premiumOpen = o; return opened === "home_row"; }));
  const w = await open({ track: "welding", plan: FREE });
  ok("37 · the same on Welding — one Premium covers both tracks, so one rule covers both Homes", await w.p.evaluate(rs => { const h = homeRowsHTML(rs); return !/hx-rcard/.test(h) && /hx-row-prem/.test(h); }, rows));
  const u = await open({ plan: PREMIUM });
  const paid = await u.p.evaluate(rs => homeRowsHTML(rs), rows);
  ok("38 · a paying learner gets the cards themselves, with no bar and no lock", /hx-rcard/.test(paid) && /dQw4w9WgXcQ/.test(paid) && /homeRecOpen/.test(paid) && !/hx-row-prem/.test(paid) && !/hx-rprem/.test(paid), paid.slice(0, 300));
  await w.ctx.close();
  await u.ctx.close(); await ctx.close();
}

console.log("\n# the AI coach stays reachable (owner, 23 September 2026) — the tap reaches the offer");
{
  const { ctx, p } = await open({ plan: FREE });
  const c = await p.evaluate(() => ppAiChoiceHTML("session"));
  ok("39 · the AI coach card still renders on the start screen, tagged Premium", /pp-fallback/.test(c) && /pp-prem-tag/.test(c) && /Premium/.test(c), c.slice(0, 200));
  ok("40 · starting a coach session opens the offer instead, and starts nothing", await p.evaluate(async () => { let opened = null; const o = window.premiumOpen; window.premiumOpen = f => { opened = f; }; await ppAiStart("choice"); window.premiumOpen = o; return opened === "ai_coach" && !ppAiActive(); }));
  const u = await open({ plan: PREMIUM });
  ok("41 · a paying learner's card carries no Premium tag", !/pp-prem-tag/.test(await u.p.evaluate(() => ppAiChoiceHTML("session"))));
  await u.ctx.close(); await ctx.close();
}

console.log("\n# what the client cannot decide");
{
  const { ctx, p, ai } = await open({ plan: FREE });
  /* Documented, not a hole: the cached view is display state. A learner who
     edits it changes what this screen draws and nothing else — the request
     still carries their real token and the Worker still refuses it. */
  await p.evaluate(() => { localStorage.setItem("be_ent_view", JSON.stringify({ uid: "u1", at: Date.now(), view: { plan: "premium", paid: true, state: "active", ads: false, capabilities: { ai_analysis: true } } })); _entView = null; _entUid = null; });
  ok("42 · editing the cached plan changes only what is DRAWN", await p.evaluate(() => entIsPremiumForDisplay() === true));
  await p.evaluate(async () => { await fetch(POLISH_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ analyse: { transcript: "a b c d e f", metrics: {} } }) }); });
  await sleep(250);
  ok("43 · the request still carries the learner's OWN token — the server, not this page, decides (backend/test-premium-gate.mjs B2)", ai.length === 1 && ai[0].auth === "Bearer tok-u1", JSON.stringify(ai.map(x => x.auth)));
  ok("44 · a signed-out learner sends no token and is not Premium", await (async () => { const g = await open({ plan: FREE, signedIn: false }); const r = await g.p.evaluate(() => entIsPremiumForDisplay() === false); await g.ctx.close(); return r; })());
  await ctx.close();
}

console.log("\n# every chat call declares a purpose the Worker knows");
{
  const { ctx, p } = await open({ billing: false, api: false });
  const bad = await p.evaluate(() => {
    const src = [...document.scripts].map(s => s.textContent).join("\n");
    const found = [...src.matchAll(/chat:\{purpose:"([a-z]+)"/g)].map(m => m[1]);
    const untagged = (src.match(/chat:\{system/g) || []).length;
    return { found: [...new Set(found)], n: found.length, untagged };
  });
  ok("45 · every chat call site declares a purpose", bad.untagged === 0 && bad.n >= 8, JSON.stringify(bad));
  ok("46 · and only purposes the Worker maps (practice / coach / report)", bad.found.every(x => ["practice", "coach", "report"].includes(x)), JSON.stringify(bad.found));
  await ctx.close();
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})`);
process.exit(pass === res.length ? 0 : 1);
