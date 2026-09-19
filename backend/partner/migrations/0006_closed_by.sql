-- Who closed a session, so the other learner can be told ("Troy left today's
-- practice") without guessing. NULL = the system (expiry, completion). Additive.
ALTER TABLE pairs ADD COLUMN closed_by TEXT;
