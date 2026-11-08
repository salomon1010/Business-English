/* The owner's weekly review queue -> catalogue/week-clips.json.
   Usage: node scripts/build_week_clips.mjs [--write]      (yt-dlp, metadata only, nothing downloaded)

   The source table came from another assistant that says it "did not verify embedded playback or
   transcript accuracy inside BE Mastery". So nothing in it is carried over as FACT:
     - title, duration, channel, embeddability and caption availability are READ from YouTube;
     - a segment the table names is stored as a CLAIM (boundaries:"claimed"), and only checked for
       falling inside the video — it is not approved, and no end time is invented where none was given;
     - industry / situation tags come from the owner's brief and the title, and say so. Nobody has
       watched any of these clips, so editorial and rights stay "pending" for every row.
   A row is lessonReady only when nothing blocks it. Today that is none of them: no transcript is
   bundled for any, and most have no end time. */
import { spawn } from "node:child_process"; import { readFileSync, writeFileSync } from "node:fs";
const WRITE = process.argv.includes("--write");
const weeks = JSON.parse(readFileSync("tracks/general/weeks.json", "utf8")); const W = weeks.weeks || weeks;
const theme = n => (W.find(x => (x.n || x.week) === n) || {}).theme || "";

/* id, the segment the table names (seconds; null = none given), what the owner's brief says to look for,
   and tags. industries use the ONBOARDING catalogue's group ids (tech, mgmt, bizfin, sales...). */
const Q = [
  { week:1,  id:"lq213nm9aDk", start:0,    end:56,   ask:"general fallback: attorney introduction, 0:00-0:56", industries:["legalgov"], situations:["networking","small_talk","interviews"] },
  { week:2,  id:"z4q6fxouTd4", start:128,  end:null, ask:"30-second stand-up update from 2:08: progress, blocker, next step", industries:["tech","mgmt"], situations:["standups","meetings"] },
  { week:3,  id:"4W5YYwMUyaE", start:null, end:null, ask:"first dialogue: project deadline and supplier delay", industries:[], situations:["meetings","clients"] },
  { week:4,  id:"ENCnqouZgyQ", start:null, end:null, ask:"Anne and James dialogue: the clarification question AND the answer", industries:[], situations:["meetings","calls"] },
  { week:5,  id:"RRxQQxiM7AA", start:45,   end:92,   ask:"0:45-1:32: defines Slack, then how communication is organised differently from email", industries:["tech"], situations:["presentations","clients"] },
  { week:6,  id:"ByIIAjfw5bg", start:1498, end:null, ask:"the candidate's final recommendation from 24:58", industries:["bizfin","mgmt"], situations:["interviews","presentations"] },
  { week:7,  id:"2ReRqMy7hN4", start:666,  end:715,  ask:"11:06-11:55: polite disagreement, marketing-spend example", industries:[], situations:["meetings","negotiation"] },
  { week:8,  id:"as9IYFrTiKc", start:84,   end:null, ask:"team and stakeholder exchange from about 1:24", industries:["tech","mgmt"], situations:["standups","meetings"] },
  { week:9,  id:"mIK5-yi7a-c", start:null, end:null, ask:"start of Sundar Pichai's prepared remarks, after the investor-relations handoff", industries:["bizfin","mgmt","tech"], situations:["presentations","meetings"] },
  { week:10, id:"BouSVKqom5o", start:155,  end:null, ask:"interviewer's question and the candidate's answer from about 2:35", industries:[], situations:["interviews","networking"] },
  { week:11, id:"ae5MssJ8en4", start:15,   end:60,   ask:"0:15-1:00: introduces the product, makes a specific ask, demonstrates the benefit", industries:["sales"], situations:["presentations","negotiation","clients"] },
];
const run = (a, ms) => new Promise(r => { const p = spawn("yt-dlp", a, { stdio: ["ignore", "pipe", "pipe"] }); let o = ""; const t = setTimeout(() => p.kill("SIGKILL"), ms); p.stdout.on("data", d => o += d); p.on("close", () => { clearTimeout(t); r(o.trim()); }); });
const en = o => !!(o && Object.keys(o).some(k => /^en(-|$)/i.test(k)));
const rows = await Promise.all(Q.map(async q => {
  let o = await run(["-J", "--no-warnings", "--skip-download", `https://www.youtube.com/watch?v=${q.id}`], 90000);
  if (!o) o = await run(["-J", "--no-warnings", "--skip-download", `https://www.youtube.com/watch?v=${q.id}`], 120000);
  let i = null; try { i = JSON.parse(o); } catch {}
  const base = { week: q.week, skill: theme(q.week), id: q.id, url: `https://www.youtube.com/watch?v=${q.id}`,
    start: q.start, end: q.end, boundaries: q.start != null && q.end != null && q.end > q.start ? "claimed" : "none",
    asked: q.ask, industries: q.industries, situations: q.situations,
    tagBasis: "the owner's brief and the video title; nobody has watched the clip",
    editorial: "pending", rights: "pending", transcriptInApp: false, role: null, roleGroup: null };
  if (!i || typeof i !== "object") return { ...base, technical: { state: o ? "unavailable" : "check_failed" }, blockers: ["could not be read from YouTube"] };
  const dur = Math.round(i.duration || 0), title = i.title || "";
  const notes = [];
  if (/[぀-ヿ㐀-鿿가-힯]/.test(title)) notes.push("the title is not in English; whether the spoken segment is English is unchecked");
  if (dur > 1200 && base.boundaries !== "claimed") notes.push(`a ${Math.round(dur / 60)}-minute source: only an approved excerpt can be used`);
  if (q.start != null && q.start >= dur) notes.push("the stated start is past the end of the video");
  const blockers = ["editorial review pending", "rights review pending", "no transcript in the app"];
  if (base.boundaries === "none") blockers.push("no exact start and end");
  else blockers.push("start and end are an unverified claim");
  return { ...base, title, channel: i.channel || "", channelId: i.channel_id || "", dur, embeddable: i.playable_in_embed !== false,
    technical: { state: "checked", checked: new Date().toISOString().slice(0, 10), durationSeconds: dur, embeddable: i.playable_in_embed !== false,
      englishCaptionTrack: en(i.subtitles) ? "human" : en(i.automatic_captions) ? "auto" : "none", startInsideVideo: q.start == null ? null : q.start < dur },
    notes, blockers, lessonReady: false };
}));
rows.sort((a, b) => a.week - b.week);
const out = { built: new Date().toISOString().slice(0, 10), reviewed: false,
  review_warning: "A REVIEW QUEUE, not a catalogue. Technical checks say a video plays and allows embedding. Nothing here has been watched, no transcript is bundled, and every segment is a claim. lessonReady is false for every row and is set by a human, not by this script.",
  weeks: rows };
for (const r of rows) console.log(`W${String(r.week).padStart(2)} ${r.id} ${r.technical.state === "checked" ? r.dur + "s emb=" + r.embeddable + " caps=" + r.technical.englishCaptionTrack : r.technical.state}  [${r.boundaries}]${r.notes && r.notes.length ? "  ! " + r.notes.join("; ") : ""}`);
if (WRITE) { writeFileSync("catalogue/week-clips.json", JSON.stringify(out, null, 1) + "\n"); console.log("wrote catalogue/week-clips.json"); } else console.log("DRY RUN — pass --write");
