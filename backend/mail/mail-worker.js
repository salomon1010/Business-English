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
     3. The Worker sends the branded HTML + text email through Brevo's
        transactional API, from noreply@lomonec.com. (Cloudflare Email
        Service needs the Workers Paid plan; Brevo already has lomonec.com
        authenticated — DKIM + DMARC — and a free tier.)

   WHAT IT NEVER TELLS THE CALLER
   ------------------------------
   Whether the address has an account. Unknown email, rate-limited, or sent —
   the response is the same 200 {ok:true}. Only real failures of OUR side
   (bad config, provider down) return 5xx, so the app can fall back to
   Firebase's own email and the learner still gets one.

   SECRETS: FB_SA_JSON — the service-account key JSON; BREVO_API_KEY (see README.md).
   ============================================================================ */

const ALLOWED_ORIGINS = [
  "https://app.lomonec.com",
  "https://staging.lomonec.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

const PER_HOUR      = 4;      // per email address, best effort (per isolate)
const TOKEN_TTL_SEC = 55 * 60;
/* Welcome email (owner, 2026-09-19): sent once, right after an account is
   created. The caller proves who they are with their Firebase ID token; the
   Worker then checks with Firebase that the account really was created in the
   last WELCOME_WINDOW_SEC, so the route cannot be replayed later or aimed at
   someone else's address. The test suite points these three URLs at a stub. */
const WELCOME_WINDOW_SEC = 30 * 60;
const JWKS_URL   = env => env.JWKS_URL   || "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const TOKEN_URL  = env => env.TOKEN_URL  || "https://oauth2.googleapis.com/token";
const IDTK_URL   = env => env.IDTK_URL   || "https://identitytoolkit.googleapis.com/v1";
const BREVO_URL  = env => env.BREVO_URL  || "https://api.brevo.com/v3/smtp/email";

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

  const r = await fetch(TOKEN_URL(env), {
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
    `${IDTK_URL(env)}/accounts:sendOobCode`, {
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

/* Keyed by the address, not the caller's IP: a whole household or office
   behind one IP must not lock each other out, and one address is what a
   flood would hammer. Per isolate, so best effort — Firebase's own
   per-address throttle sits behind it. */
const hits = new Map();   // email → [timestamps]
function limited(email){
  const now = Date.now(), keep = (hits.get(email) || []).filter(t => now - t < 3600e3);
  keep.push(now); hits.set(email, keep);
  return keep.length > PER_HOUR;
}

/* --------------------------------------------------------------- routes -- */

async function reset(req, env, origin){
  let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, origin); }
  const email = String(body.email || "").trim().toLowerCase();
  const lang  = /^[a-z]{2}$/.test(body.lang || "") ? body.lang : "en";
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "bad email" }, 400, origin);

  /* The console.log lines carry the outcome only — never the address — so
     `wrangler tail` can say why nothing arrived. */
  if (limited(email)) { console.log("reset: limited"); return json({ ok: true }, 200, origin); }

  const link = await resetLink(env, email, lang);
  if (!link) { console.log("reset: no such user or firebase throttle"); return json({ ok: true }, 200, origin); }

  const c = COPY[lang] || COPY.en;
  const { html, text } = render(c, link, env);
  const r = await fetch(BREVO_URL(env), {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      sender: { email: env.FROM_EMAIL, name: env.FROM_NAME },
      to: [{ email }],
      replyTo: { email: env.REPLY_TO },
      subject: c.subject,
      htmlContent: html,
      textContent: text,
      tags: ["password-reset"],
    }),
  });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("brevo " + r.status + " " + (res.code || "") + " " + (res.message || ""));
  console.log("reset: sent", lang, (res && res.messageId) || "");
  return json({ ok: true }, 200, origin);
}

/* ------------------------------------------------- Firebase ID token -- */

let jwksCache = { at: 0, keys: null };
const b64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
async function jwks(env, force){
  if (!force && jwksCache.keys && Date.now() - jwksCache.at < 3600e3) return jwksCache.keys;
  const r = await fetch(JWKS_URL(env)); if (!r.ok) throw new Error("jwks " + r.status);
  jwksCache = { at: Date.now(), keys: (await r.json()).keys || [] }; return jwksCache.keys;
}
/* Same rules as the partner Worker's verifier: RS256 from Google's rotating
   keys, aud = the project, iss = securetoken, not expired. Returns {uid, email}. */
