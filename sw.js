/*
 * Second Memory — service worker.
 *
 * Strategy: NETWORK-FIRST for the app shell. Whenever the device is
 * online, every request always goes to the network first and the cache
 * is updated with the fresh response; the cache is only used as a
 * fallback when the network fetch fails (i.e. genuinely offline).
 *
 * This used to be cache-first (serve from cache immediately, only fetch
 * on a cache miss), which is wrong for an app that's actively being
 * updated: once a file was cached, it would keep being served forever
 * regardless of new deployments, with no way to notice a newer version
 * existed except a fresh service-worker-script byte-compare that iOS
 * Safari checks only rarely for installed Home-Screen apps. In practice
 * that meant the only reliable way to pick up a new build was deleting
 * and reinstalling the PWA. Network-first fixes this: online, you always
 * get what's actually deployed; offline, you still get the last-seen
 * version from cache, so the "fully usable offline" requirement holds.
 *
 * Bump CACHE_VERSION whenever this file's own logic changes; old caches
 * are dropped on activate. It does NOT need to change for ordinary app
 * content updates (html/css/js) — network-first picks those up on its own.
 */

const CACHE_VERSION = "v5";
const CACHE_NAME = `second-memory-shell-${CACHE_VERSION}`;

// Paths are relative to sw.js's own scope, so this works whether the app
// is served from a domain root or a GitHub Pages subpath (/repo-name/).
// Must list EVERY ES module the app imports — network-first backfills any
// omission after a first online load, but a cold cache (installed, then
// offline before a full load) would white-screen on a missing module.
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./db.js",
  "./sync.js",
  "./i18n.js",
  "./state.js",
  "./ui.js",
  "./merge.js",
  "./markdown.js",
  "./icons.js",
  "./version.js",
  "./view-list.js",
  "./view-grid.js",
  "./view-detail.js",
  "./view-add.js",
  "./view-settings.js",
  "./view-report.js",
  "./fonts/fraunces-600-latin.woff2",
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
  // Deliberately NOT calling event.respondWith() here: Safari/WebKit's
  // service worker implementation has a bug where re-dispatching the
  // original event.request via fetch(event.request) can fail with
  // "TypeError: Load failed" for non-GET requests. Simply not
  // intercepting the request avoids the bug entirely.
  if (GOOGLE_HOSTS.includes(url.hostname)) {
    return;
  }

  // Only handle same-origin GET requests for the app shell.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    // "no-store" here matters as much as network-first itself: without
    // it, this fetch() can still be answered by the *browser's own* HTTP
    // cache for the request, silently handing back stale bytes even
    // though the service worker logic is correctly going "to the
    // network" — no server round-trip happens at all in that case.
    fetch(event.request.url, { cache: "no-store" })
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Offline and not cached: fall back to the app shell for navigations.
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          throw new Error("offline and not cached");
        })
      )
  );
});
