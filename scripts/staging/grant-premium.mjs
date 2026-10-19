/* ───────────────────────────────────────────────────────────────────────────
   STAGING ONLY — give a test account Premium, or take it away.

       node scripts/staging/grant-premium.mjs <uid> [--app welding] [--days 30]
       node scripts/staging/grant-premium.mjs <uid> [--app welding] --withdraw

   Why this exists: no real store purchase can be made on staging — there are
   no store secrets on be-entitlements-staging, so the purchase routes answer
   501 — and Premium still has to be visible to test it. be-entitlements has
   the owner's manual grant for exactly this (POST /v1/admin/grant, ADMIN_TOKEN,
   never CORS-enabled, invisible without the secret), and a grant is a real
   entitlement: the app learns about it the same way it would learn about a
   purchase, through GET /v1/entitlement.

   The token is read from ~/.config/be-mastery/secrets/ and never printed. It is
   the STAGING token; the production one is a different secret and this script
   deliberately has no way to reach production.

   An entitlement is per (account, programme) since migration 0005, so --app
   decides which of the two apps gets it. Omit it and it is General English.
   Find a uid by signing in on the staging web app and reading it from Profile →
   App Setup → account, or from the Firebase console of be-mastery-test.
   ─────────────────────────────────────────────────────────────────────────── */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const API = "https://be-entitlements-staging.nore-ngou.workers.dev";
const SECRET = resolve(homedir(), ".config/be-mastery/secrets/be-entitlements-staging.ADMIN_TOKEN");
const PROGRAMMES = ["general-english", "welding"];

const argAfter = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const uid = process.argv[2];
if (!uid || uid.startsWith("--")) {
  console.error("usage: node scripts/staging/grant-premium.mjs <uid> [--app welding] [--days 30] [--withdraw]");
  process.exit(2);
}
const app = argAfter("--app") || "general-english";
if (!PROGRAMMES.includes(app)) throw new Error(`--app must be one of ${PROGRAMMES.join(" / ")}`);
const days = Number(argAfter("--days") || 30);
if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number");
const withdraw = process.argv.includes("--withdraw");

let token;
try { token = readFileSync(SECRET, "utf8").trim(); }
catch (e) { throw new Error(`no staging admin token at ${SECRET} — it is set with: npx wrangler secret put ADMIN_TOKEN --env staging`); }
if (token.length < 32) throw new Error("the stored token is too short to be the one the Worker accepts");

const body = {
  uid, app,
  plan: "premium",
  /* "expired" is how a grant is withdrawn: the row stays, in force no longer.
     Deleting it would also be possible, but then nothing records that this
     account ever had a test plan. */
  status: withdraw ? "expired" : "active",
  expiresAt: Date.now() + days * 86_400_000,
  source: "promo",
  note: `staging ${withdraw ? "withdraw" : "grant"} ${new Date().toISOString().slice(0, 10)}`,
};

const r = await fetch(API + "/v1/admin/grant", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer " + token },
  body: JSON.stringify(body),
});
const j = await r.json().catch(() => ({}));
if (!r.ok) { console.error(`${r.status}`, JSON.stringify(j)); process.exit(1); }
const v = j.view || {};
console.log(`${withdraw ? "withdrawn" : "granted"} · ${uid} · ${app}`);
console.log(`  the service now answers: plan ${v.plan}, state ${v.state}, paid ${v.paid}`);
console.log(`  in the app: sign out and in again, or wait for the 12-hour cache (entRefresh runs on every auth change)`);
