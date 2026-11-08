/* Learner-profile cloud sync safety (Onboarding V2 Phase 0).
   Proves, with REAL client code against a model of Firestore, that General English profile data
   (S.lp, the `lp` document field) cannot be erased by:
     - an OLDER client (the committed HEAD index.html, which has no lp code at all),
     - the WELDING app (this tree, pinned to the welding programme),
     - a stale or offline new client,
   and that two new clients converge. The Firestore model implements the documented semantics the
   app depends on: set(...,{merge:true}) merges top-level/nested maps, update() with a dotted path
   REPLACES the value at that path, and transactions are optimistic (version-checked, retried).
   It is a model: real Firestore on the staging project has NOT been exercised by this suite.
   Run: cd tests && node learner-profile-sync.mjs */
import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process"; import { setTimeout as sleep } from "node:timers/promises";
import { mkdtempSync, symlinkSync, writeFileSync, readdirSync } from "node:fs"; import { join } from "node:path"; import { tmpdir } from "node:os";

setTimeout(() => { console.log('WATCHDOG: test exceeded 400 s'); process.exit(2); }, 400000).unref?.();
const res = [];
const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 400)}`); };
const ROOT = new URL("..", import.meta.url).pathname;

/* ---- servers: this tree, and a copy whose index.html is the committed HEAD (an "older client") ---- */
const oldDir = mkdtempSync(join(tmpdir(), "be-old-"));
for (const n of readdirSync(ROOT)) { if ([".git", "tests", "mobile", "backend", "docs", "marketing", "node_modules", "playstore", "scripts", "index.html", "www"].includes(n)) continue; try { symlinkSync(join(ROOT, n), join(oldDir, n)); } catch (e) {} }
writeFileSync(join(oldDir, "index.html"), execSync("git show HEAD:index.html", { cwd: ROOT, maxBuffer: 1 << 28 }));
const NEW = 8961, OLD = 8962;
const servers = [spawn("python3", ["-m", "http.server", String(NEW), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" }), spawn("python3", ["-m", "http.server", String(OLD), "--bind", "127.0.0.1"], { cwd: oldDir, stdio: "ignore" })];
await sleep(1200);

/* ---- the Firestore model (shared by every client page) ---- */
const docs = new Map(), vers = new Map(); let latency = 0;
const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const isMap = x => x && typeof x === "object" && !Array.isArray(x);
const bump = p => vers.set(p, (vers.get(p) || 0) + 1);
const deepMerge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) o[k] = isMap(b[k]) && isMap(o[k]) ? deepMerge(o[k], b[k]) : clone(b[k]); return o; };
const stamp = x => { if (x && typeof x === "object") { if ("__ts" in x) return Date.now(); for (const k of Object.keys(x)) x[k] = stamp(x[k]); } return x; };
function doSet(p, data, merge) { data = stamp(clone(data)); docs.set(p, merge ? deepMerge(docs.get(p) || {}, data) : data); bump(p); }
function doUpdate(p, data) {
  if (!docs.has(p)) throw new Error("NOT_FOUND");
  const d = clone(docs.get(p)); data = stamp(clone(data));
  for (const [path, val] of Object.entries(data)) { const ks = path.split("."); let cur = d; for (const k of ks.slice(0, -1)) { if (!isMap(cur[k])) cur[k] = {}; cur = cur[k]; } cur[ks[ks.length - 1]] = val; }   // REPLACES the value at the path
  docs.set(p, d); bump(p);
}
async function fs(op, ...a) {
  if (latency) await sleep(latency);
  if (op === "get") { const [p] = a; return { exists: docs.has(p), data: clone(docs.get(p)), ver: vers.get(p) || 0 }; }
  if (op === "set") { doSet(a[0], a[1], !!(a[2] && a[2].merge)); return 1; }
  if (op === "update") { doUpdate(a[0], a[1]); return 1; }
  if (op === "delete") { docs.delete(a[0]); bump(a[0]); return 1; }
  if (op === "commit") { const [reads, writes] = a; if (reads.some(r => (vers.get(r.path) || 0) !== r.ver)) return "retry"; for (const w of writes) w.op === "set" ? doSet(w.path, w.data, !!(w.merge && w.merge.merge)) : doUpdate(w.path, w.data); return "ok"; }
}
const userDoc = uid => docs.get("users/" + uid);

const b = await chromium.launch();
const FND = g => ({ placed: "full", finished: true, day: 1, done: {} });
const seed = (track, extra = {}) => ({ profile: { name: "Pat", role: "Student", goal: "", slot: "", selfLevel: "", lang: "en", ts: 1 }, professionalTracks: { activeId: track }, fnd: { [track]: FND() }, areaSplit: true, days: {}, dates: [], dayLog: {}, steps: {}, vocab: {}, ...extra });

/* kind: new | newOff | old | weld ; every client is signed in as `uid` against the shared model */
async function client(kind, uid = "u1", state = null) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const track = kind === "weld" ? "welding" : "general-english";
  const flags = JSON.stringify({ onboarding_v2_enabled: kind !== "newOff" });
  await ctx.addInitScript(([s, f, w, kindName]) => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("be12_v1", s); localStorage.setItem("be_flags", f); localStorage.setItem("be12_trust_account", "1"); } if (w) window.BE_BUILD = { track: "welding" }; }, [JSON.stringify(state || seed(track)), flags, kind === "weld", kind]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.exposeFunction("__fs", fs);
  await p.goto(`http://127.0.0.1:${kind === "old" ? OLD : NEW}/index.html`); await sleep(1500);
  await p.evaluate(uidArg => {
    const call = (...a) => window.__fs(...a), clean = x => JSON.parse(JSON.stringify(x, (k, v) => (v && typeof v === "object" && ("_methodName" in v || "_delegate" in v || "__ts" in v) ? { __ts: 1 } : v)));
    const snap = x => ({ exists: x.exists, data: () => x.data });
    const ref = path => ({ path, get: async () => snap(await call("get", path)), set: (d, o) => call("set", path, clean(d), o || null), update: d => call("update", path, clean(d)), delete: () => call("delete", path) });
    if (!(window.firebase && firebase.firestore && firebase.firestore.FieldValue)) window.firebase = { firestore: { FieldValue: { serverTimestamp: () => ({ __ts: 1 }) } } };
    FBUser = { uid: uidArg, email: "t@example.com" };
    FBdb = {
      collection: c => ({ doc: id => ref(c + "/" + id) }),
      runTransaction: async fn => { for (let i = 0; i < 8; i++) { const reads = [], writes = []; const tx = { get: async r => { const x = await call("get", r.path); reads.push({ path: r.path, ver: x.ver }); return snap(x); }, set: (r, d, o) => writes.push({ op: "set", path: r.path, data: clean(d), merge: o || null }), update: (r, d) => writes.push({ op: "update", path: r.path, data: clean(d) }) }; const out = await fn(tx); if ((await call("commit", reads, writes)) === "ok") return out; } throw new Error("aborted"); }
    };
  }, uid);
  return { ctx, p, errs, kind };
}
const jsErr = errs => errs.filter(e => !/MIME type|net::ERR/.test(e));
const sync = async c => { await c.p.evaluate(() => { fbLastPull = 0; return fbSyncPull(); }); await sleep(250); };
const flush = async c => { await c.p.evaluate(() => lpFlush()); await sleep(150); };
const cloudLp = uid => (userDoc(uid) || {}).lp;
const jsonOf = uid => { try { return JSON.parse((userDoc(uid) || {}).json || "null"); } catch (e) { return null; } };
const view = c => c.p.evaluate(() => LearnerProfile.view(S));

