/* ============================================================================
   BE Mastery — English Mastery (the game hub of the General English programme)
   --------------------------------------------------------------------------
   Built 10 Oct 2026 on the Welding Mastery hub (welding-mastery.js), which it
   mirrors screen for screen: Home / Games / Journey / Collection / Rewards /
   History / Performance, the daily mission, the weekly goal, skill badges,
   energy and XP from the server. Its own content, games and wording:

     content   tracks/general/mastery.json, BUILT from the 12-week curriculum
               (scripts/english-mastery/build.mjs): Foundations sentences, the
               plan's phrases, idioms and mission expressions, the grammar
               exercises, the competency missions — plus 150 everyday words.
     games     Word Quest · Quick Quiz · Sentence Builder · Listen & Win ·
               Speak Up · Phrase Match · Word Puzzle · Real-Life Missions
     rules     window.EMEngine = WMEngine.make(EM) (welding-mastery-engine.js)

   GENERAL ENGLISH ONLY. on() is the one gate (flag english_mastery_enabled AND
   isGeneralEnglish()); every write goes to S.wm["general-english"]; the server
   (backend/wm-game.js, prog "general-english") refuses any account whose
   programme is not General English, whatever this page says. Welding Mastery
   is a separate file and is not touched by this one.

   AI is always labelled AI: the coach in Real-Life Missions (metered verdicts),
   the pronunciation score in Speak Up (metered), and the translation of a card
   into the learner's language (machine translation, cached on the device).
   ============================================================================ */
