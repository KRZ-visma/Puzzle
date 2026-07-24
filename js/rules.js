/**
 * Pure win / progress helpers for the free-form jigsaw.
 */

import { countPlacedPieces, isPuzzleSolved } from "./snap.js";
import { groupCount } from "./groups.js";

export function getProgress(positions, cols, pieceW, pieceH, originX, originY) {
  return {
    placed: countPlacedPieces(positions, cols, pieceW, pieceH, originX, originY),
    total: positions.length,
    groups: null,
  };
}

export function progressWithGroups(positions, groups, cols, pieceW, pieceH, originX, originY) {
  return {
    placed: countPlacedPieces(positions, cols, pieceW, pieceH, originX, originY),
    total: positions.length,
    groups: groupCount(groups),
  };
}

export { isPuzzleSolved, countPlacedPieces };
