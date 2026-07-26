/** Cached DOM references. Keep selectors here so markup renames stay localized. */

export const els = {
  playfield: document.getElementById("playfield"),
  status: document.getElementById("status"),
  placedCount: document.getElementById("placed-count"),
  totalCount: document.getElementById("total-count"),
  groupCount: document.getElementById("group-count"),
  difficulty: document.getElementById("difficulty"),
  shuffleBtn: document.getElementById("shuffle-btn"),
  previewBtn: document.getElementById("preview-btn"),
  previewModal: document.getElementById("preview-modal"),
  closePreview: document.getElementById("close-preview"),
  winModal: document.getElementById("win-modal"),
  playAgain: document.getElementById("play-again"),
  startModal: document.getElementById("start-modal"),
  startBtn: document.getElementById("start-btn"),
  pieceOptions: document.getElementById("start-modal")?.querySelectorAll(".piece-option") ?? [],
  appVersion: document.getElementById("app-version"),
  updateBanner: document.getElementById("update-banner"),
  reloadUpdate: document.getElementById("reload-update"),
};
