/* LearnerProfile engine (Onboarding V2 Phase 0): last-writer-wins groups with
   tombstones, hybrid clock, atomic groups. Pure logic, no browser.
   Run: cd tests && node learner-profile.test.mjs */
import { createRequire } from "node:module";
const LP = createRequire(import.meta.url)("../learner-profile.js");

const res = [];
const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };
const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)(12345);
const T0 = 1_800_000_000_000, DAY = 86400000;
const mk = () => ({ profile: { name: "x", role: "Student" } });
const cloudOf = S => JSON.parse(JSON.stringify({ g: S.lp ? S.lp.g : {} }));
const gsig = S => JSON.stringify(Object.keys((S.lp && S.lp.g) || {}).sort().map(k => [k, S.lp.g[k].t, S.lp.g[k].s]));

console.log("\n# validation and atomic groups");
{
  const S = mk();
  ok("1 · a valid role group is stored whole and marked dirty", LP.set(S, "role", { roleCat: "health", roleId: "health.nurse" }, T0) && LP.get(S, "role").roleId === "health.nurse" && S.lp.dirty.role === 1);
  ok("2 · setting the identical value again is a no-op (no new stamp, no dirty churn)", !LP.set(S, "role", { roleCat: "health", roleId: "health.nurse" }, T0 + 5) && S.lp.g.role.t === T0);
  ok("3 · roleOther is dropped unless the role is other.other", LP.set(S, "role", { roleId: "health.nurse", roleOther: "Radiographer" }, T0 + 10) && LP.get(S, "role").roleOther === undefined);
  ok("4 · roleOther is kept with other.other and capped at 60 characters", LP.set(S, "role", { roleId: "other.other", roleOther: "Radiographer" }, T0 + 20) && LP.get(S, "role").roleOther === "Radiographer" && !LP.set(S, "role", { roleId: "other.other", roleOther: "x".repeat(61) }, T0 + 30));
  ok("5 · unknown group, unknown field, wrong types, duplicates and over-long lists are refused", !LP.set(S, "nope", { a: 1 }) && !LP.set(S, "role", { roleId: "a", extra: "b" }) && !LP.set(S, "schedule", { dailyMinutes: 25 }) && !LP.set(S, "situations", { situations: ["a", "a"] }) && !LP.set(S, "situations", { situations: ["a", "b", "c", "d", "e"] }) && !LP.set(S, "priorities", { priorities: ["a", "b", "c", "d"] }));
  ok("6 · primarySituation must be one of the chosen situations", (() => { LP.set(S, "situations", { situations: ["meetings", "calls"], primarySituation: "interviews" }, T0 + 40); return LP.get(S, "situations").primarySituation === undefined && LP.set(S, "situations", { situations: ["meetings", "calls"], primarySituation: "calls" }, T0 + 50) && LP.get(S, "situations").primarySituation === "calls"; })());
  ok("7 · view() flattens live groups for consumers and S.profile is never touched", (() => { const v = LP.view(S); return v.roleId === "other.other" && v.primarySituation === "calls" && JSON.stringify(S.profile) === JSON.stringify({ name: "x", role: "Student" }); })());
  ok("8 · only 9 groups exist, so tombstones are bounded", Object.keys(LP.GROUPS).length === 9);
  ok("8b · vocabulary goals (max 3), practice methods (max 3) and native language are groups of their own", LP.set(S, "vocab", { vocabGoals: ["a", "b", "c"] }, T0 + 60) && !LP.set(S, "vocab", { vocabGoals: ["a", "b", "c", "d"] }) && !LP.set(S, "methods", { methods: ["a", "b", "c", "d"] }) && LP.set(S, "native", { nativeLang: "tl" }, T0 + 70) && LP.view(S).nativeLang === "tl");
}

