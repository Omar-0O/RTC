-- Add attendance_type column to quran_circle_beneficiaries table
ALTER TABLE public.quran_circle_beneficiaries 
ADD COLUMN IF NOT EXISTS attendance_type TEXT NOT NULL DEFAULT 'memorization' 
CHECK (attendance_type IN ('memorization', 'revision'));
