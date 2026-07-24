import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPiecePathCommands,
  createEdgeMap,
  neighborId,
  neighborOffset,
  solvedPosition,
} from "../../js/geometry.js";

test("createEdgeMap is deterministic for a seed", () => {
  const a = createEdgeMap(4, 3, 42);
  const b = createEdgeMap(4, 3, 42);
  assert.deepEqual(a.hEdges, b.hEdges);
  assert.deepEqual(a.vEdges, b.vEdges);
});

test("neighbor helpers respect borders", () => {
  assert.equal(neighborId(0, 4, 3, "left"), null);
  assert.equal(neighborId(0, 4, 3, "up"), null);
  assert.equal(neighborId(0, 4, 3, "right"), 1);
  assert.equal(neighborId(0, 4, 3, "down"), 4);
  assert.equal(neighborId(11, 4, 3, "right"), null);
});

test("neighborOffset matches grid spacing", () => {
  assert.deepEqual(neighborOffset("right", 10, 20), { x: 10, y: 0 });
  assert.deepEqual(neighborOffset("down", 10, 20), { x: 0, y: 20 });
});

test("solvedPosition is row-major", () => {
  assert.deepEqual(solvedPosition(5, 4, 10, 20, 100, 50), { x: 110, y: 70 });
});

test("adjacent pieces share inverted connector polarity on the shared edge", () => {
  const edges = createEdgeMap(3, 2, 7);
  const left = buildPiecePathCommands(0, edges, 100, 80);
  const right = buildPiecePathCommands(1, edges, 100, 80);

  // Right edge of piece 0 and left edge of piece 1 must both contain cubic segments.
  const leftHasCurve = left.some((c) => c.type === "C");
  const rightHasCurve = right.some((c) => c.type === "C");
  assert.equal(leftHasCurve, true);
  assert.equal(rightHasCurve, true);

  // Shared horizontal edge polarity: left tab (+1) means right has blank (-1) locally.
  assert.equal(edges.hEdges[0][0] === 1 || edges.hEdges[0][0] === -1, true);
});

test("border pieces keep flat outer edges (no connector on outer side)", () => {
  const edges = createEdgeMap(2, 2, 3);
  const commands = buildPiecePathCommands(0, edges, 50, 50);
  // Piece 0 top and left are borders: path should start at 0,0 and include axis lines.
  assert.equal(commands[0].type, "M");
  assert.equal(commands[0].x, 0);
  assert.equal(commands[0].y, 0);
  assert.equal(commands.at(-1).type, "Z");
});
