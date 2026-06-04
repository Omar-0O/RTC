/**
 * NetworkStatus — floating UI indicator for offline/sync state.
 *
 * Renders:
 *  • "Offline" banner when network is down
 *  • "Syncing..." when queue is being flushed
 *  • "X changes pending" when items are queued
 *  • "All synced ✓" flash after successful sync
 *
 * Update popups have been removed — the SW now auto-updates silently.
 */
import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Check, AlertTriangle, X } from 'lucide-react';
import { useOfflineStatus, useSyncStatus, useManualSync } from '@/hooks/useOffline';

export function NetworkStatus() {
  const { isOnline, isOffline } = useOfflineStatus();
  const { state, pendingCount } = useSyncStatus();
  const { sync, isSyncing } = useManualSync();
  const [showSynced, setShowSynced] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 1000);
    return () => clearTimeout(timer);
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
