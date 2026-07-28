/**
 * Always-visible left/right side tray panels with native scrollbars.
 * Pieces are drawn on tall tray canvases (not per-piece DOM nodes).
 * Display size is scaled to fit the tray width; playfield keeps its own metrics.
 */

import {
  applyPathCommands,
  buildPiecePathCommands,
  piecePadding,
} from "./geometry.js";
import {
  assignSideTrayIds,
  hitTestTrayPiece,
  packTrayColumn,
  removeTrayId,
  TRAY_GAP,
  TRAY_PADDING_X,
} from "./trayPack.js";

function createPath2D(commands) {
  const path = new Path2D();
  applyPathCommands(path, commands);
  return path;
}

/**
 * Size a canvas bitmap to match its CSS box exactly (avoids stretch distortion).
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cssW
 * @param {number} cssH
 */
function sizeCanvas(canvas, ctx, cssW, cssH) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(cssW));
  const h = Math.max(1, Math.round(cssH));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * @param {{
 *   panel: HTMLElement,
 *   leftTray: HTMLElement,
 *   rightTray: HTMLElement,
 *   leftScroll: HTMLElement,
 *   rightScroll: HTMLElement,
 *   leftCanvas: HTMLCanvasElement,
 *   rightCanvas: HTMLCanvasElement,
 *   onTakePiece: (pieceId: number, clientX: number, clientY: number, pointerId: number) => void,
 * }} opts
 */
