-- Phase 9: platform purchases and how they bind to a BE Mastery account.
--
--   BE Mastery account (Firebase uid)
--          ▲  one account owns a purchase; the FIRST verified binding wins
--          │
--   purchase_links (provider, ext_id)      google_play: sha256(purchase token)
--          │                               app_store:   originalTransactionId
--          │                               manual:      "grant" (owner / promo)
--          ▼
--   entitlements (uid)  — DERIVED: recomputed from the account's links; the
--                         in-force link with the latest expiry wins.
CREATE TABLE IF NOT EXISTS purchase_links (
  provider    TEXT NOT NULL,              -- google_play | app_store | manual
  ext_id      TEXT NOT NULL,
  uid         TEXT NOT NULL,
  plan        TEXT NOT NULL,
  product     TEXT,
  source      TEXT NOT NULL,              -- the provider-neutral label the view shows (google_play | app_store | promo | manual)
  status      TEXT NOT NULL,              -- active | trialing | grace | expired | revoked
  starts_at   INTEGER,
  expires_at  INTEGER,
  will_renew  INTEGER,                    -- 1 renews · 0 cancelled (still paid to expires_at) · NULL unknown
  secret_ref  TEXT,                       -- google_play: the purchase token, needed to ask Google again. Never returned.
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (provider, ext_id)
);
CREATE INDEX IF NOT EXISTS purchase_links_uid ON purchase_links(uid);

-- appAccountToken (StoreKit) → the account it was issued to. One token per account.
CREATE TABLE IF NOT EXISTS app_accounts (
  token      TEXT PRIMARY KEY,
  uid        TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- provider notifications already applied (Pub/Sub messageId, Apple notificationUUID)
CREATE TABLE IF NOT EXISTS processed_notifications (
  id          TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

ALTER TABLE entitlements ADD COLUMN will_renew INTEGER;
