# be-mail — branded password-reset and welcome emails

Fourth production Worker. Sends the BE Mastery password-reset email from
`noreply@lomonec.com` via **Brevo** with the logo, a button, the social links
and the Lomonec footer, in the learner's language (en / fr / es / pt; others
get English).

Why Brevo and not Cloudflare Email Service: Email Service needs the Workers
Paid plan (checked 2026-09-19). The Lomonec Brevo account already has
`lomonec.com` authenticated (DKIM + DMARC green) and a free tier of 300
emails a day, which is far above any password-reset volume.

## Why a Worker and not the Firebase template

Firebase Auth's console lets you change the sender name, sender domain,
reply-to and subject of the reset email — but **not the body**. No logo, no
HTML. So the app calls this Worker, which asks Firebase for the reset *link*
(`accounts:sendOobCode` with `returnOobLink: true`, so Firebase sends nothing
itself) and sends the email through Brevo's transactional API.

`fbReset()` in `index.html` calls `MAIL_API + "/reset"`. If the Worker is
down, not deployed, or answers 5xx, the app falls back to Firebase's own plain
email, so a learner always gets *an* email. Set `MAIL_API` to `""` to disable
the Worker entirely.

## What it never does

- Tell the caller whether an address has an account: unknown address,
  throttled, or sent all return `200 {ok:true}`.
- Store anything. No KV, no logs of addresses (the `console.log` on error
  carries only the error message).
- Send anything but this one transactional email. Brevo marketing lists are
  a different product — this key should be a transactional-only key.

## One-time setup (owner, ~20 minutes)

1. **Service account** — Firebase console → Project settings → Service
   accounts → *Generate new private key*. This downloads a JSON file. Do not
   commit it. Minimal role is fine: in Google Cloud IAM, the account only
   needs *Firebase Authentication Admin* on project `be-mastery`.
2. **Brevo API key** — Brevo → Settings → SMTP & API → API keys → *Generate
   a new API key*, name it `be-mail`. Copy it once; Brevo does not show it
   again. Also check Brevo → Senders, domains & IPs: `lomonec.com` must be
   authenticated (DKIM + DMARC green). `noreply@lomonec.com` works on an
   authenticated domain; if Brevo rejects the sender, add it under Senders.
3. **Secrets**:
   ```
   npx wrangler secret put FB_SA_JSON < ~/Downloads/be-mastery-firebase-adminsdk-XXXX.json
   npx wrangler secret put BREVO_API_KEY   # paste the key at the prompt
   ```
   The `<` matters for the JSON: the prompt takes one line, the file is many.
4. **Deploy**:
   ```
   npx wrangler deploy
   ```
   The Worker lands at `https://be-mail.nore-ngou.workers.dev`, which is
   already the `MAIL_API` constant in `index.html`.
5. **Test** — in the app, sign-in modal → *Forgotten your password?* with a
   real address. The note in the modal names the sender; `noreply@lomonec.com`
   means the Worker sent it, `noreply@be-mastery.firebaseapp.com` means it
   fell back to Firebase. `npx wrangler tail --format pretty` prints
   `reset: sent | limited | no such user` or `mail error …` per request.

## Optional, Firebase side

Authentication → Templates → Password reset: set the sender name to
*BE Mastery* and customise the domain to `lomonec.com`. That brands the
**fallback** email too (subject and sender; body stays Firebase's).

## Limits

- 4 requests per email address per hour, best effort (in-isolate memory). `npx wrangler tail` prints `reset: sent | limited | no such user` per request, never the address. Firebase adds
  its own per-address throttle behind that.
- Brevo free tier: 300 emails/day. The Worker sends one per request, so a
  day of 300 resets would be the first sign of abuse, not a capacity problem.

## Welcome email (`POST /welcome`, 2026-09-19)

Sent once, right after an account is created (`fbWelcome()` in `index.html`,
fire-and-forget after `createUserWithEmailAndPassword`). Roku-style: the
animated hero `mail/welcome.gif` (six frames — tagline, road map, Shadow
Studio, Phrase Lab, Practice Partner, "your first 25 minutes start today";
rebuilt by `node scripts/mail/hero.mjs`, 244 KB), a greeting by name, the
four things to do, the **Open BE Mastery** button, the login address, the
Home-Screen / Google Play tip, and the same footer as the reset email.
en / fr / es / pt; others get English. Brevo tag `welcome`.

**Who may trigger it.** The request carries the learner's own Firebase ID
token (`Authorization: Bearer`), verified against Google's signing keys (aud
= project, iss = securetoken). The Worker then asks Firebase (admin
`accounts:lookup`) when that account was created and sends only if it is
under 30 minutes old — so the route cannot be replayed later, cannot be
aimed at another address (the address comes from Firebase, not the body),
and is once per account (in-isolate, plus the hourly per-address cap).
Wrong origin → 403; no or bad token → 401; old account or repeat → `200
{sent:false}`. Nothing is stored.

**Test.** `cd tests && node mail-welcome.mjs` (12 checks) runs the Worker
locally with Google and Brevo played by the test itself (`backend/mail/.dev.vars`
is written with throwaway keys and is gitignored).

**Reuse.** `renderWelcome()` is the layout to copy for the engagement mails
the owner has in mind (a new TikTok / YouTube / X video, subscription news):
hero image or GIF, one paragraph, one button, a short list, the footer.
Those are marketing mails, not transactional — they need a consent list and
an unsubscribe link (Brevo's list feature), which this Worker deliberately
does not have.
