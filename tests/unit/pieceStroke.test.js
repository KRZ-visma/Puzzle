import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PIECE_STROKE_INNER,
  PIECE_STROKE_OUTER,
  pieceStrokeWidths,
  strokePiecePath,
} from "../../js/pieceStroke.js";

test("pieceStrokeWidths keeps outer wider than inner", () => {
  const { outer, inner } = pieceStrokeWidths(100, 1);
  assert.ok(inner >= 0.6);
  assert.ok(outer > inner);
  assert.ok(Math.abs(outer / inner - 1.9) < 1e-9);
});

test("pieceStrokeWidths shrinks with camera scale", () => {
  const atOne = pieceStrokeWidths(80, 1);
  const atTwo = pieceStrokeWidths(80, 2);
  assert.ok(atTwo.inner < atOne.inner);
  assert.ok(atTwo.outer < atOne.outer);
});

test("pieceStrokeWidths guards non-positive scale", () => {
  const widths = pieceStrokeWidths(50, 0);
  assert.equal(widths.inner, Math.max(0.6, 50 * 0.03));
});

test("strokePiecePath draws cream outer then ink inner", () => {
  const calls = [];
  const ctx = {
    lineJoin: "miter",
    lineCap: "butt",
    strokeStyle: "",
    lineWidth: 0,
    stroke(path) {
      calls.push({
        style: this.strokeStyle,
        width: this.lineWidth,
        path,
        join: this.lineJoin,
        cap: this.lineCap,
      });
    },
  };
  const path = { id: "piece-path" };
  strokePiecePath(ctx, path, 100, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].style, PIECE_STROKE_OUTER);
  assert.equal(calls[1].style, PIECE_STROKE_INNER);
  assert.ok(calls[0].width > calls[1].width);
  assert.equal(calls[0].path, path);
  assert.equal(calls[1].path, path);
  assert.equal(calls[0].join, "round");
  assert.equal(ctx.lineJoin, "miter");
  assert.equal(ctx.lineCap, "butt");
});
