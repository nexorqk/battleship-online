# AGENTS.md — Codex Instructions

You are working on a TypeScript monorepo for a browser-based two-player Battleship game.

## Product goal

Build a browser game where two players can play Battleship in the same session through a shareable link.

The MVP must support:

- Create game
- Join game by link
- Guest player tokens
- Ship placement
- Ready state
- Turn-based shots
- Hit/miss/sunk result
- Win/loss state
- Realtime updates to both players

## Non-negotiable architecture constraints

1. The server is authoritative.
2. The client must never receive the enemy ship coordinates.
3. Game rules must live in `packages/game-core`.
4. `packages/game-core` must remain pure and framework-independent.
5. Backend must validate all placements and shots.
6. Backend must use DB transactions when accepting state-changing actions.
7. `Game.version` must be used to reject stale shot submissions.
8. Frontend may do local UI selection/highlighting, but final game state must come from the server.

## Current stack

- `apps/web`: React + Vite + TypeScript
- `apps/api`: Fastify + Socket.IO + TypeScript
- `packages/db`: Prisma + PostgreSQL
- `packages/game-core`: pure game logic
- `packages/shared`: shared DTOs and realtime event types

## Do not add yet

Do not add these features during the MVP unless explicitly requested:

- user registration
- OAuth
- matchmaking
- rating
- chat
- payments
- AI opponent
- complex animations
- mobile polish
- Kubernetes
- microservices

## Expected commands

Use these commands while working:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm typecheck
pnpm test
pnpm dev
```

## Development priorities

Work in this order:

1. Make the repository installable.
2. Make Prisma generation and migration work.
3. Make `game-core` tests pass.
4. Make API typecheck pass.
5. Make WEB typecheck pass.
6. Make a two-browser manual session work.
7. Add or fix E2E test only after the basic manual flow works.

## Hidden information rule

A player's view may include:

- their own ships;
- shots received on their board;
- shots they fired at the opponent;
- hit/miss/sunk results for their own shots.

A player's view must not include:

- unhit enemy ship coordinates;
- raw full `GameState`;
- opponent `PlayerBoard.ships`.

## Code style

- Prefer explicit types.
- Keep pure functions deterministic.
- Do not mutate inputs in `game-core`.
- Avoid overengineering.
- Keep the MVP small.
- Add tests before expanding rules.
- Keep API errors clear and predictable.
