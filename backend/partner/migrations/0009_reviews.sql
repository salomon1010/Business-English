-- Four-round review: one private, topic-aware analysis per learner per
-- completed session (all four rounds together). The other member of the pair
-- can never read it (every read is WHERE uid=caller). json holds the shaped
-- review (see reviewShape in partner-worker.js); round is this learner's
-- session count at the time (1, 2, 3 …), for the across-sessions line.
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  round INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  evidence TEXT,
  model TEXT,
  json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE(pair_id, uid)
);
CREATE INDEX IF NOT EXISTS reviews_uid ON reviews(uid, created_at);
-- per-word pronunciation evidence sent with each turn: {"mode":"ai"|"whisper","list":[{"word","score","note"}]}
ALTER TABLE turns ADD COLUMN words TEXT;
