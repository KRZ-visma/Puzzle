/**
 * Canvas playfield: render interlocking pieces and handle pointer drag.
 * Path2D caches + clipped drawImage (scales to 1000+ pieces without per-piece canvases).
 * View zoom/pan is a camera transform only — piece world units stay unchanged.
 */

import { PRECISE_SNAP_FRACTION, SNAP_FRACTION } from "./config.js";
import {
  clampCamera,
  clampScale,
  createCamera,
  panBy,
  resetCamera,
  screenToWorld,
  zoomByStep,
} from "./camera.js";
import {
  applyPathCommands,
  buildPiecePathCommands,
  createEdgeMap,
  piecePadding,
  solvedPosition,
} from "./geometry.js";
import {
  LAYOUT_SCATTER,
  LAYOUT_SIDE_TRAYS,
  layoutRegions,
  normalizeLayoutMode,
  placePieces,
} from "./layout.js";
import {
  addBasket as addBasketRecord,
  createBasketState,
  hitTestBasket,
  nestlePiecesInBasket,
  putPiecesInBasket,
  removeBasket as removeBasketRecord,
  removePiecesFromBaskets,
  snapshotBaskets,
  translateBasket,
} from "./baskets.js";
import { isPieceOnSeat } from "./snap.js";

function createPath2D(commands) {
  const path = new Path2D();
  applyPathCommands(path, commands);
  return path;
}

function pointerDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function pointerMidpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function createPlayfield(canvas, { onDragEnd, onSelectionChange, onCameraChange, onBasketsChange }) {
  const ctx = canvas.getContext("2d");
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;

  let image = null;
  let edgeMap = null;
  let cols = 0;
  let rows = 0;
  let pieceW = 0;
  let pieceH = 0;
  let pad = 0;
  let originX = 0;
  let originY = 0;
  let positions = [];
  let groups = null;
  let zOrder = [];
  let paths = [];
  let dragging = null;
  let draggingBasket = null;
  let panning = null;
  /** @type {Map<number, { x: number, y: number }>} */
  const activePointers = new Map();
  let pinch = null;
  let camera = createCamera();
  let needsDraw = true;
  let raf = 0;
  let showBackgroundImage = true;
  let snapFraction = SNAP_FRACTION;
  let layoutMode = LAYOUT_SCATTER;
  let basketState = createBasketState();
  /** @type {Set<number>} */
  let trayPieceIds = new Set();
  /** Horizontal inset reserved so the board sits between overlay side trays. */
  let sideTrayInset = 0;

  function emitBasketsChange() {
    onBasketsChange?.(snapshotBaskets(basketState));
  }

  function isInTray(pieceId) {
    return trayPieceIds.has(pieceId);
  }

  function threshold() {
    return Math.min(pieceW, pieceH) * snapFraction;
  }

  function fitCamera() {
    camera = clampCamera(camera, { cssW, cssH, worldW: cssW, worldH: cssH });
  }

  function setCameraState(next) {
    camera = clampCamera(next, { cssW, cssH, worldW: cssW, worldH: cssH });
    onCameraChange?.({ ...camera });
    scheduleDraw();
    return { ...camera };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, rect.width);
    cssH = Math.max(1, rect.height);
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    fitCamera();
    scheduleDraw();
  }

  function boardSize() {
    // Full-bleed canvas; when overlay trays are open, keep the silhouette between them.
    const marginX = Math.max(cssW * 0.08, sideTrayInset);
    const marginY = cssH * 0.1;
    const maxBoardW = cssW - marginX * 2;
    const maxBoardH = cssH - marginY * 2;
    const aspect = cols / rows;
    let boardW = maxBoardW;
    let boardH = boardW / aspect;
    if (boardH > maxBoardH) {
      boardH = maxBoardH;
      boardW = boardH * aspect;
    }
    pieceW = boardW / cols;
    pieceH = boardH / rows;
    pad = piecePadding(pieceW, pieceH);
    originX = (cssW - boardW) / 2;
    originY = (cssH - boardH) / 2;
  }

  function reflowBoardKeepingSeats() {
    if (!cols || !(pieceW > 0)) {
      boardSize();
      return;
    }
    const prevW = pieceW;
    const prevH = pieceH;
    const prevOriginX = originX;
    const prevOriginY = originY;
    boardSize();
    if (positions.length && prevW > 0) {
      const sx = pieceW / prevW;
      const sy = pieceH / prevH;
      for (const pos of positions) {
        const relX = (pos.x - prevOriginX) * sx;
        const relY = (pos.y - prevOriginY) * sy;
        pos.x = originX + relX;
        pos.y = originY + relY;
      }
      for (const basket of basketState.baskets) {
        const relX = (basket.x - prevOriginX) * sx;
        const relY = (basket.y - prevOriginY) * sy;
        basket.x = originX + relX;
        basket.y = originY + relY;
        basket.w *= sx;
        basket.h *= sy;
      }
      buildPaths();
    }
    scheduleDraw();
  }

  function buildPaths() {
    const total = cols * rows;
    paths = new Array(total);
    for (let id = 0; id < total; id += 1) {
      paths[id] = createPath2D(buildPiecePathCommands(id, edgeMap, pieceW, pieceH));
    }
  }

  function layoutMetrics() {
    return { cols, rows, pieceW, pieceH, originX, originY, cssW, cssH };
  }

  function applyInitialPositions(rng = Math.random) {
    positions = placePieces(layoutMode, layoutMetrics(), rng);
  }

  function drawLayoutChrome() {
    // Side trays are DOM panels now; only scatter has no chrome, and the old
    // canvas gutter chrome is unused.
    if (layoutMode === LAYOUT_SIDE_TRAYS) return;
    const regions = layoutRegions(layoutMode, layoutMetrics());
    if (!regions.length) return;

    ctx.save();
    for (const region of regions) {
      const radius = Math.min(18, Math.min(region.w, region.h) * 0.12);
      const r = Math.max(0, Math.min(radius, region.w / 2, region.h / 2));
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(region.x, region.y, region.w, region.h, r);
      } else {
        const { x, y, w, h } = region;
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }
      ctx.fillStyle = "rgba(31, 58, 46, 0.07)";
      ctx.fill();
      ctx.strokeStyle = "rgba(31, 58, 46, 0.22)";
      ctx.lineWidth = 1.5 / camera.scale;
      ctx.setLineDash([5 / camera.scale, 4 / camera.scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawRoundRectPath(x, y, w, h, radius) {
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBaskets() {
    if (!basketState.baskets.length) return;
    ctx.save();
    for (const basket of basketState.baskets) {
      const selected = basket.id === basketState.selectedId;
      const elevating = draggingBasket && draggingBasket.basketId === basket.id;
      const radius = Math.min(basket.w, basket.h) * 0.18;
      if (elevating) {
        ctx.shadowColor = "rgba(31, 58, 46, 0.28)";
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 5;
      }
      drawRoundRectPath(basket.x, basket.y, basket.w, basket.h, radius);
      ctx.fillStyle = selected ? "rgba(212, 160, 74, 0.28)" : "rgba(212, 160, 74, 0.2)";
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = selected ? "rgba(176, 120, 40, 0.7)" : "rgba(176, 120, 40, 0.45)";
      ctx.lineWidth = (selected ? 2.25 : 1.75) / camera.scale;
      ctx.stroke();

      // Soft inner well
      const inset = Math.min(10, basket.w * 0.08, basket.h * 0.08);
      drawRoundRectPath(
        basket.x + inset,
        basket.y + inset,
        basket.w - inset * 2,
        basket.h - inset * 2,
        radius * 0.7
      );
      ctx.fillStyle = "rgba(255, 250, 240, 0.22)";
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBoardGhost() {
    const boardW = cols * pieceW;
    const boardH = rows * pieceH;
    ctx.save();
    ctx.strokeStyle = "rgba(31, 58, 46, 0.28)";
    ctx.lineWidth = 2 / camera.scale;
    ctx.setLineDash([6 / camera.scale, 6 / camera.scale]);
    ctx.strokeRect(originX, originY, boardW, boardH);
    ctx.setLineDash([]);
    if (image && showBackgroundImage) {
      ctx.globalAlpha = 0.12;
      ctx.drawImage(image, originX, originY, boardW, boardH);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawPiece(id, elevate) {
    const pos = positions[id];
    const path = paths[id];
    if (!path) return;
    const col = id % cols;
    const row = Math.floor(id / cols);

    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (elevate) {
      ctx.shadowColor = "rgba(31, 58, 46, 0.35)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
    }
    ctx.save();
    ctx.clip(path);
    if (image) {
      ctx.drawImage(image, -col * pieceW, -row * pieceH, cols * pieceW, rows * pieceH);
    } else {
      ctx.fillStyle = `hsl(${(id * 47) % 360} 45% 60%)`;
      ctx.fill(path);
    }
    ctx.restore();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(31, 58, 46, 0.45)";
    ctx.lineWidth = Math.max(0.6, Math.min(pieceW, pieceH) * 0.03) / camera.scale;
    ctx.stroke(path);
    ctx.restore();
  }

  function draw() {
    needsDraw = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (!cols) return;

    ctx.save();
    ctx.translate(camera.panX, camera.panY);
    ctx.scale(camera.scale, camera.scale);

    drawLayoutChrome();
    drawBaskets();
    drawBoardGhost();

    const dragGid =
      dragging && groups ? groups.groupOf[dragging.pieceId] : null;

    // Board-locked pieces stay under free pieces so hit-testing can skip them.
    for (const id of zOrder) {
      if (isInTray(id)) continue;
      if (isLocked(id)) drawPiece(id, false);
    }
    for (const id of zOrder) {
      if (isInTray(id)) continue;
      if (isLocked(id)) continue;
      const elevate = dragGid !== null && groups.groupOf[id] === dragGid;
      drawPiece(id, elevate);
    }

    ctx.restore();
  }

  /** Pieces on their solved board seat are locked and cannot be dragged. */
  function isLocked(pieceId) {
    if (!cols || !positions[pieceId]) return false;
    return isPieceOnSeat(positions, pieceId, cols, pieceW, pieceH, originX, originY);
  }

  function scheduleDraw() {
    needsDraw = true;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (needsDraw) draw();
    });
  }

  function eventPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function hitTest(worldX, worldY) {
    for (let i = zOrder.length - 1; i >= 0; i -= 1) {
      const id = zOrder[i];
      if (isInTray(id)) continue;
      // Skip locked pieces: they are not draggable, and skipping avoids
      // expensive isPointInPath checks as more of the board fills in.
      if (isLocked(id)) continue;
      const pos = positions[id];
      const localX = worldX - pos.x;
      const localY = worldY - pos.y;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const hit = ctx.isPointInPath(paths[id], localX, localY);
      ctx.restore();
      if (hit) return id;
    }
    return null;
  }

  function bringGroupToFront(pieceId) {
    if (!groups) return;
    const gid = groups.groupOf[pieceId];
    const members = groups.members.get(gid);
    zOrder = zOrder.filter((id) => !members.has(id));
    for (const id of members) zOrder.push(id);
  }

  function endPinch() {
    pinch = null;
  }

  function beginPinch() {
    if (activePointers.size < 2) return;
    const pts = [...activePointers.values()];
    const a = pts[0];
    const b = pts[1];
    dragging = null;
    draggingBasket = null;
    panning = null;
    const mid = pointerMidpoint(a, b);
    pinch = {
      startDistance: Math.max(1, pointerDistance(a, b)),
      startCamera: { ...camera },
      startMid: mid,
    };
  }

  function updatePinch() {
    if (!pinch || activePointers.size < 2) return;
    const pts = [...activePointers.values()];
    const a = pts[0];
    const b = pts[1];
    const mid = pointerMidpoint(a, b);
    const distance = Math.max(1, pointerDistance(a, b));
    const nextScale = clampScale(pinch.startCamera.scale * (distance / pinch.startDistance));
    const world = screenToWorld(pinch.startCamera, pinch.startMid.x, pinch.startMid.y);
    setCameraState({
      scale: nextScale,
      panX: mid.x - world.x * nextScale,
      panY: mid.y - world.y * nextScale,
    });
  }

  function groupMemberIds(pieceId) {
    if (!groups) return [pieceId];
    return [...groups.members.get(groups.groupOf[pieceId])];
  }

  function tryStoreGroupInBasket(pieceId) {
    if (!groups || isLocked(pieceId)) return false;
    const members = groupMemberIds(pieceId);
    for (const id of members) {
      if (isLocked(id)) return false;
    }
    const pos = positions[pieceId];
    const cx = pos.x + pieceW / 2;
    const cy = pos.y + pieceH / 2;
    const basket = hitTestBasket(basketState.baskets, cx, cy);
    if (!basket) return false;
    putPiecesInBasket(basketState, basket.id, members);
    nestlePiecesInBasket(basket, positions, pieceW, pieceH);
    emitBasketsChange();
    return true;
  }

  function onPointerDown(event) {
    if (!positions.length) return;
    const pt = eventPoint(event);
    activePointers.set(event.pointerId, pt);
    canvas.setPointerCapture(event.pointerId);

    if (activePointers.size >= 2) {
      beginPinch();
      draggingBasket = null;
      onSelectionChange?.(null);
      return;
    }

    const world = screenToWorld(camera, pt.x, pt.y);
    const pieceId = hitTest(world.x, world.y);
    if (pieceId !== null) {
      draggingBasket = null;
      panning = null;
      removePiecesFromBaskets(basketState, groupMemberIds(pieceId));
      emitBasketsChange();
      bringGroupToFront(pieceId);
      dragging = {
        pieceId,
        pointerId: event.pointerId,
        lastX: world.x,
        lastY: world.y,
      };
      onSelectionChange?.(pieceId);
      scheduleDraw();
      return;
    }

    const basket = hitTestBasket(basketState.baskets, world.x, world.y);
    if (basket) {
      dragging = null;
      panning = null;
      basketState.selectedId = basket.id;
      emitBasketsChange();
      draggingBasket = {
        basketId: basket.id,
        pointerId: event.pointerId,
        lastX: world.x,
        lastY: world.y,
      };
      onSelectionChange?.(null);
      scheduleDraw();
      return;
    }

    dragging = null;
    draggingBasket = null;
    panning = {
      pointerId: event.pointerId,
      lastX: pt.x,
      lastY: pt.y,
    };
    onSelectionChange?.(null);
  }

  function onPointerMove(event) {
    if (!activePointers.has(event.pointerId)) return;
    const pt = eventPoint(event);
    activePointers.set(event.pointerId, pt);

    if (pinch || activePointers.size >= 2) {
      if (!pinch && activePointers.size >= 2) beginPinch();
      updatePinch();
      return;
    }

    if (panning && event.pointerId === panning.pointerId) {
      const dx = pt.x - panning.lastX;
      const dy = pt.y - panning.lastY;
      panning.lastX = pt.x;
      panning.lastY = pt.y;
      setCameraState(panBy(camera, dx, dy));
      return;
    }

    const world = screenToWorld(camera, pt.x, pt.y);

    if (draggingBasket && event.pointerId === draggingBasket.pointerId) {
      const basket = basketState.baskets.find((b) => b.id === draggingBasket.basketId);
      if (basket) {
        const dx = world.x - draggingBasket.lastX;
        const dy = world.y - draggingBasket.lastY;
        draggingBasket.lastX = world.x;
        draggingBasket.lastY = world.y;
        translateBasket(basket, positions, dx, dy, cssW, cssH);
        scheduleDraw();
      }
      return;
    }

    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const dx = world.x - dragging.lastX;
    const dy = world.y - dragging.lastY;
    dragging.lastX = world.x;
    dragging.lastY = world.y;
    const members = groups.members.get(groups.groupOf[dragging.pieceId]);
    for (const id of members) {
      positions[id].x += dx;
      positions[id].y += dy;
    }
    scheduleDraw();
  }

  function onPointerUp(event) {
    const wasDragging = dragging && event.pointerId === dragging.pointerId;
    const wasBasket = draggingBasket && event.pointerId === draggingBasket.pointerId;
    const pieceId = wasDragging ? dragging.pieceId : null;

    activePointers.delete(event.pointerId);
    if (panning && event.pointerId === panning.pointerId) {
      panning = null;
    }

    if (activePointers.size < 2) {
      endPinch();
    }
    if (activePointers.size === 1 && !dragging && !draggingBasket && !panning) {
      const [pointerId, pt] = activePointers.entries().next().value;
      panning = { pointerId, lastX: pt.x, lastY: pt.y };
    }

    if (wasBasket) {
      draggingBasket = null;
      emitBasketsChange();
      scheduleDraw();
    }

    if (wasDragging) {
      dragging = null;
      tryStoreGroupInBasket(pieceId);
      onDragEnd?.(pieceId);
      scheduleDraw();
    }
  }

  function onWheel(event) {
    if (!cols) return;
    event.preventDefault();
    const pt = eventPoint(event);
    const direction = event.deltaY < 0 ? 1 : -1;
    setCameraState(zoomByStep(camera, direction, pt.x, pt.y));
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  const ro = new ResizeObserver(() => {
    const prevW = pieceW;
    const prevH = pieceH;
    const prevOriginX = originX;
    const prevOriginY = originY;
    resize();
    if (!cols) return;
    boardSize();
    if (positions.length && prevW > 0) {
      const sx = pieceW / prevW;
      const sy = pieceH / prevH;
      for (const pos of positions) {
        const relX = (pos.x - prevOriginX) * sx;
        const relY = (pos.y - prevOriginY) * sy;
        pos.x = originX + relX;
        pos.y = originY + relY;
      }
      for (const basket of basketState.baskets) {
        const relX = (basket.x - prevOriginX) * sx;
        const relY = (basket.y - prevOriginY) * sy;
        basket.x = originX + relX;
        basket.y = originY + relY;
        basket.w *= sx;
        basket.h *= sy;
      }
      buildPaths();
    }
    scheduleDraw();
  });
  ro.observe(canvas);

  return {
    setImage(img) {
      image = img;
      scheduleDraw();
    },

    /**
     * Apply hard-mode visual/snap options from the menu.
     * @param {{ hideBackgroundImage?: boolean, preciseSnap?: boolean }} options
     */
    setHardOptions(options = {}) {
      if (typeof options.hideBackgroundImage === "boolean") {
        showBackgroundImage = !options.hideBackgroundImage;
      }
      if (typeof options.preciseSnap === "boolean") {
        snapFraction = options.preciseSnap ? PRECISE_SNAP_FRACTION : SNAP_FRACTION;
      }
      scheduleDraw();
    },

    reset({
      cols: c,
      rows: r,
      groups: g,
      seed = 1,
      scatterRng,
      positions: savedPositions,
      layoutMode: nextLayoutMode,
    }) {
      cols = c;
      rows = r;
      groups = g;
      layoutMode = normalizeLayoutMode(nextLayoutMode ?? LAYOUT_SCATTER);
      edgeMap = createEdgeMap(cols, rows, seed);
      dragging = null;
      draggingBasket = null;
      panning = null;
      pinch = null;
      activePointers.clear();
      basketState = createBasketState();
      trayPieceIds = new Set();
      sideTrayInset = 0;
      emitBasketsChange();
      resize();
      boardSize();
      buildPaths();
      const total = cols * rows;
      if (Array.isArray(savedPositions) && savedPositions.length === total) {
        positions = savedPositions.map((p) => ({ x: p.x, y: p.y }));
      } else {
        applyInitialPositions(scatterRng || Math.random);
      }
      zOrder = Array.from({ length: total }, (_, i) => i);
      setCameraState(resetCamera());
    },

    /**
     * Reserve horizontal space for overlay side trays (board stays between them).
     * Canvas itself stays full-bleed so zoom/pan still use the whole screen.
     * @param {number} insetPx
     */
    setSideTrayInset(insetPx) {
      const next = Math.max(0, Number(insetPx) || 0);
      if (Math.abs(next - sideTrayInset) < 0.5) return;
      sideTrayInset = next;
      reflowBoardKeepingSeats();
    },

    setTrayPieceIds(ids) {
      trayPieceIds = new Set(ids || []);
      scheduleDraw();
    },

    getTrayPieceIds() {
      return new Set(trayPieceIds);
    },

    getEdgeMap() {
      return edgeMap;
    },

    /**
     * Move a piece from a side tray onto the board under the pointer and start dragging.
     * @param {number} pieceId
     * @param {number} clientX
     * @param {number} clientY
     * @param {number} pointerId
     */
    takeTrayPieceAndDrag(pieceId, clientX, clientY, pointerId) {
      if (!positions[pieceId] || !groups) return false;
      trayPieceIds.delete(pieceId);
      const rect = canvas.getBoundingClientRect();
      const screen = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      const world = screenToWorld(camera, screen.x, screen.y);
      positions[pieceId].x = world.x - pieceW / 2;
      positions[pieceId].y = world.y - pieceH / 2;
      bringGroupToFront(pieceId);
      draggingBasket = null;
      panning = null;
      activePointers.set(pointerId, screen);
      try {
        canvas.setPointerCapture(pointerId);
      } catch {
        // Ignore capture failures from cross-element handoff.
      }
      dragging = {
        pieceId,
        pointerId,
        lastX: world.x,
        lastY: world.y,
      };
      onSelectionChange?.(pieceId);
      scheduleDraw();
      return true;
    },

    addBasket() {
      if (!cols) return null;
      const basket = addBasketRecord(basketState, layoutMetrics());
      if (!basket) return null;
      emitBasketsChange();
      scheduleDraw();
      return { ...basket, pieceIds: [...basket.pieceIds] };
    },

    removeBasket(basketId) {
      const removed = removeBasketRecord(basketState, basketId);
      if (!removed) return null;
      emitBasketsChange();
      scheduleDraw();
      return { ...removed, pieceIds: [...removed.pieceIds] };
    },

    getBaskets() {
      return snapshotBaskets(basketState);
    },

    /**
     * Test helper: move a basket by (dx, dy), carrying contained pieces.
     * @returns {boolean}
     */
    tryMoveBasket(basketId, dx, dy) {
      const basket = basketState.baskets.find((b) => b.id === basketId);
      if (!basket) return false;
      translateBasket(basket, positions, dx, dy, cssW, cssH);
      basketState.selectedId = basketId;
      emitBasketsChange();
      scheduleDraw();
      return true;
    },

    /**
     * Test helper: put a piece group into a basket.
     * @returns {boolean}
     */
    putPieceInBasket(pieceId, basketId) {
      if (!groups || isLocked(pieceId)) return false;
      const members = groupMemberIds(pieceId);
      const ok = putPiecesInBasket(basketState, basketId, members);
      if (!ok) return false;
      const basket = basketState.baskets.find((b) => b.id === basketId);
      if (basket) nestlePiecesInBasket(basket, positions, pieceW, pieceH, () => 0.5);
      emitBasketsChange();
      scheduleDraw();
      return true;
    },

    getLayout() {
      return {
        cols,
        rows,
        pieceW,
        pieceH,
        originX,
        originY,
        threshold: threshold(),
        cssW,
        cssH,
        pad,
        layoutMode,
      };
    },

    getPositions() {
      return positions;
    },

    setPositions(next) {
      positions = next;
      scheduleDraw();
    },

    redraw() {
      scheduleDraw();
    },

    getCamera() {
      return { ...camera };
    },

    setCamera(next) {
      return setCameraState(createCamera(next));
    },

    resetView() {
      return setCameraState(resetCamera());
    },

    zoomIn(screenX = cssW / 2, screenY = cssH / 2) {
      return setCameraState(zoomByStep(camera, 1, screenX, screenY));
    },

    zoomOut(screenX = cssW / 2, screenY = cssH / 2) {
      return setCameraState(zoomByStep(camera, -1, screenX, screenY));
    },

    /** Test helper: place a piece (and its group) at the solved seat. */
    placePieceSolved(pieceId) {
      const solved = solvedPosition(pieceId, cols, pieceW, pieceH, originX, originY);
      const dx = solved.x - positions[pieceId].x;
      const dy = solved.y - positions[pieceId].y;
      const members = groups.members.get(groups.groupOf[pieceId]);
      removePiecesFromBaskets(basketState, [...members]);
      for (const id of members) {
        positions[id].x += dx;
        positions[id].y += dy;
      }
      emitBasketsChange();
      scheduleDraw();
    },

    /** True when the piece sits on its solved board seat (locked). */
    isPieceLocked(pieceId) {
      return isLocked(pieceId);
    },

    /**
     * Test helper: translate a group by (dx, dy) unless it is board-locked.
     * @returns {boolean} false when the group is locked and was not moved
     */
    tryMoveGroup(pieceId, dx, dy) {
      if (!groups || isLocked(pieceId)) return false;
      const members = groups.members.get(groups.groupOf[pieceId]);
      for (const id of members) {
        if (isLocked(id)) return false;
      }
      for (const id of members) {
        positions[id].x += dx;
        positions[id].y += dy;
      }
      scheduleDraw();
      return true;
    },

    destroy() {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
