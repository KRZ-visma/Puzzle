import assert from "node:assert/strict";
import { test } from "node:test";
import { countPlacedPieces, isPuzzleSolved, progressWithGroups } from "../../js/rules.js";
import { createGroups } from "../../js/groups.js";

test("isPuzzleSolved requires every piece on its seat", () => {
  const positions = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 0, y: 10 },
    { x: 20, y: 10 },
  ];
  assert.equal(isPuzzleSolved(positions, 2, 20, 10, 0, 0), true);
  positions[3].x = 21;
  assert.equal(isPuzzleSolved(positions, 2, 20, 10, 0, 0), false);
});

test("progressWithGroups reports placed count and group count", () => {
  const groups = createGroups(4);
  const positions = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 0, y: 10 },
    { x: 20, y: 10 },
  ];
  const progress = progressWithGroups(positions, groups, 2, 20, 10, 0, 0);
  assert.equal(progress.total, 4);
  assert.equal(progress.groups, 4);
  assert.equal(progress.placed, countPlacedPieces(positions, 2, 20, 10, 0, 0));
});
