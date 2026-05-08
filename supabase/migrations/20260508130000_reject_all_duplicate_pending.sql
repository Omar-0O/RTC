-- ============================================================================
-- Migration: Remove duplicate PENDING/DUPLICATE rows — never touch approved
-- File: 20260508130000_reject_all_duplicate_pending.sql
--
-- Rules:
--   1. APPROVED records are NEVER modified — the main sheet is read-only.
--   2. If an APPROVED record exists for a phone_1, reject all pending/duplicate
--      rows with the same phone.
--   3. If only pending/duplicate rows exist for a phone, keep the earliest one
--      (lowest id) and reject all later ones.
--
-- This is idempotent: already-rejected rows are untouched.
-- ============================================================================

-- Step 1: Reject pending/duplicate rows whose phone_1 matches an approved row.
UPDATE users_followup u
SET status = 'rejected'
WHERE u.status IN ('pending', 'duplicate')
  AND EXISTS (
    SELECT 1
    FROM users_followup a
    WHERE a.status = 'approved'
      AND a.phone_1 = u.phone_1
  );

-- Step 2: Among remaining pending/duplicate rows (no approved match),
--         keep only the earliest per phone_1 — reject all later ones.
WITH ranked AS (
  SELECT
    id,
    phone_1,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY phone_1
      ORDER BY id ASC   -- keep the earliest
    ) AS rn
  FROM users_followup
  WHERE phone_1 IS NOT NULL
    AND status IN ('pending', 'duplicate')  -- ONLY these two statuses
),
to_reject AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE users_followup u
SET status = 'rejected'
FROM to_reject t
WHERE u.id = t.id
  AND u.status IN ('pending', 'duplicate');  -- extra safety: never touch approved
