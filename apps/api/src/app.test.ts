import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./db", () => {
  const mockPrisma = {
    game: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    shot: { create: vi.fn() },
    $transaction: vi.fn((cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
      cb(mockPrisma),
    ),
    $queryRaw: vi.fn(),
  };
  return { prisma: mockPrisma };
});

vi.mock("./env", () => ({
  env: {
    port: 4000,
    webOrigin: "http://localhost:5173",
    databaseUrl: "postgresql://localhost/battleship",
  },
}));

vi.mock("./realtime", () => ({
  registerRealtime: () => ({
    to: vi.fn(() => ({ emit: vi.fn() })),
    in: vi.fn(() => ({ fetchSockets: vi.fn(() => Promise.resolve([])) })),
    on: vi.fn(),
    server: {},
  }),
  emitViews: vi.fn(() => Promise.resolve()),
}));

import { buildApp } from "./app";
import { prisma } from "./db";

const mockPrisma = prisma as unknown as {
  game: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
};

describe("API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /games", () => {
    it("creates a new game and returns 201", async () => {
      mockPrisma.game.create.mockResolvedValue({
        id: "game-123",
        status: "waiting",
        playerAId: "token-a",
        playerBId: null,
        version: 0,
      });

      const { app } = await buildApp();
      const response = await app.inject({
        method: "POST",
        url: "/games",
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("gameId", "game-123");
      expect(body).toHaveProperty("playerToken");
      expect(body.role).toBe("playerA");
    });
  });

  describe("POST /games/:id/join", () => {
    it("joins an existing waiting game and returns 201", async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: "game-123",
        status: "waiting",
        playerAId: "token-a",
        playerBId: null,
        version: 0,
        state: { phase: "waiting" },
      });

      mockPrisma.game.update.mockResolvedValue({
        id: "game-123",
        status: "placing",
        playerAId: "token-a",
        playerBId: "token-b",
        version: 1,
        state: { phase: "placing" },
      });

      const { app } = await buildApp();
      const response = await app.inject({
        method: "POST",
        url: "/games/game-123/join",
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("gameId", "game-123");
      expect(body).toHaveProperty("playerToken");
      expect(body.role).toBe("playerB");
    });

    it("returns 404 for a non-existent game", async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      const { app } = await buildApp();
      const response = await app.inject({
        method: "POST",
        url: "/games/nonexistent/join",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Game not found");
    });

    it("returns 409 when game is already full", async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: "game-123",
        status: "placing",
        playerAId: "token-a",
        playerBId: "token-b",
        version: 1,
        state: { phase: "placing" },
      });

      const { app } = await buildApp();
      const response = await app.inject({
        method: "POST",
        url: "/games/game-123/join",
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Game is already full");
    });
  });

  describe("GET /games/:id", () => {
    it("returns game status without token", async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: "game-123",
        status: "placing",
        version: 1,
        playerAId: "token-a",
        playerBId: "token-b",
        state: {
          phase: "placing",
          currentTurn: "playerA",
          boards: {
            playerA: { ships: [], shotsReceived: [], ready: false },
            playerB: { ships: [], shotsReceived: [], ready: false },
          },
        },
      });

      const { app } = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: "/games/game-123",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.gameId).toBe("game-123");
      expect(body.status).toBe("placing");
      expect(body.version).toBe(1);
    });

    it("returns 404 for a non-existent game", async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      const { app } = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: "/games/nonexistent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Game not found");
    });
  });

  describe("GET /health", () => {
    it("returns liveness status", async () => {
      const { app } = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.service).toBe("battleship-api");
    });
  });

  describe("GET /ready", () => {
    it("returns ok when DB is reachable", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

      const { app } = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: "/ready",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.service).toBe("battleship-api");
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });
});
