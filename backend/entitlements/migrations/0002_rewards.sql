-- Rewarded ads (Phase 8). A reward is earned in three server-side steps:
--   1. the signed-in learner asks to start one          → a single-use nonce
--   2. the ad network confirms, server to server, that
--      the ad bound to that nonce was watched            → verified_at + provider_txn
--   3. the learner claims it                             → claimed_at, credit +amount
-- A client can never mark a session verified, a nonce is claimed at most once,
-- and one provider transaction can verify at most one session.
CREATE TABLE IF NOT EXISTS reward_sessions (
  nonce        TEXT PRIMARY KEY,
  uid          TEXT NOT NULL,
  kind         TEXT NOT NULL,          -- entitlement-core REWARD_KINDS
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  provider     TEXT,                   -- set at verification
  provider_txn TEXT UNIQUE,            -- the network's transaction id: replay guard
  verified_at  INTEGER,
  claimed_at   INTEGER
);
CREATE INDEX IF NOT EXISTS reward_sessions_uid ON reward_sessions(uid, kind, claimed_at);

-- what a learner has earned and not yet spent, per kind
CREATE TABLE IF NOT EXISTS reward_credits (
  uid        TEXT NOT NULL,
  kind       TEXT NOT NULL,
  balance    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (uid, kind)
);
