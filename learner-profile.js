/* ============================================================================
   BE Mastery — LearnerProfile (Onboarding V2, Phase 0: synchronisation safety)
   --------------------------------------------------------------------------
   General English learner-profile GROUPS, each a last-writer-wins register.
   Pure logic, no DOM, no Firebase — unit-testable in Node, loaded by
   index.html as window.LearnerProfile.

   WHY THIS IS NOT INSIDE S.profile. The shipped sync copies the whole of S
   into one `json` string and, on every pull, merges with
   Object.assign({}, cloud, local): the LOCAL `profile` object replaces the
   cloud one wholesale. An older app, or the Welding app, therefore erases any
   key it does not know the moment it syncs, and no code written now can run
   inside that older client. So these groups live in S.lp, which is stripped
   from the `json` payload and travels in its own top-level Firestore document
   field `lp`. Every existing writer uses set(..., {merge:true}) on
   {json, savedAt, email, updatedAt}, so none of them can touch `lp`.

   A group is {v, t, s}: v the validated value (null = deleted, a tombstone),
   t a hybrid-clock time, s the value's signature. Merge per group: higher t
   wins; a tie is broken by the larger signature, so both devices pick the same
   winner. Merge is commutative, associative and idempotent.

   S.lp = { v:1, g:{ <group>:{v,t,s} }, dirty:{ <group>:1 } }
   `dirty` = groups whose local value has not yet been confirmed in the cloud.
   ============================================================================ */
