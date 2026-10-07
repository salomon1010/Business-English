#!/usr/bin/env node
/* Lists the text on a built page that still looks English, so a translator
   can see what the dictionary missed:  node scripts/site-i18n/leftover.mjs es
   The practice material inside the mock app screens is English on purpose
   (sample sentences, the workshop dialogue, IPA) and is skipped here. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../site");
const code = process.argv[2];
const KEEP = /aligned|make sure we are|deadline|root pass|porosity|responsible|managing the team|the tests|get it over the line|So here is where|The one risk|Report a weld defect|Entering the Workshop|^to$|^are$|^the$|^of$|^for$|^we are finishing$/;
const ENG = /\b(the|and|your|you|with|for|is|are|it|this|that|from|every|what|how|when|our)\b/i;
for (const f of [`${code}/index.html`, `bemastery/${code}/index.html`]) {
  let s = fs.readFileSync(path.join(SITE, f), "utf8");
  s = s.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, "").replace(/<div class="lang-menu">[\s\S]*?<\/div>/, "");
  const attrs = [...s.matchAll(/(?:alt|aria-label|title|content)="([^"]*)"/g)].map((m) => m[1]);
  const segs = s.replace(/<[^>]+>/g, "\n").split("\n").map((t) => t.trim()).concat(attrs);
  const hits = [...new Set(segs.filter((t) => t && ENG.test(t) && !KEEP.test(t)))];
  console.log(`== ${f}: ${hits.length} English-looking`);
  hits.forEach((t) => console.log("   " + t.slice(0, 140)));
}
