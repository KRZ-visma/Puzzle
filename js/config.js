/** Shared game constants. Edit here when adding difficulties. */
import { DEFAULT_IMAGE_ID, getGalleryImage } from "./gallery.js";

/** Default puzzle image path (first gallery entry). Prefer gallery helpers for selection. */
export const IMAGE_SRC = getGalleryImage(DEFAULT_IMAGE_ID).src;

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

/** Tab / blank size as a fraction of the smaller piece side. */
export const TAB_FRACTION = 0.22;

/** Prefix for all localStorage keys used by this app. */
export const STORAGE_PREFIX = "puzzle:";

/** Playfield camera zoom (view-only; piece world units stay unchanged). */
export const ZOOM_DEFAULT = 1;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;
/** Multiplicative step for +/- controls and keyboard shortcuts. */
export const ZOOM_STEP = 1.25;
