/**
 * Interlocking jigsaw edge + path geometry (DOM-free).
 * Paths are command lists so Node unit tests can assert without Canvas.
 */

import {
  TAB_ALONG_FRACTION,
  TAB_CENTER_MAX,
  TAB_CENTER_MIN,
  TAB_FRACTION,
} from "./config.js";
import { createRng, randomSign } from "./rng.js";

/**
 * Build shared edge polarity + connector-center grids.
 * hEdges[row][col] sits between (row, col) and (row, col+1):
 *   +1 → left piece has a tab on its right edge
 *   -1 → left piece has a blank on its right edge
 * vEdges[row][col] sits between (row, col) and (row+1, col):
 *   +1 → top piece has a tab on its bottom edge
 *   -1 → top piece has a blank on its bottom edge
 * hCenters / vCenters store the connector mid-point along that shared
 * edge as a fraction of the side, measured from the low axis end
 * (top for vertical edges, left for horizontal edges).
 */
export function createEdgeMap(cols, rows, seed = 1) {
  const rng = createRng(seed);
  const hEdges = Array.from({ length: rows }, () =>
    Array.from({ length: cols - 1 }, () => randomSign(rng))
  );
  const vEdges = Array.from({ length: rows - 1 }, () =>
    Array.from({ length: cols }, () => randomSign(rng))
  );
  // Draw centers after polarities so existing seeds keep the same tab/blank map.
  const hCenters = Array.from({ length: rows }, () =>
    Array.from({ length: cols - 1 }, () => randomTabCenter(rng))
  );
  const vCenters = Array.from({ length: rows - 1 }, () =>
    Array.from({ length: cols }, () => randomTabCenter(rng))
  );
  return { hEdges, vEdges, hCenters, vCenters, cols, rows, seed };
}

/** Seeded connector center in [TAB_CENTER_MIN, TAB_CENTER_MAX]. */
export function randomTabCenter(rng) {
  return TAB_CENTER_MIN + rng() * (TAB_CENTER_MAX - TAB_CENTER_MIN);
}

function tabSizeFor(pieceW, pieceH) {
  return Math.min(pieceW, pieceH) * TAB_FRACTION;
}

/**
 * Clamp a desired center so the full connector width stays on the edge
 * with a small margin from the corners.
 */
export function clampTabCenter(centerT, alongFraction = TAB_ALONG_FRACTION) {
  const half = alongFraction / 2;
  const margin = 0.06;
  const min = half + margin;
  const max = 1 - half - margin;
  if (min >= max) return 0.5;
  return Math.min(Math.max(centerT, min), max);
}

/**
 * Absolute start / mid / end of a connector along an axis, measured from
 * the low end of that axis (independent of path traversal direction).
 */
export function connectorSpan(axisLength, centerT, alongFraction = TAB_ALONG_FRACTION) {
  const c = clampTabCenter(centerT, alongFraction);
  const half = (axisLength * alongFraction) / 2;
  const mid = axisLength * c;
  return { start: mid - half, mid, end: mid + half };
}

/**
 * Build absolute-space cubic segments for a necked knob, always ordered
 * from the low axis end toward the high end. Callers reverse the segment
 * list when the piece path travels the opposite way so neighbors share
 * identical contact geometry.
 */
