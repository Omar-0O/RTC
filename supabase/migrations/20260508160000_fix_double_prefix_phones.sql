-- ============================================================================
-- Migration: Fix double country-code prefix in phone numbers
-- File: 20260508160000_fix_double_prefix_phones.sql
--
-- Handles the case where phone_1 is stored as "+20+201093355307" (two +20 prefixes).
-- This happens when a cell in Excel already has "+201..." but something prepends "+20".
--
-- Also drops the (phone_1, branch_id) unique constraint to allow the sheet
-- to contain people sharing a phone number (handled via linked_to instead).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Drop the unique constraint so duplicate phones are allowed
-- ----------------------------------------------------------------------------
ALTER TABLE public.users_followup
  DROP CONSTRAINT IF EXISTS users_followup_phone_1_branch_id_unique;

DROP INDEX IF EXISTS idx_users_followup_phone_1;

-- ----------------------------------------------------------------------------
-- Step 2: Update trigger function with double-prefix handling
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_normalize_followup_phones()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  s TEXT;
BEGIN
  -- ── Shared normalization logic ────────────────────────────────────────────
  -- Applied identically to phone_1 and phone_2.

  -- ── phone_1 ──────────────────────────────────────────────────────────────
  IF NEW.phone_1 IS NOT NULL AND TRIM(NEW.phone_1) <> '' THEN
    s := REGEXP_REPLACE(TRIM(NEW.phone_1), '[^0-9+]', '', 'g');

    -- Fix double prefix: +20+201... → +201...
    IF s LIKE '+20+%' THEN
      s := SUBSTRING(s FROM 4);  -- strip the first '+20', keep '+...'
    -- Remove any '+' that appears after the first character
    ELSIF POSITION('+' IN SUBSTRING(s FROM 2)) > 0 THEN
      s := (CASE WHEN s LIKE '+%' THEN '+' ELSE '' END)
           || REGEXP_REPLACE(s, '\+', '', 'g');
    END IF;

    IF    s LIKE '00201%'                               THEN s := '+' || SUBSTRING(s FROM 3);
    ELSIF s LIKE '+201%'                                THEN NULL; -- already E.164
    ELSIF s LIKE '201%' AND LENGTH(s) >= 12            THEN s := '+' || s;
    ELSIF s LIKE '01%'  AND LENGTH(s) = 11             THEN s := '+2' || s;
    ELSIF s LIKE '1%'   AND LENGTH(s) = 10             THEN s := '+20' || s;
    END IF;
    NEW.phone_1 := s;
  END IF;

  -- ── phone_2 ──────────────────────────────────────────────────────────────
  IF NEW.phone_2 IS NOT NULL AND TRIM(NEW.phone_2) <> '' THEN
    s := REGEXP_REPLACE(TRIM(NEW.phone_2), '[^0-9+]', '', 'g');

    IF s LIKE '+20+%' THEN
      s := SUBSTRING(s FROM 4);
    ELSIF POSITION('+' IN SUBSTRING(s FROM 2)) > 0 THEN
      s := (CASE WHEN s LIKE '+%' THEN '+' ELSE '' END)
           || REGEXP_REPLACE(s, '\+', '', 'g');
    END IF;

    IF    s LIKE '00201%'                               THEN s := '+' || SUBSTRING(s FROM 3);
    ELSIF s LIKE '+201%'                                THEN NULL;
    ELSIF s LIKE '201%' AND LENGTH(s) >= 12            THEN s := '+' || s;
    ELSIF s LIKE '01%'  AND LENGTH(s) = 11             THEN s := '+2' || s;
    ELSIF s LIKE '1%'   AND LENGTH(s) = 10             THEN s := '+20' || s;
    END IF;
    NEW.phone_2 := s;
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Step 3: One-time fix for existing double-prefix records
-- ----------------------------------------------------------------------------
UPDATE public.users_followup
SET phone_1 = (
  SELECT
    CASE
      -- Fix +20+20... double prefix first
      WHEN s LIKE '+20+%'  THEN SUBSTRING(s FROM 4)
      WHEN s LIKE '00201%' THEN '+' || SUBSTRING(s FROM 3)
      WHEN s LIKE '+201%'  THEN s
      WHEN s LIKE '201%' AND LENGTH(s) >= 12 THEN '+' || s
      WHEN s LIKE '01%'  AND LENGTH(s) = 11  THEN '+2' || s
      WHEN s LIKE '1%'   AND LENGTH(s) = 10  THEN '+20' || s
      ELSE s
    END
  FROM (SELECT REGEXP_REPLACE(TRIM(phone_1), '[^0-9+]', '', 'g') AS s) sub
)
WHERE phone_1 IS NOT NULL
  AND (phone_1 LIKE '+20+%' OR phone_1 NOT LIKE '+2%');
