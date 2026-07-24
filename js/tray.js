import { els } from "./dom.js";
import { shuffle } from "./utils.js";
import { createPiece } from "./pieces.js";

/** Piece tray rendering. */

export function buildTray({ total, cols, rows, onSelect }) {
  const tray = els.tray;
  tray.innerHTML = "";
  const ids = shuffle([...Array(total).keys()]);

  ids.forEach((pieceId, index) => {
    const piece = createPiece(pieceId, { cols, rows, onSelect });
    piece.style.animationDelay = `${Math.min(index * 18, 360)}ms`;
    tray.appendChild(piece);
  });
}

export function removeFromTray(pieceId) {
  els.tray.querySelectorAll(`.piece[data-piece-id="${pieceId}"]`).forEach((el) => {
    el.remove();
  });
}

export function appendToTray(pieceId, { cols, rows, onSelect }) {
  els.tray.appendChild(createPiece(pieceId, { cols, rows, onSelect }));
}
