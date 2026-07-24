import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countCorrectPlacements,
  findSlotOfPiece,
  isCorrectPlacement,
  isPuzzleComplete,
} from "../../js/rules.js";

test("isCorrectPlacement requires matching ids", () => {
  assert.equal(isCorrectPlacement(3, 3), true);
  assert.equal(isCorrectPlacement(3, 4), false);
});

test("findSlotOfPiece locates a piece on the board map", () => {
  const placements = new Map([
    [0, 2],
    [1, 1],
  ]);
  assert.equal(findSlotOfPiece(placements, 2), 0);
  assert.equal(findSlotOfPiece(placements, 9), null);
});

test("countCorrectPlacements and isPuzzleComplete", () => {
  const partial = new Map([
    [0, 0],
    [1, 4],
  ]);
  assert.equal(countCorrectPlacements(partial), 1);
  assert.equal(isPuzzleComplete(partial, 2), false);

  const done = new Map([
    [0, 0],
    [1, 1],
  ]);
  assert.equal(countCorrectPlacements(done), 2);
  assert.equal(isPuzzleComplete(done, 2), true);
});
