-- Add detailed tracking logs for Quran sessions
ALTER TABLE public.quran_circle_beneficiaries
ADD COLUMN IF NOT EXISTS memorization_log JSONB, -- { "start": {"surah": 1, "ayah": 1}, "end": {"surah": 1, "ayah": 7}, "grade": "excellent" }
ADD COLUMN IF NOT EXISTS revision_log JSONB,    -- { "start": {"surah": 2, "ayah": 1}, "end": {"surah": 2, "ayah": 20}, "grade": "good" }
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Drop attendance_type as it's now inferred from logs (optional, or keep for backward compatibility)
-- Keeping it for now but making it optional
ALTER TABLE public.quran_circle_beneficiaries
ALTER COLUMN attendance_type DROP NOT NULL;
