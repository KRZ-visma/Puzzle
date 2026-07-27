import { getGalleryImage } from "./gallery.js";
import { createGame } from "./game.js";
import { clearProgress, loadProgress } from "./progress.js";
import {
  bindChrome,
  setStatus,
  setZoomLabel,
  showPreview,
  showWin,
  showStartMenu,
  setDifficultyControls,
  setImageControls,
  getSelectedDifficulty,
  setHardOptionControls,
  getSelectedImageId,
  setAppVersion,
  showUpdateBanner,
  bindUpdateBanner,
  closeAppMenu,
} from "./ui.js";
import { applyUpdate, initPwa } from "./pwa.js";
import {
  loadDifficultyPreference,
  loadHardOptions,
  loadImagePreference,
  saveDifficultyPreference,
  saveHardOptions,
  saveImagePreference,
} from "./settings.js";

/**
 * App entry. Wire chrome controls, PWA updates, and start a game once the image is ready.
 */

const game = createGame();

// Stable handle for Playwright / debugging when launched with ?e2e=1
if (new URLSearchParams(window.location.search).get("e2e") === "1") {
  window.__PUZZLE__ = game;
}

const savedProgress = loadProgress();
const savedDifficulty = savedProgress?.difficulty ?? loadDifficultyPreference();
const savedImageId = savedProgress?.imageId ?? loadImagePreference();
setDifficultyControls(savedDifficulty);
setImageControls(savedImageId);
const hardOptions = setHardOptionControls(loadHardOptions());
game.setHardOptions(hardOptions);
setStatus("");

// Resume immediately when a valid save exists so pieces reopen in place.
if (savedProgress) {
  showStartMenu(false);
} else {
  showStartMenu(true);
}

/**
 * Load a gallery image into the game (and preview).
 * @param {string} imageId
 * @param {() => void} [onReady]
 */
function loadPuzzleImage(imageId, onReady) {
  const entry = getGalleryImage(imageId);
  const img = new Image();
  img.onload = () => {
    game.setImage(img);
    setImageControls(entry.id);
    onReady?.();
  };
  img.onerror = () => {
    setStatus("Could not load the puzzle image. You can still start a puzzle.");
    onReady?.();
  };
  img.src = entry.src;
}

function returnToStartMenu() {
  game.abandonProgress();
  showWin(false);
  showPreview(false);
  closeAppMenu();
  setDifficultyControls(loadDifficultyPreference());
  setImageControls(loadImagePreference());
  showStartMenu(true);
  setStatus("");
}

function startPuzzleFromMenu() {
  const n = saveDifficultyPreference(getSelectedDifficulty());
  const imageId = saveImagePreference(getSelectedImageId());
  setDifficultyControls(n);
  setImageControls(imageId);
  showWin(false);
  showStartMenu(false);
  clearProgress();
  loadPuzzleImage(imageId, () => {
    game.newGame();
  });
}

function resumeSavedProgress(progress) {
  setDifficultyControls(progress.difficulty);
  saveDifficultyPreference(progress.difficulty);
  setImageControls(progress.imageId);
  saveImagePreference(progress.imageId);
  showWin(false);
  showStartMenu(false);
  loadPuzzleImage(progress.imageId, () => {
    game.restoreGame(progress);
  });
}

bindChrome({
  onRestart: () => returnToStartMenu(),
  onPlayAgain: () => returnToStartMenu(),
  onPieceOptionSelect: (n) => {
    saveDifficultyPreference(n);
  },
  onImageOptionSelect: (id) => {
    saveImagePreference(id);
  },
  onStartPuzzle: () => startPuzzleFromMenu(),
  onHardOptionsChange: (options) => {
    const saved = saveHardOptions(options);
    game.setHardOptions(saved);
  },
  onClearArea: () => {
    game.clearPuzzleArea();
  },
  onZoomIn: () => {
    const camera = game.zoomIn();
    setZoomLabel(camera.scale);
  },
  onZoomOut: () => {
    const camera = game.zoomOut();
    setZoomLabel(camera.scale);
  },
  onZoomReset: () => {
    const camera = game.resetView();
    setZoomLabel(camera.scale);
  },
});

setZoomLabel(game.getCamera().scale);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAppMenu();
    showPreview(false);
    showWin(false);
    game.clearSelection();
  }
});

bindUpdateBanner(() => applyUpdate());

initPwa({
  onVersion(data) {
    setAppVersion(data.version);
  },
  onUpdateAvailable(info) {
    if (info?.remote?.version) {
      setAppVersion(`${info.remote.version} (update ready)`);
    }
    showUpdateBanner(true);
  },
});

if (savedProgress) {
  resumeSavedProgress(savedProgress);
} else {
  loadPuzzleImage(savedImageId);
}
