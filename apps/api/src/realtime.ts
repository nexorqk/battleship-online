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
} from "@battleship/game-core";
import type { ClientToServerEvents, ServerToClientEvents } from "@battleship/shared";
import { prisma } from "./db";
import { env } from "./env";
import { getRoleForToken, getState } from "./game-record";
import { parseSocketPayload, validationErrorMessage } from "./socket-validation";

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
    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUniqueOrThrow({ where: { id: gameId } });

      if (game.status !== "active") return null; // Game already ended

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

      if (validCells.length === 0) return null; // Board full — shouldn't happen

      // Pick a random cell
      const target = validCells[Math.floor(Math.random() * validCells.length)]!;

      // Process the shot
      const outcome = submitShot(state, currentPlayer, target);
      const expectedVersion = game.version;
      const nextVersion = expectedVersion + 1;

      await tx.shot.create({
        data: {
          gameId,
          playerId: `timer-auto-${currentPlayer}`,
          x: target.x,
          y: target.y,
          result: outcome.result,
          turnNumber: nextVersion,
        },
      });

      await tx.game.update({
        where: { id: gameId, version: expectedVersion },
        data: {
          state: outcome.state as never,
          status: outcome.state.phase,
          winner: outcome.winner,
          version: nextVersion,
        },
      });

      return { target, outcome, nextVersion };
    });

    if (!result) return;

    // Notify players — outside the transaction so clients see committed state
    io.to(roomName(gameId)).emit("shot:result", {
      target: result.target,
      result: result.outcome.result,
      nextTurn: result.outcome.state.currentTurn,
      version: result.nextVersion,
    });

    await emitViews(io, gameId);

    if (result.outcome.winner) {
      io.to(roomName(gameId)).emit("game:finished", { winner: result.outcome.winner });
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
  if (!env.autoShotTimeoutMs) return;

  clearTurnTimer(gameId);
  const timer = setTimeout(() => autoFireShot(io, gameId), env.autoShotTimeoutMs);
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
  const log = app.log;
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(app.server, {
    cors: {
      origin: env.webOrigin,
    },
  });

  io.on("connection", (socket: GameSocket) => {
    socket.on("game:join", async (rawPayload) => {
      try {
        const { gameId, playerToken } = parseSocketPayload("gameJoin", rawPayload);
        const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
        const role = getRoleForToken(game, playerToken);

        socket.data.gameId = gameId;
        socket.data.playerToken = playerToken;
        socket.data.role = role;

        await socket.join(roomName(gameId));
        log.info({ gameId, role, socketId: socket.id }, "socket joined game");
        socket.emit("game:view", {
          ...createPlayerView(getState(game), role),
          version: game.version,
        });

        // Ensure turn timer is running if game is active
        await scheduleTurnTimerIfActive(io, gameId);
      } catch (error) {
        socket.emit("move:rejected", { reason: validationErrorMessage(error) });
      }
    });

    socket.on("ships:place", async (rawPayload) => {
      try {
        const { gameId, playerToken, ships } = parseSocketPayload("shipsPlace", rawPayload);
        await updateGameState(gameId, playerToken, (state, role) => placeShips(state, role, ships));
        await emitViews(io, gameId);
        log.info({ gameId, shipCount: ships.length }, "ships placed");
      } catch (error) {
        socket.emit("move:rejected", { reason: validationErrorMessage(error) });
      }
    });

    socket.on("player:ready", async (rawPayload) => {
      try {
        const { gameId, playerToken } = parseSocketPayload("playerReady", rawPayload);
        await updateGameState(gameId, playerToken, (state, role) => markReady(state, role));
        await emitViews(io, gameId);
        // Start turn timer if game just became active
        await scheduleTurnTimerIfActive(io, gameId);
        log.info({ gameId }, "player ready");
      } catch (error) {
        socket.emit("move:rejected", { reason: validationErrorMessage(error) });
      }
    });

    socket.on("shot:submit", async (rawPayload) => {
      try {
        const payload = parseSocketPayload("shotSubmit", rawPayload);
        const shot = await acceptShotSubmission(payload);
        log.info(
          { gameId: payload.gameId, target: shot.target, result: shot.result, version: shot.version },
          "shot accepted",
        );

        io.to(roomName(payload.gameId)).emit("shot:result", {
          target: shot.target,
          result: shot.result,
          nextTurn: shot.state.currentTurn,
          version: shot.version,
        });

        await emitViews(io, payload.gameId);

        if (shot.state.winner) {
          clearTurnTimer(payload.gameId);
          io.to(roomName(payload.gameId)).emit("game:finished", { winner: shot.state.winner });
        } else {
          // Schedule timer for the next turn
          scheduleTurnTimer(io, payload.gameId);
        }
      } catch (error) {
        const message = validationErrorMessage(error);
        if (message.includes("Record to update not found")) {
          socket.emit("move:rejected", { reason: "STALE_GAME_STATE" });
        } else {
          socket.emit("move:rejected", { reason: message });
        }
      }
    });
  });

  return io;
}

export type AcceptedShot = {
  result: "miss" | "hit" | "sunk";
  target: Cell;
  state: GameState;
  version: number;
};

export async function acceptShotSubmission({
  gameId,
  playerToken,
  target,
  expectedVersion,
}: {
  gameId: string;
  playerToken: string;
  target: Cell;
  expectedVersion: number;
}): Promise<AcceptedShot> {
  return prisma.$transaction(async (tx) => {
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
      where: { id: gameId, version: expectedVersion },
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
