/* General English learning loop + the product boundary (26 Sep 2026).
   Run: cd tests && node ge-loop.mjs        (BASE=… to test another tree)

   Watch → Shadow → learn the expression → Apply It → the AI coach (tagged AI,
   seeded with the phrase) → a human partner (the phrase rides on every partner
   request). Welding gets none of it: no Apply It, no library, no partner or
   Challenge analytics — whatever a call site does. */
import { chromium } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname;
const PORT = +(process.env.PORT || 8129);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const b = await chromium.launch();
const seed = tr => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: tr, tradeId: "welder" }, fnd: { "general-english": { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 }, welding: { placed: "full", finished: true, day: 15, done: {}, checkedAt: 1 } }, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, rmSeen: Date.now(), lastSeen: Date.now(), backupAsked: 1 });
async function open(track) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(s => {
    localStorage.setItem("be12_v1", s); localStorage.setItem("be_partner_api", "http://partner.test");
    localStorage.setItem("be_flags", JSON.stringify({ practice_partner_enabled: true, practice_partner_ai_fallback_enabled: true, shadow_studio_v2_enabled: true }));
    /* every analytics beacon the page sends, by event name */
    window.__beacons = []; navigator.sendBeacon = (u, blob) => { blob.text().then(t => { try { window.__beacons.push(JSON.parse(t).name); } catch (e) {} }); return true; };
  }, JSON.stringify(seed(track)));
  await ctx.route(u => /be-events|be-polish|cloudflareinsights|gstatic\.com\/firebasejs|ytimg|youtube|entitlements/.test(u.href), r => r.fulfill({ status: 404, body: "" }));
  const calls = [];
  await ctx.route("http://partner.test/**", async r => { const u = new URL(r.request().url()); let body = null; try { body = r.request().postDataJSON(); } catch (e) {}
    calls.push({ m: r.request().method(), p: u.pathname, body });
    const me = { consented: true, name: "Alex", adult: true, prefs: {}, presence: { online: 0, waiting: 0 }, serverNow: Date.now(), liveEnabled: false };
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(u.pathname === "/ai/session" ? { ok: true } : u.pathname === "/presence" ? { online: 0, waiting: 0 } : me) }); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p, errs, calls };
}
/* a timed asset open in the workspace, as after a library video loads */
const fakeAsset = p => p.evaluate(() => { shClip = { vid: "abcdefghijk", start: 0, end: 0, title: "t" }; svAsset = { vid: "abcdefghijk", level: "sentence", segments: [{ text: "Let me walk you through the numbers.", start: 0, end: 3 }, { text: "The bottom line is simple.", start: 3, end: 6 }] }; svPick = 1; });
const PHRASE = "The bottom line is simple.";

