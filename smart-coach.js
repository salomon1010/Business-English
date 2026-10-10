/* ============================================================================
   BE Mastery — Smart Coach (Smart Practice Planner), the app side. 10 Oct 2026.
   --------------------------------------------------------------------------
   Lives inside the Daily reminder sheet (Profile → Daily reminder) for BOTH
   programmes — General English and Welding Professional English — behind the
   flag `smart_coach_enabled` (staging ON, production OFF).

     evidence (scSignals: the learner's own records, open programme only)
       → SmartCoachEngine.analyse → one priority + up to three plans for it
       → the learner moves dates / times (never the focus, never the length)
       → explicit approval → be-coach (server: sign-in, the ACCOUNT's
         programme, Premium, one open plan per programme, idempotent)
       → iOS local notifications (BEPush.coachSchedule) / in-app reminders
       → the activity opens → its SAVED record proves the session
         (a game round: be-polish must have closed it — the server checks)
       → the server marks it done → progress → the outcome → the next step.

   Nothing is ever shown as done, approved or scheduled before the server
   said so. The plan shown offline is the server's last answer, labelled.
   Strings: own en/fr dictionary below (like welding-mastery.js); other
   languages fall back to English.
   ============================================================================ */
(function () {
  "use strict";
  const E = window.SmartCoachEngine;
  const KIND_IC = { quick: "bolt", sprint: "target", mastery: "trophy" };

  /* ------------------------------------------------------------- strings */
  const TX = {
    en: {
      title: "Smart Coach", kicker: "Smart Practice Planner", open: "Open Smart Coach", close: "Close",
      card_idle: "A short plan for the skill your results point to — you choose when.",
      card_active: "{{done}} of {{total}} sessions verified · {{kind}}",
      card_next: "Next: {{when}}", prem: "Premium",
      area_ge: "General English", area_we: "Welding English",
      k_quick: "Quick Boost", k_sprint: "Focus Sprint", k_mastery: "Mastery Cycle",
      kd_quick: "Three short sessions to reinforce it while it is fresh.",
      kd_sprint: "Four short sessions for a weakness that keeps coming back, with a starting check and a final check.",
      kd_mastery: "Seven spaced sessions over two weeks, ending with a final reassessment.",
      sk_vocabulary: "Vocabulary recall", sk_pronunciation: "Pronunciation in your recordings", sk_grammar: "Grammar · {{cat}}",
      sk_topic: "Vocabulary · {{cat}}", sk_listening: "Listening", sk_diagnostic: "Find your starting point",
      why_h: "Why this, now", judge_h: "How the result is judged", plan_h: "Recommended plan",
      focus_lbl: "Focus", focus_by: "Chosen by your coach from your results", dur_lbl: "Duration", fixed: "Fixed",
      sess_lbl: "Sessions", total_lbl: "Total practice", min: "{{n}} min", about_min: "about {{n}} min",
      benefit_h: "What it is for", done_when_h: "It is complete when",
      done_when_quick: "all three sessions are verified from your saved results.",
      done_when_check: "every session is verified and the final check is saved. Your final check is compared with your starting check — the same exercise both times.",
      benefit_vocabulary: "More of these words come back to you when you need them.", benefit_pronunciation: "Fewer words lost when you speak; recordings that match the line more closely.",
      benefit_grammar: "Fewer mistakes in this pattern in your drills.", benefit_topic: "These terms recognised and recalled faster.", benefit_listening: "Words caught the first time you hear them.",
      benefit_diagnostic: "A measured starting point, so the next plan rests on evidence.",
      no_promise: "A plan is practice, not a promise: the result is whatever your saved exercises show.",
      judge_check: "Your score on the final check (pass mark {{p}} %), compared with your starting check.",
      judge_quick: "Three verified sessions. A Quick Boost has no final check, so it does not claim an improvement.",
      review_btn: "Review the schedule", not_for_me: "Not for me", other_focus: "Choose another focus", alts_h: "Other plans for the same focus",
      alts_sub: "Same focus, different commitment.", choose: "Choose this plan", back: "Back",
      focus_h: "Other areas your results show", focus_sub: "Each comes from your own results. Changing the focus starts a new proposal.",
      lesson_alt: "Or carry on with your next lesson: Week {{w}} · {{d}}", lesson_go: "Open the lesson",
      ev_none: "There are no measured results yet in this programme. A short diagnostic gives the coach real evidence.",
      ev_thin: "Only {{n}} measured exercise(s) so far — not enough to name a weakness honestly. A short diagnostic comes first.",
      ev_trouble: "{{n}} words keep failing in your recordings ({{words}}).", ev_shadow_avg: "Your last {{n}} scored recordings averaged {{p}} % word accuracy.",
      ev_shadow_drop: "Your recent recordings fell from {{from}} % to {{to}} %.", ev_gram: "{{cat}}: your last drill scored {{p}} % ({{runs}} runs so far).",
      ev_gram_rep: "{{cat}} was under 70 % twice in a row.", ev_cat_err: "{{n}} open mistakes in {{cat}} in your game rounds.",
      ev_safety: "These are safety terms: misunderstanding them on site matters more.", ev_listen: "Listening rounds: {{p}} % correct over {{n}} answers.",
      ev_words_due: "{{n}} saved words are due for review now.", ev_quiz: "Your last {{n}} word quizzes averaged {{p}} %.",
      ev_game_due: "{{n}} game words are due for review.", ev_reinforce: "Your last plan on this ended at {{p}} % on the final check — below the pass mark. One more, a little longer.",
      ev_reinforce_nf: "Your last plan on this did not show an improvement yet. One more, a little longer.",
      ev_review: "You passed this {{d}} days ago. A short review now keeps it.",
      edit_h: "Your schedule", edit_sub: "Move the days and times. The focus and the length stay as proposed.",
      start_lbl: "Start date", days_lbl: "Practice days", time_all: "Time for every session", apply: "Apply",
      sess_n: "Session {{n}}", window: "{{from}} → {{to}} · {{days}} days", cal_opt: "Also add these sessions to my calendar (.ics file)",
      approve: "Approve and schedule", approving: "Saving your plan…", summary: "{{n}} sessions · {{from}} → {{to}} · about {{m}} minutes in total",
      err_few_days: "Those days give only {{have}} practice day(s) inside the fixed {{days}}-day window; this plan needs {{need}}. Choose more days.",
      err_outside: "A session falls outside the fixed window.", err_order: "Two sessions are on the same day or out of order.",
      err_quiet: "No sessions between 22:00 and 07:00.", err_start_past: "The start date is in the past.", err_start_far: "Start within the next 14 days.",
      err_past: "A remaining session is in the past — move it to today or later.", err_time: "Choose a time for every session.", err_generic: "This schedule cannot be saved ({{c}}).",
      ok_approved: "Plan approved. Your sessions are scheduled.", ok_moved: "Schedule saved.",
      a_role_start: "Starting check", a_role_check: "Final check",
      a_words: "Flashcards: your saved words", a_quiz: "Word quiz", a_grammar: "Grammar drill · {{cat}}", a_shadow: "Record yourself against a line",
      a_game: "{{game}}", a_game_cat: "{{game}} · {{cat}}",
      c_words: "Counts when you finish a flashcard run of at least 5 words.", c_quiz: "Counts when a word quiz is finished and saved.",
      c_grammar: "Counts when a {{cat}} drill is finished and saved.", c_shadow: "Counts when a recording is scored against its line.",
      c_game: "Counts when a round of {{game}} (5+ answers) is finished and confirmed by the server.",
      g_cards: "Flashcards game", g_quiz: "Quick quiz", g_visual: "Picture match", g_listen: "Listen & answer", g_builder: "Spelling builder", g_match: "Match pairs",
      g_workshop: "Workshop scenarios", g_sentence: "Sentence builder", g_speak: "Speak up", g_puzzle: "Word puzzle",
      active_h: "Your focus programme", day_of: "Day {{d}} of {{n}}", verified: "{{done}} of {{total}} verified",
      next_h: "Next session", start: "Start", do_now: "Do it now", move: "Move it", opens: "Opens {{when}}",
      st_done: "Done", st_due: "Due", st_today: "Today", st_upcoming: "Upcoming", st_missed: "Missed",
      by_server: "confirmed by the server", by_device: "from your saved result", score: "{{p}} %",
      missed_one: "Session {{n}} was missed. You can still do it, or move it inside the plan.",
      missed_many: "{{n}} sessions were missed. Move the rest of the plan, or pause it until you are ready.",
      overdue_h: "This plan's window has closed", overdue_b: "{{done}} of {{total}} sessions were completed before {{end}}. The plan cannot be extended silently: restart the same plan on new dates, or cancel it (it stays in your history).",
      restart: "Restart the same plan", cancel: "Cancel the plan", cancel_q: "Cancel this plan? It stays in your history and you can start another.",
      pause: "Pause", resume: "Resume", reschedule: "Move sessions", cal_add: "Add to calendar (.ics)", cal_note: "Calendars that honour event ids update the same entries; some may add a copy if you import twice.",
      paused_b: "Paused — no reminders. Resume when you are ready; the dates stay inside the plan's window.",
      checking: "Checking your saved results…", pending: "Saved on this device — waiting to confirm with the server.",
      confirm_wait: "Your round is saved. The server has not confirmed it yet — it will be checked again.",
      sess_ok: "Session verified.", prog_done: "Programme complete.",
      review_h: "Programme review", r_done: "Sessions completed: {{done}} of {{total}}", r_comp_yes: "Final check: {{p}} % — at or above the pass mark ({{pass}} %).",
      r_comp_no: "Final check: {{p}} % — below the pass mark ({{pass}} %).", r_comp_na: "No final check in this plan: it shows practice done, not competence.",
      r_delta: "Change on the same exercise: {{s}} % → {{p}} % ({{d}}).", r_delta_na: "No improvement is claimed without a starting and a final check on the same exercise.",
      r_verified: "{{n}} session(s) confirmed by the server, the rest from your saved results.",
      next_step_h: "Your next step", next_step_b: "Built from this programme's outcome and your latest results.",
      n_signin: "Sign in to keep a plan on your account — it is what lets the coach check your sessions.", signin: "Sign in",
      n_prem: "Smart Coach plans are part of Premium. The recommendation and its evidence stay free to read.", see_prem: "See Premium", prem_soon: "Premium is not on sale yet.",
      n_offline: "You are offline. This is the plan as the server last saw it; nothing can be changed or verified until you are back online.",
      n_error: "The coach could not be reached. Nothing was changed.", retry: "Try again",
      n_track: "Your account is still switching programme. Try again in a moment.", n_active_exists: "You already have an open plan in this programme. Finish, or cancel it first.",
      n_notif_on: "Reminders are set on this iPhone for each session.", n_notif_off: "Notifications are off for BE Mastery, so your sessions are shown here instead.",
      n_notif_web: "Your sessions are shown here and when you open the app. The daily reminder keeps working as before.",
      n_notif_ask: "Allow notifications", n_unavail: "Smart Coach is not available here yet.",
      loading: "Loading your coach…", remind_t: "Smart Coach", remind_b: "Session {{n}} of {{total}} is ready · about {{m}} minutes.",
      in_app_due: "Smart Coach: session {{n}} is ready.", loading_sig: "Reading your results…",
      cal_title: "Smart Coach · session {{n}} of {{total}}", cal_desc: "{{act}}. Open BE Mastery to start.",
    },
    fr: {
      title: "Coach intelligent", kicker: "Planificateur d'entraînement", open: "Ouvrir le Coach intelligent", close: "Fermer",
      card_idle: "Un plan court pour la compétence que montrent vos résultats — vous choisissez quand.",
      card_active: "{{done}} séance(s) sur {{total}} vérifiée(s) · {{kind}}", card_next: "Prochaine : {{when}}", prem: "Premium",
      area_ge: "Anglais général", area_we: "Anglais du soudage",
      k_quick: "Coup de pouce", k_sprint: "Sprint ciblé", k_mastery: "Cycle de maîtrise",
      kd_quick: "Trois courtes séances pour consolider tant que c'est frais.",
      kd_sprint: "Quatre courtes séances pour une faiblesse qui revient, avec un test de départ et un test final.",
      kd_mastery: "Sept séances espacées sur deux semaines, avec une évaluation finale.",
      sk_vocabulary: "Rappel du vocabulaire", sk_pronunciation: "Prononciation dans vos enregistrements", sk_grammar: "Grammaire · {{cat}}",
      sk_topic: "Vocabulaire · {{cat}}", sk_listening: "Compréhension orale", sk_diagnostic: "Trouver votre point de départ",
      why_h: "Pourquoi maintenant", judge_h: "Comment le résultat est jugé", plan_h: "Plan recommandé",
      focus_lbl: "Objectif", focus_by: "Choisi par votre coach d'après vos résultats", dur_lbl: "Durée", fixed: "Fixe",
      sess_lbl: "Séances", total_lbl: "Pratique totale", min: "{{n}} min", about_min: "environ {{n}} min",
      benefit_h: "À quoi il sert", done_when_h: "Il est terminé quand",
      done_when_quick: "les trois séances sont vérifiées d'après vos résultats enregistrés.",
      done_when_check: "chaque séance est vérifiée et le test final enregistré. Le test final est comparé au test de départ — le même exercice les deux fois.",
      benefit_vocabulary: "Ces mots vous reviennent plus souvent quand vous en avez besoin.", benefit_pronunciation: "Moins de mots perdus quand vous parlez.",
      benefit_grammar: "Moins d'erreurs sur cette structure dans vos exercices.", benefit_topic: "Ces termes reconnus et retrouvés plus vite.", benefit_listening: "Des mots compris dès la première écoute.",
      benefit_diagnostic: "Un point de départ mesuré, pour que le prochain plan repose sur des faits.",
      no_promise: "Un plan est de la pratique, pas une promesse : le résultat est ce que montrent vos exercices enregistrés.",
      judge_check: "Votre score au test final (seuil {{p}} %), comparé à votre test de départ.",
      judge_quick: "Trois séances vérifiées. Le Coup de pouce n'a pas de test final : il ne prétend à aucun progrès.",
      review_btn: "Voir le calendrier", not_for_me: "Pas pour moi", other_focus: "Choisir un autre objectif", alts_h: "Autres plans pour le même objectif",
      alts_sub: "Même objectif, engagement différent.", choose: "Choisir ce plan", back: "Retour",
      focus_h: "Autres points que montrent vos résultats", focus_sub: "Chacun vient de vos résultats. Changer d'objectif crée une nouvelle proposition.",
      lesson_alt: "Ou continuez votre prochaine leçon : semaine {{w}} · {{d}}", lesson_go: "Ouvrir la leçon",
      ev_none: "Aucun résultat mesuré dans ce programme pour l'instant. Un court diagnostic donne au coach de vraies données.",
      ev_thin: "Seulement {{n}} exercice(s) mesuré(s) — trop peu pour nommer une faiblesse honnêtement. Un court diagnostic d'abord.",
      ev_trouble: "{{n}} mots échouent souvent dans vos enregistrements ({{words}}).", ev_shadow_avg: "Vos {{n}} derniers enregistrements notés : {{p}} % de mots justes en moyenne.",
      ev_shadow_drop: "Vos enregistrements récents sont passés de {{from}} % à {{to}} %.", ev_gram: "{{cat}} : votre dernier exercice a fait {{p}} % ({{runs}} séries).",
      ev_gram_rep: "{{cat}} est resté sous 70 % deux fois de suite.", ev_cat_err: "{{n}} erreurs non corrigées en {{cat}} dans vos parties.",
      ev_safety: "Ce sont des termes de sécurité : mal les comprendre sur le chantier compte davantage.", ev_listen: "Écoute : {{p}} % de bonnes réponses sur {{n}}.",
      ev_words_due: "{{n}} mots enregistrés sont à réviser maintenant.", ev_quiz: "Vos {{n}} derniers quiz de mots : {{p}} % en moyenne.",
      ev_game_due: "{{n}} mots du jeu sont à réviser.", ev_reinforce: "Votre dernier plan sur ce point a fini à {{p}} % au test final — sous le seuil. Un de plus, un peu plus long.",
      ev_reinforce_nf: "Votre dernier plan sur ce point n'a pas encore montré de progrès. Un de plus, un peu plus long.",
      ev_review: "Réussi il y a {{d}} jours. Une courte révision maintenant le garde.",
      edit_h: "Votre calendrier", edit_sub: "Déplacez les jours et les heures. L'objectif et la durée restent ceux proposés.",
      start_lbl: "Date de début", days_lbl: "Jours de pratique", time_all: "Heure de chaque séance", apply: "Appliquer",
      sess_n: "Séance {{n}}", window: "{{from}} → {{to}} · {{days}} jours", cal_opt: "Ajouter aussi ces séances à mon agenda (fichier .ics)",
      approve: "Valider et planifier", approving: "Enregistrement de votre plan…", summary: "{{n}} séances · {{from}} → {{to}} · environ {{m}} minutes au total",
      err_few_days: "Ces jours ne donnent que {{have}} jour(s) dans la fenêtre fixe de {{days}} jours ; ce plan en demande {{need}}. Choisissez plus de jours.",
      err_outside: "Une séance tombe hors de la fenêtre fixe.", err_order: "Deux séances sont le même jour ou dans le désordre.",
      err_quiet: "Pas de séance entre 22 h et 7 h.", err_start_past: "La date de début est passée.", err_start_far: "Commencez dans les 14 prochains jours.",
      err_past: "Une séance restante est dans le passé — placez-la aujourd'hui ou plus tard.", err_time: "Choisissez une heure pour chaque séance.", err_generic: "Ce calendrier ne peut pas être enregistré ({{c}}).",
      ok_approved: "Plan validé. Vos séances sont planifiées.", ok_moved: "Calendrier enregistré.",
      a_role_start: "Test de départ", a_role_check: "Test final",
      a_words: "Cartes : vos mots enregistrés", a_quiz: "Quiz de mots", a_grammar: "Exercice de grammaire · {{cat}}", a_shadow: "Enregistrez-vous sur une phrase",
      a_game: "{{game}}", a_game_cat: "{{game}} · {{cat}}",
      c_words: "Compte quand une série d'au moins 5 cartes est terminée.", c_quiz: "Compte quand un quiz de mots est terminé et enregistré.",
      c_grammar: "Compte quand un exercice {{cat}} est terminé et enregistré.", c_shadow: "Compte quand un enregistrement est noté sur sa phrase.",
      c_game: "Compte quand une partie de {{game}} (5 réponses ou plus) est terminée et confirmée par le serveur.",
      g_cards: "Jeu de cartes", g_quiz: "Quiz rapide", g_visual: "Images", g_listen: "Écoute", g_builder: "Orthographe", g_match: "Paires",
      g_workshop: "Scénarios d'atelier", g_sentence: "Phrases", g_speak: "À vous de parler", g_puzzle: "Mots croisés",
      active_h: "Votre programme", day_of: "Jour {{d}} sur {{n}}", verified: "{{done}} sur {{total}} vérifiées",
      next_h: "Prochaine séance", start: "Commencer", do_now: "Faire maintenant", move: "Déplacer", opens: "Ouvre {{when}}",
      st_done: "Fait", st_due: "À faire", st_today: "Aujourd'hui", st_upcoming: "À venir", st_missed: "Manquée",
      by_server: "confirmé par le serveur", by_device: "d'après votre résultat enregistré", score: "{{p}} %",
      missed_one: "La séance {{n}} a été manquée. Vous pouvez encore la faire, ou la déplacer dans le plan.",
      missed_many: "{{n}} séances ont été manquées. Déplacez la suite du plan, ou mettez-le en pause.",
      overdue_h: "La fenêtre de ce plan est fermée", overdue_b: "{{done}} séance(s) sur {{total}} faites avant le {{end}}. Le plan ne peut pas être prolongé en silence : recommencez le même plan à de nouvelles dates, ou annulez-le (il reste dans votre historique).",
      restart: "Recommencer le même plan", cancel: "Annuler le plan", cancel_q: "Annuler ce plan ? Il reste dans votre historique.",
      pause: "Pause", resume: "Reprendre", reschedule: "Déplacer des séances", cal_add: "Ajouter à l'agenda (.ics)", cal_note: "Les agendas qui respectent l'identifiant des événements mettent à jour les mêmes entrées ; certains peuvent ajouter un doublon si vous importez deux fois.",
      paused_b: "En pause — aucun rappel. Reprenez quand vous voulez ; les dates restent dans la fenêtre du plan.",
      checking: "Vérification de vos résultats…", pending: "Enregistré sur cet appareil — en attente de confirmation du serveur.",
      confirm_wait: "Votre partie est enregistrée. Le serveur ne l'a pas encore confirmée — nouvelle vérification bientôt.",
      sess_ok: "Séance vérifiée.", prog_done: "Programme terminé.",
      review_h: "Bilan du programme", r_done: "Séances faites : {{done}} sur {{total}}", r_comp_yes: "Test final : {{p}} % — au seuil ou au-dessus ({{pass}} %).",
      r_comp_no: "Test final : {{p}} % — sous le seuil ({{pass}} %).", r_comp_na: "Pas de test final dans ce plan : il montre la pratique faite, pas la maîtrise.",
      r_delta: "Sur le même exercice : {{s}} % → {{p}} % ({{d}}).", r_delta_na: "Aucun progrès n'est annoncé sans test de départ et test final sur le même exercice.",
      r_verified: "{{n}} séance(s) confirmée(s) par le serveur, les autres d'après vos résultats enregistrés.",
      next_step_h: "Votre prochaine étape", next_step_b: "Construite d'après ce programme et vos derniers résultats.",
      n_signin: "Connectez-vous pour garder un plan sur votre compte — c'est ce qui permet au coach de vérifier vos séances.", signin: "Se connecter",
      n_prem: "Les plans du Coach intelligent font partie de Premium. La recommandation et ses preuves restent gratuites.", see_prem: "Voir Premium", prem_soon: "Premium n'est pas encore en vente.",
      n_offline: "Vous êtes hors ligne. Voici le plan tel que le serveur l'a vu en dernier ; rien ne peut être modifié ou vérifié avant le retour du réseau.",
      n_error: "Le coach est injoignable. Rien n'a été modifié.", retry: "Réessayer",
      n_track: "Votre compte change encore de programme. Réessayez dans un instant.", n_active_exists: "Vous avez déjà un plan ouvert dans ce programme. Terminez-le ou annulez-le d'abord.",
      n_notif_on: "Un rappel est programmé sur cet iPhone pour chaque séance.", n_notif_off: "Les notifications sont désactivées pour BE Mastery : vos séances s'affichent ici.",
      n_notif_web: "Vos séances s'affichent ici et à l'ouverture de l'appli. Le rappel quotidien continue de fonctionner.",
      n_notif_ask: "Autoriser les notifications", n_unavail: "Le Coach intelligent n'est pas encore disponible ici.",
      loading: "Chargement de votre coach…", remind_t: "Coach intelligent", remind_b: "La séance {{n}} sur {{total}} est prête · environ {{m}} minutes.",
      in_app_due: "Coach intelligent : la séance {{n}} est prête.", loading_sig: "Lecture de vos résultats…",
      cal_title: "Coach intelligent · séance {{n}} sur {{total}}", cal_desc: "{{act}}. Ouvrez BE Mastery pour commencer.",
    },
  };
  function lang() { try { return (S.profile && S.profile.lang) || "en"; } catch (e) { return "en"; } }
  function w(k, v) {
    const L = TX[lang()] || TX.en;
    let s = L[k] != null ? L[k] : TX.en[k] != null ? TX.en[k] : k;
    if (v) s = s.replace(/\{\{(\w+)\}\}/g, (m, x) => v[x] != null ? String(v[x]) : m);
    return s;
  }
  const h = s => esc(String(s == null ? "" : s));
  const evText = e => w(e.k.replace(/^sc\./, ""), Object.assign({}, e.vars, e.vars && e.vars.cat ? { cat: catName(e.vars.cat) } : {}));

  /* --------------------------------------------------------------- gates */
  function on() { try { return flag("smart_coach_enabled") && E && E.TRACKS.includes(areaId()); } catch (e) { return false; } }
  function api() {
    try { const o = localStorage.getItem("be_coach_api"); if (o && /^https?:\/\//.test(o)) return o.replace(/\/+$/, ""); } catch (e) {}
    try { const e = window.beEnv && beEnv(); if (e && e.coach) return e.coach; } catch (e) {}
    return "";
  }
  function signedIn() { try { return typeof FBUser !== "undefined" && !!FBUser; } catch (e) { return false; } }
  function premiumShown() { try { return planOn() ? entIsPremiumForDisplay() : false; } catch (e) { return false; } }
  function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } }
  const area = () => areaId();
  /* the device's copy of the server's last answer, per programme */
  function box() { const m = aMap("coach"); return m; }

  /* ---------------------------------------------------- the learner's data */
  function gameUI() { const a = area(); const UI = a === "welding" ? window.WMUI : window.EMUI; try { return UI && UI.on() ? UI : null; } catch (e) { return null; } }
  function gameEngine() { return area() === "welding" ? window.WMEngine : window.EMEngine; }
  let _catNames = {};
  function catName(id) {
    if (!id) return "";
    if (_catNames[id]) return _catNames[id];
    try { const g = trackGrammarCategories().find(c => c.k === id); if (g) return t(g.n); } catch (e) {}
    return id;
  }
  async function gameSig(now) {
    const UI = gameUI(), Eng = gameEngine(); if (!UI || !Eng) return null;
    try { await UI._load(); } catch (e) { return null; }
    const st = UI._state(), C = UI._corpus(); if (!st || !C) return null;
    (C.categories || []).forEach(c => { _catNames[c.id] = (lang() === "fr" && c.fr) || c.en || c.id; });
    const perf = Eng.performance(st, C.terms, now), errs = Eng.errorsByStage(st, C.terms) || {};
    return { answers: perf.answers || 0, accuracy: perf.accuracy, due: perf.due || 0, skills: perf.skills || [],
      cats: Object.entries(errs).filter(([id]) => id !== "mine").map(([id, list]) => ({ id, open: list.filter(e => e.now === "open").length })) };
  }
  function grammarCats() {
    try { const ex = trackGrammarExercises(); return trackGrammarCategories().map(c => c.k).filter(k => ex[k] && ex[k].length); } catch (e) { return []; }
  }
  function history() { const b = box(); return (b.srv && b.srv.history) || []; }
  async function signals() {
    const now = Date.now(), voc = areaVocab(), words = Object.keys(voc);
    const tr = troubleMap(), trw = Object.entries(tr).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const gram = aMap("gram");
    const pos = (() => { try { const p = currentPos(); return p && p.w ? { w: p.w, d: p.d } : null; } catch (e) { return null; } })();
    const game = await gameSig(now);
    const sig = { track: area(), now, game, history: history(), lesson: pos,
      vocab: { saved: words.length, ready: words.filter(x => vocState(x) === "ready").length, quiz: aList("quizHist").slice(-6).map(x => x.p) },
      trouble: { n: trw.length, words: trw.slice(0, 3) },
      shadow: { scores: areaFbHist().filter(x => x.score != null).slice(-10).map(x => x.score) },
      grammar: Object.entries(gram).map(([cat, g]) => ({ cat, runs: g.runs || 0, best: g.best || 0, last: (g.hist || []).slice(-3).map(x => x.p) })) };
    const ctx = { track: area(), game: !!game, words: words.length, grammarCats: grammarCats(), shadow: true };
    return { sig, ctx };
  }
  /* every saved record that can prove a session, normalised for the engine */
  function records() {
    const out = [];
    aList("vocRuns").forEach(r => out.push({ type: "words", ref: "w" + r.t, ts: r.t, n: r.n }));
    aList("quizHist").forEach(r => out.push({ type: "quiz", ref: "q" + r.t, ts: r.t, score: r.p }));
    Object.entries(aMap("gram")).forEach(([cat, g]) => (g.hist || []).forEach(x => out.push({ type: "grammar", ref: "g" + cat + x.t, ts: x.t, cat, score: x.p })));
    areaFbHist().forEach(r => { if (r.score != null) out.push({ type: "shadow", ref: "s" + r.ts, ts: r.ts, score: r.score }); });
    const UI = gameUI();
    try { const st = UI && UI._state(); (st && st.hist || []).forEach(r => { if (!r.part && r.n) out.push({ type: "game", ref: r.id, ts: r.end || r.ts, mode: r.m, n: r.n, cats: r.cats || [], score: Math.round(100 * r.ok / r.n) }); }); } catch (e) {}
    return out;
  }

  /* ------------------------------------------------------------- server */
  const rid = () => "r-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  async function call(op, payload) {
    const base = api(); if (!base) return { status: 0, j: { error: "unavailable" } };
    if (!navigator.onLine) return { status: 0, j: { error: "offline" } };
    let tok = ""; try { tok = await FBUser.getIdToken(); } catch (e) { return { status: 401, j: { error: "auth_required" } }; }
    try {
      const r = await fetch(base + "/", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: JSON.stringify({ op, track: area(), payload: payload || {} }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && (j.active !== undefined || j.history)) { const b = box(); b.srv = { active: j.active, history: j.history || [], at: Date.now(), plan: j.plan }; save(); }
      return { status: r.status, j };
    } catch (e) { return { status: 0, j: { error: "network" } }; }
  }
  const active = () => { const b = box(); return b.srv && b.srv.active || null; };
  function ev(name, props) { try { track("coach_" + name, Object.assign({ track: area() }, props || {})); } catch (e) {} }

  /* ------------------------------------------------------- labels/dates */
  function dateLbl(ymd, withDay) {
    try { return new Intl.DateTimeFormat(lang() === "fr" ? "fr-FR" : "en-GB", { weekday: withDay === false ? undefined : "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(ymd + "T00:00:00Z")); } catch (e) { return ymd; }
  }
  const whenLbl = s => dateLbl(s.date) + " · " + s.time;
  function skillLbl(o) { return w("sk_" + o.skill, { cat: catName(o.cat) }); }
  function gameName(m) { return w("g_" + m); }
  function actLbl(s) {
    const a = s.act, base = a.type === "game" ? (a.cat ? w("a_game_cat", { game: gameName(a.mode), cat: catName(a.cat) }) : w("a_game", { game: gameName(a.mode) })) : w("a_" + a.type, { cat: catName(a.cat) });
    return s.role === "start" ? w("a_role_start") + " · " + base : s.role === "check" ? w("a_role_check") + " · " + base : base;
  }
  function critLbl(s) { const a = s.act; return w("c_" + a.type, { cat: catName(a.cat), game: a.mode ? gameName(a.mode) : "" }); }
  function ring(pct, size) {
    const r = 26, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return `<svg class="sc-ring" viewBox="0 0 64 64" width="${size || 72}" height="${size || 72}" aria-hidden="true"><defs><linearGradient id="scg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><circle cx="32" cy="32" r="${r}" class="sc-ring-bg"/><circle cx="32" cy="32" r="${r}" class="sc-ring-fg" stroke="url(#scg)" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" style="--c:${c.toFixed(1)}"/></svg>`;
  }

  /* -------------------------------------------------------------- state */
  const V = { screen: "home", busy: false, msg: null, analysis: null, ctx: null, plans: null, kind: null, obj: null, draft: null, mode: "new", cal: false, wd: null, ridFor: null, notif: null, loading: false };
  function fresh() { return { screen: "home", busy: false, msg: null, draft: null, mode: "new", wd: null }; }

  /* the recommendation is cached until a meaningful learning event changes the evidence */
  function sigKey(sig) {
    return JSON.stringify([sig.track, sig.vocab.saved, sig.vocab.ready, sig.vocab.quiz, sig.trouble.n, sig.shadow.scores.length, sig.shadow.scores.slice(-1), sig.grammar.map(g => [g.cat, g.runs]), sig.game && [sig.game.answers, sig.game.due], (sig.history || []).map(x => x.id + x.status)]);
  }
  async function analyse(force) {
    const { sig, ctx } = await signals();
    const b = box(), key = sigKey(sig);
    let a = !force && b.rec && b.rec.key === key ? b.rec.a : null;
    if (!a) { a = E.analyse(sig, ctx); b.rec = { key, a, at: Date.now() }; save(); ev("recommended", { skill: a.priority.skill, kind: E.recommendKind(a.priority), result: a.sufficient ? "evidence" : "diagnostic" }); }
    V.analysis = a; V.ctx = ctx;
    choose(a.priority, E.recommendKind(a.priority));
  }
  function choose(obj, kind) {
    V.obj = obj; V.plans = E.plans({ skill: obj.skill, cat: obj.cat || null }, V.ctx);
    V.kind = (V.plans.find(p => p.kind === kind) || V.plans[0]).kind;
  }
  const curPlan = () => V.plans && V.plans.find(p => p.kind === V.kind);
  function today() { return E.todayIn(Date.now(), tz()); }
  function defaultTime() { try { return (S.reminder && S.reminder.time) || "19:00"; } catch (e) { return "19:00"; } }
  function newDraft() {
    const p = curPlan(); if (!p) return null;
    let t0 = defaultTime(); if (E.quiet(t0)) t0 = "19:00";
    const r = E.arrange(p, { start: today(), time: t0 });
    return Object.assign(r.plan, { tz: tz() });
  }

  /* --------------------------------------------------------------- sheet */
  function sheetOpen() { return document.getElementById("scOv"); }
  async function open(screen) {
    if (!on()) return toast(w("n_unavail"));
    let ov = sheetOpen();
    if (!ov) {
      ov = document.createElement("div"); ov.id = "scOv"; ov.className = "sc-ov";
      ov.innerHTML = `<div class="sc-sheet" role="dialog" aria-modal="true" aria-labelledby="scTitle"><div class="sc-head"><div><span class="sc-kick">${h(w("kicker"))}</span><h2 id="scTitle">${h(w("title"))}</h2></div><span class="sc-area">${h(area() === "welding" ? w("area_we") : w("area_ge"))}</span><button class="sc-x" data-sc="close" aria-label="${h(w("close"))}">${ic("close")}</button></div><div class="sc-body" id="scBody" aria-live="polite"></div></div>`;
      ov.addEventListener("click", e => { if (e.target === ov) close(); });
      ov.addEventListener("click", onClick); ov.addEventListener("change", onChange);
      document.body.appendChild(ov);
      document.addEventListener("keydown", onKey);
      const pf = document.getElementById("pfSetupOv"); if (pf) pf.remove();
    }
    Object.assign(V, fresh(), { screen: screen || "home" });
    V.loading = true; draw();
    ev("viewed", { source: screen || "home" });
    if (signedIn()) await call("status");
    if (!active()) await analyse(false);
    V.loading = false; notifState().then(draw);
    draw();
    scCheck(true);
  }
  function close() { const ov = sheetOpen(); if (ov) ov.remove(); document.removeEventListener("keydown", onKey); }
  function onKey(e) { if (e.key === "Escape") close(); }
  function draw() {
    const el = document.getElementById("scBody"); if (!el) return;
    el.innerHTML = V.loading ? `<div class="sc-load"><span class="sc-pulse"></span>${h(w("loading"))}</div>` : body();
    try { manIconizeInline(el); } catch (e) {}
  }
  function note(kind, text, btn) { return `<div class="sc-note ${kind}">${h(text)}${btn || ""}</div>`; }
  function body() {
    const p = active(), msg = V.msg ? note(V.msg.kind, V.msg.text, V.msg.btn || "") : "";
    if (V.screen === "edit") return msg + editHTML();
    if (V.screen === "alts") return msg + altsHTML();
    if (V.screen === "focus") return msg + focusHTML();
    let top = "";
    if (!navigator.onLine) top += note("warn", w("n_offline"));
    if (!signedIn()) top += note("info", w("n_signin"), `<button class="sc-btn sm" data-sc="signin">${h(w("signin"))}</button>`);
    if (p) return top + msg + activeHTML(p);
    const done = history()[0];
    return top + msg + (done && done.status === "completed" && !(box().seen || {})[done.id] ? reviewHTML(done) : "") + recHTML();
  }

  /* ---- the recommendation ---- */
  function recHTML() {
    const a = V.analysis; if (!a) return "";
    const p = curPlan(), o = a.priority === V.obj ? a.priority : V.obj;
    const prem = premiumShown();
    return `<section class="sc-card sc-glow">
      <span class="sc-eyebrow">${ic("target")} ${h(w("focus_lbl"))}</span>
      <h3 class="sc-skill">${h(skillLbl(o))}</h3>
      <h4 class="sc-h4">${h(w("why_h"))}</h4>
      <ul class="sc-ev">${(o.evidence || []).map(e => `<li>${h(evText(e))}</li>`).join("")}</ul>
      ${a.lesson && !a.sufficient ? `<p class="sc-mut">${h(w("lesson_alt", { w: a.lesson.w, d: a.lesson.d }))} <button class="sc-link" data-sc="lesson">${h(w("lesson_go"))} →</button></p>` : ""}
    </section>
    ${p ? planCard(p, true) : ""}
    <div class="sc-actions">
      ${prem ? `<button class="sc-btn pri" data-sc="review">${h(w("review_btn"))}</button>` : premBtn()}
      ${V.plans && V.plans.length > 1 ? `<button class="sc-btn ghost" data-sc="alts">${h(w("not_for_me"))}</button>` : ""}
    </div>
    ${a.others && a.others.length ? `<button class="sc-link center" data-sc="focus">${h(w("other_focus"))}</button>` : ""}`;
  }
  function premBtn() {
    let offer = false; try { offer = premOffered(); } catch (e) {}
    return `<div class="sc-note prem">${ic("star")} ${h(w("n_prem"))}${offer ? `<button class="sc-btn sm pri" data-sc="premium">${h(w("see_prem"))}</button>` : `<small>${h(w("prem_soon"))}</small>`}</div>`;
  }
  function planCard(p, rec) {
    const dates = p.sessions.map(s => s.date ? dateLbl(s.date) : "").filter(Boolean);
    const draft = rec ? E.arrange(p, { start: today(), time: E.quiet(defaultTime()) ? "19:00" : defaultTime() }).plan : p;
    return `<section class="sc-card sc-plan k-${p.kind}">
      <div class="sc-plan-h">${ic(KIND_IC[p.kind])}<div><span class="sc-eyebrow">${h(rec ? w("plan_h") : "")}</span><h3>${h(w("k_" + p.kind))}</h3></div></div>
      <p class="sc-mut">${h(w("kd_" + p.kind))}</p>
      <div class="sc-facts">
        <div><span>${h(w("dur_lbl"))}</span><b>${p.days} ${lang() === "fr" ? "jours" : "days"}</b><i class="sc-lock">${ic("lock")}${h(w("fixed"))}</i></div>
        <div><span>${h(w("sess_lbl"))}</span><b>${p.sessions.length}</b></div>
        <div><span>${h(w("total_lbl"))}</span><b>${h(w("about_min", { n: p.minutes }))}</b></div>
      </div>
      <ol class="sc-prev">${draft.sessions.map(s => `<li><span class="sc-dt">${h(dateLbl(s.date))} · ${h(s.time)}</span><span>${h(actLbl(s))}</span></li>`).join("")}</ol>
      <h4 class="sc-h4">${h(w("benefit_h"))}</h4><p class="sc-mut">${h(w("benefit_" + p.objective.skill))} ${h(w("no_promise"))}</p>
      <h4 class="sc-h4">${h(w("judge_h"))}</h4><p class="sc-mut">${h(p.check ? w("judge_check", { p: E.PASS }) : w("judge_quick"))}</p>
      <h4 class="sc-h4">${h(w("done_when_h"))}</h4><p class="sc-mut">${h(p.check ? w("done_when_check") : w("done_when_quick"))}</p>
      ${dates.length ? "" : ""}
    </section>`;
  }
  function altsHTML() {
    return `<h3 class="sc-h3">${h(w("alts_h"))}</h3><p class="sc-mut">${h(w("alts_sub"))} · ${h(skillLbl(V.obj))}</p>
      ${V.plans.filter(p => p.kind !== V.kind).map(p => planCard(p, false) + `<button class="sc-btn pri wide" data-sc="pick" data-k="${p.kind}">${h(w("choose"))}</button>`).join("")}
      <button class="sc-btn ghost wide" data-sc="home">${h(w("back"))}</button>`;
  }
  function focusHTML() {
    const list = (V.analysis && V.analysis.others) || [];
    return `<h3 class="sc-h3">${h(w("focus_h"))}</h3><p class="sc-mut">${h(w("focus_sub"))}</p>
      ${list.map((o, i) => `<section class="sc-card"><h3 class="sc-skill sm">${h(skillLbl(o))}</h3><ul class="sc-ev">${o.evidence.map(e => `<li>${h(evText(e))}</li>`).join("")}</ul><button class="sc-btn ghost" data-sc="pickfocus" data-i="${i}">${h(w("choose"))}</button></section>`).join("")}
      <button class="sc-btn ghost wide" data-sc="home">${h(w("back"))}</button>`;
  }

  /* ---- the schedule editor: new plan, move sessions, restart ---- */
  const WD = [1, 2, 3, 4, 5, 6, 0];
  function wdName(d) { try { return new Intl.DateTimeFormat(lang() === "fr" ? "fr-FR" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 4 + d))); } catch (e) { return String(d); } }
  function editHTML() {
    const d = V.draft; if (!d) return "";
    const errs = draftErrors(d), K = E.KINDS[d.kind], locked = s => s.done;
    const moving = V.mode === "move", anyDone = d.sessions.some(s => s.done);
    const dayOpts = s => { const o = []; for (let i = 0; i < K.days; i++) { const ymd = E.addDays(d.start, i); o.push(`<option value="${ymd}" ${ymd === s.date ? "selected" : ""}>${h(dateLbl(ymd))}</option>`); } return o.join(""); };
    return `<h3 class="sc-h3">${h(w("edit_h"))}</h3><p class="sc-mut">${h(w("edit_sub"))}</p>
      <div class="sc-locked">
        <div><span>${h(w("focus_lbl"))}</span><b>${h(skillLbl(d.objective))}</b><i class="sc-lock">${ic("lock")}${h(w("focus_by"))}</i></div>
        <div><span>${h(w("k_" + d.kind))} · ${h(w("dur_lbl"))}</span><b>${d.days} ${lang() === "fr" ? "jours" : "days"}</b><i class="sc-lock">${ic("lock")}${h(w("fixed"))}</i></div>
      </div>
      <div class="sc-form">
        <label>${h(w("start_lbl"))}<input type="date" id="scStart" value="${h(d.start)}" min="${today()}" max="${E.addDays(today(), E.MAX_AHEAD_DAYS)}" ${anyDone ? "disabled" : ""} data-sc-in="start"></label>
        <label>${h(w("time_all"))}<span class="sc-row"><input type="time" id="scTimeAll" value="${h(d.sessions.find(s => !s.done) ? d.sessions.find(s => !s.done).time : "19:00")}" min="07:00" max="21:59"><button class="sc-btn sm ghost" data-sc="timeall">${h(w("apply"))}</button></span></label>
        ${anyDone ? "" : `<div class="sc-lbl">${h(w("days_lbl"))}</div><div class="sc-wd" role="group">${WD.map(x => `<button class="sc-chip ${!V.wd || V.wd.includes(x) ? "on" : ""}" data-sc="wd" data-d="${x}" aria-pressed="${!V.wd || V.wd.includes(x)}">${h(wdName(x))}</button>`).join("")}</div>`}
      </div>
      <p class="sc-window">${h(w("window", { from: dateLbl(d.start), to: dateLbl(d.end), days: d.days }))}</p>
      <ol class="sc-edit">${d.sessions.map(s => `<li class="${locked(s) ? "done" : ""}"><span class="sc-n">${s.i + 1}</span><div><b>${h(actLbl(s))}</b><small>${h(critLbl(s))}</small>
        ${locked(s) ? `<span class="sc-st done">${ic("check")} ${h(w("st_done"))}</span>` : `<span class="sc-row"><select data-sc-in="date" data-i="${s.i}" aria-label="${h(w("sess_n", { n: s.i + 1 }))}">${dayOpts(s)}</select><input type="time" data-sc-in="time" data-i="${s.i}" value="${h(s.time)}" aria-label="${h(w("sess_n", { n: s.i + 1 }))}"></span>`}</div></li>`).join("")}</ol>
      ${errs.length ? `<div class="sc-note warn" role="alert">${errs.map(h).join("<br>")}</div>` : `<p class="sc-sum">${h(w("summary", { n: d.sessions.length, from: dateLbl(d.sessions[0].date), to: dateLbl(d.sessions[d.sessions.length - 1].date), m: d.sessions.reduce((n, s) => n + s.minutes, 0) }))}</p>`}
      ${moving ? "" : `<label class="sc-check"><input type="checkbox" data-sc-in="cal" ${V.cal ? "checked" : ""}> ${h(w("cal_opt"))}</label>`}
      <div class="sc-actions"><button class="sc-btn pri" data-sc="${V.mode === "new" ? "approve" : V.mode === "restart" ? "restartgo" : "movego"}" ${errs.length || V.busy ? "disabled" : ""}>${h(V.busy ? w("approving") : V.mode === "new" ? w("approve") : V.mode === "restart" ? w("restart") : w("reschedule"))}</button>
      <button class="sc-btn ghost" data-sc="home">${h(w("back"))}</button></div>`;
  }
  function draftErrors(d) {
    if (V.few) return [w("err_few_days", V.few)];
    const errs = E.validate(d, { today: d.sessions.some(s => s.done) || V.mode === "move" && d.start === (active() || {}).start ? null : today(), track: area() });
    if (d.sessions.some(s => !s.done && s.date < today())) errs.push("past");
    return [...new Set(errs)].map(c => TX.en["err_" + c] ? w("err_" + c) : w("err_generic", { c }));
  }
  function reflow() {
    const d = V.draft, p = { ...d }; V.few = null;
    if (d.sessions.some(s => s.done)) return;
    const r = E.arrange(p, { start: d.start, weekdays: V.wd, times: d.sessions.map(s => s.time) });
    if (r.error) { V.few = { have: r.have, need: r.need, days: d.days }; return; }
    V.draft = Object.assign(r.plan, { tz: d.tz });
  }

  /* ---- the active programme ---- */
  function activeHTML(p) {
    const pr = p.progress || E.progress(p, Date.now()), K = E.KINDS[p.kind];
    const dayN = Math.min(p.days, Math.max(1, E.diffDays(p.start, today()) + 1));
    const nx = pr.next, nst = nx ? pr.states[nx.i] : null, canStart = nx && ["today", "due", "missed"].includes(nst) && p.status === "active" && pr.status !== "overdue";
    const pend = (box().pend || {})[p.id + ":" + (nx ? nx.i : -1)];
    let alert = "";
    if (pr.status === "overdue") alert = `<section class="sc-card warn"><h3 class="sc-h3">${h(w("overdue_h"))}</h3><p>${h(w("overdue_b", { done: pr.done, total: pr.total, end: dateLbl(p.end) }))}</p><div class="sc-actions"><button class="sc-btn pri" data-sc="restart">${h(w("restart"))}</button><button class="sc-btn ghost" data-sc="cancel">${h(w("cancel"))}</button></div></section>`;
    else if (p.status === "paused") alert = note("info", w("paused_b"));
    else if (pr.missed >= 2) alert = note("warn", w("missed_many", { n: pr.missed }), `<span class="sc-row"><button class="sc-btn sm" data-sc="move">${h(w("move"))}</button><button class="sc-btn sm ghost" data-sc="pause">${h(w("pause"))}</button></span>`);
    else if (pr.missed === 1) { const m = p.sessions.find((s, i) => pr.states[i] === "missed"); alert = note("warn", w("missed_one", { n: m.i + 1 }), `<span class="sc-row"><button class="sc-btn sm" data-sc="start" data-i="${m.i}">${h(w("do_now"))}</button><button class="sc-btn sm ghost" data-sc="move">${h(w("move"))}</button></span>`); }
    return `<section class="sc-card sc-glow sc-active">
      <div class="sc-act-top">${ring(pr.pct)}<div><span class="sc-eyebrow">${h(w("active_h"))} · ${h(w("k_" + p.kind))}</span><h3 class="sc-skill">${h(skillLbl(p.objective))}</h3>
        <p class="sc-mut">${h(w("verified", { done: pr.done, total: pr.total }))} · ${h(w("day_of", { d: dayN, n: p.days }))}</p></div></div>
      ${nx && pr.status !== "overdue" ? `<div class="sc-next"><span class="sc-eyebrow">${h(w("next_h"))} · ${h(w("sess_n", { n: nx.i + 1 }))}</span><b>${h(actLbl(nx))}</b><small>${h(whenLbl(nx))} · ${h(w("min", { n: nx.minutes }))}</small><small>${h(critLbl(nx))}</small>
        ${pend ? `<small class="sc-pend">${h(w(pend === "confirm" ? "confirm_wait" : "pending"))}</small>` : ""}
        ${canStart ? `<button class="sc-btn pri wide" data-sc="start" data-i="${nx.i}">${ic("play")} ${h(w("start"))}</button>` : nst === "upcoming" ? `<small class="sc-mut">${h(w("opens", { when: dateLbl(nx.date) }))}</small>` : ""}</div>` : ""}
    </section>
    ${alert}
    <ol class="sc-time">${p.sessions.map((s, i) => { const st = pr.states[i]; return `<li class="st-${st}"><span class="sc-dot"></span><div><b>${h(actLbl(s))}</b><small>${h(whenLbl(s))}</small>
      ${st === "done" ? `<small class="sc-ok">${ic("check")} ${h(w("st_done"))} · ${h(w(s.verifiedBy === "server" ? "by_server" : "by_device"))}${s.score != null ? " · " + h(w("score", { p: s.score })) : ""}</small>` : `<span class="sc-st ${st}">${h(w("st_" + st))}</span>`}</div></li>`; }).join("")}</ol>
    <p class="sc-mut sc-notif">${h(notifText())}${V.notif === "default" && IS_IOS_APP ? ` <button class="sc-link" data-sc="notif">${h(w("n_notif_ask"))}</button>` : ""}</p>
    ${pr.status !== "overdue" ? `<div class="sc-actions wrap">
      ${p.status === "active" ? `<button class="sc-btn ghost sm" data-sc="move">${h(w("reschedule"))}</button><button class="sc-btn ghost sm" data-sc="pause">${h(w("pause"))}</button>` : `<button class="sc-btn sm" data-sc="resume">${h(w("resume"))}</button>`}
      <button class="sc-btn ghost sm" data-sc="ics">${ic("calendar")} ${h(w("cal_add"))}</button>
      <button class="sc-btn ghost sm danger" data-sc="cancel">${h(w("cancel"))}</button></div>` : ""}`;
  }
  function reviewHTML(hx) {
    const o = hx.outcome || {};
    const comp = o.competent == null ? w("r_comp_na") : w(o.competent ? "r_comp_yes" : "r_comp_no", { p: o.final, pass: E.PASS });
    const delta = o.delta == null ? w("r_delta_na") : w("r_delta", { s: o.start, p: o.final, d: (o.delta > 0 ? "+" : "") + o.delta });
    return `<section class="sc-card sc-review"><span class="sc-eyebrow">${ic("trophy")} ${h(w("review_h"))} · ${h(w("k_" + hx.kind))}</span><h3 class="sc-skill sm">${h(skillLbl({ skill: hx.skill, cat: hx.cat }))}</h3>
      <ul class="sc-out"><li>${ic("check")} ${h(w("r_done", { done: o.done != null ? o.done : hx.done, total: o.required || hx.total }))}</li><li>${ic("target")} ${h(comp)}</li><li>${ic("chart")} ${h(delta)}</li>${o.serverVerified ? `<li>${ic("shield")} ${h(w("r_verified", { n: o.serverVerified }))}</li>` : ""}</ul>
      <h4 class="sc-h4">${h(w("next_step_h"))}</h4><p class="sc-mut">${h(w("next_step_b"))}</p></section>`;
  }

  /* ---------------------------------------------------- notifications */
  async function notifState() {
    const P = nativePush();
    if (!P) { V.notif = "web"; return; }
    try { const r = await P.permission(); V.notif = r && r.permission || "default"; } catch (e) { V.notif = "web"; }
  }
  function nativePush() { try { const P = IS_IOS_APP && capPlugin("BEPush"); return P && typeof P.coachSchedule === "function" ? P : null; } catch (e) { return null; } }
  function notifText() { return V.notif === "granted" ? w("n_notif_on") : V.notif === "denied" ? w("n_notif_off") : V.notif === "web" ? w("n_notif_web") : w("n_notif_off"); }
  /* the device's notifications mirror the server's plan: every pending
     Smart Coach notification is replaced, never added to — no duplicates */
  async function notifSync(ask) {
    const P = nativePush(); if (!P) return;
    const p = active(), now = Date.now(), items = [];
    if (p && p.status === "active" && (p.progress || {}).status !== "overdue") p.sessions.forEach(s => {
      if (s.done) return;
      const at = E.atOf(s.date, s.time, p.tz); if (at <= now) return;
      const [y, mo, d] = s.date.split("-").map(Number), [hh, mi] = s.time.split(":").map(Number);
      items.push({ id: "be-coach-" + p.id + "-" + s.i, year: y, month: mo, day: d, hour: hh, minute: mi, title: w("remind_t"), body: w("remind_b", { n: s.i + 1, total: p.sessions.length, m: s.minutes }), coach: p.id + ":" + s.i });
    });
    try { const r = await P.coachSchedule({ items, ask: !!ask }); V.notif = r && r.permission || V.notif; if (V.notif === "denied" && ask) ev("notif_denied"); } catch (e) {}
  }
  /* in the app: one notice per session per day while a session is open */
  let _inAppT = null;
  function inAppRemind() {
    clearTimeout(_inAppT);
    if (!on()) return;
    const p = active(); if (!p || p.status !== "active") return;
    const pr = E.progress(p, Date.now()), nx = pr.next; if (!nx || pr.status === "overdue") return;
    const st = pr.states[nx.i], b = box(), key = p.id + ":" + nx.i + ":" + today();
    if (["due", "missed"].includes(st) && !(b.told || {})[key]) {
      b.told = Object.assign({}, (b.told && Object.keys(b.told).length < 40) ? b.told : {}, { [key]: 1 }); save();
      setTimeout(() => toast(w("in_app_due", { n: nx.i + 1 }), 4000), 2500);
    } else if (st === "today") {
      const ms = E.atOf(nx.date, nx.time, p.tz) - Date.now();
      if (ms > 0 && ms < 864e5) _inAppT = setTimeout(inAppRemind, ms + 1000);
    }
  }

  /* --------------------------------------------------------- calendar */
  function ics(p) {
    const f = at => { const d = new Date(at); return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"; };
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lomonec LLC//BE Mastery Smart Coach//EN", "CALSCALE:GREGORIAN"];
    p.sessions.forEach(s => {
      if (s.done) return;
      const at = E.atOf(s.date, s.time, p.tz);
      lines.push("BEGIN:VEVENT", "UID:" + p.id + "-" + s.i + "@coach.lomonec.com", "SEQUENCE:" + (p.rev || 1), "DTSTAMP:" + f(Date.now()), "DTSTART:" + f(at), "DTEND:" + f(at + s.minutes * 60000),
        "SUMMARY:" + w("cal_title", { n: s.i + 1, total: p.sessions.length }), "DESCRIPTION:" + w("cal_desc", { act: actLbl(s) }).replace(/[,;]/g, " "), "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }
  function icsDownload(p) {
    const url = URL.createObjectURL(new Blob([ics(p)], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "be-mastery-smart-coach.ics"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(w("cal_note"), 4200);
  }

  /* ------------------------------------------------------ the actions */
  function failMsg(r) {
    const e = r.j && r.j.error;
    if (r.status === 0 && e === "offline") return { kind: "warn", text: w("n_offline") };
    if (r.status === 401) return { kind: "info", text: w("n_signin"), btn: `<button class="sc-btn sm" data-sc="signin">${h(w("signin"))}</button>` };
    if (r.status === 402) return { kind: "prem", text: w("n_prem") };
    if (r.status === 403) return { kind: "warn", text: w("n_track") };
    if (e === "active_exists") return { kind: "warn", text: w("n_active_exists") };
    if (r.status === 422 && r.j.errs) return { kind: "warn", text: r.j.errs.map(c => TX.en["err_" + c] ? w("err_" + c) : w("err_generic", { c })).join(" ") };
    return { kind: "warn", text: w("n_error"), btn: `<button class="sc-btn sm" data-sc="home">${h(w("retry"))}</button>` };
  }
  async function mutate(op, payload, okText) {
    if (V.busy) return null;
    V.busy = true; V.msg = null; draw();
    const key = op + JSON.stringify(payload || {});
    if (V.ridFor !== key) { V.ridFor = key; V.rid = rid(); }      // a retry of the SAME change keeps its id: the server answers once
    const r = await call(op, Object.assign({ rid: V.rid }, payload || {}));
    V.busy = false;
    if (r.status === 200) { V.ridFor = null; if (okText) toast(okText); await notifSync(false); inAppRemind(); return r; }
    V.msg = failMsg(r); draw(); return null;
  }
  async function onClick(e) {
    const b = e.target.closest("[data-sc]"); if (!b) return;
    const a = b.dataset.sc;
    if (a === "close") return close();
    if (a === "home") { Object.assign(V, fresh()); if (!active()) await analyse(false); return draw(); }
    if (a === "signin") { close(); try { fbOpenModal("signin"); } catch (x) {} return; }
    if (a === "premium") { close(); try { premiumOpen("smart_coach"); } catch (x) {} return; }
    if (a === "lesson") { const l = V.analysis && V.analysis.lesson; close(); if (l) go("session", l.w, l.d); return; }
    if (a === "alts") { V.screen = "alts"; ev("declined", { kind: V.kind, skill: V.obj.skill }); return draw(); }
    if (a === "focus") { V.screen = "focus"; return draw(); }
    if (a === "pick") { V.kind = b.dataset.k; V.screen = "home"; return draw(); }
    if (a === "pickfocus") { const o = V.analysis.others[+b.dataset.i]; if (o) choose(o, E.recommendKind(o)); V.screen = "home"; return draw(); }
    if (a === "review") { V.draft = newDraft(); V.mode = "new"; V.wd = null; V.few = null; V.screen = "edit"; return draw(); }
    if (a === "wd") { const d = +b.dataset.d; let s = V.wd ? V.wd.slice() : WD.slice(); s = s.includes(d) ? s.filter(x => x !== d) : s.concat(d); V.wd = s.length === 7 ? null : s; reflow(); return draw(); }
    if (a === "timeall") { const v = (document.getElementById("scTimeAll") || {}).value; if (v) V.draft.sessions.forEach(s => { if (!s.done) s.time = v; }); return draw(); }
    if (a === "approve") return approve();
    if (a === "move" || a === "restart") {
      const p = active(); if (!p) return;
      V.draft = JSON.parse(JSON.stringify(p)); V.mode = a; V.wd = null; V.few = null;
      if (a === "restart") { V.draft.sessions.forEach(s => { delete s.done; delete s.score; }); const r = E.arrange(V.draft, { start: today(), times: V.draft.sessions.map(s => s.time) }); V.draft = Object.assign(r.plan, { tz: p.tz }); }
      else { const t0 = today(); let prev = ""; V.draft.sessions.forEach(s => { if (!s.done && s.date < t0) s.date = t0 > prev ? t0 : E.addDays(prev, 1); prev = s.date; }); }
      V.screen = "edit"; return draw();
    }
    if (a === "movego" || a === "restartgo") {
      const d = V.draft, payload = { sessions: d.sessions.filter(s => !s.done).map(s => ({ i: s.i, date: s.date, time: s.time })) };
      if (a === "restartgo" || d.start !== active().start) payload.start = d.start;
      const r = await mutate(a === "movego" ? "reschedule" : "restart", payload, w("ok_moved"));
      if (r) { ev(a === "movego" ? "rescheduled" : "restarted", { kind: d.kind, skill: d.objective.skill }); Object.assign(V, fresh()); draw(); }
      return;
    }
    if (a === "pause" || a === "resume") { const r = await mutate(a, {}); if (r) { ev(a === "pause" ? "paused" : "resumed"); draw(); } return; }
    if (a === "cancel") {
      let yes = false; try { yes = await askConfirm(w("cancel_q")); } catch (x) { yes = confirm(w("cancel_q")); }
      if (!yes) return;
      const p = active(), r = await mutate("cancel", {});
      if (r) { ev("cancelled", { kind: p && p.kind, skill: p && p.objective.skill, n: String(p ? p.sessions.filter(s => s.done).length : 0) }); Object.assign(V, fresh()); await analyse(true); draw(); }
      return;
    }
    if (a === "ics") { const p = active(); if (p) icsDownload(p); return; }
    if (a === "notif") { await notifSync(true); return draw(); }
    if (a === "start") return launch(+b.dataset.i);
  }
  function onChange(e) {
    const el = e.target, k = el.dataset && el.dataset.scIn; if (!k || !V.draft) return;
    if (k === "cal") { V.cal = el.checked; return; }
    if (k === "start") { if (E.ymdOk(el.value)) { V.draft.start = el.value; V.draft.end = E.addDays(el.value, V.draft.days - 1); reflow(); } return draw(); }
    const s = V.draft.sessions[+el.dataset.i]; if (!s || s.done) return;
    if (k === "date") s.date = el.value;
    if (k === "time") s.time = el.value;
    V.few = null; draw();
  }
  async function approve() {
    const d = V.draft; if (!d || draftErrors(d).length) return;
    const plan = { kind: d.kind, objective: d.objective, start: d.start, tz: d.tz, sessions: d.sessions.map(s => ({ i: s.i, role: s.role, act: s.act, minutes: s.minutes, date: s.date, time: s.time })), why: (V.obj && V.obj.evidence || []).slice(0, 6) };
    const r = await mutate("approve", { plan });
    if (!r) return;
    ev("accepted", { kind: d.kind, skill: d.objective.skill, n: String(d.sessions.length), result: r.j.duplicate ? "duplicate" : "new" });
    await notifSync(true);
    if (V.cal && active()) icsDownload(active());
    Object.assign(V, fresh()); toast(w("ok_approved")); draw();
  }

  /* ------------------------------------------------- launching a session */
  function launch(i) {
    const p = active(); if (!p) return;
    const s = p.sessions[i]; if (!s) return;
    try { sessionStorage.setItem("be_coach_live", JSON.stringify({ pid: p.id, i, area: area(), at: Date.now() })); } catch (e) {}
    call("mark", { rid: rid(), i, state: "started" });
    ev("session_opened", { kind: p.kind, skill: p.objective.skill, n: String(i + 1) });
    close();
    /* the game hubs and some drills finish without a practice tick: watch the
       saved records (locally, cheaply) for up to 20 minutes after a launch */
    clearInterval(_watch); const t0 = Date.now();
    _watch = setInterval(() => { if (Date.now() - t0 > 20 * 60000 || !active() || active().sessions[i].done) return clearInterval(_watch); scCheck(true); }, 5000);
    const a = s.act;
    if (a.type === "words") { go("practice"); setTimeout(() => { try { pracStudyDue(); } catch (e) {} }, 300); }
    else if (a.type === "quiz") { go("practice"); setTimeout(() => { try { qzStart(); } catch (e) {} }, 300); }
    else if (a.type === "grammar") { go("practice"); setTimeout(() => { try { gxStart(a.cat); } catch (e) {} }, 300); }
    else if (a.type === "shadow") {
      if (area() === "welding") { try { go(weldStudioOn() ? "lines" : "shadow"); } catch (e) { go("shadow"); } }
      else { go("shadow"); setTimeout(() => { try { shTab("trouble"); nudgeTroubleShow(); } catch (e) {} }, 300); }
    } else if (a.type === "game") {
      const UI = gameUI(); if (!UI) return toast(w("n_unavail"));
      go(area() === "welding" ? "mastery" : "english", "games");
      UI._load().then(() => setTimeout(() => { try { UI._start(a.mode, a.cat ? { cat: a.cat } : {}); } catch (e) {} }, 150)).catch(() => {});
    }
  }

  /* ------------------------------------------- verifying what was done */
  let _chk = null, _chkBusy = false, _retry = 0, _watch = null;
  function scCheck(now) { clearTimeout(_chk); _chk = setTimeout(verify, now ? 50 : 1500); }
  async function verify() {
    if (!on() || _chkBusy || !signedIn()) return;
    const p = active(); if (!p || p.status !== "active") return;
    const pr = E.progress(p, Date.now()); if (pr.status === "overdue") return;
    const s = pr.next; if (!s || !["today", "due", "missed"].includes(pr.states[s.i])) return;
    const used = p.sessions.filter(x => x.done && x.ref).map(x => x.act.type + ":" + x.ref);
    const rec = E.evidenceFor(p, s, records(), used); if (!rec) return;
    _chkBusy = true;
    const b = box(); b.pend = Object.assign({}, b.pend, { [p.id + ":" + s.i]: "device" });
    const r = await call("complete", { rid: "c-" + p.id.slice(-12) + "-" + s.i + "-" + String(rec.ref).replace(/[^a-z0-9-]/gi, "").slice(-14).toLowerCase(), i: s.i, ev: rec });
    _chkBusy = false;
    if (r.status === 200) {
      delete b.pend[p.id + ":" + s.i]; save(); _retry = 0;
      let live = null; try { live = JSON.parse(sessionStorage.getItem("be_coach_live") || "null"); } catch (e) {}
      try { sessionStorage.removeItem("be_coach_live"); } catch (e) {}
      ev("session_completed", { kind: p.kind, skill: p.objective.skill, n: String(s.i + 1), source: s.act.type === "game" ? "server" : "device" });
      if (r.j.completed) { const o = r.j.outcome || {}; ev("completed", { kind: p.kind, skill: p.objective.skill, result: o.competent == null ? "na" : o.competent ? "pass" : "below", state: o.delta == null ? "na" : o.delta > 0 ? "up" : o.delta < 0 ? "down" : "same" }); toast(w("prog_done")); await analyse(true); }
      else toast(w("sess_ok"));
      await notifSync(false);
      if ((live && live.pid === p.id) || r.j.completed) setTimeout(() => open("home"), 900); else if (sheetOpen()) draw();
      scCheck(false);
      return;
    }
    if (r.status === 409 && r.j.error === "not_confirmed" && _retry < 4) { b.pend[p.id + ":" + s.i] = "confirm"; save(); _retry++; setTimeout(() => scCheck(true), 3000 * _retry); }
    else if (r.status !== 0) { delete b.pend[p.id + ":" + s.i]; save(); }
    if (sheetOpen()) draw();
  }

  /* -------------------------------------------- the Daily reminder card */
  function cardHTML() {
    if (!on()) return "";
    const p = active();
    let line = w("card_idle"), sub = "";
    if (p) {
      const pr = E.progress(p, Date.now());
      line = w("card_active", { done: pr.done, total: pr.total, kind: w("k_" + p.kind) });
      sub = `${h(skillLbl(p.objective))}${pr.next ? " · " + h(w("card_next", { when: whenLbl(pr.next) })) : ""}`;
      return `<button type="button" class="sc-entry" onclick="SmartCoach.open()">${ring(pr.pct, 44)}<span><b>${h(w("title"))}</b><small>${h(line)}</small><small>${sub}</small></span>${ic("chevron")}</button>`;
    }
    return `<button type="button" class="sc-entry" onclick="SmartCoach.open()"><span class="sc-entry-ic">${ic("sparkle")}</span><span><b>${h(w("title"))}${premiumShown() ? "" : ` <i class="sc-tag">${h(w("prem"))}</i>`}</b><small>${h(line)}</small></span>${ic("chevron")}</button>`;
  }
  /* a notification tap: "<programme id>:<session>" */
  function arrive(tag) {
    if (!on()) return false;
    ev("session_opened", { source: "notification" });
    open("home");
    return true;
  }
  async function boot() {
    if (!on() || !signedIn()) return;
    const r = await call("status");
    if (r.status === 200) { await notifSync(false); inAppRemind(); scCheck(false); }
  }

  /* coming back to the app (a game round confirmed meanwhile, a take filed) is a moment to check */
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { scCheck(false); inAppRemind(); } });
  window.SmartCoach = { on, open, close, cardHTML, arrive, check: scCheck, boot, notifSync, _V: V, _signals: signals, _records: records, _w: w, _ics: ics };
})();
