/* Week 1 Monday guided lesson (Phase 2, General English only, flag-gated).
   Run: cd tests && node daily-learning-plan-lesson.mjs
   Uses Chromium's fake audio capture (the same pattern as ds-phase3.mjs) so the
   TRY/REHEARSE/CONVERSE recorders run against a real MediaRecorder + a real
   8-second tone, not a mock — only the Worker (AI grading) is unreachable in
   this environment, which is exactly the "AI failure" path this suite proves
   is handled honestly rather than silently. */
import { chromium } from "playwright";
import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path"; import { tmpdir } from "node:os";

const res = [];
const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };

let BASE = process.env.BASE, server = null;
if (!BASE) {
  server = spawn("python3", ["-m", "http.server", String(process.env.PORT || 8930), "--bind", "127.0.0.1"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
  await sleep(800); BASE = "http://127.0.0.1:" + (process.env.PORT || 8930);
}

const tone = join(mkdtempSync(join(tmpdir(), "dlp-")), "tone.wav");
{ const sr = 48000, n = sr * 8, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / sr) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.5 * i / sr))), 44 + i * 2);
  writeFileSync(tone, b); }

const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-audio-capture=" + tone] });

const F = () => ({ placed: "full", finished: true, day: 1, done: {} });
const seed = (o = {}) => ({ profile: { name: "Alex", lang: "en", ts: 1, role: "Engineering / Data", goal: "🎤 Speak confidently in meetings", selfLevel: "Can get by" }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": F() }, areaSplit: true, days: {}, dates: [], dayLog: {}, steps: {}, vocab: {}, ...o });
async function open(state, flags) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  /* addInitScript re-runs on every navigation, including reload() — guard with
     a sessionStorage marker (the same pattern nav-final.mjs/ia-nba.mjs use) so a
     mid-test reload doesn't silently reset localStorage back to the seed. */
  await ctx.addInitScript(([s, f]) => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", f); } }, [JSON.stringify(state), JSON.stringify({ daily_learning_plan_pilot_enabled: true, ...flags })]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1200);
  return { ctx, p, errs };
}
const jsErr = errs => errs.filter(e => !/MIME type|net::ERR/.test(e));

console.log("\n# Flag off / wrong day / Welding — the classic page renders exactly as before");
{
  const { ctx, p } = await open(seed(), { daily_learning_plan_pilot_enabled: false });
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(500);
  ok("1 · flag off: the classic session page, not the guided flow", await p.evaluate(() => !!document.querySelector("#v-journey .rec-panel") && !document.querySelector(".dlp-steps")));
  await ctx.close();
}
{
  const { ctx, p } = await open(seed());
  await p.evaluate(() => go("session", 1, "Tue")); await sleep(500);
  ok("2 · flag on, but Tuesday: not the guided flow (Week 1 Monday only)", !(await p.evaluate(() => !!document.querySelector(".dlp-steps"))));
  await ctx.close();
}
{
  const { ctx, p } = await open(seed({ professionalTracks: { activeId: "welding", tradeId: "welder" }, fnd: { welding: F() } }));
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(500);
  ok("3 · Welding, flag on: still not the guided flow — General English only", !(await p.evaluate(() => !!document.querySelector(".dlp-steps"))));
  await ctx.close();
}

console.log("\n# The guided flow itself — TRY through LISTEN, text fallback included");
let ctx1, p1;
{
  const { ctx, p, errs } = await open(seed());
  ctx1 = ctx; p1 = p;
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(600);
  const s0 = await p.evaluate(() => ({ dots: document.querySelectorAll(".dlp-dot").length, h1: document.querySelector("#v-journey h1").innerText, chip: document.querySelector("#v-journey .chip").innerText }));
  ok("4 · renders the real Week 1 Monday objective, 7 step dots, starts on Try", s0.dots === 7 && s0.h1 === "Pronunciation baseline" && s0.chip === "Try", JSON.stringify(s0));
  const cont0 = await p.evaluate(() => document.querySelector(".card .btn-primary").disabled);
  ok("5 · Continue is disabled until something is recorded or typed", cont0 === true);
  await p.evaluate(() => document.getElementById("dlpRecBtn").click()); await sleep(2500);
  await p.evaluate(() => document.getElementById("dlpRecBtn").click()); await sleep(1200);
  const s1 = await p.evaluate(() => ({ state: document.querySelector(".card").innerText, disabled: document.querySelector(".card .btn-primary").disabled }));
  ok("6 · after recording TRY, the state shows Recorded and Continue enables", /Recorded/.test(s1.state) && s1.disabled === false, s1.state);
  await p.evaluate(() => document.querySelector(".card .btn-primary").click()); await sleep(400);
  const s2 = await p.evaluate(() => document.querySelector("#v-journey .chip").innerText);
  ok("7 · advances to Learn", s2 === "Learn", s2);
  const expr = await p.evaluate(() => [...document.querySelectorAll(".dlp-expr-list li")].map(x => x.innerText.replace(/\s+/g, " ").trim()));
  ok("8 · Learn shows the REAL week-1 phrase bank expressions, not invented text", expr.some(x => x.includes("I currently work as")), JSON.stringify(expr));
  await p.evaluate(() => { [...document.querySelectorAll(".dlp-expr-list button")].forEach(b => b.click()); }); // tap every "hear it" — must not crash
  await sleep(300);
  await p.evaluate(() => document.querySelector(".card .btn-primary").click()); await sleep(400);
  const vocAdded = await p.evaluate(() => Object.keys(S.vocab || {}).some(w => w.includes("I currently work as")));
  ok("9 · Save & continue adds the taught expressions to the real vocabulary SRS (vocPut), not a second store", vocAdded);
  const s3 = await p.evaluate(() => document.querySelector("#v-journey .chip").innerText);
  ok("10 · advances to Listen", s3 === "Listen", s3);
  const listen = await p.evaluate(() => document.querySelector(".card").innerText);
  ok("11 · Listen is honest about the catalogue — names an actual starter clip or says plainly there's no match, never fabricates one", /library/i.test(listen) || /No matching clip/.test(listen), listen);
  ok("12 · no JavaScript errors through TRY/LEARN/LISTEN", !jsErr(errs).length, errs.join(" | "));
}

console.log("\n# Resumability across a reload — an in-progress lesson is NOT rebuilt, even if the profile changes");
{
  await p1.evaluate(() => document.querySelector(".card .btn-primary").click()); await sleep(400); // Listen -> Rehearse
  const before = await p1.evaluate(() => document.querySelector("#v-journey .chip").innerText);
  ok("13 · now on Rehearse before reload", before === "Rehearse", before);
  /* simulate a profile edit mid-lesson, then reload the page entirely */
  await p1.evaluate(() => { S.profile.selfLevel = "Fluent, want to sound sharper"; S.profile.baseline = 95; save(); });
  await p1.reload(); await sleep(1500);
  await p1.evaluate(() => go("session", 1, "Mon")); await sleep(600);
  const after = await p1.evaluate(() => document.querySelector("#v-journey .chip").innerText);
  ok("14 · after a full reload AND a profile change, the lesson resumes at Rehearse — not rebuilt back to Try", after === "Rehearse", after);
  const snap = await p1.evaluate(() => S.dlp["general:w1Mon"].profileSnapshot.selfLevel);
  ok("15 · the plan's own profileSnapshot is untouched by the later profile edit (the rule: profile changes never silently rewrite an in-progress lesson)", snap === "Can get by", snap);
  await ctx1.close();
}

console.log("\n# Rehearse -> Converse (text fallback) -> Improve (honest: no Worker reachable in this environment) -> Finish");
{
  const { ctx, p, errs } = await open(seed());
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(600);
  /* walk TRY -> LEARN -> LISTEN quickly to reach Rehearse for real, rather than
     fabricate a stub dlp entry — a lessonId's plan is only ever built once by
     start() and is never null in practice, so a contrived null-plan stub would
     prove nothing real about resumability (that's covered properly above). */
  await p.evaluate(() => document.getElementById("dlpRecBtn").click()); await sleep(2500);
  await p.evaluate(() => document.getElementById("dlpRecBtn").click()); await sleep(1200);
  await p.evaluate(() => document.querySelector(".card .btn-primary").click()); await sleep(300); // Try -> Learn
  await p.evaluate(() => document.querySelector(".card .btn-primary").click()); await sleep(300); // Learn -> Listen
  await p.evaluate(() => document.querySelector(".card .btn-primary").click()); await sleep(300); // Listen -> Rehearse
  const step = await p.evaluate(() => document.querySelector("#v-journey .chip")?.innerText);
  ok("16 · walked through to Rehearse", step === "Rehearse", step);
  await p.evaluate(() => document.getElementById("dlpRecBtn0").click()); await sleep(2500);
  await p.evaluate(() => document.getElementById("dlpRecBtn0").click()); await sleep(1200);
  const r1 = await p.evaluate(() => document.querySelectorAll(".dlp-expr-list .chip.done").length);
  ok("17 · recording one rehearsal expression marks it done", r1 === 1, r1);
  await p.evaluate(() => document.querySelector(".card .btn-primary").click()); await sleep(400);
  ok("18 · advances to Converse", await p.evaluate(() => document.querySelector("#v-journey .chip").innerText) === "Converse");
  await p.evaluate(() => { document.querySelector(".card details").open = true; document.querySelector('[id^="dlpTypeconverse"]').value = "Hi, I currently work as a backend engineer on the payments team."; });
  await p.evaluate(() => [...document.querySelectorAll(".card button")].find(b => /Save/.test(b.innerText)).click()); await sleep(300);
  await p.evaluate(() => document.querySelector(".card .btn-primary").click()); await sleep(400);
  const improveTxt = await p.evaluate(() => document.querySelector("#dlpBody").innerText);
  ok("19 · a typed CONVERSE response gets an HONEST Improve step — acknowledges the typing, does NOT claim a pronunciation assessment happened", /typed|can't assess pronunciation/i.test(improveTxt), improveTxt);
  await p.evaluate(() => [...document.querySelectorAll("#dlpBody button")].find(b => /Finish/.test(b.innerText)).click()); await sleep(400);
  const fin = await p.evaluate(() => ({ chip: document.querySelector("#v-journey .chip")?.innerText, dayDone: S.days["w1Mon"], text: document.querySelector("#dlpBody").innerText }));
  ok("20 · Finish marks the real curriculum day done (S.days, same as the classic page) and shows an evidence-based note, not a score", fin.chip === "Finish" && fin.dayDone === true, JSON.stringify(fin));
  ok("21 · no JavaScript errors through Rehearse/Converse/Improve/Finish", !jsErr(errs).length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# Converse with REAL audio -> Improve, with no Worker reachable in this environment — must be honest, not claim 'nothing to fix'");
{
  const { ctx, p, errs } = await open(seed());
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(600);
  await p.evaluate(() => document.getElementById("dlpRecBtn").click()); await sleep(2500);
  await p.evaluate(() => document.getElementById("dlpRecBtn").click()); await sleep(1200);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.querySelector(".card .btn-primary").click()); await sleep(300); } // Try->Learn->Listen->Rehearse
  await p.evaluate(() => document.getElementById("dlpRecBtn0").click()); await sleep(2500);
  await p.evaluate(() => document.getElementById("dlpRecBtn0").click()); await sleep(1200);
  await p.evaluate(() => document.querySelector(".card .btn-primary").click()); await sleep(300); // Rehearse->Converse
  ok("23 · reached Converse", await p.evaluate(() => document.querySelector("#v-journey .chip").innerText) === "Converse");
  await p.evaluate(() => document.getElementById("dlpRecBtn").click()); await sleep(2500);
  await p.evaluate(() => document.getElementById("dlpRecBtn").click()); await sleep(1200);
  await p.evaluate(() => document.querySelector(".card .btn-primary").click()); await sleep(2000); // Converse -> Improve, triggers grading
  const body = await p.evaluate(() => document.getElementById("dlpBody").innerText);
  ok("24 · with real audio but no Worker reachable, Improve says it couldn't reach the coach — never a false 'nothing to fix' and never someone else's old correction", /couldn't reach the coach/i.test(body), body);
  const sd = await p.evaluate(() => S.dlp["general:w1Mon"].stepData.improve);
  ok("25 · the honest outcome is recorded in stepData (aiReached:false), not silently dropped", sd && sd.mode === "audio" && sd.aiReached === false, JSON.stringify(sd));
  ok("26 · no JavaScript errors", !jsErr(errs).length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# Idempotent completion + multiple same-day lessons don't collide");
{
  const { ctx, p } = await open(seed({ days: { w1Mon: true }, dlp: { "general:w1Mon": { lessonId: "general:w1Mon", plan: { competencyObjective: "Pronunciation baseline", learnerContext: {}, personalizedScenario: {}, targetExpressions: [], assessmentCriteria: [], staticFallback: { competencyObjective: "x" }, curriculumVersion: "1", learnerProfileVersion: "1", lessonId: "general:w1Mon", week: 1, day: "Mon" }, step: "finish", stepData: {}, profileSnapshot: {}, startedAt: Date.now() - 999999, completedAt: Date.now() - 999999, attempt: 1 } } }));
  await p.evaluate(() => go("session", 1, "Mon")); await sleep(600);
  const r = await p.evaluate(() => ({ attempt: S.dlp["general:w1Mon"].attempt, step: document.querySelector("#v-journey .chip")?.innerText }));
  ok("22 · opening an already-completed lesson again starts a fresh, real retry (attempt increments, back on Try) rather than reusing the finished one silently", r.attempt === 2 && r.step === "Try", JSON.stringify(r));
  await ctx.close();
}

const fails = res.filter(x => !x).length;
console.log(`\n${res.length - fails}/${res.length} passed`);
await b.close(); if (server) server.kill();
process.exit(fails ? 1 : 0);
