// Add "https://localhost" (the Android shell) to a production Worker's allow-list
// WITHOUT redeploying the repo's newer code: it edits the code the Worker is running
// now (fetched by fetch-deployed.mjs) and uploads it through the content-only
// endpoint, which keeps bindings, vars and secrets as they are.
//   node mobile/android/scripts/patch-deployed-origin.mjs <worker-name> <deployed-dir> [--dry]
// 8 Oct 2026: be-polish / be-push in production are older than the repo (no
// metered verdicts, no APNs) — a full deploy would have released those too.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const [name, dir, dry] = process.argv.slice(2);
const ACCOUNT = "8d3cd584749c92c7076d30688dde2a1d";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
if (files.length !== 1) { console.error("expected exactly one .js module in", dir, files); process.exit(1); }
const main = files[0], src = fs.readFileSync(path.join(dir, main), "utf8");
if (src.includes('"https://localhost"')) { console.log(name, "already allows https://localhost"); process.exit(0); }
let out;
/* be-partner keeps its list in the ALLOWED_ORIGINS var; changing a var means re-sending
   every binding (secrets included), so the code that reads it gets the extra origin instead */
const envLine = 'const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);';
if (src.split(envLine).length === 2) {
  out = src.replace(envLine, envLine.replace(".filter(Boolean);", '.filter(Boolean).concat(["https://localhost"]);   /* the Android shell (mobile/android), 8 Oct 2026 */'));
} else {
  const anchor = /^(\s*)"capacitor:\/\/localhost",[^\n]*\n/m;
  const m = src.match(anchor); if (!m || src.match(new RegExp(anchor.source, "gm")).length !== 1) { console.error(name, "anchor not found exactly once"); process.exit(1); }
  out = src.replace(anchor, `${m[0]}${m[1]}"https://localhost",\n`);
}
if (dry === "--dry") { console.log(out.split("\n").filter(l => /localhost/.test(l)).join("\n")); process.exit(0); }
const cfg = fs.readFileSync(path.join(os.homedir(), "Library/Preferences/.wrangler/config/default.toml"), "utf8");
const token = (/oauth_token\s*=\s*"([^"]+)"/.exec(cfg) || [])[1];
const form = new FormData();
form.append("metadata", new Blob([JSON.stringify({ main_module: main })], { type: "application/json" }));
form.append(main, new Blob([out], { type: "application/javascript+module" }), main);
const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${name}/content`, { method: "PUT", headers: { authorization: "Bearer " + token }, body: form });
const j = await r.json().catch(() => ({}));
console.log(name, r.status, j.success ? "uploaded" : JSON.stringify(j.errors || j).slice(0, 300));
process.exit(j.success ? 0 : 1);
