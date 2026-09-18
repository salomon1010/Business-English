# Practice Partner + Shadow Studio V2 — real-device checklist

**Status: not run.** No row below is PASS until the owner runs it on the
physical device named. Fill in device model, OS and browser version at the
top of each table. Staging set-up is in PILOT.md § Staging (no merge needed).

Preconditions for every row: the branch is served over HTTPS on the fixed
staging hostname; `localStorage.be_partner_api` points at the staging Worker;
`localStorage.be_flags` set as in PILOT.md; two Firebase accounts (A on this
phone, B on the other phone or a desktop) on General English, past the
placement check. "Partner" rows need both.

Legend for EXPECTED: what the app must show. NOTES: write what actually
happened, including OS dialogs.

## iPhone Safari — model ______ iOS ______ Safari ______

| ID | Precondition | Action | Expected | Pass/Fail | Notes |
|---|---|---|---|---|---|
| I-01 Login | signed out | Profile → sign in with account A | signed in; name shown; no console error banner | | |
| I-02 General English | signed in | Profile → switch area to General English | Home shows General English; Practice tab present | | |
| I-03 Availability | flags on | Practice tab | "Practice Partner" card visible | | |
| I-04 Consent | first open | tap the card → "Set up" | sheet opens; **scrolls inside**; 18+ box and Agree reachable; Agree disabled until 18+ ticked | | |
| I-05 Preferences | sheet open | pick 2 goals, "Voice messages", "Evening" | chips toggle; Agree registers; page shows Match me / Practise now | | |
| I-06 Match me | B is waiting | tap Match me | 1–3 cards: first name, band, goal, plain reason; no score, no photo | | |
| I-07 Practise now | B waiting, A not paired | tap Practise now | paired at once, "Turn 1 of 4 — your turn" | | |
| I-08 Candidate card | cards shown | read a card | reason is a sentence ("same level", "same lesson"…), nothing else about B | | |
| I-09 Try practice | cards shown | tap Try a practice | session opens; lesson task shown as turn 1 | | |
| I-10 Record | session, your turn | tap Record → OS mic prompt → allow | live timer runs; stops itself at 1:00 | | |
| I-11 Playback | take exists | tap play on the take | audio plays through speaker; scrubbing works; works with ringer switch on silent | | |
| I-12 Re-record | take exists | tap Record again | old take replaced; Send disabled until coach returns | | |
| I-13 Send | take + coach score | tap Send once | "Sent" toast; status "waiting for B"; today lit in the calendar | | |
| I-14 Partner receives | B's phone | B opens app / Home | Home card "Your turn, with A"; Practice badge; one toast | | |
| I-15 Partner responds | B | B records and sends | A: Home card + badge + **one** toast; A's thread shows B's turn with transcript, plays | | |
| I-16 Four rounds | alternating | A, B, A, B | after B's 4th turn both see "Session complete" | | |
| I-17 AI feedback | complete | read the tip | one-line tip carries the "AI" tag; every score line carries "AI" | | |
| I-18 Continue | complete | A and B both tap "Practise together again" | "You and B are now practice partners"; connection card with Start | | |
| I-19 Rematch | a second session with C (or B after leaving) | tap "Find someone else" | neutral toast; back to Match me; other side sees only "ended"; B/C not offered again | | |
| I-20 Shadow V2 | flags on | Shadow → pick a library clip | panel with Watch / Shadow / Challenge / Apply it under the player | | |
| I-21 Video | clip loaded | play | YouTube plays inline (not full-screen takeover) | | |
| I-22 Transcript | playing | watch the panel | current sentence highlighted, panel auto-scrolls | | |
| I-23 Word highlight | word-level clip (e.g. the first library clip) | play at 1× and 0.75× | current word lights within ~1 word of the audio; no drift after 60 s | | |
| I-24 Sentence highlight | cue-only clip (Stanford talk) | play | sentence lights, panel says "sentence by sentence" | | |
| I-25 Seek | playing | tap a sentence; drag the YouTube scrubber | highlight jumps immediately; no stuck highlight | | |
| I-26 Repeat | sentence chosen | tap Repeat | the sentence loops; Repeat again stops it | | |
| I-27 Challenge | panel | Challenge tab | text hidden; Reveal shows it; "Hide again" works | | |
| I-28 Apply → AI | Apply tab | Practise with AI | Life Simulations opens with the phrase | | |
| I-29 Apply → Partner | Apply tab, partner flag on | Use with a partner | Partner page; "next practice will use this expression"; after pairing, turn 1 carries the phrase and B sees the same | | |
| I-30 Network loss | mid-session | Airplane mode → tap Send | "offline" message; take kept; Send re-enabled | | |
| I-31 Recovery | airplane off | tap Send again | one turn sent (not two); thread updates | | |
| I-32 Background | recording | press Home / lock the phone | recording stops cleanly; take is kept and playable | | |
| I-33 Mic denial | fresh Safari site settings → Deny | tap Record | app's own "microphone denied" toast; no blank screen | | |
| I-34 Mic interruption | recording | receive a phone call | recording stops cleanly; take kept or "too short" toast | | |
| I-35 Logout / login | signed in, in a session | sign out → sign in | partner page shows sign-in card while out; thread restored after sign-in | | |
| I-36 Welding isolation | same phone, switch area to Welding | Practice tab, Home, `#partner`, Shadow clip | no Practice Partner card, no Home card, `#partner` shows the "part of General English" notice, no Shadow V2 panel | | |

## Android Chrome — model ______ Android ______ Chrome ______

| ID | Precondition | Action | Expected | Pass/Fail | Notes |
|---|---|---|---|---|---|
| A-01 … A-36 | same as I-01 … I-36 | same | same, plus: A-10 Chrome mic prompt; A-11 playback with media volume; A-21 inline YouTube; A-32 recent-apps switch as well as lock | | |

Copy the iPhone table here and rename the IDs `A-nn` before starting; keep
both tables in this file so the results live next to the code.

## Result summary (owner fills in)
- iPhone: __ / 36 pass — blocking failures: ______
- Android: __ / 36 pass — blocking failures: ______
- Date, tester, staging Worker version (`/health` output): ______
