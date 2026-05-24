import { describe, expect, it } from "vitest";
import { parseSocketPayload, validationErrorMessage } from "./socket-validation";

describe("socket payload validation", () => {
  it("accepts a valid shot submission", () => {
    const payload = parseSocketPayload("shotSubmit", {
      gameId: "game-1",
      playerToken: "token-a",
      target: { x: 4, y: 7 },
      expectedVersion: 3,
    });

    expect(payload).toEqual({
      gameId: "game-1",
      playerToken: "token-a",
      target: { x: 4, y: 7 },
      expectedVersion: 3,
    });
  });

  it("rejects malformed shot coordinates", () => {
    expect(() =>
      parseSocketPayload("shotSubmit", {
        gameId: "game-1",
        playerToken: "token-a",
        target: { x: 10, y: 0 },
        expectedVersion: 3,
      }),
    ).toThrow();
  });

  it("adds safe defaults to ship payloads", () => {
    const payload = parseSocketPayload("shipsPlace", {
      gameId: "game-1",
      playerToken: "token-a",
      ships: [{ id: "s1", cells: [{ x: 0, y: 0 }] }],
    });

    expect(payload.ships[0]).toEqual({
      id: "s1",
      cells: [{ x: 0, y: 0 }],
      hits: [],
      sunk: false,
    });
  });

  it("returns predictable validation messages", () => {
    try {
      parseSocketPayload("playerReady", { gameId: "" });
    } catch (error) {
      expect(validationErrorMessage(error)).toContain("INVALID_PAYLOAD");
      expect(validationErrorMessage(error)).toContain("gameId");
    }
  });

  it("rejects ships:place with a ship missing an id", () => {
    expect(() =>
      parseSocketPayload("shipsPlace", {
        gameId: "game-1",
        playerToken: "token-a",
        ships: [{ id: "", cells: [{ x: 0, y: 0 }] }],
      }),
    ).toThrow();
  });

  it("rejects ships:place with out-of-board cells", () => {
    expect(() =>
      parseSocketPayload("shipsPlace", {
        gameId: "game-1",
        playerToken: "token-a",
        ships: [{ id: "s1", cells: [{ x: 10, y: 0 }] }],
      }),
    ).toThrow();
  });

  it("rejects ships:place with too many ships", () => {
    expect(() =>
      parseSocketPayload("shipsPlace", {
        gameId: "game-1",
        playerToken: "token-a",
        ships: Array.from({ length: 11 }, (_, i) => ({
          id: `s${i}`,
          cells: [{ x: 0, y: 0 }],
        })),
      }),
    ).toThrow();
  });

  it("rejects shot:submit with negative coordinates", () => {
    expect(() =>
      parseSocketPayload("shotSubmit", {
        gameId: "game-1",
        playerToken: "token-a",
        target: { x: -1, y: 0 },
        expectedVersion: 3,
      }),
    ).toThrow();
  });

  it("rejects shot:submit with coordinates beyond board size", () => {
    expect(() =>
      parseSocketPayload("shotSubmit", {
        gameId: "game-1",
        playerToken: "token-a",
        target: { x: 0, y: 10 },
        expectedVersion: 3,
      }),
    ).toThrow();
  });

  it("rejects game:join with missing fields", () => {
    expect(() => parseSocketPayload("gameJoin", {})).toThrow();
    expect(() =>
      parseSocketPayload("gameJoin", { gameId: "game-1" }),
    ).toThrow();
    expect(() =>
      parseSocketPayload("gameJoin", { playerToken: "token-a" }),
    ).toThrow();
  });
});
