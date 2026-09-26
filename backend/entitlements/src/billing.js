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

const TOKEN_RE = /^[A-Za-z0-9._-]{16,512}$/;
const fail = (status, why) => ({ ok: false, status, why });

const google_play = {
  id: "google_play",
  configured: env => gp.configured(env),
  async verifyPurchase(ev, { env, deps, now }) {
    const token = String((ev && ev.purchaseToken) || "");
    if (!TOKEN_RE.test(token)) return fail(400, "token");
    let sub; try { sub = await gp.getSubscription(env, token, deps); } catch (e) { return fail(502, e.code || "google"); }
    if (!sub) return fail(404, "unknown_purchase");                       /* Google does not know this token for our app */
    const rec = gp.toRecord(sub, now);
    if (!rec) return fail(422, "not_our_product");
    if (ev.productId && ev.productId !== rec.product) return fail(422, "product_mismatch");
    const link = { provider: "google_play", ext_id: await sha256Hex(enc.encode(token)), secret_ref: token,
      record: { plan: rec.plan, product: rec.product, status: rec.status, starts_at: rec.starts_at, expires_at: rec.expires_at,
        will_renew: sub.subscriptionState === "SUBSCRIPTION_STATE_CANCELED" ? 0 : (rec.status === "active" || rec.status === "grace" ? 1 : null),
        source: "google_play", updated_at: now },
      needsAck: !rec.acknowledged, productId: rec.product };
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
    const v = await this.verifyPurchase({ purchaseToken: sn.purchaseToken }, ctx);
    if (!v.ok) return v.status === 404 ? { ok: true, id, updates: [] } : v;
    return { ok: true, id, updates: v.links };
  },
  async afterBind(link, { env, deps }) {
    /* only a paid purchase is acknowledged: never an ended, refunded or still-unpaid one */
    if (link.needsAck && (link.record.status === "active" || link.record.status === "grace" || link.record.status === "trialing")) {
      try { await gp.acknowledge(env, link.productId, link.secret_ref, deps); } catch (e) {}   /* retried by the next verify / RTDN */
    }
  },
};

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
    return { ok: true, tx, link: { provider: "app_store", ext_id: rec.originalTransactionId,
      record: { plan: rec.plan, product: rec.product, status: rec.status, starts_at: rec.starts_at, expires_at: rec.expires_at,
        will_renew: ren ? (ren.autoRenewStatus === 1 ? 1 : 0) : null, source: "app_store", updated_at: now },
      appAccountToken: rec.appAccountToken, txExpires: rec.txExpires } };
  },
  async verifyPurchase(ev, ctx) {
    const r = await this._link(ev && ev.signedTransaction, ev && ev.signedRenewalInfo, ctx);
    if (!r.ok) return r;
    if (r.ignore) return fail(409, "superseded");      /* an upgraded transaction: the current one is the proof */
    /* the transaction must carry THIS account's appAccountToken: a transaction
       bought on another BE Mastery account (or with none) cannot be claimed */
    if (!r.link.appAccountToken || r.link.appAccountToken !== await as.appAccountToken(ctx.uid, ctx.env)) return fail(403, "account_mismatch");
    return { ok: true, links: [r.link] };
  },
  async notification(req, ctx) {
    let body; try { body = await req.json(); } catch (e) { return fail(400, "json"); }
    let p; try { p = await as.verifyJws(body && body.signedPayload, ctx.env, ctx.now); } catch (e) { return fail(401, "jws_" + e.message); }
    if (!p.notificationUUID) return fail(400, "uuid");
    const id = "as:" + p.notificationUUID, d = p.data || {};
    if (p.notificationType === "TEST") return { ok: true, id, updates: [] };
    if (d.bundleId !== ctx.env.APPLE_BUNDLE_ID) return fail(422, "bundle");
    /* a notification for the other environment (Sandbox at the production URL,
       or the reverse) is acknowledged and changes nothing — answering an error
       would only make Apple retry it for days */
    if (d.environment && !as.environments(ctx.env).includes(d.environment)) return { ok: true, id, updates: [] };
    if (!d.signedTransactionInfo) return { ok: true, id, updates: [] };
    const r = await this._link(d.signedTransactionInfo, d.signedRenewalInfo, ctx);
    if (!r.ok) return r;
    if (r.ignore) return { ok: true, id, updates: [] };
    if (p.notificationType === "REFUND" || p.notificationType === "REVOKE") r.link.record.status = "revoked";
    /* Apple can deliver out of order. A notification whose transaction ended
       BEFORE the period already recorded (an older renewal arriving late) must
       not roll the plan back. Compared on the transaction's own expiry, and only
       against an active record — a grace, expired or revoked row always takes
       the newer word, and a revocation is never stale. */
    if (r.link.record.status !== "revoked" && ctx.env.DB) {
      const cur = await ctx.env.DB.prepare("SELECT status, expires_at FROM purchase_links WHERE provider=? AND ext_id=?").bind("app_store", r.link.ext_id).first();
      if (cur && (cur.status === "active" || cur.status === "trialing") && Number(cur.expires_at) > Number(r.link.txExpires)) return { ok: true, id, updates: [] };
    }
    return { ok: true, id, updates: [{ ...r.link, bindByAccountToken: r.link.appAccountToken }] };
  },
};

/* the RevenueCat slot: named so the route and the docs exist; nothing behind it */
const revenuecat = { id: "revenuecat", configured: () => false, async verifyPurchase() { return fail(501, "not_configured"); }, async notification() { return fail(501, "not_configured"); } };

export const BILLING_PROVIDERS = Object.freeze({ google_play, app_store, revenuecat });
