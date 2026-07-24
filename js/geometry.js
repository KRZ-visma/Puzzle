/**
 * Interlocking jigsaw edge + path geometry (DOM-free).
 * Paths are command lists so Node unit tests can assert without Canvas.
 */

import { TAB_FRACTION } from "./config.js";
import { createRng, randomSign } from "./rng.js";

/**
 * Build shared edge polarity grids.
 * hEdges[row][col] sits between (row, col) and (row, col+1):
 *   +1 → left piece has a tab on its right edge
 *   -1 → left piece has a blank on its right edge
 * vEdges[row][col] sits between (row, col) and (row+1, col):
 *   +1 → top piece has a tab on its bottom edge
 *   -1 → top piece has a blank on its bottom edge
 */
export function createEdgeMap(cols, rows, seed = 1) {
  const rng = createRng(seed);
  const hEdges = Array.from({ length: rows }, () =>
    Array.from({ length: cols - 1 }, () => randomSign(rng))
  );
  const vEdges = Array.from({ length: rows - 1 }, () =>
    Array.from({ length: cols }, () => randomSign(rng))
  );
  return { hEdges, vEdges, cols, rows, seed };
}

function tabSizeFor(pieceW, pieceH) {
  return Math.min(pieceW, pieceH) * TAB_FRACTION;
}

/**
 * Append a tab or blank along an axis-aligned edge.
 * `along` is the primary axis ("x" horizontal edge, "y" vertical edge).
 * `outward` is the signed direction the tab protrudes (canvas coords).
 * `polarity` +1 = tab (out), -1 = blank (in). Flat edges skip this helper.
 */
function appendConnector(commands, { along, from, to, fixed, outward, polarity, tab }) {
  const span = to - from;
  const start = from + span * 0.35;
  const end = from + span * 0.65;
  const mid = (start + end) / 2;
  const depth = tab * polarity;
  const bulge = fixed + outward * depth;

  if (along === "x") {
    commands.push({ type: "L", x: start, y: fixed });
    commands.push({
      type: "C",
      cp1x: start + span * 0.05,
      cp1y: fixed,
      cp2x: mid - span * 0.08,
      cp2y: bulge,
      x: mid,
      y: bulge,
    });
    commands.push({
      type: "C",
      cp1x: mid + span * 0.08,
      cp1y: bulge,
      cp2x: end - span * 0.05,
      cp2y: fixed,
      x: end,
      y: fixed,
    });
    commands.push({ type: "L", x: to, y: fixed });
  } else {
    commands.push({ type: "L", x: fixed, y: start });
    commands.push({
      type: "C",
      cp1x: fixed,
      cp1y: start + span * 0.05,
      cp2x: bulge,
      cp2y: mid - span * 0.08,
      x: bulge,
      y: mid,
    });
    commands.push({
      type: "C",
      cp1x: bulge,
      cp1y: mid + span * 0.08,
      cp2x: fixed,
      cp2y: end - span * 0.05,
      x: fixed,
      y: end,
    });
    commands.push({ type: "L", x: fixed, y: to });
  }
}

/**
 * Local-space path for one piece. Body occupies [0, pieceW] × [0, pieceH];
 * tabs extend outside that rectangle.
 */
export function buildPiecePathCommands(pieceId, edgeMap, pieceW, pieceH) {
  const { cols, rows, hEdges, vEdges } = edgeMap;
  const col = pieceId % cols;
  const row = Math.floor(pieceId / cols);
  const tab = tabSizeFor(pieceW, pieceH);
  const commands = [{ type: "M", x: 0, y: 0 }];

  // Top edge: left → right
  if (row === 0) {
    commands.push({ type: "L", x: pieceW, y: 0 });
  } else {
    // Edge shared with piece above: vEdges[row-1][col]
    // +1 means above has tab down → this piece has blank on top (− outward Y)
    const shared = vEdges[row - 1][col];
    const polarity = shared === 1 ? -1 : 1;
    appendConnector(commands, {
      along: "x",
      from: 0,
      to: pieceW,
      fixed: 0,
      outward: -1,
      polarity,
      tab,
    });
  }

  // Right edge: top → bottom
  if (col === cols - 1) {
    commands.push({ type: "L", x: pieceW, y: pieceH });
  } else {
    const shared = hEdges[row][col];
    const polarity = shared; // +1 tab to the right
    appendConnector(commands, {
      along: "y",
      from: 0,
      to: pieceH,
      fixed: pieceW,
      outward: 1,
      polarity,
      tab,
    });
  }

  // Bottom edge: right → left
  if (row === rows - 1) {
    commands.push({ type: "L", x: 0, y: pieceH });
  } else {
    const shared = vEdges[row][col];
    const polarity = shared; // +1 tab downward
    appendConnector(commands, {
      along: "x",
      from: pieceW,
      to: 0,
      fixed: pieceH,
      outward: 1,
      polarity,
      tab,
    });
  }

  // Left edge: bottom → top
  if (col === 0) {
    commands.push({ type: "L", x: 0, y: 0 });
  } else {
    const shared = hEdges[row][col - 1];
    // +1 means left neighbor has tab right → this piece has blank on left
    const polarity = shared === 1 ? -1 : 1;
    appendConnector(commands, {
      along: "y",
      from: pieceH,
      to: 0,
      fixed: 0,
      outward: -1,
      polarity,
      tab,
    });
  }

  commands.push({ type: "Z" });
  return commands;
}

/** Bounding box padding so tabs are not clipped when rasterizing. */
export function piecePadding(pieceW, pieceH) {
  return tabSizeFor(pieceW, pieceH) * 1.15;
}

/** Solved top-left of a piece’s rectangular body on the board. */
export function solvedPosition(pieceId, cols, pieceW, pieceH, originX, originY) {
  const col = pieceId % cols;
  const row = Math.floor(pieceId / cols);
  return {
    x: originX + col * pieceW,
    y: originY + row * pieceH,
  };
}

/** Neighbor piece id in a cardinal direction, or null at the border. */
export function neighborId(pieceId, cols, rows, direction) {
  const col = pieceId % cols;
  const row = Math.floor(pieceId / cols);
  if (direction === "right" && col < cols - 1) return pieceId + 1;
  if (direction === "left" && col > 0) return pieceId - 1;
  if (direction === "down" && row < rows - 1) return pieceId + cols;
  if (direction === "up" && row > 0) return pieceId - cols;
  return null;
}

/** Ideal delta from piece A’s top-left to neighbor B’s top-left when solved. */
export function neighborOffset(direction, pieceW, pieceH) {
  switch (direction) {
    case "right":
      return { x: pieceW, y: 0 };
    case "left":
      return { x: -pieceW, y: 0 };
    case "down":
      return { x: 0, y: pieceH };
    case "up":
      return { x: 0, y: -pieceH };
    default:
      return { x: 0, y: 0 };
  }
}

export function applyPathCommands(path, commands) {
  for (const cmd of commands) {
    if (cmd.type === "M") path.moveTo(cmd.x, cmd.y);
    else if (cmd.type === "L") path.lineTo(cmd.x, cmd.y);
    else if (cmd.type === "C") {
      path.bezierCurveTo(cmd.cp1x, cmd.cp1y, cmd.cp2x, cmd.cp2y, cmd.x, cmd.y);
    } else if (cmd.type === "Z") path.closePath();
  }
  return path;
}
