import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LAYOUT_MODE,
  LAYOUT_SCATTER,
  LAYOUT_SIDE_TRAYS,
  layoutRegions,
  normalizeLayoutMode,
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
  assert.equal(normalizeLayoutMode("baskets"), DEFAULT_LAYOUT_MODE);
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

test("layoutRegions returns none for scatter", () => {
  assert.deepEqual(layoutRegions(LAYOUT_SCATTER, layout), []);
});

test("placeInSideTrays puts pieces into left and right trays without stacking", () => {
  const regions = layoutRegions(LAYOUT_SIDE_TRAYS, layout);
  const positions = placeInSideTrays(layout, fixedRng([0.2, 0.4, 0.6, 0.8]));
  assert.equal(positions.length, 12);

  let leftish = 0;
  let rightish = 0;
  const midX = layout.originX + (layout.cols * layout.pieceW) / 2;
  /** @type {{ x: number, y: number }[]} */
  const leftPositions = [];
  /** @type {{ x: number, y: number }[]} */
  const rightPositions = [];
  for (const p of positions) {
    const cx = p.x + layout.pieceW / 2;
    if (cx < midX) {
      leftish += 1;
      leftPositions.push(p);
    } else {
      rightish += 1;
      rightPositions.push(p);
    }
    assert.ok(p.x >= 0 && p.y >= 0);
  }
  assert.ok(leftish >= 4);
  assert.ok(rightish >= 4);

  function assertNoOverlap(list) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const overlapX = a.x < b.x + layout.pieceW && a.x + layout.pieceW > b.x;
        const overlapY = a.y < b.y + layout.pieceH && a.y + layout.pieceH > b.y;
        assert.equal(overlapX && overlapY, false);
      }
    }
  }
  assertNoOverlap(leftPositions);
  assertNoOverlap(rightPositions);

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

test("placePieces dispatches by mode", () => {
  const scatter = placePieces(LAYOUT_SCATTER, layout, () => 0.25);
  const trays = placePieces(LAYOUT_SIDE_TRAYS, layout, () => 0.25);
  assert.equal(scatter.length, 12);
  assert.equal(trays.length, 12);
  assert.notDeepEqual(scatter, trays);
});
