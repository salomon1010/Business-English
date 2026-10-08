/* The Premium entitlement boundary in the app (30 September 2026).
   Run: cd tests && node premium-boundary.mjs

   The server half — who is allowed to SPEND — is proved in
   backend/test-premium-gate.mjs against the real Worker module. This file is
   about the app: that one gate decides everything, that a Free learner keeps
   the practice and the AI's VERDICTS are metered (3 a day; 120 a day on
   Premium as a fair-use ceiling — the tier spec, docs/TIERS.md, 5 Oct 2026)
   rather than locked, that the 30/90-day analytics and the Home picks stay
   hard locks, that a paying learner loses nothing, that Welding is under the
   same rule, and that with Premium not on sale — production today — nothing
   whatever is gated. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { CAPABILITIES } from "../backend/entitlements/src/entitlement-core.js";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8097), BASE = `http://127.0.0.1:${PORT}/`;
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
  /* the Worker's metered answers carry X-BE-Allowance (the tier spec, 5 Oct
     2026) and expose it through CORS, exactly as backend/polish-worker.js does */
  const ALLOW = JSON.stringify({ used: 1, limit: 3, resetAt: Date.now() + 3600e3, plan: "free" });
  await ctx.route(u => /be-polish/.test(u.href), r => { ai.push({ url: r.request().url(), auth: r.request().headers()["authorization"] || null, body: r.request().postData() }); r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "X-BE-Allowance, X-BE-Video-Allowance", "x-be-allowance": ALLOW }, body: "{}" }); });
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

