import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { key, loadJson, remove, saveJson } from "../../js/storage.js";

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

test("key namespaces storage ids", () => {
  assert.equal(key("settings"), "puzzle:settings");
});

test("saveJson and loadJson round-trip objects", () => {
  assert.equal(saveJson("progress", { placed: [1, 2] }), true);
  assert.deepEqual(loadJson("progress"), { placed: [1, 2] });
});

test("loadJson returns fallback for missing or invalid data", () => {
  assert.equal(loadJson("missing", 42), 42);
  memory.set("puzzle:broken", "{not-json");
  assert.equal(loadJson("broken", "fallback"), "fallback");
});

test("remove deletes a namespaced key", () => {
  saveJson("temp", { ok: true });
  remove("temp");
  assert.equal(loadJson("temp"), null);
});
