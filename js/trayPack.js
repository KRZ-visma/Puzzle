/**
 * Side-tray packing helpers (pure).
 * Pieces are evenly spaced in a scrollable column; trays are always-visible UI.
 * Display size can differ from playfield piece size (scale-to-fit the tray width).
 */

import { shuffleIds } from "./layout.js";

/** Horizontal padding inside a tray column. */
export const TRAY_PADDING_X = 10;
/** Vertical padding at top/bottom of tray content. */
export const TRAY_PADDING_Y = 10;
/** Even gap between piece visual bounds in a tray column. */
export const TRAY_GAP = 10;
/** Cap so tray thumbnails do not grow unbounded on wide desktop trays. */
export const TRAY_SCALE_MAX = 2.75;

/**
 * Split shuffled piece ids into left/right trays.
 * @param {number} total
 * @param {() => number} [rng]
 * @returns {{ leftIds: number[], rightIds: number[] }}
 */
export function assignSideTrayIds(total, rng = Math.random) {
  const ids = shuffleIds(total, rng);
  const mid = Math.ceil(ids.length / 2);
  return {
    leftIds: ids.slice(0, mid),
    rightIds: ids.slice(mid),
  };
}

/**
 * Scale playfield piece metrics so the full interlocking silhouette fits the tray width.
 * @param {{ trayW: number, pieceW: number, pieceH: number, pad?: number, paddingX?: number, maxScale?: number }} opts
 * @returns {{ scale: number, drawW: number, drawH: number, strideH: number, pad: number }}
 */
export function trayFitMetrics(opts) {
  const paddingX = opts.paddingX ?? TRAY_PADDING_X;
  const maxScale = opts.maxScale ?? TRAY_SCALE_MAX;
  const pad = Math.max(0, opts.pad ?? 0);
  const pieceW = Math.max(1, opts.pieceW);
  const pieceH = Math.max(1, opts.pieceH);
  const trayW = Math.max(1, opts.trayW);
  const available = Math.max(8, trayW - paddingX * 2);
  const visualW = pieceW + pad * 2;
  const scale = Math.min(maxScale, available / Math.max(1, visualW));
  const drawW = pieceW * scale;
  const drawH = pieceH * scale;
  const drawPad = pad * scale;
  return {
    scale,
    drawW,
    drawH,
    strideH: drawH + drawPad * 2,
    pad: drawPad,
  };
}

/**
 * Evenly space pieces in a single scrollable column.
 * Content height grows with piece count (scrollbar appears when taller than the panel).
 * Uses scale-to-fit + tab padding so silhouettes do not overlap or spill the tray.
 * @param {number[]} ids
 * @param {{ trayW: number, pieceW: number, pieceH: number, pad?: number, gap?: number, paddingX?: number, paddingY?: number, maxScale?: number }} opts
 * @returns {{ localPositions: Map<number, { x: number, y: number }>, contentH: number, gap: number, scale: number, drawW: number, drawH: number, pad: number }}
 */
export function packTrayColumn(ids, opts) {
  const gap = opts.gap ?? TRAY_GAP;
  const paddingX = opts.paddingX ?? TRAY_PADDING_X;
  const paddingY = opts.paddingY ?? TRAY_PADDING_Y;
  const { trayW, pieceW, pieceH } = opts;
  const fit = trayFitMetrics({
    trayW,
    pieceW,
    pieceH,
    pad: opts.pad ?? 0,
    paddingX,
    maxScale: opts.maxScale,
  });
  /** @type {Map<number, { x: number, y: number }>} */
  const localPositions = new Map();
  // Position is the rectangular body origin; tabs extend by fit.pad around it.
  const x = Math.max(paddingX + fit.pad, (trayW - fit.drawW) / 2);
  let y = paddingY + fit.pad;
  for (const id of ids) {
    localPositions.set(id, { x, y });
    y += fit.strideH + gap;
  }
  const contentH =
    ids.length === 0
      ? paddingY * 2 + fit.strideH
      : y - gap + paddingY;
  return {
    localPositions,
    contentH: Math.max(contentH, paddingY * 2 + fit.strideH),
    gap,
    scale: fit.scale,
    drawW: fit.drawW,
    drawH: fit.drawH,
    pad: fit.pad,
  };
}

/**
 * Hit-test a point in tray-local content coordinates.
 * @param {Map<number, { x: number, y: number }>} localPositions
 * @param {number[]} ids top-to-bottom order (last drawn = topmost)
 * @param {number} localX
 * @param {number} localY
 * @param {number} drawW scaled body width
 * @param {number} drawH scaled body height
 * @returns {number | null}
 */
export function hitTestTrayPiece(localPositions, ids, localX, localY, drawW, drawH) {
  for (let i = ids.length - 1; i >= 0; i -= 1) {
    const id = ids[i];
    const pos = localPositions.get(id);
    if (!pos) continue;
    if (
      localX >= pos.x &&
      localX <= pos.x + drawW &&
      localY >= pos.y &&
      localY <= pos.y + drawH
    ) {
      return id;
    }
  }
  return null;
}

/**
 * Remove an id from a tray list (immutable-style copy).
 * @param {number[]} ids
 * @param {number} pieceId
 */
export function removeTrayId(ids, pieceId) {
  return ids.filter((id) => id !== pieceId);
}
