import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LAYOUT_MODE,
  LAYOUT_BASKETS,
  LAYOUT_SCATTER,
  LAYOUT_SIDE_TRAYS,
  layoutRegions,
  normalizeLayoutMode,
  placeInBaskets,
  placeInSideTrays,
  placePieces,
  placeScattered,
  shuffleIds,
} from "../../js/layout.js";

function fixedRng(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

const layout = {
  cols: 4,
  rows: 3,
  pieceW: 40,
  pieceH: 30,
  originX: 160,
  originY: 80,
  cssW: 800,
  cssH: 500,
};

test("normalizeLayoutMode accepts known modes and falls back", () => {
  assert.equal(normalizeLayoutMode("scatter"), LAYOUT_SCATTER);
  assert.equal(normalizeLayoutMode("sideTrays"), LAYOUT_SIDE_TRAYS);
  assert.equal(normalizeLayoutMode("baskets"), LAYOUT_BASKETS);
  assert.equal(normalizeLayoutMode("nope"), DEFAULT_LAYOUT_MODE);
  assert.equal(normalizeLayoutMode(null), DEFAULT_LAYOUT_MODE);
});

test("shuffleIds permutes 0..n-1 with a seeded rng", () => {
  const ids = shuffleIds(5, fixedRng([0.9, 0.1, 0.5, 0.2]));
  assert.equal(ids.length, 5);
  assert.deepEqual([...ids].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
});

test("placeScattered keeps every piece on-canvas", () => {
  const positions = placeScattered({ ...layout, rng: fixedRng([0.1, 0.2, 0.3, 0.4]) });
  assert.equal(positions.length, 12);
  for (const p of positions) {
    assert.ok(p.x >= 0);
    assert.ok(p.y >= 0);
    assert.ok(p.x <= layout.cssW - layout.pieceW);
    assert.ok(p.y <= layout.cssH - layout.pieceH);
  }
});

test("layoutRegions returns left/right trays for sideTrays", () => {
  const regions = layoutRegions(LAYOUT_SIDE_TRAYS, layout);
  assert.equal(regions.length, 2);
  assert.equal(regions[0].id, "left");
  assert.equal(regions[1].id, "right");
  assert.ok(regions[0].x + regions[0].w <= layout.originX + 1);
  assert.ok(regions[1].x >= layout.originX + layout.cols * layout.pieceW - 1);
});

test("layoutRegions returns four corner baskets", () => {
  const regions = layoutRegions(LAYOUT_BASKETS, layout);
  assert.equal(regions.length, 4);
  assert.deepEqual(
    regions.map((r) => r.id),
    ["nw", "ne", "sw", "se"]
  );
});

test("placeInSideTrays puts pieces into left and right trays", () => {
  const regions = layoutRegions(LAYOUT_SIDE_TRAYS, layout);
  const positions = placeInSideTrays(layout, fixedRng([0.2, 0.4, 0.6, 0.8]));
  assert.equal(positions.length, 12);

  let leftish = 0;
  let rightish = 0;
  const midX = layout.originX + (layout.cols * layout.pieceW) / 2;
  for (const p of positions) {
    const cx = p.x + layout.pieceW / 2;
    if (cx < midX) leftish += 1;
    else rightish += 1;
    assert.ok(p.x >= 0 && p.y >= 0);
  }
  assert.ok(leftish >= 4);
  assert.ok(rightish >= 4);

  // Most piece centers should land near a tray region.
  let nearTray = 0;
  for (const p of positions) {
    const cx = p.x + layout.pieceW / 2;
    const cy = p.y + layout.pieceH / 2;
    if (
      regions.some(
        (r) =>
          cx >= r.x - layout.pieceW &&
          cx <= r.x + r.w + layout.pieceW &&
          cy >= r.y - layout.pieceH &&
          cy <= r.y + r.h + layout.pieceH
      )
    ) {
      nearTray += 1;
    }
  }
  assert.equal(nearTray, 12);
});

test("placeInBaskets piles pieces near the four corner baskets", () => {
  const regions = layoutRegions(LAYOUT_BASKETS, layout);
  const positions = placeInBaskets(layout, fixedRng([0.15, 0.35, 0.55, 0.75, 0.95]));
  assert.equal(positions.length, 12);

  let nearBasket = 0;
  for (const p of positions) {
    const cx = p.x + layout.pieceW / 2;
    const cy = p.y + layout.pieceH / 2;
    if (
      regions.some(
        (r) =>
          cx >= r.x - layout.pieceW * 0.5 &&
          cx <= r.x + r.w + layout.pieceW * 0.5 &&
          cy >= r.y - layout.pieceH * 0.5 &&
          cy <= r.y + r.h + layout.pieceH * 0.5
      )
    ) {
      nearBasket += 1;
    }
  }
  assert.ok(nearBasket >= 10);
});

test("placePieces dispatches by mode", () => {
  const scatter = placePieces(LAYOUT_SCATTER, layout, () => 0.25);
  const trays = placePieces(LAYOUT_SIDE_TRAYS, layout, () => 0.25);
  const baskets = placePieces(LAYOUT_BASKETS, layout, () => 0.25);
  assert.equal(scatter.length, 12);
  assert.equal(trays.length, 12);
  assert.equal(baskets.length, 12);
  assert.notDeepEqual(scatter, trays);
  assert.notDeepEqual(trays, baskets);
});
