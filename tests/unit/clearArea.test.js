import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearPuzzleArea,
  groupBounds,
  keepOutBounds,
  rectsOverlap,
  translationOffBoard,
} from "../../js/clearArea.js";
import { createGroups, groupCount, mergeGroups, membersOf } from "../../js/groups.js";

/** Orthogonal distance between two non-overlapping AABBs (0 if overlapping). */
function axisGap(a, b) {
  const gapX = Math.max(0, Math.max(b.minX - a.maxX, a.minX - b.maxX));
  const gapY = Math.max(0, Math.max(b.minY - a.maxY, a.minY - b.maxY));
  if (gapX > 0 && gapY > 0) return Math.min(gapX, gapY);
  return gapX + gapY;
}

test("groupBounds covers every piece body in the cluster", () => {
  const bounds = groupBounds(
    [0, 1],
    [
      { x: 10, y: 20 },
      { x: 40, y: 30 },
    ],
    20,
    15
  );
  assert.deepEqual(bounds, {
    minX: 10,
    minY: 20,
    maxX: 60,
    maxY: 45,
    width: 50,
    height: 25,
  });
});

test("rectsOverlap detects board intersections", () => {
  const board = { minX: 100, minY: 100, maxX: 200, maxY: 200 };
  assert.equal(rectsOverlap({ minX: 150, minY: 150, maxX: 160, maxY: 160 }, board), true);
  assert.equal(rectsOverlap({ minX: 0, minY: 0, maxX: 50, maxY: 50 }, board), false);
  assert.equal(rectsOverlap({ minX: 200, minY: 100, maxX: 220, maxY: 120 }, board), false);
});

test("keepOutBounds expands the board by one piece on each side", () => {
  const board = { minX: 100, minY: 80, maxX: 300, maxY: 220 };
  assert.deepEqual(keepOutBounds(board, 40, 30), {
    minX: 60,
    minY: 50,
    maxX: 340,
    maxY: 250,
  });
});

test("translationOffBoard clears the board and prefers on-canvas placement", () => {
  const board = { minX: 100, minY: 80, maxX: 300, maxY: 220 };
  const bounds = { minX: 140, minY: 100, maxX: 180, maxY: 140, width: 40, height: 40 };
  const pieceW = 40;
  const pieceH = 40;
  const { dx, dy } = translationOffBoard(bounds, board, 400, 300, () => 0.5, pieceW, pieceH);
  const moved = {
    minX: bounds.minX + dx,
    minY: bounds.minY + dy,
    maxX: bounds.maxX + dx,
    maxY: bounds.maxY + dy,
  };
  assert.equal(rectsOverlap(moved, board), false);
  assert.ok(bounds.minX + dx >= 0);
  assert.ok(bounds.minY + dy >= 0);
  assert.ok(bounds.maxX + dx <= 400);
  assert.ok(bounds.maxY + dy <= 300);
  // At least one piece of clearance from the board border.
  assert.ok(axisGap(moved, board) >= Math.min(pieceW, pieceH));
  assert.equal(rectsOverlap(moved, keepOutBounds(board, pieceW, pieceH)), false);
});

test("translationOffBoard leaves one piece of clearance on the move axis", () => {
  const board = { minX: 100, minY: 100, maxX: 200, maxY: 200 };
  const bounds = { minX: 120, minY: 120, maxX: 160, maxY: 160, width: 40, height: 40 };
  const pieceW = 50;
  const pieceH = 30;
  const { dx, dy } = translationOffBoard(bounds, board, 400, 360, () => 0.5, pieceW, pieceH);
  const moved = {
    minX: bounds.minX + dx,
    minY: bounds.minY + dy,
    maxX: bounds.maxX + dx,
    maxY: bounds.maxY + dy,
  };
  assert.equal(rectsOverlap(moved, board), false);

  const gapLeft = board.minX - moved.maxX;
  const gapRight = moved.minX - board.maxX;
  const gapAbove = board.minY - moved.maxY;
  const gapBelow = moved.minY - board.maxY;

  if (gapLeft >= pieceW || gapRight >= pieceW) {
    assert.ok(Math.max(gapLeft, gapRight) >= pieceW);
  } else if (gapAbove >= pieceH || gapBelow >= pieceH) {
    assert.ok(Math.max(gapAbove, gapBelow) >= pieceH);
  } else {
    assert.fail(
      `expected one-piece clearance; gaps L/R/A/B=${gapLeft}/${gapRight}/${gapAbove}/${gapBelow}`
    );
  }
});

