-- One row per widget id AND programme (5 Oct 2026, the Welding widget): a
-- phone may show a General English widget and a Welding widget side by side,
-- each drawn from the last snapshot published while that programme was open.
-- Existing rows were General English or Welding alike under one key; they are
-- kept as 'ge' (the next publish from Welding writes its own row).
CREATE TABLE feeds2 (
  wid    TEXT    NOT NULL,
  area   TEXT    NOT NULL DEFAULT 'ge',
  snap   TEXT    NOT NULL,
  at     INTEGER NOT NULL,
  writes INTEGER NOT NULL DEFAULT 0,
  hour   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (wid, area)
);
INSERT INTO feeds2 (wid, area, snap, at, writes, hour) SELECT wid, 'ge', snap, at, writes, hour FROM feeds;
DROP TABLE feeds;
ALTER TABLE feeds2 RENAME TO feeds;
CREATE INDEX IF NOT EXISTS feeds_at ON feeds(at);
