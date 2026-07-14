/*
 * Second Memory — service worker.
 * Strategy: cache-first for the app shell (precached on install), so the
 * app fully loads and functions offline. Anything to Google APIs (OAuth,
 * Drive) is network-only and never touches the cache — sync must always
 * hit the real network or fail explicitly.
 *
 * Bump CACHE_VERSION whenever any shell file changes; old caches are
 * dropped on activate.
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `second-memory-shell-${CACHE_VERSION}`;

// Paths are relative to sw.js's own scope, so this works whether the app
// is served from a domain root or a GitHub Pages subpath (/repo-name/).
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./db.js",
  "./sync.js",
  "./i18n.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

const GOOGLE_HOSTS = [
  "accounts.google.com",
  "www.googleapis.com",
  "oauth2.googleapis.com",
  "content.googleapis.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith("second-memory-shell-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Network-only for Google APIs — never cache OAuth or Drive traffic.
  if (GOOGLE_HOSTS.includes(url.hostname)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Only handle same-origin GET requests for the app shell.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Opportunistically cache new same-origin shell files (e.g. icons)
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached: fall back to the app shell for navigations.
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          throw new Error("offline and not cached");
        });
    })
  );
});
