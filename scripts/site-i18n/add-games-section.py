"""One-off (10 Oct 2026): the "Play to learn" section of lomonec.com/bemastery.

Adds, to the English page site/bemastery/index.html:
  · section 09 "Play to learn" after the widgets (sections 09-14 become 10-15);
  · a "What's new" card for the game hubs, in place of the oldest card;
  · one line in each programme's list (Two programmes).
and to every bemastery.<code>.mjs dictionary the same changes with their
translations, so `node scripts/site-i18n/build.mjs` rebuilds the 15 pages.

Translations are machine transcreation by the assistant, like the rest of the
site's — they should be read by a native speaker before heavy promotion.
Product and game names stay in English, as the site does for Shadow Studio,
Practice Partner and Phrase Lab. Run from the repo root.
"""
import os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PAGE = os.path.join(ROOT, "site/bemastery/index.html")
DICT = os.path.join(ROOT, "scripts/site-i18n/bemastery.{}.mjs")
LANGS = ["es", "fr", "pt", "it", "de", "ru", "ar", "ur", "hi", "bn", "id", "vi", "zh", "ja", "ko"]
NB = " "
CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>'
CHECK2 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>'

# ---- the English strings (each is matched EXACTLY by build.mjs) ----
E = {
 "label": '<span class="n">09</span> Play to learn</span>',
 "h2": '<h2>Five minutes of play, <span class="grad">real English at the end of it</span>.</h2>',
 "lede": 'Each programme has its own game hub, built from its own lessons. Eight short games turn what you are learning into answers you can give out loud.',
 "b1": '<b>English Mastery, for General English:</b> 385 words, phrases and sentences from your 12-week plan and from everyday life, in eight games — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle and Real-Life Missions.',
 "b2": '<b>Welding Mastery, for Welding English:</b> 250 trade words with real photographs of the tools, a crossword, listening rounds and workshop challenges.',
 "b3": '<b>A daily mission, a weekly goal and skill badges.</b> A word counts as mastered only after correct answers on three different days — XP alone never masters it.',
 "b4": '<b>Speak Up hears you:</b> say a sentence and see which words came through. The pronunciation score is AI, and it says so.',
 "fine": 'Sign in to play. Free: five challenge rounds a day in each programme — a wrong answer never costs a round — plus unlimited review and the daily mission. Premium: unlimited rounds, advanced situations and 30- and 90-day trends.',
 "shots": '<h3 class="shots-h" data-reveal>Inside the game hubs</h3>',
 "c1": '<b>English Mastery</b><span>A daily mission and your weekly goal</span>',
 "c2": '<b>Eight games</b><span>Each one practises a different skill</span>',
 "c3": '<b>Speak Up</b><span>See which words came through</span>',
 "c4": '<b>Welding Mastery</b><span>250 trade words, real photographs</span>',
 "a1": 'The English Mastery hub: level, XP, streak and energy, today\'s English mission and the weekly goal',
 "a2": 'The English Mastery games: Word Quest, Quick Quiz, Sentence Builder and Listen &amp; Win, each with the skill it practises',
 "a3": 'Speak Up after a take: 88% of the words heard, the missing word marked in red',
 "a4": 'The Welding Mastery games: Cards, Quiz, Crossword, Visual recognition, Listening and Word Builder',
 "new": '<h3>Play to learn</h3><p>English Mastery and Welding Mastery: eight games each, a daily mission and skill badges.</p>',
 "pg": '<span>English Mastery: eight games on your plan\'s words and phrases</span>',
 "pw": '<span>Welding Mastery: eight games on 250 trade words, with real photographs</span>',
}
OLD_CARD = '<h3>A coach that speaks</h3><p>Your speaking report, read to you by the coach, with corrections and better words.</p>'

SECTION = f'''
<!-- ── 09 PLAY TO LEARN ─────────────────────────────────────────────────────
     The two game hubs: English Mastery (General English) and Welding Mastery
     (Welding English). Shots: scripts/store-art/shoot-games.mjs. -->
<section class="section" id="games">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <span class="label">{E["label"]}
      {E["h2"]}
      <p class="lede" style="margin:16px auto 0">{E["lede"]}</p>
    </div>
    {E["shots"]}
    <div class="shots shots-home" data-shots><figure class="shot" data-reveal data-reveal-delay="0"><div class="shot-phone"><img src="img/games/em-home.webp" width="660" height="1434" alt="{E["a1"]}" loading="lazy"></div><figcaption>{E["c1"]}</figcaption></figure><figure class="shot" data-reveal data-reveal-delay="80"><div class="shot-phone"><img src="img/games/em-games.webp" width="660" height="1434" alt="{E["a2"]}" loading="lazy"></div><figcaption>{E["c2"]}</figcaption></figure><figure class="shot" data-reveal data-reveal-delay="160"><div class="shot-phone"><img src="img/games/em-speak.webp" width="660" height="1434" alt="{E["a3"]}" loading="lazy"></div><figcaption>{E["c3"]}</figcaption></figure><figure class="shot" data-reveal data-reveal-delay="240"><div class="shot-phone"><img src="img/games/wm-games.webp" width="660" height="1434" alt="{E["a4"]}" loading="lazy"></div><figcaption>{E["c4"]}</figcaption></figure></div>
    <div class="games-copy" data-reveal>
      <ul class="bullets">
        <li>{CHECK}<span>{E["b1"]}</span></li>
        <li>{CHECK}<span>{E["b2"]}</span></li>
        <li>{CHECK}<span>{E["b3"]}</span></li>
        <li>{CHECK}<span>{E["b4"]}</span></li>
      </ul>
      <p class="hero-fine" style="margin-top:18px">{E["fine"]}</p>
    </div>
  </div>
</section>
'''

