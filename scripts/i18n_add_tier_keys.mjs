#!/usr/bin/env node
/* One-off, 5 Oct 2026: the tier spec's new and changed strings into the 15
   translation files. fr / es / pt / ar are translated; the other eleven carry
   the English until a native speaker reviews them (the same rule the Polish
   `ex.*` keys follow — see CLAUDE.md "Writing / voice").
   Run from the repo root: node scripts/i18n_add_tier_keys.mjs */
import { readFileSync, writeFileSync } from "node:fs";

const EN = {
  "prem.headline": "Speak with confidence. Go further every day.",
  "prem.lede": "More AI verdicts a day, your own videos transcribed, your long-term progress — and no ads.",
  "prem.on_h": "You're on Premium. Thank you for backing your practice.",
  "prem.b_ai": "{{n}} AI verdicts a day (fair use): speaking reports, pronunciation scores and AI coach replies",
  "prem.b_yt_min": "{{n}} minutes a day of your own YouTube videos, transcribed",
  "prem.cmp_ai": "AI verdicts a day", "prem.cmp_perday": "{{n}} a day", "prem.cmp_fair": "{{n}} a day (fair use)",
  "prem.cmp_ytmin": "Your YouTube videos, transcribed", "prem.cmp_min": "{{n}} min a day",
  "prem.cmp_ads": "Ads", "prem.cmp_yes": "Yes", "prem.cmp_none": "None",
  "prem.lock_ai_h": "Today's AI verdicts are used up",
  "prem.lock_ai_b": "Free includes {{n}} AI verdicts a day — a speaking report, a pronunciation score or an AI coach reply each. Yours come back at {{time}}. Premium gives {{top}} a day.",
  "prem.kept": "Your practice is still recorded and saved — only the AI's verdict waits.",
  "ai.allow_chip": "Daily allowance",
  "ai.allow_out": "You've used today's {{n}} AI verdicts. They come back at {{time}}. Premium gives {{top}} a day.",
  "ai.allow_fair": "You've reached today's fair-use ceiling of {{n}} AI verdicts. It resets at {{time}}.",
  "ai.allow_left": "{{n}} of {{total}} AI verdicts left today (resets {{time}}).",
  "sh.cap_allow_t": "Today's video minutes are used",
  "sh.cap_allow_b": "Free transcribes {{n}} minutes of your own videos a day; Premium {{top}}. Yours come back at {{time}}.",
  "sh.cap_allow_fair": "You've reached today's fair-use ceiling of {{n}} video minutes. It resets at {{time}}.",
  "sh.cap_allow_left": "{{n}} of {{total}} video minutes left today (resets {{time}}).",
  "sess.report_prem": "Today's AI verdicts are used up — the report comes back tomorrow. Your recording is saved, and your practice still counts.",
  "sv.ch_err_prem": "That verdict needs one of today's AI verdicts, and they are used up. Everything your device can measure is below, and your recording is saved.",
  "sv.ch_pron_prem": "Coverage, words and rhythm are yours. The word-by-word pronunciation score is an AI verdict, and today's are used up.",
  "sv.ch_retell_prem": "Recorded and counted. The meaning check is an AI verdict — today's are used up, and it comes back tomorrow.",
};

