import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_IMAGE_ID,
  GALLERY,
  getGalleryImage,
  isLowVisibilityImage,
  LOW_VISIBILITY_LUMINANCE,
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
    assert.equal(typeof entry.approxLuminance, "number");
    assert.ok(entry.approxLuminance >= 0 && entry.approxLuminance <= 255);
  }
});

test("gallery is curated brightest-first with a bright default", () => {
  assert.equal(DEFAULT_IMAGE_ID, "woods");
  assert.equal(GALLERY[0].id, DEFAULT_IMAGE_ID);
  for (let i = 1; i < GALLERY.length; i += 1) {
    assert.ok(
      GALLERY[i - 1].approxLuminance >= GALLERY[i].approxLuminance,
      `${GALLERY[i - 1].id} should be at least as bright as ${GALLERY[i].id}`
    );
  }
  assert.ok(getGalleryImage(DEFAULT_IMAGE_ID).approxLuminance >= LOW_VISIBILITY_LUMINANCE);
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

test("isLowVisibilityImage flags dim gallery art", () => {
  assert.equal(isLowVisibilityImage("woods"), false);
  assert.equal(isLowVisibilityImage("forest"), false);
  assert.equal(isLowVisibilityImage("village"), true);
  assert.equal(isLowVisibilityImage("waterfall"), true);
  assert.equal(isLowVisibilityImage(getGalleryImage("waterfall")), true);
  assert.equal(isLowVisibilityImage("missing"), false);
});

test("gallery ids are unique", () => {
  const ids = GALLERY.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});
