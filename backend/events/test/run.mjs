/* be-events Worker — contract tests, pure Node.
   Run:  cd backend/events && node test/run.mjs
   No wrangler, no Cloudflare, no network. The Worker's default export is
   called directly with a fake Analytics Engine binding that records every
   writeDataPoint, so each check below is a statement about what a real
   request would put into the dataset — and, just as important, what it
   would NOT.

   Four questions, in order:
     1. does the transport behave as documented (CORS, methods, origins,
        body cap, allow-list, 204-for-everything)?
     2. is every row within Analytics Engine's 20-blob limit, and are the
        legacy columns blob3..blob20 exactly what they were before the
        19 Sept 2026 outage (see the ROW LAYOUT note in events-worker.js)?
     3. does every V2 event the client actually sends land, with every prop
        in the column README.md says, and nothing else beside it?
     4. can anything personal get through — a transcript, a name, an email,
        an unknown key, a long value, a wrong track?

   The client side of the contract is checked against index.html itself:
   every mvTrack() call site is parsed, so a v2_* name or a prop key added
   in the app without being allow-listed here fails this file, not silently
   in production. */
import worker, { AE_MAX_BLOBS, MAX_COLS, LEGACY as LEGACY_X, LAYOUTS, layoutFor } from "../events-worker.js";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../events-worker.js", import.meta.url), "utf8");
const APP = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const EVENTS = [...SRC.match(/const EVENTS = new Set\(\[([\s\S]*?)\]\);/)[1].matchAll(/"([a-z0-9_]+)"/g)].map(m => m[1]);
const KEYS = [...SRC.match(/const PROP_KEYS = new Set\(\[([\s\S]*?)\]\);/)[1].matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
const MAX_VAL = +SRC.match(/const MAX_VAL\s*=\s*(\d+)/)[1];
const MAX_BODY = +SRC.match(/const MAX_BODY\s*=\s*(\d+)/)[1];
const AE_MAX = +SRC.match(/const AE_MAX_BLOBS\s*=\s*(\d+)/)[1];
const LEGACY = KEYS.slice(0, AE_MAX - 2);
const V2MAP = [...SRC.match(/\[\/\^v2_\/, \[([^\]]*)\]\]/)[1].matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
const lcol = k => LEGACY.indexOf(k) + 2;          // blobs[] index for a legacy event; blob number is +1
const vcol = k => V2MAP.indexOf(k) + 2;           // blobs[] index for a v2_* event
const GE = "general-english", ORIGIN = "https://app.lomonec.com";
const URL_ = "https://be-events.nore-ngou.workers.dev/e";

const res = [];
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };

/* The fake binding applies workerd's own rule (analytics-engine-impl.h:
   JSG_REQUIRE(arr.size() <= 20, TypeError, "Maximum of 20 blobs supported."),
   and one index only), so every check in this file runs against the limit
   that took production down — a row over 20 blobs is refused here exactly as
   it is at the edge, instead of being quietly recorded by a permissive stub.
   (wrangler dev's local Analytics Engine does NOT enforce it — verified
   2026-09-23 — which is why this file, and staging, are the tests.) */
function env(vars) { const writes = [], refused = []; return { env: { AE: { writeDataPoint(p) {
  if ((p.blobs || []).length > 20) { refused.push(p); throw new TypeError("Maximum of 20 blobs supported."); }
  if ((p.indexes || []).length > 1) { refused.push(p); throw new TypeError("Maximum of 1 index supported."); }
  writes.push(p); } }, ...(vars || {}) }, writes, refused }; }
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
{ const e = env(); const r = await send(e, { name: "made_up_event", props: { week: "1" } }); ok("an unknown event name → 204, nothing written (rejection is indistinguishable from acceptance)", r.status === 204 && e.writes.length === 0); }

/* ── 2 · the 20-blob limit and the legacy columns ──────────────────────── */
console.log("\n2 · ROW LAYOUT — the Analytics Engine limit, and the columns that existed before 19 Sept 2026");
ok(`the Worker states the limit workerd enforces: ${AE_MAX} blobs per data point`, AE_MAX === 20);
ok("PROP_KEYS is still the allow-list of readable keys — 32 keys, first 26 identical and in order to origin/main",
  KEYS.length === 32 && KEYS.slice(0, 26).join() === "streak,week,day,source,lang,result,module,trade,band,installed,onboarded,stage,kind,gap,track,n,round,now,regular,state,level,mode,to,reason,evidence,rung");
