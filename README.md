# Battleship Online — Codex Template

Шаблон для браузерной игры **«Морской бой»** с 1v1-сессиями по ссылке.

Стек:

- Frontend: React + Vite + TypeScript
- Backend: Fastify + TypeScript
- Realtime: Socket.IO
- DB: PostgreSQL + Prisma
- Game engine: чистый TypeScript-пакет `packages/game-core`
- Shared contracts: `packages/shared`
- Tests: Vitest + Playwright placeholder

## Главная идея архитектуры

Сервер является источником истины.

Клиент:

- рисует доски;
- хранит только свой `playerToken`;
- отправляет команды: расстановка кораблей, ready, выстрел;
- не знает координаты кораблей противника.

Сервер:

- хранит полное состояние игры;
- проверяет корректность расстановки;
- проверяет очередность хода;
- запрещает повторный выстрел по одной клетке;
- считает попадания, промахи, потопления и победу;
- отправляет каждому игроку персонализированный `PlayerGameView`.

## Структура

```txt
apps/
  api/                 # Fastify + Socket.IO backend
  web/                 # React + Vite frontend
packages/
  db/                  # Prisma schema/client
  game-core/           # чистая игровая логика
  shared/              # DTO/events между API и WEB
```

## Быстрый старт

```bash
cp .env.example .env
docker compose up -d

pnpm install
pnpm db:generate
pnpm db:migrate

pnpm dev
```

После запуска:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Postgres: `localhost:5432`

## Как проверить вручную

1. Открой `http://localhost:5173`.
2. Нажми **Create game**.
3. Скопируй ссылку на игру.
4. Открой ссылку во втором окне/браузере.
5. На обоих клиентах нажми **Auto-place ships**.
6. На обоих клиентах нажми **Ready**.
7. Первый игрок стреляет по доске противника.
8. Второй игрок должен увидеть выстрел на своей доске.
9. Первый игрок должен увидеть результат на доске противника.

## Важные правила MVP

- Доска 10×10.
- Координаты: `x` и `y` от `0` до `9`.
- Корабли должны быть прямыми: горизонтальными или вертикальными.
- Корабли не должны пересекаться.
- В MVP корабли могут касаться друг друга.
- Попадание не дает дополнительный ход.
- Побеждает игрок, который потопил все корабли противника.
- Регистрации нет.
- `playerToken` хранится в `localStorage`.

## Что просить у Codex после распаковки

Открой проект в VS Code/Cursor/Zed и передай Codex задачу:

```txt
Read AGENTS.md and README.md first.
Then inspect the full repository.
Run typecheck and tests.
Fix any TypeScript, Prisma, Socket.IO, or Vite integration issues.
Do not add authentication, matchmaking, chat, ratings, payments, or an AI opponent.
Keep the server authoritative and preserve hidden enemy ship state.
After fixes, provide a short summary of changed files and commands to run.
```

## Что развивать дальше

Хороший следующий порядок:

1. Довести запуск без ошибок.
2. Улучшить ручную расстановку кораблей.
3. Добавить drag-and-drop.
4. Добавить reconnect после перезагрузки страницы.
5. Добавить таймер хода.
6. Добавить spectator mode.
7. Добавить историю партий.
8. Добавить auth.
9. Добавить matchmaking.
10. Добавить рейтинг.
