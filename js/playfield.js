/**
 * Canvas playfield: render interlocking pieces and handle pointer drag.
 * Path2D caches + clipped drawImage (scales to 1000+ pieces without per-piece canvases).
 */

import { SNAP_FRACTION } from "./config.js";
import {
  applyPathCommands,
  buildPiecePathCommands,
  createEdgeMap,
  piecePadding,
  solvedPosition,
} from "./geometry.js";

function createPath2D(commands) {
  const path = new Path2D();
  applyPathCommands(path, commands);
  return path;
}

export function createPlayfield(canvas, { onDragEnd, onSelectionChange }) {
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
  let needsDraw = true;
  let raf = 0;

  function threshold() {
    return Math.min(pieceW, pieceH) * SNAP_FRACTION;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, rect.width);
    cssH = Math.max(1, rect.height);
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scheduleDraw();
  }

  function boardSize() {
    const marginX = cssW * 0.08;
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

  function buildPaths() {
    const total = cols * rows;
    paths = new Array(total);
    for (let id = 0; id < total; id += 1) {
      paths[id] = createPath2D(buildPiecePathCommands(id, edgeMap, pieceW, pieceH));
    }
  }

  function scatterPositions(rng = Math.random) {
    const total = cols * rows;
    positions = new Array(total);
    const boardW = cols * pieceW;
    const boardH = rows * pieceH;
    for (let id = 0; id < total; id += 1) {
      const side = Math.floor(rng() * 4);
      let x;
      let y;
      if (side === 0) {
        x = rng() * Math.max(1, cssW - pieceW);
        y = rng() * Math.max(8, originY - pieceH);
      } else if (side === 1) {
        x = rng() * Math.max(1, cssW - pieceW);
        y = originY + boardH + rng() * Math.max(8, cssH - (originY + boardH) - pieceH);
      } else if (side === 2) {
        x = rng() * Math.max(8, originX - pieceW);
        y = originY + rng() * boardH;
      } else {
        x = originX + boardW + rng() * Math.max(8, cssW - (originX + boardW) - pieceW);
        y = originY + rng() * boardH;
      }
      positions[id] = {
        x: Math.min(Math.max(0, x), Math.max(0, cssW - pieceW)),
        y: Math.min(Math.max(0, y), Math.max(0, cssH - pieceH)),
      };
    }
  }

  function drawBoardGhost() {
    const boardW = cols * pieceW;
    const boardH = rows * pieceH;
    ctx.save();
    ctx.strokeStyle = "rgba(31, 58, 46, 0.28)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(originX, originY, boardW, boardH);
    ctx.setLineDash([]);
    if (image) {
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
    ctx.lineWidth = Math.max(0.6, Math.min(pieceW, pieceH) * 0.03);
    ctx.stroke(path);
    ctx.restore();
  }

  function draw() {
    needsDraw = false;
    ctx.clearRect(0, 0, cssW, cssH);
    if (!cols) return;

    drawBoardGhost();

    const dragGid =
      dragging && groups ? groups.groupOf[dragging.pieceId] : null;

    for (const id of zOrder) {
      const elevate = dragGid !== null && groups.groupOf[id] === dragGid;
      drawPiece(id, elevate);
    }
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

  function hitTest(x, y) {
    for (let i = zOrder.length - 1; i >= 0; i -= 1) {
      const id = zOrder[i];
      const pos = positions[id];
      const localX = x - pos.x;
      const localY = y - pos.y;
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

  function onPointerDown(event) {
    if (!positions.length) return;
    canvas.setPointerCapture(event.pointerId);
    const pt = eventPoint(event);
    const pieceId = hitTest(pt.x, pt.y);
    if (pieceId === null) {
      dragging = null;
      onSelectionChange?.(null);
      return;
    }
    bringGroupToFront(pieceId);
    dragging = {
      pieceId,
      pointerId: event.pointerId,
      lastX: pt.x,
      lastY: pt.y,
    };
    onSelectionChange?.(pieceId);
    scheduleDraw();
  }

  function onPointerMove(event) {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const pt = eventPoint(event);
    const dx = pt.x - dragging.lastX;
    const dy = pt.y - dragging.lastY;
    dragging.lastX = pt.x;
    dragging.lastY = pt.y;
    const members = groups.members.get(groups.groupOf[dragging.pieceId]);
    for (const id of members) {
      positions[id].x += dx;
      positions[id].y += dy;
    }
    scheduleDraw();
  }

  function onPointerUp(event) {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const pieceId = dragging.pieceId;
    dragging = null;
    onDragEnd?.(pieceId);
    scheduleDraw();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

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

    reset({ cols: c, rows: r, groups: g, seed = 1, scatterRng, positions: savedPositions }) {
      cols = c;
      rows = r;
      groups = g;
      edgeMap = createEdgeMap(cols, rows, seed);
      resize();
      boardSize();
      buildPaths();
      const total = cols * rows;
      if (Array.isArray(savedPositions) && savedPositions.length === total) {
        positions = savedPositions.map((p) => ({ x: p.x, y: p.y }));
      } else {
        scatterPositions(scatterRng || Math.random);
      }
      zOrder = Array.from({ length: total }, (_, i) => i);
      dragging = null;
      scheduleDraw();
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

    destroy() {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