ok("the legacy row is the first 18 keys — blob3 streak … blob20 now — exactly the columns that ever existed",
  LEGACY.join() === "streak,week,day,source,lang,result,module,trade,band,installed,onboarded,stage,kind,gap,track,n,round,now" && LEGACY.length === 18);
{ const all = {}; for (const k of KEYS) all[k] = "x";
  let worst = 0, bad = [];
  for (const n of EVENTS) { const e = env(); await send(e, { name: n, props: all }); const len = row(e).blobs.length; worst = Math.max(worst, len); if (len > AE_MAX) bad.push(n); }
  ok(`no data point for any of the ${EVENTS.length} allow-listed names exceeds ${AE_MAX} blobs, even with every key sent (worst ${worst})`, bad.length === 0 && worst <= AE_MAX, bad.join()); }
{ const e = env(); await send(e, { name: "app_open", props: { streak: "1" } });
  ok("a legacy row is blob1 = name, blob2 = country ('??' outside Cloudflare), then 18 columns — 20 blobs, never 28", row(e).blobs[0] === "app_open" && row(e).blobs[1] === "??" && row(e).blobs.length === 20, String(row(e).blobs.length)); }
{ const e = env(); await send(e, { name: "app_open", props: { installed: "yes", onboarded: "1", stage: "7-27", lang: "fr" } });
  const b = row(e).blobs; ok("app_open: installed=blob12, onboarded=blob13, stage=blob14, lang=blob7 — the README's map", b[11] === "yes" && b[12] === "1" && b[13] === "7-27" && b[6] === "fr"); }
{ const e = env(); await send(e, { name: "session_complete", props: { week: "4", day: "Mon" } });
  const b = row(e).blobs; ok("session_complete: week=blob4, day=blob5 (./query.sh weeks)", b[3] === "4" && b[4] === "Mon"); }
{ const e = env(); await send(e, { name: "return_open", props: { gap: "1-3d" } }); ok("return_open: gap=blob16 (./query.sh returns)", row(e).blobs[15] === "1-3d"); }
{ const e = env(); await send(e, { name: "partner_interest", props: { track: "welding", stage: "w1-4" } });
  ok("partner_interest: track=blob17, stage=blob14 (./query.sh partner) — Welding may say welding here; this event is not V2", row(e).blobs[16] === "welding" && row(e).blobs[13] === "w1-4"); }
{ const e = env(); await send(e, { name: "partner_interest", props: { track: "welding", stage: "w1-4", n: "9" } });
  const b = row(e).blobs; ok("partner_interest stays on the legacy map (blob17 track, blob14 stage) — it is the one partner name a query already reads", b[16] === "welding" && b[13] === "w1-4" && b[17] === "9" && b.length === 20); }

/* ── 2a · partner_* and shadow_* family maps ───────────────────────────── */
console.log("\n2a · PARTNER AND SHADOW MAPS — every prop the client sends has a column; nothing historical is re-read");
const MAPS = Object.fromEntries([...SRC.matchAll(/\[\/(\^[^\/]+)\/, \[([^\]]*)\]\]/g)].map(m => [m[1], [...m[2].matchAll(/"([a-z_]+)"/g)].map(x => x[1])]));
const PMAP = MAPS["^partner_(?!interest$)"], SMAP = MAPS["^shadow_"];
const pcol = k => PMAP.indexOf(k) + 2, scol = k => SMAP.indexOf(k) + 2;
ok("the partner map is 10 allow-listed keys and the shadow map 9 (state + lang appended for the Translate / Pronunciation switches) — both under 18",
  PMAP && SMAP && PMAP.length === 10 && SMAP.length === 9 && [...PMAP, ...SMAP].every(k => KEYS.includes(k)), JSON.stringify([PMAP, SMAP]));
