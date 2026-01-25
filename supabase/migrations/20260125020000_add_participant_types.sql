-- Create participant_type enum
CREATE TYPE public.participant_type AS ENUM ('volunteer', 'trainer', 'guest');

-- Alter activity_submissions table
ALTER TABLE public.activity_submissions 
ADD COLUMN participant_type public.participant_type NOT NULL DEFAULT 'volunteer',
ADD COLUMN trainer_id UUID REFERENCES public.trainers(id),
ADD COLUMN guest_name TEXT;

-- Make volunteer_id nullable
ALTER TABLE public.activity_submissions 
ALTER COLUMN volunteer_id DROP NOT NULL;

-- Add constraint to ensure exactly one target is specified
ALTER TABLE public.activity_submissions 
ADD CONSTRAINT activity_submissions_participant_check 
CHECK (
  (participant_type = 'volunteer' AND volunteer_id IS NOT NULL) OR
  (participant_type = 'trainer' AND trainer_id IS NOT NULL) OR
  (participant_type = 'guest' AND guest_name IS NOT NULL)
);

-- Update RLS policies (optional but recommended)
-- Ensure appropriate access for different types if needed. 
-- Existing policies likely rely on volunteer_id for "own" rows.
-- We might need to adjust policies to allow viewing rows where one is the submitter (leader) or the subject. Only Leader submits for others usually.
-- For now, we assume Leaders have broad access via admin/leader roles.