test("translationOffBoard moves pieces that sit only in the border margin", () => {
  const board = { minX: 100, minY: 100, maxX: 200, maxY: 200 };
  const pieceW = 40;
  const pieceH = 40;
  // Outside the board, but inside the one-piece keep-out strip above it.
  const bounds = { minX: 120, minY: 70, maxX: 160, maxY: 95, width: 40, height: 25 };
  assert.equal(rectsOverlap(bounds, board), false);
  assert.equal(rectsOverlap(bounds, keepOutBounds(board, pieceW, pieceH)), true);

  const { dx, dy } = translationOffBoard(bounds, board, 400, 360, () => 0.5, pieceW, pieceH);
  assert.ok(dx !== 0 || dy !== 0);
  const moved = {
    minX: bounds.minX + dx,
    minY: bounds.minY + dy,
    maxX: bounds.maxX + dx,
    maxY: bounds.maxY + dy,
  };
  assert.equal(rectsOverlap(moved, keepOutBounds(board, pieceW, pieceH)), false);
});

test("translationOffBoard is a no-op when already clear of the keep-out zone", () => {
  const board = { minX: 100, minY: 100, maxX: 200, maxY: 200 };
  const bounds = { minX: 0, minY: 0, maxX: 40, maxY: 40, width: 40, height: 40 };
  assert.deepEqual(translationOffBoard(bounds, board, 400, 300, () => 0, 40, 40), { dx: 0, dy: 0 });
});

test("clearPuzzleArea moves overlapping groups while keeping relative offsets", () => {
  const groups = createGroups(4);
  const positions = [
    { x: 100, y: 100 },
    { x: 140, y: 100 },
    // Fully outside the keep-out margin (board 80–160, piece 40 → keepOut 40–200).
    { x: 0, y: 0 },
    { x: 250, y: 250 },
  ];
  mergeGroups(groups, positions, 1, 0, 0, 0);
  assert.equal(groupCount(groups), 3);

  const beforeOffset = {
    x: positions[1].x - positions[0].x,
    y: positions[1].y - positions[0].y,
  };
  const outsideBefore = { ...positions[2] };

  const pieceW = 40;
  const pieceH = 40;
  const moved = clearPuzzleArea({
    groups,
    positions,
    cols: 2,
    rows: 2,
    pieceW,
    pieceH,
    originX: 80,
    originY: 80,
    cssW: 400,
    cssH: 320,
    rng: () => 0.25,
  });

  assert.ok(moved >= 1);
  assert.equal(groupCount(groups), 3);
  assert.equal(membersOf(groups, 0).size, 2);
  assert.deepEqual(
    {
      x: positions[1].x - positions[0].x,
      y: positions[1].y - positions[0].y,
    },
    beforeOffset
  );
  assert.deepEqual(positions[2], outsideBefore);

  const board = { minX: 80, minY: 80, maxX: 160, maxY: 160 };
  const group0 = groupBounds(membersOf(groups, 0), positions, pieceW, pieceH);
  assert.equal(rectsOverlap(group0, board), false);
  assert.ok(axisGap(group0, board) >= Math.min(pieceW, pieceH));
  assert.equal(rectsOverlap(group0, keepOutBounds(board, pieceW, pieceH)), false);
});

