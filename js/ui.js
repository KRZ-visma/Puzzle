import { els } from "./dom.js";
import { normalizeDifficulty } from "./settings.js";

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

export function showStartMenu(visible) {
  if (!els.startModal) return;
  els.startModal.hidden = !visible;
}

/** Sync header select + start-menu options to a piece count. */
export function setDifficultyControls(value) {
  const n = normalizeDifficulty(value);
  if (els.difficulty) {
    els.difficulty.value = String(n);
  }
  for (const btn of els.pieceOptions) {
    const selected = Number(btn.dataset.pieces) === n;
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
    btn.classList.toggle("is-selected", selected);
  }
  return n;
}

export function getSelectedDifficulty() {
  return normalizeDifficulty(els.difficulty?.value);
}

export function bindChrome({
  onShuffle,
  onPlayAgain,
  onDifficultyChange,
  onStartPuzzle,
  onPieceOptionSelect,
}) {
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

  for (const btn of els.pieceOptions) {
    btn.addEventListener("click", () => {
      const n = normalizeDifficulty(btn.dataset.pieces);
      setDifficultyControls(n);
      onPieceOptionSelect?.(n);
    });
  }

  els.startBtn?.addEventListener("click", () => onStartPuzzle?.());
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
