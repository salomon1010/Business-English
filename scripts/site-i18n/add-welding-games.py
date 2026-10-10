"""One-off (10 Oct 2026): Welding Mastery on lomonec.com/bemastery, in its own right.

· Play to learn: the shots become two rows of three — English Mastery (home,
  games, Speak Up) and Welding Mastery (home, games, Visual recognition with a
  real Commons photograph and its credit) — each under its own heading.
· Welding English: one more line in its list, for Welding Mastery.
The 15 dictionaries get the same changes. Machine transcreation, like the rest
of the site — to be read by native speakers. Run from the repo root, then
node scripts/site-i18n/build.mjs.
"""
import os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PAGE = os.path.join(ROOT, "site/bemastery/index.html")
DICT = os.path.join(ROOT, "scripts/site-i18n/bemastery.{}.mjs")
LANGS = ["es", "fr", "pt", "it", "de", "ru", "ar", "ur", "hi", "bn", "id", "vi", "zh", "ja", "ko"]
NB = " "
CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>'

OLD_H = '<h3 class="shots-h" data-reveal>Inside the game hubs</h3>'
E = {
 "s_em": '<h3 class="shots-h" data-reveal>English Mastery · General English</h3>',
 "s_wm": '<h3 class="shots-h" data-reveal>Welding Mastery · Welding English</h3>',
 "c6": '<b>Visual recognition</b><span>Name the tool from a real photograph</span>',
 "a5": "The Welding Mastery hub: level, XP, streak and energy, today's welding-English challenge and the weekly goal",
 "a6": "Visual recognition: a real photograph of a fire extinguisher, its credit, and four names to choose from",
 "wb": '<b>Welding Mastery:</b> eight games on 250 trade words, with real photographs of the tools, a daily challenge and skill badges.',
}
GE = {"es": "Inglés general", "fr": "Anglais général", "pt": "Inglês geral", "it": "Inglese generale", "de": "Allgemeines Englisch", "ru": "Общий английский", "ar": "الإنجليزية العامة", "ur": "عام انگریزی", "hi": "सामान्य अंग्रेज़ी", "bn": "সাধারণ ইংরেজি", "id": "Bahasa Inggris umum", "vi": "Tiếng Anh tổng quát", "zh": "通用英语", "ja": "一般英語", "ko": "일반 영어"}
WE = {"es": "Inglés de soldadura", "fr": "Anglais du soudage", "pt": "Inglês de soldadura", "it": "Inglese della saldatura", "de": "Schweiß-Englisch", "ru": "Английский для сварки", "ar": "إنجليزية اللحام", "ur": "ویلڈنگ کی انگریزی", "hi": "वेल्डिंग की अंग्रेज़ी", "bn": "ওয়েল্ডিংয়ের ইংরেজি", "id": "Bahasa Inggris pengelasan", "vi": "Tiếng Anh hàn", "zh": "焊接英语", "ja": "溶接の英語", "ko": "용접 영어"}
T = {
 "fr": ("<b>Reconnaissance visuelle</b><span>Nommez l'outil à partir d'une vraie photo</span>",
        f"L'espace Welding Mastery{NB}: niveau, XP, série et énergie, le défi d'anglais du soudage du jour et l'objectif de la semaine",
        f"Reconnaissance visuelle{NB}: la vraie photo d'un extincteur, son crédit, et quatre noms au choix",
        f"<b>Welding Mastery{NB}:</b> huit jeux sur 250 mots du métier, avec de vraies photos des outils, un défi du jour et des badges de compétence."),
 "es": ("<b>Reconocimiento visual</b><span>Nombra la herramienta a partir de una foto real</span>",
        "El espacio Welding Mastery: nivel, XP, racha y energía, el reto de inglés de soldadura del día y el objetivo semanal",
        "Reconocimiento visual: la foto real de un extintor, su crédito y cuatro nombres para elegir",
        "<b>Welding Mastery:</b> ocho juegos con 250 palabras del oficio, fotos reales de las herramientas, un reto diario e insignias de habilidad."),
 "pt": ("<b>Reconhecimento visual</b><span>Diga o nome da ferramenta a partir de uma foto real</span>",
        "O espaço Welding Mastery: nível, XP, sequência e energia, o desafio de inglês de soldagem do dia e a meta semanal",
        "Reconhecimento visual: a foto real de um extintor, o seu crédito e quatro nomes para escolher",
        "<b>Welding Mastery:</b> oito jogos com 250 palavras da profissão, fotos reais das ferramentas, um desafio diário e medalhas de habilidade."),
 "it": ("<b>Riconoscimento visivo</b><span>Dai il nome all'attrezzo da una foto vera</span>",
        "Lo spazio Welding Mastery: livello, XP, serie ed energia, la sfida d'inglese della saldatura del giorno e l'obiettivo settimanale",
        "Riconoscimento visivo: la foto vera di un estintore, il suo credito e quattro nomi tra cui scegliere",
        "<b>Welding Mastery:</b> otto giochi su 250 parole del mestiere, con foto vere degli attrezzi, una sfida del giorno e badge di abilità."),
 "de": ("<b>Bilderkennung</b><span>Das Werkzeug auf einem echten Foto benennen</span>",
        "Der Bereich Welding Mastery: Stufe, XP, Serie und Energie, die Schweiß-Englisch-Aufgabe des Tages und das Wochenziel",
        "Bilderkennung: das echte Foto eines Feuerlöschers, sein Bildnachweis und vier Namen zur Auswahl",
        "<b>Welding Mastery:</b> acht Spiele mit 250 Fachwörtern, echten Fotos der Werkzeuge, einer Tagesaufgabe und Fähigkeitsabzeichen."),
 "ru": ("<b>Визуальное узнавание</b><span>Назовите инструмент по настоящей фотографии</span>",
        "Пространство Welding Mastery: уровень, XP, серия и энергия, задание дня по английскому для сварки и цель недели",
        "Визуальное узнавание: настоящая фотография огнетушителя, указание автора и четыре названия на выбор",
        "<b>Welding Mastery:</b> восемь игр на 250 профессиональных слов, с настоящими фото инструментов, заданием дня и значками навыков."),
 "ar": ("<b>التعرّف البصري</b><span>سمِّ الأداة من صورة حقيقية</span>",
        "مساحة Welding Mastery: المستوى ونقاط XP والسلسلة والطاقة، تحدّي إنجليزية اللحام لليوم والهدف الأسبوعي",
        "التعرّف البصري: صورة حقيقية لطفاية حريق، مع ذكر صاحبها، وأربعة أسماء للاختيار",
        "<b>Welding Mastery:</b> ثماني ألعاب على 250 كلمة من المهنة، مع صور حقيقية للأدوات، وتحدٍّ يومي، وشارات مهارة."),
 "ur": ("<b>بصری پہچان</b><span>اصلی تصویر سے اوزار کا نام بتائیں</span>",
        "Welding Mastery کی جگہ: لیول، XP، سلسلہ اور توانائی، آج کا ویلڈنگ انگریزی چیلنج اور ہفتہ وار ہدف",
        "بصری پہچان: آگ بجھانے والے آلے کی اصلی تصویر، اس کا کریڈٹ، اور چننے کے لیے چار نام",
        "<b>Welding Mastery:</b> پیشے کے 250 الفاظ پر آٹھ گیمز، اوزاروں کی اصلی تصاویر، روزانہ چیلنج اور مہارت کے بیج۔"),
 "hi": ("<b>दृश्य पहचान</b><span>असली तस्वीर से औज़ार का नाम बताएँ</span>",
        "Welding Mastery हब: लेवल, XP, स्ट्रीक और एनर्जी, आज की वेल्डिंग-अंग्रेज़ी चुनौती और हफ़्ते का लक्ष्य",
        "दृश्य पहचान: अग्निशामक यंत्र की असली तस्वीर, उसका श्रेय, और चुनने के लिए चार नाम",
        "<b>Welding Mastery:</b> पेशे के 250 शब्दों पर आठ गेम, औज़ारों की असली तस्वीरें, रोज़ की चुनौती और कौशल बैज।"),
 "bn": ("<b>দৃশ্য শনাক্তকরণ</b><span>আসল ছবি দেখে সরঞ্জামের নাম বলুন</span>",
        "Welding Mastery হাব: লেভেল, XP, স্ট্রিক ও এনার্জি, আজকের ওয়েল্ডিং-ইংরেজি চ্যালেঞ্জ ও সাপ্তাহিক লক্ষ্য",
        "দৃশ্য শনাক্তকরণ: একটি অগ্নিনির্বাপকের আসল ছবি, তার কৃতিত্ব, এবং বেছে নেওয়ার জন্য চারটি নাম",
        "<b>Welding Mastery:</b> পেশার ২৫০টি শব্দ নিয়ে আটটি গেম, সরঞ্জামের আসল ছবি, দৈনিক চ্যালেঞ্জ ও দক্ষতার ব্যাজ।"),
 "id": ("<b>Pengenalan visual</b><span>Sebutkan alatnya dari foto asli</span>",
        "Ruang Welding Mastery: level, XP, rentetan dan energi, tantangan bahasa Inggris pengelasan hari ini dan target mingguan",
        "Pengenalan visual: foto asli alat pemadam api, kreditnya, dan empat nama untuk dipilih",
        "<b>Welding Mastery:</b> delapan permainan dengan 250 kata profesi, foto asli peralatan, tantangan harian, dan lencana keterampilan."),
 "vi": ("<b>Nhận diện hình ảnh</b><span>Gọi tên dụng cụ từ ảnh thật</span>",
        "Khu Welding Mastery: cấp độ, XP, chuỗi ngày và năng lượng, thử thách tiếng Anh ngành hàn hôm nay và mục tiêu tuần",
        "Nhận diện hình ảnh: ảnh thật của một bình chữa cháy, ghi công tác giả, và bốn tên để chọn",
        "<b>Welding Mastery:</b> tám trò chơi với 250 từ chuyên ngành, ảnh thật của dụng cụ, thử thách hằng ngày và huy hiệu kỹ năng."),
 "zh": ("<b>图像识别</b><span>根据真实照片说出工具名称</span>",
        "Welding Mastery 中心：等级、XP、连续天数和能量、今日焊接英语挑战和每周目标",
        "图像识别：一张灭火器的真实照片、照片署名，以及四个可选名称",
        "<b>Welding Mastery：</b>用 250 个行业词汇玩八个游戏，配有工具的真实照片、每日挑战和技能徽章。"),
 "ja": ("<b>画像認識</b><span>実物の写真から工具の名前を答える</span>",
        "Welding Masteryのハブ：レベル、XP、連続記録とエネルギー、今日の溶接英語チャレンジと週間目標",
        "画像認識：消火器の実物写真とそのクレジット、4つの選択肢",
        "<b>Welding Mastery：</b>専門用語250語の8つのゲーム。工具の実物写真、デイリーチャレンジ、スキルバッジつき。"),
 "ko": ("<b>시각 인식</b><span>실제 사진을 보고 공구 이름 맞히기</span>",
        "Welding Mastery 허브: 레벨, XP, 연속 기록과 에너지, 오늘의 용접 영어 도전과 주간 목표",
        "시각 인식: 소화기의 실제 사진과 사진 출처, 고를 수 있는 네 가지 이름",
        "<b>Welding Mastery:</b> 직무 단어 250개로 하는 여덟 가지 게임, 공구의 실제 사진, 오늘의 도전, 기술 배지."),
}
def tr(c):
    c6, a5, a6, wb = T[c]
    return {"s_em": f'<h3 class="shots-h" data-reveal>English Mastery · {GE[c]}</h3>', "s_wm": f'<h3 class="shots-h" data-reveal>Welding Mastery · {WE[c]}</h3>', "c6": c6, "a5": a5, "a6": a6, "wb": wb}

