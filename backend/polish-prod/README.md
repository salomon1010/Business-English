# Production be-polish: the game route only (10 Oct 2026)

The owner chose "games only, everyone Free" for app.lomonec.com. Production be-polish
ran code from 1 October that is **older than the repo**. A full deploy of
`backend/polish-worker.js` would also release three things the owner has not decided on:
the AI metering (Free 3 verdicts a day), the YouTube Premium trial and the tiers.

So production runs **its own previous code unchanged**, wrapped by `entry.js`:
- A `{ "wm": … }` body goes to the game route (`backend/wm-game.js`). Energy, round
  tickets and XP are stored in the `RateLimiter` Durable Object (`backend/rate-limit.js`).
- Every other request goes to the old code, exactly as before.
- Accounts are verified by **be-entitlements** (production, deployed 10 Oct 2026). It has
  no store secrets, so every account is Free (5 challenge rounds a day per programme).
- The programme comes from **be-partner** `GET /programme`.
- `global_fetch_strictly_public` is required: without it, one workers.dev Worker cannot
  call another.

Checked live with a throwaway production account (created, then deleted):
- Welding and General English each get status 200, Free, 5 energy.
- A round starts with a ticket and is charged once.
- A programme mismatch answers 403 `track`.
- Switching programme is recognised at once (G13b).

Rollback: `npx wrangler rollback caedf3fe-f25e-42ca-8465-554f5ea6e992` (the version
before the game route). The Durable Object and the variables can stay; the old code
ignores them.
