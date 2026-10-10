/* BE Mastery — CoachStore, the Smart Coach's Durable Object (10 Oct 2026).
   ----------------------------------------------------------------------------
   ONE object per account (idFromName(uid)), so every rule below holds without
   a race: requests are handled one at a time (blockConcurrencyWhile), which is
   what makes "one active programme per track" and idempotent retries true
   rather than likely.

   Keys:  a:<track>  → the id of the open programme of that track (or none)
          p:<id>     → the programme
          h:<track>  → that track's finished / cancelled programmes (newest first, ≤ 30)
          r:<rid>    → the answer to a mutating request, replayed for a retry (2 days)

   The Worker in front (coach-worker.js) has already established WHO is
   asking, that the ACCOUNT's programme is <track>, whether they are Premium,
   and — for a game round — whether be-polish really closed it. Nothing here
   trusts the request for any of those.
   ============================================================================ */
import "../../smart-coach-engine.js";
const E = globalThis.SmartCoachEngine;
const HIST_MAX = 30, RID_TTL = 2 * 86_400_000, RID = /^[a-z0-9-]{8,48}$/, CAT = /^[a-z0-9_-]{1,32}$/;
const MUTATING = new Set(["approve", "reschedule", "pause", "resume", "cancel", "restart", "complete", "mark"]);

const clean = (x, re) => (typeof x === "string" && re.test(x) ? x : null);
function cleanAct(a) {
  if (!a || typeof a !== "object" || !E.ACT[a.type]) return null;
  const out = { type: a.type };
  if (a.mode != null) out.mode = clean(a.mode, /^[a-z]{2,16}$/);
  if (a.cat != null) out.cat = clean(a.cat, CAT);
  return out;
}
function cleanSessions(list) {
  if (!Array.isArray(list) || list.length > 10) return null;
  return list.map((s, i) => ({ i, role: String(s && s.role || ""), act: cleanAct(s && s.act) || { type: "?" },
    minutes: Math.max(1, Math.min(15, Math.floor(+(s && s.minutes) || 5))), date: String(s && s.date || ""), time: String(s && s.time || "") }));
}
/* what the app is shown: the programme, minus the bookkeeping */
function view(p, now) {
  if (!p) return null;
  const { used, ...rest } = p;
  return { ...rest, progress: E.progress(p, now) };
}
function summary(p) {
  return { id: p.id, kind: p.kind, skill: p.objective.skill, cat: p.objective.cat || null, status: p.status, start: p.start, end: p.end,
    endedAt: p.endedAt || null, outcome: p.outcome || null, done: p.sessions.filter(s => s.done).length, total: p.sessions.length, restarts: p.restarts || 0 };
}

