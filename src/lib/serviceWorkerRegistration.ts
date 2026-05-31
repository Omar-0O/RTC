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

// Track if there was an active service worker controlling the page at load time
const hadControllerAtLoad = typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;

export function onServiceWorkerUpdate(callback: UpdateCallback): () => void {
  updateCallbacks.push(callback);
  return () => {
    updateCallbacks = updateCallbacks.filter(cb => cb !== callback);
  };
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[SW] Registered with scope:', registration.scope);

    // Check if there is already a waiting service worker (update ready) on startup
    if (registration.waiting && hadControllerAtLoad) {
      console.log('[SW] Waiting worker detected on startup');
      // Delay slightly to allow components to register their listeners
      setTimeout(() => {
        updateCallbacks.forEach(cb => cb('new'));
      }, 1000);
    }

    // Check for updates periodically (every 30 min)
    setInterval(() => {
      registration.update();
    }, 30 * 60 * 1000);

    // Listen for new SW waiting to activate
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        // Only notify if there was a previous controller controlling the app
        if (newWorker.state === 'installed' && hadControllerAtLoad) {
          console.log('[SW] New version available');
          updateCallbacks.forEach(cb => cb('new'));
        }
      });
    });

    // Listen for version broadcast from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        // Only trigger update UI if we had an active controller at load time
        if (hadControllerAtLoad) {
          console.log('[SW] Updated to version:', event.data.version);
          updateCallbacks.forEach(cb => cb(event.data.version));
        }
      }
    });

    return registration;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}
