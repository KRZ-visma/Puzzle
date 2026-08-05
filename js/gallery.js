/**
 * Puzzle image gallery — CC0 / public-domain assets only.
 * Add new entries here (and under assets/gallery/) when expanding the set.
 *
 * `approxLuminance` is a 0–255 average from a downsampled grayscale sample
 * (used only for low-visibility warnings — not for runtime image processing).
 * Full brightest-first reordering / default swap vs the lighter #22 set is TBD.
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   src: string,
 *   license: string,
 *   credit: string,
 *   sourceUrl: string,
 *   approxLuminance: number,
 * }} GalleryImage
 */

/** Below this average luminance, show a “dim image” hint in the start menu. */
export const LOW_VISIBILITY_LUMINANCE = 90;

/** @type {GalleryImage[]} */
export const GALLERY = [
  {
    id: "woods",
    title: "Mountain woods",
    src: "assets/gallery/woods.jpg",
    license: "CC0",
    credit: "Chris Abney",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Peaceful_mountain_woods_(Unsplash).jpg",
    approxLuminance: 121,
  },
  {
    id: "forest",
    title: "Forest skyline",
    src: "assets/gallery/forest.jpg",
    license: "CC0",
    credit: "Fineas Anton",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Forest_skyline_and_clouds_(Unsplash).jpg",
    approxLuminance: 109,
  },
  {
    id: "village",
    title: "Alpine village",
    src: "assets/gallery/village.jpg",
    license: "CC0",
    credit: "Olivier Miche",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Adelboden_village_landscape_(Unsplash).jpg",
    approxLuminance: 76,
  },
  {
    id: "waterfall",
    title: "Wooded waterfall",
    src: "assets/gallery/waterfall.jpg",
    license: "CC0",
    credit: "Nathan Anderson",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Waterfall_in_a_wooded_ravine_(Unsplash).jpg",
    approxLuminance: 41,
  },
  {
    id: "blossoms",
    title: "Cherry blossoms",
    src: "assets/gallery/blossoms.jpg",
    license: "CC0",
    credit: "Karolien Brughmans",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Pink_cherry_blossom_on_blue_(Unsplash).jpg",
    approxLuminance: 149,
  },
  {
    id: "lavender",
    title: "Lavender field",
    src: "assets/gallery/lavender.jpg",
    license: "CC0",
    credit: "Dorné Marting",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Sweet_lavender_in_a_green_field_(Unsplash).jpg",
    approxLuminance: 154,
  },
  {
    id: "sunflowers",
    title: "Sunny sunflowers",
    src: "assets/gallery/sunflowers.jpg",
    license: "CC0",
    credit: "Papaver rhoeas",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Sunflowers_on_a_sunny_day_(Unsplash).jpg",
    approxLuminance: 130,
  },
  {
    id: "sunny",
    title: "Happy sun",
    src: "assets/gallery/sunny.jpg",
    license: "CC0",
    credit: "Dawn Hudson",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Happy-sun-cartoon.jpg",
    approxLuminance: 137,
  },
  {
    id: "meadows",
    title: "Pastel meadows",
    src: "assets/gallery/meadows.jpg",
    license: "CC0",
    credit: "Puzzle project",
    sourceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    approxLuminance: 218,
  },
  {
    id: "balloons",
    title: "Balloon sky",
    src: "assets/gallery/balloons.jpg",
    license: "CC0",
    credit: "Puzzle project",
    sourceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    approxLuminance: 211,
  },
];

/** Default stays `woods` until gallery curation vs brighter #22 images is decided. */
export const DEFAULT_IMAGE_ID = "woods";

/**
 * Coerce a raw value to a known gallery id, or fall back to the default.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeImageId(value) {
  if (typeof value === "string" && GALLERY.some((entry) => entry.id === value)) {
    return value;
  }
  return DEFAULT_IMAGE_ID;
}

/**
 * Look up a gallery entry by id (falls back to the default image).
 * @param {unknown} value
 * @returns {GalleryImage}
 */
export function getGalleryImage(value) {
  const id = normalizeImageId(value);
  return GALLERY.find((entry) => entry.id === id) ?? GALLERY[0];
}

/**
 * Whether a gallery image is dim enough that piece interiors may be hard to read.
 * @param {unknown} value gallery id or entry-like object with approxLuminance
 * @returns {boolean}
 */
export function isLowVisibilityImage(value) {
  if (value && typeof value === "object" && "approxLuminance" in value) {
    return Number(value.approxLuminance) < LOW_VISIBILITY_LUMINANCE;
  }
  return getGalleryImage(value).approxLuminance < LOW_VISIBILITY_LUMINANCE;
}
