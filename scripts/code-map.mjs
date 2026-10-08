#!/usr/bin/env node
/* Generates docs/architecture/CODE_MAP.md — a table of contents for index.html.

   index.html is the whole web app (HTML + CSS + JS, no build step), so a new
   developer cannot "open the folder" to see its parts. This script reads the
   banner comments the file already carries — every section starts with a block
   comment framed by runs of "=" (a section) or "-" (a sub-section), such as
   "===== ROUTER =====" or "----- view state" — and writes an outline with line
   numbers, the top-level functions each section defines, the views
   (`#v-<name>`) and their render functions, the engine files the page loads,
   and the globals each engine exports.

   Run it after a change that adds a section or a view and commit the result:

       node scripts/code-map.mjs            # writes docs/architecture/CODE_MAP.md
       node scripts/code-map.mjs --check    # exit 1 if the committed map is stale

   Line numbers are a snapshot; the section names and function names are the
   stable handles — search for them in the editor. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(root, "docs", "architecture", "CODE_MAP.md");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const lines = html.split("\n");
const n = lines.length;

/* ---------------------------------------------------------------- blocks */
// every <script> … </script> and the one <style> … </style>, any indentation
const blocks = [];
let open = null;
lines.forEach((l, i) => {
  const t = l.trim();
  if (!open) {
    const m = /^<script(\s[^>]*)?>/.exec(t);
    if (m) { open = { kind: "script", attrs: m[1] || "", start: i + 1 }; if (/<\/script>/.test(t)) { open.end = i + 1; blocks.push(open); open = null; } return; }
    if (/^<style>/.test(t)) { open = { kind: "style", attrs: "", start: i + 1 }; return; }
  } else {
    if (open.kind === "script" && /<\/script>/.test(t)) { open.end = i + 1; blocks.push(open); open = null; return; }
    if (open.kind === "style" && /<\/style>/.test(t)) { open.end = i + 1; blocks.push(open); open = null; }
  }
});
const style = blocks.find(b => b.kind === "style");
const inStyle = (line) => style && line >= style.start && line <= style.end;
const bodyStart = lines.findIndex(l => /^<body/.test(l)) + 1;
const bodyEnd = lines.findIndex(l => /^<\/body>/.test(l)) + 1 || n;
const scriptTags = blocks.filter(b => /\bsrc="/.test(b.attrs)).map(b => {
  const m = /src="([^"?]+)(?:\?v=(\d+))?"/.exec(b.attrs); return { file: m[1], v: m[2] || "", line: b.start };
});
const inlineScripts = blocks.filter(b => b.kind === "script" && !/\bsrc="/.test(b.attrs) && !/ld\+json/.test(b.attrs));

/* ---------------------------------------------------------------- banners */
const BANNER = /^\s*\/\*\s*([=\-]{3,})\s*(.+)$/;
const clean = (raw) => {
  let t = raw.replace(/[=\-]{3,}.*$/, "").replace(/\*\/\s*$/, "").replace(/[\s=\-]+$/, "").trim();
  // a banner that runs on into prose: keep the first clause
  const cut = t.search(/[.:;(—]\s|\s—\s/);
  if (cut > 24) t = t.slice(0, cut).trim();
  if (t.length > 96) t = t.slice(0, 93).trim() + "…";
  return t;
};
const sections = [];
lines.forEach((l, i) => {
  const m = BANNER.exec(l);
  if (!m) return;
  const title = clean(m[2]);
  if (!title || title.length < 3) return;
  sections.push({ line: i + 1, title, level: m[1][0] === "=" ? 1 : 2, css: inStyle(i + 1) });
});

/* ------------------------------------------------------ top-level functions */
const FN = /^(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/;
const fns = [];
lines.forEach((l, i) => { const m = FN.exec(l); if (m) fns.push({ name: m[1], line: i + 1 }); });
sections.forEach((s, i) => {
  const end = sections[i + 1] ? sections[i + 1].line : n + 1;
  s.end = end - 1;
  s.fns = fns.filter(f => f.line >= s.line && f.line < end).map(f => f.name);
});
const firstBannerIn = (b) => { const s = sections.find(s => s.line >= b.start && s.line <= b.end); return s ? s.title : ""; };

/* -------------------------------------------------------------------- views */
const views = [...new Set([...html.matchAll(/id="v-([a-z0-9]+)"/g)].map(m => m[1]))].sort();
const renderOf = (v) => {
  const c = fns.filter(f => f.name.toLowerCase() === "r" + v);
  return c.length ? c.map(x => `\`${x.name}\` (L${x.line})`).join(", ") : "—";
};

/* ------------------------------------------------------------- engine files */
const engines = scriptTags.map(t => {
  const p = resolve(root, t.file);
  if (!existsSync(p)) return { ...t, lines: 0, globals: [], head: "(missing)" };
  const src = readFileSync(p, "utf8");
  const globals = [...new Set([...src.matchAll(/\b(?:global|window|globalThis)\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=[^=]/g)].map(m => m[1]))]
    .filter(g => !/^_/.test(g));
  // the first line of the header comment that carries words, minus the brand prefix
  const head = (src.split("\n").slice(0, 12).map(l => l.replace(/^\s*\/?\*+\/?\s*/, "").replace(/\s*\*\/\s*$/, "").trim())
    .find(l => /[a-z]/i.test(l) && !/^[=\-\s]+$/.test(l)) || "").replace(/^BE Mastery(?: V2)?\s*[—-]\s*/, "").slice(0, 120);
  return { ...t, lines: src.split("\n").length, globals, head };
});

/* ------------------------------------------------------------------- render */
const md = [];
const esc = (s) => s.replace(/\|/g, "\\|");
md.push("# Code map — `index.html` and the engines it loads");
md.push("");
md.push("> Generated by `node scripts/code-map.mjs` — do not edit by hand. Line numbers are a");
md.push("> snapshot; the **section titles and function names are the stable handles**: search");
md.push("> for them in your editor. Regenerate after adding a section, a view or a script tag;");
md.push("> `node scripts/code-map.mjs --check` tells you when the committed copy is stale.");
md.push("");
md.push("## How the one file is laid out");
md.push("");
md.push("| Part | Lines | Size | What is there |");
md.push("|---|---|---|---|");
md.push(`| \`<head>\` | 1–${bodyStart - 1} | ${(bodyStart - 1).toLocaleString()} | Meta and social preview, JSON-LD, manifest, fonts, the ${scriptTags.length} engine \`<script src>\` tags (L${scriptTags[0]?.line}–${scriptTags.at(-1)?.line}), then the inline head scripts and the stylesheet (both counted in this range and listed below) |`);
inlineScripts.filter(b => b.start < bodyStart).forEach(b => {
  const label = firstBannerIn(b) || (/FB_CONFIG/.test(lines[b.start]) ? "Firebase project config (public by design)" : "small inline script");
  md.push(`| head \`<script>\` | ${b.start}–${b.end} | ${(b.end - b.start + 1).toLocaleString()} | ${esc(label)} |`);
});
if (style) md.push(`| \`<style>\` | ${style.start}–${style.end} | ${(style.end - style.start + 1).toLocaleString()} | All CSS: design tokens at the top, then per-screen rules under banner comments (marked **CSS** in the outline below) |`);
const bodyScripts = inlineScripts.filter(b => b.start >= bodyStart);
const markupEnd = bodyScripts.length ? bodyScripts[0].start - 1 : bodyEnd;
md.push(`| \`<body>\` markup | ${bodyStart}–${markupEnd} | ${(markupEnd - bodyStart + 1).toLocaleString()} | The app shell: header, the ${views.length} \`#v-<view>\` containers, bottom bar, dialogs, templates |`);
bodyScripts.forEach((b, i) => {
  const label = i === 0 ? "**The main script** — state, i18n, router, every screen's render function, every feature system" : (firstBannerIn(b) || "inline script");
  md.push(`| body \`<script>\` | ${b.start}–${b.end} | ${(b.end - b.start + 1).toLocaleString()} | ${esc(label)} |`);
});
md.push("");
md.push(`Totals: **${n.toLocaleString()} lines**, **${fns.length.toLocaleString()} top-level functions**, **${sections.filter(s => !s.css).length} JavaScript sections** and **${sections.filter(s => s.css).length} CSS sections** (banner comments), **${views.length} views**, **${scriptTags.length} engine files**.`);
md.push("");

md.push("## Views and their render functions");
md.push("");
md.push("`go(view, a1, a2)` is the router. Each view is a `<div id=\"v-<name>\">` in the body and is drawn by `r<Name>()`; the render map inside `go()` is the authority when a name differs.");
md.push("");
md.push("| View (`go(\"…\")`) | Container | Render function |");
md.push("|---|---|---|");
views.forEach(v => md.push(`| \`${v}\` | \`#v-${v}\` | ${renderOf(v)} |`));
md.push("");

md.push("## Engine files the page loads (in load order)");
md.push("");
md.push("Plain scripts, not modules. Each is an IIFE that publishes one object on `window` (the **global** column); the page calls that object. The `?v=` number is a cache-buster: bump it when the file changes, in index.html **and** in `sw.js` `SHELL`.");
md.push("");
md.push("| File | Lines | Global(s) | What it owns (from its header) |");
md.push("|---|---|---|---|");
engines.forEach(e => md.push(`| \`${e.file}\` (v${e.v}) | ${e.lines.toLocaleString()} | ${e.globals.slice(0, 5).map(g => `\`${g}\``).join(", ") || "—"} | ${esc(e.head)} |`));
md.push("");

md.push("## Sections, in file order");
md.push("");
md.push("Major banners (`=====`) are `###`, minor ones (`-----`) are `####`. **CSS** marks a section inside `<style>`. The function list is every top-level `function` declared before the next banner (first 14 shown, then the count).");
md.push("");
sections.forEach(s => {
  const shown = s.fns.slice(0, 14).map(f => `\`${f}\``).join(" ");
  const more = s.fns.length > 14 ? ` … (+${s.fns.length - 14}, ${s.fns.length} total)` : (s.fns.length ? ` (${s.fns.length})` : "");
  md.push(`${s.level === 1 ? "###" : "####"} L${s.line}–${s.end} · ${s.css ? "CSS · " : ""}${esc(s.title)}`);
  md.push("");
  if (s.fns.length) md.push(shown + more); else md.push(s.css ? "_(styles)_" : "_(data, markup or constants — no top-level functions)_");
  md.push("");
});

const out = md.join("\n") + "\n";
if (process.argv.includes("--check")) {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (cur !== out) { console.error("CODE_MAP.md is stale — run: node scripts/code-map.mjs"); process.exit(1); }
  console.log("CODE_MAP.md is current");
} else {
  writeFileSync(OUT, out);
  console.log(`wrote ${OUT}: ${sections.length} sections, ${fns.length} functions, ${views.length} views, ${engines.length} engines`);
}
