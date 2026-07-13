-- Add new roles to app_role enum
-- We can't use ALTER TYPE inside a transaction block with other statements in some cases, but splitting is safer.
-- We'll put this in a separate file if needed, but for now we try this.

-- The app_role enum is created by the later baseline migration. The replay
-- migration applies these values after the baseline has been created.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'app_role') THEN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_hr';
  END IF;
END;
$$;
