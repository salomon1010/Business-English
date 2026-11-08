/* Learner-profile (S.lp) sync against the REAL staging Firestore (Onboarding V2, Phase A).
   Real Firebase JS SDK 10.12.5, real transactions, real security rules, real Auth, in a browser,
   with several "devices" signed in as one DISPOSABLE test user:
     - NEW   : this tree, staging bundle, General English, flag ON
     - OLD   : the committed HEAD index.html (no lp code) with the staging config swapped in
     - WELD  : this tree, staging bundle pinned to the Welding programme, flag forced ON (adversarial)
   It never touches production: it refuses to run unless the bundle's Firebase project is
   be-mastery-test, creates only users it can delete (reserved .invalid addresses) and removes
   only the documents and users it created.
   Run: cd tests && STAGING_LP_TEST=1 node learner-profile-staging.mjs      (not in `npm test`) */
import { chromium } from "playwright";
import { spawn, execSync, execFileSync } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { mkdtempSync, symlinkSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs"; import { join, resolve } from "node:path"; import { tmpdir } from "node:os";

if (process.env.STAGING_LP_TEST !== "1") { console.log("Set STAGING_LP_TEST=1 to run against the staging Firebase project (be-mastery-test)."); process.exit(0); }
setTimeout(() => { console.log("WATCHDOG: exceeded 600 s"); process.exit(2); }, 600000).unref?.();
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const CFG = JSON.parse(readFileSync(join(ROOT, "mobile/ios/staging-firebase.json"), "utf8"));
if (CFG.projectId !== "be-mastery-test") { console.log("REFUSING: staging config is not be-mastery-test"); process.exit(3); }
const PROJECT = CFG.projectId, KEY = CFG.apiKey;
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 500)}`); };

/* ---------- bundles ---------- */
const T = mkdtempSync(join(tmpdir(), "be-stg-"));
const build = (track, dir) => execFileSync("node", ["mobile/ios/scripts/sync-web.mjs", "--staging", "--track", track, "--out", dir], { cwd: ROOT, stdio: "pipe" });
const NEWD = join(T, "new"), WELD = join(T, "weld"), OLDD = join(T, "old");
build("general-english", NEWD); build("welding", WELD);
for (const d of [NEWD, WELD]) { const p = readFileSync(join(d, "index.html"), "utf8"); if (!/projectId":"be-mastery-test"/.test(p) || /"be-mastery"[,}]/.test((/window\.FB_CONFIG=\{[^}]*\}/.exec(p) || [""])[0])) { console.log("REFUSING: a bundle does not point at be-mastery-test"); process.exit(3); } }
/* OLD = committed HEAD index.html + the same staging config + the staging be-build tag */
{
  rmSync(OLDD, { recursive: true, force: true }); execSync(`mkdir -p ${OLDD}`);
  for (const n of readdirSync(NEWD)) if (!["index.html", "be-build.js"].includes(n)) symlinkSync(join(NEWD, n), join(OLDD, n));
  let h = execSync("git show HEAD:index.html", { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
  const re = /window\.FB_CONFIG=\{[\s\S]*?\};/; if ((h.match(new RegExp(re.source, "g")) || []).length !== 1) { console.log("FB_CONFIG block not found once in HEAD"); process.exit(3); }
  h = h.replace(re, "window.FB_CONFIG=" + JSON.stringify({ ...CFG, _note: undefined }) + ";");
  h = h.replace("<head>", '<head>\n<script src="be-build.js"></script>');
  writeFileSync(join(OLDD, "index.html"), h); writeFileSync(join(OLDD, "be-build.js"), readFileSync(join(NEWD, "be-build.js")));
  if (!/be-mastery-test/.test(h)) { console.log("REFUSING: old client not on staging"); process.exit(3); }
}
const PORTS = { new: 8941, weld: 8942, old: 8943 };
const servers = [[NEWD, PORTS.new], [WELD, PORTS.weld], [OLDD, PORTS.old]].map(([d, p]) => spawn("python3", ["-m", "http.server", String(p), "--bind", "127.0.0.1"], { cwd: d, stdio: "ignore" }));
await sleep(1200);

/* ---------- REST helpers (identity toolkit + firestore), used for setup, verification and cleanup ---------- */
/* transient network errors are retried; a real HTTP answer (403, 404 ...) is returned as is */
async function rfetch(url, opts, tries = 4) { let last; for (let i = 0; i < tries; i++) { try { const r = await fetch(url, opts); if (r.status < 500) return r; last = new Error("HTTP " + r.status); } catch (e) { last = e; } await sleep(700 * (i + 1)); } throw last; }
const created = [];   // {email, uid, idToken}
async function signUp(tag) {
  const email = `lp-test-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.invalid`, password = "T" + Math.random().toString(36).slice(2) + "!9a";
  const r = await rfetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const j = await r.json(); if (!j.localId) throw new Error("signUp failed: " + JSON.stringify(j).slice(0, 200));
  const u = { email, password, uid: j.localId, idToken: j.idToken }; created.push(u); return u;
}
async function freshToken(u) { const r = await rfetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password, returnSecureToken: true }) }); const j = await r.json(); u.idToken = j.idToken; return j.idToken; }
const dec = v => "stringValue" in v ? v.stringValue : "integerValue" in v ? Number(v.integerValue) : "doubleValue" in v ? v.doubleValue : "booleanValue" in v ? v.booleanValue : "nullValue" in v ? null : "mapValue" in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)])) : "arrayValue" in v ? (v.arrayValue.values || []).map(dec) : "timestampValue" in v ? v.timestampValue : v;
const DOC = uid => `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`;
async function getDoc(u, asToken) { const r = await rfetch(DOC(u.uid), { headers: asToken === null ? {} : { authorization: "Bearer " + (asToken || await freshToken(u)) } }); if (r.status === 404) return { status: 404 }; const j = await r.json(); if (r.status !== 200) return { status: r.status, error: j.error && j.error.message }; return { status: 200, data: Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, dec(v)])), bytes: JSON.stringify(j).length }; }
const canon = x => Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canon(x[k])])) : x;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const lpOf = async u => ((await getDoc(u)).data || {}).lp;
const jsonOf = async u => { const d = (await getDoc(u)).data; try { return JSON.parse((d || {}).json || "null"); } catch (e) { return null; } };
async function cleanup() {
  for (const u of created) {
    try { const t = await freshToken(u); await rfetch(DOC(u.uid), { method: "DELETE", headers: { authorization: "Bearer " + t } }); await rfetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: t }) }); } catch (e) { console.log("cleanup warning:", e.message); }
  }
}

/* ---------- devices ---------- */
const b = await chromium.launch();
const seed = track => ({ profile: { name: "Pat", role: "Student", goal: "", slot: "", selfLevel: "", lang: "en", ts: 1 }, professionalTracks: { activeId: track }, fnd: { [track]: { placed: "full", finished: true, day: 1, done: {} } }, areaSplit: true, days: {}, dates: [], dayLog: {}, steps: {}, vocab: {} });
const clients = [];
async function device(kind, state = null) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const track = kind === "weld" ? "welding" : "general-english";
  await ctx.addInitScript(([s, f, k]) => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", f); localStorage.setItem("be12_trust_account", "1"); } }, [JSON.stringify(state || seed(track)), JSON.stringify({ onboarding_v2_enabled: true }), kind]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORTS[kind]}/index.html`);
  await sleep(1200); const loaded = await p.evaluate(() => fbLoad()); if (!loaded) throw new Error("the Firebase SDK did not load in the " + kind + " client");
  const c = { ctx, p, errs, kind }; clients.push(c); return c;
}
const signIn = async (c, u) => { await c.p.evaluate(([e, pw]) => FBauth.signInWithEmailAndPassword(e, pw), [u.email, u.password]); await sleep(2500); };
const sync = async c => { await c.p.evaluate(() => { fbLastPull = 0; return fbSyncPull(); }); await sleep(900); };
const push = async c => { await c.p.evaluate(() => fbPush(0)); await sleep(2500); };
const flush = async c => { await c.p.evaluate(() => lpFlush()); await sleep(900); };
const view = c => c.p.evaluate(() => LearnerProfile.view(S));
const jsErr = e => e.filter(x => !/MIME type|net::ERR|Failed to load resource/.test(x));

