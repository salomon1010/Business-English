/* The apply script against a copy of what Bubblewrap 1.25.0 generates.
   Run: node playstore/android-widget/test/apply.test.mjs */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply, patchManifest, patchLauncher, apiFor, APIS } from "../apply.mjs";

const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };

const MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.bemastery.app">

    <application
        android:name="Application"
        android:allowBackup="true">
        <activity android:name="LauncherActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <service android:name=".DelegationService" android:exported="true" />
    </application>
</manifest>
`;
const LAUNCHER = `package com.bemastery.app;

import android.net.Uri;
import android.os.Bundle;

public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();



        return uri;
    }
}
`;

function project(host) {
  const dir = mkdtempSync(join(tmpdir(), "be-twa-"));
  mkdirSync(join(dir, "app", "src", "main", "java", "com", "bemastery", "app"), { recursive: true });
  mkdirSync(join(dir, "app", "src", "main", "res", "values"), { recursive: true });
  writeFileSync(join(dir, "twa-manifest.json"), JSON.stringify({ packageId: "com.bemastery.app", host }));
  writeFileSync(join(dir, "app", "src", "main", "AndroidManifest.xml"), MANIFEST);
  writeFileSync(join(dir, "app", "src", "main", "java", "com", "bemastery", "app", "LauncherActivity.java"), LAUNCHER);
  return dir;
}

console.log("\n# a staging-host project");
{
  const dir = project("staging.lomonec.com");
  const r = apply(dir);
  const m = readFileSync(join(dir, "app/src/main/AndroidManifest.xml"), "utf8");
  const la = readFileSync(join(dir, "app/src/main/java/com/bemastery/app/LauncherActivity.java"), "utf8");
  ok("1 · the widget sources, layouts, drawables and provider info are copied in", ["java/com/bemastery/app/widget/BEWidgetProvider.java", "java/com/bemastery/app/widget/BEWidgetRenderer.java", "res/layout/be_widget_small.xml", "res/layout/be_widget_medium.xml", "res/layout/be_widget_large.xml", "res/layout/be_widget_empty.xml", "res/xml/be_widget_info.xml", "res/drawable/be_widget_pill_pro.xml", "res/values/be_widget.xml", "res/values-v31/be_widget.xml"].every(f => existsSync(join(dir, "app/src/main", f))));
  ok("2 · the debug-only preview screen goes under src/debug, never src/main", existsSync(join(dir, "app/src/debug/AndroidManifest.xml")) && existsSync(join(dir, "app/src/debug/java/com/bemastery/app/widget/BEWidgetPreviewActivity.java")) && !existsSync(join(dir, "app/src/main/java/com/bemastery/app/widget/BEWidgetPreviewActivity.java")));
  ok("3 · the feed address follows the host: staging → be-widget-staging", r.api === APIS.staging && readFileSync(join(dir, "app/src/main/res/values/be_widget_api.xml"), "utf8").includes(APIS.staging));
  ok("4 · the manifest gains INTERNET and the widget receiver with both actions and its provider info, inside <application>", /uses-permission android:name="android.permission.INTERNET"/.test(m) && /<receiver[\s\S]*?\.widget\.BEWidgetProvider[\s\S]*?APPWIDGET_UPDATE[\s\S]*?com\.bemastery\.app\.widget\.REFRESH[\s\S]*?@xml\/be_widget_info[\s\S]*?<\/receiver>\s*<\/application>/.test(m), m);
  ok("5 · LauncherActivity decorates the launch URL with ?wid= and schedules a refresh on start and on return", /return com\.bemastery\.app\.widget\.BEWidgetLaunch\.decorate\(this, uri\);/.test(la) && /protected void onStart\(\)[\s\S]*scheduleRefresh\(this, 25000L\)/.test(la) && /protected void onRestart\(\)[\s\S]*scheduleRefresh\(this, 4000L\)/.test(la) && /^}\s*$/m.test(la), la);
  const m2 = patchManifest(m), la2 = patchLauncher(la);
  ok("6 · running it again changes nothing (idempotent — safe after every bubblewrap update)", m2 === m && la2 === la && (m.match(/BEWidgetProvider/g) || []).length === 1 && (la.match(/protected void onRestart/g) || []).length === 1,
    JSON.stringify({ manifestSame: m2 === m, launcherSame: la2 === la, providerMentions: (m.match(/BEWidgetProvider/g) || []).length, onRestartHooks: (la.match(/protected void onRestart/g) || []).length }));
  rmSync(dir, { recursive: true, force: true });
}
console.log("\n# a production-host project, and refusals");
{
  const dir = project("app.lomonec.com");
  const r = apply(dir);
  ok("7 · production host → the production feed address", r.api === APIS.production && apiFor("app.lomonec.com") === APIS.production);
  let threw = false; try { patchLauncher("public class Other {}\n"); } catch (e) { threw = true; }
  ok("8 · a LauncherActivity that is not Bubblewrap's is refused rather than half-patched", threw);
  rmSync(dir, { recursive: true, force: true });
}
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
