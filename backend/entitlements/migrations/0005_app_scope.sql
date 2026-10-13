-- 0005 — PER-APP ENTITLEMENTS (owner, 12 Oct 2026; docs/APP_SPLIT.md § Premium)
--
-- BE Mastery is two store apps now: General English and Welding English. The
-- owner's rule is that a purchase made in one app grants Premium in THAT app
-- only. So every purchase link records WHICH app sold it, and the derived
-- entitlement row is per (account, app) rather than per account.
--
-- app_id is the PROGRAMME ("general-english" / "welding"), not a store id, so
-- one value covers both platforms: an iPhone purchase and an Android purchase
-- in the same app are the same app.
--
-- NULL app_id = a purchase made before the split, which can only have come
-- from the original app. Every read treats NULL as the FIRST programme in
-- APP_PROGRAMMES, so no existing subscriber loses anything and a
-- single-app configuration behaves exactly as it did.

ALTER TABLE purchase_links ADD COLUMN app_id TEXT;          -- NULL = the original app
CREATE INDEX IF NOT EXISTS purchase_links_uid_app ON purchase_links(uid, app_id);

-- `entitlements` is a DERIVED cache (recompute() rebuilds it from the links),
-- so it is safe to rebuild with a wider key. SQLite cannot change a primary
-- key in place; this is the standard recreate-and-copy.
-- The column list is 0001 PLUS will_renew, which 0003 added with ALTER TABLE.
-- Recreating a table loses anything not copied, so every column is named here
-- explicitly rather than relying on SELECT *.
CREATE TABLE entitlements_new (
  uid          TEXT NOT NULL,
  -- DEFAULT makes this migration BACKWARD-COMPATIBLE, which decides whether it
  -- can be applied safely (verified 12 Oct 2026). Without it, the Worker that is
  -- deployed today — the pre-split code, which inserts no app_id — fails every
  -- entitlement write the moment this runs: "NOT NULL constraint failed:
  -- entitlements.app_id". That would make the migration and the deploy a single
  -- atomic step with an outage between them. With it, old code and new code both
  -- write correctly, so the two can be done in either order, minutes apart.
  -- 'general-english' is not a new assumption: it is what the backfill below
  -- writes for every pre-split row, and what appOf() already resolves a missing
  -- app to (entitlement-core.js: `stored || defaultProgramme(env)`).
  app_id       TEXT NOT NULL DEFAULT 'general-english',   -- the programme this row is about
  plan         TEXT NOT NULL,              -- free | premium   (entitlement-core PLANS)
  product      TEXT,
  status       TEXT NOT NULL,              -- active | trialing | grace | expired | revoked
  starts_at    INTEGER,
  expires_at   INTEGER,
  will_renew   INTEGER,                    -- 1 renews · 0 cancelled (still paid to expires_at) · NULL unknown
  source       TEXT,
  external_ref TEXT,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (uid, app_id)
);
-- every existing row is the original app's
INSERT INTO entitlements_new (uid, app_id, plan, product, status, starts_at, expires_at, will_renew, source, external_ref, updated_at)
  SELECT uid, 'general-english', plan, product, status, starts_at, expires_at, will_renew, source, external_ref, updated_at FROM entitlements;
DROP TABLE entitlements;
ALTER TABLE entitlements_new RENAME TO entitlements;
CREATE INDEX IF NOT EXISTS entitlements_uid ON entitlements(uid);