let exitCode = 0;
try {
  const U = await signUp("a");
  console.log(`\n# staging project ${PROJECT}; disposable user ${U.email}`);
  const A = await device("new"), B = await device("new");
  const ver = await A.p.evaluate(() => ({ project: FB_CONFIG.projectId, sdk: firebase.SDK_VERSION, lpOn: lpOn() }));
  ok("0 · the page runs the real Firebase SDK against be-mastery-test, never production", ver.project === "be-mastery-test" && /^10\./.test(ver.sdk) && ver.lpOn, JSON.stringify(ver));

  console.log("\n# 1. first sync and learner-profile writes (real transactions)");
  await signIn(A, U);
  ok("1 · signing in creates the account document with the app state", (await getDoc(U)).status === 200 && !!(await jsonOf(U)));
  const before0 = await getDoc(U);
  ok("2 · a legacy learner who has not edited anything leaves NO `lp` field in the cloud", before0.data.lp === undefined);
  await A.p.evaluate(() => { lpSet("role", { roleId: "other.other", roleCat: "other", roleOther: "Radiographer" }); lpSet("situations", { situations: ["interviews", "meetings"], primarySituation: "interviews" }); lpSet("goal", { goalId: "ace_interviews" }); });
  await flush(A);
  const lp1 = await lpOf(U);
  ok("3 · the groups are written as separate map entries via real transactions (role, situations, goal)", lp1 && lp1.g.role.v.roleOther === "Radiographer" && lp1.g.situations.v.primarySituation === "interviews" && lp1.g.goal.v.goalId === "ace_interviews", JSON.stringify(lp1));
  ok("4 · nothing of the learner profile went into the `json` payload", !("lp" in ((await jsonOf(U)) || {})) && !/Radiographer/.test(JSON.stringify((await jsonOf(U)) || {})));

  console.log("\n# 2. older client and Welding app cannot erase it (real merge:true writers)");
  const OLD = await device("old");
  await signIn(OLD, U); await sync(OLD);
  await OLD.p.evaluate(() => { S.profile.name = "Changed by old client"; save(); });
  await push(OLD); await OLD.p.evaluate(() => { S.dates = ["2026-11-07"]; save(); fbPush(0); }); await sleep(2500);
  const afterOld = await getDoc(U);
  const nameNow = ((await jsonOf(U)) || {}).profile; ok("5 · after an OLDER client signs in, pulls, edits and pushes twice, `lp` is identical", same(afterOld.data.lp.g, lp1.g), "lp1=" + JSON.stringify(canon(lp1.g)) + " NOW=" + JSON.stringify(canon(afterOld.data.lp.g))); ok("5b · and the older client's own edit reached the cloud json (it really did write)", nameNow && nameNow.name === "Changed by old client", JSON.stringify(nameNow));
  const W = await device("weld", seed("welding"));
  const wInfo = await W.p.evaluate(() => ({ track: BE_APP_TRACK, lpOn: lpOn() }));
  await signIn(W, U); await sync(W);
  await W.p.evaluate(() => { S.profile.name = "Welder device"; save(); lpSet("role", { roleId: "trades.welder" }); lpFlushSoon(0); fbPush(0); }); await sleep(3500);
  ok("6 · the Welding app (flag forced ON) is not General English: lpOn() false, no S.lp, nothing written", wInfo.track === "welding" && !wInfo.lpOn && (await W.p.evaluate(() => S.lp === undefined)));
  { const n = (await lpOf(U)).g; ok("7 · after the Welding app signs in, pulls, edits and pushes, `lp` in the real cloud document is identical", same(n, lp1.g), JSON.stringify(canon(n))); }
  const stale = await device("old", seed("general-english"));
  await signIn(stale, U);
  await stale.p.evaluate(() => { S = JSON.parse(JSON.stringify(S)); S.vocab = { stale: 1 }; save(); fbPush(0); }); await sleep(2500);
  { const n = (await lpOf(U)).g; ok("8 · a stale older client's blind push leaves `lp` identical", same(n, lp1.g), JSON.stringify(canon(n))); }

  console.log("\n# 3. two new devices: pull, concurrency, offline, deletion");
  await signIn(B, U); await sync(B);
  const vB = await view(B);
  ok("9 · a second new device receives all three groups from the real cloud after sign-in", vB.roleOther === "Radiographer" && vB.primarySituation === "interviews" && vB.goalId === "ace_interviews", JSON.stringify(vB));
  /* simultaneous writes to ONE group: real Firestore transactions must serialise them */
  await Promise.all([A.p.evaluate(() => { lpSet("schedule", { dailyMinutes: "m10" }); return lpFlush(); }), B.p.evaluate(() => { lpSet("schedule", { dailyMinutes: "m25" }); return lpFlush(); })]);
  await sleep(1500);
  for (let i = 0; i < 6; i++) { await sync(A); await sync(B); const c0 = (await lpOf(U)).g.schedule.v.dailyMinutes; if ((await view(A)).dailyMinutes === c0 && (await view(B)).dailyMinutes === c0) break; await sleep(1500); }   // eventual convergence, polled
  const cs = (await lpOf(U)).g.schedule.v.dailyMinutes, as = (await view(A)).dailyMinutes, bs = (await view(B)).dailyMinutes;
  { const st = x => x.p.evaluate(() => ({ s: S.lp.g.schedule, d: Object.keys(S.lp.dirty) })); ok("10 · simultaneous writes to the same group end with ONE winner everywhere (cloud, A, B)", cs === as && as === bs, [cs, as, bs].join("/") + " cloud=" + JSON.stringify((await lpOf(U)).g.schedule) + " A=" + JSON.stringify(await st(A)) + " B=" + JSON.stringify(await st(B))); }
  /* offline edit: real network cut */
  await B.ctx.setOffline(true);
  await B.p.evaluate(() => { lpSet("methods", { methods: ["shadowing", "ai_coach"] }); return lpFlush(); }); await sleep(2500);
  const offDirty = await B.p.evaluate(() => LearnerProfile.dirtyGroups(S));
  ok("11 · an offline edit stays local and dirty and nothing throws (real network cut)", offDirty.includes("methods") && !(await lpOf(U)).g.methods);
  await A.p.evaluate(() => { lpSet("goal", { goalId: "career_growth" }); return lpFlush(); }); await sleep(800);
  await B.ctx.setOffline(false); await sleep(1500);
  await sync(B); await flush(B); await sync(A);
  const cl = (await lpOf(U)).g;
  ok("12 · after reconnecting: B's offline edit AND A's newer goal edit are both in the cloud and on both devices", cl.methods && cl.methods.v.methods.join() === "shadowing,ai_coach" && cl.goal.v.goalId === "career_growth" && (await view(A)).methods && (await view(B)).goalId === "career_growth", JSON.stringify(cl));
  /* deletion vs stale device */
  await A.p.evaluate(() => { lpSet("priorities", { priorities: ["fluency"] }); return lpFlush(); }); await sync(B);
  await A.p.evaluate(() => { lpClear("priorities"); return lpFlush(); }); await sleep(800);
  await B.p.evaluate(() => { S.lp.g.priorities = { v: { priorities: ["fluency"] }, t: 5, s: LearnerProfile.sig({ priorities: ["fluency"] }) }; S.lp.dirty.priorities = 1; });
  await flush(B); await sync(B);
  ok("13 · a stale device cannot resurrect a deleted group in real Firestore (tombstone kept)", (await lpOf(U)).g.priorities.v === null && (await view(B)).priorities === undefined);
  { await A.p.evaluate(() => { lpSet("role", { roleId: "health.nurse", roleCat: "health" }); return lpFlush(); }); await sleep(1500); const r = (await lpOf(U)).g.role; ok("14 · a changed group REPLACES the cloud value: no field survives from the previous value", same(r.v, { roleId: "health.nurse", roleCat: "health" }), JSON.stringify(canon(r)) + " | A local=" + JSON.stringify(await A.p.evaluate(() => ({ r: S.lp.g.role, dirty: Object.keys(S.lp.dirty) })))); }

  console.log("\n# 4. sign-in adoption, sign-out, failure recovery");
  const N = await device("new");
  await N.p.evaluate(() => { const f = FBUser; lpSet("situations", { situations: ["calls"] }); });   // an edit made BEFORE signing in (no account)
  ok("15 · an edit made before sign-in is kept locally and dirty", (await N.p.evaluate(() => LearnerProfile.dirtyGroups(S))).includes("situations"));
  await signIn(N, U); await sleep(2000);
  const cs2 = (await lpOf(U)).g.situations;
  ok("16 · signing in adopts the account copy, merges by last edit, and the cloud keeps the newest situations", cs2 && (cs2.v.situations || []).length > 0 && (await view(N)).goalId === "career_growth", JSON.stringify(cs2));
  await N.p.evaluate(() => fbWipeDevice());
  ok("17 · sign-out wipes the device copy", await N.p.evaluate(() => !S.lp || !Object.keys(S.lp.g || {}).length));
  ok("18 · and leaves the cloud copy untouched", (await lpOf(U)).g.goal.v.goalId === "career_growth");
  /* failure recovery: block Firestore writes, edit, unblock */
  await A.ctx.route(/firestore\.googleapis\.com/, r => r.abort());
  await A.p.evaluate(() => { lpSet("confidence", { selfLevel: "Can get by" }); return lpFlush(); }); await sleep(3000);
  const failedDirty = await A.p.evaluate(() => LearnerProfile.dirtyGroups(S).includes("confidence"));
  await A.ctx.unroute(/firestore\.googleapis\.com/); await sleep(1500);
  await A.p.evaluate(() => lpFlush()); await sleep(4000);
  ok("19 · a write that fails (network blocked) stays dirty without a crash, and the next flush recovers it", failedDirty && (await lpOf(U)).g.confidence && (await lpOf(U)).g.confidence.v.selfLevel === "Can get by", JSON.stringify((await lpOf(U)).g.confidence));

  console.log("\n# 5. permissions and size");
  const U2 = await signUp("b"); const t2 = await freshToken(U2);
  const cross = await rfetch(DOC(U.uid), { headers: { authorization: "Bearer " + t2 } });
  const anon = await rfetch(DOC(U.uid));
  ok("20 · another signed-in user cannot read this document (403)", cross.status === 403, cross.status);
  ok("21 · an unauthenticated caller cannot read it (403/401)", [401, 403].includes(anon.status), anon.status);
  const crossW = await rfetch(DOC(U.uid) + "?updateMask.fieldPaths=lp", { method: "PATCH", headers: { authorization: "Bearer " + t2, "content-type": "application/json" }, body: JSON.stringify({ fields: { lp: { mapValue: { fields: {} } } } }) });
  ok("22 · another user cannot overwrite it either (403)", crossW.status === 403, crossW.status);
  ok("23 · the legacy-field mirror in `json` was not affected by any of this and the document is readable by its owner", (await getDoc(U)).status === 200);
  /* maximum-size learner profile */
  await A.p.evaluate(() => { lpSet("role", { role: "x".repeat(120), roleCat: "x".repeat(64), roleId: "other.other", roleOther: "y".repeat(60) }); lpSet("situations", { situations: ["a".repeat(64), "b".repeat(64), "c".repeat(64), "d".repeat(64)], primarySituation: "a".repeat(64) }); lpSet("priorities", { priorities: ["p".repeat(64), "q".repeat(64), "r".repeat(64)] }); lpSet("methods", { methods: ["m1".repeat(30), "m2".repeat(30), "m3".repeat(30)] }); lpSet("vocab", { vocabGoals: ["v1".repeat(30), "v2".repeat(30), "v3".repeat(30)] }); return lpFlush(); }); await sleep(1500);
  const big = await getDoc(U); const lpBytes = JSON.stringify(big.data.lp).length;
  ok("24 · a maximum-size learner profile is small next to Firestore's 1 MiB limit", lpBytes < 6000 && big.bytes < 1000000, `lp ${lpBytes} B, whole document ${big.bytes} B`);
  ok("25 · no JavaScript errors in the new, older or Welding clients", clients.every(c => !jsErr(c.errs).length), clients.map(c => c.kind + ":" + jsErr(c.errs).join("|")).join(" ; "));
} catch (e) { console.log("TEST ERROR:", e.stack || e.message); ok("harness ran to completion", false, e.message); }
finally {
  await cleanup();
  for (const c of clients) await c.ctx.close().catch(() => {});
  servers.forEach(s => s.kill()); await b.close(); rmSync(T, { recursive: true, force: true });
  console.log(`\ncleanup: removed ${created.length} disposable user(s) and their documents`);
  const fails = res.filter(x => !x).length; console.log(`${res.length - fails}/${res.length} passed`); process.exit(fails ? 1 : 0);
}
