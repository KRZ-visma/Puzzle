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
