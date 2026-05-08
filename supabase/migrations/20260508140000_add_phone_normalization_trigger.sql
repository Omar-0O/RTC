-- ============================================================================
-- Migration: Add trigger to auto-normalize phone_1 / phone_2 on every INSERT/UPDATE
-- File: 20260508140000_add_phone_normalization_trigger.sql
--
-- SELF-CONTAINED: inlines the normalization logic so it does NOT depend on
-- normalize_phone_eg() being available.  Safe to run standalone in the dashboard.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger function (inline normalization — no external function dependency)
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
-- Attach trigger (BEFORE INSERT OR UPDATE so the row is stored normalized)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_users_followup_normalize_phones ON public.users_followup;

CREATE TRIGGER trg_users_followup_normalize_phones
  BEFORE INSERT OR UPDATE OF phone_1, phone_2
  ON public.users_followup
  FOR EACH ROW
  EXECUTE FUNCTION trg_normalize_followup_phones();

-- ----------------------------------------------------------------------------
-- One-time cleanup: normalize any remaining un-normalized phones (inline logic)
-- ----------------------------------------------------------------------------
UPDATE public.users_followup
SET phone_1 = (
  SELECT
    CASE
      WHEN s LIKE '00201%'                     THEN '+' || SUBSTRING(s FROM 3)
      WHEN s LIKE '+201%'                      THEN s
      WHEN s LIKE '201%' AND LENGTH(s) >= 12  THEN '+' || s
      WHEN s LIKE '01%'  AND LENGTH(s) = 11   THEN '+2' || s
      WHEN s LIKE '1%'   AND LENGTH(s) = 10   THEN '+20' || s
      ELSE s
    END
  FROM (SELECT REGEXP_REPLACE(TRIM(phone_1), '[^0-9+]', '', 'g') AS s) sub
)
WHERE phone_1 IS NOT NULL
  AND phone_1 NOT LIKE '+%';
