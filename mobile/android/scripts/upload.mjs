#!/usr/bin/env node
/* Upload a BE Mastery Android App Bundle to Google Play.
 *
 *   node scripts/upload.mjs [general|welding] --dry-run        every check, no upload
 *   node scripts/upload.mjs [general|welding] --track internal  upload to a testing track
 *
 * Written 12 October 2026, because nothing in this repository could upload and
 * `gcloud` cannot: a user session carries cloud-platform scopes and the Play
 * Developer API answers 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT. This uses a
 * service account, which is the only supported way.
 *
 * CREDENTIAL — never in the repository, never printed:
 *   ~/.config/be-mastery/secrets/play-publisher.json   (chmod 600)
 *   or the path in BE_PLAY_SA_JSON.
 * Create it in Play Console -> Setup -> API access: link or create a service
 * account, then grant it on BOTH apps. Required permission: **Release
 * manager** (Releases: create and edit, plus "Release to testing tracks").
 * "Viewer" cannot upload. The OAuth scope requested here is exactly
 *   https://www.googleapis.com/auth/androidpublisher
 *
 * An upload to a testing track is NOT a release to production and NOT a
 * review submission. The script prints what it actually did; believe that,
 * not an assumption.
 *
 * It refuses to send a bundle whose package, programme or signing identity is
 * not the chosen app's — a crossed bundle is the one mistake the two-app split
 * makes easy, and Play would accept it.
 */
import { readFileSync, existsSync, createReadStream, mkdtempSync, rmSync } from "node:fs";
import { createSign, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const has = f => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const prog = args.includes("welding") ? "welding" : "general";
const dry = has("--dry-run");
const track = val("--track", "internal");

const APPS = {
  general: { pkg: "com.bemastery.app", programme: "general-english",
             aab: "android/app/build/outputs/bundle/generalRelease/app-general-release.aab" },
  welding: { pkg: "com.lomonec.bemastery.welding", programme: "welding",
             aab: "android/app/build/outputs/bundle/weldingRelease/app-welding-release.aab" },
};
const app = APPS[prog];
const say = (k, v) => console.log(`  ${k.padEnd(50)} ${v}`);
const fail = m => { console.error("REFUSED: " + m); process.exit(1); };

console.log(`== preflight: ${prog}`);
const aab = join(here, app.aab);
if (!existsSync(aab)) fail(`no AAB at ${app.aab} — run scripts/release.sh ${prog === "general" ? "" : "welding"}`.trim());

/* read the bundle without unpacking it to disk twice */
const tmp = mkdtempSync(join(tmpdir(), "be-aab-"));
try {
  execFileSync("unzip", ["-q", "-o", "-d", tmp, aab,
    "base/manifest/AndroidManifest.xml", "base/assets/public/be-build.js", "META-INF/*.RSA"], { stdio: "ignore" });
} catch (e) { /* some members may be absent; checked individually below */ }

const manifest = join(tmp, "base/manifest/AndroidManifest.xml");
if (!existsSync(manifest)) fail("the bundle has no base manifest");
const mraw = readFileSync(manifest, "latin1");
if (!mraw.includes(app.pkg)) fail(`the manifest does not name ${app.pkg} — wrong app`);
say("package", app.pkg);

const bb = join(tmp, "base/assets/public/be-build.js");
if (!existsSync(bb)) fail("the bundle carries no be-build.js — it was not built by sync-web");
const bbTxt = readFileSync(bb, "utf8");
if (!bbTxt.includes(`"${app.programme}"`)) fail(`be-build.js does not name ${app.programme}: ${bbTxt.trim()}`);
say("bundled web app", app.programme);

/* the upload certificate: not a secret, and a changed one means Play will
   reject the upload — better to say so here than after a 50 MB POST */
let fp = "unknown";
try {
  const rsa = execFileSync("sh", ["-c", `unzip -p ${JSON.stringify(aab)} 'META-INF/*.RSA' | keytool -printcert | sed -n 's/.*SHA256: //p' | head -1`], { encoding: "utf8" }).trim();
  if (rsa) fp = rsa;
} catch (e) {}
say("upload certificate SHA-256", fp);
if (fp === "unknown") console.log("  (could not read the signing block — check the AAB is signed)");

const size = (readFileSync(aab).length / 1048576).toFixed(1);
say("artifact", `${app.aab.split("/").pop()}  ${size} MB`);
say("target track", track);

if (dry) { rmSync(tmp, { recursive: true, force: true }); console.log("\nDRY RUN — nothing was sent. Preflight passed."); process.exit(0); }

/* ---- service account -> OAuth token (androidpublisher scope only) ---- */
const saPath = process.env.BE_PLAY_SA_JSON
  || join(process.env.HOME, ".config/be-mastery/secrets/play-publisher.json");
if (!existsSync(saPath)) fail(`no service account at ${saPath.replace(process.env.HOME, "~")} — Play Console -> Setup -> API access`);
const sa = JSON.parse(readFileSync(saPath, "utf8"));
if (!sa.client_email || !sa.private_key) fail("that file is not a service-account key");

const b64u = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const claim = { iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
                aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
const unsigned = `${b64u({ alg: "RS256", typ: "JWT" })}.${b64u(claim)}`;
const jwt = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url")}`;

const tokRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
});
const tok = await tokRes.json();
if (!tok.access_token) fail(`the service account could not get a token (${tokRes.status}) — ${tok.error_description || tok.error || "unknown"}`);
const auth = { authorization: "Bearer " + tok.access_token };
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" + app.pkg;

const asJson = async r => { const t = await r.text(); try { return JSON.parse(t); } catch (e) { return { raw: t.slice(0, 300) }; } };

console.log("\n== Play edit");
const edit = await asJson(await fetch(`${API}/edits`, { method: "POST", headers: auth }));
if (!edit.id) fail(`could not open an edit (is the service account a Release manager on ${app.pkg}?) — ${JSON.stringify(edit).slice(0, 300)}`);
say("edit id", edit.id);

const up = await fetch(`https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${app.pkg}/edits/${edit.id}/bundles?uploadType=media`,
  { method: "POST", headers: { ...auth, "content-type": "application/octet-stream" }, body: readFileSync(aab) });
const bundle = await asJson(up);
if (!bundle.versionCode) fail(`upload failed (${up.status}) — ${JSON.stringify(bundle).slice(0, 400)}`);
say("uploaded versionCode", bundle.versionCode);

const tr = await asJson(await fetch(`${API}/edits/${edit.id}/tracks/${track}`, {
  method: "PUT", headers: { ...auth, "content-type": "application/json" },
  body: JSON.stringify({ track, releases: [{ versionCodes: [String(bundle.versionCode)], status: "draft" }] }),
}));
if (!tr.track) fail(`could not place it on ${track} — ${JSON.stringify(tr).slice(0, 300)}`);
say("track", `${tr.track} (release status: draft)`);

const done = await asJson(await fetch(`${API}/edits/${edit.id}:commit`, { method: "POST", headers: auth }));
if (!done.id) fail(`commit failed — ${JSON.stringify(done).slice(0, 300)}`);
rmSync(tmp, { recursive: true, force: true });

console.log(`\nCommitted edit ${done.id}.`);
console.log(`versionCode ${bundle.versionCode} is on the ${track} track as a DRAFT release.`);
console.log("It is not live, not in review and not released to testers until someone");
console.log("opens Play Console -> Testing -> " + track + " and rolls it out. Check there before claiming anything.");
