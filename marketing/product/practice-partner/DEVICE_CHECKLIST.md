# Practice Partner — real-device certification checklist

**Status: Levels 1–3 partly certified on two iPhones on staging, 20 Sep 2026**
(rows marked P below, with the server evidence in the notes; everything else
is still open). No row is PASS until the owner runs it on the physical
device named. Set-up: PILOT.md § Staging (branch
served over HTTPS, `be_partner_api`, `be_events_api`, full `be_flags`, two
real Firebase accounts A and B on General English, past the placement check).
Fill in device model, OS and browser version per table. Do one full table on
**iPhone Safari**, then the same on **Android Chrome** (copy the table, rename
`I-` → `A-`). Rows marked **(2)** need both phones.

Staging is **STUN-only** unless the owner has set the TURN secrets (PILOT.md
§ Staging 4c): Wi‑Fi/Wi‑Fi rows are valid without TURN; the Wi‑Fi/cellular
rows are **incomplete until TURN is configured and re-tested**.

## iPhone Safari — model ______ iOS ______ Safari ______ · network: ______

### 0. Account and entry
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-01 Login | signed out | Profile → sign in (A) | signed in, name shown | P | 20 Sep 2026 staging, both iPhones (A "Gyre", B "Troy"); D1 `members` rows track=general-english |
| I-02 General English | signed in | switch area, pass placement | Home on General English | P | same |
| I-03 Practice tab | flags on | open Practice | "Best tool for your step" strip; under Life Simulations: **Practice Partner** card and **Practise a real conversation** card | P | card present |
| I-04 Role-play naming | | compare the strip's 4th tool with the Life Simulations card | both say **Practise a real conversation**; tapping either opens the same role-play library; the strip one may carry "Recommended" | | |

### 1. Level 1 — async human practice (2)
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-05 Consent | first open | tap the Practice Partner card → Set up | sheet scrolls inside; 18+ box and Agree reachable | P | consent_at 04:18:09 / 04:19:08 Z |
| I-06 Preferences | sheet | 2 goals, Voice messages, Evening → Agree | Match me / Practise now shown | P | goals [workplace], mode voice stored |
| I-07 Match me | B waiting | Match me | 1–3 cards: first name, band, goal, plain reason; no score, no photo | P | queue_joined 04:19:39 / 04:19:44; both saw each other |
| I-08 Try practice | cards | Try a practice | "Turn 1 of 4 — your turn", lesson task | P | both proposed within 1 s; one pair, the other proposal `expired` — race handled |
| I-09 Record / play / re-record | your turn | Record → stop → play → Record again | timer to 1:00 max; take plays; re-record replaces; Send only after the coach | P |  |
| I-10 Send | take + score | Send once | "Sent"; waiting for B; day lit; a double tap sends nothing twice | P | turn 1 7.7 s, 178 KB audio/mp4, R2 object byte-identical to D1 |
| I-11 Partner receives / responds | B | B opens Home, plays, records, sends | B: Home card + badge + one toast; A: same, one toast, B's turn playable with transcript | P | turn 2 04:20:57, score 95 |
| I-12 Four rounds | | A, B, A, B | both: "Session complete"; recorder gone | P | turns 3–4, `session_completed {turns:4}` |
| I-13 AI tip | complete | read | one line tagged **AI**; every score line tagged AI | P | tip tagged AI on both phones (photo) |
| I-14 Continue (2) | complete | A: **Keep practising together →** (card shows "Waiting for B to decide", B sees nothing about it); B: the same | both: **You're practice partners** / "You both chose to keep practising together" / **Practise together →**; tapping it starts the next structured session | P | Gyre 04:28:28, Troy 04:30:22 → pair closed `completed`, one `connections` row `mutual`, sessions 1; Troy saw nothing until his own tap |
| I-14b Not now (2) | complete, fresh trial | A: **Not now** | A: "Not now — you can come back…"; no connection on either phone; B's card simply says the session is complete; both can Match me again | | |
| I-14c One-sided (2) | complete, fresh trial | A: Keep practising; B: Find someone else | A: dialog "Your partner chose to try another learner" → Find another partner / Close; no connection; B not offered to A for 14 days | | |
| I-15 Regular session | connected | Start today's practice → 4 rounds → both continue | card says **Regular partners** · 2 sessions | P | regular pair 04:31:28 opened; left before a turn — 'Regular partners · 2 sessions' not yet exercised |

