# Practice Partner — real-device certification checklist

**Status: not run on hardware for this build.** No row is PASS until the owner
runs it on the physical device named. Set-up: PILOT.md § Staging (branch
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
| I-01 Login | signed out | Profile → sign in (A) | signed in, name shown | | |
| I-02 General English | signed in | switch area, pass placement | Home on General English | | |
| I-03 Practice tab | flags on | open Practice | "Best tool for your step" strip; under Life Simulations: **Practice Partner** card and **Practise a real conversation** card | | |
| I-04 Role-play naming | | compare the strip's 4th tool with the Life Simulations card | both say **Practise a real conversation**; tapping either opens the same role-play library; the strip one may carry "Recommended" | | |

### 1. Level 1 — async human practice (2)
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-05 Consent | first open | tap the Practice Partner card → Set up | sheet scrolls inside; 18+ box and Agree reachable | | |
| I-06 Preferences | sheet | 2 goals, Voice messages, Evening → Agree | Match me / Practise now shown | | |
| I-07 Match me | B waiting | Match me | 1–3 cards: first name, band, goal, plain reason; no score, no photo | | |
| I-08 Try practice | cards | Try a practice | "Turn 1 of 4 — your turn", lesson task | | |
| I-09 Record / play / re-record | your turn | Record → stop → play → Record again | timer to 1:00 max; take plays; re-record replaces; Send only after the coach | | |
| I-10 Send | take + score | Send once | "Sent"; waiting for B; day lit; a double tap sends nothing twice | | |
| I-11 Partner receives / responds | B | B opens Home, plays, records, sends | B: Home card + badge + one toast; A: same, one toast, B's turn playable with transcript | | |
| I-12 Four rounds | | A, B, A, B | both: "Session complete"; recorder gone | | |
| I-13 AI tip | complete | read | one line tagged **AI**; every score line tagged AI | | |
| I-14 Continue (2) | complete | both "Practise together again" | "You and B are now practice partners"; connection card | | |
| I-15 Regular session | connected | Start today's practice → 4 rounds → both continue | card says **Regular partners** · 2 sessions | | |

### 2. Partner management (2)
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-16 Session menu | in a session | gear on the session header | **Report B**, **Block**, **Leave today's practice**, Close | | |
| I-17 Leave today's practice | in a session | Leave today's practice → confirm | confirmation says you *stay partners*; back on the partner page with the connection card intact; B sees "Your last session ended", still partners | | |
| I-18 Partner options | connection card | gear on the card | sheet: **Find someone else**, **End partnership**, **Report B**, **Block**, Close; no photo, no profile | | |
| I-19 End partnership | options | End partnership → confirm | text says not a block, not a report; card gone; Match me available; B: card gone, no reason shown, B not blocked (B can still be matched by others) | | |
| I-20 Ending twice | after I-19 | (API) `POST /connection/end` again | 404 `no_connection` / harmless | | |
| I-21 Find someone else | new connection with B (redo I-07–I-14) | options → Find someone else → confirm | partnership ended **and** matching starts; B not offered again (cooldown) | | |
| I-22 Rematch in a session | trial with C | decision card → Find someone else | neutral toast; C sees only "ended"; C not offered again | | |
| I-23 Block (2) | session or card | Block → confirm | pair/session ends at once; blocked side gets no more turns, 403 on audio; cannot be matched again | | |
| I-24 Report (2) | session or card | Report → reason | "reported" toast; nothing shown to the other side; row in `audit`/`reports` (owner checks D1) | | |

### 3. Level 2 — AI coach
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-25 Reachable while connected | connected, nobody else waiting | Practise now | "Looking for your partner…" **and** card **AI COACH — NOT YOUR PARTNER** / "No partner available yet" / **Practise with the AI coach →**; connection card still shown | | |
| I-26 No candidates | Match me, nobody waiting | | "No suitable partner is available right now" + the AI button + Keep looking | | |
| I-27 AI session | tap the AI button | | header **AI · AI coach**, "not a person", Round 1 of 4, your current lesson task, recorder | | |
| I-28 AI turns | record → Send to the AI coach ×2 | | each reply tagged AI and spoken; "AI practice complete" with one AI-tagged tip; Practise again / Back | | |
| I-29 AI failure | airplane mode after recording, Send | | "did not answer… try again" card, take kept; retry sends once | | |
| I-30 Human thread untouched | after I-28 | Back → Stop looking | no AI turn anywhere in a human thread; connection card unchanged | | |
| I-31 Daily cap | (API) 13th new session | | 429 → "That is enough AI practice for today…" | | |

### 4. Level 3 — live human practice (2)
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-32 Invite | connected | A: Practise live | A: "Waiting for B to join…", Cancel; B within ~8 s: Home card + toast + **Join the call / Not now** | | |
| I-33 Decline / cancel | | B: Not now (then A invites again and cancels) | A: "B is not available right now" / "Invitation cancelled"; nothing stuck | | |
| I-34 Connect (Wi‑Fi/Wi‑Fi) | B: Join → both allow mic | | both "Connected — you can talk" within ~15 s; two-way audio; timer on both; header **Live with B · A real learner, live. Nothing is recorded.** | | |
| I-35 Controls | in call | Next round; Mute; Phrase help | B sees Round 2 within ~5 s; B stops hearing A while muted, Unmute restores; three **AI**-tagged phrases as text only, no AI voice | | |
| I-36 Drop / reconnect | in call | A: airplane 10 s → off | both "Connection lost. Trying again…"; audio back within ~30 s or a clear end after 60 s | | |
| I-37 Background / lock | in call | A: lock 20 s, unlock; then switch app and back | audio continues or reconnects; no stuck screen | | |
| I-38 Reload | in call | A: reload the page | partner page shows "Your live practice with B is open" → Return to the call reconnects, or B sees "A left" | | |
| I-39 Leave / finish | in call | A: Leave (Finish after round 4) | A "You left…"; B "A left the live practice" within ~5 s; both mic indicators off; connection card back | | |
| I-40 Block in call | new call | B: menu → Block → confirm | B's call ends instantly; A sees "left"; A can no longer invite B | | |
| I-41 Report in call | new call | A: menu → Report → reason | "reported"; call continues; row in `audit` | | |
| I-42 Connect (Wi‑Fi/cellular) | one phone on 4G/5G | repeat I-34 | connects **only if TURN is configured**; otherwise "Still connecting… some phone networks block direct calls" after 45 s — record which | | |

### 5. Welding isolation (same phone)
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-43 UI | **all flags ON**, switch area to Welding | Practice, Home, `#partner`, Shadow clip, Apply tab | no Practice Partner card, no Home partner card, `#partner` = "part of General English" notice with no fetch, no Shadow V2 panel, no Apply → Partner; the Welding role-play/simulation cards unchanged | | |
| I-44 API | Safari console (token from `FBUser.getIdToken()`) | `POST /interest` track welding; `POST /ai/session` track welding; `POST /live`; `GET /live/<id>`; `GET /turns/<id>/audio` | `{error:"track"}`, `{error:"track"}`, 404, 403, 404/403 | | |
| I-45 Flags off | General English, remove `be_flags`, reload | Practice, Home, `#partner`, Shadow | nothing partner-related; `#partner` unavailable; no Shadow V2 (production default) | | |

### 6. Network and recovery
| ID | Precondition | Action | Expected | P/F | Notes |
|---|---|---|---|---|---|
| I-46 Async send offline | take ready | airplane → Send | "offline" message, take kept; airplane off → Send → one turn | | |
| I-47 Mic denial | Safari site settings → Deny | Record | app's own "microphone denied" toast, no blank | | |
| I-48 Mic interruption | recording | receive a call | recording stops cleanly; take kept or "too short" | | |
| I-49 Logout / login | in a session | sign out → in | sign-in card while out; thread restored | | |
| I-50 Layout | every screen above | | nothing behind the bottom nav; sheets scroll; buttons tappable; RTL (Arabic) does not overflow | | |

## Android Chrome — model ______ Android ______ Chrome ______ · network: ______
Copy the 50 rows above as `A-01 … A-50`. Android-specific: A-09 Chrome mic prompt and `audio/webm`; A-34 inline audio with media volume; A-37 recent-apps switch as well as lock.

## Result summary (owner fills in)
- iPhone: __ / 50 — blocking failures: ______
- Android: __ / 50 — blocking failures: ______
- TURN configured on staging: yes / no — I-42 / A-42 result: ______
- Date, tester, staging Worker version (`/health` + `wrangler deployments list --env staging`): ______
