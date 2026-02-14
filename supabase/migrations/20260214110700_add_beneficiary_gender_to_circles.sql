-- Add beneficiary_gender column to quran_circles table
-- This allows explicit selection of beneficiary gender (men/women) independent of teacher gender

ALTER TABLE public.quran_circles 
ADD COLUMN IF NOT EXISTS beneficiary_gender TEXT 
CHECK (beneficiary_gender IN ('male', 'female')) 
DEFAULT 'male';

-- Update existing records based on teacher gender to maintain consistency
UPDATE public.quran_circles qc
SET beneficiary_gender = CASE 
    WHEN EXISTS (
        SELECT 1 FROM quran_teachers qt 
        WHERE qt.id = qc.teacher_id 
        AND qt.target_gender = 'women'
    ) THEN 'female'
    ELSE 'male'
END;

-- Add comment
COMMENT ON COLUMN public.quran_circles.beneficiary_gender IS 'Gender of beneficiaries in this circle (male or female)';
