import { expect, test } from "@playwright/test";

async function openGame(page, { pieces = 12 } = {}) {
  await page.goto(`/?e2e=1`);
  await page.getByTestId("difficulty").selectOption(String(pieces));
  await expect(page.getByTestId("tray").locator(".piece")).toHaveCount(pieces);
  await expect(page.getByTestId("board").locator(".slot")).toHaveCount(pieces);
  await expect(page.getByTestId("progress")).toHaveText(`0/${pieces}`);
}

async function placePiece(page, pieceId, slotId = pieceId) {
  await page.getByTestId("tray").getByTestId(`piece-${pieceId}`).click();
  await page.getByTestId(`slot-${slotId}`).click();
}

test.describe("Puzzle game flows", () => {
  test("loads a new game with board, tray, and version", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await expect(page.getByTestId("status")).toContainText("Pick a piece");
    await expect(page.getByTestId("app-version")).toHaveText(/^(dev|.+)$/);
  });

  test("places a correct piece and locks it", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await placePiece(page, 0, 0);

    await expect(page.getByTestId("progress")).toHaveText("1/12");
    await expect(page.getByTestId("slot-0").locator(".piece.correct")).toHaveCount(1);
    await expect(page.getByTestId("status")).toContainText("locked in");
  });

  test("places an incorrect piece without locking it", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await placePiece(page, 0, 1);

    await expect(page.getByTestId("progress")).toHaveText("1/12");
    await expect(page.getByTestId("slot-1").locator(".piece")).toHaveCount(1);
    await expect(page.getByTestId("slot-1").locator(".piece.correct")).toHaveCount(0);
    await expect(page.getByTestId("status")).toContainText("Keep going");
  });

  test("completes a 12-piece puzzle and shows the win modal", async ({ page }) => {
    await openGame(page, { pieces: 12 });

    for (let id = 0; id < 12; id += 1) {
      await placePiece(page, id, id);
    }

    await expect(page.getByTestId("win-modal")).toBeVisible();
    await expect(page.getByTestId("status")).toHaveText("Puzzle complete!");
    await expect(page.getByTestId("progress")).toHaveText("12/12");
  });

  test("shuffle and difficulty change rebuild the tray", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await placePiece(page, 1, 1);
    await expect(page.getByTestId("progress")).toHaveText("1/12");

    await page.getByTestId("shuffle").click();
    await expect(page.getByTestId("progress")).toHaveText("0/12");
    await expect(page.getByTestId("tray").locator(".piece")).toHaveCount(12);

    await page.getByTestId("difficulty").selectOption("24");
    await expect(page.getByTestId("tray").locator(".piece")).toHaveCount(24);
    await expect(page.getByTestId("progress")).toHaveText("0/24");
  });
});
