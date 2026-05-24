import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

async function main(): Promise<void> {
  // Dynamic imports: modules that read process.env at module level are loaded
  // here after dotenv.config() has populated process.env, avoiding the ES-module
  // hoisting pitfall (static imports are resolved before any module-level code runs).
  const { env } = await import("./env");
  const { prisma } = await import("./db");
  const { registerGameRoutes } = await import("./routes/games");
  const { registerRealtime } = await import("./realtime");

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
      statusCode,
    });
  });

  // Health check with DB verification
  app.get("/health", async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, service: "battleship-api" };
  });

  const io = registerRealtime(app);
  await registerGameRoutes(app, io);

  // Graceful shutdown
  const close = async () => {
    await app.close();
    await prisma.$disconnect();
  };

  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
    process.exit(1);
  });

  await app.listen({
    port: env.port,
    host: "0.0.0.0",
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
