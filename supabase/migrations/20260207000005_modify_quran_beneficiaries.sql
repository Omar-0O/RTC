-- Modify quran_beneficiaries table
ALTER TABLE public.quran_beneficiaries 
DROP COLUMN IF EXISTS date_added,
DROP COLUMN IF EXISTS birth_date;

ALTER TABLE public.quran_beneficiaries
ADD COLUMN IF NOT EXISTS beneficiary_type TEXT CHECK (beneficiary_type IN ('child', 'adult')) DEFAULT 'adult';
