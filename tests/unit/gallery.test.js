import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_IMAGE_ID,
  GALLERY,
  getGalleryImage,
  normalizeImageId,
} from "../../js/gallery.js";

const COMMONS_SOURCE = /^https:\/\/commons\.wikimedia\.org\//;
const CC0_SOURCE = /^https:\/\/creativecommons\.org\/publicdomain\/zero\//;

test("gallery entries use CC0-licensed local assets", () => {
  assert.ok(GALLERY.length >= 2);
  for (const entry of GALLERY) {
    assert.equal(typeof entry.id, "string");
    assert.ok(entry.id.length > 0);
    assert.match(entry.src, /^assets\/gallery\/.+\.jpg$/);
    assert.equal(entry.license, "CC0");
    assert.ok(
      COMMONS_SOURCE.test(entry.sourceUrl) || CC0_SOURCE.test(entry.sourceUrl),
      `unexpected sourceUrl for ${entry.id}: ${entry.sourceUrl}`
    );
  }
});

test("normalizeImageId accepts known ids and falls back otherwise", () => {
  assert.equal(normalizeImageId("waterfall"), "waterfall");
  assert.equal(normalizeImageId("blossoms"), "blossoms");
  assert.equal(normalizeImageId("meadows"), "meadows");
  assert.equal(normalizeImageId("nope"), DEFAULT_IMAGE_ID);
  assert.equal(normalizeImageId(null), DEFAULT_IMAGE_ID);
});

test("getGalleryImage returns the matching entry or default", () => {
  const waterfall = getGalleryImage("waterfall");
  assert.equal(waterfall.id, "waterfall");
  assert.equal(waterfall.src, "assets/gallery/waterfall.jpg");

  const balloons = getGalleryImage("balloons");
  assert.equal(balloons.id, "balloons");
  assert.equal(balloons.src, "assets/gallery/balloons.jpg");
  assert.match(balloons.sourceUrl, CC0_SOURCE);

  const fallback = getGalleryImage("missing");
  assert.equal(fallback.id, DEFAULT_IMAGE_ID);
});

test("gallery ids are unique", () => {
  const ids = GALLERY.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("gallery includes lighter and cartoon-style puzzles", () => {
  const ids = new Set(GALLERY.map((entry) => entry.id));
  for (const id of ["blossoms", "lavender", "sunflowers", "sunny", "meadows", "balloons"]) {
    assert.ok(ids.has(id), `missing gallery id: ${id}`);
  }
});
