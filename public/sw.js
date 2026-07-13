/**
 * RTC Service Worker — Production-grade caching + offline support.
 *
 * Strategy per resource type:
 *  • App Shell (HTML, critical CSS)  → Stale-While-Revalidate
 *  • Static Assets (JS, CSS, fonts)  → Cache First (versioned)
 *  • Images/Media                    → Cache First (long TTL)
 *  • API requests (Supabase)         → Network Only (private user data)
 *  • Auth endpoints                  → Network Only (NEVER cache)
 *  • Edge Functions                  → Network Only (mutations)
 *
 * Cache versioning: bump CACHE_VERSION to invalidate all caches.
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `rtc-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `rtc-dynamic-${CACHE_VERSION}`;

// Maximum entries per cache to prevent unbounded growth
const MAX_DYNAMIC_CACHE_ENTRIES = 200;

// Pre-cache these during install (app shell)
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-192.png',
  '/favicon-512.png',
];

// ─── Install: pre-cache app shell & auto-activate ───────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Listen for explicit skip-waiting messages from the registration code
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Activate: clean old caches & claim clients immediately ─────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Delete ALL caches that don't match current version
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !name.includes(CACHE_VERSION))
            .map((name) => caches.delete(name))
        );
      }),
    ]).then(() => {
      // Silently notify all clients of the update (no popup needed)
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      });
    })
  );
});

// ─── Fetch: strategy-based routing ──────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations go through normally or get queued by offlineQueue.ts)
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (except CDN fonts/images)
  if (url.origin !== self.location.origin && !isTrustedCDN(url)) {
    // EXCEPT: Supabase REST API (non-auth) should be handled
    if (!url.hostname.includes('supabase')) return;
  }

  // ─── NEVER cache auth endpoints ───
  // Auth token requests, session refreshes, user info — always network only.
  // Caching these causes stale session tokens → infinite login loops.
  if (url.pathname.includes('/auth/v1/') || url.pathname.includes('/auth/v2/')) {
    return; // Let the browser handle it normally (network only)
  }

  // Supabase Edge Functions → Network Only (never cache)
  if (url.pathname.includes('/functions/v1/')) return;

  // Supabase REST API (PostgREST/Storage) → Network Only.
  // Responses can contain role/branch-scoped private data and must not be cached.
  if (url.hostname.includes('supabase')) {
    return;
  }

  // Static assets (JS, CSS bundles) → Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Images → Cache First with long TTL
  if (isImage(url.pathname)) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }

  // HTML pages → Stale-While-Revalidate (app shell)
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ─── Caching Strategies ─────────────────────────────────────────────

/** Cache First: serve from cache, only fetch if not cached */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      if (cacheName === DYNAMIC_CACHE) {
        trimCache(cacheName, MAX_DYNAMIC_CACHE_ENTRIES);
      }
    }
    return response;
  } catch (err) {
    // Offline: return offline fallback for navigation
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
      return new Response('Network error and no cache available.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    throw err;
  }
}

/** Stale-While-Revalidate: serve cache immediately, update in background */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((err) => {
      if (cached) return cached;
      return new Response('Network error and no cache available.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    });

  return cached || fetchPromise;
}

// ─── Helpers ────────────────────────────────────────────────────────

function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|eot)(\?.*)?$/.test(pathname);
}

function isImage(pathname) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/.test(pathname);
}

function isTrustedCDN(url) {
  return url.hostname.includes('fonts.googleapis.com') ||
         url.hostname.includes('fonts.gstatic.com') ||
         url.hostname.includes('cdn.jsdelivr.net');
}

/** Trim a cache to at most maxEntries */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    // Delete oldest entries first (FIFO)
    const deleteCount = keys.length - maxEntries;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// ─── Push Notifications (preserved from original) ───────────────────

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'RTC';
  const options = {
    body: data.body || 'New update available!',
    icon: '/favicon-192.png',
    badge: '/favicon-192.png',
    data: data.url || '/',
    requireInteraction: true,
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) client = clientList[i];
        }
        if (event.notification.data) client.navigate(event.notification.data);
        return client.focus();
      }
      return clients.openWindow(event.notification.data || '/');
    })
  );
});
