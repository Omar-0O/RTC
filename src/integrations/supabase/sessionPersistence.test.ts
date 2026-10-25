import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createClockSkewCorrectedStorage,
  getStoredSessionSnapshot,
  isRateLimitOrTransientAuthError,
  isRevokedTokenError,
  purgeSessionAndMarkReauth,
} from './client';

const createMemoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
};

describe('Session Persistence & Clock-Skew Storage Adapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createClockSkewCorrectedStorage', () => {
    it('anchors expires_at when a new access_token is stored, but preserves expires_at when the same access_token is re-saved later', () => {
      vi.useFakeTimers();
      const baseTimeMs = new Date('2026-10-25T12:00:00Z').getTime();
      vi.setSystemTime(baseTimeMs);

      const backing = createMemoryStorage();
      const adapter = createClockSkewCorrectedStorage(backing);
      const key = 'sb-test-auth-token';

      // 1. Initial sign-in writes token-1
      adapter.setItem(
        key,
        JSON.stringify({
          access_token: 'token-1',
          refresh_token: 'refresh-1',
          expires_in: 3600,
          expires_at: 999999, // skewed server timestamp
          user: { id: 'user-1' },
        })
      );

      const firstSaved = JSON.parse(backing.getItem(key)!);
      const expectedInitialExpiry = Math.floor(baseTimeMs / 1000) + 3600;
      expect(firstSaved.expires_at).toBe(expectedInitialExpiry);

      // 2. Advance clock by 45 minutes and re-save the SAME access_token (e.g. user metadata update)
      vi.setSystemTime(baseTimeMs + 45 * 60 * 1000);
      adapter.setItem(
        key,
        JSON.stringify({
          ...firstSaved,
          user: { id: 'user-1', email: 'updated@rtc.org' },
        })
      );

      const reSaved = JSON.parse(backing.getItem(key)!);
      // MUST preserve the original expiry so the SDK refreshes on time in 15 minutes
      expect(reSaved.expires_at).toBe(expectedInitialExpiry);

      // 3. Advance clock by another 15 minutes and save a NEW rotated access_token (token-2)
      const refreshTimeMs = baseTimeMs + 60 * 60 * 1000;
      vi.setSystemTime(refreshTimeMs);
      adapter.setItem(
        key,
        JSON.stringify({
          access_token: 'token-2',
          refresh_token: 'refresh-2',
          expires_in: 3600,
          user: { id: 'user-1' },
        })
      );

      const rotatedSaved = JSON.parse(backing.getItem(key)!);
      expect(rotatedSaved.expires_at).toBe(Math.floor(refreshTimeMs / 1000) + 3600);
    });

    it('backfills expires_at on getItem only when expires_at is missing', () => {
      vi.useFakeTimers();
      const baseTimeMs = new Date('2026-10-25T14:00:00Z').getTime();
      vi.setSystemTime(baseTimeMs);

      const backing = createMemoryStorage();
      const adapter = createClockSkewCorrectedStorage(backing);
      const key = 'sb-test-auth-token';

      backing.setItem(
        key,
        JSON.stringify({
          access_token: 'token-legacy',
          refresh_token: 'refresh-legacy',
          expires_in: 3600,
        })
      );

      const readBack = JSON.parse(adapter.getItem(key)!);
      expect(readBack.expires_at).toBe(Math.floor(baseTimeMs / 1000) + 3600);
    });
  });

  describe('Auth Error Classification', () => {
    it('classifies network blips, offline errors, and 429 rate-limits as transient (never revoked)', () => {
      const transientErrors = [
        { status: 429, message: 'Too Many Requests' },
        { status: 503, message: 'Service Unavailable' },
        { name: 'AuthRetryableFetchError', message: 'Failed to fetch' },
        new TypeError('Failed to fetch'),
        new Error('NetworkError when attempting to fetch resource.'),
        new Error('Load failed'),
      ];

      for (const err of transientErrors) {
        expect(isRateLimitOrTransientAuthError(err)).toBe(true);
        expect(isRevokedTokenError(err)).toBe(false);
      }
    });

    it('classifies invalid_grant and revoked refresh token responses as terminal revoked errors', () => {
      const revokedErrors = [
        { status: 400, message: 'Invalid Refresh Token: Refresh Token Not Found' },
        { status: 400, message: 'Invalid Refresh Token: Already Used' },
        new Error('invalid_grant: refresh token revoked'),
      ];

      for (const err of revokedErrors) {
        expect(isRevokedTokenError(err)).toBe(true);
        expect(isRateLimitOrTransientAuthError(err)).toBe(false);
      }
    });
  });

  describe('Multi-Tab Safe Session Purge', () => {
    it('refuses to purge storage if another tab already rotated the refresh_token', () => {
      const storage = createMemoryStorage();
      const key = 'sb-test-auth-token';
      const nowSec = Math.floor(Date.now() / 1000);

      // Tab A already rotated refresh-1 -> refresh-2
      storage.setItem(
        key,
        JSON.stringify({
          access_token: 'token-2',
          refresh_token: 'refresh-2',
          expires_at: nowSec + 3600,
          user: { id: 'user-1' },
        })
      );

      // Tab B's stale refresh with refresh-1 failed; attempt purge with failedRefreshToken: 'refresh-1'
      const didPurge = purgeSessionAndMarkReauth({
        failedRefreshToken: 'refresh-1',
        storage,
        storageKey: key,
      });

      expect(didPurge).toBe(false);
      expect(getStoredSessionSnapshot(storage, key)?.refresh_token).toBe('refresh-2');
    });

    it('purges storage when the stored refresh_token matches the failed refresh_token', () => {
      const storage = createMemoryStorage();
      const key = 'sb-test-auth-token';
      const nowSec = Math.floor(Date.now() / 1000);

      storage.setItem(
        key,
        JSON.stringify({
          access_token: 'token-1',
          refresh_token: 'refresh-dead',
          expires_at: nowSec - 10,
          user: { id: 'user-1' },
        })
      );

      const didPurge = purgeSessionAndMarkReauth({
        failedRefreshToken: 'refresh-dead',
        storage,
        storageKey: key,
      });

      expect(didPurge).toBe(true);
      expect(getStoredSessionSnapshot(storage, key)).toBeNull();
    });
  });
});
