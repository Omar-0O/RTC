-- Store distribution-specific details while keeping other caravan types compatible.
ALTER TABLE public.caravans
  ADD COLUMN IF NOT EXISTS target_meals INTEGER,
  ADD COLUMN IF NOT EXISTS actual_meals INTEGER,
  ADD COLUMN IF NOT EXISTS total_bags INTEGER,
  ADD COLUMN IF NOT EXISTS bag_contents TEXT[];

-- Make new columns available to the Supabase REST API immediately.
NOTIFY pgrst, 'reload schema';