console.log("\n# conflict resolution, offline edits, devices");
{
  /* A and B start from the same cloud; B goes offline */
  const A = mk(), B = mk();
  LP.set(A, "role", { roleId: "tech.data_engineer", roleCat: "tech" }, T0);
  LP.set(A, "goal", { goalId: "speak_meetings" }, T0 + 1000);
  const cloud0 = cloudOf(A); LP.mergeCloud(B, cloud0, T0 + 2000);
  /* offline: B edits the role, A (online) edits the goal */
  LP.set(B, "role", { roleId: "biz.project_manager", roleCat: "biz" }, T0 + 5000);
  LP.set(A, "goal", { goalId: "ace_interviews" }, T0 + 6000);
  /* B reconnects: pulls A's cloud copy, pushes its own */
  let cloud = cloudOf(A);
  const rB = LP.mergeCloud(B, cloud, T0 + 9000);
  ok("9 · offline edit of one group and online edit of another BOTH survive on the offline device", LP.get(B, "goal").goalId === "ace_interviews" && LP.get(B, "role").roleId === "biz.project_manager" && rB.toPush.includes("role"));
  const rA = LP.mergeCloud(A, cloudOf(B), T0 + 9500);
  ok("10 · and on the other device, after the exchange; both converge to the same stamps", LP.get(A, "role").roleId === "biz.project_manager" && gsig(A) === gsig(B), gsig(A) + " vs " + gsig(B));
  ok("11 · merging the same copy again changes nothing (idempotent)", !LP.mergeCloud(A, cloudOf(B), T0 + 10000).changed && !LP.mergeCloud(B, cloudOf(A), T0 + 10000).changed);
}
{
  /* same group edited on both: later edit wins from either direction */
  const A = mk(), B = mk();
  LP.set(A, "schedule", { dailyMinutes: "m25" }, T0 + 100);
  LP.set(B, "schedule", { dailyMinutes: "m10" }, T0 + 200);
  const a2 = JSON.parse(JSON.stringify(A)), b2 = JSON.parse(JSON.stringify(B));
  LP.mergeCloud(A, cloudOf(b2), T0 + 300); LP.mergeCloud(B, cloudOf(a2), T0 + 300);
  ok("12 · the later edit wins on both devices regardless of who merges first", LP.get(A, "schedule").dailyMinutes === "m10" && LP.get(B, "schedule").dailyMinutes === "m10");
  /* identical timestamps: deterministic tie-break */
  const C = mk(), D = mk();
  LP.set(C, "schedule", { dailyMinutes: "m25" }, T0 + 500); LP.set(D, "schedule", { dailyMinutes: "m10" }, T0 + 500);
  const c2 = JSON.parse(JSON.stringify(C)), d2 = JSON.parse(JSON.stringify(D));
  LP.mergeCloud(C, cloudOf(d2), T0 + 600); LP.mergeCloud(D, cloudOf(c2), T0 + 600);
  ok("13 · an exact timestamp tie picks the SAME winner on both devices", gsig(C) === gsig(D) && LP.get(C, "schedule").dailyMinutes === LP.get(D, "schedule").dailyMinutes);
  /* an unsent older local edit loses and is reported */
  const E = mk(); LP.set(E, "schedule", { dailyMinutes: "m5" }, T0 + 50);
  const r = LP.mergeCloud(E, { g: { schedule: { v: { dailyMinutes: "m10" }, t: T0 + 200, s: LP.sig({ dailyMinutes: "m10" }) } } }, T0 + 300);
  ok("14 · an older unsent local edit loses to the cloud and is reported as lost", LP.get(E, "schedule").dailyMinutes === "m10" && r.lost.includes("schedule") && !LP.dirtyGroups(E).length);
}

