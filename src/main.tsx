import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from chunk loading errors and assets failing to load
const triggerChunkErrorReload = () => {
  const lastReload = localStorage.getItem('last-chunk-error-reload');
  const now = Date.now();
  // 10 seconds cooldown to prevent infinite reload loops
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    localStorage.setItem('last-chunk-error-reload', now.toString());
    console.log('Chunk loading error detected. Clearing cache and reloading...');

    // Clear service worker cache
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }

    // Unregister service workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister());
      });
    }

    // Reload after clearing
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
};

// Global error handlers for unhandled errors (capture phase to catch script/stylesheet 404s)
window.addEventListener('error', (event) => {
  const target = event.target as HTMLElement;
  
  // Catch script/stylesheet resource loading failures (which do not bubble)
  if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
    const src = (target as any).src || (target as any).href;
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
