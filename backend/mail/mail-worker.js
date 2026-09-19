/* ============================================================================
   BE Mastery — transactional email (Cloudflare Worker)
   ----------------------------------------------------------------------------
   Sends the branded password-reset email.

   WHY THIS EXISTS
   ---------------
   Firebase Auth sends its own reset email, but (a) the body cannot be edited
   in the Firebase console — no logo, no footer, plain text only — and (b) the
   default sender, noreply@be-mastery.firebaseapp.com, lands in Gmail's spam
   folder. So the app calls this Worker instead of sendPasswordResetEmail().

   HOW IT WORKS
   ------------
     1. POST /reset {email, lang}  from app.lomonec.com
     2. The Worker mints a Google OAuth token from the Firebase service account
        (RS256 JWT signed with WebCrypto — no SDK, Workers cannot run the Admin
        SDK) and calls Identity Toolkit accounts:sendOobCode with
        returnOobLink:true. Firebase then RETURNS the link and does NOT send
        its own email.
     3. The Worker sends the branded HTML + text email through the Email
        Service binding, from noreply@lomonec.com.

   WHAT IT NEVER TELLS THE CALLER
   ------------------------------
   Whether the address has an account. Unknown email, rate-limited, or sent —
   the response is the same 200 {ok:true}. Only real failures of OUR side
   (bad config, provider down) return 5xx, so the app can fall back to
   Firebase's own email and the learner still gets one.

   SECRETS: FB_SA_JSON — the service-account key JSON (see README.md).
   ============================================================================ */

const ALLOWED_ORIGINS = [
  "https://app.lomonec.com",
  "https://staging.lomonec.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

const IP_PER_HOUR   = 5;      // per address, best effort (per isolate)
const TOKEN_TTL_SEC = 55 * 60;

/* ---------------------------------------------------------------- helpers -- */

const enc = new TextEncoder();

function b64url(bytes){
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function cors(origin){
  const ok = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function json(body, status, origin){
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

/* --------------------------------------------------- Google access token -- */

let tokenCache = { value: null, exp: 0 };

async function accessToken(env){
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.value && tokenCache.exp - 60 > now) return tokenCache.value;

  const sa = JSON.parse(env.FB_SA_JSON);
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);

  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/identitytoolkit",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + TOKEN_TTL_SEC,
  })));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${b64url(new Uint8Array(sig))}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`,
  });
  if (!r.ok) throw new Error("token " + r.status);
  const j = await r.json();
  tokenCache = { value: j.access_token, exp: now + (j.expires_in || 3600) };
  return j.access_token;
}

/* -------------------------------------------------------- Firebase link -- */

/* Returns the reset link, or null when Firebase has no such user (or
   throttles). Throws only for our own failures. */
async function resetLink(env, email, lang){
  const tok = await accessToken(env);
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${tok}`, "Content-Type": "application/json",
               "X-Firebase-Locale": lang },
    body: JSON.stringify({
      requestType: "PASSWORD_RESET",
      email,
      returnOobLink: true,
      continueUrl: env.APP_URL,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.oobLink) return j.oobLink;
  const msg = (j.error && j.error.message) || "";
  if (/EMAIL_NOT_FOUND|TOO_MANY_ATTEMPTS|RESET_PASSWORD_EXCEED_LIMIT/.test(msg)) return null;
  throw new Error("oob " + r.status + " " + msg);
}

/* ----------------------------------------------------------- the email -- */

