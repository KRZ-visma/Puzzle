import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  PROGRESS_VERSION,
  buildProgress,
  clearProgress,
  deserializePositions,
  groupsFromGroupOf,
  loadProgress,
  normalizeProgress,
  saveProgress,
  serializePositions,
} from "../../js/progress.js";
import { key } from "../../js/storage.js";

const memory = new Map();

globalThis.localStorage = {
  getItem(name) {
    return memory.has(name) ? memory.get(name) : null;
  },
  setItem(name, value) {
    memory.set(name, String(value));
  },
  removeItem(name) {
    memory.delete(name);
  },
};

afterEach(() => {
  memory.clear();
});

const layout = { originX: 40, originY: 20, pieceW: 10, pieceH: 8 };

test("serialize and deserialize positions round-trip through layout changes", () => {
  const positions = [
    { x: 40, y: 20 },
    { x: 55, y: 28 },
  ];
  const saved = serializePositions(positions, layout);
  assert.deepEqual(saved, [
    { nx: 0, ny: 0 },
    { nx: 1.5, ny: 1 },
  ]);

  const larger = { originX: 80, originY: 40, pieceW: 20, pieceH: 16 };
  assert.deepEqual(deserializePositions(saved, larger), [
    { x: 80, y: 40 },
    { x: 110, y: 56 },
  ]);
});

test("groupsFromGroupOf rebuilds membership sets", () => {
  const groups = groupsFromGroupOf([0, 0, 2, 3]);
  assert.deepEqual(groups.groupOf, [0, 0, 2, 3]);
  assert.equal(groups.members.size, 3);
  assert.deepEqual([...groups.members.get(0)].sort((a, b) => a - b), [0, 1]);
  assert.deepEqual([...groups.members.get(2)], [2]);
});

test("normalizeProgress accepts a valid 12-piece payload", () => {
  const positions = Array.from({ length: 12 }, (_, i) => ({ nx: i, ny: 0 }));
  const groupOf = Array.from({ length: 12 }, (_, i) => i);
  const normalized = normalizeProgress({
    version: PROGRESS_VERSION,
    difficulty: 12,
    imageId: "waterfall",
    cols: 4,
    rows: 3,
    seed: 99,
    positions,
    groupOf,
  });
  assert.equal(normalized?.difficulty, 12);
  assert.equal(normalized?.imageId, "waterfall");
  assert.equal(normalized?.seed, 99);
  assert.equal(normalized?.positions.length, 12);
});

test("normalizeProgress migrates v1 saves to default gallery image", () => {
  const positions = Array.from({ length: 12 }, (_, i) => ({ nx: i, ny: 0 }));
  const groupOf = Array.from({ length: 12 }, (_, i) => i);
  const normalized = normalizeProgress({
    version: 1,
    difficulty: 12,
    cols: 4,
    rows: 3,
    seed: 7,
    positions,
    groupOf,
  });
  assert.equal(normalized?.version, PROGRESS_VERSION);
  assert.equal(normalized?.imageId, "woods");
});

test("normalizeProgress rejects mismatched grid or bad seats", () => {
  assert.equal(
    normalizeProgress({
      version: PROGRESS_VERSION,
      difficulty: 12,
      cols: 8,
      rows: 6,
      seed: 1,
      positions: [],
      groupOf: [],
    }),
    null
  );
  assert.equal(normalizeProgress({ version: 0 }), null);
  assert.equal(loadProgress(), null);
});

test("save and load progress round-trip", () => {
  const progress = buildProgress({
    difficulty: 12,
    imageId: "village",
    cols: 4,
    rows: 3,
    seed: 42,
    positions: Array.from({ length: 12 }, (_, i) => ({
      x: layout.originX + (i % 4) * layout.pieceW,
      y: layout.originY + Math.floor(i / 4) * layout.pieceH,
    })),
    groupOf: Array.from({ length: 12 }, (_, i) => i),
    layout,
  });
  assert.ok(progress);
  assert.equal(progress.imageId, "village");
  assert.equal(saveProgress(progress), true);
  assert.ok(memory.has(key("progress")));
  assert.deepEqual(loadProgress(), progress);

  clearProgress();
  assert.equal(loadProgress(), null);
});
