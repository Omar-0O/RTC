-- Add description to quran_circles
ALTER TABLE public.quran_circles 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add gender and birth_date to quran_beneficiaries
ALTER TABLE public.quran_beneficiaries 
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female')),
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Update RLS policies if needed (usually existing ones cover new columns unless using specific column list)
-- Existing policies cover ALL columns usually.
