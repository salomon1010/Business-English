/* Validates the AI cost controls on the DEPLOYED staging Worker (be-polish-staging).
   docs/AI-COST-CONTROL.md §8. Run: node backend/validate-ai-cost-staging.mjs

   Real requests, real provider (a few cents of OpenAI). A throwaway account is
   created in the staging Firebase project (be-mastery-test) and DELETED at the
   end, pass or fail. No token, transcript or key is printed.

   Staging has PREMIUM_ENFORCED=1, so the anonymous policy never runs there
   (an account is already required); what this proves on the deployed Worker:
   the account requirement, Shadow's anonymous exception, the Free allowance of 3,
   the refund of a verdict refused by validation, and the duplicate guard. */
import { readFileSync } from "node:fs";

const API = process.env.POLISH || "https://be-polish-staging.nore-ngou.workers.dev";
const ORIGIN = "https://staging.lomonec.com";
const fb = JSON.parse(readFileSync(new URL("../mobile/ios/staging-firebase.json", import.meta.url), "utf8"));
if (fb.projectId !== "be-mastery-test") throw new Error("not the staging Firebase project");

const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 240)}`); };
const idt = "https://identitytoolkit.googleapis.com/v1/accounts:";
async function post(body, token) {
  const headers = { "content-type": "application/json", origin: ORIGIN };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(API, { method: "POST", headers, body: JSON.stringify(body) });
  let j = null; try { j = await r.clone().json(); } catch {}
  let allow = null; try { allow = JSON.parse(r.headers.get("x-be-allowance") || "null"); } catch {}
  return { status: r.status, j, allow };
}
const analyse = t => ({ analyse: { transcript: t, metrics: { seconds: 20 }, lang: "en", context: { track: "general" } } });

const email = "ai-cost-validate-" + Date.now() + "@example.invalid";
const su = await (await fetch(idt + "signUp?key=" + fb.apiKey, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: crypto.randomUUID(), returnSecureToken: true }) })).json();
const token = su.idToken;
if (!token) { console.log("could not create the throwaway account:", su.error && su.error.message); process.exit(1); }
console.log("  (throwaway staging account created)");
try {
  console.log("\n# account requirement and the Shadow exception (unchanged behaviour)");
  const a = await post(analyse("I would like to present our quarterly results to the board today"));
  ok("S1 · no account → 401 auth_required (no provider call)", a.status === 401 && a.j && a.j.error === "auth_required", a.status);
  const s = await post({ chat: { purpose: "shadow", system: "Translate the user's sentence into French. Reply as JSON {\"reply\":\"...\"}.", messages: [{ role: "user", content: "Good morning." }] } });
  ok("S2 · Shadow's reading helper still works without an account (owner rule, 3 Oct)", s.status === 200, s.status);

  console.log("\n# the Free allowance, refunds and the duplicate guard, on the deployed Durable Object");
  const v1 = await post(analyse("I would like to present our quarterly results to the board today"), token);
  ok("S3 · first verdict → 200, allowance 1 of 3, plan free", v1.status === 200 && v1.allow && v1.allow.used === 1 && v1.allow.limit === 3 && v1.allow.plan === "free", JSON.stringify([v1.status, v1.allow]));
  const bad = await post({ analyse: { transcript: "too short" } }, token);
  ok("S4 · a request refused by validation → 400", bad.status === 400, bad.status);
  await new Promise(r => setTimeout(r, 1500));     // the refund is settled after the response (waitUntil)
  const v2 = await post(analyse("Our team delivered the project two weeks ahead of schedule this spring"), token);
  ok("S5 · …and it cost nothing: the next verdict reads 2 of 3, not 3", v2.status === 200 && v2.allow && v2.allow.used === 2, JSON.stringify([v2.status, v2.allow]));
  const same = analyse("We should review the supplier contract before the end of the month");
  const pair = await Promise.all([post(same, token), post(same, token)]);
  const st = pair.map(x => x.status).sort();
  ok("S6 · two identical simultaneous requests → one 200, one 409 duplicate_in_flight", st[0] === 200 && st[1] === 409, JSON.stringify(pair.map(x => [x.status, x.j && x.j.error])));
  await new Promise(r => setTimeout(r, 1500));
  const v4 = await post(analyse("Next quarter we will focus on retention and customer feedback"), token);
  ok("S7 · the duplicate spent nothing and the Free cap of 3 is in force: 4th distinct verdict → 429 allowance", v4.status === 429 && v4.j && v4.j.error === "allowance" && v4.j.scope === "verdicts" && v4.j.limit === 3, JSON.stringify([v4.status, v4.j]));
} finally {
  const d = await fetch(idt + "delete?key=" + fb.apiKey, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: token }) });
  console.log(d.ok ? "\n  (throwaway account deleted)" : "\n  !! could not delete the throwaway account: " + email);
}
const failed = res.filter(x => !x).length;
console.log(`\n${res.length - failed}/${res.length} passed against ${API}`);
process.exit(failed ? 1 : 0);
