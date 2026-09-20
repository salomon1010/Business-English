/* Pre-archive checks for the App Store build. Deterministic, read-only, no
   network unless --live. Exit code 1 on any FAIL; WARN never fails.

   node scripts/check-release.mjs          # repo + project checks
   node scripts/check-release.mjs --live   # + the three production Workers accept capacitor://localhost

   What it proves: the web app parses, the 15 translations are complete, the
   Xcode project carries the identity/permissions the review needs, no signing
   material is tracked, the bundled web copy is not stale, and (with --live)
   the backend will answer the native origin. What it cannot prove: that the
   app builds or runs — that needs Xcode and a phone (docs/APPLE_DEPLOYMENT.md). */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const ios = resolve(here, "..");
const root = resolve(ios, "..", "..");
const live = process.argv.includes("--live");
let fails = 0, warns = 0;
const ok = (name, cond, detail = "") => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond || !detail ? "" : " — " + detail}`); if (!cond) fails++; };
const warn = (name, cond, detail = "") => { if (!cond) { warns++; console.log(`  WARN  ${name}${detail ? " — " + detail : ""}`); } else console.log(`  PASS  ${name}`); };
const read = (p) => readFileSync(p, "utf8");
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 12);

console.log("\n== web app (repository root)");
{
  const html = read(join(root, "index.html"));
  const re = /<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g;
  let n = 0, bad = []; let m;
  while ((m = re.exec(html))) { n++; try { new Function(m[1]); } catch (e) { bad.push(e.message); } }
  ok(`index.html: ${n} inline scripts parse`, n >= 4 && bad.length === 0, bad.join(" | "));
  let ld = true; try { JSON.parse(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/.exec(html)[1]); } catch (e) { ld = false; }
  ok("index.html: JSON-LD parses", ld);
  ok("index.html: IS_IOS_APP shell switch present", /const IS_IOS_APP=/.test(html));
  ok("index.html: service worker registered only on https", /"serviceWorker" in navigator&&location\.protocol==="https:"/.test(html));
  const sw = read(join(root, "sw.js")); let swOk = true; try { new Function(sw); } catch (e) { swOk = false; }
  ok(`sw.js parses (${(/be12-v\d+/.exec(sw) || ["?"])[0]})`, swOk);
  const keys = new Set([...html.split("const I18N_EN")[1].split("\n};")[0].matchAll(/"([A-Za-z0-9_.\-]+)"\s*:/g)].map(x => x[1]));
  const langs = readdirSync(join(root, "i18n")).filter(f => f.endsWith(".json"));
  let mism = [];
  for (const f of langs) { let d; try { d = JSON.parse(read(join(root, "i18n", f))); } catch (e) { mism.push(f + " (invalid JSON)"); continue; } const k = new Set(Object.keys(d)); const miss = [...keys].filter(x => !k.has(x)).length, orph = [...k].filter(x => !keys.has(x)).length; if (miss || orph) mism.push(`${f} -${miss}/+${orph}`); }
  ok(`i18n: ${langs.length} files × ${keys.size} keys in parity`, langs.length === 15 && mism.length === 0, mism.join(", "));
  for (const f of ["privacy.html", "delete-account.html", "flyer.html", "manual/en.html"]) ok(`${f} present in the bundle set`, existsSync(join(root, f)));
  ok("flyer.html no longer claims every recording stays on the device", !/every recording stays on your device/.test(read(join(root, "flyer.html"))));
  /* the camera line ("coordinates … never leave your device") is true and stays;
     the two stale sentences were about recordings */
  ok("manual/en.html no longer claims recordings never leave the device", !/recordings never leave/i.test(read(join(root, "manual/en.html"))));
}

console.log("\n== Capacitor project (mobile/ios)");
{
  const cfg = JSON.parse(read(join(ios, "capacitor.config.json")));
  ok("appId com.bemastery.app", cfg.appId === "com.bemastery.app", cfg.appId);
  ok("appName BE Mastery", cfg.appName === "BE Mastery", cfg.appName);
  ok("webDir www, iosScheme capacitor, hostname localhost", cfg.webDir === "www" && cfg.server?.iosScheme === "capacitor" && cfg.server?.hostname === "localhost");
  const pkg = JSON.parse(read(join(ios, "package.json")));
  const lock = existsSync(join(ios, "package-lock.json"));
  ok("package-lock.json committed (deterministic npm ci)", lock);
  const pinned = /exact: "([\d.]+)"/.exec(read(join(ios, "ios", "App", "CapApp-SPM", "Package.swift")));
  const want = String(pkg.dependencies["@capacitor/ios"] || "").replace(/^[\^~]/, "");
  ok(`Package.swift pins capacitor-swift-pm ${pinned && pinned[1]} = @capacitor/ios ${want}`, pinned && pinned[1] === want);
  let installed = null; try { installed = JSON.parse(read(join(ios, "node_modules", "@capacitor", "ios", "package.json"))).version; } catch (e) {}
  warn(`node_modules: @capacitor/ios ${installed || "not installed (run npm ci)"}`, installed === want);
}

console.log("\n== Xcode project");
{
  const pbx = read(join(ios, "ios", "App", "App.xcodeproj", "project.pbxproj"));
  const all = (re) => [...pbx.matchAll(re)].map(m => m[1]);
  const same = (xs) => xs.length >= 2 && new Set(xs).size === 1;
  const bid = all(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g);
  ok("bundle id com.bemastery.app in every configuration", same(bid) && bid[0] === "com.bemastery.app", bid.join(", "));
  const ver = all(/MARKETING_VERSION = ([\d.]+);/g), bld = all(/CURRENT_PROJECT_VERSION = (\d+);/g);
  ok(`version ${ver[0]} build ${bld[0]} consistent across configurations`, same(ver) && same(bld));
  const pkgv = JSON.parse(read(join(ios, "package.json"))).version;
  ok(`package.json version ${pkgv} = MARKETING_VERSION`, pkgv === ver[0]);
  ok("deployment target iOS 15.0", all(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/g).every(v => v === "15.0"));
  ok("iPhone only (TARGETED_DEVICE_FAMILY = 1)", all(/TARGETED_DEVICE_FAMILY = ([^;]+);/g).every(v => v === "1"));
  ok("automatic signing", all(/CODE_SIGN_STYLE = (\w+);/g).every(v => v === "Automatic"));
  const team = all(/DEVELOPMENT_TEAM = ([^;]+);/g);
  warn(`DEVELOPMENT_TEAM ${team.length ? "set" : "not set — pick the Lomonec LLC team in Xcode → Signing & Capabilities once, then commit project.pbxproj"}`, team.length > 0);
  ok("shared scheme App.xcscheme (headless xcodebuild -scheme App)", existsSync(join(ios, "ios", "App", "App.xcodeproj", "xcshareddata", "xcschemes", "App.xcscheme")));
  /* debug.xcconfig (CAPACITOR_DEBUG = true) may only back Debug configurations:
     every baseConfigurationReference must sit in a block whose name is Debug */
  const refs = [...pbx.matchAll(/baseConfigurationReference/g)].map(m => { const rest = pbx.slice(m.index); const nm = /name = (Debug|Release);/.exec(rest); return nm ? nm[1] : "?"; });
  ok(`debug.xcconfig backs Debug only (${refs.length} references: ${refs.join(", ")})`, refs.length > 0 && refs.every(n => n === "Debug"));
}

console.log("\n== Info.plist / privacy manifest");
{
  const plist = read(join(ios, "ios", "App", "App", "Info.plist"));
  const has = (k) => new RegExp(`<key>${k}</key>`).test(plist);
  ok("CFBundleDisplayName BE Mastery", /<key>CFBundleDisplayName<\/key>\s*<string>BE Mastery<\/string>/.test(plist));
  ok("NSMicrophoneUsageDescription", has("NSMicrophoneUsageDescription"));
  ok("NSCameraUsageDescription (Posture Coach)", has("NSCameraUsageDescription"));
  ok("ITSAppUsesNonExemptEncryption = NO", /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/.test(plist));
  ok("portrait only on iPhone", /<key>UISupportedInterfaceOrientations<\/key>\s*<array>\s*<string>UIInterfaceOrientationPortrait<\/string>\s*<\/array>/.test(plist));
  for (const k of ["NSPhotoLibraryUsageDescription", "NSLocationWhenInUseUsageDescription", "NSContactsUsageDescription", "NSBluetoothAlwaysUsageDescription"]) ok(`${k} absent (not used by the app)`, !has(k));
  const pm = read(join(ios, "ios", "App", "App", "PrivacyInfo.xcprivacy"));
  ok("PrivacyInfo: NSPrivacyTracking false, no tracking domains", /<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(pm) && /<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/.test(pm));
  for (const t of ["EmailAddress", "Name", "AudioData", "OtherUserContent", "ProductInteraction"]) ok(`PrivacyInfo declares ${t}`, pm.includes(`NSPrivacyCollectedDataType${t}<`));
}

console.log("\n== assets");
{
  const icon = join(ios, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png");
  ok("AppIcon-512@2x.png present", existsSync(icon));
  if (existsSync(icon)) {
    const b = readFileSync(icon);
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20), colour = b[25];
    ok(`AppIcon 1024×1024 (${w}×${h})`, w === 1024 && h === 1024);
    ok(`AppIcon has no alpha channel (colour type ${colour}, no tRNS)`, (colour === 2 || colour === 0) && !b.includes("tRNS"));
  }
  const shots = join(ios, "appstore", "screenshots", "iphone-6.9");
  const n = existsSync(shots) ? readdirSync(shots).filter(f => f.endsWith(".png")).length : 0;
  ok(`6.9" screenshots present (${n}, App Store Connect wants 3–10)`, n >= 3 && n <= 10);
}

