import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DEFAULT_DIFFICULTY } from "../../js/config.js";
import { DEFAULT_IMAGE_ID } from "../../js/gallery.js";
import {
  loadDifficultyPreference,
  loadImagePreference,
  normalizeDifficulty,
  saveDifficultyPreference,
  saveImagePreference,
} from "../../js/settings.js";
import { key } from "../../js/storage.js";

const memory = new Map();

globalThis.localStorage = {
  getItem(name) {
    return memory.has(name) ? memory.get(name) : null;
  },
  setItem(name, value) {
    memory.set(name, String(value));
  },
  removeItem(name) {
    memory.delete(name);
  },
};

afterEach(() => {
  memory.clear();
});

test("normalizeDifficulty accepts known piece counts", () => {
  assert.equal(normalizeDifficulty(12), 12);
  assert.equal(normalizeDifficulty("1000"), 1000);
});

test("normalizeDifficulty falls back for unknown values", () => {
  assert.equal(normalizeDifficulty(7), DEFAULT_DIFFICULTY);
  assert.equal(normalizeDifficulty("nope"), DEFAULT_DIFFICULTY);
  assert.equal(normalizeDifficulty(null), DEFAULT_DIFFICULTY);
});

test("save and load difficulty preference round-trip", () => {
  assert.equal(saveDifficultyPreference(48), 48);
  assert.equal(loadDifficultyPreference(), 48);
  assert.equal(memory.get(key("difficulty")), "48");
});

test("loadDifficultyPreference returns default when unset or invalid", () => {
  assert.equal(loadDifficultyPreference(), DEFAULT_DIFFICULTY);
  memory.set(key("difficulty"), "9999");
  assert.equal(loadDifficultyPreference(), DEFAULT_DIFFICULTY);
});

test("save and load image preference round-trip", () => {
  assert.equal(saveImagePreference("forest"), "forest");
  assert.equal(loadImagePreference(), "forest");
  assert.equal(memory.get(key("imageId")), '"forest"');
});

test("loadImagePreference returns default when unset or invalid", () => {
  assert.equal(loadImagePreference(), DEFAULT_IMAGE_ID);
  memory.set(key("imageId"), '"not-a-real-image"');
  assert.equal(loadImagePreference(), DEFAULT_IMAGE_ID);
});