const COPY = {
  en: {
    subject: "Reset your BE Mastery password",
    preheader: "One tap and you are back to your practice.",
    hello: "Hello,",
    intro: "You asked to reset the password for your BE Mastery account. Tap the button and choose a new one.",
    button: "Reset my password",
    expires: "The link works for one hour.",
    ignore: "If you did not ask for this, ignore this email — your password stays as it is.",
    fallback: "If the button does not work, copy this link into your browser:",
    sign: "See you at your next 25 minutes,",
    team: "The BE Mastery team",
    footer: "BE Mastery is built by Lomonec LLC. You received this because someone asked to reset the password for this address.",
    contact: "Questions? Write to",
  },
  fr: {
    subject: "Réinitialisez votre mot de passe BE Mastery",
    preheader: "Un clic et vous reprenez votre entraînement.",
    hello: "Bonjour,",
    intro: "Vous avez demandé à réinitialiser le mot de passe de votre compte BE Mastery. Appuyez sur le bouton et choisissez-en un nouveau.",
    button: "Réinitialiser mon mot de passe",
    expires: "Le lien est valable une heure.",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.",
    fallback: "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
    sign: "À vos prochaines 25 minutes,",
    team: "L'équipe BE Mastery",
    footer: "BE Mastery est développé par Lomonec LLC. Vous recevez cet e-mail parce qu'une réinitialisation du mot de passe a été demandée pour cette adresse.",
    contact: "Une question ? Écrivez à",
  },
  es: {
    subject: "Restablece tu contraseña de BE Mastery",
    preheader: "Un toque y vuelves a tu práctica.",
    hello: "Hola,",
    intro: "Pediste restablecer la contraseña de tu cuenta de BE Mastery. Toca el botón y elige una nueva.",
    button: "Restablecer mi contraseña",
    expires: "El enlace funciona durante una hora.",
    ignore: "Si no lo pediste, ignora este correo: tu contraseña no cambia.",
    fallback: "Si el botón no funciona, copia este enlace en tu navegador:",
    sign: "Nos vemos en tus próximos 25 minutos,",
    team: "El equipo de BE Mastery",
    footer: "BE Mastery está desarrollado por Lomonec LLC. Recibes este correo porque alguien pidió restablecer la contraseña de esta dirección.",
    contact: "¿Preguntas? Escribe a",
  },
  pt: {
    subject: "Redefina a sua palavra-passe BE Mastery",
    preheader: "Um toque e volta ao seu treino.",
    hello: "Olá,",
    intro: "Pediu para redefinir a palavra-passe da sua conta BE Mastery. Toque no botão e escolha uma nova.",
    button: "Redefinir a minha palavra-passe",
    expires: "O link funciona durante uma hora.",
    ignore: "Se não fez este pedido, ignore este e-mail: a sua palavra-passe mantém-se.",
    fallback: "Se o botão não funcionar, copie este link para o seu navegador:",
    sign: "Até aos seus próximos 25 minutos,",
    team: "A equipa BE Mastery",
    footer: "O BE Mastery é desenvolvido pela Lomonec LLC. Recebeu este e-mail porque alguém pediu para redefinir a palavra-passe deste endereço.",
    contact: "Dúvidas? Escreva para",
  },
};

const SOCIAL = [
  { name: "YouTube",  url: "https://www.youtube.com/@lomonec" },
  { name: "TikTok",   url: "https://www.tiktok.com/@lomonec" },
  { name: "X",        url: "https://x.com/lomonec" },
];

