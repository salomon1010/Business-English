/* ============================================================================
   BE Mastery — Welding Mastery (the game hub of the Welding programme)
   --------------------------------------------------------------------------
   Screens for the hub (view "mastery"): Home / Games / Journey / Collection /
   Rewards / Performance, eight games, the Vocabulary-page portal card and the
   Game Performance card on Progress. The rules live in welding-mastery-engine.js.

   WELDING ONLY. on() is the one gate: flag welding_mastery_enabled AND the
   open area is Welding. Every entry point checks it, and every write goes to
   S.wm.welding and nowhere else, so a General English learner never renders,
   loads or stores any of it. There is no Worker behind this feature: the
   corpus is a static curriculum file (like every tracks/<id>/*.json), and the
   learner's record rides in their own S, synced to their own Firestore
   document by the existing sign-in sync (fbMerge → WMEngine.merge).

   Wording: a small en/fr dictionary of its own (TX), like flyer.html's FL —
   French when the app language is French, English otherwise. The learning
   content is bilingual in the corpus itself.

   No track() events: the be-events allow-list has none for this feature, and
   a call the Worker silently drops would be a lie.
   ============================================================================ */
(function () {
  "use strict";
  const E = window.WMEngine;
  const AREA = "welding", TOTAL = 250;
  const CORPUS_URL = "tracks/welding/mastery.json?v=1", ART_URL = "tracks/welding/mastery-art.json?v=1", PHOTO_URL = "tracks/welding/photos/credits.json?v=1", PHOTO_DIR = "tracks/welding/photos/";
  let C = null, ART = null, PHOTOS = {}, _load = null, _err = false;
  let _tab = "home", _coll = { q: "", cat: "all", seg: "all" }, _edit = null, _G = null;

  /* ------------------------------------------------------------ the gate */
  function on() { try { return flag("welding_mastery_enabled") && areaId() === AREA; } catch (e) { return false; } }
  function st() {
    if (!on()) return null;
    S.wm = S.wm && typeof S.wm === "object" ? S.wm : {};
    return (S.wm[AREA] = E.normalize(S.wm[AREA]));
  }
  function persist() { try { E.pruneEvents(st(), Date.now()); } catch (e) {} try { save(); } catch (e) {} }

  /* ------------------------------------------------------------ wording */
  const TX = {
    en: {
      title: "Welding Mastery", sub: "Master the language of your trade.", motto: "Learn. Play. Practise. Master.",
      enter: "Enter Welding Mastery", quick_h: "Quick Practice", quick_sub: "Short rounds on the words you have saved.",
      back: "‹ Vocabulary", loading: "Loading the workshop…", load_fail: "The vocabulary could not be loaded. Check your connection and try again.", retry: "Try again",
      off: "Welding Mastery is part of the Welding Professional English programme.", off_btn: "Back to Practice",
      t_home: "Home", t_games: "Games", t_journey: "Journey", t_coll: "Collection", t_rewards: "Rewards", t_perf: "Performance", t_perf_s: "Stats",
      mastered_of: "{{n}} of {{total}} words mastered", level: "Level {{n}}", xp: "{{n}} XP", streak_d: "{{n}}-day streak", streak_0: "No streak yet",
      rest_used: "A rest day kept your streak going.", xp_next: "{{n}} XP to level {{l}}",
      shift_h: "Today's Shift", shift_done: "Shift complete — well done.", shift_new: "A new shift is waiting for you.", start: "Start", go_on: "Continue",
      m_start5: "Learn five new words", m_start5_d: "Five cards, about three minutes.",
      m_hard5: "Review five difficult words", m_hard5_d: "The words that tripped you up before.",
      m_due5: "Review five words that are due", m_due5_d: "Spaced repetition: they come back right on time.",
      m_tools5: "Identify five tools correctly", m_tools5_d: "Look at the drawing, name the tool.",
      m_listen1: "Complete one listening challenge", m_listen1_d: "Hear the word, find it.",
      m_recall3: "Spell three words without a hint", m_recall3_d: "Word Builder, from the French.",
      m_workshop1: "Complete one workshop challenge", m_workshop1_d: "Real situations on the shop floor.",
      cont_h: "Continue learning", cont_resume: "Resume your {{game}} round — {{i}} of {{n}}", cont_rec: "Recommended: {{game}}",
      recent_h: "Recently practised", recent_0: "Words you practise will appear here.", journey_link: "See your journey",
      first_h: "Welcome to the workshop", first_b: "250 professional words, eight games, one goal: speak about your work with confidence. Start with five words.",
      g_cards: "Cards", g_cards_d: "Flip and remember the words", g_quiz: "Quiz", g_quiz_d: "Test your knowledge",
      g_crossword: "Crossword", g_crossword_d: "Fill the grid with trade words", g_visual: "Visual recognition", g_visual_d: "Name the tools and equipment",
      g_listen: "Listening", g_listen_d: "Recognise words in English", g_builder: "Word Builder", g_builder_d: "Build the correct word",
      g_match: "Match", g_match_d: "Link words, pictures and meanings", g_workshop: "Workshop challenge", g_workshop_d: "Use the words in real situations",
      best: "Best {{n}}%", runs: "{{n}} rounds", play: "Play",
      skill_recognition: "Recognition", skill_recall: "Recall", skill_listening: "Listening", skill_context: "Context", skill_spelling: "Spelling", skill_visual: "Visual recognition",
      j_h: "Your journey", j_sub: "Ten stages through the language of the trade. Nothing is locked: start where your work starts.",
      j_words: "{{n}} words", j_mastered: "{{m}} mastered", j_done: "Complete", j_prog: "In progress", j_new: "Not started", j_learn: "Learn", j_test: "Stage challenge", j_test_lock: "Stage challenge — after 10 words practised",
      c_search: "Search a word in English or French", c_all: "All", c_fav: "Favourites", c_hard: "Difficult", c_mastered: "Mastered", c_mine: "My words",
      c_cat_all: "All categories", c_practise: "Practise these ({{n}})", c_empty: "Nothing here yet.", c_empty_fav: "Tap the star on any word to keep it here.", c_empty_hard: "Words you find difficult, or miss twice, gather here.", c_empty_m: "A word is mastered after correct answers on three different days, one of them from memory.",
      dir: "Show first", dir_en: "English", dir_fr: "French",
      my_h: "Add a word of your own", my_en: "English word or phrase", my_fr: "French (optional)", my_def: "What it means (optional)", my_ex: "Example sentence (optional)", my_add: "Add word", my_save: "Save changes", my_cancel: "Cancel", my_edit: "Edit", my_del: "Delete",
      my_del_q: "Delete “{{w}}”?", my_e_empty: "Write the English word first.", my_e_duplicate: "That word is already in your list.", my_e_official: "That word is already one of the 250 — find it in All and tap the star.", my_e_full: "Your list is full (200 words).",
      my_added: "Added to your words.", my_saved: "Saved.", my_deleted: "Deleted.", my_list: "Your words", my_0: "No words of your own yet.",
      saved_h: "Saved words (Quick Practice list)", saved_sub: "The words you save anywhere in the app. Cards, Quiz and Crossword on the Vocabulary page practise these.",
      r_level_h: "Your level", r_thresh: "Levels open at 100, 300, 600, 1,000 XP… XP rewards practice; mastery is earned separately, word by word.",
      r_ach_h: "Achievements", r_earned: "Earned {{d}}", r_locked: "Not yet",
      ach_first_practice: "First practice", ach_first_practice_d: "Answer your first question.",
      ach_first_mastered: "First word mastered", ach_first_mastered_d: "Master one word.",
      ach_mastered_10: "10 words mastered", ach_mastered_10_d: "Master ten words.",
      ach_safety_25: "Safety first", ach_safety_25_d: "Master all 25 safety and PPE words.",
      ach_first_listen: "Sharp ears", ach_first_listen_d: "Complete a listening challenge.",
      ach_first_workshop: "On the shop floor", ach_first_workshop_d: "Complete a workshop challenge.",
      ach_first_stage: "First stage complete", ach_first_stage_d: "Master every word of one stage.",
      ach_mastered_50: "50 words mastered", ach_mastered_50_d: "Master fifty words.",
      ach_mastered_100: "100 words mastered", ach_mastered_100_d: "Master a hundred words.",
      ach_mastered_250: "Master of the trade", ach_mastered_250_d: "Master all 250 words.",
      p_h: "Game Performance", p_sub: "Welding Mastery — what your games show, measured from your own answers.",
      p_mastered: "Words mastered", p_xp: "XP earned", p_days: "Active days (7 days)", p_acc: "Accuracy (30 days)", p_acc_na: "after 10 answers",
      p_xp14: "XP over the last 14 days", p_skills: "Skills", p_skill_na: "Not enough answers yet ({{n}} of 10)", p_modes: "By game", p_cats: "By stage",
      p_improved: "Recent improvements", p_impr_skill: "{{skill}}: {{from}}% → {{to}}%", p_new_m: "Mastered this week: {{w}}", p_none: "Nothing to compare yet — keep playing for a week.",
      p_hard: "Words to review", p_rec: "Next step", p_empty: "No games played yet. Start with Cards: five words, about three minutes.", p_open: "Open Welding Mastery", p_go_progress: "See it on the Progress page",
      rec_first: "Start with Cards: five words, about three minutes.", rec_gap: "Your {{strong}} is strong, but {{weak}} needs more practice.", rec_due: "{{n}} words are due for review.", rec_difficult: "{{n}} words need another look.", rec_try: "You have not tried {{skill}} yet.", rec_keep: "Keep your words fresh with a quick quiz.",
      set_h: "Settings", set_sound: "Sound effects", set_motion: "Reduce motion", set_dir: "Show first in games", set_close: "Close", on: "On", off_: "Off",
      close: "Close", next: "Next", check: "Check", reveal: "Show answer", hear: "Hear it", hear_ex: "Hear it in a sentence", slow: "Slowly", replay: "Replay",
      again: "Again", hard: "Hard", good: "Good", easy: "Easy", rate_q: "How well did you know it?",
      fav: "Favourite", unfav: "Remove from favourites", mark_hard: "Mark as difficult", unmark_hard: "Not difficult", save_list: "Save to my list", saved_list: "Saved",
      f_def: "Definition", f_use: "What it is for", f_ctx: "On the job", f_ex: "Example", f_syn: "Also called", f_drawing: "Line drawing — an illustration, not a photograph.", f_verify: "French term awaiting review by a welding trainer.",
      ok: "Correct", no: "Not quite", the_answer: "The answer: {{w}}", combo: "{{n}} in a row",
      q_en2fr: "What is the French for this word?", q_fr2en: "What is the English for this word?", q_def: "Which word matches this definition?", q_use: "Which item or word is this about?", q_ctx: "Which word fits this situation?", q_img: "What is this?",
      tr_show: "Voir en français", tr_hide: "Hide French",
      v_alt: "A picture of an item used in welding. Which is it?", v_alt_after: "Picture of: {{w}}", ph_by: "Photo:",
      l_prompt: "Listen and find the word.", l_type: "Listen and type the word.", l_synth: "Synthetic voice (text-to-speech).", l_hint: "Hint", l_hint_txt: "French: {{fr}} · starts with “{{c}}”", l_no_audio: "Audio is not available on this device, so this round cannot run. Try Cards or Word Builder instead.", l_type_ph: "Type what you heard",
      b_prompt: "Build the English word.", b_hint: "Show a letter", b_clear: "Clear", b_type_ph: "Or type it", b_try: "Not yet — try again.",
      m_prompt: "Tap a word, then its partner.", m_en_fr: "English ↔ French", m_img: "Picture ↔ name", m_def: "Word ↔ definition", m_use: "Tool ↔ purpose", m_ctx: "Word ↔ situation", m_wrong: "Not a pair.",
      w_reply: "Now answer like a professional.", w_link: "Practise full conversations in Professional Workplace Scenarios", w_tr: "Traduction",
      cw_fail: "These words would not make a valid grid. Try again for a new set.", cw_solved: "Grid solved.", cw_progress: "{{s}} of {{n}} words correct.", cw_reveal: "Reveal", cw_finish: "Finish", cw_across: "Across", cw_down: "Down",
      end_h: "Round complete", end_score: "{{ok}} of {{n}} correct", end_xp: "+{{n}} XP", end_xp0: "No new XP — these answers were already counted today.", end_mastered: "Mastered: {{w}}", end_again: "Play again", end_hub: "Back to the hub", end_shift: "Today's Shift complete +{{n}} XP",
      cel_mastered: "Word mastered", cel_stage: "Stage complete", cel_final: "All 250 words mastered", cel_ach: "Achievement unlocked",
      none_words: "No words available for this game yet.", del_conf: "Delete", cancel: "Cancel",
      t_hist: "History", h_sub: "Every round you have played, with every answer. Nothing is lost: it is saved with your progress, and on your account when you are signed in.",
      h_rounds: "Rounds", h_errors: "Errors", h_0: "Your rounds will appear here after your first game.", h_err0: "No errors yet — or no rounds yet.",
      h_day: "{{n}} rounds · {{ok}} of {{a}} correct · +{{xp}} XP", h_day1: "1 round · {{ok}} of {{a}} correct · +{{xp}} XP", h_round: "{{ok}}/{{n}} correct · +{{xp}} XP", h_part: "left part-way", h_sum: "Older round — the summary is kept, the single answers are not.",
      h_chose: "You chose: {{p}}", h_typed: "You wrote: {{p}}", h_rated: "You rated it: {{p}}", h_ans: "Answer: {{a}}", h_hint: "hint used", h_reply: "Your professional reply", h_revealed: "revealed",
      h_err_stage: "{{n}} words · {{o}} still to fix", h_times: "wrong {{n}}×", h_last: "last {{d}}", h_instead: "you chose instead: {{p}}",
      h_open: "To fix", h_fixed: "Right since", h_mastered: "Mastered since", h_practise_err: "Practise these errors ({{n}})",
      h_stage: "Your history in this stage", h_stage_n: "{{a}} answers · {{ok}} correct", h_stage_0: "Nothing played in this stage yet.", h_link: "See your full history",
      r_kicker: "Welding Mastery", r_shift_t: "Today's Shift: {{m}}", r_shift_b: "{{p}} of {{n}} done · about five minutes in the game hub.", r_due_t: "{{n}} words are due in Welding Mastery", r_due_b: "A short Cards round brings them back right on time.", r_cta: "Play now",
      row_h: "Welding Mastery — your games", row_s_first: "Start with five words, about three minutes.", row_s_gap: "Your {{strong}} is strong; {{weak}} needs practice.", row_s_due: "{{n}} words are due for review.", row_s_difficult: "Some words need another look.", row_s_try: "A game you have not tried yet is waiting.", row_s_keep: "Keep your trade words fresh.",
      it_shift: "Today's Shift", it_game: "Game", explore_s: "250 trade words, eight games", explore_shift: "Today's Shift: {{p}}/{{n}}", explore_done: "Shift done · {{m}}/250 mastered",
      w_title: "Welding Mastery", w_mastered: "words mastered", w_level: "Level {{n}}", w_xp: "XP", w_streak: "day streak", w_shift: "Today's Shift", w_done: "Shift complete", w_open: "Play", w_empty: "Open Welding Mastery in BE Mastery to start.",
      k_en2fr: "English → French", k_fr2en: "French → English", k_def: "Definition", k_use: "Purpose", k_ctx: "Situation", k_img: "Picture", k_card: "Card", k_listen: "Listening", k_listen_t: "Listening (typed)", k_spell: "Spelling", k_cw: "Crossword", k_ws: "Workshop", k_reply: "Reply", k_match: "Match"
    },
    fr: {
      title: "Welding Mastery", sub: "Maîtrise la langue de ton métier.", motto: "Apprends. Joue. Pratique. Maîtrise.",
      enter: "Entrer dans Welding Mastery", quick_h: "Pratique rapide", quick_sub: "Des séries courtes sur les mots que tu as enregistrés.",
      back: "‹ Vocabulaire", loading: "Ouverture de l'atelier…", load_fail: "Le vocabulaire n'a pas pu être chargé. Vérifie ta connexion et réessaie.", retry: "Réessayer",
      off: "Welding Mastery fait partie du programme Welding Professional English.", off_btn: "Retour à la pratique",
      t_home: "Accueil", t_games: "Jeux", t_journey: "Parcours", t_coll: "Collection", t_rewards: "Récompenses", t_perf: "Performance", t_perf_s: "Stats",
      mastered_of: "{{n}} mots maîtrisés sur {{total}}", level: "Niveau {{n}}", xp: "{{n}} XP", streak_d: "Série de {{n}} jours", streak_0: "Pas encore de série",
      rest_used: "Un jour de repos a gardé ta série.", xp_next: "{{n}} XP avant le niveau {{l}}",
      shift_h: "Le poste du jour", shift_done: "Poste terminé — bravo.", shift_new: "Un nouveau poste t'attend.", start: "Commencer", go_on: "Continuer",
      m_start5: "Apprendre cinq nouveaux mots", m_start5_d: "Cinq cartes, environ trois minutes.",
      m_hard5: "Revoir cinq mots difficiles", m_hard5_d: "Les mots qui t'ont posé problème.",
      m_due5: "Revoir cinq mots à réviser", m_due5_d: "Répétition espacée : ils reviennent au bon moment.",
      m_tools5: "Identifier cinq outils", m_tools5_d: "Regarde le dessin, nomme l'outil.",
      m_listen1: "Réussir un défi d'écoute", m_listen1_d: "Écoute le mot, retrouve-le.",
      m_recall3: "Écrire trois mots sans indice", m_recall3_d: "Écris le mot, à partir du français.",
      m_workshop1: "Réussir un défi atelier", m_workshop1_d: "Des situations réelles d'atelier.",
      cont_h: "Continuer", cont_resume: "Reprendre ta série {{game}} — {{i}} sur {{n}}", cont_rec: "Recommandé : {{game}}",
      recent_h: "Pratiqués récemment", recent_0: "Les mots que tu pratiques apparaîtront ici.", journey_link: "Voir ton parcours",
      first_h: "Bienvenue à l'atelier", first_b: "250 mots professionnels, huit jeux, un objectif : parler de ton travail avec assurance. Commence par cinq mots.",
      g_cards: "Cartes", g_cards_d: "Retourne et retiens les mots", g_quiz: "Quiz", g_quiz_d: "Teste tes connaissances",
      g_crossword: "Mots croisés", g_crossword_d: "Remplis la grille de vocabulaire", g_visual: "Reconnaissance visuelle", g_visual_d: "Identifie les outils et équipements",
      g_listen: "Écoute", g_listen_d: "Reconnais les mots en anglais", g_builder: "Écris le mot", g_builder_d: "Construis le mot correct",
      g_match: "Association", g_match_d: "Relie les mots, images et définitions", g_workshop: "Défi atelier", g_workshop_d: "Mets les mots en situation réelle",
      best: "Meilleur {{n}} %", runs: "{{n}} séries", play: "Jouer",
      skill_recognition: "Reconnaissance", skill_recall: "Mémoire", skill_listening: "Écoute", skill_context: "Contexte", skill_spelling: "Orthographe", skill_visual: "Reconnaissance visuelle",
      j_h: "Ton parcours", j_sub: "Dix étapes dans la langue du métier. Rien n'est verrouillé : commence là où ton travail commence.",
      j_words: "{{n}} mots", j_mastered: "{{m}} maîtrisés", j_done: "Terminé", j_prog: "En cours", j_new: "Pas commencé", j_learn: "Apprendre", j_test: "Défi d'étape", j_test_lock: "Défi d'étape — après 10 mots pratiqués",
      c_search: "Cherche un mot en anglais ou en français", c_all: "Tous", c_fav: "Favoris", c_hard: "Difficiles", c_mastered: "Maîtrisés", c_mine: "Mes mots",
      c_cat_all: "Toutes les catégories", c_practise: "Pratiquer ces mots ({{n}})", c_empty: "Rien ici pour l'instant.", c_empty_fav: "Touche l'étoile d'un mot pour le garder ici.", c_empty_hard: "Les mots difficiles, ou ratés deux fois, se retrouvent ici.", c_empty_m: "Un mot est maîtrisé après des bonnes réponses trois jours différents, dont une de mémoire.",
      dir: "Afficher d'abord", dir_en: "Anglais", dir_fr: "Français",
      my_h: "Ajouter un mot à toi", my_en: "Mot ou expression en anglais", my_fr: "Français (facultatif)", my_def: "Ce que ça veut dire (facultatif)", my_ex: "Phrase d'exemple (facultatif)", my_add: "Ajouter", my_save: "Enregistrer", my_cancel: "Annuler", my_edit: "Modifier", my_del: "Supprimer",
      my_del_q: "Supprimer « {{w}} » ?", my_e_empty: "Écris d'abord le mot anglais.", my_e_duplicate: "Ce mot est déjà dans ta liste.", my_e_official: "Ce mot fait déjà partie des 250 — cherche-le dans Tous et touche l'étoile.", my_e_full: "Ta liste est pleine (200 mots).",
      my_added: "Ajouté à tes mots.", my_saved: "Enregistré.", my_deleted: "Supprimé.", my_list: "Tes mots", my_0: "Pas encore de mots à toi.",
      saved_h: "Mots enregistrés (liste de pratique rapide)", saved_sub: "Les mots que tu enregistres partout dans l'appli. Cartes, Quiz et Mots croisés de la page Vocabulaire les pratiquent.",
      r_level_h: "Ton niveau", r_thresh: "Les niveaux s'ouvrent à 100, 300, 600, 1 000 XP… L'XP récompense la pratique ; la maîtrise se gagne à part, mot par mot.",
      r_ach_h: "Badges", r_earned: "Obtenu le {{d}}", r_locked: "Pas encore",
      ach_first_practice: "Première pratique", ach_first_practice_d: "Réponds à ta première question.",
      ach_first_mastered: "Premier mot maîtrisé", ach_first_mastered_d: "Maîtrise un mot.",
      ach_mastered_10: "10 mots maîtrisés", ach_mastered_10_d: "Maîtrise dix mots.",
      ach_safety_25: "La sécurité d'abord", ach_safety_25_d: "Maîtrise les 25 mots sécurité et EPI.",
      ach_first_listen: "Oreille fine", ach_first_listen_d: "Réussis un défi d'écoute.",
      ach_first_workshop: "Sur le terrain", ach_first_workshop_d: "Réussis un défi atelier.",
      ach_first_stage: "Première étape terminée", ach_first_stage_d: "Maîtrise tous les mots d'une étape.",
      ach_mastered_50: "50 mots maîtrisés", ach_mastered_50_d: "Maîtrise cinquante mots.",
      ach_mastered_100: "100 mots maîtrisés", ach_mastered_100_d: "Maîtrise cent mots.",
      ach_mastered_250: "Maître du métier", ach_mastered_250_d: "Maîtrise les 250 mots.",
      p_h: "Performance des jeux", p_sub: "Welding Mastery — ce que montrent tes jeux, mesuré sur tes propres réponses.",
      p_mastered: "Mots maîtrisés", p_xp: "XP gagnés", p_days: "Jours actifs (7 jours)", p_acc: "Réussite (30 jours)", p_acc_na: "après 10 réponses",
      p_xp14: "XP des 14 derniers jours", p_skills: "Compétences", p_skill_na: "Pas encore assez de réponses ({{n}} sur 10)", p_modes: "Par jeu", p_cats: "Par étape",
      p_improved: "Progrès récents", p_impr_skill: "{{skill}} : {{from}} % → {{to}} %", p_new_m: "Maîtrisés cette semaine : {{w}}", p_none: "Rien à comparer pour l'instant — continue de jouer une semaine.",
      p_hard: "Mots à revoir", p_rec: "Prochaine étape", p_empty: "Aucun jeu pour l'instant. Commence par les Cartes : cinq mots, environ trois minutes.", p_open: "Ouvrir Welding Mastery", p_go_progress: "Voir sur la page Progrès",
      rec_first: "Commence par les Cartes : cinq mots, environ trois minutes.", rec_gap: "Ta {{strong}} est solide, mais ton {{weak}} demande plus de pratique.", rec_due: "{{n}} mots sont à réviser.", rec_difficult: "{{n}} mots méritent un autre regard.", rec_try: "Tu n'as pas encore essayé : {{skill}}.", rec_keep: "Garde tes mots frais avec un petit quiz.",
      set_h: "Paramètres", set_sound: "Effets sonores", set_motion: "Réduire les animations", set_dir: "Afficher d'abord dans les jeux", set_close: "Fermer", on: "Oui", off_: "Non",
      close: "Fermer", next: "Suivant", check: "Vérifier", reveal: "Voir la réponse", hear: "Écouter", hear_ex: "Écouter dans une phrase", slow: "Lentement", replay: "Réécouter",
      again: "À revoir", hard: "Difficile", good: "Bien", easy: "Facile", rate_q: "Tu le connaissais comment ?",
      fav: "Favori", unfav: "Retirer des favoris", mark_hard: "Marquer comme difficile", unmark_hard: "Pas difficile", save_list: "Enregistrer dans ma liste", saved_list: "Enregistré",
      f_def: "Définition", f_use: "À quoi ça sert", f_ctx: "Sur le terrain", f_ex: "Exemple", f_syn: "Aussi appelé", f_drawing: "Dessin au trait — une illustration, pas une photo.", f_verify: "Terme français en attente de relecture par un formateur soudeur.",
      ok: "Bonne réponse", no: "Pas tout à fait", the_answer: "La réponse : {{w}}", combo: "{{n}} d'affilée",
      q_en2fr: "Comment dit-on ce mot en français ?", q_fr2en: "Comment dit-on ce mot en anglais ?", q_def: "Quel mot correspond à cette définition ?", q_use: "De quoi parle-t-on ?", q_ctx: "Quel mot convient à cette situation ?", q_img: "Qu'est-ce que c'est ?",
      tr_show: "Voir en français", tr_hide: "Masquer le français",
      v_alt: "Image d'un élément utilisé en soudage. Lequel ?", v_alt_after: "Image : {{w}}", ph_by: "Photo :",
      l_prompt: "Écoute et trouve le mot.", l_type: "Écoute et écris le mot.", l_synth: "Voix de synthèse.", l_hint: "Indice", l_hint_txt: "Français : {{fr}} · commence par « {{c}} »", l_no_audio: "L'audio n'est pas disponible sur cet appareil, cette série ne peut pas tourner. Essaie les Cartes ou Écris le mot.", l_type_ph: "Écris ce que tu entends",
      b_prompt: "Construis le mot anglais.", b_hint: "Montrer une lettre", b_clear: "Effacer", b_type_ph: "Ou tape-le", b_try: "Pas encore — réessaie.",
      m_prompt: "Touche un mot, puis son partenaire.", m_en_fr: "Anglais ↔ français", m_img: "Image ↔ nom", m_def: "Mot ↔ définition", m_use: "Outil ↔ usage", m_ctx: "Mot ↔ situation", m_wrong: "Ce n'est pas une paire.",
      w_reply: "Maintenant, réponds en professionnel.", w_link: "Pratique des conversations complètes dans Professional Workplace Scenarios", w_tr: "Traduction",
      cw_fail: "Ces mots ne forment pas une grille valide. Réessaie pour une nouvelle série.", cw_solved: "Grille résolue.", cw_progress: "{{s}} mots justes sur {{n}}.", cw_reveal: "Révéler", cw_finish: "Terminer", cw_across: "Horizontal", cw_down: "Vertical",
      end_h: "Série terminée", end_score: "{{ok}} sur {{n}} justes", end_xp: "+{{n}} XP", end_xp0: "Pas de nouveaux XP — ces réponses ont déjà compté aujourd'hui.", end_mastered: "Maîtrisés : {{w}}", end_again: "Rejouer", end_hub: "Retour au hub", end_shift: "Poste du jour terminé +{{n}} XP",
      cel_mastered: "Mot maîtrisé", cel_stage: "Étape terminée", cel_final: "Les 250 mots maîtrisés", cel_ach: "Badge débloqué",
      none_words: "Pas encore de mots pour ce jeu.", del_conf: "Supprimer", cancel: "Annuler",
      t_hist: "Historique", h_sub: "Chaque série jouée, avec chaque réponse. Rien ne se perd : c'est enregistré avec ta progression, et sur ton compte quand tu es connecté.",
      h_rounds: "Séries", h_errors: "Erreurs", h_0: "Tes séries apparaîtront ici après ton premier jeu.", h_err0: "Pas encore d'erreurs — ou pas encore de séries.",
      h_day: "{{n}} séries · {{ok}} justes sur {{a}} · +{{xp}} XP", h_day1: "1 série · {{ok}} justes sur {{a}} · +{{xp}} XP", h_round: "{{ok}}/{{n}} justes · +{{xp}} XP", h_part: "arrêtée en cours", h_sum: "Série ancienne — le résumé est gardé, pas le détail des réponses.",
      h_chose: "Tu as choisi : {{p}}", h_typed: "Tu as écrit : {{p}}", h_rated: "Ta note : {{p}}", h_ans: "Réponse : {{a}}", h_hint: "indice utilisé", h_reply: "Ta réponse professionnelle", h_revealed: "révélé",
      h_err_stage: "{{n}} mots · {{o}} à corriger", h_times: "faux {{n}}×", h_last: "dernière fois {{d}}", h_instead: "tu as choisi : {{p}}",
      h_open: "À corriger", h_fixed: "Juste depuis", h_mastered: "Maîtrisé depuis", h_practise_err: "Pratiquer ces erreurs ({{n}})",
      h_stage: "Ton historique dans cette étape", h_stage_n: "{{a}} réponses · {{ok}} justes", h_stage_0: "Rien joué dans cette étape pour l'instant.", h_link: "Voir tout ton historique",
      r_kicker: "Welding Mastery", r_shift_t: "Poste du jour : {{m}}", r_shift_b: "{{p}} sur {{n}} faits · environ cinq minutes dans le hub de jeu.", r_due_t: "{{n}} mots à réviser dans Welding Mastery", r_due_b: "Une petite série de Cartes les fait revenir au bon moment.", r_cta: "Jouer",
      row_h: "Welding Mastery — tes jeux", row_s_first: "Commence par cinq mots, environ trois minutes.", row_s_gap: "Ta {{strong}} est solide ; ton {{weak}} demande de la pratique.", row_s_due: "{{n}} mots sont à réviser.", row_s_difficult: "Certains mots méritent un autre regard.", row_s_try: "Un jeu que tu n'as pas encore essayé t'attend.", row_s_keep: "Garde tes mots du métier frais.",
      it_shift: "Poste du jour", it_game: "Jeu", explore_s: "250 mots du métier, huit jeux", explore_shift: "Poste du jour : {{p}}/{{n}}", explore_done: "Poste fait · {{m}}/250 maîtrisés",
      w_title: "Welding Mastery", w_mastered: "mots maîtrisés", w_level: "Niveau {{n}}", w_xp: "XP", w_streak: "jours de série", w_shift: "Poste du jour", w_done: "Poste terminé", w_open: "Jouer", w_empty: "Ouvre Welding Mastery dans BE Mastery pour commencer.",
      k_en2fr: "Anglais → français", k_fr2en: "Français → anglais", k_def: "Définition", k_use: "Usage", k_ctx: "Situation", k_img: "Image", k_card: "Carte", k_listen: "Écoute", k_listen_t: "Écoute (écrit)", k_spell: "Orthographe", k_cw: "Mots croisés", k_ws: "Atelier", k_reply: "Réponse", k_match: "Association"
    }
  };
  function lang() { try { return (S.profile && S.profile.lang) === "fr" ? "fr" : "en"; } catch (e) { return "en"; } }
  function w(k, v) { let s = (TX[lang()][k] != null ? TX[lang()][k] : TX.en[k]); if (s == null) s = k; if (v) s = s.replace(/\{\{(\w+)\}\}/g, (_, x) => v[x] != null ? v[x] : ""); return s; }
  function h(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function L2(o) { return o ? (o[lang()] || o.en || "") : ""; }   // a bilingual corpus field in the app language
  function fmtDate(ts) { try { return new Date(ts).toLocaleDateString(lang() === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } }

  /* ------------------------------------------------------------ icons
     24×24 line icons in the app's own style (ICON / ic). Each one stands alone;
     the account / Premium / energy set is drawn for the shared sheet but no
     screen here uses it: there is no energy limit in this feature (Free is a
     complete product), so nothing draws a counter that limits nothing. */
  const WI = {
    home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
    games: '<rect x="3" y="8" width="18" height="10" rx="5"/><path d="M8 11v4M6 13h4"/><circle cx="15.5" cy="12" r=".9"/><circle cx="17.5" cy="14" r=".9"/>',
    map: '<path d="M9 5 4 7v12l5-2 6 2 5-2V5l-5 2-6-2Z"/><path d="M9 5v12M15 7v12"/>',
    coll: '<rect x="4" y="6" width="12" height="14" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v12"/><path d="m10 10 1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L7 12.3 9 12Z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8 20h8M9.5 17h5"/>',
    chart: '<path d="M4 20h16"/><rect x="5" y="12" width="3" height="6" rx="1"/><rect x="10.5" y="8" width="3" height="10" rx="1"/><rect x="16" y="4" width="3" height="14" rx="1"/>',
    gear: '<path d="M10.3 3h3.4l.5 2.4 1.9.8 2-1.4 2.4 2.4-1.4 2 .8 1.9 2.4.5v3.4l-2.4.5-.8 1.9 1.4 2-2.4 2.4-2-1.4-1.9.8-.5 2.4h-3.4l-.5-2.4-1.9-.8-2 1.4-2.4-2.4 1.4-2-.8-1.9L3 13.7v-3.4l2.4-.5.8-1.9-1.4-2 2.4-2.4 2 1.4 1.9-.8Z"/><circle cx="12" cy="12" r="3"/>',
    cards: '<rect x="3" y="7" width="12" height="14" rx="2"/><path d="M7 3h10a2 2 0 0 1 2 2v12"/><path d="M6.5 16.5 9 10l2.5 6.5M7.4 14.4h3.2"/>',
    quiz: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m8 10 1.2 1.2L11.5 9M8 15l1.2 1.2 2.3-2.2M13.5 10H16M13.5 15H16"/>',
    crossword: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/><path d="M4 4h5.3v5.3H4zM14.7 14.7H20V20h-5.3z" fill="currentColor" fill-opacity=".35"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M10 13v4M12 11.5v7M14 13v4"/>',
    builder: '<rect x="2.5" y="6" width="5" height="5" rx="1"/><rect x="9.5" y="6" width="5" height="5" rx="1"/><rect x="16.5" y="6" width="5" height="5" rx="1"/><path d="M3 16h18"/><path d="M3 19h11" stroke-width="3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    workshop: '<path d="M5 13a7 7 0 0 1 14 0v2H5v-2Z"/><path d="M8.5 11.5h7v3h-7z" fill="currentColor" fill-opacity=".3"/><path d="M4 15h16v3H4z"/><path d="m18 4 1-2M20.5 6.5l2-1M21 10h2"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/>',
    tool: '<path d="M14.5 6.5a4 4 0 0 1 5-5l-2.6 2.6.5 2 2 .5 2.6-2.6a4 4 0 0 1-5 5L8.5 17.5a2.1 2.1 0 0 1-3-3Z"/>',
    factory: '<path d="M3 20V10l5 3V10l5 3V6h3l1-3h2l1 3h1v14H3Z"/><path d="M7 17h2M11 17h2M15 17h2"/>',
    chat: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M8 11h.01M12 11h.01M16 11h.01" stroke-width="2.6"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    sound: '<path d="M4 10v4h4l5 4V6L8 10H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    myword: '<rect x="4" y="3" width="12" height="18" rx="2"/><path d="M7 8h6M7 12h6M7 16h3"/><path d="M19 13v6M16 16h6"/>',
    xp: '<path d="m12 2.5 8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5Z"/><path d="m8.5 9.5 3 5M11.5 9.5l-3 5M14 14.5v-5h1.6a1.6 1.6 0 0 1 0 3.2H14"/>',
    medal: '<path d="M8 3h3l1 4M16 3h-3"/><circle cx="12" cy="14.5" r="6"/><path d="M10.5 13l1.5-1v5.5"/>',
    flame: '<path d="M12 21c-4 0-6.5-2.8-6.5-6.3C5.5 10.6 9 9 9.5 4c3 2 4 4.5 3.7 7 1-.6 1.9-1.8 2.2-3 2 2 3.1 4.2 3.1 6.6C18.5 18.2 16 21 12 21Z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.6 2.6L16 9.5"/>',
    cross: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    party: '<path d="M4 20 8.5 8l7.5 7.5L4 20Z"/><path d="M13 4.5c1 1.2 1 2.6 0 3.8M17 9c1.5-.8 3-.6 4 .5M15 3v1.5M19 5l1-1M20 13h1.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6Z"/><path d="m9 12 2 2 4-4"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 3.5 2 3.5H5"/>',
    crown: '<path d="m3.5 8 4.5 4 4-7 4 7 4.5-4-2 11H5.5Z"/><path d="M5.5 19h13"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10" stroke-width="2.2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    user_plus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>',
    login: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M3 12h11M10 8l4 4-4 4"/>',
    gem: '<path d="M6 4h12l3 5-9 11L3 9Z"/><path d="M3 9h18M9 4l3 16 3-16"/>',
    gift: '<rect x="3.5" y="9" width="17" height="11" rx="1"/><path d="M2.5 9h19M12 9v11M12 9S9.5 3.5 7.5 5 9 9 12 9Zm0 0s2.5-5.5 4.5-4S15 9 12 9Z"/>',
    bolt: '<path d="M13 2 5 13h6l-1 9 8-11h-6Z"/>',
    battery_empty: '<rect x="2.5" y="7" width="17" height="10" rx="2"/><path d="M22 10.5v3"/><path d="M5.5 10v4" stroke-width="2.6"/>',
    renew: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4.5h-4.5"/><path d="M12 8v4l2.5 1.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10Z"/>'
  };
  const MODE_IC = { cards: "cards", quiz: "quiz", crossword: "crossword", visual: "eye", listen: "headphones", builder: "builder", match: "link", workshop: "workshop" };
  const CAT_IC = { tools: "tool", ppe: "shield", materials: "cards", process: "spark", joints: "link", defects: "target", inspection: "eye", docs: "book", actions: "workshop", comms: "chat", mine: "myword" };
  function wi(name, cls) { return `<svg class="wm-ic ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${WI[name] || WI.spark}</svg>`; }
  /* the portal mark: a welder's helmet over an open book, a spark at the arc */
  function logo(cls) {
    return `<svg class="wm-logo ${cls || ""}" viewBox="0 0 64 64" role="img" aria-label="Welding Mastery"><defs><linearGradient id="wmLg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd36b"/><stop offset="1" stop-color="#e08a12"/></linearGradient><linearGradient id="wmLg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#0b1224" stroke="url(#wmLg1)" stroke-width="2.5"/>
      <path d="M17 31c0-9 6.8-16 15-16s15 7 15 16v4H17Z" fill="#16233f" stroke="#5b7bb5" stroke-width="1.6"/>
      <rect x="22" y="25" width="20" height="7" rx="2.5" fill="url(#wmLg2)"/>
      <path d="M13 37c6-2.2 12.5-2.2 19 1 6.5-3.2 13-3.2 19-1v13c-6-2.2-12.5-2.2-19 1-6.5-3.2-13-3.2-19-1Z" fill="#f4e6c4" stroke="url(#wmLg1)" stroke-width="1.6"/>
      <path d="M32 38v13" stroke="#c48a1c" stroke-width="1.4"/>
      <path d="M20 47l2.6-7 2.6 7M21 44.6h3.3M38.3 40.2h5l-5 6.8h5" fill="none" stroke="#1d2b4a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <g stroke="#ffd36b" stroke-width="1.6" stroke-linecap="round"><path d="M49 13v4M47 15h4M53 20l2-1M45 9.5l-1-2"/></g>
    </svg>`;
  }
  /* the picture of a term: its photograph when there is one (with the credit the licence asks
     for), else the original drawing. `credit` false inside buttons (no link inside a button). */
  function photoCredit(ph, link) {
    const txt = `${w("ph_by")} ${ph.author} · ${ph.license}`;
    return link && /^https:\/\/commons\.wikimedia\.org\//.test(ph.source || "") ? `<a href="${h(ph.source)}" target="_blank" rel="noopener">${h(txt)}</a>` : h(txt);
  }
  function artSVG(t, label, opts) {
    const o = opts || {};
    if (t && t.photo) return `<figure class="wm-photo"><img src="${h(PHOTO_DIR + t.photo.file)}" alt="${h(label)}" loading="lazy" decoding="async">${o.credit === false ? "" : `<figcaption>${photoCredit(t.photo, o.link)}</figcaption>`}</figure>`;
    if (!t || !t.img || !ART || !ART[t.img]) return "";
    return `<svg class="wm-art" viewBox="0 0 120 120" role="img" aria-label="${h(label)}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${ART[t.img]}</svg>`;
  }
  function catArt(cat) { return `<span class="wm-catart" aria-hidden="true">${wi(CAT_IC[cat] || "spark")}</span>`; }

  /* ------------------------------------------------------------ data */
  function loadCorpus() {
    if (C) return Promise.resolve(C);
    if (_load) return _load;
    _err = false;
    _load = Promise.all([fetch(CORPUS_URL).then(r => { if (!r.ok) throw new Error("corpus " + r.status); return r.json(); }), fetch(ART_URL).then(r => r.ok ? r.json() : {}).catch(() => ({})), fetch(PHOTO_URL).then(r => r.ok ? r.json() : {}).catch(() => ({}))])
      .then(([c, a, ph]) => {
        if (!c || !Array.isArray(c.terms) || !c.terms.length) throw new Error("corpus shape");
        C = c; ART = a || {}; PHOTOS = ph || {};
        /* a real photograph (Wikimedia Commons, credited) wins over the drawing; a term with a photo is a picture term */
        C.terms.forEach(t => { if (PHOTOS[t.id]) { t.photo = PHOTOS[t.id]; if (!t.img) t.img = t.id; } });
        return C;
      })
      .catch(e => { _err = true; _load = null; throw e; });
    return _load;
  }
  function official() { return C ? C.terms : []; }
  function byId(id) { if (!C) return null; const t = C.terms.find(x => x.id === id); if (t) return t; const m = st() && st().mine[id]; return m && !m.del ? E.mineAsTerm(m) : null; }
  function allTerms() { return official().concat(E.mineList(st()).map(E.mineAsTerm)); }
  function catName(id) { if (id === "mine") return w("c_mine"); const c = C && C.categories.find(x => x.id === id); return c ? (lang() === "fr" ? c.fr : c.en) : id; }
  function first() { return st().set.first === "fr" ? "fr" : "en"; }
  function name1(t) { return first() === "fr" && t.fr ? t.fr : t.en; }
  function name2(t) { return first() === "fr" ? t.en : (t.fr || ""); }
  function masteredCount(s) { return Object.entries((s || st()).t).filter(([id, r]) => /^wm-/.test(id) && E.isMastered(r)).length; }
  function reduced() { try { return st().set.motion === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function canSpeak() { try { return ("speechSynthesis" in window) || (typeof POLISH_API !== "undefined" && !!POLISH_API && navigator.onLine); } catch (e) { return false; } }
  function say(text, rate) { try { if (window.fbSay) window.fbSay(text, rate || 0.92); } catch (e) {} }
  /* hide the answer inside a clue: the term, its synonyms and, for one-word
     terms, words that share its stem ("grinding" for grind) */
  function blank(text, t) {
    let s = String(text || "");
    const forms = [t.en].concat(t.syn || []).filter(Boolean).sort((a, b) => b.length - a.length);
    for (const f of forms) s = s.replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "ig"), "_____");
    if (!/\s/.test(t.en) && t.en.length >= 4) s = s.replace(new RegExp("\\b" + t.en.slice(0, Math.max(4, t.en.length - 2)).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + "[a-z]*", "ig"), "_____");
    return s;
  }

  /* ------------------------------------------------------------ sound + celebration */
  let _ac = null;
  function tone(kind) {
    if (!st() || !st().set.sound) return;
    try {
      _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
      const seq = kind === "ok" ? [660, 880] : kind === "no" ? [220] : kind === "big" ? [523, 659, 784, 1047] : [784];
      seq.forEach((f, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain(), t0 = _ac.currentTime + i * 0.09;
        o.frequency.value = f; o.type = "sine"; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        o.connect(g); g.connect(_ac.destination); o.start(t0); o.stop(t0 + 0.18);
      });
    } catch (e) {}
  }
  /* a celebration is shown only for an event that really happened; under
     reduced motion it is the same card without the burst */
  function celebrate(kind, text, sub) {
    const host = document.getElementById("wmGame") || document.body;
    const el = document.createElement("div");
    el.className = "wm-cel wm-cel-" + kind + (reduced() ? " still" : "");
    el.setAttribute("role", "status");
    const icon = kind === "mastered" ? "medal" : kind === "stage" ? "flag" : kind === "final" ? "crown" : kind === "ach" ? "trophy" : "party";
    el.innerHTML = `${reduced() ? "" : '<i class="wm-burst" aria-hidden="true">' + "<b></b>".repeat(10) + "</i>"}<span class="wm-cel-ic">${wi(icon)}</span><span class="wm-cel-t"><b>${h(text)}</b>${sub ? `<small>${h(sub)}</small>` : ""}</span>`;
    host.appendChild(el);
    tone(kind === "mastered" || kind === "ach" ? "big" : "big");
    setTimeout(() => el.classList.add("out"), kind === "final" ? 4200 : 2600);
    setTimeout(() => el.remove(), kind === "final" ? 4800 : 3200);
  }

  /* ------------------------------------------------------------ the hub */
  function render(el, tab) {
    if (!on()) {
      el.innerHTML = `<div class="card wm-off"><p>${h(w("off"))}</p><button class="btn btn-p" data-wm="nav" data-a="practice">${h(w("off_btn"))}</button></div>`;
      return;
    }
    if (tab && ["home", "games", "journey", "coll", "rewards", "hist", "perf"].includes(tab)) _tab = tab;
    if (!C) {
      el.innerHTML = `<div class="wm-hub"><div class="wm-load" role="status">${logo("wm-logo-l")}<p>${h(_err ? w("load_fail") : w("loading"))}</p>${_err ? `<button class="btn btn-p" data-wm="retry">${h(w("retry"))}</button>` : ""}</div></div>`;
      if (!_err) loadCorpus().then(() => redraw()).catch(() => redraw());
      return;
    }
    const s = st(), now = Date.now();
    E.ensureMission(s, official(), now);
    const lv = E.level(E.xpTotal(s)), sk = E.streak(s, now), m = masteredCount(s);
    el.innerHTML = `<div class="wm-hub">
      <div class="wm-top"><button class="back" data-wm="nav" data-a="practice">${h(w("back"))}</button>
        <button class="wm-iconbtn" data-wm="settings" aria-label="${h(w("set_h"))}">${wi("gear")}</button></div>
      <header class="wm-hero">
        ${logo()}
        <div class="wm-hero-t"><h1>WELDING <span>MASTERY</span></h1><p>${h(w("sub"))}</p></div>
      </header>
      <div class="wm-stats" role="list">
        <span class="wm-stat" role="listitem">${wi("medal")}<b>${h(w("level", { n: lv.level }))}</b></span>
        <span class="wm-stat xp" role="listitem">${wi("xp")}<b>${h(w("xp", { n: lv.xp }))}</b></span>
        <span class="wm-stat fl" role="listitem">${wi("flame")}<b>${h(sk.current ? w("streak_d", { n: sk.current }) : w("streak_0"))}</b></span>
        <span class="wm-stat ok" role="listitem">${wi("check")}<b>${m}/${TOTAL}</b></span>
      </div>
      <nav class="wm-tabs" role="tablist" aria-label="Welding Mastery">
        ${[["home", "home"], ["games", "games"], ["journey", "map"], ["coll", "coll"], ["rewards", "trophy"], ["hist", "clock"], ["perf", "chart"]].map(([k, icn]) => `<button role="tab" aria-selected="${_tab === k}" class="wm-tab ${_tab === k ? "on" : ""}" data-wm="tab" data-a="${k}">${wi(icn)}${k === "perf" ? `<span class="wm-tl-s" aria-hidden="true">${h(w("t_perf_s"))}</span>` : ""}<span class="wm-tl">${h(w("t_" + k))}</span></button>`).join("")}
      </nav>
      <section class="wm-body" id="wmBody" role="tabpanel">${tabHTML(_tab)}</section>
    </div>`;
    if (_tab === "coll") collAfter();
    /* the tab bar scrolls on a phone: keep the open tab in view */
    try { const bar = el.querySelector(".wm-tabs"), on2 = bar && bar.querySelector(".wm-tab.on"); if (on2 && (on2.offsetLeft + on2.offsetWidth > bar.scrollLeft + bar.clientWidth || on2.offsetLeft < bar.scrollLeft)) bar.scrollLeft = on2.offsetLeft - 8; } catch (e) {}
  }
  function redraw() { const el = document.getElementById("v-mastery"); if (el && typeof cur !== "undefined" && cur && cur.v === "mastery") render(el); }
  function tabHTML(k) {
    try { return ({ home: homeHTML, games: gamesHTML, journey: journeyHTML, coll: collHTML, rewards: rewardsHTML, hist: histHTML, perf: () => perfInner(true) })[k](); }
    catch (e) { try { console.error("[wm]", e); } catch (_) {} return `<div class="card"><p>${h(w("load_fail"))}</p></div>`; }
  }

  function missionHTML(s) {
    const m = s.mis; if (!m) return "";
    const def = E.MISSIONS[m.kind];
    return `<div class="card wm-shift ${m.done ? "done" : ""}">
      <div class="wm-shift-h">${wi(def.ic)}<span><small>${h(w("shift_h"))}</small><b>${h(w("m_" + m.kind))}</b></span></div>
      <p>${h(m.done ? w("shift_done") : w("m_" + m.kind + "_d"))}</p>
      <div class="wm-meter" role="progressbar" aria-valuemin="0" aria-valuemax="${m.target}" aria-valuenow="${m.prog}" aria-label="${h(w("shift_h"))}"><span style="width:${Math.round(100 * m.prog / m.target)}%"></span></div>
      <div class="wm-shift-f"><span>${m.prog} / ${m.target}</span>${m.done ? `<span class="wm-chip ok">${wi("check")}+${E.XP.mission} XP</span>` : `<button class="btn btn-p btn-sm" data-wm="mission">${h(m.prog ? w("go_on") : w("start"))}</button>`}</div>
    </div>`;
  }
  function resumeValid(s) {
    const r = s.resume;
    if (!r || !r.ids || r.i >= r.ids.length || Date.now() - r.ts > 24 * 3600_000) return null;
    if (r.mode !== "workshop" && r.ids.some(id => !byId(id))) return null;
    return r;
  }
  function homeHTML() {
    const s = st(), now = Date.now(), m = masteredCount(s), lv = E.level(E.xpTotal(s)), sk = E.streak(s, now);
    const perf = E.performance(s, official(), now), rec = E.recommend(perf), res = resumeValid(s);
    const recent = Object.entries(s.t).filter(([id, r]) => r.n && byId(id)).sort((a, b) => b[1].last - a[1].last).slice(0, 6).map(([id]) => byId(id));
    const pct = Math.round(100 * m / TOTAL);
    return `
      ${perf.empty ? `<div class="card wm-first">${wi("party")}<div><b>${h(w("first_h"))}</b><p>${h(w("first_b"))}</p></div></div>` : ""}
      <div class="card wm-overview">
        <div class="wm-ring" role="img" aria-label="${h(w("mastered_of", { n: m, total: TOTAL }))}" style="--p:${pct}"><b>${m}</b><small>/ ${TOTAL}</small></div>
        <div class="wm-ov-t">
          <b>${h(w("mastered_of", { n: m, total: TOTAL }))}</b>
          <div class="wm-lv"><span>${h(w("level", { n: lv.level }))}</span><span>${h(w("xp_next", { n: lv.need, l: lv.level + 1 }))}</span></div>
          <div class="wm-meter gold" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lv.pct}" aria-label="${h(w("level", { n: lv.level }))}"><span style="width:${lv.pct}%"></span></div>
          <small>${sk.current ? `${wi("flame")} ${h(w("streak_d", { n: sk.current }))}${sk.rest ? " · " + h(w("rest_used")) : ""}` : h(w("streak_0"))}</small>
        </div>
      </div>
      ${missionHTML(s)}
      <h2 class="wm-h2">${h(w("cont_h"))}</h2>
      ${res ? `<button class="card wm-cont" data-wm="resume">${wi(MODE_IC[res.mode])}<span><b>${h(w("cont_resume", { game: w("g_" + res.mode), i: res.i + 1, n: res.ids.length }))}</b></span><span class="wm-go">→</span></button>` : ""}
      <button class="card wm-cont rec" data-wm="play" data-a="${rec.mode}">${wi(MODE_IC[rec.mode])}<span><b>${h(w("cont_rec", { game: w("g_" + rec.mode) }))}</b><small>${h(recText(rec))}</small></span><span class="wm-go">→</span></button>
      <h2 class="wm-h2">${h(w("recent_h"))}</h2>
      ${recent.length ? `<div class="wm-chips">${recent.map(t => `<button class="wm-wchip ${E.isMastered(s.t[t.id]) ? "m" : ""}" data-wm="word" data-a="${h(t.id)}">${h(name1(t))}</button>`).join("")}</div>` : `<p class="wm-mut">${h(w("recent_0"))}</p>`}
      <button class="wm-link" data-wm="tab" data-a="journey">${wi("map")} ${h(w("journey_link"))} →</button>
      ${(st().hist || []).length ? `<button class="wm-link" data-wm="tab" data-a="hist">${wi("clock")} ${h(w("h_link"))} →</button>` : ""}`;
  }
  function recText(rec) {
    const sk = id => w("skill_" + id).toLowerCase();
    if (rec.kind === "first") return w("rec_first");
    if (rec.kind === "gap") return w("rec_gap", { strong: sk(rec.strong), weak: sk(rec.weak) });
    if (rec.kind === "due") return w("rec_due", { n: rec.n });
    if (rec.kind === "difficult") return w("rec_difficult", { n: rec.n });
    if (rec.kind === "try") return w("rec_try", { skill: sk(rec.skill) });
    return w("rec_keep");
  }
  function gamesHTML() {
    const s = st();
    return `<div class="wm-games">${E.MODES.map(md => { const M = s.modes[md]; return `<button class="wm-game-card" data-wm="play" data-a="${md}">
      <span class="wm-gc-ic">${wi(MODE_IC[md])}</span><b>${h(w("g_" + md))}</b><small>${h(w("g_" + md + "_d"))}</small>
      <span class="wm-gc-skill">${h(w("skill_" + E.MODE_SKILL[md]))}</span>
      ${M && M.runs ? `<span class="wm-gc-best">${h(w("best", { n: M.best }))} · ${h(w("runs", { n: M.runs }))}</span>` : ""}
    </button>`; }).join("")}</div>`;
  }
  function journeyHTML() {
    const s = st(), J = E.journey(s, official(), C.categories), errs = E.errorsByStage(s, official());
    return `<p class="wm-mut">${h(w("j_sub"))}</p><ol class="wm-road">${J.map((j, i) => `
      <li class="wm-stage ${j.done ? "done" : j.started ? "now" : ""}">
        <span class="wm-node" aria-hidden="true">${j.done ? wi("check") : wi(CAT_IC[j.id])}</span>
        <div class="card wm-stage-c">
          <div class="wm-stage-h"><small>${i + 1}</small><b>${h(catName(j.id))}</b><span class="wm-chip ${j.done ? "ok" : ""}">${h(j.done ? w("j_done") : j.started ? w("j_prog") : w("j_new"))}</span></div>
          <div class="wm-stage-n">${h(w("j_words", { n: j.n }))} · ${h(w("j_mastered", { m: j.mastered }))} · ${j.pct}%</div>
          <div class="wm-meter ${j.done ? "ok" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="${j.n}" aria-valuenow="${j.mastered}" aria-label="${h(catName(j.id))}"><span style="width:${j.pct}%"></span></div>
          <div class="wm-stage-a"><button class="btn btn-p btn-sm" data-wm="stage" data-a="${j.id}">${wi("cards")} ${h(w("j_learn"))}</button>
          ${j.seen >= 10 ? `<button class="btn btn-g btn-sm" data-wm="stagetest" data-a="${j.id}">${wi("target")} ${h(w("j_test"))}</button>` : `<span class="wm-mut small">${wi("lock")} ${h(w("j_test_lock"))}</span>`}</div>
          ${stageHistHTML(j.id, errs[j.id] || [])}
        </div>
      </li>`).join("")}</ol>`;
  }

  /* ---- Collection ---- */
  function collList() {
    const s = st(), q = E.normAns(_coll.q), seg = _coll.seg, cat = _coll.cat;
    let list = seg === "mine" ? E.mineList(s).map(E.mineAsTerm) : official();
    if (cat !== "all" && seg !== "mine") list = list.filter(t => t.cat === cat);
    if (seg === "fav") list = list.filter(t => E.isFav(s, t.id));
    if (seg === "hard") list = list.filter(t => s.t[t.id] && (s.t[t.id].hard || E.difficulty(s.t[t.id]) >= 2) && !E.isMastered(s.t[t.id]));
    if (seg === "mastered") list = list.filter(t => E.isMastered(s.t[t.id]));
    if (q) list = list.filter(t => [t.en, t.fr].concat(t.syn || [], t.frSyn || []).some(x => E.normAns(x).includes(q)));
    return list;
  }
  function collHTML() {
    const s = st(), segs = ["all", "fav", "hard", "mastered", "mine"];
    return `
      <div class="wm-coll-bar">
        <label class="wm-search">${wi("search")}<input id="wmQ" type="search" value="${h(_coll.q)}" placeholder="${h(w("c_search"))}" aria-label="${h(w("c_search"))}"></label>
        <button class="wm-dir" data-wm="dir" aria-label="${h(w("dir"))}">${wi("swap")}<span>${h(w("dir"))}: <b>${h(first() === "fr" ? w("dir_fr") : w("dir_en"))}</b></span></button>
      </div>
      <div class="wm-segs" role="tablist">${segs.map(k => `<button role="tab" aria-selected="${_coll.seg === k}" class="wm-seg ${_coll.seg === k ? "on" : ""}" data-wm="seg" data-a="${k}">${h(w("c_" + k))}</button>`).join("")}</div>
      ${_coll.seg !== "mine" ? `<div class="wm-cats"><button class="wm-cat ${_coll.cat === "all" ? "on" : ""}" data-wm="cat" data-a="all">${h(w("c_cat_all"))}</button>${C.categories.map(c => `<button class="wm-cat ${_coll.cat === c.id ? "on" : ""}" data-wm="cat" data-a="${c.id}">${wi(CAT_IC[c.id])}${h(catName(c.id))}</button>`).join("")}</div>` : ""}
      <div id="wmCollList"></div>
      ${_coll.seg === "mine" ? mineFormHTML() + savedListHTML() : ""}`;
  }
  function collListHTML() {
    const s = st(), list = collList();
    const empty = { fav: "c_empty_fav", hard: "c_empty_hard", mastered: "c_empty_m", mine: "my_0" }[_coll.seg] || "c_empty";
    return `${list.length ? `<button class="btn btn-p wm-practise" data-wm="practise">${wi("cards")} ${h(w("c_practise", { n: Math.min(20, list.length) }))}</button>` : ""}
      ${_coll.seg === "mine" && list.length ? `<h3 class="wm-h3">${h(w("my_list"))}</h3>` : ""}
      ${list.length ? `<ul class="wm-words">${list.slice(0, 260).map(t => { const r = s.t[t.id]; return `<li class="wm-word ${E.isMastered(r) ? "m" : ""}">
        <button class="wm-word-b" data-wm="word" data-a="${h(t.id)}"><span class="wm-word-ic">${wi(CAT_IC[t.cat] || "spark")}</span><span class="wm-word-t"><b>${h(name1(t))}</b><small>${h(name2(t))}</small></span>
        <span class="wm-dot ${E.isMastered(r) ? "m" : r && r.n ? (E.difficulty(r) >= 2 ? "h" : "s") : ""}" aria-hidden="true"></span></button>
        ${t.mine ? `<button class="wm-iconbtn" data-wm="myedit" data-a="${h(t.id)}" aria-label="${h(w("my_edit"))} ${h(t.en)}">${wi("edit")}</button><button class="wm-iconbtn" data-wm="mydel" data-a="${h(t.id)}" aria-label="${h(w("my_del"))} ${h(t.en)}">${wi("trash")}</button>` : ""}
        <button class="wm-iconbtn wm-star ${E.isFav(s, t.id) ? "on" : ""}" data-wm="fav" data-a="${h(t.id)}" aria-pressed="${E.isFav(s, t.id)}" aria-label="${h(E.isFav(s, t.id) ? w("unfav") : w("fav"))}: ${h(t.en)}">${wi("star")}</button>
      </li>`; }).join("")}</ul>` : `<p class="wm-mut wm-empty">${h(w(empty))}</p>`}`;
  }
  function collAfter() {
    const box = document.getElementById("wmCollList"); if (box) box.innerHTML = collListHTML();
    const q = document.getElementById("wmQ");
    if (q && !q._wm) { q._wm = 1; q.addEventListener("input", () => { _coll.q = q.value; const b = document.getElementById("wmCollList"); if (b) b.innerHTML = collListHTML(); }); }
    const sb = document.getElementById("vlBox");
    if (sb) { try { vlRenderInto(vocBuckets()[_pracTab] || []); } catch (e) {} }
  }
  function mineFormHTML() {
    const e = _edit && st().mine[_edit];
    return `<form class="card wm-myform" id="wmMyForm" data-id="${e ? h(e.id) : ""}" novalidate>
      <h3 class="wm-h3">${wi("myword")} ${h(w("my_h"))}</h3>
      <label>${h(w("my_en"))}<input id="wmMyEn" maxlength="60" required value="${h(e ? e.en : "")}"></label>
      <label>${h(w("my_fr"))}<input id="wmMyFr" maxlength="60" value="${h(e ? e.fr : "")}"></label>
      <label>${h(w("my_def"))}<textarea id="wmMyDef" maxlength="220" rows="2">${h(e ? e.def : "")}</textarea></label>
      <label>${h(w("my_ex"))}<textarea id="wmMyEx" maxlength="220" rows="2">${h(e ? e.ex : "")}</textarea></label>
      <p class="wm-err" id="wmMyErr" role="alert"></p>
      <div class="wm-row"><button type="submit" class="btn btn-p">${h(e ? w("my_save") : w("my_add"))}</button>${e ? `<button type="button" class="btn btn-g" data-wm="mycancel">${h(w("my_cancel"))}</button>` : ""}</div>
    </form>`;
  }
  /* the old Vocabulary-page block lives on here: the saved list with its
     Study / Review / Mastered tabs, its add field and its empty state */
  function savedListHTML() {
    let b = { ready: [], upnext: [], learned: [] };
    try { b = vocBuckets(); } catch (e) {}
    return `<div class="card wm-saved"><h3 class="wm-h3">${wi("book")} ${h(w("saved_h"))}</h3><p class="wm-mut">${h(w("saved_sub"))}</p>
      <div class="prac-subtabs">${["ready", "upnext", "learned"].map(k => `<button class="prac-subtab ${_pracTab === k ? "on" : ""}" data-wm="savedtab" data-a="${k}">${h(t("prac.tab_" + k))} <b>${b[k].length}</b></button>`).join("")}</div>
      <div id="vlBox"></div>
      <div class="prac-add"><input id="pracAddIn" placeholder="${h(t("prac.add_ph"))}" aria-label="${h(t("prac.add_ph"))}"><button class="btn btn-g prac-add-btn" data-wm="savedadd">${h(t("prac.add_btn"))}</button></div>
    </div>`;
  }

  /* ---- History: every round, every answer, grouped and folded ---- */
  let _histSeg = "rounds";
  function label(id) { const t = byId(id); return t ? t.en + (t.fr ? " · " + t.fr : "") : id; }
  function itemHTML(x) {
    const ok = !!x.o;
    if (x.k === "reply") {
      const sc = C.workshop.find(z => z.id === x.s), o = sc && sc.reply.options[+x.p];
      return `<li class="wm-hi ${ok ? "ok" : "no"}">${wi(ok ? "check" : "cross")}<div><b>${h(w("h_reply"))}</b>${o ? `<small lang="en">“${h(o.en)}”</small>` : ""}${!ok && sc ? `<small>${h(w("h_ans", { a: (sc.reply.options.find(z => z.ok) || {}).en || "" }))}</small>` : ""}</div><em>${h(w("k_reply"))}</em></li>`;
    }
    const t = byId(x.t), name = t ? t.en : x.t;
    let said = "";
    if (x.k === "card") said = w("h_rated", { p: w(["again", "hard", "good", "easy"][x.q] || "good") });
    else if (x.p === "revealed") said = w("h_revealed");
    else if (x.p) said = byId(x.p) ? w("h_chose", { p: label(x.p) }) : w("h_typed", { p: x.p });
    const kind = x.k ? (x.k.startsWith("match") ? w("k_match") : w("k_" + x.k.replace("-", "_"))) : "";
    const sc = x.s && C.workshop.find(z => z.id === x.s);
    return `<li class="wm-hi ${ok ? "ok" : "no"}">${wi(ok ? "check" : "cross")}<div>
      ${sc ? `<small lang="en">“${h(sc.say.en)}”</small>` : ""}
      <button class="wm-hi-w" data-wm="word" data-a="${h(x.t)}"><b>${h(name)}</b>${t && t.fr ? ` <span lang="fr">${h(t.fr)}</span>` : ""}</button>
      ${said ? `<small class="${ok ? "" : "bad"}">${h(said)}</small>` : ""}${!ok && x.p && x.k !== "card" ? `<small>${h(w("h_ans", { a: name }))}</small>` : ""}${x.h ? `<small class="wm-mut">${h(w("h_hint"))}</small>` : ""}
    </div>${kind && kind.indexOf("k_") !== 0 ? `<em>${h(kind)}</em>` : ""}</li>`;
  }
  function roundHTML(r) {
    const time = new Date(r.ts).toLocaleTimeString(lang() === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
    return `<details class="wm-hr"><summary>${wi(MODE_IC[r.m] || "spark")}<span><b>${h(w("g_" + r.m))}</b><small>${h(time)} · ${h(w("h_round", { ok: r.ok, n: r.n, xp: r.xp || 0 }))}${r.part ? " · " + h(w("h_part")) : ""}${r.cats && r.cats.length === 1 ? " · " + h(catName(r.cats[0])) : ""}</small></span><i class="wm-hr-s ${r.n && r.ok / r.n >= .8 ? "ok" : ""}">${r.n ? Math.round(100 * r.ok / r.n) : 0}%</i></summary>
      ${r.it ? `<ul class="wm-his">${r.it.map(itemHTML).join("")}</ul>` : `<p class="wm-mut small">${h(w("h_sum"))}</p>`}</details>`;
  }
  function errListHTML(list) {
    return `<ul class="wm-his">${list.map(e => { const t = byId(e.t); if (!t) return ""; return `<li class="wm-hi ${e.now === "open" ? "no" : "ok"}">${wi(e.now === "mastered" ? "medal" : e.now === "fixed" ? "check" : "cross")}<div>
      <button class="wm-hi-w" data-wm="word" data-a="${h(e.t)}"><b>${h(t.en)}</b>${t.fr ? ` <span lang="fr">${h(t.fr)}</span>` : ""}</button>
      <small>${h(w("h_times", { n: e.n }))} · ${h(w("h_last", { d: fmtDate(e.last) }))}</small>
      ${e.picks.length ? `<small class="bad">${h(w("h_instead", { p: e.picks.map(p => byId(p) ? byId(p).en : p).join(", ") }))}</small>` : ""}
    </div><em class="${e.now}">${h(w("h_" + e.now))}</em></li>`; }).join("")}</ul>`;
  }
  function histHTML() {
    const s = st(), days = E.histByDay(s);
    const seg = `<div class="wm-segs" role="tablist">${["rounds", "errors"].map(k => `<button role="tab" aria-selected="${_histSeg === k}" class="wm-seg ${_histSeg === k ? "on" : ""}" data-wm="hseg" data-a="${k}">${h(w("h_" + k))}</button>`).join("")}</div>`;
    if (_histSeg === "errors") {
      const E2 = E.errorsByStage(s, official()), cats = C.categories.map(c => c.id).concat("mine").filter(c => E2[c] && E2[c].length);
      return `<p class="wm-mut">${h(w("h_sub"))}</p>${seg}${cats.length ? cats.map(c => { const list = E2[c], open = list.filter(e => e.now === "open"); return `<details class="wm-hd"><summary>${wi(CAT_IC[c] || "spark")}<span><b>${h(catName(c))}</b><small>${h(w("h_err_stage", { n: list.length, o: open.length }))}</small></span></summary>
        ${open.length ? `<button class="btn btn-p btn-sm" data-wm="practerr" data-a="${h(open.map(e => e.t).join(","))}">${wi("cards")} ${h(w("h_practise_err", { n: open.length }))}</button>` : ""}${errListHTML(list)}</details>`; }).join("") : `<p class="wm-mut wm-empty">${h(w("h_err0"))}</p>`}`;
    }
    return `<p class="wm-mut">${h(w("h_sub"))}</p>${seg}${days.length ? days.map(g => `<details class="wm-hd"><summary>${wi("clock")}<span><b>${h(fmtDate(Date.parse(g.day + "T12:00:00Z")))}</b><small>${h(w(g.rounds.length === 1 ? "h_day1" : "h_day", { n: g.rounds.length, ok: g.ok, a: g.n, xp: g.xp }))}</small></span></summary>${g.rounds.map(roundHTML).join("")}</details>`).join("") : `<p class="wm-mut wm-empty">${h(w("h_0"))}</p>`}`;
  }
  function stageHistHTML(cat, errs) {
    const s = st(), terms = new Set(official().filter(t => t.cat === cat).map(t => t.id));
    let a = 0, ok = 0; const rounds = [];
    for (const r of s.hist || []) { let hit = false; for (const x of r.it || []) if (terms.has(x.t)) { a++; if (x.o) ok++; hit = true; } if (hit) rounds.push(r); }
    const open = errs.filter(e => e.now === "open");
    return `<details class="wm-hd wm-stage-hist"><summary>${wi("clock")}<span><b>${h(w("h_stage"))}</b><small>${a ? h(w("h_stage_n", { a, ok })) + (errs.length ? " · " + h(w("h_err_stage", { n: errs.length, o: open.length })) : "") : h(w("h_stage_0"))}</small></span></summary>
      ${open.length ? `<button class="btn btn-p btn-sm" data-wm="practerr" data-a="${h(open.map(e => e.t).join(","))}">${wi("cards")} ${h(w("h_practise_err", { n: open.length }))}</button>` : ""}
      ${errs.length ? `<h4 class="wm-h3">${h(w("h_errors"))}</h4>${errListHTML(errs)}` : ""}
      ${rounds.length ? `<h4 class="wm-h3">${h(w("h_rounds"))}</h4>${rounds.slice(-20).reverse().map(roundHTML).join("")}` : ""}</details>`;
  }

  /* ---- Rewards ---- */
  function rewardsHTML() {
    const s = st(), lv = E.level(E.xpTotal(s)), sk = E.streak(s, Date.now());
    const stages = E.journey(s, official(), C.categories).filter(j => j.done);
    return `<div class="card wm-lvcard">${wi("medal", "big")}<div><small>${h(w("r_level_h"))}</small><b>${h(w("level", { n: lv.level }))} · ${h(w("xp", { n: lv.xp }))}</b>
        <div class="wm-meter gold" role="progressbar" aria-valuemin="${lv.floor}" aria-valuemax="${lv.next}" aria-valuenow="${lv.xp}" aria-label="${h(w("level", { n: lv.level }))}"><span style="width:${lv.pct}%"></span></div>
        <small>${h(w("xp_next", { n: lv.need, l: lv.level + 1 }))}</small></div></div>
      <p class="wm-mut">${h(w("r_thresh"))}</p>
      <div class="card wm-lvcard">${wi("flame", "big fl")}<div><b>${h(sk.current ? w("streak_d", { n: sk.current }) : w("streak_0"))}</b><small>Best: ${sk.best}</small></div></div>
      <h2 class="wm-h2">${h(w("r_ach_h"))}</h2>
      <div class="wm-achs">${E.ACH.map(a => { const got = s.ach[a.id]; return `<div class="wm-ach ${got ? "got" : ""}">
        <span class="wm-ach-ic">${wi(got ? a.ic : "lock")}</span><b>${h(w("ach_" + a.id))}</b><small>${h(w("ach_" + a.id + "_d"))}</small>
        <em>${h(got ? w("r_earned", { d: fmtDate(got) }) : w("r_locked"))}</em></div>`; }).join("")}</div>
      ${stages.length ? `<h2 class="wm-h2">${h(w("cel_stage"))}</h2><div class="wm-chips">${stages.map(j => `<span class="wm-chip ok">${wi("flag")} ${h(catName(j.id))}</span>`).join("")}</div>` : ""}`;
  }

  /* ---- Game Performance: the hub tab and the Progress page share it ---- */
  function perfInner(inHub) {
    const s = st(), now = Date.now(), p = E.performance(s, official(), now), rec = E.recommend(p);
    const maxXp = Math.max(1, ...p.xpSeries.map(x => x.xp));
    const bar = (pct, cls) => `<span class="wm-meter ${cls || ""}"><span style="width:${pct}%"></span></span>`;
    if (p.empty) return `<div class="wm-perf"><p class="wm-mut">${h(w("p_empty"))}</p><button class="btn btn-p" data-wm="${inHub ? "play" : "open"}" data-a="cards">${wi("cards")} ${h(inHub ? w("g_cards") : w("p_open"))}</button></div>`;
    return `<div class="wm-perf">
      <div class="wm-kpis">
        <div class="wm-kpi"><small>${h(w("p_mastered"))}</small><b>${p.mastered}<i>/${p.total}</i></b>${bar(Math.round(100 * p.mastered / p.total), "ok")}</div>
        <div class="wm-kpi"><small>${h(w("p_xp"))}</small><b>${p.xp}</b></div>
        <div class="wm-kpi"><small>${h(w("p_days"))}</small><b>${p.days7}<i>/7</i></b></div>
        <div class="wm-kpi"><small>${h(w("p_acc"))}</small><b>${p.accuracy == null ? "—" : p.accuracy + "%"}</b>${p.accuracy == null ? `<i class="wm-na">${h(w("p_acc_na"))}</i>` : ""}</div>
      </div>
      ${p.xpSeries.some(x => x.xp) ? `<h3 class="wm-h3">${h(w("p_xp14"))}</h3>
      <div class="wm-xpbars" role="list" aria-label="${h(w("p_xp14"))}">${p.xpSeries.map(x => `<span role="listitem" class="wm-xpb" title="${h(x.d)}: ${x.xp} XP" aria-label="${h(x.d)}: ${x.xp} XP"><i style="height:${x.xp ? Math.max(6, Math.round(100 * x.xp / maxXp)) : 0}%"></i></span>`).join("")}</div>
      <div class="wm-xpaxis"><span>${h(p.xpSeries[0].d.slice(5))}</span><span>${h(p.xpSeries[13].d.slice(5))}</span></div>` : ""}
      <h3 class="wm-h3">${h(w("p_skills"))}</h3>
      <ul class="wm-bars">${p.skills.map(k => `<li><span>${h(w("skill_" + k.id))}</span>${k.pct == null ? `<em>${h(w("p_skill_na", { n: k.n }))}</em>` : `${bar(k.pct)}<b>${k.pct}%</b>`}</li>`).join("")}</ul>
      <h3 class="wm-h3">${h(w("p_modes"))}</h3>
      <ul class="wm-bars">${p.modes.filter(x => x.runs || x.n).map(x => `<li><span>${wi(MODE_IC[x.id])} ${h(w("g_" + x.id))}</span>${x.pct == null ? `<em>${h(w("runs", { n: x.runs }))}</em>` : `${bar(x.pct)}<b>${x.pct}%</b>`}</li>`).join("") || `<li><em>—</em></li>`}</ul>
      <h3 class="wm-h3">${h(w("p_cats"))}</h3>
      <ul class="wm-bars">${C.categories.map(c => { const n = p.byCat[c.id] || 0; return `<li><span>${h(catName(c.id))}</span>${bar(Math.round(100 * n / c.n), "ok")}<b>${n}/${c.n}</b></li>`; }).join("")}</ul>
      <h3 class="wm-h3">${h(w("p_improved"))}</h3>
      ${p.improved.length || p.newlyMastered.length ? `<ul class="wm-list">${p.improved.map(x => `<li>${wi("chart")} ${h(w("p_impr_skill", { skill: w("skill_" + x.id), from: x.from, to: x.to }))}</li>`).join("")}${p.newlyMastered.length ? `<li>${wi("medal")} ${h(w("p_new_m", { w: p.newlyMastered.map(id => (byId(id) || { en: id }).en).slice(0, 8).join(", ") }))}</li>` : ""}</ul>` : `<p class="wm-mut">${h(w("p_none"))}</p>`}
      ${p.difficult.length ? `<h3 class="wm-h3">${h(w("p_hard"))}</h3><div class="wm-chips">${p.difficult.map(id => byId(id)).filter(Boolean).map(t => `<span class="wm-wchip h">${h(t.en)}</span>`).join("")}</div>` : ""}
      <div class="card wm-rec">${wi(MODE_IC[rec.mode])}<div><small>${h(w("p_rec"))}</small><b>${h(recText(rec))}</b></div><button class="btn btn-p btn-sm" data-wm="${inHub ? "play" : "open"}" data-a="${rec.mode}">${h(w("g_" + rec.mode))} →</button></div>
      ${inHub ? `<button class="wm-link" data-wm="nav" data-a="review">${wi("chart")} ${h(w("p_go_progress"))} →</button>` : ""}
    </div>`;
  }
  /* on the Progress page: a mount that fills itself once the corpus is here */
  function perfCardHTML() {
    if (!on()) return "";
    const body = C ? perfInner(false) : `<p class="wm-mut" role="status">${h(w("loading"))}</p>`;
    if (!C) loadCorpus().then(() => { const m = document.getElementById("wmPerfMount"); if (m) m.innerHTML = perfInner(false); }).catch(() => { const m = document.getElementById("wmPerfMount"); if (m) m.innerHTML = `<p class="wm-mut">${h(w("load_fail"))}</p>`; });
    return `<section class="card wm-perf-card" aria-labelledby="wmPerfH"><div class="wm-perf-head">${logo("wm-logo-s")}<div><h2 id="wmPerfH">${h(w("p_h"))}</h2><p>${h(w("p_sub"))}</p></div></div><div id="wmPerfMount">${body}</div></section>`;
  }

  /* ---- the Vocabulary-page portal (replaces the old professional list) ---- */
  function portalInto(el) {
    const s = st(); if (!s) return;
    const m = masteredCount(s), xp = E.xpTotal(s), sk = E.streak(s, Date.now()), today = E.dayOf(Date.now());
    const mis = s.mis && s.mis.day === today ? s.mis : null;
    el.innerHTML = `<button class="wm-portal" data-wm="nav" data-a="mastery" aria-label="${h(w("enter"))}">
      <span class="wm-portal-glow" aria-hidden="true"></span>
      ${logo("wm-logo-p")}
      <span class="wm-portal-t">
        <b class="wm-portal-title">WELDING <span>MASTERY</span></b>
        <span class="wm-portal-sub">${h(w("sub"))}</span>
        <span class="wm-portal-motto">${h(w("motto"))}</span>
        <span class="wm-portal-prog"><span class="wm-meter ok"><span style="width:${Math.round(100 * m / TOTAL)}%"></span></span><small>${h(w("mastered_of", { n: m, total: TOTAL }))}</small></span>
        <span class="wm-portal-shift">${wi("target")} ${h(w("shift_h"))}: ${h(mis ? (mis.done ? w("shift_done") : w("m_" + mis.kind) + ` · ${mis.prog}/${mis.target}`) : w("shift_new"))}</span>
        ${xp || sk.current ? `<span class="wm-portal-stats">${xp ? `<span>${wi("xp")} ${h(w("xp", { n: xp }))}</span>` : ""}${sk.current ? `<span>${wi("flame")} ${h(w("streak_d", { n: sk.current }))}</span>` : ""}</span>` : ""}
        <span class="wm-portal-cta">${h(w("enter"))} →</span>
      </span>
    </button>`;
  }

  /* ------------------------------------------------------------ settings */
  function settingsOpen() {
    const s = st(), set = s.set;
    const row = (k, label, val, a, b) => `<div class="wm-set-row"><span>${h(label)}</span><div class="wm-segs sm">${[a, b].map(o => `<button class="wm-seg ${val === o[0] ? "on" : ""}" data-wm="set" data-a="${k}:${o[0]}" aria-pressed="${val === o[0]}">${h(o[1])}</button>`).join("")}</div></div>`;
    sheet(`<h2>${wi("gear")} ${h(w("set_h"))}</h2>
      ${row("sound", w("set_sound"), set.sound ? "1" : "0", ["1", w("on")], ["0", w("off_")])}
      ${row("motion", w("set_motion"), set.motion === "reduced" ? "reduced" : "auto", ["reduced", w("on")], ["auto", w("off_")])}
      ${row("first", w("set_dir"), set.first, ["en", w("dir_en")], ["fr", w("dir_fr")])}
      <button class="btn btn-p wm-wide" data-wm="sheetclose">${h(w("set_close"))}</button>`);
  }
  function sheet(html) {
    sheetClose();
    const d = document.createElement("div"); d.id = "wmSheet"; d.className = "wm-sheet-bg";
    d.innerHTML = `<div class="wm-sheet" role="dialog" aria-modal="true"><button class="wm-iconbtn wm-sheet-x" data-wm="sheetclose" aria-label="${h(w("close"))}">${wi("close")}</button>${html}</div>`;
    d.addEventListener("click", e => { if (e.target === d) sheetClose(); });
    document.body.appendChild(d);
    const f = d.querySelector("button,input"); if (f) f.focus();
  }
  function sheetClose() { const d = document.getElementById("wmSheet"); if (d) d.remove(); }

  /* ---- the full learning card (Collection, recent chips, after an answer) ---- */
  function wordSheet(id) {
    const t = byId(id); if (!t) return;
    sheet(fullCardHTML(t, true));
  }
  function fullCardHTML(t, withActions, noHead) {
    const s = st(), r = s.t[t.id], fav = E.isFav(s, t.id), hard = r && r.hard;
    const art = artSVG(t, w("v_alt_after", { w: t.en }), { credit: false });
    let saved = false; try { saved = vocHas(t.en.toLowerCase()); } catch (e) {}
    const sec = (ic, k, o) => o && (o.en || o.fr) ? `<div class="wm-f"><b>${wi(ic)} ${h(w(k))}</b>${o.en ? `<p lang="en">${h(o.en)}</p>` : ""}${o.fr ? `<p lang="fr" class="fr">${h(o.fr)}</p>` : ""}</div>` : "";
    return `<div class="wm-full">
      ${noHead ? "" : `<div class="wm-full-h">${art || catArt(t.cat)}<div><b lang="en">${h(t.en)}</b><span lang="fr">${h(t.fr)}</span><small>${h(catName(t.cat))}${t.lvl ? " · " + h(t.lvl) : ""}</small></div></div>`}
      ${art && !noHead && !t.photo ? `<p class="wm-mut small">${wi("camera")} ${h(w("f_drawing"))}</p>` : ""}
      ${t.photo ? `<p class="wm-photo-credit">${wi("camera")} ${photoCredit(t.photo, true)}</p>` : ""}
      <div class="wm-row"><button class="btn btn-g btn-sm" data-wm="say" data-a="${h(t.en)}">${wi("sound")} ${h(w("hear"))}</button>${t.ex && t.ex.en ? `<button class="btn btn-g btn-sm" data-wm="say" data-a="${h(t.ex.en)}">${wi("chat")} ${h(w("hear_ex"))}</button>` : ""}</div>
      ${(t.syn || []).length || (t.frSyn || []).length ? `<p class="wm-mut small">${h(w("f_syn"))}: ${h((t.syn || []).concat(t.frSyn || []).join(" · "))}</p>` : ""}
      ${sec("book", "f_def", t.def)}${sec("tool", "f_use", t.use)}${sec("factory", "f_ctx", t.ctx)}${sec("chat", "f_ex", t.ex)}
      ${t.verify ? `<p class="wm-mut small">${wi("edit")} ${h(w("f_verify"))}</p>` : ""}
      ${withActions ? `<div class="wm-row wm-full-a">
        <button class="btn btn-g btn-sm wm-star ${fav ? "on" : ""}" data-wm="fav" data-a="${h(t.id)}" aria-pressed="${fav}">${wi("star")} ${h(fav ? w("unfav") : w("fav"))}</button>
        ${t.mine ? "" : `<button class="btn btn-g btn-sm ${hard ? "on" : ""}" data-wm="hard" data-a="${h(t.id)}" aria-pressed="${!!hard}">${wi("target")} ${h(hard ? w("unmark_hard") : w("mark_hard"))}</button>`}
        <button class="btn btn-g btn-sm" data-wm="savelist" data-a="${h(t.id)}" ${saved ? "disabled" : ""}>${wi("book")} ${h(saved ? w("saved_list") : w("save_list"))}</button>
      </div>` : ""}
    </div>`;
  }

  /* ------------------------------------------------------------ games */
  const SIZE = { cards: 10, quiz: 8, crossword: 10, visual: 8, listen: 6, builder: 6, match: 10, workshop: 4 };
  function poolFor(mode) {
    const all = mode === "cards" || mode === "builder" || mode === "listen" ? allTerms() : official();
    /* picture games use real photographs only (owner, 9 Oct 2026); drawings remain on the cards */
    if (mode === "visual") { const ph = all.filter(t => t.photo); return ph.length >= 8 ? ph : all.filter(t => t.img); }
    if (mode === "builder") return all.filter(t => E.builderOk(t) && (t.fr || (t.def && t.def.en)));
    if (mode === "crossword") return all.filter(E.crosswordOk);
    return all;
  }
  function chooseIds(mode, opts) {
    const s = st(), now = Date.now(), o = opts || {};
    if (mode === "workshop") {
      const ws = C.workshop.filter(x => !o.cat || x.cat === o.cat);
      const weak = cat => E.journey(s, official(), C.categories).find(j => j.id === cat).pct;
      return ws.slice().sort((a, b) => (s.ws[a.id] || 0) - (s.ws[b.id] || 0) || weak(a.cat) - weak(b.cat) || (a.id < b.id ? -1 : 1)).slice(0, o.n || SIZE.workshop).map(x => x.id);
    }
    let pool = poolFor(mode);
    if (o.ids) { const set = new Set(o.ids); pool = pool.filter(t => set.has(t.id)); if (o.keepOrder) return o.ids.filter(id => pool.some(t => t.id === id)).slice(0, o.n || 20); }
    if (o.cat) pool = pool.filter(t => t.cat === o.cat);
    const filter = o.onlyNew ? id => !s.t[id] || !s.t[id].n : o.onlyDue ? id => s.t[id] && s.t[id].n && s.t[id].due <= now : null;
    let ids = E.pick(s, pool.map(t => t.id), o.n || SIZE[mode], now, filter);
    if (ids.length < (o.min || 1) && filter) ids = E.pick(s, pool.map(t => t.id), o.n || SIZE[mode], now);
    return ids;
  }
  function start(mode, opts) {
    if (!on() || !C) return;
    const o = opts || {};
    if (mode === "listen" && !canSpeak()) { gameOpen(mode, `<div class="wm-g-msg">${wi("headphones", "big")}<p>${h(w("l_no_audio"))}</p><button class="btn btn-p" data-wm="gclose">${h(w("close"))}</button></div>`); return; }
    const ids = o.resume ? o.resume.ids : chooseIds(mode, o);
    if (!ids.length || (mode === "match" && ids.length < 4) || (mode === "quiz" && official().length < 4)) { gameOpen(mode, `<div class="wm-g-msg"><p>${h(w("none_words"))}</p><button class="btn btn-p" data-wm="gclose">${h(w("close"))}</button></div>`); return; }
    const sid = o.resume ? o.resume.sid : mode + "-" + Date.now().toString(36);
    const prevLog = o.resume ? E.histRound(st(), sid) : null;
    _G = { log: prevLog && prevLog.it ? prevLog.it.map(x => ({ ok: x.o, t: x.t, s: x.s, k: x.k, p: x.p, q: x.q, h: x.h })) : [], t0: prevLog ? prevLog.ts : Date.now(), mode, ids, i: o.resume ? o.resume.i : 0, sid, n: o.resume ? o.resume.n || 0 : 0, ok: o.resume ? o.resume.ok || 0 : 0, xp: 0, mastered: [], combo: 0, seed: E.hash(sid), opts: o, step: 0, st: {} };
    if (mode === "crossword") return cwBuild();
    if (mode === "match") return matchRound();
    draw();
  }
  function startMission() {
    const s = st(), m = s.mis; if (!m || m.done) return;
    const left = m.target - m.prog;
    if (m.kind === "start5") return start("cards", { onlyNew: true, n: Math.max(left, 1) });
    if (m.kind === "hard5") return start("cards", { ids: m.ids, keepOrder: true, n: 10 });
    if (m.kind === "due5") return start("cards", { onlyDue: true, n: Math.max(left + 2, 5) });
    if (m.kind === "tools5") return start("visual", { n: Math.max(left + 2, 6) });
    if (m.kind === "recall3") return start("builder", { n: Math.max(left + 2, 5) });
    return start(m.mode);
  }
  function gameOpen(mode, inner) {
    let ov = document.getElementById("wmGame");
    if (!ov) { ov = document.createElement("div"); ov.id = "wmGame"; ov.className = "wm-game"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); document.body.appendChild(ov); }
    const G = _G, prog = G && G.ids ? `${Math.min(G.i + 1, G.ids.length)}/${G.ids.length}` : "";
    ov.setAttribute("aria-label", w("g_" + mode));
    ov.innerHTML = `<div class="wm-g-in"><div class="wm-g-top"><button class="wm-iconbtn" data-wm="gclose" aria-label="${h(w("close"))}">${wi("close")}</button>
      <span class="wm-g-title">${wi(MODE_IC[mode])} ${h(w("g_" + mode))}</span>
      <span class="wm-g-prog">${G && G.combo >= 3 ? `<i class="wm-combo">${wi("flame")} ${h(w("combo", { n: G.combo }))}</i>` : ""}${h(prog)}</span></div>
      ${G && G.ids && mode !== "crossword" ? `<div class="wm-meter thin"><span style="width:${Math.round(100 * G.i / G.ids.length)}%"></span></div>` : ""}
      <div class="wm-g-body" id="wmGBody">${inner}</div></div>`;
    ov.classList.add("show"); document.body.style.overflow = "hidden";
    document.documentElement.classList.toggle("wm-still", reduced());
    const f = ov.querySelector(".wm-g-body [autofocus], .wm-g-body input, .wm-g-body button"); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  /* the round goes into the history whether it was finished or left part-way */
  function logRound(part) {
    const G = _G; if (!G || !G.log.length) return;
    const cats = G.log.map(x => { const t = x.t && byId(x.t); return t ? t.cat : null; });
    E.logRound(st(), { id: G.sid, mode: G.mode, ts: G.t0, n: G.n, ok: G.ok, xp: G.xp, items: G.log, cats, part }, Date.now());
    persist();
  }
  function gameClose() {
    if (_G && !_G.done) try { logRound(true); } catch (e) {}
    const ov = document.getElementById("wmGame"); if (ov) { ov.classList.remove("show"); ov.innerHTML = ""; }
    document.body.style.overflow = ""; try { speechSynthesis.cancel(); } catch (e) {}
    _G = null; redraw();
  }
  function saveResume() {
    const G = _G; if (!G || G.mode === "crossword" || G.mode === "match") return;
    st().resume = { mode: G.mode, ids: G.ids, i: G.i, sid: G.sid, n: G.n, ok: G.ok, ts: Date.now() };
  }
  /* every graded answer goes through here: engine → mission → celebration → save */
  function answer(id, q, skill, extra) {
    const s = st(), G = _G, now = Date.now(), ex = extra || {};
    const g = E.grade(s, id, q, { mode: G.mode, skill, now });
    G.n++; if (g.ok) { G.ok++; G.combo++; tone("ok"); } else { G.combo = 0; tone("no"); }
    G.log.push({ t: id, ok: g.ok, k: ex.k, p: ex.p, q: ex.k === "card" ? q : null, h: ex.hint ? 1 : 0, s: ex.s });
    G.xp += g.xp;
    const mx = E.missionStep(s, { type: "answer", ok: g.ok, mode: G.mode, wasNew: g.wasNew, wasDue: g.wasDue, id, hint: !!ex.hint }, now);
    if (mx) { G.xp += mx; G.missionDone = true; }
    if (g.mastered) { const t = byId(id); G.mastered.push(id); celebrate("mastered", w("cel_mastered"), t ? t.en + (t.fr ? " · " + t.fr : "") : ""); }
    if (g.ok && [5, 10, 20].includes(G.combo) && !reduced()) { const c = document.querySelector(".wm-combo"); if (c) c.classList.add("pop"); }
    const a = E.checkAchievements(s, official(), now); G.xp += a.xp; achCelebrate(a.got);
    persist();
    return g;
  }
  function achCelebrate(got) {
    (got || []).forEach((k, i) => setTimeout(() => {
      if (k.startsWith("stage:")) { celebrate(masteredCount() >= TOTAL ? "final" : "stage", masteredCount() >= TOTAL ? w("cel_final") : w("cel_stage"), catName(k.slice(6))); }
      else celebrate("ach", w("cel_ach"), w("ach_" + k));
    }, 700 * (i + 1)));
  }
  function nextItem() { const G = _G; if (!G) return; G.i++; G.step = 0; G.st = {}; saveResume(); persist(); if (G.i >= G.ids.length) return finish(); draw(); }
  function finish() {
    const s = st(), G = _G, now = Date.now();
    const f = E.finishSession(s, { id: G.sid, mode: G.mode, n: G.n, ok: G.ok }, now); G.xp += f.xp;
    const mx = E.missionStep(s, { type: "session", mode: G.mode, n: G.n }, now); if (mx) { G.xp += mx; G.missionDone = true; }
    if (G.mode === "workshop") G.ids.forEach(id => { s.ws[id] = (s.ws[id] || 0) + 1; });
    const a = E.checkAchievements(s, official(), now); G.xp += a.xp;
    G.done = true; logRound(false);
    const names = G.mastered.map(id => (byId(id) || { en: id }).en);
    gameOpen(G.mode, `<div class="wm-end">
      <span class="wm-end-ic">${wi(G.ok >= G.n * 0.8 && G.n ? "trophy" : "check", "big")}</span>
      <h2>${h(w("end_h"))}</h2>
      <p class="wm-end-score">${h(w("end_score", { ok: G.ok, n: G.n }))}</p>
      <p class="wm-end-xp">${G.xp ? `${wi("xp")} ${h(w("end_xp", { n: G.xp }))}` : h(w("end_xp0"))}</p>
      ${G.missionDone ? `<p class="wm-chip ok">${wi("check")} ${h(w("end_shift", { n: E.XP.mission }))}</p>` : ""}
      ${names.length ? `<p class="wm-end-m">${wi("medal")} ${h(w("end_mastered", { w: names.join(", ") }))}</p>` : ""}
      <div class="wm-row center"><button class="btn btn-g" data-wm="again">${h(w("end_again"))}</button><button class="btn btn-p" data-wm="gclose">${h(w("end_hub"))}</button></div>
      ${G.mode === "workshop" ? `<button class="wm-link" data-wm="nav" data-a="simulation">${wi("workshop")} ${h(w("w_link"))} →</button>` : ""}
    </div>`);
    if (a.got.length) achCelebrate(a.got);
    if (G.ok === G.n && G.n >= 5 && !a.got.length) celebrate("round", w("end_h"), w("end_score", { ok: G.ok, n: G.n }));
    G.done = true;
  }
  function draw() {
    const G = _G; if (!G) return;
    const fn = { cards: cardsHTML, quiz: quizHTML, visual: visualHTML, listen: listenHTML, builder: builderHTML, workshop: workshopHTML }[G.mode];
    gameOpen(G.mode, fn());
    if (G.mode === "listen" && !G.st.played) { G.st.played = 1; setTimeout(() => { const t = byId(G.ids[G.i]); if (t) say(t.en, 0.9); }, 350); }
    if (G.mode === "builder") builderBind();
    if (G.mode === "listen") listenBind();
  }
  function feedbackHTML(t, okFlag, extra) {
    return `<div class="wm-fb ${okFlag ? "ok" : "no"}" role="status">${wi(okFlag ? "check" : "cross")}<div><b>${h(okFlag ? w("ok") : w("no"))}</b>${okFlag ? "" : `<span>${h(w("the_answer", { w: t.en + (t.fr ? " · " + t.fr : "") }))}</span>`}
      <p lang="en">${h(t.def.en)}</p>${t.def.fr ? `<p lang="fr" class="fr">${h(t.def.fr)}</p>` : ""}${extra || ""}</div></div>
      <button class="btn btn-p wm-wide" data-wm="next" autofocus>${h(w("next"))} →</button>`;
  }

  /* -- Game 1: Cards -- */
  function cardsHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    const front = first() === "fr" && t.fr ? t.fr : t.en, back = first() === "fr" && t.fr ? t.en : t.fr;
    const art = artSVG(t, G.st.flipped ? w("v_alt_after", { w: t.en }) : w("v_alt"));
    return `<div class="wm-dirbar"><button class="wm-dir" data-wm="gdir">${wi("swap")}<span>${h(w("dir"))}: <b>${h(first() === "fr" ? w("dir_fr") : w("dir_en"))}</b></span></button></div>
      <div class="wm-card ${G.st.flipped ? "flipped" : ""}">
        <div class="wm-card-front">${art || catArt(t.cat)}<small>${h(catName(t.cat))}${t.lvl ? " · " + h(t.lvl) : ""}</small><b class="wm-card-w" lang="${first() === "fr" && t.fr ? "fr" : "en"}">${h(front)}</b>
          <button class="btn btn-g btn-sm" data-wm="say" data-a="${h(t.en)}">${wi("sound")} ${h(w("hear"))}</button></div>
        ${G.st.flipped ? `<div class="wm-card-back"><b class="wm-card-w2">${h(back || "")}</b>${fullCardHTML(t, true, true)}</div>` : ""}
      </div>
      ${G.st.flipped ? `<p class="wm-rate-q">${h(w("rate_q"))}</p><div class="wm-rate">${[["again", 0], ["hard", 1], ["good", 2], ["easy", 3]].map(([k, q]) => `<button class="wm-rate-b r${q}" data-wm="rate" data-a="${q}">${h(w(k))}</button>`).join("")}</div>`
        : `<button class="btn btn-p wm-wide" data-wm="flip" autofocus>${h(w("reveal"))}</button>`}`;
  }

  /* -- Game 2: Quiz -- */
  function quizQ(t, seed) {
    const r = E.rng(seed), types = ["en2fr", "fr2en", "def", "use", "ctx"].concat(t.img ? ["img"] : []);
    const type = types[Math.floor(r() * types.length)];
    const label = type === "en2fr" ? x => x.fr : x => x.en;
    const ds = E.distractors(official(), t.id, 3, seed, { label, needImg: false });
    const opts = E.shuffle([t.id].concat(ds), seed + 7);
    let prompt = "";
    if (type === "en2fr") prompt = `<b class="wm-q-w" lang="en">${h(t.en)}</b>`;
    else if (type === "fr2en") prompt = `<b class="wm-q-w" lang="fr">${h(t.fr)}</b>`;
    else if (type === "img") prompt = artSVG(t, w("v_alt"));
    else { const o = t[type]; prompt = `<p class="wm-q-clue" lang="en">“${h(blank(o.en, t))}”</p><details class="wm-tr"><summary>${h(w("tr_show"))}</summary><p lang="fr">${h(blank(o.fr, Object.assign({}, t, { en: t.fr, syn: t.frSyn })))}</p></details>`; }
    return { type, opts, label, prompt, skill: type === "ctx" || type === "use" ? "context" : type === "img" ? "visual" : "recognition" };
  }
  function quizHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    const Qz = G.st.q || (G.st.q = quizQ(t, G.seed + G.i * 31));
    const ans = G.st.ans;
    return `<p class="wm-q-h">${h(w({ en2fr: "q_en2fr", fr2en: "q_fr2en", def: "q_def", use: "q_use", ctx: "q_ctx", img: "q_img" }[Qz.type]))}</p>
      <div class="wm-q-p">${Qz.prompt}</div>
      <div class="wm-opts" role="group">${Qz.opts.map(id => { const o = byId(id), cls = ans ? (id === t.id ? "correct" : id === ans ? "wrong" : "") : ""; return `<button class="wm-opt ${cls}" data-wm="qpick" data-a="${h(id)}" ${ans ? "disabled" : ""}>${h(Qz.label(o))}</button>`; }).join("")}</div>
      ${ans ? feedbackHTML(t, ans === t.id) : ""}`;
  }

  /* -- Game 4: Visual recognition -- */
  function visualHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    const lbl = x => name1(x);
    const picPool = official().filter(x => (t.photo ? x.photo : x.img));
    const opts = G.st.opts || (G.st.opts = E.shuffle([t.id].concat(E.distractors(picPool, t.id, 3, G.seed + G.i, { needImg: true, label: lbl })), G.seed + G.i * 3));
    const ans = G.st.ans;
    return `<p class="wm-q-h">${h(w("q_img"))}</p>
      <div class="wm-q-p wm-visual">${artSVG(t, ans ? w("v_alt_after", { w: t.en }) : w("v_alt"))}</div>
      ${t.photo ? "" : `<p class="wm-mut small center">${h(w("f_drawing"))}</p>`}
      <div class="wm-opts" role="group">${opts.map(id => { const o = byId(id), cls = ans ? (id === t.id ? "correct" : id === ans ? "wrong" : "") : ""; return `<button class="wm-opt ${cls}" data-wm="vpick" data-a="${h(id)}" ${ans ? "disabled" : ""}>${h(lbl(o))}</button>`; }).join("")}</div>
      ${ans ? feedbackHTML(t, ans === t.id, `<p lang="en"><b>${h(w("f_use"))}:</b> ${h(t.use.en)}</p><p lang="en"><b>${h(w("f_ctx"))}:</b> ${h(t.ctx.en)}</p>`) : ""}`;
  }

  /* -- Game 5: Listening -- */
  function listenTyped(t) { const r = st().t[t.id]; return E.builderOk(t) && r && r.n >= 1 && (_G.i % 2 === 1); }
  function listenHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    const typed = G.st.typed != null ? G.st.typed : (G.st.typed = listenTyped(t));
    const ans = G.st.ans;
    const opts = typed ? null : (G.st.opts || (G.st.opts = E.shuffle([t.id].concat(E.distractors(allTerms(), t.id, 3, G.seed + G.i)), G.seed + G.i * 5)));
    return `<p class="wm-q-h">${h(typed ? w("l_type") : w("l_prompt"))}</p>
      <div class="wm-listen">
        <button class="wm-big-play" data-wm="say" data-a="${h(t.en)}" aria-label="${h(w("replay"))}">${wi("headphones")}</button>
        <div class="wm-row center"><button class="btn btn-g btn-sm" data-wm="sayslow" data-a="${h(t.en)}">${h(w("slow"))}</button>${t.ex && t.ex.en ? `<button class="btn btn-g btn-sm" data-wm="say" data-a="${h(t.ex.en)}">${wi("chat")} ${h(w("hear_ex"))}</button>` : ""}<button class="btn btn-g btn-sm" data-wm="lhint" ${G.st.hint || ans ? "disabled" : ""}>${h(w("l_hint"))}</button></div>
        ${G.st.hint ? `<p class="wm-hint">${h(w("l_hint_txt", { fr: t.fr || "—", c: t.en[0].toUpperCase() }))}</p>` : ""}
        <p class="wm-mut small center">${wi("sound")} ${h(w("l_synth"))}</p>
      </div>
      ${typed ? `<form class="wm-typed" id="wmLForm"><input id="wmLIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${h(w("l_type_ph"))}" aria-label="${h(w("l_type_ph"))}" ${ans ? "disabled" : ""} value="${h(G.st.val || "")}"><button class="btn btn-p" ${ans ? "disabled" : ""}>${h(w("check"))}</button></form>`
        : `<div class="wm-opts" role="group">${opts.map(id => { const o = byId(id), cls = ans ? (id === t.id ? "correct" : id === ans ? "wrong" : "") : ""; return `<button class="wm-opt ${cls}" data-wm="lpick" data-a="${h(id)}" ${ans ? "disabled" : ""}>${h(o.en)}</button>`; }).join("")}</div>`}
      ${ans ? feedbackHTML(t, ans === "ok" || ans === t.id) : ""}`;
  }
  function listenBind() {
    const f = document.getElementById("wmLForm"); if (!f) return;
    f.addEventListener("submit", e => {
      e.preventDefault(); const G = _G, t = byId(G.ids[G.i]); if (!t || G.st.ans) return;
      const v = document.getElementById("wmLIn").value; G.st.val = v;
      const good = E.checkTyped(v, t);
      G.st.ans = good ? "ok" : "bad";
      answer(t.id, good ? (G.st.hint ? 1 : 2) : 0, good && !G.st.hint ? "listening_typed" : "listening", { hint: G.st.hint, k: "listen-t", p: v });
      draw();
    });
  }

  /* -- Game 6: Word Builder -- */
  function builderHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    const S2 = G.st;
    if (!S2.tiles) { S2.tiles = E.tiles(t.en, G.seed + G.i).map((c, k) => ({ c, k, used: false })); S2.picked = []; S2.tries = 0; S2.hint = 0; }
    const target = t.en.toUpperCase(), letters = target.replace(/[^A-Z0-9]/g, "");
    let li = 0;
    const slots = target.split("").map(ch => /[A-Z0-9]/.test(ch) ? (() => { const p = S2.picked[li]; const fixed = li < S2.hint; li++; return `<span class="wm-slot ${p != null ? "f" : ""} ${fixed ? "hint" : ""}">${p != null ? h(S2.tiles[p].c) : ""}</span>`; })() : `<span class="wm-slot gap">${ch === " " ? "" : h(ch)}</span>`).join("");
    const done = S2.ans;
    return `<p class="wm-q-h">${h(w("b_prompt"))}</p>
      <div class="wm-q-p">${t.fr ? `<b class="wm-q-w" lang="fr">${h(t.fr)}</b>` : ""}${t.def && t.def.fr ? `<p class="fr" lang="fr">${h(t.def.fr)}</p>` : t.def && t.def.en ? `<p lang="en">${h(blank(t.def.en, t))}</p>` : ""}</div>
      <div class="wm-slots" aria-label="${letters.length} letters" aria-live="polite">${slots}</div>
      ${done ? "" : `<div class="wm-tiles" role="group">${S2.tiles.map((x, i) => `<button class="wm-tile" data-wm="tile" data-a="${i}" ${x.used ? "disabled" : ""} aria-label="${h(x.c)}">${h(x.c)}</button>`).join("")}</div>
      <div class="wm-row center"><button class="btn btn-g btn-sm" data-wm="bback" aria-label="Backspace">⌫</button><button class="btn btn-g btn-sm" data-wm="bclear">${h(w("b_clear"))}</button><button class="btn btn-g btn-sm" data-wm="bhint" ${S2.hint >= letters.length - 1 ? "disabled" : ""}>${h(w("b_hint"))}</button></div>
      <form class="wm-typed" id="wmBForm"><input id="wmBIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${h(w("b_type_ph"))}" aria-label="${h(w("b_type_ph"))}"><button class="btn btn-p">${h(w("check"))}</button></form>
      ${S2.msg ? `<p class="wm-err" role="alert">${h(S2.msg)}</p>` : ""}`}
      ${done ? feedbackHTML(t, done === "ok", t.ex && t.ex.en ? `<p lang="en"><i>“${h(t.ex.en)}”</i></p>` : "") : ""}`;
  }
  function builderBind() {
    const f = document.getElementById("wmBForm"); if (!f) return;
    f.addEventListener("submit", e => { e.preventDefault(); builderCheck(document.getElementById("wmBIn").value); });
  }
  function builderTry() {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st, need = t.en.replace(/[^A-Za-z0-9]/g, "").length;
    if (S2.picked.length === need) builderCheck(S2.picked.map(p => S2.tiles[p].c).join(""));
    else draw();
  }
  function builderCheck(val) {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st; if (S2.ans) return;
    if (E.checkTyped(val, t)) { S2.ans = "ok"; answer(t.id, S2.hint ? 1 : 2, "spelling", { hint: S2.hint > 0, k: "spell", p: val }); }
    else { S2.tries++; S2.msg = w("b_try"); S2.picked = []; S2.tiles.forEach(x => x.used = false); builderApplyHint(); S2.lastWrong = val; if (S2.tries >= 2) { S2.ans = "bad"; answer(t.id, 0, "spelling", { k: "spell", p: val }); } }
    draw();
  }
  /* a hint fixes the next letter in place (and makes the answer Hard, not Good) */
  function builderApplyHint() {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st, letters = t.en.toUpperCase().replace(/[^A-Z0-9]/g, "");
    S2.picked = []; S2.tiles.forEach(x => x.used = false);
    for (let k = 0; k < S2.hint; k++) { const ix = S2.tiles.findIndex(x => !x.used && x.c === letters[k]); if (ix >= 0) { S2.tiles[ix].used = true; S2.picked.push(ix); } }
  }

  /* -- Game 7: Match -- */
  const MATCH_KINDS = ["en_fr", "def", "img", "use", "ctx"];
  function matchRound() {
    const G = _G, round = G.st.round || 0, slice = G.ids.slice(round * 5, round * 5 + 5);
    if (slice.length < 2) return finish();
    let kind = MATCH_KINDS[(G.seed + round) % MATCH_KINDS.length];
    let items = slice.map(byId).filter(Boolean);
    if (kind === "img") { const ph = official().filter(t => t.photo), pool = ph.length >= 8 ? ph : official().filter(t => t.img); items = E.pick(st(), pool.map(t => t.id), 5, Date.now()).map(byId); }
    const right = x => kind === "en_fr" ? x.fr : kind === "def" ? blank(x.def.en, x) : kind === "use" ? blank(x.use.en, x) : kind === "ctx" ? blank(x.ctx.en, x) : "";
    G.st = { round, kind, items, rightOrder: E.shuffle(items.map(x => x.id), G.seed + round * 11), sel: null, done: {}, miss: {}, right };
    G.ids = G.ids.slice(0, round * 5).concat(items.map(x => x.id), G.ids.slice(round * 5 + 5));
    matchDraw();
  }
  function matchDraw() {
    const G = _G, M = G.st;
    const rlabel = id => { const x = byId(id); return M.kind === "img" ? artSVG(x, w("v_alt"), { credit: false }) : `<span>${h(M.right(x))}</span>`; };
    gameOpen("match", `<p class="wm-q-h">${h(w("m_" + M.kind))}</p><p class="wm-mut small">${h(w("m_prompt"))}</p>
      <div class="wm-match ${M.kind === "img" ? "img" : ""}">
        <div class="wm-mcol">${M.items.map(x => `<button class="wm-m ${M.sel === x.id ? "sel" : ""} ${M.done[x.id] ? (M.miss[x.id] ? "late" : "ok") : ""}" data-wm="mleft" data-a="${h(x.id)}" ${M.done[x.id] ? "disabled" : ""} aria-pressed="${M.sel === x.id}">${h(x.en)}</button>`).join("")}</div>
        <div class="wm-mcol">${M.rightOrder.map(id => `<button class="wm-m r ${M.done[id] ? (M.miss[id] ? "late" : "ok") : ""} ${M.flash === id ? "bad" : ""}" data-wm="mright" data-a="${h(id)}" ${M.done[id] ? "disabled" : ""}>${rlabel(id)}</button>`).join("")}</div>
      </div>${M.flash ? `<p class="wm-err" role="alert">${h(w("m_wrong"))}</p>` : ""}`);
  }
  /* a pair counts as known only if it was matched without a wrong try on that
     word — a lucky match after a miss is filed as "Again", not as success */
  function matchPick(side, id) {
    const G = _G, M = G.st;
    if (side === "l") { M.sel = M.sel === id ? null : id; M.flash = null; return matchDraw(); }
    if (!M.sel) return;
    if (M.sel === id) { M.done[id] = 1; answer(id, M.miss[id] ? 0 : 2, "recognition", { k: "match-" + M.kind, p: M.miss[id] || "" }); M.sel = null; M.flash = null; G.i++; }
    else { if (!M.miss[M.sel]) M.miss[M.sel] = id; M.flash = id; tone("no"); }
    if (M.items.every(x => M.done[x.id])) { M.round++; G.st = { round: M.round }; if (M.round * 5 >= G.ids.length) return finish(); return setTimeout(matchRound, 450); }
    matchDraw();
  }

  /* -- Game 8: Workshop challenge -- */
  function workshopHTML() {
    const G = _G, sc = C.workshop.find(x => x.id === G.ids[G.i]); if (!sc) { setTimeout(nextItem, 0); return ""; }
    const S2 = G.st, t = byId(sc.answer);
    const opts = S2.opts || (S2.opts = E.shuffle(sc.options, G.seed + G.i));
    const ropts = S2.ropts || (S2.ropts = E.shuffle(sc.reply.options.map((o, k) => k), G.seed + G.i * 13));
    return `<div class="wm-ws"><div class="wm-ws-h">${wi("workshop")}<span><small>${h(L2(sc.topic))}</small><b>${h(L2(sc.who))}</b></span></div>
      <blockquote lang="en">${h(sc.say.en)}</blockquote>
      <details class="wm-tr"><summary>${h(w("tr_show"))}</summary><p lang="fr">${h(sc.say.fr)}</p></details>
      <p class="wm-q-h">${h(sc.q.en)}</p>
      <div class="wm-opts" role="group">${opts.map(id => { const o = byId(id), cls = S2.a1 ? (id === sc.answer ? "correct" : id === S2.a1 ? "wrong" : "") : ""; return `<button class="wm-opt ${cls}" data-wm="ws1" data-a="${h(id)}" ${S2.a1 ? "disabled" : ""}>${h(o ? o.en : id)}</button>`; }).join("")}</div>
      ${S2.a1 ? `<div class="wm-fb ${S2.a1 === sc.answer ? "ok" : "no"}" role="status">${wi(S2.a1 === sc.answer ? "check" : "cross")}<div><b>${h(S2.a1 === sc.answer ? w("ok") : w("no"))}</b>${S2.a1 === sc.answer ? "" : `<span>${h(w("the_answer", { w: t.en + " · " + t.fr }))}</span>`}<p lang="en">${h(sc.why.en)}</p><p lang="fr" class="fr">${h(sc.why.fr)}</p></div></div>
        <p class="wm-q-h">${h(w("w_reply"))}</p><p class="wm-mut small">${h(sc.reply.q.en)}</p>
        <div class="wm-opts col" role="group">${ropts.map(k => { const o = sc.reply.options[k], cls = S2.a2 != null ? (o.ok ? "correct" : k === S2.a2 ? "wrong" : "") : ""; return `<button class="wm-opt long ${cls}" data-wm="ws2" data-a="${k}" ${S2.a2 != null ? "disabled" : ""}>${h(o.en)}</button>`; }).join("")}</div>` : ""}
      ${S2.a2 != null ? `<div class="wm-fb ${sc.reply.options[S2.a2].ok ? "ok" : "no"}" role="status">${wi(sc.reply.options[S2.a2].ok ? "check" : "cross")}<div><b>${h(sc.reply.options[S2.a2].ok ? w("ok") : w("no"))}</b><p lang="en">${h(sc.reply.why.en)}</p><p lang="fr" class="fr">${h(sc.reply.why.fr)}</p></div></div><button class="btn btn-p wm-wide" data-wm="next" autofocus>${h(w("next"))} →</button>` : ""}
    </div>`;
  }

  /* -- Game 3: Crossword (the app's own generator, cwGen; checked before it is shown) -- */
  function cwBuild() {
    const G = _G; let layout = null;
    if (typeof cwGen === "function") {
      for (let k = 0; k < 6 && !layout; k++) {
        const words = E.shuffle(G.ids, G.seed + k).map(id => byId(id).en.toLowerCase());
        const L = cwGen(words);
        if (E.gridValid(L)) layout = L;
      }
    }
    if (!layout) { gameOpen("crossword", `<div class="wm-g-msg"><p>${h(w("cw_fail"))}</p><div class="wm-row center"><button class="btn btn-g" data-wm="again">${h(w("end_again"))}</button><button class="btn btn-p" data-wm="gclose">${h(w("close"))}</button></div></div>`); return; }
    const idOf = {}; G.ids.forEach(id => idOf[byId(id).en.toLowerCase()] = id);
    layout.placed.forEach(p => p.id = idOf[p.word]);
    G.ids = layout.placed.map(p => p.id); G.cw = layout; G.cwGraded = {};
    cwDraw();
  }
  function cwDraw() {
    const G = _G, { placed, rows, cols } = G.cw, cell = {}, numAt = {};
    placed.forEach(p => { numAt[p.r + "," + p.c] = p.num; for (let i = 0; i < p.word.length; i++) { const rr = p.dir === "a" ? p.r : p.r + i, cc = p.dir === "a" ? p.c + i : p.c; cell[rr + "," + cc] = true; } });
    let g = ""; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const k = r + "," + c; g += cell[k] ? `<div class="cw-cell">${numAt[k] ? `<span class="cw-num">${numAt[k]}</span>` : ""}<input maxlength="1" data-k="${k}" aria-label="${r + 1}-${c + 1}"></div>` : `<div class="cw-cell empty"></div>`; }
    const clue = dir => placed.filter(p => p.dir === dir).sort((a, b) => a.num - b.num).map(p => { const t = byId(p.id); return `<li value="${p.num}"><span lang="en">${h(blank(t.def.en, t))}</span> <small>(${p.word.length})</small>${t.def.fr ? `<br><small class="fr" lang="fr">${h(blank(t.def.fr, Object.assign({}, t, { en: t.fr, syn: t.frSyn })))}</small>` : ""}</li>`; }).join("");
    gameOpen("crossword", `<div class="cw-wrap wm-cw"><div class="cw-grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${g}</div>
      <div class="cw-clues"><div><b>${h(w("cw_across"))}</b><ol>${clue("a")}</ol></div><div><b>${h(w("cw_down"))}</b><ol>${clue("d")}</ol></div></div></div>
      <div class="wm-row center"><button class="btn btn-g" data-wm="cwreveal">${h(w("cw_reveal"))}</button><button class="btn btn-p" data-wm="cwcheck">${h(w("check"))}</button><button class="btn btn-g" data-wm="cwfinish">${h(w("cw_finish"))}</button></div>
      <p id="wmCwMsg" class="wm-mut center" role="status"></p>`);
    const ins = [...document.querySelectorAll("#wmGame .cw-cell input")];
    ins.forEach((inp, i) => inp.addEventListener("input", () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1); if (inp.value && ins[i + 1]) ins[i + 1].focus(); }));
  }
  function cwWordOk(p) { for (let i = 0; i < p.word.length; i++) { const rr = p.dir === "a" ? p.r : p.r + i, cc = p.dir === "a" ? p.c + i : p.c, inp = document.querySelector(`#wmGame .cw-cell input[data-k="${rr},${cc}"]`); if (!inp || inp.value.toLowerCase() !== p.word[i]) return false; } return true; }
  function cwCheck() {
    const G = _G; let solved = 0;
    document.querySelectorAll("#wmGame .cw-cell input").forEach(inp => { const v = inp.value.toLowerCase(), k = inp.dataset.k; const want = G.cw.sol[k]; inp.classList.toggle("bad", !!v && v !== want); });
    G.cw.placed.forEach(p => { if (cwWordOk(p)) { solved++; if (!G.cwGraded[p.id]) { G.cwGraded[p.id] = 1; answer(p.id, 2, "spelling", { k: "cw" }); } } });
    const all = solved === G.cw.placed.length, msg = document.getElementById("wmCwMsg");
    if (msg) msg.textContent = all ? w("cw_solved") : w("cw_progress", { s: solved, n: G.cw.placed.length });
    if (all) setTimeout(finish, 900);
  }
  /* revealing is honest: a word revealed before it was solved counts as not known */
  function cwReveal() {
    const G = _G;
    G.cw.placed.forEach(p => { if (!G.cwGraded[p.id] && !cwWordOk(p)) { G.cwGraded[p.id] = 1; answer(p.id, 0, "spelling", { k: "cw", p: "revealed" }); } });
    document.querySelectorAll("#wmGame .cw-cell input").forEach(inp => { inp.value = (G.cw.sol[inp.dataset.k] || "").toUpperCase(); inp.classList.remove("bad"); });
  }

  /* ------------------------------------------------------------ one click handler */
  function act(a, arg, btn) {
    const s = st(); if (!s && a !== "nav") return;
    const G = _G;
    switch (a) {
      case "nav":
        if (arg === "practice") { try { _libGroup = "vocabulary"; _libTab = "vocab"; } catch (e) {} }
        if (document.getElementById("wmGame") && document.getElementById("wmGame").classList.contains("show")) gameClose();
        sheetClose(); go(arg); return;
      case "open": go("mastery", "games"); setTimeout(() => start(arg), 60); return;
      case "retry": _err = false; redraw(); return;
      case "tab": _tab = arg; render(document.getElementById("v-mastery")); try { jumpTop(); } catch (e) {} return;
      case "settings": return settingsOpen();
      case "sheetclose": return sheetClose();
      case "set": { const [k, v] = arg.split(":"); if (k === "sound") s.set.sound = v === "1"; else s.set[k] = v; persist(); document.documentElement.classList.toggle("wm-still", reduced()); settingsOpen(); redraw(); return; }
      case "mission": return startMission();
      case "hseg": _histSeg = arg; return redraw();
      case "practerr": return start("cards", { ids: String(arg).split(",").filter(Boolean), keepOrder: true, n: 20 });
      case "resume": { const r = resumeValid(s); if (r) start(r.mode, { resume: r }); return; }
      case "play": return start(arg);
      case "stage": return start("cards", { cat: arg });
      case "stagetest": return start("quiz", { cat: arg, n: 10 });
      case "practise": return start("cards", { ids: collList().slice(0, 20).map(t => t.id), keepOrder: true, n: 20 });
      case "tab_coll": return;
      case "seg": _coll.seg = arg; _edit = null; return redraw();
      case "cat": _coll.cat = arg; return redraw();
      case "dir": s.set.first = first() === "fr" ? "en" : "fr"; persist(); return redraw();
      case "word": return wordSheet(arg);
      case "fav": { E.setFav(s, arg, !E.isFav(s, arg), Date.now()); persist(); const sh = document.getElementById("wmSheet"); if (sh) wordSheet(arg); if (G) draw(); else redraw(); return; }
      case "hard": { const r = s.t[arg]; E.setHard(s, arg, !(r && r.hard)); persist(); const sh = document.getElementById("wmSheet"); if (sh) wordSheet(arg); if (G) draw(); else redraw(); return; }
      case "savelist": { const t = byId(arg); if (t) { try { vocPut(t.en.toLowerCase(), /^[ABC][12]$/.test(t.lvl) ? t.lvl : "B1"); save(); toast(t.en + " ✓"); } catch (e) {} } if (document.getElementById("wmSheet")) wordSheet(arg); else if (G) draw(); return; }
      case "say": return say(arg);
      case "sayslow": return say(arg, 0.7);
      case "myedit": _edit = arg; return redraw();
      case "mycancel": _edit = null; return redraw();
      case "mydel": { const m = s.mine[arg]; if (!m) return; sheet(`<p>${h(w("my_del_q", { w: m.en }))}</p><div class="wm-row"><button class="btn btn-p" data-wm="mydelok" data-a="${h(arg)}">${h(w("del_conf"))}</button><button class="btn btn-g" data-wm="sheetclose">${h(w("cancel"))}</button></div>`); return; }
      case "mydelok": E.delMine(s, arg, Date.now()); persist(); sheetClose(); toast(w("my_deleted")); _edit = null; return redraw();
      case "savedtab": _pracTab = arg; return redraw();
      case "savedadd": try { pracAdd(); } catch (e) {} return redraw();
      /* in a game */
      case "gclose": return gameClose();
      case "again": { const m = G && G.mode, o = G && G.opts; gameClose(); if (m) start(m, o && !o.resume ? o : {}); return; }
      case "next": return G && G.mode === "match" ? null : nextItem();
      case "gdir": s.set.first = first() === "fr" ? "en" : "fr"; persist(); return draw();
      case "flip": G.st.flipped = true; return draw();
      case "rate": { if (G.st.rated) return; G.st.rated = 1; answer(G.ids[G.i], +arg, "recall", { k: "card" }); return nextItem(); }
      case "qpick": { if (G.st.ans) return; G.st.ans = arg; const t = byId(G.ids[G.i]); answer(t.id, arg === t.id ? 2 : 0, G.st.q.skill, { k: G.st.q.type, p: arg === t.id ? "" : arg }); return draw(); }
      case "vpick": { if (G.st.ans) return; G.st.ans = arg; const t = byId(G.ids[G.i]); answer(t.id, arg === t.id ? 2 : 0, "visual", { k: "img", p: arg === t.id ? "" : arg }); return draw(); }
      case "lpick": { if (G.st.ans) return; G.st.ans = arg; const t = byId(G.ids[G.i]); answer(t.id, arg === t.id ? (G.st.hint ? 1 : 2) : 0, "listening", { hint: G.st.hint, k: "listen", p: arg === t.id ? "" : arg }); return draw(); }
      case "lhint": G.st.hint = 1; return draw();
      case "tile": { const S2 = G.st, i = +arg; if (S2.ans || S2.tiles[i].used) return; S2.tiles[i].used = true; S2.picked.push(i); S2.msg = ""; return builderTry(); }
      case "bback": { const S2 = G.st; if (S2.picked.length > S2.hint) { const p = S2.picked.pop(); S2.tiles[p].used = false; } return draw(); }
      case "bclear": builderApplyHint(); return draw();
      case "bhint": { const S2 = G.st; S2.hint++; builderApplyHint(); return draw(); }
      case "mleft": return matchPick("l", arg);
      case "mright": return matchPick("r", arg);
      case "ws1": { if (G.st.a1) return; G.st.a1 = arg; const sc = C.workshop.find(x => x.id === G.ids[G.i]); answer(sc.answer, arg === sc.answer ? 2 : 0, "context", { k: "ws", s: sc.id, p: arg === sc.answer ? "" : arg }); return draw(); }
      case "ws2": { if (G.st.a2 != null) return; G.st.a2 = +arg; const sc = C.workshop.find(x => x.id === G.ids[G.i]); const rok = !!sc.reply.options[+arg].ok; if (rok) tone("ok"); else tone("no"); G.log.push({ s: sc.id, ok: rok, k: "reply", p: String(+arg) }); saveResume(); persist(); return draw(); }
      case "cwcheck": return cwCheck();
      case "cwreveal": return cwReveal();
      case "cwfinish": return finish();
    }
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-wm]");
    if (!b || b.disabled) return;
    if (!b.closest("#v-mastery,#wmGame,#wmSheet,.wm-portal,.wm-perf-card")) return;
    e.preventDefault();
    try { act(b.dataset.wm, b.dataset.a, b); } catch (err) { try { console.error("[wm]", err); } catch (_) {} }
  });
  document.addEventListener("submit", e => {
    if (e.target && e.target.id === "wmMyForm") {
      e.preventDefault();
      const s = st(); if (!s) return;
      const id = e.target.dataset.id || undefined;
      const r = E.addMine(s, { id, en: document.getElementById("wmMyEn").value, fr: document.getElementById("wmMyFr").value, def: document.getElementById("wmMyDef").value, ex: document.getElementById("wmMyEx").value }, Date.now(), official());
      if (r.error) { const er = document.getElementById("wmMyErr"); if (er) er.textContent = w("my_e_" + r.error); return; }
      /* a one-word entry also joins the saved list, so Quick Practice can drill it */
      const en = s.mine[r.id].en.toLowerCase();
      if (!id && /^[a-z'-]+$/.test(en)) { try { if (!vocHas(en)) vocPut(en, cefr(en) || "B1"); } catch (err) {} }
      persist(); _edit = null; toast(w(id ? "my_saved" : "my_added")); redraw();
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { if (document.getElementById("wmSheet")) return sheetClose(); const ov = document.getElementById("wmGame"); if (ov && ov.classList.contains("show")) gameClose(); }
  });

  /* ------------------------------------------------------------ Home, recommendations, widget
     Everything here is read from the learner's own record without the corpus
     (Home is often the first page drawn), so nothing waits on a download. */
  const LOGO_URL = "welding-mastery-logo.svg";
  function todayShift(s) { const m = s.mis; return m && m.day === E.dayOf(Date.now()) ? m : null; }
  function signals() {
    const s = st(); if (!s) return null;
    const now = Date.now(), m = todayShift(s);
    const perf = E.performance(s, [], now), rec = E.recommend(perf);
    const untried = E.MODES.filter(k => !(s.modes[k] && s.modes[k].runs) && k !== rec.mode && k !== "crossword");
    return { shift: m ? { kind: m.kind, prog: m.prog, target: m.target, done: !!m.done } : { kind: "start5", prog: 0, target: 5, done: false, fresh: true },
      mode: rec.mode, why: rec.kind, strong: rec.strong ? w("skill_" + rec.strong).toLowerCase() : "", weak: rec.weak ? w("skill_" + rec.weak).toLowerCase() : "",
      due: E.dueCount(s, now), mastered: masteredCount(s), untried: untried.slice(0, 2) };
  }
  /* a shift that has not been chosen today yet is the starter until the hub opens */
  function shiftName(kind) { return w("m_" + (kind || "start5")); }
  function heroText(r) {
    const v = r.vars || {};
    if (r.act === "shift") return { title: w("r_shift_t", { m: shiftName(v.kind) }), body: w("r_shift_b", { p: v.prog || 0, n: v.target || 5 }), cta: w("r_cta"), meta: w("r_kicker") };
    return { title: w("r_due_t", { n: v.n || 0 }), body: w("r_due_b"), cta: w("r_cta"), meta: w("r_kicker") };
  }
  function rowHead(r) { const v = r.vars || {}; return { h: w("row_h"), s: w("row_s_" + (r.variant || "keep"), v) }; }
  function itemTitle(it) { return it.act === "shift" ? shiftName((todayShift(st() || {}) || {}).kind) : w("g_" + it.act); }
  function itemLine(it) { return it.act === "shift" ? w("it_shift") : w("g_" + it.act + "_d"); }
  function exploreTile() {
    const s = st(); if (!s) return null;
    const m = todayShift(s);
    return { ic: "trophy", t: w("title"), s: m ? (m.done ? w("explore_done", { m: masteredCount(s) }) : w("explore_shift", { p: m.prog, n: m.target })) : w("explore_s"), go: "go('mastery')", img: LOGO_URL, art: 0 };
  }
  /* a recommendation, a widget tap or a Home card asked for a game: open the hub on it */
  function play(act) {
    if (!on()) return false;
    try { go("mastery", act === "shift" ? "home" : "games"); } catch (e) { return false; }
    const run = () => { if (act === "shift") { E.ensureMission(st(), official(), Date.now()); persist(); startMission(); } else if (E.MODES.includes(act)) start(act); };
    loadCorpus().then(() => setTimeout(run, 120)).catch(() => {});
    return true;
  }
  /* the widget's own block (≤ ~600 bytes): words mastered, level, XP, streak, today's shift */
  function widgetData() {
    const s = st(); if (!s) return null;
    const now = Date.now(), lv = E.level(E.xpTotal(s)), sk = E.streak(s, now), m = todayShift(s), sig = signals();
    return { m: masteredCount(s), total: TOTAL, lvl: lv.level, xp: lv.xp, need: lv.need, pct: lv.pct, streak: sk.current,
      shift: m ? { t: shiftName(m.kind), p: m.prog, n: m.target, done: !!m.done } : { t: shiftName("start5"), p: 0, n: 5, done: false },
      next: sig ? w("g_" + sig.mode) : "",
      labels: { title: w("w_title"), mastered: w("w_mastered"), level: w("w_level", { n: lv.level }), xp: w("w_xp"), streak: w("w_streak"), shift: w("w_shift"), done: w("w_done"), open: w("w_open"), empty: w("w_empty") } };
  }

  window.WMUI = {
    signals, heroText, rowHead, itemTitle, itemLine, exploreTile, play, widgetData, LOGO_URL,
    on, render, portalInto, perfCardHTML, quickH: () => w("quick_h"), quickSub: () => w("quick_sub"),
    /* test hooks: the corpus, the learner's record and a way to start a game */
    _state: st, _corpus: () => C, _load: loadCorpus, _start: start, _game: () => _G, _act: act
  };
})();
