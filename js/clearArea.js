/**
 * Clear the board silhouette by translating overlapping groups into the gutters.
 * Pure helpers — keep relative piece offsets (groups stay connected).
 * Board-locked groups (every member on its solved seat) are left in place.
 */

import { translateGroup } from "./groups.js";
import { isGroupOnBoard } from "./snap.js";

/** Axis-aligned bounds of every piece body in a group. */
export function groupBounds(memberIds, positions, pieceW, pieceH) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of memberIds) {
    const pos = positions[id];
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + pieceW);
    maxY = Math.max(maxY, pos.y + pieceH);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function rectsOverlap(a, b) {
  return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxY <= b.minY || a.minY >= b.maxY);
}

function fitsOnCanvas(bounds, dx, dy, cssW, cssH) {
  return (
    bounds.minX + dx >= 0 &&
    bounds.minY + dy >= 0 &&
    bounds.maxX + dx <= cssW &&
    bounds.maxY + dy <= cssH
  );
}

function clamp(value, min, max) {
  if (max < min) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

/**
 * Pick a translation that moves `bounds` fully outside the board rect,
 * leaving at least one piece of clearance from the board border.
 * Prefers a side that keeps the group on-canvas when possible; otherwise the
 * shortest clear move (pieces may leave the canvas for large groups).
 */
export function translationOffBoard(
  bounds,
  board,
  cssW,
  cssH,
  rng = Math.random,
  pieceW = 0,
  pieceH = 0
) {
  if (!rectsOverlap(bounds, board)) {
    return { dx: 0, dy: 0 };
  }

  // One piece away from the silhouette on the move axis.
  const gapX = Math.max(0, pieceW);
  const gapY = Math.max(0, pieceH);

  const candidates = [
    {
      // Above the board
      dx: 0,
      dy: board.minY - gapY - bounds.maxY,
      axis: "x",
    },
    {
      // Below the board
      dx: 0,
      dy: board.maxY + gapY - bounds.minY,
      axis: "x",
    },
    {
      // Left of the board
      dx: board.minX - gapX - bounds.maxX,
      dy: 0,
      axis: "y",
    },
    {
      // Right of the board
      dx: board.maxX + gapX - bounds.minX,
      dy: 0,
      axis: "y",
    },
  ];

  // Scatter along the free axis so cleared groups do not all stack.
  for (const c of candidates) {
    if (c.axis === "x") {
      const min = 0;
      const max = cssW - bounds.width;
      const targetMinX = clamp(rng() * Math.max(1, cssW - bounds.width), min, max);
      c.dx = targetMinX - bounds.minX;
    } else {
      const min = 0;
      const max = cssH - bounds.height;
      const targetMinY = clamp(rng() * Math.max(1, cssH - bounds.height), min, max);
      c.dy = targetMinY - bounds.minY;
    }
  }

  const onCanvas = candidates.filter((c) => fitsOnCanvas(bounds, c.dx, c.dy, cssW, cssH));
  const pool = onCanvas.length > 0 ? onCanvas : candidates;
  pool.sort((a, b) => Math.abs(a.dx) + Math.abs(a.dy) - (Math.abs(b.dx) + Math.abs(b.dy)));
  const best = pool[0];
  return { dx: best.dx, dy: best.dy };
}

/**
 * Translate every unlocked group that overlaps the board silhouette into a gutter.
 * Board-locked groups stay on their seats. Returns how many groups were moved.
 */
export function clearPuzzleArea({
  groups,
  positions,
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
  const boardW = cols * pieceW;
  const boardH = rows * pieceH;
  const board = {
    minX: originX,
    minY: originY,
    maxX: originX + boardW,
    maxY: originY + boardH,
  };

  const seen = new Set();
  let moved = 0;
  const total = cols * rows;

  for (let id = 0; id < total; id += 1) {
    const gid = groups.groupOf[id];
    if (seen.has(gid)) continue;
    seen.add(gid);

    // Correctly seated groups are locked — do not clear them off the board.
    if (isGroupOnBoard(groups, positions, id, cols, pieceW, pieceH, originX, originY)) {
      continue;
    }

    const members = groups.members.get(gid);
    const bounds = groupBounds(members, positions, pieceW, pieceH);
    if (!rectsOverlap(bounds, board)) continue;

    const { dx, dy } = translationOffBoard(bounds, board, cssW, cssH, rng, pieceW, pieceH);
    if (dx === 0 && dy === 0) continue;
    translateGroup(groups, positions, id, dx, dy);
    moved += 1;
  }

  return moved;
}