console.log("\n# 1. control: why the data must not live inside profile");
{
  /* the cloud holds a profile written by a NEW client, with General English fields inside it */
  docs.clear(); vers.clear();
  const rich = seed("general-english"); rich.profile = { ...rich.profile, role: "Other", roleOther: "Nurse", situations: ["meetings"], priorities: ["fluency"] };
  docs.set("users/u1", { json: JSON.stringify(rich), savedAt: 5, email: "t@example.com" });
  const old = await client("old", "u1");
  await old.p.evaluate(() => { fbLastPull = 0; return fbSyncPull(); }); await sleep(300);
  await old.p.evaluate(() => { S.profile.voice = "alloy"; save(); fbPush(0); }); await sleep(900);
  const prof = jsonOf("u1").profile;
  ok("1 · an OLDER client's normal sync erases situations/priorities/roleOther stored inside profile (the hazard this design avoids)", prof.situations === undefined && prof.priorities === undefined && prof.roleOther === undefined && prof.voice === "alloy", JSON.stringify(prof));
  await old.ctx.close();
}

console.log("\n# 2. older client, Welding app and stale pushes cannot touch `lp`");
{
  docs.clear(); vers.clear();
  const LPDOC = { v: 1, g: { role: { v: { roleId: "health.nurse", roleCat: "health" }, t: 1800000000100, s: "x" }, situations: { v: { situations: ["meetings", "calls"], primarySituation: "calls" }, t: 1800000000200, s: "y" } } };
  docs.set("users/u1", { json: JSON.stringify(seed("general-english")), savedAt: 5, email: "t@example.com", lp: LPDOC });
  const before = JSON.stringify(cloudLp("u1"));

  const old = await client("old", "u1");
  await old.p.evaluate(() => { fbLastPull = 0; return fbSyncPull(); }); await sleep(300);
  await old.p.evaluate(() => { S.profile.name = "Changed"; save(); fbPush(0); }); await sleep(900);
  ok("2 · after an OLDER client pulls and pushes, `lp` is byte-identical", JSON.stringify(cloudLp("u1")) === before && jsonOf("u1").profile.name === "Changed");
  /* a stale older client that NEVER pulled: blind push of old state */
  const stale = await client("old", "u1", seed("general-english"));
  await stale.p.evaluate(() => { S.dates = ["2026-11-06"]; save(); fbPush(0); }); await sleep(900);
  ok("3 · a stale older client's BLIND push (no pull first) still leaves `lp` untouched", JSON.stringify(cloudLp("u1")) === before);
  await old.ctx.close(); await stale.ctx.close();

  const weld = await client("weld", "u1", seed("welding"));
  const wOn = await weld.p.evaluate(() => ({ track: BE_APP_TRACK, lpOn: lpOn(), gen: isGeneralEnglish() }));
  await weld.p.evaluate(() => { fbLastPull = 0; return fbSyncPull(); }); await sleep(300);
  await weld.p.evaluate(() => { S.profile.name = "Welder"; save(); fbPush(0); lpSet("role", { roleId: "trades.welder" }); lpFlushSoon(0); }); await sleep(1200);
  const wLocal = await weld.p.evaluate(() => ({ lp: S.lp === undefined, set: lpSet("goal", { goalId: "a" }) }));
  ok("4 · the Welding app (flag forced ON) is not General English: lpOn() false, lpSet refused, no S.lp created", wOn.track === "welding" && !wOn.lpOn && !wOn.gen && wLocal.lp && wLocal.set === false);
  ok("5 · after the Welding app pulls, pushes and tries to write, `lp` in the cloud is byte-identical", JSON.stringify(cloudLp("u1")) === before && jsonOf("u1").professionalTracks.activeId === "welding");
  await weld.ctx.close();

  const off = await client("newOff", "u1");
  await sync(off); await off.p.evaluate(() => { S.profile.name = "Off"; save(); fbPush(0); }); await sleep(900);
  ok("6 · a NEW client with the flag OFF neither reads nor writes `lp`", JSON.stringify(cloudLp("u1")) === before && (await off.p.evaluate(() => S.lp === undefined)));
  await off.ctx.close();
}

