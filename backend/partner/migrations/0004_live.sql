-- Practice Partner Level 3: live human practice. A live session is a short
-- real-time voice call between two CONNECTED partners (mutual/regular). The
-- Worker owns the state machine; peers exchange WebRTC signalling through
-- append-only rows here. No audio is ever stored for live practice.
-- Additive only.
CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL, guest TEXT NOT NULL,
  state TEXT NOT NULL,                 -- invited accepted connecting active reconnecting ended declined cancelled expired failed
  band TEXT, prompt_week INTEGER NOT NULL DEFAULT 0, fnd_day INTEGER NOT NULL DEFAULT 0, prompt_json TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  accepted_at INTEGER, started_at INTEGER, ended_at INTEGER, end_reason TEXT,
  expires_at INTEGER NOT NULL,
  host_seen INTEGER, guest_seen INTEGER
);
CREATE INDEX IF NOT EXISTS live_host ON live_sessions(host, state);
CREATE INDEX IF NOT EXISTS live_guest ON live_sessions(guest, state);
CREATE INDEX IF NOT EXISTS live_expires ON live_sessions(state, expires_at);
CREATE TABLE IF NOT EXISTS live_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL, from_uid TEXT NOT NULL,
  kind TEXT NOT NULL,                  -- offer answer ice round bye
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS live_signals_s ON live_signals(session_id, id);
