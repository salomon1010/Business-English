-- The phone's push id (the opaque random id it registered with be-push), so an
-- invitation can wake it with the app closed. Sent by the app as the
-- x-push-id header; never the endpoint itself, which only be-push holds.
ALTER TABLE members ADD COLUMN push_id TEXT;