console.log("\n# 3. new clients: offline edits, concurrency, deletions, convergence");
{
  docs.clear(); vers.clear();
  docs.set("users/u2", { json: JSON.stringify(seed("general-english")), savedAt: 5, email: "t@example.com" });
  const A = await client("new", "u2"), B = await client("new", "u2");
  await A.p.evaluate(() => { lpSet("role", { roleId: "tech.data_engineer", roleCat: "tech" }); lpSet("goal", { goalId: "speak_meetings" }); }); await flush(A);
  await sync(B);
  ok("7 · a second device receives A's groups on its next pull", (await view(B)).roleId === "tech.data_engineer" && (await view(B)).goalId === "speak_meetings");

  /* B goes offline: every Firestore call fails */
  await B.p.evaluate(() => { window.__realTx = FBdb.runTransaction; FBdb.runTransaction = async () => { throw Object.assign(new Error("offline"), { code: "unavailable" }); }; });
  await B.p.evaluate(() => { lpSet("role", { roleId: "biz.project_manager", roleCat: "biz" }); }); await flush(B);
  ok("8 · an offline edit stays local and dirty, nothing is lost or thrown", (await B.p.evaluate(() => LearnerProfile.dirtyGroups(S))).includes("role") && cloudLp("u2").g.role.v.roleId === "tech.data_engineer");
  await A.p.evaluate(() => { lpSet("goal", { goalId: "ace_interviews" }); }); await flush(A);
  await B.p.evaluate(() => { FBdb.runTransaction = window.__realTx; });
  await sync(B); await flush(B); await sync(A);
  const vB = await view(B), vA = await view(A), c = cloudLp("u2").g;
  ok("9 · after reconnecting, the offline role edit AND the other device's goal edit both survive, on both devices and in the cloud", vB.roleId === "biz.project_manager" && vB.goalId === "ace_interviews" && vA.roleId === "biz.project_manager" && vA.goalId === "ace_interviews" && c.role.v.roleId === "biz.project_manager" && c.goal.v.goalId === "ace_interviews", JSON.stringify({ vA, vB }));

  /* deletion, then a stale device writes its older value */
  await A.p.evaluate(() => { lpSet("priorities", { priorities: ["fluency"] }); }); await flush(A); await sync(B);
  await A.p.evaluate(() => { lpClear("priorities"); }); await flush(A);
  await B.p.evaluate(() => { const lp = S.lp; lp.g.priorities = { v: { priorities: ["fluency"] }, t: 1, s: LearnerProfile.sig({ priorities: ["fluency"] }) }; lp.dirty.priorities = 1; });   // stale copy that never saw the delete
  await flush(B); await sync(B);
  ok("10 · a stale device cannot resurrect a deleted group: the cloud keeps the tombstone and the stale device adopts it", cloudLp("u2").g.priorities.v === null && (await view(B)).priorities === undefined);

  /* two writers, same group, same instant: the transaction retries and the later stamp wins */
  latency = 40;
  await Promise.all([A.p.evaluate(() => { lpSet("schedule", { dailyMinutes: "m10" }); return lpFlush(); }), B.p.evaluate(() => { lpSet("schedule", { dailyMinutes: "m25" }); return lpFlush(); })]);
  latency = 0; await sync(A); await sync(B);
  const sA = (await view(A)).dailyMinutes, sB = (await view(B)).dailyMinutes, sC = cloudLp("u2").g.schedule.v.dailyMinutes;
  ok("11 · simultaneous writes to one group converge on A, B and the cloud (one winner, none lost half-way)", sA === sB && sB === sC, [sA, sB, sC].join("/"));

  /* removing a field must REPLACE the group (update on a dotted path), never deep-merge it */
  await A.p.evaluate(() => { lpSet("role", { roleId: "other.other", roleOther: "Radiographer" }); }); await flush(A);
  await A.p.evaluate(() => { lpSet("role", { roleId: "health.nurse", roleCat: "health" }); }); await flush(A);
  ok("12 · changing a group replaces it entirely in the cloud: no stale roleOther survives", JSON.stringify(cloudLp("u2").g.role.v) === JSON.stringify({ roleId: "health.nurse", roleCat: "health" }), JSON.stringify(cloudLp("u2").g.role.v));
  ok("13 · and no client wrote anything to `json` for the new data (payload strips lp)", !("lp" in (jsonOf("u2") || {})) && !(await A.p.evaluate(() => "lp" in JSON.parse(fbCloudJson(S)))));
  ok("14 · no JavaScript errors in either new client", !jsErr(A.errs).length && !jsErr(B.errs).length, A.errs.concat(B.errs).join("|"));
  await A.ctx.close(); await B.ctx.close();
}

