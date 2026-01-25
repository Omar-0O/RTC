-- Add unique constraint on user_id for upsert operations
-- First, clean up any duplicate roles per user (keep only one)
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.id < b.id
  AND a.user_id = b.user_id;

-- Drop the old constraint if it exists
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Add a new unique constraint on just user_id
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
