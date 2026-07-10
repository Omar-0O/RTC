import { useEffect, useMemo, useState } from 'react';
import { ImagePreview } from '@/components/ui/image-preview';
import {
  createActivityProofSignedUrl,
  getActivityProofPath,
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
  const storagePath = useMemo(() => getActivityProofPath(proofUrl), [proofUrl]);
  const [resolvedUrl, setResolvedUrl] = useState(proofUrl);

  useEffect(() => {
    let cancelled = false;

    const resolveUrl = async () => {
      if (!storagePath) {
        setResolvedUrl(proofUrl);
        return;
      }

      const signedUrl = await createActivityProofSignedUrl(storagePath);

      if (!cancelled) {
        setResolvedUrl(signedUrl ?? proofUrl);
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
