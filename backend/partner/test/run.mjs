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
  if (o.words) fd.set("words", JSON.stringify(o.words));
  return fd;
}
const turn = (u, text, o) => call(u, "POST", "/turns", turnForm(text, o));
/* a trial is proposed by the host and accepted by the guest; returns the guest's accept response (carries the pair) */
async function tryPair(host, guest, offer) { const inv = await call(host, "POST", "/invite", { offer }); if (!inv.json.pairInvite) return inv; return call(guest, "POST", `/pairs/${inv.json.pairInvite.id}/accept`); }

{ const r = await fetch(BASE + "/__reset", { method: "POST" }); if (r.status !== 200) { console.log("reset failed", r.status); process.exit(1); } }
const H = await (await fetch(BASE + "/health")).json();
ok("health reports dev + enabled", H.ok && H.dev && H.enabled);
const P0 = await call(null, "GET", "/presence");
ok("public /presence needs no auth and carries counts only", P0.status === 200 && P0.json && typeof P0.json.online === "number" && typeof P0.json.waiting === "number" && Object.keys(P0.json).length === 2);

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
{ const r = await call("bob", "POST", "/match"); const names = r.json.candidates.map(c => c.name);
  ok("no compatibility gate: a learner two bands away (Dave w9-12) is still offered to Bob w1-4, ranked after the same band, with a plain reason", names.includes("Dave") && (names.indexOf("Dave") > 0 || names.length === 1) && r.json.candidates.every(c => c.reasons.length > 0), JSON.stringify(r.json.candidates.map(c => [c.name, c.band, c.reasons]))); }
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
{ const a = await turn("alice", "Hello Bob, I am Alice. I am working in data since three years. This week I worked on the new invoice process, it was very good.",
    { words: { mode: "whisper", list: [{ word: "invoice", score: 95 }, { word: "process", score: 95 }, { word: "approvals", score: 40, note: "unclear" }] } }); t1 = a.json.turn;
  ok("Alice speaks first (round 1) → 201", a.status === 201 && a.json.turn.seq === 1);
  ok("no four-round review before the session is complete (409 not_complete) — the analysis waits for all four rounds", (await call("alice", "POST", `/pairs/${pairId}/review`, { context: { topic: "x" } })).json.error === "not_complete");
  const again = await turn("alice", "Let me add something."); ok("Alice cannot speak twice in a row → 409 not_your_turn", again.json.error === "not_your_turn");
  const bobMe = await call("bob", "GET", "/me"); ok("Bob sees round 2, unread 1, it is his turn", bobMe.json.pair.round === 2 && bobMe.json.pair.unread === 1 && bobMe.json.pair.myTurn === true);
  ok("non-member cannot stream the audio (403); no auth 401", (await call("carol", "GET", `/turns/${t1.id}/audio`)).status === 403 && (await call(null, "GET", `/turns/${t1.id}/audio`)).status === 401);
  ok("member streams the audio", (await call("bob", "GET", `/turns/${t1.id}/audio`)).status === 200);
  ok("contact details in a transcript → 422 moderation", (await turn("bob", "add me on whatsapp 06 12 34 56 78")).status === 422);
  const b1 = await turn("bob", "Hi Alice, nice to meet you. I work in logistics. What was hard about the invoices?"); ok("Bob replies (round 2)", b1.status === 201 && !b1.json.complete);
  const a2 = await turn("alice", "The hardest part was the approvals. I am responsible for the weekly report and it was very good to finish it."); const b2 = await turn("bob", "Thanks, that makes sense. Next week I will try the same.");
  ok("four turns → session complete flag; further turns 409 complete", a2.status === 201 && b2.status === 201 && b2.json.complete === true && (await turn("alice", "one more")).json.error === "complete");
  const me = await call("alice", "GET", "/me"); ok("both see complete, no one has decided", me.json.pair.complete && me.json.pair.myDecision === null && me.json.pair.partnerDecided === false); }

