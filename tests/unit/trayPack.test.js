import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignSideTrayIds,
  hitTestTrayPiece,
  packTrayColumn,
  removeTrayId,
  trayFitMetrics,
  TRAY_GAP,
  TRAY_PADDING_X,
  TRAY_SCALE_MAX,
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

test("trayFitMetrics scales pieces to fit tray width including tab pad", () => {
  const fit = trayFitMetrics({
    trayW: 100,
    pieceW: 40,
    pieceH: 30,
    pad: 10,
    paddingX: 10,
  });
  // available = 80; visualW = 60 → scale = 80/60
  assert.ok(Math.abs(fit.scale - 80 / 60) < 1e-9);
  assert.ok(Math.abs(fit.drawW - 40 * fit.scale) < 1e-9);
  assert.ok(fit.strideH > fit.drawH);
  assert.ok(fit.scale <= TRAY_SCALE_MAX);
});

test("trayFitMetrics caps scale on wide trays", () => {
  const fit = trayFitMetrics({
    trayW: 400,
    pieceW: 20,
    pieceH: 20,
    pad: 2,
  });
  assert.equal(fit.scale, TRAY_SCALE_MAX);
});

test("packTrayColumn spaces pieces by scaled silhouette and grows content height", () => {
  const ids = [0, 1, 2, 3, 4];
  const pieceW = 40;
  const pieceH = 30;
  const pad = 8;
  const packed = packTrayColumn(ids, { trayW: 120, pieceW, pieceH, pad, gap: TRAY_GAP });
  assert.equal(packed.localPositions.size, 5);
  assert.ok(packed.scale > 0);
  assert.ok(packed.drawW <= 120 - TRAY_PADDING_X * 2);

  const ys = ids.map((id) => packed.localPositions.get(id).y);
  const stride = packed.drawH + packed.pad * 2;
  for (let i = 1; i < ys.length; i += 1) {
    assert.ok(Math.abs(ys[i] - ys[i - 1] - (stride + TRAY_GAP)) < 1e-9);
  }

  // Pieces stay inside the tray horizontally (body + pad).
  for (const id of ids) {
    const pos = packed.localPositions.get(id);
    assert.ok(pos.x - packed.pad >= TRAY_PADDING_X - 1e-6);
    assert.ok(pos.x + packed.drawW + packed.pad <= 120 - TRAY_PADDING_X + 1e-6);
  }

  assert.ok(packed.contentH > 150);
});

test("hitTestTrayPiece finds the topmost piece under a point", () => {
  const ids = [0, 1];
  const packed = packTrayColumn(ids, { trayW: 100, pieceW: 40, pieceH: 30, gap: 10, pad: 0 });
  const first = packed.localPositions.get(0);
  assert.equal(
    hitTestTrayPiece(packed.localPositions, ids, first.x + 5, first.y + 5, packed.drawW, packed.drawH),
    0
  );
  assert.equal(hitTestTrayPiece(packed.localPositions, ids, 0, 0, packed.drawW, packed.drawH), null);
});

test("removeTrayId drops a piece from the tray list", () => {
  assert.deepEqual(removeTrayId([1, 2, 3], 2), [1, 3]);
  assert.deepEqual(removeTrayId([1, 2, 3], 9), [1, 2, 3]);
});
