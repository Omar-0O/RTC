-- ============================================================================
-- Migration: Fix phones with one extra digit in the Egyptian national part
-- File: 20260508170000_fix_extra_digit_phones.sql
--
-- Problem:
--   "+2011111266756" (14 chars = +20 + 11 digits) should be "+201111266756"
--   "+20111111266756" (same pattern for other prefixes)
--   "011111266756" (12 local digits) → was converted to "+2011111266756" → same fix
--
-- Valid Egyptian mobile E.164: exactly 13 chars (+20 + 10 digits)
-- If we see +20 + 11 digits (14 chars), strip the redundant digit after +20.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Fix existing records with 14-char +201X... phones (one extra digit)
-- ----------------------------------------------------------------------------
UPDATE public.users_followup
SET phone_1 = '+20' || SUBSTRING(phone_1 FROM 5)   -- strip 1 digit: +2011... → +201...
WHERE phone_1 IS NOT NULL
  AND LENGTH(phone_1) = 14
  AND (
    phone_1 LIKE '+2010%' OR phone_1 LIKE '+2011%' OR
    phone_1 LIKE '+2012%' OR phone_1 LIKE '+2015%'
  );

-- Same for phone_2
UPDATE public.users_followup
SET phone_2 = '+20' || SUBSTRING(phone_2 FROM 5)
WHERE phone_2 IS NOT NULL
  AND LENGTH(phone_2) = 14
  AND (
    phone_2 LIKE '+2010%' OR phone_2 LIKE '+2011%' OR
    phone_2 LIKE '+2012%' OR phone_2 LIKE '+2015%'
  );

-- ----------------------------------------------------------------------------
-- Step 2: Update trigger to handle the extra-digit case
-- IMPORTANT: Keep this logic in sync with the TypeScript preProcess function
-- in src/utils/phoneUtils.ts. Both must normalize identically.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_normalize_followup_phones()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  s TEXT;
BEGIN
  -- ── phone_1 ──────────────────────────────────────────────────────────────
  IF NEW.phone_1 IS NOT NULL AND TRIM(NEW.phone_1) <> '' THEN
    s := REGEXP_REPLACE(TRIM(NEW.phone_1), '[^0-9+]', '', 'g');

    -- Fix double prefix: +20+201... → +201...
    IF s LIKE '+20+%' THEN
      s := SUBSTRING(s FROM 4);

    -- Remove any '+' after the first character
    ELSIF POSITION('+' IN SUBSTRING(s FROM 2)) > 0 THEN
      s := (CASE WHEN s LIKE '+%' THEN '+' ELSE '' END)
           || REGEXP_REPLACE(s, '\+', '', 'g');
    END IF;

    -- Standard Egyptian pattern matching
    IF    s LIKE '00201%'                               THEN s := '+' || SUBSTRING(s FROM 3);
    ELSIF s LIKE '+201_%' AND LENGTH(s) = 13            THEN NULL;  -- valid E.164, keep as-is
    ELSIF s LIKE '+201_%' AND LENGTH(s) = 14            THEN        -- one extra digit
          s := '+20' || SUBSTRING(s FROM 5);                        -- strip the redundant digit
    ELSIF s LIKE '201%'   AND LENGTH(s) >= 12           THEN s := '+' || s;
    ELSIF s LIKE '01%'    AND LENGTH(s) = 11            THEN s := '+2' || s;
    ELSIF s LIKE '1%'     AND LENGTH(s) = 10            THEN s := '+20' || s;
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
    ELSIF s LIKE '+201_%' AND LENGTH(s) = 13            THEN NULL;
    ELSIF s LIKE '+201_%' AND LENGTH(s) = 14            THEN
          s := '+20' || SUBSTRING(s FROM 5);
    ELSIF s LIKE '201%'   AND LENGTH(s) >= 12           THEN s := '+' || s;
    ELSIF s LIKE '01%'    AND LENGTH(s) = 11            THEN s := '+2' || s;
    ELSIF s LIKE '1%'     AND LENGTH(s) = 10            THEN s := '+20' || s;
    END IF;
    NEW.phone_2 := s;
  END IF;

  RETURN NEW;
END;
$$;