(function (global) {
  const SCHEMA = 1;
  const DAY = 86400000;
  /* Atomic groups: written, stamped and merged as one unit, never field by field,
     so e.g. roleId from one device can never be paired with roleOther from another. */
  const GROUPS = {
    role: ["role", "roleCat", "roleId", "roleOther"],
    goal: ["goal", "goalId"],
    situations: ["situations", "primarySituation"],
    confidence: ["selfLevel"],
    priorities: ["priorities"],
    methods: ["methods"],
    vocab: ["vocabGoals"],
    native: ["nativeLang"],
    schedule: ["dailyMinutes", "practiceDays", "timeOfDay"]
  };
  const ARRAY_MAX = { situations: 4, priorities: 3, methods: 3, vocab: 3 };
  const STR_MAX = 120, OTHER_MAX = 60, ID_MAX = 64;

  function sig(v) {
    if (v === null) return "∅";
    const walk = x => Array.isArray(x) ? x.map(walk) : x && typeof x === "object" ? Object.keys(x).sort().reduce((o, k) => (o[k] = walk(x[k]), o), {}) : x;
    return JSON.stringify(walk(v));
  }
  const isObj = x => x && typeof x === "object" && !Array.isArray(x);

  /* Returns a cleaned copy of a group value, or null when it is not valid. */
  function validate(group, value) {
    const fields = GROUPS[group];
    if (!fields || !isObj(value)) return null;
    const out = {};
    for (const k of Object.keys(value)) {
      if (!fields.includes(k)) return null;
      const x = value[k];
      if (x === undefined || x === null || x === "") continue;
      if (Array.isArray(x)) {
        if (x.length > (ARRAY_MAX[group] || 0)) return null;
        if (!x.every(i => typeof i === "string" && i && i.length <= ID_MAX)) return null;
        if (new Set(x).size !== x.length) return null;
        out[k] = x.slice();
      } else if (typeof x === "string") {
        if (x.length > (k === "roleOther" ? OTHER_MAX : STR_MAX)) return null;
        out[k] = x;
      } else return null;
    }
    /* dependency rules */
    if (group === "role" && out.roleOther && out.roleId !== "other.other") delete out.roleOther;
    if (group === "situations" && out.primarySituation && !(out.situations || []).includes(out.primarySituation)) delete out.primarySituation;
    return Object.keys(out).length ? out : null;
  }

  function ensure(S) {
    if (!S.lp || typeof S.lp !== "object" || !isObj(S.lp.g)) S.lp = { v: SCHEMA, g: {}, dirty: {} };
    if (!isObj(S.lp.dirty)) S.lp.dirty = {};
    return S.lp;
  }
  function maxT(lp) { return Object.values(lp.g).reduce((m, e) => (e && Number.isFinite(e.t) && e.t > m ? e.t : m), 0); }
  /* Hybrid clock: never behind the wall clock, never behind anything already seen. */
  function nextT(lp, now) { return Math.max(now, maxT(lp) + 1); }
  function newer(a, b) { return a.t > b.t || (a.t === b.t && a.s > b.s); }
  function same(a, b) { return a.t === b.t && a.s === b.s; }

  function set(S, group, value, now) {
    now = now == null ? Date.now() : now;
    const clean = validate(group, value);
    if (!clean) return false;
    const lp = ensure(S), cur = lp.g[group], s = sig(clean);
    if (cur && cur.v !== null && cur.s === s) return false;        // nothing changed
    lp.g[group] = { v: clean, t: nextT(lp, now), s };
    lp.dirty[group] = 1;
    return true;
  }
  /* Clearing is an ordinary stamp, so a stale device cannot bring the value back. */
  function clear(S, group, now) {
    now = now == null ? Date.now() : now;
    if (!GROUPS[group]) return false;
    const lp = ensure(S), cur = lp.g[group];
    if (cur && cur.v === null) return false;
    lp.g[group] = { v: null, t: nextT(lp, now), s: "∅" };
    lp.dirty[group] = 1;
    return true;
  }
  function get(S, group) { const e = S && S.lp && S.lp.g && S.lp.g[group]; return e && e.v ? e.v : null; }
  /* Flat view of every field of every live group, for consumers. */
  function view(S) {
    const out = {};
    for (const g of Object.keys(GROUPS)) { const v = get(S, g); if (v) Object.assign(out, v); }
    return out;
  }

  /* Normalise one entry that came from the cloud; null = ignore it, keep local. */
  function cleanEntry(group, e, now) {
    if (!isObj(e) || !Number.isFinite(e.t) || typeof e.s !== "string") return null;
    const t = Math.min(e.t, now + DAY);                             // a clock far in the future cannot win forever
    if (!GROUPS[group]) return { v: e.v, t, s: e.s, unknown: 1 };    // forward compatibility: keep what we do not understand
    if (e.v === null) return e.s === "∅" ? { v: null, t, s: "∅" } : null;
    const clean = validate(group, e.v);
    if (!clean) return null;
    return { v: clean, t, s: sig(clean) };                           // trust the value, not the sender's signature
  }

  /* Merge the cloud's `lp` field into S.lp. Returns what changed and what still
     has to be written back. */
  function mergeCloud(S, cloudLp, now) {
    now = now == null ? Date.now() : now;
    const res = { changed: false, toPush: [], lost: [] };
    const cg = cloudLp && isObj(cloudLp.g) ? cloudLp.g : {};
    /* reading must never write: a legacy learner with no lp locally and none in the cloud stays exactly as they were */
    if (!Object.keys(cg).length && !(S.lp && isObj(S.lp.g) && Object.keys(S.lp.g).length)) return res;
    const lp = ensure(S);
    for (const group of new Set(Object.keys(lp.g).concat(Object.keys(cg)))) {
      const mine = lp.g[group], theirs = cleanEntry(group, cg[group], now);
      /* no usable cloud entry (absent, or malformed): ours is the only good copy, so write it back */
      if (!theirs) { if (mine) { lp.dirty[group] = 1; res.toPush.push(group); } continue; }
      if (!mine) { lp.g[group] = theirs; res.changed = true; continue; }
      if (same(mine, theirs)) { delete lp.dirty[group]; continue; }
      if (newer(theirs, mine)) {
        if (lp.dirty[group]) res.lost.push(group);                   // an unsent local edit was older: last edit wins
        lp.g[group] = theirs; delete lp.dirty[group]; res.changed = true;
      } else { lp.dirty[group] = 1; res.toPush.push(group); }
    }
    return res;
  }
  function markSent(S, group, entry) {
    const lp = ensure(S), cur = lp.g[group];
    if (cur && entry && same(cur, entry)) delete lp.dirty[group];
  }
  function dirtyGroups(S) { return S && S.lp && S.lp.dirty ? Object.keys(S.lp.dirty).filter(g => S.lp.g[g]) : []; }

  const api = { SCHEMA, GROUPS, validate, sig, set, clear, get, view, mergeCloud, markSent, dirtyGroups, newer, same };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.LearnerProfile = api;
})(typeof window !== "undefined" ? window : globalThis);
