/* ───────────────────────────────────────────────────────────────────────────
   THE TWO STANDALONE WEB APPS  —  docs/WEB-STANDALONE.md

       node scripts/web/build-standalone.mjs --out <dir>            staging
       node scripts/web/build-standalone.mjs --out <dir> --production

   app.lomonec.com/bemastery/ is ONE web app that carries both programmes and
   asks the learner to choose. These are the other shape: one web app per
   programme, pinned the same way the two store apps are pinned, so a learner
   who wants Welding English gets an address that is only Welding English.

   Nothing is written by hand. Each bundle is built by the SAME script the
   store bundles use — mobile/ios/scripts/sync-web.mjs --track <id> — so a web
   app and its store app are the same app from the same source: be-build.js
   pins areaId(), the programme-selection screens are refused, go() turns away
   the other programme's views, and the other programme's CONTENT is removed
   from the bundle rather than hidden.

   Output:
       <out>/index.html            a chooser, for anyone who lands on the root
       <out>/general-english/      General English   (com.bemastery.app)
       <out>/welding-english/      Welding English   (com.lomonec.bemastery.welding)

   The directory is the programme id, so the address says which app it is and
   matches BE_APP_TRACK in the bundle it serves.

   STAGING, unless --production is passed. A staging bundle carries
   be-build.js {env:"staging"}, which points every endpoint at the staging
   Workers (beEnv) and signs in to the be-mastery-test Firebase project, and
   turns billing_enabled on so the three access levels can all be seen. The
   production path is deliberately explicit: it must never be the default of a
   script whose output is a public web root.
   ─────────────────────────────────────────────────────────────────────────── */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const argAfter = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const production = process.argv.includes("--production");
const outArg = argAfter("--out");
if (!outArg) throw new Error("--out <dir> is required (e.g. --out ~/Developer/be-staging-site/snapshots/web-1)");
const out = resolve(process.cwd(), outArg.replace(/^~(?=\/)/, process.env.HOME || "~"));

/* never write into the repository: a bundle is 100+ MB of copies and the
   pruning step deletes files inside its own output */
const rel = resolve(root);
if (out === rel || out.startsWith(rel + "/")) throw new Error("refusing to build inside the repository — choose an --out outside " + rel);

const APPS = [
  { dir: "general-english", track: "general-english", name: "General English",
    blurb: "Meetings, presentations, calls and interviews.", pkg: "com.bemastery.app",
    gone: "catalogue/welding.json" },
  { dir: "welding-english", track: "welding", name: "Welding English",
    blurb: "The workshop, the site, the handover and the interview.", pkg: "com.lomonec.bemastery.welding",
    gone: "catalogue/general.json" },
];

