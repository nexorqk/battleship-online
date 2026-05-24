import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { Server } from "socket.io";
import {
  createInitialState,
  createPlayerView,
  markSecondPlayerJoined,
} from "@battleship/game-core";
import type { CreateGameResponse, JoinGameResponse } from "@battleship/shared";
import { prisma } from "../db";
import { getRoleForToken, getState } from "../game-record";
import { emitViews } from "../realtime";

export async function registerGameRoutes(
  app: FastifyInstance,
  io: Server,
): Promise<void> {
  app.post("/games", async (_request, reply): Promise<CreateGameResponse> => {
    const playerToken = nanoid(32);
    const state = createInitialState();

    const game = await prisma.game.create({
      data: {
        status: state.phase,
        state: state as never,
        playerAId: playerToken,
      },
    });

    reply.code(201);

    return {
      gameId: game.id,
      playerToken,
      role: "playerA",
    };
  });

  app.post<{ Params: { id: string } }>("/games/:id/join", async (request, reply): Promise<JoinGameResponse> => {
    const playerToken = nanoid(32);

    const existing = await prisma.game.findUnique({
      where: { id: request.params.id },
    });

    if (!existing) {
      return reply.code(404).send({ error: "Game not found" }) as never;
    }

    if (existing.playerBId) {
      return reply.code(409).send({ error: "Game is already full" }) as never;
    }

    const game = await prisma.$transaction(async (tx) => {
      const nextState = markSecondPlayerJoined(getState(existing));

      return tx.game.update({
        where: { id: existing.id },
        data: {
          playerBId: playerToken,
          state: nextState as never,
          status: nextState.phase,
          version: {
            increment: 1,
          },
        },
      });
    });

    // Notify Player A's sockets that the game phase has changed
    await emitViews(io, game.id);

    reply.code(201);

    return {
      gameId: game.id,
      playerToken,
      role: "playerB",
    };
  });

  app.get<{ Params: { id: string }; Querystring: { playerToken?: string } }>("/games/:id", async (request, reply) => {
    const game = await prisma.game.findUnique({
      where: { id: request.params.id },
    });

    if (!game) {
      return reply.code(404).send({ error: "Game not found" }) as never;
    }

    if (!request.query.playerToken) {
      return {
        gameId: game.id,
        status: game.status,
        version: game.version,
      };
    }

    const role = getRoleForToken(game, request.query.playerToken);
    const view = createPlayerView(getState(game), role);

    return {
      ...view,
      version: game.version,
    };
  });
}
