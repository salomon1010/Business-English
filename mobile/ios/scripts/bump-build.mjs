/* Sets the iOS version / build number deterministically — every configuration
   in project.pbxproj and mobile/ios/package.json move together, or nothing moves.

   node scripts/bump-build.mjs                 # build + 1  (1 → 2)
   node scripts/bump-build.mjs --build 7       # build = 7
   node scripts/bump-build.mjs --version 1.2.0 # marketing version = 1.2.0 (build unchanged)
   node scripts/bump-build.mjs --version 1.2.0 --build 1

   App Store Connect rejects an upload whose CFBundleVersion (build) it has
   already seen for that CFBundleShortVersionString (version), so run this
   before every archive. Nothing is committed; review the diff and commit
   project.pbxproj + package.json together. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pbx = resolve(here, "..", "ios", "App", "App.xcodeproj", "project.pbxproj");
const pkg = resolve(here, "..", "package.json");

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const wantVersion = opt("--version"), wantBuild = opt("--build");
if (wantVersion !== undefined && !/^\d+\.\d+\.\d+$/.test(wantVersion)) fail(`--version must be X.Y.Z, got ${wantVersion}`);
if (wantBuild !== undefined && !/^\d+$/.test(wantBuild)) fail(`--build must be an integer, got ${wantBuild}`);

let src = readFileSync(pbx, "utf8");
const builds = [...src.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map(m => m[1]);
const versions = [...src.matchAll(/MARKETING_VERSION = ([\d.]+);/g)].map(m => m[1]);
if (builds.length < 2 || new Set(builds).size !== 1) fail(`CURRENT_PROJECT_VERSION is not consistent across configurations: ${builds.join(", ")}`);
if (versions.length < 2 || new Set(versions).size !== 1) fail(`MARKETING_VERSION is not consistent across configurations: ${versions.join(", ")}`);

const build0 = builds[0], version0 = versions[0];
const build1 = wantBuild !== undefined ? wantBuild : (wantVersion !== undefined ? build0 : String(Number(build0) + 1));
const version1 = wantVersion !== undefined ? wantVersion : version0;
if (build1 === build0 && version1 === version0) fail("nothing to change");

src = src.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${build1};`)
         .replace(/MARKETING_VERSION = [\d.]+;/g, `MARKETING_VERSION = ${version1};`);
writeFileSync(pbx, src);

const p = JSON.parse(readFileSync(pkg, "utf8"));
if (p.version !== version1) { p.version = version1; writeFileSync(pkg, JSON.stringify(p, null, 2) + "\n"); }

console.log(`version ${version0} → ${version1}   build ${build0} → ${build1}   (${builds.length} configurations)`);
console.log("next: commit ios/App/App.xcodeproj/project.pbxproj and package.json, then archive");

function fail(msg) { console.error("bump-build:", msg); process.exit(1); }
