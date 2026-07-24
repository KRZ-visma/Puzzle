import { STORAGE_PREFIX } from "./config.js";

/**
 * Browser persistence helpers. All durable data goes through localStorage.
 * Use namespaced keys via `key()` so features do not collide.
 */

export function key(name) {
  return `${STORAGE_PREFIX}${name}`;
}

export function loadJson(name, fallback = null) {
  try {
    const raw = localStorage.getItem(key(name));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJson(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(name) {
  try {
    localStorage.removeItem(key(name));
  } catch {
    // Ignore quota / private-mode failures.
  }
}
