import type { Ship } from "@battleship/game-core";

export function createAutoFleet(offset: number): Ship[] {
  return [
    ship("s4", [[0, offset], [1, offset], [2, offset], [3, offset]]),
    ship("s3a", [[0, offset + 2], [1, offset + 2], [2, offset + 2]]),
    ship("s3b", [[4, 0], [4, 1], [4, 2]]),
    ship("s2a", [[6, 0], [6, 1]]),
    ship("s2b", [[8, 0], [9, 0]]),
    ship("s2c", [[0, 5], [1, 5]]),
    ship("s1a", [[3, 5]]),
    ship("s1b", [[5, 5]]),
    ship("s1c", [[7, 5]]),
    ship("s1d", [[9, 5]]),
  ];
}

function ship(id: string, cells: [number, number][]): Ship {
  return {
    id,
    cells: cells.map(([x, y]) => ({ x, y })),
    hits: [],
    sunk: false,
  };
}
