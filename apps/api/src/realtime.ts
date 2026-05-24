import type { FastifyInstance } from "fastify";
import { Server, type Socket } from "socket.io";
import {
  BOARD_SIZE,
  createPlayerView,
  markReady,
  placeShips,
  submitShot,
  type Cell,
  type GameState,
  type Role,
  type Ship,
} from "@battleship/game-core";
import type { ClientToServerEvents, ServerToClientEvents } from "@battleship/shared";
import { prisma } from "./db";
import { env } from "./env";
import { getRoleForToken, getState } from "./game-record";

const TURN_TIMEOUT_MS = 65_000; // 65 seconds (gives buffer over client's 60s display)

type InterServerEvents = Record<string, never>;
type SocketData = {
  gameId?: string;
  playerToken?: string;
  role?: Role;
};

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// ----- Turn Timer -----

const turnTimers = new Map<string, NodeJS.Timeout>();

function clearTurnTimer(gameId: string): void {
  const existing = turnTimers.get(gameId);
  if (existing) {
    clearTimeout(existing);
    turnTimers.delete(gameId);
  }
}

async function autoFireShot(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  gameId: string,
): Promise<void> {
  try {
    const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });

    if (game.status !== "active") return; // Game already ended

    const state = getState(game);
    const currentPlayer = state.currentTurn;
    const defender = currentPlayer === "playerA" ? "playerB" : "playerA";
    const defenderBoard = state.boards[defender];

    // Build a set of cells already shot
    const shotCells = new Set<string>();
    for (const shot of defenderBoard.shotsReceived) {
      shotCells.add(`${shot.target.x}:${shot.target.y}`);
    }

    // Find all valid cells
    const validCells: Cell[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        if (!shotCells.has(`${x}:${y}`)) {
          validCells.push({ x, y });
        }
      }
    }

    if (validCells.length === 0) return; // Board full — shouldn't happen

    // Pick a random cell
    const target = validCells[Math.floor(Math.random() * validCells.length)]!;

    // Process the shot
    const outcome = submitShot(state, currentPlayer, target);
    const nextVersion = game.version + 1;

    await prisma.shot.create({
      data: {
        gameId,
        playerId: `timer-auto-${currentPlayer}`,
        x: target.x,
        y: target.y,
        result: outcome.result,
        turnNumber: nextVersion,
      },
    });

    await prisma.game.update({
      where: { id: gameId },
      data: {
        state: outcome.state as never,
        status: outcome.state.phase,
        winner: outcome.winner,
        version: nextVersion,
      },
    });

    // Notify players
    io.to(roomName(gameId)).emit("shot:result", {
      target,
      result: outcome.result,
      nextTurn: outcome.state.currentTurn,
      version: nextVersion,
    });

    await emitViews(io, gameId);

    if (outcome.winner) {
      io.to(roomName(gameId)).emit("game:finished", { winner: outcome.winner });
    } else {
      // Schedule timer for the next turn
      scheduleTurnTimer(io, gameId);
    }
  } catch (error) {
    console.error(`[auto-shot] Failed for game ${gameId}:`, errorMessage(error));
  }
}

function scheduleTurnTimer(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  gameId: string,
): void {
  clearTurnTimer(gameId);
  const timer = setTimeout(() => autoFireShot(io, gameId), TURN_TIMEOUT_MS);
  turnTimers.set(gameId, timer);
}

/** Start the turn timer if the game is currently in "active" phase */
async function scheduleTurnTimerIfActive(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  gameId: string,
): Promise<void> {
  try {
    const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
    if (game.status === "active") {
      scheduleTurnTimer(io, gameId);
    }
  } catch {
    // Game not found — nothing to schedule (common race on cleanup)
  }
}

// ----- Realtime Setup -----

