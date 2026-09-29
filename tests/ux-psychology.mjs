/* UX psychology layer (29 Sep 2026, feature/bemastery-complete-ux-redesign).
   Every check is about honesty: the page says what is true of THIS learner.
   Run: cd tests && node ux-psychology.mjs   (BASE=… for another tree; PORT=… for the server it starts) */
import { webkit, devices } from "playwright"; import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
const root = new URL("..", import.meta.url).pathname, PORT = +(process.env.PORT || 8147);
let BASE = process.env.BASE, srv = null;
if (!BASE) { srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" }); await sleep(800); BASE = `http://127.0.0.1:${PORT}`; }
const OUT = process.env.OUT || null;
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 500)}`); };
const b = await webkit.launch();
const DAY = 864e5, d = n => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
const placed = { "general-english": { placed: "full", finished: true }, welding: { placed: "full", finished: true } };
const seed = (o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1, goal: "🎤 Speak confidently in meetings", slot: "🌙 Evening wind-down" }, professionalTracks: { activeId: "general-english", tradeId: "welder" }, fnd: placed, days: {}, dates: [], dayLog: {}, steps: {}, scores: {}, notes: {}, vocab: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now(), ...o });
async function open(state, opts = {}) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
  await ctx.route(u => /be-events|cloudflareinsights|be-partner|be-push|entitlements|be-polish|youtube\.com/.test(u.href), r => r.fulfill({ status: 204, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(([s, f]) => { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", 1); if (s) localStorage.setItem("be12_v1", s); if (f) localStorage.setItem("be_flags", f); } }, [state ? JSON.stringify(state) : null, JSON.stringify(opts.flags || { home_v2_enabled: true })]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html" + (opts.hash || "")); await sleep(2500);
  await p.evaluate(() => document.querySelectorAll("#obWrap,#wcOv,.cf-ov,.wc-ov,#rmCel,.lang-modal-ov,#fndCheckOv").forEach(e => e.remove()));
  return { ctx, p, errs };
}
const view = async (p, v) => { await p.evaluate(v => go(v), v); await sleep(900); await p.evaluate(() => document.querySelectorAll("#wcOv,.cf-ov,.wc-ov,#rmCel").forEach(e => e.remove())); };
const hero = p => p.evaluate(() => { const h = document.querySelector(".hx"); if (!h) return null; return { eyebrow: (h.querySelector(".hx-eyebrow,.hx-kicker") || {}).innerText || "", text: h.innerText, cta: h.querySelector(".hx-cta").innerText.replace(/→/g, "").trim() } });

console.log("\n# Home: the hero button names the action, and never says 'continue' to someone who has not started");
{ const { ctx, p, errs } = await open(seed());
  const h = await hero(p);
  ok("1 · no session done: 'Your first session' and 'Start session' — not 'Continue where you left off'", h && /Your first session/i.test(h.text) && !/left off/i.test(h.text) && h.cta === "Start session", JSON.stringify(h));
  if (OUT) await p.screenshot({ path: OUT + "/v-home-first.png" });
  await view(p, "review");
  const pg = await p.evaluate(() => { const e = document.querySelector(".pg-ess"); return { start: !!e.querySelector(".pg-start"), zeros: e.querySelectorAll(".stat").length, text: e.innerText, go: (e.querySelector(".pg-start-go") || {}).getAttribute?.("onclick") } });
  ok("2 · Progress, nothing done: the start panel replaces the four zeros", pg.start && pg.zeros === 0, JSON.stringify(pg));
  ok("3 · … it names the real position and only what the learner set up (goal, practice time, placement check)", /Week 1 · Monday/.test(pg.text) && /Your goal: Speak confidently in meetings/.test(pg.text) && /Your practice time: Evening wind-down/.test(pg.text) && /Placement check done/.test(pg.text) && !/words saved/.test(pg.text), pg.text);
  ok("4 · … and its one button opens that session", /go\('session',1,'Mon'\)/.test(pg.go || ""), pg.go);
  const mile = await p.evaluate(() => (document.querySelector(".pg-mile") || {}).innerText || "");
  ok("5 · the certificate card adds a near milestone from real counts: finish Week 1 — 0 of 7", /finish Week 1 — 0 of 7 sessions/.test(mile), mile);
  if (OUT) await p.screenshot({ path: OUT + "/v-progress-first.png", fullPage: true });
  ok("6 · no JavaScript errors", !errs.filter(e => !/MIME type/.test(e)).length, errs.join(" | ")); await ctx.close(); }

{ const days = { w1Mon: true, w1Tue: true }; const { ctx, p, errs } = await open(seed({ days, dates: [d(1)], dayLog: { [d(1)]: 1 }, dayLogA: { "general-english": { [d(1)]: 1 } }, vocab: { deadline: { ts: Date.now(), reps: 1, due: Date.now() + 9e7, tk: ["general-english"] } } }));
  const h = await hero(p);
  ok("7 · two sessions done, today's not begun: 'Start session', and no 'first session' eyebrow", h && h.cta === "Start session" && !/Your first session/i.test(h.text), JSON.stringify(h));
  await view(p, "review");
  const pg = await p.evaluate(() => { const e = document.querySelector(".pg-ess"); return { start: !!e.querySelector(".pg-start"), zeros: e.querySelectorAll(".stat").length, mile: (document.querySelector(".pg-mile") || {}).innerText || "" } });
  ok("8 · once there is something to count, the numbers are back and the start panel is gone", !pg.start && pg.zeros === 4, JSON.stringify(pg));
  ok("9 · the milestone counts the week's real sessions: 2 of 7", /finish Week 1 — 2 of 7 sessions/.test(pg.mile), pg.mile);
  ok("9b · no JavaScript errors", !errs.filter(e => !/MIME type/.test(e)).length, errs.join(" | ")); await ctx.close(); }

{ const { ctx, p, errs } = await open(seed({ days: {}, steps: { w1Mon: [0, 1] }, dates: [d(1)], dayLog: { [d(1)]: 1 }, dayLogA: { "general-english": { [d(1)]: 1 } } }));
  const h = await hero(p);
  ok("10 · steps ticked on today's session: 'Resume session'", h && h.cta === "Resume session", JSON.stringify(h)); await ctx.close(); }

console.log("\n# Welding: the same Progress rules, the other area's record");
{ const { ctx, p, errs } = await open(seed({ professionalTracks: { activeId: "welding", tradeId: "welder" } }), { flags: {} });
  await view(p, "review");
  const pg = await p.evaluate(() => { const e = document.querySelector(".pg-ess"); return { start: !!e.querySelector(".pg-start"), text: e.innerText, go: (e.querySelector(".pg-start-go") || {}).getAttribute?.("onclick") } });
  ok("11 · Welding, nothing done: the start panel, with a session link", pg.start && /go\('session',1,/.test(pg.go || "") && /Week 1/.test(pg.text), JSON.stringify(pg));
  if (OUT) await p.screenshot({ path: OUT + "/v-progress-welding.png", fullPage: true });
  ok("11b · no JavaScript errors", !errs.filter(e => !/MIME type/.test(e)).length, errs.join(" | ")); await ctx.close(); }

console.log("\n# Welcome: praise only what happened");
{ const { ctx, p } = await open(null);
  const lead = await p.evaluate(async () => { OB.name = "Sam"; OB.best = 0; obFinish(); await new Promise(r => setTimeout(r, 600)); return (document.querySelector(".wc-lead") || {}).innerText || "" });
  ok("12 · skipped the first win: 'Welcome, Sam.' — not 'Excellent start'", /^Welcome, Sam\./.test(lead) && !/Excellent/.test(lead), lead); await ctx.close(); }
{ const { ctx, p } = await open(null);
  const lead = await p.evaluate(async () => { OB.name = "Sam"; OB.best = 82; obFinish(); await new Promise(r => setTimeout(r, 600)); return (document.querySelector(".wc-lead") || {}).innerText || "" });
  ok("13 · said the first-win sentence: 'Excellent start, Sam.'", /^Excellent start, Sam\./.test(lead), lead); await ctx.close(); }

console.log("\n# French learners (the main audience) get the translation");
{ const { ctx, p } = await open(seed({ profile: { name: "Alex", lang: "fr", ts: 1 } }));
  await p.evaluate(async () => { try { await setLang("fr") } catch (e) {} }); await sleep(1200); await view(p, "review");
  const txt = await p.evaluate(() => (document.querySelector(".pg-start") || {}).innerText || "");
  ok("14 · French: 'Voici votre point de départ'", /Voici votre point de départ/.test(txt), txt); await ctx.close(); }

await b.close(); if (srv) srv.kill();
const n = res.filter(Boolean).length; console.log(`\n${n}/${res.length} passed`); process.exit(n === res.length ? 0 : 1);