### 2. Partner management (2)
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-16 Session menu | in a session | gear on the session header | **Report B**, **Block**, **Leave today's practice**, Close | | |
| I-17 Leave today's practice | in a session | Leave today's practice → confirm | confirmation says you *stay partners*; back on the partner page with the connection card intact; B sees "Your last session ended", still partners | P | left 04:34:14; connection intact; other phone got the 'left' dialog |
| I-18 Partner options | connection card | gear on the card | sheet: **Find someone else**, **End partnership**, **Report B**, **Block**, Close; no photo, no profile | | |
| I-19 End partnership | options | End partnership → confirm | text says not a block, not a report; card gone; Match me available; B: card gone, no reason shown, B not blocked (B can still be matched by others) | | |
| I-20 Ending twice | after I-19 | (API) `POST /connection/end` again | 404 `no_connection` / harmless | | |
| I-21 Find someone else | new connection with B (redo I-07–I-14) | options → Find someone else → confirm | partnership ended **and** matching starts; B is still offered while online, sorted last (never hidden) | | |
| I-22 Rematch in a session | trial with C | decision card → Find someone else | neutral toast; C sees only "ended"; C still offered while online, sorted last | | |
| I-23 Block (2) | session or card | Block → confirm | pair/session ends at once; blocked side gets no more turns, 403 on audio; cannot be matched again | | |
| I-24 Report (2) | session or card | Report → reason | "reported" toast; nothing shown to the other side; row in `audit`/`reports` (owner checks D1) | P | both phones reported from inside a session (04:58 Z): `reports` rows + audit, strikes 1 each, nothing shown to the other side; rows cleared afterwards |

### 3. Level 2 — AI coach
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-25 Reachable while connected | connected, nobody else waiting | Practise now | "You're on the waiting list…" **and** card **AI COACH — NOT YOUR PARTNER** / **Practise with the AI coach →**; connection card still shown. **With B in line the AI card is absent** and the strip count equals the candidate cards (never "1 waiting" + "No one is available") | P | 04:43 Z: Match me → waiting card + AI card; `ai_started reason=waiting` |
| I-26 No candidates | Match me, nobody waiting | | "No suitable partner is available right now" + the AI button + Keep looking | | |
| I-27 AI session | tap the AI button | | header **AI · AI coach**, "not a person", Round 1 of 4, your current lesson task, recorder | P | AI header/labels per photo; coach replied and spoke |
| I-28 AI turns | record → Send to the AI coach ×2 | | each reply tagged AI and spoken; "AI practice complete" with one AI-tagged tip; Practise again / Back | P | 2 sends → complete → 'Practise again' (`ai_started reason=again` 04:46:10) |
| I-29 AI failure | airplane mode after recording, Send | | "did not answer… try again" card, take kept; retry sends once | | |
| I-30 Human thread untouched | after I-28 | Back → Stop looking | no AI turn anywhere in a human thread; connection card unchanged | P | `turns` unchanged, connection `mutual`; both phones also opened the coach from More options (`reason=session`, 04:54) with no turn in the human thread |
| I-31 Daily cap | (API) 13th new session | | 429 → "That is enough AI practice for today…" | | |

