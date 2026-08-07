/* Every track() call in index.html must name an event the Worker allows, and use
   only props it allows. Neither failure is visible at runtime: sendBeacon reports
   nothing, and the Worker drops an unknown name with 204 and an unknown prop by
   simply not having a column for it. So the check has to be here.

   Run: node scripts/check-events.mjs
*/
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const worker = readFileSync("backend/events/events-worker.js", "utf8");

const allowedEvents = new Set(
  [...(worker.match(/const EVENTS = new Set\(\[([\s\S]*?)\]\)/) || ["", ""])[1]
    .matchAll(/"([a-z_]+)"/g)].map(m => m[1]));
const allowedProps = new Set(
  [...(worker.match(/const PROP_KEYS = new Set\(\[([\s\S]*?)\]\)/) || ["", ""])[1]
    .matchAll(/"([a-z_]+)"/g)].map(m => m[1]));

/* Walk from each track( and balance braces, so a prop object containing a nested
   object or a ternary is read whole rather than cut at the first brace. */
const calls = [];
for (const m of html.matchAll(/\btrack\(\s*"([a-z_]+)"\s*(,)?/g)) {
  const name = m[1];
  const props = [];
  if (m[2]) {
    let i = html.indexOf("{", m.index + m[0].length);
    const argEnd = html.indexOf(")", m.index + m[0].length);
    if (i !== -1 && (argEnd === -1 || i < argEnd + 400)) {
      let depth = 0, j = i;
      for (; j < html.length; j++) {
        if (html[j] === "{") depth++;
        else if (html[j] === "}") { depth--; if (!depth) break; }
      }
      const body = html.slice(i + 1, j);
      let d = 0;
      let key = "";
      for (let k = 0; k < body.length; k++) {
        const c = body[k];
        if (c === "{" || c === "(" || c === "[") d++;
        else if (c === "}" || c === ")" || c === "]") d--;
        else if (c === ":" && d === 0) { const mm = key.match(/([A-Za-z_$][\w$]*)\s*$/); if (mm) props.push(mm[1]); key = ""; }
        else if (c === "," && d === 0) key = "";
        else key += c;
      }
    }
  }
  calls.push({ name, props });
}

const badName = calls.filter(c => !allowedEvents.has(c.name));
const badProp = calls.flatMap(c => c.props.filter(p => !allowedProps.has(p)).map(p => `${c.name}.${p}`));

console.log(`track() calls: ${calls.length}`);
console.log(`allowed events: ${allowedEvents.size} | allowed props: ${allowedProps.size}`);
if (badName.length) console.log("EVENTS NOT ALLOWED (dropped with 204):", badName.map(c => c.name));
if (badProp.length) console.log("PROPS NOT ALLOWED (silently discarded):", [...new Set(badProp)]);
if (badName.length || badProp.length) process.exit(1);
console.log("ok — every event and prop is on the Worker's allow-list");
