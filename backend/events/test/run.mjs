/* be-events Worker — contract tests, pure Node.
   Run:  cd backend/events && node test/run.mjs
   No wrangler, no Cloudflare, no network. The Worker's default export is
   called directly with a fake Analytics Engine binding that records every
   writeDataPoint, so each check below is a statement about what a real
   request would put into the dataset — and, just as important, what it
   would NOT.

   Three questions, in order:
     1. does the transport behave as documented (CORS, methods, origins,
        body cap, allow-list, 204-for-everything)?
     2. does every V2 event the client actually sends land, with every prop
        in the column the README says, and nothing else beside it?
     3. can anything personal get through — a transcript, a name, an email,
        an unknown key, a long value, a wrong track?

   The client side of the contract is checked against index.html itself:
   every mvTrack() call site is parsed, so a v2_* name or a prop key added
   in the app without being allow-listed here fails this file, not silently
   in production. */
import worker from "../events-worker.js";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../events-worker.js", import.meta.url), "utf8");
const APP = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const EVENTS = [...SRC.match(/const EVENTS = new Set\(\[([\s\S]*?)\]\);/)[1].matchAll(/"([a-z0-9_]+)"/g)].map(m => m[1]);
const KEYS = [...SRC.match(/const PROP_KEYS = new Set\(\[([\s\S]*?)\]\);/)[1].matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
const MAX_VAL = +SRC.match(/const MAX_VAL\s*=\s*(\d+)/)[1];
const MAX_BODY = +SRC.match(/const MAX_BODY\s*=\s*(\d+)/)[1];
const col = k => KEYS.indexOf(k) + 2;            // blobs[] index; blob number is +1
const GE = "general-english", ORIGIN = "https://app.lomonec.com";
const URL_ = "https://be-events.nore-ngou.workers.dev/e";

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

function env(vars) { const writes = []; return { env: { AE: { writeDataPoint(p) { writes.push(p); } }, ...(vars || {}) }, writes }; }
async function send(e, body, o = {}) {
  const req = new Request(URL_, { method: o.method || "POST", headers: { Origin: o.origin === null ? undefined : (o.origin || ORIGIN), "Content-Type": "text/plain" },
    body: (o.method || "POST") === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined });
  const r = await worker.fetch(req, e.env);
  return { status: r.status, h: Object.fromEntries(r.headers), writes: e.writes };
}
const row = e => e.writes[e.writes.length - 1];

/* ── 1 · transport ────────────────────────────────────────────────────── */
console.log("\n1 · TRANSPORT");
{ const e = env(); const r = await send(e, null, { method: "OPTIONS" });
  ok("OPTIONS → 204 with CORS for the app origin", r.status === 204 && r.h["access-control-allow-origin"] === ORIGIN && /POST/.test(r.h["access-control-allow-methods"]) && e.writes.length === 0); }
{ const e = env(); const r = await send(e, null, { method: "OPTIONS", origin: "capacitor://localhost" });
  ok("the iOS shell origin is allow-listed", r.h["access-control-allow-origin"] === "capacitor://localhost"); }
{ const e = env(); const r = await send(e, null, { method: "OPTIONS", origin: "https://evil.example" });
  ok("an unknown origin gets the default origin back, not its own", r.status === 204 && r.h["access-control-allow-origin"] === ORIGIN); }
{ const e = env(); const r = await send(e, null, { method: "GET" }); ok("GET → 405, nothing written", r.status === 405 && e.writes.length === 0); }
{ const e = env(); const r = await send(e, { name: "app_open" }, { origin: "https://evil.example" });
  ok("POST from a disallowed origin → 403, nothing written — the origin is checked before the body is read", r.status === 403 && e.writes.length === 0); }
{ const e = env({ EXTRA_ORIGINS: "https://staging.lomonec.com" }); const r = await send(e, { name: "app_open" }, { origin: "https://staging.lomonec.com" });
  ok("EXTRA_ORIGINS (staging var) admits the staging origin", r.status === 204 && e.writes.length === 1); }
{ const e = env(); const r = await send(e, { name: "app_open" }, { origin: "https://staging.lomonec.com" });
  ok("…and without the var (production) the staging origin is refused", r.status === 403 && e.writes.length === 0); }
{ const e = env(); const r = await send(e, "not json"); ok("a non-JSON body → 204, nothing written", r.status === 204 && e.writes.length === 0); }
{ const e = env(); const r = await send(e, ""); ok("an empty body → 204, nothing written", r.status === 204 && e.writes.length === 0); }
{ const e = env(); const r = await send(e, { name: "app_open", props: { streak: "3" } });
  ok("a valid event → 204 and exactly one data point: index = name, doubles = [1]", r.status === 204 && e.writes.length === 1 && row(e).indexes[0] === "app_open" && row(e).doubles.length === 1 && row(e).doubles[0] === 1); }
{ const e = env(); await send(e, { name: "app_open", props: {} }); await send(e, { name: "app_open", props: {} });
  ok("the Worker deduplicates nothing — two identical posts are two counts (idempotency lives in the client)", e.writes.length === 2); }
{ const e = env(); const long = JSON.stringify({ name: "app_open", props: { streak: "x".repeat(MAX_BODY) } });
  const r = await send(e, long); ok(`a body over ${MAX_BODY} bytes is cut, fails to parse, and writes nothing`, r.status === 204 && e.writes.length === 0 && long.length > MAX_BODY); }
{ const e = env(); await send(e, { name: "app_open", props: { streak: "1" } });
  ok("blob1 = name, blob2 = country ('??' outside Cloudflare), then one blob per PROP_KEY — no more, no fewer", row(e).blobs[0] === "app_open" && row(e).blobs[1] === "??" && row(e).blobs.length === 2 + KEYS.length, String(row(e).blobs.length)); }

/* ── 2 · existing events are untouched by the V2 additions ─────────────── */
console.log("\n2 · EXISTING EVENTS (unchanged columns)");
{ const e = env(); await send(e, { name: "app_open", props: { installed: "yes", onboarded: "1", stage: "7-27", lang: "fr" } });
  const b = row(e).blobs; ok("app_open: installed=blob12, onboarded=blob13, stage=blob14, lang=blob7 — the README's map", b[11] === "yes" && b[12] === "1" && b[13] === "7-27" && b[6] === "fr"); }
{ const e = env(); await send(e, { name: "session_complete", props: { week: "4", day: "Mon" } });
  const b = row(e).blobs; ok("session_complete: week=blob4, day=blob5", b[3] === "4" && b[4] === "Mon"); }
{ const e = env(); await send(e, { name: "return_open", props: { gap: "1-3d" } }); ok("return_open: gap=blob16", row(e).blobs[15] === "1-3d"); }
{ const e = env(); await send(e, { name: "partner_interest", props: { track: "welding", stage: "w1-4" } });
  ok("partner_interest: track=blob17 (Welding may say welding here — this event is not V2)", row(e).blobs[16] === "welding"); }
{ const e = env(); await send(e, { name: "partner_candidate_shown", props: { n: "3" } }); ok("partner_candidate_shown: n=blob18", row(e).blobs[17] === "3"); }
{ const e = env(); await send(e, { name: "shadow_challenge_rung", props: { rung: "blind", reason: "up" } });
  ok("shadow_challenge_rung: rung=blob28, reason=blob26", row(e).blobs[27] === "blind" && row(e).blobs[25] === "up"); }
ok("the first 26 prop keys are the same, in the same order, as on origin/main — no column shifted",
  KEYS.slice(0, 26).join() === "streak,week,day,source,lang,result,module,trade,band,installed,onboarded,stage,kind,gap,track,n,round,now,regular,state,level,mode,to,reason,evidence,rung");
{ const e = env(); const r = await send(e, { name: "made_up_event", props: { week: "1" } }); ok("an unknown event name → 204, nothing written (rejection is indistinguishable from acceptance)", r.status === 204 && e.writes.length === 0); }

/* ── 3 · the V2 contract, from the client's actual call sites ──────────── */
console.log("\n3 · V2 CLIENT ↔ WORKER CONTRACT");
const V2 = EVENTS.filter(n => n.startsWith("v2_"));
ok("the allow-list carries eleven v2_* names", V2.length === 11, V2.join());
ok("the six V2 prop keys are appended at the very end of PROP_KEYS (blob29–blob34)",
  KEYS.slice(-6).join() === "competency,mission,move,attempt,ai,from" && col("competency") === 28 && col("from") === 33);

/* every mvTrack(...) call in index.html, with the names and prop keys it passes */
function calls(src) {
  const out = []; let i = 0;
  while ((i = src.indexOf("mvTrack(", i)) >= 0) {
    if (src.slice(i - 9, i) === "function ") { i += 8; continue; }           // the definition, not a call
    let j = i + 8, d = 1; while (j < src.length && d > 0) { const c = src[j]; if (c === "(") d++; else if (c === ")") d--; j++; }
    const args = src.slice(i + 8, j - 1);
    const names = [...args.matchAll(/"(v2_[a-z_]+)"/g)].map(m => m[1]);
    const o = args.indexOf("{"); let k = o, dd = 0; if (o >= 0) { do { if (args[k] === "{") dd++; else if (args[k] === "}") dd--; k++; } while (k < args.length && dd > 0); }
    const obj = o >= 0 ? args.slice(o, k) : "";
    const keys = [...obj.matchAll(/(?:^|[{,])\s*([a-z]+)\s*:/g)].map(m => m[1]);
    out.push({ line: src.slice(0, i).split("\n").length, args, names, keys, obj });
    i = j;
  }
  return out.filter(c => c.names.length);
}
const SITES = calls(APP);
const usedNames = [...new Set(SITES.flatMap(s => s.names))];
const usedKeys = [...new Set(SITES.flatMap(s => s.keys))];
const IMPLICIT = ["track", "week", "competency"];                          // added by mvTrack itself
ok("mvTrack() itself stamps track, week and competency on every V2 event",
  /track:AREA_GEN,week:String\(c\.week\|\|""\),competency:c\.id/.test(APP.match(/function mvTrack[\s\S]*?\n}/)[0]));
ok("mvTrack() refuses to emit off General English, and refuses with no competency in hand",
  /function mvTrack[\s\S]*?if\(!isGeneralEnglish\(\)\)return;[\s\S]*?if\(!c\)return;/.test(APP));
ok(`every v2_* name the client sends is allow-listed (${usedNames.length} names at ${SITES.length} call sites)`,
  usedNames.length > 0 && usedNames.every(n => EVENTS.includes(n)), usedNames.filter(n => !EVENTS.includes(n)).join());
ok("every allow-listed v2_* name is actually sent by the client — nothing dead on the list", V2.every(n => usedNames.includes(n)), V2.filter(n => !usedNames.includes(n)).join());
ok(`every prop key the client attaches is on PROP_KEYS (${usedKeys.join(", ")})`,
  usedKeys.every(k => KEYS.includes(k)), usedKeys.filter(k => !KEYS.includes(k)).join());
ok("no V2 call site passes anything that could be a transcript, a name, an email, audio or the profile",
  SITES.every(s => !/said|transcript|heard|email|profile|audio|blob|uid|name\s*:|\.name\b/.test(s.obj)), SITES.filter(s => /said|transcript|heard|email|profile|audio|uid/.test(s.obj)).map(s => s.line).join());

console.log("\n   | event | client line | props sent | accepted |");
for (const s of SITES) for (const n of s.names) console.log(`   | ${n} | index.html:${s.line} | ${[...IMPLICIT, ...s.keys].join(", ")} | ${EVENTS.includes(n) && s.keys.every(k => KEYS.includes(k)) ? "yes" : "NO"} |`);

/* now send each one exactly as the client would, and read the columns back */
const SAMPLE = {
  v2_mission_started: { mission: "raise-problem-guided", kind: "guided" },
  v2_mission_heard: { mission: "raise-problem-guided" },
  v2_speak_attempt: { mission: "raise-problem-guided", kind: "guided" },
  v2_transfer_started: { mission: "raise-problem-transfer", kind: "transfer" },
  v2_coach_generated: { mission: "raise-problem-guided", kind: "guided", move: "ask", ai: "1" },
  v2_evidence_recorded: { mission: "raise-problem-guided", kind: "guided", result: "fail", move: "ask", attempt: "1" },
  v2_retry_attempt: { mission: "raise-problem-guided", move: "ask" },
  v2_transfer_completed: { mission: "raise-problem-transfer", result: "pass" },
  v2_competency_progressed: { state: "DEMONSTRATED", from: "PRACTICING" },
  v2_retrieval_scheduled: { state: "TRANSFER_READY" },
  v2_recommendation_generated: { result: "transfer", move: "none", state: "DEMONSTRATED" },
};
for (const n of V2) {
  const e = env(); const props = { track: GE, week: "3", competency: "raise-problem", ...SAMPLE[n] };
  const r = await send(e, { name: n, props });
  const b = r.writes.length ? row(e).blobs : [];
  const placed = Object.entries(props).every(([k, v]) => b[col(k)] === String(v));
  ok(`${n}: accepted, and every prop sits in its own column (track=blob17, week=blob4, competency=blob29 …)`,
    r.status === 204 && r.writes.length === 1 && b[0] === n && placed,
    JSON.stringify(Object.fromEntries(Object.keys(props).map(k => [k, b[col(k)]]))));
}
{ const e = env(); await send(e, { name: "v2_mission_started", props: { track: GE, week: 3, competency: "raise-problem", mission: "raise-problem-guided" } });
  ok("a numeric week arrives as the string '3'", row(e).blobs[col("week")] === "3"); }
{ const e = env(); await send(e, { name: "v2_evidence_recorded", props: { track: GE, week: "3", competency: "raise-problem", attempt: 2, result: "pass" } });
  ok("attempt is a count, stored as its digits", row(e).blobs[col("attempt")] === "2" && row(e).blobs[col("result")] === "pass"); }

/* ── 4 · what cannot get through ───────────────────────────────────────── */
console.log("\n4 · PRIVACY AND ABUSE");
{ const e = env(); const r = await send(e, { name: "v2_made_up", props: { track: GE, week: "3" } });
  ok("an unknown v2_* name is dropped — 204, nothing written", r.status === 204 && e.writes.length === 0); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { track: GE, week: "3", competency: "raise-problem", transcript: "We have a problem with the delivery", said: "x", name: "Alex", email: "a@b.c", uid: "u1" } });
  const j = JSON.stringify(row(e).blobs);
  ok("unknown keys — transcript, said, name, email, uid — never reach a column; the row is the same width", !/problem with|Alex|a@b|u1|"x"/.test(j) && row(e).blobs.length === 2 + KEYS.length, j); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { track: GE, competency: "a".repeat(60) } });
  ok(`an over-long value is cut to ${MAX_VAL} characters`, row(e).blobs[col("competency")] === "a".repeat(MAX_VAL)); }
{ const e = env(); await send(e, { name: "v2_coach_generated", props: { track: GE, move: "I have a problem with my boss, he said" } });
  const v = row(e).blobs[col("move")];
  ok(`free text under an allowed key survives only as ≤${MAX_VAL} squashed characters (spaces and punctuation stripped) — the reason keys are enums`, v.length <= MAX_VAL && !/\s/.test(v) && v === "Ihaveaproblemwithmyboss,".replace(",", "").slice(0, MAX_VAL) || (v.length <= MAX_VAL && !/[\s,]/.test(v)), v); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { track: "general english!", competency: "<script>", move: "ask;drop" } });
  const b = row(e).blobs; ok("values are reduced to [A-Za-z0-9_.:-] — no spaces, tags or separators", b[col("track")] === "generalenglish" && b[col("competency")] === "script" && b[col("move")] === "askdrop"); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { track: GE, week: null, competency: undefined, move: false } });
  const b = row(e).blobs; ok("null/undefined → empty column; a boolean is stored as its word (never as a number)", b[col("week")] === "" && b[col("competency")] === "" && b[col("move")] === "false"); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: "not-an-object" });
  ok("a non-object props field is treated as no props", row(e).blobs.slice(2).every(x => x === "")); }
{ const e = env(); await send(e, { name: "v2_speak_attempt" }); ok("no props at all → a valid, empty-columned count", e.writes.length === 1); }

/* ── 5 · track isolation, as the Worker actually enforces it ───────────── */
console.log("\n5 · TRACK ISOLATION (documented behaviour)");
{ const e = env(); const r = await send(e, { name: "v2_speak_attempt", props: { track: "welding", week: "3", competency: "raise-problem" } });
  ok("the Worker does NOT validate track: a v2_* event stamped welding is stored as sent — the guard is mvTrack() in the client, not this file",
    r.status === 204 && e.writes.length === 1 && row(e).blobs[col("track")] === "welding"); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { week: "3", competency: "raise-problem" } });
  ok("a v2_* event with no track is stored with an empty track column", row(e).blobs[col("track")] === ""); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { track: GE, week: "not-a-week", competency: "raise-problem" } });
  ok("the Worker does NOT validate week: an unexpected value is stored as sent (cleaned)", row(e).blobs[col("week")] === "not-a-week"); }
ok("so a forged beacon can add a mislabeled COUNT, never content: every column is an allow-listed enum of ≤24 cleaned characters", MAX_VAL === 24 && KEYS.every(k => /^[a-z_]+$/.test(k)));

/* ── summary ───────────────────────────────────────────────────────────── */
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
