import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is required. " +
      "Set it in your .env file or export it before running the application.",
  );
}

const adapter = new PrismaPg(databaseUrl);
export const prisma = new PrismaClient({ adapter });

export type { Game, Shot } from "@prisma/client";
