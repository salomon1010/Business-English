/* Billing provider interface — Phase 9.

   The ONLY place that knows which store a purchase came from. Each provider
   turns provider evidence into verified, provider-neutral PURCHASE LINKS:

     Link = { provider, ext_id, secret_ref?, bindTo?, supersedes?, revoke?,
              record: { plan, product, status, starts_at, expires_at,
                        will_renew, source, updated_at } }

   Provider contract:
     id
     configured(env)                       has everything it needs (secrets set)?
     verifyPurchase(evidence, ctx)         client evidence → { ok, links } | { ok:false, status, why }
                                           evidence is re-verified with the store; nothing the
                                           client says about state is used
     notification(req, ctx)                a store → server notification → { ok, id, updates } | { ok:false, status, why }
                                           authenticated before anything is read
     afterBind(link, ctx)                  optional (Google: acknowledge)
   ctx = { uid?, env, deps, now }

   The Worker binds links to accounts, recomputes the entitlement and
   de-duplicates notifications — the same code for every provider. A future
   RevenueCat adapter is one more entry here: its webhook becomes
   notification(), its customer-info lookup becomes verifyPurchase(); nothing
   above this file changes. */
import * as gp from "./google-play.js";
import * as as from "./app-store.js";
import { sha256Hex, enc } from "./crypto-util.js";
import { programmeOfStoreId } from "./entitlement-core.js";

const TOKEN_RE = /^[A-Za-z0-9._-]{16,512}$/;
const fail = (status, why) => ({ ok: false, status, why });

/* ACK OR RETRY — the one rule for a store → server notification.
   (29 Oct 2026. Read this before changing any notification() return.)

   Google Pub/Sub and the App Store Server both read ANY non-2xx reply as "not
   delivered" and send the SAME message again, with backoff, for as long as the
   subscription retains it. So the status code on this path is not a report of
   what happened — it is an INSTRUCTION, and there are only two:
     2xx  done, never send this again
     else send it again
   A business rule that refuses a purchase — not our product, a licence-test
   purchase, another app's bundle — cannot be changed by redelivery. Answering
   it with 4xx asks Google to repeat, forever, a question whose answer is
   fixed. That is a refusal to ACCEPT the notification, which is not the same
   as accepting it and declining to act, and only the second is true.

   This was not academic. A permanently refused Play notification was
   redelivered roughly 120,000 times a day from 15 to 29 October 2026 — 84.9%
   of every Worker request on the account, and about 1.38M calls to the Play
   Developer API, some 60% of its daily quota — while Cloudflare recorded ZERO
   errors, because a deliberate 422 is a successful response. See
   docs/RTDN-ACK-CONTRACT.md.

   So: 4xx from a purchase check is PERMANENT — acknowledge it, record why, and
   change nothing. Only 5xx (Google unreachable, our own misconfiguration) is
   worth another delivery, and the dead-letter queue bounds even that.
   Authentication is deliberately NOT covered here: an unsigned or wrongly
   signed notification is refused with 401 before any id is known, because
   acknowledging unauthenticated callers would let anyone silence a store. */
const permanent = status => Number(status) >= 400 && Number(status) < 500;
const refused = (id, v) => ({ ok: true, id, updates: [], rejected: { status: v.status, why: v.why } });