console.log("\n# a FREE account, with Premium on sale — the verdicts are METERED, not locked (the tier spec, 5 Oct 2026)");
const SPENT = plan => JSON.stringify({ used: plan === "premium" ? 120 : 3, limit: plan === "premium" ? 120 : 3, resetAt: Date.now() + 3600e3, plan, at: Date.now() });
{
  const { ctx, p, ai, errs } = await open({ plan: FREE });
  const g = await gates(p);
  ok("10 · hasEntitlement is false for every capability on Free — the PLAN grants nothing; what is metered is decided below", CAPABILITIES.every(k => g.has[k] === false), JSON.stringify(g.has));
  ok("11 · the AI analysis gate is OPEN for a Free learner with today's allowance: ai_analysis and ai_coach are metered (entLocked false), the two hard locks stay",
    g.aiOffAnalysis === false && g.gated === true && g.locked.ai_analysis === false && g.locked.ai_coach === false && g.locked.advanced_progress === true && g.locked.recommended_content === true, JSON.stringify(g));
  ok("12 · with allowance left the gate card renders NOTHING for the AI (the hard-locked ones still draw theirs)", await p.evaluate(() => premLockHTML("ai_analysis", "test") === "" && premLockHTML("ai_coach", "test") === "" && /prem-lock/.test(premLockHTML("advanced_progress", "test"))));
  /* the report path really goes to the Worker now, and the Worker's count comes
     back. A decodable take is needed — fbAssess re-encodes the audio to WAV
     before it sends it — so this is half a second of silence in a WAV header. */
  await p.evaluate(async () => {
    const sr = 16000, n = sr / 2, ab = new ArrayBuffer(44 + n * 2), dv = new DataView(ab), wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); wr(8, "WAVE"); wr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); wr(36, "data"); dv.setUint32(40, n * 2, true);
    await fbAssess(new Blob([ab], { type: "audio/wav" }), "hi");
  });
  await sleep(400);
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem("be_ai_allow") || "null"));
  ok("14 · asking for a pronunciation verdict DOES call the AI Worker, with the account's token, and the X-BE-Allowance header it answers with is stored (1 of 3 used)",
    ai.length === 1 && /"assess"/.test(ai[0].body || "") && ai[0].auth === "Bearer tok-u1" && stored && stored.used === 1 && stored.limit === 3 && stored.plan === "free", JSON.stringify({ ai: ai.map(x => x.auth), stored }));
  ok("14b · and the allowance line says what is left, with the reset time", await p.evaluate(() => /2 of 3 AI verdicts left today/.test(aiAllowNote()) && aiAllowOut() === false), await p.evaluate(() => aiAllowNote()));
  /* today's three are spent: the gate closes and the card says when it comes back */
  await p.evaluate(s => localStorage.setItem("be_ai_allow", s), SPENT("free"));
  const g2 = await gates(p);
  const card = await p.evaluate(() => premLockHTML("ai_analysis", "test"));
  ok("13 · with the allowance SPENT the gate closes (aiOff true), while entLocked stays false — it is the count, not the plan",
    g2.aiOffAnalysis === true && g2.locked.ai_analysis === false && await p.evaluate(() => aiAllowOut() === true), JSON.stringify(g2));
  ok("13b · the allowance card: 'Daily allowance' chip, 'Today's AI verdicts are used up', the Free number and the Premium number, the reset time, the practice still saved, and the offer — never 'unlimited'",
    /prem-lock prem-allow/.test(card) && /Daily allowance/.test(card) && /Today's AI verdicts are used up/.test(card) && /Free includes 3 AI verdicts a day/.test(card) && /Premium gives 120 a day/.test(card)
    && /still recorded and saved/.test(card) && /premiumOpen\('test'\)/.test(card) && /prem-lock-go/.test(card) && /Unlock Premium/.test(card) && !/unlimited/i.test(card), card.slice(0, 400));
  ok("13c · it carries no raw i18n key and no unfilled placeholder", !/\bprem\.[a-z_]+|\bai\.[a-z_]+|\{\{/.test(card), card.slice(0, 200));
  ok("15 · the message names the allowance and the reset time, not Premium-as-a-lock and not the connection", await p.evaluate(() => /used today's 3 AI verdicts/.test(aiOffNote("ai_analysis")) && /come back at/.test(aiOffNote("ai_analysis")) && !/connection/.test(aiOffNote("ai_analysis"))), await p.evaluate(() => aiOffNote("ai_analysis")));
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
  /* Premium is metered too — 120 a day is a fair-use ceiling, not "unlimited" */
  await p.evaluate(s => localStorage.setItem("be_ai_allow", s), SPENT("premium"));
  const fair = await p.evaluate(() => ({ off: aiOff("ai_analysis"), card: premLockHTML("ai_analysis", "t"), note: aiAllowNote() }));
  ok("20b · a paying learner at the fair-use ceiling: the gate closes, the card says 'fair-use ceiling' with the reset time, and carries NO offer — there is nothing to sell",
    fair.off === true && /prem-allow/.test(fair.card) && /fair-use ceiling of 120 AI verdicts/.test(fair.card) && !/prem-lock-go|Unlock Premium/.test(fair.card) && !/unlimited/i.test(fair.card) && /fair-use/.test(fair.note), JSON.stringify(fair).slice(0, 400));
  ok("21 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# Welding shares the ONE subscription (owner, 30 September 2026 — reverses the General-English-only boundary)");
{
  const { ctx, p, errs } = await open({ track: "welding", plan: FREE });
  const g = await gates(p);
  ok("22 · a Welding learner on the Free plan is under the SAME rule as General English: the plan grants nothing, the verdicts are metered", g.gated === true && CAPABILITIES.every(k => g.has[k] === false) && g.locked.ai_analysis === false, JSON.stringify(g.has));
  ok("23 · the AI gate is OPEN on Welding too while today's allowance holds — and closes the same way once it is spent", g.aiOffAnalysis === false
    && await p.evaluate(s => { localStorage.setItem("be_ai_allow", s); const r = aiOff("ai_analysis") === true && /prem-allow/.test(premLockHTML("ai_analysis", "t")); localStorage.removeItem("be_ai_allow"); return r; }, SPENT("free")));
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
  /* The wording changed on 3 Oct 2026 and the gold PREMIUM pill went with it:
     the row repeated down the whole of Home and read as five adverts stacked on
     the learner's own progress. What this check is really about — one bar, one
     tap, and it opens the offer — is unchanged, so it now also guards the thing
     the owner asked for: no plan-shouting chip on the row. */
  ok("35 · one bar stands where the cards were, it opens the offer, and it shouts no plan",
    /hx-row-prem/.test(free) && /premiumOpen\('home_row'\)/.test(free)
    && /Unlock to see what we picked for you/.test(free)
    && !/prem-lock-chip/.test(free), free.slice(-300));
  ok("36 · the opener itself refuses a locked item, so no other caller can route round the row", await p.evaluate(() => { let opened = null; const o = window.premiumOpen; window.premiumOpen = f => { opened = f; }; _homeRows = [{ id: "r1", items: [{ type: "video", vid: "x" }] }]; homeRecOpen("r1", 0); window.premiumOpen = o; return opened === "home_row"; }));
  const w = await open({ track: "welding", plan: FREE });
  ok("37 · the same on Welding — one Premium covers both tracks, so one rule covers both Homes", await w.p.evaluate(rs => { const h = homeRowsHTML(rs); return !/hx-rcard/.test(h) && /hx-row-prem/.test(h); }, rows));
  const u = await open({ plan: PREMIUM });
  const paid = await u.p.evaluate(rs => homeRowsHTML(rs), rows);
  ok("38 · a paying learner gets the cards themselves, with no bar and no lock", /hx-rcard/.test(paid) && /dQw4w9WgXcQ/.test(paid) && /homeRecOpen/.test(paid) && !/hx-row-prem/.test(paid) && !/hx-rprem/.test(paid), paid.slice(0, 300));
  await w.ctx.close();
  await u.ctx.close(); await ctx.close();
}

console.log("\n# the AI coach stays reachable (owner, 23 September 2026) — metered like every other verdict (5 Oct 2026)");
{
  const { ctx, p } = await open({ plan: FREE });
  const c = await p.evaluate(() => ppAiChoiceHTML("session"));
  ok("39 · the AI coach card renders on the start screen with NO Premium tag — a Free learner's 3 verdicts a day include coach replies", /pp-fallback/.test(c) && !/pp-prem-tag/.test(c), c.slice(0, 200));
  /* the partner Worker is stubbed 404 here, so the session cannot open — what
     matters is which door the tap reaches: the coach, never the paywall */
  ok("40 · starting a coach session with allowance left does NOT open the offer", await p.evaluate(async () => { let opened = null; const o = window.premiumOpen; window.premiumOpen = f => { opened = f; }; await ppAiStart("choice"); window.premiumOpen = o; return opened === null; }));
  ok("40b · with today's verdicts spent the tap says so and opens the offer, and starts nothing", await p.evaluate(async s => { localStorage.setItem("be_ai_allow", s); let opened = null; const o = window.premiumOpen; window.premiumOpen = f => { opened = f; }; await ppAiStart("choice"); window.premiumOpen = o; return opened === "ai_coach" && !ppAiActive(); }, SPENT("free")));
  const u = await open({ plan: PREMIUM });
  ok("41 · a paying learner's card carries no Premium tag either", !/pp-prem-tag/.test(await u.p.evaluate(() => ppAiChoiceHTML("session"))));
  ok("41b · a paying learner at the fair-use ceiling is told, and NOT sent to the paywall", await u.p.evaluate(async s => { localStorage.setItem("be_ai_allow", s); let opened = null; const o = window.premiumOpen; window.premiumOpen = f => { opened = f; }; await ppAiStart("choice"); window.premiumOpen = o; return opened === null && !ppAiActive(); }, SPENT("premium")));
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
    const found = [...src.matchAll(/chat:\{purpose:"([a-z_]+)"/g)].map(m => m[1]);
    /* one site passes the purpose as a VARIABLE (svAiChat, whose default is
       "shadow"), so counting string literals alone under-counts it. What the
       check is really about is that NO site omits the field. */
    const viaVar = (src.match(/chat:\{purpose:[a-zA-Z_$][\w$]*\s*,/g) || []).length;
    const defaults = [...src.matchAll(/purpose\|\|"([a-z_]+)"/g)].map(m => m[1]);
    const untagged = (src.match(/chat:\{system/g) || []).length;
    return { found: [...new Set(found)], n: found.length, viaVar, defaults: [...new Set(defaults)], untagged };
  });
  ok("45 · every chat call site declares a purpose — none sends the field at all",
    bad.untagged === 0 && (bad.n + bad.viaVar) >= 8, JSON.stringify(bad));
  ok("46 · and only purposes the Worker maps (practice / coach / report / shadow)",
    bad.found.concat(bad.defaults).every(x => ["practice", "coach", "report", "shadow"].includes(x)), JSON.stringify(bad));
  await ctx.close();
}

await b.close(); srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})`);
process.exit(pass === res.length ? 0 : 1);
