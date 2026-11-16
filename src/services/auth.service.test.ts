import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

import { ensureMonthlyAutoDismissal, isDeactivatedUser, isKioskAccount } from './auth.service';

describe('auth.service deactivation & kiosk helpers', () => {
  describe('isKioskAccount', () => {
    it('identifies the dedicated kiosk emails case-insensitively', () => {
      expect(isKioskAccount('Medaniparticipations@rtc.org')).toBe(true);
      expect(isKioskAccount('medaniparticipations@rtc.org')).toBe(true);
      expect(isKioskAccount('  KIOSK@rtc.internal  ')).toBe(true);
    });

    it('returns false for regular volunteer emails or empty values', () => {
      expect(isKioskAccount('volunteer@example.com')).toBe(false);
      expect(isKioskAccount('')).toBe(false);
      expect(isKioskAccount(null)).toBe(false);
      expect(isKioskAccount(undefined)).toBe(false);
    });
  });

  describe('isDeactivatedUser', () => {
    it('returns true when profile.is_active is explicitly false for a regular user', () => {
      expect(
        isDeactivatedUser({ is_active: false, email: 'volunteer@example.com' })
      ).toBe(true);
    });

    it('returns false when profile.is_active is true or undefined', () => {
      expect(
        isDeactivatedUser({ is_active: true, email: 'volunteer@example.com' })
      ).toBe(false);
      expect(
        isDeactivatedUser({ is_active: undefined, email: 'volunteer@example.com' })
      ).toBe(false);
      expect(isDeactivatedUser(null)).toBe(false);
    });

    it('exempts the kiosk service account even though its profile has is_active = false', () => {
      expect(
        isDeactivatedUser({ is_active: false, email: 'Medaniparticipations@rtc.org' })
      ).toBe(false);
      expect(
        isDeactivatedUser({ is_active: false, email: null }, 'kiosk@rtc.internal')
      ).toBe(false);
    });
  });

  describe('ensureMonthlyAutoDismissal', () => {
    beforeEach(() => {
      sessionStorage.clear();
      mockRpc.mockReset();
      mockRpc.mockResolvedValue({ error: null });
    });

    it('does not call RPC when profileData is missing or lacks auto_dismissal_enabled column', async () => {
      await ensureMonthlyAutoDismissal(null);
      await ensureMonthlyAutoDismissal(undefined);
      await ensureMonthlyAutoDismissal({ id: 'u1', is_active: true });

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('calls run_monthly_auto_dismissal once when auto_dismissal_enabled column exists and sets sessionStorage flag', async () => {
      const currentYm = new Date().toISOString().slice(0, 7);
      const storageKey = `rtc_auto_dismissal_${currentYm}`;

      await ensureMonthlyAutoDismissal({ id: 'u1', auto_dismissal_enabled: true });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('run_monthly_auto_dismissal', { p_force: false });
      expect(sessionStorage.getItem(storageKey)).toBe('1');
    });

    it('does not call RPC a second time in the same session when sessionStorage flag is already set', async () => {
      const currentYm = new Date().toISOString().slice(0, 7);
      const storageKey = `rtc_auto_dismissal_${currentYm}`;
      sessionStorage.setItem(storageKey, '1');

      await ensureMonthlyAutoDismissal({ id: 'u1', auto_dismissal_enabled: true });

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('swallows RPC errors gracefully without throwing', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Network failure'));

      await expect(
        ensureMonthlyAutoDismissal({ id: 'u1', auto_dismissal_enabled: true })
      ).resolves.toBeUndefined();
    });
  });
});
