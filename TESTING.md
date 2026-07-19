# BE Mastery — Full Functionality Test Checklist

Run through this before the Play Store submission. Best environment: **Chrome on
a phone or laptop** at https://salomon1010.github.io/Business-English/ (mic +
speech recognition need Chrome/Edge; HTTPS or localhost required).
To retest first-launch behavior, clear the site's storage first
(Chrome → ⋮ → Settings → Site settings → salomon1010.github.io → Clear data).

## 1. First launch & onboarding
- [ ] Fresh visit shows the 5-step onboarding (logo, name, role, goal, daily slot)
- [ ] Entering a name then completing all steps lands on the Dashboard
- [ ] Your name, role, goal and slot appear in the Dashboard hero text
- [ ] Refreshing does NOT show onboarding again

## 2. Dashboard (Home)
- [ ] Streak flame in the top bar shows correct day count
- [ ] "Continue where you left off" card points to the first unfinished session
- [ ] "Start today's 25-minute session" opens that session page
- [ ] Progress ring shows % of 84 sessions; phase bars (Foundation/Fluency/Executive) match

## 3. 12-Week Journey (Weeks)
- [ ] All 12 week cards render with theme, phase badge and 7 day-dots
- [ ] Tapping a week opens its day list; completed days show ✓
- [ ] Tapping a day opens the session page

## 4. Daily session page
- [ ] 25:00 timer: Start counts down, Reset restores
- [ ] Minute-by-minute template checkboxes persist after leaving and returning
- [ ] 🎙 Record works (allow mic): live transcription appears while speaking
- [ ] Feedback report appears after stopping: score, per-word playback, grammar "did well / can improve", pace
- [ ] Self-score 1–10 buttons save (highlighted on return)
- [ ] "Mark session complete" toggles ✓, updates Dashboard % and streak
- [ ] Notes field saves text across refresh

## 5. Shadowing Studio
- [ ] Paste any YouTube URL → Load video works
- [ ] The curated starter videos load via "Shadow this"
- [ ] Mark start/end → clip loops automatically between marks
- [ ] Speed control changes playback rate
- [ ] Record-yourself + feedback works; attempt counter increments per clip
- [ ] Waveform comparison: after 2+ takes, new take is layered over previous with pause/pacing insights
- [ ] Saved clip and recordings survive a page refresh
- [ ] Curated channel links open

## 6. Posture Coach
- [ ] Enabling it asks for camera and shows the glowing avatar (allow camera)
- [ ] Avatar turns green when upright, orange when slouching/tilting
- [ ] Ring-light mode brightens the screen in the dark
- [ ] Disabling stops the camera (browser camera indicator turns off)

## 7. Speaking feedback (with a target script)
- [ ] Type/paste a target script, record reading it → word-by-word score with missed words highlighted
- [ ] Missed word: 🔊 example audio, slow-motion playback, say-it-again drill
- [ ] Grammar corrections show with "hear the correct version"
- [ ] Pace shown vs the 140–160 wpm zone; filler words counted
- [ ] Trouble words appear in the gym and can be cleared by re-saying them

## 8. Vocabulary
- [ ] Key words extracted from your speech appear with CEFR level
- [ ] Dictionary definition + real audio play per word
- [ ] Save word → appears in My vocabulary; save-all works
- [ ] Say-the-word quiz plays hints and scores your pronunciation
- [ ] Synonym upgrades suggested for basic words

## 9. Phrases & Executive Polish
- [ ] Week filter chips (W1–W12) switch phrase sets; "All mastered" filter works
- [ ] Per phrase: record, "My example" text saves, Mark mastered toggles
- [ ] Executive Polish: type or dictate a casual sentence → polished version with change list
- [ ] 🔊 Hear the polished version

## 10. Progress Studio (Progress)
- [ ] "Your story this week" narrative matches your real activity
- [ ] Stat tiles: words spoken, best score, latest wpm, vocab count
- [ ] Charts render: score journey, vocabulary growth, pace gauge, 14-day activity
- [ ] Weekly self-score sliders + written review save per week

## 11. Account (More → Account)
- [ ] Profile edits (name/role/goal/slot) save and update the Dashboard hero
- [ ] About card shows v1.0.0, Lomonec LLC, Support / Privacy / Manual links work
- [ ] Export backup downloads a JSON; import restores it
- [ ] GitHub sync (optional): token connect, upload/download recordings
- [ ] "Delete all data" wipes progress and returns to onboarding

## 12. PWA / offline / mobile
- [ ] Chrome shows an install prompt (or ⋮ → Add to Home screen); installed app opens fullscreen with the logo icon
- [ ] After one full load, airplane mode still opens the app (recordings/progress intact; YouTube needs network)
- [ ] Phone layout: bottom nav (Home/Weeks/Shadow/Phrases/Progress/More) works; More sheet opens Account/Manual/About
- [ ] Manual and flyer pages open; footer shows © 2026 Lomonec LLC everywhere

## Known platform limits (not bugs)
- Speech recognition: Chrome/Edge only (not Firefox; Safari partial)
- BlueStacks: TWA splash may hang without Chrome installed in the emulator
- iOS Safari: install via Share → Add to Home Screen; mic works, recognition may be limited
