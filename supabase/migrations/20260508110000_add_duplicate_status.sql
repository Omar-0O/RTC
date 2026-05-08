-- ============================================================================
-- Migration: Ensure users_followup status check constraint includes 'duplicate'
-- File: 20260508110000_add_duplicate_status.sql
--
-- This is a safety / idempotency migration.  The constraint widening was also
-- applied inline in 20260508100000_normalize_phones_e164.sql (Step 2b).
-- This file ensures the constraint is correct even if applied independently.
-- ============================================================================

ALTER TABLE public.users_followup
  DROP CONSTRAINT IF EXISTS users_followup_status_check;

ALTER TABLE public.users_followup
  ADD CONSTRAINT users_followup_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate'));
