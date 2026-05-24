import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { buildApp } from "./app";
import { env } from "./env";
import { prisma } from "./db";

async function main(): Promise<void> {
  const { app } = await buildApp();

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
