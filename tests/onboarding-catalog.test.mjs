/* Onboarding V2 catalogs and legacy mapping (pure logic). Run: cd tests && node onboarding-catalog.test.mjs */
import { createRequire } from "node:module"; import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const C = require("../onboarding-catalog.js"), LP = require("../learner-profile.js");
const legacy = JSON.parse(readFileSync(new URL("./fixtures/legacy-profession-ids.json", import.meta.url), "utf8")).ids;
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + String(d).slice(0, 300)}`); };
const uniq = a => new Set(a).size === a.length;

console.log("\n# identity and stability");
ok("1 · every catalog has unique stable ids", Object.entries(C.CAT).every(([k, v]) => uniq(v.map(x => x.id))), Object.entries(C.CAT).filter(([k, v]) => !uniq(v.map(x => x.id))).map(x => x[0]));
ok("2 · all 181 originally defined profession ids are still present (none renamed or removed)", legacy.length === 181 && legacy.every(id => C.isId("professions", id)), legacy.filter(id => !C.isId("professions", id)).join(","));
ok("3 · professions grew beyond the original set, and every one belongs to a known display group", C.CAT.professions.length > 250 && C.CAT.professions.every(p => C.groupLabel[p.group]), C.CAT.professions.length);
ok("4 · all 17 requested coverage areas exist and none is empty", C.groups.length === 17 && C.byGroup(C.CAT.professions).length === 17, C.byGroup(C.CAT.professions).map(g => g.id + ":" + g.items.length).join(" "));
ok("5 · Other is last in its group and the only 'other.*' id", C.CAT.professions.filter(p => p.id.startsWith("other.")).length === 1 && C.CAT.professions.filter(p => p.group === "career").slice(-1)[0].id === "other.other");
ok("6 · Welder, Pipefitter, Boilermaker and Millwright are General English professions in Skilled trades (no programme link of any kind)", ["trades.welder", "trades.pipefitter", "trades.boilermaker", "trades.millwright"].every(id => C.find("professions", id) && C.find("professions", id).group === "trades") && !C.CAT.professions.some(p => "programme" in p || "track" in p || "route" in p));
ok("7 · exactly the two legacy-mapping rows are hidden from the picker", C.CAT.professions.filter(p => p.hidden).map(p => p.id).sort().join() === "fin.finance_generic,sales.sales_marketing_generic");
ok("8 · the owner's goal renames are present and the old ids are gone", C.isId("goals", "phone_video_calls") && C.isId("goals", "academic_settings") && !C.isId("goals", "write_emails_speak") && !C.isId("goals", "study_exams"));
ok("9 · selection limits: situations 4, priorities 3, vocabulary goals 3, methods 3, Other text 60", JSON.stringify(C.LIMITS) === JSON.stringify({ situations: 4, priorities: 3, vocabGoals: 3, methods: 3, roleOther: 60 }));
ok("10 · counts: 14 goals, 16 situations, 5 confidence, 14 priorities, 14 vocabulary goals, 10 methods, 9 minutes, 5 days, 5 times of day", [C.CAT.goals, C.CAT.situations, C.CAT.confidence, C.CAT.priorities, C.CAT.vocab, C.CAT.methods, C.CAT.minutes, C.CAT.days, C.CAT.timeOfDay].map(x => x.length).join() === "14,16,5,14,14,10,9,5,5");

console.log("\n# legacy values still map (existing learners)");
ok("11 · every old role answer maps to a category (never an invented specific job)", ["Engineering / Data", "Product / PM", "Finance / Business", "Sales / Marketing", "Student", "Other"].every(r => C.legacyRoleToProfile(r) && C.groupLabel[C.legacyRoleToProfile(r).roleCat]) && C.legacyRoleToProfile("Engineering / Data").roleId === undefined);
ok("12 · the four old goal strings map to their ids and back", ["🎤 Speak confidently in meetings:speak_meetings", "💼 Sound more executive:sound_executive", "🏆 Ace interviews in English:ace_interviews", "🗣️ Improve my accent & clarity:improve_accent"].every(x => { const [g, id] = x.split(":"); return C.legacyGoalToId(g) === id && C.goalLegacy(id) === g; }));
ok("13 · the five old confidence strings are the stored values (DailyPlan keys on them)", ["New to speaking English", "Can get by", "Comfortable but not confident", "Fluent, want to sound sharper", "Not sure"].every(v => C.confidenceFromValue(v)));
ok("14 · a new profession gets the nearest legacy role string so old readers keep working", C.legacyRoleFor("tech.data_engineer") === "Engineering / Data" && C.legacyRoleFor("mgmt.x", "mgmt") === "Product / PM" && C.legacyRoleFor("trades.welder") === "Other" && C.legacyRoleFor("early.university_student") === "Student");

console.log("\n# search");
const lab = it => it.label;
ok("15 · accent- and case-insensitive: 'FRONT end' finds the Front-end developer", C.search(C.CAT.professions, "FRONT end", lab).some(p => p.id === "tech.frontend_dev"));
ok("16 · aliases find what the label does not ('nhs nurse' no, 'rn' yes, 'uber driver' yes)", C.search(C.CAT.professions, "rn", lab).some(p => p.id === "health.nurse") && C.search(C.CAT.professions, "uber driver", lab).some(p => p.id === "transport.bus_taxi_driver"));
ok("17 · every typed word must match (AND), so a nonsense word finds nothing", C.search(C.CAT.professions, "welder zzzqqq", lab).length === 0);
ok("18 · label-prefix matches rank first", C.search(C.CAT.professions, "weld", lab)[0].id === "trades.welder");
ok("19 · an accented label is found without the accent (localised labels)", C.search([{ id: "x", label: "Médecin", group: "health" }], "medecin", lab).length === 1 && C.search([{ id: "x", label: "Ingénieur", group: "eng" }], "ingenieur", lab).length === 1);
ok("20 · empty query returns everything", C.search(C.CAT.professions, "", lab).length === C.CAT.professions.length);
ok("21 · the group name is searchable ('healthcare' lists the healthcare group)", C.search(C.CAT.professions, "healthcare", lab).filter(p => p.group === "health").length >= 20);

console.log("\n# resolution: lp first, legacy fallback, reading never writes");
const legacyProfile = { name: "Old", role: "Student", goal: "🏆 Ace interviews in English", selfLevel: "Can get by", lang: "en", ts: 1 };
const frozen = JSON.stringify(legacyProfile);
const r0 = C.resolve(legacyProfile, {});
ok("22 · a legacy profile resolves from its own fields (source 'legacy') and the input is not modified", r0.source.role === "legacy" && r0.roleId === "early.university_student" && r0.goalId === "ace_interviews" && r0.selfLevel === "Can get by" && JSON.stringify(legacyProfile) === frozen);
const S = { profile: legacyProfile }; LP.set(S, "role", { roleCat: "tech", roleId: "tech.data_engineer", role: "Engineering / Data" }, 1e12); LP.set(S, "situations", { situations: ["meetings", "calls"], primarySituation: "calls" }, 1e12 + 1);
const r1 = C.resolve(S.profile, LP.view(S));
ok("23 · once the learner profile has the field it wins over the legacy one (source 'v2'), never both authoritative", r1.source.role === "v2" && r1.roleId === "tech.data_engineer" && r1.primarySituation === "calls" && r1.goalId === "ace_interviews" && r1.source.goal === "legacy");
ok("24 · the primary situation defaults to the first selected", C.resolve({}, { situations: ["interviews", "meetings"] }).primarySituation === "interviews");
ok("25 · missing optional fields read as empty, never as invented answers", (() => { const r = C.resolve({ name: "x" }, {}); return r.situations.length === 0 && r.priorities.length === 0 && r.dailyMinutes === "" && r.goalId === null && r.roleId === null; })());
ok("26 · 'Tune your practice' resumes at the first unfinished part, derived from the profile", JSON.stringify(C.tuneRemaining(C.resolve({}, {}))) === '["priorities","vocab","methods","schedule"]' && JSON.stringify(C.tuneRemaining(C.resolve({}, { priorities: ["fluency"], vocabGoals: ["idioms"] }))) === '["methods","schedule"]' && C.tuneRemaining(C.resolve({}, { priorities: ["a"], vocabGoals: ["a"], methods: ["a"], dailyMinutes: "m25", practiceDays: "d6", timeOfDay: "morning" })).length === 0);
const fails = res.filter(x => !x).length; console.log(`\n${res.length - fails}/${res.length} passed`); process.exit(fails ? 1 : 0);
