/**
 * Service Worker registration — silent auto-update.
 *
 * When a new SW version is detected, it automatically activates
 * and reloads the page without any user-facing popup.
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    // Check for updates periodically (every 30 min)
    setInterval(() => {
      registration.update();
    }, 30 * 60 * 1000);

    // Listen for new SW waiting to activate → auto-activate silently
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version ready — tell it to activate immediately (no popup)
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    // When the new SW takes over, reload the page seamlessly
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;

      try {
        const swReloadCount = parseInt(sessionStorage.getItem('sw_reload_count') || '0', 10);
        if (swReloadCount >= 1) {
          console.warn('[SW] Service worker controller changed, but page was already reloaded in this session. Suppressing reload.');
          return;
        }
        sessionStorage.setItem('sw_reload_count', '1');
      } catch (e) {
        console.error('[SW] Storage access error:', e);
      }

      window.location.reload();
    });

    return registration;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}
