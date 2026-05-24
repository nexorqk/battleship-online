import type { FastifyInstance } from "fastify";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { Server } from "socket.io";
import { env } from "./env";
import { prisma } from "./db";
import { registerGameRoutes } from "./routes/games";
import { registerRealtime } from "./realtime";

export async function buildApp(): Promise<{ app: FastifyInstance; io: Server }> {
  const app = Fastify({
    logger: true,
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false, // disabled for dev; configure for production
  });

  // CORS
  await app.register(cors, {
    origin: env.webOrigin,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Global error handler — never leak raw errors to clients
  app.setErrorHandler((error, request, reply) => {
    const err = error as Error & { statusCode?: number };
    const statusCode = err.statusCode ?? 500;
    const message = statusCode === 500 ? "Internal server error" : err.message;

    request.log.error({ err }, `HTTP ${statusCode}: ${err.message}`);

    reply.status(statusCode).send({
      error: message,
      requestId: request.id,
      statusCode,
    });
  });

  // Liveness check.
  app.get("/health", async () => {
    return { ok: true, service: "battleship-api" };
  });

  // Readiness check with DB verification.
  app.get("/ready", async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, service: "battleship-api" };
  });

  const io = registerRealtime(app);
  await registerGameRoutes(app, io);

  return { app, io };
}
