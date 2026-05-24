# AGENTS.md

Read `README.md` first for project scope, architecture, setup, and manual test flow.

Before committing or handing off changes:

- Keep `package.json` and `pnpm-lock.yaml` in sync after dependency changes.
- Run `pnpm install` when dependencies change.
- Run `pnpm db:generate` and `pnpm db:migrate` when Prisma schema or migrations change.
- Run `pnpm typecheck`.
- Run `pnpm test`.
- Run `pnpm test:e2e` when the manual game flow or E2E coverage changes.
- Run lint and format commands if they are added to the repo.

Keep this file minimal. Put project details in `README.md`.
