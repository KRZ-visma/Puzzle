/**
 * Snap rules for free-form interlocking pieces (pure).
 */

import {
  neighborId,
  neighborOffset,
  solvedPosition,
} from "./geometry.js";
import { groupIdOf, membersOf, mergeGroups, translateGroup } from "./groups.js";

export function distance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

/**
 * Try neighbor snaps for every piece in the active group against other groups.
 * Returns the number of merges performed.
 */
export function snapGroupToNeighbors({
  activePieceId,
  groups,
  positions,
  cols,
  rows,
  pieceW,
  pieceH,
  threshold,
}) {
  const activeMembers = [...membersOf(groups, activePieceId)];
  const directions = ["right", "left", "down", "up"];
  let merges = 0;

  // Re-scan until no more merges (group membership changes).
  let changed = true;
  while (changed) {
    changed = false;
    const members = [...membersOf(groups, activePieceId)];
    for (const pieceId of members) {
      for (const dir of directions) {
        const otherId = neighborId(pieceId, cols, rows, dir);
        if (otherId === null) continue;
        if (groupIdOf(groups, otherId) === groupIdOf(groups, pieceId)) continue;

        const offset = neighborOffset(dir, pieceW, pieceH);
        const targetX = positions[pieceId].x + offset.x;
        const targetY = positions[pieceId].y + offset.y;
        const dist = distance(
          positions[otherId].x,
          positions[otherId].y,
          targetX,
          targetY
        );
        if (dist <= threshold) {
          const dx = targetX - positions[otherId].x;
          const dy = targetY - positions[otherId].y;
          // Move the other group onto this one.
          mergeGroups(groups, positions, otherId, pieceId, dx, dy);
          merges += 1;
          changed = true;
        }
      }
    }
    // Keep activePieceId stable; membership grew via merges into its group.
    void activeMembers;
  }

  return merges;
}

/**
 * If any piece in the active group is near its solved board seat, snap the
 * whole group onto the board grid.
 */
export function snapGroupToBoard({
  activePieceId,
  groups,
  positions,
  cols,
  pieceW,
  pieceH,
  originX,
  originY,
  threshold,
}) {
  const members = membersOf(groups, activePieceId);
  let best = null;

  for (const pieceId of members) {
    const solved = solvedPosition(pieceId, cols, pieceW, pieceH, originX, originY);
    const dist = distance(positions[pieceId].x, positions[pieceId].y, solved.x, solved.y);
    if (dist <= threshold && (best === null || dist < best.dist)) {
      best = {
        dist,
        dx: solved.x - positions[pieceId].x,
        dy: solved.y - positions[pieceId].y,
      };
    }
  }

  if (!best) return false;
  translateGroup(groups, positions, activePieceId, best.dx, best.dy);
  return true;
}

/** Count pieces whose body origin matches the solved seat within epsilon. */
export function countPlacedPieces(positions, cols, pieceW, pieceH, originX, originY, epsilon = 0.75) {
  let placed = 0;
  for (let id = 0; id < positions.length; id += 1) {
    const solved = solvedPosition(id, cols, pieceW, pieceH, originX, originY);
    if (distance(positions[id].x, positions[id].y, solved.x, solved.y) <= epsilon) {
      placed += 1;
    }
  }
  return placed;
}

export function isPuzzleSolved(positions, cols, pieceW, pieceH, originX, originY, epsilon = 0.75) {
  return (
    countPlacedPieces(positions, cols, pieceW, pieceH, originX, originY, epsilon) ===
    positions.length
  );
}
