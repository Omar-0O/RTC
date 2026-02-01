-- Add accepted_count column to ethics_calls table
ALTER TABLE public.ethics_calls 
ADD COLUMN accepted_count INTEGER DEFAULT 0;

COMMENT ON COLUMN public.ethics_calls.accepted_count IS 'Number of calls/videos accepted by administration';
