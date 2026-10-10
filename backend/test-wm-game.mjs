/* be-polish — Welding Mastery's server side (wm-game.js), 9 Oct 2026.
   Run: node backend/test-wm-game.mjs
   The real Worker module in Node. be-entitlements and the partner Worker's
   /programme are stand-ins answering per token; the limiter is the in-memory
   fallback (same all-or-nothing contract as the Durable Object, which
   test-rate-limit.mjs covers). The clock is wound by overriding Date.now. */
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };

let NOW = Date.UTC(2026, 9, 10, 9, 0, 0);
const realNow = Date.now; Date.now = () => NOW;

/* a token is header.payload.sig with the uid in `sub`; the stand-ins read the plan and track from it */
const tok = (uid) => "h." + Buffer.from(JSON.stringify({ sub: uid })).toString("base64url") + ".s";
const ACCOUNTS = {};   // uid -> { plan, track }
const calls = { ent: 0, prog: 0 };
globalThis.fetch = async (url, init) => {
  const u = String(url), auth = (init && init.headers && (init.headers.authorization || init.headers.Authorization)) || "";
  const uid = auth.startsWith("Bearer ") ? JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64url").toString()).sub : null;
  const acc = uid && ACCOUNTS[uid];
  if (u.includes("/v1/entitlement")) {
    calls.ent++;
    if (!acc) return new Response("{}", { status: 401 });
    const prem = acc.plan === "premium";
    return new Response(JSON.stringify({ plan: acc.plan, paid: prem, capabilities: { ad_free: prem, ai_analysis: prem, advanced_progress: prem, ai_coach: prem, recommended_content: prem } }), { status: 200 });
  }
  if (u.includes("/programme")) {
    calls.prog++;
    if (!acc) return new Response("{}", { status: 401 });
    if (!acc.track) return new Response(JSON.stringify({ error: "track_unverified" }), { status: 403 });
    return new Response(JSON.stringify({ track: acc.track }), { status: 200 });
  }
  return new Response("{}", { status: 500 });
};
const W = (await import(new URL("./polish-worker.js", import.meta.url))).default;
const { _wmReset, WM_FREE_ENERGY, WM_XP_DAY_CAP, WM_XP_MODE_DAY_CAP, roundXp } = await import(new URL("./wm-game.js", import.meta.url));

const PACK = { v: 1, scenarios: [{ id: "wa-01" }] };
const GE_PACK = { v: 1, scenarios: [{ id: "ga-01" }] };
const KV = { get: async (k, t) => { const v = k === "advanced-v1" ? PACK : k === "ge-advanced-v1" ? GE_PACK : null; return v && (t === "json" ? v : JSON.stringify(v)); } };
const ENV = { OPENAI_KEY: "k", PREMIUM_ENFORCED: "1", ENTITLEMENTS_URL: "https://ent.test", PARTNER_API: "https://partner.test", WM_PACK: KV };
let ipN = 0;
async function wm(op, extra, { uid = null, env = ENV } = {}) {
  const headers = { origin: "https://staging.lomonec.com", "content-type": "application/json", "CF-Connecting-IP": "10.1.0." + (++ipN % 250) };
  if (uid) headers.authorization = "Bearer " + tok(uid);
  const r = await W.fetch(new Request("https://be-polish.test/", { method: "POST", headers, body: JSON.stringify({ wm: { op, ...(extra || {}) } }) }), env);
  return { status: r.status, j: await r.json().catch(() => null) };
}
let sidN = 0; const sid = () => "round-" + (++sidN).toString().padStart(6, "0");
const acct = (uid, plan = "free", track = "welding") => { ACCOUNTS[uid] = { plan, track }; return uid; };

