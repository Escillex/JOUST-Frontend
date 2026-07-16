/*
 * Hobby+ service worker.
 *
 * Goal: faster loads by keeping unchanging files on the device, WITHOUT
 * ever serving stale tournament data.
 *
 * Caching rules, from strictest to loosest:
 *
 * 1. API calls (/api/backend/...) — NEVER cached. Brackets, trackers and
 *    leaderboards are live data; a cached copy would show wrong scores.
 * 2. Build files (/_next/static/...) — cache-first. Next.js puts a
 *    content hash in these file names, so a file with the same name can
 *    never have different content. Once downloaded, it is served from
 *    the device forever (until the cache version below changes).
 * 3. Images (uploads, avatars, banners, /public images) — stale-while-
 *    revalidate: serve the cached copy instantly, refresh it in the
 *    background. An avatar that is a few seconds old is acceptable.
 * 4. Pages (navigations) — network-first with a cache fallback, so the
 *    app still opens (with the last seen version) on a bad connection.
 *
 * Bump CACHE_VERSION whenever the caching logic changes: the activate
 * step below deletes every cache that does not match the current name.
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `hobbyplus-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `hobbyplus-images-${CACHE_VERSION}`;
const PAGE_CACHE = `hobbyplus-pages-${CACHE_VERSION}`;

// How many images to keep before old ones are dropped.
const IMAGE_CACHE_LIMIT = 100;

self.addEventListener("install", (event) => {
  // Take over from any older service worker version immediately.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete caches from older versions of this file.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("hobbyplus-") &&
              ![STATIC_CACHE, IMAGE_CACHE, PAGE_CACHE].includes(name),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

// Keep the image cache from growing forever: when it passes the limit,
// remove the oldest entries.
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(
      keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)),
    );
  }
}

// Serve from cache if present; otherwise fetch once and keep it.
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

// Serve the cached copy right away and refresh it in the background.
async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
        if (maxEntries) trimCache(cacheName, maxEntries);
      }
      return response;
    })
    .catch(() => undefined);
  return cached || refresh.then((r) => r || Response.error());
}

// Try the network; fall back to the last cached copy when offline.
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("Offline and not cached");
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only GET requests can be cached; let everything else pass through.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only handle our own origin (the backend proxy path is excluded below).
  if (url.origin !== self.location.origin) return;

  // Rule 1: live data is never cached and never intercepted.
  // Exception: /api/backend/uploads/* are image files (avatars and
  // banners served through the backend proxy), not live data — they
  // fall through to the image rule below.
  if (
    url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/api/backend/uploads/")
  ) {
    return;
  }

  // Rule 2: hashed build files — safe to keep forever.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Rule 3: images — instant from cache, refreshed in the background.
  const isImage =
    url.pathname.startsWith("/uploads/") ||
    url.pathname.startsWith("/api/backend/uploads/") ||
    request.destination === "image";
  if (isImage) {
    event.respondWith(
      staleWhileRevalidate(request, IMAGE_CACHE, IMAGE_CACHE_LIMIT),
    );
    return;
  }

  // Rule 4: page navigations — fresh when online, last copy when not.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE));
    return;
  }

  // Everything else (fonts, small files): cache-first is safe because
  // these are also fingerprinted or rarely change.
  if (request.destination === "font" || request.destination === "style") {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});
