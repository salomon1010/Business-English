// Download the code a production Worker is actually running, to compare with the repo
// before a redeploy (a deploy ships the WHOLE Worker, not one line).
//   node mobile/android/scripts/fetch-deployed.mjs <worker-name> <out-dir>
// Uses wrangler's own OAuth token (~/Library/Preferences/.wrangler/config/default.toml); read-only.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const [name, out] = process.argv.slice(2);
if (!name || !out) { console.error("usage: fetch-deployed.mjs <worker> <out-dir>"); process.exit(2); }
const ACCOUNT = "8d3cd584749c92c7076d30688dde2a1d";
const cfg = fs.readFileSync(path.join(os.homedir(), "Library/Preferences/.wrangler/config/default.toml"), "utf8");
const token = (/oauth_token\s*=\s*"([^"]+)"/.exec(cfg) || [])[1];
if (!token) { console.error("no wrangler oauth token — run `npx wrangler whoami` first"); process.exit(1); }
const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${name}/content/v2`, { headers: { authorization: "Bearer " + token } });
if (!r.ok) { console.error(name, r.status, (await r.text()).slice(0, 300)); process.exit(1); }
const ct = r.headers.get("content-type") || "";
fs.mkdirSync(out, { recursive: true });
if (ct.includes("multipart/form-data")) {
  const form = await new Response(r.body, { headers: { "content-type": ct } }).formData();
  for (const [k, v] of form.entries()) { const f = path.join(out, k.replace(/[\\/]/g, "_")); fs.writeFileSync(f, typeof v === "string" ? v : Buffer.from(await v.arrayBuffer())); console.log("wrote", f); }
} else { const f = path.join(out, "worker.js"); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log("wrote", f); }