console.log("\n# who may play — account and programme, from the server");
{
  ok("A1 · no token → 401, nothing counted", (await wm("status")).status === 401);
  ok("A2 · an unknown / invalid token → 401", (await wm("status", {}, { uid: "nobody" })).status === 401);
  const ge = acct("ge-1", "free", "general-english");
  const r = await wm("start", { sid: sid(), mode: "quiz" }, { uid: ge });
  ok("A3 · a General English account → 403 track (the game is Welding only, decided from the account)", r.status === 403 && r.j.error === "track" && r.j.track === "general-english", JSON.stringify(r));
  const none = acct("none-1", "free", null);
  ok("A4 · an account with no programme on record → 403 track", (await wm("status", {}, { uid: none })).status === 403);
  ok("A5 · production today (no entitlement service) → 503 wm_unavailable, no account lookup", (await wm("status", {}, { uid: acct("p-1"), env: { OPENAI_KEY: "k" } })).status === 503);
  ok("A6 · a request that names a track is ignored: the account's programme decides", (await wm("start", { sid: sid(), mode: "quiz", track: "welding" }, { uid: ge })).status === 403);
  ok("A7 · unknown op / bad round id / unknown game → 400", (await wm("hack", {}, { uid: acct("w-0") })).status === 400 && (await wm("start", { sid: "x", mode: "quiz" }, { uid: "w-0" })).status === 400 && (await wm("start", { sid: sid(), mode: "poker" }, { uid: "w-0" })).status === 400);
}

console.log("\n# energy — Free 5 challenge rounds a day, charged once per round, at the start");
{
  const u = acct("free-1");
  const s0 = await wm("status", {}, { uid: u });
  ok("E1 · a new Free account: 0 of 5 used, XP 0, daily not done", s0.status === 200 && s0.j.energy.used === 0 && s0.j.energy.limit === WM_FREE_ENERGY && s0.j.xp.total === 0 && s0.j.daily.done === false, JSON.stringify(s0.j));
  const id = sid();
  const r1 = await wm("start", { sid: id, mode: "quiz" }, { uid: u });
  ok("E2 · starting a Quiz round charges one unit and returns a ticket", r1.status === 200 && r1.j.charged === true && r1.j.energy.used === 1 && typeof r1.j.ticket === "string", JSON.stringify(r1.j));
  const r2 = await wm("start", { sid: id, mode: "quiz" }, { uid: u });
  ok("E3 · the same round again (retry, double tap, resume) is a duplicate: no second unit", r2.status === 200 && r2.j.duplicate === true && r2.j.energy.used === 1);
  const c = await wm("start", { sid: sid(), mode: "cards" }, { uid: u });
  ok("E4 · Cards (review) costs nothing", c.status === 200 && c.j.charged === false && c.j.energy.used === 1);
  const d = await wm("start", { sid: sid(), mode: "daily" }, { uid: u });
  ok("E5 · the daily challenge costs nothing", d.status === 200 && d.j.charged === false && d.j.energy.used === 1);
  for (let i = 0; i < 4; i++) await wm("start", { sid: sid(), mode: "match" }, { uid: u });
  const st = await wm("status", {}, { uid: u });
  ok("E6 · after five challenge rounds: 5 of 5 used", st.j.energy.used === 5, JSON.stringify(st.j.energy));
  const sixth = await wm("start", { sid: sid(), mode: "visual" }, { uid: u });
  ok("E7 · the sixth challenge round → 429 energy with when it refills (next UTC midnight)", sixth.status === 429 && sixth.j.error === "energy" && sixth.j.resetAt === Date.UTC(2026, 9, 11) && sixth.j.retryAfter > 0, JSON.stringify(sixth.j));
  ok("E8 · a refused start does not consume anything (still 5 of 5)", (await wm("status", {}, { uid: u })).j.energy.used === 5);
  ok("E9 · with energy spent, Cards review and the daily challenge still start", (await wm("start", { sid: sid(), mode: "cards" }, { uid: u })).status === 200 && (await wm("start", { sid: sid(), mode: "daily" }, { uid: u })).status === 200);
  const fin = await wm("finish", { sid: id, mode: "quiz", ticket: r1.j.ticket, n: 8, ok: 0 }, { uid: u });
  ok("E10 · finishing a round with every answer wrong costs no energy (still 5) and pays no answer XP", fin.status === 200 && fin.j.energy.used === 5 && fin.j.awarded === 10, JSON.stringify(fin.j));
  const p = acct("prem-1", "premium");
  let allOk = true; for (let i = 0; i < 12; i++) { const r = await wm("start", { sid: sid(), mode: "quiz" }, { uid: p }); allOk = allOk && r.status === 200 && r.j.charged === false; }
  const ps = await wm("status", {}, { uid: p });
  ok("E11 · Premium: twelve challenge rounds, no energy charged, limit shown as none", allOk && ps.j.energy.limit === null && ps.j.plan === "premium", JSON.stringify(ps.j));
}

