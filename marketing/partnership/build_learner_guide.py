#!/usr/bin/env python3
"""Learner guide — the two pages every participant gets in week 0.

Bilingual by column, English left and French right, because the cohort is
francophone and the app's interface is French but the practice is English. One
sheet, printable, no login instructions longer than a line.
"""
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.shared import Cm, Pt, RGBColor

from docxkit import (A, ACCENT, BODY, CARD, CARD2, CONTENT_W, DARK, GAP, GOLD,
                     HERE, INK, MINT, MUTED, ROSE, WHITE, bleed_image, callout,
                     card, cell_border, cell_margins, grid, gutter,
                     new_document, normalise, section_head, shade, spacing, txt)

GREEN_INK = RGBColor(0x1D, 0x6B, 0x46)
COL = Cm(CONTENT_W.cm * 0.5 - GAP.cm / 2)


def bilingual(doc, en, fr, fill=CARD2, border="DDD9F5"):
    """One row, English left, French right."""
    t = grid(doc, 1, 3, [COL, GAP, COL])
    for col, (head, body) in ((0, en), (2, fr)):
        c = t.cell(0, col)
        shade(c, fill); cell_margins(c, 105, 140, 105, 140); cell_border(c, border)
        p = c.paragraphs[0]; p.text = ""
        r = p.add_run(head)
        r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(11)
        r.font.color.rgb = INK
        p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        for i, line in enumerate(body):
            q = c.add_paragraph()
            r = q.add_run(line)
            r.font.name = "Arial"; r.font.size = Pt(9); r.font.color.rgb = BODY
            q.paragraph_format.space_before = Pt(0)
            q.paragraph_format.space_after = Pt(3 if i < len(body) - 1 else 0)
            q.paragraph_format.line_spacing = 1.26
    gutter(doc, 3)
    return t


doc = new_document()
bleed_image(doc, A / "header-learner.jpg")

t = grid(doc, 1, 3, [COL, GAP, COL])
for col, text in ((0, "You have been chosen for a four-week pilot. It is free, it is on your "
                      "own phone, and nothing you record is shared with your school."),
                  (2, "Vous participez à un pilote de quatre semaines. C'est gratuit, sur votre "
                      "propre téléphone, et rien de ce que vous enregistrez n'est partagé avec "
                      "votre école.")):
    c = t.cell(0, col)
    p = c.paragraphs[0]; p.text = ""
    r = p.add_run(text)
    r.font.name = "Arial"; r.font.size = Pt(10.5); r.font.color.rgb = INK
    p.paragraph_format.space_before = Pt(9); p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.38
gutter(doc, 6)

section_head(doc, "01", "Install it  ·  Installez-la")
bilingual(doc,
    ("Two minutes, no app store", [
        "1.  Open app.lomonec.com in your phone browser.",
        "2.  Choose Add to Home Screen when your browser offers it.",
        "3.  Open it from your home screen like any other app.",
        "4.  Choose your language — French is available for every menu.",
        "No account to create, nothing to pay. Signing in is optional — it only syncs progress "
        "between devices."]),
    ("Deux minutes, sans magasin d'applications", [
        "1.  Ouvrez app.lomonec.com dans le navigateur de votre téléphone.",
        "2.  Choisissez Ajouter à l'écran d'accueil quand le navigateur le propose.",
        "3.  Ouvrez-la depuis l'écran d'accueil comme une application normale.",
        "4.  Choisissez votre langue — le français est disponible pour tous les menus.",
        "Aucun compte à créer, rien à payer. La connexion est facultative : elle sert seulement à "
        "synchroniser votre progression."]))

section_head(doc, "02", "Your twenty-five minutes  ·  Vos vingt-cinq minutes")
bilingual(doc,
    ("Every day, in your own time", [
        "5 min — Shadowing: loop a short clip of a real speaker and copy the rhythm out loud.",
        "10 min — The day's session: pronunciation, a speaking drill or a meeting simulation.",
        "7 min — One workplace conversation: speak with the supervisor, the inspector or HR.",
        "3 min — Read the report: what you covered, what you missed, and the better sentence.",
        "Once a week, run one interview coach — it is closest to the real interview."]),
    ("Chaque jour, à votre rythme", [
        "5 min — Shadowing : répétez à voix haute un court extrait d'un locuteur natif.",
        "10 min — La séance du jour : prononciation, exercice oral ou simulation de réunion.",
        "7 min — Une conversation de chantier : parlez au superviseur, à l'inspecteur ou aux RH.",
        "3 min — Lisez le rapport : ce que vous avez couvert, ce qui manquait, la meilleure phrase.",
        "Une fois par semaine, faites un entretien avec un coach — c'est le plus proche du réel."]))

