import { DIFFICULTIES, DEFAULT_DIFFICULTY } from "./config.js";
import { els } from "./dom.js";
import { createGroups, groupCount, mergeGroups } from "./groups.js";
import { createPlayfield } from "./playfield.js";
import {
  buildProgress,
  clearProgress,
  deserializePositions,
  groupsFromGroupOf,
  saveProgress,
} from "./progress.js";
import { createRng } from "./rng.js";
import {
  countPlacedPieces,
  isPuzzleSolved,
  snapGroupToBoard,
  snapGroupToNeighbors,
} from "./snap.js";
import {
  getSelectedDifficulty,
  setStatus,
  setZoomLabel,
  updateProgress,
  showPreview,
  showWin,
} from "./ui.js";
import { neighborId, neighborOffset, solvedPosition } from "./geometry.js";

/**
 * Game orchestration for the free-form interlocking canvas puzzle.
 */

export function createGame() {
  let cols = 0;
  let rows = 0;
  let groups = null;
  let seed = 1;
  let difficulty = DEFAULT_DIFFICULTY;
  let image = null;
  let active = false;

  const playfield = createPlayfield(els.playfield, {
    onSelectionChange(pieceId) {
      if (pieceId === null) return;
      setStatus(`Moving a ${membersLabel(pieceId)} — drag near neighbors or the board outline.`);
    },
    onDragEnd(pieceId) {
      afterDrop(pieceId);
    },
  });

  function syncZoomLabel() {
    setZoomLabel(playfield.getCamera().scale);
  }

  syncZoomLabel();

  function totalPieces() {
    return cols * rows;
  }

  function membersLabel(pieceId) {
    const size = groups.members.get(groups.groupOf[pieceId]).size;
    return size === 1 ? "piece" : `${size}-piece group`;
  }

  function refreshProgress() {
    const layout = playfield.getLayout();
    const placed = countPlacedPieces(
      playfield.getPositions(),
      cols,
      layout.pieceW,
      layout.pieceH,
      layout.originX,
      layout.originY
    );
    updateProgress(placed, totalPieces(), groupCount(groups));
  }

  function persist() {
    if (!active || !groups || !cols) return false;
    const layout = playfield.getLayout();
    if (!(layout.pieceW > 0) || !(layout.pieceH > 0)) return false;
    const payload = buildProgress({
      difficulty,
      cols,
      rows,
      seed,
      positions: playfield.getPositions(),
      groupOf: groups.groupOf,
      layout,
    });
    return saveProgress(payload);
  }

  function afterDrop(pieceId) {
    const layout = playfield.getLayout();
    const positions = playfield.getPositions();

    const neighborMerges = snapGroupToNeighbors({
      activePieceId: pieceId,
      groups,
      positions,
      cols,
      rows,
      pieceW: layout.pieceW,
      pieceH: layout.pieceH,
      threshold: layout.threshold,
    });

    const boarded = snapGroupToBoard({
      activePieceId: pieceId,
      groups,
      positions,
      cols,
      pieceW: layout.pieceW,
      pieceH: layout.pieceH,
      originX: layout.originX,
      originY: layout.originY,
      threshold: layout.threshold,
    });

    // After boarding, neighbors may now align — one more neighbor pass.
    const extraMerges = snapGroupToNeighbors({
      activePieceId: pieceId,
      groups,
      positions,
      cols,
      rows,
      pieceW: layout.pieceW,
      pieceH: layout.pieceH,
      threshold: layout.threshold,
    });

    playfield.redraw();
    refreshProgress();
    persist();

    if (isPuzzleSolved(positions, cols, layout.pieceW, layout.pieceH, layout.originX, layout.originY)) {
      setStatus("Puzzle complete!");
      showWin(true);
      return;
    }

    if (neighborMerges + extraMerges > 0 || boarded) {
      setStatus(
        boarded
          ? "Snapped to the board. Keep connecting pieces."
          : "Pieces connected! Drag the group to keep building."
      );
    } else {
      setStatus("Drag pieces together — they snap when tabs line up.");
    }
  }

  function newGame() {
    const nextDifficulty = getSelectedDifficulty();
    const chosen = DIFFICULTIES[nextDifficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];
    const nextSeed = (Date.now() ^ (chosen.cols * 997) ^ (chosen.rows * 131)) >>> 0 || 1;

    setStatus(
      chosen.cols * chosen.rows >= 500
        ? "Preparing a large puzzle…"
        : "Shuffling pieces…"
    );

    // Allow the status paint to land before heavy sprite work.
    requestAnimationFrame(() => {
      cols = chosen.cols;
      rows = chosen.rows;
      seed = nextSeed;
      difficulty = nextDifficulty;
      groups = createGroups(chosen.cols * chosen.rows);
      active = true;
      showWin(false);
      showPreview(false);

      playfield.setImage(image);
      playfield.reset({
        cols,
        rows,
        groups,
        seed,
        scatterRng: createRng(seed ^ 0x9e3779b9),
      });
      syncZoomLabel();
      refreshProgress();
      persist();
      setStatus("");
    });
  }

  /**
   * Restore a previously saved puzzle (piece seats + groups + edge seed).
   * @param {NonNullable<ReturnType<typeof import("./progress.js").normalizeProgress>>} saved
   */
  function restoreGame(saved) {
    setStatus("Restoring your puzzle…");
    requestAnimationFrame(() => {
      cols = saved.cols;
      rows = saved.rows;
      seed = saved.seed;
      difficulty = saved.difficulty;
      groups = groupsFromGroupOf(saved.groupOf);
      active = true;
      showWin(false);
      showPreview(false);

      playfield.setImage(image);
      playfield.reset({
        cols,
        rows,
        groups,
        seed,
        // Temporary scatter; replaced immediately with deserialized seats.
        scatterRng: createRng(seed ^ 0x9e3779b9),
      });

      const layout = playfield.getLayout();
      playfield.setPositions(deserializePositions(saved.positions, layout));
      syncZoomLabel();
      refreshProgress();
      persist();

      const positions = playfield.getPositions();
      if (isPuzzleSolved(positions, cols, layout.pieceW, layout.pieceH, layout.originX, layout.originY)) {
        setStatus("Puzzle complete!");
        showWin(true);
      } else {
        setStatus("");
      }
    });
  }

  /** Clear saved progress (used before returning to the start menu). */
  function abandonProgress() {
    active = false;
    clearProgress();
  }

  function clearSelection() {
    // Canvas selection is transient during drag; nothing sticky to clear.
  }

  /** Test/debug: assemble one piece onto the board and resolve snaps. */
  function assemblePiece(pieceId) {
    playfield.placePieceSolved(pieceId);
    afterDrop(pieceId);
  }

  /** Test/debug: connect piece to a cardinal neighbor if both exist. */
  function connectNeighbors(pieceId, direction = "right") {
    const layout = playfield.getLayout();
    const positions = playfield.getPositions();
    const otherId = neighborId(pieceId, cols, rows, direction);
    if (otherId === null) return false;
    if (groups.groupOf[pieceId] === groups.groupOf[otherId]) return true;

    const offset = neighborOffset(direction, layout.pieceW, layout.pieceH);
    const targetX = positions[pieceId].x + offset.x;
    const targetY = positions[pieceId].y + offset.y;
    const dx = targetX - positions[otherId].x;
    const dy = targetY - positions[otherId].y;
    mergeGroups(groups, positions, otherId, pieceId, dx, dy);
    playfield.redraw();
    refreshProgress();
    persist();
    return true;
  }

  /** Test/debug: place every piece correctly and merge into one board group. */
  function solve() {
    const layout = playfield.getLayout();
    const positions = playfield.getPositions();
    for (let id = 0; id < totalPieces(); id += 1) {
      const solved = solvedPosition(
        id,
        cols,
        layout.pieceW,
        layout.pieceH,
        layout.originX,
        layout.originY
      );
      positions[id].x = solved.x;
      positions[id].y = solved.y;
    }
    // Merge all into group 0.
    for (let id = 1; id < totalPieces(); id += 1) {
      if (groups.groupOf[id] !== groups.groupOf[0]) {
        mergeGroups(groups, positions, id, 0, 0, 0);
      }
    }
    playfield.redraw();
    refreshProgress();
    persist();
    setStatus("Puzzle complete!");
    showWin(true);
  }

  // Keep progress durable across tab close / backgrounding.
  window.addEventListener("pagehide", () => persist());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist();
  });

  function zoomIn() {
    const camera = playfield.zoomIn();
    syncZoomLabel();
    return camera;
  }

  function zoomOut() {
    const camera = playfield.zoomOut();
    syncZoomLabel();
    return camera;
  }

  function resetView() {
    const camera = playfield.resetView();
    syncZoomLabel();
    return camera;
  }

  function getCamera() {
    return playfield.getCamera();
  }

  function setCamera(next) {
    const camera = playfield.setCamera(next);
    syncZoomLabel();
    return camera;
  }

  return {
    newGame,
    restoreGame,
    abandonProgress,
    persist,
    clearSelection,
    setImage(img) {
      image = img;
      playfield.setImage(img);
    },
    zoomIn,
    zoomOut,
    resetView,
    getCamera,
    setCamera,
    // Test/debug mirrors
    assemblePiece,
    connectNeighbors,
    solve,
    getState: () => {
      const layout = playfield.getLayout();
      const positions = playfield.getPositions();
      const camera = playfield.getCamera();
      return {
        cols,
        rows,
        seed,
        difficulty,
        active,
        groups: groups ? groupCount(groups) : 0,
        placed: countPlacedPieces(
          positions,
          cols,
          layout.pieceW,
          layout.pieceH,
          layout.originX,
          layout.originY
        ),
        total: totalPieces(),
        positions: positions.map((p) => ({ ...p })),
        camera,
      };
    },
  };
}
