import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─── Self-Healing: Force-clear old SW & caches on major update ──────
const CURRENT_VERSION_FLAG = 'rtc-v4-clean';
try {
  const localVersion = localStorage.getItem('app-cache-version-flag');
  if (localVersion !== CURRENT_VERSION_FLAG) {
    console.warn('[Self-Healing] Version mismatch or first-time v4 loading. Clearing old caches and reloading...');
    
    const cleanupTasks: Promise<unknown>[] = [];
    
    // Clear all caches
    if ('caches' in window) {
      cleanupTasks.push(
        caches.keys().then((names) =>
          Promise.all(names.map((name) => caches.delete(name)))
        )
      );
    }
    
    // Unregister all SWs
    if ('serviceWorker' in navigator) {
      cleanupTasks.push(
        navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((r) => r.unregister()))
        )
      );
    }
    
    localStorage.setItem('app-cache-version-flag', CURRENT_VERSION_FLAG);
    
    Promise.allSettled(cleanupTasks).then(() => {
      window.location.reload();
    });
  }
} catch (e) {
  console.error('[Self-Healing] Error during cache purge:', e);
}

// Auto-recover from chunk loading errors and assets failing to load
const triggerChunkErrorReload = () => {
  // If offline, do NOT trigger reload or clear caches.
  // The fetch failure is likely just due to lack of connectivity.
  if (!navigator.onLine) {
    console.warn('Chunk loading error occurred while offline. Ignoring reload/cache clear to preserve offline functionality.');
    return;
  }

  const lastReload = localStorage.getItem('last-chunk-error-reload');
  const now = Date.now();
  // 10 seconds cooldown to prevent infinite reload loops
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    localStorage.setItem('last-chunk-error-reload', now.toString());
    console.log('Chunk loading error detected. Clearing cache and reloading...');

    // Build an array of cleanup promises to await before reloading
    const cleanupTasks: Promise<unknown>[] = [];

    // Clear service worker caches
    if ('caches' in window) {
      cleanupTasks.push(
        caches.keys().then(names =>
          Promise.all(names.map(name => caches.delete(name)))
        )
      );
    }

    // Unregister service workers
    if ('serviceWorker' in navigator) {
      cleanupTasks.push(
        navigator.serviceWorker.getRegistrations().then(registrations =>
          Promise.all(registrations.map(r => r.unregister()))
        )
      );
    }

    // Wait for ALL cleanup to finish, then reload
    // Max 3 seconds — if cleanup hangs, reload anyway
    Promise.race([
      Promise.allSettled(cleanupTasks),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]).then(() => {
      window.location.reload();
    });
  }
};

// Global error handlers for unhandled errors (capture phase to catch script/stylesheet 404s)
window.addEventListener('error', (event) => {
  const target = event.target as HTMLElement | null;
  
  // Catch script/stylesheet resource loading failures (which do not bubble)
  if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
    const element = target as HTMLScriptElement | HTMLLinkElement;
    const src = element instanceof HTMLScriptElement ? element.src : element.href;
    if (src && (src.includes('/assets/') || src.includes('.js') || src.includes('.css'))) {
      console.warn('Asset failed to load:', src);
      triggerChunkErrorReload();
      event.preventDefault();
      return;
    }
  }

  // Catch general runtime JS errors
  const error = event.error || event.message;
  console.error('Global error handler:', error);

  if (
    (typeof error === 'string' && error.includes('Loading chunk')) ||
    (error?.message && (
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    ))
  ) {
    triggerChunkErrorReload();
    event.preventDefault();
  }
}, true); // Important: true catches element load errors in the capture phase

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  console.error('Unhandled promise rejection:', error);

  if (
    error?.message && (
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    )
  ) {
    triggerChunkErrorReload();
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// ─── Service Worker + Offline Sync ──────────────────────────────────
import { registerServiceWorker } from '@/lib/serviceWorkerRegistration';
import { initSyncManager } from '@/lib/syncManager';

// Register SW with update detection only in production to prevent dev-server cache conflicts
if (import.meta.env.PROD) {
  registerServiceWorker();
}

// Start offline sync engine (flushes queue on connectivity change)
initSyncManager();
