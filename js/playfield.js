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
  LAYOUT_BASKETS,
  LAYOUT_SCATTER,
  LAYOUT_SIDE_TRAYS,
  layoutRegions,
  normalizeLayoutMode,
  placePieces,
} from "./layout.js";
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

export function createPlayfield(canvas, { onDragEnd, onSelectionChange, onCameraChange }) {
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
    // Side trays need wide left/right gutters; baskets need corner room.
    let marginX = cssW * 0.08;
    let marginY = cssH * 0.1;
    if (layoutMode === LAYOUT_SIDE_TRAYS) {
      marginY = cssH * 0.06;
      // Grow side gutters until each tray can hold half the pieces in a
      // non-overlapping grid (capped so the board stays usable).
      marginX = cssW * 0.18;
      const total = cols * rows;
      const perTray = Math.max(1, Math.ceil(total / 2));
      for (let i = 0; i < 5; i += 1) {
        const maxBoardW = cssW - marginX * 2;
        const maxBoardH = cssH - marginY * 2;
        const aspect = cols / rows;
        let boardW = maxBoardW;
        let boardH = boardW / aspect;
        if (boardH > maxBoardH) {
          boardH = maxBoardH;
          boardW = boardH * aspect;
        }
        const pw = boardW / cols;
        const ph = boardH / rows;
        const gap = 2;
        const rowsFit = Math.max(1, Math.floor((cssH - gap * 2 + gap) / (ph + gap)));
        const colsNeeded = Math.max(1, Math.ceil(perTray / rowsFit));
        const trayNeed = colsNeeded * (pw + gap) - gap + 12;
        const next = Math.min(cssW * 0.34, Math.max(marginX, trayNeed));
        if (Math.abs(next - marginX) < 0.5) {
          marginX = next;
          break;
        }
        marginX = next;
      }
    } else if (layoutMode === LAYOUT_BASKETS) {
      marginX = cssW * 0.14;
      marginY = cssH * 0.16;
    }
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
    const regions = layoutRegions(layoutMode, layoutMetrics());
    if (!regions.length) return;

    ctx.save();
    for (const region of regions) {
      const radius =
        layoutMode === LAYOUT_BASKETS
          ? Math.min(region.w, region.h) * 0.28
          : Math.min(18, Math.min(region.w, region.h) * 0.12);
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
      ctx.fillStyle =
        layoutMode === LAYOUT_BASKETS ? "rgba(212, 160, 74, 0.22)" : "rgba(31, 58, 46, 0.07)";
      ctx.fill();
      ctx.strokeStyle =
        layoutMode === LAYOUT_BASKETS ? "rgba(176, 120, 40, 0.45)" : "rgba(31, 58, 46, 0.22)";
      ctx.lineWidth = 1.5 / camera.scale;
      if (layoutMode === LAYOUT_SIDE_TRAYS) {
        ctx.setLineDash([5 / camera.scale, 4 / camera.scale]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
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
    drawBoardGhost();

    const dragGid =
      dragging && groups ? groups.groupOf[dragging.pieceId] : null;

    // Board-locked pieces stay under free pieces so hit-testing can skip them.
    for (const id of zOrder) {
      if (isLocked(id)) drawPiece(id, false);
    }
    for (const id of zOrder) {
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

  function onPointerDown(event) {
    if (!positions.length) return;
    const pt = eventPoint(event);
    activePointers.set(event.pointerId, pt);
    canvas.setPointerCapture(event.pointerId);

    if (activePointers.size >= 2) {
      beginPinch();
      onSelectionChange?.(null);
      return;
    }

    const world = screenToWorld(camera, pt.x, pt.y);
    const pieceId = hitTest(world.x, world.y);
    if (pieceId === null) {
      dragging = null;
      panning = {
        pointerId: event.pointerId,
        lastX: pt.x,
        lastY: pt.y,
      };
      onSelectionChange?.(null);
      return;
    }
    panning = null;
    bringGroupToFront(pieceId);
    dragging = {
      pieceId,
      pointerId: event.pointerId,
      lastX: world.x,
      lastY: world.y,
    };
    onSelectionChange?.(pieceId);
    scheduleDraw();
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

    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const world = screenToWorld(camera, pt.x, pt.y);
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
    const pieceId = wasDragging ? dragging.pieceId : null;

    activePointers.delete(event.pointerId);
    if (panning && event.pointerId === panning.pointerId) {
      panning = null;
    }

    if (activePointers.size < 2) {
      endPinch();
    }
    if (activePointers.size === 1 && !dragging && !panning) {
      // Remaining finger becomes a pan gesture (common after pinch).
      const [pointerId, pt] = activePointers.entries().next().value;
      panning = { pointerId, lastX: pt.x, lastY: pt.y };
    }

    if (wasDragging) {
      dragging = null;
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
      panning = null;
      pinch = null;
      activePointers.clear();
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
      for (const id of members) {
        positions[id].x += dx;
        positions[id].y += dy;
      }
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
