import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

export function useProfileHeartbeat(userId?: string): void {
  useEffect(() => {
    if (!userId) return;

    let isActive = true;
    let requestInFlight = false;
    let lastSuccessfulWriteAt = 0;

    const updateLastSeen = async () => {
      if (!isActive || requestInFlight || document.visibilityState !== 'visible') return;

      requestInFlight = true;
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', userId);

        if (!error) lastSuccessfulWriteAt = Date.now();
      } catch {
        // Presence heartbeat is best-effort and must not affect app flow.
      } finally {
        requestInFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      const heartbeatIsStale = Date.now() - lastSuccessfulWriteAt >= HEARTBEAT_INTERVAL_MS;
      if (document.visibilityState === 'visible' && heartbeatIsStale) {
        void updateLastSeen();
      }
    };

    void updateLastSeen();
    const intervalId = window.setInterval(() => void updateLastSeen(), HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);
}
