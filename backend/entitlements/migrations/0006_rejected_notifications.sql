-- A store notification this service will never be able to act on — a licence
-- test purchase in production, a product that is not ours, another app's
-- bundle id. It is ACKNOWLEDGED (see "ACK OR RETRY" in src/billing.js), so the
-- store stops redelivering it; this table is where it is kept instead, because
-- "we accepted it and did nothing" must leave a trace that can be counted.
--
-- The id is the SAME id as processed_notifications (gp:<messageId> /
-- as:<notificationUUID>), and a row is written only after that table's
-- INSERT OR IGNORE claimed the message, so a redelivery is recorded once.
--
-- Deliberately no purchase token, no uid and no account token: the reason is
-- the operational fact worth keeping, the identifiers are not, and
-- entitlement_audit already records anything that CHANGED a plan.
CREATE TABLE IF NOT EXISTS rejected_notifications (
  id          TEXT    NOT NULL PRIMARY KEY,   -- same id as processed_notifications
  provider    TEXT    NOT NULL,               -- google_play | app_store
  status      INTEGER NOT NULL,               -- the 4xx the rule classified as permanent
  why         TEXT    NOT NULL,               -- test_purchase | not_our_product | bundle | …
  received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rejected_notifications_at ON rejected_notifications(received_at);
