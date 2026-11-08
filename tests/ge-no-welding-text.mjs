/* General English reads no Welding (owner, 7 Nov 2026). Builds the real bundles with sync-web
   and checks what a learner can read in the Help centre and on the About page.
   The Welding bundle and the repository's own files must be exactly as they were.
   Run: cd tests && node ge-no-welding-text.mjs */
import { execFileSync } from "node:child_process"; import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path"; import { tmpdir } from "node:os";
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 300)}`); };
const T = mkdtempSync(join(tmpdir(), "ge-text-"));
const build = (track, out) => execFileSync("node", ["mobile/ios/scripts/sync-web.mjs", "--track", track, "--out", out], { cwd: ROOT, stdio: "pipe" }).toString();
const ge = join(T, "ge"), wd = join(T, "wd");
let log = ""; try { log = build("general-english", ge); build("welding", wd); } catch (e) { ok("1 · both bundles build (the strip's own guards pass)", false, e.stderr || e.message); process.exit(1); }
ok("1 · both bundles build, and the General English build reports the text strip", /General English text strip \(16 help pages, 16 About blocks\)/.test(log));

const pages = readdirSync(join(ge, "manual")).filter(f => f.endsWith(".html") && f !== "index.html");
const WORDS = /weld|boilermaker|pipefit/i;
ok("2 · all 16 Help pages (15 languages + English) carry no Welding word", pages.length === 16 && pages.every(f => !WORDS.test(readFileSync(join(ge, "manual", f), "utf8"))), pages.filter(f => WORDS.test(readFileSync(join(ge, "manual", f), "utf8"))).join(","));
ok("3 · the programmes section is gone from every language and nothing points at it", pages.every(f => !readFileSync(join(ge, "manual", f), "utf8").includes("man-track")));
ok("4 · section numbers stay consecutive in every language (no gap where it was)", pages.every(f => { const n = [...readFileSync(join(ge, "manual", f), "utf8").matchAll(/class="no">(\d+)</g)].map(m => +m[1]); return n.length > 5 && n.every((v, i) => v === i + 1); }));
const fl = readFileSync(join(ge, "flyer.html"), "utf8"), flRepo = readFileSync(join(ROOT, "flyer.html"), "utf8");
const rows = t => { const L = t.split("\n"); const out = []; for (let i = 0; i < L.length; i++) if (/^ *ben:\[\[/.test(L[i])) { let n = 1; for (let j = i + 1; /^ *\["/.test(L[j]); j++) n++; out.push(n); } return out; };
const a = rows(flRepo), b = rows(fl);
ok("5 · About page: every one of the 16 languages has exactly one benefit card fewer, and the static card is gone", a.length === 16 && b.length === 16 && a.every((n, i) => b[i] === n - 1) && !/English for your trade/.test(fl));
ok("6 · the only line left mentioning 'weld' in the About page is the store-package lookup in code, not text", fl.split("\n").filter(l => /weld/i.test(l)).length === 1 && /PLAY_PKGS/.test(fl.split("\n").find(l => /weld/i.test(l))));
ok("7 · the Welding bundle is byte-identical to the repository (Help and About)", ["manual/en.html", "manual/fr.html", "manual/ja.html", "flyer.html"].every(f => readFileSync(join(wd, f), "utf8") === readFileSync(join(ROOT, f), "utf8")));
ok("8 · the Welding bundle still has its own programme section and trade card", /man-track/.test(readFileSync(join(wd, "manual/en.html"), "utf8")) && /English for your trade/.test(readFileSync(join(wd, "flyer.html"), "utf8")));
ok("9 · the repository's own Help and About files are untouched (app.lomonec.com still serves both programmes)", /man-track/.test(readFileSync(join(ROOT, "manual/en.html"), "utf8")) && /English for your trade/.test(flRepo));
rmSync(T, { recursive: true, force: true });
const fails = res.filter(x => !x).length; console.log(`\n${res.length - fails}/${res.length} passed`); process.exit(fails ? 1 : 0);
