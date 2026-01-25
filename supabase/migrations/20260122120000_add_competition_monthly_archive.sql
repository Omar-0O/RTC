-- Add month_year tracking to competition tables for monthly archiving

-- Add month_year column to participants
ALTER TABLE public.competition_participants 
ADD COLUMN IF NOT EXISTS month_year TEXT DEFAULT to_char(NOW(), 'YYYY-MM');

-- Add month_year column to entries
ALTER TABLE public.competition_entries 
ADD COLUMN IF NOT EXISTS month_year TEXT DEFAULT to_char(NOW(), 'YYYY-MM');

-- Create index for efficient month-based queries
CREATE INDEX IF NOT EXISTS idx_competition_participants_month 
ON public.competition_participants(month_year);

CREATE INDEX IF NOT EXISTS idx_competition_entries_month 
ON public.competition_entries(month_year);

-- Update existing entries to use their creation month
UPDATE public.competition_participants 
SET month_year = to_char(created_at, 'YYYY-MM') 
WHERE month_year IS NULL OR month_year = to_char(NOW(), 'YYYY-MM');

UPDATE public.competition_entries 
SET month_year = to_char(created_at, 'YYYY-MM') 
WHERE month_year IS NULL OR month_year = to_char(NOW(), 'YYYY-MM');

-- Add comments
COMMENT ON COLUMN public.competition_participants.month_year IS 'Month identifier for archiving (format: YYYY-MM)';
COMMENT ON COLUMN public.competition_entries.month_year IS 'Month identifier for archiving (format: YYYY-MM)';
