import { describe, it, expect } from 'vitest';
import { getRadianAngle, rotateSize } from './imageCrop';

describe('imageCrop utils', () => {
  describe('getRadianAngle', () => {
    it('converts degrees to radians correctly', () => {
      expect(getRadianAngle(0)).toBe(0);
      expect(getRadianAngle(90)).toBeCloseTo(Math.PI / 2);
      expect(getRadianAngle(180)).toBeCloseTo(Math.PI);
      expect(getRadianAngle(360)).toBeCloseTo(Math.PI * 2);
    });
  });

  describe('rotateSize', () => {
    it('returns the same dimensions for 0 and 360 degree rotation', () => {
      const size = rotateSize(200, 100, 0);
      expect(size.width).toBeCloseTo(200);
      expect(size.height).toBeCloseTo(100);

      const size360 = rotateSize(200, 100, 360);
      expect(size360.width).toBeCloseTo(200);
      expect(size360.height).toBeCloseTo(100);
    });

    it('swaps width and height for 90 and 270 degree rotation', () => {
      const size90 = rotateSize(200, 100, 90);
      expect(size90.width).toBeCloseTo(100);
      expect(size90.height).toBeCloseTo(200);

      const size270 = rotateSize(200, 100, 270);
      expect(size270.width).toBeCloseTo(100);
      expect(size270.height).toBeCloseTo(200);
    });

    it('calculates bounding box correctly for 45 degree rotation', () => {
      const size45 = rotateSize(100, 100, 45);
      const expected = 100 * Math.SQRT2;
      expect(size45.width).toBeCloseTo(expected);
      expect(size45.height).toBeCloseTo(expected);
    });
  });
});
