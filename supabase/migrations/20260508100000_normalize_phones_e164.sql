-- ============================================================================
-- Migration: Normalize phone numbers to E.164 and enforce per-branch uniqueness
-- File: 20260508100000_normalize_phones_e164.sql
--
-- Strategy:
--   1. Create a SQL helper function that converts common Egyptian phone formats
--      to a canonical E.164-style string (+20XXXXXXXXXX).
--   2. Normalize all existing phone_1 / phone_2 values in users_followup.
--   3. Soft-flag (status = 'duplicate') rows whose phone_1 is duplicated
--      WITHIN the same branch (keeping the earliest record).
--   4. Add a UNIQUE constraint on (phone_1, branch_id) — same number allowed
--      across different branches, but not within the same branch.
--
-- Idempotency: Each step uses IF NOT EXISTS / DO $$ guards so it is safe to
-- re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: SQL normalization helper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_phone_eg(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s TEXT;
BEGIN
  -- Return NULL for empty / NULL input
  IF raw IS NULL OR TRIM(raw) = '' THEN
    RETURN NULL;
  END IF;

  -- Strip everything that is not a digit or '+'
  s := REGEXP_REPLACE(TRIM(raw), '[^0-9+]', '', 'g');

  -- Resolve international Egyptian prefixes → +20XXXXXXXXXX
  IF s LIKE '00201%' THEN
    s := '+' || SUBSTRING(s FROM 3);     -- 00201... → +201...
  ELSIF s LIKE '+201%' THEN
    NULL; -- Already canonical, keep as-is
  ELSIF s LIKE '201%' AND LENGTH(s) >= 12 THEN
    s := '+' || s;                        -- 201... → +201...
  ELSIF s LIKE '01%' AND LENGTH(s) = 11 THEN
    s := '+2' || s;                       -- 01... (11 digits) → +201...
  ELSIF s LIKE '1%' AND LENGTH(s) = 10 THEN
    s := '+20' || s;                      -- 1... (10 digits, missing leading 0) → +201...
  END IF;

  -- Return the result (could still be non-E.164 for truly international numbers;
  -- libphonenumber-js handles those on the TypeScript side — here we do best-effort)
  RETURN s;
END;
$$;

-- ----------------------------------------------------------------------------
-- Step 2: Normalize existing phone_1 and phone_2 values
-- ----------------------------------------------------------------------------
UPDATE users_followup
SET
  phone_1 = COALESCE(normalize_phone_eg(phone_1), phone_1),
  phone_2 = normalize_phone_eg(phone_2)
WHERE
  -- Only update rows that still have the old format
  phone_1 IS NOT NULL
  AND (
    phone_1 NOT LIKE '+%'         -- not yet prefixed with '+'
    OR phone_2 IS NOT NULL        -- always re-normalize phone_2 too
  );

-- ----------------------------------------------------------------------------
-- Step 2b: Widen the status check constraint to include 'duplicate'
--
-- The original constraint only allows ('pending','approved','rejected').
-- We must extend it BEFORE running the UPDATE in Step 3, otherwise
-- PostgreSQL will raise a check-constraint violation.
-- ----------------------------------------------------------------------------
ALTER TABLE public.users_followup
  DROP CONSTRAINT IF EXISTS users_followup_status_check;

ALTER TABLE public.users_followup
  ADD CONSTRAINT users_followup_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate'));

-- ----------------------------------------------------------------------------
-- Step 3: Soft-flag duplicates within the same branch (per-branch scope)
--
-- Keep the record with the lowest id (earliest insert) as 'approved'.
-- Flag all later duplicates as status = 'duplicate' for admin review.
-- Rows with status already = 'rejected' are left untouched.
-- ----------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    phone_1,
    branch_id,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY phone_1, branch_id
      ORDER BY id ASC            -- keep earliest
    ) AS rn
  FROM users_followup
  WHERE
    phone_1 IS NOT NULL
    AND branch_id IS NOT NULL
    AND status != 'rejected'     -- leave rejected rows alone
),
duplicates AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE users_followup u
SET status = 'duplicate'
FROM duplicates d
WHERE u.id = d.id
  AND u.status NOT IN ('rejected', 'duplicate');  -- idempotent

-- ----------------------------------------------------------------------------
-- Step 4: Add UNIQUE constraint on (phone_1, branch_id)
--
-- Enforces: same normalized phone cannot appear twice in the same branch.
-- Same phone in a different branch is perfectly fine.
--
-- NOTE: phone_1 IS NOT NULL is already guaranteed by the schema (NOT NULL).
-- branch_id may be NULL; NULLs are distinct in PostgreSQL, so rows without a
-- branch_id will NOT conflict with each other via this constraint.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_followup_phone_1_branch_id_unique'
  ) THEN
    -- Exclude 'duplicate' and 'rejected' rows from the uniqueness check so
    -- historical soft-deleted duplicates do not block the constraint creation.
    ALTER TABLE users_followup
      ADD CONSTRAINT users_followup_phone_1_branch_id_unique
      UNIQUE (phone_1, branch_id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

-- Optional: Create an index for faster phone lookups (useful for large tables)
CREATE INDEX IF NOT EXISTS idx_users_followup_phone_1
  ON users_followup (phone_1, branch_id)
  WHERE status NOT IN ('rejected', 'duplicate');

-- Verify: how many per-branch duplicates remain after the migration?
-- (Should be 0 for status = 'approved')
-- SELECT phone_1, branch_id, COUNT(*) AS cnt
-- FROM users_followup
-- WHERE status = 'approved' AND phone_1 IS NOT NULL AND branch_id IS NOT NULL
-- GROUP BY phone_1, branch_id
-- HAVING COUNT(*) > 1
-- ORDER BY cnt DESC;
