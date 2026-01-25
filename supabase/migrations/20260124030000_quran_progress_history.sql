-- Create table to track progress history
CREATE TABLE IF NOT EXISTS public.quran_progress_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    beneficiary_id UUID REFERENCES public.quran_beneficiaries(id) ON DELETE CASCADE,
    new_parts DOUBLE PRECISION NOT NULL,
    change_amount DOUBLE PRECISION, -- Can be calculated, but good to store for quick access
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.quran_progress_history ENABLE ROW LEVEL SECURITY;

-- Create policy for reading (admins/leaders) - simplistic for now, same as beneficiaries
CREATE POLICY "Allow read access to authenticated users"
    ON public.quran_progress_history
    FOR SELECT
    TO authenticated
    USING (true);

-- Create trigger function to log progress changes
CREATE OR REPLACE FUNCTION public.log_quran_progress_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert if current_parts has changed
    IF (OLD.current_parts IS DISTINCT FROM NEW.current_parts) THEN
        INSERT INTO public.quran_progress_history (beneficiary_id, new_parts, change_amount)
        VALUES (
            NEW.id, 
            NEW.current_parts,
            NEW.current_parts - COALESCE(OLD.current_parts, 0)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_quran_progress_change ON public.quran_beneficiaries;
CREATE TRIGGER on_quran_progress_change
    AFTER UPDATE ON public.quran_beneficiaries
    FOR EACH ROW
    EXECUTE FUNCTION public.log_quran_progress_change();

-- Backfill initial history for existing beneficiaries so charts aren't empty
-- We assume the current state is the "initial" state if no history exists
INSERT INTO public.quran_progress_history (beneficiary_id, new_parts, change_amount, created_at)
SELECT 
    id, 
    current_parts, 
    current_parts, -- Treat initial amount as the change amount from 0
    created_at -- Use the creation time of the beneficiary
FROM public.quran_beneficiaries
WHERE id NOT IN (SELECT beneficiary_id FROM public.quran_progress_history);
