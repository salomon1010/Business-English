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
      first_h: "Welcome to English Mastery", first_b: "385 words, phrases and sentences from your 12-week plan and from everyday life, eight games, one goal: speak with confidence. Start with five.",
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
      it_shift: "Today's goal", explore_s: "385 words and phrases, eight games", explore_shift: "Today's goal: {{p}}/{{n}}", explore_done: "Goal done · {{m}} mastered",
      la_line: "Last chance for today's mission!", la_line_sk: "Last chance! Keep your {{n}}\u2011day streak.", la_done: "Done — your streak is safe.",
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
      first_h: "Bienvenue dans English Mastery", first_b: "385 mots, expressions et phrases de ton programme de 12 semaines et de la vie quotidienne, huit jeux, un objectif : parler avec assurance. Commence par cinq.",
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
      it_shift: "Objectif du jour", explore_s: "385 mots et expressions, huit jeux", explore_shift: "Objectif du jour : {{p}}/{{n}}", explore_done: "Objectif fait · {{m}} maîtrisés",
      la_line: "Dernière chance pour la mission du jour !", la_line_sk: "Dernière chance ! Garde ta série de {{n}}\u00a0jours.", la_done: "Fait — ta série est sauvée.",
      w_title: "English Mastery", w_mastered: "maîtrisés", w_level: "Niveau {{n}}", w_xp: "XP", w_streak: "jours de série", w_shift: "Objectif du jour", w_done: "Objectif atteint", w_open: "Jouer", w_empty: "Ouvre English Mastery dans BE Mastery pour commencer.",
      k_def: "Sens", k_ex: "Exemple", k_use: "Quand l'utiliser", k_gram: "Grammaire", k_sent: "Phrase", k_card: "Carte", k_listen: "Écoute", k_listen_t: "Écoute (écrit)", k_listen_s: "Écoute (phrase)", k_spell: "Orthographe", k_speak: "Oral", k_mis: "Mission", k_reply: "Réponse", k_match: "Association", k_coach: "Coach IA"
    }
  };
  function lang() { try { return (S.profile && S.profile.lang) === "fr" ? "fr" : "en"; } catch (e) { return "en"; } }
  function w(k, v) { let s = (TX[lang()][k] != null ? TX[lang()][k] : TX.en[k]); if (s == null) s = k; if (v) s = s.replace(/\{\{(\w+)\}\}/g, (_, x) => v[x] != null ? v[x] : ""); return s; }
  function h(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function L2(o) { return o ? (o[lang()] || o.en || "") : ""; }
  function fmtDate(ts) { try { return new Date(ts).toLocaleDateString(lang() === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } }
