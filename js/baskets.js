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
 * Roomy enough for a pile, and free to sit anywhere pieces can (including over the board).
 * @param {{ pieceW: number, pieceH: number, cssW: number, cssH: number }} layout
 */
export function defaultBasketSize(layout) {
  const targetW = Math.max(layout.pieceW * 5.5, layout.cssW * 0.24);
  const targetH = Math.max(layout.pieceH * 5.5, layout.cssH * 0.24);
  const w = clamp(targetW, 160, Math.min(440, layout.cssW * 0.48));
  const h = clamp(targetH, 160, Math.min(440, layout.cssH * 0.48));
  return { w, h };
}

/**
 * Place a new basket on the playfield (same space as pieces), staggered so
 * multiple baskets do not fully overlap.
 * @param {{ baskets: Basket[], nextId: number, selectedId: number | null }} state
 * @param {{ pieceW: number, pieceH: number, cssW: number, cssH: number, originX?: number, originY?: number }} layout
 * @returns {Basket | null}
 */
export function addBasket(state, layout) {
  if (state.baskets.length >= MAX_BASKETS) return null;
  const { w, h } = defaultBasketSize(layout);
  const index = state.baskets.length;
  const col = index % 3;
  const row = Math.floor(index / 3);
  // Seed near the board / piece area rather than a tiny corner pocket.
  const baseX = Number.isFinite(layout.originX) ? layout.originX * 0.35 : layout.cssW * 0.08;
  const baseY = Number.isFinite(layout.originY) ? layout.originY * 0.35 : layout.cssH * 0.08;
  const x = clamp(baseX + col * (w * 0.28 + 20), 0, Math.max(0, layout.cssW - w));
  const y = clamp(baseY + row * (h * 0.22 + 20), 0, Math.max(0, layout.cssH - h));
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
 * Baskets share the full playfield with pieces (including over the board).
 * @param {Basket} basket
 * @param {{ x: number, y: number }[]} positions
 */
export function translateBasket(basket, positions, dx, dy, cssW, cssH) {
  // Keep a sliver on-canvas so the basket stays grabbable, but allow most of
  // it to travel freely through the same space as puzzle pieces.
  const minVisible = Math.min(48, basket.w * 0.35, basket.h * 0.35);
  const nextX = clamp(basket.x + dx, minVisible - basket.w, Math.max(minVisible - basket.w, cssW - minVisible));
  const nextY = clamp(basket.y + dy, minVisible - basket.h, Math.max(minVisible - basket.h, cssH - minVisible));
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
