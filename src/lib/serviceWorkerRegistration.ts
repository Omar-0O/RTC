import { supabase } from '@/integrations/supabase/client';

/**
 * Service Worker registration — silent auto-update.
 *
 * When a new SW version is detected, it automatically activates
 * and reloads the page without any user-facing popup, after waiting
 * for any in-flight Supabase token refresh to commit to localStorage.
 */

const AUTH_SETTLE_TIMEOUT_MS = 3000;

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

    // When the new SW takes over, wait for any in-flight token rotation to settle
    // before reloading so a one-time refresh_token is never aborted mid-flight.
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

      void Promise.race([
        supabase.auth.getSession().catch(() => null),
        new Promise((resolve) => setTimeout(resolve, AUTH_SETTLE_TIMEOUT_MS)),
      ]).finally(() => {
        window.location.reload();
      });
    });

    return registration;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}