def fig(src, alt, cap, delay):
    return f'<figure class="shot" data-reveal data-reveal-delay="{delay}"><div class="shot-phone"><img src="img/games/{src}.webp" width="660" height="1434" alt="{alt}" loading="lazy"></div><figcaption>{cap}</figcaption></figure>'

html = open(PAGE, encoding="utf8").read()
if E["s_wm"] in html: sys.exit("already applied")
# the four existing figures, kept as they are (their strings are already translated)
row = re.search(r'    ' + re.escape(OLD_H) + r'\n    <div class="shots shots-home" data-shots>([\s\S]*?)</div>\n    <div class="games-copy"', html)
assert row, "Play to learn shots not found"
figs = re.findall(r'<figure class="shot"[\s\S]*?</figure>', row.group(1))
assert len(figs) == 4, len(figs)
em_home, em_games, em_speak, wm_games = figs
cap = lambda f: re.search(r"<figcaption>([\s\S]*?)</figcaption>", f).group(1)
c4 = cap(wm_games)                                     # "Welding Mastery · 250 trade words, real photographs"
wm_games = wm_games.replace(f"<figcaption>{c4}</figcaption>", f"<figcaption>{cap(em_games)}</figcaption>").replace('data-reveal-delay="240"', 'data-reveal-delay="80"')   # "Eight games"
rows = (f'    {E["s_em"]}\n    <div class="shots shots-home" data-shots>{em_home}{em_games}{em_speak}</div>\n'
        f'    {E["s_wm"]}\n    <div class="shots shots-home" data-shots>{fig("wm-home", E["a5"], c4, 0)}{wm_games}{fig("wm-visual", E["a6"], E["c6"], 160)}</div>\n    <div class="games-copy"')
html = html[:row.start()] + rows + html[row.end():]
# Welding English: the line after its last item
i = html.index('<section class="section" id="welding">'); j = html.index("</ul>", i)
html = html[:j] + f'  <li>{CHECK}<span>{E["wb"]}</span></li>\n      ' + html[j:]
open(PAGE, "w", encoding="utf8").write(html)

def lit(s): return "`" + s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${") + "`"
for c in LANGS:
    p = DICT.format(c); src = open(p, encoding="utf8").read()
    m = re.search(r"\n\s*\[`" + re.escape(OLD_H) + r"`,[\s\S]*?\],[ \t]*(?=\n)", src)
    assert m, c + ": old heading entry not found"
    src = src[:m.start()] + src[m.end():]
    rows = "\n  // Welding Mastery in its own row + the Welding English line (10 Oct 2026)\n" + "".join(f"  [{lit(E[k])},\n   {lit(tr(c)[k])}],\n" for k in E)
    k = src.rindex("];"); src = src[:k].rstrip() + "\n" + rows + src[k:]
    open(p, "w", encoding="utf8").write(src)
print("page + 15 dictionaries updated")
