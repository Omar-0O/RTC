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

    // Check for updates periodically (every 30 min)
    setInterval(() => {
      registration.update();
    }, 30 * 60 * 1000);

    // Listen for new SW waiting to activate
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available — notify the app
          console.log('[SW] New version available');
          updateCallbacks.forEach(cb => cb('new'));
        }
      });
    });

    // Listen for version broadcast from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[SW] Updated to version:', event.data.version);
        updateCallbacks.forEach(cb => cb(event.data.version));
      }
    });

    return registration;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}
