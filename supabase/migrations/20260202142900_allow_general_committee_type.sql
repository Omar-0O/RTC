-- The General committee represents activities not owned by a production or
-- fourth-year committee. Keep the constraint aligned with that system record.
ALTER TABLE public.committees
  DROP CONSTRAINT IF EXISTS committees_committee_type_check;

ALTER TABLE public.committees
  ADD CONSTRAINT committees_committee_type_check
  CHECK (committee_type IN ('production', 'fourth_year', 'general'));
