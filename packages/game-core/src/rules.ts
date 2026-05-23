import {
  BOARD_SIZE,
  type Cell,
  type GameState,
  type PlacementValidationResult,
  type PlayerBoard,
  type PlayerGameView,
  type Role,
  type Ship,
  type ShotOutcome,
  type ShotRecord,
  type ShotResult,
} from "./types";

export const DEFAULT_FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1] as const;

export function createInitialState(): GameState {
  return {
    phase: "waiting",
    currentTurn: "playerA",
    boards: {
      playerA: createEmptyBoard(),
      playerB: createEmptyBoard(),
    },
  };
}

export function markSecondPlayerJoined(state: GameState): GameState {
  if (state.phase !== "waiting") return state;

  return {
    ...state,
    phase: "placing",
  };
}

export function createEmptyBoard(): PlayerBoard {
  return {
    ships: [],
    shotsReceived: [],
    ready: false,
  };
}

export function opponentOf(role: Role): Role {
  return role === "playerA" ? "playerB" : "playerA";
}

export function validateShipPlacement(
  ships: Ship[],
  expectedFleet: readonly number[] = DEFAULT_FLEET,
): PlacementValidationResult {
  if (ships.length !== expectedFleet.length) {
    return {
      ok: false,
      reason: `Expected ${expectedFleet.length} ships, got ${ships.length}`,
    };
  }

  const expectedLengths = [...expectedFleet].sort((a, b) => a - b);
  const actualLengths = ships.map((ship) => ship.cells.length).sort((a, b) => a - b);

  if (expectedLengths.join(",") !== actualLengths.join(",")) {
    return {
      ok: false,
      reason: `Invalid fleet. Expected lengths ${expectedLengths.join(",")}, got ${actualLengths.join(",")}`,
    };
  }

  const occupied = new Set<string>();

  for (const ship of ships) {
    if (!ship.id.trim()) {
      return { ok: false, reason: "Ship id is required" };
    }

    if (ship.cells.length === 0) {
      return { ok: false, reason: `Ship ${ship.id} has no cells` };
    }

    for (const cell of ship.cells) {
      if (!isInsideBoard(cell)) {
        return { ok: false, reason: `Ship ${ship.id} is outside the board` };
      }
    }

    if (!isStraight(ship.cells)) {
      return { ok: false, reason: `Ship ${ship.id} must be horizontal or vertical` };
    }

    if (!isContinuous(ship.cells)) {
      return { ok: false, reason: `Ship ${ship.id} cells must be continuous` };
    }

    for (const cell of ship.cells) {
      const key = cellKey(cell);
      if (occupied.has(key)) {
        return { ok: false, reason: `Ship ${ship.id} overlaps another ship` };
      }
      occupied.add(key);
    }
  }

  return { ok: true };
}

export function placeShips(state: GameState, role: Role, ships: Ship[]): GameState {
  if (state.phase !== "placing") {
    throw new Error("Ships can only be placed during placing phase");
  }

  const validation = validateShipPlacement(ships);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  return {
    ...state,
    boards: {
      ...state.boards,
      [role]: {
        ...state.boards[role],
        ships: ships.map(resetShip),
        ready: false,
      },
    },
  };
}

export function markReady(state: GameState, role: Role): GameState {
  if (state.phase !== "placing") {
    throw new Error("Player can only become ready during placing phase");
  }

  if (state.boards[role].ships.length === 0) {
    throw new Error("Cannot become ready before placing ships");
  }

  const nextBoards: GameState["boards"] = {
    ...state.boards,
    [role]: {
      ...state.boards[role],
      ready: true,
    },
  };

  const bothReady = nextBoards.playerA.ready && nextBoards.playerB.ready;

  return {
    ...state,
    phase: bothReady ? "active" : "placing",
    boards: nextBoards,
  };
}

