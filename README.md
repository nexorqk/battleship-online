# Battleship Online

A TypeScript monorepo for a browser-based two-player Battleship game. Two players join the same game session through a shareable link and play in real time as guests.

## MVP Scope

The MVP supports:

- Creating a game
- Joining a game by link
- Guest player tokens
- Ship placement
- Ready state
- Turn-based shots
- Hit, miss, and sunk results
- Win and loss state
- Realtime updates for both players

The MVP intentionally does not include:

- User registration
- OAuth
- Matchmaking
- Ratings
- Chat
- Payments
- AI opponents
- Complex animations
- Mobile polish
- Kubernetes
- Microservices

## Stack

- `apps/web`: React, Vite, TypeScript
- `apps/api`: Fastify, Socket.IO, TypeScript
- `packages/db`: Prisma, PostgreSQL
- `packages/game-core`: pure TypeScript game rules
- `packages/shared`: shared DTOs and realtime event types
- Tests: Vitest and Playwright

## Architecture

The server is authoritative.

The client:

- Renders boards and local UI state
- Stores only its own `playerToken`
- Sends commands for ship placement, ready state, and shots
- May highlight local selections before submission
- Must receive final game state from the server
- Must never receive enemy ship coordinates

The server:

- Stores the complete game state
- Validates all placements and shots
- Enforces turn order
- Rejects duplicate shots
- Computes hit, miss, sunk, win, and loss results
- Sends each player a personalized `PlayerGameView`
- Uses DB transactions for state-changing actions
- Uses `Game.version` to reject stale shot submissions

Game rules must live in `packages/game-core`. That package must stay pure, deterministic, framework-independent, and must not mutate inputs.

## Hidden Information

A player's view may include:

- Their own ships
- Shots received on their board
- Shots they fired at the opponent
- Hit, miss, and sunk results for their own shots

A player's view must not include:

- Unhit enemy ship coordinates
- Raw full `GameState`
- The opponent's `PlayerBoard.ships`

## Repository Layout

```txt
apps/
  api/                 Fastify and Socket.IO backend
  web/                 React and Vite frontend
packages/
  db/                  Prisma schema and client
  game-core/           Pure Battleship rules
  shared/              DTOs and realtime event contracts
e2e/                   Playwright flow tests
```

## Gameplay Rules

- Board size is 10x10.
- Coordinates use `x` and `y` values from `0` to `9`.
- Ships must be straight: horizontal or vertical.
- Ships must not overlap.
- In the MVP, ships may touch each other.
- A hit does not grant an extra turn.
- The winner is the first player to sink all opponent ships.
- There is no registration.
- `playerToken` is stored in `localStorage`.

## Quick Start

```bash
cp .env.example .env
docker compose up -d postgres

pnpm install
pnpm db:generate
pnpm db:migrate

pnpm dev
```

After startup:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Postgres: `localhost:5432`

## Development Commands

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm dev
```

There are currently no root `lint` or `format` scripts. Add and run them before committing if the project introduces them.

## Manual Verification

1. Open `http://localhost:5173`.
2. Click **Create game**.
3. Copy the invite link.
4. Open the link in a second browser window or browser profile.
5. Click **Auto-place ships** in both clients.
6. Click **Ready** in both clients.
7. Player A fires at Player B's board.
8. Player B sees the shot on their own board.
9. Player A sees the hit or miss result on the enemy board.

Run or update E2E tests only after this basic two-browser flow works.

## Environment

Copy `.env.example` to `.env` for local development.

Key variables:

- `DATABASE_URL`: local Prisma/PostgreSQL connection string
- `API_DATABASE_URL`: PostgreSQL connection string used by the Docker API service
- `API_PORT`: API port, default `4000`
- `WEB_ORIGIN`: allowed web origin for the API
- `VITE_API_URL`: browser API URL
- `VITE_SOCKET_URL`: browser Socket.IO URL
- `AUTO_SHOT_TIMEOUT_MS`: optional server-side automatic shot timeout
- `VITE_TURN_TIMER_SECONDS`: optional UI timer value when automatic shots are enabled
- `WEB_PORT`: Docker web port, default `5173`

## Docker

For a full containerized stack:

```bash
cp .env.example .env
docker compose up --build
```

The compose setup starts PostgreSQL, the API, and the web app. The API container runs deployed Prisma migrations before starting.

## Development Priorities

Recommended order:

1. Make the repository installable.
2. Make Prisma generation and migration work.
3. Make `game-core` tests pass.
4. Make API typecheck pass.
5. Make web typecheck pass.
6. Make a two-browser manual session work.
7. Add or fix E2E tests only after the manual flow works.

## Future Ideas

Good next steps after the MVP:

1. Improve manual ship placement.
2. Add drag and drop.
3. Add reconnect after page reload.
4. Add a turn timer.
5. Add spectator mode.
6. Add game history.
7. Add authentication.
8. Add matchmaking.
9. Add ratings.
