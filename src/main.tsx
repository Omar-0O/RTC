import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error handlers for unhandled errors
window.addEventListener('error', (event) => {
  const error = event.error || event.message;
  console.error('Global error handler:', error);

  // Auto-recover from chunk loading errors
  if (
    (typeof error === 'string' && error.includes('Loading chunk')) ||
    (error?.message && (
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    ))
  ) {
    console.log('Chunk loading error detected globally, clearing cache and reloading...');

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

    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  console.error('Unhandled promise rejection:', error);

  // Auto-recover from chunk loading errors
  if (
    error?.message && (
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    )
  ) {
    console.log('Chunk loading error in promise detected, clearing cache and reloading...');

    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }

    setTimeout(() => {
      window.location.reload();
    }, 500);

    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch((err) => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}