console.log("\n# XP — awarded by the server, once per round, bounded");
{
  const u = acct("xp-1");
  const st = await wm("start", { sid: "xp-round-0001", mode: "quiz" }, { uid: u });
  const f1 = await wm("finish", { sid: "xp-round-0001", mode: "quiz", ticket: st.j.ticket, n: 8, ok: 6 }, { uid: u });
  ok("X1 · a finished round pays 2 per correct answer + 10 for a full round (6 right of 8 → 22)", f1.status === 200 && f1.j.awarded === 22 && f1.j.xp.total === 22, JSON.stringify(f1.j));
  const f2 = await wm("finish", { sid: "xp-round-0001", mode: "quiz", ticket: st.j.ticket, n: 8, ok: 8 }, { uid: u });
  ok("X2 · finishing the same round again pays nothing (duplicate), total unchanged", f2.status === 200 && f2.j.duplicate === true && f2.j.awarded === 0 && f2.j.xp.total === 22, JSON.stringify(f2.j));
  ok("X3 · a forged ticket → 403", (await wm("finish", { sid: "xp-round-0002", mode: "quiz", ticket: "forged", n: 8, ok: 8 }, { uid: u })).status === 403);
  const other = acct("xp-2");
  ok("X4 · another account's ticket → 403 (a ticket is bound to its account)", (await wm("finish", { sid: "xp-round-0001", mode: "quiz", ticket: st.j.ticket, n: 8, ok: 8 }, { uid: other })).status === 403);
  ok("X5 · a ticket for one game cannot finish another", (await wm("finish", { sid: "xp-round-0001", mode: "match", ticket: st.j.ticket, n: 8, ok: 8 }, { uid: u })).status === 403);
  const s3 = await wm("start", { sid: "xp-round-0003", mode: "builder" }, { uid: u });
  const f3 = await wm("finish", { sid: "xp-round-0003", mode: "builder", ticket: s3.j.ticket, n: 999, ok: 999 }, { uid: u });
  ok("X6 · an inflated tally is capped to the game's own maximum (Word Builder 10 → 30 XP)", f3.j.awarded === roundXp("builder", 10, 10).xp && f3.j.awarded === 30, JSON.stringify(f3.j));
  ok("X7 · ok can never exceed n", roundXp("quiz", 3, 9).ok === 3 && roundXp("quiz", -5, 2).xp === 0);
  const s4 = await wm("start", { sid: "xp-round-0004", mode: "quiz" }, { uid: u });
  const f4 = await wm("finish", { sid: "xp-round-0004", mode: "quiz", ticket: s4.j.ticket, n: 3, ok: 3 }, { uid: u });
  ok("X8 · a short round (under 5 answers) pays its answers but no round bonus", f4.j.awarded === 6);
  ok("X9 · the total is the server's own figure", (await wm("status", {}, { uid: u })).j.xp.total === 22 + 30 + 6);
}

