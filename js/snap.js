/**
 * Snap rules for free-form interlocking pieces (pure).
 */

import {
  neighborId,
  neighborOffset,
  solvedPosition,
} from "./geometry.js";
import { groupIdOf, membersOf, mergeGroups, translateGroup } from "./groups.js";

/** Default seat match tolerance (canvas CSS pixels). */
export const SEAT_EPSILON = 0.75;

export function distance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

/** True when a piece’s body origin matches its solved board seat. */
export function isPieceOnSeat(
  positions,
  pieceId,
  cols,
  pieceW,
  pieceH,
  originX,
  originY,
  epsilon = SEAT_EPSILON
) {
  const solved = solvedPosition(pieceId, cols, pieceW, pieceH, originX, originY);
  return distance(positions[pieceId].x, positions[pieceId].y, solved.x, solved.y) <= epsilon;
}

/**
 * True when every piece in `pieceId`’s group sits on its solved seat.
 * Locked groups must not be dragged or translated by later snaps.
 */
export function isGroupOnBoard(
  groups,
  positions,
  pieceId,
  cols,
  pieceW,
  pieceH,
  originX,
  originY,
  epsilon = SEAT_EPSILON
) {
  const members = membersOf(groups, pieceId);
  if (!members || members.size === 0) return false;
  for (const id of members) {
    if (!isPieceOnSeat(positions, id, cols, pieceW, pieceH, originX, originY, epsilon)) {
      return false;
    }
  }
  return true;
}

/**
 * Try neighbor snaps for every piece in the active group against other groups.
 * Returns the number of merges performed.
 *
 * Groups already locked on the board stay fixed: the free group moves onto them.
 * Two locked neighbor groups merge in place (no translation).
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
  originX = 0,
  originY = 0,
  seatEpsilon = SEAT_EPSILON,
}) {
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
          const otherLocked = isGroupOnBoard(
            groups,
            positions,
            otherId,
            cols,
            pieceW,
            pieceH,
            originX,
            originY,
            seatEpsilon
          );
          const activeLocked = isGroupOnBoard(
            groups,
            positions,
            pieceId,
            cols,
            pieceW,
            pieceH,
            originX,
            originY,
            seatEpsilon
          );

          if (otherLocked && activeLocked) {
            // Both already on correct seats — merge without moving.
            mergeGroups(groups, positions, otherId, pieceId, 0, 0);
          } else if (otherLocked) {
            // Keep the board-locked group fixed; pull the free group onto it.
            const dx = positions[otherId].x - offset.x - positions[pieceId].x;
            const dy = positions[otherId].y - offset.y - positions[pieceId].y;
            mergeGroups(groups, positions, pieceId, otherId, dx, dy);
          } else {
            // Move the other group onto this one.
            const dx = targetX - positions[otherId].x;
            const dy = targetY - positions[otherId].y;
            mergeGroups(groups, positions, otherId, pieceId, dx, dy);
          }
          merges += 1;
          changed = true;
        }
      }
    }
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
export function countPlacedPieces(
  positions,
  cols,
  pieceW,
  pieceH,
  originX,
  originY,
  epsilon = SEAT_EPSILON
) {
  let placed = 0;
  for (let id = 0; id < positions.length; id += 1) {
    if (isPieceOnSeat(positions, id, cols, pieceW, pieceH, originX, originY, epsilon)) {
      placed += 1;
    }
  }
  return placed;
}

export function isPuzzleSolved(
  positions,
  cols,
  pieceW,
  pieceH,
  originX,
  originY,
  epsilon = SEAT_EPSILON
) {
  return (
    countPlacedPieces(positions, cols, pieceW, pieceH, originX, originY, epsilon) ===
    positions.length
  );
}
