/**
 * Pure placement / win-condition helpers.
 * Keep DOM-free so unit tests can cover rules without a browser.
 */

export function isCorrectPlacement(pieceId, slotIndex) {
  return pieceId === slotIndex;
}

export function findSlotOfPiece(placements, pieceId) {
  for (const [slotIndex, id] of placements) {
    if (id === pieceId) return slotIndex;
  }
  return null;
}

export function countCorrectPlacements(placements) {
  let correct = 0;
  for (const [slotIndex, pieceId] of placements) {
    if (isCorrectPlacement(pieceId, slotIndex)) correct += 1;
  }
  return correct;
}

export function isPuzzleComplete(placements, totalPieces) {
  return (
    placements.size === totalPieces &&
    countCorrectPlacements(placements) === totalPieces
  );
}
