-- Add branch_id to committees table
ALTER TABLE public.committees ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- Backfill with default branch ID
UPDATE public.committees SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- Drop the old global unique constraint on name
ALTER TABLE public.committees DROP CONSTRAINT IF EXISTS committees_name_key;

-- Add new unique constraint scoped to branch
ALTER TABLE public.committees ADD CONSTRAINT committees_name_branch_unique UNIQUE (name, branch_id);
