import { describe, expect, it } from "vitest";
import {
  createInitialState,
  createPlayerView,
  markReady,
  markSecondPlayerJoined,
  placeShips,
  submitShot,
  validateShipPlacement,
  type Ship,
} from "./index";

const validShips: Ship[] = [
  ship("s4", [[0, 0], [1, 0], [2, 0], [3, 0]]),
  ship("s3a", [[0, 2], [1, 2], [2, 2]]),
  ship("s3b", [[4, 0], [4, 1], [4, 2]]),
  ship("s2a", [[6, 0], [6, 1]]),
  ship("s2b", [[8, 0], [9, 0]]),
  ship("s2c", [[0, 4], [1, 4]]),
  ship("s1a", [[3, 4]]),
  ship("s1b", [[5, 4]]),
  ship("s1c", [[7, 4]]),
  ship("s1d", [[9, 4]]),
];

describe("validateShipPlacement", () => {
  it("accepts a valid fleet", () => {
    expect(validateShipPlacement(validShips)).toEqual({ ok: true });
  });

  it("rejects overlapping ships", () => {
    const invalid = [...validShips];
    invalid[1] = ship("overlap", [[0, 0], [0, 1], [0, 2]]);

    expect(validateShipPlacement(invalid).ok).toBe(false);
  });

  it("rejects diagonal ships", () => {
    const invalid = [...validShips];
    invalid[0] = ship("diagonal", [[0, 0], [1, 1], [2, 2], [3, 3]]);

    expect(validateShipPlacement(invalid).ok).toBe(false);
  });
});

describe("submitShot", () => {
  it("updates both player views without leaking enemy ships", () => {
    let state = createInitialState();
    state = markSecondPlayerJoined(state);
    state = placeShips(state, "playerA", validShips);
    state = placeShips(state, "playerB", validShips);
    state = markReady(state, "playerA");
    state = markReady(state, "playerB");

    const outcome = submitShot(state, "playerA", { x: 0, y: 0 });
    const playerAView = createPlayerView(outcome.state, "playerA");

    expect(outcome.result).toBe("hit");
    expect(playerAView.enemyBoard.myShots).toHaveLength(1);
    expect(playerAView.myBoard.ships).toHaveLength(10);
    expect(JSON.stringify(playerAView.enemyBoard)).not.toContain('"ships"');
  });

  it("keeps the turn on hit (classic Battleship rule)", () => {
    let state = createInitialState();
    state = markSecondPlayerJoined(state);
    state = placeShips(state, "playerA", validShips);
    state = placeShips(state, "playerB", validShips);
    state = markReady(state, "playerA");
    state = markReady(state, "playerB");

    // Hit: PlayerA shoots at (0,0) which is part of s4
    const hit = submitShot(state, "playerA", { x: 0, y: 0 });
    expect(hit.result).toBe("hit");
    expect(hit.state.currentTurn).toBe("playerA");

    // Hit again: PlayerA shoots at (1,0) — same ship s4
    const hit2 = submitShot(hit.state, "playerA", { x: 1, y: 0 });
    expect(hit2.result).toBe("hit");
    expect(hit2.state.currentTurn).toBe("playerA");

    // Sink: PlayerA shoots at (2,0) then (3,0) — sinks s4
    const hit3 = submitShot(hit2.state, "playerA", { x: 2, y: 0 });
    expect(hit3.result).toBe("hit");
    expect(hit3.state.currentTurn).toBe("playerA");

    const sunk = submitShot(hit3.state, "playerA", { x: 3, y: 0 });
    expect(sunk.result).toBe("sunk");
    expect(sunk.state.currentTurn).toBe("playerA");

    // Miss: finally a miss — turn switches to PlayerB
    const miss = submitShot(sunk.state, "playerA", { x: 9, y: 9 });
    expect(miss.result).toBe("miss");
    expect(miss.state.currentTurn).toBe("playerB");
  });

  it("switches turn on miss", () => {
    let state = createInitialState();
    state = markSecondPlayerJoined(state);
    state = placeShips(state, "playerA", validShips);
    state = placeShips(state, "playerB", validShips);
    state = markReady(state, "playerA");
    state = markReady(state, "playerB");

    const miss = submitShot(state, "playerA", { x: 9, y: 9 });
    expect(miss.result).toBe("miss");
    expect(miss.state.currentTurn).toBe("playerB");
  });
});

function ship(id: string, cells: [number, number][]): Ship {
  return {
    id,
    cells: cells.map(([x, y]) => ({ x, y })),
    hits: [],
    sunk: false,
  };
}
