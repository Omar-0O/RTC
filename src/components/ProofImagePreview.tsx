import { useEffect, useMemo, useState } from 'react';
import { ImagePreview } from '@/components/ui/image-preview';
import {
  createActivityProofSignedUrl,
  getActivityProofPath,
  isDeadStorageUrl,
} from '@/utils/activityProofs';

interface ProofImagePreviewProps {
  proofUrl: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
}

export function ProofImagePreview({
  proofUrl,
  alt = 'Proof',
  className,
  imgClassName,
}: ProofImagePreviewProps) {
  const isDeadUrl = useMemo(() => isDeadStorageUrl(proofUrl), [proofUrl]);
  const storagePath = useMemo(() => getActivityProofPath(proofUrl), [proofUrl]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    if (isDeadUrl) return null;
    return storagePath ? null : proofUrl;
  });

  useEffect(() => {
    let cancelled = false;

    const resolveUrl = async () => {
      if (isDeadUrl) {
        setResolvedUrl(null);
        return;
      }

      if (!storagePath) {
        setResolvedUrl(proofUrl);
        return;
      }

      const signedUrl = await createActivityProofSignedUrl(storagePath);

      if (!cancelled) {
        setResolvedUrl(signedUrl);
      }
    };

    void resolveUrl();

    return () => {
      cancelled = true;
    };
  }, [isDeadUrl, proofUrl, storagePath]);

  if (!resolvedUrl) return null;

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
