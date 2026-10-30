# Pub/Sub runbook — bounding Play notification redelivery

**Written 29 October 2026. NOTHING IN THIS FILE HAS BEEN RUN.** No Google Cloud
resource has been created, changed, inspected or purged. Every command is for an
owner with console access. Companion: `RTDN-ACK-CONTRACT.md`.

The code fix stops *producing* the storm. This bounds it in the infrastructure,
so the next permanently-refused notification — from any cause, including one
this codebase does not have yet — dies after five attempts instead of never.

**Do this before deploying the Worker.** It is the safety net that makes the
deploy and its rollback safe.

## 0. What you need

- Project **`be-mastery`** — inferred from `FIREBASE_PROJECT_ID` and the RTDN
  service account `firebase-adminsdk-fbsvc@be-mastery.iam.gserviceaccount.com`.
  Confirm before running anything.
- Roles: `roles/pubsub.viewer` to read, `roles/pubsub.editor` to change.
- `gcloud auth login && gcloud config set project be-mastery`

Set once:

```bash
PROJECT=be-mastery
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
SERVICE_AGENT="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"
```

## 1. Identify the exact subscription (read-only)

The push endpoint is the Worker's `RTDN_AUDIENCE`:
`https://entitlements.lomonec.com/v1/billing/google_play`

```bash
gcloud pubsub subscriptions list \
  --format='table(name, topic, pushConfig.pushEndpoint, deadLetterPolicy, retryPolicy)' \
  | grep -i entitlements
```

Record the subscription and topic names. Expect **no** `deadLetterPolicy` and
**no** `retryPolicy` today — see §6 for why the second matters.

Also note the staging endpoint `entitlements-staging.lomonec.com`; it is a
different subscription and should get the same treatment afterwards.

```bash
SUB=<subscription-id-from-above>
```

## 2. Inspect the pending backlog (read-only)

**You cannot `gcloud pubsub subscriptions pull` a push subscription** — pull is
rejected on a push delivery type. Converting it to pull to peek would be a
change to live delivery, so do not. Read the depth from monitoring instead:

```bash
gcloud monitoring time-series list \
  --filter='metric.type="pubsub.googleapis.com/subscription/num_undelivered_messages"
            AND resource.labels.subscription_id="'"$SUB"'"' \
  --format='value(points[0].value.int64Value)'
```

Or read **Pub/Sub → Subscriptions → *(the subscription)* → Metrics →
Unacked message count** in the console.

Record the number. It is the only thing that tells you how long the drain in §7
should take, and it is the figure this audit could not obtain.

The oldest message's age is the companion metric
(`oldest_unacked_message_age`); a value near the subscription's retention period
means messages are about to expire on their own.

## 3. Create the dead-letter topic

```bash
gcloud pubsub topics create play-rtdn-dead-letter
```

## 4. Create its monitoring subscription — before attaching it

A dead-letter topic with no subscription **silently discards** everything sent
to it. Create the subscription first, so nothing is lost between §4 and §5.

```bash
gcloud pubsub subscriptions create play-rtdn-dead-letter-sub \
  --topic=play-rtdn-dead-letter \
  --message-retention-duration=7d \
  --expiration-period=never
```

This one is a **pull** subscription, so dead-lettered messages can be read
safely later (§8) without touching live delivery.

## 5. Grant the service agent the minimum, then attach

Pub/Sub's own service agent publishes to the dead-letter topic and acks on the
source subscription. It needs exactly two roles, nothing broader:

```bash
gcloud pubsub topics add-iam-policy-binding play-rtdn-dead-letter \
  --member="serviceAccount:${SERVICE_AGENT}" --role=roles/pubsub.publisher

gcloud pubsub subscriptions add-iam-policy-binding "$SUB" \
  --member="serviceAccount:${SERVICE_AGENT}" --role=roles/pubsub.subscriber
```

Attach (valid range for max-delivery-attempts is 5–100; 5 is the minimum and the
right choice here):

```bash
gcloud pubsub subscriptions update "$SUB" \
  --dead-letter-topic=play-rtdn-dead-letter \
  --max-delivery-attempts=5
```

Verify:

```bash
gcloud pubsub subscriptions describe "$SUB" --format='yaml(deadLetterPolicy, retryPolicy)'
```

If the IAM bindings are missing or wrong, Pub/Sub does not dead-letter — it
keeps retrying silently. Check the binding took effect before relying on it.

## 6. Set an exponential backoff retry policy

Separate from the dead-letter queue and worth doing in its own right.

```bash
gcloud pubsub subscriptions update "$SUB" \
  --min-retry-delay=60s --max-retry-delay=600s
```

**Inference, not measurement:** with no retry policy set, Pub/Sub redelivers a
failed push without meaningful backoff. A steady ~1.4 deliveries/second from a
backlog that produced only 33 successful notifications in sixteen days is
consistent with fast redelivery of a small stuck set. A 60 s floor alone would
have cut the observed rate by a large factor. Confirm the current policy in §1
before assuming this was a contributor.

## 7. Draining the existing backlog — no purge needed

**Do not purge.** Once the Worker fix is deployed, every backlogged message is
acknowledged on its next delivery and leaves the queue having been properly
processed and recorded in `rejected_notifications`. Nothing is discarded and
nothing is lost.

Expected drain ≈ *backlog from §2* ÷ ~1.4 messages/second.

Watch it fall:

```bash
watch -n 30 "gcloud monitoring time-series list \
  --filter='metric.type=\"pubsub.googleapis.com/subscription/num_undelivered_messages\"
            AND resource.labels.subscription_id=\"$SUB\"' \
  --format='value(points[0].value.int64Value)'"
```

If, and only if, an owner later decides the backlog must be dropped without
being processed, that is `gcloud pubsub subscriptions seek "$SUB" --time=$(date -u +%Y-%m-%dT%H:%M:%SZ)`.
It **permanently discards** every message older than that instant.
**It requires explicit approval and is not part of this plan.**

## 8. Reading what dead-letters later

```bash
gcloud pubsub subscriptions pull play-rtdn-dead-letter-sub \
  --limit=10 --format='yaml(message.attributes, message.publishTime)'
```

Pull without `--auto-ack` so messages stay for inspection. Note these payloads
contain **purchase tokens** — do not paste them into tickets or chat.

## 9. Staging

Repeat §1–§6 for the `entitlements-staging.lomonec.com` subscription with its
own dead-letter topic. Staging sets `PLAY_ALLOW_TEST_PURCHASES = "1"`, so it
refuses far less, but the same unbounded-retry exposure exists.

## What this does not do

- It does not stop the Worker producing retryable answers — that is the code
  fix, and the two are independent.
- It does not tell you *why* messages were refused. That now comes from
  `rejected_notifications` in D1, not from Google.
- `max-delivery-attempts=5` applies per message from the moment it is attached;
  messages already past five attempts are not retroactively dead-lettered.
