/**
 * Puzzle image gallery — CC0 / public-domain assets only.
 * Add new entries here (and under assets/gallery/) when expanding the set.
 */

/** @typedef {{ id: string, title: string, src: string, license: string, credit: string, sourceUrl: string }} GalleryImage */

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
  },
  {
    id: "village",
    title: "Alpine village",
    src: "assets/gallery/village.jpg",
    license: "CC0",
    credit: "Olivier Miche",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Adelboden_village_landscape_(Unsplash).jpg",
  },
  {
    id: "waterfall",
    title: "Wooded waterfall",
    src: "assets/gallery/waterfall.jpg",
    license: "CC0",
    credit: "Nathan Anderson",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Waterfall_in_a_wooded_ravine_(Unsplash).jpg",
  },
  {
    id: "forest",
    title: "Forest skyline",
    src: "assets/gallery/forest.jpg",
    license: "CC0",
    credit: "Fineas Anton",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Forest_skyline_and_clouds_(Unsplash).jpg",
  },
  {
    id: "blossoms",
    title: "Cherry blossoms",
    src: "assets/gallery/blossoms.jpg",
    license: "CC0",
    credit: "Karolien Brughmans",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Pink_cherry_blossom_on_blue_(Unsplash).jpg",
  },
  {
    id: "lavender",
    title: "Lavender field",
    src: "assets/gallery/lavender.jpg",
    license: "CC0",
    credit: "Dorné Marting",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Sweet_lavender_in_a_green_field_(Unsplash).jpg",
  },
  {
    id: "sunflowers",
    title: "Sunny sunflowers",
    src: "assets/gallery/sunflowers.jpg",
    license: "CC0",
    credit: "Papaver rhoeas",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Sunflowers_on_a_sunny_day_(Unsplash).jpg",
  },
  {
    id: "sunny",
    title: "Happy sun",
    src: "assets/gallery/sunny.jpg",
    license: "CC0",
    credit: "Dawn Hudson",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Happy-sun-cartoon.jpg",
  },
  {
    id: "meadows",
    title: "Pastel meadows",
    src: "assets/gallery/meadows.jpg",
    license: "CC0",
    credit: "Puzzle project",
    sourceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  {
    id: "balloons",
    title: "Balloon sky",
    src: "assets/gallery/balloons.jpg",
    license: "CC0",
    credit: "Puzzle project",
    sourceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
];

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
