/**
 * Side-tray packing helpers (pure).
 * Pieces are evenly spaced in a scrollable column; trays are always-visible UI.
 */

import { shuffleIds } from "./layout.js";

/** Horizontal padding inside a tray column. */
export const TRAY_PADDING_X = 12;
/** Vertical padding at top/bottom of tray content. */
export const TRAY_PADDING_Y = 12;
/** Even gap between piece tops in a tray column. */
export const TRAY_GAP = 12;

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
 * Evenly space pieces in a single scrollable column.
 * Content height grows with piece count (scrollbar appears when taller than the panel).
 * @param {number[]} ids
 * @param {{ trayW: number, pieceW: number, pieceH: number, gap?: number, paddingX?: number, paddingY?: number }} opts
 * @returns {{ localPositions: Map<number, { x: number, y: number }>, contentH: number, gap: number }}
 */
export function packTrayColumn(ids, opts) {
  const gap = opts.gap ?? TRAY_GAP;
  const paddingX = opts.paddingX ?? TRAY_PADDING_X;
  const paddingY = opts.paddingY ?? TRAY_PADDING_Y;
  const { trayW, pieceW, pieceH } = opts;
  /** @type {Map<number, { x: number, y: number }>} */
  const localPositions = new Map();
  const x = Math.max(paddingX, (trayW - pieceW) / 2);
  let y = paddingY;
  for (const id of ids) {
    localPositions.set(id, { x, y });
    y += pieceH + gap;
  }
  const contentH =
    ids.length === 0 ? paddingY * 2 + pieceH : y - gap + paddingY;
  return {
    localPositions,
    contentH: Math.max(contentH, paddingY * 2 + pieceH),
    gap,
  };
}

/**
 * Hit-test a point in tray-local content coordinates.
 * @param {Map<number, { x: number, y: number }>} localPositions
 * @param {number[]} ids top-to-bottom order (last drawn = topmost)
 * @param {number} localX
 * @param {number} localY
 * @param {number} pieceW
 * @param {number} pieceH
 * @returns {number | null}
 */
export function hitTestTrayPiece(localPositions, ids, localX, localY, pieceW, pieceH) {
  for (let i = ids.length - 1; i >= 0; i -= 1) {
    const id = ids[i];
    const pos = localPositions.get(id);
    if (!pos) continue;
    if (
      localX >= pos.x &&
      localX <= pos.x + pieceW &&
      localY >= pos.y &&
      localY <= pos.y + pieceH
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
