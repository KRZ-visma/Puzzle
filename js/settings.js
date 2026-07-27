import { DEFAULT_DIFFICULTY, DIFFICULTIES } from "./config.js";
import { DEFAULT_IMAGE_ID, normalizeImageId } from "./gallery.js";
import { loadJson, saveJson } from "./storage.js";

/** localStorage key for the player's preferred piece count. */
const DIFFICULTY_PREF = "difficulty";

/** localStorage key for the player's preferred gallery image. */
const IMAGE_PREF = "imageId";

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
