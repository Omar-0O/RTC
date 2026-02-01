-- Fix Primary Key for quran_circle_beneficiaries to allow multiple sessions per user

-- 1. Drop the existing primary key constraint
ALTER TABLE public.quran_circle_beneficiaries
DROP CONSTRAINT IF EXISTS quran_circle_beneficiaries_pkey;

-- 2. Add a new surrogate ID if not exists, or just use composite PK of session_id + beneficiary_id
-- Ideally, session_id + beneficiary_id should be unique.

ALTER TABLE public.quran_circle_beneficiaries
ADD CONSTRAINT quran_circle_beneficiaries_pkey PRIMARY KEY (session_id, beneficiary_id);

-- Optional: Ensure circle_id is still indexed but not part of uniqueness for attendance
DROP INDEX IF EXISTS idx_quran_circle_beneficiaries_circle;
CREATE INDEX idx_quran_circle_beneficiaries_circle ON public.quran_circle_beneficiaries(circle_id);
