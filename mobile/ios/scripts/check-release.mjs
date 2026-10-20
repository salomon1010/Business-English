/* Pre-archive checks for the App Store build. Deterministic, read-only, no
   network unless --live. Exit code 1 on any FAIL; WARN never fails.

   node scripts/check-release.mjs                        # the General English app
   node scripts/check-release.mjs --programme welding    # the Welding English app
   node scripts/check-release.mjs --live   # + the three production Workers accept capacitor://localhost

   THE TWO-APP SPLIT (12 Oct 2026): one project builds both App Store apps, so
   the identity checks are run FOR a programme. The project's own settings are
   the General English app; ios/App/Welding.xcconfig overrides BE_APP_BUNDLE_ID,
   BE_APP_GROUP, BE_DISPLAY_NAME and BE_PROGRAMME for the other one, and every
   target derives its bundle id from BE_APP_BUNDLE_ID. docs/APP_SPLIT.md.

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
/* which of the two apps is being checked */
const PROGRAMMES = ["general-english", "welding"];
const progArg = (() => { const i = process.argv.indexOf("--programme"); return i > 0 ? process.argv[i + 1] : null; })();
if (progArg !== null && !PROGRAMMES.includes(progArg)) { console.error(`--programme must be one of ${PROGRAMMES.join(" / ")}`); process.exit(2); }
const programme = progArg || "general-english";
const welding = programme === "welding";
/* The identity the build will actually produce: the project defaults, overridden
   by Welding.xcconfig for the Welding app. Read from the files, never hard-coded
   here, so a drift between the two is a FAIL rather than a silent pass. */
const EXPECT = { "general-english": { bid: "com.lomonec.bemastery", group: "group.com.lomonec.bemastery", name: "BE Mastery" },
                 welding: { bid: "com.lomonec.bemastery.welding", group: "group.com.lomonec.bemastery.welding", name: "BE Welding" } }[programme];
