-- Force update month_year for any rows where it is null
-- This ensures that historical data is correctly archived

UPDATE public.competition_participants 
SET month_year = to_char(created_at, 'YYYY-MM') 
WHERE month_year IS NULL;

UPDATE public.competition_entries 
SET month_year = to_char(created_at, 'YYYY-MM') 
WHERE month_year IS NULL;

-- Re-index to be safe
REINDEX INDEX idx_competition_participants_month;
REINDEX INDEX idx_competition_entries_month;
