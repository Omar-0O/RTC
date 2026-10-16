import { describe, it, expect } from 'vitest';
import {
  calculateTargetDimensions,
  getNewFilename,
  resolveCompressionConfig,
  COMPRESSION_PRESETS,
  compressImage,
} from './imageCompression';

describe('imageCompression utils', () => {
  describe('calculateTargetDimensions', () => {
    it('preserves dimensions when image is smaller than maxDimension', () => {
      const result = calculateTargetDimensions(400, 300, 800);
      expect(result).toEqual({ width: 400, height: 300 });
    });

    it('scales down landscape images proportionally to maxDimension', () => {
      const result = calculateTargetDimensions(3200, 1600, 1600);
      expect(result).toEqual({ width: 1600, height: 800 });
    });

    it('scales down portrait images proportionally to maxDimension', () => {
      const result = calculateTargetDimensions(1200, 2400, 800);
      expect(result).toEqual({ width: 400, height: 800 });
    });

    it('scales square images to maxDimension exactly', () => {
      const result = calculateTargetDimensions(2000, 2000, 512);
      expect(result).toEqual({ width: 512, height: 512 });
    });

    it('handles zero or negative dimensions safely', () => {
      const result = calculateTargetDimensions(0, 0, 500);
      expect(result).toEqual({ width: 500, height: 500 });
    });
  });

  describe('getNewFilename', () => {
    it('swaps extension to webp when mimeType is image/webp', () => {
      expect(getNewFilename('photo.png', 'image/webp')).toBe('photo.webp');
      expect(getNewFilename('avatar.jpeg', 'image/webp')).toBe('avatar.webp');
      expect(getNewFilename('my.special.name.jpg', 'image/webp')).toBe('my.special.name.webp');
    });

    it('swaps extension to jpg when mimeType is image/jpeg', () => {
      expect(getNewFilename('photo.png', 'image/jpeg')).toBe('photo.jpg');
      expect(getNewFilename('picture.webp', 'image/jpeg')).toBe('picture.jpg');
    });

    it('handles empty filename gracefully', () => {
      expect(getNewFilename('', 'image/webp')).toBe('image.webp');
    });
  });

  describe('resolveCompressionConfig', () => {
    it('resolves avatar preset correctly', () => {
      const config = resolveCompressionConfig({ preset: 'avatar' });
      expect(config.maxDimension).toBe(COMPRESSION_PRESETS.avatar.maxDimension);
      expect(config.quality).toBe(COMPRESSION_PRESETS.avatar.quality);
      expect(config.mimeType).toBe(COMPRESSION_PRESETS.avatar.mimeType);
    });

    it('resolves proof preset correctly with 1600 max dimension', () => {
      const config = resolveCompressionConfig({ preset: 'proof' });
      expect(config.maxDimension).toBe(1600);
      expect(config.quality).toBe(0.75);
    });

    it('allows overriding specific options on top of presets', () => {
      const config = resolveCompressionConfig({ preset: 'proof', quality: 0.9, maxDimension: 1000 });
      expect(config.maxDimension).toBe(1000);
      expect(config.quality).toBe(0.9);
    });

    it('defaults to standard preset when none provided', () => {
      const config = resolveCompressionConfig();
      expect(config.maxDimension).toBe(COMPRESSION_PRESETS.standard.maxDimension);
    });
  });

  describe('compressImage safeguards', () => {
    it('returns non-image files untouched without throwing', async () => {
      const textFile = new File(['hello world'], 'report.txt', { type: 'text/plain' });
      const result = await compressImage(textFile);
      expect(result).toBe(textFile);
    });

    it('returns PDF files untouched without throwing', async () => {
      const pdfFile = new File(['pdf content'], 'document.pdf', { type: 'application/pdf' });
      const result = await compressImage(pdfFile);
      expect(result).toBe(pdfFile);
    });
  });
});