export class CoachStore {
  constructor(state) { this.state = state; this.s = state.storage; }
  async fetch(req) {
    let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "bad_request" }, { status: 400 }); }
    const out = await this.state.blockConcurrencyWhile(() => this.handle(b));
    return Response.json(out.body, { status: out.status });
  }
  async handle(b) {
    const op = String(b.op || ""), track = String(b.track || ""), now = +b.now || Date.now(), P = b.payload || {};
    if (!E.TRACKS.includes(track)) return { status: 400, body: { error: "bad_request" } };
    const rid = MUTATING.has(op) ? clean(P.rid, RID) : null;
    if (MUTATING.has(op) && !rid) return { status: 400, body: { error: "rid" } };
    if (rid) {
      const seen = await this.s.get("r:" + rid);
      if (seen && now - seen.at < RID_TTL) return { status: seen.status, body: { ...seen.body, replay: true } };
    }
    const out = await this.run(op, track, now, P, b);
    if (rid && out.status < 500) {
      await this.s.put("r:" + rid, { at: now, status: out.status, body: out.body });
      const rids = ((await this.s.get("rids")) || []).filter(x => now - x.at < RID_TTL);
      rids.push({ id: rid, at: now });
      const drop = rids.length > 300 ? rids.splice(0, rids.length - 300) : [];
      if (drop.length) await this.s.delete(drop.map(x => "r:" + x.id));
      await this.s.put("rids", rids);
    }
    return out;
  }
  async open(track) { const id = await this.s.get("a:" + track); return id ? (await this.s.get("p:" + id)) || null : null; }
  async status(track, now) {
    return { active: view(await this.open(track), now), history: (await this.s.get("h:" + track)) || [] };
  }
  async close(p, status, now) {
    p.status = status; p.endedAt = now; p.outcome = E.outcome(p);
    await this.s.put("p:" + p.id, p);
    await this.s.delete("a:" + p.track);
    const h = (await this.s.get("h:" + p.track)) || [];
    h.unshift(summary(p));
    await this.s.put("h:" + p.track, h.slice(0, HIST_MAX));
  }
  async run(op, track, now, P, b) {
    const ok = async (extra) => ({ status: 200, body: { ok: true, ...(await this.status(track, now)), ...(extra || {}) } });
    const no = (status, error, more) => ({ status, body: { error, ...(more || {}) } });
    if (op === "status") return ok();
    let p = await this.open(track);

    if (op === "approve") {
      const plan = P.plan || {}, K = E.KINDS[plan.kind];
      if (!K) return no(422, "invalid", { errs: ["kind"] });
      if (!E.tzOk(plan.tz)) return no(422, "invalid", { errs: ["tz"] });
      const sessions = cleanSessions(plan.sessions);
      if (!sessions) return no(422, "invalid", { errs: ["count"] });
      const obj = { skill: String(plan.objective && plan.objective.skill || ""), cat: plan.objective && plan.objective.cat != null ? clean(plan.objective.cat, CAT) : null };
      /* the LENGTH comes from the kind, here — never from the request */
      const np = { id: "cp-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8), track, kind: plan.kind, days: K.days, objective: obj,
        start: String(plan.start || ""), end: E.ymdOk(String(plan.start || "")) ? E.addDays(String(plan.start), K.days - 1) : "", tz: plan.tz, sessions,
        status: "active", createdAt: now, approvedAt: now, rev: 1, restarts: 0, attempts: [], used: [],
        why: Array.isArray(plan.why) ? plan.why.slice(0, 6).map(e => ({ k: clean(e && e.k, /^sc\.[a-z_]{2,32}$/) || "sc.ev_none", vars: e && typeof e.vars === "object" ? Object.fromEntries(Object.entries(e.vars).slice(0, 4).map(([k, v]) => [String(k).slice(0, 12), typeof v === "number" ? v : String(v).slice(0, 60)])) : {} })) : [] };
      if (p) {
        /* the same plan sent twice (a second device, a retry without its rid) is the one already open */
        if (E.lockedOf(p) === E.lockedOf(np) && p.start === np.start) return ok({ duplicate: true });
        return no(409, "active_exists", { active: view(p, now) });
      }
      const errs = E.validate(np, { today: E.todayIn(now, np.tz), track });
      if (errs.length) return no(422, "invalid", { errs });
      await this.s.put("p:" + np.id, np);
      await this.s.put("a:" + track, np.id);
      return ok({ approved: np.id });
    }

    if (!p) return no(404, "no_programme");
    const prog = E.progress(p, now);

    if (op === "mark") {
      const s = p.sessions[+P.i]; const st = String(P.state || "");
      if (!s || !["presented", "opened", "started"].includes(st)) return no(400, "bad_request");
      s.marks = s.marks || {}; if (!s.marks[st]) s.marks[st] = now;
      await this.s.put("p:" + p.id, p);
      return ok();
    }
    if (op === "pause") {
      if (p.status !== "active") return no(409, "not_active");
      p.status = "paused"; p.pausedAt = now; p.rev++;
      await this.s.put("p:" + p.id, p); return ok();
    }
    if (op === "resume") {
      if (p.status !== "paused") return no(409, "not_paused");
      p.status = "active"; p.pausedAt = null; p.rev++;
      await this.s.put("p:" + p.id, p); return ok();
    }
    if (op === "cancel") { await this.close(p, "cancelled", now); return ok({ cancelled: p.id }); }

    if (op === "reschedule" || op === "restart") {
      /* only WHEN may change. Anything that names the skill, the length or the
         activities and differs from the stored plan is refused, not ignored */
      for (const k of ["kind", "days", "objective"]) if (P[k] !== undefined && JSON.stringify(P[k]) !== JSON.stringify(k === "objective" ? p.objective : p[k])) return no(409, "locked", { field: k });
      if (op === "restart" && prog.status !== "overdue") return no(409, "not_overdue");
      if (op === "reschedule" && prog.status === "overdue") return no(409, "overdue");
      const next = JSON.parse(JSON.stringify(p));
      if (op === "restart") {
        next.attempts.push({ start: p.start, end: p.end, done: prog.done, closedAt: now });
        next.sessions.forEach(s => { delete s.done; delete s.doneAt; delete s.ref; delete s.ts; delete s.score; delete s.verifiedBy; delete s.marks; });
        next.used = []; next.restarts = (p.restarts || 0) + 1; next.approvedAt = now;
      }
      const anyDone = next.sessions.some(s => s.done);
      if (P.start !== undefined && P.start !== next.start) {
        if (anyDone) return no(409, "started");
        if (!E.ymdOk(String(P.start))) return no(422, "invalid", { errs: ["start"] });
        next.start = String(P.start); next.end = E.addDays(next.start, next.days - 1);
      }
      const today = E.todayIn(now, next.tz);
      for (const x of Array.isArray(P.sessions) ? P.sessions : []) {
        const s = next.sessions[+x.i]; if (!s) return no(422, "invalid", { errs: ["index"] });
        if (x.act !== undefined && E.actKey(x.act || {}) !== E.actKey(s.act)) return no(409, "locked", { field: "act" });
        if (s.done) { if ((x.date && x.date !== s.date) || (x.time && x.time !== s.time)) return no(409, "done_locked", { i: s.i }); continue; }
        if (x.date !== undefined) s.date = String(x.date);
        if (x.time !== undefined) s.time = String(x.time);
      }
      if (next.sessions.some(s => !s.done && s.date < today)) return no(422, "invalid", { errs: ["past"] });
      const errs = E.validate(next, { today: anyDone || op === "reschedule" && next.start === p.start ? null : today, track });
      if (errs.length) return no(422, "invalid", { errs });
      if (E.lockedOf(next) !== E.lockedOf(p)) return no(409, "locked");
      next.rev = (p.rev || 1) + 1; if (op === "restart") next.status = "active";
      await this.s.put("p:" + p.id, next);
      return ok();
    }

    if (op === "complete") {
      if (b.premium !== true) return no(402, "premium_required");
      if (p.status === "paused") return no(409, "paused");
      if (prog.status === "overdue") return no(409, "overdue");
      const s = p.sessions[+P.i], ev = P.ev || {};
      if (!s) return no(400, "bad_request");
      const ref = String(ev.ref || "").slice(0, 64);
      if (s.done) return s.ref === ref ? ok({ duplicate: true }) : no(409, "already_done");
      const first = p.sessions.find(x => !x.done);
      if (first !== s) return no(409, "order", { next: first ? first.i : null });
      const rec = { type: String(ev.type || ""), ref, ts: +ev.ts || 0, mode: ev.mode, cat: ev.cat, cats: Array.isArray(ev.cats) ? ev.cats.slice(0, 10).map(String) : [],
        n: Math.max(0, Math.min(100, Math.floor(+ev.n || 0))), score: ev.score == null ? null : Math.max(0, Math.min(100, Math.round(+ev.score))) };
      if (!ref) return no(422, "evidence", { why: "ref" });
      if (!E.matches(s.act, rec)) return no(422, "evidence", { why: "activity" });
      const w = E.windowOf(p, s);
      if (rec.ts < w.from || rec.ts >= w.to || rec.ts > now + 120_000) return no(422, "evidence", { why: "window" });
      if ((p.used || []).includes(rec.type + ":" + ref)) return no(409, "evidence_used");
      /* a game round is complete only when be-polish closed it (the Worker asked) */
      if (s.act.type === "game" && b.serverVerified !== true) return no(409, "not_confirmed");
      Object.assign(s, { done: true, doneAt: now, ref, ts: rec.ts, verifiedBy: s.act.type === "game" ? "server" : "device" });
      if (E.ACT[s.act.type].measured) s.score = rec.score;
      (p.used = p.used || []).push(rec.type + ":" + ref);
      p.rev++;
      if (p.sessions.every(x => x.done)) { await this.close(p, "completed", now); return ok({ completed: p.id, outcome: p.outcome }); }
      await this.s.put("p:" + p.id, p);
      return ok();
    }
    return no(400, "bad_request");
  }
}