function connectorSegments({ along, fixed, outward, polarity, tab, absStart, absMid, absEnd }) {
  const depth = tab * polarity;
  const neck = fixed + outward * depth * 0.22;
  const shoulder = fixed + outward * depth * 0.55;
  const bulge = fixed + outward * depth;
  const tip = fixed + outward * depth * 1.05;
  const w = absEnd - absStart;
  const mid = absMid;

  if (along === "x") {
    return [
      {
        type: "C",
        cp1x: absStart + w * 0.12,
        cp1y: fixed,
        cp2x: absStart + w * 0.18,
        cp2y: neck,
        x: absStart + w * 0.28,
        y: shoulder,
      },
      {
        type: "C",
        cp1x: absStart + w * 0.38,
        cp1y: tip,
        cp2x: mid - w * 0.08,
        cp2y: tip,
        x: mid,
        y: bulge,
      },
      {
        type: "C",
        cp1x: mid + w * 0.08,
        cp1y: tip,
        cp2x: absEnd - w * 0.38,
        cp2y: tip,
        x: absEnd - w * 0.28,
        y: shoulder,
      },
      {
        type: "C",
        cp1x: absEnd - w * 0.18,
        cp1y: neck,
        cp2x: absEnd - w * 0.12,
        cp2y: fixed,
        x: absEnd,
        y: fixed,
      },
    ];
  }

  return [
    {
      type: "C",
      cp1x: fixed,
      cp1y: absStart + w * 0.12,
      cp2x: neck,
      cp2y: absStart + w * 0.18,
      x: shoulder,
      y: absStart + w * 0.28,
    },
    {
      type: "C",
      cp1x: tip,
      cp1y: absStart + w * 0.38,
      cp2x: tip,
      cp2y: mid - w * 0.08,
      x: bulge,
      y: mid,
    },
    {
      type: "C",
      cp1x: tip,
      cp1y: mid + w * 0.08,
      cp2x: tip,
      cp2y: absEnd - w * 0.38,
      x: shoulder,
      y: absEnd - w * 0.28,
    },
    {
      type: "C",
      cp1x: neck,
      cp1y: absEnd - w * 0.18,
      cp2x: fixed,
      cp2y: absEnd - w * 0.12,
      x: fixed,
      y: absEnd,
    },
  ];
}

/** Reverse a cubic so the path can travel high→low with the same curve. */
function reverseCubic(cmd, endX, endY) {
  return {
    type: "C",
    cp1x: cmd.cp2x,
    cp1y: cmd.cp2y,
    cp2x: cmd.cp1x,
    cp2y: cmd.cp1y,
    x: endX,
    y: endY,
  };
}

/**
 * Append a classic necked tab or blank along an axis-aligned edge.
 * `along` is the primary axis ("x" horizontal edge, "y" vertical edge).
 * `outward` is the signed direction the tab protrudes (canvas coords).
 * `polarity` +1 = tab (out), -1 = blank (in). Flat edges skip this helper.
 * `centerT` is the connector mid-point as a fraction of the piece side,
 * measured from the low end of that axis (left / top).
 */
function appendConnector(commands, { along, from, to, fixed, outward, polarity, tab, centerT }) {
  const axisLength = Math.abs(to - from);
  const { start: absStart, mid: absMid, end: absEnd } = connectorSpan(axisLength, centerT);
  const forward = to > from;
  const segments = connectorSegments({
    along,
    fixed,
    outward,
    polarity,
    tab,
    absStart,
    absMid,
    absEnd,
  });

  if (along === "x") {
    if (forward) {
      commands.push({ type: "L", x: absStart, y: fixed });
      for (const seg of segments) commands.push(seg);
      commands.push({ type: "L", x: to, y: fixed });
    } else {
      commands.push({ type: "L", x: absEnd, y: fixed });
      for (let i = segments.length - 1; i >= 0; i -= 1) {
        const seg = segments[i];
        const endX = i === 0 ? absStart : segments[i - 1].x;
        const endY = i === 0 ? fixed : segments[i - 1].y;
        commands.push(reverseCubic(seg, endX, endY));
      }
      commands.push({ type: "L", x: to, y: fixed });
    }
  } else if (forward) {
    commands.push({ type: "L", x: fixed, y: absStart });
    for (const seg of segments) commands.push(seg);
    commands.push({ type: "L", x: fixed, y: to });
  } else {
    commands.push({ type: "L", x: fixed, y: absEnd });
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const seg = segments[i];
      const endX = i === 0 ? fixed : segments[i - 1].x;
      const endY = i === 0 ? absStart : segments[i - 1].y;
      commands.push(reverseCubic(seg, endX, endY));
    }
    commands.push({ type: "L", x: fixed, y: to });
  }
}

/**
 * Local-space path for one piece. Body occupies [0, pieceW] × [0, pieceH];
 * tabs extend outside that rectangle.
 */
export function buildPiecePathCommands(pieceId, edgeMap, pieceW, pieceH) {
  const { cols, rows, hEdges, vEdges, hCenters, vCenters } = edgeMap;
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
      centerT: vCenters[row - 1][col],
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
      centerT: hCenters[row][col],
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
      centerT: vCenters[row][col],
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
      centerT: hCenters[row][col - 1],
    });
  }

  commands.push({ type: "Z" });
  return commands;
}

/** Bounding box padding so tabs are not clipped when rasterizing. */
export function piecePadding(pieceW, pieceH) {
  return tabSizeFor(pieceW, pieceH) * 1.2;
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
