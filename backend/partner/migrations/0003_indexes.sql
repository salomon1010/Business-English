-- Practice Partner phase 3: indexes for the paths the daily cron and the
-- connection lookups take. Additive only; safe to re-run.
CREATE INDEX IF NOT EXISTS pairs_status_created ON pairs(status, created_at);
CREATE INDEX IF NOT EXISTS pairs_status_closed ON pairs(status, closed_at);
CREATE INDEX IF NOT EXISTS connections_b ON connections(b, state);
CREATE INDEX IF NOT EXISTS cooldowns_until ON cooldowns(until);
CREATE INDEX IF NOT EXISTS offers_expires ON offers(expires_at);
