/**
 * RTC Service Worker — Production-grade caching + offline support.
 *
 * Strategy per resource type:
 *  • App Shell (HTML)               → Network First (ensures fresh asset hashes)
 *  • Static Assets (JS, CSS, fonts) → Cache First (versioned by content hash)
 *  • Images/Media                   → Cache First (long TTL)
 *  • API requests (Supabase)        → Network Only (bypass SW entirely)
 *  • Auth API requests              → Network Only (NEVER cache)
 *  • Edge Functions                 → Network Only (mutations)
 *
 * Cache versioning: bump CACHE_VERSION to invalidate all caches.
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `rtc-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `rtc-dynamic-${CACHE_VERSION}`;
const STATIC_CACHE_PREFIX = 'rtc-static-';
const DYNAMIC_CACHE_PREFIX = 'rtc-dynamic-';
const MAX_OLD_STATIC_CACHES = 2;

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
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
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
    (async () => {
      await self.clients.claim();

      const cacheNames = await caches.keys();
      const staticCaches = cacheNames
        .filter((name) => name.startsWith(STATIC_CACHE_PREFIX) && name !== STATIC_CACHE);
      const oldStaticCachesToDelete = staticCaches.slice(0, Math.max(0, staticCaches.length - MAX_OLD_STATIC_CACHES));

      await Promise.all(
        cacheNames
          .filter((name) => (
            name.startsWith(DYNAMIC_CACHE_PREFIX) ||
            oldStaticCachesToDelete.includes(name) ||
            (name.startsWith('rtc-api-') && !name.includes(CACHE_VERSION))
          ))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
      });
    })()
  );
});

// ─── Fetch: strategy-based routing ──────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Supabase/Auth/PostgREST traffic must always bypass the worker. Caching or
  // replaying these responses can corrupt auth state and CORS preflight behavior.
  if (isSupabaseRequest(url)) return;

  // Skip non-GET requests (mutations go through normally or get queued by offlineQueue.ts)
  if (request.method !== 'GET') return;

  // Skip cross-origin requests except trusted static CDNs.
  if (url.origin !== self.location.origin && !isTrustedCDN(url)) return;

  // HTML pages / SPA Navigation requests → Network First
  if (request.mode === 'navigate') {
    event.respondWith(navigateStrategy(request));
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

  // Other GET requests (same-origin static files, assets) → Cache First
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ─── Caching Strategies ─────────────────────────────────────────────

/** Trim cache to prevent excessive storage usage (FIFO) */
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const deletePromises = [];
      for (let i = 0; i < keys.length - maxItems; i++) {
        deletePromises.push(cache.delete(keys[i]));
      }
      await Promise.all(deletePromises);
      console.log(`[SW] Trimmed cache ${cacheName}. Deleted ${deletePromises.length} old entries.`);
    }
  } catch (err) {
    console.error(`[SW] Failed to trim cache ${cacheName}:`, err);
  }
}

/** Canonical Navigate Strategy for SPA shell caching */
async function navigateStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      // Put the HTML response under the canonical '/index.html' key
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch (err) {
    // Offline fallback: serve the canonical '/index.html' from STATIC_CACHE
    const cached = await caches.match('/index.html');
    if (cached) {
      console.log('[SW] Serving index.html from cache (offline navigation)');
      return cached;
    }
    throw err;
  }
}

/** Cache First: serve from cache, only fetch if not cached */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      // Trim dynamic cache in background to control storage size
      if (cacheName === DYNAMIC_CACHE) {
        trimCache(DYNAMIC_CACHE, 50);
      }
    }
    return response;
  } catch (err) {
    throw err;
  }
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

function isSupabaseRequest(url) {
  return url.hostname.includes('supabase.co') ||
         url.hostname.includes('supabase.in') ||
         url.pathname.includes('/auth/v1/') ||
         url.pathname.includes('/rest/v1/') ||
         url.pathname.includes('/functions/v1/') ||
         url.pathname.includes('/storage/v1/');
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
