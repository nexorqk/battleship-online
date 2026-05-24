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
});
