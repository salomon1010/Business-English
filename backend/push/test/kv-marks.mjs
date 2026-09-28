/* be-push — the KV LIST budget (marker keys), in process.
   Run: node backend/push/test/kv-marks.mjs
   The Worker's real routes and crons against an in-memory KV that behaves like
   Workers KV where it matters here: LIST pages (limit, cursor), TTLs, and LIST
   lag — a key younger than LAG_MS is not listed yet, the way a new key takes
   up to a minute to show in a LIST. Every operation is counted, so the suite
   can say how many LISTs a day costs. A stand-in push service and partner
   Worker answer the network. Each scenario imports a fresh copy of the Worker
   (its isolate-level cache must not leak between namespaces). */
import { webcrypto } from "node:crypto";
const LOG = console.log.bind(console);
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); LOG(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 300)}`); };
const MIN = 60_000, H = 60 * MIN, D = 24 * H, LAG_MS = 60_000, ORIGIN = "https://app.lomonec.com";

/* ---- the clock: Date.now() drives the routes, the KV and the crons alike */
let clock = Date.UTC(2026, 9, 1, 0, 0, 0);
Date.now = () => clock;
const at = (day, hh, mm) => Date.UTC(2026, 9, 1 + day, hh, mm, 0);

/* ---- Workers KV, faithfully enough */
function makeKV() {
  const m = new Map(), ops = { get: 0, put: 0, delete: 0, list: 0 }, listed = [];
  const live = k => { const v = m.get(k); return v && !(v.exp && v.exp <= clock) ? v : null; };
  return {
    ops, listed, m,
    async get(k, t) { ops.get++; const v = live(k); if (!v) return null; return t === "json" ? JSON.parse(v.v) : v.v; },
    async put(k, v, o = {}) { ops.put++; if (o.expirationTtl != null && o.expirationTtl < 60) throw new Error("expirationTtl < 60"); m.set(k, { v: String(v), exp: o.expirationTtl ? clock + o.expirationTtl * 1000 : 0, t: clock }); },
    async delete(k) { ops.delete++; m.delete(k); },
    async list({ prefix = "", cursor, limit = 1000 } = {}) {
      ops.list++; listed.push(prefix);
      const names = [...m.keys()].filter(k => k.startsWith(prefix) && live(k) && clock - m.get(k).t >= LAG_MS).sort();
      const from = cursor ? Number(cursor) : 0, page = names.slice(from, from + limit);
      const done = from + limit >= names.length;
      return { keys: page.map(name => ({ name })), list_complete: done, cursor: done ? undefined : String(from + limit) };
    },
  };
}

/* ---- network: push service (per-endpoint behaviour) + partner Worker */
let pushes = [], endpointMode = {}, partner = { online: 0, waiting: 0 }, partnerCalls = 0;
const PROGRAMME = { "tok-ge": "general-english" };
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === "http://partner.test/presence") { partnerCalls++; return new Response(JSON.stringify(partner)); }
  if (u === "http://partner.test/programme") { const m = /^Bearer (.+)$/.exec((init.headers && init.headers.authorization) || ""); return m && PROGRAMME[m[1]] ? new Response(JSON.stringify({ track: PROGRAMME[m[1]] })) : new Response("{}", { status: 401 }); }
  if (u.startsWith("https://push.test/")) { const id = u.slice(18), mode = endpointMode[id] || 201; if (mode === 201) pushes.push(id); return new Response("", { status: mode }); }
  return new Response("", { status: 599 });
};
const pk = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const JWK = JSON.stringify(await webcrypto.subtle.exportKey("jwk", pk.privateKey));
let n = 0;
async function fresh() {
  const mod = await import("../push-worker.js?s=" + (++n));
  const SUBS = makeKV();
  const env = { SUBS, PARTNER_API: "http://partner.test", PUSH_SECRET: "s".repeat(32), VAPID_PRIVATE_JWK: JWK, VAPID_PUBLIC_KEY: "x" };
  const call = async (path, body, token) => { const h = { origin: ORIGIN, "content-type": "application/json" }; if (token) h.authorization = "Bearer " + token;
    const r = await mod.default.fetch(new Request("https://be-push.test" + path, { method: "POST", headers: h, body: JSON.stringify(body) }), env, {}); return { status: r.status, json: await r.json().catch(() => null) }; };
  const sub = (id, slot, extra = {}) => call("/subscribe", { id, slot, endpoint: "https://push.test/" + id, tz: 0, ...extra });
  const slotOf = ms => { const d = new Date(ms); return String(d.getUTCHours()).padStart(2, "0") + String(d.getUTCMinutes()).padStart(2, "0"); };
  /* a whole day of the per-minute cron, as Cloudflare would run it */
  const day = async d => { const before = SUBS.ops.list; for (let i = 0; i < 1440; i++) { clock = at(d, 0, 0) + i * MIN; await mod.runCron(env, clock); } return SUBS.ops.list - before; };
  const migrate = async () => { let runs = 0; while ((await SUBS.get(mod.marksConfig().MIG_KEY)) !== "done" && runs < 50) { await mod.runCron(env, clock); clock += MIN; runs++; } return runs; };
  return { mod, env, SUBS, call, sub, slotOf, day, migrate };
}
const quiet = LOG; const mute = () => { console.log = () => {}; }, unmute = () => { console.log = quiet; };

console.log("\n# the switch: rows written before markers existed (production today)");
{
  const w = await fresh(); mute();
  clock = at(0, 8, 0);
  for (const id of ["legacy-a-0001", "legacy-b-0001"]) { await w.SUBS.put(`slot:0900:${id}`, JSON.stringify({ id, slot: "0900", endpoint: "https://push.test/" + id })); await w.SUBS.put(`sub:${id}`, JSON.stringify({ id, slot: "0900", endpoint: "https://push.test/" + id })); }
  await w.SUBS.put("pres:legacy-p-0001", JSON.stringify({ id: "legacy-p-0001", endpoint: "https://push.test/legacy-p-0001", tz: 0 }));
  await w.SUBS.put("sub:legacy-p-0001", JSON.stringify({ id: "legacy-p-0001", endpoint: "https://push.test/legacy-p-0001", presence: true, tz: 0 }));
  clock = at(0, 8, 58); pushes = [];
  await w.mod.runCron(w.env, clock);                                   // first run: migration page 1 + a normal LIST of 08:58
  ok("M1 · during the switch the cron still LISTs its minute as before (no reminder can be missed)", w.SUBS.listed.includes("slot:0858:"), JSON.stringify(w.SUBS.listed));
  clock = at(0, 9, 0);
  await w.mod.runCron(w.env, clock);
  ok("M2 · a legacy 09:00 reminder is delivered while the switch is still running", pushes.sort().join() === "legacy-a-0001,legacy-b-0001", pushes.join());
  const runs = await w.migrate();
  ok("M3 · the switch finishes in a few minutes (one page per run) and says done", (await w.SUBS.get(w.mod.marksConfig().MIG_KEY)) === "done" && runs <= 3, "runs " + runs);
  ok("M4 · every old row got its marker: mark:slot:0900 and mark:pres", !!(await w.SUBS.get("mark:slot:0900")) && !!(await w.SUBS.get("mark:pres")));
  pushes = []; const lists = await w.day(1);
  ok("M5 · the day after the switch: ONE LIST all day (the one booked minute), both reminders delivered", lists === 1 && pushes.sort().join() === "legacy-a-0001,legacy-b-0001", `lists ${lists}, pushes ${pushes.join()}`);
  unmute();
}

console.log("\n# a day of crons, measured");
{
  const w = await fresh(); mute(); clock = at(0, 0, 0); await w.migrate();
  let lists = await w.day(1);
  ok("C1 · nobody subscribed: 0 LISTs in 1,440 runs (was 1,440)", lists === 0, "lists " + lists);
  clock = at(1, 23, 0);
  for (let i = 0; i < 50; i++) await w.sub(`user-${String(i).padStart(3, "0")}-x`, ["0700", "0730", "0800", "1200", "1230", "1800", "1830", "1900", "1930", "2100"][i % 10]);
  pushes = []; lists = await w.day(2);
  ok("C2 · 50 learners over 10 reminder times: 10 LISTs a day, all 50 reminded once", lists === 10 && pushes.length === 50 && new Set(pushes).size === 50, `lists ${lists}, pushes ${pushes.length}`);
  ok("C3 · the cost of an empty minute is one GET, not a LIST (reads stay far under 100,000/day)", w.SUBS.ops.get < 100_000);
  unmute();
}

console.log("\n# subscribe, duplicates, moves, done, stale, retry");
{
  const w = await fresh(); mute(); clock = at(0, 6, 0); await w.migrate();
  clock = at(0, 17, 0);
  const p0 = w.SUBS.ops.put;
  await w.sub("dup-phone-01", "1830"); const p1 = w.SUBS.ops.put;
  await w.sub("dup-phone-01", "1830"); await w.sub("dup-phone-01", "1830"); const p3 = w.SUBS.ops.put;
  ok("S1 · the marker is written with the first subscribe", !!(await w.SUBS.get("mark:slot:1830")));
  ok("S2 · re-subscribing on every launch does not rewrite the marker within the hour (KV write budget)", (p1 - p0) === 3 && (p3 - p1) === 4, `first ${p1 - p0}, next two ${p3 - p1}`);
  ok("S3 · duplicate subscribe = one row", [...w.SUBS.m.keys()].filter(k => k.startsWith("slot:1830:")).length === 1);
  pushes = []; clock = at(0, 18, 30); await w.mod.runCron(w.env, clock);
  ok("S4 · the booked minute delivers once", pushes.join() === "dup-phone-01", pushes.join());
  clock = at(0, 19, 0); await w.sub("dup-phone-01", "0715");
  ok("S5 · moving the time removes the old row (the old marker stays until the empty-LIST rule retires it)", !w.SUBS.m.has("slot:1830:dup-phone-01") && w.SUBS.m.has("slot:0715:dup-phone-01") && !!(await w.SUBS.get("mark:slot:1830")));
  pushes = []; clock = at(1, 7, 15); await w.mod.runCron(w.env, clock);
  ok("S6 · the new time delivers the next day", pushes.join() === "dup-phone-01");
  let before = w.SUBS.ops.list; clock = at(1, 18, 30); await w.mod.runCron(w.env, clock);
  ok("S7 · the vacated 18:30: one LIST finds nothing; the marker (25.5 h old) is kept — younger than the 36 h grace", w.SUBS.ops.list - before === 1 && !!(await w.SUBS.get("mark:slot:1830")));
  clock = at(2, 18, 30); await w.mod.runCron(w.env, clock);
  ok("S8 · two days on (48 h > grace) the empty LIST retires the marker", !(await w.SUBS.get("mark:slot:1830")));
  before = w.SUBS.ops.list; clock = at(3, 18, 30); await w.mod.runCron(w.env, clock);
  ok("S9 · after that the vacated minute costs no LIST at all", w.SUBS.ops.list === before);
  /* done today: skipped, still no extra LIST */
  clock = at(3, 20, 0); await w.sub("done-phone-01", "2100"); await w.call("/done", { id: "done-phone-01" });
  pushes = []; clock = at(3, 21, 0); await w.mod.runCron(w.env, clock);
  ok("S10 · practised today → not woken (unchanged rule)", !pushes.includes("done-phone-01"));
  /* stale: the push service says 410 → every row of that phone goes */
  clock = at(3, 21, 30); await w.sub("gone-phone-01", "2200", { presence: true }); endpointMode["gone-phone-01"] = 410;
  clock = at(3, 22, 0); await w.mod.runCron(w.env, clock);
  ok("S11 · a phone the push service dropped (410) is forgotten: slot, pres and sub rows deleted", !w.SUBS.m.has("slot:2200:gone-phone-01") && !w.SUBS.m.has("pres:gone-phone-01") && !w.SUBS.m.has("sub:gone-phone-01"));
  /* a failed send is retried the next day: the row stays */
  clock = at(3, 22, 30); await w.sub("flaky-phone-1", "2300"); endpointMode["flaky-phone-1"] = 500;
  pushes = []; clock = at(3, 23, 0); await w.mod.runCron(w.env, clock);
  ok("S12 · a 500 from the push service keeps the row", w.SUBS.m.has("slot:2300:flaky-phone-1") && !pushes.includes("flaky-phone-1"));
  endpointMode["flaky-phone-1"] = 201; clock = at(4, 23, 0); await w.mod.runCron(w.env, clock);
  ok("S13 · …and the next day it is delivered", pushes.includes("flaky-phone-1"));
  unmute();
}

console.log("\n# races: LIST lag and runs at the same time");
{
  const w = await fresh(); mute(); clock = at(0, 0, 0); await w.migrate();
  /* booked seconds before its minute: the LIST cannot see the row yet */
  clock = at(0, 11, 59) + 50_000; await w.sub("late-phone-01", "1200");
  clock = at(0, 12, 0); pushes = []; await w.mod.runCron(w.env, clock);
  ok("R1 · a row too new for the LIST is missed this once (as it always was) but its marker is NOT retired", !pushes.includes("late-phone-01") && !!(await w.SUBS.get("mark:slot:1200")));
  clock = at(1, 12, 0); await w.mod.runCron(w.env, clock);
  ok("R2 · …so it is delivered the next day", pushes.includes("late-phone-01"));
  /* 20 phones book the same minute at once: no lost update (no read-modify-write anywhere) */
  clock = at(1, 13, 0); await Promise.all(Array.from({ length: 20 }, (_, i) => w.sub(`crowd-${String(i).padStart(2, "0")}-phone`, "1400")));
  pushes = []; clock = at(1, 14, 0); await w.mod.runCron(w.env, clock);
  ok("R3 · 20 simultaneous subscribes to one minute: 20 rows, one marker, 20 deliveries", pushes.length === 20 && [...w.SUBS.m.keys()].filter(k => k.startsWith("slot:1400:")).length === 20, "pushes " + pushes.length);
  /* two crons at once (an overlapping retry): state stays whole */
  clock = at(2, 14, 0); pushes = [];
  await Promise.all([w.mod.runCron(w.env, clock), w.mod.runCron(w.env, clock)]);
  ok("R4 · two runs of the same minute at once: no error, marker and rows intact (each run sends — sends were never de-duplicated across runs; unchanged)", !!(await w.SUBS.get("mark:slot:1400")) && [...w.SUBS.m.keys()].filter(k => k.startsWith("slot:1400:")).length === 20, "pushes " + pushes.length);
  unmute();
  const w2 = await fresh(); mute(); clock = at(5, 0, 0);
  for (let i = 0; i < 450; i++) { const id = `mass-${String(i).padStart(3, "0")}-x`, slot = String(i % 24).padStart(2, "0") + "00"; await w2.SUBS.put(`slot:${slot}:${id}`, JSON.stringify({ id, slot, endpoint: "https://push.test/" + id })); }
  clock = at(5, 0, 30) + 2 * MIN;
  await Promise.all([w2.mod.runCron(w2.env, clock), w2.mod.runCron(w2.env, clock)]);
  const runs = await w2.migrate();
  let all = true; for (let h = 0; h < 24; h++) if (!(await w2.SUBS.get("mark:slot:" + String(h).padStart(2, "0") + "00"))) all = false;
  ok("R5 · 450 legacy rows, overlapping first runs: the paged switch still completes and marks all 24 minutes", (await w2.SUBS.get(w2.mod.marksConfig().MIG_KEY)) === "done" && all, "runs " + runs);
  unmute();
}

console.log("\n# online alerts (presence)");
{
  const w = await fresh(); mute(); clock = at(0, 12, 0); await w.migrate();
  partner = { online: 3, waiting: 1 }; partnerCalls = 0; let before = w.SUBS.ops.list;
  await w.mod.runPresence(w.env, new Date(clock));
  ok("P1 · no phone asked for alerts: no partner call, no LIST", partnerCalls === 0 && w.SUBS.ops.list === before, `calls ${partnerCalls}`);
  await w.sub("pres-phone-01", null, { presence: true });
  partner = { online: 0, waiting: 0 }; clock += 2 * MIN; before = w.SUBS.ops.list;
  await w.mod.runPresence(w.env, new Date(clock));
  ok("P2 · subscribers but nobody online: the count is asked, no LIST", partnerCalls === 1 && w.SUBS.ops.list === before);
  partner = { online: 2, waiting: 1 }; pushes = []; clock += 10 * MIN;
  await w.mod.runPresence(w.env, new Date(clock));
  ok("P3 · someone online: one LIST, the alert goes, why: is parked", pushes.join() === "pres-phone-01" && !!(await w.SUBS.get("why:pres-phone-01")));
  pushes = []; clock += 10 * MIN; await w.mod.runPresence(w.env, new Date(clock));
  ok("P4 · the 4-hour gap still holds (unchanged)", pushes.length === 0);
  unmute();
}

console.log("\n# learning nudges");
{
  const w = await fresh(); mute(); clock = at(0, 12, 0); await w.migrate();
  let before = w.SUBS.ops.list;
  for (let i = 0; i < 144; i++) { clock += 10 * MIN; await w.mod.runNudges(w.env, clock); }
  ok("N1 · no nudge pending anywhere: 0 LISTs in a day of ten-minute runs (was 144)", w.SUBS.ops.list === before, "lists " + (w.SUBS.ops.list - before));
  clock = at(1, 11, 0); await w.sub("nudge-phone-1", null, { nudges: true });
  const r = await w.call("/nudge", { id: "nudge-phone-1", tz: 0, rec: { rid: "lesson-1", kind: "lesson", view: "session", title: "Week 3", body: "25 minutes today", sendAfter: clock, expiresAt: clock + 20 * H } }, "tok-ge");
  ok("N2 · a nudge is accepted and marks mark:nudge", r.status === 200 && !!(await w.SUBS.get("mark:nudge")), JSON.stringify(r));
  before = w.SUBS.ops.list; clock += 2 * MIN;
  const f = await w.call("/nudge/flush", { id: "nudge-phone-1" });
  ok("N3 · the one-phone flush reads its key directly — no LIST (it needs NUDGE_FLUSH, so it is refused here: 404)", w.SUBS.ops.list === before && f.status === 404);
  const o = await w.mod.runNudges(w.env, clock, "nudge-phone-1");
  ok("N4 · runNudges for one phone: delivered with a GET, no LIST", o.sent === 1 && w.SUBS.ops.list === before, JSON.stringify(o));
  before = w.SUBS.ops.list; clock += 10 * MIN; await w.mod.runNudges(w.env, clock);
  ok("N5 · after it went, the next run LISTs once, finds nothing and keeps the young marker", w.SUBS.ops.list - before === 1 && !!(await w.SUBS.get("mark:nudge")));
  clock += 40 * H; await w.mod.runNudges(w.env, clock);
  ok("N6 · once older than the grace the marker is retired; later runs cost no LIST", !(await w.SUBS.get("mark:nudge")));
  unmute();
}

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
