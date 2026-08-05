/**
 * Dual-tone piece outlines — light outer rim + darker inner stroke
 * so tabs stay readable on dark landscape art.
 */

/** Cream halo that pops against foliage / shadow regions. */
export const PIECE_STROKE_OUTER = "rgba(255, 250, 240, 0.78)";

/** Ink inner edge for definition on bright sky / snow. */
export const PIECE_STROKE_INNER = "rgba(31, 58, 46, 0.55)";

/**
 * Stroke widths for a piece outline (CSS/world pixels after camera scale).
 * @param {number} minSide smaller of pieceW / pieceH
 * @param {number} [scale=1] camera or tray scale divisor (larger → thinner on screen)
 * @returns {{ outer: number, inner: number }}
 */
export function pieceStrokeWidths(minSide, scale = 1) {
  const safeScale = scale > 0 ? scale : 1;
  const inner = Math.max(0.6, minSide * 0.03) / safeScale;
  return {
    outer: inner * 1.9,
    inner,
  };
}

/**
 * Stroke a piece Path2D with the dual-tone rim.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Path2D} path
 * @param {number} minSide
 * @param {number} [scale=1]
 */
export function strokePiecePath(ctx, path, minSide, scale = 1) {
  const { outer, inner } = pieceStrokeWidths(minSide, scale);
  const prevJoin = ctx.lineJoin;
  const prevCap = ctx.lineCap;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = PIECE_STROKE_OUTER;
  ctx.lineWidth = outer;
  ctx.stroke(path);
  ctx.strokeStyle = PIECE_STROKE_INNER;
  ctx.lineWidth = inner;
  ctx.stroke(path);
  ctx.lineJoin = prevJoin;
  ctx.lineCap = prevCap;
}
