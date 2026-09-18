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
  const inv = await call("bob", "POST", "/invite", { offer }); pairId = inv.json.pair && inv.json.pair.id;
  ok("invite → trial pair, Alice sees Bob, connection state trial, round 1 of 4", inv.json.status === "paired" && inv.json.pair.kind === "trial" && inv.json.pair.rounds === 4 && inv.json.pair.round === 1 && (await call("alice", "GET", "/me")).json.pair.partner.name === "Bob" && inv.json.pair.connection.state === "trial", JSON.stringify(inv.json)); }
ok("re-using the consumed offer → 404", (await call("bob", "POST", "/invite", { offer })).status === 404);

/* concurrency: two inviters race for the same waiting learner — exactly one wins */
await consent("erin", "Erin"); await consent("fay", "Fay"); await consent("gus", "Gus");
await join("gus"); const oe = (await join("erin")).json.candidates[0].offer, of = (await join("fay")).json.candidates.find(c => c.name === "Gus").offer;
{ const [a, b] = await Promise.all([call("erin", "POST", "/invite", { offer: oe }), call("fay", "POST", "/invite", { offer: of })]);
  const wins = [a, b].filter(x => x.status === 200).length, gone = [a, b].filter(x => (x.status === 409 && x.json.error === "gone") || (x.status === 404 && x.json.error === "offer")).length;
  ok("race for one candidate: exactly one wins, the other is told the offer is gone", wins === 1 && gone === 1, `${a.status} ${b.status}`); }
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

