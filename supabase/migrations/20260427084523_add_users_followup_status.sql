-- Add status column to users_followup
ALTER TABLE public.users_followup ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Update all existing records to 'approved'
UPDATE public.users_followup SET status = 'approved';

-- Add a check constraint to ensure only valid statuses are entered
ALTER TABLE public.users_followup ADD CONSTRAINT users_followup_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
