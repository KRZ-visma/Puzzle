(() => {
  const IMAGE_SRC = "assets/puzzle.jpg";
  const DIFFICULTIES = {
    12: { cols: 4, rows: 3 },
    24: { cols: 6, rows: 4 },
    48: { cols: 8, rows: 6 },
  };

  const boardEl = document.getElementById("board");
  const trayEl = document.getElementById("tray");
  const statusEl = document.getElementById("status");
  const placedCountEl = document.getElementById("placed-count");
  const totalCountEl = document.getElementById("total-count");
  const difficultyEl = document.getElementById("difficulty");
  const shuffleBtn = document.getElementById("shuffle-btn");
  const previewBtn = document.getElementById("preview-btn");
  const previewModal = document.getElementById("preview-modal");
  const closePreviewBtn = document.getElementById("close-preview");
  const winModal = document.getElementById("win-modal");
  const playAgainBtn = document.getElementById("play-again");

  let cols = 6;
  let rows = 4;
  let selectedId = null;
  let placements = new Map(); // slotIndex -> pieceId

  function totalPieces() {
    return cols * rows;
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function updateProgress() {
    placedCountEl.textContent = String(placements.size);
    totalCountEl.textContent = String(totalPieces());
  }

  function countCorrect() {
    let correct = 0;
    for (const [slotIndex, pieceId] of placements.entries()) {
      if (slotIndex === pieceId) correct += 1;
    }
    return correct;
  }

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function pieceBackground(pieceId) {
    const col = pieceId % cols;
    const row = Math.floor(pieceId / cols);
    const x = cols === 1 ? 0 : (col / (cols - 1)) * 100;
    const y = rows === 1 ? 0 : (row / (rows - 1)) * 100;
    return {
      backgroundSize: `${cols * 100}% ${rows * 100}%`,
      backgroundPosition: `${x}% ${y}%`,
    };
  }

  function createPiece(pieceId, { correct = false } = {}) {
    const piece = document.createElement("button");
    piece.type = "button";
    piece.className = "piece";
    piece.dataset.pieceId = String(pieceId);
    piece.setAttribute("aria-label", `Puzzle piece ${pieceId + 1}`);
    piece.draggable = !correct;

    const bg = pieceBackground(pieceId);
    piece.style.backgroundSize = bg.backgroundSize;
    piece.style.backgroundPosition = bg.backgroundPosition;

    if (correct) {
      piece.classList.add("correct");
    } else {
      piece.addEventListener("click", (event) => {
        event.stopPropagation();
        selectPiece(pieceId);
      });
      piece.addEventListener("dragstart", (event) => {
        selectPiece(pieceId);
        event.dataTransfer.setData("text/plain", String(pieceId));
        event.dataTransfer.effectAllowed = "move";
      });
    }

    return piece;
  }

  function clearSelection() {
    selectedId = null;
    document.querySelectorAll(".piece.selected").forEach((el) => {
      el.classList.remove("selected");
    });
  }

  function selectPiece(pieceId) {
    const slotOfPiece = findSlotOfPiece(pieceId);
    if (slotOfPiece !== null && slotOfPiece === pieceId) {
      setStatus("That piece is already in the right spot.");
      return;
    }

    clearSelection();
    selectedId = pieceId;
    document
      .querySelectorAll(`.piece[data-piece-id="${pieceId}"]`)
      .forEach((el) => el.classList.add("selected"));
    setStatus(`Piece ${pieceId + 1} selected — click an empty board spot.`);
  }

  function findSlotOfPiece(pieceId) {
    for (const [slotIndex, id] of placements.entries()) {
      if (id === pieceId) return slotIndex;
    }
    return null;
  }

  function removePieceFromCurrentLocation(pieceId) {
    const slotIndex = findSlotOfPiece(pieceId);
    if (slotIndex !== null) {
      placements.delete(slotIndex);
      const slot = boardEl.querySelector(`[data-slot="${slotIndex}"]`);
      if (slot) {
        slot.innerHTML = "";
        slot.classList.remove("filled");
      }
    }

    trayEl.querySelectorAll(`.piece[data-piece-id="${pieceId}"]`).forEach((el) => {
      el.remove();
    });
  }

  function placePiece(pieceId, slotIndex) {
    const existing = placements.get(slotIndex);
    if (existing !== undefined && existing !== pieceId) {
      // Send the displaced piece back to the tray.
      placements.delete(slotIndex);
      trayEl.appendChild(createPiece(existing));
    }

    removePieceFromCurrentLocation(pieceId);

    const slot = boardEl.querySelector(`[data-slot="${slotIndex}"]`);
    if (!slot) return;

    const isCorrect = pieceId === slotIndex;
    const piece = createPiece(pieceId, { correct: isCorrect });
    slot.innerHTML = "";
    slot.appendChild(piece);
    slot.classList.add("filled");
    placements.set(slotIndex, pieceId);

    clearSelection();
    updateProgress();

    if (isCorrect) {
      setStatus(`Nice — piece ${pieceId + 1} locked in.`);
    } else {
      setStatus("Placed. Keep going — or move it again if it looks off.");
    }

    if (countCorrect() === totalPieces()) {
      setStatus("Puzzle complete!");
      winModal.hidden = false;
    }
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--cols", String(cols));
    boardEl.style.setProperty("--rows", String(rows));
    boardEl.setAttribute("aria-rowcount", String(rows));
    boardEl.setAttribute("aria-colcount", String(cols));

    for (let i = 0; i < totalPieces(); i += 1) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.slot = String(i);
      slot.setAttribute("role", "gridcell");
      slot.setAttribute("aria-label", `Board slot ${i + 1}`);

      slot.addEventListener("click", () => {
        if (selectedId === null) {
          setStatus("Select a piece from the tray first.");
          return;
        }
        placePiece(selectedId, i);
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
        placePiece(pieceId, i);
      });

      boardEl.appendChild(slot);
    }
  }

  function buildTray() {
    trayEl.innerHTML = "";
    const ids = shuffle([...Array(totalPieces()).keys()]);
    ids.forEach((pieceId, index) => {
      const piece = createPiece(pieceId);
      piece.style.animationDelay = `${Math.min(index * 18, 360)}ms`;
      trayEl.appendChild(piece);
    });
  }

  function newGame() {
    const chosen = DIFFICULTIES[difficultyEl.value] || DIFFICULTIES[24];
    cols = chosen.cols;
    rows = chosen.rows;
    placements = new Map();
    clearSelection();
    winModal.hidden = true;
    previewModal.hidden = true;
    buildBoard();
    buildTray();
    updateProgress();
    setStatus("Pick a piece, then place it on the board.");
  }

  difficultyEl.addEventListener("change", newGame);
  shuffleBtn.addEventListener("click", newGame);
  playAgainBtn.addEventListener("click", newGame);

  previewBtn.addEventListener("click", () => {
    previewModal.hidden = false;
  });

  closePreviewBtn.addEventListener("click", () => {
    previewModal.hidden = true;
  });

  previewModal.addEventListener("click", (event) => {
    if (event.target === previewModal) previewModal.hidden = true;
  });

  winModal.addEventListener("click", (event) => {
    if (event.target === winModal) winModal.hidden = true;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      previewModal.hidden = true;
      winModal.hidden = true;
      clearSelection();
    }
  });

  // Warm the image cache, then start.
  const img = new Image();
  img.onload = newGame;
  img.onerror = () => {
    setStatus("Could not load the puzzle image.");
    newGame();
  };
  img.src = IMAGE_SRC;
})();
