import { BOARD_SIZE, cellKey, type Cell, type Ship } from "@battleship/game-core";

/** Fleet composition: ship lengths to place */
export const FLEET_COMPOSITION = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1] as const;

export type Direction = "horizontal" | "vertical";

export type PlacementShip = {
  id: string;
  length: number;
  placed: boolean;
};

/** Generate the list of ships still needed for placement display */
export function createFleetRoster(): PlacementShip[] {
  let idCounter = 0;
  return FLEET_COMPOSITION.map((len) => ({
    id: `ship-${idCounter++}`,
    length: len,
    placed: false,
  }));
}

/** Compute cells a ship would occupy given origin, length, and direction */
export function getShipCells(
  origin: Cell,
  length: number,
  direction: Direction,
): Cell[] {
  return Array.from({ length }, (_, i) => ({
    x: direction === "horizontal" ? origin.x + i : origin.x,
    y: direction === "vertical" ? origin.y + i : origin.y,
  }));
}

/** Check whether a set of cells is on the board and non-overlapping */
export function isValidPlacement(
  cells: Cell[],
  placedShips: Ship[],
): boolean {
  // All cells must be inside the board
  if (!cells.every((c) => c.x >= 0 && c.x < BOARD_SIZE && c.y >= 0 && c.y < BOARD_SIZE)) {
    return false;
  }

  // Build occupied set from already placed ships
  const occupied = new Set<string>();
  for (const ship of placedShips) {
    for (const c of ship.cells) {
      occupied.add(cellKey(c));
    }
  }

  // Check no overlap
  for (const c of cells) {
    if (occupied.has(cellKey(c))) return false;
  }

  return true;
}

/** Generate preview cells (empty array if invalid) */
export function getPreviewCells(
  origin: Cell,
  length: number,
  direction: Direction,
  placedShips: Ship[],
): Cell[] {
  const cells = getShipCells(origin, length, direction);
  if (!isValidPlacement(cells, placedShips)) return [];
  return cells;
}

/** Rotate direction */
export function oppositeDirection(d: Direction): Direction {
  return d === "horizontal" ? "vertical" : "horizontal";
}
