import { els } from "./dom.js";
import { createPiece } from "./pieces.js";

/** Board grid rendering and slot drop targets. */

export function buildBoard({ cols, rows, total, onPlace, onEmptyClick }) {
  const board = els.board;
  board.innerHTML = "";
  board.style.setProperty("--cols", String(cols));
  board.style.setProperty("--rows", String(rows));
  board.setAttribute("aria-rowcount", String(rows));
  board.setAttribute("aria-colcount", String(cols));

  for (let i = 0; i < total; i += 1) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.slot = String(i);
    slot.setAttribute("data-testid", `slot-${i}`);
    slot.setAttribute("role", "gridcell");
    slot.setAttribute("aria-label", `Board slot ${i + 1}`);

    slot.addEventListener("click", () => {
      onEmptyClick?.(i);
    });

    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
      slot.classList.add("drop-target");
    });

    slot.addEventListener("dragleave", () => {
      slot.classList.remove("drop-target");
    });

    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("drop-target");
      const raw = event.dataTransfer.getData("text/plain");
      const pieceId = Number.parseInt(raw, 10);
      if (Number.isNaN(pieceId)) return;
      onPlace?.(pieceId, i);
    });

    board.appendChild(slot);
  }
}

export function clearSlot(slotIndex) {
  const slot = els.board.querySelector(`[data-slot="${slotIndex}"]`);
  if (!slot) return;
  slot.innerHTML = "";
  slot.classList.remove("filled");
}

export function renderPieceInSlot(slotIndex, pieceId, { cols, rows, correct, onSelect }) {
  const slot = els.board.querySelector(`[data-slot="${slotIndex}"]`);
  if (!slot) return;

  const piece = createPiece(pieceId, { cols, rows, correct, onSelect });
  slot.innerHTML = "";
  slot.appendChild(piece);
  slot.classList.add("filled");
}
