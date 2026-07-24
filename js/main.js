import { IMAGE_SRC } from "./config.js";
import { createGame } from "./game.js";
import {
  bindChrome,
  setStatus,
  showPreview,
  showWin,
  setAppVersion,
  showUpdateBanner,
  bindUpdateBanner,
} from "./ui.js";
import { applyUpdate, initPwa } from "./pwa.js";

/**
 * App entry. Wire chrome controls, PWA updates, and start a game once the image is ready.
 */

const game = createGame();

// Stable handle for Playwright / debugging when launched with ?e2e=1
if (new URLSearchParams(window.location.search).get("e2e") === "1") {
  window.__PUZZLE__ = game;
}

bindChrome({
  onShuffle: () => game.newGame(),
  onPlayAgain: () => game.newGame(),
  onDifficultyChange: () => game.newGame(),
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
img.onload = () => game.newGame();
img.onerror = () => {
  setStatus("Could not load the puzzle image.");
  game.newGame();
};
img.src = IMAGE_SRC;