console.log("\n# deletions");
{
  const A = mk(), B = mk();
  LP.set(A, "priorities", { priorities: ["fluency", "grammar"] }, T0);
  LP.mergeCloud(B, cloudOf(A), T0 + 10);
  LP.clear(A, "priorities", T0 + 1000);                      // A deletes
  /* stale B (never saw the delete) merges and pushes its old value */
  const rB = LP.mergeCloud(B, cloudOf(A), T0 + 2000);
  ok("15 · a tombstone reaches a stale device and removes the value there", LP.get(B, "priorities") === null && rB.changed);
  const stale = mk(); LP.set(stale, "priorities", { priorities: ["fluency", "grammar"] }, T0 + 500);   // an older edit made elsewhere
  LP.mergeCloud(A, cloudOf(stale), T0 + 3000);
  ok("16 · an older value cannot resurrect a deleted group", LP.get(A, "priorities") === null && A.lp.g.priorities.v === null);
  LP.set(A, "priorities", { priorities: ["listening"] }, T0 + 4000);
  ok("17 · a genuinely newer edit after the delete does win", LP.get(A, "priorities").priorities[0] === "listening");
  ok("18 · clearing an already-cleared group is a no-op", (() => { const X = mk(); LP.clear(X, "methods", T0); return !LP.clear(X, "methods", T0 + 5); })());
}

console.log("\n# clock skew and hostile or malformed cloud data");
{
  const A = mk(); LP.set(A, "goal", { goalId: "a" }, T0);
  /* a device whose clock is a month ahead */
  const future = { g: { goal: { v: { goalId: "future" }, t: T0 + 30 * DAY, s: LP.sig({ goalId: "future" }) } } };
  LP.mergeCloud(A, future, T0 + 100);
  ok("19 · a stamp far in the future is clamped to now + 1 day", A.lp.g.goal.t <= T0 + 100 + DAY);
  LP.set(A, "goal", { goalId: "later" }, T0 + 200);
  ok("20 · a normal later edit still wins afterwards (no permanent winner)", LP.get(A, "goal").goalId === "later" && A.lp.g.goal.t > T0 + 100);
  /* a device with a clock a day BEHIND still edits after seeing newer stamps */
  const B = mk(); LP.set(B, "goal", { goalId: "x" }, T0 + 10 * 1000);
  LP.set(B, "goal", { goalId: "y" }, T0 - DAY);
  ok("21 · a clock that runs behind never stamps backwards (hybrid clock)", B.lp.g.goal.t > T0 + 10 * 1000 && LP.get(B, "goal").goalId === "y");
  const M = mk(); LP.set(M, "goal", { goalId: "keep" }, T0);
  LP.mergeCloud(M, { g: { goal: { v: { goalId: "z", bogus: 1 }, t: T0 + 9, s: "x" }, role: "junk", methods: { v: null, t: T0 + 5, s: "not-a-tombstone" }, schedule: { v: { dailyMinutes: "m10" }, t: "late", s: "q" } } }, T0 + 20);
  ok("22 · malformed cloud entries (bad value, junk, fake tombstone, bad time) are ignored; local survives", LP.get(M, "goal").goalId === "keep" && !LP.get(M, "methods") && !LP.get(M, "schedule") && !LP.get(M, "role"));
  const F = mk(); LP.mergeCloud(F, { g: { futureGroup: { v: { anything: 1 }, t: T0, s: "q" } } }, T0 + 1);
  ok("23 · a group this version does not know is preserved, and never appears in view()", F.lp.g.futureGroup && Object.keys(LP.view(F)).length === 0);
}

console.log("\n# legacy profiles");
{
  const S = { profile: { name: "Old", role: "Engineering / Data", goal: "🎤 Speak confidently in meetings", selfLevel: "Can get by", lang: "en", ts: 1 } };
  const before = JSON.stringify(S.profile);
  ok("24 · a profile with no lp reads as empty and nothing is written by reading", Object.keys(LP.view(S)).length === 0 && S.lp === undefined && JSON.stringify(S.profile) === before);
  LP.mergeCloud(S, null, T0); LP.mergeCloud(S, {}, T0); LP.mergeCloud(S, { g: 5 }, T0);
  ok("25 · merging nothing, an empty doc, or a junk field is safe and creates no lp (reading never writes)", LP.dirtyGroups(S).length === 0 && S.lp === undefined && JSON.stringify(S.profile) === before);
  const R = {}; LP.mergeCloud(R, { g: { role: { v: { roleId: "health.nurse" }, t: T0, s: LP.sig({ roleId: "health.nurse" }) } } }, T0 + 1);
  ok("26 · a new device with no state adopts the cloud groups", LP.get(R, "role").roleId === "health.nurse");
}

