import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

let envPath: string;
try {
  // ESM context (local dev with tsx) — derive path from this file
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  envPath = path.resolve(__dirname, "../../../.env");
} catch {
  // CJS context (esbuild bundle in Docker) — use working directory
  envPath = path.resolve(process.cwd(), ".env");
}

dotenv.config({ path: envPath });
