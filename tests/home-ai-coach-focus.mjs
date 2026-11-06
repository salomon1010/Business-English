/* "Your AI Coach's Focus" Home card + the Start/Continue wiring (Phase 2
   Slice C, 6 Nov 2026, General English only, flag-gated). Run:
   cd tests && node home-ai-coach-focus.mjs */
import { chromium } from "playwright";
import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";

const res = [];
const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };

let BASE = process.env.BASE, server = null;
if (!BASE) {
  server = spawn("python3", ["-m", "http.server", String(process.env.PORT || 8936), "--bind", "127.0.0.1"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
  await sleep(800); BASE = "http://127.0.0.1:" + (process.env.PORT || 8936);
}
const b = await chromium.launch();
const F = () => ({ placed: "full", finished: true, day: 1, done: {} });
const seed = (o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": F() }, areaSplit: true, days: {}, dates: [], dayLog: {}, steps: {}, vocab: {}, ...o });
async function open(state, flags = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([s, f]) => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", f); } }, [JSON.stringify(state), JSON.stringify({ home_v2_enabled: true, daily_learning_plan_pilot_enabled: true, ...flags })]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1200);
  return { ctx, p, errs };
}
const jsErr = errs => errs.filter(e => !/MIME type|net::ERR/.test(e));
const focusCard = p => p.evaluate(() => { const c = document.querySelector(".home-coach-focus"); return c ? c.innerText.replace(/\s+/g, " ").trim() : null; });
const heroCta = p => p.evaluate(() => document.querySelector(".hx-cta")?.innerText.replace(/→/g, "").trim());

console.log("\n# gating — flag off, Welding, and a fresh learner with zero evidence");
{
  const { ctx, p } = await open(seed(), { daily_learning_plan_pilot_enabled: false });
  ok("1 · flag off: no coach-focus card at all", (await focusCard(p)) === null);
  await ctx.close();
}
{
  const { ctx, p } = await open(seed({ professionalTracks: { activeId: "welding", tradeId: "welder" }, fnd: { welding: F() } }));
  ok("2 · Welding: no coach-focus card — General English only", (await focusCard(p)) === null);
  await ctx.close();
}
{
  const { ctx, p, errs } = await open(seed());
  const c = await focusCard(p);
  ok("3 · a brand-new learner on Week 1 Monday sees the card in its NOT_ASSESSED state — today's objective, no invented weakness", c && /[Pp]ronunciation baseline/.test(c) && !/Enough recorded|pattern is forming|One recorded attempt/.test(c), c);
  ok("4 · no JavaScript errors", !jsErr(errs).length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# the four evidence states — strictly from real DailyPlan attempt counts, spoken evidence only");
const dlpBase = { lessonId: "general:w1Mon", plan: { competencyObjective: "Pronunciation baseline" }, stepData: { improve: { mode: "audio" } }, profileSnapshot: {}, startedAt: Date.now(), step: "finish" };
{
  const { ctx, p } = await open(seed({ dlp: { "general:w1Mon": { ...dlpBase, attempt: 1, completedAt: Date.now() } } }));
  const c = await focusCard(p);
  ok("5 · one completed attempt with real audio → INITIAL state", c && /One recorded attempt/.test(c), c);
  await ctx.close();
}
{
  const { ctx, p } = await open(seed({ dlp: { "general:w1Mon": { ...dlpBase, attempt: 2, completedAt: Date.now() } } }));
  const c = await focusCard(p);
  ok("6 · two completed attempts → DEVELOPING state", c && /pattern is forming/.test(c), c);
  await ctx.close();
}
{
  const { ctx, p } = await open(seed({ dlp: { "general:w1Mon": { ...dlpBase, attempt: 3, completedAt: Date.now() } } }));
  const c = await focusCard(p);
  ok("7 · three completed attempts → ESTABLISHED state (strength + a clear next focus)", c && /Enough recorded attempts/.test(c), c);
  await ctx.close();
}
{
  /* same attempt count, but the evidence is TYPED, not spoken — must never be
     shown as a real pronunciation assessment, no matter how many attempts */
  const { ctx, p } = await open(seed({ dlp: { "general:w1Mon": { ...dlpBase, attempt: 3, completedAt: Date.now(), stepData: { improve: { mode: "text" } } } } }));
  const c = await focusCard(p);
  ok("8 · three TYPED-only attempts still read as not-yet-assessed — text completion is never shown as a verified speaking assessment", c && /[Pp]ronunciation baseline/.test(c) && !/Enough recorded attempts/.test(c), c);
  await ctx.close();
}
{
  /* an in-progress (not yet completed) attempt doesn't count toward evidence either */
  const { ctx, p } = await open(seed({ dlp: { "general:w1Mon": { ...dlpBase, attempt: 1, completedAt: null } } }));
  const c = await focusCard(p);
  ok("9 · a still-in-progress attempt (never finished) is not evidence yet — NOT_ASSESSED, and the card still offers to continue it", c && /[Pp]ronunciation baseline/.test(c) && /Continue your lesson/.test(c), c);
  await ctx.close();
}

console.log("\n# Start / Continue — the hero's own button, driven by real DailyPlan state, not a second progress tracker");
{
  const { ctx, p } = await open(seed());
  const before = await heroCta(p);
  ok("10 · nothing started yet: the hero's button is the plain 'Start session' (unchanged wording)", before === "Start session", before);
  await ctx.close();
}
{
  const { ctx, p } = await open(seed({ dlp: { "general:w1Mon": { ...dlpBase, attempt: 1, completedAt: null, step: "rehearse" } } }));
  const after = await heroCta(p);
  ok("11 · an in-progress (uncompleted) lesson: the hero's button says 'Continue your lesson'", after === "Continue your lesson", after);
  await ctx.close();
}
{
  const { ctx, p } = await open(seed({ days: { w1Mon: true }, dlp: { "general:w1Mon": { ...dlpBase, attempt: 1, completedAt: Date.now() } } }));
  const after = await heroCta(p);
  ok("12 · a COMPLETED lesson no longer says 'Continue your lesson' (the day is done — the engine picks a different card entirely)", after !== "Continue your lesson", after);
  await ctx.close();
}

const fails = res.filter(x => !x).length;
console.log(`\n${res.length - fails}/${res.length} passed`);
await b.close(); if (server) server.kill();
process.exit(fails ? 1 : 0);
