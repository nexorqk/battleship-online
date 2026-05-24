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

  it("does not reveal unhit enemy ship coordinates in player views", () => {
    let state = createInitialState();
    state = markSecondPlayerJoined(state);
    state = placeShips(state, "playerA", validShips);
    state = placeShips(state, "playerB", validShips);
    state = markReady(state, "playerA");
    state = markReady(state, "playerB");

    const initialView = createPlayerView(state, "playerA");
    expect(Object.keys(initialView.enemyBoard).sort()).toEqual(["enemyReady", "myShots"]);
    expect(JSON.stringify(initialView.enemyBoard)).not.toContain('"cells"');
    expect(JSON.stringify(initialView.enemyBoard)).not.toContain('"id"');

    const outcome = submitShot(state, "playerA", { x: 0, y: 0 });
    const afterHitView = createPlayerView(outcome.state, "playerA");

    expect(afterHitView.enemyBoard.myShots).toEqual([
      { target: { x: 0, y: 0 }, result: "hit" },
    ]);
    expect(JSON.stringify(afterHitView.enemyBoard)).not.toContain('"x":1');
    expect(JSON.stringify(afterHitView.enemyBoard)).not.toContain('"x":2');
    expect(JSON.stringify(afterHitView.enemyBoard)).not.toContain('"x":3');
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

  it("rejects shots outside the board", () => {
    let state = createInitialState();
    state = markSecondPlayerJoined(state);
    state = placeShips(state, "playerA", validShips);
    state = placeShips(state, "playerB", validShips);
    state = markReady(state, "playerA");
    state = markReady(state, "playerB");

    expect(() => submitShot(state, "playerA", { x: 10, y: 0 })).toThrow(
      "Target is outside the board",
    );
    expect(() => submitShot(state, "playerA", { x: 0, y: 10 })).toThrow(
      "Target is outside the board",
    );
  });

  it("rejects duplicate shots", () => {
    let state = createInitialState();
    state = markSecondPlayerJoined(state);
    state = placeShips(state, "playerA", validShips);
    state = placeShips(state, "playerB", validShips);
    state = markReady(state, "playerA");
    state = markReady(state, "playerB");

    // Hit at (0,0) keeps the turn with playerA, so we can test duplicate detection
    const first = submitShot(state, "playerA", { x: 0, y: 0 });
    expect(first.result).toBe("hit");
    expect(() => submitShot(first.state, "playerA", { x: 0, y: 0 })).toThrow(
      "This cell has already been shot",
    );
  });

  it("rejects shots when it is not the player's turn", () => {
    let state = createInitialState();
    state = markSecondPlayerJoined(state);
    state = placeShips(state, "playerA", validShips);
    state = placeShips(state, "playerB", validShips);
    state = markReady(state, "playerA");
    state = markReady(state, "playerB");

    // A shoots and misses, turn switches to B
    const miss = submitShot(state, "playerA", { x: 9, y: 9 });
    expect(miss.state.currentTurn).toBe("playerB");

    expect(() => submitShot(miss.state, "playerA", { x: 8, y: 8 })).toThrow(
      "Not your turn",
    );
  });

  it("rejects shots when the game is not active", () => {
    const state = createInitialState();
    expect(() => submitShot(state, "playerA", { x: 0, y: 0 })).toThrow(
      "Game is not active",
    );
  });

  it("finishes the game when all enemy ships are sunk", () => {
    let state = createInitialState();
    state = markSecondPlayerJoined(state);
    state = placeShips(state, "playerA", validShips);
    state = placeShips(state, "playerB", validShips);
    state = markReady(state, "playerA");
    state = markReady(state, "playerB");

    // All cells occupied by playerB's fleet
    const allCells = validShips.flatMap((s) => s.cells);
    expect(allCells).toHaveLength(20);

    // Fire at every occupied cell; hits keep the turn, so A can sink everything
    let shotIndex = 0;
    for (const target of allCells) {
      const outcome = submitShot(state, "playerA", target);
      state = outcome.state;

      if (shotIndex === allCells.length - 1) {
        expect(outcome.result).toBe("sunk");
        expect(state.phase).toBe("finished");
        expect(state.winner).toBe("playerA");
        expect(state.currentTurn).toBe("playerA");
      } else {
        expect(state.phase).toBe("active");
        expect(state.winner).toBeUndefined();
      }
      shotIndex++;
    }

    // Verify player views in finished state
    const playerAView = createPlayerView(state, "playerA");
    expect(playerAView.phase).toBe("finished");
    expect(playerAView.winner).toBe("playerA");

    const playerBView = createPlayerView(state, "playerB");
    expect(playerBView.phase).toBe("finished");
    expect(playerBView.winner).toBe("playerA");
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