console.log("\n# atomicity and convergence (randomised)");
{
  const NAMES = ["role", "goal", "situations", "confidence", "priorities", "methods", "schedule"];
  const VALS = {
    role: [{ roleId: "tech.data_engineer", roleCat: "tech" }, { roleId: "other.other", roleOther: "Nurse" }, { roleId: "biz.project_manager", roleCat: "biz" }, { roleId: "trades.welder", roleCat: "trades" }],
    goal: [{ goalId: "a" }, { goalId: "b" }], situations: [{ situations: ["meetings"] }, { situations: ["calls", "meetings"], primarySituation: "calls" }],
    confidence: [{ selfLevel: "Can get by" }, { selfLevel: "Not sure" }], priorities: [{ priorities: ["fluency"] }, { priorities: ["pronunciation", "grammar"] }],
    methods: [{ methods: ["shadowing"] }], schedule: [{ dailyMinutes: "m10" }, { dailyMinutes: "m25", practiceDays: "d6" }]
  };
  let converged = 0, atomic = true, idem = true;
  for (let trial = 0; trial < 300; trial++) {
    const devs = [mk(), mk(), mk()]; let clock = T0;
    for (let step = 0; step < 14; step++) {
      const d = devs[Math.floor(rng() * 3)], g = NAMES[Math.floor(rng() * NAMES.length)]; clock += Math.floor(rng() * 5000);
      if (rng() < 0.25) LP.clear(d, g, clock); else LP.set(d, g, VALS[g][Math.floor(rng() * VALS[g].length)], clock);
      if (rng() < 0.4) { const o = devs[Math.floor(rng() * 3)]; if (o !== d) LP.mergeCloud(o, cloudOf(d), clock); }
    }
    /* full exchange in random order, twice */
    for (let pass = 0; pass < 2; pass++) { const order = [0, 1, 2].sort(() => rng() - 0.5); for (const i of order) for (const j of order) if (i !== j) LP.mergeCloud(devs[i], cloudOf(devs[j]), clock + 1e6); }
    if (gsig(devs[0]) === gsig(devs[1]) && gsig(devs[1]) === gsig(devs[2])) converged++;
    const snap = gsig(devs[0]); LP.mergeCloud(devs[0], cloudOf(devs[1]), clock + 2e6); if (gsig(devs[0]) !== snap) idem = false;
    for (const d of devs) { const r = LP.get(d, "role"); if (r && "roleOther" in r && r.roleId !== "other.other") atomic = false; if (r && r.roleId === "other.other" && r.roleOther === undefined && false) atomic = false; }
  }
  ok("27 · 300 random three-device histories all converge to identical stamps", converged === 300, converged + "/300");
  ok("28 · merging an already-merged copy never changes anything (idempotent)", idem);
  ok("29 · roleOther never survives alongside a different roleId (atomic role group)", atomic);
}

console.log("\n# dirty tracking");
{
  const S = mk(); LP.set(S, "goal", { goalId: "a" }, T0);
  const e = { ...S.lp.g.goal };
  LP.markSent(S, "goal", e);
  ok("30 · markSent clears dirty only when the confirmed entry is the current one", LP.dirtyGroups(S).length === 0);
  LP.set(S, "goal", { goalId: "b" }, T0 + 5); LP.markSent(S, "goal", e);
  ok("31 · an older confirmation does not clear a newer unsent edit", LP.dirtyGroups(S).includes("goal"));
}

const fails = res.filter(x => !x).length;
console.log(`\n${res.length - fails}/${res.length} passed`);
process.exit(fails ? 1 : 0);
