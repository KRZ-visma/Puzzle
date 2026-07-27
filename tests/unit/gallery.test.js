import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_IMAGE_ID,
  GALLERY,
  getGalleryImage,
  normalizeImageId,
} from "../../js/gallery.js";

test("gallery entries use CC0-licensed local assets", () => {
  assert.ok(GALLERY.length >= 2);
  for (const entry of GALLERY) {
    assert.equal(typeof entry.id, "string");
    assert.ok(entry.id.length > 0);
    assert.match(entry.src, /^assets\/gallery\/.+\.jpg$/);
    assert.equal(entry.license, "CC0");
    assert.match(entry.sourceUrl, /^https:\/\/commons\.wikimedia\.org\//);
  }
});

test("normalizeImageId accepts known ids and falls back otherwise", () => {
  assert.equal(normalizeImageId("waterfall"), "waterfall");
  assert.equal(normalizeImageId("nope"), DEFAULT_IMAGE_ID);
  assert.equal(normalizeImageId(null), DEFAULT_IMAGE_ID);
});

test("getGalleryImage returns the matching entry or default", () => {
  const waterfall = getGalleryImage("waterfall");
  assert.equal(waterfall.id, "waterfall");
  assert.equal(waterfall.src, "assets/gallery/waterfall.jpg");

  const fallback = getGalleryImage("missing");
  assert.equal(fallback.id, DEFAULT_IMAGE_ID);
});

test("gallery ids are unique", () => {
  const ids = GALLERY.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});
