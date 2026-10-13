/* MIGRATION SAFETY — 0005 (per-app entitlements, 12 Oct 2026).
   Run: node backend/entitlements/test/migration.mjs

   0005 rebuilds `entitlements` to widen its primary key to (uid, app_id).
   Recreating a SQLite table loses any column the copy does not name, and this
   one has a column that 0003 added by ALTER — `will_renew`, which is how a
   CANCELLED-but-still-paid subscription is told apart from a renewing one.
   Dropping it would silently turn every cancellation back into a renewal.
   (It was dropped in the first draft; this suite is why it is not.)

   So: apply 0001-0004, populate with pre-split rows that use every column,
   apply 0005, and prove every value survived unchanged. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
const db = new DatabaseSync(":memory:");
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  — " + d}`); };

for (const f of files.filter(f => f < "0005")) db.exec(readFileSync(new URL(f, dir), "utf8"));
console.log("# applied", files.filter(f => f < "0005").join(", "));

/* pre-split rows that use EVERY column, including the ones added by ALTER */
db.prepare(`INSERT INTO entitlements(uid,plan,product,status,starts_at,expires_at,will_renew,source,external_ref,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?)`).run("u-annual", "premium", "premium_annual", "active", 1000, 99000, 1, "google_play", "ref-a", 5000);
db.prepare(`INSERT INTO entitlements(uid,plan,product,status,starts_at,expires_at,will_renew,source,external_ref,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?)`).run("u-cancelled", "premium", "premium_monthly", "active", 2000, 88000, 0, "app_store", null, 6000);
db.prepare(`INSERT INTO entitlements(uid,plan,product,status,starts_at,expires_at,will_renew,source,external_ref,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?)`).run("u-unknown", "premium", null, "grace", null, null, null, "promo", null, 7000);
db.prepare(`INSERT INTO purchase_links(provider,ext_id,uid,plan,product,source,status,starts_at,expires_at,will_renew,secret_ref,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run("google_play", "ext-1", "u-annual", "premium", "premium_annual", "google_play", "active", 1000, 99000, 1, "sealed-token", 5000);

const before = db.prepare("SELECT * FROM entitlements ORDER BY uid").all();
const beforeLinks = db.prepare("SELECT * FROM purchase_links ORDER BY ext_id").all();

db.exec(readFileSync(new URL("0005_app_scope.sql", dir), "utf8"));
console.log("# applied 0005_app_scope.sql\n");

const after = db.prepare("SELECT * FROM entitlements ORDER BY uid").all();
const afterLinks = db.prepare("SELECT * FROM purchase_links ORDER BY ext_id").all();

ok("M1 · every entitlement row survived", after.length === before.length && after.length === 3, `${before.length} -> ${after.length}`);
const cols = Object.keys(after[0]).sort();
ok("M2 · no column was dropped — will_renew in particular", ["app_id","expires_at","external_ref","plan","product","source","starts_at","status","uid","updated_at","will_renew"].every(c => cols.includes(c)), cols.join(","));
for (const b of before) {
  const a = after.find(x => x.uid === b.uid);
  const same = a && ["plan","product","status","starts_at","expires_at","will_renew","source","external_ref","updated_at"].every(k => String(a[k]) === String(b[k]));
  ok(`M3 · ${b.uid}: every value preserved (will_renew ${b.will_renew})`, same, JSON.stringify({ before: b, after: a }));
}
ok("M4 · every migrated row is attributed to the original app", after.every(r => r.app_id === "general-english"), JSON.stringify(after.map(r => r.app_id)));
ok("M5 · the primary key is now (uid, app_id)", (() => { try { db.prepare("INSERT INTO entitlements(uid,app_id,plan,status,updated_at) VALUES('u-annual','welding','free','expired',1)").run(); return true } catch (e) { return "threw: " + e.message } })() === true);
ok("M6 · …and the same (uid, app_id) twice is still refused", (() => { try { db.prepare("INSERT INTO entitlements(uid,app_id,plan,status,updated_at) VALUES('u-annual','welding','free','expired',2)").run(); return false } catch (e) { return /UNIQUE|PRIMARY/i.test(e.message) } })());
ok("M7 · purchase_links kept every row and value, and gained a NULLABLE app_id",
  afterLinks.length === beforeLinks.length && afterLinks[0].app_id === null
  && ["provider","ext_id","uid","plan","product","source","status","starts_at","expires_at","will_renew","secret_ref","updated_at"].every(k => String(afterLinks[0][k]) === String(beforeLinks[0][k])),
  JSON.stringify({ before: beforeLinks[0], after: afterLinks[0] }));
ok("M8 · the sealed purchase token was not disturbed", afterLinks[0].secret_ref === "sealed-token");
ok("M9 · the migration is idempotent in the sense that matters: re-running the whole set from scratch gives the same shape", (() => {
  const d2 = new DatabaseSync(":memory:"); for (const f of files) d2.exec(readFileSync(new URL(f, dir), "utf8"));
  const c2 = d2.prepare("SELECT * FROM entitlements LIMIT 0").all; return Object.keys(d2.prepare("PRAGMA table_info(entitlements)").all().reduce((a, r) => (a[r.name] = 1, a), {})).sort().join() === cols.join();
})());
const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('entitlements','purchase_links')").all().map(r => r.name);
ok("M10 · the lookup indexes exist", idx.includes("entitlements_uid") && idx.includes("purchase_links_uid_app"), idx.join(","));
/* M11 — the property that decides HOW this migration may be applied.
   The Worker deployed in production is the pre-split code: it inserts into
   entitlements WITHOUT app_id. If app_id were NOT NULL with no default, running
   0005 would break every entitlement write until the new Worker went out, making
   the migration and the deploy one atomic step with an outage in between. The
   DEFAULT is what lets them be done in either order. Remove it and this fails. */
ok("M11 · a pre-split INSERT (no app_id) still works after 0005 — the migration is backward-compatible",
  (() => { try {
    db.prepare(`INSERT INTO entitlements(uid,plan,product,status,starts_at,expires_at,will_renew,source,external_ref,updated_at)
                VALUES('u-oldcode','premium','premium_annual','active',1,2,1,'app_store',NULL,3)`).run();
    const r = db.prepare("SELECT app_id FROM entitlements WHERE uid='u-oldcode'").get();
    return r && r.app_id === "general-english";
  } catch (e) { return "threw: " + e.message; } })() === true,
  "the deployed pre-split Worker could not write after this migration");

const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