# ---- translations: same keys as E (markup kept exactly) ----
T = {
 "fr": {
  "label": '<span class="n">09</span> Apprendre en jouant</span>',
  "h2": '<h2>Cinq minutes de jeu, <span class="grad">du vrai anglais à la clé</span>.</h2>',
  "lede": "Chaque programme a son propre espace de jeux, construit à partir de ses propres leçons. Huit jeux courts transforment ce que vous apprenez en réponses que vous pouvez dire à voix haute.",
  "b1": f"<b>English Mastery, pour l'anglais général{NB}:</b> 385 mots, expressions et phrases de votre programme de 12 semaines et de la vie quotidienne, dans huit jeux — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle et Real-Life Missions.",
  "b2": f"<b>Welding Mastery, pour l'anglais du soudage{NB}:</b> 250 mots du métier avec de vraies photos des outils, des mots croisés, des séries d'écoute et des défis d'atelier.",
  "b3": "<b>Une mission du jour, un objectif de la semaine et des badges de compétence.</b> Un mot n'est maîtrisé qu'après des bonnes réponses trois jours différents — les XP seuls ne suffisent jamais.",
  "b4": f"<b>Speak Up vous écoute{NB}:</b> dites une phrase et voyez quels mots sont passés. Le score de prononciation est fait par IA, et il le dit.",
  "fine": f"Connectez-vous pour jouer. Gratuit{NB}: cinq séries de défis par jour dans chaque programme — une mauvaise réponse ne coûte jamais de série — plus la révision illimitée et la mission du jour. Premium{NB}: séries illimitées, situations avancées et tendances sur 30 et 90 jours.",
  "shots": '<h3 class="shots-h" data-reveal>Dans les espaces de jeux</h3>',
  "c1": "<b>English Mastery</b><span>Une mission du jour et votre objectif de la semaine</span>",
  "c2": "<b>Huit jeux</b><span>Chacun travaille une compétence différente</span>",
  "c3": "<b>Speak Up</b><span>Voyez quels mots sont passés</span>",
  "c4": "<b>Welding Mastery</b><span>250 mots du métier, de vraies photos</span>",
  "a1": f"L'espace English Mastery{NB}: niveau, XP, série et énergie, la mission d'anglais du jour et l'objectif de la semaine",
  "a2": f"Les jeux English Mastery{NB}: Word Quest, Quick Quiz, Sentence Builder et Listen &amp; Win, chacun avec la compétence travaillée",
  "a3": f"Speak Up après une prise{NB}: 88{NB}% des mots entendus, le mot manquant marqué en rouge",
  "a4": f"Les jeux Welding Mastery{NB}: Cartes, Quiz, Mots croisés, Reconnaissance visuelle, Écoute et Écris le mot",
  "new": f"<h3>Apprendre en jouant</h3><p>English Mastery et Welding Mastery{NB}: huit jeux chacun, une mission du jour et des badges de compétence.</p>",
  "pg": f"<span>English Mastery{NB}: huit jeux sur les mots et expressions de votre programme</span>",
  "pw": f"<span>Welding Mastery{NB}: huit jeux sur 250 mots du métier, avec de vraies photos</span>",
 },
 "es": {
  "label": '<span class="n">09</span> Aprender jugando</span>',
  "h2": '<h2>Cinco minutos de juego, <span class="grad">inglés real al final</span>.</h2>',
  "lede": "Cada programa tiene su propio espacio de juegos, creado a partir de sus propias lecciones. Ocho juegos cortos convierten lo que aprendes en respuestas que puedes decir en voz alta.",
  "b1": "<b>English Mastery, para el inglés general:</b> 385 palabras, expresiones y frases de tu plan de 12 semanas y de la vida diaria, en ocho juegos — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle y Real-Life Missions.",
  "b2": "<b>Welding Mastery, para el inglés de soldadura:</b> 250 palabras del oficio con fotos reales de las herramientas, un crucigrama, rondas de escucha y retos de taller.",
  "b3": "<b>Una misión diaria, un objetivo semanal e insignias de habilidad.</b> Una palabra solo cuenta como dominada tras respuestas correctas en tres días distintos — los XP por sí solos nunca la dominan.",
  "b4": "<b>Speak Up te escucha:</b> di una frase y mira qué palabras se entendieron. La puntuación de pronunciación es de IA, y lo indica.",
  "fine": "Inicia sesión para jugar. Gratis: cinco rondas de retos al día en cada programa — una respuesta incorrecta nunca cuesta una ronda — más repaso ilimitado y la misión diaria. Premium: rondas ilimitadas, situaciones avanzadas y tendencias de 30 y 90 días.",
  "shots": '<h3 class="shots-h" data-reveal>Dentro de los espacios de juegos</h3>',
  "c1": "<b>English Mastery</b><span>Una misión diaria y tu objetivo semanal</span>",
  "c2": "<b>Ocho juegos</b><span>Cada uno practica una habilidad distinta</span>",
  "c3": "<b>Speak Up</b><span>Mira qué palabras se entendieron</span>",
  "c4": "<b>Welding Mastery</b><span>250 palabras del oficio, fotos reales</span>",
  "a1": "El espacio English Mastery: nivel, XP, racha y energía, la misión de inglés del día y el objetivo semanal",
  "a2": "Los juegos de English Mastery: Word Quest, Quick Quiz, Sentence Builder y Listen &amp; Win, cada uno con la habilidad que practica",
  "a3": "Speak Up tras una toma: el 88 % de las palabras oídas, la palabra que falta marcada en rojo",
  "a4": "Los juegos de Welding Mastery: Tarjetas, Quiz, Crucigrama, Reconocimiento visual, Escucha y Constructor de palabras",
  "new": "<h3>Aprender jugando</h3><p>English Mastery y Welding Mastery: ocho juegos cada uno, una misión diaria e insignias de habilidad.</p>",
  "pg": "<span>English Mastery: ocho juegos con las palabras y expresiones de tu plan</span>",
  "pw": "<span>Welding Mastery: ocho juegos con 250 palabras del oficio y fotos reales</span>",
 },
 "pt": {
  "label": '<span class="n">09</span> Aprender jogando</span>',
  "h2": '<h2>Cinco minutos de jogo, <span class="grad">inglês de verdade no fim</span>.</h2>',
  "lede": "Cada programa tem o seu próprio espaço de jogos, criado a partir das suas próprias lições. Oito jogos curtos transformam o que você aprende em respostas que pode dizer em voz alta.",
  "b1": "<b>English Mastery, para o inglês geral:</b> 385 palavras, expressões e frases do seu plano de 12 semanas e do dia a dia, em oito jogos — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle e Real-Life Missions.",
  "b2": "<b>Welding Mastery, para o inglês da soldagem:</b> 250 palavras da profissão com fotos reais das ferramentas, palavras cruzadas, rodadas de escuta e desafios de oficina.",
  "b3": "<b>Uma missão diária, uma meta semanal e medalhas de habilidade.</b> Uma palavra só conta como dominada após respostas certas em três dias diferentes — XP sozinho nunca a domina.",
  "b4": "<b>O Speak Up ouve você:</b> diga uma frase e veja quais palavras foram entendidas. A nota de pronúncia é feita por IA, e isso é dito.",
  "fine": "Entre para jogar. Grátis: cinco rodadas de desafios por dia em cada programa — uma resposta errada nunca custa uma rodada — além de revisão ilimitada e da missão diária. Premium: rodadas ilimitadas, situações avançadas e tendências de 30 e 90 dias.",
  "shots": '<h3 class="shots-h" data-reveal>Dentro dos espaços de jogos</h3>',
  "c1": "<b>English Mastery</b><span>Uma missão diária e a sua meta semanal</span>",
  "c2": "<b>Oito jogos</b><span>Cada um pratica uma habilidade diferente</span>",
  "c3": "<b>Speak Up</b><span>Veja quais palavras foram entendidas</span>",
  "c4": "<b>Welding Mastery</b><span>250 palavras da profissão, fotos reais</span>",
  "a1": "O espaço English Mastery: nível, XP, sequência e energia, a missão de inglês do dia e a meta semanal",
  "a2": "Os jogos do English Mastery: Word Quest, Quick Quiz, Sentence Builder e Listen &amp; Win, cada um com a habilidade que pratica",
  "a3": "Speak Up depois de uma gravação: 88% das palavras ouvidas, a palavra que faltou marcada em vermelho",
  "a4": "Os jogos do Welding Mastery: Cartões, Quiz, Palavras cruzadas, Reconhecimento visual, Escuta e Construtor de palavras",
  "new": "<h3>Aprender jogando</h3><p>English Mastery e Welding Mastery: oito jogos cada, uma missão diária e medalhas de habilidade.</p>",
  "pg": "<span>English Mastery: oito jogos com as palavras e expressões do seu plano</span>",
  "pw": "<span>Welding Mastery: oito jogos com 250 palavras da profissão e fotos reais</span>",
 },
 "it": {
  "label": '<span class="n">09</span> Imparare giocando</span>',
  "h2": '<h2>Cinque minuti di gioco, <span class="grad">inglese vero alla fine</span>.</h2>',
  "lede": "Ogni programma ha il suo spazio giochi, costruito dalle sue lezioni. Otto giochi brevi trasformano ciò che impari in risposte che puoi dire ad alta voce.",
  "b1": "<b>English Mastery, per l'inglese generale:</b> 385 parole, espressioni e frasi dal tuo piano di 12 settimane e dalla vita di tutti i giorni, in otto giochi — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle e Real-Life Missions.",
  "b2": "<b>Welding Mastery, per l'inglese della saldatura:</b> 250 parole del mestiere con foto reali degli attrezzi, un cruciverba, round di ascolto e sfide d'officina.",
  "b3": "<b>Una missione del giorno, un obiettivo settimanale e badge di abilità.</b> Una parola conta come padroneggiata solo dopo risposte corrette in tre giorni diversi — gli XP da soli non bastano mai.",
  "b4": "<b>Speak Up ti ascolta:</b> di' una frase e guarda quali parole sono arrivate. Il punteggio di pronuncia è fatto dall'IA, e lo dice.",
  "fine": "Accedi per giocare. Gratis: cinque round di sfide al giorno in ogni programma — una risposta sbagliata non costa mai un round — più ripasso illimitato e la missione del giorno. Premium: round illimitati, situazioni avanzate e tendenze a 30 e 90 giorni.",
  "shots": '<h3 class="shots-h" data-reveal>Dentro gli spazi giochi</h3>',
  "c1": "<b>English Mastery</b><span>Una missione del giorno e il tuo obiettivo settimanale</span>",
  "c2": "<b>Otto giochi</b><span>Ognuno allena un'abilità diversa</span>",
  "c3": "<b>Speak Up</b><span>Guarda quali parole sono arrivate</span>",
  "c4": "<b>Welding Mastery</b><span>250 parole del mestiere, foto reali</span>",
  "a1": "Lo spazio English Mastery: livello, XP, serie ed energia, la missione d'inglese del giorno e l'obiettivo settimanale",
  "a2": "I giochi di English Mastery: Word Quest, Quick Quiz, Sentence Builder e Listen &amp; Win, ognuno con l'abilità che allena",
  "a3": "Speak Up dopo una registrazione: l'88% delle parole sentite, la parola mancante segnata in rosso",
  "a4": "I giochi di Welding Mastery: Carte, Quiz, Cruciverba, Riconoscimento visivo, Ascolto e Costruisci la parola",
  "new": "<h3>Imparare giocando</h3><p>English Mastery e Welding Mastery: otto giochi ciascuno, una missione del giorno e badge di abilità.</p>",
  "pg": "<span>English Mastery: otto giochi sulle parole e le espressioni del tuo piano</span>",
  "pw": "<span>Welding Mastery: otto giochi su 250 parole del mestiere, con foto reali</span>",
 },
 "de": {
  "label": '<span class="n">09</span> Spielend lernen</span>',
  "h2": '<h2>Fünf Minuten spielen, <span class="grad">am Ende echtes Englisch</span>.</h2>',
  "lede": "Jedes Programm hat seinen eigenen Spielbereich, gebaut aus seinen eigenen Lektionen. Acht kurze Spiele machen aus dem, was Sie lernen, Antworten, die Sie laut sagen können.",
  "b1": "<b>English Mastery, für allgemeines Englisch:</b> 385 Wörter, Wendungen und Sätze aus Ihrem 12-Wochen-Plan und aus dem Alltag, in acht Spielen — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle und Real-Life Missions.",
  "b2": "<b>Welding Mastery, für Schweiß-Englisch:</b> 250 Fachwörter mit echten Fotos der Werkzeuge, ein Kreuzworträtsel, Hörrunden und Werkstatt-Aufgaben.",
  "b3": "<b>Eine Tagesmission, ein Wochenziel und Fähigkeitsabzeichen.</b> Ein Wort gilt erst als beherrscht nach richtigen Antworten an drei verschiedenen Tagen — XP allein reichen nie.",
  "b4": "<b>Speak Up hört Ihnen zu:</b> Sprechen Sie einen Satz und sehen Sie, welche Wörter angekommen sind. Die Aussprachebewertung stammt von einer KI, und das steht dabei.",
  "fine": "Melden Sie sich an, um zu spielen. Kostenlos: fünf Aufgabenrunden pro Tag in jedem Programm — eine falsche Antwort kostet nie eine Runde — dazu unbegrenzte Wiederholung und die Tagesmission. Premium: unbegrenzte Runden, fortgeschrittene Situationen und Trends über 30 und 90 Tage.",
  "shots": '<h3 class="shots-h" data-reveal>In den Spielbereichen</h3>',
  "c1": "<b>English Mastery</b><span>Eine Tagesmission und Ihr Wochenziel</span>",
  "c2": "<b>Acht Spiele</b><span>Jedes übt eine andere Fähigkeit</span>",
  "c3": "<b>Speak Up</b><span>Sehen, welche Wörter angekommen sind</span>",
  "c4": "<b>Welding Mastery</b><span>250 Fachwörter, echte Fotos</span>",
  "a1": "Der Bereich English Mastery: Stufe, XP, Serie und Energie, die Englisch-Tagesmission und das Wochenziel",
  "a2": "Die Spiele von English Mastery: Word Quest, Quick Quiz, Sentence Builder und Listen &amp; Win, jedes mit der Fähigkeit, die es übt",
  "a3": "Speak Up nach einer Aufnahme: 88 % der Wörter verstanden, das fehlende Wort rot markiert",
  "a4": "Die Spiele von Welding Mastery: Karten, Quiz, Kreuzworträtsel, Bilderkennung, Hören und Wortbau",
  "new": "<h3>Spielend lernen</h3><p>English Mastery und Welding Mastery: je acht Spiele, eine Tagesmission und Fähigkeitsabzeichen.</p>",
  "pg": "<span>English Mastery: acht Spiele mit den Wörtern und Wendungen Ihres Plans</span>",
  "pw": "<span>Welding Mastery: acht Spiele mit 250 Fachwörtern und echten Fotos</span>",
 },
 "ru": {
  "label": '<span class="n">09</span> Учитесь играя</span>',
  "h2": '<h2>Пять минут игры — <span class="grad">и в итоге настоящий английский</span>.</h2>',
  "lede": "У каждой программы своё игровое пространство, построенное на её уроках. Восемь коротких игр превращают то, что вы учите, в ответы, которые можно сказать вслух.",
  "b1": "<b>English Mastery, для общего английского:</b> 385 слов, выражений и фраз из вашего 12-недельного плана и из повседневной жизни, в восьми играх — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle и Real-Life Missions.",
  "b2": "<b>Welding Mastery, для английского сварщика:</b> 250 профессиональных слов с настоящими фотографиями инструментов, кроссворд, раунды на слух и задания из мастерской.",
  "b3": "<b>Задание дня, цель недели и значки навыков.</b> Слово считается освоенным только после верных ответов в три разных дня — одних XP для этого никогда не достаточно.",
  "b4": "<b>Speak Up вас слышит:</b> скажите фразу и посмотрите, какие слова распознаны. Оценку произношения ставит ИИ, и об этом сказано.",
  "fine": "Войдите, чтобы играть. Бесплатно: пять раундов заданий в день в каждой программе — неверный ответ никогда не стоит раунда — плюс неограниченное повторение и задание дня. Premium: неограниченные раунды, сложные ситуации и тренды за 30 и 90 дней.",
  "shots": '<h3 class="shots-h" data-reveal>Внутри игровых пространств</h3>',
  "c1": "<b>English Mastery</b><span>Задание дня и цель недели</span>",
  "c2": "<b>Восемь игр</b><span>Каждая тренирует свой навык</span>",
  "c3": "<b>Speak Up</b><span>Видно, какие слова распознаны</span>",
  "c4": "<b>Welding Mastery</b><span>250 профессиональных слов, настоящие фото</span>",
  "a1": "Пространство English Mastery: уровень, XP, серия и энергия, задание дня по английскому и цель недели",
  "a2": "Игры English Mastery: Word Quest, Quick Quiz, Sentence Builder и Listen &amp; Win, у каждой — навык, который она тренирует",
  "a3": "Speak Up после записи: распознано 88% слов, пропущенное слово отмечено красным",
  "a4": "Игры Welding Mastery: Карточки, Викторина, Кроссворд, Визуальное узнавание, Аудирование и Собери слово",
  "new": "<h3>Учитесь играя</h3><p>English Mastery и Welding Mastery: по восемь игр, задание дня и значки навыков.</p>",
  "pg": "<span>English Mastery: восемь игр на слова и выражения вашего плана</span>",
  "pw": "<span>Welding Mastery: восемь игр на 250 профессиональных слов, с настоящими фото</span>",
 },
 "ar": {
  "label": '<span class="n">09</span> تعلّم باللعب</span>',
  "h2": '<h2>خمس دقائق من اللعب، <span class="grad">وإنجليزية حقيقية في النهاية</span>.</h2>',
  "lede": "لكل برنامج مساحة ألعاب خاصة به، مبنية من دروسه. ثماني ألعاب قصيرة تحوّل ما تتعلمه إلى إجابات يمكنك قولها بصوت عالٍ.",
  "b1": "<b>English Mastery، للإنجليزية العامة:</b> 385 كلمة وعبارة وجملة من خطتك لمدة 12 أسبوعًا ومن الحياة اليومية، في ثماني ألعاب — Word Quest وQuick Quiz وSentence Builder وListen &amp; Win وSpeak Up وPhrase Match وWord Puzzle وReal-Life Missions.",
  "b2": "<b>Welding Mastery، لإنجليزية اللحام:</b> 250 كلمة من المهنة مع صور حقيقية للأدوات، وكلمات متقاطعة، وجولات استماع، وتحديات الورشة.",
  "b3": "<b>مهمة يومية وهدف أسبوعي وشارات مهارة.</b> لا تُعدّ الكلمة متقنة إلا بعد إجابات صحيحة في ثلاثة أيام مختلفة — نقاط XP وحدها لا تكفي أبدًا.",
  "b4": "<b>Speak Up يسمعك:</b> قل جملة وشاهد أي الكلمات وصلت. تقييم النطق يقوم به الذكاء الاصطناعي، ويُذكر ذلك.",
  "fine": "سجّل الدخول للعب. مجانًا: خمس جولات تحدٍّ يوميًا في كل برنامج — الإجابة الخاطئة لا تكلّف جولة أبدًا — بالإضافة إلى مراجعة غير محدودة والمهمة اليومية. Premium: جولات غير محدودة ومواقف متقدمة واتجاهات 30 و90 يومًا.",
  "shots": '<h3 class="shots-h" data-reveal>داخل مساحات الألعاب</h3>',
  "c1": "<b>English Mastery</b><span>مهمة يومية وهدفك الأسبوعي</span>",
  "c2": "<b>ثماني ألعاب</b><span>كل واحدة تدرّب مهارة مختلفة</span>",
  "c3": "<b>Speak Up</b><span>شاهد أي الكلمات وصلت</span>",
  "c4": "<b>Welding Mastery</b><span>250 كلمة من المهنة، صور حقيقية</span>",
  "a1": "مساحة English Mastery: المستوى ونقاط XP والسلسلة والطاقة، مهمة الإنجليزية لليوم والهدف الأسبوعي",
  "a2": "ألعاب English Mastery: ‏Word Quest وQuick Quiz وSentence Builder وListen &amp; Win، ولكل منها المهارة التي تدرّبها",
  "a3": "Speak Up بعد تسجيل: سُمع 88% من الكلمات، والكلمة الناقصة معلّمة بالأحمر",
  "a4": "ألعاب Welding Mastery: البطاقات والاختبار والكلمات المتقاطعة والتعرّف البصري والاستماع وبناء الكلمة",
  "new": "<h3>تعلّم باللعب</h3><p>English Mastery وWelding Mastery: ثماني ألعاب لكل منهما، ومهمة يومية، وشارات مهارة.</p>",
  "pg": "<span>English Mastery: ثماني ألعاب على كلمات خطتك وعباراتها</span>",
  "pw": "<span>Welding Mastery: ثماني ألعاب على 250 كلمة من المهنة، مع صور حقيقية</span>",
 },
 "ur": {
  "label": '<span class="n">09</span> کھیل کر سیکھیں</span>',
  "h2": '<h2>پانچ منٹ کا کھیل، <span class="grad">آخر میں اصلی انگریزی</span>۔</h2>',
  "lede": "ہر پروگرام کی اپنی گیمز کی جگہ ہے، جو اس کے اپنے اسباق سے بنی ہے۔ آٹھ مختصر گیمز آپ کی سیکھی ہوئی چیزوں کو ایسے جوابات میں بدلتی ہیں جو آپ بلند آواز سے کہہ سکیں۔",
  "b1": "<b>English Mastery، جنرل انگلش کے لیے:</b> آپ کے 12 ہفتوں کے منصوبے اور روزمرہ زندگی سے 385 الفاظ، جملے اور فقرے، آٹھ گیمز میں — Word Quest، Quick Quiz، Sentence Builder، Listen &amp; Win، Speak Up، Phrase Match، Word Puzzle اور Real-Life Missions۔",
  "b2": "<b>Welding Mastery، ویلڈنگ انگلش کے لیے:</b> اوزاروں کی اصلی تصاویر کے ساتھ پیشے کے 250 الفاظ، ایک کراس ورڈ، سننے کے راؤنڈ اور ورکشاپ چیلنجز۔",
  "b3": "<b>روزانہ مشن، ہفتہ وار ہدف اور مہارت کے بیج۔</b> کوئی لفظ تب ہی پختہ مانا جاتا ہے جب تین مختلف دنوں میں درست جواب ملیں — صرف XP سے کبھی نہیں۔",
  "b4": "<b>Speak Up آپ کو سنتا ہے:</b> ایک جملہ بولیں اور دیکھیں کون سے الفاظ پہنچے۔ تلفظ کا اسکور AI دیتا ہے، اور یہ بتایا جاتا ہے۔",
  "fine": "کھیلنے کے لیے سائن اِن کریں۔ مفت: ہر پروگرام میں روزانہ پانچ چیلنج راؤنڈ — غلط جواب کبھی راؤنڈ نہیں لیتا — ساتھ میں لامحدود دہرائی اور روزانہ مشن۔ Premium: لامحدود راؤنڈ، اعلیٰ سطح کی صورتِ حال اور 30 اور 90 دن کے رجحانات۔",
  "shots": '<h3 class="shots-h" data-reveal>گیمز کی جگہوں کے اندر</h3>',
  "c1": "<b>English Mastery</b><span>روزانہ مشن اور آپ کا ہفتہ وار ہدف</span>",
  "c2": "<b>آٹھ گیمز</b><span>ہر ایک الگ مہارت کی مشق کراتی ہے</span>",
  "c3": "<b>Speak Up</b><span>دیکھیں کون سے الفاظ پہنچے</span>",
  "c4": "<b>Welding Mastery</b><span>پیشے کے 250 الفاظ، اصلی تصاویر</span>",
  "a1": "English Mastery کی جگہ: لیول، XP، سلسلہ اور توانائی، آج کا انگریزی مشن اور ہفتہ وار ہدف",
  "a2": "English Mastery کی گیمز: Word Quest، Quick Quiz، Sentence Builder اور Listen &amp; Win، ہر ایک کے ساتھ اس کی مہارت",
  "a3": "ریکارڈنگ کے بعد Speak Up: 88% الفاظ سنے گئے، چھوٹا ہوا لفظ سرخ نشان کے ساتھ",
  "a4": "Welding Mastery کی گیمز: کارڈز، کوئز، کراس ورڈ، بصری پہچان، سننا اور لفظ بنائیں",
  "new": "<h3>کھیل کر سیکھیں</h3><p>English Mastery اور Welding Mastery: ہر ایک میں آٹھ گیمز، روزانہ مشن اور مہارت کے بیج۔</p>",
  "pg": "<span>English Mastery: آپ کے منصوبے کے الفاظ اور فقروں پر آٹھ گیمز</span>",
  "pw": "<span>Welding Mastery: پیشے کے 250 الفاظ پر آٹھ گیمز، اصلی تصاویر کے ساتھ</span>",
 },
 "hi": {
  "label": '<span class="n">09</span> खेलकर सीखें</span>',
  "h2": '<h2>पाँच मिनट का खेल, <span class="grad">आख़िर में असली अंग्रेज़ी</span>।</h2>',
  "lede": "हर प्रोग्राम का अपना गेम हब है, जो उसके अपने पाठों से बना है। आठ छोटे गेम आप जो सीख रहे हैं उसे ऐसे जवाबों में बदलते हैं जिन्हें आप ज़ोर से बोल सकें।",
  "b1": "<b>English Mastery, जनरल इंग्लिश के लिए:</b> आपकी 12 हफ़्ते की योजना और रोज़मर्रा की ज़िंदगी से 385 शब्द, वाक्यांश और वाक्य, आठ गेम में — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle और Real-Life Missions।",
  "b2": "<b>Welding Mastery, वेल्डिंग इंग्लिश के लिए:</b> औज़ारों की असली तस्वीरों के साथ पेशे के 250 शब्द, एक क्रॉसवर्ड, सुनने के राउंड और वर्कशॉप चुनौतियाँ।",
  "b3": "<b>रोज़ का मिशन, हफ़्ते का लक्ष्य और कौशल बैज।</b> कोई शब्द तभी पक्का माना जाता है जब तीन अलग-अलग दिनों में सही जवाब मिलें — सिर्फ़ XP से कभी नहीं।",
  "b4": "<b>Speak Up आपको सुनता है:</b> एक वाक्य बोलें और देखें कौन से शब्द पहुँचे। उच्चारण स्कोर AI देता है, और यह बताया जाता है।",
  "fine": "खेलने के लिए साइन इन करें। मुफ़्त: हर प्रोग्राम में रोज़ पाँच चैलेंज राउंड — ग़लत जवाब से कभी राउंड नहीं घटता — साथ में असीमित दोहराव और रोज़ का मिशन। Premium: असीमित राउंड, उन्नत स्थितियाँ और 30 और 90 दिन के रुझान।",
  "shots": '<h3 class="shots-h" data-reveal>गेम हब के अंदर</h3>',
  "c1": "<b>English Mastery</b><span>रोज़ का मिशन और आपका हफ़्ते का लक्ष्य</span>",
  "c2": "<b>आठ गेम</b><span>हर एक अलग कौशल का अभ्यास कराता है</span>",
  "c3": "<b>Speak Up</b><span>देखें कौन से शब्द पहुँचे</span>",
  "c4": "<b>Welding Mastery</b><span>पेशे के 250 शब्द, असली तस्वीरें</span>",
  "a1": "English Mastery हब: लेवल, XP, स्ट्रीक और एनर्जी, आज का अंग्रेज़ी मिशन और हफ़्ते का लक्ष्य",
  "a2": "English Mastery के गेम: Word Quest, Quick Quiz, Sentence Builder और Listen &amp; Win, हर एक के साथ उसका कौशल",
  "a3": "रिकॉर्डिंग के बाद Speak Up: 88% शब्द सुने गए, छूटा हुआ शब्द लाल रंग में",
  "a4": "Welding Mastery के गेम: कार्ड, क्विज़, क्रॉसवर्ड, दृश्य पहचान, सुनना और शब्द बनाएँ",
  "new": "<h3>खेलकर सीखें</h3><p>English Mastery और Welding Mastery: हर एक में आठ गेम, रोज़ का मिशन और कौशल बैज।</p>",
  "pg": "<span>English Mastery: आपकी योजना के शब्दों और वाक्यांशों पर आठ गेम</span>",
  "pw": "<span>Welding Mastery: पेशे के 250 शब्दों पर आठ गेम, असली तस्वीरों के साथ</span>",
 },
 "bn": {
  "label": '<span class="n">09</span> খেলে খেলে শিখুন</span>',
  "h2": '<h2>পাঁচ মিনিটের খেলা, <span class="grad">শেষে আসল ইংরেজি</span>।</h2>',
  "lede": "প্রতিটি প্রোগ্রামের নিজস্ব গেম হাব আছে, যা তার নিজের পাঠ থেকে তৈরি। আটটি ছোট গেম আপনি যা শিখছেন তাকে এমন উত্তরে বদলে দেয় যা আপনি জোরে বলতে পারেন।",
  "b1": "<b>English Mastery, জেনারেল ইংলিশের জন্য:</b> আপনার ১২ সপ্তাহের পরিকল্পনা ও দৈনন্দিন জীবন থেকে ৩৮৫টি শব্দ, বাক্যাংশ ও বাক্য, আটটি গেমে — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle ও Real-Life Missions।",
  "b2": "<b>Welding Mastery, ওয়েল্ডিং ইংলিশের জন্য:</b> সরঞ্জামের আসল ছবি সহ পেশার ২৫০টি শব্দ, একটি ক্রসওয়ার্ড, শোনার রাউন্ড ও ওয়ার্কশপ চ্যালেঞ্জ।",
  "b3": "<b>দৈনিক মিশন, সাপ্তাহিক লক্ষ্য ও দক্ষতার ব্যাজ।</b> তিনটি ভিন্ন দিনে সঠিক উত্তরের পরেই একটি শব্দ আয়ত্ত বলে গণ্য হয় — শুধু XP দিয়ে কখনো নয়।",
  "b4": "<b>Speak Up আপনাকে শোনে:</b> একটি বাক্য বলুন এবং দেখুন কোন শব্দগুলো পৌঁছাল। উচ্চারণের স্কোর দেয় AI, এবং তা জানানো হয়।",
  "fine": "খেলতে সাইন ইন করুন। ফ্রি: প্রতিটি প্রোগ্রামে দিনে পাঁচটি চ্যালেঞ্জ রাউন্ড — ভুল উত্তরে কখনো রাউন্ড কাটে না — সঙ্গে সীমাহীন রিভিউ ও দৈনিক মিশন। Premium: সীমাহীন রাউন্ড, উন্নত পরিস্থিতি এবং ৩০ ও ৯০ দিনের প্রবণতা।",
  "shots": '<h3 class="shots-h" data-reveal>গেম হাবের ভেতরে</h3>',
  "c1": "<b>English Mastery</b><span>দৈনিক মিশন ও আপনার সাপ্তাহিক লক্ষ্য</span>",
  "c2": "<b>আটটি গেম</b><span>প্রতিটি আলাদা দক্ষতার অনুশীলন করায়</span>",
  "c3": "<b>Speak Up</b><span>দেখুন কোন শব্দগুলো পৌঁছাল</span>",
  "c4": "<b>Welding Mastery</b><span>পেশার ২৫০টি শব্দ, আসল ছবি</span>",
  "a1": "English Mastery হাব: লেভেল, XP, স্ট্রিক ও এনার্জি, আজকের ইংরেজি মিশন ও সাপ্তাহিক লক্ষ্য",
  "a2": "English Mastery-র গেম: Word Quest, Quick Quiz, Sentence Builder ও Listen &amp; Win, প্রতিটির সঙ্গে তার দক্ষতা",
  "a3": "রেকর্ডিংয়ের পর Speak Up: ৮৮% শব্দ শোনা গেছে, বাদ পড়া শব্দটি লাল চিহ্নিত",
  "a4": "Welding Mastery-র গেম: কার্ড, কুইজ, ক্রসওয়ার্ড, দৃশ্য শনাক্তকরণ, শোনা ও শব্দ গঠন",
  "new": "<h3>খেলে খেলে শিখুন</h3><p>English Mastery ও Welding Mastery: প্রতিটিতে আটটি গেম, দৈনিক মিশন ও দক্ষতার ব্যাজ।</p>",
  "pg": "<span>English Mastery: আপনার পরিকল্পনার শব্দ ও বাক্যাংশ নিয়ে আটটি গেম</span>",
  "pw": "<span>Welding Mastery: পেশার ২৫০টি শব্দ নিয়ে আটটি গেম, আসল ছবি সহ</span>",
 },
 "id": {
  "label": '<span class="n">09</span> Belajar sambil bermain</span>',
  "h2": '<h2>Lima menit bermain, <span class="grad">bahasa Inggris nyata di akhirnya</span>.</h2>',
  "lede": "Setiap program punya ruang permainannya sendiri, dibangun dari pelajarannya sendiri. Delapan permainan singkat mengubah apa yang Anda pelajari menjadi jawaban yang bisa Anda ucapkan dengan lantang.",
  "b1": "<b>English Mastery, untuk bahasa Inggris umum:</b> 385 kata, ungkapan, dan kalimat dari rencana 12 minggu Anda dan dari kehidupan sehari-hari, dalam delapan permainan — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle, dan Real-Life Missions.",
  "b2": "<b>Welding Mastery, untuk bahasa Inggris pengelasan:</b> 250 kata profesi dengan foto asli peralatan, teka-teki silang, putaran mendengarkan, dan tantangan bengkel.",
  "b3": "<b>Misi harian, target mingguan, dan lencana keterampilan.</b> Sebuah kata baru dianggap dikuasai setelah jawaban benar di tiga hari berbeda — XP saja tidak pernah cukup.",
  "b4": "<b>Speak Up mendengarkan Anda:</b> ucapkan sebuah kalimat dan lihat kata mana yang tertangkap. Skor pelafalan dibuat oleh AI, dan itu disebutkan.",
  "fine": "Masuk untuk bermain. Gratis: lima putaran tantangan per hari di setiap program — jawaban salah tidak pernah menghabiskan putaran — ditambah pengulangan tanpa batas dan misi harian. Premium: putaran tanpa batas, situasi lanjutan, dan tren 30 dan 90 hari.",
  "shots": '<h3 class="shots-h" data-reveal>Di dalam ruang permainan</h3>',
  "c1": "<b>English Mastery</b><span>Misi harian dan target mingguan Anda</span>",
  "c2": "<b>Delapan permainan</b><span>Masing-masing melatih keterampilan berbeda</span>",
  "c3": "<b>Speak Up</b><span>Lihat kata mana yang tertangkap</span>",
  "c4": "<b>Welding Mastery</b><span>250 kata profesi, foto asli</span>",
  "a1": "Ruang English Mastery: level, XP, rentetan dan energi, misi bahasa Inggris hari ini dan target mingguan",
  "a2": "Permainan English Mastery: Word Quest, Quick Quiz, Sentence Builder, dan Listen &amp; Win, masing-masing dengan keterampilan yang dilatih",
  "a3": "Speak Up setelah rekaman: 88% kata terdengar, kata yang hilang ditandai merah",
  "a4": "Permainan Welding Mastery: Kartu, Kuis, Teka-teki silang, Pengenalan visual, Mendengarkan, dan Susun kata",
  "new": "<h3>Belajar sambil bermain</h3><p>English Mastery dan Welding Mastery: masing-masing delapan permainan, misi harian, dan lencana keterampilan.</p>",
  "pg": "<span>English Mastery: delapan permainan dengan kata dan ungkapan dari rencana Anda</span>",
  "pw": "<span>Welding Mastery: delapan permainan dengan 250 kata profesi, dengan foto asli</span>",
 },
 "vi": {
  "label": '<span class="n">09</span> Học qua trò chơi</span>',
  "h2": '<h2>Năm phút chơi, <span class="grad">cuối cùng là tiếng Anh thật</span>.</h2>',
  "lede": "Mỗi chương trình có khu trò chơi riêng, xây dựng từ chính các bài học của nó. Tám trò chơi ngắn biến những gì bạn học thành câu trả lời bạn có thể nói thành tiếng.",
  "b1": "<b>English Mastery, cho tiếng Anh tổng quát:</b> 385 từ, cụm từ và câu từ kế hoạch 12 tuần của bạn và từ đời sống hằng ngày, trong tám trò chơi — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle và Real-Life Missions.",
  "b2": "<b>Welding Mastery, cho tiếng Anh ngành hàn:</b> 250 từ chuyên ngành kèm ảnh thật của dụng cụ, ô chữ, các vòng nghe và thử thách xưởng.",
  "b3": "<b>Nhiệm vụ hằng ngày, mục tiêu tuần và huy hiệu kỹ năng.</b> Một từ chỉ được tính là thành thạo sau khi trả lời đúng vào ba ngày khác nhau — chỉ XP thì không bao giờ đủ.",
  "b4": "<b>Speak Up lắng nghe bạn:</b> nói một câu và xem những từ nào được nhận ra. Điểm phát âm do AI chấm, và điều đó được ghi rõ.",
  "fine": "Đăng nhập để chơi. Miễn phí: năm vòng thử thách mỗi ngày trong mỗi chương trình — trả lời sai không bao giờ mất vòng — cùng ôn tập không giới hạn và nhiệm vụ hằng ngày. Premium: vòng không giới hạn, tình huống nâng cao và xu hướng 30 và 90 ngày.",
  "shots": '<h3 class="shots-h" data-reveal>Bên trong khu trò chơi</h3>',
  "c1": "<b>English Mastery</b><span>Nhiệm vụ hằng ngày và mục tiêu tuần của bạn</span>",
  "c2": "<b>Tám trò chơi</b><span>Mỗi trò luyện một kỹ năng khác nhau</span>",
  "c3": "<b>Speak Up</b><span>Xem những từ nào được nhận ra</span>",
  "c4": "<b>Welding Mastery</b><span>250 từ chuyên ngành, ảnh thật</span>",
  "a1": "Khu English Mastery: cấp độ, XP, chuỗi ngày và năng lượng, nhiệm vụ tiếng Anh hôm nay và mục tiêu tuần",
  "a2": "Các trò chơi English Mastery: Word Quest, Quick Quiz, Sentence Builder và Listen &amp; Win, mỗi trò kèm kỹ năng nó luyện",
  "a3": "Speak Up sau một lần thu: nghe được 88% số từ, từ còn thiếu được đánh dấu đỏ",
  "a4": "Các trò chơi Welding Mastery: Thẻ, Câu đố, Ô chữ, Nhận diện hình ảnh, Nghe và Ghép từ",
  "new": "<h3>Học qua trò chơi</h3><p>English Mastery và Welding Mastery: mỗi bên tám trò chơi, nhiệm vụ hằng ngày và huy hiệu kỹ năng.</p>",
  "pg": "<span>English Mastery: tám trò chơi với từ và cụm từ trong kế hoạch của bạn</span>",
  "pw": "<span>Welding Mastery: tám trò chơi với 250 từ chuyên ngành, kèm ảnh thật</span>",
 },
 "zh": {
  "label": '<span class="n">09</span> 在游戏中学习</span>',
  "h2": '<h2>玩五分钟，<span class="grad">收获真正的英语</span>。</h2>',
  "lede": "每个课程都有自己的游戏中心，由它自己的课程内容构建。八个简短的游戏把你所学的内容变成可以大声说出口的回答。",
  "b1": "<b>English Mastery，面向通用英语：</b>来自你的 12 周计划和日常生活的 385 个单词、短语和句子，分布在八个游戏中 — Word Quest、Quick Quiz、Sentence Builder、Listen &amp; Win、Speak Up、Phrase Match、Word Puzzle 和 Real-Life Missions。",
  "b2": "<b>Welding Mastery，面向焊接英语：</b>250 个行业词汇，配有工具的真实照片，还有填字游戏、听力回合和车间挑战。",
  "b3": "<b>每日任务、每周目标和技能徽章。</b>一个词只有在三个不同的日子都答对后才算掌握 — 仅靠 XP 永远不够。",
  "b4": "<b>Speak Up 会听你说：</b>说一句话，看看哪些词被识别出来。发音评分由 AI 给出，并会注明。",
  "fine": "登录即可开始游戏。免费：每个课程每天五轮挑战 — 答错从不消耗回合 — 外加无限复习和每日任务。Premium：无限回合、进阶情境以及 30 天和 90 天趋势。",
  "shots": '<h3 class="shots-h" data-reveal>游戏中心内部</h3>',
  "c1": "<b>English Mastery</b><span>每日任务和你的每周目标</span>",
  "c2": "<b>八个游戏</b><span>每个练习一种不同的技能</span>",
  "c3": "<b>Speak Up</b><span>看看哪些词被识别出来</span>",
  "c4": "<b>Welding Mastery</b><span>250 个行业词汇，真实照片</span>",
  "a1": "English Mastery 中心：等级、XP、连续天数和能量、今日英语任务和每周目标",
  "a2": "English Mastery 的游戏：Word Quest、Quick Quiz、Sentence Builder 和 Listen &amp; Win，每个都标明所练习的技能",
  "a3": "录音后的 Speak Up：识别出 88% 的单词，缺少的词以红色标出",
  "a4": "Welding Mastery 的游戏：卡片、测验、填字游戏、图像识别、听力和拼词",
  "new": "<h3>在游戏中学习</h3><p>English Mastery 和 Welding Mastery：各有八个游戏、每日任务和技能徽章。</p>",
  "pg": "<span>English Mastery：用你计划中的单词和短语玩八个游戏</span>",
  "pw": "<span>Welding Mastery：用 250 个行业词汇玩八个游戏，配有真实照片</span>",
 },
 "ja": {
  "label": '<span class="n">09</span> 遊んで学ぶ</span>',
  "h2": '<h2>5分間のゲームで、<span class="grad">最後には本物の英語を</span>。</h2>',
  "lede": "それぞれのプログラムに、そのレッスンから作られた専用のゲームハブがあります。8つの短いゲームが、学んでいることを声に出して言える答えに変えます。",
  "b1": "<b>English Mastery（一般英語）：</b>12週間のプランと日常生活から選んだ385の単語・フレーズ・文を、8つのゲームで — Word Quest、Quick Quiz、Sentence Builder、Listen &amp; Win、Speak Up、Phrase Match、Word Puzzle、Real-Life Missions。",
  "b2": "<b>Welding Mastery（溶接英語）：</b>工具の実物写真つきの専門用語250語、クロスワード、リスニングのラウンド、作業場のチャレンジ。",
  "b3": "<b>デイリーミッション、週間目標、スキルバッジ。</b>単語は3つの異なる日に正解して初めて習得とみなされます — XPだけで習得になることはありません。",
  "b4": "<b>Speak Upはあなたの声を聞きます：</b>文を声に出して、どの単語が伝わったかを確認できます。発音スコアはAIによるもので、そのことが明記されます。",
  "fine": "プレイするにはサインインしてください。無料：各プログラムで1日5回のチャレンジ — 間違えても回数は減りません — に加えて、無制限の復習とデイリーミッション。Premium：回数無制限、上級のシチュエーション、30日・90日のトレンド。",
  "shots": '<h3 class="shots-h" data-reveal>ゲームハブの中</h3>',
  "c1": "<b>English Mastery</b><span>デイリーミッションと週間目標</span>",
  "c2": "<b>8つのゲーム</b><span>それぞれ別のスキルを練習</span>",
  "c3": "<b>Speak Up</b><span>どの単語が伝わったか確認</span>",
  "c4": "<b>Welding Mastery</b><span>専門用語250語、実物写真</span>",
  "a1": "English Masteryのハブ：レベル、XP、連続記録とエネルギー、今日の英語ミッションと週間目標",
  "a2": "English Masteryのゲーム：Word Quest、Quick Quiz、Sentence Builder、Listen &amp; Win。それぞれ練習するスキルつき",
  "a3": "録音後のSpeak Up：単語の88%を認識、抜けた単語は赤で表示",
  "a4": "Welding Masteryのゲーム：カード、クイズ、クロスワード、画像認識、リスニング、単語づくり",
  "new": "<h3>遊んで学ぶ</h3><p>English MasteryとWelding Mastery：それぞれ8つのゲーム、デイリーミッション、スキルバッジ。</p>",
  "pg": "<span>English Mastery：プランの単語とフレーズで遊ぶ8つのゲーム</span>",
  "pw": "<span>Welding Mastery：専門用語250語で遊ぶ8つのゲーム、実物写真つき</span>",
 },
 "ko": {
  "label": '<span class="n">09</span> 게임으로 배우기</span>',
  "h2": '<h2>5분의 게임, <span class="grad">끝에는 진짜 영어</span>.</h2>',
  "lede": "각 프로그램에는 자체 수업으로 만든 고유한 게임 허브가 있습니다. 여덟 가지 짧은 게임이 배우는 내용을 소리 내어 말할 수 있는 답으로 바꿔 줍니다.",
  "b1": "<b>English Mastery, 일반 영어:</b> 12주 계획과 일상생활에서 가져온 385개의 단어·표현·문장을 여덟 가지 게임으로 — Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, Speak Up, Phrase Match, Word Puzzle, Real-Life Missions.",
  "b2": "<b>Welding Mastery, 용접 영어:</b> 공구의 실제 사진이 있는 직무 단어 250개, 십자말풀이, 듣기 라운드, 작업장 도전 과제.",
  "b3": "<b>오늘의 미션, 주간 목표, 기술 배지.</b> 단어는 서로 다른 세 날에 정답을 맞힌 뒤에야 익힌 것으로 인정됩니다 — XP만으로는 절대 익힐 수 없습니다.",
  "b4": "<b>Speak Up이 여러분의 말을 듣습니다:</b> 문장을 말하고 어떤 단어가 전달됐는지 확인하세요. 발음 점수는 AI가 매기며, 그 사실을 밝힙니다.",
  "fine": "플레이하려면 로그인하세요. 무료: 프로그램마다 하루 5번의 도전 라운드 — 틀린 답은 절대 라운드를 소모하지 않습니다 — 그리고 무제한 복습과 오늘의 미션. Premium: 무제한 라운드, 고급 상황, 30일·90일 추세.",
  "shots": '<h3 class="shots-h" data-reveal>게임 허브 안에서</h3>',
  "c1": "<b>English Mastery</b><span>오늘의 미션과 주간 목표</span>",
  "c2": "<b>여덟 가지 게임</b><span>각각 다른 기술을 연습합니다</span>",
  "c3": "<b>Speak Up</b><span>어떤 단어가 전달됐는지 확인</span>",
  "c4": "<b>Welding Mastery</b><span>직무 단어 250개, 실제 사진</span>",
  "a1": "English Mastery 허브: 레벨, XP, 연속 기록과 에너지, 오늘의 영어 미션과 주간 목표",
  "a2": "English Mastery 게임: Word Quest, Quick Quiz, Sentence Builder, Listen &amp; Win, 각 게임이 연습하는 기술 표시",
  "a3": "녹음 후 Speak Up: 단어의 88% 인식, 빠진 단어는 빨간색으로 표시",
  "a4": "Welding Mastery 게임: 카드, 퀴즈, 십자말풀이, 시각 인식, 듣기, 단어 만들기",
  "new": "<h3>게임으로 배우기</h3><p>English Mastery와 Welding Mastery: 각각 여덟 가지 게임, 오늘의 미션, 기술 배지.</p>",
  "pg": "<span>English Mastery: 계획 속 단어와 표현으로 하는 여덟 가지 게임</span>",
  "pw": "<span>Welding Mastery: 직무 단어 250개로 하는 여덟 가지 게임, 실제 사진 포함</span>",
 },
}
assert set(T) == set(LANGS), set(LANGS) ^ set(T)
for c, d in T.items():
    assert set(d) == set(E), (c, set(E) ^ set(d))