export function submitShot(state: GameState, shooter: Role, target: Cell): ShotOutcome {
  if (state.phase !== "active") {
    throw new Error("Game is not active");
  }

  if (state.currentTurn !== shooter) {
    throw new Error("Not your turn");
  }

  if (!isInsideBoard(target)) {
    throw new Error("Target is outside the board");
  }

  const defender = opponentOf(shooter);
  const defenderBoard = state.boards[defender];

  if (defenderBoard.shotsReceived.some((shot) => sameCell(shot.target, target))) {
    throw new Error("This cell has already been shot");
  }

  const hitShip = defenderBoard.ships.find((ship) =>
    ship.cells.some((cell) => sameCell(cell, target)),
  );

  let result: ShotResult = "miss";
  let nextDefenderShips = defenderBoard.ships;

  if (hitShip) {
    const nextHits = uniqueCells([...hitShip.hits, target]);
    const sunk = hitShip.cells.every((cell) =>
      nextHits.some((hit) => sameCell(hit, cell)),
    );

    result = sunk ? "sunk" : "hit";

    nextDefenderShips = defenderBoard.ships.map((ship) =>
      ship.id === hitShip.id
        ? {
            ...ship,
            hits: nextHits,
            sunk,
          }
        : ship,
    );
  }

  const nextShot: ShotRecord = { target, result };
  const allDefenderShipsSunk = nextDefenderShips.every((ship) => ship.sunk);

  const nextState: GameState = {
    ...state,
    phase: allDefenderShipsSunk ? "finished" : "active",
    winner: allDefenderShipsSunk ? shooter : undefined,
    currentTurn: allDefenderShipsSunk ? state.currentTurn : defender,
    boards: {
      ...state.boards,
      [defender]: {
        ...defenderBoard,
        ships: nextDefenderShips,
        shotsReceived: [...defenderBoard.shotsReceived, nextShot],
      },
    },
  };

  return {
    state: nextState,
    result,
    winner: nextState.winner,
  };
}

export function createPlayerView(state: GameState, role: Role): PlayerGameView {
  const enemy = opponentOf(role);

  return {
    phase: state.phase,
    myRole: role,
    currentTurn: state.currentTurn,
    winner: state.winner,
    myBoard: {
      ships: cloneShips(state.boards[role].ships),
      shotsReceived: [...state.boards[role].shotsReceived],
      ready: state.boards[role].ready,
    },
    enemyBoard: {
      myShots: [...state.boards[enemy].shotsReceived],
      enemyReady: state.boards[enemy].ready,
    },
  };
}

export function isGameOver(state: GameState): boolean {
  return state.phase === "finished";
}

export function isInsideBoard(cell: Cell): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.y) &&
    cell.x >= 0 &&
    cell.x < BOARD_SIZE &&
    cell.y >= 0 &&
    cell.y < BOARD_SIZE
  );
}

export function cellKey(cell: Cell): string {
  return `${cell.x}:${cell.y}`;
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

function isStraight(cells: Cell[]): boolean {
  const allSameX = cells.every((cell) => cell.x === cells[0]?.x);
  const allSameY = cells.every((cell) => cell.y === cells[0]?.y);
  return allSameX || allSameY;
}

function isContinuous(cells: Cell[]): boolean {
  const xs = cells.map((cell) => cell.x).sort((a, b) => a - b);
  const ys = cells.map((cell) => cell.y).sort((a, b) => a - b);

  const allSameX = xs.every((x) => x === xs[0]);
  const allSameY = ys.every((y) => y === ys[0]);

  const sequence = allSameX ? ys : allSameY ? xs : [];

  return sequence.every((value, index) => index === 0 || value === (sequence[index - 1] ?? 0) + 1);
}

function resetShip(ship: Ship): Ship {
  return {
    id: ship.id,
    cells: ship.cells.map((cell) => ({ ...cell })),
    hits: [],
    sunk: false,
  };
}

function uniqueCells(cells: Cell[]): Cell[] {
  const result: Cell[] = [];
  const seen = new Set<string>();

  for (const cell of cells) {
    const key = cellKey(cell);
    if (!seen.has(key)) {
      result.push({ ...cell });
      seen.add(key);
    }
  }

  return result;
}

function cloneShips(ships: Ship[]): Ship[] {
  return ships.map((ship) => ({
    id: ship.id,
    cells: ship.cells.map((cell) => ({ ...cell })),
    hits: ship.hits.map((cell) => ({ ...cell })),
    sunk: ship.sunk,
  }));
}
