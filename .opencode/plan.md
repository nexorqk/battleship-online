# Plan: UI & Design Polish

## Objective

Improve the Battleship Online UI by extracting monolithic inline components, adding loading skeletons, polishing animations, improving mobile experience, and cleaning up visual details — all without adding external UI framework dependencies.

## Requirements Snapshot

- **R1:** `GamePage.tsx` (782 lines) must be broken up — inline components extracted to `components/`
- **R2:** Loading state must use skeleton placeholders (board-shaped) instead of a generic spinner
- **R3:** Visual feedback on hit/miss/sunk must be more satisfying (splash effect, smoother transitions)
- **R4:** Mobile layout at ≤768px must be more usable (boards shouldn't feel squished)
- **R5:** Turn timer should show a subtle pulsing border on the active board
- **R6:** All changes must stay within existing stack (hand-rolled CSS, no new dependencies)
- **R7:** Game logic, types, and server must not be touched

## Scope

- Extract `GameOverOverlay`, `ShipStatusBadge`, `TurnIndicator` into standalone component files
- Replace loading spinner with board skeleton (grey cell grid)
- Add water-splash animation on shot impact (CSS-only)
- Add active-turn glow border on the enemy board
- Improve mobile layout: stack boards vertically, shrink padding, optimise topbar
- Minor polish: smoother hover states, better cell transitions
- Update `styles.css` to keep everything consistent

## Assumptions and Constraints

- No new npm packages — all CSS stays hand-rolled
- No changes to `game-core`, `shared`, `db`, or `api` packages
- All existing tests must still pass
- The existing naval/radar design language is preserved and enhanced, not replaced

## Risks and Areas Requiring Care

- Extracting components from `GamePage.tsx` could introduce prop-drilling issues — keep props explicit
- CSS selector specificity conflicts when moving styles — use unique class names per component
- Mobile layout changes must not break the placement interaction (drag-to-place via click)

## Sub-Tasks

### Sub-Task 1: Extract Inline Components into Separate Files

- **Status:** Pending
- **Objective:** Move `GameOverOverlay`, `ShipStatusBadge`, and `TurnIndicator` from `GamePage.tsx` into their own files under `components/`
- **Related Requirements:** R1
- **Dependencies and Preconditions:** None
- **In Scope for This Sub-Task:**
  - Create `components/GameOverOverlay.tsx` with its CSS classes (already in `styles.css`)
  - Create `components/ShipStatusBadge.tsx` with its CSS classes (already in `styles.css`)
  - Create `components/TurnIndicator.tsx` — extract the turn indicator block (turn-dot + turn-text + timer) into its own component
  - Import all three in `GamePage.tsx` and replace the inline definitions
  - Each component gets its own props interface, clearly typed
- **Out of Scope for This Sub-Task:**
  - No visual changes — pure extraction
  - No CSS changes (classes already exist)
  - No behaviour changes
- **Instructions:**
  1. Read `GamePage.tsx` fully (already done above)
  2. Create `GameOverOverlay.tsx` — copy the `GameOverOverlay` function as-is, add a named export
  3. Create `ShipStatusBadge.tsx` — copy the `ShipStatusBadge` function as-is, add a named export
  4. Create `TurnIndicator.tsx` — extract lines ~607-661 from GamePage.tsx (the `.turn-indicator` block including the timer) into its own component that accepts `view`, `player`, `isMyTurn`, `isFinished`, `timeLeft` props
  5. In `GamePage.tsx`, remove the three inline function definitions and add imports
- **Acceptance Criteria:**
  - `GamePage.tsx` is significantly shorter (removed ~150 lines)
  - Three new component files exist
  - App compiles and runs identically
- **Cautionary Points:**
  - `TurnIndicator` currently reads `TURN_TIMEOUT_SEC` — pass it as a prop or export the constant
  - `GameOverOverlay` uses `totalShips` — pass as prop
- **Implementation Suggestions:** Keep each component in a single file with its TS types at the top. Do NOT split CSS into per-component files — keep all styles in `styles.css` for now.
- **Testing Suggestions:** `pnpm typecheck` and `pnpm dev` — visually verify game over overlay, ship status, and turn timer still work
- **Done When:** Three component files exist, `GamePage.tsx` imports them, typecheck passes, visual behaviour unchanged

### Sub-Task 2: Add Board-Shaped Loading Skeleton

- **Status:** Pending
- **Objective:** Replace the generic spinner on the loading screen with a skeleton that looks like a dim Battleship board grid, giving the user a visual preview of what's coming
- **Related Requirements:** R2
- **Dependencies and Preconditions:** None
- **In Scope for This Sub-Task:**
  - Create a CSS-only skeleton grid (10×10 cells + labels) that mirrors the real board layout
  - Show two skeleton boards side-by-side (matching the `boards-wrapper` grid)
  - Add a subtle shimmer animation across the skeleton cells
  - Replace the `<div className="loading-state">` block in `GamePage.tsx` (lines ~518-527)
  - Keep the loading text but reduce its prominence
- **Out of Scope for This Sub-Task:**
  - No JS state for skeletons — purely CSS
  - No per-cell shimmer — just a group animation
- **Instructions:**
  1. Add `.skeleton-grid` and `.skeleton-cell` classes in `styles.css`
  2. Use a CSS `@keyframes shimmer` that animates a linear-gradient across the grid
  3. Replace the loading state in `GamePage.tsx`: render two `.board-section` divs each containing a `.board-grid.skeleton-grid` with 10×10 static cells + labels (no interactivity)
  4. Use `aria-hidden="true"` since skeletons are decorative
- **Acceptance Criteria:**
  - Loading screen shows two placeholder board grids with a shimmer animation
  - When view loads, skeletons are replaced by real boards (standard React conditional render — already handled)
  - No regressions on the existing loading states (join error, invalid game)
- **Cautionary Points:** Keep the skeleton purely decorative — don't add any JS logic or click handlers
- **Implementation Suggestions:** Use a simple `for` loop with `Array.from` to render 100 skeleton cells, similar to how `Board.tsx` renders real cells
- **Testing Suggestions:** `pnpm dev`, open a game, observe the skeleton before the view loads. Also test joining a game.
- **Done When:** Loading state shows board skeletons, shimmer animation plays, real boards replace them on load

### Sub-Task 3: Add Water Splash / Impact Animation

- **Status:** Pending
- **Objective:** Add a CSS water-splash animation on shot impacts (hit/miss/sunk) to make feedback feel more responsive and satisfying
- **Related Requirements:** R3
- **Dependencies and Preconditions:** None
- **In Scope for This Sub-Task:**
  - Add a `.cell.splash` animation class that plays on newly-shot cells
  - Miss: concentric ripples radiating outward (like water rings)
  - Hit: a quick upward burst (like water spray) then settle into the red hit state
  - Sunk: slow deep ripple with debris effect
  - Add a `data-shot-time` attribute or use a CSS `animation-delay` trick so animations don't all replay on re-render
  - Actually, simplest approach: add a `shotIndex` counter that increments on each new shot, and use it to apply a small random delay via inline style
- **Out of Scope for This Sub-Task:**
  - No JS animation libraries or canvas — CSS only
  - No particle effects
- **Instructions:**
  1. In `styles.css`, add `@keyframes splash-miss` (expanding circle + fade), `@keyframes splash-hit` (vertical spray + flash), `@keyframes splash-sunk` (slow turbulent fill)
  2. Add `.cell.hit.splash`, `.cell.miss.splash`, `.cell.sunk.splash` classes
  3. In `Board.tsx`, accept an optional `shotIndex` prop (or derive it from shots length change) to stagger animation timing
  4. In `GamePage.tsx`, track `prevShotCount` ref for each board to detect new shots and toggle the splash class
- **Acceptance Criteria:**
  - When a shot lands (hit/miss/sunk), a brief splash/ripple animation plays on the cell
  - Animation only plays once per shot (not on re-renders)
  - Animation feels smooth and matches the existing naval theme
- **Cautionary Points:**
  - Must not interfere with the existing `hit-flash`, `miss-ripple`, `ship-sunk` animations — replace or layer them
  - Splash animation should be quick (< 600ms) so it doesn't delay gameplay
  - Ensure animations don't replay when the board re-renders (use a ref to track known shots)
- **Implementation Suggestions:** Keep it simple: a single `shotIndex` counter in GamePage that increments each time a new unique shot key appears. Pass it to Board, use inline `--delay` CSS var to stagger. The splash CSS class auto-removes after animation ends (use `animation-fill-mode: forwards` + `@keyframes` that ends at the normal cell state).
- **Testing Suggestions:** Fire shots in a two-browser session, verify each hit/miss/sunk shows a brief splash animation
- **Done When:** Every shot produces a unique water-splash animation that doesn't repeat on re-render

### Sub-Task 4: Active-Turn Board Glow + Polish

- **Status:** Pending
- **Objective:** Add a subtle pulsing border glow on the enemy board when it's your turn (signalling "click here to shoot") and polish hover/click feedback
- **Related Requirements:** R5
- **Dependencies and Preconditions:** None
- **In Scope for This Sub-Task:**
  - Add `.board-section.enemy-board.active-turn` class that shows a pulsing amber/teal border glow (using the existing `pulse-glow` or a new keyframe)
  - In `GamePage.tsx`, conditionally add `active-turn` class to the enemy board section when `canShoot` is true
  - Tighter hover state on enemy cells: show a crosshair reticle SVG or brighter highlight
  - Slight scale pulse on the turn-indicator dot when it's your turn (stronger than current)
- **Out of Scope for This Sub-Task:**
  - No audio cues
  - No screen shake
- **Instructions:**
  1. Add `.board-section.enemy-board.active-turn` rule in `styles.css` with `animation: pulse-glow 2s ease-in-out infinite` and a brighter border color
  2. In `GamePage.tsx`, the enemy `<Board>` sits inside `<div className="board-column">` — wrap it in a `<section>` that gets the class, or add the class to the `board-section` inside `Board.tsx` via a prop
  3. Update `Board.tsx` to accept an `activeTurn` boolean prop and apply it to `.board-section`
  4. Update the `.cell.clickable` hover in CSS to be slightly more prominent (brighter teal, tighter shadow)
- **Acceptance Criteria:**
  - When it's your turn, the enemy board section has a pulsing border glow
  - When it's not your turn, no glow
  - Hovering over clickable cells feels more responsive
- **Cautionary Points:** Don't make the glow too bright — it should be subtle and atmospheric, not distracting
- **Implementation Suggestions:** Use the existing `pulse-glow` keyframe with a teal shadow on `.board-section.enemy-board.active-turn`. The `activeTurn` prop is simply `canShoot`.
- **Testing Suggestions:** Play a two-browser game, verify the glow appears on the correct board during your turn and disappears when it's the opponent's turn
- **Done When:** Active board glows, inactive does not, hover state is improved

### Sub-Task 5: Mobile Layout Optimisation

- **Status:** Pending
- **Objective:** Make the game more comfortable to play on narrow screens (≤768px and ≤400px)
- **Related Requirements:** R4
- **Dependencies and Preconditions:** None
- **In Scope for This Sub-Task:**
  - Single-column layout (already works at ≤960px) — improve padding/margins at ≤768px
  - Topbar: stack elements more efficiently; hide the version number on very small screens; shorten game ID display
  - Board cells: at ≤400px, cells are 26px — make sure labels and hit/miss markers are still readable
  - Fleet palette: stack ship buttons 2-wide instead of wrapping inline
  - Turn indicator: make the timer ring smaller on mobile
  - Game over overlay: reduce padding, make stats 2-column layout
  - Notification toasts: position them top-center (not right) on mobile so they don't overflow
- **Out of Scope for This Sub-Task:**
  - No touch gesture support (clicking is fine for MVP)
  - No landscape-specific layout
- **Instructions:**
  1. In the existing `@media (max-width: 768px)` block in `styles.css`:
     - Reduce `topbar-info` gap further
     - Add `display: none` for `.topbar-version` at ≤550px
     - Reduce `.overlay-card` padding from `48px 56px` to `28px 24px`
     - Make `.overlay-stats` flex-wrap with smaller gaps
     - Move `.notif-stack` to `top: 10px; left: 50%; transform: translateX(-50%)` on mobile
  2. Add a new `@media (max-width: 480px)` breakpoint:
     - `.palette-ships` uses `grid-template-columns: 1fr 1fr` instead of flex wrap
     - `.turn-timer` shrinks the SVG ring to 28px
     - `.topbar-tag` font-size shrinks to 0.7rem
     - `.board-grid` labels font-size shrinks
- **Acceptance Criteria:**
  - Game is playable and readable on a 375px-wide screen (iPhone SE size)
  - No horizontal overflow
  - All controls (shoot, place ships, ready) are tappable
- **Cautionary Points:** Don't break the existing 960px breakpoint. Test on real mobile widths using Chrome DevTools device emulation.
- **Implementation Suggestions:** Use Chrome DevTools responsive mode and test at 375px, 414px, 768px. Fix each overflow or squish issue one at a time.
- **Testing Suggestions:** Open DevTools responsive mode, verify the game is playable at 375px width
- **Done When:** The game renders and is playable without horizontal scroll on screens as narrow as 320px

### Sub-Task 6: Visual Detail Polish

- **Status:** Pending
- **Objective:** Small visual refinements that make the UI feel more polished without major changes
- **Related Requirements:** R3, R5
- **Dependencies and Preconditions:** Sub-Task 1 (component extraction avoids merge conflicts)
- **In Scope for This Sub-Task:**
  - Replace unicode "○" and "✕" in board cells with small inline SVGs for crisper rendering at all sizes
  - Add a subtle grid-line pattern inside the board sections (like naval plotting paper)
  - Smooth the transition between placement phase and active phase (fade boards out/in)
  - Add a brief "enemy is placing ships" indicator (animated dots) while waiting in waiting phase
  - Tweak the `.cell` border-radius to be slightly smaller for a tighter look
- **Out of Scope for This Sub-Task:**
  - No new fonts, icons, or images
  - No major layout changes
- **Instructions:**
  1. Replace the text `○` and `✕` in `Board.tsx`'s `cellLabel()` function with tiny SVGs (like `cell-miss-dot` and `cell-hit-x` already existing but using text)
  2. Add a subtle CSS background pattern to `.board-section` like repeating dots or a grid (use a small SVG data-URI or CSS repeating-gradient)
  3. Add a CSS transition on `.boards-wrapper` for phase changes (opacity or transform)
  4. Add a `.waiting-dots` animation for the "Waiting for opponent" text in the turn indicator (three bouncing dots)
  5. Fix any visual inconsistency: ensure all button hover states use the same transition timing
- **Acceptance Criteria:**
  - Hit/miss markers render as crisp SVGs at all screen sizes
  - Board sections have a subtle plotting-grid background
  - Phase transitions feel smoother
  - Waiting state has animated dots
- **Cautionary Points:** Keep SVG icons tiny and inline — no external icon sets
- **Implementation Suggestions:** The hit/miss SVGs can be very simple: a 6px circle for miss (replacing `○`), a 12px X for hit (replacing `✕`). Draw them with pure SVG paths.
- **Testing Suggestions:** Review at 1x, 2x display resolutions. Compare before/after.
- **Done When:** All visual polish items are applied, review passes, no regressions

## Final Integration & Verification

- **System-Wide Test:** Play a complete two-browser game:
  1. Create game → verify skeleton shows on loading
  2. Share link → join → verify both see boards
  3. Place ships → verify placement interaction works
  4. Ready → verify phase transition animation
  5. Shoot → verify splash animation + board glow
  6. Complete game → verify game over overlay
  7. Resize to 375px → verify mobile layout
- **Completion Checklist:**
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm test` passes (game-core and web tests)
  - [ ] Three new component files in `apps/web/src/components/`
  - [ ] No new npm dependencies
  - [ ] Game works in two-browser manual test
  - [ ] Mobile layout is usable at 375px

## Open Questions

- None — scope is well understood from reading the existing codebase.