# ---------------- page 2 ----------------
doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
gutter(doc, 10)
section_head(doc, "03", "Week 1 matters most  ·  La semaine 1 compte le plus")
bilingual(doc,
    ("Record one answer before you practise", [
        "In your first week, before anything else, run one workplace conversation and record your "
        "answer. It will not be good — that is the point. It is the before.",
        "In week four you answer the same question again. That difference is the only proof "
        "any of us will have that this worked. Skip it and your progress cannot be measured."]),
    ("Enregistrez une réponse avant de vous entraîner", [
        "Dès la première semaine, avant tout, faites une conversation de chantier et enregistrez "
        "votre réponse. Elle ne sera pas bonne — c'est le but. C'est l'avant.",
        "En semaine quatre, vous répondrez à la même question. Cette différence est la seule "
        "preuve que cela a fonctionné. Sans elle, rien ne peut être mesuré."]),
    fill=CARD, border="D6D0F4")

section_head(doc, "04", "Your privacy  ·  Votre confidentialité")
bilingual(doc,
    ("What your school can and cannot see", [
        "Your recordings stay on your own phone. Your school never receives them, and neither does "
        "anyone else. When you are online, only the short clip being scored is sent for "
        "transcription — that is how the feedback works.",
        "Your school receives counts only: how many practised and how often. Never your voice, "
        "your words, or your name against a score."]),
    ("Ce que votre école voit et ne voit pas", [
        "Vos enregistrements restent sur votre téléphone. Votre école ne les reçoit jamais, ni "
        "personne d'autre. En ligne, seul le court extrait évalué est envoyé pour "
        "transcription — c'est ainsi que fonctionne le retour.",
        "Votre école ne reçoit que des totaux : combien ont pratiqué et à quelle fréquence. "
        "Jamais votre voix, vos mots, ni votre nom associé à une note."]),
    fill=MINT, border="BFE0CE")

section_head(doc, "05", "Honest limits  ·  Limites à connaître")
bilingual(doc,
    ("What this is not", [
        "This is spoken English practice. It is not a language diploma, not IELTS, and written "
        "English is not tested. The certificate is for completing the app's 84-session "
        "programme — not a proficiency qualification, and not a trade certificate.",
        "It replaces nothing your academy teaches. It is practice for the part nobody gets to "
        "rehearse: saying it out loud."]),
    ("Ce que ce n'est pas", [
        "Entraînement à l'anglais oral. Ce n'est pas un diplôme de langue, ni l'IELTS, et "
        "l'écrit n'est pas évalué. Le certificat atteste l'achèvement des 84 séances — ce "
        "n'est ni une qualification linguistique ni un certificat de métier.",
        "Cela ne remplace rien de ce que votre académie enseigne. C'est l'entraînement pour la "
        "partie que personne ne répète : le dire à voix haute."]),
    fill=ROSE, border="F2C9C9")

gutter(doc, 5)
callout(doc, CARD2, "DDD9F5", "Stuck? · Bloqué ?", ACCENT,
        [("contact@lomonec.com", True),
         ("  — questions about the app come to us, not to your instructor.   ·   "
          "Les questions sur l'application, c'est pour nous, pas pour votre formateur.",
          False)])
gutter(doc, 6)
bleed_image(doc, A / "footer.jpg")

normalise(doc)
cp = doc.core_properties
cp.title = "BE Mastery — learner guide / guide apprenant"
cp.subject = "Four-week pilot — what to do, and what we can and cannot see"
cp.author = "Lomonec LLC"
cp.company = "Lomonec LLC"
cp.category = "Learner guide"

out = HERE / "BE-Mastery-Learner-Guide-EN-FR.docx"
doc.save(out)
print("%s  (%.0f KB)" % (out.name, out.stat().st_size / 1024))