/* every track("partner_…"/"shadow_…", {literal}) call site in the app */
function siteKeys(prefix) {
  const out = {}; const re = new RegExp('track\\(\\s*"(' + prefix + '[a-z0-9_]*)"\\s*,\\s*\\{', "g"); let m;
  while ((m = re.exec(APP))) { let k = m.index + m[0].length - 1, d = 0, j = k; do { if (APP[j] === "{") d++; else if (APP[j] === "}") d--; j++; } while (j < APP.length && d > 0);
    const keys = [...APP.slice(k, j).matchAll(/(?:^|[{,])\s*([a-z]+)\s*:/g)].map(x => x[1]); (out[m[1]] = out[m[1]] || new Set()); keys.forEach(x => out[m[1]].add(x)); }
  return out;
}
const PS = siteKeys("partner_"), SS = siteKeys("shadow_");
const pk = [...new Set(Object.entries(PS).filter(([n]) => n !== "partner_interest").flatMap(([, s]) => [...s]))];
const sk = [...new Set(Object.values(SS).flatMap(s => [...s]))];
ok(`every prop any partner_* call site sends (${pk.join(", ")}) has a column in the partner map`, pk.length > 0 && pk.every(k => PMAP.includes(k)), pk.filter(k => !PMAP.includes(k)).join());
ok(`every prop any shadow_* call site sends (${sk.join(", ")}) has a column in the shadow map`, sk.length > 0 && sk.every(k => SMAP.includes(k)), sk.filter(k => !SMAP.includes(k)).join());
{ const e = env(); await send(e, { name: "partner_connection_created", props: { state: "mutual" } }); const b = row(e).blobs;
  ok("partner_connection_created: state → blob8 (it had no column at all before)", b[pcol("state")] === "mutual" && b.length === 2 + PMAP.length); }
{ const e = env(); await send(e, { name: "partner_trial_started", props: { regular: "1" } }); ok("partner_trial_started: regular → blob7", row(e).blobs[pcol("regular")] === "1"); }
{ const e = env(); await send(e, { name: "partner_review_ready", props: { evidence: "asr" } }); ok("partner_review_ready: evidence → blob10", row(e).blobs[pcol("evidence")] === "asr"); }
{ const e = env(); await send(e, { name: "partner_live_failed", props: { reason: "mic" } }); ok("partner_live_failed: reason → blob9", row(e).blobs[pcol("reason")] === "mic"); }
{ const e = env(); await send(e, { name: "partner_candidate_shown", props: { n: "3", round: "2", now: "1", kind: "waiting" } }); const b = row(e).blobs;
  ok("partner phase-2: kind → blob3, round → blob4, n → blob5, now → blob6", b[pcol("kind")] === "waiting" && b[pcol("round")] === "2" && b[pcol("n")] === "3" && b[pcol("now")] === "1"); }
{ const e = env(); await send(e, { name: "shadow_challenge_rung", props: { rung: "blind", reason: "up" } }); const b = row(e).blobs;
  ok("shadow_challenge_rung: rung → blob6, reason → blob7 (both had no column before)", b[scol("rung")] === "blind" && b[scol("reason")] === "up" && b.length === 2 + SMAP.length); }
{ const e = env(); await send(e, { name: "shadow_challenge_feedback_received", props: { level: "guided", rung: "gate", result: "pass" } }); const b = row(e).blobs;
  ok("shadow_challenge_feedback_received: level → blob3, rung → blob6, result → blob8", b[scol("level")] === "guided" && b[scol("rung")] === "gate" && b[scol("result")] === "pass"); }
{ const e = env(); await send(e, { name: "shadow_apply_phrase", props: { to: "partner" } }); ok("shadow_apply_phrase: to → blob5", row(e).blobs[scol("to")] === "partner"); }
{ const e = env(); await send(e, { name: "shadow_challenge_drill", props: { kind: "chorus", installed: "yes" } }); const b = row(e).blobs;
  ok("shadow_challenge_drill: kind → blob9; a legacy-only key (installed) is dropped from a shadow row", b[scol("kind")] === "chorus" && !b.includes("yes")); }

/* ── 2b · THE INVARIANT, as architecture ───────────────────────────────── */
console.log("\n2b · THE 20-BLOB INVARIANT — every family's maximum payload, and the guard itself");
ok("exports agree with the source: AE_MAX_BLOBS 20, MAX_COLS 18, LEGACY is exactly the first 18 keys", AE_MAX_BLOBS === 20 && MAX_COLS === 18 && LEGACY_X.join() === LEGACY.join());
ok("every declared layout fits without the guard ever cutting it (so the guard is a guard, not a behaviour)",
  LAYOUTS.every(([, keys]) => keys.length <= MAX_COLS) && LEGACY_X.length === MAX_COLS, LAYOUTS.map(([re, k]) => re + ":" + k.length).join());
ok("layoutFor() is deterministic and total: v2_* → V2 map, partner_* → partner map (partner_interest excepted), shadow_* → shadow map, anything else → LEGACY",
  layoutFor("v2_mission_started").join() === V2MAP.join() && layoutFor("partner_turn_sent").join() === PMAP.join() && layoutFor("partner_interest").join() === LEGACY.join()
  && layoutFor("shadow_challenge_rung").join() === SMAP.join() && layoutFor("app_open").join() === LEGACY.join() && layoutFor("").join() === LEGACY.join());
{ LAYOUTS.push([/^zz_review_/, Array.from({ length: 30 }, (_, i) => "k" + i)]);
  const cut = layoutFor("zz_review_probe").length; LAYOUTS.pop();
  ok("a hypothetical 30-key layout is capped at 18 columns by the code itself — the row can never exceed 20 blobs", cut === MAX_COLS && layoutFor("zz_review_probe").join() === LEGACY.join(), String(cut)); }
/* Every allow-listed key at once, plus junk. Values are single characters on
   purpose: the body cap is 512 bytes and a 40-key beacon with real values is
   over it — which is the cap working, not the layout. Each payload's size is
   asserted, so this section measures the row and never the cap. */
const ALLK = Object.fromEntries(KEYS.map(k => [k, "x"]));
const JUNK = { junk1: "y", junk2: "y", said: "z" };
const MAXP = {
  "legacy  ": ["app_open", { ...ALLK, ...JUNK }],
  "partner ": ["partner_trial_started", { ...ALLK, kind: "waiting", round: "4", n: "3", now: "1", regular: "1", state: "mutual", reason: "mic", evidence: "asr", result: "pass", ...JUNK }],
  "shadow  ": ["shadow_challenge_feedback_received", { ...ALLK, level: "guided", mode: "apply", to: "ai", result: "retry", kind: "chorus", rung: "retell", reason: "again", ...JUNK }],
  "V2, every key": ["v2_evidence_recorded", { ...ALLK, ...JUNK }],
  "V2, worst-case values": ["v2_evidence_recorded", { track: GE, week: "12", competency: "c".repeat(MAX_VAL), mission: "m".repeat(MAX_VAL), kind: "transfer", move: "mitigate", result: "fail", band: "partial", state: "TRANSFER_READY", from: "DEMONSTRATED", attempt: "60", ai: "1", ...JUNK }],
  "combined": ["session_complete", { ...ALLK, week: "12", day: "Sun", ...JUNK }],
};
for (const [fam, [name, props]] of Object.entries(MAXP)) {
  const bytes = JSON.stringify({ name, props }).length;
  const e = env(); const r = await send(e, { name, props });
  const len = e.writes.length ? row(e).blobs.length : -1;
  const expect = 2 + layoutFor(name).length;
  ok(`maximum ${fam.trim()} payload (${Object.keys(props).length} keys incl. junk, ${bytes} B ≤ ${MAX_BODY}) → written, ${len} blobs (≤ ${AE_MAX_BLOBS}), nothing refused`,
    bytes <= MAX_BODY && r.status === 204 && e.writes.length === 1 && e.refused.length === 0 && len === expect && len <= AE_MAX_BLOBS, `bytes=${bytes} len=${len} refused=${e.refused.length}`);
}
{ const e = env(); const oldRow = ["app_open", "??", ...KEYS.map(() => "")];
  let threw = null; try { e.env.AE.writeDataPoint({ indexes: ["app_open"], blobs: oldRow, doubles: [1] }); } catch (x) { threw = x; }
  ok(`the row the OLD Worker built — 2 + ${KEYS.length} = ${oldRow.length} blobs — is refused by the same rule (the root cause, reproduced)`, threw instanceof TypeError && /20 blobs/.test(threw.message) && e.writes.length === 0, String(threw)); }

/* ── 2c · FAILURE HANDLING ─────────────────────────────────────────────── */
console.log("\n2c · FAILURE HANDLING — the client keeps its 204; the operator now hears about it");
{ const e = env(); e.env.AE = { writeDataPoint() { throw new TypeError("Maximum of 20 blobs supported."); } };
  const orig = console.error; const logged = []; console.error = (...a) => logged.push(a.map(String).join(" "));
  const r = await send(e, { name: "app_open", props: { installed: "yes" } }); console.error = orig;
  ok("when the binding throws, the response is still 204 and nothing else changes for the client", r.status === 204 && r.h["access-control-allow-origin"] === ORIGIN);
  ok("…and the failure is logged once, with the event name, the error and the blob count — never a prop value",
    logged.length === 1 && /writeDataPoint failed for app_open/.test(logged[0]) && /TypeError/.test(logged[0]) && /Maximum of 20 blobs/.test(logged[0]) && /blobs: 20/.test(logged[0]) && !/yes/.test(logged[0]), logged.join(" | ")); }
{ const e = env(); const orig = console.error; let n = 0; console.error = () => { n++; };
  await send(e, { name: "app_open", props: { installed: "yes" } }); console.error = orig;
  ok("a successful write logs nothing — no noise on the happy path", n === 0 && e.writes.length === 1); }

/* ── 3 · the V2 contract, from the client's actual call sites ──────────── */
console.log("\n3 · V2 CLIENT ↔ WORKER CONTRACT");
const V2 = EVENTS.filter(n => n.startsWith("v2_"));
ok("the allow-list carries eleven v2_* names", V2.length === 11, V2.join());
ok("the six V2 prop keys are allow-listed (appended last on PROP_KEYS)", KEYS.slice(-6).join() === "competency,mission,move,attempt,ai,from");
ok("the V2 family map is 12 keys — blob3 track … blob14 ai — every one of them an allow-listed key",
  V2MAP.join() === "track,week,competency,mission,kind,move,result,band,state,from,attempt,ai" && V2MAP.every(k => KEYS.includes(k)));

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
ok(`every prop key the client attaches is on PROP_KEYS (${usedKeys.join(", ")})`, usedKeys.every(k => KEYS.includes(k)), usedKeys.filter(k => !KEYS.includes(k)).join());
ok("…and every one of them has a column in the V2 map — nothing the client sends is silently dropped",
  [...IMPLICIT, ...usedKeys].every(k => V2MAP.includes(k)), [...IMPLICIT, ...usedKeys].filter(k => !V2MAP.includes(k)).join());
ok("no V2 call site passes anything that could be a transcript, a name, an email, audio or the profile",
  SITES.every(s => !/said|transcript|heard|email|profile|audio|blob|uid|name\s*:|\.name\b/.test(s.obj)), SITES.filter(s => /said|transcript|heard|email|profile|audio|uid/.test(s.obj)).map(s => s.line).join());

console.log("\n   | event | client line | props sent | accepted |");
for (const s of SITES) for (const n of s.names) console.log(`   | ${n} | index.html:${s.line} | ${[...IMPLICIT, ...s.keys].join(", ")} | ${EVENTS.includes(n) && [...IMPLICIT, ...s.keys].every(k => V2MAP.includes(k)) ? "yes" : "NO"} |`);

/* now send each one exactly as the client would, and read the columns back */
const SAMPLE = {
  v2_mission_started: { mission: "raise-problem-guided", kind: "guided" },
  v2_mission_heard: { mission: "raise-problem-guided" },
  v2_speak_attempt: { mission: "raise-problem-guided", kind: "guided" },
  v2_transfer_started: { mission: "raise-problem-transfer", kind: "transfer" },
  v2_coach_generated: { mission: "raise-problem-guided", kind: "guided", move: "ask", ai: "1" },
  v2_evidence_recorded: { mission: "raise-problem-guided", kind: "guided", result: "fail", band: "strong", move: "ask", attempt: "1" },
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
  const placed = Object.entries(props).every(([k, v]) => b[vcol(k)] === String(v));
  ok(`${n}: accepted; ${Object.keys(props).length} props, each in its V2 column (track=blob3, week=blob4, competency=blob5 …); ${2 + V2MAP.length} blobs`,
    r.status === 204 && r.writes.length === 1 && b[0] === n && b.length === 2 + V2MAP.length && placed,
    JSON.stringify(Object.fromEntries(Object.keys(props).map(k => [k, b[vcol(k)]]))));
}
{ const e = env(); await send(e, { name: "v2_mission_started", props: { track: GE, week: 3, competency: "raise-problem", mission: "raise-problem-guided" } });
  ok("a numeric week arrives as the string '3'", row(e).blobs[vcol("week")] === "3"); }
{ const e = env(); await send(e, { name: "v2_evidence_recorded", props: { track: GE, week: "3", competency: "raise-problem", attempt: 2, result: "pass" } });
  ok("attempt is a count, stored as its digits", row(e).blobs[vcol("attempt")] === "2" && row(e).blobs[vcol("result")] === "pass"); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { track: GE, week: "3", competency: "raise-problem", installed: "yes", streak: "9", rung: "blind" } });
  const b = row(e).blobs; ok("a V2 row never carries legacy-only keys (installed, streak, rung) — allow-listed keys outside the family map are dropped", !b.includes("yes") && !b.includes("9") && !b.includes("blind")); }
