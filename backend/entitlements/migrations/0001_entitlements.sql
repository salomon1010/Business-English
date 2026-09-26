-- BE Mastery entitlements — the server-side source of truth for a learner's plan.
-- One row per account (Firebase uid). No row = the free plan.
-- external_ref holds provider identifiers for reconciliation/support and is
-- never returned to a client.
CREATE TABLE IF NOT EXISTS entitlements (
  uid          TEXT PRIMARY KEY,
  plan         TEXT NOT NULL,              -- free | premium   (entitlement-core PLANS)
  product      TEXT,                       -- premium_monthly | premium_annual | premium_promo | NULL
  status       TEXT NOT NULL,              -- active | trialing | grace | expired | revoked
  starts_at    INTEGER,                    -- ms since epoch; NULL = no start constraint
  expires_at   INTEGER,                    -- ms since epoch; NULL = no end
  source       TEXT,                       -- google_play | app_store | web | promo | manual
  external_ref TEXT,                       -- provider id / owner note — server only
  updated_at   INTEGER NOT NULL
);

-- every change, for support and reconciliation (who/what changed a plan, when)
CREATE TABLE IF NOT EXISTS entitlement_audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         INTEGER NOT NULL,
  uid        TEXT NOT NULL,
  actor      TEXT NOT NULL,                -- admin | provider:<id> | self-erase
  action     TEXT NOT NULL,                -- grant | erase | provider_event
  plan       TEXT,
  status     TEXT,
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS entitlement_audit_uid ON entitlement_audit(uid, ts);
