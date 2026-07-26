import { IMAGE_SRC } from "./config.js";
import { els } from "./dom.js";
import { createGame } from "./game.js";
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

const savedDifficulty = loadDifficultyPreference();
setDifficultyControls(savedDifficulty);
setStatus("Choose how many pieces to begin.");
showStartMenu(true);

function isStartMenuOpen() {
  return Boolean(els.startModal && !els.startModal.hidden);
}

function startPuzzleFromMenu() {
  const n = saveDifficultyPreference(getSelectedDifficulty());
  setDifficultyControls(n);
  showWin(false);
  showStartMenu(false);
  game.newGame();
}

bindChrome({
  onShuffle: () => {
    if (isStartMenuOpen()) return;
    game.newGame();
  },
  onPlayAgain: () => {
    showWin(false);
    setDifficultyControls(loadDifficultyPreference());
    showStartMenu(true);
    setStatus("Choose how many pieces to begin.");
  },
  onDifficultyChange: () => {
    const n = saveDifficultyPreference(getSelectedDifficulty());
    setDifficultyControls(n);
    if (isStartMenuOpen()) return;
    game.newGame();
  },
  onPieceOptionSelect: (n) => {
    saveDifficultyPreference(n);
  },
  onStartPuzzle: () => startPuzzleFromMenu(),
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
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
};
img.onerror = () => {
  setStatus("Could not load the puzzle image. You can still start a puzzle.");
};
img.src = IMAGE_SRC;
