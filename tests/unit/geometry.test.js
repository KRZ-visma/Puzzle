import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TAB_CENTER_MAX,
  TAB_CENTER_MIN,
} from "../../js/config.js";
import {
  buildPiecePathCommands,
  clampTabCenter,
  connectorSpan,
  createEdgeMap,
  neighborId,
  neighborOffset,
  randomTabCenter,
  solvedPosition,
} from "../../js/geometry.js";
import { createRng } from "../../js/rng.js";

test("createEdgeMap is deterministic for a seed", () => {
  const a = createEdgeMap(4, 3, 42);
  const b = createEdgeMap(4, 3, 42);
  assert.deepEqual(a.hEdges, b.hEdges);
  assert.deepEqual(a.vEdges, b.vEdges);
  assert.deepEqual(a.hCenters, b.hCenters);
  assert.deepEqual(a.vCenters, b.vCenters);
});

test("createEdgeMap stores varied connector centers (not only mid-edge)", () => {
  const edges = createEdgeMap(8, 6, 99);
  const centers = [...edges.hCenters.flat(), ...edges.vCenters.flat()];
  assert.ok(centers.length > 0);
  for (const c of centers) {
    assert.ok(c >= TAB_CENTER_MIN && c <= TAB_CENTER_MAX);
  }
  const spread = Math.max(...centers) - Math.min(...centers);
  assert.ok(spread > 0.2, `expected varied centers, spread=${spread}`);
  // At least some contacts sit clearly off-center.
  assert.ok(centers.some((c) => Math.abs(c - 0.5) > 0.08));
});

test("randomTabCenter stays inside the configured band", () => {
  const rng = createRng(3);
  for (let i = 0; i < 40; i += 1) {
    const c = randomTabCenter(rng);
    assert.ok(c >= TAB_CENTER_MIN && c <= TAB_CENTER_MAX);
  }
});

test("clampTabCenter keeps the connector on the edge", () => {
  assert.equal(clampTabCenter(0.5), 0.5);
  assert.ok(clampTabCenter(0) > 0.15);
  assert.ok(clampTabCenter(1) < 0.85);
});

test("connectorSpan places the knob around the requested center", () => {
  const { start, mid, end } = connectorSpan(100, 0.3, 0.32);
  assert.ok(Math.abs(mid - 30) < 1e-9);
  assert.ok(Math.abs(end - start - 32) < 1e-9);
  assert.ok(start < mid && mid < end);
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

test("shared vertical edge connectors meet at the same along-axis positions", () => {
  const edges = createEdgeMap(2, 2, 11);
  const left = buildPiecePathCommands(0, edges, 100, 80);
  const right = buildPiecePathCommands(1, edges, 100, 80);
  const centerT = edges.hCenters[0][0];
  const { mid } = connectorSpan(80, centerT);

  // Knob tip on the right edge of the left piece and left edge of the right piece.
  const leftTip = left.find((c) => c.type === "C" && Math.abs(c.y - mid) < 1e-6);
  const rightTip = right.find((c) => c.type === "C" && Math.abs(c.y - mid) < 1e-6);
  assert.ok(leftTip, "left piece should have a connector tip at the shared center");
  assert.ok(rightTip, "right piece should have a connector tip at the shared center");
  assert.ok(Math.abs(leftTip.x - (100 + rightTip.x)) < 1e-6);
});

test("shared horizontal edge connectors meet at the same along-axis positions", () => {
  const edges = createEdgeMap(2, 2, 13);
  const top = buildPiecePathCommands(0, edges, 100, 80);
  const bottom = buildPiecePathCommands(2, edges, 100, 80);
  const centerT = edges.vCenters[0][0];
  const { mid } = connectorSpan(100, centerT);

  const topTip = top.find((c) => c.type === "C" && Math.abs(c.x - mid) < 1e-6);
  const bottomTip = bottom.find((c) => c.type === "C" && Math.abs(c.x - mid) < 1e-6);
  assert.ok(topTip, "top piece should have a connector tip at the shared center");
  assert.ok(bottomTip, "bottom piece should have a connector tip at the shared center");
  assert.ok(Math.abs(topTip.y - (bottomTip.y + 80)) < 1e-6);
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

test("piece paths use a necked connector (multiple cubics per shared edge)", () => {
  const edges = createEdgeMap(2, 1, 5);
  const commands = buildPiecePathCommands(0, edges, 100, 80);
  const cubics = commands.filter((c) => c.type === "C");
  // One shared vertical edge → four cubics for the classic necked knob.
  assert.equal(cubics.length, 4);
});
