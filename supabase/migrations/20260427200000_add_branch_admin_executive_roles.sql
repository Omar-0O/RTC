-- Add branch_admin and executive roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'branch_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'executive';