/* one stamp for this build, used for the staging service-worker URL below */
const STAMP = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 13);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const app of APPS) {
  const dest = resolve(out, app.dir);
  const args = [resolve(root, "mobile/ios/scripts/sync-web.mjs"),
    "--out", dest, "--platform", "web", "--track", app.track];
  if (!production) args.push("--staging");
  console.log(`\n── ${app.name} → ${dest}`);
  execFileSync(process.execPath, args, { cwd: root, stdio: "inherit" });

  /* What the bundle MUST be. sync-web asserts the pruning; these are the
     things that make it a standalone WEB app rather than a store bundle. */
  const build = resolve(dest, "be-build.js");
  if (!existsSync(build)) throw new Error(`${app.dir}: be-build.js was not written — the programme is not pinned`);
  const b = JSON.parse(readFileSync(build, "utf8").replace(/^window\.BE_BUILD=/, "").replace(/;\s*$/, ""));
  if (b.track !== app.track) throw new Error(`${app.dir}: be-build.js says track ${b.track}`);
  if (!production && b.env !== "staging") throw new Error(`${app.dir}: a staging build must carry env:"staging"`);
  if (production && b.env) throw new Error(`${app.dir}: a production build must carry no env`);
  if (existsSync(resolve(dest, app.gone))) throw new Error(`${app.dir}: still carries ${app.gone}`);
  let page = readFileSync(resolve(dest, "index.html"), "utf8");
  if (!/<script[^>]+src="be-build\.js"/.test(page)) throw new Error(`${app.dir}: index.html does not load be-build.js`);
  /* STAGING ONLY: give this build's service worker a URL of its own.
     staging.lomonec.com is a cloudflared tunnel, so Cloudflare's edge sits in
     front of it and had cached sw.js for four hours — a rebuilt worker never
     reached the browser and the install kept failing against files the new
     bundle no longer carried. serve-staging.mjs now sends no-store, but an
     object the edge has already cached stays until it expires, so the URL
     carries the build stamp as well: a new build is a new script, and nothing
     the edge holds can answer for it. Production keeps the plain "sw.js" —
     app.lomonec.com has no proxy in front of it and the scope must not depend
     on a build id. */
  if (!production) {
    const reg = 'navigator.serviceWorker.register("sw.js")';
    if (!page.includes(reg)) throw new Error(`${app.dir}: the service-worker registration was not found in index.html`);
    page = page.replace(reg, `navigator.serviceWorker.register("sw.js?b=${STAMP}")`);
    writeFileSync(resolve(dest, "index.html"), page);
  }
  if (!existsSync(resolve(dest, "sw.js"))) throw new Error(`${app.dir}: sw.js missing — the web app must work offline`);
  const mf = JSON.parse(readFileSync(resolve(dest, "manifest.json"), "utf8"));
  const ids = (mf.related_applications || []).map((r) => r.id);
  if (ids.length !== 1 || ids[0] !== app.pkg)
    throw new Error(`${app.dir}: manifest related_applications is ${JSON.stringify(ids)}, expected only ${app.pkg}`);
}

/* The chooser. Plain, self-contained, no script: whoever lands on the root of
   this host is choosing between two apps, not learning yet. */
const card = (a) => `      <a class="app" href="./${a.dir}/">
        <img src="./${a.dir}/logo.svg" alt="" width="54" height="54">
        <span><b>${a.name}</b><small>${a.blurb}</small></span>
      </a>`;
writeFileSync(resolve(out, "index.html"), `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BE Mastery — choose your programme</title>
<meta name="robots" content="noindex">
<style>
:root{color-scheme:dark light;--bg:#0a0e1a;--card:#121a2e;--line:#23304d;--txt:#eef2fb;--muted:#9fb0cc;--accent:#6d5dfc}
@media(prefers-color-scheme:light){:root{--bg:#f6f7fb;--card:#fff;--line:#e3e7f0;--txt:#161a26;--muted:#5d6577}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;
  display:flex;align-items:center;justify-content:center;min-height:100vh;padding:28px 16px}
.wrap{width:100%;max-width:560px}
h1{font-size:26px;line-height:1.2;margin:0 0 6px}
p.sub{color:var(--muted);margin:0 0 22px}
.apps{display:grid;gap:14px}
.app{display:flex;gap:14px;align-items:center;text-decoration:none;color:inherit;background:var(--card);
  border:1px solid var(--line);border-radius:18px;padding:18px;min-height:76px}
.app:hover{border-color:var(--accent)}
.app img{border-radius:14px;flex:0 0 auto}
.app b{display:block;font-size:17px}
.app small{color:var(--muted);font-size:14px}
footer{color:var(--muted);font-size:13px;margin-top:22px}
footer a{color:inherit}
</style></head>
<body><div class="wrap">
  <h1>BE Mastery</h1>
  <p class="sub">Two programmes, two apps. Choose the one you are learning for — each keeps its own progress.</p>
  <div class="apps">
${APPS.map(card).join("\n")}
  </div>
  <footer>${production ? "" : "Staging build — not the production site. "}© Lomonec LLC ·
    <a href="./general-english/privacy.html">Privacy</a></footer>
</div></body></html>
`);

console.log(`\n✓ two standalone web apps in ${out}`);
console.log(`  ${production ? "PRODUCTION" : "STAGING"} build · ${APPS.map(a => "/" + a.dir + "/").join(" and ")} · chooser at /`);
