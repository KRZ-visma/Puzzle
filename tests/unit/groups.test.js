import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGroups,
  groupCount,
  groupIdOf,
  isFullyAssembled,
  mergeGroups,
  membersOf,
  translateGroup,
} from "../../js/groups.js";

test("createGroups starts with one group per piece", () => {
  const groups = createGroups(4);
  assert.equal(groupCount(groups), 4);
  assert.equal(membersOf(groups, 2).size, 1);
});

test("mergeGroups aligns the from-group then shares an id", () => {
  const groups = createGroups(3);
  const positions = [
    { x: 0, y: 0 },
    { x: 5, y: 5 },
    { x: 9, y: 9 },
  ];
  mergeGroups(groups, positions, 1, 0, -5, -5);
  assert.equal(groupIdOf(groups, 0), groupIdOf(groups, 1));
  assert.deepEqual(positions[1], { x: 0, y: 0 });
  translateGroup(groups, positions, 0, 3, 4);
  assert.deepEqual(positions[0], { x: 3, y: 4 });
  assert.deepEqual(positions[1], { x: 3, y: 4 });
  assert.deepEqual(positions[2], { x: 9, y: 9 });
});

test("mergeGroups collapses clusters until fully assembled", () => {
  const groups = createGroups(3);
  const positions = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ];
  mergeGroups(groups, positions, 1, 0, -10, 0);
  mergeGroups(groups, positions, 2, 0, -20, 0);
  assert.equal(isFullyAssembled(groups, 3), true);
  assert.equal(groupCount(groups), 1);
});
