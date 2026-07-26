/* Service worker — caches the app shell and applies updates when a new version is available. */
/* CACHE_VERSION: 2026.07.26.3 */

const CACHE_VERSION = "2026.07.26.3";
const CACHE_NAME = `puzzle-${CACHE_VERSION}`;

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./version.json",
  "./css/tokens.css",
  "./css/base.css",
  "./css/chrome.css",
  "./css/playfield.css",
  "./css/modals.css",
  "./css/pwa.css",
  "./js/main.js",
  "./js/config.js",
  "./js/utils.js",
  "./js/storage.js",
  "./js/settings.js",
  "./js/rng.js",
  "./js/geometry.js",
  "./js/groups.js",
  "./js/snap.js",
  "./js/dom.js",
  "./js/playfield.js",
  "./js/ui.js",
  "./js/game.js",
  "./js/rules.js",
  "./js/pwa.js",
  "./assets/puzzle.jpg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("puzzle-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always revalidate version metadata and navigations so updates are visible.
  if (url.pathname.endsWith("/version.json") || request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    if (fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await caches.match("./index.html");
      if (fallback) return fallback;
    }
    throw new Error("Offline and no cached response");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) {
        cache.put(request, fresh.clone());
      }
      return fresh;
    })
    .catch(() => null);

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }

  const fresh = await networkPromise;
  if (fresh) return fresh;
  throw new Error("Network error and no cache match");
}