### 4. Level 3 — live human practice (2)
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-32 Invite | connected | A: Practise live | A: "Waiting for B to join…", Cancel; B within ~8 s: Home card + toast + **Join the call / Not now** | | |
| I-33 Decline / cancel | | B: Not now (then A invites again and cancels) | A: "B is not available right now" / "Invitation cancelled"; nothing stuck | | |
| I-34 Connect (Wi‑Fi/Wi‑Fi) | B: Join → both allow mic | | both "Connected — you can talk" within ~15 s; two-way audio; timer on both; header **Live with B · A real learner, live. Nothing is recorded.** | P | session 909e51f0: invited 04:50:53, connected 04:50:57 (4 s), 1 offer + 1 answer + 15 ICE; two-way audio confirmed by the owner |
| I-35 Controls | in call | Next round; Mute; Phrase help | B sees Round 2 within ~5 s; B stops hearing A while muted, Unmute restores; three **AI**-tagged phrases as text only, no AI voice | P (Mute only) | Mute/Unmute seen on both phones (photo); Next round and Phrase help not yet run |
| I-36 Drop / reconnect | in call | A: airplane 10 s → off | both "Connection lost. Trying again…"; audio back within ~30 s or a clear end after 60 s | | |
| I-37 Background / lock | in call | A: lock 20 s, unlock; then switch app and back | audio continues or reconnects; no stuck screen | | |
| I-38 Reload | in call | A: reload the page | partner page shows "Your live practice with B is open" → Return to the call reconnects, or B sees "A left" | | |
| I-39 Leave / finish | in call | A: Leave (Finish after round 4) | A "You left…"; B "A left the live practice" within ~5 s; both mic indicators off; connection card back | P | Leave → `ended`, `end_reason=left`, 2 min 23 s |
| I-40 Block in call | new call | B: menu → Block → confirm | B's call ends instantly; A sees "left"; A can no longer invite B | P (server) | Troy blocked Gyre 04:59:57: pair `ce5c644d` closed `blocked`, connection `blocked`, `blocks` row; phone-side wording not photographed |
| I-41 Report in call | new call | A: menu → Report → reason | "reported"; call continues; row in `audit` | | |
| I-42 Connect (Wi‑Fi/cellular) | one phone on 4G/5G | repeat I-34 | connects **only if TURN is configured**; otherwise "Still connecting… some phone networks block direct calls" after 45 s — record which | | |
| I-64 Unblock (2) | B blocked A earlier (I-40 or a session block) | B: Change preferences → **Blocked learners** → Unblock → confirm | B's list empties, toast "Block lifted"; A is told nothing; A appears again on B's cards after both join the line; no partner card comes back (fresh start) | | |
| I-65 History tab | after Levels 1–3 | Practice Partner → **History** | summary tiles (sessions, turns sent, average, live calls), a trend line, filter chips, day groups; every session with own turns + scores + weakest words on tap, the live call with duration and how it ended, the AI practice tagged **AI** with its tip, safety rows (blocked → **Unblock** button); nothing of the partner's words anywhere | | |
| I-66 Clear history | History tab | **Clear my history** → confirm | list shows the empty state; toast counts the recordings removed from the server; owner checks D1: `turns` rows of A's closed pairs gone, open pair untouched, `reports`/`blocks` untouched, audit `history_cleared` | | |

### 5. Welding isolation (same phone)
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-43 UI | **all flags ON**, switch area to Welding | Practice, Home, `#partner`, Shadow clip, Apply tab | no Practice Partner card, no Home partner card, typing `#partner` lands straight on the Practice tab (nothing partner-branded, no fetch), no Shadow V2 panel, no Apply → Partner; the Welding role-play/simulation cards unchanged | | |
| I-44 API | Safari console (token from `FBUser.getIdToken()`) | `POST /interest` track welding; `POST /ai/session` track welding; `POST /live`; `GET /live/<id>`; `GET /turns/<id>/audio` | `{error:"track"}`, `{error:"track"}`, 404, 403, 404/403 | | |
| I-45 Flags off | General English, remove `be_flags`, reload | Practice, Home, `#partner`, Shadow | nothing partner-related; `#partner` unavailable; no Shadow V2 (production default) | | |

