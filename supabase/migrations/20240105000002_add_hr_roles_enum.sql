-- Add new roles to app_role enum
-- We can't use ALTER TYPE inside a transaction block with other statements in some cases, but splitting is safer.
-- We'll put this in a separate file if needed, but for now we try this.

-- Note: 'head_hr' and 'hr' needs to be added to the enum.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_hr';
