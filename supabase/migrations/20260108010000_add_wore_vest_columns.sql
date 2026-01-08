-- Add wore_vest column to activity_submissions, caravan_participants, and event_participants
-- This tracks whether the volunteer wore their vest during participation

-- Add to activity_submissions (for branch activities)
ALTER TABLE public.activity_submissions 
ADD COLUMN IF NOT EXISTS wore_vest BOOLEAN DEFAULT FALSE;

-- Add to caravan_participants
ALTER TABLE public.caravan_participants 
ADD COLUMN IF NOT EXISTS wore_vest BOOLEAN DEFAULT FALSE;

-- Add to event_participants
ALTER TABLE public.event_participants 
ADD COLUMN IF NOT EXISTS wore_vest BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.activity_submissions.wore_vest IS 'Indicates if the volunteer wore their vest during the activity (applicable for branch activities)';
COMMENT ON COLUMN public.caravan_participants.wore_vest IS 'Indicates if the volunteer wore their vest during the caravan';
COMMENT ON COLUMN public.event_participants.wore_vest IS 'Indicates if the volunteer wore their vest during the event';
