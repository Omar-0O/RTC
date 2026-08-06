import { describe, it, expect } from 'vitest';
import { toSafeExternalUrl } from './safeUrls';

describe('toSafeExternalUrl', () => {
  it('allows valid http and https URLs', () => {
    expect(toSafeExternalUrl('https://example.com')).toBe('https://example.com/');
    expect(toSafeExternalUrl('http://example.com/path?arg=1')).toBe('http://example.com/path?arg=1');
  });

  it('rejects dangerous protocols (javascript:, data:, file:)', () => {
    expect(toSafeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(toSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(toSafeExternalUrl('file:///etc/passwd')).toBeNull();
  });

  it('handles null, undefined, or empty values', () => {
    expect(toSafeExternalUrl(null)).toBeNull();
    expect(toSafeExternalUrl(undefined)).toBeNull();
    expect(toSafeExternalUrl('')).toBeNull();
    expect(toSafeExternalUrl('invalid-url')).toBeNull();
  });
});