/* rematch: closes the pair, cooldown, not re-offered */
await consent("hana", "Hana", { gender: "f" }); await consent("ivan", "Ivan", { gender: "m" });
await join("hana", { band: "w5-8" }); const oi = (await join("ivan", { band: "w5-8" })).json.candidates[0].offer;
{ const inv = await call("ivan", "POST", "/invite", { offer: oi }); const pid = inv.json.pair.id;
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
{ const inv = await call("kim", "POST", "/invite", { offer: ok2 }); const pid = inv.json.pair.id; await turn("kim", "Hello Jo");
  const base = (await call("kim", "GET", "/me")).json.serverNow; clock = base + 25 * 3_600_000;
  const me = await call("kim", "GET", "/me"); ok("partner silent 25 h → fallback true, canRepair true", me.json.pair.fallback === true && me.json.pair.canRepair === true, JSON.stringify({ f: me.json.pair.fallback, r: me.json.pair.canRepair, h: me.json.pair.partnerSilentH }));
  const rm = await call("kim", "POST", `/pairs/${pid}/decide`, { choice: "rematch" }); ok("rematch after timeout is allowed", rm.status === 200 && !rm.json.pair); clock = null; }

/* report → suspend; block → 403 + never matched; opt-out leaves the queue; limits */
await consent("lee", "Lee"); await consent("mia", "Mia"); await consent("ned", "Ned");
await join("ned", { band: "fnd-1-7" }); const ol = (await join("lee", { band: "fnd-1-7" })).json.candidates[0].offer; const p1 = (await call("lee", "POST", "/invite", { offer: ol })).json.pair.id;
await call("lee", "POST", `/pairs/${p1}/report`, { reason: "harassment" }); await call("lee", "POST", `/pairs/${p1}/leave`);
await join("ned", { band: "fnd-1-7" }); const om = (await join("mia", { band: "fnd-1-7" })).json.candidates[0].offer; const p2 = (await call("mia", "POST", "/invite", { offer: om })).json.pair.id;
{ const rep = await call("mia", "POST", `/pairs/${p2}/report`, { reason: "contact_info" }); const nedMe = await call("ned", "GET", "/me"); const nj = await join("ned", { band: "fnd-1-7" });
  ok("two distinct reporters → suspended 30 d, pair closed, cannot rejoin", rep.status === 200 && nedMe.json.suspendedUntil && !nedMe.json.pair && nj.json.error === "suspended"); }
await consent("olu", "Olu"); await consent("pia", "Pia"); await join("olu", { band: "w1-4" }); const op = (await join("pia", { band: "w1-4" })).json.candidates[0].offer; const p3 = (await call("pia", "POST", "/invite", { offer: op })).json.pair.id;
{ const t = await turn("pia", "Hi Olu"); const blk = await call("olu", "POST", `/pairs/${p3}/block`);
  ok("block: pair closed, blocked side gets 403 on pair and audio", blk.status === 200 && (await call("pia", "GET", `/pairs/${p3}`)).status === 403 && (await call("pia", "GET", `/turns/${t.json.turn.id}/audio`)).status === 403);
  await join("pia", { band: "w1-4" }); const again = await join("olu", { band: "w1-4" }); ok("blocked pair is never a candidate again", again.json.candidates.every(c => c.name !== "Pia"));
  await call("olu", "DELETE", "/interest"); await call("pia", "DELETE", "/interest"); }
{ await join("carol"); const out = await call("carol", "POST", "/prefs", { optedOut: true }); const j = await join("carol");
  ok("opt-out leaves the queue and refuses joining", !out.json.waiting && j.json.error === "opted_out"); await call("carol", "POST", "/prefs", { optedOut: false }); }
{ await consent("quin", "Quin"); let last = 0; for (let i = 0; i < 11; i++) { last = (await join("quin", { band: "w9-12" })).status; if (last === 429) break; } ok("11th queue join in a day → 429", last === 429); await call("quin", "DELETE", "/interest"); }
{ const dup = "abcdefabcdef0123"; await consent("rex", "Rex"); await consent("sam", "Sam"); await join("rex", { band: "w5-8" }); const o = (await join("sam", { band: "w5-8" })).json.candidates[0].offer; await call("sam", "POST", "/invite", { offer: o });
  const a = await turn("sam", "first", { turnId: dup }); const b = await turn("sam", "first", { turnId: dup });
  ok("duplicate turn_id is idempotent", a.status === 201 && b.status === 200 && b.json.duplicate === true);
  ok("audio over 1.5 MB → 413", (await turn("rex", "big", { audio: audioBlob(1_600_000) })).status === 413); }

/* audit + cron */
{ const me = await call("alice", "GET", "/me"); clock = me.json.serverNow + 40 * 86_400_000; const c = await call("alice", "POST", "/__cron"); clock = null;
  ok("cron closes stale pairs and purges audio 14 d after close", c.status === 200 && c.json.purgedTurns >= 1 && (await call("bob", "GET", `/turns/${t1.id}/audio`)).status === 404, JSON.stringify(c.json)); }
ok("kill switch is a Worker setting, reported by /health", "enabled" in H);

/* ID-token verifier */
{ const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const b64u = s => Buffer.from(s).toString("base64url");
  const mk = (payload, kid = "k1") => { const h = b64u(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })), p = b64u(JSON.stringify(payload)); const s = createSign("RSA-SHA256"); s.update(h + "." + p); return h + "." + p + "." + s.sign(privateKey).toString("base64url"); };
  const sec = Math.floor(Date.now() / 1000), good = { aud: "be-mastery", iss: "https://securetoken.google.com/be-mastery", sub: "uid123", iat: sec - 10, exp: sec + 3600 };
  const deps = { keys: [jwk] };
  const r = { ok: await verifyIdToken(mk(good), "be-mastery", deps).catch(e => "ERR " + e.message), aud: await verifyIdToken(mk({ ...good, aud: "x" }), "be-mastery", deps).catch(e => e.message), iss: await verifyIdToken(mk({ ...good, iss: "https://evil" }), "be-mastery", deps).catch(e => e.message), exp: await verifyIdToken(mk({ ...good, exp: sec - 1 }), "be-mastery", deps).catch(e => e.message), kid: await verifyIdToken(mk(good, "k9"), "be-mastery", deps).catch(e => e.message), sig: await verifyIdToken(mk(good).replace(/\.[^.]+$/, ".AAAA"), "be-mastery", deps).catch(e => e.message) };
  ok("ID-token verifier: accepts valid, rejects aud/iss/exp/kid/signature", r.ok === "uid123" && r.aud === "aud" && r.iss === "iss" && r.exp === "expired" && r.kid === "kid" && r.sig === "signature", JSON.stringify(r)); }
ok("screenTranscript: clean text passes, handle rejected", screenTranscript("I work on the second shift") && !screenTranscript("find me at @alice_d"));

const pass = res.filter(r => r.pass).length;
console.log(`\n  ${pass}/${res.length} pass  (${BASE})`);
process.exit(pass === res.length ? 0 : 1);
