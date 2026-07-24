/** Cached DOM references. Keep selectors here so markup renames stay localized. */

export const els = {
  board: document.getElementById("board"),
  tray: document.getElementById("tray"),
  status: document.getElementById("status"),
  placedCount: document.getElementById("placed-count"),
  totalCount: document.getElementById("total-count"),
  difficulty: document.getElementById("difficulty"),
  shuffleBtn: document.getElementById("shuffle-btn"),
  previewBtn: document.getElementById("preview-btn"),
  previewModal: document.getElementById("preview-modal"),
  closePreview: document.getElementById("close-preview"),
  winModal: document.getElementById("win-modal"),
  playAgain: document.getElementById("play-again"),
};
