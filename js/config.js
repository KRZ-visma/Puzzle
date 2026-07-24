/** Shared game constants. Edit here when adding difficulties or images. */
export const IMAGE_SRC = "assets/puzzle.jpg";

export const DIFFICULTIES = {
  12: { cols: 4, rows: 3 },
  24: { cols: 6, rows: 4 },
  48: { cols: 8, rows: 6 },
};

export const DEFAULT_DIFFICULTY = 24;

/** Prefix for all localStorage keys used by this app. */
export const STORAGE_PREFIX = "puzzle:";
