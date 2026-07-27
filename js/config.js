/** Shared game constants. Edit here when adding difficulties or images. */
export const IMAGE_SRC = "assets/puzzle.jpg";

/**
 * Piece counts for the interlocking canvas engine.
 * Values are approximate targets; exact cols×rows may differ slightly to match aspect.
 */
export const DIFFICULTIES = {
  12: { cols: 4, rows: 3 },
  48: { cols: 8, rows: 6 },
  100: { cols: 12, rows: 8 },
  500: { cols: 25, rows: 20 },
  1000: { cols: 40, rows: 25 },
};

export const DEFAULT_DIFFICULTY = 100;

/** Snap distance as a fraction of the smaller piece side. */
export const SNAP_FRACTION = 0.28;

/** Tighter snap distance when “Precise snap” is enabled. */
export const PRECISE_SNAP_FRACTION = 0.15;

/** Tab / blank size as a fraction of the smaller piece side. */
export const TAB_FRACTION = 0.22;

/** Prefix for all localStorage keys used by this app. */
export const STORAGE_PREFIX = "puzzle:";