export function createSideTrayUi(opts) {
  const {
    panel,
    leftTray,
    rightTray,
    leftScroll,
    rightScroll,
    leftCanvas,
    rightCanvas,
    onTakePiece,
  } = opts;

  const leftCtx = leftCanvas.getContext("2d");
  const rightCtx = rightCanvas.getContext("2d");

  let enabled = false;
  /** @type {number[]} */
  let leftIds = [];
  /** @type {number[]} */
  let rightIds = [];
  /** @type {Map<number, { x: number, y: number }>} */
  let leftLocal = new Map();
  /** @type {Map<number, { x: number, y: number }>} */
  let rightLocal = new Map();
  let leftDrawW = 0;
  let leftDrawH = 0;
  let rightDrawW = 0;
  let rightDrawH = 0;
  let pieceW = 0;
  let pieceH = 0;
  let cols = 0;
  let rows = 0;
  let image = null;
  let edgeMap = null;
  /** @type {Path2D[]} */
  let paths = [];
  let pad = 0;
  let lastScale = 1;

  function setVisible(visible) {
    enabled = Boolean(visible);
    panel.classList.toggle("with-side-trays", enabled);
    leftTray.hidden = !enabled;
    rightTray.hidden = !enabled;
    if (!enabled) {
      leftIds = [];
      rightIds = [];
      leftLocal = new Map();
      rightLocal = new Map();
    }
  }

  function isEnabled() {
    return enabled;
  }

  function rebuildPaths() {
    const total = cols * rows;
    paths = new Array(total);
    if (!edgeMap || !(pieceW > 0)) return;
    for (let id = 0; id < total; id += 1) {
      paths[id] = createPath2D(buildPiecePathCommands(id, edgeMap, pieceW, pieceH));
    }
    pad = piecePadding(pieceW, pieceH);
  }

  function packSide(ids, trayW) {
    return packTrayColumn(ids, {
      trayW: Math.max(1, trayW),
      pieceW,
      pieceH,
      pad,
      gap: TRAY_GAP,
      paddingX: TRAY_PADDING_X,
    });
  }

  function drawPieceOn(ctx, id, x, y, scale) {
    const path = paths[id];
    if (!path) return;
    const col = id % cols;
    const row = Math.floor(id / cols);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.save();
    ctx.clip(path);
    if (image) {
      ctx.drawImage(image, -col * pieceW, -row * pieceH, cols * pieceW, rows * pieceH);
    } else {
      ctx.fillStyle = `hsl(${(id * 47) % 360} 45% 60%)`;
      ctx.fill(path);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(31, 58, 46, 0.45)";
    ctx.lineWidth = Math.max(0.6, Math.min(pieceW, pieceH) * 0.03);
    ctx.stroke(path);
    ctx.restore();
  }

  function paintTray(canvas, ctx, scrollEl, ids, side) {
    const cssW = Math.max(1, scrollEl.clientWidth || (side === "left" ? leftTray.clientWidth : rightTray.clientWidth) || 120);
    const packed = packSide(ids, cssW);
    if (side === "left") {
      leftLocal = packed.localPositions;
      leftDrawW = packed.drawW;
      leftDrawH = packed.drawH;
    } else {
      rightLocal = packed.localPositions;
      rightDrawW = packed.drawW;
      rightDrawH = packed.drawH;
    }
    lastScale = packed.scale;

    const cssH = Math.max(scrollEl.clientHeight || 1, packed.contentH);
    sizeCanvas(canvas, ctx, cssW, cssH);
    ctx.clearRect(0, 0, cssW, cssH);

    ctx.fillStyle = "rgba(31, 58, 46, 0.06)";
    ctx.fillRect(0, 0, cssW, cssH);

    for (const id of ids) {
      const pos = packed.localPositions.get(id);
      if (!pos) continue;
      drawPieceOn(ctx, id, pos.x, pos.y, packed.scale);
    }
  }

  function redraw() {
    if (!enabled) return;
    paintTray(leftCanvas, leftCtx, leftScroll, leftIds, "left");
    paintTray(rightCanvas, rightCtx, rightScroll, rightIds, "right");
  }

  /**
   * Load tray contents for a new puzzle.
   * @param {{
   *   total: number,
   *   cols: number,
   *   rows: number,
   *   pieceW: number,
   *   pieceH: number,
   *   edgeMap: unknown,
   *   image: CanvasImageSource | null,
   *   rng?: () => number,
   *   leftIds?: number[],
   *   rightIds?: number[],
   * }} spec
   */
  function load(spec) {
    cols = spec.cols;
    rows = spec.rows;
    pieceW = spec.pieceW;
    pieceH = spec.pieceH;
    edgeMap = spec.edgeMap;
    image = spec.image;
    rebuildPaths();
    if (spec.leftIds && spec.rightIds) {
      leftIds = [...spec.leftIds];
      rightIds = [...spec.rightIds];
    } else {
      const assigned = assignSideTrayIds(spec.total, spec.rng || Math.random);
      leftIds = assigned.leftIds;
      rightIds = assigned.rightIds;
    }
    setVisible(true);
    redraw();
    return {
      leftIds: [...leftIds],
      rightIds: [...rightIds],
    };
  }

  function clear() {
    setVisible(false);
    paths = [];
    image = null;
    edgeMap = null;
  }

  function getTrayPieceIds() {
    return new Set([...leftIds, ...rightIds]);
  }

  function getState() {
    return {
      enabled,
      leftIds: [...leftIds],
      rightIds: [...rightIds],
      pieceW,
      pieceH,
      gap: TRAY_GAP,
      scale: lastScale,
      drawW: leftDrawW || rightDrawW,
      drawH: leftDrawH || rightDrawH,
    };
  }

  function removePiece(pieceId) {
    const beforeL = leftIds.length;
    const beforeR = rightIds.length;
    leftIds = removeTrayId(leftIds, pieceId);
    rightIds = removeTrayId(rightIds, pieceId);
    if (leftIds.length !== beforeL || rightIds.length !== beforeR) {
      redraw();
      return true;
    }
    return false;
  }

  function syncMetrics({ pieceW: pw, pieceH: ph, edgeMap: em, image: img }) {
    const sizeChanged = pw !== pieceW || ph !== pieceH;
    pieceW = pw;
    pieceH = ph;
    edgeMap = em;
    image = img;
    if (sizeChanged || paths.length !== cols * rows) rebuildPaths();
    if (enabled) redraw();
  }

  function eventLocalPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, parseFloat(canvas.style.width) || rect.width);
    const cssH = Math.max(1, parseFloat(canvas.style.height) || rect.height);
    // Map through displayed size so hit-tests stay correct even if CSS ever drifts.
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * cssW,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * cssH,
    };
  }

  function bindTrayPointer(canvas, scrollEl, getIds, getLocal, getDrawSize) {
    /** @type {null | { pointerId: number, pieceId: number, x: number, y: number }} */
    let pending = null;
    const TAKE_SLOP = 10;

    function clearPending() {
      pending = null;
    }

    function takePiece(pieceId, event) {
      event.preventDefault();
      event.stopPropagation();
      removePiece(pieceId);
      onTakePiece?.(pieceId, event.clientX, event.clientY, event.pointerId);
    }

    canvas.addEventListener("pointerdown", (event) => {
      if (!enabled) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const ids = getIds();
      const local = getLocal();
      const { drawW, drawH } = getDrawSize();
      const pt = eventLocalPoint(canvas, event);
      const pieceId = hitTestTrayPiece(local, ids, pt.x, pt.y, drawW, drawH);
      if (pieceId === null) {
        clearPending();
        return;
      }
      // Do not preventDefault yet — vertical pans must scroll the tray.
      pending = {
        pointerId: event.pointerId,
        pieceId,
        x: event.clientX,
        y: event.clientY,
      };
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!pending || pending.pointerId !== event.pointerId) return;
      const dx = event.clientX - pending.x;
      const dy = event.clientY - pending.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absY > TAKE_SLOP && absY >= absX) {
        // Vertical scroll gesture — leave the piece in the tray.
        clearPending();
        return;
      }
      if (absX > TAKE_SLOP || Math.hypot(dx, dy) > TAKE_SLOP * 1.4) {
        const { pieceId } = pending;
        clearPending();
        takePiece(pieceId, event);
      }
    });

    function endPending(event) {
      if (!pending || pending.pointerId !== event.pointerId) return;
      const { pieceId } = pending;
      clearPending();
      // Tap / short press pulls the piece onto the playfield.
      takePiece(pieceId, event);
    }

    canvas.addEventListener("pointerup", endPending);
    canvas.addEventListener("pointercancel", clearPending);
    scrollEl.addEventListener(
      "scroll",
      () => {
        clearPending();
      },
      { passive: true }
    );
  }

  bindTrayPointer(
    leftCanvas,
    leftScroll,
    () => leftIds,
    () => leftLocal,
    () => ({ drawW: leftDrawW, drawH: leftDrawH })
  );
  bindTrayPointer(
    rightCanvas,
    rightScroll,
    () => rightIds,
    () => rightLocal,
    () => ({ drawW: rightDrawW, drawH: rightDrawH })
  );

  const ro = new ResizeObserver(() => {
    if (enabled) redraw();
  });
  ro.observe(leftScroll);
  ro.observe(rightScroll);

  return {
    setVisible,
    isEnabled,
    load,
    clear,
    redraw,
    removePiece,
    getTrayPieceIds,
    getState,
    syncMetrics,
    destroy() {
      ro.disconnect();
    },
  };
}
