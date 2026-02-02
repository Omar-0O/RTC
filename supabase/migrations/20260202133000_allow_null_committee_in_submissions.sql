-- Allow committee_id to be NULL in activity_submissions for General activities
ALTER TABLE public.activity_submissions 
ALTER COLUMN committee_id DROP NOT NULL;

-- Also allow it in group_submissions if it exists there
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'group_submissions' AND column_name = 'committee_id') THEN
        ALTER TABLE public.group_submissions 
        ALTER COLUMN committee_id DROP NOT NULL;
    END IF;
END $$;
