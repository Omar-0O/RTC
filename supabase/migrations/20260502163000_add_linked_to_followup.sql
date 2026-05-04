-- Add linked_to column to users_followup table.
-- This allows linking an "alias" entry to a "primary" entry so that:
--   • Participations from the alias are surfaced under the primary user.
--   • The alias person's own participations dialog shows a redirect note.
ALTER TABLE public.users_followup
  ADD COLUMN IF NOT EXISTS linked_to integer
  REFERENCES public.users_followup(id)
  ON DELETE SET NULL;

-- Allow the column to be read/written via the existing RLS policies
-- (no separate policy needed — existing row-level policies on the table cover it).
