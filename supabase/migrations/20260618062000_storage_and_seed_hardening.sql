-- Phase 4 security remediation:
-- - Make activity proof files private and readable through authenticated/signed access only.
-- - Restrict trainer image writes to privileged management roles instead of every authenticated user.

UPDATE storage.buckets
SET public = false
WHERE id = 'activity-proofs';

DROP POLICY IF EXISTS "Proofs are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own proofs" ON storage.objects;
DROP POLICY IF EXISTS "activity_proofs_select" ON storage.objects;
DROP POLICY IF EXISTS "activity_proofs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "activity_proofs_delete_own_or_manager" ON storage.objects;

CREATE POLICY "activity_proofs_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'activity-proofs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN (
          'admin',
          'executive',
          'branch_admin',
          'supervisor',
          'hr',
          'head_hr',
          'committee_leader',
          'head_production',
          'head_fourth_year',
          'head_events',
          'head_caravans',
          'head_ethics',
          'head_quran',
          'head_ashbal'
        )
    )
  )
);

CREATE POLICY "activity_proofs_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'activity-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "activity_proofs_delete_own_or_manager"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'activity-proofs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN ('admin', 'executive', 'branch_admin', 'supervisor', 'head_hr')
    )
  )
);

DROP POLICY IF EXISTS "Authenticated Insert Trainers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Trainers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Trainers" ON storage.objects;
DROP POLICY IF EXISTS "trainer_images_insert_managers" ON storage.objects;
DROP POLICY IF EXISTS "trainer_images_update_managers" ON storage.objects;
DROP POLICY IF EXISTS "trainer_images_delete_managers" ON storage.objects;

CREATE POLICY "trainer_images_insert_managers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trainers'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN (
        'admin',
        'executive',
        'branch_admin',
        'supervisor',
        'head_production',
        'head_fourth_year',
        'head_quran'
      )
  )
);

CREATE POLICY "trainer_images_update_managers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trainers'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN (
        'admin',
        'executive',
        'branch_admin',
        'supervisor',
        'head_production',
        'head_fourth_year',
        'head_quran'
      )
  )
)
WITH CHECK (bucket_id = 'trainers');

CREATE POLICY "trainer_images_delete_managers"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'trainers'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin', 'executive', 'branch_admin', 'supervisor')
  )
);
