/** Deterministic PRNG helpers (pure). */

/** Mulberry32 — returns floats in [0, 1). */
export function createRng(seed = 1) {
  let a = seed >>> 0 || 1;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick -1 or 1 with equal probability. */
export function randomSign(rng) {
  return rng() < 0.5 ? -1 : 1;
}