ok("the V2 verification queries in query.sh read the columns the map defines (blob4 week, blob5 competency, blob8 move, blob9 result)",
  vcol("week") === 3 && vcol("competency") === 4 && vcol("move") === 7 && vcol("result") === 8);

/* ── 4 · what cannot get through ───────────────────────────────────────── */
console.log("\n4 · PRIVACY AND ABUSE");
{ const e = env(); const r = await send(e, { name: "v2_made_up", props: { track: GE, week: "3" } });
  ok("an unknown v2_* name is dropped — 204, nothing written", r.status === 204 && e.writes.length === 0); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { track: GE, week: "3", competency: "raise-problem", transcript: "We have a problem with the delivery", said: "x", name: "Alex", email: "a@b.c", uid: "u1" } });
  const j = JSON.stringify(row(e).blobs);
  ok("unknown keys — transcript, said, name, email, uid — never reach a column; the row is the same width", !/problem with|Alex|a@b|u1|"x"/.test(j) && row(e).blobs.length === 2 + V2MAP.length, j); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { track: GE, competency: "a".repeat(60) } });
  ok(`an over-long value is cut to ${MAX_VAL} characters`, row(e).blobs[vcol("competency")] === "a".repeat(MAX_VAL)); }
{ const e = env(); await send(e, { name: "v2_coach_generated", props: { track: GE, move: "I have a problem with my boss, he said" } });
  const v = row(e).blobs[vcol("move")];
  ok(`free text under an allowed key survives only as ≤${MAX_VAL} squashed characters (spaces and punctuation stripped) — the reason keys are enums`, v.length <= MAX_VAL && !/[\s,]/.test(v), v); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { track: "general english!", competency: "<script>", move: "ask;drop" } });
  const b = row(e).blobs; ok("values are reduced to [A-Za-z0-9_.:-] — no spaces, tags or separators", b[vcol("track")] === "generalenglish" && b[vcol("competency")] === "script" && b[vcol("move")] === "askdrop"); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { track: GE, week: null, competency: undefined, move: false } });
  const b = row(e).blobs; ok("null/undefined → empty column; a boolean is stored as its word (never as a number)", b[vcol("week")] === "" && b[vcol("competency")] === "" && b[vcol("move")] === "false"); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: "not-an-object" }); ok("a non-object props field is treated as no props", row(e).blobs.slice(2).every(x => x === "")); }
{ const e = env(); await send(e, { name: "v2_speak_attempt" }); ok("no props at all → a valid, empty-columned count", e.writes.length === 1); }