def renumber(s):
    # 09-14 -> 10-15, highest first so nothing is bumped twice
    for n in range(14, 8, -1):
        s = s.replace(f'<span class="n">{n:02d}</span>', f'<span class="n">{n + 1:02d}</span>')
    return s

# ---- the English page ----
html = open(PAGE, encoding="utf8").read()
if 'id="games"' in html: sys.exit("already applied")
html = renumber(html)
html = html.replace("<!-- ── 08 WHO IT", "<!-- ── 09 WHO IT", 1)   # the comment above the next section, if numbered
i = html.index('<section class="section" id="widgets">'); j = html.index("</section>", i) + len("</section>")
html = html[:j] + "\n" + SECTION + html[j:]
assert html.count(OLD_CARD) == 1
html = html.replace(OLD_CARD, E["new"])
# the Two programmes lists: one more line each, after the last item
g_last = f'<li>{CHECK2}<span>The speaking report, Phrase Lab, grammar exercises and 14 Life Simulations</span></li>'
w_last = f'<li>{CHECK2}<span>Professional interview coaches, judged against the trade\'s own standards</span></li>'
for last, key in ((g_last, "pg"), (w_last, "pw")):
    assert html.count(last) == 1, key
    html = html.replace(last, last + f'\n          <li>{CHECK2}{E[key]}</li>')
open(PAGE, "w", encoding="utf8").write(html)

# ---- the 15 dictionaries ----
def lit(s): return "`" + s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${") + "`"
for c in LANGS:
    p = DICT.format(c); src = open(p, encoding="utf8").read()
    src = renumber(src)
    # the old "What's new" card entry goes; its replacement is added below
    m = re.search(r"\n\s*\[`" + re.escape(OLD_CARD) + r"`,[\s\S]*?\],[ \t]*(?=\n)", src)
    assert m, c + ": old card entry not found"
    src = src[:m.start()] + src[m.end():]
    rows = "\n  // the game hubs (10 Oct 2026)\n" + "".join(f"  [{lit(E[k])},\n   {lit(T[c][k])}],\n" for k in E)
    k = src.rindex("];")
    src = src[:k].rstrip() + "\n" + rows + src[k:]
    open(p, "w", encoding="utf8").write(src)
print("page + 15 dictionaries updated")
