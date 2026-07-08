type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
};

export const CACHE_TTL = {
  short: 5 * 60 * 1000,
  medium: 15 * 60 * 1000,
} as const;

const removeLegacyLocalCache = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Best-effort legacy cleanup only.
  }
};

const removeSessionCache = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Best-effort cache cleanup only.
  }
};

export function setLocalCache<T>(key: string, value: T, ttlMs = CACHE_TTL.short): void {
  try {
    const envelope: CacheEnvelope<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    sessionStorage.setItem(key, JSON.stringify(envelope));
    removeLegacyLocalCache(key);
  } catch {
    removeLegacyLocalCache(key);
    // Best-effort cache only.
  }
}

export function getLocalCache<T>(
  key: string,
  isValid: (value: unknown) => value is T
): T | null {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as Partial<CacheEnvelope<unknown>>;
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) {
      removeSessionCache(key);
      return null;
    }

    return isValid(parsed.value) ? parsed.value : null;
  } catch {
    removeSessionCache(key);
    return null;
  } finally {
    removeLegacyLocalCache(key);
  }
}
