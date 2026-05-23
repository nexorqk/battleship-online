export const BOARD_SIZE = 10;

export type Role = "playerA" | "playerB";

export type GamePhase = "waiting" | "placing" | "active" | "finished";

export type ShotResult = "miss" | "hit" | "sunk";

export type Cell = {
  x: number;
  y: number;
};

export type Ship = {
  id: string;
  cells: Cell[];
  hits: Cell[];
  sunk: boolean;
};

export type ShotRecord = {
  target: Cell;
  result: ShotResult;
};

export type PlayerBoard = {
  ships: Ship[];
  shotsReceived: ShotRecord[];
  ready: boolean;
};

export type GameState = {
  phase: GamePhase;
  currentTurn: Role;
  winner?: Role;
  boards: Record<Role, PlayerBoard>;
};

export type PlayerGameView = {
  phase: GamePhase;
  myRole: Role;
  currentTurn: Role;
  winner?: Role;
  myBoard: {
    ships: Ship[];
    shotsReceived: ShotRecord[];
    ready: boolean;
  };
  enemyBoard: {
    myShots: ShotRecord[];
    enemyReady: boolean;
  };
};

export type ShotOutcome = {
  state: GameState;
  result: ShotResult;
  winner?: Role;
};

export type PlacementValidationResult =
  | { ok: true }
  | { ok: false; reason: string };
