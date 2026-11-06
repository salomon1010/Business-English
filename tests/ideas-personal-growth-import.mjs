/* Ideas & Personal Growth — import pipeline + flag-gating checks (General English only).
   Pure Node, no browser: there is nothing to render yet (every candidate is still a draft;
   catalogue/general.json carries no "ideas_growth" category), so this tests the import
   script's contract and the flag's default/wiring instead of a live page.
   Run:  node tests/ideas-personal-growth-import.mjs   (from the repo root, or via `cd tests && node ...`) */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const ROOT = new URL("..", import.meta.url).pathname;
const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

/* ---------- 1. the seed file itself ---------- */
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, "catalogue/drafts/ideas-personal-growth-seed.json"), "utf8"));
ok("seed carries exactly 200 videos", seed.videos.length === 200, seed.videos.length);
const ids = seed.videos.map(v => v.video_id);
ok("all 200 video_ids are unique", new Set(ids).size === 200, 200 - new Set(ids).size + " duplicates");
ok("every video_id matches the canonical watch URL (?v=<video_id>)", seed.videos.every(v => v.url === `https://www.youtube.com/watch?v=${v.video_id}`));
ok("every entry is still a draft (publication_ready:false)", seed.videos.every(v => v.publication_ready === false));
ok("no video claims to have been playback-tested or fully viewed in the app yet", seed.videos.every(v => v.playback_tested_in_app === false && v.full_content_viewed === false));
ok("CEFR is null on every entry (no fabricated level)", seed.videos.every(v => v.cefr === null));
ok("track is general_english on every entry", seed.videos.every(v => v.track === "general_english"));
ok("no TED/TEDx/TED-Ed channel in the seed", seed.videos.every(v => !/\bted\b/i.test(v.channel)));

/* ---------- 2. the channel source registry ---------- */
const registrySrc = JSON.parse(fs.readFileSync(path.join(ROOT, "catalogue/ideas-personal-growth-sources.json"), "utf8"));
ok("source registry lists 20 channels", registrySrc.channels.length === 20, registrySrc.channels.length);
const already = registrySrc.channels.filter(c => c.status === "already_in_seed_200");
const candidate = registrySrc.channels.filter(c => c.status === "candidate_new");
ok("4 channels are already represented in the 200-video seed (deduped, not double-counted)", already.length === 4, already.length);
ok("16 channels are candidate-only, with no video-level rows anywhere in this file", candidate.length === 16 && candidate.every(c => !("seed_ids" in c)), candidate.length);
ok("no TED/TEDx/TED-Ed channel in the registry", registrySrc.channels.every(c => !/\bted\b/i.test(c.name)));

