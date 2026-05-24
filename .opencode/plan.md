# Plan: Complete 5 MVP Enhancements

## Objective

Ship 5 improvements to the Battleship Online MVP: game over overlay, ship status tracking, reconnection polish, turn timer, and E2E tests.

---

## Sub-Tasks

### Sub-Task 1: Game Over Overlay

- **Status:** Pending
- **Objective:** Full-screen victory/defeat screen when game finishes
- **Files to modify:** `apps/web/src/pages/GamePage.tsx`, `apps/web/src/styles.css`
- **Instructions:**
  - Create `<GameOverOverlay>` as a fixed-position overlay
  - Show when `view.phase === "finished"`
  - Display: winner announcement, "VICTORY"/"DEFEAT" banner with animations
  - Show fleet stats (your ships remaining vs opponent ships sunk)
  - "New Game" button that navigates to `/`
  - Animated backdrop entrance (fade + scale)
- **Acceptance Criteria:** Overlay appears on win/loss, dismissable with "New Game"

### Sub-Task 2: Ship Status on Enemy Board

- **Status:** Pending
- **Objective:** Show which enemy ship types have been sunk
- **Files to modify:** `apps/web/src/pages/GamePage.tsx`, `apps/web/src/styles.css`
- **Instructions:**
  - From `view.enemyBoard.myShots`, compute which ships are sunk (detect consecutive sunk ShotResults)
  - Actually, we can't know ship layout from shots alone — but we CAN track which cells were `sunk`
  - Show a "Sunk ships" status panel: count sunk vs total (e.g., "3/10 ships sunk")
  - Use the fleet composition from `DEFAULT_FLEET` (4,3,3,2,2,2,1,1,1,1)
  - Each sunk ShotRecord indicates a ship was destroyed — count unique sunk events
  - Better approach: group shots with `result: "sunk"` — each sunk cluster = 1 ship
  - Show ship cards that turn red/crossed out when sunk
- **Acceptance Criteria:** Sunk ship count appears, ship cards show sunk status

### Sub-Task 3: Reconnection Polish

- **Status:** Pending
- **Objective:** Smoother reconnect experience after page refresh
- **Files to modify:** `apps/web/src/pages/GamePage.tsx`
- **Instructions:**
  - On socket `connect` (after initial join), if view already existed, show "Reconnected" toast
  - Track previous connection state with a ref to detect reconnection
  - Preserve placement state by restoring from `view.myBoard.ships` on reconnect
- **Acceptance Criteria:** Toast appears on reconnect, game state restores correctly

### Sub-Task 4: Turn Timer

- **Status:** Pending
- **Objective:** 60-second countdown per turn, auto-miss on timeout
- **Files to modify:** `apps/api/src/realtime.ts`, `apps/web/src/pages/GamePage.tsx`, `apps/web/src/styles.css`
- **Instructions (server):**
  - After each successful shot (or game:view with phase=active), start a 60s timer
  - When timer expires, auto-submit a random miss for the current player
  - Use a `Map<gameId, setTimeout>` for timer management
  - Timer resets on each valid shot
- **Instructions (client):**
  - Display countdown ring/bar in turn indicator
  - Countdown from 60s using `setInterval` synced to `view.version` changes
  - Visual urgency when < 10s (pulse red)
- **Acceptance Criteria:** Timer counts down, expires with miss notification

### Sub-Task 5: E2E Tests

- **Status:** Pending
- **Objective:** Playwright E2E test for the full game flow
- **Files to modify:** `e2e/` directory, `package.json`
- **Instructions:**
  - Install Playwright: `pnpm add -D @playwright/test --filter @battleship/web`
  - Create `e2e/game-flow.spec.ts`
  - Test: create game → join game → place ships (both) → ready (both) → shoot → verify hit/miss → finish game
  - Use two browser contexts (player A & B)
  - Add `e2e` script to root `package.json`
- **Acceptance Criteria:** `pnpm exec playwright test` passes consistently
