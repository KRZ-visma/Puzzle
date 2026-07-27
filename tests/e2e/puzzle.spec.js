import { expect, test } from "@playwright/test";

async function openGame(page, { pieces = 12 } = {}) {
  await page.goto(`/?e2e=1`);
  await expect(page.getByTestId("start-modal")).toBeVisible();
  await page.getByTestId(`piece-option-${pieces}`).click();
  await page.getByTestId("start-puzzle").click();
  await expect(page.getByTestId("start-modal")).toBeHidden();
  await expect.poll(async () => {
    return page.evaluate(() => window.__PUZZLE__?.getState()?.total ?? 0);
  }).toBe(pieces);
  await expect(page.getByTestId("playfield")).toBeVisible();
  await expect.poll(async () => {
    return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? -1);
  }).toBe(0);
}

test.describe("Jigsaw playfield flows", () => {
  test("shows a start menu to choose piece count", async ({ page }) => {
    await page.goto(`/?e2e=1`);
    await expect(page.getByTestId("start-modal")).toBeVisible();
    await expect(page.getByTestId("piece-options")).toBeVisible();
    await expect(page.getByTestId("start-puzzle")).toBeVisible();
    await expect(page.getByTestId("start-lead")).toContainText(/Choose how many pieces/i);
    await expect(page.getByTestId("start-lead")).toContainText(/connect tabs/i);
    await expect(page.getByTestId("status")).toHaveText("");
  });

  test("loads a new game with canvas playfield and version in the menu", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await expect(page.getByTestId("menu-toggle")).toBeVisible();
    await expect(page.getByTestId("shuffle")).toHaveCount(0);
    await expect(page.getByTestId("difficulty")).toHaveCount(0);
    await expect(page.getByTestId("progress")).toHaveCount(0);
    await expect(page.getByTestId("group-count")).toHaveCount(0);

    await page.getByTestId("menu-toggle").click();
    await expect(page.getByTestId("app-menu")).toBeVisible();
    await expect(page.getByTestId("restart")).toBeVisible();
    await expect(page.getByTestId("preview")).toBeVisible();
    await expect(page.getByTestId("app-version")).toHaveText(/^(dev|.+)$/);
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.groups ?? 0);
    }).toBe(12);
  });

  test("fits a full-bleed playfield in the viewport without page scroll", async ({ page }) => {
    await openGame(page, { pieces: 12 });

    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport ?? "").toMatch(/maximum-scale\s*=\s*1/i);
    expect(viewport ?? "").toMatch(/user-scalable\s*=\s*no/i);

    const userSelect = await page.evaluate(() => getComputedStyle(document.body).userSelect);
    expect(userSelect).toBe("none");

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const box = document.querySelector("[data-testid='playfield']")?.getBoundingClientRect();
      const panel = document.querySelector(".playfield-panel")?.getBoundingClientRect();
      return {
        scrollHeight: doc.scrollHeight,
        clientHeight: doc.clientHeight,
        clientWidth: doc.clientWidth,
        bodyOverflow: getComputedStyle(document.body).overflow,
        playfieldHeight: box?.height ?? 0,
        playfieldWidth: box?.width ?? 0,
        panelHeight: panel?.height ?? 0,
        panelWidth: panel?.width ?? 0,
      };
    });

    expect(metrics.bodyOverflow).toMatch(/hidden/);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
    expect(metrics.panelWidth).toBeGreaterThanOrEqual(metrics.clientWidth - 2);
    expect(metrics.panelHeight).toBeGreaterThanOrEqual(metrics.clientHeight - 2);
    expect(metrics.playfieldWidth).toBeGreaterThanOrEqual(metrics.clientWidth - 2);
    expect(metrics.playfieldHeight).toBeGreaterThanOrEqual(metrics.clientHeight - 2);
  });

  test("assembling a piece onto the board updates progress state", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.evaluate(() => window.__PUZZLE__.assemblePiece(0));
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? 0);
    }).toBe(1);
    await expect(page.getByTestId("status")).toContainText(/Snapped to the board|Keep connecting|Drag pieces/i);
  });

  test("connecting neighbors reduces group count", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.evaluate(() => window.__PUZZLE__.connectNeighbors(0, "right"));
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.groups ?? 0);
    }).toBe(11);
  });

  test("solving the puzzle shows the win modal", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.evaluate(() => window.__PUZZLE__.solve());
    await expect(page.getByTestId("win-modal")).toBeVisible();
    await expect(page.getByTestId("status")).toHaveText("Puzzle complete!");
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? 0);
    }).toBe(12);
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.groups ?? 0);
    }).toBe(1);
  });

  test("play again and restart return to the start menu", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.evaluate(() => window.__PUZZLE__.solve());
    await page.getByTestId("play-again").click();
    await expect(page.getByTestId("win-modal")).toBeHidden();
    await expect(page.getByTestId("start-modal")).toBeVisible();
    await expect(page.getByTestId("piece-option-12")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("start-puzzle").click();
    await expect(page.getByTestId("start-modal")).toBeHidden();
    await page.getByTestId("menu-toggle").click();
    await page.getByTestId("restart").click();
    await expect(page.getByTestId("start-modal")).toBeVisible();
    await expect(page.getByTestId("app-menu")).toBeHidden();
  });

  test("remembers piece count and progress when the app is reopened", async ({ page }) => {
    await page.goto(`/?e2e=1`);
    await page.getByTestId("piece-option-48").click();
    await page.getByTestId("start-puzzle").click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.total ?? 0);
    }).toBe(48);
    await page.evaluate(() => window.__PUZZLE__.assemblePiece(0));
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? 0);
    }).toBe(1);

    await page.reload();
    await expect(page.getByTestId("start-modal")).toBeHidden();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.total ?? 0);
    }).toBe(48);
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? 0);
    }).toBe(1);
  });

  test("hamburger restart clears saved progress", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.evaluate(() => window.__PUZZLE__.assemblePiece(0));
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? 0);
    }).toBe(1);

    await page.getByTestId("menu-toggle").click();
    await page.getByTestId("restart").click();
    await expect(page.getByTestId("start-modal")).toBeVisible();

    await page.getByTestId("start-puzzle").click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? -1);
    }).toBe(0);

    await page.reload();
    await expect(page.getByTestId("start-modal")).toBeHidden();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? -1);
    }).toBe(0);
  });

  test("preview opens from the hamburger menu", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.getByTestId("menu-toggle").click();
    await page.getByTestId("preview").click();
    await expect(page.getByTestId("preview-modal")).toBeVisible();
    await expect(page.getByTestId("app-menu")).toBeHidden();
  });

  test("hard-mode toggles persist and affect preview and snap", async ({ page }) => {
    await openGame(page, { pieces: 12 });

    const defaultThreshold = await page.evaluate(() => window.__PUZZLE__?.getState()?.threshold);
    expect(defaultThreshold).toBeGreaterThan(0);

    await page.getByTestId("menu-toggle").click();
    await expect(page.getByTestId("toggle-hide-background")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("toggle-precise-snap")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("toggle-disable-preview")).toHaveAttribute("aria-checked", "false");

    await page.getByTestId("toggle-hide-background").click();
    await page.getByTestId("toggle-precise-snap").click();
    await page.getByTestId("toggle-disable-preview").click();

    await expect(page.getByTestId("toggle-hide-background")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("toggle-precise-snap")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("toggle-disable-preview")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("preview")).toBeHidden();
    await expect(page.getByTestId("toggle-hide-background-state")).toHaveText("On");

    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.threshold ?? 0);
    }).toBeLessThan(defaultThreshold);

    await page.reload();
    await expect(page.getByTestId("start-modal")).toBeHidden();
    await page.getByTestId("menu-toggle").click();
    await expect(page.getByTestId("toggle-hide-background")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("toggle-precise-snap")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("toggle-disable-preview")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("preview")).toBeHidden();
  });

  test("1000-piece difficulty initializes without crashing", async ({ page }) => {
    await openGame(page, { pieces: 1000 });
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.total ?? 0);
    }, { timeout: 30_000 }).toBe(1000);
    await expect(page.getByTestId("playfield")).toBeVisible();
  });
});
