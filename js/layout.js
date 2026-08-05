/**
 * Initial piece placement strategies (pure).
 * Modes: scatter (gutters around the board).
 * Movable baskets are a separate mid-game feature (see baskets.js).
 */

export const LAYOUT_SCATTER = "scatter";

/** Ordered start-menu options (currently scatter only). */
export const LAYOUT_MODES = Object.freeze([
  {
    id: LAYOUT_SCATTER,
    label: "All over the place",
    hint: "Pieces scattered around the board",
  },
]);

export const DEFAULT_LAYOUT_MODE = LAYOUT_SCATTER;

const MODE_IDS = new Set(LAYOUT_MODES.map((m) => m.id));

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeLayoutMode(value) {
  if (typeof value === "string" && MODE_IDS.has(value)) return value;
  return DEFAULT_LAYOUT_MODE;
}

function clamp(value, min, max) {
  if (max < min) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

function clampPiece(x, y, pieceW, pieceH, cssW, cssH) {
  return {
    x: clamp(x, 0, Math.max(0, cssW - pieceW)),
    y: clamp(y, 0, Math.max(0, cssH - pieceH)),
  };
}

/** Fisher–Yates using a supplied RNG (seeded or Math.random). */
export function shuffleIds(count, rng = Math.random) {
  const ids = Array.from({ length: count }, (_, i) => i);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/**
 * Random gutter scatter (default).
 * @returns {{ x: number, y: number }[]}
 */
export function placeScattered({
  cols,
  rows,
  pieceW,
  pieceH,
  originX,
  originY,
  cssW,
  cssH,
  rng = Math.random,
}) {
  const total = cols * rows;
  const boardW = cols * pieceW;
  const boardH = rows * pieceH;
  const positions = new Array(total);
  for (let id = 0; id < total; id += 1) {
    const side = Math.floor(rng() * 4);
    let x;
    let y;
    if (side === 0) {
      x = rng() * Math.max(1, cssW - pieceW);
      y = rng() * Math.max(8, originY - pieceH);
    } else if (side === 1) {
      x = rng() * Math.max(1, cssW - pieceW);
      y = originY + boardH + rng() * Math.max(8, cssH - (originY + boardH) - pieceH);
    } else if (side === 2) {
      x = rng() * Math.max(8, originX - pieceW);
      y = originY + rng() * boardH;
    } else {
      x = originX + boardW + rng() * Math.max(8, cssW - (originX + boardW) - pieceW);
      y = originY + rng() * boardH;
    }
    positions[id] = clampPiece(x, y, pieceW, pieceH, cssW, cssH);
  }
  return positions;
}

/**
 * Place every piece for the chosen layout mode.
 * @returns {{ x: number, y: number }[]}
 */
export function placePieces(mode, layout, rng = Math.random) {
  normalizeLayoutMode(mode);
  return placeScattered({ ...layout, rng });
}
