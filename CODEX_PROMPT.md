# Prompt to paste into Codex

Read `AGENTS.md` and `README.md` first.

Then inspect the repository and make this MVP runnable:

- Install dependencies with pnpm.
- Generate Prisma client.
- Run migration against local PostgreSQL.
- Run typecheck and tests.
- Fix TypeScript, module-resolution, Prisma, Socket.IO, Fastify, Vite, or React issues.
- Preserve the current architecture:
  - server-authoritative gameplay;
  - hidden enemy ships;
  - pure rules in `packages/game-core`;
  - personalized player views;
  - no auth/matchmaking/chat/rating/payment/AI opponent yet.

After fixes, provide:

1. Commands to run the project.
2. Files changed.
3. Remaining risks or TODOs.
