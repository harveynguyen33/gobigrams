/* Gobigrams service worker — ROUND PWA (hand-rolled, no vite-plugin-pwa dep).
 *
 * Strategy (per PLAN-release-features.md): PRECACHE-THE-SHELL, then
 * NETWORK-FIRST for everything. The app's correctness comes first — boards
 * live in IndexedDB/localStorage on the client, so the network answer is
 * always preferred; the cache exists so an installed app still boots when
 * offline (the shell + fonts) and already-seen assets survive a flaky link.
 *
 * CACHE NAME: `gobigrams-v<APP_VERSION>-<buildhash>`. APP_VERSION comes from
 * src/settings/version.ts and the short hash from the build — the vite
 * stamping plugin (vite.config.ts) replaces __SW_CACHE_VERSION__ in the BUILT
 * copy, so a version bump OR a content change rotates the cache and activate
 * (below) deletes every cache whose name differs. The source tree carries the
 * placeholder, never a version literal, so it can never drift from
 * settings/version.ts.
 *
 * Registration is gated on https in index.html (LAN http dev never
 * registers — the same philosophy as the Umami hostname gate).
 */
const CACHE_NAME = 'gobigrams-v' + '__SW_CACHE_VERSION__';

/* The shell: both navigation entries, the install manifest, the brand
 * assets, and the shipped variable fonts (the /fonts/*.ttf paths are the
 * ones src/fontManifest.ts declares; the .woff2 twins are what the page's
 * @font-face rules actually fetch first). */
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/brand/favicon-32.png',
  '/brand/apple-touch-icon.png',
  '/brand/icon-maskable-512.png',
  '/fonts/inter-variable.woff2',
  '/fonts/jetbrains-mono-variable.woff2',
  '/fonts/inter-variable.ttf',
  '/fonts/jetbrains-mono-variable.ttf',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

/* Update flow: a new build = a new cache name; every cache whose name
 * differs is deleted, so exactly one generation ever remains. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

/* NETWORK-FIRST, cache fallback — same-origin GET only. Navigations fall
 * back to the cached /index.html (the offline shell); everything else falls
 * back to its own cached copy, or fails honestly. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .catch(() => caches.match('/index.html'))
        .then((res) => res || caches.match('/')),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .catch(() => caches.match(req))
      .then((res) => res || Response.error()),
  );
});