console.log("\n# General English: Apply It → the AI coach → a human partner");
{
  const { ctx, p, errs, calls } = await open("general-english");
  const gates = await p.evaluate(() => ({ ai: svApplyAIOn(), partner: svApplyPartnerOn(), lib: shLibOn(), flag: flag("shadow_apply_phrase_enabled") }));
  ok("L1 · both Apply It buttons and the library are on for General English; the Apply It flag is on by default", gates.ai && gates.partner && gates.lib && gates.flag, JSON.stringify(gates));
  await fakeAsset(p);
  const html = await p.evaluate(() => { const d = document.createElement("div"); d.innerHTML = typeof svApplyHTML === "function" ? svApplyHTML() : ""; return d.innerHTML; }).catch(() => "");
  if (html) ok("L2 · the Apply It card offers the AI coach and a partner", /svApplyAI\(\)/.test(html) && /svApplyPartner\(\)/.test(html), html.slice(0, 200));
  await p.evaluate(() => svApplyAI()); await sleep(900);
  const st = await p.evaluate(() => ({ view: cur.v, phrase: ppState().applyPhrase && ppState().applyPhrase.text, seed: ppState().ai && ppState().ai.seed && ppState().ai.seed.phrase, open: ppAiOpen }));
  ok("L3 · Practise with AI opens the Partner AI coach seeded with the chosen phrase (not Life Simulations, which never read it)", st.view === "partner" && st.phrase === PHRASE && st.seed === PHRASE && st.open, JSON.stringify(st));
  const ai = calls.find(c => c.p === "/ai/session");
  ok("L4 · the AI session is registered with the Worker (reason apply)", ai && ai.m === "POST" && ai.body && ai.body.reason === "apply", JSON.stringify(ai));
  const sys = await p.evaluate(() => ppAiSystem(ppState().ai));
  ok("L5 · the coach says it is an AI and practises the learner's phrase", /You are an AI, not a person/.test(sys) && sys.includes(PHRASE), sys.slice(0, 200));
  const tag = await p.evaluate(() => { const v = document.getElementById("v-partner"); return v ? v.innerText : ""; });
  ok("L6 · the coach screen carries the AI label", /\bAI\b/.test(tag), tag.slice(0, 200));
  const body = await p.evaluate(() => ppJoinBody("later"));
  ok("L7 · the same phrase travels to a human partner: every queue request carries it", body.phrase === PHRASE && body.track === "general-english", JSON.stringify(body));
  await fakeAsset(p); await p.evaluate(() => { svPick = 0; svApplyPartner(); }); await sleep(500);
  const st2 = await p.evaluate(() => ({ view: cur.v, phrase: ppState().applyPhrase.text }));
  ok("L8 · Practise with a partner opens Practice Partner with the phrase", st2.view === "partner" && st2.phrase === "Let me walk you through the numbers.", JSON.stringify(st2));
  await p.evaluate(() => { window.__beacons.length = 0; track("partner_turn_sent", {}); track("shadow_challenge_started", {}); track("app_open", {}); });
  await sleep(300);
  const sent = await p.evaluate(() => window.__beacons.slice());
  ok("L9 · General English: Practice Partner and Challenge events are sent", sent.includes("partner_turn_sent") && sent.includes("shadow_challenge_started") && sent.includes("app_open"), JSON.stringify(sent));
  ok("L10 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# Welding: none of it, whatever a call site does");
{
  const { ctx, p, errs, calls } = await open("welding");
  const gates = await p.evaluate(() => ({ ai: svApplyAIOn(), partner: svApplyPartnerOn(), lib: shLibOn(), sv: svOn(), pp: ppAvailable() }));
  ok("W1 · Welding: no Apply It, no library, no Shadow Studio V2, no Practice Partner", !gates.ai && !gates.partner && !gates.lib && !gates.sv && !gates.pp, JSON.stringify(gates));
  await fakeAsset(p);
  const before = await p.evaluate(() => ({ view: cur.v, phrase: (S.pp && S.pp.applyPhrase) || null }));
  await p.evaluate(() => { svApplyAI(); svApplyPartner(); }); await sleep(600);
  const after = await p.evaluate(() => ({ view: cur.v, phrase: (S.pp && S.pp.applyPhrase) || null, ai: (S.pp && S.pp.ai) || null }));
  ok("W2 · calling Apply It directly on Welding does nothing: no phrase stored, no AI session, no page change", JSON.stringify(before) === JSON.stringify({ view: after.view, phrase: after.phrase }) && !after.phrase && !after.ai && !calls.some(c => c.p === "/ai/session"), JSON.stringify({ before, after, calls: calls.map(c => c.p) }));
  await p.evaluate(() => { window.__beacons.length = 0;
    ["partner_turn_sent", "partner_match_requested", "partner_ai_fallback_started", "shadow_challenge_started", "shadow_challenge_completed", "shadow_apply_phrase"].forEach(n => track(n, {}));
    ["app_open", "shadow_report_viewed", "practice_day"].forEach(n => track(n, {})); });
  await sleep(300);
  const sent = await p.evaluate(() => window.__beacons.slice());
  ok("W3 · Welding: every Practice Partner / Challenge / Apply It event is dropped before it leaves the device", !sent.some(n => /^partner_|^shadow_challenge_|^shadow_apply_phrase$/.test(n)), JSON.stringify(sent));
  ok("W4 · Welding: shared events still go out (app_open, the Shadow coach report Welding lines use, practice_day)", ["app_open", "shadow_report_viewed", "practice_day"].every(n => sent.includes(n)), JSON.stringify(sent));
  ok("W5 · Welding: the Shadow page keeps its workshop lines (existing Welding behaviour)", await p.evaluate(async () => { go("shadow"); await new Promise(r => setTimeout(r, 500)); return typeof shWorkplaceLinesHTML === "function" && !!document.querySelector("#v-shadow") && !shLibOn(); }));
  ok("W6 · no JavaScript errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

await b.close(); if (srv) srv.kill();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
