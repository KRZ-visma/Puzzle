/**
 * Pure view/camera helpers for the playfield.
 * World → screen: screen = world * scale + pan
 */

import { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./config.js";

/** @typedef {{ scale: number, panX: number, panY: number }} Camera */

/**
 * @param {Partial<Camera>} [partial]
 * @returns {Camera}
 */
export function createCamera(partial = {}) {
  return {
    scale: Number.isFinite(partial.scale) ? partial.scale : ZOOM_DEFAULT,
    panX: Number.isFinite(partial.panX) ? partial.panX : 0,
    panY: Number.isFinite(partial.panY) ? partial.panY : 0,
  };
}

/** @param {number} scale */
export function clampScale(scale) {
  if (!Number.isFinite(scale)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));
}

/**
 * @param {Camera} camera
 * @param {number} screenX
 * @param {number} screenY
 */
export function screenToWorld(camera, screenX, screenY) {
  const scale = camera.scale || ZOOM_DEFAULT;
  return {
    x: (screenX - camera.panX) / scale,
    y: (screenY - camera.panY) / scale,
  };
}

/**
 * @param {Camera} camera
 * @param {number} worldX
 * @param {number} worldY
 */
export function worldToScreen(camera, worldX, worldY) {
  return {
    x: worldX * camera.scale + camera.panX,
    y: worldY * camera.scale + camera.panY,
  };
}

/**
 * Zoom so the given screen point stays fixed over the same world point.
 * @param {Camera} camera
 * @param {number} nextScale
 * @param {number} screenX
 * @param {number} screenY
 * @returns {Camera}
 */
export function zoomAt(camera, nextScale, screenX, screenY) {
  const scale = clampScale(nextScale);
  const world = screenToWorld(camera, screenX, screenY);
  return {
    scale,
    panX: screenX - world.x * scale,
    panY: screenY - world.y * scale,
  };
}

/**
 * Step zoom in/out about a screen point.
 * @param {Camera} camera
 * @param {1|-1} direction
 * @param {number} screenX
 * @param {number} screenY
 */
export function zoomByStep(camera, direction, screenX, screenY) {
  const factor = direction >= 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
  return zoomAt(camera, camera.scale * factor, screenX, screenY);
}

/**
 * @param {Camera} camera
 * @param {number} dx
 * @param {number} dy
 * @returns {Camera}
 */
export function panBy(camera, dx, dy) {
  return {
    scale: camera.scale,
    panX: camera.panX + dx,
    panY: camera.panY + dy,
  };
}

/**
 * Keep the world content rectangle reachable in the viewport.
 * World content is treated as [0, worldW] × [0, worldH] (CSS world units).
 *
 * @param {Camera} camera
 * @param {{ cssW: number, cssH: number, worldW?: number, worldH?: number, margin?: number }} bounds
 * @returns {Camera}
 */
export function clampCamera(camera, { cssW, cssH, worldW = cssW, worldH = cssH, margin = 48 }) {
  const scale = clampScale(camera.scale);
  const contentW = worldW * scale;
  const contentH = worldH * scale;

  let minPanX;
  let maxPanX;
  if (contentW + margin * 2 <= cssW) {
    // Content smaller than viewport: keep it mostly on-screen.
    minPanX = margin - contentW;
    maxPanX = cssW - margin;
  } else {
    minPanX = cssW - contentW - margin;
    maxPanX = margin;
  }

  let minPanY;
  let maxPanY;
  if (contentH + margin * 2 <= cssH) {
    minPanY = margin - contentH;
    maxPanY = cssH - margin;
  } else {
    minPanY = cssH - contentH - margin;
    maxPanY = margin;
  }

  return {
    scale,
    panX: Math.min(maxPanX, Math.max(minPanX, camera.panX)),
    panY: Math.min(maxPanY, Math.max(minPanY, camera.panY)),
  };
}

/** Identity camera (scale 1, no pan). */
export function resetCamera() {
  return createCamera();
}
