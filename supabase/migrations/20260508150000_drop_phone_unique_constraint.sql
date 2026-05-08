-- ============================================================================
-- Migration: Drop the unique constraint on (phone_1, branch_id)
-- File: 20260508150000_drop_phone_unique_constraint.sql
--
-- The import sheet may intentionally contain people with the same phone
-- (e.g. family members sharing a number). Instead of rejecting them,
-- we use linked_to to mark the canonical record.
-- The application layer handles deduplication logic.
-- ============================================================================

ALTER TABLE public.users_followup
  DROP CONSTRAINT IF EXISTS users_followup_phone_1_branch_id_unique;

DROP INDEX IF EXISTS idx_users_followup_phone_1;
