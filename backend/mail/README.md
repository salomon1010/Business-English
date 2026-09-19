# be-mail — branded password-reset email

Fourth production Worker. Sends the BE Mastery password-reset email from
`noreply@lomonec.com` with the logo, a button, the social links and the
Lomonec footer, in the learner's language (en / fr / es / pt; others get
English).

## Why a Worker and not the Firebase template

Firebase Auth's console lets you change the sender name, sender domain,
reply-to and subject of the reset email — but **not the body**. No logo, no
HTML. So the app calls this Worker, which asks Firebase for the reset *link*
(`accounts:sendOobCode` with `returnOobLink: true`, so Firebase sends nothing
itself) and sends the email through Cloudflare Email Service.

`fbReset()` in `index.html` calls `MAIL_API + "/reset"`. If the Worker is
down, not deployed, or answers 5xx, the app falls back to Firebase's own plain
email, so a learner always gets *an* email. Set `MAIL_API` to `""` to disable
the Worker entirely.

## What it never does

- Tell the caller whether an address has an account: unknown address,
  throttled, or sent all return `200 {ok:true}`.
- Store anything. No KV, no logs of addresses (the `console.log` on error
  carries only the error message).
- Send anything but this one transactional email. Email Service is not for
  marketing — keep it that way.

## One-time setup (owner, ~20 minutes)

1. **Service account** — Firebase console → Project settings → Service
   accounts → *Generate new private key*. This downloads a JSON file. Do not
   commit it. Minimal role is fine: in Google Cloud IAM, the account only
   needs *Firebase Authentication Admin* on project `be-mastery`.
2. **Sender domain** — from this folder:
   ```
   npx wrangler email sending enable lomonec.com
   ```
   It prints the DNS records (SPF, DKIM, DMARC). Add them in the Cloudflare
   DNS panel for lomonec.com. Sending fails with `E_SENDER_NOT_VERIFIED`
   until they are live. This is also what keeps the email out of spam.
3. **Secret**:
   ```
   npx wrangler secret put FB_SA_JSON      # paste the whole JSON file, one line
   ```
4. **Deploy**:
   ```
   npx wrangler deploy
   ```
   The Worker lands at `https://be-mail.nore-ngou.workers.dev`, which is
   already the `MAIL_API` constant in `index.html`.
5. **Test** — in the app, sign-in modal → *Forgotten your password?* with a
   real address. The note in the modal names the sender; `noreply@lomonec.com`
   means the Worker sent it, `noreply@be-mastery.firebaseapp.com` means it
   fell back to Firebase. `npx wrangler tail` shows the reason for a fallback.

## Optional, Firebase side

Authentication → Templates → Password reset: set the sender name to
*BE Mastery* and customise the domain to `lomonec.com`. That brands the
**fallback** email too (subject and sender; body stays Firebase's).

## Limits

- 5 requests per IP per hour, best effort (in-isolate memory). Firebase adds
  its own per-address throttle behind that.
- Email Service free-tier quotas apply — see
  https://developers.cloudflare.com/email-service/platform/limits/.