console.log("\n# the daily challenge — +30 once per UTC day, free, resets at midnight");
{
  const u = acct("daily-1");
  const s1 = await wm("start", { sid: "daily-0001", mode: "daily" }, { uid: u });
  const f1 = await wm("finish", { sid: "daily-0001", mode: "daily", ticket: s1.j.ticket, n: 8, ok: 7 }, { uid: u });
  ok("D1 · the day's challenge pays its answers, the round bonus and the +30 daily bonus (7/8 → 54)", f1.j.awarded === 14 + 10 + 30 && f1.j.dailyBonus === 30 && f1.j.daily.done === true, JSON.stringify(f1.j));
  const s2 = await wm("start", { sid: "daily-0002", mode: "daily" }, { uid: u });
  const f2 = await wm("finish", { sid: "daily-0002", mode: "daily", ticket: s2.j.ticket, n: 8, ok: 8 }, { uid: u });
  ok("D2 · playing it again the same day pays the answers, not a second bonus", f2.j.awarded === 26 && f2.j.dailyBonus === 0, JSON.stringify(f2.j));
  const s0 = await wm("start", { sid: "daily-0000", mode: "daily" }, { uid: acct("daily-2") });
  const f0 = await wm("finish", { sid: "daily-0000", mode: "daily", ticket: s0.j.ticket, n: 8, ok: 0 }, { uid: "daily-2" });
  ok("D3 · a daily round with no correct answer does not take the daily bonus (it is still available)", f0.j.dailyBonus === 0 && f0.j.daily.done === false);
  NOW += 24 * 3600_000;
  const next = await wm("status", {}, { uid: u });
  ok("D4 · the next UTC day: daily not done, energy back to 0 of 5, XP total kept", next.j.daily.done === false && next.j.energy.used === 0 && next.j.xp.total === 54 + 26 && next.j.xp.today === 0, JSON.stringify(next.j));
  const fr = acct("reset-1");
  NOW += 1;
  for (let i = 0; i < 5; i++) await wm("start", { sid: sid(), mode: "quiz" }, { uid: fr });
  ok("D5 · energy spent today …", (await wm("start", { sid: sid(), mode: "quiz" }, { uid: fr })).status === 429);
  NOW += 24 * 3600_000;
  ok("D6 · … is back the next UTC day", (await wm("start", { sid: sid(), mode: "quiz" }, { uid: fr })).status === 200);
  const late = await wm("start", { sid: "late-round-01", mode: "quiz" }, { uid: fr });
  NOW += 24 * 3600_000;
  ok("D7 · a round started yesterday can still be finished today (resume after midnight)", (await wm("finish", { sid: "late-round-01", mode: "quiz", ticket: late.j.ticket, n: 5, ok: 5 }, { uid: fr })).j.awarded === 20);
}

console.log("\n# the daily XP ceiling");
{
  const u = acct("cap-1", "premium");
  let total = 0;
  const MODES = ["quiz", "match", "visual", "listen", "builder", "crossword", "cards", "workshop"];
  let quizOnly = 0;
  for (let i = 0; i < 40; i++) { NOW += 5000; const mode = MODES[i % MODES.length], id = "cap-round-" + String(i).padStart(3, "0"); const s = await wm("start", { sid: id, mode }, { uid: u }); const f = await wm("finish", { sid: id, mode, ticket: s.j.ticket, n: 10, ok: 10 }, { uid: u }); total += f.j.awarded; if (mode === "quiz") quizOnly += f.j.awarded; }
  const st = await wm("status", {}, { uid: u });
  ok("C1 · no more than " + WM_XP_DAY_CAP + " XP a day, even for Premium; extra rounds still close (pay 0)", total <= WM_XP_DAY_CAP && st.j.xp.today <= WM_XP_DAY_CAP && st.j.xp.today >= WM_XP_DAY_CAP - 30, JSON.stringify({ total, today: st.j.xp.today }));
  ok("C2 · one game pays at most " + WM_XP_MODE_DAY_CAP + " XP a day (repeating the same game, or free Cards review, stops paying)", quizOnly <= WM_XP_MODE_DAY_CAP && quizOnly >= WM_XP_MODE_DAY_CAP - 30, quizOnly);
}

console.log("\n# the Premium pack — advanced scenarios from KV, Premium accounts only");
{
  const f = acct("pack-free");
  ok("K1 · Free account → 402 premium_required (the scenarios are not sent)", (await wm("pack", {}, { uid: f })).status === 402);
  const p = acct("pack-prem", "premium");
  const r = await wm("pack", {}, { uid: p });
  ok("K2 · Premium account → the pack", r.status === 200 && r.j.scenarios.length === 1, JSON.stringify(r.j));
  ok("K3 · Premium but no KV bound → 503 pack_unavailable (never a fake pack)", (await wm("pack", {}, { uid: p, env: { ...ENV, WM_PACK: undefined } })).status === 503);
  ok("K4 · an advanced round can only be started by Premium", (await wm("start", { sid: sid(), mode: "advanced" }, { uid: f })).status === 402 && (await wm("start", { sid: sid(), mode: "advanced" }, { uid: p })).status === 200);
  const geP = acct("pack-ge", "premium", "general-english");
  ok("K5 · a Premium General English account still gets 403 track (Premium does not open Welding content to another programme)", (await wm("pack", {}, { uid: geP })).status === 403);
}