/* ---------- 3. import script: dedup, idempotency, conflict quarantine, never touches the live catalogues ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ipg-import-test-"));
fs.mkdirSync(path.join(tmp, "catalogue/drafts"), { recursive: true });
fs.mkdirSync(path.join(tmp, "scripts"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "scripts/import_ideas_personal_growth.mjs"), path.join(tmp, "scripts/import_ideas_personal_growth.mjs"));

// a 3-video mini seed: one clean, one that collides with a "published" GE video, one that collides with Welding
const miniSeed = {
  videos: [
    seed.videos[5], // clean, no collision
    { ...seed.videos[6], video_id: "GEN_EXISTING_1" }, // will collide with general.json
    { ...seed.videos[7], video_id: "WELD_EXISTING_1" }, // will collide with welding.json
  ],
};
fs.writeFileSync(path.join(tmp, "catalogue/drafts/ideas-personal-growth-seed.json"), JSON.stringify(miniSeed));
fs.writeFileSync(path.join(tmp, "catalogue/general.json"), JSON.stringify({ categories: [{ id: "meetings", vids: ["GEN_EXISTING_1"] }], videos: { GEN_EXISTING_1: { title: "already published" } } }));
fs.writeFileSync(path.join(tmp, "catalogue/welding.json"), JSON.stringify({ categories: [], videos: { WELD_EXISTING_1: { title: "owned by welding" } } }));

const generalBefore = fs.readFileSync(path.join(tmp, "catalogue/general.json"), "utf8");
const weldingBefore = fs.readFileSync(path.join(tmp, "catalogue/welding.json"), "utf8");

const run = (args) => spawnSync("node", ["scripts/import_ideas_personal_growth.mjs", ...args], { cwd: tmp, encoding: "utf8" });

const refusesNoEnv = run([]);
ok("refuses to run without --env", refusesNoEnv.status !== 0);
const refusesProd = run(["--env=production"]);
ok("refuses to run against production", refusesProd.status !== 0);

const run1 = run(["--env=development", "--write"]);
ok("first run exits 0", run1.status === 0, run1.stderr);
ok("first run reports 1 inserted (the clean video)", /inserted \(new\):\s*1/.test(run1.stdout), run1.stdout);
ok("first run reports 1 reused (general.json collision)", /reused \(already in general\.json\):\s*1/.test(run1.stdout), run1.stdout);
ok("first run reports 1 conflicted (welding.json collision, quarantined)", /conflicted \(owned by welding\.json\):\s*1/.test(run1.stdout), run1.stdout);

const run2 = run(["--env=development", "--write"]);
ok("second run (idempotency) reports 0 inserted", /inserted \(new\):\s*0/.test(run2.stdout), run2.stdout);
ok("second run reports 1 unchanged, not duplicated", /unchanged \(dupe run\):\s*1/.test(run2.stdout), run2.stdout);

const registryOut = JSON.parse(fs.readFileSync(path.join(tmp, "catalogue/drafts/ideas-personal-growth-registry.json"), "utf8"));
ok("registry holds exactly 1 video (the collisions were never written to the draft store)", Object.keys(registryOut.videos).length === 1, Object.keys(registryOut.videos));
ok("the quarantined/reused ids never leaked into the registry", !registryOut.videos.GEN_EXISTING_1 && !registryOut.videos.WELD_EXISTING_1);

ok("general.json was never modified by the import", fs.readFileSync(path.join(tmp, "catalogue/general.json"), "utf8") === generalBefore);
ok("welding.json was never modified by the import", fs.readFileSync(path.join(tmp, "catalogue/welding.json"), "utf8") === weldingBefore);

// a human-advanced review field must survive a re-import (never regressed back to "pending")
registryOut.videos[miniSeed.videos[0].video_id].editorial_review = "approved";
fs.writeFileSync(path.join(tmp, "catalogue/drafts/ideas-personal-growth-registry.json"), JSON.stringify(registryOut));
run(["--env=development", "--write"]);
const registryAfterReapprove = JSON.parse(fs.readFileSync(path.join(tmp, "catalogue/drafts/ideas-personal-growth-registry.json"), "utf8"));
ok("a human-approved review field is never regressed by a re-import", registryAfterReapprove.videos[miniSeed.videos[0].video_id].editorial_review === "approved");

fs.rmSync(tmp, { recursive: true, force: true });

/* ---------- 4. the flag: off by default in production, previewable on staging only ---------- */
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const defaultsBlock = html.slice(html.indexOf("const FLAGS_DEFAULT="), html.indexOf("const FLAGS_STAGING="));
const stagingBlock = html.slice(html.indexOf("const FLAGS_STAGING="), html.indexOf("const FLAGS_STAGING=") + 4000);
ok("ideas_personal_growth_enabled defaults to false in FLAGS_DEFAULT (production)", /ideas_personal_growth_enabled\s*:\s*false/.test(defaultsBlock), defaultsBlock.match(/ideas_personal_growth_enabled[^,]*/)?.[0]);
ok("ideas_personal_growth_enabled is true in FLAGS_STAGING (preview only)", /ideas_personal_growth_enabled\s*:\s*true/.test(stagingBlock), stagingBlock.match(/ideas_personal_growth_enabled[^,]*/)?.[0]);

/* shLibCatsOrdered: regex-extract the function body and eval it standalone with a stubbed
   flag()/weldStudioOn(), the same technique as testing any other pure helper out of this
   single-file app. Confirms the actual gate, not just the flag's existence. */
const fnMatch = html.match(/function shLibCatsOrdered\(c\)\{[\s\S]*?\n\}/);
ok("shLibCatsOrdered function found in index.html", !!fnMatch);
if (fnMatch) {
  const harness = `
    let FLAG_ON = false;
    function flag(name){ return name==='ideas_personal_growth_enabled' ? FLAG_ON : false; }
    function weldStudioOn(){ return false; }
    ${fnMatch[0]}
    const withCat = { categories: [{id:'meetings'}, {id:'ideas_growth'}] };
    const offResult = shLibCatsOrdered(withCat).map(x=>x.id);
    FLAG_ON = true;
    const onResult = shLibCatsOrdered(withCat).map(x=>x.id);
    module.exports = { offResult, onResult };
  `;
  const tmpFile = path.join(os.tmpdir(), `shlib-gate-${Date.now()}.cjs`);
  fs.writeFileSync(tmpFile, harness);
  const mod = (() => { try { return require(tmpFile); } catch (e) { console.log("harness error:", e.message); return null; } })();
  fs.rmSync(tmpFile, { force: true });
  if (mod) {
    ok("flag OFF: ideas_growth category is filtered out of the chip list", !mod.offResult.includes("ideas_growth"), mod.offResult.join());
    ok("flag ON: ideas_growth category passes through", mod.onResult.includes("ideas_growth"), mod.onResult.join());
  } else {
    ok("flag OFF: ideas_growth category is filtered out of the chip list", false, "harness failed to load");
    ok("flag ON: ideas_growth category passes through", false, "harness failed to load");
  }
}

const fails = res.filter(r => !r.pass);
console.log(`\n${res.length - fails.length}/${res.length} passed`);
if (fails.length) process.exit(1);
