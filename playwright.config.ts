import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
  },
  webServer: [
    {
      command:
        "DATABASE_URL=postgresql://storycraft:storycraft@127.0.0.1:5432/battleship pnpm --filter @battleship/api exec tsx src/server.ts",
      port: 4000,
      timeout: 10_000,
      reuseExistingServer: true,
    },
    {
      command: "pnpm --filter @battleship/web exec vite --host 0.0.0.0",
      port: 5173,
      timeout: 10_000,
      reuseExistingServer: true,
    },
  ],
});
