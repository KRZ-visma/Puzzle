import { els } from "./dom.js";

/** Status text, progress counters, and modal chrome. */

export function setStatus(message) {
  els.status.textContent = message;
}

export function updateProgress(placed, total, groups) {
  els.placedCount.textContent = String(placed);
  els.totalCount.textContent = String(total);
  if (els.groupCount && groups != null) {
    els.groupCount.textContent = String(groups);
  }
}

export function showPreview(visible) {
  els.previewModal.hidden = !visible;
}

export function showWin(visible) {
  els.winModal.hidden = !visible;
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

export function setAppVersion(version) {
  if (!els.appVersion) return;
  els.appVersion.textContent = version || "unknown";
}

export function showUpdateBanner(visible) {
  if (!els.updateBanner) return;
  els.updateBanner.hidden = !visible;
}

export function bindUpdateBanner(onReload) {
  els.reloadUpdate?.addEventListener("click", () => onReload?.());
}