console.log("\n# 4. legacy profiles, sign-in adoption, sign-out");
{
  docs.clear(); vers.clear();
  /* a legacy learner on a new client: nothing is written to the cloud for lp until they edit */
  const legacy = seed("general-english"); legacy.profile = { name: "Old", role: "Engineering / Data", goal: "🎤 Speak confidently in meetings", slot: "", selfLevel: "Can get by", lang: "en", ts: 1 };
  docs.set("users/u3", { json: JSON.stringify(legacy), savedAt: 5, email: "t@example.com" });
  const L = await client("new", "u3", legacy);
  await L.p.evaluate(() => fbFirstSync(FBUser)); await sleep(600); await sync(L);
  ok("15 · a legacy profile signs in and pulls with no lp anywhere: nothing is written, the profile is untouched", !("lp" in userDoc("u3")) && (await L.p.evaluate(() => JSON.stringify(S.profile))) === JSON.stringify(legacy.profile) && (await L.p.evaluate(() => S.lp === undefined)));
  /* local lp edits made while signed out survive adopting the account copy */
  await L.p.evaluate(() => { const f = FBUser; FBUser = null; lpSet("goal", { goalId: "ace_interviews" }); FBUser = f; });
  ok("16 · an edit made before sign-in is kept locally and dirty (not lost, not sent yet)", (await L.p.evaluate(() => LearnerProfile.dirtyGroups(S))).includes("goal"));
  await L.p.evaluate(() => { fbSyncing = false; return fbFirstSync(FBUser); }); await sleep(900);
  ok("17 · sign-in that ADOPTS the account copy keeps the device's lp edit and sends it", (await view(L)).goalId === "ace_interviews" && cloudLp("u3") && cloudLp("u3").g.goal.v.goalId === "ace_interviews");
  /* sign-out wipes this device only; the cloud copy comes back on the next sign-in */
  await L.p.evaluate(() => fbWipeDevice());
  ok("18 · sign-out wipes the device copy of lp", await L.p.evaluate(() => S.lp === undefined || Object.keys(S.lp.g || {}).length === 0));
  ok("19 · the cloud copy is untouched by the wipe", cloudLp("u3").g.goal.v.goalId === "ace_interviews");
  await L.p.evaluate(() => { localStorage.setItem("be_flags", JSON.stringify({ onboarding_v2_enabled: true })); S.professionalTracks = { activeId: "general-english" }; save(); fbSyncing = false; return fbFirstSync(FBUser); }); await sleep(900);
  ok("20 · signing in again restores the learner profile from the cloud", (await view(L)).goalId === "ace_interviews");
  ok("21 · no JavaScript errors", !jsErr(L.errs).length, L.errs.join("|"));
  await L.ctx.close();
}

servers.forEach(s => s.kill());
const fails = res.filter(x => !x).length;
console.log(`\n${res.length - fails}/${res.length} passed`);
await b.close();
process.exit(fails ? 1 : 0);
