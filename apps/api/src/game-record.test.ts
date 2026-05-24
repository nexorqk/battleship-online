import { describe, expect, it } from "vitest";
import { getRoleForToken, getState } from "./game-record";

describe("getRoleForToken", () => {
  it("returns playerA for the playerA token", () => {
    const game = { playerAId: "token-a", playerBId: "token-b" };
    expect(getRoleForToken(game, "token-a")).toBe("playerA");
  });

  it("returns playerB for the playerB token", () => {
    const game = { playerAId: "token-a", playerBId: "token-b" };
    expect(getRoleForToken(game, "token-b")).toBe("playerB");
  });

  it("throws when token does not belong to either player", () => {
    const game = { playerAId: "token-a", playerBId: "token-b" };
    expect(() => getRoleForToken(game, "token-c")).toThrow("Player does not belong to this game");
  });
});

describe("getState", () => {
  it("parses JSON state into GameState", () => {
    const state = {
      phase: "placing",
      currentTurn: "playerA",
      boards: {
        playerA: { ships: [], shotsReceived: [], ready: false },
        playerB: { ships: [], shotsReceived: [], ready: false },
      },
    };

    const result = getState({ state: state as never });
    expect(result.phase).toBe("placing");
    expect(result.currentTurn).toBe("playerA");
  });
});
