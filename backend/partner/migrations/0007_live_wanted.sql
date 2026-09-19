-- A proposal can ask for a live call from the start ("Practise live" on a
-- candidate card): when the guest accepts, the Worker opens the live session
-- for the host at once. 0 = a recorded trial as before. Additive.
ALTER TABLE pairs ADD COLUMN live_wanted INTEGER NOT NULL DEFAULT 0;