export function registerRealtime(app: FastifyInstance): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(app.server, {
    cors: {
      origin: env.webOrigin,
    },
  });

  io.on("connection", (socket: GameSocket) => {
    socket.on("game:join", async ({ gameId, playerToken }) => {
      try {
        const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
        const role = getRoleForToken(game, playerToken);

        socket.data.gameId = gameId;
        socket.data.playerToken = playerToken;
        socket.data.role = role;

        await socket.join(roomName(gameId));
        socket.emit("game:view", {
          ...createPlayerView(getState(game), role),
          version: game.version,
        });

        // Ensure turn timer is running if game is active
        await scheduleTurnTimerIfActive(io, gameId);
      } catch (error) {
        socket.emit("move:rejected", { reason: errorMessage(error) });
      }
    });

    socket.on("ships:place", async ({ gameId, playerToken, ships }) => {
      try {
        await updateGameState(gameId, playerToken, (state, role) => placeShips(state, role, ships));
        await emitViews(io, gameId);
      } catch (error) {
        socket.emit("move:rejected", { reason: errorMessage(error) });
      }
    });

    socket.on("player:ready", async ({ gameId, playerToken }) => {
      try {
        await updateGameState(gameId, playerToken, (state, role) => markReady(state, role));
        await emitViews(io, gameId);
        // Start turn timer if game just became active
        await scheduleTurnTimerIfActive(io, gameId);
      } catch (error) {
        socket.emit("move:rejected", { reason: errorMessage(error) });
      }
    });

    socket.on("shot:submit", async ({ gameId, playerToken, target, expectedVersion }) => {
      try {
        const shot = await prisma.$transaction(async (tx) => {
          const game = await tx.game.findUniqueOrThrow({ where: { id: gameId } });
          const role = getRoleForToken(game, playerToken);

          if (game.version !== expectedVersion) {
            throw new Error("STALE_GAME_STATE");
          }

          const outcome = submitShot(getState(game), role, target);
          const nextVersion = game.version + 1;

          await tx.shot.create({
            data: {
              gameId,
              playerId: playerToken,
              x: target.x,
              y: target.y,
              result: outcome.result,
              turnNumber: nextVersion,
            },
          });

          const updated = await tx.game.update({
            where: { id: gameId },
            data: {
              state: outcome.state as never,
              status: outcome.state.phase,
              winner: outcome.winner,
              version: nextVersion,
            },
          });

          return {
            result: outcome.result,
            target,
            state: outcome.state,
            version: updated.version,
          };
        });

        io.to(roomName(gameId)).emit("shot:result", {
          target: shot.target,
          result: shot.result,
          nextTurn: shot.state.currentTurn,
          version: shot.version,
        });

        await emitViews(io, gameId);

        if (shot.state.winner) {
          clearTurnTimer(gameId);
          io.to(roomName(gameId)).emit("game:finished", { winner: shot.state.winner });
        } else {
          // Schedule timer for the next turn
          scheduleTurnTimer(io, gameId);
        }
      } catch (error) {
        socket.emit("move:rejected", { reason: errorMessage(error) });
      }
    });
  });

  return io;
}

async function updateGameState(
  gameId: string,
  playerToken: string,
  updater: (state: GameState, role: Role) => GameState,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUniqueOrThrow({ where: { id: gameId } });
    const role = getRoleForToken(game, playerToken);
    const nextState = updater(getState(game), role);

    await tx.game.update({
      where: { id: gameId },
      data: {
        state: nextState as never,
        status: nextState.phase,
        winner: nextState.winner,
        version: {
          increment: 1,
        },
      },
    });
  });
}

export async function emitViews(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  gameId: string,
): Promise<void> {
  const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
  const sockets = await io.in(roomName(gameId)).fetchSockets();

  for (const socket of sockets) {
    const role = socket.data.role;
    if (!role) continue;

    socket.emit("game:view", {
      ...createPlayerView(getState(game), role),
      version: game.version,
    });
  }
}

function roomName(gameId: string): string {
  return `game:${gameId}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "UNKNOWN_ERROR";
}