const google_play = {
  id: "google_play",
  configured: env => gp.configured(env),
  async verifyPurchase(ev, ctx) {
    const { env, deps, now } = ctx;
    const token = String((ev && ev.purchaseToken) || "");
    if (!TOKEN_RE.test(token)) return fail(400, "token");
    /* THE TWO-APP SPLIT: PLAY_PACKAGE is an allow-list (General English and
       Welding English are two listings, one entitlement). `hint` is the
       package an RTDN named, so the usual path is still one request; a token
       from the app carries none and is tried against each listing. */
    let hit; try { hit = await gp.getSubscriptionWithPackage(env, token, deps, (ev && ev.packageName) || null); } catch (e) { return fail(502, e.code || "google"); }
    if (!hit) return fail(404, "unknown_purchase");                       /* no listing of ours knows this token */
    const sub = hit.sub;
    /* The listing must map to a configured programme. A misaligned
       PLAY_PACKAGE / APP_PROGRAMMES pair gives null, and a purchase is refused
       rather than filed against the wrong app. */
    const appId = programmeOfStoreId(env, hit.pkg);
    if (!appId) return fail(500, "app_unmapped");
    const rec = gp.toRecord(sub, now);
    if (!rec) return fail(422, "not_our_product");
    /* A LICENCE-TEST PURCHASE MUST NOT BECOME A PRODUCTION ENTITLEMENT
       (owner, 12 Oct 2026). Google marks a licence tester's purchase
       testPurchase, and until now the flag was read off the subscription and
       then dropped on the floor: a free test purchase produced a row
       indistinguishable from a paid one. Apple's side already had this control
       — APPLE_ENVIRONMENTS, strict by default, refusing a Sandbox transaction
       with 422 (test A10) — so this is the same rule on the same terms:
         PLAY_ALLOW_TEST_PURCHASES = "1"   staging / a licence-testing Worker
         unset or anything else            production: test purchases refused
       Strict by default, like APPLE_ENVIRONMENTS, because the dangerous
       direction is a test purchase quietly becoming revenue. */
    if (rec.test && String(env.PLAY_ALLOW_TEST_PURCHASES || "") !== "1") return fail(422, "test_purchase");
    if (ev.productId && ev.productId !== rec.product) return fail(422, "product_mismatch");
    /* a purchase that names an account (the Android app passes our appAccountToken as
       obfuscatedAccountId, 10 Oct 2026) may only be bound to THAT account — as on Apple.
       One that names none (bought before this, or by the TWA) keeps "first bind wins". */
    if (rec.accountId && ctx.uid && env.APP_ACCOUNT_SECRET && rec.accountId !== (await as.appAccountToken(ctx.uid, env)).toLowerCase()) return fail(403, "account_mismatch");
    const link = { provider: "google_play", ext_id: await sha256Hex(enc.encode(token)), secret_ref: token,
      record: { plan: rec.plan, product: rec.product, status: rec.status, starts_at: rec.starts_at, expires_at: rec.expires_at,
        will_renew: sub.subscriptionState === "SUBSCRIPTION_STATE_CANCELED" ? 0 : (rec.status === "active" || rec.status === "trialing" || rec.status === "grace" ? 1 : null),
        source: "google_play", updated_at: now },
      needsAck: !rec.acknowledged, productId: rec.product, packageName: hit.pkg,   /* acknowledge() must use the listing the token belongs to */
      /* PER-APP ENTITLEMENT (12 Oct 2026): which of our apps sold this, taken
         from the listing Google verified the token against — never from the
         client. A purchase grants Premium in that app only. */
      app_id: appId,
      /* lets a notification bind a purchase no account has claimed yet — and acknowledge it
         before Play's 3-day refund, without waiting for the app's next launch */
      ...(rec.accountId ? { bindByAccountToken: rec.accountId } : {}) };
    if (rec.linked) link.supersedes = await sha256Hex(enc.encode(rec.linked));   /* an upgrade / resubscribe replaces the old token */
    return { ok: true, links: [link] };
  },
  async notification(req, ctx) {
    let n; try { n = await gp.verifyRtdn(req, ctx.env, ctx.deps); } catch (e) { return fail(401, e.message); }
    const d = n.data, id = "gp:" + (n.messageId || "");
    if (!n.messageId) return fail(400, "message_id");
    if (d.testNotification) return { ok: true, id, updates: [] };
    if (d.voidedPurchaseNotification) {                                    /* refund / chargeback */
      const t = String(d.voidedPurchaseNotification.purchaseToken || "");
      return { ok: true, id, updates: TOKEN_RE.test(t) ? [{ provider: "google_play", ext_id: await sha256Hex(enc.encode(t)), revoke: true }] : [] };
    }
    const sn = d.subscriptionNotification; if (!sn) return { ok: true, id, updates: [] };
    /* the notification says only "this token changed": ask Google for the truth */
    const v = await this.verifyPurchase({ purchaseToken: sn.purchaseToken, packageName: d.packageName }, ctx);
    /* 404 unknown_purchase was already acknowledged here; every other refusal
       was handed back as an error and asked Google to try again. The rule
       above decides it now: 4xx is accepted and recorded, 5xx is retried. */
    if (!v.ok) return permanent(v.status) ? refused(id, v) : v;
    return { ok: true, id, updates: v.links };
  },
  async afterBind(link, { env, deps }) {
    /* only a paid purchase is acknowledged: never an ended, refunded or still-unpaid one */
    if (link.needsAck && (link.record.status === "active" || link.record.status === "grace" || link.record.status === "trialing")) {
      try { await gp.acknowledge(env, link.productId, link.secret_ref, deps, link.packageName); } catch (e) {}   /* retried by the next verify / RTDN */
    }
  },
};

/* Is this signed transaction OLDER than the period already recorded for the
   same subscription (same originalTransactionId)? Apple delivers out of order,
   and a device can hand over an old transaction (Transaction.updates, a
   restore). An older transaction — renewed, expired OR refunded — must never
   roll back an ACTIVE record whose period runs later: a refund of an earlier
   period leaves the current, paid period standing (Apple: revoke only what the
   refund covers). Compared on the transaction's own expiry; a grace, expired or
   revoked row always takes the newer word, and the current period's own
   transaction (same expiry) is never stale — so its refund does revoke. */
