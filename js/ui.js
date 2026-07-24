import { els } from "./dom.js";

/** Status text, progress counters, and modal chrome. */

export function setStatus(message) {
  els.status.textContent = message;
}

export function updateProgress(placed, total) {
  els.placedCount.textContent = String(placed);
  els.totalCount.textContent = String(total);
}

export function showPreview(visible) {
  els.previewModal.hidden = !visible;
}

export function showWin(visible) {
  els.winModal.hidden = !visible;
}

export function clearPieceSelection() {
  document.querySelectorAll(".piece.selected").forEach((el) => {
    el.classList.remove("selected");
  });
}

export function markPieceSelected(pieceId) {
  document
    .querySelectorAll(`.piece[data-piece-id="${pieceId}"]`)
    .forEach((el) => el.classList.add("selected"));
}

export function bindChrome({ onShuffle, onPlayAgain, onDifficultyChange }) {
  els.difficulty.addEventListener("change", onDifficultyChange);
  els.shuffleBtn.addEventListener("click", onShuffle);
  els.playAgain.addEventListener("click", onPlayAgain);

  els.previewBtn.addEventListener("click", () => showPreview(true));
  els.closePreview.addEventListener("click", () => showPreview(false));

  els.previewModal.addEventListener("click", (event) => {
    if (event.target === els.previewModal) showPreview(false);
  });

  els.winModal.addEventListener("click", (event) => {
    if (event.target === els.winModal) showWin(false);
  });
}
