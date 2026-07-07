type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
};

export const CACHE_TTL = {
  short: 5 * 60 * 1000,
  medium: 15 * 60 * 1000,
} as const;

export function setLocalCache<T>(key: string, value: T, ttlMs = CACHE_TTL.short): void {
  try {
    const envelope: CacheEnvelope<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Best-effort cache only.
  }
}

export function getLocalCache<T>(
  key: string,
  isValid: (value: unknown) => value is T
): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as Partial<CacheEnvelope<unknown>>;
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(key);
      return null;
    }

    return isValid(parsed.value) ? parsed.value : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}
