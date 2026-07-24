import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { pieceBackground, shuffle } from "../../js/utils.js";

test("pieceBackground maps corners for a 4x3 grid", () => {
  assert.deepEqual(pieceBackground(0, 4, 3), {
    backgroundSize: "400% 300%",
    backgroundPosition: "0% 0%",
  });
  assert.deepEqual(pieceBackground(3, 4, 3), {
    backgroundSize: "400% 300%",
    backgroundPosition: "100% 0%",
  });
  assert.deepEqual(pieceBackground(11, 4, 3), {
    backgroundSize: "400% 300%",
    backgroundPosition: "100% 100%",
  });
});

test("shuffle returns a new array with the same members", () => {
  mock.method(Math, "random", () => 0);
  const input = [1, 2, 3, 4];
  const output = shuffle(input);
  assert.notEqual(output, input);
  assert.deepEqual([...output].sort(), [...input].sort());
  assert.deepEqual(input, [1, 2, 3, 4]);
  mock.restoreAll();
});
