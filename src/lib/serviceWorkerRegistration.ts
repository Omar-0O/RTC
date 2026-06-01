/**
 * Service Worker registration + update detection.
 *
 * Features:
 *  • Registers SW with proper scope
 *  • Detects new versions and notifies the app
 *  • Listens for SW messages (version broadcasts)
 */

type UpdateCallback = (version: string) => void;

let updateCallbacks: UpdateCallback[] = [];
let updateNotificationSent = false;

// Track if there was an active service worker controlling the page at load time
const hadControllerAtLoad = typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;

export function onServiceWorkerUpdate(callback: UpdateCallback): () => void {
  updateCallbacks.push(callback);

  // If there's already a waiting worker, notify immediately (must have controller at load)
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting && hadControllerAtLoad) {
        callback('new');
      }
    }).catch(() => {});
  }

  return () => {
    updateCallbacks = updateCallbacks.filter(cb => cb !== callback);
  };
}

function notifyUpdateAvailable(version = 'new') {
  if (updateNotificationSent) return;
  updateNotificationSent = true;
  updateCallbacks.forEach(cb => cb(version));
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return null;
  }

  try {
    // Reload the page when the controlling service worker changes
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      // Only reload if we had an active controller at load (avoids reloading on first-ever SW install)
      if (hadControllerAtLoad) {
        refreshing = true;
        window.location.reload();
      }
    });

    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[SW] Registered with scope:', registration.scope);

    // Check if there is already a waiting service worker (update ready) on startup
    if (registration.waiting && hadControllerAtLoad) {
      console.log('[SW] Waiting worker detected on startup');
      // Delay slightly to allow components to register their listeners
      setTimeout(() => {
        notifyUpdateAvailable('new');
      }, 1000);
    }

    registration.update().catch(() => {});

    // Check for updates periodically (every 30 min)
    setInterval(() => {
      registration.update().catch(() => {});
    }, 30 * 60 * 1000);

    // Check for updates on visibility change (when tab is focused)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch((err) => {
          console.error('[SW] Automatic update check failed:', err);
        });
      }
    });

    // Listen for new SW waiting to activate
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        // Only notify if there was a previous controller controlling the app
        if (newWorker.state === 'installed' && hadControllerAtLoad) {
          console.log('[SW] New version available');
          notifyUpdateAvailable('new');
        }
      });
    });

    // Listen for lifecycle broadcasts from SW. Update prompts are driven by a
    // waiting worker; activation itself is handled by controllerchange reload.
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_ACTIVATED') {
        console.log('[SW] Activated version:', event.data.version);
      }
    });

    return registration;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}
