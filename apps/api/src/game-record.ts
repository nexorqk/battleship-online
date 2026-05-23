import type { GameState, Role } from "@battleship/game-core";
import type { Game } from "@battleship/db";

export function getRoleForToken(game: Pick<Game, "playerAId" | "playerBId">, token: string): Role {
  if (game.playerAId === token) return "playerA";
  if (game.playerBId === token) return "playerB";
  throw new Error("Player does not belong to this game");
}

export function getState(game: Pick<Game, "state">): GameState {
  return game.state as unknown as GameState;
}