async function appleStale(env, link) {
  if (!env || !env.DB) return false;
  const cur = await env.DB.prepare("SELECT status, expires_at FROM purchase_links WHERE provider=? AND ext_id=?").bind("app_store", link.ext_id).first();
  return !!cur && (cur.status === "active" || cur.status === "trialing") && Number(cur.expires_at) > Number(link.txExpires);
}

const app_store = {
  id: "app_store",
  configured: env => as.configured(env),
  async _link(signedTransaction, signedRenewalInfo, { env, now }) {
    let tx, ren = null;
    try { tx = await as.verifyJws(signedTransaction, env, now); } catch (e) { return fail(401, "jws_" + e.message); }
    if (signedRenewalInfo) { try { ren = await as.verifyJws(signedRenewalInfo, env, now); } catch (e) { return fail(401, "renewal_" + e.message); } }
    if (ren && String(ren.originalTransactionId) !== String(tx.originalTransactionId)) return fail(422, "renewal_mismatch");
    const rec = as.toRecord(tx, ren, env, now);
    if (!rec) return fail(422, "not_our_product");
    if (rec.ignore) return { ok: true, ignore: rec.ignore };
    if (!rec.originalTransactionId) return fail(422, "no_original_id");
    /* the bundle id Apple SIGNED, mapped to one of our apps by configuration */
    const appId = programmeOfStoreId(env, tx.bundleId);
    if (!appId) return fail(500, "app_unmapped");
    return { ok: true, tx, link: { provider: "app_store", ext_id: rec.originalTransactionId, app_id: appId,
      record: { plan: rec.plan, product: rec.product, status: rec.status, starts_at: rec.starts_at, expires_at: rec.expires_at,
        will_renew: ren ? (ren.autoRenewStatus === 1 ? 1 : 0) : null, source: "app_store", updated_at: now },
      appAccountToken: rec.appAccountToken, txExpires: rec.txExpires } };
  },
  async verifyPurchase(ev, ctx) {
    const r = await this._link(ev && ev.signedTransaction, ev && ev.signedRenewalInfo, ctx);
    if (!r.ok) return r;
    if (r.ignore) return fail(409, "superseded");      /* an upgraded transaction: the current one is the proof */
    if (await appleStale(ctx.env, r.link)) return fail(409, "superseded");   /* an older period than the one on record */
    /* the transaction must carry THIS account's appAccountToken: a transaction
       bought on another BE Mastery account (or with none) cannot be claimed */
    if (!r.link.appAccountToken || r.link.appAccountToken !== (await as.appAccountToken(ctx.uid, ctx.env)).toLowerCase()) return fail(403, "account_mismatch");
    return { ok: true, links: [r.link] };
  },
  async notification(req, ctx) {
    let body; try { body = await req.json(); } catch (e) { return fail(400, "json"); }
    let p; try { p = await as.verifyJws(body && body.signedPayload, ctx.env, ctx.now); } catch (e) { return fail(401, "jws_" + e.message); }
    if (!p.notificationUUID) return fail(400, "uuid");
    const id = "as:" + p.notificationUUID, d = p.data || {};
    if (p.notificationType === "TEST") return { ok: true, id, updates: [] };
    /* either app, never a third. Acknowledged, not refused: Apple would retry a
       4xx for days and the bundle id will never become ours (see ACK OR RETRY). */
    if (!as.bundleIds(ctx.env).includes(d.bundleId)) return refused(id, fail(422, "bundle"));
    /* a notification for the other environment (Sandbox at the production URL,
       or the reverse) is acknowledged and changes nothing — answering an error
       would only make Apple retry it for days */
    if (d.environment && !as.environments(ctx.env).includes(d.environment)) return { ok: true, id, updates: [] };
    if (!d.signedTransactionInfo) return { ok: true, id, updates: [] };
    const r = await this._link(d.signedTransactionInfo, d.signedRenewalInfo, ctx);
    if (!r.ok) return permanent(r.status) ? refused(id, r) : r;
    if (r.ignore) return { ok: true, id, updates: [] };
    if (p.notificationType === "REFUND" || p.notificationType === "REVOKE") r.link.record.status = "revoked";
    /* out of order, or a refund of an EARLIER period: acknowledged, nothing changes */
    if (await appleStale(ctx.env, r.link)) return { ok: true, id, updates: [] };
    return { ok: true, id, updates: [{ ...r.link, bindByAccountToken: r.link.appAccountToken }] };
  },
};

/* the RevenueCat slot: named so the route and the docs exist; nothing behind it */
const revenuecat = { id: "revenuecat", configured: () => false, async verifyPurchase() { return fail(501, "not_configured"); }, async notification() { return fail(501, "not_configured"); } };

export const BILLING_PROVIDERS = Object.freeze({ google_play, app_store, revenuecat });
