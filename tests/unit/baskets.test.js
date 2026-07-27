import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_BASKETS,
  addBasket,
  createBasketState,
  hitTestBasket,
  nestlePiecesInBasket,
  putPiecesInBasket,
  removeBasket,
  removePiecesFromBaskets,
  translateBasket,
} from "../../js/baskets.js";

const layout = { pieceW: 40, pieceH: 30, cssW: 800, cssH: 500 };

test("createBasketState starts empty", () => {
  const state = createBasketState();
  assert.deepEqual(state.baskets, []);
  assert.equal(state.selectedId, null);
  assert.equal(state.nextId, 1);
});

test("addBasket creates movable empty baskets up to the max", () => {
  const state = createBasketState();
  const first = addBasket(state, layout);
  assert.ok(first);
  assert.equal(first.pieceIds.length, 0);
  assert.equal(state.baskets.length, 1);
  assert.equal(state.selectedId, first.id);

  for (let i = 1; i < MAX_BASKETS; i += 1) {
    assert.ok(addBasket(state, layout));
  }
  assert.equal(state.baskets.length, MAX_BASKETS);
  assert.equal(addBasket(state, layout), null);
});

test("removeBasket drops the selected basket and keeps pieces elsewhere", () => {
  const state = createBasketState();
  const a = addBasket(state, layout);
  const b = addBasket(state, layout);
  putPiecesInBasket(state, a.id, [1, 2]);
  const removed = removeBasket(state, a.id);
  assert.equal(removed?.id, a.id);
  assert.deepEqual(removed?.pieceIds, [1, 2]);
  assert.equal(state.baskets.length, 1);
  assert.equal(state.baskets[0].id, b.id);
  assert.equal(state.selectedId, b.id);
});

test("removeBasket with none selected removes the last basket", () => {
  const state = createBasketState();
  addBasket(state, layout);
  addBasket(state, layout);
  state.selectedId = null;
  const removed = removeBasket(state);
  assert.equal(state.baskets.length, 1);
  assert.ok(removed);
});

test("hitTestBasket finds the topmost basket under a point", () => {
  const state = createBasketState();
  const a = addBasket(state, layout);
  a.x = 10;
  a.y = 10;
  a.w = 100;
  a.h = 80;
  const b = addBasket(state, layout);
  b.x = 40;
  b.y = 30;
  b.w = 100;
  b.h = 80;
  assert.equal(hitTestBasket(state.baskets, 50, 50)?.id, b.id);
  assert.equal(hitTestBasket(state.baskets, 15, 15)?.id, a.id);
  assert.equal(hitTestBasket(state.baskets, 700, 400), null);
});

test("translateBasket moves the basket and contained pieces together", () => {
  const state = createBasketState();
  const basket = addBasket(state, layout);
  basket.x = 20;
  basket.y = 30;
  basket.w = 120;
  basket.h = 100;
  putPiecesInBasket(state, basket.id, [0, 1]);
  const positions = [
    { x: 25, y: 35 },
    { x: 45, y: 40 },
    { x: 200, y: 200 },
  ];
  translateBasket(basket, positions, 15, -10, layout.cssW, layout.cssH);
  assert.equal(basket.x, 35);
  assert.equal(basket.y, 20);
  assert.deepEqual(positions[0], { x: 40, y: 25 });
  assert.deepEqual(positions[1], { x: 60, y: 30 });
  assert.deepEqual(positions[2], { x: 200, y: 200 });
});

test("putPiecesInBasket moves membership between baskets", () => {
  const state = createBasketState();
  const a = addBasket(state, layout);
  const b = addBasket(state, layout);
  putPiecesInBasket(state, a.id, [3, 4]);
  putPiecesInBasket(state, b.id, [4, 5]);
  assert.deepEqual(a.pieceIds, [3]);
  assert.deepEqual(b.pieceIds, [4, 5]);
});

test("removePiecesFromBaskets clears membership", () => {
  const state = createBasketState();
  const a = addBasket(state, layout);
  putPiecesInBasket(state, a.id, [7, 8, 9]);
  removePiecesFromBaskets(state, [8]);
  assert.deepEqual(a.pieceIds, [7, 9]);
});

test("nestlePiecesInBasket keeps pieces inside the basket bounds", () => {
  const state = createBasketState();
  const basket = addBasket(state, layout);
  basket.x = 100;
  basket.y = 80;
  basket.w = 160;
  basket.h = 120;
  putPiecesInBasket(state, basket.id, [0, 1]);
  const positions = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  nestlePiecesInBasket(basket, positions, 40, 30, () => 0.5);
  for (const p of positions) {
    assert.ok(p.x >= basket.x);
    assert.ok(p.y >= basket.y);
    assert.ok(p.x + 40 <= basket.x + basket.w + 0.5);
    assert.ok(p.y + 30 <= basket.y + basket.h + 0.5);
  }
});