console.log("\n# English Mastery (General English) — same rules, its own programme");
{
  NOW += 3 * 3600_000; _wmReset();
  const G = { prog: "general-english" };
  const tick = () => { NOW += 2500; };
  const g = acct("ge-free-1", "free", "general-english");
  const s0 = await wm("status", G, { uid: g }); tick();
  ok("G1 · a General English account opens English Mastery: Free, 0 of 5, XP 0", s0.status === 200 && s0.j.plan === "free" && s0.j.energy.used === 0 && s0.j.xp.total === 0, JSON.stringify(s0));
  const w1 = acct("w-ge-1", "free", "welding");
  const x = await wm("status", G, { uid: w1 }); tick();
  ok("G2 · a Welding account asking for English Mastery → 403 track (the account decides, not the request)", x.status === 403 && x.j.error === "track" && x.j.track === "welding", JSON.stringify(x));
  ok("G3 · an unknown programme → 400", (await wm("status", { prog: "pottery" }, { uid: g })).status === 400); tick();
  ok("G4 · English Mastery's games only: Speak Up is a game here, Visual recognition is not; Speak Up is not a Welding game",
    (await wm("start", { ...G, sid: sid(), mode: "visual" }, { uid: g })).status === 400 && (tick(), (await wm("start", { sid: sid(), mode: "speak" }, { uid: w1 })).status === 400)); tick();
  const id = sid();
  const r1 = await wm("start", { ...G, sid: id, mode: "speak" }, { uid: g }); tick();
  ok("G5 · a Speak Up round charges one unit and returns a ticket", r1.status === 200 && r1.j.charged === true && r1.j.energy.used === 1 && typeof r1.j.ticket === "string", JSON.stringify(r1.j));
  ok("G6 · the same round again is a duplicate: no second unit", (await wm("start", { ...G, sid: id, mode: "speak" }, { uid: g })).j.duplicate === true); tick();
  const f = await wm("finish", { ...G, sid: id, mode: "speak", ticket: r1.j.ticket, n: 50, ok: 50 }, { uid: g }); tick();
  ok("G7 · finishing pays from English Mastery's own bound (Speak Up: 6 answers → 6×2 + 10 = 22)", f.status === 200 && f.j.awarded === 22 && f.j.xp.total === 22, JSON.stringify(f.j));
  ok("G8 · a second finish pays nothing", (await wm("finish", { ...G, sid: id, mode: "speak", ticket: r1.j.ticket, n: 6, ok: 6 }, { uid: g })).j.awarded === 0); tick();
  ok("G9 · Word Quest (review) and the daily mission cost nothing",
    (await wm("start", { ...G, sid: sid(), mode: "cards" }, { uid: g })).j.charged === false && (tick(), (await wm("start", { ...G, sid: sid(), mode: "daily" }, { uid: g })).j.charged === false)); tick();
  for (let i = 0; i < 4; i++) { await wm("start", { ...G, sid: sid(), mode: "quiz" }, { uid: g }); tick(); }
  const over = await wm("start", { ...G, sid: sid(), mode: "puzzle" }, { uid: g }); tick();
  ok("G10 · the sixth challenge round of the day → 429 energy", over.status === 429 && over.j.error === "energy", JSON.stringify(over));
  /* the same account switches programme: its Welding energy and XP are untouched by English Mastery */
  ACCOUNTS[g].track = "welding"; NOW += 11 * 60_000;
  const ws = await wm("status", {}, { uid: g }); tick();
  ok("G11 · separate energy and XP per programme: after 5 English rounds, Welding shows 0 of 5 and 0 XP", ws.status === 200 && ws.j.energy.used === 0 && ws.j.xp.total === 0, JSON.stringify(ws.j));
  ok("G12 · and English Mastery now refuses this account (its programme is Welding)", (await wm("status", G, { uid: g })).status === 403); tick();
  /* a ticket from one programme cannot finish a round in the other */
  ACCOUNTS[g].track = "general-english"; NOW += 11 * 60_000;
  const id2 = sid();
  const q = await wm("start", { ...G, sid: id2, mode: "cards" }, { uid: g }); tick();
  ACCOUNTS[g].track = "welding"; NOW += 11 * 60_000;
  const cross = await wm("finish", { sid: id2, mode: "cards", ticket: q.j.ticket, n: 10, ok: 10 }, { uid: g }); tick();
  ok("G13 · an English Mastery ticket cannot finish a Welding round (the programme is signed into the ticket)", cross.status === 403 && cross.j.error === "ticket", JSON.stringify(cross));
  /* found in production, 10 Oct 2026: a learner who has JUST switched is served at once, not refused for the cache's ten minutes */
  ACCOUNTS[g].track = "general-english";
  ok("G13b · a programme switch is recognised straight away (no waiting out the cache)", (await wm("status", G, { uid: g })).status === 200); tick();
  const gd = acct("ge-free-2", "free", "general-english");
  const d = await wm("start", { ...G, sid: sid(), mode: "daily" }, { uid: gd }); tick();
  const df = await wm("finish", { ...G, sid: d.j.sid, mode: "daily", ticket: d.j.ticket, n: 8, ok: 6 }, { uid: gd }); tick();
  const d2 = await wm("start", { ...G, sid: sid(), mode: "daily" }, { uid: gd }); tick();
  const df2 = await wm("finish", { ...G, sid: d2.j.sid, mode: "daily", ticket: d2.j.ticket, n: 8, ok: 8 }, { uid: gd }); tick();
  ok("G14 · the daily mission pays its +30 once a day (6×2 + 10 + 30 = 52), a second daily the same day no bonus", df.j.awarded === 52 && df.j.dailyBonus === 30 && df2.j.dailyBonus === 0, JSON.stringify([df.j, df2.j]));
  ok("G15 · a Free account cannot download English Mastery's Premium pack (402) nor start an advanced round", (await wm("pack", G, { uid: gd })).status === 402 && (tick(), (await wm("start", { ...G, sid: sid(), mode: "advanced" }, { uid: gd })).status === 402)); tick();
  const gp = acct("ge-prem-1", "premium", "general-english");
  const pk = await wm("pack", G, { uid: gp }); tick();
  ok("G16 · a Premium General English account gets ITS pack (ge-advanced-v1), never Welding's", pk.status === 200 && pk.j.scenarios[0].id === "ga-01", JSON.stringify(pk.j));
  let used = 0; for (let i = 0; i < 7; i++) { const r = await wm("start", { ...G, sid: sid(), mode: "match" }, { uid: gp }); tick(); if (r.status !== 200) used = -1; }
  ok("G17 · Premium: no energy cap (7 challenge rounds, all allowed, limit null)", used === 0 && (await wm("status", G, { uid: gp })).j.energy.limit === null); tick();
  const wp = acct("w-prem-1", "premium", "welding");
  ok("G18 · a Premium Welding account still gets 403 for English Mastery's pack", (await wm("pack", G, { uid: wp })).status === 403);
}

console.log("\n# isolation from the rest of be-polish");
{
  ok("I1 · the programme is looked up from the account, with the caller's own token", calls.prog > 0);
  const before = calls.ent;
  await W.fetch(new Request("https://be-polish.test/", { method: "POST", headers: { origin: "https://app.lomonec.com", "content-type": "application/json" }, body: JSON.stringify({ captions: "" }) }), { OPENAI_KEY: "k" });
  ok("I2 · a request without `wm` never reaches the game code (no account lookup for other routes when enforcement is off)", calls.ent === before);
}

Date.now = realNow; _wmReset();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
