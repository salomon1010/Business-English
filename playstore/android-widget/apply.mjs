#!/usr/bin/env node
/* BE Mastery — put the Android home-screen widget into a Bubblewrap project.
   Usage:  node playstore/android-widget/apply.mjs <generated-project-dir>

   Bubblewrap regenerates its Android project from twa-manifest.json on every
   `update` (and offers to on `build` when the manifest changed), and it says
   so: files added by hand are deleted or overwritten. There is no hook in
   twa-manifest.json for a widget. So the widget lives HERE, in the repo, and
   this script copies it into the generated project after each `update` and
   before `build`. It is idempotent — run it twice and nothing changes twice.

   What it does:
   1. copies src/main (Java, layouts, drawables, the provider info) and
      src/debug (the preview screen, debug builds only) into app/src/
   2. writes res/values/be_widget_api.xml with the be-widget address for the
      project's host (staging → be-widget-staging, else production)
   3. adds INTERNET and the widget <receiver> to AndroidManifest.xml
   4. patches LauncherActivity: ?wid= on every launch URL, a widget refresh
      25 s after a launch and 4 s after the learner comes back from the app
   Full picture: docs/ANDROID_WIDGET.md */
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APIS = {
  staging: "https://be-widget-staging.nore-ngou.workers.dev",
  production: "https://be-widget.nore-ngou.workers.dev",
};

const receiver = (cls, label, info) => `
        <receiver
            android:name=".widget.${cls}"
            android:exported="true"
            android:label="@string/${label}">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <intent-filter>
                <action android:name="com.bemastery.app.widget.REFRESH" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/${info}" />
        </receiver>
`;
/* three gallery entries: follows the open programme / General English / Welding English */
const RECEIVER = `
        <!-- BE Mastery home-screen widgets (playstore/android-widget, docs/ANDROID_WIDGET.md) -->`
  + receiver("BEWidgetProvider", "be_widget_name", "be_widget_info")
  + receiver("BEWidgetProviderGE", "be_widget_name_ge", "be_widget_info_ge")
  + receiver("BEWidgetProviderPro", "be_widget_name_pro", "be_widget_info_pro");

/* the Recommendations widget (owner, 6 Oct 2026): its own receiver, and the
   service that fills its scrolling list (only the system may bind to it) */
const RECS = `
        <!-- BE Mastery Recommendations widget (Premium) -->`
  + receiver("BEWidgetRecsProvider", "be_widget_name_recs", "be_widget_info_recs") + `
        <service
            android:name=".widget.BEWidgetRecsService"
            android:exported="false"
            android:permission="android.permission.BIND_REMOTEVIEWS" />
`;

const HOOKS = `
    /* BE Mastery home-screen widget (playstore/android-widget): the page
       publishes its snapshot shortly after a launch and when it is left, so
       the widget is asked to fetch a little after each. */
    @Override
    protected void onStart() {
        super.onStart();
        com.bemastery.app.widget.BEWidgetProvider.scheduleRefresh(this, 25000L);
    }

    @Override
    protected void onRestart() {
        super.onRestart();
        com.bemastery.app.widget.BEWidgetProvider.scheduleRefresh(this, 4000L);
    }
`;

export function patchManifest(xml) {
  let out = xml;
  if (!/android\.permission\.INTERNET/.test(out)) out = out.replace(/(<manifest\b[^>]*>)/, `$1\n\n    <uses-permission android:name="android.permission.INTERNET" />\n`);
  if (!/\.widget\.BEWidgetProvider"/.test(out)) out = out.replace(/\s*<\/application>/, `\n${RECEIVER}    </application>`);
  if (!/BEWidgetRecsProvider/.test(out)) out = out.replace(/\s*<\/application>/, `\n${RECS}    </application>`);
  return out;
}

export function patchLauncher(java) {
  if (/BEWidgetLaunch\.decorate/.test(java)) return java;
  let out = java.replace(/return uri;(\s*\n\s*})/, "return com.bemastery.app.widget.BEWidgetLaunch.decorate(this, uri);$1");
  if (!/BEWidgetLaunch\.decorate/.test(out)) throw new Error("LauncherActivity.getLaunchingUrl() does not look like Bubblewrap's — refusing to patch");
  out = out.replace(/\n}\s*$/, `\n${HOOKS}}\n`);
  return out;
}

export function apiFor(host) { return host === "staging.lomonec.com" ? APIS.staging : APIS.production; }

export function apply(dir) {
  const here = dirname(fileURLToPath(import.meta.url));
  const manifestPath = join(dir, "app", "src", "main", "AndroidManifest.xml");
  const twa = JSON.parse(readFileSync(join(dir, "twa-manifest.json"), "utf8"));
  if (!existsSync(manifestPath)) throw new Error(`not a Bubblewrap project: ${manifestPath} missing`);
  cpSync(join(here, "src"), join(dir, "app", "src"), { recursive: true });
  const api = apiFor(twa.host);
  mkdirSync(join(dir, "app", "src", "main", "res", "values"), { recursive: true });
  writeFileSync(join(dir, "app", "src", "main", "res", "values", "be_widget_api.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<!-- written by playstore/android-widget/apply.mjs for host ${twa.host} -->\n<resources>\n    <string name="be_widget_api" translatable="false">${api}</string>\n</resources>\n`);
  writeFileSync(manifestPath, patchManifest(readFileSync(manifestPath, "utf8")));
  const pkgDir = join(dir, "app", "src", "main", "java", ...String(twa.packageId).split("."));
  const la = join(pkgDir, "LauncherActivity.java");
  writeFileSync(la, patchLauncher(readFileSync(la, "utf8")));
  return { api, host: twa.host, packageId: twa.packageId };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2];
  if (!dir) { console.error("usage: node playstore/android-widget/apply.mjs <generated-project-dir>"); process.exit(2); }
  const r = apply(dir);
  console.log(`widget applied to ${dir}\n  package ${r.packageId}\n  host    ${r.host}\n  feed    ${r.api}\nNow: npx @bubblewrap/cli@1.25.0 build  (or ./gradlew assembleDebug for a test build)`);
}
