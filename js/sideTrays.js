/**
 * Always-visible left/right side tray panels with native scrollbars.
 * Pieces are drawn on tall tray canvases (not per-piece DOM nodes).
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
  let pieceW = 0;
  let pieceH = 0;
  let cols = 0;
  let rows = 0;
  let image = null;
  let edgeMap = null;
  /** @type {Path2D[]} */
  let paths = [];
  let pad = 0;

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

  /** Measured overlay tray width (px) for board inset + chrome offsets. */
  function getOverlayWidth() {
    if (!enabled) return 0;
    const leftW = leftTray.getBoundingClientRect().width;
    const rightW = rightTray.getBoundingClientRect().width;
    return Math.max(leftW, rightW, 0);
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
      gap: TRAY_GAP,
      paddingX: TRAY_PADDING_X,
    });
  }

  function drawPieceOn(ctx, id, x, y) {
    const path = paths[id];
    if (!path) return;
    const col = id % cols;
    const row = Math.floor(id / cols);
    ctx.save();
    ctx.translate(x, y);
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

  function paintTray(canvas, ctx, scrollEl, ids, local) {
    const cssW = Math.max(1, scrollEl.clientWidth || leftTray.clientWidth || 120);
    const dpr = window.devicePixelRatio || 1;
    const packed = packSide(ids, cssW);
    if (ids === leftIds) leftLocal = packed.localPositions;
    else rightLocal = packed.localPositions;

    const cssH = Math.max(scrollEl.clientHeight || 1, packed.contentH);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Soft tray well
    ctx.fillStyle = "rgba(31, 58, 46, 0.06)";
    ctx.fillRect(0, 0, cssW, cssH);

    for (const id of ids) {
      const pos = packed.localPositions.get(id);
      if (!pos) continue;
      drawPieceOn(ctx, id, pos.x, pos.y);
    }
  }

  function redraw() {
    if (!enabled) return;
    paintTray(leftCanvas, leftCtx, leftScroll, leftIds, leftLocal);
    paintTray(rightCanvas, rightCtx, rightScroll, rightIds, rightLocal);
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

  function eventLocalPoint(canvas, scrollEl, event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function bindTrayPointer(canvas, scrollEl, getIds, getLocal) {
    canvas.addEventListener("pointerdown", (event) => {
      if (!enabled) return;
      const ids = getIds();
      const local = getLocal();
      const pt = eventLocalPoint(canvas, scrollEl, event);
      const pieceId = hitTestTrayPiece(local, ids, pt.x, pt.y, pieceW, pieceH);
      if (pieceId === null) return;
      event.preventDefault();
      event.stopPropagation();
      removePiece(pieceId);
      onTakePiece?.(pieceId, event.clientX, event.clientY, event.pointerId);
    });
  }

  bindTrayPointer(
    leftCanvas,
    leftScroll,
    () => leftIds,
    () => leftLocal
  );
  bindTrayPointer(
    rightCanvas,
    rightScroll,
    () => rightIds,
    () => rightLocal
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
    getOverlayWidth,
    getState,
    syncMetrics,
    destroy() {
      ro.disconnect();
    },
  };
}
