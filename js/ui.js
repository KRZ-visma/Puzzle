import { DEFAULT_DIFFICULTY } from "./config.js";
import { DEFAULT_IMAGE_ID, getGalleryImage, normalizeImageId } from "./gallery.js";
import { els } from "./dom.js";
import { DEFAULT_HARD_OPTIONS, normalizeDifficulty, normalizeHardOptions } from "./settings.js";

/** Status text, menu, and modal chrome. */

let selectedDifficulty = DEFAULT_DIFFICULTY;
let hardOptions = { ...DEFAULT_HARD_OPTIONS };
let selectedImageId = DEFAULT_IMAGE_ID;

function setToggleControl(button, on) {
  if (!button) return;
  button.setAttribute("aria-checked", on ? "true" : "false");
  const state = button.querySelector(".app-menu-toggle-state");
  if (state) state.textContent = on ? "On" : "Off";
}

export function setStatus(message) {
  if (!els.status) return;
  els.status.textContent = message;
}

/** Progress is tracked in game state only — no on-canvas counters. */
export function updateProgress(_placed, _total, _groups) {}

export function showPreview(visible) {
  if (visible && hardOptions.disablePreview) return;
  els.previewModal.hidden = !visible;
  if (visible) closeAppMenu();
}

export function showWin(visible) {
  els.winModal.hidden = !visible;
  if (visible) closeAppMenu();
}

export function showStartMenu(visible) {
  if (!els.startModal) return;
  els.startModal.hidden = !visible;
  if (visible) closeAppMenu();
}

export function isAppMenuOpen() {
  return Boolean(els.appMenu && !els.appMenu.hidden);
}

export function openAppMenu() {
  if (!els.appMenu || !els.menuToggle) return;
  els.appMenu.hidden = false;
  els.menuToggle.setAttribute("aria-expanded", "true");
  els.menuToggle.setAttribute("aria-label", "Close menu");
}

export function closeAppMenu() {
  if (!els.appMenu || !els.menuToggle) return;
  els.appMenu.hidden = true;
  els.menuToggle.setAttribute("aria-expanded", "false");
  els.menuToggle.setAttribute("aria-label", "Open menu");
}

export function toggleAppMenu() {
  if (isAppMenuOpen()) closeAppMenu();
  else openAppMenu();
}

/** Sync start-menu options to a piece count. */
export function setDifficultyControls(value) {
  const n = normalizeDifficulty(value);
  selectedDifficulty = n;
  for (const btn of els.pieceOptions) {
    const selected = Number(btn.dataset.pieces) === n;
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
    btn.classList.toggle("is-selected", selected);
  }
  return n;
}

export function getSelectedDifficulty() {
  return normalizeDifficulty(selectedDifficulty);
}

/** Sync hard-mode menu toggles and Preview availability. */
export function setHardOptionControls(value) {
  hardOptions = normalizeHardOptions(value);
  setToggleControl(els.toggleHideBackground, hardOptions.hideBackgroundImage);
  setToggleControl(els.togglePreciseSnap, hardOptions.preciseSnap);
  setToggleControl(els.toggleDisablePreview, hardOptions.disablePreview);
  if (els.previewBtn) {
    els.previewBtn.hidden = hardOptions.disablePreview;
  }
  if (hardOptions.disablePreview) {
    showPreview(false);
  }
  return { ...hardOptions };
}

export function getHardOptions() {
  return { ...hardOptions };
}

/** Sync start-menu gallery selection and preview image. */
export function setImageControls(value) {
  const id = normalizeImageId(value);
  selectedImageId = id;
  for (const btn of els.galleryOptions) {
    const selected = btn.dataset.imageId === id;
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
    btn.classList.toggle("is-selected", selected);
  }
  setPreviewImage(getGalleryImage(id).src);
  return id;
}

export function getSelectedImageId() {
  return normalizeImageId(selectedImageId);
}

/** Update the preview modal image source. */
export function setPreviewImage(src) {
  if (!els.previewImage || !src) return;
  els.previewImage.src = src;
}

export function setZoomLabel(scale) {
  if (!els.zoomResetBtn) return;
  const pct = Math.round((Number(scale) || 1) * 100);
  els.zoomResetBtn.textContent = `${pct}%`;
}

export function bindChrome({
  onRestart,
  onPlayAgain,
  onStartPuzzle,
  onPieceOptionSelect,
  onHardOptionsChange,
  onImageOptionSelect,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) {
  els.menuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleAppMenu();
  });

  els.restartBtn?.addEventListener("click", () => {
    closeAppMenu();
    onRestart?.();
  });

  els.playAgain?.addEventListener("click", onPlayAgain);

  els.previewBtn?.addEventListener("click", () => showPreview(true));
  els.closePreview?.addEventListener("click", () => showPreview(false));

  const hardToggleBindings = [
    [els.toggleHideBackground, "hideBackgroundImage"],
    [els.togglePreciseSnap, "preciseSnap"],
    [els.toggleDisablePreview, "disablePreview"],
  ];
  for (const [button, key] of hardToggleBindings) {
    button?.addEventListener("click", (event) => {
      event.stopPropagation();
      const next = {
        ...hardOptions,
        [key]: !hardOptions[key],
      };
      setHardOptionControls(next);
      onHardOptionsChange?.(getHardOptions());
    });
  }

  els.previewModal?.addEventListener("click", (event) => {
    if (event.target === els.previewModal) showPreview(false);
  });

  els.winModal?.addEventListener("click", (event) => {
    if (event.target === els.winModal) showWin(false);
  });

  document.addEventListener("click", (event) => {
    if (!isAppMenuOpen()) return;
    const target = event.target;
    if (els.appMenu?.contains(target) || els.menuToggle?.contains(target)) return;
    closeAppMenu();
  });

  for (const btn of els.pieceOptions) {
    btn.addEventListener("click", () => {
      const n = normalizeDifficulty(btn.dataset.pieces);
      setDifficultyControls(n);
      onPieceOptionSelect?.(n);
    });
  }

  for (const btn of els.galleryOptions) {
    btn.addEventListener("click", () => {
      const id = normalizeImageId(btn.dataset.imageId);
      setImageControls(id);
      onImageOptionSelect?.(id);
    });
  }

  els.startBtn?.addEventListener("click", () => onStartPuzzle?.());

  els.zoomInBtn?.addEventListener("click", () => onZoomIn?.());
  els.zoomOutBtn?.addEventListener("click", () => onZoomOut?.());
  els.zoomResetBtn?.addEventListener("click", () => onZoomReset?.());
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
