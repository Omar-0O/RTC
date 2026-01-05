-- Add missing columns to activity_types to match frontend expectations
ALTER TABLE public.activity_types 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS description_ar TEXT,
ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'individual' CHECK (mode IN ('individual', 'group')),
ADD COLUMN IF NOT EXISTS committee_id UUID REFERENCES public.committees(id);

-- Optionally, backfill mode if needed, though default 'individual' is set.
-- UPDATE public.activity_types SET mode = 'individual' WHERE mode IS NULL;
