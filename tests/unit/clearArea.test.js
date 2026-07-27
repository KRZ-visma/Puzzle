import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearPuzzleArea,
  groupBounds,
  rectsOverlap,
  translationOffBoard,
} from "../../js/clearArea.js";
import { createGroups, groupCount, mergeGroups, membersOf } from "../../js/groups.js";

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

test("translationOffBoard clears the board and prefers on-canvas placement", () => {
  const board = { minX: 100, minY: 80, maxX: 300, maxY: 220 };
  const bounds = { minX: 140, minY: 100, maxX: 180, maxY: 140, width: 40, height: 40 };
  const { dx, dy } = translationOffBoard(bounds, board, 400, 300, () => 0.5);
  assert.equal(rectsOverlap(
    {
      minX: bounds.minX + dx,
      minY: bounds.minY + dy,
      maxX: bounds.maxX + dx,
      maxY: bounds.maxY + dy,
    },
    board
  ), false);
  assert.ok(bounds.minX + dx >= 0);
  assert.ok(bounds.minY + dy >= 0);
  assert.ok(bounds.maxX + dx <= 400);
  assert.ok(bounds.maxY + dy <= 300);
});

test("translationOffBoard is a no-op when already clear", () => {
  const board = { minX: 100, minY: 100, maxX: 200, maxY: 200 };
  const bounds = { minX: 0, minY: 0, maxX: 40, maxY: 40, width: 40, height: 40 };
  assert.deepEqual(translationOffBoard(bounds, board, 400, 300, () => 0), { dx: 0, dy: 0 });
});

test("clearPuzzleArea moves overlapping groups while keeping relative offsets", () => {
  const groups = createGroups(4);
  const positions = [
    { x: 100, y: 100 },
    { x: 140, y: 100 },
    { x: 10, y: 10 },
    { x: 200, y: 200 },
  ];
  mergeGroups(groups, positions, 1, 0, 0, 0);
  assert.equal(groupCount(groups), 3);

  const beforeOffset = {
    x: positions[1].x - positions[0].x,
    y: positions[1].y - positions[0].y,
  };
  const outsideBefore = { ...positions[2] };

  const moved = clearPuzzleArea({
    groups,
    positions,
    cols: 2,
    rows: 2,
    pieceW: 40,
    pieceH: 40,
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
  const group0 = groupBounds(membersOf(groups, 0), positions, 40, 40);
  assert.equal(rectsOverlap(group0, board), false);
});
