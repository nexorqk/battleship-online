import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env";
import { prisma } from "./db";
import { registerGameRoutes } from "./routes/games";
import { registerRealtime } from "./realtime";

async function main(): Promise<void> {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: env.webOrigin,
  });

  app.get("/health", async () => ({
    ok: true,
    service: "battleship-api",
  }));

  await registerGameRoutes(app);
  registerRealtime(app);

  const close = async () => {
    await app.close();
    await prisma.$disconnect();
  };

  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({
    port: env.port,
    host: "0.0.0.0",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
