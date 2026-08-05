import { DIFFICULTIES } from "./config.js";
import { normalizeImageId } from "./gallery.js";
import { DEFAULT_LAYOUT_MODE, normalizeLayoutMode } from "./layout.js";
import { loadJson, remove, saveJson } from "./storage.js";

/** localStorage key for in-progress puzzle layout. */
const PROGRESS_KEY = "progress";

/** Schema version for saved progress payloads. */
export const PROGRESS_VERSION = 2;

/**
 * Normalize absolute canvas positions to board-relative piece units so a
 * restore survives viewport / DPI changes.
 * @param {{ x: number, y: number }[]} positions
 * @param {{ originX: number, originY: number, pieceW: number, pieceH: number }} layout
 */
export function serializePositions(positions, layout) {
  const { originX, originY, pieceW, pieceH } = layout;
  return positions.map((p) => ({
    nx: (p.x - originX) / pieceW,
    ny: (p.y - originY) / pieceH,
  }));
}

/**
 * Expand board-relative positions back to canvas coordinates.
 * @param {{ nx: number, ny: number }[]} saved
 * @param {{ originX: number, originY: number, pieceW: number, pieceH: number }} layout
 */
export function deserializePositions(saved, layout) {
  const { originX, originY, pieceW, pieceH } = layout;
  return saved.map((p) => ({
    x: originX + p.nx * pieceW,
    y: originY + p.ny * pieceH,
  }));
}

/**
 * Rebuild group membership maps from a flat groupOf array.
 * @param {number[]} groupOf
 */
export function groupsFromGroupOf(groupOf) {
  const members = new Map();
  const next = new Array(groupOf.length);
  for (let id = 0; id < groupOf.length; id += 1) {
    const gid = groupOf[id];
    next[id] = gid;
    let set = members.get(gid);
    if (!set) {
      set = new Set();
      members.set(gid, set);
    }
    set.add(id);
  }
  return { groupOf: next, members };
}

/**
 * Validate a raw progress payload. Returns a normalized object or null.
 * @param {unknown} raw
 */
export function normalizeProgress(raw) {
  if (!raw || typeof raw !== "object") return null;
  const data = /** @type {Record<string, unknown>} */ (raw);
  const version = Number(data.version);
  // v1 saves predate the gallery; accept them with the default image id.
  if (version !== 1 && version !== PROGRESS_VERSION) return null;

  const difficulty = Number(data.difficulty);
  const chosen = DIFFICULTIES[difficulty];
  if (!chosen) return null;

  const cols = Number(data.cols);
  const rows = Number(data.rows);
  if (cols !== chosen.cols || rows !== chosen.rows) return null;

  const seed = Number(data.seed);
  if (!Number.isFinite(seed)) return null;

  const imageId = normalizeImageId(version === 1 ? undefined : data.imageId);
  // Side-tray saves park pieces off-canvas; that layout was removed.
  if (data.layoutMode === "sideTrays") return null;
  const layoutMode = normalizeLayoutMode(data.layoutMode);

  const total = cols * rows;
  const positions = data.positions;
  if (!Array.isArray(positions) || positions.length !== total) return null;
  for (const p of positions) {
    if (!p || typeof p !== "object") return null;
    const nx = Number(/** @type {{ nx?: unknown }} */ (p).nx);
    const ny = Number(/** @type {{ ny?: unknown }} */ (p).ny);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  }

  const groupOf = data.groupOf;
  if (!Array.isArray(groupOf) || groupOf.length !== total) return null;
  for (const gid of groupOf) {
    const n = Number(gid);
    if (!Number.isInteger(n) || n < 0 || n >= total) return null;
  }

  return {
    version: PROGRESS_VERSION,
    difficulty,
    imageId,
    layoutMode,
    cols,
    rows,
    seed: seed >>> 0 || 1,
    positions: positions.map((p) => ({
      nx: Number(/** @type {{ nx: unknown }} */ (p).nx),
      ny: Number(/** @type {{ ny: unknown }} */ (p).ny),
    })),
    groupOf: groupOf.map((gid) => Number(gid)),
  };
}

/** Read saved puzzle progress, or null when missing/invalid. */
export function loadProgress() {
  return normalizeProgress(loadJson(PROGRESS_KEY, null));
}

/**
 * Persist puzzle progress.
 * @param {ReturnType<typeof normalizeProgress>} progress
 */
export function saveProgress(progress) {
  const normalized = normalizeProgress(progress);
  if (!normalized) return false;
  return saveJson(PROGRESS_KEY, normalized);
}

/** Clear any saved puzzle progress. */
export function clearProgress() {
  remove(PROGRESS_KEY);
}

/**
 * Build a storable progress object from live game fields.
 * @param {{
 *   difficulty: number,
 *   imageId: string,
 *   layoutMode?: string,
 *   cols: number,
 *   rows: number,
 *   seed: number,
 *   positions: { x: number, y: number }[],
 *   groupOf: number[],
 *   layout: { originX: number, originY: number, pieceW: number, pieceH: number, layoutMode?: string },
 * }} state
 */
export function buildProgress(state) {
  return normalizeProgress({
    version: PROGRESS_VERSION,
    difficulty: state.difficulty,
    imageId: state.imageId,
    layoutMode: state.layoutMode ?? state.layout?.layoutMode ?? DEFAULT_LAYOUT_MODE,
    cols: state.cols,
    rows: state.rows,
    seed: state.seed,
    positions: serializePositions(state.positions, state.layout),
    groupOf: state.groupOf,
  });
}
