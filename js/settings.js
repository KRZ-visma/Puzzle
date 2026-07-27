import { DEFAULT_DIFFICULTY, DIFFICULTIES } from "./config.js";
import { DEFAULT_IMAGE_ID, normalizeImageId } from "./gallery.js";
import { DEFAULT_LAYOUT_MODE, normalizeLayoutMode } from "./layout.js";
import { loadJson, saveJson } from "./storage.js";

/** localStorage key for the player's preferred piece count. */
const DIFFICULTY_PREF = "difficulty";

/** localStorage key for hard-mode menu toggles. */
const HARD_OPTIONS_PREF = "hardOptions";

/** localStorage key for the player's preferred gallery image. */
const IMAGE_PREF = "imageId";

/** localStorage key for initial piece layout (scatter / trays). */
const LAYOUT_PREF = "layoutMode";

/** Default hard-mode toggles (all off = easier). */
export const DEFAULT_HARD_OPTIONS = Object.freeze({
  hideBackgroundImage: false,
  preciseSnap: false,
  disablePreview: false,
});

/**
 * Coerce a raw value to a known difficulty, or fall back to the default.
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeDifficulty(value) {
  const n = Number(value);
  if (Number.isFinite(n) && DIFFICULTIES[n]) return n;
  return DEFAULT_DIFFICULTY;
}

/** Read the last chosen piece count (survives open/close). */
export function loadDifficultyPreference() {
  return normalizeDifficulty(loadJson(DIFFICULTY_PREF, DEFAULT_DIFFICULTY));
}

/**
 * Persist the piece-count preference.
 * @param {unknown} value
 * @returns {number} normalized difficulty that was saved
 */
export function saveDifficultyPreference(value) {
  const n = normalizeDifficulty(value);
  saveJson(DIFFICULTY_PREF, n);
  return n;
}

/**
 * Coerce a partial/raw object into a full hard-options record.
 * @param {unknown} value
 * @returns {{ hideBackgroundImage: boolean, preciseSnap: boolean, disablePreview: boolean }}
 */
export function normalizeHardOptions(value) {
  const src = value && typeof value === "object" ? value : {};
  return {
    hideBackgroundImage: Boolean(src.hideBackgroundImage),
    preciseSnap: Boolean(src.preciseSnap),
    disablePreview: Boolean(src.disablePreview),
  };
}

/** Read hard-mode toggles (survives open/close). */
export function loadHardOptions() {
  return normalizeHardOptions(loadJson(HARD_OPTIONS_PREF, DEFAULT_HARD_OPTIONS));
}

/**
 * Persist hard-mode toggles.
 * @param {unknown} value
 * @returns {{ hideBackgroundImage: boolean, preciseSnap: boolean, disablePreview: boolean }}
 */
export function saveHardOptions(value) {
  const next = normalizeHardOptions(value);
  saveJson(HARD_OPTIONS_PREF, next);
  return next;
}

/** Read the last chosen gallery image id. */
export function loadImagePreference() {
  return normalizeImageId(loadJson(IMAGE_PREF, DEFAULT_IMAGE_ID));
}

/**
 * Persist the gallery image preference.
 * @param {unknown} value
 * @returns {string} normalized image id that was saved
 */
export function saveImagePreference(value) {
  const id = normalizeImageId(value);
  saveJson(IMAGE_PREF, id);
  return id;
}

/** Read the last chosen piece layout mode. */
export function loadLayoutPreference() {
  return normalizeLayoutMode(loadJson(LAYOUT_PREF, DEFAULT_LAYOUT_MODE));
}

/**
 * Persist the piece layout preference.
 * @param {unknown} value
 * @returns {string} normalized layout mode that was saved
 */
export function saveLayoutPreference(value) {
  const mode = normalizeLayoutMode(value);
  saveJson(LAYOUT_PREF, mode);
  return mode;
}

export { normalizeLayoutMode, DEFAULT_LAYOUT_MODE };
