import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampCamera,
  clampScale,
  createCamera,
  panBy,
  resetCamera,
  screenToWorld,
  worldToScreen,
  zoomAt,
  zoomByStep,
} from "../../js/camera.js";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../../js/config.js";

test("createCamera defaults to identity view", () => {
  assert.deepEqual(createCamera(), { scale: 1, panX: 0, panY: 0 });
});

test("screenToWorld and worldToScreen round-trip", () => {
  const camera = { scale: 2, panX: 40, panY: -10 };
  const screen = worldToScreen(camera, 30, 50);
  assert.deepEqual(screen, { x: 100, y: 90 });
  assert.deepEqual(screenToWorld(camera, screen.x, screen.y), { x: 30, y: 50 });
});

test("zoomAt keeps the focal screen point over the same world point", () => {
  const camera = { scale: 1, panX: 0, panY: 0 };
  const next = zoomAt(camera, 2, 100, 80);
  const before = screenToWorld(camera, 100, 80);
  const after = screenToWorld(next, 100, 80);
  assert.equal(next.scale, 2);
  assert.deepEqual(after, before);
});

test("zoomByStep multiplies scale and clamps", () => {
  let camera = resetCamera();
  camera = zoomByStep(camera, 1, 0, 0);
  assert.equal(camera.scale, ZOOM_STEP);
  camera = { scale: ZOOM_MAX, panX: 0, panY: 0 };
  camera = zoomByStep(camera, 1, 0, 0);
  assert.equal(camera.scale, ZOOM_MAX);
  assert.equal(clampScale(0.01), ZOOM_MIN);
});

test("panBy shifts pan without changing scale", () => {
  const camera = panBy({ scale: 1.5, panX: 10, panY: 20 }, 5, -8);
  assert.deepEqual(camera, { scale: 1.5, panX: 15, panY: 12 });
});

test("clampCamera keeps content reachable in the viewport", () => {
  const zoomed = clampCamera(
    { scale: 3, panX: 5000, panY: -5000 },
    { cssW: 400, cssH: 300, worldW: 400, worldH: 300, margin: 40 }
  );
  assert.equal(zoomed.scale, 3);
  assert.ok(zoomed.panX <= 40);
  assert.ok(zoomed.panX >= 400 - 400 * 3 - 40);
  assert.ok(zoomed.panY <= 40);
  assert.ok(zoomed.panY >= 300 - 300 * 3 - 40);
});
