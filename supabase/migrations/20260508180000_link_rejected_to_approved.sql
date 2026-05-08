-- ============================================================================
-- Migration: Link existing rejected records to their matching approved records
-- File: 20260508180000_link_rejected_to_approved.sql
--
-- Problem: Rejected records (pending/duplicate that were auto-rejected) don't
-- have linked_to set, so their participations (if any) don't appear under
-- the correct approved person.
--
-- Fix: For every rejected record whose phone_1 matches an approved record's
-- phone_1, set linked_to = approved_record.id.
-- ============================================================================

UPDATE public.users_followup AS u
SET linked_to = a.id
FROM public.users_followup AS a
WHERE u.status = 'rejected'
  AND u.linked_to IS NULL          -- only update unlinked records
  AND a.status = 'approved'
  AND a.phone_1 = u.phone_1        -- exact phone match (already normalized)
  AND a.id != u.id;
