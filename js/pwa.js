/**
 * PWA registration, version display data, and update checking.
 * Fetches version.json (network) and asks the service worker to update.
 */

const VERSION_URL = new URL("../version.json", import.meta.url);
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

function isE2EMode() {
  try {
    return new URLSearchParams(window.location.search).get("e2e") === "1";
  } catch {
    return false;
  }
}

export async function fetchVersion({ bypassCache = true } = {}) {
  const url = new URL(VERSION_URL.href);
  if (bypassCache) {
    url.searchParams.set("_", String(Date.now()));
  }

  const response = await fetch(url, {
    cache: bypassCache ? "no-store" : "default",
    headers: bypassCache ? { "Cache-Control": "no-cache" } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Failed to load version.json (${response.status})`);
  }

  return response.json();
}

export async function initPwa({
  onVersion,
  onUpdateAvailable,
  checkIntervalMs = CHECK_INTERVAL_MS,
} = {}) {
  let currentVersion = null;

  try {
    const data = await fetchVersion({ bypassCache: true });
    currentVersion = data.version;
    onVersion?.(data);
  } catch (error) {
    console.warn("Could not load app version", error);
    onVersion?.({ version: "unknown", channel: "unknown" });
  }

  let registration = null;
  if ("serviceWorker" in navigator && !isE2EMode()) {
    try {
      registration = await navigator.serviceWorker.register(
        new URL("../sw.js", import.meta.url),
        { scope: new URL("../", import.meta.url).pathname }
      );

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            onUpdateAvailable?.({
              reason: "service-worker",
              version: currentVersion,
            });
          }
        });
      });

      if (registration.waiting && navigator.serviceWorker.controller) {
        onUpdateAvailable?.({
          reason: "service-worker",
          version: currentVersion,
        });
      }
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
  }

  async function checkForUpdates() {
    let remote = null;
    try {
      remote = await fetchVersion({ bypassCache: true });
      if (currentVersion && remote.version && remote.version !== currentVersion) {
        onUpdateAvailable?.({
          reason: "version-json",
          version: remote.version,
          remote,
        });
      }
    } catch (error) {
      console.warn("Version check failed", error);
    }

    if (registration) {
      try {
        await registration.update();
        if (registration.waiting && navigator.serviceWorker.controller) {
          onUpdateAvailable?.({
            reason: "service-worker",
            version: remote?.version || currentVersion,
            remote,
          });
        }
      } catch (error) {
        console.warn("Service worker update check failed", error);
      }
    }

    return remote;
  }

  const intervalId = window.setInterval(() => {
    checkForUpdates();
  }, checkIntervalMs);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkForUpdates();
    }
  });

  window.addEventListener("online", () => {
    checkForUpdates();
  });

  // Initial check shortly after load (lets SW settle).
  window.setTimeout(() => {
    checkForUpdates();
  }, 2500);

  return {
    checkForUpdates,
    applyUpdate,
    dispose() {
      window.clearInterval(intervalId);
    },
  };
}

/** Activate a waiting service worker (if any) and reload the page. */
export function applyUpdate() {
  const reload = () => window.location.reload();

  if (!("serviceWorker" in navigator)) {
    reload();
    return;
  }

  navigator.serviceWorker.getRegistration().then((registration) => {
    if (!registration) {
      reload();
      return;
    }

    const onControllerChange = () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
      reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }

    // Version JSON changed but SW may already be active — hard reload.
    reload();
  });
}