const T = {
  fr: {
    "prem.headline": "Parlez avec assurance. Allez plus loin chaque jour.",
    "prem.lede": "Plus de verdicts IA par jour, vos propres vidéos transcrites, vos progrès sur la durée — et aucune publicité.",
    "prem.on_h": "Vous êtes Premium. Merci de soutenir votre pratique.",
    "prem.b_ai": "{{n}} verdicts IA par jour (usage raisonnable) : rapports d'expression, scores de prononciation et réponses du coach IA",
    "prem.b_yt_min": "{{n}} minutes par jour de vos propres vidéos YouTube, transcrites",
    "prem.cmp_ai": "Verdicts IA par jour", "prem.cmp_perday": "{{n}} par jour", "prem.cmp_fair": "{{n}} par jour (usage raisonnable)",
    "prem.cmp_ytmin": "Vos vidéos YouTube, transcrites", "prem.cmp_min": "{{n}} min par jour",
    "prem.cmp_ads": "Publicités", "prem.cmp_yes": "Oui", "prem.cmp_none": "Aucune",
    "prem.lock_ai_h": "Les verdicts IA du jour sont épuisés",
    "prem.lock_ai_b": "L'offre gratuite comprend {{n}} verdicts IA par jour — un rapport d'expression, un score de prononciation ou une réponse du coach IA chacun. Les vôtres reviennent à {{time}}. Premium en donne {{top}} par jour.",
    "prem.kept": "Votre pratique est toujours enregistrée et sauvegardée — seul le verdict de l'IA attend.",
    "ai.allow_chip": "Quota du jour",
    "ai.allow_out": "Vous avez utilisé vos {{n}} verdicts IA du jour. Ils reviennent à {{time}}. Premium en donne {{top}} par jour.",
    "ai.allow_fair": "Vous avez atteint le plafond d'usage raisonnable du jour : {{n}} verdicts IA. Il se remet à zéro à {{time}}.",
    "ai.allow_left": "{{n}} verdicts IA sur {{total}} restants aujourd'hui (remise à zéro à {{time}}).",
    "sh.cap_allow_t": "Les minutes vidéo du jour sont utilisées",
    "sh.cap_allow_b": "L'offre gratuite transcrit {{n}} minutes de vos propres vidéos par jour ; Premium {{top}}. Les vôtres reviennent à {{time}}.",
    "sh.cap_allow_fair": "Vous avez atteint le plafond d'usage raisonnable du jour : {{n}} minutes de vidéo. Il se remet à zéro à {{time}}.",
    "sh.cap_allow_left": "{{n}} minutes vidéo sur {{total}} restantes aujourd'hui (remise à zéro à {{time}}).",
    "sess.report_prem": "Les verdicts IA du jour sont épuisés — le rapport revient demain. Votre enregistrement est sauvegardé et votre pratique compte toujours.",
    "sv.ch_err_prem": "Ce verdict demande l'un des verdicts IA du jour, et ils sont épuisés. Tout ce que votre appareil peut mesurer est ci-dessous, et votre enregistrement est sauvegardé.",
    "sv.ch_pron_prem": "Couverture, mots et rythme sont à vous. Le score de prononciation mot à mot est un verdict IA, et ceux du jour sont épuisés.",
    "sv.ch_retell_prem": "Enregistré et compté. La vérification du sens est un verdict IA — ceux du jour sont épuisés, elle revient demain.",
  },
  es: {
    "prem.headline": "Habla con confianza. Llega más lejos cada día.",
    "prem.lede": "Más veredictos de IA al día, tus propios vídeos transcritos, tu progreso a largo plazo — y sin anuncios.",
    "prem.on_h": "Tienes Premium. Gracias por apoyar tu práctica.",
    "prem.b_ai": "{{n}} veredictos de IA al día (uso razonable): informes de expresión oral, puntuaciones de pronunciación y respuestas del coach de IA",
    "prem.b_yt_min": "{{n}} minutos al día de tus propios vídeos de YouTube, transcritos",
    "prem.cmp_ai": "Veredictos de IA al día", "prem.cmp_perday": "{{n}} al día", "prem.cmp_fair": "{{n}} al día (uso razonable)",
    "prem.cmp_ytmin": "Tus vídeos de YouTube, transcritos", "prem.cmp_min": "{{n}} min al día",
    "prem.cmp_ads": "Anuncios", "prem.cmp_yes": "Sí", "prem.cmp_none": "Ninguno",
    "prem.lock_ai_h": "Los veredictos de IA de hoy se han agotado",
    "prem.lock_ai_b": "El plan gratuito incluye {{n}} veredictos de IA al día — un informe de expresión, una puntuación de pronunciación o una respuesta del coach cada uno. Los tuyos vuelven a las {{time}}. Premium da {{top}} al día.",
    "prem.kept": "Tu práctica sigue grabada y guardada — solo espera el veredicto de la IA.",
    "ai.allow_chip": "Cupo diario",
    "ai.allow_out": "Has usado tus {{n}} veredictos de IA de hoy. Vuelven a las {{time}}. Premium da {{top}} al día.",
    "ai.allow_fair": "Has alcanzado el límite de uso razonable de hoy: {{n}} veredictos de IA. Se reinicia a las {{time}}.",
    "ai.allow_left": "Te quedan {{n}} de {{total}} veredictos de IA hoy (se reinicia a las {{time}}).",
    "sh.cap_allow_t": "Los minutos de vídeo de hoy se han usado",
    "sh.cap_allow_b": "El plan gratuito transcribe {{n}} minutos al día de tus propios vídeos; Premium {{top}}. Los tuyos vuelven a las {{time}}.",
    "sh.cap_allow_fair": "Has alcanzado el límite de uso razonable de hoy: {{n}} minutos de vídeo. Se reinicia a las {{time}}.",
    "sh.cap_allow_left": "Te quedan {{n}} de {{total}} minutos de vídeo hoy (se reinicia a las {{time}}).",
    "sess.report_prem": "Los veredictos de IA de hoy se han agotado — el informe vuelve mañana. Tu grabación está guardada y tu práctica sigue contando.",
    "sv.ch_err_prem": "Ese veredicto necesita uno de los veredictos de IA de hoy, y se han agotado. Todo lo que tu dispositivo puede medir está abajo, y tu grabación está guardada.",
    "sv.ch_pron_prem": "Cobertura, palabras y ritmo son tuyos. La puntuación de pronunciación palabra por palabra es un veredicto de IA, y los de hoy se han agotado.",
    "sv.ch_retell_prem": "Grabado y contado. La comprobación del sentido es un veredicto de IA — los de hoy se han agotado; vuelve mañana.",
  },
  pt: {
    "prem.headline": "Fale com confiança. Vá mais longe todos os dias.",
    "prem.lede": "Mais veredictos de IA por dia, os seus próprios vídeos transcritos, o seu progresso a longo prazo — e sem anúncios.",
    "prem.on_h": "Tem o Premium. Obrigado por apoiar a sua prática.",
    "prem.b_ai": "{{n}} veredictos de IA por dia (uso razoável): relatórios de fala, pontuações de pronúncia e respostas do coach de IA",
    "prem.b_yt_min": "{{n}} minutos por dia dos seus próprios vídeos do YouTube, transcritos",
    "prem.cmp_ai": "Veredictos de IA por dia", "prem.cmp_perday": "{{n}} por dia", "prem.cmp_fair": "{{n}} por dia (uso razoável)",
    "prem.cmp_ytmin": "Os seus vídeos do YouTube, transcritos", "prem.cmp_min": "{{n}} min por dia",
    "prem.cmp_ads": "Anúncios", "prem.cmp_yes": "Sim", "prem.cmp_none": "Nenhum",
    "prem.lock_ai_h": "Os veredictos de IA de hoje esgotaram-se",
    "prem.lock_ai_b": "O plano gratuito inclui {{n}} veredictos de IA por dia — um relatório de fala, uma pontuação de pronúncia ou uma resposta do coach cada. Os seus voltam às {{time}}. O Premium dá {{top}} por dia.",
    "prem.kept": "A sua prática continua gravada e guardada — só o veredicto da IA espera.",
    "ai.allow_chip": "Quota diária",
    "ai.allow_out": "Usou os seus {{n}} veredictos de IA de hoje. Voltam às {{time}}. O Premium dá {{top}} por dia.",
    "ai.allow_fair": "Atingiu o limite de uso razoável de hoje: {{n}} veredictos de IA. Reinicia às {{time}}.",
    "ai.allow_left": "Restam {{n}} de {{total}} veredictos de IA hoje (reinicia às {{time}}).",
    "sh.cap_allow_t": "Os minutos de vídeo de hoje foram usados",
    "sh.cap_allow_b": "O plano gratuito transcreve {{n}} minutos por dia dos seus próprios vídeos; o Premium {{top}}. Os seus voltam às {{time}}.",
    "sh.cap_allow_fair": "Atingiu o limite de uso razoável de hoje: {{n}} minutos de vídeo. Reinicia às {{time}}.",
    "sh.cap_allow_left": "Restam {{n}} de {{total}} minutos de vídeo hoje (reinicia às {{time}}).",
    "sess.report_prem": "Os veredictos de IA de hoje esgotaram-se — o relatório volta amanhã. A sua gravação está guardada e a sua prática continua a contar.",
    "sv.ch_err_prem": "Esse veredicto precisa de um dos veredictos de IA de hoje, e esgotaram-se. Tudo o que o seu dispositivo consegue medir está abaixo, e a sua gravação está guardada.",
    "sv.ch_pron_prem": "Cobertura, palavras e ritmo são seus. A pontuação de pronúncia palavra a palavra é um veredicto de IA, e os de hoje esgotaram-se.",
    "sv.ch_retell_prem": "Gravado e contado. A verificação do sentido é um veredicto de IA — os de hoje esgotaram-se; volta amanhã.",
  },
  ar: {
    "prem.headline": "تحدّث بثقة. تقدّم أكثر كل يوم.",
    "prem.lede": "مزيد من أحكام الذكاء الاصطناعي يوميًا، وفيديوهاتك الخاصة منسوخة نصيًا، وتقدّمك على المدى الطويل — وبلا إعلانات.",
    "prem.on_h": "أنت مشترك في بريميوم. شكرًا لدعمك ممارستك.",
    "prem.b_ai": "{{n}} حكمًا من الذكاء الاصطناعي يوميًا (استخدام معقول): تقارير التحدث ودرجات النطق وردود المدرّب الذكي",
    "prem.b_yt_min": "{{n}} دقيقة يوميًا من فيديوهاتك الخاصة على يوتيوب، منسوخة نصيًا",
    "prem.cmp_ai": "أحكام الذكاء الاصطناعي يوميًا", "prem.cmp_perday": "{{n}} يوميًا", "prem.cmp_fair": "{{n}} يوميًا (استخدام معقول)",
    "prem.cmp_ytmin": "فيديوهاتك على يوتيوب، منسوخة نصيًا", "prem.cmp_min": "{{n}} دقيقة يوميًا",
    "prem.cmp_ads": "الإعلانات", "prem.cmp_yes": "نعم", "prem.cmp_none": "لا شيء",
    "prem.lock_ai_h": "نفدت أحكام الذكاء الاصطناعي لهذا اليوم",
    "prem.lock_ai_b": "تشمل الخطة المجانية {{n}} أحكام يوميًا — تقرير تحدث أو درجة نطق أو رد من المدرّب الذكي لكل منها. تعود أحكامك في {{time}}. يمنح بريميوم {{top}} يوميًا.",
    "prem.kept": "ممارستك لا تزال مسجّلة ومحفوظة — حكم الذكاء الاصطناعي وحده ينتظر.",
    "ai.allow_chip": "الحصة اليومية",
    "ai.allow_out": "استخدمت أحكامك الـ{{n}} لهذا اليوم. تعود في {{time}}. يمنح بريميوم {{top}} يوميًا.",
    "ai.allow_fair": "بلغت سقف الاستخدام المعقول لهذا اليوم: {{n}} حكمًا. يُعاد ضبطه في {{time}}.",
    "ai.allow_left": "تبقّى {{n}} من {{total}} أحكام اليوم (يُعاد الضبط في {{time}}).",
    "sh.cap_allow_t": "استُخدمت دقائق الفيديو لهذا اليوم",
    "sh.cap_allow_b": "تنسخ الخطة المجانية {{n}} دقيقة يوميًا من فيديوهاتك الخاصة؛ وبريميوم {{top}}. تعود دقائقك في {{time}}.",
    "sh.cap_allow_fair": "بلغت سقف الاستخدام المعقول لهذا اليوم: {{n}} دقيقة فيديو. يُعاد ضبطه في {{time}}.",
    "sh.cap_allow_left": "تبقّى {{n}} من {{total}} دقيقة فيديو اليوم (يُعاد الضبط في {{time}}).",
    "sess.report_prem": "نفدت أحكام الذكاء الاصطناعي لهذا اليوم — يعود التقرير غدًا. تسجيلك محفوظ وممارستك لا تزال تُحتسب.",
    "sv.ch_err_prem": "يحتاج هذا الحكم إلى أحد أحكام اليوم، وقد نفدت. كل ما يستطيع جهازك قياسه أدناه، وتسجيلك محفوظ.",
    "sv.ch_pron_prem": "التغطية والكلمات والإيقاع لك. درجة النطق كلمةً بكلمة حكم من الذكاء الاصطناعي، وأحكام اليوم نفدت.",
    "sv.ch_retell_prem": "مسجّل ومحتسب. التحقق من المعنى حكم من الذكاء الاصطناعي — أحكام اليوم نفدت، ويعود غدًا.",
  },
};

const LANGS = ["es", "fr", "pt", "it", "de", "ru", "ar", "ur", "hi", "bn", "id", "vi", "zh", "ja", "ko"];
for (const c of LANGS) {
  const p = `i18n/${c}.json`;
  const o = JSON.parse(readFileSync(p, "utf8"));
  const tr = T[c] || {};
  let changed = 0, added = 0;
  for (const [k, en] of Object.entries(EN)) {
    const v = tr[k] || en;
    if (!(k in o)) added++; else if (o[k] !== v) changed++;
    o[k] = v;
  }
  /* rewrite in the file's own shape: one key per line, ONE-space indent, the
     keys in their existing order with the new ones at the end */
  writeFileSync(p, JSON.stringify(o, null, 1) + "\n");
  console.log(c, "changed", changed, "added", added, "keys", Object.keys(o).length);
}