### 5b. Live availability UX (2) — added 2026-09-19
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-51 How it works | Practice tab | tap **How it works** inside the Practice Partner card | a sheet with the three steps ("anyone in line", "talk live, or record four short turns", "then decide"), **Find a practice partner** and Close; the card itself does not open | | |
| I-52 Presence strip | partner page, B signed in on the other phone | read the strip under the title | "N learner(s) online · M waiting to practise" with a green beacon when N > 0; grey "No one online right now…" when 0; **no names**; tap → candidate cards | | |
| I-53 Waiting card colour | A in line, B in line | read A's waiting card | heading/sub-line **green** while someone else waits ("1 other learner(s) are waiting too — tap Show me candidates"); B leaves the queue → the line goes back to the plain colour | | |
| I-54 Auto-discovery (2) | A waiting on the partner page, B not in line | B taps Match me | within ~8 s A's candidate cards open by themselves, one toast "1 learner(s) waiting — pick one", **no** availability banner on top of the cards; A closes the cards → they do not reopen until someone new arrives | | |
| I-55 Floating button | A on Home / Road map / Profile | look bottom-right | round white **Talk to a real person** pill with a dark outline, above the bottom nav, covering no button; a green count badge at its top-right says how many learners are online (hidden at zero; signed out it comes from the public `/presence` count); absent on the partner page, in a live room, on Welding; signed out or not yet consented it shows on the **Practice tab only** (tap → sign-in / consent card); tap → partner page with the candidate cards (in line once, not twice) | | |
| I-56 No compatibility gate (2) | A Week 1–4, B Week 9–12 | A: Match me | B is offered (reason line present), no "not compatible" anywhere | | |
| I-57 Live from a card (2) | cards open | A: **Practise live** on B's card | A: "Waiting for B to accept… the call opens here"; B: banner "A wants to practise live with you" / **Accept & talk**; B accepts once → B is in the room, A's phone walks into the room by itself (no extra tap); connect as I-34 | | |
| I-58 Live inside a trial (2) | recorded trial with a stranger, round 1 | A: More options → Practise live | invitation reaches B as in I-32; no "practise once first" rule | P | the 04:50 call rode on a queue proposal (`live_invited via:proposal`) |
| I-59 Live beacon | live call open, A goes Home | top-right dot | a green dot with the road map's expanding ring + slow dashed ring (same motion as "you are here"); faster ring while connected; tap → back to the room; gone when the call ends | | |
| I-61 Hang up (2) | in a call | A: red phone button in the call card | call ends for both at once ("You left" / "A left"), mics off; while still waiting for B, the same button cancels the invitation | | |
| I-62 Home presence card | idle on Home, B online | read the Practice Partner card | green "N learner(s) online · M waiting to practise" + Talk to a real person; in line with B available → "1 learner(s) available to practise with you" instead | | |
| I-63 Floating button + pill | recording session open, on Home | look bottom-right | the floating button sits **above** the session pill, neither covers the other; it is absent only in a live room or under a call banner | | |
| I-60 Partner left (2) | trial open, A mid-take | B: Leave today's practice | A: one dialog "B left today's practice" — **Close** / **Find another partner**; Close → the session, the recorder, the notice line and B's name are gone at once (no reload); Find another partner → candidate cards / waiting card, nothing of B left | | |

### 6. Network and recovery
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-46 Async send offline | take ready | airplane → Send | "offline" message, take kept; airplane off → Send → one turn | | |
| I-47 Mic denial | Safari site settings → Deny | Record | app's own "microphone denied" toast, no blank | | |
| I-48 Mic interruption | recording | receive a call | recording stops cleanly; take kept or "too short" | | |
| I-49 Logout / login | in a session | sign out → in | sign-in card while out; thread restored | | |
| I-50 Layout | every screen above | | nothing behind the bottom nav; sheets scroll; buttons tappable; RTL (Arabic) does not overflow | | |

## Android Chrome — model ______ Android ______ Chrome ______ · network: ______
Copy the 63 rows above as `A-01 … A-63`. Android-specific: A-09 Chrome mic prompt and `audio/webm`; A-34 inline audio with media volume; A-37 recent-apps switch as well as lock.

## Result summary (owner fills in)
- iPhone: __ / 63 — blocking failures: ______
- Android: __ / 63 — blocking failures: ______
- TURN configured on staging: yes / no — I-42 / A-42 result: ______
- Date, tester, staging Worker version (`/health` + `wrangler deployments list --env staging`): ______