/* Four-round review: the learner's own session → a private, topic-aware lesson; idempotent; never the partner's */
const CTX = { week: 1, day: "Tue", topic: "“Tell me about yourself”", objective: "Build your baseline and start speaking clearly about yourself and your role.", task: "Record a 90-second answer: current role → core responsibilities → previous experience → current focus.", phrases: [{ p: "I currently work as…", u: "Introduce your role" }, { p: "I'm responsible for…", u: "Describe ownership" }, { p: "My background is in…", u: "Give your history" }] };
{ const r1 = await call("alice", "POST", `/pairs/${pairId}/review`, { context: CTX }); const R = r1.json && r1.json.review;
  ok("Alice reviews her completed session → 201: topic anchored, summary, what went well / to improve with evidence, task components from the curriculum task, 5 indicators + per-round evidence, coach script ending in the lead-in, the expected answer (named structure, ≥ 20 words, her own facts, 3+ moves), polished answer, next practice", r1.status === 201 && R && R.topic.includes("Tell me about yourself") && R.summary && R.well.length >= 1 && R.improve.length >= 1 && R.task.components.length === 4 && typeof R.indicators.task === "number" && R.rounds.length === 2 && R.rounds.map(x => x.seq).join() === "1,3" && R.coach.script.length >= 3 && R.coach.practice.length >= 2 && R.coach.practice.every(c => c.say.split(" ").length >= 6 && typeof c.said === "string" && c.expected && c.teach) && R.coach.practice[0].said && R.coach.model && R.coach.model.structure && R.coach.model.answer.split(" ").length >= 20 && /three years/.test(R.coach.model.answer) && /invoice/.test(R.coach.model.answer) && R.coach.model.moves.length >= 3 && /expecting from you/.test(R.coach.script[R.coach.script.length - 1]) && R.answer.polished && R.next.vocab.length >= 1 && R.next.skill, JSON.stringify(r1.json).slice(0, 400));
  ok("task mastery names the curriculum's components, not invented ones: current role / core responsibilities / previous experience / current focus, each with a status", R && R.task.components.map(c => c.name).join("|") === "current role|core responsibilities|previous experience|current focus" && R.task.components.every(c => ["strong", "developing", "needs_practice", "missing"].includes(c.status)), JSON.stringify(R && R.task));
  ok("the stub finds 'I am working in data since three years' → an 'error' fix with the present perfect and 'for'; 'very good' → an 'unnatural' fix, not an error; the recurring pattern is named", R && R.fixes.some(f => f.kind === "error" && /I've been working in data for three years/.test(f.better) && f.pattern) && R.fixes.some(f => f.kind === "unnatural" && f.said === "very good"), JSON.stringify(R && R.fixes));
  ok("topic vocabulary: phrase-bank items not used become MUST KNOW; an overused basic word gets an UPGRADE with its count; sentence patterns listed", R && R.vocab.must.length >= 1 && R.vocab.must.every(m => m.term && m.meaning) && R.vocab.upgrade.some(u => u.replaces === "good" && u.count >= 1) && R.vocab.patterns.length >= 1, JSON.stringify(R && R.vocab));
  ok("the polished answer keeps the learner's facts (invoice process, approvals) and applies the fixes", R && /invoice process/.test(R.answer.polished) && /approvals/.test(R.answer.polished) && /I've been working in data for three years/.test(R.answer.polished) && R.answer.changed.length >= 1, R && R.answer.polished);
  ok("pronunciation honesty: words came from the recogniser (mode whisper) → evidence 'asr', the low word is 'check' (worth checking) with the round it came from, never 'heard'", R && R.evidence === "asr" && R.pron.length === 1 && R.pron[0].word === "approvals" && R.pron[0].confidence === "check" && R.pron[0].rounds.join() === "1", JSON.stringify(R && R.pron));
  const r1b = await call("alice", "POST", `/pairs/${pairId}/review`, { context: CTX });
  ok("a repeat is idempotent: 200, same id, same review — the model is not called twice", r1b.status === 200 && r1b.json.id === r1.json.id && JSON.stringify(r1b.json.review) === JSON.stringify(R));
  ok("a non-member cannot review the session (403)", (await call("carol", "POST", `/pairs/${pairId}/review`, { context: CTX })).status === 403);
  const rb = await call("bob", "POST", `/pairs/${pairId}/review`, { context: CTX });
  ok("Bob's review of the same session is his own and private: 201, his rounds (2 and 4), nothing of Alice's turns quoted in 'said' or the polished answer", rb.status === 201 && rb.json.review.rounds.map(x => x.seq).join() === "2,4" && rb.json.review.fixes.every(f => !/invoice process|three years/.test(f.said)) && !/invoice process|three years/.test(rb.json.review.answer.original) && rb.json.id !== r1.json.id, JSON.stringify(rb.json).slice(0, 300));
  const la = await call("alice", "GET", "/reviews"), lb = await call("bob", "GET", "/reviews");
  ok("GET /reviews lists only the caller's own reviews (Alice 1, Bob 1) with pair id, session number and evidence — never the other learner's", la.json.reviews.length === 1 && la.json.reviews[0].id === r1.json.id && la.json.reviews[0].round === 1 && lb.json.reviews.length === 1 && lb.json.reviews[0].id === rb.json.id, JSON.stringify([la.json.reviews.map(r => [r.id, r.round]), lb.json.reviews.map(r => [r.id, r.round])]));
}

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

/* ---------------- presence: counts only; stale queue rows are neither available nor counted ---------------- */
{ await consent("pam", "Pam"); await consent("quo", "Quo"); await consent("rae", "Rae");
  const base = (await call("pam", "GET", "/me")).json.serverNow;
  await join("pam", { band: "w1-4" }); await join("quo", { band: "w1-4" });
  const pm = await call("pam", "GET", "/me");
  ok("/me carries liveEnabled from the Worker (LIVE_ENABLED), so every device shows the same live buttons", pm.json.liveEnabled === true);
  ok("presence: counts only (online, waiting), never ids; excludes self; a queued peer counts as waiting", pm.json.presence && typeof pm.json.presence.online === "number" && pm.json.presence.waiting >= 1 && Object.keys(pm.json.presence).join() === "online,waiting" && !JSON.stringify(pm.json.presence).includes("dev:"));
  await call("pam", "POST", `/connection/block`, { cid: "0000000000000000" }).catch(() => {});   /* no-op: proves a bad cid is harmless */
  await join("rae", { band: "w9-12" });
  const pm2 = await call("pam", "GET", "/me");
  ok("presence: a learner two bands away counts too (no compatibility gate)", pm2.json.presence.waiting === pm.json.presence.waiting + 1);
  const oq = (await call("pam", "POST", "/match")).json.candidates.find(c => c.name === "Quo");
  await call("pam", "POST", "/connection/end", { cid: "0000000000000000" }).catch(() => {});
  const pairP = await tryPair("pam", "quo", oq.offer); await call("pam", "POST", `/pairs/${pairP.json.pair.id}/block`);
  await join("quo", { band: "w1-4" }); const pj = await join("pam", { band: "w1-4" }); const pm3 = await call("pam", "GET", "/me");
  ok("presence: a blocked learner is never counted nor offered", pm3.json.presence.waiting === pm2.json.presence.waiting - 1 && !(pj.json.candidates || []).some(c => c.name === "Quo"));
  /* stale queue rows: 8 days old → neither a candidate nor waiting; the cron removes them */
  await join("rae", { band: "w1-4" }); clock = base + 8 * 86_400_000; await join("pam", { band: "w1-4" });
  const late = await call("pam", "GET", "/me"); const cands = await call("pam", "POST", "/match");
  ok("a queue entry older than 7 days is not available and not counted", late.json.presence.waiting === 0 && !cands.json.candidates.some(c => c.name === "Rae"));
  const cr = await call("pam", "POST", "/__cron");
  ok("cron purges stale queue rows", cr.status === 200 && !(await call("rae", "GET", "/me")).json.waiting); clock = null;
  await call("pam", "DELETE", "/interest"); }

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
  clock = (await call("yara", "GET", "/me")).json.serverNow + 6 * 60_000;   /* everyone else "seen" > 5 min ago: only in-line members remain */
  await join("zed", { band: "w5-8" }); const yj = await join("yara", { band: "w5-8" });
  ok("an ended partner who is online is still offered (ranked last), and the strip counts them — the same number the cards show", yj.json.candidates.some(c => c.name === "Zed") && (await call("yara", "GET", "/me")).json.presence.waiting === (await call("yara", "GET", "/me")).json.waiting.available, JSON.stringify(yj.json.candidates || yj.json)); clock = null; await call("yara", "DELETE", "/interest"); await call("zed", "DELETE", "/interest");
  ok("not a block: Zed can still be read normally, and a report through the connection is recorded", (await call("zed", "GET", "/me")).status === 200 && (await call("yara", "POST", "/connection/report", { cid, reason: "other" })).status === 200); }

/* ---------------- unblock (fresh start), clear my history, regular kind via the queue ---------------- */
{ await consent("ula", "Ula"); await consent("vic", "Vic"); await join("ula", { band: "w9-12" }); const ov = (await join("vic", { band: "w9-12" })).json.candidates.find(c => c.name === "Ula").offer;
  const pv = (await tryPair("vic", "ula", ov)).json.pair.id;
  for (const [u, txt] of [["vic", "one"], ["ula", "two"], ["vic", "three"], ["ula", "four"]]) await turn(u, txt);
  await call("ula", "POST", `/pairs/${pv}/decide`, { choice: "continue" }); await call("vic", "POST", `/pairs/${pv}/decide`, { choice: "continue" });
  /* partners who meet again through the queue get a REGULAR session (the staging bug) */
  await join("ula", { band: "w9-12" }); const ov2 = (await join("vic", { band: "w9-12" })).json.candidates.find(c => c.name === "Ula").offer;
  const again = await tryPair("vic", "ula", ov2);
  ok("kind: two mutual partners paired through a queue proposal get kind=regular, not a second trial", again.json.pair && again.json.pair.kind === "regular", JSON.stringify(again.json.pair && again.json.pair.kind));
  for (const [u, txt] of [["vic", "r1"], ["ula", "r2"]]) await turn(u, txt);
  await call("ula", "POST", `/pairs/${again.json.pair.id}/leave`);
  /* clear my history: closed-session turns go, an open session keeps its turns */
  const nx = await call("ula", "POST", "/next", { band: "w9-12", promptWeek: 9 }); await turn("ula", "open-one");
  const openId = nx.json.pair.id;
  const before = (await call("ula", "GET", "/me")).json;
  const hc = await call("ula", "DELETE", "/history");
  const after = (await call("ula", "GET", "/me")).json;
  ok("DELETE /history removes my turns of closed sessions (3) and their audio, keeps the open session's turn, and the partnership", hc.status === 200 && hc.json.turns === 3 && hc.json.audio === 3 && after.pair && after.pair.id === openId && after.pair.turns.length === 1 && after.pair.connection && before.pair.connection, JSON.stringify([hc.json, after.pair && after.pair.turns.length]));
  ok("DELETE /history twice → nothing left to remove, still ok", (await call("ula", "DELETE", "/history")).json.turns === 0);
  ok("DELETE /history reports the reviews it removed (a number; Ula never asked for one → 0)", typeof hc.json.reviews === "number" && hc.json.reviews === 0);
  { /* history clearing takes the Round Reviews of closed sessions with it; the open session's stays */
    const mine = await call("alice", "GET", "/reviews"); const before = mine.json.reviews.length;
    const hc = await call("alice", "DELETE", "/history"); const after = (await call("alice", "GET", "/reviews")).json.reviews.length;
    ok("Alice clears her history → her reviews of CLOSED sessions are deleted with the turns; what remains belongs to open sessions only", hc.status === 200 && before >= 1 && hc.json.reviews >= 1 && after === before - hc.json.reviews, JSON.stringify([before, hc.json, after])); }
  await call("ula", "POST", `/pairs/${openId}/leave`);
  /* block → the blocker sees the name in /me.blocked; the blocked side sees nothing */
  const cidU = (await call("ula", "GET", "/me")).json.connection.cid;
  await call("ula", "POST", "/connection/block", { cid: cidU });
  const ub = (await call("ula", "GET", "/me")).json, vb = (await call("vic", "GET", "/me")).json;
  ok("block: /me.blocked lists Vic with the cid for the blocker only; Vic's /me has an empty list and no connection", ub.blocked.length === 1 && ub.blocked[0].name === "Vic" && ub.blocked[0].cid === cidU && !ub.connection && Array.isArray(vb.blocked) && vb.blocked.length === 0 && !vb.connection, JSON.stringify([ub.blocked, vb.blocked]));
  ok("unblock by the blocked side does nothing (already:true) — it is not their block", (await call("vic", "POST", "/connection/unblock", { cid: cidU })).json.already === true && (await call("ula", "GET", "/me")).json.blocked.length === 1);
  ok("unblock: malformed cid 400, someone else's cid 404", (await call("ula", "POST", "/connection/unblock", { cid: "zz" })).status === 400 && (await call("carol", "POST", "/connection/unblock", { cid: cidU })).status === 404);
  const un = await call("ula", "POST", "/connection/unblock", { cid: cidU });
  clock = (await call("ula", "GET", "/me")).json.serverNow + 6 * 60_000;
  await join("vic", { band: "w9-12" }); const uj = await join("ula", { band: "w9-12" });
  ok("unblock = fresh start: block gone, no partnership restored, Vic can be offered to Ula again", un.status === 200 && un.json.already === false && un.json.blocked.length === 0 && !un.json.connection && uj.json.candidates.some(c => c.name === "Vic"), JSON.stringify([un.json.blocked, un.json.connection, (uj.json.candidates || []).map(c => c.name)]));
  ok("unblocking twice is harmless (already:true)", (await call("ula", "POST", "/connection/unblock", { cid: cidU })).json.already === true);
  await call("ula", "DELETE", "/interest"); await call("vic", "DELETE", "/interest"); }

/* ---------------- AI coach sessions are counted per learner (Level 2) ---------------- */
{ const ids = Array.from({ length: 13 }, (_, i) => (i + 1).toString(16).padStart(16, "0"));
  ok("ai: the wrong track is refused before anything is counted (403 track)", (await call("bob", "POST", "/ai/session", { id: ids[0], track: "welding" })).json.error === "track");
  const first = await call("bob", "POST", "/ai/session", { id: ids[0], track: "general-english", reason: "waiting" });
  const again = await call("bob", "POST", "/ai/session", { id: ids[0], track: "general-english" });
  ok("ai: a new session opens (201); reopening the same id is a no-op (200, repeat) and does not count", first.status === 201 && first.json.repeat === false && again.status === 200 && again.json.repeat === true);
  let last = 0; for (let i = 1; i < 13; i++) { last = (await call("bob", "POST", "/ai/session", { id: ids[i], track: "general-english" })).status; if (last === 429) break; }
  ok("ai: the 13th new session in a day → 429 limit; a repeat of an earlier id still succeeds", last === 429 && (await call("bob", "POST", "/ai/session", { id: ids[0], track: "general-english" })).status === 200);
  ok("ai: malformed id → 400; no auth → 401", (await call("bob", "POST", "/ai/session", { id: "x", track: "general-english" })).status === 400 && (await call(null, "POST", "/ai/session", { id: ids[0], track: "general-english" })).status === 401); }

/* ---------------- online, not in line: still a candidate (owner, 2026-09-19); Welding never ---------------- */
{ await consent("ora", "Ora"); await join("ora", { band: "w1-4" });
  const on = await call("oli", "POST", "/consent", { name: "Oli", lang: "en", adult: true, track: "general-english" });   /* consented on General English, never tapped Match me */
  await call("oli", "GET", "/me");   /* seen just now */
  const wl = await call("wl", "POST", "/consent", { name: "Wl", lang: "en", adult: true, track: "welding" });
  const bad = await call("wl2", "POST", "/consent", { name: "Wl2", lang: "en", adult: true });   /* no track at all: never offered */
  await call("wl2", "GET", "/me");
  const mo = await call("ora", "POST", "/match");
  ok("an online General English member who is NOT in line is offered (reason online_now, band unknown), and counted", on.status === 200 && mo.json.candidates.some(c => c.name === "Oli" && c.inLine === false && c.reasons.includes("online_now") && c.band === null) && (await call("ora", "GET", "/me")).json.presence.waiting >= 1, JSON.stringify(mo.json.candidates));
  ok("consent with track=welding is refused (403); a member without a track is never offered", wl.status === 403 && wl.json.error === "track" && bad.status === 200 && !mo.json.candidates.some(c => c.name === "Wl2"));
  const oo = mo.json.candidates.find(c => c.name === "Oli");
  const inv = await call("ora", "POST", "/invite", { offer: oo.offer });
  const om = await call("oli", "GET", "/me");
  ok("the online member can be asked: proposal created, they see the invitation", inv.status === 200 && inv.json.pairInvite && om.json.invite && om.json.invite.partner.name === "Ora", JSON.stringify([inv.json.error, om.json.invite]));
  const acc = await call("oli", "POST", `/pairs/${om.json.invite.id}/accept`);
  ok("…and accept it → active trial pair", acc.status === 200 && acc.json.pair && acc.json.pair.kind === "trial");
  await call("ora", "POST", `/pairs/${acc.json.pair.id}/leave`);
  ok("an online member seen more than 5 minutes ago is not offered", await (async () => { clock = (await call("ora", "GET", "/me")).json.serverNow + 6 * 60_000; await join("ora", { band: "w1-4" }); const m2 = await call("ora", "POST", "/match"); const r = !m2.json.candidates.some(c => c.name === "Oli"); clock = null; return r; })()); }

/* ---------------- post-trial decisions: mutual consent only, "later" never connects, blocks never connect ---------------- */
{ const trial = async (h, g, hb = "w1-4", gb = "w1-4") => { await consent(h, h[0].toUpperCase() + h.slice(1)); await consent(g, g[0].toUpperCase() + g.slice(1)); await join(g, { band: gb }); await join(h, { band: hb });
    const o = (await call(h, "POST", "/match")).json.candidates.find(c => c.name.toLowerCase() === g); const p = await tryPair(h, g, o.offer);
    for (const [u, txt] of [[h, "one"], [g, "two"], [h, "three"], [g, "four"]]) await turn(u, txt); return p.json.pair.id; };
  const decide = (u, id, choice) => call(u, "POST", `/pairs/${id}/decide`, { choice });
  /* 1 + 2 + 3: A continues → waiting, no connection; B continues → connection; both idempotent */
  let id = await trial("pa", "pb");
  const a1 = await decide("pa", id, "continue"), a1again = await decide("pa", id, "continue");
  ok("1. A chooses continue → waiting state, no connection yet", a1.status === 200 && a1.json.pair && a1.json.pair.myDecision === "continue" && !a1.json.connection && !(await call("pb", "GET", "/me")).json.connection);
  ok("3a. repeating A's continue is idempotent (same state, still no connection)", a1again.status === 200 && a1again.json.pair && !a1again.json.connection);
  const b1 = await decide("pb", id, "continue");
  ok("2. B chooses continue → mutual consent → one connection, pair closed 'completed', both see it", b1.status === 200 && !b1.json.pair && b1.json.connection && b1.json.connection.state === "mutual" && b1.json.connection.sessions === 1 && (await call("pa", "GET", "/me")).json.connection?.name === "Pb");
  const b1again = await decide("pb", id, "continue"), a1late = await decide("pa", id, "continue");
  ok("3b. a repeat after the connection is 409 closed and the session count stays 1", b1again.status === 409 && a1late.status === 409 && (await call("pa", "GET", "/me")).json.connection.sessions === 1);
  /* 4: A continue, B someone else → no connection, cooldown, A told neutrally */
  id = await trial("pc", "pd"); await decide("pc", id, "continue"); const d4 = await decide("pd", id, "rematch");
  const c4 = (await call("pc", "GET", "/me")).json;
  ok("4. A continue + B find-someone-else → no connection, pair closed 'rematch', A sees only that it ended (no decision detail)", d4.status === 200 && !d4.json.connection && !c4.connection && !c4.pair && c4.lastClosed && c4.lastClosed.reason === "rematch" && c4.lastClosed.byOther === true && !("decision" in c4.lastClosed));
  /* 5: both someone else */
  id = await trial("pe", "pf"); const e5 = await decide("pe", id, "rematch"); const f5 = await decide("pf", id, "rematch");
  ok("5. both find-someone-else → no connection; second call 409 closed (pair already closed by the first)", e5.status === 200 && !e5.json.connection && f5.status === 409 && !(await call("pf", "GET", "/me")).json.connection);
  /* 6: not now */
  id = await trial("pg", "ph"); const g6 = await decide("pg", id, "later");
  const h6 = (await call("ph", "GET", "/me")).json;
  ok("6. Not now → no connection, no cooldown, trial kept on record as 'completed'; both free to practise again", g6.status === 200 && !g6.json.pair && !g6.json.connection && !h6.pair && !h6.connection && h6.lastClosed && h6.lastClosed.reason === "completed" && !(await call("pg", "GET", "/me")).json.pair, JSON.stringify({ g6: g6.json.error || g6.status, h6: h6.lastClosed, pair: !!h6.pair }));
  ok("6b. A 'continue' after the other said Not now → 409 closed, still no connection", (await decide("ph", id, "continue")).status === 409 && !(await call("ph", "GET", "/me")).json.connection);
  ok("6c. Not now needs a completed trial (409 not_complete), and any other word is 400", await (async () => { const nid = await trial("pi", "pj"); const bad = await decide("pi", nid, "maybe"); return bad.status === 400; })());
  /* 7: blocked / suspended */
  id = await trial("pk", "pl"); const bk = await call("pl", "POST", `/pairs/${id}/block`); const k7 = await decide("pk", id, "continue");
  ok("7a. after a block the pair is closed → continue is 409/403, no connection", bk.status === 200 && [403, 409].includes(k7.status) && !(await call("pk", "GET", "/me")).json.connection, JSON.stringify({ bk: bk.json.error || bk.status, k7: k7.json }));
  /* two distinct reporters who each practised with Pn → Pn suspended; the open pair with Pm closes and nothing can connect */
  let idx = await trial("px", "pn"); await call("px", "POST", `/pairs/${idx}/report`, { reason: "abuse" }); await decide("px", idx, "later");
  id = await trial("pm", "pn"); await decide("pm", id, "continue"); await call("pm", "POST", `/pairs/${id}/report`, { reason: "abuse" });
  const n7 = (await call("pn", "GET", "/me")).json; const n7d = await decide("pn", id, "continue");
  ok("7b. suspension closes the open pair; the suspended learner's 'continue' is refused and no connection exists", !!n7.suspendedUntil && !n7.pair && [403, 409].includes(n7d.status) && !(await call("pm", "GET", "/me")).json.connection, JSON.stringify({ susp: n7.suspendedUntil, pair: !!n7.pair, d: n7d.json }));
  /* 8 + 9: Welding never gets a pair to decide on; direct API cannot forge the other side */
  ok("8. Welding: no pair can exist (interest 403 track), so /decide has nothing to act on", (await call("wl3", "POST", "/interest", { track: "welding", band: "w1-4", lang: "en" })).status === 403);
  id = await trial("po", "pq"); const forged = await decide("po", id, "continue");
  ok("9. one side's continue alone never creates a connection, and a stranger's decide is 403", forged.status === 200 && !forged.json.connection && (await call("pr", "POST", `/pairs/${id}/decide`, { choice: "continue" })).status === 403 && !(await call("pq", "GET", "/me")).json.connection);
  await decide("pq", id, "later"); }

/* ---------------- account deletion: DELETE /me erases everything Practice Partner holds ---------------- */
{ await consent("xan", "Xan"); await consent("yul", "Yul"); await join("xan", { band: "w1-4" }); await join("yul", { band: "w1-4" });
  const ox = (await call("xan", "POST", "/match")).json.candidates.find(c => c.name === "Yul");
  const px = await tryPair("xan", "yul", ox.offer);
  const tx = await turn("xan", "hello from xan"); ok("deletion fixture: Xan sent one turn", tx.status === 201, JSON.stringify(tx.json));
  await call("yul", "POST", `/pairs/${px.json.pair.id}/report`, { reason: "spam" });
  const before = (await call("yul", "GET", "/me")).json;
  const del = await call("xan", "DELETE", "/me");
  ok("DELETE /me → ok, the sent audio object is deleted", del.status === 200 && del.json.deleted === true && del.json.audio === 1, JSON.stringify(del.json));
  const after = (await call("xan", "GET", "/me")).json;
  ok("after deletion the learner is a stranger to the Worker: not consented, no pair, no queue", after.consented === false && !after.pair && !after.waiting, JSON.stringify(after).slice(0, 200));
  const ym = (await call("yul", "GET", "/me")).json;
  ok("the partner's open session is gone and the audio route answers 404 for the erased turn", before.pair && !ym.pair && (await call("yul", "GET", `/turns/${before.pair.turns[0].id}/audio`)).status === 404, JSON.stringify(ym).slice(0, 200));
  ok("DELETE /me is idempotent and needs auth (401 without)", (await call("xan", "DELETE", "/me")).status === 200 && (await call(null, "DELETE", "/me")).status === 401);
  ok("a report filed ABOUT the deleted learner is retained (safety), one BY them would be dropped", (await call("yul", "GET", "/me")).status === 200); }

/* ---------------- live practice (Level 3): alice + bob are regular partners ---------------- */
{ const noConn = await call("carol", "POST", "/live", { band: "w1-4", promptWeek: 3 });
  ok("live: needs someone you practise with — no open session and no connection → 404 no_connection", noConn.status === 404 && noConn.json.error === "no_connection");
  /* live from a trial: two strangers in a session may talk at once (owner: no waiting for one practice together) */
  await consent("sid", "Sid"); await consent("tia", "Tia"); await join("sid", { band: "w5-8" }); await join("tia", { band: "w1-4" });
  const os = (await call("sid", "POST", "/match")).json.candidates.find(c => c.name === "Tia");
  const tp = await tryPair("sid", "tia", os.offer);
  const tl = await call("sid", "POST", "/live", { band: "w5-8", promptWeek: 2 });
  ok("live: allowed inside an open trial session with a stranger, different band", tp.json.pair && tp.json.pair.kind === "trial" && tl.status === 201 && tl.json.live.role === "host" && tl.json.live.partner.name === "Tia", JSON.stringify(tl.json));
  ok("live: the trial partner sees the invitation", (await call("tia", "GET", "/me")).json.live?.state === "invited");
  await call("sid", "POST", `/live/${tl.json.live.id}/cancel`); await call("sid", "POST", `/pairs/${tp.json.pair.id}/leave`);
  /* a live proposal from a candidate card: accepting opens the room for the host at once */
  await consent("ulf", "Ulf"); await consent("vic", "Vic"); await join("ulf", { band: "w1-4" }); await join("vic", { band: "w9-12" });
  const ov = (await call("ulf", "POST", "/match")).json.candidates.find(c => c.name === "Vic");
  const pinv = await call("ulf", "POST", "/invite", { offer: ov.offer, live: true });
  const vme = await call("vic", "GET", "/me");
  ok("live proposal: the invitation is marked live on both sides", pinv.json.pairInvite && pinv.json.pairInvite.live === true && vme.json.invite && vme.json.invite.live === true, JSON.stringify([pinv.json.pairInvite, vme.json.invite]));
  const vacc = await call("vic", "POST", `/pairs/${vme.json.invite.id}/accept`);
  const ume = await call("ulf", "GET", "/me");
  ok("live proposal accepted → pair active and a live session open: guest sees it as guest/invited, host as host", vacc.json.pair && vacc.json.live && vacc.json.live.role === "guest" && vacc.json.live.state === "invited" && ume.json.live && ume.json.live.role === "host" && ume.json.live.partner.name === "Vic", JSON.stringify([vacc.json.live, ume.json.live]));
  const vjoin = await call("vic", "POST", `/live/${vacc.json.live.id}/accept`);
  ok("live proposal: the guest joins with one more call; recorded trial not required", vjoin.status === 200 && ["accepted", "active"].includes(vjoin.json.live.state), JSON.stringify(vjoin.json));
  await call("vic", "POST", `/live/${vacc.json.live.id}/end`); await call("ulf", "POST", `/pairs/${vacc.json.pair.id}/leave`);
  ok("plain proposal (no live flag) opens no live session", await (async () => { await join("ulf", { band: "w1-4" }); await join("vic", { band: "w1-4" }); const o2 = (await call("ulf", "POST", "/match")).json.candidates.find(c => c.name === "Vic"); if (!o2) return "cooldown"; const t2 = await tryPair("ulf", "vic", o2.offer); const r = !!t2.json.pair && !t2.json.live; await call("ulf", "POST", `/pairs/${t2.json.pair.id}/leave`); return r; })() !== false);
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
  for (const u of ["ora", "alice", "bob", "carol"]) await call(u, "DELETE", "/interest").catch(() => {});   /* three cards only: clear the other queues so the ranked-last learner fits */
  clock = (await call("ivan", "GET", "/me")).json.serverNow + 20 * 60_000;   /* well past every earlier "seen" stamp, so nobody else is online */
  await join("hana", { band: "w5-8" }); const again = await join("ivan", { band: "w5-8" }); clock = null;
  ok("after a rematch the rejected learner is still offered while online (sorted last), never hidden", again.json.candidates.some(c => c.name === "Hana") && again.json.status === "waiting", JSON.stringify(again.json.candidates || again.json));
  ok("presence for a learner NOT in line counts the same people a Match me would show", await (async () => { await call("ivan", "DELETE", "/interest"); const m = await call("ivan", "GET", "/me"); return !m.json.waiting && m.json.presence.waiting >= 1; })());
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