console.log("\n== nothing secret tracked");
{
  let tracked = "";
  try { tracked = execSync("git ls-files mobile/ios", { cwd: root, encoding: "utf8" }); } catch (e) { tracked = ""; }
  const bad = tracked.split("\n").filter(f => /\.(p12|cer|mobileprovision|p8)$|AuthKey_|ExportOptions.*\.plist$|\/www\/|\/public\/|node_modules\//.test(f));
  ok("no signing material, keys, export plist, www/ or public/ in git", bad.length === 0, bad.join(", "));
}

console.log("\n== web bundle freshness");
{
  const www = join(ios, "www", "index.html"), pub = join(ios, "ios", "App", "App", "public", "index.html");
  const src = sha(join(root, "index.html"));
  warn(`www/index.html ${existsSync(www) ? (sha(www) === src ? "matches the repo root" : "is STALE — run npm run sync") : "absent — run npm run sync"}`, existsSync(www) && sha(www) === src);
  warn(`ios/App/App/public/index.html ${existsSync(pub) ? (sha(pub) === src ? "matches the repo root" : "is STALE — run npm run sync") : "absent — run npm run sync"}`, existsSync(pub) && sha(pub) === src);
}

console.log("\n== this Mac");
{
  let xc = ""; try { xc = execSync("xcode-select -p", { encoding: "utf8" }).trim(); } catch (e) {}
  warn(`Xcode: ${/Xcode\.app/.test(xc) ? xc : "NOT AVAILABLE (" + (xc || "no developer dir") + ") — archive/upload need a Mac with Xcode 26+"}`, /Xcode\.app/.test(xc));
  let ids = 0; try { ids = Number((/(\d+) valid identities found/.exec(execSync("security find-identity -v -p codesigning 2>&1", { encoding: "utf8" })) || [0, 0])[1]); } catch (e) {}
  warn(`signing identities in the keychain: ${ids}`, ids > 0);
}

if (live) {
  console.log("\n== production Workers accept capacitor://localhost (--live)");
  const probe = async (url, method = "POST") => {
    const r = await fetch(url, { method: "OPTIONS", headers: { Origin: "capacitor://localhost", "Access-Control-Request-Method": method, "Access-Control-Request-Headers": "authorization,content-type" } });
    return r.headers.get("access-control-allow-origin");
  };
  for (const [name, url] of [["be-polish", "https://be-polish.nore-ngou.workers.dev/"], ["be-events", "https://be-events.nore-ngou.workers.dev/e"], ["be-partner", "https://be-partner.nore-ngou.workers.dev/me"]]) {
    let acao = null; try { acao = await probe(url); } catch (e) {}
    ok(`${name}: Access-Control-Allow-Origin capacitor://localhost`, acao === "capacitor://localhost", String(acao));
  }
  try { const h = await (await fetch("https://be-partner.nore-ngou.workers.dev/health")).json(); ok(`be-partner /health enabled=${h.enabled} (Practice Partner switch)`, typeof h.enabled === "boolean"); } catch (e) { ok("be-partner /health reachable", false, String(e)); }
}

console.log(`\n${fails ? "FAIL" : "PASS"} — ${fails} failure(s), ${warns} warning(s)\n`);
process.exit(fails ? 1 : 0);
