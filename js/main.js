import { IMAGE_SRC } from "./config.js";
import { els } from "./dom.js";
import { createGame } from "./game.js";
import { clearProgress, loadProgress } from "./progress.js";
import {
  bindChrome,
  setStatus,
  showPreview,
  showWin,
  showStartMenu,
  setDifficultyControls,
  getSelectedDifficulty,
  setAppVersion,
  showUpdateBanner,
  bindUpdateBanner,
  closeAppMenu,
} from "./ui.js";
import { applyUpdate, initPwa } from "./pwa.js";
import { loadDifficultyPreference, saveDifficultyPreference } from "./settings.js";

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
setDifficultyControls(savedDifficulty);
setStatus("");

// Resume immediately when a valid save exists so pieces reopen in place.
if (savedProgress) {
  showStartMenu(false);
} else {
  showStartMenu(true);
}

function returnToStartMenu() {
  game.abandonProgress();
  showWin(false);
  showPreview(false);
  closeAppMenu();
  setDifficultyControls(loadDifficultyPreference());
  showStartMenu(true);
  setStatus("");
}

function startPuzzleFromMenu() {
  const n = saveDifficultyPreference(getSelectedDifficulty());
  setDifficultyControls(n);
  showWin(false);
  showStartMenu(false);
  clearProgress();
  game.newGame();
}

function resumeSavedProgress(progress) {
  setDifficultyControls(progress.difficulty);
  saveDifficultyPreference(progress.difficulty);
  showWin(false);
  showStartMenu(false);
  game.restoreGame(progress);
}

bindChrome({
  onRestart: () => returnToStartMenu(),
  onPlayAgain: () => returnToStartMenu(),
  onPieceOptionSelect: (n) => {
    saveDifficultyPreference(n);
  },
  onStartPuzzle: () => startPuzzleFromMenu(),
});

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

const img = new Image();
img.onload = () => {
  game.setImage(img);
  if (savedProgress) {
    resumeSavedProgress(savedProgress);
  }
};
img.onerror = () => {
  setStatus("Could not load the puzzle image. You can still start a puzzle.");
  if (savedProgress) {
    resumeSavedProgress(savedProgress);
  }
};
img.src = IMAGE_SRC;
