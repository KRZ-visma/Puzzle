import { expect, test } from "@playwright/test";

async function openGame(page, { pieces = 12 } = {}) {
  await page.goto(`/?e2e=1`);
  await page.getByTestId("difficulty").selectOption(String(pieces));
  await expect.poll(async () => {
    return page.evaluate(() => window.__PUZZLE__?.getState()?.total ?? 0);
  }).toBe(pieces);
  await expect(page.getByTestId("playfield")).toBeVisible();
  await expect(page.getByTestId("progress")).toContainText(`0/${pieces}`);
}

test.describe("Jigsaw playfield flows", () => {
  test("loads a new game with canvas playfield and version", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await expect(page.getByTestId("status")).toContainText(/Drag pieces|Shuffling|Cutting/i);
    await expect(page.getByTestId("app-version")).toHaveText(/^(dev|.+)$/);
    await expect(page.getByTestId("group-count")).toHaveText("12");
  });

  test("uses a large playfield and disables page zoom and text selection", async ({ page }) => {
    await openGame(page, { pieces: 12 });

    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport ?? "").toMatch(/maximum-scale\s*=\s*1/i);
    expect(viewport ?? "").toMatch(/user-scalable\s*=\s*no/i);

    const userSelect = await page.evaluate(() => getComputedStyle(document.body).userSelect);
    expect(userSelect).toBe("none");

    const box = await page.getByTestId("playfield").boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(900);
    expect(box.height).toBeGreaterThanOrEqual(520);
  });

  test("assembling a piece onto the board updates progress", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.evaluate(() => window.__PUZZLE__.assemblePiece(0));
    await expect(page.getByTestId("progress")).toContainText("1/12");
    await expect(page.getByTestId("status")).toContainText(/Snapped to the board|Keep connecting|Drag pieces/i);
  });

  test("connecting neighbors reduces group count", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.evaluate(() => window.__PUZZLE__.connectNeighbors(0, "right"));
    await expect(page.getByTestId("group-count")).toHaveText("11");
  });

  test("solving the puzzle shows the win modal", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.evaluate(() => window.__PUZZLE__.solve());
    await expect(page.getByTestId("win-modal")).toBeVisible();
    await expect(page.getByTestId("status")).toHaveText("Puzzle complete!");
    await expect(page.getByTestId("progress")).toContainText("12/12");
    await expect(page.getByTestId("group-count")).toHaveText("1");
  });

  test("shuffle and difficulty change rebuild the playfield", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.evaluate(() => window.__PUZZLE__.assemblePiece(1));
    await expect(page.getByTestId("progress")).toContainText("1/12");

    await page.getByTestId("shuffle").click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? -1);
    }).toBe(0);
    await expect(page.getByTestId("group-count")).toHaveText("12");

    await page.getByTestId("difficulty").selectOption("48");
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.total ?? 0);
    }).toBe(48);
    await expect(page.getByTestId("progress")).toContainText("0/48");
  });

  test("1000-piece difficulty initializes without crashing", async ({ page }) => {
    await page.goto(`/?e2e=1`);
    await page.getByTestId("difficulty").selectOption("1000");
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.total ?? 0);
    }, { timeout: 30_000 }).toBe(1000);
    await expect(page.getByTestId("playfield")).toBeVisible();
    await expect(page.getByTestId("progress")).toContainText("0/1000");
  });
});
