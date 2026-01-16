-- Add committee_id to trainers table
ALTER TABLE public.trainers 
ADD COLUMN IF NOT EXISTS committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN public.trainers.committee_id IS 'The committee this trainer belongs to';
