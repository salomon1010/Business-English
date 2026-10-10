/* Verifies P1 on PRODUCTION be-polish: the AI cost-control wrapper in REPORT-ONLY
   mode (docs/AI-COST-CONTROL.md §10). Run: node backend/verify-p1-production.mjs

   Safe by construction: no account is created or used (production Firebase is
   not touched), only cheap gpt-4o-mini routes are called (about $0.003 in
   total), and report mode refuses nothing — every request must be answered
   exactly as before. Prints no secret, token or response body. */
const API = "https://be-polish.nore-ngou.workers.dev";
const ORIGIN = "https://app.lomonec.com";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 200)}`); };
async function post(body, { origin = ORIGIN, auth = null } = {}) {
  const headers = { "content-type": "application/json" }; if (origin) headers.origin = origin; if (auth) headers.authorization = auth;
  const r = await fetch(API, { method: "POST", headers, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, j, acao: r.headers.get("access-control-allow-origin") };
}
const mv = n => ({ mvreport: { system: "You assess a short spoken workplace answer. Reply as JSON.", said: "I led the weekly team meeting and agreed the next steps " + n } });

console.log("\n# unchanged behaviour");
const pre = await fetch(API, { method: "OPTIONS", headers: { origin: ORIGIN } });
ok("V1 · CORS preflight answers 200 for the app's origin", pre.status === 200 && pre.headers.get("access-control-allow-origin") === ORIGIN, pre.status);
const bad = await post(mv(0), { origin: "https://evil.example" });
ok("V2 · an origin that is not allowed is still refused (403), as before", bad.status === 403, bad.status);
const wm = await post({ wm: { op: "status", prog: "welding" } });
ok("V3 · the game route is untouched: no account → 401", wm.status === 401, wm.status);
const sh = await post({ chat: { purpose: "shadow", system: "Translate the user's sentence into French. Reply as JSON {\"reply\":\"...\"}.", messages: [{ role: "user", content: "Good morning." }] } });
ok("V4 · Shadow's reading helper answers without an account (200)", sh.status === 200, sh.status);

console.log("\n# report-only: counted and recorded, never refused");
const r = [];
for (let i = 1; i <= 4; i++) r.push(await post(mv(i)));
ok("V5 · four anonymous verdict requests (the proposed visitor allowance is 3) are ALL answered", r.every(x => x.status === 200), r.map(x => x.status));
ok("V6 · none of them carries the anonymous refusal shape", r.every(x => !(x.j && x.j.scope === "anon")));
const forged = await post(mv(5), { auth: "Bearer not-a-real-token" });
ok("V7 · a forged token is answered as before (counted as a visitor, not refused)", forged.status === 200, forged.status);

const failed = res.filter(x => !x).length;
console.log(`\n${res.length - failed}/${res.length} passed against ${API}`);
process.exit(failed ? 1 : 0);
