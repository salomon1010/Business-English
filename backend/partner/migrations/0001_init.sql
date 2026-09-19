-- Practice Partner — see marketing/product/practice-partner/DATA_MODEL.md
CREATE TABLE IF NOT EXISTS members (
  uid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  gender TEXT,
  same_gender INTEGER NOT NULL DEFAULT 0,
  consent_at INTEGER NOT NULL,
  strikes INTEGER NOT NULL DEFAULT 0,
  suspended_until INTEGER,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS interest (
  uid TEXT PRIMARY KEY,
  track TEXT NOT NULL,
  band TEXT NOT NULL,
  lang TEXT NOT NULL,
  prompt_week INTEGER NOT NULL DEFAULT 0,
  fnd_day INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS interest_match ON interest(track, band, created_at);
CREATE TABLE IF NOT EXISTS pairs (
  id TEXT PRIMARY KEY,
  uid_a TEXT NOT NULL,
  uid_b TEXT NOT NULL,
  track TEXT NOT NULL,
  band TEXT NOT NULL,
  prompt_week INTEGER NOT NULL DEFAULT 0,
  fnd_day INTEGER NOT NULL DEFAULT 0,
  week_start INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  closed_reason TEXT,
  seen_a INTEGER NOT NULL DEFAULT 0,
  seen_b INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  closed_at INTEGER
);
CREATE INDEX IF NOT EXISTS pairs_a ON pairs(uid_a, status);
CREATE INDEX IF NOT EXISTS pairs_b ON pairs(uid_b, status);
CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  from_uid TEXT NOT NULL,
  day INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  audio_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  transcript TEXT NOT NULL DEFAULT '',
  score INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS turns_pair ON turns(pair_id, created_at);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  by_uid TEXT NOT NULL,
  about_uid TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(by_uid, about_uid)
);
CREATE TABLE IF NOT EXISTS blocks (
  by_uid TEXT NOT NULL,
  about_uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (by_uid, about_uid)
);
CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0
);
