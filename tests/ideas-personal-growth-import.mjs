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
    let GE = true;
    function isGeneralEnglish(){ return GE; }
    ${fnMatch[0]}
    const withCat = { categories: [{id:'meetings'}, {id:'ideas_growth'}] };
    const offResult = shLibCatsOrdered(withCat).map(x=>x.id);
    FLAG_ON = true;
    const onResult = shLibCatsOrdered(withCat).map(x=>x.id);
    GE = false;
    const weldingResult = shLibCatsOrdered(withCat).map(x=>x.id);
    module.exports = { offResult, onResult, weldingResult };
  `;
  const tmpFile = path.join(os.tmpdir(), `shlib-gate-${Date.now()}.cjs`);
  fs.writeFileSync(tmpFile, harness);
  const mod = (() => { try { return require(tmpFile); } catch (e) { console.log("harness error:", e.message); return null; } })();
  fs.rmSync(tmpFile, { force: true });
  if (mod) {
    ok("flag OFF: ideas_growth category is filtered out of the chip list", !mod.offResult.includes("ideas_growth"), mod.offResult.join());
    ok("flag ON: ideas_growth category passes through", mod.onResult.includes("ideas_growth"), mod.onResult.join());
    ok("flag ON but Welding: ideas_growth is still filtered out (programme gate, not just the flag)", !mod.weldingResult.includes("ideas_growth"), mod.weldingResult.join());
  } else {
    ok("flag OFF: ideas_growth category is filtered out of the chip list", false, "harness failed to load");
    ok("flag ON: ideas_growth category passes through", false, "harness failed to load");
  }
}


/* ---------- 5. review manifest: deterministic, balanced, and never an approval ---------- */
const mkEnv = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "ipg-gate-"));
  fs.mkdirSync(path.join(d, "catalogue/drafts"), { recursive: true });
  fs.mkdirSync(path.join(d, "scripts"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "scripts/import_ideas_personal_growth.mjs"), path.join(d, "scripts/import_ideas_personal_growth.mjs"));
  fs.copyFileSync(path.join(ROOT, "catalogue/drafts/ideas-personal-growth-seed.json"), path.join(d, "catalogue/drafts/ideas-personal-growth-seed.json"));
  fs.writeFileSync(path.join(d, "catalogue/general.json"), JSON.stringify({ categories: [], videos: {} }));
  fs.writeFileSync(path.join(d, "catalogue/welding.json"), JSON.stringify({ categories: [], videos: {} }));
  return d;
};
const runIn = (d, args) => spawnSync("node", ["scripts/import_ideas_personal_growth.mjs", ...args], { cwd: d, encoding: "utf8" });

const envA = mkEnv();
runIn(envA, ["--env=development", "--manifest", "--write"]);
const manA = JSON.parse(fs.readFileSync(path.join(envA, "catalogue/drafts/ideas-personal-growth-review-manifest.json"), "utf8"));
const envB = mkEnv();
runIn(envB, ["--env=development", "--manifest", "--write"]);
const manB = JSON.parse(fs.readFileSync(path.join(envB, "catalogue/drafts/ideas-personal-growth-review-manifest.json"), "utf8"));

ok("manifest selects 20 first-review candidates", manA.candidates.length === 20, manA.candidates.length);
ok("manifest selection is deterministic (same seed, same list, same order)",
  JSON.stringify(manA.candidates.map(c => c.video_id)) === JSON.stringify(manB.candidates.map(c => c.video_id)));
ok("manifest candidates are unique", new Set(manA.candidates.map(c => c.video_id)).size === 20);
ok("manifest is balanced across the four creators (5 each)", (() => {
  const by = {}; manA.candidates.forEach(c => by[c.channel] = (by[c.channel] || 0) + 1);
  return Object.keys(by).length === 4 && Object.values(by).every(n => n === 5);
})(), JSON.stringify(manA.candidates.reduce((a, c) => (a[c.channel] = (a[c.channel] || 0) + 1, a), {})));
ok("every manifest candidate sits inside the 4-16 minute practice window",
  manA.candidates.every(c => c.display_duration_seconds >= 240 && c.display_duration_seconds <= 960),
  manA.candidates.map(c => c.display_duration_seconds).join());
ok("manifest states it is a review order, not a clearance", /not a clearance/i.test(manA.about));
ok("no manifest candidate is marked ready to publish in the registry", (() => {
  const reg = JSON.parse(fs.readFileSync(path.join(envA, "catalogue/drafts/ideas-personal-growth-registry.json"), "utf8"));
  return manA.candidates.every(c => reg.videos[c.video_id] && reg.videos[c.video_id].publication_ready === false);
})());

/* ---------- 6. publication gate fails closed ---------- */
const emitClosed = runIn(envA, ["--env=development", "--emit-category"]);
ok("emit-category refuses (exit 3) while every row is still a draft", emitClosed.status === 3, "exit " + emitClosed.status);
ok("emit-category names the unmet gates instead of guessing", /editorial_review/.test(emitClosed.stderr) && /rights_review/.test(emitClosed.stderr), emitClosed.stderr);
ok("emit-category prints no category block when nothing is publishable", !/"id":\s*"ideas_growth"/.test(emitClosed.stdout));

/* a row that genuinely passes every gate — and nothing else — is the only thing that emits */
const regPath = path.join(envA, "catalogue/drafts/ideas-personal-growth-registry.json");
const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
const approvedId = manA.candidates[0].video_id;
Object.assign(reg.videos[approvedId], {
  status: "approved", editorial_review: "approved", rights_review: "approved",
  embedding_status: "embeddable", playback_tested_in_app: true, full_content_viewed: true,
  publication_ready: true, exact_duration_seconds: 512, cefr: "B2", verified_channel_id: "UC_test_channel",
});
fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
const emitOpen = runIn(envA, ["--env=development", "--emit-category"]);
ok("emit-category emits once a row passes every gate", emitOpen.status === 0 && /"id":\s*"ideas_growth"/.test(emitOpen.stdout), "exit " + emitOpen.status);
ok("emit-category emits ONLY the approved row, not the other 199", (() => {
  /* the block is printed before the write/DRY-RUN footer, so slice it out by braces
     rather than anchoring on end-of-output */
  const o = emitOpen.stdout, i = o.indexOf("{"), j = o.lastIndexOf("}");
  if (i < 0 || j < i) return false;
  const block = JSON.parse(o.slice(i, j + 1));
  return block.category.vids.length === 1 && block.category.vids[0] === approvedId;
})(), emitOpen.stdout.slice(0, 200));
ok("the emitted block is labelled a proposal, never an applied catalogue change", /owner-authorised/i.test(emitOpen.stdout));

/* ---------- 7. a machine validation result survives a plain re-import ---------- */
const reimport = runIn(envA, ["--env=development", "--write"]);
ok("re-import after approval exits 0", reimport.status === 0, reimport.stderr);
const regAfter = JSON.parse(fs.readFileSync(regPath, "utf8"));
ok("exact_duration_seconds is not wiped back to the seed's null by a re-import",
  regAfter.videos[approvedId].exact_duration_seconds === 512, String(regAfter.videos[approvedId].exact_duration_seconds));
ok("a verified channel id survives a re-import", regAfter.videos[approvedId].verified_channel_id === "UC_test_channel");
ok("human approvals survive a re-import", regAfter.videos[approvedId].editorial_review === "approved" && regAfter.videos[approvedId].cefr === "B2");
ok("an untouched row is still a draft after all of this", (() => {
  const other = manA.candidates[1].video_id;
  return regAfter.videos[other].publication_ready === false && regAfter.videos[other].editorial_review === "pending";
})());

ok("the import never created a category in the live catalogue copy",
  JSON.parse(fs.readFileSync(path.join(envA, "catalogue/general.json"), "utf8")).categories.length === 0);
ok("the import never touched the Welding catalogue copy",
  JSON.parse(fs.readFileSync(path.join(envA, "catalogue/welding.json"), "utf8")).videos && Object.keys(JSON.parse(fs.readFileSync(path.join(envA, "catalogue/welding.json"), "utf8")).videos).length === 0);

fs.rmSync(envA, { recursive: true, force: true });
fs.rmSync(envB, { recursive: true, force: true });

/* ---------- 8. the committed artefacts in this repo ---------- */
ok("catalogue/general.json still carries NO ideas_growth category (nothing published)",
  !(JSON.parse(fs.readFileSync(path.join(ROOT, "catalogue/general.json"), "utf8")).categories || []).some(c => c.id === "ideas_growth"));
ok("catalogue/welding.json carries no ideas_growth category either",
  !(JSON.parse(fs.readFileSync(path.join(ROOT, "catalogue/welding.json"), "utf8")).categories || []).some(c => c.id === "ideas_growth"));
const liveReg = JSON.parse(fs.readFileSync(path.join(ROOT, "catalogue/drafts/ideas-personal-growth-registry.json"), "utf8"));
ok("no committed registry row claims to be publication_ready", Object.values(liveReg.videos).every(v => v.publication_ready === false));
ok("no committed registry row claims a CEFR level", Object.values(liveReg.videos).every(v => v.cefr === null));
ok("no committed registry row claims it was playback-tested in the app", Object.values(liveReg.videos).every(v => v.playback_tested_in_app === false));

const fails = res.filter(r => !r.pass);
console.log(`\n${res.length - fails.length}/${res.length} passed`);
if (fails.length) process.exit(1);
