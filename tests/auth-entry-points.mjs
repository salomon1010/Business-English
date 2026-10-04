/* Every way into the account sheet (owner, 4 Oct 2026: "make sure every link
   that gives them the option to create an account or log in" lands on the one
   sheet — Apple, Google, email — and in the mode its label promises).
   A source scan, no browser: fbOpenModal(mode) is the ONE sheet, so the
   invariants are (1) every call passes an explicit mode, and (2) a button that
   says "Log in" / "Sign in" opens Log in, one that says "Create" / "Register"
   opens Create account. The sheet's own behaviour is covered by
   auth-social.mjs and auth-sheet.mjs.
   Run: cd tests && node auth-entry-points.mjs */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const lines = html.split("\n");
const res = []; const ok = (name, cond, detail = "") => { res.push(!!cond); console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  — " + String(detail).slice(0, 700)}`); };

/* label key → the mode a learner reading it expects */
const LOGIN = ["auth.login_btn", "ob.login", "acc.prem_signin"];
const CREATE = ["auth.create_account_btn", "auth.register_link", "pp.signin_btn", "ai.acct_link_"];

const calls = [];
lines.forEach((ln, i) => {
  if (/window\.fbOpenModal\s*=/.test(ln)) return;
  const re = /fbOpenModal\(([^)]*)\)/g; let m;
  while ((m = re.exec(ln))) calls.push({ line: i + 1, arg: m[1].trim().replace(/^['"]|['"]$/g, ""), src: ln.trim() });
});

ok("1 · the sheet is reached from at least ten places (Profile, App Setup, nudge, onboarding, AI notices, Premium ×2, Practice Partner ×3, the sheet's own switch)", calls.length >= 10, calls.length);
ok("2 · every call passes an explicit mode — 'in' or 'up' — so no button depends on the default", calls.every(c => c.arg === "in" || c.arg === "up"), JSON.stringify(calls.filter(c => !(c.arg === "in" || c.arg === "up"))));

const expect = c => {
  if (LOGIN.some(k => c.src.includes(`"${k}"`))) return "in";
  if (CREATE.some(k => c.src.includes(`"${k}`))) return "up";
  return null;
};
/* the sheet's own Register / Log in switch has both calls on one line and is covered by check 8 */
const labelled = calls.filter(c => !c.src.includes("auth.have_account")).map(c => ({ ...c, want: expect(c) })).filter(c => c.want);
const wrong = labelled.filter(c => c.want !== c.arg);
ok("3 · every labelled button opens the mode its words promise: Log in / Sign in → Log in; Create / Register → Create account", labelled.length >= 8 && wrong.length === 0, JSON.stringify(wrong.map(c => ({ line: c.line, arg: c.arg, want: c.want, src: c.src.slice(0, 160) }))));

const premCard = calls.filter(c => c.src.includes("acc.prem_signin"));
ok("4 · both 'Sign in to get Premium' buttons (plan card + Premium sheet foot) open Log in", premCard.length === 2 && premCard.every(c => c.arg === "in"), JSON.stringify(premCard.map(c => [c.line, c.arg])));

const pp = calls.filter(c => c.src.includes("pp.signin_btn"));
ok("5 · both Practice Partner 'Create my free account' buttons open Create account", pp.length === 2 && pp.every(c => c.arg === "up"), JSON.stringify(pp.map(c => [c.line, c.arg])));

const nudge = lines.findIndex(l => l.includes('id="syncNudge"') || l.includes("n.id=\"syncNudge\""));
const nudgeBlock = lines.slice(nudge, nudge + 6).join("\n");
ok("6 · the 'Save your progress' nudge button says Create account and opens Create account (it used to say Sign in)", nudge > 0 && /auth\.create_account_btn/.test(nudgeBlock) && /fbOpenModal\('up'\)/.test(nudgeBlock) && !/t\("auth\.nudge_signin"\)/.test(nudgeBlock), nudgeBlock.slice(0, 400));

const auto = calls.filter(c => /e\.code==="auth"|account-exists-with-different-credential|_fbPend/.test(c.src));
ok("7 · the two automatic opens — Partner 'auth' error and the social-account collision — open Log in", auto.length >= 1 && auto.every(c => c.arg === "in"), JSON.stringify(auto.map(c => [c.line, c.arg])));

/* the sheet itself: Apple, Google, the divider, email, password, main button, forgot, switch, privacy — in that order */
const sheetStart = lines.findIndex(l => /window\.fbOpenModal\s*=/.test(l));
const sheet = lines.slice(sheetStart, sheetStart + 60).join("\n");
const order = ["fbSocial('apple')", "fbSocial('google')", "auth.social_or", "auth.email_ph", "pwFieldHTML", "fbEmailAuth(", "fbReset()", "auth.register_link", "auth.terms_link"].map(s => sheet.indexOf(s));
ok("8 · the sheet carries Apple, Google, the OR divider, email, password, the main button, Forgotten password, the Register / Log in switch and the privacy line, in that order", order.every((p, i) => p >= 0 && (i === 0 || p > order[i - 1])), JSON.stringify(order));
ok("9 · the social buttons are drawn only when the shell's plugin reports them (socialAuthCaps) — on the web the email form stands alone, by design", /const soc=await socialAuthCaps\(\)/.test(sheet) && /soc\.apple\|\|soc\.google/.test(sheet));

/* sign-out: one function, confirmation first, then the device is wiped and the learner lands on Home */
const so = lines.findIndex(l => /window\.fbSignOut\s*=/.test(l));
const soBlock = lines.slice(so, so + 10).join("\n");
ok("10 · Sign out asks first, signs out, wipes the device and lands on Home; the only button is on the account card", so > 0 && /askConfirm/.test(soBlock) && /FBauth\.signOut\(\)/.test(soBlock) && /fbWipeDevice\(\)/.test(soBlock) && /go\("home"\)/.test(soBlock) && (html.match(/onclick="fbSignOut\(\)"/g) || []).length === 1);

const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
