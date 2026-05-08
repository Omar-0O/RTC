-- ============================================================================
-- Migration: Clean up existing mess in users_followup pending/duplicate tab
-- File: 20260508120000_cleanup_followup_duplicates.sql
--
-- NOTE: Phone normalization was already done in 20260508100000.
--       This migration only handles:
--   1. Auto-reject 'pending'/'duplicate' records whose phone_1 already exists
--      in an 'approved' record.
--   2. Re-flag per-branch duplicates (catch records added after 20260508100000).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Auto-reject pending/duplicate records whose phone is already approved
-- ----------------------------------------------------------------------------
UPDATE users_followup u
SET status = 'rejected'
WHERE u.status IN ('pending', 'duplicate')
  AND EXISTS (
    SELECT 1
    FROM users_followup a
    WHERE a.status = 'approved'
      AND a.phone_1 = u.phone_1
      AND a.id != u.id
  );

-- ----------------------------------------------------------------------------
-- Step 2: Re-flag per-branch duplicates
-- ----------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    phone_1,
    branch_id,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY phone_1, branch_id
      ORDER BY id ASC
    ) AS rn
  FROM users_followup
  WHERE
    phone_1 IS NOT NULL
    AND branch_id IS NOT NULL
    AND status NOT IN ('rejected', 'duplicate')
),
dups AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE users_followup u
SET status = 'duplicate'
FROM dups d
WHERE u.id = d.id;
