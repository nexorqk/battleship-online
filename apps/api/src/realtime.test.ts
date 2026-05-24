import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@battleship/game-core";

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const mockTx = {
    game: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    shot: {
      create: vi.fn(),
    },
  };

  const mockPrisma = {
    ...mockTx,
    $transaction: vi.fn((callback: (tx: typeof mockTx) => Promise<unknown>) =>
      callback(mockTx),
    ),
  };

  return { mockPrisma, mockTx };
});

vi.mock("./db", () => ({ prisma: mockPrisma }));

vi.mock("./env", () => ({
  env: {
    webOrigin: "http://localhost:5173",
    autoShotTimeoutMs: undefined,
  },
}));

import { acceptShotSubmission } from "./realtime";

describe("acceptShotSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
  });

  it("uses Game.version in the write condition when accepting a shot", async () => {
    mockTx.game.findUniqueOrThrow.mockResolvedValue({
      id: "game-1",
      playerAId: "token-a",
      playerBId: "token-b",
      version: 2,
      state: activeState(),
    });
    mockTx.game.update.mockResolvedValue({ version: 3 });

    const result = await acceptShotSubmission({
      gameId: "game-1",
      playerToken: "token-a",
      target: { x: 9, y: 9 },
      expectedVersion: 2,
    });

    expect(result.result).toBe("miss");
    expect(result.version).toBe(3);
    expect(mockTx.game.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "game-1", version: 2 },
      }),
    );
    expect(mockTx.shot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gameId: "game-1",
          playerId: "token-a",
          turnNumber: 3,
        }),
      }),
    );
  });

  it("rejects stale shot submissions before writing shot history", async () => {
    mockTx.game.findUniqueOrThrow.mockResolvedValue({
      id: "game-1",
      playerAId: "token-a",
      playerBId: "token-b",
      version: 4,
      state: activeState(),
    });

    await expect(
      acceptShotSubmission({
        gameId: "game-1",
        playerToken: "token-a",
        target: { x: 9, y: 9 },
        expectedVersion: 3,
      }),
    ).rejects.toThrow("STALE_GAME_STATE");

    expect(mockTx.shot.create).not.toHaveBeenCalled();
    expect(mockTx.game.update).not.toHaveBeenCalled();
  });
});

function activeState(): GameState {
  return {
    phase: "active",
    currentTurn: "playerA",
    boards: {
      playerA: {
        ready: true,
        ships: [{ id: "a1", cells: [{ x: 0, y: 0 }], hits: [], sunk: false }],
        shotsReceived: [],
      },
      playerB: {
        ready: true,
        ships: [{ id: "b1", cells: [{ x: 0, y: 0 }], hits: [], sunk: false }],
        shotsReceived: [],
      },
    },
  };
}
