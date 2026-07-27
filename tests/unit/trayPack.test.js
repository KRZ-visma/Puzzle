import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignSideTrayIds,
  hitTestTrayPiece,
  packTrayColumn,
  removeTrayId,
  TRAY_GAP,
} from "../../js/trayPack.js";

function fixedRng(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

test("assignSideTrayIds splits pieces across left and right", () => {
  const { leftIds, rightIds } = assignSideTrayIds(12, fixedRng([0.1, 0.8, 0.3, 0.6]));
  assert.equal(leftIds.length + rightIds.length, 12);
  assert.equal(leftIds.length, 6);
  assert.equal(rightIds.length, 6);
  assert.deepEqual([...leftIds, ...rightIds].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("packTrayColumn spaces pieces evenly and grows content height", () => {
  const ids = [0, 1, 2, 3, 4];
  const pieceW = 40;
  const pieceH = 30;
  const packed = packTrayColumn(ids, { trayW: 120, pieceW, pieceH, gap: TRAY_GAP });
  assert.equal(packed.localPositions.size, 5);

  const ys = ids.map((id) => packed.localPositions.get(id).y);
  for (let i = 1; i < ys.length; i += 1) {
    assert.equal(ys[i] - ys[i - 1], pieceH + TRAY_GAP);
  }

  const expectedH = 12 + ids.length * (pieceH + TRAY_GAP) - TRAY_GAP + 12;
  assert.equal(packed.contentH, expectedH);
  // Taller than a typical short viewport → scrollbar territory.
  assert.ok(packed.contentH > 150);
});

test("hitTestTrayPiece finds the topmost piece under a point", () => {
  const ids = [0, 1];
  const packed = packTrayColumn(ids, { trayW: 100, pieceW: 40, pieceH: 30, gap: 10 });
  const first = packed.localPositions.get(0);
  assert.equal(
    hitTestTrayPiece(packed.localPositions, ids, first.x + 5, first.y + 5, 40, 30),
    0
  );
  assert.equal(hitTestTrayPiece(packed.localPositions, ids, 0, 0, 40, 30), null);
});

test("removeTrayId drops a piece from the tray list", () => {
  assert.deepEqual(removeTrayId([1, 2, 3], 2), [1, 3]);
  assert.deepEqual(removeTrayId([1, 2, 3], 9), [1, 2, 3]);
});
