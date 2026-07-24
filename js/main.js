import { IMAGE_SRC } from "./config.js";
import { createGame } from "./game.js";
import { bindChrome, setStatus, showPreview, showWin } from "./ui.js";

/**
 * App entry. Wire chrome controls and start a game once the image is ready.
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

const img = new Image();
img.onload = () => game.newGame();
img.onerror = () => {
  setStatus("Could not load the puzzle image.");
  game.newGame();
};
img.src = IMAGE_SRC;
