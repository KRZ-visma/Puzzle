import { DIFFICULTIES, DEFAULT_DIFFICULTY } from "./config.js";
import { els } from "./dom.js";
import { buildBoard, clearSlot, renderPieceInSlot } from "./board.js";
import { buildTray, removeFromTray, appendToTray } from "./tray.js";
import {
  setStatus,
  updateProgress,
  showPreview,
  showWin,
  clearPieceSelection,
  markPieceSelected,
} from "./ui.js";
import {
  countCorrectPlacements,
  findSlotOfPiece,
  isCorrectPlacement,
  isPuzzleComplete,
} from "./rules.js";

/**
 * Core game state and rules. Prefer editing feature modules (board/tray/pieces/ui)
 * for UI work; keep placement orchestration here. Pure rules live in rules.js.
 */

export function createGame() {
  let cols = 6;
  let rows = 4;
  let selectedId = null;
  let placements = new Map();

  function totalPieces() {
    return cols * rows;
  }

  function clearSelection() {
    selectedId = null;
    clearPieceSelection();
  }

  function selectPiece(pieceId) {
    const slotOfPiece = findSlotOfPiece(placements, pieceId);
    if (slotOfPiece !== null && isCorrectPlacement(pieceId, slotOfPiece)) {
      setStatus("That piece is already in the right spot.");
      return;
    }

    clearSelection();
    selectedId = pieceId;
    markPieceSelected(pieceId);
    setStatus(`Piece ${pieceId + 1} selected — click an empty board spot.`);
  }

  function removePieceFromCurrentLocation(pieceId) {
    const slotIndex = findSlotOfPiece(placements, pieceId);
    if (slotIndex !== null) {
      placements.delete(slotIndex);
      clearSlot(slotIndex);
    }
    removeFromTray(pieceId);
  }

  function placePiece(pieceId, slotIndex) {
    const existing = placements.get(slotIndex);
    if (existing !== undefined && existing !== pieceId) {
      placements.delete(slotIndex);
      appendToTray(existing, { cols, rows, onSelect: selectPiece });
    }

    removePieceFromCurrentLocation(pieceId);

    const correct = isCorrectPlacement(pieceId, slotIndex);
    renderPieceInSlot(slotIndex, pieceId, {
      cols,
      rows,
      correct,
      onSelect: selectPiece,
    });
    placements.set(slotIndex, pieceId);

    clearSelection();
    updateProgress(placements.size, totalPieces());

    if (correct) {
      setStatus(`Nice — piece ${pieceId + 1} locked in.`);
    } else {
      setStatus("Placed. Keep going — or move it again if it looks off.");
    }

    if (isPuzzleComplete(placements, totalPieces())) {
      setStatus("Puzzle complete!");
      showWin(true);
    }
  }

  function newGame() {
    const chosen =
      DIFFICULTIES[els.difficulty.value] || DIFFICULTIES[DEFAULT_DIFFICULTY];
    cols = chosen.cols;
    rows = chosen.rows;
    placements = new Map();
    clearSelection();
    showWin(false);
    showPreview(false);

    buildBoard({
      cols,
      rows,
      total: totalPieces(),
      onPlace: placePiece,
      onEmptyClick: (slotIndex) => {
        if (selectedId === null) {
          setStatus("Select a piece from the tray first.");
          return;
        }
        placePiece(selectedId, slotIndex);
      },
    });

    buildTray({
      total: totalPieces(),
      cols,
      rows,
      onSelect: selectPiece,
    });

    updateProgress(0, totalPieces());
    setStatus("Pick a piece, then place it on the board.");
  }

  return {
    newGame,
    clearSelection,
    // Test/debug mirrors — not required by the UI.
    placePiece,
    getState: () => ({
      cols,
      rows,
      selectedId,
      placements: new Map(placements),
      correct: countCorrectPlacements(placements),
      total: totalPieces(),
    }),
  };
}
