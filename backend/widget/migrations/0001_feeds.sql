-- be-widget: one row per Android widget id. `snap` is the shaped snapshot
-- (widget-worker.js shapeSnap), `at` when it was published, `writes`/`hour`
-- the hourly write counter. Nothing in here identifies a person.
CREATE TABLE IF NOT EXISTS feeds (
  wid    TEXT PRIMARY KEY,
  snap   TEXT    NOT NULL,
  at     INTEGER NOT NULL,
  writes INTEGER NOT NULL DEFAULT 0,
  hour   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS feeds_at ON feeds(at);
