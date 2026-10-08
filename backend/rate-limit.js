/* BE Mastery — the rate limiter that actually holds (1 October 2026)
   ----------------------------------------------------------------------------
   WHY THIS FILE EXISTS. Every limit in be-polish was a module-scope Map:

       const sttHits = new Map();
       if (rateLimited(ip, sttHits, STT_PER_MIN, STT_PER_DAY)) ...

   A Map lives in ONE isolate. Cloudflare runs as many isolates as it likes,
   in as many colos as it likes, and recycles them whenever it likes, so the
   real ceiling was `limit x isolates` with no upper bound — and a recycle
   handed the caller a fresh allowance. Measured on 1 October 2026: 24 of 24
   requests passed a limit of 20. That is not enforcement; it is a counter
   that happens to count sometimes. The numbers in polish-worker.js were
   therefore documentation, not a brake, and the only thing really standing
   between the key and a runaway bill was the provider's monthly budget cap.

   WHAT REPLACES IT. A Durable Object. A DO id derived from a name is global:
   every isolate, in every colo, that asks for `idFromName("ip:1.2.3.4")`
   reaches the SAME object, and that object handles one request at a time. So
   the count is shared and the check is serialized, which is exactly what a
   rate limit is. One DO per subject (an IP, or an account), holding every
   bucket that subject has, so one round trip can check a route's per-minute
   and per-day windows together.

   WHY NOT the native Rate Limiting binding: it offers 10- and 60-second
   periods only, and half the limits here are per-DAY. One mechanism that can
   express both beats two that disagree.

   FIXED WINDOWS, deliberately. The old code kept a timestamp array (a sliding
   window). A fixed window is one integer per bucket instead of up to 600
   timestamps, which is what makes it cheap enough to store durably. The cost
   is the usual boundary burst: up to 2x the limit across the instant a window
   turns over. For abuse ceilings on AI spend that is an acceptable trade and
   it is stated here rather than discovered later.

   HONEST LIMIT: the fallback at the bottom of this file is the old in-memory
   Map. It runs only when RATE_LIMITER is not bound — the Node test harness, or
   a deploy whose wrangler.toml lost the binding. It reports `degraded: true`
   and it is NOT authoritative. It is here so a missing binding degrades to
   today's behaviour instead of removing every limit, not because a Map is an
   acceptable limiter.
   ============================================================================ */

/* A bucket is { name, limit, windowMs, cost? }. `name` must identify the window
   as well as the route ("stt:min", "stt:day"), because that is the storage key.

   `cost` (default 1) is how much of the bucket this one call consumes. It
   exists for the anonymous ytai pool (owner, 3 Oct 2026), where the thing being
   rationed is not CALLS but SECONDS OF VIDEO: a 30-minute transcript costs six
   times a 5-minute window, and a ceiling counted in calls would let six windows
   through for the price of one. Counting what is actually spent is the only way
   a daily budget means a number of dollars rather than a number of requests.
   Every other caller leaves it unset and nothing about them changes. */

/* ---------------------------------------------------------------- the object */
export class RateLimiter {
  constructor(state, env) { this.state = state; this.env = env; }

