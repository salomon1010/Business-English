/* Learner profile addition (Phase 1, 6 Nov 2026): a plain, user-declared
   confidence read — never a CEFR grade, never required, never re-asked of an
   existing learner. Replaces the onboarding "when do you practise" (slot)
   question, which was collected and read by nothing in the app.

   Run: cd tests && node profile-selflevel.mjs */
import { chromium } from "playwright";
import { spawn } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";

const res = [];
const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };

let BASE = process.env.BASE, server = null;
if (!BASE) {
  server = spawn("python3", ["-m", "http.server", String(process.env.PORT || 8927), "--bind", "127.0.0.1"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
  await sleep(800); BASE = "http://127.0.0.1:" + (process.env.PORT || 8927);
}
const b = await chromium.launch();

console.log("\n# fresh onboarding: the level step replaces the old slot step, same position, same step count");
{
  const ctx = await b.newContext();
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1500);
  await p.evaluate(() => { document.getElementById("obName").value = "Alex"; obNext(); }); await sleep(400);
  await p.evaluate(() => obLangPick("en")); await sleep(800);
  await p.evaluate(() => obTrackPick("general-english")); await sleep(500);
  await p.evaluate(() => { OB.role = "Engineering / Data"; obNext(); }); await sleep(500);
  await p.evaluate(() => obGoalPick("🎤 Speak confidently in meetings")); await sleep(500);
  const s5 = await p.evaluate(() => ({ step: OB.step, title: document.querySelector("#obWrap h1")?.innerText || "", chips: [...document.querySelectorAll(".ob-chip")].map(x => x.innerText.trim()) }));
  ok("1 · step 5 is now the self-level question, with exactly 5 plain-language options, no CEFR jargon", s5.step === 5 && /English today/.test(s5.title) && s5.chips.join("|") === "New to speaking English|Can get by|Comfortable but not confident|Fluent, want to sound sharper|Not sure", JSON.stringify(s5));
  await p.evaluate(() => obLevelPick("Can get by")); await sleep(500);
  const s6 = await p.evaluate(() => ({ step: OB.step, selfLevel: OB.selfLevel, title: document.querySelector("#obWrap h1")?.innerText || "" }));
  ok("2 · picking a level stores it and advances to the win step, unchanged", s6.step === 6 && s6.selfLevel === "Can get by" && /first win/.test(s6.title), JSON.stringify(s6));
  await p.evaluate(() => obFinish()); await sleep(300);
  const profile = await p.evaluate(() => S.profile);
  ok("3 · S.profile carries selfLevel alongside the existing fields, slot stays present but empty (never asked, harmless for any code that still reads it)", profile.selfLevel === "Can get by" && profile.name === "Alex" && profile.role === "Engineering / Data" && profile.slot === "", JSON.stringify(profile));
  ok("4 · no JavaScript errors through the whole flow", !errs.filter(e => !/MIME type/.test(e)).length, errs.join(" | "));
  await ctx.close();
}

console.log("\n# existing learners are never forced through onboarding again");
{
  const ctx = await b.newContext();
  await ctx.addInitScript(() => { localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "Existing", role: "Student", goal: "", slot: "bar", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true, day: 1, done: {} } }, areaSplit: true, days: {}, dates: [], dayLog: {}, steps: {}, vocab: {} })); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/index.html"); await sleep(1800);
  const shown = await p.evaluate(() => !!document.getElementById("obWrap"));
  ok("5 · a learner whose stored profile predates selfLevel is NOT shown onboarding again", !shown);
  ok("6 · no JavaScript error from the missing field — it's simply undefined, not a crash", !errs.filter(e => !/MIME type/.test(e)).length, errs.join(" | "));

  console.log("\n# …but CAN set it afterwards, from Account settings — no second profile store");
  await p.evaluate(() => go("data")); await sleep(800);
  const sel = await p.evaluate(() => ({ present: !!document.querySelector('label[for="acLevel"]'), opts: [...document.querySelectorAll("#acLevel option")].map(o => o.textContent) }));
  ok("7 · Account settings offers the same 5 options (plus '—' for unset), reusing S.profile — not a second store", sel.present && sel.opts.join("|") === "New to speaking English|Can get by|Comfortable but not confident|Fluent, want to sound sharper|Not sure|—", JSON.stringify(sel));
  await p.evaluate(() => { document.getElementById("acLevel").value = "Comfortable but not confident"; acctSave(); }); await sleep(300);
  const after = await p.evaluate(() => S.profile.selfLevel);
  ok("8 · saving from Account settings writes straight into S.profile.selfLevel", after === "Comfortable but not confident", after);
  await ctx.close();
}

const fails = res.filter(x => !x).length;
console.log(`\n${res.length - fails}/${res.length} passed`);
await b.close(); if (server) server.kill();
process.exit(fails ? 1 : 0);