(function () {
  "use strict";
  const E = window.EMEngine;
  const AREA = "general-english", PROG = "general-english";
  let TOTAL = 385;   /* the corpus answers the real number once it is loaded */
  const CORPUS_URL = "tracks/general/mastery.json?v=1", ART3D_URL = "tracks/general/mastery-art3d.json?v=1";
  let C = null, ART3D = {}, _load = null, _err = false;
  let _tab = "home", _coll = { q: "", cat: "all", seg: "all" }, _edit = null, _G = null;

  /* ------------------------------------------------------------ the gate */
  function on() { try { return flag("english_mastery_enabled") && areaId() === AREA; } catch (e) { return false; } }
  function st() {
    if (!on()) return null;
    S.wm = S.wm && typeof S.wm === "object" ? S.wm : {};
    return (S.wm[AREA] = E.normalize(S.wm[AREA]));
  }
  function persist() { try { E.pruneEvents(st(), Date.now()); } catch (e) {} try { save(); } catch (e) {} }

  /* ------------------------------------------------------------ wording
     English, and French for a francophone learner (the app's largest group);
     every other app language reads the English, and the CONTENT can be
     translated into it on demand (machine translation, labelled). */
  const TX = {
    en: {
      title: "English Mastery", sub: "Speak everyday and workplace English with confidence.", motto: "Learn. Play. Listen. Speak.",
      enter: "Enter English Mastery", back: "‹ Practice", loading: "Loading your games…", load_fail: "The lessons could not be loaded. Check your connection and try again.", retry: "Try again",
      off: "English Mastery is part of the General English programme.", off_btn: "Back to Practice",
      t_home: "Home", t_games: "Games", t_journey: "Journey", t_coll: "Collection", t_rewards: "Rewards", t_hist: "History", t_perf: "Performance", t_perf_s: "Stats",
      mastered_of: "{{n}} of {{total}} mastered", level: "Level {{n}}", xp: "{{n}} XP", streak_d: "{{n}}-day streak", streak_0: "No streak yet",
      rest_used: "A rest day kept your streak going.", xp_next: "{{n}} XP to level {{l}}",
      shift_h: "Today's goal", shift_done: "Goal complete — well done.", shift_new: "A new goal is waiting for you.", start: "Start", go_on: "Continue",
      m_start5: "Learn five new words or phrases", m_start5_d: "Five Word Quest cards, about three minutes.",
      m_hard5: "Review five difficult ones", m_hard5_d: "The ones that tripped you up before.",
      m_due5: "Review five that are due", m_due5_d: "Spaced repetition: they come back right on time.",
      m_listen1: "Complete one Listen & Win round", m_listen1_d: "Hear it, find it.",
      m_speak3: "Say three phrases clearly", m_speak3_d: "Speak Up: hear it, say it, see how close you were.",
      m_sentence3: "Build three sentences without a hint", m_sentence3_d: "Sentence Builder: put the words in order.",
      m_missions1: "Complete one Real-Life Mission round", m_missions1_d: "Choose what a confident speaker would say.",
      cont_h: "Continue learning", cont_resume: "Resume your {{game}} round — {{i}} of {{n}}", cont_rec: "Recommended: {{game}}",
      recent_h: "Recently practised", recent_0: "What you practise will appear here.", journey_link: "See your journey",
      first_h: "Welcome to English Mastery", first_b: "{{total}} words, phrases and sentences from your 12-week plan and from everyday life, eight games, one goal: speak with confidence. Start with five.",
      g_cards: "Word Quest", g_cards_d: "Cards with meaning, example and sound", g_quiz: "Quick Quiz", g_quiz_d: "Words, grammar and natural English",
      g_sentence: "Sentence Builder", g_sentence_d: "Put the words in order", g_listen: "Listen & Win", g_listen_d: "Hear it, then find it",
      g_speak: "Speak Up", g_speak_d: "Say it and see how close you were", g_match: "Phrase Match", g_match_d: "Link phrases with their meaning",
      g_puzzle: "Word Puzzle", g_puzzle_d: "Spell the word from its meaning", g_missions: "Real-Life Missions", g_missions_d: "Choose what to say in real situations",
      best: "Best {{n}}%", runs: "{{n}} rounds", play: "Play",
      skill_recognition: "Recognition", skill_recall: "Recall", skill_grammar: "Grammar", skill_listening: "Listening", skill_speaking: "Speaking", skill_spelling: "Spelling", skill_context: "Real situations",
      j_h: "Your journey", j_sub: "Thirteen stages: first steps, five everyday topics, the six blocks of your 12-week plan, and business idioms. Nothing is locked.",
      j_words: "{{n}} items", j_mastered: "{{m}} mastered", j_done: "Complete", j_prog: "In progress", j_new: "Not started", j_learn: "Learn", j_test: "Stage challenge", j_test_lock: "Stage challenge — after 10 practised",
      c_search: "Search a word or phrase", c_all: "All", c_fav: "Favourites", c_hard: "Difficult", c_mastered: "Mastered", c_mine: "My words",
      c_cat_all: "All stages", c_practise: "Practise these ({{n}})", c_empty: "Nothing here yet.", c_empty_fav: "Tap the star on any card to keep it here.", c_empty_hard: "What you find difficult, or miss twice, gathers here.", c_empty_m: "Something is mastered after correct answers on three different days, one of them from memory or out loud.",
      my_h: "Add a word of your own", my_en: "English word or phrase", my_fr: "Translation (optional)", my_def: "What it means (optional)", my_ex: "Example sentence (optional)", my_add: "Add word", my_save: "Save changes", my_cancel: "Cancel", my_edit: "Edit", my_del: "Delete",
      my_del_q: "Delete “{{w}}”?", my_e_empty: "Write the English first.", my_e_duplicate: "That is already in your list.", my_e_official: "That is already in English Mastery — find it in All and tap the star.", my_e_full: "Your list is full (200 words).",
      my_added: "Added to your words.", my_saved: "Saved.", my_deleted: "Deleted.", my_list: "Your words", my_0: "No words of your own yet.",
      r_level_h: "Your level", r_thresh: "Levels open at 100, 300, 600, 1,000 XP… XP rewards practice; mastery is earned separately, item by item.",
      r_ach_h: "Achievements", r_earned: "Earned {{d}}", r_locked: "Not yet",
      ach_first_practice: "First practice", ach_first_practice_d: "Answer your first question.",
      ach_first_mastered: "First one mastered", ach_first_mastered_d: "Master one word or phrase.",
      ach_mastered_10: "10 mastered", ach_mastered_10_d: "Master ten.",
      ach_first_speak: "First words out loud", ach_first_speak_d: "Complete a Speak Up round.",
      ach_first_mission: "Real-life ready", ach_first_mission_d: "Complete a Real-Life Missions round.",
      ach_first_stage: "First stage complete", ach_first_stage_d: "Master everything in one stage.",
      ach_idioms_all: "Idiom expert", ach_idioms_all_d: "Master all 36 business idioms.",
      ach_mastered_50: "50 mastered", ach_mastered_50_d: "Master fifty.",
      ach_mastered_100: "100 mastered", ach_mastered_100_d: "Master a hundred.",
      ach_mastered_all: "English Master", ach_mastered_all_d: "Master everything in English Mastery.",
      p_h: "Game Performance", p_sub: "English Mastery — what your games show, measured from your own answers.",
      p_mastered: "Mastered", p_xp: "XP earned", p_days: "Active days (7 days)", p_acc: "Accuracy (30 days)", p_acc_na: "after 10 answers",
      p_xp14: "XP over the last 14 days", p_skills: "Skills", p_skill_na: "Not enough answers yet ({{n}} of 10)", p_modes: "By game", p_cats: "By stage",
      p_improved: "Recent improvements", p_impr_skill: "{{skill}}: {{from}}% → {{to}}%", p_new_m: "Mastered this week: {{w}}", p_none: "Nothing to compare yet — keep playing for a week.",
      p_hard: "To review", p_rec: "Next step", p_empty: "No games played yet. Start with Word Quest: five cards, about three minutes.", p_open: "Open English Mastery", p_go_progress: "See it on the Progress page",
      rec_first: "Start with Word Quest: five cards, about three minutes.", rec_gap: "Your {{strong}} is strong, but {{weak}} needs more practice.", rec_due: "{{n}} are due for review.", rec_difficult: "{{n}} need another look.", rec_try: "You have not tried {{skill}} yet.", rec_keep: "Keep it fresh with a quick quiz.",
      set_h: "Settings", set_sound: "Sound effects", set_motion: "Reduce motion", set_close: "Close", on: "On", off_: "Off",
      close: "Close", next: "Next", check: "Check", reveal: "Show the meaning", hear: "Hear it", hear_ex: "Hear the example", slow: "Slowly", replay: "Replay", skip: "Skip",
      again: "Again", hard: "Hard", good: "Good", easy: "Easy", rate_q: "How well did you know it?",
      fav: "Favourite", unfav: "Remove from favourites", mark_hard: "Mark as difficult", unmark_hard: "Not difficult", save_list: "Save to my words", saved_list: "Saved",
      f_def: "Meaning", f_use: "When to use it", f_ex: "Example", f_syn: "Also", f_gl: "In your language", f_gl_pack: "Translation from the Foundations course.",
      ok: "Correct", no: "Not quite", the_answer: "The answer: {{w}}", combo: "{{n}} in a row",
      q_def: "Which one means this?", q_ex: "Which one completes the sentence?", q_use: "Which phrase would you use to…", q_gram: "Choose the correct English.", q_sent: "Which sentence did you hear?",
      gl_btn: "Translate (AI)", gl_busy: "Translating…", gl_ai: "Machine translation by AI — it may contain mistakes.", gl_none: "Translation needs a connection and a signed-in account.", gl_en: "Your app is in English, so there is nothing to translate.",
      l_prompt: "Listen and find it.", l_type: "Listen and type the word.", l_sent: "Listen to the sentence and find it.", l_synth: "Synthetic voice (text-to-speech).", l_speed: "Speed {{n}}× — it gets a little faster as you go.", l_hint: "Hint", l_hint_txt: "Starts with “{{c}}” · {{d}}", l_no_audio: "Audio is not available on this device, so this round cannot run. Try Word Quest or Sentence Builder instead.", l_type_ph: "Type what you heard",
      b_prompt: "Spell the word.", b_hint: "Show a letter", b_clear: "Clear", b_type_ph: "Or type it", b_try: "Not yet — try again.",
      s_prompt: "Put the words in order.", s_fix: "Find the correct sentence.", s_hint: "Place the next word", s_undo: "Undo", s_try: "Not quite — look at the order again.", s_ok_order: "Correct order:",
      sp_prompt: "Hear it, then say it out loud.", sp_rec: "Record", sp_stop: "Stop", sp_busy: "Listening to your take…", sp_heard: "We heard:", sp_score: "{{p}}% of the words", sp_play: "Play my take",
      sp_again: "Say it again", sp_ai: "Pronunciation score (AI)", sp_ai_busy: "Scoring…", sp_ai_res: "Pronunciation (AI): {{p}}%", sp_ai_meter: "Uses one AI verdict (Free 3 a day, Premium 120).", sp_ai_off: "The AI score is not available right now — your word score still counts.",
      sp_mic: "The microphone is not available. Allow it in your settings, or skip this one — skipping costs nothing.", sp_empty: "We could not hear that clearly. Try again — nothing was counted.", sp_tx_off: "Speak Up needs a connection to hear you. Nothing was counted.",
      m_prompt: "Tap a phrase, then its partner.", m_def: "Phrase ↔ meaning", m_ex: "Phrase ↔ example", m_use: "Phrase ↔ when to use it", m_wrong: "Not a pair.",
      mi_q: "What would a confident speaker say?", mi_say: "Now say it out loud", mi_own: "Or answer in your own words", mi_partner: "Practise this with a real person — Practice Partner", mi_shadow: "Watch it in Shadow Studio: “{{t}}”", mi_goal: "Your goal:", mi_ctx: "Background:",
      cw_fail: "These words would not make a valid grid. Try again for a new set.",
      end_h: "Round complete", end_score: "{{ok}} of {{n}} correct", end_xp: "+{{n}} XP", end_xp0: "No new XP — these answers were already counted today.", end_mastered: "Mastered: {{w}}", end_again: "Play again", end_hub: "Back to the hub",
      cel_mastered: "Mastered", cel_stage: "Stage complete", cel_final: "Everything mastered", cel_ach: "Achievement unlocked",
      none_words: "Nothing available for this game yet.", del_conf: "Delete", cancel: "Cancel",
      h_sub: "Every round you have played, with every answer. Nothing is lost: it is saved with your progress, and on your account when you are signed in.",
      h_rounds: "Rounds", h_errors: "Errors", h_0: "Your rounds will appear here after your first game.", h_err0: "No errors yet — or no rounds yet.",
      h_day: "{{n}} rounds · {{ok}} of {{a}} correct · +{{xp}} XP", h_day1: "1 round · {{ok}} of {{a}} correct · +{{xp}} XP", h_round: "{{ok}}/{{n}} correct · +{{xp}} XP", h_part: "left part-way", h_sum: "Older round — the summary is kept, the single answers are not.",
      h_chose: "You chose: {{p}}", h_typed: "You wrote: {{p}}", h_said: "You said: {{p}}", h_rated: "You rated it: {{p}}", h_ans: "Answer: {{a}}", h_hint: "hint used", h_reply: "Your reply", h_revealed: "revealed",
      h_err_stage: "{{n}} items · {{o}} still to fix", h_times: "wrong {{n}}×", h_last: "last {{d}}", h_instead: "you chose instead: {{p}}",
      h_open: "To fix", h_fixed: "Right since", h_mastered: "Mastered since", h_practise_err: "Practise these errors ({{n}})",
      h_stage: "Your history in this stage", h_stage_n: "{{a}} answers · {{ok}} correct", h_stage_0: "Nothing played in this stage yet.", h_link: "See your full history",
      au_h: "Sign in to play", au_b: "Your XP, energy, streak and badges are saved on your account, so they follow you to any phone. Browsing everything stays open without an account.", au_btn: "Sign in or create an account", au_short: "Sign in to play and save your XP.",
      en_out_h: "Today's energy is used up", en_out_b: "Your 5 challenge rounds are done for today. Energy refills in {{h}} h {{m}} min (midnight UTC).", en_out_s: "Word Quest, the daily mission and every card stay open.",
      en_keep1: "Word Quest keeps working — it never costs energy.", en_keep2: "Every word, phrase, meaning and example stays open.", en_keep3: "Wrong answers never cost energy: a round costs one unit when it starts, that is all.",
      en_cards: "Review with Word Quest", en_prem: "Unlimited rounds with Premium", en_check: "Checking today's energy…", en_open: "Opening the round…",
      en_unl: "Premium: unlimited rounds", en_left: "{{n}} of {{g}} energy left today", en_note_p: "Premium: every game, as often as you like.", en_note_f: "Free: {{n}} of 5 challenge rounds left today. Word Quest and the daily mission are free.", en_cost: "Costs 1 energy", en_free: "Free",
      trk_h: "Your account is on another programme", trk_b: "English Mastery is part of General English. Your saved account is on a different programme — switch to General English in the app, let it sync, then try again.",
      off_h: "No connection", off_b: "Challenges need a connection so your energy and XP are counted correctly — nothing was charged. Word Quest works offline.",
      pr_h: "English Mastery Premium", pr_b: "The same subscription as the rest of BE Mastery. Free keeps everything and all eight games.", pr_1: "Unlimited challenge rounds every day", pr_2: "20 advanced situations (negotiation, feedback, difficult questions)", pr_3: "30- and 90-day trends for every skill", pr_4: "More AI coaching: 120 verdicts a day instead of 3", pr_btn: "See Premium", pr_soon: "Premium is not on sale yet.",
      dc_h: "Daily English Mission", dc_t: "Today's English mission", dc_sub: "8 questions from every stage · free · +30 XP bonus", dc_done_h: "Daily mission complete!", dc_next: "A new mission in {{h}} h {{m}} min", dc_play: "Daily mission", dc_bonus: "+{{n}} daily bonus",
      wk_h: "Weekly goal", wk_b: "{{n}} of {{g}} practice days", wk_done: "Goal reached",
      ng_h: "Your next goal", ng_daily: "Finish today's daily mission (+30 XP)", ng_week: "Practise on {{n}} more day(s) this week to reach your weekly goal", ng_badge: "{{n}} more {{skill}} answers at {{acc}}% for the {{tier}} badge",
      bd_h: "Skill badges", bd_sub: "Earned from real answers: enough of them, and accurate enough.", bd_t0: "Not yet", bd_t1: "Bronze", bd_t2: "Silver", bd_t3: "Gold", bd_next: "{{n}} more answers at {{acc}}% for {{tier}}", bd_max: "Top badge earned", bd_new: "{{tier}} badge: {{skill}}", bd_new_h: "New skill badge",
      end_offline: "Played offline — review only, no XP.", end_saving: "Saving your XP…", end_pending: "XP will be saved as soon as you are back online.", end_xp_dup: "Already counted — no extra XP.",
      g_daily: "Daily English Mission", g_daily_d: "Eight questions from every stage", g_advanced: "Advanced situations", g_advanced_d: "Negotiation, feedback and hard questions — with the AI coach",
      adv_fail_h: "Advanced situations unavailable", adv_fail_b: "The advanced situations could not be loaded. Try again in a moment.",
      co_task: "Answer {{who}} in your own words.", co_h: "Your turn — AI coach", co_v_good: "Well said", co_v_almost: "Nearly there", co_v_retry: "Try it another way", co_ai: "Feedback by AI. It is a coach, not a person.",
      co_ph: "Write what you would say…", co_busy: "The coach is reading…", co_btn: "Ask the AI coach", co_off: "The AI coach needs a connection and today's AI allowance.", co_meter: "Uses one AI coaching verdict (Free 3 a day, Premium 120).", co_short: "Write a full sentence or two first.", co_spent: "Today's AI coaching is used up. It comes back at midnight UTC — Premium gives 120 a day.", co_fail: "The coach could not answer just now. Try again.",
      tr_h: "Trends", tr_days: "{{n}} days", tr_act: "Answers per day ({{n}} days)", tr_acc: "Accuracy by week", tr_few: "Trends appear after two weeks with at least 10 answers.", tr_sk: "Skills by week", tr_few_s: "Not enough yet", tr_empty: "Play a few rounds and your trends will appear here.", tr_lock: "Trends are part of Premium.",
      loop_h: "Your learning loop", loop_b: "Learn → Play → Listen → Speak → Feedback → Practise with a person.", loop_pp: "Practise with a partner", loop_sh: "Shadow a real video",
      r_kicker: "English Mastery", r_shift_t: "Today's goal: {{m}}", r_shift_b: "{{p}} of {{n}} done · about five minutes in the game hub.", r_due_t: "{{n}} are due in English Mastery", r_due_b: "A short Word Quest round brings them back right on time.", r_cta: "Play now",
      row_h: "English Mastery — your games", row_s_first: "Start with five cards, about three minutes.", row_s_gap: "Your {{strong}} is strong; {{weak}} needs practice.", row_s_due: "{{n}} are due for review.", row_s_difficult: "Some need another look.", row_s_try: "A game you have not tried yet is waiting.", row_s_keep: "Keep your English fresh.",
      it_shift: "Today's goal", explore_s: "{{total}} words and phrases, eight games", explore_shift: "Today's goal: {{p}}/{{n}}", explore_done: "Goal done · {{m}} mastered",
      w_title: "English Mastery", w_mastered: "mastered", w_level: "Level {{n}}", w_xp: "XP", w_streak: "day streak", w_shift: "Today's goal", w_done: "Goal complete", w_open: "Play", w_empty: "Open English Mastery in BE Mastery to start.",
      k_def: "Meaning", k_ex: "Example", k_use: "When to use", k_gram: "Grammar", k_sent: "Sentence", k_card: "Card", k_listen: "Listening", k_listen_t: "Listening (typed)", k_listen_s: "Listening (sentence)", k_spell: "Spelling", k_speak: "Speaking", k_mis: "Mission", k_reply: "Reply", k_match: "Match", k_coach: "AI coach"
    },
    fr: {
      title: "English Mastery", sub: "Parle l'anglais du quotidien et du travail avec assurance.", motto: "Apprends. Joue. Écoute. Parle.",
      enter: "Entrer dans English Mastery", back: "‹ Pratique", loading: "Chargement de tes jeux…", load_fail: "Les leçons n'ont pas pu être chargées. Vérifie ta connexion et réessaie.", retry: "Réessayer",
      off: "English Mastery fait partie du programme General English.", off_btn: "Retour à la pratique",
      t_home: "Accueil", t_games: "Jeux", t_journey: "Parcours", t_coll: "Collection", t_rewards: "Récompenses", t_hist: "Historique", t_perf: "Performance", t_perf_s: "Stats",
      mastered_of: "{{n}} maîtrisés sur {{total}}", level: "Niveau {{n}}", xp: "{{n}} XP", streak_d: "Série de {{n}} jours", streak_0: "Pas encore de série",
      rest_used: "Un jour de repos a gardé ta série.", xp_next: "{{n}} XP avant le niveau {{l}}",
      shift_h: "L'objectif du jour", shift_done: "Objectif atteint — bravo.", shift_new: "Un nouvel objectif t'attend.", start: "Commencer", go_on: "Continuer",
      m_start5: "Apprendre cinq nouveaux mots ou expressions", m_start5_d: "Cinq cartes Word Quest, environ trois minutes.",
      m_hard5: "Revoir cinq éléments difficiles", m_hard5_d: "Ceux qui t'ont posé problème.",
      m_due5: "Revoir cinq éléments à réviser", m_due5_d: "Répétition espacée : ils reviennent au bon moment.",
      m_listen1: "Faire une série Listen & Win", m_listen1_d: "Écoute, puis retrouve.",
      m_speak3: "Dire trois expressions clairement", m_speak3_d: "Speak Up : écoute, dis-le, vois à quel point tu étais proche.",
      m_sentence3: "Construire trois phrases sans indice", m_sentence3_d: "Sentence Builder : remets les mots dans l'ordre.",
      m_missions1: "Faire une série Real-Life Missions", m_missions1_d: "Choisis ce que dirait quelqu'un de sûr de lui.",
      cont_h: "Continuer", cont_resume: "Reprendre ta série {{game}} — {{i}} sur {{n}}", cont_rec: "Recommandé : {{game}}",
      recent_h: "Pratiqués récemment", recent_0: "Ce que tu pratiques apparaîtra ici.", journey_link: "Voir ton parcours",
      first_h: "Bienvenue dans English Mastery", first_b: "{{total}} mots, expressions et phrases de ton programme de 12 semaines et de la vie quotidienne, huit jeux, un objectif : parler avec assurance. Commence par cinq.",
      g_cards: "Word Quest", g_cards_d: "Cartes avec sens, exemple et son", g_quiz: "Quick Quiz", g_quiz_d: "Mots, grammaire et anglais naturel",
      g_sentence: "Sentence Builder", g_sentence_d: "Remets les mots dans l'ordre", g_listen: "Listen & Win", g_listen_d: "Écoute, puis retrouve",
      g_speak: "Speak Up", g_speak_d: "Dis-le et vois à quel point tu étais proche", g_match: "Phrase Match", g_match_d: "Relie les expressions à leur sens",
      g_puzzle: "Word Puzzle", g_puzzle_d: "Écris le mot à partir de son sens", g_missions: "Real-Life Missions", g_missions_d: "Choisis quoi dire dans des situations réelles",
      best: "Meilleur {{n}} %", runs: "{{n}} séries", play: "Jouer",
      skill_recognition: "Reconnaissance", skill_recall: "Mémoire", skill_grammar: "Grammaire", skill_listening: "Écoute", skill_speaking: "Expression orale", skill_spelling: "Orthographe", skill_context: "Situations réelles",
      j_h: "Ton parcours", j_sub: "Treize étapes : premiers pas, cinq thèmes du quotidien, les six blocs de ton programme de 12 semaines et les expressions idiomatiques. Rien n'est verrouillé.",
      j_words: "{{n}} éléments", j_mastered: "{{m}} maîtrisés", j_done: "Terminé", j_prog: "En cours", j_new: "Pas commencé", j_learn: "Apprendre", j_test: "Défi d'étape", j_test_lock: "Défi d'étape — après 10 pratiqués",
      c_search: "Cherche un mot ou une expression", c_all: "Tous", c_fav: "Favoris", c_hard: "Difficiles", c_mastered: "Maîtrisés", c_mine: "Mes mots",
      c_cat_all: "Toutes les étapes", c_practise: "Pratiquer ceux-ci ({{n}})", c_empty: "Rien ici pour l'instant.", c_empty_fav: "Touche l'étoile d'une carte pour la garder ici.", c_empty_hard: "Ce qui est difficile, ou raté deux fois, se retrouve ici.", c_empty_m: "Un élément est maîtrisé après des bonnes réponses trois jours différents, dont une de mémoire ou à voix haute.",
      my_h: "Ajouter un mot à toi", my_en: "Mot ou expression en anglais", my_fr: "Traduction (facultatif)", my_def: "Ce que ça veut dire (facultatif)", my_ex: "Phrase d'exemple (facultatif)", my_add: "Ajouter", my_save: "Enregistrer", my_cancel: "Annuler", my_edit: "Modifier", my_del: "Supprimer",
      my_del_q: "Supprimer « {{w}} » ?", my_e_empty: "Écris d'abord l'anglais.", my_e_duplicate: "C'est déjà dans ta liste.", my_e_official: "C'est déjà dans English Mastery — cherche-le dans Tous et touche l'étoile.", my_e_full: "Ta liste est pleine (200 mots).",
      my_added: "Ajouté à tes mots.", my_saved: "Enregistré.", my_deleted: "Supprimé.", my_list: "Tes mots", my_0: "Pas encore de mots à toi.",
      r_level_h: "Ton niveau", r_thresh: "Les niveaux s'ouvrent à 100, 300, 600, 1 000 XP… L'XP récompense la pratique ; la maîtrise se gagne à part, élément par élément.",
      r_ach_h: "Badges", r_earned: "Obtenu le {{d}}", r_locked: "Pas encore",
      ach_first_practice: "Première pratique", ach_first_practice_d: "Réponds à ta première question.",
      ach_first_mastered: "Premier maîtrisé", ach_first_mastered_d: "Maîtrise un mot ou une expression.",
      ach_mastered_10: "10 maîtrisés", ach_mastered_10_d: "Maîtrises-en dix.",
      ach_first_speak: "Premiers mots à voix haute", ach_first_speak_d: "Termine une série Speak Up.",
      ach_first_mission: "Prêt pour la vraie vie", ach_first_mission_d: "Termine une série Real-Life Missions.",
      ach_first_stage: "Première étape terminée", ach_first_stage_d: "Maîtrise tout une étape.",
      ach_idioms_all: "Expert des expressions", ach_idioms_all_d: "Maîtrise les 36 expressions idiomatiques.",
      ach_mastered_50: "50 maîtrisés", ach_mastered_50_d: "Maîtrises-en cinquante.",
      ach_mastered_100: "100 maîtrisés", ach_mastered_100_d: "Maîtrises-en cent.",
      ach_mastered_all: "English Master", ach_mastered_all_d: "Maîtrise tout English Mastery.",
      p_h: "Performance des jeux", p_sub: "English Mastery — ce que montrent tes jeux, mesuré sur tes propres réponses.",
      p_mastered: "Maîtrisés", p_xp: "XP gagnés", p_days: "Jours actifs (7 jours)", p_acc: "Réussite (30 jours)", p_acc_na: "après 10 réponses",
      p_xp14: "XP des 14 derniers jours", p_skills: "Compétences", p_skill_na: "Pas encore assez de réponses ({{n}} sur 10)", p_modes: "Par jeu", p_cats: "Par étape",
      p_improved: "Progrès récents", p_impr_skill: "{{skill}} : {{from}} % → {{to}} %", p_new_m: "Maîtrisés cette semaine : {{w}}", p_none: "Rien à comparer pour l'instant — continue de jouer une semaine.",
      p_hard: "À revoir", p_rec: "Prochaine étape", p_empty: "Aucun jeu pour l'instant. Commence par Word Quest : cinq cartes, environ trois minutes.", p_open: "Ouvrir English Mastery", p_go_progress: "Voir sur la page Progrès",
      rec_first: "Commence par Word Quest : cinq cartes, environ trois minutes.", rec_gap: "Ta {{strong}} est solide, mais ton {{weak}} demande plus de pratique.", rec_due: "{{n}} sont à réviser.", rec_difficult: "{{n}} méritent un autre regard.", rec_try: "Tu n'as pas encore essayé : {{skill}}.", rec_keep: "Garde ton anglais frais avec un petit quiz.",
      set_h: "Paramètres", set_sound: "Effets sonores", set_motion: "Réduire les animations", set_close: "Fermer", on: "Oui", off_: "Non",
      close: "Fermer", next: "Suivant", check: "Vérifier", reveal: "Voir le sens", hear: "Écouter", hear_ex: "Écouter l'exemple", slow: "Lentement", replay: "Réécouter", skip: "Passer",
      again: "À revoir", hard: "Difficile", good: "Bien", easy: "Facile", rate_q: "Tu le connaissais comment ?",
      fav: "Favori", unfav: "Retirer des favoris", mark_hard: "Marquer comme difficile", unmark_hard: "Pas difficile", save_list: "Enregistrer dans mes mots", saved_list: "Enregistré",
      f_def: "Sens", f_use: "Quand l'utiliser", f_ex: "Exemple", f_syn: "Aussi", f_gl: "Dans ta langue", f_gl_pack: "Traduction du cours Foundations.",
      ok: "Bonne réponse", no: "Pas tout à fait", the_answer: "La réponse : {{w}}", combo: "{{n}} d'affilée",
      q_def: "Lequel a ce sens ?", q_ex: "Lequel complète la phrase ?", q_use: "Quelle expression utiliserais-tu pour…", q_gram: "Choisis l'anglais correct.", q_sent: "Quelle phrase as-tu entendue ?",
      gl_btn: "Traduire (IA)", gl_busy: "Traduction…", gl_ai: "Traduction automatique par IA — elle peut contenir des erreurs.", gl_none: "La traduction a besoin d'une connexion et d'un compte connecté.", gl_en: "Ton appli est en anglais, il n'y a rien à traduire.",
      l_prompt: "Écoute et retrouve.", l_type: "Écoute et écris le mot.", l_sent: "Écoute la phrase et retrouve-la.", l_synth: "Voix de synthèse.", l_speed: "Vitesse {{n}}× — un peu plus rapide à chaque fois.", l_hint: "Indice", l_hint_txt: "Commence par « {{c}} » · {{d}}", l_no_audio: "L'audio n'est pas disponible sur cet appareil, cette série ne peut pas tourner. Essaie Word Quest ou Sentence Builder.", l_type_ph: "Écris ce que tu entends",
      b_prompt: "Écris le mot.", b_hint: "Montrer une lettre", b_clear: "Effacer", b_type_ph: "Ou tape-le", b_try: "Pas encore — réessaie.",
      s_prompt: "Remets les mots dans l'ordre.", s_fix: "Trouve la phrase correcte.", s_hint: "Placer le mot suivant", s_undo: "Annuler", s_try: "Pas tout à fait — regarde l'ordre.", s_ok_order: "Bon ordre :",
      sp_prompt: "Écoute, puis dis-le à voix haute.", sp_rec: "Enregistrer", sp_stop: "Arrêter", sp_busy: "On écoute ta prise…", sp_heard: "On a entendu :", sp_score: "{{p}} % des mots", sp_play: "Écouter ma prise",
      sp_again: "Le redire", sp_ai: "Score de prononciation (IA)", sp_ai_busy: "Calcul…", sp_ai_res: "Prononciation (IA) : {{p}} %", sp_ai_meter: "Utilise un verdict IA (gratuit 3 par jour, Premium 120).", sp_ai_off: "Le score IA n'est pas disponible — ton score de mots compte quand même.",
      sp_mic: "Le micro n'est pas disponible. Autorise-le dans tes réglages, ou passe celui-ci — ça ne coûte rien.", sp_empty: "On n'a pas bien entendu. Réessaie — rien n'a été compté.", sp_tx_off: "Speak Up a besoin d'une connexion pour t'entendre. Rien n'a été compté.",
      m_prompt: "Touche une expression, puis son partenaire.", m_def: "Expression ↔ sens", m_ex: "Expression ↔ exemple", m_use: "Expression ↔ quand l'utiliser", m_wrong: "Ce n'est pas une paire.",
      mi_q: "Que dirait une personne sûre d'elle ?", mi_say: "Maintenant, dis-le à voix haute", mi_own: "Ou réponds avec tes propres mots", mi_partner: "Pratique-le avec une vraie personne — Practice Partner", mi_shadow: "Regarde-le dans Shadow Studio : « {{t}} »", mi_goal: "Ton objectif :", mi_ctx: "Contexte :",
      cw_fail: "Ces mots ne forment pas une grille valide. Réessaie.",
      end_h: "Série terminée", end_score: "{{ok}} sur {{n}} justes", end_xp: "+{{n}} XP", end_xp0: "Pas de nouveaux XP — ces réponses ont déjà compté aujourd'hui.", end_mastered: "Maîtrisés : {{w}}", end_again: "Rejouer", end_hub: "Retour au hub",
      cel_mastered: "Maîtrisé", cel_stage: "Étape terminée", cel_final: "Tout est maîtrisé", cel_ach: "Badge débloqué",
      none_words: "Rien de disponible pour ce jeu pour l'instant.", del_conf: "Supprimer", cancel: "Annuler",
      h_sub: "Chaque série jouée, avec chaque réponse. Rien ne se perd : c'est enregistré avec ta progression, et sur ton compte quand tu es connecté.",
      h_rounds: "Séries", h_errors: "Erreurs", h_0: "Tes séries apparaîtront ici après ton premier jeu.", h_err0: "Pas encore d'erreurs — ou pas encore de séries.",
      h_day: "{{n}} séries · {{ok}} justes sur {{a}} · +{{xp}} XP", h_day1: "1 série · {{ok}} justes sur {{a}} · +{{xp}} XP", h_round: "{{ok}}/{{n}} justes · +{{xp}} XP", h_part: "arrêtée en cours", h_sum: "Série ancienne — le résumé est gardé, pas le détail des réponses.",
      h_chose: "Tu as choisi : {{p}}", h_typed: "Tu as écrit : {{p}}", h_said: "Tu as dit : {{p}}", h_rated: "Ta note : {{p}}", h_ans: "Réponse : {{a}}", h_hint: "indice utilisé", h_reply: "Ta réponse", h_revealed: "révélé",
      h_err_stage: "{{n}} éléments · {{o}} à corriger", h_times: "faux {{n}}×", h_last: "dernière fois {{d}}", h_instead: "tu as choisi : {{p}}",
      h_open: "À corriger", h_fixed: "Juste depuis", h_mastered: "Maîtrisé depuis", h_practise_err: "Pratiquer ces erreurs ({{n}})",
      h_stage: "Ton historique dans cette étape", h_stage_n: "{{a}} réponses · {{ok}} justes", h_stage_0: "Rien joué dans cette étape pour l'instant.", h_link: "Voir tout ton historique",
      au_h: "Connecte-toi pour jouer", au_b: "Tes XP, ton énergie, ta série et tes badges sont enregistrés sur ton compte et te suivent sur n'importe quel téléphone. Tout reste consultable sans compte.", au_btn: "Se connecter ou créer un compte", au_short: "Connecte-toi pour jouer et enregistrer tes XP.",
      en_out_h: "L'énergie du jour est épuisée", en_out_b: "Tes 5 séries de défis sont faites pour aujourd'hui. L'énergie revient dans {{h}} h {{m}} min (minuit UTC).", en_out_s: "Word Quest, la mission du jour et toutes les cartes restent ouverts.",
      en_keep1: "Word Quest continue — il ne coûte jamais d'énergie.", en_keep2: "Tous les mots, expressions, sens et exemples restent ouverts.", en_keep3: "Une mauvaise réponse ne coûte jamais d'énergie : une série coûte une unité au départ, c'est tout.",
      en_cards: "Réviser avec Word Quest", en_prem: "Séries illimitées avec Premium", en_check: "Vérification de l'énergie du jour…", en_open: "Ouverture de la série…",
      en_unl: "Premium : séries illimitées", en_left: "{{n}} énergie(s) sur {{g}} aujourd'hui", en_note_p: "Premium : tous les jeux, autant que tu veux.", en_note_f: "Gratuit : {{n}} séries de défis sur 5 aujourd'hui. Word Quest et la mission du jour sont gratuits.", en_cost: "Coûte 1 énergie", en_free: "Gratuit",
      trk_h: "Ton compte est sur un autre programme", trk_b: "English Mastery fait partie de General English. Ton compte enregistré est sur un autre programme — passe sur General English dans l'appli, laisse-la se synchroniser, puis réessaie.",
      off_h: "Pas de connexion", off_b: "Les défis ont besoin d'une connexion pour compter correctement ton énergie et tes XP — rien n'a été débité. Word Quest marche hors ligne.",
      pr_h: "English Mastery Premium", pr_b: "Le même abonnement que le reste de BE Mastery. Le gratuit garde tout et les huit jeux.", pr_1: "Séries de défis illimitées chaque jour", pr_2: "20 situations avancées (négociation, feedback, questions difficiles)", pr_3: "Tendances sur 30 et 90 jours pour chaque compétence", pr_4: "Plus de coaching IA : 120 verdicts par jour au lieu de 3", pr_btn: "Voir Premium", pr_soon: "Premium n'est pas encore en vente.",
      dc_h: "Mission d'anglais du jour", dc_t: "La mission d'anglais du jour", dc_sub: "8 questions de toutes les étapes · gratuit · bonus +30 XP", dc_done_h: "Mission du jour réussie !", dc_next: "Nouvelle mission dans {{h}} h {{m}} min", dc_play: "Mission du jour", dc_bonus: "+{{n}} bonus du jour",
      wk_h: "Objectif de la semaine", wk_b: "{{n}} jours de pratique sur {{g}}", wk_done: "Objectif atteint",
      ng_h: "Ton prochain objectif", ng_daily: "Termine la mission du jour (+30 XP)", ng_week: "Pratique encore {{n}} jour(s) cette semaine pour atteindre ton objectif", ng_badge: "Encore {{n}} réponses en {{skill}} à {{acc}} % pour le badge {{tier}}",
      bd_h: "Badges de compétence", bd_sub: "Gagnés avec de vraies réponses : assez nombreuses et assez justes.", bd_t0: "Pas encore", bd_t1: "Bronze", bd_t2: "Argent", bd_t3: "Or", bd_next: "Encore {{n}} réponses à {{acc}} % pour {{tier}}", bd_max: "Meilleur badge obtenu", bd_new: "Badge {{tier}} : {{skill}}", bd_new_h: "Nouveau badge",
      end_offline: "Joué hors ligne — révision seulement, sans XP.", end_saving: "Enregistrement de tes XP…", end_pending: "Les XP seront enregistrés dès que tu seras reconnecté.", end_xp_dup: "Déjà compté — pas d'XP en plus.",
      g_daily: "Mission d'anglais du jour", g_daily_d: "Huit questions de toutes les étapes", g_advanced: "Situations avancées", g_advanced_d: "Négociation, feedback et questions difficiles — avec le coach IA",
      adv_fail_h: "Situations avancées indisponibles", adv_fail_b: "Les situations avancées n'ont pas pu être chargées. Réessaie dans un instant.",
      co_task: "Réponds à {{who}} avec tes propres mots.", co_h: "À toi — coach IA", co_v_good: "Bien dit", co_v_almost: "Presque", co_v_retry: "Essaie autrement", co_ai: "Retour généré par IA. C'est un coach, pas une personne.",
      co_ph: "Écris ce que tu dirais…", co_busy: "Le coach lit ta réponse…", co_btn: "Demander au coach IA", co_off: "Le coach IA a besoin d'une connexion et du quota IA du jour.", co_meter: "Utilise un verdict du coach IA (gratuit 3 par jour, Premium 120).", co_short: "Écris d'abord une ou deux phrases complètes.", co_spent: "Le coaching IA du jour est épuisé. Il revient à minuit UTC — Premium en donne 120 par jour.", co_fail: "Le coach n'a pas pu répondre. Réessaie.",
      tr_h: "Tendances", tr_days: "{{n}} jours", tr_act: "Réponses par jour ({{n}} jours)", tr_acc: "Réussite par semaine", tr_few: "Les tendances apparaissent après deux semaines d'au moins 10 réponses.", tr_sk: "Compétences par semaine", tr_few_s: "Pas encore assez", tr_empty: "Joue quelques séries et tes tendances apparaîtront ici.", tr_lock: "Les tendances font partie de Premium.",
      loop_h: "Ta boucle d'apprentissage", loop_b: "Apprendre → Jouer → Écouter → Parler → Retour → Pratiquer avec une personne.", loop_pp: "Pratiquer avec un partenaire", loop_sh: "Faire du shadowing sur une vraie vidéo",
      r_kicker: "English Mastery", r_shift_t: "Objectif du jour : {{m}}", r_shift_b: "{{p}} sur {{n}} faits · environ cinq minutes dans le hub de jeu.", r_due_t: "{{n}} à réviser dans English Mastery", r_due_b: "Une petite série Word Quest les fait revenir au bon moment.", r_cta: "Jouer",
      row_h: "English Mastery — tes jeux", row_s_first: "Commence par cinq cartes, environ trois minutes.", row_s_gap: "Ta {{strong}} est solide ; ton {{weak}} demande de la pratique.", row_s_due: "{{n}} sont à réviser.", row_s_difficult: "Certains méritent un autre regard.", row_s_try: "Un jeu que tu n'as pas encore essayé t'attend.", row_s_keep: "Garde ton anglais frais.",
      it_shift: "Objectif du jour", explore_s: "{{total}} mots et expressions, huit jeux", explore_shift: "Objectif du jour : {{p}}/{{n}}", explore_done: "Objectif fait · {{m}} maîtrisés",
      w_title: "English Mastery", w_mastered: "maîtrisés", w_level: "Niveau {{n}}", w_xp: "XP", w_streak: "jours de série", w_shift: "Objectif du jour", w_done: "Objectif atteint", w_open: "Jouer", w_empty: "Ouvre English Mastery dans BE Mastery pour commencer.",
      k_def: "Sens", k_ex: "Exemple", k_use: "Quand l'utiliser", k_gram: "Grammaire", k_sent: "Phrase", k_card: "Carte", k_listen: "Écoute", k_listen_t: "Écoute (écrit)", k_listen_s: "Écoute (phrase)", k_spell: "Orthographe", k_speak: "Oral", k_mis: "Mission", k_reply: "Réponse", k_match: "Association", k_coach: "Coach IA"
    }
  };
  function lang() { try { return (S.profile && S.profile.lang) === "fr" ? "fr" : "en"; } catch (e) { return "en"; } }
  function w(k, v) { let s = (TX[lang()][k] != null ? TX[lang()][k] : TX.en[k]); if (s == null) s = k; if (v) s = s.replace(/\{\{(\w+)\}\}/g, (_, x) => v[x] != null ? v[x] : ""); return s; }
  function h(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function L2(o) { return o ? (o[lang()] || o.en || "") : ""; }
  function fmtDate(ts) { try { return new Date(ts).toLocaleDateString(lang() === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } }

  /* ------------------------------------------------------------ icons (the Welding hub's set, plus mic, briefcase, quote, globe, play) */
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
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10Z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 12.5h18M10.5 12.5v2h3v-2"/>',
    quote: '<path d="M5 18c2.5-1 4-3 4-6V7H4v5h4M15 18c2.5-1 4-3 4-6V7h-5v5h4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5Z" fill="currentColor"/>'
  };
  const MODE_IC = { cards: "cards", quiz: "quiz", sentence: "builder", listen: "headphones", speak: "mic", match: "link", puzzle: "crossword", missions: "chat", daily: "star", advanced: "crown" };
  const CAT_IC = { first: "spark", social: "chat", travel: "map", shopping: "gem", health: "heart", home: "home", wk1: "briefcase", wk3: "briefcase", wk5: "briefcase", wk7: "briefcase", wk9: "briefcase", wk11: "briefcase", idioms: "quote", mine: "myword" };
  function wi(name, cls) { return `<svg class="wm-ic ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${WI[name] || WI.spark}</svg>`; }
  /* the portal mark: two speech bubbles over an open book, a spark of confidence */
  function logo(cls) {
    return `<svg class="wm-logo ${cls || ""}" viewBox="0 0 64 64" role="img" aria-label="English Mastery"><defs><linearGradient id="emLg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#0ea5a4"/></linearGradient><linearGradient id="emLg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb199"/><stop offset="1" stop-color="#f45d48"/></linearGradient></defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#0d1030" stroke="url(#emLg1)" stroke-width="2.5"/>
      <path d="M12 14h22a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H22l-6 5v-5h-4a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5Z" fill="url(#emLg1)"/>
      <path d="M17 21h14M17 26h9" stroke="#0d1030" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M36 24h13a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-2v4l-5-4h-6a5 5 0 0 1-5-5v-1" fill="url(#emLg2)"/>
      <path d="M11 44c6-2.2 12.5-2.2 19 1 6.5-3.2 13-3.2 19-1v10c-6-2.2-12.5-2.2-19 1-6.5-3.2-13-3.2-19-1Z" fill="#eef2ff" stroke="url(#emLg1)" stroke-width="1.6"/>
      <path d="M30 45v10" stroke="#6366f1" stroke-width="1.4"/>
      <g stroke="#ffd36b" stroke-width="1.6" stroke-linecap="round"><path d="M52 9v4M50 11h4M57 17l2-1"/></g>
    </svg>`;
  }
  /* English Mastery has no pictures of things (its content is words, phrases and sentences) */
  function artSVG() { return ""; }
  /* a game's 3D illustration, decorative (the card's own text names the game) */
  function art3d(key, fallbackIcon) { return ART3D[key] ? `<span class="wm-art3d" aria-hidden="true">${ART3D[key]}</span>` : wi(fallbackIcon); }
  function catArt(cat) { return `<span class="wm-catart" aria-hidden="true">${wi(CAT_IC[cat] || "spark")}</span>`; }

  /* ------------------------------------------------------------ data */
  function loadCorpus() {
    if (C) return Promise.resolve(C);
    if (_load) return _load;
    _err = false;
    _load = Promise.all([fetch(CORPUS_URL).then(r => { if (!r.ok) throw new Error("corpus " + r.status); return r.json(); }), fetch(ART3D_URL).then(r => r.ok ? r.json() : {}).catch(() => ({}))])
      .then(([c, a3]) => {
        /* the 3D game artwork: our own SVG, but checked once more before it is placed in the page */
        ART3D = {}; Object.entries(a3 || {}).forEach(([k, v]) => { if (typeof v === "string" && /^<svg[\s>]/.test(v) && !/<(script|foreignObject|image|style)\b|\son[a-z]+\s*=|href\s*=/i.test(v)) ART3D[k] = v; });
        if (!c || !Array.isArray(c.terms) || !c.terms.length || !Array.isArray(c.missions)) throw new Error("corpus shape");
        C = c; TOTAL = C.terms.length;
        C.grammar = Array.isArray(C.grammar) ? C.grammar : [];
        _ids = new Set(C.terms.map(t => t.id));
        return C;
      })
      .catch(e => { _err = true; _load = null; throw e; });
    return _load;
  }
  let _ids = null;
  function official() { return C ? C.terms : []; }
  function gram(id) { return C && C.grammar.find(g => g.id === id) || null; }
  function byId(id) { if (!C) return null; const t = C.terms.find(x => x.id === id); if (t) return t; const m = st() && st().mine[id]; return m && !m.del ? E.mineAsTerm(m) : null; }
  function allTerms() { return official().concat(E.mineList(st()).map(E.mineAsTerm)); }
  function catName(id) { if (id === "mine") return w("c_mine"); if (id === "advanced") return w("g_advanced"); const c = C && C.categories.find(x => x.id === id); return c ? (lang() === "fr" && c.fr ? c.fr : c.en) : id; }
  /* the second line of a card in a list: its meaning, short */
  function name1(t) { return t.en; }
  function name2(t) { const d = t.def && t.def.en || ""; return d.length > 70 ? d.slice(0, 68) + "…" : d; }
  /* mastered = an official item (the corpus terms), never a grammar question or a mission */
  function masteredCount(s) { return Object.entries((s || st()).t).filter(([id, r]) => (_ids ? _ids.has(id) : /^em-(f|p|i|x)-|^em-[a-z]/.test(id) && !/^em-(g|m)-/.test(id)) && E.isMastered(r)).length; }
  function reduced() { try { return st().set.motion === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function canSpeak() { try { return ("speechSynthesis" in window) || (typeof POLISH_API !== "undefined" && !!POLISH_API && navigator.onLine); } catch (e) { return false; } }
  function say(text, rate) { try { if (window.fbSay) window.fbSay(clean(text), rate || 0.92); } catch (e) {} }
  /* the spoken / built form of a phrase: no "…", no X/Y placeholders */
  function clean(s) { return String(s || "").replace(/…/g, " ").replace(/\bX or Y\b/g, "this or that").replace(/\bX\b/g, "it").replace(/\s+/g, " ").trim(); }
  /* the sentence of an item: a Foundations sentence is itself; anything else, its example */
  function sentenceOf(t) { return t.kind === "sentence" ? t.en : (t.ex && t.ex.en) || ""; }
  /* hide the answer inside a clue: the term (its words before "…") and its synonyms */
  function blank(text, t) {
    let s = String(text || "");
    const forms = String(t.en).split("…").map(x => x.trim()).filter(x => x.length > 1).concat(t.syn || []).sort((a, b) => b.length - a.length);
    for (const f of forms) s = s.replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/'/g, "['’]"), "ig"), "_____");
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
    const host = document.getElementById("emGame") || document.body;
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
      el.innerHTML = `<div class="card wm-off"><p>${h(w("off"))}</p><button class="btn btn-p" data-em="nav" data-a="practice">${h(w("off_btn"))}</button></div>`;
      return;
    }
    if (tab && ["home", "games", "journey", "coll", "rewards", "hist", "perf"].includes(tab)) _tab = tab;
    if (!C) {
      el.innerHTML = `<div class="wm-hub"><div class="wm-load" role="status">${logo("wm-logo-l")}<p>${h(_err ? w("load_fail") : w("loading"))}</p>${_err ? `<button class="btn btn-p" data-em="retry">${h(w("retry"))}</button>` : ""}</div></div>`;
      if (!_err) loadCorpus().then(() => redraw()).catch(() => redraw());
      return;
    }
    const s = st(), now = Date.now();
    E.ensureMission(s, official(), now);
    const lv = E.level(xpShown()), sk = E.streak(s, now), m = masteredCount(s);
    if (signedIn() && (!_srv || Date.now() - _srv.at > 60_000)) setTimeout(srvRefresh, 0);
    el.innerHTML = `<div class="wm-hub">
      <div class="wm-top"><button class="back" data-em="nav" data-a="practice">${h(w("back"))}</button>
        <button class="wm-iconbtn" data-em="settings" aria-label="${h(w("set_h"))}">${wi("gear")}</button></div>
      <header class="wm-hero">
        ${logo()}
        <div class="wm-hero-t"><h1>ENGLISH <span>MASTERY</span></h1><p>${h(w("sub"))}</p></div>
      </header>
      <div class="wm-stats" role="list">
        <span class="wm-stat" role="listitem">${wi("medal")}<b>${h(w("level", { n: lv.level }))}</b></span>
        <span class="wm-stat xp" role="listitem">${wi("xp")}<b>${h(w("xp", { n: lv.xp }))}</b></span>
        <span class="wm-stat fl" role="listitem" title="${h(sk.current ? w("streak_d", { n: sk.current }) : w("streak_0"))}" aria-label="${h(sk.current ? w("streak_d", { n: sk.current }) : w("streak_0"))}">${wi("flame")}<b aria-hidden="true">${sk.current}</b></span>
        <span class="wm-stat ok" role="listitem">${wi("check")}<b>${m}/${TOTAL}</b></span>
        ${energyChipHTML()}
      </div>
      <nav class="wm-tabs" role="tablist" aria-label="English Mastery">
        ${[["home", "home"], ["games", "games"], ["journey", "map"], ["coll", "coll"], ["rewards", "trophy"], ["hist", "clock"], ["perf", "chart"]].map(([k, icn]) => `<button role="tab" aria-selected="${_tab === k}" class="wm-tab ${_tab === k ? "on" : ""}" data-em="tab" data-a="${k}">${wi(icn)}${k === "perf" ? `<span class="wm-tl-s" aria-hidden="true">${h(w("t_perf_s"))}</span>` : ""}<span class="wm-tl">${h(w("t_" + k))}</span></button>`).join("")}
      </nav>
      <section class="wm-body" id="emBody" role="tabpanel">${tabHTML(_tab)}</section>
      <div class="wm-ad-host wm-ad-foot"></div>
    </div>`;
    if (_tab === "coll") collAfter();
    adsPlace(el);
    /* the tab bar scrolls on a phone: keep the open tab in view */
    try { const bar = el.querySelector(".wm-tabs"), on2 = bar && bar.querySelector(".wm-tab.on"); if (on2 && (on2.offsetLeft + on2.offsetWidth > bar.scrollLeft + bar.clientWidth || on2.offsetLeft < bar.scrollLeft)) bar.scrollLeft = on2.offsetLeft - 8; } catch (e) {}
  }
  /* ADS IN THE GAME HUB (owner, 10 Oct 2026; both programmes, free plan only — Premium removes them):
     one labelled native slot at the foot of every tab, and one mid-page on the long tabs. WHETHER an ad
     shows is the app's AdManager / AdEligibility (flag, programme, plan, caps, a round in play) — this
     file only offers the places. Mid-page goes between items of the tab's own list or grid, never
     inside a question. */
  const AD_MID = { games: ".wm-games", journey: "ol.wm-road", coll: "ul.wm-words", hist: ".wm-body", rewards: ".wm-body", perf: ".wm-perf" };
  function adsPlace(el) {
    if (typeof AdManager === "undefined" || !el) return;
    try {
      const box = AD_MID[_tab] && el.querySelector(AD_MID[_tab]);
      if (box && !box.querySelector(".wm-ad-mid")) {
        const kids = [...box.children].filter(k => !k.classList.contains("wm-ad-host"));
        if (kids.length >= 6) {
          const mid = document.createElement(/^(UL|OL)$/.test(box.tagName) ? "li" : "div");
          mid.className = "wm-ad-host wm-ad-mid";
          box.insertBefore(mid, kids[_tab === "games" ? 4 : Math.floor(kids.length / 2)]);
        }
      }
    } catch (e) {}
    setTimeout(() => { try { const f = el.querySelector(".wm-ad-foot"), m = el.querySelector(".wm-ad-mid"); if (f) AdManager._fillSlot("game_hub", f, "append"); if (m) AdManager._fillSlot("game_hub_mid", m, "append"); } catch (e) {} }, 300);
  }
  function redraw() { const el = document.getElementById("v-english"); if (el && typeof cur !== "undefined" && cur && cur.v === "english") render(el); }
  function tabHTML(k) {
    try { return ({ home: homeHTML, games: gamesHTML, journey: journeyHTML, coll: collHTML, rewards: rewardsHTML, hist: histHTML, perf: () => perfInner(true) })[k](); }
    catch (e) { try { console.error("[em]", e); } catch (_) {} return `<div class="card"><p>${h(w("load_fail"))}</p></div>`; }
  }

  function missionHTML(s) {
    const m = s.mis; if (!m) return "";
    const def = E.MISSIONS[m.kind];
    return `<div class="card wm-shift ${m.done ? "done" : ""}">
      <div class="wm-shift-h">${wi(def.ic)}<span><small>${h(w("shift_h"))}</small><b>${h(w("m_" + m.kind))}</b></span></div>
      <p>${h(m.done ? w("shift_done") : w("m_" + m.kind + "_d"))}</p>
      <div class="wm-meter" role="progressbar" aria-valuemin="0" aria-valuemax="${m.target}" aria-valuenow="${m.prog}" aria-label="${h(w("shift_h"))}"><span style="width:${Math.round(100 * m.prog / m.target)}%"></span></div>
      <div class="wm-shift-f"><span>${m.prog} / ${m.target}</span>${m.done ? `<span class="wm-chip ok">${wi("check")}+${E.XP.mission} XP</span>` : `<button class="btn btn-p btn-sm" data-em="mission">${h(m.prog ? w("go_on") : w("start"))}</button>`}</div>
    </div>`;
  }
  function resumeValid(s) {
    const r = s.resume;
    if (!r || !r.ids || r.i >= r.ids.length || Date.now() - r.ts > 24 * 3600_000) return null;
    if (r.mode !== "missions" && r.ids.some(id => !byId(id) && !gram(id))) return null;
    return r;
  }
  function homeHTML() {
    const s = st(), now = Date.now(), m = masteredCount(s), lv = E.level(xpShown()), sk = E.streak(s, now);
    const ng = nextGoal(), en = energyLeft();
    const perf = E.performance(s, official(), now), rec = E.recommend(perf), res = resumeValid(s);
    const recent = Object.entries(s.t).filter(([id, r]) => r.n && byId(id)).sort((a, b) => b[1].last - a[1].last).slice(0, 6).map(([id]) => byId(id));
    const pct = Math.round(100 * m / TOTAL);
    return `
      ${signedIn() ? "" : `<div class="card wm-signin">${wi("lock")}<div><b>${h(w("au_h"))}</b><p>${h(w("au_b"))}</p><button class="btn btn-p btn-sm" data-em="signin">${h(w("au_btn"))}</button></div></div>`}
      ${dailyCardHTML()}
      <div class="wm-twin">${weekCardHTML()}
        <button class="card wm-ngoal" data-em="${ng.act}" data-a="${h(ng.a || "")}">${wi("target")}<span><small>${h(w("ng_h"))}</small><b>${h(ng.text)}</b></span><span class="wm-go">→</span></button></div>
      ${signedIn() && en === 0 ? `<button class="card wm-enout" data-em="energy">${wi("bolt")}<span><b>${h(w("en_out_h"))}</b><small>${h(w("en_out_s"))}</small></span><span class="wm-go">→</span></button>` : ""}
      ${perf.empty ? `<div class="card wm-first">${wi("party")}<div><b>${h(w("first_h"))}</b><p>${h(w("first_b", { total: TOTAL }))}</p></div></div>` : ""}
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
      ${loopHTML()}
      <h2 class="wm-h2">${h(w("cont_h"))}</h2>
      ${res ? `<button class="card wm-cont" data-em="resume">${wi(MODE_IC[res.mode])}<span><b>${h(w("cont_resume", { game: w("g_" + res.mode), i: res.i + 1, n: res.ids.length }))}</b></span><span class="wm-go">→</span></button>` : ""}
      <button class="card wm-cont rec" data-em="play" data-a="${rec.mode}">${wi(MODE_IC[rec.mode])}<span><b>${h(w("cont_rec", { game: w("g_" + rec.mode) }))}</b><small>${h(recText(rec))}</small></span><span class="wm-go">→</span></button>
      <h2 class="wm-h2">${h(w("recent_h"))}</h2>
      ${recent.length ? `<div class="wm-chips">${recent.map(t => `<button class="wm-wchip ${E.isMastered(s.t[t.id]) ? "m" : ""}" data-em="word" data-a="${h(t.id)}" lang="en">${h(clean(name1(t)).slice(0, 40))}</button>`).join("")}</div>` : `<p class="wm-mut">${h(w("recent_0"))}</p>`}
      <button class="wm-link" data-em="tab" data-a="journey">${wi("map")} ${h(w("journey_link"))} →</button>
      ${(st().hist || []).length ? `<button class="wm-link" data-em="tab" data-a="hist">${wi("clock")} ${h(w("h_link"))} →</button>` : ""}`;
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
    const prem = isPremium();
    return `${dailyCardHTML()}
      ${signedIn() ? `<p class="wm-mut small wm-en-note">${wi("bolt")} ${h(prem ? w("en_note_p") : w("en_note_f", { n: energyLeft() == null ? "–" : energyLeft() }))}</p>` : ""}
      <div class="wm-games">${E.MODES.map(md => { const M = s.modes[md]; const cost = EM_CHARGED.has(md); return `<button class="wm-game-card" data-em="play" data-a="${md}">
      <span class="wm-gc-cost ${cost ? (prem ? "unl" : "") : "free"}" aria-label="${h(cost ? (prem ? w("en_unl") : w("en_cost")) : w("en_free"))}">${cost ? (prem ? "∞" : `${wi("bolt")}1`) : h(w("en_free"))}</span>
      <span class="wm-gc-ic ${ART3D[md] ? "a3" : ""}">${art3d(md, MODE_IC[md])}</span><b>${h(w("g_" + md))}</b><small>${h(w("g_" + md + "_d"))}</small>
      <span class="wm-gc-skill">${h(w("skill_" + E.MODE_SKILL[md]))}</span>
      ${M && M.runs ? `<span class="wm-gc-best">${h(w("best", { n: M.best }))} · ${h(w("runs", { n: M.runs }))}</span>` : ""}
    </button>`; }).join("")}
      <button class="wm-game-card wm-adv" data-em="advanced">
        <span class="wm-gc-cost prem">${wi("crown")} Premium</span>
        <span class="wm-gc-ic ${ART3D.advanced ? "a3" : ""}">${art3d("advanced", "chat")}</span><b>${h(w("g_advanced"))}</b><small>${h(w("g_advanced_d"))}</small>
        <span class="wm-gc-skill">${h(w("skill_context"))} · AI</span>
      </button></div>`;
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
          <div class="wm-stage-a"><button class="btn btn-p btn-sm" data-em="stage" data-a="${j.id}">${wi("cards")} ${h(w("j_learn"))}</button>
          ${j.seen >= 10 ? `<button class="btn btn-g btn-sm" data-em="stagetest" data-a="${j.id}">${wi("target")} ${h(w("j_test"))}</button>` : `<span class="wm-mut small">${wi("lock")} ${h(w("j_test_lock"))}</span>`}</div>
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
    if (q) list = list.filter(t => [t.en, t.def && t.def.en].concat(t.syn || []).some(x => E.normAns(x).includes(q)));
    return list;
  }
  function collHTML() {
    const s = st(), segs = ["all", "fav", "hard", "mastered", "mine"];
    return `
      <div class="wm-coll-bar">
        <label class="wm-search">${wi("search")}<input id="emQ" type="search" value="${h(_coll.q)}" placeholder="${h(w("c_search"))}" aria-label="${h(w("c_search"))}"></label>
      </div>
      <div class="wm-segs" role="tablist">${segs.map(k => `<button role="tab" aria-selected="${_coll.seg === k}" class="wm-seg ${_coll.seg === k ? "on" : ""}" data-em="seg" data-a="${k}">${h(w("c_" + k))}</button>`).join("")}</div>
      ${_coll.seg !== "mine" ? `<div class="wm-cats"><button class="wm-cat ${_coll.cat === "all" ? "on" : ""}" data-em="cat" data-a="all">${h(w("c_cat_all"))}</button>${C.categories.map(c => `<button class="wm-cat ${_coll.cat === c.id ? "on" : ""}" data-em="cat" data-a="${c.id}">${wi(CAT_IC[c.id])}${h(catName(c.id))}</button>`).join("")}</div>` : ""}
      <div id="emCollList"></div>
      ${_coll.seg === "mine" ? mineFormHTML() : ""}`;
  }
  function collListHTML() {
    const s = st(), list = collList();
    const empty = { fav: "c_empty_fav", hard: "c_empty_hard", mastered: "c_empty_m", mine: "my_0" }[_coll.seg] || "c_empty";
    return `${list.length ? `<button class="btn btn-p wm-practise" data-em="practise">${wi("cards")} ${h(w("c_practise", { n: Math.min(20, list.length) }))}</button>` : ""}
      ${_coll.seg === "mine" && list.length ? `<h3 class="wm-h3">${h(w("my_list"))}</h3>` : ""}
      ${list.length ? `<ul class="wm-words">${list.slice(0, 260).map(t => { const r = s.t[t.id]; return `<li class="wm-word ${E.isMastered(r) ? "m" : ""}">
        <button class="wm-word-b" data-em="word" data-a="${h(t.id)}"><span class="wm-word-ic">${wi(CAT_IC[t.cat] || "spark")}</span><span class="wm-word-t"><b lang="en">${h(name1(t))}</b><small>${h(name2(t))}</small></span>
        <span class="wm-dot ${E.isMastered(r) ? "m" : r && r.n ? (E.difficulty(r) >= 2 ? "h" : "s") : ""}" aria-hidden="true"></span></button>
        ${t.mine ? `<button class="wm-iconbtn" data-em="myedit" data-a="${h(t.id)}" aria-label="${h(w("my_edit"))} ${h(t.en)}">${wi("edit")}</button><button class="wm-iconbtn" data-em="mydel" data-a="${h(t.id)}" aria-label="${h(w("my_del"))} ${h(t.en)}">${wi("trash")}</button>` : ""}
        <button class="wm-iconbtn wm-star ${E.isFav(s, t.id) ? "on" : ""}" data-em="fav" data-a="${h(t.id)}" aria-pressed="${E.isFav(s, t.id)}" aria-label="${h(E.isFav(s, t.id) ? w("unfav") : w("fav"))}: ${h(t.en)}">${wi("star")}</button>
      </li>`; }).join("")}</ul>` : `<p class="wm-mut wm-empty">${h(w(empty))}</p>`}`;
  }
  function collAfter() {
    const box = document.getElementById("emCollList"); if (box) box.innerHTML = collListHTML();
    /* the filter rows scroll sideways: a redraw starts them at 0, so bring the chosen chip back into the middle */
    document.querySelectorAll(".wm-hub .wm-cats, .wm-hub .wm-segs").forEach(bar => {
      const on = bar.querySelector(".on"); if (!on || bar.scrollWidth <= bar.clientWidth) return;
      try { bar.scrollLeft += (on.getBoundingClientRect().left - bar.getBoundingClientRect().left) - (bar.clientWidth - on.offsetWidth) / 2; } catch (e) {}
    });
    const q = document.getElementById("emQ");
    if (q && !q._wm) { q._wm = 1; q.addEventListener("input", () => { _coll.q = q.value; const b = document.getElementById("emCollList"); if (b) b.innerHTML = collListHTML(); }); }
    const sb = document.getElementById("vlBox");
    if (sb) { try { vlRenderInto(vocBuckets()[_pracTab] || []); } catch (e) {} }
  }
  function mineFormHTML() {
    const e = _edit && st().mine[_edit];
    return `<form class="card wm-myform" id="emMyForm" data-id="${e ? h(e.id) : ""}" novalidate>
      <h3 class="wm-h3">${wi("myword")} ${h(w("my_h"))}</h3>
      <label>${h(w("my_en"))}<input id="emMyEn" maxlength="60" required value="${h(e ? e.en : "")}"></label>
      <label>${h(w("my_fr"))}<input id="emMyFr" maxlength="60" value="${h(e ? e.fr : "")}"></label>
      <label>${h(w("my_def"))}<textarea id="emMyDef" maxlength="220" rows="2">${h(e ? e.def : "")}</textarea></label>
      <label>${h(w("my_ex"))}<textarea id="emMyEx" maxlength="220" rows="2">${h(e ? e.ex : "")}</textarea></label>
      <p class="wm-err" id="emMyErr" role="alert"></p>
      <div class="wm-row"><button type="submit" class="btn btn-p">${h(e ? w("my_save") : w("my_add"))}</button>${e ? `<button type="button" class="btn btn-g" data-em="mycancel">${h(w("my_cancel"))}</button>` : ""}</div>
    </form>`;
  }
  /* the old Vocabulary-page block lives on here: the saved list with its
     Study / Review / Mastered tabs, its add field and its empty state */
  function savedListHTML() {
    let b = { ready: [], upnext: [], learned: [] };
    try { b = vocBuckets(); } catch (e) {}
    return `<div class="card wm-saved"><h3 class="wm-h3">${wi("book")} ${h(w("saved_h"))}</h3><p class="wm-mut">${h(w("saved_sub"))}</p>
      <div class="prac-subtabs">${["ready", "upnext", "learned"].map(k => `<button class="prac-subtab ${_pracTab === k ? "on" : ""}" data-em="savedtab" data-a="${k}">${h(t("prac.tab_" + k))} <b>${b[k].length}</b></button>`).join("")}</div>
      <div id="vlBox"></div>
      <div class="prac-add"><input id="pracAddIn" placeholder="${h(t("prac.add_ph"))}" aria-label="${h(t("prac.add_ph"))}"><button class="btn btn-g prac-add-btn" data-em="savedadd">${h(t("prac.add_btn"))}</button></div>
    </div>`;
  }

  /* ---- History: every round, every answer, grouped and folded ---- */
  let _histSeg = "rounds";
  function label(id) { const t = byId(id); if (t) return t.en; const g = gram(id); return g ? g.q : id; }
  /* one answer of a round, as the History tab shows it */
  function itemHTML(x) {
    const ok = !!x.o, mk = (b, sub) => `<li class="wm-hi ${ok ? "ok" : "no"}">${wi(ok ? "check" : "cross")}<div>${b}${sub || ""}</div>${x.k ? `<em>${h(kindName(x.k))}</em>` : ""}</li>`;
    if (x.k === "mis" || x.k === "coach") {
      const sc = scen(x.s), o = sc && x.k === "mis" && sc.options[+x.p];
      return mk(`<b>${h(sc ? sc.asks : x.s)}</b>`, `${o ? `<small lang="en">${h(w("h_chose", { p: "“" + o.en + "”" }))}</small>` : ""}${!ok && sc && x.k === "mis" ? `<small>${h(w("h_ans", { a: (sc.options.find(z => z.ok) || {}).en || "" }))}</small>` : ""}${x.k === "coach" ? `<small>${h(w("co_v_" + (x.p || "almost")))}</small>` : ""}`);
    }
    const g = gram(x.t);
    if (g) return mk(`<b lang="en">${h(g.q)}</b>`, `${x.p != null && g.o[+x.p] != null ? `<small class="${ok ? "" : "bad"}">${h(w("h_chose", { p: g.o[+x.p] }))}</small>` : ""}${ok ? "" : `<small>${h(w("h_ans", { a: g.o[g.a] }))}</small>`}`);
    const t = byId(x.t), name = t ? t.en : x.t;
    let said = "";
    if (x.k === "card") said = w("h_rated", { p: w(["again", "hard", "good", "easy"][x.q] || "good") });
    else if (x.p === "revealed") said = w("h_revealed");
    else if (x.k === "speak" && x.p) said = w("h_said", { p: "“" + x.p + "”" });
    else if (x.p) said = byId(x.p) ? w("h_chose", { p: label(x.p) }) : w("h_typed", { p: x.p });
    return mk(`<button class="wm-hi-w" data-em="word" data-a="${h(x.t)}"><b lang="en">${h(name)}</b></button>`,
      `${said ? `<small class="${ok ? "" : "bad"}">${h(said)}</small>` : ""}${!ok && x.p && x.k !== "card" && x.k !== "speak" && t ? `<small>${h(w("h_ans", { a: x.k === "sent" ? clean(sentenceOf(t)) : name }))}</small>` : ""}${x.h ? `<small class="wm-mut">${h(w("h_hint"))}</small>` : ""}`);
  }
  function kindName(k) {
    const m = { card: "k_card", def: "k_def", ex: "k_ex", use: "k_use", gram: "k_gram", sent: "k_sent", fix: "k_gram", listen: "k_listen", "listen-t": "k_listen_t", "listen-s": "k_listen_s", spell: "k_spell", speak: "k_speak", mis: "k_mis", coach: "k_coach" };
    return k.startsWith("match") ? w("k_match") : w(m[k] || "k_card");
  }
  function roundHTML(r) {
    const time = new Date(r.ts).toLocaleTimeString(lang() === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
    return `<details class="wm-hr"><summary>${wi(MODE_IC[r.m] || "spark")}<span><b>${h(w("g_" + r.m))}</b><small>${h(time)} · ${h(w("h_round", { ok: r.ok, n: r.n, xp: r.xp || 0 }))}${r.part ? " · " + h(w("h_part")) : ""}${r.cats && r.cats.length === 1 ? " · " + h(catName(r.cats[0])) : ""}</small></span><i class="wm-hr-s ${r.n && r.ok / r.n >= .8 ? "ok" : ""}">${r.n ? Math.round(100 * r.ok / r.n) : 0}%</i></summary>
      ${r.it ? `<ul class="wm-his">${r.it.map(itemHTML).join("")}</ul>` : `<p class="wm-mut small">${h(w("h_sum"))}</p>`}</details>`;
  }
  function errListHTML(list) {
    return `<ul class="wm-his">${list.map(e => { const t = byId(e.t); if (!t) return ""; return `<li class="wm-hi ${e.now === "open" ? "no" : "ok"}">${wi(e.now === "mastered" ? "medal" : e.now === "fixed" ? "check" : "cross")}<div>
      <button class="wm-hi-w" data-em="word" data-a="${h(e.t)}"><b>${h(t.en)}</b>${t.fr ? ` <span lang="fr">${h(t.fr)}</span>` : ""}</button>
      <small>${h(w("h_times", { n: e.n }))} · ${h(w("h_last", { d: fmtDate(e.last) }))}</small>
      ${e.picks.length ? `<small class="bad">${h(w("h_instead", { p: e.picks.map(p => byId(p) ? byId(p).en : p).join(", ") }))}</small>` : ""}
    </div><em class="${e.now}">${h(w("h_" + e.now))}</em></li>`; }).join("")}</ul>`;
  }
  function histHTML() {
    const s = st(), days = E.histByDay(s);
    const seg = `<div class="wm-segs" role="tablist">${["rounds", "errors"].map(k => `<button role="tab" aria-selected="${_histSeg === k}" class="wm-seg ${_histSeg === k ? "on" : ""}" data-em="hseg" data-a="${k}">${h(w("h_" + k))}</button>`).join("")}</div>`;
    if (_histSeg === "errors") {
      const E2 = E.errorsByStage(s, official()), cats = C.categories.map(c => c.id).concat("mine").filter(c => E2[c] && E2[c].length);
      return `<p class="wm-mut">${h(w("h_sub"))}</p>${seg}${cats.length ? cats.map(c => { const list = E2[c], open = list.filter(e => e.now === "open"); return `<details class="wm-hd"><summary>${wi(CAT_IC[c] || "spark")}<span><b>${h(catName(c))}</b><small>${h(w("h_err_stage", { n: list.length, o: open.length }))}</small></span></summary>
        ${open.length ? `<button class="btn btn-p btn-sm" data-em="practerr" data-a="${h(open.map(e => e.t).join(","))}">${wi("cards")} ${h(w("h_practise_err", { n: open.length }))}</button>` : ""}${errListHTML(list)}</details>`; }).join("") : `<p class="wm-mut wm-empty">${h(w("h_err0"))}</p>`}`;
    }
    return `<p class="wm-mut">${h(w("h_sub"))}</p>${seg}${days.length ? days.map(g => `<details class="wm-hd"><summary>${wi("clock")}<span><b>${h(fmtDate(Date.parse(g.day + "T12:00:00Z")))}</b><small>${h(w(g.rounds.length === 1 ? "h_day1" : "h_day", { n: g.rounds.length, ok: g.ok, a: g.n, xp: g.xp }))}</small></span></summary>${g.rounds.map(roundHTML).join("")}</details>`).join("") : `<p class="wm-mut wm-empty">${h(w("h_0"))}</p>`}`;
  }
  function stageHistHTML(cat, errs) {
    const s = st(), terms = new Set(official().filter(t => t.cat === cat).map(t => t.id));
    let a = 0, ok = 0; const rounds = [];
    for (const r of s.hist || []) { let hit = false; for (const x of r.it || []) if (terms.has(x.t)) { a++; if (x.o) ok++; hit = true; } if (hit) rounds.push(r); }
    const open = errs.filter(e => e.now === "open");
    return `<details class="wm-hd wm-stage-hist"><summary>${wi("clock")}<span><b>${h(w("h_stage"))}</b><small>${a ? h(w("h_stage_n", { a, ok })) + (errs.length ? " · " + h(w("h_err_stage", { n: errs.length, o: open.length })) : "") : h(w("h_stage_0"))}</small></span></summary>
      ${open.length ? `<button class="btn btn-p btn-sm" data-em="practerr" data-a="${h(open.map(e => e.t).join(","))}">${wi("cards")} ${h(w("h_practise_err", { n: open.length }))}</button>` : ""}
      ${errs.length ? `<h4 class="wm-h3">${h(w("h_errors"))}</h4>${errListHTML(errs)}` : ""}
      ${rounds.length ? `<h4 class="wm-h3">${h(w("h_rounds"))}</h4>${rounds.slice(-20).reverse().map(roundHTML).join("")}` : ""}</details>`;
  }

  /* ---- Rewards ---- */
  function rewardsHTML() {
    const s = st(), lv = E.level(xpShown()), sk = E.streak(s, Date.now());
    const bd = badges();
    const stages = E.journey(s, official(), C.categories).filter(j => j.done);
    return `<div class="card wm-lvcard">${wi("medal", "big")}<div><small>${h(w("r_level_h"))}</small><b>${h(w("level", { n: lv.level }))} · ${h(w("xp", { n: lv.xp }))}</b>
        <div class="wm-meter gold" role="progressbar" aria-valuemin="${lv.floor}" aria-valuemax="${lv.next}" aria-valuenow="${lv.xp}" aria-label="${h(w("level", { n: lv.level }))}"><span style="width:${lv.pct}%"></span></div>
        <small>${h(w("xp_next", { n: lv.need, l: lv.level + 1 }))}</small></div></div>
      <p class="wm-mut">${h(w("r_thresh"))}</p>
      <div class="card wm-lvcard">${wi("flame", "big fl")}<div><b>${h(sk.current ? w("streak_d", { n: sk.current }) : w("streak_0"))}</b><small>Best: ${sk.best}</small></div></div>
      ${weekCardHTML()}
      <h2 class="wm-h2">${h(w("bd_h"))}</h2>
      <p class="wm-mut small">${h(w("bd_sub"))}</p>
      <div class="wm-badges">${bd.map(b => { const nx = BADGE_TIERS[b.tier]; return `<div class="wm-badge t${b.tier}">
        <span class="wm-badge-m">${wi(MODE_IC[SKILL_MODE[b.skill]] || "medal")}</span><b>${h(w("skill_" + b.skill))}</b>
        <em>${h(b.tier ? w("bd_t" + b.tier) : w("bd_t0"))}</em>
        <small>${nx ? h(w("bd_next", { n: Math.max(0, nx.n - b.n), acc: nx.acc, tier: w("bd_t" + (b.tier + 1)) })) : h(w("bd_max"))}</small></div>`; }).join("")}</div>
      <h2 class="wm-h2">${h(w("r_ach_h"))}</h2>
      <div class="wm-achs">${E.ACH.map(a => { const got = s.ach[a.id]; return `<div class="wm-ach ${got ? "got" : ""}">
        <span class="wm-ach-ic">${wi(got ? a.ic : "lock")}</span><b>${h(w("ach_" + a.id))}</b><small>${h(w("ach_" + a.id + "_d"))}</small>
        <em>${h(got ? w("r_earned", { d: fmtDate(got) }) : w("r_locked"))}</em></div>`; }).join("")}</div>
      ${stages.length ? `<h2 class="wm-h2">${h(w("cel_stage"))}</h2><div class="wm-chips">${stages.map(j => `<span class="wm-chip ok">${wi("flag")} ${h(catName(j.id))}</span>`).join("")}</div>` : ""}`;
  }

  /* ---- Game Performance: the hub tab and the Progress page share it ---- */
  function perfInner(inHub) {
    const s = st(), now = Date.now(), p = E.performance(s, official(), now), rec = E.recommend(p);
    /* XP here is what the SERVER confirmed: the total it holds, and the awards it answered day by day */
    p.xp = xpShown();
    p.xpSeries = p.xpSeries.map(x => ({ d: x.d, n: x.n, xp: (s.sxd && s.sxd[x.d]) || 0 }));
    const maxXp = Math.max(1, ...p.xpSeries.map(x => x.xp));
    const bar = (pct, cls) => `<span class="wm-meter ${cls || ""}"><span style="width:${pct}%"></span></span>`;
    if (p.empty) return `<div class="wm-perf"><p class="wm-mut">${h(w("p_empty"))}</p><button class="btn btn-p" data-em="${inHub ? "play" : "open"}" data-a="cards">${wi("cards")} ${h(inHub ? w("g_cards") : w("p_open"))}</button></div>`;
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
      ${trendsHTML(inHub)}
      <h3 class="wm-h3">${h(w("p_skills"))}</h3>
      <ul class="wm-bars">${p.skills.map(k => `<li><span>${h(w("skill_" + k.id))}</span>${k.pct == null ? `<em>${h(w("p_skill_na", { n: k.n }))}</em>` : `${bar(k.pct)}<b>${k.pct}%</b>`}</li>`).join("")}</ul>
      <h3 class="wm-h3">${h(w("p_modes"))}</h3>
      <ul class="wm-bars">${p.modes.filter(x => x.runs || x.n).map(x => `<li><span>${wi(MODE_IC[x.id])} ${h(w("g_" + x.id))}</span>${x.pct == null ? `<em>${h(w("runs", { n: x.runs }))}</em>` : `${bar(x.pct)}<b>${x.pct}%</b>`}</li>`).join("") || `<li><em>—</em></li>`}</ul>
      <h3 class="wm-h3">${h(w("p_cats"))}</h3>
      <ul class="wm-bars">${C.categories.map(c => { const n = p.byCat[c.id] || 0; return `<li><span>${h(catName(c.id))}</span>${bar(Math.round(100 * n / c.n), "ok")}<b>${n}/${c.n}</b></li>`; }).join("")}</ul>
      <h3 class="wm-h3">${h(w("p_improved"))}</h3>
      ${p.improved.length || p.newlyMastered.length ? `<ul class="wm-list">${p.improved.map(x => `<li>${wi("chart")} ${h(w("p_impr_skill", { skill: w("skill_" + x.id), from: x.from, to: x.to }))}</li>`).join("")}${p.newlyMastered.length ? `<li>${wi("medal")} ${h(w("p_new_m", { w: p.newlyMastered.map(id => (byId(id) || { en: id }).en).slice(0, 8).join(", ") }))}</li>` : ""}</ul>` : `<p class="wm-mut">${h(w("p_none"))}</p>`}
      ${p.difficult.length ? `<h3 class="wm-h3">${h(w("p_hard"))}</h3><div class="wm-chips">${p.difficult.map(id => byId(id)).filter(Boolean).map(t => `<span class="wm-wchip h">${h(t.en)}</span>`).join("")}</div>` : ""}
      <div class="card wm-rec">${wi(MODE_IC[rec.mode])}<div><small>${h(w("p_rec"))}</small><b>${h(recText(rec))}</b></div><button class="btn btn-p btn-sm" data-em="${inHub ? "play" : "open"}" data-a="${rec.mode}">${h(w("g_" + rec.mode))} →</button></div>
      ${inHub ? `<button class="wm-link" data-em="nav" data-a="review">${wi("chart")} ${h(w("p_go_progress"))} →</button>` : ""}
    </div>`;
  }
  /* ---- 30 / 90-day trends and skill charts: Premium (advanced_progress, the existing capability) ----
     Drawn from the learner's own day records (st.days). The data is the
     learner's own and already on the device, so this is a display gate — the
     same rule the rest of the Progress page uses for advanced_progress. */
  let _trendSpan = 30;
  function trendsLocked() { try { return entGated() && !hasEntitlement("advanced_progress"); } catch (e) { return false; } }
  function trendData(span) {
    const s = st(), today = Date.parse(E.dayOf(Date.now()) + "T00:00:00Z"), days = [];
    for (let i = span - 1; i >= 0; i--) { const d = new Date(today - i * 86_400_000).toISOString().slice(0, 10); const D = s.days[d] || {}; days.push({ d, n: D.n || 0, ok: D.ok || 0, sk: D.sk || {} }); }
    const weeks = []; for (let i = 0; i < days.length; i += 7) { const wk = days.slice(i, i + 7), sk = {}; let n = 0, ok = 0;
      wk.forEach(x => { n += x.n; ok += x.ok; Object.entries(x.sk).forEach(([k, v]) => { const a = sk[k] || (sk[k] = [0, 0]); a[0] += v[0]; a[1] += v[1]; }); });
      weeks.push({ d: wk[0].d, n, ok, acc: n >= 10 ? Math.round(100 * ok / n) : null, sk }); }
    return { days, weeks };
  }
  function lineSVG(points, cls, label) {
    const W = 300, H = 90, P = 8, pts = points.map((v, i) => v == null ? null : [P + i * (W - 2 * P) / Math.max(1, points.length - 1), H - P - (v / 100) * (H - 2 * P)]);
    const path = pts.reduce((a, p, i) => p ? a + (a && pts[i - 1] ? " L" : " M") + p[0].toFixed(1) + " " + p[1].toFixed(1) : a, "");
    return `<svg class="wm-line ${cls || ""}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${h(label)}" preserveAspectRatio="none">
      <line x1="${P}" x2="${W - P}" y1="${H - P - .5 * (H - 2 * P)}" y2="${H - P - .5 * (H - 2 * P)}" class="g"/><line x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}" class="g"/>
      ${path ? `<path d="${path.trim()}"/>` : ""}${pts.filter(Boolean).map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2"/>`).join("")}</svg>`;
  }
  function trendsInner(span) {
    const T = trendData(span), maxN = Math.max(1, ...T.days.map(x => x.n)), any = T.days.some(x => x.n);
    const acc = T.weeks.map(x => x.acc), nAcc = acc.filter(v => v != null).length;
    const sk = E.SKILLS.map(k => { const pts = T.weeks.map(x => { const v = x.sk[k]; return v && v[1] >= 5 ? Math.round(100 * v[0] / v[1]) : null; }); const vals = pts.filter(v => v != null); return { k, pts, last: vals.length ? vals[vals.length - 1] : null, first: vals.length ? vals[0] : null, n: vals.length }; });
    if (!any) return `<p class="wm-mut">${h(w("tr_empty"))}</p>`;
    return `<h4 class="wm-h3">${h(w("tr_act", { n: span }))}</h4>
      <div class="wm-actbars s${span}" role="list" aria-label="${h(w("tr_act", { n: span }))}">${T.days.map(x => `<span role="listitem" title="${h(x.d)}: ${x.n}" aria-label="${h(x.d)}: ${x.n}"><i style="height:${x.n ? Math.max(6, Math.round(100 * x.n / maxN)) : 0}%"></i></span>`).join("")}</div>
      <div class="wm-xpaxis"><span>${h(T.days[0].d.slice(5))}</span><span>${h(T.days[T.days.length - 1].d.slice(5))}</span></div>
      <h4 class="wm-h3">${h(w("tr_acc"))}</h4>
      ${nAcc >= 2 ? lineSVG(acc, "acc", w("tr_acc")) + `<div class="wm-xpaxis"><span>${h(T.weeks[0].d.slice(5))}</span><span>100% · 50%</span><span>${h(T.weeks[T.weeks.length - 1].d.slice(5))}</span></div>` : `<p class="wm-mut small">${h(w("tr_few"))}</p>`}
      <h4 class="wm-h3">${h(w("tr_sk"))}</h4>
      <div class="wm-skgrid">${sk.map(x => `<div class="wm-skc"><b>${h(w("skill_" + x.k))}</b>${x.n >= 2 ? lineSVG(x.pts, "sk", w("skill_" + x.k)) : `<span class="wm-skna">${h(w("tr_few_s"))}</span>`}
        <small>${x.last == null ? "—" : x.last + "%"}${x.n >= 2 && x.first != null ? ` · ${x.last - x.first >= 0 ? "+" : ""}${x.last - x.first}` : ""}</small></div>`).join("")}</div>`;
  }
  function trendsHTML(inHub) {
    const locked = trendsLocked();
    const seg = `<div class="wm-segs sm" role="tablist">${[30, 90].map(n => `<button role="tab" aria-selected="${_trendSpan === n}" class="wm-seg ${_trendSpan === n ? "on" : ""}" data-em="trend" data-a="${n}" ${locked ? "disabled" : ""}>${h(w("tr_days", { n }))}</button>`).join("")}</div>`;
    let lock = ""; if (locked) { try { lock = premLockHTML("advanced_progress", "em_trends", { kept: false }); } catch (e) {} }
    return `<div class="wm-trends ${locked ? "locked" : ""}" id="emTrends"><div class="wm-trends-h"><h3 class="wm-h3">${wi("chart")} ${h(w("tr_h"))} ${locked ? `<span class="wm-chip prem">${wi("crown")} Premium</span>` : ""}</h3>${seg}</div>
      ${locked ? `<div class="wm-trends-prev" aria-hidden="true">${trendsInner(30)}</div>${lock || `<p class="wm-mut">${h(w("tr_lock"))}</p>`}` : trendsInner(_trendSpan)}</div>`;
  }
  /* on the Progress page: a mount that fills itself once the corpus is here */
  function perfCardHTML() {
    if (!on()) return "";
    const body = C ? perfInner(false) : `<p class="wm-mut" role="status">${h(w("loading"))}</p>`;
    if (!C) loadCorpus().then(() => { const m = document.getElementById("emPerfMount"); if (m) m.innerHTML = perfInner(false); }).catch(() => { const m = document.getElementById("emPerfMount"); if (m) m.innerHTML = `<p class="wm-mut">${h(w("load_fail"))}</p>`; });
    return `<section class="card wm-perf-card em em-perf-card" aria-labelledby="emPerfH"><div class="wm-perf-head">${logo("wm-logo-s")}<div><h2 id="emPerfH">${h(w("p_h"))}</h2><p>${h(w("p_sub"))}</p></div></div><div id="emPerfMount">${body}</div></section>`;
  }

  /* ---- the Vocabulary-page portal (replaces the old professional list) ---- */
  function portalHTML() {
    const s = st(); if (!s) return "";
    const m = masteredCount(s), xp = xpShown(), sk = E.streak(s, Date.now()), today = E.dayOf(Date.now());
    const mis = s.mis && s.mis.day === today ? s.mis : null;
    return `<button class="wm-portal em em-portal" data-em="nav" data-a="english" aria-label="${h(w("enter"))}">
      <span class="wm-portal-glow" aria-hidden="true"></span>
      ${logo("wm-logo-p")}
      <span class="wm-portal-t">
        <b class="wm-portal-title">ENGLISH <span>MASTERY</span></b>
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
    const row = (k, label, val, a, b) => `<div class="wm-set-row"><span>${h(label)}</span><div class="wm-segs sm">${[a, b].map(o => `<button class="wm-seg ${val === o[0] ? "on" : ""}" data-em="set" data-a="${k}:${o[0]}" aria-pressed="${val === o[0]}">${h(o[1])}</button>`).join("")}</div></div>`;
    sheet(`<h2>${wi("gear")} ${h(w("set_h"))}</h2>
      ${row("sound", w("set_sound"), set.sound ? "1" : "0", ["1", w("on")], ["0", w("off_")])}
      ${row("motion", w("set_motion"), set.motion === "reduced" ? "reduced" : "auto", ["reduced", w("on")], ["auto", w("off_")])}
      <button class="btn btn-p wm-wide" data-em="sheetclose">${h(w("set_close"))}</button>`);
  }
  function sheet(html) {
    sheetClose();
    const d = document.createElement("div"); d.id = "emSheet"; d.className = "wm-sheet-bg em";
    d.innerHTML = `<div class="wm-sheet" role="dialog" aria-modal="true"><button class="wm-iconbtn wm-sheet-x" data-em="sheetclose" aria-label="${h(w("close"))}">${wi("close")}</button>${html}</div>`;
    d.addEventListener("click", e => { if (e.target === d) sheetClose(); });
    document.body.appendChild(d);
    const f = d.querySelector("button,input"); if (f) f.focus();
  }
  function sheetClose() { const d = document.getElementById("emSheet"); if (d) d.remove(); }

  /* ---- the full learning card (Collection, recent chips, after an answer) ---- */
  function wordSheet(id) {
    const t = byId(id); if (!t) return;
    sheet(fullCardHTML(t, true));
    const d = document.getElementById("emSheet"); if (d) d.dataset.word = id;
  }
  function fullCardHTML(t, withActions, noHead) {
    const s = st(), r = s.t[t.id], fav = E.isFav(s, t.id), hard = r && r.hard;
    let saved = false; try { saved = vocHas(t.en.toLowerCase()); } catch (e) {}
    const sec = (ic, k, o) => o && o.en ? `<div class="wm-f"><b>${wi(ic)} ${h(w(k))}</b><p lang="en">${h(o.en)}</p></div>` : "";
    const sh = compShadow(t.comp);
    return `<div class="wm-full">
      ${noHead ? "" : `<div class="wm-full-h">${catArt(t.cat)}<div><b lang="en">${h(t.en)}</b><small>${h(catName(t.cat))}${t.lvl ? " · " + h(t.lvl) : ""}${t.wk ? " · " + h(lang() === "fr" ? "semaine " + t.wk : "week " + t.wk) : ""}</small></div></div>`}
      <div class="wm-row"><button class="btn btn-g btn-sm" data-em="say" data-a="${h(t.kind === "sentence" ? t.en : clean(t.en))}">${wi("sound")} ${h(w("hear"))}</button>${t.ex && t.ex.en ? `<button class="btn btn-g btn-sm" data-em="say" data-a="${h(t.ex.en)}">${wi("chat")} ${h(w("hear_ex"))}</button>` : ""}</div>
      ${(t.syn || []).length ? `<p class="wm-mut small">${h(w("f_syn"))}: ${h(t.syn.join(" · "))}</p>` : ""}
      ${t.kind === "sentence" ? "" : sec("book", "f_def", t.def)}${t.use && t.use.en && t.use.en !== (t.def && t.def.en || "").replace(/\.$/, "") ? sec("target", "f_use", t.use) : ""}${sec("chat", "f_ex", t.ex)}
      ${glossHTML(t)}
      ${sh && shadowOk() ? `<button class="wm-link" data-em="shadow" data-a="${h(sh.vid)}">${wi("play")} ${h(w("mi_shadow", { t: sh.title }))} →</button>` : ""}
      ${withActions ? `<div class="wm-row wm-full-a">
        <button class="btn btn-g btn-sm wm-star ${fav ? "on" : ""}" data-em="fav" data-a="${h(t.id)}" aria-pressed="${fav}">${wi("star")} ${h(fav ? w("unfav") : w("fav"))}</button>
        ${t.mine ? "" : `<button class="btn btn-g btn-sm ${hard ? "on" : ""}" data-em="hard" data-a="${h(t.id)}" aria-pressed="${!!hard}">${wi("target")} ${h(hard ? w("unmark_hard") : w("mark_hard"))}</button>`}
        ${t.kind === "sentence" ? "" : `<button class="btn btn-g btn-sm" data-em="savelist" data-a="${h(t.id)}" ${saved ? "disabled" : ""}>${wi("book")} ${h(saved ? w("saved_list") : w("save_list"))}</button>`}
      </div>` : ""}
    </div>`;
  }
  /* a competency's Shadow Studio clip (missions.json "shadow"), for its phrases and expressions */
  function compShadow(comp) { if (!comp || !C) return null; const m = C.missions.find(x => x.comp === comp && x.shadow); return m ? m.shadow : null; }
  function shadowOk() { try { return typeof svOn === "function" && svOn() && typeof shLoad === "function"; } catch (e) { return false; } }

  /* ---- the learner's own language ----
     A Foundations sentence carries its translation in the course pack (15
     languages, written for the course). Anything else is translated ON DEMAND
     by the existing chat route and labelled machine translation; the answer is
     cached on this device. The learner's language is the one the app already
     uses for Shadow Studio's Translate (svShLang: their pick, else the app language). */
  let _gl = null; const _glBusy = {};
  function glLang() {
    try { if (typeof svShLang === "function") { const L = svShLang(); return { code: L.code, name: L.name, ok: !!L.ok }; } } catch (e) {}
    const c = (S.profile && S.profile.lang) || "en"; return { code: c, name: c, ok: c !== "en" };
  }
  function glCache() { if (!_gl) { try { _gl = JSON.parse(localStorage.getItem("be_em_gl") || "{}") || {}; } catch (e) { _gl = {}; } } return _gl; }
  function glSave() { const c = glCache(), ks = Object.keys(c); while (ks.length > 800) delete c[ks.shift()]; try { localStorage.setItem("be_em_gl", JSON.stringify(c)); } catch (e) {} }
  function glossOf(t) {
    const L = glLang(); if (!L.ok) return null;
    if (t.gl && t.gl[L.code]) return { text: t.gl[L.code], pack: true };
    const c = glCache()[t.id + ":" + L.code]; return c ? { text: c, pack: false } : null;
  }
  function glossHTML(t) {
    const L = glLang(); if (!L.ok) return "";
    const g = glossOf(t);
    if (g) return `<div class="wm-f em-gl"><b>${wi("globe")} ${h(w("f_gl"))}</b><p lang="${h(L.code)}" dir="auto">${h(g.text)}</p><small class="wm-mut">${h(g.pack ? w("f_gl_pack") : w("gl_ai"))}</small></div>`;
    const busy = _glBusy[t.id + ":" + L.code];
    return `<div class="em-gl-btn"><button class="btn btn-g btn-sm" data-em="gloss" data-a="${h(t.id)}" ${busy || !signedIn() ? "disabled" : ""}>${wi("globe")} ${h(busy ? w("gl_busy") : w("gl_btn"))}</button>${signedIn() ? "" : `<small class="wm-mut">${h(w("gl_none"))}</small>`}</div>`;
  }
  async function glossFetch(id) {
    const t = byId(id), L = glLang(); if (!t || !L.ok) return;
    const key = t.id + ":" + L.code; if (_glBusy[key] || glossOf(t)) return;
    if (!signedIn() || !navigator.onLine) { toast(w("gl_none")); return; }
    _glBusy[key] = 1; regloss();
    const system = `You are a translator for an English course. Translate the English into ${L.name}. Keep the meaning and the register; for a phrase that ends in "…", translate it as an unfinished phrase. Respond with ONLY minified JSON: {"reply":"<translation of the item> — <translation of the example>"}`;
    try {
      const r = await fetch(POLISH_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat: { purpose: "practice", system, messages: [{ role: "user", content: clean(t.en) + (t.ex && t.ex.en ? "\nExample: " + t.ex.en : "") }] } }) });
      const j = await r.json().catch(() => ({}));
      const tx = String((j && j.reply) || "").trim();
      if (!r.ok || !tx) throw new Error("tr");
      glCache()[key] = tx.slice(0, 400); glSave();
    } catch (e) { toast(w("gl_none")); }
    delete _glBusy[key]; regloss();
  }
  function regloss() { const sh = document.getElementById("emSheet"); if (sh && sh.dataset.word) return wordSheet(sh.dataset.word); if (_G) draw(); }

  /* ------------------------------------------------------------ the daily habit
     One daily challenge (the same eight words for every Welding learner that
     UTC day, all ten stages mixed), a weekly goal of practice days, skill badges
     earned from real answers, and one visible next goal. */
  const WEEK_GOAL = 5;
  const BADGE_TIERS = [{ n: 20, acc: 60 }, { n: 60, acc: 75 }, { n: 150, acc: 85 }];   // bronze · silver · gold
  function dailyIds() {
    const day = E.dayOf(Date.now()), seed = E.hash("em-daily:" + day), out = [];
    const cats = C.categories.filter(c => c.id !== "first").map(c => c.id), byCat = {};
    official().filter(t => t.kind !== "sentence").forEach(t => (byCat[t.cat] = byCat[t.cat] || []).push(t.id));
    E.shuffle(cats, seed).slice(0, 8).forEach((c, i) => { const ids = byCat[c] || []; out.push(ids[(seed >>> (i % 16)) % ids.length]); });
    return out;
  }
  function weekDays() {
    const s = st(), now = new Date(), dow = (now.getUTCDay() + 6) % 7, out = [];
    for (let i = 0; i < 7; i++) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow + i)).toISOString().slice(0, 10); out.push({ d, on: !!(s.days[d] && s.days[d].n > 0), today: i === dow, future: i > dow }); }
    return out;
  }
  function skillTotals() {
    const s = st(), t = {}; E.SKILLS.forEach(k => t[k] = [0, 0]);
    Object.values(s.days || {}).forEach(D => Object.entries(D.sk || {}).forEach(([k, v]) => { if (t[k]) { t[k][0] += v[0]; t[k][1] += v[1]; } }));
    return t;
  }
  function badgeOf(v) { const acc = v[1] ? 100 * v[0] / v[1] : 0; let tier = 0; BADGE_TIERS.forEach((b, i) => { if (v[1] >= b.n && acc >= b.acc) tier = i + 1; }); return { tier, n: v[1], acc: Math.round(acc) }; }
  function badges() { const t = skillTotals(); return E.SKILLS.map(k => Object.assign({ skill: k }, badgeOf(t[k]))); }
  /* newly earned badges since the last check (kept so a badge is celebrated once) */
  function badgeCheck() {
    const s = st(); s.bdg = s.bdg || {}; const got = [];
    badges().forEach(b => { if (b.tier > (s.bdg[b.skill] || 0)) { s.bdg[b.skill] = b.tier; got.push(b); } });
    if (got.length) persist();
    return got;
  }
  function nextGoal() {
    if (!dailyDone()) return { text: w("ng_daily"), act: "daily" };
    const wk = weekDays(), done = wk.filter(x => x.on).length;
    if (done < WEEK_GOAL) return { text: w("ng_week", { n: WEEK_GOAL - done }), act: "play", a: "quiz" };
    const close = badges().filter(b => b.tier < 3).map(b => { const nx = BADGE_TIERS[b.tier]; return { b, need: Math.max(0, nx.n - b.n), acc: nx.acc }; }).sort((x, y) => x.need - y.need)[0];
    if (close) return { text: w("ng_badge", { n: Math.max(1, close.need), skill: w("skill_" + close.b.skill), tier: w("bd_t" + (close.b.tier + 1)), acc: close.acc }), act: "play", a: SKILL_MODE[close.b.skill] || "quiz" };
    const lv = E.level(xpShown());
    return { text: w("xp_next", { n: lv.need, l: lv.level + 1 }), act: "play", a: "quiz" };
  }
  const SKILL_MODE = E.SKILL_MODE;
  function dailyCardHTML() {
    const done = dailyDone(), signed = signedIn();
    const ms = Math.max(0, Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1) - Date.now());
    return `<button class="wm-daily ${done ? "done" : ""}" data-em="${done ? "tab" : "daily"}" data-a="${done ? "rewards" : ""}">
      <span class="wm-daily-burst" aria-hidden="true"></span>
      <span class="wm-daily-ic ${ART3D.daily && !done ? "a3" : ""}">${done ? wi("check") : art3d("daily", "star")}</span>
      <span class="wm-daily-t"><small>${h(w("dc_h"))} · ${h(fmtDate(Date.now()))}</small>
        <b>${h(done ? w("dc_done_h") : w("dc_t"))}</b>
        <em>${h(done ? w("dc_next", { h: Math.floor(ms / 3600_000), m: Math.round((ms % 3600_000) / 60_000) }) : w("dc_sub"))}</em></span>
      <span class="wm-daily-xp">${done ? wi("check") : `+${30}<i>XP</i>`}</span>
      ${signed ? "" : `<span class="wm-daily-lock">${wi("lock")} ${h(w("au_short"))}</span>`}
    </button>`;
  }
  function weekCardHTML() {
    const wk = weekDays(), done = wk.filter(x => x.on).length, L = lang() === "fr" ? ["L", "M", "M", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"];
    return `<div class="card wm-week"><div class="wm-week-h">${wi("flame")}<span><small>${h(w("wk_h"))}</small><b>${h(w("wk_b", { n: done, g: WEEK_GOAL }))}</b></span>${done >= WEEK_GOAL ? `<span class="wm-chip ok">${wi("check")} ${h(w("wk_done"))}</span>` : ""}</div>
      <div class="wm-week-dots" role="list">${wk.map((x, i) => `<span role="listitem" class="wm-dotd ${x.on ? "on" : ""} ${x.today ? "today" : ""} ${x.future ? "fut" : ""}" aria-label="${h(x.d)}${x.on ? " ✓" : ""}"><i>${x.on ? wi("check") : ""}</i><small>${L[i]}</small></span>`).join("")}</div></div>`;
  }
  function energyChipHTML() {
    const e = energyLeft();
    if (!signedIn()) return "";
    if (e === Infinity) return `<span class="wm-stat en prem" role="listitem" aria-label="${h(w("en_unl"))}" title="${h(w("en_unl"))}">${wi("bolt")}<b aria-hidden="true">∞</b></span>`;
    if (e == null) return `<span class="wm-stat en" role="listitem">${wi("bolt")}<b>–</b></span>`;
    return `<span class="wm-stat en ${e ? "" : "out"}" role="listitem" aria-label="${h(w("en_left", { n: e, g: 5 }))}" title="${h(w("en_left", { n: e, g: 5 }))}">${wi("bolt")}<b aria-hidden="true">${e}</b></span>`;
  }

  /* ------------------------------------------------------------ the server (be-polish, wm-game.js)
     Energy, the round ticket and XP are decided there, for a verified Welding
     account. The app keeps a display copy of the last answer (S.wm.welding.sx),
     never a figure of its own: XP is what the server says it is. */
  const EM_CHARGED = new Set(["quiz", "sentence", "listen", "speak", "match", "puzzle", "missions", "advanced"]);
  let _srv = null, _pack = null;
  function signedIn() { try { return typeof FBUser !== "undefined" && !!FBUser; } catch (e) { return false; } }
  async function srv(op, extra) {
    const r = await fetch(POLISH_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wm: Object.assign({ op, prog: PROG }, extra || {}) }) });
    let j = null; try { j = await r.json(); } catch (e) {}
    return { status: r.status, j };
  }
  function srvApply(j) {
    if (!j || !j.energy || !j.xp) return;
    _srv = { plan: j.plan, energy: j.energy, daily: j.daily, day: j.day, at: Date.now() };
    const s = st(); if (!s) return;
    s.sx = { total: j.xp.total || 0, today: j.xp.today || 0, day: j.day, daily: !!(j.daily && j.daily.done), plan: j.plan, at: Date.now() };
  }
  function xpShown() { const s = st(); return s && s.sx ? s.sx.total || 0 : 0; }
  function dailyDone() { const s = st(); return !!(s && s.sx && s.sx.day === E.dayOf(Date.now()) && s.sx.daily); }
  function isPremium() { return !!(_srv && _srv.plan === "premium") || !!(st() && st().sx && st().sx.plan === "premium"); }
  function energyLeft() { if (!_srv || !_srv.energy || _srv.day !== E.dayOf(Date.now())) return null; return _srv.energy.limit == null ? Infinity : Math.max(0, _srv.energy.limit - _srv.energy.used); }
  async function srvRefresh() {
    if (!on() || !signedIn()) return;
    try { const r = await srv("status"); if (r.status === 200) { srvApply(r.j); persist(); await flushPending(); redraw(); } } catch (e) {}
  }
  /* a finish the server never confirmed (offline, a dropped connection) is
     kept and sent again; the server pays a round once, so a resend is safe */
  async function flushPending() {
    const s = st(); if (!s || !Array.isArray(s.pend) || !s.pend.length) return;
    const left = [];
    for (const p of s.pend.slice(0, 20)) {
      try { const r = await srv("finish", p); if (r.status === 200) { srvApply(r.j); logAward(r.j.awarded, r.j.day); } else if (r.status >= 500 || r.status === 429) left.push(p); }
      catch (e) { left.push(p); }
    }
    s.pend = left; persist();
  }
  function logAward(xp, day) { const s = st(); if (!s || !(xp > 0)) return; s.sxd = s.sxd || {}; const d = day || E.dayOf(Date.now()); s.sxd[d] = (s.sxd[d] || 0) + xp; const ks = Object.keys(s.sxd).sort(); while (ks.length > 120) delete s.sxd[ks.shift()]; }
  function rid(mode) { return (String(mode).replace(/[^a-z]/g, "") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)).slice(0, 48); }
  function authSheet() {
    sheet(`<h2>${wi("lock")} ${h(w("au_h"))}</h2><p class="wm-mut">${h(w("au_b"))}</p>
      <button class="btn btn-p wm-wide" data-em="signin">${h(w("au_btn"))}</button>`);
  }
  function energySheet(j) {
    const ms = Math.max(0, ((j && j.resetAt) || 0) - Date.now()), hh = Math.floor(ms / 3600_000), mm = Math.round((ms % 3600_000) / 60_000);
    let offer = false; try { offer = premOffered(); } catch (e) {}
    sheet(`<div class="wm-en-sheet"><span class="wm-en-big">${wi("bolt")}</span><h2>${h(w("en_out_h"))}</h2>
      <p>${h(w("en_out_b", { h: hh, m: mm }))}</p>
      <ul class="wm-list"><li>${wi("check")} ${h(w("en_keep1"))}</li><li>${wi("check")} ${h(w("en_keep2"))}</li><li>${wi("check")} ${h(w("en_keep3"))}</li></ul>
      <div class="wm-row"><button class="btn btn-g" data-em="play" data-a="cards">${wi("cards")} ${h(w("en_cards"))}</button>${dailyDone() ? "" : `<button class="btn btn-g" data-em="daily">${wi("star")} ${h(w("dc_play"))}</button>`}</div>
      ${offer ? `<button class="btn btn-p wm-wide wm-prem-btn" data-em="premium" data-a="em_energy">${wi("crown")} ${h(w("en_prem"))}</button>` : ""}</div>`);
  }
  function msgSheet(icon, head, body) { sheet(`<h2>${wi(icon)} ${h(head)}</h2><p class="wm-mut">${h(body)}</p><button class="btn btn-p wm-wide" data-em="sheetclose">${h(w("close"))}</button>`); }

  /* ------------------------------------------------------------ games
     What each game draws from, in the order the CURRICULUM suggests: the
     learner's current week of the 12-week plan first (and the week after),
     then everyday English, then First steps (first for a learner placed in
     Foundations), then the rest. Due and difficult items still come first —
     that is the engine's spaced-repetition rule (E.pick). */
  const SIZE = { cards: 10, quiz: 8, sentence: 6, listen: 6, speak: 5, match: 10, puzzle: 6, missions: 4 };
  function curWeek() { try { return typeof currentPos === "function" ? (currentPos().w || 1) : 1; } catch (e) { return 1; } }
  function inFoundations() { try { return typeof fndGated === "function" && fndGated(); } catch (e) { return false; } }
  function rank(t, wk, fnd) {
    if (t.cat === "first") return fnd ? 0 : 3;
    if (t.wk) { const d = Math.abs(t.wk - wk); return d <= 1 ? (fnd ? 2 : 0) : 4 + d; }
    return t.mine ? 2 : 1;
  }
  function aligned(list) { const wk = curWeek(), fnd = inFoundations(); return list.map((t, i) => ({ t, i, r: rank(t, wk, fnd) })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.t); }
  const words = s => clean(s).split(/\s+/).filter(Boolean);
  function poolFor(mode) {
    const all = mode === "cards" ? allTerms() : official();
    if (mode === "cards") return all;
    if (mode === "sentence") return all.filter(t => { const n = words(sentenceOf(t)).length; return n >= 4 && n <= 12; });
    if (mode === "speak") return all.filter(t => { const n = words(sentenceOf(t)).length; return n >= 3 && n <= 14; });
    if (mode === "puzzle") return all.filter(t => /^[A-Za-z]{3,12}$/.test(t.en) && t.def && t.def.en);
    if (mode === "listen") return all.filter(t => t.kind === "sentence" || (t.def && t.def.en));
    return all.filter(t => t.kind !== "sentence");   // quiz, match: words and phrases with a meaning
  }
  function chooseMissions(o) {
    const s = st();
    if (o.advanced) return (_pack && _pack.scenarios || []).slice().sort((a, b) => (s.ws[a.id] || 0) - (s.ws[b.id] || 0) || (a.id < b.id ? -1 : 1)).slice(0, 5).map(x => x.id);
    const wk = curWeek();
    const near = m => m.wk ? Math.abs(m.wk - wk) : 1;   // everyday situations sit beside the current week
    return C.missions.filter(m => !o.cat || m.cat === o.cat).slice().sort((a, b) => (s.ws[a.id] || 0) - (s.ws[b.id] || 0) || near(a) - near(b) || (a.id < b.id ? -1 : 1)).slice(0, o.n || SIZE.missions).map(x => x.id);
  }
  function chooseIds(mode, opts) {
    const s = st(), now = Date.now(), o = opts || {};
    if (mode === "missions") return chooseMissions(o);
    let pool = aligned(poolFor(mode));
    if (o.ids) { const set = new Set(o.ids); pool = pool.filter(t => set.has(t.id)); if (o.keepOrder) return o.ids.filter(id => pool.some(t => t.id === id)).slice(0, o.n || 20); }
    if (o.cat) pool = pool.filter(t => t.cat === o.cat);
    const filter = o.onlyNew ? id => !s.t[id] || !s.t[id].n : o.onlyDue ? id => s.t[id] && s.t[id].n && s.t[id].due <= now : null;
    const n = o.n || SIZE[mode];
    /* Quick Quiz carries two grammar questions, Sentence Builder one "find the correct sentence" */
    const g = !o.cat && !o.ids && !filter ? (mode === "quiz" ? 2 : mode === "sentence" ? 1 : 0) : 0;
    let ids = E.pick(s, pool.map(t => t.id), n - g, now, filter);
    if (ids.length < (o.min || 1) && filter) ids = E.pick(s, pool.map(t => t.id), n - g, now);
    if (g && C.grammar.length) {
      const gp = C.grammar.filter(x => mode === "quiz" ? x.cat !== "correction" : x.cat === "correction").map(x => x.id);
      E.pick(s, gp, g, now).forEach((gid, k) => ids.splice(Math.min(ids.length, 2 + k * 3), 0, gid));
    }
    return ids;
  }
  function canRecord() { try { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); } catch (e) { return false; } }
  function start(mode, opts) {
    if (!on() || !C) return;
    const o = opts || {};
    if (mode === "listen" && !canSpeak()) { gameOpen(mode, `<div class="wm-g-msg">${wi("headphones", "big")}<p>${h(w("l_no_audio"))}</p><button class="btn btn-p" data-em="gclose">${h(w("close"))}</button></div>`); return; }
    if (mode === "speak" && !canRecord()) { gameOpen(mode, `<div class="wm-g-msg">${wi("mic", "big")}<p>${h(w("sp_mic"))}</p><button class="btn btn-p" data-em="gclose">${h(w("close"))}</button></div>`); return; }
    const ids = o.resume ? o.resume.ids : o.daily ? dailyIds() : chooseIds(mode, o);
    if (!ids.length || (mode === "match" && ids.length < 4) || (mode === "quiz" && official().length < 4)) { gameOpen(mode, `<div class="wm-g-msg"><p>${h(w("none_words"))}</p><button class="btn btn-p" data-em="gclose">${h(w("close"))}</button></div>`); return; }
    /* every round needs a signed-in account: XP is awarded and saved by the server */
    if (!signedIn()) return authSheet();
    const sid = o.resume ? o.resume.sid : rid(mode);
    const smode = o.daily || (o.resume && o.resume.daily) ? "daily" : o.advanced || (o.resume && o.resume.adv) ? "advanced" : mode;
    const begin = (ticket, offline) => {
      const prevLog = o.resume ? E.histRound(st(), sid) : null;
      _G = { log: prevLog && prevLog.it ? prevLog.it.map(x => ({ ok: x.o, t: x.t, s: x.s, k: x.k, p: x.p, q: x.q, h: x.h })) : [], t0: prevLog ? prevLog.ts : Date.now(), mode, ids, i: o.resume ? o.resume.i : 0, sid, n: o.resume ? o.resume.n || 0 : 0, ok: o.resume ? o.resume.ok || 0 : 0, xp: 0, mastered: [], combo: 0, seed: E.hash(sid), opts: o, step: 0, st: {},
        smode, ticket, offline: !!offline, daily: smode === "daily", adv: smode === "advanced" };
      if (mode === "match") return matchRound();
      draw();
    };
    _G = null;
    gameOpen(mode, `<div class="wm-g-msg" role="status">${wi("bolt", "big")}<p>${h(w(EM_CHARGED.has(smode) && !isPremium() ? "en_check" : "en_open"))}</p></div>`);
    srv("start", { sid, mode: smode }).then(r => {
      if (r.status === 200 && r.j && r.j.ticket) { srvApply(r.j); persist(); return begin(r.j.ticket, false); }
      gameClose();
      if (r.status === 429 && r.j && r.j.error === "energy") { if (_srv && _srv.energy) _srv.energy.used = _srv.energy.limit; return energySheet(r.j); }
      if (r.status === 401) return authSheet();
      if (r.status === 402) return premiumAsk("em_advanced");
      if (r.status === 403 && r.j && r.j.error === "track") return msgSheet("map", w("trk_h"), w("trk_b"));
      return offlineStart();
    }).catch(() => { gameClose(); offlineStart(); });
    /* the server cannot be reached: nothing is charged. Review (Word Quest) still
       runs, without XP; a challenge waits for a connection rather than run unaccounted. */
    function offlineStart() {
      if (EM_CHARGED.has(smode) || smode === "daily") return msgSheet("bolt", w("off_h"), w("off_b"));
      begin(null, true);
    }
  }
  function premiumAsk(from) {
    let offer = false; try { offer = premOffered(); } catch (e) {}
    sheet(`<div class="wm-en-sheet"><span class="wm-en-big prem">${wi("crown")}</span><h2>${h(w("pr_h"))}</h2><p>${h(w("pr_b"))}</p>
      <ul class="wm-list"><li>${wi("bolt")} ${h(w("pr_1"))}</li><li>${wi("chat")} ${h(w("pr_2"))}</li><li>${wi("chart")} ${h(w("pr_3"))}</li><li>${wi("spark")} ${h(w("pr_4"))}</li></ul>
      ${offer ? `<button class="btn btn-p wm-wide wm-prem-btn" data-em="premium" data-a="${h(from)}">${wi("crown")} ${h(w("pr_btn"))}</button>` : `<p class="wm-mut small">${h(w("pr_soon"))}</p>`}</div>`);
  }
  function startMission() {
    const s = st(), m = s.mis; if (!m || m.done) return;
    const left = m.target - m.prog;
    if (m.kind === "start5") return start("cards", { onlyNew: true, n: Math.max(left, 1) });
    if (m.kind === "hard5") return start("cards", { ids: m.ids, keepOrder: true, n: 10 });
    if (m.kind === "due5") return start("cards", { onlyDue: true, n: Math.max(left + 2, 5) });
    if (m.kind === "speak3") return start("speak", { n: Math.max(left + 2, 4) });
    if (m.kind === "sentence3") return start("sentence", { n: Math.max(left + 2, 5) });
    return start(m.mode);
  }
  function gameOpen(mode, inner) {
    let ov = document.getElementById("emGame");
    if (!ov) { ov = document.createElement("div"); ov.id = "emGame"; ov.className = "wm-game em"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); document.body.appendChild(ov); }
    const G = _G, prog = G && G.ids ? `${Math.min(G.i + 1, G.ids.length)}/${G.ids.length}` : "";
    const title = G && G.daily ? w("g_daily") : G && G.adv ? w("g_advanced") : w("g_" + mode);
    ov.setAttribute("aria-label", title);
    ov.innerHTML = `<div class="wm-g-in"><div class="wm-g-top"><button class="wm-iconbtn" data-em="gclose" aria-label="${h(w("close"))}">${wi("close")}</button>
      <span class="wm-g-title">${wi(G && G.daily ? "star" : G && G.adv ? "crown" : MODE_IC[mode])} ${h(title)}</span>
      <span class="wm-g-prog">${G && G.combo >= 3 ? `<i class="wm-combo">${wi("flame")} ${h(w("combo", { n: G.combo }))}</i>` : ""}${h(prog)}</span></div>
      ${G && G.ids && mode !== "crossword" ? `<div class="wm-meter thin"><span style="width:${Math.round(100 * G.i / G.ids.length)}%"></span></div>` : ""}
      <div class="wm-g-body" id="emGBody">${inner}</div></div>`;
    ov.classList.add("show"); document.body.style.overflow = "hidden";
    document.documentElement.classList.toggle("wm-still", reduced());
    const f = ov.querySelector(".wm-g-body [autofocus], .wm-g-body input, .wm-g-body button"); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  /* the round goes into the history whether it was finished or left part-way */
  function logRound(part) {
    const G = _G; if (!G || !G.log.length) return;
    const cats = G.log.map(x => { const t = x.t && byId(x.t); return t ? t.cat : null; });
    E.logRound(st(), { id: G.sid, mode: G.daily ? "daily" : G.adv ? "advanced" : G.mode, ts: G.t0, n: G.n, ok: G.ok, xp: G.xp, items: G.log, cats, part }, Date.now());
    persist();
  }
  function gameClose() {
    if (_G && !_G.done) try { logRound(true); } catch (e) {}
    const ov = document.getElementById("emGame"); if (ov) { ov.classList.remove("show"); ov.innerHTML = ""; }
    document.body.style.overflow = ""; try { speechSynthesis.cancel(); } catch (e) {}
    _G = null; redraw();
    /* back in the hub: the full-screen break a FINISHED round armed (AdManager decides if it shows) */
    try { if (typeof AdManager !== "undefined" && typeof cur !== "undefined" && cur) AdManager.afterNav(cur.v); } catch (e) {}
  }
  function saveResume() {
    const G = _G; if (!G || G.mode === "match") return;
    st().resume = { mode: G.mode, ids: G.ids, i: G.i, sid: G.sid, n: G.n, ok: G.ok, ts: Date.now(), daily: G.daily ? 1 : 0, adv: G.adv ? 1 : 0 };
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
    if (g.mastered) { const t = byId(id); G.mastered.push(id); celebrate("mastered", w("cel_mastered"), t ? clean(t.en) : ""); }
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
    if (G.mode === "missions") G.ids.forEach(id => { s.ws[id] = (s.ws[id] || 0) + 1; });
    const a = E.checkAchievements(s, official(), now); G.xp += a.xp;
    G.done = true; logRound(false);
    const names = G.mastered.map(id => clean((byId(id) || { en: id }).en));
    const newBadges = badgeCheck();
    gameOpen(G.mode, `<div class="wm-end ${G.daily ? "daily" : ""}">
      <span class="wm-end-ic">${wi(G.daily ? "star" : G.ok >= G.n * 0.8 && G.n ? "trophy" : "check", "big")}</span>
      <h2>${h(w(G.daily ? "dc_done_h" : "end_h"))}</h2>
      <p class="wm-end-score">${h(w("end_score", { ok: G.ok, n: G.n }))}</p>
      <p class="wm-end-xp" id="emEndXp" role="status">${G.offline ? h(w("end_offline")) : `${wi("xp")} ${h(w("end_saving"))}`}</p>
      ${G.missionDone ? `<p class="wm-chip ok">${wi("check")} ${h(w("shift_done"))}</p>` : ""}
      ${newBadges.map(b => `<p class="wm-chip badge t${b.tier}">${wi("medal")} ${h(w("bd_new", { skill: w("skill_" + b.skill), tier: w("bd_t" + b.tier) }))}</p>`).join("")}
      <div class="card wm-next">${wi("target")}<div><small>${h(w("ng_h"))}</small><b>${h(nextGoal().text)}</b></div></div>
      ${names.length ? `<p class="wm-end-m">${wi("medal")} ${h(w("end_mastered", { w: names.join(", ") }))}</p>` : ""}
      <div class="wm-row center"><button class="btn btn-g" data-em="again">${h(w("end_again"))}</button><button class="btn btn-p" data-em="gclose">${h(w("end_hub"))}</button></div>
      <div class="wm-ad-host wm-ad-end"></div>
      ${endLinksHTML(G)}
    </div>`);
    if (a.got.length) achCelebrate(a.got);
    /* the round is over: a banner under the actions (never beside them), and a full-screen break for when the learner leaves */
    try { if (typeof AdManager !== "undefined") { AdManager.markBreak("game_complete"); setTimeout(() => { const ov = document.getElementById("emGame"), e = ov && ov.querySelector(".wm-ad-end"); if (e) AdManager._fillSlot("game_end", e, "append"); }, 400); } } catch (e) {}
    newBadges.forEach((b, i) => setTimeout(() => celebrate("ach", w("bd_new_h"), w("bd_new", { skill: w("skill_" + b.skill), tier: w("bd_t" + b.tier) })), 900 * (i + 1)));
    if (G.ok === G.n && G.n >= 5 && !a.got.length && !newBadges.length) celebrate("round", w("end_h"), w("end_score", { ok: G.ok, n: G.n }));
    G.done = true;
    if (G.ticket && !G.offline) {
      const fin = { sid: G.sid, mode: G.smode, ticket: G.ticket, n: G.n, ok: G.ok };
      const out = (txt) => { const el = document.getElementById("emEndXp"); if (el) el.innerHTML = txt; };
      srv("finish", fin).then(r => {
        if (r.status === 200 && r.j) {
          srvApply(r.j); logAward(r.j.awarded, r.j.day); persist();
          const xp = r.j.awarded || 0;
          out(xp ? `${wi("xp")} ${h(w("end_xp", { n: xp }))}${r.j.dailyBonus ? ` <span class="wm-chip ok">${h(w("dc_bonus", { n: r.j.dailyBonus }))}</span>` : ""}` : h(w(r.j.duplicate ? "end_xp_dup" : "end_xp0")));
          if (r.j.dailyBonus) celebrate("stage", w("dc_done_h"), w("dc_bonus", { n: r.j.dailyBonus }));
        } else if (r.status >= 500 || r.status === 429) { pendPush(fin); out(h(w("end_pending"))); }
        else out(h(w("end_xp0")));
      }).catch(() => { pendPush(fin); out(h(w("end_pending"))); });
    }
  }
  function pendPush(fin) { const s = st(); s.pend = (s.pend || []).filter(p => p.sid !== fin.sid).concat(fin).slice(-30); persist(); }
  function feedbackHTML(t, okFlag, extra) {
    return `<div class="wm-fb ${okFlag ? "ok" : "no"}" role="status">${wi(okFlag ? "check" : "cross")}<div><b>${h(okFlag ? w("ok") : w("no"))}</b>${okFlag ? "" : `<span>${h(w("the_answer", { w: t.en }))}</span>`}
      ${t.kind === "sentence" ? "" : `<p lang="en">${h(t.def.en)}</p>`}${t.ex && t.ex.en ? `<p lang="en"><i>“${h(t.ex.en)}”</i></p>` : ""}${extra || ""}${glossHTML(t)}</div></div>
      <button class="btn btn-p wm-wide" data-em="next" autofocus>${h(w("next"))} →</button>`;
  }
  function gramFeedbackHTML(g, okFlag) {
    return `<div class="wm-fb ${okFlag ? "ok" : "no"}" role="status">${wi(okFlag ? "check" : "cross")}<div><b>${h(okFlag ? w("ok") : w("no"))}</b>${okFlag ? "" : `<span lang="en">${h(w("the_answer", { w: g.o[g.a] }))}</span>`}<p lang="en">${h(g.why)}</p></div></div>
      <button class="btn btn-p wm-wide" data-em="next" autofocus>${h(w("next"))} →</button>`;
  }
  const optsHTML = (list, ans, rightId, act, lbl) => `<div class="wm-opts" role="group">${list.map(id => { const cls = ans != null ? (id === rightId ? "correct" : id === ans ? "wrong" : "") : ""; return `<button class="wm-opt ${cls}" data-em="${act}" data-a="${h(id)}" ${ans != null ? "disabled" : ""}>${h(lbl(id))}</button>`; }).join("")}</div>`;

  /* -- Game 1: Word Quest (cards) -- */
  function cardsHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    return `<div class="wm-card ${G.st.flipped ? "flipped" : ""}">
        <div class="wm-card-front">${catArt(t.cat)}<small>${h(catName(t.cat))}${t.lvl ? " · " + h(t.lvl) : ""}</small><b class="wm-card-w ${t.kind === "sentence" ? "long" : ""}" lang="en">${h(t.en)}</b>
          <button class="btn btn-g btn-sm" data-em="say" data-a="${h(t.kind === "sentence" ? t.en : clean(t.en))}">${wi("sound")} ${h(w("hear"))}</button></div>
        ${G.st.flipped ? `<div class="wm-card-back">${fullCardHTML(t, true, true)}</div>` : ""}
      </div>
      ${G.st.flipped ? `<p class="wm-rate-q">${h(w("rate_q"))}</p><div class="wm-rate">${[["again", 0], ["hard", 1], ["good", 2], ["easy", 3]].map(([k, q]) => `<button class="wm-rate-b r${q}" data-em="rate" data-a="${q}">${h(w(k))}</button>`).join("")}</div>`
        : `<button class="btn btn-p wm-wide" data-em="flip" autofocus>${h(w("reveal"))}</button>`}`;
  }

  /* -- Game 2: Quick Quiz (words, phrases and grammar) -- */
  const quizPool = () => official().filter(t => t.kind !== "sentence");
  function quizQ(t, seed) {
    const r = E.rng(seed), types = ["def"].concat(t.ex && t.ex.en && blank(t.ex.en, t) !== t.ex.en ? ["ex"] : []).concat(t.use && t.use.en && t.kind === "phrase" ? ["use"] : []);
    const type = types[Math.floor(r() * types.length)];
    const opts = E.shuffle([t.id].concat(E.distractors(quizPool(), t.id, 3, seed, { label: x => x.en })), seed + 7);
    const prompt = type === "def" ? `<p class="wm-q-clue" lang="en">“${h(blank(t.def.en, t))}”</p>` : type === "ex" ? `<p class="wm-q-clue" lang="en">“${h(blank(t.ex.en, t))}”</p>` : `<p class="wm-q-clue" lang="en">${h(t.use.en)}</p>`;
    return { type, opts, prompt, skill: type === "def" ? "recognition" : "context" };
  }
  function quizHTML() {
    const G = _G, id = G.ids[G.i], g = gram(id);
    if (g) {
      const ans = G.st.ans;
      return `<p class="wm-q-h">${h(w("q_gram"))}</p><div class="wm-q-p"><p class="wm-q-clue" lang="en">${h(g.q)}</p></div>
        ${optsHTML(g.o.map((_, k) => String(k)), ans, String(g.a), "gpick", k => g.o[+k])}${ans != null ? gramFeedbackHTML(g, +ans === g.a) : ""}`;
    }
    const t = byId(id); if (!t) { setTimeout(nextItem, 0); return ""; }
    const Qz = G.st.q || (G.st.q = quizQ(t, G.seed + G.i * 31)), ans = G.st.ans;
    return `<p class="wm-q-h">${h(w({ def: "q_def", ex: "q_ex", use: "q_use" }[Qz.type]))}</p>
      <div class="wm-q-p">${Qz.prompt}</div>
      ${optsHTML(Qz.opts, ans, t.id, "qpick", x => clean((byId(x) || { en: x }).en))}
      ${ans ? feedbackHTML(t, ans === t.id) : ""}`;
  }

  /* -- Game 3: Sentence Builder (word order, and "find the correct sentence") -- */
  const toks = s => clean(s).split(/\s+/).filter(Boolean);
  function sentHTML() {
    const G = _G, id = G.ids[G.i], g = gram(id), S2 = G.st;
    if (g) {
      return `<p class="wm-q-h">${h(w("s_fix"))}</p>${optsHTML(g.o.map((_, k) => String(k)), S2.ans, String(g.a), "fpick", k => g.o[+k])}${S2.ans != null ? gramFeedbackHTML(g, +S2.ans === g.a) : ""}`;
    }
    const t = byId(id); if (!t) { setTimeout(nextItem, 0); return ""; }
    const target = toks(sentenceOf(t));
    if (!S2.tiles) { let sh = E.shuffle(target.map((x, k) => k), G.seed + G.i), guard = 0; while (target.length > 2 && sh.every((v, k) => target[v] === target[k]) && guard++ < 10) sh = E.shuffle(sh, G.seed + G.i + guard); S2.tiles = sh.map(k => ({ w: target[k], used: false })); S2.picked = []; S2.tries = 0; S2.hint = 0; }
    const built = S2.picked.map(p => S2.tiles[p].w);
    const done = S2.ans;
    return `<p class="wm-q-h">${h(w("s_prompt"))}</p>
      ${t.kind === "sentence" && glossOf(t) ? `<p class="wm-mut center" dir="auto">${h(glossOf(t).text)}</p>` : t.kind !== "sentence" ? `<p class="wm-mut small center" lang="en">${h(clean(t.en))} — ${h(name2(t))}</p>` : ""}
      <div class="em-built" aria-live="polite">${built.length ? built.map((x, k) => `<span class="em-tok f ${k < S2.hint ? "hint" : ""}">${h(x)}</span>`).join("") : `<span class="wm-mut small">…</span>`}</div>
      ${done ? "" : `<div class="em-toks" role="group">${S2.tiles.map((x, i) => `<button class="em-tok" data-em="stile" data-a="${i}" ${x.used ? "disabled" : ""}>${h(x.w)}</button>`).join("")}</div>
      <div class="wm-row center"><button class="btn btn-g btn-sm" data-em="sundo" ${S2.picked.length > S2.hint ? "" : "disabled"}>${h(w("s_undo"))}</button><button class="btn btn-g btn-sm" data-em="shint" ${S2.hint >= target.length - 1 ? "disabled" : ""}>${h(w("s_hint"))}</button></div>
      ${S2.msg ? `<p class="wm-err" role="alert">${h(S2.msg)}</p>` : ""}`}
      ${done ? feedbackHTML(t, done === "ok", done === "ok" ? "" : `<p lang="en"><b>${h(w("s_ok_order"))}</b> ${h(target.join(" "))}</p>`) : ""}`;
  }
  function sentTry() {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st, target = toks(sentenceOf(t));
    if (S2.picked.length < target.length) return draw();
    const val = S2.picked.map(p => S2.tiles[p].w).join(" ");
    if (val === target.join(" ")) { S2.ans = "ok"; answer(t.id, S2.hint ? 1 : 2, S2.hint ? "grammar" : "grammar_built", { hint: S2.hint > 0, k: "sent", p: val }); }
    else { S2.tries++; S2.msg = w("s_try"); S2.lastWrong = val; sentHint(); if (S2.tries >= 2) { S2.ans = "bad"; answer(t.id, 0, "grammar", { k: "sent", p: val }); } }
    draw();
  }
  /* a hint fixes the next word in place (and makes the answer Hard, not Good) */
  function sentHint() {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st, target = toks(sentenceOf(t));
    S2.picked = []; S2.tiles.forEach(x => x.used = false);
    for (let k = 0; k < S2.hint; k++) { const ix = S2.tiles.findIndex(x => !x.used && x.w === target[k]); if (ix >= 0) { S2.tiles[ix].used = true; S2.picked.push(ix); } }
  }

  /* -- Game 4: Listen & Win (a little faster as the round goes on) -- */
  const RATES = [0.85, 0.9, 0.95, 1, 1.05, 1.1];
  function rate() { const G = _G; return RATES[Math.min(RATES.length - 1, G ? G.i : 0)]; }
  function spoken(t) { return t.kind === "sentence" ? t.en : clean(t.en); }
  function listenTyped(t) { const r = st().t[t.id]; return /^[A-Za-z]{3,12}$/.test(t.en) && r && r.n >= 1 && (_G.i % 2 === 1); }
  function listenHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    const sent = t.kind === "sentence";
    const typed = !sent && (G.st.typed != null ? G.st.typed : (G.st.typed = listenTyped(t)));
    const ans = G.st.ans;
    const pool = sent ? official().filter(x => x.kind === "sentence") : quizPool();
    const opts = typed ? null : (G.st.opts || (G.st.opts = E.shuffle([t.id].concat(E.distractors(pool, t.id, 3, G.seed + G.i, { label: x => x.en })), G.seed + G.i * 5)));
    return `<p class="wm-q-h">${h(sent ? w("l_sent") : typed ? w("l_type") : w("l_prompt"))}</p>
      <div class="wm-listen">
        <button class="wm-big-play" data-em="sayrate" data-a="${h(spoken(t))}" aria-label="${h(w("replay"))}">${wi("headphones")}</button>
        <div class="wm-row center"><button class="btn btn-g btn-sm" data-em="sayslow" data-a="${h(spoken(t))}">${h(w("slow"))}</button><button class="btn btn-g btn-sm" data-em="lhint" ${G.st.hint || ans ? "disabled" : ""}>${h(w("l_hint"))}</button></div>
        ${G.st.hint ? `<p class="wm-hint" lang="en">${h(w("l_hint_txt", { c: t.en[0].toUpperCase(), d: sent ? (glossOf(t) || {}).text || "" : name2(t) }))}</p>` : ""}
        <p class="wm-mut small center">${wi("sound")} ${h(w("l_synth"))} ${h(w("l_speed", { n: rate() }))}</p>
      </div>
      ${typed ? `<form class="wm-typed" id="emLForm"><input id="emLIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${h(w("l_type_ph"))}" aria-label="${h(w("l_type_ph"))}" ${ans ? "disabled" : ""} value="${h(G.st.val || "")}"><button class="btn btn-p" ${ans ? "disabled" : ""}>${h(w("check"))}</button></form>`
        : optsHTML(opts, ans, t.id, "lpick", x => clean((byId(x) || { en: x }).en))}
      ${ans ? feedbackHTML(t, ans === "ok" || ans === t.id) : ""}`;
  }
  function listenBind() {
    const f = document.getElementById("emLForm"); if (!f) return;
    f.addEventListener("submit", e => {
      e.preventDefault(); const G = _G, t = byId(G.ids[G.i]); if (!t || G.st.ans) return;
      const v = document.getElementById("emLIn").value; G.st.val = v;
      const good = E.checkTyped(v, t);
      G.st.ans = good ? "ok" : "bad";
      answer(t.id, good ? (G.st.hint ? 1 : 2) : 0, good && !G.st.hint ? "listening_typed" : "listening", { hint: G.st.hint, k: "listen-t", p: v });
      draw();
    });
  }

  /* -- Game 5: Speak Up (record → the app hears you → word score; AI pronunciation optional) --
     Hearing the learner (transcription) is free; the per-word pronunciation
     score is an AI verdict and metered (fbAssess, aiOff("ai_analysis")). A take
     that could not be heard is never counted, and Skip costs nothing. */
  function speakTarget(t) { return clean(sentenceOf(t)); }
  function coverage(target, heard) {
    const want = toks(target).map(E.normAns).filter(Boolean), got = toks(heard).map(E.normAns).filter(Boolean), pool = got.slice();
    const marks = want.map(x => { const i = pool.indexOf(x); if (i >= 0) { pool.splice(i, 1); return true; } return false; });
    return { pct: want.length ? Math.round(100 * marks.filter(Boolean).length / want.length) : 0, marks };
  }
  function speakPanelHTML(target, sp) {
    sp = sp || {};
    const cov = sp.heard != null ? coverage(target, sp.heard) : null;
    let aiOffNow = true; try { aiOffNow = typeof aiOff === "function" ? aiOff("ai_analysis") : true; } catch (e) {}
    return `<div class="em-speak">
      <p class="em-say" lang="en">${cov ? toks(target).map((x, k) => `<span class="${cov.marks[k] ? "ok" : "miss"}">${h(x)}</span>`).join(" ") : h(target)}</p>
      <div class="wm-row center"><button class="btn btn-g btn-sm" data-em="say" data-a="${h(target)}">${wi("sound")} ${h(w("hear"))}</button><button class="btn btn-g btn-sm" data-em="sayslow" data-a="${h(target)}">${h(w("slow"))}</button></div>
      <button class="em-mic ${sp.recording ? "on" : ""}" data-em="sprec" ${sp.busy ? "disabled" : ""} aria-pressed="${!!sp.recording}">${wi("mic")}<span>${h(sp.recording ? w("sp_stop") : sp.heard != null ? w("sp_again") : w("sp_rec"))}</span></button>
      ${sp.busy ? `<p class="wm-mut center" role="status">${h(w("sp_busy"))}</p>` : ""}
      ${sp.err ? `<p class="wm-err" role="alert">${h(sp.err)}</p>` : ""}
      ${cov ? `<div class="em-sp-res" role="status"><b>${h(w("sp_score", { p: cov.pct }))}</b><small>${h(w("sp_heard"))} “${h(sp.heard)}”</small>
        <div class="wm-row center">${sp.url ? `<button class="btn btn-g btn-sm" data-em="spplay">${wi("play")} ${h(w("sp_play"))}</button>` : ""}
        ${sp.ai != null ? `<span class="wm-chip">${h(w("sp_ai_res", { p: sp.ai }))} · AI</span>` : aiOffNow ? "" : `<button class="btn btn-g btn-sm" data-em="spai" ${sp.aiBusy ? "disabled" : ""}>${wi("spark")} ${h(sp.aiBusy ? w("sp_ai_busy") : w("sp_ai"))}</button>`}</div>
        ${sp.ai == null && !aiOffNow ? `<small class="wm-mut">${h(w("sp_ai_meter"))}</small>` : ""}${sp.aiErr ? `<small class="wm-mut">${h(w("sp_ai_off"))}</small>` : ""}</div>` : ""}
    </div>`;
  }
  function speakHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    const sp = G.st.sp || (G.st.sp = {});
    return `<p class="wm-q-h">${h(w("sp_prompt"))}</p>
      ${t.kind !== "sentence" ? `<p class="wm-mut small center" lang="en"><b>${h(clean(t.en))}</b> — ${h(name2(t))}</p>` : glossOf(t) ? `<p class="wm-mut small center" dir="auto">${h(glossOf(t).text)}</p>` : ""}
      ${speakPanelHTML(speakTarget(t), sp)}
      ${G.st.graded ? `<button class="btn btn-p wm-wide" data-em="next">${h(w("next"))} →</button>` : `<button class="btn btn-g wm-wide" data-em="spskip">${h(w("skip"))}</button>`}`;
  }
  /* one recorder for Speak Up and the Missions' "say it" step */
  async function spToggle() {
    const G = _G; if (!G) return;
    const sp = G.st.sp || (G.st.sp = {});
    if (sp.recording && sp.mr) { try { sp.mr.stop(); } catch (e) {} return; }
    sp.err = ""; sp.aiErr = false;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { sp.err = w("sp_mic"); return draw(); }
    const mr = new MediaRecorder(stream), chunks = [];
    sp.mr = mr; sp.recording = true; sp.t0 = Date.now(); draw();
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach(x => x.stop());
      sp.recording = false; clearTimeout(sp.timer);
      const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      if (_G !== G) return;
      if (blob.size < 1200 || Date.now() - sp.t0 < 400) { sp.err = w("sp_empty"); return draw(); }
      if (sp.url) try { URL.revokeObjectURL(sp.url); } catch (e) {}
      sp.blob = blob; sp.url = URL.createObjectURL(blob); sp.ai = null; sp.busy = true; draw();
      let heard = "";
      try { heard = typeof fbTranscribe === "function" ? await fbTranscribe(blob) : ""; } catch (e) { heard = ""; }
      sp.busy = false;
      if (_G !== G) return;
      if (!heard) { sp.err = navigator.onLine ? w("sp_empty") : w("sp_tx_off"); return draw(); }
      sp.heard = heard;
      spGraded(G);
      draw();
    };
    mr.start();
    sp.timer = setTimeout(() => { try { if (mr.state === "recording") mr.stop(); } catch (e) {} }, 15000);
  }
  /* Speak Up grades the FIRST take it could hear (a retake is practice); the Missions' step is practice only */
  function spGraded(G) {
    if (G.mode !== "speak" || G.st.graded) return;
    const t = byId(G.ids[G.i]); if (!t) return;
    const pct = coverage(speakTarget(t), G.st.sp.heard).pct;
    G.st.graded = true;
    answer(t.id, pct >= 80 ? 2 : pct >= 50 ? 1 : 0, "speaking", { k: "speak", p: String(G.st.sp.heard).slice(0, 40) });
  }
  async function spAi() {
    const G = _G, sp = G && G.st.sp; if (!sp || !sp.blob || sp.aiBusy) return;
    const target = G.mode === "speak" ? speakTarget(byId(G.ids[G.i])) : (G.st.sayTarget || "");
    sp.aiBusy = true; draw();
    let r = null; try { r = typeof fbAssess === "function" ? await fbAssess(sp.blob, target) : null; } catch (e) { r = null; }
    sp.aiBusy = false;
    if (r && r.words && r.words.length) sp.ai = Number.isFinite(r.overall) ? Math.round(r.overall) : Math.round(100 * r.words.filter(x => x && x.score >= 80).length / r.words.length);
    else sp.aiErr = true;
    if (_G === G) draw();
  }

  /* -- Game 6: Phrase Match -- */
  const MATCH_KINDS = ["def", "ex", "use"];
  function matchRound() {
    const G = _G, round = G.st.round || 0, slice = G.ids.slice(round * 5, round * 5 + 5);
    if (slice.length < 2) return finish();
    let items = slice.map(byId).filter(Boolean);
    let kind = MATCH_KINDS[(G.seed + round) % MATCH_KINDS.length];
    if (kind === "use" && items.filter(x => x.use && x.use.en).length < items.length) kind = "def";
    if (kind === "ex" && items.some(x => !x.ex || !x.ex.en)) kind = "def";
    const right = x => kind === "def" ? blank(x.def.en, x) : kind === "ex" ? blank(x.ex.en, x) : x.use.en;
    G.st = { round, kind, items, rightOrder: E.shuffle(items.map(x => x.id), G.seed + round * 11), sel: null, done: {}, miss: {}, right };
    matchDraw();
  }
  function matchDraw() {
    const G = _G, M = G.st;
    gameOpen("match", `<p class="wm-q-h">${h(w("m_" + M.kind))}</p><p class="wm-mut small">${h(w("m_prompt"))}</p>
      <div class="wm-match">
        <div class="wm-mcol">${M.items.map(x => `<button class="wm-m ${M.sel === x.id ? "sel" : ""} ${M.done[x.id] ? (M.miss[x.id] ? "late" : "ok") : ""}" data-em="mleft" data-a="${h(x.id)}" ${M.done[x.id] ? "disabled" : ""} aria-pressed="${M.sel === x.id}" lang="en">${h(clean(x.en))}</button>`).join("")}</div>
        <div class="wm-mcol">${M.rightOrder.map(id => `<button class="wm-m r ${M.done[id] ? (M.miss[id] ? "late" : "ok") : ""} ${M.flash === id ? "bad" : ""}" data-em="mright" data-a="${h(id)}" ${M.done[id] ? "disabled" : ""} lang="en"><span>${h(M.right(byId(id)))}</span></button>`).join("")}</div>
      </div>${M.flash ? `<p class="wm-err" role="alert">${h(w("m_wrong"))}</p>` : ""}`);
  }
  /* a pair counts as known only if it was matched without a wrong try on that
     phrase — a lucky match after a miss is filed as "Again", not as success */
  function matchPick(side, id) {
    const G = _G, M = G.st;
    if (side === "l") { M.sel = M.sel === id ? null : id; M.flash = null; return matchDraw(); }
    if (!M.sel) return;
    if (M.sel === id) { M.done[id] = 1; answer(id, M.miss[id] ? 0 : 2, "recognition", { k: "match-" + M.kind, p: M.miss[id] || "" }); M.sel = null; M.flash = null; G.i++; }
    else { if (!M.miss[M.sel]) M.miss[M.sel] = id; M.flash = id; tone("no"); }
    if (M.items.every(x => M.done[x.id])) { M.round++; G.st = { round: M.round }; if (M.round * 5 >= G.ids.length) return finish(); return setTimeout(matchRound, 450); }
    matchDraw();
  }

  /* -- Game 7: Word Puzzle (spell it from its meaning) -- */
  function puzzleHTML() {
    const G = _G, t = byId(G.ids[G.i]); if (!t) { setTimeout(nextItem, 0); return ""; }
    const S2 = G.st;
    if (!S2.tiles) { S2.tiles = E.tiles(t.en, G.seed + G.i).map((c, k) => ({ c, k, used: false })); S2.picked = []; S2.tries = 0; S2.hint = 0; }
    const target = t.en.toUpperCase(), letters = target.replace(/[^A-Z]/g, "");
    let li = 0;
    const slots = target.split("").map(() => { const p = S2.picked[li]; const fixed = li < S2.hint; li++; return `<span class="wm-slot ${p != null ? "f" : ""} ${fixed ? "hint" : ""}">${p != null ? h(S2.tiles[p].c) : ""}</span>`; }).join("");
    const done = S2.ans;
    return `<p class="wm-q-h">${h(w("b_prompt"))}</p>
      <div class="wm-q-p"><p lang="en">${h(blank(t.def.en, t))}</p>${t.ex && t.ex.en ? `<p class="wm-mut small" lang="en">“${h(blank(t.ex.en, t))}”</p>` : ""}</div>
      <div class="wm-slots" aria-label="${letters.length} letters" aria-live="polite">${slots}</div>
      ${done ? "" : `<div class="wm-tiles" role="group">${S2.tiles.map((x, i) => `<button class="wm-tile" data-em="tile" data-a="${i}" ${x.used ? "disabled" : ""} aria-label="${h(x.c)}">${h(x.c)}</button>`).join("")}</div>
      <div class="wm-row center"><button class="btn btn-g btn-sm" data-em="bback" aria-label="Backspace">⌫</button><button class="btn btn-g btn-sm" data-em="bclear">${h(w("b_clear"))}</button><button class="btn btn-g btn-sm" data-em="bhint" ${S2.hint >= letters.length - 1 ? "disabled" : ""}>${h(w("b_hint"))}</button></div>
      <form class="wm-typed" id="emBForm"><input id="emBIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${h(w("b_type_ph"))}" aria-label="${h(w("b_type_ph"))}"><button class="btn btn-p">${h(w("check"))}</button></form>
      ${S2.msg ? `<p class="wm-err" role="alert">${h(S2.msg)}</p>` : ""}`}
      ${done ? feedbackHTML(t, done === "ok") : ""}`;
  }
  function builderBind() {
    const f = document.getElementById("emBForm"); if (!f) return;
    f.addEventListener("submit", e => { e.preventDefault(); builderCheck(document.getElementById("emBIn").value); });
  }
  function builderTry() {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st, need = t.en.replace(/[^A-Za-z]/g, "").length;
    if (S2.picked.length === need) builderCheck(S2.picked.map(p => S2.tiles[p].c).join(""));
    else draw();
  }
  function builderCheck(val) {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st; if (S2.ans) return;
    if (E.checkTyped(val, t)) { S2.ans = "ok"; answer(t.id, S2.hint ? 1 : 2, "spelling", { hint: S2.hint > 0, k: "spell", p: val }); }
    else { S2.tries++; S2.msg = w("b_try"); builderApplyHint(); if (S2.tries >= 2) { S2.ans = "bad"; answer(t.id, 0, "spelling", { k: "spell", p: val }); } }
    draw();
  }
  function builderApplyHint() {
    const G = _G, t = byId(G.ids[G.i]), S2 = G.st, letters = t.en.toUpperCase().replace(/[^A-Z]/g, "");
    S2.picked = []; S2.tiles.forEach(x => x.used = false);
    for (let k = 0; k < S2.hint; k++) { const ix = S2.tiles.findIndex(x => !x.used && x.c === letters[k]); if (ix >= 0) { S2.tiles[ix].used = true; S2.picked.push(ix); } }
  }

  /* -- Game 8: Real-Life Missions (choose → say it → or your own words with the AI coach) -- */
  function scen(id) { return (C && C.missions.find(x => x.id === id)) || (_pack && (_pack.scenarios || []).find(x => x.id === id)) || null; }
  function missionsHTML() {
    const G = _G, sc = scen(G.ids[G.i]); if (!sc) { setTimeout(nextItem, 0); return ""; }
    const S2 = G.st, ok = sc.options.find(o => o.ok);
    const order = S2.order || (S2.order = E.shuffle(sc.options.map((o, k) => k), G.seed + G.i * 13));
    if (S2.a != null) G.st.sayTarget = ok.en;
    return `<div class="wm-ws em-mis"><div class="wm-ws-h">${wi(sc.kind === "work" ? "briefcase" : "chat")}<span><small>${h(sc.title || catName(sc.cat || "advanced"))}</small><b>${h(sc.who)}</b></span></div>
      <p class="wm-mut small">${h(sc.where)}</p>
      <blockquote lang="en">“${h(sc.asks)}”</blockquote>
      ${sc.goal || sc.context ? `<details class="wm-tr"><summary>${h(w("mi_goal"))}</summary>${sc.goal ? `<p>${h(sc.goal)}</p>` : ""}${sc.context ? `<p class="wm-mut small"><b>${h(w("mi_ctx"))}</b> ${h(sc.context)}</p>` : ""}</details>` : ""}
      <p class="wm-q-h">${h(w("mi_q"))}</p>
      <div class="wm-opts col" role="group">${order.map(k => { const o = sc.options[k], cls = S2.a != null ? (o.ok ? "correct" : k === S2.a ? "wrong" : "") : ""; return `<button class="wm-opt long ${cls}" data-em="mpick" data-a="${k}" ${S2.a != null ? "disabled" : ""} lang="en">${h(o.en)}</button>`; }).join("")}</div>
      ${S2.a != null ? `<div class="wm-fb ${sc.options[S2.a].ok ? "ok" : "no"}" role="status">${wi(sc.options[S2.a].ok ? "check" : "cross")}<div><b>${h(sc.options[S2.a].ok ? w("ok") : w("no"))}</b><p>${h(sc.why)}</p></div></div>
        <h3 class="wm-h3">${wi("mic")} ${h(w("mi_say"))}</h3>${canRecord() ? speakPanelHTML(ok.en, S2.sp || (S2.sp = {})) : ""}
        ${coachHTML(sc)}
        <button class="btn btn-p wm-wide" data-em="next">${h(w("next"))} →</button>` : ""}
    </div>`;
  }
  /* ---- the AI coach inside Real-Life Missions ----
     The learner answers in their OWN words; the coach judges it against the
     situation. The existing chat route, purpose "coach": a verdict, so it is
     metered by the server (Free 3 a day, Premium 120), needs a signed-in
     account, and is labelled AI everywhere it speaks. */
  function coachTask(sc) { return sc.task || w("co_task", { who: String(sc.who || "").replace(/^(The|A|An|Your) /, m => m.toLowerCase()) }); }
  function coachHTML(sc) {
    const C2 = _G.st.coach || {};
    let off = false; try { off = typeof aiOff === "function" && aiOff("ai_coach"); } catch (e) {}
    if (!signedIn()) off = true;
    return `<div class="card wm-coach" id="emCoach"><div class="wm-coach-h">${wi("chat")}<span><small>${h(w("mi_own"))} · ${h(w("co_h"))}</small><b>${h(coachTask(sc))}</b></span></div>
      ${C2.res ? `<div class="wm-coach-out v-${h(C2.res.verdict || "almost")}"><b>${h(w("co_v_" + (C2.res.verdict || "almost")))}</b>
          ${C2.res.well ? `<p>${wi("check")} ${h(C2.res.well)}</p>` : ""}${C2.res.fix ? `<p>${wi("target")} ${h(C2.res.fix)}</p>` : ""}
          ${C2.res.better ? `<p class="wm-coach-better" lang="en">“${h(C2.res.better)}”</p>` : ""}${C2.res.tip ? `<p class="fr" dir="auto">${h(C2.res.tip)}</p>` : ""}
          <p class="wm-mut small">${h(w("co_ai"))}</p></div>`
        : `<textarea id="emCoachIn" rows="3" maxlength="400" placeholder="${h(w("co_ph"))}" aria-label="${h(w("co_ph"))}" ${C2.busy ? "disabled" : ""}>${h(C2.txt || "")}</textarea>
          ${C2.err ? `<p class="wm-err" role="alert">${h(C2.err)}</p>` : ""}
          <button class="btn btn-g wm-wide" data-em="coach" ${C2.busy || off ? "disabled" : ""}>${wi("chat")} ${h(C2.busy ? w("co_busy") : w("co_btn"))}</button>
          ${off ? `<p class="wm-mut small">${h(signedIn() ? w("co_off") : w("au_short"))}</p>` : `<p class="wm-mut small">${h(w("co_meter"))}</p>`}`}
    </div>`;
  }
  async function coachAsk() {
    const G = _G; if (!G) return;
    const sc = scen(G.ids[G.i]), box = document.getElementById("emCoachIn");
    const txt = (box && box.value || "").replace(/\s+/g, " ").trim().slice(0, 400);
    G.st.coach = G.st.coach || {}; G.st.coach.txt = txt;
    if (txt.split(" ").length < 4) { G.st.coach.err = w("co_short"); return draw(); }
    G.st.coach.busy = true; G.st.coach.err = ""; draw();
    const L = glLang(), ok = sc.options.find(o => o.ok);
    const system = `You are an English communication coach in BE Mastery (General English). You are an AI, not a person. A learner is practising what to say in a real situation.
Situation: ${sc.where} ${sc.who} says: "${sc.asks}"${sc.goal ? "\nGoal: " + sc.goal : ""}${sc.context ? "\nBackground: " + sc.context : ""}
Task: ${coachTask(sc)}
One natural answer (for reference only): ${ok ? ok.en : ""}
Judge ONLY the learner's own answer: does it do the job in this situation, is it clear, polite and natural, is the grammar right? Be specific, short and kind. Keep their facts.
Reply as JSON: {"reply": "VERDICT: good|almost|retry\\nWELL: <one short line on what worked>\\nFIX: <one short line, the single most useful correction>\\nBETTER: <the learner's own answer rewritten naturally, max 2 sentences>\\nTIP: <one-line tip ${L.ok ? "in " + L.name : "in simple English"}>"}`;
    try {
      const r = await fetch(POLISH_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat: { purpose: "coach", system, messages: [{ role: "user", content: txt }] } }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) { G.st.coach.busy = false; G.st.coach.err = w("co_spent"); return draw(); }
      if (r.status === 401) { G.st.coach.busy = false; G.st.coach.err = w("au_short"); return draw(); }
      if (!r.ok || j.error) throw new Error("ai");
      const o = {}; String(j.reply || "").split(/\n+/).forEach(l => { const m = /^\s*(VERDICT|WELL|FIX|BETTER|TIP)\s*:\s*(.+)$/i.exec(l); if (m) o[m[1].toLowerCase()] = m[2].trim(); });
      if (!o.better && !o.fix) throw new Error("shape");
      G.st.coach.res = { verdict: /^(good|almost|retry)$/i.test(o.verdict || "") ? o.verdict.toLowerCase() : "almost", well: o.well, fix: o.fix, better: o.better, tip: o.tip };
      G.log.push({ s: sc.id, ok: G.st.coach.res.verdict === "good", k: "coach", p: G.st.coach.res.verdict });
    } catch (e) { G.st.coach.err = w("co_fail"); }
    G.st.coach.busy = false; persist(); if (_G === G) draw();
  }
  /* after a Missions round: the next rung of the loop — a real person, or a real video */
  function endLinksHTML(G) {
    if (G.mode !== "missions") return "";
    let pp = false; try { pp = typeof ppAvailable === "function" && ppAvailable(); } catch (e) {}
    const sh = G.ids.map(scen).filter(Boolean).map(x => x.shadow).find(Boolean);
    return `${pp ? `<button class="wm-link" data-em="partner">${wi("user_plus")} ${h(w("mi_partner"))} →</button>` : ""}${sh && shadowOk() ? `<button class="wm-link" data-em="shadow" data-a="${h(sh.vid)}">${wi("play")} ${h(w("mi_shadow", { t: sh.title }))} →</button>` : ""}`;
  }
  function loopHTML() {
    let pp = false; try { pp = typeof ppAvailable === "function" && ppAvailable(); } catch (e) {}
    const sh = shadowOk();
    if (!pp && !sh) return "";
    return `<div class="card em-loop"><div class="em-loop-h">${wi("renew")}<span><small>${h(w("loop_h"))}</small><b>${h(w("loop_b"))}</b></span></div>
      <div class="wm-row">${pp ? `<button class="btn btn-p btn-sm" data-em="partner">${wi("user_plus")} ${h(w("loop_pp"))}</button>` : ""}${sh ? `<button class="btn btn-g btn-sm" data-em="nav" data-a="shadow">${wi("play")} ${h(w("loop_sh"))}</button>` : ""}</div></div>`;
  }

  function draw() {
    const G = _G; if (!G) return;
    if (G.mode === "match") return matchDraw();
    const fn = { cards: cardsHTML, quiz: quizHTML, sentence: sentHTML, listen: listenHTML, speak: speakHTML, puzzle: puzzleHTML, missions: missionsHTML }[G.mode];
    gameOpen(G.mode, fn());
    if (G.mode === "listen" && !G.st.played) { G.st.played = 1; setTimeout(() => { const t = byId(G.ids[G.i]); if (t && _G === G) say(spoken(t), rate()); }, 350); }
    if (G.mode === "puzzle") builderBind();
    if (G.mode === "listen") listenBind();
  }

  /* ------------------------------------------------------------ one click handler */
  function act(a, arg, btn) {
    const s = st(); if (!s && a !== "nav") return;
    const G = _G;
    switch (a) {
      case "nav":
        if (document.getElementById("emGame") && document.getElementById("emGame").classList.contains("show")) gameClose();
        sheetClose(); go(arg); return;
      case "open": go("english", "games"); setTimeout(() => start(arg), 60); return;
      case "retry": _err = false; redraw(); return;
      case "tab": _tab = arg; render(document.getElementById("v-english")); try { jumpTop(); } catch (e) {} return;
      case "settings": return settingsOpen();
      case "sheetclose": return sheetClose();
      case "set": { const [k, v] = arg.split(":"); if (k === "sound") s.set.sound = v === "1"; else s.set[k] = v; persist(); document.documentElement.classList.toggle("wm-still", reduced()); settingsOpen(); redraw(); return; }
      case "mission": return startMission();
      case "hseg": _histSeg = arg; return redraw();
      case "practerr": return start("cards", { ids: String(arg).split(",").filter(Boolean), keepOrder: true, n: 20 });
      case "resume": { const r = resumeValid(s); if (r) start(r.mode, { resume: r }); return; }
      case "play": return start(arg);
      case "daily": return start("quiz", { daily: true });
      case "signin": sheetClose(); try { fbOpenModal("in"); } catch (e) {} return;
      case "premium": sheetClose(); try { premiumOpen(arg || "em"); } catch (e) {} return;
      case "energy": return energySheet({ resetAt: _srv && _srv.energy ? _srv.energy.resetAt : 0 });
      case "trend": _trendSpan = +arg === 90 ? 90 : 30; { const el = document.getElementById("emTrends"); if (el) el.outerHTML = trendsHTML(true); } return;
      case "coach": return coachAsk();
      case "gloss": return glossFetch(arg);
      case "partner": if (document.getElementById("emGame") && document.getElementById("emGame").classList.contains("show")) gameClose(); sheetClose(); try { go("partner"); } catch (e) {} return;
      case "shadow": { const vid = arg; if (document.getElementById("emGame") && document.getElementById("emGame").classList.contains("show")) gameClose(); sheetClose(); try { go("shadow"); setTimeout(() => { try { shLoad({ vid, start: 0, end: 0, title: "" }); } catch (e) {} }, 250); } catch (e) {} return; }
      case "advanced": {
        if (!signedIn()) return authSheet();
        if (!_srv) { srvRefresh().then(() => act("advanced")); return; }
        if (!isPremium()) return premiumAsk("em_advanced");
        if (_pack) return start("missions", { advanced: true });
        srv("pack").then(r => { if (r.status === 200 && r.j && Array.isArray(r.j.scenarios)) { _pack = r.j; start("missions", { advanced: true }); } else if (r.status === 402) premiumAsk("em_advanced"); else msgSheet("chat", w("adv_fail_h"), w("adv_fail_b")); }).catch(() => msgSheet("bolt", w("off_h"), w("off_b")));
        return;
      }
      case "stage": return start("cards", { cat: arg });
      case "stagetest": return start(arg === "first" ? "sentence" : "quiz", { cat: arg, n: 10 });
      case "practise": return start("cards", { ids: collList().slice(0, 20).map(t => t.id), keepOrder: true, n: 20 });
      case "seg": _coll.seg = arg; _edit = null; return redraw();
      case "cat": _coll.cat = arg; return redraw();
      case "word": return wordSheet(arg);
      case "fav": { E.setFav(s, arg, !E.isFav(s, arg), Date.now()); persist(); const sh = document.getElementById("emSheet"); if (sh) wordSheet(arg); if (G) draw(); else redraw(); return; }
      case "hard": { const r = s.t[arg]; E.setHard(s, arg, !(r && r.hard)); persist(); const sh = document.getElementById("emSheet"); if (sh) wordSheet(arg); if (G) draw(); else redraw(); return; }
      case "savelist": { const t = byId(arg); if (t) { try { vocPut(clean(t.en).toLowerCase(), /^[ABC][12]$/.test(t.lvl) ? t.lvl : "B1"); save(); toast(clean(t.en) + " ✓"); } catch (e) {} } if (document.getElementById("emSheet")) wordSheet(arg); else if (G) draw(); return; }
      case "say": return say(arg);
      case "sayslow": return say(arg, 0.7);
      case "sayrate": return say(arg, rate());
      case "myedit": _edit = arg; return redraw();
      case "mycancel": _edit = null; return redraw();
      case "mydel": { const m = s.mine[arg]; if (!m) return; sheet(`<p>${h(w("my_del_q", { w: m.en }))}</p><div class="wm-row"><button class="btn btn-p" data-em="mydelok" data-a="${h(arg)}">${h(w("del_conf"))}</button><button class="btn btn-g" data-em="sheetclose">${h(w("cancel"))}</button></div>`); return; }
      case "mydelok": E.delMine(s, arg, Date.now()); persist(); sheetClose(); toast(w("my_deleted")); _edit = null; return redraw();
      /* in a game */
      case "gclose": return gameClose();
      case "again": { const m = G && G.mode, o = G && G.opts; gameClose(); if (m) start(m, o && !o.resume ? o : {}); return; }
      case "next": return G && G.mode === "match" ? null : nextItem();
      case "flip": G.st.flipped = true; return draw();
      case "rate": { if (G.st.rated) return; G.st.rated = 1; answer(G.ids[G.i], +arg, "recall", { k: "card" }); return nextItem(); }
      case "qpick": { if (G.st.ans) return; G.st.ans = arg; const t = byId(G.ids[G.i]); answer(t.id, arg === t.id ? 2 : 0, G.st.q.skill, { k: G.st.q.type, p: arg === t.id ? "" : arg }); return draw(); }
      case "gpick": case "fpick": { if (G.st.ans != null) return; G.st.ans = arg; const g = gram(G.ids[G.i]); answer(g.id, +arg === g.a ? 2 : 0, "grammar", { k: a === "gpick" ? "gram" : "fix", p: arg }); return draw(); }
      case "lpick": { if (G.st.ans) return; G.st.ans = arg; const t = byId(G.ids[G.i]); answer(t.id, arg === t.id ? (G.st.hint ? 1 : 2) : 0, "listening", { hint: G.st.hint, k: t.kind === "sentence" ? "listen-s" : "listen", p: arg === t.id ? "" : arg }); return draw(); }
      case "lhint": G.st.hint = 1; return draw();
      case "stile": { const S2 = G.st, i = +arg; if (S2.ans || S2.tiles[i].used) return; S2.tiles[i].used = true; S2.picked.push(i); S2.msg = ""; return sentTry(); }
      case "sundo": { const S2 = G.st; if (S2.picked.length > S2.hint) { const p = S2.picked.pop(); S2.tiles[p].used = false; } return draw(); }
      case "shint": { const S2 = G.st; S2.hint++; sentHint(); return sentTry(); }
      case "sprec": return spToggle();
      case "spplay": { const sp = G.st.sp; if (sp && sp.url) { try { new Audio(sp.url).play(); } catch (e) {} } return; }
      case "spai": return spAi();
      case "spskip": { const sp = G.st.sp; if (sp && sp.recording && sp.mr) try { sp.mr.stop(); } catch (e) {} return nextItem(); }
      case "tile": { const S2 = G.st, i = +arg; if (S2.ans || S2.tiles[i].used) return; S2.tiles[i].used = true; S2.picked.push(i); S2.msg = ""; return builderTry(); }
      case "bback": { const S2 = G.st; if (S2.picked.length > S2.hint) { const p = S2.picked.pop(); S2.tiles[p].used = false; } return draw(); }
      case "bclear": builderApplyHint(); return draw();
      case "bhint": { const S2 = G.st; S2.hint++; builderApplyHint(); return draw(); }
      case "mleft": return matchPick("l", arg);
      case "mright": return matchPick("r", arg);
      case "mpick": { if (G.st.a != null) return; G.st.a = +arg; const sc = scen(G.ids[G.i]); const ok = !!sc.options[+arg].ok; answer(sc.id, ok ? 2 : 0, "context", { k: "mis", s: sc.id, p: String(+arg) }); return draw(); }
    }
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-em]");
    if (!b || b.disabled) return;
    if (!b.closest("#v-english,#emGame,#emSheet,.em-portal,.em-perf-card")) return;
    e.preventDefault();
    try { act(b.dataset.em, b.dataset.a, b); } catch (err) { try { console.error("[em]", err); } catch (_) {} }
  });
  document.addEventListener("submit", e => {
    if (e.target && e.target.id === "emMyForm") {
      e.preventDefault();
      const s = st(); if (!s) return;
      const id = e.target.dataset.id || undefined;
      const r = E.addMine(s, { id, en: document.getElementById("emMyEn").value, fr: document.getElementById("emMyFr").value, def: document.getElementById("emMyDef").value, ex: document.getElementById("emMyEx").value }, Date.now(), official());
      if (r.error) { const er = document.getElementById("emMyErr"); if (er) er.textContent = w("my_e_" + r.error); return; }
      persist(); _edit = null; toast(w(id ? "my_saved" : "my_added")); redraw();
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { if (document.getElementById("emSheet")) return sheetClose(); const ov = document.getElementById("emGame"); if (ov && ov.classList.contains("show")) gameClose(); }
  });

  /* ------------------------------------------------------------ Home, recommendations, widget
     Read from the learner's own record without the corpus (Home is often the
     first page drawn), so nothing waits on a download. */
  const LOGO_URL = "english-mastery-logo.svg";
  function todayShift(s) { const m = s.mis; return m && m.day === E.dayOf(Date.now()) ? m : null; }
  function signals() {
    const s = st(); if (!s) return null;
    const now = Date.now(), m = todayShift(s);
    const perf = E.performance(s, [], now), rec = E.recommend(perf);
    const untried = E.MODES.filter(k => !(s.modes[k] && s.modes[k].runs) && k !== rec.mode);
    return { shift: m ? { kind: m.kind, prog: m.prog, target: m.target, done: !!m.done } : { kind: "start5", prog: 0, target: 5, done: false, fresh: true },
      mode: rec.mode, why: rec.kind, strong: rec.strong ? w("skill_" + rec.strong).toLowerCase() : "", weak: rec.weak ? w("skill_" + rec.weak).toLowerCase() : "",
      due: E.dueCount(s, now), mastered: masteredCount(s), untried: untried.slice(0, 2), extra: ["quiz", "speak", "missions"], view: "english", activity: "english_mastery" };
  }
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
    return { ic: "trophy", t: w("title"), s: m ? (m.done ? w("explore_done", { m: masteredCount(s) }) : w("explore_shift", { p: m.prog, n: m.target })) : w("explore_s", { total: TOTAL }), go: "go('english')", img: LOGO_URL, art: 0 };
  }
  /* a recommendation, a widget tap or a Home card asked for a game: open the hub on it */
  function play(actName) {
    if (!on()) return false;
    try { go("english", actName === "shift" ? "home" : "games"); } catch (e) { return false; }
    const run = () => { if (actName === "shift") { E.ensureMission(st(), official(), Date.now()); persist(); startMission(); } else if (E.MODES.includes(actName)) start(actName); };
    loadCorpus().then(() => setTimeout(run, 120)).catch(() => {});
    return true;
  }
  function widgetData() {
    const s = st(); if (!s) return null;
    const now = Date.now(), lv = E.level(xpShown()), sk = E.streak(s, now), m = todayShift(s), sig = signals();
    return { m: masteredCount(s), total: TOTAL, lvl: lv.level, xp: lv.xp, need: lv.need, pct: lv.pct, streak: sk.current,
      shift: m ? { t: shiftName(m.kind), p: m.prog, n: m.target, done: !!m.done } : { t: shiftName("start5"), p: 0, n: 5, done: false },
      next: sig ? w("g_" + sig.mode) : "",
      labels: { title: w("w_title"), mastered: w("w_mastered"), level: w("w_level", { n: lv.level }), xp: w("w_xp"), streak: w("w_streak"), shift: w("w_shift"), done: w("w_done"), open: w("w_open"), empty: w("w_empty") } };
  }

  window.EMUI = {
    signals, heroText, rowHead, itemTitle, itemLine, exploreTile, play, widgetData, LOGO_URL,
    on, render, portalHTML, perfCardHTML, title: () => w("title"),
    /* test hooks */
    _state: st, _corpus: () => C, _load: loadCorpus, _start: start, _game: () => _G, _act: act, _refresh: srvRefresh, _coverage: coverage, _pool: poolFor, _choose: chooseIds
  };
})();
