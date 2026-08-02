/* Generate the VAPID key pair for BE Mastery reminders.
 *
 *     node backend/push/genkeys.js
 *
 * Run it yourself and paste the output where it says. Do NOT let the private
 * key reach this repo — it is public. It goes into Cloudflare as a secret:
 *
 *     npx wrangler secret put VAPID_PRIVATE_JWK
 *
 * The pair is permanent. Rotating it invalidates every existing subscription,
 * so every user would have to toggle reminders off and on again.
 */
const { webcrypto } = require("crypto");

(async () => {
  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
  );

  const priv = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
  const raw  = await webcrypto.subtle.exportKey("raw", pair.publicKey);
  const pub  = Buffer.from(raw).toString("base64url");

  console.log("\n1. Worker SECRET — npx wrangler secret put VAPID_PRIVATE_JWK");
  console.log("   paste this whole line when prompted:\n");
  console.log("   " + JSON.stringify(priv));
  console.log("\n2. Worker VAR — wrangler.toml, VAPID_PUBLIC_KEY:\n");
  console.log("   " + pub);
  console.log("\nThe public key is also served from GET /key, so index.html");
  console.log("does not hard-code it and rotation needs no site deploy.\n");
})();
