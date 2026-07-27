/**
 * Initial piece placement strategies (pure).
 * Modes: scatter (gutters), sideTrays (left/right piles), baskets (corner piles).
 */

export const LAYOUT_SCATTER = "scatter";
export const LAYOUT_SIDE_TRAYS = "sideTrays";
export const LAYOUT_BASKETS = "baskets";

/** Ordered start-menu options. */
export const LAYOUT_MODES = Object.freeze([
  {
    id: LAYOUT_SCATTER,
    label: "All over the place",
    hint: "Pieces scattered around the board",
  },
  {
    id: LAYOUT_SIDE_TRAYS,
    label: "Side trays",
    hint: "Left and right trays hold the pieces",
  },
  {
    id: LAYOUT_BASKETS,
    label: "Baskets",
    hint: "Pieces piled in corner baskets",
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
 * Random gutter scatter (legacy / default).
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
 * Axis-aligned tray / basket regions used for placement and canvas chrome.
 * @returns {{ id: string, x: number, y: number, w: number, h: number }[]}
 */
export function layoutRegions(mode, { cols, rows, pieceW, pieceH, originX, originY, cssW, cssH }) {
  const normalized = normalizeLayoutMode(mode);
  const boardW = cols * pieceW;
  const boardH = rows * pieceH;
  const gap = 6;

  if (normalized === LAYOUT_SIDE_TRAYS) {
    const trayTop = Math.max(gap, originY - gap * 2);
    const trayBottom = Math.min(cssH - gap, originY + boardH + gap * 2);
    const trayH = Math.max(pieceH, trayBottom - trayTop);
    const leftW = Math.max(pieceW * 0.75, originX - gap * 2);
    const rightX = originX + boardW + gap;
    const rightW = Math.max(pieceW * 0.75, cssW - rightX - gap);
    return [
      { id: "left", x: gap, y: trayTop, w: leftW, h: trayH },
      { id: "right", x: rightX, y: trayTop, w: rightW, h: trayH },
    ];
  }

  if (normalized === LAYOUT_BASKETS) {
    const basketW = Math.max(pieceW * 1.35, Math.min(cssW * 0.22, originX + pieceW * 0.35));
    const basketH = Math.max(pieceH * 1.35, Math.min(cssH * 0.22, originY + pieceH * 0.35));
    const left = gap;
    const right = Math.max(gap, cssW - basketW - gap);
    const top = gap;
    const bottom = Math.max(gap, cssH - basketH - gap);
    return [
      { id: "nw", x: left, y: top, w: basketW, h: basketH },
      { id: "ne", x: right, y: top, w: basketW, h: basketH },
      { id: "sw", x: left, y: bottom, w: basketW, h: basketH },
      { id: "se", x: right, y: bottom, w: basketW, h: basketH },
    ];
  }

  return [];
}

/**
 * Stack piece ids inside a region (vertical spread + light jitter).
 * @param {number[]} ids
 * @param {{ x: number, y: number, w: number, h: number }} region
 */
function stackInRegion(ids, region, pieceW, pieceH, cssW, cssH, rng, positions) {
  const maxX = Math.max(region.x, region.x + region.w - pieceW);
  const maxY = Math.max(region.y, region.y + region.h - pieceH);
  const baseX = (region.x + maxX) / 2;
  const usableH = Math.max(1, maxY - region.y);

  for (let i = 0; i < ids.length; i += 1) {
    const t = ids.length <= 1 ? 0.5 : i / (ids.length - 1);
    const jitterX = (rng() - 0.5) * Math.min(pieceW * 0.45, Math.max(4, region.w * 0.25));
    const jitterY = (rng() - 0.5) * Math.min(pieceH * 0.35, 10);
    const x = baseX + jitterX;
    const y = region.y + t * usableH + jitterY;
    positions[ids[i]] = clampPiece(x, y, pieceW, pieceH, cssW, cssH);
  }
}

/**
 * Pile pieces near the center of a basket with small offsets.
 * @param {number[]} ids
 * @param {{ x: number, y: number, w: number, h: number }} region
 */
function pileInRegion(ids, region, pieceW, pieceH, cssW, cssH, rng, positions) {
  const cx = region.x + region.w / 2 - pieceW / 2;
  const cy = region.y + region.h / 2 - pieceH / 2;
  const spreadX = Math.max(6, Math.min(pieceW * 0.55, region.w * 0.28));
  const spreadY = Math.max(6, Math.min(pieceH * 0.55, region.h * 0.28));

  for (let i = 0; i < ids.length; i += 1) {
    const x = cx + (rng() - 0.5) * 2 * spreadX;
    const y = cy + (rng() - 0.5) * 2 * spreadY;
    positions[ids[i]] = clampPiece(x, y, pieceW, pieceH, cssW, cssH);
  }
}

/**
 * Left/right trays: half the pieces in each vertical tray.
 * @returns {{ x: number, y: number }[]}
 */
export function placeInSideTrays(layout, rng = Math.random) {
  const { cols, rows, pieceW, pieceH, cssW, cssH } = layout;
  const total = cols * rows;
  const positions = new Array(total);
  const regions = layoutRegions(LAYOUT_SIDE_TRAYS, layout);
  const ids = shuffleIds(total, rng);
  const mid = Math.ceil(ids.length / 2);
  stackInRegion(ids.slice(0, mid), regions[0], pieceW, pieceH, cssW, cssH, rng, positions);
  stackInRegion(ids.slice(mid), regions[1], pieceW, pieceH, cssW, cssH, rng, positions);
  return positions;
}

/**
 * Corner baskets: pieces randomly dumped into four piles.
 * @returns {{ x: number, y: number }[]}
 */
export function placeInBaskets(layout, rng = Math.random) {
  const { cols, rows, pieceW, pieceH, cssW, cssH } = layout;
  const total = cols * rows;
  const positions = new Array(total);
  const regions = layoutRegions(LAYOUT_BASKETS, layout);
  const ids = shuffleIds(total, rng);
  /** @type {number[][]} */
  const buckets = regions.map(() => []);
  for (const id of ids) {
    const bucket = Math.floor(rng() * regions.length);
    buckets[bucket].push(id);
  }
  for (let i = 0; i < regions.length; i += 1) {
    pileInRegion(buckets[i], regions[i], pieceW, pieceH, cssW, cssH, rng, positions);
  }
  return positions;
}

/**
 * Place every piece for the chosen layout mode.
 * @returns {{ x: number, y: number }[]}
 */
export function placePieces(mode, layout, rng = Math.random) {
  const normalized = normalizeLayoutMode(mode);
  if (normalized === LAYOUT_SIDE_TRAYS) return placeInSideTrays(layout, rng);
  if (normalized === LAYOUT_BASKETS) return placeInBaskets(layout, rng);
  return placeScattered({ ...layout, rng });
}