/* ── 5 · track isolation, as the Worker actually enforces it ───────────── */
console.log("\n5 · TRACK ISOLATION (documented behaviour)");
{ const e = env(); const r = await send(e, { name: "v2_speak_attempt", props: { track: "welding", week: "3", competency: "raise-problem" } });
  ok("the Worker does NOT validate track: a v2_* event stamped welding is stored as sent — the guard is mvTrack() in the client, not this file",
    r.status === 204 && e.writes.length === 1 && row(e).blobs[vcol("track")] === "welding"); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { week: "3", competency: "raise-problem" } });
  ok("a v2_* event with no track is stored with an empty track column", row(e).blobs[vcol("track")] === ""); }
{ const e = env(); await send(e, { name: "v2_speak_attempt", props: { track: GE, week: "not-a-week", competency: "raise-problem" } });
  ok("the Worker does NOT validate week: an unexpected value is stored as sent (cleaned)", row(e).blobs[vcol("week")] === "not-a-week"); }
ok("so a forged beacon can add a mislabeled COUNT, never content: every column is an allow-listed enum of ≤24 cleaned characters", MAX_VAL === 24 && KEYS.every(k => /^[a-z_]+$/.test(k)));

/* ── summary ───────────────────────────────────────────────────────────── */
const bad = res.filter(r => !r.pass);
console.log(`\n${res.length - bad.length}/${res.length} passed`);
if (bad.length) { console.log("FAILED:"); bad.forEach(b => console.log("  - " + b.name)); process.exit(1); }
