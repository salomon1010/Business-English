/* Practice Partner Worker — integration tests (phase 2 model).
   Needs:  npx wrangler d1 migrations apply be-partner --local --env dev
           npx wrangler dev --env dev --port 8787        (in backend/partner)
   Then:   node test/run.mjs
   Every request goes to the LOCAL worker with emulated D1/R2. Nothing here
   touches Cloudflare or Firebase. Users are dev ids via X-Dev-User; the
   clock is moved with X-Dev-Now. The database is reset at the start. */
import { verifyIdToken, screenTranscript, score, WEIGHTS_DEFAULT } from "../partner-worker.js";
import { generateKeyPairSync, createSign } from "node:crypto";

const BASE = process.env.PARTNER_API || "http://127.0.0.1:8787";
const res = []; let clock = null;
const ok = (name, cond, detail = "") => { res.push({ name, pass: !!cond }); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`); };
async function call(user, method, path, body, extra = {}) {
  const h = { ...(user ? { "x-dev-user": user } : {}), ...(clock ? { "x-dev-now": String(clock) } : {}), ...extra };
  let b = body;
  if (body && !(body instanceof FormData)) { h["content-type"] = "application/json"; b = JSON.stringify(body); }
  const r = await fetch(BASE + path, { method, headers: h, body: b });
  const ct = r.headers.get("content-type") || "";
  if (r.status === 500) console.log("   !! 500", method, path, await r.clone().text());
  return { status: r.status, json: ct.includes("json") ? await r.json() : null, raw: ct.includes("json") ? null : await r.arrayBuffer() };
}
const consent = (u, name, extra = {}) => call(u, "POST", "/consent", { name, lang: "fr", adult: true, ...extra });
const join = (u, o = {}) => call(u, "POST", "/interest", { track: "general-english", band: "w1-4", lang: "fr", promptWeek: 2, ...o });
const audioBlob = (bytes = 20_000) => new Blob([new Uint8Array(bytes).map((_, i) => i % 251)], { type: "audio/webm" });
function turnForm(transcript, o = {}) {
  const fd = new FormData();
  fd.set("audio", o.audio || audioBlob(), "turn.webm"); fd.set("transcript", transcript);
  fd.set("score", String(o.score ?? 82)); fd.set("duration_ms", String(o.duration ?? 12_000)); if (o.turnId) fd.set("turn_id", o.turnId);
  return fd;
}
const turn = (u, text, o) => call(u, "POST", "/turns", turnForm(text, o));
/* a trial is proposed by the host and accepted by the guest; returns the guest's accept response (carries the pair) */
async function tryPair(host, guest, offer) { const inv = await call(host, "POST", "/invite", { offer }); if (!inv.json.pairInvite) return inv; return call(guest, "POST", `/pairs/${inv.json.pairInvite.id}/accept`); }

{ const r = await fetch(BASE + "/__reset", { method: "POST" }); if (r.status !== 200) { console.log("reset failed", r.status); process.exit(1); } }
const H = await (await fetch(BASE + "/health")).json();
ok("health reports dev + enabled", H.ok && H.dev && H.enabled);

/* auth, consent, age, boundary */
ok("unauthenticated GET /me → 401", (await call(null, "GET", "/me")).status === 401);
ok("/interest before consent → 403 consent", (await join("alice")).json.error === "consent");
ok("consent without 18+ → 403 age", (await call("kid", "POST", "/consent", { name: "Kid", lang: "fr", adult: false })).json.error === "age");
ok("consent with 18+ and preferences", (await consent("alice", "Alice", { gender: "f", goals: ["workplace", "casual"], avail: ["evening"], tz: 1 })).json.prefs.goals.join() === "workplace,casual");
await consent("bob", "Bob", { gender: "m", goals: ["workplace"], avail: ["evening"], tz: 1 });
ok("welding track is refused at the API (403 track) — the boundary is not the UI", (await join("alice", { track: "welding" })).json.error === "track");
ok("unknown track refused too", (await join("alice", { track: "cooking" })).json.error === "track");

/* queue + candidates + reasons */
{ const r = await join("alice"); ok("first in queue → waiting, no candidates", r.json.status === "waiting" && r.json.candidates.length === 0 && r.json.waiting.count === 1); }
{ const r = await join("bob"); ok("second learner → sees Alice as a candidate with reasons, no uid", r.json.status === "waiting" && r.json.candidates.length === 1 && r.json.candidates[0].name === "Alice" && !("uid" in r.json.candidates[0]) && /^[a-f0-9]{16}$/.test(r.json.candidates[0].offer) && r.json.candidates[0].reasons.includes("same_level") && r.json.candidates[0].reasons.includes("same_lesson"), JSON.stringify(r.json.candidates)); }
{ const r = await call("bob", "POST", "/match"); ok("/match returns fresh offers for someone in the queue", r.status === 200 && r.json.candidates.length === 1); }
ok("/match for someone not in the queue → 409", (await call("carol", "POST", "/consent", { name: "Carol", lang: "fr", adult: true })).status === 200 && (await call("carol", "POST", "/match")).json.error === "not_waiting");
await consent("dave", "Dave", { gender: "m" }); await join("dave", { band: "w9-12" });
{ const r = await call("bob", "POST", "/match"); ok("band two steps away is excluded (Dave w9-12 not offered to Bob w1-4)", r.json.candidates.every(c => c.name !== "Dave")); }
{ const me = { band: "w1-4", goals: '["workplace"]', prompt_week: 2, topic: "", fnd_day: 0 }, mm = { mode: "voice", avail: '["evening"]', tz: 1, gender: "f" };
  const c = { band: "w1-4", goals: '["workplace"]', prompt_week: 2, topic: "", fnd_day: 0, mode: "voice", avail: '["evening"]', tz: 1, imode: "later", sessions_completed: 0, sessions_abandoned: 0 };
  const s = score(me, mm, c, WEIGHTS_DEFAULT, false); const far = score(me, mm, { ...c, band: "w5-8", prompt_week: 8, goals: '["casual"]', avail: '["morning"]', tz: 9 }, WEIGHTS_DEFAULT, false);
  ok("score(): perfect match scores high with reasons; weak match scores low", s.score > 0.9 && s.reasons.length === 2 && far.score < 0.4, JSON.stringify([s, far])); }

/* invite → trial pair; offer ids are single-use and owner-bound */
let pairId = null, offer = null;
{ const r = await call("bob", "POST", "/match"); offer = r.json.candidates[0].offer;
  const stolen = await call("carol", "POST", "/invite", { offer }); ok("an offer cannot be used by someone else (404)", stolen.status === 404);
  const inv = await call("bob", "POST", "/invite", { offer }); pairId = inv.json.pairInvite && inv.json.pairInvite.id;
  const aliceMe = await call("alice", "GET", "/me");
  ok("invite → a PROPOSAL, not a session: host sees 'waiting for Alice', Alice sees 'Bob wants to try a practice', nobody has a pair yet, both still in the queue", inv.json.status === "invited" && !inv.json.pair && inv.json.pairInvite.partner.name === "Alice" && aliceMe.json.invite && aliceMe.json.invite.id === pairId && aliceMe.json.invite.partner.name === "Bob" && !aliceMe.json.pair && aliceMe.json.waiting && inv.json.waiting, JSON.stringify({ inv: inv.json.pairInvite, alice: aliceMe.json.invite }));
  ok("the host cannot accept their own proposal; a stranger cannot accept or decline it", (await call("bob", "POST", `/pairs/${pairId}/accept`)).status === 403 && (await call("carol", "POST", `/pairs/${pairId}/accept`)).status === 403 && (await call("carol", "POST", `/pairs/${pairId}/decline`)).status === 403);
  ok("turns cannot be sent into a proposal", (await turn("bob", "too early")).json.error === "no_pair");
  const acc = await call("alice", "POST", `/pairs/${pairId}/accept`); const acc2 = await call("alice", "POST", `/pairs/${pairId}/accept`);
  ok("guest accepts → trial pair active for both, connection trial, round 1 of 4, both out of the queue; accepting twice is harmless", acc.status === 200 && acc.json.pair && acc.json.pair.id === pairId && acc.json.pair.kind === "trial" && acc.json.pair.round === 1 && acc.json.pair.connection.state === "trial" && !acc.json.waiting && (await call("bob", "GET", "/me")).json.pair.partner.name === "Alice" && acc2.status === 200 && acc2.json.already === true, JSON.stringify(acc.json.pair)); }
ok("re-using the consumed offer → 404", (await call("bob", "POST", "/invite", { offer })).status === 404);

/* concurrency: two inviters race for the same waiting learner — exactly one wins */
await consent("erin", "Erin"); await consent("fay", "Fay"); await consent("gus", "Gus");
await join("gus"); const oe = (await join("erin")).json.candidates[0].offer, of = (await join("fay")).json.candidates.find(c => c.name === "Gus").offer;
{ const [a, b] = await Promise.all([call("erin", "POST", "/invite", { offer: oe }), call("fay", "POST", "/invite", { offer: of })]);
  const gusMe = await call("gus", "GET", "/me");
  const acc = await call("gus", "POST", `/pairs/${a.json.pairInvite.id}/accept`);
  const lost = await call("gus", "POST", `/pairs/${b.json.pairInvite.id}/accept`);
  ok("two proposals for one learner: both wait; accepting one activates it and closes the other (second accept → closed)", a.status === 200 && b.status === 200 && gusMe.json.invite && acc.status === 200 && acc.json.pair && lost.status === 409 && (await call("fay", "GET", "/me")).json.lastClosed && (await call("fay", "GET", "/me")).json.lastClosed.reason === "expired", `${acc.status} ${lost.status}`); }
for (const u of ["erin", "fay"]) { const me = await call(u, "GET", "/me"); if (me.json.pair) await call(u, "POST", `/pairs/${me.json.pair.id}/leave`); await call(u, "DELETE", "/interest"); }
await call("gus", "DELETE", "/interest");

/* rounds: alternate, 2 each, then complete */
let t1 = null;
{ const a = await turn("alice", "Hello Bob, I am Alice. This week I worked on the new invoice process."); t1 = a.json.turn;
  ok("Alice speaks first (round 1) → 201", a.status === 201 && a.json.turn.seq === 1);
  const again = await turn("alice", "Let me add something."); ok("Alice cannot speak twice in a row → 409 not_your_turn", again.json.error === "not_your_turn");
  const bobMe = await call("bob", "GET", "/me"); ok("Bob sees round 2, unread 1, it is his turn", bobMe.json.pair.round === 2 && bobMe.json.pair.unread === 1 && bobMe.json.pair.myTurn === true);
  ok("non-member cannot stream the audio (403); no auth 401", (await call("carol", "GET", `/turns/${t1.id}/audio`)).status === 403 && (await call(null, "GET", `/turns/${t1.id}/audio`)).status === 401);
  ok("member streams the audio", (await call("bob", "GET", `/turns/${t1.id}/audio`)).status === 200);
  ok("contact details in a transcript → 422 moderation", (await turn("bob", "add me on whatsapp 06 12 34 56 78")).status === 422);
  const b1 = await turn("bob", "Hi Alice, nice to meet you. I work in logistics. What was hard about the invoices?"); ok("Bob replies (round 2)", b1.status === 201 && !b1.json.complete);
  const a2 = await turn("alice", "The hardest part was the approvals."); const b2 = await turn("bob", "Thanks, that makes sense. Next week I will try the same.");
  ok("four turns → session complete flag; further turns 409 complete", a2.status === 201 && b2.status === 201 && b2.json.complete === true && (await turn("alice", "one more")).json.error === "complete");
  const me = await call("alice", "GET", "/me"); ok("both see complete, no one has decided", me.json.pair.complete && me.json.pair.myDecision === null && me.json.pair.partnerDecided === false); }

/* decide: continue by both → mutual connection; then /next starts a regular session */
{ const early = await call("bob", "POST", `/pairs/${pairId}/decide`, { choice: "continue" }); ok("Bob decides continue; pair stays open until Alice decides", early.status === 200 && early.json.pair && early.json.pair.myDecision === "continue");
  const notMember = await call("carol", "POST", `/pairs/${pairId}/decide`, { choice: "continue" }); ok("non-member cannot decide (403)", notMember.status === 403);
  const a = await call("alice", "POST", `/pairs/${pairId}/decide`, { choice: "continue" });
  ok("Alice continues too → pair closed 'completed', mutual connection with 1 session", !a.json.pair && a.json.connection && a.json.connection.state === "mutual" && a.json.connection.sessions === 1 && a.json.connection.name === "Bob", JSON.stringify(a.json.connection));
  const nx = await call("alice", "POST", "/next", { band: "w1-4", promptWeek: 3 }); ok("/next starts a regular session with the connected partner", nx.json.status === "paired" && nx.json.pair.kind === "regular");
  const busy = await call("bob", "POST", "/next", { band: "w1-4" }); ok("/next while a session is active → 409", busy.status === 409);
  for (const [u, txt] of [["alice", "Round one again."], ["bob", "Round two."], ["alice", "Round three."], ["bob", "Round four."]]) await turn(u, txt);
  await call("alice", "POST", `/pairs/${nx.json.pair.id}/decide`, { choice: "continue" }); const b = await call("bob", "POST", `/pairs/${nx.json.pair.id}/decide`, { choice: "continue" });
  ok("second completed session → connection becomes regular (2 sessions)", b.json.connection && b.json.connection.state === "regular" && b.json.connection.sessions === 2); }

/* ---------------- proposals: decline, cancel, expiry; the other side is told who closed ---------------- */
{ await consent("ada", "Ada"); await consent("ben", "Ben"); await join("ada", { band: "w9-12" }); let o = (await join("ben", { band: "w9-12" })).json.candidates.find(c => c.name === "Ada").offer;
  let inv = await call("ben", "POST", "/invite", { offer: o }); const d = await call("ada", "POST", `/pairs/${inv.json.pairInvite.id}/decline`);
  const benMe = await call("ben", "GET", "/me");
  ok("guest declines → host told 'declined' by the other side with her first name; both still in line", d.status === 200 && benMe.json.lastClosed.reason === "declined" && benMe.json.lastClosed.byOther === true && benMe.json.lastClosed.name === "Ada" && benMe.json.waiting && !benMe.json.pairInvite);
  o = (await call("ben", "POST", "/match")).json.candidates.find(c => c.name === "Ada").offer; inv = await call("ben", "POST", "/invite", { offer: o });
  const c = await call("ben", "POST", `/pairs/${inv.json.pairInvite.id}/cancel`); const adaMe = await call("ada", "GET", "/me");
  ok("host cancels → guest told 'cancelled' by the other side; the guest cannot cancel a host's proposal", c.status === 200 && adaMe.json.lastClosed.reason === "cancelled" && adaMe.json.lastClosed.byOther === true && !adaMe.json.invite);
  o = (await call("ben", "POST", "/match")).json.candidates.find(c => c.name === "Ada").offer; const acc = await tryPair("ben", "ada", o);
  await call("ada", "POST", `/pairs/${acc.json.pair.id}/leave`); const benAfter = await call("ben", "GET", "/me");
  ok("leave today's practice → the partner is told 'left' by the other side, with her name", benAfter.json.lastClosed.reason === "left" && benAfter.json.lastClosed.byOther === true && benAfter.json.lastClosed.name === "Ada");
  await join("ada", { band: "w9-12" }); await join("ben", { band: "w9-12" });
  const base = (await call("ada", "GET", "/me")).json.serverNow;
  o = (await call("ben", "POST", "/match")).json.candidates.find(c => c.name === "Ada").offer; inv = await call("ben", "POST", "/invite", { offer: o });
  clock = base + 11 * 60_000; const late = await call("ada", "POST", `/pairs/${inv.json.pairInvite.id}/accept`); const adaLate = await call("ada", "GET", "/me"); clock = null;
  ok("an unanswered proposal expires after 10 minutes; accepting it then is refused and neither side is blamed", late.status === 409 && !adaLate.json.invite && adaLate.json.lastClosed.reason === "expired" && adaLate.json.lastClosed.byOther === false);
  await call("ada", "DELETE", "/interest"); await call("ben", "DELETE", "/interest"); }

/* ---------------- partner management: end partnership is distinct from leave / rematch / block ---------------- */
{ await consent("yara", "Yara"); await consent("zed", "Zed"); await join("yara", { band: "w5-8" }); const oz = (await join("zed", { band: "w5-8" })).json.candidates[0].offer; const pz = (await tryPair("zed", "yara", oz)).json.pair.id;
  for (const [u, txt] of [["zed", "one"], ["yara", "two"], ["zed", "three"], ["yara", "four"]]) await turn(u, txt);
  await call("yara", "POST", `/pairs/${pz}/decide`, { choice: "continue" }); await call("zed", "POST", `/pairs/${pz}/decide`, { choice: "continue" });
  const me = await call("yara", "GET", "/me"); const cid = me.json.connection && me.json.connection.cid;
  ok("connection card carries an opaque cid, no uid", /^[a-f0-9]{16}$/.test(cid || "") && !JSON.stringify(me.json.connection).includes("dev:"));
  /* leave today's practice keeps the partnership */
  const nx = await call("yara", "POST", "/next", { band: "w5-8", promptWeek: 5 }); await call("yara", "POST", `/pairs/${nx.json.pair.id}/leave`);
  const afterLeave = await call("yara", "GET", "/me");
  ok("leave today's practice closes only the session — the partnership stays", !afterLeave.json.pair && afterLeave.json.connection && afterLeave.json.connection.cid === cid && afterLeave.json.lastClosed.reason === "left");
  ok("someone else's cid does not resolve for another learner (404), malformed 400, no auth 401", (await call("carol", "POST", "/connection/end", { cid })).status === 404 && (await call("yara", "POST", "/connection/end", { cid: "zz" })).status === 400 && (await call(null, "POST", "/connection/end", { cid })).status === 401);
  /* end with a session open: the session closes too */
  await call("zed", "POST", "/next", { band: "w5-8", promptWeek: 5 });
  const end = await call("yara", "POST", "/connection/end", { cid });
  const zedMe = await call("zed", "GET", "/me");
  ok("end partnership → connection ended for both, open session closed as 'left', no block, cooldown", end.status === 200 && end.json.already === false && !end.json.connection && !end.json.pair && !zedMe.json.connection && !zedMe.json.pair && zedMe.json.lastClosed && zedMe.json.lastClosed.reason === "left" && !zedMe.json.suspendedUntil, JSON.stringify({ end: end.json.connection, zed: zedMe.json.lastClosed }));
  const end2 = await call("yara", "POST", "/connection/end", { cid });
  ok("ending twice is harmless (already:true)", end2.status === 200 && end2.json.already === true);
  await join("zed", { band: "w5-8" }); const yj = await join("yara", { band: "w5-8" });
  ok("an ended partner is not offered again (cooldown + ended state)", !yj.json.candidates.some(c => c.name === "Zed")); await call("yara", "DELETE", "/interest"); await call("zed", "DELETE", "/interest");
  ok("not a block: Zed can still be read normally, and a report through the connection is recorded", (await call("zed", "GET", "/me")).status === 200 && (await call("yara", "POST", "/connection/report", { cid, reason: "other" })).status === 200); }

/* ---------------- AI coach sessions are counted per learner (Level 2) ---------------- */
{ const ids = Array.from({ length: 13 }, (_, i) => (i + 1).toString(16).padStart(16, "0"));
  ok("ai: the wrong track is refused before anything is counted (403 track)", (await call("bob", "POST", "/ai/session", { id: ids[0], track: "welding" })).json.error === "track");
  const first = await call("bob", "POST", "/ai/session", { id: ids[0], track: "general-english", reason: "waiting" });
  const again = await call("bob", "POST", "/ai/session", { id: ids[0], track: "general-english" });
  ok("ai: a new session opens (201); reopening the same id is a no-op (200, repeat) and does not count", first.status === 201 && first.json.repeat === false && again.status === 200 && again.json.repeat === true);
  let last = 0; for (let i = 1; i < 13; i++) { last = (await call("bob", "POST", "/ai/session", { id: ids[i], track: "general-english" })).status; if (last === 429) break; }
  ok("ai: the 13th new session in a day → 429 limit; a repeat of an earlier id still succeeds", last === 429 && (await call("bob", "POST", "/ai/session", { id: ids[0], track: "general-english" })).status === 200);
  ok("ai: malformed id → 400; no auth → 401", (await call("bob", "POST", "/ai/session", { id: "x", track: "general-english" })).status === 400 && (await call(null, "POST", "/ai/session", { id: ids[0], track: "general-english" })).status === 401); }

/* ---------------- live practice (Level 3): alice + bob are regular partners ---------------- */
{ const noConn = await call("carol", "POST", "/live", { band: "w1-4", promptWeek: 3 });
  ok("live: needs a mutual/regular connection (404 no_connection)", noConn.status === 404 && noConn.json.error === "no_connection");
  const inv = await call("alice", "POST", "/live", { band: "w1-4", promptWeek: 3, phrase: "I've been working on" });
  ok("live: host invites the connected partner → invited session, opaque id, partner first name only", inv.status === 201 && inv.json.live && inv.json.live.state === "invited" && inv.json.live.role === "host" && /^[a-f0-9]{16}$/.test(inv.json.live.id) && inv.json.live.partner && Object.keys(inv.json.live.partner).join() === "name" && !("other" in inv.json.live), JSON.stringify(inv.json.live));
  const L = inv.json.live.id;
  const again = await call("alice", "POST", "/live", { band: "w1-4", promptWeek: 3 });
  ok("live: inviting again returns the same open session (idempotent)", again.status === 200 && again.json.live.id === L);
  const bobMe = await call("bob", "GET", "/me");
  ok("live: the guest sees the invitation in /me with role guest and connection.canLive false while it is open", bobMe.json.live && bobMe.json.live.id === L && bobMe.json.live.role === "guest" && bobMe.json.live.state === "invited");
  ok("live: a non-member cannot read, accept or signal (403)", (await call("carol", "GET", `/live/${L}`)).status === 403 && (await call("carol", "POST", `/live/${L}/accept`)).status === 403 && (await call("carol", "POST", `/live/${L}/signal`, { kind: "offer", payload: "x" })).status === 403 && (await call(null, "GET", `/live/${L}`)).status === 401);
  ok("live: the host cannot accept their own invitation; signalling before acceptance is refused", (await call("alice", "POST", `/live/${L}/accept`)).status === 403 && (await call("alice", "POST", `/live/${L}/signal`, { kind: "offer", payload: "sdp" })).status === 409);
  const acc = await call("bob", "POST", `/live/${L}/accept`); const acc2 = await call("bob", "POST", `/live/${L}/accept`);
  ok("live: guest accepts → accepted, ICE servers returned (STUN at least); accepting twice is harmless", acc.status === 200 && acc.json.live.state === "accepted" && Array.isArray(acc.json.iceServers) && acc.json.iceServers.length >= 1 && acc2.status === 200 && acc2.json.live.state === "accepted", JSON.stringify(acc.json));
  const off = await call("alice", "POST", `/live/${L}/signal`, { kind: "offer", payload: "v=0 offer" });
  const bobSig = await call("bob", "GET", `/live/${L}/signals?after=0`);
  ok("live: offer → state connecting; the guest polls and receives only the host's signals", off.json.state === "connecting" && bobSig.json.state === "connecting" && bobSig.json.signals.length === 1 && bobSig.json.signals[0].kind === "offer" && bobSig.json.signals[0].payload === "v=0 offer");
  await call("bob", "POST", `/live/${L}/signal`, { kind: "answer", payload: "v=0 answer" }); await call("bob", "POST", `/live/${L}/signal`, { kind: "ice", payload: "{\"candidate\":\"x\"}" });
  const aliceSig = await call("alice", "GET", `/live/${L}/signals?after=0`); const lastId = aliceSig.json.signals[aliceSig.json.signals.length - 1].id;
  const aliceSig2 = await call("alice", "GET", `/live/${L}/signals?after=${lastId}`);
  ok("live: answer + ice reach the host; ?after= returns nothing new; own signals never echo back", aliceSig.json.signals.map(x => x.kind).join() === "answer,ice" && aliceSig2.json.signals.length === 0 && !bobSig.json.signals.some(x => x.kind === "answer"));
  const con = await call("bob", "POST", `/live/${L}/signal`, { kind: "state", payload: "connected" });
  const st = await call("alice", "GET", `/live/${L}`);
  ok("live: first 'connected' report → active with startedAt; the other side reads the same state", con.json.state === "active" && st.json.live.state === "active" && st.json.live.startedAt > 0);
  const rc = await call("alice", "POST", `/live/${L}/signal`, { kind: "state", payload: "reconnecting" }); const rc2 = await call("alice", "POST", `/live/${L}/signal`, { kind: "state", payload: "connected" });
  ok("live: reconnecting ⇄ active transitions are server-side and idempotent", rc.json.state === "reconnecting" && rc2.json.state === "active");
  ok("live: bad kinds and oversized payloads are refused", (await call("bob", "POST", `/live/${L}/signal`, { kind: "video", payload: "x" })).status === 400 && (await call("bob", "POST", `/live/${L}/signal`, { kind: "ice", payload: "x".repeat(9000) })).status === 400);
  const end = await call("bob", "POST", `/live/${L}/end`, { reason: "completed" }); const end2 = await call("bob", "POST", `/live/${L}/end`, { reason: "completed" });
  ok("live: end → ended/completed; ending twice is harmless; signalling after the end is refused", end.json.live.state === "ended" && end.json.live.endReason === "completed" && end2.status === 200 && end2.json.live.state === "ended" && (await call("alice", "POST", `/live/${L}/signal`, { kind: "ice", payload: "x" })).status === 409);
  /* decline, cancel, expiry, block */
  const inv2 = (await call("bob", "POST", "/live", { band: "w1-4" })).json.live.id;
  ok("live: the host can cancel an open invitation; the guest cannot", (await call("alice", "POST", `/live/${inv2}/cancel`)).status === 403 && (await call("bob", "POST", `/live/${inv2}/cancel`)).status === 200 && (await call("bob", "GET", `/live/${inv2}`)).json.live.state === "cancelled");
  const inv3 = (await call("bob", "POST", "/live", { band: "w1-4" })).json.live.id;
  ok("live: the guest can decline", (await call("alice", "POST", `/live/${inv3}/decline`)).status === 200 && (await call("alice", "GET", `/live/${inv3}`)).json.live.state === "declined");
  const base = (await call("alice", "GET", "/me")).json.serverNow;
  const inv4 = (await call("alice", "POST", "/live", { band: "w1-4" })).json.live.id;
  clock = base + 11 * 60_000; const stale = await call("bob", "GET", `/live/${inv4}`); clock = null;
  ok("live: an invitation nobody answered expires after 10 minutes", stale.json.live.state === "expired");
  const inv5 = (await call("alice", "POST", "/live", { band: "w1-4" })).json.live.id; await call("bob", "POST", `/live/${inv5}/accept`); await call("alice", "POST", `/live/${inv5}/signal`, { kind: "offer", payload: "o" });
  const blk = await call("bob", "POST", `/live/${inv5}/block`);
  ok("live: block during a session → ended at once, both sides lose the session (403) and /me carries no live session", blk.status === 200 && (await call("alice", "GET", `/live/${inv5}`)).status === 403 && (await call("bob", "GET", `/live/${inv5}`)).status === 403 && !(await call("alice", "GET", "/me")).json.live && !(await call("bob", "GET", "/me")).json.live);
  ok("live: no second live session can be started against a blocked partner", (await call("alice", "POST", "/live", { band: "w1-4" })).status === 403 || (await call("alice", "POST", "/live", { band: "w1-4" })).status === 404); }

/* rematch: closes the pair, cooldown, not re-offered */
await consent("hana", "Hana", { gender: "f" }); await consent("ivan", "Ivan", { gender: "m" });
await join("hana", { band: "w5-8" }); const oi = (await join("ivan", { band: "w5-8" })).json.candidates[0].offer;
{ const inv = await tryPair("ivan", "hana", oi); const pid = inv.json.pair.id;
  const tooEarly = await call("hana", "POST", `/pairs/${pid}/decide`, { choice: "continue" }); ok("continue before the session is complete → 409 not_complete", tooEarly.json.error === "not_complete");
  for (const [u, txt] of [["ivan", "One"], ["hana", "Two"], ["ivan", "Three"], ["hana", "Four"]]) await turn(u, txt);
  const rm = await call("hana", "POST", `/pairs/${pid}/decide`, { choice: "rematch" });
  const ivanMe = await call("ivan", "GET", "/me");
  ok("'Find someone else' closes the pair for both, reason rematch, no explanation exposed", !rm.json.pair && !ivanMe.json.pair && ivanMe.json.lastClosed.reason === "rematch");
  await join("hana", { band: "w5-8" }); const again = await join("ivan", { band: "w5-8" });
  ok("cooldown: the rejected pair is not offered again", again.json.candidates.every(c => c.name !== "Hana") && again.json.status === "waiting");
  await call("hana", "DELETE", "/interest"); await call("ivan", "DELETE", "/interest"); }

/* timeout: rematch allowed after 24 h of silence even if incomplete; fallback flag */
await consent("jo", "Jo"); await consent("kim", "Kim"); await join("jo", { band: "w9-12" }); const ok2 = (await join("kim", { band: "w9-12" })).json.candidates[0].offer;
{ const inv = await tryPair("kim", "jo", ok2); const pid = inv.json.pair.id; await turn("kim", "Hello Jo");
  const base = (await call("kim", "GET", "/me")).json.serverNow; clock = base + 25 * 3_600_000;
  const me = await call("kim", "GET", "/me"); ok("partner silent 25 h → fallback true, canRepair true", me.json.pair.fallback === true && me.json.pair.canRepair === true, JSON.stringify({ f: me.json.pair.fallback, r: me.json.pair.canRepair, h: me.json.pair.partnerSilentH }));
  const rm = await call("kim", "POST", `/pairs/${pid}/decide`, { choice: "rematch" }); ok("rematch after timeout is allowed", rm.status === 200 && !rm.json.pair); clock = null; }

/* report → suspend; block → 403 + never matched; opt-out leaves the queue; limits */
await consent("lee", "Lee"); await consent("mia", "Mia"); await consent("ned", "Ned");
await join("ned", { band: "fnd-1-7" }); const ol = (await join("lee", { band: "fnd-1-7" })).json.candidates[0].offer; const p1 = (await tryPair("lee", "ned", ol)).json.pair.id;
await call("lee", "POST", `/pairs/${p1}/report`, { reason: "harassment" }); await call("lee", "POST", `/pairs/${p1}/leave`);
await join("ned", { band: "fnd-1-7" }); const om = (await join("mia", { band: "fnd-1-7" })).json.candidates[0].offer; const p2 = (await tryPair("mia", "ned", om)).json.pair.id;
{ const rep = await call("mia", "POST", `/pairs/${p2}/report`, { reason: "contact_info" }); const nedMe = await call("ned", "GET", "/me"); const nj = await join("ned", { band: "fnd-1-7" });
  ok("two distinct reporters → suspended 30 d, pair closed, cannot rejoin", rep.status === 200 && nedMe.json.suspendedUntil && !nedMe.json.pair && nj.json.error === "suspended"); }
await consent("olu", "Olu"); await consent("pia", "Pia"); await join("olu", { band: "w1-4" }); const op = (await join("pia", { band: "w1-4" })).json.candidates[0].offer; const p3 = (await tryPair("pia", "olu", op)).json.pair.id;
{ const t = await turn("pia", "Hi Olu"); const blk = await call("olu", "POST", `/pairs/${p3}/block`);
  ok("block: pair closed, blocked side gets 403 on pair and audio", blk.status === 200 && (await call("pia", "GET", `/pairs/${p3}`)).status === 403 && (await call("pia", "GET", `/turns/${t.json.turn.id}/audio`)).status === 403);
  await join("pia", { band: "w1-4" }); const again = await join("olu", { band: "w1-4" }); ok("blocked pair is never a candidate again", again.json.candidates.every(c => c.name !== "Pia"));
  await call("olu", "DELETE", "/interest"); await call("pia", "DELETE", "/interest"); }
{ await join("carol"); const out = await call("carol", "POST", "/prefs", { optedOut: true }); const j = await join("carol");
  ok("opt-out leaves the queue and refuses joining", !out.json.waiting && j.json.error === "opted_out"); await call("carol", "POST", "/prefs", { optedOut: false }); }
{ await consent("quin", "Quin"); let last = 0; for (let i = 0; i < 11; i++) { last = (await join("quin", { band: "w9-12" })).status; if (last === 429) break; } ok("11th queue join in a day → 429", last === 429); await call("quin", "DELETE", "/interest"); }
{ const dup = "abcdefabcdef0123"; await consent("rex", "Rex"); await consent("sam", "Sam"); await join("rex", { band: "w5-8" }); const o = (await join("sam", { band: "w5-8" })).json.candidates[0].offer; await tryPair("sam", "rex", o);
  const a = await turn("sam", "first", { turnId: dup }); const b = await turn("sam", "first", { turnId: dup });
  ok("duplicate turn_id is idempotent", a.status === 201 && b.status === 200 && b.json.duplicate === true);
  ok("audio over 1.5 MB → 413", (await turn("rex", "big", { audio: audioBlob(1_600_000) })).status === 413); }

/* reliability fairness: an expired pair only counts as abandoned for the side
   whose turn it was AND who had at least PARTNER_TIMEOUT_H to reply */
{ const base = (await call("alice", "GET", "/me")).json.serverNow;
  clock = base + 8 * 86_400_000; await call("alice", "POST", "/__cron");   /* flush every earlier pair so the count below is only ours */
  await consent("tom", "Tom"); await consent("uma", "Uma"); await consent("vic", "Vic"); await consent("wes", "Wes");
  /* pair 1: Tom speaks on day 0, Uma never replies → Uma abandoned */
  clock = base; await join("tom", { band: "w9-12" }); let o = (await join("uma", { band: "w9-12" })).json.candidates[0].offer; await tryPair("uma", "tom", o);
  await turn("uma", "hello tom");
  /* pair 2: Vic speaks only an hour before the week runs out → Wes is NOT abandoned */
  await join("vic", { band: "fnd-8-15" }); o = (await join("wes", { band: "fnd-8-15" })).json.candidates[0].offer; await tryPair("wes", "vic", o);
  clock = base + 7 * 86_400_000 - 3_600_000; await turn("wes", "hello vic");
  /* pair 3: one turn each, then both went quiet → a tie: either could have spoken next, nobody is blamed */
  clock = base; await consent("xan", "Xan"); await consent("yul", "Yul"); await join("xan", { band: "w5-8" }); o = (await join("yul", { band: "w5-8" })).json.candidates[0].offer; await tryPair("yul", "xan", o);
  await turn("yul", "hi xan"); clock = base + 86_400_000; await turn("xan", "hi yul");
  clock = base + 7 * 86_400_000 + 60_000; const c = await call("alice", "POST", "/__cron"); clock = null;
  ok("expired pairs: only the side that had a full timeout to reply is marked abandoned; a tie blames nobody", c.status === 200 && c.json.expired >= 3 && c.json.abandoned === 1, JSON.stringify(c.json)); }

/* audit + cron */
{ const me = await call("alice", "GET", "/me"); clock = me.json.serverNow + 40 * 86_400_000; const c = await call("alice", "POST", "/__cron"); clock = null;
  ok("cron closes stale pairs and purges audio 14 d after close", c.status === 200 && c.json.purgedTurns >= 1 && (await call("bob", "GET", `/turns/${t1.id}/audio`)).status === 404, JSON.stringify(c.json)); }
ok("kill switch is a Worker setting, reported by /health", "enabled" in H);
{ const r = await fetch(BASE + "/consent", { method: "POST", headers: { "x-dev-user": "alice", "content-type": "application/json" }, body: "{" });
  ok("a broken body is a 4xx, not a 500 with internals", r.status >= 400 && r.status < 500, String(r.status)); }

/* ID-token verifier */
{ const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const b64u = s => Buffer.from(s).toString("base64url");
  const mk = (payload, kid = "k1") => { const h = b64u(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })), p = b64u(JSON.stringify(payload)); const s = createSign("RSA-SHA256"); s.update(h + "." + p); return h + "." + p + "." + s.sign(privateKey).toString("base64url"); };
  const sec = Math.floor(Date.now() / 1000), good = { aud: "be-mastery", iss: "https://securetoken.google.com/be-mastery", sub: "uid123", iat: sec - 10, exp: sec + 3600 };
  const deps = { keys: [jwk] };
  const r = { ok: await verifyIdToken(mk(good), "be-mastery", deps).catch(e => "ERR " + e.message), aud: await verifyIdToken(mk({ ...good, aud: "x" }), "be-mastery", deps).catch(e => e.message), iss: await verifyIdToken(mk({ ...good, iss: "https://evil" }), "be-mastery", deps).catch(e => e.message), exp: await verifyIdToken(mk({ ...good, exp: sec - 1 }), "be-mastery", deps).catch(e => e.message), kid: await verifyIdToken(mk(good, "k9"), "be-mastery", deps).catch(e => e.message), sig: await verifyIdToken(mk(good).replace(/\.[^.]+$/, ".AAAA"), "be-mastery", deps).catch(e => e.message) };
  ok("ID-token verifier: accepts valid, rejects aud/iss/exp/kid/signature", r.ok === "uid123" && r.aud === "aud" && r.iss === "iss" && r.exp === "expired" && r.kid === "kid" && r.sig === "signature", JSON.stringify(r));
  /* key rotation: an unknown kid triggers exactly one JWKS refetch; malformed / wrong-alg / non-RSA tokens never reach the fetch */
  { let fetches = 0; const fetcher = async () => { fetches++; return { ok: true, json: async () => ({ keys: [jwk] }) }; };
    const viaFetch = await verifyIdToken(mk(good), "be-mastery", { fetch: fetcher }).catch(e => "ERR " + e.message);
    const rotated = await verifyIdToken(mk(good, "k2"), "be-mastery", { fetch: fetcher }).catch(e => e.message);
    /* a minute later the same unknown kid is allowed one refetch, and the rotated key is then found */
    const fetcher2 = async () => { fetches++; return { ok: true, json: async () => ({ keys: [jwk, { ...jwk, kid: "k2" }] }) }; };
    const afterRotation = await verifyIdToken(mk(good, "k2"), "be-mastery", { fetch: fetcher2, now: Date.now() + 120_000 }).catch(e => "ERR " + e.message);
    const malformed = await verifyIdToken("abc.def", "be-mastery", deps).catch(e => e.message);
    const hs = b64u(JSON.stringify({ alg: "HS256", kid: "k1" })) + "." + b64u(JSON.stringify(good)) + ".AAAA";
    const wrongAlg = await verifyIdToken(hs, "be-mastery", deps).catch(e => e.message);
    const ec = await verifyIdToken(mk(good), "be-mastery", { keys: [{ ...jwk, kty: "EC" }] }).catch(e => e.message);
    ok("ID-token verifier: JWKS fetched once, cached; unknown kid → one rate-limited refetch finds the rotated key; malformed/HS256/non-RSA rejected", viaFetch === "uid123" && rotated === "kid" && afterRotation === "uid123" && fetches === 2 && malformed === "malformed" && wrongAlg === "alg" && ec === "alg", JSON.stringify({ viaFetch, rotated, afterRotation, fetches, malformed, wrongAlg, ec })); } }
ok("screenTranscript: clean text passes, handle rejected", screenTranscript("I work on the second shift") && !screenTranscript("find me at @alice_d"));

const pass = res.filter(r => r.pass).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})`);
process.exit(pass === res.length ? 0 : 1);