async function verifyIdToken(env, token){
  const parts = String(token || "").split("."); if (parts.length !== 3) throw new Error("malformed");
  const header = JSON.parse(new TextDecoder().decode(b64u(parts[0]))), payload = JSON.parse(new TextDecoder().decode(b64u(parts[1])));
  if (header.alg !== "RS256" || !header.kid) throw new Error("alg");
  let keys = await jwks(env); let jwk = keys.find(k => k.kid === header.kid);
  if (!jwk && Date.now() - jwksCache.at > 60e3) { keys = await jwks(env, true); jwk = keys.find(k => k.kid === header.kid); }
  if (!jwk || jwk.kty !== "RSA") throw new Error("kid");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!(await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, b64u(parts[2]), enc.encode(parts[0] + "." + parts[1])))) throw new Error("signature");
  const sec = Math.floor(Date.now() / 1000);
  if (payload.aud !== env.FB_PROJECT_ID) throw new Error("aud");
  if (payload.iss !== "https://securetoken.google.com/" + env.FB_PROJECT_ID) throw new Error("iss");
  if (!(payload.exp > sec)) throw new Error("expired");
  if (!payload.sub || !payload.email) throw new Error("sub");
  return { uid: payload.sub, email: String(payload.email).toLowerCase() };
}
/* when the account was created, from Firebase itself (admin lookup) */
async function createdAt(env, uid){
  const tok = await accessToken(env);
  const r = await fetch(`${IDTK_URL(env)}/accounts:lookup`, { method: "POST", headers: { "Authorization": `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ localId: [uid] }) });
  const j = await r.json().catch(() => ({}));
  const u = j.users && j.users[0]; if (!u) throw new Error("lookup " + r.status);
  return { createdAt: Number(u.createdAt) || 0, email: String(u.email || "").toLowerCase() };
}

/* ---------------------------------------------------------- welcome -- */

const WELCOME = {
  en: {
    subject: "Welcome to BE Mastery — your first 25 minutes start today",
    preheader: "Your account is ready. Here is what you can do with it.",
    hello: n => n ? `Hello ${n},` : "Hello,",
    intro: "Thank you for creating your BE Mastery account. From today, 25 focused minutes a day turn hesitant English into confident, professional English — the version of you who hesitates in meetings begins to disappear.",
    what: "What you can do right now",
    items: [
      ["Your road map", "A 12-week plan with one clear step every day. Start with the one-minute check — it places you where you belong."],
      ["Shadow Studio", "Copy a native speaker's rhythm, line by line, and hear yourself improve take by take."],
      ["Phrase Lab & Executive Polish", "This week's phrases, and your own sentences rewritten boardroom-ready."],
      ["Practice Partner", "Short voice turns with a real learner on today's lesson — no scheduling, no small talk."],
    ],
    button: "Open BE Mastery",
    account: e => `Your login is ${e}. Your progress is saved to your account and follows you to any device.`,
    install: "Tip: add BE Mastery to your Home Screen (or get it on Google Play) so your daily reminder can reach you.",
    sign: "See you at your first 25 minutes,",
    team: "The BE Mastery team",
    footer: "BE Mastery is built by Lomonec LLC. You received this because an account was created with this address.",
    contact: "Questions? Write to",
  },
  fr: {
    subject: "Bienvenue sur BE Mastery — vos 25 premières minutes commencent aujourd'hui",
    preheader: "Votre compte est prêt. Voici ce que vous pouvez faire avec.",
    hello: n => n ? `Bonjour ${n},` : "Bonjour,",
    intro: "Merci d'avoir créé votre compte BE Mastery. À partir d'aujourd'hui, 25 minutes concentrées par jour transforment un anglais hésitant en un anglais professionnel et sûr — la version de vous qui hésite en réunion commence à disparaître.",
    what: "Ce que vous pouvez faire dès maintenant",
    items: [
      ["Votre feuille de route", "Un plan de 12 semaines avec une étape claire chaque jour. Commencez par le test d'une minute : il vous place là où vous êtes."],
      ["Shadow Studio", "Imitez le rythme d'un locuteur natif, ligne par ligne, et entendez-vous progresser prise après prise."],
      ["Phrase Lab & Executive Polish", "Les phrases de la semaine, et vos propres phrases réécrites pour la salle de réunion."],
      ["Practice Partner", "De courts tours de parole avec un vrai apprenant sur la leçon du jour — sans rendez-vous, sans bavardage."],
    ],
    button: "Ouvrir BE Mastery",
    account: e => `Votre identifiant est ${e}. Votre progression est enregistrée dans votre compte et vous suit sur tous vos appareils.`,
    install: "Astuce : ajoutez BE Mastery à votre écran d'accueil (ou téléchargez-le sur Google Play) pour recevoir votre rappel quotidien.",
    sign: "À vos 25 premières minutes,",
    team: "L'équipe BE Mastery",
    footer: "BE Mastery est développé par Lomonec LLC. Vous recevez cet e-mail parce qu'un compte a été créé avec cette adresse.",
    contact: "Une question ? Écrivez à",
  },
  es: {
    subject: "Bienvenido a BE Mastery: tus primeros 25 minutos empiezan hoy",
    preheader: "Tu cuenta está lista. Esto es lo que puedes hacer con ella.",
    hello: n => n ? `Hola ${n},` : "Hola,",
    intro: "Gracias por crear tu cuenta de BE Mastery. Desde hoy, 25 minutos concentrados al día convierten un inglés dubitativo en un inglés profesional y seguro: la versión de ti que duda en las reuniones empieza a desaparecer.",
    what: "Lo que puedes hacer ahora mismo",
    items: [
      ["Tu hoja de ruta", "Un plan de 12 semanas con un paso claro cada día. Empieza por la prueba de un minuto: te sitúa donde te corresponde."],
      ["Shadow Studio", "Copia el ritmo de un hablante nativo, línea a línea, y escúchate mejorar toma a toma."],
      ["Phrase Lab & Executive Polish", "Las frases de la semana y tus propias frases reescritas para la sala de reuniones."],
      ["Practice Partner", "Turnos de voz cortos con un alumno real sobre la lección de hoy, sin citas ni charla de relleno."],
    ],
    button: "Abrir BE Mastery",
    account: e => `Tu usuario es ${e}. Tu progreso se guarda en tu cuenta y te sigue a cualquier dispositivo.`,
    install: "Consejo: añade BE Mastery a tu pantalla de inicio (o descárgalo en Google Play) para que te llegue el recordatorio diario.",
    sign: "Nos vemos en tus primeros 25 minutos,",
    team: "El equipo de BE Mastery",
    footer: "BE Mastery está desarrollado por Lomonec LLC. Recibes este correo porque se creó una cuenta con esta dirección.",
    contact: "¿Preguntas? Escribe a",
  },
  pt: {
    subject: "Bem-vindo ao BE Mastery — os seus primeiros 25 minutos começam hoje",
    preheader: "A sua conta está pronta. Eis o que pode fazer com ela.",
    hello: n => n ? `Olá ${n},` : "Olá,",
    intro: "Obrigado por criar a sua conta BE Mastery. A partir de hoje, 25 minutos concentrados por dia transformam um inglês hesitante num inglês profissional e confiante — a versão de si que hesita nas reuniões começa a desaparecer.",
    what: "O que pode fazer agora mesmo",
    items: [
      ["O seu roteiro", "Um plano de 12 semanas com um passo claro todos os dias. Comece pelo teste de um minuto — coloca-o onde pertence."],
      ["Shadow Studio", "Copie o ritmo de um falante nativo, linha a linha, e ouça-se melhorar take a take."],
      ["Phrase Lab & Executive Polish", "As frases da semana e as suas próprias frases reescritas para a sala de reuniões."],
      ["Practice Partner", "Turnos de voz curtos com um aprendente real sobre a lição de hoje — sem marcações, sem conversa fiada."],
    ],
    button: "Abrir o BE Mastery",
    account: e => `O seu login é ${e}. O seu progresso fica guardado na conta e acompanha-o em qualquer dispositivo.`,
    install: "Dica: adicione o BE Mastery ao ecrã principal (ou obtenha-o no Google Play) para receber o lembrete diário.",
    sign: "Até aos seus primeiros 25 minutos,",
    team: "A equipa BE Mastery",
    footer: "O BE Mastery é desenvolvido pela Lomonec LLC. Recebeu este e-mail porque foi criada uma conta com este endereço.",
    contact: "Dúvidas? Escreva para",
  },
};
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.bemastery.app";

function renderWelcome(c, name, email, env){
  const app = env.APP_URL, logo = app + "icon-192.png", hero = app + "mail/welcome.gif";
  const social = SOCIAL.map(s => `<a href="${s.url}" style="color:#6d5dfc;text-decoration:none;font-weight:600;margin:0 8px">${s.name}</a>`).join("<span style=\"color:#c7c9d9\">·</span>");
  const items = c.items.map(([h, p]) => `<tr><td style="padding:0 0 14px"><div style="font-weight:700;font-size:15px;color:#1c1e2e">${esc(h)}</div><div style="font-size:14px;line-height:1.5;color:#6b6f85">${esc(p)}</div></td></tr>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light dark"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1e2e">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4fa"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td align="center" style="padding:28px 24px 16px">
  <a href="${app}" style="text-decoration:none"><img src="${logo}" width="56" height="56" alt="BE Mastery" style="display:block;border-radius:12px"></a>
  <div style="font-size:18px;font-weight:700;margin-top:10px;color:#1c1e2e">BE Mastery</div>
</td></tr>
<tr><td style="padding:0"><a href="${app}" style="text-decoration:none"><img src="${hero}" width="600" alt="Welcome to BE Mastery — your road map, Shadow Studio, Phrase Lab and Practice Partner" style="display:block;width:100%;max-width:600px;height:auto;border:0"></a></td></tr>
<tr><td style="padding:24px 32px 8px;font-size:16px;line-height:1.55">
  <p style="margin:0 0 12px">${esc(c.hello(name))}</p>
  <p style="margin:0 0 22px">${esc(c.intro)}</p>
  <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 26px"><tr><td style="background:#6d5dfc;border-radius:12px">
    <a href="${app}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:700;font-size:16px;text-decoration:none">${esc(c.button)}</a>
  </td></tr></table>
  <div style="font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#6d5dfc;margin:0 0 10px">${esc(c.what)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${items}</table>
  <p style="margin:10px 0 8px;font-size:14px;color:#6b6f85">${esc(c.account(email))}</p>
  <p style="margin:0 0 22px;font-size:14px;color:#6b6f85">${esc(c.install).replace("Google Play", `<a href="${PLAY_URL}" style="color:#6d5dfc">Google Play</a>`)}</p>
  <p style="margin:0">${esc(c.sign)}<br><strong>${esc(c.team)}</strong></p>
</td></tr>
<tr><td align="center" style="padding:20px 32px 28px;border-top:1px solid #ecedf5;font-size:12px;line-height:1.6;color:#9a9db0">
  <div style="margin-bottom:10px">${social}</div>
  <div><a href="${app}" style="color:#6d5dfc;text-decoration:none">app.lomonec.com</a> · ${esc(c.contact)} <a href="mailto:${env.REPLY_TO}" style="color:#6d5dfc;text-decoration:none">${env.REPLY_TO}</a></div>
  <div style="margin-top:8px">${esc(c.footer)}</div>
  <div style="margin-top:4px">© ${new Date().getFullYear()} Lomonec LLC</div>
</td></tr>
</table></td></tr></table></body></html>`;
  const text = ["BE Mastery", "", c.hello(name), "", c.intro, "", c.button + ": " + app, "", c.what.toUpperCase(), ...c.items.map(([h, p]) => "- " + h + ": " + p), "",
    c.account(email), c.install + " " + PLAY_URL, "", c.sign, c.team, "", "app.lomonec.com · " + c.contact + " " + env.REPLY_TO, SOCIAL.map(s => s.name + ": " + s.url).join(" · "), c.footer, "© " + new Date().getFullYear() + " Lomonec LLC"].join("\n");
  return { html, text };
}

const welcomed = new Map();   // uid → when the welcome went out
async function welcome(req, env, origin){
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") || "");
  if (!m) return json({ error: "auth" }, 401, origin);
  let who; try { who = await verifyIdToken(env, m[1]); } catch (e) { console.log("welcome: token", e.message); return json({ error: "auth" }, 401, origin); }
  let body; try { body = await req.json(); } catch { body = {}; }
  const lang = /^[a-z]{2}$/.test(body.lang || "") ? body.lang : "en";
  const name = String(body.name || "").replace(/[^\p{L}\p{M}\s'.\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);
  /* only a freshly created account gets the welcome — never a replay, never an old one */
  const acc = await createdAt(env, who.uid);
  if (!acc.createdAt || Date.now() - acc.createdAt > WELCOME_WINDOW_SEC * 1000) { console.log("welcome: not new"); return json({ ok: true, sent: false }, 200, origin); }
  const email = acc.email || who.email;
  if (!EMAIL_RE.test(email)) return json({ error: "bad email" }, 400, origin);
  /* once per account (per isolate, best effort — the 30-minute window above is
     the hard stop), and never more than the hourly cap per address */
  if (welcomed.has(who.uid) && Date.now() - welcomed.get(who.uid) < 86400e3) { console.log("welcome: already"); return json({ ok: true, sent: false }, 200, origin); }
  if (limited(email)) { console.log("welcome: limited"); return json({ ok: true, sent: false }, 200, origin); }
  welcomed.set(who.uid, Date.now());
  const c = WELCOME[lang] || WELCOME.en;
  const { html, text } = renderWelcome(c, name, email, env);
  const r = await fetch(BREVO_URL(env), {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ sender: { email: env.FROM_EMAIL, name: env.FROM_NAME }, to: [{ email, name: name || undefined }], replyTo: { email: env.REPLY_TO }, subject: c.subject, htmlContent: html, textContent: text, tags: ["welcome"] }),
  });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("brevo " + r.status + " " + (res.code || "") + " " + (res.message || ""));
  console.log("welcome: sent", lang, (res && res.messageId) || "");
  return json({ ok: true, sent: true }, 200, origin);
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
      if (url.pathname === "/welcome") return await welcome(req, env, origin);
      return json({ error: "not found" }, 404, origin);
    } catch (e) {
      console.log("mail error", e && e.message);
      return json({ error: "mail" }, 502, origin);   // app falls back to Firebase's email
    }
  },
};
