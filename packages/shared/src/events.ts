import type { Cell, PlayerGameView, Ship } from "@battleship/game-core";

export type CreateGameResponse = {
  gameId: string;
  playerToken: string;
  role: "playerA";
};

export type JoinGameResponse = {
  gameId: string;
  playerToken: string;
  role: "playerB";
};

export type ClientToServerEvents = {
  "game:join": (payload: { gameId: string; playerToken: string }) => void;

  "ships:place": (payload: {
    gameId: string;
    playerToken: string;
    ships: Ship[];
  }) => void;

  "player:ready": (payload: {
    gameId: string;
    playerToken: string;
  }) => void;

  "shot:submit": (payload: {
    gameId: string;
    playerToken: string;
    target: Cell;
    expectedVersion: number;
  }) => void;
};

export type ServerToClientEvents = {
  "game:view": (payload: PlayerGameView & { version: number }) => void;

  "shot:result": (payload: {
    target: Cell;
    result: "miss" | "hit" | "sunk";
    nextTurn: "playerA" | "playerB";
    version: number;
  }) => void;

  "move:rejected": (payload: {
    reason: string;
  }) => void;

  "game:finished": (payload: {
    winner: "playerA" | "playerB";
  }) => void;
};
