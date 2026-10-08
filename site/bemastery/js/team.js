/* ───────────────────────────────────────────────────────────────────────────
   The people behind BE Mastery. team.html and every blog byline read this
   list — add a person HERE and they appear everywhere.

   HOW TO ADD SOMEONE
   1. Put a square photo in img/team/ (at least 600×600, .webp or .jpg).
   2. Copy an entry below and fill it in.
   3. group:"core"        → "The makers" (the people who build it)
      group:"contributor" → "Contributors" (translation review, lesson
                             content, testing, design … anything external).
                             That section stays hidden until it has someone.

   RULES
   - An entry with name:"" is NOT published. On localhost it shows as a dashed
     "fill me in" card so you can see where it will go; on the live site it
     is skipped. The page never shows a placeholder to a visitor.
   - photo:"" is fine: the card shows the person's initials instead.
   - links: leave a value "" and that icon is not shown.
   - Publish a name, photo or link only with that person's permission.
   ─────────────────────────────────────────────────────────────────────────── */
window.BEM_TEAM = [
  {
    id:    "founder",            // used by blog posts: author:"founder"
    group: "core",
    name:  "",                   // ► your name
    role:  "Founder",            // ► e.g. "Founder · Product and curriculum"
    photo: "",                   // ► e.g. "img/team/founder.webp"
    bio:   "",                   // ► one or two short sentences, optional
    links: { linkedin:"", website:"", youtube:"", email:"" }
  }

  /* An external contributor, for later:
  ,{
    id:    "jane-doe",
    group: "contributor",
    name:  "Jane Doe",
    role:  "French translation review",
    photo: "img/team/jane-doe.webp",
    bio:   "",
    links: { linkedin:"", website:"" }
  }
  */
];
