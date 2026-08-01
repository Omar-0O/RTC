import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─── Self-Healing: Force-clear old SW & caches on major update ──────
const CURRENT_VERSION_FLAG = 'rtc-v5-clean';
try {
  const localVersion = localStorage.getItem('app-cache-version-flag');
  if (localVersion !== CURRENT_VERSION_FLAG) {
    // Immediately persist version flag to prevent re-entrancy
    localStorage.setItem('app-cache-version-flag', CURRENT_VERSION_FLAG);
    
    // Prevent infinite reload loops if storage persistence fails or cached SW serves old main.tsx
    const versionReloadCount = parseInt(sessionStorage.getItem('version_reload_count') || '0', 10);
    if (versionReloadCount < 1) {
      sessionStorage.setItem('version_reload_count', '1');
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
      
      Promise.race([
        Promise.allSettled(cleanupTasks),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]).then(() => {
        window.location.reload();
      });
    }
  }
} catch (e) {
  console.error('[Self-Healing] Error during cache purge:', e);
}

// Helper to detect chunk / module script load errors (including 404 falling back to text/html)
const isChunkOrModuleError = (err: unknown): boolean => {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : ((err as { message?: string })?.message || '');
  const name = ((err as { name?: string })?.name || '');
  return (
    name === 'ChunkLoadError' ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Failed to load module script') ||
    msg.includes('Expected a JavaScript-or-Wasm module script') ||
    msg.includes('text/html') ||
    msg.includes('MIME type')
  );
};

// Auto-recover from chunk loading errors and assets failing to load
const triggerChunkErrorReload = () => {
  // If offline, do NOT trigger reload or clear caches.
  if (!navigator.onLine) {
    console.warn('Chunk loading error occurred while offline. Ignoring reload/cache clear.');
    return;
  }

  // Session-capped reload protection: Max 1 auto-reload per session
  try {
    const reloadCount = parseInt(sessionStorage.getItem('chunk_reload_count') || '0', 10);
    if (reloadCount >= 1) {
      console.warn('[ChunkReload] Auto-reload already attempted once in this session. Halting auto-reload.');
      return;
    }
    sessionStorage.setItem('chunk_reload_count', '1');
  } catch (e) {
    console.error('[ChunkReload] Storage access error:', e);
  }

  const lastReload = localStorage.getItem('last-chunk-error-reload');
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    localStorage.setItem('last-chunk-error-reload', now.toString());

    const cleanupTasks: Promise<unknown>[] = [];

    if ('caches' in window) {
      cleanupTasks.push(
        caches.keys().then(names =>
          Promise.all(names.map(name => caches.delete(name)))
        )
      );
    }

    if ('serviceWorker' in navigator) {
      cleanupTasks.push(
        navigator.serviceWorker.getRegistrations().then(registrations =>
          Promise.all(registrations.map(r => r.unregister()))
        )
      );
    }

    Promise.race([
      Promise.allSettled(cleanupTasks),
      new Promise(resolve => setTimeout(resolve, 1500)),
    ]).then(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now().toString());
      window.location.href = url.toString();
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
    // Catch script/stylesheet resource loading failures (only for same-origin app assets)
    const isSameOriginAsset = src && (src.startsWith('/') || src.includes(window.location.host));
    if (isSameOriginAsset && (src.includes('/assets/') || src.includes('.js') || src.includes('.css'))) {
      console.warn('Asset failed to load:', src);
      triggerChunkErrorReload();
      event.preventDefault();
      return;
    }
  }

  // Silently ignore image load failures (e.g. expired signed URLs, missing avatars)
  if (target && (target as HTMLElement).tagName === 'IMG') {
    return;
  }

  // Catch general runtime JS errors
  const error = event.error || event.message;
  console.error('Global error handler:', error);

  if (isChunkOrModuleError(error)) {
    triggerChunkErrorReload();
    event.preventDefault();
  }
}, true); // Important: true catches element load errors in the capture phase

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  console.error('Unhandled promise rejection:', error);

  if (isChunkOrModuleError(error)) {
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