EXPECT.appicon = welding ? "AppIconWelding" : "AppIcon";
EXPECT.launch = welding ? "LaunchScreenWelding" : "LaunchScreen";
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
  ok("appId com.lomonec.bemastery", cfg.appId === "com.lomonec.bemastery", cfg.appId);
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
  /* the App target's two configurations carry the store bundle id; the two
     test bundles (BEMasteryTests, BEMasteryUITests) have their own ids under
     the same organisation and are never uploaded */
  const bid = all(/PRODUCT_BUNDLE_IDENTIFIER = "?([^";]+)"?;/g);
  /* THE TWO-APP SPLIT: the shipped targets no longer carry a literal id — they
     derive it from BE_APP_BUNDLE_ID, which is what makes one project two apps.
     An app extension's id must be PREFIXED by the app's (Apple's signing rule),
     and deriving it is exactly what guarantees that. */
  const appBid = bid.filter(b => b === "$(BE_APP_BUNDLE_ID)"), testBid = bid.filter(b => /Tests$/.test(b));
  const extBid = bid.filter(b => b.startsWith("$(BE_APP_BUNDLE_ID)."));
  ok("the App target derives its bundle id from BE_APP_BUNDLE_ID in every configuration", appBid.length >= 2 && same(appBid), bid.join(", "));
  ok("every extension id is prefixed by the app's, as Apple requires (derived, so it cannot drift)",
    extBid.length >= 2 && extBid.every(b => /^\$\(BE_APP_BUNDLE_ID\)\.[A-Za-z]+$/.test(b)), extBid.join(", ") || "none");
  ok("no shipped target carries a hard-coded bundle id", !bid.some(b => /^com\.lomonec\.bemastery/.test(b)), bid.filter(b => /^com\.lomonec\.bemastery/.test(b)).join(", "));
  /* what the chosen programme will actually build */
  const defBid = (pbx.match(/BE_APP_BUNDLE_ID = ([^;]+);/g) || []).map(x => x.replace(/.*= |;/g, ""));
  ok("the project's own BE_APP_BUNDLE_ID is the existing app, in both configurations",
    defBid.length === 2 && same(defBid) && defBid[0] === "com.lomonec.bemastery", defBid.join(", "));
  const xccPath = join(ios, "ios", "App", "Welding.xcconfig");
  ok("ios/App/Welding.xcconfig exists — the Welding app's identity", existsSync(xccPath));
  const xcc = existsSync(xccPath) ? read(xccPath) : "";
  const xset = k => ((xcc.match(new RegExp(`^${k} = (.+)$`, "m")) || [])[1] || "").trim();
  ok(`Welding.xcconfig: ${EXPECT.bid === "com.lomonec.bemastery.welding" ? "the Welding ids" : "the Welding ids (checked even on a General English run)"}`,
    xset("BE_APP_BUNDLE_ID") === "com.lomonec.bemastery.welding" && xset("BE_APP_GROUP") === "group.com.lomonec.bemastery.welding" && xset("BE_PROGRAMME") === "welding",
    `${xset("BE_APP_BUNDLE_ID")} / ${xset("BE_APP_GROUP")} / ${xset("BE_PROGRAMME")}`);
  ok("the two apps' identities do not collide",
    xset("BE_APP_BUNDLE_ID") !== "com.lomonec.bemastery" && xset("BE_APP_GROUP") !== "group.com.lomonec.bemastery");
  ok(`this run checks the ${programme} app: ${EXPECT.bid}`, true);
  ok("test bundles under com.lomonec.* only", testBid.length > 0 && testBid.every(b => b.startsWith("com.lomonec.")), testBid.join(", "));
  const ver = all(/MARKETING_VERSION = ([\d.]+);/g);
  /* CURRENT_PROJECT_VERSION is read per CONFIGURATION BLOCK and only for the
     targets that are UPLOADED — the app and its extensions. Apple rejects an
     archive whose extension build number differs from the app's, which is what
     this guards; the two test bundles are never uploaded and carry their own
     numbering, so counting them reported a mismatch that could not be fixed
     without bumping bundles Apple never sees (11 Oct 2026). Same exclusion the
     bundle-id checks above already make. */
  const shipped = [...pbx.matchAll(/isa = XCBuildConfiguration;([\s\S]*?)\n\t+\};/g)]
    .map(m => m[1])
    .filter(b => /CURRENT_PROJECT_VERSION = \d+;/.test(b))
    .filter(b => { const id = /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/.exec(b); return !id || !/Tests$/.test(id[1]); });
  const bld = shipped.map(b => /CURRENT_PROJECT_VERSION = (\d+);/.exec(b)[1]);
  ok(`version ${ver[0]} build ${bld[0]} consistent across the app and its extensions (${bld.length} configurations; test bundles excluded)`,
    same(ver) && same(bld), `versions ${ver.join(",")} · builds ${bld.join(",")}`);
  const pkgv = JSON.parse(read(join(ios, "package.json"))).version;
  ok(`package.json version ${pkgv} = MARKETING_VERSION`, pkgv === ver[0]);
  /* per build-configuration block: the App target's blocks carry the store
     bundle id, the project-level blocks carry none, and the test bundles carry
     their own ids. The test bundles sit on iOS 17 because the XCTest / Testing
     frameworks in the iOS 27 SDK are built for 17; the APP must stay on 15. */
  const blocks = pbx.split("isa = XCBuildConfiguration;").slice(1).map(b => b.slice(0, b.indexOf("name = ") + 40));
  const appBlocks = blocks.filter(b => !/PRODUCT_BUNDLE_IDENTIFIER = com\.lomonec\.[A-Za-z]*Tests;/.test(b));
  const testBlocks = blocks.filter(b => /PRODUCT_BUNDLE_IDENTIFIER = com\.lomonec\.[A-Za-z]*Tests;/.test(b));
  const pick = (bs, re) => bs.map(b => (re.exec(b) || [])[1]).filter(Boolean);
  const appDt = pick(appBlocks, /IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/), testDt = pick(testBlocks, /IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/);
  ok(`deployment target iOS 15.0 in the App target and the project (${appDt.join(", ")})`, appDt.length >= 2 && appDt.every(v => v === "15.0"));
  ok(`test bundles on iOS 17.0 (XCTest in the iOS 27 SDK needs it; ${testDt.join(", ")})`, testDt.length >= 2 && testDt.every(v => v === "17.0"));
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
  /* THE TWO-APP SPLIT: the name on the home screen comes from the build, so one
     Info.plist serves both apps. BEAppGroup and BEProgramme travel the same way
     and are what the widget and the page read. */
  ok(`CFBundleDisplayName from the build (this programme: "${EXPECT.name}")`,
    /<key>CFBundleDisplayName<\/key>\s*<string>\$\(BE_DISPLAY_NAME\)<\/string>/.test(plist));
  ok("Info.plist carries BEAppGroup and BEProgramme from the build",
    /<key>BEAppGroup<\/key>\s*(?:<!--[\s\S]*?-->\s*)?<string>\$\(BE_APP_GROUP\)<\/string>/.test(plist)
    && /<key>BEProgramme<\/key>\s*(?:<!--[\s\S]*?-->\s*)?<string>\$\(BE_PROGRAMME\)<\/string>/.test(plist));
  ok("NSMicrophoneUsageDescription", has("NSMicrophoneUsageDescription"));
  ok("NSCameraUsageDescription (Posture Coach)", has("NSCameraUsageDescription"));
  /* WKWebView's webkitSpeechRecognition runs on Apple's Speech framework: without
     this key it is still exposed but fails with service-not-allowed (WebKit bug 239816) */
  ok("NSSpeechRecognitionUsageDescription (speech recognition in the web view)", has("NSSpeechRecognitionUsageDescription"));
  const pbx = read(join(ios, "ios", "App", "App.xcodeproj", "project.pbxproj"));
  for (const l of ["en", "fr", "es", "pt", "ar"]) {
    const f = join(ios, "ios", "App", "App", `${l}.lproj`, "InfoPlist.strings"); const s = existsSync(f) ? read(f) : "";
    ok(`${l}.lproj/InfoPlist.strings: microphone, speech recognition and camera, in the project`, ["NSMicrophoneUsageDescription", "NSSpeechRecognitionUsageDescription", "NSCameraUsageDescription"].every(k => s.includes(`"${k}"`)) && pbx.includes(`path = ${l}.lproj/InfoPlist.strings;`));
  }
  ok("ITSAppUsesNonExemptEncryption = NO", /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/.test(plist));
  /* Sign in with Apple (Oct 2026): the capability is an entitlement, and a
     signed build needs the matching App ID capability in the Apple Developer
     portal — docs/auth/SOCIAL_SIGNIN.md.

     BEGoogleIosClientID is now FILLED IN (2 Oct 2026), so the check is no
     longer "the key exists": it is that the value is a real iOS OAuth client
     of this very Firebase project. The project number comes from index.html's
     own FB_CONFIG rather than being written here, so a client minted in the
     wrong Google Cloud project fails before the archive instead of at the end
     of a learner's sign-in. The id is public by design (an iOS OAuth client
     has no secret); the plist is still checked for anything that is not. */
  {
    const gid = (plist.match(/<key>BEGoogleIosClientID<\/key>\s*<string>([^<]*)<\/string>/) || [])[1] || "";
    const gproj = (read(join(root, "index.html")).match(/messagingSenderId:"(\d+)"/) || [])[1] || "";
    ok("BEGoogleIosClientID is a configured iOS OAuth client of this Firebase project (Google sign-in is offered)",
      !!gproj && gid.startsWith(gproj + "-") && /^\d+-[a-z0-9]{16,}\.apps\.googleusercontent\.com$/.test(gid),
      `len=${gid.length} project=${gproj || "?"}`);
    ok("Info.plist carries no secret (the client id is public; a client secret, key or token would not be)",
      !/client_secret|BEGIN PRIVATE KEY|AuthKey_|-----BEGIN/.test(plist));
  }
  {
    const ent = join(ios, "ios", "App", "App", "App.entitlements");
    ok("App.entitlements present", existsSync(ent));
    const e = existsSync(ent) ? read(ent) : "";
    ok("entitlements: Sign in with Apple (Default)", /<key>com\.apple\.developer\.applesignin<\/key>\s*<array>\s*<string>Default<\/string>\s*<\/array>/.test(e));
    /* Push was added 4 Oct 2026 (docs/IOS_NOTIFICATIONS.md). Its value must be
       one of Apple's two environments — an empty or invented string signs, then
       silently swallows every notification. */
    ok("entitlements: push notifications (development here; the App Store export rewrites it to production)",
      /<key>aps-environment<\/key>\s*<string>(development|production)<\/string>/.test(e));
    /* The App Group (5 Oct 2026) is how the home-screen widget reads what the
       app publishes — docs/IOS_WIDGET.md. One group, the project's own id. */
    /* THE TWO-APP SPLIT: the entitlement names the group through $(BE_APP_GROUP),
       so each app signs for its own container and the Welding widget can never
       read the General English app's snapshot. EXPECT.group is what this
       programme resolves to. */
    const GROUP = "$(BE_APP_GROUP)";
    ok("entitlements: the App Group comes from the build, and only that group",
      /<key>com\.apple\.security\.application-groups<\/key>\s*<array>\s*<string>\$\(BE_APP_GROUP\)<\/string>\s*<\/array>/.test(e));
    const allowed = new Set(["com.apple.developer.applesignin", "aps-environment", "com.apple.security.application-groups"]);
    const extra = [...e.matchAll(/<key>([^<]+)<\/key>/g)].map(m => m[1]).filter(k => !allowed.has(k));
    ok(`entitlements: nothing else requested (${extra.length ? extra.join(", ") : "none"})`, extra.length === 0);
    const sign = [...pbx.matchAll(/CODE_SIGN_ENTITLEMENTS = ([^;]+);/g)].map(m => m[1]);
    ok("CODE_SIGN_ENTITLEMENTS: App/App.entitlements in both app configurations, BEWidgetExtension.entitlements in both widget configurations",
      sign.filter(v => v === "App/App.entitlements").length === 2 && sign.filter(v => v === "BEWidgetExtension.entitlements").length === 2 && sign.length === 4, sign.join(", "));
    const went = join(ios, "ios", "App", "BEWidgetExtension.entitlements");
    ok("the widget extension carries the same App Group and nothing else",
      existsSync(went) && read(went).includes("<string>$(BE_APP_GROUP)</string>") && [...read(went).matchAll(/<key>([^<]+)<\/key>/g)].every(m => m[1] === "com.apple.security.application-groups"));
    ok("BEAuthPlugin.swift compiled into the app target", /BEAuthPlugin\.swift in Sources/.test(pbx));
    ok("BEPushPlugin.swift + BEAppDelegate.swift compiled into the app target", /BEPushPlugin\.swift in Sources/.test(pbx) && /BEAppDelegate\.swift in Sources/.test(pbx));
    const vc = read(join(ios, "ios", "App", "App", "Lifecycle", "BEBridgeViewController.swift"));
    ok("BEAuth registered on the Capacitor bridge", /registerPluginInstance\(BEAuthPlugin\(\)\)/.test(vc));
    ok("BEPush registered on the Capacitor bridge", /registerPluginInstance\(BEPushPlugin\(\)\)/.test(vc));
    const app = read(join(ios, "ios", "App", "App", "Lifecycle", "BEMasteryApp.swift"));
    /* Apple hands the device token and the tap to the application delegate and
       nowhere else: without the adaptor the plugin can never get a token. */
    ok("the app delegate is installed, so a device token and a tap have somewhere to arrive",
      /@UIApplicationDelegateAdaptor\(BEAppDelegate\.self\)/.test(app));
    const pushSrc = read(join(ios, "ios", "App", "App", "Plugins", "BEPushPlugin.swift"));
    ok("BEPushPlugin: nothing logged (a device token identifies an install)", !/\bprint\(|NSLog|os_log/.test(pushSrc));
    /* The picture on a notification (5 Oct 2026): only a notification SERVICE
       extension can attach one, and only a real app extension is loaded for
       it — an ExtensionKit extension never is. */
    ok("BEPushService is an app-extension target with the notification service point",
      /BEPushService\.appex in Embed Foundation Extensions/.test(pbx)
      && /"com\.apple\.product-type\.app-extension"/.test(pbx)
      && /com\.apple\.usernotifications\.service/.test(read(join(ios, "ios", "App", "BEPushService", "Info.plist"))));
    const svc = read(join(ios, "ios", "App", "BEPushService", "NotificationService.swift"));
    ok("BEPushService: reads be.image, https only, and never logs the learner's notification",
      /be\["image"\]/.test(svc) && /scheme == "https"/.test(svc) && !/\bprint\(|NSLog|os_log/.test(svc));
    ok("BEPushService runs on the same iOS as the app (15.0), not only on the newest",
      !/BEPushService[\s\S]{0,4000}?IPHONEOS_DEPLOYMENT_TARGET = 2[0-9]\.0;/.test(pbx));
    /* A leftover target from the first attempt: the Generic Extension template
       makes an EXTENSIONKIT extension, which iOS never loads for notifications,
       and an empty one would fail App Store validation. Delete it in Xcode
       (select BENotificationService → right-click → Delete). */
    ok("no leftover BENotificationService target (delete it in Xcode — it is an ExtensionKit stub that cannot serve notifications)",
      !/BENotificationService/.test(pbx));
    /* The home-screen widget (5 Oct 2026, docs/IOS_WIDGET.md): a WidgetKit
       extension fed through the App Group by the BEWidget plugin; a tap opens
       bemastery://open?view=… which only BEWidgetBox.route may interpret. */
    ok("BEWidgetPlugin.swift compiled into the app target and registered on the bridge",
      /BEWidgetPlugin\.swift in Sources/.test(pbx) && /registerPluginInstance\(BEWidgetPlugin\(\)\)/.test(vc));
    ok("BEWidgetExtension is an app-extension target with the WidgetKit extension point",
      /BEWidgetExtension\.appex in Embed Foundation Extensions/.test(pbx)
      && /com\.apple\.widgetkit-extension/.test(read(join(ios, "ios", "App", "BEWidget", "Info.plist"))));
    ok("BEWidgetExtension runs on the same iOS as the app (15.0), iPhone only, iOS only",
      !/BEWidgetExtension[\s\S]{0,4000}?IPHONEOS_DEPLOYMENT_TARGET = 2[0-9]\.0;/.test(pbx)
      && /INFOPLIST_FILE = BEWidget\/Info\.plist;[\s\S]{0,2000}?IPHONEOS_DEPLOYMENT_TARGET = 15\.0;/.test(pbx)
      && /INFOPLIST_FILE = BEWidget\/Info\.plist;[\s\S]{0,2500}?SUPPORTED_PLATFORMS = "iphoneos iphonesimulator";/.test(pbx)
      && /INFOPLIST_FILE = BEWidget\/Info\.plist;[\s\S]{0,2500}?TARGETED_DEVICE_FAMILY = 1;/.test(pbx));
    const wplug = read(join(ios, "ios", "App", "App", "Plugins", "BEWidgetPlugin.swift"));
    const wmodel = read(join(ios, "ios", "App", "BEWidget", "BEWidgetModel.swift"));
    const wview = read(join(ios, "ios", "App", "BEWidget", "BEWidget.swift"));
    const c = (src, name) => (src.match(new RegExp(`static let ${name} = "([^"]+)"`)) || [])[1];
    /* Both sides take the group from Info.plist (BEAppGroup = $(BE_APP_GROUP)) and
       fall back to the same literal, which is the existing app's group — so the
       two halves of a split build agree by construction, and an unsplit build is
       unchanged. */
    const fromPlist = src => /forInfoDictionaryKey: "BEAppGroup"/.test(src) && /: groupDefault$/m.test(src.replace(/\s+$/gm, ""));
    ok("the app writes and the widget read the SAME App Group and key, both from the build",
      fromPlist(wplug) && fromPlist(wmodel) && c(wplug, "groupDefault") === "group.com.lomonec.bemastery" && c(wmodel, "groupDefault") === c(wplug, "groupDefault")
      && !!c(wplug, "key") && c(wplug, "key") === c(wmodel, "key"),
      `${c(wplug, "groupDefault")}/${c(wplug, "key")} vs ${c(wmodel, "groupDefault")}/${c(wmodel, "key")}`);
    { const wb = read(join(ios, "ios", "App", "BEWidget", "BEWidgetBundle.swift"));
      ok("the widget gallery is chosen at compile time, so each app offers only its own programme",
        /#if BE_WELDING/.test(wb) && /#elseif BE_GENERAL/.test(wb) && /#else/.test(wb) && /#endif/.test(wb)); }
    /* the widget EXTENSION never fetches or logs: it draws what the App Group holds. Since
       6 Oct 2026 the APP's plugin fetches the Recommendations widget's pictures — only
       inside BEWidgetThumbCache, only from YouTube's thumbnail hosts, nothing logged. */
    const wrecs = read(join(ios, "ios", "App", "BEWidget", "BEWidgetRecs.swift")), wlock = read(join(ios, "ios", "App", "BEWidget", "BEWidgetLockView.swift"));
    ok("widget sources: the extension logs nothing and fetches nothing (it draws the snapshot and the saved pictures)",
      ![wmodel, wview, wrecs, wlock].some(s => /\bprint\(|NSLog|os_log|URLSession|URLRequest/.test(s)) && !/\bprint\(|NSLog|os_log/.test(wplug));
    { const cache = (wplug.split("enum BEWidgetThumbCache")[1] || ""), outside = wplug.split("enum BEWidgetThumbCache")[0];
      ok("the app's widget plugin fetches only the Recommendations pictures, from YouTube's thumbnail hosts",
        !/URLSession|URLRequest/.test(outside) && /hosts: Set<String> = \["i\.ytimg\.com", "img\.youtube\.com"\]/.test(cache) && /hosts\.contains\(h\)/.test(cache)); }
    ok("Info.plist registers the bemastery:// scheme the widget opens, and the scene routes it through BEWidgetBox",
      /<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>bemastery<\/string>/.test(plist) && /BEWidgetBox\.shared\.deliver\(url: url\)/.test(app));
    ok("widget taps are allow-listed (view, week, weekday, action) before they reach the web layer",
      /static let views: Set<String>/.test(wplug) && /static let days: Set<String>/.test(wplug) && /\(1\.\.\.52\)\.contains/.test(wplug));
    const sw = read(join(ios, "ios", "App", "App", "Plugins", "BEAuthPlugin.swift"));
    ok("BEAuthPlugin: no client secret, nothing logged", !/client_secret/.test(sw) && !/\bprint\(|NSLog|os_log/.test(sw));
    ok("BEAuthPlugin: Apple request is nonce-bound (SHA-256)", /request\.nonce = Self\.sha256\(raw\)/.test(sw));
    ok("BEAuthPlugin: Google uses PKCE (S256) and checks state", /code_challenge_method/.test(sw) && /value\("state"\) == state/.test(sw));
  }
  ok("portrait only on iPhone", /<key>UISupportedInterfaceOrientations<\/key>\s*<array>\s*<string>UIInterfaceOrientationPortrait<\/string>\s*<\/array>/.test(plist));
  for (const k of ["NSPhotoLibraryUsageDescription", "NSLocationWhenInUseUsageDescription", "NSContactsUsageDescription", "NSBluetoothAlwaysUsageDescription"]) ok(`${k} absent (not used by the app)`, !has(k));
  const pm = read(join(ios, "ios", "App", "App", "PrivacyInfo.xcprivacy"));
  ok("PrivacyInfo: NSPrivacyTracking false, no tracking domains", /<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(pm) && /<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/.test(pm));
  for (const t of ["EmailAddress", "Name", "AudioData", "OtherUserContent", "ProductInteraction"]) ok(`PrivacyInfo declares ${t}`, pm.includes(`NSPrivacyCollectedDataType${t}<`));
}

console.log("\n== assets");
{
  /* The two apps have their own icon sets in the one catalog, chosen at build
     time by BE_APPICON_NAME (docs/APP_SPLIT.md § Branding) — so check the one
     THIS programme will actually ship, not whichever is listed first. */
  const iconSet = welding ? "AppIconWelding" : "AppIcon";
  const iconFile = welding ? "AppIconWelding-1024.png" : "AppIcon-512@2x.png";
  const icon = join(ios, "ios", "App", "App", "Assets.xcassets", `${iconSet}.appiconset`, iconFile);
  ok(`${iconFile} present`, existsSync(icon));
  if (existsSync(icon)) {
    const b = readFileSync(icon);
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20), colour = b[25];
    ok(`${iconSet} 1024×1024 (${w}×${h})`, w === 1024 && h === 1024);
    ok(`${iconSet} has no alpha channel (colour type ${colour}, no tRNS)`, (colour === 2 || colour === 0) && !b.includes("tRNS"));
  }
  /* and that the build really will pick it: the project names the General
     English sets, the xcconfig overrides both for Welding. */
  const pbx = read(join(ios, "ios", "App", "App.xcodeproj", "project.pbxproj"));
  const xcc = read(join(ios, "ios", "App", "Welding.xcconfig"));
  ok("the app icon follows the build (ASSETCATALOG_COMPILER_APPICON_NAME = $(BE_APPICON_NAME))",
     /ASSETCATALOG_COMPILER_APPICON_NAME = "\$\(BE_APPICON_NAME\)"/.test(pbx) && /BE_APPICON_NAME = AppIcon;/.test(pbx));
  ok("the launch screen follows the build (UILaunchStoryboardName = $(BE_LAUNCH_STORYBOARD))",
     read(join(ios, "ios", "App", "App", "Info.plist")).includes("$(BE_LAUNCH_STORYBOARD)") && /BE_LAUNCH_STORYBOARD = LaunchScreen;/.test(pbx));
  ok(`this programme's icon and launch screen: ${EXPECT.appicon} / ${EXPECT.launch}`,
     welding ? /BE_APPICON_NAME = AppIconWelding/.test(xcc) && /BE_LAUNCH_STORYBOARD = LaunchScreenWelding/.test(xcc) : true);
  const story = join(ios, "ios", "App", "App", welding ? "LaunchScreenWelding.storyboard" : "Base.lproj/LaunchScreen.storyboard");
  ok(`${EXPECT.launch}.storyboard present and in the Resources phase`,
     existsSync(story) && pbx.includes(`${EXPECT.launch}.storyboard in Resources`));
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
  /* THE TWO-APP SPLIT: a bundled index.html is no longer byte-identical to the
     repo root. sync-web.mjs makes exactly two changes to the page in a
     production bundle, so freshness is checked against what IT would produce
     for THIS programme rather than against the raw root:
       1. it inserts the one-line be-build.js tag that names the programme;
       2. for a programme that has its own logo.svg (BRAND in sync-web.mjs —
          today only Welding) it swaps the inline #beSplash mark,
          <svg class="bs-logo"> … </svg>, for that logo, so a Welding learner
          does not watch the General English tile animate in before the app
          paints.
     Comparing a Welding bundle with the raw root reported STALE for every
     CORRECT bundle: the comparison was wrong, not the bundle (20 Oct 2026).
     General English has no branded logo, so its comparison is byte-for-byte
     what it has always been. The transform below mirrors sync-web.mjs; if the
     page ever changes shape sync-web throws there, and here the substitution
     simply does not happen, so this check fails loudly rather than passing by
     accident. */
  const www = join(ios, "www", "index.html"), pub = join(ios, "ios", "App", "App", "public", "index.html");
  const strip = p => read(p).replace(/\n?<script src="be-build\.js"><\/script>/, "");
  const SPLASH_IMG = '<img class="bs-logo" src="logo.svg" alt="" style="border-radius:22px">';
  const branded = existsSync(join(root, "branding", programme, "logo.svg"));
  const srcTxt = (() => {
    const s = read(join(root, "index.html"));
    if (!branded) return s;
    const open = s.indexOf('<svg class="bs-logo"'), close = open < 0 ? -1 : s.indexOf("</svg>", open);
    return open < 0 || close < 0 ? s : s.slice(0, open) + SPLASH_IMG + s.slice(close + "</svg>".length);
  })();
  const fresh = p => existsSync(p) && strip(p) === srcTxt;
  warn(`www/index.html ${existsSync(www) ? (fresh(www) ? "matches the repo root" : "is STALE — run npm run sync:" + (welding ? "welding" : "general")) : "absent — run npm run sync:" + (welding ? "welding" : "general")}`, fresh(www));
  warn(`ios/App/App/public/index.html ${existsSync(pub) ? (fresh(pub) ? "matches the repo root" : "is STALE — run npm run sync:" + (welding ? "welding" : "general")) : "absent — run npm run sync:" + (welding ? "welding" : "general")}`, fresh(pub));
  const info = join(ios, "ios", "App", "App", "public", "BUNDLE_INFO.txt");
  const bprog = existsSync(info) ? ((read(info).match(/^programme (.+)$/m) || [])[1] || "").trim() : "(no bundle)";
  ok(`the bundled web app is the ${programme} one`, bprog === programme, bprog);
  const bb = join(ios, "ios", "App", "App", "public", "be-build.js");
  ok("be-build.js in the bundle names that programme and nothing of staging",
    existsSync(bb) && read(bb).includes(`"track":"${programme}"`) && !/staging/.test(read(bb)), existsSync(bb) ? read(bb).trim() : "absent");
  /* The swap above is what lets a branded bundle match, so assert the bundle
     really carries its own mark instead of assuming it: a General English
     splash inside the Welding app is the thing this is here to catch. */
  if (branded) ok(`the #beSplash mark is ${programme}'s own logo.svg, not the General English tile`,
    existsSync(pub) && read(pub).includes(SPLASH_IMG) && !read(pub).includes('<svg class="bs-logo"'),
    !existsSync(pub) ? "no bundle" : "the bundle still carries the inline svg.bs-logo");
}

console.log("\n== this Mac");
{
  let xc = ""; try { xc = execSync("xcode-select -p", { encoding: "utf8" }).trim(); } catch (e) {}
  /* xcode-select may still point at the Command Line Tools while Xcode is
     installed — switching it needs sudo. mobile/ios/scripts/build.sh sets
     DEVELOPER_DIR instead, so an installed Xcode.app is what actually matters. */
  const xcApp = existsSync("/Applications/Xcode.app/Contents/Developer");
  warn(`Xcode: ${/Xcode\.app/.test(xc) ? xc : xcApp ? "/Applications/Xcode.app (xcode-select points at " + (xc || "nothing") + "; scripts/build.sh sets DEVELOPER_DIR)" : "NOT AVAILABLE (" + (xc || "no developer dir") + ") — archive/upload need a Mac with Xcode 26+"}`,
    /Xcode\.app/.test(xc) || xcApp);
  let ids = 0; try { ids = Number((/(\d+) valid identities found/.exec(execSync("security find-identity -v -p codesigning 2>&1", { encoding: "utf8" })) || [0, 0])[1]); } catch (e) {}
  warn(`signing identities in the keychain: ${ids}`, ids > 0);
}

/* ---------------------------------------------------------------------------
   Premium must never be a client-side flag alone (12 Oct 2026).

   `planOn()` = billing_enabled && ENT_API. When it is true the app LOCKS
   features, shows an offer and sells a subscription. None of that is worth
   anything — and selling it is a disclosure problem — unless the Worker that
   spends the money also asks be-entitlements, which is `PREMIUM_ENFORCED` in
   backend/wrangler.toml. The two halves are one release: backend/wrangler.toml
   states the order (deploy the Worker first, then ship the bundle), and this
   check is what stops a bundle being archived with only one of them set.

   It reads the repository, not the deployment: it cannot know what is live, so
   it holds the two files to each other and the release notes carry the rest. */
console.log("\n== Premium: client gate and server enforcement move together");
{
  const idx = read(join(root, "index.html"));
  const flags = (/FLAGS_DEFAULT\s*=\s*\{([\s\S]*?)\n\s*\}\s*;/.exec(idx) || [, ""])[1];
  const billing = /billing_enabled\s*:\s*true/.test(flags);
  const entApi = (/const ENT_API\s*=\s*"([^"]*)"/.exec(idx) || [, ""])[1];
  const planOn = billing && !!entApi;

  const bw = join(root, "backend", "wrangler.toml");
  let enforced = null, entUrl = null;
  if (existsSync(bw)) {
    /* only the TOP-LEVEL [vars] block: production. A later [env.staging] table
       sets its own, and staging enforcing proves nothing about production. */
    const top = read(bw).split(/^\s*\[env\./m)[0];
    const m = /^\s*PREMIUM_ENFORCED\s*=\s*"([^"]*)"/m.exec(top);
    enforced = m ? m[1] : null;
    const u = /^\s*ENTITLEMENTS_URL\s*=\s*"([^"]*)"/m.exec(top);
    entUrl = u ? u[1] : null;
  }
  ok(`index.html planOn() would be ${planOn} (billing_enabled ${billing}, ENT_API ${entApi ? "set" : "empty"})`, true);
  ok(`backend/wrangler.toml production PREMIUM_ENFORCED = ${enforced === null ? "unset/commented" : '"' + enforced + '"'}`, true);
  ok("the client gate and the server boundary agree — Premium is not sold on a client flag alone",
    planOn === (enforced === "1"),
    planOn
      ? 'the app would sell and lock Premium while the production Worker enforces nothing: set PREMIUM_ENFORCED = "1" in backend/wrangler.toml AND deploy be-polish before archiving, or turn billing_enabled off'
      : 'the production Worker would demand entitlements the app never sells: a Free learner would be refused with no way to pay. Turn PREMIUM_ENFORCED back to "0", or set billing_enabled + ENT_API');
  if (planOn) ok("…and the enforcing Worker is pointed at an entitlement service", !!entUrl, "ENTITLEMENTS_URL is not set in the production [vars]");
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
