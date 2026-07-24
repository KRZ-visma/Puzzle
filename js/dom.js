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
  appVersion: document.getElementById("app-version"),
  updateBanner: document.getElementById("update-banner"),
  reloadUpdate: document.getElementById("reload-update"),
};
