import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LAYOUT_MODE,
  LAYOUT_SCATTER,
  normalizeLayoutMode,
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

test("normalizeLayoutMode accepts scatter and falls back for removed modes", () => {
  assert.equal(normalizeLayoutMode("scatter"), LAYOUT_SCATTER);
  assert.equal(normalizeLayoutMode("sideTrays"), DEFAULT_LAYOUT_MODE);
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

test("placePieces uses scatter placement", () => {
  const scatter = placePieces(LAYOUT_SCATTER, layout, () => 0.25);
  const legacyTrays = placePieces("sideTrays", layout, () => 0.25);
  assert.equal(scatter.length, 12);
  assert.deepEqual(legacyTrays, scatter);
});
