import { clearPuzzleArea as moveGroupsOffBoard, clampGroupToCanvas } from "./clearArea.js";
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from "./config.js";
import { DEFAULT_IMAGE_ID, normalizeImageId } from "./gallery.js";
import { els } from "./dom.js";
import { createGroups, groupCount, mergeGroups, translateGroup } from "./groups.js";
import { LAYOUT_SIDE_TRAYS } from "./layout.js";
import { createPlayfield } from "./playfield.js";
import {
  buildProgress,
  clearProgress,
  deserializePositions,
  groupsFromGroupOf,
  saveProgress,
} from "./progress.js";
import { createRng } from "./rng.js";
import { createSideTrayUi } from "./sideTrays.js";
import { assignSideTrayIds } from "./trayPack.js";
import {
  countPlacedPieces,
  isGroupOnBoard,
  isPuzzleSolved,
  snapGroupToBoard,
  snapGroupToNeighbors,
} from "./snap.js";
import {
  getSelectedDifficulty,
  getSelectedImageId,
  getSelectedLayoutMode,
  setStatus,
  setZoomLabel,
  setBasketControls,
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
  let imageId = DEFAULT_IMAGE_ID;
  let image = null;
  let active = false;

  const sideTrays = createSideTrayUi({
    panel: els.playfieldPanel,
    leftTray: els.sideTrayLeft,
    rightTray: els.sideTrayRight,
    leftScroll: els.sideTrayLeftScroll,
    rightScroll: els.sideTrayRightScroll,
    leftCanvas: els.sideTrayLeftCanvas,
    rightCanvas: els.sideTrayRightCanvas,
    onTakePiece(pieceId, clientX, clientY, pointerId) {
      playfield.takeTrayPieceAndDrag(pieceId, clientX, clientY, pointerId);
      playfield.setTrayPieceIds(sideTrays.getTrayPieceIds());
      persist();
    },
  });

  /** @type {ReturnType<typeof createPlayfield>} */
  let playfield;
  playfield = createPlayfield(els.playfield, {
    onSelectionChange(pieceId) {
      if (pieceId === null) return;
      setStatus(`Moving a ${membersLabel(pieceId)} — drag near neighbors or the board outline.`);
    },
    onDragEnd(pieceId) {
      afterDrop(pieceId);
    },
    onCameraChange(camera) {
      setZoomLabel(camera.scale);
    },
    onBasketsChange(snapshot) {
      setBasketControls(snapshot.baskets.length);
    },
    onLayoutChange(layout) {
      if (!playfield || !sideTrays.isEnabled()) return;
      sideTrays.syncMetrics({
        pieceW: layout.pieceW,
        pieceH: layout.pieceH,
        edgeMap: playfield.getEdgeMap(),
        image,
      });
    },
  });

  function syncZoomLabel() {
    setZoomLabel(playfield.getCamera().scale);
  }

  setBasketControls(0);
  syncZoomLabel();

  /**
   * Reveal tray chrome first so the playfield shrinks, then pack pieces with
   * metrics that match the final board size (avoids stale oversized tray art).
   */
  function syncSideTraysFromPlayfield(rng) {
    const mode = playfield.getLayout().layoutMode;
    if (mode !== LAYOUT_SIDE_TRAYS) {
      sideTrays.clear();
      playfield.setTrayPieceIds([]);
      return;
    }
    sideTrays.setVisible(true);
    // Force a synchronous reflow + board remeasure now that trays occupy space.
    void els.playfield.offsetWidth;
    const layout = playfield.relayout();
    const assigned = assignSideTrayIds(cols * rows, rng);
    sideTrays.load({
      total: cols * rows,
      cols,
      rows,
      pieceW: layout.pieceW,
      pieceH: layout.pieceH,
      edgeMap: playfield.getEdgeMap(),
      image,
      leftIds: assigned.leftIds,
      rightIds: assigned.rightIds,
    });
    playfield.setTrayPieceIds(sideTrays.getTrayPieceIds());
  }

  function restoreSideTraysFromPositions() {
    const mode = playfield.getLayout().layoutMode;
    if (mode !== LAYOUT_SIDE_TRAYS) {
      sideTrays.clear();
      playfield.setTrayPieceIds([]);
      return;
    }
    sideTrays.setVisible(true);
    void els.playfield.offsetWidth;
    const layout = playfield.relayout();
    const positions = playfield.getPositions();
    const parked = [];
    for (let id = 0; id < positions.length; id += 1) {
      if (positions[id].x < -500 || positions[id].y < -500) parked.push(id);
    }
    const mid = Math.ceil(parked.length / 2);
    sideTrays.load({
      total: cols * rows,
      cols,
      rows,
      pieceW: layout.pieceW,
      pieceH: layout.pieceH,
      edgeMap: playfield.getEdgeMap(),
      image,
      leftIds: parked.slice(0, mid),
      rightIds: parked.slice(mid),
    });
    playfield.setTrayPieceIds(sideTrays.getTrayPieceIds());
  }

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
      imageId,
      layoutMode: layout.layoutMode,
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
      originX: layout.originX,
      originY: layout.originY,
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
      originX: layout.originX,
      originY: layout.originY,
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
          ? "Locked on the board. Keep connecting pieces."
          : "Pieces connected! Drag the group to keep building."
      );
    } else {
      setStatus("Drag pieces together — they snap when tabs line up.");
    }
  }

  function newGame() {
    const nextDifficulty = getSelectedDifficulty();
    const nextImageId = normalizeImageId(getSelectedImageId());
    const nextLayoutMode = getSelectedLayoutMode();
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
      imageId = nextImageId;
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
        layoutMode: nextLayoutMode,
        scatterRng: createRng(seed ^ 0x9e3779b9),
      });
      syncSideTraysFromPlayfield(createRng(seed ^ 0x9e3779b9));
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
      imageId = normalizeImageId(saved.imageId);
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
        layoutMode: saved.layoutMode,
        // Temporary scatter; replaced immediately with deserialized seats.
        scatterRng: createRng(seed ^ 0x9e3779b9),
      });

      const layout = playfield.getLayout();
      playfield.setPositions(deserializePositions(saved.positions, layout));
      restoreSideTraysFromPositions();
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
    sideTrays.clear();
    clearProgress();
  }

  function clearSelection() {
    // Canvas selection is transient during drag; nothing sticky to clear.
  }

  /** Move every group off the board silhouette, keeping groups connected. */
  function clearPuzzleArea() {
    if (!active || !groups || !cols) return 0;
    const layout = playfield.getLayout();
    if (!(layout.pieceW > 0) || !(layout.pieceH > 0)) return 0;
    const positions = playfield.getPositions();
    const moved = moveGroupsOffBoard({
      groups,
      positions,
      cols,
      rows,
      pieceW: layout.pieceW,
      pieceH: layout.pieceH,
      originX: layout.originX,
      originY: layout.originY,
      cssW: layout.cssW,
      cssH: layout.cssH,
    });
    if (moved > 0) {
      playfield.redraw();
      refreshProgress();
      persist();
      setStatus("Cleared the puzzle area — groups stay together.");
    }
    return moved;
  }

  /** Test/debug: assemble one piece onto the board and resolve snaps. */
  function assemblePiece(pieceId) {
    playfield.placePieceSolved(pieceId);
    afterDrop(pieceId);
  }

  /**
   * Test helper: attempt to move a group. Returns false when the group is
   * locked on the board (correct seats) and must stay put.
   */
  function tryMoveGroup(pieceId, dx, dy) {
    if (!groups || !cols) return false;
    const layout = playfield.getLayout();
    const positions = playfield.getPositions();
    if (
      isGroupOnBoard(
        groups,
        positions,
        pieceId,
        cols,
        layout.pieceW,
        layout.pieceH,
        layout.originX,
        layout.originY
      )
    ) {
      return false;
    }
    translateGroup(groups, positions, pieceId, dx, dy);
    const members = groups.members.get(groups.groupOf[pieceId]);
    clampGroupToCanvas(
      members,
      positions,
      layout.pieceW,
      layout.pieceH,
      layout.cssW,
      layout.cssH
    );
    playfield.redraw();
    return true;
  }

  function isPieceLocked(pieceId) {
    return playfield.isPieceLocked(pieceId);
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

  function addBasket() {
    if (!active) return null;
    const basket = playfield.addBasket();
    if (basket) {
      setStatus("Basket added — drag pieces into it, or drag the basket to move them.");
    }
    return basket;
  }

  function removeBasket() {
    if (!active) return null;
    const removed = playfield.removeBasket();
    if (removed) {
      setStatus(
        playfield.getBaskets().baskets.length
          ? "Basket removed. Pieces stay where they were."
          : "No baskets left."
      );
    }
    return removed;
  }

  return {
    newGame,
    restoreGame,
    abandonProgress,
    persist,
    clearSelection,
    clearPuzzleArea,
    addBasket,
    removeBasket,
    setImage(img) {
      image = img;
      playfield.setImage(img);
      if (sideTrays.isEnabled()) {
        const layout = playfield.getLayout();
        sideTrays.syncMetrics({
          pieceW: layout.pieceW,
          pieceH: layout.pieceH,
          edgeMap: playfield.getEdgeMap(),
          image: img,
        });
      }
    },
    setHardOptions(options) {
      playfield.setHardOptions(options);
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
    tryMoveGroup,
    isPieceLocked,
    tryMoveBasket: (basketId, dx, dy) => playfield.tryMoveBasket(basketId, dx, dy),
    putPieceInBasket: (pieceId, basketId) => playfield.putPieceInBasket(pieceId, basketId),
    getState: () => {
      const layout = playfield.getLayout();
      const positions = playfield.getPositions();
      const camera = playfield.getCamera();
      const baskets = playfield.getBaskets();
      const placed = countPlacedPieces(
        positions,
        cols,
        layout.pieceW,
        layout.pieceH,
        layout.originX,
        layout.originY
      );
      return {
        cols,
        rows,
        seed,
        difficulty,
        imageId,
        active,
        groups: groups ? groupCount(groups) : 0,
        placed,
        locked: placed,
        total: totalPieces(),
        threshold: layout.threshold,
        positions: positions.map((p) => ({ ...p })),
        baskets,
        sideTrays: sideTrays.getState(),
        layout: {
          pieceW: layout.pieceW,
          pieceH: layout.pieceH,
          originX: layout.originX,
          originY: layout.originY,
          cssW: layout.cssW,
          cssH: layout.cssH,
          layoutMode: layout.layoutMode,
        },
        camera,
      };
    },
  };
}
