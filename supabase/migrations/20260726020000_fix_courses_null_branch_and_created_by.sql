-- Migration to fix courses that have null branch_id from previous updates
-- This ensures all existing courses retain their active branch association and remain visible.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'courses') THEN
        UPDATE public.courses
        SET branch_id = public.get_default_branch_id()
        WHERE branch_id IS NULL AND public.get_default_branch_id() IS NOT NULL;
    END IF;
END $$;
