import { expect, test } from "@playwright/test";

async function openGame(page, { pieces = 12, imageId } = {}) {
  await page.goto(`/?e2e=1`);
  await expect(page.getByTestId("start-modal")).toBeVisible();
  if (imageId) {
    await page.getByTestId(`gallery-option-${imageId}`).click();
  }
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
  test("shows a start menu to choose image and piece count", async ({ page }) => {
    await page.goto(`/?e2e=1`);
    await expect(page.getByTestId("start-modal")).toBeVisible();
    await expect(page.getByTestId("gallery-options")).toBeVisible();
    await expect(page.getByTestId("gallery-option-woods")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("piece-options")).toBeVisible();
    await expect(page.getByTestId("start-puzzle")).toBeVisible();
    await expect(page.getByTestId("start-lead")).toContainText(/Pick an image/i);
    await expect(page.getByTestId("start-lead")).toContainText(/connect tabs/i);
    await expect(page.getByTestId("status")).toHaveText("");
  });

  test("starts a puzzle with the selected gallery image", async ({ page }) => {
    await openGame(page, { pieces: 12, imageId: "waterfall" });
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.imageId ?? "");
    }).toBe("waterfall");
    await page.getByTestId("menu-toggle").click();
    await page.getByTestId("preview").click();
    await expect(page.getByTestId("preview-image")).toHaveAttribute(
      "src",
      /assets\/gallery\/waterfall\.jpg$/
    );
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
    await expect(page.getByTestId("status")).toContainText(/Locked on the board|Keep connecting|Drag pieces/i);
  });

  test("pieces locked on the board cannot be moved", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.evaluate(() => window.__PUZZLE__.assemblePiece(0));
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.isPieceLocked?.(0) ?? false);
    }).toBe(true);
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.locked ?? 0);
    }).toBe(1);

    const result = await page.evaluate(() => {
      const before = window.__PUZZLE__.getState().positions[0];
      const moved = window.__PUZZLE__.tryMoveGroup(0, 40, -30);
      const after = window.__PUZZLE__.getState().positions[0];
      return { moved, before, after };
    });
    expect(result.moved).toBe(false);
    expect(result.after).toEqual(result.before);
  });

  test("connecting a free neighbor onto a locked piece keeps the board fixed", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await page.evaluate(() => {
      window.__PUZZLE__.assemblePiece(0);
      window.__PUZZLE__.assemblePiece(1);
    });
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? 0);
    }).toBe(2);
    // Two separately locked neighbors merge in place into one board group.
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.groups ?? 0);
    }).toBe(11);
    await expect.poll(async () => {
      return page.evaluate(
        () => window.__PUZZLE__?.isPieceLocked?.(0) && window.__PUZZLE__?.isPieceLocked?.(1)
      );
    }).toBe(true);
    const moved = await page.evaluate(() => window.__PUZZLE__.tryMoveGroup(0, 25, 25));
    expect(moved).toBe(false);
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

  test("remembers piece count, image, and progress when the app is reopened", async ({ page }) => {
    await page.goto(`/?e2e=1`);
    await page.getByTestId("gallery-option-forest").click();
    await page.getByTestId("piece-option-48").click();
    await page.getByTestId("start-puzzle").click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.total ?? 0);
    }).toBe(48);
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.imageId ?? "");
    }).toBe("forest");
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
      return page.evaluate(() => window.__PUZZLE__?.getState()?.imageId ?? "");
    }).toBe("forest");
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

  test("1000-piece difficulty initializes without crashing", async ({ page }) => {
    await openGame(page, { pieces: 1000 });
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.total ?? 0);
    }, { timeout: 30_000 }).toBe(1000);
    await expect(page.getByTestId("playfield")).toBeVisible();
  });

  test("zoom controls change the playfield camera", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await expect(page.getByTestId("zoom-controls")).toBeVisible();
    await expect(page.getByTestId("zoom-reset")).toHaveText("100%");

    await page.getByTestId("zoom-in").click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getCamera()?.scale ?? 0);
    }).toBeGreaterThan(1);
    await expect(page.getByTestId("zoom-reset")).not.toHaveText("100%");

    await page.getByTestId("zoom-reset").click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getCamera()?.scale ?? 0);
    }).toBe(1);
    await expect(page.getByTestId("zoom-reset")).toHaveText("100%");

    await page.getByTestId("zoom-out").click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getCamera()?.scale ?? 2);
    }).toBeLessThan(1);

    await page.evaluate(() => window.__PUZZLE__.setCamera({ scale: 2, panX: 12, panY: -8 }));
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.camera?.scale ?? 0);
    }).toBe(2);
  });

  test("clear-area button moves board pieces outside while keeping groups", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await expect(page.getByTestId("clear-area")).toBeVisible();
    await expect(page.getByTestId("clear-area")).toHaveAttribute("aria-label", /clear puzzle area/i);

    await page.evaluate(() => {
      window.__PUZZLE__.connectNeighbors(0, "right");
      window.__PUZZLE__.assemblePiece(0);
    });

    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? 0);
    }).toBeGreaterThan(0);

    const before = await page.evaluate(() => {
      const state = window.__PUZZLE__.getState();
      return {
        groups: state.groups,
        offset: {
          x: state.positions[1].x - state.positions[0].x,
          y: state.positions[1].y - state.positions[0].y,
        },
      };
    });
    expect(before.groups).toBeLessThan(12);

    await page.getByTestId("clear-area").click();

    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? -1);
    }).toBe(0);

    const after = await page.evaluate(() => {
      const state = window.__PUZZLE__.getState();
      const { pieceW, pieceH, originX, originY, cols, rows } = {
        ...state.layout,
        cols: state.cols,
        rows: state.rows,
      };
      const board = {
        minX: originX,
        minY: originY,
        maxX: originX + cols * pieceW,
        maxY: originY + rows * pieceH,
      };
      let overlapsBoard = false;
      for (const pos of state.positions) {
        const body = {
          minX: pos.x,
          minY: pos.y,
          maxX: pos.x + pieceW,
          maxY: pos.y + pieceH,
        };
        const hit = !(
          body.maxX <= board.minX ||
          body.minX >= board.maxX ||
          body.maxY <= board.minY ||
          body.minY >= board.maxY
        );
        if (hit) overlapsBoard = true;
      }
      return {
        groups: state.groups,
        offset: {
          x: state.positions[1].x - state.positions[0].x,
          y: state.positions[1].y - state.positions[0].y,
        },
        overlapsBoard,
      };
    });

    expect(after.groups).toBe(before.groups);
    expect(after.offset).toEqual(before.offset);
    expect(after.overlapsBoard).toBe(false);
  });
});
