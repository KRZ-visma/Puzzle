import { pieceBackground } from "./utils.js";

/**
 * Piece element factory. Interaction callbacks are injected so this module
 * stays free of game-state ownership (reduces merge conflicts with game.js).
 */

export function createPiece(pieceId, { cols, rows, correct = false, onSelect } = {}) {
  const piece = document.createElement("button");
  piece.type = "button";
  piece.className = "piece";
  piece.dataset.pieceId = String(pieceId);
  piece.setAttribute("data-testid", `piece-${pieceId}`);
  piece.setAttribute("aria-label", `Puzzle piece ${pieceId + 1}`);
  piece.draggable = !correct;

  const bg = pieceBackground(pieceId, cols, rows);
  piece.style.backgroundSize = bg.backgroundSize;
  piece.style.backgroundPosition = bg.backgroundPosition;

  if (correct) {
    piece.classList.add("correct");
    return piece;
  }

  piece.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect?.(pieceId);
  });

  piece.addEventListener("dragstart", (event) => {
    onSelect?.(pieceId);
    event.dataTransfer.setData("text/plain", String(pieceId));
    event.dataTransfer.effectAllowed = "move";
  });

  return piece;
}
