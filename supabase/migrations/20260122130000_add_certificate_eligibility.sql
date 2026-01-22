-- Add certificate eligibility tracking to course_beneficiaries

-- Add certificate_eligible column
ALTER TABLE public.course_beneficiaries 
ADD COLUMN IF NOT EXISTS certificate_eligible BOOLEAN DEFAULT NULL;

-- Add attendance_percentage column for reference
ALTER TABLE public.course_beneficiaries 
ADD COLUMN IF NOT EXISTS attendance_percentage NUMERIC(5,2) DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN public.course_beneficiaries.certificate_eligible 
IS 'Whether the beneficiary attended >= 75% of lectures and is eligible for certificate';

COMMENT ON COLUMN public.course_beneficiaries.attendance_percentage 
IS 'Calculated attendance percentage for the beneficiary';
