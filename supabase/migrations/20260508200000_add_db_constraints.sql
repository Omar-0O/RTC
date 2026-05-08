-- ============================================================================
-- Migration: Add defensive DB constraints to users_followup
-- File: 20260508200000_add_db_constraints.sql
--
-- 1. CHECK: phone_1 and phone_2 must not be the same value on the same row
-- 2. FK: linked_to must reference a valid users_followup record
-- ============================================================================

-- First clean up any rows where phone_1 = phone_2 (set phone_2 to NULL)
UPDATE public.users_followup
SET phone_2 = NULL
WHERE phone_2 IS NOT NULL
  AND phone_1 = phone_2;

-- 1. Prevent phone_1 = phone_2 on the same row
ALTER TABLE public.users_followup
ADD CONSTRAINT phone_1_not_equal_phone_2
CHECK (phone_1 IS DISTINCT FROM phone_2);

-- Clear any linked_to values that point to non-existent records before adding FK
UPDATE public.users_followup u
SET linked_to = NULL
WHERE linked_to IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.users_followup t WHERE t.id = u.linked_to
  );

-- 2. Enforce referential integrity for linked_to
ALTER TABLE public.users_followup
ADD CONSTRAINT fk_linked_to
FOREIGN KEY (linked_to)
REFERENCES public.users_followup(id)
ON DELETE SET NULL;
