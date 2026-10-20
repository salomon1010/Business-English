/* THE OFFLINE SHELL — the service worker has to INSTALL, not just be shipped.
   Run: cd tests && node offline-shell.mjs

   Written 19 October 2026, after both live store apps turned out to have no
   offline shell at all. sw.js precached with `cache.addAll(SHELL)`, which
   rejects the WHOLE batch when a single entry 404s; a single-programme bundle
   (the two store apps, the two standalone web apps) does not carry the other
   programme's catalogue or tracks, so the install always failed, the worker
   never activated, and the app looked perfectly well until the connection went.

     §1 sw.js itself — one entry at a time, versions in step, no dead entries
     §2 the BUILT bundles — SHELL pruned to what each one carries
     §3 the worker really installs and the cache really fills, in a real
        browser, on each built bundle — including the proof that the old code
        fails the same check, and that one hole no longer empties the shell

   Nothing here needs a network. */
import { chromium } from "playwright"; import { spawn, spawnSync } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs"; import { resolve } from "node:path"; import { tmpdir } from "node:os";

const root = new URL("..", import.meta.url).pathname;
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const shellOf = txt => { const m = txt.match(/const SHELL = \[([\s\S]*?)\];/); return m ? m[1].match(/"[^"]+"/g).map(s => s.slice(1, -1)) : null; };
const cacheOf = txt => (txt.match(/const CACHE = "([^"]+)"/) || [])[1];
/* the comment above the install block names addAll on purpose — the checks below
   ask about the CODE, so strip the comments before looking for it */
const codeOf = txt => txt.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("\n# §1 — sw.js itself");
const swTxt = readFileSync(resolve(root, "sw.js"), "utf8");
const shell = shellOf(swTxt);
ok("1 · the install caches one entry at a time and swallows a miss", /SHELL\.map\(u => c\.add\(u\)\.catch\(/.test(swTxt), "the install block changed shape");
ok("2 · cache.addAll is nowhere in the worker's code (it is the bug: one 404 loses the whole shell)", !/addAll/.test(codeOf(swTxt)));
ok("3 · the SHELL list is still readable by sync-web's pruner", Array.isArray(shell) && shell.length > 10, String(shell && shell.length));
ok("4 · sw.js and index.html carry the same version", cacheOf(swTxt) === (readFileSync(resolve(root, "index.html"), "utf8").match(/APP_VERSION="([^"]+)"/) || [])[1], cacheOf(swTxt));
{
  const missing = shell.filter(u => u !== "./" && !existsSync(resolve(root, u.split("?")[0])));
  ok("5 · every SHELL entry names a file that exists (a ?v= bump is a typo away)", !missing.length, missing.join(", "));
}
ok("6 · the reminder and caption caches are still kept out of the activate sweep", /k !== REM_CACHE && k !== CAP_CACHE/.test(swTxt));
/* the shell can only install in the store shells because their scheme is https:
   the registration in index.html is deliberately protocol-gated. */
ok("7 · the Android shell's origin is https, so the app's own registration runs there",
  /"androidScheme":\s*"https"/.test(readFileSync(resolve(root, "mobile/android/capacitor.config.json"), "utf8"))
  && /location\.protocol==="https:"/.test(readFileSync(resolve(root, "index.html"), "utf8")));

console.log("\n# §2 — the built bundles carry a pruned SHELL");
const tmp = mkdtempSync(resolve(tmpdir(), "be-shell-"));
const build = (track, out) => spawnSync("node", [resolve(root, "mobile/ios/scripts/sync-web.mjs"), "--out", resolve(tmp, out), "--track", track, "--platform", "android"], { encoding: "utf8" });
const BUNDLES = [{ dir: "ge", track: "general-english", gone: "tracks/welding/weeks.json" }, { dir: "weld", track: "welding", gone: "tracks/general/missions.json" }];
for (const bnd of BUNDLES) {
  const r = build(bnd.track, bnd.dir);
  ok(`8 · the ${bnd.track} bundle builds`, r.status === 0, (r.stderr || "").slice(0, 300));
  if (r.status !== 0) continue;
  const txt = readFileSync(resolve(tmp, bnd.dir, "sw.js"), "utf8");
  bnd.shell = shellOf(txt); bnd.cache = cacheOf(txt);
  const absent = bnd.shell.filter(u => u !== "./" && !existsSync(resolve(tmp, bnd.dir, u.split("?")[0])));
  ok(`9 · …and its SHELL names only files it carries`, !absent.length, absent.join(", "));
  ok(`10 · …with the other programme's files pruned out`, !bnd.shell.includes(bnd.gone) && bnd.shell.length < shell.length, `${bnd.shell.length} of ${shell.length}`);
  ok(`11 · …and keeps the per-entry install`, /c\.add\(u\)\.catch\(/.test(txt) && !/addAll/.test(codeOf(txt)));
}

console.log("\n# §3 — it installs, and the cache fills (a real browser, on the built bundle)");
const b = await chromium.launch();
let port = +(process.env.PORT || 8243);
/* Returns the cached entries after registering the worker by hand: the page's own
   registration is protocol-gated (§1 check 7) and this server is http://127.0.0.1,
   which is a secure context for the worker but not "https:". */
async function install(dir, { timeout = 20000 } = {}) {
  const p0 = port++;
  const srv = spawn("python3", ["-m", "http.server", String(p0), "--bind", "127.0.0.1"], { cwd: resolve(tmp, dir), stdio: "ignore" });
  await sleep(900);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${p0}/sw-probe.html`);
  const out = await page.evaluate(async ms => {
    const started = Date.now();
    try { await navigator.serviceWorker.register("sw.js"); } catch (e) { return { err: "register: " + e.message }; }
    const ready = await Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), ms))]);
    const names = await caches.keys();
    const name = names.find(n => /^be12-/.test(n));
    let cached = [];
    if (name) cached = (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname.replace(/^\//, "") || "./");
    return { ready, names, name, cached, secs: ((Date.now() - started) / 1000).toFixed(1) };
  }, timeout);
  await ctx.close(); srv.kill();
  return { ...out, errs };
}
/* the probe page is nothing but a document on the bundle's own origin */
for (const bnd of BUNDLES) writeFileSync(resolve(tmp, bnd.dir, "sw-probe.html"), "<!doctype html><title>probe</title>");

for (const bnd of BUNDLES) {
  if (!bnd.shell) continue;
  const r = await install(bnd.dir);
  ok(`12 · the ${bnd.track} app's worker reaches activated`, r.ready === true, JSON.stringify({ err: r.err, names: r.names, secs: r.secs }));
  const want = bnd.shell.map(u => u === "./" ? "./" : u.split("?")[0]);
  const miss = want.filter(u => !r.cached.includes(u));
  ok(`13 · …and the whole shell is in the cache (${r.cached.length} entries)`, r.ready && !miss.length && r.cached.length >= want.length, "not cached: " + miss.slice(0, 6).join(", "));
  ok(`14 · …under this version's cache name`, r.name === bnd.cache, `${r.name} vs ${bnd.cache}`);
  ok(`15 · …with no page error`, !r.errs.length, r.errs.join(" | "));
}
/* The two halves of the fix, each proved on a copy of a real bundle. */
{
  const dir = "ge-hole", src = resolve(tmp, "ge"), dst = resolve(tmp, dir);
  spawnSync("cp", ["-R", src, dst]);
  const sw = resolve(dst, "sw.js"); const txt = readFileSync(sw, "utf8");
  const holed = txt.replace(/const SHELL = \[/, 'const SHELL = ["tracks/welding/weeks.json", ');
  writeFileSync(sw, holed);
  const r = await install(dir);
  ok("16 · one missing file no longer empties the shell: the worker installs and caches the rest",
    r.ready === true && r.cached.length >= shellOf(txt).length, JSON.stringify({ ready: r.ready, n: r.cached.length }));
  /* and the code that shipped in versionCode 19 / 4 fails this very check */
  writeFileSync(sw, holed.replace(/\.then\(c => Promise\.all\(SHELL\.map\(u => c\.add\(u\)\.catch\(\(\) => null\)\)\)\)/,
    ".then(c => c.addAll(SHELL))"));
  const old = await install(dir, { timeout: 9000 });
  ok("17 · …and cache.addAll — the code the live store apps carry — installs nothing at all",
    old.ready === false && !old.cached.length, JSON.stringify({ ready: old.ready, n: old.cached.length }));
}
await b.close();
rmSync(tmp, { recursive: true, force: true });
const pass = res.filter(Boolean).length;
console.log(`\n  ${pass}/${res.length} pass`);
process.exit(pass === res.length ? 0 : 1);
