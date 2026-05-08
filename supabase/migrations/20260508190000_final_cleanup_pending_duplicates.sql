-- ============================================================================
-- Migration: Final cleanup — reject ALL pending/duplicate records that share
-- a phone with an existing approved record (for both branches).
--
-- This catches records that were created before the dedup fixes and weren't
-- cleaned by earlier migrations (e.g. records with IDs 1, 3, 54 that still
-- appear as pending even though the same phone is approved).
-- ============================================================================

-- Step 1: Set linked_to for unlinked rejected/pending records that match approved
UPDATE public.users_followup AS u
SET linked_to = a.id
FROM public.users_followup AS a
WHERE u.status IN ('pending', 'duplicate', 'rejected')
  AND u.linked_to IS NULL
  AND a.status = 'approved'
  AND a.phone_1 = u.phone_1
  AND a.id != u.id;

-- Step 2: Reject all pending/duplicate records whose phone_1 is already approved
UPDATE public.users_followup u
SET status = 'rejected'
WHERE u.status IN ('pending', 'duplicate')
  AND EXISTS (
    SELECT 1
    FROM public.users_followup a
    WHERE a.status = 'approved'
      AND a.phone_1 = u.phone_1
      AND a.id != u.id
  );

-- Step 3: Among remaining pending/duplicate (no approved match), keep only
-- the earliest per phone_1 — reject all later ones.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY phone_1 ORDER BY id ASC) AS rn
  FROM public.users_followup
  WHERE phone_1 IS NOT NULL
    AND status IN ('pending', 'duplicate')
),
to_reject AS (SELECT id FROM ranked WHERE rn > 1)
UPDATE public.users_followup u
SET status = 'rejected'
FROM to_reject t
WHERE u.id = t.id
  AND u.status IN ('pending', 'duplicate');
