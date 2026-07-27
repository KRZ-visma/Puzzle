/**
 * Movable piece baskets (pure helpers).
 * Baskets start empty; players add/remove them and drag pieces in/out.
 */

export const MAX_BASKETS = 8;

/**
 * @typedef {{ id: number, x: number, y: number, w: number, h: number, pieceIds: number[] }} Basket
 */

function clamp(value, min, max) {
  if (max < min) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

/**
 * @returns {{ baskets: Basket[], nextId: number, selectedId: number | null }}
 */
export function createBasketState() {
  return { baskets: [], nextId: 1, selectedId: null };
}

/**
 * Default basket size from current piece metrics.
 * @param {{ pieceW: number, pieceH: number, cssW: number, cssH: number }} layout
 */
export function defaultBasketSize(layout) {
  const w = clamp(layout.pieceW * 3.2, 96, Math.min(220, layout.cssW * 0.28));
  const h = clamp(layout.pieceH * 3.2, 96, Math.min(220, layout.cssH * 0.28));
  return { w, h };
}

/**
 * Place a new basket in a free-ish spot (staggered by existing count).
 * @param {{ baskets: Basket[], nextId: number, selectedId: number | null }} state
 * @param {{ pieceW: number, pieceH: number, cssW: number, cssH: number }} layout
 * @returns {Basket | null}
 */
export function addBasket(state, layout) {
  if (state.baskets.length >= MAX_BASKETS) return null;
  const { w, h } = defaultBasketSize(layout);
  const index = state.baskets.length;
  const col = index % 3;
  const row = Math.floor(index / 3);
  const x = clamp(12 + col * (w * 0.45 + 16), 0, Math.max(0, layout.cssW - w));
  const y = clamp(12 + row * (h * 0.35 + 16), 0, Math.max(0, layout.cssH - h));
  const basket = {
    id: state.nextId,
    x,
    y,
    w,
    h,
    pieceIds: [],
  };
  state.nextId += 1;
  state.baskets.push(basket);
  state.selectedId = basket.id;
  return basket;
}

/**
 * Remove a basket (selected, or last). Contained pieces stay where they are.
 * @param {{ baskets: Basket[], selectedId: number | null }} state
 * @param {number} [basketId]
 * @returns {Basket | null} removed basket
 */
export function removeBasket(state, basketId) {
  if (state.baskets.length === 0) return null;
  let id = basketId;
  if (id == null) id = state.selectedId;
  let index = state.baskets.findIndex((b) => b.id === id);
  if (index < 0) index = state.baskets.length - 1;
  const [removed] = state.baskets.splice(index, 1);
  if (state.selectedId === removed.id) {
    state.selectedId = state.baskets.length ? state.baskets[state.baskets.length - 1].id : null;
  }
  return removed;
}

/** @param {Basket[]} baskets @param {number} x @param {number} y */
export function hitTestBasket(baskets, x, y) {
  for (let i = baskets.length - 1; i >= 0; i -= 1) {
    const b = baskets[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/**
 * Move a basket and every piece currently in it.
 * @param {Basket} basket
 * @param {{ x: number, y: number }[]} positions
 */
export function translateBasket(basket, positions, dx, dy, cssW, cssH) {
  const nextX = clamp(basket.x + dx, 0, Math.max(0, cssW - basket.w));
  const nextY = clamp(basket.y + dy, 0, Math.max(0, cssH - basket.h));
  const adx = nextX - basket.x;
  const ady = nextY - basket.y;
  if (adx === 0 && ady === 0) return { dx: 0, dy: 0 };
  basket.x = nextX;
  basket.y = nextY;
  for (const pieceId of basket.pieceIds) {
    const pos = positions[pieceId];
    if (!pos) continue;
    pos.x += adx;
    pos.y += ady;
  }
  return { dx: adx, dy: ady };
}

/** Remove piece ids from every basket. */
export function removePiecesFromBaskets(state, pieceIds) {
  const drop = new Set(pieceIds);
  for (const basket of state.baskets) {
    basket.pieceIds = basket.pieceIds.filter((id) => !drop.has(id));
  }
}

/**
 * Put pieces into a basket (replacing any prior basket membership).
 * @param {{ baskets: Basket[], selectedId: number | null }} state
 * @param {number} basketId
 * @param {number[]} pieceIds
 */
export function putPiecesInBasket(state, basketId, pieceIds) {
  const basket = state.baskets.find((b) => b.id === basketId);
  if (!basket) return false;
  removePiecesFromBaskets(state, pieceIds);
  const have = new Set(basket.pieceIds);
  for (const id of pieceIds) {
    if (!have.has(id)) {
      basket.pieceIds.push(id);
      have.add(id);
    }
  }
  state.selectedId = basketId;
  return true;
}

/**
 * Nestle basket pieces into a loose pile inside the basket bounds.
 * @param {Basket} basket
 * @param {{ x: number, y: number }[]} positions
 * @param {number} pieceW
 * @param {number} pieceH
 * @param {() => number} [rng]
 */
export function nestlePiecesInBasket(basket, positions, pieceW, pieceH, rng = Math.random) {
  const pad = 8;
  const innerW = Math.max(1, basket.w - pad * 2 - pieceW);
  const innerH = Math.max(1, basket.h - pad * 2 - pieceH);
  for (const id of basket.pieceIds) {
    const pos = positions[id];
    if (!pos) continue;
    pos.x = basket.x + pad + rng() * innerW;
    pos.y = basket.y + pad + rng() * innerH;
  }
}

/**
 * Snapshot for tests / debugging.
 * @param {{ baskets: Basket[], selectedId: number | null }} state
 */
export function snapshotBaskets(state) {
  return {
    selectedId: state.selectedId,
    baskets: state.baskets.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      pieceIds: [...b.pieceIds],
    })),
  };
}
