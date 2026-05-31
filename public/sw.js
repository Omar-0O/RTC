/**
 * RTC Service Worker — Production-grade caching + offline support.
 *
 * Strategy per resource type:
 *  • App Shell (HTML, critical CSS)  → Stale-While-Revalidate
 *  • Static Assets (JS, CSS, fonts)  → Cache First (versioned)
 *  • Images/Media                    → Cache First (long TTL)
 *  • API requests (Supabase)         → Network First, cache fallback for GETs
 *  • Edge Functions                  → Network Only (mutations)
 *
 * Cache versioning: bump CACHE_VERSION to invalidate all caches.
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `rtc-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `rtc-dynamic-${CACHE_VERSION}`;
const API_CACHE = `rtc-api-${CACHE_VERSION}`;

// Pre-cache these during install (app shell)
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
];

// ─── Install: pre-cache app shell ───────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] skipWaiting received, activating new version immediately.');
    self.skipWaiting();
  }
});

// ─── Activate: clean old caches ─────────────────────────────────────

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Delete ALL caches that don't match current version
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !name.includes(CACHE_VERSION))
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
    ])
  );
});

// ─── Fetch: strategy-based routing ──────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations go through normally or get queued by offlineQueue.ts)
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (except CDN fonts/images)
  if (url.origin !== self.location.origin && !isTrustedCDN(url)) return;

  // Supabase Edge Functions → Network Only (never cache)
  if (url.pathname.includes('/functions/v1/')) return;

  // Supabase REST API (PostgREST) → Network First with GET cache fallback
  if (url.hostname.includes('supabase')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
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

/** Network First: try network, fallback to cache */
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Serving API from cache:', request.url);
      return cached;
    }
    // Return an empty JSON response for offline API calls
    return new Response(JSON.stringify({ data: [], error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
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

// ─── Push Notifications (preserved from original) ───────────────────

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'RTC Mohandseen';
  const options = {
    body: data.body || 'New update available!',
    icon: '/favicon.png',
    badge: '/favicon.png',
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

// ─── Version Broadcast ──────────────────────────────────────────────

// Notify clients when a new SW version activates
self.addEventListener('activate', () => {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
    });
  });
});
