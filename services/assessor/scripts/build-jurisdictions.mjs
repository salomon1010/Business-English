/* Regenerates the service's jurisdiction data from the app's jurisdictions.js,
   so a candidate is assessed against the same standards the learner was taught.
   Run from services/assessor:  npm run build:jurisdictions */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, "../../../jurisdictions.js"), "utf8");

// Execute the browser module against a stub global to read its frozen export.
const sandbox = {};
new Function("window", src)(sandbox);
const J = sandbox.Jurisdictions;
if (!J) throw new Error("jurisdictions.js did not export Jurisdictions");

const out = `/* AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Source of truth: jurisdictions.js at the repository root (the file the app uses).
 * Regenerate:      npm run build:jurisdictions
 */
export type JurisdictionId = ${J.all().map(j => `"${j.id}"`).join(" | ")};

export interface Jurisdiction {
  id: JurisdictionId;
  label: string;
  framework: string;
  codes: Record<number, string[]>;
  emphasis: Record<number, string>;
  verify: string;
}

const J: Jurisdiction[] = ${JSON.stringify(J.all(), null, 2)} as Jurisdiction[];

export const JURISDICTIONS = new Map<JurisdictionId, Jurisdiction>(J.map(x => [x.id, x]));
export const JURISDICTION_IDS = J.map(x => x.id) as [JurisdictionId, ...JurisdictionId[]];
export const DEFAULT_JURISDICTION: JurisdictionId = "${J.DEFAULT_ID}";

/** Career Center destination -> jurisdiction. */
export const DESTINATION_MAP: Record<string, JurisdictionId> = ${JSON.stringify(J.destinationMap(), null, 2)} as Record<string, JurisdictionId>;

export function codesFor(
  jurisdiction: JurisdictionId,
  moduleId: number,
  fallback: { code: string; title: string; note: string }[]
): string[] {
  const own = JURISDICTIONS.get(jurisdiction)?.codes[moduleId];
  if (own?.length) return own;
  return fallback.map(c => \`\${c.code} — \${c.title}\`);
}

export function emphasisFor(jurisdiction: JurisdictionId, moduleId: number): string {
  return JURISDICTIONS.get(jurisdiction)?.emphasis[moduleId] ?? "";
}
`;
writeFileSync(resolve(here, "../src/jurisdictions.ts"), out);
console.log(`jurisdictions.ts regenerated — ${J.all().length} jurisdictions, ${Object.keys(J.destinationMap()).length} destinations mapped`);
