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
    await expect(page.getByTestId("layout-options")).toHaveCount(0);
    await expect(page.getByTestId("layout-option-sideTrays")).toHaveCount(0);
    await expect(page.getByTestId("side-tray-left")).toHaveCount(0);
    await expect(page.getByTestId("side-tray-right")).toHaveCount(0);
    await expect(page.getByTestId("start-puzzle")).toBeVisible();
    await expect(page.getByTestId("start-lead")).toContainText(/Pick an image/i);
    await expect(page.getByTestId("start-lead")).toContainText(/connect tabs/i);
    await expect(page.getByTestId("status")).toHaveText("");
  });

  test("starts with scatter layout and no side trays", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    const summary = await page.evaluate(() => {
      const state = window.__PUZZLE__.getState();
      return {
        layoutMode: state.layout.layoutMode,
        placed: state.placed,
        total: state.total,
        onCanvas: state.positions.every((p) => p.x >= -1 && p.y >= -1),
      };
    });
    expect(summary.layoutMode).toBe("scatter");
    expect(summary.placed).toBe(0);
    expect(summary.total).toBe(12);
    expect(summary.onCanvas).toBe(true);
    await expect(page.getByTestId("side-tray-left")).toHaveCount(0);
    await expect(page.getByTestId("side-tray-right")).toHaveCount(0);
  });

  test("pieces dragged off the playfield stay clamped inside the canvas", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    const result = await page.evaluate(() => {
      const state = window.__PUZZLE__.getState();
      const { cssW, cssH, pieceW, pieceH } = state.layout;
      window.__PUZZLE__.tryMoveGroup(0, -5000, -5000);
      const pos = window.__PUZZLE__.getState().positions[0];
      window.__PUZZLE__.tryMoveGroup(1, 5000, 5000);
      const posFar = window.__PUZZLE__.getState().positions[1];
      return {
        pos,
        posFar,
        cssW,
        cssH,
        pieceW,
        pieceH,
      };
    });
    expect(result.pos.x).toBeGreaterThanOrEqual(0);
    expect(result.pos.y).toBeGreaterThanOrEqual(0);
    expect(result.posFar.x + result.pieceW).toBeLessThanOrEqual(result.cssW + 0.01);
    expect(result.posFar.y + result.pieceH).toBeLessThanOrEqual(result.cssH + 0.01);
  });

  test("basket controls start empty and can add, move, and remove baskets", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await expect(page.getByTestId("basket-controls")).toBeVisible();
    await expect(page.getByTestId("add-basket")).toBeVisible();
    await expect(page.getByTestId("remove-basket")).toBeDisabled();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.baskets?.baskets?.length ?? -1);
    }).toBe(0);

    await page.getByTestId("add-basket").click();
    await expect(page.getByTestId("remove-basket")).toBeEnabled();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.baskets?.baskets?.length ?? 0);
    }).toBe(1);
    await expect.poll(async () => {
      return page.evaluate(() => {
        const basket = window.__PUZZLE__?.getState()?.baskets?.baskets?.[0];
        return basket ? Math.min(basket.w, basket.h) : 0;
      });
    }).toBeGreaterThanOrEqual(160);

    const moved = await page.evaluate(() => {
      const state = window.__PUZZLE__.getState();
      const basket = state.baskets.baskets[0];
      window.__PUZZLE__.putPieceInBasket(0, basket.id);
      const before = window.__PUZZLE__.getState();
      const pieceBefore = before.positions[0];
      const basketBefore = before.baskets.baskets[0];
      window.__PUZZLE__.tryMoveBasket(basket.id, 30, 20);
      const after = window.__PUZZLE__.getState();
      return {
        pieceDx: after.positions[0].x - pieceBefore.x,
        pieceDy: after.positions[0].y - pieceBefore.y,
        basketDx: after.baskets.baskets[0].x - basketBefore.x,
        basketDy: after.baskets.baskets[0].y - basketBefore.y,
        pieceIds: after.baskets.baskets[0].pieceIds,
      };
    });
    expect(moved.pieceIds).toContain(0);
    expect(moved.pieceDx).toBeCloseTo(moved.basketDx, 5);
    expect(moved.pieceDy).toBeCloseTo(moved.basketDy, 5);
    expect(moved.basketDx).toBeCloseTo(30, 5);
    expect(moved.basketDy).toBeCloseTo(20, 5);

    await page.getByTestId("remove-basket").click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.baskets?.baskets?.length ?? -1);
    }).toBe(0);
    await expect(page.getByTestId("remove-basket")).toBeDisabled();
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

  test("clear-area button moves unlocked board pieces outside while keeping groups", async ({ page }) => {
    await openGame(page, { pieces: 12 });
    await expect(page.getByTestId("clear-area")).toBeVisible();
    await expect(page.getByTestId("clear-area")).toHaveAttribute("aria-label", /clear puzzle area/i);

    // Connect a free group, then park it on the silhouette without locking seats.
    await page.evaluate(() => {
      window.__PUZZLE__.connectNeighbors(0, "right");
      const state = window.__PUZZLE__.getState();
      const { originX, originY } = state.layout;
      const p0 = state.positions[0];
      window.__PUZZLE__.tryMoveGroup(0, originX + 12 - p0.x, originY + 12 - p0.y);
    });

    const before = await page.evaluate(() => {
      const state = window.__PUZZLE__.getState();
      return {
        groups: state.groups,
        placed: state.placed,
        offset: {
          x: state.positions[1].x - state.positions[0].x,
          y: state.positions[1].y - state.positions[0].y,
        },
        overlapsBoard: (() => {
          const { pieceW, pieceH, originX, originY } = state.layout;
          const board = {
            minX: originX,
            minY: originY,
            maxX: originX + state.cols * pieceW,
            maxY: originY + state.rows * pieceH,
          };
          const body = {
            minX: state.positions[0].x,
            minY: state.positions[0].y,
            maxX: state.positions[0].x + pieceW,
            maxY: state.positions[0].y + pieceH,
          };
          return !(
            body.maxX <= board.minX ||
            body.minX >= board.maxX ||
            body.maxY <= board.minY ||
            body.minY >= board.maxY
          );
        })(),
      };
    });
    expect(before.groups).toBeLessThan(12);
    expect(before.placed).toBe(0);
    expect(before.overlapsBoard).toBe(true);

    await page.getByTestId("clear-area").click();

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
      let clearedHasOnePieceGap = true;
      const clearedIds = [0, 1];
      for (let id = 0; id < state.positions.length; id += 1) {
        const pos = state.positions[id];
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
        if (clearedIds.includes(id)) {
          const gapX = Math.max(0, Math.max(board.minX - body.maxX, body.minX - board.maxX));
          const gapY = Math.max(0, Math.max(board.minY - body.maxY, body.minY - board.maxY));
          // One-piece clearance on the primary axis (diagonal corner cases can have a small secondary gap).
          if (!(gapX >= pieceW || gapY >= pieceH)) clearedHasOnePieceGap = false;
        }
      }
      return {
        groups: state.groups,
        placed: state.placed,
        offset: {
          x: state.positions[1].x - state.positions[0].x,
          y: state.positions[1].y - state.positions[0].y,
        },
        overlapsBoard,
        clearedHasOnePieceGap,
      };
    });

    expect(after.groups).toBe(before.groups);
    expect(after.offset).toEqual(before.offset);
    expect(after.placed).toBe(0);
    expect(after.overlapsBoard).toBe(false);
    expect(after.clearedHasOnePieceGap).toBe(true);
  });

  test("clear-area button leaves board-locked pieces in place", async ({ page }) => {
    await openGame(page, { pieces: 12 });

    await page.evaluate(() => {
      window.__PUZZLE__.assemblePiece(0);
      window.__PUZZLE__.assemblePiece(1);
      // Also park an unlocked piece on the silhouette so clear still has work to do.
      const state = window.__PUZZLE__.getState();
      const { originX, originY, pieceW, pieceH } = state.layout;
      const p2 = state.positions[2];
      window.__PUZZLE__.tryMoveGroup(
        2,
        originX + pieceW * 0.5 - p2.x,
        originY + pieceH * 0.5 - p2.y
      );
    });

    await expect.poll(async () => {
      return page.evaluate(() => window.__PUZZLE__?.getState()?.placed ?? 0);
    }).toBe(2);

    const before = await page.evaluate(() => {
      const state = window.__PUZZLE__.getState();
      return {
        placed: state.placed,
        p0: { ...state.positions[0] },
        p1: { ...state.positions[1] },
        p2: { ...state.positions[2] },
        locked0: window.__PUZZLE__.isPieceLocked(0),
        locked1: window.__PUZZLE__.isPieceLocked(1),
        locked2: window.__PUZZLE__.isPieceLocked(2),
      };
    });
    expect(before.locked0).toBe(true);
    expect(before.locked1).toBe(true);
    expect(before.locked2).toBe(false);

    await page.getByTestId("clear-area").click();

    const after = await page.evaluate(() => {
      const state = window.__PUZZLE__.getState();
      const { pieceW, pieceH, originX, originY } = state.layout;
      const board = {
        minX: originX,
        minY: originY,
        maxX: originX + state.cols * pieceW,
        maxY: originY + state.rows * pieceH,
      };
      const body2 = {
        minX: state.positions[2].x,
        minY: state.positions[2].y,
        maxX: state.positions[2].x + pieceW,
        maxY: state.positions[2].y + pieceH,
      };
      const piece2Overlaps = !(
        body2.maxX <= board.minX ||
        body2.minX >= board.maxX ||
        body2.maxY <= board.minY ||
        body2.minY >= board.maxY
      );
      return {
        placed: state.placed,
        p0: { ...state.positions[0] },
        p1: { ...state.positions[1] },
        p2: { ...state.positions[2] },
        locked0: window.__PUZZLE__.isPieceLocked(0),
        locked1: window.__PUZZLE__.isPieceLocked(1),
        piece2Overlaps,
      };
    });

    expect(after.placed).toBe(2);
    expect(after.p0).toEqual(before.p0);
    expect(after.p1).toEqual(before.p1);
    expect(after.locked0).toBe(true);
    expect(after.locked1).toBe(true);
    expect(after.p2).not.toEqual(before.p2);
    expect(after.piece2Overlaps).toBe(false);
  });
});
