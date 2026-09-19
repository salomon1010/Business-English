-- Practice Partner: a trial starts with the other learner's OK. A pair can
-- now be 'invited' (host asked, guest not yet answered, 10-minute window)
-- before it is 'active'. Additive only.
ALTER TABLE pairs ADD COLUMN host TEXT;
ALTER TABLE pairs ADD COLUMN invite_expires INTEGER;
CREATE INDEX IF NOT EXISTS pairs_status ON pairs(status, invite_expires);