test("clearPuzzleArea moves unlocked pieces that sit in the border margin", () => {
  const pieceW = 40;
  const pieceH = 40;
  const originX = 80;
  const originY = 80;
  const cols = 2;
  const rows = 2;
  const board = {
    minX: originX,
    minY: originY,
    maxX: originX + cols * pieceW,
    maxY: originY + rows * pieceH,
  };
  const keepOut = keepOutBounds(board, pieceW, pieceH);
  const groups = createGroups(4);
  // Piece 0 sits just outside the board, inside the top margin strip.
  // maxY = originY - 8 (no board overlap); still inside keepOut (minY = originY - pieceH).
  const positions = [
    { x: originX + 10, y: originY - pieceH - 8 },
    { x: 0, y: 0 },
    { x: 250, y: 250 },
    { x: 300, y: 0 },
  ];
  assert.equal(rectsOverlap(groupBounds([0], positions, pieceW, pieceH), board), false);
  assert.equal(rectsOverlap(groupBounds([0], positions, pieceW, pieceH), keepOut), true);

  const marginBefore = { ...positions[0] };
  const farBefore = { ...positions[1] };

  const moved = clearPuzzleArea({
    groups,
    positions,
    cols,
    rows,
    pieceW,
    pieceH,
    originX,
    originY,
    cssW: 400,
    cssH: 320,
    rng: () => 0.3,
  });

  assert.equal(moved, 1);
  assert.notDeepEqual(positions[0], marginBefore);
  assert.deepEqual(positions[1], farBefore);
  assert.equal(rectsOverlap(groupBounds([0], positions, pieceW, pieceH), keepOut), false);
});

test("clearPuzzleArea leaves board-locked groups on their seats", () => {
  const pieceW = 40;
  const pieceH = 40;
  const originX = 80;
  const originY = 80;
  const cols = 2;
  const rows = 2;
  const groups = createGroups(4);
  // Piece 0 locked on its solved seat; piece 1 overlapping the board unlocked.
  const positions = [
    { x: originX, y: originY },
    { x: originX + 10, y: originY + 10 },
    // Fully outside keep-out (board 80–160 → keepOut 40–200).
    { x: 0, y: 0 },
    { x: 250, y: 250 },
  ];
  const lockedBefore = { ...positions[0] };
  const unlockedBefore = { ...positions[1] };
  const outsideBefore = { ...positions[2] };

  const moved = clearPuzzleArea({
    groups,
    positions,
    cols,
    rows,
    pieceW,
    pieceH,
    originX,
    originY,
    cssW: 400,
    cssH: 320,
    rng: () => 0.25,
  });

  assert.equal(moved, 1);
  assert.deepEqual(positions[0], lockedBefore);
  assert.notDeepEqual(positions[1], unlockedBefore);
  assert.deepEqual(positions[2], outsideBefore);

  const board = {
    minX: originX,
    minY: originY,
    maxX: originX + cols * pieceW,
    maxY: originY + rows * pieceH,
  };
  assert.equal(
    rectsOverlap(groupBounds([1], positions, pieceW, pieceH), board),
    false
  );
  assert.equal(
    rectsOverlap(groupBounds([0], positions, pieceW, pieceH), board),
    true
  );
});

test("clearPuzzleArea does not move a locked multi-piece group", () => {
  const pieceW = 40;
  const pieceH = 40;
  const originX = 80;
  const originY = 80;
  const groups = createGroups(4);
  // Pieces 0+1 seated and merged → locked group covering the top row.
  const positions = [
    { x: originX, y: originY },
    { x: originX + pieceW, y: originY },
    { x: originX + 5, y: originY + pieceH + 5 },
    { x: 0, y: 0 },
  ];
  mergeGroups(groups, positions, 1, 0, 0, 0);

  const locked0 = { ...positions[0] };
  const locked1 = { ...positions[1] };
  const strayBefore = { ...positions[2] };

  const moved = clearPuzzleArea({
    groups,
    positions,
    cols: 2,
    rows: 2,
    pieceW,
    pieceH,
    originX,
    originY,
    cssW: 400,
    cssH: 320,
    rng: () => 0.4,
  });

  assert.equal(moved, 1);
  assert.deepEqual(positions[0], locked0);
  assert.deepEqual(positions[1], locked1);
  assert.notDeepEqual(positions[2], strayBefore);
  assert.equal(membersOf(groups, 0).size, 2);
});