  async fetch(request) {
    let body;
    try { body = await request.json(); } catch (e) { return j({ error: "bad_request" }, 400); }
    const buckets = Array.isArray(body && body.buckets) ? body.buckets : null;
    if (!buckets || !buckets.length || buckets.length > 8) return j({ error: "bad_request" }, 400);
    for (const b of buckets) {
      if (!b || typeof b.name !== "string" || !b.name || b.name.length > 64) return j({ error: "bad_request" }, 400);
      if (!Number.isFinite(b.limit) || b.limit < 1) return j({ error: "bad_request" }, 400);
      if (!Number.isFinite(b.windowMs) || b.windowMs < 1000) return j({ error: "bad_request" }, 400);
      if (b.cost !== undefined && (!Number.isFinite(b.cost) || b.cost < 1 || b.cost > 10_000_000)) return j({ error: "bad_request" }, 400);
    }
    /* `now` is accepted ONLY so the tests can wind the clock. A caller cannot
       reach this object: it is bound to be-polish and has no route. */
    const now = Number.isFinite(body.now) ? body.now : Date.now();

    /* ATOMICITY. A DO handles one request at a time, but it can still suspend
       at an await inside one — so two concurrent consumes could both read 19
       and both write 20. blockConcurrencyWhile holds every other request out
       of the object until this read-check-write finishes. Without it a burst
       of N parallel calls admits far more than the limit, which is the exact
       failure the Map had. */
    return await this.state.blockConcurrencyWhile(async () => {
      const keys = buckets.map(b => "b:" + b.name);
      const have = await this.state.storage.get(keys);
      const recs = [];
      let refused = null, longest = 0;

      for (const b of buckets) {
        const k = "b:" + b.name;
        const cur = have.get(k);
        /* a window that has run out is a fresh one; a stored window from the
           future (a clock that went backwards) is also treated as fresh */
        const live = cur && Number.isFinite(cur.resetAt) && cur.resetAt > now && cur.resetAt <= now + b.windowMs;
        const resetAt = live ? cur.resetAt : now + b.windowMs;
        const count = live ? (cur.count || 0) : 0;
        const cost = Number.isFinite(b.cost) ? b.cost : 1;
        recs.push({ k, count, resetAt, b, cost });
        if (resetAt > longest) longest = resetAt;
        /* ALL-OR-NOTHING: the first full bucket refuses the whole call and
           NOTHING is counted, so a refused request does not also consume the
           other windows. A caller hammering a full per-minute bucket cannot
           burn their per-day allowance down by being refused. */
        /* room for THIS call, not merely room for one more: a 30-minute
           transcript must not slip through on the last second of the budget */
        if (count + cost > b.limit && !refused) refused = { bucket: b.name, resetAt };
      }

      if (refused) {
        return j({ ok: false, bucket: refused.bucket, retryAfter: Math.max(1, Math.ceil((refused.resetAt - now) / 1000)) });
      }
      const put = {}, counts = {};
      for (const r of recs) { put[r.k] = { count: r.count + r.cost, resetAt: r.resetAt }; counts[r.b.name] = r.count + r.cost; }
      await this.state.storage.put(put);
      /* storage is billed and kept forever unless something deletes it. The
         alarm fires once the longest window has passed and wipes the object,
         so a one-off caller leaves nothing behind. */
      try {
        const at = await this.state.storage.getAlarm();
        if (at == null || at < longest) await this.state.storage.setAlarm(longest + 1000);
      } catch (e) { /* alarms unavailable (a stub in a test): hygiene only, never correctness */ }
      /* `counts` (5 Oct 2026): what each bucket stands at AFTER this call, so a
         daily allowance can tell the learner "2 of 3 used" without a second
         round trip. Additive — every older caller reads `ok` and nothing else. */
      return j({ ok: true, counts });
    });
  }

  async alarm() {
    const all = await this.state.storage.list({ prefix: "b:" });
    const now = Date.now();
    let next = 0;
    const dead = [];
    for (const [k, v] of all) {
      if (!v || !Number.isFinite(v.resetAt) || v.resetAt <= now) dead.push(k);
      else if (v.resetAt > next) next = v.resetAt;
    }
    if (dead.length) await this.state.storage.delete(dead);
    if (next) { try { await this.state.storage.setAlarm(next + 1000); } catch (e) {} }
    else { try { await this.state.storage.deleteAll(); } catch (e) {} }
  }
}
const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

/* ------------------------------------------------------------- the worker side
   consume(env, subject, buckets) -> { ok, bucket?, retryAfter?, degraded? }

   `subject` is what is being held: "ip:1.2.3.4" or "acct:<uid>". It is the DO
   name, so it must never contain anything caller-chosen that could collide
   with another subject's — both prefixes are added here, not by the caller.

   Fails OPEN on an infrastructure error (the DO is unreachable). That is the
   deliberate choice: a limiter outage must not take every AI feature down with
   it, and the provider budget cap is still underneath. It is logged as
   degraded so it is visible in a tail rather than silent. */
export async function consume(env, subject, buckets) {
  const ns = env && env.RATE_LIMITER;
  if (!ns) return memConsume(subject, buckets);
  try {
    const stub = ns.get(ns.idFromName(subject));
    const r = await stub.fetch("https://rate-limit.invalid/consume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ buckets }),
    });
    if (!r.ok) return { ok: true, degraded: true };
    const out = await r.json();
    return out && out.ok === false ? { ok: false, bucket: out.bucket, retryAfter: out.retryAfter } : { ok: true, counts: (out && out.counts) || {} };
  } catch (e) {
    console.log("rate-limit degraded: " + String((e && e.message) || e));
    return { ok: true, degraded: true };
  }
}

/* ---- the fallback. NOT AUTHORITATIVE. See the header. ---- */
const mem = new Map();          // subject -> Map(bucket -> { count, resetAt })
export function memConsume(subject, buckets, now = Date.now()) {
  let m = mem.get(subject);
  if (!m) { m = new Map(); mem.set(subject, m); }
  const recs = [];
  for (const b of buckets) {
    const cur = m.get(b.name);
    const live = cur && cur.resetAt > now;
    const count = live ? cur.count : 0;
    const resetAt = live ? cur.resetAt : now + b.windowMs;
    const cost = Number.isFinite(b.cost) ? b.cost : 1;
    if (count + cost > b.limit) return { ok: false, bucket: b.name, retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)), degraded: true };
    recs.push([b.name, { count: count + cost, resetAt }]);
  }
  const counts = {};
  for (const [k, v] of recs) { m.set(k, v); counts[k] = v.count; }
  if (mem.size > 5000) mem.clear();      // crude memory guard, as before
  return { ok: true, degraded: true, counts };
}
export function _memReset() { mem.clear(); }     // tests only
