import { describe, expect, it } from 'vitest';
import { isDeactivatedUser, isKioskAccount } from './auth.service';

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
});
