import assert from "node:assert/strict";
import { test } from "node:test";
import { createGroups, groupIdOf } from "../../js/groups.js";
import {
  countPlacedPieces,
  distance,
  isGroupOnBoard,
  isPieceOnSeat,
  isPuzzleSolved,
  snapGroupToBoard,
  snapGroupToNeighbors,
} from "../../js/snap.js";

test("distance is Euclidean", () => {
  assert.equal(distance(0, 0, 3, 4), 5);
});

test("snapGroupToNeighbors merges when within threshold", () => {
  const groups = createGroups(2);
  const positions = [
    { x: 0, y: 0 },
    { x: 102, y: 1 },
  ];
  const merges = snapGroupToNeighbors({
    activePieceId: 0,
    groups,
    positions,
    cols: 2,
    rows: 1,
    pieceW: 100,
    pieceH: 80,
    threshold: 10,
  });
  assert.equal(merges, 1);
  assert.equal(groups.members.size, 1);
  assert.deepEqual(positions[1], { x: 100, y: 0 });
});

test("snapGroupToBoard locks a nearby piece to the origin grid", () => {
  const groups = createGroups(1);
  const positions = [{ x: 108, y: 54 }];
  const snapped = snapGroupToBoard({
    activePieceId: 0,
    groups,
    positions,
    cols: 2,
    pieceW: 100,
    pieceH: 50,
    originX: 100,
    originY: 50,
    threshold: 20,
  });
  assert.equal(snapped, true);
  assert.deepEqual(positions[0], { x: 100, y: 50 });
});

test("isPieceOnSeat and isGroupOnBoard detect board locks", () => {
  const groups = createGroups(2);
  const positions = [
    { x: 100, y: 50 },
    { x: 200, y: 50 },
  ];
  assert.equal(isPieceOnSeat(positions, 0, 2, 100, 50, 100, 50), true);
  assert.equal(isPieceOnSeat(positions, 1, 2, 100, 50, 100, 50), true);
  assert.equal(isGroupOnBoard(groups, positions, 0, 2, 100, 50, 100, 50), true);

  positions[1].x = 210;
  assert.equal(isPieceOnSeat(positions, 1, 2, 100, 50, 100, 50), false);
  assert.equal(isGroupOnBoard(groups, positions, 1, 2, 100, 50, 100, 50), false);
});

test("snapGroupToNeighbors keeps a board-locked group fixed", () => {
  const groups = createGroups(2);
  // Piece 0 is locked on its solved seat; piece 1 is near the neighbor slot.
  const positions = [
    { x: 100, y: 50 },
    { x: 205, y: 52 },
  ];
  const merges = snapGroupToNeighbors({
    activePieceId: 1,
    groups,
    positions,
    cols: 2,
    rows: 1,
    pieceW: 100,
    pieceH: 50,
    threshold: 20,
    originX: 100,
    originY: 50,
  });
  assert.equal(merges, 1);
  assert.equal(groupIdOf(groups, 0), groupIdOf(groups, 1));
  assert.deepEqual(positions[0], { x: 100, y: 50 });
  assert.deepEqual(positions[1], { x: 200, y: 50 });
  assert.equal(isGroupOnBoard(groups, positions, 0, 2, 100, 50, 100, 50), true);
});

test("snapGroupToNeighbors merges two locked neighbor groups in place", () => {
  const groups = createGroups(2);
  const positions = [
    { x: 100, y: 50 },
    { x: 200, y: 50 },
  ];
  const merges = snapGroupToNeighbors({
    activePieceId: 0,
    groups,
    positions,
    cols: 2,
    rows: 1,
    pieceW: 100,
    pieceH: 50,
    threshold: 10,
    originX: 100,
    originY: 50,
  });
  assert.equal(merges, 1);
  assert.equal(groups.members.size, 1);
  assert.deepEqual(positions[0], { x: 100, y: 50 });
  assert.deepEqual(positions[1], { x: 200, y: 50 });
});

test("countPlacedPieces and isPuzzleSolved", () => {
  const positions = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ];
  assert.equal(countPlacedPieces(positions, 2, 10, 10, 0, 0), 2);
  assert.equal(isPuzzleSolved(positions, 2, 10, 10, 0, 0), true);

  positions[1].x = 15;
  assert.equal(countPlacedPieces(positions, 2, 10, 10, 0, 0), 1);
  assert.equal(isPuzzleSolved(positions, 2, 10, 10, 0, 0), false);
});
