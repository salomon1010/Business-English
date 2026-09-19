-- Which programme a member belongs to, so that a learner who is merely ONLINE
-- (consented, seen in the last minutes, not in line) can be offered as a
-- candidate without ever surfacing a Welding member. Set from /consent and
-- /interest; back-filled from every General English queue row and pair so
-- the pilot accounts count at once. Additive.
ALTER TABLE members ADD COLUMN track TEXT;
UPDATE members SET track='general-english' WHERE uid IN (SELECT uid FROM interest WHERE track='general-english');
UPDATE members SET track='general-english' WHERE uid IN (SELECT uid_a FROM pairs WHERE track='general-english' UNION SELECT uid_b FROM pairs WHERE track='general-english');
