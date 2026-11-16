import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateSignedUrl, mockStorageFrom } = vi.hoisted(() => {
  const createSignedUrl = vi.fn();
  const storageFrom = vi.fn(() => ({
    createSignedUrl,
  }));
  return {
    mockCreateSignedUrl: createSignedUrl,
    mockStorageFrom: storageFrom,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: mockStorageFrom,
    },
  },
}));

import {
  ACTIVITY_PROOFS_BUCKET,
  ACTIVITY_PROOF_SIGNED_URL_TTL_SECONDS,
  createActivityProofSignedUrl,
  getActivityProofPath,
  isDeadStorageUrl,
} from './activityProofs';

describe('activityProofs utils', () => {
  beforeEach(() => {
    mockStorageFrom.mockClear();
    mockCreateSignedUrl.mockReset();
  });

  describe('isDeadStorageUrl', () => {
    it('returns true for URLs targeting the dead legacy Supabase host', () => {
      expect(
        isDeadStorageUrl(
          'https://dscphfuyhjorrshtyqan.supabase.co/storage/v1/object/public/activity-proofs/user-1/proof.jpg'
        )
      ).toBe(true);
    });

    it('returns false for active host URLs, relative paths, and null/undefined values', () => {
      expect(
        isDeadStorageUrl(
          'https://bsicvziazvgppcvsgbsi.supabase.co/storage/v1/object/public/activity-proofs/user-1/proof.jpg'
        )
      ).toBe(false);
      expect(isDeadStorageUrl('user-1/proof.jpg')).toBe(false);
      expect(isDeadStorageUrl(null)).toBe(false);
      expect(isDeadStorageUrl(undefined)).toBe(false);
    });
  });

  describe('getActivityProofPath', () => {
    it('returns null for dead storage URLs, data/blob URLs, and empty values', () => {
      expect(
        getActivityProofPath(
          'https://dscphfuyhjorrshtyqan.supabase.co/storage/v1/object/public/activity-proofs/user-1/proof.jpg'
        )
      ).toBeNull();
      expect(getActivityProofPath('data:image/png;base64,abc')).toBeNull();
      expect(getActivityProofPath('blob:https://example.com/123')).toBeNull();
      expect(getActivityProofPath('')).toBeNull();
    });

    it('extracts relative path cleanly with or without bucket prefix', () => {
      expect(getActivityProofPath('activity-proofs/user-1/img.jpg')).toBe('user-1/img.jpg');
      expect(getActivityProofPath('user-1/img.jpg')).toBe('user-1/img.jpg');
    });

    it('extracts and decodes path from active Supabase public URLs', () => {
      expect(
        getActivityProofPath(
          'https://bsicvziazvgppcvsgbsi.supabase.co/storage/v1/object/public/activity-proofs/user-1/123.jpg'
        )
      ).toBe('user-1/123.jpg');

      expect(
        getActivityProofPath(
          'https://bsicvziazvgppcvsgbsi.supabase.co/storage/v1/object/public/activity-proofs/user-1/my%20proof.jpg'
        )
      ).toBe('user-1/my proof.jpg');
    });

    it('returns null for non-activity-proofs external URLs or malformed URLs', () => {
      expect(getActivityProofPath('https://example.com/other/file.jpg')).toBeNull();
      expect(getActivityProofPath('not a valid :// url')).toBeNull();
    });
  });

  describe('createActivityProofSignedUrl', () => {
    it('returns null without calling storage API for dead legacy storage URLs', async () => {
      const result = await createActivityProofSignedUrl(
        'https://dscphfuyhjorrshtyqan.supabase.co/storage/v1/object/public/activity-proofs/user-dead/1.jpg'
      );

      expect(result).toBeNull();
      expect(mockStorageFrom).not.toHaveBeenCalled();
      expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    });

    it('signs valid storage paths once and serves subsequent lookups from cache', async () => {
      const signed = 'https://bsicvziazvgppcvsgbsi.supabase.co/storage/v1/object/sign/activity-proofs/user-cache/unique-1.jpg?token=abc';
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: signed },
        error: null,
      });

      const first = await createActivityProofSignedUrl(
        'https://bsicvziazvgppcvsgbsi.supabase.co/storage/v1/object/public/activity-proofs/user-cache/unique-1.jpg'
      );
      const second = await createActivityProofSignedUrl('user-cache/unique-1.jpg');

      expect(first).toBe(signed);
      expect(second).toBe(signed);
      expect(mockStorageFrom).toHaveBeenCalledTimes(1);
      expect(mockStorageFrom).toHaveBeenCalledWith(ACTIVITY_PROOFS_BUCKET);
      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(
        'user-cache/unique-1.jpg',
        ACTIVITY_PROOF_SIGNED_URL_TTL_SECONDS
      );
    });

    it('caches null when createSignedUrl returns an error so failed requests are not repeated', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: 'Object not found' },
      });

      const first = await createActivityProofSignedUrl('user-missing/unique-404.jpg');
      const second = await createActivityProofSignedUrl('user-missing/unique-404.jpg');

      expect(first).toBeNull();
      expect(second).toBeNull();
      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
    });
  });
});
