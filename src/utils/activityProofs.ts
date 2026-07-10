import { supabase } from '@/integrations/supabase/client';

export const ACTIVITY_PROOFS_BUCKET = 'activity-proofs';
export const ACTIVITY_PROOF_SIGNED_URL_TTL_SECONDS = 10 * 60;

export const getActivityProofPath = (value: string): string | null => {
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) return null;

  if (!value.includes('://')) {
    return value.startsWith(`${ACTIVITY_PROOFS_BUCKET}/`)
      ? value.slice(ACTIVITY_PROOFS_BUCKET.length + 1)
      : value;
  }

  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${ACTIVITY_PROOFS_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
};

export async function createActivityProofSignedUrl(value: string): Promise<string | null> {
  const path = getActivityProofPath(value);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(ACTIVITY_PROOFS_BUCKET)
    .createSignedUrl(path, ACTIVITY_PROOF_SIGNED_URL_TTL_SECONDS);

  return error ? null : data.signedUrl;
}
