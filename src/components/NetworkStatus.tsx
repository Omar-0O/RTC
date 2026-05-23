/**
 * NetworkStatus — floating UI indicator for offline/sync state.
 *
 * Renders:
 *  • "Offline" banner when network is down
 *  • "Syncing..." when queue is being flushed
 *  • "X changes pending" when items are queued
 *  • "All synced ✓" flash after successful sync
 *  • "Update available" banner when new SW version is detected
 */
import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Check, AlertTriangle, X, Download } from 'lucide-react';
import { useOfflineStatus, useSyncStatus, useManualSync } from '@/hooks/useOffline';
import { onServiceWorkerUpdate } from '@/lib/serviceWorkerRegistration';
import { cn } from '@/lib/utils';

export function NetworkStatus() {
  const { isOnline, isOffline } = useOfflineStatus();
  const { state, pendingCount } = useSyncStatus();
  const { sync, isSyncing } = useManualSync();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showSynced, setShowSynced] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleUpdate = () => {
    // Clear caches
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
    // Reload after a short timeout
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  // Listen for SW updates
  useEffect(() => {
    const unsub = onServiceWorkerUpdate(() => setUpdateAvailable(true));
    return unsub;
  }, []);

  // Flash "All synced" for 3 seconds after successful sync
  useEffect(() => {
    if (state === 'idle' && pendingCount === 0 && !showSynced) return;
    if (state === 'idle' && pendingCount === 0) {
      setShowSynced(true);
      const timer = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [state, pendingCount]);

  // Reset dismissed when going back offline
  useEffect(() => {
    if (isOffline) setDismissed(false);
  }, [isOffline]);

  // ─── Update Available Banner ────────────────────────────────────
  if (updateAvailable) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 w-full max-w-sm sm:max-w-md animate-in fade-in-0 slide-in-from-bottom-6 duration-300">
        <div className="flex items-center justify-between gap-3 bg-card/90 dark:bg-card/85 backdrop-blur-xl border border-border/80 dark:border-white/10 px-4 py-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-sm">
              <Download className="h-4 w-4 animate-bounce" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">تحديث جديد متاح</p>
              <p className="text-xs text-muted-foreground truncate">اضغط لتثبيت أحدث الميزات والتحسينات</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleUpdate}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer"
            >
              تحديث الآن
            </button>
            <button
              onClick={() => setUpdateAvailable(false)}
              className="h-8 w-8 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Offline Banner ─────────────────────────────────────────────
  if (isOffline && !dismissed && isMounted) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3 bg-destructive text-destructive-foreground px-4 py-3 rounded-lg shadow-lg">
          <WifiOff className="h-4 w-4 shrink-0 animate-pulse" />
          <span className="text-sm font-medium">
            أنت أوفلاين — التعديلات هتتحفظ وتتزامن لما النت يرجع
          </span>
          {pendingCount > 0 && (
            <span className="bg-destructive-foreground/20 text-destructive-foreground px-2 py-0.5 rounded-full text-xs">
              {pendingCount} تعديل معلّق
            </span>
          )}
          <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Syncing Indicator ──────────────────────────────────────────
  if (state === 'syncing' || isSyncing) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg shadow-lg">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">جاري المزامنة...</span>
        </div>
      </div>
    );
  }

  // ─── Pending Items Badge ────────────────────────────────────────
  if (pendingCount > 0 && isOnline) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4">
        <button
          onClick={sync}
          className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-lg shadow-lg hover:bg-amber-700 transition-colors"
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">{pendingCount} تعديل معلّق — اضغط للمزامنة</span>
        </button>
      </div>
    );
  }

  // ─── Synced Flash ───────────────────────────────────────────────
  if (showSynced) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">تم المزامنة ✓</span>
        </div>
      </div>
    );
  }

  return null;
}
