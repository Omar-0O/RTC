import { useEffect, useMemo, useState } from 'react';
import { ImagePreview } from '@/components/ui/image-preview';
import { supabase } from '@/integrations/supabase/client';

interface ProofImagePreviewProps {
  proofUrl: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
}

const ACTIVITY_PROOFS_BUCKET = 'activity-proofs';
const SIGNED_URL_TTL_SECONDS = 10 * 60;

const getActivityProofPath = (value: string): string | null => {
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

export function ProofImagePreview({
  proofUrl,
  alt = 'Proof',
  className,
  imgClassName,
}: ProofImagePreviewProps) {
  const storagePath = useMemo(() => getActivityProofPath(proofUrl), [proofUrl]);
  const [resolvedUrl, setResolvedUrl] = useState(proofUrl);

  useEffect(() => {
    let cancelled = false;

    const resolveUrl = async () => {
      if (!storagePath) {
        setResolvedUrl(proofUrl);
        return;
      }

      const { data, error } = await supabase.storage
        .from(ACTIVITY_PROOFS_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

      if (!cancelled) {
        setResolvedUrl(error ? proofUrl : data.signedUrl);
      }
    };

    resolveUrl();

    return () => {
      cancelled = true;
    };
  }, [proofUrl, storagePath]);

  return (
    <ImagePreview src={resolvedUrl} alt={alt} className={className}>
      <img
        src={resolvedUrl}
        alt={alt}
        className={imgClassName}
      />
    </ImagePreview>
  );
}
