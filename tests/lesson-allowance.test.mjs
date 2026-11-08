/* The free daily allowance must cover ONE complete lesson day and no more (owner, 7 Nov 2026):
   start Monday, finish it, read the closing report. A second day waits for tomorrow.
   This counts the spine against the Worker's own free cap so the two cannot drift apart. */
import {readFileSync} from "node:fs";
const win={};
new Function("window",readFileSync(new URL("../daily-learning-plan.js",import.meta.url),"utf8"))(win);
const DailyPlan=win.DailyPlan;

let pass=0,fail=0;
const ok=(n,c)=>{c?(pass++,console.log("  PASS  "+n)):(fail++,console.log("  FAIL  "+n))};

/* --- the free cap, read from the Worker, never retyped here --- */
const worker=readFileSync(new URL("../backend/polish-worker.js",import.meta.url),"utf8");
const caps=/VERDICT_CAPS\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(worker);
const fm=/VERDICTS_FREE_PER_DAY\s*=\s*(\d+)/.exec(worker);
const pm=/VERDICTS_PREMIUM_PER_DAY\s*=\s*(\d+)/.exec(worker);
const freeCap=fm?Number(fm[1]):null, premCap=pm?Number(pm[1]):null;

const free=DailyPlan.evaluationPlan({account:true,premium:false});
const prem=DailyPlan.evaluationPlan({account:true,premium:true});
const anon=DailyPlan.evaluationPlan({account:false,premium:false});

ok("the Worker still meters ai_analysis and ai_coach", !!caps && /ai_analysis/.test(caps[1]) && /ai_coach/.test(caps[1]));
ok("free cap was found in the Worker", freeCap!==null);
ok("a free day costs exactly the free cap ("+free.verdicts+" vs "+freeCap+")", free.verdicts===freeCap);
ok("the closing report is part of a free day", free.overall===true);
ok("the baseline minute is AI on free", free.try==="ai");
ok("the conversation take is AI on free", free.converse==="ai");
ok("before/after costs no verdict", free.finish==="compare");
ok("shadowing is graded on the device", free.shadow==="device");
ok("premium costs more than free (it does more)", prem.verdicts>free.verdicts);
ok("a premium day fits many times over in "+premCap, premCap/prem.verdicts>=10);
ok("premium adds AI to the rehearsal step", prem.rehearse==="ai" && free.rehearse==="device");
ok("anonymous spends nothing", anon.verdicts===0);
ok("anonymous still gets the lesson, measured on the device", anon.try==="device" && anon.overall===false);

/* --- the client must not spend a verdict writing practice CONTENT --- */
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
ok("sentence writing asks for the unmetered purpose", /dlpChat\(sys,usr,"practice"\)/.test(html));
ok("dlpChat defaults to the metered coach purpose", /purpose==="practice"\?"practice":"coach"/.test(html));
ok("the uncosted branch uses sttOff, not aiOff(null)", /pu==="practice"\?sttOff\(\):aiOff\("ai_coach"\)/.test(html));
ok("a repeat baseline take does not buy a second report on free",
   /buyReport=EP\.try==="ai"&&\(EP\.premium\|\|prevTakes\.length===0\)/.test(html));
ok("and the learner is told so", /dlp\.try_rep_once/.test(html));

console.log("\n"+pass+"/"+(pass+fail)+" passed");
process.exit(fail?1:0);
