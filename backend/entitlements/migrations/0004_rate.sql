-- Phase 10: per-account, per-minute rate limit on the purchase routes.
-- Every verify / restore costs a call to Google or Apple; a signed-in
-- account looping on them would spend the app's store API quota.
CREATE TABLE IF NOT EXISTS rate_hits (
  uid    TEXT    NOT NULL,
  minute INTEGER NOT NULL,          -- floor(ms / 60000)
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, minute)
);
