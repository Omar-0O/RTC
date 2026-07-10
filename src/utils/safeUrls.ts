const SAFE_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:']);

export const toSafeExternalUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;

  try {
    const url = new URL(value);
    return SAFE_EXTERNAL_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};
