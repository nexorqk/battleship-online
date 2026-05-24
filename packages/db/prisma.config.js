import dotenv from "dotenv";
import { defineConfig } from "@prisma/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
