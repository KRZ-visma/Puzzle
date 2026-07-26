import { DEFAULT_DIFFICULTY, DIFFICULTIES } from "./config.js";
import { loadJson, saveJson } from "./storage.js";

/** localStorage key for the player's preferred piece count. */
const DIFFICULTY_PREF = "difficulty";

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