function render(c, link, env){
  const app = env.APP_URL, logo = app + "icon-192.png";
  const social = SOCIAL.map(s =>
    `<a href="${s.url}" style="color:#6d5dfc;text-decoration:none;font-weight:600;margin:0 8px">${s.name}</a>`).join("<span style=\"color:#c7c9d9\">·</span>");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light dark"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1e2e">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4fa"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td align="center" style="padding:32px 24px 8px">
  <a href="${app}" style="text-decoration:none"><img src="${logo}" width="64" height="64" alt="BE Mastery" style="display:block;border-radius:14px"></a>
  <div style="font-size:18px;font-weight:700;margin-top:12px;color:#1c1e2e">BE Mastery</div>
  <div style="font-size:13px;color:#6b6f85;margin-top:2px">Business English, 25 minutes a day</div>
</td></tr>
<tr><td style="padding:16px 32px 8px;font-size:16px;line-height:1.55">
  <p style="margin:0 0 12px">${esc(c.hello)}</p>
  <p style="margin:0 0 20px">${esc(c.intro)}</p>
  <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 20px"><tr><td style="background:#6d5dfc;border-radius:12px">
    <a href="${link}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:700;font-size:16px;text-decoration:none">${esc(c.button)}</a>
  </td></tr></table>
  <p style="margin:0 0 8px;font-size:14px;color:#6b6f85">${esc(c.expires)}</p>
  <p style="margin:0 0 20px;font-size:14px;color:#6b6f85">${esc(c.ignore)}</p>
  <p style="margin:0 0 4px;font-size:12px;color:#9a9db0">${esc(c.fallback)}</p>
  <p style="margin:0 0 24px;font-size:12px;word-break:break-all"><a href="${link}" style="color:#6d5dfc">${esc(link)}</a></p>
  <p style="margin:0">${esc(c.sign)}<br><strong>${esc(c.team)}</strong></p>
</td></tr>
<tr><td align="center" style="padding:20px 32px 28px;border-top:1px solid #ecedf5;font-size:12px;line-height:1.6;color:#9a9db0">
  <div style="margin-bottom:10px">${social}</div>
  <div><a href="${app}" style="color:#6d5dfc;text-decoration:none">app.lomonec.com</a> · ${esc(c.contact)} <a href="mailto:${env.REPLY_TO}" style="color:#6d5dfc;text-decoration:none">${env.REPLY_TO}</a></div>
  <div style="margin-top:8px">${esc(c.footer)}</div>
  <div style="margin-top:4px">© ${new Date().getFullYear()} Lomonec LLC</div>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    "BE Mastery", "", c.hello, "", c.intro, "", c.button + ": " + link, "",
    c.expires, c.ignore, "", c.sign, c.team, "",
    "app.lomonec.com · " + c.contact + " " + env.REPLY_TO,
    SOCIAL.map(s => s.name + ": " + s.url).join(" · "),
    c.footer, "© " + new Date().getFullYear() + " Lomonec LLC",
  ].join("\n");
  return { html, text };
}

/* ----------------------------------------------------------- rate limit -- */

const hits = new Map();   // ip → [timestamps]; per isolate, best effort
function limited(ip){
  const now = Date.now(), keep = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  keep.push(now); hits.set(ip, keep);
  return keep.length > IP_PER_HOUR;
}

/* --------------------------------------------------------------- routes -- */

async function reset(req, env, origin){
  let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, origin); }
  const email = String(body.email || "").trim().toLowerCase();
  const lang  = /^[a-z]{2}$/.test(body.lang || "") ? body.lang : "en";
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "bad email" }, 400, origin);

  const ip = req.headers.get("CF-Connecting-IP") || "?";
  if (limited(ip)) return json({ ok: true }, 200, origin);     // silent, on purpose

  const link = await resetLink(env, email, lang);
  if (!link) return json({ ok: true }, 200, origin);           // unknown user: same answer

  const c = COPY[lang] || COPY.en;
  const { html, text } = render(c, link, env);
  await env.EMAIL.send({
    from: { email: env.FROM_EMAIL, name: env.FROM_NAME },
    to: email,
    replyTo: env.REPLY_TO,
    subject: c.subject,
    html, text,
  });
  return json({ ok: true }, 200, origin);
}

export default {
  async fetch(req, env){
    const origin = req.headers.get("Origin") || "";
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: "origin" }, 403, origin);
    if (req.method !== "POST") return json({ error: "method" }, 405, origin);
    try {
      if (url.pathname === "/reset") return await reset(req, env, origin);
      return json({ error: "not found" }, 404, origin);
    } catch (e) {
      console.log("mail error", e && e.message);
      return json({ error: "mail" }, 502, origin);   // app falls back to Firebase's email
    }
  },
};
