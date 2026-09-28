# Practice Partner — safety operations (release 1.1.0)

Practice Partner lets two adult learners who do not know each other exchange
recorded voice turns and hold live audio calls. This document is the manual
operating procedure Lomonec LLC follows for reports and abuse. It describes only
what exists; there is **no admin interface** and **no automatic moderation of
audio**. Written 29 Sep 2026 from `backend/partner/partner-worker.js` and its
migrations.

## 1. What the product already does on its own
| Control | Behaviour |
|---|---|
| 18+ confirmation | required before first use (`members.adult`) |
| First names only | no photo, profile, e-mail or text chat; names that contain contact details become "Learner" |
| Contact screening | transcripts, first names and Apply It phrases are checked for phone numbers, e-mail addresses, links and social handles before delivery (`screenTranscript`, `safeName`, `safePhrase`) |
| Audio | members-only (`GET /turns/:id/audio` checks pair membership and blocks); never a public URL |
| Block | one tap; ends the session or live call at once; the two never meet again unless the blocker lifts it |
| Report | one tap with a reason: `harassment`, `contact_info`, `not_english`, `abuse`, `other` |
| Automatic suspension | reports from **two different** learners about the same person → 30 days out of Practice Partner, their queue entry, open session and live call are closed (`doReport`) |
| Rate limits | 5 reports and 20 blocks a day per learner; per-minute limits on every route |
| AI | always labelled AI; never presented as a person |
| Audit log | `audit` table, 90 days |
**Not automatic:** audio and live calls are not screened; nobody is alerted when a report arrives.

## 2. Where reports are stored
Cloudflare D1 database **`be-partner`** (production), tables:
- `reports(id, pair_id, by_uid, about_uid, reason, created_at)` — one row per reporter per reported learner;
- `blocks(by_uid, about_uid, created_at)`;
- `members(uid, name, strikes, suspended_until, …)` — `strikes` = distinct reporters;
- `pairs(id, uid_a, uid_b, status, closed_at, …)` and `turns(pair_id, from_uid, transcript, audio_key, created_at, …)` — the session a report refers to; audio in R2 bucket **`be-partner-audio`** under `turns.audio_key`;
- `audit(ts, actor, action, target, pair_id, meta)` — `reported`, `blocked`, `suspended`, `account_deleted` … (90 days).
Times are milliseconds since 1970 (UTC).

## 3. How the operator reads them (read-only, from the repository, logged in to Cloudflare)
Run from `backend/partner/`. These commands only read.
```sh
# new reports in the last 24 h, with how many distinct people reported that learner
npx wrangler d1 execute be-partner --remote --command "SELECT r.created_at, r.reason, r.about_uid, m.name, m.strikes, m.suspended_until, r.pair_id FROM reports r LEFT JOIN members m ON m.uid=r.about_uid WHERE r.created_at > (strftime('%s','now')-86400)*1000 ORDER BY r.created_at DESC"

# the session behind one report: who said what (transcripts), newest first
npx wrangler d1 execute be-partner --remote --command "SELECT t.created_at, t.from_uid, t.transcript, t.audio_key FROM turns t WHERE t.pair_id='<PAIR_ID>' ORDER BY t.created_at"

# one turn's audio, only when the transcript is not enough to decide
npx wrangler r2 object get be-partner-audio/<AUDIO_KEY> --remote --file ./evidence-<AUDIO_KEY>.webm

# a learner's history of reports and blocks
npx wrangler d1 execute be-partner --remote --command "SELECT 'report' AS kind, reason, by_uid, created_at FROM reports WHERE about_uid='<UID>' UNION ALL SELECT 'block', '', by_uid, created_at FROM blocks WHERE about_uid='<UID>' ORDER BY created_at DESC"
```
Live calls have no recording to review: only `live_sessions` (who, when, how it ended) and whatever the reporter describes.
Evidence files are personal data: keep them on an encrypted disk, only as long as the case needs, never in the repository.

## 4. Triage
| Level | Examples | Action |
|---|---|---|
| **Urgent** | threats of violence or self-harm, sexual content, anything involving a minor, extortion, hate speech | act at once (§5–§6); preserve evidence before the 14-day purge |
| **Serious** | harassment, repeated contact-detail attempts, abuse | review evidence; suspend manually if one report is credible (§5) |
| **Routine** | `not_english`, `other` with no evidence of harm | no action; watch for repeats |
A single credible Urgent or Serious report is enough to act — the automatic rule waits for two reporters.

## 5. Suspension and removal (owner-authorised production writes)
The automatic rule suspends after two reporters. To suspend earlier, the owner (or someone the owner names) runs, **after reviewing the evidence**:
```sh
# 30 days out of Practice Partner, same effect as the automatic rule's flag
npx wrangler d1 execute be-partner --remote --command "UPDATE members SET suspended_until=(strftime('%s','now')+30*86400)*1000 WHERE uid='<UID>'; DELETE FROM interest WHERE uid='<UID>'"
```
An open session of that learner closes when either side next acts; if it must close at once, record it as future engineering (there is no operator endpoint). Lifting a suspension early is the same `UPDATE` with `suspended_until=NULL`. Every manual action is noted in the case log (date, uid, reason, who acted).
Permanent removal of a learner is not implemented; until it is, repeat the suspension and, for Urgent cases, disable the Firebase account in the Firebase console (owner decision).

## 6. Escalation
- **Threats to life or safety, child-safety concerns, extortion:** preserve evidence (§3) first, then contact the relevant local authorities; the owner decides and records the contact. Do not contact the reported learner.
- **App Store / legal requests:** contact@lomonec.com, handled by the owner.
- **Reporter follow-up:** there is no in-app channel back to the reporter; if they wrote to contact@lomonec.com, answer from there.

## 7. Evidence retention
- Voice turns and audio are **deleted 14 days after a session closes** (daily cron) — a reported session is not held back. Review before then.
- Reports and blocks are kept so they keep protecting people; after the reporter deletes their account, their own reports go too; reports about a deleted account stay, no longer leading to a name or e-mail.
- The audit log is kept 90 days.
- Evidence exported for a case is deleted when the case closes.

## 8. Response process (proposed — the owner sets the targets)
1. **Daily:** run the first query in §3 (weekends included while Practice Partner is live).
2. **Within 24 hours of a report:** triage (§4); Urgent the same day.
3. **Act:** suspend (§5) or record "no action" with the reason.
4. **Log:** date, report id, decision, who decided.
5. **Weekly:** look at learners with several blocks but no reports.

## 9. What happens when a learner reports someone
1. They tap ⋯ → *Report* and choose a reason; the report is stored at once (§2).
2. They can also *Block*: the session or call ends immediately and the two are never matched again.
3. A second report from a different learner suspends the reported person automatically for 30 days.
4. The operator sees the report at the next daily check (§8) and decides.
The app does not currently tell the reporter what was decided.

## 10. Future engineering (not built — do not claim it)
- an operator alert when a report arrives (for example an e-mail from be-mail);
- an evidence hold that stops the 14-day purge for reported sessions;
- a small, authenticated operator view instead of raw SQL;
- an operator endpoint to close a suspended learner's open sessions at once;
- automatic screening of audio or live calls.
