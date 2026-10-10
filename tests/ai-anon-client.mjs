/* The client side of the anonymous AI policy (backend/ai-guard.js,
   docs/AI-COST-CONTROL.md). Only matters once ANON_AI_POLICY=enforce: the Worker
   then answers a visitor whose allowance is spent with
   429 {error:"allowance", scope:"anon", resetAt}. The app must treat that as
   "sign in to use the AI features" — the path every AI call site already has —
   and must NOT file it as a spent Free allowance.

     cd tests && node ai-anon-client.mjs        (PORT=<free port> if 8795 is taken) */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = +(process.env.PORT || 8795);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
await sleep(900);
const BASE = "http://127.0.0.1:" + PORT;
const res = [];
const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 240)}`); };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e.message)));
  await page.goto(BASE + "/index.html", { waitUntil: "load" });
  await page.evaluate(() => { OB.name = "Anon"; obFinish(); try { wcClose(); } catch (e) {} });
  await sleep(600);

  const before = await page.evaluate(() => ({ off: aiNoAccount(), note: aiOffNote("ai_analysis") === t("ai.need_acct") }));
  ok("1 · before any refusal an anonymous learner is not told to sign in (production today)", before.off === false && before.note === false, JSON.stringify(before));

  /* the Worker's anonymous refusal, as aiAllowTap receives it */
  const after = await page.evaluate(async () => {
    const resetAt = Date.now() + 3600_000;
    aiAllowTap(new Response(JSON.stringify({ error: "allowance", scope: "anon", reason: "ip", signIn: true, resetAt, retryAfter: 3600 }), { status: 429, headers: { "content-type": "application/json" } }));
    await new Promise(r => setTimeout(r, 50));
    return { off: aiNoAccount(), aiOff: aiOff("ai_analysis"), note: aiOffNote("ai_analysis") === t("ai.need_acct"), allow: aiAllowance() };
  });
  ok("2 · after scope 'anon' every AI call site takes the sign-in path (aiNoAccount / aiOff)", after.off === true && after.aiOff === true, JSON.stringify(after));
  ok("3 · …and the note is the existing 'Sign in to use the AI features' message", after.note === true);
  ok("4 · it is NOT filed as a spent Free allowance", !after.allow || after.allow.limit !== undefined && after.allow.used !== after.allow.limit || after.allow == null, JSON.stringify(after.allow));

  const expired = await page.evaluate(() => { sessionStorage.setItem("be_ai_anon_out", String(Date.now() - 1000)); return aiNoAccount(); });
  ok("5 · once the reset time has passed the learner is let back in", expired === false);

  const verdicts = await page.evaluate(async () => {
    sessionStorage.removeItem("be_ai_anon_out");
    aiAllowTap(new Response(JSON.stringify({ error: "allowance", scope: "verdicts", limit: 3, used: 3, resetAt: Date.now() + 3600_000, plan: "free" }), { status: 429, headers: { "content-type": "application/json" } }));
    await new Promise(r => setTimeout(r, 50));
    return { out: aiAllowOut(), anon: aiAnonOut() };
  });
  ok("6 · a Free account's verdict limit still behaves exactly as before (spent, not 'sign in')", verdicts.out === true && verdicts.anon === false, JSON.stringify(verdicts));
  ok("7 · no page errors", !errors.length, errors.join(" | "));
} finally { await browser.close(); server.kill(); }
const failed = res.filter(x => !x).length;
console.log(`\n${res.length - failed}/${res.length} passed`);
process.exit(failed ? 1 : 0);
