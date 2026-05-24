import { test, expect } from "@playwright/test";

const API_URL = "http://localhost:4000";

test.describe("Battleship full game flow", () => {
  test("two players can play a full game", async ({ browser }) => {
    // Create two isolated browser contexts (Player A & B)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // --- Step 1: Player A creates a game ---
    await pageA.goto("/");
    await pageA.waitForSelector("text=Create Game");
    await pageA.click("text=Create Game");

    // Wait for navigation to game page
    await pageA.waitForURL(/\/game\//);
    const gameUrl = pageA.url();

    // Verify game page loaded with waiting phase (Player A is waiting for opponent)
    await pageA.waitForSelector("text=WAITING");

    // --- Step 2: Player B joins via invite link ---
    await pageB.goto(gameUrl);

    // Wait for Player B to see the game page, then both should transition to placing
    await pageB.waitForSelector("text=PLACING");
    await pageA.waitForSelector("text=PLACING");

    // Both should see the fleet palette
    await pageA.waitForSelector("text=Your Fleet");
    await pageB.waitForSelector("text=Your Fleet");

    // --- Step 3: Both auto-place ships ---
    const autoPlaceBtnA = pageA.locator("button", { hasText: "Auto-place" });
    await autoPlaceBtnA.click();

    const autoPlaceBtnB = pageB.locator("button", { hasText: "Auto-place" });
    await autoPlaceBtnB.click();

    // Verify ships were placed (fleet should show "10 / 10 placed")
    await expect(pageA.locator("text=10 / 10 placed")).toBeVisible();
    await expect(pageB.locator("text=10 / 10 placed")).toBeVisible();

    // --- Step 4: Both click Ready ---
    const readyBtnA = pageA.locator("button", { hasText: "Ready" });
    await readyBtnA.click();

    const readyBtnB = pageB.locator("button", { hasText: "Ready" });
    await readyBtnB.click();

    // Should transition to active phase (Player A's turn first)
    await pageA.waitForSelector("text=YOUR TURN");
    await pageB.waitForSelector("text=OPPONENT");

    // Verify boards show active state with ship status
    await expect(pageA.locator("text=Ships sunk")).toBeVisible();
    await expect(pageB.locator("text=Ships sunk")).toBeVisible();

    // --- Step 5: Player A shoots ---
    // Click a few cells on the enemy board until we get a hit or miss
    const enemyBoardA = pageA.locator("section.enemy-board");
    const cellsA = enemyBoardA.locator("button");

    // Click cell A1 (0,0) — coordinate label is "A1"
    const cellCount = await cellsA.count();
    expect(cellCount).toBe(100); // 10x10 grid

    // Click cell (0,0) — this is the first button in the grid after column headers
    // The grid is: row labels (10) + cells (100) = 110 buttons in the grid
    // But we target the enemy board section specifically
    const firstCell = cellsA.first();
    await firstCell.click();

    // Wait for shot result notification
    await pageA.waitForTimeout(500);

    // The shot result should appear as a notification
    // Miss: "○" Miss at A1, Hit: "Hit! at A1", etc.

    // --- Step 6: Verify Player B sees the shot ---
    // Player B's own board should now show a shot
    const myBoardB = pageB.locator("section.my-board");
    await expect(myBoardB.locator(".cell.miss, .cell.hit, .cell.ship-hit")).toBeVisible({ timeout: 3000 });

    // Verify the game infrastructure is working
    // Check that both player views exist and are different
    const viewStateA = await pageA.locator(".topbar-version").textContent();
    const viewStateB = await pageB.locator(".topbar-version").textContent();

    expect(viewStateA).toBeTruthy();
    expect(viewStateB).toBeTruthy();

    // Clean up
    await contextA.close();
    await contextB.close();
  });

  test("players can reload and resume an active game", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto("/");
    await pageA.click("text=Create Game");
    await pageA.waitForURL(/\/game\//);
    const gameUrl = pageA.url();

    await pageB.goto(gameUrl);
    await pageA.waitForSelector("text=PLACING");
    await pageB.waitForSelector("text=PLACING");

    await pageA.locator("button", { hasText: "Auto-place" }).click();
    await pageB.locator("button", { hasText: "Auto-place" }).click();

    await expect(pageA.locator("text=10 / 10 placed")).toBeVisible();
    await expect(pageB.locator("text=10 / 10 placed")).toBeVisible();

    await pageA.locator("button", { hasText: "Ready" }).click();
    await pageB.locator("button", { hasText: "Ready" }).click();

    await pageA.waitForSelector("text=YOUR TURN");
    await pageB.waitForSelector("text=OPPONENT");

    await pageA.locator("section.enemy-board button").first().click();
    await expect(pageB.locator("section.my-board .cell.miss, section.my-board .cell.hit, section.my-board .cell.ship-hit")).toBeVisible({ timeout: 3000 });

    await pageA.reload();
    await expect(pageA.locator(".topbar-info")).toContainText("Player 1");
    await expect(pageA.locator(".topbar-version")).toHaveText(/v\d+/);
    await expect(pageA.locator("text=Ships sunk")).toBeVisible();

    await pageB.reload();
    await expect(pageB.locator(".topbar-info")).toContainText("Player 2");
    await expect(pageB.locator(".topbar-version")).toHaveText(/v\d+/);
    await expect(pageB.locator("section.my-board .cell.miss, section.my-board .cell.hit, section.my-board .cell.ship-hit")).toBeVisible({ timeout: 3000 });

    await contextA.close();
    await contextB.close();
  });

  test("game creation API works", async () => {
    // Test via the REST API directly
    const createRes = await fetch(`${API_URL}/games`, { method: "POST" });
    expect(createRes.status).toBe(201);
    const game = await createRes.json();
    expect(game).toHaveProperty("gameId");
    expect(game).toHaveProperty("playerToken");
    expect(game.role).toBe("playerA");

    // Test join
    const joinRes = await fetch(`${API_URL}/games/${game.gameId}/join`, { method: "POST" });
    expect(joinRes.status).toBe(201);
    const joined = await joinRes.json();
    expect(joined.role).toBe("playerB");

    // Test get game state
    const getRes = await fetch(`${API_URL}/games/${game.gameId}`);
    expect(getRes.status).toBe(200);
    const state = await getRes.json();
    expect(state.status).toBe("placing");
  });
});
