import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const Profile = lazy(() => import('@/pages/volunteer/Profile'));

type VolunteerProfilePreviewProps = {
  userId: string;
};

export function VolunteerProfilePreview({ userId }: VolunteerProfilePreviewProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-1">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <Profile userId={userId} />
    </Suspense>
  );
}
